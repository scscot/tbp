/**
 * Team Build Pro Email Campaign for MLM Contacts (Multi-Language)
 *
 * Sends emails to mlm_contacts discovered via the MLM Signal Monitor pipeline.
 * Uses Mailgun API with V18 A/B/C testing (3 template variations for conversion optimization).
 * Supports multilingual contacts with language routing based on detectedLanguage field or profileUrl.
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Multilingual Templates in Mailgun 'mailer' template:
 * - v18-a, v18-b, v18-c: English variants
 * - v18-a-es, v18-b-es, v18-c-es: Spanish variants
 * - v18-a-pt, v18-b-pt, v18-c-pt: Portuguese variants
 * - v18-a-de, v18-b-de, v18-c-de: German variants
 *
 * Language Selection Priority:
 * 1. contact.detectedLanguage field (if present)
 * 2. Inferred from profileUrl domain (.de, .es, .com.br, etc.)
 * 3. Default to English
 *
 * Corporate Email Filtering:
 * - Excludes support@, info@, help@, admin@, etc.
 * - Excludes known corporate domains (nuskin.com, colorstreet.com, etc.)
 *
 * Collection: mlm_contacts
 * Query: status == 'pending', sent == false, email != null
 * Schedule: 10:15 AM, 1:15 PM, 4:15 PM, 7:15 PM PT (4x daily)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const mlmCampaignEnabled = defineString("MLM_CAMPAIGN_ENABLED", { default: "false" });
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
// PERSONAL EMAIL WHITELIST (Only allow known personal email domains)
// =============================================================================

/**
 * Whitelist of personal email domains - ONLY these domains are allowed
 * This is more conservative than a blacklist approach
 */
const PERSONAL_EMAIL_DOMAINS = [
  // Major free email providers
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'msn.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'mail.com', 'gmx.com', 'gmx.net', 'ymail.com', 'rocketmail.com', 'zoho.com',
  // Canadian ISPs
  'rogers.com', 'shaw.ca', 'telus.net', 'bell.net', 'sympatico.ca', 'cogeco.ca',
  // US ISPs
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net', 'charter.net',
  'earthlink.net', 'optonline.net', 'frontier.com', 'windstream.net',
  // UK ISPs
  'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net', 'ntlworld.com',
  // German providers
  'web.de', 'freenet.de', 't-online.de', 'gmx.de', 'arcor.de', '1und1.de',
  // French providers
  'orange.fr', 'free.fr', 'sfr.fr', 'wanadoo.fr', 'laposte.net',
  // Italian providers
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it', 'tiscali.it',
  // Spanish providers
  'telefonica.net', 'movistar.es', 'ya.com', 'terra.es',
  // Brazilian providers
  'terra.com.br', 'uol.com.br', 'bol.com.br', 'globo.com', 'ig.com.br',
  // Other international
  'mail.ru', 'yandex.ru', 'yandex.com', 'qq.com', '163.com', '126.com',
  'naver.com', 'daum.net', 'hanmail.net',
];

/**
 * Check if email is a personal email (whitelist approach)
 * Returns true if email should be EXCLUDED (not personal)
 */
function isExcludedEmail(email) {
  if (!email) return true;

  const emailLower = email.toLowerCase();
  const atIndex = emailLower.indexOf('@');
  if (atIndex === -1) return true;

  const domain = emailLower.substring(atIndex + 1);

  // Only allow emails from known personal domains
  return !PERSONAL_EMAIL_DOMAINS.includes(domain);
}

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

/**
 * Domain patterns to language mapping for profileUrl inference
 */
const DOMAIN_LANGUAGE_MAP = {
  // German
  '.de': 'de',
  '.at': 'de',
  '.ch': 'de', // Swiss German (could be French/Italian too, but defaulting to German)

  // Spanish
  '.es': 'es',
  '.mx': 'es',
  '.ar': 'es',
  '.co': 'es',
  '.cl': 'es',
  '.pe': 'es',
  '.ve': 'es',

  // Portuguese
  '.br': 'pt',
  '.pt': 'pt',
  '.com.br': 'pt'
};

// =============================================================================
// V18 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V18 Template Variants for A/B/C Testing (Multilingual)
 * 33% distribution per variant for statistically valid comparison
 *
 * Each variant available in EN, ES, PT, DE
 */
const V18_VARIANTS = {
  // English variants
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'mlm_v18_a_en',
    description: 'Curiosity Hook (EN)',
    language: 'en'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'mlm_v18_b_en',
    description: 'Pain Point Hook (EN)',
    language: 'en'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'mlm_v18_c_en',
    description: 'Direct Value Hook (EN)',
    language: 'en'
  },
  // Spanish variants
  'v18-a-es': {
    templateVersion: 'v18-a-es',
    subject: '¿Y si tu próximo recluta llegara con 12 personas?',
    subjectTag: 'mlm_v18_a_es',
    description: 'Curiosity Hook (ES)',
    language: 'es'
  },
  'v18-b-es': {
    templateVersion: 'v18-b-es',
    subject: 'El 75% de tus reclutas renunciarán este año (descubre por qué)',
    subjectTag: 'mlm_v18_b_es',
    description: 'Pain Point Hook (ES)',
    language: 'es'
  },
  'v18-c-es': {
    templateVersion: 'v18-c-es',
    subject: 'Dale a tus prospectos un coach de reclutamiento con IA',
    subjectTag: 'mlm_v18_c_es',
    description: 'Direct Value Hook (ES)',
    language: 'es'
  },
  // Portuguese variants
  'v18-a-pt': {
    templateVersion: 'v18-a-pt',
    subject: 'E se o seu próximo recruta chegasse com 12 pessoas?',
    subjectTag: 'mlm_v18_a_pt',
    description: 'Curiosity Hook (PT)',
    language: 'pt'
  },
  'v18-b-pt': {
    templateVersion: 'v18-b-pt',
    subject: '75% dos seus recrutas vão desistir este ano (saiba por quê)',
    subjectTag: 'mlm_v18_b_pt',
    description: 'Pain Point Hook (PT)',
    language: 'pt'
  },
  'v18-c-pt': {
    templateVersion: 'v18-c-pt',
    subject: 'Dê aos seus prospectos um coach de recrutamento com IA',
    subjectTag: 'mlm_v18_c_pt',
    description: 'Direct Value Hook (PT)',
    language: 'pt'
  },
  // German variants
  'v18-a-de': {
    templateVersion: 'v18-a-de',
    subject: 'Was wenn Ihr nächster Rekrut mit 12 Leuten kommt?',
    subjectTag: 'mlm_v18_a_de',
    description: 'Curiosity Hook (DE)',
    language: 'de'
  },
  'v18-b-de': {
    templateVersion: 'v18-b-de',
    subject: '75% Ihrer Rekruten werden dieses Jahr aufhören (hier ist warum)',
    subjectTag: 'mlm_v18_b_de',
    description: 'Pain Point Hook (DE)',
    language: 'de'
  },
  'v18-c-de': {
    templateVersion: 'v18-c-de',
    subject: 'Geben Sie Ihren Interessenten einen KI-Recruiting-Coach',
    subjectTag: 'mlm_v18_c_de',
    description: 'Direct Value Hook (DE)',
    language: 'de'
  }
};

/**
 * Select variant using 33% distribution with language support
 * @param {string} language - Contact language (en, es, pt, de)
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
  name: 'MLM EMAIL CAMPAIGN',
  logPrefix: '📡',
  batchIdPrefix: 'mlm_batch',
  sentField: 'sent',
  utmCampaign: 'mlm_outreach',
  campaignTag: 'mlm_campaign',
  collection: 'mlm_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * Uses batchSizeMlm field if available, otherwise uses shared batchSize
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      // Try MLM-specific batch size first, then fall back to shared
      const mlmBatchSize = configDoc.data().batchSizeMlm;
      const sharedBatchSize = configDoc.data().batchSize;

      if (mlmBatchSize !== undefined) {
        console.log(`Using Firestore MLM batch size: ${mlmBatchSize}`);
        return mlmBatchSize;
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
 * Priority: detectedLanguage field > profileUrl domain inference > default (en)
 */
function getContactLanguage(contact) {
  // Priority 1: Explicit detectedLanguage field
  if (contact.detectedLanguage && SUPPORTED_LANGUAGES.includes(contact.detectedLanguage)) {
    return contact.detectedLanguage;
  }

  // Priority 2: Infer from profileUrl domain
  if (contact.profileUrl) {
    const url = contact.profileUrl.toLowerCase();
    for (const [domainPattern, lang] of Object.entries(DOMAIN_LANGUAGE_MAP)) {
      if (url.includes(domainPattern)) {
        return lang;
      }
    }
  }

  // Default to English
  return 'en';
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
 * @param {object} contact - Contact data { firstName, lastName, email, profileUrl, ... }
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

  // Determine language from contact
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
    : contact.firstName || 'Friend';
  form.append('to', `${recipientName} <${contact.email}>`);

  form.append('subject', templateConfig.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', templateConfig.templateVersion);

  // Template variables (using direct landing page URL for deliverability)
  const templateVars = {
    first_name: contact.firstName || 'Friend',
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

async function processMlmCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = mlmCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeMlm set to 0)`);
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
      .limit(batchSize * 3)  // Fetch extra to filter out corporate emails
      .get();

    // Filter contacts with valid, non-corporate emails
    const validContacts = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (!data.email || data.email.trim() === '') return false;
      if (isExcludedEmail(data.email)) {
        console.log(`   Skipping corporate email: ${data.email}`);
        return false;
      }
      return true;
    }).slice(0, batchSize);

    if (validContacts.length === 0) {
      console.log(`${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    // Track variant distribution (will be populated during send)
    const variantCounts = { 'v18-a': 0, 'v18-b': 0, 'v18-c': 0 };
    const languageCounts = { en: 0, es: 0, pt: 0, de: 0 };

    console.log(`${logPrefix} ${name}: Processing ${validContacts.length} emails in ${batchId}`);
    console.log(`   V18 A/B/C multilingual test (EN/ES/PT/DE) with 33% distribution per variant`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < validContacts.length; i++) {
      const doc = validContacts[i];
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
          const baseVariant = result.templateVariant.replace(/-(?:es|pt|de)$/, '');
          variantCounts[baseVariant] = (variantCounts[baseVariant] || 0) + 1;
          languageCounts[result.language] = (languageCounts[result.language] || 0) + 1;

          const variantEmoji = baseVariant === 'v18-a' ? '🅰️' :
            baseVariant === 'v18-b' ? '🅱️' : '🇨';
          console.log(`${variantEmoji} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
          sent++;
        } else {
          throw new Error(result.error || 'Unknown Mailgun error');
        }

        if (sent < validContacts.length) {
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
    console.log(`   Total processed: ${validContacts.length}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    if (sent > 0) {
      console.log(`   Success rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);
    }
    console.log(`   V18 Distribution: A=${variantCounts['v18-a']} | B=${variantCounts['v18-b']} | C=${variantCounts['v18-c']}`);
    console.log(`   Language Distribution: EN=${languageCounts.en} | ES=${languageCounts.es} | PT=${languageCounts.pt} | DE=${languageCounts.de}`);

    return {
      status: 'success',
      sent,
      failed,
      total: validContacts.length,
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
 * MLM Email Campaign
 * Schedule: 4x daily - 10:15 AM, 1:15 PM, 4:15 PM, 7:15 PM PT
 * (Staggered 15 minutes after other campaigns)
 */
const sendHourlyMlmCampaign = onSchedule({
  schedule: "15 10,13,16,19 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processMlmCampaignBatch(batchSize);
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyMlmCampaign
};
