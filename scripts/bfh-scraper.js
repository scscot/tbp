#!/usr/bin/env node
/**
 * Business For Home Contacts Scraper
 *
 * Scrapes recommended distributor profiles from Business For Home website
 * using their WordPress REST API and stores in Firestore bfh_contacts collection.
 *
 * Usage:
 *   node scripts/bfh-scraper.js --seed       # Seed from API (1052 distributors)
 *   node scripts/bfh-scraper.js --scrape     # Scrape individual profiles
 *   node scripts/bfh-scraper.js --dry-run    # Preview only
 *   node scripts/bfh-scraper.js --stats      # Show stats
 *
 * Phase 1: Seed URLs from WordPress REST API
 * Phase 2: Scrape individual profile pages for contact details
 */

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Firestore
  COLLECTION: 'bfh_contacts',

  // WordPress REST API
  API_BASE_URL: 'https://www.businessforhome.org/wp-json/wp/v2/distributor',
  PER_PAGE: 100,  // Max allowed by WordPress

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 2000,  // 2 seconds
  JITTER_MS: 500,

  // User agent
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

function randomDelay() {
  const jitter = Math.random() * CONFIG.JITTER_MS;
  return CONFIG.DELAY_BETWEEN_REQUESTS + jitter;
}

async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}: ${error.message}`);
    return null;
  }
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

// ============================================================================
// PHASE 1: SEED FROM WORDPRESS REST API
// ============================================================================

async function seedFromAPI(dryRun = false) {
  console.log('\n=== PHASE 1: Seeding from WordPress REST API ===\n');

  let page = 1;
  let totalSeeded = 0;
  let totalSkipped = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${CONFIG.API_BASE_URL}?per_page=${CONFIG.PER_PAGE}&page=${page}`;
    console.log(`Fetching API page ${page}: ${url}`);

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
      const total = parseInt(response.headers['x-wp-total']) || 0;

      if (page === 1) {
        console.log(`Total distributors: ${total} across ${totalPages} pages\n`);
      }

      console.log(`Page ${page}/${totalPages}: ${distributors.length} distributors`);

      for (const dist of distributors) {
        const slug = dist.slug;
        const docId = `bfh_${slug}`;
        const profileUrl = dist.link;
        const name = dist.title?.rendered || '';

        // Check if already exists
        const existing = await db.collection(CONFIG.COLLECTION).doc(docId).get();
        if (existing.exists) {
          totalSkipped++;
          continue;
        }

        if (dryRun) {
          console.log(`  [DRY RUN] Would seed: ${name} (${slug})`);
          totalSeeded++;
          continue;
        }

        // Parse name
        const { firstName, lastName } = parseName(name);

        // Create new document
        await db.collection(CONFIG.COLLECTION).doc(docId).set({
          bfhProfileUrl: profileUrl,
          slug: slug,
          fullName: name,
          firstName: firstName,
          lastName: lastName,
          bfhScraped: false,
          emailSearched: false,
          sent: false,
          source: 'bfh',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`  Seeded: ${name} (${slug})`);
        totalSeeded++;
      }

      // Check if there are more pages
      hasMore = page < totalPages;
      page++;

      if (hasMore) {
        await sleep(randomDelay());
      }

    } catch (error) {
      if (error.response?.status === 400) {
        // No more pages
        hasMore = false;
      } else {
        console.error(`Error fetching page ${page}: ${error.message}`);
        hasMore = false;
      }
    }
  }

  console.log(`\n=== Seeding Complete ===`);
  console.log(`New contacts seeded: ${totalSeeded}`);
  console.log(`Already existed (skipped): ${totalSkipped}`);
  console.log('');

  return totalSeeded;
}

// ============================================================================
// PHASE 2: SCRAPE INDIVIDUAL PROFILES
// ============================================================================

async function scrapeProfiles(maxProfiles = 100, dryRun = false) {
  console.log('\n=== PHASE 2: Scraping Individual Profiles ===\n');

  // Get unscraped profiles
  const query = db.collection(CONFIG.COLLECTION)
    .where('bfhScraped', '==', false)
    .limit(maxProfiles);

  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} unscraped profiles\n`);

  let scraped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const profileUrl = data.bfhProfileUrl;
    const slug = data.slug;

    console.log(`Scraping: ${data.fullName || slug}`);

    const html = await fetchPage(profileUrl);
    if (!html) {
      console.log(`  Failed to fetch profile`);
      errors++;
      await sleep(randomDelay());
      continue;
    }

    const $ = cheerio.load(html);

    // Extract company from profile
    let company = '';
    // Look for company link or text - common patterns on BFH
    $('a[href*="/companies/"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !company) {
        company = text;
      }
    });

    // Also try finding company in profile text
    if (!company) {
      const bodyText = $('body').text();
      const companyMatch = bodyText.match(/(?:Company|Working with|Associated with):\s*([A-Za-z0-9\s]+)/i);
      if (companyMatch) {
        company = companyMatch[1].trim();
      }
    }

    // Extract country
    let country = '';
    const bodyText = $('body').text();
    const countryPatterns = [
      /(?:Country|Location|Based in):\s*([A-Za-z\s]+)/i,
      /\b(United States|USA|Canada|United Kingdom|UK|Australia|Germany|France|Mexico|Brazil|Netherlands|Spain|Italy|Sweden|Norway|Denmark|Finland|Belgium|Switzerland|Austria|New Zealand|Ireland|South Africa|India|Japan|South Korea|Singapore|Malaysia|Philippines|Thailand|Indonesia|Vietnam)\b/i
    ];

    for (const pattern of countryPatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        country = match[1].trim();
        break;
      }
    }

    // Extract Facebook URL
    let facebookUrl = null;
    $('a[href*="facebook.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('facebook.com') && !facebookUrl) {
        facebookUrl = href;
      }
    });

    // Extract website URL (excluding social media)
    let websiteUrl = null;
    $('a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href');
      const text = ($(el).text() || '').toLowerCase();

      if (href &&
          !href.includes('facebook.com') &&
          !href.includes('instagram.com') &&
          !href.includes('twitter.com') &&
          !href.includes('linkedin.com') &&
          !href.includes('youtube.com') &&
          !href.includes('businessforhome.org') &&
          (text.includes('website') || text.includes('site') || text.includes('visit') || text.includes('my'))) {
        if (!websiteUrl) {
          websiteUrl = href;
        }
      }
    });

    console.log(`  Company: ${company || '(not found)'}`);
    console.log(`  Country: ${country || '(not found)'}`);
    console.log(`  Facebook: ${facebookUrl ? 'found' : '(not found)'}`);
    console.log(`  Website: ${websiteUrl ? 'found' : '(not found)'}`);

    if (dryRun) {
      console.log(`  [DRY RUN] Would update document`);
      scraped++;
      await sleep(randomDelay());
      continue;
    }

    // Update document
    await doc.ref.update({
      company: company || null,
      country: country || null,
      facebookUrl: facebookUrl,
      websiteUrl: websiteUrl,
      bfhScraped: true,
      bfhScrapedAt: admin.firestore.FieldValue.serverTimestamp(),
      randomIndex: Math.random(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  Updated successfully`);
    scraped++;

    await sleep(randomDelay());
  }

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Profiles scraped: ${scraped}`);
  console.log(`Errors: ${errors}`);
  console.log('');

  return { scraped, errors };
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.COLLECTION);

  const [total, scraped, withEmail, searched, sent] = await Promise.all([
    collection.count().get(),
    collection.where('bfhScraped', '==', true).count().get(),
    collection.where('email', '!=', null).count().get(),
    collection.where('emailSearched', '==', true).count().get(),
    collection.where('sent', '==', true).count().get(),
  ]);

  console.log('\n=== BFH Contacts Stats ===');
  console.log(`Total contacts: ${total.data().count}`);
  console.log(`BFH scraped: ${scraped.data().count}`);
  console.log(`Email searched: ${searched.data().count}`);
  console.log(`With email: ${withEmail.data().count}`);
  console.log(`Emails sent: ${sent.data().count}`);
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const seed = args.includes('--seed');
  const scrape = args.includes('--scrape');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  // Parse --max=N
  let maxProfiles = 100;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxProfiles = parseInt(maxArg.split('=')[1]) || 100;
  }

  if (!seed && !scrape && !stats) {
    console.log('Usage:');
    console.log('  node scripts/bfh-scraper.js --seed       # Seed from WordPress API');
    console.log('  node scripts/bfh-scraper.js --scrape     # Scrape individual profiles');
    console.log('  node scripts/bfh-scraper.js --stats      # Show collection stats');
    console.log('  node scripts/bfh-scraper.js --dry-run    # Preview only');
    console.log('  node scripts/bfh-scraper.js --max=N      # Max profiles to scrape');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (seed) {
    await seedFromAPI(dryRun);
  }

  if (scrape) {
    await scrapeProfiles(maxProfiles, dryRun);
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
