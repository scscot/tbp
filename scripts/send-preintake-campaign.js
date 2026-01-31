#!/usr/bin/env node
/**
 * PreIntake.ai Email Campaign Sender (with Inline Demo Generation)
 *
 * Sends outreach emails to law firms from Firestore preintake_emails collection.
 * Generates personalized demos for each contact BEFORE sending the email.
 * Uses Mailgun API for email delivery.
 *
 * SCHEDULE (PT Time Enforcement):
 *   - Days: Monday-Friday only
 *   - Windows: 9:00-10:00am PT and 1:00-2:00pm PT
 *   - Automatically handles DST (script checks PT time, not UTC)
 *   - Exits cleanly with code 0 if outside allowed window
 *
 * Environment Variables:
 *   MAILGUN_API_KEY - Mailgun API key
 *   MAILGUN_DOMAIN - Mailgun sending domain (default: law.preintake.ai)
 *   ANTHROPIC_API_KEY - Anthropic API key for AI analysis
 *   BATCH_SIZE - Number of emails to send per run (default: 5)
 *   TEST_EMAIL - Override recipient for testing (won't mark as sent)
 *   SKIP_TIME_CHECK - Set to 'true' to bypass PT time window check
 *   SKIP_DEMO_GEN - Set to 'true' to skip demo generation (for testing email only)
 *   DOC_ID - Specific document ID from preintake_emails to process
 *   TEST_DEMO_ID - Use existing demo lead ID for all emails (skips demo generation)
 *   TEST_LEAD_ID - Use existing preintake_leads doc for everything (simplest test mode)
 *
 * Usage:
 *   # Normal run (respects PT time window)
 *   MAILGUN_API_KEY=xxx ANTHROPIC_API_KEY=xxx node scripts/send-preintake-campaign.js
 *
 *   # Force run outside time window (for testing)
 *   SKIP_TIME_CHECK=true MAILGUN_API_KEY=xxx ANTHROPIC_API_KEY=xxx node scripts/send-preintake-campaign.js
 *
 *   # Test mode (sends to test email, doesn't update Firestore)
 *   TEST_EMAIL=test@example.com SKIP_TIME_CHECK=true ... node scripts/send-preintake-campaign.js
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

// Import demo generation functions first
const { analyzeWebsite } = require('../functions/preintake-analysis-functions');
const { performDeepResearch } = require('../functions/deep-research-functions');
const { generateDemoFiles, uploadToStorage, initFirebaseAdmin, generateBarProfileDemo, generateUniqueIntakeCode } = require('../functions/demo-generator-functions');

// Initialize Firebase Admin using the functions' firebase-admin instance
// This ensures uploadToStorage uses the same initialized app
const serviceAccount = require('../secrets/serviceAccountKey.json');
const admin = initFirebaseAdmin(serviceAccount, 'teambuilder-plus-fe74d.firebasestorage.app');

// Create a secondary app instance for reading config from DEFAULT database
// (The config/emailCampaign document is in the default database, not preintake)
const configApp = admin.apps.find(app => app?.name === 'configApp') ||
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  }, 'configApp');
const configDb = configApp.firestore();

// Use the dedicated 'preintake' database for campaign data
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Mailgun configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'law.preintake.ai';
const MAILGUN_BASE_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;
const FROM_ADDRESS = 'Stephen Scott <stephen@law.preintake.ai>';

// Configuration
const COLLECTION_NAME = 'preintake_emails';
const LEADS_COLLECTION = 'preintake_leads';
const SEND_DELAY_MS = 1000; // 1 second between emails (can be reduced with Mailgun)
const ENV_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');

/**
 * Get batch size from Firestore config document, falling back to .env value
 * This allows GitHub Actions to update batch sizes without modifying the script
 * Reads from DEFAULT database config/emailCampaign document
 */
async function getDynamicBatchSize() {
  try {
    const configDoc = await configDb.collection('config').doc('emailCampaign').get();
    if (configDoc.exists && configDoc.data().preintakeBatchSize) {
      const firestoreBatchSize = configDoc.data().preintakeBatchSize;
      console.log(`📊 Using Firestore batch size: ${firestoreBatchSize}`);
      return firestoreBatchSize;
    }
  } catch (error) {
    console.log(`⚠️ Could not read Firestore config: ${error.message}`);
  }
  // Fallback to environment variable
  console.log(`📊 Using .env fallback batch size: ${ENV_BATCH_SIZE}`);
  return ENV_BATCH_SIZE;
}

// Anthropic API key (required for demo generation)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Test mode: override recipient email (does NOT mark as sent in Firestore)
const TEST_EMAIL = process.env.TEST_EMAIL || null;

// Skip time check (for manual testing)
const SKIP_TIME_CHECK = process.env.SKIP_TIME_CHECK === 'true';

// Skip demo generation (for testing email only)
const SKIP_DEMO_GEN = process.env.SKIP_DEMO_GEN === 'true';

// Specific document ID to process (bypasses query, uses specific record)
const DOC_ID = process.env.DOC_ID || null;

// Test demo ID - use an existing demo lead ID for all emails (skips demo generation)
// This is useful for testing the email flow without generating new demos each time
const TEST_DEMO_ID = process.env.TEST_DEMO_ID || null;

// Test lead ID - use an existing preintake_leads document for everything
// Pulls contact data AND demo from this single document (simplest test mode)
const TEST_LEAD_ID = process.env.TEST_LEAD_ID || null;

// Exclude Yahoo/AOL emails during domain warming (set to 'true' to enable)
// Yahoo/AOL use aggressive spam filtering and can hurt sender reputation during warming
const EXCLUDE_YAHOO_AOL = process.env.EXCLUDE_YAHOO_AOL === 'true';

// Yahoo/AOL domains to exclude during warming
const YAHOO_AOL_DOMAINS = ['yahoo.com', 'yahoo.co.uk', 'yahoo.ca', 'yahoo.com.au', 'yahoo.co.in', 'ymail.com', 'aol.com', 'aim.com'];

/**
 * Check if an email address is from Yahoo/AOL (should be excluded during warming)
 */
function isYahooAolEmail(email) {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return YAHOO_AOL_DOMAINS.includes(domain) || domain.startsWith('yahoo.');
}

/**
 * Validate contact data quality before sending email
 * Skips contacts with junk or missing data to protect sender reputation
 * Returns { valid: boolean, issues: string[] }
 */
function validateContactData(data) {
    const issues = [];
    const { firstName, lastName, firmName, email } = data;

    // Junk patterns that indicate bad scraper data
    const junkPatterns = [
        /\bcart\b/i, /\blogin\b/i, /\bstore\b/i, /\bmenu\b/i, /\bsearch\b/i,
        /office type/i, /solo practice/i, /sign in/i, /register/i,
        /\bhome\b/i, /wsba members/i, /bar association/i, /or employer/i,
        /^\d+$/, // Pure numbers
        /^[^a-zA-Z]*$/ // No letters at all
    ];

    // Helper to check if a string contains junk
    const hasJunk = (str) => {
        if (!str) return false;
        return junkPatterns.some(p => p.test(str));
    };

    // Helper to check if string looks like a real name (not junk)
    const isValidName = (str) => {
        if (!str || str.trim().length < 2) return false;
        if (hasJunk(str)) return false;
        // Must start with a letter and be reasonable length
        if (!/^[A-Za-z]/.test(str.trim())) return false;
        if (str.trim().length > 50) return false; // Names shouldn't be super long
        return true;
    };

    // Validate email exists
    if (!email || !email.includes('@')) {
        issues.push('Missing or invalid email');
    }

    // Validate firstName
    if (!firstName || firstName.trim().length < 2) {
        issues.push('Missing firstName');
    } else if (hasJunk(firstName)) {
        issues.push(`Junk in firstName: "${firstName}"`);
    } else if (!isValidName(firstName)) {
        issues.push(`Invalid firstName: "${firstName}"`);
    }

    // Validate lastName
    if (!lastName || lastName.trim().length < 2) {
        issues.push('Missing lastName');
    } else if (hasJunk(lastName)) {
        issues.push(`Junk in lastName: "${lastName}"`);
    } else if (!isValidName(lastName)) {
        issues.push(`Invalid lastName: "${lastName}"`);
    }

    // Validate firmName if provided (it's okay to be empty - we generate fallback)
    if (firmName && hasJunk(firmName)) {
        issues.push(`Junk in firmName: "${firmName}"`);
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Clean firm name by removing address information
 * Some bar associations concatenate firm name with address in their data
 * Example: "Lisa L. Cullaro, P.A.PO Box 271150Tampa, FL 33688-1150"
 * Should become: "Lisa L. Cullaro, P.A."
 */
function cleanFirmName(firmText) {
    if (!firmText) return '';

    let cleaned = firmText.trim();

    // Pattern 1: PO Box (with or without space after number)
    // "Firm NamePO Box 123..." or "Firm Name PO Box 123..."
    const poBoxMatch = cleaned.match(/^(.+?)\s*PO\s*Box/i);
    if (poBoxMatch) {
        return poBoxMatch[1].trim();
    }

    // Pattern 2: Street number followed by text (standard address)
    // "Firm Name123 Main St" or "Firm Name 123 Main St"
    const streetMatch = cleaned.match(/^(.+?)(\d+\s*[A-Za-z])/);
    if (streetMatch && streetMatch[1].length > 3) {
        return streetMatch[1].trim();
    }

    // Pattern 3: State abbreviation + ZIP code
    // "Firm Name, Tampa, FL 33688"
    const stateZipMatch = cleaned.match(/^(.+?),\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/);
    if (stateZipMatch) {
        return stateZipMatch[1].trim();
    }

    // Pattern 4: 5-digit ZIP code anywhere (last resort)
    // "Firm Name...33688-1150"
    const zipMatch = cleaned.match(/^(.+?)\d{5}(-\d{4})?/);
    if (zipMatch && zipMatch[1].length > 3) {
        // Make sure we didn't just grab a tiny prefix
        const candidate = zipMatch[1].trim();
        // Remove trailing comma, city name fragments
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

/**
 * Check if current time is within allowed PT business window
 * Returns { allowed: boolean, reason: string, ptTime: string }
 */
function checkPTBusinessWindow() {
    const now = new Date();
    const ptTimeStr = now.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });

    // Get PT components
    const ptDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const day = ptDate.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const hour = ptDate.getHours();
    const minute = ptDate.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    // Allowed days: Monday-Friday (1-5)
    const allowedDays = [1, 2, 3, 4, 5];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (!allowedDays.includes(day)) {
        return {
            allowed: false,
            reason: `${dayNames[day]} is outside allowed days`,
            ptTime: ptTimeStr
        };
    }

    // Allowed windows: 9:00-10:00am PT and 1:00-2:00pm PT
    // Window 1: 9:00am - 10:00am (540-600 minutes)
    // Window 2: 1:00pm - 2:00pm (780-840 minutes)
    const window1Start = 9 * 60;       // 9:00am = 540
    const window1End = 10 * 60;        // 10:00am = 600
    const window2Start = 13 * 60;      // 1:00pm = 780
    const window2End = 14 * 60;        // 2:00pm = 840

    const inWindow1 = timeInMinutes >= window1Start && timeInMinutes < window1End;
    const inWindow2 = timeInMinutes >= window2Start && timeInMinutes < window2End;

    if (!inWindow1 && !inWindow2) {
        return {
            allowed: false,
            reason: `${hour}:${minute.toString().padStart(2, '0')} PT is outside allowed windows (9:00-10:00am, 1:00-2:00pm)`,
            ptTime: ptTimeStr
        };
    }

    return {
        allowed: true,
        reason: inWindow1 ? 'Morning window (9:00-10:00am PT)' : 'Afternoon window (1:00-2:00pm PT)',
        ptTime: ptTimeStr
    };
}

/**
 * Generate demo for a contact
 * Returns { success: boolean, leadId?: string, demoUrl?: string, error?: string }
 */
async function generateDemoForContact(contactData) {
    const { firmName, email, website } = contactData;

    if (!website) {
        return { success: false, error: 'No website URL' };
    }

    try {
        console.log(`   🔍 Analyzing website: ${website}`);

        // Step 1: Analyze website
        const analysis = await analyzeWebsite(website);
        console.log(`   ✓ Analysis complete: ${analysis.firmName || firmName}`);

        // Step 2: Deep research
        console.log(`   🔬 Running deep research...`);
        let deepResearch = {};
        try {
            deepResearch = await performDeepResearch(website, analysis);
            console.log(`   ✓ Deep research complete: ${deepResearch.pagesAnalyzed || 0} pages`);
        } catch (deepError) {
            console.log(`   ⚠️ Deep research failed (continuing): ${deepError.message}`);
        }

        // Step 3: Create lead document
        const leadId = db.collection(LEADS_COLLECTION).doc().id;
        // Clean firmName - prefer analysis.firmName (scraped from website), fallback to cleaned campaign firmName
        const cleanedFirmName = analysis.firmName || cleanFirmName(firmName) || firmName;
        const leadData = {
            name: cleanedFirmName,
            email: email,
            website: website,
            source: 'campaign',
            emailVerified: true,
            autoConfirmed: true,
            status: 'demo_ready',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            analysis: analysis,
            deepResearch: deepResearch,
            // Auto-confirm practice areas (use first detected or 'General Practice')
            confirmedPracticeAreas: {
                primaryArea: analysis.primaryPracticeArea || 'General Practice',
                areas: analysis.practiceAreas || ['General Practice']
            }
        };

        // Step 4: Generate demo files
        console.log(`   🏗️ Generating demo...`);
        const { htmlContent, configContent } = generateDemoFiles(
            leadId,
            leadData,
            analysis,
            deepResearch
        );

        // Step 5: Upload to Firebase Storage
        const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);
        console.log(`   ✓ Demo uploaded: ${demoUrl}`);

        // Step 6: Generate unique 6-digit intake code for short URL
        const intakeCode = await generateUniqueIntakeCode(db);
        const hostedIntakeUrl = `https://preintake.ai/${intakeCode}`;
        console.log(`   ✓ Generated intake code: ${intakeCode}`);

        // Step 7: Save lead document with demo URL and intake code
        leadData.demoUrl = demoUrl;
        leadData.intakeCode = intakeCode;
        leadData.hostedIntakeUrl = hostedIntakeUrl;
        leadData['demo.generatedAt'] = admin.firestore.FieldValue.serverTimestamp();
        leadData['demo.version'] = '1.0.0';
        // Default delivery config - email to the contact
        leadData.deliveryConfig = {
            method: 'email',
            emailAddress: email,
            webhookUrl: null,
            crmType: null
        };

        await db.collection(LEADS_COLLECTION).doc(leadId).set(leadData);

        return { success: true, leadId, demoUrl, intakeCode, hostedIntakeUrl };

    } catch (error) {
        console.error(`   ❌ Demo generation failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Generate demo for a bar profile contact (no website)
 * Uses only bar profile data: firstName, lastName, practiceArea, email, state
 * Returns { success: boolean, leadId?: string, demoUrl?: string, error?: string }
 */
async function generateBarProfileDemoForContact(contactData) {
    const { firstName, lastName, practiceArea, email, state, firmName, barNumber } = contactData;

    if (!firstName || !lastName) {
        return { success: false, error: 'Missing attorney name' };
    }

    try {
        console.log(`   🔍 Generating bar profile demo for: ${firstName} ${lastName}`);

        // Step 1: Create lead document
        const leadId = db.collection(LEADS_COLLECTION).doc().id;

        // Step 2: Generate demo using bar profile data
        console.log(`   🏗️ Generating demo from bar profile...`);
        const { htmlContent, configContent } = generateBarProfileDemo(leadId, {
            firstName,
            lastName,
            practiceArea: practiceArea || 'General Practice',
            email,
            state: state || null,
            firmName,
            barNumber
        });

        // Step 3: Upload to Firebase Storage
        const demoUrl = await uploadToStorage(leadId, htmlContent, configContent);
        console.log(`   ✓ Demo uploaded: ${demoUrl}`);

        // Step 4: Generate unique 6-digit intake code for short URL
        const intakeCode = await generateUniqueIntakeCode(db);
        const hostedIntakeUrl = `https://preintake.ai/${intakeCode}`;
        console.log(`   ✓ Generated intake code: ${intakeCode}`);

        // Step 5: Build firm name (clean any address info from scraper data)
        const cleanedFirmName = cleanFirmName(firmName);
        const generatedFirmName = cleanedFirmName || `${firstName} ${lastName}, Attorney at Law`;

        // Step 6: Save lead document with demo URL and intake code
        const leadData = {
            name: generatedFirmName,
            email: email,
            website: '', // No website
            hasWebsite: false, // Flag for demo template (hides "Not at this firm?" link)
            source: 'bar_profile_campaign',
            barNumber: barNumber || null,
            state: state || null,
            emailVerified: true,
            autoConfirmed: true,
            status: 'demo_ready',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            demoUrl: demoUrl,
            intakeCode: intakeCode,
            hostedIntakeUrl: hostedIntakeUrl,
            'demo.generatedAt': admin.firestore.FieldValue.serverTimestamp(),
            'demo.version': '1.0.0',
            // Minimal analysis (no website to scrape)
            analysis: {
                firmName: generatedFirmName,
                primaryPracticeArea: practiceArea || 'General Practice',
                location: { state: state || null }
            },
            // Practice areas from bar profile
            confirmedPracticeAreas: {
                primaryArea: practiceArea || 'General Practice',
                areas: [practiceArea || 'General Practice'],
                autoConfirmed: true
            },
            // Default delivery config - email to the contact
            deliveryConfig: {
                method: 'email',
                emailAddress: email,
                webhookUrl: null,
                crmType: null
            }
        };

        await db.collection(LEADS_COLLECTION).doc(leadId).set(leadData);

        return { success: true, leadId, demoUrl, intakeCode, hostedIntakeUrl };

    } catch (error) {
        console.error(`   ❌ Bar profile demo generation failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Generate outreach email HTML with personalized demo link
 * Uses cold outreach messaging (not "demo ready" transactional style)
 */
function generateEmailHTML(firmName, email, leadId, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    // Direct link to personalized demo via homepage with ?demo= parameter
    // Include &firm= so homepage shows "Welcome [firmName]" banner immediately
    const demoUrl = `https://preintake.ai/?demo=${leadId}&firm=${encodeURIComponent(firmName)}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `<p style="font-size: 16px;">Hello ${firstName},</p>\n\n      ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="display:none; max-height:0; overflow:hidden;">
    Pre-screen every inquiry before it reaches your team—see how it works for ${firmName}.
  </div>

  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffffff;">Pre</span>Intake<span style="color:#ffffff;">.ai</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          Pre-Screen Every Inquiry — Tailored to Your Practice Area
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      ${greeting}<p style="font-size: 16px;">Every law firm has the same intake problem: too many inquiries, not enough signal. Strong cases wait alongside weak or misdirected submissions, and staff time gets burned sorting it out. PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before your team ever reviews them.</p>

      <p style="font-size: 16px;">Instead of reviewing raw submissions in the order they arrive, your team sees what matters most first. Strong inquiries are clear, weak ones are obvious, and misdirected matters don't steal attention they don't deserve.</p>

      <p style="font-size: 16px;">Every inquiry is reviewed and delivered with:</p>

      <ul style="color: #1a1a2e; padding-left: 20px; font-size: 16px;">
          <li>A case summary tailored to your practice area</li>
          <li>A qualification rating: <strong>qualified</strong>, <strong>needs review</strong>, or <strong>not a fit</strong></li>
          <li>A plain-English explanation of why</li>
      </ul>

      <p style="font-size: 16px; margin-top: 16px;">
          <strong style="color: #c9a962;">Zero Data Retention</strong> — Inquiry content is processed and delivered, not retained.
      </p>

      <p style="font-size: 16px; margin-top: 8px;">
          Embeds directly on your website — visitors never leave your site.
      </p>

      <p style="font-size: 16px;">We've prepared a demo tailored specifically to <strong>${firmName}</strong>:</p>

      <div style="text-align: center; margin: 20px 0 30px 0;">
          <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">View Your Firm's Demo</a>
      </div>

      <p style="font-size: 16px; margin-top: 16px;">
          No commitment. Review it on your own — no calls required.
      </p>

      <p style="font-size: 16px; margin-top: 16px;">
          Not the right contact for intake? Feel free to forward — the demo link is specific to <strong>${firmName}</strong>.
      </p>

      <p style="font-size: 16px; margin-top: 20px;">
          Best,<br>
          <strong>Stephen Scott</strong><br>
          Founder, PreIntake.ai
      </p>
    </div>

    <div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
      <a href="https://preintake.ai" style="color:#c9a962;">preintake.ai</a>
      <p style="margin:10px 0 0 0; font-size:11px; color:#94a3b8;">
        Los Angeles, California
      </p>
      <p style="margin:10px 0 0 0;">
        <a href="${unsubscribeUrl}" style="color:#94a3b8; text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
</body>
</html>`;
}

/**
 * Generate fallback email HTML (no personalized demo)
 */
function generateFallbackEmailHTML(firmName, email, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    // Include firmName in URL so landing page can display it (no #demo hash to prevent auto-scroll)
    const demoUrl = `https://preintake.ai/?firm=${encodeURIComponent(firmName)}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `<p style="font-size: 16px;">Hello ${firstName},</p>\n\n      ` : '';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="display:none; max-height:0; overflow:hidden;">
    Pre-screen every inquiry before it reaches your team—see how it works for ${firmName}.
  </div>

  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffffff;">Pre</span>Intake<span style="color:#ffffff;">.ai</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          Pre-Screen Every Inquiry — Tailored to Your Practice Area
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      ${greeting}<p style="font-size: 16px;">Every law firm has the same intake problem: too many inquiries, not enough signal. Strong cases wait alongside weak or misdirected submissions, and staff time gets burned sorting it out. PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before your team ever reviews them.</p>

      <p style="font-size: 16px;">Instead of reviewing raw submissions in the order they arrive, your team sees what matters most first. Strong inquiries are clear, weak ones are obvious, and misdirected matters don't steal attention they don't deserve.</p>

      <p style="font-size: 16px;">Every inquiry is reviewed and delivered with:</p>

      <ul style="color: #1a1a2e; padding-left: 20px; font-size: 16px;">
          <li>A case summary tailored to your practice area</li>
          <li>A qualification rating: <strong>qualified</strong>, <strong>needs review</strong>, or <strong>not a fit</strong></li>
          <li>A plain-English explanation of why</li>
      </ul>

      <p style="font-size: 16px; margin-top: 16px;">
          <strong style="color: #c9a962;">Zero Data Retention</strong> — Inquiry content is processed and delivered, not retained.
      </p>

      <p style="font-size: 16px; margin-top: 8px;">
          Embeds directly on your website — visitors never leave your site.
      </p>

      <p style="font-size: 16px;">For your convenience, we've created a fully customized demo for <strong>${firmName}</strong>:</p>

      <div style="text-align: center; margin: 20px 0 30px 0;">
          <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">Experience It Live</a>
      </div>

      <p style="font-size: 16px; margin-top: 16px;">
          No commitment. Review it on your own — no calls required.
      </p>

      <p style="font-size: 16px; margin-top: 16px;">
          Not the right contact for intake? Feel free to forward — the demo link is specific to <strong>${firmName}</strong>.
      </p>

      <p style="font-size: 16px; margin-top: 20px;">
          Best,<br>
          <strong>Stephen Scott</strong><br>
          Founder, PreIntake.ai
      </p>
    </div>

    <div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
      <a href="https://preintake.ai" style="color:#c9a962;">preintake.ai</a>
      <p style="margin:10px 0 0 0; font-size:11px; color:#94a3b8;">
        PreIntake.ai · Los Angeles, California
      </p>
      <p style="margin:10px 0 0 0;">
        <a href="${unsubscribeUrl}" style="color:#94a3b8; text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
</body>
</html>`;
}

/**
 * Generate plain-text version of personalized demo email
 */
function generateEmailPlainText(firmName, email, leadId, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    const demoUrl = `https://preintake.ai/?demo=${leadId}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `Hello ${firstName},\n\n` : '';

    return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

${greeting}Every law firm has the same intake problem: too many inquiries, not enough signal. Strong cases wait alongside weak or misdirected submissions, and staff time gets burned sorting it out. PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before your team ever reviews them.

Instead of reviewing raw submissions in the order they arrive, your team sees what matters most first. Strong inquiries are clear, weak ones are obvious, and misdirected matters don't steal attention they don't deserve.

Every inquiry is reviewed and delivered with:

• A case summary tailored to your practice area
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero Data Retention — Inquiry content is processed and delivered, not retained.

Embeds directly on your website — visitors never leave your site.

We've prepared a demo tailored specifically to ${firmName}:

View Your Firm's Demo: ${demoUrl}

No commitment. Review it on your own — no calls required.

Not the right contact for intake? Feel free to forward — the demo link is specific to ${firmName}.

Best,
Stephen Scott
Founder, PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: ${unsubscribeUrl}`;
}

/**
 * Generate plain-text version of fallback email
 */
function generateFallbackEmailPlainText(firmName, email, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    // Include firmName in URL so landing page can display it (no #demo hash to prevent auto-scroll)
    const demoUrl = `https://preintake.ai/?firm=${encodeURIComponent(firmName)}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `Hello ${firstName},\n\n` : '';

    return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

${greeting}Every law firm has the same intake problem: too many inquiries, not enough signal. Strong cases wait alongside weak or misdirected submissions, and staff time gets burned sorting it out. PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before your team ever reviews them.

Instead of reviewing raw submissions in the order they arrive, your team sees what matters most first. Strong inquiries are clear, weak ones are obvious, and misdirected matters don't steal attention they don't deserve.

Every inquiry is reviewed and delivered with:

• A case summary tailored to your practice area
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero Data Retention — Inquiry content is processed and delivered, not retained.

Embeds directly on your website — visitors never leave your site.

For your convenience, we've created a fully customized demo for ${firmName}:

Experience It Live: ${demoUrl}

No commitment. Review it on your own — no calls required.

Not the right contact for intake? Feel free to forward — the demo link is specific to ${firmName}.

Best,
Stephen Scott
Founder, PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: ${unsubscribeUrl}`;
}

/**
 * Generate email HTML for bar profile contacts (attorneys without websites)
 * More personalized messaging acknowledging we built the demo from their bar profile
 */
function generateBarProfileEmailHTML(firmName, email, leadId, firstName, practiceArea, state) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    const demoUrl = `https://preintake.ai/?demo=${leadId}&firm=${encodeURIComponent(firmName)}&utm_source=email&utm_medium=outreach&utm_campaign=bar_profile&utm_content=cta_button`;

    // Format practice area for display
    const displayPracticeArea = practiceArea || 'legal';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffffff;">Pre</span>Intake<span style="color:#ffffff;">.ai</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          Pre-Screen Every Inquiry — Tailored to Your Practice Area
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="font-size: 16px;">Hi${firstName ? ' ' + firstName : ''},</p>

      <p style="font-size: 16px;">I came across your ${state ? state + ' ' : ''}Bar profile and saw that you handle <strong>${displayPracticeArea}</strong> matters.</p>

      <p style="font-size: 16px;">Most intake systems assume you have a website. This one doesn't. It works as a simple hosted intake link you can share anywhere you currently accept inquiries—email signature, referral partners, even a text message.</p>

      <p style="font-size: 16px;">Each inquiry is reviewed and delivered with:</p>

      <ul style="color: #1a1a2e; padding-left: 20px; font-size: 16px;">
          <li>A case summary tailored to ${displayPracticeArea}</li>
          <li>A qualification rating: qualified, needs review, or not a fit</li>
          <li>A plain-English explanation of why</li>
      </ul>

      <p style="font-size: 16px; margin-top: 16px;">
          <strong style="color: #c9a962;">Zero data retention.</strong> Inquiry content is processed and delivered to you, not stored.
      </p>

      <p style="font-size: 16px;">Based on public Bar information, I put together a short demo showing how this would work for <strong>${firmName}</strong>.</p>

      <div style="text-align: center; margin: 25px 0;">
          <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">See Your Personalized Demo →</a>
      </div>

      <p style="font-size: 16px;">It takes about two minutes to review. No setup. No commitment.</p>

      <p style="font-size: 16px;">If it saves you a few interruptions a week, it's doing its job. If not, feel free to ignore it.</p>

      <p style="font-size: 16px; margin-top: 20px;">
          Best,<br>
          <strong>Stephen Scott</strong><br>
          Founder, PreIntake.ai
      </p>
    </div>

    <div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
      <a href="https://preintake.ai" style="color:#c9a962;">preintake.ai</a>
      <p style="margin:10px 0 0 0; font-size:11px; color:#94a3b8;">
        Los Angeles, California
      </p>
      <p style="margin:10px 0 0 0;">
        <a href="${unsubscribeUrl}" style="color:#94a3b8; text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
</body>
</html>`;
}

/**
 * Generate plain-text version of bar profile email
 */
function generateBarProfileEmailPlainText(firmName, email, leadId, firstName, practiceArea, state) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    const demoUrl = `https://preintake.ai/?demo=${leadId}&utm_source=email&utm_medium=outreach&utm_campaign=bar_profile&utm_content=cta_button`;

    const displayPracticeArea = practiceArea || 'legal';

    return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

Hi${firstName ? ' ' + firstName : ''},

I came across your ${state ? state + ' ' : ''}Bar profile and saw that you handle ${displayPracticeArea} matters.

Most intake systems assume you have a website. This one doesn't. It works as a simple hosted intake link you can share anywhere you currently accept inquiries—email signature, referral partners, even a text message.

Each inquiry is reviewed and delivered with:

• A case summary tailored to ${displayPracticeArea}
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero data retention. Inquiry content is processed and delivered to you, not stored.

Based on public Bar information, I put together a short demo showing how this would work for ${firmName}.

See Your Personalized Demo: ${demoUrl}

It takes about two minutes to review. No setup. No commitment.

If it saves you a few interruptions a week, it's doing its job. If not, feel free to ignore it.

Best,
Stephen Scott
Founder, PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: ${unsubscribeUrl}`;
}

/**
 * Generate subject line
 * Different subjects based on email type
 */
function generateSubject(hasDemo, isBarProfile = false) {
    if (isBarProfile) {
        return 'I built you a personalized intake demo';
    }
    // Same subject for both personalized and fallback emails
    return 'Pre-screen every inquiry before it reaches your team';
}

/**
 * Send email via Mailgun API
 */
async function sendViaMailgun(to, subject, htmlContent, textContent, tags = []) {
    const form = new FormData();

    form.append('from', FROM_ADDRESS);
    form.append('to', to);
    form.append('subject', subject);
    form.append('html', htmlContent);
    form.append('text', textContent);

    // Disable Mailgun tracking - using Firestore-based tracking instead
    // (trackDemoView: type=visit on page load, type=view on demo start)
    form.append('o:tracking', 'no');
    form.append('o:tracking-opens', 'no');
    form.append('o:tracking-clicks', 'no');

    // Add tags for analytics
    form.append('o:tag', 'preintake_campaign');
    tags.forEach(tag => form.append('o:tag', tag));

    const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
        headers: {
            ...form.getHeaders(),
            'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
        }
    });

    return {
        messageId: response.data.id,
        message: response.data.message
    };
}

/**
 * Main campaign function
 */
async function runCampaign() {
    console.log('📧 PreIntake.ai Email Campaign (with Demo Generation)');
    console.log('======================================================\n');

    // Get dynamic batch size from Firestore (or fall back to env)
    const BATCH_SIZE = await getDynamicBatchSize();

    // Check PT business window (unless bypassed)
    if (!SKIP_TIME_CHECK) {
        const timeCheck = checkPTBusinessWindow();
        console.log(`🕐 Current PT Time: ${timeCheck.ptTime}`);

        if (!timeCheck.allowed) {
            console.log(`⏭️  Skipping: ${timeCheck.reason}`);
            console.log('   Allowed: Mon-Fri, 9:00-10:00am PT and 1:00-2:00pm PT');
            console.log('   Set SKIP_TIME_CHECK=true to bypass');
            process.exit(0);
        }

        console.log(`✅ ${timeCheck.reason}`);
        console.log('');
    } else {
        console.log('⚠️  Time check bypassed (SKIP_TIME_CHECK=true)\n');
    }

    // Validate environment
    if (!MAILGUN_API_KEY) {
        console.error('❌ Missing MAILGUN_API_KEY environment variable');
        process.exit(1);
    }

    if (!ANTHROPIC_API_KEY && !SKIP_DEMO_GEN && !TEST_LEAD_ID && !TEST_DEMO_ID) {
        console.error('❌ Missing ANTHROPIC_API_KEY');
        console.error('   Set ANTHROPIC_API_KEY environment variable for demo generation');
        console.error('   Or set SKIP_DEMO_GEN=true to skip demo generation');
        console.error('   Or set TEST_LEAD_ID=xxx to use an existing demo');
        process.exit(1);
    }

    console.log(`📊 Configuration:`);
    console.log(`   Mailgun Domain: ${MAILGUN_DOMAIN}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Batch Size: ${BATCH_SIZE}`);
    console.log(`   Demo Generation: ${SKIP_DEMO_GEN ? 'DISABLED' : 'ENABLED'}`);
    console.log(`   Yahoo/AOL Exclusion: ${EXCLUDE_YAHOO_AOL ? 'ENABLED (domain warming)' : 'DISABLED'}`);
    if (TEST_EMAIL) {
        console.log(`   ⚠️  TEST MODE: All emails will be sent to ${TEST_EMAIL}`);
        console.log(`   ⚠️  Firestore records will NOT be marked as sent`);
    }
    console.log('');
    console.log('✅ Mailgun configured\n');

    // Generate batch ID
    const batchId = `batch_${Date.now()}`;

    // Query all "ready" contacts together, ordered by randomIndex:
    // - Contacts WITH website URLs (website-based demos)
    // - Contacts with domainChecked=true but no website (bar profile demos)
    // Contacts not yet processed by infer-calbar-websites.js are skipped until ready.
    let allDocs = [];

    // If TEST_LEAD_ID is provided, use the existing preintake_leads document directly
    if (TEST_LEAD_ID) {
        console.log(`🧪 TEST MODE: Using existing lead ${TEST_LEAD_ID}`);
        const leadDoc = await db.collection(LEADS_COLLECTION).doc(TEST_LEAD_ID).get();
        if (!leadDoc.exists) {
            console.error(`❌ Lead ${TEST_LEAD_ID} not found in ${LEADS_COLLECTION}`);
            process.exit(1);
        }
        const leadData = leadDoc.data();
        console.log(`📊 Found lead: ${leadData.name || leadData.analysis?.firmName || 'Unknown'}`);
        console.log(`   Email: ${leadData.email}`);
        console.log(`   Status: ${leadData.status}`);

        // Create a fake doc object that matches expected structure
        const fakeDoc = {
            id: TEST_LEAD_ID,
            ref: { update: async () => {} }, // No-op update for test mode
            data: () => ({
                firmName: leadData.name || leadData.analysis?.firmName || 'Test Firm',
                email: leadData.email,
                website: leadData.website,
                firstName: leadData.name?.split(' ')[0] || '',
                lastName: leadData.name?.split(' ').slice(1).join(' ') || '',
                _isTestLead: true, // Flag to use this lead ID for demo URL
                _testLeadId: TEST_LEAD_ID
            })
        };
        allDocs = [fakeDoc];
    }
    // If specific document ID is provided, use that instead of querying
    else if (DOC_ID) {
        console.log(`📋 Using specific document ID: ${DOC_ID}`);
        const specificDoc = await db.collection(COLLECTION_NAME).doc(DOC_ID).get();
        if (!specificDoc.exists) {
            console.error(`❌ Document ${DOC_ID} not found in ${COLLECTION_NAME}`);
            process.exit(1);
        }
        allDocs = [specificDoc];
        console.log(`📊 Found document: ${specificDoc.data().firmName || specificDoc.data().email}`);
    } else {
        // Query contacts in parallel, then apply 50/50 distribution between
        // contacts WITH websites vs contacts WITHOUT websites (bar profile)
        // This ensures high-value website contacts get equal representation
        const queryLimit = BATCH_SIZE * 2; // Fetch extra to ensure we have enough

        const [withWebsiteSnapshot, notFoundSnapshot, personalEmailSnapshot] = await Promise.all([
            // Contacts with website URLs
            db.collection(COLLECTION_NAME)
                .where('sent', '==', false)
                .where('status', '==', 'pending')
                .where('website', '!=', '')
                .orderBy('website')
                .orderBy('randomIndex')
                .limit(queryLimit)
                .get(),
            // Bar profile contacts (not_found)
            db.collection(COLLECTION_NAME)
                .where('sent', '==', false)
                .where('status', '==', 'pending')
                .where('domainChecked', '==', true)
                .where('domainCheckResult', '==', 'not_found')
                .orderBy('randomIndex')
                .limit(queryLimit)
                .get(),
            // Bar profile contacts (personal_email)
            db.collection(COLLECTION_NAME)
                .where('sent', '==', false)
                .where('status', '==', 'pending')
                .where('domainChecked', '==', true)
                .where('domainCheckResult', '==', 'personal_email')
                .orderBy('randomIndex')
                .limit(queryLimit)
                .get()
        ]);

        console.log(`📊 Query results:`);
        console.log(`   - With website: ${withWebsiteSnapshot.size}`);
        console.log(`   - Bar profile (not_found): ${notFoundSnapshot.size}`);
        console.log(`   - Bar profile (personal_email): ${personalEmailSnapshot.size}`);

        // Sort website contacts by randomIndex
        const websiteDocs = withWebsiteSnapshot.docs
            .sort((a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0));

        // Dedupe and sort bar profile contacts by randomIndex
        const barProfileMap = new Map();
        [...notFoundSnapshot.docs, ...personalEmailSnapshot.docs].forEach(doc => {
            if (!barProfileMap.has(doc.id)) {
                barProfileMap.set(doc.id, doc);
            }
        });
        const barProfileDocs = Array.from(barProfileMap.values())
            .sort((a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0));

        // Apply Yahoo/AOL filter if enabled
        let filteredWebsiteDocs = websiteDocs;
        let filteredBarProfileDocs = barProfileDocs;
        if (EXCLUDE_YAHOO_AOL) {
            const beforeWebsite = filteredWebsiteDocs.length;
            const beforeBarProfile = filteredBarProfileDocs.length;
            filteredWebsiteDocs = filteredWebsiteDocs.filter(doc => !isYahooAolEmail(doc.data().email));
            filteredBarProfileDocs = filteredBarProfileDocs.filter(doc => !isYahooAolEmail(doc.data().email));
            const filtered = (beforeWebsite - filteredWebsiteDocs.length) + (beforeBarProfile - filteredBarProfileDocs.length);
            if (filtered > 0) {
                console.log(`🛡️  Excluded ${filtered} Yahoo/AOL emails (domain warming mode)`);
            }
        }

        // 50/50 distribution: take half from each pool
        // If one pool is short, supplement from the other
        const halfBatch = Math.ceil(BATCH_SIZE / 2);

        let websiteToTake = Math.min(halfBatch, filteredWebsiteDocs.length);
        let barProfileToTake = Math.min(halfBatch, filteredBarProfileDocs.length);

        // If website pool is short, take more from bar profile
        const websiteShortfall = halfBatch - websiteToTake;
        if (websiteShortfall > 0) {
            barProfileToTake = Math.min(barProfileToTake + websiteShortfall, filteredBarProfileDocs.length);
        }

        // If bar profile pool is short, take more from website
        const barProfileShortfall = halfBatch - barProfileToTake;
        if (barProfileShortfall > 0) {
            websiteToTake = Math.min(websiteToTake + barProfileShortfall, filteredWebsiteDocs.length);
        }

        // Select from each pool
        const selectedWebsiteDocs = filteredWebsiteDocs.slice(0, websiteToTake);
        const selectedBarProfileDocs = filteredBarProfileDocs.slice(0, barProfileToTake);

        // Combine and sort by randomIndex for fair processing order
        allDocs = [...selectedWebsiteDocs, ...selectedBarProfileDocs]
            .sort((a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0));

        console.log(`📊 50/50 distribution applied:`);
        console.log(`   - Website contacts selected: ${selectedWebsiteDocs.length}`);
        console.log(`   - Bar profile contacts selected: ${selectedBarProfileDocs.length}`);
        console.log(`   - Total batch: ${allDocs.length}`);
    }

    if (allDocs.length === 0) {
        console.log('✅ No unsent emails found. Campaign complete!');
        process.exit(0);
    }

    console.log(`📤 Processing ${allDocs.length} emails in ${batchId}\n`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let demosGenerated = 0;

    for (const doc of allDocs) {
        const data = doc.data();
        const { firmName, email, website, firstName, lastName, practiceArea, state, barNumber, domainChecked, domainCheckResult } = data;

        // Validate contact data quality before processing
        const validation = validateContactData(data);
        if (!validation.valid) {
            console.log(`\n⚠️  Skipping ${email}: ${validation.issues.join(', ')}`);
            skipped++;

            // Mark as skipped in Firestore (so we don't keep retrying)
            if (!TEST_EMAIL) {
                await doc.ref.update({
                    status: 'skipped_bad_data',
                    skipReason: validation.issues.join('; '),
                    skippedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            continue;
        }

        // Determine if this is a bar profile contact (no website, but has bar data)
        const isBarProfileContact = domainChecked === true &&
            (domainCheckResult === 'not_found' || domainCheckResult === 'personal_email');

        // Use test email if in test mode, otherwise use actual email
        const recipientEmail = TEST_EMAIL || email;

        // Format recipient with name: "First Last <email>" or "FirmName <email>"
        const cleanedFirmNameForDisplay = cleanFirmName(firmName);
        const recipientName = (firstName && lastName) ? `${firstName} ${lastName}` : cleanedFirmNameForDisplay;
        const formattedRecipient = `${recipientName} <${recipientEmail}>`;

        // Generate firm name for bar profile contacts (clean any address info)
        const displayFirmName = cleanedFirmNameForDisplay || (firstName && lastName ? `${firstName} ${lastName}, Attorney at Law` : 'Law Firm');

        try {
            console.log(`\n📧 Processing ${displayFirmName} (${recipientEmail})...`);
            if (isBarProfileContact) {
                console.log(`   📋 Bar profile contact (${domainCheckResult})`);
            }

            let leadId = null;
            let demoUrl = null;
            let hasDemo = false;
            let isBarProfile = false;

            // Use test lead ID if this is from TEST_LEAD_ID mode
            if (data._isTestLead) {
                leadId = data._testLeadId;
                hasDemo = true;
                console.log(`   🧪 Using existing lead/demo: ${leadId}`);
            }
            // Use test demo ID if provided (for testing without generating new demos)
            else if (TEST_DEMO_ID) {
                leadId = TEST_DEMO_ID;
                hasDemo = true;
                console.log(`   🧪 Using test demo ID: ${TEST_DEMO_ID}`);
            }
            // Generate demo if we have a website URL and demo gen is enabled
            else if (website && !SKIP_DEMO_GEN) {
                const demoResult = await generateDemoForContact(data);
                if (demoResult.success) {
                    leadId = demoResult.leadId;
                    demoUrl = demoResult.demoUrl;
                    hasDemo = true;
                    demosGenerated++;
                } else {
                    console.log(`   ⚠️ Demo generation failed: ${demoResult.error}`);
                    console.log(`   📧 Sending fallback email instead...`);
                }
            }
            // Generate bar profile demo for contacts without websites but with bar data
            else if (isBarProfileContact && !SKIP_DEMO_GEN) {
                const demoResult = await generateBarProfileDemoForContact(data);
                if (demoResult.success) {
                    leadId = demoResult.leadId;
                    demoUrl = demoResult.demoUrl;
                    hasDemo = true;
                    isBarProfile = true;
                    demosGenerated++;
                } else {
                    console.log(`   ⚠️ Bar profile demo generation failed: ${demoResult.error}`);
                    console.log(`   📧 Sending fallback email instead...`);
                }
            } else if (!website && !isBarProfileContact) {
                // This shouldn't happen since Phase 3 was removed - contacts without website
                // AND without domainChecked=true should not be queried. Log as unexpected.
                console.log(`   ⚠️ UNEXPECTED: Contact has no website and domainChecked!=true - sending fallback email`);
            } else if (SKIP_DEMO_GEN) {
                console.log(`   ⚠️ Demo generation disabled - sending fallback email`);
            }

            // Generate subject, HTML, and plain-text versions
            const subject = generateSubject(hasDemo, isBarProfile);
            let html, text;

            if (isBarProfile && hasDemo) {
                // Use bar profile email template
                html = generateBarProfileEmailHTML(displayFirmName, email, leadId, firstName, practiceArea, state);
                text = generateBarProfileEmailPlainText(displayFirmName, email, leadId, firstName, practiceArea, state);
            } else if (hasDemo) {
                // Use standard personalized email template
                html = generateEmailHTML(displayFirmName, email, leadId, firstName);
                text = generateEmailPlainText(displayFirmName, email, leadId, firstName);
            } else {
                // Use fallback email template
                html = generateFallbackEmailHTML(displayFirmName, email, firstName);
                text = generateFallbackEmailPlainText(displayFirmName, email, firstName);
            }

            // Build Mailgun tags for analytics
            const mailgunTags = [];
            if (hasDemo) {
                mailgunTags.push('with_demo');
                if (isBarProfile) {
                    mailgunTags.push('bar_profile');
                }
            } else {
                mailgunTags.push('no_demo');
            }

            // Send email via Mailgun
            console.log(`   📤 Sending email to: ${formattedRecipient}`);
            const result = await sendViaMailgun(
                formattedRecipient,
                subject,
                html,
                text,
                mailgunTags
            );

            // Only update Firestore if NOT in test mode
            if (!TEST_EMAIL) {
                // Determine template version
                let templateVersion = 'v6-generic';
                if (isBarProfile && hasDemo) {
                    templateVersion = 'v7-bar-profile-demo';
                } else if (hasDemo) {
                    templateVersion = 'v6-personalized-demo';
                }

                const updateData = {
                    sent: true,
                    sentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    batchId: batchId,
                    errorMessage: '',
                    messageId: result.messageId || '',
                    mailgunId: result.messageId || '',  // Mailgun message ID for event correlation
                    subjectLine: subject,
                    templateVersion: templateVersion
                };

                // Add demo-related fields if demo was generated
                if (hasDemo) {
                    updateData.demoGenerated = true;
                    updateData.demoUrl = demoUrl;
                    updateData.preintakeLeadId = leadId;
                    updateData.demoGeneratedAt = admin.firestore.FieldValue.serverTimestamp();
                    updateData.demoSource = isBarProfile ? 'bar_profile' : 'website';
                }

                await doc.ref.update(updateData);
            }

            console.log(`   ✅ Sent to ${recipientEmail} - ${result.messageId}`);
            sent++;

            // Delay between sends
            if (sent < allDocs.length) {
                await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
            }

        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}`);

            // Only update Firestore if NOT in test mode
            if (!TEST_EMAIL) {
                await doc.ref.update({
                    sent: false,
                    status: 'failed',
                    batchId: batchId,
                    errorMessage: error.message,
                    lastAttempt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            failed++;
        }
    }

    // Summary
    console.log(`\n📊 ${batchId} Complete:`);
    console.log(`   Total processed: ${allDocs.length}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Demos generated: ${demosGenerated}`);
    console.log(`   Skipped (bad data): ${skipped}`);
    console.log(`   Failed: ${failed}`);
    if (sent > 0) {
        console.log(`   Success rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);
    }

    // Check remaining
    const remainingSnapshot = await db.collection(COLLECTION_NAME)
        .where('sent', '==', false)
        .where('status', '==', 'pending')
        .get();

    console.log(`\n📋 Remaining unsent: ${remainingSnapshot.size}`);

    process.exit(failed > 0 ? 1 : 0);
}

// Run campaign
runCampaign().catch(error => {
    console.error('❌ Campaign failed:', error);
    process.exit(1);
});
