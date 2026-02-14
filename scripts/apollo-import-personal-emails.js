#!/usr/bin/env node
/**
 * Apollo Personal Email Importer
 *
 * Imports Apollo contacts that already have personal email addresses
 * (found in Secondary Email field) directly to Firestore.
 *
 * Usage:
 *   node scripts/apollo-import-personal-emails.js --dry-run    # Preview only
 *   node scripts/apollo-import-personal-emails.js --import     # Import to Firestore
 *   node scripts/apollo-import-personal-emails.js --stats      # Show stats
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Two sources of personal emails
  PERSONAL_EMAILS_FILE: path.join(__dirname, '../purchased-emails/apollo-personal-emails.json'),
  SERPAPI_RESULTS_FILE: path.join(__dirname, '../purchased-emails/apollo-serpapi-results.json'),
  // Target collection
  COLLECTION: 'purchased_leads',
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
// IMPORT FUNCTION
// ============================================================================

async function importContacts(dryRun = false) {
  console.log('\n=== Importing Apollo Personal Emails to Firestore ===\n');
  console.log(`Target collection: ${CONFIG.COLLECTION}\n`);

  // Load contacts from both sources
  const contacts = [];

  // Source 1: Personal emails from Apollo secondary email field
  if (fs.existsSync(CONFIG.PERSONAL_EMAILS_FILE)) {
    const personalData = JSON.parse(fs.readFileSync(CONFIG.PERSONAL_EMAILS_FILE, 'utf8'));
    console.log(`Apollo personal emails: ${personalData.contacts.length}`);
    contacts.push(...personalData.contacts);
  } else {
    console.log('Apollo personal emails file not found (skipping)');
  }

  // Source 2: SerpAPI search results
  if (fs.existsSync(CONFIG.SERPAPI_RESULTS_FILE)) {
    const serpData = JSON.parse(fs.readFileSync(CONFIG.SERPAPI_RESULTS_FILE, 'utf8'));
    console.log(`SerpAPI found emails: ${serpData.found.length}`);
    // Normalize SerpAPI results to match personal emails format
    const serpContacts = serpData.found.map(c => ({
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      email: c.email,
      title: c.title,
      source: 'serpapi',
      emailScore: c.emailScore
    }));
    contacts.push(...serpContacts);
  } else {
    console.log('SerpAPI results file not found (skipping)');
  }

  // Dedupe by email within the combined list
  const seen = new Set();
  const uniqueContacts = contacts.filter(c => {
    const email = c.email.toLowerCase();
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  console.log(`\nCombined contacts (deduped): ${uniqueContacts.length}`);

  // Load existing emails to avoid duplicates
  console.log('\nChecking for duplicates across all collections...');
  const existingEmails = new Set();

  const collections = [
    'bfh_contacts',
    'direct_sales_contacts',
    'emailCampaigns/master/contacts',
    'purchased_leads'
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
    console.log(`  ${collPath}: ${snapshot.size} contacts`);
  }

  console.log(`Total existing emails: ${existingEmails.size}\n`);

  // Categorize contacts
  const toImport = [];
  const duplicates = [];

  for (const contact of uniqueContacts) {
    if (existingEmails.has(contact.email.toLowerCase())) {
      duplicates.push(contact);
    } else {
      toImport.push(contact);
    }
  }

  console.log(`New contacts to import: ${toImport.length}`);
  console.log(`Duplicates to skip: ${duplicates.length}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would import the following contacts:\n');
    toImport.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i+1}. ${c.firstName} ${c.lastName} <${c.email}> (${c.company})`);
    });
    if (toImport.length > 10) {
      console.log(`  ... and ${toImport.length - 10} more`);
    }
    return { imported: 0, duplicates: duplicates.length, dryRun: true };
  }

  // Import in batches of 500 (Firestore limit)
  const BATCH_SIZE = 500;
  let imported = 0;

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchContacts = toImport.slice(i, i + BATCH_SIZE);

    for (const contact of batchContacts) {
      const docRef = db.collection(CONFIG.COLLECTION).doc();
      const docData = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: `${contact.firstName} ${contact.lastName}`.trim(),
        company: contact.company,
        email: contact.email,
        title: contact.title || null,
        source: contact.source, // 'apollo_secondary' or 'serpapi'
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
        emailSearched: true // Already have verified email
      };
      // Add email score for SerpAPI results (higher = more confident)
      if (contact.emailScore) {
        docData.emailScore = contact.emailScore;
      }
      batch.set(docRef, docData);
    }

    await batch.commit();
    imported += batchContacts.length;
    console.log(`  Imported batch: ${imported}/${toImport.length}`);
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Duplicates skipped: ${duplicates.length}`);

  return { imported, duplicates: duplicates.length };
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n=== Purchased Leads Stats ===\n');

  // Input file stats
  if (fs.existsSync(CONFIG.PERSONAL_EMAILS_FILE)) {
    const inputData = JSON.parse(fs.readFileSync(CONFIG.PERSONAL_EMAILS_FILE, 'utf8'));
    console.log(`Apollo personal emails file: ${inputData.contacts.length}`);
  }
  if (fs.existsSync(CONFIG.SERPAPI_RESULTS_FILE)) {
    const serpData = JSON.parse(fs.readFileSync(CONFIG.SERPAPI_RESULTS_FILE, 'utf8'));
    console.log(`SerpAPI found emails file: ${serpData.found.length}`);
  }

  // Firestore stats
  const snapshot = await db.collection(CONFIG.COLLECTION).get();
  console.log(`\n${CONFIG.COLLECTION} in Firestore: ${snapshot.size}`);

  // Count by source
  const bySource = {};
  snapshot.forEach(doc => {
    const source = doc.data().source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });

  console.log('\nBy source:');
  Object.entries(bySource).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  // Count sent status
  let sent = 0;
  let unsent = 0;
  snapshot.forEach(doc => {
    if (doc.data().sent) sent++;
    else unsent++;
  });

  console.log(`\nSent: ${sent}`);
  console.log(`Unsent: ${unsent}`);
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const importCmd = args.includes('--import');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  if (!importCmd && !dryRun && !stats) {
    console.log('Usage:');
    console.log('  node scripts/apollo-import-personal-emails.js --dry-run    # Preview only');
    console.log('  node scripts/apollo-import-personal-emails.js --import     # Import to Firestore');
    console.log('  node scripts/apollo-import-personal-emails.js --stats      # Show stats');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (importCmd || dryRun) {
    await importContacts(dryRun);
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
