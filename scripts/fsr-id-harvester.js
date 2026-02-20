/**
 * FindSalesRep.com ID Harvester
 *
 * Fast, aggressive extraction of user IDs from state+company listing pages.
 * No CAPTCHA solving needed - listing pages are public.
 * Stores IDs in fsr_user_ids collection for the contact scraper to process.
 *
 * Usage:
 *   node scripts/fsr-id-harvester.js --harvest --max-pages=20
 *   node scripts/fsr-id-harvester.js --harvest --state=tx --max-pages=10
 *   node scripts/fsr-id-harvester.js --stats
 *   node scripts/fsr-id-harvester.js --dry-run
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const USER_IDS_COLLECTION = 'fsr_user_ids';
const CONTACTS_COLLECTION = 'fsr_contacts';
const STATE_COLLECTION = 'scraper_state';
const HARVESTER_STATE_DOC = 'fsr_harvester';

// Top 10 US states by population/MLM activity
const PRIORITY_STATES = [
  'tx', 'ca', 'fl', 'ny', 'il',  // Top 5 population
  'pa', 'oh', 'ga', 'nc', 'mi'   // Next 5
];

// Complete company list from FindSalesRep.com search form (272 companies)
const COMPANIES = [
  // A
  '3000bc', '4life-research', '5linx', 'acn', 'adornable.u', 'advocare',
  'all-natural-assets', 'alureve', 'ambit-energy', 'ameo-essential-oils',
  'ameriplan-usa', 'ampegy', 'ams-health-sciences', 'amsoil', 'amway',
  'apriori-beauty', 'arbonne', 'ardyss', 'asea', 'asirvia',
  'athenas-home-novelties', 'ava-anderson-non-toxic', 'avon', 'azuli-skye',
  // B
  'b-epic', 'bandals-footwear', 'barefoot-books', 'bcharmed',
  'beachbody:-p90x,-insanity', 'beauticontrol', 'beauty-society',
  'beautycounter', 'befragrant', 'beijo', 'bella-speranza', 'bellamora',
  'bellaroma:-candles', 'beyond-organic', 'blessings-unlimited', 'body-fx',
  'boresha-international',
  // C
  'celadon-road', 'celebrating-home', 'choffy', 'cieaura', 'clever-container',
  'close-to-my-heart', 'cloud-9-parties', 'color-by-amber', 'color-street',
  'consumer-choice-marketing', 'cookie-lee-jewelry', 'country-gourmet-home',
  'creative-memories', 'cyber-wealth-7',
  // D
  'damsel-in-defense', 'demarle-at-home', 'dirt-broke-gourmet', 'discovery-toys',
  'do-you-bake', 'doterra', 'dove-chocolate-discoveries',
  // E
  'eclipse-candle-company', 'ecosway', 'empowerment-flex-marketing',
  'essante-organics', 'evolv',
  // F
  'facial5', 'fgxpress', 'fibi-and-clo', 'fm-world', 'for-every-home',
  'for-your-pleasure',
  // G
  'gelmoment', 'global-wealth-trade-corp', 'gold-canyon', 'grace-adele',
  'green-mountain-energy', 'green-organics-international',
  // H
  'h2o-at-home', 'hbnaturals', 'healy-world', 'herbalife', 'immunotec-research',
  // I
  'in-a-pikle', 'independence-energy-alliance', 'initial-outfitters',
  'initials-inc', 'intimate-expressions', 'invado-international', 'isagenix',
  'itworks',
  // J
  'j.r.-watkins-naturals', 'jade-and-jasper', 'jafra-cosmetics', 'jamberry-nails',
  'javita', 'jerky-direct', 'jeunesse-global', 'jewel-kade', 'jewelry-in-candles',
  'jockey-person-to-person', 'jordan-essentials', 'jujubelle', 'just-jewelry',
  // K
  'kall8', 'kangen-water', 'karatbars-international', 'keep-collective',
  'kitcheneez', 'kyani',
  // L
  'latasia', 'lattice-and-ivy', 'le-vel', 'legalshield', 'lemongrass-spa',
  'lia-sophia', 'liberty-lady-designs', 'lifepharm-global-network', 'lifevantage',
  'lillia-rose', 'lilybean-and-baxter', 'limu', 'liv', 'livesmart-360',
  'llynda-more-boots', 'longaberger', 'lumaxa', 'lyoness-international',
  // M
  'madison-handbags', 'magnetix-wellness', 'magnolia-and-vine', 'makeup-eraser',
  'mannazo-global', 'mark', 'market-america', 'mary-kay', 'melaleuca',
  'metagenics', 'mia-bath-and-body', 'mialisia', 'miche-bag', 'momentis',
  'monat', 'monavie', 'motor-club-of-america', 'multipure-drinking-water-systems',
  'my-bling-place', 'my-mickey-vacation-travel', 'my-utility-brokers',
  'my-video-talk-usa', 'mynyloxin',
  // N
  'neora', 'new-vision-international', 'nikken', 'north-american-power', 'norwex',
  'novae', 'novica-live', 'nu-skin', 'nutrilite', 'nuverus', 'nyr-organic',
  // O
  'one-hope-wine', 'organo-gold', 'origami-owl', 'our-hearts-desire',
  // P
  'pampered-chef', 'pangea-organics', 'paparazzi-accessories', 'park-lane-jewelry',
  'partygals', 'partylite', 'passion-parties', 'perfectly-posh', 'pet-protector',
  'pink-papaya', 'pink-zebra', 'pirate-n-princess-vacations', 'plannet-marketing',
  'plexus-slim', 'premier-designs', 'primerica', 'princess-house', 'pure-romance',
  'purium-health-products',
  // R
  'radiantly-you', 'real-time-pain-relief', 'regeneration-usa', 'rendi',
  'rodan-and-fields', 'ruby-ribbon',
  // S
  'saba:-ace', 'savvi', 'scent-sations', 'scentsy', 'seacret-direct',
  'send-out-cards', 'senegence', 'sfi', 'shaklee', 'shirley-j',
  'signature-homestyles', 'silpada', 'simply-aroma', 'simply-you',
  'sinsations-parties', 'sisel-international', 'skinny-body-care', 'slumber-parties',
  'solavei', 'solely-jane', 'south-hill-designs', 'stampin-up', 'steeped-tea',
  'stella-and-dot', 'style-dots', 'sunset-gourmet-food-company', 'sweet-minerals',
  'sweet-toy-delights',
  // T
  'tasteful-treasures', 'tastefully-simple', 'team-effort-network',
  'the-gourmet-cupboard', 'the-heart-link-network', 'the-traveling-vineyard',
  'the-trump-network', 'thirty-one-gifts', 'thrive-life', 'tocara',
  'total-life-changes:-iaso-tea', 'touchstone-crystal-by-swarovski',
  'traci-lynn-fashion-jewelry', 'treskinrx', 'trivita', 'truaura-beauty',
  'truvision-health', 'tupperware', 'tyra-beauty',
  // U
  'unicity:-bios-life-slim', 'uppercase-living', 'usana', 'usborne-books',
  // V
  'vasayo', 'vault-denim', 'velata', 'vemma', 'vidacup', 'visalus', 'visi',
  'vitel-wireless', 'votre-vu', 'voyager-health-technologies',
  // W
  'wake-up-now', 'wellmed-global', 'wildtree', 'willow-house', 'wineshop-at-home',
  'wishing-well-travel', 'world-global-network', 'worldventures', 'wowwe',
  // X
  'xango', 'xocai', 'xplocial',
  // Y
  'young-living-essential-oils', 'youngevity', 'younique', 'ytb-travel-network',
  // Z
  'zija-international', 'zinzino', 'zurvita'
];

const TOTAL_COMBINATIONS = PRIORITY_STATES.length * COMPANIES.length; // 2720

// =============================================================================
// GLOBALS
// =============================================================================

let db;
let browser;
let page;

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================

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

// =============================================================================
// BROWSER SETUP (Simplified - no stealth/CAPTCHA plugins needed)
// =============================================================================

async function launchBrowser() {
  const headless = process.env.HEADLESS !== 'false';

  browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  console.log(`Browser launched (headless: ${headless})`);
  return { browser, page };
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    console.log('Browser closed');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

async function getHarvesterState() {
  const doc = await db.collection(STATE_COLLECTION).doc(HARVESTER_STATE_DOC).get();
  if (doc.exists) {
    return doc.data();
  }
  return {
    currentStateIndex: 0,
    currentCompanyIndex: 0,
    totalProcessed: 0,
    totalIdsFound: 0,
    totalIdsSaved: 0,
    lastState: null,
    lastCompany: null,
    updatedAt: null
  };
}

async function updateHarvesterState(updates) {
  await db.collection(STATE_COLLECTION).doc(HARVESTER_STATE_DOC).set({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// =============================================================================
// HARVEST USER IDS FROM STATE+COMPANY PAGES
// =============================================================================

async function harvestUserIds(state, company, dryRun = false) {
  const url = `https://${state}.findsalesrep.com/lc/${company}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1500);

    // Extract all user profile links
    const userLinks = await page.evaluate(() => {
      const links = [];
      const anchors = document.querySelectorAll('a[href*="/users/"]');
      anchors.forEach(a => {
        const href = a.getAttribute('href');
        const match = href.match(/\/users\/(\d+)/);
        if (match) {
          links.push(match[1]);
        }
      });
      return links;
    });

    // Deduplicate
    const uniqueIds = [...new Set(userLinks)];

    if (uniqueIds.length === 0) {
      return { found: 0, saved: 0, skipped: 0 };
    }

    let saved = 0;
    let skipped = 0;

    for (const userId of uniqueIds) {
      // Check if already exists in user_ids collection
      const existingId = await db.collection(USER_IDS_COLLECTION).doc(userId).get();
      if (existingId.exists) {
        skipped++;
        continue;
      }

      // Check if already scraped in contacts collection
      const existingContact = await db.collection(CONTACTS_COLLECTION)
        .where('fsrUserId', '==', userId)
        .limit(1)
        .get();

      if (!existingContact.empty) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        await db.collection(USER_IDS_COLLECTION).doc(userId).set({
          userId: userId,
          profileUrl: `https://www.findsalesrep.com/users/${userId}`,
          sourceState: state,
          sourceCompany: company,
          discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          scraped: false,
          scrapedAt: null
        });
      }
      saved++;
    }

    return { found: uniqueIds.length, saved, skipped };

  } catch (error) {
    console.error(`    Error: ${error.message}`);
    return { found: 0, saved: 0, skipped: 0, error: error.message };
  }
}

async function harvestBatch(maxPages, dryRun = false, specificState = null) {
  console.log(`\nHarvesting user IDs (max pages: ${maxPages}, dry-run: ${dryRun})`);

  const harvesterState = await getHarvesterState();
  let stateIndex = harvesterState.currentStateIndex || 0;
  let companyIndex = harvesterState.currentCompanyIndex || 0;

  // If specific state requested, find its index
  if (specificState) {
    const idx = PRIORITY_STATES.indexOf(specificState.toLowerCase());
    if (idx === -1) {
      console.error(`Invalid state: ${specificState}. Valid states: ${PRIORITY_STATES.join(', ')}`);
      return;
    }
    stateIndex = idx;
    companyIndex = 0;
  }

  let pagesProcessed = 0;
  let totalFound = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  const startPosition = stateIndex * COMPANIES.length + companyIndex;

  while (pagesProcessed < maxPages) {
    const state = PRIORITY_STATES[stateIndex];
    const company = COMPANIES[companyIndex];
    const position = stateIndex * COMPANIES.length + companyIndex + 1;

    console.log(`\n[${pagesProcessed + 1}/${maxPages}] ${state.toUpperCase()}/${company} (${position}/${TOTAL_COMBINATIONS})`);

    const result = await harvestUserIds(state, company, dryRun);

    console.log(`    Found: ${result.found}, Saved: ${result.saved}, Skipped: ${result.skipped}`);

    totalFound += result.found;
    totalSaved += result.saved;
    totalSkipped += result.skipped;
    pagesProcessed++;

    // Advance to next combination (state-first rotation)
    companyIndex++;
    if (companyIndex >= COMPANIES.length) {
      companyIndex = 0;
      stateIndex++;
      if (stateIndex >= PRIORITY_STATES.length) {
        console.log('\n*** FULL CYCLE COMPLETE - Restarting from beginning ***');
        stateIndex = 0;
      }
    }

    // Rate limiting between pages
    if (pagesProcessed < maxPages) {
      await sleep(2000);
    }
  }

  // Save state
  if (!dryRun) {
    await updateHarvesterState({
      currentStateIndex: stateIndex,
      currentCompanyIndex: companyIndex,
      totalProcessed: (harvesterState.totalProcessed || 0) + pagesProcessed,
      totalIdsFound: (harvesterState.totalIdsFound || 0) + totalFound,
      totalIdsSaved: (harvesterState.totalIdsSaved || 0) + totalSaved,
      lastState: PRIORITY_STATES[stateIndex > 0 ? stateIndex - 1 : PRIORITY_STATES.length - 1],
      lastCompany: COMPANIES[companyIndex > 0 ? companyIndex - 1 : COMPANIES.length - 1]
    });
  }

  console.log(`\n=== Harvest Complete ===`);
  console.log(`  Pages processed: ${pagesProcessed}`);
  console.log(`  User IDs found: ${totalFound}`);
  console.log(`  New IDs saved: ${totalSaved}`);
  console.log(`  Duplicates skipped: ${totalSkipped}`);
  console.log(`  Next position: ${PRIORITY_STATES[stateIndex]}/${COMPANIES[companyIndex]} (${stateIndex * COMPANIES.length + companyIndex + 1}/${TOTAL_COMBINATIONS})`);

  return {
    pagesProcessed,
    totalFound,
    totalSaved,
    totalSkipped
  };
}

// =============================================================================
// STATISTICS
// =============================================================================

async function showStats() {
  console.log('\n=== FSR ID Harvester Stats ===\n');

  // Get harvester state
  const state = await getHarvesterState();
  const position = (state.currentStateIndex || 0) * COMPANIES.length + (state.currentCompanyIndex || 0);
  const progress = ((position / TOTAL_COMBINATIONS) * 100).toFixed(1);

  console.log('Harvester Progress:');
  console.log(`  Current position: ${position}/${TOTAL_COMBINATIONS} (${progress}%)`);
  console.log(`  Current state: ${PRIORITY_STATES[state.currentStateIndex || 0]?.toUpperCase() || 'TX'}`);
  console.log(`  Current company: ${COMPANIES[state.currentCompanyIndex || 0] || '3000bc'}`);
  console.log(`  Pages processed: ${state.totalProcessed || 0}`);
  console.log(`  Total IDs found: ${state.totalIdsFound || 0}`);
  console.log(`  Total IDs saved: ${state.totalIdsSaved || 0}`);
  console.log(`  Last updated: ${state.updatedAt?.toDate?.() || 'never'}`);

  // Count user IDs in queue
  const userIdsSnapshot = await db.collection(USER_IDS_COLLECTION).get();
  const unscrapedSnapshot = await db.collection(USER_IDS_COLLECTION)
    .where('scraped', '==', false)
    .get();

  console.log('\nUser IDs Collection:');
  console.log(`  Total discovered: ${userIdsSnapshot.size}`);
  console.log(`  Pending scrape: ${unscrapedSnapshot.size}`);

  // State breakdown
  const byState = {};
  userIdsSnapshot.forEach(doc => {
    const sourceState = doc.data().sourceState || 'unknown';
    byState[sourceState] = (byState[sourceState] || 0) + 1;
  });

  if (Object.keys(byState).length > 0) {
    console.log('\nBy Source State:');
    PRIORITY_STATES.forEach(st => {
      if (byState[st]) {
        console.log(`  ${st.toUpperCase()}: ${byState[st]}`);
      }
    });
  }

  // Estimate completion
  const remainingPages = TOTAL_COMBINATIONS - position;
  const pagesPerRun = 20;
  const runsPerDay = 6;
  const daysRemaining = Math.ceil(remainingPages / (pagesPerRun * runsPerDay));

  console.log('\nEstimated Completion:');
  console.log(`  Remaining pages: ${remainingPages}`);
  console.log(`  At ${pagesPerRun} pages/run, ${runsPerDay} runs/day: ~${daysRemaining} days`);
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    }
  });
  return args;
}

async function main() {
  const args = parseArgs();

  initFirebase();

  // Stats only - no browser needed
  if (args.stats) {
    await showStats();
    return;
  }

  // Launch browser for harvesting
  await launchBrowser();

  try {
    if (args.harvest) {
      const maxPages = parseInt(args['max-pages'] || args.max || '20');
      const dryRun = args['dry-run'] === true;
      const specificState = args.state || null;

      await harvestBatch(maxPages, dryRun, specificState);

    } else {
      console.log(`
FindSalesRep.com ID Harvester

Rapidly extracts user IDs from state+company listing pages.
No CAPTCHA solving needed - runs much faster than the contact scraper.

Usage:
  node scripts/fsr-id-harvester.js --harvest --max-pages=20
  node scripts/fsr-id-harvester.js --harvest --state=tx --max-pages=50
  node scripts/fsr-id-harvester.js --stats
  node scripts/fsr-id-harvester.js --dry-run --max-pages=5

Options:
  --harvest          Start harvesting user IDs
  --max-pages=N      Maximum pages to process (default: 20)
  --state=XX         Start from specific state (tx, ca, fl, etc.)
  --stats            Show statistics
  --dry-run          Preview only, no Firestore writes

Coverage:
  States: ${PRIORITY_STATES.join(', ').toUpperCase()}
  Companies: ${COMPANIES.length}
  Total combinations: ${TOTAL_COMBINATIONS}

Environment:
  HEADLESS=false     Show browser window
`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main().catch(console.error);
