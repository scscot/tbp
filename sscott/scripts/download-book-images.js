import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageDownloads = [
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.png', filename: 'mlm-cover-us.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/12/AI-Your-Gateway-to-a-Bbetter-Life-Cover-v6.png', filename: 'ai-gateway.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Fear-and-Uncertainty.png', filename: 'fear-and-uncertainty.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-ES.jpg', filename: 'mlm-cover-es.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-BR-1.png', filename: 'mlm-cover-br.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-DE.jpg', filename: 'mlm-cover-de.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-JP.png', filename: 'mlm-cover-jp.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-HI.png', filename: 'mlm-cover-hi.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-Kindle-3D.png', filename: 'network-marketing-playbook.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Paperback-Cover-Image.png', filename: 'beginners-guide-ai.png' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Stop-Sabotaging.jpg', filename: 'stop-sabotaging.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Breaking-through-Dark.jpg', filename: 'breaking-through.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Divine-Conversations.jpg', filename: 'divine-conversations.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/Thrive-Within.jpg', filename: 'thrive-within.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/The-Rise-of-Marcus-Aurelius.jpg', filename: 'stoic-king.jpg' },
  { url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-US.jpg', filename: 'mlm-cover-us-2.jpg' }
];

const outputDir = path.join(__dirname, '../public/assets/images/books');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('📥 Downloading book cover images from WordPress...\n');

let successCount = 0;
let failCount = 0;

for (const { url, filename } of imageDownloads) {
  const outputPath = path.join(outputDir, filename);

  try {
    console.log(`⬇️  Downloading ${filename}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      throw new Error('Received HTML instead of image (redirect issue)');
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));

    const stats = fs.statSync(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(1);

    console.log(`   ✅ ${filename} (${sizeKB} KB)`);
    successCount++;

  } catch (error) {
    console.log(`   ❌ ${filename}: ${error.message}`);
    failCount++;
  }
}

console.log(`\n🎉 Download complete: ${successCount} successful, ${failCount} failed`);

if (successCount > 0) {
  console.log('\n📁 Images saved to: public/assets/images/books/');
  console.log('\n✨ Next step: Run "npm run deploy" to deploy to Firebase');
}
