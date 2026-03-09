#!/usr/bin/env node
/**
 * Farmasius Contact Scraper
 *
 * HTTP-based scraper that extracts contact information from Farmasius
 * representative pages. Contact info is embedded in server-rendered JSON
 * (Next.js SSR), so no browser automation is required.
 *
 * URL format: https://www.farmasius.com/{username}
 *
 * Data extraction:
 *   - Email: Found in page JSON/HTML (e.g., shoptheredbird@gmail.com)
 *   - Name: Found in page JSON/HTML (e.g., Danielle Baker)
 *   - Phone: Found in page JSON/HTML (e.g., 1864303-8748)
 *
 * Flow:
 *   1. Load discovered usernames from farmasius_discovered_users collection
 *   2. Fetch https://www.farmasius.com/{username} via HTTP
 *   3. Extract name, email, phone from server-rendered content
 *   4. Save to farmasius_contacts collection
 *
 * Usage:
 *   node scripts/farmasius-scraper.js --scrape                     # Scrape next batch
 *   node scripts/farmasius-scraper.js --scrape --max=50            # Limit to 50 contacts
 *   node scripts/farmasius-scraper.js --dry-run                    # Preview only
 *   node scripts/farmasius-scraper.js --stats                      # Show stats
 *   node scripts/farmasius-scraper.js --reset                      # Reset scraper state
 *   node scripts/farmasius-scraper.js --test --username=boss1      # Test single username
 */

const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'farmasius_discovered_users',
  CONTACTS_COLLECTION: 'farmasius_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'farmasius',

  // Farmasius URL
  BASE_URL: 'https://www.farmasius.com',

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 2000,   // 2 seconds between requests
  DELAY_JITTER: 1000,             // Random jitter up to 1 second
  REQUEST_TIMEOUT: 15000,         // 15 second timeout
  MAX_CONTACTS_PER_RUN: 200,      // Default max contacts per run

  // HTTP config
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

// Placeholder values that Farmasius uses for unconfigured profiles
const PLACEHOLDER_VALUES = {
  emails: ['name@example.com'],
  names: ['name'],
  phones: ['1379242409'],
};

function isPlaceholderEmail(email) {
  if (!email) return false;
  return PLACEHOLDER_VALUES.emails.includes(email.toLowerCase().trim());
}

function isPlaceholderName(name) {
  if (!name) return false;
  return PLACEHOLDER_VALUES.names.includes(name.toLowerCase().trim());
}

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();

  // Filter out placeholder emails
  if (isPlaceholderEmail(cleaned)) {
    return null;
  }

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

function inferCountryFromPhone(phone) {
  if (!phone) return null;

  const phoneDigits = phone.replace(/\D/g, '');

  // Check for 10-digit US numbers FIRST
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
  } else if (phoneDigits.startsWith('52')) {
    return 'Mexico';
  } else if (phoneDigits.startsWith('55')) {
    return 'Brazil';
  } else if (phoneDigits.startsWith('61')) {
    return 'Australia';
  } else if (phoneDigits.startsWith('91')) {
    return 'India';
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
// CONTACT EXTRACTION
// ============================================================================

/**
 * Extract contact info from Farmasius page HTML
 * The data is embedded in Next.js server-rendered JSON
 */
function extractContactFromHtml(html, username) {
  const result = {
    fullName: null,
    email: null,
    phone: null,
    sponsorNumber: null,
  };

  try {
    const $ = cheerio.load(html);

    // Method 1: Look for Next.js __NEXT_DATA__ JSON
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);

        // Farmasius stores data in props.initialData (NOT pageProps)
        const initialData = nextData?.props?.initialData;

        if (initialData) {
          const profileData = initialData.profileData;
          const sponsorAliasData = initialData.sponsorAliasData;

          // Extract from sponsorAliasData (primary source for email/phone/sponsor)
          if (sponsorAliasData) {
            // Email: userMail field
            if (sponsorAliasData.userMail && !sponsorAliasData.userMail.includes('farmasius.com')) {
              result.email = sponsorAliasData.userMail;
            }
            // Phone: userPhone field
            if (sponsorAliasData.userPhone) {
              result.phone = sponsorAliasData.userPhone;
            }
            // Sponsor: sponsorNo field
            if (sponsorAliasData.sponsorNo) {
              result.sponsorNumber = sponsorAliasData.sponsorNo;
            }
            // Name: recognitionName field (best format)
            if (sponsorAliasData.recognitionName) {
              result.fullName = sponsorAliasData.recognitionName;
            }
          }

          // Extract from profileData (fallback source)
          if (profileData) {
            // Email fallback
            if (!result.email && profileData.email && !profileData.email.includes('farmasius.com')) {
              result.email = profileData.email;
            }
            // Name fallback (combine name + surname)
            if (!result.fullName) {
              if (profileData.recognitionName) {
                result.fullName = profileData.recognitionName;
              } else if (profileData.name && profileData.surname) {
                result.fullName = `${profileData.name} ${profileData.surname}`.trim();
              } else if (profileData.name) {
                result.fullName = profileData.name;
              }
            }
          }
        }

        // Also check pageProps as fallback for different page structures
        const pageProps = nextData?.props?.pageProps;
        if (pageProps) {
          const userData = pageProps.user || pageProps.profile || pageProps.data || pageProps;
          if (userData) {
            if (!result.email && userData.email && !userData.email.includes('farmasius.com')) {
              result.email = userData.email;
            }
            if (!result.fullName && userData.name) result.fullName = userData.name;
            if (!result.fullName && userData.fullName) result.fullName = userData.fullName;
            if (!result.phone && userData.phone) result.phone = userData.phone;
            if (!result.phone && userData.phoneNumber) result.phone = userData.phoneNumber;
            if (!result.sponsorNumber && userData.sponsorNumber) result.sponsorNumber = userData.sponsorNumber;
          }
        }
      } catch (e) {
        // JSON parse failed, continue with other methods
      }
    }

    // Method 2: Extract from visible page content using regex
    const pageText = $.text();

    // Email pattern (exclude farmasius.com domain emails)
    if (!result.email) {
      const emailMatches = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches) {
        // Find first non-farmasius email
        const personalEmail = emailMatches.find(e => !e.toLowerCase().includes('farmasius.com'));
        if (personalEmail) {
          result.email = personalEmail.toLowerCase();
        }
      }
    }

    // Phone pattern (various formats)
    if (!result.phone) {
      // Look for phone patterns: XXX-XXX-XXXX, (XXX) XXX-XXXX, XXXXXXXXXX, 1XXXXXXXXXX
      const phoneMatch = pageText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        result.phone = phoneMatch[0];
      }
    }

    // Method 3: Look for specific HTML elements/attributes
    // Look for accordion button with user name (as mentioned by user)
    const accordionButton = $('[data-testid="accordionButton"]');
    if (accordionButton.length > 0) {
      const nameEl = accordionButton.find('[data-testid="biLinkModalTitle"]');
      if (nameEl.length > 0 && !result.fullName) {
        result.fullName = nameEl.text().trim();
      }
    }

    // Look for any element with notranslate class containing name
    if (!result.fullName) {
      const nameElements = $('.notranslate');
      nameElements.each((i, el) => {
        const text = $(el).text().trim();
        // Check if it looks like a name (2+ words, reasonable length)
        if (text && text.length > 2 && text.length < 50 && /^[A-Za-z\s'-]+$/.test(text)) {
          if (!result.fullName) {
            result.fullName = text;
          }
        }
      });
    }

    // Method 4: Search in script tags for embedded data
    $('script').each((i, script) => {
      const content = $(script).html();
      if (content && content.includes('@') && !result.email) {
        const emailMatch = content.match(/"email"\s*:\s*"([^"]+@[^"]+)"/);
        if (emailMatch) {
          result.email = emailMatch[1].toLowerCase();
        }
      }
      if (content && !result.phone) {
        const phoneMatch = content.match(/"phone(?:Number)?"\s*:\s*"([^"]+)"/);
        if (phoneMatch) {
          result.phone = phoneMatch[1];
        }
      }
      if (content && !result.fullName) {
        // Look for name in JSON
        const nameMatch = content.match(/"(?:full)?[Nn]ame"\s*:\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1].length > 2 && nameMatch[1].length < 50) {
          result.fullName = nameMatch[1];
        }
      }
      if (content && !result.sponsorNumber) {
        const sponsorMatch = content.match(/"sponsor(?:Number|Id)?"\s*:\s*"?(\d+)"?/);
        if (sponsorMatch) {
          result.sponsorNumber = sponsorMatch[1];
        }
      }
    });

    // Method 5: Look in HTML comments or data attributes
    const htmlString = $.html();

    // Sponsor number pattern
    if (!result.sponsorNumber) {
      const sponsorMatch = htmlString.match(/sponsor[^\d]*(\d{5,10})/i);
      if (sponsorMatch) {
        result.sponsorNumber = sponsorMatch[1];
      }
    }

  } catch (error) {
    console.log(`    Extraction error: ${error.message}`);
  }

  return result;
}

/**
 * Scrape contact info from a Farmasius representative page
 */
async function scrapeContactFromPage(username) {
  const url = `${CONFIG.BASE_URL}/${username}`;

  try {
    console.log(`  Fetching: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: CONFIG.REQUEST_TIMEOUT,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404) {
      console.log(`    Page not found (404)`);
      return { notFound: true };
    }

    if (response.status !== 200) {
      console.log(`    HTTP ${response.status}`);
      return null;
    }

    const html = response.data;
    const contactInfo = extractContactFromHtml(html, username);

    // Infer country from phone
    contactInfo.country = inferCountryFromPhone(contactInfo.phone);

    console.log(`    Name: ${contactInfo.fullName || 'not found'}`);
    console.log(`    Email: ${contactInfo.email || 'not found'}`);
    console.log(`    Phone: ${contactInfo.phone || 'not found'}`);
    console.log(`    Country: ${contactInfo.country || 'not found'}`);

    return contactInfo;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`    Timeout`);
    } else if (error.response?.status === 404) {
      console.log(`    Page not found (404)`);
      return { notFound: true };
    } else {
      console.log(`    Error: ${error.message}`);
    }
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
    sponsorNumber: contactInfo.sponsorNumber || null,

    // Metadata
    company: 'Farmasi',
    source: 'farmasius_profile',
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
    console.log(`    DRY RUN - Would save: ${contact.fullName} (${contact.email || 'no email'})`);
    return true;
  }

  await db.collection(CONFIG.CONTACTS_COLLECTION).add(contact);
  console.log(`    Saved: ${contact.fullName} (${contact.email || 'no email'})`);
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
  console.log('\n Farmasius Scraper Stats\n');

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

  console.log('Discovered Usernames:');
  console.log(`  Total:     ${totalDiscovered}`);
  console.log(`  Scraped:   ${scrapedCount}`);
  console.log(`  Pending:   ${totalDiscovered - scrapedCount}`);

  console.log('\nContacts:');
  console.log(`  Total:       ${totalContacts}`);
  console.log(`  With email:  ${withEmailCount}`);
  console.log(`  Sent:        ${sentCount}`);

  if (state.lastRunAt) {
    console.log(`\nLast Run: ${state.lastRunAt.toDate().toISOString()}`);
  }

  if (state.usernamesProcessed !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Usernames Processed: ${state.usernamesProcessed}`);
    console.log(`  Contacts Saved:      ${state.contactsSaved}`);
    console.log(`  No Email:            ${state.noEmail || 0}`);
    console.log(`  Placeholder:         ${state.placeholder || 0}`);
    console.log(`  Not Found (404):     ${state.notFound || 0}`);
    console.log(`  Errors:              ${state.errors}`);
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

  const contactInfo = await scrapeContactFromPage(username);

  if (contactInfo && !contactInfo.notFound) {
    console.log('\n Contact found:');
    console.log(`  Name:    ${contactInfo.fullName || 'not found'}`);
    console.log(`  Email:   ${contactInfo.email || 'not found'}`);
    console.log(`  Phone:   ${contactInfo.phone || 'not found'}`);
    console.log(`  Country: ${contactInfo.country || 'not found'}`);
    console.log(`  Sponsor: ${contactInfo.sponsorNumber || 'not found'}`);

    // Check for placeholder data
    const hasPlaceholderEmail = isPlaceholderEmail(contactInfo.email);
    const hasPlaceholderName = isPlaceholderName(contactInfo.fullName);

    if (hasPlaceholderEmail && hasPlaceholderName) {
      console.log('\n  ⚠️  PLACEHOLDER DATA - would be SKIPPED (unconfigured profile)');
    } else if (hasPlaceholderEmail) {
      console.log('\n  This contact has placeholder email - would be saved with status "no_email"');
    } else if (contactInfo.email) {
      console.log('\n  ✓ This contact HAS email - would be saved for campaigns');
    } else {
      console.log('\n  This contact has NO email - would be saved with status "no_email"');
    }
  } else if (contactInfo?.notFound) {
    console.log('\n Page not found (404) - invalid username');
  } else {
    console.log('\n Failed to extract contact info');
  }
}

// ============================================================================
// MAIN SCRAPING FLOW
// ============================================================================

async function runScraping(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('FARMASIUS CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max contacts: ${options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get unscraped usernames
  const usernames = await getUnscrapedUsernames(options.max);

  if (usernames.length === 0) {
    console.log('\n No unscraped usernames found. Run discovery first.');
    return;
  }

  const stats = {
    usernamesProcessed: 0,
    contactsSaved: 0,
    noEmail: 0,
    errors: 0,
    duplicates: 0,
    notFound: 0,
    placeholder: 0,
  };

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
    const contactInfo = await scrapeContactFromPage(username);

    if (contactInfo?.notFound) {
      await markUsernameAsScraped(docId, false, options.dryRun);
      stats.notFound++;
    } else if (contactInfo && (contactInfo.fullName || contactInfo.email)) {
      // Check for placeholder data (unconfigured Farmasius profiles)
      const hasPlaceholderEmail = isPlaceholderEmail(contactInfo.email);
      const hasPlaceholderName = isPlaceholderName(contactInfo.fullName);

      if (hasPlaceholderEmail && hasPlaceholderName) {
        console.log(`  Skipping: Placeholder data (unconfigured profile)`);
        await markUsernameAsScraped(docId, false, options.dryRun);
        stats.placeholder++;
      } else {
        // Save contact (with or without email)
        await saveContact(username, contactInfo, options.dryRun);
        await markUsernameAsScraped(docId, true, options.dryRun);
        stats.contactsSaved++;

        if (!normalizeEmail(contactInfo.email)) {
          stats.noEmail++;
        }
      }
    } else {
      console.log(`  No contact info found`);
      await markUsernameAsScraped(docId, false, options.dryRun);
      stats.errors++;
    }

    stats.usernamesProcessed++;

    // Rate limiting
    const delay = randomDelay(CONFIG.DELAY_BETWEEN_REQUESTS);
    await sleep(delay);
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
  console.log(`Usernames processed: ${stats.usernamesProcessed}`);
  console.log(`Contacts saved:      ${stats.contactsSaved}`);
  console.log(`No email:            ${stats.noEmail}`);
  console.log(`Placeholder:         ${stats.placeholder}`);
  console.log(`Not found (404):     ${stats.notFound}`);
  console.log(`Duplicates:          ${stats.duplicates}`);
  console.log(`Errors:              ${stats.errors}`);
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
  console.log('  node scripts/farmasius-scraper.js --scrape                     # Scrape next batch');
  console.log('  node scripts/farmasius-scraper.js --scrape --max=50            # Limit to 50 contacts');
  console.log('  node scripts/farmasius-scraper.js --dry-run                    # Preview only');
  console.log('  node scripts/farmasius-scraper.js --stats                      # Show stats');
  console.log('  node scripts/farmasius-scraper.js --reset                      # Reset scraper state');
  console.log('  node scripts/farmasius-scraper.js --test --username=boss1      # Test single username');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
