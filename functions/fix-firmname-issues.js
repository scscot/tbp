#!/usr/bin/env node
/**
 * Fix firmName issues found in audit
 */

const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = !process.argv.includes('--run');

async function fix() {
  console.log('=== FirmName Issues Fix ===');
  console.log(DRY_RUN ? '*** DRY RUN ***\n' : '*** LIVE RUN ***\n');

  const snapshot = await db.collection('preintake_emails').get();

  const toClear = [];
  const toTrim = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const fn = data.firmName;
    if (!fn || fn.trim() === '') return;

    const trimmed = fn.trim();

    // Clear these completely (not valid firm names)
    if (
      /^N\/A$/i.test(trimmed) ||                      // N/A
      /@/.test(fn) && /\.(com|net|org|edu)/i.test(fn) || // Email addresses
      /^https?:\/\//i.test(fn) ||                     // URLs
      /^\d+$/.test(trimmed) ||                        // Just numbers
      /^\d{3}[-.]\d{3}[-.]\d{4}$/.test(trimmed) ||   // Phone numbers
      /^\d+\s+[A-Za-z]/.test(fn)                      // Street addresses (123 Main St)
    ) {
      toClear.push({ id: doc.id, firmName: fn, source: data.source });
    }
    // Trim trailing punctuation
    else if (/[,\-;:]$/.test(trimmed)) {
      const fixed = trimmed.replace(/[,\-;:]+$/, '').trim();
      if (fixed !== trimmed) {
        toTrim.push({ id: doc.id, firmName: fn, fixed, source: data.source });
      }
    }
  });

  console.log('=== TO CLEAR (set to empty) ===');
  console.log('Count:', toClear.length);
  toClear.forEach(e => console.log(`  [${e.source}] "${e.firmName}"`));

  console.log('\n=== TO FIX (trim punctuation) ===');
  console.log('Count:', toTrim.length);
  toTrim.slice(0, 15).forEach(e => console.log(`  "${e.firmName}" → "${e.fixed}"`));
  if (toTrim.length > 15) console.log(`  ... and ${toTrim.length - 15} more`);

  if (!DRY_RUN) {
    console.log('\n--- Applying fixes ---');

    const allFixes = [
      ...toClear.map(e => ({ id: e.id, firmName: '' })),
      ...toTrim.map(e => ({ id: e.id, firmName: e.fixed }))
    ];

    const batchSize = 500;
    let fixed = 0;

    for (let i = 0; i < allFixes.length; i += batchSize) {
      const batch = db.batch();
      const batchFixes = allFixes.slice(i, i + batchSize);

      for (const fix of batchFixes) {
        batch.update(db.collection('preintake_emails').doc(fix.id), { firmName: fix.firmName });
      }

      await batch.commit();
      fixed += batchFixes.length;
      console.log(`Fixed: ${fixed} / ${allFixes.length}`);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
