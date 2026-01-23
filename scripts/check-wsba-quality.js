#!/usr/bin/env node
/**
 * Check WSBA data quality in Firestore
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function check() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'wsba')
        .get();

    console.log('Total WSBA contacts:', snapshot.size);
    console.log('');

    let missingFirstName = 0;
    let missingLastName = 0;
    let badFirmName = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log('---');
        console.log('firstName:', data.firstName || '(MISSING)');
        console.log('lastName:', data.lastName || '(MISSING)');
        console.log('firmName:', data.firmName || '(empty)');
        console.log('email:', data.email);
        console.log('city:', data.city || '(empty)');

        if (!data.firstName) missingFirstName++;
        if (!data.lastName) missingLastName++;
        if (data.firmName && data.firmName.includes('or Employer')) badFirmName++;
    }

    console.log('');
    console.log('=== SUMMARY ===');
    console.log('Missing firstName:', missingFirstName);
    console.log('Missing lastName:', missingLastName);
    console.log('Bad firmName (contains "or Employer"):', badFirmName);
}

check().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
