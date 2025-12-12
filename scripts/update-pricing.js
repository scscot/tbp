#!/usr/bin/env node
/**
 * Update Subscription Pricing: $4.99 → $6.99
 *
 * Updates all pricing references across EN, ES, PT, and DE websites.
 * Handles different price formats per locale.
 *
 * Usage: node scripts/update-pricing.js
 */

const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..');

// Stats tracking
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  totalReplacements: 0,
  byLocale: {}
};

// Replacement patterns by locale
const patterns = {
  en: [
    { find: '$4.99/month', replace: '$6.99/month' },
    { find: '$4.99/mo', replace: '$6.99/mo' },
    { find: '$4.99 (', replace: '$6.99 (' },
  ],
  es: [
    { find: '$4.99/mes', replace: '$6.99/mes' },
    { find: '$4.99 (', replace: '$6.99 (' },
  ],
  pt: [
    { find: '$4.99/mês', replace: '$6.99/mês' },
    { find: '$4,99', replace: '$6,99' },
    { find: 'R$24,99', replace: 'R$34,99' },
    { find: '$49.99', replace: '$69.99' },
  ],
  de: [
    { find: '4,99$/Monat', replace: '6,99$/Monat' },
    { find: '4,99 $/Monat', replace: '6,99 $/Monat' },
    { find: '$4.99/Monat', replace: '$6.99/Monat' },
    { find: '4,99€/Monat', replace: '6,99€/Monat' },
    { find: '4,99$', replace: '6,99$' },
    { find: '4,99 $', replace: '6,99 $' },
  ]
};

// Directory mapping
const directories = {
  en: 'web',
  es: 'web-es',
  pt: 'web-pt',
  de: 'web-de'
};

/**
 * Process a single file with locale-specific patterns
 */
function processFile(filePath, locale) {
  const localePatterns = patterns[locale];
  if (!localePatterns) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let fileReplacements = 0;

  for (const pattern of localePatterns) {
    const regex = new RegExp(escapeRegExp(pattern.find), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, pattern.replace);
      fileReplacements += matches.length;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesModified++;
    stats.totalReplacements += fileReplacements;
    stats.byLocale[locale] = (stats.byLocale[locale] || 0) + fileReplacements;
    console.log(`  ✓ ${path.relative(basePath, filePath)} (${fileReplacements} replacements)`);
  }

  stats.filesProcessed++;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Process all HTML files in a directory recursively
 */
function processDirectory(dirPath, locale) {
  if (!fs.existsSync(dirPath)) {
    console.log(`  Directory not found: ${dirPath}`);
    return;
  }

  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      // Skip certain directories
      if (item.name === 'node_modules' || item.name === 'assets') continue;
      processDirectory(fullPath, locale);
    } else if (item.name.endsWith('.html')) {
      processFile(fullPath, locale);
    }
  }
}

// Main execution
console.log('=============================================');
console.log('  Updating Subscription Pricing: $4.99 → $6.99');
console.log('=============================================\n');

for (const [locale, dir] of Object.entries(directories)) {
  console.log(`\n=== Processing ${locale.toUpperCase()} (${dir}/) ===`);
  const dirPath = path.join(basePath, dir);
  processDirectory(dirPath, locale);
}

console.log('\n=============================================');
console.log('  SUMMARY');
console.log('=============================================');
console.log(`Files processed:  ${stats.filesProcessed}`);
console.log(`Files modified:   ${stats.filesModified}`);
console.log(`Total replacements: ${stats.totalReplacements}`);
console.log('\nBy locale:');
for (const [locale, count] of Object.entries(stats.byLocale)) {
  console.log(`  ${locale.toUpperCase()}: ${count} replacements`);
}
console.log('=============================================');
