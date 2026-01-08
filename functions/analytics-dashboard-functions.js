// ==============================
// TBP ANALYTICS DASHBOARD FUNCTIONS
// Unified analytics endpoint combining GA4, iOS App Store, and Google Play data
// ==============================

const {
  onRequest,
  logger,
} = require('./shared/utilities');

const { defineSecret } = require('firebase-functions/params');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { androidpublisher } = require('@googleapis/androidpublisher');
const { GoogleAuth } = require('google-auth-library');

// App Store Connect API secrets
const ascKeyId = defineSecret('ASC_KEY_ID');
const ascIssuerId = defineSecret('ASC_ISSUER_ID');
const ascPrivateKey = defineSecret('ASC_PRIVATE_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const OpenAI = require('openai');

// GA4 Configuration
const GA4_PROPERTY_ID = '485651473';

// Google Play Configuration
const PLAY_STORE_PACKAGE_NAME = 'com.scott.ultimatefix';

// ==============================
// GA4 Analytics Functions
// ==============================

// Path to service account credentials
const SERVICE_ACCOUNT_KEY_PATH = './ga4-service-account.json';

/**
 * Initialize GA4 client with service account credentials
 */
function getGA4Client() {
  // Use explicit service account credentials for GA4 access
  return new BetaAnalyticsDataClient({
    keyFilename: SERVICE_ACCOUNT_KEY_PATH
  });
}

/**
 * Fetch GA4 website analytics data
 */
async function fetchGA4Analytics(dateRange = '30daysAgo') {
  const client = getGA4Client();
  const propertyId = GA4_PROPERTY_ID;

  const startDate = dateRange === '7daysAgo' ? '7daysAgo' : '30daysAgo';
  const endDate = 'today';

  try {
    // Fetch multiple reports in parallel
    const [
      overviewResponse,
      trafficSourcesResponse,
      emailCampaignResponse,
      topPagesResponse,
      deviceInfoResponse,
      eventsResponse
    ] = await Promise.all([
      // Overview metrics
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' }
        ]
      }),
      // Traffic sources
      client.runReport({
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
          { name: 'engagementRate' }
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }),
      // Email campaign (filtered by mailgun source)
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'sessionCampaignName' },
          { name: 'sessionManualAdContent' },
          { name: 'pagePath' }
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'engagementRate' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionSource',
            stringFilter: { value: 'mailgun', matchType: 'EXACT' }
          }
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20
      }),
      // Top pages
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' }
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15
      }),
      // Device breakdown
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'deviceCategory' },
          { name: 'operatingSystem' }
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' }
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15
      }),
      // Top events
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'eventCount' },
          { name: 'eventCountPerUser' }
        ],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 20
      })
    ]);

    // Format responses
    return {
      dateRange: { startDate, endDate },
      overview: formatGA4Overview(overviewResponse[0]),
      trafficSources: formatGA4Report(trafficSourcesResponse[0]),
      emailCampaign: formatGA4Report(emailCampaignResponse[0]),
      topPages: formatGA4Report(topPagesResponse[0]),
      deviceBreakdown: formatGA4Report(deviceInfoResponse[0]),
      topEvents: formatGA4Report(eventsResponse[0])
    };

  } catch (error) {
    logger.error('Error fetching GA4 data:', error);
    return {
      error: true,
      message: error.message,
      dateRange: { startDate, endDate }
    };
  }
}

/**
 * Format GA4 overview response
 */
function formatGA4Overview(response) {
  if (!response.rows || response.rows.length === 0) {
    return {
      activeUsers: 0,
      newUsers: 0,
      sessions: 0,
      engagementRate: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      pageViews: 0
    };
  }

  const row = response.rows[0];
  const metricHeaders = response.metricHeaders.map(h => h.name);

  const metrics = {};
  row.metricValues.forEach((val, i) => {
    metrics[metricHeaders[i]] = parseFloat(val.value) || 0;
  });

  return {
    activeUsers: metrics.activeUsers || 0,
    newUsers: metrics.newUsers || 0,
    sessions: metrics.sessions || 0,
    engagementRate: parseFloat((metrics.engagementRate * 100).toFixed(2)) || 0,
    averageSessionDuration: parseFloat(metrics.averageSessionDuration?.toFixed(1)) || 0,
    bounceRate: parseFloat((metrics.bounceRate * 100).toFixed(2)) || 0,
    pageViews: metrics.screenPageViews || 0
  };
}

/**
 * Format GA4 report response with dimensions
 */
function formatGA4Report(response) {
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
      const value = parseFloat(metric.value);
      // Format engagement rate as percentage
      if (metricHeaders[i] === 'engagementRate') {
        item[metricHeaders[i]] = parseFloat((value * 100).toFixed(2));
      } else {
        item[metricHeaders[i]] = value || 0;
      }
    });

    return item;
  });

  // Calculate totals
  const totals = {};
  metricHeaders.forEach((metric, i) => {
    if (response.totals && response.totals[0]) {
      const value = parseFloat(response.totals[0].metricValues[i].value);
      totals[metric] = metric === 'engagementRate'
        ? parseFloat((value * 100).toFixed(2))
        : value || 0;
    }
  });

  return { data, totals, rowCount: response.rowCount };
}

// ==============================
// App Store Connect Functions (reused from analytics-functions.js)
// ==============================

const ASC_APP_ID = '6751211622';
const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

/**
 * Generate JWT token for App Store Connect API
 */
function generateASCToken(keyId, issuerId, privateKey) {
  let decodedKey;
  try {
    decodedKey = Buffer.from(privateKey, 'base64').toString('utf8');
    if (!decodedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      decodedKey = privateKey;
    }
  } catch {
    decodedKey = privateKey;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + (20 * 60),
    aud: 'appstoreconnect-v1'
  };

  return jwt.sign(payload, decodedKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' }
  });
}

/**
 * Make authenticated request to App Store Connect API
 */
async function ascRequest(endpoint, token, method = 'GET', data = null, params = {}) {
  const url = `${ASC_BASE_URL}${endpoint}`;

  try {
    let response;
    if (method === 'POST') {
      response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } else {
      response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      logger.error(`ASC API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Fetch iOS App Store metrics
 */
async function fetchAppStoreMetrics(keyId, issuerId, privateKey, openaiKey) {
  const token = generateASCToken(keyId, issuerId, privateKey);

  try {
    // Fetch app info, versions, and reviews in parallel
    const [appInfoResponse, versionsResponse, reviewsResponse] = await Promise.all([
      ascRequest(`/apps/${ASC_APP_ID}`, token),
      ascRequest(`/apps/${ASC_APP_ID}/appStoreVersions`, token, 'GET', null, { limit: 5 }),
      ascRequest(`/apps/${ASC_APP_ID}/customerReviews`, token, 'GET', null, { sort: '-createdDate', limit: 10 })
    ]);

    // Format app info
    const appInfo = {
      id: appInfoResponse.data.id,
      name: appInfoResponse.data.attributes.name,
      bundleId: appInfoResponse.data.attributes.bundleId,
      sku: appInfoResponse.data.attributes.sku
    };

    // Format versions
    const versions = versionsResponse.data.map(v => ({
      id: v.id,
      versionString: v.attributes.versionString,
      platform: v.attributes.platform,
      appStoreState: v.attributes.appStoreState,
      releaseType: v.attributes.releaseType,
      createdDate: v.attributes.createdDate
    }));

    // Format reviews
    const reviews = reviewsResponse.data.map(r => ({
      id: r.id,
      rating: r.attributes.rating,
      title: r.attributes.title,
      body: r.attributes.body,
      reviewerNickname: r.attributes.reviewerNickname,
      territory: r.attributes.territory,
      createdDate: r.attributes.createdDate
    }));

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    reviews.forEach(r => {
      ratingDistribution[r.rating]++;
      totalRating += r.rating;
    });

    // Get analytics reports summary
    let analyticsReports = { totalReports: 0, categories: {} };
    let actualMetrics = { dataAvailable: false, message: 'Analytics reports not available' };

    try {
      // Try to get existing analytics report requests
      const existingRequests = await ascRequest(
        `/apps/${ASC_APP_ID}/analyticsReportRequests`,
        token
      );

      if (existingRequests.data && existingRequests.data.length > 0) {
        const requestId = existingRequests.data[0].id;

        const reportsResponse = await ascRequest(
          `/analyticsReportRequests/${requestId}/reports`,
          token,
          'GET',
          null,
          { limit: 50 }
        );

        const reportTypes = reportsResponse.data.map(r => ({
          id: r.id,
          name: r.attributes.name,
          category: r.attributes.category
        }));

        const categories = {};
        reportTypes.forEach(r => {
          categories[r.category] = (categories[r.category] || 0) + 1;
        });

        analyticsReports = {
          requestId,
          totalReports: reportTypes.length,
          categories,
          reportTypes
        };

        // Try to fetch actual metrics
        actualMetrics = await fetchActualAppStoreMetrics(requestId, reportTypes, token);
      }
    } catch (analyticsError) {
      logger.warn('Could not fetch analytics reports:', analyticsError.message);
    }

    // Generate AI observations
    let observations = null;
    if (openaiKey) {
      observations = await generateAIObservations({
        appInfo,
        versions,
        reviews,
        actualMetrics
      }, openaiKey);
    }

    return {
      appInfo,
      versions,
      reviews: {
        reviews,
        totalReviews: reviews.length,
        averageRating: reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 'N/A',
        ratingDistribution
      },
      analyticsReports,
      actualMetrics,
      observations
    };

  } catch (error) {
    logger.error('Error fetching App Store metrics:', error);
    return {
      error: true,
      message: error.message
    };
  }
}

/**
 * Fetch actual metrics from App Store analytics reports
 */
async function fetchActualAppStoreMetrics(reportRequestId, reportTypes, token) {
  const metrics = {
    downloads: { total: 0, byTerritory: {} },
    engagement: { totalImpressions: 0, totalPageViews: 0, byTerritory: {} },
    sessions: { totalSessions: 0, activeDevices: 0 },
    dataAvailable: false,
    message: null
  };

  if (!reportRequestId || !reportTypes || reportTypes.length === 0) {
    metrics.message = 'No analytics report request available';
    return metrics;
  }

  const downloadsReport = reportTypes.find(r =>
    r.name === 'App Downloads Detailed' || r.name === 'App Downloads Standard'
  );
  const engagementReport = reportTypes.find(r =>
    r.name === 'App Store Discovery and Engagement Detailed' || r.name === 'App Store Discovery and Engagement Standard'
  );

  async function fetchReportData(reportId) {
    try {
      const instancesResponse = await ascRequest(
        `/analyticsReports/${reportId}/instances`,
        token,
        'GET',
        null,
        { limit: 30 }
      );

      if (!instancesResponse.data || instancesResponse.data.length === 0) {
        return null;
      }

      const reportData = [];
      for (const instance of instancesResponse.data.slice(0, 7)) {
        try {
          const segmentsResponse = await ascRequest(
            `/analyticsReportInstances/${instance.id}/segments`,
            token,
            'GET',
            null,
            { limit: 10 }
          );

          if (segmentsResponse.data && segmentsResponse.data.length > 0) {
            for (const segment of segmentsResponse.data) {
              if (segment.attributes && segment.attributes.url) {
                const dataResponse = await axios.get(segment.attributes.url, {
                  responseType: 'text',
                  decompress: true
                });

                const lines = dataResponse.data.split('\n');
                if (lines.length > 1) {
                  const headers = lines[0].split('\t');
                  for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim()) {
                      const values = lines[i].split('\t');
                      const row = {};
                      headers.forEach((h, idx) => {
                        row[h.trim()] = values[idx] ? values[idx].trim() : '';
                      });
                      row._date = instance.attributes?.processingDate || '';
                      reportData.push(row);
                    }
                  }
                }
              }
            }
          }
        } catch (instanceError) {
          logger.warn(`Could not fetch instance data: ${instanceError.message}`);
        }
      }

      return reportData;
    } catch (error) {
      logger.warn(`Could not fetch report: ${error.message}`);
      return null;
    }
  }

  // Fetch downloads data
  if (downloadsReport) {
    const downloadData = await fetchReportData(downloadsReport.id);
    if (downloadData && downloadData.length > 0) {
      metrics.dataAvailable = true;

      downloadData.forEach(row => {
        const count = parseInt(row['Total Downloads'] || row['Downloads'] || row['First Time Downloads'] || '0', 10);
        metrics.downloads.total += count;

        const territory = row['Territory'] || row['Storefront'] || 'Unknown';
        metrics.downloads.byTerritory[territory] = (metrics.downloads.byTerritory[territory] || 0) + count;
      });
    }
  }

  // Fetch engagement data
  if (engagementReport) {
    const engagementData = await fetchReportData(engagementReport.id);
    if (engagementData && engagementData.length > 0) {
      metrics.dataAvailable = true;

      engagementData.forEach(row => {
        const impressions = parseInt(row['Impressions'] || row['Total Impressions'] || '0', 10);
        const pageViews = parseInt(row['Product Page Views'] || row['Page Views'] || '0', 10);

        metrics.engagement.totalImpressions += impressions;
        metrics.engagement.totalPageViews += pageViews;

        const territory = row['Territory'] || row['Storefront'] || 'Unknown';
        metrics.engagement.byTerritory[territory] = (metrics.engagement.byTerritory[territory] || 0) + impressions;
      });
    }
  }

  if (!metrics.dataAvailable) {
    metrics.message = 'Analytics Reports API data not yet available. The API requires 24-48 hours to populate after initial request.';
  }

  return metrics;
}

/**
 * Generate AI-powered observations using structured JSON output
 */
async function generateAIObservations(data, openaiKey) {
  try {
    const openai = new OpenAI({ apiKey: openaiKey });

    const context = {
      appName: data.appInfo?.name || 'Team Build Pro',
      currentVersion: data.versions?.[0]?.versionString || 'Unknown',
      averageRating: data.reviews?.averageRating || 'N/A',
      totalReviews: data.reviews?.totalReviews || 0,
      downloads: data.actualMetrics?.downloads?.total || 0,
      impressions: data.actualMetrics?.engagement?.totalImpressions || 0,
      metricsAvailable: data.actualMetrics?.dataAvailable || false
    };

    const prompt = `Analyze this iOS app data for "${context.appName}" and provide insights.

Current Data:
- App Version: ${context.currentVersion}
- Average Rating: ${context.averageRating}/5 (${context.totalReviews} reviews)
- Downloads (7 days): ${context.downloads}
- Impressions: ${context.impressions}
- Metrics Available: ${context.metricsAvailable}

Return a JSON object with these exact keys:
{
  "keyObservations": ["observation 1", "observation 2", "observation 3"],
  "strengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "recommendedActions": ["action 1", "action 2", "action 3"]
}

Be specific and actionable. Keep responses concise.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an app analytics expert. Always respond with valid JSON only, no markdown or additional text.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;

    try {
      const analysis = JSON.parse(content);
      return {
        generatedAt: new Date().toISOString(),
        analysis,
        inputMetrics: context
      };
    } catch (parseError) {
      logger.warn('Failed to parse AI response as JSON:', parseError);
      return {
        generatedAt: new Date().toISOString(),
        analysis: {
          keyObservations: ['AI analysis temporarily unavailable'],
          strengths: [],
          areasForImprovement: [],
          recommendedActions: []
        },
        inputMetrics: context
      };
    }

  } catch (error) {
    logger.error('Error generating AI analysis:', error);
    return {
      generatedAt: new Date().toISOString(),
      error: error.message,
      analysis: null
    };
  }
}

// ==============================
// Google Play Analytics Functions
// ==============================

/**
 * Get Google Play Developer API client
 */
function getPlayStoreClient() {
  const auth = new GoogleAuth({
    keyFilename: SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });
  return androidpublisher({
    version: 'v3',
    auth
  });
}

/**
 * Fetch Google Play Store analytics data
 */
async function fetchGooglePlayMetrics() {
  try {
    const play = getPlayStoreClient();
    const packageName = PLAY_STORE_PACKAGE_NAME;

    // Fetch app details and reviews in parallel
    const [appDetails, reviewsResponse] = await Promise.all([
      // Get app edit info (basic app details)
      play.edits.insert({
        packageName: packageName
      }).then(async (editResponse) => {
        const editId = editResponse.data.id;
        try {
          // Get app listings
          const listings = await play.edits.listings.list({
            packageName: packageName,
            editId: editId
          });

          // Get current track info (release info)
          const tracks = await play.edits.tracks.list({
            packageName: packageName,
            editId: editId
          });

          // Delete the edit (we don't need to commit)
          await play.edits.delete({
            packageName: packageName,
            editId: editId
          });

          return {
            listings: listings.data.listings || [],
            tracks: tracks.data.tracks || []
          };
        } catch (e) {
          // Clean up edit on error
          try {
            await play.edits.delete({
              packageName: packageName,
              editId: editId
            });
          } catch (deleteError) {
            // Ignore cleanup errors
          }
          throw e;
        }
      }),

      // Get reviews
      play.reviews.list({
        packageName: packageName
      })
    ]);

    // Process app details
    const englishListing = appDetails.listings.find(l => l.language === 'en-US') || appDetails.listings[0];
    const productionTrack = appDetails.tracks.find(t => t.track === 'production');
    const latestRelease = productionTrack?.releases?.[0];

    // Process reviews
    const reviews = (reviewsResponse.data.reviews || []).map(r => ({
      reviewId: r.reviewId,
      authorName: r.authorName,
      rating: r.comments?.[0]?.userComment?.starRating || 0,
      text: r.comments?.[0]?.userComment?.text || '',
      lastModified: r.comments?.[0]?.userComment?.lastModified?.seconds
        ? new Date(r.comments[0].userComment.lastModified.seconds * 1000).toISOString()
        : null,
      device: r.comments?.[0]?.userComment?.device || 'Unknown',
      androidOsVersion: r.comments?.[0]?.userComment?.androidOsVersion || 'Unknown',
      appVersionCode: r.comments?.[0]?.userComment?.appVersionCode || null,
      appVersionName: r.comments?.[0]?.userComment?.appVersionName || null
    }));

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    reviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating]++;
        totalRating += r.rating;
      }
    });

    return {
      available: true,
      appInfo: {
        packageName: packageName,
        title: englishListing?.title || 'Team Build Pro',
        shortDescription: englishListing?.shortDescription || '',
        fullDescription: englishListing?.fullDescription || ''
      },
      currentVersion: {
        versionName: latestRelease?.name || 'Unknown',
        versionCode: latestRelease?.versionCodes?.[0] || null,
        status: latestRelease?.status || 'Unknown',
        releaseNotes: latestRelease?.releaseNotes?.[0]?.text || ''
      },
      reviews: {
        reviews: reviews.slice(0, 10), // Latest 10 reviews
        totalReviews: reviews.length,
        averageRating: reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 'N/A',
        ratingDistribution
      },
      // Note: Download stats require Google Play Console Reports API (separate setup)
      metrics: {
        dataAvailable: false,
        message: 'Download and install metrics require Play Console Reports API access'
      }
    };

  } catch (error) {
    logger.error('Error fetching Google Play metrics:', error);

    // Provide helpful error message based on error type
    let message = 'Failed to fetch Google Play data';
    let setupInstructions = null;

    if (error.code === 401 || error.message?.includes('Login Required') || error.message?.includes('UNAUTHENTICATED')) {
      message = 'API authentication failed. Service account needs API access in Play Console.';
      setupInstructions = {
        step1: 'Go to Play Console > Setup > API access',
        step2: 'Link your Google Cloud project (teambuilder-plus-fe74d)',
        step3: 'Under "Service accounts", find ga4-data-reader@teambuilder-plus-fe74d.iam.gserviceaccount.com',
        step4: 'Click "Grant access" and set appropriate permissions',
        note: 'This is different from adding the service account as a User in Play Console'
      };
    } else if (error.code === 403 || error.message?.includes('403')) {
      message = 'Permission denied. Service account lacks required Play Console API permissions.';
    } else if (error.code === 404 || error.message?.includes('404')) {
      message = 'App not found. Verify package name is correct.';
    } else if (error.message) {
      message = error.message;
    }

    return {
      available: false,
      error: true,
      message: message,
      setupInstructions: setupInstructions
    };
  }
}

// ==============================
// Main Unified Analytics Endpoint
// ==============================

/**
 * Unified TBP Analytics Dashboard endpoint
 * Combines GA4, iOS App Store, and Google Play data
 */
const getTBPAnalytics = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 180,
  memory: '1GiB',
  secrets: [ascKeyId, ascIssuerId, ascPrivateKey, openaiApiKey]
}, async (req, res) => {
  try {
    // Password authentication
    const { password, dateRange } = req.query;
    const MONITORING_PASSWORD = process.env.MONITORING_PASSWORD || 'TeamBuildPro2024!';

    if (!password || password !== MONITORING_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Fetching TBP Analytics Dashboard data...');

    // Determine date ranges
    const ga4DateRange = dateRange === '7days' ? '7daysAgo' : '30daysAgo';

    // Fetch all data sources in parallel
    const [ga4Data30, ga4Data7, iosData, androidData] = await Promise.all([
      fetchGA4Analytics('30daysAgo'),
      fetchGA4Analytics('7daysAgo'),
      fetchAppStoreMetrics(
        ascKeyId.value(),
        ascIssuerId.value(),
        ascPrivateKey.value(),
        openaiApiKey.value()
      ),
      fetchGooglePlayMetrics()
    ]);

    const response = {
      generatedAt: new Date().toISOString(),
      website: {
        thirtyDay: ga4Data30,
        sevenDay: ga4Data7
      },
      ios: iosData,
      android: androidData
    };

    logger.info('TBP Analytics Dashboard data fetched successfully');
    res.json(response);

  } catch (error) {
    logger.error('Error in getTBPAnalytics:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics data',
      details: error.message
    });
  }
});

// ==============================
// Exports
// ==============================

module.exports = {
  getTBPAnalytics
};
