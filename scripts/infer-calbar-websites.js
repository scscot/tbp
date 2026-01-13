#!/usr/bin/env node
/**
 * Infer websites for CalBar contacts based on email domain
 *
 * For attorneys without a website listed, this script:
 * 1. Extracts the domain from their email
 * 2. Skips personal email providers (gmail, yahoo, aol, etc.)
 * 3. Attempts to fetch the domain as a website
 * 4. Verifies it appears to be a law firm website
 * 5. Updates the contact with the inferred website
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

// Personal email domains to skip
const PERSONAL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'aol.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'me.com', 'mac.com', 'msn.com', 'live.com',
    'comcast.net', 'sbcglobal.net', 'att.net', 'verizon.net',
    'cox.net', 'earthlink.net', 'protonmail.com', 'ymail.com',
    'mail.com', 'inbox.com', 'zoho.com'
];

// Keywords that indicate a law firm website
const LAW_KEYWORDS = [
    'law', 'legal', 'attorney', 'lawyer', 'firm', 'esq',
    'litigation', 'practice', 'counsel', 'advocate',
    'injury', 'defense', 'criminal', 'family', 'divorce',
    'estate', 'trust', 'probate', 'bankruptcy', 'immigration',
    'llp', 'pllc', 'p.c.', 'apc', 'aplc'
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

                // Follow redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    safeResolve({
                        success: false,
                        redirect: res.headers.location,
                        statusCode: res.statusCode
                    });
                    return;
                }

                res.on('data', chunk => {
                    body += chunk;
                    // Only read first 50KB
                    if (body.length > 50000) {
                        req.destroy();
                    }
                });

                res.on('end', () => {
                    safeResolve({
                        success: res.statusCode === 200,
                        statusCode: res.statusCode,
                        body: body.substring(0, 50000).toLowerCase()
                    });
                });

                res.on('error', () => {
                    safeResolve({ success: false, error: 'response error' });
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
 */
function isLawFirmWebsite(body, attorneyName) {
    if (!body) return { isLawFirm: false, confidence: 0, reason: 'no content' };

    let score = 0;
    const reasons = [];

    // Check for law-related keywords
    let keywordMatches = 0;
    for (const keyword of LAW_KEYWORDS) {
        if (body.includes(keyword)) {
            keywordMatches++;
        }
    }

    if (keywordMatches >= 5) {
        score += 40;
        reasons.push(`${keywordMatches} law keywords`);
    } else if (keywordMatches >= 3) {
        score += 25;
        reasons.push(`${keywordMatches} law keywords`);
    } else if (keywordMatches >= 1) {
        score += 10;
        reasons.push(`${keywordMatches} law keywords`);
    }

    // Check for attorney name
    if (attorneyName) {
        const nameParts = attorneyName.toLowerCase().split(' ');
        const lastName = nameParts[nameParts.length - 1];
        if (lastName.length > 2 && body.includes(lastName)) {
            score += 30;
            reasons.push('attorney name found');
        }
    }

    // Check for contact/legal page indicators
    if (body.includes('contact') && (body.includes('phone') || body.includes('email'))) {
        score += 15;
        reasons.push('contact info');
    }

    // Check for legal disclaimers
    if (body.includes('attorney advertising') || body.includes('prior results') ||
        body.includes('no guarantee') || body.includes('free consultation')) {
        score += 20;
        reasons.push('legal disclaimer');
    }

    // Negative signals
    if (body.includes('domain for sale') || body.includes('buy this domain') ||
        body.includes('parked domain') || body.includes('coming soon')) {
        score -= 50;
        reasons.push('parked/for sale (negative)');
    }

    const confidence = Math.min(100, Math.max(0, score));

    return {
        isLawFirm: confidence >= 50,
        confidence,
        reason: reasons.join(', ') || 'no matches'
    };
}

/**
 * Try to find a working website for a domain
 */
async function findWebsite(domain, attorneyName) {
    const urlsToTry = [
        `https://www.${domain}`,
        `https://${domain}`,
        `http://www.${domain}`,
        `http://${domain}`
    ];

    for (const url of urlsToTry) {
        const result = await fetchUrl(url);

        if (result.success && result.body) {
            const verification = isLawFirmWebsite(result.body, attorneyName);

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
                const verification = isLawFirmWebsite(redirectResult.body, attorneyName);
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

    return { success: false, reason: 'no valid law firm website found' };
}

/**
 * Main function
 */
async function main() {
    console.log('🌐 CalBar Website Inference Tool');
    console.log('=================================\n');

    if (DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    initFirebase();

    // Query CalBar contacts without websites
    let query = db.collection('preintake_emails')
        .where('source', '==', 'calbar')
        .where('website', '==', '');

    const snapshot = await query.get();

    let contacts = snapshot.docs;
    if (BATCH_SIZE && contacts.length > BATCH_SIZE) {
        console.log(`📊 Found ${contacts.length} contacts without websites`);
        console.log(`   Processing first ${BATCH_SIZE} (BATCH_SIZE limit)\n`);
        contacts = contacts.slice(0, BATCH_SIZE);
    } else {
        console.log(`📊 Found ${contacts.length} contacts without websites\n`);
    }

    if (contacts.length === 0) {
        console.log('✅ All contacts already have websites!');
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
            continue;
        }

        console.log(`🔍 ${stats.processed}. ${fullName}: Checking ${domain}...`);

        // Try to find website
        const result = await findWebsite(domain, fullName);

        if (result.success) {
            console.log(`   ✅ Found: ${result.url} (${result.confidence}% confidence: ${result.reason})`);
            stats.websiteFound++;

            // Update Firestore
            if (!DRY_RUN) {
                await doc.ref.update({
                    website: result.url,
                    websiteInferred: true,
                    websiteInferredAt: admin.firestore.FieldValue.serverTimestamp(),
                    websiteConfidence: result.confidence
                });
            }
        } else {
            console.log(`   ❌ Not found: ${result.reason}`);
            stats.websiteNotFound++;
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

    if (stats.websiteFound > 0) {
        const successRate = ((stats.websiteFound / (stats.processed - stats.personalEmail)) * 100).toFixed(1);
        console.log(`\n   Success rate: ${successRate}% (of non-personal emails)`);
    }

    if (DRY_RUN) {
        console.log('\n🔍 DRY RUN - No changes were made');
    } else {
        console.log(`\n✅ Updated ${stats.websiteFound} contacts with inferred websites`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
