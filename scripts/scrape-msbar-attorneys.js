#!/usr/bin/env node
/**
 * Mississippi Bar Attorney Scraper (Puppeteer + vCard API)
 *
 * Scrapes attorney contact information from the Mississippi State Bar Association website
 * (msbar.reliaguide.com) and imports into preintake_emails collection.
 *
 * Strategy (ReliaGuide platform with category URL filtering):
 * 1. Iterate through target practice areas using category URL filters
 * 2. For each practice area, paginate through search results
 * 3. Extract profile IDs from attorney cards
 * 4. Fetch vCard API for each profile to get email/phone/firm
 * 5. Insert into Firestore with deduplication
 *
 * NOTE: MS Bar uses ReliaGuide (like MI Bar) with category URL filtering:
 *   /lawyer/search?category.equals={name}&categoryId.equals={id}&memberTypeId.equals=1
 *
 * Usage:
 *   node scripts/scrape-msbar-attorneys.js
 *
 * Environment variables:
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
 *   DRY_RUN - If "true", don't write to Firestore
 *   PREINTAKE_SMTP_USER - SMTP username for notifications
 *   PREINTAKE_SMTP_PASS - SMTP password for notifications
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { isGovernmentContact, normalizeState } = require('./gov-filter-utils');

// ============================================================================
// PRACTICE AREAS (discovered from MS Bar API 2026-01-24)
// API endpoint: /api/public/category-lookups
// ============================================================================

const PRACTICE_AREAS = [
    // Tier 1: High-value PreIntake practice areas
    { id: '264', name: 'Personal Injury' },
    { id: '210', name: 'Immigration & Naturalization' },
    { id: '172', name: 'Family Law' },
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
    { id: '116', name: 'Construction Law' },
    { id: '214', name: 'Insurance' },
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://msbar.reliaguide.com';
const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_VCARDS = 500;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESULTS_PER_PAGE = 40; // MS Bar shows ~40 per page

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
            from: smtpUser,
            to: 'scscot@gmail.com',
            subject,
            html: htmlContent
        });
        console.log('Notification email sent');
    } catch (err) {
        console.error('Failed to send notification:', err.message);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseVCard(vcardText) {
    const lines = vcardText.split(/\r?\n/);
    const vcard = {};

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('FN:')) {
            vcard.fullName = trimmed.substring(3).trim();
        } else if (trimmed.startsWith('N:')) {
            const parts = trimmed.substring(2).split(';');
            vcard.lastName = parts[0]?.trim() || '';
            vcard.firstName = parts[1]?.trim() || '';
        } else if (trimmed.match(/^EMAIL/i)) {
            const emailMatch = trimmed.match(/EMAIL[^:]*:(.+)/i);
            if (emailMatch) {
                vcard.email = emailMatch[1].trim().toLowerCase();
            }
        } else if (trimmed.match(/^TEL/i)) {
            const telMatch = trimmed.match(/TEL[^:]*:(.+)/i);
            if (telMatch) {
                vcard.phone = telMatch[1].trim();
            }
        } else if (trimmed.startsWith('ORG:')) {
            vcard.org = trimmed.substring(4).trim().replace(/\\,/g, ',');
        } else if (trimmed.includes('URL') && trimmed.includes('TYPE=work') && !trimmed.includes('reliaguide')) {
            // Only extract work URLs that aren't ReliaGuide profile links
            // Format: URL;TYPE=work:https://example.com
            const urlPart = trimmed.split(':').slice(1).join(':');
            if (urlPart) {
                vcard.website = urlPart.trim();
            }
        } else if (trimmed.match(/^ADR/i)) {
            const adrMatch = trimmed.match(/ADR[^:]*:(.+)/i);
            if (adrMatch) {
                const parts = adrMatch[1].split(';');
                vcard.city = parts[3]?.trim() || '';
                vcard.state = parts[4]?.trim() || '';
                vcard.zip = parts[5]?.trim() || '';
            }
        }
    }

    return vcard;
}

async function fetchVCard(profileId) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'msbar.reliaguide.com',
            path: `/api/public/profiles/${profileId}/download-vcard`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/vcard,text/x-vcard,*/*'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.includes('BEGIN:VCARD')) {
                    resolve({ success: true, data: parseVCard(data) });
                } else {
                    resolve({ success: false, status: res.statusCode });
                }
            });
        });

        req.on('error', (err) => resolve({ success: false, error: err.message }));
        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ success: false, error: 'timeout' });
        });
        req.end();
    });
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

async function loadProgress() {
    if (DRY_RUN) return { completedCategoryIds: [], validatedCategoryIds: null, invalidCategoryIds: null, totalInserted: 0 };

    try {
        const progressRef = db.collection('preintake_scrape_progress').doc('msbar');
        const doc = await progressRef.get();

        if (doc.exists) {
            const data = doc.data();
            return {
                completedCategoryIds: data.completedCategoryIds || [],
                validatedCategoryIds: data.validatedCategoryIds || null,
                invalidCategoryIds: data.invalidCategoryIds || null,
                totalInserted: data.totalInserted || 0,
                lastRunDate: data.lastRunDate
            };
        }
    } catch (err) {
        console.error('Error loading progress:', err.message);
    }

    return { completedCategoryIds: [], validatedCategoryIds: null, invalidCategoryIds: null, totalInserted: 0 };
}

async function saveProgress(progress) {
    if (DRY_RUN) return;

    try {
        const progressRef = db.collection('preintake_scrape_progress').doc('msbar');
        await progressRef.set({
            ...progress,
            lastRunDate: new Date().toISOString()
        }, { merge: true });
    } catch (err) {
        console.error('Error saving progress:', err.message);
    }
}

// ============================================================================
// CATEGORY VALIDATION
// ============================================================================

/**
 * Get the total result count from a ReliaGuide search results page.
 * Looks for "Listing X-Y of Z" text or falls back to counting cards.
 * Returns: number (>0 = count, -1 = cards found but no count, 0 = no results)
 */
async function getResultsCount(page) {
    return page.evaluate(() => {
        const text = document.body.innerText;
        let match = text.match(/Listing\s+\d+.*?of\s+(\d+)/i);
        if (match) return parseInt(match[1]);
        const cards = document.querySelectorAll('.ant-card');
        return cards.length > 0 ? -1 : 0;
    });
}

/**
 * Validate hardcoded categories against live search results.
 * Tests each category URL and caches results in Firestore progress.
 * Returns filtered array of categories that have results.
 */
async function validateCategories(browser, progress) {
    // Check for cached validation
    if (progress.validatedCategoryIds) {
        const validIds = new Set(progress.validatedCategoryIds);
        const validCategories = PRACTICE_AREAS.filter(c => validIds.has(c.id));
        const invalidCount = PRACTICE_AREAS.length - validCategories.length;
        console.log(`Using cached category validation: ${validCategories.length} valid, ${invalidCount} invalid`);
        if (progress.invalidCategoryIds && progress.invalidCategoryIds.length > 0) {
            const invalidNames = PRACTICE_AREAS
                .filter(c => progress.invalidCategoryIds.includes(c.id))
                .map(c => c.name);
            console.log(`   Invalid: ${invalidNames.join(', ')}`);
        }
        return validCategories;
    }

    // No cache — validate each category against live search
    console.log('Validating practice area categories against live search...');
    const validatedIds = [];
    const invalidIds = [];

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const category of PRACTICE_AREAS) {
        try {
            const url = `${BASE_URL}/lawyer/search?category.equals=${encodeURIComponent(category.name)}&categoryId.equals=${category.id}&memberTypeId.equals=1`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            try {
                await page.waitForSelector('.ant-layout', { timeout: 30000 });
            } catch (e) {
                // Layout didn't render — treat as 0 results
            }
            await delay(3000);

            const count = await getResultsCount(page);
            if (count !== 0) {
                validatedIds.push(category.id);
                console.log(`   ${category.name}: ${count === -1 ? 'results found' : count + ' results'}`);
            } else {
                invalidIds.push(category.id);
                console.log(`   ${category.name}: 0 results (will skip)`);
            }
        } catch (err) {
            // On error, keep the category (conservative)
            validatedIds.push(category.id);
            console.log(`   ${category.name}: error (${err.message}) — keeping`);
        }
        await delay(1000);
    }

    await page.close();

    // Safety valve: if ALL categories returned 0, likely anti-bot or transient issue
    if (validatedIds.length === 0 && PRACTICE_AREAS.length > 0) {
        console.log(`\nWARNING: All ${PRACTICE_AREAS.length} categories returned 0 results.`);
        console.log(`  This likely indicates anti-bot detection or a transient issue.`);
        console.log(`  Falling back to ALL categories to prevent skipping everything.\n`);
        return PRACTICE_AREAS;
    }

    // Cache results
    progress.validatedCategoryIds = validatedIds;
    progress.invalidCategoryIds = invalidIds;
    await saveProgress(progress);

    const validCategories = PRACTICE_AREAS.filter(c => validatedIds.includes(c.id));
    console.log(`Validation complete: ${validCategories.length} valid, ${invalidIds.length} invalid\n`);
    return validCategories;
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
 * Load existing MsBar profile IDs for efficient skip-before-fetch
 */
async function loadExistingProfileIds() {
    const profileIds = new Set();
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'msbar')
            .select('profileId')
            .get();
        snapshot.forEach(doc => {
            const id = doc.data().profileId;
            if (id) profileIds.add(id.toString());
        });
    } catch (err) {
        console.error('Error loading existing profile IDs:', err.message);
    }
    return profileIds;
}

async function getTotalAttorneysInDb() {
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'msbar')
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
            firmName: attorney.org || '',
            email: emailLower,
            phone: attorney.phone || '',
            website: attorney.website || '',
            practiceArea: attorney.practiceArea || '',
            city: attorney.city || '',
            state: normalizeState(attorney.state, 'MS'),
            source: 'msbar',
            profileId: attorney.profileId,
            memberUrl: `${BASE_URL}/lawyer/${attorney.profileId}`,
            sent: false,
            status: 'pending',
            randomIndex: Math.random() * 0.1,
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
// MAIN SCRAPER
// ============================================================================

async function scrapeByCategory(page, category, existingEmails, existingProfileIds, maxAttorneys) {
    const { id, name } = category;
    const url = `${BASE_URL}/lawyer/search?category.equals=${encodeURIComponent(name)}&categoryId.equals=${id}&memberTypeId.equals=1`;

    console.log(`\n   Loading ${name} (ID: ${id})...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for React app to render - look for the main layout container
        try {
            await page.waitForSelector('.ant-layout', { timeout: 30000 });
        } catch (e) {
            console.log(`     Failed to load page for ${name}`);
            return { inserted: 0, skipped: 0, error: 'page_load_failed' };
        }

        // Additional wait for content to fully render
        await delay(3000);

        // Get total results - look for listing count or card elements
        const totalResults = await getResultsCount(page);

        if (totalResults === 0) {
            console.log(`     No results found for ${name}`);
            return { inserted: 0, skipped: 0 };
        }

        // If totalResults is -1, we have cards but no count - assume at least 1 page
        const estimatedTotal = totalResults > 0 ? totalResults : 40;  // Assume 1 page if count unknown
        const totalPages = totalResults > 0 ? Math.ceil(totalResults / RESULTS_PER_PAGE) : 100;  // Max 100 pages if unknown
        console.log(`     Found ${totalResults === -1 ? 'cards (count unknown)' : totalResults + ' attorneys'} (up to ${totalPages} pages)`);

        let categoryInserted = 0;
        let categorySkipped = 0;
        let currentPage = 0;

        while (currentPage < totalPages && categoryInserted < maxAttorneys) {
            currentPage++;

            // Extract profiles from current page
            const profiles = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('a[href*="/lawyer/"]').forEach(a => {
                    // URL format: /lawyer/{zip}-{state}-{FirstName}-{LastName}-{profileId}
                    const match = a.href.match(/\/lawyer\/[^/]+-(\d+)$/);
                    if (match) {
                        results.push({
                            profileId: match[1],
                            name: a.textContent.trim()
                        });
                    }
                });
                // Dedupe by profileId
                const seen = new Set();
                return results.filter(p => {
                    if (seen.has(p.profileId)) return false;
                    seen.add(p.profileId);
                    return true;
                });
            });

            let pageInserted = 0;
            let pageSkippedExisting = 0;
            let pageSkippedNoEmail = 0;

            for (const profile of profiles) {
                if (categoryInserted >= maxAttorneys) break;

                // Skip if profileId already exists in database
                if (existingProfileIds.has(profile.profileId.toString())) {
                    pageSkippedExisting++;
                    continue;
                }

                // Fetch vCard to get email
                const vcardResult = await fetchVCard(profile.profileId);
                await delay(DELAY_BETWEEN_VCARDS);

                if (!vcardResult.success) {
                    pageSkippedNoEmail++;
                    continue;
                }

                const vcard = vcardResult.data;
                vcard.profileId = profile.profileId;
                vcard.practiceArea = name;

                // Insert into database
                const insertResult = await insertAttorney(vcard, existingEmails);
                if (insertResult.success) {
                    pageInserted++;
                    categoryInserted++;
                    existingProfileIds.add(profile.profileId.toString());
                } else {
                    pageSkippedNoEmail++;
                }
            }

            console.log(`     Page ${currentPage}/${totalPages}: +${pageInserted} new, ${pageSkippedExisting} existing, ${pageSkippedNoEmail} no email`);
            categorySkipped += pageSkippedNoEmail;

            // Navigate to next page if needed
            if (currentPage < totalPages && categoryInserted < maxAttorneys) {
                const clicked = await page.evaluate((nextPageNum) => {
                    // Try clicking the specific page number first
                    const items = document.querySelectorAll('.ant-pagination-item');
                    for (const item of items) {
                        if (item.textContent?.trim() === String(nextPageNum)) {
                            item.click();
                            return true;
                        }
                    }
                    // Fall back to next button
                    const nextBtn = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
                    if (nextBtn) {
                        nextBtn.click();
                        return true;
                    }
                    return false;
                }, currentPage + 1);

                if (clicked) {
                    await delay(DELAY_BETWEEN_PAGES);
                } else {
                    console.log(`     Pagination ended at page ${currentPage}`);
                    break;
                }
            }
        }

        return { inserted: categoryInserted, skipped: categorySkipped };

    } catch (err) {
        console.error(`     Error scraping ${name}:`, err.message);
        return { inserted: 0, skipped: 0, error: err.message };
    }
}

async function main() {
    console.log('Mississippi Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log(`Target practice areas: ${PRACTICE_AREAS.length}`);
    console.log(`Max attorneys per run: ${MAX_ATTORNEYS}`);

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***');
    }
    console.log();

    initializeFirebase();

    const progress = await loadProgress();
    console.log(`Previously completed categories: ${progress.completedCategoryIds.length}`);
    console.log(`Total inserted so far: ${progress.totalInserted}\n`);

    console.log('Loading existing emails...');
    const existingEmails = await loadExistingEmails();
    console.log(`Loaded ${existingEmails.size} existing emails`);

    console.log('Loading existing profile IDs...');
    const existingProfileIds = await loadExistingProfileIds();
    console.log(`Loaded ${existingProfileIds.size} existing profile IDs\n`);

    console.log('Launching browser...\n');
    const browser = await puppeteer.launch({
        headless: false,  // MS Bar detects headless mode - requires xvfb in CI
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    // Validate categories against live search before processing
    const validCategories = await validateCategories(browser, progress);

    // Get pending categories (from validated set only)
    const pendingCategories = validCategories.filter(
        cat => !progress.completedCategoryIds.includes(cat.id)
    );

    if (pendingCategories.length === 0) {
        console.log('All categories already scraped!');
        console.log('Reset progress in Firestore to re-scrape.');
        await browser.close();
        return;
    }

    console.log(`Categories remaining: ${pendingCategories.length}`);
    console.log(pendingCategories.map(c => c.name).join(', '));
    console.log();

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let insertedThisRun = 0;  // Track inserts THIS run for MAX_ATTORNEYS limit
    let totalInserted = progress.totalInserted;  // Cumulative total for progress tracking
    const completedCategoryIds = [...progress.completedCategoryIds];
    const categoryResults = [];

    // Process each category
    for (const category of pendingCategories) {
        if (insertedThisRun >= MAX_ATTORNEYS) {
            console.log(`\nReached max attorneys limit (${MAX_ATTORNEYS}), stopping.`);
            break;
        }

        const remaining = MAX_ATTORNEYS - insertedThisRun;
        const result = await scrapeByCategory(page, category, existingEmails, existingProfileIds, remaining);

        categoryResults.push({
            categoryId: category.id,
            name: category.name,
            ...result
        });

        insertedThisRun += result.inserted;
        totalInserted += result.inserted;

        // Mark category as complete (even if we hit max - we'll continue from next category on next run)
        if (!result.error) {
            completedCategoryIds.push(category.id);
        }

        // Save progress after each category
        await saveProgress({
            completedCategoryIds,
            totalInserted
        });
    }

    await browser.close();

    // Final summary
    const totalInDb = DRY_RUN ? totalInserted : await getTotalAttorneysInDb();

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Categories processed: ${categoryResults.length}`);
    console.log(`Categories complete: ${completedCategoryIds.length}/${validCategories.length} valid (${PRACTICE_AREAS.length} total)`);
    console.log(`Inserted this run: ${insertedThisRun}`);
    console.log(`Total MS Bar in DB: ${totalInDb}`);
    console.log();

    // Category breakdown
    for (const result of categoryResults) {
        const status = result.error ? `ERROR: ${result.error}` : `+${result.inserted}`;
        console.log(`   ${result.name}: ${status}`);
    }

    // Send notification email
    const emailHtml = `
        <h2>Mississippi Bar Scraper Complete</h2>
        <p><strong>Categories processed:</strong> ${categoryResults.length}</p>
        <p><strong>Categories complete:</strong> ${completedCategoryIds.length}/${validCategories.length} valid (${PRACTICE_AREAS.length} total)</p>
        <p><strong>Inserted this run:</strong> ${insertedThisRun}</p>
        <p><strong>Total MS Bar in DB:</strong> ${totalInDb}</p>
        ${DRY_RUN ? '<p><strong>*** DRY RUN - No data written ***</strong></p>' : ''}
        <h3>Category Breakdown</h3>
        <ul>
            ${categoryResults.map(r => `<li>${r.name}: +${r.inserted}${r.error ? ` (ERROR: ${r.error})` : ''}</li>`).join('')}
        </ul>
        <p><small>Timestamp: ${new Date().toISOString()}</small></p>
    `;

    const subject = DRY_RUN
        ? `[DRY RUN] MS Bar: ${insertedThisRun} new attorneys (${completedCategoryIds.length}/${validCategories.length} categories)`
        : `MS Bar: ${insertedThisRun} new attorneys (${completedCategoryIds.length}/${validCategories.length} categories)`;

    await sendNotificationEmail(subject, emailHtml);

    console.log('\n✓ Scrape complete!');

    // Write summary for GitHub Actions
    const summaryPath = path.join(__dirname, 'msbar-scrape-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        categoriesProcessed: categoryResults.length,
        insertedThisRun,
        totalInDb,
        dryRun: DRY_RUN,
        categoryResults
    }, null, 2));
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
