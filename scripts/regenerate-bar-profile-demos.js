#!/usr/bin/env node
/**
 * Regenerate bar profile demos with updated mapBarPracticeArea mappings
 *
 * This script regenerates demos for bar_profile_campaign leads that may have
 * been created with "General Practice" due to incomplete practice area mapping.
 *
 * Usage:
 *   node scripts/regenerate-bar-profile-demos.js           # Dry run
 *   node scripts/regenerate-bar-profile-demos.js --run     # Apply changes
 */

const path = require('path');

// Load environment from functions directory
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const serviceAccount = require('../secrets/serviceAccountKey.json');

// Import demo generation functions and initialize Firebase via their helper
const { generateBarProfileDemo, uploadToStorage, initFirebaseAdmin, mapBarPracticeArea } = require('../functions/demo-generator-functions');
const STORAGE_BUCKET = 'teambuilder-plus-fe74d.firebasestorage.app';

// Initialize Firebase Admin using the functions' helper
const admin = initFirebaseAdmin(serviceAccount, STORAGE_BUCKET);

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = !process.argv.includes('--run');

async function main() {
    console.log('='.repeat(70));
    console.log('Regenerate Bar Profile Demos');
    console.log('='.repeat(70));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (regenerating demos)'}`);
    console.log('');

    // Find all bar profile leads with demo_ready status
    console.log('Finding bar profile leads...');
    const leadsSnapshot = await db.collection('preintake_leads')
        .where('source', '==', 'bar_profile_campaign')
        .where('status', '==', 'demo_ready')
        .get();

    console.log(`Found ${leadsSnapshot.size} bar profile leads\n`);

    if (leadsSnapshot.size === 0) {
        console.log('No leads to process. Exiting.');
        process.exit(0);
    }

    let regenerated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of leadsSnapshot.docs) {
        const leadId = doc.id;
        const leadData = doc.data();
        const email = leadData.email;
        const storedPracticeArea = leadData.confirmedPracticeAreas?.primaryArea || 'General Practice';

        // Map the practice area through the updated function
        const mappedPracticeArea = mapBarPracticeArea(storedPracticeArea);

        console.log(`Processing: ${leadData.name || email} (${leadId})`);
        console.log(`   Stored practice area: ${storedPracticeArea}`);
        console.log(`   Mapped practice area: ${mappedPracticeArea}`);

        if (DRY_RUN) {
            console.log(`   🔍 DRY RUN: Would regenerate demo`);
            regenerated++;
        } else {
            try {
                // Extract contact data
                const nameParts = (leadData.name || '').split(' ');
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts.slice(1).join(' ') || '';
                const state = leadData.state || null;
                const barNumber = leadData.barNumber || null;
                const firmName = leadData.name;

                // Regenerate demo with mapped practice area
                console.log(`   🏗️ Regenerating demo...`);

                const { htmlContent, configContent } = generateBarProfileDemo(leadId, {
                    firstName,
                    lastName,
                    practiceArea: storedPracticeArea, // Pass original, function will map it
                    email,
                    state,
                    firmName,
                    barNumber
                });

                // Upload to Firebase Storage
                const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);
                console.log(`   ✓ Demo uploaded: ${demoUrl}`);

                regenerated++;
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errors++;
            }
        }

        console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('Summary');
    console.log('='.repeat(70));
    console.log(`Total leads processed: ${leadsSnapshot.size}`);
    console.log(`Regenerated: ${regenerated}`);
    console.log(`Errors: ${errors}`);
    console.log('');

    if (!DRY_RUN) {
        // Verification
        console.log('Verifying demo content...\n');

        let verified = 0;
        let verifyErrors = [];

        for (const doc of leadsSnapshot.docs) {
            const leadId = doc.id;
            const leadData = doc.data();
            const storedPracticeArea = leadData.confirmedPracticeAreas?.primaryArea || 'General Practice';
            const mappedPracticeArea = mapBarPracticeArea(storedPracticeArea);

            const demoUrl = leadData.demoUrl;
            if (demoUrl) {
                try {
                    const https = require('https');
                    const demoContent = await new Promise((resolve, reject) => {
                        https.get(demoUrl, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => resolve(data));
                            res.on('error', reject);
                        }).on('error', reject);
                    });

                    // Check if demo contains the correct (mapped) practice area
                    const hasCorrectPracticeArea = mappedPracticeArea === 'General Practice' ||
                        demoContent.includes(`a ${mappedPracticeArea} law firm`) ||
                        demoContent.includes(`a ${mappedPracticeArea.replace(' ', '-').toLowerCase()} law firm`);

                    if (hasCorrectPracticeArea) {
                        console.log(`✓ ${leadId}: ${mappedPracticeArea}`);
                        verified++;
                    } else {
                        // Check what's actually in the demo
                        const match = demoContent.match(/You are an intake specialist for .+?, a ([^.]+) law firm/);
                        const actualPracticeArea = match ? match[1] : 'unknown';
                        console.log(`✗ ${leadId}: Expected "${mappedPracticeArea}", found "${actualPracticeArea}"`);
                        verifyErrors.push({ leadId, expected: mappedPracticeArea, actual: actualPracticeArea });
                    }
                } catch (e) {
                    console.log(`✗ ${leadId}: Could not fetch demo - ${e.message}`);
                    verifyErrors.push({ leadId, error: e.message });
                }
            }
        }

        console.log('');
        console.log('='.repeat(70));
        console.log('Verification Summary');
        console.log('='.repeat(70));
        console.log(`Verified: ${verified}/${regenerated}`);
        console.log(`Verification errors: ${verifyErrors.length}`);

        if (verifyErrors.length > 0) {
            console.log('\nFailed verifications:');
            verifyErrors.forEach(err => {
                if (err.error) {
                    console.log(`  ${err.leadId}: ${err.error}`);
                } else {
                    console.log(`  ${err.leadId}: Expected "${err.expected}", found "${err.actual}"`);
                }
            });
        }
    } else {
        console.log('To apply changes, run with --run flag:');
        console.log('  node scripts/regenerate-bar-profile-demos.js --run');
    }

    process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
