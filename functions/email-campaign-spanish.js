/**
 * Team Build Pro Email Campaign for Spanish MLM Companies
 *
 * Sends emails to scraped contacts from Spanish-speaking MLM company distributors.
 * Collection: spanish_contacts (unified collection for Spanish MLM companies)
 *
 * Uses Mailgun API with V18 A/B/C testing (3 template variations for conversion optimization).
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v18-a, v18-a-es, v18-a-pt: Curiosity Hook (EN/ES/PT)
 * - v18-b, v18-b-es, v18-b-pt: Pain Point Hook (EN/ES/PT)
 * - v18-c, v18-c-es, v18-c-pt: Direct Value Hook (EN/ES/PT)
 *
 * Language Selection: Uses contact's pre-computed 'language' field
 * (set during scraping based on countryCode: MEX/ECU/PER/etc. = es, USA = en, BRA = pt)
 *
 * Collection: omnilife_contacts (first Spanish company)
 * Query: sent == false, has email
 * Schedule: 10:30am, 1:30pm, 4:30pm, 7:30pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const spanishCampaignEnabled = defineString("SPANISH_CAMPAIGN_ENABLED", { default: "false" });
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
// CTA DOMAINS BY LANGUAGE
// =============================================================================

const CTA_DOMAINS = {
  en: 'teambuildpro.com',
  es: 'es.teambuildpro.com',
  pt: 'pt.teambuildpro.com',
  de: 'de.teambuildpro.com'
};

// =============================================================================
// V18 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V18 Template Variants for A/B/C Testing (Multilingual)
 * 33% distribution per variant for statistically valid comparison
 *
 * Each variant available in EN, ES, PT (primary languages for Spanish MLM companies)
 */
const V18_VARIANTS = {
  // English variants
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'spanish_v18_a_en',
    description: 'Curiosity Hook (EN)',
    language: 'en'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'spanish_v18_b_en',
    description: 'Pain Point Hook (EN)',
    language: 'en'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'spanish_v18_c_en',
    description: 'Direct Value Hook (EN)',
    language: 'en'
  },
  // Spanish variants
  'v18-a-es': {
    templateVersion: 'v18-a-es',
    subject: '¿Y si tu próximo recluta llegara con 12 personas?',
    subjectTag: 'spanish_v18_a_es',
    description: 'Curiosity Hook (ES)',
    language: 'es'
  },
  'v18-b-es': {
    templateVersion: 'v18-b-es',
    subject: 'El 75% de tus reclutas renunciarán este año (descubre por qué)',
    subjectTag: 'spanish_v18_b_es',
    description: 'Pain Point Hook (ES)',
    language: 'es'
  },
  'v18-c-es': {
    templateVersion: 'v18-c-es',
    subject: 'Dale a tus prospectos un coach de reclutamiento con IA',
    subjectTag: 'spanish_v18_c_es',
    description: 'Direct Value Hook (ES)',
    language: 'es'
  },
  // Portuguese variants (for Brazil - BRA contacts)
  'v18-a-pt': {
    templateVersion: 'v18-a-pt',
    subject: 'E se o seu próximo recruta chegasse com 12 pessoas?',
    subjectTag: 'spanish_v18_a_pt',
    description: 'Curiosity Hook (PT)',
    language: 'pt'
  },
  'v18-b-pt': {
    templateVersion: 'v18-b-pt',
    subject: '75% dos seus recrutas vão desistir este ano (descubra por quê)',
    subjectTag: 'spanish_v18_b_pt',
    description: 'Pain Point Hook (PT)',
    language: 'pt'
  },
  'v18-c-pt': {
    templateVersion: 'v18-c-pt',
    subject: 'Dê aos seus prospectos um coach de recrutamento com IA',
    subjectTag: 'spanish_v18_c_pt',
    description: 'Direct Value Hook (PT)',
    language: 'pt'
  }
};

/**
 * Select variant using 33% distribution with language support
 * @param {string} language - Contact language (en, es, pt)
 * @returns {string} Variant key (e.g., 'v18-a', 'v18-b-es', 'v18-c-pt')
 */
function selectV18Variant(language = 'es') {
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
  name: 'SPANISH MLM EMAIL CAMPAIGN',
  logPrefix: '🇪🇸',
  batchIdPrefix: 'spanish_batch',
  sentField: 'sent',
  utmCampaign: 'spanish_mlm_outreach_mar',
  campaignTag: 'spanish_campaign',
  collection: 'spanish_contacts'  // Unified collection for all Spanish MLM companies (Omnilife, Belcorp, FuXion)
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses spanishBatchSize field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try Spanish-specific batch size first, then fall back to shared
      const spanishBatchSize = configDoc.data().spanishBatchSize;
      const sharedBatchSize = configDoc.data().batchSize;

      if (spanishBatchSize !== undefined) {
        console.log(`Using Firestore Spanish batch size: ${spanishBatchSize}`);
        return spanishBatchSize;
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
 * Get contact language - use pre-computed field or default to Spanish
 * Contact language is set during scraping based on countryCode
 */
function getContactLanguage(contact) {
  // Use the language field set during scraping
  // Default to Spanish since this is the Spanish MLM campaign
  return contact.language || 'es';
}

/**
 * Build destination URL with UTM parameters and language-specific domain
 */
function buildLandingPageUrl(utmCampaign, utmContent, language = 'es') {
  const domain = CTA_DOMAINS[language] || CTA_DOMAINS.es;
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

  // Get language from contact (pre-computed during scraping)
  const language = getContactLanguage(contact);

  // Select V18 variant (33% distribution each) for the contact's language
  const variantKey = selectV18Variant(language);
  const templateConfig = V18_VARIANTS[variantKey];

  // Use language-specific CTA domain
  const ctaDomain = CTA_DOMAINS[language] || CTA_DOMAINS.es;
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
  form.append('o:tag', `company_${contact.company?.toLowerCase() || 'unknown'}`);
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

async function processSpanishCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = spanishCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (spanishBatchSize set to 0)`);
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

    // Query: sent == false, has email
    // Note: omnilife_contacts uses 'sent' boolean field (no 'status' field for pending)
    const snapshot = await contactsRef
      .where(sentField, '==', false)
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
    const languageCounts = { 'en': 0, 'es': 0, 'pt': 0 };

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

          // Track variant distribution (base variant without language suffix)
          const baseVariant = result.templateVariant.replace(/-es$|-pt$|-de$/, '');
          variantCounts[baseVariant] = (variantCounts[baseVariant] || 0) + 1;

          // Track language distribution
          languageCounts[result.language] = (languageCounts[result.language] || 0) + 1;

          const variantEmoji = baseVariant === 'v18-a' ? '🅰️' :
            baseVariant === 'v18-b' ? '🅱️' : '🇨';
          const langEmoji = result.language === 'es' ? '🇪🇸' :
            result.language === 'pt' ? '🇧🇷' : '🇺🇸';
          console.log(`${variantEmoji}${langEmoji} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
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
    console.log(`   Language Distribution: ES=${languageCounts['es']} | EN=${languageCounts['en']} | PT=${languageCounts['pt']}`);

    return {
      status: 'success',
      sent,
      failed,
      total: docsWithEmail.length,
      batchId,
      variantCounts: variantCounts,
      languageCounts: languageCounts
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
 * Spanish MLM Email Campaign
 * Schedule: 4x daily (10:30am, 1:30pm, 4:30pm, 7:30pm PT)
 * Staggered 30 minutes after Paparazzi campaign
 */
const sendHourlySpanishCampaign = onSchedule({
  schedule: "30 10,13,16,19 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processSpanishCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlySpanishCampaign
};
