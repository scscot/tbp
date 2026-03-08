/**
 * Team Build Pro Email Campaign for Scentsy Contacts
 *
 * Sends emails to scraped scentsy_contacts (consultants from Scentsy party host finder).
 * Uses Mailgun API with v16 template and single subject line (no A/B testing).
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v16: English (Professional-focused messaging)
 * - v16-es: Spanish
 * - v16-de: German
 *
 * Subject: "Getting prospects to YES with AI" (localized per language)
 *
 * Language Selection:
 * - Spanish (es): Mexico, Spain
 * - German (de): Germany, Austria
 * - English (en): United States, Canada, United Kingdom, Australia, Netherlands (default)
 *
 * Collection: scentsy_contacts
 * Query: status == 'pending', sent == false
 * Schedule: 11:30am, 2:30pm, 5:30pm, 8:30pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const scentsyCampaignEnabled = defineString("SCENTSY_CAMPAIGN_ENABLED", { default: "false" });
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
 * Country to language mapping
 * Countries not listed default to English
 */
const COUNTRY_LANGUAGE_MAP = {
  // Spanish-speaking countries
  'Mexico': 'es',
  'Spain': 'es',

  // German-speaking countries
  'Germany': 'de',
  'Austria': 'de'

  // English (default): United States, Canada, United Kingdom, Australia, Netherlands
};

/**
 * CTA domains by language
 */
const CTA_DOMAINS = {
  en: 'teambuildpro.com',
  es: 'es.teambuildpro.com',
  de: 'de.teambuildpro.com'
};

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
    subject: "Getting recruiting prospects to YES with AI",
    subjectTag: 'scentsy_v16_en'
  },
  es: {
    templateVersion: 'v16-es',
    subject: 'Consiguiendo que los prospectos de reclutamiento digan SÍ con IA',
    subjectTag: 'scentsy_v16_es'
  },
  de: {
    templateVersion: 'v16-de',
    subject: 'Mit KI Rekrutierungs-Interessenten zum JA bringen',
    subjectTag: 'scentsy_v16_de'
  }
};

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'SCENTSY EMAIL CAMPAIGN',
  logPrefix: '🕯️',
  batchIdPrefix: 'scentsy_batch',
  sentField: 'sent',
  utmCampaign: 'scentsy_outreach_feb',
  campaignTag: 'scentsy_campaign',
  collection: 'scentsy_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses scentsyBatchSize field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try Scentsy-specific batch size first, then fall back to shared
      const scentsyBatchSize = configDoc.data().scentsyBatchSize;
      const sharedBatchSize = configDoc.data().batchSize;

      if (scentsyBatchSize !== undefined) {
        console.log(`Using Firestore Scentsy batch size: ${scentsyBatchSize}`);
        return scentsyBatchSize;
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
 * Determine language for a contact based on country
 */
function getContactLanguage(contact) {
  const country = contact.country || '';
  return COUNTRY_LANGUAGE_MAP[country] || 'en';
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
 * Send email via Mailgun API using v16 templates (no A/B testing)
 *
 * @param {object} contact - Contact data { firstName, lastName, email, country, ... }
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

  console.log(`   Lang: ${language.toUpperCase()} | Template: v16 (${templateConfig.templateVersion}) | CTA: ${ctaDomain}`);

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
    templateVariant: 'v16',
    templateVersion: templateConfig.templateVersion,
    language: language,
    usedSubject: templateConfig.subject
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processScentsyCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = scentsyCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (scentsyBatchSize set to 0)`);
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

    // Count by language
    const langCounts = { en: 0, es: 0, de: 0 };
    docsWithEmail.forEach(doc => {
      const lang = getContactLanguage(doc.data());
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    });

    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);
    console.log(`   By language: EN=${langCounts.en} | ES=${langCounts.es} | DE=${langCounts.de}`);

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
            sentLanguage: result.language,
            sentSubject: result.usedSubject,
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          const langEmoji = result.language === 'es' ? '🇪🇸' :
            result.language === 'de' ? '🇩🇪' : '🇺🇸';
          console.log(`${langEmoji} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
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
    console.log(`   By language: EN=${langCounts.en} | ES=${langCounts.es} | DE=${langCounts.de}`);

    return {
      status: 'success',
      sent,
      failed,
      total: docsWithEmail.length,
      batchId,
      languageCounts: langCounts
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
 * Scentsy Email Campaign
 * Schedule: Every 2 hours (12x daily) - on the hour
 */
const sendHourlyScentsyCampaign = onSchedule({
  schedule: "0 */2 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processScentsyCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyScentsyCampaign
};
