#!/usr/bin/env node

/**
 * MLM Company Rep Search Form Discovery Script
 *
 * Discovers "Find a Rep/Distributor" search forms across MLM company websites
 * and stores the results in Firestore.
 *
 * Usage:
 *   node discover-rep-search.js [options]
 *
 * Options:
 *   --resume           Resume from last progress
 *   --start=N          Start from line N (1-indexed)
 *   --limit=N          Process only N companies
 *   --domain=X         Process single domain (for testing)
 *   --dry-run          Don't write to Firestore
 *   --verbose          Show detailed logging
 *   --concurrency=N    Parallel browsers (default: 3)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  inputFile: path.join(__dirname, 'base_urls.txt'),
  progressFile: path.join(__dirname, 'rep-search-progress.json'),
  firestoreCollection: 'company_rep_search',

  // Timing
  pageTimeout: 15000,
  delayBetweenSites: 1500,
  delayBetweenPaths: 500,

  // Limits
  maxPathsToTry: 15,
  maxLinksToFollow: 5,
  concurrency: 3,
};

// Common URL patterns for rep/distributor finders
const COMMON_PATHS = [
  '/find-a-rep',
  '/find-rep',
  '/find-a-consultant',
  '/find-consultant',
  '/locator',
  '/rep-locator',
  '/consultant-locator',
  '/distributor-locator',
  '/find-distributor',
  '/find-a-distributor',
  '/consultant-finder',
  '/find',
  '/directory',
  '/locate',
  '/near-you',
  '/find-near-you',
  '/search',
  '/ambassador-finder',
  '/find-an-ambassador',
  '/presenter-locator',
  '/find-a-presenter',
];

// Keywords to look for in homepage links
const LINK_KEYWORDS = [
  'find a rep',
  'find rep',
  'find a consultant',
  'find consultant',
  'locate',
  'locator',
  'near you',
  'find distributor',
  'search for',
  'find an ambassador',
  'find presenter',
  'connect with',
  'local representative',
  'find a dealer',
  'find dealer',
  'wellness advocate',
  'find advocate',
  'find an ibo',
  'independent business owner',
  'find a member',
  'find member',
  'shop with',
  'find a stylist',
  'find stylist',
  'find a coach',
  'find coach',
  'find an agent',
  'partner search',
  'representative search',
];

// ═══════════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = {
    resume: false,
    start: 1,
    limit: null,
    domain: null,
    dryRun: false,
    verbose: false,
    concurrency: CONFIG.concurrency,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--resume') args.resume = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg.startsWith('--start=')) args.start = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
    else if (arg.startsWith('--domain=')) args.domain = arg.split('=')[1];
    else if (arg.startsWith('--concurrency=')) args.concurrency = parseInt(arg.split('=')[1], 10);
  }

  return args;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

let db = null;

function initFirebase() {
  const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: Firebase service account not found at:', serviceAccountPath);
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'teambuilder-plus-fe74d'
  });

  db = admin.firestore();
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS TRACKING
// ═══════════════════════════════════════════════════════════════════════════

function loadProgress() {
  if (fs.existsSync(CONFIG.progressFile)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
    } catch (e) {
      console.warn('Warning: Could not parse progress file, starting fresh');
    }
  }
  return {
    lastProcessedIndex: 0,
    startedAt: new Date().toISOString(),
    stats: { total: 0, processed: 0, found: 0, notFound: 0, errors: 0 }
  };
}

function saveProgress(progress) {
  fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUrl(url) {
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  return url.replace(/\/$/, '');
}

function extractDomain(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function normalizeDomainForDocId(domain) {
  return domain.replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

function log(message, args, forceShow = false) {
  if (args.verbose || forceShow) {
    console.log(message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM DETECTION
// ═══════════════════════════════════════════════════════════════════════════

async function detectSearchForm(page, args) {
  try {
    const formData = await page.evaluate(() => {
      // Location-related input patterns
      const locationPatterns = /zip|postal|city|state|location|address|country|region|area|name/i;
      const buttonPatterns = /search|find|locate|go|submit|connect/i;

      // Debug: collect all inputs
      const debugInputs = [];
      document.querySelectorAll('input, select').forEach(input => {
        debugInputs.push({
          tag: input.tagName,
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder
        });
      });

      // Check traditional forms
      const forms = document.querySelectorAll('form');
      for (const form of forms) {
        const inputs = form.querySelectorAll('input, select');
        let locationInputs = [];
        let hasSubmitButton = false;

        for (const input of inputs) {
          const name = (input.name || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const type = input.type || 'text';

          if (locationPatterns.test(name) || locationPatterns.test(placeholder) || locationPatterns.test(id)) {
            locationInputs.push({
              name: input.name || input.id || 'unknown',
              type: type,
              placeholder: input.placeholder || null
            });
          }

          if (type === 'submit' || buttonPatterns.test(input.value || '')) {
            hasSubmitButton = true;
          }
        }

        // Check for button elements in form
        const buttons = form.querySelectorAll('button');
        for (const btn of buttons) {
          if (buttonPatterns.test(btn.textContent || '') || buttonPatterns.test(btn.className || '')) {
            hasSubmitButton = true;
          }
        }

        if (locationInputs.length > 0) {
          return {
            found: true,
            formFields: locationInputs,
            hasSubmitButton,
            formAction: form.action || null,
            formMethod: form.method || 'GET',
            isTraditionalForm: true
          };
        }
      }

      // Check for React/Vue/Angular components with search functionality
      const searchContainers = document.querySelectorAll(
        '[class*="search"], [class*="locator"], [class*="finder"], ' +
        '[id*="search"], [id*="locator"], [class*="rep-find"], ' +
        '[data-component*="locator"], [data-testid*="search"]'
      );

      for (const container of searchContainers) {
        const inputs = container.querySelectorAll('input[type="text"], input[type="search"], input:not([type])');
        let locationInputs = [];

        for (const input of inputs) {
          const name = (input.name || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();

          if (locationPatterns.test(name) || locationPatterns.test(placeholder) ||
              locationPatterns.test(id) || locationPatterns.test(ariaLabel)) {
            locationInputs.push({
              name: input.name || input.id || 'unknown',
              type: input.type || 'text',
              placeholder: input.placeholder || null
            });
          }
        }

        if (locationInputs.length > 0) {
          return {
            found: true,
            formFields: locationInputs,
            hasSubmitButton: true,
            isComponent: true
          };
        }
      }

      // Check for Google Maps integration (common in rep locators)
      const hasMap = document.querySelector('[class*="map"], #map, [id*="google-map"], .gm-style') !== null;

      // Check page content for locator-related text
      const pageText = document.body.innerText.toLowerCase();
      const hasLocatorContent = (
        pageText.includes('enter your zip') ||
        pageText.includes('enter your location') ||
        pageText.includes('find a rep near') ||
        pageText.includes('search by location') ||
        pageText.includes('enter zip code')
      );

      if (hasMap && hasLocatorContent) {
        return {
          found: true,
          formFields: [{ name: 'detected_via_map', type: 'map_integration' }],
          hasMapIntegration: true,
          note: 'Detected via map integration and locator content',
          debugInputs
        };
      }

      // Check if the URL itself indicates this is a search/find page
      const url = window.location.href.toLowerCase();
      const isSearchUrl = (
        url.includes('find') ||
        url.includes('locator') ||
        url.includes('search') ||
        url.includes('advocate') ||
        url.includes('consultant') ||
        url.includes('representative')
      );

      // If URL suggests this is a search page and there's ANY form, count it
      if (isSearchUrl) {
        const anyForms = document.querySelectorAll('form, [class*="form"], [role="form"]');
        const anyInputs = document.querySelectorAll('input:not([type="hidden"]), select');

        if (anyForms.length > 0 || anyInputs.length > 0) {
          return {
            found: true,
            formFields: Array.from(anyInputs).slice(0, 5).map(i => ({
              name: i.name || i.id || 'unknown',
              type: i.type || i.tagName,
              placeholder: i.placeholder
            })),
            note: 'Detected via URL pattern + form/input presence',
            isSearchUrl: true,
            debugInputs
          };
        }
      }

      return { found: false, debugInputs };
    });

    return formData;
  } catch (error) {
    log(`  Form detection error: ${error.message}`, args);
    return { found: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// URL PATTERN DISCOVERY (Phase 1)
// ═══════════════════════════════════════════════════════════════════════════

async function tryUrlPatterns(page, baseUrl, args) {
  const domain = extractDomain(baseUrl);

  for (const urlPath of COMMON_PATHS.slice(0, CONFIG.maxPathsToTry)) {
    const testUrl = `${normalizeUrl(baseUrl)}${urlPath}`;

    try {
      log(`  Trying: ${urlPath}`, args);

      const response = await page.goto(testUrl, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.pageTimeout
      });

      if (!response) continue;

      const status = response.status();
      if (status >= 400) {
        await delay(CONFIG.delayBetweenPaths);
        continue;
      }

      // Wait a bit for JS to render
      await delay(1000);

      // Check if we got redirected to homepage or error page
      const currentUrl = page.url();
      const currentPath = new URL(currentUrl).pathname;
      if (currentPath === '/' || currentPath === '/404' || currentPath.includes('error')) {
        await delay(CONFIG.delayBetweenPaths);
        continue;
      }

      // Detect form
      const formData = await detectSearchForm(page, args);

      if (formData.found) {
        return {
          found: true,
          searchUrl: testUrl,
          finalUrl: currentUrl,
          detectionMethod: 'url_pattern',
          matchedPattern: urlPath,
          ...formData
        };
      }

      await delay(CONFIG.delayBetweenPaths);
    } catch (error) {
      log(`  Error on ${urlPath}: ${error.message}`, args);
      await delay(CONFIG.delayBetweenPaths);
    }
  }

  return { found: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// HOMEPAGE LINK ANALYSIS (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeHomepageLinks(page, baseUrl, args) {
  try {
    log('  Analyzing homepage links...', args);

    await page.goto(normalizeUrl(baseUrl), {
      waitUntil: 'networkidle2',
      timeout: CONFIG.pageTimeout
    });

    await delay(2500); // Wait longer for JS frameworks to render

    // Extract all links from homepage
    const linkData = await page.evaluate((keywords) => {
      const anchors = document.querySelectorAll('a[href]');
      const matchingLinks = [];
      const navLinks = []; // Sample of navigation links for debugging

      for (const anchor of anchors) {
        const href = anchor.href;
        const text = (anchor.textContent || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const ariaLabel = (anchor.getAttribute('aria-label') || '').toLowerCase();
        const title = (anchor.getAttribute('title') || '').toLowerCase();

        // Collect sample nav links for debugging
        if (text.length > 0 && text.length < 50 && navLinks.length < 20) {
          navLinks.push(text.substring(0, 40));
        }

        // Check if link text or attributes match our keywords
        const combined = `${text} ${ariaLabel} ${title}`;

        for (const keyword of keywords) {
          if (combined.includes(keyword.toLowerCase())) {
            matchingLinks.push({
              href,
              text: text.substring(0, 50),
              keyword
            });
            break;
          }
        }
      }

      return { matchingLinks, navLinks, totalLinks: anchors.length };
    }, LINK_KEYWORDS);

    const links = linkData.matchingLinks;

    log(`  Found ${linkData.totalLinks} total links, ${links.length} matching`, args);
    if (args.verbose && linkData.navLinks.length > 0) {
      log(`  Sample nav links: ${linkData.navLinks.slice(0, 10).join(' | ')}`, args);
    }

    // Try following the most promising links
    for (const link of links.slice(0, CONFIG.maxLinksToFollow)) {
      try {
        log(`  Following: "${link.text}" -> ${link.href}`, args);

        await page.goto(link.href, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.pageTimeout
        });

        await delay(1000);

        const formData = await detectSearchForm(page, args);

        if (formData.found) {
          // Clean up debug info before returning
          delete formData.debugInputs;
          return {
            found: true,
            searchUrl: link.href,
            finalUrl: page.url(),
            detectionMethod: 'homepage_link',
            matchedLinkText: link.text,
            ...formData
          };
        } else if (args.verbose && formData.debugInputs && formData.debugInputs.length > 0) {
          log(`    Page has ${formData.debugInputs.length} inputs: ${formData.debugInputs.slice(0, 5).map(i => i.name || i.type).join(', ')}`, args);
        }

        await delay(CONFIG.delayBetweenPaths);
      } catch (error) {
        log(`  Error following link: ${error.message}`, args);
      }
    }

    return { found: false };
  } catch (error) {
    log(`  Homepage analysis error: ${error.message}`, args);
    return { found: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPANY PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

async function processCompany(browser, url, args) {
  const domain = extractDomain(url);
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    // Phase 1: Try URL patterns
    let result = await tryUrlPatterns(page, url, args);

    // Phase 2: Analyze homepage links if Phase 1 failed
    if (!result.found) {
      result = await analyzeHomepageLinks(page, url, args);
    }

    // Build final result object
    const finalResult = {
      companyDomain: domain,
      status: result.found ? 'found' : 'not_found',
      detectedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...result
    };

    // Remove the 'found' boolean as we have 'status'
    delete finalResult.found;

    return finalResult;

  } catch (error) {
    return {
      companyDomain: domain,
      status: 'error',
      errorMessage: error.message,
      errorType: categorizeError(error),
      detectedAt: admin.firestore.FieldValue.serverTimestamp()
    };
  } finally {
    await page.close();
  }
}

function categorizeError(error) {
  const message = error.message.toLowerCase();
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('dns') || message.includes('getaddrinfo')) return 'dns_failure';
  if (message.includes('ssl') || message.includes('cert')) return 'ssl_error';
  if (message.includes('403') || message.includes('blocked')) return 'blocked';
  if (message.includes('redirect')) return 'redirect_loop';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

async function saveToFirestore(result, args) {
  if (args.dryRun) {
    log(`  [DRY-RUN] Would save to Firestore: ${result.companyDomain}`, args, true);
    return;
  }

  const docId = normalizeDomainForDocId(result.companyDomain);

  try {
    await db.collection(CONFIG.firestoreCollection).doc(docId).set(result, { merge: true });
    log(`  Saved to Firestore: ${docId}`, args);
  } catch (error) {
    console.error(`  Firestore error: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = parseArgs();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  MLM Rep Search Discovery');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Load URLs
  let urls = [];

  if (args.domain) {
    urls = [args.domain];
    console.log(`  Mode: Single domain (${args.domain})`);
  } else {
    if (!fs.existsSync(CONFIG.inputFile)) {
      console.error(`ERROR: Input file not found: ${CONFIG.inputFile}`);
      process.exit(1);
    }

    const content = fs.readFileSync(CONFIG.inputFile, 'utf-8');
    urls = content.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    console.log(`  Input: ${urls.length} companies`);
  }

  // Initialize Firebase
  if (!args.dryRun) {
    initFirebase();
  }

  // Load or initialize progress
  let progress = loadProgress();

  if (args.resume && progress.lastProcessedIndex > 0) {
    args.start = progress.lastProcessedIndex + 1;
    console.log(`  Resuming from index: ${args.start}`);
  }

  progress.stats.total = urls.length;

  // Apply start/limit
  const startIndex = args.start - 1;
  const endIndex = args.limit ? Math.min(startIndex + args.limit, urls.length) : urls.length;
  const urlsToProcess = urls.slice(startIndex, endIndex);

  console.log(`  Processing: ${urlsToProcess.length} companies (${args.start} to ${endIndex})`);
  console.log(`  Concurrency: ${args.concurrency}`);
  console.log(`  Dry run: ${args.dryRun}`);
  console.log(`  Verbose: ${args.verbose}`);
  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('');

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const startTime = Date.now();

  try {
    // Process URLs with limited concurrency
    for (let i = 0; i < urlsToProcess.length; i += args.concurrency) {
      const batch = urlsToProcess.slice(i, i + args.concurrency);
      const batchStartIndex = startIndex + i;

      const promises = batch.map(async (url, batchIdx) => {
        const globalIdx = batchStartIndex + batchIdx + 1;
        const domain = extractDomain(url);

        console.log(`[${globalIdx}/${urls.length}] ${domain}`);

        const result = await processCompany(browser, url, args);

        // Log result
        if (result.status === 'found') {
          console.log(`  ✓ Found: ${result.matchedPattern || result.matchedLinkText || 'detected'} (${result.detectionMethod})`);
          console.log(`  → ${result.searchUrl}`);
          if (result.formFields && result.formFields.length > 0) {
            const fields = result.formFields.map(f => f.name || f.type).join(', ');
            console.log(`  Form: ${fields}`);
          }
          progress.stats.found++;
        } else if (result.status === 'error') {
          console.log(`  ⚠ Error: ${result.errorType} - ${result.errorMessage}`);
          progress.stats.errors++;
        } else {
          console.log('  ✗ Not found');
          progress.stats.notFound++;
        }

        // Save to Firestore
        await saveToFirestore(result, args);

        progress.stats.processed++;
        progress.lastProcessedIndex = globalIdx;

        return result;
      });

      await Promise.all(promises);

      // Save progress periodically
      if (!args.dryRun) {
        saveProgress(progress);
      }

      // Progress update
      if ((i + args.concurrency) % 30 === 0 || i + args.concurrency >= urlsToProcess.length) {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = urlsToProcess.length - (i + args.concurrency);
        const rate = (i + args.concurrency) / elapsed;
        const eta = remaining > 0 ? Math.round(remaining / rate / 60) : 0;

        console.log('');
        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`Progress: ${progress.stats.processed}/${urlsToProcess.length} | ` +
                   `Found: ${progress.stats.found} | Not Found: ${progress.stats.notFound} | ` +
                   `Errors: ${progress.stats.errors} | ETA: ${eta}m`);
        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log('');
      }

      // Delay between batches
      await delay(CONFIG.delayBetweenSites);
    }

  } finally {
    await browser.close();
  }

  // Final summary
  const totalTime = Math.round((Date.now() - startTime) / 1000 / 60);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('  DISCOVERY COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Total Processed:    ${progress.stats.processed}`);
  console.log(`  Search Forms Found: ${progress.stats.found} (${(progress.stats.found / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log(`  Not Found:          ${progress.stats.notFound} (${(progress.stats.notFound / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log(`  Errors:             ${progress.stats.errors} (${(progress.stats.errors / progress.stats.processed * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`  Duration: ${totalTime} minutes`);
  console.log(`  Results: Firestore collection '${CONFIG.firestoreCollection}'`);
  console.log('');
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
