#!/usr/bin/env node
/**
 * Reset Bar Scraper Progress Documents
 *
 * Resets the "completed" arrays in category-based scraper progress documents
 * so they can re-scrape categories that may have been prematurely marked complete
 * (before the completion logic fix was applied).
 *
 * The skip-before-fetch logic ensures we don't re-insert existing attorneys.
 *
 * Usage:
 *   node scripts/reset-scraper-progress.js           # Dry run (shows what would be reset)
 *   node scripts/reset-scraper-progress.js --run     # Actually reset the documents
 *   node scripts/reset-scraper-progress.js --run --scraper=calbar  # Reset specific scraper
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = !process.argv.includes('--run');
const SPECIFIC_SCRAPER = process.argv.find(arg => arg.startsWith('--scraper='))?.split('=')[1];

// Category-based scrapers that need reset
const SCRAPERS_TO_RESET = {
    calbar: {
        doc: 'preintake_scrape_progress/calbar',
        field: 'scrapedPracticeAreaIds',
        description: 'California Bar'
    },
    flbar: {
        doc: 'preintake_scrape_progress/flbar',
        field: 'scrapedPracticeAreaCodes',
        description: 'Florida Bar'
    },
    wsba: {
        doc: 'preintake_scrape_progress/wsba',
        field: 'scrapedPracticeAreaSlugs',
        description: 'Washington State Bar'
    },
    gabar: {
        doc: 'preintake_scrape_progress/gabar',
        field: 'completedSectionCodes',
        description: 'Georgia Bar'
    },
    ilbar: {
        doc: 'preintake_scrape_progress/ilbar',
        field: 'completedCategoryIds',
        description: 'Illinois Bar'
    },
    mibar: {
        doc: 'preintake_scrape_progress/mibar',
        field: 'completedCategoryIds',
        description: 'Michigan Bar'
    },
    ohbar: {
        doc: 'preintake_scrape_progress/ohbar',
        field: 'completedCategoryIds',
        description: 'Ohio Bar'
    },
    ncbar: {
        doc: 'preintake_scrape_progress/ncbar',
        field: 'scrapedSpecializations',
        description: 'North Carolina Bar'
    }
};

// Page-based scrapers that do NOT need reset (for reference)
const PAGE_BASED_SCRAPERS = ['inbar', 'msbar', 'nebar'];

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

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
    console.log('Firebase initialized (preintake database)\n');
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function resetScraperProgress() {
    console.log('Bar Scraper Progress Reset Tool');
    console.log('='.repeat(60));

    if (DRY_RUN) {
        console.log('*** DRY RUN MODE - No changes will be made ***');
        console.log('    Use --run flag to actually reset progress\n');
    }

    if (SPECIFIC_SCRAPER) {
        if (!SCRAPERS_TO_RESET[SPECIFIC_SCRAPER]) {
            console.error(`Unknown scraper: ${SPECIFIC_SCRAPER}`);
            console.error(`Valid options: ${Object.keys(SCRAPERS_TO_RESET).join(', ')}`);
            process.exit(1);
        }
        console.log(`Resetting only: ${SPECIFIC_SCRAPER}\n`);
    }

    initializeFirebase();

    const scrapersToProcess = SPECIFIC_SCRAPER
        ? { [SPECIFIC_SCRAPER]: SCRAPERS_TO_RESET[SPECIFIC_SCRAPER] }
        : SCRAPERS_TO_RESET;

    let totalReset = 0;
    let totalSkipped = 0;

    for (const [key, config] of Object.entries(scrapersToProcess)) {
        console.log(`\n${config.description} (${key})`);
        console.log('-'.repeat(40));

        try {
            const docRef = db.doc(config.doc);
            const doc = await docRef.get();

            if (!doc.exists) {
                console.log('   No progress document found - nothing to reset');
                totalSkipped++;
                continue;
            }

            const data = doc.data();
            const completedArray = data[config.field] || [];
            const totalInserted = data.totalInserted || 0;
            const totalSkippedCount = data.totalSkipped || 0;

            console.log(`   Current state:`);
            console.log(`     - ${config.field}: ${completedArray.length} items`);
            console.log(`     - totalInserted: ${totalInserted}`);
            console.log(`     - totalSkipped: ${totalSkippedCount}`);

            if (completedArray.length === 0) {
                console.log('   Already empty - nothing to reset');
                totalSkipped++;
                continue;
            }

            console.log(`   Items to clear: [${completedArray.join(', ')}]`);

            if (!DRY_RUN) {
                await docRef.update({
                    [config.field]: [],
                    resetAt: new Date().toISOString(),
                    resetReason: 'Completion logic fix - re-scrape for missed attorneys'
                });
                console.log(`   ✓ Reset complete`);
            } else {
                console.log(`   [DRY RUN] Would reset ${config.field} to []`);
            }

            totalReset++;

        } catch (err) {
            console.error(`   Error: ${err.message}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Scrapers reset: ${totalReset}`);
    console.log(`   Scrapers skipped: ${totalSkipped}`);

    if (DRY_RUN) {
        console.log('\n   Run with --run flag to apply changes');
    }

    console.log('\n   Page-based scrapers (no reset needed):');
    PAGE_BASED_SCRAPERS.forEach(s => console.log(`     - ${s}`));
}

// ============================================================================
// ENTRY POINT
// ============================================================================

resetScraperProgress()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
