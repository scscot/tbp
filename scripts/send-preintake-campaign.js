#!/usr/bin/env node
/**
 * PreIntake.ai Email Campaign Sender
 *
 * Sends outreach emails to law firms from Firestore preintake_emails collection.
 * Uses Dreamhost SMTP via nodemailer.
 *
 * SCHEDULE (PT Time Enforcement):
 *   - Days: Tuesday, Wednesday, Thursday only
 *   - Windows: 9:00-9:30am PT and 1:30-2:00pm PT
 *   - Automatically handles DST (script checks PT time, not UTC)
 *   - Exits cleanly with code 0 if outside allowed window
 *
 * Environment Variables:
 *   PREINTAKE_SMTP_USER - SMTP username (scott@legal.preintake.ai)
 *   PREINTAKE_SMTP_PASS - SMTP password
 *   BATCH_SIZE - Number of emails to send per run (default: 5)
 *   TEST_EMAIL - Override recipient for testing (won't mark as sent)
 *   SKIP_TIME_CHECK - Set to 'true' to bypass PT time window check
 *
 * Usage:
 *   # Normal run (respects PT time window)
 *   PREINTAKE_SMTP_USER=xxx PREINTAKE_SMTP_PASS=xxx node scripts/send-preintake-campaign.js
 *
 *   # Force run outside time window (for testing)
 *   SKIP_TIME_CHECK=true PREINTAKE_SMTP_USER=xxx PREINTAKE_SMTP_PASS=xxx node scripts/send-preintake-campaign.js
 *
 *   # Test mode (sends to test email, doesn't update Firestore)
 *   TEST_EMAIL=test@example.com SKIP_TIME_CHECK=true ... node scripts/send-preintake-campaign.js
 */

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Configuration
const COLLECTION_NAME = 'preintake_emails';
const FROM_ADDRESS = 'Stephen Scott <scott@legal.preintake.ai>';
const SMTP_HOST = 'smtp.dreamhost.com';
const SMTP_PORT = 587;
const SEND_DELAY_MS = 1000; // 1 second between emails
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');

// SMTP credentials from environment
const SMTP_USER = process.env.PREINTAKE_SMTP_USER;
const SMTP_PASS = process.env.PREINTAKE_SMTP_PASS;

// Test mode: override recipient email (does NOT mark as sent in Firestore)
const TEST_EMAIL = process.env.TEST_EMAIL || null;

// Skip time check (for manual testing)
const SKIP_TIME_CHECK = process.env.SKIP_TIME_CHECK === 'true';

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

    // Allowed days: Tue-Thu (2, 3, 4)
    const allowedDays = [2, 3, 4];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (!allowedDays.includes(day)) {
        return {
            allowed: false,
            reason: `${dayNames[day]} is outside allowed days (Tue-Thu)`,
            ptTime: ptTimeStr
        };
    }

    // Allowed windows: 9:00-9:30am PT and 1:30-2:00pm PT
    // Window 1: 9:00am - 9:30am (540-570 minutes)
    // Window 2: 1:30pm - 2:00pm (810-840 minutes)
    const window1Start = 9 * 60;      // 9:00am = 540
    const window1End = 9 * 60 + 30;   // 9:30am = 570
    const window2Start = 13 * 60 + 30; // 1:30pm = 810
    const window2End = 14 * 60;        // 2:00pm = 840

    const inWindow1 = timeInMinutes >= window1Start && timeInMinutes < window1End;
    const inWindow2 = timeInMinutes >= window2Start && timeInMinutes < window2End;

    if (!inWindow1 && !inWindow2) {
        return {
            allowed: false,
            reason: `${hour}:${minute.toString().padStart(2, '0')} PT is outside allowed windows (9:00-9:30am, 1:30-2:00pm)`,
            ptTime: ptTimeStr
        };
    }

    return {
        allowed: true,
        reason: inWindow1 ? 'Morning window (9:00-9:30am PT)' : 'Afternoon window (1:30-2:00pm PT)',
        ptTime: ptTimeStr
    };
}

/**
 * Generate outreach email HTML
 * Generic template that works for any practice area
 */
function generateEmailHTML(firmName, email) {
    const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(email)}`;
    const demoUrl = `https://preintake.ai/?utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button`;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <!-- Preview text (hidden) -->
    <div style="display: none; max-height: 0; overflow: hidden;">
        How law firms reduce unqualified consultations without hiring more staff.
    </div>

    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
            <span style="color: #ffffff;">Pre</span><span style="color: #c9a962;">Intake</span><span style="color: #ffffff;">.ai</span>
        </h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p>Hi there,</p>

        <p>Most law practices spend a surprising amount of staff time
        reviewing inquiries that were never a fit to begin with.
        Those dead-end intakes quietly add cost, distraction, and delay — especially when good cases
        are mixed in with the noise.</p>

        <p><strong>PreIntake.ai</strong> screens prospective clients before they reach your team,
        so staff time is spent reviewing cases that already meet your criteria.</p>

        <ul style="color: #1a1a2e; padding-left: 20px;">
            <li>Screens inquiries using practice-specific criteria</li>
            <li>Designates each inquiry as <strong>qualified</strong>, <strong>needs review</strong>, or <strong>not a fit</strong></li>
            <li>Provides a short, plain-English explanation with each result</li>
        </ul>

        <p>Firms typically use this to reduce unproductive intake work
        and surface viable cases faster — without changing their CRM or existing workflow.</p>

        <p>We can generate a demo tailored specifically to <strong>${firmName}</strong>.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${demoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">Generate a Demo for Your Practice</a>
        </div>

        <p style="margin-top: 16px; color: #64748b; font-size: 14px;">
            No commitment. Review it on your own — no calls required.
        </p>

        <p style="margin-top: 20px;">
            Best,<br>
            <strong>Stephen Scott</strong><br>
            PreIntake.ai
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
        <p style="margin: 15px 0 0 0;">
            <a href="${unsubscribeUrl}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a>
        </p>
    </div>
</body>
</html>`;
}

/**
 * Generate subject line
 */
function generateSubject() {
    return 'A smarter way to screen intake inquiries before staff review';
}

/**
 * Send email via SMTP
 */
async function sendEmail(transporter, to, subject, htmlContent) {
    const mailOptions = {
        from: FROM_ADDRESS,
        to: to,
        subject: subject,
        html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
}

/**
 * Main campaign function
 */
async function runCampaign() {
    console.log('📧 PreIntake.ai Email Campaign');
    console.log('================================\n');

    // Check PT business window (unless bypassed)
    if (!SKIP_TIME_CHECK) {
        const timeCheck = checkPTBusinessWindow();
        console.log(`🕐 Current PT Time: ${timeCheck.ptTime}`);

        if (!timeCheck.allowed) {
            console.log(`⏭️  Skipping: ${timeCheck.reason}`);
            console.log('   Allowed: Tue-Thu, 9:00-9:30am PT and 1:30-2:00pm PT');
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

    console.log(`📊 Configuration:`);
    console.log(`   SMTP Host: ${SMTP_HOST}:${SMTP_PORT}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Batch Size: ${BATCH_SIZE}`);
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
            rejectUnauthorized: false
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

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const { firmName, email } = data;

        // Use test email if in test mode, otherwise use actual email
        const recipientEmail = TEST_EMAIL || email;

        try {
            console.log(`📧 Sending to ${recipientEmail}${TEST_EMAIL ? ` (testing with data from ${email})` : ''}...`);

            // Generate subject and email HTML
            const subject = generateSubject();
            const html = generateEmailHTML(firmName, email);

            // Send email
            const result = await sendEmail(
                transporter,
                recipientEmail,
                subject,
                html
            );

            // Only update Firestore if NOT in test mode
            if (!TEST_EMAIL) {
                await doc.ref.update({
                    sent: true,
                    sentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'sent',
                    batchId: batchId,
                    errorMessage: '',
                    messageId: result.messageId || '',
                    subjectLine: subject,
                    templateVersion: 'v4-generic'
                });
            }

            console.log(`   ✅ Sent to ${recipientEmail} - ${result.messageId}`);
            sent++;

            // Delay between sends
            if (sent < snapshot.size) {
                await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
            }

        } catch (error) {
            console.error(`   ❌ Failed to send to ${recipientEmail}: ${error.message}`);

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
