#!/usr/bin/env node
/**
 * Regenerate PreIntake.ai demos to use the latest template
 *
 * This script finds all demo_ready leads and regenerates their demo HTML
 * using the current demo-intake.html.template file. Useful when the template
 * has been updated with new features (like the onboarding modal).
 *
 * Usage:
 *   node scripts/regenerate-preintake-demos.js           # Dry run (list demos)
 *   node scripts/regenerate-preintake-demos.js --run     # Actually regenerate
 *   node scripts/regenerate-preintake-demos.js --id=XXX  # Regenerate specific demo
 */

const path = require('path');

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

async function regenerateDemos(options = {}) {
    const { dryRun = true, specificId = null } = options;

    console.log('🔄 PreIntake.ai Demo Regeneration Tool');
    console.log('=====================================');
    console.log(`Mode: ${dryRun ? 'DRY RUN (use --run to actually regenerate)' : 'LIVE - Regenerating demos'}`);
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
const idArg = args.find(a => a.startsWith('--id='));
const specificId = idArg ? idArg.split('=')[1] : null;

regenerateDemos({ dryRun, specificId })
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
