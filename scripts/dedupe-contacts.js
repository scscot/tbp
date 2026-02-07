#!/usr/bin/env node
/**
 * Deduplicate direct_sales_contacts by email
 *
 * This script finds all duplicate emails in the direct_sales_contacts collection
 * and removes duplicates, keeping only one document per email address.
 *
 * Priority for keeping:
 * 1. Documents with sent=true (already emailed)
 * 2. Documents with scraped=true
 * 3. First document by createdAt
 *
 * Usage:
 *   node scripts/dedupe-contacts.js              # Dry run (preview only)
 *   node scripts/dedupe-contacts.js --execute    # Actually delete duplicates
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});
const db = admin.firestore();

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  console.log('='.repeat(60));
  console.log('DEDUPLICATE CONTACTS BY EMAIL');
  console.log('='.repeat(60));
  console.log(`Mode: ${execute ? 'EXECUTE (will delete duplicates)' : 'DRY RUN (preview only)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Step 1: Fetch all documents with emails
  console.log('Fetching all documents with emails...');
  const snapshot = await db.collection('direct_sales_contacts')
    .where('scraped', '==', true)
    .get();

  console.log(`Total documents with scraped=true: ${snapshot.size}`);

  // Step 2: Group by email
  const emailGroups = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const email = data.email;
    if (!email) return;

    if (!emailGroups[email]) {
      emailGroups[email] = [];
    }
    emailGroups[email].push({
      id: doc.id,
      sent: data.sent || false,
      scraped: data.scraped || false,
      sentAt: data.sentAt,
      createdAt: data.createdAt,
      company: data.company,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  });

  // Step 3: Find duplicates
  const duplicateEmails = Object.entries(emailGroups)
    .filter(([email, docs]) => docs.length > 1);

  console.log(`\nUnique emails: ${Object.keys(emailGroups).length}`);
  console.log(`Emails with duplicates: ${duplicateEmails.length}`);

  if (duplicateEmails.length === 0) {
    console.log('\nNo duplicates found. Exiting.');
    process.exit(0);
  }

  // Step 4: Determine which documents to keep and which to delete
  const toDelete = [];
  const toKeep = [];

  for (const [email, docs] of duplicateEmails) {
    // Sort by priority: sent=true first, then scraped=true, then by createdAt
    docs.sort((a, b) => {
      // Priority 1: sent=true
      if (a.sent && !b.sent) return -1;
      if (!a.sent && b.sent) return 1;

      // Priority 2: has sentAt timestamp
      if (a.sentAt && !b.sentAt) return -1;
      if (!a.sentAt && b.sentAt) return 1;

      // Priority 3: scraped=true
      if (a.scraped && !b.scraped) return -1;
      if (!a.scraped && b.scraped) return 1;

      // Priority 4: createdAt (keep older one)
      if (a.createdAt && b.createdAt) {
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      }

      return 0;
    });

    // Keep the first document (highest priority), delete the rest
    toKeep.push({ email, doc: docs[0] });
    for (let i = 1; i < docs.length; i++) {
      toDelete.push({ email, doc: docs[i] });
    }
  }

  console.log(`Documents to keep: ${toKeep.length}`);
  console.log(`Documents to delete: ${toDelete.length}`);

  // Step 5: Preview duplicates
  console.log('\n--- DUPLICATE DETAILS ---\n');

  // Show first 10 examples
  const examples = duplicateEmails.slice(0, 10);
  for (const [email, docs] of examples) {
    console.log(`Email: ${email} (${docs.length} duplicates)`);
    for (const doc of docs) {
      const status = doc.sent ? 'SENT' : 'not sent';
      const keep = docs[0].id === doc.id ? '← KEEP' : '← DELETE';
      console.log(`  ${doc.id}: ${doc.company} | ${status} | ${doc.firstName || '(no name)'} ${keep}`);
    }
    console.log('');
  }

  if (duplicateEmails.length > 10) {
    console.log(`... and ${duplicateEmails.length - 10} more duplicate emails\n`);
  }

  // Step 6: Execute deletion if requested
  if (!execute) {
    console.log('--- DRY RUN COMPLETE ---');
    console.log('To actually delete duplicates, run:');
    console.log('  node scripts/dedupe-contacts.js --execute');
    process.exit(0);
  }

  console.log('--- EXECUTING DELETION ---\n');

  // Delete in batches of 500
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);

    for (const { doc } of chunk) {
      const docRef = db.collection('direct_sales_contacts').doc(doc.id);
      batch.delete(docRef);
    }

    await batch.commit();
    deleted += chunk.length;
    console.log(`Deleted ${deleted}/${toDelete.length} duplicate documents...`);
  }

  console.log('\n--- DELETION COMPLETE ---');
  console.log(`Total duplicates deleted: ${deleted}`);
  console.log(`Unique contacts remaining: ${Object.keys(emailGroups).length}`);

  process.exit(0);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
