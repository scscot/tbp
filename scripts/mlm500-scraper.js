#!/usr/bin/env node
/**
 * MLM 500 Top Earners Scraper
 *
 * Scrapes the MLM 500 Top Earners page from Business For Home,
 * deduplicates against Recommended Distributors at source level,
 * and stores net-new contacts in Firestore for email search.
 *
 * Usage:
 *   node scripts/mlm500-scraper.js --scrape            # Scrape and store net-new contacts
 *   node scripts/mlm500-scraper.js --scrape --dry-run  # Preview without saving
 *   node scripts/mlm500-scraper.js --migrate-to-bfh    # Move contacts with emails to bfh_contacts
 *   node scripts/mlm500-scraper.js --stats             # Show collection stats
 *
 * Data Flow:
 *   1. Scrape MLM 500 Top Earners (Puppeteer)
 *   2. Scrape Recommended Distributors (WordPress API)
 *   3. Compute set difference (MLM 500 - Recommended)
 *   4. Store net-new contacts in mlm500_staging
 *   5. Run SerpAPI search (via bfh-email-search.js --collection=mlm500_staging)
 *   6. Migrate contacts with emails to bfh_contacts
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // URLs
  MLM_500_URL: 'https://www.businessforhome.org/mlm-500-top-earners/',
  RECOMMENDED_API: 'https://www.businessforhome.org/wp-json/wp/v2/distributor',

  // Firestore collections
  STAGING_COLLECTION: 'mlm500_staging',
  BFH_CONTACTS_COLLECTION: 'bfh_contacts',

  // Rate limiting
  PAGE_DELAY_MS: 2000,
  API_DELAY_MS: 1000,

  // Puppeteer
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

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };

  // Clean up HTML entities and extra whitespace
  const cleaned = fullName
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function normalizeNameKey(firstName, lastName) {
  return `${(firstName || '').toLowerCase().trim()}_${(lastName || '').toLowerCase().trim()}`;
}

function parseMoneyValue(value) {
  if (!value) return null;
  // Remove $, commas, and parse
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// ============================================================================
// PHASE 1A: SCRAPE MLM 500 TOP EARNERS (PUPPETEER)
// ============================================================================

async function scrapeMLM500() {
  console.log('\n=== Phase 1A: Scraping MLM 500 Top Earners ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(CONFIG.USER_AGENT);
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('Loading MLM 500 page...');
  await page.goto(CONFIG.MLM_500_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for the BFH table to load
  try {
    await page.waitForSelector('table.bfh-table tbody tr', { timeout: 30000 });
    console.log('BFH table loaded');
  } catch (e) {
    // Take screenshot for debugging
    await page.screenshot({ path: '/tmp/mlm500-debug.png', fullPage: true });
    console.log('Debug screenshot saved to /tmp/mlm500-debug.png');
    throw new Error('Could not find BFH data table on page');
  }

  // Give extra time for data to fully render
  await sleep(2000);

  const allContacts = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    // Extract data from current page
    const pageData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table.bfh-table tbody tr');
      const contacts = [];

      // Column headers to strip from cell text
      const headerPrefixes = ['Nr.', 'Name', 'Est. Month', 'Est. Year', 'Company'];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          // Helper to clean cell text by removing header prefix
          const getCellText = (cell, headerPrefix) => {
            if (!cell) return '';
            let text = cell.textContent?.trim() || '';
            // Remove header prefix if present (BFH includes headers in mobile view)
            if (text.startsWith(headerPrefix)) {
              text = text.substring(headerPrefix.length).trim();
            }
            return text;
          };

          // Column order: Nr. (0), Name (1), Est. Month (2), Est. Year (3), Company (4)
          const rankText = getCellText(cells[0], 'Nr.');
          const rank = parseInt(rankText) || 0;

          // Name cell - get from link if present
          let fullName = '';
          const nameCell = cells[1];
          if (nameCell) {
            const link = nameCell.querySelector('a');
            if (link) {
              fullName = link.textContent.trim();
            } else {
              fullName = getCellText(nameCell, 'Name');
            }
          }

          const estMonthly = getCellText(cells[2], 'Est. Month');
          const estAnnual = getCellText(cells[3], 'Est. Year');

          // Company - get from link if present
          let company = '';
          const companyCell = cells[4];
          if (companyCell) {
            const link = companyCell.querySelector('a');
            if (link) {
              company = link.textContent.trim();
            } else {
              company = getCellText(companyCell, 'Company');
            }
          }

          if (fullName && rank > 0) {
            contacts.push({
              rank,
              fullName,
              company: company || null,
              estMonthly,
              estAnnual
            });
          }
        }
      });

      return contacts;
    });

    console.log(`Page ${currentPage}: Found ${pageData.length} entries`);
    allContacts.push(...pageData);

    // Check for BFH-specific next button
    const nextButton = await page.$('#top-earner-next-page.available');

    if (nextButton) {
      // Get first row rank before clicking to verify page changed
      const firstRankBefore = allContacts.length > 0 ? allContacts[allContacts.length - pageData.length]?.rank : 0;

      await nextButton.click();
      await sleep(CONFIG.PAGE_DELAY_MS);

      // Wait for table content to change
      try {
        await page.waitForFunction(
          (prevFirstRank) => {
            const firstRow = document.querySelector('table.bfh-table tbody tr');
            if (!firstRow) return false;
            const firstCell = firstRow.querySelector('td');
            if (!firstCell) return false;
            let rankText = firstCell.textContent.trim();
            // Remove "Nr." prefix if present
            if (rankText.startsWith('Nr.')) rankText = rankText.substring(3).trim();
            const currentRank = parseInt(rankText) || 0;
            return currentRank !== prevFirstRank;
          },
          { timeout: 10000 },
          firstRankBefore
        );
      } catch (e) {
        console.log(`  Warning: page change detection timed out, continuing...`);
      }
      currentPage++;
    } else {
      hasNextPage = false;
      console.log('No more pages (Next button not available)');
    }
  }

  await browser.close();

  // Parse names
  const parsedContacts = allContacts.map(c => {
    const { firstName, lastName } = parseName(c.fullName);
    return {
      ...c,
      firstName,
      lastName,
      estMonthlyValue: parseMoneyValue(c.estMonthly),
      estAnnualValue: parseMoneyValue(c.estAnnual)
    };
  });

  console.log(`\nTotal MLM 500 entries scraped: ${parsedContacts.length}`);
  return parsedContacts;
}

// ============================================================================
// PHASE 1B: FETCH RECOMMENDED DISTRIBUTORS (WORDPRESS API)
// ============================================================================

async function fetchRecommendedDistributors() {
  console.log('\n=== Phase 1B: Fetching Recommended Distributors ===\n');

  const allDistributors = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${CONFIG.RECOMMENDED_API}?per_page=100&page=${page}`;
    console.log(`Fetching API page ${page}...`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      const distributors = response.data;
      const totalPages = parseInt(response.headers['x-wp-totalpages']) || 1;

      if (page === 1) {
        const total = parseInt(response.headers['x-wp-total']) || 0;
        console.log(`Total recommended distributors: ${total}`);
      }

      for (const dist of distributors) {
        const fullName = dist.title?.rendered || '';
        const { firstName, lastName } = parseName(fullName);

        allDistributors.push({
          slug: dist.slug,
          fullName,
          firstName,
          lastName
        });
      }

      hasMore = page < totalPages;
      page++;

      if (hasMore) {
        await sleep(CONFIG.API_DELAY_MS);
      }

    } catch (error) {
      if (error.response?.status === 400) {
        hasMore = false;
      } else {
        console.error(`Error fetching page ${page}: ${error.message}`);
        hasMore = false;
      }
    }
  }

  console.log(`Total recommended distributors fetched: ${allDistributors.length}`);
  return allDistributors;
}

// ============================================================================
// PHASE 2: COMPUTE SET DIFFERENCE
// ============================================================================

function computeSetDifference(mlm500Contacts, recommendedDistributors) {
  console.log('\n=== Phase 2: Computing Set Difference ===\n');

  // Build set of recommended distributor names
  const recommendedNames = new Set();
  for (const dist of recommendedDistributors) {
    const nameKey = normalizeNameKey(dist.firstName, dist.lastName);
    recommendedNames.add(nameKey);
  }

  // Filter MLM 500 to only net-new contacts
  const netNewContacts = mlm500Contacts.filter(contact => {
    const nameKey = normalizeNameKey(contact.firstName, contact.lastName);
    return !recommendedNames.has(nameKey);
  });

  const overlap = mlm500Contacts.length - netNewContacts.length;

  console.log(`MLM 500 contacts: ${mlm500Contacts.length}`);
  console.log(`Recommended Distributors: ${recommendedDistributors.length}`);
  console.log(`Overlap (name match): ${overlap}`);
  console.log(`Net new contacts: ${netNewContacts.length}`);

  return { netNewContacts, overlap };
}

// ============================================================================
// PHASE 3: STORE IN STAGING COLLECTION
// ============================================================================

async function storeInStaging(contacts, dryRun = false) {
  console.log('\n=== Phase 3: Storing in Staging Collection ===\n');

  if (dryRun) {
    console.log(`[DRY RUN] Would store ${contacts.length} contacts in ${CONFIG.STAGING_COLLECTION}`);
    contacts.slice(0, 5).forEach(c => {
      console.log(`  - ${c.fullName} (${c.company || 'No company'}) - Rank #${c.rank}`);
    });
    if (contacts.length > 5) {
      console.log(`  ... and ${contacts.length - 5} more`);
    }
    return contacts.length;
  }

  let stored = 0;
  let skipped = 0;

  // Process in batches to avoid overwhelming Firestore
  const batchSize = 500;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = db.batch();
    const chunk = contacts.slice(i, i + batchSize);

    for (const contact of chunk) {
      const docId = `mlm500_${contact.rank}`;
      const docRef = db.collection(CONFIG.STAGING_COLLECTION).doc(docId);

      // Check if already exists
      const existing = await docRef.get();
      if (existing.exists) {
        skipped++;
        continue;
      }

      batch.set(docRef, {
        rank: contact.rank,
        fullName: contact.fullName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        company: contact.company,
        estMonthly: contact.estMonthly,
        estAnnual: contact.estAnnual,
        estMonthlyValue: contact.estMonthlyValue,
        estAnnualValue: contact.estAnnualValue,
        email: null,
        emailSearched: false,
        emailScore: null,
        source: 'mlm500',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      stored++;
    }

    await batch.commit();
    console.log(`Stored batch ${Math.floor(i / batchSize) + 1}: ${stored} new, ${skipped} skipped`);
  }

  console.log(`\nStored ${stored} contacts in staging`);
  console.log(`Skipped ${skipped} (already existed)`);

  return stored;
}

// ============================================================================
// MIGRATE TO BFH_CONTACTS
// ============================================================================

async function migrateToBfhContacts(dryRun = false) {
  console.log('\n=== Migrating Contacts with Emails to bfh_contacts ===\n');

  // Get all staging contacts with emails
  const snapshot = await db.collection(CONFIG.STAGING_COLLECTION)
    .where('email', '!=', null)
    .get();

  console.log(`Found ${snapshot.size} contacts with emails in staging`);

  if (snapshot.empty) {
    console.log('No contacts to migrate');
    return 0;
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const bfhDocId = `mlm500_${data.rank}`;

    // Check if already exists in bfh_contacts
    const existing = await db.collection(CONFIG.BFH_CONTACTS_COLLECTION).doc(bfhDocId).get();
    if (existing.exists) {
      console.log(`  Skipped: ${data.fullName} (already exists)`);
      skipped++;
      continue;
    }

    // Check for email duplicate
    const emailDupe = await db.collection(CONFIG.BFH_CONTACTS_COLLECTION)
      .where('email', '==', data.email.toLowerCase())
      .limit(1)
      .get();

    if (!emailDupe.empty) {
      console.log(`  Skipped: ${data.fullName} (email ${data.email} already exists)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would migrate: ${data.fullName} (${data.email})`);
      migrated++;
      continue;
    }

    // Create in bfh_contacts
    await db.collection(CONFIG.BFH_CONTACTS_COLLECTION).doc(bfhDocId).set({
      fullName: data.fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      company: data.company,
      email: data.email.toLowerCase(),
      emailScore: data.emailScore,
      source: 'mlm500',
      mlm500Rank: data.rank,
      mlm500EstAnnual: data.estAnnual,
      mlm500EstAnnualValue: data.estAnnualValue,
      // Standard BFH fields
      bfhScraped: false,
      bfhProfileUrl: null,
      profileEnriched: false,
      emailSearched: true,
      sent: false,
      randomIndex: Math.random(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  Migrated: ${data.fullName} (${data.email})`);
    migrated++;
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`);
  return migrated;
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n=== MLM 500 Scraper Stats ===\n');

  // Staging collection stats
  const staging = db.collection(CONFIG.STAGING_COLLECTION);
  const [totalStaging, searchedStaging, withEmailStaging] = await Promise.all([
    staging.count().get(),
    staging.where('emailSearched', '==', true).count().get(),
    staging.where('email', '!=', null).count().get(),
  ]);

  console.log('mlm500_staging:');
  console.log(`  Total: ${totalStaging.data().count}`);
  console.log(`  Email searched: ${searchedStaging.data().count}`);
  console.log(`  With email: ${withEmailStaging.data().count}`);

  // BFH contacts from MLM 500
  const bfh = db.collection(CONFIG.BFH_CONTACTS_COLLECTION);
  const [mlm500InBfh, mlm500Sent] = await Promise.all([
    bfh.where('source', '==', 'mlm500').count().get(),
    bfh.where('source', '==', 'mlm500').where('sent', '==', true).count().get(),
  ]);

  console.log('\nbfh_contacts (source=mlm500):');
  console.log(`  Total: ${mlm500InBfh.data().count}`);
  console.log(`  Sent: ${mlm500Sent.data().count}`);
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const doScrape = args.includes('--scrape');
  const doMigrate = args.includes('--migrate-to-bfh');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  if (!doScrape && !doMigrate && !stats) {
    console.log('MLM 500 Top Earners Scraper');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/mlm500-scraper.js --scrape            # Scrape and store net-new contacts');
    console.log('  node scripts/mlm500-scraper.js --scrape --dry-run  # Preview without saving');
    console.log('  node scripts/mlm500-scraper.js --migrate-to-bfh    # Move contacts with emails to bfh_contacts');
    console.log('  node scripts/mlm500-scraper.js --stats             # Show collection stats');
    console.log('');
    console.log('Workflow:');
    console.log('  1. Run --scrape to populate mlm500_staging');
    console.log('  2. Run: node scripts/bfh-email-search.js --search --collection=mlm500_staging');
    console.log('  3. Run --migrate-to-bfh to move contacts with emails');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (doScrape) {
    // Phase 1A: Scrape MLM 500
    const mlm500Contacts = await scrapeMLM500();

    // Phase 1B: Fetch Recommended Distributors
    const recommendedDistributors = await fetchRecommendedDistributors();

    // Phase 2: Compute set difference
    const { netNewContacts, overlap } = computeSetDifference(mlm500Contacts, recommendedDistributors);

    // Phase 3: Store in staging
    await storeInStaging(netNewContacts, dryRun);

    console.log('\n=== Scrape Summary ===');
    console.log(`MLM 500 entries: ${mlm500Contacts.length}`);
    console.log(`Recommended Distributors: ${recommendedDistributors.length}`);
    console.log(`Overlap: ${overlap}`);
    console.log(`Net new in staging: ${netNewContacts.length}`);
    console.log('');
    console.log('Next step: node scripts/bfh-email-search.js --search --collection=mlm500_staging');
  }

  if (doMigrate) {
    await migrateToBfhContacts(dryRun);
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
