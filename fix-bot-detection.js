const fs = require('fs');
const path = require('path');

const files = [
  'web/index.html',
  'web/blog.html',
  'web/companies.html',
  'web/contact_us.html',
  'web/delete-account.html',
  'web/faq.html',
  'web/privacy_policy.html',
  'web/terms_of_service.html',
  'web-es/blog.html',
  'web-es/contact_us.html',
  'web-es/faq.html',
  'web-es/index.html',
  'web-es/privacy_policy.html',
  'web-es/terms_of_service.html',
  'web-pt/blog.html',
  'web-pt/contact_us.html',
  'web-pt/faq.html',
  'web-pt/index.html',
  'web-pt/privacy_policy.html',
  'web-pt/terms_of_service.html',
];

// Old problematic code
const oldIsBot = `function isBot() {
        const botPatterns = [
          /bot/i, /crawler/i, /spider/i, /crawling/i,
          /headless/i, /phantom/i, /selenium/i, /webdriver/i,
          /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
          /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
          /linkedinbot/i, /twitter/i, /pinterest/i,
          /whatsapp/i, /telegram/i,
          /uptimerobot/i, /monitor/i, /pingdom/i, /statuscake/i,
          /sitechecker/i, /seo/i
        ];
        const ua = navigator.userAgent;
        return botPatterns.some(pattern => pattern.test(ua)) ||
               !navigator.webdriver === false;
      }`;

// New fixed code
const newIsBot = `function isBot() {
        const ua = navigator.userAgent || '';

        const botPatterns = [
          // Generic bots/crawlers (word boundaries to avoid false positives)
          /\\bbot\\b/i, /\\bcrawl(er|ing)?\\b/i, /\\bspider\\b/i,

          // Automation/headless browsers
          /headless(chrome)?/i, /phantomjs/i, /selenium/i, /webdriver/i,
          /playwright/i, /puppeteer/i, /cypress/i,

          // Search engine crawlers
          /googlebot/i, /google-inspectiontool/i, /adsbot-google/i,
          /bingbot/i, /bingpreview/i, /slurp/i, /duckduckbot/i,
          /baiduspider/i, /yandex(bot|images|media)/i,

          // Social media scrapers (bot-specific, NOT in-app browsers)
          /facebookexternalhit/i, /facebot/i, /linkedinbot/i,
          /twitterbot/i, /pinterestbot/i,

          // Uptime monitoring services
          /uptimerobot/i, /pingdom/i, /statuscake/i, /site24x7/i,

          // SEO/site analysis tools
          /sitechecker/i, /ahrefsbot/i, /semrushbot/i, /mj12bot/i,

          // Additional common bots
          /prerender/i, /applebot/i, /archive\\.org_bot/i
        ];

        const isWebDriver = navigator.webdriver === true;

        return botPatterns.some(pattern => pattern.test(ua)) || isWebDriver;
      }`;

// Fix the measurement ID bug in catch block
const buggyGtagCatch = `gtag('config', 'G-G4TBBPZ7')`;
const fixedGtagCatch = `gtag('config', 'G-G4E4TBBPZ7')`;

let updatedCount = 0;
let errorCount = 0;

files.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix 1: Replace old isBot with new improved version
    if (content.includes(oldIsBot)) {
      content = content.replace(oldIsBot, newIsBot);
      console.log(`✅ Updated isBot() in ${file}`);
    }

    // Fix 2: Fix measurement ID bug in catch block
    const catchBlockBefore = content.includes(buggyGtagCatch);
    content = content.replace(
      new RegExp(buggyGtagCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      fixedGtagCatch
    );

    if (catchBlockBefore) {
      console.log(`✅ Fixed measurement ID bug in ${file}`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
  } catch (error) {
    console.log(`❌ Error ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n=== Summary ===`);
console.log(`✅ Updated: ${updatedCount} files`);
console.log(`❌ Errors: ${errorCount} files`);

console.log(`\n=== Critical Fixes Applied ===`);
console.log(`1. Removed /whatsapp/i and /telegram/i patterns (prevented false positives)`);
console.log(`2. Changed /twitter/i to /twitterbot/i (specific bot, not in-app browser)`);
console.log(`3. Changed /pinterest/i to /pinterestbot/i`);
console.log(`4. Fixed measurement ID typo: G-G4TBBPZ7 → G-G4E4TBBPZ7`);
console.log(`5. Clarified navigator.webdriver check`);
console.log(`6. Added modern automation tools (Playwright, Puppeteer, Cypress)`);
console.log(`7. Added word boundaries to generic patterns`);
