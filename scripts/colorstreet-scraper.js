#!/usr/bin/env node
/**
 * Color Street Stylist Scraper
 *
 * Scrapes stylist contact information from colorstreet.com using the
 * "Find a Stylist" search feature.
 *
 * Workflow:
 * 1. Search by name (surname or first name)
 * 2. Extract all matching stylists from search modal
 * 3. Visit each stylist's PWS page
 * 4. Click stylist button to reveal contact modal
 * 5. Extract: name, email, phone, location
 * 6. Save to Firestore colorstreet_contacts collection
 *
 * Usage:
 *   node scripts/colorstreet-scraper.js --scrape                    # Scrape all names
 *   node scripts/colorstreet-scraper.js --scrape --max=10           # Limit to 10 names
 *   node scripts/colorstreet-scraper.js --test --name=Amy           # Test single name
 *   node scripts/colorstreet-scraper.js --stats                     # Show stats
 *   node scripts/colorstreet-scraper.js --dry-run --scrape          # Preview mode
 */

const admin = require('firebase-admin');
const path = require('path');
const { chromium } = require('playwright');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  CONTACTS_COLLECTION: 'colorstreet_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'colorstreet_scraper',

  // Website
  BASE_URL: 'https://www.colorstreet.com',
  FIND_STYLIST_URL: 'https://www.colorstreet.com',

  // Timing
  PAGE_TIMEOUT: 30000,
  DELAY_BETWEEN_SEARCHES: 3000,
  DELAY_BETWEEN_STYLISTS: 2000,
  JITTER_MS: 1000,

  // Browser settings
  BROWSER_OPTIONS: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },

  // Search names - Top 100 US surnames
  SURNAMES: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones',
    'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
    'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris',
    'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright',
    'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall',
    'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
    'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook',
    'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
    'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard',
    'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James',
    'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel',
    'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
  ],

  FIRST_NAMES: [
    'Jennifer', 'Jessica', 'Ashley', 'Sarah', 'Emily',
    'Elizabeth', 'Amanda', 'Stephanie', 'Melissa', 'Nicole',
    'Samantha', 'Michelle', 'Kimberly', 'Amy', 'Heather',
    'Rachel', 'Emma', 'Rebecca', 'Megan', 'Olivia',
    'Hannah', 'Lauren', 'Angela', 'Madison', 'Amber',
    'Katherine', 'Christina', 'Mary', 'Abigail', 'Danielle',
    'Sophia', 'Isabella', 'Alexis', 'Ava', 'Laura',
    'Victoria', 'Brianna', 'Alyssa', 'Erin', 'Tiffany',
    'Anna', 'Courtney', 'Kayla', 'Alexandra', 'Mia',
    'Grace', 'Natalie', 'Kelly', 'Sara', 'Andrea',
    'Allison', 'Crystal', 'Julia', 'Kaitlyn', 'Vanessa',
    'Chloe', 'Maria', 'Gabriella', 'Brooke', 'Brittany',
    'Faith', 'Hailey', 'Katelyn', 'Lillian', 'Lily',
    'Kelsey', 'Mackenzie', 'Jasmine', 'Leah', 'Savannah',
    'Kylie', 'Paige', 'Gabrielle', 'Chelsea', 'Lindsey',
    'Stacy', 'Monica', 'Evelyn', 'Jenna', 'Alicia',
    'Caroline', 'Catherine', 'Sofia', 'Patricia', 'Kristin',
    'Veronica', 'Erica', 'Jacqueline', 'Valerie',
  ],

  // Personal email domains (whitelist)
  PERSONAL_EMAIL_DOMAINS: [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'msn.com', 'live.com',
    'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
    'mail.com', 'gmx.com', 'gmx.net', 'ymail.com', 'rocketmail.com', 'zoho.com',
    'rogers.com', 'shaw.ca', 'telus.net', 'bell.net', 'sympatico.ca', 'cogeco.ca',
    'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net', 'charter.net',
    'frontier.com', 'earthlink.net', 'juno.com', 'netzero.net', 'optonline.net',
    'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net',
    'web.de', 'freenet.de', 't-online.de', 'gmx.de',
    'orange.fr', 'free.fr', 'sfr.fr', 'wanadoo.fr',
    'libero.it', 'virgilio.it', 'alice.it', 'fastwebnet.it',
    'terra.com.br', 'uol.com.br', 'bol.com.br', 'globo.com',
  ],
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

function isPersonalEmail(email) {
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1];
  return CONFIG.PERSONAL_EMAIL_DOMAINS.includes(domain);
}

function parseName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function generateContactId(username) {
  // Use username as unique ID
  return `cs_${username.toLowerCase()}`;
}

async function contactExists(username) {
  const docId = generateContactId(username);
  const doc = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
  return doc.exists;
}

// ============================================================================
// SCRAPER FUNCTIONS
// ============================================================================

/**
 * Accept cookie consent if present
 */
async function handleCookieConsent(page) {
  try {
    // Look for common cookie consent buttons
    const consentSelectors = [
      'button:has-text("Accept")',
      'button:has-text("Accept All")',
      'button:has-text("Accept Cookies")',
      'button:has-text("I Accept")',
      'button:has-text("Got it")',
      'button:has-text("OK")',
      '[data-action="accept-cookies"]',
      '.cookie-accept',
      '#accept-cookies',
      '.consent-accept',
    ];

    for (const selector of consentSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        console.log('  Accepted cookie consent');
        await sleep(1000);
        return true;
      }
    }
  } catch (e) {
    // No cookie modal or already accepted
  }
  return false;
}

/**
 * Search for stylists by name and collect usernames
 * Two-pass approach:
 * 1. Search and collect all usernames (click each, SELECT STYLIST, FINISH, get username)
 * 2. Visit each PWS page directly to extract contact info
 */
async function searchStylists(page, searchName) {
  const stylists = [];
  const collectedUsernames = [];

  try {
    // PASS 1: Collect usernames from search results
    console.log(`  Pass 1: Collecting usernames for "${searchName}"...`);

    // Navigate to colorstreet.com
    await page.goto(CONFIG.BASE_URL, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
    await sleep(2000);
    await handleCookieConsent(page);

    // Click "Find a Stylist" button
    const findStylistBtn = page.locator('text=Find a Stylist').first();
    if (await findStylistBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await findStylistBtn.click();
      await sleep(3000);
    }

    // Wait for iframe to load
    const iframeLocator = page.locator('iframe#fyc-iframe, iframe[src*="widgets.colorstreet.com"]');
    await iframeLocator.waitFor({ state: 'attached', timeout: 10000 });
    let frame = await iframeLocator.contentFrame();

    if (!frame) {
      console.error('  Could not access iframe content');
      return stylists;
    }

    // Fill search input and click SEARCH
    await frame.locator('input[type="text"]').first().fill(searchName);
    await sleep(500);
    await frame.locator('button:has-text("SEARCH")').first().click();
    await sleep(4000);

    // Count how many results we have (using aria-label selector for reliability)
    const resultSelector = '[aria-label*="Select stylist"]';
    const resultCount = await frame.locator(resultSelector).count();
    console.log(`  Found ${resultCount} search results`);

    // Collect all usernames by clicking each result and extracting from the panel
    // (no navigation needed - username is visible in the Contact field)
    for (let i = 0; i < resultCount && i < 20; i++) {
      try {
        const resultDiv = frame.locator(resultSelector).nth(i);
        if (!await resultDiv.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`    Result ${i} not visible, skipping`);
          continue;
        }

        const stylistName = (await resultDiv.textContent()).trim();
        console.log(`    Clicking result ${i}: ${stylistName}`);
        await resultDiv.click();
        await sleep(1500);

        // Extract username from the panel HTML
        // Username is in the Contact section href: https://3pyeup-0x.myshopify.com/AmyAgema
        const panelHTML = await frame.locator('body').innerHTML();

        // Look for username in the shopify URL after Contact section
        const usernameMatch = panelHTML.match(/Contact<\/h4>[\s\S]*?href="[^"]*\.myshopify\.com\/([A-Za-z0-9_]+)"/i) ||
                              panelHTML.match(/\.myshopify\.com\/([A-Za-z][A-Za-z0-9_]{2,})"/);

        let username = null;
        if (usernameMatch) {
          username = usernameMatch[1].trim();
        }

        // Extract stylist ID
        const idMatch = panelHTML.match(/#(\d{5,})/);
        const stylistId = idMatch ? idMatch[1] : null;

        // Extract location
        const locationMatch = panelHTML.match(/Location<\/h4>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i);
        const location = locationMatch ? locationMatch[1].trim() : null;

        if (username && username.length > 2) {
          collectedUsernames.push({
            name: stylistName,
            username: username,
            stylistId: stylistId,
            location: location
          });
          console.log(`    ✓ Collected: ${stylistName} → ${username}`);
        } else {
          console.log(`    Could not extract username for ${stylistName}`);
        }

        await sleep(500);
      } catch (error) {
        console.error(`    Error collecting result ${i}: ${error.message}`);
      }
    }

    // PASS 2: Visit each PWS page to extract contact info
    console.log(`  Pass 2: Extracting contacts from ${collectedUsernames.length} PWS pages...`);

    for (const { name, username } of collectedUsernames) {
      try {
        const pwsUrl = `${CONFIG.BASE_URL}/?pws=${username}`;
        await page.goto(pwsUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });

        // Wait for stylist info to render (1-3 second delay)
        try {
          await page.locator('[data-distributor-name]').waitFor({ state: 'visible', timeout: 5000 });
        } catch (e) {
          await sleep(3000);
        }

        // Extract contact info from HTML
        const pageHTML = await page.content();

        // Phone and email from distributor-info__contact elements
        const phoneMatch = pageHTML.match(/data-distributor-phone[^>]*>(\d+)</);
        const emailMatch = pageHTML.match(/data-distributor-email[^>]*>([^<]+@[^<]+)</);

        // Stylist ID from page
        const idMatch = pageHTML.match(/#(\d{5,})/);

        // Location (may need to click to reveal)
        let location = null;
        const locMatch = pageHTML.match(/class="[^"]*location[^"]*"[^>]*>([^<]+)</i);
        if (locMatch) location = locMatch[1].trim();

        const stylist = {
          name: name,
          username: username,
          stylistId: idMatch ? idMatch[1] : null,
          location: location,
          phone: phoneMatch ? phoneMatch[1] : null,
          email: emailMatch ? emailMatch[1].trim().toLowerCase() : null,
        };

        stylists.push(stylist);
        console.log(`    + ${name} (${username}): ${stylist.email || 'no email'}, ${stylist.phone || 'no phone'}`);

        await sleep(1000);
      } catch (error) {
        console.error(`    Error extracting ${name}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error(`  Search error for "${searchName}": ${error.message}`);
  }

  return stylists;
}

/**
 * Visit a stylist's PWS page and extract contact information
 */
async function extractStylistContact(page, username) {
  const contact = {
    username: username,
    fullName: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    location: null,
    stylistId: null,
  };

  try {
    // Navigate to stylist's PWS page
    const pwsUrl = `${CONFIG.BASE_URL}/?pws=${username}`;
    await page.goto(pwsUrl, { waitUntil: 'domcontentloaded', timeout: CONFIG.PAGE_TIMEOUT });
    await sleep(2000);

    // Click on the stylist button to open contact modal
    const stylistBtn = await page.locator('[data-distributor-name], .stylist-button, .distributor-selector-modal__open').first();
    if (await stylistBtn.isVisible()) {
      await stylistBtn.click();
      await sleep(1500);
    }

    // Extract contact info from modal
    const contactInfo = await page.evaluate(() => {
      const info = {
        fullName: null,
        email: null,
        phone: null,
        location: null,
        stylistId: null,
      };

      // Try to find contact modal content
      const modal = document.querySelector('.distributor-modal, .stylist-modal, [data-distributor-modal], .modal--active');
      const container = modal || document.body;

      // Extract name
      const nameEl = container.querySelector('[data-distributor-name], .stylist-name, h2, h3');
      if (nameEl) {
        info.fullName = nameEl.textContent.trim();
      }

      // Extract ID (e.g., "#264335")
      const idMatch = container.textContent.match(/#(\d+)/);
      if (idMatch) {
        info.stylistId = idMatch[1];
      }

      // Extract email - look for email pattern in text
      const emailMatch = container.textContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        info.email = emailMatch[1].toLowerCase();
      }

      // Also check mailto links
      const mailtoLink = container.querySelector('a[href^="mailto:"]');
      if (mailtoLink && !info.email) {
        info.email = mailtoLink.href.replace('mailto:', '').split('?')[0].toLowerCase();
      }

      // Extract phone - look for phone pattern
      const phoneMatch = container.textContent.match(/(\d{10}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
      if (phoneMatch) {
        info.phone = phoneMatch[1].replace(/[-.\s]/g, '');
      }

      // Also check tel links
      const telLink = container.querySelector('a[href^="tel:"]');
      if (telLink && !info.phone) {
        info.phone = telLink.href.replace('tel:', '').replace(/[-.\s]/g, '');
      }

      // Extract location
      const locationEl = container.querySelector('.location, [data-location], .city-state');
      if (locationEl) {
        info.location = locationEl.textContent.trim();
      } else {
        // Try to find location pattern (City, ST)
        const locMatch = container.textContent.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z]{2})/);
        if (locMatch) {
          info.location = `${locMatch[1]}, ${locMatch[2]}`;
        }
      }

      return info;
    });

    contact.fullName = contactInfo.fullName;
    contact.email = contactInfo.email;
    contact.phone = contactInfo.phone;
    contact.location = contactInfo.location;
    contact.stylistId = contactInfo.stylistId;

    // Parse first/last name
    const { firstName, lastName } = parseName(contact.fullName);
    contact.firstName = firstName;
    contact.lastName = lastName;

  } catch (error) {
    console.error(`  Error extracting contact for ${username}: ${error.message}`);
  }

  return contact;
}

// ============================================================================
// MAIN SCRAPER LOOP
// ============================================================================

async function runScraper(options = {}) {
  console.log('='.repeat(60));
  console.log('COLOR STREET STYLIST SCRAPER');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Get scraper state
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : { processedNames: [], lastNameIndex: 0 };
  const processedNames = new Set(state.processedNames || []);

  // Combine all search names
  const allNames = [...CONFIG.SURNAMES, ...CONFIG.FIRST_NAMES];
  const namesToProcess = allNames.filter(name => !processedNames.has(name));

  const maxNames = options.max || namesToProcess.length;
  const nameBatch = namesToProcess.slice(0, maxNames);

  console.log(`\nTotal names: ${allNames.length}`);
  console.log(`Already processed: ${processedNames.size}`);
  console.log(`Remaining: ${namesToProcess.length}`);
  console.log(`Processing this run: ${nameBatch.length}`);

  if (nameBatch.length === 0) {
    console.log('\nAll names have been processed!');
    return { processed: 0, contacts: 0 };
  }

  // Launch browser
  console.log('\nLaunching browser...');
  const browser = await chromium.launch(CONFIG.BROWSER_OPTIONS);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let namesProcessed = 0;
  let contactsSaved = 0;
  let duplicatesSkipped = 0;
  let errors = 0;

  console.log('\n--- Processing Names ---\n');

  for (let i = 0; i < nameBatch.length; i++) {
    const searchName = nameBatch[i];
    console.log(`[${i + 1}/${nameBatch.length}] Searching: "${searchName}"`);

    try {
      // Search for stylists
      const stylists = await searchStylists(page, searchName);
      console.log(`  Found ${stylists.length} stylists`);

      // Process each stylist
      for (const stylist of stylists) {
        if (!stylist.username) {
          console.log(`    - ${stylist.name}: No username found, skipping`);
          continue;
        }

        // Check if already exists
        if (await contactExists(stylist.username)) {
          console.log(`    - ${stylist.name}: Already exists, skipping`);
          duplicatesSkipped++;
          continue;
        }

        // Extract contact details
        const contact = await extractStylistContact(page, stylist.username);

        if (contact.email) {
          // Check if personal email
          if (!isPersonalEmail(contact.email)) {
            console.log(`    - ${contact.fullName}: Corporate email (${contact.email}), skipping`);
            continue;
          }

          console.log(`    + ${contact.fullName}: ${contact.email}`);

          if (!options.dryRun) {
            const docId = generateContactId(stylist.username);
            await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set({
              firstName: contact.firstName,
              lastName: contact.lastName,
              fullName: contact.fullName,
              email: contact.email,
              phone: contact.phone,
              location: contact.location,
              username: contact.username,
              stylistId: contact.stylistId,
              company: 'Color Street',
              source: 'colorstreet_scraper',
              searchName: searchName,
              sent: false,
              status: 'pending',
              randomIndex: Math.random(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            contactsSaved++;
          }
        } else {
          console.log(`    - ${stylist.name}: No email found`);
        }

        await sleep(addJitter(CONFIG.DELAY_BETWEEN_STYLISTS));
      }

      // Mark name as processed
      processedNames.add(searchName);
      namesProcessed++;

      // Update state periodically
      if (!options.dryRun && namesProcessed % 5 === 0) {
        await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
          processedNames: Array.from(processedNames),
          lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
          lastNameProcessed: searchName,
        }, { merge: true });
      }

    } catch (error) {
      console.error(`  Error processing "${searchName}": ${error.message}`);
      errors++;
    }

    // Delay between searches
    if (i < nameBatch.length - 1) {
      await sleep(addJitter(CONFIG.DELAY_BETWEEN_SEARCHES));
    }
  }

  await browser.close();

  // Final state update
  if (!options.dryRun) {
    await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
      processedNames: Array.from(processedNames),
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunStats: {
        namesProcessed,
        contactsSaved,
        duplicatesSkipped,
        errors,
      },
    }, { merge: true });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Names processed: ${namesProcessed}`);
  console.log(`Contacts saved: ${contactsSaved}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Errors: ${errors}`);

  return { processed: namesProcessed, contacts: contactsSaved, errors };
}

/**
 * Test single name search
 */
async function testName(searchName) {
  console.log(`Testing search for: "${searchName}"`);

  const browser = await chromium.launch({ ...CONFIG.BROWSER_OPTIONS, headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    const stylists = await searchStylists(page, searchName);
    console.log(`\nFound ${stylists.length} stylists:`);

    for (const stylist of stylists) {
      console.log(`\n  ${stylist.name} (${stylist.username || 'no username'})`);

      if (stylist.username) {
        const contact = await extractStylistContact(page, stylist.username);
        console.log(`    Email: ${contact.email || 'N/A'}`);
        console.log(`    Phone: ${contact.phone || 'N/A'}`);
        console.log(`    Location: ${contact.location || 'N/A'}`);
        console.log(`    ID: ${contact.stylistId || 'N/A'}`);
      }

      await sleep(1000);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
}

/**
 * Show statistics
 */
async function showStats() {
  console.log('='.repeat(60));
  console.log('COLOR STREET SCRAPER - Statistics');
  console.log('='.repeat(60));

  // Scraper state
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (stateDoc.exists) {
    const state = stateDoc.data();
    const processedCount = state.processedNames?.length || 0;
    const totalNames = CONFIG.SURNAMES.length + CONFIG.FIRST_NAMES.length;

    console.log(`\nScraper Progress:`);
    console.log(`  Names processed: ${processedCount} / ${totalNames}`);
    console.log(`  Last run: ${state.lastRunAt?.toDate()?.toISOString() || 'N/A'}`);
    console.log(`  Last name: ${state.lastNameProcessed || 'N/A'}`);

    if (state.lastRunStats) {
      console.log(`\nLast Run Stats:`);
      console.log(`  Names processed: ${state.lastRunStats.namesProcessed}`);
      console.log(`  Contacts saved: ${state.lastRunStats.contactsSaved}`);
      console.log(`  Duplicates skipped: ${state.lastRunStats.duplicatesSkipped}`);
    }
  }

  // Contacts collection
  const totalContacts = await db.collection(CONFIG.CONTACTS_COLLECTION).count().get();
  const unsent = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('sent', '==', false).count().get();
  const sent = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('sent', '==', true).count().get();

  console.log(`\n${CONFIG.CONTACTS_COLLECTION}:`);
  console.log(`  Total: ${totalContacts.data().count}`);
  console.log(`  Unsent: ${unsent.data().count}`);
  console.log(`  Sent: ${sent.data().count}`);
}

/**
 * Reset scraper state (for re-running)
 */
async function resetState() {
  console.log('Resetting scraper state...');
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).delete();
  console.log('State reset. All names will be processed again.');
}

// ============================================================================
// CLI HANDLING
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    max: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || undefined,
    name: args.find(a => a.startsWith('--name='))?.split('=')[1],
  };

  initFirebase();

  if (args.includes('--stats')) {
    await showStats();
  } else if (args.includes('--reset')) {
    await resetState();
  } else if (args.includes('--test') && options.name) {
    await testName(options.name);
  } else if (args.includes('--scrape')) {
    await runScraper(options);
  } else {
    console.log(`
Color Street Stylist Scraper

Usage:
  node scripts/colorstreet-scraper.js --scrape                    # Scrape all names
  node scripts/colorstreet-scraper.js --scrape --max=10           # Limit to 10 names
  node scripts/colorstreet-scraper.js --dry-run --scrape          # Preview mode
  node scripts/colorstreet-scraper.js --test --name=Amy           # Test single name
  node scripts/colorstreet-scraper.js --stats                     # Show statistics
  node scripts/colorstreet-scraper.js --reset                     # Reset progress

Search Names:
  - ${CONFIG.SURNAMES.length} surnames
  - ${CONFIG.FIRST_NAMES.length} first names
  - ${CONFIG.SURNAMES.length + CONFIG.FIRST_NAMES.length} total searches
    `);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
