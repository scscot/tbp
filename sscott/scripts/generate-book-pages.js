import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = '/Users/sscott/Downloads/wc-product-export-14-11-2025-1763137958394.csv';
const BOOKS_DIR = path.join(__dirname, '../public/books');
const PUBLIC_DIR = path.join(__dirname, '../public');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function cleanHTML(html) {
  if (!html) return '';
  return html
    .replace(/<\/?strong>/g, '')
    .replace(/<\/?em>/g, '')
    .replace(/\[embedyt\].*?\[\/embedyt\]/g, '')
    .replace(/<ul[^>]*>/g, '<ul>')
    .replace(/<li[^>]*>/g, '<li>');
}

function generateBookHTML(book) {
  const slug = book.slug || slugify(book.Name);
  const title = book.Name;
  const price = book['Regular price'] || '0.00';
  const description = cleanHTML(book.Description) || cleanHTML(book['Short description']) || '';
  const excerpt = (book['Short description'] || description).substring(0, 157).replace(/<[^>]*>/g, '');
  const amazonUrl = book['External URL'] || '#';
  const imageUrl = book.Images ? book.Images.split(',')[0].trim() : '';
  const categories = book.Categories || '';
  const tags = book.Tags || '';
  const isComingSoon = book['In stock?'] === '0' || title.includes('COMING SOON');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${title} | Stephen Scott</title>
  <meta name="description" content="${excerpt}${excerpt.length >= 157 ? '...' : ''}">

  <link rel="canonical" href="https://www.stephenscott.us/books/${slug}">

  <meta property="og:type" content="book">
  <meta property="og:url" content="https://www.stephenscott.us/books/${slug}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${excerpt}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ''}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${excerpt}">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ''}

  <link rel="stylesheet" href="/assets/css/main.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": "${title.replace(/"/g, '\\"')}",
    "author": {
      "@type": "Person",
      "name": "Stephen Scott",
      "url": "https://www.stephenscott.us"
    },
    "description": "${excerpt.replace(/"/g, '\\"')}",
    ${imageUrl ? `"image": "${imageUrl}",` : ''}
    ${!isComingSoon ? `"offers": {
      "@type": "Offer",
      "price": "${price}",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": "${amazonUrl}"
    },` : ''}
    "publisher": {
      "@type": "Person",
      "name": "Stephen Scott"
    }
  }
  </script>
</head>
<body>
  <nav class="main-nav">
    <div class="container">
      <a href="/" class="logo">Stephen Scott</a>
      <ul class="nav-links">
        <li><a href="/books" style="color: var(--color-primary);">Books</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/podcasts">Podcasts</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <main>
    <section class="section">
      <div class="container">
        <div style="max-width: 1000px; margin: 0 auto;">
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; margin-bottom: 3rem;">
            ${imageUrl ? `<div>
              <img src="${imageUrl}" alt="${title}" style="width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);">
            </div>` : ''}
            <div>
              <h1>${title}</h1>
              ${!isComingSoon ? `<p style="font-size: 2rem; font-weight: 700; color: var(--color-accent); margin: 1rem 0;">$${price}</p>` : '<p style="font-size: 1.5rem; font-weight: 700; color: var(--color-text-light); margin: 1rem 0;">Coming Soon</p>'}
              ${!isComingSoon ? `<a href="${amazonUrl}" class="btn" target="_blank" rel="noopener">Buy on Amazon</a>` : ''}
              <p style="margin-top: 2rem; color: var(--color-text-light);">by <a href="/about">Stephen Scott</a></p>
            </div>
          </div>

          <div class="post-content">
            <h2>About This Book</h2>
            ${description}
          </div>

          ${!isComingSoon ? `<div class="tbp-cta" style="margin-top: 3rem;">
            <h3>Get This Book on Amazon</h3>
            <p>Available in paperback and Kindle editions</p>
            <a href="${amazonUrl}" class="btn" target="_blank" rel="noopener">Buy on Amazon</a>
          </div>` : ''}
        </div>
      </div>
    </section>

    <section class="section" style="background-color: var(--color-bg-alt);">
      <div class="container">
        <h2 class="section-title">More Books by Stephen Scott</h2>
        <p style="text-align: center; margin-bottom: 2rem;">
          <a href="/books" class="btn btn-secondary">View All Books</a>
        </p>
      </div>
    </section>
  </main>

  <footer class="main-footer">
    <div class="container">
      <p>&copy; 2025 Stephen Scott. All rights reserved.</p>
      <p>
        <a href="/books">Books</a> •
        <a href="/blog">Blog</a> •
        <a href="/podcasts">Podcasts</a> •
        <a href="/about">About</a> •
        <a href="/contact">Contact</a>
      </p>
      <p style="margin-top: 1rem; font-size: 0.8125rem;">
        Built with <a href="https://teambuildpro.com" target="_blank" rel="noopener">Team Build Pro</a> - AI-Powered Network Marketing Platform
      </p>
    </div>
  </footer>
</body>
</html>`;
}

async function generateBookPages() {
  console.log('🚀 Generating book pages from CSV...\n');

  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  }

  const books = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        if (row.Name && row.Name.trim()) {
          const slug = slugify(row.Name);
          row.slug = slug;
          books.push(row);
        }
      })
      .on('end', () => {
        console.log(`📚 Found ${books.length} books\n`);

        books.forEach((book, index) => {
          const html = generateBookHTML(book);
          const filename = `${book.slug}.html`;
          const filepath = path.join(BOOKS_DIR, filename);

          fs.writeFileSync(filepath, html);
          console.log(`   ✅ ${index + 1}/${books.length}: ${book.Name}`);
        });

        const booksData = {
          books: books.map(b => ({
            name: b.Name,
            slug: b.slug,
            price: b['Regular price'],
            image: b.Images ? b.Images.split(',')[0].trim() : '',
            excerpt: (b['Short description'] || b.Description || '').substring(0, 150).replace(/<[^>]*>/g, ''),
            amazonUrl: b['External URL'] || '#',
            inStock: b['In stock?'] === '1'
          }))
        };

        fs.writeFileSync(
          path.join(__dirname, '../books-data.json'),
          JSON.stringify(booksData, null, 2)
        );

        console.log(`\n✅ Generated ${books.length} book pages!`);
        console.log(`📝 Saved books data to books-data.json`);
        resolve(books);
      })
      .on('error', reject);
  });
}

generateBookPages().catch(console.error);
