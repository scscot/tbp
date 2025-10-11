const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db } = require('./shared/utilities');

// Define parameters for v2 functions
const emailCampaignEnabled = defineString("EMAIL_CAMPAIGN_ENABLED", { default: "false" });
const emailCampaignBatchSize = defineString("EMAIL_CAMPAIGN_BATCH_SIZE", { default: "1" });
const mailgunApiKey = defineString("MAILGUN_API_KEY");
const mailgunDomain = defineString("MAILGUN_DOMAIN", { default: "info.teambuildpro.com" });

async function sendEmailViaMailgun(contact, apiKey, domain) {
  const form = new FormData();

  form.append('from', 'Stephen Scott | Team Build Pro <sscott@info.teambuildpro.com>');
  form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
  // form.append('bcc', 'Stephen Scott <scscot@gmail.com>');
  form.append('subject', 'A smarter team-building system');

  form.append('template', 'initial');
  form.append('t:version', 'initial');
  form.append('o:tag', 'initial');
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

  return response.data;
}

const sendHourlyEmailCampaign = onSchedule({
  schedule: "0 * * * *",
  timeZone: "UTC",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (event) => {
  console.log("📧 HOURLY EMAIL CAMPAIGN: Starting batch email send");

  // Get parameter values
  const campaignEnabled = emailCampaignEnabled.value().toLowerCase() === 'true';
  const batchSize = parseInt(emailCampaignBatchSize.value());
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!campaignEnabled) {
    console.log("📧 EMAIL CAMPAIGN: Disabled via environment variable. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  if (!apiKey) {
    console.error("❌ EMAIL CAMPAIGN: MAILGUN_API_KEY not configured");
    return { status: 'error', message: 'Missing API key' };
  }

  console.log(`📧 EMAIL CAMPAIGN: Batch size set to ${batchSize}`);

  try {
    const batchId = `batch_${Date.now()}`;
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    const unsentSnapshot = await contactsRef
      .where('sent', '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log("✅ EMAIL CAMPAIGN: No unsent emails found. Campaign complete!");
      return { status: 'complete', sent: 0 };
    }

    console.log(`📧 EMAIL CAMPAIGN: Processing ${unsentSnapshot.size} emails in ${batchId}`);

    let sent = 0;
    let failed = 0;

    for (const doc of unsentSnapshot.docs) {
      const contact = doc.data();

      try {
        console.log(`📤 Sending to ${contact.email}...`);

        const result = await sendEmailViaMailgun(contact, apiKey, domain);

        await doc.ref.update({
          sent: true,
          sentTimestamp: new Date(),
          batchId: batchId,
          status: 'sent',
          errorMessage: '',
          mailgunId: result.id || ''
        });

        console.log(`✅ Sent to ${contact.email}: ${result.id}`);
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
    console.log(`   Success rate: ${((sent / unsentSnapshot.size) * 100).toFixed(1)}%`);

    return {
      status: 'success',
      sent,
      failed,
      total: unsentSnapshot.size,
      batchId
    };

  } catch (error) {
    console.error('💥 EMAIL CAMPAIGN: Batch failed:', error.message);
    throw error;
  }
});

module.exports = {
  sendHourlyEmailCampaign
};
