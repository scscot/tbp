#!/usr/bin/env node
/**
 * Ohio Bar Attorney Scraper (Puppeteer Version)
 *
 * Scrapes attorney contact information from the Ohio State Bar Association website
 * and imports into preintake_emails collection for campaign targeting.
 *
 * Strategy: Uses Practice Area + City filtering to ensure comprehensive coverage.
 * - Ohio Bar limits results to 100 per search
 * - First tries each practice area without city filter
 * - If results = 100 (capped), subdivides by city
 * - Tracks progress to resume across daily runs
 *
 * Usage:
 *   node scripts/scrape-ohiobar-attorneys.js
 *
 * Environment variables:
 *   MAX_COMBOS - Maximum practice area + city combinations per run (default: 5)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { isGovernmentContact, cleanEmail } = require('./gov-filter-utils');

// ============================================================================
// STATE INFERENCE FROM WEBSITE
// ============================================================================

const STATE_PATTERNS = [
    { pattern: /\bAlabama\b|\b,\s*AL\b|\bBirmingham,?\s*AL/i, state: 'AL' },
    { pattern: /\bAlaska\b|\b,\s*AK\b|\bAnchorage,?\s*AK/i, state: 'AK' },
    { pattern: /\bArizona\b|\b,\s*AZ\b|\bPhoenix,?\s*AZ|\bTucson,?\s*AZ|\bScottsdale/i, state: 'AZ' },
    { pattern: /\bArkansas\b|\b,\s*AR\b|\bLittle Rock,?\s*AR/i, state: 'AR' },
    { pattern: /\bCalifornia\b|\b,\s*CA\b|\bLos Angeles|\bSan Francisco|\bSan Diego|\bSacramento|\bOakland|\bSan Jose/i, state: 'CA' },
    { pattern: /\bColorado\b|\b,\s*CO\b|\bDenver,?\s*CO|\bBoulder,?\s*CO/i, state: 'CO' },
    { pattern: /\bConnecticut\b|\b,\s*CT\b|\bHartford,?\s*CT|\bNew Haven,?\s*CT/i, state: 'CT' },
    { pattern: /\bDelaware\b|\b,\s*DE\b|\bWilmington,?\s*DE/i, state: 'DE' },
    { pattern: /\bFlorida\b|\b,\s*FL\b|\bMiami|\bOrlando|\bTampa|\bJacksonville,?\s*FL/i, state: 'FL' },
    { pattern: /\bGeorgia\b|\b,\s*GA\b|\bAtlanta,?\s*GA/i, state: 'GA' },
    { pattern: /\bHawaii\b|\b,\s*HI\b|\bHonolulu/i, state: 'HI' },
    { pattern: /\bIdaho\b|\b,\s*ID\b|\bBoise,?\s*ID/i, state: 'ID' },
    { pattern: /\bIllinois\b|\b,\s*IL\b|\bChicago|\bSpringfield,?\s*IL/i, state: 'IL' },
    { pattern: /\bIndiana\b|\b,\s*IN\b|\bIndianapolis/i, state: 'IN' },
    { pattern: /\bIowa\b|\b,\s*IA\b|\bDes Moines/i, state: 'IA' },
    { pattern: /\bKansas\b|\b,\s*KS\b|\bWichita,?\s*KS|\bTopeka/i, state: 'KS' },
    { pattern: /\bKentucky\b|\b,\s*KY\b|\bLouisville,?\s*KY|\bLexington,?\s*KY/i, state: 'KY' },
    { pattern: /\bLouisiana\b|\b,\s*LA\b|\bNew Orleans|\bBaton Rouge/i, state: 'LA' },
    { pattern: /\bMaine\b|\b,\s*ME\b|\bPortland,?\s*ME/i, state: 'ME' },
    { pattern: /\bMaryland\b|\b,\s*MD\b|\bBaltimore|\bBethesda,?\s*MD/i, state: 'MD' },
    { pattern: /\bMassachusetts\b|\b,\s*MA\b|\bBoston|\bCambridge,?\s*MA/i, state: 'MA' },
    { pattern: /\bMichigan\b|\b,\s*MI\b|\bDetroit|\bAnn Arbor|\bGrand Rapids/i, state: 'MI' },
    { pattern: /\bMinnesota\b|\b,\s*MN\b|\bMinneapolis|\bSt\.?\s*Paul,?\s*MN/i, state: 'MN' },
    { pattern: /\bMississippi\b|\b,\s*MS\b|\bJackson,?\s*MS/i, state: 'MS' },
    { pattern: /\bMissouri\b|\b,\s*MO\b|\bSt\.?\s*Louis|\bKansas City,?\s*MO/i, state: 'MO' },
    { pattern: /\bMontana\b|\b,\s*MT\b|\bBillings,?\s*MT/i, state: 'MT' },
    { pattern: /\bNebraska\b|\b,\s*NE\b|\bOmaha|\bLincoln,?\s*NE/i, state: 'NE' },
    { pattern: /\bNevada\b|\b,\s*NV\b|\bLas Vegas|\bReno,?\s*NV/i, state: 'NV' },
    { pattern: /\bNew Hampshire\b|\b,\s*NH\b|\bManchester,?\s*NH/i, state: 'NH' },
    { pattern: /\bNew Jersey\b|\b,\s*NJ\b|\bNewark,?\s*NJ|\bJersey City/i, state: 'NJ' },
    { pattern: /\bNew Mexico\b|\b,\s*NM\b|\bAlbuquerque|\bSanta Fe,?\s*NM/i, state: 'NM' },
    { pattern: /\bNew York\b|\b,\s*NY\b|\bManhattan|\bBrooklyn|\bQueens|\bBronx|\bLong Island/i, state: 'NY' },
    { pattern: /\bNorth Carolina\b|\b,\s*NC\b|\bCharlotte,?\s*NC|\bRaleigh/i, state: 'NC' },
    { pattern: /\bNorth Dakota\b|\b,\s*ND\b|\bFargo,?\s*ND/i, state: 'ND' },
    { pattern: /\bOhio\b|\b,\s*OH\b|\bCleveland|\bColumbus,?\s*OH|\bCincinnati/i, state: 'OH' },
    { pattern: /\bOklahoma\b|\b,\s*OK\b|\bOklahoma City|\bTulsa/i, state: 'OK' },
    { pattern: /\bOregon\b|\b,\s*OR\b|\bPortland,?\s*OR|\bSalem,?\s*OR/i, state: 'OR' },
    { pattern: /\bPennsylvania\b|\b,\s*PA\b|\bPhiladelphia|\bPittsburgh/i, state: 'PA' },
    { pattern: /\bRhode Island\b|\b,\s*RI\b|\bProvidence/i, state: 'RI' },
    { pattern: /\bSouth Carolina\b|\b,\s*SC\b|\bCharleston,?\s*SC|\bColumbia,?\s*SC/i, state: 'SC' },
    { pattern: /\bSouth Dakota\b|\b,\s*SD\b|\bSioux Falls/i, state: 'SD' },
    { pattern: /\bTennessee\b|\b,\s*TN\b|\bNashville|\bMemphis/i, state: 'TN' },
    { pattern: /\bTexas\b|\b,\s*TX\b|\bHouston|\bDallas|\bAustin,?\s*TX|\bSan Antonio/i, state: 'TX' },
    { pattern: /\bUtah\b|\b,\s*UT\b|\bSalt Lake City/i, state: 'UT' },
    { pattern: /\bVermont\b|\b,\s*VT\b|\bBurlington,?\s*VT/i, state: 'VT' },
    { pattern: /\bVirginia\b|\b,\s*VA\b|\bRichmond,?\s*VA|\bArlington,?\s*VA|\bNorfolk/i, state: 'VA' },
    { pattern: /\bWashington\b|\b,\s*WA\b|\bSeattle|\bTacoma|\bSpokane/i, state: 'WA' },
    { pattern: /\bWest Virginia\b|\b,\s*WV\b|\bCharleston,?\s*WV/i, state: 'WV' },
    { pattern: /\bWisconsin\b|\b,\s*WI\b|\bMilwaukee|\bMadison,?\s*WI/i, state: 'WI' },
    { pattern: /\bWyoming\b|\b,\s*WY\b|\bCheyenne/i, state: 'WY' },
    { pattern: /\bWashington,?\s*D\.?C\.?|\bDistrict of Columbia/i, state: 'DC' },
];

/**
 * Infer state from website content
 * @param {string} websiteUrl - The website URL to analyze
 * @returns {Promise<string|null>} - State code or null if cannot infer
 */
async function inferStateFromWebsite(websiteUrl) {
    if (!websiteUrl) return null;

    try {
        // Normalize URL
        let url = websiteUrl;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        if (!response.ok) return null;

        const html = await response.text();
        const textContent = html.substring(0, 50000); // Check first 50KB

        for (const { pattern, state } of STATE_PATTERNS) {
            if (pattern.test(textContent)) {
                return state;
            }
        }

        return null;
    } catch (error) {
        // Silently fail - website may be down or blocked
        return null;
    }
}

// ============================================================================
// PRACTICE AREAS (with filter IDs from Ohio Bar API)
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High priority (PI, Immigration, Workers Comp, etc.)
    { id: '62', name: 'Personal Injury and Product Liability' },
    { id: '51', name: 'Immigration' },
    { id: '73', name: 'Workers Compensation' },
    { id: '35', name: 'Bankruptcy' },
    { id: '55', name: 'Labor and Employment' },
    { id: '294', name: 'Construction' },
    { id: '52', name: 'Insurance' },
    { id: '57', name: 'Litigation' },

    // Tier 2: Family/Criminal/Estate
    { id: '48', name: 'Family Law/Domestic Relations' },
    { id: '42', name: 'Criminal' },
    { id: '63', name: 'Estate Planning, Trust and Probate' },
    { id: '67', name: 'Real Property' },
    { id: '45', name: 'Elder and Social Security' },
    { id: '36', name: 'Civil Rights' },
    { id: '72', name: 'Taxation' },
    { id: '50', name: 'Health Care' },

    // Tier 3: Remaining practice areas
    { id: '29', name: 'Administrative and Regulatory' },
    { id: '30', name: 'Admiralty' },
    { id: '31', name: 'Agricultural' },
    { id: '1002', name: 'Animal' },
    { id: '32', name: 'Antitrust' },
    { id: '1003', name: 'Appellate/Constitutional' },
    { id: '33', name: 'Aviation and Transportation' },
    { id: '1004', name: 'Banking and Commercial' },
    { id: '39', name: 'Communication and Media' },
    { id: '1005', name: 'Consumer' },
    { id: '41', name: 'Corporate/Business' },
    { id: '43', name: 'Disability' },
    { id: '44', name: 'Dispute Resolution' },
    { id: '68', name: 'Education' },
    { id: '1006', name: 'Elections and Campaign Finance' },
    { id: '46', name: 'Energy' },
    { id: '47', name: 'Environmental and Natural Resources' },
    { id: '1007', name: 'Gaming and Liquor' },
    { id: '61', name: 'Intellectual Property' },
    { id: '53', name: 'International' },
    { id: '54', name: 'Juvenile' },
    { id: '1011', name: 'Military and Veterans Affairs' },
    { id: '60', name: 'Other' },
    { id: '1012', name: 'Professional Responsibility' },
    { id: '65', name: 'Public Utilities' },
    { id: '58', name: 'Public and Public Finance' },
    { id: '1009', name: 'Risk Management and Compliance' },
    { id: '71', name: 'Sports/Entertainment' },
    { id: '40', name: 'Technology' },
    { id: '1010', name: 'Traffic/OVI' }
];

// ============================================================================
// OHIO CITIES (by population descending - all cities with 10,000+ population)
// ============================================================================

const OHIO_CITIES = [
    // Top 50 by population
    'Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron',
    'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain',
    'Hamilton', 'Springfield', 'Kettering', 'Elyria', 'Lakewood',
    'Cuyahoga Falls', 'Middletown', 'Newark', 'Mentor', 'Beavercreek',
    'Dublin', 'Strongsville', 'Fairfield', 'Grove City', 'Delaware',
    'Huber Heights', 'Lancaster', 'Reynoldsburg', 'Westerville', 'Upper Arlington',
    'Gahanna', 'Pickerington', 'North Canton', 'Massillon', 'Sandusky',
    'Findlay', 'Zanesville', 'Marion', 'Wooster', 'Ashland',
    'Painesville', 'Steubenville', 'Tiffin', 'Sidney', 'Kent',
    'Oxford', 'Defiance', 'Marysville', 'Fremont',
    // Additional cities with 10,000+ population (by population descending)
    'Euclid', 'Mansfield', 'Cleveland Heights', 'Hilliard', 'Warren',
    'North Ridgeville', 'Mason', 'Brunswick', 'Fairborn', 'Lima',
    'Westlake', 'Stow', 'North Olmsted', 'North Royalton', 'Bowling Green',
    'Garfield Heights', 'Shaker Heights', 'Green', 'Troy', 'Avon Lake',
    'Centerville', 'Xenia', 'Medina', 'Avon', 'Perrysburg',
    'Athens', 'Wadsworth', 'Barberton', 'Riverside', 'Willoughby',
    'Solon', 'Maple Heights', 'Trotwood', 'Hudson', 'Lebanon',
    'Chillicothe', 'Alliance', 'Rocky River', 'South Euclid', 'Piqua',
    'Parma Heights', 'Miamisburg', 'Forest Park', 'Whitehall', 'Mayfield Heights',
    'Broadview Heights', 'Oregon', 'Springboro', 'Twinsburg', 'Norwood',
    'Sylvania', 'Pataskala', 'Tallmadge', 'Niles', 'Brook Park',
    'Berea', 'Aurora', 'Streetsboro', 'Ashtabula', 'Portsmouth',
    'Eastlake', 'New Philadelphia', 'Mount Vernon', 'Norwalk', 'Fairview Park',
    'Monroe', 'Bay Village', 'Middleburg Heights', 'Vandalia', 'Worthington',
    'Powell', 'Washington Court House', 'Circleville', 'Willowick', 'Trenton',
    'Bellefontaine', 'Sharonville', 'Brecksville', 'New Franklin', 'Beachwood',
    'Lyndhurst', 'Maumee', 'Blue Ash', 'Harrison', 'Warrensville Heights',
    'East Cleveland', 'Clayton', 'Englewood', 'Loveland', 'University Heights',
    'Fostoria', 'Amherst', 'Marietta', 'Dover', 'West Carrollton',
    'Bedford', 'Bexley', 'Greenville', 'Wickliffe', 'Wilmington',
    'Conneaut', 'Macedonia', 'Franklin', 'Salem', 'New Albany',
    'Bucyrus', 'Seven Hills', 'Norton', 'Ravenna', 'Urbana',
    'Springdale', 'Van Wert', 'Coshocton', 'Brooklyn', 'Montgomery',
    'Celina', 'Heath', 'Bedford Heights'
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.ohiobar.org';
const DELAY_BETWEEN_LOADS = 2000;
const DELAY_BETWEEN_SEARCHES = 3000;
const MAX_COMBOS = parseInt(process.env.MAX_COMBOS) || 5; // Practice area + city combos per run
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESULTS_CAP = 100; // Ohio Bar's limit per search

// Determine which alphabet tab contains a practice area (by first letter of name)
function getPracticeAreaTab(practiceAreaName) {
    const firstLetter = practiceAreaName.charAt(0).toUpperCase();
    if ('ABCD'.includes(firstLetter)) return 'A-D';
    if ('EFGHIJK'.includes(firstLetter)) return 'E-K';
    if ('LMNOPQR'.includes(firstLetter)) return 'L-R';
    return 'S-Z';
}

// Determine which alphabet tab contains a city (by first letter)
function getCityTab(cityName) {
    const firstLetter = cityName.charAt(0).toUpperCase();
    if ('ABCD'.includes(firstLetter)) return 'A-D';
    if ('EFGHIJK'.includes(firstLetter)) return 'E-K';
    if ('LMNOPQR'.includes(firstLetter)) return 'L-R';
    return 'S-Z';
}

// Click the nth occurrence of an alphabet tab button (1=first/cities, 2=second/practice areas)
async function clickAlphabetTab(page, tabText, occurrence) {
    await page.evaluate((tabText, occurrence) => {
        const buttons = document.querySelectorAll('button');
        let found = 0;
        for (const btn of buttons) {
            if (btn.textContent.trim() === tabText) {
                found++;
                if (found === occurrence) {
                    btn.click();
                    break;
                }
            }
        }
    }, tabText, occurrence);
    await sleep(1500);
}

// Click a practice area checkbox by name
async function clickPracticeAreaCheckbox(page, practiceAreaName) {
    const clicked = await page.evaluate((name) => {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of cbs) {
            if (cb.id && cb.id.includes('PracticeAreas') && cb.id.includes(name)) {
                cb.click();
                return true;
            }
        }
        return false;
    }, practiceAreaName);
    await sleep(500);
    return clicked;
}

// Click a city/location checkbox by name
async function clickCityCheckbox(page, cityName) {
    const clicked = await page.evaluate((name) => {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of cbs) {
            if (cb.id && cb.id.includes('Locations') && cb.value === name) {
                cb.click();
                return true;
            }
        }
        return false;
    }, cityName);
    await sleep(500);
    return clicked;
}

// Clear all filters by clicking "Clear All" buttons
async function clearAllFilters(page) {
    await page.evaluate(() => {
        // Find and click all "Clear All" buttons
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent.includes('Clear All')) {
                btn.click();
            }
        }
    });
    await sleep(2000);
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;
let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service account key not found at ${serviceAccountPath}`);
        }
        serviceAccount = require(serviceAccountPath);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    db.settings({ databaseId: 'preintake' });
    firebaseInitialized = true;
    console.log('Firebase initialized (preintake database)');
}

// ============================================================================
// EMAIL NOTIFICATION
// ============================================================================

async function sendNotificationEmail(subject, htmlContent) {
    const smtpUser = process.env.PREINTAKE_SMTP_USER;
    const smtpPass = process.env.PREINTAKE_SMTP_PASS;

    if (!smtpUser || !smtpPass) {
        console.log('SMTP credentials not configured, skipping email notification');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: 'Stephen Scott <stephen@preintake.ai>',
            to: 'Stephen Scott <scscot@gmail.com>',
            subject,
            html: htmlContent
        });
        console.log(`Email notification sent: ${subject}`);
    } catch (error) {
        console.error('Failed to send notification email:', error.message);
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs) {
    const jitter = baseMs * 0.3 * (Math.random() * 2 - 1);
    return sleep(Math.max(1000, baseMs + jitter));
}

function parseName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };

    const cleaned = fullName
        .replace(/,?\s*(Esq\.?|P\.?A\.?|J\.?D\.?|LL\.?M\.?|Ph\.?D\.?|Jr\.?|Sr\.?|III?|IV)$/gi, '')
        .trim();

    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };

    return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    const progressRef = db.collection('preintake_scrape_progress').doc('ohbar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            completedPracticeAreaIds: [],        // Practice area IDs with < 100 results (fully scraped)
            practiceAreaIdsNeedingCities: [],    // Practice area IDs that hit 100, need city subdivision
            completedCityCombos: {},             // { 'practiceAreaId': ['City1', 'City2'] }
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        completedPracticeAreaIds: data.completedPracticeAreaIds || [],
        practiceAreaIdsNeedingCities: data.practiceAreaIdsNeedingCities || [],
        completedCityCombos: data.completedCityCombos || {},
        totalInserted: data.totalInserted || 0,
        lastRunDate: data.lastRunDate || null
    };
}

async function saveProgress(progress) {
    const progressRef = db.collection('preintake_scrape_progress').doc('ohbar');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

function getNextTarget(progress) {
    // First, check for practice areas that need city subdivision
    for (const paId of progress.practiceAreaIdsNeedingCities) {
        const completedCities = progress.completedCityCombos[paId] || [];
        for (const city of OHIO_CITIES) {
            if (!completedCities.includes(city)) {
                const pa = PRACTICE_AREAS.find(p => p.id === paId);
                if (pa) {
                    return { practiceAreaId: pa.id, practiceAreaName: pa.name, city };
                }
            }
        }
        // All cities done for this practice area - shouldn't happen, but handle it
    }

    // Then, check for practice areas not yet attempted
    for (const pa of PRACTICE_AREAS) {
        if (!progress.completedPracticeAreaIds.includes(pa.id) &&
            !progress.practiceAreaIdsNeedingCities.includes(pa.id)) {
            return { practiceAreaId: pa.id, practiceAreaName: pa.name, city: null };
        }
    }

    return null; // All done!
}

async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'ohbar')
        .count()
        .get();
    return snapshot.data().count;
}

/**
 * Load existing OhBar member IDs for efficient skip-before-fetch
 */
async function loadExistingMemberIds() {
    const memberIds = new Set();
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'ohbar')
        .select('memberId')
        .get();
    snapshot.forEach(doc => {
        const id = doc.data().memberId;
        if (id) memberIds.add(id.toString());
    });
    return memberIds;
}

// ============================================================================
// PUPPETEER SCRAPING FUNCTIONS
// ============================================================================

async function extractAttorneysFromPage(page) {
    return await page.evaluate(() => {
        const attorneys = [];
        const cards = document.querySelectorAll('[class*="ResultCardWrapper"], [class*="ResultsWrapper"]');

        cards.forEach(card => {
            try {
                const nameEl = card.querySelector('[class*="Name-"]');
                const fullName = nameEl?.textContent?.trim();
                if (!fullName || fullName.length < 2 || fullName.length > 100) return;

                const cardText = card.innerText || '';
                const licensedMatch = cardText.match(/Licensed In:\s*([A-Z, ]+)/);
                const licensedIn = licensedMatch ? licensedMatch[1].trim() : '';

                const paMatch = cardText.match(/Practice Areas?:\s*([^\n]+)/);
                const practiceAreas = paMatch ? paMatch[1].trim() : '';

                const contactLink = Array.from(card.querySelectorAll('a')).find(a =>
                    a.href?.startsWith('mailto:')
                );
                const email = contactLink?.href?.replace('mailto:', '').toLowerCase().trim();

                const profileLink = Array.from(card.querySelectorAll('a')).find(a =>
                    a.href?.includes('member-directory-detail-page')
                );
                const profileUrl = profileLink?.href || '';
                const idMatch = profileUrl.match(/id=([^&]+)/);
                const memberId = idMatch ? idMatch[1] : '';

                if (email && email.includes('@') && email.includes('.')) {
                    if (!attorneys.find(a => a.email === email)) {
                        attorneys.push({ fullName, email, practiceAreas, licensedIn, profileUrl, memberId });
                    }
                }
            } catch (error) { /* skip malformed */ }
        });

        return attorneys;
    });
}

async function loadMoreResults(page) {
    try {
        const loadMoreBtn = await page.$('#findALawyerResultsLoadMore');
        if (!loadMoreBtn) return false;

        const countBefore = await page.evaluate(() =>
            document.querySelectorAll('[class*="ResultCardWrapper"]').length
        );

        await loadMoreBtn.click();
        await sleep(DELAY_BETWEEN_LOADS);

        const countAfter = await page.evaluate(() =>
            document.querySelectorAll('[class*="ResultCardWrapper"]').length
        );

        return countAfter > countBefore;
    } catch (error) {
        return false;
    }
}

async function waitForResults(page, timeout = 30000) {
    try {
        await page.waitForSelector('[class*="ResultCardWrapper"]', { timeout });
        await sleep(2000);
        return true;
    } catch (error) {
        return false;
    }
}

async function getResultsCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Results?\s*\((\d+)\)/i);
        return match ? parseInt(match[1]) : 0;
    });
}

// Note: Filter selection functions removed - using URL-based API filtering instead

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapeTarget(browser, target, existingEmails, existingMemberIds) {
    const { practiceAreaId, practiceAreaName, city } = target;
    const targetLabel = city ? `${practiceAreaName} + ${city}` : practiceAreaName;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${targetLabel}`);
    console.log('='.repeat(60));

    const stats = {
        target: targetLabel,
        practiceAreaId,
        practiceAreaName,
        city,
        cards_loaded: 0,
        attorneys_with_email: 0,
        inserted: 0,
        skippedExisting: 0,
        errors: 0,
        hit_cap: false
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    try {
        // Navigate to base page
        console.log('   Loading base page...');
        await page.goto(`${BASE_URL}/public-resources/find-a-lawyer/`, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(3000);

        // Wait for initial results to load
        const hasResults = await waitForResults(page, 15000);
        if (!hasResults) {
            console.log('   No results found on base page');
            return stats;
        }

        // Click the correct alphabet tab for practice area (2nd occurrence = Practice Areas section)
        const paTab = getPracticeAreaTab(practiceAreaName);
        console.log(`   Clicking ${paTab} tab (Practice Areas)...`);
        await clickAlphabetTab(page, paTab, 2);

        // Click the practice area checkbox
        console.log(`   Selecting practice area: ${practiceAreaName}...`);
        const paClicked = await clickPracticeAreaCheckbox(page, practiceAreaName);
        if (!paClicked) {
            console.log(`   ⚠ Could not find checkbox for ${practiceAreaName}`);
            return stats;
        }
        await sleep(3000); // Wait for filter to apply

        // If city filter is specified, click it too
        if (city) {
            const cityTab = getCityTab(city);
            console.log(`   Clicking ${cityTab} tab (Cities)...`);
            await clickAlphabetTab(page, cityTab, 1); // 1st occurrence = Cities section

            console.log(`   Selecting city: ${city}...`);
            const cityClicked = await clickCityCheckbox(page, city);
            if (!cityClicked) {
                console.log(`   ⚠ Could not find checkbox for city ${city}`);
            }
            await sleep(3000);
        }

        // Get total results count
        const totalResults = await getResultsCount(page);
        console.log(`   Total results: ${totalResults}`);

        if (totalResults >= RESULTS_CAP) {
            stats.hit_cap = true;
            console.log(`   ⚠ Hit ${RESULTS_CAP} cap - will need city subdivision`);
        }

        // Load all results via Load More
        let loadMoreCount = 0;
        while (true) {
            const moreLoaded = await loadMoreResults(page);
            if (!moreLoaded) break;
            loadMoreCount++;
            if (loadMoreCount % 5 === 0) {
                const currentCards = await page.evaluate(() =>
                    document.querySelectorAll('[class*="ResultCardWrapper"]').length
                );
                console.log(`   Loaded ${currentCards} cards...`);
            }
        }

        // Extract attorneys
        const attorneys = await extractAttorneysFromPage(page);
        stats.cards_loaded = await page.evaluate(() =>
            document.querySelectorAll('[class*="ResultCardWrapper"]').length
        );
        stats.attorneys_with_email = attorneys.length;

        console.log(`   Cards: ${stats.cards_loaded}, With email: ${stats.attorneys_with_email}`);

        // Process attorneys
        for (const attorney of attorneys) {
            // Skip if memberId already exists (efficient skip-before-fetch)
            if (attorney.memberId && existingMemberIds.has(attorney.memberId.toString())) {
                stats.skippedExisting++;
                continue;
            }

            const emailLower = cleanEmail(attorney.email);
            if (!emailLower) {
                stats.errors++;
                continue;
            }

            if (existingEmails.has(emailLower)) {
                stats.skippedExisting++;
                continue;
            }

            const { firstName, lastName } = parseName(attorney.fullName);
            if (!firstName || !lastName) {
                stats.errors++;
                continue;
            }

            const primaryPA = attorney.practiceAreas?.split(',')[0]?.trim() || practiceAreaName;

            // For OhBar, state is always OH, but add defensive logic in case
            // the data has an empty state - try to infer from website
            let state = 'OH';
            const website = ''; // OhBar doesn't provide website in search results
            if (!state || state === '') {
                if (website) {
                    const inferredState = await inferStateFromWebsite(website);
                    if (inferredState) {
                        state = inferredState;
                    } else {
                        // Cannot infer state, skip this contact
                        stats.errors++;
                        continue;
                    }
                } else {
                    // No website to infer from and no state, skip this contact
                    stats.errors++;
                    continue;
                }
            }

            const docData = {
                firstName,
                lastName,
                firmName: '',
                email: emailLower,
                website,
                practiceArea: primaryPA,
                practiceAreas: attorney.practiceAreas || '',
                city: city || '',
                state,
                source: 'ohbar',
                barNumber: '',
                memberUrl: attorney.profileUrl || '',
                memberId: attorney.memberId || '',
                phone: '',
                sent: false,
                status: 'pending',
                randomIndex: Math.random() * 0.1,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                // Set domainChecked: false for contacts without websites so infer-websites.js can process them
                ...(website === '' ? { domainChecked: false } : {})
            };

            // Check for government/institutional contact
            if (isGovernmentContact(docData.email, docData.firmName)) {
                stats.govt_skipped = (stats.govt_skipped || 0) + 1;
                continue;
            }

            if (!DRY_RUN) {
                const docRef = db.collection('preintake_emails').doc();
                batch.set(docRef, docData);
                batchCount++;
            }

            existingEmails.add(emailLower);
            stats.inserted++;

            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`   ✓ Committed batch of ${batchCount}`);
                batch = db.batch();
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`   ✓ Committed final batch of ${batchCount}`);
        }

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped existing ${stats.skippedExisting}`);

    } catch (error) {
        console.error(`   Error: ${error.message}`);
        stats.errors++;
    } finally {
        await page.close();
    }

    return stats;
}

// ============================================================================
// EMAIL REPORT
// ============================================================================

function generateEmailHTML(summary) {
    const targetsHtml = summary.targets.map(t => `
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${t.target}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.cards_loaded}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.attorneys_with_email}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${t.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.hit_cap ? '⚠️' : '✓'}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Ohio Bar Scrape Report</h1>
    </div>
    <div style="background: #fff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px;">${new Date().toLocaleString()}</p>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Targets Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Target</th>
                <th style="padding: 8px; text-align: center;">Cards</th>
                <th style="padding: 8px; text-align: center;">W/Email</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">Status</th>
            </tr>
            ${targetsHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">Ohio Bar attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;">Practice areas completed:</td><td style="text-align: right;">${summary.progress.completedPracticeAreaIds.length} / ${PRACTICE_AREAS.length}</td></tr>
            <tr><td style="padding: 8px 0;">Areas needing city subdivision:</td><td style="text-align: right;">${summary.progress.practiceAreaIdsNeedingCities.length}</td></tr>
            <tr><td style="padding: 8px 0;">Duration:</td><td style="text-align: right;">${summary.duration}</td></tr>
        </table>

        ${summary.dry_run ? '<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;"><p style="margin: 0; font-weight: 600; color: #92400e;">DRY RUN - No data written</p></div>' : ''}
    </div>
</body>
</html>`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('Ohio Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Strategy: Practice Area + City filtering for comprehensive coverage\n');

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    // Load progress
    const progress = await getProgress();
    console.log(`Progress: ${progress.completedPracticeAreaIds.length}/${PRACTICE_AREAS.length} practice areas complete`);
    console.log(`Areas needing city subdivision: ${progress.practiceAreaIdsNeedingCities.length}`);
    console.log(`Total inserted so far: ${progress.totalInserted.toLocaleString()}\n`);

    // Load existing emails for deduplication
    console.log('Loading existing emails...');
    const existingEmails = new Set();
    const existingSnapshot = await db.collection('preintake_emails').select('email').get();
    existingSnapshot.forEach(doc => {
        const email = doc.data().email?.toLowerCase();
        if (email) existingEmails.add(email);
    });
    console.log(`Loaded ${existingEmails.size} existing emails`);

    // Load existing member IDs for efficient skip-before-fetch
    console.log('Loading existing OhBar member IDs...');
    const existingMemberIds = await loadExistingMemberIds();
    console.log(`Loaded ${existingMemberIds.size} existing member IDs\n`);

    const startTime = Date.now();

    // Launch browser
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const allStats = [];
    let totalInsertedThisRun = 0;

    try {
        // Process up to MAX_COMBOS targets
        for (let i = 0; i < MAX_COMBOS; i++) {
            const target = getNextTarget(progress);

            if (!target) {
                console.log('\n✓ All practice areas and city combinations complete!');
                break;
            }

            const stats = await scrapeTarget(browser, target, existingEmails, existingMemberIds);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Update progress based on results
            if (stats.city) {
                // City-level scrape completed
                if (!progress.completedCityCombos[stats.practiceAreaId]) {
                    progress.completedCityCombos[stats.practiceAreaId] = [];
                }
                progress.completedCityCombos[stats.practiceAreaId].push(stats.city);

                // Check if all cities done for this practice area
                if (progress.completedCityCombos[stats.practiceAreaId].length >= OHIO_CITIES.length) {
                    // Move from needingCities to completed
                    progress.practiceAreaIdsNeedingCities = progress.practiceAreaIdsNeedingCities.filter(
                        id => id !== stats.practiceAreaId
                    );
                    progress.completedPracticeAreaIds.push(stats.practiceAreaId);
                    console.log(`   ✓ All cities complete for ${stats.practiceAreaName}`);
                }
            } else {
                // Practice area level scrape
                if (stats.hit_cap) {
                    // Needs city subdivision
                    if (!progress.practiceAreaIdsNeedingCities.includes(stats.practiceAreaId)) {
                        progress.practiceAreaIdsNeedingCities.push(stats.practiceAreaId);
                    }
                } else {
                    // Complete (under 100 results)
                    if (!progress.completedPracticeAreaIds.includes(stats.practiceAreaId)) {
                        progress.completedPracticeAreaIds.push(stats.practiceAreaId);
                    }
                }
            }

            // Delay between targets
            if (i < MAX_COMBOS - 1) {
                await sleepWithJitter(3000);
            }
        }

        // Save progress
        progress.totalInserted = (progress.totalInserted || 0) + totalInsertedThisRun;
        progress.lastRunDate = new Date().toISOString();

        if (!DRY_RUN) {
            await saveProgress(progress);
        }

        // Summary
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Targets scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total Ohio Bar in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Practice areas complete: ${progress.completedPracticeAreaIds.length}/${PRACTICE_AREAS.length}`);
        console.log(`   Areas needing city subdivision: ${progress.practiceAreaIdsNeedingCities.length}`);
        console.log(`   Duration: ${duration} minutes`);

        // Save summary
        const summary = {
            run_date: new Date().toISOString(),
            targets: allStats,
            totalInserted: totalInsertedThisRun,
            totalInDb,
            progress,
            duration: `${duration} minutes`,
            dry_run: DRY_RUN
        };

        fs.writeFileSync(
            path.join(__dirname, 'ohbar-scrape-summary.json'),
            JSON.stringify(summary, null, 2)
        );

        // Send email
        await sendNotificationEmail(
            `Ohio Bar: ${totalInsertedThisRun} new attorneys (${progress.completedPracticeAreaIds.length}/${PRACTICE_AREAS.length} areas)`,
            generateEmailHTML(summary)
        );

        console.log('\n✓ Scrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'Ohio Bar Scrape FAILED',
            `<h2>Scrape Failed</h2><p>${error.message}</p><pre>${error.stack}</pre>`
        );
        process.exit(1);
    } finally {
        await browser.close();
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
