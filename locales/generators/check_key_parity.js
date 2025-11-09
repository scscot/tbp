const fs = require('fs');
const path = require('path');

const arbDir = path.join(__dirname, '..', '..', 'lib', 'l10n');
const supportedLocales = ['en', 'es', 'pt', 'tl', 'pseudo'];

function getKeys(arbFile) {
  const content = JSON.parse(fs.readFileSync(arbFile, 'utf8'));
  return Object.keys(content).filter(k => !k.startsWith('@') && k !== '@@locale');
}

function checkKeyParity() {
  const arbFiles = {};
  let hasEnFile = false;

  for (const locale of supportedLocales) {
    const arbPath = path.join(arbDir, `app_${locale}.arb`);
    if (!fs.existsSync(arbPath)) {
      if (locale === 'en') {
        console.error(`❌ ERROR: Missing template file app_en.arb`);
        process.exit(1);
      }
      console.log(`ℹ️  Skipping ${locale} (file not yet created)`);
      continue;
    }

    if (locale === 'en') hasEnFile = true;
    arbFiles[locale] = getKeys(arbPath);
  }

  if (!hasEnFile) {
    console.error(`❌ ERROR: Template file app_en.arb not found`);
    process.exit(1);
  }

  const enKeys = new Set(arbFiles['en']);
  let errors = 0;

  for (const [locale, keys] of Object.entries(arbFiles)) {
    if (locale === 'en') continue;

    const localeKeys = new Set(keys);
    const missing = [...enKeys].filter(k => !localeKeys.has(k));
    const extra = [...localeKeys].filter(k => !enKeys.has(k));

    if (missing.length > 0) {
      console.error(`❌ ERROR: app_${locale}.arb is missing keys: ${missing.join(', ')}`);
      errors++;
    }

    if (extra.length > 0) {
      console.error(`❌ ERROR: app_${locale}.arb has extra keys: ${extra.join(', ')}`);
      errors++;
    }
  }

  if (errors === 0) {
    const totalKeys = enKeys.size;
    const totalFiles = Object.keys(arbFiles).length;
    console.log(`✅ Key parity check passed: ${totalFiles} files, ${totalKeys} keys each`);
    process.exit(0);
  } else {
    console.error(`❌ Key parity check failed with ${errors} error(s)`);
    process.exit(1);
  }
}

checkKeyParity();
