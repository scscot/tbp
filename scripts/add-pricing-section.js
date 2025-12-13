#!/usr/bin/env node
/**
 * Add pricing section to professionals.html and prospects.html across all locales
 * Pulls translated content from each locale's index.html
 */

const fs = require('fs');
const path = require('path');

const locales = ['web', 'web-es', 'web-pt', 'web-de'];
const pages = ['professionals.html', 'prospects.html'];

// Pricing CSS to add (same for all locales)
const pricingCSS = `
        /* Pricing Section */
        .section-pricing {
            padding: 4rem 0;
            background: #f8fafc;
        }

        .pricing-card {
            background: #ffffff;
            border-radius: 1rem;
            padding: 2rem;
            max-width: 400px;
            margin: 0 auto;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .pricing-card h3 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }

        .pricing-card .price {
            font-size: 2.5rem;
            font-weight: 900;
            color: #7c3aed;
            margin: 1rem 0;
        }

        .pricing-card .price span {
            font-size: 1rem;
            font-weight: 500;
            color: #64748b;
        }

        .pricing-card .trial {
            background: #ecfdf5;
            color: #059669;
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-weight: 600;
            font-size: 0.9rem;
            display: inline-block;
            margin-bottom: 1.5rem;
        }

        .pricing-card ul {
            list-style: none;
            padding: 0;
            margin: 0 0 1.5rem 0;
            text-align: left;
        }

        .pricing-card li {
            padding: 0.5rem 0;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .pricing-card li .material-symbols-outlined {
            color: #10b981;
            font-size: 1.25rem;
        }

`;

// Extract pricing HTML from index.html for each locale
function extractPricingHTML(indexContent) {
    const startMarker = '<!-- Section 4: Pricing -->';
    const endMarker = '<!-- Download Section -->';

    const startIdx = indexContent.indexOf(startMarker);
    const endIdx = indexContent.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
        console.error('Could not find pricing section markers');
        return null;
    }

    return indexContent.substring(startIdx, endIdx).trim() + '\n\n        ';
}

let totalUpdates = 0;

for (const locale of locales) {
    const basePath = path.join('/Users/sscott/tbp', locale);

    // Read index.html to get translated pricing HTML
    const indexPath = path.join(basePath, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const pricingHTML = extractPricingHTML(indexContent);

    if (!pricingHTML) {
        console.error(`Skipping ${locale} - could not extract pricing HTML`);
        continue;
    }

    for (const page of pages) {
        const filePath = path.join(basePath, page);

        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${filePath} - file does not exist`);
            continue;
        }

        let content = fs.readFileSync(filePath, 'utf8');

        // Check if pricing section already exists
        if (content.includes('.section-pricing')) {
            console.log(`Skipping ${locale}/${page} - pricing CSS already exists`);
            continue;
        }

        // Add pricing CSS before /* Download Section */
        const cssMarker = '/* Download Section */';
        if (content.includes(cssMarker)) {
            content = content.replace(cssMarker, pricingCSS + cssMarker);
        } else {
            console.error(`Could not find CSS marker in ${locale}/${page}`);
            continue;
        }

        // Add pricing HTML before <!-- Download Section -->
        const htmlMarker = '<!-- Download Section -->';
        if (content.includes(htmlMarker)) {
            content = content.replace(htmlMarker, pricingHTML + htmlMarker);
        } else {
            console.error(`Could not find HTML marker in ${locale}/${page}`);
            continue;
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${locale}/${page}`);
        totalUpdates++;
    }
}

console.log(`\nTotal files updated: ${totalUpdates}`);
