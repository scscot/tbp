/**
 * Team Build Pro Email Campaign for Rodan + Fields Contacts
 *
 * Sends emails to scraped rodanfields_contacts (former R+F consultants).
 * Note: R+F abandoned their MLM model in Sept 2024, but former consultants
 * likely moved to other MLM companies and are still valid prospects.
 *
 * Uses Mailgun API with V18 A/B/C testing (3 template variations).
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Collection: rodanfields_contacts
 * Query: status == 'pending', sent == false
 * Schedule: 11am, 2pm, 5pm, 8pm PT (staggered from other campaigns)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const rodanfieldsCampaignEnabled = defineString("RODANFIELDS_CAMPAIGN_ENABLED", { default: "true" });
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
// V18 A/B/C TEMPLATE CONFIGURATION
// =============================================================================

const V18_VARIANTS = {
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'rodanfields_v18_a',
    description: 'Curiosity Hook'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'rodanfields_v18_b',
    description: 'Pain Point Hook'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'rodanfields_v18_c',
    description: 'Direct Value Hook'
  }
};

function selectV18Variant() {
  const rand = Math.random();
  if (rand < 0.333) return 'v18-a';
  if (rand < 0.666) return 'v18-b';
  return 'v18-c';
}

// =============================================================================
// CAMPAIGN CONFIGURATION
// =============================================================================

const CAMPAIGN_CONFIG = {
  name: 'RODANFIELDS EMAIL CAMPAIGN',
  logPrefix: '💄',
  batchIdPrefix: 'rodanfields_batch',
  sentField: 'sent',
  utmCampaign: 'rodanfields_outreach_mar',
  campaignTag: 'rodanfields_campaign',
  collection: 'rodanfields_contacts'
};

// =============================================================================
// DYNAMIC BATCH SIZE
// =============================================================================

async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      const rodanfieldsBatchSize = configDoc.data().batchSizeRodanfields;
      const sharedBatchSize = configDoc.data().batchSize;

      if (rodanfieldsBatchSize !== undefined) {
        console.log(`Using Firestore R+F batch size: ${rodanfieldsBatchSize}`);
        return rodanfieldsBatchSize;
      }
      if (sharedBatchSize) {
        console.log(`Using Firestore shared batch size: ${sharedBatchSize}`);
        return sharedBatchSize;
      }
    }
  } catch (error) {
    console.log(`Could not read Firestore config: ${error.message}`);
  }
  const fallbackSize = parseInt(envFallback);
  console.log(`Using .env fallback batch size: ${fallbackSize}`);
  return fallbackSize;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

async function sendEmailViaMailgun(contact, docId, config, subjectSuffix = '') {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  const variantKey = selectV18Variant();
  const templateConfig = V18_VARIANTS[variantKey];

  const unsubscribeUrl = `https://${CTA_DOMAIN}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, templateConfig.subjectTag);

  const form = new FormData();
  form.append('from', FROM_ADDRESS);

  const recipientName = contact.lastName
    ? `${contact.firstName} ${contact.lastName}`
    : contact.firstName;
  form.append('to', `${recipientName} <${contact.email}>`);

  const fullSubject = subjectSuffix ? `${templateConfig.subject} ${subjectSuffix}` : templateConfig.subject;
  form.append('subject', fullSubject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', templateConfig.templateVersion);

  const templateVars = {
    first_name: contact.firstName,
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  form.append('o:tag', config.campaignTag);
  form.append('o:tag', templateConfig.subjectTag);
  form.append('o:tag', 'tracked');

  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  console.log(`   V18 Variant: ${variantKey.toUpperCase()} (${templateConfig.description})`);

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
    usedSubject: fullSubject,
    variantDescription: templateConfig.description
  };
}

// =============================================================================
// CAMPAIGN PROCESSOR
// =============================================================================

async function processRodanfieldsCampaignBatch(batchSize) {
  const config = CAMPAIGN_CONFIG;
  const { name, logPrefix, batchIdPrefix, sentField, collection } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = rodanfieldsCampaignEnabled.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  if (batchSize === 0) {
    console.log(`${logPrefix} ${name}: Paused (batchSizeRodanfields set to 0)`);
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

    const snapshot = await contactsRef
      .where('status', '==', 'pending')
      .where(sentField, '==', false)
      .orderBy('randomIndex')
      .limit(batchSize * 2)
      .get();

    const docsWithEmail = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.email && data.email.trim() !== '';
    }).slice(0, batchSize);

    if (docsWithEmail.length === 0) {
      console.log(`${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    console.log(`${logPrefix} ${name}: Processing ${docsWithEmail.length} emails in ${batchId}`);
    console.log(`   V18 A/B/C test with 33% distribution per variant`);

    let sent = 0;
    let failed = 0;
    const variantCounts = { 'v18-a': 0, 'v18-b': 0, 'v18-c': 0 };

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
            variantDescription: result.variantDescription,
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);
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
      variantCounts,
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

const sendHourlyRodanfieldsCampaign = onSchedule({
  schedule: "0 19,22,1,4 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());
  return processRodanfieldsCampaignBatch(batchSize);
});

// =============================================================================
// HTTP TEST ENDPOINT
// =============================================================================

const testRodanfieldsEmail = onRequest({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60
}, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const { email, subjectSuffix } = req.body || {};

  if (!email) {
    res.status(400).json({ error: 'Missing required field: email' });
    return;
  }

  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    res.status(500).json({ error: 'TBP_MAILGUN_API_KEY not configured' });
    return;
  }

  console.log(`💄 RODANFIELDS TEST: Sending test email to ${email}`);

  const testContact = {
    firstName: 'Stephen',
    lastName: 'Scott',
    email: email
  };

  const testConfig = {
    ...CAMPAIGN_CONFIG,
    utmCampaign: 'rodanfields_test'
  };

  try {
    const result = await sendEmailViaMailgun(testContact, `test_${Date.now()}`, testConfig, subjectSuffix || '');

    console.log(`💄 Test sent (${result.templateVariant}): ${result.messageId}`);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      email,
      summary: { sent: 1, failed: 0, total: 1 },
      results: [{
        variant: result.templateVariant,
        success: true,
        messageId: result.messageId,
        subject: result.usedSubject,
        templateVersion: result.templateVersion,
        variantDescription: result.variantDescription
      }]
    });
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error(`💄 Test failed: ${errorMessage}`);

    res.json({
      success: false,
      timestamp: new Date().toISOString(),
      email,
      summary: { sent: 0, failed: 1, total: 1 },
      results: [{
        variant: 'v18 (random)',
        success: false,
        error: errorMessage
      }]
    });
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyRodanfieldsCampaign,
  testRodanfieldsEmail
};
