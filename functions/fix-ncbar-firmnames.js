#!/usr/bin/env node
/**
 * Fix North Carolina Bar records with concatenated firmName + address
 *
 * Issues:
 * - Firm name + street address concatenated: "TrustCounsel1414 Raleigh Road"
 * - Firm name + PO Box concatenated: "Ward & Smith, P.A.P. O. Box 867"
 * - Firm name + Suite concatenated: "LEGALIS2724 Discovery Drive, Suite 100"
 *
 * Usage:
 *   node fix-ncbar-firmnames.js          # Dry run
 *   node fix-ncbar-firmnames.js --run    # Actually fix
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = !process.argv.includes('--run');

/**
 * Extract firm name from concatenated NC Bar data
 */
function extractFirmName(original) {
  if (!original) return null;

  let firmName = original.trim();

  // Pre-check: If it starts with "Suite" or a number, it's just an address
  if (/^(Suite|Ste\.?)\s*\d/i.test(firmName) || /^\d+\s+[A-Za-z]/.test(firmName)) {
    return '';
  }

  // Pattern 1: Legal suffix followed directly by address (no space)
  // "Troutman Pepper Locke LLPThree Embarcadero" → "Troutman Pepper Locke LLP"
  const suffixMatch = firmName.match(/^(.+?(?:LLC|PLLC|P\.?A\.?|PC|P\.?C\.?|LLP|Inc\.?|CHTD|Corp\.?))([A-Z0-9])/i);
  if (suffixMatch) {
    const extracted = suffixMatch[1].trim();
    if (extracted.length > 5) return extracted;
  }

  // Pattern 2: PO Box in the middle
  // "Ward & Smith, P.A.P. O. Box 867" → "Ward & Smith, P.A."
  const poBoxMatch = firmName.match(/^(.+?)(P\.?\s*O\.?\s*Box)/i);
  if (poBoxMatch && poBoxMatch[1].length > 3) {
    let extracted = poBoxMatch[1].trim();
    extracted = extracted.replace(/[,\-;:]$/, '').trim();
    if (extracted.length > 3) return extracted;
  }

  // Pattern 3: Word boundary before street number
  // "Reynolds American401 N. Main Street" → "Reynolds American"
  // "NC League of Municipalities434Fayetteville Street" → "NC League of Municipalities"
  // Look for: text ending in letter, then 3-5 digit number, then space + letter (street name)
  const wordStreetMatch = firmName.match(/^(.+?[a-zA-Z])(\d{3,5}\s+[A-Z])/i);
  if (wordStreetMatch && wordStreetMatch[1].length > 3) {
    let extracted = wordStreetMatch[1].trim();
    extracted = extracted.replace(/[,\-;:]$/, '').trim();
    if (extracted.length > 3) return extracted;
  }

  // Pattern 4: Shorter street numbers (2+ digits)
  // "John Kapp Law Office105 W. Grayson St." → "John Kapp Law Office"
  const shortStreetMatch = firmName.match(/^(.+?[a-zA-Z])(\d{2,}\s+[A-Z])/i);
  if (shortStreetMatch && shortStreetMatch[1].length > 5) {
    let extracted = shortStreetMatch[1].trim();
    extracted = extracted.replace(/[,\-;:]$/, '').trim();
    if (extracted.length > 5) return extracted;
  }

  // Pattern 5: Contains ZIP code
  const zipMatch = firmName.match(/^(.+?)\b\d{5}(-\d{4})?\b/);
  if (zipMatch && zipMatch[1].length > 5) {
    let extracted = zipMatch[1].trim();
    // Remove trailing city/state/address fragments
    extracted = extracted.replace(/P\.?\s*O\.?\s*Box.*$/i, '').trim();
    extracted = extracted.replace(/[,\-;:]$/, '').trim();
    if (extracted.length > 3 && !/^\d/.test(extracted)) {
      return extracted;
    }
  }

  // Pattern 6: Trailing punctuation only
  if (/[,\-;:]$/.test(firmName)) {
    return firmName.replace(/[,\-;:]+$/, '').trim();
  }

  return null; // Couldn't parse
}

/**
 * Check if firmName needs fixing
 */
function needsFix(firmName) {
  if (!firmName) return false;

  return (
    // Contains ZIP code
    /\b\d{5}(-\d{4})?\b/.test(firmName) ||
    // Contains PO Box
    /P\.?\s*O\.?\s*Box/i.test(firmName) ||
    // Legal suffix followed by uppercase/number (concatenated)
    /(LLC|PLLC|PA|PC|P\.A\.|LLP|Inc)[A-Z0-9]/i.test(firmName) ||
    // Contains Suite/Ste with number
    /\b(Suite|Ste\.?)\s*#?\d+/i.test(firmName) ||
    // Text followed by street number
    /[a-zA-Z]\d{3,5}\s+[A-Z]/i.test(firmName) ||
    // Trailing punctuation
    /[,\-;:]$/.test(firmName)
  );
}

async function fixRecords() {
  console.log('North Carolina Bar Firm Name Fix Script');
  console.log('='.repeat(60));
  console.log(DRY_RUN ? '*** DRY RUN ***\n' : '*** LIVE RUN ***\n');

  const snapshot = await db.collection('preintake_emails')
    .where('source', '==', 'ncbar')
    .get();

  console.log('Total NC Bar records:', snapshot.size);

  const fixes = [];
  const setToEmpty = [];
  const unfixable = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const firmName = data.firmName || '';

    if (needsFix(firmName)) {
      const fixed = extractFirmName(firmName);

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
    console.log('\n--- Unfixable (first 15) ---');
    unfixable.slice(0, 15).forEach((item, i) => {
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
      const batch = db.batch();
      const batchFixes = allFixes.slice(i, i + batchSize);

      for (const fix of batchFixes) {
        const docRef = db.collection('preintake_emails').doc(fix.id);
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
