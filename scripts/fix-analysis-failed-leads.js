#!/usr/bin/env node
/**
 * Fix script for analysis_failed bar profile leads
 *
 * Problem: 47 bar profile leads were created without hasWebsite: false flag,
 * causing the Firestore analysis trigger to run and fail (no website to analyze).
 * The demos were generated with "General Practice" instead of actual practice area.
 *
 * This script:
 * 1. Finds all analysis_failed leads with source: bar_profile_campaign
 * 2. Looks up the correct practiceArea from preintake_emails collection
 * 3. Regenerates demos with correct practice area
 * 4. Updates lead documents with hasWebsite: false and status: demo_ready
 * 5. Verifies all fixes were properly applied
 *
 * Usage:
 *   node scripts/fix-analysis-failed-leads.js           # Dry run (no changes)
 *   node scripts/fix-analysis-failed-leads.js --run     # Apply fixes
 */

const path = require('path');

// Load environment from functions directory
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const serviceAccount = require('../secrets/serviceAccountKey.json');

// Import demo generation functions and initialize Firebase via their helper
const { generateBarProfileDemo, uploadToStorage, initFirebaseAdmin } = require('../functions/demo-generator-functions');
const STORAGE_BUCKET = 'teambuilder-plus-fe74d.firebasestorage.app';

// Initialize Firebase Admin using the functions' helper (ensures Storage works)
const admin = initFirebaseAdmin(serviceAccount, STORAGE_BUCKET);

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = !process.argv.includes('--run');

async function main() {
    console.log('='.repeat(70));
    console.log('Fix Analysis Failed Bar Profile Leads');
    console.log('='.repeat(70));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (applying fixes)'}`);
    console.log('');

    // Step 1: Find all analysis_failed leads with source: bar_profile_campaign
    console.log('Step 1: Finding analysis_failed bar profile leads...');
    const leadsSnapshot = await db.collection('preintake_leads')
        .where('status', '==', 'analysis_failed')
        .where('source', '==', 'bar_profile_campaign')
        .get();

    console.log(`   Found ${leadsSnapshot.size} leads to fix\n`);

    if (leadsSnapshot.size === 0) {
        console.log('No leads to fix. Exiting.');
        process.exit(0);
    }

    // Step 2: Process each lead
    console.log('Step 2: Processing leads...\n');

    let fixed = 0;
    let errors = 0;
    const results = [];

    for (const doc of leadsSnapshot.docs) {
        const leadId = doc.id;
        const leadData = doc.data();
        const email = leadData.email;

        console.log(`Processing: ${leadData.name || email} (${leadId})`);

        try {
            // Look up contact in preintake_emails to get correct practiceArea
            const emailSnapshot = await db.collection('preintake_emails')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (emailSnapshot.empty) {
                console.log(`   ❌ Contact not found in preintake_emails`);
                errors++;
                results.push({ leadId, email, status: 'error', reason: 'Contact not found' });
                continue;
            }

            const contactData = emailSnapshot.docs[0].data();
            const practiceArea = contactData.practiceArea || 'General Practice';
            const firstName = contactData.firstName || leadData.name?.split(' ')[0] || 'Unknown';
            const lastName = contactData.lastName || leadData.name?.split(' ').slice(1).join(' ') || '';
            const state = contactData.state || leadData.state || null;
            const barNumber = contactData.barNumber || leadData.barNumber || null;
            const firmName = contactData.firmName || leadData.name;

            console.log(`   📋 Practice area from preintake_emails: ${practiceArea}`);
            console.log(`   📋 Current lead confirmedPracticeAreas: ${leadData.confirmedPracticeAreas?.primaryArea || 'undefined'}`);

            if (DRY_RUN) {
                console.log(`   🔍 DRY RUN: Would regenerate demo with practice area: ${practiceArea}`);
                console.log(`   🔍 DRY RUN: Would update status to demo_ready, hasWebsite: false`);
                results.push({ leadId, email, status: 'would_fix', practiceArea });
                fixed++;
            } else {
                // Regenerate demo with correct practice area
                console.log(`   🏗️ Regenerating demo with practice area: ${practiceArea}...`);

                const { htmlContent, configContent } = generateBarProfileDemo(leadId, {
                    firstName,
                    lastName,
                    practiceArea,
                    email,
                    state,
                    firmName,
                    barNumber
                });

                // Upload to Firebase Storage
                const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);
                console.log(`   ✓ Demo uploaded: ${demoUrl}`);

                // Update lead document
                const updatePayload = {
                    status: 'demo_ready',
                    hasWebsite: false,
                    hosted: true,
                    'analysis.status': 'skipped',
                    'analysis.error': admin.firestore.FieldValue.delete(),
                    'confirmedPracticeAreas.primaryArea': practiceArea,
                    'confirmedPracticeAreas.areas': [practiceArea],
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('preintake_leads').doc(leadId).update(updatePayload);
                console.log(`   ✓ Lead document updated: status=demo_ready, hasWebsite=false`);

                results.push({ leadId, email, status: 'fixed', practiceArea });
                fixed++;
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            errors++;
            results.push({ leadId, email, status: 'error', reason: error.message });
        }

        console.log('');
    }

    // Step 3: Summary
    console.log('='.repeat(70));
    console.log('Summary');
    console.log('='.repeat(70));
    console.log(`Total leads processed: ${leadsSnapshot.size}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Errors: ${errors}`);
    console.log('');

    if (!DRY_RUN) {
        // Step 4: Verification
        console.log('Step 3: Verifying fixes...\n');

        let verified = 0;
        let verifyErrors = [];

        for (const result of results) {
            if (result.status !== 'fixed') continue;

            const { leadId, practiceArea } = result;

            // Verify lead document
            const leadDoc = await db.collection('preintake_leads').doc(leadId).get();
            const leadData = leadDoc.data();

            const checks = {
                status: leadData.status === 'demo_ready',
                hasWebsite: leadData.hasWebsite === false,
                practiceArea: leadData.confirmedPracticeAreas?.primaryArea === practiceArea
            };

            // Verify demo content
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

                    // Check if demo contains the correct practice area (not "General Practice" unless that's correct)
                    const hasCorrectPracticeArea = practiceArea === 'General Practice' ||
                        !demoContent.includes('a General Practice law firm');
                    checks.demoContent = hasCorrectPracticeArea;
                } catch (e) {
                    checks.demoContent = false;
                }
            }

            const allPassed = Object.values(checks).every(v => v);

            if (allPassed) {
                console.log(`✓ ${leadId}: All checks passed`);
                verified++;
            } else {
                const failed = Object.entries(checks).filter(([k, v]) => !v).map(([k]) => k);
                console.log(`✗ ${leadId}: Failed checks: ${failed.join(', ')}`);
                verifyErrors.push({ leadId, failed });
            }
        }

        console.log('');
        console.log('='.repeat(70));
        console.log('Verification Summary');
        console.log('='.repeat(70));
        console.log(`Verified: ${verified}/${fixed}`);
        console.log(`Verification errors: ${verifyErrors.length}`);

        if (verifyErrors.length > 0) {
            console.log('\nFailed verifications:');
            verifyErrors.forEach(({ leadId, failed }) => {
                console.log(`  ${leadId}: ${failed.join(', ')}`);
            });
        }
    } else {
        console.log('To apply fixes, run with --run flag:');
        console.log('  node scripts/fix-analysis-failed-leads.js --run');
    }

    process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
