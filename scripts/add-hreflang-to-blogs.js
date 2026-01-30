#!/usr/bin/env node

/**
 * Add hreflang tags to all blog posts across all languages
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

function getBlogPages() {
  const pagesByLang = {};
  const allPages = new Set();

  for (const lang of LANGUAGE_CONFIGS) {
    const blogDir = path.join(BASE_DIR, lang.dir, 'blog');
    if (fs.existsSync(blogDir)) {
      const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html'));
      pagesByLang[lang.code] = new Set(files);
      files.forEach(f => allPages.add(f));
    } else {
      pagesByLang[lang.code] = new Set();
    }
  }

  return { pagesByLang, allPages };
}

function generateHreflangTags(filename, pagesByLang) {
  const tags = [];

  for (const lang of LANGUAGE_CONFIGS) {
    if (pagesByLang[lang.code].has(filename)) {
      const url = `${lang.domain}/blog/${filename}`;
      tags.push(`  <link rel="alternate" hreflang="${lang.code}" href="${url}" />`);
    }
  }

  const enConfig = LANGUAGE_CONFIGS.find(l => l.code === 'en');
  if (pagesByLang['en'].has(filename)) {
    tags.push(`  <link rel="alternate" hreflang="x-default" href="${enConfig.domain}/blog/${filename}" />`);
  }

  return tags.join('\n');
}

function hasHreflangTags(content) {
  return content.includes('hreflang=');
}

function addHreflangToFile(filePath, hreflangTags) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (hasHreflangTags(content)) {
    return { status: 'skipped', reason: 'already has hreflang' };
  }

  const canonicalRegex = /(<link rel="canonical"[^>]*\/>)/;
  const match = content.match(canonicalRegex);

  if (!match) {
    return { status: 'error', reason: 'no canonical tag found' };
  }

  const newContent = content.replace(
    canonicalRegex,
    `$1\n\n  <!-- Hreflang tags for international SEO -->\n${hreflangTags}`
  );

  fs.writeFileSync(filePath, newContent, 'utf8');
  return { status: 'updated' };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Adding hreflang tags to blog posts...\n');
  if (dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  const { pagesByLang, allPages } = getBlogPages();

  console.log('Blog posts found:');
  for (const lang of LANGUAGE_CONFIGS) {
    console.log(`  ${lang.code}: ${pagesByLang[lang.code].size} posts`);
  }
  console.log(`  Total unique: ${allPages.size} posts\n`);

  const stats = { updated: 0, skipped: 0, errors: 0 };

  for (const lang of LANGUAGE_CONFIGS) {
    const blogDir = path.join(BASE_DIR, lang.dir, 'blog');
    if (!fs.existsSync(blogDir)) continue;

    console.log(`\nProcessing ${lang.code.toUpperCase()} (${lang.dir}/blog/)...`);

    for (const filename of pagesByLang[lang.code]) {
      const filePath = path.join(blogDir, filename);
      const hreflangTags = generateHreflangTags(filename, pagesByLang);

      if (dryRun) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (hasHreflangTags(content)) {
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
  console.log(`Skipped (already had hreflang): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main();
