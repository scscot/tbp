const fs = require('fs');
const path = require('path');

const arbDir = path.join(__dirname, '..', '..', 'lib', 'l10n');
const supportedLocales = ['en', 'es', 'pt', 'tl', 'pseudo'];
const BUTTON_MAX_LENGTH = 35;

function checkButtonLengths() {
  let totalErrors = 0;
  const buttonPattern = /button/i;

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

    const content = JSON.parse(fs.readFileSync(arbPath, 'utf8'));
    let localeErrors = 0;

    for (const [key, value] of Object.entries(content)) {
      if (key.startsWith('@') || key === '@@locale') continue;
      if (typeof value !== 'string') continue;

      if (buttonPattern.test(key)) {
        const cleanValue = value.replace(/\{[^}]+\}/g, 'XX');

        if (cleanValue.length > BUTTON_MAX_LENGTH) {
          console.error(
            `❌ ERROR: Button label too long in app_${locale}.arb\n` +
            `   Key: ${key}\n` +
            `   Value: "${value}"\n` +
            `   Length: ${cleanValue.length} (max: ${BUTTON_MAX_LENGTH})\n`
          );
          localeErrors++;
        }
      }
    }

    if (localeErrors === 0) {
      console.log(`✅ Button length check passed for ${locale}`);
    } else {
      totalErrors += localeErrors;
    }
  }

  if (totalErrors === 0) {
    console.log(`✅ All button labels within ${BUTTON_MAX_LENGTH} character limit`);
    process.exit(0);
  } else {
    console.error(`❌ Button length check failed with ${totalErrors} error(s)`);
    console.error(`\nℹ️  Buttons must be ≤ ${BUTTON_MAX_LENGTH} chars (optimized for translation quality while supporting modern devices)`);
    process.exit(1);
  }
}

checkButtonLengths();
