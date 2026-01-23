#!/usr/bin/env node
/**
 * Fix WSBA contacts in preintake_emails collection
 *
 * Issues to fix:
 * 1. firmName contains "or Employer: " prefix (regex bug)
 * 2. Missing firstName and lastName fields
 *
 * Usage:
 *   node scripts/fix-wsba-contacts.js                    # Dry run (preview)
 *   node scripts/fix-wsba-contacts.js --run              # Apply fixes
 *   node scripts/fix-wsba-contacts.js --delete-unusable  # Delete contacts missing names (dry run)
 *   node scripts/fix-wsba-contacts.js --delete-unusable --run  # Delete unusable contacts
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = !process.argv.includes('--run');
const DELETE_UNUSABLE = process.argv.includes('--delete-unusable');

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

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

    const db = admin.firestore();
    db.settings({ databaseId: 'preintake' });
    console.log('Firebase initialized (preintake database)');
    return db;
}

// ============================================================================
// FIX FUNCTIONS
// ============================================================================

function fixFirmName(firmName) {
    if (!firmName) return null;

    // Remove "or Employer: " prefix that was incorrectly captured
    let fixed = firmName.replace(/^or\s+Employer[:\s]*/i, '').trim();

    // Also clean up any double spaces or trailing colons
    fixed = fixed.replace(/\s+/g, ' ').replace(/:\s*$/, '').trim();

    return fixed !== firmName ? fixed : null;
}

function extractNamesFromFirmName(firmName) {
    if (!firmName) return null;

    // Common patterns we can reliably extract from:
    // "Law Office of John Smith"
    // "Law Offices of John Smith"
    // "John Smith, Attorney at Law"
    // "John D. Smith, Attorney"

    let firstName = null;
    let lastName = null;

    // Words that indicate this is NOT a person's name
    const nonNameWords = [
        'law', 'legal', 'attorney', 'lawyers', 'firm', 'office', 'offices',
        'group', 'associates', 'partners', 'llc', 'pllc', 'pc', 'p.c.',
        'inc', 'corp', 'corporation', 'professional', 'services'
    ];

    // Pattern 1: "Law Office(s) of FirstName LastName" - most reliable
    const lawOfficeMatch = firmName.match(/Law\s+Offices?\s+of\s+([A-Z][a-z]+)\s+(?:[A-Z]\.?\s+)?([A-Z][a-z]+)/i);
    if (lawOfficeMatch) {
        const candidateFirst = lawOfficeMatch[1];
        const candidateLast = lawOfficeMatch[2];
        // Verify neither is a non-name word
        if (!nonNameWords.includes(candidateFirst.toLowerCase()) &&
            !nonNameWords.includes(candidateLast.toLowerCase())) {
            firstName = candidateFirst;
            lastName = candidateLast;
        }
    }

    // Pattern 2: "FirstName LastName, Attorney at Law" - also reliable
    if (!firstName || !lastName) {
        const attorneyMatch = firmName.match(/^([A-Z][a-z]+)\s+(?:[A-Z]\.?\s+)?([A-Z][a-z]+),?\s+Attorney/i);
        if (attorneyMatch) {
            const candidateFirst = attorneyMatch[1];
            const candidateLast = attorneyMatch[2];
            if (!nonNameWords.includes(candidateFirst.toLowerCase()) &&
                !nonNameWords.includes(candidateLast.toLowerCase())) {
                firstName = candidateFirst;
                lastName = candidateLast;
            }
        }
    }

    // Only return if we found valid names (don't be too aggressive)
    if (firstName && lastName && firstName.length > 1 && lastName.length > 1) {
        return { firstName, lastName };
    }
    return null;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('WSBA Contact Fix Script');
    console.log('='.repeat(60));

    if (DELETE_UNUSABLE) {
        console.log('MODE: Delete unusable contacts (missing firstName or lastName)');
    } else {
        console.log('MODE: Fix firmName and extract names');
    }

    if (DRY_RUN) {
        console.log('*** DRY RUN - No changes will be made ***');
        console.log('Run with --run flag to apply changes\n');
    } else {
        console.log('*** LIVE MODE - Changes will be applied ***\n');
    }

    const db = initializeFirebase();

    // Query all WSBA contacts
    console.log('Querying WSBA contacts...');
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'wsba')
        .get();

    console.log(`Found ${snapshot.size} WSBA contacts\n`);

    // DELETE UNUSABLE MODE
    if (DELETE_UNUSABLE) {
        const toDelete = [];
        const usable = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Contact is unusable if missing firstName OR lastName
            if (!data.firstName || !data.lastName) {
                toDelete.push({
                    id: doc.id,
                    ref: doc.ref,
                    email: data.email,
                    firstName: data.firstName || '(missing)',
                    lastName: data.lastName || '(missing)',
                    firmName: data.firmName || '(missing)'
                });
            } else {
                usable.push(doc.id);
            }
        }

        console.log(`Unusable (missing names): ${toDelete.length}`);
        console.log(`Usable (has both names): ${usable.length}\n`);

        if (toDelete.length > 0) {
            console.log('Sample contacts to delete (first 10):');
            toDelete.slice(0, 10).forEach((c, i) => {
                console.log(`  ${i + 1}. ${c.email} | firstName: ${c.firstName} | lastName: ${c.lastName}`);
            });

            if (!DRY_RUN) {
                // Delete in batches
                let batch = db.batch();
                let batchCount = 0;
                const BATCH_SIZE = 400;

                for (const item of toDelete) {
                    batch.delete(item.ref);
                    batchCount++;

                    if (batchCount >= BATCH_SIZE) {
                        await batch.commit();
                        console.log(`Deleted batch of ${batchCount}`);
                        batch = db.batch();
                        batchCount = 0;
                    }
                }

                if (batchCount > 0) {
                    await batch.commit();
                    console.log(`Deleted final batch of ${batchCount}`);
                }

                console.log(`\n✓ Deleted ${toDelete.length} unusable WSBA contacts`);
            } else {
                console.log(`\nTo delete these ${toDelete.length} unusable contacts, run:`);
                console.log('  node scripts/fix-wsba-contacts.js --delete-unusable --run');
            }
        }

        // Also reset WSBA scrape progress so it can re-scrape
        if (!DRY_RUN) {
            const progressRef = db.collection('preintake_scrape_progress').doc('wsba');
            await progressRef.delete();
            console.log('✓ Reset WSBA scrape progress (will re-scrape from beginning)');
        }

        console.log('\nDone!');
        return;
    }

    // FIX MODE (original behavior)
    const stats = {
        total: snapshot.size,
        firmNameFixed: 0,
        namesExtracted: 0,
        noChanges: 0,
        errors: 0
    };

    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 400;
    const changes = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const updates = {};
        let changed = false;

        // Fix 1: Clean up firmName if it contains "or Employer:"
        if (data.firmName && data.firmName.toLowerCase().includes('or employer')) {
            const fixedFirmName = fixFirmName(data.firmName);
            if (fixedFirmName) {
                updates.firmName = fixedFirmName;
                changed = true;
                stats.firmNameFixed++;
            }
        }

        // Fix 2: Extract firstName/lastName if missing
        if (!data.firstName || !data.lastName) {
            // First try the (potentially fixed) firmName
            const firmNameToUse = updates.firmName || data.firmName;
            const extracted = extractNamesFromFirmName(firmNameToUse);

            if (extracted) {
                if (!data.firstName) updates.firstName = extracted.firstName;
                if (!data.lastName) updates.lastName = extracted.lastName;
                changed = true;
                stats.namesExtracted++;
            }
        }

        if (changed) {
            changes.push({
                id: doc.id,
                email: data.email,
                before: {
                    firmName: data.firmName,
                    firstName: data.firstName,
                    lastName: data.lastName
                },
                after: updates
            });

            if (!DRY_RUN) {
                batch.update(doc.ref, updates);
                batchCount++;

                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} updates`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }
        } else {
            stats.noChanges++;
        }
    }

    // Commit remaining batch
    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} updates`);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total WSBA contacts: ${stats.total}`);
    console.log(`firmName fixed: ${stats.firmNameFixed}`);
    console.log(`Names extracted: ${stats.namesExtracted}`);
    console.log(`No changes needed: ${stats.noChanges}`);

    // Show sample changes
    if (changes.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('SAMPLE CHANGES (first 10):');
        console.log('='.repeat(60));

        changes.slice(0, 10).forEach((c, i) => {
            console.log(`\n${i + 1}. ${c.email}`);
            if (c.after.firmName) {
                console.log(`   firmName: "${c.before.firmName}" → "${c.after.firmName}"`);
            }
            if (c.after.firstName || c.after.lastName) {
                console.log(`   names: "${c.before.firstName || ''} ${c.before.lastName || ''}" → "${c.after.firstName || c.before.firstName || ''} ${c.after.lastName || c.before.lastName || ''}"`);
            }
        });
    }

    if (DRY_RUN && changes.length > 0) {
        console.log(`\n\nTo apply these ${changes.length} changes, run:`);
        console.log('  node scripts/fix-wsba-contacts.js --run');
    }

    console.log('\nDone!');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
