#!/usr/bin/env node
/**
 * Backfill barNumbers for preintake_emails contacts that don't have one
 *
 * Generates unique 6-digit barNumbers (prefixed with 'PI' for PreIntake-generated)
 * Format: PI + 6 random digits = "PI123456"
 *
 * Usage:
 *   DRY_RUN=true node scripts/backfill-barnumbers.js   # Preview changes
 *   node scripts/backfill-barnumbers.js                 # Apply changes
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Generate a unique 6-digit barNumber with PI prefix
 * Format: PI + 6 digits (e.g., "PI847293")
 */
function generateBarNumber() {
  const digits = Math.floor(100000 + Math.random() * 900000); // 100000-999999
  return `PI${digits}`;
}

async function backfillBarNumbers() {
  console.log('=== Backfill barNumbers for preintake_emails ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Get all existing barNumbers to avoid collisions
  console.log('Fetching existing barNumbers...');
  const allDocsSnapshot = await db.collection('preintake_emails').get();

  const existingBarNumbers = new Set();
  const docsToUpdate = [];

  allDocsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.barNumber) {
      existingBarNumbers.add(data.barNumber);
    } else {
      docsToUpdate.push({ id: doc.id, data });
    }
  });

  console.log(`Total documents: ${allDocsSnapshot.size}`);
  console.log(`With barNumber: ${existingBarNumbers.size}`);
  console.log(`Need barNumber: ${docsToUpdate.length}\n`);

  if (docsToUpdate.length === 0) {
    console.log('✅ All documents already have barNumbers!');
    process.exit(0);
  }

  // Generate unique barNumbers for each document
  console.log('Generating unique barNumbers...\n');
  const updates = [];

  for (const doc of docsToUpdate) {
    let barNumber;
    let attempts = 0;

    // Keep generating until we get a unique one
    do {
      barNumber = generateBarNumber();
      attempts++;
      if (attempts > 100) {
        console.error(`Failed to generate unique barNumber after 100 attempts for ${doc.id}`);
        process.exit(1);
      }
    } while (existingBarNumbers.has(barNumber));

    existingBarNumbers.add(barNumber); // Mark as used
    updates.push({ id: doc.id, barNumber, firmName: doc.data.firmName });
  }

  // Show sample updates
  console.log('--- Sample Updates (first 10) ---');
  updates.slice(0, 10).forEach(u => {
    console.log(`  ${u.id}: ${u.barNumber} (${u.firmName})`);
  });
  console.log(`  ... and ${updates.length - 10} more\n`);

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
      batch.update(docRef, { barNumber: update.barNumber });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  Processed ${processed}/${updates.length}`);
  }

  console.log(`\n✅ Successfully added barNumbers to ${updates.length} documents!`);

  // Verify
  console.log('\nVerifying...');
  const verifySnapshot = await db.collection('preintake_emails')
    .where('barNumber', '>=', 'PI')
    .where('barNumber', '<', 'PJ')
    .get();

  console.log(`Documents with PI-prefixed barNumber: ${verifySnapshot.size}`);

  process.exit(0);
}

backfillBarNumbers().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
