#!/usr/bin/env node
/**
 * PreIntake.ai Stale Demo Cleanup Script
 *
 * Deletes demo documents and storage files that are:
 *   1. 31+ days old (based on demo.generatedAt)
 *   2. Never converted to a subscription (no stripeSubscriptionId)
 *
 * This prevents the preintake_leads collection from becoming bloated
 * with demos that were never activated.
 *
 * Environment Variables:
 *   FIREBASE_SERVICE_ACCOUNT - JSON string of service account credentials (for CI)
 *   DRY_RUN - Set to 'true' to preview what would be deleted without actually deleting
 *
 * Usage:
 *   # Dry run (preview only)
 *   DRY_RUN=true node scripts/cleanup-stale-demos.js
 *
 *   # Actual cleanup (local with service account file)
 *   node scripts/cleanup-stale-demos.js
 *
 *   # CI/GitHub Actions (with secret)
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' node scripts/cleanup-stale-demos.js
 */

const path = require('path');

// Initialize Firebase Admin
let admin;
let serviceAccount;

// Check for CI environment (JSON string) or local file
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin = require('firebase-admin');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
    });
} else {
    // Local development - use service account file
    const { initFirebaseAdmin } = require('../functions/demo-generator-functions');
    serviceAccount = require('../secrets/serviceAccountKey.json');
    admin = initFirebaseAdmin(serviceAccount, 'teambuilder-plus-fe74d.firebasestorage.app');
}

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Configuration
const COLLECTION_NAME = 'preintake_leads';
const STORAGE_PATH_PREFIX = 'preintake-demos';
const STALE_DAYS = 31;
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Main cleanup function
 */
async function runCleanup() {
    console.log('🧹 PreIntake.ai Stale Demo Cleanup');
    console.log('===================================\n');

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    }

    // Calculate cutoff date (31 days ago)
    const cutoffDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);
    console.log(`   Demos older than ${STALE_DAYS} days will be considered stale\n`);

    // Query all leads with demo.generatedAt <= cutoff
    // Note: Firestore doesn't support querying nested fields with inequality,
    // so we fetch all and filter in code
    console.log('🔍 Querying preintake_leads collection...\n');

    const snapshot = await db.collection(COLLECTION_NAME).get();

    if (snapshot.empty) {
        console.log('✅ No documents found in collection.');
        process.exit(0);
    }

    console.log(`   Found ${snapshot.size} total documents\n`);

    let processed = 0;
    let deleted = 0;
    let skippedSubscription = 0;
    let skippedNotStale = 0;
    let skippedNoDemo = 0;
    let errors = 0;

    const bucket = admin.storage().bucket();

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const leadId = doc.id;
        processed++;

        // Check if demo was ever generated
        const demoGeneratedAt = data.demo?.generatedAt;
        if (!demoGeneratedAt) {
            skippedNoDemo++;
            continue;
        }

        // Convert Firestore timestamp to Date
        const generatedDate = demoGeneratedAt.toDate ? demoGeneratedAt.toDate() : new Date(demoGeneratedAt);

        // Check if demo is stale (older than cutoff)
        if (generatedDate > cutoffDate) {
            skippedNotStale++;
            continue;
        }

        // Check if user ever had a subscription (protect for winback)
        if (data.stripeSubscriptionId) {
            console.log(`   ⏭️  Skipping ${leadId} - has subscription history`);
            skippedSubscription++;
            continue;
        }

        // This document is stale and never converted - delete it
        const firmName = data.analysis?.firmName || data.name || 'Unknown';
        const daysOld = Math.floor((Date.now() - generatedDate.getTime()) / (24 * 60 * 60 * 1000));

        console.log(`\n🗑️  ${DRY_RUN ? '[DRY RUN] Would delete' : 'Deleting'}: ${leadId}`);
        console.log(`   Firm: ${firmName}`);
        console.log(`   Demo age: ${daysOld} days`);

        if (!DRY_RUN) {
            try {
                // Delete Storage files first
                const htmlPath = `${STORAGE_PATH_PREFIX}/${leadId}/index.html`;
                const configPath = `${STORAGE_PATH_PREFIX}/${leadId}/config.json`;

                await bucket.file(htmlPath).delete().catch((err) => {
                    if (err.code !== 404) {
                        console.log(`   ⚠️  Storage delete failed for ${htmlPath}: ${err.message}`);
                    }
                });

                await bucket.file(configPath).delete().catch((err) => {
                    if (err.code !== 404) {
                        console.log(`   ⚠️  Storage delete failed for ${configPath}: ${err.message}`);
                    }
                });

                // Delete Firestore document
                await doc.ref.delete();

                console.log(`   ✅ Deleted successfully`);
                deleted++;

            } catch (error) {
                console.error(`   ❌ Error deleting ${leadId}: ${error.message}`);
                errors++;
            }
        } else {
            deleted++; // Count as "would be deleted" in dry run
        }
    }

    // Summary
    console.log('\n===================================');
    console.log('📊 Cleanup Summary');
    console.log('===================================');
    console.log(`   Total documents processed: ${processed}`);
    console.log(`   ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${deleted}`);
    console.log(`   Skipped (has subscription): ${skippedSubscription}`);
    console.log(`   Skipped (not stale yet): ${skippedNotStale}`);
    console.log(`   Skipped (no demo generated): ${skippedNoDemo}`);
    if (errors > 0) {
        console.log(`   Errors: ${errors}`);
    }
    console.log('');

    if (DRY_RUN && deleted > 0) {
        console.log('💡 Run without DRY_RUN=true to actually delete these documents.\n');
    }

    process.exit(errors > 0 ? 1 : 0);
}

// Run cleanup
runCleanup().catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
});
