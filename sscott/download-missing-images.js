import fs from 'fs';
import https from 'https';
import path from 'path';

const BOOKS_DATA_FILE = './books-data.json';
const IMAGES_DIR = './public/assets/images/books';

const imageDownloads = [
  {
    url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/MLM-Cover-Kindle-3D.png',
    filename: 'network-marketing-playbook.png'
  },
  {
    url: 'https://www.stephenscott.us/wp-content/uploads/2024/11/The-Rise-of-Marcus-Aurelius.jpg',
    filename: 'stoic-king.jpg'
  }
];

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${path.basename(filepath)}`);
    console.log(`  From: ${url}`);

    const file = fs.createWriteStream(filepath + '.tmp');

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlink(filepath + '.tmp', () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();

        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }

        fs.renameSync(filepath + '.tmp', filepath);
        console.log(`  ✓ Downloaded successfully`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath + '.tmp', () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading missing book cover images...\n');
  console.log('='.repeat(60));

  for (const item of imageDownloads) {
    const filepath = path.join(IMAGES_DIR, item.filename);

    try {
      await downloadImage(item.url, filepath);
    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main().catch(console.error);
