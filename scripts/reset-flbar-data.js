#!/usr/bin/env node
/**
 * Reset FL Bar Data
 *
 * Deletes all FL Bar contacts from preintake_emails and resets scrape progress.
 * This allows a clean re-scrape starting with Personal Injury (B37).
 *
 * Usage:
 *   DRY_RUN=true node scripts/reset-flbar-data.js   # Preview only
 *   node scripts/reset-flbar-data.js                # Actually delete
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = process.env.DRY_RUN === 'true';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account key not found');
    process.exit(1);
}
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function main() {
    console.log('Reset FL Bar Data');
    console.log('=================\n');

    if (DRY_RUN) {
        console.log('DRY RUN MODE - No changes will be made\n');
    }

    // Step 1: Count FL Bar contacts
    console.log('Step 1: Counting FL Bar contacts...');
    const flbarSnapshot = await db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .get();

    console.log(`   Found ${flbarSnapshot.size} FL Bar contacts to delete\n`);

    // Step 2: Delete FL Bar contacts in batches
    if (flbarSnapshot.size > 0) {
        console.log('Step 2: Deleting FL Bar contacts...');

        if (!DRY_RUN) {
            const BATCH_SIZE = 400;
            let deleted = 0;
            let batch = db.batch();
            let batchCount = 0;

            for (const doc of flbarSnapshot.docs) {
                batch.delete(doc.ref);
                batchCount++;
                deleted++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`   Deleted ${deleted} contacts...`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }

            // Commit remaining
            if (batchCount > 0) {
                await batch.commit();
            }

            console.log(`   ✓ Deleted ${deleted} FL Bar contacts\n`);
        } else {
            console.log(`   [DRY RUN] Would delete ${flbarSnapshot.size} contacts\n`);
        }
    }

    // Step 3: Reset scrape progress
    console.log('Step 3: Resetting FL Bar scrape progress...');
    const progressRef = db.collection('preintake_scrape_progress').doc('flbar');
    const progressDoc = await progressRef.get();

    if (progressDoc.exists) {
        const currentProgress = progressDoc.data();
        console.log('   Current progress:');
        console.log(`     - Practice areas completed: ${currentProgress.scrapedPracticeAreaCodes?.length || 0}`);
        console.log(`     - Total inserted: ${currentProgress.totalInserted || 0}`);
        console.log(`     - Total skipped: ${currentProgress.totalSkipped || 0}`);

        if (!DRY_RUN) {
            await progressRef.set({
                scrapedPracticeAreaCodes: [],
                permanentlySkipped: [],
                failedAttempts: {},
                totalInserted: 0,
                totalSkipped: 0,
                lastRunDate: null,
                resetAt: admin.firestore.FieldValue.serverTimestamp(),
                resetReason: 'Clean re-scrape starting with Personal Injury (B37)'
            });
            console.log('   ✓ Progress reset\n');
        } else {
            console.log('   [DRY RUN] Would reset progress\n');
        }
    } else {
        console.log('   No existing progress document found\n');
    }

    // Summary
    console.log('=================');
    console.log('Summary');
    console.log('=================');
    console.log(`   FL Bar contacts deleted: ${DRY_RUN ? '(dry run)' : flbarSnapshot.size}`);
    console.log(`   Scrape progress reset: ${DRY_RUN ? '(dry run)' : 'Yes'}`);

    if (!DRY_RUN) {
        console.log('\n✓ FL Bar data has been reset.');
        console.log('  You can now run the scraper with PRACTICE_AREA_CODE=B37');
        console.log('  to start fresh with Personal Injury attorneys.');
    } else {
        console.log('\nDRY RUN complete. Run without DRY_RUN=true to execute.');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
