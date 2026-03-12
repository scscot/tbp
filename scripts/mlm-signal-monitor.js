#!/usr/bin/env node
/**
 * MLM Signal Monitor - Agent-Based Lead Discovery
 *
 * Multi-agent system that monitors internet activity for direct sales/MLM
 * professionals and extracts contact information.
 *
 * Architecture:
 *   Signal Detection → Profile Discovery → Contact Extraction → Firestore
 *
 * Signal Sources:
 *   1. SerpAPI Google Search - Real-time web mentions
 *   2. Reddit API - MLM/direct sales subreddits
 *   3. YouTube Search - Promoter videos with links in descriptions
 *
 * Usage:
 *   node scripts/mlm-signal-monitor.js --monitor              # Run full monitoring cycle
 *   node scripts/mlm-signal-monitor.js --monitor --source=google   # Google only
 *   node scripts/mlm-signal-monitor.js --monitor --source=reddit   # Reddit only
 *   node scripts/mlm-signal-monitor.js --monitor --source=youtube  # YouTube only
 *   node scripts/mlm-signal-monitor.js --stats                # Show collection stats
 *   node scripts/mlm-signal-monitor.js --dry-run              # Preview only
 *   node scripts/mlm-signal-monitor.js --reset                # Reset monitor state
 *
 * Output:
 *   - mlm_signals collection: Raw signals with source URLs
 *   - mlm_discovered_profiles collection: Extracted profile URLs ready for scraping
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Load API keys
const SECRETS_PATH = path.join(__dirname, '../secrets');
const SERPAPI_KEY = fs.existsSync(path.join(SECRETS_PATH, 'SerpAPI-Key'))
  ? fs.readFileSync(path.join(SECRETS_PATH, 'SerpAPI-Key'), 'utf8').trim()
  : null;

const CONFIG = {
  // Firestore collections
  SIGNALS_COLLECTION: 'mlm_signals',
  PROFILES_COLLECTION: 'mlm_discovered_profiles',
  STATE_COLLECTION: 'scraper_state',
  STATE_DOC: 'mlm_signal_monitor',

  // Rate limiting
  SERPAPI_DELAY: 4000,      // 4s between SerpAPI requests
  REDDIT_DELAY: 2000,       // 2s between Reddit requests
  YOUTUBE_DELAY: 3000,      // 3s between YouTube requests
  JITTER_MS: 500,

  // SerpAPI configuration
  SERPAPI_URL: 'https://serpapi.com/search',
  SERPAPI_MAX_RESULTS: 100, // Max results per search query

  // Signal detection queries - terms that indicate MLM activity
  MLM_SIGNAL_QUERIES: [
    // Recruitment signals
    '"join my team" direct sales',
    '"looking for motivated" network marketing',
    '"business opportunity" MLM -scam -pyramid',
    '"work from home" "direct sales" hiring',

    // Product promotion signals
    '"independent consultant" OR "independent distributor"',
    '"earn extra income" "health and wellness"',
    '"be your own boss" network marketing',

    // Company-specific signals (high-activity companies)
    'Amway IBO recruiting',
    'Herbalife distributor opportunity',
    'Young Living essential oils business',
    'doTERRA wellness advocate',
    'Monat VIP opportunity',
    'Arbonne consultant signup',
    'Plexus ambassador',

    // Social proof signals
    '"changed my life" MLM OR "direct sales"',
    '"quit my job" network marketing',
    '"top earner" direct sales',
  ],

  // Reddit subreddits to monitor
  REDDIT_SUBREDDITS: [
    'MLM',
    'antiMLM',         // Ironically, people mention they're in MLMs here
    'Entrepreneur',
    'sidehustle',
    'WorkOnline',
    'beermoney',
    'passive_income',
  ],

  // Reddit signal keywords (in post titles/content)
  REDDIT_KEYWORDS: [
    'network marketing',
    'direct sales',
    'MLM',
    'downline',
    'upline',
    'team building',
    'home business',
    'wellness company',
  ],

  // Profile URL patterns to extract from signals
  PROFILE_PATTERNS: [
    // Generic MLM patterns
    /https?:\/\/[a-z0-9-]+\.(myshopify\.com|wixsite\.com|wordpress\.com)[^\s"')]+/gi,

    // Company-specific patterns
    /https?:\/\/[a-z0-9-]+\.myamway\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.myherbalife\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.youngliving\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.doterra\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.mymonat\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.arbonne\.com[^\s"')]+/gi,
    /https?:\/\/[a-z0-9-]+\.plexusworldwide\.com[^\s"')]+/gi,
    /https?:\/\/www\.findsalesrep\.com\/users\/[0-9]+/gi,
    /https?:\/\/businessforhome\.org\/[a-z0-9-]+/gi,

    // Social media profiles (potential leads)
    /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.]+/gi,
    /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+/gi,
    /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/gi,
  ],

  // Email extraction pattern
  EMAIL_REGEX: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Domains to exclude from email extraction
  EXCLUDED_EMAIL_DOMAINS: [
    'example.com', 'test.com', 'domain.com',
    'facebook.com', 'twitter.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'google.com',
  ],

  // Known MLM companies for classification
  MLM_COMPANIES: [
    'amway', 'herbalife', 'avon', 'mary kay', 'tupperware',
    'young living', 'doterra', 'monat', 'arbonne', 'plexus',
    'usana', 'isagenix', 'nu skin', 'melaleuca', 'shaklee',
    'primerica', 'beachbody', 'it works', 'scentsy', 'pampered chef',
    'rodan and fields', 'younique', 'origami owl', 'thirty-one',
    'paparazzi', 'lularoe', 'color street', 'pure romance',
    'pruvit', 'modere', 'juice plus', 'advocare', 'optavia',
    'tranont', 'lifevantage', 'nerium', 'neora', 'zilis',
    'enagic', 'worldventures', 'acn', 'legalshield',
  ],
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

function addJitter(baseMs) {
  return baseMs + Math.random() * CONFIG.JITTER_MS;
}

function extractUrls(text) {
  const urls = new Set();
  for (const pattern of CONFIG.PROFILE_PATTERNS) {
    const matches = text.match(pattern) || [];
    matches.forEach(url => urls.add(url.toLowerCase()));
  }
  return Array.from(urls);
}

function extractEmails(text) {
  const matches = text.match(CONFIG.EMAIL_REGEX) || [];
  return matches.filter(email => {
    const domain = email.split('@')[1].toLowerCase();
    return !CONFIG.EXCLUDED_EMAIL_DOMAINS.includes(domain);
  });
}

function detectCompany(text) {
  const lowerText = text.toLowerCase();
  for (const company of CONFIG.MLM_COMPANIES) {
    if (lowerText.includes(company)) {
      return company.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function generateSignalId(source, content) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(`${source}:${content}`).digest('hex');
  return hash.substring(0, 16);
}

// ============================================================================
// SIGNAL DETECTION AGENTS
// ============================================================================

/**
 * Google Search Agent - Uses SerpAPI to find MLM activity
 */
async function googleSearchAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping Google search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const maxQueries = options.maxQueries || CONFIG.MLM_SIGNAL_QUERIES.length;
  const queries = CONFIG.MLM_SIGNAL_QUERIES.slice(0, maxQueries);

  console.log(`\n=== Google Search Agent ===`);
  console.log(`Processing ${queries.length} queries...`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n[${i + 1}/${queries.length}] "${query.substring(0, 50)}..."`);

    try {
      const response = await axios.get(CONFIG.SERPAPI_URL, {
        params: {
          api_key: SERPAPI_KEY,
          engine: 'google',
          q: query,
          num: 20,
          gl: 'us',
          hl: 'en',
        },
        timeout: 30000,
      });

      const results = response.data.organic_results || [];
      console.log(`  Found ${results.length} results`);

      for (const result of results) {
        const content = `${result.title || ''} ${result.snippet || ''} ${result.link || ''}`;
        const company = detectCompany(content);
        const extractedUrls = extractUrls(content);
        const extractedEmails = extractEmails(content);

        if (extractedUrls.length > 0 || extractedEmails.length > 0 || company) {
          const signalId = generateSignalId('google', result.link);

          signals.push({
            id: signalId,
            source: 'google',
            query: query,
            title: result.title,
            snippet: result.snippet,
            sourceUrl: result.link,
            detectedCompany: company,
            extractedUrls: extractedUrls,
            extractedEmails: extractedEmails,
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          extractedUrls.forEach(url => profiles.add(url));
        }
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < queries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nGoogle Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * Reddit Agent - Monitors MLM-related subreddits
 */
async function redditAgent(options = {}) {
  const signals = [];
  const profiles = new Set();
  const subreddits = options.subreddits || CONFIG.REDDIT_SUBREDDITS;

  console.log(`\n=== Reddit Agent ===`);
  console.log(`Monitoring ${subreddits.length} subreddits...`);

  for (let i = 0; i < subreddits.length; i++) {
    const subreddit = subreddits[i];
    console.log(`\n[${i + 1}/${subreddits.length}] r/${subreddit}`);

    try {
      // Fetch recent posts (Reddit public JSON API)
      const response = await axios.get(
        `https://www.reddit.com/r/${subreddit}/new.json`,
        {
          params: { limit: 25 },
          headers: { 'User-Agent': 'MLMSignalMonitor/1.0' },
          timeout: 15000,
        }
      );

      const posts = response.data?.data?.children || [];
      console.log(`  Found ${posts.length} posts`);

      let relevantCount = 0;
      for (const post of posts) {
        const data = post.data;
        const content = `${data.title || ''} ${data.selftext || ''}`.toLowerCase();

        // Check if post contains MLM keywords
        const hasKeyword = CONFIG.REDDIT_KEYWORDS.some(kw => content.includes(kw.toLowerCase()));
        if (!hasKeyword) continue;

        relevantCount++;
        const fullContent = `${data.title} ${data.selftext} ${data.url}`;
        const company = detectCompany(fullContent);
        const extractedUrls = extractUrls(fullContent);
        const extractedEmails = extractEmails(fullContent);

        const signalId = generateSignalId('reddit', data.id);

        signals.push({
          id: signalId,
          source: 'reddit',
          subreddit: subreddit,
          postId: data.id,
          title: data.title,
          author: data.author,
          sourceUrl: `https://reddit.com${data.permalink}`,
          detectedCompany: company,
          extractedUrls: extractedUrls,
          extractedEmails: extractedEmails,
          score: data.score,
          createdUtc: data.created_utc,
          discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        extractedUrls.forEach(url => profiles.add(url));
      }
      console.log(`  Relevant posts: ${relevantCount}`);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < subreddits.length - 1) {
      await sleep(addJitter(CONFIG.REDDIT_DELAY));
    }
  }

  console.log(`\nReddit Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * YouTube Agent - Finds MLM promoter videos
 */
async function youtubeAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping YouTube search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();

  const youtubeQueries = [
    'network marketing success tips 2026',
    'MLM recruiting strategies',
    'direct sales business opportunity',
    'how to build your MLM team',
    'work from home direct sales',
  ];

  console.log(`\n=== YouTube Agent ===`);
  console.log(`Searching ${youtubeQueries.length} queries...`);

  for (let i = 0; i < youtubeQueries.length; i++) {
    const query = youtubeQueries[i];
    console.log(`\n[${i + 1}/${youtubeQueries.length}] "${query}"`);

    try {
      const response = await axios.get(CONFIG.SERPAPI_URL, {
        params: {
          api_key: SERPAPI_KEY,
          engine: 'youtube',
          search_query: query,
        },
        timeout: 30000,
      });

      const videos = response.data.video_results || [];
      console.log(`  Found ${videos.length} videos`);

      for (const video of videos) {
        const content = `${video.title || ''} ${video.description || ''} ${video.channel?.name || ''}`;
        const company = detectCompany(content);

        if (company) {
          const signalId = generateSignalId('youtube', video.link);

          signals.push({
            id: signalId,
            source: 'youtube',
            query: query,
            title: video.title,
            channel: video.channel?.name,
            sourceUrl: video.link,
            detectedCompany: company,
            views: video.views,
            publishedDate: video.published_date,
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < youtubeQueries.length - 1) {
      await sleep(addJitter(CONFIG.YOUTUBE_DELAY));
    }
  }

  console.log(`\nYouTube Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

async function saveSignals(signals, dryRun = false) {
  if (signals.length === 0) return { saved: 0, skipped: 0 };
  if (dryRun) {
    console.log(`\n[DRY RUN] Would save ${signals.length} signals`);
    return { saved: signals.length, skipped: 0 };
  }

  let saved = 0;
  let skipped = 0;
  const batch = db.batch();

  for (const signal of signals) {
    const docRef = db.collection(CONFIG.SIGNALS_COLLECTION).doc(signal.id);
    const existing = await docRef.get();

    if (existing.exists) {
      skipped++;
    } else {
      batch.set(docRef, signal);
      saved++;
    }
  }

  if (saved > 0) {
    await batch.commit();
  }

  console.log(`Signals: ${saved} saved, ${skipped} skipped (duplicates)`);
  return { saved, skipped };
}

async function saveProfiles(profiles, dryRun = false) {
  if (profiles.length === 0) return { saved: 0, skipped: 0 };
  if (dryRun) {
    console.log(`\n[DRY RUN] Would save ${profiles.length} profiles`);
    return { saved: profiles.length, skipped: 0 };
  }

  let saved = 0;
  let skipped = 0;
  const batch = db.batch();

  for (const profileUrl of profiles) {
    const profileId = generateSignalId('profile', profileUrl);
    const docRef = db.collection(CONFIG.PROFILES_COLLECTION).doc(profileId);
    const existing = await docRef.get();

    if (existing.exists) {
      skipped++;
    } else {
      batch.set(docRef, {
        url: profileUrl,
        scraped: false,
        discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      saved++;
    }
  }

  if (saved > 0) {
    await batch.commit();
  }

  console.log(`Profiles: ${saved} saved, ${skipped} skipped (duplicates)`);
  return { saved, skipped };
}

async function updateState(stats) {
  const stateRef = db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC);
  await stateRef.set({
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    lastRunStats: stats,
  }, { merge: true });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runMonitor(options = {}) {
  console.log('='.repeat(60));
  console.log('MLM SIGNAL MONITOR - Agent-Based Lead Discovery');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Source: ${options.source || 'all'}`);

  const allSignals = [];
  const allProfiles = new Set();

  // Run agents based on source filter
  const source = options.source?.toLowerCase();

  if (!source || source === 'google') {
    const googleResults = await googleSearchAgent(options);
    allSignals.push(...googleResults.signals);
    googleResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'reddit') {
    const redditResults = await redditAgent(options);
    allSignals.push(...redditResults.signals);
    redditResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'youtube') {
    const youtubeResults = await youtubeAgent(options);
    allSignals.push(...youtubeResults.signals);
    youtubeResults.profiles.forEach(p => allProfiles.add(p));
  }

  // Save results
  console.log('\n' + '='.repeat(60));
  console.log('SAVING RESULTS');
  console.log('='.repeat(60));

  const signalStats = await saveSignals(allSignals, options.dryRun);
  const profileStats = await saveProfiles(Array.from(allProfiles), options.dryRun);

  // Update state
  if (!options.dryRun) {
    await updateState({
      signalsSaved: signalStats.saved,
      signalsSkipped: signalStats.skipped,
      profilesSaved: profileStats.saved,
      profilesSkipped: profileStats.skipped,
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total signals detected: ${allSignals.length}`);
  console.log(`  - Saved: ${signalStats.saved}`);
  console.log(`  - Skipped (duplicates): ${signalStats.skipped}`);
  console.log(`Total profiles discovered: ${allProfiles.size}`);
  console.log(`  - Saved: ${profileStats.saved}`);
  console.log(`  - Skipped (duplicates): ${profileStats.skipped}`);

  return {
    signals: allSignals.length,
    profiles: allProfiles.size,
    saved: signalStats.saved + profileStats.saved,
  };
}

async function showStats() {
  console.log('='.repeat(60));
  console.log('MLM SIGNAL MONITOR - Collection Statistics');
  console.log('='.repeat(60));

  // Signals collection
  const signalsSnap = await db.collection(CONFIG.SIGNALS_COLLECTION).count().get();
  console.log(`\n${CONFIG.SIGNALS_COLLECTION}:`);
  console.log(`  Total: ${signalsSnap.data().count}`);

  // Count by source
  const sources = ['google', 'reddit', 'youtube'];
  for (const source of sources) {
    const count = await db.collection(CONFIG.SIGNALS_COLLECTION)
      .where('source', '==', source)
      .count().get();
    console.log(`  - ${source}: ${count.data().count}`);
  }

  // Profiles collection
  const profilesSnap = await db.collection(CONFIG.PROFILES_COLLECTION).count().get();
  const unscrapedSnap = await db.collection(CONFIG.PROFILES_COLLECTION)
    .where('scraped', '==', false)
    .count().get();

  console.log(`\n${CONFIG.PROFILES_COLLECTION}:`);
  console.log(`  Total: ${profilesSnap.data().count}`);
  console.log(`  Unscraped: ${unscrapedSnap.data().count}`);

  // Last run info
  const stateDoc = await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).get();
  if (stateDoc.exists) {
    const state = stateDoc.data();
    console.log(`\nLast Run:`);
    console.log(`  Time: ${state.lastRunAt?.toDate()?.toISOString() || 'N/A'}`);
    if (state.lastRunStats) {
      console.log(`  Signals saved: ${state.lastRunStats.signalsSaved}`);
      console.log(`  Profiles saved: ${state.lastRunStats.profilesSaved}`);
    }
  }
}

async function resetState() {
  console.log('Resetting monitor state...');
  await db.collection(CONFIG.STATE_COLLECTION).doc(CONFIG.STATE_DOC).delete();
  console.log('State reset complete');
}

// ============================================================================
// CLI HANDLING
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    source: args.find(a => a.startsWith('--source='))?.split('=')[1],
    maxQueries: parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1]) || undefined,
  };

  initFirebase();

  if (args.includes('--stats')) {
    await showStats();
  } else if (args.includes('--reset')) {
    await resetState();
  } else if (args.includes('--monitor')) {
    await runMonitor(options);
  } else {
    console.log(`
MLM Signal Monitor - Agent-Based Lead Discovery

Usage:
  node scripts/mlm-signal-monitor.js --monitor              # Run full monitoring
  node scripts/mlm-signal-monitor.js --monitor --source=google   # Google only
  node scripts/mlm-signal-monitor.js --monitor --source=reddit   # Reddit only
  node scripts/mlm-signal-monitor.js --monitor --source=youtube  # YouTube only
  node scripts/mlm-signal-monitor.js --monitor --max=5      # Limit queries
  node scripts/mlm-signal-monitor.js --dry-run --monitor    # Preview mode
  node scripts/mlm-signal-monitor.js --stats                # Show stats
  node scripts/mlm-signal-monitor.js --reset                # Reset state
    `);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
