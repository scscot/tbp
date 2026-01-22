#!/usr/bin/env node
/**
 * Georgia State Bar Attorney Scraper (Puppeteer)
 *
 * Scrapes attorney contact information from the Georgia Bar website
 * (www.gabar.org/member-directory/) and imports into preintake_emails collection.
 *
 * Strategy:
 * 1. Navigate to member directory with memberGroup filter (Puppeteer)
 * 2. Extract profile IDs from attorney cards
 * 3. Paginate through all results
 * 4. Visit each profile page to extract contact details
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-gabar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per section (default: 300)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ============================================================================
// PRACTICE AREAS (Georgia Bar Section Codes)
// From: https://www.gabar.org/member-directory/ search form
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High-value PreIntake practice areas
    { code: 'FAMIL09', name: 'Family Law' },
    { code: 'CRIMI07', name: 'Criminal Law' },
    { code: 'IMMIG46', name: 'Immigration Law' },
    { code: 'BANKR05', name: 'Bankruptcy Law' },
    { code: 'WORKE21', name: 'Workers\' Compensation Law' },
    { code: 'LABOR15', name: 'Labor & Employment Law' },
    { code: 'GENER11', name: 'General Practice & Trial' },
    { code: 'ELDER40', name: 'Elder Law' },

    // Tier 2: Additional practice areas
    { code: 'REALP19', name: 'Real Property Law' },
    { code: 'CONSU48', name: 'Consumer Law' },
    { code: 'TORTI13', name: 'Tort & Insurance Practice' },
    { code: 'HEALT36', name: 'Health Law' },
    { code: 'ENVIR08', name: 'Environmental Law' },
    { code: 'INTEL38', name: 'Intellectual Property Law' },
    { code: 'CORPO06', name: 'Corporate Counsel' },

    // Tier 3: Business & General
    { code: 'BUSIN04', name: 'Business Law' },
    { code: 'TAXAT20', name: 'Tax Law' },
    { code: 'FINAN10', name: 'Fiduciary Law' },
    { code: 'ADMIN01', name: 'Administrative Law' },
    { code: 'APPEL02', name: 'Appellate Practice' },
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.gabar.org';
const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_PROFILES = 300; // Reduced from 1000ms - Georgia Bar can handle faster requests
const MAX_ATTORNEYS_PER_SECTION = parseInt(process.env.MAX_ATTORNEYS) || 300; // Per-section limit
const MAX_RUN_TIME_MS = 70 * 60 * 1000; // 70 minutes - stop before 90-minute GitHub Actions timeout
const DRY_RUN = process.env.DRY_RUN === 'true';

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

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    const progressRef = db.collection('preintake_scrape_progress').doc('gabar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            completedSectionCodes: [],
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        completedSectionCodes: data.completedSectionCodes || [],
        totalInserted: data.totalInserted || 0,
        lastRunDate: data.lastRunDate || null
    };
}

async function saveProgress(progress) {
    const progressRef = db.collection('preintake_scrape_progress').doc('gabar');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'gabar')
        .count()
        .get();
    return snapshot.data().count;
}

/**
 * Load existing GaBar profile IDs for efficient skip-before-fetch
 */
async function loadExistingProfileIds() {
    const profileIds = new Set();
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'gabar')
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

/**
 * Extract profile IDs from the member directory search results
 * Profile IDs are hash strings like "E271939B14FB7B41ED5BCDF5B1B810CC"
 */
async function extractProfileIds(page) {
    return await page.evaluate(() => {
        const ids = [];

        // Look for links to member profiles with ?id= parameter
        const profileLinks = document.querySelectorAll('a[href*="member-directory/?id="]');
        profileLinks.forEach(link => {
            const match = link.href.match(/[?&]id=([A-F0-9]+)/i);
            if (match) {
                ids.push(match[1]);
            }
        });

        // Also try alternative URL patterns
        const altLinks = document.querySelectorAll('a[href*="/member-directory/"]');
        altLinks.forEach(link => {
            const match = link.href.match(/id=([A-F0-9]{20,})/i);
            if (match && !ids.includes(match[1])) {
                ids.push(match[1]);
            }
        });

        return [...new Set(ids)]; // Dedupe
    });
}

/**
 * Extract attorney details from a profile page
 */
async function extractProfileDetails(page) {
    return await page.evaluate(() => {
        const details = {
            firstName: '',
            lastName: '',
            fullName: '',
            email: '',
            phone: '',
            firmName: '',
            website: '',
            city: '',
            state: '',
            zip: '',
            barNumber: ''
        };

        // Try to extract name from h1, h2, or specific class
        const nameEl = document.querySelector('h1, h2, .member-name, .attorney-name, [class*="name"]');
        if (nameEl) {
            details.fullName = nameEl.textContent.trim();
            const nameParts = details.fullName.split(/\s+/);
            if (nameParts.length >= 2) {
                details.firstName = nameParts[0];
                details.lastName = nameParts[nameParts.length - 1];
            }
        }

        // Try to extract email from mailto links
        const emailLink = document.querySelector('a[href^="mailto:"]');
        if (emailLink) {
            details.email = emailLink.href.replace('mailto:', '').split('?')[0].toLowerCase().trim();
        }

        // Try to extract email from text
        if (!details.email) {
            const emailMatch = document.body.innerText.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
                details.email = emailMatch[0].toLowerCase();
            }
        }

        // Try to extract phone
        const phoneMatch = document.body.innerText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) {
            details.phone = phoneMatch[0];
        }

        // Try to extract firm name
        const firmEl = document.querySelector('.firm-name, .organization, [class*="firm"], [class*="company"]');
        if (firmEl) {
            details.firmName = firmEl.textContent.trim();
        }

        // Try to extract website
        const websiteLinks = document.querySelectorAll('a[href^="http"]');
        websiteLinks.forEach(link => {
            const href = link.href;
            if (!href.includes('gabar.org') && !href.includes('facebook.com') &&
                !href.includes('twitter.com') && !href.includes('linkedin.com') &&
                !details.website) {
                details.website = href;
            }
        });

        // Try to extract address/location
        const addressText = document.body.innerText;
        const stateMatch = addressText.match(/,\s*([A-Z]{2})\s+\d{5}/);
        if (stateMatch) {
            details.state = stateMatch[1];
        }
        const zipMatch = addressText.match(/\b(\d{5}(-\d{4})?)\b/);
        if (zipMatch) {
            details.zip = zipMatch[1];
        }

        // Try to extract bar number
        const barMatch = addressText.match(/Bar\s*(?:Number|#|No\.?)?\s*:?\s*(\d+)/i);
        if (barMatch) {
            details.barNumber = barMatch[1];
        }

        return details;
    });
}

/**
 * Get total results count from page
 */
async function getResultsCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;
        // Try various patterns for result count
        let match = text.match(/(\d+)\s+results?/i);
        if (match) return parseInt(match[1]);

        match = text.match(/showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i);
        if (match) return parseInt(match[1]);

        match = text.match(/(\d+)\s+members?\s+found/i);
        if (match) return parseInt(match[1]);

        // Count visible profile links as fallback
        const profiles = document.querySelectorAll('a[href*="member-directory/?id="]');
        return profiles.length;
    });
}

/**
 * Check for and click "next page" or "load more" button
 */
async function goToNextPage(page, currentPage) {
    const hasNext = await page.evaluate((pageNum) => {
        // Try pagination links with specific classes
        const nextLink = document.querySelector('a.next, a[rel="next"], .pagination .next a, .pagination-next');
        if (nextLink && !nextLink.classList.contains('disabled')) {
            nextLink.click();
            return true;
        }

        // Look for "Next" text in links
        const allLinks = document.querySelectorAll('a');
        for (const link of allLinks) {
            const text = link.textContent.trim().toLowerCase();
            if (text === 'next' || text === 'next »' || text === 'next ›' || text === '>' || text === '»') {
                if (!link.classList.contains('disabled')) {
                    link.click();
                    return true;
                }
            }
        }

        // Try numbered pagination
        const pageLinks = document.querySelectorAll('.pagination a, .pager a, nav a');
        for (const link of pageLinks) {
            if (link.textContent.trim() === String(pageNum + 1)) {
                link.click();
                return true;
            }
        }

        // Try "Load More" button by text content
        const buttons = document.querySelectorAll('button, a.load-more, .load-more');
        for (const btn of buttons) {
            if (btn.textContent.toLowerCase().includes('load more')) {
                btn.click();
                return true;
            }
        }

        return false;
    }, currentPage);

    if (hasNext) {
        await sleep(DELAY_BETWEEN_PAGES);
    }

    return hasNext;
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapeSection(browser, section, existingEmails, existingProfileIds) {
    const { code, name } = section;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${name} (Code: ${code})`);
    console.log('='.repeat(60));

    const stats = {
        sectionCode: code,
        sectionName: name,
        totalResults: 0,
        profilesFetched: 0,
        inserted: 0,
        skipped: 0,
        skippedExisting: 0,
        errors: 0,
        all_profiles_scraped: false
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    try {
        // Navigate to search with memberGroup filter
        const url = `${BASE_URL}/member-directory/?memberGroup=${code}`;
        console.log(`   URL: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(5000);

        // Get initial results count
        stats.totalResults = await getResultsCount(page);
        console.log(`   Total results: ${stats.totalResults}`);

        if (stats.totalResults === 0) {
            console.log('   No results found');
            await page.close();
            return stats;
        }

        // Collect all profile IDs (with pagination)
        const allProfileIds = [];
        let currentPage = 1;
        let consecutiveEmptyPages = 0;

        while (allProfileIds.length < MAX_ATTORNEYS_PER_SECTION && consecutiveEmptyPages < 3) {
            console.log(`   Page ${currentPage}...`);

            const pageIds = await extractProfileIds(page);
            const newIds = pageIds.filter(id => !allProfileIds.includes(id));

            console.log(`     Found ${pageIds.length} profiles (${newIds.length} new)`);

            if (newIds.length === 0) {
                consecutiveEmptyPages++;
            } else {
                consecutiveEmptyPages = 0;
                allProfileIds.push(...newIds);
            }

            // Try to go to next page
            const hasNext = await goToNextPage(page, currentPage);
            if (!hasNext) {
                console.log('     No more pages');
                break;
            }
            currentPage++;
        }

        console.log(`   Total profiles collected: ${allProfileIds.length}`);
        stats.profilesFetched = allProfileIds.length;

        // Visit each profile page to extract details (Puppeteer required for JS-rendered content)
        console.log(`   Extracting profile details...`);

        let processedCount = 0;
        for (let i = 0; i < allProfileIds.length && processedCount < MAX_ATTORNEYS_PER_SECTION; i++) {
            const profileId = allProfileIds[i];

            // Skip if profileId already exists in database
            if (existingProfileIds.has(profileId.toString())) {
                stats.skippedExisting++;
                continue;
            }

            processedCount++;

            try {
                const profileUrl = `${BASE_URL}/member-directory/?id=${profileId}`;
                await page.goto(profileUrl, {
                    waitUntil: 'domcontentloaded', // Faster than networkidle2
                    timeout: 20000
                });
                // Shorter wait - just enough for JS to render
                await sleep(500);

                const details = await extractProfileDetails(page);

                // Skip if no email or invalid format
                if (!details.email || !details.email.includes('@') || !details.email.includes('.')) {
                    stats.skipped++;
                    continue;
                }

                // Skip if already exists
                const emailLower = details.email.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    stats.skipped++;
                    continue;
                }

                // Default to GA for Georgia Bar members
                const state = details.state || 'GA';

                // Create document
                const docData = {
                    firstName: details.firstName,
                    lastName: details.lastName,
                    firmName: details.firmName,
                    email: emailLower,
                    phone: details.phone,
                    website: details.website,
                    practiceArea: name,
                    city: details.city,
                    state: state,
                    source: 'gabar',
                    barNumber: details.barNumber,
                    memberUrl: profileUrl,
                    profileId: profileId,
                    sent: false,
                    status: 'pending',
                    randomIndex: Math.random() * 0.1,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };

                if (!DRY_RUN) {
                    const docRef = db.collection('preintake_emails').doc();
                    batch.set(docRef, docData);
                    batchCount++;
                }

                existingEmails.add(emailLower);
                stats.inserted++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`     Committed batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }

                // Progress logging
                if ((i + 1) % 50 === 0) {
                    console.log(`     Processed ${i + 1}/${Math.min(allProfileIds.length, MAX_ATTORNEYS_PER_SECTION)}`);
                }

                // Minimal delay between profiles
                await sleep(DELAY_BETWEEN_PROFILES);

            } catch (error) {
                stats.errors++;
                if (stats.errors <= 5) {
                    console.log(`     Error fetching profile ${profileId}: ${error.message}`);
                }
            }
        }

        // Progress summary
        console.log(`     Processed ${processedCount} profiles`);

        // Commit remaining batch
        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`     Committed final batch of ${batchCount}`);
        }

        // Track whether all profiles were scraped (not stopped by per-section limit)
        const allProfilesProcessed = (processedCount + stats.skippedExisting) >= allProfileIds.length;
        stats.all_profiles_scraped = allProfilesProcessed || (processedCount >= MAX_ATTORNEYS_PER_SECTION && allProfileIds.length <= MAX_ATTORNEYS_PER_SECTION);

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped}, SkippedExisting ${stats.skippedExisting}, Errors ${stats.errors}`);

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
    const sectionsHtml = summary.sections.map(s => `
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${s.sectionName}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${s.totalResults}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${s.profilesFetched}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${s.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${s.errors}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Georgia Bar Scrape Report</h1>
    </div>
    <div style="background: #fff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px;">${new Date().toLocaleString()}</p>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Sections Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Section</th>
                <th style="padding: 8px; text-align: center;">Results</th>
                <th style="padding: 8px; text-align: center;">Profiles</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">Errors</th>
            </tr>
            ${sectionsHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">Georgia Bar attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;">Sections completed:</td><td style="text-align: right;">${summary.progress.completedSectionCodes.length} / ${PRACTICE_AREAS.length}</td></tr>
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
    console.log('Georgia State Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Using www.gabar.org member directory\n');

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    // Load progress
    const progress = await getProgress();
    console.log(`Progress: ${progress.completedSectionCodes.length}/${PRACTICE_AREAS.length} sections complete`);
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

    // Load existing profileIds for efficient skip-before-fetch
    console.log('Loading existing profile IDs...');
    const existingProfileIds = await loadExistingProfileIds();
    console.log(`Loaded ${existingProfileIds.size} existing profile IDs\n`);

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
        // Process sections
        for (const section of PRACTICE_AREAS) {
            // Skip completed sections
            if (progress.completedSectionCodes.includes(section.code)) {
                console.log(`\nSkipping ${section.name} (already completed)`);
                continue;
            }

            // Check if approaching timeout (70 minutes)
            const elapsedMs = Date.now() - startTime;
            if (elapsedMs > MAX_RUN_TIME_MS) {
                const elapsedMins = (elapsedMs / 1000 / 60).toFixed(1);
                console.log(`\nApproaching timeout (${elapsedMins} min), stopping to save progress`);
                break;
            }

            const stats = await scrapeSection(browser, section, existingEmails, existingProfileIds);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Mark section complete ONLY if all profiles were scraped
            if (stats.all_profiles_scraped && !progress.completedSectionCodes.includes(section.code)) {
                progress.completedSectionCodes.push(section.code);
                console.log(`   ✓ Section ${section.name} marked as complete`);
            } else if (!stats.all_profiles_scraped) {
                console.log(`   ⚠ Section ${section.name} NOT marked complete (hit per-section limit)`);
            }

            // Save progress after each section
            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.lastRunDate = new Date().toISOString();

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            // Delay between sections
            await sleepWithJitter(5000);
        }

        // Summary
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Sections scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total Georgia Bar in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Sections complete: ${progress.completedSectionCodes.length}/${PRACTICE_AREAS.length}`);
        console.log(`   Duration: ${duration} minutes`);

        // Save summary
        const summary = {
            run_date: new Date().toISOString(),
            sections: allStats,
            totalInserted: totalInsertedThisRun,
            totalInDb,
            progress,
            duration: `${duration} minutes`,
            dry_run: DRY_RUN
        };

        fs.writeFileSync(
            path.join(__dirname, 'gabar-scrape-summary.json'),
            JSON.stringify(summary, null, 2)
        );

        // Send email
        await sendNotificationEmail(
            `Georgia Bar: ${totalInsertedThisRun} new attorneys (${progress.completedSectionCodes.length}/${PRACTICE_AREAS.length} sections)`,
            generateEmailHTML(summary)
        );

        console.log('\n✓ Scrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'Georgia Bar Scrape FAILED',
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
