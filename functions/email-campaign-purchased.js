/**
 * Purchased Leads Email Campaign Functions
 *
 * Sends email campaigns to leads purchased from external sources (Apollo, Apache, Exact Data)
 * Tracks performance by source for A/B testing and ROI analysis.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const axios = require('axios');
const FormData = require('form-data');
const { db, admin, FieldValue } = require('./shared/utilities');

// =============================================================================
// PARAMETERS
// =============================================================================

const purchasedCampaignEnabled = defineString("PURCHASED_CAMPAIGN_ENABLED", { default: "false" });
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

// A/B Test Variants - V9 vs V10 template with subject line testing (4 combinations)
const AB_TEST_VARIANTS = {
  v9a: {
    templateVersion: 'v9',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'purchased_v9a',
    description: 'V9 (no bullets) + Pattern interrupt'
  },
  v9b: {
    templateVersion: 'v9',
    subject: 'AI is changing how teams grow',
    subjectTag: 'purchased_v9b',
    description: 'V9 (no bullets) + AI curiosity'
  },
  v10a: {
    templateVersion: 'v10',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'purchased_v10a',
    description: 'V10 (with bullets) + Pattern interrupt'
  },
  v10b: {
    templateVersion: 'v10',
    subject: 'AI is changing how teams grow',
    subjectTag: 'purchased_v10b',
    description: 'V10 (with bullets) + AI curiosity'
  }
};

const ACTIVE_VARIANTS = ['v9a', 'v9b', 'v10a', 'v10b'];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

function buildLandingPageUrl(utmCampaign, utmContent, source) {
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    lead_source: source
  });
  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

async function getDynamicBatchSize() {
  try {
    const configDoc = await db.collection('purchased_leads_config').doc('schema').get();
    if (configDoc.exists && configDoc.data().batchSize) {
      return configDoc.data().batchSize;
    }
  } catch (error) {
    console.log(`⚠️ Could not read config: ${error.message}`);
  }
  return 50; // Default batch size
}

async function isCampaignEnabled() {
  try {
    const configDoc = await db.collection('purchased_leads_config').doc('schema').get();
    if (configDoc.exists) {
      return configDoc.data().campaignEnabled === true;
    }
  } catch (error) {
    console.log(`⚠️ Could not read config: ${error.message}`);
  }
  return false;
}

// =============================================================================
// EMAIL SENDER
// =============================================================================

async function sendEmailViaMailgun(lead, docId, index) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // A/B Test: Strict alternation between active variants
  const templateVariant = ACTIVE_VARIANTS[index % ACTIVE_VARIANTS.length];
  const variant = AB_TEST_VARIANTS[templateVariant];

  // Build tracking URLs with source attribution
  const utmCampaign = `purchased_${lead.source}`;
  const landingPageUrl = buildLandingPageUrl(utmCampaign, variant.subjectTag, lead.source);
  const trackedCtaUrl = buildClickUrl(docId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(lead.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${lead.firstName} ${lead.lastName || ''} <${lead.email}>`.trim());
  form.append('subject', variant.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Tracking disabled — using Firestore-based tracking
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', 'purchased_campaign');
  form.append('o:tag', `source_${lead.source}`);
  form.append('o:tag', variant.templateVersion);
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', lead.batchId || 'unknown_batch');

  // List-Unsubscribe headers
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables
  const templateVars = {
    first_name: lead.firstName,
    tracked_cta_url: trackedCtaUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log(`   Source: ${lead.source} | Template: ${templateVariant.toUpperCase()}`);

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
// STATS UPDATER
// =============================================================================

async function updateSourceStats(source, updates) {
  const statsRef = db.collection('purchased_leads_stats').doc(source);

  await db.runTransaction(async (transaction) => {
    const statsDoc = await transaction.get(statsRef);

    if (!statsDoc.exists) {
      // Initialize if doesn't exist
      transaction.set(statsRef, {
        source,
        totalLeads: 0,
        totalCost: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        avgDeliveryRate: 0,
        avgOpenRate: 0,
        avgClickRate: 0,
        avgCostPerClick: 0,
        lastUpdated: FieldValue.serverTimestamp(),
        batchCount: 0,
        ...updates
      });
    } else {
      const current = statsDoc.data();
      const newData = {};

      // Increment counters
      if (updates.sent) newData.totalSent = (current.totalSent || 0) + updates.sent;
      if (updates.delivered) newData.totalDelivered = (current.totalDelivered || 0) + updates.delivered;
      if (updates.clicked) newData.totalClicked = (current.totalClicked || 0) + updates.clicked;
      if (updates.bounced) newData.totalBounced = (current.totalBounced || 0) + updates.bounced;

      // Recalculate rates
      const totalSent = newData.totalSent || current.totalSent || 0;
      const totalDelivered = newData.totalDelivered || current.totalDelivered || 0;
      const totalClicked = newData.totalClicked || current.totalClicked || 0;
      const totalCost = current.totalCost || 0;

      if (totalSent > 0) {
        newData.avgDeliveryRate = totalDelivered / totalSent;
        newData.avgClickRate = totalClicked / totalSent;
      }
      if (totalClicked > 0 && totalCost > 0) {
        newData.avgCostPerClick = totalCost / totalClicked;
      }

      newData.lastUpdated = FieldValue.serverTimestamp();

      transaction.update(statsRef, newData);
    }
  });
}

// =============================================================================
// SCHEDULED CAMPAIGN FUNCTION
// =============================================================================

const sendPurchasedLeadsCampaign = onSchedule({
  schedule: "30 9,12,15,18 * * *", // 9:30am, 12:30pm, 3:30pm, 6:30pm PT
  timeZone: "America/Los_Angeles",
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 300
}, async () => {
  console.log("📧 PURCHASED LEADS CAMPAIGN: Starting batch email send");

  // Check if enabled via Firestore config
  const enabled = await isCampaignEnabled();
  if (!enabled) {
    console.log("📧 PURCHASED LEADS CAMPAIGN: Disabled in config. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  // Also check environment variable
  const envEnabled = purchasedCampaignEnabled.value().toLowerCase() === 'true';
  if (!envEnabled) {
    console.log("📧 PURCHASED LEADS CAMPAIGN: Disabled via environment variable. Skipping.");
    return { status: 'disabled', sent: 0 };
  }

  const batchSize = await getDynamicBatchSize();
  console.log(`📧 PURCHASED LEADS CAMPAIGN: Batch size set to ${batchSize}`);

  try {
    const batchId = `purchased_batch_${Date.now()}`;
    const leadsRef = db.collection('purchased_leads');

    // Get unsent leads, ordered by randomIndex for even A/B distribution
    const unsentSnapshot = await leadsRef
      .where('sent', '==', false)
      .orderBy('randomIndex')
      .limit(batchSize)
      .get();

    if (unsentSnapshot.empty) {
      console.log("✅ PURCHASED LEADS CAMPAIGN: No unsent leads. Campaign complete!");
      return { status: 'complete', sent: 0 };
    }

    console.log(`📧 PURCHASED LEADS CAMPAIGN: Processing ${unsentSnapshot.size} leads in ${batchId}`);

    let sent = 0;
    let failed = 0;
    const sentBySource = {};

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const lead = doc.data();

      try {
        console.log(`📤 [${i + 1}/${unsentSnapshot.size}] Sending to ${lead.email}...`);

        const result = await sendEmailViaMailgun(lead, doc.id, i);

        if (result.success) {
          await doc.ref.update({
            sent: true,
            sentAt: FieldValue.serverTimestamp(),
            status: 'sent',
            templateVersion: result.templateVariant,
            subjectTag: result.subjectTag,
            mailgunId: result.messageId || '',
            updatedAt: FieldValue.serverTimestamp()
          });

          console.log(`✅ Sent to ${lead.email} (${lead.source}/${result.templateVariant})`);
          sent++;

          // Track by source
          sentBySource[lead.source] = (sentBySource[lead.source] || 0) + 1;
        } else {
          throw new Error(result.error || 'Unknown error');
        }

        // Rate limiting
        if (i < unsentSnapshot.size - 1) {
          await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS));
        }

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(`❌ Failed to send to ${lead.email}: ${errorMessage}`);

        await doc.ref.update({
          sent: false,
          status: 'failed',
          errorMessage,
          updatedAt: FieldValue.serverTimestamp()
        });

        failed++;
      }
    }

    // Update source stats
    for (const [source, count] of Object.entries(sentBySource)) {
      await updateSourceStats(source, { sent: count });
    }

    console.log(`\n📊 ${batchId} Complete:`);
    console.log(`   Total processed: ${unsentSnapshot.size}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   By source: ${JSON.stringify(sentBySource)}`);

    return {
      status: 'success',
      sent,
      failed,
      total: unsentSnapshot.size,
      bySource: sentBySource,
      batchId
    };

  } catch (error) {
    console.error("💥 PURCHASED LEADS CAMPAIGN: Batch failed:", error.message);
    throw error;
  }
});

// =============================================================================
// ANALYTICS ENDPOINT - Lead Source Performance Comparison
// =============================================================================

const getPurchasedLeadsAnalytics = onRequest({
  region: "us-central1",
  memory: "256MiB",
  timeoutSeconds: 60
}, async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    // Get source stats
    const statsSnapshot = await db.collection('purchased_leads_stats').get();
    const sourceStats = {};

    statsSnapshot.forEach(doc => {
      sourceStats[doc.id] = doc.data();
    });

    // Get batch performance
    const batchesSnapshot = await db.collection('purchased_leads_batches')
      .orderBy('purchaseDate', 'desc')
      .limit(20)
      .get();

    const batches = [];
    batchesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.status !== 'example') {
        batches.push({ id: doc.id, ...data });
      }
    });

    // Get lead counts by source and status
    const leadsSnapshot = await db.collection('purchased_leads').get();
    const leadCounts = {
      total: 0,
      bySource: {},
      byStatus: {},
      sent: 0,
      clicked: 0
    };

    leadsSnapshot.forEach(doc => {
      const lead = doc.data();
      leadCounts.total++;

      // By source
      const source = lead.source || 'unknown';
      if (!leadCounts.bySource[source]) {
        leadCounts.bySource[source] = { total: 0, sent: 0, clicked: 0 };
      }
      leadCounts.bySource[source].total++;
      if (lead.sent) leadCounts.bySource[source].sent++;
      if (lead.clicked) leadCounts.bySource[source].clicked++;

      // By status
      const status = lead.status || 'pending';
      leadCounts.byStatus[status] = (leadCounts.byStatus[status] || 0) + 1;

      if (lead.sent) leadCounts.sent++;
      if (lead.clicked) leadCounts.clicked++;
    });

    // Calculate ROI comparison
    const roiComparison = {};
    for (const [source, stats] of Object.entries(sourceStats)) {
      if (stats.totalCost > 0 && stats.totalClicked > 0) {
        roiComparison[source] = {
          costPerClick: stats.totalCost / stats.totalClicked,
          clickRate: stats.totalClicked / stats.totalSent,
          roi: `$${(stats.totalCost / stats.totalClicked).toFixed(2)}/click`
        };
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalLeads: leadCounts.total,
        totalSent: leadCounts.sent,
        totalClicked: leadCounts.clicked,
        overallClickRate: leadCounts.sent > 0
          ? ((leadCounts.clicked / leadCounts.sent) * 100).toFixed(2) + '%'
          : '0%'
      },
      bySource: leadCounts.bySource,
      byStatus: leadCounts.byStatus,
      sourceStats,
      roiComparison,
      recentBatches: batches
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendPurchasedLeadsCampaign,
  getPurchasedLeadsAnalytics
};
