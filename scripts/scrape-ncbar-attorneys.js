#!/usr/bin/env node
/**
 * North Carolina State Bar Attorney Scraper (Puppeteer)
 *
 * Scrapes attorney contact information from the NC State Bar website
 * (portal.ncbar.gov) and imports into preintake_emails collection.
 *
 * Strategy: Last-name prefix approach
 * 1. Search by 2-letter last name prefixes (AA-ZZ = 676 combinations)
 * 2. If a prefix returns 250 results (server cap), subdivide to 3-letter prefixes
 * 3. Extract attorney IDs from search results
 * 4. Navigate to each profile page to extract email/phone/firm
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-ncbar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
 *   MAX_COMBOS - Maximum prefix combinations to process per run (default: 50)
 *   DRY_RUN - If "true", don't write to Firestore
 *   RESET_PROGRESS - If "true", reset scrape progress for fresh start
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
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://portal.ncbar.gov';
const SEARCH_URL = `${BASE_URL}/verification/search.aspx`;
const PROFILE_URL = `${BASE_URL}/Verification/viewer.aspx`;
const SOURCE = 'ncbar';
const DEFAULT_STATE = 'NC';

const RESULTS_CAP = 250;  // NC Bar server-side limit per search
const DELAY_BETWEEN_PAGES = 2000;
const DELAY_BETWEEN_PROFILES = 1000;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const MAX_COMBOS = parseInt(process.env.MAX_COMBOS) || 50;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESET_PROGRESS = process.env.RESET_PROGRESS === 'true';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Generate all 2-letter prefixes (AA through ZZ = 676 combinations)
 */
function generateAllPrefixes() {
    const prefixes = [];
    for (const first of LETTERS) {
        for (const second of LETTERS) {
            prefixes.push(first + second);
        }
    }
    return prefixes;
}

const ALL_PREFIXES = generateAllPrefixes();

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

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function getProgress() {
    if (RESET_PROGRESS) {
        console.log('*** RESET_PROGRESS enabled - clearing all progress ***');
        if (!DRY_RUN) {
            const progressRef = db.collection('preintake_scrape_progress').doc('ncbar');
            await progressRef.delete();
        }
        return {
            completedPrefixes: [],
            prefixesNeedingSubdivision: [],
            completedSubPrefixes: {},
            totalInserted: 0,
            lastRunDate: null
        };
    }

    if (DRY_RUN) {
        return {
            completedPrefixes: [],
            prefixesNeedingSubdivision: [],
            completedSubPrefixes: {},
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const progressRef = db.collection('preintake_scrape_progress').doc('ncbar');
    const doc = await progressRef.get();

    if (!doc.exists) {
        return {
            completedPrefixes: [],
            prefixesNeedingSubdivision: [],
            completedSubPrefixes: {},
            totalInserted: 0,
            lastRunDate: null
        };
    }

    const data = doc.data();
    return {
        completedPrefixes: data.completedPrefixes || [],
        prefixesNeedingSubdivision: data.prefixesNeedingSubdivision || [],
        completedSubPrefixes: data.completedSubPrefixes || {},
        totalInserted: data.totalInserted || 0,
        lastRunDate: data.lastRunDate || null
    };
}

async function saveProgress(progress) {
    if (DRY_RUN) return;

    const progressRef = db.collection('preintake_scrape_progress').doc('ncbar');
    await progressRef.set({
        ...progress,
        lastRunDate: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Get the next scrape target: either a prefix needing 3-letter subdivision,
 * or the next unprocessed 2-letter prefix.
 * Returns: { prefix: 'SM' or 'SMA', isSubPrefix: boolean } or null if all done.
 */
function getNextTarget(progress) {
    // First: process prefixes already in subdivision queue (incomplete 3-letter sub-prefixes)
    for (const prefix of progress.prefixesNeedingSubdivision) {
        const completedSubs = progress.completedSubPrefixes[prefix] || [];
        for (const letter of LETTERS) {
            const subPrefix = prefix + letter;
            if (!completedSubs.includes(subPrefix)) {
                return { prefix: subPrefix, parentPrefix: prefix, isSubPrefix: true };
            }
        }
        // All 26 sub-prefixes done for this prefix - it will be moved to completed in main loop
    }

    // Then: process next unprocessed 2-letter prefix
    for (const prefix of ALL_PREFIXES) {
        if (!progress.completedPrefixes.includes(prefix) &&
            !progress.prefixesNeedingSubdivision.includes(prefix)) {
            return { prefix, parentPrefix: null, isSubPrefix: false };
        }
    }

    return null; // All done!
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
 * Load existing NC Bar member IDs for efficient skip-before-fetch
 */
async function loadExistingMemberIds() {
    const memberIds = new Set();
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'ncbar')
            .select('barNumber')
            .get();
        snapshot.forEach(doc => {
            const id = doc.data().barNumber;
            if (id) memberIds.add(id.toString());
        });
    } catch (err) {
        console.error('Error loading existing member IDs:', err.message);
    }
    return memberIds;
}

async function getTotalInDb() {
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'ncbar')
            .count()
            .get();
        return snapshot.data().count;
    } catch (err) {
        console.error('Error counting attorneys:', err.message);
        return 0;
    }
}

async function insertAttorney(attorney, existingEmails) {
    // Validate and clean email
    const emailLower = cleanEmail(attorney.email);
    if (!emailLower) {
        return { success: false, reason: 'no_email' };
    }
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
            barNumber: attorney.barNumber,
            memberUrl: `${PROFILE_URL}?ID=${attorney.barNumber}`,
            sent: false,
            status: 'pending',
            randomIndex: Math.random() * 0.1,  // Prioritize in email queue
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Check for government/institutional contact
        if (isGovernmentContact(docData.email, docData.firmName)) {
            return { success: false, reason: 'government_contact' };
        }

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
 * Extract attorney IDs from search results page
 */
async function extractAttorneyIds(page) {
    return await page.evaluate(() => {
        const ids = [];
        // Look for links to viewer.aspx?ID=xxx
        document.querySelectorAll('a[href*="viewer.aspx?ID="]').forEach(link => {
            const match = link.href.match(/ID=(\d+)/i);
            if (match) {
                ids.push(match[1]);
            }
        });
        return [...new Set(ids)]; // Dedupe
    });
}

/**
 * Extract attorney details from profile page
 * NC Bar uses <dl class="dl-horizontal"> structure with <dt> labels and <dd> values
 */
async function extractProfileData(page, memberId) {
    return await page.evaluate((memberId) => {
        const data = {
            barNumber: memberId,
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            firmName: '',
            city: '',
            state: 'NC',
            website: ''
        };

        // Helper to get value from dt/dd pair
        function getDdValue(dtText) {
            const dts = document.querySelectorAll('dt');
            for (const dt of dts) {
                if (dt.textContent.trim().toLowerCase().includes(dtText.toLowerCase())) {
                    const dd = dt.nextElementSibling;
                    if (dd && dd.tagName === 'DD') {
                        return dd.textContent.trim();
                    }
                }
            }
            return '';
        }

        // Get name from panel heading: "Mr. Brian Charles Behr - Attorney"
        const panelHeading = document.querySelector('.panel-heading');
        if (panelHeading) {
            let fullName = panelHeading.textContent.trim();
            // Remove title prefixes and " - Attorney" suffix
            fullName = fullName.replace(/\s*-\s*(Attorney|Judge|Corporation).*$/i, '').trim();
            fullName = fullName.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim();

            const nameParts = fullName.split(/\s+/);
            if (nameParts.length >= 2) {
                data.firstName = nameParts[0];
                // Handle names with suffixes like "Jr.", "III"
                const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];
                let lastIdx = nameParts.length - 1;
                if (suffixes.includes(nameParts[lastIdx].toLowerCase())) {
                    lastIdx--;
                }
                data.lastName = nameParts[lastIdx] || nameParts[nameParts.length - 1];
            }
        }

        // Extract fields from dl-horizontal structure
        data.email = getDdValue('email').toLowerCase();
        data.phone = getDdValue('work phone') || getDdValue('phone');
        data.city = getDdValue('city');

        const stateVal = getDdValue('state');
        if (stateVal) data.state = stateVal;

        // Get Bar # for verification (the actual Bar number displayed)
        const barNumVal = getDdValue('bar #') || getDdValue('bar#');
        if (barNumVal) data.barNumber = barNumVal;

        // Get firm name from Address field (often contains employer name)
        const address = getDdValue('address');
        if (address) {
            // First line of address is often the firm name
            const lines = address.split('\n').filter(l => l.trim());
            if (lines.length > 0 && !lines[0].match(/^\d/)) {
                // If first line doesn't start with a number, it might be firm name
                data.firmName = lines[0].trim();
            }
        }

        // Look for external website links (not ncbar.gov links)
        const links = document.querySelectorAll('a[href^="http"]');
        for (const link of links) {
            const href = link.href;
            if (!href.includes('ncbar.gov') &&
                !href.includes('nclawspecialists.gov') &&
                !href.includes('mailto:') &&
                (href.includes('law') || href.includes('firm') || href.includes('attorney'))) {
                data.website = href;
                break;
            }
        }

        return data;
    }, memberId);
}

/**
 * Scrape a single last-name prefix search
 */
async function scrapePrefix(browser, target, existingEmails, existingMemberIds) {
    const { prefix, isSubPrefix } = target;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping prefix: "${prefix}" ${isSubPrefix ? '(3-letter subdivision)' : ''}`);
    console.log('='.repeat(60));

    const stats = {
        prefix,
        isSubPrefix,
        parentPrefix: target.parentPrefix,
        totalResults: 0,
        profilesFetched: 0,
        inserted: 0,
        skipped: 0,
        skippedExisting: 0,
        noEmail: 0,
        errors: 0,
        hit_cap: false
    };

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        // Navigate to search page
        console.log(`   Navigating to search page...`);
        await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(2000);

        // Fill in search form
        console.log(`   Entering last name prefix: "${prefix}"`);

        // Clear and type last name prefix
        await page.$eval('#txtLast', el => el.value = '');
        await page.type('#txtLast', prefix);

        // Select "Active" member status
        await page.select('#ddLicStatus', 'Active');
        await sleep(500);

        // Select "Attorney" member type
        await page.select('#ddLicType', 'Attorney');
        await sleep(500);

        // Find and click search button
        const searchButton = await page.$('input[type="submit"][value*="Search"], button[type="submit"], #btnSearch, input[name*="btnSearch"]');
        if (!searchButton) {
            // Try finding by text content
            const buttons = await page.$$('input[type="submit"], button');
            let clicked = false;
            for (const btn of buttons) {
                const text = await page.evaluate(el => el.value || el.textContent, btn);
                if (text && text.toLowerCase().includes('search')) {
                    await btn.click();
                    clicked = true;
                    break;
                }
            }
            if (!clicked) {
                console.log(`   WARNING: Could not find search button`);
                await page.close();
                return stats;
            }
        } else {
            await searchButton.click();
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
        await sleep(DELAY_BETWEEN_PAGES);

        // Check for results
        const pageText = await page.evaluate(() => document.body.innerText);

        // Check if no results
        if (pageText.includes('No results found') || pageText.includes('0 results') || pageText.includes('no records found')) {
            console.log(`   No results found for prefix "${prefix}"`);
            await page.close();
            return stats;
        }

        // Extract attorney IDs from results
        const attorneyIds = await extractAttorneyIds(page);
        stats.totalResults = attorneyIds.length;
        console.log(`   Found ${attorneyIds.length} attorneys`);

        if (attorneyIds.length === 0) {
            console.log(`   No attorney links found`);
            await page.close();
            return stats;
        }

        // Detect if we hit the server cap
        if (attorneyIds.length >= RESULTS_CAP) {
            stats.hit_cap = true;
            if (!isSubPrefix) {
                console.log(`   ⚠ Hit ${RESULTS_CAP}-result cap for "${prefix}" - will subdivide to 3-letter prefixes`);
            }
        }

        // Process each attorney
        let processedCount = 0;
        for (const memberId of attorneyIds) {
            if (processedCount >= MAX_ATTORNEYS) break;

            // Skip if already in database
            if (existingMemberIds.has(memberId.toString())) {
                stats.skippedExisting++;
                continue;
            }

            processedCount++;
            stats.profilesFetched++;

            try {
                // Navigate to profile page
                const profileUrl = `${PROFILE_URL}?ID=${memberId}`;
                await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await sleepWithJitter(DELAY_BETWEEN_PROFILES);

                // Check for error page
                const profileText = await page.evaluate(() => document.body.innerText);
                if (profileText.includes('error') && profileText.includes('try your request again')) {
                    stats.errors++;
                    continue;
                }

                // Extract profile data
                const attorneyData = await extractProfileData(page, memberId);

                if (!attorneyData.email) {
                    stats.noEmail++;
                    continue;
                }

                // Insert into database
                const result = await insertAttorney(attorneyData, existingEmails);
                if (result.success) {
                    stats.inserted++;
                    existingMemberIds.add(memberId.toString());
                    if (stats.inserted % 10 === 0) {
                        console.log(`   Progress: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.skippedExisting} existing`);
                    }
                } else {
                    stats.skipped++;
                }

            } catch (err) {
                console.error(`   Error fetching profile ${memberId}:`, err.message);
                stats.errors++;
            }
        }

        console.log(`   Done: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.skippedExisting} existing, ${stats.noEmail} noEmail, ${stats.errors} errors`);

    } catch (err) {
        console.error(`   Error scraping prefix "${prefix}":`, err.message);
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
        ? '[DRY RUN] NC Bar Scraper Complete'
        : `NC Bar Scraper: ${summary.totalInserted} new attorneys`;

    const html = `
        <h2>North Carolina Bar Attorney Scraper Summary</h2>
        ${DRY_RUN ? '<p style="color: orange; font-weight: bold;">*** DRY RUN - No data written ***</p>' : ''}
        <table style="border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Strategy</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">Last-name prefix (2-letter → 3-letter subdivision)</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Prefixes Scraped</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.prefixesScraped}</td></tr>
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
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total NC Bar in DB</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.totalInDb}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Prefixes Complete</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.completedPrefixes}/${ALL_PREFIXES.length}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Needing Subdivision</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${summary.needingSubdivision}</td></tr>
        </table>
        <p style="color: #666; font-size: 12px;">Duration: ${summary.duration} | Timestamp: ${new Date().toISOString()}</p>
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
    console.log('North Carolina Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Strategy: Last-name prefix search (2-letter → 3-letter subdivision)');
    console.log(`Max combos per run: ${MAX_COMBOS}`);
    console.log(`Max attorneys per run: ${MAX_ATTORNEYS}`);
    console.log(`Results cap (server-side): ${RESULTS_CAP}\n`);

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    const progress = await getProgress();
    console.log(`Progress: ${progress.completedPrefixes.length}/${ALL_PREFIXES.length} prefixes complete`);
    console.log(`Prefixes needing subdivision: ${progress.prefixesNeedingSubdivision.length}`);
    console.log(`Total inserted so far: ${progress.totalInserted}\n`);

    console.log('Loading existing emails...');
    const existingEmails = await loadExistingEmails();
    console.log(`Loaded ${existingEmails.size} existing emails`);

    console.log('Loading existing member IDs...');
    const existingMemberIds = await loadExistingMemberIds();
    console.log(`Loaded ${existingMemberIds.size} existing member IDs\n`);

    const startTime = Date.now();

    console.log('Launching browser...\n');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const allStats = [];
    let totalInsertedThisRun = 0;

    try {
        // Process up to MAX_COMBOS targets
        for (let i = 0; i < MAX_COMBOS; i++) {
            const target = getNextTarget(progress);

            if (!target) {
                console.log('\nAll prefixes and subdivisions complete!');
                break;
            }

            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS}), stopping.`);
                break;
            }

            const stats = await scrapePrefix(browser, target, existingEmails, existingMemberIds);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Update progress based on results
            if (stats.isSubPrefix) {
                // 3-letter sub-prefix completed
                if (!progress.completedSubPrefixes[stats.parentPrefix]) {
                    progress.completedSubPrefixes[stats.parentPrefix] = [];
                }
                progress.completedSubPrefixes[stats.parentPrefix].push(stats.prefix);

                // Check if all 26 sub-prefixes done for this parent prefix
                if (progress.completedSubPrefixes[stats.parentPrefix].length >= LETTERS.length) {
                    // Move from needingSubdivision to completed
                    progress.prefixesNeedingSubdivision = progress.prefixesNeedingSubdivision.filter(
                        p => p !== stats.parentPrefix
                    );
                    if (!progress.completedPrefixes.includes(stats.parentPrefix)) {
                        progress.completedPrefixes.push(stats.parentPrefix);
                    }
                    console.log(`   All sub-prefixes complete for "${stats.parentPrefix}"`);
                }
            } else {
                // 2-letter prefix completed
                if (stats.hit_cap) {
                    // Needs 3-letter subdivision
                    if (!progress.prefixesNeedingSubdivision.includes(stats.prefix)) {
                        progress.prefixesNeedingSubdivision.push(stats.prefix);
                        console.log(`   → "${stats.prefix}" added to subdivision queue`);
                    }
                } else {
                    // Complete (under cap)
                    if (!progress.completedPrefixes.includes(stats.prefix)) {
                        progress.completedPrefixes.push(stats.prefix);
                    }
                }
            }

            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.lastRunDate = new Date().toISOString();

            await saveProgress(progress);

            // Brief pause between searches
            await sleepWithJitter(3000);
        }

    } catch (err) {
        console.error('Fatal error:', err);
    }

    await browser.close();

    // Summary
    const totalInDb = DRY_RUN ? totalInsertedThisRun : await getTotalInDb();
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Prefixes scraped this run: ${allStats.length}`);
    console.log(`   Profiles fetched: ${allStats.reduce((sum, s) => sum + s.profilesFetched, 0)}`);
    console.log(`   Inserted this run: ${totalInsertedThisRun}`);
    console.log(`   Total NC Bar in DB: ${totalInDb}`);
    console.log(`   Prefixes complete: ${progress.completedPrefixes.length}/${ALL_PREFIXES.length}`);
    console.log(`   Needing subdivision: ${progress.prefixesNeedingSubdivision.length}`);
    console.log(`   Duration: ${duration} minutes`);

    // Send notification
    await sendNotificationEmail({
        prefixesScraped: allStats.length,
        totalProfilesFetched: allStats.reduce((sum, s) => sum + s.profilesFetched, 0),
        totalInserted: totalInsertedThisRun,
        totalSkipped: allStats.reduce((sum, s) => sum + s.skipped, 0),
        totalSkippedExisting: allStats.reduce((sum, s) => sum + s.skippedExisting, 0),
        totalNoEmail: allStats.reduce((sum, s) => sum + s.noEmail, 0),
        totalInDb,
        completedPrefixes: progress.completedPrefixes.length,
        needingSubdivision: progress.prefixesNeedingSubdivision.length,
        duration: `${duration} minutes`
    });

    // Write summary for GitHub Actions
    const summaryPath = path.join(__dirname, 'ncbar-scrape-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        prefixesScraped: allStats.length,
        totalInserted: totalInsertedThisRun,
        totalInDb,
        progress: {
            completedPrefixes: progress.completedPrefixes.length,
            prefixesNeedingSubdivision: progress.prefixesNeedingSubdivision.length,
            totalInserted: progress.totalInserted
        },
        dryRun: DRY_RUN
    }, null, 2));

    console.log('\nScrape complete!');
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
