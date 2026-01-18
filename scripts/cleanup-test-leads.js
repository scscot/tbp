#!/usr/bin/env node
/**
 * Delete test leads from preintake_leads collection
 * where email == 'scscot@gmail.com'
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function deleteTestLeads() {
  const testEmail = 'scscot@gmail.com';
  
  console.log(`\nQuerying for documents where email == '${testEmail}'...\n`);
  
  const snapshot = await db.collection('preintake_leads')
    .where('email', '==', testEmail)
    .get();
  
  if (snapshot.empty) {
    console.log('No documents found to delete.');
    return;
  }
  
  console.log(`Found ${snapshot.size} document(s) to delete:\n`);
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: ${data.firmName || 'Unknown'} (status: ${data.status})`);
    batch.delete(doc.ref);
  });
  
  console.log(`\nDeleting ${snapshot.size} document(s)...`);
  await batch.commit();
  console.log('Done!\n');
}

deleteTestLeads().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
