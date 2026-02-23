#!/usr/bin/env node
/**
 * Paparazzi Accessories Representative Scraper
 *
 * Discovers Paparazzi representative URLs via HTTP enumeration (6-digit subdomains
 * like 135694.paparazziexp.com) and scrapes name/email into Firestore.
 *
 * URL Structure:
 *   - Representative sites use 6-digit numeric subdomains (000000-999999)
 *   - Example: https://135694.paparazziexp.com
 *   - Contact page: https://135694.paparazziexp.com/contact
 *
 * Discovery Method:
 *   HTTP enumeration - checks if subdomains exist by making HEAD requests.
 *   Much more effective than SerpApi since Google only indexes a tiny fraction.
 *
 * Usage:
 *   node paparazzi-scraper.js --discover                      # Discover from last position
 *   node paparazzi-scraper.js --discover --start=100000       # Start from specific ID
 *   node paparazzi-scraper.js --discover --start=100000 --end=200000  # Scan range
 *   node paparazzi-scraper.js --discover --random             # Random sampling mode
 *   node paparazzi-scraper.js --scrape                        # Scrape discovered URLs
 *   node paparazzi-scraper.js --discover --scrape             # Both in one run
 *   node paparazzi-scraper.js --max=100                       # Max new reps per run
 *   node paparazzi-scraper.js --dry-run                       # Preview only
 *   node paparazzi-scraper.js --stats                         # Show collection stats
 *   node paparazzi-scraper.js --reset-discovery               # Reset discovery position
 */

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore collections
  CONTACTS_COLLECTION: 'paparazzi_contacts',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'paparazzi',
  DISCOVERED_IDS_COLLECTION: 'paparazzi_discovered_ids',

  // Discovery settings
  MIN_REP_ID: 100000,              // Minimum 6-digit ID to check
  MAX_REP_ID: 999999,              // Maximum 6-digit ID
  CONCURRENT_CHECKS: 20,           // Parallel HTTP requests for discovery
  CHECK_TIMEOUT: 5000,             // 5 second timeout for existence checks
  IDS_TO_CHECK_PER_RUN: 5000,      // How many IDs to check per discovery run

  // Scraping settings
  DELAY_BETWEEN_FETCHES: 1000,     // 1 second between contact page fetches
  DELAY_JITTER: 500,               // Random jitter up to 0.5 seconds
  MAX_REPS_PER_RUN: 100,           // Max new reps to save per run
  REQUEST_TIMEOUT: 15000,          // 15 second timeout for scraping

  // User agent for requests
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

function randomDelay(baseDelay) {
  const jitter = Math.random() * CONFIG.DELAY_JITTER;
  return baseDelay + jitter;
}

function formatRepId(num) {
  return String(num).padStart(6, '0');
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };

  const normalized = fullName.trim().replace(/\s+/g, ' ');
  const parts = normalized.split(' ');

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

async function getScraperState() {
  const doc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (doc.exists) {
    return doc.data();
  }

  const defaultState = {
    lastRunAt: null,
    lastDiscoveryAt: null,
    discoveryPosition: CONFIG.MIN_REP_ID,  // Current position in sequential scan
    totalRepsFound: 0,
    totalDiscovered: 0,
    totalIdsChecked: 0,
  };

  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).set(defaultState);
  return defaultState;
}

async function updateScraperState(updates) {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).update({
    ...updates,
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function resetDiscoveryPosition() {
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).update({
    discoveryPosition: CONFIG.MIN_REP_ID,
  });
  console.log(`Discovery position reset to ${CONFIG.MIN_REP_ID}`);
}

// ============================================================================
// DISCOVERY PHASE - HTTP Enumeration
// ============================================================================

/**
 * Check if a rep ID exists by making a HEAD request
 */
async function checkRepExists(repId) {
  const url = `https://${repId}.paparazziexp.com`;

  try {
    const response = await axios.head(url, {
      timeout: CONFIG.CHECK_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
    });

    // 200 = exists, 404 = doesn't exist
    return response.status === 200;
  } catch (error) {
    // Connection errors, timeouts = doesn't exist
    return false;
  }
}

/**
 * Check multiple IDs in parallel
 */
async function checkRepsBatch(repIds) {
  const results = await Promise.all(
    repIds.map(async (repId) => {
      const exists = await checkRepExists(repId);
      return { repId, exists };
    })
  );

  return results.filter(r => r.exists).map(r => r.repId);
}

/**
 * Discover rep IDs via HTTP enumeration
 */
async function discoverRepIds(options = {}) {
  const {
    start = null,
    end = null,
    random = false,
    maxToCheck = CONFIG.IDS_TO_CHECK_PER_RUN,
    dryRun = false,
  } = options;

  const state = await getScraperState();

  console.log('\n=== Discovery Phase (HTTP Enumeration) ===\n');

  let idsToCheck = [];

  if (random) {
    // Random sampling mode
    console.log(`Mode: Random sampling (${maxToCheck} IDs)`);
    const checked = new Set();

    while (idsToCheck.length < maxToCheck) {
      const randomId = formatRepId(
        Math.floor(Math.random() * (CONFIG.MAX_REP_ID - CONFIG.MIN_REP_ID + 1)) + CONFIG.MIN_REP_ID
      );
      if (!checked.has(randomId)) {
        checked.add(randomId);
        idsToCheck.push(randomId);
      }
    }
  } else {
    // Sequential scan mode
    const startPos = start !== null ? start : (state.discoveryPosition || CONFIG.MIN_REP_ID);
    const endPos = end !== null ? end : Math.min(startPos + maxToCheck, CONFIG.MAX_REP_ID + 1);

    console.log(`Mode: Sequential scan`);
    console.log(`Range: ${formatRepId(startPos)} to ${formatRepId(endPos - 1)}`);

    for (let i = startPos; i < endPos; i++) {
      idsToCheck.push(formatRepId(i));
    }
  }

  console.log(`IDs to check: ${idsToCheck.length}`);
  console.log(`Concurrent requests: ${CONFIG.CONCURRENT_CHECKS}`);
  console.log('');

  const discoveredIds = [];
  let checked = 0;

  // Process in batches
  for (let i = 0; i < idsToCheck.length; i += CONFIG.CONCURRENT_CHECKS) {
    const batch = idsToCheck.slice(i, i + CONFIG.CONCURRENT_CHECKS);
    const found = await checkRepsBatch(batch);

    discoveredIds.push(...found);
    checked += batch.length;

    // Progress update every 500 IDs
    if (checked % 500 === 0 || checked === idsToCheck.length) {
      const pct = ((checked / idsToCheck.length) * 100).toFixed(1);
      console.log(`  Checked: ${checked}/${idsToCheck.length} (${pct}%) | Found: ${discoveredIds.length}`);
    }
  }

  console.log(`\nDiscovery complete:`);
  console.log(`  IDs checked: ${checked}`);
  console.log(`  Reps found: ${discoveredIds.length}`);
  console.log(`  Hit rate: ${((discoveredIds.length / checked) * 100).toFixed(2)}%`);

  // Save discovered IDs to Firestore
  if (!dryRun && discoveredIds.length > 0) {
    console.log('\nSaving discovered IDs to Firestore...');

    let newIds = 0;
    for (const repId of discoveredIds) {
      const docRef = db.collection(CONFIG.DISCOVERED_IDS_COLLECTION).doc(repId);
      const existing = await docRef.get();

      if (!existing.exists) {
        await docRef.set({
          repId,
          discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          scraped: false,
        });
        newIds++;
      }
    }

    console.log(`  New IDs saved: ${newIds}`);
    console.log(`  Already known: ${discoveredIds.length - newIds}`);

    // Update state with new position (for sequential mode)
    const updates = {
      lastDiscoveryAt: admin.firestore.FieldValue.serverTimestamp(),
      totalDiscovered: admin.firestore.FieldValue.increment(newIds),
      totalIdsChecked: admin.firestore.FieldValue.increment(checked),
    };

    if (!random && start === null) {
      // Update position for next sequential run
      updates.discoveryPosition = (state.discoveryPosition || CONFIG.MIN_REP_ID) + idsToCheck.length;
    }

    await updateScraperState(updates);
  }

  return discoveredIds;
}

// ============================================================================
// SCRAPING PHASE - Fetch contact pages and extract data
// ============================================================================

async function scrapeContactPage(repId) {
  const url = `https://${repId}.paparazziexp.com/contact`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': CONFIG.USER_AGENT },
      timeout: CONFIG.REQUEST_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    // Extract email from mailto: link
    let email = null;
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const extracted = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (extracted && extracted.includes('@')) {
          email = extracted;
          return false; // Break loop
        }
      }
    });

    // Extract phone from tel: link
    let phone = null;
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        phone = href.replace('tel:', '').trim();
        return false;
      }
    });

    // Extract name from badge-name span (primary) - get first one only
    let fullName = null;
    const badgeName = $('.badge-name').first();
    if (badgeName.length) {
      fullName = badgeName.text().trim().replace(/\s+/g, ' ');
    }

    // Fallback: badge image alt/title
    if (!fullName) {
      const badgeImg = $('.badge img');
      if (badgeImg.length) {
        fullName = badgeImg.attr('alt') || badgeImg.attr('title');
      }
    }

    // Fallback: parse og:title (format: "Request Info Name")
    if (!fullName) {
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle && ogTitle.startsWith('Request Info ')) {
        fullName = ogTitle.replace('Request Info ', '').trim();
      }
    }

    return {
      repId,
      fullName,
      email,
      phone,
      profileUrl: `https://${repId}.paparazziexp.com`,
      success: true,
    };

  } catch (error) {
    return {
      repId,
      success: false,
      error: error.message,
    };
  }
}

async function scrapeReps(options = {}) {
  const {
    maxReps = CONFIG.MAX_REPS_PER_RUN,
    dryRun = false,
    repIds = null, // Optional: specific IDs to scrape
  } = options;

  console.log('\n=== Scraping Phase ===\n');

  // Get IDs to scrape
  let idsToScrape;

  if (repIds && repIds.length > 0) {
    idsToScrape = repIds;
    console.log(`Using ${idsToScrape.length} provided rep IDs`);
  } else {
    // Get unscraped IDs from discovery collection
    const snapshot = await db.collection(CONFIG.DISCOVERED_IDS_COLLECTION)
      .where('scraped', '==', false)
      .limit(maxReps * 2) // Fetch extra in case some fail
      .get();

    idsToScrape = [];
    snapshot.forEach(doc => idsToScrape.push(doc.id));

    console.log(`Found ${idsToScrape.length} unscraped rep IDs in Firestore`);
  }

  if (idsToScrape.length === 0) {
    console.log('No rep IDs to scrape. Run --discover first.');
    return { scraped: 0, saved: 0, duplicates: 0, failed: 0 };
  }

  let scraped = 0;
  let saved = 0;
  let duplicates = 0;
  let failed = 0;
  let noEmail = 0;

  for (const repId of idsToScrape) {
    if (saved >= maxReps) {
      console.log(`\nReached max reps limit (${maxReps})`);
      break;
    }

    process.stdout.write(`Scraping ${repId}...`);
    scraped++;

    const data = await scrapeContactPage(repId);

    if (!data.success) {
      console.log(` Failed: ${data.error}`);
      failed++;
      continue;
    }

    if (!data.email) {
      console.log(` No email (${data.fullName || 'unknown'})`);
      noEmail++;

      // Mark as scraped even if no email
      if (!dryRun) {
        await db.collection(CONFIG.DISCOVERED_IDS_COLLECTION).doc(repId).update({
          scraped: true,
          scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
          hasEmail: false,
        });
      }
      continue;
    }

    // Check if already exists in contacts
    const docId = `paparazzi_${repId}`;
    const existing = await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).get();

    if (existing.exists) {
      console.log(` Duplicate`);
      duplicates++;

      if (!dryRun) {
        await db.collection(CONFIG.DISCOVERED_IDS_COLLECTION).doc(repId).update({
          scraped: true,
        });
      }
      continue;
    }

    // Save to contacts
    if (dryRun) {
      console.log(` [DRY RUN] ${data.fullName} <${data.email}>`);
      saved++;
    } else {
      const { firstName, lastName } = parseName(data.fullName);

      const doc = {
        // Identity
        firstName,
        lastName,
        fullName: data.fullName || '',
        repId: data.repId,

        // Contact
        email: data.email,
        phone: data.phone || null,

        // Source
        company: 'Paparazzi Accessories',
        source: 'paparazzi_rep_search',
        profileUrl: data.profileUrl,

        // Campaign fields
        scraped: true,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
        sentTimestamp: null,
        clicked: false,
        clickedAt: null,
        randomIndex: Math.random(),

        // Status
        status: 'pending',
        errorMessage: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection(CONFIG.CONTACTS_COLLECTION).doc(docId).set(doc);

      // Mark as scraped in discovery collection
      await db.collection(CONFIG.DISCOVERED_IDS_COLLECTION).doc(repId).update({
        scraped: true,
        scrapedAt: admin.firestore.FieldValue.serverTimestamp(),
        hasEmail: true,
      });

      saved++;
      console.log(` Saved: ${data.fullName} <${data.email}>`);
    }

    // Rate limit
    await sleep(randomDelay(CONFIG.DELAY_BETWEEN_FETCHES));
  }

  // Update state
  if (!dryRun && saved > 0) {
    await updateScraperState({
      totalRepsFound: admin.firestore.FieldValue.increment(saved),
    });
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Scraped: ${scraped}`);
  console.log(`Saved: ${saved}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`No email: ${noEmail}`);
  console.log(`Failed: ${failed}`);

  return { scraped, saved, duplicates, noEmail, failed };
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.CONTACTS_COLLECTION);
  const discoveredCollection = db.collection(CONFIG.DISCOVERED_IDS_COLLECTION);

  const [total, withEmail, sent, clicked] = await Promise.all([
    collection.count().get(),
    collection.where('email', '!=', null).count().get(),
    collection.where('sent', '==', true).count().get(),
    collection.where('clicked', '==', true).count().get(),
  ]);

  const [totalDiscovered, unscraped] = await Promise.all([
    discoveredCollection.count().get(),
    discoveredCollection.where('scraped', '==', false).count().get(),
  ]);

  console.log('\n=== Paparazzi Contacts Stats ===');
  console.log(`Total contacts: ${total.data().count}`);
  console.log(`With email: ${withEmail.data().count}`);
  console.log(`Emails sent: ${sent.data().count}`);
  console.log(`Clicks: ${clicked.data().count}`);

  console.log('\nDiscovery Stats:');
  console.log(`  Total IDs discovered: ${totalDiscovered.data().count}`);
  console.log(`  Unscraped IDs: ${unscraped.data().count}`);

  // Show state
  const state = await getScraperState();
  console.log('\nScraper State:');
  console.log(`  Last run: ${state.lastRunAt ? state.lastRunAt.toDate().toISOString() : '(never)'}`);
  console.log(`  Discovery position: ${formatRepId(state.discoveryPosition || CONFIG.MIN_REP_ID)}`);
  console.log(`  Total IDs checked: ${state.totalIdsChecked || 0}`);

  // Calculate coverage
  const totalPossible = CONFIG.MAX_REP_ID - CONFIG.MIN_REP_ID + 1;
  const coverage = ((state.totalIdsChecked || 0) / totalPossible * 100).toFixed(2);
  console.log(`  Coverage: ${coverage}% of ${totalPossible.toLocaleString()} possible IDs`);
  console.log('');

  // Show sample contacts
  const sample = await collection.orderBy('createdAt', 'desc').limit(5).get();
  if (!sample.empty) {
    console.log('Recent contacts:');
    sample.forEach(doc => {
      const d = doc.data();
      console.log(`  - ${d.fullName} <${d.email}> (${d.repId})`);
    });
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const discover = args.includes('--discover');
  const scrape = args.includes('--scrape');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');
  const random = args.includes('--random');
  const resetDiscovery = args.includes('--reset-discovery');

  // Parse options
  let maxReps = CONFIG.MAX_REPS_PER_RUN;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxReps = parseInt(maxArg.split('=')[1]) || maxReps;
  }

  let start = null;
  const startArg = args.find(a => a.startsWith('--start='));
  if (startArg) {
    start = parseInt(startArg.split('=')[1]);
  }

  let end = null;
  const endArg = args.find(a => a.startsWith('--end='));
  if (endArg) {
    end = parseInt(endArg.split('=')[1]);
  }

  let maxToCheck = CONFIG.IDS_TO_CHECK_PER_RUN;
  const checkArg = args.find(a => a.startsWith('--check='));
  if (checkArg) {
    maxToCheck = parseInt(checkArg.split('=')[1]) || maxToCheck;
  }

  if (!discover && !scrape && !stats && !resetDiscovery) {
    console.log('Paparazzi Accessories Representative Scraper\n');
    console.log('Usage:');
    console.log('  node paparazzi-scraper.js --discover                      # Discover from last position');
    console.log('  node paparazzi-scraper.js --discover --start=100000       # Start from specific ID');
    console.log('  node paparazzi-scraper.js --discover --start=100000 --end=200000  # Scan range');
    console.log('  node paparazzi-scraper.js --discover --random             # Random sampling mode');
    console.log('  node paparazzi-scraper.js --discover --check=10000        # Check N IDs per run');
    console.log('  node paparazzi-scraper.js --scrape                        # Scrape discovered URLs');
    console.log('  node paparazzi-scraper.js --discover --scrape             # Both in one run');
    console.log('  node paparazzi-scraper.js --max=100                       # Max reps to save per run');
    console.log('  node paparazzi-scraper.js --dry-run                       # Preview only');
    console.log('  node paparazzi-scraper.js --stats                         # Show collection stats');
    console.log('  node paparazzi-scraper.js --reset-discovery               # Reset discovery position');
    console.log('');
    console.log('Examples:');
    console.log('  # Quick test: check 1000 random IDs');
    console.log('  node paparazzi-scraper.js --discover --random --check=1000 --dry-run');
    console.log('');
    console.log('  # Full scan: check 100000-200000 range and scrape');
    console.log('  node paparazzi-scraper.js --discover --start=100000 --end=200000 --scrape');
    console.log('');
    process.exit(1);
  }

  initFirebase();

  if (resetDiscovery) {
    await resetDiscoveryPosition();
    process.exit(0);
  }

  if (stats && !discover && !scrape) {
    await showStats();
    process.exit(0);
  }

  let discoveredIds = [];

  if (discover) {
    discoveredIds = await discoverRepIds({
      start,
      end,
      random,
      maxToCheck,
      dryRun,
    });
  }

  if (scrape) {
    // If we just discovered, use those IDs; otherwise fetch from Firestore
    await scrapeReps({
      maxReps,
      dryRun,
      repIds: discover ? discoveredIds : null,
    });
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
