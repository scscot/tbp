/**
 * Team Build Pro Email Campaign for Farmasius Contacts (Multi-Language)
 *
 * Sends emails to scraped farmasius_contacts (representatives from Farmasi pages).
 * Uses Mailgun API with v16 template and single subject line (no A/B testing).
 * Supports contacts from 27+ Farmasi country domains with language routing.
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v16: English (Professional-focused messaging)
 * - v16-es: Spanish (Spain, Mexico, Argentina, etc.)
 * - v16-pt: Portuguese (Portugal, Brazil)
 * - v16-de: German (Germany, Austria, Switzerland)
 *
 * Language Selection (from contact.language field):
 * - en: United States, United Kingdom, Ireland
 * - es: Spain
 * - pt: Portugal
 * - de: Germany
 * - Other languages (pl, ro, hr, etc.) fallback to English template
 *
 * Subject: "Building your team with AI" (localized per language)
 *
 * Collection: farmasius_contacts
 * Query: status == 'pending', sent == false, email != null
 * Schedule: 12:45 AM, 6:45 AM, 12:45 PM, 6:45 PM PT (4x daily)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const farmasiusCampaignEnabled = defineString("FARMASIUS_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SEND_DELAY_MS = 1000;

// =============================================================================
// LANGUAGE CONFIGURATION
// =============================================================================

/**
 * CTA domains by language (language-specific landing pages)
 */
const CTA_DOMAINS = {
  en: 'teambuildpro.com',
  es: 'es.teambuildpro.com',
  pt: 'pt.teambuildpro.com',
  de: 'de.teambuildpro.com'
};

/**
 * Supported languages for email templates
 * Languages not in this list fallback to English
 */
const SUPPORTED_LANGUAGES = ['en', 'es', 'pt', 'de'];

// =============================================================================
// TEMPLATE CONFIGURATION BY LANGUAGE (no A/B testing - single v16 template)
// =============================================================================

/**
 * Language-specific template and subject configuration
 * All languages use v16 template with localized subjects
 */
const TEMPLATE_CONFIG = {
  en: {
    templateVersion: 'v16',
    subject: "Building your team with AI",
    subjectTag: 'farmasius_v16_en'
  },
  es: {
    templateVersion: 'v16-es',
    subject: 'Construyendo tu equipo con IA',
    subjectTag: 'farmasius_v16_es'
  },
  pt: {
    templateVersion: 'v16-pt',
    subject: 'Construindo sua equipe com IA',
    subjectTag: 'farmasius_v16_pt'
  },
  de: {
    templateVersion: 'v16-de',
    subject: 'Dein Team mit KI aufbauen',
    subjectTag: 'farmasius_v16_de'
  }
};

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'FARMASIUS EMAIL CAMPAIGN',
  logPrefix: '💄',
  batchIdPrefix: 'farmasius_batch',
  sentField: 'sent',
  utmCampaign: 'farmasius_outreach',
  campaignTag: 'farmasius_campaign',
  collection: 'farmasius_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizeFarmasius field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try Farmasius-specific batch size first, then fall back to shared
      const farmasiusBatchSize = configDoc.data().batchSizeFarmasius;
      const sharedBatchSize = configDoc.data().batchSize;

      if (farmasiusBatchSize !== undefined) {
        console.log(`Using Firestore Farmasius batch size: ${farmasiusBatchSize}`);
        return farmasiusBatchSize;
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
 * Determine language for a contact
 * Uses the language field from scraper, falls back to English if unsupported
 */
function getContactLanguage(contact) {
  const language = contact.language || 'en';
  // Return the language if we have a template for it, otherwise English
  return SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
}

/**
 * Build destination URL with UTM parameters and language-specific domain
 */
function buildLandingPageUrl(utmCampaign, utmContent, language = 'en') {
  const domain = CTA_DOMAINS[language] || CTA_DOMAINS.en;
  const baseUrl = `https://${domain}`;
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
 * Send email via Mailgun API using v16 templates (multi-language)
 *
 * @param {object} contact - Contact data { firstName, lastName, email, language, ... }
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

  // Determine language and get appropriate template config
  const language = getContactLanguage(contact);
  const templateConfig = TEMPLATE_CONFIG[language] || TEMPLATE_CONFIG.en;

  // Build URLs (direct links for better deliverability)
  const ctaDomain = CTA_DOMAINS[language] || CTA_DOMAINS.en;
  const unsubscribeUrl = `https://${ctaDomain}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, templateConfig.subjectTag, language);

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);

  // Format recipient name (use firstName only if lastName is missing)
  const recipientName = contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
  form.append('to', `${recipientName} <${contact.email}>`);

  form.append('subject', templateConfig.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', templateConfig.templateVersion);

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
  form.append('o:tag', templateConfig.subjectTag);
  form.append('o:tag', `lang_${language}`);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  console.log(`   Template: ${templateConfig.templateVersion} (${language})`);

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
    subjectTag: templateConfig.subjectTag,
    templateVariant: templateConfig.templateVersion,
    templateVersion: templateConfig.templateVersion,
    usedSubject: templateConfig.subject,
    language: language
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processFarmasiusCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = farmasiusCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeFarmasius set to 0)`);
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
            sentLanguage: result.language || 'en',
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          const countryCode = contact.countryCode || 'us';
          console.log(`💄 Sent to ${contact.email} [${countryCode.toUpperCase()}/${result.language}] (${result.templateVariant}): ${result.messageId}`);
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
 * Farmasius Email Campaign
 * Schedule: 12:45 AM, 6:45 AM, 12:45 PM, 6:45 PM PT (4x daily)
 */
const sendHourlyFarmasiusCampaign = onSchedule({
  schedule: "45 0,6,12,18 * * *",  // 4x daily (every 6 hours) - 45 minutes past
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processFarmasiusCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyFarmasiusCampaign
};
