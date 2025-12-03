#!/usr/bin/env node
/**
 * Add referral-tracking.js script to all blog and company pages
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_TAG = '<script src="/js/referral-tracking.js"></script>';

const patterns = [
  { dir: 'web/blog', desc: 'EN blog' },
  { dir: 'web/companies', desc: 'EN companies' },
  { dir: 'web-es/blog', desc: 'ES blog' },
  { dir: 'web-es/companies', desc: 'ES companies' },
  { dir: 'web-pt/blog', desc: 'PT blog' },
  { dir: 'web-pt/companies', desc: 'PT companies' },
  { dir: 'web-de/blog', desc: 'DE blog' },
  { dir: 'web-de/companies', desc: 'DE companies' },
];

const basePath = path.join(__dirname, '..');

let totalUpdated = 0;
let totalSkipped = 0;

patterns.forEach(({ dir, desc }) => {
  const fullPath = path.join(basePath, dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.html'));
  let updated = 0;
  let skipped = 0;

  files.forEach(file => {
    const filePath = path.join(fullPath, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('referral-tracking.js')) {
      skipped++;
      return;
    }

    // Insert script tag before </body>
    const newContent = content.replace('</body>', `${SCRIPT_TAG}\n</body>`);

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      updated++;
    }
  });

  console.log(`${desc}: ${updated} updated, ${skipped} skipped (already has script)`);
  totalUpdated += updated;
  totalSkipped += skipped;
});

console.log(`\nTotal: ${totalUpdated} files updated, ${totalSkipped} already had script`);
