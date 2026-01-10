/**
 * Script to regenerate PreIntake demos for specific leads
 * Usage: GOOGLE_APPLICATION_CREDENTIALS="../secrets/serviceAccountKey.json" node regenerate-demos.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');

// Initialize
initializeApp({ credential: cert(require('../secrets/serviceAccountKey.json')) });
const db = getFirestore('preintake');
const bucket = getStorage().bucket('teambuilder-plus-fe74d.firebasestorage.app');

// Import the demo generator functions
const {
    generateSystemPrompt,
    generateTools,
    buildPracticeAreasList,
    getLandingHeadline,
    getLandingSubheadline,
    generateProgressSteps,
    generateLoadingStagesHtml,
    generateLoadingStagesJson,
    generateDeclineResources,
    generateDetectButtonsFunction
} = require('./demo-generator-functions');

async function regenerateDemo(leadId) {
    console.log('\n=== Regenerating demo for:', leadId, '===');

    // Get lead data
    const leadDoc = await db.collection('preintake_leads').doc(leadId).get();
    if (!leadDoc.exists) {
        console.error('Lead not found:', leadId);
        return;
    }

    const data = leadDoc.data();
    const analysis = data.analysis || {};
    const deepResearch = data.deepResearch || {};

    // Build practice areas
    const practiceBreakdown = data.practiceAreas?.breakdown || {};
    const otherPracticeAreaName = data.practiceAreas?.otherName || null;
    const practiceAreasList = buildPracticeAreasList(practiceBreakdown, otherPracticeAreaName);
    const isMultiPractice = practiceAreasList.length > 1;

    // Determine primary practice area
    let practiceArea = 'Personal Injury';
    if (practiceAreasList.length > 0) {
        const sorted = [...practiceAreasList].sort((a, b) => b.percentage - a.percentage);
        practiceArea = sorted[0].name;
    }

    const firmName = analysis.firmName || data.name || 'Law Firm';
    const state = analysis.state || data.state || 'California';

    console.log('Firm:', firmName);
    console.log('Practice Area:', practiceArea);
    console.log('State:', state);
    console.log('Multi-practice:', isMultiPractice);

    // Generate all components
    const systemPrompt = generateSystemPrompt(firmName, practiceArea, state, analysis, deepResearch, practiceBreakdown, otherPracticeAreaName, practiceAreasList, isMultiPractice);
    const tools = generateTools(practiceArea);
    const detectButtonsFunction = generateDetectButtonsFunction(practiceArea, practiceAreasList, isMultiPractice);
    const progressStepsHtml = generateProgressSteps(practiceArea);
    const loadingStagesHtml = generateLoadingStagesHtml(practiceArea);
    const loadingStagesJson = generateLoadingStagesJson(practiceArea);
    const declineResourcesHtml = generateDeclineResources(state);

    // Load template
    const template = fs.readFileSync('./templates/demo-intake.html.template', 'utf8');

    // Build logo HTML
    const logoUrl = analysis.logo || '';
    const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${firmName}" class="logo-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="logo-text" style="display:none">${firmName}</div>`
        : `<div class="logo-text">${firmName}</div>`;

    // Standardized color palette
    const primaryDark = '#0c1f3f';
    const primaryBlue = '#1a3a5c';
    const accentColor = '#c9a962';
    const accentColorLight = '#e5d4a1';

    // Avatar icon SVG
    const avatarIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>';

    // Replacements
    const replacements = {
        '{{PAGE_TITLE}}': `Free Case Evaluation - ${firmName}`,
        '{{FIRM_NAME}}': firmName,
        '{{PRIMARY_DARK}}': primaryDark,
        '{{PRIMARY_BLUE}}': primaryBlue,
        '{{ACCENT_COLOR}}': accentColor,
        '{{ACCENT_COLOR_LIGHT}}': accentColorLight,
        '{{LOGO_URL}}': logoUrl,
        '{{LOGO_HTML}}': logoHtml,
        '{{LANDING_HEADLINE}}': getLandingHeadline(practiceArea),
        '{{LANDING_SUBHEADLINE}}': getLandingSubheadline(practiceArea, firmName),
        '{{PROGRESS_STEPS_HTML}}': progressStepsHtml,
        '{{LOADING_STAGES_HTML}}': loadingStagesHtml,
        '{{LOADING_STAGES_JSON}}': loadingStagesJson,
        '{{DECLINE_RESOURCES_HTML}}': declineResourcesHtml,
        '{{PROXY_URL}}': 'https://dpm-proxy-312163687148.us-central1.run.app/api/chat',
        '{{MODEL}}': 'claude-sonnet-4-20250514',
        '{{WEBHOOK_URL}}': "'https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/handleIntakeCompletion'",
        '{{WEBHOOK_KEY}}': `'${leadId}'`,
        '{{SCHEDULE_URL}}': analysis.schedulingUrl || data.schedulingUrl || 'null',
        '{{STATE}}': state,
        '{{TOTAL_STEPS}}': practiceAreasList.length > 1 ? '5' : '4',
        '{{SYSTEM_PROMPT}}': systemPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$'),
        '{{TOOLS_JSON}}': JSON.stringify(tools, null, 2),
        '{{DETECT_BUTTONS_FUNCTION}}': detectButtonsFunction,
        '{{INITIAL_MESSAGE}}': 'Hello, I need help with a legal matter.',
        '{{AVATAR_ICON}}': avatarIcon,
        '{{LEAD_ID}}': leadId
    };

    let html = template;
    for (const [key, value] of Object.entries(replacements)) {
        html = html.split(key).join(value);
    }

    // Check for any unreplaced placeholders
    const unreplaced = html.match(/\{\{[A-Z_]+\}\}/g);
    if (unreplaced) {
        console.warn('WARNING: Unreplaced placeholders:', unreplaced);
    }

    // Upload to Storage
    const file = bucket.file(`preintake-demos/${leadId}/index.html`);
    await file.save(html, {
        contentType: 'text/html',
        metadata: { cacheControl: 'no-cache, no-store, must-revalidate' }
    });

    console.log('Demo regenerated successfully!');
}

// Main
async function main() {
    const leadsToRegenerate = [
        'LDWNdUEhcPLm6NRpmSMj',  // Emily Rubenstein Law
        'aolwszrxeJGhMdRElk7T'   // Holstrom, Block & Parke
    ];

    for (const leadId of leadsToRegenerate) {
        await regenerateDemo(leadId);
    }

    console.log('\n=== All demos regenerated ===');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
