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

// Practice area ID to name mapping
const PRACTICE_AREAS = {
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
    53: 'Professional Liability'
};

// Priority order for scraping (based on practice-area-targets.md)
const PRACTICE_AREA_ORDER = [51, 34, 63, 46, 52, 58, 9, 42, 16, 66, 36, 10, 43, 53];

// Configuration
const BASE_URL = 'https://apps.calbar.ca.gov';
const SEARCH_URL = `${BASE_URL}/attorney/LicenseeSearch/AdvancedSearch`;
const DETAIL_URL_PREFIX = `${BASE_URL}/attorney/Licensee/Detail/`;
const USER_AGENT = 'PreIntake.ai Scraper (+https://preintake.ai)';
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS || '500', 10);
const DELAY_BETWEEN_PAGES = 2000;  // 2 seconds
const DELAY_BETWEEN_DETAILS = 1000;  // 1 second
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
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`   ⚠️  Rate limited (${response.status}), waiting ${waitTime}ms...`);
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
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`   ⚠️  Fetch failed (${error.message}), retry ${attempt}/${retries} in ${waitTime}ms...`);
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

        return {
            success: true,
            data: {
                firstName,
                lastName,
                firmName,
                email,
                website,
                practiceArea: practiceAreaName,
                state: 'CA',
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
            from: 'PreIntake CalBar <scott@legal.preintake.ai>',
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
            from: 'PreIntake CalBar <scott@legal.preintake.ai>',
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
                await sleep(DELAY_BETWEEN_PAGES);
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
            await sleep(DELAY_BETWEEN_DETAILS);
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
            await sleep(DELAY_BETWEEN_DETAILS);
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

        await sleep(DELAY_BETWEEN_DETAILS);
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
