#!/usr/bin/env node
/**
 * Michigan Bar Attorney Scraper (Puppeteer + vCard API)
 *
 * Scrapes attorney contact information from the State Bar of Michigan website
 * (sbm.reliaguide.com) and imports into preintake_emails collection.
 *
 * Strategy:
 * 1. Navigate to search results with category filter (Puppeteer)
 * 2. Extract profile IDs from attorney cards
 * 3. Paginate through all results
 * 4. Fetch vCard API for each profile to get email/phone/firm
 * 5. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-mibar-attorneys.js
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

// ============================================================================
// PRACTICE AREAS (discovered from Michigan Bar API 2026-01-20)
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
    { id: '215', name: 'Intellectual Property' },
    { id: '116', name: 'Construction Law' },
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://sbm.reliaguide.com';
const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_VCARDS = 500;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESULTS_PER_PAGE = 40; // Michigan Bar shows ~40 per page

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
            to: 'Stephen Scott <stephen@preintake.ai>',
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

/**
 * Fetch vCard data for a profile ID
 */
async function fetchVCard(profileId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'sbm.reliaguide.com',
            path: `/api/public/profiles/${profileId}/download-vcard`,
            method: 'GET',
            timeout: 10000,
            headers: {
                'Accept': 'text/vcard, text/x-vcard, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': 'https://sbm.reliaguide.com/lawyer/search'
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

        // Name: N:LastName;FirstName;MiddleName
        if (trimmed.startsWith('N:')) {
            const parts = trimmed.substring(2).split(';');
            result.lastName = parts[0] || '';
            result.firstName = parts[1] || '';
        }

        // Full name: FN:Full Name
        if (trimmed.startsWith('FN:')) {
            result.fullName = trimmed.substring(3);
        }

        // Email: EMAIL;TYPE=work:email@example.com
        if (trimmed.includes('EMAIL') && trimmed.includes(':')) {
            const emailPart = trimmed.split(':').pop();
            if (emailPart && emailPart.includes('@')) {
                result.email = emailPart.toLowerCase().trim();
            }
        }

        // Phone: TEL;TYPE=work,voice:123-456-7890
        if (trimmed.includes('TEL') && trimmed.includes('voice')) {
            const phonePart = trimmed.split(':').pop();
            if (phonePart && !result.phone) {
                result.phone = phonePart.trim();
            }
        }

        // Organization: ORG:Firm Name
        if (trimmed.startsWith('ORG:')) {
            result.firmName = trimmed.substring(4).replace(/\\,/g, ',').trim();
        }

        // Website: URL;TYPE=work:https://...
        if (trimmed.includes('URL') && trimmed.includes('TYPE=work') && !trimmed.includes('reliaguide')) {
            const urlPart = trimmed.split(':').slice(1).join(':');
            if (urlPart && urlPart.startsWith('http')) {
                result.website = urlPart.trim();
            }
        }

        // Address: ADR;TYPE=work:;;Street;City;State;Zip;Country
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
    const progressRef = db.collection('preintake_scrape_progress').doc('mibar');
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
    const progressRef = db.collection('preintake_scrape_progress').doc('mibar');
    await progressRef.set({
        ...progress,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function getTotalAttorneysInDb() {
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'mibar')
        .count()
        .get();
    return snapshot.data().count;
}

// ============================================================================
// PUPPETEER SCRAPING FUNCTIONS
// ============================================================================

/**
 * Extract profile IDs from current search results page
 */
async function extractProfileIds(page) {
    return await page.evaluate(() => {
        const ids = [];

        // Look for vCard download links which contain profile IDs
        const vcardLinks = document.querySelectorAll('a[href*="/api/public/profiles/"][href*="/download-vcard"]');
        vcardLinks.forEach(link => {
            const match = link.href.match(/profiles\/(\d+)\/download-vcard/);
            if (match) {
                ids.push(match[1]);
            }
        });

        // Also look for profile links
        const profileLinks = document.querySelectorAll('a[href*="/lawyer/"]');
        profileLinks.forEach(link => {
            const match = link.href.match(/lawyer\/\d+-MI-\w+-\w+-(\d+)/);
            if (match && !ids.includes(match[1])) {
                ids.push(match[1]);
            }
        });

        return [...new Set(ids)]; // Dedupe
    });
}

/**
 * Get total results count from page
 */
async function getResultsCount(page) {
    return await page.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Listing\s+\d+\s+of\s+(\d+)/);
        return match ? parseInt(match[1]) : 0;
    });
}

/**
 * Click to next page in pagination
 */
async function goToNextPage(page, currentPage) {
    const nextPage = currentPage + 1;

    const clicked = await page.evaluate((pageNum) => {
        // Find pagination item with the page number
        const items = document.querySelectorAll('.ant-pagination-item');
        for (const item of items) {
            if (item.textContent?.trim() === String(pageNum)) {
                item.click();
                return true;
            }
        }

        // Try clicking the "next" button
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

async function scrapeCategory(browser, category, existingEmails) {
    const { id, name } = category;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${name} (ID: ${id})`);
    console.log('='.repeat(60));

    const stats = {
        categoryId: id,
        categoryName: name,
        totalResults: 0,
        profilesFetched: 0,
        vcardsFetched: 0,
        inserted: 0,
        skipped: 0,
        errors: 0
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;
    const allProfileIds = [];

    try {
        // Navigate to search with category filter
        const url = `${BASE_URL}/lawyer/search?category.equals=${encodeURIComponent(name)}&categoryId.equals=${id}&memberTypeId.equals=1`;
        console.log(`   URL: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(5000);

        // Get total results
        stats.totalResults = await getResultsCount(page);
        console.log(`   Total results: ${stats.totalResults}`);

        if (stats.totalResults === 0) {
            console.log('   No results found');
            await page.close();
            return stats;
        }

        // Calculate pages
        const totalPages = Math.ceil(stats.totalResults / RESULTS_PER_PAGE);
        console.log(`   Pages to scrape: ${totalPages}`);

        // Extract profile IDs from each page
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

        // Fetch vCards and insert into Firestore
        console.log(`   Fetching vCards...`);

        for (let i = 0; i < allProfileIds.length && i < MAX_ATTORNEYS; i++) {
            const profileId = allProfileIds[i];

            try {
                const vcardText = await fetchVCard(profileId);
                stats.vcardsFetched++;

                const vcard = parseVCard(vcardText);

                // Skip if no email
                if (!vcard.email || !vcard.email.includes('@')) {
                    stats.skipped++;
                    continue;
                }

                // Skip if already exists
                const emailLower = vcard.email.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    stats.skipped++;
                    continue;
                }

                // Create document
                const docData = {
                    firstName: vcard.firstName,
                    lastName: vcard.lastName,
                    firmName: vcard.firmName,
                    email: emailLower,
                    phone: vcard.phone,
                    website: vcard.website,
                    practiceArea: name,
                    city: vcard.city,
                    state: vcard.state || 'MI',
                    source: 'mibar',
                    barNumber: '',
                    memberUrl: `${BASE_URL}/api/public/profiles/${profileId}/download-vcard`,
                    profileId: profileId,
                    sent: false,
                    status: 'pending',
                    randomIndex: Math.random() * 0.1, // Prioritize in queue
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

        // Commit remaining batch
        if (batchCount > 0 && !DRY_RUN) {
            await batch.commit();
            console.log(`     Committed final batch of ${batchCount}`);
        }

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped}, Errors ${stats.errors}`);

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
    const categoriesHtml = summary.categories.map(c => `
        <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${c.categoryName}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${c.totalResults}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${c.vcardsFetched}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; color: #166534; font-weight: 600;">${c.inserted}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${c.errors}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Michigan Bar Scrape Report</h1>
    </div>
    <div style="background: #fff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px;">${new Date().toLocaleString()}</p>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Categories Scraped</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="background: #f8fafc;">
                <th style="padding: 8px; text-align: left;">Category</th>
                <th style="padding: 8px; text-align: center;">Results</th>
                <th style="padding: 8px; text-align: center;">vCards</th>
                <th style="padding: 8px; text-align: center;">Inserted</th>
                <th style="padding: 8px; text-align: center;">Errors</th>
            </tr>
            ${categoriesHtml}
        </table>

        <h2 style="font-size: 16px; margin: 20px 0 10px;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0;">Total inserted this run:</td><td style="text-align: right; font-weight: 600; color: #166534;">${summary.totalInserted}</td></tr>
            <tr><td style="padding: 8px 0;">Michigan Bar attorneys in DB:</td><td style="text-align: right;">${summary.totalInDb.toLocaleString()}</td></tr>
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
    console.log('Michigan Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Using vCard API for reliable email extraction\n');

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    // Load progress
    const progress = await getProgress();
    console.log(`Progress: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length} categories complete`);
    console.log(`Total inserted so far: ${progress.totalInserted.toLocaleString()}\n`);

    // Load existing emails for deduplication
    console.log('Loading existing emails...');
    const existingEmails = new Set();
    const existingSnapshot = await db.collection('preintake_emails').select('email').get();
    existingSnapshot.forEach(doc => {
        const email = doc.data().email?.toLowerCase();
        if (email) existingEmails.add(email);
    });
    console.log(`Loaded ${existingEmails.size} existing emails\n`);

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
        // Process categories
        for (const category of PRACTICE_AREAS) {
            // Skip completed categories
            if (progress.completedCategoryIds.includes(category.id)) {
                console.log(`\nSkipping ${category.name} (already completed)`);
                continue;
            }

            // Check if we've hit MAX_ATTORNEYS
            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
            }

            const stats = await scrapeCategory(browser, category, existingEmails);
            allStats.push(stats);
            totalInsertedThisRun += stats.inserted;

            // Mark category complete
            if (!progress.completedCategoryIds.includes(category.id)) {
                progress.completedCategoryIds.push(category.id);
            }

            // Save progress after each category
            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.lastRunDate = new Date().toISOString();

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            // Delay between categories
            await sleepWithJitter(5000);
        }

        // Summary
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Categories scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total Michigan Bar in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Categories complete: ${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length}`);
        console.log(`   Duration: ${duration} minutes`);

        // Save summary
        const summary = {
            run_date: new Date().toISOString(),
            categories: allStats,
            totalInserted: totalInsertedThisRun,
            totalInDb,
            progress,
            duration: `${duration} minutes`,
            dry_run: DRY_RUN
        };

        fs.writeFileSync(
            path.join(__dirname, 'mibar-scrape-summary.json'),
            JSON.stringify(summary, null, 2)
        );

        // Send email
        await sendNotificationEmail(
            `Michigan Bar: ${totalInsertedThisRun} new attorneys (${progress.completedCategoryIds.length}/${PRACTICE_AREAS.length} categories)`,
            generateEmailHTML(summary)
        );

        console.log('\n✓ Scrape complete!');

    } catch (error) {
        console.error('\nFatal error:', error);
        await sendNotificationEmail(
            'Michigan Bar Scrape FAILED',
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
