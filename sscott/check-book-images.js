import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BOOKS_DIR = path.join(__dirname, 'public/books');
const IMAGES_DIR = path.join(__dirname, 'public/assets/images/books');

function checkImageFile(imagePath) {
  const fullPath = path.join(__dirname, 'public', imagePath);

  if (!fs.existsSync(fullPath)) {
    return { valid: false, reason: 'File does not exist' };
  }

  const stats = fs.statSync(fullPath);

  if (stats.size < 1000) {
    return { valid: false, reason: `File too small (${stats.size} bytes)` };
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('<!doctype html>') || content.includes('<html>')) {
    return { valid: false, reason: 'File contains HTML (corrupted)' };
  }

  return { valid: true, size: stats.size };
}

function processBookPage(filePath) {
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  const imageMatches = [...content.matchAll(/<img\s+src="([^"]+)"/g)];
  const ogImageMatch = content.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  const twitterImageMatch = content.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/);
  const schemaImageMatch = content.match(/"image":\s*"([^"]+)"/);

  const allImages = new Set();
  imageMatches.forEach(match => allImages.add(match[1]));
  if (ogImageMatch) allImages.add(ogImageMatch[1]);
  if (twitterImageMatch) allImages.add(twitterImageMatch[1]);
  if (schemaImageMatch) allImages.add(schemaImageMatch[1]);

  const issues = [];

  allImages.forEach(imagePath => {
    const check = checkImageFile(imagePath);
    if (!check.valid) {
      issues.push({ imagePath, reason: check.reason });
    }
  });

  return { fileName, images: Array.from(allImages), issues };
}

const bookFiles = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(BOOKS_DIR, f));

console.log('Checking book page images...\n');
console.log('='.repeat(80));

let totalIssues = 0;

bookFiles.forEach(file => {
  const result = processBookPage(file);

  if (result.issues.length > 0) {
    console.log(`\n${result.fileName}:`);
    result.issues.forEach(issue => {
      console.log(`  ✗ ${issue.imagePath}`);
      console.log(`    Reason: ${issue.reason}`);
    });
    totalIssues += result.issues.length;
  }
});

if (totalIssues === 0) {
  console.log('\n✓ All book page images are valid!');
} else {
  console.log(`\n\nTotal issues found: ${totalIssues}`);
}

console.log('\n' + '='.repeat(80));
