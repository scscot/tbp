#!/usr/bin/env node
/**
 * Omnilife Contact Scraper
 *
 * Scrapes distributor contact information from Omnilife profile pages.
 *
 * Flow:
 * 1. Load profileUrl from spanish_discovered_urls (company == 'omnilife')
 * 2. Find "JOIN MY ORGANIZATION" link (a.liberty__btn.btn-yellow)
 * 3. Navigate to portal.omnilife.com/registro page
 * 4. Extract distributor_name, distributor_email from hidden form fields
 * 5. Save to spanish_contacts collection (unified collection for all Spanish MLM companies)
 *
 * Usage:
 *   node scripts/omnilife-scraper.js --scrape              # Scrape contacts
 *   node scripts/omnilife-scraper.js --scrape --max=50     # Limit to 50
 *   node scripts/omnilife-scraper.js --test --url=URL      # Test single URL
 *   node scripts/omnilife-scraper.js --stats               # Show stats
 *   node scripts/omnilife-scraper.js --dry-run             # Preview only
 */

const admin = require('firebase-admin');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'spanish_discovered_urls',
  CONTACTS_COLLECTION: 'spanish_contacts',  // Unified collection for all Spanish MLM companies

  // Scraping settings
  DEFAULT_MAX: 50,
  PAGE_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 30000,
  DELAY_BETWEEN_SCRAPES: 2000,

  // Selectors
  JOIN_BUTTON_SELECTOR: 'a.liberty__btn.btn-yellow[href*="portal.omnilife.com/registro"]',
  FALLBACK_JOIN_SELECTOR: 'a[href*="portal.omnilife.com/registro"]',
  DISTRIBUTOR_NAME_SELECTOR: '#distributor_name',
  DISTRIBUTOR_EMAIL_SELECTOR: '#distributor_email',
  DISTRIBUTOR_CODE_SELECTOR: '#distributor_code',
};

// Country code to language mapping for email templates
const COUNTRY_LANGUAGE_MAP = {
  // Spanish-speaking countries
  'ARG': 'es', 'MEX': 'es', 'COL': 'es', 'PER': 'es', 'CHL': 'es',
  'ECU': 'es', 'VEN': 'es', 'BOL': 'es', 'PRY': 'es', 'URY': 'es',
  'CRI': 'es', 'PAN': 'es', 'GTM': 'es', 'HND': 'es', 'SLV': 'es',
  'NIC': 'es', 'DOM': 'es', 'ESP': 'es',
  // Portuguese-speaking
  'BRA': 'pt',
  // German-speaking
  'DEU': 'de', 'AUT': 'de', 'CHE': 'de',
  // English (default)
  'USA': 'en', 'GBR': 'en', 'CAN': 'en', 'AUS': 'en',
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

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scrape: false,
    test: false,
    stats: false,
    dryRun: false,
    max: CONFIG.DEFAULT_MAX,
    url: null,
  };

  for (const arg of args) {
    if (arg === '--scrape') options.scrape = true;
    if (arg === '--test') options.test = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg.startsWith('--max=')) {
      options.max = parseInt(arg.split('=')[1], 10);
    }
    if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    }
  }

  return options;
}

/**
 * Get language from country code
 */
function getLanguageFromCountry(countryCode) {
  if (!countryCode) return 'es';  // Default to Spanish for Omnilife
  return COUNTRY_LANGUAGE_MAP[countryCode.toUpperCase()] || 'es';
}

/**
 * Parse first and last name from full name
 */
function parseFullName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  // Omnilife format appears to be "LastName FirstName MiddleName"
  // e.g., "Villada Rossi Marcela Alejandra"
  // Let's assume last two words are first names, rest is last name
  if (parts.length >= 3) {
    const lastName = parts.slice(0, -2).join(' ');
    const firstName = parts.slice(-2).join(' ');
    return { firstName, lastName };
  }

  // For 2 parts, assume "LastName FirstName"
  return { firstName: parts[1], lastName: parts[0] };
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

/**
 * Try to extract contact info from a registration page
 */
async function extractContactFromRegistrationPage(page, joinHref, profileUrl) {
  // Extract country_code from URL
  const joinUrl = new URL(joinHref);
  const countryCode = joinUrl.searchParams.get('country_code');
  const distributorCodeFromUrl = joinUrl.searchParams.get('distributor_code');

  // Navigate to registration page
  await page.goto(joinHref, {
    waitUntil: 'networkidle2',
    timeout: CONFIG.NAVIGATION_TIMEOUT,
  });

  // Wait for form to load (try multiple selectors)
  await page.waitForSelector('#formRegister, #distributor_email', { timeout: 10000 }).catch(() => null);

  // Extract hidden field values
  const distributorName = await page.$eval(CONFIG.DISTRIBUTOR_NAME_SELECTOR, el => el.value).catch(() => null);
  const distributorEmail = await page.$eval(CONFIG.DISTRIBUTOR_EMAIL_SELECTOR, el => el.value).catch(() => null);
  const distributorCode = await page.$eval(CONFIG.DISTRIBUTOR_CODE_SELECTOR, el => el.value).catch(() => distributorCodeFromUrl);

  if (!distributorEmail) {
    return null;
  }

  // Parse name
  const { firstName, lastName } = parseFullName(distributorName);
  const language = getLanguageFromCountry(countryCode);

  return {
    firstName,
    lastName,
    fullName: distributorName,
    email: distributorEmail.toLowerCase().trim(),
    distributorCode,
    countryCode,
    language,
    profileUrl,
    registrationUrl: joinHref,
    company: 'Omnilife',
  };
}

/**
 * Scrape a single Omnilife profile URL
 * Checks BOTH CTA buttons (/registro and /registro-cliente) for contact info
 */
async function scrapeOmnilifeProfile(browser, profileUrl) {
  const page = await browser.newPage();

  try {
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to profile page
    console.log(`  Loading profile: ${profileUrl}`);
    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.PAGE_TIMEOUT,
    });

    // Find ALL join links on the page (both /registro and /registro-cliente)
    const joinLinks = await page.$$eval('a[href*="portal.omnilife.com/registro"]', links =>
      links.map(link => link.href).filter(href => href.includes('distributor_code'))
    );

    if (joinLinks.length === 0) {
      console.log('    No join links found');
      return { success: false, reason: 'no_join_link' };
    }

    console.log(`    Found ${joinLinks.length} join link(s)`);

    // Try each join link until we find one with an email
    for (const joinHref of joinLinks) {
      console.log(`    Trying: ${joinHref.substring(0, 80)}...`);

      try {
        const contactData = await extractContactFromRegistrationPage(page, joinHref, profileUrl);

        if (contactData) {
          console.log(`    Found: ${contactData.fullName} <${contactData.email}> (${contactData.countryCode})`);
          return { success: true, data: contactData };
        }
      } catch (err) {
        console.log(`    Error on this link: ${err.message}`);
        // Continue to next link
      }
    }

    // No email found in any of the links
    console.log('    No email found in any registration page');
    return { success: false, reason: 'no_email' };

  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return { success: false, reason: error.message };
  } finally {
    await page.close();
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Get pending Omnilife URLs to scrape
 */
async function getPendingUrls(maxCount) {
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'omnilife')
    .where('scraped', '==', false)
    .limit(maxCount)
    .get();

  return snapshot.docs.map(doc => ({
    docId: doc.id,
    ...doc.data()
  }));
}

/**
 * Check if email already exists in contacts
 */
async function emailExists(email) {
  const snapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '==', email.toLowerCase().trim())
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Save contact to Firestore
 */
async function saveContact(contactData, dryRun) {
  if (dryRun) {
    console.log(`    [DRY RUN] Would save: ${contactData.email}`);
    return true;
  }

  // Check for duplicate
  if (await emailExists(contactData.email)) {
    console.log(`    Duplicate email: ${contactData.email}`);
    return false;
  }

  // Add to contacts collection
  await db.collection(CONFIG.CONTACTS_COLLECTION).add({
    ...contactData,
    source: 'omnilife_scraper',
    sent: false,
    status: 'pending',
    randomIndex: Math.random(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return true;
}

/**
 * Mark discovered URL as scraped
 */
async function markAsScraped(docId, success, reason = null, dryRun = false) {
  if (dryRun) return;

  await db.collection(CONFIG.DISCOVERED_COLLECTION).doc(docId).update({
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    scrapeSuccess: success,
    scrapeReason: reason,
  });
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n Omnilife Scraper Stats\n');

  // Discovered URLs
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'omnilife')
    .get();

  let totalDiscovered = 0;
  let scraped = 0;
  let pending = 0;

  discoveredSnapshot.forEach(doc => {
    totalDiscovered++;
    if (doc.data().scraped) {
      scraped++;
    } else {
      pending++;
    }
  });

  console.log('Discovered URLs (spanish_discovered_urls):');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scraped}`);
  console.log(`  Pending:  ${pending}`);

  // Contacts
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION).get();
  let totalContacts = 0;
  let withEmail = 0;
  let sent = 0;
  const byCountry = {};

  contactsSnapshot.forEach(doc => {
    totalContacts++;
    const data = doc.data();
    if (data.email) withEmail++;
    if (data.sent) sent++;
    const country = data.countryCode || 'unknown';
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  console.log(`\nContacts (${CONFIG.CONTACTS_COLLECTION}):`);
  console.log(`  Total:      ${totalContacts}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Sent:       ${sent}`);
  console.log(`  Pending:    ${totalContacts - sent}`);

  if (Object.keys(byCountry).length > 0) {
    console.log('\nBy Country:');
    const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
    for (const [country, count] of sorted.slice(0, 10)) {
      const lang = getLanguageFromCountry(country);
      console.log(`  ${country}: ${count} (${lang})`);
    }
  }

  // Sample contacts
  console.log('\nRecent contacts (last 5):');
  const sampleSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.fullName || 'N/A'} <${data.email}> (${data.countryCode || 'N/A'})`);
  });
}

// ============================================================================
// MAIN SCRAPING FLOW
// ============================================================================

async function runScraping(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('OMNILIFE CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max URLs: ${options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get pending URLs
  const pendingUrls = await getPendingUrls(options.max);
  console.log(`\nFound ${pendingUrls.length} pending URLs to scrape`);

  if (pendingUrls.length === 0) {
    console.log('No URLs to process');
    return;
  }

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  let processed = 0;
  let successful = 0;
  let failed = 0;
  let duplicates = 0;

  try {
    for (const urlDoc of pendingUrls) {
      processed++;
      console.log(`\n[${processed}/${pendingUrls.length}] Processing ${urlDoc.distributorId}`);

      const result = await scrapeOmnilifeProfile(browser, urlDoc.profileUrl);

      if (result.success) {
        const saved = await saveContact(result.data, options.dryRun);
        if (saved) {
          successful++;
        } else {
          duplicates++;
        }
        await markAsScraped(urlDoc.docId, true, null, options.dryRun);
      } else {
        failed++;
        await markAsScraped(urlDoc.docId, false, result.reason, options.dryRun);
      }

      // Delay between scrapes
      if (processed < pendingUrls.length) {
        await sleep(CONFIG.DELAY_BETWEEN_SCRAPES);
      }
    }
  } finally {
    await browser.close();
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Processed:  ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Time:       ${elapsed}s`);
  console.log('='.repeat(60));
}

/**
 * Test scraping a single URL
 */
async function testSingleUrl(url) {
  console.log('='.repeat(60));
  console.log('OMNILIFE SCRAPER TEST');
  console.log('='.repeat(60));
  console.log(`URL: ${url}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const result = await scrapeOmnilifeProfile(browser, url);

    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const options = parseArgs();

  initFirebase();

  if (options.stats) {
    await showStats();
    process.exit(0);
  }

  if (options.test && options.url) {
    await testSingleUrl(options.url);
    process.exit(0);
  }

  if (options.scrape) {
    await runScraping(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Omnilife Contact Scraper\n');
  console.log('Usage:');
  console.log('  node scripts/omnilife-scraper.js --scrape              # Scrape contacts');
  console.log('  node scripts/omnilife-scraper.js --scrape --max=50     # Limit to 50');
  console.log('  node scripts/omnilife-scraper.js --test --url=URL      # Test single URL');
  console.log('  node scripts/omnilife-scraper.js --stats               # Show stats');
  console.log('  node scripts/omnilife-scraper.js --dry-run             # Preview only');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
