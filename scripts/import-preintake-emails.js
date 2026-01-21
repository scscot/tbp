#!/usr/bin/env node
/**
 * Import PreIntake.ai Law Firms to Firestore
 *
 * Reads law-firms-directory-with-emails.csv and imports records
 * with valid email addresses to Firestore preintake_emails collection.
 *
 * Usage: node scripts/import-preintake-emails.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Use the dedicated 'preintake' database (same as preintake-functions.js)
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const COLLECTION_NAME = 'preintake_emails';
const CSV_PATH = path.join(__dirname, '../preintake/law-firms-directory-with-emails.csv');

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

        // Handle CSV with possible quoted fields
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
 * Validate email format
 */
function isValidEmail(email) {
    if (!email || !email.trim()) return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email.trim());
}

/**
 * Main import function
 */
async function importEmails() {
    console.log('📂 Reading CSV file...');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found: ${CSV_PATH}`);
        process.exit(1);
    }

    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parseCSV(content);

    console.log(`📊 Total records in CSV: ${records.length}`);

    // Filter records with valid email addresses
    const validRecords = records.filter(record => {
        const email = record.email?.trim();
        return isValidEmail(email);
    });

    console.log(`✅ Records with valid email: ${validRecords.length}`);

    // Check for existing records to avoid duplicates
    console.log('\n🔍 Checking for existing records...');
    const existingSnapshot = await db.collection(COLLECTION_NAME).get();
    const existingEmails = new Set();
    existingSnapshot.forEach(doc => {
        const email = doc.data().email?.toLowerCase();
        if (email) existingEmails.add(email);
    });
    console.log(`   Found ${existingEmails.size} existing records`);

    // Filter out already imported emails
    const newRecords = validRecords.filter(record => {
        const email = record.email?.trim().toLowerCase();
        return !existingEmails.has(email);
    });

    console.log(`🆕 New records to import: ${newRecords.length}`);

    if (newRecords.length === 0) {
        console.log('\n✅ No new records to import. All emails already exist.');
        process.exit(0);
    }

    // Import in batches of 500 (Firestore limit)
    const BATCH_SIZE = 500;
    let imported = 0;
    let batches = 0;

    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = newRecords.slice(i, i + BATCH_SIZE);

        for (const record of chunk) {
            const docRef = db.collection(COLLECTION_NAME).doc();

            const docData = {
                firmName: record.firm_name?.trim() || '',
                website: record.website?.trim() || '',
                practiceArea: record.practice_area?.trim() || '',
                state: record.state?.trim() || '',
                email: record.email?.trim().toLowerCase() || '',
                allEmails: record.all_emails?.trim() || '',
                sent: false,
                sentTimestamp: null,
                status: 'pending',
                errorMessage: '',
                batchId: '',
                unsubscribedAt: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                randomIndex: Math.random(), // For pseudo-random ordering
                source: 'lead_gen' // From PreIntake Lead Generation workflow
            };

            batch.set(docRef, docData);
        }

        await batch.commit();
        imported += chunk.length;
        batches++;
        console.log(`   Batch ${batches}: Imported ${chunk.length} records (Total: ${imported})`);
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Total imported: ${imported}`);
    console.log(`   Batches: ${batches}`);

    // Show practice area breakdown
    const practiceAreaCounts = {};
    newRecords.forEach(record => {
        const area = record.practice_area?.trim() || 'Unknown';
        practiceAreaCounts[area] = (practiceAreaCounts[area] || 0) + 1;
    });

    console.log('\n📊 Practice Area Breakdown:');
    Object.entries(practiceAreaCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([area, count]) => {
            console.log(`   ${area}: ${count}`);
        });

    process.exit(0);
}

// Run import
importEmails().catch(error => {
    console.error('❌ Import failed:', error);
    process.exit(1);
});
