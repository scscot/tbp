#!/usr/bin/env node

/**
 * Find 404 URLs on teambuildpro.com
 * Fetches sitemap and checks each URL for 404 status
 */

const https = require('https');
const http = require('http');

async function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SitemapChecker/1.0)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data, url: res.headers.location }));
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function checkUrlStatus(url) {
  try {
    const result = await fetchUrl(url);
    return { url, status: result.status, redirect: result.url };
  } catch (e) {
    return { url, status: 'error', error: e.message };
  }
}

async function main() {
  console.log('Fetching sitemap from teambuildpro.com...\n');

  // Fetch main sitemap
  const sitemapResult = await fetchUrl('https://teambuildpro.com/sitemap.xml');

  // Parse URLs from sitemap
  const urlMatches = sitemapResult.data.match(/<loc>([^<]+)<\/loc>/g) || [];
  const urls = urlMatches.map(m => m.replace(/<\/?loc>/g, ''));

  console.log(`Found ${urls.length} URLs in sitemap\n`);

  // Check each URL
  const notFoundUrls = [];
  const redirectUrls = [];
  const errorUrls = [];

  console.log('Checking URLs for 404 status...\n');

  // Process in batches of 10 to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(checkUrlStatus));

    for (const result of results) {
      if (result.status === 404) {
        notFoundUrls.push(result.url);
        console.log(`❌ 404: ${result.url}`);
      } else if (result.status >= 300 && result.status < 400) {
        redirectUrls.push({ url: result.url, redirect: result.redirect });
      } else if (result.status === 'error') {
        errorUrls.push({ url: result.url, error: result.error });
      }
    }

    // Progress indicator
    process.stdout.write(`\rChecked ${Math.min(i + batchSize, urls.length)}/${urls.length} URLs`);
  }

  console.log('\n\n========== SUMMARY ==========\n');

  if (notFoundUrls.length > 0) {
    console.log(`\n🚨 404 NOT FOUND (${notFoundUrls.length} URLs):`);
    notFoundUrls.forEach(url => console.log(`  - ${url}`));
  } else {
    console.log('✅ No 404 errors found in sitemap URLs');
  }

  if (redirectUrls.length > 0) {
    console.log(`\n⚠️  REDIRECTS (${redirectUrls.length} URLs):`);
    redirectUrls.forEach(r => console.log(`  - ${r.url} → ${r.redirect || 'unknown'}`));
  }

  if (errorUrls.length > 0) {
    console.log(`\n⚠️  ERRORS (${errorUrls.length} URLs):`);
    errorUrls.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
  }

  // Also check common pages not in sitemap
  console.log('\n\nChecking additional common pages...\n');

  const additionalUrls = [
    'https://teambuildpro.com/about.html',
    'https://teambuildpro.com/features.html',
    'https://teambuildpro.com/pricing.html',
    'https://teambuildpro.com/download.html',
    'https://teambuildpro.com/app.html',
  ];

  for (const url of additionalUrls) {
    const result = await checkUrlStatus(url);
    if (result.status === 404) {
      console.log(`❌ 404: ${url}`);
    } else if (result.status === 200) {
      console.log(`✅ 200: ${url}`);
    } else {
      console.log(`⚠️  ${result.status}: ${url}`);
    }
  }
}

main().catch(console.error);
