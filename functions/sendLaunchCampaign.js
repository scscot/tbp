const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Define Mailgun API key and domain from environment variables
const mailgunApiKey = defineString('MAILGUN_API_KEY');
const mailgunDomain = defineString('MAILGUN_DOMAIN', { default: 'hello.teambuildpro.com' });

// Load the email template
const templatePath = path.join(__dirname, 'email_templates/launch_campaign_mailgun.html');
let emailTemplate;

try {
  emailTemplate = fs.readFileSync(templatePath, 'utf8');
  console.log('✅ Email template loaded successfully');
} catch (error) {
  console.error('❌ Failed to load email template:', error);
  emailTemplate = null;
}

exports.sendLaunchCampaign = onRequest(
  {
    cors: true,
    region: 'us-central1',
    timeoutSeconds: 540, // 9 minutes for large campaigns
    memory: '1GiB',
  },
  async (req, res) => {
    try {
      console.log('🚀 LAUNCH_CAMPAIGN: Starting campaign send');

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // Validate template is loaded
      if (!emailTemplate) {
        console.error('❌ LAUNCH_CAMPAIGN: Email template not available');
        return res.status(500).json({ error: 'Email template not available' });
      }

      // Get Mailgun API key and domain
      const apiKey = mailgunApiKey.value();
      const domain = mailgunDomain.value();

      // Get request parameters
      const {
        dryRun = false,
        batchSize = 50,
        testEmail = null,
        deviceFilter = null, // 'ios', 'android', 'both', or null for all
      } = req.body;

      console.log(
        `🔧 LAUNCH_CAMPAIGN: Configuration - dryRun: ${dryRun}, batchSize: ${batchSize}, deviceFilter: ${deviceFilter}`
      );

      // If test email provided, send only to that email
      if (testEmail) {
        console.log(`🧪 LAUNCH_CAMPAIGN: Test mode - sending to ${testEmail}`);
        const testResult = await sendTestEmail(testEmail, emailTemplate, apiKey, domain);
        return res.json({
          success: true,
          message: 'Test email sent successfully',
          testEmail: testEmail,
          result: testResult,
        });
      }

      // Query launch_notifications collection
      const db = admin.firestore();
      let query = db.collection('launch_notifications');

      // Apply device filter if specified
      if (deviceFilter) {
        if (deviceFilter === 'both') {
          query = query.where('deviceSelection', '==', 'both');
        } else {
          query = query.where('deviceSelection', '==', deviceFilter);
        }
        console.log(`🔍 LAUNCH_CAMPAIGN: Filtering for device type: ${deviceFilter}`);
      }

      const snapshot = await query.get();
      const subscribers = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log(`📊 LAUNCH_CAMPAIGN: Found ${subscribers.length} subscribers`);

      if (subscribers.length === 0) {
        return res.json({
          success: true,
          message: 'No subscribers found',
          sent: 0,
          failed: 0,
        });
      }

      // If dry run, return subscriber count without sending
      if (dryRun) {
        const deviceBreakdown = getDeviceBreakdown(subscribers);
        return res.json({
          success: true,
          message: 'Dry run completed',
          totalSubscribers: subscribers.length,
          deviceBreakdown: deviceBreakdown,
          wouldSend: subscribers.length,
          dryRun: true,
        });
      }

      // Send campaign in batches
      const results = await sendCampaignInBatches(subscribers, emailTemplate, batchSize, apiKey, domain);

      // Log campaign completion
      await logCampaignCompletion(results, deviceFilter);

      console.log(
        `✅ LAUNCH_CAMPAIGN: Campaign completed - Sent: ${results.sent}, Failed: ${results.failed}`
      );

      res.json({
        success: true,
        message: 'Launch campaign completed',
        sent: results.sent,
        failed: results.failed,
        totalSubscribers: subscribers.length,
        deviceFilter: deviceFilter || 'all',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ LAUNCH_CAMPAIGN: Error sending campaign:', error);
      res.status(500).json({
        error: 'Failed to send launch campaign',
        details: error.message,
      });
    }
  }
);

/**
 * Send test email to specified address
 */
async function sendTestEmail(testEmail, template, apiKey, domain) {
  const personalizedTemplate = template
    .replace(/%recipient\.firstName%/g, 'Test User')
    .replace(/%recipient\.email%/g, testEmail);

  const form = new FormData();
  form.append('from', 'Stephen Scott | Team Build Pro <stephen@hello.teambuildpro.com>');
  form.append('to', testEmail);
  form.append('subject', '🚀 Team Build Pro is Now Available! [TEST]');
  form.append('html', personalizedTemplate);
  form.append('o:tag', 'launch_campaign_test');
  form.append('o:tracking', 'yes');
  form.append('o:tracking-opens', 'yes');
  form.append('o:tracking-clicks', 'yes');

  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
    const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });
    console.log(`✅ LAUNCH_CAMPAIGN: Test email sent to ${testEmail}`);
    return { success: true, email: testEmail, messageId: response.data.id };
  } catch (error) {
    console.error(`❌ LAUNCH_CAMPAIGN: Test email failed for ${testEmail}:`, error);
    throw error;
  }
}

/**
 * Send campaign in batches to avoid rate limits
 */
async function sendCampaignInBatches(subscribers, template, batchSize, apiKey, domain) {
  let sent = 0;
  let failed = 0;
  const totalBatches = Math.ceil(subscribers.length / batchSize);

  console.log(`📦 LAUNCH_CAMPAIGN: Processing ${totalBatches} batches of ${batchSize} emails each`);

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    console.log(
      `🔄 LAUNCH_CAMPAIGN: Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`
    );

    const batchResults = await Promise.allSettled(
      batch.map((subscriber) => sendPersonalizedEmail(subscriber, template, apiKey, domain))
    );

    // Count results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        console.error(
          `❌ LAUNCH_CAMPAIGN: Failed to send to ${batch[index].email}:`,
          result.reason
        );
      }
    });

    // Small delay between batches to be respectful to Mailgun
    if (i + batchSize < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { sent, failed };
}

/**
 * Send personalized email to individual subscriber
 */
async function sendPersonalizedEmail(subscriber, template, apiKey, domain) {
  const { firstName, lastName, email } = subscriber;

  const personalizedTemplate = template
    .replace(/%recipient\.firstName%/g, firstName)
    .replace(/%recipient\.email%/g, email);

  const form = new FormData();
  form.append('from', 'Stephen Scott | Team Build Pro <stephen@hello.teambuildpro.com>');
  form.append('to', `${firstName} ${lastName} <${email}>`);
  form.append('bcc', 'scscot@gmail.com');
  form.append('subject', `${firstName}, Team Build Pro is now available!`);
  form.append('html', personalizedTemplate);
  form.append('o:tag', 'launch_campaign_2025');
  form.append('o:tag', subscriber.id || 'no_id');
  form.append('o:tracking', 'yes');
  form.append('o:tracking-opens', 'yes');
  form.append('o:tracking-clicks', 'yes');

  const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
  await axios.post(`${mailgunBaseUrl}/messages`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
    }
  });

  console.log(`✅ LAUNCH_CAMPAIGN: Email sent to ${firstName} ${lastName} (${email})`);

  return { success: true, email: email };
}


/**
 * Get device breakdown for analytics
 */
function getDeviceBreakdown(subscribers) {
  const breakdown = {
    ios: 0,
    android: 0,
    both: 0,
    unspecified: 0,
  };

  subscribers.forEach((subscriber) => {
    const device = subscriber.deviceSelection;
    if (device === 'ios') {
      breakdown.ios++;
    } else if (device === 'android') {
      breakdown.android++;
    } else if (device === 'both') {
      breakdown.both++;
    } else {
      breakdown.unspecified++;
    }
  });

  return breakdown;
}

/**
 * Log campaign completion to Firestore for analytics
 */
async function logCampaignCompletion(results, deviceFilter) {
  try {
    const db = admin.firestore();
    await db.collection('campaign_logs').add({
      campaign: 'launch_2025',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sent: results.sent,
      failed: results.failed,
      total: results.sent + results.failed,
      deviceFilter: deviceFilter || 'all',
      completedAt: new Date().toISOString(),
    });
    console.log('📝 LAUNCH_CAMPAIGN: Campaign completion logged');
  } catch (error) {
    console.error('❌ LAUNCH_CAMPAIGN: Failed to log campaign:', error);
  }
}
