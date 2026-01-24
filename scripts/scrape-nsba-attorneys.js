#!/usr/bin/env node

/**
 * Nebraska State Bar Association (NSBA) Attorney Scraper
 *
 * Scrapes attorney contact information from www.nebar.com
 * Uses Puppeteer to interact with iframe-based search results and extract profile data.
 *
 * Features:
 * - Handles iframe-based search results (YourMembership platform)
 * - Caesar cipher email decryption (CharShiftDecrypt with shift of 6)
 * - Profile detail extraction via direct profile page visits
 * - Email, phone, firm, website, practice area extraction
 * - Deduplication against existing Firestore records
 * - Progress tracking for resume capability
 * - Government contact filtering
 *
 * Firebase Authentication:
 * - Uses FIREBASE_SERVICE_ACCOUNT env var (JSON string) in GitHub Actions
 * - Falls back to secrets/serviceAccountKey.json for local development
 *
 * Usage:
 *   DRY_RUN=true node scripts/scrape-nsba-attorneys.js
 *   MAX_ATTORNEYS=100 node scripts/scrape-nsba-attorneys.js
 *
 * Environment Variables:
 *   DRY_RUN - If "true", don't write to Firestore
 *   MAX_ATTORNEYS - Maximum attorneys to scrape per run (default: 500)
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

const BASE_URL = 'https://www.nebar.com';
const SEARCH_URL = `${BASE_URL}/search/custom.asp?id=2319`;
const MAX_ATTORNEYS = parseInt(process.env.MAX_ATTORNEYS) || 500;
const DRY_RUN = process.env.DRY_RUN === 'true';

// Delays to avoid rate limiting
const DELAY_BETWEEN_PROFILES = 1500; // 1.5 seconds between profile fetches
const DELAY_BETWEEN_PAGES = 2000; // 2 seconds between pagination

// ============================================================================
// Email Decryption - CharShiftDecrypt Implementation
// ============================================================================

/**
 * Decrypts email addresses obfuscated with Caesar cipher
 * Nebraska Bar uses shift of 6 with a custom alphabet
 *
 * @param {string} encrypted - The encrypted email string
 * @param {number} shift - The shift value (typically 6)
 * @param {string} alphabet - The character set used for shifting
 * @returns {string} - The decrypted email
 */
function charShiftDecrypt(encrypted, shift, alphabet) {
    if (!encrypted || !alphabet) return '';

    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
        const char = encrypted[i];
        const index = alphabet.indexOf(char);

        if (index === -1) {
            // Character not in alphabet, keep as-is (e.g., @, ., -)
            decrypted += char;
        } else {
            // Shift back by the shift amount
            let newIndex = index - shift;
            if (newIndex < 0) {
                newIndex += alphabet.length;
            }
            decrypted += alphabet[newIndex];
        }
    }
    return decrypted;
}

// The alphabet used by Nebraska Bar
const NEBAR_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
const NEBAR_SHIFT = 6;

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
            from: `"NSBA Scraper" <${smtpUser}>`,
            to: 'scscott@gmail.com',
            subject,
            text: body
        });
        console.log('Notification email sent');
    } catch (error) {
        console.error('Failed to send notification email:', error.message);
    }
}

// ============================================================================
// Scraper Helper Functions
// ============================================================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract profile IDs from the search results iframe
 * Profile links are in format: /members/?id=35396728
 * Handles pagination within the iframe
 */
async function extractProfileIdsFromIframe(page, maxAttorneys) {
    const allProfileIds = new Set();

    try {
        // Wait for the iframe to load
        await page.waitForSelector('#SearchResultsFrame', { timeout: 30000 });

        // Give the iframe content time to fully load
        await delay(3000);

        // Get the iframe element
        const iframeElement = await page.$('#SearchResultsFrame');
        if (!iframeElement) {
            console.log('Could not find SearchResultsFrame iframe');
            return [...allProfileIds];
        }

        // Get the iframe content
        const iframe = await iframeElement.contentFrame();
        if (!iframe) {
            console.log('Could not access iframe content');
            return [...allProfileIds];
        }

        // Wait for results to load inside iframe
        await delay(2000);

        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages && allProfileIds.size < maxAttorneys) {
            console.log(`  Extracting profiles from page ${currentPage}...`);

            // Extract all profile links from the current page in the iframe
            const links = await iframe.evaluate(() => {
                const anchors = document.querySelectorAll('a[href*="/members/?id="]');
                return Array.from(anchors).map(a => {
                    const href = a.getAttribute('href');
                    const match = href.match(/\/members\/\?id=(\d+)/);
                    return match ? match[1] : null;
                }).filter(id => id !== null);
            });

            // Add to set (deduplicates automatically)
            const beforeCount = allProfileIds.size;
            for (const id of links) {
                allProfileIds.add(id);
            }
            const addedCount = allProfileIds.size - beforeCount;
            console.log(`  Found ${links.length} profiles, added ${addedCount} new (total: ${allProfileIds.size})`);

            // Check if we have enough
            if (allProfileIds.size >= maxAttorneys) {
                console.log(`  Reached max attorneys target (${maxAttorneys})`);
                break;
            }

            // Look for next page link in iframe
            // Common patterns: "Next", "›", ">", page numbers
            const hasNext = await iframe.evaluate(() => {
                // Look for next page links
                const nextLinks = document.querySelectorAll('a.paging-next, a[title*="Next"], a.next, a[rel="next"]');
                for (const link of nextLinks) {
                    if (!link.classList.contains('disabled')) {
                        link.click();
                        return true;
                    }
                }

                // Look for numbered pagination - click next number
                const pageLinks = document.querySelectorAll('.pagination a, .pager a, nav.pagination a');
                const currentActive = document.querySelector('.pagination .active, .pager .active, nav.pagination .active');
                if (currentActive) {
                    const nextSibling = currentActive.parentElement?.nextElementSibling?.querySelector('a');
                    if (nextSibling) {
                        nextSibling.click();
                        return true;
                    }
                }

                // Look for "Show All" or "View All" links
                const allLinks = document.querySelectorAll('a');
                for (const link of allLinks) {
                    const text = link.textContent.toLowerCase();
                    if (text.includes('show all') || text.includes('view all') || text.includes('load more')) {
                        link.click();
                        return true;
                    }
                }

                return false;
            });

            if (hasNext) {
                currentPage++;
                // Wait for new page to load
                await delay(DELAY_BETWEEN_PAGES);
            } else {
                hasMorePages = false;
            }
        }

        console.log(`Total unique profile IDs found: ${allProfileIds.size}`);
        return [...allProfileIds];
    } catch (error) {
        console.error('Error extracting profile IDs from iframe:', error.message);
        return [...allProfileIds];
    }
}

/**
 * Extract attorney data from a profile page
 */
async function extractProfileData(page, profileId) {
    const profileUrl = `${BASE_URL}/members/?id=${profileId}`;

    try {
        await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(1000);

        const data = await page.evaluate((alphabet, shift) => {
            // Helper function to decrypt email (same as charShiftDecrypt but in browser context)
            function decrypt(encrypted, shift, alphabet) {
                if (!encrypted || !alphabet) return '';
                let decrypted = '';
                for (let i = 0; i < encrypted.length; i++) {
                    const char = encrypted[i];
                    const index = alphabet.indexOf(char);
                    if (index === -1) {
                        decrypted += char;
                    } else {
                        let newIndex = index - shift;
                        if (newIndex < 0) newIndex += alphabet.length;
                        decrypted += alphabet[newIndex];
                    }
                }
                return decrypted;
            }

            // Extract name from title or .big class
            let name = '';
            const titleMatch = document.title.match(/^(.+?)\s*-\s*Nebraska State Bar/);
            if (titleMatch) {
                name = titleMatch[1].trim();
            } else {
                const bigEl = document.querySelector('b.big');
                if (bigEl) name = bigEl.textContent.trim();
            }

            // Extract email from the obfuscated script
            let email = '';
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const content = script.textContent || '';
                const match = content.match(/CharShiftDecrypt\('([^']+)',\s*(\d+),\s*'([^']+)'\)/);
                if (match) {
                    const encrypted = match[1];
                    const shiftVal = parseInt(match[2]);
                    const alpha = match[3];
                    email = decrypt(encrypted, shiftVal, alpha);
                    break;
                }
            }

            // Extract firm name
            let firmName = '';
            const employerTd = document.getElementById('tdEmployerName');
            if (employerTd) {
                const firmLink = employerTd.querySelector('a[href*="txt_employName"]');
                if (firmLink) {
                    firmName = firmLink.textContent.trim();
                }
            }

            // Extract title (appears after firm name in the same cell)
            let title = '';
            if (employerTd) {
                const html = employerTd.innerHTML;
                const firmMatch = html.match(/<\/a><br\s*\/?>\s*([^<]+)<br/i);
                if (firmMatch) {
                    title = firmMatch[1].trim();
                }
            }

            // Extract city
            let city = '';
            if (employerTd) {
                const cityLink = employerTd.querySelector('a[href*="txt_city"]');
                if (cityLink) city = cityLink.textContent.trim();
            }

            // Extract state
            let state = '';
            if (employerTd) {
                const stateLink = employerTd.querySelector('a[href*="txt_state"]');
                if (stateLink) state = stateLink.textContent.trim();
            }

            // Extract phone
            let phone = '';
            const phoneTd = document.getElementById('tdWorkPhone');
            if (phoneTd) {
                const phoneText = phoneTd.textContent.trim();
                const phoneMatch = phoneText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
                if (phoneMatch) phone = phoneMatch[0].trim();
            }

            // Extract website
            let website = '';
            if (phoneTd) {
                const websiteLink = phoneTd.querySelector('a[href][target="_blank"]');
                if (websiteLink) {
                    const href = websiteLink.getAttribute('href');
                    if (href && !href.includes('maps.google.com')) {
                        website = href;
                    }
                }
            }

            // Extract practice area
            let practiceArea = '';
            const practiceRow = document.querySelector('tr.CstmFldRow');
            if (practiceRow) {
                const rows = document.querySelectorAll('tr.CstmFldRow');
                for (const row of rows) {
                    const label = row.querySelector('.CstmFldLbl');
                    if (label && label.textContent.includes('Areas of Practice')) {
                        const value = row.querySelector('.CstmFldVal');
                        if (value) {
                            const link = value.querySelector('a');
                            practiceArea = link ? link.textContent.trim() : value.textContent.trim();
                        }
                        break;
                    }
                }
            }

            return {
                name,
                email,
                firmName,
                title,
                city,
                state,
                phone,
                website,
                practiceArea
            };
        }, NEBAR_ALPHABET, NEBAR_SHIFT);

        return {
            ...data,
            profileId,
            memberUrl: profileUrl
        };
    } catch (error) {
        console.error(`Error extracting profile ${profileId}:`, error.message);
        return null;
    }
}

/**
 * Parse attorney name into firstName and lastName
 */
function parseName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };

    // Handle suffixes
    const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'Esq', 'Esq.'];
    let nameParts = fullName.trim().split(/\s+/);

    // Remove suffixes from the end
    while (nameParts.length > 0 && suffixes.some(s =>
        nameParts[nameParts.length - 1].toLowerCase() === s.toLowerCase() ||
        nameParts[nameParts.length - 1].replace(',', '').toLowerCase() === s.toLowerCase()
    )) {
        nameParts.pop();
    }

    if (nameParts.length === 0) return { firstName: '', lastName: '' };
    if (nameParts.length === 1) return { firstName: nameParts[0], lastName: '' };

    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];

    return { firstName, lastName };
}

// ============================================================================
// Firestore Operations
// ============================================================================

async function getExistingEmails() {
    const snapshot = await db.collection('preintake_emails').get();
    const emails = new Set();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.email) emails.add(data.email.toLowerCase());
    });
    return emails;
}

async function getProgress() {
    const doc = await db.collection('preintake_scrape_progress').doc('nsba').get();
    if (doc.exists) {
        return doc.data();
    }
    return {
        lastRunDate: null,
        totalInserted: 0,
        lastProfileId: null
    };
}

async function updateProgress(data) {
    await db.collection('preintake_scrape_progress').doc('nsba').set(data, { merge: true });
}

async function insertAttorney(attorney) {
    const docRef = db.collection('preintake_emails').doc();
    await docRef.set({
        ...attorney,
        source: 'nsba',
        state: attorney.state || 'NE',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        sent: false,
        status: 'pending',
        randomIndex: Math.random()
    });
    return docRef.id;
}

// ============================================================================
// Main Scraper Function
// ============================================================================

async function scrapeNSBAAttorneys() {
    console.log('='.repeat(60));
    console.log('NSBA Attorney Scraper');
    console.log('='.repeat(60));
    console.log(`DRY_RUN: ${DRY_RUN}`);
    console.log(`MAX_ATTORNEYS: ${MAX_ATTORNEYS}`);
    console.log('');

    // Initialize Firebase
    initFirebase();

    // Get existing emails for deduplication
    console.log('Loading existing emails for deduplication...');
    const existingEmails = await getExistingEmails();
    console.log(`Found ${existingEmails.size} existing emails`);

    // Get progress
    const progress = await getProgress();
    console.log('Previous progress:', progress);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let page;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalGovSkipped = 0;
    let totalProcessed = 0;

    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to search page
        console.log(`Navigating to ${SEARCH_URL}...`);
        await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(2000);

        // Click the Continue button to load all results
        console.log('Looking for Continue button...');

        // The Continue button might be in the form or directly visible
        const continueClicked = await page.evaluate(() => {
            // Look for a Continue or Search button
            const buttons = document.querySelectorAll('input[type="submit"], button');
            for (const btn of buttons) {
                const value = btn.value || btn.textContent || '';
                if (value.toLowerCase().includes('continue') || value.toLowerCase().includes('search')) {
                    btn.click();
                    return true;
                }
            }

            // Also look for links
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.toLowerCase().includes('continue')) {
                    link.click();
                    return true;
                }
            }

            return false;
        });

        if (continueClicked) {
            console.log('Clicked Continue button, waiting for results...');
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
            await delay(5000);
        } else {
            console.log('No Continue button found, checking if results are already loaded...');
        }

        // Extract profile IDs from the iframe
        console.log('Extracting profile IDs from search results...');
        const profileIds = await extractProfileIdsFromIframe(page, MAX_ATTORNEYS);

        if (profileIds.length === 0) {
            console.log('No profile IDs found. The page structure may have changed.');
            console.log('Current URL:', page.url());

            // Take a screenshot for debugging
            const screenshotPath = '/tmp/nsba-debug.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Screenshot saved to ${screenshotPath}`);

            throw new Error('No profile IDs found in search results');
        }

        console.log(`Found ${profileIds.length} total profile IDs`);

        // Process profiles
        const profilesToProcess = profileIds.slice(0, MAX_ATTORNEYS);
        console.log(`Processing ${profilesToProcess.length} profiles (limited by MAX_ATTORNEYS)...`);

        for (const profileId of profilesToProcess) {
            if (totalInserted >= MAX_ATTORNEYS) {
                console.log(`Reached MAX_ATTORNEYS limit (${MAX_ATTORNEYS})`);
                break;
            }

            totalProcessed++;
            console.log(`\n[${totalProcessed}/${profilesToProcess.length}] Processing profile ${profileId}...`);

            // Extract profile data
            const profileData = await extractProfileData(page, profileId);

            if (!profileData) {
                console.log(`  Skipped: Could not extract data`);
                totalSkipped++;
                continue;
            }

            if (!profileData.email || typeof profileData.email !== 'string') {
                console.log(`  Skipped: No valid email found (got: ${typeof profileData.email})`);
                totalSkipped++;
                continue;
            }

            const email = profileData.email.trim();
            if (!email || !email.includes('@')) {
                console.log(`  Skipped: Invalid email format`);
                totalSkipped++;
                continue;
            }

            // Check for duplicate
            if (existingEmails.has(email.toLowerCase())) {
                console.log(`  Skipped: Duplicate email ${email}`);
                totalSkipped++;
                continue;
            }

            // Parse name
            const { firstName, lastName } = parseName(profileData.name);

            // Check for government contact
            if (isGovernmentContact(email, profileData.firmName || '')) {
                console.log(`  Skipped: Government contact (${email})`);
                totalGovSkipped++;
                totalSkipped++;
                continue;
            }

            // Prepare attorney record
            const attorney = {
                firstName,
                lastName,
                email: email,
                firmName: profileData.firmName || '',
                title: profileData.title || '',
                city: profileData.city || '',
                phone: profileData.phone || '',
                website: profileData.website || '',
                practiceArea: (profileData.practiceArea && profileData.practiceArea !== 'None Selected')
                    ? profileData.practiceArea
                    : 'General Practice',
                profileId: profileData.profileId,
                memberUrl: profileData.memberUrl
            };

            console.log(`  Found: ${firstName} ${lastName} <${email}>`);
            console.log(`  Firm: ${attorney.firmName || 'N/A'}`);
            console.log(`  Practice Area: ${attorney.practiceArea}`);

            if (!DRY_RUN) {
                await insertAttorney(attorney);
                existingEmails.add(email.toLowerCase());
            }

            totalInserted++;

            // Delay between profiles
            await delay(DELAY_BETWEEN_PROFILES);
        }

    } catch (error) {
        console.error('\nError during scraping:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }

    // Update progress
    if (!DRY_RUN) {
        await updateProgress({
            lastRunDate: new Date().toISOString(),
            totalInserted: (progress.totalInserted || 0) + totalInserted
        });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SCRAPE COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total processed: ${totalProcessed}`);
    console.log(`Total inserted: ${totalInserted}`);
    console.log(`Total skipped: ${totalSkipped}`);
    console.log(`  - Government contacts: ${totalGovSkipped}`);
    console.log(`DRY_RUN: ${DRY_RUN}`);

    // Send notification email
    if (!DRY_RUN && totalInserted > 0) {
        await sendNotificationEmail(
            `NSBA Scraper: ${totalInserted} new attorneys added`,
            `NSBA Attorney Scraper Results\n` +
            `${'='.repeat(40)}\n\n` +
            `Total processed: ${totalProcessed}\n` +
            `Total inserted: ${totalInserted}\n` +
            `Total skipped: ${totalSkipped}\n` +
            `Government contacts skipped: ${totalGovSkipped}\n\n` +
            `Timestamp: ${new Date().toISOString()}`
        );
    }

    return {
        totalProcessed,
        totalInserted,
        totalSkipped,
        totalGovSkipped
    };
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
    scrapeNSBAAttorneys()
        .then(results => {
            console.log('\nFinal results:', results);
            process.exit(0);
        })
        .catch(error => {
            console.error('\nFatal error:', error);
            process.exit(1);
        });
}

module.exports = { scrapeNSBAAttorneys };
