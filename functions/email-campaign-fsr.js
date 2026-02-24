/**
 * FSR (FindSalesRep) Contacts Email Campaign Functions
 *
 * Sends email campaigns to contacts scraped from findsalesrep.com
 * Uses v9/v10 Mailgun templates with A/B testing
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db, FieldValue } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const fsrCampaignEnabled = defineString("FSR_CAMPAIGN_ENABLED", { default: "false" });
const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SEND_DELAY_MS = 1000;
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// A/B Test Variants - V9 vs V10 templates
// Subject "Not an opportunity. Just a tool." triggers Gmail spam filter
const AB_TEST_VARIANTS = {
  v9a: {
    templateVersion: 'v9',
    subject: 'AI is changing how teams grow',
    subjectTag: 'fsr_v9a',
    description: 'V9 template + AI curiosity subject'
  },
  v10a: {
    templateVersion: 'v10',
    subject: 'Your AI-powered recruiting assistant',
    subjectTag: 'fsr_v10a',
    description: 'V10 template + AI assistant subject'
  }
};

const ACTIVE_VARIANTS = ['v9a', 'v10a'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildLandingPageUrl(utmCampaign, utmContent) {
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });
  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

async function getDynamicBatchSize() {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists && configDoc.data().batchSizeFsr !== undefined) {
      return configDoc.data().batchSizeFsr;
    }
  } catch (error) {
    console.log(`Could not read config: ${error.message}`);
  }
  return 0; // Default paused
}

async function isCampaignEnabled() {
  try {
    // Campaign is enabled if batchSizeFsr > 0
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      const batchSize = configDoc.data().batchSizeFsr;
      return batchSize !== undefined && batchSize > 0;
    }
  } catch (error) {
    console.log(`Could not read config: ${error.message}`);
  }
  return false;
}

// =============================================================================
// EMAIL SENDER
// =============================================================================

async function sendEmailViaMailgun(contact, docId, index) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // A/B Test: Strict alternation between active variants
  const templateVariant = ACTIVE_VARIANTS[index % ACTIVE_VARIANTS.length];
  const variant = AB_TEST_VARIANTS[templateVariant];

  // Build URLs (direct links for better deliverability)
  const utmCampaign = 'fsr_campaign';
  const landingPageUrl = buildLandingPageUrl(utmCampaign, variant.subjectTag);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName || 'Friend'} <${contact.email}>`.trim());
  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Mailgun tracking disabled — clicks tracked via GA4 using UTM parameters in direct landing page URLs
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', 'fsr_campaign');
  form.append('o:tag', variant.templateVersion);
  form.append('o:tag', variant.subjectTag);
  if (contact.company) {
    form.append('o:tag', `company_${contact.company.toLowerCase().replace(/\s+/g, '_')}`);
  }

  // List-Unsubscribe headers
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables (using direct landing page URL for deliverability)
  const templateVars = {
    first_name: contact.firstName || 'Friend',
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log(`   Company: ${contact.company || 'Unknown'} | Template: ${templateVariant.toUpperCase()}`);

  // Send via Mailgun API
  const response = await axios.post(
    `https://api.mailgun.net/v3/${domain}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    }
  );

  return {
    success: true,
    messageId: response.data.id,
    response: response.data.message,
    subjectTag: variant.subjectTag,
    templateVariant
  };
}

// =============================================================================
// SCHEDULED CAMPAIGN FUNCTION
// =============================================================================

const sendFsrContactsCampaign = onSchedule({
  schedule: "0 10,13,16,19 * * *", // 10am, 1pm, 4pm, 7pm PT
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 300
}, async () => {
  console.log("FSR CONTACTS CAMPAIGN: Starting batch email send");

  // Check if enabled via Firestore config
  const enabled = await isCampaignEnabled();
  if (!enabled) {
    console.log("FSR CONTACTS CAMPAIGN: Disabled in config (batchSizeFsr=0). Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  // Also check environment variable
  const envEnabled = fsrCampaignEnabled.value().toLowerCase() === 'true';
  if (!envEnabled) {
    console.log("FSR CONTACTS CAMPAIGN: Disabled via environment variable. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  const batchSize = await getDynamicBatchSize();
  console.log(`FSR CONTACTS CAMPAIGN: Batch size set to ${batchSize}`);

  try {
    const batchId = `fsr_batch_${Date.now()}`;
    const contactsRef = db.collection('fsr_contacts');

    // Get unsent contacts with email, ordered by randomIndex for fair distribution
    const unsentSnapshot = await contactsRef
      .where('sent', '==', false)
      .where('email', '!=', null)
      .orderBy('email')  // Required for != query
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log("FSR CONTACTS CAMPAIGN: No unsent contacts. Campaign complete!");
      return { status: 'complete', sent: 0 };
    }

    console.log(`FSR CONTACTS CAMPAIGN: Processing ${unsentSnapshot.size} contacts in ${batchId}`);

    let sent = 0;
    let failed = 0;
    const sentByCompany = {};

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`[${i + 1}/${unsentSnapshot.size}] Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, doc.id, i);

        if (result.success) {
          await doc.ref.update({
            sent: true,
            sentTimestamp: FieldValue.serverTimestamp(),
            status: 'sent',
            templateVersion: result.templateVariant,
            subjectTag: result.subjectTag,
            mailgunId: result.messageId || '',
            updatedAt: FieldValue.serverTimestamp()
          });

          console.log(`Sent to ${contact.email} (${contact.company}/${result.templateVariant})`);
          sent++;

          // Track by company
          const company = contact.company || 'unknown';
          sentByCompany[company] = (sentByCompany[company] || 0) + 1;
        } else {
          throw new Error(result.error || 'Unknown error');
        }

        // Rate limiting
        if (i < unsentSnapshot.size - 1) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`Failed to send to ${contact.email}: ${errorMessage}`);

        await doc.ref.update({
          sent: false,
          status: 'failed',
          errorMessage,
          updatedAt: FieldValue.serverTimestamp()
        });

        failed++;
      }
    }

    console.log(`\n${batchId} Complete:`);
    console.log(`   Total processed: ${unsentSnapshot.size}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   By company: ${JSON.stringify(sentByCompany)}`);

    return {
      status: 'success',
      sent,
      failed,
      total: unsentSnapshot.size,
      byCompany: sentByCompany,
      batchId
    };

  } catch (error) {
    console.error("FSR CONTACTS CAMPAIGN: Batch failed:", error.message);
    throw error;
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendFsrContactsCampaign
};
