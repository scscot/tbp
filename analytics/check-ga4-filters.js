/**
 * Check GA4 Data Filters
 * Verifies internal traffic filtering configuration
 */

const { AnalyticsAdminServiceClient } = require('@google-analytics/admin');

const GA4_PROPERTY_ID = '485651473';

async function checkDataFilters() {
  try {
    // Initialize admin client with service account credentials
    const adminClient = new AnalyticsAdminServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    console.log('='.repeat(60));
    console.log('GA4 DATA FILTER VERIFICATION');
    console.log('Property ID:', GA4_PROPERTY_ID);
    console.log('='.repeat(60));
    console.log('');

    // List all data streams to verify property access
    console.log('📊 DATA STREAMS:');
    console.log('-'.repeat(40));

    const [streams] = await adminClient.listDataStreams({
      parent: `properties/${GA4_PROPERTY_ID}`
    });

    if (streams && streams.length > 0) {
      streams.forEach(stream => {
        console.log(`  • ${stream.displayName || stream.name}`);
        console.log(`    Type: ${stream.type}`);
        if (stream.webStreamData) {
          console.log(`    URL: ${stream.webStreamData.defaultUri}`);
        }
      });
    } else {
      console.log('  No data streams found');
    }
    console.log('');

    // Check data filters (internal traffic exclusion)
    console.log('🔍 DATA FILTERS:');
    console.log('-'.repeat(40));

    try {
      const [filters] = await adminClient.listDataRedactionSettings
        ? await adminClient.listDataRedactionSettings({ parent: `properties/${GA4_PROPERTY_ID}` })
        : [[]];

      if (filters && filters.length > 0) {
        filters.forEach(filter => {
          console.log(`  • ${filter.displayName || filter.name}`);
          console.log(`    State: ${filter.state}`);
        });
      }
    } catch (e) {
      // Data filters may require different API method
    }

    // Check property details
    console.log('📋 PROPERTY DETAILS:');
    console.log('-'.repeat(40));

    const [property] = await adminClient.getProperty({
      name: `properties/${GA4_PROPERTY_ID}`
    });

    if (property) {
      console.log(`  Display Name: ${property.displayName}`);
      console.log(`  Create Time: ${property.createTime}`);
      console.log(`  Time Zone: ${property.timeZone}`);
      console.log(`  Currency: ${property.currencyCode}`);
      console.log(`  Industry: ${property.industryCategory}`);
    }
    console.log('');

    // Check custom dimensions (which may include internal traffic markers)
    console.log('📐 CUSTOM DIMENSIONS:');
    console.log('-'.repeat(40));

    try {
      const [dimensions] = await adminClient.listCustomDimensions({
        parent: `properties/${GA4_PROPERTY_ID}`
      });

      if (dimensions && dimensions.length > 0) {
        dimensions.forEach(dim => {
          console.log(`  • ${dim.displayName}`);
          console.log(`    Parameter: ${dim.parameterName}`);
          console.log(`    Scope: ${dim.scope}`);
        });
      } else {
        console.log('  No custom dimensions found');
      }
    } catch (e) {
      console.log('  Unable to fetch custom dimensions:', e.message);
    }
    console.log('');

    // Note about internal traffic filters
    console.log('ℹ️  IMPORTANT NOTE:');
    console.log('-'.repeat(40));
    console.log('  Internal traffic filters (including IP-based and');
    console.log('  geographic exclusions like Boardman, OR) are configured');
    console.log('  in the GA4 web interface under:');
    console.log('');
    console.log('  Admin → Data Settings → Data Filters');
    console.log('');
    console.log('  The Admin API has limited access to these settings.');
    console.log('  To verify Boardman exclusion, check:');
    console.log('  1. Data Filters for internal traffic rules');
    console.log('  2. Internal Traffic Definition under Data Collection');
    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error checking GA4 filters:', error.message);

    if (error.message.includes('PERMISSION_DENIED')) {
      console.log('');
      console.log('The service account may not have Admin API access.');
      console.log('Required role: roles/analytics.admin or similar');
    }
  }
}

checkDataFilters();
