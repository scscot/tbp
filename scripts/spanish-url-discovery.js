#!/usr/bin/env node
/**
 * Spanish MLM Company URL Discovery Script
 *
 * Discovers distributor URLs across Spanish-speaking country MLM companies:
 * - Omnilife (Mexico) - empresario.omnilife.com
 * - VIVRI (Mexico) - vivri.site
 * - FuXion (Peru) - ifuxion.com
 * - Yanbal (Peru) - yanbal.com
 * - Belcorp (Peru) - tiendabelcorp.com (L'Bel, Esika, Cyzone)
 * - Exialoe (Spain) - exialoe.es
 *
 * Discovery sources (hybrid approach):
 * 1. Common Crawl Index API (18 indexes, 2024-2026)
 * 2. Wayback Machine CDX API (historical URLs)
 * 3. Google Search via SerpAPI (multiple queries)
 *
 * Usage:
 *   node scripts/spanish-url-discovery.js --discover              # Run discovery
 *   node scripts/spanish-url-discovery.js --discover --company=omnilife  # Single company
 *   node scripts/spanish-url-discovery.js --discover --max=100    # Limit SerpAPI searches
 *   node scripts/spanish-url-discovery.js --dry-run               # Preview only
 *   node scripts/spanish-url-discovery.js --stats                 # Show stats
 *   node scripts/spanish-url-discovery.js --reset                 # Reset discovery state
 *
 * Sources:
 *   - Common Crawl Index API (no key required)
 *   - Wayback Machine CDX API (no key required)
 *   - SerpAPI Google Search (key from secrets/SerpAPI-Key)
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
// SPANISH MLM COMPANY CONFIGURATIONS
// ============================================================================

/**
 * Company configurations with URL patterns and extraction logic
 */
const SPANISH_COMPANIES = {
  omnilife: {
    name: 'Omnilife',
    country: 'Mexico',
    language: 'es',
    domains: ['empresario.omnilife.com'],
    // URL pattern: https://empresario.omnilife.com/mx/jalisco/guadalajara/123456/juan-perez/omnilife
    // Extract: distributor ID and name from path
    urlPattern: '*.empresario.omnilife.com/*',
    serpQueries: [
      'site:empresario.omnilife.com',
      '"empresario.omnilife.com" distribuidor OR empresario',
      'omnilife "mi tienda" OR "my store"',
    ],
  },
  vivri: {
    name: 'Vivri',
    country: 'Mexico',
    language: 'es',
    domains: ['vivri.site'],
    // URL pattern: https://vivri.site/mct1234567890/
    // Extract: MCT code from path
    urlPattern: 'vivri.site/*',
    serpQueries: [
      'site:vivri.site',
      '"vivri.site" consultor OR distribuidor',
      'vivri challenge "mi link"',
    ],
  },
  fuxion: {
    name: 'FuXion',
    country: 'Peru',
    language: 'es',
    domains: ['ifuxion.com'],
    // URL pattern: https://ifuxion.com/username
    // Extract: username from path
    urlPattern: 'ifuxion.com/*',
    serpQueries: [
      'site:ifuxion.com -inurl:products -inurl:blog',
      '"ifuxion.com" distribuidor OR partner',
      'fuxion "tienda" OR "shop"',
    ],
  },
  yanbal: {
    name: 'Yanbal',
    country: 'Peru',
    language: 'es',
    domains: ['yanbal.com'],
    // URL pattern: https://yanbal.com/pe/consultant123/es/home
    // Extract: consultant ID from path (after country code)
    urlPattern: 'yanbal.com/*/*/*/home',
    serpQueries: [
      'site:yanbal.com inurl:/home',
      '"yanbal.com" consultora OR consultor',
      'yanbal "mi tienda online"',
    ],
  },
  belcorp: {
    name: 'Belcorp',
    country: 'Peru',
    language: 'es',
    domains: ['lbel.tiendabelcorp.com', 'esika.tiendabelcorp.com', 'cyzone.tiendabelcorp.com'],
    // URL pattern: https://lbel.tiendabelcorp.com/pe/?consultantUrl=12345
    // Extract: consultantUrl from query parameter
    urlPattern: '*.tiendabelcorp.com/*',
    serpQueries: [
      'site:tiendabelcorp.com consultantUrl',
      '"tiendabelcorp.com" consultora',
      'lbel OR esika OR cyzone "consultora" link',
    ],
  },
  exialoe: {
    name: 'Exialoe',
    country: 'Spain',
    language: 'es',
    domains: ['exialoe.es'],
    // URL pattern: https://exialoe.es/tienda?promoc=ABC123
    // Extract: promoc code from query parameter
    urlPattern: 'exialoe.es/tienda?*',
    serpQueries: [
      'site:exialoe.es inurl:promoc',
      '"exialoe.es/tienda" distribuidor',
      'exialoe aloe vera "mi tienda"',
    ],
  },
};

// Excluded paths that are not distributor pages
const EXCLUDED_PATHS = [
  'about', 'contact', 'products', 'login', 'signup', 'cart', 'checkout',
  'privacy', 'terms', 'faq', 'blog', 'news', 'support', 'help', 'api',
  'admin', 'shop', 'store', 'order', 'account', 'register', 'home',
  'category', 'categories', 'collections', 'pages', 'product',
  'catalog', 'item', 'items', 'listing', 'listings', 'empresa',
  'nosotros', 'contacto', 'productos', 'tienda', 'carrito',
  'politica', 'terminos', 'ayuda', 'soporte', 'noticias',
  'assets', 'cdn', 'static', 'images', 'css', 'js', 'fonts',
  'search', 'buscar', 'reset', 'forgot', 'password',
];

const CONFIG = {
  // Firestore collections
  DISCOVERED_COLLECTION: 'spanish_discovered_urls',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'spanish_discovery',

  // Common Crawl indexes (18 indexes from 2024-2026)
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

  // SerpAPI
  SERPAPI_URL: 'https://serpapi.com/search',
  SERPAPI_MAX_PAGES: 3,

  // Rate limiting
  CC_DELAY: 1500,          // 1.5s between Common Crawl requests
  WB_DELAY: 2000,          // 2s before Wayback request
  SERPAPI_DELAY: 4000,     // 4s between SerpAPI requests

  // Timeouts
  FETCH_TIMEOUT: 15000,

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
 * Identify which company a URL belongs to
 */
function identifyCompany(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    for (const [companyKey, config] of Object.entries(SPANISH_COMPANIES)) {
      for (const domain of config.domains) {
        if (hostname === domain || hostname.endsWith(`.${domain}`) || hostname.endsWith(domain.replace(/^[^.]+\./, ''))) {
          return { companyKey, config };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract distributor identifier from URL based on company-specific patterns
 */
function extractDistributorInfo(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();
    const pathParts = pathname.split('/').filter(p => p.length > 0);

    // Omnilife: empresario.omnilife.com/{country}/{state}/{city}/{id}/{name}/omnilife
    if (hostname.includes('empresario.omnilife.com')) {
      // Need at least 5 path parts: country/state/city/id/name
      if (pathParts.length >= 5) {
        const distributorId = pathParts[3];  // ID is 4th element
        const distributorName = pathParts[4]; // Name is 5th element
        // Validate it looks like an ID (numeric or alphanumeric)
        if (/^[a-z0-9-]+$/i.test(distributorId)) {
          return {
            company: 'omnilife',
            distributorId,
            distributorName,
            profileUrl: url,
            country: pathParts[0],  // e.g., 'mx', 'co'
          };
        }
      }
      return null;
    }

    // VIVRI: vivri.site/mct{code}/
    if (hostname === 'vivri.site') {
      if (pathParts.length >= 1 && pathParts[0].startsWith('mct')) {
        const mctCode = pathParts[0];
        return {
          company: 'vivri',
          distributorId: mctCode,
          profileUrl: url,
        };
      }
      return null;
    }

    // FuXion: ifuxion.com/{username}
    if (hostname === 'ifuxion.com') {
      if (pathParts.length === 1) {
        const username = pathParts[0];
        // Skip excluded paths
        if (EXCLUDED_PATHS.includes(username)) return null;
        // Validate username format
        if (/^[a-z0-9_-]{2,50}$/i.test(username)) {
          return {
            company: 'fuxion',
            distributorId: username,
            profileUrl: url,
          };
        }
      }
      return null;
    }

    // Yanbal: yanbal.com/{country}/{consultant}/{lang}/home
    if (hostname === 'yanbal.com' || hostname.endsWith('.yanbal.com')) {
      // Look for pattern like /pe/consultant123/es/home
      if (pathParts.length >= 4 && pathParts[pathParts.length - 1] === 'home') {
        const country = pathParts[0];
        const consultant = pathParts[1];
        // Validate consultant ID
        if (/^[a-z0-9_-]{2,50}$/i.test(consultant) && !EXCLUDED_PATHS.includes(consultant)) {
          return {
            company: 'yanbal',
            distributorId: consultant,
            profileUrl: url,
            country,
          };
        }
      }
      return null;
    }

    // Belcorp: *.tiendabelcorp.com/{country}/?consultantUrl={id}
    if (hostname.includes('tiendabelcorp.com')) {
      const consultantUrl = parsed.searchParams.get('consultantUrl');
      if (consultantUrl) {
        // Determine brand from subdomain
        let brand = 'belcorp';
        if (hostname.startsWith('lbel.')) brand = 'lbel';
        else if (hostname.startsWith('esika.')) brand = 'esika';
        else if (hostname.startsWith('cyzone.')) brand = 'cyzone';

        return {
          company: 'belcorp',
          brand,
          distributorId: consultantUrl,
          profileUrl: url,
          country: pathParts[0] || null,
        };
      }
      return null;
    }

    // Exialoe: exialoe.es/tienda?promoc={code}
    if (hostname === 'exialoe.es') {
      const promocCode = parsed.searchParams.get('promoc');
      if (promocCode && pathname.includes('tienda')) {
        return {
          company: 'exialoe',
          distributorId: promocCode,
          profileUrl: url,
        };
      }
      return null;
    }

    return null;
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
    max: Infinity,
    company: 'all',  // 'all' or specific company key
  };

  for (const arg of args) {
    if (arg === '--discover') options.discover = true;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--stats') options.stats = true;
    if (arg === '--reset') options.reset = true;
    if (arg.startsWith('--max=')) {
      const val = parseInt(arg.split('=')[1], 10);
      options.max = val === 0 ? Infinity : val;
    }
    if (arg.startsWith('--company=')) {
      options.company = arg.split('=')[1].toLowerCase();
    }
  }

  return options;
}

/**
 * Get companies to process, optionally filtered
 */
function getCompaniesToProcess(filterKey = 'all') {
  if (filterKey && filterKey !== 'all') {
    const config = SPANISH_COMPANIES[filterKey];
    if (config) {
      return [{ key: filterKey, ...config }];
    }
    console.log(`  Warning: Unknown company "${filterKey}", processing all companies`);
  }
  return Object.entries(SPANISH_COMPANIES).map(([key, config]) => ({ key, ...config }));
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
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Spanish-Discovery/1.0)',
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
 * Discover distributor URLs from Common Crawl
 */
async function discoverFromCommonCrawl(companies) {
  const discovered = new Map();  // key = "company:distributorId"
  console.log('\n Discovering from Common Crawl...');
  console.log(`  Searching ${companies.length} company(ies)`);

  if (circuitBreaker.isOpen) {
    console.log('  Circuit breaker OPEN - skipping Common Crawl');
    return discovered;
  }

  for (const company of companies) {
    console.log(`\n  ${company.name} (${company.country})`);

    for (const domain of company.domains) {
      const urlPattern = `${domain}/*`;
      let domainCount = 0;

      for (const indexName of CONFIG.COMMON_CRAWL_INDEXES) {
        if (circuitBreaker.isOpen) break;

        console.log(`    Querying ${indexName} for ${domain}...`);
        const { urls, error } = await queryCommonCrawlIndex(indexName, urlPattern);

        // Extract distributor info
        for (const url of urls) {
          const info = extractDistributorInfo(url);
          if (info) {
            const key = `${info.company}:${info.distributorId}`;
            if (!discovered.has(key)) {
              discovered.set(key, info);
              domainCount++;
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

      console.log(`    ${domain}: ${domainCount} distributors`);
    }
  }

  console.log(`\n  Common Crawl total: ${discovered.size} unique distributors`);
  return discovered;
}

// ============================================================================
// WAYBACK MACHINE DISCOVERY
// ============================================================================

/**
 * Discover distributor URLs from Wayback Machine
 */
async function discoverFromWayback(companies) {
  const discovered = new Map();
  console.log('\n Discovering from Wayback Machine...');

  for (const company of companies) {
    console.log(`\n  ${company.name}`);

    for (const domain of company.domains) {
      const urlPattern = `${domain}/*`;
      const queryUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(urlPattern)}&output=json&fl=original&collapse=urlkey&limit=10000`;

      try {
        const response = await fetch(queryUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TBP-Spanish-Discovery/1.0)',
          },
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`    ${domain}: No results`);
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
            const info = extractDistributorInfo(url);
            if (info) {
              const key = `${info.company}:${info.distributorId}`;
              if (!discovered.has(key)) {
                discovered.set(key, info);
                domainCount++;
              }
            }
          }
        }

        console.log(`    ${domain}: ${domainCount} distributors`);
        await sleep(CONFIG.WB_DELAY);

      } catch (error) {
        console.log(`    ${domain} error: ${error.message}`);
      }
    }
  }

  console.log(`\n  Wayback total: ${discovered.size} unique distributors`);
  return discovered;
}

// ============================================================================
// SERPAPI GOOGLE SEARCH DISCOVERY
// ============================================================================

/**
 * Discover distributor URLs from Google Search via SerpAPI
 */
async function discoverFromSerpAPI(companies, maxSearches) {
  const discovered = new Map();
  console.log('\n Discovering from Google Search (SerpAPI)...');

  if (!SERPAPI_KEY) {
    console.log('  Skipping: SerpAPI key not found');
    return discovered;
  }

  let totalSearchCount = 0;

  for (const company of companies) {
    if (totalSearchCount >= maxSearches) break;

    console.log(`\n  ${company.name}`);

    for (const query of company.serpQueries) {
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
              hl: 'es',  // Spanish results
              gl: 'mx',  // Mexico location for better Spanish results
            },
            timeout: CONFIG.FETCH_TIMEOUT,
          });

          const results = response.data.organic_results || [];

          if (results.length === 0) {
            break;
          }

          let pageCount = 0;
          for (const result of results) {
            // Check the link
            const info = extractDistributorInfo(result.link);
            if (info) {
              const key = `${info.company}:${info.distributorId}`;
              if (!discovered.has(key)) {
                discovered.set(key, info);
                pageCount++;
              }
            }

            // Also check snippet for URLs
            if (result.snippet) {
              // Look for company domain patterns in snippets
              for (const domain of company.domains) {
                const domainPattern = new RegExp(`${domain.replace('.', '\\.')}[^\\s"'<>]+`, 'gi');
                const urlMatches = result.snippet.match(domainPattern);
                if (urlMatches) {
                  for (const match of urlMatches) {
                    const testUrl = `https://${match}`;
                    const snippetInfo = extractDistributorInfo(testUrl);
                    if (snippetInfo) {
                      const key = `${snippetInfo.company}:${snippetInfo.distributorId}`;
                      if (!discovered.has(key)) {
                        discovered.set(key, snippetInfo);
                        pageCount++;
                      }
                    }
                  }
                }
              }
            }
          }

          console.log(`      Page ${querySearchCount + 1}: ${pageCount} distributors`);

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

  console.log(`\n  SerpAPI total: ${discovered.size} unique distributors`);
  return discovered;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/**
 * Load existing distributors from Firestore
 */
async function loadExistingDistributors() {
  console.log('\n Loading existing distributors from Firestore...');

  const existingKeys = new Set();
  const snapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .select('company', 'distributorId')
    .get();

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.company && data.distributorId) {
      existingKeys.add(`${data.company}:${data.distributorId}`);
    }
  });

  console.log(`  Found ${existingKeys.size} existing distributors`);
  return existingKeys;
}

/**
 * Save new distributors to Firestore
 */
async function saveNewDistributors(distributorData, source, dryRun) {
  const items = Array.from(distributorData.values());

  if (items.length === 0) {
    console.log('  No new distributors to save');
    return 0;
  }

  console.log(`\n Saving ${items.length} new distributors...`);

  if (dryRun) {
    console.log('  DRY RUN - Would save:');
    items.slice(0, 10).forEach(item => console.log(`    ${item.company}: ${item.distributorId}`));
    if (items.length > 10) {
      console.log(`    ... and ${items.length - 10} more`);
    }
    return 0;
  }

  let batch = db.batch();
  let batchCount = 0;
  let totalSaved = 0;

  for (const item of items) {
    const companyConfig = SPANISH_COMPANIES[item.company];
    const docRef = db.collection(CONFIG.DISCOVERED_COLLECTION).doc();

    batch.set(docRef, {
      company: item.company,
      companyName: companyConfig?.name || item.company,
      distributorId: item.distributorId,
      distributorName: item.distributorName || null,
      profileUrl: item.profileUrl,
      country: item.country || companyConfig?.country || null,
      language: companyConfig?.language || 'es',
      brand: item.brand || null,
      source: source,
      discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      scraped: false,
      scrapedAt: null,
    });

    batchCount++;
    totalSaved++;

    if (batchCount >= 500) {
      await batch.commit();
      console.log(`    Committed batch of ${batchCount} distributors (total: ${totalSaved})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`    Committed final batch of ${batchCount} distributors (total: ${totalSaved})`);
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

  // Delete all discovered distributors
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

  console.log(`  Deleted ${count} discovered distributors`);
  console.log('  State reset complete');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n Spanish MLM Company Discovery Stats\n');

  // Get collection counts
  const discoveredSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION).get();
  const totalDiscovered = discoveredSnapshot.size;

  // Count by scraped status
  const scrapedSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .where('scraped', '==', true)
    .get();
  const scrapedCount = scrapedSnapshot.size;
  const pendingCount = totalDiscovered - scrapedCount;

  // Count by company
  const companyStats = {};
  discoveredSnapshot.forEach(doc => {
    const data = doc.data();
    const company = data.company || 'unknown';
    if (!companyStats[company]) {
      companyStats[company] = { total: 0, scraped: 0 };
    }
    companyStats[company].total++;
    if (data.scraped) {
      companyStats[company].scraped++;
    }
  });

  // Get state
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  console.log('Discovered Distributors:');
  console.log(`  Total:    ${totalDiscovered}`);
  console.log(`  Scraped:  ${scrapedCount}`);
  console.log(`  Pending:  ${pendingCount}`);

  // Show by company
  if (Object.keys(companyStats).length > 0) {
    console.log('\nBy Company:');
    const sortedCompanies = Object.entries(companyStats).sort((a, b) => b[1].total - a[1].total);
    for (const [company, stats] of sortedCompanies) {
      const companyName = SPANISH_COMPANIES[company]?.name || company;
      const pending = stats.total - stats.scraped;
      console.log(`  ${companyName}: ${stats.total} total, ${stats.scraped} scraped, ${pending} pending`);
    }
  }

  if (state.lastDiscoveryAt) {
    console.log(`\nLast Discovery: ${state.lastDiscoveryAt.toDate().toISOString()}`);
  }

  if (state.commonCrawlCount !== undefined) {
    console.log(`\nLast Run Stats:`);
    console.log(`  Common Crawl: ${state.commonCrawlCount} distributors`);
    console.log(`  Wayback:      ${state.waybackCount} distributors`);
    console.log(`  SerpAPI:      ${state.serpApiCount} distributors`);
    console.log(`  Total New:    ${state.totalNew} distributors`);
  }

  // Show sample distributors
  console.log('\nRecent distributors (last 10):');
  const sampleSnapshot = await db.collection(CONFIG.DISCOVERED_COLLECTION)
    .orderBy('discoveredAt', 'desc')
    .limit(10)
    .get();

  sampleSnapshot.forEach(doc => {
    const data = doc.data();
    const companyName = SPANISH_COMPANIES[data.company]?.name || data.company;
    console.log(`  ${companyName}: ${data.distributorId} (${data.source})`);
  });
}

// ============================================================================
// MAIN DISCOVERY FLOW
// ============================================================================

async function runDiscovery(options) {
  const startTime = Date.now();

  // Get companies to process
  const companies = getCompaniesToProcess(options.company);

  console.log('='.repeat(60));
  console.log('SPANISH MLM COMPANY URL DISCOVERY');
  console.log('='.repeat(60));
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Companies: ${options.company === 'all' ? `ALL (${companies.length} companies)` : options.company}`);
  console.log(`Max SerpAPI searches: ${options.max === Infinity ? 'unlimited' : options.max}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (options.company === 'all') {
    console.log(`\nCompany list:`);
    companies.forEach(c => console.log(`  - ${c.name} (${c.country}): ${c.domains.join(', ')}`));
  }

  // Load existing distributors
  const existingKeys = await loadExistingDistributors();

  // Discover from all sources
  const allDiscovered = new Map();
  const stats = {
    commonCrawlCount: 0,
    waybackCount: 0,
    serpApiCount: 0,
    totalNew: 0,
    byCompany: {},
  };

  // Source 1: Common Crawl
  const ccDiscovered = await discoverFromCommonCrawl(companies);
  stats.commonCrawlCount = ccDiscovered.size;
  ccDiscovered.forEach((value, key) => allDiscovered.set(key, value));

  // Source 2: Wayback Machine
  await sleep(CONFIG.WB_DELAY);
  const wbDiscovered = await discoverFromWayback(companies);
  stats.waybackCount = wbDiscovered.size;
  wbDiscovered.forEach((value, key) => {
    if (!allDiscovered.has(key)) {
      allDiscovered.set(key, value);
    }
  });

  // Source 3: SerpAPI Google Search
  const serpDiscovered = await discoverFromSerpAPI(companies, options.max);
  stats.serpApiCount = serpDiscovered.size;
  serpDiscovered.forEach((value, key) => {
    if (!allDiscovered.has(key)) {
      allDiscovered.set(key, value);
    }
  });

  console.log(`\n Discovery Summary:`);
  console.log(`  Common Crawl: ${stats.commonCrawlCount} distributors`);
  console.log(`  Wayback:      ${stats.waybackCount} distributors`);
  console.log(`  SerpAPI:      ${stats.serpApiCount} distributors`);
  console.log(`  Total unique: ${allDiscovered.size} distributors`);

  // Filter out existing distributors
  const newDiscovered = new Map();
  for (const [key, value] of allDiscovered) {
    if (!existingKeys.has(key)) {
      newDiscovered.set(key, value);

      // Count by company
      const company = value.company;
      stats.byCompany[company] = (stats.byCompany[company] || 0) + 1;
    }
  }
  stats.totalNew = newDiscovered.size;

  console.log(`  New distributors: ${newDiscovered.size}`);

  // Show breakdown by company
  if (Object.keys(stats.byCompany).length > 0) {
    console.log(`\n  By company:`);
    for (const [company, count] of Object.entries(stats.byCompany).sort((a, b) => b[1] - a[1])) {
      const companyName = SPANISH_COMPANIES[company]?.name || company;
      console.log(`    ${companyName}: ${count}`);
    }
  }

  // Save new distributors
  await saveNewDistributors(newDiscovered, 'hybrid', options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateDiscoveryState(stats);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`New distributors discovered: ${newDiscovered.size}`);
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

  if (options.discover) {
    await runDiscovery(options);
    process.exit(0);
  }

  // Default: show usage
  console.log('Spanish MLM Company URL Discovery\n');
  console.log('Usage:');
  console.log('  node scripts/spanish-url-discovery.js --discover              # Run discovery (all companies)');
  console.log('  node scripts/spanish-url-discovery.js --discover --company=omnilife  # Single company');
  console.log('  node scripts/spanish-url-discovery.js --discover --max=100    # Limit SerpAPI searches');
  console.log('  node scripts/spanish-url-discovery.js --dry-run               # Preview only');
  console.log('  node scripts/spanish-url-discovery.js --stats                 # Show stats');
  console.log('  node scripts/spanish-url-discovery.js --reset                 # Reset discovery state');
  console.log('\nSupported companies:');
  for (const [key, config] of Object.entries(SPANISH_COMPANIES)) {
    console.log(`  ${key.padEnd(10)} - ${config.name} (${config.country}): ${config.domains.join(', ')}`);
  }
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
