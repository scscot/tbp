/**
 * Purchased Leads Email Campaign Functions
 *
 * Sends email campaigns to leads purchased from external sources (Apollo, Apache, Exact Data)
 * Uses V18 A/B/C testing (3 template variations for conversion optimization).
 * Tracks performance by source for ROI analysis.
 *
 * V18 A/B/C Test (33% distribution each):
 * - V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - V18-B: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"
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
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// =============================================================================
// V18 A/B/C TEMPLATE CONFIGURATION (Conversion Optimization Test)
// =============================================================================

/**
 * V18 Template Variants for A/B/C Testing
 * 33% distribution per variant for statistically valid comparison
 */
const V18_VARIANTS = {
  'v18-a': {
    templateVersion: 'v18-a',
    subject: 'What if your next recruit joined with 12 people?',
    subjectTag: 'purchased_v18_a',
    description: 'Curiosity Hook'
  },
  'v18-b': {
    templateVersion: 'v18-b',
    subject: "75% of your recruits will quit this year (here's why)",
    subjectTag: 'purchased_v18_b',
    description: 'Pain Point Hook'
  },
  'v18-c': {
    templateVersion: 'v18-c',
    subject: 'Give your prospects an AI recruiting coach',
    subjectTag: 'purchased_v18_c',
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
    // Read from unified config/emailCampaign document (same as BFH)
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists && configDoc.data().batchSizePurchased !== undefined) {
      return configDoc.data().batchSizePurchased;
    }
  } catch (error) {
    console.log(`⚠️ Could not read config: ${error.message}`);
  }
  return 8; // Default batch size
}

async function isCampaignEnabled() {
  try {
    // Read from unified config/emailCampaign document
    // Campaign is enabled if batchSizePurchased > 0 (same pattern as BFH)
    const configDoc = await db.collection('config').doc('emailCampaign').get();
    if (configDoc.exists) {
      const batchSize = configDoc.data().batchSizePurchased;
      return batchSize !== undefined && batchSize > 0;
    }
  } catch (error) {
    console.log(`⚠️ Could not read config: ${error.message}`);
  }
  return false;
}

// =============================================================================
// EMAIL SENDER
// =============================================================================

async function sendEmailViaMailgun(lead, docId) {
  const apiKey = mailgunApiKey.value();
  const domain = mailgunDomain.value();

  if (!apiKey) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  // Select V18 variant (33% distribution each)
  const variantKey = selectV18Variant();
  const templateConfig = V18_VARIANTS[variantKey];

  // Build URLs (direct links for better deliverability)
  const utmCampaign = `purchased_${lead.source}`;
  const landingPageUrl = buildLandingPageUrl(utmCampaign, templateConfig.subjectTag, lead.source);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(lead.email)}`;

  // Build form data for Mailgun API
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${lead.firstName} ${lead.lastName || ''} <${lead.email}>`.trim());
  form.append('subject', templateConfig.subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', templateConfig.templateVersion);

  // Mailgun tracking disabled — clicks tracked via GA4 using UTM parameters in direct landing page URLs
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', 'purchased_campaign');
  form.append('o:tag', `source_${lead.source}`);
  form.append('o:tag', templateConfig.subjectTag);
  form.append('o:tag', lead.batchId || 'unknown_batch');

  // List-Unsubscribe headers
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables (using direct landing page URL for deliverability)
  const templateVars = {
    first_name: lead.firstName,
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log(`   V18 Variant: ${variantKey.toUpperCase()} (${templateConfig.description}) | Source: ${lead.source}`);

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
  schedule: "40 0,6,12,18 * * *",  // 4x daily (every 6 hours) - 40 minutes past
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
    console.log(`   V18 A/B/C test with 33% distribution per variant`);

    let sent = 0;
    let failed = 0;
    const sentBySource = {};
    const variantCounts = { 'v18-a': 0, 'v18-b': 0, 'v18-c': 0 };

    for (let i = 0; i < unsentSnapshot.docs.length; i++) {
      const doc = unsentSnapshot.docs[i];
      const lead = doc.data();

      try {
        console.log(`📤 [${i + 1}/${unsentSnapshot.size}] Sending to ${lead.email}...`);

        const result = await sendEmailViaMailgun(lead, doc.id);

        if (result.success) {
          await doc.ref.update({
            sent: true,
            sentTimestamp: FieldValue.serverTimestamp(),
            status: 'sent',
            templateVariant: result.templateVariant,
            templateVersion: result.templateVersion,
            subjectTag: result.subjectTag,
            variantDescription: result.variantDescription,
            mailgunId: result.messageId || '',
            updatedAt: FieldValue.serverTimestamp()
          });

          // Track variant distribution
          variantCounts[result.templateVariant] = (variantCounts[result.templateVariant] || 0) + 1;

          const variantEmoji = result.templateVariant === 'v18-a' ? '🅰️' :
            result.templateVariant === 'v18-b' ? '🅱️' : '🇨';
          console.log(`${variantEmoji} Sent to ${lead.email} (${result.templateVariant}): ${result.messageId}`);
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
    console.log(`   V18 Distribution: A=${variantCounts['v18-a']} | B=${variantCounts['v18-b']} | C=${variantCounts['v18-c']}`);
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
