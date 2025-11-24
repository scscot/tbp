const fs = require('fs');
const path = require('path');

const files = [
  'web/blog.html',
  'web/books.html',
  'web/companies.html',
  'web/contact_us.html',
  'web/delete-account.html',
  'web/faq.html',
  'web/privacy_policy.html',
  'web/terms_of_service.html',
  'web-es/blog.html',
  'web-es/books.html',
  'web-es/contact_us.html',
  'web-es/faq.html',
  'web-es/index.html',
  'web-es/privacy_policy.html',
  'web-es/terms_of_service.html',
  'web-pt/blog.html',
  'web-pt/books.html',
  'web-pt/contact_us.html',
  'web-pt/faq.html',
  'web-pt/index.html',
  'web-pt/privacy_policy.html',
  'web-pt/terms_of_service.html',
];

const botDetectionCode = `
  function isBot() {
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
  }

  `;

let updatedCount = 0;
let skippedCount = 0;
let errorCount = 0;

files.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('function isBot()')) {
      console.log(`⏭️  Skipped ${file} (already has bot detection)`);
      skippedCount++;
      return;
    }

    if (!content.includes('fetch(\'https://api.ipify.org')) {
      console.log(`⚠️  Skipped ${file} (no IP fetch code found)`);
      skippedCount++;
      return;
    }

    const updatedContent = content.replace(
      /(\s+)fetch\('https:\/\/api\.ipify\.org/,
      `$1${botDetectionCode}$1fetch('https://api.ipify.org`
    );

    if (updatedContent === content) {
      console.log(`❌ Failed ${file} (pattern not found)`);
      errorCount++;
      return;
    }

    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`✅ Updated ${file}`);
    updatedCount++;
  } catch (error) {
    console.log(`❌ Error ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log(`\n=== Summary ===`);
console.log(`✅ Updated: ${updatedCount} files`);
console.log(`⏭️  Skipped: ${skippedCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`\nTotal files processed: ${files.length}`);
