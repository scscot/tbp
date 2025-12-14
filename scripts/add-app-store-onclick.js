#!/usr/bin/env node

/**
 * Add onclick handler to App Store CTAs in blog and company pages
 *
 * This script adds onclick="openAppOrStore('ios'); return false;" to all
 * App Store links that don't already have it, ensuring sponsor tracking
 * is preserved via Universal Link fallback.
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Directories to process
const DIRECTORIES = [
  'web/blog',
  'web/companies',
  'web-es/blog',
  'web-es/companies',
  'web-pt/blog',
  'web-pt/companies',
  'web-de/blog',
  'web-de/companies'
];

// Stats
let filesProcessed = 0;
let filesModified = 0;
let linksUpdated = 0;

/**
 * Process a single HTML file
 */
function processFile(filePath) {
  if (!filePath.endsWith('.html')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // Pattern 1: Blog-style App Store links
  // <a href="https://apps.apple.com/app/team-build-pro/id6751211622" class="store-badge">
  const blogPattern = /<a\s+href="(https:\/\/apps\.apple\.com\/[^"]+)"(\s+class="store-badge")>/g;

  // Pattern 2: Company-style App Store links
  // <a href="https://apps.apple.com/us/app/id6751211622" class="app-store-badge" style="...">
  const companyPattern = /<a\s+href="(https:\/\/apps\.apple\.com\/[^"]+)"(\s+class="app-store-badge"[^>]*)>/g;

  // Pattern 3: Any other App Store link without onclick
  const genericPattern = /<a\s+href="(https:\/\/apps\.apple\.com\/[^"]+)"([^>]*)(?<!onclick="[^"]*")>/g;

  let localUpdates = 0;

  // Replace blog-style links
  content = content.replace(blogPattern, (match, url, classAttr) => {
    if (match.includes('onclick=')) return match; // Skip if already has onclick
    localUpdates++;
    return `<a href="${url}" onclick="openAppOrStore('ios'); return false;"${classAttr}>`;
  });

  // Replace company-style links
  content = content.replace(companyPattern, (match, url, rest) => {
    if (match.includes('onclick=')) return match; // Skip if already has onclick
    localUpdates++;
    return `<a href="${url}" onclick="openAppOrStore('ios'); return false;"${rest}>`;
  });

  filesProcessed++;

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    filesModified++;
    linksUpdated += localUpdates;
    console.log(`${colors.green}  Updated${colors.reset} ${filePath} (${localUpdates} links)`);
  }
}

/**
 * Process all files in a directory
 */
function processDirectory(dirPath) {
  const fullPath = path.join(__dirname, '..', dirPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`${colors.yellow}  Skipping${colors.reset} ${dirPath} (not found)`);
    return;
  }

  console.log(`${colors.cyan}Processing${colors.reset} ${dirPath}...`);

  const files = fs.readdirSync(fullPath);
  for (const file of files) {
    const filePath = path.join(fullPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && file.endsWith('.html')) {
      processFile(filePath);
    }
  }
}

// Main execution
console.log('\n' + '='.repeat(60));
console.log('App Store CTA onclick Handler Update');
console.log('='.repeat(60) + '\n');

for (const dir of DIRECTORIES) {
  processDirectory(dir);
}

console.log('\n' + '='.repeat(60));
console.log(`${colors.green}Summary${colors.reset}`);
console.log('='.repeat(60));
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files modified:  ${filesModified}`);
console.log(`Links updated:   ${linksUpdated}`);
console.log('='.repeat(60) + '\n');
