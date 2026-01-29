#!/usr/bin/env node
/**
 * Base URL Discovery - Common Crawl Pattern Finder
 *
 * Discovers rep/distributor URL patterns for direct sales companies
 * by querying Common Crawl Index.
 *
 * Usage:
 *   node scripts/base_url_discovery.js                      # Run for priority 20 companies
 *   node scripts/base_url_discovery.js --all                # Run for all companies
 *   node scripts/base_url_discovery.js --all --limit=20     # Run for next 20 unprocessed companies
 *   node scripts/base_url_discovery.js --company=herbalife  # Run for specific company
 *   node scripts/base_url_discovery.js --skip-validation    # Skip URL validation
 *
 * Output: patterns.json
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Input/Output files
  BASE_URLS_FILE: path.join(__dirname, 'base_urls.txt'),
  PATTERNS_FILE: path.join(__dirname, 'patterns.json'),

  // Common Crawl Index settings
  COMMON_CRAWL_INDEXES: [
    'CC-MAIN-2025-51',
    'CC-MAIN-2025-47',
    'CC-MAIN-2025-43',
    'CC-MAIN-2024-51',
    'CC-MAIN-2024-46',
  ],
  COMMON_CRAWL_BASE: 'https://index.commoncrawl.org',

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 1500,  // 1.5 seconds

  // Known rep URL patterns (from research)
  // Maps company domain to their rep platform domain/pattern
  KNOWN_PATTERNS: {
    'herbalife.com': { repDomain: 'goherbalife.com', type: 'subdomain' },
    'doterra.com': { repDomain: 'mydoterra.com', type: 'path' },
    'arbonne.com': { repDomain: 'arbonne.com', type: 'subdomain' },
    'monatglobal.com': { repDomain: 'mymonat.com', type: 'subdomain' },
    'scentsy.com': { repDomain: 'scentsy.us', type: 'subdomain' },
    'ambitenergy.com': { repDomain: 'myambit.com', type: 'subdomain' },
    'shaklee.com': { repDomain: 'shaklee.net', type: 'path' },
    'lifewave.com': { repDomain: 'lifewave.com', type: 'path' },
    'pruvitnow.com': { repDomain: 'pruvitnow.com', type: 'subdomain' },
    'zilis.com': { repDomain: 'app.elify.com', type: 'third-party', pathPrefix: '/vbc/' },
    'nuskin.com': { repDomain: 'nuskin.com', type: 'path' },
    'usana.com': { repDomain: 'usana.com', type: 'path' },
    'youngliving.com': { repDomain: 'youngliving.com', type: 'path' },
    'isagenix.com': { repDomain: 'isagenix.com', type: 'path' },
  },

  // Priority companies (first 20 to process)
  PRIORITY_COMPANIES: [
    'amway.com',
    'herbalife.com',
    'nuskin.com',
    'marykay.com',
    'primerica.com',
    'shaklee.com',
    'usana.com',
    'doterra.com',
    'youngliving.com',
    'monatglobal.com',
    'arbonne.com',
    'scentsy.com',
    'itworks.com',
    'isagenix.com',
    'pruvitnow.com',
    'lifewave.com',
    'ambitenergy.com',
    'foreverliving.com',
    'tupperware.com',
    'avon.com',
  ],

  // URL Validation settings
  VALIDATION_TIMEOUT: 10000,  // 10 seconds
  PARKED_DOMAIN_INDICATORS: [
    'domain is for sale',
    'this domain is parked',
    'buy this domain',
    'domain parking',
    'parked free',
    'sedoparking',
    'godaddy',
    'hugedomains',
    'dan.com',
    'afternic',
    'domain has expired',
    'this site can\'t be reached',
    'page not found',
    'coming soon',
    'under construction',
    'website coming soon',
    'site under maintenance',
  ],

  // Common rep URL path indicators
  REP_PATH_INDICATORS: [
    '/rep/', '/consultant/', '/distributor/', '/ambassador/',
    '/pws/', '/personal/', '/member/', '/associate/',
    '/shop/', '/store/', '/site/', '/team/',
  ],

  // Domains to exclude (corporate pages, not rep pages)
  EXCLUDED_PATHS: [
    '/login', '/signin', '/register', '/signup', '/account',
    '/cart', '/checkout', '/admin', '/api/', '/cdn-cgi/',
    '/privacy', '/terms', '/about', '/contact', '/careers',
    '/press', '/blog', '/news', '/help', '/support', '/faq',
    '.pdf', '.jpg', '.png', '.gif', '.css', '.js',
  ],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function loadExistingPatterns() {
  try {
    if (fs.existsSync(CONFIG.PATTERNS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PATTERNS_FILE, 'utf8'));
    }
  } catch (error) {
    console.log('No existing patterns.json found, starting fresh');
  }
  return {};
}

function savePatterns(patterns) {
  fs.writeFileSync(
    CONFIG.PATTERNS_FILE,
    JSON.stringify(patterns, null, 2),
    'utf8'
  );
  console.log(`\nSaved ${Object.keys(patterns).length} patterns to patterns.json`);
}

function loadBaseUrls() {
  const content = fs.readFileSync(CONFIG.BASE_URLS_FILE, 'utf8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(url => extractDomain(url));
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate that a company URL is active and not parked/redirected
 * @param {string} domain - Company domain to validate
 * @returns {Promise<{valid: boolean, reason: string|null, statusCode: number|null}>}
 */
async function validateCompanyUrl(domain) {
  const url = `https://${domain}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.VALIDATION_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check status code
    if (!response.ok) {
      return {
        valid: false,
        reason: `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    // Check for redirect to different domain (parked domain indicator)
    const finalUrl = response.url;
    const finalDomain = extractDomain(finalUrl);
    const originalDomain = domain.replace(/^www\./, '');

    // Allow www variations but flag completely different domains
    if (!finalDomain.includes(originalDomain.split('.')[0]) &&
        !originalDomain.includes(finalDomain.split('.')[0])) {
      return {
        valid: false,
        reason: `Redirected to different domain: ${finalDomain}`,
        statusCode: response.status,
      };
    }

    // Check page content for parked domain indicators
    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    for (const indicator of CONFIG.PARKED_DOMAIN_INDICATORS) {
      if (lowerHtml.includes(indicator.toLowerCase())) {
        return {
          valid: false,
          reason: `Parked/inactive page: "${indicator}"`,
          statusCode: response.status,
        };
      }
    }

    // Check for very short pages (likely parked)
    if (html.length < 500) {
      return {
        valid: false,
        reason: `Page too short (${html.length} chars) - likely parked`,
        statusCode: response.status,
      };
    }

    return {
      valid: true,
      reason: null,
      statusCode: response.status,
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return {
        valid: false,
        reason: 'Timeout - site not responding',
        statusCode: null,
      };
    }

    return {
      valid: false,
      reason: `Error: ${error.message}`,
      statusCode: null,
    };
  }
}

// ============================================================================
// COMMON CRAWL QUERY
// ============================================================================

/**
 * Query Common Crawl Index for URLs matching pattern
 */
async function queryCommonCrawl(indexName, urlPattern) {
  const indexUrl = `${CONFIG.COMMON_CRAWL_BASE}/${indexName}-index`;
  const queryUrl = `${indexUrl}?url=${encodeURIComponent(urlPattern)}&output=json`;

  try {
    const response = await fetch(queryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TBP-Pattern-Discovery/1.0)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text.trim()) return [];

    const lines = text.trim().split('\n').filter(line => line.trim());
    const urls = [];

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

    return urls;
  } catch (error) {
    console.log(`    Error: ${error.message}`);
    return [];
  }
}

/**
 * Query multiple indexes and deduplicate results
 */
async function queryMultipleIndexes(urlPattern, maxIndexes = 3) {
  const allUrls = new Set();
  const indexesToQuery = CONFIG.COMMON_CRAWL_INDEXES.slice(0, maxIndexes);

  for (const indexName of indexesToQuery) {
    console.log(`    Querying ${indexName}...`);
    const urls = await queryCommonCrawl(indexName, urlPattern);
    urls.forEach(url => allUrls.add(url));

    if (indexesToQuery.indexOf(indexName) < indexesToQuery.length - 1) {
      await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
    }
  }

  return Array.from(allUrls);
}

// ============================================================================
// PATTERN DISCOVERY
// ============================================================================

/**
 * Filter URLs to find likely rep/distributor pages
 */
function filterRepUrls(urls, companyDomain) {
  const seen = new Set();

  return urls.filter(url => {
    const lowerUrl = url.toLowerCase();

    // Exclude corporate pages and files
    for (const excluded of CONFIG.EXCLUDED_PATHS) {
      if (lowerUrl.includes(excluded)) return false;
    }

    // Exclude robots.txt and other common files
    if (lowerUrl.includes('robots.txt')) return false;
    if (lowerUrl.includes('sitemap')) return false;
    if (lowerUrl.includes('favicon')) return false;

    // For subdomain patterns, extract just the base URL without path
    // to avoid duplicates from same subdomain
    try {
      const parsed = new URL(url);
      const baseUrl = `${parsed.protocol}//${parsed.hostname}`;

      // Skip if we've seen this subdomain
      if (seen.has(baseUrl)) return false;
      seen.add(baseUrl);

      // Skip www without username
      if (parsed.hostname === 'www.goherbalife.com' ||
          parsed.hostname === 'goherbalife.com') return false;

      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Normalize URLs to base homepage for sample display
 */
function normalizeToHomepage(urls) {
  const normalized = new Set();

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      // Just keep protocol + hostname
      const homepage = `${parsed.protocol}//${parsed.hostname}`;
      normalized.add(homepage);
    } catch {
      // Skip invalid URLs
    }
  }

  return Array.from(normalized);
}

/**
 * Analyze URLs to determine pattern type
 */
function analyzeUrlPatterns(urls, companyDomain) {
  const subdomainCounts = {};
  const pathPatterns = {};

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();

      // Count subdomain patterns
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const baseDomain = parts.slice(-2).join('.');
        const subdomain = parts.slice(0, -2).join('.');

        if (subdomain && subdomain !== 'www') {
          subdomainCounts[baseDomain] = (subdomainCounts[baseDomain] || 0) + 1;
        }
      }

      // Analyze path patterns
      const pathParts = pathname.split('/').filter(p => p);
      if (pathParts.length >= 1) {
        // Look for rep indicators in path
        for (const indicator of CONFIG.REP_PATH_INDICATORS) {
          if (pathname.includes(indicator)) {
            const key = `${hostname}${indicator}*`;
            pathPatterns[key] = (pathPatterns[key] || 0) + 1;
          }
        }

        // Check for username-style paths (single path segment with alphanum)
        if (pathParts.length === 1 && /^[a-z0-9_-]+$/i.test(pathParts[0])) {
          const key = `${hostname}/*`;
          pathPatterns[key] = (pathPatterns[key] || 0) + 1;
        }
      }
    } catch {
      // Skip invalid URLs
    }
  }

  return { subdomainCounts, pathPatterns };
}

/**
 * Discover patterns for a single company
 */
async function discoverPatternsForCompany(companyDomain, skipValidation = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${companyDomain}`);
  console.log('='.repeat(60));

  const result = {
    companyDomain,
    type: 'unknown',
    repDomain: null,
    pattern: null,
    urlCount: 0,
    sampleUrls: [],
    noEmailPlatform: false,
    detectedAt: null,
    discoveredAt: new Date().toISOString(),
    siteStatus: null,  // Track validation status
  };

  // Validate company URL is active (unless skipped)
  if (!skipValidation) {
    console.log(`  Validating ${companyDomain}...`);
    const validation = await validateCompanyUrl(companyDomain);

    if (!validation.valid) {
      console.log(`  SKIPPED: ${validation.reason}`);
      result.type = 'inactive';
      result.siteStatus = validation.reason;
      return result;
    }
    console.log(`  Site is active (HTTP ${validation.statusCode})`);
    result.siteStatus = 'active';
  }

  // Check if we have a known pattern
  if (CONFIG.KNOWN_PATTERNS[companyDomain]) {
    const known = CONFIG.KNOWN_PATTERNS[companyDomain];
    console.log(`  Using known pattern: ${known.repDomain} (${known.type})`);

    let searchPattern;
    if (known.type === 'subdomain') {
      searchPattern = `*.${known.repDomain}/*`;
    } else if (known.type === 'path') {
      searchPattern = `${known.repDomain}/*`;
    } else if (known.type === 'third-party') {
      searchPattern = `${known.repDomain}${known.pathPrefix || '/'}*`;
    }

    console.log(`  Query pattern: ${searchPattern}`);
    const urls = await queryMultipleIndexes(searchPattern);
    const filteredUrls = filterRepUrls(urls, companyDomain);

    let uniqueRepUrls;

    if (known.type === 'subdomain') {
      // Normalize to homepages for subdomain patterns
      const homepages = normalizeToHomepage(urls);
      uniqueRepUrls = homepages.filter(url => {
        // Skip bare domain without subdomain
        const hostname = new URL(url).hostname;
        if (hostname === known.repDomain || hostname === `www.${known.repDomain}`) {
          return false;
        }
        return true;
      });
    } else {
      // For path-based patterns, extract unique usernames/paths
      const seenPaths = new Set();
      uniqueRepUrls = [];

      for (const url of urls) {
        try {
          const parsed = new URL(url);
          const pathParts = parsed.pathname.split('/').filter(p => p);

          // Skip corporate pages and files
          if (CONFIG.EXCLUDED_PATHS.some(ex => url.toLowerCase().includes(ex))) continue;
          if (url.includes('robots.txt')) continue;

          // Get the first path segment (username)
          if (pathParts.length >= 1) {
            const username = pathParts[0];
            // Skip if looks like corporate page
            if (['en', 'es', 'us', 'ca', 'uk', 'mx', 'site', 'sites'].includes(username.toLowerCase())) continue;
            if (username.length < 3) continue;

            const repUrl = `${parsed.protocol}//${parsed.hostname}/${username}`;
            if (!seenPaths.has(repUrl)) {
              seenPaths.add(repUrl);
              uniqueRepUrls.push(repUrl);
            }
          }
        } catch {
          // Skip invalid URLs
        }
      }
    }

    result.type = known.type;
    result.repDomain = known.repDomain;
    result.pattern = searchPattern;
    result.urlCount = uniqueRepUrls.length;
    result.sampleUrls = uniqueRepUrls.slice(0, 10);

    console.log(`  Found ${uniqueRepUrls.length} unique rep sites`);
    if (result.sampleUrls.length > 0) {
      console.log(`  Sample: ${result.sampleUrls[0]}`);
    }

    return result;
  }

  // Try to discover pattern via Common Crawl
  console.log('  Attempting pattern discovery...');

  // Strategy 1: Search for subdomain variants
  const domainBase = companyDomain.replace(/\.com$|\.net$|\.org$/, '');
  const subdomainPatterns = [
    `*.${companyDomain}/*`,           // *.herbalife.com
    `*.my${domainBase}.com/*`,        // *.myherbalife.com
    `*.go${domainBase}.com/*`,        // *.goherbalife.com
    `*${domainBase}.com/*`,           // *herbalife.com (catch variations)
  ];

  for (const pattern of subdomainPatterns) {
    console.log(`  Trying: ${pattern}`);
    const urls = await queryMultipleIndexes(pattern, 2);
    const filteredUrls = filterRepUrls(urls, companyDomain);

    if (filteredUrls.length > 50) {
      console.log(`  Found ${filteredUrls.length} URLs with pattern ${pattern}`);
      const analysis = analyzeUrlPatterns(filteredUrls, companyDomain);

      result.type = 'subdomain';
      result.repDomain = pattern.replace('*.', '').replace('/*', '');
      result.pattern = pattern;
      result.urlCount = filteredUrls.length;
      result.sampleUrls = filteredUrls.slice(0, 10);

      if (result.sampleUrls.length > 0) {
        console.log(`  Sample: ${result.sampleUrls[0]}`);
      }

      return result;
    }

    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
  }

  // Strategy 2: Search for path-based patterns on main domain
  const pathPatterns = [
    `${companyDomain}/*/*`,           // domain.com/username/...
    `www.${companyDomain}/*/*`,       // www.domain.com/username/...
  ];

  for (const pattern of pathPatterns) {
    console.log(`  Trying: ${pattern}`);
    const urls = await queryMultipleIndexes(pattern, 2);
    const filteredUrls = filterRepUrls(urls, companyDomain);

    if (filteredUrls.length > 50) {
      console.log(`  Found ${filteredUrls.length} URLs with pattern ${pattern}`);
      const analysis = analyzeUrlPatterns(filteredUrls, companyDomain);

      // Try to identify specific path prefix
      const commonPaths = Object.entries(analysis.pathPatterns)
        .filter(([_, count]) => count > 10)
        .sort((a, b) => b[1] - a[1]);

      if (commonPaths.length > 0) {
        result.pattern = commonPaths[0][0];
      } else {
        result.pattern = pattern;
      }

      result.type = 'path';
      result.repDomain = companyDomain;
      result.urlCount = filteredUrls.length;
      result.sampleUrls = filteredUrls.slice(0, 10);

      if (result.sampleUrls.length > 0) {
        console.log(`  Sample: ${result.sampleUrls[0]}`);
      }

      return result;
    }

    await sleep(CONFIG.DELAY_BETWEEN_REQUESTS);
  }

  console.log('  No pattern discovered');
  return result;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  // Parse arguments
  const runAll = args.includes('--all');
  const skipValidation = args.includes('--skip-validation');
  const specificCompany = args.find(a => a.startsWith('--company='))?.split('=')[1];
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : null;

  console.log('='.repeat(60));
  console.log('BASE URL DISCOVERY - Common Crawl Pattern Finder');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`URL Validation: ${skipValidation ? 'DISABLED' : 'ENABLED'}`);
  if (limit) console.log(`Batch Limit: ${limit} companies`);

  // Load base URLs
  const allCompanies = loadBaseUrls();
  console.log(`Total companies in base_urls.txt: ${allCompanies.length}`);

  // Load existing patterns
  const patterns = loadExistingPatterns();
  console.log(`Existing patterns loaded: ${Object.keys(patterns).length}`);

  // Determine which companies to process
  let companiesToProcess;
  if (specificCompany) {
    companiesToProcess = [specificCompany];
    console.log(`Processing specific company: ${specificCompany}`);
  } else if (runAll) {
    companiesToProcess = allCompanies;
    console.log(`Processing ALL ${allCompanies.length} companies`);
  } else {
    // Default: priority companies only
    companiesToProcess = CONFIG.PRIORITY_COMPANIES.filter(c =>
      allCompanies.some(ac => ac.includes(c.replace('.com', '')))
    );
    console.log(`Processing priority companies: ${companiesToProcess.length}`);
  }

  // Skip already processed companies (unless specific company requested)
  if (!specificCompany) {
    companiesToProcess = companiesToProcess.filter(c => !patterns[c]);
    console.log(`After filtering already processed: ${companiesToProcess.length}`);
  }

  // Apply limit if specified
  if (limit && limit > 0) {
    companiesToProcess = companiesToProcess.slice(0, limit);
    console.log(`Limited to first ${limit} companies: ${companiesToProcess.length}`);
  }

  // Process each company
  let processed = 0;
  let discovered = 0;
  let inactive = 0;

  for (const company of companiesToProcess) {
    try {
      const result = await discoverPatternsForCompany(company, skipValidation);
      patterns[company] = result;
      processed++;

      if (result.type === 'inactive') {
        inactive++;
      } else if (result.urlCount > 0) {
        discovered++;
      }

      // Save progress periodically
      if (processed % 5 === 0) {
        savePatterns(patterns);
      }

      // Rate limit between companies
      if (companiesToProcess.indexOf(company) < companiesToProcess.length - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUESTS * 2);
      }
    } catch (error) {
      console.error(`Error processing ${company}: ${error.message}`);
    }
  }

  // Final save
  savePatterns(patterns);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('DISCOVERY COMPLETE');
  console.log('='.repeat(60));
  console.log(`Companies processed: ${processed}`);
  console.log(`Patterns discovered: ${discovered}`);
  console.log(`Inactive/parked sites: ${inactive}`);
  console.log(`Total patterns saved: ${Object.keys(patterns).length}`);
  console.log(`Time elapsed: ${elapsed}s`);
  console.log('='.repeat(60));

  // List inactive companies
  const inactiveCompanies = Object.entries(patterns)
    .filter(([_, p]) => p.type === 'inactive')
    .map(([company, p]) => ({ company, reason: p.siteStatus }));

  if (inactiveCompanies.length > 0) {
    console.log('\nInactive/Parked Companies:');
    inactiveCompanies.forEach(({ company, reason }) => {
      console.log(`  ${company}: ${reason}`);
    });
  }

  // List companies with patterns
  console.log('\nCompanies with discovered patterns:');
  Object.entries(patterns)
    .filter(([_, p]) => p.urlCount > 0)
    .sort((a, b) => b[1].urlCount - a[1].urlCount)
    .slice(0, 20)
    .forEach(([company, p]) => {
      console.log(`  ${company}: ${p.urlCount} URLs (${p.type})`);
    });
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
