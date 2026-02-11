/**
 * Team Build Pro Email Campaign Functions (Mailgun Templates Version)
 *
 * Scheduled email campaigns using Mailgun API with template versioning.
 * A/B tests between V1 and V2 template versions with paired subject lines.
 *
 * Templates stored in Mailgun under 'mailer' template:
 * - v1: "Not an opportunity" - Personal disarm approach
 * - v2: "Pre-Build Advantage" - Unique differentiator hook
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const emailCampaignEnabled = defineString("EMAIL_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignSyncEnabled = defineString("EMAIL_CAMPAIGN_SYNC_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SEND_DELAY_MS = 1000;
const TRACKING_BASE_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// =============================================================================
// A/B TEST CONFIGURATIONS
// =============================================================================

const AB_TEST_VARIANTS = {
  v3: {
    templateVersion: 'v3',
    subject: "The future of direct sales is here",
    subjectTag: 'mobile_first_v3',
    description: 'Pattern interrupt - anti-pitch positioning'
  },
  v4: {
    templateVersion: 'v4',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'mobile_first_v4',
    description: 'Flip the script - confidence before joining'
  }
};

// =============================================================================
// CAMPAIGN CONFIGURATIONS
// =============================================================================

const CAMPAIGN_CONFIGS = {
  main: {
    name: 'HOURLY EMAIL CAMPAIGN',
    logPrefix: '📧',
    batchIdPrefix: 'mailgun_batch',
    sentField: 'sent',
    utmCampaign: 'tbp_mailgun_campaign',
    campaignTag: 'tbp_campaign'
  }
};

// =============================================================================
// DYNAMIC BATCH SIZE (from Firestore config, with .env fallback)
// =============================================================================

/**
 * Get batch size from Firestore config document, falling back to .env value
 * This allows GitHub Actions to update batch sizes without redeploying functions
 */
async function getDynamicBatchSize(envFallback) {
  try {
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists && configDoc.data().batchSize) {
      const firestoreBatchSize = configDoc.data().batchSize;
      console.log(`📊 Using Firestore batch size: ${firestoreBatchSize}`);
      return firestoreBatchSize;
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
 * Build a click-tracked URL that redirects through our Cloud Function
 */
function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

/**
 * Build destination URL with UTM parameters
 */
function buildLandingPageUrl(utmCampaign, utmContent) {
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });
  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

// =============================================================================
// MAILGUN EMAIL SENDER
// =============================================================================

/**
 * Send email via Mailgun API using templates with A/B testing
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
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

  // A/B Test: Strict alternation between V1 and V2 templates
  const templateVariant = index % 2 === 0 ? 'v3' : 'v4';
  const variant = AB_TEST_VARIANTS[templateVariant];

  // Build tracking URLs
  const landingPageUrl = buildLandingPageUrl(config.utmCampaign, variant.subjectTag);
  const trackedCtaUrl = buildClickUrl(docId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Tracking disabled — using Firestore-based tracking via trackEmailClick Cloud Function
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', config.campaignTag);
  form.append('o:tag', variant.templateVersion);
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', 'tracked');

  // List-Unsubscribe headers (required by Gmail for bulk senders)
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables
  const templateVars = {
    first_name: contact.firstName,
    tracked_cta_url: trackedCtaUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log(`   Template: ${templateVariant.toUpperCase()} | Subject: "${variant.subject}"`);

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
    templateVariant: templateVariant
  };
}

// =============================================================================
// SHARED CAMPAIGN PROCESSOR
// =============================================================================

async function processCampaignBatch(config, enabledParam, batchSize) {
  const { name, logPrefix, batchIdPrefix, sentField } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = enabledParam.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    console.error(`❌ ${name}: TBP_MAILGUN_API_KEY not configured`);
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`${logPrefix} ${name}: Batch size set to ${batchSize}`);

  try {
    const batchId = `${batchIdPrefix}_${Date.now()}`;
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    const unsentSnapshot = await contactsRef
      .where(sentField, '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log(`✅ ${name}: No unsent emails found. Campaign complete!`);
      return { status: 'complete', sent: 0 };
    }

    console.log(`${logPrefix} ${name}: Processing ${unsentSnapshot.size} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    // Determine field names based on config (for resend campaigns)
    const timestampField = config.timestampField || 'sentTimestamp';
    const statusField = config.statusField || 'status';
    const errorField = config.errorField || 'errorMessage';
    const messageIdField = config.messageIdField || 'mailgunId';
    const lastAttemptField = config.lastAttemptField || 'lastAttempt';

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, doc.id, config, i);

        if (result.success) {
          const updateData = {
            [sentField]: true,
            [timestampField]: new Date(),
            batchId: batchId,
            [statusField]: 'sent',
            [errorField]: '',
            [messageIdField]: result.messageId || '',
            subjectTag: result.subjectTag,
            templateVariant: result.templateVariant,
            mailgunResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          console.log(`✅ Sent to ${contact.email} (${result.templateVariant}): ${result.messageId}`);
          sent++;
        } else {
          throw new Error(result.error || 'Unknown Mailgun error');
        }

        if (sent < unsentSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`❌ Failed to send to ${contact.email}: ${errorMessage}`);

        await doc.ref.update({
          [sentField]: false,
          batchId: batchId,
          [statusField]: 'failed',
          [errorField]: errorMessage,
          [lastAttemptField]: new Date()
        });

        failed++;
      }
    }

    console.log(`\n📊 ${batchId} Complete:`);
    console.log(`   Total processed: ${unsentSnapshot.size}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    if (sent > 0) {
      console.log(`   Success rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);
    }

    return {
      status: 'success',
      sent,
      failed,
      total: unsentSnapshot.size,
      batchId
    };

  } catch (error) {
    console.error(`💥 ${name}: Batch failed:`, error.message);
    throw error;
  }
}

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

const sendHourlyEmailCampaign = onSchedule({
  schedule: "0 8,11,14,17 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  // Get batch size from Firestore (updated by GitHub Actions) or fall back to .env
  const batchSize = await getDynamicBatchSize(emailCampaignBatchSize.value());

  return processCampaignBatch(
    CAMPAIGN_CONFIGS.main,
    emailCampaignEnabled,
    batchSize
  );
});

// =============================================================================
// MAILGUN EVENT SYNC (Main Campaign)
// =============================================================================

/**
 * Sync Mailgun delivery/engagement events to Firestore
 * Runs 10 minutes after each campaign window to capture events
 * Prevents data loss since Mailgun logs expire after ~30 days
 */
const syncMailgunEvents = onSchedule({
  schedule: "10 8,11,14,17 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 540
}, async () => {
  console.log("🔄 MAILGUN EVENT SYNC: Starting event synchronization");

  const syncEnabled = emailCampaignSyncEnabled.value().toLowerCase() === 'true';
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!syncEnabled) {
    console.log("🔄 MAILGUN EVENT SYNC: Disabled via environment variable. Skipping.");
    return { status: 'disabled', synced: 0 };
  }

  if (!apiKey) {
    console.error("❌ MAILGUN EVENT SYNC: TBP_MAILGUN_API_KEY not configured");
    return { status: 'error', message: 'Missing API key' };
  }

  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

    console.log(`🔄 MAILGUN EVENT SYNC: Querying events from ${twoHoursAgo.toISOString()} to ${now.toISOString()}`);

    const eventTypes = ['delivered', 'failed', 'opened', 'clicked'];
    const eventsByEmail = {};

    for (const eventType of eventTypes) {
      try {
        const response = await axios.get(`${mailgunBaseUrl}/events`, {
          auth: {
            username: 'api',
            password: apiKey
          },
          params: {
            begin: Math.floor(twoHoursAgo.getTime() / 1000),
            end: Math.floor(now.getTime() / 1000),
            event: eventType,
            limit: 300
          }
        });

        if (response.data && response.data.items) {
          for (const event of response.data.items) {
            const email = event.recipient;
            if (!eventsByEmail[email]) {
              eventsByEmail[email] = {
                delivered: [],
                failed: [],
                opened: [],
                clicked: []
              };
            }
            eventsByEmail[email][eventType].push(event);
          }
          console.log(`   Fetched ${response.data.items.length} ${eventType} events`);
        }
      } catch (error) {
        console.error(`⚠️  Error fetching ${eventType} events: ${error.message}`);
      }
    }

    const emailsToSync = Object.keys(eventsByEmail);
    console.log(`🔄 MAILGUN EVENT SYNC: Processing ${emailsToSync.length} unique email addresses`);

    if (emailsToSync.length === 0) {
      console.log("✅ MAILGUN EVENT SYNC: No events to sync");
      return { status: 'success', synced: 0 };
    }

    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
    let synced = 0;
    let notFound = 0;
    let errors = 0;

    const batches = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    for (const email of emailsToSync) {
      try {
        const contactSnapshot = await contactsRef.where('email', '==', email).limit(1).get();

        if (contactSnapshot.empty) {
          notFound++;
          continue;
        }

        const contactDoc = contactSnapshot.docs[0];
        const events = eventsByEmail[email];
        const updateData = {
          lastMailgunSync: now
        };

        if (events.delivered.length > 0) {
          const latestDelivered = events.delivered.sort((a, b) => b.timestamp - a.timestamp)[0];
          updateData.deliveryStatus = 'delivered';
          updateData.deliveredAt = new Date(latestDelivered.timestamp * 1000);
        }

        if (events.failed.length > 0) {
          const latestFailed = events.failed.sort((a, b) => b.timestamp - a.timestamp)[0];
          updateData.deliveryStatus = 'failed';
          updateData.failedAt = new Date(latestFailed.timestamp * 1000);
          updateData.failureReason = latestFailed.reason || latestFailed['delivery-status']?.message || 'Unknown';
        }

        if (events.opened.length > 0) {
          const firstOpen = events.opened.sort((a, b) => a.timestamp - b.timestamp)[0];
          updateData.openedAt = new Date(firstOpen.timestamp * 1000);
          updateData.openCount = events.opened.length;
        }

        if (events.clicked.length > 0) {
          const firstClick = events.clicked.sort((a, b) => a.timestamp - b.timestamp)[0];
          updateData.clickedAt = new Date(firstClick.timestamp * 1000);
          updateData.clickCount = events.clicked.length;
        }

        currentBatch.update(contactDoc.ref, updateData);
        batchCount++;
        synced++;

        if (batchCount >= 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Error processing ${email}: ${error.message}`);
        errors++;
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    console.log(`💾 MAILGUN EVENT SYNC: Committing ${batches.length} batch(es)...`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        console.log(`   Batch ${i + 1}/${batches.length} committed`);
      } catch (error) {
        console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
      }
    }

    console.log(`\n✅ MAILGUN EVENT SYNC: Complete`);
    console.log(`   Emails processed: ${emailsToSync.length}`);
    console.log(`   Contacts updated: ${synced}`);
    console.log(`   Contacts not found: ${notFound}`);
    console.log(`   Errors: ${errors}`);

    return {
      status: 'success',
      synced,
      notFound,
      errors,
      totalEmails: emailsToSync.length
    };

  } catch (error) {
    console.error('💥 MAILGUN EVENT SYNC: Failed:', error.message);
    throw error;
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyEmailCampaign,
  syncMailgunEvents
};
