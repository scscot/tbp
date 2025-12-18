const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Initialize clients
const analyticsDataClient = new BetaAnalyticsDataClient();

// Configuration
const GA4_PROPERTY_ID = '485651473';
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'info.teambuildpro.com';
const MAILGUN_BASE_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

// Date range
const startDate = '30daysAgo';
const endDate = 'today';

/**
 * Fetch Mailgun campaign stats by tag
 */
async function getMailgunCampaignStats() {
  console.log('📧 Fetching Mailgun campaign statistics...');

  try {
    // Fetch events for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const response = await axios.get(`${MAILGUN_BASE_URL}/events`, {
      auth: {
        username: 'api',
        password: MAILGUN_API_KEY
      },
      params: {
        begin: Math.floor(thirtyDaysAgo.getTime() / 1000),
        end: Math.floor(Date.now() / 1000),
        limit: 300,
        ascending: 'yes',
        pretty: 'yes'
      }
    });

    const events = response.data.items || [];
    console.log(`   Found ${events.length} Mailgun events`);

    // Aggregate statistics by event type
    const stats = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      unsubscribed: 0,
      complained: 0,
      failed: 0,
      bounced: 0,
      uniqueOpens: new Set(),
      uniqueClicks: new Set(),
      clickedUrls: {},
      openTimestamps: [],
      clickTimestamps: [],
      failureReasons: {},
      bounceReasons: {},
      recentEvents: []
    };

    events.forEach(event => {
      const eventType = event.event;
      const recipient = event.recipient || 'unknown';
      const timestamp = new Date(event.timestamp * 1000);

      // Store recent events for detailed analysis
      if (stats.recentEvents.length < 50) {
        stats.recentEvents.push({
          type: eventType,
          recipient: recipient,
          timestamp: timestamp.toISOString(),
          tags: event.tags || [],
          url: event.url || null
        });
      }

      switch (eventType) {
        case 'accepted':
        case 'delivered':
          stats.delivered++;
          break;
        case 'opened':
          stats.opened++;
          stats.uniqueOpens.add(recipient);
          stats.openTimestamps.push(timestamp);
          break;
        case 'clicked':
          stats.clicked++;
          stats.uniqueClicks.add(recipient);
          stats.clickTimestamps.push(timestamp);

          // Track which URLs were clicked
          const url = event.url || 'unknown';
          stats.clickedUrls[url] = (stats.clickedUrls[url] || 0) + 1;
          break;
        case 'unsubscribed':
          stats.unsubscribed++;
          break;
        case 'complained':
          stats.complained++;
          break;
        case 'failed':
          stats.failed++;
          const failReason = event.reason || event['delivery-status']?.message || 'Unknown';
          stats.failureReasons[failReason] = (stats.failureReasons[failReason] || 0) + 1;
          break;
        case 'bounced':
          stats.bounced++;
          const bounceCode = event.code || 'Unknown';
          stats.bounceReasons[bounceCode] = (stats.bounceReasons[bounceCode] || 0) + 1;
          break;
      }
    });

    // Calculate metrics
    const uniqueOpenCount = stats.uniqueOpens.size;
    const uniqueClickCount = stats.uniqueClicks.size;

    const openRate = stats.delivered > 0 ? (uniqueOpenCount / stats.delivered * 100).toFixed(2) : 0;
    const clickRate = stats.delivered > 0 ? (uniqueClickCount / stats.delivered * 100).toFixed(2) : 0;
    const clickToOpenRate = uniqueOpenCount > 0 ? (uniqueClickCount / uniqueOpenCount * 100).toFixed(2) : 0;
    const bounceRate = stats.delivered > 0 ? (stats.bounced / stats.delivered * 100).toFixed(2) : 0;
    const complaintRate = stats.delivered > 0 ? (stats.complained / stats.delivered * 100).toFixed(2) : 0;

    return {
      summary: {
        delivered: stats.delivered,
        totalOpens: stats.opened,
        uniqueOpens: uniqueOpenCount,
        totalClicks: stats.clicked,
        uniqueClicks: uniqueClickCount,
        unsubscribed: stats.unsubscribed,
        complained: stats.complained,
        failed: stats.failed,
        bounced: stats.bounced,
        openRate: `${openRate}%`,
        clickRate: `${clickRate}%`,
        clickToOpenRate: `${clickToOpenRate}%`,
        bounceRate: `${bounceRate}%`,
        complaintRate: `${complaintRate}%`
      },
      clickedUrls: stats.clickedUrls,
      failureReasons: stats.failureReasons,
      bounceReasons: stats.bounceReasons,
      openTimestamps: stats.openTimestamps.map(t => t.toISOString()),
      clickTimestamps: stats.clickTimestamps.map(t => t.toISOString()),
      recentEvents: stats.recentEvents
    };

  } catch (error) {
    console.error('   ❌ Error fetching Mailgun data:', error.message);
    return {
      error: error.message,
      summary: {}
    };
  }
}

/**
 * Fetch Mailgun tag statistics
 * Dec 17, 2025: Updated to track scripts template subject line tags only
 */
async function getMailgunTagStats() {
  console.log('🏷️  Fetching Mailgun tag statistics...');

  try {
    // Scripts template subject line tags (4-way rotation)
    const tags = ['subject_built_tool', 'subject_never_struggle', 'subject_ai_wrote', 'subject_what_to_say'];
    const tagStats = {};

    for (const tag of tags) {
      const response = await axios.get(`${MAILGUN_BASE_URL}/tags/${tag}/stats`, {
        auth: {
          username: 'api',
          password: MAILGUN_API_KEY
        },
        params: {
          event: 'accepted',
          duration: '30d'
        }
      });

      // Fetch opens
      const opensResponse = await axios.get(`${MAILGUN_BASE_URL}/tags/${tag}/stats`, {
        auth: {
          username: 'api',
          password: MAILGUN_API_KEY
        },
        params: {
          event: 'opened',
          duration: '30d'
        }
      });

      // Fetch clicks
      const clicksResponse = await axios.get(`${MAILGUN_BASE_URL}/tags/${tag}/stats`, {
        auth: {
          username: 'api',
          password: MAILGUN_API_KEY
        },
        params: {
          event: 'clicked',
          duration: '30d'
        }
      });

      tagStats[tag] = {
        accepted: response.data,
        opened: opensResponse.data,
        clicked: clicksResponse.data
      };
    }

    console.log(`   ✓ Fetched stats for ${tags.length} tags`);
    return tagStats;

  } catch (error) {
    console.error('   ❌ Error fetching tag stats:', error.message);
    return { error: error.message };
  }
}

/**
 * Get GA4 email campaign traffic specifically
 */
async function getGA4EmailTraffic() {
  console.log('📊 Fetching GA4 email campaign traffic...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'pagePath' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagementRate' },
      { name: 'bounceRate' },
      { name: 'screenPageViews' }
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: {
          value: 'mailgun',
          matchType: 'EXACT'
        }
      }
    },
    orderBys: [
      { metric: { metricName: 'sessions' }, desc: true }
    ],
    limit: 100
  });

  return formatGA4Response(response);
}

/**
 * Format GA4 response
 */
function formatGA4Response(response) {
  if (!response.rows || response.rows.length === 0) {
    return { data: [], totals: {} };
  }

  const dimensionHeaders = response.dimensionHeaders.map(h => h.name);
  const metricHeaders = response.metricHeaders.map(h => h.name);

  const data = response.rows.map(row => {
    const item = {};
    row.dimensionValues.forEach((dim, i) => {
      item[dimensionHeaders[i]] = dim.value;
    });
    row.metricValues.forEach((metric, i) => {
      item[metricHeaders[i]] = parseFloat(metric.value) || metric.value;
    });
    return item;
  });

  const totals = {};
  metricHeaders.forEach((metric, i) => {
    if (response.totals && response.totals[0]) {
      totals[metric] = parseFloat(response.totals[0].metricValues[i].value);
    }
  });

  return { data, totals, rowCount: response.rowCount };
}

/**
 * Analyze email-to-web funnel
 */
function analyzeEmailFunnel(mailgunData, ga4EmailData) {
  console.log('🔍 Analyzing email-to-web conversion funnel...');

  // Helper to sum from data array when totals unavailable
  const sumMetric = (data, metric) => (data || []).reduce((sum, row) => sum + (row[metric] || 0), 0);
  const avgMetric = (data, metric) => (data || []).length > 0 ? sumMetric(data, metric) / data.length : 0;

  // Get GA4 metrics from totals or sum from data
  const ga4Sessions = ga4EmailData.totals.sessions || sumMetric(ga4EmailData.data, 'sessions');
  const ga4ActiveUsers = ga4EmailData.totals.activeUsers || sumMetric(ga4EmailData.data, 'activeUsers');
  const ga4NewUsers = ga4EmailData.totals.newUsers || sumMetric(ga4EmailData.data, 'newUsers');
  const ga4EngagementRate = ga4EmailData.totals.engagementRate || avgMetric(ga4EmailData.data, 'engagementRate');
  const ga4PageViews = ga4EmailData.totals.screenPageViews || sumMetric(ga4EmailData.data, 'screenPageViews');

  const analysis = {
    emailPerformance: {
      emailsSent: mailgunData.summary.delivered || 0,
      uniqueOpens: mailgunData.summary.uniqueOpens || 0,
      openRate: mailgunData.summary.openRate,
      uniqueClicks: mailgunData.summary.uniqueClicks || 0,
      clickRate: mailgunData.summary.clickRate,
      clickToOpenRate: mailgunData.summary.clickToOpenRate
    },
    websiteTraffic: {
      totalSessions: ga4Sessions,
      activeUsers: ga4ActiveUsers,
      newUsers: ga4NewUsers,
      avgEngagementRate: ga4EngagementRate,
      pageViews: ga4PageViews
    },
    funnelMetrics: {},
    insights: []
  };

  // Calculate funnel conversion rates
  const emailsSent = mailgunData.summary.delivered || 0;
  const emailClicks = mailgunData.summary.uniqueClicks || 0;
  const websiteSessions = ga4Sessions;

  if (emailsSent > 0) {
    analysis.funnelMetrics = {
      emailToClick: `${((emailClicks / emailsSent) * 100).toFixed(2)}%`,
      emailToWebsite: `${((websiteSessions / emailsSent) * 100).toFixed(2)}%`,
      clickToSession: emailClicks > 0 ? `${((websiteSessions / emailClicks) * 100).toFixed(2)}%` : '0%'
    };
  }

  // Generate insights
  const openRate = parseFloat(mailgunData.summary.openRate);
  const clickRate = parseFloat(mailgunData.summary.clickRate);

  if (openRate > 20) {
    analysis.insights.push('✅ Excellent open rate (>20%) - subject line is working well');
  } else if (openRate > 15) {
    analysis.insights.push('👍 Good open rate (15-20%) - subject line is effective');
  } else if (openRate > 10) {
    analysis.insights.push('⚠️ Average open rate (10-15%) - consider testing new subject lines');
  } else if (openRate > 0) {
    analysis.insights.push('❌ Low open rate (<10%) - subject line needs improvement');
  } else {
    analysis.insights.push('⏳ No opens yet - emails may have just been sent (check back in 24-48 hours)');
  }

  if (clickRate > 3) {
    analysis.insights.push('✅ Strong click rate (>3%) - email content is compelling');
  } else if (clickRate > 2) {
    analysis.insights.push('👍 Good click rate (2-3%) - email content is working');
  } else if (clickRate > 1) {
    analysis.insights.push('⚠️ Average click rate (1-2%) - consider strengthening CTAs');
  } else if (clickRate > 0) {
    analysis.insights.push('❌ Low click rate (<1%) - email content or CTA needs work');
  } else {
    analysis.insights.push('⏳ No clicks yet - recipients need time to engage (check back in 24-48 hours)');
  }

  // Check tracking discrepancy
  if (emailClicks > websiteSessions * 2) {
    analysis.insights.push('⚠️ Mailgun shows more clicks than GA4 sessions - possible tracking issues or bot clicks');
  } else if (emailClicks > 0 && websiteSessions === 0) {
    analysis.insights.push('❌ Clicks detected but no GA4 sessions - UTM tracking may be broken');
  } else if (emailClicks > 0 && websiteSessions > 0) {
    analysis.insights.push('✅ Email clicks are converting to website sessions - tracking is working');
  }

  return analysis;
}

/**
 * Main function to fetch and combine all data
 */
async function fetchCombinedAnalytics() {
  console.log('🔍 Fetching Combined Analytics (GA4 + Mailgun)...\n');

  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, 'reports', timestamp);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Fetch all data in parallel
    const [
      mailgunCampaignData,
      mailgunTagData,
      ga4EmailTraffic
    ] = await Promise.all([
      getMailgunCampaignStats(),
      getMailgunTagStats(),
      getGA4EmailTraffic()
    ]);

    // Analyze the combined data
    const funnelAnalysis = analyzeEmailFunnel(mailgunCampaignData, ga4EmailTraffic);

    // Create combined report
    const combinedReport = {
      reportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      mailgun: {
        campaignStats: mailgunCampaignData,
        tagStats: mailgunTagData
      },
      ga4: {
        emailTraffic: ga4EmailTraffic
      },
      funnelAnalysis
    };

    // Save reports
    saveReport(outputDir, 'mailgun-data', mailgunCampaignData);
    saveReport(outputDir, 'mailgun-tags', mailgunTagData);
    saveReport(outputDir, 'ga4-email-traffic', ga4EmailTraffic);
    saveReport(outputDir, 'combined-analysis', combinedReport);

    console.log(`\n✅ Combined analytics saved to: ${outputDir}`);
    console.log(`📊 Combined report: ${path.join(outputDir, 'combined-analysis.json')}\n`);

    // Print summary to console
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL CAMPAIGN PERFORMANCE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Emails Delivered:     ${mailgunCampaignData.summary.delivered}`);
    console.log(`Unique Opens:         ${mailgunCampaignData.summary.uniqueOpens} (${mailgunCampaignData.summary.openRate})`);
    console.log(`Unique Clicks:        ${mailgunCampaignData.summary.uniqueClicks} (${mailgunCampaignData.summary.clickRate})`);
    console.log(`Click-to-Open Rate:   ${mailgunCampaignData.summary.clickToOpenRate}`);
    console.log(`Bounced:              ${mailgunCampaignData.summary.bounced} (${mailgunCampaignData.summary.bounceRate})`);
    console.log(`Unsubscribed:         ${mailgunCampaignData.summary.unsubscribed}`);
    console.log(`Spam Complaints:      ${mailgunCampaignData.summary.complained}`);

    // Sum from data array if totals not available
    const sumMetric = (data, metric) => data.reduce((sum, row) => sum + (row[metric] || 0), 0);
    const avgMetric = (data, metric) => data.length > 0 ? sumMetric(data, metric) / data.length : 0;

    const sessions = ga4EmailTraffic.totals.sessions || sumMetric(ga4EmailTraffic.data, 'sessions');
    const activeUsers = ga4EmailTraffic.totals.activeUsers || sumMetric(ga4EmailTraffic.data, 'activeUsers');
    const newUsers = ga4EmailTraffic.totals.newUsers || sumMetric(ga4EmailTraffic.data, 'newUsers');
    const pageViews = ga4EmailTraffic.totals.screenPageViews || sumMetric(ga4EmailTraffic.data, 'screenPageViews');
    const engagementRate = ga4EmailTraffic.totals.engagementRate || avgMetric(ga4EmailTraffic.data, 'engagementRate');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🌐 WEBSITE TRAFFIC FROM EMAIL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Sessions:             ${sessions}`);
    console.log(`Active Users:         ${activeUsers}`);
    console.log(`New Users:            ${newUsers}`);
    console.log(`Page Views:           ${pageViews}`);
    console.log(`Avg Engagement Rate:  ${(engagementRate * 100).toFixed(2)}%`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎯 KEY INSIGHTS');
    console.log('═══════════════════════════════════════════════════════════');
    funnelAnalysis.insights.forEach(insight => console.log(insight));
    console.log('═══════════════════════════════════════════════════════════\n');

    return outputDir;

  } catch (error) {
    console.error('❌ Error fetching combined analytics:', error.message);
    throw error;
  }
}

/**
 * Save report to JSON file
 */
function saveReport(dir, name, data) {
  const filePath = path.join(dir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`   ✓ Saved ${name}.json`);
}

// Run the script
if (require.main === module) {
  fetchCombinedAnalytics()
    .then(outputDir => {
      console.log('✅ Combined analytics fetch complete!');
      console.log(`📁 Reports saved to: ${outputDir}\n`);
    })
    .catch(error => {
      console.error('❌ Failed to fetch combined analytics:', error);
      process.exit(1);
    });
}

module.exports = { fetchCombinedAnalytics };
