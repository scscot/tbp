#!/usr/bin/env node
/**
 * Cleanup company_rep_search Firestore collection
 *
 * Deletes documents that are:
 * 1. status == 'not_found' (no discoverable rep search form)
 * 2. searchUrl contains 'dealer' (likely B2B, not individual reps)
 *
 * Usage:
 *   node scripts/cleanup-rep-search.js --dry-run    # Preview what would be deleted
 *   node scripts/cleanup-rep-search.js              # Actually delete
 */

const admin = require('firebase-admin');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

async function cleanup() {
  console.log(`\n🧹 Cleanup company_rep_search collection${dryRun ? ' (DRY RUN)' : ''}\n`);

  const collection = db.collection('company_rep_search');
  const snapshot = await collection.get();

  const toDelete = {
    notFound: [],
    dealer: []
  };

  let kept = 0;

  snapshot.forEach(doc => {
    const data = doc.data();

    // Check for not_found status
    if (data.status === 'not_found') {
      toDelete.notFound.push({ id: doc.id, domain: data.companyDomain });
      return;
    }

    // Check for 'dealer' in searchUrl (case-insensitive)
    if (data.searchUrl && data.searchUrl.toLowerCase().includes('dealer')) {
      toDelete.dealer.push({
        id: doc.id,
        domain: data.companyDomain,
        url: data.searchUrl
      });
      return;
    }

    kept++;
  });

  // Report what will be deleted
  console.log(`📊 Summary:`);
  console.log(`   Total documents: ${snapshot.size}`);
  console.log(`   To delete (not_found): ${toDelete.notFound.length}`);
  console.log(`   To delete (dealer URLs): ${toDelete.dealer.length}`);
  console.log(`   Keeping: ${kept}`);

  if (toDelete.dealer.length > 0) {
    console.log(`\n🚗 Dealer URLs to delete:`);
    toDelete.dealer.forEach(d => {
      console.log(`   - ${d.domain}: ${d.url}`);
    });
  }

  if (dryRun) {
    console.log(`\n⏸️  Dry run complete. Run without --dry-run to delete.`);
    process.exit(0);
  }

  // Delete in batches
  const allToDelete = [...toDelete.notFound, ...toDelete.dealer];

  if (allToDelete.length === 0) {
    console.log(`\n✅ Nothing to delete.`);
    process.exit(0);
  }

  console.log(`\n🗑️  Deleting ${allToDelete.length} documents...`);

  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < allToDelete.length; i += batchSize) {
    const batch = db.batch();
    const chunk = allToDelete.slice(i, i + batchSize);

    chunk.forEach(item => {
      batch.delete(collection.doc(item.id));
    });

    await batch.commit();
    deleted += chunk.length;
    console.log(`   Deleted ${deleted}/${allToDelete.length}`);
  }

  console.log(`\n✅ Cleanup complete. ${kept} documents remain.`);
}

cleanup().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
