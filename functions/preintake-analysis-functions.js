/**
 * PreIntake.ai Website Analysis Functions
 * Automatically analyzes law firm websites when demo requests are submitted
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');
const fetch = require('node-fetch');
const { performDeepResearch } = require('./deep-research-functions');

// Secrets
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const smtpUser = defineSecret('PREINTAKE_SMTP_USER');
const smtpPass = defineSecret('PREINTAKE_SMTP_PASS');

// Constants
const NOTIFY_EMAIL = 'stephen@preintake.ai';
const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const FETCH_TIMEOUT = 30000; // 30 seconds
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Firestore trigger: Analyze website when new lead is created
 * Uses dedicated 'preintake' database (separate from default TBP database)
 */
const analyzePreIntakeLead = onDocumentCreated(
    {
        document: 'preintake_leads/{leadId}',
        database: 'preintake',
        region: 'us-west1',
        secrets: [anthropicApiKey, smtpUser, smtpPass],
        timeoutSeconds: 300, // 5 minutes for initial analysis + deep research
        memory: '512MiB',
    },
    async (event) => {
        const snap = event.data;
        if (!snap) {
            console.log('No data in event');
            return;
        }

        const leadId = event.params.leadId;
        const leadData = snap.data();

        // Skip analysis for campaign-sourced leads (already processed with demo)
        if (leadData.source === 'campaign' || leadData.source === 'bar_profile_campaign') {
            console.log(`Lead ${leadId} is from email campaign (${leadData.source}) - already processed, skipping analysis`);
            return;
        }

        // Skip analysis for hosted leads (no website to analyze)
        if (leadData.hasWebsite === false || leadData.hosted === true) {
            console.log(`Lead ${leadId} is a hosted solution lead - no website analysis needed, skipping`);
            return;
        }

        // Skip analysis if email verification is pending (will be triggered after verification)
        if (leadData.status === 'pending_verification' || leadData.emailVerified !== true) {
            console.log(`Lead ${leadId} is pending email verification - skipping analysis for now`);
            return;
        }

        // Proceed with analysis
        await performAnalysis(leadId, leadData);
    }
);

/**
 * Firestore trigger: Start analysis when email verification is completed
 * This trigger fires when emailVerified changes from false/undefined to true
 */
const analyzeAfterEmailVerification = onDocumentUpdated(
    {
        document: 'preintake_leads/{leadId}',
        database: 'preintake',
        region: 'us-west1',
        secrets: [anthropicApiKey, smtpUser, smtpPass],
        timeoutSeconds: 300,
        memory: '512MiB',
    },
    async (event) => {
        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const leadId = event.params.leadId;

        // Only trigger analysis when emailVerified changes to true
        if (beforeData.emailVerified !== true && afterData.emailVerified === true) {
            console.log(`Email verified for lead ${leadId} - starting analysis`);
            await performAnalysis(leadId, afterData);
        }
    }
);

/**
 * Core analysis function - shared by both create and update triggers
 */
async function performAnalysis(leadId, leadData) {
    const { name, email, website } = leadData;

    console.log(`Starting analysis for lead ${leadId}: ${website}`);

    // Use the dedicated 'preintake' database
    const db = getFirestore('preintake');
    const leadRef = db.collection('preintake_leads').doc(leadId);

    // Update status to analyzing
    await leadRef.update({
        status: 'analyzing',
        'analysis.status': 'processing',
        'analysis.startedAt': FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    try {
        // Fetch and analyze website (initial analysis)
        const analysisResult = await analyzeWebsite(website);

        // Update Firestore with initial analysis results
        await leadRef.update({
            status: 'researching',
            analysis: {
                status: 'completed',
                startedAt: leadData.analysis?.startedAt || FieldValue.serverTimestamp(),
                completedAt: FieldValue.serverTimestamp(),
                ...analysisResult,
            },
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`Initial analysis completed for lead ${leadId}, starting deep research...`);

        // Perform deep research (multi-page scraping)
        try {
            const deepResearchResult = await performDeepResearch(website, analysisResult);

            // Determine next status based on autoConfirmed flag
            // If autoConfirmed=true (landing page form), skip confirmation and go straight to demo generation
            // If autoConfirmed=false (manual/campaign flow), wait for user confirmation
            const isAutoConfirmed = leadData.autoConfirmed === true;
            const nextStatus = isAutoConfirmed ? 'generating_demo' : 'awaiting_confirmation';

            // Build update payload
            const updatePayload = {
                status: nextStatus,
                deepResearch: {
                    status: deepResearchResult.status || 'completed',
                    completedAt: FieldValue.serverTimestamp(),
                    pagesAnalyzed: deepResearchResult.pagesAnalyzed || 0,
                    attorneys: deepResearchResult.attorneys || [],
                    caseResults: deepResearchResult.caseResults || [],
                    testimonials: deepResearchResult.testimonials || [],
                    practiceAreaDetails: deepResearchResult.practiceAreaDetails || {},
                    firmDescription: deepResearchResult.firmDescription || null,
                    yearsInBusiness: deepResearchResult.yearsInBusiness || null,
                    officeLocations: deepResearchResult.officeLocations || [],
                    discoveredUrls: deepResearchResult.discoveredUrls || {},
                },
                updatedAt: FieldValue.serverTimestamp(),
            };

            // If auto-confirmed, set confirmedPracticeAreas from analysis results
            if (isAutoConfirmed) {
                const practiceAreas = analysisResult.practiceAreas || [];
                const primaryArea = analysisResult.primaryPracticeArea || practiceAreas[0] || 'General Practice';
                updatePayload.confirmedPracticeAreas = {
                    areas: practiceAreas,
                    primaryArea: primaryArea,
                    confirmedAt: FieldValue.serverTimestamp(),
                    autoConfirmed: true, // Flag to indicate this was auto-confirmed
                };
                console.log(`Auto-confirming practice areas for lead ${leadId}: ${practiceAreas.join(', ')} (primary: ${primaryArea})`);
            }

            await leadRef.update(updatePayload);

            if (isAutoConfirmed) {
                console.log(`Deep research completed for lead ${leadId}: ${deepResearchResult.pagesAnalyzed} pages analyzed. Auto-confirmed, starting demo generation.`);
            } else {
                console.log(`Deep research completed for lead ${leadId}: ${deepResearchResult.pagesAnalyzed} pages analyzed. Awaiting practice area confirmation.`);
            }

        } catch (deepResearchError) {
            console.error(`Deep research failed for lead ${leadId}:`, deepResearchError.message);

            // Determine next status based on autoConfirmed flag (same logic even on failure)
            const isAutoConfirmed = leadData.autoConfirmed === true;
            const nextStatus = isAutoConfirmed ? 'generating_demo' : 'awaiting_confirmation';

            const updatePayload = {
                status: nextStatus,
                deepResearch: {
                    status: 'failed',
                    error: deepResearchError.message,
                    completedAt: FieldValue.serverTimestamp(),
                },
                updatedAt: FieldValue.serverTimestamp(),
            };

            // If auto-confirmed, use initial analysis results for practice areas
            if (isAutoConfirmed) {
                const practiceAreas = analysisResult.practiceAreas || [];
                const primaryArea = analysisResult.primaryPracticeArea || practiceAreas[0] || 'General Practice';
                updatePayload.confirmedPracticeAreas = {
                    areas: practiceAreas,
                    primaryArea: primaryArea,
                    confirmedAt: FieldValue.serverTimestamp(),
                    autoConfirmed: true,
                };
                console.log(`Auto-confirming practice areas (deep research failed) for lead ${leadId}: ${practiceAreas.join(', ')} (primary: ${primaryArea})`);
            }

            await leadRef.update(updatePayload);
        }

        // Send analysis notification email (includes deep research data if available)
        await sendAnalysisEmail(leadId, name, email, website, analysisResult);

    } catch (error) {
        console.error(`Analysis failed for lead ${leadId}:`, error.message);

        // Update status to failed
        await leadRef.update({
            status: 'analysis_failed',
            'analysis.status': 'failed',
            'analysis.error': error.message,
            'analysis.completedAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
}

/**
 * Fetch and analyze a website
 */
async function analyzeWebsite(websiteUrl) {
    let html;
    let finalUrl = websiteUrl;

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Website fetch timed out')), FETCH_TIMEOUT);
    });

    // Create the fetch promise
    const fetchPromise = fetch(websiteUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; PreIntakeBot/1.0; +https://preintake.ai)',
            'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        timeout: FETCH_TIMEOUT,
    });

    // Race between fetch and timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    finalUrl = response.url;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_HTML_SIZE) {
        throw new Error('Website content too large');
    }

    html = await response.text();
    if (html.length > MAX_HTML_SIZE) {
        html = html.substring(0, MAX_HTML_SIZE);
    }

    // Parse HTML and extract data
    const extractedData = extractWebsiteData(html, finalUrl);

    // Send to Claude for analysis
    const aiAnalysis = await analyzeWithClaude(extractedData);

    return {
        ...extractedData,
        ...aiAnalysis,
        rawHtmlSize: html.length,
        pagesAnalyzed: 1,
        model: 'claude-3-haiku-20240307',
    };
}

/**
 * Extract structured data from HTML
 */
function extractWebsiteData(html, url) {
    const $ = cheerio.load(html);

    // Remove scripts, styles, and hidden elements
    $('script, style, noscript, iframe, svg').remove();

    // Extract basic info
    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content') || '';

    // Extract headings
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 200) {
            headings.push(text);
        }
    });

    // Extract navigation links
    const navLinks = [];
    $('nav a, header a, .menu a, .nav a').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length < 50 && !navLinks.includes(text)) {
            navLinks.push(text);
        }
    });

    // Extract phone numbers
    const phoneRegex = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const bodyText = $('body').text();
    const phones = [...new Set(bodyText.match(phoneRegex) || [])];

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(bodyText.match(emailRegex) || [])];

    // Check for contact/intake forms
    const hasContactForm = $('form').length > 0;
    const hasChatWidget = $('[class*="chat"], [id*="chat"], [class*="livechat"]').length > 0 ||
                          html.includes('intercom') ||
                          html.includes('drift') ||
                          html.includes('tawk') ||
                          html.includes('zendesk');

    // Check for scheduling tools
    const hasScheduler = html.includes('calendly') ||
                         html.includes('acuity') ||
                         html.includes('schedule') ||
                         $('a[href*="calendly"], a[href*="acuity"]').length > 0;

    // Extract colors from inline styles and CSS
    const colors = extractColors(html);

    // Extract logo URL
    const logoUrl = extractLogo($, url);

    // Get main content text (limited)
    const mainContent = $('main, article, .content, #content, .main')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 3000);

    // Practice area keywords detection
    const practiceAreaKeywords = detectPracticeAreas(bodyText, navLinks, headings);

    return {
        extractedTitle: title,
        extractedDescription: metaDescription,
        headings: headings.slice(0, 20),
        navLinks: navLinks.slice(0, 30),
        contactMethods: {
            phone: phones[0] || null,
            email: emails.find(e => !e.includes('example')) || null,
            hasContactForm,
            hasChatWidget,
            hasScheduler,
        },
        branding: {
            primaryColor: colors.primary || null,
            secondaryColor: colors.secondary || null,
            logoUrl,
        },
        detectedKeywords: practiceAreaKeywords,
        contentSample: mainContent,
    };
}

/**
 * Extract brand colors from HTML/CSS
 */
function extractColors(html) {
    const colorRegex = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;
    const colors = html.match(colorRegex) || [];

    // Count occurrences
    const colorCounts = {};
    colors.forEach(color => {
        const normalized = color.toLowerCase();
        colorCounts[normalized] = (colorCounts[normalized] || 0) + 1;
    });

    // Sort by frequency, excluding common colors (white, black, gray)
    const sortedColors = Object.entries(colorCounts)
        .filter(([color]) => !isCommonColor(color))
        .sort((a, b) => b[1] - a[1])
        .map(([color]) => color);

    return {
        primary: sortedColors[0] || null,
        secondary: sortedColors[1] || null,
    };
}

/**
 * Check if a color is too common/neutral
 */
function isCommonColor(color) {
    const common = ['#fff', '#ffffff', '#000', '#000000', '#333', '#333333',
                    '#666', '#666666', '#999', '#999999', '#ccc', '#cccccc',
                    '#eee', '#eeeeee', '#f5f5f5', '#fafafa'];
    return common.includes(color.toLowerCase());
}

/**
 * Extract logo URL from page
 */
function extractLogo($, baseUrl) {
    // Try common logo selectors
    const logoSelectors = [
        'img.logo', '.logo img', '#logo img', '[class*="logo"] img',
        'header img:first', '.header img:first', 'a[href="/"] img:first'
    ];

    for (const selector of logoSelectors) {
        const img = $(selector).first();
        if (img.length) {
            const src = img.attr('src');
            if (src) {
                try {
                    return new URL(src, baseUrl).href;
                } catch {
                    return src;
                }
            }
        }
    }

    return null;
}

/**
 * Detect practice areas from content
 */
function detectPracticeAreas(text, navLinks, headings) {
    const allText = `${text} ${navLinks.join(' ')} ${headings.join(' ')}`.toLowerCase();

    const practiceAreas = {
        'Personal Injury': ['personal injury', 'car accident', 'auto accident', 'truck accident',
                           'motorcycle accident', 'slip and fall', 'wrongful death', 'medical malpractice',
                           'product liability', 'premises liability', 'dog bite', 'catastrophic injury'],
        'Immigration': ['immigration', 'visa', 'green card', 'citizenship', 'deportation', 'asylum',
                       'h-1b', 'family immigration', 'work permit', 'naturalization', 'uscis'],
        'Family Law': ['family law', 'divorce', 'child custody', 'child support', 'alimony',
                      'prenuptial', 'adoption', 'guardianship', 'domestic violence', 'paternity'],
        'Criminal Defense': ['criminal defense', 'dui', 'dwi', 'drug charges', 'assault',
                            'theft', 'felony', 'misdemeanor', 'expungement', 'criminal lawyer'],
        'Bankruptcy': ['bankruptcy', 'chapter 7', 'chapter 13', 'debt relief', 'foreclosure',
                      'creditor', 'debt collection', 'wage garnishment'],
        'Estate Planning': ['estate planning', 'wills', 'trusts', 'probate', 'power of attorney',
                          'living will', 'estate administration', 'inheritance'],
        'Business Law': ['business law', 'corporate', 'llc', 'contracts', 'business formation',
                        'mergers', 'acquisitions', 'commercial litigation'],
        'Employment Law': ['employment law', 'wrongful termination', 'discrimination', 'harassment',
                         'wage and hour', 'workers compensation', 'employee rights'],
        'Real Estate': ['real estate', 'property', 'closing', 'title', 'landlord tenant',
                       'commercial real estate', 'zoning'],
        'Social Security': ['social security', 'disability', 'ssdi', 'ssi', 'disability benefits'],
    };

    const detected = [];
    for (const [area, keywords] of Object.entries(practiceAreas)) {
        for (const keyword of keywords) {
            if (allText.includes(keyword)) {
                if (!detected.includes(area)) {
                    detected.push(area);
                }
                break;
            }
        }
    }

    return detected;
}

/**
 * Analyze extracted data with Claude AI
 */
async function analyzeWithClaude(extractedData) {
    // Support both Cloud Functions (defineSecret) and scripts (env var)
    const apiKey = process.env.ANTHROPIC_API_KEY || anthropicApiKey.value();
    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    const prompt = `You are analyzing a law firm website to help create a personalized AI intake system.

CRITICAL: Identify ALL practice areas this law firm handles by examining the navigation links and headings carefully. Law firms typically list their practice areas in the main navigation menu (e.g., "Personal Injury", "Employment Law", "Tenant Rights", "Criminal Defense", etc.). Do NOT just rely on the auto-detected keywords - they may miss practice areas or include false positives.

EXTRACTED WEBSITE DATA:
- Title: ${extractedData.extractedTitle}
- Meta Description: ${extractedData.extractedDescription}
- Navigation Menu Links: ${extractedData.navLinks.join(', ')}
- Page Headings: ${extractedData.headings.slice(0, 15).join(', ')}
- Auto-detected Keywords (may be incomplete/inaccurate): ${extractedData.detectedKeywords.join(', ')}
- Content Sample: ${extractedData.contentSample.substring(0, 2000)}

INSTRUCTIONS:
1. Look at the Navigation Menu Links carefully - these typically contain the firm's practice areas
2. Identify ALL distinct practice areas (usually 3-8 for most firms)
3. Use standard practice area names (e.g., "Personal Injury" not "Car Accidents", "Employment Law" not just "Discrimination")
4. Do NOT include "Social Security" unless it's clearly a disability/SSI practice

Respond with ONLY valid JSON (no markdown, no explanation). Replace ALL placeholder values with actual extracted data:
{
    "firmName": "EXTRACT the law firm's actual name from the page",
    "practiceAreas": ["Practice Area 1", "Practice Area 2", "Practice Area 3"],
    "primaryPracticeArea": "Their main/primary practice area",
    "location": {
        "city": "City if detectable",
        "state": "State abbreviation if detectable",
        "serviceArea": "Description of service area"
    },
    "intakeRecommendations": [
        "Screening question 1 for their primary practice",
        "Screening question 2",
        "Screening question 3"
    ],
    "qualificationCriteria": [
        "What makes a qualified inquiry for this firm"
    ],
    "competitiveNotes": "Brief positioning notes"
}`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        });

        const responseText = message.content[0].text.trim();

        // Parse JSON response
        const analysis = JSON.parse(responseText);

        // Validate firm name - check if AI returned a placeholder
        let firmName = analysis.firmName;
        const placeholders = ['the firm', 'law firm', 'official name', 'extract', 'actual name'];
        const isPlaceholder = !firmName || placeholders.some(p => firmName.toLowerCase().includes(p));

        if (isPlaceholder) {
            // Try to extract from headings (look for "Law", "LLC", "LLP", "Firm", attorney names)
            const firmPatterns = [/LLC/i, /LLP/i, /Law\s*(Firm|Office|Group|Center)/i, /\bPC\b/i, /\bPLLC\b/i];
            const headingMatch = extractedData.headings.find(h =>
                firmPatterns.some(p => p.test(h)) || h.includes('&') && h.split(' ').length <= 5
            );
            if (headingMatch) {
                firmName = headingMatch;
            } else {
                // Fall back to title extraction
                firmName = extractedData.extractedTitle?.split('|')[0]?.split('-')[0]?.trim() || null;
            }
        }

        return {
            firmName: firmName || null,
            practiceAreas: analysis.practiceAreas || extractedData.detectedKeywords,
            primaryPracticeArea: analysis.primaryPracticeArea || extractedData.detectedKeywords[0] || 'General Practice',
            location: analysis.location || { city: null, state: null, serviceArea: null },
            intakeRecommendations: analysis.intakeRecommendations || [],
            qualificationCriteria: analysis.qualificationCriteria || [],
            competitiveNotes: analysis.competitiveNotes || null,
        };
    } catch (error) {
        console.error('Claude analysis error:', error.message);

        // Return basic analysis on failure
        return {
            firmName: extractedData.extractedTitle?.split('|')[0]?.trim() || null,
            practiceAreas: extractedData.detectedKeywords,
            primaryPracticeArea: extractedData.detectedKeywords[0] || 'General Practice',
            location: { city: null, state: null, serviceArea: null },
            intakeRecommendations: [],
            qualificationCriteria: [],
            competitiveNotes: null,
            aiError: error.message,
        };
    }
}

/**
 * Send analysis results email
 */
async function sendAnalysisEmail(leadId, name, email, website, analysis) {
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
        console.error('SMTP credentials not configured for analysis email');
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

    const practiceAreasList = analysis.practiceAreas?.length
        ? analysis.practiceAreas.map(a => `<li>${a}</li>`).join('')
        : '<li>Not detected</li>';

    const recommendationsList = analysis.intakeRecommendations?.length
        ? analysis.intakeRecommendations.map(r => `<li>${r}</li>`).join('')
        : '<li>None generated</li>';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0c1f3f;">Website Analysis Complete</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Inquiry:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${name} (<a href="mailto:${email}">${email}</a>)</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Website:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${website}" target="_blank">${website}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Firm Name:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${analysis.firmName || 'Not detected'}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Primary Area:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${analysis.primaryPracticeArea || 'Not detected'}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Location:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${analysis.location?.city || ''} ${analysis.location?.state || ''} ${analysis.location?.serviceArea ? `(${analysis.location.serviceArea})` : ''}</td>
        </tr>
    </table>

    <h3 style="color: #0c1f3f; margin-top: 30px;">Practice Areas Detected</h3>
    <ul style="color: #64748b;">${practiceAreasList}</ul>

    <h3 style="color: #0c1f3f; margin-top: 30px;">Recommended Intake Questions</h3>
    <ol style="color: #64748b;">${recommendationsList}</ol>

    ${analysis.competitiveNotes ? `
    <h3 style="color: #0c1f3f; margin-top: 30px;">Competitive Notes</h3>
    <p style="color: #64748b; background: #f8fafc; padding: 15px; border-radius: 8px;">${analysis.competitiveNotes}</p>
    ` : ''}

    <h3 style="color: #0c1f3f; margin-top: 30px;">Contact Methods Found</h3>
    <ul style="color: #64748b;">
        <li>Phone: ${analysis.contactMethods?.phone || 'Not found'}</li>
        <li>Email: ${analysis.contactMethods?.email || 'Not found'}</li>
        <li>Contact Form: ${analysis.contactMethods?.hasContactForm ? 'Yes' : 'No'}</li>
        <li>Chat Widget: ${analysis.contactMethods?.hasChatWidget ? 'Yes' : 'No'}</li>
        <li>Scheduler: ${analysis.contactMethods?.hasScheduler ? 'Yes' : 'No'}</li>
    </ul>

    ${analysis.branding?.logoUrl ? `
    <h3 style="color: #0c1f3f; margin-top: 30px;">Logo Found</h3>
    <img src="${analysis.branding.logoUrl}" alt="Firm Logo" style="max-width: 200px; max-height: 100px;">
    ` : ''}

    <p style="margin-top: 30px;">
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/data/~2Fpreintake_leads~2F${leadId}"
           style="background: #c9a962; color: #0c1f3f; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Full Details in Firestore
        </a>
    </p>
</body>
</html>`;

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: NOTIFY_EMAIL,
            subject: `Analysis Complete: ${analysis.firmName || name} - ${analysis.primaryPracticeArea || 'Law Firm'}`,
            html: htmlContent,
        });
        console.log(`Analysis email sent for lead ${leadId}`);
    } catch (error) {
        console.error('Error sending analysis email:', error.message);
    }
}

module.exports = {
    analyzePreIntakeLead,
    analyzeAfterEmailVerification,
    // Exported for scripts/send-preintake-campaign.js (inline demo generation)
    analyzeWebsite,
};
