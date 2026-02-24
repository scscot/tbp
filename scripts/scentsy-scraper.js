#!/usr/bin/env node
/**
 * Scentsy Consultant Scraper
 *
 * Discovers Scentsy consultants by searching the find-a-party-host form
 * using postal codes from the scentsy_zipcodes collection.
 *
 * Flow:
 *   1. Query scentsy_zipcodes where scraped == false, ordered by population DESC
 *   2. For each postal code, search the Scentsy form
 *   3. Extract consultant contact info from result cards
 *   4. Save to scentsy_contacts collection
 *   5. Mark postal code as scraped
 *
 * Usage:
 *   node scentsy-scraper.js --scrape                # Scrape next batch
 *   node scentsy-scraper.js --scrape --max=50       # Custom batch size
 *   node scentsy-scraper.js --country=US            # Specific country only
 *   node scentsy-scraper.js --stats                 # Show collection stats
 *   node scentsy-scraper.js --dry-run               # Preview only
 *   node scentsy-scraper.js --reset                 # Reset all scraped flags
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const path = require('path');

puppeteer.use(StealthPlugin());

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  ZIPCODES_COLLECTION: 'scentsy_zipcodes',
  CONTACTS_COLLECTION: 'scentsy_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'scentsy',

  // Scentsy website
  BASE_URL: 'https://scentsy.com',
  SEARCH_PATH: '/host/find-a-party-host',

  // Scraping settings
  MAX_ZIPCODES_PER_RUN: 20,
  DELAY_BETWEEN_SEARCHES: 3000,
  DELAY_JITTER: 1000,
  PAGE_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 45000,

  // Browser settings
  HEADLESS: process.env.HEADLESS !== 'false',
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Country code to Scentsy country dropdown VALUE mapping (numeric IDs)
const COUNTRY_DROPDOWN_MAP = {
  'US': '1',
  'CA': '2',
  'GB': '4',
  'DE': '3',
  'NL': '6',
  'AU': '15',
};

// Country code to full name
const COUNTRY_NAMES = {
  'US': 'United States',
  'CA': 'Canada',
  'GB': 'United Kingdom',
  'DE': 'Germany',
  'NL': 'Netherlands',
  'AU': 'Australia',
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
  if (!fullName) return { firstName: '', lastName: '' };

  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function generateDocId(name, postalCode, countryCode) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${countryCode.toLowerCase()}_${postalCode}_${normalized}`.substring(0, 100);
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

async function getScraperState() {
  const doc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (doc.exists) {
    return doc.data();
  }

  const defaultState = {
    lastRunAt: null,
    totalZipcodesProcessed: 0,
    totalContactsFound: 0,
    totalContactsSaved: 0,
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

// ============================================================================
// BROWSER MANAGEMENT
// ============================================================================

async function launchBrowser() {
  console.log(`Launching browser (headless: ${CONFIG.HEADLESS})...`);

  const browser = await puppeteer.launch({
    headless: CONFIG.HEADLESS ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  await page.setUserAgent(CONFIG.USER_AGENT);

  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  return { browser, page };
}

// ============================================================================
// SCENTSY FORM INTERACTION
// ============================================================================

async function navigateToSearchPage(page) {
  const url = `${CONFIG.BASE_URL}${CONFIG.SEARCH_PATH}`;
  console.log(`Navigating to ${url}...`);

  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.NAVIGATION_TIMEOUT,
  });

  // Wait for page to fully load
  await sleep(2000);

  // Handle any cookie consent dialogs
  try {
    const cookieBtn = await page.$('button[id*="cookie"], button[class*="cookie"], .cookie-accept, #accept-cookies');
    if (cookieBtn) {
      await cookieBtn.click();
      await sleep(500);
    }
  } catch (e) {
    // No cookie dialog, continue
  }

  return true;
}

async function searchByPostalCode(page, postalCode, countryCode) {
  console.log(`  Searching for postal code: ${postalCode} (${countryCode})...`);

  try {
    // Step 1: Wait for the page locator to become visible (Knockout.js initialization)
    try {
      await page.waitForSelector('#page-locator:not([style*="display: none"])', { timeout: 5000 });
    } catch (e) {
      // Try to wait for the radio button instead
      await page.waitForSelector('#search-by-location', { timeout: 5000 });
    }
    await sleep(500);

    // Step 2: Click the "Search by location" radio button to show the postal code form
    // Use page.click() with the selector directly for more reliable clicking
    try {
      await page.click('#search-by-location');
      await sleep(800); // Wait for Knockout to show the location form
    } catch (e) {
      console.log('    Could not click location radio button:', e.message);
    }

    // Step 3: Wait for the postal code input to be visible
    try {
      await page.waitForSelector('#by-location-postal-code', { visible: true, timeout: 5000 });
    } catch (e) {
      console.log('    Postal code field not visible');
      return [];
    }

    // Step 4: Fill the postal code field
    await page.click('#by-location-postal-code');
    await page.type('#by-location-postal-code', postalCode, { delay: 50 });

    // Step 5: Select country from dropdown (uses numeric value IDs)
    const countryValue = COUNTRY_DROPDOWN_MAP[countryCode];
    if (countryValue) {
      try {
        await page.select('#by-location-country', countryValue);
        await sleep(300);
      } catch (e) {
        console.log('    Could not select country:', e.message);
      }
    }

    // Step 6: Click search button
    try {
      await page.click('[data-systestid="btn-by-location-search"]');
    } catch (e) {
      // Fallback: try pressing Enter
      await page.keyboard.press('Enter');
    }

    // Wait for results to load
    await sleep(3000);

    // Wait for consultant cards to appear
    // Scentsy uses Knockout.js, so we need to wait for the results to be populated
    try {
      await page.waitForSelector('[data-systestid="consultant-card"], [data-systestid="consultant-results"]', {
        timeout: 10000,
      });
      // Give Knockout a moment to render the results
      await sleep(1000);
    } catch (e) {
      console.log('    No results found or timeout waiting for cards');
      return [];
    }

    // Extract consultant information
    const consultants = await extractConsultants(page, postalCode, countryCode);
    return consultants;

  } catch (error) {
    console.log(`    Error searching: ${error.message}`);
    return [];
  }
}

async function extractConsultants(page, postalCode, countryCode) {
  const consultants = await page.evaluate((postalCode, countryCode, countryNames) => {
    const results = [];

    // Scentsy uses [data-systestid="consultant-card"] for result cards
    const cards = document.querySelectorAll('[data-systestid="consultant-card"]');

    cards.forEach(card => {
      const consultant = {
        fullName: '',
        email: null,
        phone: null,
        city: '',
        state: '',
      };

      // Extract name from the card-body paragraph with class text-20px
      // Structure: <p class="text-20px mb-0" data-bind="text: fullName">Name Here</p>
      const nameEl = card.querySelector('.card-body .text-20px, .card-body p:first-of-type');
      if (nameEl && nameEl.textContent.trim()) {
        consultant.fullName = nameEl.textContent.trim();
      }

      // Fallback: Try the card-header button which has "fullName — city, state"
      if (!consultant.fullName) {
        const headerBtn = card.querySelector('.card-header button');
        if (headerBtn && headerBtn.textContent.trim()) {
          const headerText = headerBtn.textContent.trim();
          // Format: "Name — City, State"
          const namePart = headerText.split('—')[0];
          if (namePart) {
            consultant.fullName = namePart.trim();
          }
        }
      }

      // Extract email from mailto link
      // Structure: <a data-bind="text: email, attr: {href: 'mailto:' + email}">email@example.com</a>
      const emailEl = card.querySelector('a[href^="mailto:"]');
      if (emailEl) {
        consultant.email = emailEl.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      }

      // Fallback: find email in text
      if (!consultant.email) {
        const cardText = card.textContent;
        const emailMatch = cardText.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          consultant.email = emailMatch[0].toLowerCase();
        }
      }

      // Extract location from consultant-results-location element
      // Structure: <p data-systestid="consultant-results-location" data-bind="text: city + ', ' + state + ' ' + postalCode">City, State 12345</p>
      const locationEl = card.querySelector('[data-systestid="consultant-results-location"]');
      if (locationEl && locationEl.textContent.trim()) {
        const locText = locationEl.textContent.trim();
        // Format: "City, State PostalCode"
        const parts = locText.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          consultant.city = parts[0];
          // State is before the postal code
          const stateAndZip = parts[1].split(/\s+/);
          consultant.state = stateAndZip[0] || '';
        } else {
          consultant.city = locText;
        }
      }

      // Fallback: parse location from header button text
      if (!consultant.city) {
        const headerBtn = card.querySelector('.card-header button');
        if (headerBtn && headerBtn.textContent.includes('—')) {
          const locationPart = headerBtn.textContent.split('—')[1];
          if (locationPart) {
            const parts = locationPart.trim().split(',').map(p => p.trim());
            if (parts.length >= 2) {
              consultant.city = parts[0];
              consultant.state = parts[1];
            }
          }
        }
      }

      // Note: Scentsy doesn't show phone numbers in search results

      // Only add if we have a name
      if (consultant.fullName) {
        results.push(consultant);
      }
    });

    return results;
  }, postalCode, countryCode, COUNTRY_NAMES);

  // Enrich with additional data
  const enriched = consultants.map(c => {
    const { firstName, lastName } = parseName(c.fullName);
    return {
      ...c,
      firstName,
      lastName,
      postalCode,
      countryCode,
      country: COUNTRY_NAMES[countryCode] || countryCode,
    };
  });

  console.log(`    Found ${enriched.length} consultants`);
  return enriched;
}

// ============================================================================
// DATA STORAGE
// ============================================================================

async function saveConsultant(consultant, dryRun = false) {
  const docId = generateDocId(consultant.fullName, consultant.postalCode, consultant.countryCode);

  // Check if already exists
  const existing = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
  if (existing.exists) {
    return { status: 'duplicate', docId };
  }

  if (dryRun) {
    return { status: 'would_save', docId };
  }

  const doc = {
    fullName: consultant.fullName,
    firstName: consultant.firstName,
    lastName: consultant.lastName,
    email: consultant.email || null,
    phone: consultant.phone || null,
    city: consultant.city || '',
    state: consultant.state || '',
    country: consultant.country,
    countryCode: consultant.countryCode,
    postalCode: consultant.postalCode,
    company: 'Scentsy',
    source: 'scentsy_consultant_search',

    // Email campaign fields
    sent: false,
    status: consultant.email ? 'pending' : 'no_email',
    randomIndex: Math.random(),

    // Metadata
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set(doc);
  return { status: 'saved', docId };
}

async function markZipcodeScraped(docId, contactsFound, dryRun = false) {
  if (dryRun) {
    console.log(`    Would mark ${docId} as scraped`);
    return;
  }

  await db.collection(CONFIG.ZIPCODES_COLLECTION).doc(docId).update({
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    contactsFound: contactsFound,
  });
}

// ============================================================================
// MAIN SCRAPING FUNCTIONS
// ============================================================================

async function getUnscrapedZipcodes(countryFilter = null, limit = CONFIG.MAX_ZIPCODES_PER_RUN) {
  let query = db.collection(CONFIG.ZIPCODES_COLLECTION)
    .where('scraped', '==', false)
    .orderBy('population', 'desc')
    .limit(limit);

  if (countryFilter) {
    query = db.collection(CONFIG.ZIPCODES_COLLECTION)
      .where('scraped', '==', false)
      .where('countryCode', '==', countryFilter.toUpperCase())
      .orderBy('population', 'desc')
      .limit(limit);
  }

  const snapshot = await query.get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function scrapeZipcodes(options = {}) {
  const {
    maxZipcodes = CONFIG.MAX_ZIPCODES_PER_RUN,
    countryFilter = null,
    dryRun = false,
  } = options;

  console.log('\n========================================');
  console.log('SCENTSY CONSULTANT SCRAPER');
  console.log('========================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max zipcodes: ${maxZipcodes}`);
  if (countryFilter) console.log(`Country filter: ${countryFilter}`);
  console.log('========================================\n');

  initFirebase();

  // Get unscraped zipcodes
  const zipcodes = await getUnscrapedZipcodes(countryFilter, maxZipcodes);

  if (zipcodes.length === 0) {
    console.log('No unscraped zipcodes found!');
    return;
  }

  console.log(`Found ${zipcodes.length} unscraped zipcodes\n`);

  // Launch browser
  const { browser, page } = await launchBrowser();

  let totalContactsFound = 0;
  let totalContactsSaved = 0;
  let zipcodesProcessed = 0;

  try {
    // Navigate to search page initially
    await navigateToSearchPage(page);

    for (const zipcode of zipcodes) {
      console.log(`\nProcessing: ${zipcode.postalCode} (${zipcode.countryCode}) - Pop: ${zipcode.population}`);

      // Search for consultants
      const consultants = await searchByPostalCode(page, zipcode.postalCode, zipcode.countryCode);

      totalContactsFound += consultants.length;

      // Save consultants
      let savedCount = 0;
      for (const consultant of consultants) {
        const result = await saveConsultant(consultant, dryRun);
        if (result.status === 'saved' || result.status === 'would_save') {
          savedCount++;
          totalContactsSaved++;
          console.log(`    + ${consultant.fullName}${consultant.email ? ' (' + consultant.email + ')' : ''}`);
        } else if (result.status === 'duplicate') {
          console.log(`    ~ ${consultant.fullName} (duplicate)`);
        }
      }

      // Mark zipcode as scraped
      await markZipcodeScraped(zipcode.id, consultants.length, dryRun);
      zipcodesProcessed++;

      // Delay between searches
      const delay = randomDelay(CONFIG.DELAY_BETWEEN_SEARCHES);
      console.log(`  Waiting ${Math.round(delay)}ms...`);
      await sleep(delay);

      // Re-navigate to search page for next search
      await navigateToSearchPage(page);
    }

  } finally {
    await browser.close();
  }

  // Update scraper state
  if (!dryRun) {
    const state = await getScraperState();
    await updateScraperState({
      totalZipcodesProcessed: (state.totalZipcodesProcessed || 0) + zipcodesProcessed,
      totalContactsFound: (state.totalContactsFound || 0) + totalContactsFound,
      totalContactsSaved: (state.totalContactsSaved || 0) + totalContactsSaved,
    });
  }

  // Print summary
  console.log('\n========================================');
  console.log('SCRAPING COMPLETE');
  console.log('========================================');
  console.log(`Zipcodes processed: ${zipcodesProcessed}`);
  console.log(`Contacts found: ${totalContactsFound}`);
  console.log(`Contacts saved: ${totalContactsSaved}`);
  console.log('========================================\n');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  initFirebase();

  console.log('\n========================================');
  console.log('SCENTSY SCRAPER STATISTICS');
  console.log('========================================\n');

  // Zipcode stats
  const [totalZipcodes, scrapedZipcodes, unscrapedZipcodes] = await Promise.all([
    db.collection(CONFIG.ZIPCODES_COLLECTION).count().get(),
    db.collection(CONFIG.ZIPCODES_COLLECTION).where('scraped', '==', true).count().get(),
    db.collection(CONFIG.ZIPCODES_COLLECTION).where('scraped', '==', false).count().get(),
  ]);

  console.log('ZIPCODES:');
  console.log(`  Total: ${totalZipcodes.data().count}`);
  console.log(`  Scraped: ${scrapedZipcodes.data().count}`);
  console.log(`  Remaining: ${unscrapedZipcodes.data().count}`);

  // Contact stats
  const [totalContacts, contactsWithEmail, contactsPending] = await Promise.all([
    db.collection(CONFIG.CONTACTS_COLLECTION).count().get(),
    db.collection(CONFIG.CONTACTS_COLLECTION).where('email', '!=', null).count().get(),
    db.collection(CONFIG.CONTACTS_COLLECTION).where('status', '==', 'pending').count().get(),
  ]);

  console.log('\nCONTACTS:');
  console.log(`  Total: ${totalContacts.data().count}`);
  console.log(`  With email: ${contactsWithEmail.data().count}`);
  console.log(`  Pending (unsent): ${contactsPending.data().count}`);

  // By country
  console.log('\nBY COUNTRY (zipcodes remaining):');
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    const remaining = await db.collection(CONFIG.ZIPCODES_COLLECTION)
      .where('scraped', '==', false)
      .where('countryCode', '==', code)
      .count().get();
    console.log(`  ${name} (${code}): ${remaining.data().count}`);
  }

  // Scraper state
  const state = await getScraperState();
  console.log('\nSCRAPER STATE:');
  console.log(`  Last run: ${state.lastRunAt?.toDate?.() || 'Never'}`);
  console.log(`  Total zipcodes processed: ${state.totalZipcodesProcessed || 0}`);
  console.log(`  Total contacts found: ${state.totalContactsFound || 0}`);
  console.log(`  Total contacts saved: ${state.totalContactsSaved || 0}`);

  console.log('\n========================================\n');
}

// ============================================================================
// RESET FUNCTIONS
// ============================================================================

async function resetScrapedFlags() {
  initFirebase();

  console.log('Resetting all scraped flags in scentsy_zipcodes...');

  const snapshot = await db.collection(CONFIG.ZIPCODES_COLLECTION).get();

  let batch = db.batch();
  let count = 0;
  let total = 0;

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      scraped: false,
      scrapedAt: null,
      contactsFound: null,
    });
    count++;
    total++;

    if (count >= 500) {
      await batch.commit();
      console.log(`  Reset ${total} documents...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  // Reset scraper state
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
    lastRunAt: null,
    totalZipcodesProcessed: 0,
    totalContactsFound: 0,
    totalContactsSaved: 0,
  });

  console.log(`Done! Reset ${total} zipcode documents.`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Scentsy Consultant Scraper

Usage:
  node scentsy-scraper.js --scrape                # Scrape next batch
  node scentsy-scraper.js --scrape --max=50       # Custom batch size
  node scentsy-scraper.js --country=US            # Specific country only
  node scentsy-scraper.js --stats                 # Show collection stats
  node scentsy-scraper.js --dry-run               # Preview only (with --scrape)
  node scentsy-scraper.js --reset                 # Reset all scraped flags

Countries: US, CA, GB, DE, NL, AU
    `);
    return;
  }

  try {
    if (args.includes('--stats')) {
      await showStats();
      return;
    }

    if (args.includes('--reset')) {
      await resetScrapedFlags();
      return;
    }

    if (args.includes('--scrape')) {
      const maxArg = args.find(a => a.startsWith('--max='));
      const maxZipcodes = maxArg ? parseInt(maxArg.split('=')[1]) : CONFIG.MAX_ZIPCODES_PER_RUN;

      const countryArg = args.find(a => a.startsWith('--country='));
      const countryFilter = countryArg ? countryArg.split('=')[1] : null;

      const dryRun = args.includes('--dry-run');

      await scrapeZipcodes({
        maxZipcodes,
        countryFilter,
        dryRun,
      });
      return;
    }

    console.log('Unknown command. Use --help for usage information.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
