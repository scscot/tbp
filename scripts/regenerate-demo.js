#!/usr/bin/env node
/**
 * Regenerate demo for a specific lead
 * Usage: LEAD_ID=xxx node scripts/regenerate-demo.js
 */

const path = require('path');

// Initialize Firebase Admin FIRST (before importing demo functions)
const admin = require('../functions/node_modules/firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
});

// Now import demo generator (uses same firebase-admin instance)
const { generateDemoFiles, uploadToStorage } = require('../functions/demo-generator-functions');

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

async function regenerateDemo(leadId) {
    console.log(`\nRegenerating demo for lead: ${leadId}`);

    // Get lead document
    const leadDoc = await db.collection('preintake_leads').doc(leadId).get();
    if (!leadDoc.exists) {
        console.error(`Lead ${leadId} not found`);
        process.exit(1);
    }

    const leadData = leadDoc.data();
    const analysis = leadData.analysis || {};
    const deepResearch = leadData.deepResearch || {};

    console.log(`Firm name from leadData.name: ${leadData.name}`);
    console.log(`Firm name from analysis.firmName: ${analysis.firmName}`);
    console.log(`Lead source: ${leadData.source}`);

    // Generate demo files
    console.log('\nGenerating demo files...');
    const { htmlContent, configContent } = generateDemoFiles(leadId, leadData, analysis, deepResearch);

    // Check the firm name used
    const firmNameMatch = htmlContent.match(/<title>Free Case Evaluation - ([^<]+)<\/title>/);
    console.log(`Firm name in generated HTML: ${firmNameMatch ? firmNameMatch[1] : 'not found'}`);

    // Upload to Storage
    console.log('\nUploading to Firebase Storage...');
    const demoUrl = await uploadToStorage(leadId, htmlContent, JSON.stringify(configContent));

    console.log(`\n✅ Demo regenerated successfully!`);
    console.log(`Demo URL: ${demoUrl}`);

    // Update Firestore with new demo URL
    await db.collection('preintake_leads').doc(leadId).update({
        demoUrl: demoUrl,
        demoRegeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Firestore updated with new demo URL`);
}

const leadId = process.env.LEAD_ID;
if (!leadId) {
    console.error('Usage: LEAD_ID=xxx node scripts/regenerate-demo.js');
    process.exit(1);
}

regenerateDemo(leadId).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
