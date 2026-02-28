#!/usr/bin/env node
/**
 * PreIntake Email Delivery Monitoring Script
 *
 * Sends a test email via Mailgun API (same as campaign), then uses Gmail API
 * to verify inbox placement. If the email lands in the junk folder, the campaign is
 * automatically disabled and an alert is sent.
 *
 * This is a self-contained script that mirrors the email sending pattern
 * from send-preintake-campaign.js to ensure test emails match production.
 *
 * Usage:
 *   node scripts/preintake-spam-monitor.js
 *
 * Environment Variables Required:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Firebase service account JSON
 *   MAILGUN_API_KEY - Mailgun API key (for sending test email and alerts)
 *   GMAIL_OAUTH_CREDENTIALS - OAuth client credentials JSON
 *   GMAIL_OAUTH_TOKEN - OAuth refresh token JSON
 *
 * GitHub Actions Schedule: Daily at 7:00 AM PT (15:00 UTC)
 */

const admin = require('firebase-admin');
const { google } = require('googleapis');
const axios = require('axios');
const FormData = require('form-data');

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEST_EMAIL = 'scscot@gmail.com';
const TEST_RECIPIENT_NAME = 'Stephen Scott';
const ALERT_EMAIL = 'scscot@gmail.com';
const MAILGUN_DOMAIN = 'law.preintake.ai';
const FROM_ADDRESS = 'Stephen Scott <stephen@law.preintake.ai>';
const SUBJECT = 'Pre-screen every inquiry before it reaches you';
const CHECK_DELAY_MS = 3 * 60 * 1000; // 3 minutes (Gmail typically delivers in 1-2 min)

// =============================================================================
// TEST EMAIL CONTENT
// =============================================================================

// Firm name for the email template (realistic name to avoid spam triggers)
const TEST_FIRM_NAME = 'Scott Law Group';

/**
 * Generate test email HTML content
 * IDENTICAL to generateEmailHTML() in send-preintake-campaign.js
 * to ensure testing reflects actual campaign emails
 */
function generateTestEmailHtml() {
  const ctaUrl = 'https://preintake.ai/?lead=delivery_test&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button';
  const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(TEST_EMAIL)}`;
  const firstName = TEST_RECIPIENT_NAME.split(' ')[0];

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
      <p style="font-size: 16px;">Hello ${firstName},</p>

      <p style="font-size: 16px;">Most law firms treat intake as data collection. It's not. It's triage. And without structured screening, your strongest matters are competing for attention with submissions that should never reach your desk.</p>

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
 * Generate test email plain text content
 * IDENTICAL to generateEmailPlainText() in send-preintake-campaign.js
 */
function generateTestEmailText() {
  const ctaUrl = 'https://preintake.ai/?lead=delivery_test&utm_source=email&utm_medium=outreach&utm_campaign=law_firms&utm_content=cta_button';
  const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(TEST_EMAIL)}`;
  const firstName = TEST_RECIPIENT_NAME.split(' ')[0];

  return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

Hello ${firstName},

Most law firms treat intake as data collection. It's not. It's triage. And without structured screening, your strongest matters are competing for attention with submissions that should never reach your desk.

PreIntake.ai puts practice-specific screening in front of your intake workflow, so the best matters rise to the top immediately—before your team spends time reading raw narratives and chasing missing details.

Instead of reviewing submissions in the order they arrive, you receive a clear case summary, a simple qualification rating (qualified / needs review / not a fit), and a plain-English rationale—so staff can move fast, and attorneys see what matters first.

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

// =============================================================================
// GMAIL API CLIENT
// =============================================================================

async function getGmailClient() {
  const credentialsJson = process.env.GMAIL_OAUTH_CREDENTIALS;
  const tokenJson = process.env.GMAIL_OAUTH_TOKEN;

  if (!credentialsJson || !tokenJson) {
    throw new Error('Gmail OAuth credentials not configured. Set GMAIL_OAUTH_CREDENTIALS and GMAIL_OAUTH_TOKEN.');
  }

  const credentials = JSON.parse(credentialsJson);
  const tokens = JSON.parse(tokenJson);

  const { client_secret, client_id } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3000/oauth2callback'
  );

  oauth2Client.setCredentials(tokens);

  // Handle token refresh
  oauth2Client.on('tokens', (newTokens) => {
    console.log('Gmail tokens refreshed');
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =============================================================================
// SEND TEST EMAIL VIA MAILGUN
// =============================================================================

async function sendTestEmail() {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY not configured');
  }

  const fullSubject = SUBJECT;
  const htmlContent = generateTestEmailHtml();
  const textContent = generateTestEmailText();

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${TEST_RECIPIENT_NAME} <${TEST_EMAIL}>`);
  form.append('subject', fullSubject);
  form.append('html', htmlContent);
  form.append('text', textContent);

  // Disable Mailgun tracking (matching campaign settings)
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for identification
  form.append('o:tag', 'delivery');

  console.log(`Sending test email to ${TEST_EMAIL}...`);
  console.log(`Subject: ${fullSubject}`);

  const response = await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    }
  );

  console.log(`Test email sent. Message ID: ${response.data.id}`);

  return {
    success: true,
    messageId: response.data.id,
    subject: fullSubject
  };
}

// =============================================================================
// CHECK EMAIL PLACEMENT
// =============================================================================

async function checkEmailPlacement(gmail, subject) {
  // Search with from: and newer_than: filters for precision
  const baseQuery = `subject:"${subject}" from:stephen@law.preintake.ai newer_than:1d`;

  // Search in INBOX
  const inboxResponse = await gmail.users.messages.list({
    userId: 'me',
    q: `${baseQuery} in:inbox`,
    maxResults: 1
  });

  // Search in SPAM
  const spamResponse = await gmail.users.messages.list({
    userId: 'me',
    q: `${baseQuery} in:spam`,
    maxResults: 1
  });

  const inInbox = inboxResponse.data.messages && inboxResponse.data.messages.length > 0;
  const inSpam = spamResponse.data.messages && spamResponse.data.messages.length > 0;

  if (inSpam) {
    return 'spam';
  } else if (inInbox) {
    return 'inbox';
  } else {
    return 'not_found';
  }
}

// =============================================================================
// DISABLE CAMPAIGN
// =============================================================================

async function disableCampaign() {
  const configRef = db.collection('config').doc('emailCampaign');

  await db.runTransaction(async (transaction) => {
    const configDoc = await transaction.get(configRef);

    if (!configDoc.exists) {
      throw new Error('config/emailCampaign document does not exist');
    }

    const data = configDoc.data();
    const currentValue = data.preintakeBatchSize || 0;

    // Only update if not already disabled
    if (currentValue > 0) {
      transaction.update(configRef, {
        preintakeBatchSize: 0,
        preintakeBatchSize_disabled_at: admin.firestore.FieldValue.serverTimestamp(),
        preintakeBatchSize_previous_value: currentValue,
        preintakeBatchSize_disabled_reason: 'junk_folder_detected'
      });
      console.log(`Disabled PreIntake campaign (previous batch size: ${currentValue})`);
    } else {
      console.log('PreIntake campaign already disabled (batch size is 0)');
    }
  });
}

// =============================================================================
// SEND ALERT EMAIL
// =============================================================================

async function sendAlertEmail(subject, placement) {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    console.error('MAILGUN_API_KEY not configured - cannot send alert');
    return;
  }

  const alertSubject = 'PreIntake campaign disabled - delivery issue';

  const html = `
    <h2>PreIntake Email Monitor Alert</h2>
    <p>The test email was detected in the <strong style="color: red;">junk folder</strong>. The PreIntake campaign has been <strong>disabled</strong>.</p>

    <h3>Details</h3>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <tr>
        <td><strong>Test Subject</strong></td>
        <td>${subject}</td>
      </tr>
      <tr>
        <td><strong>Placement</strong></td>
        <td style="background-color: #ffcccc;">Junk Folder</td>
      </tr>
      <tr>
        <td><strong>Action Taken</strong></td>
        <td>preintakeBatchSize set to 0</td>
      </tr>
    </table>

    <h3>How to Re-enable</h3>
    <p>After resolving the delivery issue:</p>
    <ol>
      <li>Go to Firebase Console > Firestore > config > emailCampaign</li>
      <li>Set <code>preintakeBatchSize</code> to the previous value (stored in <code>preintakeBatchSize_previous_value</code>)</li>
      <li>Delete the <code>preintakeBatchSize_disabled_*</code> fields</li>
    </ol>

    <p style="color: #666; font-size: 12px;">
      This alert was generated by the PreIntake delivery monitoring system at ${new Date().toISOString()}
    </p>
  `;

  const text = `PREINTAKE EMAIL MONITOR ALERT

The test email was detected in the junk folder. The PreIntake campaign has been DISABLED.

Test Subject: ${subject}
Placement: Junk Folder
Action Taken: preintakeBatchSize set to 0

To re-enable, update preintakeBatchSize in Firestore config/emailCampaign.

Generated at ${new Date().toISOString()}`;

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', ALERT_EMAIL);
  form.append('subject', alertSubject);
  form.append('html', html);
  form.append('text', text);
  form.append('o:tag', 'preintake_delivery_alert');

  await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    }
  );

  console.log(`Alert email sent to ${ALERT_EMAIL}`);
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('=== PreIntake Email Delivery Monitor ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Target: ${TEST_EMAIL}`);
  console.log(`Domain: ${MAILGUN_DOMAIN}\n`);

  // Step 1: Send test email
  console.log('Step 1: Sending test email...\n');

  let sentEmail;
  try {
    sentEmail = await sendTestEmail();
    console.log(`\nTest email sent successfully`);
  } catch (error) {
    console.error('Failed to send test email:', error.message);
    process.exit(1);
  }

  // Step 2: Wait for email delivery
  console.log(`\nStep 2: Waiting ${CHECK_DELAY_MS / 1000} seconds for delivery...\n`);
  await new Promise(resolve => setTimeout(resolve, CHECK_DELAY_MS));

  // Step 3: Check Gmail for placement
  console.log('Step 3: Checking email placement...\n');

  let placement;
  try {
    const gmail = await getGmailClient();
    placement = await checkEmailPlacement(gmail, sentEmail.subject);
    console.log(`Email placement: ${placement.toUpperCase()}`);
  } catch (error) {
    console.error('Failed to check email placement:', error.message);
    process.exit(1);
  }

  // Step 4: Take action based on placement
  if (placement === 'spam') {
    console.log('\nJUNK FOLDER DETECTED: Disabling PreIntake campaign...\n');
    try {
      await disableCampaign();
    } catch (error) {
      console.error('Failed to disable campaign:', error.message);
    }

    console.log('Sending alert email...\n');
    try {
      await sendAlertEmail(sentEmail.subject, placement);
    } catch (error) {
      console.error('Failed to send alert email:', error.message);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Subject: ${sentEmail.subject}`);
  console.log(`Placement: ${placement.toUpperCase()}`);

  if (placement === 'spam') {
    console.log('Status: CAMPAIGN DISABLED');
    process.exit(1); // Non-zero exit for GitHub Actions visibility
  } else if (placement === 'inbox') {
    console.log('Status: PASSED');
  } else {
    console.log('Status: EMAIL NOT FOUND (may need more time)');
    // Don't fail on not_found - could be temporary delay
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
