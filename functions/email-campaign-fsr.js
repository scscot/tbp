/**
 * FSR (FindSalesRep) Contacts Email Campaign Functions
 *
 * Sends email campaigns to contacts scraped from findsalesrep.com
 * Uses Mailgun API with V18 A/B/C testing (3 template variations for conversion optimization).
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Language Selection: English only for V18 test phase
 *
 * Collection: fsr_contacts
 * Schedule: 10am, 1pm, 4pm, 7pm PT
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

// =============================================================================
// V18 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V18 Template Variants for A/B/C Testing
 * 33% distribution per variant for statistically valid comparison
 *
 * Initial test uses English only to isolate subject/body impact
 */
const V18_VARIANTS = {
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'fsr_v18_a',
    description: 'Curiosity Hook'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'fsr_v18_b',
    description: 'Pain Point Hook'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'fsr_v18_c',
    description: 'Direct Value Hook'
  }
};

/**
 * Select variant using 33% distribution
 * Returns one of: 'v18-a', 'v18-b', 'v18-c'
 */
function selectV18Variant() {
  const rand = Math.random();
  if (rand < 0.333) return 'v18-a';
  if (rand < 0.666) return 'v18-b';
  return 'v18-c';
}

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

async function sendEmailViaMailgun(contact, docId) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // Select V18 variant (33% distribution each)
  const variantKey = selectV18Variant();
  const templateConfig = V18_VARIANTS[variantKey];

  // Build URLs (direct links for better deliverability)
  const utmCampaign = 'fsr_campaign';
  const landingPageUrl = buildLandingPageUrl(utmCampaign, templateConfig.subjectTag);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName || 'Friend'} <${contact.email}>`.trim());
  form.append('subject', templateConfig.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', templateConfig.templateVersion);

  // Mailgun tracking disabled — clicks tracked via GA4 using UTM parameters in direct landing page URLs
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', 'fsr_campaign');
  form.append('o:tag', templateConfig.subjectTag);
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

  console.log(`   V18 Variant: ${variantKey.toUpperCase()} (${templateConfig.description}) | Company: ${contact.company || 'Unknown'}`);

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
    subjectTag: templateConfig.subjectTag,
    templateVariant: variantKey,
    templateVersion: templateConfig.templateVersion,
    variantDescription: templateConfig.description
  };
}

// =============================================================================
// SCHEDULED CAMPAIGN FUNCTION
// =============================================================================

const sendFsrContactsCampaign = onSchedule({
  schedule: "50 0,6,12,18 * * *",  // 4x daily (every 6 hours) - 50 minutes past
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
    console.log(`   V18 A/B/C test with 33% distribution per variant`);

    let sent = 0;
    let failed = 0;
    const sentByCompany = {};
    const variantCounts = { 'v18-a': 0, 'v18-b': 0, 'v18-c': 0 };

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`[${i + 1}/${unsentSnapshot.size}] Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, doc.id);

        if (result.success) {
          await doc.ref.update({
            sent: true,
            sentTimestamp: FieldValue.serverTimestamp(),
            status: 'sent',
            templateVersion: result.templateVersion,
            templateVariant: result.templateVariant,
            subjectTag: result.subjectTag,
            sentSubject: V18_VARIANTS[result.templateVariant].subject,
            variantDescription: result.variantDescription,
            mailgunId: result.messageId || '',
            updatedAt: FieldValue.serverTimestamp()
          });

          // Track variant distribution
          variantCounts[result.templateVariant] = (variantCounts[result.templateVariant] || 0) + 1;

          const variantEmoji = result.templateVariant === 'v18-a' ? '🅰️' :
            result.templateVariant === 'v18-b' ? '🅱️' : '🇨';
          console.log(`${variantEmoji} Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
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
    console.log(`   V18 Distribution: A=${variantCounts['v18-a']} | B=${variantCounts['v18-b']} | C=${variantCounts['v18-c']}`);
    console.log(`   By company: ${JSON.stringify(sentByCompany)}`);

    return {
      status: 'success',
      sent,
      failed,
      total: unsentSnapshot.size,
      byCompany: sentByCompany,
      variantCounts,
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
