#!/usr/bin/env node
/**
 * Backfill memberUrl for existing Florida Bar contacts
 *
 * One-time script to add memberUrl field to existing FL Bar contacts
 * that were scraped before the field was added.
 *
 * Usage:
 *   node scripts/backfill-flbar-member-urls.js
 *   DRY_RUN=true node scripts/backfill-flbar-member-urls.js
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

async function backfill() {
    console.log('Backfilling memberUrl for FL Bar contacts');
    console.log('=========================================\n');

    if (DRY_RUN) {
        console.log('DRY RUN MODE - No changes will be made\n');
    }

    // Query FL Bar contacts that have barNumber but no memberUrl
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .get();

    console.log(`Found ${snapshot.size} FL Bar contacts total\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has memberUrl
        if (data.memberUrl) {
            skipped++;
            continue;
        }

        // Skip if no barNumber
        if (!data.barNumber) {
            console.log(`  ⚠️ ${doc.id}: No barNumber, skipping`);
            errors++;
            continue;
        }

        const memberUrl = `https://www.floridabar.org/directories/find-mbr/profile/?num=${data.barNumber}`;

        console.log(`  ✓ ${data.firstName} ${data.lastName} (${data.barNumber}) → ${memberUrl}`);

        if (!DRY_RUN) {
            batch.update(doc.ref, { memberUrl });
            batchCount++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`\n  Committed batch of ${batchCount} updates\n`);
                batchCount = 0;
            }
        }

        updated++;
    }

    // Commit remaining batch
    if (batchCount > 0 && !DRY_RUN) {
        await batch.commit();
        console.log(`\n  Committed final batch of ${batchCount} updates`);
    }

    console.log('\n=========================================');
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already has memberUrl): ${skipped}`);
    console.log(`  Errors: ${errors}`);

    if (DRY_RUN) {
        console.log('\nDRY RUN - No changes were made');
    }

    process.exit(0);
}

backfill().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
