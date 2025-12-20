const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const fs = require('fs');
const path = require('path');

// Initialize the GA4 client
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable for auth
const analyticsDataClient = new BetaAnalyticsDataClient();

// Your GA4 Property ID (visible in GA4 Admin > Property Settings)
const propertyId = '485651473'; // Update this with your actual property ID

// Date range for analysis (can be overridden via command line args)
const args = process.argv.slice(2);
const startDate = args[0] || '30daysAgo';
const endDate = args[1] || 'today';

/**
 * Main function to fetch all GA4 reports
 */
async function fetchAllReports() {
  console.log('🔍 Fetching Google Analytics 4 data...');
  console.log(`📅 Date range: ${startDate} to ${endDate}\n`);

  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, 'reports', timestamp);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Fetch all reports in parallel
    const [
      demographics,
      trafficSources,
      emailCampaign,
      userBehavior,
      conversions,
      deviceInfo,
      pagePerformance,
      eventTracking
    ] = await Promise.all([
      getDemographics(),
      getTrafficSources(),
      getEmailCampaignPerformance(),
      getUserBehavior(),
      getConversions(),
      getDeviceInfo(),
      getPagePerformance(),
      getEventTracking()
    ]);

    // Save individual reports
    saveReport(outputDir, 'demographics', demographics);
    saveReport(outputDir, 'traffic-sources', trafficSources);
    saveReport(outputDir, 'email-campaign', emailCampaign);
    saveReport(outputDir, 'user-behavior', userBehavior);
    saveReport(outputDir, 'conversions', conversions);
    saveReport(outputDir, 'device-info', deviceInfo);
    saveReport(outputDir, 'page-performance', pagePerformance);
    saveReport(outputDir, 'event-tracking', eventTracking);

    // Create summary report
    const summary = createSummary({
      demographics,
      trafficSources,
      emailCampaign,
      userBehavior,
      conversions,
      deviceInfo,
      pagePerformance,
      eventTracking
    });

    saveReport(outputDir, 'summary', summary);

    console.log(`\n✅ All reports saved to: ${outputDir}`);
    console.log(`📊 Summary report: ${path.join(outputDir, 'summary.json')}\n`);

    return outputDir;

  } catch (error) {
    console.error('❌ Error fetching GA4 data:', error.message);
    throw error;
  }
}

/**
 * Get user demographics (country, city, language)
 */
async function getDemographics() {
  console.log('📍 Fetching demographics...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'country' },
      { name: 'city' },
      { name: 'language' }
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' }
    ],
    orderBys: [
      { metric: { metricName: 'activeUsers' }, desc: true }
    ],
    limit: 100
  });

  return formatResponse(response);
}

/**
 * Get traffic sources (how users find the app/site)
 */
async function getTrafficSources() {
  console.log('🚀 Fetching traffic sources...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'sessionManualAdContent' }  // utm_content
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagementRate' },
      { name: 'conversions' }
    ],
    orderBys: [
      { metric: { metricName: 'sessions' }, desc: true }
    ],
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get email campaign performance (filtered by utm_source=mailgun)
 */
async function getEmailCampaignPerformance() {
  console.log('📧 Fetching email campaign performance...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionCampaignName' },
      { name: 'sessionManualAdContent' },  // utm_content (subject tag)
      { name: 'pagePath' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'engagementRate' },
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
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get user behavior (pages visited, time on site, bounce rate)
 */
async function getUserBehavior() {
  console.log('👤 Fetching user behavior...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' }
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'engagementRate' }
    ],
    orderBys: [
      { metric: { metricName: 'screenPageViews' }, desc: true }
    ],
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get conversion data (key events, revenue)
 */
async function getConversions() {
  console.log('💰 Fetching conversions...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'eventName' }
    ],
    metrics: [
      { name: 'eventCount' },
      { name: 'conversions' },
      { name: 'totalRevenue' }
    ],
    orderBys: [
      { metric: { metricName: 'eventCount' }, desc: true }
    ],
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get device and platform info
 */
async function getDeviceInfo() {
  console.log('📱 Fetching device info...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'deviceCategory' },
      { name: 'operatingSystem' },
      { name: 'browser' }
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'engagementRate' }
    ],
    orderBys: [
      { metric: { metricName: 'activeUsers' }, desc: true }
    ],
    limit: 50
  });

  return formatResponse(response);
}

/**
 * Get page/screen performance
 */
async function getPagePerformance() {
  console.log('⚡ Fetching page performance...');

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
      { name: 'userEngagementDuration' }
    ],
    orderBys: [
      { metric: { metricName: 'screenPageViews' }, desc: true }
    ],
    limit: 20
  });

  return formatResponse(response);
}

/**
 * Get event tracking data
 */
async function getEventTracking() {
  console.log('📊 Fetching event tracking...');

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'eventName' }
    ],
    metrics: [
      { name: 'eventCount' },
      { name: 'eventCountPerUser' },
      { name: 'eventValue' }
    ],
    orderBys: [
      { metric: { metricName: 'eventCount' }, desc: true }
    ],
    limit: 100
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

/**
 * Create summary report with key insights
 */
function createSummary(reports) {
  const summary = {
    reportDate: new Date().toISOString(),
    dateRange: { startDate, endDate },
    keyMetrics: {
      totalUsers: reports.demographics.totals.activeUsers || 0,
      newUsers: reports.demographics.totals.newUsers || 0,
      sessions: reports.trafficSources.totals.sessions || 0,
      engagementRate: reports.trafficSources.totals.engagementRate || 0,
      averageSessionDuration: reports.userBehavior.totals.averageSessionDuration || 0,
      totalConversions: reports.conversions.totals.conversions || 0,
      totalRevenue: reports.conversions.totals.totalRevenue || 0
    },
    emailCampaign: {
      totalSessions: reports.emailCampaign.totals.sessions || 0,
      totalUsers: reports.emailCampaign.totals.activeUsers || 0,
      engagementRate: reports.emailCampaign.totals.engagementRate || 0,
      bySubject: reports.emailCampaign.data.slice(0, 10).map(e => ({
        campaign: e.sessionCampaignName,
        subjectTag: e.sessionManualAdContent,
        landingPage: e.pagePath,
        sessions: e.sessions,
        users: e.activeUsers,
        engagementRate: e.engagementRate
      }))
    },
    topCountries: reports.demographics.data.slice(0, 5).map(d => ({
      country: d.country,
      users: d.activeUsers,
      engagementRate: d.engagementRate
    })),
    topSources: reports.trafficSources.data.slice(0, 5).map(s => ({
      source: s.sessionSource,
      medium: s.sessionMedium,
      campaign: s.sessionCampaignName,
      utmContent: s.sessionManualAdContent,
      sessions: s.sessions,
      users: s.activeUsers
    })),
    topPages: reports.pagePerformance.data.slice(0, 10).map(p => ({
      path: p.pagePath,
      views: p.screenPageViews,
      engagementRate: p.engagementRate
    })),
    topEvents: reports.eventTracking.data.slice(0, 10).map(e => ({
      event: e.eventName,
      count: e.eventCount
    })),
    deviceBreakdown: reports.deviceInfo.data.map(d => ({
      device: d.deviceCategory,
      os: d.operatingSystem,
      users: d.activeUsers
    }))
  };

  return summary;
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
  fetchAllReports()
    .then(outputDir => {
      console.log('✅ Analytics data fetch complete!');
      console.log(`📁 Reports saved to: ${outputDir}\n`);
    })
    .catch(error => {
      console.error('❌ Failed to fetch analytics:', error);
      process.exit(1);
    });
}

module.exports = { fetchAllReports };
