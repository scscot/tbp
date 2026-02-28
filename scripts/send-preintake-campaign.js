#!/usr/bin/env node
/**
 * PreIntake.ai Email Campaign Sender
 *
 * Sends outreach emails to law firms from Firestore preintake_emails collection.
 * Creates lead documents for tracking and links directly to landing page.
 * Uses Mailgun API for email delivery.
 *
 * SCHEDULE (GitHub Actions cron):
 *   - Days: Monday-Friday (weekdays only)
 *   - 4 runs/day morning window at PST offsets (UTC-8)
 *   - PST: 7:30am, 9:00am, 10:00am, 11:30am PT
 *   - PDT: 6:30am, 8:00am, 9:00am, 10:30am PT (1hr earlier, still morning)
 *
 * Environment Variables:
 *   MAILGUN_API_KEY - Mailgun API key
 *   MAILGUN_DOMAIN - Mailgun sending domain (default: law.preintake.ai)
 *   BATCH_SIZE - Number of emails to send per run (default: 5)
 *   TEST_EMAIL - Override recipient for testing (won't mark as sent)
 *   DOC_ID - Specific document ID from preintake_emails to process
 *   TEST_LEAD_ID - Use existing preintake_leads doc for everything (simplest test mode)
 *
 * Usage:
 *   # Normal run (triggered by GitHub Actions cron)
 *   MAILGUN_API_KEY=xxx node scripts/send-preintake-campaign.js
 *
 *   # Test mode (sends to test email, doesn't update Firestore)
 *   TEST_EMAIL=test@example.com MAILGUN_API_KEY=xxx node scripts/send-preintake-campaign.js
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

// Import Firebase initialization (demo generation removed - linking directly to landing page)
const { initFirebaseAdmin } = require('../functions/demo-generator-functions');

// Initialize Firebase Admin using the functions' firebase-admin instance
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

// Test mode: override recipient email (does NOT mark as sent in Firestore)
const TEST_EMAIL = process.env.TEST_EMAIL || null;

// Specific document ID to process (bypasses query, uses specific record)
const DOC_ID = process.env.DOC_ID || null;

// Test lead ID - use an existing preintake_leads document for everything
// Pulls contact data AND lead from this single document (simplest test mode)
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
 * Check if a firmName looks like a valid law firm name (not a page title or junk)
 * Returns true if the name appears valid, false if it's junk
 */
function isValidFirmName(name) {
    if (!name || name.trim().length < 3) return false;

    const trimmed = name.trim();

    // Junk patterns that indicate page titles or bad scraper data
    const junkPatterns = [
        /^home\b/i,                          // "Home - ...", "Home Page - ..."
        /\bhome\s*page\b/i,                  // "Home Page"
        /^page\b/i,                          // "Page - ..."
        /\bpersonal injury lawyer[s]?\b/i,   // Generic SEO title
        /\battorney[s]?\s*(at\s+law)?\s*$/i, // Ends with just "Attorney(s) at Law"
        /^[A-Z][a-z]+,?\s+[A-Z]{2}\s+/,      // Starts with "City, ST" (location)
        /department of/i,                     // Government
        /^\d/,                                // Starts with number
        /\|\s/,                               // Contains pipe separator (page title pattern)
        /focused on/i,                        // "Firm Focused on X" - SEO pattern
        /^\w+\s+law\s+firm\s+(in|focused)/i, // "X Law Firm in/focused..." - SEO pattern
    ];

    if (junkPatterns.some(p => p.test(trimmed))) return false;

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(trimmed)) return false;

    // Suspicious if very long (likely truncated page title)
    if (trimmed.length > 60) return false;

    return true;
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
 * Create a lead document for tracking and conversion
 * Creates minimal lead data for landing page display and conversion tracking
 * Returns { success: boolean, leadId?: string, error?: string }
 */
async function createLeadForContact(contactData) {
    const { firstName, lastName, practiceArea, email, state, firmName, barNumber, website } = contactData;

    try {
        // Generate lead ID
        const leadId = db.collection(LEADS_COLLECTION).doc().id;

        // Build firm name from available data
        const cleanedFirmName = cleanFirmName(firmName);
        let displayFirmName;
        if (cleanedFirmName && isValidFirmName(cleanedFirmName)) {
            displayFirmName = cleanedFirmName;
        } else if (firstName && lastName) {
            displayFirmName = `${firstName} ${lastName}, Attorney at Law`;
        } else {
            displayFirmName = 'Law Firm';
        }

        // Determine source type
        const hasWebsite = !!website;
        const source = hasWebsite ? 'campaign' : 'bar_profile_campaign';

        // Create minimal lead document for tracking
        const leadData = {
            name: displayFirmName,
            email: email,
            website: website || '',
            hasWebsite: hasWebsite,
            source: source,
            barNumber: barNumber || null,
            state: state || null,
            status: 'pending', // Not demo_ready since we're linking to landing page
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Minimal analysis for landing page display
            analysis: {
                firmName: displayFirmName,
                primaryPracticeArea: practiceArea || 'General Practice',
                location: { state: state || null }
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
        console.log(`   ✓ Created lead: ${leadId}`);

        return { success: true, leadId };

    } catch (error) {
        console.error(`   ❌ Lead creation failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Generate outreach email HTML with link to landing page
 * Uses cold outreach messaging (not "demo ready" transactional style)
 */
function generateEmailHTML(firmName, email, leadId, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    // Direct link to landing page with leadId for tracking and personalization
    const ctaUrl = `https://preintake.ai/?lead=${leadId}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

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
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffffff;">Pre</span>Intake<span style="color:#ffffff;">.ai</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          Pre-Screen Every Inquiry<br>Tailored to Your Practice Area
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      ${greeting}<p style="font-size: 16px;">Most law firms treat intake as data collection. It's not. It's triage. And without structured screening, your strongest matters are competing for attention with submissions that should never reach your desk.</p>
      
      <p style="font-size: 16px;"><strong>PreIntake.ai</strong> puts practice-specific screening in front of your intake workflow, so the best matters rise to the top immediately—before your team spends time reading raw narratives and chasing missing details.</p>

      <p style="font-size: 16px;">Instead of reviewing submissions in the order they arrive, you receive a clear case summary, a simple qualification rating (qualified / needs review / not a fit), and a plain-English rationale—so staff can move fast, and attorneys see what matters first.</p>

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

      <p style="font-size: 16px; margin-top: 8px;">
          Don't have a website? No problem. PreIntake.ai works as a hosted intake link you can share anywhere you currently accept inquiries—email signature, referral partners, even a text message.
      </p>

      <div style="text-align: center; margin: 20px 0 30px 0;">
          <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">Learn More</a>
      </div>

      <p style="font-size: 16px; margin-top: 16px;">
          Not the right contact for intake? Feel free to forward this to your team.
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
 * Generate plain-text version of personalized demo email
 */
function generateEmailPlainText(firmName, email, leadId, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    const ctaUrl = `https://preintake.ai/?lead=${leadId}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `Hello ${firstName},\n\n` : '';

    return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

${greeting}Every law firm has the same intake problem: too many inquiries, not enough signal. Strong cases wait alongside weak or misdirected submissions, and staff time gets burned sorting it out.

PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before your team ever reviews them.

Instead of reviewing raw submissions in the order they arrive, your team sees what matters most first. Strong inquiries are clear, weak ones are obvious, and misdirected matters don't steal attention they don't deserve.

Every inquiry is reviewed and delivered with:

• A case summary tailored to your practice area
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero Data Retention — Inquiry content is processed and delivered, not retained.

Embeds directly on your website — visitors never leave your site.

Don't have a website? No problem. PreIntake.ai works as a hosted intake link you can share anywhere you currently accept inquiries—email signature, referral partners, even a text message.

Learn More: ${ctaUrl}

Not the right contact for intake? Feel free to forward this to your team.

Best,
Stephen Scott
Founder, PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: ${unsubscribeUrl}`;
}



/**
 * Generate subject line
 */
function generateSubject() {
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
    console.log('📧 PreIntake.ai Email Campaign');
    console.log('======================================================\n');

    // Get dynamic batch size from Firestore (or fall back to env)
    const BATCH_SIZE = await getDynamicBatchSize();

    // Validate environment
    if (!MAILGUN_API_KEY) {
        console.error('❌ Missing MAILGUN_API_KEY environment variable');
        process.exit(1);
    }

    console.log(`📊 Configuration:`);
    console.log(`   Mailgun Domain: ${MAILGUN_DOMAIN}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Batch Size: ${BATCH_SIZE}`);
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
    // - Contacts WITH website URLs
    // - Contacts with domainChecked=true but no website (bar profile contacts)
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
                _isTestLead: true, // Flag to use this existing lead ID
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
        // Query all eligible contacts (website + bar profile) in parallel,
        // then merge into a single pool sorted by randomIndex for natural distribution.
        // Firestore can't OR across different field conditions, so we run 3 queries.
        const queryLimit = BATCH_SIZE * 2; // Fetch extra to handle filtering

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

        // PROPORTIONAL SELECTION FIX:
        // The website query uses `.orderBy('website')` (required by Firestore for inequality)
        // which means website contacts aren't fetched in randomIndex order.
        // Bar profile queries use `.orderBy('randomIndex')` so they get low-randomIndex contacts.
        // When merged and sorted by randomIndex, bar profiles dominated (12:1 ratio).
        //
        // Fix: Sort each pool by randomIndex separately, then interleave proportionally
        // to ensure fair representation of both contact types.

        // Sort website contacts by their actual randomIndex (they arrive in website alphabetical order)
        const websiteDocs = [...withWebsiteSnapshot.docs].sort(
            (a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0)
        );

        // Bar profile docs are already sorted by randomIndex from the query
        const barProfileMap = new Map();
        [...notFoundSnapshot.docs, ...personalEmailSnapshot.docs].forEach(doc => {
            if (!barProfileMap.has(doc.id)) {
                barProfileMap.set(doc.id, doc);
            }
        });
        const barProfileDocs = Array.from(barProfileMap.values())
            .sort((a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0));

        // Proportional selection: 70/30 split favoring website contacts (3.3x higher visit rate)
        const websiteTarget = Math.ceil(BATCH_SIZE * 0.7);
        const barProfileTarget = Math.ceil(BATCH_SIZE * 0.3);
        const websiteSelection = websiteDocs.slice(0, websiteTarget);
        const barProfileSelection = barProfileDocs.slice(0, barProfileTarget);

        // Combine and sort by randomIndex for final ordering
        const contactMap = new Map();
        [...websiteSelection, ...barProfileSelection].forEach(doc => {
            if (!contactMap.has(doc.id)) {
                contactMap.set(doc.id, doc);
            }
        });
        let mergedDocs = Array.from(contactMap.values())
            .sort((a, b) => (a.data().randomIndex || 0) - (b.data().randomIndex || 0));

        console.log(`📊 Proportional selection (70/30 website/bar target):`);
        console.log(`   - Website selected: ${websiteSelection.length}`);
        console.log(`   - Bar profile selected: ${barProfileSelection.length}`);

        // Apply Yahoo/AOL filter if enabled
        if (EXCLUDE_YAHOO_AOL) {
            const before = mergedDocs.length;
            mergedDocs = mergedDocs.filter(doc => !isYahooAolEmail(doc.data().email));
            const filtered = before - mergedDocs.length;
            if (filtered > 0) {
                console.log(`🛡️  Excluded ${filtered} Yahoo/AOL emails (domain warming mode)`);
            }
        }

        // Take top BATCH_SIZE contacts by randomIndex (natural distribution)
        allDocs = mergedDocs.slice(0, BATCH_SIZE);

        const websiteCount = allDocs.filter(doc => doc.data().website && doc.data().website !== '').length;
        const barProfileCount = allDocs.length - websiteCount;
        console.log(`📊 Random selection (natural distribution):`);
        console.log(`   - Website contacts: ${websiteCount}`);
        console.log(`   - Bar profile contacts: ${barProfileCount}`);
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
    let leadsCreated = 0;

    for (const doc of allDocs) {
        const data = doc.data();
        const { firmName, email, website, firstName, lastName, practiceArea, state, barNumber, domainChecked, domainCheckResult } = data;

        // Validate contact data quality before processing
        const validation = validateContactData(data);
        if (!validation.valid) {
            console.log(`\n⚠️  Skipping ${email}: ${validation.issues.join(', ')}`);
            skipped++;

            // Mark as failed in Firestore (so we don't keep retrying)
            if (!TEST_EMAIL) {
                await doc.ref.update({
                    status: 'failed',
                    failReason: validation.issues.join('; '),
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
            let hasLead = false;
            let isBarProfile = isBarProfileContact;

            // Use test lead ID if this is from TEST_LEAD_ID mode
            if (data._isTestLead) {
                leadId = data._testLeadId;
                hasLead = true;
                console.log(`   🧪 Using existing lead: ${leadId}`);
            }
            // Create lead for tracking and conversion
            else {
                const leadResult = await createLeadForContact(data);
                if (leadResult.success) {
                    leadId = leadResult.leadId;
                    hasLead = true;
                    leadsCreated++;
                } else {
                    console.log(`   ⚠️ Lead creation failed: ${leadResult.error}`);
                    console.log(`   📧 Sending fallback email instead...`);
                }
            }

            // Generate subject, HTML, and plain-text versions
            const subject = generateSubject();
            const html = generateEmailHTML(displayFirmName, email, leadId, firstName);
            const text = generateEmailPlainText(displayFirmName, email, leadId, firstName);

            // Build Mailgun tags for analytics
            const mailgunTags = [];
            if (hasLead) {
                mailgunTags.push('with_lead');
                if (isBarProfile) {
                    mailgunTags.push('bar_profile');
                }
            } else {
                mailgunTags.push('no_lead');
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
                const templateVersion = 'v9-landing-page';

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

                // Add lead-related fields if lead was created
                if (hasLead) {
                    updateData.leadCreated = true;
                    updateData.preintakeLeadId = leadId;
                    updateData.leadCreatedAt = admin.firestore.FieldValue.serverTimestamp();
                    updateData.leadSource = isBarProfile ? 'bar_profile' : 'website';
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
    console.log(`   Leads created: ${leadsCreated}`);
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

    // Exit with error only if success rate drops below 90%
    const totalAttempted = sent + failed;
    const successRate = totalAttempted > 0 ? (sent / totalAttempted) : 1;
    const SUCCESS_THRESHOLD = 0.90;

    if (successRate < SUCCESS_THRESHOLD) {
        console.log(`\n❌ Success rate ${(successRate * 100).toFixed(1)}% is below ${SUCCESS_THRESHOLD * 100}% threshold - failing workflow`);
        process.exit(1);
    } else if (failed > 0) {
        console.log(`\n⚠️  ${failed} email(s) failed, but success rate ${(successRate * 100).toFixed(1)}% is above threshold - workflow passes`);
    }

    process.exit(0);
}

// Run campaign
runCampaign().catch(error => {
    console.error('❌ Campaign failed:', error);
    process.exit(1);
});
