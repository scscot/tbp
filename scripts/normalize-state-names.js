#!/usr/bin/env node
/**
 * Normalize State Names in preintake_emails Collection
 *
 * Finds records with full state names (e.g., "Nebraska", "Illinois") and
 * converts them to two-letter abbreviations (e.g., "NE", "IL").
 *
 * Usage:
 *   node scripts/normalize-state-names.js          # Dry run (preview only)
 *   node scripts/normalize-state-names.js --run    # Actually update records
 */

const admin = require('firebase-admin');
const path = require('path');
const { normalizeState, VALID_STATE_ABBREVS } = require('./gov-filter-utils');

const DRY_RUN = !process.argv.includes('--run');
const BATCH_SIZE = 500;

// Initialize Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function main() {
    console.log('State Name Normalization');
    console.log('='.repeat(70));

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No records will be updated ***');
        console.log('Run with --run to actually update records\n');
    } else {
        console.log('*** LIVE MODE - Records will be UPDATED ***\n');
    }

    const snapshot = await db.collection('preintake_emails').get();
    console.log(`Total records in preintake_emails: ${snapshot.size}\n`);

    const toUpdate = [];
    const stateChanges = {};
    const bySource = {};

    snapshot.forEach(doc => {
        const d = doc.data();
        const currentState = d.state || '';

        // Skip if already a valid 2-letter abbreviation
        if (currentState.length === 2 && VALID_STATE_ABBREVS.has(currentState.toUpperCase())) {
            return;
        }

        // Skip if empty
        if (!currentState.trim()) {
            return;
        }

        const normalizedState = normalizeState(currentState);

        // Only update if normalization changed the value
        if (normalizedState !== currentState) {
            const source = d.source || 'unknown';
            const changeKey = `${currentState} → ${normalizedState}`;

            toUpdate.push({
                id: doc.id,
                ref: doc.ref,
                currentState,
                normalizedState,
                source,
                email: d.email || '',
                name: `${d.firstName || ''} ${d.lastName || ''}`.trim()
            });

            stateChanges[changeKey] = (stateChanges[changeKey] || 0) + 1;
            bySource[source] = (bySource[source] || 0) + 1;
        }
    });

    console.log(`Found ${toUpdate.length} records to normalize\n`);

    if (toUpdate.length === 0) {
        console.log('No records need normalization.');
        process.exit(0);
    }

    // Print summary by state change
    console.log('STATE CHANGES:');
    console.log('-'.repeat(50));
    Object.entries(stateChanges)
        .sort((a, b) => b[1] - a[1])
        .forEach(([change, count]) => {
            console.log(`  ${change}: ${count}`);
        });

    // Print summary by source
    console.log('\nBY SOURCE:');
    console.log('-'.repeat(50));
    Object.entries(bySource)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
            console.log(`  ${source}: ${count}`);
        });

    // Show sample records
    console.log('\nSAMPLE RECORDS TO UPDATE (first 20):');
    console.log('-'.repeat(50));
    toUpdate.slice(0, 20).forEach(r => {
        console.log(`  ${r.email} (${r.source}): "${r.currentState}" → "${r.normalizedState}"`);
    });

    if (toUpdate.length > 20) {
        console.log(`  ... and ${toUpdate.length - 20} more`);
    }

    // Update records if not dry run
    if (!DRY_RUN) {
        console.log('\nUpdating records...');

        let batch = db.batch();
        let batchCount = 0;
        let totalUpdated = 0;

        for (const record of toUpdate) {
            batch.update(record.ref, { state: record.normalizedState });
            batchCount++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                totalUpdated += batchCount;
                console.log(`  Updated ${totalUpdated} records...`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            totalUpdated += batchCount;
        }

        console.log(`\nDone! Updated ${totalUpdated} records.`);
    } else {
        console.log('\nDry run complete. Run with --run to apply changes.');
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
