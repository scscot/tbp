#!/usr/bin/env node
/**
 * Fix firstName fields in preintake_emails collection
 *
 * Converts firstName values like "John Michael" to just "John"
 * (removes middle names, keeping only the first word)
 *
 * Usage:
 *   DRY_RUN=true node scripts/fix-firstname-middle-names.js   # Preview changes
 *   node scripts/fix-firstname-middle-names.js                 # Apply changes
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = process.env.DRY_RUN === 'true';

// Initialize Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account key not found at ${serviceAccountPath}`);
    }
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function fixFirstNames() {
    console.log('Fix firstName Middle Names');
    console.log('==========================\n');

    if (DRY_RUN) {
        console.log('DRY RUN MODE - No changes will be made\n');
    }

    // Query all documents in preintake_emails
    const snapshot = await db.collection('preintake_emails').get();

    console.log(`Total documents: ${snapshot.size}\n`);

    let needsFixCount = 0;
    let fixedCount = 0;
    const examples = [];

    // Prepare batches (Firestore limit: 500 per batch)
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const firstName = data.firstName;

        if (!firstName) continue;

        // Check if firstName has multiple words (contains space)
        if (firstName.includes(' ')) {
            needsFixCount++;

            // Extract just the first word
            const fixedFirstName = firstName.split(/\s+/)[0];

            // Store some examples for review
            if (examples.length < 20) {
                examples.push({
                    id: doc.id,
                    email: data.email,
                    before: firstName,
                    after: fixedFirstName
                });
            }

            if (!DRY_RUN) {
                batch.update(doc.ref, { firstName: fixedFirstName });
                batchCount++;

                // Commit batch if full
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    fixedCount += batchCount;
                    console.log(`  Committed batch: ${fixedCount} records updated`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }
        }
    }

    // Commit remaining batch
    if (batchCount > 0 && !DRY_RUN) {
        await batch.commit();
        fixedCount += batchCount;
        console.log(`  Committed final batch: ${fixedCount} records updated`);
    }

    // Summary
    console.log('\n==========================');
    console.log('Summary');
    console.log('==========================');
    console.log(`Total documents scanned: ${snapshot.size}`);
    console.log(`Records with multi-word firstName: ${needsFixCount}`);

    if (DRY_RUN) {
        console.log(`Records that WOULD be fixed: ${needsFixCount}`);
    } else {
        console.log(`Records fixed: ${fixedCount}`);
    }

    // Show examples
    if (examples.length > 0) {
        console.log('\nExamples:');
        console.log('-'.repeat(60));
        for (const ex of examples) {
            console.log(`  "${ex.before}" → "${ex.after}" (${ex.email})`);
        }
    }

    console.log('\nDone!');
}

fixFirstNames()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
