/**
 * Team Build Pro Email Campaign Functions (Mailgun Version)
 *
 * Scheduled email campaigns using Mailgun API.
 * Sends emails with real-time open/click tracking via Cloud Functions.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const { db } = require('./shared/utilities');
const { sendTrackedEmail, verifyConnection, closeConnection } = require('./email-mailgun-sender');
const { generateEmailHTML, generateEmailPlainText } = require('./email_templates/tbp-smtp-template');

// =============================================================================
// PARAMETERS
// =============================================================================

const emailCampaignEnabled = defineString("EMAIL_CAMPAIGN_ENABLED", { default: "false" });
const androidCampaignEnabled = defineString("ANDROID_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });

// =============================================================================
// CONSTANTS
// =============================================================================

const SEND_DELAY_MS = 1000;

// =============================================================================
// SEASONAL SIGN-OFF
// =============================================================================

function computeSeasonalSignoff() {
  // Get current date in LA timezone
  const now = new Date();
  const laDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const month = laDate.getMonth() + 1; // 1-12
  const day = laDate.getDate();

  // Dec 15 – Dec 31: Happy Holidays
  if (month === 12 && day >= 15) {
    return 'Happy Holidays,';
  }
  // Jan 1 – Jan 15: New Year greeting
  if (month === 1 && day <= 15) {
    return 'Wishing you a great start to the year,';
  }
  // Otherwise: no seasonal line
  return '';
}

// =============================================================================
// CAMPAIGN CONFIGURATIONS
// =============================================================================

const CAMPAIGN_CONFIGS = {
  main: {
    name: 'HOURLY EMAIL CAMPAIGN',
    logPrefix: '📧',
    batchIdPrefix: 'smtp_batch',
    sentField: 'sent',
    utmCampaign: 'tbp_smtp_campaign',
    subjects: [
      { subject: () => 'Not an opportunity. Just a tool.', tag: 'not_opportunity' }
    ]
  },
  android: {
    name: 'ANDROID LAUNCH CAMPAIGN',
    logPrefix: '📧',
    batchIdPrefix: 'android_smtp_batch',
    sentField: 'resend',
    utmCampaign: 'android_launch',
    subjects: [
      { subject: () => 'A smarter way to build your team', tag: 'android_launch' }
    ],
    // Field mappings for resend campaign
    timestampField: 'resendTimestamp',
    statusField: 'resendStatus',
    errorField: 'resendErrorMessage',
    messageIdField: 'smtpResendMessageId',
    lastAttemptField: 'lastResendAttempt'
  }
};

// =============================================================================
// SMTP EMAIL SENDER
// =============================================================================

/**
 * Send email via SMTP with tracking
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} docId - Firestore document ID (used as tracking ID)
 * @param {object} config - Campaign configuration
 * @param {number} index - Index for subject rotation
 * @returns {Promise<object>} Send result
 */
async function sendEmailViaSMTP(contact, docId, config, index = 0) {
  // Select subject based on index rotation
  const subjectIndex = index % config.subjects.length;
  const subjectConfig = config.subjects[subjectIndex];
  const selectedSubject = subjectConfig.subject(contact);
  const subjectTag = subjectConfig.tag;

  // Compute seasonal sign-off
  const seasonalSignoff = computeSeasonalSignoff();

  // Generate email content with tracking
  const templateConfig = {
    subjectTag: subjectTag,
    utmCampaign: config.utmCampaign
  };

  const htmlContent = generateEmailHTML(contact, docId, templateConfig, seasonalSignoff);
  const textContent = generateEmailPlainText(contact, docId, templateConfig, seasonalSignoff);

  // Send via SMTP
  const result = await sendTrackedEmail(
    contact,
    docId,
    selectedSubject,
    htmlContent,
    textContent
  );

  return {
    ...result,
    subjectTag: subjectTag
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

  // Verify SMTP connection before starting
  const connectionOk = await verifyConnection();
  if (!connectionOk) {
    console.error(`❌ ${name}: SMTP connection failed`);
    return { status: 'error', message: 'SMTP connection failed' };
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
      closeConnection();
      return { status: 'complete', sent: 0 };
    }

    console.log(`${logPrefix} ${name}: Processing ${unsentSnapshot.size} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    // Determine field names based on config (for resend campaigns)
    const timestampField = config.timestampField || 'sentTimestamp';
    const statusField = config.statusField || 'status';
    const errorField = config.errorField || 'errorMessage';
    const messageIdField = config.messageIdField || 'messageId';
    const lastAttemptField = config.lastAttemptField || 'lastAttempt';

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const result = await sendEmailViaSMTP(contact, doc.id, config, i);

        if (result.success) {
          const updateData = {
            [sentField]: true,
            [timestampField]: new Date(),
            batchId: batchId,
            [statusField]: 'sent',
            [errorField]: '',
            [messageIdField]: result.messageId || '',
            subjectTag: result.subjectTag,
            smtpResponse: result.response || ''
          };

          await doc.ref.update(updateData);

          console.log(`✅ Sent to ${contact.email}: ${result.messageId}`);
          sent++;
        } else {
          throw new Error(result.error || 'Unknown SMTP error');
        }

        if (sent < unsentSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        console.error(`❌ Failed to send to ${contact.email}: ${error.message}`);

        await doc.ref.update({
          [sentField]: false,
          batchId: batchId,
          [statusField]: 'failed',
          [errorField]: error.message,
          [lastAttemptField]: new Date()
        });

        failed++;
      }
    }

    // Close SMTP connection after batch
    closeConnection();

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
    closeConnection();
    throw error;
  }
}

// =============================================================================
// SCHEDULED FUNCTIONS
// =============================================================================

const sendHourlyEmailCampaign = onSchedule({
  schedule: "0 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  const batchSize = parseInt(emailCampaignBatchSize.value());

  return processCampaignBatch(
    CAMPAIGN_CONFIGS.main,
    emailCampaignEnabled,
    batchSize
  );
});

const sendAndroidLaunchCampaign = onSchedule({
  schedule: "0 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 120
}, async () => {
  const batchSize = parseInt(emailCampaignBatchSize.value());

  return processCampaignBatch(
    CAMPAIGN_CONFIGS.android,
    androidCampaignEnabled,
    batchSize
  );
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendHourlyEmailCampaign,
  sendAndroidLaunchCampaign
};
