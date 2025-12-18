const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');
const path = require('path');

// Initialize the GA4 client
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable for auth
const analyticsDataClient = new BetaAnalyticsDataClient();

// Your GA4 Property ID (visible in GA4 Admin > Property Settings)
const propertyId = '485651473';

// Default date range - can be overridden via command line args
let startDate = process.argv[2] || '7daysAgo';
let endDate = process.argv[3] || 'today';

/**
 * Fetch email campaign traffic from GA4
 * Filters by utm_source=mailgun to track actual clicks from email campaigns
 */
async function fetchEmailCampaignAnalytics() {
  console.log('📧 Fetching Email Campaign Analytics from GA4...');
  console.log(`📅 Date range: ${startDate} to ${endDate}\n`);

  try {
    const [
      campaignOverview,
      templatePerformance,
      dailyTrend,
      landingPagePerformance
    ] = await Promise.all([
      getCampaignOverview(),
      getTemplatePerformance(),
      getDailyTrend(),
      getLandingPagePerformance()
    ]);

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 EMAIL CAMPAIGN PERFORMANCE REPORT');
    console.log('='.repeat(60));

    // Campaign Overview
    console.log('\n📈 CAMPAIGN OVERVIEW (utm_source=mailgun)');
    console.log('-'.repeat(40));
    if (campaignOverview.data.length > 0) {
      const totals = campaignOverview.totals;
      console.log(`Total Sessions: ${totals.sessions || 0}`);
      console.log(`Total Users: ${totals.activeUsers || 0}`);
      console.log(`New Users: ${totals.newUsers || 0}`);
      console.log(`Avg Session Duration: ${(totals.averageSessionDuration || 0).toFixed(1)}s`);
      console.log(`Engagement Rate: ${((totals.engagementRate || 0) * 100).toFixed(1)}%`);
    } else {
      console.log('No email campaign traffic detected in this period.');
    }

    // Subject Line Performance (scripts template only)
    console.log('\n📧 SUBJECT LINE PERFORMANCE (scripts template)');
    console.log('-'.repeat(40));
    if (templatePerformance.data.length > 0) {
      console.log('Subject Tag'.padEnd(24) + 'Sessions'.padEnd(12) + 'Users'.padEnd(10) + 'Engagement');
      console.log('-'.repeat(56));
      templatePerformance.data.forEach(row => {
        const subjectTag = (row.sessionManualAdContent || '(not set)').padEnd(24);
        const sessions = String(row.sessions || 0).padEnd(12);
        const users = String(row.activeUsers || 0).padEnd(10);
        const engagement = ((row.engagementRate || 0) * 100).toFixed(1) + '%';
        console.log(`${subjectTag}${sessions}${users}${engagement}`);
      });
    } else {
      console.log('No subject line data available yet.');
    }

    // Daily Trend
    console.log('\n📅 DAILY TRAFFIC TREND');
    console.log('-'.repeat(40));
    if (dailyTrend.data.length > 0) {
      console.log('Date'.padEnd(15) + 'Sessions'.padEnd(12) + 'Users'.padEnd(10) + 'New Users');
      console.log('-'.repeat(47));
      dailyTrend.data.forEach(row => {
        const date = row.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3').padEnd(15);
        const sessions = String(row.sessions || 0).padEnd(12);
        const users = String(row.activeUsers || 0).padEnd(10);
        const newUsers = String(row.newUsers || 0);
        console.log(`${date}${sessions}${users}${newUsers}`);
      });
    } else {
      console.log('No daily trend data available.');
    }

    // Landing Page Performance
    console.log('\n📄 LANDING PAGE PERFORMANCE');
    console.log('-'.repeat(40));
    if (landingPagePerformance.data.length > 0) {
      console.log('Page'.padEnd(40) + 'Views'.padEnd(10) + 'Engagement');
      console.log('-'.repeat(60));
      landingPagePerformance.data.forEach(row => {
        const page = (row.pagePath || '/').substring(0, 38).padEnd(40);
        const views = String(row.screenPageViews || 0).padEnd(10);
        const engagement = ((row.engagementRate || 0) * 100).toFixed(1) + '%';
        console.log(`${page}${views}${engagement}`);
      });
    } else {
      console.log('No landing page data available.');
    }

    // Save report
    const timestamp = new Date().toISOString().split('T')[0];
    const outputDir = path.join(__dirname, 'reports', timestamp);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const report = {
      reportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      campaignOverview,
      templatePerformance,
      dailyTrend,
      landingPagePerformance
    };

    const reportPath = path.join(outputDir, 'email-campaign-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${reportPath}`);

    return report;

  } catch (error) {
    console.error('❌ Error fetching email campaign analytics:', error.message);
    throw error;
  }
}

/**
 * Get overall campaign metrics filtered by utm_source=mailgun
 */
async function getCampaignOverview() {
  console.log('📊 Fetching campaign overview...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'averageSessionDuration' },
      { name: 'engagementRate' },
      { name: 'bounceRate' }
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
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get performance by template version (utm_content)
 * This shows A/B test results between 'initial' and 'simple' templates
 */
async function getTemplatePerformance() {
  console.log('📧 Fetching template performance...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionManualAdContent' }  // This captures utm_content
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'averageSessionDuration' },
      { name: 'engagementRate' },
      { name: 'bounceRate' }
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
    limit: 10
  });

  return formatResponse(response);
}

/**
 * Get daily traffic trend from email campaigns
 */
async function getDailyTrend() {
  console.log('📅 Fetching daily trend...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'date' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagementRate' }
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
      { dimension: { dimensionName: 'date' }, desc: false }
    ],
    limit: 30
  });

  return formatResponse(response);
}

/**
 * Get landing page performance for email traffic
 */
async function getLandingPagePerformance() {
  console.log('📄 Fetching landing page performance...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' }
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'engagementRate' },
      { name: 'bounceRate' }
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
      { metric: { metricName: 'screenPageViews' }, desc: true }
    ],
    limit: 20
  });

  return formatResponse(response);
}

/**
 * Format GA4 API response into readable structure
 */
function formatResponse(response) {
  if (!response.rows || response.rows.length === 0) {
    return { data: [], totals: {} };
  }

  const dimensionHeaders = response.dimensionHeaders.map(h => h.name);
  const metricHeaders = response.metricHeaders.map(h => h.name);

  const data = response.rows.map(row => {
    const item = {};

    // Add dimensions
    row.dimensionValues.forEach((dim, i) => {
      item[dimensionHeaders[i]] = dim.value;
    });

    // Add metrics
    row.metricValues.forEach((metric, i) => {
      item[metricHeaders[i]] = parseFloat(metric.value) || metric.value;
    });

    return item;
  });

  // Calculate totals
  const totals = {};
  metricHeaders.forEach((metric, i) => {
    if (response.totals && response.totals[0]) {
      totals[metric] = parseFloat(response.totals[0].metricValues[i].value);
    }
  });

  return { data, totals, rowCount: response.rowCount };
}

// Run the script
if (require.main === module) {
  console.log('📧 Email Campaign Analytics Report');
  console.log('Usage: node fetch-email-campaign-analytics.js [startDate] [endDate]');
  console.log('Example: node fetch-email-campaign-analytics.js 7daysAgo today\n');

  fetchEmailCampaignAnalytics()
    .then(() => {
      console.log('\n✅ Email campaign analytics fetch complete!');
    })
    .catch(error => {
      console.error('❌ Failed to fetch analytics:', error);
      process.exit(1);
    });
}

module.exports = { fetchEmailCampaignAnalytics };
