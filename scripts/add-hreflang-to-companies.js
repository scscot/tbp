#!/usr/bin/env node

/**
 * Add hreflang tags to all company pages across all languages
 * This fixes the SEO issue where Google de-indexes Spanish pages as duplicates
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');

const LANGUAGE_CONFIGS = [
  { code: 'en', dir: 'web', domain: 'https://teambuildpro.com' },
  { code: 'es', dir: 'web-es', domain: 'https://es.teambuildpro.com' },
  { code: 'pt', dir: 'web-pt', domain: 'https://pt.teambuildpro.com' },
  { code: 'de', dir: 'web-de', domain: 'https://de.teambuildpro.com' },
];

// Get all company page filenames for each language
function getCompanyPages() {
  const pagesByLang = {};
  const allPages = new Set();

  for (const lang of LANGUAGE_CONFIGS) {
    const companiesDir = path.join(BASE_DIR, lang.dir, 'companies');
    if (fs.existsSync(companiesDir)) {
      const files = fs.readdirSync(companiesDir).filter(f => f.endsWith('.html'));
      pagesByLang[lang.code] = new Set(files);
      files.forEach(f => allPages.add(f));
    } else {
      pagesByLang[lang.code] = new Set();
    }
  }

  return { pagesByLang, allPages };
}

// Generate hreflang tags for a specific company page
function generateHreflangTags(filename, pagesByLang) {
  const tags = [];

  for (const lang of LANGUAGE_CONFIGS) {
    if (pagesByLang[lang.code].has(filename)) {
      const url = `${lang.domain}/companies/${filename}`;
      tags.push(`  <link rel="alternate" hreflang="${lang.code}" href="${url}" />`);
    }
  }

  // Add x-default pointing to English version
  const enConfig = LANGUAGE_CONFIGS.find(l => l.code === 'en');
  if (pagesByLang['en'].has(filename)) {
    tags.push(`  <link rel="alternate" hreflang="x-default" href="${enConfig.domain}/companies/${filename}" />`);
  }

  return tags.join('\n');
}

// Check if file already has hreflang tags
function hasHreflangTags(content) {
  return content.includes('hreflang=');
}

// Add hreflang tags to a file
function addHreflangToFile(filePath, hreflangTags) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has hreflang
  if (hasHreflangTags(content)) {
    return { status: 'skipped', reason: 'already has hreflang' };
  }

  // Find the canonical tag and insert hreflang tags after it
  const canonicalRegex = /(<link rel="canonical"[^>]*\/>)/;
  const match = content.match(canonicalRegex);

  if (!match) {
    return { status: 'error', reason: 'no canonical tag found' };
  }

  // Insert hreflang tags after canonical
  const newContent = content.replace(
    canonicalRegex,
    `$1\n\n  <!-- Hreflang tags for international SEO -->\n${hreflangTags}`
  );

  fs.writeFileSync(filePath, newContent, 'utf8');
  return { status: 'updated' };
}

// Main function
function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Adding hreflang tags to company pages...\n');
  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  const { pagesByLang, allPages } = getCompanyPages();

  console.log('Company pages found:');
  for (const lang of LANGUAGE_CONFIGS) {
    console.log(`  ${lang.code}: ${pagesByLang[lang.code].size} pages`);
  }
  console.log(`  Total unique: ${allPages.size} pages\n`);

  const stats = {
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  // Process each language directory
  for (const lang of LANGUAGE_CONFIGS) {
    const companiesDir = path.join(BASE_DIR, lang.dir, 'companies');
    if (!fs.existsSync(companiesDir)) continue;

    console.log(`\nProcessing ${lang.code.toUpperCase()} (${lang.dir}/companies/)...`);

    for (const filename of pagesByLang[lang.code]) {
      const filePath = path.join(companiesDir, filename);
      const hreflangTags = generateHreflangTags(filename, pagesByLang);

      if (dryRun) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (hasHreflangTags(content)) {
          console.log(`  [SKIP] ${filename} - already has hreflang`);
          stats.skipped++;
        } else {
          console.log(`  [WOULD UPDATE] ${filename}`);
          stats.updated++;
        }
      } else {
        const result = addHreflangToFile(filePath, hreflangTags);
        if (result.status === 'updated') {
          console.log(`  [UPDATED] ${filename}`);
          stats.updated++;
        } else if (result.status === 'skipped') {
          console.log(`  [SKIP] ${filename} - ${result.reason}`);
          stats.skipped++;
        } else {
          console.log(`  [ERROR] ${filename} - ${result.reason}`);
          stats.errors++;
        }
      }
    }
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);

  if (dryRun) {
    console.log('\nRun without --dry-run to apply changes.');
  } else {
    console.log('\nDone! Deploy with: firebase deploy --only hosting');
  }
}

main();
