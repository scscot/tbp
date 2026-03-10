/**
 * Team Build Pro Email Campaign for Scentsy Contacts
 *
 * Sends emails to scraped scentsy_contacts (consultants from Scentsy party host finder).
 * Uses Mailgun API with V18 A/B/C testing (3 template variations for conversion optimization).
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 20 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v18-a, v18-a-es, v18-a-de: Curiosity Hook (EN/ES/DE)
 * - v18-b, v18-b-es, v18-b-de: Pain Point Hook (EN/ES/DE)
 * - v18-c, v18-c-es, v18-c-de: Direct Value Hook (EN/ES/DE)
 *
 * Language Selection: Based on contact's country (EN default, ES for Mexico/Spain, DE for Germany/Austria)
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
// V18 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V18 Template Variants for A/B/C Testing (Multilingual)
 * 33% distribution per variant for statistically valid comparison
 *
 * Each variant available in EN, ES, DE (no PT for Scentsy - no Portuguese markets)
 */
const V18_VARIANTS = {
  // English variants
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'scentsy_v18_a_en',
    description: 'Curiosity Hook (EN)',
    language: 'en'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'scentsy_v18_b_en',
    description: 'Pain Point Hook (EN)',
    language: 'en'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'scentsy_v18_c_en',
    description: 'Direct Value Hook (EN)',
    language: 'en'
  },
  // Spanish variants
  'v18-a-es': {
    templateVersion: 'v18-a-es',
    subject: '¿Y si tu próximo recluta llegara con 12 personas?',
    subjectTag: 'scentsy_v18_a_es',
    description: 'Curiosity Hook (ES)',
    language: 'es'
  },
  'v18-b-es': {
    templateVersion: 'v18-b-es',
    subject: 'El 75% de tus reclutas renunciarán este año (descubre por qué)',
    subjectTag: 'scentsy_v18_b_es',
    description: 'Pain Point Hook (ES)',
    language: 'es'
  },
  'v18-c-es': {
    templateVersion: 'v18-c-es',
    subject: 'Dale a tus prospectos un coach de reclutamiento con IA',
    subjectTag: 'scentsy_v18_c_es',
    description: 'Direct Value Hook (ES)',
    language: 'es'
  },
  // German variants
  'v18-a-de': {
    templateVersion: 'v18-a-de',
    subject: 'Was wenn Ihr nächster Rekrut mit 12 Leuten kommt?',
    subjectTag: 'scentsy_v18_a_de',
    description: 'Curiosity Hook (DE)',
    language: 'de'
  },
  'v18-b-de': {
    templateVersion: 'v18-b-de',
    subject: '75% Ihrer Rekruten werden dieses Jahr aufhören (hier ist warum)',
    subjectTag: 'scentsy_v18_b_de',
    description: 'Pain Point Hook (DE)',
    language: 'de'
  },
  'v18-c-de': {
    templateVersion: 'v18-c-de',
    subject: 'Geben Sie Ihren Interessenten einen KI-Recruiting-Coach',
    subjectTag: 'scentsy_v18_c_de',
    description: 'Direct Value Hook (DE)',
    language: 'de'
  }
};

/**
 * Select variant using 33% distribution with language support
 * @param {string} language - Contact language (en, es, de)
 * @returns {string} Variant key (e.g., 'v18-a', 'v18-b-es', 'v18-c-de')
 */
function selectV18Variant(language = 'en') {
  const rand = Math.random();
  const suffix = language === 'en' ? '' : `-${language}`;

  if (rand < 0.333) return `v18-a${suffix}`;
  if (rand < 0.666) return `v18-b${suffix}`;
  return `v18-c${suffix}`;
}

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
 * Send email via Mailgun API using V18 A/B/C testing
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

  // Determine language from contact's country
  const language = getContactLanguage(contact);

  // Select V18 variant (33% distribution each) for the contact's language
  const variantKey = selectV18Variant(language);
  const templateConfig = V18_VARIANTS[variantKey];

  // Use language-specific CTA domain
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

  console.log(`   V18 Variant: ${variantKey.toUpperCase()} (${templateConfig.description}) | CTA: ${ctaDomain}`);

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
    templateVariant: variantKey,
    templateVersion: templateConfig.templateVersion,
    language: language,
    usedSubject: templateConfig.subject,
    variantDescription: templateConfig.description
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

    // Track variant distribution (will be populated during send)
    const variantCounts = { 'v18-a': 0, 'v18-b': 0, 'v18-c': 0 };

    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);
    console.log(`   V18 A/B/C test with 33% distribution per variant`);

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
            variantDescription: result.variantDescription,
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          // Track variant distribution
          variantCounts[result.templateVariant] = (variantCounts[result.templateVariant] || 0) + 1;

          const variantEmoji = result.templateVariant === 'v18-a' ? '🅰️' :
            result.templateVariant === 'v18-b' ? '🅱️' : '🇨';
          console.log(`${variantEmoji} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
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
    console.log(`   V18 Distribution: A=${variantCounts['v18-a']} | B=${variantCounts['v18-b']} | C=${variantCounts['v18-c']}`);

    return {
      status: 'success',
      sent,
      failed,
      total: docsWithEmail.length,
      batchId,
      variantCounts: variantCounts
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
 * Schedule: 4x daily (every 6 hours) - on the hour
 */
const sendHourlyScentsyCampaign = onSchedule({
  schedule: "0 0,6,12,18 * * *",
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
