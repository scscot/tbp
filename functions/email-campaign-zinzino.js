/**
 * Team Build Pro Email Campaign for Zinzino Contacts
 *
 * Sends emails to scraped zinzino_contacts (distributors from Zinzino partner finder).
 * Uses Mailgun API with template versioning and language-based template selection.
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v9: English minimal version (no bullets)
 * - v10: English version with bullets
 * - v9-es: Spanish minimal version
 * - v10-es: Spanish version with bullets
 * - v9-de: German minimal version
 * - v10-de: German version with bullets
 *
 * Language Selection:
 * - Spanish (es): Spain, Mexico, Colombia, Peru
 * - German (de): Germany, Austria, Switzerland
 * - English (en): All other countries (default)
 *
 * A/B Test: 4-way per language (v9a, v9b, v10a, v10b)
 *
 * Collection: zinzino_contacts
 * Query: status == 'pending', sent == false
 * Schedule: 11am, 2pm, 5pm, 8pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const zinzinoCampaignEnabled = defineString("ZINZINO_CAMPAIGN_ENABLED", { default: "false" });
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
  'Spain': 'es',
  'Mexico': 'es',
  'Colombia': 'es',
  'Peru': 'es',

  // German-speaking countries
  'Germany': 'de',
  'Austria': 'de',
  'Switzerland': 'de'
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
// A/B TEST CONFIGURATIONS BY LANGUAGE
// =============================================================================

/**
 * English variants (default)
 * Subject "Not an opportunity. Just a tool." triggers Gmail spam filter - using safe alternatives
 */
const VARIANTS_EN = {
  v9a: {
    templateVersion: 'v9',
    subject: 'AI is changing how teams grow',
    subjectTag: 'zinzino_v9a_en',
    description: 'V9 (no bullets) + AI curiosity'
  },
  v9b: {
    templateVersion: 'v9',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'zinzino_v9b_en',
    description: 'V9 (no bullets) + AI assistant'
  },
  v10a: {
    templateVersion: 'v10',
    subject: 'AI is changing how teams grow',
    subjectTag: 'zinzino_v10a_en',
    description: 'V10 (with bullets) + AI curiosity'
  },
  v10b: {
    templateVersion: 'v10',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'zinzino_v10b_en',
    description: 'V10 (with bullets) + AI assistant'
  }
};

/**
 * Spanish variants (Mexico style)
 * Avoiding spam-triggering phrases
 */
const VARIANTS_ES = {
  v9a: {
    templateVersion: 'v9-es',
    subject: 'La IA esta cambiando como crecen los equipos',
    subjectTag: 'zinzino_v9a_es',
    description: 'V9-ES (no bullets) + AI curiosity'
  },
  v9b: {
    templateVersion: 'v9-es',
    subject: 'Tu asistente de reclutamiento con IA',
    subjectTag: 'zinzino_v9b_es',
    description: 'V9-ES (no bullets) + AI assistant'
  },
  v10a: {
    templateVersion: 'v10-es',
    subject: 'La IA esta cambiando como crecen los equipos',
    subjectTag: 'zinzino_v10a_es',
    description: 'V10-ES (with bullets) + AI curiosity'
  },
  v10b: {
    templateVersion: 'v10-es',
    subject: 'Tu asistente de reclutamiento con IA',
    subjectTag: 'zinzino_v10b_es',
    description: 'V10-ES (with bullets) + AI assistant'
  }
};

/**
 * German variants (formal Sie form)
 * Avoiding spam-triggering phrases
 */
const VARIANTS_DE = {
  v9a: {
    templateVersion: 'v9-de',
    subject: 'KI verandert, wie Teams wachsen',
    subjectTag: 'zinzino_v9a_de',
    description: 'V9-DE (no bullets) + AI curiosity'
  },
  v9b: {
    templateVersion: 'v9-de',
    subject: 'Ihr KI-gesteuerter Recruiting-Assistent',
    subjectTag: 'zinzino_v9b_de',
    description: 'V9-DE (no bullets) + AI assistant'
  },
  v10a: {
    templateVersion: 'v10-de',
    subject: 'KI verandert, wie Teams wachsen',
    subjectTag: 'zinzino_v10a_de',
    description: 'V10-DE (with bullets) + AI curiosity'
  },
  v10b: {
    templateVersion: 'v10-de',
    subject: 'Ihr KI-gesteuerter Recruiting-Assistent',
    subjectTag: 'zinzino_v10b_de',
    description: 'V10-DE (with bullets) + AI assistant'
  }
};

// Map language code to variants
const VARIANTS_BY_LANGUAGE = {
  en: VARIANTS_EN,
  es: VARIANTS_ES,
  de: VARIANTS_DE
};

// Active variant keys for A/B testing (same for all languages)
const ACTIVE_VARIANT_KEYS = ['v9a', 'v9b', 'v10a', 'v10b'];

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'ZINZINO EMAIL CAMPAIGN',
  logPrefix: '🧬',
  batchIdPrefix: 'zinzino_batch',
  sentField: 'sent',
  utmCampaign: 'zinzino_outreach_feb',
  campaignTag: 'zinzino_campaign',
  collection: 'zinzino_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizeZinzino field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try Zinzino-specific batch size first, then fall back to shared
      const zinzinoBatchSize = configDoc.data().batchSizeZinzino;
      const sharedBatchSize = configDoc.data().batchSize;

      if (zinzinoBatchSize !== undefined) {
        console.log(`Using Firestore Zinzino batch size: ${zinzinoBatchSize}`);
        return zinzinoBatchSize;
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
 * Send email via Mailgun API using language-appropriate templates
 *
 * @param {object} contact - Contact data { firstName, lastName, email, country, ... }
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

  // Determine language and get appropriate variants
  const language = getContactLanguage(contact);
  const variants = VARIANTS_BY_LANGUAGE[language] || VARIANTS_BY_LANGUAGE.en;

  // Select variant based on index (4-way A/B test)
  const variantKey = ACTIVE_VARIANT_KEYS[index % ACTIVE_VARIANT_KEYS.length];
  const variant = variants[variantKey];

  // Build URLs (direct links for better deliverability)
  const ctaDomain = CTA_DOMAINS[language] || CTA_DOMAINS.en;
  const unsubscribeUrl = `https://${ctaDomain}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, variant.subjectTag, language);

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);

  // Format recipient name (use firstName only if lastName is missing)
  const recipientName = contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
  form.append('to', `${recipientName} <${contact.email}>`);

  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

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
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', `lang_${language}`);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  console.log(`   Lang: ${language.toUpperCase()} | Template: ${variantKey.toUpperCase()} (${variant.templateVersion}) | CTA: ${ctaDomain}`);

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
    language: language,
    usedSubject: variant.subject
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processZinzinoCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = zinzinoCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeZinzino set to 0)`);
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
 * Zinzino Email Campaign
 * Schedule: 11am, 2pm, 5pm, 8pm PT (staggered from Main/Contacts/BFH campaigns)
 */
const sendHourlyZinzinoCampaign = onSchedule({
  schedule: "0 11,14,17,20 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processZinzinoCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyZinzinoCampaign
};
