#!/usr/bin/env node
/**
 * Add campaign fields to direct_sales_contacts
 *
 * Adds randomIndex and sent fields to existing scraped contacts
 * for the email campaign system.
 *
 * Usage:
 *   node scripts/add-campaign-fields.js             # Dry run (preview)
 *   node scripts/add-campaign-fields.js --execute   # Actually update
 */

const admin = require('firebase-admin');

// Initialize Firebase
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--execute');

async function addCampaignFields() {
    console.log('📊 Add Campaign Fields to direct_sales_contacts');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'EXECUTE (will update documents)'}\n`);

    // Query all scraped contacts with email
    console.log('Querying scraped contacts with emails...');
    const snapshot = await db.collection('direct_sales_contacts')
        .where('scraped', '==', true)
        .get();

    if (snapshot.empty) {
        console.log('No scraped contacts found.');
        process.exit(0);
    }

    console.log(`Found ${snapshot.size} scraped contacts`);

    // Filter to only those with email and missing randomIndex
    const toUpdate = [];
    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.email && data.randomIndex === undefined) {
            toUpdate.push({
                ref: doc.ref,
                email: data.email,
                company: data.company
            });
        }
    }

    console.log(`${toUpdate.length} contacts need campaign fields added`);

    if (toUpdate.length === 0) {
        console.log('All contacts already have campaign fields.');
        process.exit(0);
    }

    if (DRY_RUN) {
        console.log('\n📋 Preview (first 10):');
        for (const contact of toUpdate.slice(0, 10)) {
            console.log(`   ${contact.company}: ${contact.email}`);
        }
        if (toUpdate.length > 10) {
            console.log(`   ... and ${toUpdate.length - 10} more`);
        }
        console.log('\n⚠️  Run with --execute to apply changes');
        process.exit(0);
    }

    // Update in batches of 500
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;

    for (const contact of toUpdate) {
        batch.update(contact.ref, {
            randomIndex: Math.random(),
            sent: false
        });
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

    console.log(`\n✅ Done! Added campaign fields to ${totalUpdated} contacts`);
    console.log('   - randomIndex: random value 0.0-1.0');
    console.log('   - sent: false');
}

addCampaignFields()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
