#!/usr/bin/env node
/**
 * Zilis URL Seeder - Common Crawl Index
 *
 * Discovers Zilis distributor URLs from Common Crawl Index and seeds
 * them into the direct_sales_contacts Firestore collection.
 *
 * Usage:
 *   node scripts/seed-zilis-urls.js
 *
 * Environment variables:
 *   DRY_RUN - If "true", don't write to Firestore (preview only)
 *   MAX_URLS - Maximum URLs to seed (default: unlimited)
 *
 * Data source: Common Crawl Index API (no API key required)
 * Query: app.elify.com/vbc/*
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Common Crawl Index - use latest available index
  // Index list: https://index.commoncrawl.org/collinfo.json
  COMMON_CRAWL_INDEXES: [
    'CC-MAIN-2024-51',
    'CC-MAIN-2024-46',
    'CC-MAIN-2024-42',
    'CC-MAIN-2024-38',
    'CC-MAIN-2024-33',
  ],
  COMMON_CRAWL_BASE: 'https://index.commoncrawl.org',

  // URL pattern for Zilis distributors
  URL_PREFIX: 'app.elify.com/vbc/',
  URL_PATTERN: /^https?:\/\/app\.elify\.com\/vbc\/([a-zA-Z0-9_-]+)$/,

  // Firestore
  COLLECTION: 'direct_sales_contacts',
  COMPANY: 'zilis',
  SOURCE: 'common_crawl',

  // Rate limiting for Common Crawl API
  DELAY_BETWEEN_REQUESTS: 1000,
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

function initializeFirebase() {
  const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath))
    });
  }

  return admin.firestore();
}

// ============================================================================
// COMMON CRAWL INDEX QUERY
// ============================================================================

/**
 * Query Common Crawl Index for URLs matching pattern
 * @param {string} indexName - Common Crawl index name (e.g., 'CC-MAIN-2024-51')
 * @param {string} urlPrefix - URL prefix to search for
 * @returns {Promise<string[]>} - Array of discovered URLs
 */
async function queryCommonCrawlIndex(indexName, urlPrefix) {
  const urls = [];
  const indexUrl = `${CONFIG.COMMON_CRAWL_BASE}/${indexName}-index`;
  const queryUrl = `${indexUrl}?url=${encodeURIComponent(urlPrefix)}*&output=json`;

  console.log(`  Querying index: ${indexName}`);
  console.log(`  URL: ${queryUrl}`);

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-URL-Seeder/1.0)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  Index ${indexName} returned 404 - may not have data for this URL prefix`);
        return urls;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();

    // Common Crawl returns JSONL (one JSON object per line)
    const lines = text.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.url) {
          urls.push(record.url);
        }
      } catch (parseError) {
        // Skip malformed lines
        console.log(`  Warning: Could not parse line: ${line.substring(0, 100)}...`);
      }
    }

    console.log(`  Found ${urls.length} URLs in ${indexName}`);

  } catch (error) {
    console.log(`  Error querying ${indexName}: ${error.message}`);
  }

  return urls;
}

/**
 * Query multiple Common Crawl indexes and merge results
 * @returns {Promise<Set<string>>} - Deduplicated set of URLs
 */
async function discoverUrlsFromCommonCrawl() {
  const allUrls = new Set();

  console.log('\n=== Querying Common Crawl Indexes ===\n');

  for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
    const urls = await queryCommonCrawlIndex(indexName, CONFIG.URL_PREFIX);
    urls.forEach(url => allUrls.add(url));

    // Rate limit between index queries
    if (CONFIG.COMMON_CRAWL_INDEXES.indexOf(indexName) < CONFIG.COMMON_CRAWL_INDEXES.length - 1) {
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    }
  }

  console.log(`\nTotal unique URLs discovered: ${allUrls.size}`);

  return allUrls;
}

// ============================================================================
// URL NORMALIZATION & VALIDATION
// ============================================================================

/**
 * Normalize URL: lowercase, remove params/fragments, ensure https
 * @param {string} url - Raw URL
 * @returns {string|null} - Normalized URL or null if invalid
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Ensure it's the right domain and path
    if (parsed.hostname !== 'app.elify.com') {
      return null;
    }

    if (!parsed.pathname.startsWith('/vbc/')) {
      return null;
    }

    // Extract the distributor ID (path after /vbc/)
    const distributorId = parsed.pathname.replace('/vbc/', '').replace(/\/$/, '');

    // Validate distributor ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(distributorId) || distributorId.length === 0) {
      return null;
    }

    // Return normalized URL (https, no params/fragments)
    return `https://app.elify.com/vbc/${distributorId}`;

  } catch (error) {
    return null;
  }
}

/**
 * Validate URL against allowlist pattern
 * @param {string} url - Normalized URL
 * @returns {boolean} - Whether URL is valid
 */
function isValidUrl(url) {
  return CONFIG.URL_PATTERN.test(url);
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Load existing URLs from Firestore for deduplication
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @returns {Promise<Set<string>>} - Set of existing URLs
 */
async function loadExistingUrls(db) {
  console.log('\nLoading existing URLs from Firestore...');

  const existingUrls = new Set();
  const snapshot = await db.collection(CONFIG.COLLECTION)
    .where('company', '==', CONFIG.COMPANY)
    .select('url')
    .get();

  snapshot.forEach(doc => {
    const url = doc.data().url;
    if (url) {
      existingUrls.add(url);
    }
  });

  console.log(`Found ${existingUrls.size} existing URLs in Firestore`);

  return existingUrls;
}

/**
 * Insert new URLs into Firestore
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string[]} urls - URLs to insert
 * @param {boolean} dryRun - If true, don't actually write
 * @returns {Promise<number>} - Number of URLs inserted
 */
async function insertUrls(db, urls, dryRun) {
  if (urls.length === 0) {
    console.log('No new URLs to insert');
    return 0;
  }

  console.log(`\nInserting ${urls.length} new URLs...`);

  if (dryRun) {
    console.log('DRY RUN - Would insert the following URLs:');
    urls.slice(0, 10).forEach(url => console.log(`  ${url}`));
    if (urls.length > 10) {
      console.log(`  ... and ${urls.length - 10} more`);
    }
    return 0;
  }

  const batch = db.batch();
  let batchCount = 0;
  let totalInserted = 0;

  for (const url of urls) {
    const docRef = db.collection(CONFIG.COLLECTION).doc();

    batch.set(docRef, {
      // URL & Source
      url: url,
      normalizedUrl: url,
      source: CONFIG.SOURCE,
      company: CONFIG.COMPANY,

      // Contact Info (null until scraped)
      firstName: null,
      lastName: null,
      email: null,

      // Scrape Status
      scraped: false,
      scrapedAt: null,
      scrapeStatus: 'pending',
      scrapeError: null,
      scrapeAttempts: 0,
      lastAttemptAt: null,

      // Metadata
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    totalInserted++;

    // Firestore batch limit is 500
    if (batchCount >= 500) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount} URLs (total: ${totalInserted})`);
      batchCount = 0;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} URLs (total: ${totalInserted})`);
  }

  return totalInserted;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  const dryRun = process.env.DRY_RUN === 'true';
  const maxUrls = process.env.MAX_URLS ? parseInt(process.env.MAX_URLS, 10) : Infinity;

  console.log('='.repeat(60));
  console.log('ZILIS URL SEEDER - Common Crawl Index');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max URLs: ${maxUrls === Infinity ? 'unlimited' : maxUrls}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Initialize Firebase
  const db = initializeFirebase();

  // Discover URLs from Common Crawl
  const discoveredUrls = await discoverUrlsFromCommonCrawl();

  // Normalize and validate URLs
  console.log('\n=== Normalizing and Validating URLs ===\n');
  const validUrls = [];
  let invalidCount = 0;

  for (const url of discoveredUrls) {
    const normalized = normalizeUrl(url);
    if (normalized && isValidUrl(normalized)) {
      validUrls.push(normalized);
    } else {
      invalidCount++;
    }
  }

  console.log(`Valid URLs: ${validUrls.length}`);
  console.log(`Invalid/rejected URLs: ${invalidCount}`);

  // Load existing URLs for deduplication
  const existingUrls = await loadExistingUrls(db);

  // Filter out duplicates
  const newUrls = validUrls.filter(url => !existingUrls.has(url));
  console.log(`New URLs (not in Firestore): ${newUrls.length}`);

  // Apply max limit
  const urlsToInsert = newUrls.slice(0, maxUrls);
  if (newUrls.length > maxUrls) {
    console.log(`Limited to ${maxUrls} URLs (${newUrls.length - maxUrls} URLs not inserted)`);
  }

  // Insert into Firestore
  const insertedCount = await insertUrls(db, urlsToInsert, dryRun);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('SEEDING COMPLETE');
  console.log('='.repeat(60));
  console.log(`URLs discovered: ${discoveredUrls.size}`);
  console.log(`URLs valid: ${validUrls.length}`);
  console.log(`URLs new: ${newUrls.length}`);
  console.log(`URLs inserted: ${insertedCount}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('='.repeat(60));

  // Exit
  process.exit(0);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
