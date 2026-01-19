#!/usr/bin/env node
/**
 * Parse firstName/lastName from firmName for contacts missing those fields
 *
 * Only parses clean, obvious person names. Skips ambiguous or firm-like names.
 *
 * Usage:
 *   DRY_RUN=true node scripts/parse-names-from-firmname.js   # Preview changes
 *   node scripts/parse-names-from-firmname.js                 # Apply changes
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = process.env.DRY_RUN === 'true';

// Words that indicate this is a firm name, not a person (matched as whole words)
const FIRM_INDICATORS = [
  'law', 'legal', 'attorney', 'attorneys', 'firm', 'group', 'office', 'offices',
  'llc', 'llp', 'pllc', 'inc', 'corp', 'ltd',
  'associates', 'partners', 'partnership',
  'services', 'solutions', 'consulting', 'advisors', 'counsel'
];

// Patterns that indicate firm names (regex)
const FIRM_PATTERNS = [
  /\bp\.?c\.?\b/i,      // P.C. or PC
  /\bp\.?a\.?\b/i,      // P.A. or PA (but not as part of a word)
  /\b&\b/,              // Ampersand
  /\band\b/i,           // "and" as word
  /^the\b/i             // Starts with "The"
];

// Common name suffixes to strip but still consider valid
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'esq', 'esq.'];

// Common name prefixes to strip but still consider valid
const NAME_PREFIXES = ['mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.'];

/**
 * Attempt to parse a firmName into firstName and lastName
 * Returns { firstName, lastName } or null if not parseable
 */
function parseName(firmName) {
  if (!firmName || typeof firmName !== 'string') return null;

  const original = firmName.trim();
  let name = original.toLowerCase();

  // Check for firm indicators (as whole words only)
  for (const indicator of FIRM_INDICATORS) {
    const regex = new RegExp(`\\b${indicator}\\b`, 'i');
    if (regex.test(name)) {
      return null;
    }
  }

  // Check for firm patterns (regex-based)
  for (const pattern of FIRM_PATTERNS) {
    if (pattern.test(original)) {
      return null;
    }
  }

  // Check for special characters that indicate firm names
  if (/[@,()]/.test(name)) {
    return null;
  }

  // Split into words
  let words = original.split(/\s+/);

  // Remove prefixes (Mr., Dr., etc.)
  if (words.length > 0 && NAME_PREFIXES.includes(words[0].toLowerCase())) {
    words = words.slice(1);
  }

  // Remove suffixes (Jr., Esq., etc.)
  if (words.length > 0 && NAME_SUFFIXES.includes(words[words.length - 1].toLowerCase())) {
    words = words.slice(0, -1);
  }

  // Must have exactly 2 or 3 words (First Last or First Middle Last)
  if (words.length < 2 || words.length > 3) {
    return null;
  }

  // Each word should look like a name (capitalized, letters only, reasonable length)
  for (const word of words) {
    // Must start with capital letter
    if (!/^[A-Z]/.test(word)) {
      return null;
    }
    // Must be mostly letters (allow periods for initials like "M.")
    if (!/^[A-Za-z.'-]+$/.test(word)) {
      return null;
    }
    // Reasonable length (1-15 chars)
    if (word.length < 1 || word.length > 15) {
      return null;
    }
  }

  // Extract first and last name
  const firstName = words[0];
  const lastName = words[words.length - 1]; // Last word is last name

  // If middle name exists, we could include it, but for simplicity just use first/last
  return { firstName, lastName };
}

async function parseNames() {
  console.log('=== Parse Names from firmName ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get all contacts missing firstName/lastName
  const snapshot = await db.collection('preintake_emails').get();

  const toParse = [];
  const cannotParse = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.firstName && !data.lastName) {
      const parsed = parseName(data.firmName);
      if (parsed) {
        toParse.push({
          id: doc.id,
          firmName: data.firmName,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          sent: data.sent === true
        });
      } else {
        cannotParse.push({
          id: doc.id,
          firmName: data.firmName,
          sent: data.sent === true
        });
      }
    }
  });

  console.log(`Total missing firstName/lastName: ${toParse.length + cannotParse.length}`);
  console.log(`Can parse (clean names): ${toParse.length}`);
  console.log(`Cannot parse (ambiguous/firm): ${cannotParse.length}\n`);

  // Show breakdown by sent status
  const parsedSent = toParse.filter(t => t.sent).length;
  const parsedUnsent = toParse.filter(t => !t.sent).length;
  console.log(`Parseable - already sent: ${parsedSent}`);
  console.log(`Parseable - not yet sent: ${parsedUnsent}\n`);

  // Show sample of parseable names
  console.log('--- Sample Parseable Names (first 20) ---');
  toParse.slice(0, 20).forEach(t => {
    const status = t.sent ? '✉️ sent' : '📭 unsent';
    console.log(`  "${t.firmName}" → firstName: "${t.firstName}", lastName: "${t.lastName}" (${status})`);
  });

  if (toParse.length > 20) {
    console.log(`  ... and ${toParse.length - 20} more\n`);
  } else {
    console.log();
  }

  // Show sample of unparseable names
  console.log('--- Sample Unparseable Names (first 15) ---');
  cannotParse.slice(0, 15).forEach(t => {
    const status = t.sent ? '✉️ sent' : '📭 unsent';
    console.log(`  "${t.firmName}" (${status})`);
  });

  if (cannotParse.length > 15) {
    console.log(`  ... and ${cannotParse.length - 15} more\n`);
  } else {
    console.log();
  }

  if (DRY_RUN) {
    console.log('✅ DRY RUN complete. Run without DRY_RUN=true to apply changes.');
    process.exit(0);
  }

  if (toParse.length === 0) {
    console.log('✅ No names to parse.');
    process.exit(0);
  }

  // Apply updates in batches of 500
  console.log('Applying updates to Firestore...');
  const BATCH_SIZE = 500;
  let processed = 0;

  for (let i = 0; i < toParse.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toParse.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const docRef = db.collection('preintake_emails').doc(item.id);
      batch.update(docRef, {
        firstName: item.firstName,
        lastName: item.lastName
      });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  Processed ${processed}/${toParse.length}`);
  }

  console.log(`\n✅ Successfully parsed names for ${toParse.length} contacts!`);
  console.log(`   ${cannotParse.length} contacts remain with firmName only (unparseable).`);

  process.exit(0);
}

parseNames().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
