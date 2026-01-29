#!/usr/bin/env node
/**
 * Clean up malformed firm names in preintake_leads collection
 *
 * Some firm names from the email campaign contain addresses concatenated
 * Example: "Lisa L. Cullaro, P.A.PO Box 271150Tampa, FL 33688-1150"
 *
 * Usage:
 *   node scripts/cleanup-malformed-firmnames.js          # Dry run (preview changes)
 *   node scripts/cleanup-malformed-firmnames.js --run    # Apply changes
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const LEADS_COLLECTION = 'preintake_leads';
const EMAILS_COLLECTION = 'preintake_emails';

/**
 * Clean firm name by removing address information
 */
function cleanFirmName(firmText) {
    if (!firmText) return '';

    let cleaned = firmText.trim();

    // Pattern 1: PO Box (with or without space after number)
    const poBoxMatch = cleaned.match(/^(.+?)\s*PO\s*Box/i);
    if (poBoxMatch) {
        return poBoxMatch[1].trim();
    }

    // Pattern 2: Street number followed by text (standard address)
    const streetMatch = cleaned.match(/^(.+?)(\d+\s*[A-Za-z])/);
    if (streetMatch && streetMatch[1].length > 3) {
        return streetMatch[1].trim();
    }

    // Pattern 3: State abbreviation + ZIP code
    const stateZipMatch = cleaned.match(/^(.+?),\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/);
    if (stateZipMatch) {
        return stateZipMatch[1].trim();
    }

    // Pattern 4: 5-digit ZIP code anywhere (last resort)
    const zipMatch = cleaned.match(/^(.+?)\d{5}(-\d{4})?/);
    if (zipMatch && zipMatch[1].length > 3) {
        const candidate = zipMatch[1].trim();
        const finalCleaned = candidate.replace(/,\s*[A-Za-z\s]*$/, '').trim();
        if (finalCleaned.length > 3) {
            return finalCleaned;
        }
    }

    // No address patterns found - return as-is (unless it starts with a number)
    if (!cleaned.match(/^\d/)) {
        return cleaned;
    }

    return '';
}

/**
 * Detect if a firm name looks malformed (contains address info)
 */
function isMalformed(name) {
    if (!name) return false;

    // Check for obvious address patterns
    const addressPatterns = [
        /PO\s*Box/i,                    // PO Box
        /\d{5}(-\d{4})?/,               // ZIP codes
        /,\s*[A-Z]{2}\s+\d{5}/,         // State + ZIP (", FL 33688")
        /\d+\s+(N\.?|S\.?|E\.?|W\.?|North|South|East|West)/i,  // Street directions
        /\d+\s+[A-Za-z]+\s+(St|Ave|Blvd|Dr|Rd|Ln|Way|Ct)/i,    // Street suffixes
    ];

    for (const pattern of addressPatterns) {
        if (pattern.test(name)) {
            return true;
        }
    }

    // Check for just a number (like "1")
    if (/^\d+$/.test(name.trim())) {
        return true;
    }

    return false;
}

/**
 * Derive a firm name from an email domain
 * e.g., showell@showellblades.com -> "Showell Blades"
 *       fabbott@abbottlawpa.com -> "Abbott Law PA"
 */
function deriveFirmNameFromEmail(email) {
    if (!email) return '';

    const match = email.match(/@([^.]+)/);
    if (!match) return '';

    let domain = match[1];

    // Extract and preserve suffixes before processing
    const suffixes = [];
    const suffixPatterns = [
        { pattern: /lawpa$/i, replace: '', suffix: ' Law PA' },
        { pattern: /lawpc$/i, replace: '', suffix: ' Law PC' },
        { pattern: /lawpllc$/i, replace: '', suffix: ' Law PLLC' },
        { pattern: /lawllc$/i, replace: '', suffix: ' Law LLC' },
        { pattern: /lawfirm$/i, replace: '', suffix: ' Law Firm' },
        { pattern: /law$/i, replace: '', suffix: ' Law' },
        { pattern: /legal$/i, replace: '', suffix: ' Legal' },
        { pattern: /pa$/i, replace: '', suffix: ', PA' },
        { pattern: /pc$/i, replace: '', suffix: ', PC' },
        { pattern: /pllc$/i, replace: '', suffix: ' PLLC' },
        { pattern: /llc$/i, replace: '', suffix: ' LLC' },
        { pattern: /esq$/i, replace: '', suffix: ', Esq.' },
        { pattern: /attorney$/i, replace: '', suffix: ' Attorney' },
        { pattern: /attorneys$/i, replace: '', suffix: ' Attorneys' },
    ];

    for (const { pattern, suffix } of suffixPatterns) {
        if (pattern.test(domain)) {
            domain = domain.replace(pattern, '');
            suffixes.push(suffix);
            break;  // Only match one suffix
        }
    }

    // Skip common generic prefixes
    if (/^(info|contact|admin|mail|hello|support|office)$/i.test(domain)) {
        return '';
    }

    // Convert camelCase/concatenated words to spaces
    domain = domain
        .replace(/([a-z])([A-Z])/g, '$1 $2')    // camelCase
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');  // ABCDef -> ABC Def

    // Capitalize first letter of each word
    const formatted = domain
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    return (formatted + suffixes.join('')).trim() || '';
}

async function main() {
    const dryRun = !process.argv.includes('--run');

    console.log('🔍 Scanning preintake_leads for malformed firm names...\n');
    console.log(dryRun ? '📋 DRY RUN - No changes will be made\n' : '⚡ LIVE RUN - Changes will be applied\n');

    // Get all leads
    const snapshot = await db.collection(LEADS_COLLECTION).get();

    // Build email lookup from preintake_emails for fallback
    console.log('📧 Loading preintake_emails for fallback lookups...');
    const emailsSnapshot = await db.collection(EMAILS_COLLECTION).get();
    const emailToFirmName = new Map();
    const emailToPersonName = new Map();
    for (const doc of emailsSnapshot.docs) {
        const data = doc.data();
        const emailLower = data.email?.toLowerCase();
        if (!emailLower) continue;

        // Store clean firm name
        if (data.firmName) {
            const cleaned = cleanFirmName(data.firmName);
            if (cleaned && !isMalformed(cleaned)) {
                emailToFirmName.set(emailLower, cleaned);
            }
        }

        // Store person name for attorney fallback
        if (data.firstName && data.lastName) {
            const firstName = data.firstName.trim();
            const lastName = data.lastName.replace(/,+$/, '').trim();  // Remove trailing commas
            if (firstName && lastName) {
                emailToPersonName.set(emailLower, `${firstName} ${lastName}, Attorney at Law`);
            }
        }
    }
    console.log(`   Loaded ${emailToFirmName.size} email->firmName mappings`);
    console.log(`   Loaded ${emailToPersonName.size} email->personName mappings\n`);

    const malformed = [];
    const unfixable = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const currentName = data.name || '';
        const analysisName = data.analysis?.firmName;
        const email = data.email?.toLowerCase();

        if (isMalformed(currentName)) {
            // Try to fix it
            let cleanedName = '';
            let source = '';

            // Option 1: Use analysis.firmName if it looks clean
            if (analysisName && !isMalformed(analysisName)) {
                cleanedName = analysisName;
                source = 'analysis.firmName';
            }
            // Option 2: Try to clean the current name
            else {
                const cleaned = cleanFirmName(currentName);
                if (cleaned && cleaned.length > 2 && !isMalformed(cleaned)) {
                    cleanedName = cleaned;
                    source = 'cleanFirmName()';
                }
            }
            // Option 3: Look up from preintake_emails
            if (!cleanedName && email && emailToFirmName.has(email)) {
                cleanedName = emailToFirmName.get(email);
                source = 'preintake_emails lookup';
            }
            // Option 4: Use person name from preintake_emails (for sole practitioners)
            if (!cleanedName && email && emailToPersonName.has(email)) {
                cleanedName = emailToPersonName.get(email);
                source = 'person name from preintake_emails';
            }
            // Option 5: Derive from email domain (last resort)
            if (!cleanedName && email) {
                const derived = deriveFirmNameFromEmail(email);
                if (derived && derived.length > 2) {
                    cleanedName = derived;
                    source = 'derived from email domain';
                }
            }

            if (cleanedName && cleanedName.length > 2 && !isMalformed(cleanedName)) {
                malformed.push({
                    id: doc.id,
                    email: data.email,
                    currentName,
                    cleanedName,
                    source
                });
            } else {
                unfixable.push({
                    id: doc.id,
                    email: data.email,
                    currentName,
                    analysisName: analysisName || '(none)'
                });
            }
        }
    }

    // Report malformed names that can be fixed
    if (malformed.length > 0) {
        console.log(`\n✅ Found ${malformed.length} fixable malformed firm names:\n`);
        for (const item of malformed) {
            console.log(`  📄 ${item.id}`);
            console.log(`     Email: ${item.email}`);
            console.log(`     Before: "${item.currentName}"`);
            console.log(`     After:  "${item.cleanedName}" (via ${item.source})`);
            console.log('');
        }
    }

    // Report unfixable names
    if (unfixable.length > 0) {
        console.log(`\n⚠️ Found ${unfixable.length} unfixable malformed firm names:\n`);
        for (const item of unfixable) {
            console.log(`  📄 ${item.id}`);
            console.log(`     Email: ${item.email}`);
            console.log(`     Current: "${item.currentName}"`);
            console.log(`     analysis.firmName: "${item.analysisName}"`);
            console.log('');
        }
    }

    // Apply fixes
    if (!dryRun && malformed.length > 0) {
        console.log('\n🔧 Applying fixes...\n');

        let fixed = 0;
        let failed = 0;

        for (const item of malformed) {
            try {
                await db.collection(LEADS_COLLECTION).doc(item.id).update({
                    name: item.cleanedName,
                    'analysis.firmName': item.cleanedName,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`  ✓ Fixed: ${item.id}`);
                fixed++;
            } catch (error) {
                console.log(`  ❌ Failed: ${item.id} - ${error.message}`);
                failed++;
            }
        }

        console.log(`\n📊 Results: ${fixed} fixed, ${failed} failed`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`Total leads scanned: ${snapshot.size}`);
    console.log(`Malformed (fixable): ${malformed.length}`);
    console.log(`Malformed (unfixable): ${unfixable.length}`);

    if (dryRun && malformed.length > 0) {
        console.log('\n💡 Run with --run flag to apply fixes');
    }

    process.exit(0);
}

main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
