// ==============================
// TBP ANALYTICS DASHBOARD FUNCTIONS
// Unified analytics endpoint combining GA4, iOS App Store, and Google Play data
// ==============================

const {
  onRequest,
  logger,
  db,
} = require('./shared/utilities');

const { defineSecret } = require('firebase-functions/params');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { Storage } = require('@google-cloud/storage');

// App Store Connect API secrets
const ascKeyId = defineSecret('ASC_KEY_ID');
const ascIssuerId = defineSecret('ASC_ISSUER_ID');
const ascPrivateKey = defineSecret('ASC_PRIVATE_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const ga4ServiceAccount = defineSecret('GA4_SERVICE_ACCOUNT');
const OpenAI = require('openai');

// GA4 Configuration
const GA4_PROPERTY_ID = '485651473';

// Google Play Configuration
const PLAY_STORE_PACKAGE_NAME = 'com.scott.ultimatefix';
const PLAY_STORE_GCS_BUCKET = 'pubsite_prod_8651719546203306974';

// ==============================
// GA4 Analytics Functions
// ==============================

/**
 * Initialize GA4 client with service account credentials from secret
 */
function getGA4Client(serviceAccountJson) {
  if (!serviceAccountJson) {
    throw new Error('GA4 service account credentials not provided');
  }

  const credentials = JSON.parse(serviceAccountJson);

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    },
    projectId: credentials.project_id
  });
}

/**
 * Fetch GA4 website analytics data
 * @param {string} dateRange - Date range for the report
 * @param {string} serviceAccountJson - GA4 service account credentials JSON
 */
async function fetchGA4Analytics(dateRange = '30daysAgo', serviceAccountJson = null) {
  const client = getGA4Client(serviceAccountJson);
  const propertyId = GA4_PROPERTY_ID;

  let startDate, endDate;
  if (dateRange === 'today') {
    startDate = 'today';
    endDate = 'today';
  } else if (dateRange === 'yesterday') {
    startDate = 'yesterday';
    endDate = 'yesterday';
  } else if (dateRange === '7daysAgo') {
    startDate = '7daysAgo';
    endDate = 'today';
  } else {
    startDate = '30daysAgo';
    endDate = 'today';
  }

  try {
    // Fetch multiple reports in parallel
    const [
      overviewResponse,
      trafficSourcesResponse,
      emailCampaignResponse,
      topPagesResponse,
      deviceInfoResponse,
      eventsResponse,
      domainBreakdownResponse,
      topCountriesResponse
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
      // Email campaign (filtered by SMTP medium)
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
            fieldName: 'sessionMedium',
            stringFilter: { value: 'email', matchType: 'EXACT' }
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
      }),
      // Domain/hostname breakdown
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'hostName' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' }
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10
      }),
      // Top countries
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'country' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'engagementRate' }
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15
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
      topEvents: formatGA4Report(eventsResponse[0]),
      domainBreakdown: formatGA4Report(domainBreakdownResponse[0]),
      topCountries: formatGA4Report(topCountriesResponse[0])
    };

  } catch (error) {
    logger.error('Error fetching GA4 data:', {
      message: error.message,
      code: error.code,
      dateRange: { startDate, endDate }
    });
    return {
      error: true,
      message: error.message,
      code: error.code || 'UNKNOWN',
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
  // Trim whitespace/newlines from secret values (Firebase secrets may include trailing newlines)
  const cleanKeyId = keyId.trim();
  const cleanIssuerId = issuerId.trim();
  const cleanPrivateKey = privateKey.trim();

  let decodedKey;
  try {
    decodedKey = Buffer.from(cleanPrivateKey, 'base64').toString('utf8');
    if (!decodedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      decodedKey = cleanPrivateKey;
    }
  } catch {
    decodedKey = cleanPrivateKey;
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cleanIssuerId,
    iat: now,
    exp: now + (20 * 60),
    aud: 'appstoreconnect-v1'
  };

  return jwt.sign(payload, decodedKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: cleanKeyId, typ: 'JWT' }
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
 * @param {string} keyId - ASC Key ID
 * @param {string} issuerId - ASC Issuer ID
 * @param {string} privateKey - ASC Private Key
 * @param {string} openaiKey - OpenAI API Key for observations
 * @param {string|null} benchmarkDate - Optional benchmark date (YYYY-MM-DD format)
 */
async function fetchAppStoreMetrics(keyId, issuerId, privateKey, openaiKey, benchmarkDate = null) {
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

        // Try to fetch actual metrics (filtered by benchmark if set)
        actualMetrics = await fetchActualAppStoreMetrics(requestId, reportTypes, token, benchmarkDate);
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
 * @param {string} reportRequestId - The analytics report request ID
 * @param {Array} reportTypes - Available report types
 * @param {string} token - ASC API token
 * @param {string|null} benchmarkDate - Optional benchmark date (YYYY-MM-DD format)
 */
async function fetchActualAppStoreMetrics(reportRequestId, reportTypes, token, benchmarkDate = null) {
  const metrics = {
    downloads: { total: 0, byTerritory: {} },
    engagement: { totalImpressions: 0, totalPageViews: 0, byTerritory: {}, pageViewsByTerritory: {} },
    sessions: { totalSessions: 0, activeDevices: 0 },
    dataAvailable: false,
    message: null,
    debug: {}
  };

  if (!reportRequestId || !reportTypes || reportTypes.length === 0) {
    metrics.message = 'No analytics report request available';
    return metrics;
  }

  // Log available report types for debugging
  logger.info('Available report types:', reportTypes.map(r => r.name).join(', '));
  metrics.debug.availableReports = reportTypes.map(r => r.name);

  // Prefer Standard reports over Detailed - Standard aggregates more like App Store Connect dashboard
  const downloadsReport = reportTypes.find(r =>
    r.name === 'App Downloads Standard' || r.name === 'App Downloads Detailed'
  );
  const engagementReport = reportTypes.find(r =>
    r.name === 'App Store Discovery and Engagement Standard' || r.name === 'App Store Discovery and Engagement Detailed'
  );

  logger.info(`Found downloads report: ${downloadsReport?.name || 'NONE'}`);
  logger.info(`Found engagement report: ${engagementReport?.name || 'NONE'}`);

  async function fetchReportData(reportId, reportName) {
    try {
      const instancesResponse = await ascRequest(
        `/analyticsReports/${reportId}/instances`,
        token,
        'GET',
        null,
        { limit: 30 }
      );

      logger.info(`Report "${reportName}" has ${instancesResponse.data?.length || 0} instances`);

      if (!instancesResponse.data || instancesResponse.data.length === 0) {
        return null;
      }

      // Sort instances by date descending to get most recent data
      const sortedInstances = instancesResponse.data.sort((a, b) => {
        const dateA = a.attributes?.processingDate || '';
        const dateB = b.attributes?.processingDate || '';
        return dateB.localeCompare(dateA); // Descending order (newest first)
      });

      // Get today's date in YYYY-MM-DD format to exclude current day (incomplete data)
      const today = new Date().toISOString().split('T')[0];

      // Deduplicate by date - only keep one instance per date (the most recent one)
      // Also exclude today's date since App Store Connect doesn't show current day
      // And exclude dates before benchmark if set
      const seenDates = new Set();
      const uniqueInstances = sortedInstances.filter(instance => {
        const date = instance.attributes?.processingDate;
        if (date === today) {
          return false; // Skip today's incomplete data
        }
        // Filter by benchmark date if set
        if (benchmarkDate && date < benchmarkDate) {
          return false; // Skip data before benchmark
        }
        if (seenDates.has(date)) {
          return false;
        }
        seenDates.add(date);
        return true;
      });

      // Take 7 unique days (excluding today)
      const instancesToProcess = uniqueInstances.slice(0, 7);

      logger.info(`Found ${sortedInstances.length} total instances, ${uniqueInstances.length} unique dates`);
      logger.info(`Processing 7 days: ${instancesToProcess.map(i => i.attributes?.processingDate).join(', ')}`);

      const reportData = [];
      for (const instance of instancesToProcess) {
        try {
          logger.info(`  Processing instance ${instance.id} (date: ${instance.attributes?.processingDate})`);

          const segmentsResponse = await ascRequest(
            `/analyticsReportInstances/${instance.id}/segments`,
            token,
            'GET',
            null,
            { limit: 10 }
          );

          logger.info(`    Instance has ${segmentsResponse.data?.length || 0} segments`);

          if (segmentsResponse.data && segmentsResponse.data.length > 0) {
            for (const segment of segmentsResponse.data) {
              if (segment.attributes && segment.attributes.url) {
                // Download as arraybuffer for proper gzip handling
                const dataResponse = await axios.get(segment.attributes.url, {
                  responseType: 'arraybuffer'
                });

                // Decompress gzip data if needed
                let textData;
                const buffer = Buffer.from(dataResponse.data);

                // Check for gzip magic bytes (0x1F 0x8B)
                if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
                  const zlib = require('zlib');
                  textData = zlib.gunzipSync(buffer).toString('utf-8');
                } else {
                  textData = buffer.toString('utf-8');
                }

                const lines = textData.split('\n');
                logger.info(`    Segment data has ${lines.length} lines (decompressed)`);

                if (lines.length > 1) {
                  const headers = lines[0].split('\t');
                  logger.info(`    Headers: ${headers.slice(0, 5).join(', ')}...`);

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

      logger.info(`Report "${reportName}" returned ${reportData.length} data rows`);
      if (reportData.length > 0) {
        logger.info(`Sample row keys: ${Object.keys(reportData[0]).join(', ')}`);
      }

      return reportData;
    } catch (error) {
      logger.warn(`Could not fetch report ${reportName}: ${error.message}`);
      return null;
    }
  }

  // Fetch downloads data
  if (downloadsReport) {
    const downloadData = await fetchReportData(downloadsReport.id, downloadsReport.name);
    if (downloadData && downloadData.length > 0) {
      metrics.dataAvailable = true;

      // Log unique download types for debugging
      const downloadTypes = new Set();
      downloadData.forEach(row => {
        const dlType = row['Download Type'] || 'unknown';
        downloadTypes.add(dlType);
      });
      metrics.debug.downloadTypes = Array.from(downloadTypes);
      logger.info(`Unique Download Types: ${Array.from(downloadTypes).join(', ')}`);

      downloadData.forEach(row => {
        // Only count "First-time download" to match App Store Connect dashboard
        // (excludes Redownload, Restore, Auto-update)
        const downloadType = row['Download Type'] || '';
        if (downloadType !== 'First-time download') {
          return; // Skip non-first-time downloads
        }

        const count = parseInt(row['Counts'] || row['Total Downloads'] || row['Downloads'] || '0', 10);
        metrics.downloads.total += count;

        const territory = row['Territory'] || row['Storefront'] || 'Unknown';
        metrics.downloads.byTerritory[territory] = (metrics.downloads.byTerritory[territory] || 0) + count;
      });

      logger.info(`Downloads total: ${metrics.downloads.total}`);
    }
  }

  // Fetch engagement data
  if (engagementReport) {
    const engagementData = await fetchReportData(engagementReport.id, engagementReport.name);
    if (engagementData && engagementData.length > 0) {
      metrics.dataAvailable = true;

      // Log unique event types for debugging
      const eventTypes = new Set();
      engagementData.forEach(row => {
        const event = row['Event'] || 'unknown';
        eventTypes.add(event);
      });
      metrics.debug.eventTypes = Array.from(eventTypes);
      logger.info(`Unique Event types in engagement data: ${Array.from(eventTypes).join(', ')}`);

      engagementData.forEach(row => {
        // Apple uses "Counts" field and "Event" field to distinguish types
        const count = parseInt(row['Counts'] || row['Impressions'] || row['Product Page Views'] || '0', 10);
        const event = (row['Event'] || '').toLowerCase();
        const territory = row['Territory'] || row['Storefront'] || 'Unknown';

        // Check event type to categorize
        if (event.includes('impression') || event.includes('discovery')) {
          metrics.engagement.totalImpressions += count;
          metrics.engagement.byTerritory[territory] = (metrics.engagement.byTerritory[territory] || 0) + count;
        } else if (event.includes('page view') || event.includes('product page')) {
          metrics.engagement.totalPageViews += count;
          metrics.engagement.pageViewsByTerritory[territory] = (metrics.engagement.pageViewsByTerritory[territory] || 0) + count;
        } else {
          // Default to impressions if event type unclear
          metrics.engagement.totalImpressions += count;
        }
      });

      logger.info(`Engagement - Impressions: ${metrics.engagement.totalImpressions}, Page Views: ${metrics.engagement.totalPageViews}`);
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

/**
 * Generate AI-powered observations for GA4 website analytics
 */
async function generateGA4Observations(ga4Data, openaiKey) {
  try {
    const openai = new OpenAI({ apiKey: openaiKey });

    const overview = ga4Data.overview || {};
    const trafficSources = ga4Data.trafficSources?.data || [];
    const topPages = ga4Data.topPages?.data || [];
    const emailCampaign = ga4Data.emailCampaign?.data || [];

    // Calculate top traffic sources summary
    const topSources = trafficSources.slice(0, 5).map(s =>
      `${s.sessionSource}/${s.sessionMedium}: ${s.sessions} sessions`
    ).join(', ');

    // Calculate top pages summary
    const topPagesStr = topPages.slice(0, 5).map(p =>
      `${p.pagePath}: ${p.screenPageViews} views`
    ).join(', ');

    // Email campaign summary
    const emailSessions = emailCampaign.reduce((sum, c) => sum + (c.sessions || 0), 0);
    const emailUsers = emailCampaign.reduce((sum, c) => sum + (c.activeUsers || 0), 0);

    const context = {
      activeUsers: overview.activeUsers || 0,
      newUsers: overview.newUsers || 0,
      sessions: overview.sessions || 0,
      engagementRate: overview.engagementRate || 0,
      bounceRate: overview.bounceRate || 0,
      avgSessionDuration: overview.averageSessionDuration || 0,
      pageViews: overview.pageViews || 0,
      topSources,
      topPages: topPagesStr,
      emailSessions,
      emailUsers
    };

    const prompt = `Analyze this website analytics data for "Team Build Pro" (teambuildpro.com) and provide insights.

Current Data (Last 30 Days):
- Active Users: ${context.activeUsers}
- New Users: ${context.newUsers}
- Sessions: ${context.sessions}
- Engagement Rate: ${context.engagementRate}%
- Bounce Rate: ${context.bounceRate}%
- Avg Session Duration: ${context.avgSessionDuration} seconds
- Page Views: ${context.pageViews}

Traffic Sources: ${context.topSources || 'No data'}

Top Pages: ${context.topPages || 'No data'}

Email Campaign Performance: ${context.emailSessions} sessions, ${context.emailUsers} users from SMTP email campaigns

Context: Team Build Pro is an AI-powered downline builder app for direct sales professionals. The website serves as the main landing page and conversion funnel for app downloads.

Return a JSON object with these exact keys:
{
  "keyObservations": ["observation 1", "observation 2", "observation 3"],
  "strengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "recommendedActions": ["action 1", "action 2", "action 3"]
}

Focus on:
- Traffic quality and sources
- User engagement and behavior
- Conversion optimization opportunities
- Email campaign effectiveness
- SEO and organic growth potential

Be specific and actionable. Keep responses concise.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a website analytics and conversion optimization expert. Always respond with valid JSON only, no markdown or additional text.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
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
      logger.warn('Failed to parse GA4 AI response as JSON:', parseError);
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
    logger.error('Error generating GA4 AI analysis:', error);
    return {
      generatedAt: new Date().toISOString(),
      error: error.message,
      analysis: null
    };
  }
}

// ==============================
// Google Play Analytics Functions (via GCS Bucket)
// ==============================

/**
 * Get Google Cloud Storage client
 * Uses the GA4 service account credentials which have Play Store GCS access
 * @param {string} serviceAccountJson - Service account credentials JSON
 */
function getStorageClient(serviceAccountJson) {
  if (!serviceAccountJson) {
    // Fall back to Application Default Credentials
    return new Storage();
  }

  const credentials = JSON.parse(serviceAccountJson);
  return new Storage({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key
    },
    projectId: credentials.project_id
  });
}

/**
 * Convert UTF-16 LE buffer to UTF-8 string
 * Google Play Console exports CSV files in UTF-16 LE encoding
 */
function utf16LeToUtf8(buffer) {
  // Check for UTF-16 LE BOM (0xFF 0xFE)
  const hasUtf16LeBom = buffer[0] === 0xFF && buffer[1] === 0xFE;
  // Check for UTF-16 BE BOM (0xFE 0xFF)
  const hasUtf16BeBom = buffer[0] === 0xFE && buffer[1] === 0xFF;

  if (hasUtf16LeBom || hasUtf16BeBom) {
    // Skip the BOM and decode as UTF-16
    const encoding = hasUtf16LeBom ? 'utf16le' : 'utf16be';
    return buffer.slice(2).toString(encoding);
  }

  // Check if it looks like UTF-16 (every other byte is 0x00)
  let nullCount = 0;
  for (let i = 1; i < Math.min(buffer.length, 100); i += 2) {
    if (buffer[i] === 0x00) nullCount++;
  }

  if (nullCount > 40) {
    // Likely UTF-16 LE without BOM
    return buffer.toString('utf16le');
  }

  // Assume UTF-8
  return buffer.toString('utf8');
}

/**
 * Parse CSV content from Play Console (handles UTF-16 LE encoding)
 */
function parseCSV(buffer) {
  // Convert UTF-16 to UTF-8
  const text = utf16LeToUtf8(buffer);

  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    data.push(row);
  }

  return data;
}

/**
 * Fetch Google Play Store analytics data from GCS bucket
 * @param {string|null} benchmarkDate - Optional benchmark date (YYYY-MM-DD format)
 * @param {string|null} serviceAccountJson - Service account credentials for GCS access
 */
async function fetchGooglePlayMetrics(benchmarkDate = null, serviceAccountJson = null) {
  try {
    const storage = getStorageClient(serviceAccountJson);
    const bucket = storage.bucket(PLAY_STORE_GCS_BUCKET);

    // List files in the stats/installs directory
    const [files] = await bucket.getFiles({
      prefix: 'stats/installs/',
      maxResults: 100
    });

    logger.info(`Found ${files.length} files in GCS bucket stats/installs/`);

    if (files.length === 0) {
      return {
        available: false,
        error: true,
        message: 'No install statistics files found in GCS bucket',
        setupInstructions: {
          step1: 'Go to Play Console > Users and permissions',
          step2: 'Add ga4-data-reader@teambuilder-plus-fe74d.iam.gserviceaccount.com',
          step3: 'Set "View app information" permission to "Global"',
          note: 'Reports may take 24-48 hours to appear after granting access'
        }
      };
    }

    // Find the most recent overview or detailed installs file
    // File naming pattern: installs_<package>_<YYYYMM>_<type>.csv
    const installFiles = files
      .filter(f => f.name.includes(PLAY_STORE_PACKAGE_NAME) || f.name.includes('overview'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Most recent first

    logger.info(`Filtered to ${installFiles.length} relevant install files`);

    // Get the most recent file(s)
    const metrics = {
      activeInstalls: 0,
      totalInstalls: 0,
      totalUserInstalls: 0,
      dailyInstalls: [],
      dailyUninstalls: [],
      byCountry: {},
      dataAvailable: false,
      filesProcessed: [],
      mostRecentDate: ''
    };

    // Process all overview files to get historical data
    const overviewFiles = installFiles.filter(f => f.name.includes('_overview.csv'));
    const countryFiles = installFiles.filter(f => f.name.includes('_country.csv'));

    logger.info(`Found ${overviewFiles.length} overview files, ${countryFiles.length} country files`);

    // Process overview files for daily metrics
    for (const file of overviewFiles) {
      try {
        logger.info(`Processing file: ${file.name}`);
        const [buffer] = await file.download();
        const data = parseCSV(buffer);

        if (data.length > 0) {
          metrics.dataAvailable = true;
          metrics.filesProcessed.push(file.name);

          // Process each row
          data.forEach(row => {
            // Field names match actual Play Console CSV export
            const date = row['Date'] || '';

            // Skip data before benchmark if set
            if (benchmarkDate && date < benchmarkDate) {
              return;
            }

            const dailyInstalls = parseInt(row['Daily Device Installs'] || '0', 10);
            const dailyUninstalls = parseInt(row['Daily Device Uninstalls'] || '0', 10);
            const activeDeviceInstalls = parseInt(row['Active Device Installs'] || '0', 10);
            const totalUserInstalls = parseInt(row['Total User Installs'] || '0', 10);
            const installEvents = parseInt(row['Install events'] || '0', 10);

            if (date) {
              metrics.dailyInstalls.push({ date, installs: dailyInstalls, events: installEvents });
              metrics.dailyUninstalls.push({ date, uninstalls: dailyUninstalls });

              // Track the MOST RECENT date's active installs (not maximum)
              if (date > metrics.mostRecentDate) {
                metrics.mostRecentDate = date;
                metrics.activeInstalls = activeDeviceInstalls;
                metrics.totalUserInstalls = totalUserInstalls;
              }
            }

            // Accumulate total installs from daily events
            metrics.totalInstalls += dailyInstalls;
          });
        }
      } catch (fileError) {
        logger.warn(`Error processing file ${file.name}:`, fileError.message);
      }
    }

    // Process ALL country files for complete geographic breakdown
    for (const file of countryFiles) {
      try {
        const [buffer] = await file.download();
        const data = parseCSV(buffer);

        data.forEach(row => {
          const date = row['Date'] || '';
          // Skip data before benchmark if set
          if (benchmarkDate && date && date < benchmarkDate) {
            return;
          }

          const country = row['Country'] || '';
          const dailyInstalls = parseInt(row['Daily Device Installs'] || '0', 10);

          if (country && dailyInstalls > 0) {
            metrics.byCountry[country] = (metrics.byCountry[country] || 0) + dailyInstalls;
          }
        });
      } catch (fileError) {
        logger.warn(`Error processing country file ${file.name}:`, fileError.message);
      }
    }

    // Sort daily data by date
    metrics.dailyInstalls.sort((a, b) => a.date.localeCompare(b.date));
    metrics.dailyUninstalls.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate recent totals (last 7 days if available)
    const recentInstalls = metrics.dailyInstalls.slice(-7);
    const recentUninstalls = metrics.dailyUninstalls.slice(-7);

    const totalRecentInstalls = recentInstalls.reduce((sum, d) => sum + d.installs, 0);
    const totalRecentUninstalls = recentUninstalls.reduce((sum, d) => sum + d.uninstalls, 0);

    // Use totalUserInstalls if available, otherwise fall back to accumulated daily installs
    const displayTotalInstalls = metrics.totalUserInstalls > 0 ? metrics.totalUserInstalls : metrics.totalInstalls;

    return {
      available: true,
      appInfo: {
        packageName: PLAY_STORE_PACKAGE_NAME,
        title: 'Team Build Pro: Direct Sales'
      },
      metrics: {
        dataAvailable: metrics.dataAvailable,
        activeInstalls: metrics.activeInstalls,
        totalInstalls: displayTotalInstalls,
        totalUserInstalls: metrics.totalUserInstalls,
        cumulativeDailyInstalls: metrics.totalInstalls,
        recentInstalls: totalRecentInstalls,
        recentUninstalls: totalRecentUninstalls,
        dailyData: metrics.dailyInstalls.slice(-14), // Last 14 days
        byCountry: metrics.byCountry,
        filesProcessed: metrics.filesProcessed,
        mostRecentDate: metrics.mostRecentDate
      }
    };

  } catch (error) {
    logger.error('Error fetching Google Play metrics from GCS:', error);

    let message = 'Failed to fetch Google Play data from GCS bucket';
    let setupInstructions = null;

    if (error.code === 403 || error.message?.includes('does not have storage.objects.list')) {
      message = 'Service account lacks permission to access the Play Console GCS bucket.';
      setupInstructions = {
        step1: 'Go to Play Console > Users and permissions',
        step2: 'Add ga4-data-reader@teambuilder-plus-fe74d.iam.gserviceaccount.com as a user',
        step3: 'Set "View app information" permission to "Global"',
        step4: 'Wait 24-48 hours for reports to be accessible',
        note: 'The service account needs global read access to download reports from GCS'
      };
    } else if (error.code === 404) {
      message = 'GCS bucket not found. Verify the bucket name is correct.';
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
// Firestore Email Campaign Stats
// ==============================

/**
 * Get analytics benchmark date from Firestore config
 * Returns null if no benchmark is set (show all data)
 */
async function getBenchmarkDate() {
  try {
    const configDoc = await db.collection('config').doc('analytics').get();
    if (configDoc.exists && configDoc.data().benchmarkDate) {
      return configDoc.data().benchmarkDate; // Format: 'YYYY-MM-DD'
    }
  } catch (error) {
    logger.warn('Could not read benchmark date config:', error.message);
  }
  return null;
}

/**
 * Convert YYYY-MM-DD string to Firestore Timestamp for filtering
 */
function benchmarkToTimestamp(benchmarkDate) {
  if (!benchmarkDate) return null;
  // Parse as start of day in UTC
  const date = new Date(benchmarkDate + 'T00:00:00Z');
  return date;
}

const CONTACTS_COLLECTION = 'emailCampaigns/master/contacts';
const CONTACTS_CAMPAIGN_COLLECTION = 'direct_sales_contacts';
const PURCHASED_CAMPAIGN_COLLECTION = 'purchased_leads';
const BFH_CAMPAIGN_COLLECTION = 'bfh_contacts';

/**
 * Fetch email campaign stats from Firestore
 * Provides sent/clicked/failed counts and A/B test breakdown
 */
async function fetchFirestoreEmailStats() {
  try {
    const contactsRef = db.collection(CONTACTS_COLLECTION);

    // Run counts in parallel
    const [sentSnap, failedSnap, clickedSnap, totalSnap] = await Promise.all([
      contactsRef.where('sent', '==', true).count().get(),
      contactsRef.where('status', '==', 'failed').count().get(),
      contactsRef.where('clickedAt', '!=', null).count().get(),
      contactsRef.count().get()
    ]);

    const sent = sentSnap.data().count;
    const failed = failedSnap.data().count;
    const clicked = clickedSnap.data().count;
    const total = totalSnap.data().count;
    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) + '%' : '0%';

    // A/B test breakdown (exclude legacy tags)
    const EXCLUDED_TAGS = new Set(['subject_recruiting_app', 'unknown']);
    const sentDocs = await contactsRef
      .where('sent', '==', true)
      .select('subjectTag', 'clickedAt')
      .get();

    const subjectStats = {};
    sentDocs.docs.forEach(doc => {
      const data = doc.data();
      const tag = data.subjectTag || 'unknown';
      if (EXCLUDED_TAGS.has(tag)) return;
      if (!subjectStats[tag]) subjectStats[tag] = { sent: 0, clicked: 0 };
      subjectStats[tag].sent++;
      if (data.clickedAt) subjectStats[tag].clicked++;
    });

    const subjectLines = Object.entries(subjectStats).map(([tag, stats]) => ({
      subjectTag: tag,
      sent: stats.sent,
      clicked: stats.clicked,
      clickRate: stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) + '%' : '0%'
    }));

    return {
      total,
      sent,
      remaining: total - sent,
      failed,
      clicked,
      clickRate,
      subjectLines
    };
  } catch (error) {
    logger.error('Error fetching Firestore email stats:', error.message);
    return null;
  }
}

// ==============================
// Multi-Campaign Email Stats Aggregation
// ==============================

/**
 * Fetch stats for a single email campaign collection
 * @param {string} collectionPath - Firestore collection path
 * @param {string} campaignName - Display name for the campaign
 * @param {Date|null} benchmarkTimestamp - Optional benchmark date to filter from
 */
async function fetchSingleCampaignStats(collectionPath, campaignName, benchmarkTimestamp = null) {
  try {
    const contactsRef = db.collection(collectionPath);

    let sent = 0, failed = 0, clicked = 0, total = 0, remaining = 0;

    if (benchmarkTimestamp) {
      // Filter by benchmark date - need to query differently
      // For sent: sentTimestamp >= benchmark
      // For clicked: clickedAt >= benchmark
      const sentDocs = await contactsRef
        .where('sent', '==', true)
        .where('sentTimestamp', '>=', benchmarkTimestamp)
        .select('subjectTag', 'clickedAt', 'status')
        .get();

      sent = sentDocs.size;
      sentDocs.forEach(doc => {
        const data = doc.data();
        if (data.clickedAt && data.clickedAt.toDate() >= benchmarkTimestamp) {
          clicked++;
        }
        if (data.status === 'failed') failed++;
      });

      // Get actual remaining count (unsent emails) - NOT total minus benchmark sent
      const [totalSnap, remainingSnap] = await Promise.all([
        contactsRef.count().get(),
        contactsRef.where('sent', '==', false).count().get()
      ]);
      total = totalSnap.data().count;
      remaining = remainingSnap.data().count;
    } else {
      // No benchmark - use original fast count queries
      const [sentSnap, failedSnap, clickedSnap, totalSnap, remainingSnap] = await Promise.all([
        contactsRef.where('sent', '==', true).count().get(),
        contactsRef.where('status', '==', 'failed').count().get(),
        contactsRef.where('clickedAt', '!=', null).count().get(),
        contactsRef.count().get(),
        contactsRef.where('sent', '==', false).count().get()
      ]);

      sent = sentSnap.data().count;
      failed = failedSnap.data().count;
      clicked = clickedSnap.data().count;
      total = totalSnap.data().count;
      remaining = remainingSnap.data().count;
    }

    const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(2) : '0.00';

    // A/B test breakdown (also filtered by benchmark if set)
    const EXCLUDED_TAGS = new Set(['subject_recruiting_app', 'unknown']);
    let sentDocsQuery = contactsRef.where('sent', '==', true);
    if (benchmarkTimestamp) {
      sentDocsQuery = sentDocsQuery.where('sentTimestamp', '>=', benchmarkTimestamp);
    }
    const sentDocs = await sentDocsQuery.select('subjectTag', 'clickedAt').get();

    const subjectStats = {};
    sentDocs.docs.forEach(doc => {
      const data = doc.data();
      const tag = data.subjectTag || 'unknown';
      if (EXCLUDED_TAGS.has(tag)) return;
      if (!subjectStats[tag]) subjectStats[tag] = { sent: 0, clicked: 0 };
      subjectStats[tag].sent++;
      // For benchmark mode, only count clicks after benchmark
      if (data.clickedAt) {
        if (benchmarkTimestamp) {
          const clickTime = data.clickedAt.toDate ? data.clickedAt.toDate() : new Date(data.clickedAt);
          if (clickTime >= benchmarkTimestamp) {
            subjectStats[tag].clicked++;
          }
        } else {
          subjectStats[tag].clicked++;
        }
      }
    });

    const subjectLines = Object.entries(subjectStats).map(([tag, stats]) => ({
      subjectTag: tag,
      sent: stats.sent,
      clicked: stats.clicked,
      clickRate: stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(2) : '0.00'
    }));

    // Find best performing variant
    let bestVariant = null;
    if (subjectLines.length > 0) {
      bestVariant = subjectLines.reduce((best, current) => {
        return parseFloat(current.clickRate) > parseFloat(best.clickRate) ? current : best;
      }, subjectLines[0]);
    }

    return {
      campaign: campaignName,
      collection: collectionPath,
      total,
      sent,
      remaining,
      failed,
      clicked,
      clickRate: clickRate + '%',
      clickRateNum: parseFloat(clickRate),
      subjectLines,
      bestVariant
    };
  } catch (error) {
    logger.error(`Error fetching ${campaignName} stats:`, error.message);
    return {
      campaign: campaignName,
      collection: collectionPath,
      error: error.message,
      total: 0,
      sent: 0,
      remaining: 0,
      failed: 0,
      clicked: 0,
      clickRate: '0.00%',
      clickRateNum: 0,
      subjectLines: [],
      bestVariant: null
    };
  }
}

/**
 * Fetch all email campaign stats across all 4 campaigns
 * @param {Date|null} benchmarkTimestamp - Optional benchmark date to filter from
 */
async function fetchAllEmailCampaignStats(benchmarkTimestamp = null) {
  try {
    const [mainStats, contactsStats, purchasedStats, bfhStats] = await Promise.all([
      fetchSingleCampaignStats(CONTACTS_COLLECTION, 'Main', benchmarkTimestamp),
      fetchSingleCampaignStats(CONTACTS_CAMPAIGN_COLLECTION, 'Contacts', benchmarkTimestamp),
      fetchSingleCampaignStats(PURCHASED_CAMPAIGN_COLLECTION, 'Purchased', benchmarkTimestamp),
      fetchSingleCampaignStats(BFH_CAMPAIGN_COLLECTION, 'BFH', benchmarkTimestamp)
    ]);

    // Calculate totals across all campaigns
    const campaigns = [mainStats, contactsStats, purchasedStats, bfhStats];
    const totals = {
      totalSent: campaigns.reduce((sum, c) => sum + c.sent, 0),
      totalClicked: campaigns.reduce((sum, c) => sum + c.clicked, 0),
      totalRemaining: campaigns.reduce((sum, c) => sum + c.remaining, 0),
      totalFailed: campaigns.reduce((sum, c) => sum + c.failed, 0)
    };
    totals.overallClickRate = totals.totalSent > 0
      ? ((totals.totalClicked / totals.totalSent) * 100).toFixed(2) + '%'
      : '0.00%';

    // Find best performing campaign
    const bestCampaign = campaigns.reduce((best, current) => {
      return current.clickRateNum > best.clickRateNum ? current : best;
    }, campaigns[0]);

    // Find best overall variant across all campaigns
    let bestOverallVariant = null;
    campaigns.forEach(c => {
      if (c.bestVariant) {
        if (!bestOverallVariant || parseFloat(c.bestVariant.clickRate) > parseFloat(bestOverallVariant.clickRate)) {
          bestOverallVariant = { ...c.bestVariant, campaign: c.campaign };
        }
      }
    });

    return {
      campaigns: {
        main: mainStats,
        contacts: contactsStats,
        purchased: purchasedStats,
        bfh: bfhStats
      },
      totals,
      bestCampaign: {
        name: bestCampaign.campaign,
        clickRate: bestCampaign.clickRate
      },
      bestOverallVariant
    };
  } catch (error) {
    logger.error('Error fetching all campaign stats:', error.message);
    return null;
  }
}

/**
 * Fetch purchased leads ROI data by source
 */
async function fetchPurchasedLeadsROI() {
  try {
    // Get source stats from purchased_leads_stats collection
    const statsSnapshot = await db.collection('purchased_leads_stats').get();
    const sourceStats = {};

    statsSnapshot.forEach(doc => {
      const data = doc.data();
      sourceStats[doc.id] = {
        source: doc.id,
        totalLeads: data.totalLeads || 0,
        totalCost: data.totalCost || 0,
        totalSent: data.totalSent || 0,
        totalClicked: data.totalClicked || 0,
        totalBounced: data.totalBounced || 0,
        clickRate: data.totalSent > 0
          ? ((data.totalClicked / data.totalSent) * 100).toFixed(2) + '%'
          : '0.00%',
        costPerClick: data.totalClicked > 0 && data.totalCost > 0
          ? '$' + (data.totalCost / data.totalClicked).toFixed(2)
          : 'N/A'
      };
    });

    // Get live counts from purchased_leads collection for real-time data
    const purchasedRef = db.collection(PURCHASED_CAMPAIGN_COLLECTION);
    const leadsSnapshot = await purchasedRef.get();

    const liveBySource = {};
    leadsSnapshot.forEach(doc => {
      const lead = doc.data();
      const source = lead.source || 'unknown';
      if (!liveBySource[source]) {
        liveBySource[source] = { total: 0, sent: 0, clicked: 0 };
      }
      liveBySource[source].total++;
      if (lead.sent) liveBySource[source].sent++;
      if (lead.clickedAt) liveBySource[source].clicked++;
    });

    // Merge live data with stats
    Object.keys(liveBySource).forEach(source => {
      if (!sourceStats[source]) {
        sourceStats[source] = {
          source,
          totalLeads: 0,
          totalCost: 0,
          totalSent: 0,
          totalClicked: 0
        };
      }
      sourceStats[source].liveTotal = liveBySource[source].total;
      sourceStats[source].liveSent = liveBySource[source].sent;
      sourceStats[source].liveClicked = liveBySource[source].clicked;
      sourceStats[source].liveClickRate = liveBySource[source].sent > 0
        ? ((liveBySource[source].clicked / liveBySource[source].sent) * 100).toFixed(2) + '%'
        : '0.00%';
    });

    // Find best ROI source
    let bestSource = null;
    Object.values(sourceStats).forEach(s => {
      const clickRate = parseFloat(s.liveClickRate || s.clickRate || '0');
      if (!bestSource || clickRate > parseFloat(bestSource.liveClickRate || bestSource.clickRate || '0')) {
        bestSource = s;
      }
    });

    return {
      bySource: sourceStats,
      bestSource: bestSource ? bestSource.source : null,
      totalSources: Object.keys(sourceStats).length
    };
  } catch (error) {
    logger.error('Error fetching purchased leads ROI:', error.message);
    return null;
  }
}

/**
 * Build executive summary aggregating all data sources
 */
function buildExecutiveSummary(ga4Data, iosData, androidData, emailStats) {
  const overview = ga4Data?.overview || {};
  const iosMetrics = iosData?.actualMetrics || {};
  const androidMetrics = androidData?.metrics || {};

  // Calculate email metrics
  const emailTotals = emailStats?.totals || {};

  // Calculate iOS conversion rate (downloads / impressions)
  const iosDownloads = iosMetrics.downloads?.total || 0;
  const iosImpressions = iosMetrics.engagement?.totalImpressions || 0;
  const iosConversion = iosImpressions > 0
    ? ((iosDownloads / iosImpressions) * 100).toFixed(1) + '%'
    : 'N/A';

  // Calculate performance score (0-100)
  // Based on: email click rate, website engagement, iOS conversion, Android growth
  let score = 50; // Base score

  const emailClickRate = parseFloat(emailTotals.overallClickRate || '0');
  if (emailClickRate >= 4) score += 15;
  else if (emailClickRate >= 3) score += 10;
  else if (emailClickRate >= 2) score += 5;

  const engagementRate = overview.engagementRate || 0;
  if (engagementRate >= 50) score += 15;
  else if (engagementRate >= 30) score += 10;
  else if (engagementRate >= 20) score += 5;

  const iosConvNum = parseFloat(iosConversion) || 0;
  if (iosConvNum >= 5) score += 15;
  else if (iosConvNum >= 3) score += 10;
  else if (iosConvNum >= 2) score += 5;

  const recentAndroidInstalls = androidMetrics.recentInstalls || 0;
  if (recentAndroidInstalls >= 50) score += 5;
  else if (recentAndroidInstalls >= 20) score += 3;

  score = Math.min(100, Math.max(0, score));

  return {
    performanceScore: score,
    email: {
      totalSent: emailTotals.totalSent || 0,
      totalClicked: emailTotals.totalClicked || 0,
      overallClickRate: emailTotals.overallClickRate || '0.00%',
      bestCampaign: emailStats?.bestCampaign || null,
      bestVariant: emailStats?.bestOverallVariant || null
    },
    website: {
      users: overview.activeUsers || 0,
      sessions: overview.sessions || 0,
      engagementRate: overview.engagementRate || 0,
      pageViews: overview.pageViews || 0
    },
    ios: {
      downloads: iosDownloads,
      impressions: iosImpressions,
      conversion: iosConversion,
      rating: iosData?.reviews?.averageRating || 'N/A'
    },
    android: {
      activeInstalls: androidMetrics.activeInstalls || 0,
      recentInstalls: androidMetrics.recentInstalls || 0,
      totalInstalls: androidMetrics.totalInstalls || 0
    }
  };
}

/**
 * Build conversion funnel visualization data
 */
function buildConversionFunnel(emailStats, ga4Data, iosData, androidData) {
  const emailSent = emailStats?.totals?.totalSent || 0;

  // Website visits from email (smtp medium)
  const emailCampaignData = ga4Data?.emailCampaign?.data || [];
  const websiteFromEmail = emailCampaignData.reduce((sum, c) => sum + (c.activeUsers || 0), 0);

  // App Store page views
  const iosPageViews = iosData?.actualMetrics?.engagement?.totalPageViews || 0;

  // Downloads (iOS + Android combined)
  const iosDownloads = iosData?.actualMetrics?.downloads?.total || 0;
  const androidDownloads = androidData?.metrics?.recentInstalls || 0;
  const totalDownloads = iosDownloads + androidDownloads;

  // Calculate conversion rates between stages
  const emailToWebsite = emailSent > 0 ? ((websiteFromEmail / emailSent) * 100).toFixed(1) : '0.0';
  const websiteToAppStore = websiteFromEmail > 0 ? ((iosPageViews / websiteFromEmail) * 100).toFixed(1) : '0.0';
  const appStoreToDownload = iosPageViews > 0 ? ((totalDownloads / iosPageViews) * 100).toFixed(1) : '0.0';

  // Target benchmarks
  const targets = {
    emailToWebsite: 15, // 15% target
    websiteToAppStore: 20, // 20% target
    appStoreToDownload: 40 // 40% target
  };

  return {
    stages: [
      {
        name: 'Email Sent',
        count: emailSent,
        percentage: '100%',
        status: 'neutral'
      },
      {
        name: 'Website Visit',
        count: websiteFromEmail,
        percentage: emailToWebsite + '%',
        target: targets.emailToWebsite + '%',
        status: parseFloat(emailToWebsite) >= targets.emailToWebsite ? 'good' : 'warning'
      },
      {
        name: 'App Store View',
        count: iosPageViews,
        percentage: websiteToAppStore + '%',
        target: targets.websiteToAppStore + '%',
        status: parseFloat(websiteToAppStore) >= targets.websiteToAppStore ? 'good' : 'warning'
      },
      {
        name: 'Download',
        count: totalDownloads,
        percentage: appStoreToDownload + '%',
        target: targets.appStoreToDownload + '%',
        status: parseFloat(appStoreToDownload) >= targets.appStoreToDownload ? 'good' : 'warning'
      }
    ],
    rates: {
      emailToWebsite: parseFloat(emailToWebsite),
      websiteToAppStore: parseFloat(websiteToAppStore),
      appStoreToDownload: parseFloat(appStoreToDownload)
    },
    targets
  };
}

/**
 * Generate strategic AI insights combining all data sources
 */
async function generateStrategicInsights(data, openaiKey) {
  try {
    const openai = new OpenAI({ apiKey: openaiKey });

    const exec = data.executiveSummary || {};
    const funnel = data.conversionFunnel || {};
    const campaigns = data.allCampaignStats?.campaigns || {};
    const roi = data.purchasedLeadsROI || {};

    // Build comprehensive context
    const context = `
TEAM BUILD PRO - STRATEGIC ANALYTICS SUMMARY

=== EXECUTIVE SUMMARY ===
Performance Score: ${exec.performanceScore}/100

Email Campaigns (All 4):
- Total Sent: ${exec.email?.totalSent || 0}
- Total Clicked: ${exec.email?.totalClicked || 0}
- Overall Click Rate: ${exec.email?.overallClickRate || '0%'}
- Best Campaign: ${exec.email?.bestCampaign?.name || 'N/A'} (${exec.email?.bestCampaign?.clickRate || 'N/A'})
- Best Variant: ${exec.email?.bestVariant?.subjectTag || 'N/A'} (${exec.email?.bestVariant?.clickRate || 'N/A'}%)

Website (7-day):
- Users: ${exec.website?.users || 0}
- Sessions: ${exec.website?.sessions || 0}
- Engagement Rate: ${exec.website?.engagementRate || 0}%
- Page Views: ${exec.website?.pageViews || 0}

iOS App Store (7-day):
- Downloads: ${exec.ios?.downloads || 0}
- Impressions: ${exec.ios?.impressions || 0}
- Store Conversion: ${exec.ios?.conversion || 'N/A'}
- Rating: ${exec.ios?.rating || 'N/A'}/5

Android (7-day):
- Active Installs: ${exec.android?.activeInstalls || 0}
- Recent Installs: ${exec.android?.recentInstalls || 0}

=== CONVERSION FUNNEL ===
Email Sent → Website: ${funnel.rates?.emailToWebsite || 0}% (target: ${funnel.targets?.emailToWebsite || 15}%)
Website → App Store: ${funnel.rates?.websiteToAppStore || 0}% (target: ${funnel.targets?.websiteToAppStore || 20}%)
App Store → Download: ${funnel.rates?.appStoreToDownload || 0}% (target: ${funnel.targets?.appStoreToDownload || 40}%)

=== CAMPAIGN BREAKDOWN ===
Main Campaign: ${campaigns.main?.clickRate || 'N/A'} click rate, ${campaigns.main?.sent || 0} sent
Contacts Campaign: ${campaigns.contacts?.clickRate || 'N/A'} click rate, ${campaigns.contacts?.sent || 0} sent
Purchased Leads: ${campaigns.purchased?.clickRate || 'N/A'} click rate, ${campaigns.purchased?.sent || 0} sent
BFH Campaign: ${campaigns.bfh?.clickRate || 'N/A'} click rate, ${campaigns.bfh?.sent || 0} sent

=== PURCHASED LEADS ROI (by source) ===
${Object.entries(roi.bySource || {}).map(([source, data]) =>
  `${source}: ${data.liveClickRate || data.clickRate || 'N/A'} click rate, Cost/Click: ${data.costPerClick || 'N/A'}`
).join('\n')}
Best Source: ${roi.bestSource || 'N/A'}
`;

    const prompt = `${context}

Based on this comprehensive Team Build Pro analytics data, provide strategic insights. Team Build Pro is an AI-powered downline builder app for direct sales professionals. The goal is to maximize app downloads and subscriptions.

Return a JSON object with these exact keys:
{
  "whatsWorking": [
    {"insight": "specific thing working well", "metric": "supporting metric", "impact": "high/medium/low"}
  ],
  "needsAttention": [
    {"issue": "specific issue", "metric": "supporting metric", "severity": "high/medium/low"}
  ],
  "recommendedActions": [
    {"priority": "HIGH/MEDIUM/LOW", "action": "specific actionable recommendation", "expectedImpact": "what improvement to expect"}
  ]
}

Provide 2-4 items in each category. Be specific with metrics. Focus on:
1. A/B test winners that should be scaled
2. Underperforming campaigns/variants to fix
3. Conversion funnel bottlenecks
4. Lead source ROI optimization
5. Cross-channel insights

Keep insights actionable and data-driven.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a strategic marketing analytics expert specializing in app growth and conversion optimization. Always respond with valid JSON only.'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;

    try {
      const analysis = JSON.parse(content);
      return {
        generatedAt: new Date().toISOString(),
        insights: analysis,
        dataContext: {
          performanceScore: exec.performanceScore,
          totalEmailsSent: exec.email?.totalSent,
          overallClickRate: exec.email?.overallClickRate,
          iosDownloads: exec.ios?.downloads,
          funnelHealth: funnel.rates
        }
      };
    } catch (parseError) {
      logger.warn('Failed to parse strategic insights JSON:', parseError);
      return {
        generatedAt: new Date().toISOString(),
        insights: {
          whatsWorking: [{ insight: 'AI analysis temporarily unavailable', metric: '-', impact: 'low' }],
          needsAttention: [],
          recommendedActions: []
        }
      };
    }

  } catch (error) {
    logger.error('Error generating strategic insights:', error);
    return {
      generatedAt: new Date().toISOString(),
      error: error.message,
      insights: null
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
  secrets: [ascKeyId, ascIssuerId, ascPrivateKey, openaiApiKey, ga4ServiceAccount]
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
    const _ga4DateRange = dateRange === '7days' ? '7daysAgo' : '30daysAgo';

    // Get benchmark date from config
    const benchmarkDate = await getBenchmarkDate();
    const benchmarkTimestamp = benchmarkToTimestamp(benchmarkDate);
    logger.info(`Benchmark date: ${benchmarkDate || 'None (showing all data)'}`);

    // Get GA4 service account credentials
    const ga4Credentials = ga4ServiceAccount.value();
    if (!ga4Credentials) {
      logger.warn('GA4 service account credentials not available');
    }

    // Fetch GA4 data sequentially to avoid rate limiting (8 concurrent requests per call)
    // while fetching other data sources in parallel
    const [iosData, androidData, allCampaignStats, purchasedROI] = await Promise.all([
      fetchAppStoreMetrics(
        ascKeyId.value(),
        ascIssuerId.value(),
        ascPrivateKey.value(),
        openaiApiKey.value(),
        benchmarkDate  // Pass benchmark date
      ),
      fetchGooglePlayMetrics(benchmarkDate, ga4Credentials),  // Pass benchmark date and credentials
      fetchAllEmailCampaignStats(benchmarkTimestamp),  // Pass benchmark timestamp
      fetchPurchasedLeadsROI()
    ]);

    // Fetch GA4 data sequentially to stay within concurrent request quota
    const ga4Data30 = await fetchGA4Analytics('30daysAgo', ga4Credentials);
    const ga4Data7 = await fetchGA4Analytics('7daysAgo', ga4Credentials);
    const ga4DataYesterday = await fetchGA4Analytics('yesterday', ga4Credentials);
    const ga4DataToday = await fetchGA4Analytics('today', ga4Credentials);

    // Build executive summary and conversion funnel using 7-day data
    const executiveSummary = buildExecutiveSummary(ga4Data7, iosData, androidData, allCampaignStats);
    const conversionFunnel = buildConversionFunnel(allCampaignStats, ga4Data7, iosData, androidData);

    // Generate AI observations for GA4 data (use 30-day data for more comprehensive analysis)
    let ga4Observations = null;
    try {
      ga4Observations = await generateGA4Observations(ga4Data30, openaiApiKey.value());
      logger.info('GA4 AI observations generated successfully');
    } catch (obsError) {
      logger.warn('Failed to generate GA4 observations:', obsError.message);
    }

    // Generate strategic insights combining all data
    let strategicInsights = null;
    try {
      strategicInsights = await generateStrategicInsights({
        executiveSummary,
        conversionFunnel,
        allCampaignStats,
        purchasedLeadsROI: purchasedROI
      }, openaiApiKey.value());
      logger.info('Strategic AI insights generated successfully');
    } catch (insightsError) {
      logger.warn('Failed to generate strategic insights:', insightsError.message);
    }

    const response = {
      generatedAt: new Date().toISOString(),
      // Benchmark date for filtering (null = show all data)
      benchmarkDate: benchmarkDate,
      benchmarkActive: !!benchmarkDate,
      // NEW: Executive summary at top level
      executiveSummary,
      // NEW: Conversion funnel visualization data
      conversionFunnel,
      // NEW: Strategic AI insights
      strategicInsights,
      website: {
        thirtyDay: ga4Data30,
        sevenDay: ga4Data7,
        yesterday: ga4DataYesterday,
        today: ga4DataToday,
        observations: ga4Observations
      },
      ios: iosData,
      android: androidData,
      // Enhanced: All campaign stats (replacing single emailCampaign)
      emailCampaigns: allCampaignStats,
      // NEW: Purchased leads ROI by source
      purchasedLeadsROI: purchasedROI,
      // Legacy: Keep single campaign for backward compatibility
      emailCampaign: allCampaignStats?.campaigns?.main || null
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
