#!/usr/bin/env node
/**
 * California Bar Attorney Scraper
 *
 * Scrapes attorney contact information from the California State Bar
 * and imports into preintake_emails collection for email campaign targeting.
 *
 * Features:
 * - CSS-based email obfuscation handling (Cal Bar uses fake email spans)
 * - Pagination support for large result sets
 * - Deduplication against existing Firestore records
 * - Progress tracking to resume across daily runs
 * - Email notification with scrape summary
 *
 * Environment Variables:
 *   FIREBASE_SERVICE_ACCOUNT - JSON string of service account credentials (for CI)
 *   PRACTICE_AREA_ID - Specific practice area ID to scrape (optional)
 *   MAX_ATTORNEYS - Max attorneys to scrape per run (default: 500)
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 *
 * Usage:
 *   # Scrape next unscraped practice area
 *   node scripts/scrape-calbar-attorneys.js
 *
 *   # Scrape specific practice area
 *   PRACTICE_AREA_ID=51 node scripts/scrape-calbar-attorneys.js
 *
 *   # Limit attorneys per run
 *   MAX_ATTORNEYS=100 node scripts/scrape-calbar-attorneys.js
 */

const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

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

// Practice area ID to name mapping
const PRACTICE_AREAS = {
    // Tier 1: High priority (ranks 1-14)
    51: 'Personal Injury',
    34: 'Immigration',
    63: 'Workers Compensation',
    46: 'Medical Malpractice',
    52: 'Products Liability',
    58: 'Toxic Torts',
    9: 'Bankruptcy',
    42: 'Labor & Employment',
    16: 'Construction Law',
    66: 'Landlord-Tenant Law',
    36: 'Insurance',
    10: 'Business Law',
    43: 'Legal Malpractice',
    53: 'Professional Liability',
    // Tier 2: Moderate priority (ranks 15-25)
    29: 'Family Law',
    19: 'Criminal Law',
    54: 'Real Estate',
    22: 'Elder Law',
    60: 'Trusts & Estates',
    61: 'Wills & Probate',
    62: 'White Collar Crime',
    11: 'Civil Rights',
    56: 'Taxation',
    33: 'Health Care',
    65: 'Homeowner Association Law',
    // Tier 3: Additional high-value areas (ranks 26-36)
    55: 'Social Security',
    64: 'Wrongful Termination',
    20: 'Debtor/Creditor',
    15: 'Consumer Protection',
    3: 'Adoption',
    38: 'Juvenile Law',
    8: 'Appellate',
    12: 'Collections',
    40: 'Land Use/Zoning',
    17: 'Contracts',
    18: 'Corporate/Securities',
    // Tier 4: Medium priority niche areas (ranks 37-46)
    35: 'Intellectual Property',
    26: 'Environmental/Natural Resources',
    47: 'Military/Veterans',
    21: 'Education',
    23: 'Eminent Domain',
    25: 'Entertainment/Sports',
    45: 'LGBTQ Law',
    50: 'Patent',
    59: 'Trademark/Trade Secrets',
    49: 'Nonprofit/Tax Exempt'
};

// Priority order for scraping (based on practice-area-targets.md)
const PRACTICE_AREA_ORDER = [
    // Tier 1: High priority (14 areas)
    51, 34, 63, 46, 52, 58, 9, 42, 16, 66, 36, 10, 43, 53,
    // Tier 2: Moderate priority (11 areas)
    29, 19, 54, 22, 60, 61, 62, 11, 56, 33, 65,
    // Tier 3: Additional high-value areas (11 areas)
    55, 64, 20, 15, 3, 38, 8, 12, 40, 17, 18,
    // Tier 4: Medium priority niche areas (10 areas)
    35, 26, 47, 21, 23, 25, 45, 50, 59, 49
];

// Configuration
const BASE_URL = 'https://apps.calbar.ca.gov';
const SEARCH_URL = `${BASE_URL}/attorney/LicenseeSearch/AdvancedSearch`;
const DETAIL_URL_PREFIX = `${BASE_URL}/attorney/Licensee/Detail/`;
const USER_AGENT = 'PreIntake.ai Scraper (+https://preintake.ai)';
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS || '500', 10);
const DELAY_BETWEEN_PAGES = 8000;  // 8 seconds between search pages
const DELAY_BETWEEN_DETAILS = 5000;  // 5 seconds between profile pages
const MAX_RETRIES = 3;

// Initialize Firebase Admin
let admin;
let db;

function initFirebase() {
    admin = require('firebase-admin');
    let serviceAccount;

    // Check for CI environment (JSON string) or local file
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        // Local development - use service account file
        serviceAccount = require('../secrets/serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    // Use the dedicated 'preintake' database
    db = admin.firestore();
    db.settings({ databaseId: 'preintake' });
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sleep with random jitter (±30%) to make requests look more organic
 */
function sleepWithJitter(baseMs) {
    const jitter = baseMs * 0.3 * (Math.random() * 2 - 1); // ±30%
    const finalMs = Math.max(1000, baseMs + jitter); // Minimum 1 second
    return sleep(finalMs);
}

/**
 * Fetch with retries and exponential backoff
 * Uses native Node.js fetch (available in Node 18+)
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Use AbortController for timeout (native fetch doesn't have timeout option)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': USER_AGENT,
                    ...options.headers
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 429 || response.status === 503) {
                if (attempt < retries) {
                    const waitTime = Math.pow(2, attempt) * 15000; // 15s, 30s, 60s exponential backoff
                    console.log(`   ⚠️  Rate limited (${response.status}), waiting ${waitTime / 1000}s...`);
                    await sleep(waitTime);
                    continue;
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            if (attempt < retries) {
                const waitTime = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s exponential backoff
                console.log(`   ⚠️  Fetch failed (${error.message}), retry ${attempt}/${retries} in ${waitTime / 1000}s...`);
                await sleep(waitTime);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Extract the real email from obfuscated Cal Bar HTML
 * Cal Bar uses 20 fake email spans with CSS to show only the real one
 */
function extractRealEmail($) {
    // Find the CSS rule that shows which span is visible
    const styleText = $('style').text();

    // Extract the ID with display:inline (e.g., "e9")
    const visibleMatch = styleText.match(/#(e\d+)\{display:inline;\}/);
    if (!visibleMatch) return null;

    const visibleId = visibleMatch[1];

    // Get the content of that span
    const emailSpan = $(`#${visibleId}`);
    if (!emailSpan.length) return null;

    // Extract text and decode HTML entities (cheerio auto-decodes)
    let email = emailSpan.text()
        .replace(/\s+/g, '')  // Remove whitespace
        .trim()
        .toLowerCase();

    // Validate email format
    if (!email || !email.includes('@') || !email.includes('.')) {
        return null;
    }

    return email;
}

/**
 * Extract attorney name from detail page
 * The name is in an <h3><b> element that contains a bar number (#NNNNNN)
 * Name format: "FirstName MiddleName/Initial LastName"
 * We extract: firstName = first word, lastName = last word (middle discarded)
 */
function extractName($) {
    let nameText = '';

    // Find the h3 > b element that contains a bar number pattern
    $('h3 b').each((i, el) => {
        const text = $(el).text();
        if (/#\d+/.test(text)) {
            nameText = text
                .replace(/#\d+/, '')  // Remove bar number
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            return false; // Break the loop
        }
    });

    if (!nameText) {
        return { firstName: '', lastName: '' };
    }

    const parts = nameText.split(' ').filter(p => p);

    // firstName = first word, lastName = last word
    // Middle name/initial is discarded
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

    return { firstName, lastName };
}

/**
 * Extract firm name from address line
 * Address format: "Address: [Firm Name], [Street], [City], [State] [Zip]"
 * If no firm name, format is: "Address: [Street Number] [Street], [City], [State] [Zip]"
 */
function extractFirmName($) {
    const addressP = $('p.nostyle').filter((i, el) =>
        $(el).text().includes('Address:')
    ).first();

    if (!addressP.length) return '';

    const addressText = addressP.text().replace('Address:', '').trim();
    const firstComma = addressText.indexOf(',');

    if (firstComma === -1) return '';

    const potentialFirm = addressText.substring(0, firstComma).trim();

    // If it starts with a number, it's a street address, not a firm name
    if (/^\d/.test(potentialFirm)) {
        return '';
    }

    // If it looks like a PO Box, it's not a firm name
    if (/^P\.?O\.?\s*Box/i.test(potentialFirm)) {
        return '';
    }

    // Otherwise, assume it's a firm name (or attorney's business name)
    return potentialFirm;
}

/**
 * Extract website from detail page
 */
function extractWebsite($) {
    // Check the JavaScript variable first
    const scriptText = $('script').text();
    const websiteMatch = scriptText.match(/var memberWebsite = '([^']+)'/);
    if (websiteMatch && websiteMatch[1]) {
        return websiteMatch[1];
    }

    // Fallback to text parsing
    const websiteText = $('p').filter((i, el) =>
        $(el).text().includes('Website:')
    ).first().text();

    const match = websiteText.match(/Website:\s*(.+?)(?:\s|$)/);
    if (!match) return '';

    const url = match[1].trim();
    if (url === 'Not Available' || url === 'Not' || !url) return '';

    return url;
}

/**
 * Parse attorney detail page
 */
async function parseDetailPage(barNumber, practiceAreaName) {
    const url = `${DETAIL_URL_PREFIX}${barNumber}`;

    try {
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        const email = extractRealEmail($);
        if (!email) {
            return { success: false, reason: 'no_email' };
        }

        const { firstName, lastName } = extractName($);
        const firmName = extractFirmName($);
        const website = extractWebsite($);

        // For CalBar, state is always CA, but add defensive logic in case
        // the data has an empty state - try to infer from website
        let state = 'CA';
        if (!state || state === '') {
            if (website) {
                const inferredState = await inferStateFromWebsite(website);
                if (inferredState) {
                    state = inferredState;
                } else {
                    // Cannot infer state, skip this contact
                    return { success: false, reason: 'no_state' };
                }
            } else {
                // No website to infer from and no state, skip this contact
                return { success: false, reason: 'no_state' };
            }
        }

        return {
            success: true,
            data: {
                firstName,
                lastName,
                firmName,
                email,
                website,
                practiceArea: practiceAreaName,
                state,
                source: 'calbar',
                barNumber: barNumber,
                sent: false,
                status: 'pending',
                randomIndex: Math.random() * 0.1,  // Low range (0.0-0.1) to prioritize CalBar contacts
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }
        };
    } catch (error) {
        return { success: false, reason: 'fetch_error', error: error.message };
    }
}

/**
 * Extract attorney detail links from search results page
 */
function extractDetailLinks($) {
    const links = [];

    $('a[href*="/attorney/Licensee/Detail/"]').each((i, el) => {
        const href = $(el).attr('href');
        const match = href.match(/\/attorney\/Licensee\/Detail\/(\d+)/);
        if (match) {
            links.push(match[1]);
        }
    });

    // Remove duplicates
    return [...new Set(links)];
}

/**
 * Get total pages from search results
 */
function getTotalPages($) {
    // Look for pagination info
    const paginationText = $('.pager').text() || $('[class*="pager"]').text();

    // Try to find "Page X of Y" pattern
    const pageMatch = paginationText.match(/Page\s+\d+\s+of\s+(\d+)/i);
    if (pageMatch) {
        return parseInt(pageMatch[1], 10);
    }

    // Look for last page number in pagination links
    let maxPage = 1;
    $('a[href*="PageNumber="]').each((i, el) => {
        const href = $(el).attr('href');
        const match = href.match(/PageNumber=(\d+)/);
        if (match) {
            const pageNum = parseInt(match[1], 10);
            if (pageNum > maxPage) maxPage = pageNum;
        }
    });

    return maxPage;
}

/**
 * Check if email already exists in Firestore
 */
async function emailExists(email) {
    const snapshot = await db.collection('preintake_emails')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
    return !snapshot.empty;
}

/**
 * Load progress from Firestore
 */
async function loadProgress() {
    const doc = await db.collection('preintake_scrape_progress').doc('calbar').get();
    if (doc.exists) {
        const data = doc.data();
        // Ensure failedAttempts and permanentlySkipped exist
        return {
            scrapedPracticeAreaIds: data.scrapedPracticeAreaIds || [],
            lastRunDate: data.lastRunDate || null,
            totalInserted: data.totalInserted || 0,
            totalSkipped: data.totalSkipped || 0,
            failedAttempts: data.failedAttempts || {},
            permanentlySkipped: data.permanentlySkipped || []
        };
    }
    return {
        scrapedPracticeAreaIds: [],
        lastRunDate: null,
        totalInserted: 0,
        totalSkipped: 0,
        failedAttempts: {},
        permanentlySkipped: []
    };
}

/**
 * Save progress to Firestore
 */
async function saveProgress(progress) {
    await db.collection('preintake_scrape_progress').doc('calbar').set(progress, { merge: true });
}

/**
 * Get total attorneys in database
 */
async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'calbar')
        .count()
        .get();
    return snapshot.data().count;
}

/**
 * Format date for email
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

/**
 * Generate HTML email for summary
 */
function generateEmailHTML(summary) {
    const successRate = summary.stats.attorneys_found > 0
        ? Math.round((summary.stats.with_email / summary.stats.attorneys_found) * 100)
        : 0;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">
            CalBar Attorney Scrape Report
        </h1>
    </div>

    <div style="background: #ffffff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
            ${formatDate(summary.run_date)}
        </p>

        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 600; color: #0369a1;">
                Practice Area: ${summary.practice_area.name} (ID: ${summary.practice_area.id})
            </p>
        </div>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Scrape Results</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Pages scraped:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.pages_scraped}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Attorneys found:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.attorneys_found}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">With website:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.with_website}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">With email:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.with_email}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">No email (skipped):</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.no_email}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Duplicates (skipped):</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.duplicates_skipped}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Errors:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.stats.errors}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>New insertions:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #166534;">${summary.stats.inserted}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Email capture rate:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${successRate}%</td>
            </tr>
        </table>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Overall Progress</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Total attorneys added from Cal Bar:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${summary.totals.total_attorneys_in_db.toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Practice areas completed:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.totals.practice_areas_completed.length} of 14</td>
            </tr>
        </table>

        <p style="color: #64748b; font-size: 13px; margin: 0;">
            <strong>Completed:</strong> ${summary.totals.practice_areas_completed.map(id => PRACTICE_AREAS[id] || id).join(', ') || 'None'}
        </p>
        <p style="color: #64748b; font-size: 13px; margin: 10px 0 0 0;">
            <strong>Remaining:</strong> ${summary.totals.practice_areas_remaining.map(id => PRACTICE_AREAS[id] || id).join(', ') || 'All complete!'}
        </p>

        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; font-weight: 600; color: #166534;">
                ✅ Scrape completed successfully
            </p>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </div>
</body>
</html>`;
}

/**
 * Generate plain text email
 */
function generatePlainText(summary) {
    const successRate = summary.stats.attorneys_found > 0
        ? Math.round((summary.stats.with_email / summary.stats.attorneys_found) * 100)
        : 0;

    return `CalBar Attorney Scrape Report
${formatDate(summary.run_date)}

PRACTICE AREA: ${summary.practice_area.name} (ID: ${summary.practice_area.id})

SCRAPE RESULTS
--------------
Pages scraped: ${summary.stats.pages_scraped}
Attorneys found: ${summary.stats.attorneys_found}
With website: ${summary.stats.with_website}
With email: ${summary.stats.with_email}
No email (skipped): ${summary.stats.no_email}
Duplicates (skipped): ${summary.stats.duplicates_skipped}
Errors: ${summary.stats.errors}
NEW INSERTIONS: ${summary.stats.inserted}
Email capture rate: ${successRate}%

OVERALL PROGRESS
----------------
Total attorneys added from Cal Bar: ${summary.totals.total_attorneys_in_db.toLocaleString()}
Practice areas completed: ${summary.totals.practice_areas_completed.length} of 14
Completed: ${summary.totals.practice_areas_completed.map(id => PRACTICE_AREAS[id] || id).join(', ') || 'None'}
Remaining: ${summary.totals.practice_areas_remaining.map(id => PRACTICE_AREAS[id] || id).join(', ') || 'All complete!'}

STATUS: Scrape completed successfully
`;
}

/**
 * Send email notification
 */
async function sendScrapeSummary(summary) {
    const smtpUser = process.env.PREINTAKE_SMTP_USER;
    const smtpPass = process.env.PREINTAKE_SMTP_PASS;

    if (!smtpUser || !smtpPass) {
        console.log('⚠️  SMTP credentials not configured, skipping email notification');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: smtpUser,
            pass: smtpPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const subject = summary.stats.inserted > 0
        ? `CalBar Scrape: ${summary.stats.inserted} new attorneys (${summary.practice_area.name})`
        : `CalBar Scrape: No new attorneys (${summary.practice_area.name})`;

    try {
        const result = await transporter.sendMail({
            from: 'Stephen Scott <stephen@preintake.ai>',
            to: 'Stephen Scott <stephen@preintake.ai>',
            subject,
            html: generateEmailHTML(summary),
            text: generatePlainText(summary)
        });
        console.log(`\n📧 Email notification sent: ${result.messageId}`);
    } catch (error) {
        console.error('⚠️  Failed to send email notification:', error.message);
    }
}

/**
 * Send notification when a practice area is permanently skipped due to repeated failures
 */
async function sendFailureNotification(practiceAreaId, practiceAreaName, failedAttempts, stats) {
    const smtpUser = process.env.PREINTAKE_SMTP_USER;
    const smtpPass = process.env.PREINTAKE_SMTP_PASS;

    if (!smtpUser || !smtpPass) {
        console.log('⚠️  SMTP credentials not configured, skipping failure notification');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: smtpUser,
            pass: smtpPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const errorRate = stats.attorneys_found > 0
        ? ((stats.errors / stats.attorneys_found) * 100).toFixed(1)
        : 'N/A';

    const subject = `⚠️ CalBar Scrape: ${practiceAreaName} permanently skipped after ${failedAttempts} failures`;

    const html = `
        <h2>CalBar Scraper Alert</h2>
        <p>The practice area <strong>${practiceAreaName}</strong> (ID: ${practiceAreaId}) has been permanently skipped after ${failedAttempts} failed attempts.</p>

        <h3>Last Attempt Stats:</h3>
        <ul>
            <li>Attorneys found: ${stats.attorneys_found}</li>
            <li>Errors: ${stats.errors}</li>
            <li>Error rate: ${errorRate}%</li>
            <li>Successfully inserted: ${stats.inserted}</li>
        </ul>

        <h3>Action Required:</h3>
        <p>To retry this practice area, manually remove it from the <code>permanentlySkipped</code> array and clear it from <code>failedAttempts</code> in the Firestore document at:</p>
        <p><code>preintake_scrape_progress/calbar</code></p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
            PreIntake.ai CalBar Scraper<br>
            Los Angeles, California
        </p>
    `;

    const text = `
CalBar Scraper Alert

The practice area ${practiceAreaName} (ID: ${practiceAreaId}) has been permanently skipped after ${failedAttempts} failed attempts.

Last Attempt Stats:
- Attorneys found: ${stats.attorneys_found}
- Errors: ${stats.errors}
- Error rate: ${errorRate}%
- Successfully inserted: ${stats.inserted}

Action Required:
To retry this practice area, manually remove it from the permanentlySkipped array and clear it from failedAttempts in the Firestore document at: preintake_scrape_progress/calbar
    `.trim();

    try {
        const result = await transporter.sendMail({
            from: 'Stephen Scott <stephen@preintake.ai>',
            to: 'Stephen Scott <stephen@preintake.ai>',
            subject,
            html,
            text
        });
        console.log(`\n📧 Failure notification sent: ${result.messageId}`);
    } catch (error) {
        console.error('⚠️  Failed to send failure notification:', error.message);
    }
}

/**
 * Scrape a single practice area
 */
async function scrapePracticeArea(practiceAreaId) {
    const practiceAreaName = PRACTICE_AREAS[practiceAreaId];
    console.log(`\n📋 Practice Area: ${practiceAreaName} (ID: ${practiceAreaId})`);
    console.log('─'.repeat(50));

    const stats = {
        pages_scraped: 0,
        attorneys_found: 0,
        with_website: 0,
        with_email: 0,
        no_email: 0,
        duplicates_skipped: 0,
        inserted: 0,
        errors: 0
    };

    // Build search URL
    const searchParams = new URLSearchParams({
        LastNameOption: 'b',
        LastName: '',
        FirstNameOption: 'b',
        FirstName: '',
        MiddleNameOption: 'b',
        MiddleName: '',
        FirmNameOption: 'b',
        FirmName: '',
        CityOption: 'b',
        City: '',
        State: '',
        Zip: '',
        District: '',
        County: '',
        LegalSpecialty: '',
        LanguageSpoken: '',
        PracticeArea: practiceAreaId.toString()
    });

    let allBarNumbers = [];
    let pageNumber = 1;
    let totalPages = 1;

    // Fetch all search result pages to collect bar numbers
    console.log('📄 Fetching search results...');

    while (pageNumber <= totalPages && allBarNumbers.length < MAX_ATTORNEYS) {
        const pageUrl = `${SEARCH_URL}?${searchParams.toString()}&PageNumber=${pageNumber}`;

        try {
            const html = await fetchWithRetry(pageUrl);
            const $ = cheerio.load(html);

            if (pageNumber === 1) {
                totalPages = getTotalPages($);
                console.log(`   Total pages: ${totalPages}`);
            }

            const barNumbers = extractDetailLinks($);
            allBarNumbers.push(...barNumbers);

            stats.pages_scraped++;
            console.log(`   Page ${pageNumber}/${totalPages}: Found ${barNumbers.length} attorneys`);

            pageNumber++;

            if (pageNumber <= totalPages && allBarNumbers.length < MAX_ATTORNEYS) {
                await sleepWithJitter(DELAY_BETWEEN_PAGES);
            }
        } catch (error) {
            console.error(`   ❌ Error fetching page ${pageNumber}: ${error.message}`);
            stats.errors++;
            break;
        }
    }

    // Limit to MAX_ATTORNEYS
    if (allBarNumbers.length > MAX_ATTORNEYS) {
        console.log(`   Limiting to ${MAX_ATTORNEYS} attorneys (found ${allBarNumbers.length})`);
        allBarNumbers = allBarNumbers.slice(0, MAX_ATTORNEYS);
    }

    stats.attorneys_found = allBarNumbers.length;
    console.log(`\n👥 Processing ${allBarNumbers.length} attorneys...`);

    // Process each attorney detail page
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < allBarNumbers.length; i++) {
        const barNumber = allBarNumbers[i];

        if ((i + 1) % 50 === 0 || i === allBarNumbers.length - 1) {
            console.log(`   Processing ${i + 1}/${allBarNumbers.length}...`);
        }

        const result = await parseDetailPage(barNumber, practiceAreaName);

        if (!result.success) {
            if (result.reason === 'no_email') {
                stats.no_email++;
            } else {
                stats.errors++;
            }
            await sleepWithJitter(DELAY_BETWEEN_DETAILS);
            continue;
        }

        stats.with_email++;
        if (result.data.website) {
            stats.with_website++;
        }

        // Check for duplicate
        const exists = await emailExists(result.data.email);
        if (exists) {
            stats.duplicates_skipped++;
            await sleepWithJitter(DELAY_BETWEEN_DETAILS);
            continue;
        }

        // Add to batch
        const docRef = db.collection('preintake_emails').doc();
        batch.set(docRef, result.data);
        batchCount++;
        stats.inserted++;

        // Commit batch if full
        if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            console.log(`   ✅ Committed batch of ${batchCount} records`);
            batchCount = 0;
        }

        await sleepWithJitter(DELAY_BETWEEN_DETAILS);
    }

    // Commit remaining records
    if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Committed final batch of ${batchCount} records`);
    }

    return stats;
}

/**
 * Main function
 */
async function main() {
    console.log('🔍 CalBar Attorney Scraper');
    console.log('===========================\n');

    // Initialize Firebase
    initFirebase();

    // Load progress
    const progress = await loadProgress();
    console.log(`📊 Previous progress: ${progress.scrapedPracticeAreaIds.length} practice areas completed`);
    if (progress.permanentlySkipped.length > 0) {
        console.log(`⚠️  Permanently skipped: ${progress.permanentlySkipped.map(id => PRACTICE_AREAS[id]).join(', ')}`);
    }

    // Determine which practice area to scrape
    let practiceAreaId;

    if (process.env.PRACTICE_AREA_ID) {
        practiceAreaId = parseInt(process.env.PRACTICE_AREA_ID, 10);
        console.log(`🎯 Scraping specific practice area: ${PRACTICE_AREAS[practiceAreaId]} (ID: ${practiceAreaId})`);
    } else {
        // Find next unscraped practice area (excluding permanently skipped)
        const unscrapedIds = PRACTICE_AREA_ORDER.filter(id =>
            !progress.scrapedPracticeAreaIds.includes(id) &&
            !progress.permanentlySkipped.includes(id)
        );

        if (unscrapedIds.length === 0) {
            if (progress.permanentlySkipped.length > 0) {
                console.log('⚠️  All remaining practice areas have been permanently skipped due to errors.');
                console.log('   Check the permanentlySkipped array in Firestore to retry.');
            } else {
                console.log('✅ All practice areas have been scraped!');
            }
            process.exit(0);
        }

        practiceAreaId = unscrapedIds[0];
        console.log(`🎯 Next practice area: ${PRACTICE_AREAS[practiceAreaId]} (ID: ${practiceAreaId})`);
    }

    // Scrape the practice area
    const stats = await scrapePracticeArea(practiceAreaId);

    // Check error rate and update progress accordingly
    const ERROR_THRESHOLD = 0.10; // 10% error rate threshold
    const MAX_FAILED_ATTEMPTS = 3;

    const errorRate = stats.attorneys_found > 0
        ? stats.errors / stats.attorneys_found
        : 0;

    const practiceAreaName = PRACTICE_AREAS[practiceAreaId];
    let scrapeSuccessful = false;

    if (errorRate < ERROR_THRESHOLD) {
        // Success - mark practice area as completed
        if (!progress.scrapedPracticeAreaIds.includes(practiceAreaId)) {
            progress.scrapedPracticeAreaIds.push(practiceAreaId);
        }
        // Clear any previous failed attempts for this practice area
        delete progress.failedAttempts[practiceAreaId];
        scrapeSuccessful = true;
        console.log(`\n✅ Practice area completed successfully (error rate: ${(errorRate * 100).toFixed(1)}%)`);
    } else {
        // High error rate - track failed attempt
        const currentAttempts = (progress.failedAttempts[practiceAreaId] || 0) + 1;
        progress.failedAttempts[practiceAreaId] = currentAttempts;

        console.log(`\n⚠️  High error rate (${(errorRate * 100).toFixed(1)}%) - attempt ${currentAttempts}/${MAX_FAILED_ATTEMPTS}`);

        if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
            // Permanently skip this practice area
            if (!progress.permanentlySkipped.includes(practiceAreaId)) {
                progress.permanentlySkipped.push(practiceAreaId);
            }
            console.log(`❌ Practice area permanently skipped after ${currentAttempts} failed attempts`);

            // Send failure notification
            await sendFailureNotification(practiceAreaId, practiceAreaName, currentAttempts, stats);
        } else {
            console.log(`   Will retry on next run`);
        }
    }

    progress.lastRunDate = new Date().toISOString();
    progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
    progress.totalSkipped = (progress.totalSkipped || 0) + stats.no_email + stats.duplicates_skipped;
    await saveProgress(progress);

    // Get total in database
    const totalInDb = await getTotalAttorneysInDb();

    // Summary
    console.log('\n===========================');
    console.log('📊 Summary');
    console.log('===========================');
    console.log(`   Attorneys found: ${stats.attorneys_found}`);
    console.log(`   With website: ${stats.with_website}`);
    console.log(`   With email: ${stats.with_email}`);
    console.log(`   No email (skipped): ${stats.no_email}`);
    console.log(`   Duplicates (skipped): ${stats.duplicates_skipped}`);
    console.log(`   ✅ Inserted: ${stats.inserted}`);
    console.log(`   ❌ Errors: ${stats.errors}`);
    console.log(`   Error rate: ${(errorRate * 100).toFixed(1)}%`);
    console.log(`\n   Total attorneys added from Cal Bar: ${totalInDb.toLocaleString()}`);
    console.log(`   Practice areas completed: ${progress.scrapedPracticeAreaIds.length}/14`);
    if (progress.permanentlySkipped.length > 0) {
        console.log(`   ⚠️  Permanently skipped: ${progress.permanentlySkipped.length}`);
    }

    // Build summary object
    const summary = {
        run_date: new Date().toISOString(),
        practice_area: {
            id: practiceAreaId,
            name: PRACTICE_AREAS[practiceAreaId],
            successful: scrapeSuccessful,
            error_rate: (errorRate * 100).toFixed(1) + '%'
        },
        stats,
        totals: {
            total_attorneys_in_db: totalInDb,
            practice_areas_completed: progress.scrapedPracticeAreaIds,
            practice_areas_remaining: PRACTICE_AREA_ORDER.filter(id =>
                !progress.scrapedPracticeAreaIds.includes(id) &&
                !progress.permanentlySkipped.includes(id)
            ),
            practice_areas_skipped: progress.permanentlySkipped,
            failed_attempts: progress.failedAttempts
        }
    };

    // Save summary to file
    const summaryPath = path.join(__dirname, 'calbar-scrape-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\n📄 Summary saved to: ${summaryPath}`);

    // Send email notification
    await sendScrapeSummary(summary);

    console.log('\n✅ Scrape complete!');
}

// Run
main().catch(error => {
    console.error('❌ Scraper failed:', error);
    process.exit(1);
});
