#!/usr/bin/env node
/**
 * Fix OKBAR contacts in preintake_emails collection
 *
 * Issues to fix:
 * 1. Missing firstName and lastName fields (firmName contains the full name)
 *
 * Usage:
 *   node scripts/fix-okbar-contacts.js                    # Dry run (preview)
 *   node scripts/fix-okbar-contacts.js --run              # Apply fixes
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DRY_RUN = !process.argv.includes('--run');

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
// NAME PARSING
// ============================================================================

/**
 * Parse name in "First Last" format, handling common suffixes
 */
function parseName(nameStr) {
    if (!nameStr) return { firstName: '', lastName: '' };

    // Remove extra whitespace
    nameStr = nameStr.trim().replace(/\s+/g, ' ');

    // Common suffixes to remove from name parsing
    const suffixes = ['Jr', 'Jr.', 'Sr', 'Sr.', 'II', 'III', 'IV', 'Esq', 'Esq.'];

    // Remove suffix if present at end
    let cleanedName = nameStr;
    for (const suffix of suffixes) {
        const suffixPattern = new RegExp(`[,\\s]+${suffix}$`, 'i');
        cleanedName = cleanedName.replace(suffixPattern, '').trim();
    }

    // Split on comma first (might be "Last, First" format)
    if (cleanedName.includes(',')) {
        const parts = cleanedName.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            const lastName = parts[0];
            const firstNames = parts[1].split(' ');
            const firstName = firstNames[0] || '';
            return { firstName, lastName };
        }
    }

    // Space-separated (First Last)
    const spaceParts = cleanedName.split(' ');
    if (spaceParts.length >= 2) {
        return {
            firstName: spaceParts[0],
            lastName: spaceParts[spaceParts.length - 1]
        };
    }

    // Single word - treat as first name
    return { firstName: cleanedName, lastName: '' };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('OKBAR Contact Fix Script');
    console.log('='.repeat(60));
    console.log('MODE: Fix contacts missing firstName/lastName');

    if (DRY_RUN) {
        console.log('*** DRY RUN - No changes will be made ***');
        console.log('Run with --run flag to apply changes\n');
    } else {
        console.log('*** LIVE MODE - Changes will be applied ***\n');
    }

    const db = initializeFirebase();

    // Query all OKBAR contacts
    console.log('Querying OKBAR contacts...');
    const snapshot = await db.collection('preintake_emails')
        .where('source', '==', 'okbar')
        .get();

    console.log(`Found ${snapshot.size} OKBAR contacts\n`);

    const toFix = [];
    const toDelete = [];
    const alreadyOk = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Check if already has firstName and lastName
        if (data.firstName && data.lastName) {
            alreadyOk.push(doc.id);
            continue;
        }

        // Try to parse name from firmName
        const { firstName, lastName } = parseName(data.firmName);

        if (firstName && lastName) {
            toFix.push({
                id: doc.id,
                ref: doc.ref,
                email: data.email,
                firmName: data.firmName,
                firstName,
                lastName
            });
        } else {
            // Can't fix - mark for deletion
            toDelete.push({
                id: doc.id,
                ref: doc.ref,
                email: data.email,
                firmName: data.firmName
            });
        }
    }

    console.log(`Already OK (has firstName/lastName): ${alreadyOk.length}`);
    console.log(`Fixable (can parse name): ${toFix.length}`);
    console.log(`Unfixable (will delete): ${toDelete.length}\n`);

    // Show contacts to fix
    if (toFix.length > 0) {
        console.log('Contacts to fix:');
        toFix.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.email} | "${c.firmName}" → firstName: ${c.firstName}, lastName: ${c.lastName}`);
        });
        console.log('');
    }

    // Show contacts to delete
    if (toDelete.length > 0) {
        console.log('Contacts to delete (cannot parse name):');
        toDelete.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.email} | "${c.firmName}"`);
        });
        console.log('');
    }

    if (!DRY_RUN) {
        // Apply fixes
        if (toFix.length > 0) {
            console.log('Applying fixes...');
            for (const item of toFix) {
                await item.ref.update({
                    firstName: item.firstName,
                    lastName: item.lastName
                });
            }
            console.log(`✓ Fixed ${toFix.length} contacts`);
        }

        // Delete unfixable
        if (toDelete.length > 0) {
            console.log('Deleting unfixable contacts...');
            for (const item of toDelete) {
                await item.ref.delete();
            }
            console.log(`✓ Deleted ${toDelete.length} unfixable contacts`);
        }
    } else {
        console.log('To apply these changes, run:');
        console.log('  node scripts/fix-okbar-contacts.js --run');
    }

    console.log('\nDone!');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
