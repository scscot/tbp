#!/usr/bin/env node
/**
 * Cleanup Government/Institutional Contacts from preintake_emails
 *
 * Removes contacts that are government agencies, courts, public defenders,
 * district attorneys, etc. - entities that don't need private intake services.
 *
 * Usage:
 *   node scripts/cleanup-gov-contacts.js          # Dry run (preview only)
 *   node scripts/cleanup-gov-contacts.js --run    # Actually delete records
 */

const admin = require('firebase-admin');
const path = require('path');
const { isGovernmentContact, getGovernmentCategory } = require('./gov-filter-utils');

const DRY_RUN = !process.argv.includes('--run');

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
    console.log('Government/Institutional Contacts Cleanup');
    console.log('='.repeat(70));

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No records will be deleted ***');
        console.log('Run with --run to actually delete records\n');
    } else {
        console.log('*** LIVE MODE - Records will be DELETED ***\n');
    }

    const snapshot = await db.collection('preintake_emails').get();
    console.log(`Total records in preintake_emails: ${snapshot.size}\n`);

    const toDelete = [];
    const categories = {};
    const bySource = {};

    snapshot.forEach(doc => {
        const d = doc.data();
        const email = d.email || '';
        const firmName = d.firmName || '';

        if (isGovernmentContact(email, firmName)) {
            const category = getGovernmentCategory(email, firmName) || 'other_govt';
            const source = d.source || 'unknown';

            toDelete.push({
                id: doc.id,
                ref: doc.ref,
                email,
                firmName,
                name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
                source,
                category
            });

            categories[category] = (categories[category] || 0) + 1;
            bySource[source] = (bySource[source] || 0) + 1;
        }
    });

    console.log(`Found ${toDelete.length} government/institutional contacts to delete\n`);

    // Print summary by category
    console.log('BY CATEGORY:');
    console.log('-'.repeat(50));
    Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count}`);
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
    console.log('\nSAMPLE RECORDS TO DELETE (first 20):');
    console.log('-'.repeat(50));
    toDelete.slice(0, 20).forEach(c => {
        console.log(`  [${c.source}] ${c.email}`);
        if (c.firmName) console.log(`    Firm: ${c.firmName}`);
        console.log(`    Category: ${c.category}`);
    });
    if (toDelete.length > 20) {
        console.log(`  ... and ${toDelete.length - 20} more`);
    }

    if (!DRY_RUN && toDelete.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('DELETING RECORDS...');
        console.log('='.repeat(70));

        // Delete in batches of 500 (Firestore limit)
        const BATCH_SIZE = 500;
        let deleted = 0;

        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = toDelete.slice(i, i + BATCH_SIZE);

            chunk.forEach(record => {
                batch.delete(record.ref);
            });

            await batch.commit();
            deleted += chunk.length;
            console.log(`  Deleted ${deleted} of ${toDelete.length} records...`);
        }

        console.log(`\n✓ Successfully deleted ${deleted} government/institutional contacts`);
    } else if (DRY_RUN && toDelete.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log(`Run with --run to delete ${toDelete.length} records`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY:');
    console.log('-'.repeat(50));
    console.log(`Total records scanned: ${snapshot.size}`);
    console.log(`Government contacts found: ${toDelete.length}`);
    console.log(`Percentage: ${(toDelete.length / snapshot.size * 100).toFixed(2)}%`);
    console.log(`Records remaining: ${snapshot.size - (DRY_RUN ? 0 : toDelete.length)}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
