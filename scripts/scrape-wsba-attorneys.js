#!/usr/bin/env node
/**
 * Washington State Bar Association (WSBA) Attorney Scraper
 *
 * Scrapes attorney contact information from mywsba.org and imports into
 * preintake_emails collection.
 *
 * Strategy:
 * 1. Navigate to search results with practice area filter (Puppeteer)
 * 2. Extract Usr_ID values from profile links
 * 3. Handle ASP.NET ViewState pagination
 * 4. Navigate to each profile page to extract email/phone/firm
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-wsba-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per practice area (default: 500)
 *   MAX_AREAS - Maximum practice areas per run (default: 8)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PRACTICE_AREA_SLUG - Specific practice area to scrape (optional)
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
// PRACTICE AREAS (from WSBA dropdown, prioritized by value)
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High-value PreIntake practice areas
    { slug: 'Personal Injury', displayName: 'Personal Injury' },
    { slug: 'Immigration-Naturaliza', displayName: 'Immigration' },
    { slug: 'Family', displayName: 'Family' },
    { slug: 'Bankruptcy', displayName: 'Bankruptcy' },
    { slug: 'Criminal', displayName: 'Criminal' },
    { slug: 'Workers Compensation', displayName: 'Workers\' Compensation' },
    { slug: 'Employment', displayName: 'Employment' },
    { slug: 'Elder', displayName: 'Elder Law' },

    // Tier 2: Moderate priority
    { slug: 'Estate Planning-Probate', displayName: 'Estate Planning/Probate/Wills' },
    { slug: 'Consumer', displayName: 'Consumer' },
    { slug: 'Civil Rights', displayName: 'Civil Rights' },
    { slug: 'Disability', displayName: 'Disability' },
    { slug: 'Landlord-Tenant', displayName: 'Landlord/Tenant' },
    { slug: 'Real Property', displayName: 'Real Property' },
    { slug: 'Construction', displayName: 'Construction' },
    { slug: 'Malpractice', displayName: 'Malpractice' },

    // Tier 3: Additional
    { slug: 'Business-Commercial', displayName: 'Business/Commercial' },
    { slug: 'Tax', displayName: 'Tax' },
    { slug: 'Insurance', displayName: 'Insurance' },
    { slug: 'Health', displayName: 'Health' },
    { slug: 'Guardianships', displayName: 'Guardianships' },
    { slug: 'Foreclosure', displayName: 'Foreclosure' },
    { slug: 'Torts', displayName: 'Torts' },
    { slug: 'Traffic Offenses', displayName: 'Traffic Offenses' },
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://www.mywsba.org/PersonifyEbusiness';
const SEARCH_URL = `${BASE_URL}/LegalDirectory.aspx`;
const PROFILE_URL = `${BASE_URL}/LegalDirectory/LegalProfile.aspx`;
const SOURCE = 'wsba';
const DEFAULT_STATE = 'WA';

const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_PROFILES = 300;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const EARLY_EXIT_THRESHOLD = 75; // Skip practice area after N consecutive profiles with no new inserts
const MAX_PRACTICE_AREAS_PER_RUN = parseInt(process.env.MAX_AREAS) || 8; // Limit areas per run to avoid timeout
const SATURATION_THRESHOLD = 3; // Zero-insert runs before marking an area as saturated
const SATURATION_RECHECK_DAYS = 7; // Days before rechecking a saturated area
const PRE_FILTER_KNOWN_PCT = 0.95; // Skip profile fetching if >95% of search results are already known
const DRY_RUN = process.env.DRY_RUN === 'true';
const PRACTICE_AREA_SLUG = process.env.PRACTICE_AREA_SLUG || null;

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
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    const progressRef = db.collection('preintake_scrape_progress').doc('wsba');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            scrapedPracticeAreaSlugs: [],
            totalInserted: 0,
            totalSkipped: 0,
            failedAttempts: {},
            permanentlySkipped: [],
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        scrapedPracticeAreaSlugs: data.scrapedPracticeAreaSlugs || [],
        totalInserted: data.totalInserted || 0,
        totalSkipped: data.totalSkipped || 0,
        failedAttempts: data.failedAttempts || {},
        permanentlySkipped: data.permanentlySkipped || [],
        lastRunDate: data.lastRunDate || null,
        areaStatus: data.areaStatus || {},  // { slug: { zeroInsertRuns, lastRunDate } }
        runCount: data.runCount || 0
    };
}

async function saveProgress(progress) {
    const progressRef = db.collection('preintake_scrape_progress').doc('wsba');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', SOURCE)
        .count()
        .get();
    return snapshot.data().count;
}

// ============================================================================
// PUPPETEER SCRAPING FUNCTIONS
// ============================================================================

/**
 * Extract license numbers from search results table
 * The WSBA search results show a table with License Number as the first column
 */
async function extractAttorneysFromSearchResults(page) {
    return await page.evaluate(() => {
        const attorneys = [];
        const seenLicenseNumbers = new Set();

        // Helper: Parse first name from WSBA "First Name" column
        // WSBA includes middle names/initials in the first name column: "Jerry D." or "Maxine S. Daniels"
        // We want just the first name: "Jerry" or "Maxine"
        function parseFirstName(rawFirstName) {
            if (!rawFirstName) return '';
            // Split by space and take only the first word
            const parts = rawFirstName.trim().split(/\s+/);
            return parts[0] || '';
        }

        // The results are in a table with columns: License Number, First Name, Last Name, City, Status, Phone
        // Extract ALL data from the search results table since profile pages are unreliable for names
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                // Need at least 4 cells: License Number, First Name, Last Name, City
                if (cells.length >= 4) {
                    const licenseNumber = cells[0].textContent?.trim();
                    const rawFirstName = cells[1].textContent?.trim();
                    const lastName = cells[2].textContent?.trim();
                    const city = cells[3].textContent?.trim();

                    // License numbers are numeric
                    if (licenseNumber && /^\d+$/.test(licenseNumber) && !seenLicenseNumbers.has(licenseNumber)) {
                        seenLicenseNumbers.add(licenseNumber);
                        attorneys.push({
                            licenseNumber,
                            firstName: parseFirstName(rawFirstName),
                            lastName: lastName || '',
                            city: city || ''
                        });
                    }
                }
            }
        }

        // Also try GridView format (ASP.NET)
        if (attorneys.length === 0) {
            const gridRows = document.querySelectorAll('[class*="GridView"] tr, [id*="GridView"] tr');
            for (const row of gridRows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    const licenseNumber = cells[0].textContent?.trim();
                    const rawFirstName = cells[1].textContent?.trim();
                    const lastName = cells[2].textContent?.trim();
                    const city = cells[3].textContent?.trim();

                    if (licenseNumber && /^\d+$/.test(licenseNumber) && !seenLicenseNumbers.has(licenseNumber)) {
                        seenLicenseNumbers.add(licenseNumber);
                        attorneys.push({
                            licenseNumber,
                            firstName: parseFirstName(rawFirstName),
                            lastName: lastName || '',
                            city: city || ''
                        });
                    }
                }
            }
        }

        // Fallback: if no table data found, try to get license numbers from links (but no names)
        if (attorneys.length === 0) {
            const links = document.querySelectorAll('a[href*="LegalProfile"], a[href*="Usr_ID"]');
            links.forEach(link => {
                const match = link.href.match(/Usr_ID=(\d+)/);
                if (match && !seenLicenseNumbers.has(match[1])) {
                    seenLicenseNumbers.add(match[1]);
                    attorneys.push({
                        licenseNumber: match[1],
                        firstName: '',
                        lastName: '',
                        city: ''
                    });
                }
            });
        }

        return attorneys;
    });
}

/**
 * Check if there's a next page and navigate to it
 */
async function goToNextPage(page) {
    // WSBA uses text-based pagination links
    const hasNextPage = await page.evaluate(() => {
        // Look for "Next Page >" link
        const links = document.querySelectorAll('a');
        for (const link of links) {
            const text = link.textContent || '';
            if (text.includes('Next Page') || text.includes('Next') || text.includes('>>') || text.includes('>')) {
                // Check if it's not disabled
                if (!link.classList.contains('disabled') && !link.closest('.disabled')) {
                    // Check if this looks like a pagination link
                    if (link.href && (link.href.includes('__doPostBack') || link.href.includes('Page'))) {
                        link.click();
                        return true;
                    }
                }
            }
        }

        // Also try numeric pagination - find current page and click next
        const pageLinks = document.querySelectorAll('a[href*="Page"]');
        let currentPage = null;
        pageLinks.forEach(link => {
            if (link.classList.contains('active') || link.classList.contains('current')) {
                const text = link.textContent?.trim();
                if (text && /^\d+$/.test(text)) {
                    currentPage = parseInt(text);
                }
            }
        });

        if (currentPage) {
            const nextPageNum = currentPage + 1;
            for (const link of pageLinks) {
                if (link.textContent?.trim() === String(nextPageNum)) {
                    link.click();
                    return true;
                }
            }
        }

        return false;
    });

    if (hasNextPage) {
        await sleep(DELAY_BETWEEN_PAGES);
        // Wait for navigation or content update
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        } catch (e) {
            // Page might update via AJAX instead of full navigation
            await sleep(2000);
        }
    }

    return hasNextPage;
}

/**
 * Get total results count from search page
 */
async function getResultsCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;

        // Look for "659 results" pattern (WSBA shows this)
        let match = text.match(/(\d+)\s+results?/i);
        if (match) return parseInt(match[1]);

        // Look for patterns like "1 - 25 of 659" or "of 659 results"
        match = text.match(/of\s+(\d+)/i);
        if (match) return parseInt(match[1]);

        match = text.match(/(\d+)\s+results?\s+found/i);
        if (match) return parseInt(match[1]);

        match = text.match(/Showing\s+(\d+)/i);
        if (match) return parseInt(match[1]);

        // Count table rows with numeric first cells (license numbers) as fallback
        let count = 0;
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
                const firstCell = row.querySelector('td:first-child');
                if (firstCell && /^\d+$/.test(firstCell.textContent?.trim())) {
                    count++;
                }
            }
        }
        return count;
    });
}

/**
 * Extract profile data from a profile page
 */
async function scrapeProfile(page, usrId) {
    const url = `${PROFILE_URL}?Usr_ID=${usrId}`;

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await sleep(100);

        const data = await page.evaluate(() => {
            const result = {
                firstName: '',
                lastName: '',
                fullName: '',
                email: '',
                phone: '',
                firmName: '',
                address: '',
                city: '',
                state: '',
                zip: '',
                website: '',
                barNumber: '',
                admissionDate: ''
            };

            // Helper to get text content
            const getText = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.textContent.trim() : '';
            };

            // Get all text content for parsing
            const bodyText = document.body.innerText;
            const bodyHtml = document.body.innerHTML;

            // Extract name from page title or header
            // Try multiple selectors since WSBA page structure varies
            const nameHeader = document.querySelector('h1, h2, .attorney-name, .profile-name, .member-name, [class*="Name"], [id*="Name"]');
            if (nameHeader) {
                result.fullName = nameHeader.textContent.trim();
                // Try to split name
                const nameParts = result.fullName.split(/\s+/);
                if (nameParts.length >= 2) {
                    result.firstName = nameParts[0];
                    result.lastName = nameParts[nameParts.length - 1];
                }
            }

            // If name not found via header, try looking for labeled fields
            if (!result.firstName || !result.lastName) {
                // Try "First Name:" or "Name:" labels
                const firstNameMatch = bodyText.match(/(?:First\s*Name)[:\s]+([A-Za-z]+)/i);
                const lastNameMatch = bodyText.match(/(?:Last\s*Name)[:\s]+([A-Za-z]+)/i);
                if (firstNameMatch) result.firstName = firstNameMatch[1].trim();
                if (lastNameMatch) result.lastName = lastNameMatch[1].trim();

                // Try page title (often contains attorney name)
                if ((!result.firstName || !result.lastName) && document.title) {
                    const titleParts = document.title.split(/[-|–—]/)[0].trim().split(/\s+/);
                    // Filter out common words that aren't names
                    const filteredParts = titleParts.filter(p =>
                        p.length > 1 &&
                        !/^(wsba|attorney|lawyer|profile|directory|legal|washington|state|bar|association)$/i.test(p)
                    );
                    if (filteredParts.length >= 2) {
                        if (!result.firstName) result.firstName = filteredParts[0];
                        if (!result.lastName) result.lastName = filteredParts[filteredParts.length - 1];
                    }
                }
            }

            // Extract email - look for mailto links or email patterns
            const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
            if (emailLinks.length > 0) {
                const href = emailLinks[0].getAttribute('href');
                result.email = href.replace('mailto:', '').split('?')[0].toLowerCase().trim();
            } else {
                // Look for email pattern in page text
                const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                    result.email = emailMatch[0].toLowerCase();
                }
            }

            // Extract phone - look for phone patterns
            const phoneMatch = bodyText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch) {
                result.phone = phoneMatch[0];
            }

            // Extract firm name - WSBA uses "Firm or Employer:" format
            // Only use regex extraction since HTML fallback picks up navigation elements
            let firmName = '';

            // Look for labeled field patterns with the firm name after the label
            // The firm name is typically on a single line after "Firm or Employer:"
            const firmPatterns = [
                // Match "Firm or Employer:" then capture text until newline or tab
                /Firm\s+or\s+Employer[:\s\t]+([A-Za-z0-9][^\n\r]+)/i,
                /(?:^|\n)Employer[:\s\t]+([A-Za-z0-9][^\n\r]+)/im,
                /(?:^|\n)Firm[:\s\t]+([A-Za-z0-9][^\n\r]+)/im,
                /(?:^|\n)Company[:\s\t]+([A-Za-z0-9][^\n\r]+)/im
            ];

            for (const pattern of firmPatterns) {
                const match = bodyText.match(pattern);
                if (match && match[1]) {
                    let extracted = match[1].trim();
                    // Clean up any accidental "or Employer:" capture
                    extracted = extracted.replace(/^or\s+Employer[:\s]*/i, '').trim();
                    // Skip navigation/junk text and non-firm-name patterns
                    const junkWords = ['cart', 'store', 'login', 'home', 'menu', 'search', 'sign in', 'register', 'office type', 'solo practice', 'wsba members'];
                    const lowerExtracted = extracted.toLowerCase();
                    const hasJunk = junkWords.some(w => lowerExtracted.includes(w));
                    // Skip if it looks like navigation or is too short
                    if (!hasJunk && extracted.length >= 3 && extracted.length < 200) {
                        // Additional validation: should look like a firm name (has letters, maybe numbers/punctuation)
                        if (/[A-Za-z]{2,}/.test(extracted)) {
                            firmName = extracted;
                            break;
                        }
                    }
                }
            }

            if (firmName) {
                result.firmName = firmName;
            }

            // Extract bar number from URL or page
            const barMatch = bodyText.match(/(?:Bar\s*(?:Number|#|No\.?)|License\s*(?:Number|#|No\.?)|WSBA\s*#?)[:\s]*(\d+)/i);
            if (barMatch) {
                result.barNumber = barMatch[1];
            }

            // Extract admission date
            const admitMatch = bodyText.match(/(?:Admit(?:ted)?|Admission)[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})/i);
            if (admitMatch) {
                result.admissionDate = admitMatch[1];
            }

            // Extract website
            const websiteLinks = document.querySelectorAll('a[href^="http"]');
            for (const link of websiteLinks) {
                const href = link.getAttribute('href');
                // Skip internal and common non-firm links
                if (href &&
                    !href.includes('mywsba.org') &&
                    !href.includes('wsba.org') &&
                    !href.includes('facebook.com') &&
                    !href.includes('twitter.com') &&
                    !href.includes('linkedin.com') &&
                    !href.includes('google.com')) {
                    result.website = href;
                    break;
                }
            }

            // Extract address - look for address patterns
            const addrMatch = bodyText.match(/(\d+[^,\n]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[^,\n]*),?\s*([A-Za-z\s]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i);
            if (addrMatch) {
                result.address = addrMatch[1].trim();
                result.city = addrMatch[2].trim();
                result.state = addrMatch[3];
                result.zip = addrMatch[4];
            } else {
                // Try to find city, state, zip separately
                const cityStateZip = bodyText.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5})/);
                if (cityStateZip) {
                    result.city = cityStateZip[1].trim();
                    result.state = cityStateZip[2];
                    result.zip = cityStateZip[3];
                }
            }

            return result;
        });

        // Extract bar number from URL if not found on page
        if (!data.barNumber) {
            data.barNumber = usrId;
        }

        return data;

    } catch (error) {
        console.log(`     Error scraping profile ${usrId}: ${error.message}`);
        return null;
    }
}

// ============================================================================
// MAIN SCRAPING FUNCTION
// ============================================================================

async function scrapePracticeArea(browser, practiceArea, existingEmails, existingBarNumbers) {
    const { slug, displayName } = practiceArea;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${displayName} (slug: ${slug})`);
    console.log('='.repeat(60));

    const stats = {
        slug,
        displayName,
        totalResults: 0,
        profilesFetched: 0,
        inserted: 0,
        skipped: 0,
        barNumberSkipped: 0,
        emailSkipped: 0,
        noEmail: 0,
        errors: 0
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;
    const allAttorneys = []; // Objects with {licenseNumber, firstName, lastName, city}
    const seenLicenseNumbers = new Set();

    try {
        // Navigate to search results
        const searchUrl = `${SEARCH_URL}?ShowSearchResults=TRUE&EligibleToPractice=Y&AreaOfPractice=${encodeURIComponent(slug)}`;
        console.log(`   URL: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(3000); // Wait for ASP.NET page to render

        // Get total results
        stats.totalResults = await getResultsCount(page);
        console.log(`   Total results: ${stats.totalResults}`);

        if (stats.totalResults === 0) {
            console.log('   No results found - marking as complete (no data available)');
            stats.all_profiles_scraped = true; // Mark as complete so we don't retry
            await page.close();
            return stats;
        }

        // Extract attorneys from all pages (get names from search results, not profile pages)
        let pageNum = 1;
        let hasMore = true;

        while (hasMore && allAttorneys.length < MAX_ATTORNEYS) {
            console.log(`   Page ${pageNum}...`);

            const pageAttorneys = await extractAttorneysFromSearchResults(page);
            console.log(`     Found ${pageAttorneys.length} attorneys on page`);

            // Add new attorneys (dedupe by license number)
            let newOnThisPage = 0;
            for (const attorney of pageAttorneys) {
                if (!seenLicenseNumbers.has(attorney.licenseNumber)) {
                    seenLicenseNumbers.add(attorney.licenseNumber);
                    allAttorneys.push(attorney);
                    if (!existingBarNumbers.has(attorney.licenseNumber)) {
                        newOnThisPage++;
                    }
                }
            }

            if (allAttorneys.length >= MAX_ATTORNEYS) {
                console.log(`     Reached MAX_ATTORNEYS limit`);
                break;
            }

            // Stop paginating if no new bar numbers found after first few pages
            if (newOnThisPage === 0 && pageNum >= 3) {
                console.log(`     No new bar numbers on page ${pageNum}, stopping collection`);
                break;
            }

            // Try to go to next page
            hasMore = await goToNextPage(page);
            pageNum++;

            // Safety limit on pages
            if (pageNum > 100) {
                console.log('     Safety limit: max 100 pages');
                break;
            }
        }

        console.log(`   Total attorneys collected: ${allAttorneys.length}`);

        // Pre-filter: check how many collected attorneys are already known
        if (allAttorneys.length >= 20) {
            const knownCount = allAttorneys.filter(a => existingBarNumbers.has(a.licenseNumber)).length;
            const knownPct = knownCount / allAttorneys.length;
            console.log(`   Pre-filter: ${knownCount}/${allAttorneys.length} (${(knownPct * 100).toFixed(0)}%) already in DB`);

            if (knownPct >= PRE_FILTER_KNOWN_PCT) {
                console.log(`   Skipping profile fetch — area is ${(knownPct * 100).toFixed(0)}% covered`);
                stats.skipped = knownCount;
                stats.barNumberSkipped = knownCount;
                stats.profilesFetched = allAttorneys.length;
                stats.prefilterSkipped = true;
                await page.close();
                return stats;
            }
        }

        // Now fetch each profile to get email, phone, firmName, website
        // Names come from search results (more reliable than profile page extraction)
        console.log(`   Fetching profiles...`);

        let consecutiveNoInsert = 0;

        for (let i = 0; i < allAttorneys.length && i < MAX_ATTORNEYS; i++) {
            // Early exit if no new inserts for a while (practice area mostly covered)
            if (consecutiveNoInsert >= EARLY_EXIT_THRESHOLD) {
                console.log(`     Early exit: ${EARLY_EXIT_THRESHOLD} consecutive profiles with no new inserts`);
                break;
            }

            const attorney = allAttorneys[i];
            const licenseNum = attorney.licenseNumber;
            stats.profilesFetched++;

            // Skip if barNumber already exists in DB (avoids re-fetching profile)
            if (existingBarNumbers.has(licenseNum)) {
                stats.skipped++;
                stats.barNumberSkipped++;
                consecutiveNoInsert++;
                continue;
            }

            try {
                const profile = await scrapeProfile(page, licenseNum);

                if (!profile) {
                    stats.errors++;
                    consecutiveNoInsert++;
                    continue;
                }

                // Skip if no email or invalid format
                // Validate and clean email
                const emailLower = cleanEmail(profile.email);
                if (!emailLower) {
                    stats.noEmail++;
                    consecutiveNoInsert++;
                    continue;
                }

                // Skip if already exists
                if (existingEmails.has(emailLower)) {
                    stats.skipped++;
                    stats.emailSkipped++;
                    consecutiveNoInsert++;
                    continue;
                }

                // Use names from search results (reliable), fall back to profile extraction if needed
                const firstName = attorney.firstName || profile.firstName || '';
                const lastName = attorney.lastName || profile.lastName || '';
                const city = attorney.city || profile.city || '';

                // Create document
                const docData = {
                    firstName: firstName,
                    lastName: lastName,
                    firmName: profile.firmName || (firstName && lastName ? `${firstName} ${lastName}, Attorney at Law` : ''),
                    email: emailLower,
                    phone: profile.phone,
                    website: profile.website,
                    practiceArea: displayName,
                    city: city,
                    state: profile.state || DEFAULT_STATE,
                    source: SOURCE,
                    barNumber: profile.barNumber || licenseNum,
                    memberUrl: `${PROFILE_URL}?Usr_ID=${licenseNum}`,
                    sent: false,
                    status: 'pending',
                    randomIndex: Math.random() * 0.1, // Prioritize in queue
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    // Set domainChecked: false for contacts without websites so infer-websites.js can process them
                    ...(profile.website === '' ? { domainChecked: false } : {})
                };

                // Check for government/institutional contact
                if (isGovernmentContact(docData.email, docData.firmName)) {
                    stats.govt_skipped = (stats.govt_skipped || 0) + 1;
                    consecutiveNoInsert++;
                    continue;
                }

                if (!DRY_RUN) {
                    const docRef = db.collection('preintake_emails').doc();
                    batch.set(docRef, docData);
                    batchCount++;
                }

                existingEmails.add(emailLower);
                existingBarNumbers.add(licenseNum);
                stats.inserted++;
                consecutiveNoInsert = 0; // Reset on successful insert

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`     Committed batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }

                // Progress logging
                if ((i + 1) % 25 === 0) {
                    console.log(`     Processed ${i + 1}/${Math.min(allAttorneys.length, MAX_ATTORNEYS)} (${stats.inserted} inserted)`);
                }

                await sleepWithJitter(DELAY_BETWEEN_PROFILES);

            } catch (error) {
                stats.errors++;
                consecutiveNoInsert++;
                if (stats.errors <= 5) {
                    console.log(`     Error processing ${licenseNum}: ${error.message}`);
                }
            }

        }

        // Commit remaining batch
        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`     Committed final batch of ${batchCount}`);
        }

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped} (${stats.barNumberSkipped} barNum, ${stats.emailSkipped} email), No Email ${stats.noEmail}, Errors ${stats.errors}`);

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
    const areasHtml = summary.practiceAreas.map(a => `
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${a.displayName}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${a.totalResults}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${a.profilesFetched}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${a.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${a.noEmail}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${a.errors}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 750px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Washington State Bar Scrape Report</h1>
    </div>
    <div style="background: #fff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px;">${new Date().toLocaleString()}</p>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Practice Areas Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Practice Area</th>
                <th style="padding: 8px; text-align: center;">Results</th>
                <th style="padding: 8px; text-align: center;">Fetched</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">No Email</th>
                <th style="padding: 8px; text-align: center;">Errors</th>
            </tr>
            ${areasHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">WSBA attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
            <tr><td style="padding: 8px 0;">Practice areas completed:</td><td style="text-align: right;">${summary.progress.scrapedPracticeAreaSlugs.length} / ${PRACTICE_AREAS.length}</td></tr>
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
    console.log('Washington State Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Scraping mywsba.org attorney directory\n');

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    // Load progress
    const progress = await getProgress();
    console.log(`Progress: ${progress.scrapedPracticeAreaSlugs.length}/${PRACTICE_AREAS.length} practice areas complete`);
    console.log(`Total inserted so far: ${progress.totalInserted.toLocaleString()}\n`);

    // Load ALL existing emails (cross-source) for deduplication
    console.log('Loading existing emails and bar numbers...');
    const existingEmails = new Set();
    const existingBarNumbers = new Set();
    const existingSnapshot = await db.collection('preintake_emails')
        .select('email', 'barNumber', 'source')
        .get();
    existingSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email) existingEmails.add(data.email.toLowerCase());
        // Only track bar numbers for WSBA source (bar numbers are source-specific)
        if (data.source === SOURCE && data.barNumber) existingBarNumbers.add(data.barNumber.toString());
    });
    console.log(`Loaded ${existingEmails.size} existing emails (all sources), ${existingBarNumbers.size} WSBA bar numbers\n`);

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
        // Filter to specific practice area if specified
        let areasToScrape = PRACTICE_AREAS;
        if (PRACTICE_AREA_SLUG) {
            areasToScrape = PRACTICE_AREAS.filter(a => a.slug === PRACTICE_AREA_SLUG);
            if (areasToScrape.length === 0) {
                console.log(`Practice area "${PRACTICE_AREA_SLUG}" not found`);
                await browser.close();
                return;
            }
            console.log(`Scraping only: ${PRACTICE_AREA_SLUG}\n`);
        }

        // ================================================================
        // AREA SELECTION: filter to incomplete, non-saturated areas
        // ================================================================
        const incompleteAreas = areasToScrape.filter(a =>
            !progress.scrapedPracticeAreaSlugs.includes(a.slug) &&
            !progress.permanentlySkipped.includes(a.slug)
        );

        // Separate active vs saturated areas
        const activeAreas = [];
        const saturatedRechecks = [];
        const skippedSaturated = [];

        for (const area of incompleteAreas) {
            const status = progress.areaStatus[area.slug];
            if (!status || (status.zeroInsertRuns || 0) < SATURATION_THRESHOLD) {
                activeAreas.push(area);
            } else {
                // Saturated — only include if enough time has passed for a recheck
                const daysSinceLastRun = status.lastRunDate
                    ? (Date.now() - new Date(status.lastRunDate).getTime()) / (1000 * 60 * 60 * 24)
                    : Infinity;
                if (daysSinceLastRun >= SATURATION_RECHECK_DAYS) {
                    saturatedRechecks.push(area);
                } else {
                    skippedSaturated.push(area);
                }
            }
        }

        // Prioritize active areas, then saturated rechecks
        const candidateAreas = [...activeAreas, ...saturatedRechecks];

        // Limit to MAX_PRACTICE_AREAS_PER_RUN (unless specific area requested)
        const areasThisRun = PRACTICE_AREA_SLUG
            ? candidateAreas
            : candidateAreas.slice(0, MAX_PRACTICE_AREAS_PER_RUN);

        console.log(`Area selection: ${activeAreas.length} active, ${saturatedRechecks.length} recheck, ${skippedSaturated.length} saturated (skipped)`);
        console.log(`Processing ${areasThisRun.length} areas this run (max ${MAX_PRACTICE_AREAS_PER_RUN})\n`);

        if (skippedSaturated.length > 0) {
            console.log(`Saturated areas (next recheck in ≤${SATURATION_RECHECK_DAYS}d): ${skippedSaturated.map(a => a.displayName).join(', ')}\n`);
        }

        // ================================================================
        // PROCESS SELECTED AREAS
        // ================================================================
        for (const practiceArea of areasThisRun) {
            // Check if we've hit MAX_ATTORNEYS
            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
            }

            const isSaturatedRecheck = saturatedRechecks.includes(practiceArea);
            if (isSaturatedRecheck) {
                console.log(`\n[RECHECK] ${practiceArea.displayName} (saturated — periodic recheck)`);
            }

            const stats = await scrapePracticeArea(browser, practiceArea, existingEmails, existingBarNumbers);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Only mark practice area complete if we scraped ALL attorneys
            // (not just hit MAX_ATTORNEYS limit mid-way through)
            const scrapedAllAttorneys = stats.profilesFetched >= stats.totalResults ||
                                        stats.totalResults === 0 ||
                                        (stats.inserted + stats.skipped + stats.noEmail + stats.errors) >= stats.totalResults;

            if (scrapedAllAttorneys && !progress.scrapedPracticeAreaSlugs.includes(practiceArea.slug)) {
                progress.scrapedPracticeAreaSlugs.push(practiceArea.slug);
                console.log(`   ✓ Practice area complete (all ${stats.totalResults} attorneys processed)`);
            } else if (!scrapedAllAttorneys) {
                console.log(`   ⏳ Practice area incomplete (${stats.profilesFetched}/${stats.totalResults} processed - will continue next run)`);
            }

            // Update area saturation status
            const areaState = progress.areaStatus[practiceArea.slug] || { zeroInsertRuns: 0 };
            if (stats.inserted === 0) {
                areaState.zeroInsertRuns = (areaState.zeroInsertRuns || 0) + 1;
            } else {
                areaState.zeroInsertRuns = 0; // Reset on any successful insert
            }
            areaState.lastRunDate = new Date().toISOString();
            areaState.lastInserted = stats.inserted;
            areaState.lastProfilesFetched = stats.profilesFetched;
            progress.areaStatus[practiceArea.slug] = areaState;

            if (areaState.zeroInsertRuns >= SATURATION_THRESHOLD) {
                console.log(`   ⚡ Area marked saturated (${areaState.zeroInsertRuns} consecutive zero-insert runs)`);
            }

            // Save progress after each practice area
            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.totalSkipped = (progress.totalSkipped || 0) + stats.skipped;
            progress.lastRunDate = new Date().toISOString();
            progress.runCount = (progress.runCount || 0) + 1;

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            // Delay between practice areas
            await sleepWithJitter(2000);
        }

        // Summary
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        const saturatedCount = Object.values(progress.areaStatus).filter(s => (s.zeroInsertRuns || 0) >= SATURATION_THRESHOLD).length;

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Practice areas scraped this run: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total WSBA in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Practice areas complete: ${progress.scrapedPracticeAreaSlugs.length}/${PRACTICE_AREAS.length}`);
        console.log(`   Practice areas saturated: ${saturatedCount}`);
        console.log(`   Duration: ${duration} minutes`);

        // Save summary
        const summary = {
            run_date: new Date().toISOString(),
            practiceAreas: allStats,
            totalInserted: totalInsertedThisRun,
            totalInDb,
            progress,
            duration: `${duration} minutes`,
            dry_run: DRY_RUN
        };

        fs.writeFileSync(
            path.join(__dirname, 'wsba-scrape-summary.json'),
            JSON.stringify(summary, null, 2)
        );

        // Send email
        await sendNotificationEmail(
            `WSBA: ${totalInsertedThisRun} new attorneys (${progress.scrapedPracticeAreaSlugs.length}/${PRACTICE_AREAS.length} areas)`,
            generateEmailHTML(summary)
        );

        console.log('\n✓ Scrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'WSBA Scrape FAILED',
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
