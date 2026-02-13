#!/usr/bin/env node
/**
 * Business For Home Profile Enricher
 *
 * Enriches BFH contacts with additional profile data for AI personalization:
 * - Profile bio/description
 * - Review snippets and count
 * - Star rating
 * - Language detection
 *
 * Usage:
 *   node scripts/bfh-profile-enricher.js --enrich      # Enrich profiles
 *   node scripts/bfh-profile-enricher.js --dry-run     # Preview only
 *   node scripts/bfh-profile-enricher.js --stats       # Show stats
 *   node scripts/bfh-profile-enricher.js --max=50      # Limit profiles
 *   node scripts/bfh-profile-enricher.js --sample=URL  # Test single URL
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

  // Rate limiting
  DELAY_BETWEEN_REQUESTS: 2000,  // 2 seconds
  JITTER_MS: 500,

  // User agent
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

  // Language detection word lists
  LANGUAGE_INDICATORS: {
    es: ['equipo', 'negocio', 'empresa', 'años', 'éxito', 'trabajo', 'líder', 'gracias', 'excelente', 'persona', 'muy', 'mejor', 'gran', 'todos', 'siempre', 'porque', 'cuando', 'también', 'sobre', 'para'],
    pt: ['equipe', 'negócio', 'empresa', 'anos', 'sucesso', 'trabalho', 'líder', 'obrigado', 'excelente', 'pessoa', 'muito', 'melhor', 'grande', 'todos', 'sempre', 'porque', 'quando', 'também', 'sobre', 'para'],
    de: ['team', 'geschäft', 'unternehmen', 'jahre', 'erfolg', 'arbeit', 'führer', 'danke', 'ausgezeichnet', 'person', 'sehr', 'beste', 'groß', 'alle', 'immer', 'weil', 'wenn', 'auch', 'über', 'für'],
    en: ['team', 'business', 'company', 'years', 'success', 'work', 'leader', 'thank', 'excellent', 'person', 'very', 'best', 'great', 'everyone', 'always', 'because', 'when', 'also', 'about', 'for']
  },

  // Maximum reviews to capture
  MAX_REVIEW_SNIPPETS: 3,
  MAX_REVIEW_LENGTH: 300,
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

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

function detectLanguage(text) {
  if (!text || text.length < 50) {
    return 'en'; // Default to English if text is too short
  }

  const textLower = text.toLowerCase();
  const scores = {};

  for (const [lang, words] of Object.entries(CONFIG.LANGUAGE_INDICATORS)) {
    scores[lang] = 0;
    for (const word of words) {
      // Count word occurrences (with word boundaries for accuracy)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        scores[lang] += matches.length;
      }
    }
  }

  // Find language with highest score
  let maxScore = 0;
  let detectedLang = 'en';

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }

  // Confidence check - if scores are very close, default to English
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  if (sortedScores[0] - sortedScores[1] < 3 && detectedLang !== 'en') {
    // Ambiguous - check for definitive non-English characters
    if (/[áéíóúüñ¿¡]/.test(text)) {
      return 'es';
    }
    if (/[ãõçâêôàè]/.test(text)) {
      return 'pt';
    }
    if (/[äöüß]/.test(text)) {
      return 'de';
    }
    return 'en';
  }

  return detectedLang;
}

// ============================================================================
// PROFILE EXTRACTION
// ============================================================================

function extractProfileData($, url) {
  const result = {
    profileBio: null,
    reviewSnippets: [],
    reviewCount: 0,
    starRating: null,
    detectedLanguage: 'en',
    rawReviewText: '', // For language detection
  };

  // Extract bio/description
  // Look for main content paragraphs that aren't reviews
  const mainContent = $('#main-content, .entry-content, article, .content').first();
  const paragraphs = mainContent.find('p').toArray();

  // Get first substantial paragraph as bio
  for (const p of paragraphs) {
    const text = $(p).text().trim();
    // Skip short paragraphs, navigation text, or review timestamps
    if (text.length > 100 &&
        !text.match(/^\d{4}-\d{2}-\d{2}/) &&
        !text.includes('★') &&
        !text.toLowerCase().includes('click here') &&
        !text.toLowerCase().includes('follow us')) {
      result.profileBio = text.substring(0, 500); // Limit bio length
      break;
    }
  }

  // Extract reviews
  // Reviews on BFH typically follow a pattern: name/link, date, stars, text
  const bodyText = $('body').text();

  // Count star ratings (★★★★★ pattern)
  const starMatches = bodyText.match(/★{1,5}/g) || [];
  result.reviewCount = starMatches.length;

  // Calculate average star rating
  if (starMatches.length > 0) {
    const totalStars = starMatches.reduce((sum, stars) => sum + stars.length, 0);
    result.starRating = Math.round((totalStars / starMatches.length) * 10) / 10;
  }

  // Extract review text snippets
  // Look for paragraphs that appear to be reviews (often in Spanish or other languages)
  const allParagraphs = $('p').toArray();
  const reviewTexts = [];

  for (const p of allParagraphs) {
    const text = $(p).text().trim();
    // Identify review-like content
    if (text.length > 50 &&
        text.length < 1000 &&
        !text.match(/^\d{4}-\d{2}-\d{2}/) &&
        !text.includes('Business For Home') &&
        !text.toLowerCase().includes('recommended distributor') &&
        !text.toLowerCase().includes('click here') &&
        // Reviews often start with personal statements or compliments
        (text.match(/^[A-ZÁÉÍÓÚÑ]/) || // Starts with capital (including accented)
         text.includes('!') || // Enthusiastic
         /trabajar|trabajo|líder|equipo|excelente|gracias|team|leader|excellent|thank/i.test(text))) {
      reviewTexts.push(text);
      result.rawReviewText += ' ' + text;
    }
  }

  // Take top N reviews as snippets
  result.reviewSnippets = reviewTexts
    .slice(0, CONFIG.MAX_REVIEW_SNIPPETS)
    .map(text => text.substring(0, CONFIG.MAX_REVIEW_LENGTH));

  // Detect language from review content (reviews are more reliable than bio)
  const textForDetection = result.rawReviewText || result.profileBio || '';
  result.detectedLanguage = detectLanguage(textForDetection);

  // Clean up - don't store rawReviewText
  delete result.rawReviewText;

  return result;
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

async function enrichProfiles(maxProfiles = 50, dryRun = false, withEmailOnly = false) {
  console.log('\n=== Enriching BFH Profiles ===\n');

  if (withEmailOnly) {
    console.log('Filter: Only contacts WITH email addresses\n');
  }

  // Get profiles that have been scraped but not enriched
  // Note: Firestore doesn't match documents where field doesn't exist,
  // so we query all scraped profiles and filter locally
  const query = db.collection(CONFIG.COLLECTION)
    .where('bfhScraped', '==', true)
    .limit(maxProfiles * 3);  // Fetch extra to account for filtering

  const rawSnapshot = await query.get();

  // Filter locally - include docs where profileEnriched is false or undefined
  // Optionally filter to only contacts with email
  const docs = rawSnapshot.docs.filter(doc => {
    const data = doc.data();
    const notEnriched = data.profileEnriched !== true;
    const hasEmail = !withEmailOnly || (data.email && data.email.trim() !== '');
    return notEnriched && hasEmail;
  }).slice(0, maxProfiles);

  const snapshot = { docs, size: docs.length };

  console.log(`Found ${snapshot.size} profiles to enrich (from ${rawSnapshot.size} scraped)\n`);

  let enriched = 0;
  let errors = 0;
  const languageCounts = { en: 0, es: 0, pt: 0, de: 0 };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const profileUrl = data.bfhProfileUrl;

    console.log(`\nEnriching: ${data.fullName || data.slug}`);
    console.log(`  URL: ${profileUrl}`);

    if (dryRun) {
      console.log('  [DRY RUN] Would fetch and enrich');
      enriched++;
      await sleep(500);
      continue;
    }

    const html = await fetchPage(profileUrl);
    if (!html) {
      console.log('  Failed to fetch profile');
      errors++;
      await sleep(randomDelay());
      continue;
    }

    const $ = cheerio.load(html);
    const profileData = extractProfileData($, profileUrl);

    console.log(`  Bio: ${profileData.profileBio ? profileData.profileBio.substring(0, 80) + '...' : '(not found)'}`);
    console.log(`  Reviews: ${profileData.reviewCount} (${profileData.reviewSnippets.length} snippets captured)`);
    console.log(`  Star Rating: ${profileData.starRating || '(not found)'}`);
    console.log(`  Language: ${profileData.detectedLanguage.toUpperCase()}`);

    // Update Firestore
    const updateData = {
      profileBio: profileData.profileBio,
      reviewSnippets: profileData.reviewSnippets,
      reviewCount: profileData.reviewCount,
      starRating: profileData.starRating,
      detectedLanguage: profileData.detectedLanguage,
      profileEnriched: true,
      profileEnrichedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await doc.ref.update(updateData);

    languageCounts[profileData.detectedLanguage]++;
    enriched++;

    await sleep(randomDelay());
  }

  console.log(`\n=== Enrichment Complete ===`);
  console.log(`Profiles enriched: ${enriched}`);
  console.log(`Errors: ${errors}`);
  console.log(`Languages detected: EN=${languageCounts.en}, ES=${languageCounts.es}, PT=${languageCounts.pt}, DE=${languageCounts.de}`);
  console.log('');

  return { enriched, errors, languageCounts };
}

// ============================================================================
// SAMPLE SINGLE URL (FOR TESTING)
// ============================================================================

async function sampleUrl(url) {
  console.log(`\n=== Sampling URL: ${url} ===\n`);

  const html = await fetchPage(url);
  if (!html) {
    console.log('Failed to fetch URL');
    return null;
  }

  const $ = cheerio.load(html);
  const profileData = extractProfileData($, url);

  console.log('Extracted Data:');
  console.log(JSON.stringify(profileData, null, 2));

  return profileData;
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  const collection = db.collection(CONFIG.COLLECTION);

  const [total, scraped, enriched, withEmail] = await Promise.all([
    collection.count().get(),
    collection.where('bfhScraped', '==', true).count().get(),
    collection.where('profileEnriched', '==', true).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    collection.where('email', '!=', null).count().get(),
  ]);

  // Count by language (requires individual queries or fetching all)
  const enrichedSnapshot = await collection
    .where('profileEnriched', '==', true)
    .select('detectedLanguage')
    .get()
    .catch(() => ({ docs: [] }));

  const languageCounts = { en: 0, es: 0, pt: 0, de: 0, unknown: 0 };
  enrichedSnapshot.docs.forEach(doc => {
    const lang = doc.data().detectedLanguage || 'unknown';
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  });

  console.log('\n=== BFH Contacts Enrichment Stats ===');
  console.log(`Total contacts: ${total.data().count}`);
  console.log(`BFH scraped: ${scraped.data().count}`);
  console.log(`Profile enriched: ${enriched.data().count}`);
  console.log(`With email: ${withEmail.data().count}`);
  console.log(`\nLanguage Distribution:`);
  console.log(`  English: ${languageCounts.en}`);
  console.log(`  Spanish: ${languageCounts.es}`);
  console.log(`  Portuguese: ${languageCounts.pt}`);
  console.log(`  German: ${languageCounts.de}`);
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const enrich = args.includes('--enrich');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');
  const withEmailOnly = args.includes('--with-email');

  // Parse --max=N
  let maxProfiles = 50;
  const maxArg = args.find(a => a.startsWith('--max='));
  if (maxArg) {
    maxProfiles = parseInt(maxArg.split('=')[1]) || 50;
  }

  // Parse --sample=URL
  const sampleArg = args.find(a => a.startsWith('--sample='));
  if (sampleArg) {
    const url = sampleArg.split('=').slice(1).join('=');
    await sampleUrl(url);
    process.exit(0);
  }

  if (!enrich && !stats) {
    console.log('Usage:');
    console.log('  node scripts/bfh-profile-enricher.js --enrich      # Enrich profiles');
    console.log('  node scripts/bfh-profile-enricher.js --stats       # Show stats');
    console.log('  node scripts/bfh-profile-enricher.js --dry-run     # Preview only');
    console.log('  node scripts/bfh-profile-enricher.js --max=N       # Max profiles to enrich');
    console.log('  node scripts/bfh-profile-enricher.js --with-email  # Only contacts with email');
    console.log('  node scripts/bfh-profile-enricher.js --sample=URL  # Test single URL');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/bfh-profile-enricher.js --sample=https://www.businessforhome.org/recommended-distributor/reynier-lozano/');
    console.log('  node scripts/bfh-profile-enricher.js --enrich --max=10 --dry-run');
    console.log('  node scripts/bfh-profile-enricher.js --enrich --with-email --max=250');
    process.exit(1);
  }

  initFirebase();

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (enrich) {
    await enrichProfiles(maxProfiles, dryRun, withEmailOnly);
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
