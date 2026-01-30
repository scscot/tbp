#!/usr/bin/env node
/**
 * Multi-Company Contact Scraper
 *
 * Scrapes contact information (firstName, lastName, email) from direct sales
 * distributor pages and updates Firestore. Works with any company that has
 * discovered patterns in patterns.json.
 *
 * Usage:
 *   node scripts/contacts-scraper.js --company=Herbalife --max=100
 *   node scripts/contacts-scraper.js --all --max=100
 *   node scripts/contacts-scraper.js --company=doTERRA --max=50 --dry-run
 *
 * Arguments:
 *   --company=NAME  Scrape specific company (use display name like "Herbalife", "doTERRA")
 *   --all           Scrape all companies with pending URLs
 *   --max=N         Maximum URLs to process per run (default: 100)
 *   --dry-run       Preview only, no Firestore writes
 *
 * Environment variables:
 *   MAX_URLS - Maximum URLs to process per run (default: 100)
 *   DRY_RUN - If "true", don't write to Firestore (preview only)
 *   ANTHROPIC_API_KEY - Required for Claude AI name extraction
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 *
 * Early Termination (Cumulative Tracking):
 *   Company scrape stats are tracked cumulatively in Firestore across runs.
 *   If a company reaches 15+ URLs scraped with 0 emails found (cumulative),
 *   it is marked as a "no-email platform" in patterns.json and ALL documents
 *   for that company are deleted from Firestore to save resources.
 *   Stats are stored in: config/contactsScraper.companyStats
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore
  COLLECTION: 'direct_sales_contacts',

  // Rate limiting
  DELAY_BETWEEN_PAGES: 2000,
  JITTER_MS: 500,
  PAGE_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 30000,

  // Safety limits
  MAX_URLS_PER_RUN: 200,
  MAX_RETRIES: 2,  // Delete after 2 failed attempts
  CONSECUTIVE_ERROR_LIMIT: 10,

  // Early termination - cumulative sample size before marking as no-email platform
  NO_EMAIL_SAMPLE_SIZE: 15,

  // Firestore path for cumulative company stats
  STATS_COLLECTION: 'config',
  STATS_DOC: 'contactsScraper',

  // Email notifications
  SMTP_HOST: 'smtp.dreamhost.com',
  SMTP_PORT: 587,
  NOTIFY_EMAIL: 'scscot@gmail.com',

  // Browser settings
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Patterns file
  PATTERNS_FILE: path.join(__dirname, 'patterns.json'),

  // Corporate/generic email prefixes to filter out (these are not individual contacts)
  CORPORATE_EMAIL_PREFIXES: [
    'customerservice',
    'customer.service',
    'customer-service',
    'support',
    'help',
    'info',
    'contact',
    'sales',
    'admin',
    'webmaster',
    'noreply',
    'no-reply',
    'no.reply',
    'donotreply',
    'do-not-reply',
    'marketing',
    'press',
    'media',
    'hr',
    'careers',
    'jobs',
    'legal',
    'privacy',
    'abuse',
    'postmaster',
    'mailer-daemon',
    'hello',
    'team',
    'office',
    'general',
  ],
};

// ============================================================================
// COMPANY NAME MAPPING (domain -> display name)
// ============================================================================

const COMPANY_NAMES = {
  'herbalife.com': 'Herbalife',
  'doterra.com': 'doTERRA',
  'youngliving.com': 'Young Living',
  'monatglobal.com': 'Monat',
  'arbonne.com': 'Arbonne',
  'scentsy.com': 'Scentsy',
  'itworks.com': 'It Works!',
  'pruvitnow.com': 'Pruvit',
  'lifewave.com': 'LifeWave',
  'ambitenergy.com': 'Ambit Energy',
  'nuskin.com': 'Nu Skin',
  'shaklee.com': 'Shaklee',
  'usana.com': 'USANA',
  'isagenix.com': 'Isagenix',
  'amway.com': 'Amway',
  'marykay.com': 'Mary Kay',
  'primerica.com': 'Primerica',
  'avon.com': 'Avon',
  'foreverliving.com': 'Forever Living',
  'zilis.com': 'Zilis',
};

// Reverse mapping (display name -> domain)
const DOMAIN_BY_NAME = Object.fromEntries(
  Object.entries(COMPANY_NAMES).map(([domain, name]) => [name.toLowerCase(), domain])
);

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

function initializeFirebase() {
  const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath))
    });
  }

  return admin.firestore();
}

// ============================================================================
// PATTERNS FILE OPERATIONS
// ============================================================================

function loadPatterns() {
  if (!fs.existsSync(CONFIG.PATTERNS_FILE)) {
    console.error(`Error: patterns.json not found at ${CONFIG.PATTERNS_FILE}`);
    console.error('Run base_url_discovery.js first to discover URL patterns.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG.PATTERNS_FILE, 'utf8'));
}

function savePatterns(patterns) {
  fs.writeFileSync(CONFIG.PATTERNS_FILE, JSON.stringify(patterns, null, 2));
}

// ============================================================================
// CONTACT EXTRACTION
// ============================================================================

/**
 * Extract contact information from page using Puppeteer
 */
async function extractContactInfo(page) {
  return await page.evaluate(() => {
    const result = {
      firstName: null,
      lastName: null,
      email: null,
      rawName: null,
    };

    // Helper: clean text
    const cleanText = (text) => {
      if (!text) return null;
      return text.trim().replace(/\s+/g, ' ');
    };

    // Helper: extract email from href or text
    const extractEmail = (element) => {
      if (!element) return null;

      // Check href for mailto:
      const href = element.getAttribute('href');
      if (href && href.startsWith('mailto:')) {
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (email.includes('@')) return email.toLowerCase();
      }

      // Check text content
      const text = element.textContent || '';
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) return emailMatch[0].toLowerCase();

      return null;
    };

    // Helper: parse name into first/last
    const parseName = (fullName) => {
      if (!fullName) return { firstName: null, lastName: null };

      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 0) return { firstName: null, lastName: null };
      if (parts.length === 1) return { firstName: parts[0], lastName: null };

      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    };

    // Name selectors
    const nameSelectors = [
      'h1',
      '.distributor-name',
      '.profile-name',
      '.vbc-name',
      '[data-name]',
      '.name',
      '#name',
    ];

    // Email selectors
    const emailSelectors = [
      'a[href^="mailto:"]',
      '.email',
      '.distributor-email',
      '[data-email]',
      'a[href*="@"]',
    ];

    // Container selectors
    const containerSelectors = [
      '.profile',
      '.distributor-info',
      '.contact-info',
      '.vbc-profile',
      'main',
      '#content',
    ];

    // Try to find container first to narrow search
    let searchRoot = document;
    for (const sel of containerSelectors) {
      const container = document.querySelector(sel);
      if (container) {
        searchRoot = container;
        break;
      }
    }

    // Extract name
    for (const sel of nameSelectors) {
      const element = searchRoot.querySelector(sel);
      if (element) {
        const text = cleanText(element.textContent);
        if (text && text.length > 1 && text.length < 100) {
          result.rawName = text;
          const { firstName, lastName } = parseName(text);
          result.firstName = firstName;
          result.lastName = lastName;
          break;
        }
      }
    }

    // Extract email
    for (const sel of emailSelectors) {
      const element = searchRoot.querySelector(sel);
      const email = extractEmail(element);
      if (email) {
        result.email = email;
        break;
      }
    }

    // Fallback: scan all links for mailto:
    if (!result.email) {
      const allLinks = document.querySelectorAll('a[href^="mailto:"]');
      for (const link of allLinks) {
        const email = extractEmail(link);
        if (email) {
          result.email = email;
          break;
        }
      }
    }

    // Fallback: regex scan page text for emails
    if (!result.email) {
      const bodyText = document.body.innerText || '';
      const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        result.email = emailMatch[0].toLowerCase();
      }
    }

    return result;
  });
}

/**
 * Get visible text content from page for Claude analysis
 */
async function getPageTextContent(page) {
  return await page.evaluate(() => {
    const body = document.body;
    if (!body) return '';

    // Clone and remove script/style elements
    const clone = body.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());

    // Get text and clean it up
    let text = clone.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();

    // Truncate to avoid token limits
    return text.substring(0, 2000);
  });
}

/**
 * Use Claude AI to extract firstName and lastName from page content
 */
async function extractNameWithClaude(pageText, email) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('  ANTHROPIC_API_KEY not set - skipping AI name extraction');
    return { firstName: null, lastName: null };
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Extract the person's first name and last name from this distributor profile page. The email address is: ${email}

Page content:
${pageText}

Respond with ONLY a JSON object in this exact format (no other text):
{"firstName": "John", "lastName": "Smith"}

If you cannot determine the name, use null for that field. Do not guess or make up names.`
      }]
    });

    // Parse Claude's response
    const responseText = response.content[0].text.trim();
    const nameData = JSON.parse(responseText);

    return {
      firstName: nameData.firstName || null,
      lastName: nameData.lastName || null,
    };

  } catch (error) {
    console.log(`  Claude API error: ${error.message}`);
    return { firstName: null, lastName: null };
  }
}

// ============================================================================
// SCRAPING LOGIC
// ============================================================================

/**
 * SSL certificate errors that should trigger HTTP fallback
 */
const SSL_ERRORS = [
  'ERR_CERT_AUTHORITY_INVALID',
  'ERR_CERT_COMMON_NAME_INVALID',
  'ERR_CERT_DATE_INVALID',
  'ERR_SSL_PROTOCOL_ERROR',
  'ERR_SSL_VERSION_OR_CIPHER_MISMATCH',
  'ERR_CERT_REVOKED',
];

/**
 * Scrape a single URL (with HTTP fallback for SSL errors)
 */
async function scrapeUrl(browser, url) {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(CONFIG.USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });

    let currentUrl = url;
    let usedHttpFallback = false;

    try {
      await page.goto(currentUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.NAVIGATION_TIMEOUT,
      });
    } catch (navError) {
      // Check if this is an SSL error and URL is HTTPS
      const isSSLError = SSL_ERRORS.some(err => navError.message.includes(err));
      const isHttps = currentUrl.startsWith('https://');

      if (isSSLError && isHttps) {
        // Try HTTP fallback
        currentUrl = currentUrl.replace('https://', 'http://');
        console.log(`  SSL error, trying HTTP fallback: ${currentUrl}`);
        usedHttpFallback = true;

        await page.goto(currentUrl, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.NAVIGATION_TIMEOUT,
        });
      } else {
        // Re-throw non-SSL errors or HTTP URLs
        throw navError;
      }
    }

    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));

    const contactInfo = await extractContactInfo(page);

    // Get page text for Claude analysis (only if email found)
    let pageText = null;
    if (contactInfo.email) {
      pageText = await getPageTextContent(page);
    }

    return {
      success: true,
      data: contactInfo,
      pageText: pageText,
      error: null,
      usedHttpFallback: usedHttpFallback,
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };

  } finally {
    await page.close();
  }
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Get unscraped URLs from Firestore for a specific company
 */
async function getUnscrapedUrls(db, company, limit) {
  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('company', '==', company)
    .where('scraped', '==', false)
    .where('scrapeAttempts', '<', CONFIG.MAX_RETRIES)
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    url: doc.data().url,
    scrapeAttempts: doc.data().scrapeAttempts || 0,
  }));
}

/**
 * Get unscraped URLs from Firestore for ALL companies
 */
async function getUnscrapedUrlsAllCompanies(db, limit) {
  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('scraped', '==', false)
    .where('scrapeAttempts', '<', CONFIG.MAX_RETRIES)
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    url: doc.data().url,
    company: doc.data().company,
    scrapeAttempts: doc.data().scrapeAttempts || 0,
  }));
}

/**
 * Update document with scraped data
 * @param {number} currentAttempts - Current scrapeAttempts count BEFORE this attempt
 */
async function updateDocument(db, docId, company, data, success, error, currentAttempts = 0) {
  const docRef = db.collection(CONFIG.COLLECTION).doc(docId);

  if (success && data.email) {
    // Success with email found - update document
    await docRef.update({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      scraped: true,
      scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      scrapeStatus: 'success',
      scrapeError: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Campaign fields
      randomIndex: Math.random(),
      sent: false,
    });
    return 'updated';
  } else if (success && !data.email) {
    // Success but no email found - DELETE document
    await docRef.delete();
    return 'deleted';
  } else {
    // Failed - check if this was the last attempt
    const newAttemptCount = currentAttempts + 1;

    if (newAttemptCount >= CONFIG.MAX_RETRIES) {
      // Max retries reached - DELETE document
      await docRef.delete();
      return 'deleted_max_retries';
    }

    // Still has retries left - update with error info
    await docRef.update({
      scrapeStatus: 'failed',
      scrapeError: error,
      scrapeAttempts: newAttemptCount,
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'failed';
  }
}

/**
 * Delete ALL documents for a company (used when platform has no emails)
 */
async function deleteAllCompanyDocuments(db, company) {
  console.log(`\n  Deleting all documents for ${company}...`);

  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('company', '==', company)
    .get();

  if (snapshot.empty) {
    console.log(`  No documents found for ${company}`);
    return 0;
  }

  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(i, i + batchSize);

    chunk.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`  Deleted ${deleted} documents for ${company}`);
  return deleted;
}

// ============================================================================
// CUMULATIVE COMPANY STATS (persisted across runs)
// ============================================================================

/**
 * Load cumulative company stats from Firestore
 * Returns: { companyName: { scraped: N, emailsFound: N }, ... }
 */
async function loadCumulativeStats(db) {
  try {
    const doc = await db.collection(CONFIG.STATS_COLLECTION).doc(CONFIG.STATS_DOC).get();
    if (doc.exists && doc.data().companyStats) {
      console.log('Loaded cumulative company stats from Firestore');
      return doc.data().companyStats;
    }
  } catch (err) {
    console.warn('Could not load cumulative stats:', err.message);
  }
  return {};
}

/**
 * Save cumulative company stats to Firestore
 */
async function saveCumulativeStats(db, stats) {
  try {
    await db.collection(CONFIG.STATS_COLLECTION).doc(CONFIG.STATS_DOC).set({
      companyStats: stats,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not save cumulative stats:', err.message);
  }
}

/**
 * Reset stats for a specific company (after deletion)
 */
async function resetCompanyStats(db, cumulativeStats, company) {
  delete cumulativeStats[company];
  await saveCumulativeStats(db, cumulativeStats);
  console.log(`  Reset cumulative stats for ${company}`);
}

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

async function sendCompletionEmail(summary, companyName) {
  const smtpUser = process.env.PREINTAKE_SMTP_USER;
  const smtpPass = process.env.PREINTAKE_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.log('SMTP credentials not configured - skipping email notification');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: CONFIG.SMTP_HOST,
    port: CONFIG.SMTP_PORT,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const companyLabel = companyName || 'All Companies';

  const html = `
    <h2>Contact Scraper Completed - ${companyLabel}</h2>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <table border="1" cellpadding="5" style="border-collapse: collapse;">
      <tr><td>URLs processed</td><td>${summary.processed}</td></tr>
      <tr><td>Success (with email)</td><td>${summary.successWithEmail}</td></tr>
      <tr><td>Deleted (no email)</td><td>${summary.deleted}</td></tr>
      <tr><td>Failed</td><td>${summary.failed}</td></tr>
      <tr><td>Duration</td><td>${summary.duration}s</td></tr>
      ${summary.noEmailPlatforms.length > 0 ? `<tr><td>No-email platforms detected</td><td>${summary.noEmailPlatforms.join(', ')}</td></tr>` : ''}
    </table>
    ${summary.stopped ? '<p style="color: red;"><strong>Note:</strong> Scraper stopped early due to consecutive errors (possible blocking).</p>' : ''}
  `;

  await transporter.sendMail({
    from: `"Contact Scraper" <${smtpUser}>`,
    to: CONFIG.NOTIFY_EMAIL,
    subject: `Contact Scraper [${companyLabel}]: ${summary.successWithEmail} contacts found`,
    html: html,
  });

  console.log('Completion email sent');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an email is a corporate/generic address (not an individual contact)
 * @param {string} email - Email address to check
 * @param {string} companyDomain - The company's domain (e.g., "lifewave.com")
 * @returns {{isCorporate: boolean, reason: string|null}} - Result with reason
 */
function isCorporateEmail(email, companyDomain) {
  if (!email) return { isCorporate: false, reason: null };

  const [localPart, emailDomain] = email.toLowerCase().split('@');

  // Check if email domain matches company domain (e.g., anything@lifewave.com)
  if (companyDomain && emailDomain) {
    const normalizedCompanyDomain = companyDomain.toLowerCase().replace(/^www\./, '');
    const normalizedEmailDomain = emailDomain.replace(/^www\./, '');
    if (normalizedEmailDomain === normalizedCompanyDomain ||
        normalizedEmailDomain.endsWith('.' + normalizedCompanyDomain)) {
      return { isCorporate: true, reason: 'corporate domain' };
    }
  }

  // Check for corporate/generic prefixes
  const hasCorporatePrefix = CONFIG.CORPORATE_EMAIL_PREFIXES.some(prefix =>
    localPart === prefix || localPart.startsWith(prefix + '.') || localPart.startsWith(prefix + '_')
  );
  if (hasCorporatePrefix) {
    return { isCorporate: true, reason: 'corporate prefix' };
  }

  return { isCorporate: false, reason: null };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs, jitterMs) {
  const jitter = Math.random() * jitterMs * 2 - jitterMs;
  return sleep(baseMs + jitter);
}

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

function getCompanyDomain(companyName) {
  // Try direct lookup by lowercase name
  const domain = DOMAIN_BY_NAME[companyName.toLowerCase()];
  if (domain) return domain;

  // Try matching against COMPANY_NAMES values
  for (const [dom, name] of Object.entries(COMPANY_NAMES)) {
    if (name.toLowerCase() === companyName.toLowerCase()) {
      return dom;
    }
  }

  return null;
}

function getCompanyDisplayName(domain) {
  return COMPANY_NAMES[domain] || domain.replace('.com', '').charAt(0).toUpperCase() + domain.replace('.com', '').slice(1);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  const args = parseArgs();

  // Validate arguments
  if (!args.company && !args.all) {
    console.error('Error: Must specify --company=NAME or --all');
    console.error('');
    console.error('Usage:');
    console.error('  node contacts-scraper.js --company=Herbalife --max=100');
    console.error('  node contacts-scraper.js --all --max=100');
    console.error('  node contacts-scraper.js --company=doTERRA --dry-run');
    process.exit(1);
  }

  // Configuration
  const maxUrls = parseInt(args.max || process.env.MAX_URLS || CONFIG.MAX_URLS_PER_RUN, 10);
  const dryRun = args['dry-run'] === true || process.env.DRY_RUN === 'true';
  const targetCompany = args.company || null;
  const scrapeAll = args.all === true;

  console.log('='.repeat(60));
  console.log('MULTI-COMPANY CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Target: ${scrapeAll ? 'All companies' : targetCompany}`);
  console.log(`Max URLs: ${maxUrls}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Load patterns to check for no-email platforms
  const patterns = loadPatterns();

  // Resolve company name to domain if specific company
  let companyDomain = null;
  let companyDisplayName = null;

  if (targetCompany) {
    companyDomain = getCompanyDomain(targetCompany);
    if (!companyDomain) {
      console.error(`Error: Unknown company "${targetCompany}"`);
      console.error('Available companies:', Object.values(COMPANY_NAMES).join(', '));
      process.exit(1);
    }
    companyDisplayName = getCompanyDisplayName(companyDomain);

    // Check if this company is already marked as no-email platform
    if (patterns[companyDomain]?.noEmailPlatform) {
      console.log(`\n${companyDisplayName} is marked as a no-email platform.`);
      console.log('   Detected at:', patterns[companyDomain].detectedAt);
      console.log('   Skipping scrape. Remove noEmailPlatform flag in patterns.json to re-enable.');
      process.exit(0);
    }
  }

  // Initialize Firebase
  const db = initializeFirebase();

  // Load cumulative company stats (persisted across runs)
  const cumulativeStats = dryRun ? {} : await loadCumulativeStats(db);

  // Get URLs to scrape
  console.log('\nFetching unscraped URLs...');
  let urlsToScrape;

  if (scrapeAll) {
    urlsToScrape = await getUnscrapedUrlsAllCompanies(db, maxUrls);
  } else {
    urlsToScrape = await getUnscrapedUrls(db, companyDisplayName, maxUrls);
    // Add company field for consistency
    urlsToScrape = urlsToScrape.map(u => ({ ...u, company: companyDisplayName }));
  }

  console.log(`Found ${urlsToScrape.length} URLs to process`);

  if (urlsToScrape.length === 0) {
    console.log('No URLs to scrape. Exiting.');
    process.exit(0);
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

  // Tracking
  const summary = {
    processed: 0,
    successWithEmail: 0,
    deleted: 0,
    deletedMaxRetries: 0,  // Documents deleted after max failed attempts
    failed: 0,
    httpFallbacks: 0,  // URLs that succeeded via HTTP fallback
    stopped: false,
    duration: 0,
    noEmailPlatforms: [],
  };

  // Per-company tracking for early termination
  const companyStats = {};

  let consecutiveErrors = 0;

  // Process each URL
  console.log('\n=== Starting Scrape ===\n');

  for (let i = 0; i < urlsToScrape.length; i++) {
    const { id, url, company, scrapeAttempts } = urlsToScrape[i];

    // Initialize company stats if needed (per-run tracking)
    if (!companyStats[company]) {
      companyStats[company] = { scraped: 0, emailsFound: 0 };
    }

    // Initialize cumulative stats if needed
    if (!cumulativeStats[company]) {
      cumulativeStats[company] = { scraped: 0, emailsFound: 0 };
    }

    // Check if this company has been marked as no-email during this run
    const companyDomainForUrl = getCompanyDomain(company);
    if (companyDomainForUrl && patterns[companyDomainForUrl]?.noEmailPlatform) {
      console.log(`[${i + 1}/${urlsToScrape.length}] Skipping ${url} (${company} marked as no-email platform)`);
      continue;
    }

    console.log(`[${i + 1}/${urlsToScrape.length}] ${url}`);
    console.log(`  Company: ${company}`);
    console.log(`  Attempt: ${scrapeAttempts + 1}/${CONFIG.MAX_RETRIES}`);

    // Scrape
    const result = await scrapeUrl(browser, url);
    summary.processed++;
    companyStats[company].scraped++;
    cumulativeStats[company].scraped++;

    if (result.success) {
      consecutiveErrors = 0;

      if (result.usedHttpFallback) {
        console.log(`  HTTP fallback succeeded`);
        summary.httpFallbacks++;
      }

      // Check if email was found and if it's a valid individual email (not corporate)
      const emailFound = result.data.email;
      const companyDomainForCheck = getCompanyDomain(company);
      const corporateCheck = emailFound ? isCorporateEmail(emailFound, companyDomainForCheck) : { isCorporate: false };

      if (emailFound && !corporateCheck.isCorporate) {
        companyStats[company].emailsFound++;
        cumulativeStats[company].emailsFound++;

        // Valid individual email found - use Claude AI to extract name
        console.log(`  Email found: ${result.data.email}`);

        if (result.pageText) {
          console.log(`  Using Claude AI for name extraction...`);
          const claudeName = await extractNameWithClaude(result.pageText, result.data.email);
          if (claudeName.firstName || claudeName.lastName) {
            result.data.firstName = claudeName.firstName;
            result.data.lastName = claudeName.lastName;
            console.log(`  Claude extracted: ${claudeName.firstName} ${claudeName.lastName}`);
          } else {
            console.log(`  Claude could not extract name, using DOM extraction`);
          }
        }

        console.log(`  Final: ${result.data.firstName || '(no first)'} ${result.data.lastName || '(no last)'} <${result.data.email}>`);
        summary.successWithEmail++;

        if (!dryRun) {
          await updateDocument(db, id, company, result.data, true, null);
        }
      } else if (emailFound && corporateCheck.isCorporate) {
        // Corporate/generic email found - delete document (not an individual contact)
        console.log(`  Corporate email found: ${result.data.email} (${corporateCheck.reason}) - deleting document`);
        summary.deleted++;

        if (!dryRun) {
          // Pass null email to trigger delete
          await updateDocument(db, id, company, { ...result.data, email: null }, true, null);
        }
      } else {
        // No email found - delete document
        console.log(`  No email found - deleting document`);
        summary.deleted++;

        if (!dryRun) {
          await updateDocument(db, id, company, result.data, true, null);
        }
      }

      // Early termination check: 0 emails in cumulative samples (across runs)
      const cumStats = cumulativeStats[company];
      const runStats = companyStats[company];
      if (cumStats.scraped >= CONFIG.NO_EMAIL_SAMPLE_SIZE && cumStats.emailsFound === 0) {
        console.log(`\nEARLY TERMINATION: ${company}`);
        console.log(`   0/${cumStats.scraped} emails found (cumulative) - marking as no-email platform`);

        // Mark in patterns.json
        const domainKey = getCompanyDomain(company);
        if (domainKey && patterns[domainKey]) {
          patterns[domainKey].noEmailPlatform = true;
          patterns[domainKey].detectedAt = new Date().toISOString();

          if (!dryRun) {
            savePatterns(patterns);
            console.log(`   Updated patterns.json`);

            // Delete ALL documents for this company
            const deletedCount = await deleteAllCompanyDocuments(db, company);
            summary.deleted += deletedCount - runStats.scraped; // Adjust for ones already counted this run

            // Reset cumulative stats for this company
            await resetCompanyStats(db, cumulativeStats, company);
          } else {
            console.log(`   DRY RUN - Would update patterns.json and delete all documents`);
          }

          summary.noEmailPlatforms.push(company);
        }
      }

    } else {
      console.log(`  Error: ${result.error}`);
      summary.failed++;
      consecutiveErrors++;

      if (!dryRun) {
        const updateResult = await updateDocument(db, id, company, null, false, result.error, scrapeAttempts);
        if (updateResult === 'deleted_max_retries') {
          // Document was deleted after max retries - count as deleted, not failed
          summary.deleted++;
          summary.deletedMaxRetries++;
          summary.failed--; // Adjust since we already counted as failed above
          console.log(`  Deleted: max retries (${CONFIG.MAX_RETRIES}) reached`);
        }
      }

      // Check for consecutive errors
      if (consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_LIMIT) {
        console.log(`\nStopping: ${consecutiveErrors} consecutive errors (possible blocking)`);
        summary.stopped = true;
        break;
      }
    }

    // Rate limiting
    if (i < urlsToScrape.length - 1) {
      await sleepWithJitter(CONFIG.DELAY_BETWEEN_PAGES, CONFIG.JITTER_MS);
    }
  }

  // Close browser
  await browser.close();

  // Calculate duration
  summary.duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log(`URLs processed: ${summary.processed}`);
  console.log(`Success (with email): ${summary.successWithEmail}`);
  console.log(`Deleted (no email): ${summary.deleted - summary.deletedMaxRetries}`);
  if (summary.deletedMaxRetries > 0) {
    console.log(`Deleted (max retries): ${summary.deletedMaxRetries}`);
  }
  console.log(`Failed (will retry): ${summary.failed}`);
  if (summary.httpFallbacks > 0) {
    console.log(`HTTP fallbacks used: ${summary.httpFallbacks}`);
  }
  console.log(`Duration: ${summary.duration}s`);
  if (summary.noEmailPlatforms.length > 0) {
    console.log(`No-email platforms detected: ${summary.noEmailPlatforms.join(', ')}`);
  }
  if (summary.stopped) {
    console.log('Status: STOPPED EARLY (consecutive errors)');
  }
  console.log('='.repeat(60));

  // Per-company breakdown (this run)
  if (Object.keys(companyStats).length > 1) {
    console.log('\nPer-Company Breakdown (this run):');
    for (const [company, stats] of Object.entries(companyStats)) {
      console.log(`  ${company}: ${stats.emailsFound}/${stats.scraped} emails found`);
    }
  }

  // Cumulative stats (all runs)
  if (!dryRun && Object.keys(cumulativeStats).length > 0) {
    console.log('\nCumulative Stats (all runs):');
    for (const [company, stats] of Object.entries(cumulativeStats)) {
      const status = stats.scraped >= CONFIG.NO_EMAIL_SAMPLE_SIZE && stats.emailsFound === 0
        ? ' ⚠️  WILL DELETE NEXT RUN'
        : stats.emailsFound === 0
          ? ` (${CONFIG.NO_EMAIL_SAMPLE_SIZE - stats.scraped} more needed to trigger deletion)`
          : '';
      console.log(`  ${company}: ${stats.emailsFound}/${stats.scraped} emails${status}`);
    }

    // Save cumulative stats to Firestore
    await saveCumulativeStats(db, cumulativeStats);
    console.log('\nCumulative stats saved to Firestore');
  }

  // Save summary to file
  const summaryPath = path.join(__dirname, 'contacts-scrape-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ ...summary, companyStats, cumulativeStats }, null, 2));
  console.log(`\nSummary saved to: ${summaryPath}`);

  // Send notification email
  if (!dryRun) {
    try {
      await sendCompletionEmail(summary, targetCompany);
    } catch (error) {
      console.log(`Warning: Could not send email notification: ${error.message}`);
    }
  }

  // Exit
  process.exit(summary.stopped ? 1 : 0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
