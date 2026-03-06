#!/usr/bin/env node
/**
 * Marketplace Global (MPG) Contact Scraper
 *
 * Puppeteer-based scraper that extracts contact information from MPG
 * representative pages. Contact info is displayed directly on the page
 * within the endorser-info-wrapper div (no modal click required).
 *
 * URL format: https://marketplaceglobal.com/{username}
 * Contact element: <div class="endorser-info-wrapper">
 *   - Name: <strong>John Hughes</strong>
 *   - Email: <div>johnmpgx@gmail.com</div>
 *   - Phone: <div>919-605-8994</div>
 *
 * Flow:
 *   1. Load discovered usernames from mpg_discovered_users collection
 *   2. Navigate to https://marketplaceglobal.com/{username}
 *   3. Extract name, email, phone from .endorser-info-wrapper
 *   4. Save to mpg_contacts collection
 *
 * Usage:
 *   node scripts/mpg-scraper.js --scrape                     # Scrape next batch
 *   node scripts/mpg-scraper.js --scrape --max=50            # Limit to 50 contacts
 *   node scripts/mpg-scraper.js --dry-run                    # Preview only
 *   node scripts/mpg-scraper.js --stats                      # Show stats
 *   node scripts/mpg-scraper.js --reset                      # Reset scraper state
 *   node scripts/mpg-scraper.js --test --username=john       # Test single username
 *
 * Debugging:
 *   HEADLESS=false node scripts/mpg-scraper.js --test --username=john
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
  DISCOVERED_COLLECTION: 'mpg_discovered_users',
  CONTACTS_COLLECTION: 'mpg_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'mpg',

  // MPG URL
  BASE_URL: 'https://marketplaceglobal.com',

  // Rate limiting
  DELAY_BETWEEN_PAGES: 3000,     // 3 seconds between page loads
  DELAY_JITTER: 1500,            // Random jitter up to 1.5 seconds
  PAGE_LOAD_TIMEOUT: 30000,      // 30 second page load timeout
  MAX_CONTACTS_PER_RUN: 200,     // Default max contacts per run

  // Browser config
  HEADLESS: process.env.HEADLESS !== 'false',
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Default sponsor detection - MPG shows this contact for invalid usernames
  // Skip contacts matching these values (case-insensitive)
  // NOTE: MPG's default sponsor may change over time - update if needed
  DEFAULT_SPONSOR: {
    email: 'hailey@haileykelly.com',
    phone: '4586006738',
    name: 'Hailey Kelly',
    username: 'haileykelly'  // The actual username - don't skip if URL matches this
  }
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

/**
 * Check if contact matches the default sponsor (shown for invalid usernames)
 * MPG shows the default sponsor when a username is invalid/not found
 *
 * IMPORTANT: If the username matches the default sponsor's actual username,
 * it's their real page and should NOT be skipped.
 *
 * @param {object} contactInfo - Contact info with fullName, email, phone
 * @param {string} username - The username being scraped
 * @returns {boolean} - True if contact is default sponsor on wrong page (should skip)
 */
function isDefaultSponsor(contactInfo, username) {
  if (!contactInfo) return false;

  const defaultSponsor = CONFIG.DEFAULT_SPONSOR;

  // If this IS the default sponsor's actual page, don't skip it
  if (username && defaultSponsor.username) {
    if (username.toLowerCase() === defaultSponsor.username.toLowerCase()) {
      return false;  // This is their real page, not a fallback
    }
  }

  // Check email match (case-insensitive)
  if (contactInfo.email && defaultSponsor.email) {
    if (contactInfo.email.toLowerCase() === defaultSponsor.email.toLowerCase()) {
      return true;
    }
  }

  // Check phone match (normalize to digits only)
  if (contactInfo.phone && defaultSponsor.phone) {
    const contactPhone = contactInfo.phone.replace(/\D/g, '');
    const defaultPhone = defaultSponsor.phone.replace(/\D/g, '');
    if (contactPhone === defaultPhone) {
      return true;
    }
  }

  // Check name match (case-insensitive, normalized)
  if (contactInfo.fullName && defaultSponsor.name) {
    const contactName = contactInfo.fullName.toLowerCase().trim();
    const defaultName = defaultSponsor.name.toLowerCase().trim();
    if (contactName === defaultName) {
      return true;
    }
  }

  return false;
}

function inferCountryFromPhone(phone) {
  if (!phone) return null;

  const phoneDigits = phone.replace(/\D/g, '');

  // Check for 10-digit US numbers FIRST (before international codes)
  // This prevents US area codes like 919 from being mistaken for India (+91)
  if (phoneDigits.length === 10) {
    return 'United States';
  }

  // Common country codes (for 11+ digit international numbers)
  if (phoneDigits.startsWith('1') && phoneDigits.length === 11) {
    return 'United States';
  } else if (phoneDigits.startsWith('44')) {
    return 'United Kingdom';
  } else if (phoneDigits.startsWith('49')) {
    return 'Germany';
  } else if (phoneDigits.startsWith('39')) {
    return 'Italy';
  } else if (phoneDigits.startsWith('33')) {
    return 'France';
  } else if (phoneDigits.startsWith('34')) {
    return 'Spain';
  } else if (phoneDigits.startsWith('31')) {
    return 'Netherlands';
  } else if (phoneDigits.startsWith('43')) {
    return 'Austria';
  } else if (phoneDigits.startsWith('41')) {
    return 'Switzerland';
  } else if (phoneDigits.startsWith('61')) {
    return 'Australia';
  } else if (phoneDigits.startsWith('64')) {
    return 'New Zealand';
  } else if (phoneDigits.startsWith('52')) {
    return 'Mexico';
  } else if (phoneDigits.startsWith('55')) {
    return 'Brazil';
  } else if (phoneDigits.startsWith('81')) {
    return 'Japan';
  } else if (phoneDigits.startsWith('82')) {
    return 'South Korea';
  } else if (phoneDigits.startsWith('86')) {
    return 'China';
  } else if (phoneDigits.startsWith('91')) {
    return 'India';
  } else if (phoneDigits.startsWith('353')) {
    return 'Ireland';
  } else if (phoneDigits.startsWith('48')) {
    return 'Poland';
  } else if (phoneDigits.startsWith('46')) {
    return 'Sweden';
  } else if (phoneDigits.startsWith('47')) {
    return 'Norway';
  } else if (phoneDigits.startsWith('45')) {
    return 'Denmark';
  } else if (phoneDigits.startsWith('358')) {
    return 'Finland';
  } else if (phoneDigits.startsWith('32')) {
    return 'Belgium';
  } else if (phoneDigits.startsWith('351')) {
    return 'Portugal';
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
    username: null,
    max: CONFIG.MAX_CONTACTS_PER_RUN,
  };

  for (const arg of args) {
    if (arg === '--scrape') options.scrape = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--reset') options.reset = true;
    if (arg === '--test') options.test = true;
    if (arg.startsWith('--username=')) {
      options.username = arg.split('=')[1];
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
 * Scrape contact info from a MPG representative page
 * Returns { fullName, email, phone } or null if not found
 *
 * HTML structure:
 * <div class="endorser-section">
 *   <img src="...">
 *   <div class="endorser-info-wrapper">
 *     You are shopping with <strong>John Hughes</strong> ([Change])
 *     <div>johnmpgx@gmail.com</div>
 *     <div>919-605-8994</div>
 *   </div>
 * </div>
 */
async function scrapeContactFromPage(page, username) {
  const url = `${CONFIG.BASE_URL}/${username}`;

  try {
    console.log(`  Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.PAGE_LOAD_TIMEOUT });

    // Wait for page to fully load
    await sleep(2000);

    // Extract contact info directly from the page (no modal needed)
    const contactInfo = await page.evaluate(() => {
      const result = {
        fullName: null,
        email: null,
        phone: null,
        rawText: null,
      };

      // Find the endorser-info-wrapper
      const wrapper = document.querySelector('.endorser-info-wrapper');
      if (!wrapper) {
        // Try alternative selectors
        const endorserSection = document.querySelector('.endorser-section');
        if (!endorserSection) {
          return result;
        }
        // Capture raw text for debugging
        result.rawText = endorserSection.innerText;
      } else {
        result.rawText = wrapper.innerText;
      }

      // Get text content from the wrapper
      const wrapperText = wrapper ? wrapper.innerText : (document.querySelector('.endorser-section')?.innerText || '');

      // Extract name from <strong> tag first
      const strongEl = wrapper ? wrapper.querySelector('strong') : document.querySelector('.endorser-info-wrapper strong, .endorser-section strong');
      if (strongEl) {
        result.fullName = strongEl.textContent.trim();
      }

      // Fallback: Parse name from "You are shopping with [NAME]" pattern
      if (!result.fullName && wrapperText) {
        const nameMatch = wrapperText.match(/You are shopping with\s+([A-Za-z\s]+?)(?:\s*[\n\r(]|$)/i);
        if (nameMatch && nameMatch[1]) {
          // Clean up the name - remove extra whitespace
          const name = nameMatch[1].trim();
          // Make sure it's not empty and looks like a name (at least 2 chars)
          if (name.length >= 2 && !/^(Change|Shop|Cart)/i.test(name)) {
            result.fullName = name;
          }
        }
      }

      // Extract email (look for @ pattern in divs)
      const emailMatch = wrapperText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        result.email = emailMatch[0];
      }

      // Extract phone (10+ digit pattern)
      // Look for phone number formats: XXX-XXX-XXXX, (XXX) XXX-XXXX, +1XXXXXXXXXX, etc.
      const phoneMatch = wrapperText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        result.phone = phoneMatch[0].trim();
      } else {
        // Fallback: find any sequence of 10+ digits
        const digitsMatch = wrapperText.match(/[\d\s\-().]{10,}/);
        if (digitsMatch) {
          const digits = digitsMatch[0].replace(/\D/g, '');
          if (digits.length >= 10) {
            result.phone = digitsMatch[0].trim();
          }
        }
      }

      return result;
    });

    // Infer country from phone number
    contactInfo.country = inferCountryFromPhone(contactInfo.phone);

    console.log(`    Name: ${contactInfo.fullName || 'not found'}`);
    console.log(`    Email: ${contactInfo.email || 'not found'}`);
    console.log(`    Phone: ${contactInfo.phone || 'not found'}`);
    console.log(`    Country: ${contactInfo.country || 'not found'}`);

    if (process.env.DEBUG && contactInfo.rawText) {
      console.log(`    Raw text: ${contactInfo.rawText.replace(/\n/g, ' | ')}`);
    }

    return contactInfo;

  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function getUnscrapedUsernames(limit) {
  console.log(`\n Loading unscraped usernames (limit: ${limit})...`);

  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', false)
    .orderBy('discoveredAt', 'asc')
    .limit(limit)
    .get();

  const usernames = [];
  snapshot.forEach(doc => {
    usernames.push({
      docId: doc.id,
      username: doc.data().username,
    });
  });

  console.log(`  Found ${usernames.length} unscraped usernames`);
  return usernames;
}

async function checkContactExists(username) {
  const snapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('username', '==', username)
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function saveContact(username, contactInfo, dryRun) {
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
    username,
    profileUrl: `${CONFIG.BASE_URL}/${username}`,

    // Metadata
    company: 'Marketplace Global',
    source: 'mpg_profile',
    scraped: true,
    scrapedAt: admin.firestore.FieldValue.serverTimestamp(),

    // Email campaign fields
    sent: false,
    sentTimestamp: null,
    status: 'pending',
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

async function markUsernameAsScraped(docId, success, dryRun) {
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
  console.log('Resetting scraper state...');

  // Reset discovered usernames to unscraped
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
      console.log(`  Reset ${count} usernames...`);
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

  console.log(`  Reset ${count} discovered usernames`);
  console.log(`  Deleted ${contactCount} contacts`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n MPG Scraper Stats\n');

  // Discovered usernames
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const totalDiscovered = discoveredSnapshot.size;

  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();
  const scrapedCount = scrapedSnapshot.size;

  // Contacts
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION).get();
  const totalContacts = contactsSnapshot.size;

  const pendingSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('status', '==', 'pending')
    .get();
  const pendingCount = pendingSnapshot.size;

  const sentSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('sent', '==', true)
    .get();
  const sentCount = sentSnapshot.size;

  // State
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  console.log('Discovered Usernames:');
  console.log(`  Total:     ${totalDiscovered}`);
  console.log(`  Scraped:   ${scrapedCount}`);
  console.log(`  Pending:   ${totalDiscovered - scrapedCount}`);

  console.log('\nContacts:');
  console.log(`  Total:     ${totalContacts}`);
  console.log(`  Pending:   ${pendingCount}`);
  console.log(`  Sent:      ${sentCount}`);

  if (state.lastRunAt) {
    console.log(`\nLast Run: ${state.lastRunAt.toDate().toISOString()}`);
  }

  if (state.usernamesProcessed !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Usernames Processed:   ${state.usernamesProcessed}`);
    console.log(`  Contacts Saved:        ${state.contactsSaved}`);
    console.log(`  No Email (skipped):    ${state.noEmailSkipped || 0}`);
    console.log(`  Default Sponsor (skip): ${state.defaultSponsorSkipped || 0}`);
    console.log(`  Errors:                ${state.errors}`);
  }

  // Sample contacts
  console.log('\nRecent contacts (last 5):');
  const recentSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  recentSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.fullName || data.username} - ${data.email || 'no email'}`);
  });
}

// ============================================================================
// TEST SINGLE USERNAME
// ============================================================================

async function testSingleUsername(username) {
  console.log(`\n Testing single username: ${username}`);

  const { browser, page } = await launchBrowser();

  try {
    const contactInfo = await scrapeContactFromPage(page, username);

    if (contactInfo) {
      // Check if this is the default sponsor (but not their real page)
      const isDefault = isDefaultSponsor(contactInfo, username);

      console.log('\n Contact found:');
      console.log(`  Name:    ${contactInfo.fullName || 'not found'}`);
      console.log(`  Email:   ${contactInfo.email || 'not found'}`);
      console.log(`  Phone:   ${contactInfo.phone || 'not found'}`);
      console.log(`  Country: ${contactInfo.country || 'not found'}`);

      if (isDefault) {
        console.log('\n  ⚠️  WARNING: This is the DEFAULT SPONSOR (Hailey Kelly)');
        console.log('  This usually means the username is invalid.');
        console.log('  This contact would be SKIPPED during scraping.');
      } else {
        console.log('\n  ✅ This is a VALID contact (not default sponsor, or is their real page)');
      }

      if (process.env.DEBUG && contactInfo.rawText) {
        console.log('\n  Raw text:');
        console.log(`  ${contactInfo.rawText.substring(0, 300)}...`);
      }
    } else {
      console.log('\n No contact info found');
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
  console.log('MARKETPLACE GLOBAL (MPG) CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max contacts: ${options.max}`);
  console.log(`Headless: ${CONFIG.HEADLESS}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get unscraped usernames
  const usernames = await getUnscrapedUsernames(options.max);

  if (usernames.length === 0) {
    console.log('\n No unscraped usernames found. Run discovery first.');
    return;
  }

  // Launch browser
  console.log('\n Launching browser...');
  const { browser, page } = await launchBrowser();

  const stats = {
    usernamesProcessed: 0,
    contactsSaved: 0,
    noEmailSkipped: 0,
    errors: 0,
    duplicates: 0,
    invalidUsernames: 0,
    defaultSponsorSkipped: 0,
  };

  try {
    for (const { docId, username } of usernames) {
      console.log(`\n Processing: ${username} (${stats.usernamesProcessed + 1}/${usernames.length})`);

      // Check if contact already exists
      const exists = await checkContactExists(username);
      if (exists) {
        console.log(`  Skipping: Contact already exists`);
        await markUsernameAsScraped(docId, true, options.dryRun);
        stats.duplicates++;
        stats.usernamesProcessed++;
        continue;
      }

      // Scrape contact
      const contactInfo = await scrapeContactFromPage(page, username);

      // Check for invalid username (no endorser info found)
      const isInvalidUsername = !contactInfo || !contactInfo.fullName;

      // Check if this is the default sponsor (invalid username shows default contact)
      const isDefault = isDefaultSponsor(contactInfo, username);

      if (isDefault) {
        console.log(`  ⚠️  Default sponsor detected (invalid username) - skipping`);
        await markUsernameAsScraped(docId, false, options.dryRun);
        stats.defaultSponsorSkipped++;
      } else if (isInvalidUsername) {
        console.log(`  Invalid username (no representative found)`);
        await markUsernameAsScraped(docId, false, options.dryRun);
        stats.invalidUsernames++;
      } else if (contactInfo && contactInfo.email) {
        // Only save contacts WITH email (no email = not useful for campaigns)
        await saveContact(username, contactInfo, options.dryRun);
        stats.contactsSaved++;
      } else if (contactInfo && contactInfo.fullName && !contactInfo.email) {
        // Valid contact but no email - skip
        console.log(`  Skipping: No email found for ${contactInfo.fullName}`);
        await markUsernameAsScraped(docId, true, options.dryRun);
        stats.noEmailSkipped++;

        await markUsernameAsScraped(docId, true, options.dryRun);
      } else {
        console.log(`  No contact info found`);
        await markUsernameAsScraped(docId, false, options.dryRun);
        stats.errors++;
      }

      stats.usernamesProcessed++;

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
  console.log(`Usernames processed:   ${stats.usernamesProcessed}`);
  console.log(`Contacts saved:        ${stats.contactsSaved}`);
  console.log(`No email (skipped):    ${stats.noEmailSkipped}`);
  console.log(`Default sponsor (skip): ${stats.defaultSponsorSkipped}`);
  console.log(`Invalid usernames:     ${stats.invalidUsernames}`);
  console.log(`Duplicates:            ${stats.duplicates}`);
  console.log(`Errors:                ${stats.errors}`);
  console.log(`Time elapsed:        ${elapsed}s`);
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

  if (options.test && options.username) {
    await testSingleUsername(options.username);
    process.exit(0);
  }

  if (options.scrape) {
    await runScraping(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Usage:');
  console.log('  node scripts/mpg-scraper.js --scrape                     # Scrape next batch');
  console.log('  node scripts/mpg-scraper.js --scrape --max=50            # Limit to 50 contacts');
  console.log('  node scripts/mpg-scraper.js --dry-run                    # Preview only');
  console.log('  node scripts/mpg-scraper.js --stats                      # Show stats');
  console.log('  node scripts/mpg-scraper.js --reset                      # Reset scraper state');
  console.log('  node scripts/mpg-scraper.js --test --username=john       # Test single username');
  console.log('');
  console.log('Debugging:');
  console.log('  HEADLESS=false node scripts/mpg-scraper.js --test --username=john');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
