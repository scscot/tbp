/**
 * Email Spam Monitoring Script
 *
 * Sends test emails from each active campaign to scscot@gmail.com,
 * then uses Gmail API to verify inbox placement. If any email lands
 * in spam, the campaign is automatically disabled and an alert is sent.
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
const CHECK_DELAY_MS = 5 * 60 * 1000; // 5 minutes

// Campaign configuration
const CAMPAIGNS = [
  {
    name: 'Main',
    batchSizeField: 'batchSize',
    template: 'v9',
    subject: 'Not an opportunity. Just a tool.'
  },
  {
    name: 'Purchased',
    batchSizeField: 'batchSizePurchased',
    template: 'v11',
    subject: 'Not an opportunity. Just a tool.'
  },
  {
    name: 'BFH',
    batchSizeField: 'batchSizeBfh',
    template: 'v9',
    subject: 'Not an opportunity. Just a tool.'
  }
];

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
    // In production, you'd want to update the stored token
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =============================================================================
// SEND TEST EMAILS
// =============================================================================

async function sendTestEmail(campaign, timestamp) {
  const apiKey = process.env.MAILGUN_API_KEY;

  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY not configured');
  }

  // Unique subject line for Gmail search
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `${campaign.name} Update for ${currentDate}`;

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `Stephen <${TEST_EMAIL}>`);
  form.append('subject', subject);
  form.append('template', 'mailer');
  form.append('t:version', campaign.template);
  form.append('o:tag', 'delivery_check');
  form.append('o:tag', campaign.name.toLowerCase());
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Template variables
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: 'Stephen',
    tracked_cta_url: 'https://teambuildpro.com',
    unsubscribe_url: 'https://teambuildpro.com/unsubscribe.html'
  }));

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

  console.log(`Sent ${campaign.name} test email: ${response.data.id}`);

  return {
    campaign: campaign.name,
    subject,
    messageId: response.data.id
  };
}

// =============================================================================
// CHECK EMAIL PLACEMENT
// =============================================================================

async function checkEmailPlacement(gmail, subject) {
  // Search in INBOX
  const inboxResponse = await gmail.users.messages.list({
    userId: 'me',
    q: `subject:"${subject}" in:inbox`,
    maxResults: 1
  });

  // Search in SPAM
  const spamResponse = await gmail.users.messages.list({
    userId: 'me',
    q: `subject:"${subject}" in:spam`,
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

async function disableCampaign(campaign) {
  const configRef = db.collection('config').doc('emailCampaign');

  await db.runTransaction(async (transaction) => {
    const configDoc = await transaction.get(configRef);

    if (!configDoc.exists) {
      throw new Error('config/emailCampaign document does not exist');
    }

    const currentValue = configDoc.data()[campaign.batchSizeField] || 0;

    // Update with disabled status
    const updateData = {
      [campaign.batchSizeField]: 0,
      [`${campaign.batchSizeField}_disabled_at`]: admin.firestore.FieldValue.serverTimestamp(),
      [`${campaign.batchSizeField}_previous_value`]: currentValue,
      [`${campaign.batchSizeField}_disabled_reason`]: 'spam_detected'
    };

    transaction.update(configRef, updateData);
  });

  console.log(`Disabled ${campaign.name} campaign (${campaign.batchSizeField} set to 0)`);
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
  const spamCampaigns = results.filter(r => r.placement === 'spam');
  const allResults = results.map(r =>
    `${r.campaign}: ${r.placement.toUpperCase()} ${r.placement === 'spam' ? '(DISABLED)' : ''}`
  ).join('\n');

  const subject = `SPAM ALERT: ${spamCampaigns.map(c => c.campaign).join(', ')} campaign(s) disabled`;

  const html = `
    <h2>Email Spam Monitor Alert</h2>
    <p>The following campaign(s) were detected in the spam folder and have been automatically disabled:</p>
    <ul>
      ${spamCampaigns.map(c => `<li><strong>${c.campaign}</strong></li>`).join('')}
    </ul>

    <h3>Full Results</h3>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <tr style="background-color: #f0f0f0;">
        <th>Campaign</th>
        <th>Placement</th>
        <th>Status</th>
      </tr>
      ${results.map(r => `
        <tr style="background-color: ${r.placement === 'spam' ? '#ffcccc' : r.placement === 'inbox' ? '#ccffcc' : '#ffffcc'};">
          <td>${r.campaign}</td>
          <td>${r.placement.toUpperCase()}</td>
          <td>${r.placement === 'spam' ? 'DISABLED' : 'OK'}</td>
        </tr>
      `).join('')}
    </table>

    <h3>How to Re-enable</h3>
    <p>To re-enable a campaign after resolving spam issues:</p>
    <ol>
      <li>Go to Firestore Console > config > emailCampaign</li>
      <li>Set the batch size field to the previous value (stored in *_previous_value)</li>
      <li>Delete the *_disabled_at, *_previous_value, and *_disabled_reason fields</li>
    </ol>

    <p style="color: #666; font-size: 12px;">
      This alert was generated by the spam monitoring system at ${new Date().toISOString()}
    </p>
  `;

  const text = `EMAIL SPAM MONITOR ALERT

The following campaigns were detected in spam and have been disabled:
${spamCampaigns.map(c => `- ${c.campaign}`).join('\n')}

Full Results:
${allResults}

To re-enable, update the batch size in Firestore config/emailCampaign.

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
  console.log(`Target: ${TEST_EMAIL}\n`);

  const timestamp = Date.now().toString();
  const sentEmails = [];
  const results = [];

  // Step 1: Send test emails from each campaign
  console.log('Step 1: Sending test emails...\n');

  for (const campaign of CAMPAIGNS) {
    try {
      const sent = await sendTestEmail(campaign, timestamp);
      sentEmails.push(sent);
    } catch (error) {
      console.error(`Failed to send ${campaign.name} test email:`, error.message);
      results.push({
        campaign: campaign.name,
        placement: 'send_failed',
        error: error.message
      });
    }
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
    const campaign = CAMPAIGNS.find(c => c.name === sent.campaign);

    try {
      const placement = await checkEmailPlacement(gmail, sent.subject);
      console.log(`${sent.campaign}: ${placement.toUpperCase()}`);

      results.push({
        campaign: sent.campaign,
        placement,
        subject: sent.subject
      });

      // Step 4: Disable if spam
      if (placement === 'spam') {
        console.log(`SPAM DETECTED: Disabling ${sent.campaign} campaign...`);
        await disableCampaign(campaign);
      }
    } catch (error) {
      console.error(`Failed to check ${sent.campaign}:`, error.message);
      results.push({
        campaign: sent.campaign,
        placement: 'check_failed',
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
    console.log(`\n${spamCount} campaign(s) disabled due to spam detection.`);
    process.exit(1); // Non-zero exit for GitHub Actions visibility
  } else {
    console.log('\nAll campaigns passed spam check.');
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
