#!/usr/bin/env node
/**
 * Florida Bar Attorney Scraper
 *
 * Scrapes attorney contact information from the Florida Bar website
 * and imports into preintake_emails collection for campaign targeting.
 *
 * Two-step scraping approach:
 * 1. Search results page: Get name, bar number, firm, email (Cloudflare decode)
 * 2. Profile page: Get website and practice areas (additional fields only)
 *
 * Usage:
 *   node scripts/scrape-flbar-attorneys.js
 *
 * Environment variables:
 *   PRACTICE_AREA_CODE - Specific practice area code to scrape (e.g., B37)
 *   MAX_ATTORNEYS - Maximum attorneys to scrape per run (default: 500)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const cheerio = require('cheerio');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ============================================================================
// PRACTICE AREA MAPPING
// Florida Bar alphanumeric codes → PreIntake.ai practice area names
// ============================================================================

const PRACTICE_AREAS = {
    // Tier 1: High priority (from practice-area-targets.md ranks 1-14)
    'B37': 'Personal Injury',
    'B28': 'Immigration',
    'B49': 'Workers Compensation',
    'B33': 'Medical Malpractice',
    'B38': 'Products Liability',
    'B47': 'Toxic Torts',
    'B05': 'Bankruptcy',
    'B30': 'Labor & Employment',
    'B09': 'Construction Law',
    'B29': 'Insurance',
    'B31': 'Legal Malpractice',
    'B39': 'Professional Liability',

    // Tier 2: Moderate priority (ranks 15-25)
    'B19': 'Family Law',
    'B14': 'Criminal Law',
    'B41': 'Real Estate',
    'B18': 'Elder Law',
    'B44': 'Trusts & Estates',
    'B08': 'Civil Rights',
    'B43': 'Taxation',
    'B26': 'Health Care',
    'B10': 'Condominium & HOA',

    // Tier 3: Lower priority but still consumer-facing
    'B06': 'Business Law',
    'B20': 'Government',
    'B21': 'Government Contracts',
    'B35': 'International Law',
    'B36': 'International Trade',
    'B02': 'Admiralty & Maritime',
    'B03': 'Administrative Law',
    'B04': 'Appellate Practice',
    'B07': 'Civil Litigation',
    'B11': 'Constitutional Law',
    'B12': 'Consumer Protection',
    'B13': 'Contracts',
    'B15': 'Debtor & Creditor',
    'B16': 'Education Law',
    'B17': 'Eminent Domain',
    'B22': 'Intellectual Property',
    'B23': 'Juvenile Law',
    'B24': 'Labor Relations',
    'B25': 'Land Use & Zoning',
    'B27': 'Immigration & Nationality',
    'B32': 'Media & Communications',
    'B34': 'Military Law',
    'B40': 'Public Utilities',
    'B42': 'Securities',
    'B45': 'Trial Practice',
    'B46': 'Environmental',
    'B48': 'Transportation',
    'B50': 'Wills & Probate'
};

// Priority order for scraping (matches practice-area-targets.md)
const PRACTICE_AREA_PRIORITY = [
    'B37', // Personal Injury
    'B28', // Immigration
    'B49', // Workers Compensation
    'B33', // Medical Malpractice
    'B38', // Products Liability
    'B47', // Toxic Torts
    'B05', // Bankruptcy
    'B30', // Labor & Employment
    'B09', // Construction Law
    'B29', // Insurance
    'B31', // Legal Malpractice
    'B39', // Professional Liability
    'B19', // Family Law
    'B14', // Criminal Law
    'B41', // Real Estate
    'B18', // Elder Law
    'B44', // Trusts & Estates
    'B08', // Civil Rights
    'B43', // Taxation
    'B26', // Health Care
    'B10', // Condominium & HOA
    'B06', // Business Law
];

// Florida counties for location-based searching
// Florida Bar requires location filter to avoid "too many results" error
// Top 25 Florida counties by population (covers ~85% of FL attorneys)
const FLORIDA_COUNTIES = [
    'Miami-Dade', 'Broward', 'Palm Beach', 'Hillsborough', 'Orange',
    'Duval', 'Pinellas', 'Polk', 'Lee', 'Pasco',
    'Brevard', 'Volusia', 'Osceola', 'Seminole', 'Manatee',
    'Sarasota', 'Lake', 'Marion', 'Collier', 'St. Lucie',
    'St. Johns', 'Escambia', 'Leon', 'Alachua', 'Clay'
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.floridabar.org';
const SEARCH_URL = `${BASE_URL}/directories/find-mbr/`;
const PAGE_SIZE = 50;
const DELAY_BETWEEN_PAGES = 8000;      // 8 seconds between search pages
const DELAY_BETWEEN_DETAILS = 5000;    // 5 seconds between profile pages
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const USER_AGENT = 'PreIntake.ai Scraper (+https://preintake.ai)';
const MAX_RETRIES = 3;

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db;
let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    let serviceAccount;

    // Check for CI environment (JSON string) or local file
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
        auth: {
            user: smtpUser,
            pass: smtpPass
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.sendMail({
            from: `"FL Bar Scraper" <${smtpUser}>`,
            to: 'Stephen Scott <stephen@preintake.ai>',
            subject: subject,
            html: htmlContent
        });
        console.log(`Email notification sent: ${subject}`);
    } catch (error) {
        console.error('Failed to send notification email:', error.message);
    }
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add random jitter (±30%) to make requests look more organic
function sleepWithJitter(baseMs) {
    const jitter = baseMs * 0.3 * (Math.random() * 2 - 1); // ±30%
    const finalMs = Math.max(1000, baseMs + jitter); // Minimum 1 second
    return sleep(finalMs);
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                const waitTime = Math.pow(2, attempt) * 15000; // 15s, 30s, 60s exponential backoff
                console.log(`   Rate limited (429), waiting ${waitTime / 1000}s...`);
                await sleep(waitTime);
                continue;
            }

            if (response.status === 503) {
                const waitTime = Math.pow(2, attempt) * 3000;
                console.log(`   Service unavailable (503), waiting ${waitTime / 1000}s...`);
                await sleep(waitTime);
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`   Attempt ${attempt} failed: ${error.message}. Retrying in ${waitTime / 1000}s...`);
                await sleep(waitTime);
            }
        }
    }

    throw lastError;
}

// ============================================================================
// CLOUDFLARE EMAIL DECODER
// ============================================================================

/**
 * Decode Cloudflare-protected email addresses
 * Cloudflare uses XOR encoding with the first byte as the key
 *
 * Example: data-cfemail="7d1b1218090e3d1a101c1411531e1210"
 * First 2 hex chars (7d) = XOR key, rest = encoded email
 */
function decodeCloudflareEmail(encoded) {
    if (!encoded) return null;

    try {
        let email = '';
        const key = parseInt(encoded.substr(0, 2), 16);

        for (let i = 2; i < encoded.length; i += 2) {
            const charCode = parseInt(encoded.substr(i, 2), 16) ^ key;
            email += String.fromCharCode(charCode);
        }

        const result = email.toLowerCase().trim();

        // Validate email format
        if (!result || !result.includes('@') || !result.includes('.')) {
            return null;
        }

        return result;
    } catch (error) {
        return null;
    }
}

// ============================================================================
// NAME PARSING
// ============================================================================

function parseName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };

    // Remove credentials/suffixes like "Esq.", "P.A.", "J.D.", etc.
    const cleaned = fullName
        .replace(/,?\s*(Esq\.?|P\.?A\.?|J\.?D\.?|LL\.?M\.?|Ph\.?D\.?|Jr\.?|Sr\.?|III?|IV)$/gi, '')
        .trim();

    const parts = cleaned.split(/\s+/);

    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }

    // Last word is last name, everything else is first name
    const lastName = parts.pop();
    const firstName = parts.join(' ');

    return { firstName, lastName };
}

// ============================================================================
// SEARCH RESULTS PARSING
// ============================================================================

/**
 * Parse search results page to extract attorney data
 * Florida Bar requires county filter to avoid "too many results" error
 *
 * Search URL: /directories/find-mbr/?sdx=N&eligible=Y&deceased=N&pracAreas={CODE}&locType=T&locValue={COUNTY}&pageNumber={N}&pageSize=50
 *
 * Returns object with:
 * - attorneys: array of attorney objects (barNumber, firstName, lastName, firmName, email, phone)
 * - totalPages: number of pages available
 * - tooManyResults: boolean if search returned "too many results" error
 */
async function parseSearchResults(practiceAreaCode, county, pageNum) {
    // URL encode the county name for special characters
    const encodedCounty = encodeURIComponent(county);
    const url = `${SEARCH_URL}?sdx=N&eligible=Y&deceased=N&pracAreas=${practiceAreaCode}&locType=T&locValue=${encodedCounty}&pageNumber=${pageNum}&pageSize=${PAGE_SIZE}`;

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    // Check for "too many results" error
    if ($('.alert-danger').text().includes('Too many results')) {
        return { attorneys: [], totalPages: 0, tooManyResults: true };
    }

    const attorneys = [];

    // Florida Bar HTML structure:
    // <ul class="profiles-compact">
    //   <li class="profile-compact">
    //     <div class="profile-identity">
    //       <div class="profile-content">
    //         <p class="profile-name"><a href="...?num=123456">Attorney Name</a></p>
    //         Office: <a href="tel:xxx">xxx</a><br>
    //         <span class="__cf_email__" data-cfemail="encoded">[email]</span>
    $('li.profile-compact').each((i, el) => {
        try {
            // Extract bar number from profile link
            const profileLink = $(el).find('a[href*="/directories/find-mbr/profile/?num="]').attr('href') || '';
            const barNumberMatch = profileLink.match(/num=(\d+)/);
            const barNumber = barNumberMatch ? barNumberMatch[1] : null;

            if (!barNumber) return; // Skip if no bar number

            // Extract name from .profile-name link
            const nameEl = $(el).find('.profile-name a').first();
            const fullName = nameEl.text().trim();

            if (!fullName) return; // Skip if no name

            const { firstName, lastName } = parseName(fullName);

            // Extract firm name from profile-contact section (first <p>)
            const profileContact = $(el).find('.profile-contact');
            let firmName = '';

            // Firm name is in the first <p> of profile-contact, but may include address
            const firmEl = profileContact.find('p').first();
            if (firmEl.length) {
                const firmText = firmEl.text().trim();
                // Address starts with a number - extract firm name before that
                const addressMatch = firmText.match(/^(.+?)(\d+\s)/);
                if (addressMatch) {
                    firmName = addressMatch[1].trim();
                } else if (firmText && !firmText.match(/^\d/)) {
                    // No address found, use full text if it doesn't start with number
                    firmName = firmText;
                }
            }

            // Extract phone (Office phone preferred)
            let phone = '';
            const contactHtml = profileContact.html() || '';
            const officeMatch = contactHtml.match(/Office:\s*<a[^>]*href="tel:([^"]+)"[^>]*>/i);
            if (officeMatch) {
                phone = officeMatch[1];
            } else {
                // Fallback to first tel: link
                const telLink = $(el).find('a[href^="tel:"]').first();
                if (telLink.length) {
                    phone = telLink.attr('href').replace('tel:', '');
                }
            }

            // Extract email (Cloudflare protected)
            const cfEmailEl = $(el).find('[data-cfemail]');
            const cfEmailEncoded = cfEmailEl.attr('data-cfemail');
            const email = decodeCloudflareEmail(cfEmailEncoded);

            // Only add if we have email
            if (email) {
                attorneys.push({
                    barNumber,
                    firstName,
                    lastName,
                    firmName,
                    email,
                    phone
                });
            }
        } catch (error) {
            // Skip malformed results
        }
    });

    // Extract total pages from pagination
    // Look for the last page number link
    let totalPages = 1;
    $('ul.pagination a[href*="pageNumber="]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const pageMatch = href.match(/pageNumber=(\d+)/);
        if (pageMatch) {
            const pageNum = parseInt(pageMatch[1], 10);
            if (pageNum > totalPages) {
                totalPages = pageNum;
            }
        }
    });

    // Alternative: try parsing from any data-cfemail elements if structured parsing failed
    if (attorneys.length === 0) {
        $('[data-cfemail]').each((i, el) => {
            try {
                const cfEmailEncoded = $(el).attr('data-cfemail');
                const email = decodeCloudflareEmail(cfEmailEncoded);

                if (!email) return;

                // Try to find associated bar number from nearby profile link
                const container = $(el).closest('li, div, tr').first();
                const profileLink = container.find('a[href*="/directories/find-mbr/profile/?num="]').attr('href') || '';
                const barNumberMatch = profileLink.match(/num=(\d+)/);
                const barNumber = barNumberMatch ? barNumberMatch[1] : null;

                if (!barNumber) return;

                // Try to find name from the profile link text
                const nameEl = container.find('a[href*="/directories/find-mbr/profile/?num="]').first();
                const fullName = nameEl.text().trim();
                const { firstName, lastName } = parseName(fullName);

                // Check we haven't already added this attorney
                if (!attorneys.find(a => a.barNumber === barNumber)) {
                    attorneys.push({
                        barNumber,
                        firstName,
                        lastName,
                        firmName: '',
                        email,
                        phone: ''
                    });
                }
            } catch (error) {
                // Skip
            }
        });
    }

    return { attorneys, totalPages, tooManyResults: false };
}

/**
 * Get total result count from search page
 */
function getTotalResultCount($) {
    // Look for result count text like "1-50 of 1234 results"
    const resultText = $('body').text();
    const countMatch = resultText.match(/of\s+(\d+)\s+results/i) ||
                       resultText.match(/(\d+)\s+results?\s+found/i) ||
                       resultText.match(/showing\s+\d+\s*-\s*\d+\s+of\s+(\d+)/i);

    if (countMatch) {
        return parseInt(countMatch[1], 10);
    }

    return 0;
}

// ============================================================================
// PROFILE PAGE PARSING (for website and practice areas)
// ============================================================================

/**
 * Fetch attorney profile page to get additional fields:
 * - website (Firm Website field)
 * - practiceAreas (array of all practice areas)
 *
 * Profile URL: /directories/find-mbr/profile/?num={barNumber}
 */
async function getProfileExtras(barNumber) {
    const url = `${BASE_URL}/directories/find-mbr/profile/?num=${barNumber}`;

    try {
        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        // Extract website - look for "Firm Website" or similar label
        let website = '';

        // Method 1: Look for links with "website" text
        $('a').each((i, el) => {
            const text = $(el).text().toLowerCase();
            const href = $(el).attr('href') || '';
            if ((text.includes('firm website') || text.includes('website') || text.includes('web site')) &&
                href.startsWith('http') && !href.includes('floridabar.org')) {
                website = href;
                return false; // Break
            }
        });

        // Method 2: Look for labeled fields (dt/dd or label patterns)
        if (!website) {
            $('dt, th, label, strong, b').each((i, el) => {
                const labelText = $(el).text().toLowerCase();
                if (labelText.includes('firm website') || labelText.includes('website')) {
                    const nextEl = $(el).next();
                    const linkEl = nextEl.find('a').first();
                    const href = linkEl.attr('href') || nextEl.text().trim();
                    if (href && href.startsWith('http') && !href.includes('floridabar.org')) {
                        website = href;
                        return false; // Break
                    }
                }
            });
        }

        // Method 3: Look in profile info sections
        if (!website) {
            $('.profile-info a, .member-info a, .contact-info a').each((i, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().toLowerCase();
                if (href.startsWith('http') && !href.includes('floridabar.org') &&
                    !href.includes('mailto:') && !href.includes('tel:') &&
                    (text.includes('website') || $(el).parent().text().toLowerCase().includes('website'))) {
                    website = href;
                    return false;
                }
            });
        }

        // Extract practice areas
        const practiceAreas = [];

        // Look for practice areas section
        $('h3, h4, dt, label, strong').each((i, el) => {
            const labelText = $(el).text().toLowerCase();
            if (labelText.includes('practice area') || labelText.includes('areas of practice')) {
                // Get the following list or text
                const container = $(el).next();
                container.find('li, p, span').each((j, item) => {
                    const area = $(item).text().trim();
                    if (area && area.length < 100 && !area.includes(':')) {
                        practiceAreas.push(area);
                    }
                });

                // If no list items, try getting text directly
                if (practiceAreas.length === 0) {
                    const text = container.text().trim();
                    if (text && text.length < 500) {
                        // Split by common delimiters
                        const areas = text.split(/[,;]|\n/).map(a => a.trim()).filter(a => a && a.length < 100);
                        practiceAreas.push(...areas);
                    }
                }
            }
        });

        return { website, practiceAreas };
    } catch (error) {
        console.log(`   Failed to fetch profile for ${barNumber}: ${error.message}`);
        return { website: '', practiceAreas: [] };
    }
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    const progressRef = db.collection('preintake_scrape_progress').doc('flbar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            scrapedPracticeAreaCodes: [],
            lastRunDate: null,
            totalInserted: 0,
            totalSkipped: 0,
            failedAttempts: {},
            permanentlySkipped: []
        };
    }

    const data = doc.data();
    return {
        scrapedPracticeAreaCodes: data.scrapedPracticeAreaCodes || [],
        lastRunDate: data.lastRunDate || null,
        totalInserted: data.totalInserted || 0,
        totalSkipped: data.totalSkipped || 0,
        failedAttempts: data.failedAttempts || {},
        permanentlySkipped: data.permanentlySkipped || []
    };
}

async function saveProgress(progress) {
    const progressRef = db.collection('preintake_scrape_progress').doc('flbar');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// ============================================================================
// MAIN SCRAPING LOGIC
// ============================================================================

async function scrapePracticeArea(practiceAreaCode) {
    const practiceName = PRACTICE_AREAS[practiceAreaCode] || practiceAreaCode;
    console.log(`\nScraping ${practiceName} (${practiceAreaCode})...`);
    console.log('-'.repeat(50));

    const stats = {
        pages_scraped: 0,
        counties_scraped: 0,
        attorneys_found: 0,
        with_email: 0,
        with_website: 0,
        no_email: 0,
        duplicates_skipped: 0,
        inserted: 0,
        errors: 0
    };

    // Get existing emails for deduplication (more efficient than per-record check)
    const existingEmails = new Set();
    const existingSnapshot = await db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .select('email')
        .get();

    existingSnapshot.forEach(doc => {
        const email = doc.data().email?.toLowerCase();
        if (email) existingEmails.add(email);
    });

    console.log(`Found ${existingEmails.size} existing FL Bar contacts in database`);

    let totalScraped = 0;

    // Prepare batch for Firestore writes
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;

    // Florida Bar requires county filter to avoid "too many results"
    // Iterate through all Florida counties
    for (const county of FLORIDA_COUNTIES) {
        if (totalScraped >= MAX_ATTORNEYS) {
            console.log(`\n   Reached MAX_ATTORNEYS limit (${MAX_ATTORNEYS}), stopping.`);
            break;
        }

        console.log(`\n   📍 County: ${county}`);

        let pageNum = 1;
        let hasMore = true;

        while (hasMore && totalScraped < MAX_ATTORNEYS) {
            try {
                // Parse search results page for this county
                const result = await parseSearchResults(practiceAreaCode, county, pageNum);
                stats.pages_scraped++;

                if (result.tooManyResults) {
                    console.log(`      ⚠️  Too many results for ${county}, skipping county`);
                    break;
                }

                if (result.attorneys.length === 0) {
                    if (pageNum === 1) {
                        console.log(`      No attorneys found in ${county}`);
                    }
                    break;
                }

                console.log(`      Page ${pageNum}: Found ${result.attorneys.length} attorneys with emails`);

                // Process attorneys
                for (const attorney of result.attorneys) {
                    if (totalScraped >= MAX_ATTORNEYS) break;

                    stats.attorneys_found++;
                    const emailLower = attorney.email.toLowerCase();

                    // Skip duplicates
                    if (existingEmails.has(emailLower)) {
                        stats.duplicates_skipped++;
                        continue;
                    }

                    stats.with_email++;

                    // DISABLED: Profile page fetching causes 429 rate limiting
                    // Website can be inferred later via separate workflow (like CalBar)
                    // const { website, practiceAreas } = await getProfileExtras(attorney.barNumber);
                    const website = '';
                    const practiceAreas = [];

                    // Prepare document
                    const docData = {
                        firstName: attorney.firstName,
                        lastName: attorney.lastName,
                        firmName: attorney.firmName,
                        email: emailLower,
                        website: website,
                        practiceArea: practiceName,
                        practiceAreas: practiceAreas.length > 0 ? practiceAreas : [practiceName],
                        state: 'FL',
                        source: 'flbar',
                        barNumber: attorney.barNumber,
                        memberUrl: `https://www.floridabar.org/directories/find-mbr/profile/?num=${attorney.barNumber}`,
                        phone: attorney.phone,
                        county: county,
                        sent: false,
                        status: 'pending',
                        randomIndex: Math.random() * 0.1, // Priority range (0.0-0.1)
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    if (!DRY_RUN) {
                        const docRef = db.collection('preintake_emails').doc();
                        batch.set(docRef, docData);
                        batchCount++;
                    }

                    existingEmails.add(emailLower);
                    stats.inserted++;
                    totalScraped++;

                    // Commit batch if full
                    if (batchCount >= BATCH_SIZE) {
                        await batch.commit();
                        console.log(`      ✓ Committed batch of ${batchCount} contacts`);
                        batch = db.batch();
                        batchCount = 0;
                    }
                }

                // Check for more pages
                pageNum++;
                hasMore = result.attorneys.length === PAGE_SIZE && pageNum <= result.totalPages;

                if (hasMore && totalScraped < MAX_ATTORNEYS) {
                    await sleepWithJitter(DELAY_BETWEEN_PAGES);
                }
            } catch (error) {
                console.error(`      ❌ Error on page ${pageNum}: ${error.message}`);
                stats.errors++;
                break;
            }
        }

        stats.counties_scraped++;

        // Small delay between counties
        if (totalScraped < MAX_ATTORNEYS) {
            await sleep(500);
        }
    }

    // Commit remaining batch
    if (batchCount > 0 && !DRY_RUN) {
        await batch.commit();
        console.log(`   ✓ Committed final batch of ${batchCount} contacts`);
    }

    return stats;
}

async function getNextPracticeArea(progress) {
    const scrapedCodes = new Set(progress.scrapedPracticeAreaCodes || []);
    const skippedCodes = new Set(progress.permanentlySkipped || []);

    for (const code of PRACTICE_AREA_PRIORITY) {
        if (!scrapedCodes.has(code) && !skippedCodes.has(code)) {
            return code;
        }
    }

    // All priority areas scraped/skipped, try remaining
    for (const code of Object.keys(PRACTICE_AREAS)) {
        if (!scrapedCodes.has(code) && !skippedCodes.has(code)) {
            return code;
        }
    }

    return null; // All areas done
}

/**
 * Get total attorneys in database from FL Bar
 */
async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .count()
        .get();
    return snapshot.data().count;
}

/**
 * Format date for display
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
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">
            FL Bar Attorney Scrape Report
        </h1>
    </div>

    <div style="background: #ffffff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
            ${formatDate(summary.run_date)}
        </p>

        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; font-weight: 600; color: #0369a1;">
                Practice Area: ${summary.practice_area.name} (${summary.practice_area.code})
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
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Duplicates skipped:</td>
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
        </table>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Overall Progress</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Total FL Bar attorneys in DB:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${summary.totals.total_attorneys_in_db.toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Practice areas completed:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.totals.practice_areas_completed.length} of ${PRACTICE_AREA_PRIORITY.length}</td>
            </tr>
        </table>

        ${summary.dry_run ? '<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;"><p style="margin: 0; font-weight: 600; color: #92400e;">DRY RUN - No data was written</p></div>' : '<div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;"><p style="margin: 0; font-weight: 600; color: #166534;">Scrape completed successfully</p></div>'}
    </div>

    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </div>
</body>
</html>`;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log('Florida Bar Attorney Scraper');
    console.log('============================\n');

    if (DRY_RUN) {
        console.log('DRY RUN MODE - No data will be written to Firestore\n');
    }

    initializeFirebase();

    // Load progress
    const progress = await getProgress();
    console.log(`Previous progress: ${progress.scrapedPracticeAreaCodes.length} practice areas completed`);
    if (progress.permanentlySkipped.length > 0) {
        console.log(`Permanently skipped: ${progress.permanentlySkipped.map(c => PRACTICE_AREAS[c]).join(', ')}`);
    }

    // Determine which practice area to scrape
    let practiceAreaCode = process.env.PRACTICE_AREA_CODE;

    if (!practiceAreaCode) {
        practiceAreaCode = await getNextPracticeArea(progress);
        if (!practiceAreaCode) {
            console.log('\nAll practice areas have been scraped!');
            await sendNotificationEmail(
                'FL Bar Scrape: All practice areas complete',
                '<h2>Florida Bar Scraping Complete</h2><p>All practice areas have been scraped.</p>'
            );
            return;
        }
        console.log(`Auto-selected next practice area: ${PRACTICE_AREAS[practiceAreaCode]} (${practiceAreaCode})`);
    }

    if (!PRACTICE_AREAS[practiceAreaCode]) {
        console.error(`Unknown practice area code: ${practiceAreaCode}`);
        console.log('Valid codes:', Object.keys(PRACTICE_AREAS).join(', '));
        process.exit(1);
    }

    const practiceName = PRACTICE_AREAS[practiceAreaCode];
    console.log(`\nTarget: ${practiceName} (${practiceAreaCode})`);
    console.log(`Max attorneys: ${MAX_ATTORNEYS}\n`);

    const startTime = Date.now();

    try {
        const stats = await scrapePracticeArea(practiceAreaCode);

        // Check error rate
        const ERROR_THRESHOLD = 0.10;
        const MAX_FAILED_ATTEMPTS = 3;

        const errorRate = stats.attorneys_found > 0 ? stats.errors / stats.attorneys_found : 0;
        let scrapeSuccessful = false;

        if (errorRate < ERROR_THRESHOLD) {
            // Success - mark practice area as completed
            if (!progress.scrapedPracticeAreaCodes.includes(practiceAreaCode)) {
                progress.scrapedPracticeAreaCodes.push(practiceAreaCode);
            }
            delete progress.failedAttempts[practiceAreaCode];
            scrapeSuccessful = true;
            console.log(`\nPractice area completed (error rate: ${(errorRate * 100).toFixed(1)}%)`);
        } else {
            // High error rate - track failed attempt
            const currentAttempts = (progress.failedAttempts[practiceAreaCode] || 0) + 1;
            progress.failedAttempts[practiceAreaCode] = currentAttempts;

            console.log(`\nHigh error rate (${(errorRate * 100).toFixed(1)}%) - attempt ${currentAttempts}/${MAX_FAILED_ATTEMPTS}`);

            if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
                if (!progress.permanentlySkipped.includes(practiceAreaCode)) {
                    progress.permanentlySkipped.push(practiceAreaCode);
                }
                console.log(`Practice area permanently skipped after ${currentAttempts} failed attempts`);
            }
        }

        // Update progress
        progress.lastRunDate = new Date().toISOString();
        progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
        progress.totalSkipped = (progress.totalSkipped || 0) + stats.duplicates_skipped;

        if (!DRY_RUN) {
            await saveProgress(progress);
        }

        // Get total in database
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        // Summary
        console.log('\n============================');
        console.log('Summary');
        console.log('============================');
        console.log(`   Pages scraped: ${stats.pages_scraped}`);
        console.log(`   Attorneys found: ${stats.attorneys_found}`);
        console.log(`   With website: ${stats.with_website}`);
        console.log(`   Duplicates skipped: ${stats.duplicates_skipped}`);
        console.log(`   Inserted: ${stats.inserted}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Duration: ${duration} minutes`);
        console.log(`\n   Total FL Bar attorneys in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Practice areas completed: ${progress.scrapedPracticeAreaCodes.length}/${PRACTICE_AREA_PRIORITY.length}`);

        // Build summary object
        const summary = {
            run_date: new Date().toISOString(),
            practice_area: {
                code: practiceAreaCode,
                name: practiceName,
                successful: scrapeSuccessful,
                error_rate: (errorRate * 100).toFixed(1) + '%'
            },
            stats,
            totals: {
                total_attorneys_in_db: totalInDb,
                practice_areas_completed: progress.scrapedPracticeAreaCodes,
                practice_areas_remaining: PRACTICE_AREA_PRIORITY.filter(c =>
                    !progress.scrapedPracticeAreaCodes.includes(c) &&
                    !progress.permanentlySkipped.includes(c)
                ),
                practice_areas_skipped: progress.permanentlySkipped
            },
            duration: `${duration} minutes`,
            dry_run: DRY_RUN
        };

        // Save summary to file
        const summaryPath = path.join(__dirname, 'flbar-scrape-summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        console.log(`\nSummary saved to: ${summaryPath}`);

        // Send email notification
        await sendNotificationEmail(
            `FL Bar Scrape: ${stats.inserted} new attorneys (${practiceName})`,
            generateEmailHTML(summary)
        );

        console.log('\nScrape complete!');

    } catch (error) {
        console.error('\nScraping failed:', error);

        await sendNotificationEmail(
            `FL Bar Scrape FAILED: ${practiceName}`,
            `<h2>Scrape Failed</h2><p>Practice Area: ${practiceName} (${practiceAreaCode})</p><p>Error: ${error.message}</p><pre>${error.stack}</pre>`
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
