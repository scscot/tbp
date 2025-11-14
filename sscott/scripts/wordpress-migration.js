import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORDPRESS_URL = 'https://stephenscott.us';
const API_BASE = `${WORDPRESS_URL}/wp-json/wp/v2`;
const PUBLIC_DIR = path.join(__dirname, '../public');
const BLOG_DIR = path.join(PUBLIC_DIR, 'blog');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'assets/images/blog');

async function ensureDirectories() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
  console.log('✅ Directories ready');
}

async function fetchAllPosts() {
  console.log('\n📥 Fetching posts from WordPress...');
  let allPosts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${API_BASE}/posts?per_page=100&page=${page}&_embed`);

    if (!response.ok) {
      if (response.status === 400) {
        hasMore = false;
        break;
      }
      throw new Error(`Failed to fetch posts: ${response.statusText}`);
    }

    const posts = await response.json();
    allPosts = allPosts.concat(posts);

    const totalPages = parseInt(response.headers.get('x-wp-totalpages') || '1');
    hasMore = page < totalPages;
    page++;

    console.log(`   Fetched page ${page - 1}/${totalPages} (${posts.length} posts)`);
  }

  console.log(`✅ Total posts fetched: ${allPosts.length}`);
  return allPosts;
}

async function downloadImage(url, slug) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const filename = `${slug}${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    fs.writeFileSync(filepath, Buffer.from(buffer));
    return `/assets/images/blog/${filename}`;
  } catch (error) {
    console.error(`   ⚠️  Failed to download image: ${error.message}`);
    return null;
  }
}

function cleanExcerpt(text) {
  if (!text) return '';
  const dom = new JSDOM(text);
  const cleaned = dom.window.document.body.textContent || '';
  return cleaned.replace(/\[&hellip;\]$/, '').trim();
}

function extractFirstParagraph(html) {
  if (!html) return '';
  const dom = new JSDOM(html);
  const firstP = dom.window.document.querySelector('p');
  return firstP ? firstP.textContent.trim() : '';
}

function generateBlogPostHTML(post, imagePath) {
  const title = post.title.rendered;
  const date = new Date(post.date);
  const dateFormatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const categories = post._embedded?.['wp:term']?.[0]?.map(cat => cat.name).join(', ') || 'Uncategorized';
  const excerpt = cleanExcerpt(post.excerpt.rendered) || extractFirstParagraph(post.content.rendered);
  const metaDescription = excerpt.substring(0, 157) + (excerpt.length > 157 ? '...' : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Stephen Scott</title>
  <meta name="description" content="${metaDescription}">
  <link rel="canonical" href="https://www.stephenscott.us/blog/${post.slug}">

  <meta property="og:type" content="article">
  <meta property="og:url" content="https://www.stephenscott.us/blog/${post.slug}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${metaDescription}">
  ${imagePath ? `<meta property="og:image" content="https://www.stephenscott.us${imagePath}">` : ''}
  <meta property="article:published_time" content="${post.date}">
  <meta property="article:author" content="Stephen Scott">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${metaDescription}">
  ${imagePath ? `<meta name="twitter:image" content="https://www.stephenscott.us${imagePath}">` : ''}

  <link rel="stylesheet" href="/assets/css/main.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "datePublished": "${post.date}",
    "dateModified": "${post.modified}",
    "author": {
      "@type": "Person",
      "name": "Stephen Scott",
      "url": "https://www.stephenscott.us"
    },
    "publisher": {
      "@type": "Person",
      "name": "Stephen Scott"
    },
    ${imagePath ? `"image": "https://www.stephenscott.us${imagePath}",` : ''}
    "description": "${metaDescription}",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://www.stephenscott.us/blog/${post.slug}"
    }
  }
  </script>
</head>
<body>
  <nav class="main-nav">
    <div class="container">
      <a href="/" class="logo">Stephen Scott</a>
      <ul class="nav-links">
        <li><a href="/books">Books</a></li>
        <li><a href="/blog">Blog</a></li>
        <li><a href="/podcasts">Podcasts</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <main class="blog-post">
    <article class="container">
      <header class="post-header">
        <p class="post-meta">
          <time datetime="${post.date}">${dateFormatted}</time>
          <span class="separator">•</span>
          <span class="categories">${categories}</span>
        </p>
        <h1>${title}</h1>
      </header>

      ${imagePath ? `<div class="post-featured-image">
        <img src="${imagePath}" alt="${title}" loading="lazy">
      </div>` : ''}

      <div class="post-content">
        ${post.content.rendered}
      </div>

      <footer class="post-footer">
        <div class="author-bio">
          <h3>About the Author</h3>
          <p>Stephen Scott is a tech entrepreneur and author specializing in AI, network marketing, and personal transformation. Creator of <a href="https://teambuildpro.com">Team Build Pro</a>, an AI-powered platform for building and managing direct sales teams.</p>
          <p><a href="/books" class="cta-link">Explore Stephen's Books →</a></p>
        </div>
      </footer>
    </article>
  </main>

  <footer class="main-footer">
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} Stephen Scott. All rights reserved.</p>
      <p>
        <a href="/books">Books</a> •
        <a href="/blog">Blog</a> •
        <a href="/about">About</a> •
        <a href="/contact">Contact</a>
      </p>
    </div>
  </footer>
</body>
</html>`;
}

async function migratePosts() {
  console.log('🚀 Starting WordPress to Firebase migration...\n');

  await ensureDirectories();
  const posts = await fetchAllPosts();

  console.log('\n📝 Generating static HTML pages...');
  const redirects = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`   Processing ${i + 1}/${posts.length}: ${post.title.rendered}`);

    let imagePath = null;
    if (post._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
      const imageUrl = post._embedded['wp:featuredmedia'][0].source_url;
      imagePath = await downloadImage(imageUrl, post.slug);
    }

    const html = generateBlogPostHTML(post, imagePath);
    const filepath = path.join(BLOG_DIR, `${post.slug}.html`);
    fs.writeFileSync(filepath, html);

    redirects.push({
      source: `/blogs/${post.slug}`,
      destination: `/blog/${post.slug}`,
      type: 301
    });
    redirects.push({
      source: `/${post.slug}`,
      destination: `/blog/${post.slug}`,
      type: 301
    });
  }

  console.log('\n📋 Generating redirects...');
  const redirectsPath = path.join(__dirname, '../redirects.json');
  fs.writeFileSync(redirectsPath, JSON.stringify(redirects, null, 2));
  console.log(`✅ ${redirects.length} redirects saved to redirects.json`);

  console.log('\n🎉 Migration complete!');
  console.log(`   ${posts.length} blog posts migrated`);
  console.log(`   ${redirects.length} redirects generated`);
  console.log('\nNext steps:');
  console.log('   1. Run generate-sitemap script');
  console.log('   2. Add redirects to firebase.json');
  console.log('   3. Create blog index page');
}

migratePosts().catch(console.error);
