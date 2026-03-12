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

  // Generic page titles to filter out (not real names)
  INVALID_NAMES: [
    'profile / x', 'profile', 'x', 'twitter', 'thread', 'threads', 'instagram',
    'facebook', 'linkedin', 'tiktok', 'youtube', 'log in', 'sign up', 'login',
    'sign in', 'home', 'feed', 'explore', 'search', 'reels', 'watch',
    'not found', '404', 'error', 'page not found', 'access denied',
    'video', 'photo', 'post', 'story', 'reel', 'shorts',
    'hello partner!', 'what is required', 'what does an independent',
    'selling and buying', 'urban retreat', 'log in or sign up',
    // Business/organization indicators
    'network', 'lounge', 'group', 'team', 'club', 'academy', 'center', 'centre',
    'studio', 'shop', 'store', 'boutique', 'llc', 'inc', 'corp', 'ltd',
    'wellness', 'advocate', 'consultant', 'distributor', 'representative',
    // Error page patterns
    "page isn't available", 'page not available', 'content not found',
    'this page', 'unavailable', 'private account',
    // Business/group page names
    'entrepreneurs', 'mompreneurs', 'professionals', 'business owners',
    'help wanted', 'everything', 'rules', 'profil', 'pylon',
    'travel agent', 'real estate', 'insurance agent',
    // Single words that aren't names
    'haven', 'retreat', 'basics', 'essentials',
  ],

  // Patterns that indicate page titles, not names
  INVALID_NAME_PATTERNS: [
    /^profile\s*\/?\s*x$/i,
    /on\s+x:/i,          // "Name on X:" patterns
    /\|\s*x$/i,          // "Name | X" patterns
    /\|\s*facebook$/i,
    /\|\s*instagram$/i,
    /\|\s*linkedin$/i,
    /\|\s*tiktok$/i,
    /^\(@?\w+\)$/,       // Just (@username)
    /^@\w+$/,            // Just @username (we want display name, not handle)
    /\/\s*x$/i,          // "/ X" at end
    /https?:\/\//,       // Contains URL
    /\.(com|org|net)/i,  // Contains domain
    // Organization/business patterns
    /^the\s+\w+\s+\w+/i,     // "The Something Something" (business names)
    /\bvip'?s?\b/i,          // Contains "VIP" or "VIP's"
    /\bnetwork\b/i,          // Contains "network"
    /\blounge\b/i,           // Contains "lounge"
    /\bcareer\b/i,           // Contains "career"
    /\bfor\s+foreigners?\b/i, // "for foreigners"
    /\bwellness\s+advocate\b/i, // "wellness advocate"
    /\bindependent\s+\w+\b/i,   // "independent distributor", etc.
    /\b(distributor|consultant|representative|associate)\b/i, // MLM role titles
    /\b(llc|inc|corp|ltd|co\.?)\b/i, // Business suffixes
    /\b(group|team|club|academy|studio)\b/i, // Organization words
    /\bisn'?t\s+available\b/i, // "isn't available"
    /^\w+esse$/i,          // Names ending in "esse" (brand pattern like "HealthEsse")
    // Additional patterns for page/business names
    /\bwith\s+\w+$/i,          // "My Monat with Megan" - "with Name" at end
    /^my\s+\w+\s+with\b/i,     // "My Brand with..."
    /\b(entrepreneurs?|mompreneurs?)\b/i,  // Entrepreneur groups
    /\bhelp\s+wanted\b/i,      // Job listings
    /\bwomen\s+\w+$/i,         // "Women Entrepreneurs", etc.
    /\beverything$/i,          // "City Everything" pages
    /\brules$/i,               // "Partner Rules" pages
    /\bhaven$/i,               // "Soaper's Haven"
    /^travel\s+agent$/i,       // Role descriptions
    /^real\s+estate$/i,
    /\s+&\s+/,                 // Names with ampersand are usually groups
    /\b[A-Z]{2}\s+help\b/i,    // "NE Help Wanted" (state abbreviation patterns)
    /\bprofil\b/i,             // Non-English "profile"
    /^basic\s+\w+$/i,          // "Basic Partner Rules"
    /\bchristian\s+\w+$/i,     // "Christian Entrepreneurs"
  ],

  // Common first names for validation (subset - most common)
  COMMON_FIRST_NAMES: new Set([
    'james', 'john', 'robert', 'michael', 'david', 'william', 'richard', 'joseph', 'thomas', 'charles',
    'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
    'kenneth', 'kevin', 'brian', 'george', 'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan',
    'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
    'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick', 'jack', 'dennis', 'jerry',
    'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan', 'jessica', 'sarah', 'karen',
    'lisa', 'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
    'dorothy', 'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia',
    'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen',
    'samantha', 'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather',
    'diane', 'ruth', 'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina',
    'joan', 'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria',
    'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail', 'alice',
    'judy', 'sophia', 'grace', 'denise', 'amber', 'doris', 'marilyn', 'danielle', 'beverly', 'isabella',
    'theresa', 'diana', 'natalie', 'brittany', 'charlotte', 'marie', 'kayla', 'alexis', 'lori', 'joe',
    'sue', 'kim', 'chris', 'mike', 'dan', 'tom', 'jim', 'bob', 'bill', 'dave', 'steve', 'jeff', 'matt',
    'jen', 'jenn', 'kate', 'katie', 'beth', 'meg', 'liz', 'anne', 'ann', 'amy', 'tina', 'sandy', 'cindy',
    // Spanish/Latin names
    'jose', 'juan', 'carlos', 'miguel', 'luis', 'jorge', 'pedro', 'francisco', 'antonio', 'manuel',
    'maria', 'carmen', 'rosa', 'ana', 'lucia', 'elena', 'laura', 'paula', 'sofia', 'claudia',
    // German names
    'hans', 'peter', 'klaus', 'wolfgang', 'thomas', 'stefan', 'andreas', 'michael', 'markus', 'frank',
    'anna', 'maria', 'sabine', 'monika', 'petra', 'brigitte', 'ursula', 'renate', 'helga', 'karin',
  ]),

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
    'facebook.com': 'extractSocialMedia',
    'linkedin.com': 'extractSocialMedia',
    'twitter.com': 'extractSocialMedia',
    'x.com': 'extractSocialMedia',
    'instagram.com': 'extractSocialMedia',
    'tiktok.com': 'extractSocialMedia',
    'threads.net': 'extractSocialMedia',
    'youtube.com': 'extractSocialMedia',
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

/**
 * Validates if a string is a real person's name (not a page title)
 */
function isValidName(name) {
  if (!name || typeof name !== 'string') return false;

  const cleaned = name.trim().toLowerCase();

  // Too short or too long
  if (cleaned.length < 3 || cleaned.length > 50) return false;

  // Check against invalid names list
  if (CONFIG.INVALID_NAMES.some(invalid => cleaned === invalid || cleaned.includes(invalid))) {
    return false;
  }

  // Check against invalid patterns
  if (CONFIG.INVALID_NAME_PATTERNS.some(pattern => pattern.test(name))) {
    return false;
  }

  // Should contain at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;

  // Shouldn't be all caps unless short (initials)
  if (name === name.toUpperCase() && name.length > 5) return false;

  // Shouldn't contain too many special chars or pipes
  const specialCount = (name.match(/[|\/\\<>{}[\]]/g) || []).length;
  if (specialCount > 1) return false;

  // Name should have 1-4 words (first + optional middle + last)
  const words = name.trim().split(/\s+/);
  if (words.length > 5) return false;

  // First word should look like a first name
  const firstName = words[0].toLowerCase().replace(/[^a-z]/g, '');

  // If we have common first names list, validate first name loosely
  // Only reject if it looks like a business/brand name pattern
  if (firstName.length < 2) return false;

  // Check for brand name patterns (CamelCase single word, all caps abbreviations)
  if (words.length === 1 && name.length > 6) {
    // Single word with mixed case internal caps (like "HealthEsse") - likely brand
    if (/[a-z][A-Z]/.test(name)) return false;
  }

  return true;
}

/**
 * Cleans and normalizes a name string
 */
function cleanName(name) {
  if (!name) return null;

  let cleaned = name.trim();

  // Remove common suffixes like "| X", "| Facebook", "/ X", "on X:", etc.
  cleaned = cleaned
    .replace(/\s*\|\s*(X|Facebook|Instagram|LinkedIn|TikTok|Twitter|Threads)$/i, '')
    .replace(/\s*\/\s*(X|Twitter)$/i, '')
    .replace(/\s+on\s+(X|Twitter|Instagram|Facebook):?.*$/i, '')
    .replace(/\s*-\s*(X|Facebook|Instagram|LinkedIn|TikTok)$/i, '')
    .replace(/\(@\w+\)\s*$/i, '') // Remove (@username) at end
    .replace(/@\w+\s*$/, '')      // Remove trailing @username
    .trim();

  // Remove emoji at start/end
  cleaned = cleaned.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\s]+/u, '')
                   .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\s]+$/u, '')
                   .trim();

  return cleaned;
}

function generateContactId(url) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
}

/**
 * Check if an email already exists in the contacts collection
 */
async function emailExists(email) {
  if (!email) return false;

  const snapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  return !snapshot.empty;
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
        let rawName = null;
        if (selector.startsWith('meta')) {
          rawName = await page.$eval(selector, el => el.content);
        } else {
          rawName = await page.$eval(selector, el => el.innerText?.trim());
        }

        if (rawName && rawName.length < 100 && rawName.length > 2) {
          const cleaned = cleanName(rawName);
          if (isValidName(cleaned)) {
            contact.name = cleaned;
            break;
          }
        }
      } catch (e) {
        // Selector not found, try next
      }
    }

    // Try og:title as fallback (with validation)
    if (!contact.name) {
      try {
        const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content);
        const cleaned = cleanName(ogTitle);
        if (isValidName(cleaned)) {
          contact.name = cleaned;
        }
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
 * Social media platform extraction (Twitter/X, Instagram, TikTok, Facebook, etc.)
 * These platforms rarely expose emails, so focus on extracting name + company for later enrichment
 */
async function extractSocialMedia(page, url) {
  const contact = {
    profileUrl: url,
    company: detectCompanyFromUrl(url),
    emails: [],
    phones: [],
    name: null,
    username: null,
  };

  try {
    const hostname = new URL(url).hostname;

    // Try multiple meta tags for name (in priority order)
    const metaSelectors = [
      // Twitter/X specific
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      // General
      'meta[property="profile:first_name"]',
      'meta[property="profile:last_name"]',
      'meta[name="author"]',
    ];

    let rawName = null;
    for (const selector of metaSelectors) {
      try {
        const content = await page.$eval(selector, el => el.content);
        if (content && content.length > 2 && content.length < 100) {
          rawName = content;
          break;
        }
      } catch (e) {}
    }

    // Platform-specific name extraction
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      // Twitter format: "Display Name (@username) / X"
      try {
        const title = await page.title();
        const match = title.match(/^([^(@]+)/);
        if (match && match[1]) {
          rawName = match[1].trim();
        }
      } catch (e) {}
    } else if (hostname.includes('instagram.com')) {
      // Instagram format: "Name (@username) • Instagram photos and videos"
      try {
        const title = await page.title();
        const match = title.match(/^([^•(@]+)/);
        if (match && match[1]) {
          rawName = match[1].trim();
        }
      } catch (e) {}
      // Also try the h2 header on profile pages
      try {
        const h2Name = await page.$eval('header h2', el => el.innerText?.trim());
        if (h2Name && !rawName) rawName = h2Name;
      } catch (e) {}
    } else if (hostname.includes('tiktok.com')) {
      // TikTok format: "username (@handle) | TikTok"
      try {
        const title = await page.title();
        const match = title.match(/^([^|(@]+)/);
        if (match && match[1]) {
          rawName = match[1].trim();
        }
      } catch (e) {}
    } else if (hostname.includes('facebook.com')) {
      // Facebook format: "Name - description | Facebook"
      try {
        const title = await page.title();
        const match = title.match(/^([^-|]+)/);
        if (match && match[1]) {
          rawName = match[1].trim();
        }
      } catch (e) {}
    } else if (hostname.includes('threads.net')) {
      // Threads format: "@username on Threads" or just title
      try {
        const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content);
        // Extract name before "on Threads"
        const match = ogTitle.match(/^(.+?)\s+on\s+Threads/i);
        if (match && match[1]) {
          rawName = match[1].replace(/^@/, '').trim();
        }
      } catch (e) {}
    }

    // Clean and validate the name
    if (rawName) {
      contact.name = cleanName(rawName);
      if (!isValidName(contact.name)) {
        contact.name = null;
      }
    }

    // Extract emails from page (rare on social media, but worth trying)
    const pageText = await page.evaluate(() => document.body.innerText);
    contact.emails = extractEmailsFromText(pageText);
    contact.phones = extractPhonesFromText(pageText);

    // Try to extract company from bio text
    if (!contact.company) {
      const bioText = pageText.toLowerCase();
      for (const [company, patterns] of Object.entries(CONFIG.COMPANY_PATTERNS)) {
        for (const pattern of patterns) {
          if (bioText.includes(pattern)) {
            contact.company = company.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            break;
          }
        }
        if (contact.company) break;
      }
    }

  } catch (error) {
    console.error(`  Social media extraction error: ${error.message}`);
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
    case 'extractSocialMedia':
      contact = await extractSocialMedia(page, url);
      break;
    default:
      contact = await extractGeneric(page, url);
  }

  // Final validation: clean and validate the name
  if (contact && contact.name) {
    contact.name = cleanName(contact.name);
    if (!isValidName(contact.name)) {
      contact.name = null;
    }
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

      // Save contact if we have ANY useful info (name, email, or phone)
      // Contacts without emails can be enriched later via SerpAPI search
      if (contact && (contact.emails.length > 0 || contact.phones.length > 0 || contact.name)) {
        const { firstName, lastName } = parseName(contact.name);
        const email = contact.emails[0] || null;
        const phone = contact.phones[0] || null;

        console.log(`  ✓ Name: ${contact.name || 'N/A'}`);
        console.log(`    Email: ${email || 'N/A'}${!email && contact.name ? ' (can enrich via SerpAPI)' : ''}`);
        console.log(`    Company: ${contact.company || 'N/A'}`);

        // Save contact if we have a name (email can be found via enrichment)
        if (!options.dryRun && (email || contact.name)) {
          // Check for duplicate email before saving
          if (email && await emailExists(email)) {
            console.log(`    ⚠ Skipped: Email already exists in collection`);
          } else {
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
              status: email ? 'pending' : 'needs_enrichment',
              emailEnriched: email ? true : false, // Mark if email already found
              randomIndex: Math.random(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            contactsSaved++;
          }
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
