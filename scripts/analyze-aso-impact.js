#!/usr/bin/env node
/**
 * ASO Impact Analysis Script
 *
 * Analyzes App Store Connect metrics before/after the Feb 16, 2026 description optimization.
 * Compares impressions and downloads by territory, mapped to language versions.
 *
 * Usage:
 *   node scripts/analyze-aso-impact.js
 *   node scripts/analyze-aso-impact.js --days=14  # Custom analysis window
 *   node scripts/analyze-aso-impact.js --json     # Output as JSON
 *
 * Requires:
 *   - ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY environment variables
 *   - Or secrets in /Users/sscott/tbp/secrets/asc-credentials.json
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments
const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith('--days='));
const jsonOutput = args.includes('--json');
const ANALYSIS_DAYS = daysArg ? parseInt(daysArg.split('=')[1]) : 14;

// ASO Change date
const ASO_CHANGE_DATE = '2026-02-16';

// App Store Connect config
const ASC_APP_ID = '6751211622';
const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

// Territory to Language mapping
const TERRITORY_LANGUAGE_MAP = {
  // English (EN)
  'USA': 'EN', 'GBR': 'EN', 'CAN': 'EN', 'AUS': 'EN', 'NZL': 'EN', 'IRL': 'EN',
  'ZAF': 'EN', 'SGP': 'EN', 'HKG': 'EN', 'PHL': 'EN', 'MYS': 'EN', 'IND': 'EN',

  // Spanish (ES)
  'ESP': 'ES', 'MEX': 'ES', 'ARG': 'ES', 'COL': 'ES', 'CHL': 'ES', 'PER': 'ES',
  'VEN': 'ES', 'ECU': 'ES', 'GTM': 'ES', 'CUB': 'ES', 'DOM': 'ES', 'HND': 'ES',
  'PRY': 'ES', 'SLV': 'ES', 'NIC': 'ES', 'CRI': 'ES', 'PAN': 'ES', 'URY': 'ES',
  'BOL': 'ES', 'PRI': 'ES',

  // Portuguese (PT)
  'BRA': 'PT', 'PRT': 'PT', 'AGO': 'PT', 'MOZ': 'PT',

  // German (DE)
  'DEU': 'DE', 'AUT': 'DE', 'CHE': 'DE', 'LIE': 'DE', 'LUX': 'DE'
};

// Get language for a territory (default to EN for unknown)
function getLanguageForTerritory(territory) {
  // Handle both 3-letter codes and full country names
  const code = territory.toUpperCase().substring(0, 3);
  return TERRITORY_LANGUAGE_MAP[code] || 'EN';
}

// Load ASC credentials
function loadCredentials() {
  // Try environment variables first
  if (process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID && process.env.ASC_PRIVATE_KEY) {
    return {
      keyId: process.env.ASC_KEY_ID,
      issuerId: process.env.ASC_ISSUER_ID,
      privateKey: process.env.ASC_PRIVATE_KEY
    };
  }

  // Try secrets file
  const secretsPath = path.join(__dirname, '..', 'secrets', 'asc-credentials.json');
  if (fs.existsSync(secretsPath)) {
    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    return {
      keyId: secrets.keyId,
      issuerId: secrets.issuerId,
      privateKey: secrets.privateKey
    };
  }

  // Try Firebase functions .env file
  const envPath = path.join(__dirname, '..', 'functions', '.env.teambuilder-plus-fe74d');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const keyIdMatch = envContent.match(/ASC_KEY_ID=["']?([^"'\n]+)/);
    const issuerIdMatch = envContent.match(/ASC_ISSUER_ID=["']?([^"'\n]+)/);
    const privateKeyMatch = envContent.match(/ASC_PRIVATE_KEY=["']?([^"'\n]+)/);

    if (keyIdMatch && issuerIdMatch && privateKeyMatch) {
      return {
        keyId: keyIdMatch[1],
        issuerId: issuerIdMatch[1],
        privateKey: privateKeyMatch[1]
      };
    }
  }

  throw new Error('ASC credentials not found. Set ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY env vars or create secrets/asc-credentials.json');
}

// Generate JWT token for App Store Connect API
function generateASCToken(keyId, issuerId, privateKey) {
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

// Make authenticated request to App Store Connect API
async function ascRequest(endpoint, token, params = {}) {
  const url = `${ASC_BASE_URL}${endpoint}`;

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

// Fetch report data for a specific date range
async function fetchReportData(reportId, token, startDate, endDate) {
  const data = [];

  try {
    const instancesResponse = await ascRequest(
      `/analyticsReports/${reportId}/instances`,
      token,
      { limit: 50 }
    );

    if (!instancesResponse.data || instancesResponse.data.length === 0) {
      return data;
    }

    // Filter instances by date range
    const instances = instancesResponse.data.filter(instance => {
      const date = instance.attributes?.processingDate;
      return date && date >= startDate && date <= endDate;
    });

    for (const instance of instances) {
      try {
        const segmentsResponse = await ascRequest(
          `/analyticsReportInstances/${instance.id}/segments`,
          token,
          { limit: 10 }
        );

        if (segmentsResponse.data && segmentsResponse.data.length > 0) {
          for (const segment of segmentsResponse.data) {
            if (segment.attributes && segment.attributes.url) {
              const dataResponse = await axios.get(segment.attributes.url, {
                responseType: 'arraybuffer'
              });

              let textData;
              const buffer = Buffer.from(dataResponse.data);

              if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
                textData = zlib.gunzipSync(buffer).toString('utf-8');
              } else {
                textData = buffer.toString('utf-8');
              }

              const lines = textData.split('\n');
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
                    data.push(row);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // Skip failed instances
      }
    }
  } catch (err) {
    console.error(`Error fetching report data: ${err.message}`);
  }

  return data;
}

// Aggregate metrics by language
function aggregateByLanguage(data, isEngagement = false) {
  const metrics = {
    EN: { impressions: 0, pageViews: 0, downloads: 0, territories: new Set() },
    ES: { impressions: 0, pageViews: 0, downloads: 0, territories: new Set() },
    PT: { impressions: 0, pageViews: 0, downloads: 0, territories: new Set() },
    DE: { impressions: 0, pageViews: 0, downloads: 0, territories: new Set() }
  };

  data.forEach(row => {
    const territory = row['Territory'] || row['Storefront'] || 'Unknown';
    const lang = getLanguageForTerritory(territory);
    const count = parseInt(row['Counts'] || row['Downloads'] || '0', 10);

    metrics[lang].territories.add(territory);

    if (isEngagement) {
      const event = (row['Event'] || '').toLowerCase();
      if (event.includes('impression') || event.includes('discovery')) {
        metrics[lang].impressions += count;
      } else if (event.includes('page view') || event.includes('product page')) {
        metrics[lang].pageViews += count;
      }
    } else {
      // Downloads - only count first-time downloads
      const downloadType = row['Download Type'] || '';
      if (downloadType === 'First-time download') {
        metrics[lang].downloads += count;
      }
    }
  });

  // Convert Sets to counts
  Object.keys(metrics).forEach(lang => {
    metrics[lang].territoryCount = metrics[lang].territories.size;
    delete metrics[lang].territories;
  });

  return metrics;
}

// Calculate percentage change
function calcChange(before, after) {
  if (before === 0) return after > 0 ? '+∞%' : '0%';
  const change = ((after - before) / before) * 100;
  return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
}

// Main analysis function
async function runAnalysis() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  App Store Optimization Impact Analysis');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  ASO Change Date: ${ASO_CHANGE_DATE}`);
  console.log(`  Analysis Window: ${ANALYSIS_DAYS} days before/after`);
  console.log('');

  // Load credentials
  let credentials;
  try {
    credentials = loadCredentials();
    console.log('  ✓ Credentials loaded');
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    process.exit(1);
  }

  // Generate token
  const token = generateASCToken(credentials.keyId, credentials.issuerId, credentials.privateKey);
  console.log('  ✓ ASC token generated');

  // Calculate date ranges
  const changeDate = new Date(ASO_CHANGE_DATE);
  const today = new Date();

  const beforeEnd = new Date(changeDate);
  beforeEnd.setDate(beforeEnd.getDate() - 1);
  const beforeStart = new Date(beforeEnd);
  beforeStart.setDate(beforeStart.getDate() - ANALYSIS_DAYS + 1);

  const afterStart = new Date(changeDate);
  const afterEnd = new Date(Math.min(today.getTime(), afterStart.getTime() + (ANALYSIS_DAYS - 1) * 24 * 60 * 60 * 1000));

  const formatDate = d => d.toISOString().split('T')[0];

  console.log('');
  console.log(`  Before Period: ${formatDate(beforeStart)} to ${formatDate(beforeEnd)}`);
  console.log(`  After Period:  ${formatDate(afterStart)} to ${formatDate(afterEnd)}`);

  // Check if we have enough post-change data
  const daysAfter = Math.floor((today - afterStart) / (24 * 60 * 60 * 1000));
  if (daysAfter < 10) {
    console.log('');
    console.log('  ⚠️  WARNING: App Store Connect engagement data has ~10 day lag.');
    console.log(`     Only ${daysAfter} days since ASO change. Data may be incomplete.`);
    console.log('     Re-run this analysis after Feb 26, 2026 for accurate results.');
  }

  // Fetch analytics reports
  console.log('');
  console.log('  Fetching App Store Connect analytics...');

  let reportTypes = [];
  try {
    const existingRequests = await ascRequest(`/apps/${ASC_APP_ID}/analyticsReportRequests`, token);

    if (existingRequests.data && existingRequests.data.length > 0) {
      const requestId = existingRequests.data[0].id;
      const reportsResponse = await ascRequest(
        `/analyticsReportRequests/${requestId}/reports`,
        token,
        { limit: 50 }
      );
      reportTypes = reportsResponse.data.map(r => ({
        id: r.id,
        name: r.attributes.name,
        category: r.attributes.category
      }));
      console.log(`  ✓ Found ${reportTypes.length} report types`);
    }
  } catch (err) {
    console.error(`  ✗ Could not fetch analytics reports: ${err.message}`);
    process.exit(1);
  }

  // Find relevant reports
  const downloadsReport = reportTypes.find(r =>
    r.name === 'App Downloads Standard' || r.name === 'App Downloads Detailed'
  );
  const engagementReport = reportTypes.find(r =>
    r.name === 'App Store Discovery and Engagement Standard' || r.name === 'App Store Discovery and Engagement Detailed'
  );

  if (!downloadsReport && !engagementReport) {
    console.error('  ✗ No relevant reports found');
    process.exit(1);
  }

  // Fetch data for both periods
  console.log('');
  console.log('  Fetching data for before period...');
  const beforeDownloads = downloadsReport ?
    await fetchReportData(downloadsReport.id, token, formatDate(beforeStart), formatDate(beforeEnd)) : [];
  const beforeEngagement = engagementReport ?
    await fetchReportData(engagementReport.id, token, formatDate(beforeStart), formatDate(beforeEnd)) : [];

  console.log('  Fetching data for after period...');
  const afterDownloads = downloadsReport ?
    await fetchReportData(downloadsReport.id, token, formatDate(afterStart), formatDate(afterEnd)) : [];
  const afterEngagement = engagementReport ?
    await fetchReportData(engagementReport.id, token, formatDate(afterStart), formatDate(afterEnd)) : [];

  // Aggregate by language
  console.log('');
  console.log('  Aggregating metrics by language...');

  const beforeDownloadMetrics = aggregateByLanguage(beforeDownloads, false);
  const afterDownloadMetrics = aggregateByLanguage(afterDownloads, false);
  const beforeEngagementMetrics = aggregateByLanguage(beforeEngagement, true);
  const afterEngagementMetrics = aggregateByLanguage(afterEngagement, true);

  // Output results
  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('  RESULTS BY LANGUAGE VERSION');
  console.log('───────────────────────────────────────────────────────────────────────────');

  const results = {};

  ['EN', 'ES', 'PT', 'DE'].forEach(lang => {
    const beforeImpressions = beforeEngagementMetrics[lang].impressions;
    const afterImpressions = afterEngagementMetrics[lang].impressions;
    const beforePageViews = beforeEngagementMetrics[lang].pageViews;
    const afterPageViews = afterEngagementMetrics[lang].pageViews;
    const beforeDL = beforeDownloadMetrics[lang].downloads;
    const afterDL = afterDownloadMetrics[lang].downloads;

    results[lang] = {
      impressions: { before: beforeImpressions, after: afterImpressions, change: calcChange(beforeImpressions, afterImpressions) },
      pageViews: { before: beforePageViews, after: afterPageViews, change: calcChange(beforePageViews, afterPageViews) },
      downloads: { before: beforeDL, after: afterDL, change: calcChange(beforeDL, afterDL) }
    };

    console.log('');
    console.log(`  ${lang} (${lang === 'EN' ? 'English' : lang === 'ES' ? 'Spanish' : lang === 'PT' ? 'Portuguese' : 'German'})`);
    console.log('  ' + '─'.repeat(50));
    console.log(`  Impressions:   ${beforeImpressions.toLocaleString().padStart(8)} → ${afterImpressions.toLocaleString().padStart(8)}  ${calcChange(beforeImpressions, afterImpressions).padStart(8)}`);
    console.log(`  Page Views:    ${beforePageViews.toLocaleString().padStart(8)} → ${afterPageViews.toLocaleString().padStart(8)}  ${calcChange(beforePageViews, afterPageViews).padStart(8)}`);
    console.log(`  Downloads:     ${beforeDL.toLocaleString().padStart(8)} → ${afterDL.toLocaleString().padStart(8)}  ${calcChange(beforeDL, afterDL).padStart(8)}`);
  });

  // Calculate totals
  const totalBefore = {
    impressions: Object.values(beforeEngagementMetrics).reduce((sum, m) => sum + m.impressions, 0),
    pageViews: Object.values(beforeEngagementMetrics).reduce((sum, m) => sum + m.pageViews, 0),
    downloads: Object.values(beforeDownloadMetrics).reduce((sum, m) => sum + m.downloads, 0)
  };
  const totalAfter = {
    impressions: Object.values(afterEngagementMetrics).reduce((sum, m) => sum + m.impressions, 0),
    pageViews: Object.values(afterEngagementMetrics).reduce((sum, m) => sum + m.pageViews, 0),
    downloads: Object.values(afterDownloadMetrics).reduce((sum, m) => sum + m.downloads, 0)
  };

  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('  TOTALS (All Languages)');
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(`  Impressions:   ${totalBefore.impressions.toLocaleString().padStart(8)} → ${totalAfter.impressions.toLocaleString().padStart(8)}  ${calcChange(totalBefore.impressions, totalAfter.impressions).padStart(8)}`);
  console.log(`  Page Views:    ${totalBefore.pageViews.toLocaleString().padStart(8)} → ${totalAfter.pageViews.toLocaleString().padStart(8)}  ${calcChange(totalBefore.pageViews, totalAfter.pageViews).padStart(8)}`);
  console.log(`  Downloads:     ${totalBefore.downloads.toLocaleString().padStart(8)} → ${totalAfter.downloads.toLocaleString().padStart(8)}  ${calcChange(totalBefore.downloads, totalAfter.downloads).padStart(8)}`);

  // Conversion rates
  const beforeConversion = totalBefore.pageViews > 0 ? (totalBefore.downloads / totalBefore.pageViews * 100).toFixed(1) : '0.0';
  const afterConversion = totalAfter.pageViews > 0 ? (totalAfter.downloads / totalAfter.pageViews * 100).toFixed(1) : '0.0';

  console.log('');
  console.log(`  Conversion Rate (PageViews → Downloads):`);
  console.log(`                 ${beforeConversion}% → ${afterConversion}%`);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  if (jsonOutput) {
    console.log(JSON.stringify({
      asoChangeDate: ASO_CHANGE_DATE,
      analysisWindow: ANALYSIS_DAYS,
      beforePeriod: { start: formatDate(beforeStart), end: formatDate(beforeEnd) },
      afterPeriod: { start: formatDate(afterStart), end: formatDate(afterEnd) },
      byLanguage: results,
      totals: {
        before: totalBefore,
        after: totalAfter,
        change: {
          impressions: calcChange(totalBefore.impressions, totalAfter.impressions),
          pageViews: calcChange(totalBefore.pageViews, totalAfter.pageViews),
          downloads: calcChange(totalBefore.downloads, totalAfter.downloads)
        }
      },
      conversionRate: { before: beforeConversion + '%', after: afterConversion + '%' }
    }, null, 2));
  }
}

// Run
runAnalysis().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
