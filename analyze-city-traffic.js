const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const propertyId = '485651473';

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: './secrets/ga4-service-account.json',
});

async function analyzeCityTraffic(cityName) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`ANALYZING: ${cityName.toUpperCase()}`);
  console.log('='.repeat(100));

  const dimensionFilter = cityName === '(not set)'
    ? {
        filter: {
          fieldName: 'city',
          stringFilter: {
            matchType: 'EXACT',
            value: '(not set)',
          },
        },
      }
    : {
        filter: {
          fieldName: 'city',
          stringFilter: {
            matchType: 'EXACT',
            value: cityName,
          },
        },
      };

  const [cityResponse] = await analyticsDataClient.runReport({
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
    dimensionFilter,
  });

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

  cityResponse.rows?.forEach((row) => {
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

  const [pageDepthResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '28daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
    ],
    dimensionFilter,
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 15,
  });

  console.log('\n\nTop Pages Visited:');
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

  const totalUsers = cityResponse.rows?.reduce((sum, row) => sum + parseInt(row.metricValues[0].value), 0) || 0;
  const avgPagesPerSession = cityResponse.rows?.length > 0
    ? (cityResponse.rows.reduce((sum, row) => sum + parseFloat(row.metricValues[3].value), 0) / cityResponse.rows.length).toFixed(2)
    : 0;

  console.log('\n\nSUMMARY:');
  console.log(`Total Users: ${totalUsers}`);
  console.log(`Average Pages/Session: ${avgPagesPerSession}`);
  console.log(`Unique Browser/OS Combinations: ${cityResponse.rows?.length || 0}`);
}

async function analyzeAllCities() {
  const citiesToAnalyze = ['Boardman', 'Lanzhou', '(not set)'];

  for (const city of citiesToAnalyze) {
    await analyzeCityTraffic(city);
  }

  console.log('\n\n' + '='.repeat(100));
  console.log('REAL TRAFFIC COMPARISON (Non-Bot Cities)');
  console.log('='.repeat(100));

  const [realTrafficResponse] = await analyticsDataClient.runReport({
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
      andGroup: {
        expressions: [
          {
            notExpression: {
              filter: {
                fieldName: 'city',
                stringFilter: { matchType: 'EXACT', value: 'Boardman' },
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'city',
                stringFilter: { matchType: 'EXACT', value: 'Lanzhou' },
              },
            },
          },
          {
            notExpression: {
              filter: {
                fieldName: 'city',
                stringFilter: { matchType: 'EXACT', value: '(not set)' },
              },
            },
          },
        ],
      },
    },
    limit: 10,
  });

  console.log('\nTop 10 Browser/OS Combinations (Real Users):');
  console.log('-'.repeat(80));
  console.log(
    'Browser'.padEnd(25),
    'OS'.padEnd(20),
    'Users'.padEnd(10),
    'Avg Duration'.padEnd(15),
    'Pages/Session'
  );
  console.log('-'.repeat(80));

  realTrafficResponse.rows?.slice(0, 10).forEach((row) => {
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

  console.log('\n\n' + '='.repeat(100));
  console.log('BOT DETECTION ANALYSIS');
  console.log('='.repeat(100));
  console.log('\nIndicators of bot traffic:');
  console.log('  ✓ Exactly 1.00 pages per session (perfect uniformity)');
  console.log('  ✓ Only visiting homepage or very limited pages');
  console.log('  ✓ Very short session durations (< 30 seconds)');
  console.log('  ✓ Desktop-only traffic (no mobile variation)');
  console.log('  ✓ Unusual browser/OS combinations');
}

analyzeAllCities().catch(console.error);
