#!/usr/bin/env node
/**
 * Business For Home Email Search (SerpAPI Version)
 *
 * Searches Google via SerpAPI for publicly available email addresses of BFH contacts.
 * Uses the "{name}" "{company}" email search pattern.
 *
 * Usage:
 *   node scripts/bfh-email-search.js --search     # Search for emails
 *   node scripts/bfh-email-search.js --dry-run    # Preview only
 *   node scripts/bfh-email-search.js --stats      # Show stats
 *   node scripts/bfh-email-search.js --max=50     # Limit searches
 *
 * SerpAPI:
 *   - Uses SerpAPI for reliable Google search results
 *   - API key loaded from secrets/SerpAPI-Key
 *   - Developer plan: 5,000 searches/month, 1,000/hour throughput
 */

const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load SerpAPI key
const SERPAPI_KEY = fs.readFileSync(
  path.join(__dirname, '../secrets/SerpAPI-Key'),
  'utf8'
).trim();

const CONFIG = {
  // Firestore
  COLLECTION: 'bfh_contacts',

  // SerpAPI
  SERPAPI_URL: 'https://serpapi.com/search',

  // Rate limiting - SerpAPI Developer plan: 1,000 searches/hour
  // 1,000 searches / 60 minutes = 16.67/min, so ~3.6 seconds between searches
  DELAY_BETWEEN_SEARCHES: 4000,  // 4 seconds = ~900 searches/hour (under 1,000 limit)
  JITTER_MS: 500,

  // Email regex pattern
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Domains to exclude (generic, not personal emails)
  EXCLUDED_DOMAINS: [
    'example.com',
    'email.com',
    'company.com',
    'domain.com',
    'test.com',
    'businessforhome.org',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com',
    'google.com',
    'gmail.com',  // Too generic without name validation
    'yahoo.com',  // Too generic without name validation
    'hotmail.com', // Too generic without name validation
    'outlook.com', // Too generic without name validation
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

function randomDelay() {
  const jitter = Math.random() * CONFIG.JITTER_MS;
  return CONFIG.DELAY_BETWEEN_SEARCHES + jitter;
}

// User agent rotation removed - SerpAPI handles this

function isValidEmail(email) {
  if (!email) return false;

  // Check format
  const emailLower = email.toLowerCase();
  if (!emailLower.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)) {
    return false;
  }

  // Check excluded domains
  const domain = emailLower.split('@')[1];
  if (CONFIG.EXCLUDED_DOMAINS.includes(domain)) {
    return false;
  }

  return true;
}

function extractEmailsFromText(text) {
  if (!text) return [];

  const matches = text.match(CONFIG.EMAIL_REGEX) || [];
  const validEmails = matches
    .map(e => e.toLowerCase())
    .filter(isValidEmail)
    .filter((e, i, arr) => arr.indexOf(e) === i); // Unique

  return validEmails;
}

function scoreEmail(email, fullName, company) {
  let score = 0;
  const emailLower = email.toLowerCase();
  const nameParts = fullName.toLowerCase().split(/\s+/);

  // Check if email contains name parts
  for (const part of nameParts) {
    if (part.length > 2 && emailLower.includes(part)) {
      score += 10;
    }
  }

  // Check if email contains company name
  if (company) {
    const companyParts = company.toLowerCase().split(/\s+/);
    for (const part of companyParts) {
      if (part.length > 3 && emailLower.includes(part)) {
        score += 5;
      }
    }
  }

  // Prefer professional domains
  const domain = emailLower.split('@')[1];
  if (!['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'].includes(domain)) {
    score += 3; // Custom domain bonus
  }

  return score;
}

// ============================================================================
// SERPAPI SEARCH
// ============================================================================

async function searchSerpAPI(query) {
  try {
    const response = await axios.get(CONFIG.SERPAPI_URL, {
      params: {
        q: query,
        api_key: SERPAPI_KEY,
        engine: 'google',
        num: 10,
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('  SerpAPI authentication failed - check API key');
    } else if (error.response?.status === 429) {
      console.error('  SerpAPI hourly throughput limit (200/hr) - wait and retry');
    } else {
      console.error(`  SerpAPI search failed: ${error.message}`);
    }
    return null;
  }
}

async function findEmailForContact(contact) {
  const { fullName, company } = contact;

  if (!fullName) {
    return { email: null, source: null };
  }

  // Build search query - use one optimized query to conserve API credits
  let query;
  if (company && company !== 'Companies') {
    // Include company if it's valid (not the nav link artifact)
    query = `"${fullName}" "${company}" email`;
  } else {
    query = `"${fullName}" email contact`;
  }

  console.log(`  Query: ${query}`);

  const result = await searchSerpAPI(query);
  if (!result) {
    return { email: null, source: null };
  }

  // Check for API errors
  if (result.error) {
    console.log(`  SerpAPI error: ${result.error}`);
    return { email: null, source: 'error' };
  }

  const allEmails = [];

  // Extract emails from organic search results
  if (result.organic_results) {
    for (const item of result.organic_results) {
      // Check title, snippet, and link
      const texts = [
        item.title || '',
        item.snippet || '',
        item.link || '',
      ];

      for (const text of texts) {
        const emails = extractEmailsFromText(text);
        allEmails.push(...emails);
      }
    }
  }

  // Also check knowledge graph if present
  if (result.knowledge_graph) {
    const kgText = JSON.stringify(result.knowledge_graph);
    const emails = extractEmailsFromText(kgText);
    allEmails.push(...emails);
  }

  // Check answer box if present
  if (result.answer_box) {
    const abText = JSON.stringify(result.answer_box);
    const emails = extractEmailsFromText(abText);
    allEmails.push(...emails);
  }

  if (allEmails.length === 0) {
    return { email: null, source: null };
  }

  // Score and select best email
  const uniqueEmails = [...new Set(allEmails)];
  let bestEmail = uniqueEmails[0];
  let bestScore = scoreEmail(bestEmail, fullName, company);

  for (const email of uniqueEmails.slice(1)) {
    const score = scoreEmail(email, fullName, company);
    if (score > bestScore) {
      bestEmail = email;
      bestScore = score;
    }
  }

  return { email: bestEmail, source: 'serpapi', score: bestScore };
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchEmails(maxContacts = 50, dryRun = false) {
  console.log('\n=== Searching Google for BFH Contact Emails ===\n');

  // Get scraped contacts without email search
  const query = db.collection(CONFIG.COLLECTION)
    .where('bfhScraped', '==', true)
    .where('emailSearched', '==', false)
    .limit(maxContacts);

  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} contacts to search\n`);

  let searched = 0;
  let found = 0;
  let blocked = false;

  for (const doc of snapshot.docs) {
    if (blocked) {
      console.log('Stopping due to Google blocking');
      break;
    }

    const data = doc.data();
    console.log(`\nSearching: ${data.fullName} (${data.company || 'No company'})`);

    if (dryRun) {
      console.log('  [DRY RUN] Would search Google');
      searched++;
      await sleep(500);
      continue;
    }

    const result = await findEmailForContact(data);

    if (result.source === 'blocked') {
      blocked = true;
      continue;
    }

    // Update document
    const updateData = {
      emailSearched: true,
      emailSearchedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (result.email) {
      updateData.email = result.email;
      updateData.emailSource = result.source;
      console.log(`  Found: ${result.email} (score: ${result.score})`);
      found++;
    } else {
      console.log('  No email found');
    }

    await doc.ref.update(updateData);
    searched++;

    // Rate limit
    await sleep(randomDelay());
  }

  console.log(`\n=== Search Complete ===`);
  console.log(`Searched: ${searched}`);
  console.log(`Emails found: ${found}`);
  console.log(`Success rate: ${searched > 0 ? ((found / searched) * 100).toFixed(1) : 0}%`);
  if (blocked) {
    console.log('WARNING: Search stopped due to Google blocking');
  }
  console.log('');

  return { searched, found, blocked };
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.COLLECTION);

  const [total, scraped, searched, withEmail, sent] = await Promise.all([
    collection.count().get(),
    collection.where('bfhScraped', '==', true).count().get(),
    collection.where('emailSearched', '==', true).count().get(),
    collection.where('email', '!=', null).count().get(),
    collection.where('sent', '==', true).count().get(),
  ]);

  console.log('\n=== BFH Contacts Stats ===');
  console.log(`Total contacts: ${total.data().count}`);
  console.log(`BFH scraped: ${scraped.data().count}`);
  console.log(`Email searched: ${searched.data().count}`);
  console.log(`With email: ${withEmail.data().count}`);
  console.log(`Emails sent: ${sent.data().count}`);

  // Calculate yield rate
  const searchedCount = searched.data().count;
  const withEmailCount = withEmail.data().count;
  if (searchedCount > 0) {
    console.log(`Email yield rate: ${((withEmailCount / searchedCount) * 100).toFixed(1)}%`);
  }
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const search = args.includes('--search');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  // Parse --max=N
  let maxContacts = 50;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxContacts = parseInt(maxArg.split('=')[1]) || 50;
  }

  if (!search && !stats) {
    console.log('Usage:');
    console.log('  node scripts/bfh-email-search.js --search     # Search for emails');
    console.log('  node scripts/bfh-email-search.js --stats      # Show stats');
    console.log('  node scripts/bfh-email-search.js --dry-run    # Preview only');
    console.log('  node scripts/bfh-email-search.js --max=N      # Max contacts to search');
    console.log('');
    console.log('Notes:');
    console.log('  - Rate limited to ~900 searches/hour (SerpAPI Developer plan: 1,000/hr)');
    console.log('  - 100 contacts @ 4s each = ~7 minutes to complete');
    console.log('  - Expected email yield: 29% high-quality emails');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (search) {
    await searchEmails(maxContacts, dryRun);
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
