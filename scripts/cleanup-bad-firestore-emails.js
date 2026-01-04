#!/usr/bin/env node
/**
 * Cleanup bad emails from Firestore preintake_emails collection
 *
 * Usage: node scripts/cleanup-bad-firestore-emails.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const COLLECTION_NAME = 'preintake_emails';

// Bad email patterns to remove
const BAD_EMAIL_DOMAINS = [
    'avadacorporate.com',
    'pilawyerapp.com',
];

async function cleanupBadEmails() {
    console.log('🔍 Scanning Firestore for bad emails...\n');

    const snapshot = await db.collection(COLLECTION_NAME).get();

    const toDelete = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const email = (data.email || '').toLowerCase();

        for (const badDomain of BAD_EMAIL_DOMAINS) {
            if (email.includes(badDomain)) {
                toDelete.push({
                    id: doc.id,
                    email: email,
                    firmName: data.firmName
                });
                break;
            }
        }
    });

    if (toDelete.length === 0) {
        console.log('✅ No bad emails found in Firestore.');
        process.exit(0);
        return;
    }

    console.log(`Found ${toDelete.length} bad emails to remove:\n`);
    for (const item of toDelete) {
        console.log(`  - ${item.firmName}: ${item.email}`);
    }

    console.log('\nDeleting...');

    for (const item of toDelete) {
        await db.collection(COLLECTION_NAME).doc(item.id).delete();
        console.log(`  ✓ Deleted: ${item.email}`);
    }

    console.log(`\n✅ Removed ${toDelete.length} bad emails from Firestore.`);
    process.exit(0);
}

cleanupBadEmails().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
