/**
 * Email Spam Monitoring Script
 *
 * Calls the testPaparazziEmail Cloud Function endpoint to send test emails,
 * then uses Gmail API to verify inbox placement. If any email lands
 * in spam, all campaigns are automatically disabled and an alert is sent.
 *
 * This approach ensures we test the ACTUAL campaign email-sending code,
 * not a separate implementation that could drift over time.
 *
 * Usage:
 *   node scripts/spam-monitor.js
 *
 * Environment Variables Required:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Firebase service account JSON
 *   MAILGUN_API_KEY - Mailgun API key (for sending alerts only)
 *   GMAIL_OAUTH_CREDENTIALS - OAuth client credentials JSON
 *   GMAIL_OAUTH_TOKEN - OAuth refresh token JSON
 *
 * GitHub Actions Schedule: Daily at 6:00 AM PT (14:00 UTC)
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
const ALERT_EMAIL = 'scscot@gmail.com';
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const CHECK_DELAY_MS = 3 * 60 * 1000; // 3 minutes (Gmail typically delivers in 1-2 min)

// Cloud Function endpoint URL
const TEST_ENDPOINT = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/testPaparazziEmail';

// Variants to test - covers both subjects and both template versions
// v9a: "AI is changing how teams grow" (v9 template)
// v10b: "Your AI-powered recruiting assistant" (v10 template)
const VARIANTS_TO_TEST = ['v9a', 'v10b'];

// Map variant to human-readable campaign name for reporting
const VARIANT_NAMES = {
  v9a: 'Template V9 (AI changing)',
  v9b: 'Template V9 (AI assistant)',
  v10a: 'Template V10 (AI changing)',
  v10b: 'Template V10 (AI assistant)'
};

// All campaigns to disable if spam is detected
const ALL_BATCH_SIZE_FIELDS = ['batchSize', 'batchSizePurchased', 'batchSizeBfh', 'batchSizePaparazzi', 'batchSizeFsr', 'batchSizeZinzino'];

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
// SEND TEST EMAILS VIA CLOUD FUNCTION
// =============================================================================

async function sendTestEmailsViaEndpoint(subjectSuffix) {
  console.log(`Calling testPaparazziEmail endpoint...`);
  console.log(`Variants: ${VARIANTS_TO_TEST.join(', ')}`);
  console.log(`Subject suffix: "${subjectSuffix}"`);

  const response = await axios.post(TEST_ENDPOINT, {
    email: TEST_EMAIL,
    variants: VARIANTS_TO_TEST,
    subjectSuffix: subjectSuffix
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  if (!response.data.success) {
    throw new Error(`Endpoint returned failure: ${JSON.stringify(response.data)}`);
  }

  console.log(`Endpoint response: ${response.data.summary.sent} sent, ${response.data.summary.failed} failed`);

  // Transform endpoint results to format expected by rest of script
  return response.data.results.map(r => ({
    campaign: VARIANT_NAMES[r.variant] || r.variant,
    variant: r.variant,
    subject: r.subject,
    messageId: r.messageId,
    success: r.success,
    error: r.error
  }));
}

// =============================================================================
// CHECK EMAIL PLACEMENT
// =============================================================================

async function checkEmailPlacement(gmail, subject) {
  // Search with from: and newer_than: filters for precision
  const baseQuery = `subject:"${subject}" from:stephen@news.teambuildpro.com newer_than:1d`;

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
// DISABLE CAMPAIGNS
// =============================================================================

async function disableAllCampaigns(triggeringVariant) {
  const configRef = db.collection('config').doc('emailCampaign');

  await db.runTransaction(async (transaction) => {
    const configDoc = await transaction.get(configRef);

    if (!configDoc.exists) {
      throw new Error('config/emailCampaign document does not exist');
    }

    const data = configDoc.data();
    const updateData = {};

    // Disable all campaigns
    for (const field of ALL_BATCH_SIZE_FIELDS) {
      const currentValue = data[field] || 0;

      // Only update if not already disabled
      if (currentValue > 0) {
        updateData[field] = 0;
        updateData[`${field}_disabled_at`] = admin.firestore.FieldValue.serverTimestamp();
        updateData[`${field}_previous_value`] = currentValue;
        updateData[`${field}_disabled_reason`] = `spam_detected_via_${triggeringVariant}`;
      }
    }

    if (Object.keys(updateData).length > 0) {
      transaction.update(configRef, updateData);
    }
  });

  console.log(`Disabled ALL campaigns due to spam detected in ${triggeringVariant}`);
}

// =============================================================================
// SEND ALERT EMAIL (via Mailgun)
// =============================================================================

async function sendAlertEmail(results) {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    console.error('MAILGUN_API_KEY not configured - cannot send alert');
    return;
  }

  // Build email content
  const spamResults = results.filter(r => r.placement === 'spam');
  const allResults = results.map(r =>
    `${r.campaign}: ${r.placement.toUpperCase()} ${r.placement === 'spam' ? '(DISABLED)' : ''}`
  ).join('\n');

  const subject = `SPAM ALERT: ${spamResults.map(c => c.campaign).join(', ')} disabled`;

  const html = `
    <h2>Email Spam Monitor Alert</h2>
    <p>The following test email(s) were detected in the spam folder. <strong>ALL campaigns have been disabled.</strong></p>
    <ul>
      ${spamResults.map(c => `<li><strong>${c.campaign}</strong> - Subject: "${c.subject}"</li>`).join('')}
    </ul>

    <h3>Full Results</h3>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <tr style="background-color: #f0f0f0;">
        <th>Variant</th>
        <th>Subject</th>
        <th>Placement</th>
        <th>Status</th>
      </tr>
      ${results.map(r => `
        <tr style="background-color: ${r.placement === 'spam' ? '#ffcccc' : r.placement === 'inbox' ? '#ccffcc' : '#ffffcc'};">
          <td>${r.campaign}</td>
          <td>${r.subject || 'N/A'}</td>
          <td>${r.placement.toUpperCase()}</td>
          <td>${r.placement === 'spam' ? 'DISABLED' : 'OK'}</td>
        </tr>
      `).join('')}
    </table>

    <h3>How to Re-enable</h3>
    <p>To re-enable campaigns after resolving spam issues:</p>
    <ol>
      <li>Go to Firestore Console > config > emailCampaign</li>
      <li>Set each batch size field to the previous value (stored in *_previous_value)</li>
      <li>Delete the *_disabled_at, *_previous_value, and *_disabled_reason fields</li>
    </ol>

    <p style="color: #666; font-size: 12px;">
      This alert was generated by the spam monitoring system at ${new Date().toISOString()}<br>
      Test emails sent via testPaparazziEmail Cloud Function endpoint.
    </p>
  `;

  const text = `EMAIL SPAM MONITOR ALERT

The following test emails were detected in spam. ALL campaigns have been disabled:
${spamResults.map(c => `- ${c.campaign}: "${c.subject}"`).join('\n')}

Full Results:
${allResults}

To re-enable, update the batch sizes in Firestore config/emailCampaign.

Generated at ${new Date().toISOString()}`;

  // Send via Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', ALERT_EMAIL);
  form.append('subject', subject);
  form.append('html', html);
  form.append('text', text);
  form.append('o:tag', 'spam_alert');

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
  console.log('=== Email Spam Monitor ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Target: ${TEST_EMAIL}`);
  console.log(`Method: testPaparazziEmail Cloud Function endpoint\n`);

  const results = [];

  // Generate date suffix for Gmail search accuracy
  const dateSuffix = `(${new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })})`;

  // Step 1: Send test emails via Cloud Function endpoint
  console.log('Step 1: Sending test emails via endpoint...\n');

  let sentEmails = [];
  try {
    sentEmails = await sendTestEmailsViaEndpoint(dateSuffix);
    console.log(`\nSent ${sentEmails.length} test email(s)`);

    // Check for any send failures
    const failures = sentEmails.filter(e => !e.success);
    if (failures.length > 0) {
      for (const f of failures) {
        console.error(`Send failed for ${f.variant}: ${f.error}`);
        results.push({
          campaign: f.campaign,
          placement: 'send_failed',
          error: f.error
        });
      }
    }

    // Filter to only successful sends for Gmail checking
    sentEmails = sentEmails.filter(e => e.success);
  } catch (error) {
    console.error('Failed to send test emails via endpoint:', error.message);
    process.exit(1);
  }

  if (sentEmails.length === 0) {
    console.error('\nNo test emails were sent successfully. Exiting.');
    process.exit(1);
  }

  // Step 2: Wait for emails to be delivered
  console.log(`\nStep 2: Waiting ${CHECK_DELAY_MS / 1000} seconds for delivery...\n`);
  await new Promise(resolve => setTimeout(resolve, CHECK_DELAY_MS));

  // Step 3: Check Gmail for placement
  console.log('Step 3: Checking email placement...\n');

  const gmail = await getGmailClient();

  for (const sent of sentEmails) {
    try {
      const placement = await checkEmailPlacement(gmail, sent.subject);
      console.log(`${sent.campaign}: ${placement.toUpperCase()}`);

      results.push({
        campaign: sent.campaign,
        variant: sent.variant,
        placement,
        subject: sent.subject
      });

      // Step 4: Disable ALL campaigns if spam detected
      if (placement === 'spam') {
        console.log(`\nSPAM DETECTED in ${sent.campaign}: Disabling ALL campaigns...`);
        await disableAllCampaigns(sent.variant);
      }
    } catch (error) {
      console.error(`Failed to check ${sent.campaign}:`, error.message);
      results.push({
        campaign: sent.campaign,
        variant: sent.variant,
        placement: 'check_failed',
        subject: sent.subject,
        error: error.message
      });
    }
  }

  // Step 5: Send alert if any spam detected
  const hasSpam = results.some(r => r.placement === 'spam');

  if (hasSpam) {
    console.log('\nStep 5: Sending alert email...\n');
    try {
      await sendAlertEmail(results);
    } catch (error) {
      console.error('Failed to send alert email:', error.message);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  for (const result of results) {
    const status = result.placement === 'spam' ? 'SPAM (DISABLED)' :
                   result.placement === 'inbox' ? 'OK (Inbox)' :
                   result.placement === 'not_found' ? 'NOT FOUND' :
                   `ERROR: ${result.error || result.placement}`;
    console.log(`${result.campaign}: ${status}`);
  }

  const spamCount = results.filter(r => r.placement === 'spam').length;
  if (spamCount > 0) {
    console.log(`\n${spamCount} variant(s) detected in spam. ALL campaigns disabled.`);
    process.exit(1); // Non-zero exit for GitHub Actions visibility
  } else {
    console.log('\nAll variants passed spam check.');
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
