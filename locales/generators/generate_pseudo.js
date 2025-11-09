const fs = require('fs');
const path = require('path');

const diacriticMap = {
  'a': 'ȧ', 'A': 'Ȧ', 'e': 'ḗ', 'E': 'Ḗ',
  'i': 'ï', 'I': 'Ï', 'o': 'ö', 'O': 'Ö',
  'u': 'ü', 'U': 'Ü', 'n': 'ñ', 'N': 'Ñ',
  'c': 'ċ', 'C': 'Ċ', 's': 'š', 'S': 'Š',
  'B': 'ß', 'P': 'Þ', 'T': 'Ṫ',
};

function pseudolocalize(str) {
  const placeholders = [];
  let tokenized = str;

  // Extract ICU placeholders like {min}, {method}, {count} and preserve them
  tokenized = tokenized.replace(/\{[^}]+\}/g, (match) => {
    const index = placeholders.length;
    placeholders.push(match);
    // Use a token that won't get diacritics: all non-letter characters
    return `\uE000${index}\uE001`; // Use private use Unicode characters as delimiters
  });

  // Apply diacritics to non-placeholder text
  let result = '';
  for (const char of tokenized) {
    result += diacriticMap[char] || char;
  }

  // Restore original placeholders
  result = result.replace(/\uE000(\d+)\uE001/g, (_, index) => {
    return placeholders[parseInt(index)];
  });

  const padding = 'Þ'.repeat(Math.round(result.length * 0.3));
  return `[${result} ${padding}]`;
}

const enPath = path.join(__dirname, '..', '..', 'lib', 'l10n', 'app_en.arb');

if (!fs.existsSync(enPath)) {
  console.error(`❌ Error: English ARB file not found at ${enPath}`);
  console.log('ℹ️  Run this script after creating app_en.arb file');
  process.exit(1);
}

const enARB = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const pseudoARB = { '@@locale': 'en_XA' };

for (const [key, value] of Object.entries(enARB)) {
  if (key === '@@locale') {
    // Skip - we already set this to 'en_XA'
    continue;
  } else if (key.startsWith('@')) {
    // Copy metadata (@description, @placeholders, etc.)
    pseudoARB[key] = value;
  } else if (typeof value === 'string') {
    // Pseudolocalize string values
    pseudoARB[key] = pseudolocalize(value);
  } else {
    // Copy other values as-is
    pseudoARB[key] = value;
  }
}

const outputPath = path.join(__dirname, '..', '..', 'lib', 'l10n', 'app_en_XA.arb');
fs.writeFileSync(outputPath, JSON.stringify(pseudoARB, null, 2));
console.log(`✅ Generated ${outputPath}`);
console.log(`   Pseudo-localized ${Object.keys(pseudoARB).filter(k => !k.startsWith('@')).length} strings`);
