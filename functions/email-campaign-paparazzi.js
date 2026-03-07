/**
 * Team Build Pro Email Campaign for Paparazzi Contacts
 *
 * Sends emails to scraped paparazzi_contacts (representatives from paparazziexp.com).
 * Uses Mailgun API with v16 template and single subject line (no A/B testing).
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v16: English (Professional-focused messaging)
 *
 * Subject: "Your prospects don't believe they can recruit"
 *
 * Collection: paparazzi_contacts
 * Query: status == 'pending', sent == false
 * Schedule: 10:30am, 1:30pm, 4:30pm, 7:30pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const paparazziCampaignEnabled = defineString("PAPARAZZI_CAMPAIGN_ENABLED", { default: "true" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SEND_DELAY_MS = 1000;
const CTA_DOMAIN = 'teambuildpro.com';

// =============================================================================
// TEMPLATE CONFIGURATION (No A/B Testing)
// =============================================================================

// Single template and subject line for all sends
const TEMPLATE_CONFIG = {
  templateVersion: 'v16',
  subject: "Getting prospects to YES with AI",
  subjectTag: 'paparazzi_v16'
};

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'PAPARAZZI EMAIL CAMPAIGN',
  logPrefix: '💎',
  batchIdPrefix: 'paparazzi_batch',
  sentField: 'sent',
  utmCampaign: 'paparazzi_outreach_feb',
  campaignTag: 'paparazzi_campaign',
  collection: 'paparazzi_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizePaparazzi field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try Paparazzi-specific batch size first, then fall back to shared
      const paparazziBatchSize = configDoc.data().batchSizePaparazzi;
      const sharedBatchSize = configDoc.data().batchSize;

      if (paparazziBatchSize !== undefined) {
        console.log(`Using Firestore Paparazzi batch size: ${paparazziBatchSize}`);
        return paparazziBatchSize;
      }
      if (sharedBatchSize) {
        console.log(`Using Firestore shared batch size: ${sharedBatchSize}`);
        return sharedBatchSize;
      }
    }
  } catch (error) {
    console.log(`Could not read Firestore config: ${error.message}`);
  }
  // Fallback to environment variable
  const fallbackSize = parseInt(envFallback);
  console.log(`Using .env fallback batch size: ${fallbackSize}`);
  return fallbackSize;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build destination URL with UTM parameters
 */
function buildLandingPageUrl(utmCampaign, utmContent) {
  const baseUrl = `https://${CTA_DOMAIN}`;
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });
  return `${baseUrl}?${params.toString()}`;
}

// =============================================================================
// MAILGUN EMAIL SENDER
// =============================================================================

/**
 * Send email via Mailgun API using v16 template (no A/B testing)
 *
 * @param {object} contact - Contact data { firstName, lastName, email, ... }
 * @param {string} docId - Firestore document ID (used as tracking ID)
 * @param {object} config - Campaign configuration
 * @param {string} subjectSuffix - Optional suffix to append to subject (for spam monitoring)
 * @returns {Promise<object>} Send result
 */
async function sendEmailViaMailgun(contact, docId, config, subjectSuffix = '') {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // Build URLs (direct links for better deliverability)
  const unsubscribeUrl = `https://${CTA_DOMAIN}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, TEMPLATE_CONFIG.subjectTag);

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);

  // Format recipient name (use firstName only if lastName is missing)
  const recipientName = contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
  form.append('to', `${recipientName} <${contact.email}>`);

  const fullSubject = subjectSuffix ? `${TEMPLATE_CONFIG.subject} ${subjectSuffix}` : TEMPLATE_CONFIG.subject;
  form.append('subject', fullSubject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', TEMPLATE_CONFIG.templateVersion);

  // Template variables (using direct landing page URL for deliverability)
  const templateVars = {
    first_name: contact.firstName,
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  // Mailgun tracking disabled — clicks tracked via GA4 using UTM parameters in direct landing page URLs
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', config.campaignTag);
  form.append('o:tag', TEMPLATE_CONFIG.subjectTag);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  console.log(`   Template: V16`);

  // Send via Mailgun API
  const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
  const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
    }
  });

  return {
    success: true,
    messageId: response.data.id,
    response: response.data.message,
    subjectTag: TEMPLATE_CONFIG.subjectTag,
    templateVariant: 'v16',
    templateVersion: TEMPLATE_CONFIG.templateVersion,
    usedSubject: fullSubject
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processPaparazziCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = paparazziCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizePaparazzi set to 0)`);
    return { status: 'paused', sent: 0 };
  }

  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    console.error(`${name}: TBP_MAILGUN_API_KEY not configured`);
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`${logPrefix} ${name}: Batch size set to ${batchSize}`);

  try {
    const batchId = `${batchIdPrefix}_${Date.now()}`;
    const contactsRef = db.collection(collection);

    // Query: status == 'pending', sent == false, has email
    const snapshot = await contactsRef
      .where('status', '==', 'pending')
      .where(sentField, '==', false)
      .orderBy('randomIndex')
      .limit(batchSize * 2)  // Fetch extra to filter
      .get();

    // Filter contacts with valid emails
    const docsWithEmail = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.email && data.email.trim() !== '';
    }).slice(0, batchSize);

    if (docsWithEmail.length === 0) {
      console.log(`${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < docsWithEmail.length; i++) {
      const doc = docsWithEmail[i];
      const contact = doc.data();

      try {
        console.log(`Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, doc.id, config);

        if (result.success) {
          const updateData = {
            [sentField]: true,
            sentTimestamp: new Date(),
            batchId: batchId,
            status: 'sent',
            errorMessage: '',
            mailgunId: result.messageId || '',
            subjectTag: result.subjectTag,
            templateVariant: result.templateVariant,
            templateVersion: result.templateVersion,
            sentSubject: result.usedSubject,
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          console.log(`💎 Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
          sent++;
        } else {
          throw new Error(result.error || 'Unknown Mailgun error');
        }

        if (sent < docsWithEmail.length) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`Failed to send to ${contact.email}: ${errorMessage}`);

        await doc.ref.update({
          [sentField]: false,
          batchId: batchId,
          status: 'failed',
          errorMessage: errorMessage,
          lastAttempt: new Date()
        });

        failed++;
      }
    }

    console.log(`\n${batchId} Complete:`);
    console.log(`   Total processed: ${docsWithEmail.length}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    if (sent > 0) {
      console.log(`   Success rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);
    }

    return {
      status: 'success',
      sent,
      failed,
      total: docsWithEmail.length,
      batchId
    };

  } catch (error) {
    console.error(`${name}: Batch failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// SCHEDULED FUNCTION
// =============================================================================

/**
 * Paparazzi Email Campaign
 * Schedule: 10:30am, 1:30pm, 4:30pm, 7:30pm PT (staggered from other campaigns)
 */
const sendHourlyPaparazziCampaign = onSchedule({
  schedule: "30 10,13,16,19 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processPaparazziCampaignBatch(batchSize);
});

// =============================================================================
// HTTP TEST ENDPOINT
// =============================================================================

/**
 * Test endpoint for spam monitoring workflow
 * Sends test email using actual campaign code to verify inbox placement
 *
 * Usage: POST /testPaparazziEmail
 * Body: {
 *   "email": "test@example.com",
 *   "subjectSuffix": "(Feb 25, 6:00 AM)"
 * }
 *
 * subjectSuffix is optional - appended to subject for Gmail search accuracy
 */
const testPaparazziEmail = onRequest({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60
}, async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const { email, subjectSuffix } = req.body || {};

  if (!email) {
    res.status(400).json({ error: 'Missing required field: email' });
    return;
  }

  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    res.status(500).json({ error: 'TBP_MAILGUN_API_KEY not configured' });
    return;
  }

  console.log(`💎 PAPARAZZI TEST: Sending test email to ${email}`);

  // Create test contact data (use real name for deliverability testing)
  const testContact = {
    firstName: 'Stephen',
    lastName: 'Scott',
    email: email
  };

  // Create mock config matching campaign config
  const testConfig = {
    ...CAMPAIGN_CONFIG,
    utmCampaign: 'paparazzi_test'
  };

  try {
    const result = await sendEmailViaMailgun(testContact, `test_${Date.now()}`, testConfig, subjectSuffix || '');

    console.log(`💎 Test sent (v16): ${result.messageId}`);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      email,
      summary: {
        sent: 1,
        failed: 0,
        total: 1
      },
      results: [{
        variant: 'v16',
        success: true,
        messageId: result.messageId,
        subject: result.usedSubject,
        templateVersion: result.templateVersion
      }]
    });
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error(`💎 Test failed (v16): ${errorMessage}`);

    res.json({
      success: false,
      timestamp: new Date().toISOString(),
      email,
      summary: {
        sent: 0,
        failed: 1,
        total: 1
      },
      results: [{
        variant: 'v16',
        success: false,
        error: errorMessage
      }]
    });
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyPaparazziCampaign,
  testPaparazziEmail
};
