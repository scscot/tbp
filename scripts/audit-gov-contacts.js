#!/usr/bin/env node
/**
 * Audit preintake_emails for government/institutional contacts
 *
 * Identifies contacts that are government agencies, courts, public defenders,
 * district attorneys, etc. - entities that don't need private intake services.
 *
 * Usage:
 *   node scripts/audit-gov-contacts.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
    serviceAccount = require(serviceAccountPath);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Government detection patterns
const GOV_EMAIL_PATTERNS = [
    { pattern: /\.gov$/i, category: 'federal_gov' },
    { pattern: /\.gov\./i, category: 'gov_subdomain' },
    { pattern: /\.state\./i, category: 'state_gov' },
    { pattern: /\.\w{2}\.us$/i, category: 'state_us' },  // .ca.us, .tx.us, etc.
    { pattern: /\.mil$/i, category: 'military' },
    { pattern: /county/i, category: 'county' },
    { pattern: /@courts?\./i, category: 'court' },
];

const GOV_FIRM_PATTERNS = [
    { pattern: /social security/i, category: 'ssa' },
    { pattern: /\bssa\b/i, category: 'ssa' },
    { pattern: /public defender/i, category: 'public_defender' },
    { pattern: /indigent defense/i, category: 'public_defender' },
    { pattern: /legal aid/i, category: 'legal_aid' },
    { pattern: /district attorney/i, category: 'prosecutor' },
    { pattern: /\bda\s*office\b/i, category: 'prosecutor' },
    { pattern: /prosecutor/i, category: 'prosecutor' },
    { pattern: /attorney general/i, category: 'attorney_general' },
    { pattern: /state attorney/i, category: 'prosecutor' },
    { pattern: /\bdepartment of\b/i, category: 'govt_dept' },
    { pattern: /^state of\s/i, category: 'state_govt' },
    { pattern: /^county of\s/i, category: 'county_govt' },
    { pattern: /^city of\s/i, category: 'city_govt' },
    { pattern: /\bcourt\b/i, category: 'court', exclude: /courtney|courthouse|courtland|court\s*(house|yard|ney)/i },
    { pattern: /judicial/i, category: 'court' },
    { pattern: /magistrate/i, category: 'court' },
    { pattern: /\bjudge\b/i, category: 'court' },
    { pattern: /\bu\.?s\.?\s*(army|navy|air force|marine|coast guard)/i, category: 'military' },
    { pattern: /veterans?\s*(admin|affairs|administration)/i, category: 'va' },
    { pattern: /\bva\s*(hospital|medical|healthcare)/i, category: 'va' },
];

async function main() {
    console.log('Government/Institutional Contacts Audit');
    console.log('='.repeat(70));

    const snapshot = await db.collection('preintake_emails').get();
    console.log(`Total records in preintake_emails: ${snapshot.size}\n`);

    const govContacts = [];
    const categories = {};

    snapshot.forEach(doc => {
        const d = doc.data();
        const email = (d.email || '').toLowerCase();
        const firmName = (d.firmName || '');
        const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim();

        let matched = false;
        const matchedCategories = [];

        // Check email patterns
        for (const { pattern, category } of GOV_EMAIL_PATTERNS) {
            if (pattern.test(email)) {
                matchedCategories.push(category);
                matched = true;
            }
        }

        // Check firm name patterns
        for (const { pattern, category, exclude } of GOV_FIRM_PATTERNS) {
            if (pattern.test(firmName)) {
                // Check exclusion pattern if exists
                if (exclude && exclude.test(firmName)) continue;
                matchedCategories.push(category);
                matched = true;
            }
        }

        if (matched) {
            govContacts.push({
                id: doc.id,
                email,
                firmName,
                name: fullName,
                source: d.source,
                state: d.state,
                practiceArea: d.practiceArea,
                categories: [...new Set(matchedCategories)]
            });

            matchedCategories.forEach(cat => {
                categories[cat] = (categories[cat] || 0) + 1;
            });
        }
    });

    // Print results by category
    console.log('MATCHES BY CATEGORY:');
    console.log('-'.repeat(50));
    Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count}`);
        });

    console.log('\n' + '='.repeat(70));
    console.log('SAMPLE RECORDS BY CATEGORY:\n');

    // Group by category and show samples
    const byCategory = {};
    govContacts.forEach(c => {
        c.categories.forEach(cat => {
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(c);
        });
    });

    Object.entries(byCategory)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([cat, contacts]) => {
            console.log(`${cat.toUpperCase()} (${contacts.length} total):`);
            contacts.slice(0, 5).forEach(c => {
                console.log(`  ${c.email}`);
                if (c.firmName) console.log(`    Firm: ${c.firmName}`);
                console.log(`    Source: ${c.source}, State: ${c.state || 'N/A'}`);
            });
            if (contacts.length > 5) console.log(`  ... and ${contacts.length - 5} more\n`);
            else console.log();
        });

    // Summary by source
    console.log('='.repeat(70));
    console.log('SUMMARY BY SOURCE:');
    console.log('-'.repeat(50));

    const bySource = {};
    govContacts.forEach(c => {
        bySource[c.source] = (bySource[c.source] || 0) + 1;
    });

    Object.entries(bySource)
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
            console.log(`  ${source}: ${count}`);
        });

    console.log('\n' + '='.repeat(70));
    console.log('TOTAL SUMMARY:');
    console.log('-'.repeat(50));
    console.log(`Total government/institutional contacts: ${govContacts.length}`);
    console.log(`Percentage of total: ${(govContacts.length / snapshot.size * 100).toFixed(2)}%`);
    console.log(`Unique categories matched: ${Object.keys(categories).length}`);

    // Write detailed report
    const reportPath = path.join(__dirname, 'gov-contacts-audit.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalRecords: snapshot.size,
        govContactsCount: govContacts.length,
        percentageGov: (govContacts.length / snapshot.size * 100).toFixed(2),
        byCategory: categories,
        bySource,
        contacts: govContacts
    }, null, 2));

    console.log(`\nDetailed report written to: ${reportPath}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
