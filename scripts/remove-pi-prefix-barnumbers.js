#!/usr/bin/env node
/**
 * Remove PI- prefix from barNumbers in preintake_emails collection
 *
 * Changes: "PI123456" -> "123456"
 *
 * Usage:
 *   DRY_RUN=true node scripts/remove-pi-prefix-barnumbers.js   # Preview changes
 *   node scripts/remove-pi-prefix-barnumbers.js                 # Apply changes
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = process.env.DRY_RUN === 'true';

async function removePIPrefix() {
  console.log('=== Remove PI- Prefix from barNumbers ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Find all barNumbers with PI prefix
  const snapshot = await db.collection('preintake_emails')
    .where('barNumber', '>=', 'PI')
    .where('barNumber', '<', 'PJ')
    .get();

  console.log(`Found ${snapshot.size} documents with PI-prefixed barNumbers\n`);

  if (snapshot.size === 0) {
    console.log('✅ No PI-prefixed barNumbers found.');
    process.exit(0);
  }

  const updates = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const oldBarNumber = data.barNumber;
    const newBarNumber = oldBarNumber.replace(/^PI/, '');
    updates.push({
      id: doc.id,
      oldBarNumber,
      newBarNumber,
      firmName: data.firmName || data.email
    });
  });

  // Show sample updates
  console.log('--- Sample Updates (first 10) ---');
  updates.slice(0, 10).forEach(u => {
    console.log(`  ${u.oldBarNumber} → ${u.newBarNumber} (${u.firmName})`);
  });
  if (updates.length > 10) {
    console.log(`  ... and ${updates.length - 10} more\n`);
  } else {
    console.log();
  }

  if (DRY_RUN) {
    console.log('✅ DRY RUN complete. Run without DRY_RUN=true to apply changes.');
    process.exit(0);
  }

  // Apply updates in batches of 500 (Firestore limit)
  console.log('Applying updates to Firestore...');
  const BATCH_SIZE = 500;
  let processed = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = updates.slice(i, i + BATCH_SIZE);

    for (const update of chunk) {
      const docRef = db.collection('preintake_emails').doc(update.id);
      batch.update(docRef, { barNumber: update.newBarNumber });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  Processed ${processed}/${updates.length}`);
  }

  console.log(`\n✅ Successfully removed PI- prefix from ${updates.length} barNumbers!`);

  // Verify
  console.log('\nVerifying...');
  const verifySnapshot = await db.collection('preintake_emails')
    .where('barNumber', '>=', 'PI')
    .where('barNumber', '<', 'PJ')
    .get();

  console.log(`Remaining PI-prefixed barNumbers: ${verifySnapshot.size}`);

  process.exit(0);
}

removePIPrefix().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
