#!/usr/bin/env node
/**
 * Farmasius URL Discovery Script
 *
 * Discovers Farmasius representative usernames using a hybrid approach:
 * 1. Common Crawl Index API (18 indexes, 2024-2026)
 * 2. Wayback Machine CDX API (historical URLs)
 * 3. Google Search via SerpAPI (multiple queries for shared links)
 * 4. Manual seed file (scripts/farmasius-seed-usernames.txt)
 *
 * Farmasius URL format: https://www.farmasius.com/{username}
 * Examples:
 *   - https://www.farmasius.com/boss1
 *   - https://www.farmasius.com/daniellebaker
 *
 * Usage:
 *   node scripts/farmasius-url-discovery.js --discover              # Run full discovery
 *   node scripts/farmasius-url-discovery.js --discover --max=200    # Limit SerpAPI searches
 *   node scripts/farmasius-url-discovery.js --seed                  # Load from seed file only
 *   node scripts/farmasius-url-discovery.js --seed --dry-run        # Preview seed import
 *   node scripts/farmasius-url-discovery.js --dry-run               # Preview only
 *   node scripts/farmasius-url-discovery.js --stats                 # Show stats
 *   node scripts/farmasius-url-discovery.js --reset                 # Reset discovery state
 *
 * Seed File: scripts/farmasius-seed-usernames.txt
 *   - One username per line
 *   - Lines starting with # are comments
 *   - Useful for manually discovered usernames (social media, YouTube, etc.)
 *
 * Sources:
 *   - Common Crawl Index API (no key required)
 *   - Wayback Machine CDX API (no key required)
 *   - SerpAPI Google Search (key from secrets/SerpAPI-Key)
 *   - Seed file (manual usernames)
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

// Excluded paths (non-user pages on farmasius.com)
const EXCLUDED_PATHS = [
  // Core site pages
  'about', 'contact', 'products', 'login', 'signup', 'cart', 'checkout',
  'privacy', 'terms', 'faq', 'blog', 'news', 'support', 'help', 'api',
  'admin', 'shop', 'store', 'order', 'account', 'register', 'home',

  // Product/catalog pages
  'category', 'categories', 'collections', 'pages', 'product', 'product-listing',
  'product-details', 'catalog', 'item', 'items', 'listing', 'listings',
  'skincare', 'makeup', 'fragrance', 'personal-care', 'wellness',

  // Policy pages
  'refund-policy', 'return-policy', 'shipping-policy',
  'privacy-policy', 'terms-of-service', 'terms-and-conditions', 'legal',
  'disclaimer', 'compliance', 'policies',

  // Static assets
  'assets', 'cdn', 'static', 'images', 'css', 'js', 'fonts', 'media',
  'uploads', 'downloads', 'files', 'resources',

  // Auth/system pages
  'search', 'reset', 'forgot', 'password', 'verify', 'confirm',
  'unsubscribe', 'subscribe', 'newsletter', 'sitemap', 'robots',
  'favicon', 'manifest', 'service-worker', 'sw', 'workbox',
  'logout', 'signout', 'signin', 'auth', 'oauth', 'callback',

  // E-commerce pages
  'wishlist', 'favorites', 'compare', 'reviews', 'ratings',
  'payment', 'billing', 'invoice', 'receipt', 'transaction',

  // Company/business pages
  'careers', 'jobs', 'press', 'partners', 'affiliates', 'investors',
  'team', 'company', 'corporate', 'business', 'wholesale',
  'opportunity', 'join', 'become', 'enroll', 'enrollment',

  // Farmasi-specific pages
  'influencer', 'fi', 'beauty-influencer', 'become-influencer',
  'rewards', 'compensation', 'hostess', 'host', 'party',
];

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'farmasius_discovered_users',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'farmasius_discovery',

  // Farmasius URL patterns
  FARMASIUS_DOMAIN: 'farmasius.com',
  URL_PATTERN: 'farmasius.com/*',

  // Common Crawl indexes (same as MPG - 18 indexes from 2024-2026)
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
    'site:farmasius.com -inurl:products -inurl:shop -inurl:about -inurl:category',
    '"farmasius.com" influencer OR representative OR consultant',
    'farmasi beauty influencer "my link"',
    '"farmasius.com/" skincare beauty',
    'farmasi US independent beauty influencer',
    '"shop with me" farmasi farmasius.com',
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
 * Extract username from Farmasius URL
 *
 * ONLY accepts single-path URLs (representative pages):
 *   https://www.farmasius.com/daniellebaker
 *   https://farmasius.com/boss1
 *   https://www.farmasius.com/john/  (trailing slash OK)
 *
 * REJECTS multi-path URLs (site pages):
 *   https://www.farmasius.com/products/skincare
 *   https://www.farmasius.com/category/makeup
 */
function extractUsername(url) {
  try {
    const parsed = new URL(url);

    // Check if it's a farmasius.com domain
    if (!parsed.hostname.includes('farmasius.com')) {
      return null;
    }

    // Get path segments (filter out empty strings from leading/trailing slashes)
    const pathParts = parsed.pathname.split('/').filter(p => p.length > 0);

    // ONLY accept single-path URLs (e.g., /daniellebaker, not /products/skincare)
    if (pathParts.length !== 1) {
      return null;
    }

    const pathSegment = pathParts[0];

    // Skip known non-user paths
    if (EXCLUDED_PATHS.includes(pathSegment.toLowerCase())) {
      return null;
    }

    // Validate username format (alphanumeric, underscores, hyphens, 2-50 chars)
    const normalized = pathSegment.toLowerCase().trim();
    if (!/^[a-z0-9_-]{2,50}$/i.test(normalized)) {
      return null;
    }

    return normalized;
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
    max: Infinity,  // No limit by default - discover all available usernames
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

const SEED_FILE_PATH = path.join(__dirname, 'farmasius-seed-usernames.txt');

/**
 * Load usernames from seed file
 * Format: one username per line, lines starting with # are comments
 */
async function loadSeedUsernames() {
  const usernames = new Set();

  if (!fs.existsSync(SEED_FILE_PATH)) {
    console.log(`  Seed file not found: ${SEED_FILE_PATH}`);
    return usernames;
  }

  const content = fs.readFileSync(SEED_FILE_PATH, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Validate username format
    const normalized = trimmed.toLowerCase();
    if (/^[a-z0-9_-]{2,50}$/i.test(normalized)) {
      usernames.add(normalized);
    }
  }

  return usernames;
}

async function seedFromFile(dryRun) {
  console.log('\n Loading from seed file...');

  const seedUsernames = await loadSeedUsernames();
  console.log(`  Found ${seedUsernames.size} usernames in seed file`);

  if (seedUsernames.size === 0) {
    console.log('  No usernames to seed');
    return 0;
  }

  // Load existing usernames
  const existingUsernames = await loadExistingUsernames();

  // Filter out existing usernames
  const newUsernames = Array.from(seedUsernames).filter(u => !existingUsernames.has(u));
  console.log(`  New usernames: ${newUsernames.length}`);

  // Save new usernames
  const saved = await saveNewUsernames(newUsernames, 'seed', dryRun);
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
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Farmasius-Discovery/1.0)',
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
  const usernames = new Set();
  console.log('\n Discovering from Common Crawl...');

  if (circuitBreaker.isOpen) {
    console.log('  Circuit breaker OPEN - skipping Common Crawl');
    return usernames;
  }

  for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
    console.log(`  Querying ${indexName}...`);
    const { urls, error } = await queryCommonCrawlIndex(indexName, CONFIG.URL_PATTERN);

    // Extract usernames
    for (const url of urls) {
      const username = extractUsername(url);
      if (username) {
        usernames.add(username);
      }
    }

    console.log(`    Found ${urls.length} URLs -> ${usernames.size} unique usernames so far`);

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

  console.log(`  Common Crawl total: ${usernames.size} unique usernames`);
  return usernames;
}

// ============================================================================
// WAYBACK MACHINE DISCOVERY
// ============================================================================

async function discoverFromWayback() {
  const usernames = new Set();
  console.log('\n Discovering from Wayback Machine...');

  const queryUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(CONFIG.URL_PATTERN)}&output=json&fl=original&collapse=urlkey&limit=10000`;

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Farmasius-Discovery/1.0)',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('  Wayback: No results');
        return usernames;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // CDX JSON: first row is headers, rest are data
    if (Array.isArray(data) && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const url = data[i][0];
        const username = extractUsername(url);
        if (username) {
          usernames.add(username);
        }
      }
    }

    console.log(`  Wayback total: ${usernames.size} unique usernames`);
  } catch (error) {
    console.log(`  Wayback error: ${error.message}`);
  }

  return usernames;
}

// ============================================================================
// SERPAPI GOOGLE SEARCH DISCOVERY
// ============================================================================

async function discoverFromSerpAPI(maxSearches) {
  const usernames = new Set();
  console.log('\n Discovering from Google Search (SerpAPI)...');

  if (!SERPAPI_KEY) {
    console.log('  Skipping: SerpAPI key not found');
    return usernames;
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

        let pageUsernamesFound = 0;
        for (const result of results) {
          // Check the link itself
          const username = extractUsername(result.link);
          if (username) {
            usernames.add(username);
            pageUsernamesFound++;
          }

          // Also check snippet for farmasius.com links
          if (result.snippet) {
            const urlMatches = result.snippet.match(/farmasius\.com\/([a-zA-Z0-9_-]+)/gi);
            if (urlMatches) {
              for (const match of urlMatches) {
                const usernameMatch = match.match(/farmasius\.com\/([a-zA-Z0-9_-]+)/i);
                if (usernameMatch && usernameMatch[1]) {
                  const extractedUsername = usernameMatch[1].toLowerCase();
                  if (!EXCLUDED_PATHS.includes(extractedUsername) && extractedUsername.length >= 2) {
                    usernames.add(extractedUsername);
                    pageUsernamesFound++;
                  }
                }
              }
            }
          }
        }

        console.log(`      ${results.length} results -> ${pageUsernamesFound} usernames (${usernames.size} total unique)`);

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

  console.log(`\n  SerpAPI total: ${usernames.size} unique usernames`);
  return usernames;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function loadExistingUsernames() {
  console.log('\n Loading existing usernames from Firestore...');

  const existingUsernames = new Set();
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .select('username')
    .get();

  snapshot.forEach(doc => {
    const username = doc.data().username;
    if (username) {
      existingUsernames.add(username.toLowerCase());
    }
  });

  console.log(`  Found ${existingUsernames.size} existing usernames`);
  return existingUsernames;
}

async function saveNewUsernames(usernames, source, dryRun) {
  if (usernames.length === 0) {
    console.log('  No new usernames to save');
    return 0;
  }

  console.log(`\n Saving ${usernames.length} new usernames...`);

  if (dryRun) {
    console.log('  DRY RUN - Would save:');
    usernames.slice(0, 10).forEach(username => console.log(`    ${username}`));
    if (usernames.length > 10) {
      console.log(`    ... and ${usernames.length - 10} more`);
    }
    return 0;
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalSaved = 0;

  for (const username of usernames) {
    const docRef = db.collection(CONFIG.DISCOVERED_COLLECTION).doc();

    batch.set(docRef, {
      username: username,
      source: source,
      discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      scraped: false,
      scrapedAt: null,
    });

    batchCount++;
    totalSaved++;

    if (batchCount >= 500) {
      await batch.commit();
      console.log(`    Committed batch of ${batchCount} usernames (total: ${totalSaved})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`    Committed final batch of ${batchCount} usernames (total: ${totalSaved})`);
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
  console.log('Resetting discovery state...');

  // Delete all discovered users
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

  console.log(`  Deleted ${count} discovered users`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n Farmasius Discovery Stats\n');

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

  console.log('Discovered Usernames:');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scrapedCount}`);
  console.log(`  Pending:  ${pendingCount}`);

  if (state.lastDiscoveryAt) {
    console.log(`\nLast Discovery: ${state.lastDiscoveryAt.toDate().toISOString()}`);
  }

  if (state.commonCrawlUsernames !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Common Crawl: ${state.commonCrawlUsernames} usernames`);
    console.log(`  Wayback:      ${state.waybackUsernames} usernames`);
    console.log(`  SerpAPI:      ${state.serpApiUsernames} usernames`);
    console.log(`  Total New:    ${state.totalNewUsernames} usernames`);
  }

  // Show sample usernames
  console.log('\nSample usernames (first 10):');
  const sampleSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .orderBy('discoveredAt', 'desc')
    .limit(10)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.username} (${data.source})`);
  });
}

// ============================================================================
// MAIN DISCOVERY FLOW
// ============================================================================

async function runDiscovery(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('FARMASIUS URL DISCOVERY');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max SerpAPI searches: ${options.max === Infinity ? 'unlimited' : options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Load existing usernames
  const existingUsernames = await loadExistingUsernames();

  // Discover from all sources
  const allUsernames = new Set();
  const stats = {
    commonCrawlUsernames: 0,
    waybackUsernames: 0,
    serpApiUsernames: 0,
    totalNewUsernames: 0,
  };

  // Source 1: Common Crawl
  const ccUsernames = await discoverFromCommonCrawl();
  stats.commonCrawlUsernames = ccUsernames.size;
  ccUsernames.forEach(u => allUsernames.add(u));

  // Source 2: Wayback Machine
  await sleep(CONFIG.WB_DELAY);
  const wbUsernames = await discoverFromWayback();
  stats.waybackUsernames = wbUsernames.size;
  wbUsernames.forEach(u => allUsernames.add(u));

  // Source 3: SerpAPI Google Search
  const serpUsernames = await discoverFromSerpAPI(options.max);
  stats.serpApiUsernames = serpUsernames.size;
  serpUsernames.forEach(u => allUsernames.add(u));

  console.log(`\n Discovery Summary:`);
  console.log(`  Common Crawl: ${stats.commonCrawlUsernames} usernames`);
  console.log(`  Wayback:      ${stats.waybackUsernames} usernames`);
  console.log(`  SerpAPI:      ${stats.serpApiUsernames} usernames`);
  console.log(`  Total unique: ${allUsernames.size} usernames`);

  // Filter out existing usernames
  const newUsernames = Array.from(allUsernames).filter(u => !existingUsernames.has(u));
  stats.totalNewUsernames = newUsernames.length;
  console.log(`  New usernames: ${newUsernames.length}`);

  // Save new usernames
  await saveNewUsernames(newUsernames, 'hybrid', options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateDiscoveryState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`New usernames discovered: ${newUsernames.length}`);
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
  console.log('  node scripts/farmasius-url-discovery.js --discover              # Run full discovery');
  console.log('  node scripts/farmasius-url-discovery.js --discover --max=200    # Limit SerpAPI searches');
  console.log('  node scripts/farmasius-url-discovery.js --seed                  # Load usernames from seed file');
  console.log('  node scripts/farmasius-url-discovery.js --dry-run               # Preview only');
  console.log('  node scripts/farmasius-url-discovery.js --stats                 # Show stats');
  console.log('  node scripts/farmasius-url-discovery.js --reset                 # Reset discovery state');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
