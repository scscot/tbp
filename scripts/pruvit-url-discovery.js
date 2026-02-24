#!/usr/bin/env node
/**
 * Pruvit URL Discovery Script
 *
 * Discovers Pruvit referral codes using a hybrid approach:
 * 1. Common Crawl Index API (18 indexes, 2024-2026)
 * 2. Wayback Machine CDX API (historical URLs)
 * 3. Google Search via SerpAPI (multiple queries for shared links)
 * 4. Manual seed file (scripts/pruvit-seed-codes.txt)
 *
 * Pruvit URL format: https://pruvit.com/{locale}?ref={referralCode}
 * Examples:
 *   - https://pruvit.com/en-us?ref=karen
 *   - https://pruvit.com/en-us?ref=teamlift
 *
 * Usage:
 *   node scripts/pruvit-url-discovery.js --discover              # Run full discovery
 *   node scripts/pruvit-url-discovery.js --discover --max=200    # Limit SerpAPI searches
 *   node scripts/pruvit-url-discovery.js --seed                  # Load from seed file only
 *   node scripts/pruvit-url-discovery.js --seed --dry-run        # Preview seed import
 *   node scripts/pruvit-url-discovery.js --dry-run               # Preview only
 *   node scripts/pruvit-url-discovery.js --stats                 # Show stats
 *   node scripts/pruvit-url-discovery.js --reset                 # Reset discovery state
 *
 * Seed File: scripts/pruvit-seed-codes.txt
 *   - One referral code per line
 *   - Lines starting with # are comments
 *   - Useful for manually discovered codes (social media, YouTube, etc.)
 *
 * Sources:
 *   - Common Crawl Index API (no key required)
 *   - Wayback Machine CDX API (no key required)
 *   - SerpAPI Google Search (key from secrets/SerpAPI-Key)
 *   - Seed file (manual codes)
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
  DISCOVERED_COLLECTION: 'pruvit_discovered_refs',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'pruvit_discovery',

  // Pruvit URL patterns
  PRUVIT_DOMAIN: 'pruvit.com',
  URL_PATTERN: 'pruvit.com/*?ref=*',

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

  // SerpAPI - multiple queries to find referral links shared online
  SERPAPI_URL: 'https://serpapi.com/search',
  SERPAPI_QUERIES: [
    '"pruvit.com" "ref=" -site:pruvit.com',           // Links shared on external sites
    'pruvit keto promoter referral link',             // Promoters sharing links
    'pruvit distributor "my link" OR "my pruvit"',    // Distributors sharing
    '"pruvit.com/en-us?ref="',                        // Exact URL format
    'pruvit ketones order "ref="',                    // Purchase links shared
    'pruvit partner signup link',                     // Partner/signup mentions
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
 * Extract referral code from Pruvit URL
 * Handles various URL formats:
 *   - https://pruvit.com/en-us?ref=karen
 *   - https://pruvit.com/en-us/?ref=teamlift
 *   - https://www.pruvit.com/en-us?ref=john
 */
function extractReferralCode(url) {
  try {
    const parsed = new URL(url);

    // Check if it's a pruvit.com domain
    if (!parsed.hostname.includes('pruvit.com')) {
      return null;
    }

    // Extract ref parameter
    const ref = parsed.searchParams.get('ref');
    if (!ref) return null;

    // Validate referral code (alphanumeric, underscores, hyphens, 2-50 chars)
    const normalized = ref.toLowerCase().trim();
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
    max: Infinity,  // No limit by default - discover all available codes
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

const SEED_FILE_PATH = path.join(__dirname, 'pruvit-seed-codes.txt');

/**
 * Load referral codes from seed file
 * Format: one code per line, lines starting with # are comments
 */
async function loadSeedCodes() {
  const codes = new Set();

  if (!fs.existsSync(SEED_FILE_PATH)) {
    console.log(`  Seed file not found: ${SEED_FILE_PATH}`);
    return codes;
  }

  const content = fs.readFileSync(SEED_FILE_PATH, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Validate code format
    const normalized = trimmed.toLowerCase();
    if (/^[a-z0-9_-]{2,50}$/i.test(normalized)) {
      codes.add(normalized);
    }
  }

  return codes;
}

async function seedFromFile(dryRun) {
  console.log('\n🌱 Loading from seed file...');

  const seedCodes = await loadSeedCodes();
  console.log(`  Found ${seedCodes.size} codes in seed file`);

  if (seedCodes.size === 0) {
    console.log('  No codes to seed');
    return 0;
  }

  // Load existing codes
  const existingCodes = await loadExistingCodes();

  // Filter out existing codes
  const newCodes = Array.from(seedCodes).filter(code => !existingCodes.has(code));
  console.log(`  New codes: ${newCodes.length}`);

  // Save new codes
  const saved = await saveNewCodes(newCodes, 'seed', dryRun);
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
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Pruvit-Discovery/1.0)',
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
  const referralCodes = new Set();
  console.log('\n📡 Discovering from Common Crawl...');

  if (circuitBreaker.isOpen) {
    console.log('  Circuit breaker OPEN — skipping Common Crawl');
    return referralCodes;
  }

  for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
    console.log(`  Querying ${indexName}...`);
    const { urls, error } = await queryCommonCrawlIndex(indexName, CONFIG.URL_PATTERN);

    // Extract referral codes
    for (const url of urls) {
      const code = extractReferralCode(url);
      if (code) {
        referralCodes.add(code);
      }
    }

    console.log(`    Found ${urls.length} URLs → ${referralCodes.size} unique codes so far`);

    // Circuit breaker tracking
    if (error) {
      circuitBreaker.consecutiveFailures++;
      if (circuitBreaker.consecutiveFailures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreaker.tripCount++;
        if (circuitBreaker.tripCount >= CONFIG.MAX_CIRCUIT_TRIPS) {
          console.log(`    ⚠️ Circuit breaker OPEN — Common Crawl appears down`);
          circuitBreaker.isOpen = true;
          break;
        }
        console.log(`    ⚠️ Circuit breaker tripped — pausing ${CONFIG.CIRCUIT_BREAKER_PAUSE / 1000}s...`);
        circuitBreaker.consecutiveFailures = 0;
        await sleep(CONFIG.CIRCUIT_BREAKER_PAUSE);
      }
    } else {
      circuitBreaker.consecutiveFailures = 0;
    }

    await sleep(CONFIG.CC_DELAY);
  }

  console.log(`  Common Crawl total: ${referralCodes.size} unique referral codes`);
  return referralCodes;
}

// ============================================================================
// WAYBACK MACHINE DISCOVERY
// ============================================================================

async function discoverFromWayback() {
  const referralCodes = new Set();
  console.log('\n🕰️ Discovering from Wayback Machine...');

  const queryUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(CONFIG.URL_PATTERN)}&output=json&fl=original&collapse=urlkey&limit=10000`;

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Pruvit-Discovery/1.0)',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('  Wayback: No results');
        return referralCodes;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // CDX JSON: first row is headers, rest are data
    if (Array.isArray(data) && data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const url = data[i][0];
        const code = extractReferralCode(url);
        if (code) {
          referralCodes.add(code);
        }
      }
    }

    console.log(`  Wayback total: ${referralCodes.size} unique referral codes`);
  } catch (error) {
    console.log(`  Wayback error: ${error.message}`);
  }

  return referralCodes;
}

// ============================================================================
// SERPAPI GOOGLE SEARCH DISCOVERY
// ============================================================================

async function discoverFromSerpAPI(maxSearches) {
  const referralCodes = new Set();
  console.log('\n🔍 Discovering from Google Search (SerpAPI)...');

  if (!SERPAPI_KEY) {
    console.log('  Skipping: SerpAPI key not found');
    return referralCodes;
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

        let pageCodesFound = 0;
        for (const result of results) {
          // Check the link itself
          let code = extractReferralCode(result.link);
          if (code) {
            referralCodes.add(code);
            pageCodesFound++;
          }

          // Also check snippet for referral links
          if (result.snippet) {
            const urlMatches = result.snippet.match(/pruvit\.com[^\s]*ref=([a-zA-Z0-9_-]+)/gi);
            if (urlMatches) {
              for (const match of urlMatches) {
                const snippetCode = match.match(/ref=([a-zA-Z0-9_-]+)/i);
                if (snippetCode && snippetCode[1]) {
                  referralCodes.add(snippetCode[1].toLowerCase());
                  pageCodesFound++;
                }
              }
            }
          }
        }

        console.log(`      ${results.length} results → ${pageCodesFound} codes (${referralCodes.size} total unique)`);

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

  console.log(`\n  SerpAPI total: ${referralCodes.size} unique referral codes`);
  return referralCodes;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

async function loadExistingCodes() {
  console.log('\n📂 Loading existing referral codes from Firestore...');

  const existingCodes = new Set();
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .select('referralCode')
    .get();

  snapshot.forEach(doc => {
    const code = doc.data().referralCode;
    if (code) {
      existingCodes.add(code.toLowerCase());
    }
  });

  console.log(`  Found ${existingCodes.size} existing codes`);
  return existingCodes;
}

async function saveNewCodes(codes, source, dryRun) {
  if (codes.length === 0) {
    console.log('  No new codes to save');
    return 0;
  }

  console.log(`\n💾 Saving ${codes.length} new referral codes...`);

  if (dryRun) {
    console.log('  DRY RUN - Would save:');
    codes.slice(0, 10).forEach(code => console.log(`    ${code}`));
    if (codes.length > 10) {
      console.log(`    ... and ${codes.length - 10} more`);
    }
    return 0;
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalSaved = 0;

  for (const code of codes) {
    const docRef = db.collection(CONFIG.DISCOVERED_COLLECTION).doc();

    batch.set(docRef, {
      referralCode: code,
      source: source,
      discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      scraped: false,
      scrapedAt: null,
    });

    batchCount++;
    totalSaved++;

    if (batchCount >= 500) {
      await batch.commit();
      console.log(`    Committed batch of ${batchCount} codes (total: ${totalSaved})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`    Committed final batch of ${batchCount} codes (total: ${totalSaved})`);
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
  console.log('🔄 Resetting discovery state...');

  // Delete all discovered refs
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Deleted ${count} documents...`);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  // Reset state
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).delete();

  console.log(`  Deleted ${count} discovered refs`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n📊 Pruvit Discovery Stats\n');

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

  console.log('Discovered Referral Codes:');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scrapedCount}`);
  console.log(`  Pending:  ${pendingCount}`);

  if (state.lastDiscoveryAt) {
    console.log(`\nLast Discovery: ${state.lastDiscoveryAt.toDate().toISOString()}`);
  }

  if (state.commonCrawlCodes !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Common Crawl: ${state.commonCrawlCodes} codes`);
    console.log(`  Wayback:      ${state.waybackCodes} codes`);
    console.log(`  SerpAPI:      ${state.serpApiCodes} codes`);
    console.log(`  Total New:    ${state.totalNewCodes} codes`);
  }

  // Show sample codes
  console.log('\nSample referral codes (first 10):');
  const sampleSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .orderBy('discoveredAt', 'desc')
    .limit(10)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`  ${data.referralCode} (${data.source})`);
  });
}

// ============================================================================
// MAIN DISCOVERY FLOW
// ============================================================================

async function runDiscovery(options) {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('PRUVIT URL DISCOVERY');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max SerpAPI searches: ${options.max === Infinity ? 'unlimited' : options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Load existing codes
  const existingCodes = await loadExistingCodes();

  // Discover from all sources
  const allCodes = new Set();
  const stats = {
    commonCrawlCodes: 0,
    waybackCodes: 0,
    serpApiCodes: 0,
    totalNewCodes: 0,
  };

  // Source 1: Common Crawl
  const ccCodes = await discoverFromCommonCrawl();
  stats.commonCrawlCodes = ccCodes.size;
  ccCodes.forEach(code => allCodes.add(code));

  // Source 2: Wayback Machine
  await sleep(CONFIG.WB_DELAY);
  const wbCodes = await discoverFromWayback();
  stats.waybackCodes = wbCodes.size;
  wbCodes.forEach(code => allCodes.add(code));

  // Source 3: SerpAPI Google Search
  const serpCodes = await discoverFromSerpAPI(options.max);
  stats.serpApiCodes = serpCodes.size;
  serpCodes.forEach(code => allCodes.add(code));

  console.log(`\n📊 Discovery Summary:`);
  console.log(`  Common Crawl: ${stats.commonCrawlCodes} codes`);
  console.log(`  Wayback:      ${stats.waybackCodes} codes`);
  console.log(`  SerpAPI:      ${stats.serpApiCodes} codes`);
  console.log(`  Total unique: ${allCodes.size} codes`);

  // Filter out existing codes
  const newCodes = Array.from(allCodes).filter(code => !existingCodes.has(code));
  stats.totalNewCodes = newCodes.length;
  console.log(`  New codes:    ${newCodes.length}`);

  // Save new codes
  await saveNewCodes(newCodes, 'hybrid', options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateDiscoveryState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`New codes discovered: ${newCodes.length}`);
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
  console.log('  node scripts/pruvit-url-discovery.js --discover              # Run full discovery');
  console.log('  node scripts/pruvit-url-discovery.js --discover --max=200    # Limit SerpAPI searches');
  console.log('  node scripts/pruvit-url-discovery.js --seed                  # Load codes from seed file');
  console.log('  node scripts/pruvit-url-discovery.js --dry-run               # Preview only');
  console.log('  node scripts/pruvit-url-discovery.js --stats                 # Show stats');
  console.log('  node scripts/pruvit-url-discovery.js --reset                 # Reset discovery state');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
