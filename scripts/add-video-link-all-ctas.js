#!/usr/bin/env node
/**
 * Add Video Link to ALL CTAs on Company Pages
 *
 * This script adds the "Watch 60-Second Video" link to every CTA section
 * that has the trial text but doesn't already have the link.
 *
 * Usage: node scripts/add-video-link-all-ctas.js
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

// Localized trial text patterns (more flexible regex)
const trialPatterns = {
    en: 'Free 30-day trial [^<]+Cancel anytime',
    es: 'Prueba gratis 30 d[ií]as [^<]+Cancela cuando quieras',
    pt: 'Teste gr[aá]tis[^<]+Cancele quando quiser',
    de: '30 Tage kostenlos testen [^<]+Jederzeit k[uü]ndbar'
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
let totalLinksAdded = 0;

function processFile(filePath, locale) {
    totalProcessed++;

    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const text = linkText[locale];
        const trialText = trialPatterns[locale];
        let linksAdded = 0;

        // Pattern 1: Gradient background CTAs (rgba white text)
        // Matches: <div style="font-size: 0.875rem; color: rgba(255,255,255,0.9)...">trial text</div></section>
        const gradientCtaPattern = new RegExp(
            `(<div style="font-size: 0\\.875rem; color: rgba\\(255,255,255,0\\.9\\)[^"]*">\\s*${trialText}\\s*<\\/div>)(\\s*<\\/section>)`,
            'g'
        );

        content = content.replace(gradientCtaPattern, (match, trialDiv, closingSection) => {
            if (match.includes('video-text-link')) return match;
            linksAdded++;
            const videoLink = `\n        <a href="#" class="video-text-link" style="display: block; margin-top: 1rem; color: rgba(255,255,255,0.85); font-size: 0.875rem; text-decoration: underline; cursor: pointer;">${text}</a>`;
            return trialDiv + videoLink + closingSection;
        });

        // Pattern 2: Card section CTAs (gray text #64748b)
        // Matches: <div style="font-size: 0.875rem; color: #64748b...">trial text</div></div></section>
        const cardCtaPattern = new RegExp(
            `(<div style="font-size: 0\\.875rem; color: #64748b[^"]*">\\s*${trialText}\\s*<\\/div>)(\\s*<\\/div>\\s*<\\/section>)`,
            'g'
        );

        content = content.replace(cardCtaPattern, (match, trialDiv, closingDivs) => {
            if (match.includes('video-text-link')) return match;
            linksAdded++;
            const videoLink = `\n          <a href="#" class="video-text-link" style="display: block; margin-top: 1rem; color: #667eea; font-size: 0.875rem; text-decoration: underline; cursor: pointer;">${text}</a>`;
            return trialDiv + videoLink + closingDivs;
        });

        if (linksAdded > 0) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`  OK (+${linksAdded} links): ${path.basename(filePath)}`);
            totalUpdated++;
            totalLinksAdded += linksAdded;
        } else {
            console.log(`  SKIP (no new CTAs): ${path.basename(filePath)}`);
            totalSkipped++;
        }

    } catch (err) {
        console.error(`  ERROR: ${path.basename(filePath)} - ${err.message}`);
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
console.log('==============================================');
console.log('  Adding Video Link to ALL CTAs');
console.log('==============================================');

directories.forEach(processDirectory);

console.log('\n==============================================');
console.log('  SUMMARY');
console.log('==============================================');
console.log(`Total processed: ${totalProcessed}`);
console.log(`Files updated:   ${totalUpdated}`);
console.log(`Files skipped:   ${totalSkipped}`);
console.log(`Links added:     ${totalLinksAdded}`);
console.log('==============================================');
