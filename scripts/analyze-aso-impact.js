#!/usr/bin/env node
/**
 * App Store Performance Analysis Script
 *
 * Analyzes App Store Connect metrics using a rolling 30-day window.
 * Compares impressions and downloads by territory, mapped to language versions.
 *
 * Rolling Window (accounts for ~10 day ASC data lag):
 *   - Before Period: 39-25 days ago (15 days)
 *   - After Period: 24-10 days ago (15 days)
 *
 * Usage:
 *   node scripts/analyze-aso-impact.js
 *   node scripts/analyze-aso-impact.js --json     # Output as JSON
 *   node scripts/analyze-aso-impact.js --email    # Send results via email
 *
 * Requires:
 *   - ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY environment variables
 *   - Or secrets in /Users/sscott/tbp/secrets/asc-credentials.json
 *   - MAILGUN_API_KEY for --email option
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Parse CLI arguments
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const emailOutput = args.includes('--email');

// Email configuration
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const TO_ADDRESS = 'Stephen Scott <scscot@gmail.com>';
const EMAIL_SUBJECT = 'Weekly ASO Data';

// Analysis uses rolling 30-day window split in half
// Before Period: 30-15 days ago
// After Period: 15 days ago to today

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
async function ascRequest(endpoint, token, params = {}, silent = false) {
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
    if (error.response && !silent) {
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
        // Use silent=true since some instances may have expired (404 is expected)
        const segmentsResponse = await ascRequest(
          `/analyticsReportInstances/${instance.id}/segments`,
          token,
          { limit: 10 },
          true  // silent - don't log 404s for expired instances
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

// Generate HTML email content
function generateEmailHtml(data) {
  const { beforePeriod, afterPeriod, results, totalBefore, totalAfter, beforeConversion, afterConversion } = data;

  const changeColor = (change) => {
    if (change.startsWith('+') && change !== '+0%' && change !== '+0.0%') return '#22c55e'; // green
    if (change.startsWith('-')) return '#ef4444'; // red
    return '#6b7280'; // gray
  };

  const langNames = { EN: 'English', ES: 'Spanish', PT: 'Portuguese', DE: 'German' };

  let languageRows = '';
  ['EN', 'ES', 'PT', 'DE'].forEach(lang => {
    const r = results[lang];
    languageRows += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: 600;">${lang} (${langNames[lang]})</td>
        <td style="padding: 12px; text-align: right;">${r.impressions.before.toLocaleString()} → ${r.impressions.after.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; color: ${changeColor(r.impressions.change)}; font-weight: 600;">${r.impressions.change}</td>
        <td style="padding: 12px; text-align: right;">${r.pageViews.before.toLocaleString()} → ${r.pageViews.after.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; color: ${changeColor(r.pageViews.change)}; font-weight: 600;">${r.pageViews.change}</td>
        <td style="padding: 12px; text-align: right;">${r.downloads.before.toLocaleString()} → ${r.downloads.after.toLocaleString()}</td>
        <td style="padding: 12px; text-align: right; color: ${changeColor(r.downloads.change)}; font-weight: 600;">${r.downloads.change}</td>
      </tr>`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 24px; border-radius: 8px 8px 0 0;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Weekly ASO Performance Report</h1>
      <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Team Build Pro - App Store Connect Analytics</p>
    </div>

    <!-- Date Ranges -->
    <div style="padding: 20px; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
      <div style="display: flex; gap: 40px;">
        <div>
          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Before Period</p>
          <p style="margin: 4px 0 0 0; color: #1f2937; font-weight: 600;">${beforePeriod.start} to ${beforePeriod.end}</p>
          <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 12px;">(39-25 days ago)</p>
        </div>
        <div>
          <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">After Period</p>
          <p style="margin: 4px 0 0 0; color: #1f2937; font-weight: 600;">${afterPeriod.start} to ${afterPeriod.end}</p>
          <p style="margin: 2px 0 0 0; color: #6b7280; font-size: 12px;">(24-10 days ago)</p>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div style="padding: 20px; display: flex; gap: 16px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 150px; background-color: #eff6ff; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #3b82f6; font-size: 12px; text-transform: uppercase;">Impressions</p>
        <p style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 700; color: #1e40af;">${totalAfter.impressions.toLocaleString()}</p>
        <p style="margin: 0; color: ${changeColor(calcChange(totalBefore.impressions, totalAfter.impressions))}; font-weight: 600;">${calcChange(totalBefore.impressions, totalAfter.impressions)} from ${totalBefore.impressions.toLocaleString()}</p>
      </div>
      <div style="flex: 1; min-width: 150px; background-color: #f0fdf4; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #22c55e; font-size: 12px; text-transform: uppercase;">Page Views</p>
        <p style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 700; color: #166534;">${totalAfter.pageViews.toLocaleString()}</p>
        <p style="margin: 0; color: ${changeColor(calcChange(totalBefore.pageViews, totalAfter.pageViews))}; font-weight: 600;">${calcChange(totalBefore.pageViews, totalAfter.pageViews)} from ${totalBefore.pageViews.toLocaleString()}</p>
      </div>
      <div style="flex: 1; min-width: 150px; background-color: #fef3c7; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #d97706; font-size: 12px; text-transform: uppercase;">Downloads</p>
        <p style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 700; color: #92400e;">${totalAfter.downloads.toLocaleString()}</p>
        <p style="margin: 0; color: ${changeColor(calcChange(totalBefore.downloads, totalAfter.downloads))}; font-weight: 600;">${calcChange(totalBefore.downloads, totalAfter.downloads)} from ${totalBefore.downloads.toLocaleString()}</p>
      </div>
      <div style="flex: 1; min-width: 150px; background-color: #faf5ff; border-radius: 8px; padding: 16px;">
        <p style="margin: 0; color: #9333ea; font-size: 12px; text-transform: uppercase;">Conversion Rate</p>
        <p style="margin: 8px 0 4px 0; font-size: 24px; font-weight: 700; color: #581c87;">${afterConversion}%</p>
        <p style="margin: 0; color: #6b7280;">was ${beforeConversion}%</p>
      </div>
    </div>

    <!-- Results by Language -->
    <div style="padding: 0 20px 20px 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">Results by Language</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 12px; text-align: left; color: #6b7280; font-weight: 600;">Language</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Impressions</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Change</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Page Views</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Change</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Downloads</th>
              <th style="padding: 12px; text-align: right; color: #6b7280; font-weight: 600;">Change</th>
            </tr>
          </thead>
          <tbody>
            ${languageRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 20px; background-color: #f8fafc; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
      </p>
      <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 11px;">
        Note: Date ranges exclude last 10 days due to App Store Connect data lag.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Send email via Mailgun
async function sendEmail(html) {
  const apiKey = process.env.MAILGUN_API_KEY || process.env.TBP_MAILGUN_API_KEY;
  if (!apiKey) {
    throw new Error('MAILGUN_API_KEY environment variable not set');
  }

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', TO_ADDRESS);
  form.append('subject', EMAIL_SUBJECT);
  form.append('html', html);
  form.append('o:tag', 'aso_weekly_report');

  await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    }
  );

  console.log(`  ✓ Email sent to ${TO_ADDRESS}`);
}

// Main analysis function
async function runAnalysis() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  App Store Performance Analysis (Rolling 30-Day Window)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
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

  // Calculate date ranges accounting for ~10 day ASC data lag
  // Before Period: 39-25 days ago (15 days)
  // After Period: 24-10 days ago (15 days)
  // This ensures both periods use complete data
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const beforeStart = new Date(today);
  beforeStart.setDate(beforeStart.getDate() - 39);

  const beforeEnd = new Date(today);
  beforeEnd.setDate(beforeEnd.getDate() - 25);

  const afterStart = new Date(today);
  afterStart.setDate(afterStart.getDate() - 24);

  const afterEnd = new Date(today);
  afterEnd.setDate(afterEnd.getDate() - 10);

  const formatDate = d => d.toISOString().split('T')[0];

  console.log('');
  console.log(`  Before Period: ${formatDate(beforeStart)} to ${formatDate(beforeEnd)}`);
  console.log(`  After Period:  ${formatDate(afterStart)} to ${formatDate(afterEnd)}`);

  // Note about data lag
  console.log('');
  console.log('  Note: Date ranges exclude last 10 days (ASC data lag).');

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
      analysisType: 'rolling_30_day_window',
      beforePeriod: { start: formatDate(beforeStart), end: formatDate(beforeEnd), description: '39-25 days ago' },
      afterPeriod: { start: formatDate(afterStart), end: formatDate(afterEnd), description: '24-10 days ago' },
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

  // Send email if requested
  if (emailOutput) {
    console.log('');
    console.log('  Sending email report...');
    const emailHtml = generateEmailHtml({
      beforePeriod: { start: formatDate(beforeStart), end: formatDate(beforeEnd) },
      afterPeriod: { start: formatDate(afterStart), end: formatDate(afterEnd) },
      results,
      totalBefore,
      totalAfter,
      beforeConversion,
      afterConversion
    });
    await sendEmail(emailHtml);
  }
}

// Run
runAnalysis().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
