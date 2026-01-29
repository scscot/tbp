#!/usr/bin/env node
/**
 * Zilis Contact Scraper
 *
 * Scrapes contact information (firstName, lastName, email) from Zilis
 * distributor pages (app.elify.com/vbc/...) and updates Firestore.
 *
 * Usage:
 *   node scripts/zilis-scraper.js
 *   node scripts/zilis-scraper.js --max=50
 *
 * Environment variables:
 *   MAX_URLS - Maximum URLs to process per run (default: 100)
 *   DRY_RUN - If "true", don't write to Firestore (preview only)
 *   TBP_SMTP_USER - SMTP username for notifications
 *   TBP_SMTP_PASS - SMTP password for notifications
 *
 * Safety features:
 *   - Rate limiting with jitter (2s between requests)
 *   - Respects robots.txt (manual check recommended)
 *   - Stops on consecutive errors (blocking detection)
 *   - No HTML content retention (parse in memory only)
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
  COMPANY: 'zilis',

  // Rate limiting
  DELAY_BETWEEN_PAGES: 2000,
  JITTER_MS: 500,
  PAGE_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 30000,

  // Safety limits
  MAX_URLS_PER_RUN: 100,
  MAX_RETRIES: 3,
  CONSECUTIVE_ERROR_LIMIT: 10,

  // Email notifications
  SMTP_HOST: 'smtp.dreamhost.com',
  SMTP_PORT: 587,
  NOTIFY_EMAIL: 'scscot@gmail.com',

  // Browser settings
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

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
// DOM SELECTORS FOR CONTACT EXTRACTION
// ============================================================================

/**
 * These selectors attempt to find contact information on Elify VBC pages.
 * Adjust based on actual page structure after inspection.
 */
const SELECTORS = {
  // Name selectors (try multiple patterns)
  name: [
    'h1',
    '.distributor-name',
    '.profile-name',
    '.vbc-name',
    '[data-name]',
    '.name',
    '#name',
  ],

  // Email selectors
  email: [
    'a[href^="mailto:"]',
    '.email',
    '.distributor-email',
    '[data-email]',
    'a[href*="@"]',
  ],

  // Contact container (to narrow search)
  container: [
    '.profile',
    '.distributor-info',
    '.contact-info',
    '.vbc-profile',
    'main',
    '#content',
  ],
};

// ============================================================================
// CONTACT EXTRACTION
// ============================================================================

/**
 * Extract contact information from page using Puppeteer
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<{firstName: string|null, lastName: string|null, email: string|null}>}
 */
async function extractContactInfo(page) {
  return await page.evaluate((selectors) => {
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

    // Try to find container first to narrow search
    let searchRoot = document;
    for (const sel of selectors.container) {
      const container = document.querySelector(sel);
      if (container) {
        searchRoot = container;
        break;
      }
    }

    // Extract name
    for (const sel of selectors.name) {
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
    for (const sel of selectors.email) {
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
  }, SELECTORS);
}

/**
 * Get visible text content from page for Claude analysis
 * @param {Page} page - Puppeteer page object
 * @returns {Promise<string>} - Visible text content (truncated)
 */
async function getPageTextContent(page) {
  return await page.evaluate(() => {
    // Get visible text, excluding scripts and styles
    const body = document.body;
    if (!body) return '';

    // Clone and remove script/style elements
    const clone = body.cloneNode(true);
    const scripts = clone.querySelectorAll('script, style, noscript');
    scripts.forEach(el => el.remove());

    // Get text and clean it up
    let text = clone.innerText || '';
    text = text.replace(/\s+/g, ' ').trim();

    // Truncate to avoid token limits (first 2000 chars should contain name)
    return text.substring(0, 2000);
  });
}

/**
 * Use Claude AI to extract firstName and lastName from page content
 * @param {string} pageText - Visible text from page
 * @param {string} email - Email address found on page
 * @returns {Promise<{firstName: string|null, lastName: string|null}>}
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
 * Scrape a single URL
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} url - URL to scrape
 * @returns {Promise<{success: boolean, data: object|null, error: string|null}>}
 */
async function scrapeUrl(browser, url) {
  const page = await browser.newPage();

  try {
    // Set user agent
    await page.setUserAgent(CONFIG.USER_AGENT);

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.NAVIGATION_TIMEOUT,
    });

    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract contact info
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
 * Get unscraped URLs from Firestore
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {number} limit - Maximum URLs to retrieve
 * @returns {Promise<Array<{id: string, url: string}>>}
 */
async function getUnscrapedUrls(db, limit) {
  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('company', '==', CONFIG.COMPANY)
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
 * Update document with scraped data
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Document ID
 * @param {object} data - Data from scraping
 * @param {boolean} success - Whether scrape succeeded
 * @param {string|null} error - Error message if failed
 */
async function updateDocument(db, docId, data, success, error) {
  const docRef = db.collection(CONFIG.COLLECTION).doc(docId);

  if (success && data.email) {
    // Success with email found - update document
    await docRef.update({
      company: CONFIG.COMPANY,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      scraped: true,
      scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      scrapeStatus: 'success',
      scrapeError: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'updated';
  } else if (success && !data.email) {
    // Success but no email found - DELETE document
    await docRef.delete();
    return 'deleted';
  } else {
    // Failed - update with error info
    await docRef.update({
      company: CONFIG.COMPANY,
      scrapeStatus: 'failed',
      scrapeError: error,
      scrapeAttempts: admin.firestore.FieldValue.increment(1),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return 'failed';
  }
}

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Send completion email
 * @param {object} summary - Scrape summary
 */
async function sendCompletionEmail(summary) {
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

  const html = `
    <h2>Zilis Scraper Completed</h2>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
    <table border="1" cellpadding="5" style="border-collapse: collapse;">
      <tr><td>URLs processed</td><td>${summary.processed}</td></tr>
      <tr><td>Success (with email)</td><td>${summary.successWithEmail}</td></tr>
      <tr><td>Deleted (no email)</td><td>${summary.deleted}</td></tr>
      <tr><td>Failed</td><td>${summary.failed}</td></tr>
      <tr><td>Duration</td><td>${summary.duration}s</td></tr>
    </table>
    ${summary.stopped ? '<p style="color: red;"><strong>Note:</strong> Scraper stopped early due to consecutive errors (possible blocking).</p>' : ''}
  `;

  await transporter.sendMail({
    from: `"Zilis Scraper" <${smtpUser}>`,
    to: CONFIG.NOTIFY_EMAIL,
    subject: `Zilis Scraper: ${summary.successWithEmail} contacts found`,
    html: html,
  });

  console.log('Completion email sent');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  const args = parseArgs();

  // Configuration
  const maxUrls = parseInt(args.max || process.env.MAX_URLS || CONFIG.MAX_URLS_PER_RUN, 10);
  const dryRun = args['dry-run'] === true || process.env.DRY_RUN === 'true';

  console.log('='.repeat(60));
  console.log('ZILIS CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max URLs: ${maxUrls}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Initialize Firebase
  const db = initializeFirebase();

  // Get URLs to scrape
  console.log('\nFetching unscraped URLs...');
  const urlsToScrape = await getUnscrapedUrls(db, maxUrls);
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
    failed: 0,
    stopped: false,
    duration: 0,
  };

  let consecutiveErrors = 0;

  // Process each URL
  console.log('\n=== Starting Scrape ===\n');

  for (let i = 0; i < urlsToScrape.length; i++) {
    const { id, url, scrapeAttempts } = urlsToScrape[i];

    console.log(`[${i + 1}/${urlsToScrape.length}] ${url}`);
    console.log(`  Attempt: ${scrapeAttempts + 1}/${CONFIG.MAX_RETRIES}`);

    // Scrape
    const result = await scrapeUrl(browser, url);
    summary.processed++;

    if (result.success) {
      consecutiveErrors = 0;

      if (result.data.email) {
        // Email found - use Claude AI to extract name
        console.log(`  ✓ Email found: ${result.data.email}`);

        // Use Claude to get better name extraction
        if (result.pageText) {
          console.log(`  🤖 Using Claude AI for name extraction...`);
          const claudeName = await extractNameWithClaude(result.pageText, result.data.email);
          if (claudeName.firstName || claudeName.lastName) {
            result.data.firstName = claudeName.firstName;
            result.data.lastName = claudeName.lastName;
            console.log(`  ✓ Claude extracted: ${claudeName.firstName} ${claudeName.lastName}`);
          } else {
            console.log(`  ○ Claude could not extract name, using DOM extraction`);
          }
        }

        console.log(`  ✓ Final: ${result.data.firstName || '(no first)'} ${result.data.lastName || '(no last)'} <${result.data.email}>`);
        summary.successWithEmail++;

        // Update Firestore
        if (!dryRun) {
          await updateDocument(db, id, result.data, true, null);
        }
      } else {
        // No email found - delete document
        console.log(`  ✗ No email found - deleting document`);
        summary.deleted++;

        if (!dryRun) {
          await updateDocument(db, id, result.data, true, null);
        }
      }

    } else {
      console.log(`  ✗ Error: ${result.error}`);
      summary.failed++;
      consecutiveErrors++;

      // Update Firestore with failure
      if (!dryRun) {
        await updateDocument(db, id, null, false, result.error);
      }

      // Check for consecutive errors (possible blocking)
      if (consecutiveErrors >= CONFIG.CONSECUTIVE_ERROR_LIMIT) {
        console.log(`\n⚠️ Stopping: ${consecutiveErrors} consecutive errors (possible blocking)`);
        summary.stopped = true;
        break;
      }
    }

    // Rate limiting (except for last URL)
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
  console.log(`Deleted (no email): ${summary.deleted}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}s`);
  if (summary.stopped) {
    console.log('Status: STOPPED EARLY (consecutive errors)');
  }
  console.log('='.repeat(60));

  // Save summary to file
  const summaryPath = path.join(__dirname, 'zilis-scrape-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary saved to: ${summaryPath}`);

  // Send notification email
  if (!dryRun) {
    try {
      await sendCompletionEmail(summary);
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
