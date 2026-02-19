#!/usr/bin/env node
/**
 * Zinzino Partner Search Scraper
 *
 * Puppeteer scraper that uses Zinzino's Partner Search API to find partners
 * and extracts email addresses via click-through flow on detail pages.
 *
 * API LIMITATION: Zinzino's search API returns max 20 partners per city search.
 * No pagination is supported. To maximize coverage, we use a tiered city approach:
 *   - Tier 1 (100 cities): US, Germany, UK - largest markets
 *   - Tier 2 (50 cities): Large population countries (France, Italy, Spain, etc.)
 *   - Tier 3 (30 cities): Medium markets (Netherlands, Belgium, Sweden, etc.)
 *   - Tier 4 (15 cities): Smaller countries (Baltics, Luxembourg, Malta, etc.)
 * Total: 48 countries, 1,780 cities
 *
 * Flow:
 *   1. Navigate to US Partner Search page (works globally, has email panel)
 *   2. Call searchPartner API with city name (returns up to 20 partners)
 *   3. For each partner: Click Select → Click profile image → Click email icon → Extract email
 *   4. Save to Firestore (deduped by Partner ID)
 *   5. Move to next city and repeat
 *
 * Usage:
 *   node scripts/zinzino-scraper.js --scrape                    # Scrape next batch
 *   node scripts/zinzino-scraper.js --scrape --country=de       # Scrape specific country
 *   node scripts/zinzino-scraper.js --scrape --city=Berlin      # Scrape specific city
 *   node scripts/zinzino-scraper.js --dry-run                   # Preview only
 *   node scripts/zinzino-scraper.js --stats                     # Show stats
 *   node scripts/zinzino-scraper.js --reset-state               # Reset scraper state
 *   node scripts/zinzino-scraper.js --max=50                    # Max NEW partners to save per run
 *
 * Debugging:
 *   HEADLESS=false node scripts/zinzino-scraper.js --scrape --country=de --city=Berlin
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

// ============================================================================
// CONFIGURATION
// ============================================================================

const CITIES_FILE = path.join(__dirname, 'data/zinzino-cities.json');

const CONFIG = {
  // Firestore collections
  CONTACTS_COLLECTION: 'zinzino_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'zinzino',
  CITIES_SCRAPED_COLLECTION: 'zinzino_cities_scraped',

  // Zinzino URLs - ALWAYS use US site for search (partners are global, and US site has email panel flow)
  BASE_URL: 'https://www.zinzino.com',
  // Use US site for all searches - it works with any city name worldwide
  PARTNER_SEARCH_PATH: '/shop/site/us/en-US/Shopping/PartnerSearch',
  SEARCH_API_PATH: '/shop/site/us/en-US/PartnerSearch/GetPartnerSearchResult?shoppingFlow=Shopping',
  DETAIL_PAGE_PATH: '/shop/{partnerId}/US/en-US/ShoppingOrderDetails/ShoppingOrderDetails',

  // Rate limiting
  DELAY_BETWEEN_PARTNERS: 3000,    // 3 seconds between partner fetches
  DELAY_BETWEEN_CITIES: 5000,      // 5 seconds between city searches
  DELAY_JITTER: 1000,              // Random jitter up to 1 second
  MAX_PARTNERS_PER_RUN: 50,        // Max new partners to save per run
  PAGE_TIMEOUT: 30000,             // 30 second timeout for page loads

  // Browser config
  HEADLESS: process.env.HEADLESS !== 'false',
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'teambuilder-plus-fe74d'
    });
  }
  db = admin.firestore();
  console.log('Firebase initialized');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(baseDelay) {
  const jitter = Math.random() * CONFIG.DELAY_JITTER;
  return baseDelay + jitter;
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '', title: '' };

  // Normalize whitespace (collapse multiple spaces)
  let normalized = fullName.trim().replace(/\s+/g, ' ');

  // Common titles to strip (case-insensitive)
  const titles = ['Dr.', 'Dr', 'Prof.', 'Prof', 'Mr.', 'Mr', 'Mrs.', 'Mrs', 'Ms.', 'Ms', 'Dipl.', 'Ing.', 'MBA', 'PhD'];
  let extractedTitle = '';

  // Check for and remove titles at the start
  for (const title of titles) {
    const regex = new RegExp(`^${title.replace('.', '\\.')}\\s+`, 'i');
    if (regex.test(normalized)) {
      extractedTitle = title;
      normalized = normalized.replace(regex, '');
      break;
    }
  }

  const parts = normalized.split(' ');

  if (parts.length === 0) {
    return { firstName: '', lastName: '', title: extractedTitle };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', title: extractedTitle };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    title: extractedTitle
  };
}

function loadCityData() {
  if (!fs.existsSync(CITIES_FILE)) {
    console.error(`Error: City data file not found at ${CITIES_FILE}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(CITIES_FILE, 'utf8'));
  return data.countries;
}

function buildSearchPageUrl() {
  return CONFIG.BASE_URL + CONFIG.PARTNER_SEARCH_PATH;
}

function buildSearchApiUrl() {
  return CONFIG.BASE_URL + CONFIG.SEARCH_API_PATH;
}

function buildDetailPageUrl(partnerId) {
  return CONFIG.BASE_URL + CONFIG.DETAIL_PAGE_PATH.replace('{partnerId}', partnerId);
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

async function getScraperState() {
  const doc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (doc.exists) {
    return doc.data();
  }

  // Initialize default state
  const defaultState = {
    lastRunAt: null,
    currentCountryIndex: 0,
    currentCityIndex: 0,
    partnersFoundTotal: 0,
    lastCitySearched: null,
    lastCountrySearched: null,
  };

  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set(defaultState);
  return defaultState;
}

async function updateScraperState(updates) {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).update({
    ...updates,
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function resetScraperState() {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
    lastRunAt: null,
    currentCountryIndex: 0,
    currentCityIndex: 0,
    partnersFoundTotal: 0,
    lastCitySearched: null,
    lastCountrySearched: null,
  });
  console.log('Scraper state reset');
}

// ============================================================================
// CITY-LEVEL TRACKING
// ============================================================================

/**
 * Record the result of scraping a city
 */
async function saveCityResult(cityData, dryRun = false) {
  if (dryRun) return;

  const docId = `${cityData.countryCode}_${cityData.city.replace(/\s+/g, '_').toLowerCase()}`;

  const doc = {
    city: cityData.city,
    countryCode: cityData.countryCode,
    countryName: cityData.countryName,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    partnersFound: cityData.partnersFound,      // How many the API returned
    partnersSaved: cityData.partnersSaved,      // How many were new (not duplicates)
    partnersWithEmail: cityData.partnersWithEmail,
    duplicatesSkipped: cityData.duplicatesSkipped,
    status: cityData.partnersFound === 0 ? 'zero_results' : 'completed',
  };

  await db.collection(CONFIG.CITIES_SCRAPED_COLLECTION).doc(docId).set(doc);
}

/**
 * Get city scraping statistics
 */
async function getCityScrapingStats() {
  const snapshot = await db.collection(CONFIG.CITIES_SCRAPED_COLLECTION).get();

  const stats = {
    totalCitiesScraped: 0,
    citiesWithResults: 0,
    citiesZeroResults: 0,
    totalPartnersFound: 0,
    totalPartnersWithEmail: 0,
    byCountry: {},
  };

  snapshot.forEach(doc => {
    const data = doc.data();
    stats.totalCitiesScraped++;
    stats.totalPartnersFound += data.partnersFound || 0;
    stats.totalPartnersWithEmail += data.partnersWithEmail || 0;

    if (data.status === 'zero_results') {
      stats.citiesZeroResults++;
    } else {
      stats.citiesWithResults++;
    }

    // Track by country
    const code = data.countryCode || 'unknown';
    if (!stats.byCountry[code]) {
      stats.byCountry[code] = { citiesScraped: 0, withResults: 0, zeroResults: 0, partnersFound: 0 };
    }
    stats.byCountry[code].citiesScraped++;
    if (data.status === 'zero_results') {
      stats.byCountry[code].zeroResults++;
    } else {
      stats.byCountry[code].withResults++;
    }
    stats.byCountry[code].partnersFound += data.partnersFound || 0;
  });

  return stats;
}

/**
 * Check if a city was recently scraped (within given days)
 */
async function wasCityRecentlyScraped(countryCode, city, withinDays = 30) {
  const docId = `${countryCode}_${city.replace(/\s+/g, '_').toLowerCase()}`;
  const doc = await db.collection(CONFIG.CITIES_SCRAPED_COLLECTION).doc(docId).get();

  if (!doc.exists) return false;

  const data = doc.data();
  if (!data.scrapedAt) return false;

  const scrapedAt = data.scrapedAt.toDate();
  const daysSince = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince < withinDays;
}

// ============================================================================
// PUPPETEER BROWSER
// ============================================================================

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: CONFIG.HEADLESS ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  const page = await browser.newPage();
  await page.setUserAgent(CONFIG.USER_AGENT);
  await page.setDefaultTimeout(CONFIG.PAGE_TIMEOUT);

  return { browser, page };
}

// ============================================================================
// COOKIE CONSENT HANDLER
// ============================================================================

async function handleCookieConsent(page) {
  const handled = await page.evaluate(() => {
    const acceptBtn = document.querySelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    if (acceptBtn && acceptBtn.offsetParent !== null) {
      acceptBtn.click();
      return true;
    }
    return false;
  });

  if (handled) {
    await sleep(1500);
  }
  return handled;
}

// ============================================================================
// SEARCH PARTNERS USING API (returns list and injects into page)
// ============================================================================

async function searchPartnersInCity(page, city) {
  const searchPageUrl = buildSearchPageUrl();
  const searchApiUrl = buildSearchApiUrl();

  console.log(`  Searching: ${city}`);

  // Navigate to search page first (establishes session)
  await page.goto(searchPageUrl, { waitUntil: 'networkidle2' });
  await handleCookieConsent(page);
  await sleep(1000);

  // Call the searchPartner API via page context AND inject results into page
  const result = await page.evaluate(async (apiUrl, cityName) => {
    return new Promise((resolve) => {
      if (typeof searchPartner !== 'function' || typeof $ === 'undefined') {
        resolve({ success: false, error: 'searchPartner or jQuery not available' });
        return;
      }

      // Call searchPartner with empty query (name), city, and API URL
      const originalAjax = $.ajax;
      let resolved = false;

      $.ajax = function(options) {
        return originalAjax.apply(this, arguments)
          .done(function(response) {
            if (!resolved) {
              resolved = true;
              // Inject the results into the page DOM
              if (response.success && response.html) {
                $('#partner-search-result').html(response.html);
              }
              resolve({
                success: response.success,
                html: response.html,
                message: response.message
              });
            }
          })
          .fail(function(xhr, status, error) {
            if (!resolved) {
              resolved = true;
              resolve({
                success: false,
                error: error || status,
                status: xhr.status
              });
            }
          });
      };

      // Call the search function
      searchPartner('', cityName, apiUrl);

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'timeout' });
        }
      }, 15000);
    });
  }, searchApiUrl, city);

  if (!result.success || !result.html) {
    console.log(`    No results or error: ${result.error || result.message || 'unknown'}`);
    return [];
  }

  await sleep(500); // Let DOM settle

  // Parse the HTML response for partner data
  const partners = await page.evaluate(() => {
    const results = [];

    // Each partner is in a .row.p-3 div within #partner-search-result
    const partnerRows = document.querySelectorAll('#partner-search-result .row.p-3');

    let index = 0;
    for (const row of partnerRows) {
      const nameEl = row.querySelector('.partner-search-result-header');
      const linkEl = row.querySelector('a[href*="/shop/"]');

      if (!nameEl || !linkEl) continue;

      const name = nameEl.textContent.trim();
      const href = linkEl.href || linkEl.getAttribute('href');

      // Extract partner ID from URL like /shop/2017556439/US/en-US/ShoppingOrderDetails
      const idMatch = href.match(/\/shop\/(\d+)\//);
      if (!idMatch) continue;

      // Extract location (format: "City, COUNTRY")
      const pElements = row.querySelectorAll('p');
      let location = '';
      for (const p of pElements) {
        const text = p.textContent.trim();
        if (text.includes(',') && !text.includes('ID:') && !text.startsWith('ID')) {
          location = text;
          break;
        }
      }

      results.push({
        partnerId: idMatch[1],
        fullName: name,
        location: location,
        rowIndex: index
      });
      index++;
    }

    return results;
  });

  console.log(`    Found ${partners.length} partners`);
  return partners;
}

// ============================================================================
// GET PARTNER EMAIL VIA CLICK-THROUGH FLOW
// ============================================================================

/**
 * Extract email for a partner using the click-through flow:
 * 1. Click "Select" button on partner row (we're on search results page)
 * 2. Wait for navigation to ZIP validation page
 * 3. Click partner profile image in corner (.replicated-image-small)
 * 4. Click email icon (.replicated-contact.mdi-email-outline)
 * 5. Extract email from #replicated-contact-text-email
 */
async function getPartnerEmailViaClickFlow(page, partnerIndex) {
  try {
    // Step 1: Click "Select" on the partner at given index
    const selectClicked = await page.evaluate((idx) => {
      const selectBtns = document.querySelectorAll('#partner-search-result a.btn');
      if (selectBtns[idx]) {
        selectBtns[idx].click();
        return true;
      }
      return false;
    }, partnerIndex);

    if (!selectClicked) {
      return { email: null, error: 'Could not find Select button' };
    }

    // Step 2: Wait for navigation to ZIP validation page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await sleep(1500);

    // Step 3: Click on partner profile image in corner
    await page.waitForSelector('.replicated-image-small, .replicated-site-info', { timeout: 10000 });

    const panelOpened = await page.evaluate(() => {
      // Try clicking the small image in the corner
      const smallImage = document.querySelector('.replicated-image-small');
      if (smallImage) {
        smallImage.click();
        return { clicked: 'replicated-image-small' };
      }

      // Try clicking the replicated site info container
      const siteInfo = document.querySelector('.replicated-site-info');
      if (siteInfo) {
        siteInfo.click();
        return { clicked: 'replicated-site-info' };
      }

      return { clicked: null };
    });

    if (!panelOpened.clicked) {
      return { email: null, error: 'Could not find partner image' };
    }

    await sleep(1500);

    // Step 4: Click email icon to reveal email
    const emailIconClicked = await page.evaluate(() => {
      // Look for the email contact icon
      const emailIcon = document.querySelector('.replicated-contact.mdi-email-outline, .replicated-contact[class*="email"]');
      if (emailIcon) {
        emailIcon.click();
        return true;
      }

      // Try any element with mdi-email
      const mdiEmail = document.querySelector('[class*="mdi-email"]');
      if (mdiEmail) {
        mdiEmail.click();
        return true;
      }

      return false;
    });

    if (!emailIconClicked) {
      return { email: null, error: 'Could not find email icon' };
    }

    await sleep(1000);

    // Step 5: Extract email
    const emailData = await page.evaluate(() => {
      // Primary: Look for the replicated contact text email
      const emailEl = document.querySelector('#replicated-contact-text-email');
      if (emailEl && emailEl.textContent.includes('@')) {
        return { email: emailEl.textContent.trim(), source: 'replicated-contact-text-email' };
      }

      // Backup: Look for mailto link
      const mailtoLink = document.querySelector('.replicated-email-show-more a[href^="mailto:"]');
      if (mailtoLink) {
        return { email: mailtoLink.href.replace('mailto:', ''), source: 'mailto-link' };
      }

      // Last resort: Search page for email pattern
      const pageText = document.body.innerText;
      const emailMatch = pageText.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
      if (emailMatch) {
        return { email: emailMatch[0], source: 'page-text' };
      }

      return { email: null, source: 'not-found' };
    });

    return emailData;

  } catch (error) {
    return { email: null, error: error.message };
  }
}

// ============================================================================
// SAVE PARTNER
// ============================================================================

async function savePartner(partner, dryRun = false) {
  const docId = `zinzino_${partner.partnerId}`;

  // Check if already exists
  const existing = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
  if (existing.exists) {
    return { saved: false, duplicate: true };
  }

  // Normalize fullName (collapse multiple spaces)
  const normalizedFullName = (partner.fullName || '').trim().replace(/\s+/g, ' ');

  if (dryRun) {
    console.log(`      [DRY RUN] Would save: ${normalizedFullName} <${partner.email || 'no email'}>`);
    return { saved: true, duplicate: false };
  }

  const { firstName, lastName, title } = parseName(partner.fullName);

  // Parse location (format: "City, COUNTRY")
  const locationParts = (partner.location || '').split(',').map(s => s.trim());
  const city = locationParts[0] || partner.searchCity;
  const countryFromLocation = locationParts[1] || partner.countryCode.toUpperCase();

  const doc = {
    // Identity
    firstName,
    lastName,
    fullName: normalizedFullName,
    title: title || null,
    partnerId: partner.partnerId,

    // Location
    city,
    state: null,
    country: partner.countryName,
    countryCode: partner.countryCode,

    // Contact
    email: partner.email || null,

    // Source tracking
    company: 'Zinzino',
    source: 'zinzino_partner_search',
    scrapedCity: partner.searchCity,

    // Email campaign fields
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
    sentTimestamp: null,
    clicked: false,
    clickedAt: null,
    randomIndex: Math.random(),

    // Status tracking
    status: partner.email ? 'pending' : 'no_email',
    errorMessage: null,

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set(doc);
  return { saved: true, duplicate: false };
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapePartners(options = {}) {
  const {
    countryFilter = null,
    cityFilter = null,
    maxPartners = CONFIG.MAX_PARTNERS_PER_RUN,
    dryRun = false,
  } = options;

  console.log('\n=== Zinzino Partner Scraper ===\n');

  const countries = loadCityData();
  const countryCodes = Object.keys(countries).sort();
  const state = await getScraperState();

  console.log(`Total countries: ${countryCodes.length}`);
  console.log(`Resume from: Country index ${state.currentCountryIndex}, City index ${state.currentCityIndex}`);
  console.log(`Max partners this run: ${maxPartners}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Filter countries if specified
  let targetCountries = countryCodes;
  if (countryFilter) {
    if (!countries[countryFilter]) {
      console.error(`Country code '${countryFilter}' not found`);
      process.exit(1);
    }
    targetCountries = [countryFilter];
  }

  const { browser, page } = await launchBrowser();

  let totalFound = 0;
  let totalSaved = 0;
  let totalDuplicates = 0;
  let totalWithEmail = 0;
  let citiesSearched = 0;

  try {
    // Process countries
    for (let ci = 0; ci < targetCountries.length && totalSaved < maxPartners; ci++) {
      const countryCode = targetCountries[ci];
      const country = countries[countryCode];

      // Skip if we're resuming and haven't reached the saved position
      if (!countryFilter && ci < state.currentCountryIndex) {
        continue;
      }

      console.log(`\n=== ${country.name} (${countryCode.toUpperCase()}) ===`);

      // Determine which cities to search
      let cities = country.cities;
      if (cityFilter) {
        cities = cities.filter(c => c.toLowerCase().includes(cityFilter.toLowerCase()));
        if (cities.length === 0) {
          console.log(`No cities matching '${cityFilter}' in ${country.name}`);
          continue;
        }
      }

      // Resume from saved city index for current country
      const startCityIndex = (ci === state.currentCountryIndex && !cityFilter)
        ? state.currentCityIndex
        : 0;

      for (let cityIdx = startCityIndex; cityIdx < cities.length && totalSaved < maxPartners; cityIdx++) {
        const city = cities[cityIdx];
        citiesSearched++;

        // Per-city tracking
        let citySaved = 0;
        let cityWithEmail = 0;
        let cityDuplicates = 0;

        // Search for partners in this city (injects results into page DOM)
        // Note: We use US site for all searches (partners are global, US site has email panel flow)
        const partners = await searchPartnersInCity(page, city);

        // Process each partner using click-through flow
        for (let partnerIdx = 0; partnerIdx < partners.length; partnerIdx++) {
          if (totalSaved >= maxPartners) break;

          const partnerData = partners[partnerIdx];

          // Check if already exists in Firestore (skip if duplicate)
          const docId = `zinzino_${partnerData.partnerId}`;
          const existing = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
          if (existing.exists) {
            totalDuplicates++;
            cityDuplicates++;
            console.log(`    - Skipped (duplicate): ${partnerData.fullName}`);
            continue;
          }

          console.log(`    Fetching email for ${partnerData.fullName} (${partnerData.partnerId})`);

          // Get email via click-through flow
          const emailResult = await getPartnerEmailViaClickFlow(page, partnerIdx);
          const email = emailResult.email;

          if (emailResult.error) {
            console.log(`      Warning: ${emailResult.error}`);
          }

          const partner = {
            ...partnerData,
            email,
            searchCity: city,
            countryCode,
            countryName: country.name,
          };

          totalFound++;
          if (email) {
            totalWithEmail++;
            cityWithEmail++;
          }

          // Save to Firestore
          const result = await savePartner(partner, dryRun);

          if (result.saved && !result.duplicate) {
            totalSaved++;
            citySaved++;
            console.log(`      ✓ Saved: ${partner.fullName} ${email ? `<${email}>` : '(no email)'}`);
          }

          // Rate limit between partner fetches
          await sleep(randomDelay(CONFIG.DELAY_BETWEEN_PARTNERS));

          // If there are more partners to process, navigate back to search page and re-search
          if (partnerIdx < partners.length - 1 && totalSaved < maxPartners) {
            console.log(`    Returning to search page for next partner...`);
            const searchPageUrl = buildSearchPageUrl();
            const searchApiUrl = buildSearchApiUrl();

            await page.goto(searchPageUrl, { waitUntil: 'networkidle2' });
            await handleCookieConsent(page);
            await sleep(1000);

            // Re-run search to restore results in DOM
            await page.evaluate(async (apiUrl, cityName) => {
              return new Promise((resolve) => {
                if (typeof searchPartner !== 'function' || typeof $ === 'undefined') {
                  resolve(false);
                  return;
                }

                const originalAjax = $.ajax;
                let resolved = false;

                $.ajax = function(options) {
                  return originalAjax.apply(this, arguments)
                    .done(function(response) {
                      if (!resolved) {
                        resolved = true;
                        if (response.success && response.html) {
                          $('#partner-search-result').html(response.html);
                        }
                        resolve(true);
                      }
                    })
                    .fail(function() {
                      if (!resolved) {
                        resolved = true;
                        resolve(false);
                      }
                    });
                };

                searchPartner('', cityName, apiUrl);
                setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve(false);
                  }
                }, 15000);
              });
            }, searchApiUrl, city);

            await sleep(500);
          }
        }

        // Update state after each city
        if (!dryRun) {
          await updateScraperState({
            currentCountryIndex: ci,
            currentCityIndex: cityIdx + 1,
            lastCitySearched: city,
            lastCountrySearched: countryCode,
            partnersFoundTotal: admin.firestore.FieldValue.increment(partners.length),
          });
        }

        // Save city-level result
        await saveCityResult({
          city,
          countryCode,
          countryName: country.name,
          partnersFound: partners.length,
          partnersSaved: citySaved,
          partnersWithEmail: cityWithEmail,
          duplicatesSkipped: cityDuplicates,
        }, dryRun);

        // Delay between cities
        await sleep(randomDelay(CONFIG.DELAY_BETWEEN_CITIES));
      }

      // Reset city index when moving to next country
      if (!dryRun && ci < targetCountries.length - 1) {
        await updateScraperState({
          currentCityIndex: 0,
        });
      }
    }

  } finally {
    await browser.close();
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Cities searched: ${citiesSearched}`);
  console.log(`Partners found: ${totalFound}`);
  console.log(`Partners with email: ${totalWithEmail}`);
  console.log(`Partners saved: ${totalSaved}`);
  console.log(`Duplicates skipped: ${totalDuplicates}`);
  console.log('');

  return { citiesSearched, totalFound, totalSaved, totalDuplicates, totalWithEmail };
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.CONTACTS_COLLECTION);

  const [total, withEmail, sent, clicked] = await Promise.all([
    collection.count().get(),
    collection.where('email', '!=', null).count().get(),
    collection.where('sent', '==', true).count().get(),
    collection.where('clicked', '==', true).count().get(),
  ]);

  console.log('\n=== Zinzino Contacts Stats ===');
  console.log(`Total contacts: ${total.data().count}`);
  console.log(`With email: ${withEmail.data().count}`);
  console.log(`Emails sent: ${sent.data().count}`);
  console.log(`Clicks: ${clicked.data().count}`);

  // Show state
  const state = await getScraperState();
  console.log('\nScraper State:');
  console.log(`  Last country: ${state.lastCountrySearched || '(none)'}`);
  console.log(`  Last city: ${state.lastCitySearched || '(none)'}`);
  console.log(`  Country index: ${state.currentCountryIndex}`);
  console.log(`  City index: ${state.currentCityIndex}`);
  console.log('');

  // Show city scraping progress
  const cityStats = await getCityScrapingStats();
  console.log('City Scraping Progress:');
  console.log(`  Total cities scraped: ${cityStats.totalCitiesScraped}`);
  console.log(`  Cities with results: ${cityStats.citiesWithResults}`);
  console.log(`  Cities with zero results: ${cityStats.citiesZeroResults}`);
  console.log(`  Total partners found: ${cityStats.totalPartnersFound}`);
  console.log(`  Total partners with email: ${cityStats.totalPartnersWithEmail}`);
  console.log('');

  // Show city progress by country (top 10)
  if (Object.keys(cityStats.byCountry).length > 0) {
    console.log('City Progress By Country (top 10):');
    const sortedCityProgress = Object.entries(cityStats.byCountry)
      .sort((a, b) => b[1].citiesScraped - a[1].citiesScraped)
      .slice(0, 10);
    for (const [code, data] of sortedCityProgress) {
      console.log(`  ${code.toUpperCase()}: ${data.citiesScraped} cities, ${data.partnersFound} partners`);
    }
    console.log('');
  }

  // Show by country (top 10)
  const byCountry = {};
  const snapshot = await collection.limit(10000).get();
  snapshot.forEach(doc => {
    const data = doc.data();
    const code = data.countryCode || 'unknown';
    byCountry[code] = (byCountry[code] || 0) + 1;
  });

  if (Object.keys(byCountry).length > 0) {
    console.log('By Country (top 10):');
    const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [code, count] of sorted) {
      console.log(`  ${code.toUpperCase()}: ${count}`);
    }
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const scrape = args.includes('--scrape');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');
  const reset = args.includes('--reset-state');

  // Parse options
  let maxPartners = CONFIG.MAX_PARTNERS_PER_RUN;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxPartners = parseInt(maxArg.split('=')[1]) || maxPartners;
  }

  let countryFilter = null;
  const countryArg = args.find(a => a.startsWith('--country='));
  if (countryArg) {
    countryFilter = countryArg.split('=')[1].toLowerCase();
  }

  let cityFilter = null;
  const cityArg = args.find(a => a.startsWith('--city='));
  if (cityArg) {
    cityFilter = cityArg.split('=')[1];
  }

  if (!scrape && !stats && !reset) {
    console.log('Zinzino Partner Search Scraper\n');
    console.log('Usage:');
    console.log('  node scripts/zinzino-scraper.js --scrape              # Scrape next batch');
    console.log('  node scripts/zinzino-scraper.js --scrape --country=de # Scrape specific country');
    console.log('  node scripts/zinzino-scraper.js --scrape --city=Berlin # Scrape specific city');
    console.log('  node scripts/zinzino-scraper.js --stats               # Show collection stats');
    console.log('  node scripts/zinzino-scraper.js --reset-state         # Reset scraper state');
    console.log('  node scripts/zinzino-scraper.js --dry-run             # Preview only');
    console.log('  node scripts/zinzino-scraper.js --max=N               # Max partners per run (default: 50)');
    console.log('');
    console.log('Debugging:');
    console.log('  HEADLESS=false node scripts/zinzino-scraper.js --scrape --country=de --city=Berlin');
    console.log('');
    process.exit(1);
  }

  initFirebase();

  if (reset) {
    await resetScraperState();
    process.exit(0);
  }

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (scrape) {
    await scrapePartners({
      countryFilter,
      cityFilter,
      maxPartners,
      dryRun,
    });
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
