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
 *   4. Facebook - Posts/pages via Google site: search
 *   5. Twitter/X - Tweets via Google site: search
 *   6. TikTok - Videos via Google site: search
 *   7. Instagram - Posts/profiles via Google site: search
 *   8. Threads - Posts via Google site: search
 *
 * Usage:
 *   node scripts/mlm-signal-monitor.js --monitor              # Run full monitoring cycle (all 8 sources)
 *   node scripts/mlm-signal-monitor.js --monitor --source=google   # Google only
 *   node scripts/mlm-signal-monitor.js --monitor --source=reddit   # Reddit only
 *   node scripts/mlm-signal-monitor.js --monitor --source=youtube  # YouTube only
 *   node scripts/mlm-signal-monitor.js --monitor --source=facebook # Facebook only
 *   node scripts/mlm-signal-monitor.js --monitor --source=twitter  # Twitter/X only
 *   node scripts/mlm-signal-monitor.js --monitor --source=tiktok   # TikTok only
 *   node scripts/mlm-signal-monitor.js --monitor --source=instagram # Instagram only
 *   node scripts/mlm-signal-monitor.js --monitor --source=threads  # Threads only
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
    '"ground floor opportunity" network marketing',
    '"team leader" "looking for" direct sales',
    '"expanding my team" MLM OR "network marketing"',
    '"home based business" opportunity',
    '"home based business" recruiting',
    '"home business" "join my team"',

    // Product promotion signals
    '"independent consultant" OR "independent distributor"',
    '"earn extra income" "health and wellness"',
    '"be your own boss" network marketing',
    '"side hustle" direct sales opportunity',
    '"financial freedom" network marketing',
    '"home based business" "extra income"',

    // Social proof signals
    '"changed my life" MLM OR "direct sales"',
    '"quit my job" network marketing',
    '"top earner" direct sales',
    '"rank advancement" network marketing',
    '"hit diamond" OR "hit platinum" direct sales',
    '"home based business" success story',
  ],

  // Company-specific search queries (rotated through during monitoring)
  COMPANY_SIGNAL_QUERIES: [
    // Top tier companies (highest activity)
    'Amway IBO recruiting "join my team"',
    'Herbalife distributor opportunity "looking for"',
    'Young Living essential oils "business opportunity"',
    'doTERRA wellness advocate recruiting',
    'Monat VIP "join my team" OR "looking for"',
    'Arbonne consultant "ground floor" OR recruiting',
    'Plexus ambassador "join my team"',
    'Pruvit promoter "business opportunity"',
    'It Works distributor recruiting',
    'Scentsy consultant "join my team"',
    'Mary Kay consultant recruiting opportunity',
    'Avon representative "join my team"',
    'Tupperware consultant "business opportunity"',
    'Pampered Chef consultant recruiting',
    'Color Street stylist "join my team"',
    'Paparazzi accessories consultant recruiting',
    'LuLaRoe retailer "looking for"',
    'Younique presenter "join my team"',
    'Rodan and Fields consultant recruiting',
    'Pure Romance consultant "business opportunity"',
    'Beachbody coach recruiting "join my team"',
    'Optavia coach "health coach" recruiting',
    'Shaklee distributor "join my team"',
    'USANA associate recruiting opportunity',
    'Nu Skin distributor "business opportunity"',
    'Melaleuca "wellness company" recruiting',
    'Isagenix associate "join my team"',
    'Forever Living distributor recruiting',
    'Juice Plus distributor "looking for"',
    'Modere social marketer recruiting',
    'Le-Vel Thrive promoter "join my team"',
    'LifeVantage distributor recruiting',
    'Neora brand partner "business opportunity"',
    'Tranont associate recruiting',
    'Zilis ambassador "join my team"',
    'ACN representative recruiting opportunity',
    'LegalShield associate "business opportunity"',
    'Primerica representative recruiting',
    'World Financial Group agent recruiting',
    'PHP Agency agent "looking for"',
    'Cutco sales representative recruiting',
    'Kirby vacuum distributor opportunity',
    'Norwex consultant "join my team"',
    'Stella and Dot stylist recruiting',
    'Origami Owl designer "business opportunity"',
    'Thirty-One consultant recruiting',
    'Jeunesse distributor "join my team"',
    'Organo distributor recruiting opportunity',
    'Zinzino partner "business opportunity"',
    'LiveGood affiliate recruiting',
    'Farmasi beauty influencer "join my team"',
    'Valentus distributor recruiting',
    'Rain International distributor opportunity',
    'ASEA associate recruiting',
    'Healy World distributor "join my team"',
    'LifeWave distributor recruiting',
    'Atomy member "business opportunity"',
    'DXN distributor recruiting',
    'Oriflame consultant "join my team"',
    'FM World distributor recruiting',
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
    // Generic MLM terms
    'network marketing', 'direct sales', 'MLM', 'downline', 'upline',
    'team building', 'home business', 'home based business', 'wellness company', 'multi-level',
    'independent consultant', 'independent distributor', 'side hustle opportunity', 'work from home opportunity',

    // Top 50 company names for Reddit monitoring
    'amway', 'herbalife', 'avon', 'mary kay', 'tupperware', 'young living', 'doterra',
    'monat', 'arbonne', 'plexus', 'usana', 'isagenix', 'nu skin', 'melaleuca', 'shaklee',
    'primerica', 'beachbody', 'it works', 'scentsy', 'pampered chef', 'rodan and fields',
    'younique', 'origami owl', 'thirty-one', 'paparazzi', 'lularoe', 'color street',
    'pure romance', 'pruvit', 'modere', 'juice plus', 'advocare', 'optavia', 'tranont',
    'lifevantage', 'neora', 'zilis', 'enagic', 'worldventures', 'acn', 'legalshield',
    'forever living', 'organo', 'jeunesse', 'zinzino', 'farmasi', 'norwex', 'cutco',
    'livegood', 'valentus', 'thrive', 'le-vel',
  ],

  // Social media platform queries (used with site: operator)
  SOCIAL_MEDIA_QUERIES: {
    // Facebook-specific queries
    facebook: [
      '"join my team" network marketing',
      '"looking for" direct sales opportunity',
      '"business opportunity" MLM wellness',
      '"independent consultant" recruiting',
      '"work from home" "direct sales"',
      '"home based business" opportunity',
      '"home based business" recruiting',
      'Amway IBO "join my team"',
      'Herbalife distributor recruiting',
      'Young Living essential oils opportunity',
      'doTERRA wellness advocate',
      'Monat VIP "looking for"',
      '"ground floor" network marketing',
      '"team building" direct sales',
    ],
    // Twitter/X-specific queries
    twitter: [
      'network marketing opportunity',
      'MLM recruiting "join my team"',
      'direct sales "looking for"',
      '#NetworkMarketing #JoinMyTeam',
      '#MLM #BusinessOpportunity',
      '#DirectSales #WorkFromHome',
      '#HomeBasedBusiness opportunity',
      'home based business recruiting',
      'Amway opportunity',
      'Herbalife business',
      'doTERRA wellness',
      'Young Living oils business',
    ],
    // TikTok-specific queries
    tiktok: [
      'network marketing tips',
      'MLM success story',
      'direct sales day in the life',
      'side hustle opportunity',
      'home based business opportunity',
      '#networkmarketing #mlm',
      '#directsales #bossbabe',
      '#homebasedbusiness',
      'Herbalife transformation',
      'Monat hair journey',
      'doTERRA oils routine',
    ],
    // Instagram-specific queries
    instagram: [
      '"link in bio" network marketing',
      '"DM me" direct sales',
      '#BossBabe #NetworkMarketing',
      '#MLMSuccess #DirectSales',
      '#HomeBasedBusiness #Opportunity',
      '"join my team" wellness',
      '"home based business" opportunity',
      'Arbonne consultant',
      'Rodan Fields consultant',
      'BeachBody coach',
      'ItWorks distributor',
    ],
    // Threads-specific queries
    threads: [
      'network marketing opportunity',
      'direct sales recruiting',
      'MLM business opportunity',
      'home based business opportunity',
      'wellness company "join"',
      'work from home direct sales',
    ],
  },

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

  // Comprehensive list of MLM/Direct Sales/Network Marketing companies
  // Source: BusinessForHome.org/companies/ (500+ companies)
  MLM_COMPANIES: [
    // Top 50 most recognized companies (high priority for signal detection)
    'amway', 'herbalife', 'avon', 'mary kay', 'tupperware', 'young living', 'doterra',
    'monat', 'arbonne', 'plexus', 'usana', 'isagenix', 'nu skin', 'melaleuca', 'shaklee',
    'primerica', 'beachbody', 'it works', 'scentsy', 'pampered chef', 'rodan and fields',
    'younique', 'origami owl', 'thirty-one', 'paparazzi', 'lularoe', 'color street',
    'pure romance', 'pruvit', 'modere', 'juice plus', 'advocare', 'optavia', 'tranont',
    'lifevantage', 'neora', 'zilis', 'enagic', 'worldventures', 'acn', 'legalshield',
    'forever living', 'organo', 'jeunesse', 'zinzino', 'kyani', 'immunotec', 'mannatech',
    'market america', 'reliv', 'xyngular',

    // A-B companies
    '4life', '7k metals', 'acti-labs', 'activz', 'adornable.u', 'aerus', 'agoa home',
    'agravitae', 'akmos', 'akuna', 'aleonn', 'alliance in motion', 'allysian', 'aloette',
    'alovea', 'alphay', 'aluva', 'amakha paris', 'amare', 'ambit energy', 'ameriplan',
    'amore pacific', 'ann summers', 'anovite', 'aplgo', 'aquasource', 'ardyss', 'arego life',
    'arieyl', 'aromatic 89', 'arsoa', 'arvea nature', 'ascira', 'asclepius wellness', 'asea',
    'asili global', 'atomy', 'audere', 'australiana life', 'auvoria prime', 'avena originals',
    'awakend', 'axxa global', 'ayucell', 'azenka', 'azuli skye', 'b-epic', 'bepic',
    'barefoot books', 'be club', 'be live', 'beauty society', 'because cosmetics', 'belcorp',
    'bella grace', 'bella modi', 'bellame', 'beneve', 'best world', 'bestlife worldwide',
    'betterware', 'beyond slim', 'beyuna', 'bf suma', 'bhip global', 'bio4', 'bioheal',
    'bioreigns', 'biotonus', 'bioulife', 'bitles', 'blen', 'blezi', 'bode pro', 'body wise',
    'bodylogic', 'bofrost', 'boisset wine', 'bomb party', 'bonvera', 'bravenly', 'breathless wines',
    'bryte lyfe', 'bydzyne',

    // C-D companies
    'cabi', 'calerie', 'cambridge diet', 'cannaglobe', 'captain tortue', 'carico', 'celadon road',
    'celebrating home', 'celframe', 'cellagon', 'cellements', 'cellis health', 'cerule', 'cevitalis',
    'chalk couture', 'chalky and company', 'chandeal', 'charle corp', 'chogan', 'cili', 'clearunited',
    'close to my heart', 'cognoa', 'color me beautiful', 'colway', 'compelling creations', 'conklin',
    'coral club', 'corvive', 'cosway', 'coway', 'creative memories', 'ctfo', 'culbeans', 'cutco',
    'daisy blue naturals', 'damsel in defense', 'dbm global', 'deesse', 'delta digital', 'destander',
    'diana co', 'dignity organic', 'dr juchheim', 'dreamtrips', 'dub nutrition', 'dudley products',
    'duolife', 'dvlop', 'dxn', 'dyna maxx',

    // E-F companies
    'e excel', 'epic trading', 'eaconomy', 'eazyways', 'edmark', 'el recetario', 'elevitea', 'elken',
    'ellie md', 'elomir', 'eminence organic', 'energetix', 'energymax', 'eniva', 'enzacta', 'eqology',
    'essante organics', 'essens', 'essential bodywear', 'eternal spirit beauty', 'ev international',
    'evergreen life', 'evo global', 'evolution network', 'evomel', 'exialoe', 'exp realty', 'faberlic',
    'fair network', 'family first life', 'farmasi', 'fifth avenue collection', 'fireflies',
    'firstfitness nutrition', 'fitteam', 'flavon', 'fm world', 'for days', 'for you', 'freeko',
    'frequense', 'ftr global', 'fumee perfume', 'fun stampers journey', 'future global vision',
    'futures luume', 'fuxion',

    // G-H companies
    'gano excel', 'gelmoment', 'genistar', 'genlife', 'giffarine', 'glaze trading', 'global domains',
    'globallee', 'gng', 'gofinity', 'gold canyon', 'golden days', 'govvi', 'gracewear', 'greatlife',
    'green compass', 'greenchoyce', 'greenway global', 'h2o at home', 'ha-ra', 'hai-o', 'haka kunz',
    'hawaii balsamics', 'hb naturals', 'hc wellness', 'healthgarde', 'healthsync', 'healthyhome',
    'healy world', 'hegemon group', 'hgi', 'heim and haus', 'hempmate', 'hibody', 'hinode', 'homm bitkisel',
    'hph', 'hte usa', 'hugh and grace', 'hulsa', 'hy cite',

    // I-J companies
    'i9life', 'iam worldwide', 'ibuumerang', 'idlife', 'ievolution', 'igenius', 'ihealth global',
    'ihub global', 'illuminent', 'imc', 'impact global', 'imuni', 'in8 network', 'inbs', 'incruises',
    'inetwork2u', 'infinitus', 'initial outfitters', 'inkavida', 'innov8tive nutrition', 'innova',
    'inqten', 'inspiranza designs', 'inspire', 'inuka fragrances', 'ion savings', 'ipro network',
    'ismerely', 'j hilburn', 'japanlife', 'java momma', 'jbloom designs', 'jerelia', 'jewel pads',
    'jewelry in candles', 'jifu', 'jordan essentials', 'joy main', 'jr watkins', 'juara skincare',
    'jump to health', 'just international', 'juuva',

    // K-L companies
    'kalaia', 'kangmei', 'kangzen', 'kannaway', 'kara vita', 'kirby company', 'kitchen fair',
    'kk assuran', 'kleo kolor', 'koyo-sha', 'kuailian', 'kz1', 'l bri', 'lavylites', 'le-vel',
    'thrive', 'legacy global', 'lemongrass spa', 'levarti', 'lg household', 'life abundance',
    'life activated', 'life leadership', 'life plus', 'life wise', 'lifepharm', 'liferegen',
    'lifewave', 'lilla rose', 'limelife', 'liv labs', 'livegood', 'livelite', 'livepure', 'longrich',
    'lorde and belle', 'lorraine lea', 'lovebiome', 'lovewinx', 'lovvare', 'lr health and beauty',
    'lumivitae', 'lunamd', 'lurralife', 'lux international',

    // M-N companies
    'magnabilities', 'magnessa', 'magnetix wellness', 'make wellness', 'mango and moose', 'marketplace global',
    'mpg', 'maruko', 'mavie global', 'max international', 'maxener wellness', 'measure and made',
    'mediterranean luxury', 'metalstacks', 'metrin', 'mi lifestyle', 'miessence', 'miglio', 'miki corp',
    'mined', 'miraburst', 'mkx network', 'modicare', 'momentum business', 'monevis', 'mons pura',
    'muscari', 'musthave global', 'mwr life', 'my lifestyle', 'mydailychoice', 'myecon', 'mytravelventures',
    'n8 essentials', 'nafis network', 'naris cosmetics', 'national wealth center', 'natura', 'natura vitalis',
    'natural glow', 'naturally plus', 'naturday', 'natures sunshine', 'nefful', 'nelo life', 'neofin',
    'neolife', 'netsurf', 'neumi', 'neutroway', 'nevetica', 'new earth', 'new era health', 'new hope global',
    'new image', 'new u life', 'newgen direct', 'nexarise', 'next international', 'nexus rewards',
    'nht global', 'nikken', 'nippon menard', 'noevir', 'nomades collection', 'noonday collection',
    'northestar', 'norwex', 'novae', 'novalya', 'nowsite', 'nucleogenex', 'nudrate', 'nui social',
    'nuspira', 'nutonic', 'nutrimetics', 'nuvo olive oil', 'nuyugen', 'nvu', 'nyr organic',

    // O-P companies
    'o boticario', 'oben nutrition', 'odecent', 'ohho', 'olbali', 'olive tree people', 'olixfit',
    'omnilife', 'one more international', 'onehope wine', 'onikha', 'optidee', 'opulence global',
    'opulenza designs', 'oriflame', 'oxo global', 'panberes', 'parinam health', 'park lane jewelry',
    'pars newshanik', 'partner.co', 'partylite', 'pawtree', 'pelle naturale', 'perfect china',
    'perfectly posh', 'php agency', 'phytoscience', 'pieroth wein', 'pink zebra', 'plannet marketing',
    'playcare health', 'plennia wellness', 'plunder design', 'pm-international', 'pola', 'polishop',
    'pomifera', 'powur', 'premier designs', 'premier financial', 'prife international', 'primemybody',
    'princess house', 'pro financial group', 'proceller8', 'prowin', 'pur attitude', 'pure heaven',
    'pure natures design', 'purium',

    // Q-R companies
    'qn europe', 'qnet', 'qsciences', 'quanjian', 'quiari', 'qyral', 'racco cosmeticos', 'radiantly you',
    'rain international', 'ramissio', 'rbc life sciences', 'rcm marketing', 'reach solar', 'real brokerage',
    'real time pain relief', 'reature organics', 'red aspen', 'regal ware', 'regenalife', 'reico vital',
    'revital u', 'revv naturals', 'rexair', 'riman', 'ringana', 'risen live', 'riseoo', 'rmcl universe',
    'root wellness', 'royale business club', 'ruby ribbon', 'rut essentials',

    // S companies
    'saba', 'sabika', 'saladmaster', 'sami direct', 'sanki global', 'santemorr', 'sarso biznet',
    'save club', 'savings highway', 'savvi', 'scent team', 'scout and cellar', 'seacret direct',
    'send out cards', 'senegence', 'sevinity', 'sf suite', 'shine cosmetics', 'shoply', 'shopping nation',
    'shopwithme', 'siberian health', 'sibu beauty', 'signature homestyles', 'silk oil of morocco',
    'silver icing', 'simply naturals', 'simply said', 'simplyfun', 'simplyhealth24', 'sinergify world',
    'sisel', 'skypex', 'smart plus', 'snep international', 'sol people', 'soluni', 'solvasa beauty',
    'somnvie', 'sonrich asia', 'sorgenta', 'soteria', 'soul purpose', 'southwestern advantage', 'souvre',
    'spx nutrition', 'stampin up', 'steeped tea', 'stella and dot', 'stemtech', 'style dots', 'successmore',
    'sunhope', 'sunrider', 'sunrun', 'superlife world', 'surge 365', 'swag ou', 'swissjust', 'synergy worldwide',

    // T-U companies
    'taksoo', 'talk fusion', 'tastefully simple', 'tava lifestyle', 'tealightful', 'teleson', 'tenlead biotech',
    'teoma', 'thanks ai', 'the coastal shopping club', 'the code', 'the happy co', 'the maira co',
    'the pink millionaire club', 'the spellbound co', 'the strange apothecary', 'the super patch company',
    'three international', 'thrive life', 'tiande', 'tiens', 'tmc the members club', 'tocara', 'top balance',
    'toptime', 'toribelle cosmetics', 'total life changes', 'tlc', 'touchstone crystal', 'touchstone essentials',
    'traveling vineyard', 'travorium', 'tre venti global', 'trevo', 'trinti communications', 'trivita',
    'true nordic', 'truiq global', 'truu', 'truvy', 'trvl ventures', 'tts international', 'u-numera',
    'ultrra', 'unicity', 'univera', 'unrivaled candles', 'up essencia', 'upshoot', 'ur worth it',
    'usborne books', 'utility warehouse', 'uzesta',

    // V-Z companies
    'va-life', 'vabo-n', 'valentus', 'vegas cosmetics', 'velovita', 'vertera', 'vestige marketing', 'vfinity',
    'viable', 'viaveta', 'vic beauty', 'victoria benelux', 'vida divina', 'vidafy', 'vieroots wellness',
    'viiva', 'vip international', 'visi', 'vital health global', 'vitamist', 'viv', 'viviane skincare',
    'vivint smart home', 'vivri', 'vorwerk', 'voxx life', 'vyvo', 'wakaya perfection', 'we now global',
    'wellness biosciences', 'wellnesspro', 'wellstar', 'welltures global', 'wewe global', 'wildtree',
    'win worldwide', 'wineshop at home', 'winlife global', 'world book', 'world financial group', 'wfg',
    'xcelerate', 'xelliss', 'xendurance', 'xooma worldwide', 'xosialx', 'xpirient', 'xyngenta',
    'yanbal', 'yanoli', 'yes global', 'yoli', 'yolllo', 'yor health', 'youngevity', 'zermat', 'zeta group',
    'zhulian', 'zurvita',
  ],

  // High-priority companies for dedicated search queries (top 100 most active)
  HIGH_PRIORITY_COMPANIES: [
    'amway', 'herbalife', 'avon', 'mary kay', 'tupperware', 'young living', 'doterra', 'monat',
    'arbonne', 'plexus', 'usana', 'isagenix', 'nu skin', 'melaleuca', 'shaklee', 'primerica',
    'beachbody', 'it works', 'scentsy', 'pampered chef', 'rodan and fields', 'younique',
    'origami owl', 'thirty-one', 'paparazzi', 'lularoe', 'color street', 'pure romance', 'pruvit',
    'modere', 'juice plus', 'advocare', 'optavia', 'tranont', 'lifevantage', 'neora', 'zilis',
    'enagic', 'worldventures', 'acn', 'legalshield', 'forever living', 'organo', 'jeunesse',
    'zinzino', 'kyani', 'immunotec', 'mannatech', 'market america', 'reliv', 'xyngular',
    'le-vel', 'thrive', 'farmasi', 'norwex', 'stella and dot', 'partylite', 'cutco', 'kirby',
    'world financial group', 'php agency', 'family first life', 'exp realty', 'keller williams',
    'livegood', 'myecon', 'sendoutcards', 'nerium', 'kannaway', 'hempworx', 'mydailychoice',
    'valentus', 'total life changes', 'rain international', 'asea', 'lifepharm', 'neolife',
    'nikken', 'sunrider', 'natures sunshine', 'unicity', 'atomy', 'dxn', 'qnet', 'oriflame',
    'natura', 'belcorp', 'yanbal', 'hinode', 'omnilife', 'betterware', 'fuxion', 'duolife',
    'fm world', 'lr health', 'pm-international', 'ringana', 'healy world', 'lifewave',
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

  // Combine general MLM queries with company-specific queries
  // Use 70% general queries, 30% company-specific for variety
  const maxQueries = options.maxQueries || 15;
  const generalQueryCount = Math.ceil(maxQueries * 0.7);
  const companyQueryCount = maxQueries - generalQueryCount;

  // Shuffle and select from each pool
  const shuffledGeneral = [...CONFIG.MLM_SIGNAL_QUERIES].sort(() => Math.random() - 0.5);
  const shuffledCompany = [...CONFIG.COMPANY_SIGNAL_QUERIES].sort(() => Math.random() - 0.5);

  const queries = [
    ...shuffledGeneral.slice(0, generalQueryCount),
    ...shuffledCompany.slice(0, companyQueryCount),
  ];

  console.log(`\n=== Google Search Agent ===`);
  console.log(`Processing ${queries.length} queries (${generalQueryCount} general, ${companyQueryCount} company-specific)...`);

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

  // General MLM YouTube queries
  const generalQueries = [
    'network marketing success tips 2026',
    'MLM recruiting strategies',
    'direct sales business opportunity',
    'how to build your MLM team',
    'work from home direct sales',
  ];

  // Company-specific YouTube queries (rotate through high-priority companies)
  const companyQueries = CONFIG.HIGH_PRIORITY_COMPANIES
    .slice(0, 10)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(company => `${company} distributor success story 2026`);

  const youtubeQueries = [...generalQueries, ...companyQueries];

  console.log(`\n=== YouTube Agent ===`);
  console.log(`Searching ${youtubeQueries.length} queries (${generalQueries.length} general, ${companyQueries.length} company-specific)...`);

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

/**
 * Facebook Agent - Uses SerpAPI Google search with site:facebook.com
 */
async function facebookAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping Facebook search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const queries = CONFIG.SOCIAL_MEDIA_QUERIES.facebook;
  const maxQueries = options.maxQueries || 5;

  console.log(`\n=== Facebook Agent ===`);
  console.log(`Searching ${Math.min(maxQueries, queries.length)} queries via Google site:facebook.com...`);

  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, maxQueries);

  for (let i = 0; i < selectedQueries.length; i++) {
    const baseQuery = selectedQueries[i];
    const query = `site:facebook.com ${baseQuery}`;
    console.log(`\n[${i + 1}/${selectedQueries.length}] "${baseQuery.substring(0, 40)}..."`);

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

        // Extract Facebook profile/page URLs
        const fbProfileMatch = result.link?.match(/facebook\.com\/([a-zA-Z0-9.]+)/);
        if (fbProfileMatch) {
          profiles.add(result.link);
        }

        if (extractedUrls.length > 0 || extractedEmails.length > 0 || company || fbProfileMatch) {
          const signalId = generateSignalId('facebook', result.link);

          signals.push({
            id: signalId,
            source: 'facebook',
            platform: 'facebook',
            query: baseQuery,
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

    if (i < selectedQueries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nFacebook Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * Twitter/X Agent - Uses SerpAPI Google search with site:twitter.com OR site:x.com
 */
async function twitterAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping Twitter search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const queries = CONFIG.SOCIAL_MEDIA_QUERIES.twitter;
  const maxQueries = options.maxQueries || 5;

  console.log(`\n=== Twitter/X Agent ===`);
  console.log(`Searching ${Math.min(maxQueries, queries.length)} queries via Google site:twitter.com...`);

  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, maxQueries);

  for (let i = 0; i < selectedQueries.length; i++) {
    const baseQuery = selectedQueries[i];
    // Search both twitter.com and x.com
    const query = `(site:twitter.com OR site:x.com) ${baseQuery}`;
    console.log(`\n[${i + 1}/${selectedQueries.length}] "${baseQuery.substring(0, 40)}..."`);

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

        // Extract Twitter/X profile URLs
        const twitterMatch = result.link?.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/);
        if (twitterMatch && !['search', 'hashtag', 'i', 'intent'].includes(twitterMatch[1])) {
          profiles.add(result.link);
        }

        if (extractedUrls.length > 0 || extractedEmails.length > 0 || company || twitterMatch) {
          const signalId = generateSignalId('twitter', result.link);

          signals.push({
            id: signalId,
            source: 'twitter',
            platform: 'twitter',
            query: baseQuery,
            title: result.title,
            snippet: result.snippet,
            sourceUrl: result.link,
            twitterHandle: twitterMatch ? twitterMatch[1] : null,
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

    if (i < selectedQueries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nTwitter/X Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * TikTok Agent - Uses SerpAPI Google search with site:tiktok.com
 */
async function tiktokAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping TikTok search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const queries = CONFIG.SOCIAL_MEDIA_QUERIES.tiktok;
  const maxQueries = options.maxQueries || 5;

  console.log(`\n=== TikTok Agent ===`);
  console.log(`Searching ${Math.min(maxQueries, queries.length)} queries via Google site:tiktok.com...`);

  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, maxQueries);

  for (let i = 0; i < selectedQueries.length; i++) {
    const baseQuery = selectedQueries[i];
    const query = `site:tiktok.com ${baseQuery}`;
    console.log(`\n[${i + 1}/${selectedQueries.length}] "${baseQuery.substring(0, 40)}..."`);

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

        // Extract TikTok profile URLs (format: tiktok.com/@username)
        const tiktokMatch = result.link?.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
        if (tiktokMatch) {
          profiles.add(result.link);
        }

        if (extractedUrls.length > 0 || company || tiktokMatch) {
          const signalId = generateSignalId('tiktok', result.link);

          signals.push({
            id: signalId,
            source: 'tiktok',
            platform: 'tiktok',
            query: baseQuery,
            title: result.title,
            snippet: result.snippet,
            sourceUrl: result.link,
            tiktokHandle: tiktokMatch ? tiktokMatch[1] : null,
            detectedCompany: company,
            extractedUrls: extractedUrls,
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          extractedUrls.forEach(url => profiles.add(url));
        }
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < selectedQueries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nTikTok Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * Instagram Agent - Uses SerpAPI Google search with site:instagram.com
 */
async function instagramAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping Instagram search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const queries = CONFIG.SOCIAL_MEDIA_QUERIES.instagram;
  const maxQueries = options.maxQueries || 5;

  console.log(`\n=== Instagram Agent ===`);
  console.log(`Searching ${Math.min(maxQueries, queries.length)} queries via Google site:instagram.com...`);

  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, maxQueries);

  for (let i = 0; i < selectedQueries.length; i++) {
    const baseQuery = selectedQueries[i];
    const query = `site:instagram.com ${baseQuery}`;
    console.log(`\n[${i + 1}/${selectedQueries.length}] "${baseQuery.substring(0, 40)}..."`);

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

        // Extract Instagram profile URLs
        const instaMatch = result.link?.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
        if (instaMatch && !['p', 'explore', 'reel', 'stories', 'accounts'].includes(instaMatch[1])) {
          profiles.add(result.link);
        }

        if (extractedUrls.length > 0 || company || instaMatch) {
          const signalId = generateSignalId('instagram', result.link);

          signals.push({
            id: signalId,
            source: 'instagram',
            platform: 'instagram',
            query: baseQuery,
            title: result.title,
            snippet: result.snippet,
            sourceUrl: result.link,
            instagramHandle: instaMatch ? instaMatch[1] : null,
            detectedCompany: company,
            extractedUrls: extractedUrls,
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          extractedUrls.forEach(url => profiles.add(url));
        }
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < selectedQueries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nInstagram Agent: ${signals.length} signals, ${profiles.size} profiles`);
  return { signals, profiles: Array.from(profiles) };
}

/**
 * Threads Agent - Uses SerpAPI Google search with site:threads.net
 */
async function threadsAgent(options = {}) {
  if (!SERPAPI_KEY) {
    console.log('SerpAPI key not found - skipping Threads search');
    return { signals: [], profiles: [] };
  }

  const signals = [];
  const profiles = new Set();
  const queries = CONFIG.SOCIAL_MEDIA_QUERIES.threads;
  const maxQueries = options.maxQueries || 3;

  console.log(`\n=== Threads Agent ===`);
  console.log(`Searching ${Math.min(maxQueries, queries.length)} queries via Google site:threads.net...`);

  const selectedQueries = queries.sort(() => Math.random() - 0.5).slice(0, maxQueries);

  for (let i = 0; i < selectedQueries.length; i++) {
    const baseQuery = selectedQueries[i];
    const query = `site:threads.net ${baseQuery}`;
    console.log(`\n[${i + 1}/${selectedQueries.length}] "${baseQuery.substring(0, 40)}..."`);

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

        // Extract Threads profile URLs (format: threads.net/@username)
        const threadsMatch = result.link?.match(/threads\.net\/@([a-zA-Z0-9_.]+)/);
        if (threadsMatch) {
          profiles.add(result.link);
        }

        if (extractedUrls.length > 0 || company || threadsMatch) {
          const signalId = generateSignalId('threads', result.link);

          signals.push({
            id: signalId,
            source: 'threads',
            platform: 'threads',
            query: baseQuery,
            title: result.title,
            snippet: result.snippet,
            sourceUrl: result.link,
            threadsHandle: threadsMatch ? threadsMatch[1] : null,
            detectedCompany: company,
            extractedUrls: extractedUrls,
            discoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          extractedUrls.forEach(url => profiles.add(url));
        }
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }

    if (i < selectedQueries.length - 1) {
      await sleep(addJitter(CONFIG.SERPAPI_DELAY));
    }
  }

  console.log(`\nThreads Agent: ${signals.length} signals, ${profiles.size} profiles`);
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

  if (!source || source === 'facebook') {
    const facebookResults = await facebookAgent(options);
    allSignals.push(...facebookResults.signals);
    facebookResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'twitter') {
    const twitterResults = await twitterAgent(options);
    allSignals.push(...twitterResults.signals);
    twitterResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'tiktok') {
    const tiktokResults = await tiktokAgent(options);
    allSignals.push(...tiktokResults.signals);
    tiktokResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'instagram') {
    const instagramResults = await instagramAgent(options);
    allSignals.push(...instagramResults.signals);
    instagramResults.profiles.forEach(p => allProfiles.add(p));
  }

  if (!source || source === 'threads') {
    const threadsResults = await threadsAgent(options);
    allSignals.push(...threadsResults.signals);
    threadsResults.profiles.forEach(p => allProfiles.add(p));
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
