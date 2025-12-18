const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// Define parameters for v2 functions - Yahoo-specific campaign
const emailCampaignEnabledYahoo = defineString("EMAIL_CAMPAIGN_ENABLED_YAHOO", { default: "false" });
const androidCampaignEnabledYahoo = defineString("ANDROID_CAMPAIGN_ENABLED_YAHOO", { default: "false" });
const emailCampaignSyncEnabledYahoo = defineString("EMAIL_CAMPAIGN_SYNC_ENABLED_YAHOO", { default: "false" });
const emailCampaignBatchSizeYahoo = defineString("EMAIL_CAMPAIGN_BATCH_SIZE_YAHOO", { default: "1" });
const mailgunApiKey = defineString("MAILGUN_API_KEY");
const mailgunDomain = defineString("MAILGUN_DOMAIN", { default: "mailer.teambuildpro.com" });

async function sendEmailViaMailgun(contact, apiKey, domain, index = 0) {
  const form = new FormData();

  // Dec 17, 2025: Using scripts template only (AI Script Generator promo)
  // Routes to teambuildpro.com/scripts.html for GA4 tracking
  const templateVersion = 'scripts';

  // Scripts template: AI tool-focused subject lines (4-way rotation)
  const subjectIndex = index % 4;
  const subjects = [
    { subject: `${contact.firstName}, I built you a recruiting tool`, tag: 'subject_built_tool' },
    { subject: 'Never struggle with recruiting messages again', tag: 'subject_never_struggle' },
    { subject: `${contact.firstName}, AI just wrote your next message`, tag: 'subject_ai_wrote' },
    { subject: 'What to say when recruiting (solved)', tag: 'subject_what_to_say' }
  ];
  const selectedSubject = subjects[subjectIndex].subject;
  const subjectTag = subjects[subjectIndex].tag;

  form.append('from', 'Stephen Scott <stephen@mailer.teambuildpro.com>');
  form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
  // form.append('bcc', 'Stephen Scott <scscot@gmail.com>');
  form.append('subject', selectedSubject);

  form.append('template', 'mailer');
  form.append('t:version', templateVersion);
  form.append('o:tag', 'yahoo_initial_campaign');
  form.append('o:tag', templateVersion);
  form.append('o:tag', subjectTag);
  form.append('o:tracking', 'yes');
  form.append('o:tracking-opens', 'yes');
  form.append('o:tracking-clicks', 'yes');
  // Dec 10, 2025: Added UTM parameters for GA4 tracking
  // Mailgun open/click tracking is unreliable due to Gmail pre-fetching
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email,
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: 'yahoo_campaign',
    utm_content: subjectTag
  }));

  const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
  const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
    }
  });

  return response.data;
}

const sendHourlyEmailCampaignYahoo = onSchedule({
  schedule: "0 7,9,11,13,15,17 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  console.log("📧 YAHOO EMAIL CAMPAIGN: Starting batch email send");

  // Get parameter values - use Yahoo-specific settings
  const campaignEnabled = emailCampaignEnabledYahoo.value().toLowerCase() === 'true';
  const batchSize = parseInt(emailCampaignBatchSizeYahoo.value());
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!campaignEnabled) {
    console.log("📧 YAHOO EMAIL CAMPAIGN: Disabled via environment variable. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  if (!apiKey) {
    console.error("❌ YAHOO EMAIL CAMPAIGN: MAILGUN_API_KEY not configured");
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`📧 YAHOO EMAIL CAMPAIGN: Batch size set to ${batchSize}`);

  try {
    const batchId = `yahoo_batch_${Date.now()}`;
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');

    const unsentSnapshot = await contactsRef
      .where('sent', '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log("✅ YAHOO EMAIL CAMPAIGN: No unsent emails found. Campaign complete!");
      return { status: 'complete', sent: 0 };
    }

    console.log(`📧 YAHOO EMAIL CAMPAIGN: Processing ${unsentSnapshot.size} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, apiKey, domain, i);

        await doc.ref.update({
          sent: true,
          sentTimestamp: new Date(),
          batchId: batchId,
          status: 'sent',
          errorMessage: '',
          mailgunId: result.id || ''
        });

        console.log(`✅ Sent to ${contact.email} [scripts]: ${result.id}`);
        sent++;

        if (sent < unsentSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Failed to send to ${contact.email}: ${error.message}`);

        await doc.ref.update({
          sent: false,
          batchId: batchId,
          status: 'failed',
          errorMessage: error.message,
          lastAttempt: new Date()
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
    console.error('💥 YAHOO EMAIL CAMPAIGN: Batch failed:', error.message);
    throw error;
  }
});

const sendAndroidLaunchCampaignYahoo = onSchedule({
  schedule: "0 8,10,12,14,16,18 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  console.log("📧 YAHOO ANDROID LAUNCH CAMPAIGN: Starting resend batch");

  const campaignEnabled = androidCampaignEnabledYahoo.value().toLowerCase() === 'true';
  const batchSize = parseInt(emailCampaignBatchSizeYahoo.value());
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!campaignEnabled) {
    console.log("📧 YAHOO ANDROID LAUNCH CAMPAIGN: Disabled via environment variable. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  if (!apiKey) {
    console.error("❌ YAHOO ANDROID LAUNCH CAMPAIGN: MAILGUN_API_KEY not configured");
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`📧 YAHOO ANDROID LAUNCH CAMPAIGN: Batch size set to ${batchSize}`);

  try {
    const batchId = `yahoo_android_batch_${Date.now()}`;
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');

    const resendSnapshot = await contactsRef
      .where('resend', '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (resendSnapshot.empty) {
      console.log("✅ YAHOO ANDROID LAUNCH CAMPAIGN: No contacts to resend. Campaign complete!");
      return { status: 'complete', sent: 0 };
    }

    console.log(`📧 YAHOO ANDROID LAUNCH CAMPAIGN: Processing ${resendSnapshot.size} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < resendSnapshot.docs.length; i++) {
      const doc = resendSnapshot.docs[i];
      const contact = doc.data();

      try {
        console.log(`📤 Resending to ${contact.email}...`);

        const form = new FormData();
        const selectedSubject = `The Recruiting App Built for Direct Sales`;
        const selectedVersion = 'initial';

        form.append('from', 'Stephen Scott <stephen@mailer.teambuildpro.com>');
        form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
        form.append('subject', selectedSubject);
        form.append('template', 'mailer');
        form.append('t:version', selectedVersion);
        form.append('o:tag', 'yahoo_android_launch');
        form.append('o:tag', selectedVersion);
        form.append('o:tracking', 'yes');
        form.append('o:tracking-opens', 'yes');
        form.append('o:tracking-clicks', 'yes');
        form.append('h:X-Mailgun-Variables', JSON.stringify({
          first_name: contact.firstName,
          last_name: contact.lastName,
          email: contact.email
        }));

        const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
        const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
          }
        });

        await doc.ref.update({
          resend: true,
          resendTimestamp: new Date(),
          batchId: batchId,
          resendStatus: 'sent',
          resendErrorMessage: '',
          mailgunResendId: response.data.id || ''
        });

        console.log(`✅ Resent to ${contact.email}: ${response.data.id}`);
        sent++;

        if (sent < resendSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Failed to resend to ${contact.email}: ${error.message}`);

        await doc.ref.update({
          resend: false,
          batchId: batchId,
          resendStatus: 'failed',
          resendErrorMessage: error.message,
          lastResendAttempt: new Date()
        });

        failed++;
      }
    }

    console.log(`\n📊 ${batchId} Complete:`);
    console.log(`   Total processed: ${resendSnapshot.size}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success rate: ${((sent / resendSnapshot.size) * 100).toFixed(1)}%`);

    return {
      status: 'success',
      sent,
      failed,
      total: resendSnapshot.size,
      batchId
    };

  } catch (error) {
    console.error('💥 YAHOO ANDROID LAUNCH CAMPAIGN: Batch failed:', error.message);
    throw error;
  }
});

const syncMailgunEventsYahoo = onSchedule({
  schedule: "10 7,9,11,13,15,17 * * *",
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 540
}, async (event) => {
  console.log("🔄 YAHOO MAILGUN EVENT SYNC: Starting event synchronization");

  const syncEnabled = emailCampaignSyncEnabledYahoo.value().toLowerCase() === 'true';
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!syncEnabled) {
    console.log("🔄 YAHOO MAILGUN EVENT SYNC: Disabled via environment variable. Skipping.");
    return { status: 'disabled', synced: 0 };
  }

  if (!apiKey) {
    console.error("❌ YAHOO MAILGUN EVENT SYNC: MAILGUN_API_KEY not configured");
    return { status: 'error', message: 'Missing API key' };
  }

  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

    console.log(`🔄 YAHOO MAILGUN EVENT SYNC: Querying events from ${twoHoursAgo.toISOString()} to ${now.toISOString()}`);

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
    console.log(`🔄 YAHOO MAILGUN EVENT SYNC: Processing ${emailsToSync.length} unique email addresses`);

    if (emailsToSync.length === 0) {
      console.log("✅ YAHOO MAILGUN EVENT SYNC: No events to sync");
      return { status: 'success', synced: 0 };
    }

    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');
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

    console.log(`💾 YAHOO MAILGUN EVENT SYNC: Committing ${batches.length} batch(es)...`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        console.log(`   Batch ${i + 1}/${batches.length} committed`);
      } catch (error) {
        console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
      }
    }

    console.log(`\n✅ YAHOO MAILGUN EVENT SYNC: Complete`);
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
    console.error('💥 YAHOO MAILGUN EVENT SYNC: Failed:', error.message);
    throw error;
  }
});

module.exports = {
  sendHourlyEmailCampaignYahoo,
  sendAndroidLaunchCampaignYahoo,
  syncMailgunEventsYahoo
};
