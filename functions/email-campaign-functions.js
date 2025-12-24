const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const emailCampaignEnabled = defineString("EMAIL_CAMPAIGN_ENABLED", { default: "false" });
const androidCampaignEnabled = defineString("ANDROID_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignSyncEnabled = defineString("EMAIL_CAMPAIGN_SYNC_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("MAILGUN_API_KEY");
const mailgunDomain = defineString("MAILGUN_DOMAIN", { default: "mailer.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const CONTACTS_COLLECTION = 'emailCampaigns/master/contacts';
const FROM_ADDRESS = 'Stephen Scott <stephen@mailer.teambuildpro.com>';
const TEMPLATE_NAME = 'mailer';
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
    batchIdPrefix: 'batch',
    sentField: 'sent',
    templateVersion: 'initial',
    campaignTag: 'initial_campaign',
    utmCampaign: 'initial_campaign',
    subjects: [
      { subject: () => 'The Recruiting App Built for Direct Sales', tag: 'subject_recruiting_app' }
    ],
    includeUtmTracking: true
  },
  android: {
    name: 'ANDROID LAUNCH CAMPAIGN',
    logPrefix: '📧',
    batchIdPrefix: 'android_batch',
    sentField: 'resend',
    templateVersion: 'initial',
    campaignTag: 'android_launch',
    utmCampaign: 'android_launch',
    subjects: [
      { subject: () => 'The Recruiting App Built for Direct Sales', tag: 'android_launch' }
    ],
    includeUtmTracking: false,
    // Field mappings for resend campaign
    timestampField: 'resendTimestamp',
    statusField: 'resendStatus',
    errorField: 'resendErrorMessage',
    mailgunIdField: 'mailgunResendId',
    lastAttemptField: 'lastResendAttempt'
  }
};

// =============================================================================
// MAILGUN EMAIL SENDER
// =============================================================================

async function sendEmailViaMailgun(contact, config, apiKey, domain, index = 0) {
  const form = new FormData();

  // Select subject based on index rotation
  const subjectIndex = index % config.subjects.length;
  const subjectConfig = config.subjects[subjectIndex];
  const selectedSubject = subjectConfig.subject(contact);
  const subjectTag = subjectConfig.tag;

  form.append('from', FROM_ADDRESS);
  form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
  form.append('subject', selectedSubject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', config.templateVersion);
  form.append('o:tag', config.campaignTag);
  form.append('o:tag', config.templateVersion);
  form.append('o:tag', subjectTag);
  form.append('o:tracking', 'yes');
  form.append('o:tracking-opens', 'yes');
  form.append('o:tracking-clicks', 'yes');

  // Build template variables
  const templateVars = {
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    seasonal_signoff: computeSeasonalSignoff()
  };

  // Add UTM tracking if configured
  if (config.includeUtmTracking) {
    templateVars.utm_source = 'mailgun';
    templateVars.utm_medium = 'email';
    templateVars.utm_campaign = config.utmCampaign;
    templateVars.utm_content = subjectTag;
  }

  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
  const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
    }
  });

  return { result: response.data, subjectTag };
}

// =============================================================================
// SHARED CAMPAIGN PROCESSOR
// =============================================================================

async function processCampaignBatch(config, enabledParam, apiKey, domain, batchSize) {
  const { name, logPrefix, batchIdPrefix, sentField } = config;

  console.log(`${logPrefix} ${name}: Starting batch email send`);

  const campaignEnabled = enabledParam.value().toLowerCase() === 'true';

  if (!campaignEnabled) {
    console.log(`${logPrefix} ${name}: Disabled via environment variable. Skipping.`);
    return { status: 'disabled', sent: 0 };
  }

  if (!apiKey) {
    console.error(`❌ ${name}: MAILGUN_API_KEY not configured`);
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
    const mailgunIdField = config.mailgunIdField || 'mailgunId';
    const lastAttemptField = config.lastAttemptField || 'lastAttempt';

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const { result, subjectTag } = await sendEmailViaMailgun(contact, config, apiKey, domain, i);

        const updateData = {
          [sentField]: true,
          [timestampField]: new Date(),
          batchId: batchId,
          [statusField]: 'sent',
          [errorField]: '',
          [mailgunIdField]: result.id || '',
          templateVersion: config.templateVersion,
          subjectTag: subjectTag
        };

        await doc.ref.update(updateData);

        console.log(`✅ Sent to ${contact.email} [${config.templateVersion}]: ${result.id}`);
        sent++;

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
  schedule: "0 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();
  const batchSize = parseInt(emailCampaignBatchSize.value());

  return processCampaignBatch(
    CAMPAIGN_CONFIGS.main,
    emailCampaignEnabled,
    apiKey,
    domain,
    batchSize
  );
});

const sendAndroidLaunchCampaign = onSchedule({
  schedule: "0 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();
  const batchSize = parseInt(emailCampaignBatchSize.value());

  return processCampaignBatch(
    CAMPAIGN_CONFIGS.android,
    androidCampaignEnabled,
    apiKey,
    domain,
    batchSize
  );
});

const syncMailgunEvents = onSchedule({
  schedule: "10 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 540
}, async (event) => {
  console.log("🔄 MAILGUN EVENT SYNC: Starting event synchronization");

  const syncEnabled = emailCampaignSyncEnabled.value().toLowerCase() === 'true';
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!syncEnabled) {
    console.log("🔄 MAILGUN EVENT SYNC: Disabled via environment variable. Skipping.");
    return { status: 'disabled', synced: 0 };
  }

  if (!apiKey) {
    console.error("❌ MAILGUN EVENT SYNC: MAILGUN_API_KEY not configured");
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
          auth: { username: 'api', password: apiKey },
          params: {
            begin: Math.floor(twoHoursAgo.getTime() / 1000),
            end: Math.floor(now.getTime() / 1000),
            event: eventType,
            limit: 300
          }
        });

        if (response.data && response.data.items) {
          for (const item of response.data.items) {
            const email = item.recipient;
            if (!eventsByEmail[email]) {
              eventsByEmail[email] = { delivered: [], failed: [], opened: [], clicked: [] };
            }
            eventsByEmail[email][eventType].push(item);
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
        const updateData = { lastMailgunSync: now };

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
  sendAndroidLaunchCampaign,
  syncMailgunEvents
};
