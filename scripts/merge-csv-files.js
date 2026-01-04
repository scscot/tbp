#!/usr/bin/env node
/**
 * Merge law-firms-directory.csv and law-firms-directory-with-emails.csv
 *
 * The emails CSV has more firms than the directory CSV due to sync issues.
 * This script merges them, keeping all unique firms from both sources.
 *
 * Usage: node scripts/merge-csv-files.js
 */

const fs = require('fs');
const path = require('path');

const PREINTAKE_DIR = path.join(__dirname, '../preintake');
const DIRECTORY_CSV = path.join(PREINTAKE_DIR, 'law-firms-directory.csv');
const EMAILS_CSV = path.join(PREINTAKE_DIR, 'law-firms-directory-with-emails.csv');

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

function main() {
    console.log('🔄 Merging CSV files...\n');

    // Read both CSVs
    const dirContent = fs.readFileSync(DIRECTORY_CSV, 'utf-8');
    const emailsContent = fs.readFileSync(EMAILS_CSV, 'utf-8');

    const dirRecords = parseCSV(dirContent);
    const emailsRecords = parseCSV(emailsContent);

    console.log(`Directory CSV: ${dirRecords.length} firms`);
    console.log(`Emails CSV: ${emailsRecords.length} firms`);

    // Build map from emails CSV (more complete data)
    const firmsByDomain = new Map();

    // First, add all from emails CSV (has email data)
    for (const record of emailsRecords) {
        const domain = normalizeDomain(record.website);
        if (domain) {
            firmsByDomain.set(domain, {
                firm_name: record.firm_name,
                website: record.website,
                practice_area: record.practice_area,
                state: record.state,
                scraped_date: record.scraped_date || '',
                extraction_attempted: record.extraction_attempted || '',
                extraction_status: record.extraction_status || 'pending',
                email: record.email || '',
                all_emails: record.all_emails || ''
            });
        }
    }

    // Then update with directory CSV (may have newer extraction status)
    let updatedFromDir = 0;
    for (const record of dirRecords) {
        const domain = normalizeDomain(record.website);
        if (domain) {
            const existing = firmsByDomain.get(domain);
            if (existing) {
                // Update extraction status if directory has newer info
                if (record.extraction_attempted &&
                    (!existing.extraction_attempted || record.extraction_attempted > existing.extraction_attempted)) {
                    existing.extraction_attempted = record.extraction_attempted;
                    existing.extraction_status = record.extraction_status;
                    updatedFromDir++;
                }
            } else {
                // New firm from directory
                firmsByDomain.set(domain, {
                    firm_name: record.firm_name,
                    website: record.website,
                    practice_area: record.practice_area,
                    state: record.state,
                    scraped_date: record.scraped_date || '',
                    extraction_attempted: record.extraction_attempted || '',
                    extraction_status: record.extraction_status || 'pending',
                    email: '',
                    all_emails: ''
                });
            }
        }
    }

    const allFirms = Array.from(firmsByDomain.values());

    console.log(`\nMerged total: ${allFirms.length} unique firms`);
    console.log(`Updated from directory: ${updatedFromDir}`);

    // Count by status
    const successCount = allFirms.filter(f => f.extraction_status === 'success').length;
    const failedCount = allFirms.filter(f => f.extraction_status === 'failed').length;
    const pendingCount = allFirms.filter(f => f.extraction_status === 'pending' || !f.extraction_status).length;

    console.log(`\nBy status:`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log(`  Pending: ${pendingCount}`);

    // Write directory CSV (without email columns)
    const dirFieldnames = ['firm_name', 'website', 'practice_area', 'state',
                           'scraped_date', 'extraction_attempted', 'extraction_status'];

    let dirOutput = dirFieldnames.join(',') + '\n';
    for (const record of allFirms) {
        const values = dirFieldnames.map(field => {
            let val = record[field] || '';
            if (val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });
        dirOutput += values.join(',') + '\n';
    }

    fs.writeFileSync(DIRECTORY_CSV, dirOutput);
    console.log(`\n💾 Saved: ${DIRECTORY_CSV}`);

    // Write emails CSV
    const emailFieldnames = ['firm_name', 'website', 'practice_area', 'state',
                             'scraped_date', 'extraction_attempted', 'extraction_status',
                             'email', 'all_emails'];

    let emailsOutput = emailFieldnames.join(',') + '\n';
    for (const record of allFirms) {
        const values = emailFieldnames.map(field => {
            let val = record[field] || '';
            if (val.includes(',')) {
                val = `"${val}"`;
            }
            return val;
        });
        emailsOutput += values.join(',') + '\n';
    }

    fs.writeFileSync(EMAILS_CSV, emailsOutput);
    console.log(`💾 Saved: ${EMAILS_CSV}`);

    console.log('\n✅ Merge complete!');
}

main();
