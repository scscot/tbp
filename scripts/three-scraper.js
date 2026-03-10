#!/usr/bin/env node
/**
 * THREE International Contact Scraper
 *
 * HTTP-based scraper that extracts contact information from THREE International
 * representative pages at *.threeinternational.com subdomains.
 *
 * Contact info is accessible via HTTP (no Puppeteer required).
 * Data is embedded in the SponsorModal (#change-webalias-modal).
 *
 * URL Pattern: https://{subdomain}.threeinternational.com
 * Example: https://corbinandholly.threeinternational.com
 *
 * Data extraction:
 *   - Name: From social link text or modal content
 *   - Email: From mailto: link
 *   - Phone: From div content in modal
 *
 * Flow:
 *   1. Load discovered subdomains from three_discovered_subdomains collection
 *   2. Fetch https://{subdomain}.threeinternational.com via HTTP
 *   3. Extract name, email, phone from SponsorModal
 *   4. Save to three_contacts collection
 *
 * Usage:
 *   node scripts/three-scraper.js --scrape                    # Scrape next batch
 *   node scripts/three-scraper.js --scrape --max=50           # Limit to 50 contacts
 *   node scripts/three-scraper.js --dry-run                   # Preview only
 *   node scripts/three-scraper.js --stats                     # Show stats
 *   node scripts/three-scraper.js --reset                     # Reset scraper state
 *   node scripts/three-scraper.js --test --subdomain=xyz      # Test single subdomain
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
  DISCOVERED_COLLECTION: 'three_discovered_subdomains',
  CONTACTS_COLLECTION: 'three_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'three_scraper',

  // THREE domain
  THREE_DOMAIN: 'threeinternational.com',

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 2000,   // 2 seconds between requests
  DELAY_JITTER: 1000,             // Random jitter up to 1 second
  REQUEST_TIMEOUT: 15000,         // 15 second timeout
  MAX_CONTACTS_PER_RUN: 50,       // Default max contacts per run

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

function inferCountryFromPhone(phone) {
  if (!phone) return null;

  const phoneDigits = phone.replace(/\D/g, '');

  // Check for 10-digit US numbers
  if (phoneDigits.length === 10) {
    return 'United States';
  }

  // Common country codes
  if (phoneDigits.startsWith('1') && phoneDigits.length === 11) {
    return 'United States';
  } else if (phoneDigits.startsWith('44')) {
    return 'United Kingdom';
  } else if (phoneDigits.startsWith('49')) {
    return 'Germany';
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
  }

  return null;
}

function buildProfileUrl(subdomain) {
  return `https://${subdomain}.${CONFIG.THREE_DOMAIN}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scrape: false,
    dryRun: false,
    stats: false,
    reset: false,
    test: false,
    subdomain: null,
    max: CONFIG.MAX_CONTACTS_PER_RUN,
  };

  for (const arg of args) {
    if (arg === '--scrape') options.scrape = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--reset') options.reset = true;
    if (arg === '--test') options.test = true;
    if (arg.startsWith('--subdomain=')) {
      options.subdomain = arg.split('=')[1].toLowerCase();
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
 * Extract contact info from THREE International page HTML
 * Data is in the SponsorModal (#sponsorModal)
 *
 * Structure:
 *   <i class="fa fa-phone"></i> 9188125694<br/>
 *   <a href="mailto:holly@chroush.com">...</a>
 *   <a href="https://Holly Kremer Roush" class="..."><i class="fa fa-facebook"></i></a>
 */
function extractContactFromHtml(html, subdomain) {
  const result = {
    fullName: null,
    email: null,
    phone: null,
  };

  try {
    const $ = cheerio.load(html);

    // Method 1: Look for the SponsorModal (#sponsorModal)
    const modal = $('#sponsorModal');
    if (modal.length > 0) {
      // Extract email from mailto: link
      const mailtoLink = modal.find('a[href^="mailto:"]');
      if (mailtoLink.length > 0) {
        const href = mailtoLink.attr('href');
        if (href) {
          result.email = href.replace('mailto:', '').split('?')[0].trim();
        }
      }

      // Extract phone - look for fa-phone icon followed by number
      const modalHtml = modal.html();
      const phoneMatch = modalHtml.match(/fa-phone[^>]*><\/i>\s*([\d\s()-]+)/);
      if (phoneMatch) {
        result.phone = phoneMatch[1].trim();
      }

      // Extract name from Facebook link href (THREE puts name in href)
      // Pattern: <a href="https://Holly Kremer Roush" class="..."><i class="fa fa-facebook">
      const fbLink = modal.find('a i.fa-facebook').parent();
      if (fbLink.length > 0) {
        const href = fbLink.attr('href');
        if (href) {
          // Extract name from href - remove https:// prefix if present
          let name = href.replace(/^https?:\/\//, '').trim();
          // Only use if it looks like a name (letters, spaces, hyphens)
          if (name && name.length > 2 && name.length < 50 && /^[A-Za-z\s'-]+$/.test(name)) {
            result.fullName = name;
          }
        }
      }
    }

    // Method 2: Search in all mailto: links
    if (!result.email) {
      $('a[href^="mailto:"]').each((i, el) => {
        const href = $(el).attr('href');
        if (href && !result.email) {
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (normalizeEmail(email)) {
            result.email = email;
          }
        }
      });
    }

    // Method 3: Search for email patterns in page content
    if (!result.email) {
      const pageText = $.html();
      const emailMatches = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
      if (emailMatches) {
        // Filter out common non-personal/corporate emails
        const personalEmail = emailMatches.find(e =>
          !e.includes('threeinternational.com') &&
          !e.includes('iii.earth') &&
          !e.includes('example.com') &&
          !e.includes('test.com')
        );
        if (personalEmail) {
          result.email = personalEmail.toLowerCase();
        }
      }
    }

    // Filter out corporate email if detected
    if (result.email && (
      result.email.includes('iii.earth') ||
      result.email.includes('threeinternational.com') ||
      result.email === 'support@iii.earth'
    )) {
      result.email = null;
    }

    // Method 4: Look for phone patterns throughout the page
    if (!result.phone) {
      const pageText = $('body').text();
      // Look for US phone patterns
      const phoneMatch = pageText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      if (phoneMatch) {
        result.phone = phoneMatch[0];
      }
    }

    // Method 5: SKIPPED - THREE pages have too much marketing text in headers
    // (title/header extraction disabled due to false positives like "Proven Results", etc.)
    // The Facebook link href (Method 1) or subdomain fallback (Method 7) work better

    // Method 6: Search in script tags for embedded JSON data
    $('script').each((i, script) => {
      const content = $(script).html();
      if (!content) return;

      // Look for email in JSON
      if (!result.email) {
        const emailMatch = content.match(/"email"\s*:\s*"([^"]+@[^"]+)"/);
        if (emailMatch) {
          result.email = emailMatch[1].toLowerCase();
        }
      }

      // Look for phone in JSON
      if (!result.phone) {
        const phoneMatch = content.match(/"phone(?:Number)?"\s*:\s*"([^"]+)"/);
        if (phoneMatch) {
          result.phone = phoneMatch[1];
        }
      }

      // Look for name in JSON
      if (!result.fullName) {
        const nameMatch = content.match(/"(?:full)?[Nn]ame"\s*:\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1].length > 2 && nameMatch[1].length < 50) {
          result.fullName = nameMatch[1];
        }
      }
    });

    // Fallback: Use subdomain as name if nothing found
    if (!result.fullName && subdomain) {
      // Convert camelCase or hyphenated to title case
      const nameFromSubdomain = subdomain
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      if (nameFromSubdomain.length > 2) {
        result.fullName = nameFromSubdomain;
      }
    }

  } catch (error) {
    console.log(`    Extraction error: ${error.message}`);
  }

  return result;
}

/**
 * Scrape contact info from a THREE International representative page
 */
async function scrapeContactFromPage(subdomain) {
  const url = buildProfileUrl(subdomain);

  try {
    console.log(`  Fetching: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: CONFIG.REQUEST_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 404) {
      console.log(`    Page not found (404)`);
      return { notFound: true };
    }

    if (response.status === 403) {
      console.log(`    Access forbidden (403)`);
      return { forbidden: true };
    }

    if (response.status !== 200) {
      console.log(`    HTTP ${response.status}`);
      return null;
    }

    const html = response.data;
    const contactInfo = extractContactFromHtml(html, subdomain);

    // Infer country from phone
    contactInfo.country = inferCountryFromPhone(contactInfo.phone);

    console.log(`    Name: ${contactInfo.fullName || 'not found'}`);
    console.log(`    Email: ${contactInfo.email || 'not found'}`);
    console.log(`    Phone: ${contactInfo.phone || 'not found'}`);
    if (contactInfo.country) {
      console.log(`    Country: ${contactInfo.country}`);
    }

    return contactInfo;

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`    Timeout`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`    DNS not found - subdomain doesn't exist`);
      return { notFound: true };
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

/**
 * Get unscraped subdomains from Firestore
 */
async function getUnscrapedSubdomains(limit) {
  console.log(`\n Loading unscraped subdomains (limit: ${limit})...`);

  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', false)
    .orderBy('discoveredAt', 'asc')
    .limit(limit)
    .get();

  const subdomains = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    subdomains.push({
      docId: doc.id,
      subdomain: data.subdomain,
      source: data.source,
    });
  });

  console.log(`  Found ${subdomains.length} unscraped subdomains`);
  return subdomains;
}

/**
 * Check if a contact already exists
 */
async function checkContactExists(subdomain) {
  const snapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('subdomain', '==', subdomain)
    .limit(1)
    .get();

  return !snapshot.empty;
}

async function saveContact(subdomain, contactInfo, dryRun) {
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

    // Source
    subdomain,
    profileUrl: buildProfileUrl(subdomain),
    company: 'THREE International',
    source: 'three_scraper',

    // Campaign status
    sent: false,
    sentTimestamp: null,
    status: email ? 'pending' : 'no_email',
    subjectTag: null,
    randomIndex: Math.random(),

    // Metadata
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

async function markSubdomainAsScraped(docId, success, dryRun) {
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

  // Reset discovered subdomains to unscraped
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();

  let count = 0;
  const batchSize = 500;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { scraped: false, scrapedAt: null, scrapeSuccess: null });
    count++;

    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  Reset ${count} subdomains...`);
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

  console.log(`  Reset ${count} discovered subdomains`);
  console.log(`  Deleted ${contactCount} contacts`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n THREE International Scraper Stats\n');

  // Discovered subdomains
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

  console.log('Discovered Subdomains:');
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

  if (state.subdomainsProcessed !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Subdomains Processed: ${state.subdomainsProcessed}`);
    console.log(`  Contacts Saved:       ${state.contactsSaved}`);
    console.log(`  No Email:             ${state.noEmail || 0}`);
    console.log(`  Not Found (404):      ${state.notFound || 0}`);
    console.log(`  Errors:               ${state.errors}`);
  }

  // Sample contacts
  if (totalContacts > 0) {
    console.log('\nRecent contacts (last 5):');
    const recentSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    recentSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.fullName || data.subdomain} - ${data.email || 'no email'}`);
    });
  }
}

// ============================================================================
// TEST SINGLE SUBDOMAIN
// ============================================================================

async function testSingleSubdomain(subdomain) {
  console.log(`\n Testing subdomain: ${subdomain}`);
  console.log(`  URL: ${buildProfileUrl(subdomain)}`);

  const contactInfo = await scrapeContactFromPage(subdomain);

  if (contactInfo && !contactInfo.notFound && !contactInfo.forbidden) {
    console.log('\n Contact found:');
    console.log(`  Name:    ${contactInfo.fullName || 'not found'}`);
    console.log(`  Email:   ${contactInfo.email || 'not found'}`);
    console.log(`  Phone:   ${contactInfo.phone || 'not found'}`);
    console.log(`  Country: ${contactInfo.country || 'not found'}`);

    if (contactInfo.email) {
      console.log('\n  This contact HAS email - would be saved for campaigns');
    } else {
      console.log('\n  This contact has NO email - would be saved with status "no_email"');
    }
  } else if (contactInfo?.notFound) {
    console.log('\n  Page/subdomain not found - invalid subdomain');
  } else if (contactInfo?.forbidden) {
    console.log('\n  Access forbidden (403) - may need different approach');
  } else {
    console.log('\n  Failed to extract contact info');
  }
}

// ============================================================================
// MAIN SCRAPING FLOW
// ============================================================================

async function runScraping(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('THREE INTERNATIONAL CONTACT SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max contacts: ${options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get unscraped subdomains
  const subdomains = await getUnscrapedSubdomains(options.max);

  if (subdomains.length === 0) {
    console.log('\n No unscraped subdomains found. Run discovery first.');
    return;
  }

  const stats = {
    subdomainsProcessed: 0,
    contactsSaved: 0,
    noEmail: 0,
    errors: 0,
    duplicates: 0,
    notFound: 0,
    forbidden: 0,
  };

  for (const { docId, subdomain, source } of subdomains) {
    console.log(`\n Processing: ${subdomain} (${stats.subdomainsProcessed + 1}/${subdomains.length})`);

    // Check if contact already exists
    const exists = await checkContactExists(subdomain);
    if (exists) {
      console.log(`  Skipping: Contact already exists`);
      await markSubdomainAsScraped(docId, true, options.dryRun);
      stats.duplicates++;
      stats.subdomainsProcessed++;
      continue;
    }

    // Scrape contact
    const contactInfo = await scrapeContactFromPage(subdomain);

    if (contactInfo?.notFound) {
      await markSubdomainAsScraped(docId, false, options.dryRun);
      stats.notFound++;
    } else if (contactInfo?.forbidden) {
      await markSubdomainAsScraped(docId, false, options.dryRun);
      stats.forbidden++;
    } else if (contactInfo && (contactInfo.fullName || contactInfo.email || contactInfo.phone)) {
      // Save contact (with or without email)
      await saveContact(subdomain, contactInfo, options.dryRun);
      await markSubdomainAsScraped(docId, true, options.dryRun);
      stats.contactsSaved++;

      if (!normalizeEmail(contactInfo.email)) {
        stats.noEmail++;
      }
    } else {
      console.log(`  No contact info found`);
      await markSubdomainAsScraped(docId, false, options.dryRun);
      stats.errors++;
    }

    stats.subdomainsProcessed++;

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
  console.log(`Subdomains processed: ${stats.subdomainsProcessed}`);
  console.log(`Contacts saved:       ${stats.contactsSaved}`);
  console.log(`No email:             ${stats.noEmail}`);
  console.log(`Not found (404):      ${stats.notFound}`);
  console.log(`Forbidden (403):      ${stats.forbidden}`);
  console.log(`Duplicates:           ${stats.duplicates}`);
  console.log(`Errors:               ${stats.errors}`);
  console.log(`Time elapsed:         ${elapsed}s`);
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

  if (options.test && options.subdomain) {
    await testSingleSubdomain(options.subdomain);
    process.exit(0);
  }

  if (options.scrape) {
    await runScraping(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Usage:');
  console.log('  node scripts/three-scraper.js --scrape                    # Scrape next batch');
  console.log('  node scripts/three-scraper.js --scrape --max=50           # Limit to 50 contacts');
  console.log('  node scripts/three-scraper.js --dry-run                   # Preview only');
  console.log('  node scripts/three-scraper.js --stats                     # Show stats');
  console.log('  node scripts/three-scraper.js --reset                     # Reset scraper state');
  console.log('  node scripts/three-scraper.js --test --subdomain=xyz      # Test single subdomain');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
