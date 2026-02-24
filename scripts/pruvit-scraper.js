#!/usr/bin/env node
/**
 * Pruvit Contact Scraper
 *
 * Puppeteer-based scraper that extracts contact information from Pruvit
 * referral pages. Contact info is displayed in a modal popup triggered by
 * clicking on the referrer name.
 *
 * URL format: https://pruvit.com/en-us?ref={referralCode}
 * Modal trigger: <span id="referrerModalHandler"> containing <span style="text-decoration: underline;">
 *
 * Flow:
 *   1. Load discovered referral codes from pruvit_discovered_refs collection
 *   2. Navigate to https://pruvit.com/en-us?ref={code}
 *   3. Click on the referrer name to open modal
 *   4. Extract name, email, phone from modal
 *   5. Save to pruvit_contacts collection
 *
 * Usage:
 *   node scripts/pruvit-scraper.js --scrape                     # Scrape next batch
 *   node scripts/pruvit-scraper.js --scrape --max=50            # Limit to 50 contacts
 *   node scripts/pruvit-scraper.js --dry-run                    # Preview only
 *   node scripts/pruvit-scraper.js --stats                      # Show stats
 *   node scripts/pruvit-scraper.js --reset                      # Reset scraper state
 *   node scripts/pruvit-scraper.js --test --code=karen          # Test single code
 *
 * Debugging:
 *   HEADLESS=false node scripts/pruvit-scraper.js --test --code=karen
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
  DISCOVERED_COLLECTION: 'pruvit_discovered_refs',
  CONTACTS_COLLECTION: 'pruvit_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'pruvit',

  // Pruvit URL
  BASE_URL: 'https://pruvit.com/en-us',

  // Rate limiting
  DELAY_BETWEEN_PAGES: 3000,     // 3 seconds between page loads
  DELAY_JITTER: 1500,            // Random jitter up to 1.5 seconds
  MODAL_WAIT_TIMEOUT: 5000,      // Wait for modal to appear
  PAGE_LOAD_TIMEOUT: 30000,      // 30 second page load timeout
  MAX_CONTACTS_PER_RUN: 50,      // Default max contacts per run

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
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();
  // Basic email validation
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length >= 10) {
    return cleaned;
  }
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scrape: false,
    dryRun: false,
    stats: false,
    reset: false,
    test: false,
    code: null,
    max: CONFIG.MAX_CONTACTS_PER_RUN,
  };

  for (const arg of args) {
    if (arg === '--scrape') options.scrape = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--reset') options.reset = true;
    if (arg === '--test') options.test = true;
    if (arg.startsWith('--code=')) {
      options.code = arg.split('=')[1];
    }
    if (arg.startsWith('--max=')) {
      options.max = parseInt(arg.split('=')[1], 10);
    }
  }

  return options;
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
  await page.setDefaultTimeout(CONFIG.PAGE_LOAD_TIMEOUT);

  return { browser, page };
}

// ============================================================================
// CONTACT EXTRACTION
// ============================================================================

/**
 * Scrape contact info from a Pruvit referral page
 * Returns { fullName, email, phone } or null if not found
 */
async function scrapeContactFromPage(page, referralCode) {
  const url = `${CONFIG.BASE_URL}?ref=${referralCode}`;

  try {
    console.log(`  Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.PAGE_LOAD_TIMEOUT });

    // Wait for page to fully load
    await sleep(2000);

    // Check if referrer modal handler exists
    const modalHandler = await page.$('#referrerModalHandler');
    if (!modalHandler) {
      console.log(`    No referrer modal handler found`);
      return null;
    }

    // Find the clickable underlined span inside the modal handler
    const clickableSpan = await page.$('#referrerModalHandler span[style*="text-decoration: underline"]');
    if (!clickableSpan) {
      // Try alternative selector - sometimes it's just the handler itself
      console.log(`    Trying to click modal handler directly...`);
      await modalHandler.click();
    } else {
      console.log(`    Clicking on referrer name...`);
      await clickableSpan.click();
    }

    // Wait for modal to appear
    await sleep(CONFIG.MODAL_WAIT_TIMEOUT);

    // Extract contact info from modal
    const contactInfo = await page.evaluate(() => {
      // Look for modal content - try various selectors
      const modalSelectors = [
        '.modal-body',
        '.modal-content',
        '[role="dialog"]',
        '.MuiDialog-paper',
        '.popup-content',
        '.referrer-modal',
      ];

      let modalContent = null;
      for (const selector of modalSelectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          modalContent = element;
          break;
        }
      }

      // If no modal found, try to get info from the visible popup
      const result = {
        fullName: null,
        email: null,
        phone: null,
        country: null,
        rawText: null,
      };

      // Get all visible text that might contain contact info
      const body = document.body.innerText;

      // Capture raw text for debugging - look for contact info section
      // Search for section containing email to get context
      const emailIndex = body.indexOf('@');
      if (emailIndex > 0) {
        const start = Math.max(0, emailIndex - 200);
        const end = Math.min(body.length, emailIndex + 300);
        result.rawText = body.substring(start, end);
      } else {
        result.rawText = body.substring(0, 800);
      }

      // Email regex
      const emailMatch = body.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        result.email = emailMatch[0];
      }

      // Phone regex - various formats
      const phoneMatch = body.match(/\+?[\d\s\-().]{10,}/);
      if (phoneMatch) {
        result.phone = phoneMatch[0].trim();

        // Infer country from phone prefix
        const phoneDigits = result.phone.replace(/\D/g, '');
        if (phoneDigits.startsWith('1') && phoneDigits.length === 11) {
          result.country = 'United States';
        } else if (phoneDigits.startsWith('44')) {
          result.country = 'United Kingdom';
        } else if (phoneDigits.startsWith('49')) {
          result.country = 'Germany';
        } else if (phoneDigits.startsWith('39')) {
          result.country = 'Italy';
        } else if (phoneDigits.startsWith('33')) {
          result.country = 'France';
        } else if (phoneDigits.startsWith('34')) {
          result.country = 'Spain';
        } else if (phoneDigits.startsWith('31')) {
          result.country = 'Netherlands';
        } else if (phoneDigits.startsWith('43')) {
          result.country = 'Austria';
        } else if (phoneDigits.startsWith('41')) {
          result.country = 'Switzerland';
        } else if (phoneDigits.startsWith('61')) {
          result.country = 'Australia';
        } else if (phoneDigits.startsWith('64')) {
          result.country = 'New Zealand';
        } else if (phoneDigits.startsWith('52')) {
          result.country = 'Mexico';
        } else if (phoneDigits.startsWith('55')) {
          result.country = 'Brazil';
        } else if (phoneDigits.startsWith('81')) {
          result.country = 'Japan';
        } else if (phoneDigits.startsWith('82')) {
          result.country = 'South Korea';
        } else if (phoneDigits.startsWith('86')) {
          result.country = 'China';
        } else if (phoneDigits.startsWith('91')) {
          result.country = 'India';
        } else if (phoneDigits.startsWith('353')) {
          result.country = 'Ireland';
        } else if (phoneDigits.startsWith('48')) {
          result.country = 'Poland';
        } else if (phoneDigits.startsWith('46')) {
          result.country = 'Sweden';
        } else if (phoneDigits.startsWith('47')) {
          result.country = 'Norway';
        } else if (phoneDigits.startsWith('45')) {
          result.country = 'Denmark';
        } else if (phoneDigits.startsWith('358')) {
          result.country = 'Finland';
        } else if (phoneDigits.startsWith('32')) {
          result.country = 'Belgium';
        } else if (phoneDigits.startsWith('351')) {
          result.country = 'Portugal';
        }
      }

      // Try to get name from referrer modal handler
      const referrerSpan = document.querySelector('#referrerModalHandler span[style*="text-decoration: underline"]');
      if (referrerSpan) {
        result.fullName = referrerSpan.textContent.trim();
      }

      // Also try to find name in modal
      if (modalContent) {
        // Look for name elements
        const nameElements = modalContent.querySelectorAll('h1, h2, h3, h4, .name, .title');
        for (const el of nameElements) {
          const text = el.textContent.trim();
          // Name should be 2+ words, no @ (not email), not too long
          if (text && !text.includes('@') && text.includes(' ') && text.length < 100) {
            result.fullName = text;
            break;
          }
        }
      }

      return result;
    });

    console.log(`    Name: ${contactInfo.fullName || 'not found'}`);
    console.log(`    Email: ${contactInfo.email || 'not found'}`);
    console.log(`    Phone: ${contactInfo.phone || 'not found'}`);
    console.log(`    Country: ${contactInfo.country || 'not found'}`);
    if (process.env.DEBUG && contactInfo.rawText) {
      console.log(`    Raw modal text: ${contactInfo.rawText.replace(/\n/g, ' | ')}`);
    }

    // Close modal if possible (click outside or close button)
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.modal-close, .close-button, [aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    });

    return contactInfo;

  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function getUnscrapedCodes(limit) {
  console.log(`\n📂 Loading unscraped referral codes (limit: ${limit})...`);

  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', false)
    .orderBy('discoveredAt', 'asc')
    .limit(limit)
    .get();

  const codes = [];
  snapshot.forEach(doc => {
    codes.push({
      docId: doc.id,
      referralCode: doc.data().referralCode,
    });
  });

  console.log(`  Found ${codes.length} unscraped codes`);
  return codes;
}

async function checkContactExists(referralCode) {
  const snapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('referralCode', '==', referralCode)
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function saveContact(referralCode, contactInfo, dryRun) {
  const { firstName, lastName } = parseName(contactInfo.fullName);
  const email = normalizeEmail(contactInfo.email);
  const phone = normalizePhone(contactInfo.phone);

  const contact = {
    // Core fields
    firstName,
    lastName,
    fullName: contactInfo.fullName || '',
    email,
    phone,
    country: contactInfo.country || null,
    referralCode,
    profileUrl: `${CONFIG.BASE_URL}?ref=${referralCode}`,

    // Metadata
    company: 'Pruvit',
    source: 'pruvit_referral',
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),

    // Email campaign fields
    sent: false,
    sentTimestamp: null,
    status: email ? 'pending' : 'no_email',
    subjectTag: null,
    randomIndex: Math.random(),
    clickedAt: null,

    // Timestamps
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (dryRun) {
    console.log(`    DRY RUN - Would save contact: ${contact.fullName} (${contact.email || 'no email'})`);
    return true;
  }

  await db.collection(CONFIG.CONTACTS_COLLECTION).add(contact);
  console.log(`    Saved contact: ${contact.fullName} (${contact.email || 'no email'})`);
  return true;
}

async function markCodeAsScraped(docId, success, dryRun) {
  if (dryRun) return;

  await db.collection(CONFIG.DISCOVERED_COLLECTION).doc(docId).update({
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    scrapeSuccess: success,
  });
}

async function updateScraperState(stats) {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    ...stats,
  }, { merge: true });
}

async function resetScraperState() {
  console.log('🔄 Resetting scraper state...');

  // Reset discovered refs to unscraped
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();

  let count = 0;
  const batchSize = 500;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { scraped: false, scrapedAt: null });
    count++;

    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  Reset ${count} refs...`);
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }

  // Delete all contacts
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION).get();
  let contactCount = 0;
  batch = db.batch();

  for (const doc of contactsSnapshot.docs) {
    batch.delete(doc.ref);
    contactCount++;

    if (contactCount % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  Deleted ${contactCount} contacts...`);
    }
  }

  if (contactCount % batchSize !== 0) {
    await batch.commit();
  }

  // Reset state doc
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).delete();

  console.log(`  Reset ${count} discovered refs`);
  console.log(`  Deleted ${contactCount} contacts`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n📊 Pruvit Scraper Stats\n');

  // Discovered refs
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const totalDiscovered = discoveredSnapshot.size;

  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();
  const scrapedCount = scrapedSnapshot.size;

  // Contacts
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION).get();
  const totalContacts = contactsSnapshot.size;

  const withEmailSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('status', '==', 'pending')
    .get();
  const withEmailCount = withEmailSnapshot.size;

  const sentSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('sent', '==', true)
    .get();
  const sentCount = sentSnapshot.size;

  // State
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  console.log('Discovered Referral Codes:');
  console.log(`  Total:     ${totalDiscovered}`);
  console.log(`  Scraped:   ${scrapedCount}`);
  console.log(`  Pending:   ${totalDiscovered - scrapedCount}`);

  console.log('\nContacts:');
  console.log(`  Total:     ${totalContacts}`);
  console.log(`  With Email: ${withEmailCount}`);
  console.log(`  No Email:   ${totalContacts - withEmailCount}`);
  console.log(`  Sent:       ${sentCount}`);

  if (state.lastRunAt) {
    console.log(`\nLast Run: ${state.lastRunAt.toDate().toISOString()}`);
  }

  if (state.codesProcessed !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Codes Processed: ${state.codesProcessed}`);
    console.log(`  Contacts Saved:  ${state.contactsSaved}`);
    console.log(`  With Email:      ${state.withEmail}`);
    console.log(`  Errors:          ${state.errors}`);
  }

  // Sample contacts
  console.log('\nRecent contacts (last 5):');
  const recentSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  recentSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.fullName || data.referralCode} - ${data.email || 'no email'}`);
  });
}

// ============================================================================
// TEST SINGLE CODE
// ============================================================================

async function testSingleCode(code) {
  console.log(`\n🧪 Testing single referral code: ${code}`);

  const { browser, page } = await launchBrowser();

  try {
    const contactInfo = await scrapeContactFromPage(page, code);

    if (contactInfo) {
      console.log('\n✅ Contact found:');
      console.log(`  Name:    ${contactInfo.fullName || 'not found'}`);
      console.log(`  Email:   ${contactInfo.email || 'not found'}`);
      console.log(`  Phone:   ${contactInfo.phone || 'not found'}`);
      console.log(`  Country: ${contactInfo.country || 'not found'}`);

      if (process.env.DEBUG && contactInfo.rawText) {
        console.log('\n  Raw modal text:');
        console.log(`  ${contactInfo.rawText.substring(0, 300)}...`);
      }
    } else {
      console.log('\n❌ No contact info found');
    }
  } finally {
    await browser.close();
  }
}

// ============================================================================
// MAIN SCRAPING FLOW
// ============================================================================

async function runScraping(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('PRUVIT CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max contacts: ${options.max}`);
  console.log(`Headless: ${CONFIG.HEADLESS}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get unscraped codes
  const codes = await getUnscrapedCodes(options.max);

  if (codes.length === 0) {
    console.log('\n✅ No unscraped codes found. Run discovery first.');
    return;
  }

  // Launch browser
  console.log('\n🌐 Launching browser...');
  const { browser, page } = await launchBrowser();

  const stats = {
    codesProcessed: 0,
    contactsSaved: 0,
    withEmail: 0,
    noEmail: 0,
    errors: 0,
    duplicates: 0,
  };

  try {
    for (const { docId, referralCode } of codes) {
      console.log(`\n📋 Processing: ${referralCode} (${stats.codesProcessed + 1}/${codes.length})`);

      // Check if contact already exists
      const exists = await checkContactExists(referralCode);
      if (exists) {
        console.log(`  Skipping: Contact already exists`);
        await markCodeAsScraped(docId, true, options.dryRun);
        stats.duplicates++;
        stats.codesProcessed++;
        continue;
      }

      // Scrape contact
      const contactInfo = await scrapeContactFromPage(page, referralCode);

      // Check for invalid referral code (placeholder name shows when code doesn't exist)
      const INVALID_NAME_PATTERNS = [
        'who told you about',
        'who referred you',
        'your referrer',
      ];

      const isInvalidCode = contactInfo && contactInfo.fullName &&
        INVALID_NAME_PATTERNS.some(pattern =>
          contactInfo.fullName.toLowerCase().includes(pattern)
        );

      if (isInvalidCode) {
        console.log(`  ⚠️ Invalid referral code (no promoter registered)`);
        await markCodeAsScraped(docId, false, options.dryRun);
        stats.invalidCodes = (stats.invalidCodes || 0) + 1;
      } else if (contactInfo && (contactInfo.fullName || contactInfo.email)) {
        await saveContact(referralCode, contactInfo, options.dryRun);
        stats.contactsSaved++;

        if (contactInfo.email) {
          stats.withEmail++;
        } else {
          stats.noEmail++;
        }

        await markCodeAsScraped(docId, true, options.dryRun);
      } else {
        console.log(`  No contact info found`);
        await markCodeAsScraped(docId, false, options.dryRun);
        stats.errors++;
      }

      stats.codesProcessed++;

      // Rate limiting
      const delay = randomDelay(CONFIG.DELAY_BETWEEN_PAGES);
      console.log(`  Waiting ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }
  } finally {
    await browser.close();
  }

  // Update state
  if (!options.dryRun) {
    await updateScraperState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Codes processed:  ${stats.codesProcessed}`);
  console.log(`Contacts saved:   ${stats.contactsSaved}`);
  console.log(`  With email:     ${stats.withEmail}`);
  console.log(`  No email:       ${stats.noEmail}`);
  console.log(`Invalid codes:    ${stats.invalidCodes || 0}`);
  console.log(`Duplicates:       ${stats.duplicates}`);
  console.log(`Errors:           ${stats.errors}`);
  console.log(`Time elapsed:     ${elapsed}s`);
  console.log('='.repeat(60));
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

  if (options.reset) {
    await resetScraperState();
    process.exit(0);
  }

  if (options.test && options.code) {
    await testSingleCode(options.code);
    process.exit(0);
  }

  if (options.scrape) {
    await runScraping(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Usage:');
  console.log('  node scripts/pruvit-scraper.js --scrape                     # Scrape next batch');
  console.log('  node scripts/pruvit-scraper.js --scrape --max=50            # Limit to 50 contacts');
  console.log('  node scripts/pruvit-scraper.js --dry-run                    # Preview only');
  console.log('  node scripts/pruvit-scraper.js --stats                      # Show stats');
  console.log('  node scripts/pruvit-scraper.js --reset                      # Reset scraper state');
  console.log('  node scripts/pruvit-scraper.js --test --code=karen          # Test single code');
  console.log('');
  console.log('Debugging:');
  console.log('  HEADLESS=false node scripts/pruvit-scraper.js --test --code=karen');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
