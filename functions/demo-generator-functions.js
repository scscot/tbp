/**
 * PreIntake.ai Demo Generator Functions
 * Generates enterprise-grade, standalone HTML intake demo pages for law firms
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

/**
 * Initialize Firebase Admin for script usage (external callers like regenerate-preintake-demos.js)
 *
 * IMPORTANT: This function is NOT used within Cloud Functions context.
 * Cloud Functions initialize Firebase automatically via their trigger context.
 * This function exists solely for external scripts that need to:
 * - Access the same Firestore database
 * - Use the same Storage bucket
 * - Call exported utility functions like generateDemoFiles() and uploadToStorage()
 *
 * @param {Object} serviceAccount - Service account credentials JSON
 * @param {string} storageBucket - Firebase Storage bucket name
 * @returns {Object} Initialized firebase-admin instance
 */
function initFirebaseAdmin(serviceAccount, storageBucket) {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: storageBucket
        });
    }
    return admin;
}
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Secrets
const smtpUser = defineSecret('PREINTAKE_SMTP_USER');
const smtpPass = defineSecret('PREINTAKE_SMTP_PASS');

// Constants
const NOTIFY_EMAIL = 'stephen@preintake.ai';
const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const PROXY_URL = 'https://dpm-proxy-312163687148.us-central1.run.app/api/chat';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const STORAGE_BUCKET = 'teambuilder-plus-fe74d.firebasestorage.app';

/**
 * Generate a unique 6-digit alphanumeric intake code
 * Uses uppercase letters and numbers, excluding confusing characters (0, O, I, 1, L)
 * @param {Object} db - Firestore database instance
 * @returns {Promise<string>} Unique 6-character code
 */
async function generateUniqueIntakeCode(db) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0, O, I, 1, L
    const maxAttempts = 10;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Generate random 6-character code
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Check if code already exists
        const existingDocs = await db.collection('preintake_leads')
            .where('intakeCode', '==', code)
            .limit(1)
            .get();

        if (existingDocs.empty) {
            return code;
        }
        console.log(`Intake code ${code} already exists, generating new one (attempt ${attempt + 1})`);
    }

    // Fallback: use timestamp-based code if all random attempts fail
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    return timestamp;
}

/**
 * Firestore trigger: Generate demo when deep research completes
 * Triggers when status changes from 'researching' to 'generating_demo'
 * Uses dedicated 'preintake' database (separate from default TBP database)
 */
const generatePreIntakeDemo = onDocumentUpdated(
    {
        document: 'preintake_leads/{leadId}',
        database: 'preintake',
        region: 'us-west1',
        secrets: [smtpUser, smtpPass],
        timeoutSeconds: 120,
        memory: '512MiB',
    },
    async (event) => {
        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();

        // Only trigger when status changes to 'generating_demo'
        if (beforeData.status === afterData.status) return;
        if (afterData.status !== 'generating_demo') return;

        const leadId = event.params.leadId;
        console.log(`Starting demo generation for lead ${leadId}`);

        // Use the dedicated 'preintake' database
        const db = getFirestore('preintake');
        const leadRef = db.collection('preintake_leads').doc(leadId);

        try {
            let htmlContent, configContent;
            let analysis = afterData.analysis || {};

            // Check if this is a hosted lead (no website, from landing page form)
            if (afterData.hosted === true || afterData.hasWebsite === false) {
                console.log(`Generating hosted demo for lead ${leadId} (no website)`);

                // Extract first/last name from full name
                const nameParts = (afterData.name || '').trim().split(/\s+/);
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                // Build contactData for generateBarProfileDemo
                const contactData = {
                    firstName,
                    lastName,
                    email: afterData.email,
                    firmName: afterData.firmName || `${firstName} ${lastName}, Attorney at Law`,
                    practiceArea: afterData.primaryArea || (afterData.practiceAreas?.[0]) || 'General Practice',
                    state: afterData.state || 'CA',
                    phone: afterData.phone || ''
                };

                // Use practiceAreas array if available (hosted form collects multiple)
                const practiceAreasOverride = Array.isArray(afterData.practiceAreas) && afterData.practiceAreas.length > 0
                    ? afterData.practiceAreas
                    : null;

                const result = generateBarProfileDemo(leadId, contactData, practiceAreasOverride);
                htmlContent = result.htmlContent;
                configContent = result.configContent;

                // Build synthetic analysis object for email functions
                analysis = {
                    firmName: contactData.firmName,
                    primaryPracticeArea: contactData.practiceArea,
                    location: { state: contactData.state }
                };
            } else {
                // Standard website-based lead with analysis data
                const deepResearch = afterData.deepResearch || {};  // Top level, not under analysis

                // Generate the demo HTML
                const result = generateDemoFiles(leadId, afterData, analysis, deepResearch);
                htmlContent = result.htmlContent;
                configContent = result.configContent;
            }

            // Upload to Firebase Storage
            const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);

            console.log(`Demo generated for lead ${leadId}: ${demoUrl}`);

            // Check if this is an auto-confirmed flow (from landing page form)
            const isAutoConfirmed = afterData.autoConfirmed === true;

            // Send notification emails BEFORE setting demo_ready
            // This ensures frontend only shows "Check your email" after email is actually sent
            try {
                if (isAutoConfirmed) {
                    // Auto-confirmed flow: Send email with ?demo= link for instant demo loading
                    const demoLinkUrl = `https://preintake.ai/?demo=${leadId}`;

                    // Send both emails in parallel for faster completion
                    await Promise.all([
                        sendDemoReadyEmail(leadId, afterData, analysis, demoUrl),
                        sendAutoConfirmedDemoEmail(leadId, afterData, analysis, demoLinkUrl)
                    ]);

                    console.log(`Auto-confirmed demo email sent to ${afterData.email} with link: ${demoLinkUrl}`);
                } else {
                    // Manual flow: Send standard demo ready emails
                    await Promise.all([
                        sendDemoReadyEmail(leadId, afterData, analysis, demoUrl),
                        sendProspectDemoReadyEmail(leadId, afterData, analysis, demoUrl)
                    ]);
                }
            } catch (emailError) {
                console.error(`Email notification failed for ${leadId}:`, emailError.message);
                // Continue to set demo_ready even if email fails - demo IS ready
            }

            // Generate unique 6-digit intake code for hosted URL
            const intakeCode = await generateUniqueIntakeCode(db);
            const hostedIntakeUrl = `https://preintake.ai/${intakeCode}`;
            console.log(`Generated intake code ${intakeCode} for lead ${leadId}`);

            // Update Firestore with demo URL and status AFTER email is sent
            // Frontend polls for this status, so user sees "Check your email" only after email is sent
            await leadRef.update({
                status: 'demo_ready',
                demoUrl: demoUrl,
                intakeCode: intakeCode,
                hostedIntakeUrl: hostedIntakeUrl,
                'demo.generatedAt': FieldValue.serverTimestamp(),
                'demo.version': '1.0.0',
                // Default delivery config - email to the prospect who requested demo
                deliveryConfig: {
                    method: 'email',
                    emailAddress: afterData.email,
                    webhookUrl: null,
                    crmType: null
                },
                demoReadyEmailSent: true,
                demoReadyEmailSentAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

        } catch (error) {
            console.error(`Demo generation failed for lead ${leadId}:`, error.message);

            await leadRef.update({
                status: 'demo_failed',
                'demo.error': error.message,
                'demo.failedAt': FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
    }
);

/**
 * Generate demo HTML and config files from template
 * Version: 2.1.0 - Added transcript support
 */
function generateDemoFiles(leadId, leadData, analysis, deepResearch) {
    // Read template (includes formatTranscript function for conversation transcript)
    const templatePath = path.join(__dirname, 'templates', 'demo-intake.html.template');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Extract values
    // For campaign-sourced leads, prioritize leadData.name (from contact database)
    // over analysis.firmName (scraped from website, often unreliable)
    const firmName = leadData.source === 'campaign'
        ? (leadData.name || analysis.firmName || 'Law Firm')
        : (analysis.firmName || leadData.name || 'Law Firm');

    // Use confirmed practice areas (from user confirmation modal) or fallback to analysis
    const confirmedAreas = leadData.confirmedPracticeAreas?.areas || [];
    const practiceArea = leadData.confirmedPracticeAreas?.primaryArea ||
                        analysis.primaryPracticeArea ||
                        'General Practice';

    // Build practice areas list from confirmed areas
    // If user confirmed multiple areas, treat as multi-practice firm
    let practiceAreasList = [];
    if (confirmedAreas.length > 0) {
        practiceAreasList = confirmedAreas.map((name, index) => ({
            key: name.toLowerCase().replace(/\s+/g, '_'),
            name: name,
            percentage: index === 0 ? 100 : 0 // Primary gets 100%, others 0 (not used)
        }));
    }
    const isMultiPractice = practiceAreasList.length > 1;
    const _otherPracticeAreaName = null; // Not used in new flow

    // Determine if this is a hosted lead (no website)
    const isHosted = leadData.hosted === true || leadData.hasWebsite === false;

    const state = analysis.location?.state || 'CA';
    const phone = analysis.contactMethods?.phone || '';
    const website = leadData.website || '';

    // Validate logo URL - filter out empty/placeholder images
    let logoUrl = analysis.branding?.logoUrl || null;
    if (logoUrl) {
        // Filter out data: URLs with empty or placeholder SVGs
        if (logoUrl.startsWith('data:image/svg+xml')) {
            const decoded = decodeURIComponent(logoUrl.replace('data:image/svg+xml,', ''));
            // Check if SVG has actual content (not just an empty viewBox)
            if (!decoded.includes('<path') && !decoded.includes('<rect') &&
                !decoded.includes('<circle') && !decoded.includes('<text') &&
                !decoded.includes('<image') && !decoded.includes('<g>')) {
                logoUrl = null; // Empty SVG placeholder, don't use
            }
        }
        // Filter out tiny placeholder images
        if (logoUrl && logoUrl.includes('1x1') || logoUrl?.includes('placeholder')) {
            logoUrl = null;
        }
    }

    // Use standardized color palette (consistent across all demos for readability)
    // These match the tested pi-intake.html palette
    const primaryDark = '#0c1f3f';
    const primaryBlue = '#1a3a5c';
    const accentColor = '#c9a962';
    const accentColorLight = '#e5d4a1';

    // Generate practice-area-specific content
    const systemPrompt = generateSystemPrompt(firmName, practiceArea, state, analysis, deepResearch, practiceAreasList, isMultiPractice);
    const tools = generateTools(practiceArea);
    const detectButtonsFunction = generateDetectButtonsFunction(practiceArea, practiceAreasList, isMultiPractice);
    const progressStepsHtml = generateProgressSteps(practiceArea, isMultiPractice);
    const loadingStagesHtml = generateLoadingStagesHtml(practiceArea);
    const loadingStagesJson = generateLoadingStagesJson(practiceArea);
    const declineResourcesHtml = generateDeclineResources(state);

    // Generate logo HTML - always use text (logo images often have poor quality/transparency)
    const logoHtml = `<div class="logo-text">${firmName}</div>`;

    // Generate avatar icon
    const avatarIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>';

    // Escape firm name for JavaScript string context (single quotes)
    const firmNameJS = firmName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // Replace all tokens
    const replacements = {
        '{{PAGE_TITLE}}': `Free Case Evaluation - ${firmName}`,
        '{{FIRM_NAME}}': firmName,
        '{{FIRM_NAME_JS}}': firmNameJS,
        '{{PRIMARY_DARK}}': primaryDark,
        '{{PRIMARY_BLUE}}': primaryBlue,
        '{{ACCENT_COLOR}}': accentColor,
        '{{ACCENT_COLOR_LIGHT}}': accentColorLight,
        '{{LOGO_HTML}}': logoHtml,
        '{{LANDING_HEADLINE}}': getLandingHeadline(practiceArea, isMultiPractice),
        '{{LANDING_SUBHEADLINE}}': getLandingSubheadline(practiceArea, firmName, isMultiPractice),
        '{{PROGRESS_STEPS_HTML}}': progressStepsHtml,
        '{{LOADING_STAGES_HTML}}': loadingStagesHtml,
        '{{LOADING_STAGES_JSON}}': loadingStagesJson,
        '{{DECLINE_RESOURCES_HTML}}': declineResourcesHtml,
        '{{PROXY_URL}}': PROXY_URL,
        '{{MODEL}}': CLAUDE_MODEL,
        '{{WEBHOOK_URL}}': "'https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net/handleIntakeCompletion'",
        '{{WEBHOOK_KEY}}': `'${leadId}'`, // Use leadId as simple auth key (quoted)
        '{{SCHEDULE_URL}}': 'null',
        '{{STATE}}': state,
        '{{TOTAL_STEPS}}': getTotalSteps(practiceArea).toString(),
        '{{SYSTEM_PROMPT}}': systemPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$'),
        '{{TOOLS_JSON}}': JSON.stringify(tools, null, 2),
        '{{DETECT_BUTTONS_FUNCTION}}': detectButtonsFunction,
        '{{INITIAL_MESSAGE}}': getInitialMessage(practiceArea, state, isMultiPractice),
        '{{AVATAR_ICON}}': avatarIcon,
        '{{LEAD_ID}}': leadId,
        '{{FIRM_EMAIL}}': leadData.email || '',
        '{{RETURN_URL}}': leadData.source === 'campaign'
            ? `https://preintake.ai/?demo=${leadId}&firm=${encodeURIComponent(firmName)}`
            : 'https://preintake.ai',
        '{{FIRM_PRACTICE_AREAS_JSON}}': JSON.stringify(practiceAreasList.map(a => a.name.toLowerCase())),
        // Hosted vs website-based lead text
        '{{ONBOARDING_GO_LIVE_TEXT}}': isHosted
            ? 'When you\'re ready to go live, share your personalized intake link directly with potential clients—no website required.'
            : 'When you\'re ready to go live, it embeds directly into your website—setup takes just minutes, and visitors never leave your site.',
        '{{SIDEBAR_CTA_TEXT}}': isHosted
            ? 'Like what you see? Get your personalized intake link to share with potential clients.'
            : 'Like what you see? Add PreIntake.ai to your website today.',
        '{{PROMO_TEXT}}': isHosted
            ? `Get <strong>PreIntake.ai</strong> for <strong>${firmName}</strong>.`
            : `Add <strong>PreIntake.ai</strong> to the <strong>${firmName}</strong> website.`,
        '{{DEMO_LIMIT_TEXT}}': isHosted
            ? 'Ready to get your personalized intake link?'
            : 'Ready to go live on your website?',
        // Show escape link for ALL demos (allows bar profile contacts to create demo for current firm)
        '{{ESCAPE_LINK_DISPLAY}}': 'block',
    };

    for (const [token, value] of Object.entries(replacements)) {
        htmlTemplate = htmlTemplate.split(token).join(value);
    }

    // Config content (for reference, not uploaded separately)
    const configContent = {
        firmName,
        practiceArea,
        practiceAreas: practiceAreasList,
        isMultiPractice,
        state,
        phone,
        website,
        logoUrl,
        generatedAt: new Date().toISOString(),
        leadId,
    };

    return { htmlContent: htmlTemplate, configContent };
}

/**
 * Upload demo files to Firebase Storage
 */
async function uploadToStorage(leadId, htmlContent, configContent) {
    const storage = getStorage();
    const bucket = storage.bucket(STORAGE_BUCKET);

    // Upload HTML file
    const htmlPath = `preintake-demos/${leadId}/index.html`;
    const htmlFile = bucket.file(htmlPath);

    await htmlFile.save(htmlContent, {
        contentType: 'text/html',
        metadata: {
            cacheControl: 'no-cache, no-store, must-revalidate',
        },
    });

    // Make file public
    await htmlFile.makePublic();

    // Upload config as JSON (for debugging/reference)
    const configPath = `preintake-demos/${leadId}/config.json`;
    const configFile = bucket.file(configPath);

    await configFile.save(JSON.stringify(configContent, null, 2), {
        contentType: 'application/json',
        metadata: {
            cacheControl: 'public, max-age=3600',
        },
    });

    await configFile.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${htmlPath}`;
}

/**
 * Practice area display names mapping
 */
const PRACTICE_AREA_DISPLAY_NAMES = {
    personal_injury: 'Personal Injury',
    immigration: 'Immigration',
    family_law: 'Family Law',
    bankruptcy: 'Bankruptcy',
    criminal_defense: 'Criminal Defense',
    tax: 'Tax',
    estate_planning: 'Estate Planning',
    employment: 'Employment Law',
    workers_comp: 'Workers\' Compensation',
    real_estate: 'Real Estate',
    other: 'General Practice'
};

/**
 * Build list of practice areas from breakdown for multi-area selection
 * Returns array of { key, name } objects sorted by percentage (highest first)
 */
function buildPracticeAreasList(practiceBreakdown, otherPracticeAreaName) {
    if (!practiceBreakdown || Object.keys(practiceBreakdown).length === 0) {
        return [];
    }

    return Object.entries(practiceBreakdown)
        .filter(([_, pct]) => pct > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([key, pct]) => ({
            key,
            name: key === 'other' && otherPracticeAreaName
                ? otherPracticeAreaName
                : PRACTICE_AREA_DISPLAY_NAMES[key] || key,
            percentage: pct
        }));
}

/**
 * Generate practice-area-specific system prompt
 */
function generateSystemPrompt(firmName, practiceArea, state, analysis, deepResearch, practiceAreasList, isMultiPractice) {
    // Build firm context from deep research
    let firmContext = '';
    if (deepResearch.firmDescription) {
        firmContext += `\n\nFIRM BACKGROUND:\n${deepResearch.firmDescription}`;
    }
    if (deepResearch.yearsInBusiness) {
        firmContext += `\n- Serving clients for ${deepResearch.yearsInBusiness} years`;
    }
    if (deepResearch.caseResults?.length > 0) {
        const topResult = deepResearch.caseResults[0];
        firmContext += `\n- Notable results: ${topResult.amount} in ${topResult.caseType}`;
    }
    if (deepResearch.officeLocations?.length > 0) {
        firmContext += `\n- Office locations: ${deepResearch.officeLocations.join(', ')}`;
    }
    if (deepResearch.attorneys?.length > 0) {
        firmContext += '\n\nATTORNEYS:';
        deepResearch.attorneys.slice(0, 5).forEach(a => {
            firmContext += `\n- ${a.name}${a.title ? `, ${a.title}` : ''}${a.practiceAreas?.length ? `: ${a.practiceAreas.join(', ')}` : ''}`;
        });
    }

    // Build multi-practice context if firm handles multiple areas
    let multiPracticeContext = '';
    let practiceAreasListStr = '';
    if (isMultiPractice && practiceAreasList.length > 1) {
        const areaNames = practiceAreasList.map(a => a.name);
        multiPracticeContext = `\n\nPRACTICE AREAS HANDLED:\nThis firm handles: ${areaNames.join(', ')}.`;
        practiceAreasListStr = areaNames.join(', ');
    }

    // For multi-practice firms, build a prompt with practice area selection and ALL flows
    if (isMultiPractice && practiceAreasList.length > 1) {
        // Build all practice-area-specific prompts
        const allPracticePrompts = practiceAreasList.map(area => {
            const areaPrompt = getPracticeAreaPrompt(area.name, state, analysis);
            return `### IF USER SELECTS "${area.name.toUpperCase()}":\n${areaPrompt}`;
        }).join('\n\n');

        return `You are an intake specialist for ${firmName}, a law firm in ${state} handling multiple practice areas.${firmContext}${multiPracticeContext}

CRITICAL RULES:
1. Ask ONLY ONE question per response. Never ask multiple questions.
2. Do NOT use markdown formatting. Write in plain text only.
3. Wait for the user to answer before moving to the next question.
4. NATURAL CONVERSATION: Reference specific details from the user's previous answers naturally.
5. DO NOT call any tools during Phase 1 (contact collection). Only respond with text asking for name, then phone, then email.
6. DO NOT call collect_contact_info until you have explicitly received ALL THREE: name, phone, AND email from the user.

## RESPONSE BUTTONS - IMPORTANT:
When you ask a question that has specific answer options, you MUST include them at the end of your response using this exact format:
[OPTIONS: Option 1 | Option 2 | Option 3]

For questions where users can select MULTIPLE answers (e.g., "what types of...", "which of these apply...", "what kinds of..."), use:
[OPTIONS-MULTI: Option 1 | Option 2 | Option 3 | Option 4]

Guidelines for buttons:
- Use 2-7 options maximum
- Keep option labels short (1-4 words each)
- For single-select: Make options mutually exclusive
- For multi-select: Options can overlap (user selects all that apply)
- For yes/no questions: [OPTIONS: Yes | No] or include a third option like "Not sure"
- For open-ended questions (name, phone, email, or when you need detailed descriptions), do NOT include options

Examples (single-select):
- "Have you seen a doctor for your injuries?" followed by [OPTIONS: Yes | No | Not yet]
- "When did this incident occur?" followed by [OPTIONS: Within the last month | 1-6 months ago | 6-12 months ago | Over a year ago]
- "What is your current employment status?" followed by [OPTIONS: Employed | Self-employed | Unemployed | Retired | Disabled]

Examples (multi-select - user can choose multiple):
- "What types of debt do you have?" followed by [OPTIONS-MULTI: Credit Cards | Medical Bills | Car Loan | Mortgage | Student Loans | Personal Loans]
- "Which injuries did you sustain?" followed by [OPTIONS-MULTI: Head/Brain | Neck/Back | Broken Bones | Internal | Soft Tissue | Other]

DO NOT list options in your prose text. ONLY use the [OPTIONS:] or [OPTIONS-MULTI:] format at the end.

## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name (no options - free text)
2. Ask for their phone number (no options - free text)
3. Ask for their email address (no options - free text)

### Phase 2: Practice Area Selection
4. Ask what type of legal matter brings them here, with options: [OPTIONS: ${practiceAreasListStr.split(', ').join(' | ')}]

### Phase 3: Practice-Area-Specific Questions
Based on the user's selection in Phase 2, follow the appropriate question flow:

${allPracticePrompts}

## Response Style
- Keep responses brief (1-2 sentences max before your ONE question)
- Be empathetic but professional
- After user answers, provide brief acknowledgment, then ask the NEXT question
- NEVER ask multiple questions
- ALWAYS include [OPTIONS: ...] or [OPTIONS-MULTI: ...] for questions with defined answer choices

## After All Questions
Call complete_intake with the assessment results.`;
    }

    // Single practice area - use original flow
    const practicePrompt = getPracticeAreaPrompt(practiceArea, state, analysis);

    return `You are an intake specialist for ${firmName}, a ${practiceArea} law firm in ${state}.${firmContext}

CRITICAL RULES:
1. Ask ONLY ONE question per response. Never ask multiple questions.
2. Do NOT use markdown formatting. Write in plain text only.
3. Wait for the user to answer before moving to the next question.
4. NATURAL CONVERSATION: Reference specific details from the user's previous answers naturally.
5. DO NOT call any tools during Phase 1 (contact collection). Only respond with text asking for name, then phone, then email.
6. DO NOT call collect_contact_info until you have explicitly received ALL THREE: name, phone, AND email from the user.

## RESPONSE BUTTONS - IMPORTANT:
When you ask a question that has specific answer options, you MUST include them at the end of your response using this exact format:
[OPTIONS: Option 1 | Option 2 | Option 3]

For questions where users can select MULTIPLE answers (e.g., "what types of...", "which of these apply...", "what kinds of..."), use:
[OPTIONS-MULTI: Option 1 | Option 2 | Option 3 | Option 4]

Guidelines for buttons:
- Use 2-7 options maximum
- Keep option labels short (1-4 words each)
- For single-select: Make options mutually exclusive
- For multi-select: Options can overlap (user selects all that apply)
- For yes/no questions: [OPTIONS: Yes | No] or include a third option like "Not sure"
- For open-ended questions (name, phone, email, or when you need detailed descriptions), do NOT include options

Examples (single-select):
- "Have you seen a doctor for your injuries?" followed by [OPTIONS: Yes | No | Not yet]
- "When did this incident occur?" followed by [OPTIONS: Within the last month | 1-6 months ago | 6-12 months ago | Over a year ago]
- "What is your current employment status?" followed by [OPTIONS: Employed | Self-employed | Unemployed | Retired | Disabled]

Examples (multi-select - user can choose multiple):
- "What types of debt do you have?" followed by [OPTIONS-MULTI: Credit Cards | Medical Bills | Car Loan | Mortgage | Student Loans | Personal Loans]
- "Which injuries did you sustain?" followed by [OPTIONS-MULTI: Head/Brain | Neck/Back | Broken Bones | Internal | Soft Tissue | Other]

DO NOT list options in your prose text. ONLY use the [OPTIONS:] or [OPTIONS-MULTI:] format at the end.

${practicePrompt}

## Response Style
- Keep responses brief (1-2 sentences max before your ONE question)
- Be empathetic but professional
- After user answers, provide brief acknowledgment, then ask the NEXT question
- NEVER ask multiple questions
- ALWAYS include [OPTIONS: ...] or [OPTIONS-MULTI: ...] for questions with defined answer choices

## After All Questions
Call complete_intake with the assessment results.`;
}

/**
 * Get practice-area-specific prompt section
 */
function getPracticeAreaPrompt(practiceArea, state, analysis) {
    const qualCriteria = analysis.qualificationCriteria?.length
        ? analysis.qualificationCriteria.join('\n- ')
        : '';

    const intakeQuestions = analysis.intakeRecommendations?.length
        ? analysis.intakeRecommendations.join('\n- ')
        : '';

    switch (practiceArea.toLowerCase()) {
        case 'personal injury':
            return getPersonalInjuryPrompt(state);
        case 'immigration':
            return getImmigrationPrompt();
        case 'family law':
            return getFamilyLawPrompt(state);
        case 'tax':
        case 'tax law':
            return getTaxLawPrompt();
        case 'bankruptcy':
            return getBankruptcyPrompt();
        case 'criminal defense':
            return getCriminalDefensePrompt(state);
        case 'estate planning':
            return getEstatePlanningPrompt(state);
        default:
            return getGenericPrompt(practiceArea, qualCriteria, intakeQuestions);
    }
}

function getPersonalInjuryPrompt(state) {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Incident Screening
4. Ask when the incident occurred
5. Ask if they were physically injured
6. Ask what type of medical treatment they received
7. Ask if the incident occurred in ${state}

### Phase 3: Incident Details
8. Ask what type of incident this was
- For vehicle accidents: Ask collision type, injuries, fault, police report
- For slip and fall: Ask location, cause, incident report
- Ask about evidence, damages, insurance

### Phase 4: Final Questions
- Ask about ER visit, hospitalization, current treatment
- Ask about surgery, missed work
- Ask if currently represented by attorney

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of incident (e.g., "Auto Accident", "Slip and Fall", "Workplace Injury")
- date_occurred: When the incident happened (use the exact response they gave, e.g., "Within the past month", "3 months ago", "June 2024")
- location: State/city where incident occurred (e.g., "${state}", "Baltimore, MD")
- description: Brief description of what happened

## Disqualification Rules (call complete_intake with routing="red")
- Incident more than 2 years ago (SOL expired)
- No physical injury AND no medical treatment
- Incident outside ${state}
- User admits 100% fault
- User is currently represented by another attorney

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary of the case. Example: "Rear-end collision at stoplight 3 weeks ago. Visible injuries (whiplash, back pain), currently in physical therapy. Police report filed, other driver cited. No prior attorney contacted. Within SOL."
- sol_status: Calculate based on incident date and ${state}'s 2-year statute of limitations. Include status (within/near_expiration/expired), months_remaining (number), and note (e.g., "23 months remaining" or "Expired").
- injuries: List all injuries mentioned (e.g., "Whiplash, back pain, headaches")
- treatment_status: Current treatment status (e.g., "Active PT", "ER visit only", "Surgery scheduled")`;
}

function getImmigrationPrompt() {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Immigration Status
4. Ask about their current immigration status
5. Ask what type of immigration help they need (visa, green card, citizenship, etc.)
6. Ask if they have any pending applications with USCIS

### Phase 3: Case-Specific Questions
For Visa Applications:
- Ask what type of visa they're seeking
- Ask about their employer/sponsor situation

For Green Card:
- Ask basis for green card (family, employment, etc.)
- Ask about family relationships in the US

For Citizenship:
- Ask how long they've been a permanent resident
- Ask about travel history and criminal record

For Deportation/Removal:
- Ask about any notices received from immigration court
- Ask urgency level

### Phase 4: Additional Information
- Ask about prior immigration applications
- Ask if they've had any criminal issues
- Ask about timeline/urgency

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of immigration matter (e.g., "Green Card Application", "Visa Application", "Citizenship", "Deportation Defense")
- date_occurred: Any relevant deadline or date (e.g., "Visa expires in 6 months", "Hearing scheduled for March 2025")
- location: Where they reside or jurisdiction
- description: Brief description of their immigration situation

## Disqualification (call complete_intake with routing="red")
- Currently in active removal proceedings with counsel
- Looking for asylum but already missed deadline

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "Green card application through marriage to US citizen. Married 2 years, no prior immigration issues. Currently on valid H-1B visa expiring in 6 months."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Immigration matter" }`;
}

function getFamilyLawPrompt(state) {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Case Type
4. Ask what type of family law matter they need help with (divorce, custody, support, etc.)
5. Ask if they are in ${state}

### Phase 3: Case-Specific Questions
For Divorce:
- Ask if children are involved
- Ask how long married
- Ask if they expect it to be contested
- Ask about significant assets/debts

For Child Custody:
- Ask about current custody arrangement
- Ask if there are safety concerns
- Ask about urgency

For Child/Spousal Support:
- Ask current support situation
- Ask if there's an existing court order

### Phase 4: Urgency and Representation
- Ask if there are any urgent safety concerns
- Ask if the other party has an attorney
- Ask if they've been served with papers

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of family law matter (e.g., "Divorce", "Child Custody", "Child Support", "Spousal Support")
- date_occurred: Relevant date (e.g., "Filed for divorce 2 months ago", "Separated June 2024")
- location: State/county where the matter is filed (e.g., "${state}")
- description: Brief description of the situation

## Disqualification (call complete_intake with routing="red")
- Matter is outside ${state}
- Already has an attorney on this matter
- Looking for criminal defense, not family law

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "Contested divorce with 2 minor children. Married 12 years, significant marital assets including family home. Spouse has retained counsel."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Family law matter" }`;
}

function getTaxLawPrompt() {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Tax Issue Type
4. Ask what type of tax issue they need help with
5. Ask which tax years are affected

### Phase 3: IRS/State Situation
6. Ask if they owe back taxes (and approximate amount if known)
7. Ask if they've received any IRS notices (audit, levy, lien)
8. Ask if they're currently on a payment plan

### Phase 4: Additional Details
9. Ask if their returns are current/filed
10. Ask if they've worked with a tax attorney before
11. Ask about urgency (wage garnishment, bank levy, etc.)

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of tax issue (e.g., "IRS Audit", "Back Taxes", "Tax Lien", "Wage Garnishment")
- date_occurred: Tax years affected or when issue started (e.g., "2021-2023 tax years", "Audit notice received October 2024")
- location: State where they reside/file
- description: Brief description of their tax situation

## Qualification Signals (green routing)
- Owes significant back taxes ($10k+)
- Received IRS audit notice
- Facing wage garnishment or bank levy
- Needs offer in compromise

## Disqualification (call complete_intake with routing="red")
- Just needs simple tax return prepared
- Issue is only with another tax preparer, not IRS

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "IRS audit notice received for 2022 tax year. Owes approximately $45,000 in back taxes. Currently facing wage garnishment."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Tax matter" }`;
}

function getBankruptcyPrompt() {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Financial Situation
4. Ask about their primary reason for considering bankruptcy
5. Ask about approximate total debt amount
6. Ask about their employment status

### Phase 3: Debt Details
7. Ask what types of debt they have (credit cards, medical, mortgage, etc.)
8. Ask if they're facing foreclosure or repossession
9. Ask if wages are being garnished

### Phase 4: Previous History
10. Ask if they've filed bankruptcy before
11. Ask if they've consulted with other attorneys
12. Ask about timeline/urgency

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of bankruptcy consideration (e.g., "Chapter 7", "Chapter 13", "Debt Relief Consultation")
- date_occurred: When financial issues started or relevant deadline (e.g., "Garnishment started 3 months ago")
- location: State where they reside/will file
- description: Brief description of their financial situation

## Qualification Signals (green routing)
- Significant unsecured debt
- Facing foreclosure or garnishment
- Debt is primarily dischargeable

## Disqualification (call complete_intake with routing="red")
- Filed bankruptcy in last 8 years (Chapter 7) or 2 years (Chapter 13)
- Primarily student loan debt (may still help but lower priority)

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "Seeking Chapter 7 bankruptcy. Approximately $85,000 in unsecured debt (credit cards, medical bills). Currently employed, facing wage garnishment."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Bankruptcy matter" }`;
}

function getCriminalDefensePrompt(state) {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Case Information
4. Ask if this is for themselves or someone else
5. Ask what they're charged with (or being investigated for)
6. Ask if there have been any arrests

### Phase 3: Case Status
7. Ask if they have a court date scheduled
8. Ask if they're currently in custody or out on bail
9. Ask if they've been assigned a public defender

### Phase 4: Case Details
10. Ask when the alleged incident occurred
11. Ask what county/jurisdiction this is in
12. Ask if there are any prior criminal convictions

## When Calling collect_case_info
After completing Phase 2 and 3 questions, call collect_case_info with:
- case_type: The specific charge (e.g., "DUI/DWI", "Drug Offense", "Assault", "Theft")
- date_occurred: When the incident occurred (use the exact response, e.g., "Within the past month", "2 weeks ago", "October 2024")
- location: County/jurisdiction where charges are filed (e.g., "Baltimore County, ${state}")
- description: Brief description of the charges and situation

## Urgency Signals (prioritize)
- In custody
- Court date within 2 weeks
- Facing serious felony charges

## Disqualification (call complete_intake with routing="red")
- Case is outside ${state}
- Already has private attorney
- Looking for appeals (may need specialist)

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "Charged with DUI/DWI in ${state}. First offense, no prior criminal record. Arraignment scheduled in 2 weeks, currently out on bail."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Criminal matter" }`;
}

function getEstatePlanningPrompt(state) {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Planning Needs
4. Ask what estate planning help they need (will, trust, power of attorney, etc.)
5. Ask if they have existing estate planning documents
6. Ask about their family situation (married, children, etc.)

### Phase 3: Asset Information
7. Ask about the types of assets they want to protect
8. Ask if they have any business interests
9. Ask about any special circumstances (special needs family member, etc.)

### Phase 4: Urgency
10. Ask if there are any health concerns creating urgency
11. Ask about timeline for completing documents

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of estate planning needed (e.g., "Will", "Trust", "Power of Attorney", "Comprehensive Estate Plan")
- date_occurred: Timeline or urgency (e.g., "Wants to complete within 2 months", "Health concerns - urgent")
- location: State where they reside (e.g., "${state}")
- description: Brief description of their estate planning needs

## Qualification Signals (green routing)
- Has significant assets to protect
- Complex family situations
- Business succession planning needed

## Lower Priority (yellow routing)
- Simple will with no complex assets
- Just updating existing documents

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary. Example: "Needs comprehensive estate plan including will, trust, and powers of attorney. Married with 3 children, significant assets including real estate and business interests."
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A - Estate planning matter" }`;
}

function getGenericPrompt(practiceArea, qualCriteria, intakeQuestions) {
    return `## Question Flow (strictly one question at a time):

### Phase 1: Basic Information
1. Ask for their name
2. Ask for their phone number
3. Ask for their email address

### Phase 2: Case Overview
4. Ask them to briefly describe their ${practiceArea.toLowerCase()} matter
5. Ask when this issue began or when the relevant events occurred

### Phase 3: Specific Questions
${intakeQuestions ? `Based on their practice area, ask about:\n- ${intakeQuestions}` : `6. Ask follow-up questions relevant to their specific situation
7. Ask about any deadlines or urgency
8. Ask if they've consulted with other attorneys`}

### Phase 4: Qualification
9. Ask if they're located in your service area
10. Ask if they're currently represented

## When Calling collect_case_info
After completing Phase 2 questions, call collect_case_info with:
- case_type: Type of legal matter (e.g., "${practiceArea}")
- date_occurred: When the issue began or relevant events occurred (use the exact response)
- location: Where they are located or where the matter occurred
- description: Brief description of their situation

${qualCriteria ? `## Qualification Criteria\nGood candidates will have:\n- ${qualCriteria}` : ''}

## Disqualification (call complete_intake with routing="red")
- Outside your service area
- Currently represented by another attorney
- Matter is outside your practice area

## When Calling complete_intake
You MUST include these fields:
- ai_screening_summary: Write a 2-3 sentence narrative summary of the case, including key facts and circumstances.
- sol_status: Set to { status: "unknown", months_remaining: null, note: "N/A" } unless statute of limitations applies to this matter.`;
}

/**
 * Generate tools array for the practice area
 */
function generateTools(_practiceArea) {
    // Base tools that apply to all practice areas
    return [
        {
            name: "collect_contact_info",
            description: "Collect basic contact information from the user",
            input_schema: {
                type: "object",
                properties: {
                    name: { type: "string", description: "User's name" },
                    phone: { type: "string", description: "Phone number" },
                    email: { type: "string", description: "Email address" }
                },
                required: ["name", "phone", "email"]
            }
        },
        {
            name: "collect_case_info",
            description: "Collect information about the case/matter",
            input_schema: {
                type: "object",
                properties: {
                    case_type: { type: "string", description: "Type of legal matter" },
                    description: { type: "string", description: "Brief description of the situation" },
                    date_occurred: { type: "string", description: "When the issue began or occurred" },
                    location: { type: "string", description: "Location/jurisdiction" }
                },
                required: ["case_type"]
            }
        },
        {
            name: "collect_details",
            description: "Collect additional details about the case",
            input_schema: {
                type: "object",
                properties: {
                    details: { type: "object", description: "Case-specific details collected" }
                }
            }
        },
        {
            name: "collect_additional_info",
            description: "Collect final qualifying information",
            input_schema: {
                type: "object",
                properties: {
                    urgency: { type: "string", description: "Urgency level" },
                    has_attorney: { type: "boolean", description: "Whether they have an attorney" },
                    notes: { type: "string", description: "Additional notes" }
                }
            }
        },
        {
            name: "show_question_help",
            description: "Provide help text for complex questions",
            input_schema: {
                type: "object",
                properties: {
                    help_title: { type: "string" },
                    help_content: { type: "string" }
                },
                required: ["help_title", "help_content"]
            }
        },
        {
            name: "complete_intake",
            description: "Complete the intake and determine routing",
            input_schema: {
                type: "object",
                properties: {
                    routing: {
                        type: "string",
                        enum: ["green", "yellow", "red"],
                        description: "Lead routing: green=immediate consult, yellow=needs follow-up, red=decline"
                    },
                    urgency: {
                        type: "string",
                        enum: ["immediate", "standard", "none"]
                    },
                    confidence_level: {
                        type: "string",
                        enum: ["high", "medium", "low"]
                    },
                    recommended_next_action: {
                        type: "string",
                        enum: ["schedule_consult", "request_documents", "decline_with_resources"]
                    },
                    ai_screening_summary: {
                        type: "string",
                        description: "2-3 sentence narrative summary of the case for the law firm. Include key facts: what happened, when, injuries sustained, current treatment status, and whether within statute of limitations."
                    },
                    sol_status: {
                        type: "object",
                        description: "Statute of limitations status (for applicable practice areas)",
                        properties: {
                            status: { type: "string", enum: ["within", "near_expiration", "expired", "unknown"] },
                            months_remaining: { type: "number", description: "Months until SOL expires (null if expired or unknown)" },
                            note: { type: "string", description: "Brief SOL note, e.g. '23 months remaining' or 'Expired' or 'N/A'" }
                        }
                    },
                    injuries: {
                        type: "string",
                        description: "List of injuries mentioned by caller (for PI cases), e.g. 'Whiplash, back pain, headaches'"
                    },
                    treatment_status: {
                        type: "string",
                        description: "Current medical treatment status, e.g. 'Active PT', 'Completed treatment', 'ER visit only', 'No treatment yet'"
                    },
                    primary_disqualifier: {
                        type: "string",
                        description: "Main reason for red routing (if applicable)"
                    },
                    primary_strength_factor: {
                        type: "string",
                        description: "Main positive factor"
                    },
                    key_factors: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                factor: { type: "string" },
                                impact: { type: "string", enum: ["positive", "negative", "neutral"] }
                            }
                        }
                    }
                },
                required: ["routing", "urgency", "confidence_level", "recommended_next_action", "key_factors", "ai_screening_summary"]
            }
        }
    ];
}

/**
 * Generate detectQuestionButtons function - practice-area-specific
 * For multi-practice firms, includes detection for practice area selection
 */
function generateDetectButtonsFunction(practiceArea, practiceAreasList, isMultiPractice) {
    // Build practice area selection detection for multi-practice firms
    let practiceAreaDetection = '';
    if (isMultiPractice && practiceAreasList.length > 1) {
        const buttonsArray = practiceAreasList.map(a =>
            `{ label: "${a.name}", value: "${a.name}" }`
        ).join(',\n            ');

        practiceAreaDetection = `
    // Practice area selection (multi-practice firm)
    if (lowerText.includes('type of legal matter') || lowerText.includes('what type of') ||
        lowerText.includes('kind of legal') || lowerText.includes('area of law') ||
        lowerText.includes('help with today') || lowerText.includes('legal issue') ||
        lowerText.includes('what brings you')) {
        return [
            ${buttonsArray}
        ];
    }
`;
    }

    // Get the base buttons function for the primary practice area
    const area = practiceArea.toLowerCase();
    let baseFunction;

    if (area.includes('immigration')) {
        baseFunction = getImmigrationButtonsFunction();
    } else if (area.includes('family')) {
        baseFunction = getFamilyLawButtonsFunction();
    } else if (area.includes('tax')) {
        baseFunction = getTaxLawButtonsFunction();
    } else if (area.includes('bankruptcy')) {
        baseFunction = getBankruptcyButtonsFunction();
    } else if (area.includes('criminal')) {
        baseFunction = getCriminalDefenseButtonsFunction();
    } else if (area.includes('estate')) {
        baseFunction = getEstatePlanningButtonsFunction();
    } else if (area.includes('personal injury')) {
        baseFunction = getPersonalInjuryButtonsFunction();
    } else {
        baseFunction = getGenericButtonsFunction();
    }

    // For multi-practice firms, we need to include ALL practice area button detections
    if (isMultiPractice && practiceAreasList.length > 1) {
        // Collect all unique button functions for each practice area
        const allButtonDetections = new Set();

        practiceAreasList.forEach(areaItem => {
            const areaLower = areaItem.name.toLowerCase();
            let areaButtons;

            if (areaLower.includes('immigration')) {
                areaButtons = getImmigrationButtonsContent();
            } else if (areaLower.includes('family')) {
                areaButtons = getFamilyLawButtonsContent();
            } else if (areaLower.includes('tax')) {
                areaButtons = getTaxLawButtonsContent();
            } else if (areaLower.includes('bankruptcy')) {
                areaButtons = getBankruptcyButtonsContent();
            } else if (areaLower.includes('criminal')) {
                areaButtons = getCriminalDefenseButtonsContent();
            } else if (areaLower.includes('estate')) {
                areaButtons = getEstatePlanningButtonsContent();
            } else if (areaLower.includes('personal injury')) {
                areaButtons = getPersonalInjuryButtonsContent();
            }

            if (areaButtons) {
                allButtonDetections.add(areaButtons);
            }
        });

        // Combine all button detections
        const combinedDetections = Array.from(allButtonDetections).join('\n\n');

        return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();
${practiceAreaDetection}

${combinedDetections}

    // Generic yes/no (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('describe') && !lowerText.includes('explain') && !lowerText.includes('tell me') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('what') && !lowerText.includes('which')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
    }

    // Single practice area - return base function as-is
    return baseFunction;
}

function getImmigrationButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Immigration status - current status in US
    if ((lowerText.includes('immigration status') || lowerText.includes('current status')) &&
        !lowerText.includes('change') && !lowerText.includes('adjust')) {
        return [
            { label: "US Citizen", value: "US Citizen" },
            { label: "Green Card Holder", value: "Green Card Holder (Permanent Resident)" },
            { label: "Valid Visa", value: "Valid Visa" },
            { label: "Expired Visa", value: "Expired Visa" },
            { label: "Undocumented", value: "Undocumented" },
            { label: "DACA", value: "DACA" },
            { label: "Asylum/Refugee", value: "Asylum/Refugee" },
            { label: "Other/Not Sure", value: "Other/Not Sure" }
        ];
    }

    // Type of immigration help needed
    if (lowerText.includes('type of immigration') || lowerText.includes('immigration help') ||
        lowerText.includes('what kind of help') || lowerText.includes('looking for help with')) {
        return [
            { label: "Visa Application", value: "Visa Application" },
            { label: "Green Card", value: "Green Card" },
            { label: "Citizenship/Naturalization", value: "Citizenship/Naturalization" },
            { label: "Deportation/Removal Defense", value: "Deportation/Removal Defense" },
            { label: "Asylum", value: "Asylum" },
            { label: "Work Permit", value: "Work Permit" },
            { label: "Family Petition", value: "Family Petition" },
            { label: "Other", value: "Other" }
        ];
    }

    // Visa type
    if (lowerText.includes('type of visa') || lowerText.includes('visa category') ||
        lowerText.includes('which visa') || lowerText.includes('what visa')) {
        return [
            { label: "H-1B (Work)", value: "H-1B Work Visa" },
            { label: "L-1 (Transfer)", value: "L-1 Transfer Visa" },
            { label: "O-1 (Extraordinary)", value: "O-1 Extraordinary Ability" },
            { label: "F-1 (Student)", value: "F-1 Student Visa" },
            { label: "B-1/B-2 (Visitor)", value: "B-1/B-2 Visitor Visa" },
            { label: "K-1 (Fiance)", value: "K-1 Fiance Visa" },
            { label: "Other/Not Sure", value: "Other/Not Sure" }
        ];
    }

    // Green card basis
    if (lowerText.includes('basis for') && lowerText.includes('green card') ||
        lowerText.includes('green card') && (lowerText.includes('family') || lowerText.includes('employment') || lowerText.includes('pathway'))) {
        return [
            { label: "Family-Based (Spouse)", value: "Family-Based through Spouse" },
            { label: "Family-Based (Parent/Child)", value: "Family-Based through Parent or Child" },
            { label: "Employment-Based", value: "Employment-Based" },
            { label: "Diversity Lottery", value: "Diversity Lottery" },
            { label: "Asylum/Refugee", value: "Asylum/Refugee Status" },
            { label: "Other/Not Sure", value: "Other/Not Sure" }
        ];
    }

    // Pending applications
    if (lowerText.includes('pending') && (lowerText.includes('uscis') || lowerText.includes('application'))) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Deportation/removal proceedings
    if (lowerText.includes('deportation') || lowerText.includes('removal') || lowerText.includes('immigration court')) {
        return [
            { label: "Yes, active proceedings", value: "Yes, in removal proceedings" },
            { label: "Received notice", value: "Received notice to appear" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Criminal history
    if (lowerText.includes('criminal') && (lowerText.includes('history') || lowerText.includes('record') || lowerText.includes('arrest') || lowerText.includes('conviction'))) {
        return [
            { label: "No criminal history", value: "No criminal history" },
            { label: "Arrest, no conviction", value: "Arrested but not convicted" },
            { label: "Misdemeanor", value: "Misdemeanor conviction" },
            { label: "Felony", value: "Felony conviction" },
            { label: "Prefer not to say", value: "Prefer not to say" }
        ];
    }

    // Urgency/Timeline
    if (lowerText.includes('urgent') || lowerText.includes('timeline') || lowerText.includes('how soon')) {
        return [
            { label: "Very urgent (days/weeks)", value: "Very urgent - need help immediately" },
            { label: "Somewhat urgent (1-3 months)", value: "Somewhat urgent - within 1-3 months" },
            { label: "Planning ahead (3+ months)", value: "Planning ahead - 3+ months" },
            { label: "No rush", value: "No particular timeline" }
        ];
    }

    // Attorney representation
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes, currently", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you have') || lowerText.includes('are you currently') ||
         lowerText.includes('have you') || lowerText.includes('did you') ||
         lowerText.includes('is there') || lowerText.includes('was there') ||
         lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') &&
        !lowerText.includes('type') && !lowerText.includes('kind') &&
        !lowerText.includes('how') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('when') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getFamilyLawButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Type of family law matter
    if (lowerText.includes('type of') && (lowerText.includes('family') || lowerText.includes('matter') || lowerText.includes('help')) ||
        lowerText.includes('family law') && lowerText.includes('need')) {
        return [
            { label: "Divorce", value: "Divorce" },
            { label: "Child Custody", value: "Child Custody" },
            { label: "Child Support", value: "Child Support" },
            { label: "Spousal Support/Alimony", value: "Spousal Support/Alimony" },
            { label: "Domestic Violence", value: "Domestic Violence/Restraining Order" },
            { label: "Prenuptial Agreement", value: "Prenuptial Agreement" },
            { label: "Adoption", value: "Adoption" },
            { label: "Other", value: "Other" }
        ];
    }

    // Children involved
    if (lowerText.includes('children') && (lowerText.includes('involved') || lowerText.includes('have'))) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Current custody arrangement
    if (lowerText.includes('custody') && (lowerText.includes('current') || lowerText.includes('arrangement'))) {
        return [
            { label: "No arrangement yet", value: "No formal arrangement" },
            { label: "Joint custody", value: "Joint custody" },
            { label: "I have primary custody", value: "I have primary custody" },
            { label: "Other parent has custody", value: "Other parent has primary custody" },
            { label: "Supervised visitation", value: "Supervised visitation" }
        ];
    }

    // Contested vs uncontested
    if (lowerText.includes('contested') || lowerText.includes('agree') || lowerText.includes('amicable')) {
        return [
            { label: "Contested (disagreement)", value: "Contested - we disagree on terms" },
            { label: "Uncontested (agreement)", value: "Uncontested - we agree on terms" },
            { label: "Not sure yet", value: "Not sure yet" }
        ];
    }

    // Safety concerns
    if (lowerText.includes('safety') || lowerText.includes('abuse') || lowerText.includes('violence') || lowerText.includes('danger')) {
        return [
            { label: "Yes, urgent safety concern", value: "Yes, urgent safety concern" },
            { label: "Yes, but not immediate", value: "Yes, but not immediate danger" },
            { label: "No safety concerns", value: "No safety concerns" }
        ];
    }

    // Served with papers
    if (lowerText.includes('served') || lowerText.includes('papers') || lowerText.includes('petition')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // How long married
    if (lowerText.includes('how long') && lowerText.includes('married')) {
        return [
            { label: "Less than 1 year", value: "Less than 1 year" },
            { label: "1-5 years", value: "1-5 years" },
            { label: "5-10 years", value: "5-10 years" },
            { label: "10-20 years", value: "10-20 years" },
            { label: "More than 20 years", value: "More than 20 years" }
        ];
    }

    // Urgency
    if (lowerText.includes('urgent') || lowerText.includes('deadline') || lowerText.includes('court date')) {
        return [
            { label: "Yes, very urgent", value: "Yes, very urgent" },
            { label: "Somewhat urgent", value: "Somewhat urgent" },
            { label: "No particular rush", value: "No particular rush" }
        ];
    }

    // Attorney
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes, currently", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }

    // Other party has attorney
    if (lowerText.includes('other party') && lowerText.includes('attorney')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('is there') || lowerText.includes('did you') || lowerText.includes('were you') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') &&
        !lowerText.includes('type') && !lowerText.includes('how long') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getTaxLawButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Type of tax issue
    if (lowerText.includes('type of') && lowerText.includes('tax') ||
        lowerText.includes('tax issue') || lowerText.includes('tax problem') ||
        lowerText.includes('help with')) {
        return [
            { label: "Back Taxes Owed", value: "Back Taxes Owed" },
            { label: "IRS Audit", value: "IRS Audit" },
            { label: "Wage Garnishment", value: "Wage Garnishment" },
            { label: "Bank Levy", value: "Bank Levy" },
            { label: "Tax Lien", value: "Tax Lien" },
            { label: "Unfiled Returns", value: "Unfiled Tax Returns" },
            { label: "Penalty Abatement", value: "Penalty Abatement" },
            { label: "Offer in Compromise", value: "Offer in Compromise" },
            { label: "Other", value: "Other" }
        ];
    }

    // Tax years affected
    if (lowerText.includes('tax year') || lowerText.includes('years affected') || lowerText.includes('which year')) {
        return [
            { label: "Just this year", value: "Current year only" },
            { label: "1-2 years", value: "1-2 years" },
            { label: "3-5 years", value: "3-5 years" },
            { label: "More than 5 years", value: "More than 5 years" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Amount owed
    if (lowerText.includes('amount') && (lowerText.includes('owe') || lowerText.includes('debt') || lowerText.includes('back taxes'))) {
        return [
            { label: "Under $10,000", value: "Under $10,000" },
            { label: "$10,000 - $25,000", value: "$10,000 - $25,000" },
            { label: "$25,000 - $50,000", value: "$25,000 - $50,000" },
            { label: "$50,000 - $100,000", value: "$50,000 - $100,000" },
            { label: "Over $100,000", value: "Over $100,000" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // IRS notices
    if (lowerText.includes('notice') || lowerText.includes('irs') && lowerText.includes('letter')) {
        return [
            { label: "Yes, audit notice", value: "Yes, audit notice" },
            { label: "Yes, levy/garnishment", value: "Yes, levy or garnishment notice" },
            { label: "Yes, lien notice", value: "Yes, lien notice" },
            { label: "Yes, other notice", value: "Yes, other IRS notice" },
            { label: "No notices", value: "No notices received" }
        ];
    }

    // Payment plan
    if (lowerText.includes('payment plan') || lowerText.includes('installment')) {
        return [
            { label: "Yes, current plan", value: "Yes, currently on payment plan" },
            { label: "Yes, but defaulted", value: "Had plan but defaulted" },
            { label: "No payment plan", value: "No payment plan" }
        ];
    }

    // Returns filed
    if (lowerText.includes('return') && (lowerText.includes('filed') || lowerText.includes('current') || lowerText.includes('up to date'))) {
        return [
            { label: "All filed/current", value: "All returns filed and current" },
            { label: "Some unfiled", value: "Some years unfiled" },
            { label: "Multiple years unfiled", value: "Multiple years unfiled" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Worked with tax attorney before
    if (lowerText.includes('tax attorney') || lowerText.includes('tax professional')) {
        return [
            { label: "No", value: "No" },
            { label: "Yes, currently", value: "Yes, currently working with one" },
            { label: "Yes, in past", value: "Yes, in the past" }
        ];
    }

    // Urgency (garnishment, levy)
    if (lowerText.includes('urgent') || lowerText.includes('garnish') || lowerText.includes('levy') || lowerText.includes('seize')) {
        return [
            { label: "Yes, wages garnished", value: "Yes, wages being garnished" },
            { label: "Yes, bank levy", value: "Yes, bank account levied" },
            { label: "Threatened but not yet", value: "Threatened but not yet" },
            { label: "No immediate action", value: "No immediate IRS action" }
        ];
    }

    // Attorney
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes, currently", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') && !lowerText.includes('type') &&
        !lowerText.includes('how much') && !lowerText.includes('how many') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getBankruptcyButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Reason for bankruptcy
    if (lowerText.includes('reason') || lowerText.includes('why') && lowerText.includes('bankruptcy') ||
        lowerText.includes('primary') && lowerText.includes('considering')) {
        return [
            { label: "Credit Card Debt", value: "Credit Card Debt" },
            { label: "Medical Bills", value: "Medical Bills" },
            { label: "Job Loss/Reduced Income", value: "Job Loss or Reduced Income" },
            { label: "Foreclosure", value: "Facing Foreclosure" },
            { label: "Lawsuit/Judgment", value: "Lawsuit or Judgment" },
            { label: "Divorce", value: "Divorce-Related Debt" },
            { label: "Other", value: "Other" }
        ];
    }

    // Total debt amount
    if (lowerText.includes('total debt') || lowerText.includes('how much') && lowerText.includes('owe') ||
        lowerText.includes('debt amount')) {
        return [
            { label: "Under $10,000", value: "Under $10,000" },
            { label: "$10,000 - $25,000", value: "$10,000 - $25,000" },
            { label: "$25,000 - $50,000", value: "$25,000 - $50,000" },
            { label: "$50,000 - $100,000", value: "$50,000 - $100,000" },
            { label: "Over $100,000", value: "Over $100,000" }
        ];
    }

    // Types of debt
    if (lowerText.includes('type') && lowerText.includes('debt') || lowerText.includes('kinds of debt')) {
        return {
            multiSelect: true,
            buttons: [
                { label: "Credit Cards", value: "Credit Cards" },
                { label: "Medical Bills", value: "Medical Bills" },
                { label: "Mortgage", value: "Mortgage" },
                { label: "Car Loan", value: "Car Loan" },
                { label: "Student Loans", value: "Student Loans" },
                { label: "Tax Debt", value: "Tax Debt" },
                { label: "Personal Loans", value: "Personal Loans" }
            ]
        };
    }

    // Employment status
    if (lowerText.includes('employment') || lowerText.includes('employed') || lowerText.includes('job') || lowerText.includes('work')) {
        return [
            { label: "Employed Full-Time", value: "Employed Full-Time" },
            { label: "Employed Part-Time", value: "Employed Part-Time" },
            { label: "Self-Employed", value: "Self-Employed" },
            { label: "Unemployed", value: "Unemployed" },
            { label: "Retired", value: "Retired" },
            { label: "Disabled", value: "Disabled" }
        ];
    }

    // Foreclosure/Repossession
    if (lowerText.includes('foreclosure') || lowerText.includes('repossess')) {
        return [
            { label: "Yes, facing now", value: "Yes, facing foreclosure/repossession now" },
            { label: "Behind on payments", value: "Behind on payments but not yet" },
            { label: "No", value: "No" }
        ];
    }

    // Wage garnishment
    if (lowerText.includes('garnish') || lowerText.includes('wages') && lowerText.includes('taken')) {
        return [
            { label: "Yes", value: "Yes, wages being garnished" },
            { label: "No", value: "No" }
        ];
    }

    // Previous bankruptcy
    if (lowerText.includes('filed bankruptcy') || lowerText.includes('previous bankruptcy') || lowerText.includes('bankruptcy before')) {
        return [
            { label: "No, never", value: "No, never filed" },
            { label: "Yes, 8+ years ago", value: "Yes, more than 8 years ago" },
            { label: "Yes, 2-8 years ago", value: "Yes, 2-8 years ago" },
            { label: "Yes, less than 2 years", value: "Yes, less than 2 years ago" }
        ];
    }

    // Urgency
    if (lowerText.includes('urgent') || lowerText.includes('deadline') || lowerText.includes('court date') || lowerText.includes('timeline')) {
        return [
            { label: "Very urgent", value: "Very urgent - immediate threat" },
            { label: "Somewhat urgent", value: "Somewhat urgent" },
            { label: "Planning ahead", value: "Planning ahead" }
        ];
    }

    // Attorney
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented') || lowerText.includes('consulted')) {
        return [
            { label: "No", value: "No" },
            { label: "Yes, currently", value: "Yes, currently consulting" },
            { label: "Yes, in past", value: "Consulted in the past" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') && !lowerText.includes('type') &&
        !lowerText.includes('how much') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getCriminalDefenseButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Who is this for
    if (lowerText.includes('yourself') || lowerText.includes('someone else') || lowerText.includes('who is this for')) {
        return [
            { label: "Myself", value: "For myself" },
            { label: "Family member", value: "For a family member" },
            { label: "Friend", value: "For a friend" }
        ];
    }

    // Type of charge
    if (lowerText.includes('charged with') || lowerText.includes('type of charge') || lowerText.includes('what are')) {
        return [
            { label: "DUI/DWI", value: "DUI/DWI" },
            { label: "Drug Offense", value: "Drug Offense" },
            { label: "Theft/Property Crime", value: "Theft/Property Crime" },
            { label: "Assault/Violent Crime", value: "Assault/Violent Crime" },
            { label: "Domestic Violence", value: "Domestic Violence" },
            { label: "White Collar/Fraud", value: "White Collar/Fraud" },
            { label: "Sex Offense", value: "Sex Offense" },
            { label: "Other", value: "Other" }
        ];
    }

    // Felony or misdemeanor
    if (lowerText.includes('felony') || lowerText.includes('misdemeanor') || lowerText.includes('level of charge')) {
        return [
            { label: "Felony", value: "Felony" },
            { label: "Misdemeanor", value: "Misdemeanor" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Arrested
    if (lowerText.includes('arrest') && !lowerText.includes('prior')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No, under investigation", value: "No, under investigation" },
            { label: "Warrant issued", value: "Warrant issued but not arrested" }
        ];
    }

    // In custody or out on bail
    if (lowerText.includes('custody') || lowerText.includes('bail') || lowerText.includes('jail')) {
        return [
            { label: "In custody", value: "Currently in custody" },
            { label: "Out on bail", value: "Out on bail" },
            { label: "Released on own recognizance", value: "Released on own recognizance" },
            { label: "Not arrested yet", value: "Not arrested yet" }
        ];
    }

    // Court date
    if (lowerText.includes('court date') || lowerText.includes('hearing') && lowerText.includes('scheduled')) {
        return [
            { label: "Yes, within 2 weeks", value: "Yes, within 2 weeks" },
            { label: "Yes, 2-4 weeks", value: "Yes, 2-4 weeks away" },
            { label: "Yes, more than a month", value: "Yes, more than a month away" },
            { label: "No date yet", value: "No date scheduled yet" }
        ];
    }

    // Public defender
    if (lowerText.includes('public defender') || lowerText.includes('assigned attorney')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Applied/waiting", value: "Applied but waiting" }
        ];
    }

    // Prior convictions
    if (lowerText.includes('prior') && (lowerText.includes('conviction') || lowerText.includes('criminal') || lowerText.includes('record'))) {
        return [
            { label: "No prior record", value: "No prior criminal record" },
            { label: "Prior misdemeanor", value: "Prior misdemeanor conviction" },
            { label: "Prior felony", value: "Prior felony conviction" },
            { label: "Prefer not to say", value: "Prefer not to say" }
        ];
    }

    // Attorney
    if (lowerText.includes('private attorney') || lowerText.includes('have an attorney') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No" },
            { label: "Yes, currently", value: "Yes, have private attorney" },
            { label: "Public defender only", value: "Only public defender" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') && !lowerText.includes('type') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getEstatePlanningButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Type of estate planning
    if (lowerText.includes('type of') || lowerText.includes('what kind') || lowerText.includes('help with')) {
        return [
            { label: "Will", value: "Will" },
            { label: "Living Trust", value: "Living Trust" },
            { label: "Power of Attorney", value: "Power of Attorney" },
            { label: "Healthcare Directive", value: "Healthcare Directive" },
            { label: "Trust Administration", value: "Trust Administration" },
            { label: "Probate", value: "Probate" },
            { label: "Asset Protection", value: "Asset Protection" },
            { label: "Not sure", value: "Not sure what I need" }
        ];
    }

    // Existing documents
    if (lowerText.includes('existing') && (lowerText.includes('will') || lowerText.includes('trust') || lowerText.includes('document') || lowerText.includes('estate plan'))) {
        return [
            { label: "No existing documents", value: "No existing estate plan" },
            { label: "Have will, needs update", value: "Have will but needs updating" },
            { label: "Have trust, needs update", value: "Have trust but needs updating" },
            { label: "Have current documents", value: "Have current documents" }
        ];
    }

    // Marital status
    if (lowerText.includes('married') || lowerText.includes('marital') || lowerText.includes('spouse')) {
        return [
            { label: "Single", value: "Single" },
            { label: "Married", value: "Married" },
            { label: "Divorced", value: "Divorced" },
            { label: "Widowed", value: "Widowed" },
            { label: "Domestic Partnership", value: "Domestic Partnership" }
        ];
    }

    // Children
    if (lowerText.includes('children') || lowerText.includes('minor') || lowerText.includes('dependents')) {
        return [
            { label: "No children", value: "No children" },
            { label: "Minor children", value: "Yes, minor children" },
            { label: "Adult children only", value: "Adult children only" },
            { label: "Both minor and adult", value: "Both minor and adult children" }
        ];
    }

    // Special circumstances
    if (lowerText.includes('special needs') || lowerText.includes('special circumstances') || lowerText.includes('disabled')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Asset types
    if (lowerText.includes('type') && lowerText.includes('asset') || lowerText.includes('what assets')) {
        return {
            multiSelect: true,
            buttons: [
                { label: "Real Estate", value: "Real Estate" },
                { label: "Retirement Accounts", value: "Retirement Accounts" },
                { label: "Investment Accounts", value: "Investment Accounts" },
                { label: "Business Interests", value: "Business Interests" },
                { label: "Life Insurance", value: "Life Insurance" },
                { label: "Other Assets", value: "Other Significant Assets" }
            ]
        };
    }

    // Business interests
    if (lowerText.includes('business') && (lowerText.includes('own') || lowerText.includes('interest'))) {
        return [
            { label: "Yes", value: "Yes, have business interests" },
            { label: "No", value: "No business interests" }
        ];
    }

    // Health urgency
    if (lowerText.includes('health') && (lowerText.includes('concern') || lowerText.includes('urgent') || lowerText.includes('illness'))) {
        return [
            { label: "Yes, urgent", value: "Yes, health concerns creating urgency" },
            { label: "Planning ahead", value: "No, planning ahead" }
        ];
    }

    // Timeline
    if (lowerText.includes('timeline') || lowerText.includes('how soon') || lowerText.includes('when')) {
        return [
            { label: "As soon as possible", value: "As soon as possible" },
            { label: "Within a month", value: "Within a month" },
            { label: "Within 3 months", value: "Within 3 months" },
            { label: "No rush", value: "No particular rush" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') && !lowerText.includes('type') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getPersonalInjuryButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Incident timing
    if (lowerText.includes('when') && (lowerText.includes('incident') || lowerText.includes('accident') || lowerText.includes('occur'))) {
        return [
            { label: "Less than 1 year ago", value: "Less than 1 year ago" },
            { label: "1-2 years ago", value: "1-2 years ago" },
            { label: "More than 2 years ago", value: "More than 2 years ago" }
        ];
    }

    // Physically injured
    if (lowerText.includes('physical') && lowerText.includes('injur')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Medical treatment type
    if ((lowerText.includes('treatment') || lowerText.includes('medical care')) &&
        !lowerText.includes('currently') && !lowerText.includes('still')) {
        return [
            { label: "Emergency Room", value: "Emergency Room" },
            { label: "Hospital (admitted)", value: "Hospital Admission" },
            { label: "Urgent Care", value: "Urgent Care" },
            { label: "Doctor's Office", value: "Doctor's Office" },
            { label: "Specialist", value: "Specialist" },
            { label: "Chiropractor", value: "Chiropractor" },
            { label: "Physical Therapy", value: "Physical Therapy" },
            { label: "No treatment yet", value: "No treatment yet" }
        ];
    }

    // Incident type
    if (lowerText.includes('type of incident') || lowerText.includes('what happened') || lowerText.includes('kind of accident')) {
        return [
            { label: "Car Accident", value: "Car Accident" },
            { label: "Motorcycle Accident", value: "Motorcycle Accident" },
            { label: "Truck Accident", value: "Truck Accident" },
            { label: "Slip and Fall", value: "Slip and Fall" },
            { label: "Dog Bite", value: "Dog Bite" },
            { label: "Workplace Injury", value: "Workplace Injury" },
            { label: "Other", value: "Other" }
        ];
    }

    // Collision type
    if (lowerText.includes('type of') && (lowerText.includes('collision') || lowerText.includes('crash'))) {
        return [
            { label: "Rear-end", value: "Rear-end" },
            { label: "T-bone / Side impact", value: "T-bone" },
            { label: "Head-on", value: "Head-on" },
            { label: "Sideswipe", value: "Sideswipe" },
            { label: "Hit-and-run", value: "Hit-and-run" }
        ];
    }

    // Fault assessment
    if (lowerText.includes('fault') || lowerText.includes('responsible')) {
        return [
            { label: "Other party", value: "Other party was at fault" },
            { label: "Shared fault", value: "Shared fault" },
            { label: "I was at fault", value: "I was at fault" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Police report
    if (lowerText.includes('police') && lowerText.includes('report')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Evidence
    if (lowerText.includes('evidence') || lowerText.includes('documentation')) {
        return {
            multiSelect: true,
            buttons: [
                { label: "Photos/Videos", value: "Photos/Videos" },
                { label: "Witness Info", value: "Witness Information" },
                { label: "Police Report", value: "Police Report" },
                { label: "Medical Records", value: "Medical Records" },
                { label: "None of these", value: "None of these" }
            ]
        };
    }

    // Vehicle damage
    if (lowerText.includes('damage') && (lowerText.includes('vehicle') || lowerText.includes('car'))) {
        return [
            { label: "Minor", value: "Minor damage" },
            { label: "Moderate", value: "Moderate damage" },
            { label: "Severe", value: "Severe damage" },
            { label: "Total loss", value: "Total loss" }
        ];
    }

    // Emergency room
    if (lowerText.includes('emergency room') || /\\bthe er\\b|\\bto er\\b/.test(lowerText)) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Surgery
    if (lowerText.includes('surgery')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Missed work
    if (lowerText.includes('miss') && lowerText.includes('work')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Insurance
    if (lowerText.includes('insur')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Attorney
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }

    // Generic Yes/No (only for actual yes/no questions, not WH-questions)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('did you') || lowerText.includes('were you') || lowerText.includes('is there') ||
         lowerText.includes('was there') || lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') && !lowerText.includes('type') &&
        !lowerText.includes('when') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('how') && !lowerText.includes('describe') && !lowerText.includes('explain') &&
        !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

function getGenericButtonsFunction() {
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Timeline questions
    if (lowerText.includes('when') && (lowerText.includes('occur') || lowerText.includes('happen') ||
        lowerText.includes('began') || lowerText.includes('start'))) {
        return [
            { label: "Within the last month", value: "Within the last month" },
            { label: "1-6 months ago", value: "1-6 months ago" },
            { label: "6-12 months ago", value: "6-12 months ago" },
            { label: "1-2 years ago", value: "1-2 years ago" },
            { label: "More than 2 years ago", value: "More than 2 years ago" }
        ];
    }

    // Urgency questions
    if (lowerText.includes('urgent') || lowerText.includes('deadline') || lowerText.includes('court date')) {
        return [
            { label: "Yes, very urgent", value: "Yes, very urgent" },
            { label: "Somewhat urgent", value: "Somewhat urgent" },
            { label: "No particular rush", value: "No particular rush" }
        ];
    }

    // Attorney representation
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represented')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes, currently", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }

    // Location - but AVOID matching "United States" by checking for specific location patterns
    if ((lowerText.includes('located in') || lowerText.includes('reside in') ||
         lowerText.includes('live in') || lowerText.includes('happen in')) &&
        (lowerText.includes('california') || lowerText.includes('texas') || lowerText.includes('florida') ||
         lowerText.includes('new york') || lowerText.match(/in \\w+ (state|county)/))) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Generic Yes/No - with strict exclusions (only for actual yes/no questions)
    if ((lowerText.includes('do you have') || lowerText.includes('are you currently') ||
         lowerText.includes('have you ever') || lowerText.includes('did you') ||
         lowerText.includes('is there') || lowerText.includes('was there') ||
         lowerText.includes('can you') || lowerText.includes('will you')) &&
        !lowerText.includes('what') && !lowerText.includes('which') &&
        !lowerText.includes('type') && !lowerText.includes('kind') &&
        !lowerText.includes('how') && !lowerText.includes('where') && !lowerText.includes('why') &&
        !lowerText.includes('when') && !lowerText.includes('status') && !lowerText.includes('describe') &&
        !lowerText.includes('explain') && !lowerText.includes('tell me')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    return null;
}`;
}

/**
 * ButtonsContent functions - return just the detection content for combining in multi-practice demos
 */
function getImmigrationButtonsContent() {
    return `    // Immigration status
    if ((lowerText.includes('immigration status') || lowerText.includes('current status')) &&
        !lowerText.includes('change') && !lowerText.includes('adjust')) {
        return [
            { label: "US Citizen", value: "US Citizen" },
            { label: "Green Card Holder", value: "Green Card Holder (Permanent Resident)" },
            { label: "Valid Visa", value: "Valid Visa" },
            { label: "Expired Visa", value: "Expired Visa" },
            { label: "Undocumented", value: "Undocumented" },
            { label: "DACA", value: "DACA" },
            { label: "Asylum/Refugee", value: "Asylum/Refugee" },
            { label: "Other/Not Sure", value: "Other/Not Sure" }
        ];
    }

    // Type of immigration help
    if (lowerText.includes('type of immigration') || lowerText.includes('immigration help') ||
        lowerText.includes('what kind of help') || lowerText.includes('looking for help with')) {
        return [
            { label: "Visa Application", value: "Visa Application" },
            { label: "Green Card", value: "Green Card" },
            { label: "Citizenship/Naturalization", value: "Citizenship/Naturalization" },
            { label: "Deportation/Removal Defense", value: "Deportation/Removal Defense" },
            { label: "Asylum", value: "Asylum" },
            { label: "Work Permit", value: "Work Permit" },
            { label: "Family Petition", value: "Family Petition" },
            { label: "Other", value: "Other" }
        ];
    }

    // Visa type
    if (lowerText.includes('type of visa') || lowerText.includes('visa category') ||
        lowerText.includes('which visa') || lowerText.includes('what visa')) {
        return [
            { label: "H-1B (Work)", value: "H-1B Work Visa" },
            { label: "L-1 (Transfer)", value: "L-1 Transfer Visa" },
            { label: "O-1 (Extraordinary)", value: "O-1 Extraordinary Ability" },
            { label: "F-1 (Student)", value: "F-1 Student Visa" },
            { label: "B-1/B-2 (Visitor)", value: "B-1/B-2 Visitor Visa" },
            { label: "K-1 (Fiance)", value: "K-1 Fiance Visa" },
            { label: "Other/Not Sure", value: "Other/Not Sure" }
        ];
    }

    // Deportation/removal
    if (lowerText.includes('deportation') || lowerText.includes('removal') || lowerText.includes('immigration court')) {
        return [
            { label: "Yes, active proceedings", value: "Yes, in removal proceedings" },
            { label: "Received notice", value: "Received notice to appear" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }`;
}

function getFamilyLawButtonsContent() {
    return `    // Type of family law matter
    if (lowerText.includes('type of') && (lowerText.includes('family') || lowerText.includes('matter') || lowerText.includes('help')) ||
        lowerText.includes('family law') && lowerText.includes('need')) {
        return [
            { label: "Divorce", value: "Divorce" },
            { label: "Child Custody", value: "Child Custody" },
            { label: "Child Support", value: "Child Support" },
            { label: "Spousal Support/Alimony", value: "Spousal Support/Alimony" },
            { label: "Domestic Violence", value: "Domestic Violence/Restraining Order" },
            { label: "Prenuptial Agreement", value: "Prenuptial Agreement" },
            { label: "Adoption", value: "Adoption" },
            { label: "Other", value: "Other" }
        ];
    }

    // Children involved
    if (lowerText.includes('children') && (lowerText.includes('involved') || lowerText.includes('have') || lowerText.includes('any'))) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Current custody arrangement
    if (lowerText.includes('custody') && (lowerText.includes('current') || lowerText.includes('arrangement'))) {
        return [
            { label: "No arrangement yet", value: "No formal arrangement" },
            { label: "Joint custody", value: "Joint custody" },
            { label: "I have primary custody", value: "I have primary custody" },
            { label: "Other parent has custody", value: "Other parent has primary custody" },
            { label: "Supervised visitation", value: "Supervised visitation" }
        ];
    }

    // Contested vs uncontested
    if (lowerText.includes('contested') || (lowerText.includes('agree') && !lowerText.includes('disagree')) || lowerText.includes('amicable')) {
        return [
            { label: "Contested (disagreement)", value: "Contested - we disagree on terms" },
            { label: "Uncontested (agreement)", value: "Uncontested - we agree on terms" },
            { label: "Not sure yet", value: "Not sure yet" }
        ];
    }

    // Safety concerns
    if (lowerText.includes('safety') || lowerText.includes('abuse') || lowerText.includes('violence') || lowerText.includes('danger')) {
        return [
            { label: "Yes, urgent safety concern", value: "Yes, urgent safety concern" },
            { label: "Yes, but not immediate", value: "Yes, but not immediate danger" },
            { label: "No safety concerns", value: "No safety concerns" }
        ];
    }

    // Served with papers
    if (lowerText.includes('served') || lowerText.includes('papers') || lowerText.includes('petition')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // How long married
    if (lowerText.includes('how long') && lowerText.includes('married')) {
        return [
            { label: "Less than 1 year", value: "Less than 1 year" },
            { label: "1-5 years", value: "1-5 years" },
            { label: "5-10 years", value: "5-10 years" },
            { label: "10-20 years", value: "10-20 years" },
            { label: "More than 20 years", value: "More than 20 years" }
        ];
    }

    // Urgency
    if (lowerText.includes('urgent') || lowerText.includes('deadline') || lowerText.includes('court date') || lowerText.includes('time-sensitive')) {
        return [
            { label: "Yes, very urgent", value: "Yes, very urgent" },
            { label: "Somewhat urgent", value: "Somewhat urgent" },
            { label: "No particular rush", value: "No particular rush" }
        ];
    }

    // Attorney representation
    if ((lowerText.includes('attorney') || lowerText.includes('lawyer')) && lowerText.includes('have')) {
        return [
            { label: "No", value: "No, not represented" },
            { label: "Yes, currently", value: "Yes, currently represented" },
            { label: "Previously", value: "Previously, but not now" }
        ];
    }`;
}

function getTaxLawButtonsContent() {
    return `    // Type of tax issue
    if (lowerText.includes('type of tax') || lowerText.includes('tax issue') || lowerText.includes('tax problem') ||
        lowerText.includes('irs') && lowerText.includes('issue')) {
        return [
            { label: "Back Taxes Owed", value: "Back Taxes Owed" },
            { label: "IRS Audit", value: "IRS Audit" },
            { label: "Tax Liens/Levies", value: "Tax Liens or Levies" },
            { label: "Wage Garnishment", value: "Wage Garnishment" },
            { label: "Unfiled Returns", value: "Unfiled Tax Returns" },
            { label: "Payroll Tax Issues", value: "Payroll Tax Issues" },
            { label: "Other", value: "Other Tax Issue" }
        ];
    }

    // Amount owed
    if (lowerText.includes('how much') && (lowerText.includes('owe') || lowerText.includes('debt') || lowerText.includes('amount'))) {
        return [
            { label: "Under $10,000", value: "Under $10,000" },
            { label: "$10,000 - $25,000", value: "$10,000 - $25,000" },
            { label: "$25,000 - $50,000", value: "$25,000 - $50,000" },
            { label: "$50,000 - $100,000", value: "$50,000 - $100,000" },
            { label: "Over $100,000", value: "Over $100,000" },
            { label: "Not sure", value: "Not sure of exact amount" }
        ];
    }

    // Years affected
    if (lowerText.includes('year') && (lowerText.includes('which') || lowerText.includes('how many') || lowerText.includes('affected'))) {
        return [
            { label: "Current year only", value: "Current year only" },
            { label: "1-2 years", value: "1-2 years" },
            { label: "3-5 years", value: "3-5 years" },
            { label: "More than 5 years", value: "More than 5 years" }
        ];
    }

    // Current payment plan
    if (lowerText.includes('payment plan') || lowerText.includes('installment') || lowerText.includes('paying irs')) {
        return [
            { label: "Yes, current plan", value: "Yes, on a payment plan" },
            { label: "Had one, stopped", value: "Had one, but stopped paying" },
            { label: "No plan", value: "No payment plan" },
            { label: "Tried, was denied", value: "Tried but was denied" }
        ];
    }`;
}

function getBankruptcyButtonsContent() {
    return `    // Type of bankruptcy consideration
    if (lowerText.includes('type of') && lowerText.includes('debt') ||
        lowerText.includes('kind of debt') || lowerText.includes('primary debt')) {
        return [
            { label: "Credit Card Debt", value: "Credit Card Debt" },
            { label: "Medical Bills", value: "Medical Bills" },
            { label: "Mortgage/Home", value: "Mortgage/Home Debt" },
            { label: "Auto Loans", value: "Auto Loans" },
            { label: "Student Loans", value: "Student Loans" },
            { label: "Tax Debt", value: "Tax Debt" },
            { label: "Business Debt", value: "Business Debt" },
            { label: "Multiple Types", value: "Multiple Types of Debt" }
        ];
    }

    // Total debt amount
    if (lowerText.includes('total') && lowerText.includes('debt') || lowerText.includes('how much') && lowerText.includes('owe')) {
        return [
            { label: "Under $10,000", value: "Under $10,000" },
            { label: "$10,000 - $25,000", value: "$10,000 - $25,000" },
            { label: "$25,000 - $50,000", value: "$25,000 - $50,000" },
            { label: "$50,000 - $100,000", value: "$50,000 - $100,000" },
            { label: "Over $100,000", value: "Over $100,000" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Employment status
    if (lowerText.includes('employ') || lowerText.includes('working') || lowerText.includes('income')) {
        return [
            { label: "Employed full-time", value: "Employed full-time" },
            { label: "Employed part-time", value: "Employed part-time" },
            { label: "Self-employed", value: "Self-employed" },
            { label: "Unemployed", value: "Unemployed" },
            { label: "Retired", value: "Retired" },
            { label: "Disabled", value: "Disabled" }
        ];
    }

    // Previous bankruptcy
    if (lowerText.includes('previous') && lowerText.includes('bankruptcy') || lowerText.includes('filed') && lowerText.includes('before')) {
        return [
            { label: "Never filed", value: "Never filed bankruptcy" },
            { label: "Yes, more than 8 years ago", value: "Yes, more than 8 years ago" },
            { label: "Yes, 4-8 years ago", value: "Yes, 4-8 years ago" },
            { label: "Yes, less than 4 years ago", value: "Yes, less than 4 years ago" }
        ];
    }`;
}

function getCriminalDefenseButtonsContent() {
    return `    // Type of charges
    if (lowerText.includes('type of') && (lowerText.includes('charge') || lowerText.includes('crime') || lowerText.includes('offense')) ||
        lowerText.includes('charged with') || lowerText.includes('accused of')) {
        return [
            { label: "DUI/DWI", value: "DUI/DWI" },
            { label: "Drug Charges", value: "Drug Charges" },
            { label: "Assault/Battery", value: "Assault/Battery" },
            { label: "Theft/Burglary", value: "Theft/Burglary" },
            { label: "Domestic Violence", value: "Domestic Violence" },
            { label: "White Collar Crime", value: "White Collar Crime" },
            { label: "Sex Crimes", value: "Sex Crimes" },
            { label: "Other", value: "Other" }
        ];
    }

    // Felony or misdemeanor
    if (lowerText.includes('felony') || lowerText.includes('misdemeanor') || lowerText.includes('level') && lowerText.includes('charge')) {
        return [
            { label: "Felony", value: "Felony" },
            { label: "Misdemeanor", value: "Misdemeanor" },
            { label: "Not sure", value: "Not sure" },
            { label: "Both", value: "Both felony and misdemeanor" }
        ];
    }

    // Current status
    if (lowerText.includes('current') && lowerText.includes('status') || lowerText.includes('case status') ||
        lowerText.includes('where') && lowerText.includes('case')) {
        return [
            { label: "Just arrested", value: "Just arrested" },
            { label: "Out on bail", value: "Out on bail" },
            { label: "Awaiting trial", value: "Awaiting trial" },
            { label: "Trial scheduled", value: "Trial scheduled" },
            { label: "Convicted, seeking appeal", value: "Convicted, seeking appeal" },
            { label: "Under investigation", value: "Under investigation" }
        ];
    }

    // Custody status
    if (lowerText.includes('custody') || lowerText.includes('jail') || lowerText.includes('detained')) {
        return [
            { label: "Currently in custody", value: "Currently in custody" },
            { label: "Released on bail", value: "Released on bail" },
            { label: "Released on own recognizance", value: "Released on own recognizance" },
            { label: "Not in custody", value: "Not in custody" }
        ];
    }`;
}

function getEstatePlanningButtonsContent() {
    return `    // Type of estate planning need
    if (lowerText.includes('type of') && (lowerText.includes('planning') || lowerText.includes('estate') || lowerText.includes('help')) ||
        lowerText.includes('what') && lowerText.includes('need') && lowerText.includes('estate')) {
        return [
            { label: "Create a Will", value: "Create a Will" },
            { label: "Create a Trust", value: "Create a Trust" },
            { label: "Update Existing Documents", value: "Update Existing Documents" },
            { label: "Power of Attorney", value: "Power of Attorney" },
            { label: "Healthcare Directive", value: "Healthcare Directive" },
            { label: "Probate Assistance", value: "Probate Assistance" },
            { label: "Estate Administration", value: "Estate Administration" },
            { label: "Not Sure", value: "Not Sure - Need Guidance" }
        ];
    }

    // Current documents
    if (lowerText.includes('current') && (lowerText.includes('will') || lowerText.includes('trust') || lowerText.includes('documents'))) {
        return [
            { label: "No documents yet", value: "No estate planning documents" },
            { label: "Have a will", value: "Have a will" },
            { label: "Have a trust", value: "Have a trust" },
            { label: "Have both", value: "Have both will and trust" },
            { label: "Not sure", value: "Not sure what I have" }
        ];
    }

    // Estate value
    if (lowerText.includes('estate') && lowerText.includes('value') || lowerText.includes('assets') && lowerText.includes('worth') ||
        lowerText.includes('total value')) {
        return [
            { label: "Under $100,000", value: "Under $100,000" },
            { label: "$100,000 - $500,000", value: "$100,000 - $500,000" },
            { label: "$500,000 - $1 million", value: "$500,000 - $1 million" },
            { label: "$1 - $5 million", value: "$1 - $5 million" },
            { label: "Over $5 million", value: "Over $5 million" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // Minor children
    if (lowerText.includes('minor') && lowerText.includes('children') || lowerText.includes('children under')) {
        return [
            { label: "Yes", value: "Yes, have minor children" },
            { label: "No", value: "No minor children" }
        ];
    }`;
}

function getPersonalInjuryButtonsContent() {
    return `    // Type of incident
    if (lowerText.includes('type of') && (lowerText.includes('incident') || lowerText.includes('accident') || lowerText.includes('injury')) ||
        lowerText.includes('what happened') || lowerText.includes('how were you injured')) {
        return [
            { label: "Car Accident", value: "Car Accident" },
            { label: "Truck Accident", value: "Truck Accident" },
            { label: "Motorcycle Accident", value: "Motorcycle Accident" },
            { label: "Slip and Fall", value: "Slip and Fall" },
            { label: "Medical Malpractice", value: "Medical Malpractice" },
            { label: "Workplace Injury", value: "Workplace Injury" },
            { label: "Product Liability", value: "Product Liability" },
            { label: "Dog Bite", value: "Dog Bite" },
            { label: "Other", value: "Other" }
        ];
    }

    // When did it happen
    if (lowerText.includes('when') && (lowerText.includes('happen') || lowerText.includes('occur') || lowerText.includes('incident') || lowerText.includes('accident'))) {
        return [
            { label: "Within last week", value: "Within last week" },
            { label: "Within last month", value: "Within last month" },
            { label: "1-6 months ago", value: "1-6 months ago" },
            { label: "6-12 months ago", value: "6-12 months ago" },
            { label: "1-2 years ago", value: "1-2 years ago" },
            { label: "Over 2 years ago", value: "Over 2 years ago" }
        ];
    }

    // Medical treatment
    if (lowerText.includes('medical') && (lowerText.includes('treatment') || lowerText.includes('care') || lowerText.includes('attention'))) {
        return [
            { label: "ER/Hospital", value: "Emergency Room/Hospital" },
            { label: "Urgent Care", value: "Urgent Care" },
            { label: "Doctor Visit", value: "Doctor Visit" },
            { label: "Ongoing Treatment", value: "Ongoing Treatment" },
            { label: "No Treatment Yet", value: "No Treatment Yet" },
            { label: "No Treatment Needed", value: "No Treatment Needed" }
        ];
    }

    // Type of injuries
    if (lowerText.includes('type of') && lowerText.includes('injur') || lowerText.includes('what injur')) {
        return [
            { label: "Broken Bones", value: "Broken Bones" },
            { label: "Soft Tissue", value: "Soft Tissue Injuries" },
            { label: "Head/Brain Injury", value: "Head/Brain Injury" },
            { label: "Back/Spine", value: "Back/Spine Injury" },
            { label: "Neck/Whiplash", value: "Neck/Whiplash" },
            { label: "Multiple Injuries", value: "Multiple Injuries" },
            { label: "Not Sure", value: "Not Sure Yet" }
        ];
    }

    // Fault
    if (lowerText.includes('fault') || lowerText.includes('responsible') || lowerText.includes('caused')) {
        return [
            { label: "Other party at fault", value: "Other party was at fault" },
            { label: "Shared fault", value: "Shared fault" },
            { label: "Unsure", value: "Unsure who was at fault" }
        ];
    }`;
}

/**
 * Generate progress steps HTML
 * For multi-practice firms, only show "Basic Information" initially - the rest will populate dynamically
 */
function generateProgressSteps(practiceArea, isMultiPractice = false) {
    if (isMultiPractice) {
        // Multi-practice: only show "Basic Information" initially
        // Additional steps will be added dynamically when user selects their practice area
        return `
                    <div class="progress-step active" data-step="1">
                        <div class="step-indicator">1<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></div>
                        <span class="step-text">Basic Information</span>
                    </div>`;
    }
    // Single practice: show all steps from the start
    const steps = getProgressStepLabels(practiceArea);
    return steps.map((label, i) => `
                    <div class="progress-step${i === 0 ? ' active' : ''}" data-step="${i + 1}">
                        <div class="step-indicator">${i + 1}<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></div>
                        <span class="step-text">${label}</span>
                    </div>`).join('');
}

function getProgressStepLabels(practiceArea) {
    const area = practiceArea.toLowerCase();
    if (area.includes('personal injury')) {
        return ['Basic Information', 'Incident Details', 'Liability Assessment', 'Injuries & Treatment', 'Insurance Details'];
    } else if (area.includes('immigration')) {
        return ['Basic Information', 'Immigration Status', 'Case Details', 'Application History', 'Review'];
    } else if (area.includes('family')) {
        return ['Basic Information', 'Case Type', 'Family Details', 'Urgency Assessment', 'Review'];
    } else if (area.includes('tax')) {
        return ['Basic Information', 'Tax Issue', 'IRS Situation', 'Resolution Options', 'Review'];
    } else if (area.includes('bankruptcy')) {
        return ['Basic Information', 'Financial Situation', 'Debt Details', 'Qualification', 'Review'];
    } else if (area.includes('criminal')) {
        return ['Basic Information', 'Charges', 'Case Status', 'Court Details', 'Review'];
    } else if (area.includes('estate')) {
        return ['Basic Information', 'Planning Needs', 'Asset Overview', 'Special Circumstances', 'Review'];
    } else {
        return ['Basic Information', 'Case Overview', 'Details', 'Qualification', 'Review'];
    }
}

function getTotalSteps(practiceArea) {
    return getProgressStepLabels(practiceArea).length;
}

/**
 * Generate loading stages HTML and JSON
 */
function generateLoadingStagesHtml(practiceArea) {
    const stages = getLoadingStages(practiceArea);
    return stages.map(stage => `
                <div class="loading-stage" data-stage="${stage.id}">
                    <div class="loading-stage-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${stage.iconPath}" />
                        </svg>
                    </div>
                    <div class="loading-stage-text">
                        <h4>${stage.title}</h4>
                        <p>${stage.description}</p>
                    </div>
                </div>`).join('');
}

function generateLoadingStagesJson(practiceArea) {
    const stages = getLoadingStages(practiceArea);
    return JSON.stringify(stages);
}

function getLoadingStages(practiceArea) {
    const area = practiceArea.toLowerCase();
    if (area.includes('personal injury')) {
        return [
            { id: 'incident', title: 'Reviewing Incident Details', description: 'Analyzing your situation', iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { id: 'liability', title: 'Assessing Liability', description: 'Evaluating fault factors', iconPath: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
            { id: 'damages', title: 'Calculating Potential Value', description: 'Reviewing damages factors', iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
        ];
    } else {
        return [
            { id: 'review', title: 'Reviewing Your Information', description: 'Analyzing your situation', iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            { id: 'assess', title: 'Assessing Your Case', description: 'Evaluating key factors', iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { id: 'match', title: 'Matching to Services', description: 'Determining best next steps', iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }
        ];
    }
}

/**
 * Generate decline resources HTML
 */
function generateDeclineResources(state) {
    // State-specific resources
    const stateResources = {
        'CA': { bar: 'California State Bar', phone: '1-866-442-2529', url: 'https://www.calbar.ca.gov/Public/Need-Legal-Help/Lawyer-Referral-Service' },
        'NY': { bar: 'New York State Bar', phone: '1-800-342-3661', url: 'https://www.nysba.org/lawyerreferral/' },
        'TX': { bar: 'Texas State Bar', phone: '1-800-252-9690', url: 'https://www.texasbar.com/Content/NavigationMenu/ForThePublic/DoYouNeedaLawyer/LawyerReferralService/default.htm' },
        'FL': { bar: 'Florida Bar', phone: '1-800-342-8011', url: 'https://www.floridabar.org/public/lrs/' },
    };

    const resource = stateResources[state] || { bar: 'State Bar Lawyer Referral Service', phone: '', url: '' };

    return `
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>${resource.bar}: ${resource.phone ? `<strong>${resource.phone}</strong>` : 'Contact your state bar'}</span>
                    </li>
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Keep records of any relevant documents</span>
                    </li>
                    <li>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Note important dates related to your matter</span>
                    </li>`;
}

/**
 * Get landing headline by practice area
 */
function getLandingHeadline(practiceArea, isMultiPractice) {
    // For multi-practice firms, use generic headline
    if (isMultiPractice) return 'Free Consultation';

    // Single practice area: "Free {practiceArea} Consultation"
    if (practiceArea) {
        return `Free ${practiceArea} Consultation`;
    }

    return 'Free Consultation';
}

/**
 * Get landing subheadline
 */
function getLandingSubheadline(practiceArea, firmName, isMultiPractice) {
    // For multi-practice firms, use generic subheadline
    if (isMultiPractice) {
        return `Find out if ${firmName} can help with your legal matter in under 5 minutes. We'll review your situation quickly, carefully, and confidentially.`;
    }
    return `Find out if ${firmName} can help with your ${practiceArea.toLowerCase()} matter in under 5 minutes. We'll review your situation quickly, carefully, and confidentially.`;
}

/**
 * Get initial message for starting conversation
 */
function getInitialMessage(practiceArea, state, isMultiPractice) {
    // For multi-practice firms, don't assume which practice area - let the AI ask
    if (isMultiPractice) {
        return `I'd like to get a free case evaluation in ${state}.`;
    }
    return `I'd like to get a free case evaluation for a ${practiceArea.toLowerCase()} matter in ${state}.`;
}

/**
 * Lighten a hex color
 */
function _lightenColor(color, percent) {
    if (!color || !color.startsWith('#')) return null;

    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * Send demo ready notification email
 */
async function sendDemoReadyEmail(leadId, leadData, analysis, demoUrl) {
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
        console.error('SMTP credentials not configured for demo email');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
    });

    const firmName = analysis.firmName || 'Law Firm';
    const practiceArea = analysis.primaryPracticeArea || 'General';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0c1f3f;">Demo Ready: ${firmName}</h2>

    <p>A new intake demo has been generated and is ready for review.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Lead:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${leadData.name} (<a href="mailto:${leadData.email}">${leadData.email}</a>)</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Website:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${leadData.website}" target="_blank">${leadData.website}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Firm Name:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${firmName}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Practice Area:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${practiceArea}</td>
        </tr>
    </table>

    <p style="margin-top: 20px;">
        <a href="${demoUrl}"
           style="background: #c9a962; color: #0c1f3f; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Demo
        </a>
    </p>

    <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
        Demo URL: <a href="${demoUrl}">${demoUrl}</a>
    </p>

    <p style="margin-top: 30px;">
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/data/~2Fpreintake_leads~2F${leadId}"
           style="background: #0c1f3f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Firestore
        </a>
    </p>
</body>
</html>`;

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: NOTIFY_EMAIL,
            subject: `Demo Ready: ${firmName} - ${practiceArea}`,
            html: htmlContent,
        });
        console.log(`Demo ready email sent for lead ${leadId}`);
    } catch (error) {
        console.error('Error sending demo email:', error.message);
    }
}

/**
 * Send demo ready email for auto-confirmed flow (landing page form submission)
 * Uses ?demo= link format for instant demo loading (matches campaign email experience)
 */
async function sendAutoConfirmedDemoEmail(leadId, leadData, analysis, demoLinkUrl) {
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
        console.error('SMTP credentials not configured for auto-confirmed demo email');
        return;
    }

    if (!leadData.email) {
        console.error('No email address for auto-confirmed demo');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
    });

    const firmName = analysis.firmName || leadData.name || 'your firm';
    const firstName = leadData.name ? leadData.name.split(' ')[0] : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0c1f3f; font-size: 24px; margin-bottom: 10px;">PreIntake.ai</h1>
    </div>

    <p>Hi${firstName ? ' ' + firstName : ''},</p>

    <p>Your personalized AI intake demo for <strong>${firmName}</strong> is ready to view.</p>

    <p>Click below to see how PreIntake.ai reviews inquiries for your practice areas, identifies qualified cases, and delivers detailed assessments to your team.</p>

    <div style="text-align: center; margin: 20px 0;">
        <a href="${demoLinkUrl}"
           style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px;">
            View Your Demo
        </a>
    </div>

    <p style="color: #64748b; font-size: 14px;"><strong>What you'll experience:</strong></p>
    <ul style="color: #64748b; font-size: 14px; margin: 15px 0; padding-left: 20px;">
        <li>Conversational intake customized to your practice areas</li>
        <li>Real-time case evaluation and qualification</li>
        <li>Sample intake summary delivered to your inbox</li>
    </ul>

    <p style="color: #64748b; font-size: 14px;">This demo is private and accessible only via this email. Test it yourself or share with your team.</p>

    <p style="margin-top: 30px;">
        —<br>
        <strong>Support Team</strong><br>
        PreIntake.ai
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        AI-Powered Legal Intake<br>
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </p>
</body>
</html>`;

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: leadData.email,
            subject: 'Your PreIntake.ai Demo is Ready',
            html: htmlContent,
        });
        console.log(`Auto-confirmed demo email sent to ${leadData.email} for lead ${leadId}`);
    } catch (error) {
        console.error('Error sending auto-confirmed demo email:', error.message);
        throw error; // Re-throw so caller knows email failed
    }
}

/**
 * Send demo ready notification email to prospect
 */
async function sendProspectDemoReadyEmail(leadId, leadData, analysis, demoUrl) {
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
        console.error('SMTP credentials not configured for prospect demo email');
        return;
    }

    if (!leadData.email) {
        console.error('No email address for prospect');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
    });

    const firmName = analysis.firmName || 'your firm';
    const firstName = leadData.name ? leadData.name.split(' ')[0] : '';

    // Use branded URL instead of direct storage URL for better UX
    const brandedDemoUrl = `https://preintake.ai/?demo=${leadId}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <p>Hi${firstName ? ' ' + firstName : ''},</p>

    <p>Your AI intake demo for <strong>${firmName}</strong> is ready.</p>

    <p>We've analyzed your website and built a working intake form customized to your practice areas and qualification criteria. This demo shows how prospective clients would interact with your AI-powered intake system.</p>

    <p style="margin: 30px 0;">
        <a href="${brandedDemoUrl}"
           style="background: #0c1f3f; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
            View Your Demo
        </a>
    </p>

    <p><strong>What you'll see:</strong></p>
    <ul style="margin: 15px 0; padding-left: 20px;">
        <li>AI-driven conversation that screens leads in real-time</li>
        <li>Practice-area-specific questions tailored to your firm</li>
        <li>Clear qualification signals before leads reach your inbox</li>
    </ul>

    <p>The demo is private and accessible only via this link. Feel free to test it yourself or share it with your team.</p>

    <p>If you have questions or want to discuss implementation, just reply to this email.</p>

    <p style="margin-top: 30px;">
        Best,<br>
        <strong>Support Team</strong><br>
        PreIntake.ai
    </p>

    <hr style="margin-top: 40px; border: none; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 12px; color: #64748b;">
        Demo URL: <a href="${brandedDemoUrl}" style="color: #64748b;">${brandedDemoUrl}</a>
    </p>
</body>
</html>`;

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: leadData.email,
            subject: 'Your PreIntake.ai Demo Is Ready',
            html: htmlContent,
        });
        console.log(`Prospect demo ready email sent to ${leadData.email} for lead ${leadId}`);
    } catch (error) {
        console.error('Error sending prospect demo email:', error.message);
    }
}

/**
 * Map bar profile practice area to our system prompt practice areas
 * Bar profiles use various naming conventions that need normalization
 */
function mapBarPracticeArea(barPracticeArea) {
    const mapping = {
        // Personal Injury variations
        'personal injury': 'Personal Injury',
        'personal injury law': 'Personal Injury',
        'personal injury and product liability': 'Personal Injury',
        // Products/Product Liability
        'products liability': 'Personal Injury',
        'product liability': 'Personal Injury',
        // Medical Malpractice
        'medical malpractice': 'Personal Injury',
        'medical malpractice law': 'Personal Injury',
        // Wrongful Death
        'wrongful death': 'Personal Injury',
        // Criminal Defense variations
        'criminal law': 'Criminal Defense',
        'criminal defense': 'Criminal Defense',
        'criminal law (state)': 'Criminal Defense',
        'criminal law (federal)': 'Criminal Defense',
        // Family Law
        'family law': 'Family Law',
        'domestic relations': 'Family Law',
        // Bankruptcy
        'bankruptcy': 'Bankruptcy',
        'bankruptcy law': 'Bankruptcy',
        'bankruptcy - personal': 'Bankruptcy',
        // Immigration variations
        'immigration': 'Immigration',
        'immigration law': 'Immigration',
        'immigration and nationality': 'Immigration',
        'immigration & naturalization': 'Immigration',
        // Estate Planning
        'estate planning': 'Estate Planning',
        'wills & trusts': 'Estate Planning',
        'wills and trusts': 'Estate Planning',
        'probate': 'Estate Planning',
        'trusts and estates': 'Estate Planning',
        'estate planning and trusts': 'Estate Planning',
        // Employment Law variations
        'employment law': 'Employment Law',
        'labor law': 'Employment Law',
        'labor and employment': 'Employment Law',
        'labor & employment': 'Employment Law',
        'labor/employment': 'Employment Law',
        // Tax
        'tax law': 'Tax/IRS',
        'taxation': 'Tax/IRS',
        'tax': 'Tax/IRS',
        // Workers' Compensation variations
        'workers compensation': 'Workers\' Compensation',
        'workers\' compensation': 'Workers\' Compensation',
        'worker\'s compensation': 'Workers\' Compensation',
        'workers\' comp - employee': 'Workers\' Compensation',
        // Real Estate
        'real estate': 'Real Estate',
        'real property': 'Real Estate',
        'real estate law': 'Real Estate',
        // Construction Law
        'construction': 'Real Estate',
        'construction law': 'Real Estate',
        // Toxic Torts (map to Personal Injury as closest match)
        'toxic torts': 'Personal Injury',
        // Elder Law
        'elder law': 'Estate Planning',
        // Social Security
        'social security': 'Employment Law',
    };

    const normalized = (barPracticeArea || '').toLowerCase().trim();
    return mapping[normalized] || 'General Practice';
}

/**
 * Generate a demo using only bar profile data (no website analysis)
 * Used for attorneys without websites in email campaigns
 *
 * @param {string} leadId - The lead document ID (for storage path)
 * @param {object} contactData - Data from preintake_emails collection:
 *   - firstName: Attorney first name
 *   - lastName: Attorney last name
 *   - practiceArea: Primary practice area from bar profile
 *   - email: Attorney email
 *   - state: State abbreviation (CA, FL, etc.)
 *   - firmName: (optional) Firm name if available
 *   - barNumber: Attorney bar number
 * @returns {object} { htmlContent, configContent } from generateDemoFiles
 */
function generateBarProfileDemo(leadId, contactData, practiceAreasOverride = null) {
    // Build firm name from contact data
    const firmName = contactData.firmName ||
        `${contactData.firstName} ${contactData.lastName}, Attorney at Law`;

    // If practiceAreasOverride array provided, use it; otherwise use single practiceArea
    const areasToUse = practiceAreasOverride || [contactData.practiceArea || 'General Practice'];

    // Build practice areas list with equal percentages
    const practiceAreas = areasToUse.map((area) => ({
        name: mapBarPracticeArea(area),
        percentage: Math.floor(100 / areasToUse.length)
    }));

    // Get primary practice area (first in list)
    const mappedPracticeArea = practiceAreas[0].name;

    // Construct minimal leadData object (matches what generateDemoFiles expects)
    const leadData = {
        name: firmName,
        email: contactData.email,
        website: '', // No website for bar profile contacts
        source: practiceAreasOverride ? 'hosted_landing_page' : 'bar_profile',
        // CRITICAL: Set hosted flags so generateDemoFiles shows correct sidebar CTA text
        hosted: true,
        hasWebsite: false,
        confirmedPracticeAreas: {
            areas: practiceAreas.map(pa => pa.name),
            primaryArea: mappedPracticeArea,
            autoConfirmed: true
        }
    };

    // Construct minimal analysis object (simulates website analysis results)
    const analysis = {
        firmName: firmName,
        primaryPracticeArea: mappedPracticeArea,
        practiceAreas: practiceAreas,
        location: {
            state: contactData.state || 'CA'
        },
        branding: {
            logoUrl: null // Text-only logo (no website to scrape)
        },
        contactMethods: {
            phone: '', // Not available from bar profile
            email: contactData.email
        }
    };

    // Construct minimal deepResearch object (no website to scrape)
    const deepResearch = {
        attorneys: [{
            name: `${contactData.firstName} ${contactData.lastName}`,
            title: 'Attorney at Law'
        }],
        caseResults: [],
        firmDescription: '',
        yearsInBusiness: null,
        officeLocations: []
    };

    // Use existing generateDemoFiles function
    return generateDemoFiles(leadId, leadData, analysis, deepResearch);
}

module.exports = {
    generatePreIntakeDemo,
    // Exported for widget-functions.js (server-side chat)
    generateSystemPrompt,
    generateTools,
    buildPracticeAreasList,
    // Exported for demo regeneration script
    getLandingHeadline,
    getLandingSubheadline,
    generateProgressSteps,
    generateLoadingStagesHtml,
    generateLoadingStagesJson,
    generateDeclineResources,
    generateDetectButtonsFunction,
    // Exported for scripts/send-preintake-campaign.js (inline demo generation)
    generateDemoFiles,
    uploadToStorage,
    initFirebaseAdmin,
    // Exported for bar profile demo generation (attorneys without websites)
    generateBarProfileDemo,
    mapBarPracticeArea,
    // Exported for intake code generation (used by campaign script)
    generateUniqueIntakeCode,
};
