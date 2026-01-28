#!/usr/bin/env node
/**
 * Nebraska Bar Attorney Scraper (Puppeteer + vCard API)
 *
 * Scrapes attorney contact information from the Nebraska State Bar Association website
 * (nebar.reliaguide.com) and imports into preintake_emails collection.
 *
 * Strategy (for sites without category URL filtering):
 * 1. Navigate to search results (all attorneys)
 * 2. Extract profile IDs and practice areas from attorney cards
 * 3. Paginate through all results
 * 4. Filter for relevant practice areas
 * 5. Fetch vCard API for each matching profile to get email/phone/firm
 * 6. Insert into Firestore with deduplication
 *
 * Usage:
 *   node scripts/scrape-nebar-attorneys.js
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
const { isGovernmentContact, normalizeState, cleanEmail } = require('./gov-filter-utils');

// ============================================================================
// TARGET PRACTICE AREAS (keywords to match in attorney cards)
// ============================================================================

const TARGET_PRACTICE_AREAS = [
    'Personal Injury',
    'Immigration',
    'Family Law',
    'Criminal',
    'Bankruptcy',
    'Workers Compensation',
    'Medical Malpractice',
    'Wrongful Death',
    'Labor & Employment',
    'Employment Law',
    'Real Estate',
    'Estate Planning',
    'Probate',
    'Elder Law',
    'Social Security',
    'Consumer Law',
    'Civil Rights',
    'Civil Litigation',
    'Tax',
];

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://nebar.reliaguide.com';
const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_VCARDS = 500;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const RESULTS_PER_PAGE = 40;

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
// HELPER FUNCTIONS
// ============================================================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function matchesPracticeArea(cardText) {
    const lowerText = cardText.toLowerCase();
    for (const area of TARGET_PRACTICE_AREAS) {
        if (lowerText.includes(area.toLowerCase())) {
            return area;
        }
    }
    return null;
}

function parseVCard(vcardText) {
    const lines = vcardText.split(/\r?\n/);
    const vcard = {};

    for (const line of lines) {
        if (line.startsWith('FN:')) {
            vcard.fullName = line.substring(3).trim();
        } else if (line.startsWith('N:')) {
            const parts = line.substring(2).split(';');
            vcard.lastName = parts[0]?.trim() || '';
            vcard.firstName = parts[1]?.trim() || '';
        } else if (line.match(/^EMAIL/i)) {
            const emailMatch = line.match(/EMAIL[^:]*:(.+)/i);
            if (emailMatch) {
                vcard.email = emailMatch[1].trim().toLowerCase();
            }
        } else if (line.match(/^TEL/i)) {
            const telMatch = line.match(/TEL[^:]*:(.+)/i);
            if (telMatch) {
                vcard.phone = telMatch[1].trim();
            }
        } else if (line.startsWith('ORG:')) {
            vcard.org = line.substring(4).trim().replace(/\\,/g, ',');
        } else if (line.match(/^URL/i)) {
            const urlMatch = line.match(/URL[^:]*:(.+)/i);
            if (urlMatch) {
                vcard.website = urlMatch[1].trim();
            }
        } else if (line.match(/^ADR/i)) {
            const adrMatch = line.match(/ADR[^:]*:(.+)/i);
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
            hostname: 'nebar.reliaguide.com',
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
    if (DRY_RUN) return { lastPage: 0, totalInserted: 0, totalSkipped: 0 };

    try {
        const progressRef = db.collection('preintake_scrape_progress').doc('nebar');
        const doc = await progressRef.get();

        if (doc.exists) {
            const data = doc.data();
            return {
                lastPage: data.lastPage || 0,
                totalInserted: data.totalInserted || 0,
                totalSkipped: data.totalSkipped || 0,
                lastRunDate: data.lastRunDate
            };
        }
    } catch (err) {
        console.error('Error loading progress:', err.message);
    }

    return { lastPage: 0, totalInserted: 0, totalSkipped: 0 };
}

async function saveProgress(progress) {
    if (DRY_RUN) return;

    try {
        const progressRef = db.collection('preintake_scrape_progress').doc('nebar');
        await progressRef.set({
            ...progress,
            lastRunDate: new Date().toISOString()
        }, { merge: true });
    } catch (err) {
        console.error('Error saving progress:', err.message);
    }
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
 * Load existing NeBar profile IDs for efficient skip-before-fetch
 */
async function loadExistingProfileIds() {
    const profileIds = new Set();
    try {
        const snapshot = await db.collection('preintake_emails')
            .where('source', '==', 'nebar')
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
            .where('source', '==', 'nebar')
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
            firmName: attorney.org || '',
            email: emailLower,
            phone: attorney.phone || '',
            website: attorney.website || '',
            practiceArea: attorney.practiceArea || '',
            city: attorney.city || '',
            state: normalizeState(attorney.state, 'NE'),
            source: 'nebar',
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

async function scrapeAllAttorneys() {
    console.log('Nebraska Bar Attorney Scraper');
    console.log('='.repeat(60));
    console.log('Scraping ALL attorneys, filtering by practice area');
    console.log();

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No data will be written ***\n');
    }

    initializeFirebase();

    const progress = await loadProgress();
    console.log(`Progress: Starting from page ${progress.lastPage}`);
    console.log(`Total inserted so far: ${progress.totalInserted}\n`);

    console.log('Loading existing emails...');
    const existingEmails = await loadExistingEmails();
    console.log(`Loaded ${existingEmails.size} existing emails`);

    console.log('Loading existing profile IDs...');
    const existingProfileIds = await loadExistingProfileIds();
    console.log(`Loaded ${existingProfileIds.size} existing profile IDs\n`);

    console.log('Launching browser...\n');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let totalInserted = progress.totalInserted;
    let totalSkipped = progress.totalSkipped;
    let currentPage = progress.lastPage;
    let hasMorePages = true;

    const startUrl = `${BASE_URL}/lawyer/search?memberTypeId.equals=1`;

    try {
        // Navigate to first page
        console.log('='.repeat(60));
        console.log('Starting scrape from: ' + startUrl);
        console.log('='.repeat(60));

        await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(3000);

        // Get total results
        const totalResults = await page.evaluate(() => {
            const text = document.body.innerText;
            const match = text.match(/(\d[\d,]*)\s*results?/i);
            return match ? parseInt(match[1].replace(/,/g, '')) : 0;
        });

        const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);
        console.log(`   Total results: ${totalResults}`);
        console.log(`   Total pages: ${totalPages}`);

        // If we have a starting page, navigate to it
        if (currentPage > 0) {
            console.log(`   Resuming from page ${currentPage + 1}...`);
            for (let p = 0; p < currentPage; p++) {
                const nextBtn = await page.$('.ant-pagination-next:not(.ant-pagination-disabled)');
                if (nextBtn) {
                    await nextBtn.click();
                    await delay(DELAY_BETWEEN_PAGES);
                }
            }
        }

        while (hasMorePages && totalInserted < MAX_ATTORNEYS) {
            currentPage++;
            console.log(`\n   Page ${currentPage}/${totalPages}...`);

            // Extract profiles from current page
            const profiles = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('a[href*="/lawyer/"]').forEach(a => {
                    // URL format: /lawyer/{zip}-{state}-{FirstName}-{LastName}-{profileId}
                    const match = a.href.match(/\/lawyer\/[^/]+-(\d+)$/);
                    if (match) {
                        // Get the card text (practice areas are usually in the card)
                        const card = a.closest('[class*="card"]') || a.parentElement?.parentElement;
                        const cardText = card ? card.innerText : '';
                        results.push({
                            profileId: match[1],
                            cardText: cardText,
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

            console.log(`     Found ${profiles.length} profiles on page`);

            // Filter for relevant practice areas and fetch vCards
            let pageInserted = 0;
            let pageSkipped = 0;
            let pageSkippedExisting = 0;

            for (const profile of profiles) {
                if (totalInserted >= MAX_ATTORNEYS) break;

                const matchedArea = matchesPracticeArea(profile.cardText);
                if (!matchedArea) {
                    pageSkipped++;
                    continue;
                }

                // Skip if profileId already exists in database
                if (existingProfileIds.has(profile.profileId.toString())) {
                    pageSkippedExisting++;
                    continue;
                }

                // Fetch vCard
                const vcardResult = await fetchVCard(profile.profileId);
                await delay(DELAY_BETWEEN_VCARDS);

                if (!vcardResult.success) {
                    pageSkipped++;
                    continue;
                }

                const vcard = vcardResult.data;
                vcard.profileId = profile.profileId;
                vcard.practiceArea = matchedArea;

                // Insert into database
                const insertResult = await insertAttorney(vcard, existingEmails);
                if (insertResult.success) {
                    pageInserted++;
                    totalInserted++;
                } else {
                    pageSkipped++;
                }
            }

            console.log(`     ✓ Inserted ${pageInserted}, Skipped ${pageSkipped}, SkippedExisting ${pageSkippedExisting}`);
            totalSkipped += pageSkipped;

            // Save progress
            await saveProgress({
                lastPage: currentPage,
                totalInserted,
                totalSkipped
            });

            // Check for next page
            const nextBtn = await page.$('.ant-pagination-next:not(.ant-pagination-disabled)');
            if (nextBtn && currentPage < totalPages) {
                await nextBtn.click();
                await delay(DELAY_BETWEEN_PAGES);
            } else {
                hasMorePages = false;
            }
        }

    } catch (err) {
        console.error('\n   Error during scraping:', err.message);
    }

    await browser.close();

    // Final summary
    const totalInDb = DRY_RUN ? totalInserted : await getTotalAttorneysInDb();

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Pages scraped: ${currentPage}`);
    console.log(`   Inserted this run: ${totalInserted - progress.totalInserted}`);
    console.log(`   Total Nebraska Bar in DB: ${totalInDb}`);

    // Send notification email
    await sendNotificationEmail({
        pagesScraped: currentPage,
        insertedThisRun: totalInserted - progress.totalInserted,
        totalInDb
    });

    console.log('\n✓ Scrape complete!');

    // Write summary for GitHub Actions
    const summaryPath = path.join(__dirname, 'nebar-scrape-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        pagesScraped: currentPage,
        insertedThisRun: totalInserted - progress.totalInserted,
        totalInDb,
        dryRun: DRY_RUN
    }, null, 2));
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
        auth: { user: smtpUser, pass: smtpPass }
    });

    const subject = DRY_RUN
        ? '[DRY RUN] Nebraska Bar Scraper Complete'
        : 'Nebraska Bar Scraper Complete';

    const text = `
Nebraska Bar Attorney Scraper Summary
=====================================

Pages Scraped: ${summary.pagesScraped}
Inserted This Run: ${summary.insertedThisRun}
Total Nebraska Bar in DB: ${summary.totalInDb}
${DRY_RUN ? '\n*** DRY RUN - No data was written ***' : ''}

Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
        await transporter.sendMail({
            from: smtpUser,
            to: 'scscot@gmail.com',
            subject,
            text
        });
        console.log('Notification email sent');
    } catch (err) {
        console.error('Failed to send notification email:', err.message);
    }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

scrapeAllAttorneys().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
