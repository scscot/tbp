#!/usr/bin/env node
/**
 * Force regenerate a specific demo regardless of status.
 * Uses the same generateDemoFiles function as the production demo generator.
 *
 * Usage:
 *   node scripts/force-regen-demo.js LEAD_ID
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

// Use the dedicated 'preintake' database
const piDb = admin.firestore();
piDb.settings({ databaseId: 'preintake' });

const FieldValue = admin.firestore.FieldValue;

async function forceRegenDemo(leadId) {
    console.log(`\n🔄 Force regenerating demo: ${leadId}\n`);

    const doc = await piDb.collection('preintake_leads').doc(leadId).get();
    if (!doc.exists) {
        console.log('❌ Lead not found');
        process.exit(1);
    }

    const leadData = doc.data();
    console.log('Lead status:', leadData.status);
    console.log('Firm name:', leadData.name || leadData.firmName || leadData.analysis?.firmName || 'Unknown');

    try {
        const analysis = leadData.analysis || {};
        const deepResearch = leadData.deepResearch || {};

        console.log('🏗️ Generating demo files...');

        // Generate the demo HTML using the current template
        const { htmlContent, configContent } = generateDemoFiles(leadId, leadData, analysis, deepResearch);

        console.log('📤 Uploading to Firebase Storage...');

        // Upload to Firebase Storage
        const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);

        // Update Firestore with new generation timestamp
        await piDb.collection('preintake_leads').doc(leadId).update({
            demoUrl: demoUrl,
            'demo.generatedAt': FieldValue.serverTimestamp(),
            'demo.regeneratedAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log('✅ Demo regenerated successfully');
        console.log(`📍 URL: ${demoUrl}`);

        // Verify skip_onboarding is in the template
        if (htmlContent.includes('skip_onboarding')) {
            console.log('✅ skip_onboarding logic confirmed in output');
        } else {
            console.log('❌ skip_onboarding logic NOT found');
        }

        // Verify CONFIG placeholders are replaced
        if (htmlContent.includes("{{WEBHOOK_URL}}")) {
            console.log('❌ WARNING: {{WEBHOOK_URL}} placeholder not replaced!');
        } else {
            console.log('✅ WEBHOOK_URL properly replaced');
        }

        if (htmlContent.includes("{{FIRM_NAME_JS}}")) {
            console.log('❌ WARNING: {{FIRM_NAME_JS}} placeholder not replaced!');
        } else {
            console.log('✅ FIRM_NAME_JS properly replaced');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error regenerating demo:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

const leadId = process.argv[2];
if (!leadId) {
    console.error('Usage: node scripts/force-regen-demo.js LEAD_ID');
    process.exit(1);
}

forceRegenDemo(leadId);
