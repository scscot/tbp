#!/usr/bin/env node
/**
 * Infer websites for CalBar and FL Bar contacts based on email domain
 *
 * For attorneys without a website listed, this script:
 * 1. Extracts the domain from their email
 * 2. Skips personal email providers (gmail, yahoo, aol, etc.)
 * 3. Attempts to fetch the domain as a website
 * 4. Verifies it appears to be a law firm website
 * 5. Updates the contact with the inferred website
 *
 * Supported sources:
 * - CalBar: Contacts with source='calbar' and no website
 * - FL Bar: Contacts with source='flbar', enrichmentSource set (profile checked), and no website
 *
 * Usage: node scripts/infer-calbar-websites.js
 *
 * Options:
 *   DRY_RUN=true    - Preview changes without updating Firestore
 *   BATCH_SIZE=50   - Number of contacts to process (default: all)
 */

const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const nodemailer = require('nodemailer');

// Personal email domains to skip
const PERSONAL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'aol.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'me.com', 'mac.com', 'msn.com', 'live.com',
    'comcast.net', 'sbcglobal.net', 'att.net', 'verizon.net',
    'cox.net', 'earthlink.net', 'protonmail.com', 'ymail.com',
    'mail.com', 'inbox.com', 'zoho.com'
];

// Keywords that indicate a law firm website (simplified list)
const LAW_KEYWORDS = [
    'law', 'legal', 'attorney', 'lawyer', 'firm',
    'litigation', 'practice', 'counsel'
];

// Parked/invalid domain indicators
const PARKED_INDICATORS = [
    'domain for sale', 'buy this domain', 'parked domain',
    'coming soon', 'under construction', 'this domain',
    'domain name for sale', 'make an offer'
];

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE, 10) : null;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second

let db;

/**
 * Initialize Firebase
 */
function initFirebase() {
    const serviceAccount = require('../secrets/serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    db.settings({ databaseId: 'preintake' });
}

/**
 * Load cumulative progress from Firestore
 */
async function loadProgress() {
    const doc = await db.collection('preintake_scrape_progress').doc('website_inference').get();
    if (doc.exists) {
        return doc.data();
    }
    return {
        totalDomainsChecked: 0,
        totalWebsitesFound: 0,
        totalPersonalSkipped: 0,
        totalErrors: 0,
        lastRunDate: null,
        runCount: 0
    };
}

/**
 * Save cumulative progress to Firestore
 */
async function saveProgress(progress) {
    await db.collection('preintake_scrape_progress').doc('website_inference').set(progress);
}

/**
 * Send email notification with run summary
 */
async function sendNotificationEmail(stats, progress) {
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
        auth: {
            user: smtpUser,
            pass: smtpPass
        }
    });

    const domainsChecked = stats.processed - stats.personalEmail;
    const currentSuccessRate = domainsChecked > 0
        ? ((stats.websiteFound / domainsChecked) * 100).toFixed(1)
        : '0.0';

    const totalDomainsChecked = progress.totalDomainsChecked;
    const totalSuccessRate = totalDomainsChecked > 0
        ? ((progress.totalWebsitesFound / totalDomainsChecked) * 100).toFixed(1)
        : '0.0';

    const subject = stats.websiteFound > 0
        ? `Website Inference: ${stats.websiteFound} websites found (${currentSuccessRate}% success)`
        : `Website Inference: No websites found this run`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #0c1f3f, #1a3a5c); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; background: #f9f9f9; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .stats-table th, .stats-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .stats-table th { background: #e8e8e8; font-weight: 600; }
        .section-title { color: #0c1f3f; margin-top: 20px; border-bottom: 2px solid #c9a962; padding-bottom: 5px; }
        .success { color: #28a745; font-weight: bold; }
        .footer { padding: 15px; background: #0c1f3f; color: #aaa; font-size: 12px; border-radius: 0 0 8px 8px; }
    </style>
</head>
<body>
    <div class="header">
        <h2 style="margin: 0;">🌐 Website Inference Report (CalBar + FL Bar)</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    <div class="content">
        <h3 class="section-title">This Run</h3>
        <table class="stats-table">
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Contacts Processed</td><td>${stats.processed}</td></tr>
            <tr><td>Personal Email (skipped)</td><td>${stats.personalEmail}</td></tr>
            <tr><td>Domains Checked</td><td>${domainsChecked}</td></tr>
            <tr><td>Websites Found</td><td class="success">${stats.websiteFound}</td></tr>
            <tr><td>Not Found</td><td>${stats.websiteNotFound}</td></tr>
            <tr><td>Errors</td><td>${stats.errors}</td></tr>
            <tr><td><strong>Success Rate</strong></td><td><strong>${currentSuccessRate}%</strong></td></tr>
        </table>

        <h3 class="section-title">Cumulative Totals (All Runs)</h3>
        <table class="stats-table">
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Runs</td><td>${progress.runCount}</td></tr>
            <tr><td>Total Domains Checked</td><td>${totalDomainsChecked}</td></tr>
            <tr><td>Total Websites Found</td><td class="success">${progress.totalWebsitesFound}</td></tr>
            <tr><td>Total Personal Skipped</td><td>${progress.totalPersonalSkipped}</td></tr>
            <tr><td><strong>Overall Success Rate</strong></td><td><strong>${totalSuccessRate}%</strong></td></tr>
        </table>
    </div>
    <div class="footer">
        <p>Generated by PreIntake.ai Website Inference Tool (CalBar + FL Bar)</p>
    </div>
</body>
</html>`;

    const plainText = `
Website Inference Report (CalBar + FL Bar)
${new Date().toLocaleDateString()}

THIS RUN
--------
Contacts Processed: ${stats.processed}
Personal Email (skipped): ${stats.personalEmail}
Domains Checked: ${domainsChecked}
Websites Found: ${stats.websiteFound}
Not Found: ${stats.websiteNotFound}
Errors: ${stats.errors}
Success Rate: ${currentSuccessRate}%

CUMULATIVE TOTALS
-----------------
Total Runs: ${progress.runCount}
Total Domains Checked: ${totalDomainsChecked}
Total Websites Found: ${progress.totalWebsitesFound}
Total Personal Skipped: ${progress.totalPersonalSkipped}
Overall Success Rate: ${totalSuccessRate}%
`;

    try {
        await transporter.sendMail({
            from: 'Stephen Scott <scott@legal.preintake.ai>',
            to: 'Stephen Scott <stephen@preintake.ai>',
            subject,
            html: htmlContent,
            text: plainText
        });
        console.log('📧 Notification email sent');
    } catch (err) {
        console.error('❌ Failed to send email:', err.message);
    }
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract domain from email
 */
function extractDomain(email) {
    if (!email || !email.includes('@')) return null;
    return email.split('@')[1].toLowerCase();
}

/**
 * Check if domain is a personal email provider
 */
function isPersonalDomain(domain) {
    return PERSONAL_DOMAINS.includes(domain);
}

/**
 * Fetch URL and return response info
 */
function fetchUrl(url, timeout = 5000) {
    return new Promise((resolve) => {
        let resolved = false;
        const safeResolve = (result) => {
            if (!resolved) {
                resolved = true;
                resolve(result);
            }
        };

        try {
            const protocol = url.startsWith('https') ? https : http;

            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PreIntake.ai Website Checker)'
                },
                rejectUnauthorized: false // Accept self-signed certs
            };

            const req = protocol.get(url, options, (res) => {
                let body = '';
                let statusCode = res.statusCode;

                // Follow redirects
                if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                    safeResolve({
                        success: false,
                        redirect: res.headers.location,
                        statusCode: statusCode
                    });
                    return;
                }

                res.on('data', chunk => {
                    body += chunk;
                    // Only read first 50KB - resolve immediately with what we have
                    if (body.length > 50000) {
                        safeResolve({
                            success: statusCode === 200,
                            statusCode: statusCode,
                            body: body.substring(0, 50000).toLowerCase()
                        });
                        req.destroy();
                    }
                });

                res.on('end', () => {
                    safeResolve({
                        success: statusCode === 200,
                        statusCode: statusCode,
                        body: body.substring(0, 50000).toLowerCase()
                    });
                });

                res.on('error', () => {
                    // If we already have body content, return it anyway
                    if (body.length > 0) {
                        safeResolve({
                            success: statusCode === 200,
                            statusCode: statusCode,
                            body: body.substring(0, 50000).toLowerCase()
                        });
                    } else {
                        safeResolve({ success: false, error: 'response error' });
                    }
                });
            });

            req.setTimeout(timeout, () => {
                req.destroy();
                safeResolve({ success: false, error: 'timeout' });
            });

            req.on('error', (err) => {
                safeResolve({ success: false, error: err.message });
            });
        } catch (err) {
            safeResolve({ success: false, error: err.message });
        }
    });
}

/**
 * Check if content appears to be a law firm website
 * Verification priority:
 *   1. firmName in page = 95%
 *   2. lastName in page + law keyword = 85%
 *   3. lastName in domain + law keyword in page = 80%
 *   4. Page has 3+ law keywords = 70%
 */
function isLawFirmWebsite(body, attorneyName, firmName, domain) {
    if (!body) return { isLawFirm: false, confidence: 0, reason: 'no content' };

    // Check for parked domain indicators first
    for (const indicator of PARKED_INDICATORS) {
        if (body.includes(indicator)) {
            return { isLawFirm: false, confidence: 0, reason: 'parked/for sale domain' };
        }
    }

    // Extract lastName for checks
    let lastName = '';
    if (attorneyName) {
        const nameParts = attorneyName.toLowerCase().split(' ');
        lastName = nameParts[nameParts.length - 1];
    }

    // Count law keywords in page
    const keywordCount = LAW_KEYWORDS.filter(keyword => body.includes(keyword)).length;
    const hasLawKeyword = keywordCount >= 1;
    const hasMultipleLawKeywords = keywordCount >= 3;

    // Primary check: firmName appears in page (95% confidence)
    if (firmName) {
        const firmNameLower = firmName.toLowerCase();
        if (body.includes(firmNameLower)) {
            return { isLawFirm: true, confidence: 95, reason: 'firm name found' };
        }
        // Also check without common suffixes (LLP, LLC, PC, etc.)
        const firmNameClean = firmNameLower
            .replace(/,?\s*(llp|llc|pc|pllc|p\.c\.|apc|aplc|inc|ltd)\.?$/i, '')
            .trim();
        if (firmNameClean.length > 5 && body.includes(firmNameClean)) {
            return { isLawFirm: true, confidence: 95, reason: 'firm name found' };
        }
    }

    // Secondary check: attorney lastName in page + law keyword (85% confidence)
    if (lastName.length > 2 && body.includes(lastName) && hasLawKeyword) {
        return { isLawFirm: true, confidence: 85, reason: 'attorney name + law keyword' };
    }

    // Tertiary check: lastName in domain + law keyword in page (80% confidence)
    // Common pattern: zevenlaw.com for attorney Zeven, smithlegal.com for Smith, etc.
    if (lastName.length > 2 && domain && domain.includes(lastName) && hasLawKeyword) {
        return { isLawFirm: true, confidence: 80, reason: 'lastName in domain + law keyword' };
    }

    // Fallback check: multiple law keywords suggests it's a law firm (70% confidence)
    if (hasMultipleLawKeywords) {
        return { isLawFirm: true, confidence: 70, reason: `${keywordCount} law keywords found` };
    }

    return { isLawFirm: false, confidence: 0, reason: 'no firm/attorney match' };
}

/**
 * Try to find a working website for a domain
 * Only tries HTTPS (www and non-www) - skips HTTP
 */
async function findWebsite(domain, attorneyName, firmName) {
    const urlsToTry = [
        `https://www.${domain}`,
        `https://${domain}`
    ];

    for (const url of urlsToTry) {
        const result = await fetchUrl(url);

        if (result.success && result.body) {
            const verification = isLawFirmWebsite(result.body, attorneyName, firmName, domain);

            if (verification.isLawFirm) {
                return {
                    success: true,
                    url,
                    confidence: verification.confidence,
                    reason: verification.reason
                };
            }
        }

        // Handle redirects
        if (result.redirect) {
            const redirectResult = await fetchUrl(result.redirect);
            if (redirectResult.success && redirectResult.body) {
                const verification = isLawFirmWebsite(redirectResult.body, attorneyName, firmName, domain);
                if (verification.isLawFirm) {
                    return {
                        success: true,
                        url: result.redirect,
                        confidence: verification.confidence,
                        reason: verification.reason
                    };
                }
            }
        }

        await sleep(500); // Brief delay between attempts
    }

    return { success: false, reason: 'no firm/attorney match on website' };
}

/**
 * Main function
 */
async function main() {
    console.log('🌐 Website Inference Tool (CalBar + FL Bar)');
    console.log('============================================\n');

    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    initFirebase();

    // Load cumulative progress
    const progress = await loadProgress();

    // Query contacts without websites AND not already checked from multiple sources:
    //
    // 1. CalBar contacts: source='calbar' AND website=''
    // 2. FL Bar contacts: source='flbar' AND website='' AND enrichmentSource exists
    //    (enrichmentSource confirms the profile was checked and no website was found)
    //
    // Note: Firestore doesn't support OR queries, so we run separate queries

    // Query 1: CalBar contacts
    const calbarQuery = db.collection('preintake_emails')
        .where('source', '==', 'calbar')
        .where('website', '==', '');
    const calbarSnapshot = await calbarQuery.get();

    // Query 2: FL Bar contacts (enriched only - profile was checked)
    const flbarQuery = db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .where('website', '==', '');
    const flbarSnapshot = await flbarQuery.get();

    // Filter FL Bar to only include enriched contacts (profile was checked for website)
    const flbarEnrichedDocs = flbarSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.enrichmentSource !== undefined;
    });

    // Combine all docs
    const allDocs = [...calbarSnapshot.docs, ...flbarEnrichedDocs];

    // Filter out contacts that have already been checked
    const uncheckedContacts = allDocs.filter(doc => {
        const data = doc.data();
        return data.domainChecked !== true;
    });

    console.log('📊 Source breakdown:');
    console.log(`   CalBar: ${calbarSnapshot.docs.length} without websites`);
    console.log(`   FL Bar: ${flbarSnapshot.docs.length} without websites (${flbarEnrichedDocs.length} enriched)`);
    console.log(`   Total: ${allDocs.length} contacts without websites`);
    console.log(`   Already checked: ${allDocs.length - uncheckedContacts.length}`);
    console.log(`   Remaining to check: ${uncheckedContacts.length}`);

    let contacts = uncheckedContacts;
    if (BATCH_SIZE && contacts.length > BATCH_SIZE) {
        console.log(`   Processing first ${BATCH_SIZE} (BATCH_SIZE limit)\n`);
        contacts = contacts.slice(0, BATCH_SIZE);
    } else {
        console.log('');
    }

    if (contacts.length === 0) {
        console.log('✅ All contacts have been checked (or have websites)!');

        // Still send notification email if not dry run
        if (!DRY_RUN) {
            const emptyStats = { processed: 0, personalEmail: 0, websiteFound: 0, websiteNotFound: 0, errors: 0 };
            await sendNotificationEmail(emptyStats, progress);
        }
        process.exit(0);
    }

    // Stats
    const stats = {
        processed: 0,
        personalEmail: 0,
        websiteFound: 0,
        websiteNotFound: 0,
        errors: 0
    };

    // Process each contact
    for (const doc of contacts) {
        const data = doc.data();
        const email = data.email;
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        const firmName = data.firmName || '';

        stats.processed++;

        // Extract domain
        const domain = extractDomain(email);
        if (!domain) {
            console.log(`❌ ${stats.processed}. ${fullName}: Invalid email`);
            stats.errors++;
            continue;
        }

        // Skip personal domains
        if (isPersonalDomain(domain)) {
            console.log(`⏭️  ${stats.processed}. ${fullName}: Personal email (${domain})`);
            stats.personalEmail++;

            // Mark as checked so we don't re-process
            if (!DRY_RUN) {
                await doc.ref.update({
                    domainChecked: true,
                    domainCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
                    domainCheckResult: 'personal_email'
                });
            }
            continue;
        }

        console.log(`🔍 ${stats.processed}. ${fullName}: Checking ${domain}...`);

        // Try to find website
        const result = await findWebsite(domain, fullName, firmName);

        if (result.success) {
            console.log(`   ✅ Found: ${result.url} (${result.confidence}% confidence: ${result.reason})`);
            stats.websiteFound++;

            // Update Firestore
            if (!DRY_RUN) {
                await doc.ref.update({
                    website: result.url,
                    websiteInferred: true,
                    websiteInferredAt: admin.firestore.FieldValue.serverTimestamp(),
                    websiteConfidence: result.confidence,
                    domainChecked: true,
                    domainCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
                    domainCheckResult: 'found'
                });
            }
        } else {
            console.log(`   ❌ Not found: ${result.reason}`);
            stats.websiteNotFound++;

            // Mark as checked so we don't re-process
            if (!DRY_RUN) {
                await doc.ref.update({
                    domainChecked: true,
                    domainCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
                    domainCheckResult: 'not_found',
                    domainCheckReason: result.reason
                });
            }
        }

        await sleep(DELAY_BETWEEN_REQUESTS);
    }

    // Summary
    console.log('\n=================================');
    console.log('📊 Summary');
    console.log('=================================');
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Personal email (skipped): ${stats.personalEmail}`);
    console.log(`   ✅ Websites found: ${stats.websiteFound}`);
    console.log(`   ❌ Websites not found: ${stats.websiteNotFound}`);
    console.log(`   Errors: ${stats.errors}`);

    const domainsChecked = stats.processed - stats.personalEmail;
    if (domainsChecked > 0) {
        const successRate = ((stats.websiteFound / domainsChecked) * 100).toFixed(1);
        console.log(`\n   Success rate: ${successRate}% (of non-personal emails)`);
    }

    // Update cumulative progress
    if (!DRY_RUN) {
        progress.totalDomainsChecked += domainsChecked;
        progress.totalWebsitesFound += stats.websiteFound;
        progress.totalPersonalSkipped += stats.personalEmail;
        progress.totalErrors += stats.errors;
        progress.lastRunDate = new Date().toISOString();
        progress.runCount += 1;

        await saveProgress(progress);
        console.log('\n📊 Cumulative progress saved');

        // Send notification email
        await sendNotificationEmail(stats, progress);

        console.log(`\n✅ Updated ${stats.websiteFound} contacts with inferred websites`);
    } else {
        console.log('\n🔍 DRY RUN - No changes were made');
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
