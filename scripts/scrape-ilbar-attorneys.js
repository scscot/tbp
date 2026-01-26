#!/usr/bin/env node
/**
 * Illinois Bar Attorney Scraper (Direct API)
 *
 * Scrapes attorney contact information from the Illinois State Bar Association website
 * (isba.reliaguide.com) and imports into preintake_emails collection.
 *
 * Strategy:
 * 1. Query ReliaGuide REST API directly (no Puppeteer or vCards needed)
 * 2. API returns full profile data: name, email, phone, firm, website, location
 * 3. Paginate pages 0-9 per category (400 results max due to API hard limit)
 * 4. Process all 21 practice area categories sequentially
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-ilbar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
 *   MAX_COMBOS - Maximum practice area categories per run (default: 50)
 *   DRY_RUN - If "true", don't write to Firestore
 *   RESET_PROGRESS - If "true", reset scrape progress before starting
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
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
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://isba.reliaguide.com';
const API_PATH = '/api/public/profiles';
const RESULTS_PER_PAGE = 20; // API returns max 20 per page regardless of size param
const MAX_PAGES = 20; // Paginate until empty results or 400 error
const DELAY_BETWEEN_REQUESTS = 10000; // 10s between page requests (API is aggressively rate-limited)
const DELAY_BETWEEN_CATEGORIES = 30000; // 30s pause between categories
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const MAX_COMBOS = parseInt(process.env.MAX_COMBOS) || 50;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESET_PROGRESS = process.env.RESET_PROGRESS === 'true';

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
// API FETCH WITH RETRY
// ============================================================================

/**
 * Fetch a page of profiles from the ReliaGuide API with retry logic.
 * Returns an array of profile objects, or null on permanent failure.
 */
async function fetchProfilesPage(categoryName, categoryId, page, retries = 5) {
    const url = `${BASE_URL}${API_PATH}?category.equals=${encodeURIComponent(categoryName)}&categoryId.equals=${categoryId}&memberTypeId.equals=1&page=${page}&size=${RESULTS_PER_PAGE}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Referer': `${BASE_URL}/lawyer/search`
                }
            });

            if (response.status === 429) {
                const backoff = Math.pow(2, attempt) * 15000; // 30s, 60s, 120s, 240s, 480s
                console.log(`     429 rate limited (attempt ${attempt}/${retries}) - waiting ${(backoff / 1000).toFixed(0)}s...`);
                await sleep(backoff);
                continue;
            }

            if (response.status === 400) {
                // Page out of range (API cap)
                return [];
            }

            if (!response.ok) {
                console.log(`     HTTP ${response.status} on page ${page} (attempt ${attempt}/${retries})`);
                if (attempt < retries) {
                    await sleep(3000 * attempt);
                    continue;
                }
                return null;
            }

            const data = await response.json();

            // API returns a raw JSON array of profile objects
            if (Array.isArray(data)) {
                return data;
            }

            // Unexpected format
            console.log(`     Unexpected API response format on page ${page}`);
            return [];

        } catch (error) {
            console.log(`     Fetch error on page ${page} (attempt ${attempt}/${retries}): ${error.message}`);
            if (attempt < retries) {
                await sleep(3000 * attempt);
                continue;
            }
            return null;
        }
    }

    return null;
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
            signal: AbortSignal.timeout(10000)
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
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const progressRef = db.collection('preintake_scrape_progress').doc('ilbar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            completedCategoryIds: [],
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        completedCategoryIds: data.completedCategoryIds || [],
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
 * Get the next practice area category to scrape.
 */
function getNextTarget(progress) {
    for (const pa of PRACTICE_AREAS) {
        if (!progress.completedCategoryIds.includes(pa.id)) {
            return { practiceAreaId: pa.id, practiceAreaName: pa.name };
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
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapeCategory(target, existingEmails, existingProfileIds) {
    const { practiceAreaId, practiceAreaName } = target;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${practiceAreaName} (ID: ${practiceAreaId})`);
    console.log('='.repeat(60));

    const stats = {
        target: practiceAreaName,
        practiceAreaId,
        practiceAreaName,
        totalResults: 0,
        profilesFetched: 0,
        inserted: 0,
        skipped: 0,
        skippedExisting: 0,
        errors: 0,
        govt_skipped: 0,
        pagesScraped: 0
    };

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    try {
        // Paginate through all available pages (0-9, max 400 results)
        for (let page = 0; page < MAX_PAGES; page++) {
            console.log(`   Page ${page + 1}/${MAX_PAGES}...`);

            const profiles = await fetchProfilesPage(practiceAreaName, practiceAreaId, page);

            if (profiles === null) {
                console.log(`     Failed to fetch page ${page} - skipping rest of category`);
                stats.errors++;
                break;
            }

            if (profiles.length === 0) {
                console.log(`     No more results (${page > 0 ? 'end of results' : 'empty category'})`);
                break;
            }

            stats.profilesFetched += profiles.length;
            stats.pagesScraped++;

            if (page === 0) {
                // Estimate total from first page
                const estimatedTotal = profiles.length === RESULTS_PER_PAGE
                    ? `${RESULTS_PER_PAGE}+ (will paginate)`
                    : profiles.length;
                console.log(`   Estimated results: ${estimatedTotal}`);
            }

            console.log(`     Got ${profiles.length} profiles`);

            // Process each profile
            for (const profile of profiles) {
                const profileId = profile.id?.toString();

                if (!profileId) continue;

                // Skip if profileId already exists in database
                if (existingProfileIds.has(profileId)) {
                    stats.skippedExisting++;
                    continue;
                }

                // Extract email - skip profiles with no email or hidden email
                const email = (profile.email || '').toLowerCase().trim();
                if (!email || !email.includes('@') || !email.includes('.') || profile.hideEmail) {
                    stats.skipped++;
                    continue;
                }

                // Dedup against existing emails
                if (existingEmails.has(email)) {
                    stats.skipped++;
                    continue;
                }

                // Extract location data
                const location = profile.primaryLocation || {};
                const city = location.city || '';
                let state = location.region || '';

                // State inference if not available from API
                if (!state || state === '') {
                    const website = profile.website || '';
                    if (website) {
                        const inferredState = await inferStateFromWebsite(website);
                        if (inferredState) {
                            state = inferredState;
                        } else {
                            // Default to IL for Illinois Bar members without location data
                            state = 'IL';
                        }
                    } else {
                        state = 'IL';
                    }
                }

                const docData = {
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    firmName: profile.firmName || '',
                    email: email,
                    phone: profile.phone || '',
                    website: profile.website || '',
                    practiceArea: practiceAreaName,
                    city: city,
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

                existingEmails.add(email);
                existingProfileIds.add(profileId);
                stats.inserted++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`     Committed batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }

            stats.totalResults += profiles.length;

            // If we got fewer than a full page, no more results
            if (profiles.length < RESULTS_PER_PAGE) {
                console.log(`     Last page (${profiles.length} < ${RESULTS_PER_PAGE})`);
                break;
            }

            // Rate limit between pages
            await sleepWithJitter(DELAY_BETWEEN_REQUESTS);
        }

        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`     Committed final batch of ${batchCount}`);
        }

        console.log(`   Results: Inserted ${stats.inserted}, Skipped ${stats.skipped}, Existing ${stats.skippedExisting}, GovSkipped ${stats.govt_skipped}, Errors ${stats.errors}`);
        console.log(`   Pages scraped: ${stats.pagesScraped}, Total profiles: ${stats.profilesFetched}`);

    } catch (error) {
        console.error(`   Fatal error: ${error.message}`);
        stats.errors++;
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
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.profilesFetched}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${t.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${t.pagesScraped}</td>
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

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Categories Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Category</th>
                <th style="padding: 8px; text-align: center;">Results</th>
                <th style="padding: 8px; text-align: center;">Profiles</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">Pages</th>
            </tr>
            ${targetsHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">Illinois Bar attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;">Categories completed:</td><td style="text-align: right;">${summary.progress.completedCategoryIds.length} / ${PRACTICE_AREAS.length}</td></tr>
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
    console.log('Illinois Bar Attorney Scraper (Direct API)');
    console.log('='.repeat(60));
    console.log('Strategy: Direct API calls to ReliaGuide REST endpoint');
    console.log(`Max categories per run: ${MAX_COMBOS}`);
    console.log(`Max attorneys per run: ${MAX_ATTORNEYS}\n`);

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    const progress = await getProgress();
    console.log(`Progress: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length} categories complete`);
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
    const allStats = [];
    let totalInsertedThisRun = 0;

    try {
        // Process up to MAX_COMBOS categories
        for (let i = 0; i < MAX_COMBOS; i++) {
            const target = getNextTarget(progress);

            if (!target) {
                console.log('\nAll practice area categories complete!');
                break;
            }

            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
            }

            const stats = await scrapeCategory(target, existingEmails, existingProfileIds);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Only mark category as complete if we successfully fetched data
            // (don't mark complete if all pages failed due to rate limiting)
            if (stats.pagesScraped > 0 && !progress.completedCategoryIds.includes(stats.practiceAreaId)) {
                progress.completedCategoryIds.push(stats.practiceAreaId);
                console.log(`   Category ${stats.practiceAreaName} marked as complete`);
            } else if (stats.pagesScraped === 0) {
                console.log(`   Category ${stats.practiceAreaName} NOT marked complete (0 pages fetched - likely rate limited)`);
            }

            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.lastRunDate = new Date().toISOString();

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            // Longer delay between categories to avoid rate limiting
            if (i < MAX_COMBOS - 1) {
                console.log(`   Waiting ${DELAY_BETWEEN_CATEGORIES / 1000}s before next category...`);
                await sleepWithJitter(DELAY_BETWEEN_CATEGORIES);
            }
        }

        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Categories scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total Illinois Bar in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Categories complete: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length}`);
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

        console.log('\nScrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'Illinois Bar Scrape FAILED',
            `<h2>Scrape Failed</h2><p>${error.message}</p><pre>${error.stack}</pre>`
        );
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
