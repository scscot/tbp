#!/usr/bin/env node
/**
 * Fix Florida Bar records with malformed firmName fields
 *
 * Issues:
 * - Firm name + PO Box + City + State + Zip concatenated
 * - Street addresses instead of firm names
 * - Too short (single digits)
 * - Trailing punctuation
 *
 * Usage:
 *   node fix-flbar-firmnames.js          # Dry run
 *   node fix-flbar-firmnames.js --run    # Actually fix
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const preintakeDb = admin.firestore();
preintakeDb.settings({ databaseId: 'preintake' });

const DRY_RUN = !process.argv.includes('--run');

// Florida cities for splitting concatenated addresses
const FL_CITIES = [
  'Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah',
  'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral', 'Pembroke Pines',
  'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs', 'Clearwater', 'Palm Bay',
  'Pompano Beach', 'West Palm Beach', 'Lakeland', 'Davie', 'Boca Raton', 'Plantation',
  'Sunrise', 'Fort Myers', 'Deerfield Beach', 'Melbourne', 'Deltona', 'Palm Coast',
  'Largo', 'Boynton Beach', 'Lauderhill', 'Weston', 'Homestead', 'Delray Beach',
  'Tamarac', 'Kissimmee', 'Daytona Beach', 'North Miami', 'Wellington', 'Jupiter',
  'Ocala', 'Pensacola', 'Sarasota', 'Naples', 'Winter Park', 'Altamonte Springs',
  'Odessa', 'Fort Pierce', 'Ponte Vedra Beach', 'Minneola', 'Winter Haven'
];

/**
 * Extract firm name from concatenated Florida Bar data
 */
function extractFirmName(original) {
  if (!original) return null;

  let firmName = original.trim();

  // Pattern 1: "Firm Name, P.A.PO Box 123City, FL 12345-6789"
  // Split at PO Box
  const poBoxMatch = firmName.match(/^(.+?)(P\.?\s*O\.?\s*Box)/i);
  if (poBoxMatch && poBoxMatch[1].length > 3) {
    firmName = poBoxMatch[1].trim();
    // Remove trailing punctuation
    firmName = firmName.replace(/[,\-;:]$/, '').trim();
    if (firmName.length > 3) return firmName;
  }

  // Pattern 2: Street address at start - "123 Main St..." - return empty
  if (/^\d+\s+[A-Za-z]/.test(firmName)) {
    return ''; // No firm name, just address
  }

  // Pattern 3: Single digit or very short - return empty
  if (firmName.length <= 2 || /^\d+$/.test(firmName)) {
    return '';
  }

  // Pattern 4: Company suffix + number (like NC Bar issue)
  const suffixMatch = firmName.match(/^(.+?(?:LLC|PLLC|PA|PC|P\.A\.|LLP|Inc\.?))\s*\d/i);
  if (suffixMatch) {
    return suffixMatch[1].trim();
  }

  // Pattern 5: Firm name followed by city name
  for (const city of FL_CITIES) {
    const cityPattern = new RegExp(`^(.+?)${city}`, 'i');
    const cityMatch = firmName.match(cityPattern);
    if (cityMatch && cityMatch[1].length > 5) {
      let extracted = cityMatch[1].trim();
      // Remove trailing address-like patterns
      extracted = extracted.replace(/\d+\s*[A-Za-z].*$/, '').trim();
      extracted = extracted.replace(/[,\-;:]$/, '').trim();
      if (extracted.length > 3) return extracted;
    }
  }

  // Pattern 6: Contains state abbreviation ", FL" - split there
  const stateMatch = firmName.match(/^(.+?),?\s*FL\b/i);
  if (stateMatch && stateMatch[1].length > 5) {
    let extracted = stateMatch[1].trim();
    // Check if this looks like a firm name (not an address)
    if (!/^\d/.test(extracted)) {
      extracted = extracted.replace(/\d+\s*[A-Za-z].*$/, '').trim();
      extracted = extracted.replace(/[,\-;:]$/, '').trim();
      if (extracted.length > 3) return extracted;
    }
  }

  // Pattern 7: Contains zip code - split before it
  const zipMatch = firmName.match(/^(.+?)\b\d{5}(-\d{4})?\b/);
  if (zipMatch && zipMatch[1].length > 5) {
    let extracted = zipMatch[1].trim();
    // Remove trailing city/state pattern
    extracted = extracted.replace(/[A-Za-z]+,?\s*$/, '').trim();
    extracted = extracted.replace(/[,\-;:]$/, '').trim();
    if (extracted.length > 3 && !/^\d/.test(extracted)) {
      return extracted;
    }
  }

  // Pattern 8: Trailing punctuation only
  if (/[,\-;:]$/.test(firmName)) {
    return firmName.replace(/[,\-;:]+$/, '').trim();
  }

  return null; // Couldn't parse
}

/**
 * Post-extraction validation - if result is just a PO Box, return empty
 */
function validateExtractedFirmName(extracted) {
  if (!extracted) return extracted;

  // If result is just a PO Box address, it's not a firm name
  if (/^P\.?\s*O\.?\s*Box\s*\d*$/i.test(extracted.trim())) {
    return '';
  }

  return extracted;
}

/**
 * Check if firmName needs fixing
 */
function needsFix(firmName) {
  if (!firmName) return false;

  return (
    // Too short
    (firmName.length <= 2) ||
    // Just a number
    /^\d+$/.test(firmName) ||
    // Starts with number (address)
    /^\d+\s+[A-Za-z]/.test(firmName) ||
    // Contains zip code
    /\b\d{5}(-\d{4})?\b/.test(firmName) ||
    // Contains PO Box
    /P\.?\s*O\.?\s*Box/i.test(firmName) ||
    // Company suffix followed by number
    /(LLC|PLLC|PA|PC|P\.A\.|LLP|Inc)\s*\d/i.test(firmName) ||
    // Contains Suite/Ste with number
    /\b(Suite|Ste\.?)\s*#?\d+/i.test(firmName) ||
    // Trailing punctuation
    /[,\-;:]$/.test(firmName)
  );
}

async function fixRecords() {
  console.log('Florida Bar Firm Name Fix Script');
  console.log('='.repeat(60));
  console.log(DRY_RUN ? '*** DRY RUN ***\n' : '*** LIVE RUN ***\n');

  const snapshot = await preintakeDb.collection('preintake_emails')
    .where('source', '==', 'flbar')
    .get();

  console.log('Total FL Bar records:', snapshot.size);

  const fixes = [];
  const setToEmpty = [];
  const unfixable = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const firmName = data.firmName || '';

    if (needsFix(firmName)) {
      let fixed = extractFirmName(firmName);
      fixed = validateExtractedFirmName(fixed);

      if (fixed === '') {
        setToEmpty.push({
          id: doc.id,
          original: firmName,
          email: data.email
        });
      } else if (fixed !== null && fixed !== firmName) {
        fixes.push({
          id: doc.id,
          original: firmName,
          fixed: fixed,
          email: data.email
        });
      } else {
        unfixable.push({
          id: doc.id,
          firmName: firmName,
          email: data.email
        });
      }
    }
  });

  console.log('\nRecords to fix (extract firm name):', fixes.length);
  console.log('Records to set to empty:', setToEmpty.length);
  console.log('Unfixable:', unfixable.length);

  // Show sample fixes
  console.log('\n--- Sample Fixes (first 20) ---');
  fixes.slice(0, 20).forEach((fix, i) => {
    console.log('\n' + (i+1) + '. ' + fix.email);
    console.log('   BEFORE: ' + fix.original);
    console.log('   AFTER:  ' + fix.fixed);
  });

  // Show sample empty
  console.log('\n--- Sample Set to Empty (first 10) ---');
  setToEmpty.slice(0, 10).forEach((item, i) => {
    console.log((i+1) + '. ' + item.original + ' → ""');
  });

  // Show unfixable
  if (unfixable.length > 0) {
    console.log('\n--- Unfixable (first 10) ---');
    unfixable.slice(0, 10).forEach((item, i) => {
      console.log((i+1) + '. ' + item.firmName);
    });
  }

  // Apply fixes
  if (!DRY_RUN) {
    console.log('\n--- Applying Fixes ---');

    const allFixes = [
      ...fixes.map(f => ({ id: f.id, firmName: f.fixed })),
      ...setToEmpty.map(f => ({ id: f.id, firmName: '' }))
    ];

    let fixed = 0;
    const batchSize = 500;

    for (let i = 0; i < allFixes.length; i += batchSize) {
      const batch = preintakeDb.batch();
      const batchFixes = allFixes.slice(i, i + batchSize);

      for (const fix of batchFixes) {
        const docRef = preintakeDb.collection('preintake_emails').doc(fix.id);
        batch.update(docRef, { firmName: fix.firmName });
      }

      await batch.commit();
      fixed += batchFixes.length;
      console.log('   Fixed:', fixed, '/', allFixes.length);
    }

    console.log('\n--- Results ---');
    console.log('Fixed:', fixed);
  }

  console.log('\nDone!');
  process.exit(0);
}

fixRecords().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
