#!/usr/bin/env node

/**
 * Kentucky Bar Association Attorney Scraper
 *
 * Scrapes attorney contact information from kybar.org/For-Public/Find-a-Lawyer
 * Uses Puppeteer to interact with iframe-based search and extract profile data.
 *
 * Features:
 * - Practice area filtering via PRACTICEAREA select
 * - Pagination handling (12 results per page)
 * - Profile detail extraction via openLawyerInfo() clicks
 * - Email, phone, firm, website extraction
 * - Deduplication against existing Firestore records
 * - Progress tracking for resume capability
 *
 * Firebase Authentication:
 * - Uses FIREBASE_SERVICE_ACCOUNT env var (JSON string) in GitHub Actions
 * - Falls back to secrets/serviceAccountKey.json for local development
 *
 * Usage:
 *   DRY_RUN=true node scripts/scrape-kybar-attorneys.js
 *   PRACTICE_AREA="Personal Injury" MAX_ATTORNEYS=100 node scripts/scrape-kybar-attorneys.js
 *
 * Environment Variables:
 *   DRY_RUN - If "true", don't write to Firestore
 *   MAX_ATTORNEYS - Maximum attorneys to scrape per run (default: 500)
 *   PRACTICE_AREA - Specific practice area to scrape (default: follows priority order)
 */

const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { isGovernmentContact } = require('./gov-filter-utils');

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = 'https://kybar.org/For-Public/Find-a-Lawyer';
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';
const SPECIFIC_PRACTICE_AREA = process.env.PRACTICE_AREA || null;

// Delays to avoid rate limiting
const DELAY_BETWEEN_PROFILES = 1500; // 1.5 seconds between profile fetches
const DELAY_BETWEEN_PAGES = 2000; // 2 seconds between pagination

// County subdivision threshold - if practice area has more than this, subdivide by county
const COUNTY_SUBDIVISION_THRESHOLD = 500;

// Kentucky counties for subdivision (sorted by population descending - 120 counties)
const KENTUCKY_COUNTIES = [
    'Jefferson', 'Fayette', 'Kenton', 'Warren', 'Boone', 'Hardin', 'Daviess', 'Madison', 'Campbell', 'Bullitt',
    'Christian', 'Oldham', 'McCracken', 'Pulaski', 'Laurel', 'Scott', 'Jessamine', 'Pike', 'Franklin', 'Shelby',
    'Nelson', 'Boyd', 'Barren', 'Hopkins', 'Henderson', 'Calloway', 'Clark', 'Whitley', 'Graves', 'Greenup',
    'Floyd', 'Marshall', 'Boyle', 'Muhlenberg', 'Meade', 'Knox', 'Montgomery', 'Logan', 'Woodford', 'Grayson',
    'Taylor', 'Perry', 'Carter', 'Grant', 'Harlan', 'Lincoln', 'Anderson', 'Rowan', 'Ohio', 'Mercer',
    'Bell', 'Johnson', 'Allen', 'Breckinridge', 'Spencer', 'Simpson', 'Bourbon', 'Letcher', 'Hart', 'Marion',
    'Wayne', 'Clay', 'Harrison', 'Adair', 'Russell', 'Garrard', 'Mason', 'McCreary', 'Rockcastle', 'Henry',
    'Casey', 'Lawrence', 'Fleming', 'Larue', 'Pendleton', 'Trigg', 'Morgan', 'Estill', 'Knott', 'Jackson',
    'Union', 'Bath', 'Powell', 'Lewis', 'Webster', 'Breathitt', 'Todd', 'Edmonson', 'Caldwell', 'Butler',
    'Washington', 'Green', 'Owen', 'Monroe', 'Magoffin', 'Carroll', 'Martin', 'Metcalfe', 'Leslie', 'Clinton',
    'McLean', 'Lyon', 'Hancock', 'Crittenden', 'Livingston', 'Gallatin', 'Trimble', 'Bracken', 'Nicholas', 'Ballard',
    'Lee', 'Elliott', 'Wolfe', 'Menifee', 'Fulton', 'Cumberland', 'Carlisle', 'Hickman', 'Owsley', 'Robertson'
];

// Practice areas in priority order (value: text)
const PRACTICE_AREAS = [
    { value: '44', text: 'Personal Injury' },
    { value: '29', text: 'Immigration and Naturalization' },
    { value: '54', text: 'Workers Compensation' },
    { value: '6', text: 'Bankruptcy' },
    { value: '20', text: 'Criminal Law' },
    { value: '23', text: 'Family Law' },
    { value: '50', text: 'Social Security' },
    { value: '21', text: 'Elder Law' },
    { value: '37', text: 'Mediation' },
    { value: '22', text: 'Employment Law/Labor Law' },
    { value: '45', text: 'Probate Law' },
    { value: '25', text: 'Estate Planning/Trusts' },
    { value: '7', text: 'Civil Litigation' },
    { value: '46', text: 'Real Estate' },
    { value: '32', text: 'Insurance' },
    { value: '18', text: 'Construction Law' },
    { value: '38', text: 'Medical Malpractice' },
    { value: '52', text: 'Tax Law' },
    { value: '10', text: 'Commercial Law' },
    { value: '5', text: 'Banking and Finance Law' }
];

// ============================================================================
// Firebase Initialization
// ============================================================================

let db;

function initFirebase() {
    if (admin.apps.length === 0) {
        let serviceAccount;

        // First try FIREBASE_SERVICE_ACCOUNT env var (GitHub Actions)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else {
            // Fall back to local file (local development)
            const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error(`Service account key not found. Set FIREBASE_SERVICE_ACCOUNT env var or place key at ${serviceAccountPath}`);
            }
            serviceAccount = require(serviceAccountPath);
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    db = admin.firestore();
    db.settings({ databaseId: 'preintake' });
    return db;
}

// ============================================================================
// Email Notification
// ============================================================================

async function sendNotificationEmail(subject, body) {
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

    try {
        await transporter.sendMail({
            from: `"KY Bar Scraper" <${smtpUser}>`,
            to: 'scscot@gmail.com',
            subject,
            text: body
        });
        console.log('Notification email sent');
    } catch (error) {
        console.error('Failed to send notification email:', error.message);
    }
}

// ============================================================================
// Progress Tracking
// ============================================================================

async function getProgress() {
    const doc = await db.collection('preintake_scrape_progress').doc('kybar').get();
    if (doc.exists) {
        const data = doc.data();
        return {
            completedPracticeAreaIds: data.completedPracticeAreaIds || [],
            currentPracticeAreaId: data.currentPracticeAreaId || null,
            currentPage: data.currentPage || 1,
            practiceAreaIdsNeedingCounties: data.practiceAreaIdsNeedingCounties || [],
            completedCountyCombos: data.completedCountyCombos || {},
            lastRunDate: data.lastRunDate || null,
            totalInserted: data.totalInserted || 0,
            totalSkipped: data.totalSkipped || 0
        };
    }
    return {
        completedPracticeAreaIds: [],
        currentPracticeAreaId: null,
        currentPage: 1,
        practiceAreaIdsNeedingCounties: [],
        completedCountyCombos: {},
        lastRunDate: null,
        totalInserted: 0,
        totalSkipped: 0
    };
}

async function saveProgress(progress) {
    if (DRY_RUN) {
        console.log('[DRY RUN] Would save progress:', progress);
        return;
    }
    await db.collection('preintake_scrape_progress').doc('kybar').set(progress, { merge: true });
}

// ============================================================================
// Deduplication Check
// ============================================================================

async function emailExists(email) {
    const snapshot = await db.collection('preintake_emails')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
    return !snapshot.empty;
}

// ============================================================================
// Main Scraping Logic
// ============================================================================

async function scrapeKyBar() {
    console.log('=== Kentucky Bar Association Scraper ===');
    console.log(`DRY_RUN: ${DRY_RUN}`);
    console.log(`MAX_ATTORNEYS: ${MAX_ATTORNEYS}`);
    console.log(`COUNTY_SUBDIVISION_THRESHOLD: ${COUNTY_SUBDIVISION_THRESHOLD}`);
    console.log(`SPECIFIC_PRACTICE_AREA: ${SPECIFIC_PRACTICE_AREA || 'Following priority order'}`);
    console.log('');

    // Initialize Firebase
    initFirebase();

    // Get progress
    const progress = await getProgress();
    console.log('Progress:', JSON.stringify(progress, null, 2));

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
        // PHASE 1: Check for practice areas that need county subdivision
        for (const paId of progress.practiceAreaIdsNeedingCounties) {
            if (totalInserted >= MAX_ATTORNEYS) break;

            const practiceArea = PRACTICE_AREAS.find(p => p.value === paId);
            if (!practiceArea) continue;

            const completedCounties = progress.completedCountyCombos[paId] || [];
            const remainingCounties = KENTUCKY_COUNTIES.filter(c => !completedCounties.includes(c));

            if (remainingCounties.length === 0) {
                // All counties done, move to completed
                progress.practiceAreaIdsNeedingCounties = progress.practiceAreaIdsNeedingCounties.filter(id => id !== paId);
                progress.completedPracticeAreaIds.push(paId);
                await saveProgress(progress);
                continue;
            }

            console.log(`\n=== Scraping: ${practiceArea.text} by County (${remainingCounties.length} counties remaining) ===`);

            for (const county of remainingCounties) {
                if (totalInserted >= MAX_ATTORNEYS) break;

                console.log(`\n--- County: ${county} ---`);
                const result = await scrapePracticeAreaWithCounty(browser, practiceArea, county, MAX_ATTORNEYS - totalInserted, progress);

                totalInserted += result.inserted;
                totalSkipped += result.skipped;
                totalErrors += result.errors;

                // Mark county as complete
                if (!progress.completedCountyCombos[paId]) {
                    progress.completedCountyCombos[paId] = [];
                }
                progress.completedCountyCombos[paId].push(county);

                // Save progress after each county
                progress.lastRunDate = new Date().toISOString();
                progress.totalInserted = (progress.totalInserted || 0) + result.inserted;
                progress.totalSkipped = (progress.totalSkipped || 0) + result.skipped;
                await saveProgress(progress);
            }
        }

        // PHASE 2: Scrape practice areas that don't need subdivision
        let practiceAreasToScrape = PRACTICE_AREAS;

        if (SPECIFIC_PRACTICE_AREA) {
            const pa = PRACTICE_AREAS.find(p =>
                p.text.toLowerCase() === SPECIFIC_PRACTICE_AREA.toLowerCase()
            );
            if (pa) {
                practiceAreasToScrape = [pa];
            } else {
                console.error(`Practice area "${SPECIFIC_PRACTICE_AREA}" not found`);
                process.exit(1);
            }
        } else {
            // Filter out completed and county-subdivision practice areas
            practiceAreasToScrape = PRACTICE_AREAS.filter(
                pa => !progress.completedPracticeAreaIds.includes(pa.value) &&
                      !progress.practiceAreaIdsNeedingCounties.includes(pa.value)
            );
        }

        // Check if we should resume a practice area in progress
        if (progress.currentPracticeAreaId && !SPECIFIC_PRACTICE_AREA) {
            const resumePa = PRACTICE_AREAS.find(p => p.value === progress.currentPracticeAreaId);
            if (resumePa && !progress.completedPracticeAreaIds.includes(resumePa.value)) {
                // Move this practice area to the front
                practiceAreasToScrape = practiceAreasToScrape.filter(p => p.value !== resumePa.value);
                practiceAreasToScrape.unshift(resumePa);
                console.log(`Resuming ${resumePa.text} from page ${progress.currentPage}`);
            }
        }

        if (practiceAreasToScrape.length === 0 && progress.practiceAreaIdsNeedingCounties.length === 0) {
            console.log('All practice areas have been scraped!');
            return;
        }

        console.log(`\nPractice areas to scrape: ${practiceAreasToScrape.map(p => p.text).join(', ')}`);
        console.log('');

        for (const practiceArea of practiceAreasToScrape) {
            if (totalInserted >= MAX_ATTORNEYS) {
                console.log(`Reached MAX_ATTORNEYS limit (${MAX_ATTORNEYS}), stopping.`);
                break;
            }

            console.log(`\n=== Scraping: ${practiceArea.text} (value=${practiceArea.value}) ===`);

            // Determine starting page
            const startPage = (progress.currentPracticeAreaId === practiceArea.value) ? progress.currentPage : 1;

            const result = await scrapePracticeArea(browser, practiceArea, MAX_ATTORNEYS - totalInserted, progress, startPage);

            totalInserted += result.inserted;
            totalSkipped += result.skipped;
            totalErrors += result.errors;

            // Check if this practice area needs county subdivision
            if (result.needsCountySubdivision) {
                console.log(`⚠ ${practiceArea.text} has ${result.totalResults} attorneys - adding to county subdivision queue`);
                if (!progress.practiceAreaIdsNeedingCounties.includes(practiceArea.value)) {
                    progress.practiceAreaIdsNeedingCounties.push(practiceArea.value);
                }
                // Don't mark as complete - will be handled via county subdivision
            } else if (result.complete && !SPECIFIC_PRACTICE_AREA) {
                // Mark practice area as complete
                progress.completedPracticeAreaIds.push(practiceArea.value);
                progress.currentPracticeAreaId = null;
                progress.currentPage = 1;
            }

            // Save progress after each practice area
            progress.lastRunDate = new Date().toISOString();
            progress.totalInserted = (progress.totalInserted || 0) + result.inserted;
            progress.totalSkipped = (progress.totalSkipped || 0) + result.skipped;
            await saveProgress(progress);
        }

    } catch (error) {
        console.error('Scraping error:', error);
    } finally {
        await browser.close();
    }

    // Summary
    const summary = `
Kentucky Bar Scraper Complete
=============================
Inserted: ${totalInserted}
Skipped: ${totalSkipped}
Errors: ${totalErrors}
DRY_RUN: ${DRY_RUN}
    `.trim();

    console.log('\n' + summary);

    // Send notification email
    await sendNotificationEmail(
        `KY Bar Scraper: ${totalInserted} inserted, ${totalSkipped} skipped`,
        summary
    );
}

async function scrapePracticeArea(browser, practiceArea, maxAttorneys, progress, startPage = 1) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    let complete = false;
    let needsCountySubdivision = false;
    let totalResults = 0;

    try {
        // Navigate to the Find a Lawyer page
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Get the iframe
        const iframeHandle = await page.$('iframe[src*="LawyerLocator"]');
        if (!iframeHandle) {
            console.error('Could not find lawyer locator iframe');
            return { inserted, skipped, errors: 1, complete: false, needsCountySubdivision: false, totalResults: 0 };
        }

        const iframe = await iframeHandle.contentFrame();
        if (!iframe) {
            console.error('Could not access iframe content');
            return { inserted, skipped, errors: 1, complete: false, needsCountySubdivision: false, totalResults: 0 };
        }

        // Wait for iframe content to load
        await iframe.waitForSelector('select[name="PRACTICEAREA"]', { timeout: 10000 });

        // Select the practice area
        await iframe.select('select[name="PRACTICEAREA"]', practiceArea.value);
        console.log(`Selected practice area: ${practiceArea.text}`);

        // Click search button
        const allButtons = await iframe.$$('button');
        let searchBtn = null;
        for (const btn of allButtons) {
            const text = await btn.evaluate(el => el.textContent.trim());
            if (text.includes('Search')) {
                searchBtn = btn;
                break;
            }
        }

        if (!searchBtn) {
            console.error('Could not find search button');
            return { inserted, skipped, errors: 1, complete: false, needsCountySubdivision: false, totalResults: 0 };
        }

        await searchBtn.click();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get total results count - format is "Search Results - X matches"
        const h3Elements = await iframe.$$eval('h3', els => els.map(el => el.textContent.trim()));
        const resultsHeader = h3Elements.find(h => h.includes('matches')) || '';
        const totalMatch = resultsHeader.match(/(\d+)\s+matches/);
        totalResults = totalMatch ? parseInt(totalMatch[1]) : 0;
        console.log(`Total results: ${totalResults}`);

        // Check if county subdivision is needed
        if (totalResults > COUNTY_SUBDIVISION_THRESHOLD) {
            console.log(`⚠ Results (${totalResults}) exceed threshold (${COUNTY_SUBDIVISION_THRESHOLD}) - will need county subdivision`);
            needsCountySubdivision = true;
            // Don't scrape this one - let it be handled via county subdivision
            // page.close() will be called in finally block
            return { inserted: 0, skipped: 0, errors: 0, complete: false, needsCountySubdivision: true, totalResults };
        }

        // Track current practice area and starting page for resume capability
        progress.currentPracticeAreaId = practiceArea.value;
        progress.currentPage = startPage;
        if (!DRY_RUN) {
            await saveProgress(progress);
        }

        // Navigate to starting page if not page 1
        let pageNum = 1;
        if (startPage > 1) {
            console.log(`Navigating to page ${startPage}...`);
            const targetPageLink = await iframe.$(`a.btn-outline-primary[href*="RANGE=${((startPage - 1) * 12) + 1}"]`);
            if (targetPageLink) {
                await targetPageLink.click();
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES));
                pageNum = startPage;
            } else {
                console.log(`Could not find page ${startPage}, starting from page 1`);
            }
        }

        let hasMorePages = true;

        while (hasMorePages && inserted < maxAttorneys) {
            console.log(`\nPage ${pageNum}...`);

            // Get all profile links on current page
            const profileLinks = await iframe.$$('[onclick*="openLawyerInfo"]');
            console.log(`Found ${profileLinks.length} profiles on this page`);

            for (let i = 0; i < profileLinks.length && inserted < maxAttorneys; i++) {
                try {
                    // Re-query the links each time since DOM may have changed
                    const currentLinks = await iframe.$$('[onclick*="openLawyerInfo"]');
                    if (i >= currentLinks.length) {
                        console.log('Profile links changed, breaking');
                        break;
                    }

                    const link = currentLinks[i];

                    // Get the customer code from onclick
                    const onclick = await link.evaluate(el => el.getAttribute('onclick'));
                    const codeMatch = onclick.match(/openLawyerInfo\('(\d+)'\)/);
                    const customerCode = codeMatch ? codeMatch[1] : null;

                    // Get the name from the link text
                    const name = await link.evaluate(el => el.textContent.trim());

                    console.log(`  [${i + 1}/${profileLinks.length}] ${name} (${customerCode})`);

                    // Click to open profile
                    await link.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Extract profile data
                    const profileData = await extractProfileData(iframe, name, customerCode, practiceArea.text);

                    if (!profileData.email) {
                        console.log(`    ✗ No email found, skipping`);
                        skipped++;

                        // Click back to results
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Check for duplicate
                    const exists = await emailExists(profileData.email);
                    if (exists) {
                        console.log(`    ✗ Email already exists, skipping`);
                        skipped++;

                        // Click back to results
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Check for government/institutional contact
                    if (isGovernmentContact(profileData.email, profileData.firmName)) {
                        console.log(`    ⊘ Skipped (government): ${profileData.email}`);
                        skipped++;
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Insert into Firestore
                    if (DRY_RUN) {
                        console.log(`    [DRY RUN] Would insert:`, profileData);
                    } else {
                        await db.collection('preintake_emails').add({
                            ...profileData,
                            source: 'kybar',
                            state: 'KY',
                            practiceArea: practiceArea.text,
                            sent: false,
                            status: 'pending',
                            randomIndex: Math.random() * 0.1, // Priority range 0-0.1
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    console.log(`    ✓ Inserted: ${profileData.email}`);
                    inserted++;

                    // Click back to results
                    await clickBackToResults(iframe);

                    // Delay between profiles
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PROFILES));

                } catch (e) {
                    console.error(`    Error processing profile:`, e.message);
                    errors++;

                    // Try to get back to results
                    try {
                        await clickBackToResults(iframe);
                    } catch (e2) {
                        // If we can't get back, we need to restart the search
                        console.log('    Could not return to results, restarting search...');
                        break;
                    }
                }
            }

            // Check for next page
            const nextPageLink = await iframe.$(`a.btn-outline-primary[href*="RANGE=${(pageNum * 12) + 1}"]`);
            if (nextPageLink && inserted < maxAttorneys) {
                console.log(`\nNavigating to page ${pageNum + 1}...`);
                await nextPageLink.click();
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES));
                pageNum++;

                // Save page-level progress for resume capability
                progress.currentPage = pageNum;
                if (!DRY_RUN) {
                    await saveProgress(progress);
                }
            } else {
                hasMorePages = false;
                if (!nextPageLink) {
                    complete = true; // No more pages = practice area complete
                }
            }
        }

    } catch (error) {
        console.error('Error scraping practice area:', error);
        errors++;
    } finally {
        try {
            await page.close();
        } catch (e) {
            // Page may already be closed - ignore
        }
    }

    return { inserted, skipped, errors, complete, needsCountySubdivision, totalResults };
}

/**
 * Scrape a practice area with county filter (for large practice areas > 500)
 */
async function scrapePracticeAreaWithCounty(browser, practiceArea, county, maxAttorneys, progress) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    try {
        // Navigate to the Find a Lawyer page
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Get the iframe
        const iframeHandle = await page.$('iframe[src*="LawyerLocator"]');
        if (!iframeHandle) {
            console.error('Could not find lawyer locator iframe');
            return { inserted, skipped, errors: 1 };
        }

        const iframe = await iframeHandle.contentFrame();
        if (!iframe) {
            console.error('Could not access iframe content');
            return { inserted, skipped, errors: 1 };
        }

        // Wait for iframe content to load
        await iframe.waitForSelector('select[name="PRACTICEAREA"]', { timeout: 10000 });

        // Select the practice area
        await iframe.select('select[name="PRACTICEAREA"]', practiceArea.value);
        console.log(`Selected practice area: ${practiceArea.text}`);

        // Select the county
        await iframe.select('select[name="COUNTY"]', county);
        console.log(`Selected county: ${county}`);

        // Click search button
        const allButtons = await iframe.$$('button');
        let searchBtn = null;
        for (const btn of allButtons) {
            const text = await btn.evaluate(el => el.textContent.trim());
            if (text.includes('Search')) {
                searchBtn = btn;
                break;
            }
        }

        if (!searchBtn) {
            console.error('Could not find search button');
            return { inserted, skipped, errors: 1 };
        }

        await searchBtn.click();
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Get total results count - format is "Search Results - X matches"
        const h3Elements = await iframe.$$eval('h3', els => els.map(el => el.textContent.trim()));
        const resultsHeader = h3Elements.find(h => h.includes('matches')) || '';
        const totalMatch = resultsHeader.match(/(\d+)\s+matches/);
        const totalResults = totalMatch ? parseInt(totalMatch[1]) : 0;
        console.log(`Total results for ${practiceArea.text} + ${county}: ${totalResults}`);

        if (totalResults === 0) {
            console.log(`No attorneys found for ${county}, skipping`);
            await page.close();
            return { inserted, skipped, errors };
        }

        let pageNum = 1;
        let hasMorePages = true;

        while (hasMorePages && inserted < maxAttorneys) {
            console.log(`\nPage ${pageNum}...`);

            // Get all profile links on current page
            const profileLinks = await iframe.$$('[onclick*="openLawyerInfo"]');
            console.log(`Found ${profileLinks.length} profiles on this page`);

            for (let i = 0; i < profileLinks.length && inserted < maxAttorneys; i++) {
                try {
                    // Re-query the links each time since DOM may have changed
                    const currentLinks = await iframe.$$('[onclick*="openLawyerInfo"]');
                    if (i >= currentLinks.length) {
                        console.log('Profile links changed, breaking');
                        break;
                    }

                    const link = currentLinks[i];

                    // Get the customer code from onclick
                    const onclick = await link.evaluate(el => el.getAttribute('onclick'));
                    const codeMatch = onclick.match(/openLawyerInfo\('(\d+)'\)/);
                    const customerCode = codeMatch ? codeMatch[1] : null;

                    // Get the name from the link text
                    const name = await link.evaluate(el => el.textContent.trim());

                    console.log(`  [${i + 1}/${profileLinks.length}] ${name} (${customerCode})`);

                    // Click to open profile
                    await link.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Extract profile data
                    const profileData = await extractProfileData(iframe, name, customerCode, practiceArea.text);

                    if (!profileData.email) {
                        console.log(`    ✗ No email found, skipping`);
                        skipped++;

                        // Click back to results
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Check for duplicate
                    const exists = await emailExists(profileData.email);
                    if (exists) {
                        console.log(`    ✗ Email already exists, skipping`);
                        skipped++;

                        // Click back to results
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Check for government/institutional contact
                    if (isGovernmentContact(profileData.email, profileData.firmName)) {
                        console.log(`    ⊘ Skipped (government): ${profileData.email}`);
                        skipped++;
                        await clickBackToResults(iframe);
                        continue;
                    }

                    // Insert into Firestore
                    if (DRY_RUN) {
                        console.log(`    [DRY RUN] Would insert:`, profileData);
                    } else {
                        await db.collection('preintake_emails').add({
                            ...profileData,
                            source: 'kybar',
                            state: 'KY',
                            practiceArea: practiceArea.text,
                            county: county,
                            sent: false,
                            status: 'pending',
                            randomIndex: Math.random() * 0.1, // Priority range 0-0.1
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    console.log(`    ✓ Inserted: ${profileData.email}`);
                    inserted++;

                    // Click back to results
                    await clickBackToResults(iframe);

                    // Delay between profiles
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PROFILES));

                } catch (e) {
                    console.error(`    Error processing profile:`, e.message);
                    errors++;

                    // Try to get back to results
                    try {
                        await clickBackToResults(iframe);
                    } catch (e2) {
                        // If we can't get back, we need to restart the search
                        console.log('    Could not return to results, breaking');
                        break;
                    }
                }
            }

            // Check for next page
            const nextPageLink = await iframe.$(`a.btn-outline-primary[href*="RANGE=${(pageNum * 12) + 1}"]`);
            if (nextPageLink && inserted < maxAttorneys) {
                console.log(`\nNavigating to page ${pageNum + 1}...`);
                await nextPageLink.click();
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES));
                pageNum++;
            } else {
                hasMorePages = false;
            }
        }

    } catch (error) {
        console.error('Error scraping practice area with county:', error);
        errors++;
    } finally {
        try {
            await page.close();
        } catch (e) {
            // Page may already be closed - ignore
        }
    }

    return { inserted, skipped, errors };
}

async function extractProfileData(iframe, name, customerCode, practiceArea) {
    const data = {
        firstName: '',
        lastName: '',
        firmName: '',
        email: null,
        phone: null,
        website: null,
        city: null,
        customerCode
    };

    // Parse name (handle suffixes like Jr, II, III, IV)
    const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'V'];
    let nameParts = name.split(' ').filter(p => p.length > 0);

    // Remove suffix if present
    let suffix = '';
    if (nameParts.length > 0 && suffixes.includes(nameParts[nameParts.length - 1])) {
        suffix = nameParts.pop();
    }

    if (nameParts.length >= 2) {
        data.firstName = nameParts[0];
        // Last name is everything after the first name (handles middle names)
        data.lastName = nameParts.slice(1).join(' ');
        if (suffix) {
            data.lastName += ' ' + suffix;
        }
    } else if (nameParts.length === 1) {
        data.firstName = nameParts[0];
        data.lastName = suffix || '';
    } else {
        data.firstName = name;
        data.lastName = '';
    }

    try {
        // Get email from mailto link
        const mailtoLinks = await iframe.$$eval('a[href^="mailto:"]', links =>
            links.map(l => l.href.replace('mailto:', '').toLowerCase())
        );
        if (mailtoLinks.length > 0) {
            data.email = mailtoLinks[0];
        }

        // Get phone
        const phoneLinks = await iframe.$$eval('a[href^="tel:"]', links =>
            links.map(l => l.href.replace('tel:', ''))
        );
        if (phoneLinks.length > 0) {
            data.phone = phoneLinks[0];
        }

        // Try to extract firm name, city, website from profile text
        const profileText = await iframe.evaluate(() => document.body.innerText);
        const lines = profileText.split('\n').map(l => l.trim()).filter(l => l);

        // Look for website
        const websiteMatch = profileText.match(/https?:\/\/[^\s]+/);
        if (websiteMatch) {
            // Filter out kybar.org and common social media
            const url = websiteMatch[0];
            if (!url.includes('kybar.org') &&
                !url.includes('facebook.com') &&
                !url.includes('linkedin.com') &&
                !url.includes('twitter.com')) {
                data.website = url;
            }
        }

        // Look for firm name (usually follows the attorney name)
        // This is heuristic and may need adjustment
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(name) && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // If next line doesn't look like an address and isn't the attorney info header
                if (!nextLine.match(/^\d/) && !nextLine.includes('Attorney Info')) {
                    data.firmName = nextLine;
                }
                break;
            }
        }

        // Look for city (usually in address line with state)
        // Match pattern: City, KY 40XXX (city is just before the comma and state)
        const cityMatch = profileText.match(/\n([A-Za-z][A-Za-z\s]*?),\s*KY\s*\d{5}/);
        if (cityMatch) {
            // Get just the last word before the comma (the actual city name)
            const cityCandidate = cityMatch[1].trim();
            // If it contains newline or looks like street address, try to extract just the city
            if (cityCandidate.includes('\n')) {
                const lastLine = cityCandidate.split('\n').pop().trim();
                data.city = lastLine;
            } else {
                // Get the last "word" which should be the city
                const words = cityCandidate.split(/\s+/);
                // Take last 1-2 words as city (e.g., "Ft Mitchell", "Louisville")
                if (words.length > 2) {
                    data.city = words.slice(-2).join(' ');
                } else {
                    data.city = cityCandidate;
                }
            }
        }

    } catch (e) {
        console.log(`    Warning: Error extracting profile data: ${e.message}`);
    }

    return data;
}

async function clickBackToResults(iframe) {
    // Look for button with "Back to Results" text specifically
    const buttons = await iframe.$$('button');
    for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent.trim());
        if (text === 'Back to Results') {
            await btn.click();
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Wait for results to be visible again
            await iframe.waitForSelector('#lawyerLocatorResults', { visible: true, timeout: 5000 });
            return true;
        }
    }

    // Alternative: Execute the jQuery directly to show results
    try {
        await iframe.evaluate(() => {
            if (typeof $ !== 'undefined') {
                $('#lawyerLocatorInfo').slideUp();
                $('#lawyerLocatorResults').slideDown();
            }
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
    } catch (e) {
        console.log(`    Warning: Could not execute jQuery fallback: ${e.message}`);
    }

    return false;
}

// ============================================================================
// Entry Point
// ============================================================================

scrapeKyBar().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
