#!/usr/bin/env node

/**
 * Internal Link Audit Script
 *
 * Scans all HTML files in web/, web-es/, web-pt/, web-de/ directories
 * and validates that all internal links point to existing files.
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
};

// Directories to audit
const LOCALES = {
  'EN': 'web',
  'ES': 'web-es',
  'PT': 'web-pt',
  'DE': 'web-de'
};

// Base path
const BASE_PATH = path.join(__dirname, '..');

// Results storage
const results = {
  totalFiles: 0,
  totalLinks: 0,
  validLinks: 0,
  brokenLinks: [],
  externalLinks: 0,
  anchorLinks: 0,
  skippedLinks: 0
};

/**
 * Get all HTML files recursively from a directory
 */
function getHtmlFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, assets, etc.
      if (!['node_modules', '.git', 'assets', 'css', 'js', 'images'].includes(entry.name)) {
        files.push(...getHtmlFiles(fullPath));
      }
    } else if (entry.name.endsWith('.html')) {
      // Skip backup and test files
      const skipPatterns = ['-back.html', '-backup.html', '-old.html', '-copy.html', '.bak.html', '-test.html'];
      const isBackup = skipPatterns.some(pattern => entry.name.includes(pattern));
      if (!isBackup) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Extract all href links from HTML content
 */
function extractLinks(content) {
  const links = [];
  // Match href attributes, handling various quote styles
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
}

/**
 * Validate if a link points to an existing file
 */
function validateLink(link, sourceFile, webRoot) {
  // Skip external links
  if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('//')) {
    results.externalLinks++;
    return { valid: true, type: 'external' };
  }

  // Skip mailto and tel links
  if (link.startsWith('mailto:') || link.startsWith('tel:')) {
    results.skippedLinks++;
    return { valid: true, type: 'skipped' };
  }

  // Skip javascript links
  if (link.startsWith('javascript:')) {
    results.skippedLinks++;
    return { valid: true, type: 'skipped' };
  }

  // Skip data URIs
  if (link.startsWith('data:')) {
    results.skippedLinks++;
    return { valid: true, type: 'skipped' };
  }

  // Handle anchor-only links
  if (link.startsWith('#')) {
    results.anchorLinks++;
    return { valid: true, type: 'anchor' };
  }

  // Remove anchor from link for file check
  let cleanLink = link.split('#')[0];

  // Remove query string
  cleanLink = cleanLink.split('?')[0];

  // Skip empty links after cleaning
  if (!cleanLink || cleanLink === '') {
    results.anchorLinks++;
    return { valid: true, type: 'anchor' };
  }

  // Resolve the path
  let targetPath;

  if (cleanLink.startsWith('/')) {
    // Absolute path from web root
    targetPath = path.join(webRoot, cleanLink);
  } else {
    // Relative path from source file
    const sourceDir = path.dirname(sourceFile);
    targetPath = path.join(sourceDir, cleanLink);
  }

  // Normalize the path
  targetPath = path.normalize(targetPath);

  // Check if file exists
  if (fs.existsSync(targetPath)) {
    return { valid: true, type: 'internal' };
  }

  // Check if it's a directory with index.html
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    if (fs.existsSync(path.join(targetPath, 'index.html'))) {
      return { valid: true, type: 'internal' };
    }
  }

  // Check for trailing slash directory
  if (cleanLink.endsWith('/')) {
    const indexPath = path.join(targetPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return { valid: true, type: 'internal' };
    }
  }

  return { valid: false, type: 'broken', targetPath };
}

/**
 * Audit a single HTML file
 */
function auditFile(filePath, webRoot, locale) {
  const content = fs.readFileSync(filePath, 'utf8');
  const links = extractLinks(content);
  const relativePath = path.relative(BASE_PATH, filePath);

  for (const link of links) {
    results.totalLinks++;

    const validation = validateLink(link, filePath, webRoot);

    if (validation.valid) {
      if (validation.type === 'internal') {
        results.validLinks++;
      }
    } else {
      results.brokenLinks.push({
        locale,
        sourceFile: relativePath,
        link,
        expectedPath: path.relative(BASE_PATH, validation.targetPath)
      });
    }
  }
}

/**
 * Audit all files in a locale directory
 */
function auditLocale(locale, dirName) {
  const webRoot = path.join(BASE_PATH, dirName);

  if (!fs.existsSync(webRoot)) {
    console.log(`${colors.yellow}  Skipping ${locale}${colors.reset} - directory not found: ${dirName}`);
    return;
  }

  console.log(`${colors.cyan}Auditing ${locale}${colors.reset} (${dirName})...`);

  const htmlFiles = getHtmlFiles(webRoot);
  results.totalFiles += htmlFiles.length;

  console.log(`  Found ${htmlFiles.length} HTML files`);

  for (const file of htmlFiles) {
    auditFile(file, webRoot, locale);
  }
}

/**
 * Print the audit report
 */
function printReport() {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.cyan}INTERNAL LINK AUDIT REPORT${colors.reset}`);
  console.log('='.repeat(70));

  console.log(`\n${colors.green}Summary:${colors.reset}`);
  console.log(`  Total HTML files scanned: ${results.totalFiles}`);
  console.log(`  Total links found:        ${results.totalLinks}`);
  console.log(`  Valid internal links:     ${results.validLinks}`);
  console.log(`  External links:           ${results.externalLinks}`);
  console.log(`  Anchor links:             ${results.anchorLinks}`);
  console.log(`  Skipped (mailto/tel/js):  ${results.skippedLinks}`);
  console.log(`  ${colors.red}Broken links:             ${results.brokenLinks.length}${colors.reset}`);

  if (results.brokenLinks.length > 0) {
    console.log(`\n${colors.red}Broken Links Details:${colors.reset}`);
    console.log('-'.repeat(70));

    // Group by locale
    const byLocale = {};
    for (const broken of results.brokenLinks) {
      if (!byLocale[broken.locale]) {
        byLocale[broken.locale] = [];
      }
      byLocale[broken.locale].push(broken);
    }

    for (const [locale, links] of Object.entries(byLocale)) {
      console.log(`\n${colors.yellow}[${locale}] ${links.length} broken link(s):${colors.reset}`);

      for (const broken of links) {
        console.log(`  ${colors.dim}File:${colors.reset} ${broken.sourceFile}`);
        console.log(`  ${colors.dim}Link:${colors.reset} ${colors.red}${broken.link}${colors.reset}`);
        console.log(`  ${colors.dim}Expected:${colors.reset} ${broken.expectedPath}`);
        console.log('');
      }
    }
  } else {
    console.log(`\n${colors.green}All internal links are valid!${colors.reset}`);
  }

  console.log('='.repeat(70) + '\n');
}

// Main execution
console.log('\n' + '='.repeat(70));
console.log('Internal Link Audit - Team Build Pro Websites');
console.log('='.repeat(70) + '\n');

for (const [locale, dirName] of Object.entries(LOCALES)) {
  auditLocale(locale, dirName);
}

printReport();

// Exit with error code if broken links found
if (results.brokenLinks.length > 0) {
  process.exit(1);
}
