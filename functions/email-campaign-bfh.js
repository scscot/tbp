/**
 * Team Build Pro Email Campaign for BFH (Business For Home) Contacts
 *
 * Sends emails to scraped bfh_contacts (distributors from Business For Home website).
 * Uses Mailgun API with template versioning and AI personalization.
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v9: Minimal version without bullet points
 * - v10: Version with specific value prop bullets
 * - v11: V9 + personalized_intro support (AI personalization)
 * - v12: V10 + personalized_intro support (AI personalization)
 *
 * Hybrid Send Strategy:
 * - English contacts with AI personalization → V11/V12 with personalized_intro variable
 * - Non-English contacts (ES/PT/DE) with AI personalization → Raw HTML email
 * - Contacts without personalization → Standard V9/V10 templates
 *
 * Current A/B Test (4-way for non-personalized, 2-way for personalized):
 * - v9a/v9b/v10a/v10b: Standard templates (no personalization)
 * - v11a/v12a: Personalized templates (English only)
 *
 * Collection: bfh_contacts
 * Query: personalizationApproved == true OR (bfhScraped == true, email != null), sent == false
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
// A/B TEST CONFIGURATIONS
// =============================================================================

// A/B Test Variants - Standard (no personalization)
// Subject "Not an opportunity. Just a tool." triggers Gmail spam filter - using safe alternatives
const STANDARD_VARIANTS = {
  v9a: {
    templateVersion: 'v9',
    subject: 'AI is changing how teams grow',
    subjectTag: 'bfh_v9a',
    description: 'V9 (no bullets) + AI curiosity'
  },
  v9b: {
    templateVersion: 'v9',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'bfh_v9b',
    description: 'V9 (no bullets) + AI assistant'
  },
  v10a: {
    templateVersion: 'v10',
    subject: 'AI is changing how teams grow',
    subjectTag: 'bfh_v10a',
    description: 'V10 (with bullets) + AI curiosity'
  },
  v10b: {
    templateVersion: 'v10',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'bfh_v10b',
    description: 'V10 (with bullets) + AI assistant'
  }
};

// A/B Test Variants - Personalized (English only)
// Subject "Not an opportunity. Just a tool." triggers Gmail spam filter - using safe alternatives
const PERSONALIZED_VARIANTS = {
  v11a: {
    templateVersion: 'v11',
    subject: 'AI is changing how teams grow',
    subjectTag: 'bfh_v11a_personalized',
    description: 'V11 (personalized) + AI curiosity'
  },
  v12a: {
    templateVersion: 'v12',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'bfh_v12a_personalized',
    description: 'V12 (personalized) + AI assistant'
  }
};

// Active variants for A/B testing
const ACTIVE_STANDARD_VARIANTS = ['v9a', 'v9b', 'v10a', 'v10b'];
const ACTIVE_PERSONALIZED_VARIANTS = ['v11a', 'v12a'];

// Language-specific CTA domains
const CTA_DOMAINS = {
  en: 'teambuildpro.com',
  es: 'es.teambuildpro.com',
  pt: 'pt.teambuildpro.com',
  de: 'de.teambuildpro.com'
};

// For backwards compatibility
const AB_TEST_VARIANTS = { ...STANDARD_VARIANTS, ...PERSONALIZED_VARIANTS };
const ACTIVE_VARIANTS = ACTIVE_STANDARD_VARIANTS;

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
 * Determine send strategy based on contact personalization status
 */
function determineSendStrategy(contact) {
  const hasPersonalization = contact.personalizationApproved === true;
  const language = contact.detectedLanguage || 'en';
  const isEnglish = language === 'en';

  if (hasPersonalization && isEnglish && contact.personalizedIntro) {
    return { type: 'personalized_template', language };
  } else if (hasPersonalization && !isEnglish && contact.personalizedHtml) {
    return { type: 'raw_html', language };
  } else {
    return { type: 'standard_template', language };
  }
}

/**
 * Send email via Mailgun API using templates with A/B testing
 *
 * Supports three modes:
 * 1. personalized_template: V11/V12 with personalized_intro variable (English)
 * 2. raw_html: Full AI-generated HTML email (non-English)
 * 3. standard_template: Standard V9/V10 templates (fallback)
 *
 * @param {object} contact - Contact data { firstName, lastName, email, ... }
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

  const strategy = determineSendStrategy(contact);
  const language = strategy.language;

  // Build tracking URLs with language-specific domain
  const ctaDomain = CTA_DOMAINS[language] || CTA_DOMAINS.en;
  const unsubscribeUrl = `https://${ctaDomain}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName} ${contact.lastName || ''} <${contact.email}>`);

  let templateVariant, variant, subjectTag, usedSubject, hasPersonalizedSubject = false;

  if (strategy.type === 'personalized_template') {
    // English with personalized_intro → V11/V12 template
    templateVariant = ACTIVE_PERSONALIZED_VARIANTS[index % ACTIVE_PERSONALIZED_VARIANTS.length];
    variant = PERSONALIZED_VARIANTS[templateVariant];

    // Use AI-generated personalized subject if available, otherwise fall back to A/B test subject
    hasPersonalizedSubject = !!contact.personalizedSubject;
    usedSubject = contact.personalizedSubject || variant.subject;
    subjectTag = hasPersonalizedSubject ? `${variant.subjectTag}_ai_subject` : variant.subjectTag;

    const landingPageUrl = buildLandingPageUrl(config.utmCampaign, subjectTag, language);

    form.append('subject', usedSubject);
    form.append('template', TEMPLATE_NAME);
    form.append('t:version', variant.templateVersion);

    // Template variables with personalized_intro (using direct landing page URL for deliverability)
    const templateVars = {
      first_name: contact.firstName,
      personalized_intro: contact.personalizedIntro,
      tracked_cta_url: landingPageUrl,
      unsubscribe_url: unsubscribeUrl
    };
    form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

    const subjectInfo = hasPersonalizedSubject ? `AI Subject: "${usedSubject.substring(0, 40)}..."` : `A/B Subject: "${variant.subject}"`;
    console.log(`   Mode: PERSONALIZED | Template: ${templateVariant.toUpperCase()} | ${subjectInfo}`);

  } else if (strategy.type === 'raw_html') {
    // Non-English with full HTML → Raw email send
    templateVariant = `raw_${language}`;
    subjectTag = `bfh_personalized_${language}`;

    const landingPageUrl = buildLandingPageUrl(config.utmCampaign, subjectTag, language);

    // Replace placeholders in the HTML (using direct landing page URL for deliverability)
    let html = contact.personalizedHtml;
    html = html.replace(/\{\{tracked_cta_url\}\}/g, landingPageUrl);
    html = html.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
    html = html.replace(/\{\{first_name\}\}/g, contact.firstName);

    // Subject line in recipient's language (using spam-safe subjects)
    const localizedSubjects = {
      es: 'La IA esta cambiando como crecen los equipos',
      pt: 'A IA esta mudando como as equipes crescem',
      de: 'KI verandert, wie Teams wachsen'
    };
    usedSubject = localizedSubjects[language] || 'AI is changing how teams grow';
    form.append('subject', usedSubject);
    form.append('html', html);

    console.log(`   Mode: RAW HTML | Lang: ${language.toUpperCase()} | CTA: ${ctaDomain}`);

  } else {
    // Standard template (no personalization)
    templateVariant = ACTIVE_STANDARD_VARIANTS[index % ACTIVE_STANDARD_VARIANTS.length];
    variant = STANDARD_VARIANTS[templateVariant];
    subjectTag = variant.subjectTag;

    const landingPageUrl = buildLandingPageUrl(config.utmCampaign, subjectTag, language);

    usedSubject = variant.subject;
    form.append('subject', usedSubject);
    form.append('template', TEMPLATE_NAME);
    form.append('t:version', variant.templateVersion);

    // Template variables (using direct landing page URL for deliverability)
    const templateVars = {
      first_name: contact.firstName,
      tracked_cta_url: landingPageUrl,
      unsubscribe_url: unsubscribeUrl
    };
    form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

    console.log(`   Mode: STANDARD | Template: ${templateVariant.toUpperCase()} | Subject: "${usedSubject}"`);
  }

  // Mailgun tracking disabled — clicks tracked via GA4 using UTM parameters in direct landing page URLs
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', config.campaignTag);
  form.append('o:tag', strategy.type);
  form.append('o:tag', subjectTag);
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
    subjectTag: subjectTag,
    templateVariant: templateVariant,
    sendStrategy: strategy.type,
    language: language,
    usedSubject: usedSubject,
    hasPersonalizedSubject: hasPersonalizedSubject
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
