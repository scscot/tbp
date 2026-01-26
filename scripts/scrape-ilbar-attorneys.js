#!/usr/bin/env node
/**
 * Illinois Bar Attorney Scraper (Puppeteer + vCard API)
 *
 * Scrapes attorney contact information from the Illinois State Bar Association website
 * (isba.reliaguide.com) and imports into preintake_emails collection.
 *
 * Strategy:
 * 1. Navigate to search results with category filter (Puppeteer)
 * 2. Extract profile IDs from attorney cards
 * 3. Paginate through results (10-page server cap = 400 results max)
 * 4. If results exceed cap, subdivide by city for comprehensive coverage
 * 5. Fetch vCard API for each profile to get email/phone/firm
 * 6. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-ilbar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
 *   MAX_COMBOS - Maximum practice area + city combinations per run (default: 50)
 *   DRY_RUN - If "true", don't write to Firestore
 *   RESET_PROGRESS - If "true", reset scrape progress before starting
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { isGovernmentContact } = require('./gov-filter-utils');

// ============================================================================
// PRACTICE AREAS (from ISBA ReliaGuide category-lookups API)
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High-value PreIntake practice areas
    { id: '264', name: 'Personal Injury' },
    { id: '210', name: 'Immigration & Naturalization' },
    { id: '172', name: 'Family Law' },
    { id: '473', name: 'Criminal Law' },
    { id: '127', name: 'Criminal Defense' },
    { id: '3', name: 'Bankruptcy' },
    { id: '594', name: 'Workers Compensation' },
    { id: '454', name: 'Medical Malpractice' },
    { id: '359', name: 'Wrongful Death' },

    // Tier 2: Additional practice areas
    { id: '228', name: 'Labor & Employment' },
    { id: '285', name: 'Real Estate' },
    { id: '277', name: 'Probate & Estate Planning' },
    { id: '179', name: 'Elder Law & Advocacy' },
    { id: '321', name: 'Social Security' },
    { id: '120', name: 'Consumer Law' },
    { id: '96', name: 'Civil Rights' },

    // Tier 3: Business & Commercial
    { id: '74', name: 'Business Law' },
    { id: '326', name: 'Tax' },
    { id: '483', name: 'Civil Litigation' },
    { id: '215', name: 'Intellectual Property' },
    { id: '116', name: 'Construction Law' },
];

// ============================================================================
// ILLINOIS CITIES (by population descending - all cities with 10,000+ population)
// Used for subdivision when a practice area exceeds the 400-result pagination cap
// ============================================================================

const ILLINOIS_CITIES = [
    // Major cities
    'Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford',
    'Springfield', 'Elgin', 'Peoria', 'Champaign', 'Waukegan',
    'Cicero', 'Bloomington', 'Arlington Heights', 'Evanston', 'Schaumburg',
    'Decatur', 'Bolingbrook', 'Palatine', 'Skokie', 'Des Plaines',
    'Orland Park', 'Tinley Park', 'Oak Lawn', 'Berwyn', 'Mount Prospect',
    'Normal', 'Wheaton', 'Hoffman Estates', 'Oak Park', 'Downers Grove',
    'Elmhurst', 'Glenview', 'Lombard', 'DeKalb', 'Moline',
    'Belleville', 'Buffalo Grove', 'Bartlett', 'Urbana', 'Quincy',
    'Crystal Lake', 'Streamwood', 'Carol Stream', 'Romeoville', 'Plainfield',
    'Hanover Park', 'Carpentersville', 'Wheeling', 'Park Ridge', 'Addison',
    // Mid-size cities
    'Calumet City', 'Glendale Heights', 'Woodstock', 'Elk Grove Village', 'Oswego',
    'Lake in the Hills', 'Mundelein', 'Niles', "O'Fallon", 'Northbrook',
    'Algonquin', 'Gurnee', 'Highland Park', 'McHenry', 'Lake Zurich',
    'Batavia', 'Glen Ellyn', 'Lisle', 'South Elgin', 'Libertyville',
    'Vernon Hills', 'Crest Hill', 'Woodridge', 'Mattoon', 'Marion',
    'Carbondale', 'Edwardsville', 'Collinsville', 'Danville', 'Granite City',
    'Rock Island', 'Galesburg', 'Kankakee', 'Freeport', 'East Peoria',
    'Jacksonville', 'Effingham', 'Charleston', 'Ottawa', 'Peru',
    'Sterling', 'Macomb', 'Pontiac', 'Dixon', 'Streator',
    // Affluent suburbs (high attorney concentration)
    'Lake Forest', 'Wilmette', 'Winnetka', 'La Grange', 'Hinsdale',
    'Western Springs', 'Geneva', 'St. Charles', 'North Aurora', 'West Chicago',
    'Warrenville', 'Lockport', 'Mokena', 'Frankfort', 'New Lenox',
    'Homer Glen', 'Lemont', 'Burr Ridge', 'Willowbrook', 'Westmont',
    'Darien', 'Clarendon Hills', 'Oak Brook', 'Westchester', 'Riverside',
    'Brookfield', 'La Grange Park', 'North Riverside', 'Melrose Park', 'Maywood',
    'Bellwood', 'Forest Park', 'River Forest', 'Bensenville', 'Wood Dale',
    'Roselle', 'Itasca', 'Bloomingdale', 'Hanover Park', 'Barrington',
    'Inverness', 'Lincolnshire', 'Deerfield', 'Bannockburn', 'Kenilworth',
    'Glencoe', 'Northfield', 'Winfield', 'Wheaton', 'Naperville',
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://isba.reliaguide.com';
const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_VCARDS = 500;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const MAX_COMBOS = parseInt(process.env.MAX_COMBOS) || 50;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESET_PROGRESS = process.env.RESET_PROGRESS === 'true';
const RESULTS_PER_PAGE = 40;
const RESULTS_CAP = 400; // ReliaGuide pagination cap (10 pages × 40 per page)

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
    return sleep(Math.max(500, baseMs + jitter));
}

// ============================================================================
// STATE INFERENCE FROM WEBSITE
// ============================================================================

const STATE_PATTERNS = [
    { pattern: /\bAlabama\b|\b,\s*AL\b|\bBirmingham,?\s*AL/i, state: 'AL' },
    { pattern: /\bAlaska\b|\b,\s*AK\b|\bAnchorage,?\s*AK/i, state: 'AK' },
    { pattern: /\bArizona\b|\b,\s*AZ\b|\bPhoenix,?\s*AZ/i, state: 'AZ' },
    { pattern: /\bArkansas\b|\b,\s*AR\b|\bLittle Rock,?\s*AR/i, state: 'AR' },
    { pattern: /\bCalifornia\b|\b,\s*CA\b|\bLos Angeles,?\s*CA|\bSan Francisco,?\s*CA|\bSan Diego,?\s*CA/i, state: 'CA' },
    { pattern: /\bColorado\b|\b,\s*CO\b|\bDenver,?\s*CO/i, state: 'CO' },
    { pattern: /\bConnecticut\b|\b,\s*CT\b|\bHartford,?\s*CT/i, state: 'CT' },
    { pattern: /\bDelaware\b|\b,\s*DE\b|\bWilmington,?\s*DE/i, state: 'DE' },
    { pattern: /\bFlorida\b|\b,\s*FL\b|\bMiami,?\s*FL|\bTampa,?\s*FL|\bOrlando,?\s*FL/i, state: 'FL' },
    { pattern: /\bGeorgia\b|\b,\s*GA\b|\bAtlanta,?\s*GA/i, state: 'GA' },
    { pattern: /\bHawaii\b|\b,\s*HI\b|\bHonolulu,?\s*HI/i, state: 'HI' },
    { pattern: /\bIdaho\b|\b,\s*ID\b|\bBoise,?\s*ID/i, state: 'ID' },
    { pattern: /\bIllinois\b|\b,\s*IL\b|\bChicago,?\s*IL/i, state: 'IL' },
    { pattern: /\bIndiana\b|\b,\s*IN\b|\bIndianapolis,?\s*IN/i, state: 'IN' },
    { pattern: /\bIowa\b|\b,\s*IA\b|\bDes Moines,?\s*IA/i, state: 'IA' },
    { pattern: /\bKansas\b|\b,\s*KS\b|\bWichita,?\s*KS/i, state: 'KS' },
    { pattern: /\bKentucky\b|\b,\s*KY\b|\bLouisville,?\s*KY/i, state: 'KY' },
    { pattern: /\bLouisiana\b|\b,\s*LA\b|\bNew Orleans,?\s*LA/i, state: 'LA' },
    { pattern: /\bMaine\b|\b,\s*ME\b|\bPortland,?\s*ME/i, state: 'ME' },
    { pattern: /\bMaryland\b|\b,\s*MD\b|\bBaltimore,?\s*MD/i, state: 'MD' },
    { pattern: /\bMassachusetts\b|\b,\s*MA\b|\bBoston,?\s*MA/i, state: 'MA' },
    { pattern: /\bMichigan\b|\b,\s*MI\b|\bDetroit,?\s*MI|\bGrand Rapids,?\s*MI/i, state: 'MI' },
    { pattern: /\bMinnesota\b|\b,\s*MN\b|\bMinneapolis,?\s*MN/i, state: 'MN' },
    { pattern: /\bMississippi\b|\b,\s*MS\b|\bJackson,?\s*MS/i, state: 'MS' },
    { pattern: /\bMissouri\b|\b,\s*MO\b|\bSt\.?\s*Louis,?\s*MO|\bKansas City,?\s*MO/i, state: 'MO' },
    { pattern: /\bMontana\b|\b,\s*MT\b|\bBillings,?\s*MT/i, state: 'MT' },
    { pattern: /\bNebraska\b|\b,\s*NE\b|\bOmaha,?\s*NE/i, state: 'NE' },
    { pattern: /\bNevada\b|\b,\s*NV\b|\bLas Vegas,?\s*NV/i, state: 'NV' },
    { pattern: /\bNew Hampshire\b|\b,\s*NH\b|\bManchester,?\s*NH/i, state: 'NH' },
    { pattern: /\bNew Jersey\b|\b,\s*NJ\b|\bNewark,?\s*NJ/i, state: 'NJ' },
    { pattern: /\bNew Mexico\b|\b,\s*NM\b|\bAlbuquerque,?\s*NM/i, state: 'NM' },
    { pattern: /\bNew York\b|\b,\s*NY\b|\bNew York City,?\s*NY|\bBrooklyn,?\s*NY|\bManhattan/i, state: 'NY' },
    { pattern: /\bNorth Carolina\b|\b,\s*NC\b|\bCharlotte,?\s*NC/i, state: 'NC' },
    { pattern: /\bNorth Dakota\b|\b,\s*ND\b|\bFargo,?\s*ND/i, state: 'ND' },
    { pattern: /\bOhio\b|\b,\s*OH\b|\bColumbus,?\s*OH|\bCleveland,?\s*OH/i, state: 'OH' },
    { pattern: /\bOklahoma\b|\b,\s*OK\b|\bOklahoma City,?\s*OK/i, state: 'OK' },
    { pattern: /\bOregon\b|\b,\s*OR\b|\bPortland,?\s*OR/i, state: 'OR' },
    { pattern: /\bPennsylvania\b|\b,\s*PA\b|\bPhiladelphia,?\s*PA|\bPittsburgh,?\s*PA/i, state: 'PA' },
    { pattern: /\bRhode Island\b|\b,\s*RI\b|\bProvidence,?\s*RI/i, state: 'RI' },
    { pattern: /\bSouth Carolina\b|\b,\s*SC\b|\bCharleston,?\s*SC/i, state: 'SC' },
    { pattern: /\bSouth Dakota\b|\b,\s*SD\b|\bSioux Falls,?\s*SD/i, state: 'SD' },
    { pattern: /\bTennessee\b|\b,\s*TN\b|\bNashville,?\s*TN|\bMemphis,?\s*TN/i, state: 'TN' },
    { pattern: /\bTexas\b|\b,\s*TX\b|\bHouston,?\s*TX|\bDallas,?\s*TX|\bAustin,?\s*TX/i, state: 'TX' },
    { pattern: /\bUtah\b|\b,\s*UT\b|\bSalt Lake City,?\s*UT/i, state: 'UT' },
    { pattern: /\bVermont\b|\b,\s*VT\b|\bBurlington,?\s*VT/i, state: 'VT' },
    { pattern: /\bVirginia\b|\b,\s*VA\b|\bRichmond,?\s*VA|\bVirginia Beach,?\s*VA/i, state: 'VA' },
    { pattern: /\bWashington\b|\b,\s*WA\b|\bSeattle,?\s*WA|\bTacoma,?\s*WA/i, state: 'WA' },
    { pattern: /\bWest Virginia\b|\b,\s*WV\b|\bCharleston,?\s*WV/i, state: 'WV' },
    { pattern: /\bWisconsin\b|\b,\s*WI\b|\bMilwaukee,?\s*WI|\bMadison,?\s*WI/i, state: 'WI' },
    { pattern: /\bWyoming\b|\b,\s*WY\b|\bCheyenne,?\s*WY/i, state: 'WY' },
    { pattern: /\bDistrict of Columbia\b|\b,\s*DC\b|\bWashington,?\s*DC/i, state: 'DC' }
];

/**
 * Attempt to infer state from a website URL by fetching and analyzing its content
 */
async function inferStateFromWebsite(websiteUrl) {
    if (!websiteUrl) return null;

    try {
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
        const textContent = html.substring(0, 50000);

        for (const { pattern, state } of STATE_PATTERNS) {
            if (pattern.test(textContent)) {
                return state;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Fetch vCard data for a profile ID
 */
async function fetchVCard(profileId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'isba.reliaguide.com',
            path: `/api/public/profiles/${profileId}/download-vcard`,
            method: 'GET',
            timeout: 10000,
            headers: {
                'Accept': 'text/vcard, text/x-vcard, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://isba.reliaguide.com/lawyer/search'
            }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Parse vCard data into structured object
 */
function parseVCard(vcardText) {
    const result = {
        firstName: '',
        lastName: '',
        fullName: '',
        email: '',
        phone: '',
        firmName: '',
        website: '',
        city: '',
        state: '',
        zip: ''
    };

    const lines = vcardText.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('N:')) {
            const parts = trimmed.substring(2).split(';');
            result.lastName = parts[0] || '';
            result.firstName = parts[1] || '';
        }

        if (trimmed.startsWith('FN:')) {
            result.fullName = trimmed.substring(3);
        }

        if (trimmed.includes('EMAIL') && trimmed.includes(':')) {
            const emailPart = trimmed.split(':').pop();
            if (emailPart && emailPart.includes('@')) {
                result.email = emailPart.toLowerCase().trim();
            }
        }

        if (trimmed.includes('TEL') && trimmed.includes('voice')) {
            const phonePart = trimmed.split(':').pop();
            if (phonePart && !result.phone) {
                result.phone = phonePart.trim();
            }
        }

        if (trimmed.startsWith('ORG:')) {
            result.firmName = trimmed.substring(4).replace(/\\,/g, ',').trim();
        }

        if (trimmed.includes('URL') && trimmed.includes('TYPE=work') && !trimmed.includes('reliaguide')) {
            const urlPart = trimmed.split(':').slice(1).join(':');
            if (urlPart && urlPart.startsWith('http')) {
                result.website = urlPart.trim();
            }
        }

        if (trimmed.includes('ADR') && trimmed.includes('TYPE=work')) {
            const adrPart = trimmed.split(':').pop();
            if (adrPart) {
                const parts = adrPart.split(';');
                if (parts.length >= 6) {
                    result.city = parts[3] || '';
                    result.state = parts[4] || '';
                    result.zip = parts[5] || '';
                }
            }
        }
    }

    return result;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    if (RESET_PROGRESS) {
        console.log('*** RESET_PROGRESS enabled - clearing all progress ***');
        const progressRef = db.collection('preintake_scrape_progress').doc('ilbar');
        await progressRef.delete();
        return {
            completedCategoryIds: [],
            practiceAreaIdsNeedingCities: [],
            completedCityCombos: {},
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const progressRef = db.collection('preintake_scrape_progress').doc('ilbar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            completedCategoryIds: [],
            practiceAreaIdsNeedingCities: [],
            completedCityCombos: {},
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        completedCategoryIds: data.completedCategoryIds || [],
        practiceAreaIdsNeedingCities: data.practiceAreaIdsNeedingCities || [],
        completedCityCombos: data.completedCityCombos || {},
        totalInserted: data.totalInserted || 0,
        lastRunDate: data.lastRunDate || null
    };
}

async function saveProgress(progress) {
    const progressRef = db.collection('preintake_scrape_progress').doc('ilbar');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Get the next scrape target: either a practice area needing city subdivision,
 * or a practice area not yet attempted.
 */
function getNextTarget(progress) {
    // First, process practice areas that need city subdivision
    for (const paId of progress.practiceAreaIdsNeedingCities) {
        const completedCities = progress.completedCityCombos[paId] || [];
        for (const city of ILLINOIS_CITIES) {
            if (!completedCities.includes(city)) {
                const pa = PRACTICE_AREAS.find(p => p.id === paId);
                if (pa) {
                    return { practiceAreaId: pa.id, practiceAreaName: pa.name, city };
                }
            }
        }
        // All cities done for this practice area - will be cleaned up in main loop
    }

    // Then, process practice areas not yet attempted
    for (const pa of PRACTICE_AREAS) {
        if (!progress.completedCategoryIds.includes(pa.id) &&
            !progress.practiceAreaIdsNeedingCities.includes(pa.id)) {
            return { practiceAreaId: pa.id, practiceAreaName: pa.name, city: null };
        }
    }

    return null; // All done!
}

async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'ilbar')
        .count()
        .get();
    return snapshot.data().count;
}

/**
 * Load existing IlBar profile IDs for efficient skip-before-fetch
 */
async function loadExistingProfileIds() {
    const profileIds = new Set();
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'ilbar')
        .select('profileId')
        .get();
    snapshot.forEach(doc => {
        const id = doc.data().profileId;
        if (id) profileIds.add(id.toString());
    });
    return profileIds;
}

// ============================================================================
// PUPPETEER SCRAPING FUNCTIONS
// ============================================================================

async function extractProfileIds(page) {
    return await page.evaluate(() => {
        const ids = [];

        const vcardLinks = document.querySelectorAll('a[href*="/api/public/profiles/"][href*="/download-vcard"]');
        vcardLinks.forEach(link => {
            const match = link.href.match(/profiles\/(\d+)\/download-vcard/);
            if (match) {
                ids.push(match[1]);
            }
        });

        const profileLinks = document.querySelectorAll('a[href*="/lawyer/"]');
        profileLinks.forEach(link => {
            const match = link.href.match(/lawyer\/\d+-IL-\w+-\w+-(\d+)/);
            if (match && !ids.includes(match[1])) {
                ids.push(match[1]);
            }
        });

        return [...new Set(ids)];
    });
}

async function getResultsCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Listing\s+\d+\s+of\s+(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
}

async function goToNextPage(page, currentPage) {
    const nextPage = currentPage + 1;

    const clicked = await page.evaluate((pageNum) => {
        const items = document.querySelectorAll('.ant-pagination-item');
        for (const item of items) {
            if (item.textContent?.trim() === String(pageNum)) {
                item.click();
                return true;
            }
        }

        const nextBtn = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
        if (nextBtn) {
            nextBtn.click();
            return true;
        }

        return false;
    }, nextPage);

    if (clicked) {
        await sleep(DELAY_BETWEEN_PAGES);
    }

    return clicked;
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapeTarget(browser, target, existingEmails, existingProfileIds) {
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
        totalResults: 0,
        profilesFetched: 0,
        vcardsFetched: 0,
        inserted: 0,
        skipped: 0,
        skippedExisting: 0,
        errors: 0,
        govt_skipped: 0,
        hit_cap: false,
        all_profiles_scraped: false
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;
    const allProfileIds = [];

    try {
        // Build URL with optional city filter
        let url = `${BASE_URL}/lawyer/search?category.equals=${encodeURIComponent(practiceAreaName)}&categoryId.equals=${practiceAreaId}&memberTypeId.equals=1`;
        if (city) {
            url += `&city.contains=${encodeURIComponent(city)}`;
        }
        console.log(`   URL: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(5000);

        stats.totalResults = await getResultsCount(page);
        console.log(`   Total results: ${stats.totalResults}`);

        if (stats.totalResults === 0) {
            console.log('   No results found - marking as complete');
            stats.all_profiles_scraped = true;
            await page.close();
            return stats;
        }

        // Detect if results exceed pagination cap
        if (stats.totalResults > RESULTS_CAP) {
            stats.hit_cap = true;
            if (!city) {
                console.log(`   ⚠ Results (${stats.totalResults}) exceed cap (${RESULTS_CAP}) - will need city subdivision`);
            } else {
                console.log(`   ⚠ City combo still exceeds cap (${stats.totalResults}) - scraping first ${RESULTS_CAP}`);
            }
        }

        const totalPages = Math.min(
            Math.ceil(stats.totalResults / RESULTS_PER_PAGE),
            Math.ceil(RESULTS_CAP / RESULTS_PER_PAGE) // Cap at 10 pages
        );
        console.log(`   Pages to scrape: ${totalPages}`);

        let currentPage = 1;
        while (currentPage <= totalPages && allProfileIds.length < MAX_ATTORNEYS) {
            console.log(`   Page ${currentPage}/${totalPages}...`);

            const pageIds = await extractProfileIds(page);
            console.log(`     Found ${pageIds.length} profiles on page`);

            allProfileIds.push(...pageIds);
            stats.profilesFetched += pageIds.length;

            if (currentPage < totalPages && allProfileIds.length < MAX_ATTORNEYS) {
                const hasNext = await goToNextPage(page, currentPage);
                if (!hasNext) {
                    console.log('     No more pages');
                    break;
                }
            }

            currentPage++;
        }

        console.log(`   Total profiles collected: ${allProfileIds.length}`);
        console.log(`   Fetching vCards...`);

        let processedCount = 0;
        for (let i = 0; i < allProfileIds.length && processedCount < MAX_ATTORNEYS; i++) {
            const profileId = allProfileIds[i];

            // Skip if profileId already exists in database
            if (existingProfileIds.has(profileId.toString())) {
                stats.skippedExisting++;
                continue;
            }

            processedCount++;

            try {
                const vcardText = await fetchVCard(profileId);
                stats.vcardsFetched++;

                const vcard = parseVCard(vcardText);

                if (!vcard.email || !vcard.email.includes('@') || !vcard.email.includes('.')) {
                    stats.skipped++;
                    continue;
                }

                const emailLower = vcard.email.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    stats.skipped++;
                    continue;
                }

                let state = vcard.state || 'IL';
                if (!state || state === '') {
                    if (vcard.website) {
                        const inferredState = await inferStateFromWebsite(vcard.website);
                        if (inferredState) {
                            state = inferredState;
                            console.log(`     → Inferred state ${state} from website for ${vcard.firstName} ${vcard.lastName}`);
                        } else {
                            console.log(`     ⚠ Skipping ${vcard.firstName} ${vcard.lastName}: empty state, couldn't infer from website`);
                            stats.skipped++;
                            continue;
                        }
                    } else {
                        console.log(`     ⚠ Skipping ${vcard.firstName} ${vcard.lastName}: empty state, no website to infer from`);
                        stats.skipped++;
                        continue;
                    }
                }

                const docData = {
                    firstName: vcard.firstName,
                    lastName: vcard.lastName,
                    firmName: vcard.firmName,
                    email: emailLower,
                    phone: vcard.phone,
                    website: vcard.website,
                    practiceArea: practiceAreaName,
                    city: vcard.city,
                    state: state,
                    source: 'ilbar',
                    barNumber: '',
                    memberUrl: `${BASE_URL}/api/public/profiles/${profileId}/download-vcard`,
                    profileId: profileId,
                    sent: false,
                    status: 'pending',
                    randomIndex: Math.random() * 0.1,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };

                // Check for government/institutional contact
                if (isGovernmentContact(docData.email, docData.firmName)) {
                    stats.govt_skipped++;
                    continue;
                }

                if (!DRY_RUN) {
                    const docRef = db.collection('preintake_emails').doc();
                    batch.set(docRef, docData);
                    batchCount++;
                }

                existingEmails.add(emailLower);
                existingProfileIds.add(profileId.toString());
                stats.inserted++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`     Committed batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }

                if ((i + 1) % 50 === 0) {
                    console.log(`     Processed ${i + 1}/${Math.min(allProfileIds.length, MAX_ATTORNEYS)}`);
                }

                await sleepWithJitter(DELAY_BETWEEN_VCARDS);

            } catch (error) {
                stats.errors++;
                if (stats.errors <= 5) {
                    console.log(`     Error fetching profile ${profileId}: ${error.message}`);
                }
            }
        }

        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`     Committed final batch of ${batchCount}`);
        }

        // Determine if all profiles were scraped
        // For city combos or non-capped categories, mark complete if all profiles processed
        if (!stats.hit_cap) {
            const allProfilesProcessed = (processedCount + stats.skippedExisting) >= allProfileIds.length;
            stats.all_profiles_scraped = allProfilesProcessed;
        } else {
            // Hit cap means we couldn't get all results, but we scraped what was available
            stats.all_profiles_scraped = true; // Mark city combo as done even if capped
        }

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped}, SkippedExisting ${stats.skippedExisting}, GovSkipped ${stats.govt_skipped}, Errors ${stats.errors}`);

    } catch (error) {
        console.error(`   Fatal error: ${error.message}`);
        stats.errors++;
    } finally {
        try {
            if (!page.isClosed()) {
                await page.close();
            }
        } catch (closeError) {
            // Ignore close errors
        }
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
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.totalResults}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.vcardsFetched}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${t.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.hit_cap ? '⚠️' : '✓'}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Illinois Bar Scrape Report</h1>
    </div>
    <div style="background: #fff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px;">${new Date().toLocaleString()}</p>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Targets Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Target</th>
                <th style="padding: 8px; text-align: center;">Results</th>
                <th style="padding: 8px; text-align: center;">vCards</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">Status</th>
            </tr>
            ${targetsHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">Illinois Bar attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;">Practice areas completed:</td><td style="text-align: right;">${summary.progress.completedCategoryIds.length} / ${PRACTICE_AREAS.length}</td></tr>
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
    console.log('Illinois Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Strategy: Practice Area + City filtering for comprehensive coverage');
    console.log(`Max combos per run: ${MAX_COMBOS}`);
    console.log(`Max attorneys per run: ${MAX_ATTORNEYS}\n`);

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    const progress = await getProgress();
    console.log(`Progress: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length} practice areas complete`);
    console.log(`Areas needing city subdivision: ${progress.practiceAreaIdsNeedingCities.length}`);
    console.log(`Total inserted so far: ${progress.totalInserted.toLocaleString()}\n`);

    console.log('Loading existing emails...');
    const existingEmails = new Set();
    const existingSnapshot = await db.collection('preintake_emails').select('email').get();
    existingSnapshot.forEach(doc => {
        const email = doc.data().email?.toLowerCase();
        if (email) existingEmails.add(email);
    });
    console.log(`Loaded ${existingEmails.size} existing emails`);

    // Load existing profileIds for efficient skip-before-fetch
    console.log('Loading existing profile IDs...');
    const existingProfileIds = await loadExistingProfileIds();
    console.log(`Loaded ${existingProfileIds.size} existing profile IDs\n`);

    const startTime = Date.now();

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

            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
            }

            const stats = await scrapeTarget(browser, target, existingEmails, existingProfileIds);
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
                if (progress.completedCityCombos[stats.practiceAreaId].length >= ILLINOIS_CITIES.length) {
                    // Move from needingCities to completed
                    progress.practiceAreaIdsNeedingCities = progress.practiceAreaIdsNeedingCities.filter(
                        id => id !== stats.practiceAreaId
                    );
                    if (!progress.completedCategoryIds.includes(stats.practiceAreaId)) {
                        progress.completedCategoryIds.push(stats.practiceAreaId);
                    }
                    console.log(`   ✓ All cities complete for ${stats.practiceAreaName}`);
                }
            } else {
                // Practice area level scrape (no city filter)
                if (stats.hit_cap && !stats.city) {
                    // Needs city subdivision
                    if (!progress.practiceAreaIdsNeedingCities.includes(stats.practiceAreaId)) {
                        progress.practiceAreaIdsNeedingCities.push(stats.practiceAreaId);
                        console.log(`   → ${stats.practiceAreaName} added to city subdivision queue`);
                    }
                } else if (stats.all_profiles_scraped) {
                    // Complete (under cap)
                    if (!progress.completedCategoryIds.includes(stats.practiceAreaId)) {
                        progress.completedCategoryIds.push(stats.practiceAreaId);
                        console.log(`   ✓ Category ${stats.practiceAreaName} marked as complete`);
                    }
                }
            }

            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.lastRunDate = new Date().toISOString();

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            await sleepWithJitter(5000);
        }

        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Targets scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total Illinois Bar in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Practice areas complete: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length}`);
        console.log(`   Areas needing city subdivision: ${progress.practiceAreaIdsNeedingCities.length}`);
        console.log(`   Duration: ${duration} minutes`);

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
            path.join(__dirname, 'ilbar-scrape-summary.json'),
            JSON.stringify(summary, null, 2)
        );

        await sendNotificationEmail(
            `Illinois Bar: ${totalInsertedThisRun} new attorneys (${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length} categories)`,
            generateEmailHTML(summary)
        );

        console.log('\n✓ Scrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'Illinois Bar Scrape FAILED',
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
