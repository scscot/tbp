#!/usr/bin/env node
/**
 * Update company_rep_search collection with momentum ranks from BusinessForHome
 *
 * Scrapes https://www.businessforhome.org/momentum-ranks/ and updates Firestore
 * documents with their rank based on company name/domain matching.
 *
 * Usage:
 *   node scripts/update-rep-search-ranks.js --dry-run    # Preview matches
 *   node scripts/update-rep-search-ranks.js              # Update Firestore
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const admin = require('firebase-admin');
const path = require('path');

puppeteer.use(StealthPlugin());

// Parse CLI arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});
const db = admin.firestore();

// Normalize company name for matching
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove non-alphanumeric
    .replace(/^(www|the)/, '')  // Remove common prefixes
    .replace(/(inc|llc|corp|international|global|company|co)$/, '');  // Remove suffixes
}

// Extract domain base (e.g., "doterra" from "doterra.com")
function domainBase(domain) {
  return domain
    .toLowerCase()
    .replace(/^www\./, '')
    .split('.')[0];
}

async function scrapeRanks() {
  console.log('🌐 Launching browser to scrape BusinessForHome momentum ranks...\n');

  const headless = process.env.HEADLESS !== 'false';
  const browser = await puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const ranks = [];
  let pageNum = 1;
  const url = 'https://www.businessforhome.org/momentum-ranks/';

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for the table to load
  await page.waitForSelector('table', { timeout: 30000 });

  while (true) {
    console.log(`📄 Scraping page ${pageNum}...`);

    // Extract rankings from current page
    const pageRanks = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const results = [];
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const rank = parseInt(cells[0].textContent.trim());
          const name = cells[1].textContent.trim();
          if (rank && name) {
            results.push({ rank, name });
          }
        }
      });
      return results;
    });

    ranks.push(...pageRanks);
    console.log(`   Found ${pageRanks.length} companies (total: ${ranks.length})`);

    // Check for next button that is available
    const hasNext = await page.evaluate(() => {
      const nextBtn = document.querySelector('#top-earner-next-page');
      if (!nextBtn) return false;
      return nextBtn.classList.contains('available');
    });

    if (!hasNext) {
      console.log('   No more pages');
      break;
    }

    // Get current first rank to detect page change
    const firstRankBefore = pageRanks[0]?.rank;

    // Click next
    await page.click('#top-earner-next-page');

    // Wait for table content to change
    await page.waitForFunction(
      (prevFirstRank) => {
        const firstCell = document.querySelector('table tbody tr td:first-child');
        if (!firstCell) return false;
        const newRank = parseInt(firstCell.textContent.trim());
        return newRank !== prevFirstRank;
      },
      { timeout: 10000 },
      firstRankBefore
    );

    await new Promise(r => setTimeout(r, 300)); // Small delay

    pageNum++;
    if (pageNum > 50) break; // Safety limit
  }

  await browser.close();
  console.log(`\n✅ Scraped ${ranks.length} total companies\n`);

  return ranks;
}

async function updateFirestore(ranks) {
  // Get companies from Firestore
  const snapshot = await db.collection('company_rep_search').get();
  const companies = [];
  snapshot.forEach(doc => {
    companies.push({ id: doc.id, ...doc.data() });
  });

  console.log(`📊 Matching ${companies.length} companies against ${ranks.length} ranked companies...\n`);

  // Build lookup maps for ranks
  const normalizedRanks = new Map();
  ranks.forEach(r => {
    normalizedRanks.set(normalize(r.name), r.rank);
  });

  // Match companies
  const matches = [];
  const noMatch = [];

  for (const company of companies) {
    const domain = company.companyDomain;
    const domBase = domainBase(domain);

    // Try to find a match
    let rank = null;

    // Direct normalized match
    for (const [normName, r] of normalizedRanks) {
      if (normName.includes(domBase) || domBase.includes(normName)) {
        rank = r;
        break;
      }
    }

    // Also try matching against the original names
    if (!rank) {
      for (const r of ranks) {
        const normRankName = normalize(r.name);
        const normDomain = domBase;
        if (normRankName === normDomain ||
            normRankName.startsWith(normDomain) ||
            normDomain.startsWith(normRankName)) {
          rank = r.rank;
          break;
        }
      }
    }

    if (rank) {
      matches.push({ id: company.id, domain, rank });
    } else {
      noMatch.push(domain);
    }
  }

  // Sort matches by rank
  matches.sort((a, b) => a.rank - b.rank);

  console.log(`✅ Matched: ${matches.length}`);
  console.log(`❌ No match: ${noMatch.length}\n`);

  console.log('📋 Matches:');
  matches.forEach(m => {
    console.log(`   ${m.rank}. ${m.domain}`);
  });

  if (dryRun) {
    console.log(`\n⏸️  Dry run complete. Run without --dry-run to update Firestore.`);
    return;
  }

  // Update Firestore
  console.log(`\n🔄 Updating Firestore...`);

  const batch = db.batch();
  for (const match of matches) {
    const ref = db.collection('company_rep_search').doc(match.id);
    batch.update(ref, { rank: match.rank });
  }

  // Set rank to null for unmatched (or just skip them)
  await batch.commit();

  console.log(`✅ Updated ${matches.length} documents with rank values.`);
}

async function main() {
  console.log(`\n🏆 Update company_rep_search with BusinessForHome Momentum Ranks${dryRun ? ' (DRY RUN)' : ''}\n`);

  const ranks = await scrapeRanks();
  await updateFirestore(ranks);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
