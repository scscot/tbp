/**
 * Verify Boardman Traffic Filtering
 * Checks if traffic from Boardman, OR (AWS data center) is being filtered
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const GA4_PROPERTY_ID = '485651473';

async function verifyBoardmanFilter() {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    console.log('='.repeat(60));
    console.log('BOARDMAN TRAFFIC FILTER VERIFICATION');
    console.log('Property ID:', GA4_PROPERTY_ID);
    console.log('='.repeat(60));
    console.log('');

    // Check last 7 days of traffic by city
    console.log('📍 TRAFFIC BY CITY (Last 7 Days):');
    console.log('-'.repeat(50));

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'city' },
        { name: 'region' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' }
      ],
      orderBys: [
        { metric: { metricName: 'activeUsers' }, desc: true }
      ],
      limit: 20
    });

    let boardmanFound = false;
    let boardmanUsers = 0;
    let totalUsers = 0;

    if (response.rows && response.rows.length > 0) {
      console.log('Rank | City                | Region        | Users | Sessions | Engage% | Avg Duration');
      console.log('-'.repeat(90));

      response.rows.forEach((row, index) => {
        const city = row.dimensionValues[0].value;
        const region = row.dimensionValues[1].value;
        const users = parseInt(row.metricValues[0].value);
        const sessions = parseInt(row.metricValues[1].value);
        const engagementRate = (parseFloat(row.metricValues[2].value) * 100).toFixed(1);
        const avgDuration = parseFloat(row.metricValues[3].value).toFixed(1);

        totalUsers += users;

        // Flag Boardman traffic
        const isBoardman = city.toLowerCase() === 'boardman' ||
                          (city.toLowerCase().includes('boardman') && region.toLowerCase().includes('oregon'));

        if (isBoardman) {
          boardmanFound = true;
          boardmanUsers = users;
          console.log(`${String(index + 1).padStart(4)} | ⚠️  ${city.padEnd(17)} | ${region.padEnd(13)} | ${String(users).padStart(5)} | ${String(sessions).padStart(8)} | ${engagementRate.padStart(6)}% | ${avgDuration.padStart(6)}s`);
        } else {
          console.log(`${String(index + 1).padStart(4)} | ${city.padEnd(20)} | ${region.padEnd(13)} | ${String(users).padStart(5)} | ${String(sessions).padStart(8)} | ${engagementRate.padStart(6)}% | ${avgDuration.padStart(6)}s`);
        }
      });
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('FILTER STATUS:');
    console.log('-'.repeat(60));

    if (boardmanFound) {
      const pct = ((boardmanUsers / totalUsers) * 100).toFixed(1);
      console.log(`⚠️  BOARDMAN TRAFFIC DETECTED: ${boardmanUsers} users (${pct}% of total)`);
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. Filter is set to "Testing" mode (not "Active")');
      console.log('  2. Filter was recently created and hasn\'t taken effect');
      console.log('  3. Filter conditions don\'t match the traffic source');
      console.log('');
      console.log('Recommended action:');
      console.log('  Go to GA4 Admin → Data Settings → Data Filters');
      console.log('  Ensure the internal traffic filter status is "Active"');
    } else {
      console.log('✅ NO BOARDMAN TRAFFIC DETECTED');
      console.log('');
      console.log('Your data filter appears to be working correctly.');
      console.log('Traffic from Boardman, OR (AWS data center) is being excluded.');
    }

    console.log('='.repeat(60));
    console.log('');

    // Also check direct traffic percentage
    console.log('📊 TRAFFIC SOURCE BREAKDOWN:');
    console.log('-'.repeat(50));

    const [sourceResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' }
      ],
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
      limit: 10
    });

    if (sourceResponse.rows && sourceResponse.rows.length > 0) {
      let totalSessions = 0;
      sourceResponse.rows.forEach(row => {
        totalSessions += parseInt(row.metricValues[0].value);
      });

      sourceResponse.rows.forEach(row => {
        const source = row.dimensionValues[0].value;
        const medium = row.dimensionValues[1].value;
        const sessions = parseInt(row.metricValues[0].value);
        const users = parseInt(row.metricValues[1].value);
        const pct = ((sessions / totalSessions) * 100).toFixed(1);

        console.log(`  ${source} / ${medium}: ${sessions} sessions (${pct}%) - ${users} users`);
      });
    }

    console.log('');

  } catch (error) {
    console.error('Error verifying filter:', error.message);
  }
}

verifyBoardmanFilter();
