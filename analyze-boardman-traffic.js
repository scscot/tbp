const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const propertyId = '485651473';

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: './secrets/ga4-service-account.json',
});

async function analyzeBoardmanTraffic() {
  console.log('Analyzing Boardman traffic patterns...\n');

  const [boardmanResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'browser' },
      { name: 'operatingSystem' },
      { name: 'deviceCategory' },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
      { name: 'engagementRate' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'city',
        stringFilter: {
          matchType: 'EXACT',
          value: 'Boardman',
        },
      },
    },
  });

  console.log('=== BOARDMAN TRAFFIC ANALYSIS ===');
  console.log('\nBrowser/OS/Device Breakdown:');
  console.log('-'.repeat(100));
  console.log(
    'Browser'.padEnd(25),
    'OS'.padEnd(20),
    'Device'.padEnd(15),
    'Users'.padEnd(10),
    'Avg Duration'.padEnd(15),
    'Pages/Session'
  );
  console.log('-'.repeat(100));

  boardmanResponse.rows?.forEach((row) => {
    const browser = row.dimensionValues[0].value;
    const os = row.dimensionValues[1].value;
    const device = row.dimensionValues[2].value;
    const users = row.metricValues[0].value;
    const avgDuration = parseFloat(row.metricValues[2].value).toFixed(1);
    const pagesPerSession = parseFloat(row.metricValues[3].value).toFixed(2);

    console.log(
      browser.padEnd(25),
      os.padEnd(20),
      device.padEnd(15),
      users.padEnd(10),
      `${avgDuration}s`.padEnd(15),
      pagesPerSession
    );
  });

  const [otherCitiesResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'browser' },
      { name: 'operatingSystem' },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViewsPerSession' },
    ],
    dimensionFilter: {
      notExpression: {
        filter: {
          fieldName: 'city',
          stringFilter: {
            matchType: 'EXACT',
            value: 'Boardman',
          },
        },
      },
    },
    limit: 10,
  });

  console.log('\n\n=== TOP 10 BROWSER/OS COMBINATIONS (NON-BOARDMAN) FOR COMPARISON ===');
  console.log('-'.repeat(80));
  console.log(
    'Browser'.padEnd(25),
    'OS'.padEnd(20),
    'Users'.padEnd(10),
    'Avg Duration'.padEnd(15),
    'Pages/Session'
  );
  console.log('-'.repeat(80));

  otherCitiesResponse.rows?.slice(0, 10).forEach((row) => {
    const browser = row.dimensionValues[0].value;
    const os = row.dimensionValues[1].value;
    const users = row.metricValues[0].value;
    const avgDuration = parseFloat(row.metricValues[1].value).toFixed(1);
    const pagesPerSession = parseFloat(row.metricValues[2].value).toFixed(2);

    console.log(
      browser.padEnd(25),
      os.padEnd(20),
      users.padEnd(10),
      `${avgDuration}s`.padEnd(15),
      pagesPerSession
    );
  });

  const [pageDepthResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'city',
        stringFilter: {
          matchType: 'EXACT',
          value: 'Boardman',
        },
      },
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 15,
  });

  console.log('\n\n=== TOP PAGES VISITED BY BOARDMAN TRAFFIC ===');
  console.log('-'.repeat(80));
  console.log('Page Path'.padEnd(60), 'Page Views'.padEnd(12), 'Sessions');
  console.log('-'.repeat(80));

  pageDepthResponse.rows?.forEach((row) => {
    const pagePath = row.dimensionValues[0].value;
    const pageViews = row.metricValues[0].value;
    const sessions = row.metricValues[1].value;

    console.log(
      pagePath.padEnd(60),
      pageViews.padEnd(12),
      sessions
    );
  });

  console.log('\n\n=== ANALYSIS SUMMARY ===');
  console.log('Look for patterns that indicate bot traffic:');
  console.log('  ✓ Unusual browser/OS combinations (e.g., old browsers, headless)');
  console.log('  ✓ Identical session durations across all visitors');
  console.log('  ✓ Very low pages per session (bots often only hit homepage)');
  console.log('  ✓ Desktop-only traffic (humans use mix of mobile/desktop)');
  console.log('  ✓ Only visiting homepage or very few pages');
}

analyzeBoardmanTraffic().catch(console.error);
