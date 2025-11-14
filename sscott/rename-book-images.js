import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGES_DIR = path.join(__dirname, 'public/assets/images/books');
const PUBLIC_DIR = path.join(__dirname, 'public');

const renameMap = {
  'how-to-grow-your-network-marketing-business-using-artificial-intelligence-ai.jpg': 'mlm-ai-guide.jpg',
  'stop-sabotaging-your-best-life-the-art-of-mastering-fear-and-uncertainty.jpg': 'stop-sabotaging-your-life.jpg',
  'breaking-through-overcoming-deep-seated-barriers-to-achieve-authentic-success.jpg': 'breaking-through-barriers.jpg',
  'divine-conversations-six-spiritual-leaders-and-everyday-voices-on-global-challenges.jpg': 'divine-conversations.jpg',
  'thrive-within-the-journey-to-overcome-obstacles-and-experience-lasting-fulfillment.jpg': 'thrive-within.jpg',
  'the-2024-2025-beginner-s-guide-to-ai-in-affiliate-network-marketing.jpg': 'beginners-ai-mlm-guide-2024.jpg',
  'the-art-of-mastering-fear-and-uncertainty.jpg': 'mastering-fear-uncertainty.jpg',
  'como-expandir-seu-neg-cio-de-marketing-de-rede-usando-intelig-ncia-artificial-ia.jpg': 'mlm-ia-guia-pt.jpg',
  'c-mo-hacer-crecer-tu-negocio-de-marketing-en-red-utilizando-inteligencia-artificial.jpg': 'mlm-ia-guia-es.jpg',
  'wie-sie-ihr-network-marketing-business-mit-ki-ausbauen-k-nnen.jpg': 'mlm-ki-guide-de.jpg',
  'ai-your-gateway-to-a-better-life.jpg': 'ai-gateway-better-life.jpg',
  'ai.jpg': 'mlm-business-ai-jp.jpg'
};

function renameImageFiles() {
  console.log('Step 1: Renaming image files...\n');
  console.log('='.repeat(80));

  let renamedCount = 0;

  for (const [oldName, newName] of Object.entries(renameMap)) {
    const oldPath = path.join(IMAGES_DIR, oldName);
    const newPath = path.join(IMAGES_DIR, newName);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`✓ Renamed: ${oldName}`);
      console.log(`       to: ${newName}`);
      renamedCount++;
    } else {
      console.log(`⚠ File not found: ${oldName}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Renamed ${renamedCount} of ${Object.keys(renameMap).length} files\n`);
}

function updateHtmlFiles() {
  console.log('Step 2: Updating HTML file references...\n');
  console.log('='.repeat(80));

  const htmlFiles = [];

  function findHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !filePath.includes('node_modules')) {
        findHtmlFiles(filePath);
      } else if (file.endsWith('.html')) {
        htmlFiles.push(filePath);
      }
    });
  }

  findHtmlFiles(PUBLIC_DIR);

  let updatedFilesCount = 0;

  htmlFiles.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const [oldName, newName] of Object.entries(renameMap)) {
      const oldPath = `/assets/images/books/${oldName}`;
      const newPath = `/assets/images/books/${newName}`;

      if (content.includes(oldPath)) {
        content = content.replaceAll(oldPath, newPath);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated: ${path.relative(PUBLIC_DIR, filePath)}`);
      updatedFilesCount++;
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log(`Updated ${updatedFilesCount} of ${htmlFiles.length} HTML files\n`);
}

function updateScrapeResults() {
  console.log('Step 3: Updating scrape-results.json...\n');
  console.log('='.repeat(80));

  const resultsPath = path.join(IMAGES_DIR, 'scrape-results.json');

  if (!fs.existsSync(resultsPath)) {
    console.log('⚠ scrape-results.json not found, skipping\n');
    return;
  }

  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  let updatedCount = 0;

  results.forEach(result => {
    if (result.localFile && renameMap[result.localFile]) {
      console.log(`✓ Updating: ${result.name}`);
      console.log(`  ${result.localFile} → ${renameMap[result.localFile]}`);
      result.localFile = renameMap[result.localFile];
      updatedCount++;
    }
  });

  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(`Updated ${updatedCount} entries in scrape-results.json\n`);
}

function verifyImages() {
  console.log('Step 4: Verifying all renamed images exist...\n');
  console.log('='.repeat(80));

  let allValid = true;

  for (const newName of Object.values(renameMap)) {
    const filePath = path.join(IMAGES_DIR, newName);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✓ ${newName} (${Math.round(stats.size / 1024)}KB)`);
    } else {
      console.log(`✗ ${newName} - FILE NOT FOUND`);
      allValid = false;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (allValid) {
    console.log('✓ All images verified successfully!\n');
  } else {
    console.log('⚠ Some images are missing!\n');
  }
}

console.log('\n📸 Book Cover Image Rename Script\n');
console.log('='.repeat(80));
console.log(`Renaming ${Object.keys(renameMap).length} book cover images for better SEO\n`);

renameImageFiles();
updateHtmlFiles();
updateScrapeResults();
verifyImages();

console.log('='.repeat(80));
console.log('✅ Done!\n');
