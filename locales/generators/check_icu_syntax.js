const fs = require('fs');
const path = require('path');

const arbDir = path.join(__dirname, '..', '..', 'lib', 'l10n');
const supportedLocales = ['en', 'es', 'pt', 'tl', 'pseudo'];

function extractICUExpressions(value) {
  const expressions = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < value.length; i++) {
    if (value[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (value[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        expressions.push(value.substring(start, i + 1));
        start = -1;
      }
    }
  }

  return expressions;
}

function validateICUSyntax(value, key, locale) {
  const expressions = extractICUExpressions(value);

  if (expressions.length === 0) return true;

  let errors = [];

  for (const expr of expressions) {
    const inner = expr.slice(1, -1);

    if (inner.includes('plural') || inner.includes('select')) {
      const hasOneCase = inner.includes('=1') || inner.includes(' one ') || inner.includes('one {');
      const hasOtherCase = inner.includes('other {') || inner.includes(' other {');

      if (inner.includes('plural') && (!hasOneCase || !hasOtherCase)) {
        errors.push(`Plural in ${key} missing one/=1 or other case`);
      }
    }

    const openBraces = (expr.match(/\{/g) || []).length;
    const closeBraces = (expr.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces in ${key}`);
    }
  }

  return errors;
}

function checkICUSyntax() {
  let totalErrors = 0;

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
    let fileErrors = 0;

    for (const [key, value] of Object.entries(content)) {
      if (key.startsWith('@') || key === '@@locale' || typeof value !== 'string') continue;

      const errors = validateICUSyntax(value, key, locale);
      if (Array.isArray(errors) && errors.length > 0) {
        console.error(`❌ ERROR in app_${locale}.arb:`);
        errors.forEach(err => console.error(`   ${err}`));
        fileErrors += errors.length;
      }
    }

    if (fileErrors === 0) {
      console.log(`✅ ICU syntax check passed for ${locale}`);
    } else {
      totalErrors += fileErrors;
    }
  }

  if (totalErrors === 0) {
    console.log(`✅ All ICU syntax checks passed`);
    process.exit(0);
  } else {
    console.error(`❌ ICU syntax check failed with ${totalErrors} error(s)`);
    process.exit(1);
  }
}

checkICUSyntax();
