#!/usr/bin/env node
/**
 * Farmasi URL Discovery Script (Multi-Domain)
 *
 * Discovers Farmasi representative usernames across ALL Farmasi country domains:
 * - USA: farmasius.com
 * - International: farmasi.de, farmasi.es, farmasi.co.uk, farmasi.pt, etc.
 *
 * Discovery sources (hybrid approach):
 * 1. Common Crawl Index API (18 indexes, 2024-2026)
 * 2. Wayback Machine CDX API (historical URLs)
 * 3. Google Search via SerpAPI (multiple queries for shared links)
 * 4. Manual seed file (scripts/farmasius-seed-usernames.txt)
 *
 * URL formats:
 *   - USA: https://www.farmasius.com/{username}
 *   - International: https://farmasi.de/{username}, https://farmasi.co.uk/{username}, etc.
 *
 * NOTE: US domain (farmasius.com) is SKIPPED by default because all 1,311 US
 * usernames have already been scraped. Use --domain=us to explicitly include it.
 *
 * Usage:
 *   node scripts/farmasius-url-discovery.js --discover              # Run discovery (international only, US skipped)
 *   node scripts/farmasius-url-discovery.js --discover --domain=us  # USA only (farmasius.com)
 *   node scripts/farmasius-url-discovery.js --discover --domain=de  # Germany only
 *   node scripts/farmasius-url-discovery.js --discover --max=200    # Limit SerpAPI searches
 *   node scripts/farmasius-url-discovery.js --seed                  # Load from seed file only
 *   node scripts/farmasius-url-discovery.js --seed --dry-run        # Preview seed import
 *   node scripts/farmasius-url-discovery.js --dry-run               # Preview only
 *   node scripts/farmasius-url-discovery.js --stats                 # Show stats
 *   node scripts/farmasius-url-discovery.js --reset                 # Reset discovery state
 *
 * Seed File: scripts/farmasius-seed-usernames.txt
 *   - Format: username or domain:username (e.g., "boss1" or "de:hannamuller")
 *   - Lines starting with # are comments
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

// ============================================================================
// FARMASI INTERNATIONAL DOMAINS
// ============================================================================

/**
 * All Farmasi country domains with their configurations
 * Key = country code (used in Firestore), Value = domain configuration
 */
const FARMASI_DOMAINS = {
  // USA (primary - farmasius.com)
  us: {
    domain: 'farmasius.com',
    country: 'United States',
    language: 'en',
    priority: 1,  // Higher = process first
  },
  // Western Europe (high priority - have email templates)
  uk: {
    domain: 'farmasi.co.uk',
    country: 'United Kingdom',
    language: 'en',
    priority: 2,
  },
  de: {
    domain: 'farmasi.de',
    country: 'Germany',
    language: 'de',
    priority: 2,
  },
  es: {
    domain: 'farmasi.es',
    country: 'Spain',
    language: 'es',
    priority: 2,
  },
  pt: {
    domain: 'farmasi.pt',
    country: 'Portugal',
    language: 'pt',
    priority: 2,
  },
  ie: {
    domain: 'farmasi.ie',
    country: 'Ireland',
    language: 'en',
    priority: 2,
  },
  fr: {
    domain: 'fr.farmasi.com',
    country: 'France',
    language: 'fr',  // No French template yet - will use EN
    priority: 3,
  },
  it: {
    domain: 'it.farmasi.com',
    country: 'Italy',
    language: 'it',  // No Italian template yet - will use EN
    priority: 3,
  },
  // Eastern Europe
  pl: {
    domain: 'farmasi.pl',
    country: 'Poland',
    language: 'pl',
    priority: 3,
  },
  ro: {
    domain: 'farmasi.ro',
    country: 'Romania',
    language: 'ro',
    priority: 3,
  },
  ua: {
    domain: 'farmasi.ua',
    country: 'Ukraine',
    language: 'uk',
    priority: 3,
  },
  hu: {
    domain: 'farmasi.hu',
    country: 'Hungary',
    language: 'hu',
    priority: 3,
  },
  cz: {
    domain: 'farmasi.cz',
    country: 'Czech Republic',
    language: 'cs',
    priority: 3,
  },
  sk: {
    domain: 'farmasi.sk',
    country: 'Slovakia',
    language: 'sk',
    priority: 3,
  },
  // Balkans
  hr: {
    domain: 'farmasi.hr',
    country: 'Croatia',
    language: 'hr',
    priority: 4,
  },
  si: {
    domain: 'farmasi.si',
    country: 'Slovenia',
    language: 'sl',
    priority: 4,
  },
  rs: {
    domain: 'farmasi.rs',
    country: 'Serbia',
    language: 'sr',
    priority: 4,
  },
  ba: {
    domain: 'farmasi.ba',
    country: 'Bosnia and Herzegovina',
    language: 'bs',
    priority: 4,
  },
  mk: {
    domain: 'farmasi.mk',
    country: 'North Macedonia',
    language: 'mk',
    priority: 4,
  },
  me: {
    domain: 'farmasi.co.me',
    country: 'Montenegro',
    language: 'sr',
    priority: 4,
  },
  al: {
    domain: 'farmasi.al',
    country: 'Albania',
    language: 'sq',
    priority: 4,
  },
  xk: {
    domain: 'farmasi.com.al',  // Kosovo uses .com.al
    country: 'Kosovo',
    language: 'sq',
    priority: 4,
  },
  // Other regions
  tr: {
    domain: 'farmasi.com.tr',
    country: 'Turkey',
    language: 'tr',
    priority: 3,
  },
  ge: {
    domain: 'farmasi.ge',
    country: 'Georgia',
    language: 'ka',
    priority: 4,
  },
  by: {
    domain: 'farmasi.by',
    country: 'Belarus',
    language: 'be',
    priority: 4,
  },
  md: {
    domain: 'farmasi.md',
    country: 'Moldova',
    language: 'ro',
    priority: 4,
  },
  cy: {
    domain: 'farmasi.com.cy',
    country: 'Cyprus',
    language: 'el',
    priority: 4,
  },
};

/**
 * Get country code from a Farmasi domain
 */
function getCountryCodeFromDomain(domain) {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  for (const [code, config] of Object.entries(FARMASI_DOMAINS)) {
    if (normalized === config.domain || normalized === `www.${config.domain}`) {
      return code;
    }
  }
  return null;
}

/**
 * Get all domains to process, optionally filtered by country code
 *
 * NOTE: US (farmasius.com) is SKIPPED by default because all 1,311 US usernames
 * have already been scraped. Use --domain=us to explicitly include it.
 */
function getDomainsToProcess(filterCode = null) {
  // Allow explicit single-domain selection (including US)
  if (filterCode && filterCode !== 'all') {
    const config = FARMASI_DOMAINS[filterCode];
    if (config) {
      return [{ code: filterCode, ...config }];
    }
    console.log(`  Warning: Unknown domain code "${filterCode}", processing international domains`);
  }

  // Return all domains EXCEPT US (US is complete with 1,311 usernames)
  // Sorted by priority (lowest number first = highest priority)
  return Object.entries(FARMASI_DOMAINS)
    .filter(([code]) => code !== 'us')  // Skip US - already complete
    .map(([code, config]) => ({ code, ...config }))
    .sort((a, b) => a.priority - b.priority);
}

// Excluded paths (non-user pages on Farmasi sites)
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
  'customer-login', 'customer-register', 'default',

  // Technical/system paths (discovered via Wayback)
  'app_code', 'app_data', 'app_webreferences', 'bin', 'obj',
  'node_modules', 'vendor', 'packages', 'lib', 'dist', 'build',

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
  'girisimci-ol', 'farmasi', 'girisim',  // Turkish join pages & generic brand page
];

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'farmasius_discovered_users',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'farmasius_discovery',

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
  // Base queries (domain placeholders will be filled dynamically)
  SERPAPI_BASE_QUERIES: [
    'site:{domain} -inurl:products -inurl:shop -inurl:about -inurl:category',
    '"{domain}" influencer OR representative OR consultant',
    '"{domain}/" skincare beauty',
  ],
  // Domain-specific queries for farmasius.com (US)
  SERPAPI_US_QUERIES: [
    'farmasi beauty influencer "my link"',
    'farmasi US independent beauty influencer',
    '"shop with me" farmasi farmasius.com',
  ],
  SERPAPI_MAX_PAGES: 3,  // Max pages per query (10 results per page) - reduced for multi-domain

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
 * Extract username and domain info from a Farmasi URL
 *
 * Supports ALL Farmasi domains:
 *   - https://www.farmasius.com/daniellebaker (USA)
 *   - https://farmasi.de/hannamuller (Germany)
 *   - https://farmasi.co.uk/aliceadams (UK)
 *
 * ONLY accepts single-path URLs (representative pages).
 * REJECTS multi-path URLs (e.g., /products/skincare).
 *
 * @returns {object|null} { username, countryCode, domain } or null if invalid
 */
function extractUsernameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Check if it's any Farmasi domain
    const countryCode = getCountryCodeFromDomain(hostname);
    if (!countryCode) {
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

    return {
      username: normalized,
      countryCode,
      domain: FARMASI_DOMAINS[countryCode].domain,
    };
  } catch {
    return null;
  }
}

/**
 * Legacy wrapper for backward compatibility - returns just the username
 */
function extractUsername(url) {
  const result = extractUsernameFromUrl(url);
  return result ? result.username : null;
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
    domain: 'all',  // 'all' or specific country code (us, de, uk, etc.)
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
    if (arg.startsWith('--domain=')) {
      options.domain = arg.split('=')[1].toLowerCase();
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
 * Supports optional country code prefix: "de:hannamuller" or just "boss1" (defaults to us)
 */
async function loadSeedUsernames() {
  const items = new Map();  // key = "countryCode:username", value = { username, countryCode, domain }

  if (!fs.existsSync(SEED_FILE_PATH)) {
    console.log(`  Seed file not found: ${SEED_FILE_PATH}`);
    return items;
  }

  const content = fs.readFileSync(SEED_FILE_PATH, 'utf8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    let countryCode = 'us';
    let username = trimmed;

    // Check for country code prefix (e.g., "de:hannamuller")
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const potentialCode = parts[0].toLowerCase();
      if (FARMASI_DOMAINS[potentialCode]) {
        countryCode = potentialCode;
        username = parts.slice(1).join(':');
      }
    }

    // Validate username format
    const normalized = username.toLowerCase();
    if (/^[a-z0-9_-]{2,50}$/i.test(normalized)) {
      const key = `${countryCode}:${normalized}`;
      const domainConfig = FARMASI_DOMAINS[countryCode];
      items.set(key, {
        username: normalized,
        countryCode,
        domain: domainConfig.domain,
      });
    }
  }

  return items;
}

async function seedFromFile(dryRun) {
  console.log('\n Loading from seed file...');

  const seedItems = await loadSeedUsernames();
  console.log(`  Found ${seedItems.size} usernames in seed file`);

  if (seedItems.size === 0) {
    console.log('  No usernames to seed');
    return 0;
  }

  // Load existing usernames
  const existingKeys = await loadExistingUsernames();

  // Filter out existing usernames
  const newItems = new Map();
  for (const [key, value] of seedItems) {
    if (!existingKeys.has(key)) {
      newItems.set(key, value);
    }
  }
  console.log(`  New usernames: ${newItems.size}`);

  // Save new usernames
  const saved = await saveNewUsernames(newItems, 'seed', dryRun);
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

/**
 * Discover usernames from Common Crawl across all specified domains
 * @param {Array} domains - Array of domain configs to search
 * @returns {Map} Map of "countryCode:username" -> { username, countryCode, domain }
 */
async function discoverFromCommonCrawl(domains) {
  const discovered = new Map();  // key = "countryCode:username", value = { username, countryCode, domain }
  console.log('\n Discovering from Common Crawl...');
  console.log(`  Searching ${domains.length} domain(s): ${domains.map(d => d.domain).join(', ')}`);

  if (circuitBreaker.isOpen) {
    console.log('  Circuit breaker OPEN - skipping Common Crawl');
    return discovered;
  }

  for (const domainConfig of domains) {
    console.log(`\n  Domain: ${domainConfig.domain} (${domainConfig.country})`);
    const urlPattern = `${domainConfig.domain}/*`;
    let domainUsernames = 0;

    for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
      if (circuitBreaker.isOpen) break;

      console.log(`    Querying ${indexName}...`);
      const { urls, error } = await queryCommonCrawlIndex(indexName, urlPattern);

      // Extract usernames
      for (const url of urls) {
        const result = extractUsernameFromUrl(url);
        if (result) {
          const key = `${result.countryCode}:${result.username}`;
          if (!discovered.has(key)) {
            discovered.set(key, result);
            domainUsernames++;
          }
        }
      }

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

    console.log(`    ${domainConfig.domain}: ${domainUsernames} unique usernames`);
  }

  console.log(`\n  Common Crawl total: ${discovered.size} unique usernames across all domains`);
  return discovered;
}

// ============================================================================
// WAYBACK MACHINE DISCOVERY
// ============================================================================

/**
 * Discover usernames from Wayback Machine across all specified domains
 * @param {Array} domains - Array of domain configs to search
 * @returns {Map} Map of "countryCode:username" -> { username, countryCode, domain }
 */
async function discoverFromWayback(domains) {
  const discovered = new Map();
  console.log('\n Discovering from Wayback Machine...');
  console.log(`  Searching ${domains.length} domain(s)`);

  for (const domainConfig of domains) {
    console.log(`\n  Domain: ${domainConfig.domain}`);
    const urlPattern = `${domainConfig.domain}/*`;
    const queryUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&fl=original&collapse=urlkey&limit=10000`;

    try {
      const response = await fetch(queryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TBP-Farmasius-Discovery/1.0)',
        },
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`    No results`);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      let domainCount = 0;

      // CDX JSON: first row is headers, rest are data
      if (Array.isArray(data) && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          const url = data[i][0];
          const result = extractUsernameFromUrl(url);
          if (result) {
            const key = `${result.countryCode}:${result.username}`;
            if (!discovered.has(key)) {
              discovered.set(key, result);
              domainCount++;
            }
          }
        }
      }

      console.log(`    ${domainConfig.domain}: ${domainCount} unique usernames`);
      await sleep(CONFIG.WB_DELAY);

    } catch (error) {
      console.log(`    ${domainConfig.domain} error: ${error.message}`);
    }
  }

  console.log(`\n  Wayback total: ${discovered.size} unique usernames across all domains`);
  return discovered;
}

// ============================================================================
// SERPAPI GOOGLE SEARCH DISCOVERY
// ============================================================================

/**
 * Discover usernames from Google Search via SerpAPI across all specified domains
 * @param {Array} domains - Array of domain configs to search
 * @param {number} maxSearches - Max total SerpAPI requests
 * @returns {Map} Map of "countryCode:username" -> { username, countryCode, domain }
 */
async function discoverFromSerpAPI(domains, maxSearches) {
  const discovered = new Map();
  console.log('\n Discovering from Google Search (SerpAPI)...');

  if (!SERPAPI_KEY) {
    console.log('  Skipping: SerpAPI key not found');
    return discovered;
  }

  let totalSearchCount = 0;

  // Build queries for each domain
  for (const domainConfig of domains) {
    if (totalSearchCount >= maxSearches) break;

    console.log(`\n  Domain: ${domainConfig.domain} (${domainConfig.country})`);

    // Generate queries for this domain
    const queries = CONFIG.SERPAPI_BASE_QUERIES.map(q =>
      q.replace(/{domain}/g, domainConfig.domain)
    );

    // Add US-specific queries for farmasius.com
    if (domainConfig.code === 'us') {
      queries.push(...CONFIG.SERPAPI_US_QUERIES);
    }

    for (const query of queries) {
      if (totalSearchCount >= maxSearches) break;

      console.log(`    Query: "${query}"`);
      let start = 0;
      let querySearchCount = 0;

      while (querySearchCount < CONFIG.SERPAPI_MAX_PAGES && totalSearchCount < maxSearches) {
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
            break;
          }

          let pageUsernamesFound = 0;
          for (const result of results) {
            // Check the link itself
            const urlResult = extractUsernameFromUrl(result.link);
            if (urlResult) {
              const key = `${urlResult.countryCode}:${urlResult.username}`;
              if (!discovered.has(key)) {
                discovered.set(key, urlResult);
                pageUsernamesFound++;
              }
            }

            // Also check snippet for farmasi domain links
            if (result.snippet) {
              // Match any Farmasi domain pattern
              const farmasisPattern = /(?:farmasius\.com|farmasi\.[a-z.]+)\/([a-zA-Z0-9_-]+)/gi;
              const urlMatches = result.snippet.match(farmasisPattern);
              if (urlMatches) {
                for (const match of urlMatches) {
                  // Reconstruct URL and extract
                  const testUrl = `https://${match}`;
                  const snippetResult = extractUsernameFromUrl(testUrl);
                  if (snippetResult) {
                    const key = `${snippetResult.countryCode}:${snippetResult.username}`;
                    if (!discovered.has(key)) {
                      discovered.set(key, snippetResult);
                      pageUsernamesFound++;
                    }
                  }
                }
              }
            }
          }

          console.log(`      Page ${querySearchCount + 1}: ${pageUsernamesFound} usernames`);

          totalSearchCount++;
          querySearchCount++;
          start += 10;

          await sleep(CONFIG.SERPAPI_DELAY);

        } catch (error) {
          console.log(`      SerpAPI error: ${error.message}`);
          break;
        }
      }
    }
  }

  console.log(`\n  SerpAPI total: ${discovered.size} unique usernames across all domains`);
  return discovered;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Load existing usernames from Firestore
 * Returns Set of "countryCode:username" keys for deduplication
 */
async function loadExistingUsernames() {
  console.log('\n Loading existing usernames from Firestore...');

  const existingKeys = new Set();
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .select('username', 'countryCode')
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    const username = data.username;
    // Use countryCode if available, default to 'us' for legacy entries
    const countryCode = data.countryCode || 'us';
    if (username) {
      existingKeys.add(`${countryCode}:${username.toLowerCase()}`);
    }
  });

  console.log(`  Found ${existingKeys.size} existing usernames`);
  return existingKeys;
}

/**
 * Save new usernames to Firestore with domain metadata
 * @param {Map|Array} usernameData - Map of "countryCode:username" -> { username, countryCode, domain } OR array of strings (legacy)
 * @param {string} source - Discovery source (common_crawl, wayback, serpapi, seed)
 * @param {boolean} dryRun - If true, don't actually save
 * @returns {number} Number of usernames saved
 */
async function saveNewUsernames(usernameData, source, dryRun) {
  // Convert to array of objects if it's a Map
  let items;
  if (usernameData instanceof Map) {
    items = Array.from(usernameData.values());
  } else if (Array.isArray(usernameData)) {
    // Legacy format - assume US domain
    items = usernameData.map(username => ({
      username,
      countryCode: 'us',
      domain: 'farmasius.com',
    }));
  } else {
    items = [];
  }

  if (items.length === 0) {
    console.log('  No new usernames to save');
    return 0;
  }

  console.log(`\n Saving ${items.length} new usernames...`);

  if (dryRun) {
    console.log('  DRY RUN - Would save:');
    items.slice(0, 10).forEach(item => console.log(`    ${item.countryCode}:${item.username} (${item.domain})`));
    if (items.length > 10) {
      console.log(`    ... and ${items.length - 10} more`);
    }
    return 0;
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalSaved = 0;

  for (const item of items) {
    const docRef = db.collection(CONFIG.DISCOVERED_COLLECTION).doc();
    const domainConfig = FARMASI_DOMAINS[item.countryCode] || {};

    batch.set(docRef, {
      username: item.username,
      countryCode: item.countryCode,
      domain: item.domain,
      country: domainConfig.country || null,
      language: domainConfig.language || 'en',
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
  console.log('\n Farmasi Discovery Stats (Multi-Domain)\n');

  // Get collection counts
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const totalDiscovered = discoveredSnapshot.size;

  // Count by scraped status
  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();
  const scrapedCount = scrapedSnapshot.size;
  const pendingCount = totalDiscovered - scrapedCount;

  // Count by country
  const countryStats = {};
  discoveredSnapshot.forEach(doc => {
    const data = doc.data();
    const countryCode = data.countryCode || 'us';
    if (!countryStats[countryCode]) {
      countryStats[countryCode] = { total: 0, scraped: 0 };
    }
    countryStats[countryCode].total++;
    if (data.scraped) {
      countryStats[countryCode].scraped++;
    }
  });

  // Get state
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  console.log('Discovered Usernames:');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scrapedCount}`);
  console.log(`  Pending:  ${pendingCount}`);

  // Show by country
  if (Object.keys(countryStats).length > 0) {
    console.log('\nBy Country:');
    const sortedCountries = Object.entries(countryStats).sort((a, b) => b[1].total - a[1].total);
    for (const [code, stats] of sortedCountries) {
      const countryName = FARMASI_DOMAINS[code]?.country || code;
      const pending = stats.total - stats.scraped;
      console.log(`  ${countryName}: ${stats.total} total, ${stats.scraped} scraped, ${pending} pending`);
    }
  }

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
  console.log('\nRecent usernames (last 10):');
  const sampleSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .orderBy('discoveredAt', 'desc')
    .limit(10)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    const countryCode = data.countryCode || 'us';
    const countryName = FARMASI_DOMAINS[countryCode]?.country || countryCode;
    console.log(`  ${data.username} - ${countryName} (${data.source})`);
  });
}

// ============================================================================
// MAIN DISCOVERY FLOW
// ============================================================================

async function runDiscovery(options) {
  const startTime = Date.now();

  // Get domains to process
  const domains = getDomainsToProcess(options.domain);

  console.log('='.repeat(60));
  console.log('FARMASI URL DISCOVERY (Multi-Domain)');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Domains: ${options.domain === 'all' ? `ALL (${domains.length} domains)` : options.domain}`);
  console.log(`Max SerpAPI searches: ${options.max === Infinity ? 'unlimited' : options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (options.domain === 'all') {
    console.log(`\nDomain list:`);
    domains.forEach(d => console.log(`  - ${d.domain} (${d.country})`));
  }

  // Load existing usernames
  const existingKeys = await loadExistingUsernames();

  // Discover from all sources - now returns Maps of "countryCode:username" -> { username, countryCode, domain }
  const allDiscovered = new Map();
  const stats = {
    commonCrawlUsernames: 0,
    waybackUsernames: 0,
    serpApiUsernames: 0,
    totalNewUsernames: 0,
    byCountry: {},
  };

  // Source 1: Common Crawl
  const ccDiscovered = await discoverFromCommonCrawl(domains);
  stats.commonCrawlUsernames = ccDiscovered.size;
  ccDiscovered.forEach((value, key) => allDiscovered.set(key, value));

  // Source 2: Wayback Machine
  await sleep(CONFIG.WB_DELAY);
  const wbDiscovered = await discoverFromWayback(domains);
  stats.waybackUsernames = wbDiscovered.size;
  wbDiscovered.forEach((value, key) => {
    if (!allDiscovered.has(key)) {
      allDiscovered.set(key, value);
    }
  });

  // Source 3: SerpAPI Google Search
  const serpDiscovered = await discoverFromSerpAPI(domains, options.max);
  stats.serpApiUsernames = serpDiscovered.size;
  serpDiscovered.forEach((value, key) => {
    if (!allDiscovered.has(key)) {
      allDiscovered.set(key, value);
    }
  });

  console.log(`\n Discovery Summary:`);
  console.log(`  Common Crawl: ${stats.commonCrawlUsernames} usernames`);
  console.log(`  Wayback:      ${stats.waybackUsernames} usernames`);
  console.log(`  SerpAPI:      ${stats.serpApiUsernames} usernames`);
  console.log(`  Total unique: ${allDiscovered.size} usernames`);

  // Filter out existing usernames
  const newDiscovered = new Map();
  for (const [key, value] of allDiscovered) {
    if (!existingKeys.has(key)) {
      newDiscovered.set(key, value);

      // Count by country
      const countryCode = value.countryCode;
      stats.byCountry[countryCode] = (stats.byCountry[countryCode] || 0) + 1;
    }
  }
  stats.totalNewUsernames = newDiscovered.size;

  console.log(`  New usernames: ${newDiscovered.size}`);

  // Show breakdown by country
  if (Object.keys(stats.byCountry).length > 0) {
    console.log(`\n  By country:`);
    for (const [code, count] of Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1])) {
      const countryName = FARMASI_DOMAINS[code]?.country || code;
      console.log(`    ${countryName}: ${count}`);
    }
  }

  // Save new usernames
  await saveNewUsernames(newDiscovered, 'hybrid', options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateDiscoveryState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`New usernames discovered: ${newDiscovered.size}`);
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
  console.log('NOTE: US domain (farmasius.com) is SKIPPED by default (1,311 usernames already scraped).\n');
  console.log('Usage:');
  console.log('  node scripts/farmasius-url-discovery.js --discover              # Run discovery (international only)');
  console.log('  node scripts/farmasius-url-discovery.js --discover --domain=us  # USA only (farmasius.com)');
  console.log('  node scripts/farmasius-url-discovery.js --discover --domain=de  # Germany only (farmasi.de)');
  console.log('  node scripts/farmasius-url-discovery.js --discover --max=200    # Limit SerpAPI searches');
  console.log('  node scripts/farmasius-url-discovery.js --seed                  # Load usernames from seed file');
  console.log('  node scripts/farmasius-url-discovery.js --dry-run               # Preview only');
  console.log('  node scripts/farmasius-url-discovery.js --stats                 # Show stats');
  console.log('  node scripts/farmasius-url-discovery.js --reset                 # Reset discovery state');
  console.log('\nSupported domains:');
  console.log('  us  - farmasius.com (USA)');
  console.log('  uk  - farmasi.co.uk (United Kingdom)');
  console.log('  de  - farmasi.de (Germany)');
  console.log('  es  - farmasi.es (Spain)');
  console.log('  pt  - farmasi.pt (Portugal)');
  console.log('  ... and 20+ more (use --stats to see breakdown)');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
