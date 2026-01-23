#!/usr/bin/env node
/**
 * Fix/Delete GABAR contacts in preintake_emails collection
 *
 * Issues to fix:
 * 1. Missing firstName and lastName fields (364 contacts)
 *
 * Usage:
 *   node scripts/fix-gabar-contacts.js                    # Dry run (preview)
 *   node scripts/fix-gabar-contacts.js --run              # Delete unusable and reset progress
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = !process.argv.includes('--run');

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

function initializeFirebase() {
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
    console.log('Firebase initialized (preintake database)');
    return db;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('GABAR Contact Fix Script');
    console.log('='.repeat(60));
    console.log('MODE: Delete unusable contacts (missing firstName or lastName)');

    if (DRY_RUN) {
        console.log('*** DRY RUN - No changes will be made ***');
        console.log('Run with --run flag to apply changes\n');
    } else {
        console.log('*** LIVE MODE - Changes will be applied ***\n');
    }

    const db = initializeFirebase();

    // Query all GABAR contacts
    console.log('Querying GABAR contacts...');
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'gabar')
        .get();

    console.log(`Found ${snapshot.size} GABAR contacts\n`);

    const toDelete = [];
    const usable = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Contact is unusable if missing firstName OR lastName
        if (!data.firstName || !data.lastName) {
            toDelete.push({
                id: doc.id,
                ref: doc.ref,
                email: data.email,
                firstName: data.firstName || '(missing)',
                lastName: data.lastName || '(missing)',
                firmName: data.firmName || '(missing)'
            });
        } else {
            usable.push(doc.id);
        }
    }

    console.log(`Unusable (missing names): ${toDelete.length}`);
    console.log(`Usable (has both names): ${usable.length}\n`);

    if (toDelete.length > 0) {
        console.log('Sample contacts to delete (first 15):');
        toDelete.slice(0, 15).forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.email} | firstName: ${c.firstName} | lastName: ${c.lastName}`);
        });

        if (!DRY_RUN) {
            // Delete in batches
            let batch = db.batch();
            let batchCount = 0;
            const BATCH_SIZE = 400;

            for (const item of toDelete) {
                batch.delete(item.ref);
                batchCount++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`Deleted batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`Deleted final batch of ${batchCount}`);
            }

            console.log(`\n✓ Deleted ${toDelete.length} unusable GABAR contacts`);

            // Reset GABAR scrape progress so it can re-scrape
            const progressRef = db.collection('preintake_scrape_progress').doc('gabar');
            await progressRef.delete();
            console.log('✓ Reset GABAR scrape progress (will re-scrape from beginning)');
        } else {
            console.log(`\nTo delete these ${toDelete.length} unusable contacts, run:`);
            console.log('  node scripts/fix-gabar-contacts.js --run');
        }
    }

    console.log('\nDone!');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
