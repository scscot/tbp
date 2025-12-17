/**
 * App Store Analytics Fetcher
 * Fetches analytics from both Apple App Store Connect and Google Play Console
 *
 * Usage:
 *   node fetch-appstore-analytics.js [days]
 *
 * Environment:
 *   ASC_KEY_ID - App Store Connect Key ID (or reads from secrets file)
 *   ASC_ISSUER_ID - App Store Connect Issuer ID (or reads from secrets file)
 *   ASC_PRIVATE_KEY_PATH - Path to .p8 private key file
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to Google service account JSON
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { google } = require('googleapis');

// =============================================================================
// CONFIGURATION
// =============================================================================

// App Store Connect
const ASC_KEY_ID = process.env.ASC_KEY_ID || fs.readFileSync(path.join(__dirname, '../secrets/App_Store_Connect/App_Store_Connect_API'), 'utf8').trim();
const ASC_ISSUER_ID = process.env.ASC_ISSUER_ID || fs.readFileSync(path.join(__dirname, '../secrets/App_Store_Connect/app_store_connect_issuer_ID'), 'utf8').trim();
const ASC_PRIVATE_KEY_PATH = process.env.ASC_PRIVATE_KEY_PATH || path.join(__dirname, '../secrets/AuthKey_PKGJ47F6HZ.p8');
const ASC_APP_ID = '6751211622'; // Team Build Pro iOS App ID

// Google Play
const GOOGLE_PLAY_PACKAGE = 'com.scott.ultimatefix'; // Team Build Pro Android package
const GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../secrets/ga4-service-account.json');

// Report settings
const DAYS_BACK = parseInt(process.argv[2]) || 30;

// =============================================================================
// APP STORE CONNECT (iOS)
// =============================================================================

/**
 * Generate JWT for App Store Connect API authentication
 */
function generateASCToken() {
  const privateKey = fs.readFileSync(ASC_PRIVATE_KEY_PATH, 'utf8');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: ASC_ISSUER_ID,
    iat: now,
    exp: now + (20 * 60), // 20 minutes (Apple max)
    aud: 'appstoreconnect-v1'
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: ASC_KEY_ID,
      typ: 'JWT'
    }
  });
}

/**
 * Make authenticated request to App Store Connect API
 */
async function ascRequest(endpoint, params = {}) {
  const token = generateASCToken();
  const url = `https://api.appstoreconnect.apple.com${endpoint}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`ASC API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Get app info from App Store Connect
 */
async function getAppInfo() {
  console.log('📱 Fetching iOS app info...');
  try {
    const data = await ascRequest(`/v1/apps/${ASC_APP_ID}`);
    return {
      id: data.data.id,
      name: data.data.attributes.name,
      bundleId: data.data.attributes.bundleId,
      sku: data.data.attributes.sku
    };
  } catch (error) {
    console.error('Failed to fetch app info:', error.message);
    return null;
  }
}

/**
 * Request and fetch analytics report from App Store Connect
 * The Analytics Reports API requires: CREATE request -> poll for completion -> download
 */
async function requestAnalyticsReport() {
  console.log('📊 Creating analytics report request...');

  try {
    const token = generateASCToken();

    // Step 1: Create a new analytics report request
    const createResponse = await axios.post(
      'https://api.appstoreconnect.apple.com/v1/analyticsReportRequests',
      {
        data: {
          type: 'analyticsReportRequests',
          attributes: {
            accessType: 'ONGOING'
          },
          relationships: {
            app: {
              data: {
                type: 'apps',
                id: ASC_APP_ID
              }
            }
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const requestId = createResponse.data.data.id;
    console.log(`   Report request created: ${requestId}`);

    // Step 2: Get available reports for this request
    const reportsResponse = await ascRequest(`/v1/analyticsReportRequests/${requestId}/reports`);

    return {
      requestId,
      reports: reportsResponse.data || []
    };
  } catch (error) {
    if (error.response?.status === 409) {
      // Report request already exists - get existing one
      console.log('   Existing report request found, fetching...');
      return await getExistingAnalyticsReports();
    }
    console.error('Analytics report request failed:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Get existing analytics reports
 */
async function getExistingAnalyticsReports() {
  try {
    // Get all analytics report requests for the app
    const token = generateASCToken();
    const response = await axios.get(
      `https://api.appstoreconnect.apple.com/v1/apps/${ASC_APP_ID}/analyticsReportRequests`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          'limit': 10
        }
      }
    );

    if (response.data.data?.length > 0) {
      const requestId = response.data.data[0].id;
      console.log(`   Found existing request: ${requestId}`);

      // Get reports for this request
      const reportsResponse = await ascRequest(`/v1/analyticsReportRequests/${requestId}/reports`);

      return {
        requestId,
        reports: reportsResponse.data || []
      };
    }

    return { requestId: null, reports: [] };
  } catch (error) {
    console.error('Failed to get existing reports:', error.message);
    return null;
  }
}

/**
 * Download analytics report instances and parse data
 */
async function downloadAnalyticsData(reports) {
  console.log('📥 Downloading analytics report data...');

  const downloadedData = {
    downloads: [],
    appSessions: [],
    impressions: [],
    pageViews: []
  };

  // Find relevant reports
  const reportTypes = ['APP_DOWNLOADS', 'APP_SESSIONS', 'APP_IMPRESSIONS', 'APP_PAGE_VIEWS'];

  for (const report of reports) {
    const reportCategory = report.attributes?.category;
    const reportName = report.attributes?.name;

    // Look for daily granularity reports with territory dimension
    if (reportTypes.some(type => reportName?.includes(type)) ||
        reportCategory === 'APP_USAGE' || reportCategory === 'APP_STORE_ENGAGEMENT') {

      try {
        // Get report instances (actual data files)
        const instancesResponse = await ascRequest(`/v1/analyticsReports/${report.id}/instances`, {
          'limit': 7  // Last 7 days
        });

        for (const instance of (instancesResponse.data || [])) {
          // Get the download URL for this instance
          const segmentsResponse = await ascRequest(
            `/v1/analyticsReportInstances/${instance.id}/segments`
          );

          for (const segment of (segmentsResponse.data || [])) {
            const downloadUrl = segment.attributes?.url;
            if (downloadUrl) {
              // Download the actual data (gzipped CSV)
              const dataResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer'
              });

              // Parse and store data based on report type
              const parsedData = {
                reportId: report.id,
                reportName,
                category: reportCategory,
                date: instance.attributes?.processingDate,
                rawSize: dataResponse.data.length
              };

              if (reportName?.includes('DOWNLOAD')) {
                downloadedData.downloads.push(parsedData);
              } else if (reportName?.includes('SESSION')) {
                downloadedData.appSessions.push(parsedData);
              } else if (reportName?.includes('IMPRESSION')) {
                downloadedData.impressions.push(parsedData);
              } else if (reportName?.includes('PAGE_VIEW')) {
                downloadedData.pageViews.push(parsedData);
              }
            }
          }
        }
      } catch (error) {
        // Skip reports that fail to download
        continue;
      }
    }
  }

  return downloadedData;
}

/**
 * Get summary of available analytics reports
 */
async function getAnalyticsReportSummary(reports) {
  const summary = {
    totalReports: reports.length,
    categories: {},
    reportTypes: []
  };

  for (const report of reports) {
    const category = report.attributes?.category || 'UNKNOWN';
    const name = report.attributes?.name || 'Unknown';

    if (!summary.categories[category]) {
      summary.categories[category] = 0;
    }
    summary.categories[category]++;

    summary.reportTypes.push({
      id: report.id,
      name,
      category
    });
  }

  return summary;
}

/**
 * Get Sales and Trends reports (alternative to Analytics API)
 * This uses the older but more reliable Sales and Trends endpoint
 */
async function getSalesReport() {
  console.log('💰 Fetching iOS Sales and Trends data...');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_BACK);

  try {
    // Sales reports endpoint
    const token = generateASCToken();
    const response = await axios.get('https://api.appstoreconnect.apple.com/v1/salesReports', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/a]gzip'
      },
      params: {
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': endDate.toISOString().split('T')[0],
        'filter[reportSubType]': 'SUMMARY',
        'filter[reportType]': 'SALES',
        'filter[vendorNumber]': '91443546' // You may need to update this
      },
      responseType: 'arraybuffer'
    });

    return response.data;
  } catch (error) {
    // Sales reports may not be available for all account types
    console.log('Sales reports not available (may require different account setup)');
    return null;
  }
}

/**
 * Fetch iOS app performance metrics using the perfPowerMetrics endpoint
 */
async function getAppPerformanceMetrics() {
  console.log('⚡ Fetching iOS performance metrics...');

  try {
    const data = await ascRequest(`/v1/apps/${ASC_APP_ID}/perfPowerMetrics`);
    return data;
  } catch (error) {
    console.log('Performance metrics not available:', error.message);
    return null;
  }
}

/**
 * Fetch iOS customer reviews
 */
async function getCustomerReviews() {
  console.log('⭐ Fetching iOS customer reviews...');

  try {
    const data = await ascRequest(`/v1/apps/${ASC_APP_ID}/customerReviews`, {
      'sort': '-createdDate',
      'limit': 50
    });

    const reviews = data.data?.map(review => ({
      id: review.id,
      rating: review.attributes?.rating,
      title: review.attributes?.title,
      body: review.attributes?.body,
      reviewerNickname: review.attributes?.reviewerNickname,
      territory: review.attributes?.territory,
      createdDate: review.attributes?.createdDate
    })) || [];

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    reviews.forEach(r => {
      if (r.rating) {
        ratingDistribution[r.rating]++;
        totalRating += r.rating;
      }
    });

    return {
      reviews,
      totalReviews: reviews.length,
      averageRating: reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 'N/A',
      ratingDistribution
    };
  } catch (error) {
    console.log('Customer reviews not available:', error.message);
    return null;
  }
}

/**
 * Get iOS app versions info
 */
async function getAppVersions() {
  console.log('📦 Fetching iOS app versions...');

  try {
    const data = await ascRequest(`/v1/apps/${ASC_APP_ID}/appStoreVersions`, {
      'limit': 5
    });

    return data.data?.map(version => ({
      id: version.id,
      versionString: version.attributes?.versionString,
      platform: version.attributes?.platform,
      appStoreState: version.attributes?.appStoreState,
      releaseType: version.attributes?.releaseType,
      createdDate: version.attributes?.createdDate
    })) || [];
  } catch (error) {
    console.log('App versions not available:', error.message);
    return null;
  }
}

// =============================================================================
// GOOGLE PLAY (Android)
// =============================================================================

/**
 * Initialize Google Play Developer API client
 */
async function getPlayDeveloperClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: GOOGLE_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  return google.androidpublisher({
    version: 'v3',
    auth
  });
}

/**
 * Get Android app details
 */
async function getAndroidAppDetails() {
  console.log('🤖 Fetching Android app details...');

  try {
    const play = await getPlayDeveloperClient();

    // Get app details
    const response = await play.edits.insert({
      packageName: GOOGLE_PLAY_PACKAGE
    });

    const editId = response.data.id;

    // Get app listings
    const listings = await play.edits.listings.list({
      packageName: GOOGLE_PLAY_PACKAGE,
      editId
    });

    // Delete the edit (we don't want to commit changes)
    await play.edits.delete({
      packageName: GOOGLE_PLAY_PACKAGE,
      editId
    });

    return {
      packageName: GOOGLE_PLAY_PACKAGE,
      listings: listings.data.listings
    };
  } catch (error) {
    console.error('Failed to fetch Android app details:', error.message);
    return null;
  }
}

/**
 * Get Android acquisition/stats reports
 * Note: Detailed stats require Google Play Console access and may need
 * the Cloud Storage export feature enabled
 */
async function getAndroidStats() {
  console.log('📈 Fetching Android stats...');

  try {
    const play = await getPlayDeveloperClient();

    // Reviews can give us some indication of activity
    const reviews = await play.reviews.list({
      packageName: GOOGLE_PLAY_PACKAGE
    });

    return {
      recentReviews: reviews.data.reviews?.slice(0, 10) || [],
      totalReviews: reviews.data.reviews?.length || 0
    };
  } catch (error) {
    console.error('Failed to fetch Android stats:', error.message);
    return null;
  }
}

// =============================================================================
// COMBINED REPORT GENERATION
// =============================================================================

/**
 * Generate combined analytics report for both platforms
 */
async function generateCombinedReport() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  APP STORE ANALYTICS - Team Build Pro');
  console.log(`  Report Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`  Period: Last ${DAYS_BACK} days`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      days: DAYS_BACK,
      startDate: new Date(Date.now() - DAYS_BACK * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    ios: {},
    android: {},
    combined: {}
  };

  // ==========================================================================
  // iOS Data
  // ==========================================================================
  console.log('\n📱 iOS (App Store Connect)');
  console.log('─────────────────────────────────────────────────────────────────');

  // Get app info
  const iosAppInfo = await getAppInfo();
  if (iosAppInfo) {
    report.ios.appInfo = iosAppInfo;
    console.log(`   App: ${iosAppInfo.name} (${iosAppInfo.bundleId})`);
  }

  // Get app versions
  const iosVersions = await getAppVersions();
  if (iosVersions) {
    report.ios.versions = iosVersions;
    const latestVersion = iosVersions.find(v => v.appStoreState === 'READY_FOR_SALE');
    if (latestVersion) {
      console.log(`   Current Version: ${latestVersion.versionString} (${latestVersion.appStoreState})`);
    }
  }

  // Get customer reviews
  const iosReviews = await getCustomerReviews();
  if (iosReviews) {
    report.ios.reviews = iosReviews;
    console.log(`   Reviews: ${iosReviews.totalReviews} (Avg: ${iosReviews.averageRating})`);
  }

  // Request analytics reports
  const analyticsReports = await requestAnalyticsReport();
  if (analyticsReports && analyticsReports.reports?.length > 0) {
    const reportSummary = await getAnalyticsReportSummary(analyticsReports.reports);
    report.ios.analyticsReports = {
      requestId: analyticsReports.requestId,
      ...reportSummary
    };
    console.log(`   Analytics Reports: ${reportSummary.totalReports} available`);
    console.log(`   Categories: ${Object.entries(reportSummary.categories).map(([k,v]) => `${k}(${v})`).join(', ')}`);
  }

  // Get performance metrics
  const perfMetrics = await getAppPerformanceMetrics();
  if (perfMetrics) {
    report.ios.performanceMetrics = perfMetrics;
  }

  // ==========================================================================
  // Android Data
  // ==========================================================================
  console.log('\n🤖 Android (Google Play)');
  console.log('─────────────────────────────────────────────────────────────────');

  // Get app details
  const androidDetails = await getAndroidAppDetails();
  if (androidDetails) {
    report.android.appDetails = androidDetails;
    console.log(`   Package: ${androidDetails.packageName}`);
  }

  // Get stats/reviews
  const androidStats = await getAndroidStats();
  if (androidStats) {
    report.android.stats = androidStats;
    console.log(`   Recent Reviews: ${androidStats.totalReviews}`);
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  report.combined = {
    platforms: {
      ios: {
        available: !!iosAppInfo,
        appId: ASC_APP_ID,
        bundleId: iosAppInfo?.bundleId || 'N/A'
      },
      android: {
        available: !!androidDetails,
        packageName: GOOGLE_PLAY_PACKAGE
      }
    },
    dataAvailability: {
      iosAnalytics: !!analyticsReports,
      iosPerformance: !!perfMetrics,
      androidDetails: !!androidDetails,
      androidReviews: !!androidStats
    }
  };

  console.log(`   iOS App ID: ${ASC_APP_ID}`);
  console.log(`   Android Package: ${GOOGLE_PLAY_PACKAGE}`);
  console.log(`   iOS Data Available: ${report.combined.dataAvailability.iosAnalytics ? 'Yes' : 'Limited'}`);
  console.log(`   Android Data Available: ${report.combined.dataAvailability.androidDetails ? 'Yes' : 'Limited'}`);

  return report;
}

/**
 * Save report to file
 */
function saveReport(report) {
  const dateStr = new Date().toISOString().split('T')[0];
  const reportsDir = path.join(__dirname, 'reports', dateStr);

  // Create directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const filePath = path.join(reportsDir, 'appstore-analytics.json');
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

  console.log('');
  console.log(`📁 Report saved to: ${filePath}`);

  return filePath;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    console.log('');
    console.log('🚀 Starting App Store Analytics Fetch...');
    console.log('');

    // Verify credentials exist
    console.log('🔐 Checking credentials...');

    // Check iOS credentials
    if (!fs.existsSync(ASC_PRIVATE_KEY_PATH)) {
      console.error(`❌ iOS: Private key not found at ${ASC_PRIVATE_KEY_PATH}`);
      process.exit(1);
    }
    console.log(`   ✓ iOS: Key ID ${ASC_KEY_ID.substring(0, 4)}...`);
    console.log(`   ✓ iOS: Issuer ID ${ASC_ISSUER_ID.substring(0, 8)}...`);

    // Check Android credentials
    if (!fs.existsSync(GOOGLE_CREDENTIALS_PATH)) {
      console.warn(`⚠️  Android: Credentials not found at ${GOOGLE_CREDENTIALS_PATH}`);
      console.log('   Android analytics will be skipped.');
    } else {
      console.log(`   ✓ Android: Service account configured`);
    }

    // Generate report
    const report = await generateCombinedReport();

    // Save report
    saveReport(report);

    console.log('');
    console.log('✅ Analytics fetch complete!');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();
