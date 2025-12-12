#!/usr/bin/env node
/**
 * Add Video Lightbox to Company Pages
 *
 * This script adds:
 * 1. Video thumbnail to the bottom CTA section
 * 2. Lightbox HTML before closing </body> tag
 *
 * Usage: node scripts/add-video-lightbox.js
 */

const fs = require('fs');
const path = require('path');

// Localized captions
const captions = {
    en: 'Watch 60-second explainer',
    es: 'Ver explicación de 60 segundos',
    pt: 'Assista explicação de 60 segundos',
    de: '60-Sekunden-Erklärung ansehen'
};

// Directory mappings
const directories = [
    { path: 'web/companies', locale: 'en' },
    { path: 'web-es/companies', locale: 'es' },
    { path: 'web-pt/companies', locale: 'pt' },
    { path: 'web-de/companies', locale: 'de' }
];

// Video thumbnail HTML to insert in CTA section
function getVideoThumbnailHTML(locale) {
    const caption = captions[locale];
    return `
      <!-- Video Thumbnail -->
      <div class="video-thumbnail" aria-label="${caption}">
        <img src="/assets/videos/Thumbnail.png" alt="Team Build Pro Demo Video">
        <div class="play-icon"></div>
      </div>
      <p style="font-size: 0.875rem; color: rgba(255,255,255,0.8); margin-top: 0.5rem; margin-bottom: 1.5rem;">${caption}</p>
`;
}

// Lightbox HTML to insert before </body>
const lightboxHTML = `
  <!-- Video Lightbox -->
  <div id="video-lightbox" class="video-lightbox">
    <div class="video-lightbox-content">
      <button class="video-lightbox-close" aria-label="Close video">&times;</button>
      <video controls poster="/assets/videos/Thumbnail.png">
        <source src="/assets/videos/TBP_Professionals.mp4" type="video/mp4">
      </video>
    </div>
  </div>
`;

let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let totalErrors = 0;

function processFile(filePath, locale) {
    totalProcessed++;

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // Check if lightbox already exists
        if (content.includes('id="video-lightbox"')) {
            console.log(`  SKIP (already has lightbox): ${path.basename(filePath)}`);
            totalSkipped++;
            return;
        }

        // Find the bottom CTA section and add video thumbnail
        // Pattern: <section class="cta-section gradient-bg">...<a href="/" class="cta-button">
        const ctaPattern = /(<section class="cta-section gradient-bg">\s*<div class="container">\s*<h2>[^<]+<\/h2>\s*<p>[^<]+<\/p>\s*)/;

        if (!ctaPattern.test(content)) {
            console.log(`  WARN (CTA pattern not found): ${path.basename(filePath)}`);
            totalErrors++;
            return;
        }

        // Insert video thumbnail before the CTA button
        const thumbnailHTML = getVideoThumbnailHTML(locale);
        content = content.replace(ctaPattern, `$1${thumbnailHTML}`);

        // Insert lightbox HTML before </body>
        if (!content.includes('</body>')) {
            console.log(`  WARN (no </body> tag): ${path.basename(filePath)}`);
            totalErrors++;
            return;
        }

        content = content.replace('</body>', `${lightboxHTML}</body>`);

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  OK: ${path.basename(filePath)}`);
        totalUpdated++;

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
console.log('  Adding Video Lightbox to Company Pages');
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
