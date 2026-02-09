#!/usr/bin/env node
/**
 * Force regenerate a specific demo regardless of status
 */

const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '../secrets/serviceAccountKey.json'), 'utf8'));
const app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app'
}, 'regen-force');

const db = getFirestore(app, 'preintake');
const bucket = getStorage(app).bucket();

async function regenerateDemo(leadId) {
    console.log(`\n🔄 Force regenerating demo: ${leadId}\n`);

    const leadDoc = await db.collection('preintake_leads').doc(leadId).get();

    if (!leadDoc.exists) {
        console.log('❌ Lead not found');
        return;
    }

    const lead = leadDoc.data();
    console.log('Lead status:', lead.status);
    console.log('Firm name:', lead.firmName);

    // Read template
    const templatePath = path.join(__dirname, '../functions/templates/demo-intake.html.template');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Get practiceAreas
    const practiceAreas = lead.analysisData?.practiceAreas || lead.practiceAreas || ['General'];
    const firmName = lead.firmName || 'Your Law Firm';
    const firmEmail = lead.email || lead.deliveryEmail || '';
    const isMultiPractice = practiceAreas.length > 1;
    const primaryPracticeArea = practiceAreas[0] || 'General';

    // Build CONFIG
    const config = {
        firmName: firmName,
        firmEmail: firmEmail,
        practiceAreas: practiceAreas,
        leadId: leadId
    };

    // Generate landing headline/subheadline
    const landingHeadline = isMultiPractice ? 'Free Consultation' : `Free ${primaryPracticeArea} Consultation`;
    const landingSubheadline = isMultiPractice
        ? `Find out if ${firmName} can help with your legal matter in under 5 minutes. We'll review your situation quickly, carefully, and confidentially.`
        : `Find out if ${firmName} can help with your ${primaryPracticeArea.toLowerCase()} matter in under 5 minutes. We'll review your situation quickly, carefully, and confidentially.`;

    // Replace placeholders
    template = template.replace(/{{LEAD_ID}}/g, leadId);
    template = template.replace(/{{PAGE_TITLE}}/g, firmName + ' | Free Consultation');
    template = template.replace(/{{FIRM_NAME}}/g, firmName.replace(/'/g, "\\'"));
    template = template.replace(/{{LOGO_HTML}}/g, '<span class="logo-text">' + firmName + '</span>');
    template = template.replace(/{{PRACTICE_AREAS_JSON}}/g, JSON.stringify(practiceAreas));
    template = template.replace(/{{PRIMARY_DARK}}/g, '#0a1628');
    template = template.replace(/{{PRIMARY_BLUE}}/g, '#1a365d');
    template = template.replace(/{{ACCENT_COLOR}}/g, '#c9a962');
    template = template.replace(/{{ACCENT_COLOR_LIGHT}}/g, '#d4b978');
    template = template.replace(/{{CONFIG_JSON}}/g, JSON.stringify(config));
    template = template.replace(/{{IS_MULTI_PRACTICE}}/g, isMultiPractice ? 'true' : 'false');
    template = template.replace(/{{FIRM_PRACTICE_AREAS}}/g, JSON.stringify(practiceAreas));
    template = template.replace(/{{LANDING_HEADLINE}}/g, landingHeadline);
    template = template.replace(/{{LANDING_SUBHEADLINE}}/g, landingSubheadline);

    // Upload
    const file = bucket.file('preintake-demos/' + leadId + '/index.html');
    await file.save(template, {
        contentType: 'text/html',
        metadata: {
            cacheControl: 'public, max-age=300'
        }
    });

    console.log('✅ Demo regenerated successfully');

    // Verify skip_onboarding is in the template
    if (template.includes('skip_onboarding')) {
        console.log('✅ skip_onboarding logic confirmed in output');
    } else {
        console.log('❌ skip_onboarding logic NOT found');
    }

    process.exit(0);
}

const leadId = process.argv[2] || '9yXCw3SXVjBeHJTbD4qr';
regenerateDemo(leadId).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
