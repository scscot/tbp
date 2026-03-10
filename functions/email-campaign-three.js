/**
 * Team Build Pro Email Campaign for THREE International Contacts
 *
 * Sends emails to scraped three_contacts (distributors from THREE International pages).
 * Uses Mailgun API with V19 A/B/C testing (3 template variations for conversion optimization).
 * V19 templates use generic "Greetings!" greeting since THREE pages don't have usable names.
 *
 * V19 A/B/C Test (33% distribution each):
 * - V19-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V19-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V19-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v19-a, v19-b, v19-c: English variants (generic "Greetings!" greeting)
 *
 * Collection: three_contacts
 * Query: status == 'pending', sent == false, email != null
 * Schedule: 12:00pm, 3:00pm, 6:00pm, 9:00pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const threeCampaignEnabled = defineString("THREE_CAMPAIGN_ENABLED", { default: "false" });
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
// V19 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V19 Template Variants for A/B/C Testing (English Only)
 * 33% distribution per variant for statistically valid comparison
 *
 * V19 uses generic "Greetings!" greeting (no {{first_name}}) since THREE pages
 * don't have usable names (only subdomain-based names like "Avery66").
 */
const V19_VARIANTS = {
  'v19-a': {
    templateVersion: 'v19-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'three_v19_a',
    description: 'Curiosity Hook'
  },
  'v19-b': {
    templateVersion: 'v19-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'three_v19_b',
    description: 'Pain Point Hook'
  },
  'v19-c': {
    templateVersion: 'v19-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'three_v19_c',
    description: 'Direct Value Hook'
  }
};

/**
 * Select variant using 33% distribution
 * @returns {string} Variant key (e.g., 'v19-a', 'v19-b', 'v19-c')
 */
function selectV19Variant() {
  const rand = Math.random();
  if (rand < 0.333) return 'v19-a';
  if (rand < 0.666) return 'v19-b';
  return 'v19-c';
}

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'THREE EMAIL CAMPAIGN',
  logPrefix: '🌿',
  batchIdPrefix: 'three_batch',
  sentField: 'sent',
  utmCampaign: 'three_outreach',
  campaignTag: 'three_campaign',
  collection: 'three_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizeThree field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try THREE-specific batch size first, then fall back to shared
      const threeBatchSize = configDoc.data().batchSizeThree;
      const sharedBatchSize = configDoc.data().batchSize;

      if (threeBatchSize !== undefined) {
        console.log(`Using Firestore THREE batch size: ${threeBatchSize}`);
        return threeBatchSize;
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
 * Send email via Mailgun API using V19 A/B/C testing
 * V19 uses generic "Greetings!" greeting (no {{first_name}}) since THREE pages
 * don't have usable names.
 *
 * @param {object} contact - Contact data { firstName, lastName, email, ... }
 * @param {string} docId - Firestore document ID (used as tracking ID)
 * @param {object} config - Campaign configuration
 * @returns {Promise<object>} Send result
 */
async function sendEmailViaMailgun(contact, docId, config) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // Select V19 variant (33% each for A/B/C testing)
  const variantKey = selectV19Variant();
  const variant = V19_VARIANTS[variantKey];

  // Build URLs (direct links for better deliverability)
  const unsubscribeUrl = `https://${CTA_DOMAIN}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, variant.subjectTag);

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);

  // THREE contacts don't have usable names (only subdomain-based names like "Avery66")
  // So we omit the name from the recipient field
  form.append('to', contact.email);

  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Template variables (V19 uses generic "Greetings!" greeting, no first_name needed)
  const templateVars = {
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
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  console.log(`   Template: ${variant.templateVersion} (${variant.description})`);

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
    templateVariant: variantKey,
    templateVersion: variant.templateVersion,
    usedSubject: variant.subject
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processThreeCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = threeCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeThree set to 0)`);
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

    // Query: status == 'pending', sent == false
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

          console.log(`🌿 Sent to ${contact.email} (${result.templateVersion}): ${result.messageId}`);
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
 * THREE Email Campaign
 * Schedule: 12:00pm, 3:00pm, 6:00pm, 9:00pm PT (staggered from other campaigns)
 */
const sendHourlyThreeCampaign = onSchedule({
  schedule: "0 12,15,18,21 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processThreeCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyThreeCampaign
};
