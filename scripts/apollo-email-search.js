#!/usr/bin/env node
/**
 * Apollo Email Search (SerpAPI Version)
 *
 * Searches Google via SerpAPI for publicly available email addresses
 * of Apollo contacts that only have corporate emails.
 *
 * Usage:
 *   node scripts/apollo-email-search.js --search     # Search for emails
 *   node scripts/apollo-email-search.js --dry-run    # Preview only
 *   node scripts/apollo-email-search.js --stats      # Show stats
 *   node scripts/apollo-email-search.js --max=50     # Limit searches
 *   node scripts/apollo-email-search.js --import     # Import found emails to Firestore
 *
 * SerpAPI:
 *   - Uses SerpAPI for reliable Google search results
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
  // Files
  INPUT_FILE: path.join(__dirname, '../purchased-emails/apollo-needs-serpapi.json'),
  OUTPUT_FILE: path.join(__dirname, '../purchased-emails/apollo-serpapi-results.json'),
  PROGRESS_FILE: path.join(__dirname, '../purchased-emails/apollo-serpapi-progress.json'),

  // Firestore
  COLLECTION: 'apollo_contacts',

  // SerpAPI
  SERPAPI_URL: 'https://serpapi.com/search',

  // Rate limiting - SerpAPI Developer plan: 1,000 searches/hour
  DELAY_BETWEEN_SEARCHES: 4000,  // 4 seconds = ~900 searches/hour
  JITTER_MS: 500,

  // Email regex pattern
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Domains to exclude (generic, not personal emails)
  EXCLUDED_DOMAINS: [
    'example.com', 'email.com', 'company.com', 'domain.com', 'test.com',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'youtube.com',
    // MLM company domains (already have these - they bounce)
    'youngliving.com', 'itworks.com', 'herbalife.com', 'avon.com', 'lifevantage.com',
    'stelladot.com', 'shaklee.com', 'senegence.com', 'partylite.com', 'pamperedchef.com',
    'myitworks.com', '4life.com', 'nuskin.com', 'origamiowl.com', 'beachbody.com',
    'rodanandfields.com', 'arbonne.com', 'monat.com', 'melaleuca.com', 'marykay.com',
    'tupperware.com', 'primerica.com', 'amway.com', 'isagenix.com', 'plexus.com',
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

function isValidEmail(email) {
  if (!email) return false;

  const emailLower = email.toLowerCase();
  if (!emailLower.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)) {
    return false;
  }

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
    .filter((e, i, arr) => arr.indexOf(e) === i);

  return validEmails;
}

function scoreEmail(email, fullName, company) {
  let score = 0;
  const emailLower = email.toLowerCase();
  const nameParts = fullName.toLowerCase().split(/\s+/);

  for (const part of nameParts) {
    if (part.length > 2 && emailLower.includes(part)) {
      score += 10;
    }
  }

  if (company) {
    const companyParts = company.toLowerCase().split(/\s+/);
    for (const part of companyParts) {
      if (part.length > 3 && emailLower.includes(part)) {
        score += 5;
      }
    }
  }

  const domain = emailLower.split('@')[1];
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
  if (personalDomains.includes(domain)) {
    score += 8; // Personal email bonus
  } else if (!CONFIG.EXCLUDED_DOMAINS.includes(domain)) {
    score += 3; // Non-excluded domain bonus
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
      console.error('  SerpAPI rate limit exceeded - wait and retry');
    } else {
      console.error(`  SerpAPI search failed: ${error.message}`);
    }
    return null;
  }
}

async function findEmailForContact(contact) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const company = contact.company;

  if (!fullName || fullName === ' ') {
    return { email: null, source: null };
  }

  // Build search query
  let query;
  if (company && !['Companies', 'Unknown'].includes(company)) {
    query = `"${fullName}" "${company}" email`;
  } else {
    query = `"${fullName}" email contact`;
  }

  console.log(`  Query: ${query}`);

  const result = await searchSerpAPI(query);
  if (!result) {
    return { email: null, source: null };
  }

  if (result.error) {
    console.log(`  SerpAPI error: ${result.error}`);
    return { email: null, source: 'error' };
  }

  const allEmails = [];

  // Extract emails from organic search results
  if (result.organic_results) {
    for (const item of result.organic_results) {
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

  // Check knowledge graph
  if (result.knowledge_graph) {
    const kgText = JSON.stringify(result.knowledge_graph);
    const emails = extractEmailsFromText(kgText);
    allEmails.push(...emails);
  }

  // Check answer box
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
// PROGRESS MANAGEMENT
// ============================================================================

function loadProgress() {
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    const data = JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, 'utf8'));
    return new Set(data.processedIndices || []);
  }
  return new Set();
}

function saveProgress(processedIndices) {
  fs.writeFileSync(CONFIG.PROGRESS_FILE, JSON.stringify({
    processedIndices: [...processedIndices],
    updatedAt: new Date().toISOString()
  }, null, 2));
}

function loadResults() {
  if (fs.existsSync(CONFIG.OUTPUT_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf8'));
  }
  return { found: [], notFound: [], errors: [] };
}

function saveResults(results) {
  fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify({
    ...results,
    updatedAt: new Date().toISOString()
  }, null, 2));
}

// ============================================================================
// MAIN SEARCH FUNCTION
// ============================================================================

async function searchEmails(maxContacts = 50, dryRun = false) {
  console.log('\n=== Searching Google for Apollo Contact Emails ===\n');

  // Load input data
  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    console.error(`Input file not found: ${CONFIG.INPUT_FILE}`);
    console.error('Run analyze-apollo-personal-emails.js first to generate the input file.');
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
  const contacts = inputData.contacts;

  console.log(`Total contacts in input file: ${contacts.length}`);

  // Load progress
  const processedIndices = loadProgress();
  const results = loadResults();

  console.log(`Already processed: ${processedIndices.size}`);
  console.log(`Found: ${results.found.length}, Not found: ${results.notFound.length}`);

  // Find contacts to process
  const toProcess = [];
  for (let i = 0; i < contacts.length && toProcess.length < maxContacts; i++) {
    if (!processedIndices.has(i)) {
      toProcess.push({ index: i, contact: contacts[i] });
    }
  }

  console.log(`Contacts to process in this run: ${toProcess.length}\n`);

  let searched = 0;
  let found = 0;

  for (const { index, contact } of toProcess) {
    const fullName = `${contact.firstName} ${contact.lastName}`.trim();
    console.log(`\nSearching: ${fullName} (${contact.company || 'No company'})`);

    if (dryRun) {
      console.log('  [DRY RUN] Would search Google');
      searched++;
      await sleep(500);
      continue;
    }

    const result = await findEmailForContact(contact);

    // Mark as processed
    processedIndices.add(index);

    if (result.email) {
      results.found.push({
        ...contact,
        email: result.email,
        emailSource: result.source,
        emailScore: result.score
      });
      console.log(`  Found: ${result.email} (score: ${result.score})`);
      found++;
    } else {
      results.notFound.push(contact);
      console.log('  No email found');
    }

    // Save progress after each search
    saveProgress(processedIndices);
    saveResults(results);

    searched++;
    await sleep(randomDelay());
  }

  console.log(`\n=== Search Complete ===`);
  console.log(`Searched this run: ${searched}`);
  console.log(`Emails found this run: ${found}`);
  console.log(`Total found: ${results.found.length}`);
  console.log(`Total not found: ${results.notFound.length}`);
  console.log(`Remaining: ${contacts.length - processedIndices.size}`);
  console.log(`Overall yield: ${processedIndices.size > 0 ? ((results.found.length / processedIndices.size) * 100).toFixed(1) : 0}%`);
  console.log('');

  return { searched, found };
}

// ============================================================================
// IMPORT TO FIRESTORE
// ============================================================================

async function importToFirestore() {
  console.log('\n=== Importing Apollo Emails to Firestore ===\n');

  // Load found emails
  const results = loadResults();

  if (results.found.length === 0) {
    console.log('No emails to import. Run --search first.');
    return;
  }

  console.log(`Emails to import: ${results.found.length}`);

  // Load existing emails to avoid duplicates
  const existingEmails = new Set();

  const collections = [
    'bfh_contacts',
    'direct_sales_contacts',
    'emailCampaigns/master/contacts'
  ];

  for (const collPath of collections) {
    const parts = collPath.split('/');
    let ref;
    if (parts.length === 3) {
      ref = db.collection(parts[0]).doc(parts[1]).collection(parts[2]);
    } else {
      ref = db.collection(collPath);
    }

    const snapshot = await ref.get();
    snapshot.forEach(doc => {
      const email = doc.data().email;
      if (email) existingEmails.add(email.toLowerCase());
    });
  }

  console.log(`Existing emails across collections: ${existingEmails.size}`);

  // Import new contacts
  let imported = 0;
  let duplicates = 0;
  const batch = db.batch();

  for (const contact of results.found) {
    if (existingEmails.has(contact.email.toLowerCase())) {
      duplicates++;
      continue;
    }

    const docRef = db.collection(CONFIG.COLLECTION).doc();
    batch.set(docRef, {
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: `${contact.firstName} ${contact.lastName}`.trim(),
      company: contact.company,
      email: contact.email,
      emailSource: contact.emailSource,
      emailScore: contact.emailScore,
      originalCorporateEmail: contact.corporateEmail,
      source: 'apollo_serpapi',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sent: false,
      emailSearched: true
    });

    existingEmails.add(contact.email.toLowerCase());
    imported++;
  }

  if (imported > 0) {
    await batch.commit();
  }

  console.log(`Imported: ${imported}`);
  console.log(`Duplicates skipped: ${duplicates}`);
  console.log('');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n=== Apollo Email Search Stats ===\n');

  // Load input data
  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    console.log('Input file not found. Run analyze-apollo-personal-emails.js first.');
    return;
  }

  const inputData = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
  const processedIndices = loadProgress();
  const results = loadResults();

  console.log(`Total contacts needing search: ${inputData.contacts.length}`);
  console.log(`Processed: ${processedIndices.size}`);
  console.log(`Remaining: ${inputData.contacts.length - processedIndices.size}`);
  console.log('');
  console.log(`Emails found: ${results.found.length}`);
  console.log(`Not found: ${results.notFound.length}`);
  console.log(`Yield rate: ${processedIndices.size > 0 ? ((results.found.length / processedIndices.size) * 100).toFixed(1) : 0}%`);
  console.log('');

  // Firestore stats
  if (db) {
    const apolloCount = await db.collection(CONFIG.COLLECTION).count().get();
    console.log(`Apollo contacts in Firestore: ${apolloCount.data().count}`);
  }

  // Time estimate for remaining
  const remaining = inputData.contacts.length - processedIndices.size;
  const timeMinutes = (remaining * 4.5) / 60;
  console.log(`\nEstimated time for remaining: ${timeMinutes.toFixed(0)} minutes (~${(timeMinutes/60).toFixed(1)} hours)`);
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
  const importCmd = args.includes('--import');

  let maxContacts = 100;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxContacts = parseInt(maxArg.split('=')[1]) || 100;
  }

  if (!search && !stats && !importCmd) {
    console.log('Usage:');
    console.log('  node scripts/apollo-email-search.js --search     # Search for emails');
    console.log('  node scripts/apollo-email-search.js --stats      # Show stats');
    console.log('  node scripts/apollo-email-search.js --dry-run    # Preview only');
    console.log('  node scripts/apollo-email-search.js --max=N      # Max contacts to search');
    console.log('  node scripts/apollo-email-search.js --import     # Import found emails to Firestore');
    console.log('');
    console.log('Notes:');
    console.log('  - Rate limited to ~900 searches/hour (SerpAPI Developer plan: 1,000/hr)');
    console.log('  - Progress is saved after each search - can resume anytime');
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

  if (importCmd) {
    await importToFirestore();
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
