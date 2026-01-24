#!/usr/bin/env node
/**
 * Fix incorrect website values for MS Bar contacts
 *
 * The MS Bar scraper was incorrectly storing ReliaGuide profile URLs
 * as the attorney's website. This script clears those bad values.
 *
 * Usage:
 *   node scripts/fix-msbar-websites.js          # Dry run
 *   node scripts/fix-msbar-websites.js --run    # Actually update
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--run');

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

async function main() {
    console.log('Fix MS Bar Website Values');
    console.log('='.repeat(50));

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No changes will be made ***');
        console.log('Run with --run to actually update records\n');
    }

    // Get all msbar contacts with a website value
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'msbar')
        .get();

    console.log(`Found ${snapshot.size} MS Bar contacts total\n`);

    let badWebsites = 0;
    let goodWebsites = 0;
    let noWebsite = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const website = data.website;

        if (!website) {
            noWebsite++;
            continue;
        }

        // Check if website is a bad value (ReliaGuide profile URL)
        const isBadWebsite =
            website.includes('reliaguide') ||
            website.includes('/lawyer/') ||
            website.includes('/api/public/profiles') ||
            website.startsWith('/') ||  // Relative URL
            !website.includes('.');      // No domain

        if (isBadWebsite) {
            badWebsites++;
            console.log(`  BAD: ${data.firstName} ${data.lastName} - ${website}`);

            if (!DRY_RUN) {
                batch.update(doc.ref, { website: '' });
                batchCount++;
            }
        } else {
            goodWebsites++;
            console.log(`  OK:  ${data.firstName} ${data.lastName} - ${website}`);
        }
    }

    // Commit batch if not dry run
    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(`\nUpdated ${batchCount} records`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total MS Bar contacts: ${snapshot.size}`);
    console.log(`Bad websites (cleared): ${badWebsites}`);
    console.log(`Good websites (kept): ${goodWebsites}`);
    console.log(`No website: ${noWebsite}`);

    if (DRY_RUN && badWebsites > 0) {
        console.log(`\nRun with --run to clear ${badWebsites} bad website values`);
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
