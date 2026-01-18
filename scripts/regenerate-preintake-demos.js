#!/usr/bin/env node
/**
 * Regenerate or Patch PreIntake.ai demos
 *
 * This script can either fully regenerate demos from the template, or apply
 * targeted patches to existing demos for faster updates.
 *
 * Usage:
 *   node scripts/regenerate-preintake-demos.js                    # Dry run (list demos)
 *   node scripts/regenerate-preintake-demos.js --run              # Full regeneration
 *   node scripts/regenerate-preintake-demos.js --run --id=XXX     # Regenerate specific demo
 *   node scripts/regenerate-preintake-demos.js --patch            # Dry run patches
 *   node scripts/regenerate-preintake-demos.js --patch --run      # Apply patches to all demos
 *   node scripts/regenerate-preintake-demos.js --patch --run --id=XXX  # Patch specific demo
 *
 * Patch mode is much faster for CSS/JS template changes - it downloads existing
 * demos, applies find/replace operations, and re-uploads. Use full regeneration
 * when structural HTML changes are needed.
 */

const path = require('path');
const fs = require('fs');

// Load environment from functions directory
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const serviceAccount = require('../secrets/serviceAccountKey.json');

// Import demo generation functions and initialize Firebase via their helper
const { generateDemoFiles, uploadToStorage, initFirebaseAdmin } = require('../functions/demo-generator-functions');
const STORAGE_BUCKET = 'teambuilder-plus-fe74d.firebasestorage.app';

// Initialize Firebase Admin using the functions' helper (ensures Storage works)
const admin = initFirebaseAdmin(serviceAccount, STORAGE_BUCKET);

// Use the dedicated 'preintake' database (same pattern as campaign script)
const piDb = admin.firestore();
piDb.settings({ databaseId: 'preintake' });

// Get FieldValue from admin (not modular import, for compatibility)
const FieldValue = admin.firestore.FieldValue;

/**
 * Define patches here. Each patch has:
 * - name: descriptive name
 * - find: regex or string to find
 * - replace: replacement string (can use $1, $2, etc. for regex groups)
 * - description: what this patch does
 */
const PATCHES = [
    // Example: Fix OK button styling in demo confirmation modal
    {
        name: 'ok-button-styling',
        find: /<button onclick="closeDemoConfirmation\(\)" class="action-button primary" style="min-width: 120px;">\s*OK\s*<\/button>/,
        replace: `<button onclick="closeDemoConfirmation()" style="min-width: 140px; padding: 12px 32px; background: linear-gradient(135deg, #c9a962, #b8860b); color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(201, 169, 98, 0.3);">
                OK
            </button>`,
        description: 'Fix Demo Intake Sent modal OK button with proper white text styling'
    },
    // Add more patches as needed...
];

/**
 * Load the current template to compare against existing demos
 */
function loadCurrentTemplate() {
    const templatePath = path.join(__dirname, '../functions/templates/demo-intake.html.template');
    return fs.readFileSync(templatePath, 'utf8');
}

/**
 * Download a demo HTML from Firebase Storage
 */
async function downloadDemo(leadId) {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    const file = bucket.file(`preintake-demos/${leadId}/index.html`);

    try {
        const [content] = await file.download();
        return content.toString('utf8');
    } catch (error) {
        if (error.code === 404) {
            return null;
        }
        throw error;
    }
}

/**
 * Upload patched demo HTML to Firebase Storage
 */
async function uploadPatchedDemo(leadId, htmlContent) {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    const file = bucket.file(`preintake-demos/${leadId}/index.html`);

    await file.save(htmlContent, {
        contentType: 'text/html',
        metadata: {
            cacheControl: 'public, max-age=300', // 5 minute cache
        }
    });

    return `https://storage.googleapis.com/${STORAGE_BUCKET}/preintake-demos/${leadId}/index.html`;
}

/**
 * Apply patches to demo HTML content
 * Returns { patched: boolean, content: string, appliedPatches: string[] }
 */
function applyPatches(htmlContent, patchesToApply = PATCHES) {
    let content = htmlContent;
    let patched = false;
    const appliedPatches = [];

    for (const patch of patchesToApply) {
        const regex = patch.find instanceof RegExp ? patch.find : new RegExp(escapeRegex(patch.find), 'g');

        if (regex.test(content)) {
            // Reset regex lastIndex for replacement
            regex.lastIndex = 0;
            content = content.replace(regex, patch.replace);
            patched = true;
            appliedPatches.push(patch.name);
        }
    }

    return { patched, content, appliedPatches };
}

/**
 * Check if a demo needs patching (without applying)
 */
function checkNeedsPatching(htmlContent, patchesToApply = PATCHES) {
    const needsPatches = [];

    for (const patch of patchesToApply) {
        const regex = patch.find instanceof RegExp ? patch.find : new RegExp(escapeRegex(patch.find), 'g');

        if (regex.test(htmlContent)) {
            needsPatches.push(patch.name);
        }
    }

    return needsPatches;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function patchDemos(options = {}) {
    const { dryRun = true, specificId = null } = options;

    console.log('🔧 PreIntake.ai Demo Patch Tool');
    console.log('================================');
    console.log(`Mode: ${dryRun ? 'DRY RUN (use --run to actually patch)' : 'LIVE - Applying patches'}`);
    console.log('');

    // Show available patches
    console.log('Available patches:');
    for (const patch of PATCHES) {
        console.log(`  • ${patch.name}: ${patch.description}`);
    }
    console.log('');

    // Get all demo_ready leads (or specific one)
    let leads = [];

    if (specificId) {
        const doc = await piDb.collection('preintake_leads').doc(specificId).get();
        if (!doc.exists) {
            console.log(`❌ Lead ${specificId} not found`);
            return;
        }
        if (doc.data().status !== 'demo_ready') {
            console.log(`❌ Lead ${specificId} is not demo_ready (status: ${doc.data().status})`);
            return;
        }
        leads.push({ id: doc.id, data: doc.data() });
    } else {
        const snapshot = await piDb.collection('preintake_leads').where('status', '==', 'demo_ready').get();
        snapshot.forEach(doc => {
            leads.push({ id: doc.id, data: doc.data() });
        });
    }

    console.log(`Found ${leads.length} demos to check\n`);

    let needsPatchCount = 0;
    let patchedCount = 0;
    let upToDateCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
        const firmName = lead.data.name || lead.data.analysis?.firmName || 'Unknown';
        process.stdout.write(`📋 ${lead.id} (${firmName})... `);

        try {
            // Download existing demo
            const existingHtml = await downloadDemo(lead.id);

            if (!existingHtml) {
                console.log('⚠️ No demo file found');
                errorCount++;
                continue;
            }

            // Check what patches are needed
            const needsPatches = checkNeedsPatching(existingHtml);

            if (needsPatches.length === 0) {
                console.log('✅ Up to date');
                upToDateCount++;
                continue;
            }

            needsPatchCount++;

            if (dryRun) {
                console.log(`🔄 Needs patches: ${needsPatches.join(', ')}`);
                continue;
            }

            // Apply patches
            const { content, appliedPatches } = applyPatches(existingHtml);

            // Upload patched demo
            await uploadPatchedDemo(lead.id, content);

            // Update Firestore timestamp
            await piDb.collection('preintake_leads').doc(lead.id).update({
                'demo.patchedAt': FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`✅ Patched: ${appliedPatches.join(', ')}`);
            patchedCount++;

        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n========================================');
    console.log('Summary:');
    console.log(`  ✅ Up to date: ${upToDateCount}`);
    console.log(`  🔄 ${dryRun ? 'Need patching' : 'Patched'}: ${dryRun ? needsPatchCount : patchedCount}`);
    if (errorCount > 0) console.log(`  ❌ Errors: ${errorCount}`);

    if (dryRun && needsPatchCount > 0) {
        console.log('\nTo apply patches, run:');
        console.log('  node scripts/regenerate-preintake-demos.js --patch --run');
    }
}

async function regenerateDemos(options = {}) {
    const { dryRun = true, specificId = null } = options;

    console.log('🔄 PreIntake.ai Demo Regeneration Tool');
    console.log('=====================================');
    console.log(`Mode: ${dryRun ? 'DRY RUN (use --run to actually regenerate)' : 'LIVE - Regenerating demos'}`);
    console.log('');
    console.log('💡 Tip: For CSS/JS changes, use --patch mode for faster updates');
    console.log('');

    // Get all demo_ready leads (or specific one)
    let query = piDb.collection('preintake_leads').where('status', '==', 'demo_ready');

    if (specificId) {
        // Get specific document
        const doc = await piDb.collection('preintake_leads').doc(specificId).get();
        if (!doc.exists) {
            console.log(`❌ Lead ${specificId} not found`);
            return;
        }
        if (doc.data().status !== 'demo_ready') {
            console.log(`❌ Lead ${specificId} is not demo_ready (status: ${doc.data().status})`);
            return;
        }

        const data = doc.data();
        console.log(`Found lead: ${specificId}`);
        console.log(`  Firm: ${data.name || data.analysis?.firmName || 'Unknown'}`);
        console.log(`  Source: ${data.source || 'form'}`);
        console.log(`  Created: ${data.createdAt?.toDate?.() || 'unknown'}`);
        console.log(`  Demo Generated: ${data.demo?.generatedAt?.toDate?.() || 'unknown'}`);
        console.log('');

        if (!dryRun) {
            await regenerateDemo(doc.id, data);
        }
        return;
    }

    const snapshot = await query.get();

    // Collect and sort by creation date
    const leads = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        leads.push({
            id: doc.id,
            data: data,
            firm: data.name || data.analysis?.firmName || 'Unknown',
            source: data.source || 'form',
            created: data.createdAt?.toDate?.() || null,
            demoGenerated: data.demo?.generatedAt?.toDate?.() || null
        });
    });

    leads.sort((a, b) => (a.created || 0) - (b.created || 0));

    console.log(`Found ${leads.length} demo_ready leads:\n`);

    for (const lead of leads) {
        console.log(`📋 ${lead.id}`);
        console.log(`   Firm: ${lead.firm}`);
        console.log(`   Source: ${lead.source}`);
        console.log(`   Created: ${lead.created?.toISOString() || 'unknown'}`);
        console.log(`   Demo Generated: ${lead.demoGenerated?.toISOString() || 'never'}`);

        if (!dryRun) {
            await regenerateDemo(lead.id, lead.data);
        }
        console.log('');
    }

    if (dryRun) {
        console.log('----------------------------------------');
        console.log('This was a dry run. To actually regenerate demos, run:');
        console.log('  node scripts/regenerate-preintake-demos.js --run');
        console.log('');
        console.log('Or regenerate a specific demo:');
        console.log('  node scripts/regenerate-preintake-demos.js --run --id=LEAD_ID');
    }
}

async function regenerateDemo(leadId, leadData) {
    try {
        console.log(`   🏗️ Regenerating demo...`);

        const analysis = leadData.analysis || {};
        const deepResearch = leadData.deepResearch || {};

        // Generate the demo HTML using the current template
        const { htmlContent, configContent } = generateDemoFiles(leadId, leadData, analysis, deepResearch);

        // Upload to Firebase Storage
        const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);

        // Update Firestore with new generation timestamp
        await piDb.collection('preintake_leads').doc(leadId).update({
            demoUrl: demoUrl,
            'demo.generatedAt': FieldValue.serverTimestamp(),
            'demo.regeneratedAt': FieldValue.serverTimestamp(),
            'demo.version': '1.1.0', // Bump version to indicate regeneration
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Demo regenerated: ${demoUrl}`);
    } catch (error) {
        console.log(`   ❌ Error regenerating demo: ${error.message}`);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--run');
const patchMode = args.includes('--patch');
const idArg = args.find(a => a.startsWith('--id='));
const specificId = idArg ? idArg.split('=')[1] : null;

// Run appropriate mode
const runFn = patchMode ? patchDemos : regenerateDemos;

runFn({ dryRun, specificId })
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
