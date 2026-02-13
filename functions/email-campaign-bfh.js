/**
 * Team Build Pro Email Campaign for BFH (Business For Home) Contacts
 *
 * Sends emails to scraped bfh_contacts (distributors from Business For Home website).
 * Uses Mailgun API with template versioning.
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v9: Minimal version without bullet points (active)
 * - v10: Version with specific value prop bullets (active)
 *
 * Current A/B Test (4-way):
 * - v9a: V9 template + "Not an opportunity. Just a tool."
 * - v9b: V9 template + "AI is changing how teams grow"
 * - v10a: V10 template + "Not an opportunity. Just a tool."
 * - v10b: V10 template + "AI is changing how teams grow"
 *
 * Collection: bfh_contacts
 * Query: bfhScraped == true, email != null, sent == false
 * Schedule: 10am, 1pm, 4pm, 7pm PT (staggered from Main and Contacts campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const bfhCampaignEnabled = defineString("BFH_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SEND_DELAY_MS = 1000;
const TRACKING_BASE_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// =============================================================================
// A/B TEST CONFIGURATIONS
// =============================================================================

// A/B Test Variants - V9 vs V10 template with subject line testing (4 combinations)
const AB_TEST_VARIANTS = {
  v9a: {
    templateVersion: 'v9',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'bfh_v9a',
    description: 'V9 (no bullets) + Pattern interrupt'
  },
  v9b: {
    templateVersion: 'v9',
    subject: 'AI is changing how teams grow',
    subjectTag: 'bfh_v9b',
    description: 'V9 (no bullets) + AI curiosity'
  },
  v10a: {
    templateVersion: 'v10',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'bfh_v10a',
    description: 'V10 (with bullets) + Pattern interrupt'
  },
  v10b: {
    templateVersion: 'v10',
    subject: 'AI is changing how teams grow',
    subjectTag: 'bfh_v10b',
    description: 'V10 (with bullets) + AI curiosity'
  }
};

// Active variants for A/B testing (rotate through these)
const ACTIVE_VARIANTS = ['v9a', 'v9b', 'v10a', 'v10b'];

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'BFH EMAIL CAMPAIGN',
  logPrefix: '🌐',
  batchIdPrefix: 'bfh_batch',
  sentField: 'sent',
  utmCampaign: 'bfh_outreach_feb',
  campaignTag: 'bfh_campaign'
};

// =============================================================================
// DYNAMIC BATCH SIZE (from Firestore config, with .env fallback)
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizeBfh field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try BFH-specific batch size first, then fall back to shared
      const bfhBatchSize = configDoc.data().batchSizeBfh;
      const sharedBatchSize = configDoc.data().batchSize;

      if (bfhBatchSize) {
        console.log(`📊 Using Firestore BFH batch size: ${bfhBatchSize}`);
        return bfhBatchSize;
      }
      if (sharedBatchSize) {
        console.log(`📊 Using Firestore shared batch size: ${sharedBatchSize}`);
        return sharedBatchSize;
      }
    }
  } catch (error) {
    console.log(`⚠️ Could not read Firestore config: ${error.message}`);
  }
  // Fallback to environment variable
  const fallbackSize = parseInt(envFallback);
  console.log(`📊 Using .env fallback batch size: ${fallbackSize}`);
  return fallbackSize;
}

// =============================================================================
// TRACKING URL BUILDERS
// =============================================================================

/**
 * Build a click-tracked URL that redirects through our Cloud Function
 */
function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

/**
 * Build destination URL with UTM parameters
 */
function buildLandingPageUrl(utmCampaign, utmContent) {
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });
  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

// =============================================================================
// MAILGUN EMAIL SENDER
// =============================================================================

/**
 * Send email via Mailgun API using templates with A/B testing
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} docId - Firestore document ID (used as tracking ID)
 * @param {object} config - Campaign configuration
 * @param {number} index - Batch index for strict A/B alternation
 * @returns {Promise<object>} Send result
 */
async function sendEmailViaMailgun(contact, docId, config, index) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // A/B Test: Strict alternation between active variants
  const templateVariant = ACTIVE_VARIANTS[index % ACTIVE_VARIANTS.length];
  const variant = AB_TEST_VARIANTS[templateVariant];

  // Build tracking URLs
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, variant.subjectTag);
  const trackedCtaUrl = buildClickUrl(docId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`);
  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Tracking disabled — using Firestore-based tracking via trackEmailClick Cloud Function
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', config.campaignTag);
  form.append('o:tag', variant.templateVersion);
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables
  const templateVars = {
    first_name: contact.firstName,
    tracked_cta_url: trackedCtaUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log(`   Template: ${templateVariant.toUpperCase()} | Subject: "${variant.subject}"`);

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
    subjectTag: variant.subjectTag,
    templateVariant: templateVariant
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processBfhCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = bfhCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    console.error(`❌ ${name}: TBP_MAILGUN_API_KEY not configured`);
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`${logPrefix} ${name}: Batch size set to ${batchSize}`);

  try {
    const batchId = `${batchIdPrefix}_${Date.now()}`;
    const contactsRef = db.collection('bfh_contacts');

    // Query: scraped contacts with email that haven't been sent
    const unsentSnapshot = await contactsRef
      .where('bfhScraped', '==', true)
      .where('emailSearched', '==', true)
      .where(sentField, '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log(`✅ ${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    // Filter out contacts without email (can't do != null in compound query)
    const docsWithEmail = unsentSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.email && data.email.trim() !== '';
    });

    if (docsWithEmail.length === 0) {
      console.log(`✅ ${name}: No contacts with emails found.`);
      return { status: 'complete', sent: 0 };
    }

    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < docsWithEmail.length; i++) {
      const doc = docsWithEmail[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, doc.id, config, i);

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
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          console.log(`✅ Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
          sent++;
        } else {
          throw new Error(result.error || 'Unknown Mailgun error');
        }

        if (sent < docsWithEmail.length) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`❌ Failed to send to ${contact.email}: ${errorMessage}`);

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

    console.log(`\n📊 ${batchId} Complete:`);
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
    console.error(`💥 ${name}: Batch failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// SCHEDULED FUNCTION
// =============================================================================

/**
 * BFH Email Campaign
 * Schedule: 10am, 1pm, 4pm, 7pm PT (staggered from Main 8/11/2/5 and Contacts 9/12/3/6)
 */
const sendHourlyBfhCampaign = onSchedule({
  schedule: "0 10,13,16,19 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processBfhCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyBfhCampaign
};
