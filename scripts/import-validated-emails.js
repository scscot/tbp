#!/usr/bin/env node
/**
 * Import SMTP-validated emails to Firestore
 *
 * Imports valid emails from smtp_validated/valid_emails.csv to
 * emailCampaigns/master/contacts collection.
 *
 * Features:
 * - Generates randomIndex (0-1) for each contact for queue ordering
 * - Sets sent=false, status='pending' for new contacts
 * - Skips contacts that already exist in Firestore (won't overwrite sent contacts)
 * - Batch processing (500 per batch) for efficiency
 *
 * Usage:
 *   node import-validated-emails.js              # Import all valid emails
 *   node import-validated-emails.js --dry-run    # Preview without importing
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Initialize Firebase
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const CONFIG = {
  inputFile: path.join(__dirname, '../emails/smtp_validated/valid_emails.csv'),
  collectionPath: 'emailCampaigns/master/contacts',
  batchSize: 500
};

async function importValidatedEmails(dryRun = false) {
  console.log('📧 SMTP Validated Emails Import to Firestore');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Read CSV file
  if (!fs.existsSync(CONFIG.inputFile)) {
    console.error(`❌ File not found: ${CONFIG.inputFile}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CONFIG.inputFile, 'utf8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  console.log(`📊 Loaded ${records.length} validated emails from CSV`);

  // Get reference to contacts collection
  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

  // Check for existing contacts to avoid overwriting
  console.log('🔍 Checking for existing contacts in Firestore...');

  const existingEmails = new Set();
  const existingSnapshot = await contactsRef.select().get();
  existingSnapshot.forEach(doc => {
    existingEmails.add(doc.id.toLowerCase());
  });

  console.log(`   Found ${existingEmails.size} existing contacts in Firestore`);

  // Filter out existing contacts
  const newRecords = records.filter(r => !existingEmails.has(r.email.toLowerCase()));
  const skipped = records.length - newRecords.length;

  console.log(`   New contacts to import: ${newRecords.length}`);
  console.log(`   Skipping (already exist): ${skipped}\n`);

  if (newRecords.length === 0) {
    console.log('✅ No new contacts to import. All contacts already exist in Firestore.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN: Would import the following contacts:\n');
    newRecords.slice(0, 10).forEach(r => {
      console.log(`   - ${r.firstName} ${r.lastName} <${r.email}>`);
    });
    if (newRecords.length > 10) {
      console.log(`   ... and ${newRecords.length - 10} more`);
    }
    console.log('\n✅ Dry run complete. No changes made.');
    process.exit(0);
  }

  // Process in batches
  const batches = [];
  for (let i = 0; i < newRecords.length; i += CONFIG.batchSize) {
    batches.push(newRecords.slice(i, i + CONFIG.batchSize));
  }

  console.log(`📦 Processing ${batches.length} batch(es)...\n`);

  let totalImported = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`⬆️  Uploading batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);

    const writeBatch = db.batch();

    for (const record of batch) {
      const docRef = contactsRef.doc(record.email.toLowerCase());

      const contactData = {
        firstName: record.firstName || '',
        lastName: record.lastName || '',
        email: record.email.toLowerCase(),
        sent: false,
        sentTimestamp: null,
        batchId: '',
        status: 'pending',
        errorMessage: '',
        randomIndex: Math.random(),  // Random value 0-1 for queue ordering
        smtpValidatedAt: record.validatedAt ? new Date(record.validatedAt) : new Date(),
        source: record.sourceFile || 'smtp_validated',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      writeBatch.set(docRef, contactData);
    }

    await writeBatch.commit();
    totalImported += batch.length;

    console.log(`✅ Batch ${i + 1} uploaded successfully`);

    // Small delay between batches
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Import Complete!');
  console.log('='.repeat(60));
  console.log(`   Total contacts imported: ${totalImported}`);
  console.log(`   Skipped (already existed): ${skipped}`);
  console.log(`   Collection path: ${CONFIG.collectionPath}`);
  console.log(`\n✅ All contacts have randomIndex values and sent=false`);
}

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

importValidatedEmails(dryRun)
  .then(() => {
    console.log('\n✨ Import script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Import script failed:', error);
    process.exit(1);
  });
