#!/usr/bin/env node
/**
 * Fix Video Lightbox - Simplify to Text Link
 *
 * This script:
 * 1. Removes the video thumbnail from the bottom CTA section
 * 2. Adds a simple text link to the hero CTA section
 *
 * Usage: node scripts/fix-video-lightbox.js
 */

const fs = require('fs');
const path = require('path');

// Localized link text
const linkText = {
    en: 'Watch 60-Second Video',
    es: 'Ver Video de 60 Segundos',
    pt: 'Assistir Vídeo de 60 Segundos',
    de: '60-Sekunden-Video ansehen'
};

// Directory mappings
const directories = [
    { path: 'web/companies', locale: 'en' },
    { path: 'web-es/companies', locale: 'es' },
    { path: 'web-pt/companies', locale: 'pt' },
    { path: 'web-de/companies', locale: 'de' }
];

let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let totalErrors = 0;

function processFile(filePath, locale) {
    totalProcessed++;

    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Check if lightbox exists (if not, skip)
        if (!content.includes('id="video-lightbox"')) {
            console.log(`  SKIP (no lightbox): ${path.basename(filePath)}`);
            totalSkipped++;
            return;
        }

        // Check if already has the text link (idempotent)
        if (content.includes('video-text-link')) {
            console.log(`  SKIP (already fixed): ${path.basename(filePath)}`);
            totalSkipped++;
            return;
        }

        // 1. Remove video thumbnail from bottom CTA section
        // Pattern matches the thumbnail block we added
        const thumbnailPattern = /\s*<!-- Video Thumbnail -->\s*<div class="video-thumbnail"[^>]*>[\s\S]*?<\/div>\s*<p style="font-size: 0\.875rem[^"]*">[^<]*<\/p>\s*(?=<a href="\/" class="cta-button">)/g;

        if (thumbnailPattern.test(content)) {
            content = content.replace(thumbnailPattern, '\n      ');
            modified = true;
        }

        // 2. Add text link to hero CTA section after the "Free 30-day trial" line
        // Find the closing div of the trial text and add link after it
        const trialDivPattern = /(<div style="font-size: 0\.875rem; color: rgba\(255,255,255,0\.9\); font-weight: 500;">\s*Free 30-day trial · \$4\.99\/mo · Cancel anytime\s*<\/div>)(\s*<\/section>)/;

        const text = linkText[locale];
        const videoLink = `\n        <a href="#" class="video-text-link" style="display: block; margin-top: 1rem; color: rgba(255,255,255,0.85); font-size: 0.875rem; text-decoration: underline; cursor: pointer;">${text}</a>`;

        if (trialDivPattern.test(content)) {
            content = content.replace(trialDivPattern, `$1${videoLink}$2`);
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  OK: ${path.basename(filePath)}`);
            totalUpdated++;
        } else {
            console.log(`  WARN (patterns not matched): ${path.basename(filePath)}`);
            totalErrors++;
        }

    } catch (err) {
        console.error(`  ERROR: ${path.basename(filePath)} - ${err.message}`);
        totalErrors++;
    }
}

function processDirectory(dirConfig) {
    const fullPath = path.join(__dirname, '..', dirConfig.path);

    if (!fs.existsSync(fullPath)) {
        console.log(`\nDirectory not found: ${dirConfig.path}`);
        return;
    }

    console.log(`\n=== Processing ${dirConfig.path} (${dirConfig.locale.toUpperCase()}) ===`);

    const files = fs.readdirSync(fullPath)
        .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'))
        .sort();

    console.log(`Found ${files.length} company pages`);

    files.forEach(file => {
        processFile(path.join(fullPath, file), dirConfig.locale);
    });
}

// Main execution
console.log('===========================================');
console.log('  Fixing Video Lightbox - Text Link Only');
console.log('===========================================');

directories.forEach(processDirectory);

console.log('\n===========================================');
console.log('  SUMMARY');
console.log('===========================================');
console.log(`Total processed: ${totalProcessed}`);
console.log(`Updated:         ${totalUpdated}`);
console.log(`Skipped:         ${totalSkipped}`);
console.log(`Errors:          ${totalErrors}`);
console.log('===========================================');
