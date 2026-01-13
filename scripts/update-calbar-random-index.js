#!/usr/bin/env node
/**
 * Update CalBar contacts' randomIndex to 0.0-0.1 range
 *
 * This prioritizes CalBar contacts in the email campaign queue
 * by giving them lower randomIndex values than other contacts.
 *
 * Usage: node scripts/update-calbar-random-index.js
 */

const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function updateCalBarRandomIndex() {
    console.log('🔄 Updating CalBar contacts randomIndex to 0.0-0.1 range...\n');

    // Query all CalBar contacts
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'calbar')
        .get();

    if (snapshot.empty) {
        console.log('No CalBar contacts found.');
        process.exit(0);
    }

    console.log(`Found ${snapshot.size} CalBar contacts`);

    // Update in batches of 500
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
        const currentIndex = doc.data().randomIndex;
        const newIndex = Math.random() * 0.1; // 0.0-0.1 range

        batch.update(doc.ref, { randomIndex: newIndex });
        batchCount++;
        totalUpdated++;

        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`   ✅ Updated batch of ${batchCount} contacts`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Updated final batch of ${batchCount} contacts`);
    }

    console.log(`\n✅ Done! Updated ${totalUpdated} CalBar contacts to randomIndex range 0.0-0.1`);
    console.log('   These contacts will now be prioritized in the email campaign queue.');
}

updateCalBarRandomIndex()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
