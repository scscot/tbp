#!/usr/bin/env node
/**
 * THREE International URL Discovery Script
 *
 * Discovers THREE International representative subdomains using a hybrid approach:
 * 1. Common Crawl Index API (18 indexes, 2024-2026)
 * 2. Wayback Machine CDX API (historical URLs)
 * 3. Google Search via SerpAPI (multiple queries for shared links)
 * 4. Manual seed file (scripts/three-seed-subdomains.txt)
 *
 * THREE URL format: https://{subdomain}.threeinternational.com
 * Examples:
 *   - https://corbinandholly.threeinternational.com
 *   - https://johndoe.threeinternational.com
 *
 * Usage:
 *   node scripts/three-url-discovery.js --discover              # Run full discovery
 *   node scripts/three-url-discovery.js --discover --max=200    # Limit SerpAPI searches
 *   node scripts/three-url-discovery.js --seed                  # Load from seed file only
 *   node scripts/three-url-discovery.js --seed --dry-run        # Preview seed import
 *   node scripts/three-url-discovery.js --dry-run               # Preview only
 *   node scripts/three-url-discovery.js --stats                 # Show stats
 *   node scripts/three-url-discovery.js --reset                 # Reset discovery state
 *
 * Seed File: scripts/three-seed-subdomains.txt
 *   - One subdomain per line
 *   - Lines starting with # are comments
 *   - Useful for manually discovered subdomains (social media, YouTube, etc.)
 *
 * Sources:
 *   - Common Crawl Index API (no key required)
 *   - Wayback Machine CDX API (no key required)
 *   - SerpAPI Google Search (key from secrets/SerpAPI-Key)
 *   - Seed file (manual subdomains)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load SerpAPI key
const SERPAPI_KEY_PATH = path.join(__dirname, '../secrets/SerpAPI-Key');
const SERPAPI_KEY = fs.existsSync(SERPAPI_KEY_PATH)
  ? fs.readFileSync(SERPAPI_KEY_PATH, 'utf8').trim()
  : null;

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'three_discovered_subdomains',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'three_discovery',

  // THREE URL patterns
  THREE_DOMAIN: 'threeinternational.com',
  URL_PATTERN: '*.threeinternational.com',

  // Excluded subdomains (not representative pages)
  EXCLUDED_SUBDOMAINS: [
    'www',
    'shop',
    'store',
    'app',
    'api',
    'mail',
    'email',
    'admin',
    'support',
    'help',
    'blog',
    'news',
    'static',
    'cdn',
    'assets',
    'images',
    'img',
    'media',
    'dev',
    'staging',
    'test',
    'demo',
    'login',
    'signup',
    'register',
    'account',
    'my',
    'dashboard',
    'portal',
    'secure',
    'payment',
    'checkout',
    'cart',
    'order',
    'tracking',
    'corporate',
    'company',
    'about',
    'contact',
    'faq',
    'legal',
    'privacy',
    'terms',
    'enrollment',
  ],

  // Common Crawl indexes
  COMMON_CRAWL_INDEXES: [
    'CC-MAIN-2026-04',
    'CC-MAIN-2025-51',
    'CC-MAIN-2025-47',
    'CC-MAIN-2025-43',
    'CC-MAIN-2025-38',
    'CC-MAIN-2025-33',
    'CC-MAIN-2025-30',
    'CC-MAIN-2025-26',
    'CC-MAIN-2025-21',
    'CC-MAIN-2025-18',
    'CC-MAIN-2025-13',
    'CC-MAIN-2025-08',
    'CC-MAIN-2025-05',
    'CC-MAIN-2024-51',
    'CC-MAIN-2024-46',
    'CC-MAIN-2024-42',
    'CC-MAIN-2024-38',
    'CC-MAIN-2024-33',
  ],
  COMMON_CRAWL_BASE: 'https://index.commoncrawl.org',

  // SerpAPI - multiple queries to find representative links shared online
  SERPAPI_URL: 'https://serpapi.com/search',
  SERPAPI_QUERIES: [
    'site:threeinternational.com -site:www.threeinternational.com',
    '"threeinternational.com" distributor OR representative',
    'THREE International "my link" OR "my site"',
    '"threeinternational.com" wellness health',
    'THREE International partner shop',
    '"threeinternational.com" skincare beauty',
  ],
  SERPAPI_MAX_PAGES: 5,  // Max pages per query (10 results per page)

  // Rate limiting
  CC_DELAY: 1500,          // 1.5s between Common Crawl requests
  WB_DELAY: 2000,          // 2s before Wayback request
  SERPAPI_DELAY: 4000,     // 4s between SerpAPI requests (rate limited)

  // Timeouts
  FETCH_TIMEOUT: 15000,    // 15 seconds

  // Resilience
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_PAUSE: 30000,
  MAX_CIRCUIT_TRIPS: 2,
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'teambuilder-plus-fe74d'
    });
  }
  db = admin.firestore();
  console.log('Firebase initialized');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract subdomain from THREE International URL
 * Handles various URL formats:
 *   - https://corbinandholly.threeinternational.com
 *   - https://corbinandholly.threeinternational.com/
 *   - http://johndoe.threeinternational.com/some/path
 */
function extractSubdomain(url) {
  try {
    const parsed = new URL(url);

    // Check if it's a threeinternational.com domain
    if (!parsed.hostname.endsWith('threeinternational.com')) {
      return null;
    }

    // Extract subdomain
    const hostname = parsed.hostname.toLowerCase();
    const subdomain = hostname.replace('.threeinternational.com', '');

    // Skip if no subdomain or just the base domain
    if (!subdomain || subdomain === 'threeinternational') {
      return null;
    }

    // Skip excluded subdomains
    if (CONFIG.EXCLUDED_SUBDOMAINS.includes(subdomain)) {
      return null;
    }

    // Validate subdomain format (alphanumeric, hyphens, 2-50 chars)
    if (!/^[a-z0-9-]{2,50}$/i.test(subdomain)) {
      return null;
    }

    // Skip subdomains that are just numbers
    if (/^\d+$/.test(subdomain)) {
      return null;
    }

    return subdomain;
  } catch {
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    discover: false,
    dryRun: false,
    stats: false,
    reset: false,
    seed: false,
    max: Infinity,  // No limit by default - discover all available subdomains
  };

  for (const arg of args) {
    if (arg === '--discover') options.discover = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--reset') options.reset = true;
    if (arg === '--seed') options.seed = true;
    if (arg.startsWith('--max=')) {
      const val = parseInt(arg.split('=')[1], 10);
      options.max = val === 0 ? Infinity : val;
    }
  }

  return options;
}

// ============================================================================
// SEED FILE LOADING
// ============================================================================

const SEED_FILE_PATH = path.join(__dirname, 'three-seed-subdomains.txt');

/**
 * Load subdomains from seed file
 * Format: one subdomain per line, lines starting with # are comments
 */
async function loadSeedSubdomains() {
  const subdomains = new Set();

  if (!fs.existsSync(SEED_FILE_PATH)) {
    console.log(`  Seed file not found: ${SEED_FILE_PATH}`);
    return subdomains;
  }

  const content = fs.readFileSync(SEED_FILE_PATH, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Validate subdomain format
    const normalized = trimmed.toLowerCase();
    if (/^[a-z0-9-]{2,50}$/i.test(normalized) && !CONFIG.EXCLUDED_SUBDOMAINS.includes(normalized)) {
      subdomains.add(normalized);
    }
  }

  return subdomains;
}

async function seedFromFile(dryRun) {
  console.log('\n Seeding from file...');

  const seedSubdomains = await loadSeedSubdomains();
  console.log(`  Found ${seedSubdomains.size} subdomains in seed file`);

  if (seedSubdomains.size === 0) {
    console.log('  No subdomains to seed');
    return 0;
  }

  // Load existing subdomains
  const existingSubdomains = await loadExistingSubdomains();

  // Filter out existing subdomains
  const newSubdomains = Array.from(seedSubdomains).filter(sub => !existingSubdomains.has(sub));
  console.log(`  New subdomains: ${newSubdomains.length}`);

  // Save new subdomains
  const saved = await saveNewSubdomains(newSubdomains, 'seed', dryRun);
  return saved;
}

// ============================================================================
// COMMON CRAWL DISCOVERY
// ============================================================================

const circuitBreaker = {
  consecutiveFailures: 0,
  tripCount: 0,
  isOpen: false,
};

async function queryCommonCrawlIndex(indexName, pattern) {
  const urls = [];
  const indexUrl = `${CONFIG.COMMON_CRAWL_BASE}/${indexName}-index`;
  const queryUrl = `${indexUrl}?url=${encodeURIComponent(pattern)}&output=json`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-THREE-Discovery/1.0)',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { urls, error: false };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text.trim()) return { urls, error: false };

    // Parse JSONL (one JSON object per line)
    const lines = text.trim().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.url) {
          urls.push(record.url);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return { urls, error: false };
  } catch (error) {
    console.log(`    Error querying ${indexName}: ${error.message}`);
    return { urls, error: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverFromCommonCrawl() {
  const subdomains = new Set();
  console.log('\n Discovering from Common Crawl...');

  if (circuitBreaker.isOpen) {
    console.log('  Circuit breaker OPEN - skipping Common Crawl');
    return subdomains;
  }

  for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
    console.log(`  Querying ${indexName}...`);
    const { urls, error } = await queryCommonCrawlIndex(indexName, CONFIG.URL_PATTERN);

    // Extract subdomains
    for (const url of urls) {
      const subdomain = extractSubdomain(url);
      if (subdomain) {
        subdomains.add(subdomain);
      }
    }

    console.log(`    Found ${urls.length} URLs -> ${subdomains.size} unique subdomains so far`);

    // Circuit breaker tracking
    if (error) {
      circuitBreaker.consecutiveFailures++;
      if (circuitBreaker.consecutiveFailures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreaker.tripCount++;
        if (circuitBreaker.tripCount >= CONFIG.MAX_CIRCUIT_TRIPS) {
          console.log(`    Circuit breaker OPEN - Common Crawl appears down`);
          circuitBreaker.isOpen = true;
          break;
        }
        console.log(`    Circuit breaker tripped - pausing ${CONFIG.CIRCUIT_BREAKER_PAUSE / 1000}s...`);
        circuitBreaker.consecutiveFailures = 0;
        await sleep(CONFIG.CIRCUIT_BREAKER_PAUSE);
      }
    } else {
      circuitBreaker.consecutiveFailures = 0;
    }

    await sleep(CONFIG.CC_DELAY);
  }

  console.log(`  Common Crawl total: ${subdomains.size} unique subdomains`);
  return subdomains;
}

// ============================================================================
// WAYBACK MACHINE DISCOVERY
// ============================================================================

async function discoverFromWayback() {
  const subdomains = new Set();
  console.log('\n Discovering from Wayback Machine...');

  const queryUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(CONFIG.URL_PATTERN)}&output=json&fl=original&collapse=urlkey&limit=10000`;

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-THREE-Discovery/1.0)',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('  Wayback: No results');
        return subdomains;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // CDX JSON: first row is headers, rest are data
    if (Array.isArray(data) && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const url = data[i][0];
        const subdomain = extractSubdomain(url);
        if (subdomain) {
          subdomains.add(subdomain);
        }
      }
    }

    console.log(`  Wayback total: ${subdomains.size} unique subdomains`);
  } catch (error) {
    console.log(`  Wayback error: ${error.message}`);
  }

  return subdomains;
}

// ============================================================================
// SERPAPI GOOGLE SEARCH DISCOVERY
// ============================================================================

async function discoverFromSerpAPI(maxSearches) {
  const subdomains = new Set();
  console.log('\n Discovering from Google Search (SerpAPI)...');

  if (!SERPAPI_KEY) {
    console.log('  Skipping: SerpAPI key not found');
    return subdomains;
  }

  let totalSearchCount = 0;

  // Iterate through all search queries
  for (const query of CONFIG.SERPAPI_QUERIES) {
    if (totalSearchCount >= maxSearches) break;

    console.log(`\n  Query: "${query}"`);
    let start = 0;
    let querySearchCount = 0;

    while (querySearchCount < CONFIG.SERPAPI_MAX_PAGES && totalSearchCount < maxSearches) {
      console.log(`    Page ${querySearchCount + 1}...`);

      try {
        const response = await axios.get(CONFIG.SERPAPI_URL, {
          params: {
            api_key: SERPAPI_KEY,
            engine: 'google',
            q: query,
            start: start,
            num: 10,
          },
          timeout: CONFIG.FETCH_TIMEOUT,
        });

        const results = response.data.organic_results || [];

        if (results.length === 0) {
          console.log(`    No more results for this query`);
          break;
        }

        let pageSubdomainsFound = 0;
        for (const result of results) {
          // Check the link itself
          let subdomain = extractSubdomain(result.link);
          if (subdomain) {
            subdomains.add(subdomain);
            pageSubdomainsFound++;
          }

          // Also check displayed_link if available
          if (result.displayed_link) {
            // displayed_link might be in format "subdomain.threeinternational.com"
            const displayedSubdomain = extractSubdomain('https://' + result.displayed_link);
            if (displayedSubdomain) {
              subdomains.add(displayedSubdomain);
              pageSubdomainsFound++;
            }
          }

          // Check snippet for threeinternational.com links
          if (result.snippet) {
            const urlMatches = result.snippet.match(/([a-z0-9-]+)\.threeinternational\.com/gi);
            if (urlMatches) {
              for (const match of urlMatches) {
                const snippetSubdomain = match.toLowerCase().replace('.threeinternational.com', '');
                if (snippetSubdomain && !CONFIG.EXCLUDED_SUBDOMAINS.includes(snippetSubdomain)) {
                  subdomains.add(snippetSubdomain);
                  pageSubdomainsFound++;
                }
              }
            }
          }
        }

        console.log(`      ${results.length} results -> ${pageSubdomainsFound} subdomains (${subdomains.size} total unique)`);

        totalSearchCount++;
        querySearchCount++;
        start += 10;

        // Rate limit
        await sleep(CONFIG.SERPAPI_DELAY);

      } catch (error) {
        console.log(`    SerpAPI error: ${error.message}`);
        break;
      }
    }
  }

  console.log(`\n  SerpAPI total: ${subdomains.size} unique subdomains`);
  return subdomains;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function loadExistingSubdomains() {
  console.log('\n Loading existing subdomains from Firestore...');

  const existingSubdomains = new Set();
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .select('subdomain')
    .get();

  snapshot.forEach(doc => {
    const subdomain = doc.data().subdomain;
    if (subdomain) {
      existingSubdomains.add(subdomain.toLowerCase());
    }
  });

  console.log(`  Found ${existingSubdomains.size} existing subdomains`);
  return existingSubdomains;
}

async function saveNewSubdomains(subdomains, source, dryRun) {
  if (subdomains.length === 0) {
    console.log('  No new subdomains to save');
    return 0;
  }

  console.log(`\n Saving ${subdomains.length} new subdomains...`);

  if (dryRun) {
    console.log('  DRY RUN - Would save:');
    subdomains.slice(0, 10).forEach(sub => console.log(`    ${sub}`));
    if (subdomains.length > 10) {
      console.log(`    ... and ${subdomains.length - 10} more`);
    }
    return 0;
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalSaved = 0;

  for (const subdomain of subdomains) {
    const docRef = db.collection(CONFIG.DISCOVERED_COLLECTION).doc();

    batch.set(docRef, {
      subdomain: subdomain,
      profileUrl: `https://${subdomain}.threeinternational.com`,
      source: source,
      discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      scraped: false,
      scrapedAt: null,
    });

    batchCount++;
    totalSaved++;

    if (batchCount >= 500) {
      await batch.commit();
      console.log(`    Committed batch of ${batchCount} subdomains (total: ${totalSaved})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`    Committed final batch of ${batchCount} subdomains (total: ${totalSaved})`);
  }

  return totalSaved;
}

async function updateDiscoveryState(stats) {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set({
    lastDiscoveryAt: admin.firestore.FieldValue.serverTimestamp(),
    ...stats,
  }, { merge: true });
}

async function resetDiscoveryState() {
  console.log(' Resetting discovery state...');

  // Delete all discovered subdomains
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  Deleted ${count} documents...`);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  // Reset state
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).delete();

  console.log(`  Deleted ${count} discovered subdomains`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n THREE Discovery Stats\n');

  // Get collection counts
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const totalDiscovered = discoveredSnapshot.size;

  // Count by scraped status
  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();
  const scrapedCount = scrapedSnapshot.size;
  const pendingCount = totalDiscovered - scrapedCount;

  // Get state
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  console.log('Discovered Subdomains:');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scrapedCount}`);
  console.log(`  Pending:  ${pendingCount}`);

  if (state.lastDiscoveryAt) {
    console.log(`\nLast Discovery: ${state.lastDiscoveryAt.toDate().toISOString()}`);
  }

  if (state.commonCrawlSubdomains !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Common Crawl: ${state.commonCrawlSubdomains} subdomains`);
    console.log(`  Wayback:      ${state.waybackSubdomains} subdomains`);
    console.log(`  SerpAPI:      ${state.serpApiSubdomains} subdomains`);
    console.log(`  Total New:    ${state.totalNewSubdomains} subdomains`);
  }

  // Show sample subdomains
  console.log('\nSample subdomains (first 10):');
  const sampleSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .orderBy('discoveredAt', 'desc')
    .limit(10)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.subdomain} (${data.source})`);
  });
}

// ============================================================================
// MAIN DISCOVERY FLOW
// ============================================================================

async function runDiscovery(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('THREE INTERNATIONAL URL DISCOVERY');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max SerpAPI searches: ${options.max === Infinity ? 'unlimited' : options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Load existing subdomains
  const existingSubdomains = await loadExistingSubdomains();

  // Discover from all sources
  const allSubdomains = new Set();
  const stats = {
    commonCrawlSubdomains: 0,
    waybackSubdomains: 0,
    serpApiSubdomains: 0,
    totalNewSubdomains: 0,
  };

  // Source 1: Common Crawl
  const ccSubdomains = await discoverFromCommonCrawl();
  stats.commonCrawlSubdomains = ccSubdomains.size;
  ccSubdomains.forEach(sub => allSubdomains.add(sub));

  // Source 2: Wayback Machine
  await sleep(CONFIG.WB_DELAY);
  const wbSubdomains = await discoverFromWayback();
  stats.waybackSubdomains = wbSubdomains.size;
  wbSubdomains.forEach(sub => allSubdomains.add(sub));

  // Source 3: SerpAPI Google Search
  const serpSubdomains = await discoverFromSerpAPI(options.max);
  stats.serpApiSubdomains = serpSubdomains.size;
  serpSubdomains.forEach(sub => allSubdomains.add(sub));

  console.log(`\n Discovery Summary:`);
  console.log(`  Common Crawl: ${stats.commonCrawlSubdomains} subdomains`);
  console.log(`  Wayback:      ${stats.waybackSubdomains} subdomains`);
  console.log(`  SerpAPI:      ${stats.serpApiSubdomains} subdomains`);
  console.log(`  Total unique: ${allSubdomains.size} subdomains`);

  // Filter out existing subdomains
  const newSubdomains = Array.from(allSubdomains).filter(sub => !existingSubdomains.has(sub));
  stats.totalNewSubdomains = newSubdomains.length;
  console.log(`  New subdomains: ${newSubdomains.length}`);

  // Save new subdomains
  await saveNewSubdomains(newSubdomains, 'hybrid', options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateDiscoveryState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`New subdomains discovered: ${newSubdomains.length}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('='.repeat(60));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const options = parseArgs();

  initFirebase();

  if (options.stats) {
    await showStats();
    process.exit(0);
  }

  if (options.reset) {
    await resetDiscoveryState();
    process.exit(0);
  }

  if (options.seed) {
    await seedFromFile(options.dryRun);
    process.exit(0);
  }

  if (options.discover) {
    await runDiscovery(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Usage:');
  console.log('  node scripts/three-url-discovery.js --discover              # Run full discovery');
  console.log('  node scripts/three-url-discovery.js --discover --max=200    # Limit SerpAPI searches');
  console.log('  node scripts/three-url-discovery.js --seed                  # Load subdomains from seed file');
  console.log('  node scripts/three-url-discovery.js --dry-run               # Preview only');
  console.log('  node scripts/three-url-discovery.js --stats                 # Show stats');
  console.log('  node scripts/three-url-discovery.js --reset                 # Reset discovery state');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
