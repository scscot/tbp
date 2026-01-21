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
 *   MAX_ATTORNEYS - Maximum attorneys to process per run (default: 500)
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

const DELAY_BETWEEN_PAGES = 3000;
const DELAY_BETWEEN_PROFILES = 1500;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
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
        lastRunDate: data.lastRunDate || null
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
async function extractLicenseNumbers(page) {
    return await page.evaluate(() => {
        const licenseNumbers = [];

        // The results are in a table with columns: License Number, First Name, Last Name, City, Status, Phone
        // Try to find table rows with license number data
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    // First cell should be license number
                    const firstCell = cells[0].textContent?.trim();
                    // License numbers are numeric
                    if (firstCell && /^\d+$/.test(firstCell)) {
                        licenseNumbers.push(firstCell);
                    }
                }
            }
        }

        // Also look for links that might contain license numbers
        const links = document.querySelectorAll('a[href*="LegalProfile"], a[href*="Usr_ID"]');
        links.forEach(link => {
            const match = link.href.match(/Usr_ID=(\d+)/);
            if (match && !licenseNumbers.includes(match[1])) {
                licenseNumbers.push(match[1]);
            }
        });

        // Try to find license numbers in GridView or DataGrid format (ASP.NET)
        const gridCells = document.querySelectorAll('[class*="GridView"] td:first-child, [id*="GridView"] td:first-child');
        gridCells.forEach(cell => {
            const text = cell.textContent?.trim();
            if (text && /^\d+$/.test(text) && !licenseNumbers.includes(text)) {
                licenseNumbers.push(text);
            }
        });

        return [...new Set(licenseNumbers)]; // Dedupe
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
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(1000);

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
            const nameHeader = document.querySelector('h1, h2, .attorney-name, .profile-name');
            if (nameHeader) {
                result.fullName = nameHeader.textContent.trim();
                // Try to split name
                const nameParts = result.fullName.split(/\s+/);
                if (nameParts.length >= 2) {
                    result.firstName = nameParts[0];
                    result.lastName = nameParts[nameParts.length - 1];
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

            // Extract firm name - look for "Firm:" or "Company:" labels
            const firmMatch = bodyText.match(/(?:Firm|Company|Organization|Employer)[:\s]+([^\n]+)/i);
            if (firmMatch) {
                result.firmName = firmMatch[1].trim();
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
        noEmail: 0,
        errors: 0
    };

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;
    const allLicenseNumbers = [];

    try {
        // Navigate to search results
        const searchUrl = `${SEARCH_URL}?ShowSearchResults=TRUE&EligibleToPractice=Y&AreaOfPractice=${encodeURIComponent(slug)}`;
        console.log(`   URL: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(5000); // Wait longer for ASP.NET page to fully render

        // Get total results
        stats.totalResults = await getResultsCount(page);
        console.log(`   Total results: ${stats.totalResults}`);

        if (stats.totalResults === 0) {
            console.log('   No results found');
            await page.close();
            return stats;
        }

        // Extract license numbers from all pages
        let pageNum = 1;
        let hasMore = true;

        while (hasMore && allLicenseNumbers.length < MAX_ATTORNEYS) {
            console.log(`   Page ${pageNum}...`);

            const pageNumbers = await extractLicenseNumbers(page);
            console.log(`     Found ${pageNumbers.length} license numbers on page`);

            // Add new numbers (dedupe)
            for (const num of pageNumbers) {
                if (!allLicenseNumbers.includes(num)) {
                    allLicenseNumbers.push(num);
                }
            }

            if (allLicenseNumbers.length >= MAX_ATTORNEYS) {
                console.log(`     Reached MAX_ATTORNEYS limit`);
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

        console.log(`   Total license numbers collected: ${allLicenseNumbers.length}`);

        // Now fetch each profile
        console.log(`   Fetching profiles...`);

        for (let i = 0; i < allLicenseNumbers.length && i < MAX_ATTORNEYS; i++) {
            const licenseNum = allLicenseNumbers[i];
            stats.profilesFetched++;

            // Skip if barNumber already exists in DB (avoids re-fetching profile)
            if (existingBarNumbers.has(licenseNum)) {
                stats.skipped++;
                continue;
            }

            try {
                const profile = await scrapeProfile(page, licenseNum);

                if (!profile) {
                    stats.errors++;
                    continue;
                }

                // Skip if no email
                if (!profile.email || !profile.email.includes('@')) {
                    stats.noEmail++;
                    continue;
                }

                // Skip if already exists
                const emailLower = profile.email.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    stats.skipped++;
                    continue;
                }

                // Create document
                const docData = {
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    firmName: profile.firmName || `${profile.firstName} ${profile.lastName}, Attorney at Law`,
                    email: emailLower,
                    phone: profile.phone,
                    website: profile.website,
                    practiceArea: displayName,
                    city: profile.city,
                    state: profile.state || DEFAULT_STATE,
                    source: SOURCE,
                    barNumber: profile.barNumber || licenseNum,
                    memberUrl: `${PROFILE_URL}?Usr_ID=${licenseNum}`,
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
                existingBarNumbers.add(licenseNum);
                stats.inserted++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`     Committed batch of ${batchCount}`);
                    batch = db.batch();
                    batchCount = 0;
                }

                // Progress logging
                if ((i + 1) % 25 === 0) {
                    console.log(`     Processed ${i + 1}/${Math.min(allLicenseNumbers.length, MAX_ATTORNEYS)} (${stats.inserted} inserted)`);
                }

                await sleepWithJitter(DELAY_BETWEEN_PROFILES);

            } catch (error) {
                stats.errors++;
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

        console.log(`   ✓ Inserted ${stats.inserted}, Skipped ${stats.skipped}, No Email ${stats.noEmail}, Errors ${stats.errors}`);

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

    // Load existing emails and bar numbers for deduplication
    console.log('Loading existing emails and bar numbers...');
    const existingEmails = new Set();
    const existingBarNumbers = new Set();
    const existingSnapshot = await db.collection('preintake_emails')
        .where('source', '==', SOURCE)
        .select('email', 'barNumber')
        .get();
    existingSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email) existingEmails.add(data.email.toLowerCase());
        if (data.barNumber) existingBarNumbers.add(data.barNumber.toString());
    });
    console.log(`Loaded ${existingEmails.size} existing emails, ${existingBarNumbers.size} bar numbers\n`);

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

        // Process practice areas
        for (const practiceArea of areasToScrape) {
            // Skip completed practice areas (unless specific one requested)
            if (!PRACTICE_AREA_SLUG && progress.scrapedPracticeAreaSlugs.includes(practiceArea.slug)) {
                console.log(`\nSkipping ${practiceArea.displayName} (already completed)`);
                continue;
            }

            // Skip permanently skipped
            if (progress.permanentlySkipped.includes(practiceArea.slug)) {
                console.log(`\nSkipping ${practiceArea.displayName} (permanently skipped)`);
                continue;
            }

            // Check if we've hit MAX_ATTORNEYS
            if (totalInsertedThisRun >= MAX_ATTORNEYS) {
                console.log(`\nReached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
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

            // Save progress after each practice area
            progress.totalInserted = (progress.totalInserted || 0) + stats.inserted;
            progress.totalSkipped = (progress.totalSkipped || 0) + stats.skipped;
            progress.lastRunDate = new Date().toISOString();

            if (!DRY_RUN) {
                await saveProgress(progress);
            }

            // Delay between practice areas
            await sleepWithJitter(5000);
        }

        // Summary
        const totalInDb = await getTotalAttorneysInDb();
        const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`   Practice areas scraped: ${allStats.length}`);
        console.log(`   Inserted this run: ${totalInsertedThisRun}`);
        console.log(`   Total WSBA in DB: ${totalInDb.toLocaleString()}`);
        console.log(`   Practice areas complete: ${progress.scrapedPracticeAreaSlugs.length}/${PRACTICE_AREAS.length}`);
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
