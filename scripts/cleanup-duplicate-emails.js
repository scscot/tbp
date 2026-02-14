#!/usr/bin/env node
/**
 * Cleanup Duplicate Emails Script
 *
 * Removes duplicate email entries from:
 * - bfh_contacts
 * - contacts (direct_sales_contacts)
 * - purchased_leads
 *
 * For each collection, keeps one document per unique email address.
 * Priority: keeps docs that have been sent, or the earliest created, or base slug.
 *
 * Usage:
 *   node scripts/cleanup-duplicate-emails.js --audit          # Show duplicates without deleting
 *   node scripts/cleanup-duplicate-emails.js --delete         # Delete duplicates
 *   node scripts/cleanup-duplicate-emails.js --collection=bfh_contacts --delete  # Single collection
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const COLLECTIONS = [
  'bfh_contacts',
  'direct_sales_contacts',
  'purchased_leads'
];

async function findDuplicates(collectionName) {
  console.log(`\n📋 Scanning ${collectionName}...`);

  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log(`   Collection is empty`);
    return { duplicates: [], keepCount: 0, totalCount: 0 };
  }

  // Group by email
  const byEmail = new Map();

  snapshot.forEach(doc => {
    const data = doc.data();
    const email = (data.email || '').toLowerCase().trim();

    if (!email) return; // Skip docs without email

    if (!byEmail.has(email)) {
      byEmail.set(email, []);
    }

    byEmail.get(email).push({
      docId: doc.id,
      fullName: data.fullName || data.firstName || 'Unknown',
      sent: data.sent || false,
      createdAt: data.createdAt?.toDate?.() || new Date(0),
      email: data.email
    });
  });

  const duplicates = [];
  let keepCount = 0;

  byEmail.forEach((docs, email) => {
    if (docs.length > 1) {
      // Sort to determine which to keep:
      // 1. Prefer sent=true
      // 2. Prefer no number suffix (base slug)
      // 3. Prefer earliest created
      // 4. Prefer lowest number suffix
      docs.sort((a, b) => {
        // Sent first
        if (a.sent && !b.sent) return -1;
        if (!a.sent && b.sent) return 1;

        // Base slug (no number) first
        const aNum = a.docId.match(/-(\d+)$/)?.[1];
        const bNum = b.docId.match(/-(\d+)$/)?.[1];
        if (!aNum && bNum) return -1;
        if (aNum && !bNum) return 1;

        // Earlier created
        if (a.createdAt < b.createdAt) return -1;
        if (a.createdAt > b.createdAt) return 1;

        // Lower number suffix
        return (parseInt(aNum) || 0) - (parseInt(bNum) || 0);
      });

      const keep = docs[0];
      const deleteThese = docs.slice(1);

      keepCount++;
      deleteThese.forEach(d => {
        duplicates.push({
          docId: d.docId,
          email: email,
          fullName: d.fullName,
          keepDocId: keep.docId
        });
      });
    }
  });

  return {
    duplicates,
    keepCount,
    totalCount: snapshot.size,
    uniqueEmails: byEmail.size
  };
}

async function deleteDuplicates(collectionName, duplicates, dryRun = false) {
  if (duplicates.length === 0) {
    console.log(`   No duplicates to delete`);
    return 0;
  }

  if (dryRun) {
    console.log(`   Would delete ${duplicates.length} duplicates (dry run)`);
    return duplicates.length;
  }

  console.log(`   Deleting ${duplicates.length} duplicates...`);

  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < duplicates.length; i += batchSize) {
    const batch = db.batch();
    const chunk = duplicates.slice(i, i + batchSize);

    chunk.forEach(dup => {
      const docRef = db.collection(collectionName).doc(dup.docId);
      batch.delete(docRef);
    });

    await batch.commit();
    deleted += chunk.length;
    console.log(`   Deleted ${deleted}/${duplicates.length}...`);
  }

  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const doDelete = args.includes('--delete');
  const auditOnly = args.includes('--audit');
  const specificCollection = args.find(a => a.startsWith('--collection='))?.split('=')[1];

  if (!doDelete && !auditOnly) {
    console.log('Usage:');
    console.log('  node scripts/cleanup-duplicate-emails.js --audit');
    console.log('  node scripts/cleanup-duplicate-emails.js --delete');
    console.log('  node scripts/cleanup-duplicate-emails.js --collection=bfh_contacts --delete');
    process.exit(1);
  }

  const collectionsToProcess = specificCollection ? [specificCollection] : COLLECTIONS;

  console.log('='.repeat(60));
  console.log('EMAIL DUPLICATE CLEANUP');
  console.log('='.repeat(60));
  console.log(`Mode: ${doDelete ? 'DELETE' : 'AUDIT ONLY'}`);
  console.log(`Collections: ${collectionsToProcess.join(', ')}`);

  const results = {};
  let totalDuplicates = 0;
  let totalDeleted = 0;

  for (const collection of collectionsToProcess) {
    const { duplicates, keepCount, totalCount, uniqueEmails } = await findDuplicates(collection);

    results[collection] = {
      total: totalCount,
      uniqueEmails,
      duplicateEmails: keepCount,
      docsToDelete: duplicates.length
    };

    if (duplicates.length > 0) {
      console.log(`\n   Found ${duplicates.length} duplicate docs (${keepCount} emails with dupes)`);

      // Show first 10 duplicates
      duplicates.slice(0, 10).forEach(d => {
        console.log(`   - DELETE: ${d.docId} (${d.email}) → KEEP: ${d.keepDocId}`);
      });
      if (duplicates.length > 10) {
        console.log(`   ... and ${duplicates.length - 10} more`);
      }

      if (doDelete) {
        const deleted = await deleteDuplicates(collection, duplicates, false);
        totalDeleted += deleted;
      }
    } else {
      console.log(`   No duplicates found`);
    }

    totalDuplicates += duplicates.length;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const [collection, stats] of Object.entries(results)) {
    console.log(`\n${collection}:`);
    console.log(`  Total docs: ${stats.total}`);
    console.log(`  Unique emails: ${stats.uniqueEmails}`);
    console.log(`  Duplicate docs: ${stats.docsToDelete}`);
    if (doDelete) {
      console.log(`  After cleanup: ${stats.total - stats.docsToDelete}`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Total duplicates found: ${totalDuplicates}`);
  if (doDelete) {
    console.log(`Total deleted: ${totalDeleted}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
