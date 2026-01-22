#!/usr/bin/env node
/**
 * Missouri Bar Attorney Scraper (Puppeteer)
 *
 * Scrapes attorney contact information from the Missouri Bar website
 * (mobar.org) and imports into preintake_emails collection.
 *
 * Strategy:
 * 1. Navigate to search page with Puppeteer
 * 2. Select practice area from dropdown and submit search
 * 3. Extract attorney profile links from search results
 * 4. Navigate to each profile page to extract email/phone/firm
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-mobar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PRACTICE_AREA - Specific practice area ID to scrape (optional)
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ============================================================================
// PRACTICE AREAS (Missouri Bar dropdown values)
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High-value PreIntake practice areas
    { value: '46', displayName: 'Personal Injury' },
    { value: '40', displayName: 'Immigration Law' },
    { value: '35', displayName: 'Family Law' },
    { value: '11', displayName: 'Bankruptcy' },
    { value: '12', displayName: 'Bankruptcy - Personal' },
    { value: '29', displayName: 'Criminal Law' },
    { value: '5', displayName: "Workers' Comp - Employee" },
    { value: '31', displayName: 'Elder Law' },
    { value: '33', displayName: 'Estate Planning and Trusts' },
    { value: '4', displayName: 'Social Security' },
    { value: '32', displayName: 'Employment Law' },

    // Tier 2: Additional practice areas
    { value: '53', displayName: 'Real Estate' },
    { value: '54', displayName: 'Real Estate - Commercial' },
    { value: '55', displayName: 'Real Estate - Residential' },
    { value: '43', displayName: 'Medical Malpractice' },
    { value: '41', displayName: 'Insurance' },
    { value: '51', displayName: 'Products Liability' },
    { value: '17', displayName: 'Construction' },
    { value: '3', displayName: 'Appeals' },
    { value: '13', displayName: 'Business Law - General' },
    { value: '15', displayName: 'Civil Rights' },
    { value: '30', displayName: 'DWI/DUI' },
    { value: '34', displayName: 'Estate Planning and Trusts - Probate' },
    { value: '39', displayName: 'Health Care' },
    { value: '42', displayName: 'Intellectual Property' },
    { value: '36', displayName: 'Guardianship/Conservatorship' },
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://mobar.org/public';
const SEARCH_URL = `${BASE_URL}/LawyerSearch.aspx`;
const SOURCE = 'mobar';
const DEFAULT_STATE = 'MO';

const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_PROFILES = 1000;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const SPECIFIC_PRACTICE_AREA = process.env.PRACTICE_AREA || null;

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
// HELPERS
// ============================================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sleepWithJitter(baseMs) {
    const jitter = baseMs * 0.3 * (Math.random() * 2 - 1);
    return sleep(Math.max(500, baseMs + jitter));
}

/**
 * Parse name in "Last, First Middle" format
 */
function parseName(nameStr) {
    if (!nameStr) return { firstName: '', lastName: '' };

    // Remove extra whitespace
    nameStr = nameStr.trim().replace(/\s+/g, ' ');

    // Split on comma: "Laurans, Jonathan Louis" -> ["Laurans", "Jonathan Louis"]
    const parts = nameStr.split(',').map(p => p.trim());

    if (parts.length >= 2) {
        const lastName = parts[0];
        const firstNames = parts[1].split(' ');
        const firstName = firstNames[0] || '';
        return { firstName, lastName };
    }

    // No comma, try space-separated (First Last)
    const spaceParts = nameStr.split(' ');
    if (spaceParts.length >= 2) {
        return {
            firstName: spaceParts[0],
            lastName: spaceParts[spaceParts.length - 1]
        };
    }

    return { firstName: nameStr, lastName: '' };
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    if (DRY_RUN) {
        return {
            scrapedPracticeAreaIds: [],
            totalInserted: 0,
            totalSkipped: 0,
            failedAttempts: {},
            permanentlySkipped: [],
            lastRunDate: null
        };
    }

    const progressRef = db.collection('preintake_scrape_progress').doc('mobar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            scrapedPracticeAreaIds: [],
            totalInserted: 0,
            totalSkipped: 0,
            failedAttempts: {},
            permanentlySkipped: [],
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        scrapedPracticeAreaIds: data.scrapedPracticeAreaIds || [],
        totalInserted: data.totalInserted || 0,
        totalSkipped: data.totalSkipped || 0,
        failedAttempts: data.failedAttempts || {},
        permanentlySkipped: data.permanentlySkipped || [],
        lastRunDate: data.lastRunDate || null
    };
}

async function saveProgress(progress) {
    if (DRY_RUN) return;

    const progressRef = db.collection('preintake_scrape_progress').doc('mobar');
    await progressRef.set({
        ...progress,
        lastRunDate: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function loadExistingEmails() {
    const emails = new Set();

    try {
        const snapshot = await db.collection('preintake_emails')
            .select('email')
            .get();

        snapshot.forEach(doc => {
            const email = doc.data().email;
            if (email) emails.add(email.toLowerCase());
        });
    } catch (err) {
        console.error('Error loading existing emails:', err.message);
    }

    return emails;
}

/**
 * Load existing MoBar member IDs for efficient skip-before-fetch
 * Using email as unique identifier since MoBar doesn't show bar numbers on profile
 */
async function loadExistingMoBarEmails() {
    const mobarEmails = new Set();
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'mobar')
            .select('email')
            .get();
        snapshot.forEach(doc => {
            const email = doc.data().email;
            if (email) mobarEmails.add(email.toLowerCase());
        });
    } catch (err) {
        console.error('Error loading existing MoBar emails:', err.message);
    }
    return mobarEmails;
}

async function getTotalInDb() {
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'mobar')
            .count()
            .get();
        return snapshot.data().count;
    } catch (err) {
        console.error('Error counting attorneys:', err.message);
        return 0;
    }
}

async function insertAttorney(attorney, existingEmails) {
    // Validate email exists and has proper format (contains @ and .)
    if (!attorney.email || !attorney.email.includes('@') || !attorney.email.includes('.')) {
        return { success: false, reason: 'no_email' };
    }

    const emailLower = attorney.email.toLowerCase();
    if (existingEmails.has(emailLower)) {
        return { success: false, reason: 'duplicate' };
    }

    if (DRY_RUN) {
        existingEmails.add(emailLower);
        return { success: true, dryRun: true };
    }

    try {
        const docData = {
            firstName: attorney.firstName || '',
            lastName: attorney.lastName || '',
            firmName: attorney.firmName || '',
            email: emailLower,
            phone: attorney.phone || '',
            website: attorney.website || '',
            practiceArea: attorney.practiceArea || '',
            city: attorney.city || '',
            state: attorney.state || DEFAULT_STATE,
            source: SOURCE,
            memberUrl: attorney.memberUrl || '',
            sent: false,
            status: 'pending',
            randomIndex: Math.random() * 0.1,  // Prioritize in email queue
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('preintake_emails').add(docData);
        existingEmails.add(emailLower);
        return { success: true };
    } catch (err) {
        return { success: false, reason: 'db_error', error: err.message };
    }
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================

/**
 * Count the number of result rows in GridView1
 */
async function getResultCount(page) {
    return await page.evaluate(() => {
        const grid = document.querySelector('#ctl00_store_GridView1');
        if (!grid) return 0;
        // Count data rows (skip header row)
        const rows = grid.querySelectorAll('tr');
        // First row is header, rest are data
        return Math.max(0, rows.length - 1);
    });
}

/**
 * Extract attorney details from FormView1 (profile section on same page)
 * MoBar uses: <strong style="">Field: </strong>Value pattern
 */
async function extractProfileData(page) {
    return await page.evaluate(() => {
        const data = {
            firstName: '',
            lastName: '',
            fullName: '',
            email: '',
            phone: '',
            firmName: '',
            city: '',
            state: 'MO',
            website: '',
            practiceAreas: []
        };

        // Get name from h4 inside FormView1: "Last, First Middle"
        const formView = document.querySelector('#ctl00_store_FormView1');
        if (!formView) return data;

        const nameEl = formView.querySelector('h4');
        if (nameEl) {
            data.fullName = nameEl.textContent.trim();
        }

        // Helper to get value after a label within FormView1
        function getFieldValue(labelText) {
            const strongs = formView.querySelectorAll('strong');
            for (const strong of strongs) {
                if (strong.textContent.toLowerCase().includes(labelText.toLowerCase())) {
                    // Get the next sibling text or next element
                    let next = strong.nextSibling;
                    while (next) {
                        if (next.nodeType === Node.TEXT_NODE && next.textContent.trim()) {
                            return next.textContent.trim();
                        }
                        if (next.nodeType === Node.ELEMENT_NODE) {
                            if (next.tagName === 'STRONG') {
                                return next.textContent.trim();
                            }
                            if (next.tagName === 'A') {
                                return next.textContent.trim();
                            }
                            if (next.tagName === 'BR') {
                                next = next.nextSibling;
                                continue;
                            }
                            return next.textContent.trim();
                        }
                        next = next.nextSibling;
                    }
                }
            }
            return '';
        }

        // Get firm name
        data.firmName = getFieldValue('firm:');

        // Get phone
        data.phone = getFieldValue('phone number:');

        // Get email from mailto link within FormView1
        const emailLink = formView.querySelector('a[href^="mailto:"]');
        if (emailLink) {
            data.email = emailLink.href.replace('mailto:', '').toLowerCase().trim();
        }

        // Get website - look for link after "Website:" label
        const strongs = formView.querySelectorAll('strong');
        for (const strong of strongs) {
            if (strong.textContent.toLowerCase().includes('website:')) {
                let next = strong.nextElementSibling;
                while (next) {
                    if (next.tagName === 'A' && next.href && next.href.startsWith('http')) {
                        data.website = next.href;
                        break;
                    }
                    next = next.nextElementSibling;
                }
                break;
            }
        }

        // Get city from address - look for "City, MO, ZIP" pattern
        // The address block has multiple <br> separated lines, with city on one line
        const formText = formView.innerText;
        // Split into lines and find the one with MO + ZIP code pattern
        const lines = formText.split(/\n/).map(l => l.trim()).filter(l => l);
        for (const line of lines) {
            // Match patterns like "Kansas City, MO, 64114" or "St. Louis, MO 63101"
            const cityMatch = line.match(/^([A-Za-z\s.]+),\s*MO[,\s]+\d{5}/);
            if (cityMatch) {
                data.city = cityMatch[1].trim();
                break;
            }
        }

        // Get practice areas from list
        const practiceAreasList = formView.querySelector('#ctl00_store_FormView1_blCategories');
        if (practiceAreasList) {
            const items = practiceAreasList.querySelectorAll('li');
            items.forEach(li => {
                const area = li.textContent.trim();
                if (area) data.practiceAreas.push(area);
            });
        }

        return data;
    });
}

/**
 * Scrape a single practice area using MoBar's GridView/FormView pattern
 * 1. Submit search with practice area
 * 2. Results appear in GridView1 table
 * 3. Click "Select" on each row to load profile in FormView1
 * 4. Extract data from FormView1
 */
async function scrapePracticeArea(browser, practiceArea, existingEmails, existingMoBarEmails, progress) {
    const { value, displayName } = practiceArea;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${displayName} (value: ${value})`);
    console.log('='.repeat(60));

    const stats = {
        practiceAreaId: value,
        displayName: displayName,
        totalResults: 0,
        profilesFetched: 0,
        inserted: 0,
        skipped: 0,
        skippedExisting: 0,
        noEmail: 0,
        errors: 0,
        all_attorneys_scraped: false
    };

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        // Navigate to search page
        console.log(`   Navigating to search page...`);
        await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(2000);

        // Select practice area from dropdown
        console.log(`   Selecting practice area: ${displayName}`);
        await page.select('#ctl00_store_ddlPractice', value);
        await sleep(1000);

        // Click search button
        const searchButton = await page.$('#ctl00_store_btnSearch');
        if (searchButton) {
            await searchButton.click();
        } else {
            // Try alternative selectors
            const altButton = await page.$('input[type="submit"][value*="Search"]');
            if (altButton) {
                await altButton.click();
            }
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
        await sleep(DELAY_BETWEEN_PAGES);

        // Count results in GridView1
        const resultCount = await getResultCount(page);
        stats.totalResults = resultCount;
        console.log(`   Found ${resultCount} attorneys in GridView`);

        if (resultCount === 0) {
            // Check if truly no results
            const noResultsText = await page.evaluate(() => document.body.innerText);
            if (noResultsText.includes('No results') || noResultsText.includes('0 records') || noResultsText.includes('No members found')) {
                console.log(`   No results found for ${displayName}`);
                stats.all_attorneys_scraped = true;
                await page.close();
                return stats;
            }
            console.log(`   GridView1 not found or empty`);
            stats.all_attorneys_scraped = true;
            await page.close();
            return stats;
        }

        // Process each row by clicking "Select" and extracting from FormView1
        let processedCount = 0;
        const processedEmails = new Set(); // Track emails processed this session

        for (let rowIndex = 0; rowIndex < resultCount && processedCount < MAX_ATTORNEYS; rowIndex++) {
            try {
                // Click the "Select" link for this row (skip header row, so data rows start at index 1)
                const clicked = await page.evaluate((rowIdx) => {
                    const grid = document.querySelector('#ctl00_store_GridView1');
                    if (!grid) return false;

                    const rows = grid.querySelectorAll('tr');
                    // Row 0 is header, data rows start at 1
                    const dataRowIndex = rowIdx + 1;
                    if (dataRowIndex >= rows.length) return false;

                    const row = rows[dataRowIndex];
                    const selectLink = row.querySelector('a');
                    if (selectLink && selectLink.textContent.trim() === 'Select') {
                        selectLink.click();
                        return true;
                    }
                    return false;
                }, rowIndex);

                if (!clicked) {
                    stats.errors++;
                    continue;
                }

                // Wait for the page to update (FormView1 will be populated)
                await sleep(DELAY_BETWEEN_PROFILES);
                await page.waitForSelector('#ctl00_store_FormView1 h4', { timeout: 10000 }).catch(() => {});

                // Extract profile data from FormView1
                const profile = await extractProfileData(page);

                if (!profile.email) {
                    stats.noEmail++;
                    continue;
                }

                // Skip if already processed in this session
                if (processedEmails.has(profile.email.toLowerCase())) {
                    continue;
                }
                processedEmails.add(profile.email.toLowerCase());

                // Skip if already in database
                if (existingMoBarEmails.has(profile.email.toLowerCase())) {
                    stats.skippedExisting++;
                    continue;
                }

                processedCount++;
                stats.profilesFetched++;

                // Parse name
                const { firstName, lastName } = parseName(profile.fullName);

                const attorneyData = {
                    firstName,
                    lastName,
                    email: profile.email.toLowerCase(),
                    phone: profile.phone || '',
                    firmName: profile.firmName || '',
                    city: profile.city || '',
                    state: DEFAULT_STATE,
                    website: profile.website || '',
                    practiceArea: displayName,
                    memberUrl: SEARCH_URL
                };

                // Insert into database
                const result = await insertAttorney(attorneyData, existingEmails);
                if (result.success) {
                    stats.inserted++;
                    existingMoBarEmails.add(profile.email.toLowerCase());
                    if (stats.inserted % 10 === 0) {
                        console.log(`   Progress: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.skippedExisting} existing`);
                    }
                } else {
                    stats.skipped++;
                }

            } catch (err) {
                console.error(`   Error processing row ${rowIndex}:`, err.message);
                stats.errors++;
            }
        }

        // Check for pagination - look for page number links in the GridView
        let hasMorePages = true;
        let currentPage = 1;

        while (hasMorePages && processedCount < MAX_ATTORNEYS) {
            // Look for next page link (usually "2", "3", or "..." or ">")
            const nextPageExists = await page.evaluate((currentPage) => {
                const grid = document.querySelector('#ctl00_store_GridView1');
                if (!grid) return false;

                // Look for pager row with page numbers
                const pagerRow = grid.querySelector('tr.pager, tr:last-child');
                if (!pagerRow) return false;

                // Look for a link to the next page
                const nextNum = currentPage + 1;
                const links = pagerRow.querySelectorAll('a');
                for (const link of links) {
                    const text = link.textContent.trim();
                    if (text === String(nextNum) || text === '>' || text === '...') {
                        return true;
                    }
                }
                return false;
            }, currentPage);

            if (!nextPageExists) {
                hasMorePages = false;
                break;
            }

            currentPage++;
            console.log(`   Navigating to page ${currentPage}...`);

            try {
                // Click the next page link
                await page.evaluate((nextPage) => {
                    const grid = document.querySelector('#ctl00_store_GridView1');
                    if (!grid) return;

                    const pagerRow = grid.querySelector('tr.pager, tr:last-child');
                    if (!pagerRow) return;

                    const links = pagerRow.querySelectorAll('a');
                    for (const link of links) {
                        const text = link.textContent.trim();
                        if (text === String(nextPage)) {
                            link.click();
                            return;
                        }
                    }
                    // Try ">" link
                    for (const link of links) {
                        if (link.textContent.trim() === '>') {
                            link.click();
                            return;
                        }
                    }
                }, currentPage);

                await sleep(DELAY_BETWEEN_PAGES);
                await page.waitForSelector('#ctl00_store_GridView1', { timeout: 10000 }).catch(() => {});

                // Get new result count for this page
                const pageResultCount = await getResultCount(page);
                console.log(`   Found ${pageResultCount} attorneys on page ${currentPage}`);

                // Process each row on this page
                for (let rowIndex = 0; rowIndex < pageResultCount && processedCount < MAX_ATTORNEYS; rowIndex++) {
                    try {
                        // Click the "Select" link for this row (skip header row, so data rows start at index 1)
                        const clicked = await page.evaluate((rowIdx) => {
                            const grid = document.querySelector('#ctl00_store_GridView1');
                            if (!grid) return false;

                            const rows = grid.querySelectorAll('tr');
                            // Row 0 is header, data rows start at 1
                            const dataRowIndex = rowIdx + 1;
                            if (dataRowIndex >= rows.length) return false;

                            const row = rows[dataRowIndex];
                            const selectLink = row.querySelector('a');
                            if (selectLink && selectLink.textContent.trim() === 'Select') {
                                selectLink.click();
                                return true;
                            }
                            return false;
                        }, rowIndex);

                        if (!clicked) {
                            stats.errors++;
                            continue;
                        }

                        await sleep(DELAY_BETWEEN_PROFILES);
                        await page.waitForSelector('#ctl00_store_FormView1 h4', { timeout: 10000 }).catch(() => {});

                        const profile = await extractProfileData(page);

                        if (!profile.email) {
                            stats.noEmail++;
                            continue;
                        }

                        if (processedEmails.has(profile.email.toLowerCase())) {
                            continue;
                        }
                        processedEmails.add(profile.email.toLowerCase());

                        if (existingMoBarEmails.has(profile.email.toLowerCase())) {
                            stats.skippedExisting++;
                            continue;
                        }

                        processedCount++;
                        stats.profilesFetched++;

                        const { firstName, lastName } = parseName(profile.fullName);

                        const attorneyData = {
                            firstName,
                            lastName,
                            email: profile.email.toLowerCase(),
                            phone: profile.phone || '',
                            firmName: profile.firmName || '',
                            city: profile.city || '',
                            state: DEFAULT_STATE,
                            website: profile.website || '',
                            practiceArea: displayName,
                            memberUrl: SEARCH_URL
                        };

                        const result = await insertAttorney(attorneyData, existingEmails);
                        if (result.success) {
                            stats.inserted++;
                            existingMoBarEmails.add(profile.email.toLowerCase());
                        } else {
                            stats.skipped++;
                        }

                    } catch (err) {
                        stats.errors++;
                    }
                }

            } catch (err) {
                console.log(`   No more pages or pagination error: ${err.message}`);
                hasMorePages = false;
            }
        }

        // Track if all attorneys were scraped
        stats.all_attorneys_scraped = processedCount >= stats.totalResults || processedCount < MAX_ATTORNEYS;

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped}, SkippedExisting ${stats.skippedExisting}, NoEmail ${stats.noEmail}, Errors ${stats.errors}`);

    } catch (err) {
        console.error(`   Error scraping ${displayName}:`, err.message);
        stats.errors++;
    }

    await page.close();
    return stats;
}

// ============================================================================
// EMAIL NOTIFICATION
// ============================================================================

async function sendNotificationEmail(summary) {
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

    const subject = DRY_RUN
        ? '[DRY RUN] Missouri Bar Scraper Complete'
        : `Missouri Bar Scraper: ${summary.totalInserted} new attorneys`;

    const html = `
        <h2>Missouri Bar Attorney Scraper Summary</h2>
        ${DRY_RUN ? '<p style="color: orange; font-weight: bold;">*** DRY RUN - No data written ***</p>' : ''}
        <table style="border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Practice Areas Scraped</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.practiceAreasScraped}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Profiles Fetched</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalProfilesFetched}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Inserted</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Skipped (Duplicate)</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalSkipped}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Skipped (Existing)</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalSkippedExisting}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>No Email</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalNoEmail}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total MoBar in DB</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalInDb}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">Timestamp: ${new Date().toISOString()}</p>
    `;

    try {
        await transporter.sendMail({
            from: 'Stephen Scott <stephen@preintake.ai>',
            to: 'scscot@gmail.com',
            subject,
            html
        });
        console.log('Notification email sent');
    } catch (err) {
        console.error('Failed to send notification email:', err.message);
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('Missouri Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log(`Scraping mobar.org by practice area`);
    console.log();

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    const progress = await getProgress();
    console.log(`Progress: ${progress.scrapedPracticeAreaIds.length}/${PRACTICE_AREAS.length} practice areas complete`);
    console.log(`Total inserted so far: ${progress.totalInserted}\n`);

    console.log('Loading existing emails...');
    const existingEmails = await loadExistingEmails();
    console.log(`Loaded ${existingEmails.size} existing emails`);

    console.log('Loading existing MoBar emails...');
    const existingMoBarEmails = await loadExistingMoBarEmails();
    console.log(`Loaded ${existingMoBarEmails.size} existing MoBar emails\n`);

    console.log('Launching browser...\n');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const allStats = [];
    let totalInsertedThisRun = 0;

    try {
        // Determine which practice areas to scrape
        let practiceAreasToScrape;
        if (SPECIFIC_PRACTICE_AREA) {
            const area = PRACTICE_AREAS.find(a => a.value === SPECIFIC_PRACTICE_AREA);
            if (!area) {
                console.error(`Unknown practice area: ${SPECIFIC_PRACTICE_AREA}`);
                console.error(`Valid options: ${PRACTICE_AREAS.map(a => `${a.value} (${a.displayName})`).join(', ')}`);
                process.exit(1);
            }
            practiceAreasToScrape = [area];
        } else {
            // Filter out already scraped and permanently skipped
            practiceAreasToScrape = PRACTICE_AREAS.filter(area =>
                !progress.scrapedPracticeAreaIds.includes(area.value) &&
                !progress.permanentlySkipped.includes(area.value)
            );
        }

        console.log(`Practice areas to scrape: ${practiceAreasToScrape.length}`);

        for (const practiceArea of practiceAreasToScrape) {
            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS}), stopping.`);
                break;
            }

            const stats = await scrapePracticeArea(browser, practiceArea, existingEmails, existingMoBarEmails, progress);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Update progress
            progress.totalInserted += stats.inserted;
            progress.totalSkipped += stats.skipped;

            // Mark practice area complete only if ALL attorneys were scraped
            if (stats.all_attorneys_scraped && !progress.scrapedPracticeAreaIds.includes(practiceArea.value)) {
                progress.scrapedPracticeAreaIds.push(practiceArea.value);
                console.log(`   ✓ Practice area ${practiceArea.displayName} marked as complete`);
            } else if (!stats.all_attorneys_scraped) {
                console.log(`   ⚠ Practice area ${practiceArea.displayName} NOT marked complete (hit MAX_ATTORNEYS limit)`);
            }

            await saveProgress(progress);
        }

    } catch (err) {
        console.error('Fatal error:', err);
    }

    await browser.close();

    // Summary
    const totalInDb = DRY_RUN ? totalInsertedThisRun : await getTotalInDb();

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Practice areas scraped: ${allStats.length}`);
    console.log(`   Profiles fetched: ${allStats.reduce((sum, s) => sum + s.profilesFetched, 0)}`);
    console.log(`   Inserted this run: ${totalInsertedThisRun}`);
    console.log(`   Total MoBar in DB: ${totalInDb}`);
    console.log(`   Progress: ${progress.scrapedPracticeAreaIds.length}/${PRACTICE_AREAS.length} practice areas complete`);

    // Send notification
    await sendNotificationEmail({
        practiceAreasScraped: allStats.length,
        totalProfilesFetched: allStats.reduce((sum, s) => sum + s.profilesFetched, 0),
        totalInserted: totalInsertedThisRun,
        totalSkipped: allStats.reduce((sum, s) => sum + s.skipped, 0),
        totalSkippedExisting: allStats.reduce((sum, s) => sum + s.skippedExisting, 0),
        totalNoEmail: allStats.reduce((sum, s) => sum + s.noEmail, 0),
        totalInDb
    });

    // Write summary for GitHub Actions
    const summaryPath = path.join(__dirname, 'mobar-scrape-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        practiceAreasScraped: allStats.length,
        totalInserted: totalInsertedThisRun,
        totalInDb,
        progress: {
            scrapedPracticeAreaIds: progress.scrapedPracticeAreaIds,
            totalInserted: progress.totalInserted
        },
        dryRun: DRY_RUN
    }, null, 2));

    console.log('\n✓ Scrape complete!');
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
