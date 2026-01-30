#!/usr/bin/env node

/**
 * Check common URL patterns that might be 404ing
 */

const https = require('https');

async function checkUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SitemapChecker/1.0)' }
    }, (res) => {
      resolve({ url, status: res.statusCode });
    });
    req.on('error', () => resolve({ url, status: 'error' }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'timeout' });
    });
  });
}

async function main() {
  const baseUrl = 'https://teambuildpro.com';

  // Common URL patterns that might be linked to but don't exist
  const urlsToCheck = [
    // Common page names
    '/about.html', '/about', '/about-us.html', '/about-us',
    '/features.html', '/features', '/pricing.html', '/pricing',
    '/download.html', '/download', '/app.html', '/app',
    '/signup.html', '/signup', '/register.html', '/register',
    '/login.html', '/login', '/signin.html', '/signin',
    '/support.html', '/support', '/help.html', '/help',
    '/demo.html', '/demo', '/trial.html', '/trial',
    '/testimonials.html', '/testimonials', '/reviews.html', '/reviews',
    '/careers.html', '/careers', '/jobs.html', '/jobs',
    '/team.html', '/team', '/partners.html', '/partners',
    '/press.html', '/press', '/news.html', '/news',
    '/sitemap.html', '/404.html', '/error.html',

    // Possible old blog URLs
    '/blog/index.html',

    // Possible old page structures
    '/pages/about.html', '/pages/features.html', '/pages/pricing.html',

    // Common WordPress/CMS patterns
    '/wp-admin', '/wp-login.php', '/admin', '/dashboard',

    // API/endpoint patterns that might be crawled
    '/api', '/api/', '/graphql',

    // RSS/feed patterns
    '/feed', '/rss', '/rss.xml', '/atom.xml',

    // Common misspellings/variations
    '/faq', '/faqs.html', '/faqs',
    '/contact.html', '/contact', '/contactus.html',
    '/privacy.html', '/privacy', '/terms.html', '/terms',
    '/tos.html', '/tos',

    // Old company page patterns
    '/company/', '/companies/index.html',
    '/company/herbalife.html', '/company/amway.html',

    // Mobile/app related
    '/mobile', '/ios', '/android', '/get-app', '/get-the-app',

    // Marketing/landing pages
    '/lp/', '/landing/', '/promo/', '/offer/',
    '/free-trial', '/start', '/get-started',

    // Old referral patterns
    '/ref/', '/invite/', '/r/',

    // Possible old paths
    '/home', '/home.html', '/main', '/main.html',
    '/welcome', '/welcome.html',
  ];

  console.log('Checking common URL patterns for 404s...\n');

  const notFound = [];
  const found = [];
  const redirects = [];

  for (const path of urlsToCheck) {
    const result = await checkUrl(baseUrl + path);
    if (result.status === 404) {
      notFound.push(path);
    } else if (result.status === 200) {
      found.push(path);
    } else if (result.status >= 300 && result.status < 400) {
      redirects.push({ path, status: result.status });
    }
  }

  console.log('========== RESULTS ==========\n');

  if (notFound.length > 0) {
    console.log(`❌ 404 NOT FOUND (${notFound.length}):`);
    notFound.forEach(p => console.log(`  ${baseUrl}${p}`));
  }

  console.log(`\n✅ FOUND (${found.length}):`);
  found.forEach(p => console.log(`  ${baseUrl}${p}`));

  if (redirects.length > 0) {
    console.log(`\n↪️  REDIRECTS (${redirects.length}):`);
    redirects.forEach(r => console.log(`  ${baseUrl}${r.path} (${r.status})`));
  }
}

main().catch(console.error);
