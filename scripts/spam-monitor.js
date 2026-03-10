/**
 * Email Deliverability Monitoring Script
 *
 * Sends test emails directly via Mailgun API using V18 A/B/C templates,
 * then uses Gmail API to verify inbox placement. If any email lands
 * in junk folder, all campaigns are automatically disabled and an alert is sent.
 *
 * V18 Template Variants Tested:
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 20 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Key behaviors:
 * - Tests all 3 V18 variants sequentially with 5-second delays between sends
 * - Waits 2 minutes after all sends before checking Gmail placement
 * - If ANY variant lands in junk, ALL campaigns are disabled
 * - Total runtime: ~3-4 minutes
 *
 * Usage:
 *   node scripts/spam-monitor.js
 *
 * Environment Variables Required:
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Firebase service account JSON
 *   MAILGUN_API_KEY - Mailgun API key (for sending test emails and alerts)
 *   GMAIL_OAUTH_CREDENTIALS - OAuth client credentials JSON
 *   GMAIL_OAUTH_TOKEN - OAuth refresh token JSON
 *
 * GitHub Actions Schedule: 5x daily at 6am, 9am, 12pm, 3pm, 6pm PT
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

const TEST_EMAIL = 'Stephen Scott <scscot@gmail.com>';
// const TEST_EMAIL = 'Patricia Craig <pattycraig80@gmail.com>';
const ALERT_EMAIL = 'scscot@gmail.com';
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const CHECK_DELAY_MS = 2 * 60 * 1000; // 2 minutes (Gmail typically delivers in 1-2 min)

// V18 A/B/C template configurations for spam testing
const V18_TEMPLATES = [
  {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'delivery_test_v18_a',
    description: 'V18-A: Curiosity Hook'
  },
  {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'delivery_test_v18_b',
    description: 'V18-B: Pain Point Hook'
  },
  {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'delivery_test_v18_c',
    description: 'V18-C: Direct Value Hook'
  }
];

// All campaigns to disable if junk detected
const ALL_BATCH_SIZE_FIELDS = ['batchSize', 'batchSizePurchased', 'batchSizeBfh', 'batchSizePaparazzi', 'batchSizeFsr', 'batchSizeZinzino', 'batchSizePruvit', 'scentsyBatchSize', 'batchSizeMpg'];

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
// SEND TEST EMAIL DIRECTLY VIA MAILGUN
// =============================================================================

async function sendTestEmailViaMailgun(templateConfig) {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY not configured');
  }

  console.log(`Sending test email via Mailgun: ${templateConfig.templateVersion}`);

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', TEST_EMAIL);
  form.append('subject', templateConfig.subject);
  form.append('template', 'mailer');
  form.append('t:version', templateConfig.templateVersion);
  form.append('t:variables', JSON.stringify({
    first_name: 'Stephen',
    tracked_cta_url: 'https://teambuildpro.com',
    unsubscribe_url: 'https://teambuildpro.com/unsubscribe'
  }));
  form.append('o:tag', templateConfig.subjectTag);
  form.append('o:tag', 'delivery_monitor');

  const response = await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      },
      timeout: 30000
    }
  );

  console.log(`Sent: "${templateConfig.subject}" (${response.data.id})`);

  return {
    campaign: templateConfig.description,
    variant: templateConfig.templateVersion,
    subject: templateConfig.subject,
    messageId: response.data.id,
    success: true
  };
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
  const inJunk = spamResponse.data.messages && spamResponse.data.messages.length > 0;

  if (inJunk) {
    return 'junk';
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
        updateData[`${field}_disabled_reason`] = `junk_detected_via_${triggeringVariant}`;
      }
    }

    if (Object.keys(updateData).length > 0) {
      transaction.update(configRef, updateData);
    }
  });

  console.log(`Disabled ALL campaigns due to junk folder placement in ${triggeringVariant}`);
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
  const flaggedResults = results.filter(r => r.placement === 'junk');
  const allResults = results.map(r =>
    `${r.campaign}: ${r.placement.toUpperCase()} ${r.placement === 'junk' ? '(DISABLED)' : ''}`
  ).join('\n');

  const subject = `${flaggedResults.map(c => c.campaign).join(', ')} disabled - deliverability issue`;

  const html = `
    <h2>Email Monitor Alert</h2>
    <p>The following test email(s) were routed to the junk folder. <strong>ALL campaigns have been disabled.</strong></p>
    <ul>
      ${flaggedResults.map(c => `<li><strong>${c.campaign}</strong> - Subject: "${c.subject}"</li>`).join('')}
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
        <tr style="background-color: ${r.placement === 'junk' ? '#ffcccc' : r.placement === 'inbox' ? '#ccffcc' : '#ffffcc'};">
          <td>${r.campaign}</td>
          <td>${r.subject || 'N/A'}</td>
          <td>${r.placement.toUpperCase()}</td>
          <td>${r.placement === 'junk' ? 'DISABLED' : 'OK'}</td>
        </tr>
      `).join('')}
    </table>

    <h3>How to Re-enable</h3>
    <p>To re-enable campaigns after resolving deliverability issues:</p>
    <ol>
      <li>Go to Firestore Console > config > emailCampaign</li>
      <li>Set each batch size field to the previous value (stored in *_previous_value)</li>
      <li>Delete the *_disabled_at, *_previous_value, and *_disabled_reason fields</li>
    </ol>

    <p style="color: #666; font-size: 12px;">
      This alert was generated by the email monitoring system at ${new Date().toISOString()}<br>
      Test emails sent directly via Mailgun API.
    </p>
  `;

  const text = `EMAIL MONITOR ALERT

The following test emails were flagged. ALL campaigns have been disabled:
${flaggedResults.map(c => `- ${c.campaign}: "${c.subject}"`).join('\n')}

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
  form.append('o:tag', 'delivery_alert');

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
  console.log('=== Email Monitor (V18 A/B/C Testing) ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Target: ${TEST_EMAIL}`);
  console.log(`Templates: V18-A, V18-B, V18-C (3 variants)`);
  console.log(`Method: Direct Mailgun API\n`);

  const results = [];
  const sentEmails = [];
  const gmail = await getGmailClient();

  // Step 1: Send all test emails
  console.log(`\n--- Step 1: Sending Test Emails ---\n`);

  for (let i = 0; i < V18_TEMPLATES.length; i++) {
    const template = V18_TEMPLATES[i];
    console.log(`[${i + 1}/${V18_TEMPLATES.length}] ${template.description}`);

    try {
      const sent = await sendTestEmailViaMailgun(template);
      sentEmails.push(sent);
    } catch (error) {
      console.error(`Failed to send ${template.templateVersion}: ${error.message}`);
      results.push({
        campaign: template.description,
        variant: template.templateVersion,
        placement: 'send_failed',
        subject: template.subject,
        error: error.message
      });
    }

    // Small delay between sends to avoid rate limiting
    if (i < V18_TEMPLATES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  if (sentEmails.length === 0) {
    console.log('\n=== Summary ===');
    console.log('All emails failed to send. Exiting.');
    process.exit(1);
  }

  // Step 2: Wait for emails to be delivered
  console.log(`\n--- Step 2: Waiting ${CHECK_DELAY_MS / 1000} seconds for delivery ---\n`);
  await new Promise(resolve => setTimeout(resolve, CHECK_DELAY_MS));

  // Step 3: Check placement for each sent email
  console.log(`--- Step 3: Checking Email Placement ---\n`);

  for (const sent of sentEmails) {
    console.log(`Checking ${sent.variant}...`);
    try {
      const placement = await checkEmailPlacement(gmail, sent.subject);
      console.log(`  ${sent.variant}: ${placement.toUpperCase()}`);

      results.push({
        campaign: sent.campaign,
        variant: sent.variant,
        placement,
        subject: sent.subject
      });

      // Disable ALL campaigns immediately if junk detected
      if (placement === 'junk') {
        console.log(`\n  JUNK FOLDER DETECTED for ${sent.variant}`);
        await disableAllCampaigns(sent.variant);
      }
    } catch (error) {
      console.error(`  Failed to check ${sent.variant}: ${error.message}`);
      results.push({
        campaign: sent.campaign,
        variant: sent.variant,
        placement: 'check_failed',
        subject: sent.subject,
        error: error.message
      });
    }
  }

  // Send alert if any junk detected
  const hasJunk = results.some(r => r.placement === 'junk');

  if (hasJunk) {
    console.log('\n--- Sending Alert Email ---\n');
    try {
      await sendAlertEmail(results);
    } catch (error) {
      console.error('Failed to send alert email:', error.message);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  for (const result of results) {
    const status = result.placement === 'junk' ? 'JUNK (DISABLED)' :
                   result.placement === 'inbox' ? 'OK (Inbox)' :
                   result.placement === 'not_found' ? 'NOT FOUND' :
                   `ERROR: ${result.error || result.placement}`;
    console.log(`${result.campaign}: ${status}`);
  }

  const inboxCount = results.filter(r => r.placement === 'inbox').length;
  const junkCount = results.filter(r => r.placement === 'junk').length;
  const notFoundCount = results.filter(r => r.placement === 'not_found').length;

  console.log(`\nResults: ${inboxCount} INBOX, ${junkCount} JUNK, ${notFoundCount} NOT FOUND`);

  if (hasJunk) {
    console.log(`\nJunk folder detected. ALL campaigns disabled.`);
    process.exit(1); // Non-zero exit for GitHub Actions visibility
  } else if (inboxCount === V18_TEMPLATES.length) {
    console.log('\nAll V18 templates passed deliverability check.');
  } else {
    console.log('\nSome templates not found - may need more delivery time.');
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
