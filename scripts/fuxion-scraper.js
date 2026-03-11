#!/usr/bin/env node
/**
 * FuXion Contact Scraper
 *
 * Scrapes distributor contact information from FuXion enrollment pages.
 * Uses Puppeteer because the page content is JavaScript-rendered.
 *
 * Flow:
 * 1. Get distributorId from spanish_discovered_urls (company == 'fuxion')
 * 2. Construct URL: https://ifuxion.com/{distributorId}/enrollment/enrolleeinfo?rule=3
 * 3. Extract name from <strong class="media-heading"> and email from <a href="mailto:">
 * 4. Save to spanish_contacts collection
 *
 * Usage:
 *   node scripts/fuxion-scraper.js --scrape              # Scrape contacts
 *   node scripts/fuxion-scraper.js --scrape --max=50     # Limit to 50
 *   node scripts/fuxion-scraper.js --test --id=ID        # Test single distributor
 *   node scripts/fuxion-scraper.js --stats               # Show stats
 *   node scripts/fuxion-scraper.js --dry-run             # Preview only
 */

const admin = require('firebase-admin');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'spanish_discovered_urls',
  CONTACTS_COLLECTION: 'spanish_contacts',  // Unified collection for all Spanish MLM companies

  // Scraping settings
  DEFAULT_MAX: 100,
  DELAY_BETWEEN_SCRAPES: 2000,  // 2 seconds between requests
  PAGE_TIMEOUT: 30000,
  WAIT_FOR_CONTENT: 5000,  // Wait for JS to render

  // URL template
  ENROLLMENT_URL_TEMPLATE: 'https://ifuxion.com/{distributorId}/enrollment/enrolleeinfo?rule=3',
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initFirebase() {
  if (db) return;

  const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  db = admin.firestore();
  console.log('Firebase initialized');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse full name into first and last name
 * FuXion format: "Carlos Torres" (FirstName LastName)
 */
function parseFullName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  // Standard format: FirstName LastName(s)
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Determine language based on common Spanish-speaking patterns
 * FuXion is primarily Latin American, so default to Spanish
 */
function getLanguage() {
  return 'es';  // FuXion is primarily Spanish-speaking markets
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

/**
 * Scrape contact info from FuXion enrollment page using Puppeteer
 */
async function scrapeDistributor(browser, distributorId, profileUrl) {
  const enrollmentUrl = CONFIG.ENROLLMENT_URL_TEMPLATE.replace('{distributorId}', distributorId);
  let page = null;

  try {
    console.log(`  Fetching: ${enrollmentUrl}`);

    page = await browser.newPage();

    // Set viewport to look like a real browser
    await page.setViewport({ width: 1920, height: 1080 });

    // Set extra HTTP headers to appear more legitimate
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    });

    // Navigate to page
    await page.goto(enrollmentUrl, {
      waitUntil: 'networkidle0',
      timeout: CONFIG.PAGE_TIMEOUT
    });

    // Wait for content to load - try waiting for specific element
    try {
      await page.waitForSelector('div.media-body', { timeout: 10000 });
    } catch (e) {
      // Element not found within timeout, continue anyway
      console.log('    Warning: media-body not found quickly, waiting longer...');
      await delay(CONFIG.WAIT_FOR_CONTENT);
    }

    // Try to find the media-body element
    const contactData = await page.evaluate(() => {
      // Find the media-body div containing distributor info
      const mediaBody = document.querySelector('div.media-body');

      if (!mediaBody) {
        return { success: false, reason: 'no_media_body' };
      }

      // Extract name from <strong class="media-heading">
      const nameElement = mediaBody.querySelector('strong.media-heading');
      const fullName = nameElement ? nameElement.textContent.trim() : null;

      // Extract email from <a href="mailto:...">
      const emailLink = mediaBody.querySelector('a[href^="mailto:"]');
      const email = emailLink ? emailLink.href.replace('mailto:', '').trim() : null;

      // Extract ID number if available
      const spanText = mediaBody.querySelector('span') ? mediaBody.querySelector('span').textContent : '';
      const idMatch = spanText.match(/ID#\s*(\d+)/);
      const distributorCode = idMatch ? idMatch[1] : null;

      return {
        success: true,
        fullName,
        email,
        distributorCode
      };
    });

    if (!contactData.success) {
      return { success: false, reason: contactData.reason };
    }

    if (!contactData.email) {
      return { success: false, reason: 'no_email' };
    }

    if (!contactData.fullName) {
      return { success: false, reason: 'no_name' };
    }

    // Parse name
    const { firstName, lastName } = parseFullName(contactData.fullName);

    console.log(`    Found: ${contactData.fullName} <${contactData.email}>`);

    return {
      success: true,
      data: {
        firstName,
        lastName,
        fullName: contactData.fullName,
        email: contactData.email.toLowerCase().trim(),
        distributorId,
        distributorCode: contactData.distributorCode,
        language: getLanguage(),
        profileUrl,
        enrollmentUrl,
        company: 'FuXion',
      }
    };

  } catch (error) {
    if (error.message.includes('timeout')) {
      return { success: false, reason: 'timeout' };
    }
    return { success: false, reason: error.message };
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Get pending FuXion URLs to scrape
 */
async function getPendingUrls(maxCount) {
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .where('scraped', '==', false)
    .limit(maxCount)
    .get();

  return snapshot.docs.map(doc => ({
    docId: doc.id,
    ...doc.data()
  }));
}

/**
 * Check if contact already exists
 */
async function contactExists(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const docId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

  const doc = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
  return doc.exists;
}

/**
 * Save contact to Firestore
 */
async function saveContact(contactData) {
  const docId = contactData.email.replace(/[^a-z0-9]/g, '_');

  await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set({
    ...contactData,
    sent: false,
    status: 'pending',
    source: 'fuxion_scraper',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return docId;
}

/**
 * Mark URL as scraped
 */
async function markAsScraped(docId, success, reason = null) {
  await db.collection(CONFIG.DISCOVERED_COLLECTION).doc(docId).update({
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    scrapeSuccess: success,
    scrapeReason: reason || null,
  });
}

// ============================================================================
// STATS FUNCTION
// ============================================================================

async function showStats() {
  // Discovered URLs stats
  const totalSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .count()
    .get();

  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .where('scraped', '==', true)
    .count()
    .get();

  const pendingCount = totalSnapshot.data().count - scrapedSnapshot.data().count;

  // Contacts stats
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('company', '==', 'FuXion')
    .get();

  let withEmail = 0;
  let sent = 0;
  let pending = 0;

  contactsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.email) withEmail++;
    if (data.sent) sent++;
    else pending++;
  });

  console.log('\n FuXion Scraper Stats\n');
  console.log('Discovered URLs (spanish_discovered_urls):');
  console.log(`  Total:    ${totalSnapshot.data().count}`);
  console.log(`  Scraped:  ${scrapedSnapshot.data().count}`);
  console.log(`  Pending:  ${pendingCount}`);
  console.log('');
  console.log('Contacts (spanish_contacts where company=FuXion):');
  console.log(`  Total:      ${contactsSnapshot.size}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Sent:       ${sent}`);
  console.log(`  Pending:    ${pending}`);

  // Show recent contacts
  if (contactsSnapshot.size > 0) {
    console.log('\nRecent contacts (last 5):');
    const recentDocs = contactsSnapshot.docs.slice(-5);
    recentDocs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.fullName} <${data.email}>`);
    });
  }
}

// ============================================================================
// MAIN SCRAPE FUNCTION
// ============================================================================

async function runScrape(options = {}) {
  const { maxUrls = CONFIG.DEFAULT_MAX, dryRun = false } = options;

  console.log('============================================================');
  console.log('FUXION CONTACT SCRAPER (Puppeteer)');
  console.log('============================================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max URLs: ${maxUrls}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const urls = await getPendingUrls(maxUrls);
  console.log(`Found ${urls.length} pending URLs to scrape\n`);

  if (urls.length === 0) {
    console.log('No pending URLs. Scraping complete!');
    return { processed: 0, successful: 0, duplicates: 0, failed: 0 };
  }

  // Launch browser with stealth settings
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  let processed = 0;
  let successful = 0;
  let duplicates = 0;
  let failed = 0;

  try {
    for (const url of urls) {
      processed++;
      console.log(`[${processed}/${urls.length}] Processing ${url.distributorId}`);

      const result = await scrapeDistributor(browser, url.distributorId, url.profileUrl);

      if (result.success) {
        // Check for duplicates
        const exists = await contactExists(result.data.email);
        if (exists) {
          console.log(`    Duplicate: ${result.data.email}`);
          duplicates++;
          if (!dryRun) {
            await markAsScraped(url.docId, true, 'duplicate');
          }
        } else {
          if (!dryRun) {
            await saveContact(result.data);
            await markAsScraped(url.docId, true);
          }
          successful++;
        }
      } else {
        console.log(`    Failed: ${result.reason}`);
        failed++;
        if (!dryRun) {
          await markAsScraped(url.docId, false, result.reason);
        }
      }

      // Delay between requests
      if (processed < urls.length) {
        await delay(CONFIG.DELAY_BETWEEN_SCRAPES);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n============================================================');
  console.log('SCRAPING COMPLETE');
  console.log('============================================================');
  console.log(`Processed:  ${processed}`);
  console.log(`Successful: ${successful}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Failed:     ${failed}`);
  console.log('============================================================');

  return { processed, successful, duplicates, failed };
}

// ============================================================================
// TEST SINGLE DISTRIBUTOR
// ============================================================================

async function testDistributor(distributorId) {
  console.log('============================================================');
  console.log('FUXION SCRAPER - TEST MODE (Puppeteer)');
  console.log('============================================================');
  console.log(`Testing distributor: ${distributorId}\n`);

  // Launch browser with stealth settings
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080'
    ]
  });

  try {
    const result = await scrapeDistributor(browser, distributorId, `https://ifuxion.com/${distributorId}`);

    if (result.success) {
      console.log('\nExtracted data:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.log(`\nFailed: ${result.reason}`);
    }

    return result;
  } finally {
    await browser.close();
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  initFirebase();

  if (args.includes('--stats')) {
    await showStats();
    return;
  }

  if (args.includes('--test')) {
    const idArg = args.find(a => a.startsWith('--id='));
    const distributorId = idArg ? idArg.split('=')[1] : 'CarlosTorres';
    await testDistributor(distributorId);
    return;
  }

  if (args.includes('--scrape')) {
    const maxArg = args.find(a => a.startsWith('--max='));
    const maxUrls = maxArg ? parseInt(maxArg.split('=')[1]) : CONFIG.DEFAULT_MAX;
    const dryRun = args.includes('--dry-run');

    await runScrape({ maxUrls, dryRun });
    return;
  }

  // Default: show usage
  console.log(`
FuXion Contact Scraper (Puppeteer)

Usage:
  node scripts/fuxion-scraper.js --scrape              # Scrape contacts
  node scripts/fuxion-scraper.js --scrape --max=50     # Limit to 50
  node scripts/fuxion-scraper.js --test --id=ID        # Test single distributor
  node scripts/fuxion-scraper.js --stats               # Show stats
  node scripts/fuxion-scraper.js --dry-run             # Preview only
`);
}

main().catch(console.error);
