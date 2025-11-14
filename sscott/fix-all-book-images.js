import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BOOKS_DIR = path.join(__dirname, 'public/books');

const imageReplacements = {
  '/assets/images/books/mlm-cover-hi.png': '/assets/images/books/mlm-cover-hindi.jpg',
  '/assets/images/books/ai-gateway.png': '/assets/images/books/ai-your-gateway-to-a-better-life.jpg',
  '/assets/images/books/mlm-cover-jp.png': '/assets/images/books/ai.jpg',
  '/assets/images/books/breaking-through.jpg': '/assets/images/books/breaking-through-overcoming-deep-seated-barriers-to-achieve-authentic-success.jpg',
  '/assets/images/books/mlm-cover-es.jpg': '/assets/images/books/c-mo-hacer-crecer-tu-negocio-de-marketing-en-red-utilizando-inteligencia-artificial.jpg',
  '/assets/images/books/mlm-cover-br.png': '/assets/images/books/como-expandir-seu-neg-cio-de-marketing-de-rede-usando-intelig-ncia-artificial-ia.jpg',
  '/assets/images/books/divine-conversations.jpg': '/assets/images/books/divine-conversations-six-spiritual-leaders-and-everyday-voices-on-global-challenges.jpg',
  '/assets/images/books/mlm-cover-us-2.jpg': '/assets/images/books/how-to-grow-your-network-marketing-business-using-artificial-intelligence-ai.jpg',
  '/assets/images/books/mlm-cover-us.png': '/assets/images/books/how-to-grow-your-network-marketing-business-using-artificial-intelligence-ai.jpg',
  '/assets/images/books/beginners-guide-ai.png': '/assets/images/books/the-2024-2025-beginner-s-guide-to-ai-in-affiliate-network-marketing.jpg',
  '/assets/images/books/fear-and-uncertainty.png': '/assets/images/books/the-art-of-mastering-fear-and-uncertainty.jpg',
  '/assets/images/books/thrive-within.jpg': '/assets/images/books/thrive-within-the-journey-to-overcome-obstacles-and-experience-lasting-fulfillment.jpg',
  '/assets/images/books/mlm-cover-de.jpg': '/assets/images/books/wie-sie-ihr-network-marketing-business-mit-ki-ausbauen-k-nnen.jpg'
};

function fixBookPageImages(filePath) {
  const fileName = path.basename(filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [oldPath, newPath] of Object.entries(imageReplacements)) {
    if (content.includes(oldPath)) {
      console.log(`  Replacing: ${oldPath} → ${path.basename(newPath)}`);
      content = content.replaceAll(oldPath, newPath);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

const bookFiles = fs.readdirSync(BOOKS_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(BOOKS_DIR, f));

console.log('Fixing book page images...\n');
console.log('='.repeat(80));

let updatedCount = 0;

bookFiles.forEach(file => {
  const fileName = path.basename(file);
  console.log(`\n${fileName}:`);

  if (fixBookPageImages(file)) {
    console.log(`  ✓ Updated`);
    updatedCount++;
  } else {
    console.log(`  ✓ No changes needed`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\nUpdated ${updatedCount} of ${bookFiles.length} book pages`);
