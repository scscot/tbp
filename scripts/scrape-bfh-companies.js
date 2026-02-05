#!/usr/bin/env node
/**
 * BusinessForHome.org Company Scraper
 *
 * Discovers MLM/direct sales company website URLs from BusinessForHome.org
 * and adds new ones to base_urls.txt for the contacts pipeline.
 *
 * Data source: https://www.businessforhome.org/company-sitemap.xml (~1,062 companies)
 *
 * Usage:
 *   node scripts/scrape-bfh-companies.js              # Run full scrape
 *   node scripts/scrape-bfh-companies.js --dry-run     # Preview only, don't write
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SITEMAP_URL: 'https://www.businessforhome.org/company-sitemap.xml',
  BASE_URLS_FILE: path.join(__dirname, 'base_urls.txt'),
  DELAY_BETWEEN_REQUESTS: 500,
  REQUEST_TIMEOUT: 15000,
  MAX_RETRIES: 1,
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize a URL to https://domain.com format for base_urls.txt
 */
function normalizeUrl(rawUrl) {
  try {
    // Handle URLs that might be missing protocol
    let url = rawUrl.trim();
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url;
    }

    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();

    // Return https://hostname (no path, no trailing slash)
    return `https://${hostname}`;
  } catch {
    return null;
  }
}

/**
 * Load existing base_urls.txt into a Set of normalized domains
 */
function loadExistingUrls() {
  const content = fs.readFileSync(CONFIG.BASE_URLS_FILE, 'utf8');
  const urls = new Set();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const normalized = normalizeUrl(trimmed);
      if (normalized) {
        urls.add(normalized);
      }
    }
  }

  return urls;
}

// ============================================================================
// SITEMAP PARSING
// ============================================================================

/**
 * Fetch and parse the company sitemap XML
 */
async function fetchSitemapUrls() {
  console.log(`Fetching sitemap: ${CONFIG.SITEMAP_URL}`);

  const response = await axios.get(CONFIG.SITEMAP_URL, {
    timeout: CONFIG.REQUEST_TIMEOUT,
    headers: { 'User-Agent': CONFIG.USER_AGENT },
  });

  const $ = cheerio.load(response.data, { xmlMode: true });
  const urls = [];

  $('url > loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (loc.includes('/companies/')) {
      urls.push(loc);
    }
  });

  console.log(`Found ${urls.length} company pages in sitemap`);
  return urls;
}

// ============================================================================
// COMPANY PAGE SCRAPING
// ============================================================================

/**
 * Fetch a company detail page and extract the website URL
 */
async function extractWebsiteUrl(companyPageUrl, retries = 0) {
  try {
    const response = await axios.get(companyPageUrl, {
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: { 'User-Agent': CONFIG.USER_AGENT },
    });

    const $ = cheerio.load(response.data);

    // Find <span class="company-about__data-title">Website</span>
    // followed by <span class="company-about__data-value"><a href="...">
    let websiteUrl = null;

    $('span.company-about__data-title').each((_, el) => {
      if ($(el).text().trim().toLowerCase() === 'website') {
        const valueSpan = $(el).next('span.company-about__data-value');
        const link = valueSpan.find('a').first();
        if (link.length) {
          websiteUrl = link.attr('href');
        }
      }
    });

    return websiteUrl;
  } catch (error) {
    if (retries < CONFIG.MAX_RETRIES) {
      await sleep(2000);
      return extractWebsiteUrl(companyPageUrl, retries + 1);
    }
    return null;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('BUSINESSFORHOME.ORG COMPANY SCRAPER');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Load existing URLs
  const existingUrls = loadExistingUrls();
  console.log(`Existing URLs in base_urls.txt: ${existingUrls.size}`);

  // Fetch sitemap
  const companyPages = await fetchSitemapUrls();

  // Process each company page
  const newUrls = [];
  const skippedExisting = [];
  const noWebsite = [];
  const errors = [];
  let processed = 0;

  for (const pageUrl of companyPages) {
    processed++;

    // Extract slug for display
    const slug = pageUrl.replace('https://www.businessforhome.org/companies/', '').replace(/\/$/, '');

    // Progress logging
    if (processed % 50 === 0 || processed === 1) {
      console.log(`  [${processed}/${companyPages.length}] Processing ${slug}...`);
    }

    const websiteUrl = await extractWebsiteUrl(pageUrl);

    if (!websiteUrl) {
      noWebsite.push(slug);
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      continue;
    }

    const normalized = normalizeUrl(websiteUrl);
    if (!normalized) {
      errors.push({ slug, url: websiteUrl, reason: 'invalid URL' });
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
      continue;
    }

    if (existingUrls.has(normalized)) {
      skippedExisting.push(slug);
    } else {
      newUrls.push(normalized);
      existingUrls.add(normalized); // Prevent duplicates within this run
    }

    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('SCRAPE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Companies processed: ${processed}`);
  console.log(`Already in base_urls.txt: ${skippedExisting.length}`);
  console.log(`No website found: ${noWebsite.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`NEW URLs to add: ${newUrls.length}`);
  console.log(`Time elapsed: ${elapsed}s`);

  if (newUrls.length > 0) {
    console.log('\nNew URLs:');
    for (const url of newUrls) {
      console.log(`  ${url}`);
    }
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const err of errors) {
      console.log(`  ${err.slug}: ${err.url} (${err.reason})`);
    }
  }

  // Write new URLs to base_urls.txt
  if (!dryRun && newUrls.length > 0) {
    const appendContent = '\n' + newUrls.join('\n') + '\n';
    fs.appendFileSync(CONFIG.BASE_URLS_FILE, appendContent, 'utf8');
    console.log(`\nAppended ${newUrls.length} new URLs to base_urls.txt`);
  } else if (dryRun && newUrls.length > 0) {
    console.log(`\nDRY RUN - Would append ${newUrls.length} URLs to base_urls.txt`);
  } else {
    console.log('\nNo new URLs to add.');
  }

  console.log('='.repeat(60));
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
