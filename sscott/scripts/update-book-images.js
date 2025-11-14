import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageMapping = {
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.png': '/assets/images/books/mlm-cover-us.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.jpg': '/assets/images/books/mlm-cover-us-2.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/12/AI-Your-Gateway-to-a-Bbetter-Life-Cover-v6.png': '/assets/images/books/ai-gateway.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Fear-and-Uncertainty.png': '/assets/images/books/fear-and-uncertainty.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-ES.jpg': '/assets/images/books/mlm-cover-es.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-BR-1.png': '/assets/images/books/mlm-cover-br.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-DE.jpg': '/assets/images/books/mlm-cover-de.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-JP.png': '/assets/images/books/mlm-cover-jp.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-HI.png': '/assets/images/books/mlm-cover-hi.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-Kindle-3D.png': '/assets/images/books/network-marketing-playbook.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Paperback-Cover-Image.png': '/assets/images/books/beginners-guide-ai.png',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Stop-Sabotaging.jpg': '/assets/images/books/stop-sabotaging.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Breaking-through-Dark.jpg': '/assets/images/books/breaking-through.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Divine-Conversations.jpg': '/assets/images/books/divine-conversations.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/Thrive-Within.jpg': '/assets/images/books/thrive-within.jpg',
  'https://www.stephenscott.us/wp-content/uploads/2024/11/The-Rise-of-Marcus-Aurelius.jpg': '/assets/images/books/stoic-king.jpg'
};

const booksDir = path.join(__dirname, '../public/books');

console.log('📝 Updating book page images to use local paths...\n');

const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.html'));

let updatedCount = 0;
let totalReplacements = 0;

files.forEach(filename => {
  const filePath = path.join(booksDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  let fileUpdated = false;
  let fileReplacements = 0;

  Object.entries(imageMapping).forEach(([wpUrl, localPath]) => {
    const regex = new RegExp(wpUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = (content.match(regex) || []).length;

    if (matches > 0) {
      content = content.replace(regex, localPath);
      fileUpdated = true;
      fileReplacements += matches;
      totalReplacements += matches;
    }
  });

  if (fileUpdated) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filename}: ${fileReplacements} replacement(s)`);
    updatedCount++;
  } else {
    console.log(`⏭️  ${filename}: No changes needed`);
  }
});

console.log(`\n🎉 Updated ${updatedCount} file(s) with ${totalReplacements} total image path replacement(s)`);
