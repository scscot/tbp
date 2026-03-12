#!/usr/bin/env node
/**
 * MLM Profile Extractor - Contact Extraction Agent
 *
 * Processes discovered MLM profiles from mlm_discovered_profiles collection
 * and extracts contact information (name, email, company) using Playwright.
 *
 * Integrates with existing email campaign infrastructure by saving contacts
 * to the mlm_contacts collection with campaign-ready schema.
 *
 * Usage:
 *   node scripts/mlm-profile-extractor.js --extract                  # Extract from queue
 *   node scripts/mlm-profile-extractor.js --extract --max=50         # Limit extractions
 *   node scripts/mlm-profile-extractor.js --test --url=URL           # Test single URL
 *   node scripts/mlm-profile-extractor.js --stats                    # Show stats
 *   node scripts/mlm-profile-extractor.js --dry-run --extract        # Preview mode
 *
 * Output:
 *   - mlm_contacts collection: Extracted contacts ready for email campaigns
 *   - Updates mlm_discovered_profiles with scraped=true
 */

const admin = require('firebase-admin');
const path = require('path');
const { chromium } = require('playwright');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  PROFILES_COLLECTION: 'mlm_discovered_profiles',
  CONTACTS_COLLECTION: 'mlm_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'mlm_profile_extractor',

  // Extraction settings
  DEFAULT_MAX: 50,
  PAGE_TIMEOUT: 30000,
  DELAY_BETWEEN_PAGES: 2000,
  JITTER_MS: 500,

  // Playwright settings
  BROWSER_OPTIONS: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },

  // Email extraction
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  EXCLUDED_EMAIL_DOMAINS: [
    'example.com', 'test.com', 'domain.com', 'email.com',
    'facebook.com', 'twitter.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'google.com',
    'wixsite.com', 'wordpress.com', 'shopify.com',
  ],

  // Phone extraction
  PHONE_REGEX: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,

  // Name extraction selectors (common patterns)
  NAME_SELECTORS: [
    'h1',
    '.consultant-name',
    '.distributor-name',
    '.profile-name',
    '[class*="name"]',
    'meta[property="og:title"]',
  ],

  // Company detection patterns
  COMPANY_PATTERNS: {
    'amway': ['amway', 'myamway'],
    'herbalife': ['herbalife', 'myherbalife'],
    'young living': ['youngliving', 'young living'],
    'doterra': ['doterra', 'doterratools'],
    'monat': ['monat', 'mymonat'],
    'arbonne': ['arbonne'],
    'plexus': ['plexus', 'plexusworldwide'],
    'it works': ['itworks', 'myitworks'],
    'scentsy': ['scentsy'],
    'pampered chef': ['pamperedchef'],
    'younique': ['younique', 'youniqueproducts'],
    'rodan and fields': ['rodanandfields', 'myrandf'],
    'mary kay': ['marykay'],
    'avon': ['avon'],
    'tupperware': ['tupperware'],
    'nu skin': ['nuskin'],
    'usana': ['usana'],
    'shaklee': ['shaklee'],
    'melaleuca': ['melaleuca'],
    'beachbody': ['beachbody'],
    'origami owl': ['origamiowl'],
    'thirty-one': ['thirtyone', 'mythirtyone'],
    'paparazzi': ['paparazzi'],
    'color street': ['colorstreet'],
    'pure romance': ['pureromance'],
    'pruvit': ['pruvit'],
    'modere': ['modere'],
    'isagenix': ['isagenix'],
  },

  // Platform-specific extraction handlers
  PLATFORM_HANDLERS: {
    'findsalesrep.com': 'extractFindSalesRep',
    'businessforhome.org': 'extractBusinessForHome',
    'facebook.com': 'extractFacebook',
    'linkedin.com': 'extractLinkedIn',
  },
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

function addJitter(baseMs) {
  return baseMs + Math.random() * CONFIG.JITTER_MS;
}

function detectCompanyFromUrl(url) {
  const lowerUrl = url.toLowerCase();
  for (const [company, patterns] of Object.entries(CONFIG.COMPANY_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerUrl.includes(pattern)) {
        return company.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
  }
  return null;
}

function extractEmailsFromText(text) {
  const matches = text.match(CONFIG.EMAIL_REGEX) || [];
  return matches.filter(email => {
    const domain = email.split('@')[1].toLowerCase();
    return !CONFIG.EXCLUDED_EMAIL_DOMAINS.includes(domain);
  });
}

function extractPhonesFromText(text) {
  return text.match(CONFIG.PHONE_REGEX) || [];
}

function parseName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };

  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function generateContactId(url) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Generic page extraction - works for most profile pages
 */
async function extractGeneric(page, url) {
  const contact = {
    profileUrl: url,
    company: detectCompanyFromUrl(url),
    emails: [],
    phones: [],
    name: null,
  };

  try {
    // Get full page text
    const pageText = await page.evaluate(() => document.body.innerText);

    // Extract emails and phones
    contact.emails = extractEmailsFromText(pageText);
    contact.phones = extractPhonesFromText(pageText);

    // Try to extract name from common selectors
    for (const selector of CONFIG.NAME_SELECTORS) {
      try {
        if (selector.startsWith('meta')) {
          const meta = await page.$eval(selector, el => el.content);
          if (meta && meta.length < 100) {
            contact.name = meta;
            break;
          }
        } else {
          const text = await page.$eval(selector, el => el.innerText?.trim());
          if (text && text.length < 100 && text.length > 2) {
            contact.name = text;
            break;
          }
        }
      } catch (e) {
        // Selector not found, try next
      }
    }

    // Try og:title as fallback
    if (!contact.name) {
      try {
        contact.name = await page.$eval('meta[property="og:title"]', el => el.content);
      } catch (e) {}
    }

  } catch (error) {
    console.error(`  Generic extraction error: ${error.message}`);
  }

  return contact;
}

/**
 * FindSalesRep.com specific extraction
 */
async function extractFindSalesRep(page, url) {
  const contact = {
    profileUrl: url,
    company: null,
    emails: [],
    phones: [],
    name: null,
  };

  try {
    // Wait for profile to load
    await page.waitForSelector('.profile-info, .rep-profile', { timeout: 10000 }).catch(() => {});

    // Extract name
    try {
      contact.name = await page.$eval('h1, .rep-name', el => el.innerText?.trim());
    } catch (e) {}

    // Extract company
    try {
      contact.company = await page.$eval('.company-name, .rep-company', el => el.innerText?.trim());
    } catch (e) {}

    // Extract contact info - FSR often has email/phone visible
    const pageText = await page.evaluate(() => document.body.innerText);
    contact.emails = extractEmailsFromText(pageText);
    contact.phones = extractPhonesFromText(pageText);

  } catch (error) {
    console.error(`  FSR extraction error: ${error.message}`);
  }

  return contact;
}

/**
 * BusinessForHome.org specific extraction
 */
async function extractBusinessForHome(page, url) {
  const contact = {
    profileUrl: url,
    company: null,
    emails: [],
    phones: [],
    name: null,
  };

  try {
    // Extract name from profile
    try {
      contact.name = await page.$eval('h1.entry-title, .distributor-name', el => el.innerText?.trim());
    } catch (e) {}

    // Extract company
    try {
      contact.company = await page.$eval('.company-name, .mlm-company', el => el.innerText?.trim());
    } catch (e) {}

    // BFH profiles often link to social/websites but rarely show email directly
    const pageText = await page.evaluate(() => document.body.innerText);
    contact.emails = extractEmailsFromText(pageText);

  } catch (error) {
    console.error(`  BFH extraction error: ${error.message}`);
  }

  return contact;
}

/**
 * Main extraction coordinator
 */
async function extractProfile(page, url) {
  // Determine which handler to use
  const domain = new URL(url).hostname.replace('www.', '');
  let handler = 'extractGeneric';

  for (const [pattern, handlerName] of Object.entries(CONFIG.PLATFORM_HANDLERS)) {
    if (domain.includes(pattern)) {
      handler = handlerName;
      break;
    }
  }

  // Navigate to page
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
    await sleep(1000); // Let dynamic content load
  } catch (error) {
    console.error(`  Navigation error: ${error.message}`);
    return null;
  }

  // Run appropriate handler
  let contact;
  switch (handler) {
    case 'extractFindSalesRep':
      contact = await extractFindSalesRep(page, url);
      break;
    case 'extractBusinessForHome':
      contact = await extractBusinessForHome(page, url);
      break;
    default:
      contact = await extractGeneric(page, url);
  }

  return contact;
}

// ============================================================================
// MAIN EXTRACTION LOOP
// ============================================================================

async function runExtractor(options = {}) {
  console.log('='.repeat(60));
  console.log('MLM PROFILE EXTRACTOR - Contact Extraction Agent');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max profiles: ${options.max || CONFIG.DEFAULT_MAX}`);

  // Get unscraped profiles
  const maxProfiles = options.max || CONFIG.DEFAULT_MAX;
  const profilesSnapshot = await db.collection(CONFIG.PROFILES_COLLECTION)
    .where('scraped', '==', false)
    .limit(maxProfiles)
    .get();

  const profiles = profilesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  console.log(`\nFound ${profiles.length} unscraped profiles`);

  if (profiles.length === 0) {
    console.log('No profiles to process');
    return { processed: 0, contacts: 0 };
  }

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await chromium.launch(CONFIG.BROWSER_OPTIONS);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let processed = 0;
  let contactsSaved = 0;
  let errors = 0;

  console.log('\n--- Processing Profiles ---\n');

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    console.log(`[${i + 1}/${profiles.length}] ${profile.url.substring(0, 60)}...`);

    try {
      const contact = await extractProfile(page, profile.url);

      if (contact && (contact.emails.length > 0 || contact.phones.length > 0)) {
        const { firstName, lastName } = parseName(contact.name);
        const email = contact.emails[0] || null;
        const phone = contact.phones[0] || null;

        console.log(`  ✓ Name: ${contact.name || 'N/A'}`);
        console.log(`    Email: ${email || 'N/A'}`);
        console.log(`    Company: ${contact.company || 'N/A'}`);

        if (!options.dryRun && email) {
          // Save to contacts collection
          const contactId = generateContactId(profile.url);
          await db.collection(CONFIG.CONTACTS_COLLECTION).doc(contactId).set({
            firstName: firstName,
            lastName: lastName,
            fullName: contact.name,
            email: email,
            phone: phone,
            company: contact.company,
            profileUrl: profile.url,
            source: 'mlm_signal_monitor',
            sent: false,
            status: 'pending',
            randomIndex: Math.random(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          contactsSaved++;
        }
      } else {
        console.log(`  - No contact info found`);
      }

      // Mark profile as scraped
      if (!options.dryRun) {
        await db.collection(CONFIG.PROFILES_COLLECTION).doc(profile.id).update({
          scraped: true,
          scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          hasContact: contact?.emails?.length > 0,
        });
      }

      processed++;
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      errors++;

      // Mark as scraped anyway to avoid infinite loops
      if (!options.dryRun) {
        await db.collection(CONFIG.PROFILES_COLLECTION).doc(profile.id).update({
          scraped: true,
          scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: error.message,
        });
      }
    }

    // Delay between pages
    if (i < profiles.length - 1) {
      await sleep(addJitter(CONFIG.DELAY_BETWEEN_PAGES));
    }
  }

  await browser.close();

  // Update state
  if (!options.dryRun) {
    await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunStats: {
        processed,
        contactsSaved,
        errors,
      },
    }, { merge: true });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Profiles processed: ${processed}`);
  console.log(`Contacts saved: ${contactsSaved}`);
  console.log(`Errors: ${errors}`);

  return { processed, contacts: contactsSaved, errors };
}

async function testUrl(url) {
  console.log(`Testing extraction for: ${url}`);

  const browser = await chromium.launch({ ...CONFIG.BROWSER_OPTIONS, headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    const contact = await extractProfile(page, url);
    console.log('\nExtracted Contact:');
    console.log(JSON.stringify(contact, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

async function showStats() {
  console.log('='.repeat(60));
  console.log('MLM PROFILE EXTRACTOR - Statistics');
  console.log('='.repeat(60));

  // Profiles collection
  const totalProfiles = await db.collection(CONFIG.PROFILES_COLLECTION).count().get();
  const unscraped = await db.collection(CONFIG.PROFILES_COLLECTION)
    .where('scraped', '==', false).count().get();
  const withContact = await db.collection(CONFIG.PROFILES_COLLECTION)
    .where('hasContact', '==', true).count().get();

  console.log(`\n${CONFIG.PROFILES_COLLECTION}:`);
  console.log(`  Total: ${totalProfiles.data().count}`);
  console.log(`  Unscraped: ${unscraped.data().count}`);
  console.log(`  With contact: ${withContact.data().count}`);

  // Contacts collection
  const totalContacts = await db.collection(CONFIG.CONTACTS_COLLECTION).count().get();
  const unsent = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('sent', '==', false).count().get();

  console.log(`\n${CONFIG.CONTACTS_COLLECTION}:`);
  console.log(`  Total: ${totalContacts.data().count}`);
  console.log(`  Unsent: ${unsent.data().count}`);

  // Last run
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (stateDoc.exists) {
    const state = stateDoc.data();
    console.log(`\nLast Run:`);
    console.log(`  Time: ${state.lastRunAt?.toDate()?.toISOString() || 'N/A'}`);
    if (state.lastRunStats) {
      console.log(`  Processed: ${state.lastRunStats.processed}`);
      console.log(`  Contacts saved: ${state.lastRunStats.contactsSaved}`);
    }
  }
}

// ============================================================================
// CLI HANDLING
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    max: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || undefined,
    url: args.find(a => a.startsWith('--url='))?.split('=')[1],
  };

  initFirebase();

  if (args.includes('--stats')) {
    await showStats();
  } else if (args.includes('--test') && options.url) {
    await testUrl(options.url);
  } else if (args.includes('--extract')) {
    await runExtractor(options);
  } else {
    console.log(`
MLM Profile Extractor - Contact Extraction Agent

Usage:
  node scripts/mlm-profile-extractor.js --extract              # Extract contacts
  node scripts/mlm-profile-extractor.js --extract --max=50     # Limit extractions
  node scripts/mlm-profile-extractor.js --dry-run --extract    # Preview mode
  node scripts/mlm-profile-extractor.js --test --url=URL       # Test single URL
  node scripts/mlm-profile-extractor.js --stats                # Show statistics
    `);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
