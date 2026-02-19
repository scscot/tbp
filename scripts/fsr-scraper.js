/**
 * FindSalesRep.com Scraper
 *
 * Scrapes sales rep contact information from findsalesrep.com
 * and saves to Firestore fsr_contacts collection.
 *
 * Usage:
 *   node scripts/fsr-scraper.js --discover --company=avon --max=100
 *   node scripts/fsr-scraper.js --scrape --max=50
 *   node scripts/fsr-scraper.js --stats
 *   HEADLESS=false node scripts/fsr-scraper.js --scrape --max=5
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const admin = require('firebase-admin');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONTACTS_COLLECTION = 'fsr_contacts';
const USER_IDS_COLLECTION = 'fsr_user_ids';
const STATE_COLLECTION = 'scraper_state';
const STATE_DOC = 'fsr';

const BASE_URL = 'https://www.findsalesrep.com';

// Priority companies - based on BusinessForHome.org Momentum Rankings (Feb 2026)
// Source: https://www.businessforhome.org/momentum-ranks/
const COMPANIES = [
  // Top 25 Momentum Leaders
  'zinzino',           // #1 - 15,552 pts
  'usana',             // #3 - 14,298 pts
  'lifewave',          // #5 - 13,230 pts
  'neora',             // #6 - 13,023 pts
  'doterra',           // #7 - 12,948 pts
  'lifevantage',       // #8 - 12,867 pts
  'primerica',         // #9 - 12,844 pts
  'pm-international',  // #10 - 12,840 pts
  'farmasi',           // #13 - 12,731 pts
  'nu-skin',           // #14 - 12,726 pts
  'asea',              // #17 - 12,681 pts
  'total-life-changes',// #19 - 12,629 pts
  'isagenix',          // #21 - 12,540 pts
  'healy-world',       // #23 - 12,504 pts
  'young-living',      // #24 - 12,470 pts
  'mydailychoice',     // #25 - 12,451 pts
  // FindSalesRep Featured (verified listings)
  'jafra-cosmetics',
  'avon',
  'tupperware',
  'shaklee',
  'amway',
  'pampered-chef',
  'mary-kay',
  'herbalife',
  'scentsy',
  'rodan-fields',
  'arbonne',
  'monat',
  'plexus',
  'color-street'
];

// =============================================================================
// GLOBALS
// =============================================================================

let db;
let browser;
let page;

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================

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

// =============================================================================
// BROWSER SETUP
// =============================================================================

async function launchBrowser() {
  // Add stealth plugin
  puppeteer.use(StealthPlugin());

  // Add reCAPTCHA plugin if API key is available
  const twoCaptchaKey = process.env.TWOCAPTCHA_API_KEY;
  if (twoCaptchaKey) {
    puppeteer.use(
      RecaptchaPlugin({
        provider: {
          id: '2captcha',
          token: twoCaptchaKey
        },
        visualFeedback: true
      })
    );
    console.log('reCAPTCHA solving enabled (2captcha)');
  } else {
    console.log('Warning: TWOCAPTCHA_API_KEY not set - reCAPTCHA solving disabled');
  }

  const headless = process.env.HEADLESS !== 'false';

  browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log(`Browser launched (headless: ${headless})`);
  return { browser, page };
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    console.log('Browser closed');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(baseMs, jitterMs = 2000) {
  return baseMs + Math.random() * jitterMs;
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };

  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');

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

function parseLocation(locationRaw) {
  if (!locationRaw) {
    return { city: null, state: null, zipCode: null, country: null };
  }

  // Format: "Fuquay Varina, NC, 27526, US"
  const parts = locationRaw.split(',').map(p => p.trim());

  return {
    city: parts[0] || null,
    state: parts[1] || null,
    zipCode: parts[2] || null,
    country: parts[3] || null
  };
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

async function getScraperState() {
  const doc = await db.collection(STATE_COLLECTION).doc(STATE_DOC).get();
  if (doc.exists) {
    return doc.data();
  }
  return {
    lastRunAt: null,
    lastUserId: 0,
    totalScraped: 0,
    totalWithEmail: 0,
    currentCompanyIndex: 0,
    companiesScraped: []
  };
}

async function updateScraperState(updates) {
  await db.collection(STATE_COLLECTION).doc(STATE_DOC).set({
    ...updates,
    lastRunAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// =============================================================================
// DISCOVER USER IDS FROM COMPANY PAGES
// =============================================================================

async function discoverUserIds(companySlug, maxIds, dryRun = false) {
  console.log(`\nDiscovering user IDs from company: ${companySlug}`);

  const companyUrl = `${BASE_URL}/lc/${companySlug}`;
  console.log(`  URL: ${companyUrl}`);

  try {
    await page.goto(companyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Extract all user profile links
    const userLinks = await page.evaluate(() => {
      const links = [];
      const anchors = document.querySelectorAll('a[href*="/users/"]');
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        const match = href.match(/\/users\/(\d+)/);
        if (match) {
          links.push({
            userId: match[1],
            href: href
          });
        }
      });
      return links;
    });

    // Deduplicate
    const uniqueIds = [...new Set(userLinks.map(l => l.userId))];
    console.log(`  Found ${uniqueIds.length} unique user IDs`);

    if (uniqueIds.length === 0) {
      console.log('  No user IDs found on this page');
      return { discovered: 0, saved: 0 };
    }

    // Limit to maxIds
    const idsToSave = uniqueIds.slice(0, maxIds);
    let saved = 0;
    let skipped = 0;

    for (const userId of idsToSave) {
      // Check if already exists
      const existing = await db.collection(USER_IDS_COLLECTION).doc(userId).get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      // Check if already scraped in contacts
      const contactExists = await db.collection(CONTACTS_COLLECTION)
        .where('fsrUserId', '==', userId)
        .limit(1)
        .get();

      if (!contactExists.empty) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.collection(USER_IDS_COLLECTION).doc(userId).set({
          userId: userId,
          company: companySlug,
          discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          scraped: false
        });
      }
      saved++;
      console.log(`    + Saved user ID: ${userId}`);
    }

    console.log(`  Discovered: ${idsToSave.length}, Saved: ${saved}, Skipped (duplicates): ${skipped}`);
    return { discovered: idsToSave.length, saved, skipped };

  } catch (error) {
    console.error(`  Error discovering from ${companySlug}:`, error.message);
    return { discovered: 0, saved: 0, error: error.message };
  }
}

// =============================================================================
// SCRAPE CONTACT INFO
// =============================================================================

async function scrapeContactInfo(userId) {
  const contactUrl = `${BASE_URL}/user/${userId}/contact_info`;
  console.log(`  Scraping: ${contactUrl}`);

  try {
    await page.goto(contactUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Dismiss any modal popups (e.g., "What company are you interested in?" modal)
    const modalDismissed = await page.evaluate(() => {
      // Try clicking the X close button
      const closeBtn = document.querySelector('.modal .close, .modal-close, button.close, [aria-label="Close"]');
      if (closeBtn) {
        closeBtn.click();
        return 'close button';
      }
      // Try clicking OK button in modal
      const okBtn = document.querySelector('.modal button, .modal .btn');
      if (okBtn && okBtn.innerText.toLowerCase().includes('ok')) {
        okBtn.click();
        return 'ok button';
      }
      // Try clicking outside modal to dismiss
      const modalBackdrop = document.querySelector('.modal-backdrop, .modal-overlay');
      if (modalBackdrop) {
        modalBackdrop.click();
        return 'backdrop';
      }
      return false;
    });

    if (modalDismissed) {
      console.log(`    Dismissed modal (${modalDismissed})`);
      await sleep(1000);
    }

    // Check for reCAPTCHA and solve if present
    const hasRecaptcha = await page.evaluate(() => {
      return document.querySelector('.g-recaptcha') !== null ||
             document.querySelector('iframe[src*="recaptcha"]') !== null;
    });

    if (hasRecaptcha) {
      console.log('    reCAPTCHA detected, solving...');

      if (!process.env.TWOCAPTCHA_API_KEY) {
        console.log('    Warning: No 2captcha API key - cannot solve CAPTCHA');
        return { success: false, error: 'CAPTCHA required but no solver configured' };
      }

      try {
        const result = await page.solveRecaptchas();

        // Check for errors in solutions
        const solutionErrors = result.solutions?.filter(s => s.error) || [];
        if (solutionErrors.length > 0) {
          const errorMsg = solutionErrors[0].error;
          console.log(`    CAPTCHA error: ${errorMsg}`);
          return { success: false, error: `CAPTCHA solve failed: ${errorMsg}` };
        }

        const solved = result.solved?.length > 0;
        console.log(`    CAPTCHA solved: ${solved ? 'yes' : 'no'}`);
        await sleep(2000);

        // Click the "Show Contact Information" button after solving CAPTCHA
        const showButtonClicked = await page.evaluate(() => {
          // Look for buttons containing "Show Contact" text
          const buttons = document.querySelectorAll('button, input[type="submit"], a.btn');
          for (const btn of buttons) {
            if (btn.innerText && btn.innerText.toLowerCase().includes('show contact')) {
              btn.click();
              return true;
            }
          }
          // Also try by form submission
          const form = document.querySelector('form');
          if (form) {
            const submitBtn = form.querySelector('button, input[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
              return true;
            }
          }
          return false;
        });

        if (showButtonClicked) {
          console.log('    Clicked "Show Contact Information" button');
          await sleep(3000);
        }
      } catch (captchaError) {
        console.log(`    CAPTCHA exception: ${captchaError.message}`);
        return { success: false, error: `CAPTCHA exception: ${captchaError.message}` };
      }
    }

    // Extract contact information
    const contactData = await page.evaluate(() => {
      const data = {
        name: null,
        company: null,
        email: null,
        phone: null,
        location: null
      };

      // Get all text content and look for patterns
      const bodyText = document.body.innerText;

      // Try to extract Name (usually follows "Name:" label)
      const nameMatch = bodyText.match(/Name:\s*([^\n]+)/i);
      if (nameMatch) {
        data.name = nameMatch[1].trim();
      }

      // Try to extract Company
      const companyMatch = bodyText.match(/Company:\s*([^\n]+)/i);
      if (companyMatch) {
        data.company = companyMatch[1].trim();
      }

      // Try to extract Email (look for mailto links first)
      const emailLink = document.querySelector('a[href^="mailto:"]');
      if (emailLink) {
        const href = emailLink.getAttribute('href');
        data.email = href.replace('mailto:', '').split('?')[0].trim();
      } else {
        // Fallback: look for email pattern in text
        const emailMatch = bodyText.match(/Email:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch) {
          data.email = emailMatch[1].trim();
        }
      }

      // Try to extract Phone
      const phoneMatch = bodyText.match(/Phone:\s*([\d\-\(\)\s\.]+)/i);
      if (phoneMatch) {
        data.phone = phoneMatch[1].trim();
      }

      // Try to extract Location
      const locationMatch = bodyText.match(/Location:\s*([^\n]+)/i);
      if (locationMatch) {
        data.location = locationMatch[1].trim();
      }

      return data;
    });

    return {
      success: true,
      data: contactData
    };

  } catch (error) {
    console.error(`    Error scraping ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function scrapeContacts(maxContacts, dryRun = false) {
  console.log(`\nScraping contacts (max: ${maxContacts}, dry-run: ${dryRun})`);

  // Get unscraped user IDs
  const unscrapedSnapshot = await db.collection(USER_IDS_COLLECTION)
    .where('scraped', '==', false)
    .limit(maxContacts)
    .get();

  if (unscrapedSnapshot.empty) {
    console.log('No unscraped user IDs found. Run --discover first.');
    return { scraped: 0, withEmail: 0, failed: 0 };
  }

  console.log(`Found ${unscrapedSnapshot.size} user IDs to scrape`);

  let scraped = 0;
  let withEmail = 0;
  let failed = 0;

  for (const doc of unscrapedSnapshot.docs) {
    const { userId, company } = doc.data();

    console.log(`\n[${scraped + 1}/${unscrapedSnapshot.size}] User ID: ${userId}`);

    const result = await scrapeContactInfo(userId);

    if (result.success && result.data) {
      const { name, email, phone, location } = result.data;
      const companyName = result.data.company || company;

      const { firstName, lastName } = parseName(name);
      const locationParts = parseLocation(location);

      const contactDoc = {
        fsrUserId: userId,
        firstName: firstName,
        lastName: lastName,
        fullName: name || '',
        email: email || null,
        phone: phone || null,
        company: companyName || '',
        city: locationParts.city,
        state: locationParts.state,
        zipCode: locationParts.zipCode,
        country: locationParts.country,
        locationRaw: location || '',
        source: 'findsalesrep',
        sourceUrl: `${BASE_URL}/user/${userId}/contact_info`,
        scraped: true,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
        sentAt: null,
        clicked: false,
        clickedAt: null,
        randomIndex: Math.random(),
        status: email ? 'pending' : 'no_email',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (!dryRun) {
        // Save to contacts collection
        await db.collection(CONTACTS_COLLECTION).doc(`fsr_${userId}`).set(contactDoc);

        // Mark user ID as scraped
        await doc.ref.update({ scraped: true, scrapedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      scraped++;
      if (email) {
        withEmail++;
        console.log(`    Saved: ${name} <${email}>`);
      } else {
        console.log(`    Saved: ${name} (no email)`);
      }

    } else {
      failed++;
      console.log(`    Failed: ${result.error}`);

      if (!dryRun) {
        await doc.ref.update({
          scraped: true,
          scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: result.error
        });
      }
    }

    // Rate limiting
    await sleep(randomDelay(5000, 3000));
  }

  // Update state
  if (!dryRun) {
    const state = await getScraperState();
    await updateScraperState({
      totalScraped: (state.totalScraped || 0) + scraped,
      totalWithEmail: (state.totalWithEmail || 0) + withEmail
    });
  }

  console.log(`\nScraping complete:`);
  console.log(`  Scraped: ${scraped}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Failed: ${failed}`);

  return { scraped, withEmail, failed };
}

// =============================================================================
// STATISTICS
// =============================================================================

async function showStats() {
  console.log('\n=== FindSalesRep Scraper Stats ===\n');

  // Get scraper state
  const state = await getScraperState();
  console.log('Scraper State:');
  console.log(`  Total scraped: ${state.totalScraped || 0}`);
  console.log(`  Total with email: ${state.totalWithEmail || 0}`);
  console.log(`  Last run: ${state.lastRunAt?.toDate?.() || 'never'}`);

  // Count user IDs
  const userIdsSnapshot = await db.collection(USER_IDS_COLLECTION).get();
  const unscrapedSnapshot = await db.collection(USER_IDS_COLLECTION)
    .where('scraped', '==', false)
    .get();

  console.log('\nUser IDs Collection:');
  console.log(`  Total discovered: ${userIdsSnapshot.size}`);
  console.log(`  Pending scrape: ${unscrapedSnapshot.size}`);

  // Count contacts
  const contactsSnapshot = await db.collection(CONTACTS_COLLECTION).get();
  const withEmailSnapshot = await db.collection(CONTACTS_COLLECTION)
    .where('email', '!=', null)
    .get();
  const pendingSnapshot = await db.collection(CONTACTS_COLLECTION)
    .where('status', '==', 'pending')
    .where('sent', '==', false)
    .get();

  console.log('\nContacts Collection:');
  console.log(`  Total contacts: ${contactsSnapshot.size}`);
  console.log(`  With email: ${withEmailSnapshot.size}`);
  console.log(`  Pending send: ${pendingSnapshot.size}`);

  // Company breakdown
  const byCompany = {};
  contactsSnapshot.forEach(doc => {
    const company = doc.data().company || 'Unknown';
    byCompany[company] = (byCompany[company] || 0) + 1;
  });

  const sortedCompanies = Object.entries(byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sortedCompanies.length > 0) {
    console.log('\nTop Companies:');
    sortedCompanies.forEach(([company, count]) => {
      console.log(`  ${company}: ${count}`);
    });
  }
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();

  initFirebase();

  // Stats only - no browser needed
  if (args.stats) {
    await showStats();
    return;
  }

  // Launch browser for other operations
  await launchBrowser();

  try {
    if (args.discover) {
      // Discover user IDs from company pages
      const company = args.company || 'avon';
      const max = parseInt(args.max || '100');
      const dryRun = args['dry-run'] === true;

      await discoverUserIds(company, max, dryRun);

    } else if (args['discover-next']) {
      // Discover from next company in rotation (uses Firestore state)
      const max = parseInt(args.max || '30');
      const dryRun = args['dry-run'] === true;

      const state = await getScraperState();
      const companyIndex = (state.currentCompanyIndex || 0) % COMPANIES.length;
      const company = COMPANIES[companyIndex];

      console.log(`Company rotation: ${companyIndex + 1}/${COMPANIES.length} (${company})`);

      await discoverUserIds(company, max, dryRun);

      // Update state to next company
      if (!dryRun) {
        await updateScraperState({
          currentCompanyIndex: (companyIndex + 1) % COMPANIES.length
        });
      }

    } else if (args['discover-all']) {
      // Discover from all companies
      const max = parseInt(args.max || '50');
      const dryRun = args['dry-run'] === true;

      for (const company of COMPANIES) {
        await discoverUserIds(company, max, dryRun);
        await sleep(5000);
      }

    } else if (args.scrape) {
      // Scrape contact info
      const max = parseInt(args.max || '50');
      const dryRun = args['dry-run'] === true;

      await scrapeContacts(max, dryRun);

    } else {
      console.log(`
FindSalesRep.com Scraper

Usage:
  node scripts/fsr-scraper.js --discover --company=avon --max=100
  node scripts/fsr-scraper.js --discover-next --max=30
  node scripts/fsr-scraper.js --discover-all --max=50
  node scripts/fsr-scraper.js --scrape --max=50
  node scripts/fsr-scraper.js --stats

Options:
  --discover         Discover user IDs from a company page
  --discover-next    Discover from next company in rotation (20 companies)
  --discover-all     Discover from all known companies
  --scrape           Scrape contact info for discovered user IDs
  --stats            Show statistics
  --company=NAME     Company slug (e.g., avon, tupperware)
  --max=N            Maximum items to process
  --dry-run          Preview only, no Firestore writes

Environment:
  HEADLESS=false     Show browser window
  TWOCAPTCHA_API_KEY reCAPTCHA solving API key
`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main().catch(console.error);
