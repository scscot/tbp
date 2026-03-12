#!/usr/bin/env node
/**
 * MLM Email Enrichment - SerpAPI-based email discovery
 *
 * Enriches mlm_contacts that have name + company but no email by searching
 * Google via SerpAPI for publicly available contact information.
 *
 * This bridges the gap between social media signals (which find names/companies
 * but rarely expose emails) and campaign-ready contacts.
 *
 * Usage:
 *   node scripts/mlm-email-enrichment.js --enrich               # Enrich contacts
 *   node scripts/mlm-email-enrichment.js --enrich --max=50      # Limit searches
 *   node scripts/mlm-email-enrichment.js --stats                # Show stats
 *   node scripts/mlm-email-enrichment.js --dry-run              # Preview only
 *
 * Query Pattern:
 *   "{firstName} {lastName}" "{company}" email
 *
 * Expected Yield: 10-30% based on BFH email search results
 */

const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load SerpAPI key
const SECRETS_PATH = path.join(__dirname, '../secrets');
const SERPAPI_KEY = fs.existsSync(path.join(SECRETS_PATH, 'SerpAPI-Key'))
  ? fs.readFileSync(path.join(SECRETS_PATH, 'SerpAPI-Key'), 'utf8').trim()
  : null;

const CONFIG = {
  // Firestore
  CONTACTS_COLLECTION: 'mlm_contacts',

  // SerpAPI
  SERPAPI_URL: 'https://serpapi.com/search',

  // Rate limiting - SerpAPI Developer plan: 1,000 searches/hour
  DELAY_BETWEEN_SEARCHES: 4000,  // 4 seconds = ~900 searches/hour
  JITTER_MS: 500,

  // Email regex pattern
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Domains to exclude (generic/not useful)
  EXCLUDED_DOMAINS: [
    'example.com', 'email.com', 'company.com', 'domain.com', 'test.com',
    'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
    'youtube.com', 'google.com', 'tiktok.com', 'threads.net',
    'wixsite.com', 'wordpress.com', 'shopify.com', 'squarespace.com',
  ],

  // Non-personal email prefixes to exclude (corporate/generic)
  EXCLUDED_PREFIXES: [
    'support', 'help', 'helpdesk', 'customerservice', 'customer-service',
    'info', 'information', 'contact', 'contactus', 'hello', 'hi',
    'sales', 'marketing', 'promotions', 'promo', 'advertising', 'press',
    'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
    'hr', 'humanresources', 'careers', 'jobs', 'recruiting', 'talent',
    'billing', 'finance', 'accounting', 'accounts', 'payments',
    'legal', 'compliance', 'privacy', 'abuse', 'dmca', 'copyright',
    'noreply', 'no-reply', 'donotreply', 'notifications', 'alerts',
    'news', 'newsletter', 'updates', 'team', 'office', 'general',
    'orders', 'shipping', 'returns', 'refunds', 'feedback', 'complaints',
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

  // Check format
  if (!emailLower.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/)) {
    return false;
  }

  // Check excluded domains
  const [localPart, domain] = emailLower.split('@');
  if (CONFIG.EXCLUDED_DOMAINS.includes(domain)) {
    return false;
  }

  // Check excluded prefixes (corporate/non-personal)
  if (CONFIG.EXCLUDED_PREFIXES.includes(localPart)) {
    return false;
  }

  // Also check prefixes with trailing numbers (e.g., support1, info2)
  const basePrefix = localPart.replace(/[0-9]+$/, '');
  if (CONFIG.EXCLUDED_PREFIXES.includes(basePrefix)) {
    return false;
  }

  return true;
}

function extractEmailsFromText(text) {
  if (!text) return [];

  const matches = text.match(CONFIG.EMAIL_REGEX) || [];
  return matches
    .map(e => e.toLowerCase())
    .filter(isValidEmail)
    .filter((e, i, arr) => arr.indexOf(e) === i); // Unique
}

function scoreEmail(email, firstName, lastName, company) {
  let score = 0;
  const emailLower = email.toLowerCase();

  // Check if email contains name parts
  if (firstName && firstName.length > 2) {
    if (emailLower.includes(firstName.toLowerCase())) {
      score += 15; // Strong signal
    }
  }

  if (lastName && lastName.length > 2) {
    if (emailLower.includes(lastName.toLowerCase())) {
      score += 10;
    }
  }

  // Check if email contains company name parts
  if (company) {
    const companyParts = company.toLowerCase().split(/\s+/);
    for (const part of companyParts) {
      if (part.length > 3 && emailLower.includes(part)) {
        score += 5;
      }
    }
  }

  // Prefer personal email providers for individuals
  const domain = emailLower.split('@')[1];
  if (['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
    score += 3; // Personal email bonus for individuals
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
      console.error('  SerpAPI rate limit - waiting before retry');
    } else {
      console.error(`  SerpAPI search failed: ${error.message}`);
    }
    return null;
  }
}

async function findEmailForContact(contact) {
  const { firstName, lastName, fullName, company } = contact;

  // Need at least a name to search
  const name = fullName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName);
  if (!name) {
    return { email: null, source: null, reason: 'no_name' };
  }

  // Build search query
  let query;
  if (company) {
    query = `"${name}" "${company}" email`;
  } else {
    query = `"${name}" "direct sales" OR "network marketing" email`;
  }

  console.log(`  Query: ${query}`);

  const result = await searchSerpAPI(query);
  if (!result) {
    return { email: null, source: null, reason: 'api_error' };
  }

  if (result.error) {
    console.log(`  SerpAPI error: ${result.error}`);
    return { email: null, source: 'error', reason: result.error };
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
    return { email: null, source: null, reason: 'no_email_found' };
  }

  // Score and select best email
  const uniqueEmails = [...new Set(allEmails)];
  let bestEmail = uniqueEmails[0];
  let bestScore = scoreEmail(bestEmail, firstName, lastName, company);

  for (const email of uniqueEmails.slice(1)) {
    const score = scoreEmail(email, firstName, lastName, company);
    if (score > bestScore) {
      bestEmail = email;
      bestScore = score;
    }
  }

  return { email: bestEmail, source: 'serpapi_enrichment', score: bestScore };
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

async function enrichContacts(maxContacts = 50, dryRun = false) {
  if (!SERPAPI_KEY) {
    console.error('SerpAPI key not found at secrets/SerpAPI-Key');
    process.exit(1);
  }

  console.log(`\n=== MLM Email Enrichment ===\n`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max contacts: ${maxContacts}`);

  // Query contacts that need enrichment:
  // - Have a name (firstName or fullName)
  // - No email
  // - Not already searched for email
  const query = db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '==', null)
    .where('emailEnriched', '==', false)
    .limit(maxContacts);

  const snapshot = await query.get();

  if (snapshot.empty) {
    // Try alternate query - contacts without emailEnriched field
    const altQuery = db.collection(CONFIG.CONTACTS_COLLECTION)
      .where('email', '==', null)
      .limit(maxContacts);

    const altSnapshot = await altQuery.get();

    // Filter to those without emailEnriched field and with a name
    const needsEnrichment = altSnapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.emailEnriched && (data.firstName || data.fullName || data.name);
    });

    if (needsEnrichment.length === 0) {
      console.log('No contacts need email enrichment');
      return { searched: 0, found: 0, failed: 0 };
    }

    return await processContacts(needsEnrichment, dryRun);
  }

  // Filter to contacts with names
  const contactsWithNames = snapshot.docs.filter(doc => {
    const data = doc.data();
    return data.firstName || data.fullName || data.name;
  });

  if (contactsWithNames.length === 0) {
    console.log('No contacts with names need email enrichment');
    return { searched: 0, found: 0, failed: 0 };
  }

  return await processContacts(contactsWithNames, dryRun);
}

async function processContacts(docs, dryRun) {
  console.log(`\nProcessing ${docs.length} contacts...\n`);

  let searched = 0;
  let found = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const data = doc.data();

    const displayName = data.fullName || data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim();
    console.log(`[${i + 1}/${docs.length}] ${displayName} (${data.company || 'no company'})`);

    searched++;

    const result = await findEmailForContact(data);

    if (result.email) {
      console.log(`  ✓ Found: ${result.email} (score: ${result.score})`);
      found++;

      if (!dryRun) {
        await doc.ref.update({
          email: result.email,
          emailSource: result.source,
          emailScore: result.score,
          emailEnriched: true,
          emailEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      console.log(`  ✗ No email found (${result.reason || 'unknown'})`);
      failed++;

      if (!dryRun) {
        await doc.ref.update({
          emailEnriched: true,
          emailEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
          emailEnrichmentResult: result.reason || 'no_email_found',
        });
      }
    }

    // Rate limiting
    if (i < docs.length - 1) {
      await sleep(randomDelay());
    }
  }

  console.log(`\n=== Enrichment Summary ===`);
  console.log(`Searched: ${searched}`);
  console.log(`Found: ${found} (${searched > 0 ? Math.round(found / searched * 100) : 0}%)`);
  console.log(`Failed: ${failed}`);

  return { searched, found, failed };
}

async function showStats() {
  console.log(`\n=== MLM Contacts Statistics ===\n`);

  const totalSnap = await db.collection(CONFIG.CONTACTS_COLLECTION).count().get();
  console.log(`Total contacts: ${totalSnap.data().count}`);

  // Contacts with email
  const withEmailSnap = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '!=', null)
    .count().get();
  console.log(`With email: ${withEmailSnap.data().count}`);

  // Contacts needing enrichment (no email, not yet searched)
  const noEmailSnap = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '==', null)
    .count().get();
  console.log(`Without email: ${noEmailSnap.data().count}`);

  // Contacts that were enriched but no email found
  const enrichedNoEmailSnap = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('emailEnriched', '==', true)
    .where('email', '==', null)
    .count().get();
  console.log(`Enriched (no result): ${enrichedNoEmailSnap.data().count}`);

  // Contacts found via enrichment
  const enrichedFoundSnap = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('emailSource', '==', 'serpapi_enrichment')
    .count().get();
  console.log(`Found via enrichment: ${enrichedFoundSnap.data().count}`);

  // Contacts ready for campaign (have email, not sent)
  const readySnap = await db.collection(CONFIG.CONTACTS_COLLECTION)
    .where('email', '!=', null)
    .where('sent', '==', false)
    .count().get();
  console.log(`Ready for campaign: ${readySnap.data().count}`);
}

// ============================================================================
// CLI HANDLING
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
MLM Email Enrichment - Find emails for contacts using SerpAPI

Usage:
  node scripts/mlm-email-enrichment.js --enrich               # Enrich contacts
  node scripts/mlm-email-enrichment.js --enrich --max=50      # Limit searches
  node scripts/mlm-email-enrichment.js --stats                # Show stats
  node scripts/mlm-email-enrichment.js --dry-run              # Preview only

Options:
  --enrich          Run email enrichment
  --max=N           Limit to N contacts (default: 50)
  --dry-run         Preview only, don't update Firestore
  --stats           Show collection statistics
`);
    return;
  }

  initFirebase();

  const dryRun = args.includes('--dry-run');
  const maxArg = args.find(a => a.startsWith('--max='));
  const maxContacts = maxArg ? parseInt(maxArg.split('=')[1]) : 50;

  if (args.includes('--stats')) {
    await showStats();
  } else if (args.includes('--enrich')) {
    await enrichContacts(maxContacts, dryRun);
  } else {
    console.log('Unknown command. Use --help for usage.');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
