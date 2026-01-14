#!/usr/bin/env node
/**
 * Florida Bar Profile Enrichment
 *
 * Fetches Florida Bar profile pages to extract:
 * - Firm Website URL
 * - Firm Name (updated)
 * - Practice Areas
 *
 * Designed to run slowly (1 record per invocation) via GitHub Actions
 * scheduled every 2 minutes to avoid rate limiting.
 *
 * Usage:
 *   node scripts/enrich-flbar-profiles.js
 *   BATCH_SIZE=5 node scripts/enrich-flbar-profiles.js
 *   DRY_RUN=true node scripts/enrich-flbar-profiles.js
 */

const cheerio = require('cheerio');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1;
const DRY_RUN = process.env.DRY_RUN === 'true';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Initialize Firebase
let db;

function initializeFirebase() {
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
    console.log('Firebase initialized (preintake database)');
}

/**
 * Fetch a profile page with proper headers
 */
async function fetchProfilePage(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        // Profile loads via iframe from search page - simulate that context
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'iframe',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Referer': 'https://www.floridabar.org/directories/find-mbr/',
                'Cache-Control': 'max-age=0'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
            throw new Error('RATE_LIMITED');
        }

        if (response.status === 404) {
            throw new Error('NOT_FOUND');
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Parse profile page HTML to extract enrichment data
 *
 * HTML structure (inside #findmemberprofile):
 * <div class="row">
 *   <div class="col-xs-12 col-sm-3"><label>Firm:</label></div>
 *   <div class="col-xs-12 col-sm-9"><p>Firm Name Here</p></div>
 * </div>
 */
function parseProfileData(html) {
    const $ = cheerio.load(html);
    const result = {
        website: '',
        firmName: '',
        practiceAreas: []
    };

    // Find the profile section
    const profileSection = $('#findmemberprofile');

    // Extract data by finding label elements and getting sibling content
    profileSection.find('.row').each((i, row) => {
        const $row = $(row);
        const label = $row.find('label').text().trim().toLowerCase();
        const valueCol = $row.find('.col-sm-9');

        // Firm Website - look for anchor with href
        if (label === 'firm website:') {
            const link = valueCol.find('a').attr('href');
            if (link && link.startsWith('http')) {
                result.website = link;
            }
        }

        // Firm Name
        if (label === 'firm:') {
            const firmName = valueCol.find('p').first().text().trim();
            if (firmName) {
                result.firmName = firmName;
            }
        }

        // Practice Areas - each area is in a separate <p> tag
        if (label === 'practice areas:') {
            valueCol.find('p').each((j, p) => {
                const area = $(p).text().trim();
                if (area && area.length < 100) {
                    result.practiceAreas.push(area);
                }
            });
        }
    });

    // Clean up practice areas - remove duplicates and empty strings
    result.practiceAreas = [...new Set(result.practiceAreas)].filter(a => a);

    return result;
}

/**
 * Get unenriched FL Bar contacts
 */
async function getUnenrichedContacts(limit) {
    // Query FL Bar contacts that need enrichment
    // - Has memberUrl (or barNumber to construct it)
    // - Website is empty or null
    // - Not already enriched (no enrichedAt timestamp)
    //
    // We fetch more docs than needed because some may already be enriched
    // (enrichedAt exists but website is still empty = no website on profile)
    const queryLimit = Math.max(limit * 10, 100);

    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'flbar')
        .where('website', '==', '')
        .limit(queryLimit)
        .get();

    const contacts = [];
    snapshot.forEach(doc => {
        // Stop once we have enough
        if (contacts.length >= limit) return;

        const data = doc.data();
        // Skip if already enriched
        if (data.enrichedAt) return;

        // Construct memberUrl if not present
        const memberUrl = data.memberUrl ||
            (data.barNumber ? `https://www.floridabar.org/directories/find-mbr/profile/?num=${data.barNumber}` : null);

        if (memberUrl) {
            contacts.push({
                id: doc.id,
                ...data,
                memberUrl
            });
        }
    });

    return contacts;
}

/**
 * Update contact with enrichment data
 */
async function updateContact(docId, enrichmentData) {
    const updateData = {
        enrichedAt: admin.firestore.FieldValue.serverTimestamp(),
        enrichmentSource: 'flbar_profile'
    };

    // Only set website if one was found on the profile
    if (enrichmentData.website) {
        updateData.website = enrichmentData.website;
    }

    if (enrichmentData.firmName) {
        updateData.firmNameEnriched = enrichmentData.firmName;
    }

    if (enrichmentData.practiceAreas && enrichmentData.practiceAreas.length > 0) {
        updateData.practiceAreasEnriched = enrichmentData.practiceAreas;
    }

    await db.collection('preintake_emails').doc(docId).update(updateData);
}

/**
 * Mark contact as having enrichment error
 */
async function markEnrichmentError(docId, errorMessage) {
    await db.collection('preintake_emails').doc(docId).update({
        enrichedAt: admin.firestore.FieldValue.serverTimestamp(),
        enrichmentSource: 'flbar_profile',
        enrichmentError: errorMessage
    });
}

/**
 * Main enrichment logic
 */
async function main() {
    console.log('Florida Bar Profile Enrichment');
    console.log('==============================\n');

    if (DRY_RUN) {
        console.log('DRY RUN MODE - No changes will be made\n');
    }

    console.log(`Batch size: ${BATCH_SIZE}\n`);

    initializeFirebase();

    // Get contacts that need enrichment
    const contacts = await getUnenrichedContacts(BATCH_SIZE);

    if (contacts.length === 0) {
        console.log('No unenriched FL Bar contacts found.');
        console.log('All contacts have been processed or none exist.');
        process.exit(0);
    }

    console.log(`Found ${contacts.length} contact(s) to enrich\n`);

    let enriched = 0;
    let errors = 0;

    for (const contact of contacts) {
        console.log(`Processing: ${contact.firstName} ${contact.lastName} (${contact.barNumber})`);
        console.log(`  URL: ${contact.memberUrl}`);

        try {
            // Fetch the profile page
            const html = await fetchProfilePage(contact.memberUrl);

            // Parse the data
            const data = parseProfileData(html);

            console.log(`  Website: ${data.website || '(none found)'}`);
            console.log(`  Firm: ${data.firmName || '(none found)'}`);
            console.log(`  Practice Areas: ${data.practiceAreas.length > 0 ? data.practiceAreas.join(', ') : '(none found)'}`);

            if (!DRY_RUN) {
                await updateContact(contact.id, data);
                console.log(`  ✓ Updated successfully`);
            } else {
                console.log(`  [DRY RUN] Would update contact`);
            }

            enriched++;

        } catch (error) {
            console.log(`  ✗ Error: ${error.message}`);

            if (error.message === 'RATE_LIMITED') {
                console.log('\n⚠️ Rate limited by Florida Bar. Stopping.');
                console.log('Workflow will retry on next scheduled run.');
                process.exit(0);
            }

            if (!DRY_RUN) {
                await markEnrichmentError(contact.id, error.message);
            }

            errors++;
        }

        console.log('');
    }

    console.log('==============================');
    console.log('Summary:');
    console.log(`  Enriched: ${enriched}`);
    console.log(`  Errors: ${errors}`);

    if (DRY_RUN) {
        console.log('\nDRY RUN - No changes were made');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
