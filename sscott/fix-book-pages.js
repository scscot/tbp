import fs from 'fs';
import path from 'path';

const BOOKS_DIR = './public/books';
const IMAGES_DIR = './public/assets/images/books';

const scrapeResults = JSON.parse(fs.readFileSync('./public/assets/images/books/scrape-results.json', 'utf8'));

const imageMapping = {};
scrapeResults.forEach(result => {
  if (result.status === 'success') {
    imageMapping[result.name] = result.localFile;
  }
});

function fixLineBreaks(content) {
  return content.replace(/\\n/g, '\n');
}

function verifyImageExists(imagePath) {
  const fullPath = path.join('./public', imagePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const stats = fs.statSync(fullPath);
  return stats.size > 1000;
}

function processBookPage(filePath) {
  console.log(`\nProcessing: ${path.basename(filePath)}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const imageMatches = content.match(/<img\s+src="([^"]+)"/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const srcMatch = match.match(/src="([^"]+)"/);
      if (srcMatch) {
        const imagePath = srcMatch[1];
        if (!verifyImageExists(imagePath)) {
          console.log(`  ⚠️  Invalid or missing image: ${imagePath}`);
        }
      }
    });
  }

  if (content.includes('\\n')) {
    console.log(`  Fixing \\n line breaks...`);
    content = fixLineBreaks(content);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Updated`);
  } else {
    console.log(`  ✓ No changes needed`);
  }
}

const bookFiles = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(BOOKS_DIR, f));

console.log(`Found ${bookFiles.length} book pages\n`);
console.log('='.repeat(60));

bookFiles.forEach(processBookPage);

console.log('\n' + '='.repeat(60));
console.log('Done!');
