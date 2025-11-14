import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import https from 'https';

const BOOKS_DATA_FILE = './books-data.json';
const COVERS_DIR = './public/assets/images/books';

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function scrapeAmazonCover(browser, amazonUrl, bookName) {
  const page = await browser.newPage();

  try {
    console.log(`Scraping: ${bookName}`);
    console.log(`URL: ${amazonUrl}`);

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(amazonUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const imageUrl = await page.evaluate(() => {
      const selectors = [
        '#landingImage',
        '#imgBlkFront',
        '#ebooksImgBlkFront',
        'img[data-a-image-name="landingImage"]',
        '.a-dynamic-image',
        '#main-image',
        'img[alt*="Cover"]'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img) {
          const src = img.src || img.getAttribute('data-old-hires') || img.getAttribute('data-a-dynamic-image');
          if (src) {
            if (src.startsWith('{')) {
              const srcSet = JSON.parse(src);
              const urls = Object.keys(srcSet);
              return urls[urls.length - 1];
            }
            return src;
          }
        }
      }
      return null;
    });

    await page.close();

    if (!imageUrl) {
      console.log(`  ⚠️  Could not find cover image`);
      return null;
    }

    console.log(`  ✓ Found image: ${imageUrl.substring(0, 80)}...`);
    return imageUrl;

  } catch (error) {
    await page.close();
    console.error(`  ✗ Error scraping ${bookName}: ${error.message}`);
    return null;
  }
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 100);
}

async function main() {
  if (!fs.existsSync(BOOKS_DATA_FILE)) {
    console.error(`Error: ${BOOKS_DATA_FILE} not found`);
    process.exit(1);
  }

  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
    console.log(`Created directory: ${COVERS_DIR}`);
  }

  const data = JSON.parse(fs.readFileSync(BOOKS_DATA_FILE, 'utf8'));
  const books = data.books.filter(book =>
    book.amazonUrl &&
    book.amazonUrl !== '#' &&
    book.amazonUrl.startsWith('http')
  );

  console.log(`Found ${books.length} books with valid Amazon URLs\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    console.log(`\n[${i + 1}/${books.length}] Processing: ${book.name}`);

    const imageUrl = await scrapeAmazonCover(browser, book.amazonUrl, book.name);

    if (imageUrl) {
      const sanitizedName = sanitizeFilename(book.name);
      const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
      const filename = `${sanitizedName}.${ext}`;
      const filepath = path.join(COVERS_DIR, filename);

      try {
        await downloadImage(imageUrl, filepath);
        console.log(`  ✓ Downloaded to: ${filename}`);
        results.push({
          name: book.name,
          amazonUrl: book.amazonUrl,
          imageUrl: imageUrl,
          localFile: filename,
          status: 'success'
        });
      } catch (error) {
        console.error(`  ✗ Failed to download: ${error.message}`);
        results.push({
          name: book.name,
          amazonUrl: book.amazonUrl,
          imageUrl: imageUrl,
          status: 'download_failed',
          error: error.message
        });
      }
    } else {
      results.push({
        name: book.name,
        amazonUrl: book.amazonUrl,
        status: 'scrape_failed'
      });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await browser.close();

  const resultsFile = path.join(COVERS_DIR, 'scrape-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total books processed: ${books.length}`);
  console.log(`Successfully scraped: ${results.filter(r => r.status === 'success').length}`);
  console.log(`Failed to scrape: ${results.filter(r => r.status === 'scrape_failed').length}`);
  console.log(`Failed to download: ${results.filter(r => r.status === 'download_failed').length}`);
  console.log(`\nResults saved to: ${resultsFile}`);
  console.log(`Images saved to: ${COVERS_DIR}`);
}

main().catch(console.error);
