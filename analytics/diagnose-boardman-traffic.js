/**
 * Diagnose Boardman Traffic
 * Detailed analysis to understand why traffic isn't being filtered
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const GA4_PROPERTY_ID = '485651473';

async function diagnoseBoardmanTraffic() {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    console.log('='.repeat(70));
    console.log('BOARDMAN TRAFFIC DIAGNOSTIC');
    console.log('='.repeat(70));
    console.log('');

    // Check traffic by date to see when Boardman traffic occurred
    console.log('📅 BOARDMAN TRAFFIC BY DATE:');
    console.log('-'.repeat(50));

    const [dateResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'date' },
        { name: 'city' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'city',
          stringFilter: {
            value: 'Boardman',
            matchType: 'EXACT'
          }
        }
      },
      orderBys: [
        { dimension: { dimensionName: 'date' }, desc: true }
      ]
    });

    if (dateResponse.rows && dateResponse.rows.length > 0) {
      console.log('Date       | Users | Sessions');
      console.log('-'.repeat(35));
      dateResponse.rows.forEach(row => {
        const date = row.dimensionValues[0].value;
        const formattedDate = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
        const users = row.metricValues[0].value;
        const sessions = row.metricValues[1].value;
        console.log(`${formattedDate} | ${users.padStart(5)} | ${sessions.padStart(8)}`);
      });
    } else {
      console.log('No Boardman traffic found in last 14 days');
    }
    console.log('');

    // Check what device/browser the Boardman traffic is using
    console.log('🖥️  BOARDMAN TRAFFIC - DEVICE/BROWSER DETAILS:');
    console.log('-'.repeat(50));

    const [deviceResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'city' },
        { name: 'deviceCategory' },
        { name: 'browser' },
        { name: 'operatingSystem' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'city',
          stringFilter: {
            value: 'Boardman',
            matchType: 'EXACT'
          }
        }
      }
    });

    if (deviceResponse.rows && deviceResponse.rows.length > 0) {
      deviceResponse.rows.forEach(row => {
        const device = row.dimensionValues[1].value;
        const browser = row.dimensionValues[2].value;
        const os = row.dimensionValues[3].value;
        const users = row.metricValues[0].value;
        console.log(`  ${device} / ${browser} / ${os}: ${users} users`);
      });
    }
    console.log('');

    // Check landing pages for Boardman traffic
    console.log('📄 BOARDMAN TRAFFIC - LANDING PAGES:');
    console.log('-'.repeat(50));

    const [pageResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'city' },
        { name: 'landingPage' }
      ],
      metrics: [
        { name: 'sessions' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'city',
          stringFilter: {
            value: 'Boardman',
            matchType: 'EXACT'
          }
        }
      },
      orderBys: [
        { metric: { metricName: 'sessions' }, desc: true }
      ],
      limit: 10
    });

    if (pageResponse.rows && pageResponse.rows.length > 0) {
      pageResponse.rows.forEach(row => {
        const page = row.dimensionValues[1].value;
        const sessions = row.metricValues[0].value;
        console.log(`  ${sessions} sessions: ${page}`);
      });
    }
    console.log('');

    // Check hostname to see if it's coming from expected domain
    console.log('🌐 BOARDMAN TRAFFIC - HOSTNAMES:');
    console.log('-'.repeat(50));

    const [hostResponse] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'city' },
        { name: 'hostName' }
      ],
      metrics: [
        { name: 'sessions' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'city',
          stringFilter: {
            value: 'Boardman',
            matchType: 'EXACT'
          }
        }
      }
    });

    if (hostResponse.rows && hostResponse.rows.length > 0) {
      hostResponse.rows.forEach(row => {
        const host = row.dimensionValues[1].value;
        const sessions = row.metricValues[0].value;
        console.log(`  ${sessions} sessions: ${host}`);
      });
    }
    console.log('');

    // Check if there's a testDataFilterName dimension being used
    console.log('🔍 CHECKING FOR INTERNAL TRAFFIC MARKERS:');
    console.log('-'.repeat(50));
    console.log('');
    console.log('GA4 Internal Traffic Filtering works by:');
    console.log('  1. Defining internal traffic rules (IP-based or traffic_type parameter)');
    console.log('  2. Creating a Data Filter that excludes traffic matching those rules');
    console.log('');
    console.log('Common issues:');
    console.log('  • IP-based filters only work for web - not for bots spoofing location');
    console.log('  • Bots may be accessing from rotating IPs outside your defined ranges');
    console.log('  • Geographic location is determined by IP, which bots can mask');
    console.log('');

    // Summary and recommendations
    console.log('='.repeat(70));
    console.log('DIAGNOSIS SUMMARY:');
    console.log('='.repeat(70));
    console.log('');
    console.log('The Boardman traffic is likely BOT TRAFFIC that:');
    console.log('  • Uses AWS data center IPs (Boardman, OR is AWS us-west-2)');
    console.log('  • May be rotating through many different IPs');
    console.log('  • Cannot be filtered by standard IP-based internal traffic rules');
    console.log('');
    console.log('RECOMMENDED SOLUTIONS:');
    console.log('-'.repeat(50));
    console.log('');
    console.log('1. USE GA4 BOT FILTERING (if not already enabled):');
    console.log('   Admin → Data Streams → [Your Stream] → Configure Tag Settings');
    console.log('   → Show All → Exclude known bots and spiders');
    console.log('');
    console.log('2. CREATE A SEGMENT TO EXCLUDE IN REPORTS:');
    console.log('   Create a segment excluding city="Boardman" + region="Oregon"');
    console.log('   Apply this segment when viewing reports');
    console.log('');
    console.log('3. USE BIGQUERY EXPORT + FILTERING:');
    console.log('   Export to BigQuery and filter out Boardman in SQL queries');
    console.log('');
    console.log('4. BLOCK AT CLOUDFLARE/FIREWALL LEVEL:');
    console.log('   Block AWS us-west-2 IP ranges at the edge before they hit GA4');
    console.log('');

  } catch (error) {
    console.error('Error diagnosing traffic:', error.message);
  }
}

diagnoseBoardmanTraffic();
