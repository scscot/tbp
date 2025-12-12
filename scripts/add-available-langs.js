#!/usr/bin/env node
/**
 * Add data-available-langs attribute to company pages
 *
 * This script checks which locales have each company page and adds
 * a data-available-langs attribute to the <html> tag.
 *
 * Usage: node scripts/add-available-langs.js
 */

const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'pt', 'de'];
const directories = {
    en: 'web/companies',
    es: 'web-es/companies',
    pt: 'web-pt/companies',
    de: 'web-de/companies'
};

const basePath = path.join(__dirname, '..');

let totalProcessed = 0;
let totalUpdated = 0;

// Get all unique company page filenames across all locales
function getAllCompanyFiles() {
    const allFiles = new Set();
    for (const locale of locales) {
        const dirPath = path.join(basePath, directories[locale]);
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath)
                .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'));
            files.forEach(f => allFiles.add(f));
        }
    }
    return Array.from(allFiles).sort();
}

// Check which locales have a specific company file
function getAvailableLocales(filename) {
    const available = [];
    for (const locale of locales) {
        const filePath = path.join(basePath, directories[locale], filename);
        if (fs.existsSync(filePath)) {
            available.push(locale);
        }
    }
    return available;
}

// Update a company page with the data-available-langs attribute
function updateFile(locale, filename, availableLangs) {
    const filePath = path.join(basePath, directories[locale], filename);
    if (!fs.existsSync(filePath)) return false;

    totalProcessed++;
    let content = fs.readFileSync(filePath, 'utf8');
    const langsAttr = `data-available-langs="${availableLangs.join(',')}"`;

    // Check if already has the attribute
    if (content.includes('data-available-langs=')) {
        // Update existing attribute
        content = content.replace(
            /data-available-langs="[^"]*"/,
            langsAttr
        );
    } else {
        // Add attribute to <html> tag
        content = content.replace(
            /<html\s+lang="/,
            `<html ${langsAttr} lang="`
        );
    }

    fs.writeFileSync(filePath, content, 'utf8');
    totalUpdated++;
    return true;
}

// Main execution
console.log('=============================================');
console.log('  Adding data-available-langs to company pages');
console.log('=============================================\n');

const allFiles = getAllCompanyFiles();
console.log(`Found ${allFiles.length} unique company pages\n`);

// Build availability map
const availabilityMap = {};
for (const filename of allFiles) {
    availabilityMap[filename] = getAvailableLocales(filename);
}

// Show some stats
const fullAvailability = allFiles.filter(f => availabilityMap[f].length === 4).length;
const partialAvailability = allFiles.filter(f => availabilityMap[f].length < 4).length;
console.log(`Pages available in all 4 languages: ${fullAvailability}`);
console.log(`Pages with partial availability: ${partialAvailability}\n`);

// Update all files
for (const locale of locales) {
    console.log(`=== Processing ${locale.toUpperCase()} ===`);
    const dirPath = path.join(basePath, directories[locale]);
    if (!fs.existsSync(dirPath)) {
        console.log(`  Directory not found: ${directories[locale]}`);
        continue;
    }

    const files = fs.readdirSync(dirPath)
        .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'));

    for (const filename of files) {
        const availableLangs = availabilityMap[filename];
        updateFile(locale, filename, availableLangs);
    }
    console.log(`  Updated ${files.length} files`);
}

console.log('\n=============================================');
console.log('  SUMMARY');
console.log('=============================================');
console.log(`Total processed: ${totalProcessed}`);
console.log(`Total updated:   ${totalUpdated}`);
console.log('=============================================');
