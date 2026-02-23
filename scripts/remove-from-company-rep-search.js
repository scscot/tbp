#!/usr/bin/env node
/**
 * Remove a document from company_rep_search collection
 *
 * Usage:
 *   node scripts/remove-from-company-rep-search.js <document_id>
 *   node scripts/remove-from-company-rep-search.js doterra-com
 *   node scripts/remove-from-company-rep-search.js doterra-com primerica-com  # Multiple
 */

const admin = require('firebase-admin');
const path = require('path');

const docIds = process.argv.slice(2);

if (docIds.length === 0) {
  console.log('Usage: node remove-from-company-rep-search.js <document_id> [document_id2] ...');
  console.log('Example: node remove-from-company-rep-search.js doterra-com');
  process.exit(1);
}

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});
const db = admin.firestore();

async function removeDocuments() {
  for (const docId of docIds) {
    const docRef = db.collection('company_rep_search').doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`✗ Not found: ${docId}`);
      continue;
    }

    const data = doc.data();
    await docRef.delete();
    console.log(`✓ Deleted: ${docId} (${data.companyDomain})`);
  }
}

removeDocuments()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
