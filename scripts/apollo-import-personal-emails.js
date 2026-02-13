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
  INPUT_FILE: path.join(__dirname, '../purchased-emails/apollo-personal-emails.json'),
  COLLECTION: 'apollo_contacts',
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

  // Load input data
  if (!fs.existsSync(CONFIG.INPUT_FILE)) {
    console.error(`Input file not found: ${CONFIG.INPUT_FILE}`);
    console.error('Run analyze-apollo-personal-emails.js first to generate the input file.');
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
  const contacts = inputData.contacts;

  console.log(`Contacts to import: ${contacts.length}`);

  // Load existing emails to avoid duplicates
  console.log('\nChecking for duplicates across all collections...');
  const existingEmails = new Set();

  const collections = [
    'bfh_contacts',
    'direct_sales_contacts',
    'emailCampaigns/master/contacts',
    'apollo_contacts'
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

  for (const contact of contacts) {
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
      batch.set(docRef, {
        firstName: contact.firstName,
        lastName: contact.lastName,
        fullName: `${contact.firstName} ${contact.lastName}`.trim(),
        company: contact.company,
        email: contact.email,
        title: contact.title || null,
        source: contact.source, // 'apollo_secondary' or 'apollo_primary'
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
        emailSearched: true // Already have verified email
      });
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
  console.log('\n=== Apollo Personal Email Stats ===\n');

  // Input file stats
  if (fs.existsSync(CONFIG.INPUT_FILE)) {
    const inputData = JSON.parse(fs.readFileSync(CONFIG.INPUT_FILE, 'utf8'));
    console.log(`Input file contacts: ${inputData.contacts.length}`);
    console.log(`Generated at: ${inputData.generatedAt}`);
  } else {
    console.log('Input file not found.');
  }

  // Firestore stats
  const apolloSnapshot = await db.collection(CONFIG.COLLECTION).get();
  console.log(`\nApollo contacts in Firestore: ${apolloSnapshot.size}`);

  // Count by source
  const bySourse = {};
  apolloSnapshot.forEach(doc => {
    const source = doc.data().source || 'unknown';
    bySourse[source] = (bySourse[source] || 0) + 1;
  });

  console.log('\nBy source:');
  Object.entries(bySourse).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  // Count sent status
  let sent = 0;
  let unsent = 0;
  apolloSnapshot.forEach(doc => {
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
