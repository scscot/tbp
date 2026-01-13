#!/usr/bin/env node
/**
 * PreIntake.ai Email Campaign Sender (with Inline Demo Generation)
 *
 * Sends outreach emails to law firms from Firestore preintake_emails collection.
 * Generates personalized demos for each contact BEFORE sending the email.
 * Uses Dreamhost SMTP via nodemailer.
 *
 * SCHEDULE (PT Time Enforcement):
 *   - Days: Monday through Friday
 *   - Windows: 9:00-10:00am PT and 1:00-2:00pm PT
 *   - Automatically handles DST (script checks PT time, not UTC)
 *   - Exits cleanly with code 0 if outside allowed window
 *
 * Environment Variables:
 *   PREINTAKE_SMTP_USER - SMTP username (scott@legal.preintake.ai)
 *   PREINTAKE_SMTP_PASS - SMTP password
 *   ANTHROPIC_API_KEY - Anthropic API key for AI analysis
 *   BATCH_SIZE - Number of emails to send per run (default: 5)
 *   TEST_EMAIL - Override recipient for testing (won't mark as sent)
 *   SKIP_TIME_CHECK - Set to 'true' to bypass PT time window check
 *   SKIP_DEMO_GEN - Set to 'true' to skip demo generation (for testing email only)
 *
 * Usage:
 *   # Normal run (respects PT time window)
 *   PREINTAKE_SMTP_USER=xxx PREINTAKE_SMTP_PASS=xxx ANTHROPIC_API_KEY=xxx node scripts/send-preintake-campaign.js
 *
 *   # Force run outside time window (for testing)
 *   SKIP_TIME_CHECK=true PREINTAKE_SMTP_USER=xxx PREINTAKE_SMTP_PASS=xxx ANTHROPIC_API_KEY=xxx node scripts/send-preintake-campaign.js
 *
 *   # Test mode (sends to test email, doesn't update Firestore)
 *   TEST_EMAIL=test@example.com SKIP_TIME_CHECK=true ... node scripts/send-preintake-campaign.js
 */

const nodemailer = require('nodemailer');
const path = require('path');

// Import demo generation functions first
const { analyzeWebsite } = require('../functions/preintake-analysis-functions');
const { performDeepResearch } = require('../functions/deep-research-functions');
const { generateDemoFiles, uploadToStorage, initFirebaseAdmin } = require('../functions/demo-generator-functions');

// Initialize Firebase Admin using the functions' firebase-admin instance
// This ensures uploadToStorage uses the same initialized app
const serviceAccount = require('../secrets/serviceAccountKey.json');
const admin = initFirebaseAdmin(serviceAccount, 'teambuilder-plus-fe74d.firebasestorage.app');

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Configuration
const COLLECTION_NAME = 'preintake_emails';
const LEADS_COLLECTION = 'preintake_leads';
const FROM_ADDRESS = 'Stephen Scott <scott@legal.preintake.ai>';
const SMTP_HOST = 'smtp.dreamhost.com';
const SMTP_PORT = 587;
const SEND_DELAY_MS = 1000; // 1 second between emails
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');

// SMTP credentials from environment
const SMTP_USER = process.env.PREINTAKE_SMTP_USER;
const SMTP_PASS = process.env.PREINTAKE_SMTP_PASS;

// Anthropic API key (required for demo generation)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Test mode: override recipient email (does NOT mark as sent in Firestore)
const TEST_EMAIL = process.env.TEST_EMAIL || null;

// Skip time check (for manual testing)
const SKIP_TIME_CHECK = process.env.SKIP_TIME_CHECK === 'true';

// Skip demo generation (for testing email only)
const SKIP_DEMO_GEN = process.env.SKIP_DEMO_GEN === 'true';

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

    // Allowed days: Mon-Fri (1, 2, 3, 4, 5)
    const allowedDays = [1, 2, 3, 4, 5];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (!allowedDays.includes(day)) {
        return {
            allowed: false,
            reason: `${dayNames[day]} is outside allowed days (Mon-Fri)`,
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
        const leadData = {
            name: firmName,
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

        // Step 6: Save lead document with demo URL
        leadData.demoUrl = demoUrl;
        leadData['demo.generatedAt'] = admin.firestore.FieldValue.serverTimestamp();
        leadData['demo.version'] = '1.0.0';

        await db.collection(LEADS_COLLECTION).doc(leadId).set(leadData);

        return { success: true, leadId, demoUrl };

    } catch (error) {
        console.error(`   ❌ Demo generation failed: ${error.message}`);
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
    const demoUrl = `https://preintake.ai/?demo=${leadId}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `<p>Hello ${firstName},</p>\n\n      ` : '';

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
      <h1 style="color:#ffffff; font-size:24px; margin:0;">
        <span style="color:#ffffff;">Pre</span><span style="color:#c9a962;">Intake</span><span style="color:#ffffff;">.ai</span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="text-align:center; margin:0 0 16px 0;">
        <strong>Pre-Screen Every Inquiry — Tailored to Your Practice Area</strong>
      </p>

      ${greeting}<p>Many intake tools treat every inquiry the same. <strong>PreIntake.ai is different</strong>—it's configured specifically for your firm's practice areas, so the questions asked and criteria applied actually match the cases you take.</p>

      <p>Every inquiry is assessed and delivered with:</p>

      <ul style="color: #1a1a2e; padding-left: 20px;">
          <li>A case summary tailored to your practice area</li>
          <li>A qualification rating: <strong>qualified</strong>, <strong>needs review</strong>, or <strong>not a fit</strong></li>
          <li>A plain-English explanation of why</li>
      </ul>

      <p style="font-size: 14px; margin-top: 16px;">
          <strong style="color: #c9a962;">Zero Data Retention</strong> — Inquiry content is processed and delivered, not retained.
      </p>

      <p style="font-size: 14px; margin-top: 8px;">
          Embeds directly on your website — visitors never leave your site.
      </p>

      <p>Your staff reviews results—not raw submissions.</p>

      <p>We've prepared a demo tailored specifically to <strong>${firmName}</strong>:</p>

      <div style="text-align: center; margin: 30px 0;">
          <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">View Your Firm's Demo</a>
      </div>

      <p style="font-size: 14px; margin-top: 16px;">
          No commitment. Review it on your own — no calls required.
      </p>

      <p style="font-size: 14px; margin-top: 16px;">
          Not the right contact for intake? Feel free to forward — the demo link is specific to <strong>${firmName}</strong>.
      </p>

      <p style="margin-top: 20px;">
          Best,<br>
          <strong>Stephen Scott</strong><br>
          PreIntake.ai
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
 * Generate fallback email HTML (no personalized demo)
 */
function generateFallbackEmailHTML(firmName, email, firstName) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    // Include firmName in URL so landing page can display it (no #demo hash to prevent auto-scroll)
    const demoUrl = `https://preintake.ai/?firm=${encodeURIComponent(firmName)}&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    // Add greeting if firstName is available
    const greeting = firstName ? `<p>Hello ${firstName},</p>\n\n      ` : '';

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
      <h1 style="color:#ffffff; font-size:24px; margin:0;">
        <span style="color:#ffffff;">Pre</span><span style="color:#c9a962;">Intake</span><span style="color:#ffffff;">.ai</span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="text-align:center; margin:0 0 16px 0;">
        <strong>Pre-Screen Every Inquiry — Tailored to Your Practice Area</strong>
      </p>

      ${greeting}<p>Many intake tools treat every inquiry the same. <strong>PreIntake.ai is different</strong>—it's configured specifically for your firm's practice areas, so the questions asked and criteria applied actually match the cases you take.</p>

      <p>Every inquiry is assessed and delivered with:</p>

      <ul style="color: #1a1a2e; padding-left: 20px;">
          <li>A case summary tailored to your practice area</li>
          <li>A qualification rating: <strong>qualified</strong>, <strong>needs review</strong>, or <strong>not a fit</strong></li>
          <li>A plain-English explanation of why</li>
      </ul>

      <p style="font-size: 14px; margin-top: 16px;">
          <strong style="color: #c9a962;">Zero Data Retention</strong> — Inquiry content is processed and delivered, not retained.
      </p>

      <p style="font-size: 14px; margin-top: 8px;">
          Embeds directly on your website — visitors never leave your site.
      </p>

      <p>Your staff reviews results—not raw submissions.</p>

      <p>In under 5 minutes, view a custom intake demo built for <strong>${firmName}</strong>:</p>

      <div style="text-align: center; margin: 30px 0;">
          <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">Experience It Live</a>
      </div>

      <p style="font-size: 14px; margin-top: 16px;">
          No commitment. Review it on your own — no calls required.
      </p>

      <p style="font-size: 14px; margin-top: 16px;">
          Not the right contact for intake? Feel free to forward — the demo link is specific to <strong>${firmName}</strong>.
      </p>

      <p style="margin-top: 20px;">
          Best,<br>
          <strong>Stephen Scott</strong><br>
          PreIntake.ai
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

${greeting}Many intake tools treat every inquiry the same. PreIntake.ai is different—it's configured specifically for your firm's practice areas, so the questions asked and criteria applied actually match the cases you take.

Every inquiry is assessed and delivered with:

• A case summary tailored to your practice area
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero Data Retention — Inquiry content is processed and delivered, not retained.

Embeds directly on your website — visitors never leave your site.

Your staff reviews results—not raw submissions. No CRM changes required.

We've prepared a demo tailored specifically to ${firmName}:

View Your Firm's Demo: ${demoUrl}

No commitment. Review it on your own — no calls required.

Not the right contact for intake? Feel free to forward — the demo link is specific to ${firmName}.

Best,
Stephen Scott
PreIntake.ai

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

${greeting}Many intake tools treat every inquiry the same. PreIntake.ai is different—it's configured specifically for your firm's practice areas, so the questions asked and criteria applied actually match the cases you take.

Every inquiry is assessed and delivered with:

• A case summary tailored to your practice area
• A qualification rating: qualified, needs review, or not a fit
• A plain-English explanation of why

Zero Data Retention — Inquiry content is processed and delivered, not retained.

Embeds directly on your website — visitors never leave your site.

Your staff reviews results—not raw submissions.

In under 5 minutes, view a custom intake demo built for ${firmName}:

Experience It Live: ${demoUrl}

No commitment. Review it on your own — no calls required.

Not the right contact for intake? Feel free to forward — the demo link is specific to ${firmName}.

Best,
Stephen Scott
PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: ${unsubscribeUrl}`;
}

/**
 * Generate subject line
 * Different subjects for personalized demo vs fallback email
 */
function generateSubject(hasDemo) {
    // Same subject for both personalized and fallback emails
    return 'Pre-screen every inquiry before it reaches your team';
}

/**
 * Send email via SMTP (with HTML and plain-text versions)
 */
async function sendEmail(transporter, to, subject, htmlContent, textContent) {
    const mailOptions = {
        from: FROM_ADDRESS,
        to: to,
        subject: subject,
        html: htmlContent,
        text: textContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
}

/**
 * Main campaign function
 */
async function runCampaign() {
    console.log('📧 PreIntake.ai Email Campaign (with Demo Generation)');
    console.log('======================================================\n');

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
    if (!SMTP_USER || !SMTP_PASS) {
        console.error('❌ Missing SMTP credentials');
        console.error('   Set PREINTAKE_SMTP_USER and PREINTAKE_SMTP_PASS environment variables');
        process.exit(1);
    }

    if (!ANTHROPIC_API_KEY && !SKIP_DEMO_GEN) {
        console.error('❌ Missing ANTHROPIC_API_KEY');
        console.error('   Set ANTHROPIC_API_KEY environment variable for demo generation');
        console.error('   Or set SKIP_DEMO_GEN=true to skip demo generation');
        process.exit(1);
    }

    console.log(`📊 Configuration:`);
    console.log(`   SMTP Host: ${SMTP_HOST}:${SMTP_PORT}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Batch Size: ${BATCH_SIZE}`);
    console.log(`   Demo Generation: ${SKIP_DEMO_GEN ? 'DISABLED' : 'ENABLED'}`);
    if (TEST_EMAIL) {
        console.log(`   ⚠️  TEST MODE: All emails will be sent to ${TEST_EMAIL}`);
        console.log(`   ⚠️  Firestore records will NOT be marked as sent`);
    }
    console.log('');

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: false,
        requireTLS: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        },
        tls: {
            rejectUnauthorized: true
        }
    });

    // Verify connection
    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified\n');
    } catch (error) {
        console.error('❌ SMTP connection failed:', error.message);
        process.exit(1);
    }

    // Generate batch ID
    const batchId = `batch_${Date.now()}`;

    // Query unsent emails (excluding unsubscribed)
    // Prefer contacts with website URLs for demo generation
    const snapshot = await db.collection(COLLECTION_NAME)
        .where('sent', '==', false)
        .where('status', '==', 'pending')
        .orderBy('randomIndex')
        .limit(BATCH_SIZE)
        .get();

    if (snapshot.empty) {
        console.log('✅ No unsent emails found. Campaign complete!');
        process.exit(0);
    }

    console.log(`📤 Processing ${snapshot.size} emails in ${batchId}\n`);

    let sent = 0;
    let failed = 0;
    let demosGenerated = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const { firmName, email, website, firstName, lastName } = data;

        // Use test email if in test mode, otherwise use actual email
        const recipientEmail = TEST_EMAIL || email;

        // Format recipient with name: "First Last <email>" or "FirmName <email>"
        const recipientName = (firstName && lastName) ? `${firstName} ${lastName}` : firmName;
        const formattedRecipient = `${recipientName} <${recipientEmail}>`;

        try {
            console.log(`\n📧 Processing ${firmName} (${recipientEmail})...`);

            let leadId = null;
            let demoUrl = null;
            let hasDemo = false;

            // Generate demo if we have a website URL and demo gen is enabled
            if (website && !SKIP_DEMO_GEN) {
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
            } else if (!website) {
                console.log(`   ⚠️ No website URL - sending fallback email`);
            } else if (SKIP_DEMO_GEN) {
                console.log(`   ⚠️ Demo generation disabled - sending fallback email`);
            }

            // Generate subject, HTML, and plain-text versions
            const subject = generateSubject(hasDemo);
            const html = hasDemo
                ? generateEmailHTML(firmName, email, leadId, firstName)
                : generateFallbackEmailHTML(firmName, email, firstName);
            const text = hasDemo
                ? generateEmailPlainText(firmName, email, leadId, firstName)
                : generateFallbackEmailPlainText(firmName, email, firstName);

            // Send email (with both HTML and plain-text)
            console.log(`   📤 Sending email to: ${formattedRecipient}`);
            const result = await sendEmail(
                transporter,
                formattedRecipient,
                subject,
                html,
                text
            );

            // Only update Firestore if NOT in test mode
            if (!TEST_EMAIL) {
                const updateData = {
                    sent: true,
                    sentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    batchId: batchId,
                    errorMessage: '',
                    messageId: result.messageId || '',
                    subjectLine: subject,
                    templateVersion: hasDemo ? 'v6-personalized-demo' : 'v6-generic'
                };

                // Add demo-related fields if demo was generated
                if (hasDemo) {
                    updateData.demoGenerated = true;
                    updateData.demoUrl = demoUrl;
                    updateData.preintakeLeadId = leadId;
                    updateData.demoGeneratedAt = admin.firestore.FieldValue.serverTimestamp();
                }

                await doc.ref.update(updateData);
            }

            console.log(`   ✅ Sent to ${recipientEmail} - ${result.messageId}`);
            sent++;

            // Delay between sends
            if (sent < snapshot.size) {
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
    console.log(`   Total processed: ${snapshot.size}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Demos generated: ${demosGenerated}`);
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
