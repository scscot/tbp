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

/**
 * Clean firm name by removing address information that may be concatenated
 * Handles cases like "Lisa L. Cullaro, P.A.PO Box 271150Tampa, FL 33688-1150"
 * @param {string} firmText - Raw firm text that may contain address
 * @returns {string} Cleaned firm name
 */
function cleanFirmName(firmText) {
    if (!firmText) return '';
    let cleaned = firmText.trim();

    // Pattern 1: PO Box (with or without space after number)
    const poBoxMatch = cleaned.match(/^(.+?)\s*PO\s*Box/i);
    if (poBoxMatch) {
        return poBoxMatch[1].trim();
    }

    // Pattern 2: Street number followed by text (standard address)
    const streetMatch = cleaned.match(/^(.+?)(\d+\s*[A-Za-z])/);
    if (streetMatch && streetMatch[1].length > 3) {
        return streetMatch[1].trim();
    }

    // Pattern 3: State abbreviation + ZIP code
    const stateZipMatch = cleaned.match(/^(.+?),\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/);
    if (stateZipMatch) {
        return stateZipMatch[1].trim();
    }

    // Pattern 4: 5-digit ZIP code anywhere (last resort)
    const zipMatch = cleaned.match(/^(.+?)\d{5}(-\d{4})?/);
    if (zipMatch && zipMatch[1].length > 3) {
        const candidate = zipMatch[1].trim();
        const finalCleaned = candidate.replace(/,\s*[A-Za-z\s]*$/, '').trim();
        if (finalCleaned.length > 3) {
            return finalCleaned;
        }
    }

    // No address patterns found - return as-is (unless it starts with a number)
    if (!cleaned.match(/^\d/)) {
        return cleaned;
    }
    return '';
}

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

                // Clean firm name to remove any address info from scraper data
                const rawFirmName = leadData.name || '';
                const cleanedFirmName = cleanFirmName(rawFirmName);
                const firmName = cleanedFirmName || `${firstName} ${lastName}, Attorney at Law`;

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
