/**
 * Team Build Pro Email Campaign for BFH (Business For Home) Contacts
 *
 * Sends emails to scraped bfh_contacts (distributors from Business For Home website).
 * Uses Mailgun API with v16 template and single subject line (no A/B testing).
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v16: English (Professional-focused messaging)
 * - v16-es: Spanish
 * - v16-pt: Portuguese (Brazil)
 * - v16-de: German
 *
 * Subject: "Your prospects don't believe they can recruit" (localized per language)
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
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// =============================================================================
// TEMPLATE CONFIGURATION (No A/B Testing)
// =============================================================================

// Language-specific template and subject configuration
const TEMPLATE_CONFIG = {
  en: {
    templateVersion: 'v16',
    subject: "Your prospects don't believe they can recruit",
    subjectTag: 'bfh_v16_en'
  },
  es: {
    templateVersion: 'v16-es',
    subject: 'Tus prospectos de reclutamiento no creen que pueden reclutar',
    subjectTag: 'bfh_v16_es'
  },
  pt: {
    templateVersion: 'v16-pt',
    subject: 'Seus prospectos de recrutamento não acreditam que podem recrutar',
    subjectTag: 'bfh_v16_pt'
  },
  de: {
    templateVersion: 'v16-de',
    subject: 'Ihre Rekrutierungsinteressenten glauben nicht, dass sie rekrutieren können',
    subjectTag: 'bfh_v16_de'
  }
};

// Language-specific CTA domains
const CTA_DOMAINS = {
  en: 'teambuildpro.com',
  es: 'es.teambuildpro.com',
  pt: 'pt.teambuildpro.com',
  de: 'de.teambuildpro.com'
};

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
 * Get language for contact (defaults to English)
 */
function getContactLanguage(contact) {
  return contact.detectedLanguage || 'en';
}

/**
 * Send email via Mailgun API using v14 templates (no A/B testing)
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

  const language = getContactLanguage(contact);
  const templateConfig = TEMPLATE_CONFIG[language] || TEMPLATE_CONFIG.en;

  // Build tracking URLs with language-specific domain
  const ctaDomain = CTA_DOMAINS[language] || CTA_DOMAINS.en;
  const unsubscribeUrl = `https://${ctaDomain}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, templateConfig.subjectTag, language);

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`);
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

  console.log(`   Lang: ${language.toUpperCase()} | Template: V14 | CTA: ${ctaDomain}`);

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
    templateVariant: 'v14',
    language: language,
    usedSubject: templateConfig.subject
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

  // Check if batch size is 0 (effectively paused)
  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeBfh set to 0)`);
    return { status: 'paused', sent: 0 };
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

    // Query strategy: Prioritize personalized contacts, then standard
    // First, get approved personalized contacts
    const personalizedSnapshot = await contactsRef
      .where('personalizationApproved', '==', true)
      .where(sentField, '==', false)
      .limit(batchSize)
      .get();

    let docsWithEmail = personalizedSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.email && data.email.trim() !== '';
    });

    // If we have room, fill with non-personalized contacts
    const remainingSlots = batchSize - docsWithEmail.length;
    if (remainingSlots > 0) {
      const standardSnapshot = await contactsRef
        .where('bfhScraped', '==', true)
        .where('emailSearched', '==', true)
        .where(sentField, '==', false)
        .orderBy('randomIndex')
        .limit(remainingSlots * 2)  // Fetch extra to filter
        .get();

      // Filter: has email AND not already in personalized list
      const personalizedIds = new Set(docsWithEmail.map(d => d.id));
      const additionalDocs = standardSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.email &&
          data.email.trim() !== '' &&
          !personalizedIds.has(doc.id) &&
          data.personalizationApproved !== true;  // Avoid duplicates
      }).slice(0, remainingSlots);

      docsWithEmail = [...docsWithEmail, ...additionalDocs];
    }

    if (docsWithEmail.length === 0) {
      console.log(`✅ ${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    const personalizedCount = docsWithEmail.filter(d => d.data().personalizationApproved === true).length;
    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);
    console.log(`   Personalized: ${personalizedCount} | Standard: ${docsWithEmail.length - personalizedCount}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < docsWithEmail.length; i++) {
      const doc = docsWithEmail[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

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
            mailgunResponse: result.response || '',
            sendStrategy: result.sendStrategy || 'standard_template',
            sentLanguage: result.language || 'en',
            sentSubject: result.usedSubject || '',
            usedPersonalizedSubject: result.hasPersonalizedSubject || false
          };

          await doc.ref.update(updateData);

          const strategyLabel = result.sendStrategy === 'personalized_template' ? '🎯' :
            result.sendStrategy === 'raw_html' ? '🌐' : '📋';
          console.log(`✅ ${strategyLabel} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
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

    // Count send strategies
    const strategyCounts = { personalized_template: 0, raw_html: 0, standard_template: 0 };
    for (const doc of docsWithEmail) {
      const data = doc.data();
      if (data.sent && data.sendStrategy) {
        strategyCounts[data.sendStrategy] = (strategyCounts[data.sendStrategy] || 0) + 1;
      }
    }

    console.log(`\n📊 ${batchId} Complete:`);
    console.log(`   Total processed: ${docsWithEmail.length}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    if (sent > 0) {
      console.log(`   Success rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);
    }
    console.log(`   By strategy:`);
    console.log(`     🎯 Personalized (EN): ${personalizedCount}`);
    console.log(`     🌐 Raw HTML (non-EN): ${strategyCounts.raw_html || 0}`);
    console.log(`     📋 Standard: ${docsWithEmail.length - personalizedCount}`);

    return {
      status: 'success',
      sent,
      failed,
      total: docsWithEmail.length,
      batchId,
      personalizedCount,
      strategies: strategyCounts
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
