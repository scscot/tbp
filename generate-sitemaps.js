#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().split('T')[0];

const sites = [
  {
    dir: 'web',
    domain: 'https://teambuildpro.com',
    outputFile: 'web/sitemap.xml',
    hasTranslations: true
  },
  {
    dir: 'web-es',
    domain: 'https://es.teambuildpro.com',
    outputFile: 'web-es/sitemap.xml',
    hasTranslations: true
  },
  {
    dir: 'web-pt',
    domain: 'https://pt.teambuildpro.com',
    outputFile: 'web-pt/sitemap.xml',
    hasTranslations: true
  }
];

const pageMetadata = {
  'index.html': { priority: 1.0, changefreq: 'weekly' },
  'faq.html': { priority: 0.9, changefreq: 'monthly' },
  'blog.html': { priority: 0.8, changefreq: 'weekly' },
  'companies.html': { priority: 0.8, changefreq: 'weekly' },
  'contact_us.html': { priority: 0.7, changefreq: 'monthly' },
  'privacy_policy.html': { priority: 0.5, changefreq: 'yearly' },
  'terms_of_service.html': { priority: 0.5, changefreq: 'yearly' },
  'claim.html': { priority: 0.6, changefreq: 'monthly' },
  'delete-account.html': { priority: 0.4, changefreq: 'yearly' },
  'books/index.html': { priority: 0.7, changefreq: 'monthly' },
};

const defaultMetadata = {
  blog: { priority: 0.7, changefreq: 'monthly' },
  companies: { priority: 0.6, changefreq: 'monthly' },
  default: { priority: 0.5, changefreq: 'monthly' }
};

function getAllHtmlFiles(dir, baseDir = dir, exclude = []) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (exclude.some(ex => fullPath.includes(ex))) {
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...getAllHtmlFiles(fullPath, baseDir, exclude));
    } else if (item.endsWith('.html')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

function getMetadata(filePath) {
  if (pageMetadata[filePath]) {
    return pageMetadata[filePath];
  }

  if (filePath.startsWith('blog/')) {
    return defaultMetadata.blog;
  }

  if (filePath.startsWith('companies/')) {
    return defaultMetadata.companies;
  }

  return defaultMetadata.default;
}

function generateSitemap(siteConfig) {
  console.log(`\nGenerating sitemap for ${siteConfig.domain}...`);

  const exclude = ['firestore-monitor.html', 'claim-google.html'];
  const files = getAllHtmlFiles(siteConfig.dir, siteConfig.dir, exclude);

  console.log(`Found ${files.length} HTML files`);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

`;

  const processedFiles = new Set();

  files.sort((a, b) => {
    const aPriority = getMetadata(a).priority;
    const bPriority = getMetadata(b).priority;
    return bPriority - aPriority;
  });

  for (const file of files) {
    if (processedFiles.has(file)) continue;
    processedFiles.add(file);

    let url = file === 'index.html' ? '' : file;
    const metadata = getMetadata(file);

    const section = file.startsWith('blog/') ? 'Blog Posts' :
                   file.startsWith('companies/') ? 'Company Recruiting Guides' :
                   file === 'index.html' ? 'Homepage' :
                   file === 'faq.html' ? 'FAQ Page' :
                   file === 'contact_us.html' ? 'Contact Us' :
                   file === 'privacy_policy.html' ? 'Privacy Policy' :
                   file === 'terms_of_service.html' ? 'Terms of Service' :
                   file === 'blog.html' ? 'Blog' :
                   file === 'companies.html' ? 'Companies' :
                   file === 'claim.html' ? 'Claim Page' :
                   file === 'delete-account.html' ? 'Delete Account' :
                   file === 'books/index.html' ? 'Books' :
                   'Other Pages';

    xml += `  <!-- ${section} -->\n`;
    xml += `  <url>\n`;
    xml += `    <loc>${siteConfig.domain}/${url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${metadata.changefreq}</changefreq>\n`;
    xml += `    <priority>${metadata.priority.toFixed(1)}</priority>\n`;

    if (siteConfig.hasTranslations && (
      file === 'index.html' ||
      file === 'faq.html' ||
      file === 'contact_us.html' ||
      file === 'privacy_policy.html' ||
      file === 'terms_of_service.html'
    )) {
      xml += `    <xhtml:link rel="alternate" hreflang="es" href="https://es.teambuildpro.com/${url}" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="pt" href="https://pt.teambuildpro.com/${url}" />\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en" href="https://teambuildpro.com/${url}" />\n`;
    }

    xml += `  </url>\n\n`;
  }

  xml += `</urlset>\n`;

  fs.writeFileSync(siteConfig.outputFile, xml);
  console.log(`✓ Sitemap written to ${siteConfig.outputFile}`);
}

console.log('=== Sitemap Generator ===');
console.log(`Date: ${today}\n`);

for (const site of sites) {
  generateSitemap(site);
}

console.log('\n✓ All sitemaps generated successfully!');
