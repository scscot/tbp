#!/usr/bin/env node
/**
 * FuXion Email Discovery via SerpAPI
 *
 * Since FuXion's website blocks automated scraping, this script uses Google
 * search to find distributor email addresses from public sources.
 *
 * Flow:
 * 1. Get distributorIds from spanish_discovered_urls (company == 'fuxion', emailSearched == false)
 * 2. Google search: "{distributorId}" "fuxion" email
 * 3. Extract emails from search results
 * 4. Save to spanish_contacts collection
 *
 * Usage:
 *   node scripts/fuxion-email-search.js --search              # Search for emails
 *   node scripts/fuxion-email-search.js --search --max=50     # Limit to 50
 *   node scripts/fuxion-email-search.js --stats               # Show stats
 *   node scripts/fuxion-email-search.js --dry-run             # Preview only
 *   node scripts/fuxion-email-search.js --test --id=ID        # Test single distributor
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const { getJson } = require('serpapi');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load SerpAPI key from file (same as other scripts)
const SERPAPI_KEY_PATH = path.join(__dirname, '../secrets/SerpAPI-Key');
const SERPAPI_KEY = fs.existsSync(SERPAPI_KEY_PATH)
  ? fs.readFileSync(SERPAPI_KEY_PATH, 'utf8').trim()
  : process.env.SERPAPI_KEY || process.env.SERP_API_KEY;

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'spanish_discovered_urls',
  CONTACTS_COLLECTION: 'spanish_contacts',

  // SerpAPI settings
  SERPAPI_KEY: SERPAPI_KEY,

  // Search settings
  DEFAULT_MAX: 50,
  DELAY_BETWEEN_SEARCHES: 4000,  // 4 seconds (SerpAPI rate limit friendly)

  // Email extraction regex
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Domains to exclude (generic/spam/company)
  EXCLUDED_DOMAINS: [
    'example.com', 'test.com', 'email.com', 'mail.com',
    'fuxion.com', 'ifuxion.com', 'fuxion.net',  // Company domains (not personal)
    'sentry.io', 'wixpress.com', 'schema.org',
    'w3.org', 'facebook.com', 'twitter.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
  ],
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initFirebase() {
  if (db) return;

  const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  db = admin.firestore();
  console.log('Firebase initialized');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract emails from text, filtering out excluded domains
 */
function extractEmails(text) {
  if (!text) return [];

  const matches = text.match(CONFIG.EMAIL_REGEX) || [];
  return matches
    .map(email => email.toLowerCase().trim())
    .filter(email => {
      const domain = email.split('@')[1];
      return !CONFIG.EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded));
    })
    .filter((email, index, self) => self.indexOf(email) === index);  // Dedupe
}

/**
 * Parse distributor ID into potential name parts
 * e.g., "CarlosTorres" -> "Carlos Torres"
 */
function parseDistributorId(distributorId) {
  // Split camelCase or PascalCase into words
  const words = distributorId
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(w => w.length > 0);

  if (words.length >= 2) {
    return {
      firstName: words[0],
      lastName: words.slice(1).join(' '),
      fullName: words.join(' ')
    };
  }

  return {
    firstName: distributorId,
    lastName: null,
    fullName: distributorId
  };
}

// ============================================================================
// SERPAPI SEARCH
// ============================================================================

/**
 * Search Google for distributor email using SerpAPI
 */
async function searchDistributorEmail(distributorId) {
  const { fullName } = parseDistributorId(distributorId);

  // Try multiple search queries
  const queries = [
    `"${fullName}" "fuxion" email`,
    `"${distributorId}" fuxion email contact`,
    `fuxion distributor "${fullName}" @`,
  ];

  const allEmails = new Set();

  for (const query of queries) {
    try {
      console.log(`    Query: ${query}`);

      const result = await new Promise((resolve, reject) => {
        getJson({
          api_key: CONFIG.SERPAPI_KEY,
          engine: 'google',
          q: query,
          num: 10,
          hl: 'es',
          gl: 'mx',
        }, (json) => {
          if (json.error) {
            reject(new Error(json.error));
          } else {
            resolve(json);
          }
        });
      });

      // Extract emails from organic results
      if (result.organic_results) {
        for (const item of result.organic_results) {
          const textToSearch = [
            item.title || '',
            item.snippet || '',
            item.link || '',
          ].join(' ');

          const emails = extractEmails(textToSearch);
          emails.forEach(email => allEmails.add(email));
        }
      }

      // Extract emails from knowledge graph if present
      if (result.knowledge_graph) {
        const kgText = JSON.stringify(result.knowledge_graph);
        const emails = extractEmails(kgText);
        emails.forEach(email => allEmails.add(email));
      }

      // If we found emails, stop searching
      if (allEmails.size > 0) {
        break;
      }

      // Small delay between queries for same distributor
      await delay(1000);

    } catch (error) {
      console.log(`    Search error: ${error.message}`);
      // Continue to next query
    }
  }

  return Array.from(allEmails);
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Get pending FuXion distributors to search
 */
async function getPendingDistributors(maxCount) {
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .where('emailSearched', '==', false)
    .limit(maxCount)
    .get();

  // If no results with emailSearched == false, get those without the field
  if (snapshot.empty) {
    const fallbackSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
      .where('company', '==', 'fuxion')
      .limit(maxCount)
      .get();

    // Filter to those without emailSearched field
    return fallbackSnapshot.docs
      .filter(doc => doc.data().emailSearched === undefined)
      .map(doc => ({
        docId: doc.id,
        ...doc.data()
      }));
  }

  return snapshot.docs.map(doc => ({
    docId: doc.id,
    ...doc.data()
  }));
}

/**
 * Check if contact already exists
 */
async function contactExists(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const docId = normalizedEmail.replace(/[^a-z0-9]/g, '_');

  const doc = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();
  return doc.exists;
}

/**
 * Save contact to Firestore
 */
async function saveContact(contactData) {
  const docId = contactData.email.replace(/[^a-z0-9]/g, '_');

  await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set({
    ...contactData,
    sent: false,
    status: 'pending',
    source: 'fuxion_serpapi',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return docId;
}

/**
 * Mark distributor as searched
 */
async function markAsSearched(docId, foundEmail, email = null) {
  await db.collection(CONFIG.DISCOVERED_COLLECTION).doc(docId).update({
    emailSearched: true,
    emailSearchedAt: admin.firestore.FieldValue.serverTimestamp(),
    emailFound: foundEmail,
    email: email || null,
  });
}

// ============================================================================
// STATS FUNCTION
// ============================================================================

async function showStats() {
  // Discovered URLs stats
  const totalSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .count()
    .get();

  const searchedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .where('emailSearched', '==', true)
    .count()
    .get();

  const foundSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('company', '==', 'fuxion')
    .where('emailFound', '==', true)
    .count()
    .get();

  const pendingCount = totalSnapshot.data().count - searchedSnapshot.data().count;

  // Contacts stats
  const contactsSnapshot = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('company', '==', 'FuXion')
    .get();

  let withEmail = 0;
  let sent = 0;
  let pending = 0;

  contactsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.email) withEmail++;
    if (data.sent) sent++;
    else pending++;
  });

  console.log('\n FuXion Email Search Stats\n');
  console.log('Discovered URLs (spanish_discovered_urls):');
  console.log(`  Total:         ${totalSnapshot.data().count}`);
  console.log(`  Searched:      ${searchedSnapshot.data().count}`);
  console.log(`  Found email:   ${foundSnapshot.data().count}`);
  console.log(`  Pending:       ${pendingCount}`);
  console.log('');
  console.log('Contacts (spanish_contacts where company=FuXion):');
  console.log(`  Total:      ${contactsSnapshot.size}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  Sent:       ${sent}`);
  console.log(`  Pending:    ${pending}`);

  // Show recent contacts
  if (contactsSnapshot.size > 0) {
    console.log('\nRecent contacts (last 5):');
    const recentDocs = contactsSnapshot.docs.slice(-5);
    recentDocs.forEach(doc => {
      const data = doc.data();
      console.log(`  ${data.fullName} <${data.email}>`);
    });
  }

  // Calculate yield rate
  if (searchedSnapshot.data().count > 0) {
    const yieldRate = (foundSnapshot.data().count / searchedSnapshot.data().count * 100).toFixed(1);
    console.log(`\nEmail yield rate: ${yieldRate}%`);
  }
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function runSearch(options = {}) {
  const { maxSearches = CONFIG.DEFAULT_MAX, dryRun = false } = options;

  if (!CONFIG.SERPAPI_KEY) {
    console.error('ERROR: SERPAPI_KEY environment variable not set');
    console.error('Set it with: export SERPAPI_KEY=your_key_here');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('FUXION EMAIL SEARCH (SerpAPI)');
  console.log('============================================================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max searches: ${maxSearches}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const distributors = await getPendingDistributors(maxSearches);
  console.log(`Found ${distributors.length} distributors to search\n`);

  if (distributors.length === 0) {
    console.log('No pending distributors. Search complete!');
    return { processed: 0, found: 0, duplicates: 0, notFound: 0 };
  }

  let processed = 0;
  let found = 0;
  let duplicates = 0;
  let notFound = 0;

  for (const dist of distributors) {
    processed++;
    console.log(`[${processed}/${distributors.length}] Searching ${dist.distributorId}`);

    const emails = await searchDistributorEmail(dist.distributorId);

    if (emails.length > 0) {
      const email = emails[0];  // Use first found email
      console.log(`    Found: ${email}`);

      // Check for duplicates
      const exists = await contactExists(email);
      if (exists) {
        console.log(`    Duplicate: ${email}`);
        duplicates++;
        if (!dryRun) {
          await markAsSearched(dist.docId, true, email);
        }
      } else {
        const { firstName, lastName, fullName } = parseDistributorId(dist.distributorId);

        if (!dryRun) {
          await saveContact({
            firstName,
            lastName,
            fullName,
            email: email.toLowerCase().trim(),
            distributorId: dist.distributorId,
            language: 'es',
            profileUrl: dist.profileUrl,
            company: 'FuXion',
          });
          await markAsSearched(dist.docId, true, email);
        }
        found++;
      }
    } else {
      console.log(`    No email found`);
      notFound++;
      if (!dryRun) {
        await markAsSearched(dist.docId, false);
      }
    }

    // Delay between searches
    if (processed < distributors.length) {
      await delay(CONFIG.DELAY_BETWEEN_SEARCHES);
    }
  }

  console.log('\n============================================================');
  console.log('SEARCH COMPLETE');
  console.log('============================================================');
  console.log(`Processed:  ${processed}`);
  console.log(`Found:      ${found}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Not found:  ${notFound}`);
  console.log(`Yield rate: ${(found / processed * 100).toFixed(1)}%`);
  console.log('============================================================');

  return { processed, found, duplicates, notFound };
}

// ============================================================================
// TEST SINGLE DISTRIBUTOR
// ============================================================================

async function testDistributor(distributorId) {
  if (!CONFIG.SERPAPI_KEY) {
    console.error('ERROR: SERPAPI_KEY environment variable not set');
    process.exit(1);
  }

  console.log('============================================================');
  console.log('FUXION EMAIL SEARCH - TEST MODE');
  console.log('============================================================');
  console.log(`Testing distributor: ${distributorId}\n`);

  const emails = await searchDistributorEmail(distributorId);

  if (emails.length > 0) {
    console.log('\nFound emails:');
    emails.forEach(email => console.log(`  ${email}`));

    const { firstName, lastName, fullName } = parseDistributorId(distributorId);
    console.log('\nParsed name:');
    console.log(`  First: ${firstName}`);
    console.log(`  Last:  ${lastName}`);
    console.log(`  Full:  ${fullName}`);
  } else {
    console.log('\nNo emails found');
  }

  return emails;
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  initFirebase();

  if (args.includes('--stats')) {
    await showStats();
    return;
  }

  if (args.includes('--test')) {
    const idArg = args.find(a => a.startsWith('--id='));
    const distributorId = idArg ? idArg.split('=')[1] : 'CarlosTorres';
    await testDistributor(distributorId);
    return;
  }

  if (args.includes('--search')) {
    const maxArg = args.find(a => a.startsWith('--max='));
    const maxSearches = maxArg ? parseInt(maxArg.split('=')[1]) : CONFIG.DEFAULT_MAX;
    const dryRun = args.includes('--dry-run');

    await runSearch({ maxSearches, dryRun });
    return;
  }

  // Default: show usage
  console.log(`
FuXion Email Search (SerpAPI)

Since FuXion's website blocks automated scraping, this script uses Google
search via SerpAPI to find distributor email addresses from public sources.

Usage:
  node scripts/fuxion-email-search.js --search              # Search for emails
  node scripts/fuxion-email-search.js --search --max=50     # Limit to 50
  node scripts/fuxion-email-search.js --test --id=ID        # Test single distributor
  node scripts/fuxion-email-search.js --stats               # Show stats
  node scripts/fuxion-email-search.js --dry-run             # Preview only

Environment:
  SERPAPI_KEY    Your SerpAPI API key (required)
`);
}

main().catch(console.error);
