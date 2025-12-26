/**
 * PreIntake.ai Demo Generator Functions
 * Generates enterprise-grade, standalone HTML intake demo pages for law firms
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
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
const STORAGE_BUCKET = 'teambuilder-plus-fe74d.appspot.com';

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
            const analysis = afterData.analysis || {};
            const deepResearch = analysis.deepResearch || {};

            // Generate the demo HTML
            const { htmlContent, configContent } = generateDemoFiles(leadId, afterData, analysis, deepResearch);

            // Upload to Firebase Storage
            const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);

            // Update Firestore with demo URL
            await leadRef.update({
                status: 'demo_ready',
                demoUrl: demoUrl,
                'demo.generatedAt': FieldValue.serverTimestamp(),
                'demo.version': '1.0.0',
                updatedAt: FieldValue.serverTimestamp(),
            });

            console.log(`Demo generated for lead ${leadId}: ${demoUrl}`);

            // Send notification email
            await sendDemoReadyEmail(leadId, afterData, analysis, demoUrl);

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
 */
function generateDemoFiles(leadId, leadData, analysis, deepResearch) {
    // Read template
    const templatePath = path.join(__dirname, 'templates', 'demo-intake.html');
    let htmlTemplate = fs.readFileSync(templatePath, 'utf8');

    // Extract values
    const firmName = analysis.firmName || 'Law Firm';

    // Prefer self-reported practice area from form, fallback to website analysis
    const practiceArea = leadData.practiceAreas?.primaryAreaName ||
                        analysis.primaryPracticeArea ||
                        'General Practice';

    // Store full practice breakdown for potential multi-area support
    const practiceBreakdown = leadData.practiceAreas?.breakdown || null;
    const otherPracticeAreaName = leadData.practiceAreas?.otherName || null;

    const state = analysis.location?.state || 'CA';
    const phone = analysis.contactMethods?.phone || '';
    const website = leadData.website || '';
    const logoUrl = analysis.branding?.logoUrl || null;

    // Generate colors with fallbacks
    const primaryDark = analysis.branding?.primaryColor || '#0c1f3f';
    const primaryBlue = lightenColor(primaryDark, 20) || '#1a3a5c';
    const accentColor = analysis.branding?.secondaryColor || '#c9a962';
    const accentColorLight = lightenColor(accentColor, 30) || '#e5d4a1';

    // Generate practice-area-specific content
    const systemPrompt = generateSystemPrompt(firmName, practiceArea, state, analysis, deepResearch, practiceBreakdown, otherPracticeAreaName);
    const tools = generateTools(practiceArea);
    const detectButtonsFunction = generateDetectButtonsFunction(practiceArea);
    const progressStepsHtml = generateProgressSteps(practiceArea);
    const loadingStagesHtml = generateLoadingStagesHtml(practiceArea);
    const loadingStagesJson = generateLoadingStagesJson(practiceArea);
    const declineResourcesHtml = generateDeclineResources(state);

    // Generate logo HTML
    const logoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${firmName}" class="logo-image" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="logo-text" style="display:none">${firmName}</div>`
        : `<div class="logo-text">${firmName}</div>`;

    // Generate avatar icon
    const avatarIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>';

    // Replace all tokens
    const replacements = {
        '{{PAGE_TITLE}}': `Free Case Evaluation - ${firmName}`,
        '{{FIRM_NAME}}': firmName,
        '{{PRIMARY_DARK}}': primaryDark,
        '{{PRIMARY_BLUE}}': primaryBlue,
        '{{ACCENT_COLOR}}': accentColor,
        '{{ACCENT_COLOR_LIGHT}}': accentColorLight,
        '{{LOGO_HTML}}': logoHtml,
        '{{LANDING_HEADLINE}}': getLandingHeadline(practiceArea),
        '{{LANDING_SUBHEADLINE}}': getLandingSubheadline(practiceArea, firmName),
        '{{PROGRESS_STEPS_HTML}}': progressStepsHtml,
        '{{LOADING_STAGES_HTML}}': loadingStagesHtml,
        '{{LOADING_STAGES_JSON}}': loadingStagesJson,
        '{{DECLINE_RESOURCES_HTML}}': declineResourcesHtml,
        '{{PROXY_URL}}': PROXY_URL,
        '{{MODEL}}': CLAUDE_MODEL,
        '{{WEBHOOK_URL}}': 'null',
        '{{WEBHOOK_KEY}}': 'null',
        '{{SCHEDULE_URL}}': 'null',
        '{{STATE}}': state,
        '{{TOTAL_STEPS}}': getTotalSteps(practiceArea).toString(),
        '{{SYSTEM_PROMPT}}': systemPrompt.replace(/`/g, '\\`').replace(/\$/g, '\\$'),
        '{{TOOLS_JSON}}': JSON.stringify(tools, null, 2),
        '{{DETECT_BUTTONS_FUNCTION}}': detectButtonsFunction,
        '{{INITIAL_MESSAGE}}': getInitialMessage(practiceArea, state),
        '{{AVATAR_ICON}}': avatarIcon,
        '{{LEAD_ID}}': leadId,
    };

    for (const [token, value] of Object.entries(replacements)) {
        htmlTemplate = htmlTemplate.split(token).join(value);
    }

    // Config content (for reference, not uploaded separately)
    const configContent = {
        firmName,
        practiceArea,
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
            cacheControl: 'public, max-age=3600',
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
 * Generate practice-area-specific system prompt
 */
// Practice area display names mapping
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

function generateSystemPrompt(firmName, practiceArea, state, analysis, deepResearch, practiceBreakdown, otherPracticeAreaName) {
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
    if (practiceBreakdown && Object.keys(practiceBreakdown).length > 1) {
        const areas = Object.entries(practiceBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([key, pct]) => {
                // Use custom name for "other" if provided
                let name;
                if (key === 'other' && otherPracticeAreaName) {
                    name = otherPracticeAreaName;
                } else {
                    name = PRACTICE_AREA_DISPLAY_NAMES[key] || key;
                }
                return `${name} (${pct}%)`;
            });
        multiPracticeContext = `\n\nPRACTICE AREAS HANDLED:\nThis firm handles multiple practice areas: ${areas.join(', ')}. The primary focus is ${practiceArea}.`;
    }

    // Get practice-area-specific prompt sections
    const practicePrompt = getPracticeAreaPrompt(practiceArea, state, analysis);

    return `You are an intake specialist for ${firmName}, a ${practiceArea} law firm in ${state}.${firmContext}${multiPracticeContext}

CRITICAL RULES:
1. Ask ONLY ONE question per response. Never ask multiple questions.
2. Do NOT use markdown formatting. Write in plain text only.
3. Wait for the user to answer before moving to the next question.
4. BUTTON RESPONSES: Users select from on-screen buttons. Accept their selection and move on.
5. DO NOT LIST OPTIONS IN YOUR TEXT. The interface generates buttons automatically.
6. NATURAL CONVERSATION: Reference specific details from the user's previous answers naturally.

${practicePrompt}

## Response Style
- Keep responses brief (1-2 sentences max before your ONE question)
- Be empathetic but professional
- After user answers, provide brief acknowledgment, then ask the NEXT question
- NEVER ask multiple questions

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

## Disqualification Rules (call complete_intake with routing="red")
- Incident more than 2 years ago (SOL expired)
- No physical injury AND no medical treatment
- Incident outside ${state}
- User admits 100% fault
- User is currently represented by another attorney`;
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

## Disqualification (call complete_intake with routing="red")
- Currently in active removal proceedings with counsel
- Looking for asylum but already missed deadline`;
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

## Disqualification (call complete_intake with routing="red")
- Matter is outside ${state}
- Already has an attorney on this matter
- Looking for criminal defense, not family law`;
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

## Qualification Signals (green routing)
- Owes significant back taxes ($10k+)
- Received IRS audit notice
- Facing wage garnishment or bank levy
- Needs offer in compromise

## Disqualification (call complete_intake with routing="red")
- Just needs simple tax return prepared
- Issue is only with another tax preparer, not IRS`;
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

## Qualification Signals (green routing)
- Significant unsecured debt
- Facing foreclosure or garnishment
- Debt is primarily dischargeable

## Disqualification (call complete_intake with routing="red")
- Filed bankruptcy in last 8 years (Chapter 7) or 2 years (Chapter 13)
- Primarily student loan debt (may still help but lower priority)`;
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

## Urgency Signals (prioritize)
- In custody
- Court date within 2 weeks
- Facing serious felony charges

## Disqualification (call complete_intake with routing="red")
- Case is outside ${state}
- Already has private attorney
- Looking for appeals (may need specialist)`;
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

## Qualification Signals (green routing)
- Has significant assets to protect
- Complex family situations
- Business succession planning needed

## Lower Priority (yellow routing)
- Simple will with no complex assets
- Just updating existing documents`;
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

${qualCriteria ? `## Qualification Criteria\nGood candidates will have:\n- ${qualCriteria}` : ''}

## Disqualification (call complete_intake with routing="red")
- Outside your service area
- Currently represented by another attorney
- Matter is outside your practice area`;
}

/**
 * Generate tools array for the practice area
 */
function generateTools(practiceArea) {
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
                required: ["routing", "urgency", "recommended_next_action", "key_factors"]
            }
        }
    ];
}

/**
 * Generate detectQuestionButtons function
 */
function generateDetectButtonsFunction(practiceArea) {
    // Generic button detection that works across practice areas
    return `function detectQuestionButtons(text) {
    const questionMatch = text.match(/[^.!?]*\\?[^.!?]*/g);
    if (!questionMatch || questionMatch.length === 0) return null;

    const questionText = questionMatch[questionMatch.length - 1];
    const lowerText = questionText.toLowerCase();

    // Yes/No questions (common across all areas)
    if ((lowerText.includes('do you') || lowerText.includes('are you') || lowerText.includes('have you') ||
         lowerText.includes('is there') || lowerText.includes('was there') || lowerText.includes('did you')) &&
        !lowerText.includes('when') && !lowerText.includes('what') && !lowerText.includes('which') &&
        !lowerText.includes('how') && !lowerText.includes('where') && !lowerText.includes('describe')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

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
    if (lowerText.includes('attorney') || lowerText.includes('lawyer') || lowerText.includes('represent')) {
        return [
            { label: "No, not represented", value: "No, not represented" },
            { label: "Yes, currently represented", value: "Yes, currently represented" },
            { label: "Previously, but not now", value: "Previously, but not now" }
        ];
    }

    // Location/State
    if (lowerText.includes('located') || lowerText.includes('reside') || lowerText.includes('state') ||
        lowerText.includes('county') || lowerText.includes('jurisdiction')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" }
        ];
    }

    // Not sure option for many questions
    if (lowerText.includes('know if') || lowerText.includes('aware')) {
        return [
            { label: "Yes", value: "Yes" },
            { label: "No", value: "No" },
            { label: "Not sure", value: "Not sure" }
        ];
    }

    // No buttons for free-text questions
    return null;
}`;
}

/**
 * Generate progress steps HTML
 */
function generateProgressSteps(practiceArea) {
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
function getLandingHeadline(practiceArea) {
    const area = practiceArea.toLowerCase();
    if (area.includes('personal injury')) return 'Free Case Evaluation';
    if (area.includes('immigration')) return 'Free Immigration Consultation';
    if (area.includes('family')) return 'Free Family Law Consultation';
    if (area.includes('tax')) return 'Free Tax Resolution Consultation';
    if (area.includes('bankruptcy')) return 'Free Bankruptcy Evaluation';
    if (area.includes('criminal')) return 'Free Criminal Defense Consultation';
    if (area.includes('estate')) return 'Free Estate Planning Consultation';
    return 'Free Legal Consultation';
}

/**
 * Get landing subheadline
 */
function getLandingSubheadline(practiceArea, firmName) {
    return `Find out if ${firmName} can help with your ${practiceArea.toLowerCase()} matter in under 5 minutes. Our AI-powered intake helps us understand your situation quickly and confidentially.`;
}

/**
 * Get initial message for starting conversation
 */
function getInitialMessage(practiceArea, state) {
    return `I'd like to get a free case evaluation for a ${practiceArea.toLowerCase()} matter in ${state}.`;
}

/**
 * Lighten a hex color
 */
function lightenColor(color, percent) {
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

module.exports = {
    generatePreIntakeDemo,
};
