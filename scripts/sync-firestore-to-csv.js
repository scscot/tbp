#!/usr/bin/env node
/**
 * Sync Firestore preintake_emails back to CSV
 *
 * Fetches all emails from Firestore and updates the CSV to mark
 * matching firms as extraction_status: success with their email addresses.
 *
 * Usage: node scripts/sync-firestore-to-csv.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const COLLECTION_NAME = 'preintake_emails';
const DIRECTORY_CSV = path.join(__dirname, '../preintake/law-firms-directory.csv');
const EMAILS_CSV = path.join(__dirname, '../preintake/law-firms-directory-with-emails.csv');

/**
 * Parse CSV file
 */
function parseCSV(content) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const record = {};
        headers.forEach((header, idx) => {
            record[header.trim()] = values[idx] || '';
        });
        records.push(record);
    }

    return records;
}

/**
 * Normalize domain for matching
 */
function normalizeDomain(url) {
    if (!url) return '';
    try {
        let domain = url.toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/$/, '');
        return domain.split('/')[0];
    } catch (e) {
        return '';
    }
}

/**
 * Main sync function
 */
async function syncFirestoreToCSV() {
    console.log('🔄 Syncing Firestore preintake_emails to CSV...\n');

    // Fetch all records from Firestore
    console.log('📥 Fetching records from Firestore...');
    const snapshot = await db.collection(COLLECTION_NAME).get();

    const firestoreRecords = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        firestoreRecords.push({
            email: data.email?.toLowerCase() || '',
            firmName: data.firmName || '',
            website: data.website || '',
            domain: normalizeDomain(data.website)
        });
    });

    console.log(`   Found ${firestoreRecords.length} records in Firestore`);

    // Build lookup maps
    const emailSet = new Set(firestoreRecords.map(r => r.email).filter(e => e));
    const domainToEmail = {};
    firestoreRecords.forEach(r => {
        if (r.domain && r.email) {
            domainToEmail[r.domain] = r.email;
        }
    });

    console.log(`   Unique emails: ${emailSet.size}`);
    console.log(`   Domain mappings: ${Object.keys(domainToEmail).length}`);

    // Read CSV
    console.log('\n📂 Reading CSV files...');
    const csvContent = fs.readFileSync(EMAILS_CSV, 'utf-8');
    const records = parseCSV(csvContent);
    console.log(`   Total records in CSV: ${records.length}`);

    // Count current state
    const beforeSuccess = records.filter(r => r.extraction_status === 'success').length;
    console.log(`   Currently marked as success: ${beforeSuccess}`);

    // Update records
    let updated = 0;
    let alreadyComplete = 0;
    let emailsPopulated = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const record of records) {
        const recordDomain = normalizeDomain(record.website);
        const existingEmail = record.email?.toLowerCase();

        // If already success WITH email, skip
        if (record.extraction_status === 'success' && existingEmail) {
            alreadyComplete++;
            continue;
        }

        // Check if we have this email in Firestore
        let matchedEmail = null;

        // First try to match by existing email in CSV
        if (existingEmail && emailSet.has(existingEmail)) {
            matchedEmail = existingEmail;
        }
        // Then try to match by domain
        else if (recordDomain && domainToEmail[recordDomain]) {
            matchedEmail = domainToEmail[recordDomain];
        }

        if (matchedEmail) {
            // If was already success but missing email, just populate email
            if (record.extraction_status === 'success') {
                record.email = matchedEmail;
                emailsPopulated++;
            } else {
                record.email = matchedEmail;
                record.extraction_status = 'success';
                record.extraction_attempted = record.extraction_attempted || today;
                updated++;
            }
        }
    }

    console.log(`\n✅ Sync Results:`);
    console.log(`   Already complete (success + email): ${alreadyComplete}`);
    console.log(`   Emails populated for success records: ${emailsPopulated}`);
    console.log(`   Newly synced from Firestore: ${updated}`);
    console.log(`   Total now success: ${alreadyComplete + emailsPopulated + updated}`);

    // Write updated emails CSV
    const emailFieldnames = ['firm_name', 'website', 'practice_area', 'state',
                             'scraped_date', 'extraction_attempted', 'extraction_status',
                             'email', 'all_emails'];

    let emailsCsvOutput = emailFieldnames.join(',') + '\n';
    for (const record of records) {
        const values = emailFieldnames.map(field => {
            let val = record[field] || '';
            // Quote if contains comma
            if (val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });
        emailsCsvOutput += values.join(',') + '\n';
    }

    fs.writeFileSync(EMAILS_CSV, emailsCsvOutput);
    console.log(`\n💾 Updated: ${EMAILS_CSV}`);

    // Also update the directory CSV (without email columns)
    const dirFieldnames = ['firm_name', 'website', 'practice_area', 'state',
                           'scraped_date', 'extraction_attempted', 'extraction_status'];

    let dirCsvOutput = dirFieldnames.join(',') + '\n';
    for (const record of records) {
        const values = dirFieldnames.map(field => {
            let val = record[field] || '';
            if (val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });
        dirCsvOutput += values.join(',') + '\n';
    }

    fs.writeFileSync(DIRECTORY_CSV, dirCsvOutput);
    console.log(`💾 Updated: ${DIRECTORY_CSV}`);

    console.log('\n✅ Sync complete!');
    process.exit(0);
}

// Run
syncFirestoreToCSV().catch(error => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
});
