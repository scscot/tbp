#!/usr/bin/env node
/**
 * Business For Home Email Search
 *
 * Searches Google for publicly available email addresses of BFH contacts.
 * Uses the "{name}" "{company}" email search pattern.
 *
 * Usage:
 *   node scripts/bfh-email-search.js --search     # Search for emails
 *   node scripts/bfh-email-search.js --dry-run    # Preview only
 *   node scripts/bfh-email-search.js --stats      # Show stats
 *   node scripts/bfh-email-search.js --max=50     # Limit searches
 *
 * Rate Limiting:
 *   - 3-5 seconds between searches to avoid Google blocking
 *   - If blocked, wait and retry with exponential backoff
 */

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore
  COLLECTION: 'bfh_contacts',

  // Google Search
  GOOGLE_SEARCH_URL: 'https://www.google.com/search',

  // Rate limiting (conservative to avoid blocking)
  DELAY_BETWEEN_SEARCHES: 4000,  // 4 seconds base
  JITTER_MS: 2000,               // 0-2 seconds random jitter
  MAX_RETRIES: 3,
  BACKOFF_MULTIPLIER: 2,

  // User agents (rotate to avoid detection)
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ],

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

function getRandomUserAgent() {
  const index = Math.floor(Math.random() * CONFIG.USER_AGENTS.length);
  return CONFIG.USER_AGENTS[index];
}

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
// GOOGLE SEARCH
// ============================================================================

async function searchGoogle(query, retryCount = 0) {
  try {
    const response = await axios.get(CONFIG.GOOGLE_SEARCH_URL, {
      params: {
        q: query,
        num: 10,
      },
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 429 || error.response?.status === 503) {
      // Rate limited - backoff and retry
      if (retryCount < CONFIG.MAX_RETRIES) {
        const backoffMs = CONFIG.DELAY_BETWEEN_SEARCHES * Math.pow(CONFIG.BACKOFF_MULTIPLIER, retryCount + 1);
        console.log(`  Rate limited, waiting ${backoffMs / 1000}s before retry ${retryCount + 1}...`);
        await sleep(backoffMs);
        return searchGoogle(query, retryCount + 1);
      }
    }
    console.error(`  Search failed: ${error.message}`);
    return null;
  }
}

async function findEmailForContact(contact) {
  const { fullName, company } = contact;

  if (!fullName) {
    return { email: null, source: null };
  }

  // Build search queries
  const queries = [];

  // Primary query: name + company + email
  if (company) {
    queries.push(`"${fullName}" "${company}" email`);
    queries.push(`"${fullName}" "${company}" contact`);
  }

  // Fallback: just name + email
  queries.push(`"${fullName}" email contact`);

  const allEmails = [];

  for (const query of queries) {
    console.log(`  Query: ${query}`);

    const html = await searchGoogle(query);
    if (!html) {
      await sleep(randomDelay());
      continue;
    }

    // Parse search results
    const $ = cheerio.load(html);

    // Check for CAPTCHA/blocking
    if (html.includes('unusual traffic') || html.includes('not a robot')) {
      console.log('  WARNING: Google CAPTCHA detected, stopping search');
      return { email: null, source: 'blocked' };
    }

    // Extract text from search result snippets
    const snippetText = [];
    $('div.g').each((_, el) => {
      const snippet = $(el).text();
      snippetText.push(snippet);
    });

    // Also check the whole page
    snippetText.push($('body').text());

    // Find emails in snippets
    for (const text of snippetText) {
      const emails = extractEmailsFromText(text);
      allEmails.push(...emails);
    }

    // If we found emails, no need to try more queries
    if (allEmails.length > 0) {
      break;
    }

    await sleep(randomDelay());
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

  return { email: bestEmail, source: 'google', score: bestScore };
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
    console.log('  - Uses 4-6 second delays between searches to avoid Google blocking');
    console.log('  - Expected email yield: 10-30% of contacts');
    console.log('  - If blocked, script will stop and can be resumed later');
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
