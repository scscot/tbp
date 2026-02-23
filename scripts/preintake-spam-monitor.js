#!/usr/bin/env node
/**
 * PreIntake Email Spam Monitoring Script
 *
 * Sends a test email via Mailgun API (same as campaign), then uses Gmail API
 * to verify inbox placement. If the email lands in spam, the campaign is
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

/**
 * Generate test email HTML content
 * Simplified version of bar profile email for spam testing
 */
function generateTestEmailHtml(subjectSuffix) {
  const testDemoUrl = 'https://preintake.ai/demo/?demo=spam_test';
  const unsubscribeUrl = `https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(TEST_EMAIL)}`;

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PreIntake.ai</title>
</head>
<body style="margin:0; padding:0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0c1f3f; color: #e5e7eb;">
    <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
      <p style="font-size: 16px; margin-top: 0;">
          <span style="color: #c9a962; font-weight: 600; font-size: 24px;">PreIntake.ai</span><br>
          <span style="color: #94a3b8; font-size: 14px;">Pre-Screen Every Inquiry — Tailored to Your Practice Area</span>
      </p>

      <p style="font-size: 16px; margin-top: 30px;">Hello ${TEST_RECIPIENT_NAME},</p>

      <p style="font-size: 16px;">This is a <strong>spam monitoring test email</strong> sent at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT ${subjectSuffix || ''}.</p>

      <p style="font-size: 16px;">PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before you ever review them.</p>

      <div style="text-align: center; margin: 20px 0 30px 0;">
          <a href="${testDemoUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8944f 100%); color: #0c1f3f; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">View Demo</a>
      </div>

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
 */
function generateTestEmailText(subjectSuffix) {
  return `PreIntake.ai
Pre-Screen Every Inquiry — Tailored to Your Practice Area

Hello ${TEST_RECIPIENT_NAME},

This is a SPAM MONITORING TEST EMAIL sent at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT ${subjectSuffix || ''}.

PreIntake.ai ensures your most important matters surface immediately—screened, summarized, and prioritized before you ever review them.

View Demo: https://preintake.ai/demo/?demo=spam_test

Best,
Stephen Scott
Founder, PreIntake.ai

---
PreIntake.ai · Los Angeles, California
Unsubscribe: https://preintake.ai/unsubscribe.html?email=${encodeURIComponent(TEST_EMAIL)}`;
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

async function sendTestEmail(subjectSuffix) {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY not configured');
  }

  const fullSubject = subjectSuffix ? `${SUBJECT} ${subjectSuffix}` : SUBJECT;
  const htmlContent = generateTestEmailHtml(subjectSuffix);
  const textContent = generateTestEmailText(subjectSuffix);

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
  form.append('o:tag', 'preintake_spam_test');
  form.append('o:tag', 'delivery_check');

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
        preintakeBatchSize_disabled_reason: 'spam_detected'
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

  const alertSubject = 'SPAM ALERT: PreIntake campaign disabled';

  const html = `
    <h2>PreIntake Email Spam Monitor Alert</h2>
    <p>The test email was detected in the <strong style="color: red;">SPAM</strong> folder. The PreIntake campaign has been <strong>disabled</strong>.</p>

    <h3>Details</h3>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <tr>
        <td><strong>Test Subject</strong></td>
        <td>${subject}</td>
      </tr>
      <tr>
        <td><strong>Placement</strong></td>
        <td style="background-color: #ffcccc;">SPAM</td>
      </tr>
      <tr>
        <td><strong>Action Taken</strong></td>
        <td>preintakeBatchSize set to 0</td>
      </tr>
    </table>

    <h3>How to Re-enable</h3>
    <p>After resolving the spam issue:</p>
    <ol>
      <li>Go to Firebase Console > Firestore > config > emailCampaign</li>
      <li>Set <code>preintakeBatchSize</code> to the previous value (stored in <code>preintakeBatchSize_previous_value</code>)</li>
      <li>Delete the <code>preintakeBatchSize_disabled_*</code> fields</li>
    </ol>

    <p style="color: #666; font-size: 12px;">
      This alert was generated by the PreIntake spam monitoring system at ${new Date().toISOString()}
    </p>
  `;

  const text = `PREINTAKE EMAIL SPAM MONITOR ALERT

The test email was detected in the SPAM folder. The PreIntake campaign has been DISABLED.

Test Subject: ${subject}
Placement: SPAM
Action Taken: preintakeBatchSize set to 0

To re-enable, update preintakeBatchSize in Firestore config/emailCampaign.

Generated at ${new Date().toISOString()}`;

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', ALERT_EMAIL);
  form.append('subject', alertSubject);
  form.append('html', html);
  form.append('text', text);
  form.append('o:tag', 'preintake_spam_alert');

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
  console.log('=== PreIntake Email Spam Monitor ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Target: ${TEST_EMAIL}`);
  console.log(`Domain: ${MAILGUN_DOMAIN}\n`);

  // Generate date suffix for Gmail search accuracy
  const dateSuffix = `(${new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })})`;

  // Step 1: Send test email
  console.log('Step 1: Sending test email...\n');

  let sentEmail;
  try {
    sentEmail = await sendTestEmail(dateSuffix);
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
    console.log('\nSPAM DETECTED: Disabling PreIntake campaign...\n');
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
