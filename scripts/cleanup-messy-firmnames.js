#!/usr/bin/env node
/**
 * Clean up messy firmName values by removing:
 * - Phone numbers
 * - Street addresses
 * - City/state/zip
 * - Job titles (Principal, Attorney, Shareholder, etc.)
 * - Year ranges (2005 - Current)
 * - Add spaces to camelCase single words
 *
 * Usage:
 *   DRY_RUN=true node scripts/cleanup-messy-firmnames.js   # Preview changes
 *   node scripts/cleanup-messy-firmnames.js                 # Apply changes
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
}
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Clean up a messy firmName
 * Returns cleaned firmName or null if no changes needed
 */
function cleanFirmName(firmName) {
  if (!firmName || typeof firmName !== 'string') return null;

  let cleaned = firmName.trim();
  const original = cleaned;

  // Remove phone numbers: (xxx) xxx-xxxx or xxx-xxx-xxxx or xxx.xxx.xxxx
  cleaned = cleaned.replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '');

  // Remove street addresses: "123 Main St", "4118 Leonard Drive", etc.
  cleaned = cleaned.replace(/\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Drive|Dr|Road|Rd|Boulevard|Blvd|Way|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[.,]?\s*/gi, '');

  // Remove city, state, zip patterns: "Fairfax, VA 22030" or "Fairfax , VA 22030 US"
  cleaned = cleaned.replace(/[A-Z][a-z]+\s*,?\s*[A-Z]{2}\s*\d{5}(-\d{4})?\s*(US|USA)?/g, '');

  // Remove standalone zip codes
  cleaned = cleaned.replace(/\b\d{5}(-\d{4})?\b/g, '');

  // Remove job title phrases at the beginning
  // "Principal and Attorney The..." -> "The..."
  // "Shareholder at Parker..." -> "Parker..."
  cleaned = cleaned.replace(/^(Principal(\s+and\s+Attorney)?|Shareholder|Partner|Managing\s+Partner|Senior\s+Associate|Associate|Of\s+Counsel)\s+(at\s+|of\s+)?/gi, '');

  // Remove "Shareholder at", "Partner at", etc. mid-string
  cleaned = cleaned.replace(/\b(Shareholder|Partner)\s+(at|of)\s+/gi, '');

  // Remove year ranges: "2005 - Current", "2010 - Present", "1998 - 2020"
  cleaned = cleaned.replace(/\d{4}\s*[-–]\s*(Current|Present|\d{4})/gi, '');

  // Remove trailing punctuation and "US"
  cleaned = cleaned.replace(/\s*US\s*$/i, '');
  cleaned = cleaned.replace(/[,\s]+$/, '');

  // Add spaces to camelCase single words (no existing spaces)
  if (!cleaned.includes(' ') && cleaned.length > 1) {
    // Insert space before capital letters: "TwoRiversLawGroup" -> "Two Rivers Law Group"
    const spaced = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
    if (spaced !== cleaned) {
      cleaned = spaced;
    }
  }

  // Clean up multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Return null if no changes or result is empty/too short
  if (cleaned === original || cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

async function cleanup() {
  console.log('=== Clean Up Messy firmNames ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const snapshot = await db.collection('preintake_emails').get();

  const toClean = [];
  const noChange = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    // Only look at contacts still missing firstName/lastName
    if (!data.firstName && !data.lastName) {
      const cleaned = cleanFirmName(data.firmName);
      if (cleaned) {
        toClean.push({
          id: doc.id,
          original: data.firmName,
          cleaned: cleaned,
          sent: data.sent === true
        });
      } else {
        noChange.push({
          id: doc.id,
          firmName: data.firmName,
          sent: data.sent === true
        });
      }
    }
  });

  console.log(`Total without firstName/lastName: ${toClean.length + noChange.length}`);
  console.log(`Can be cleaned: ${toClean.length}`);
  console.log(`No changes needed: ${noChange.length}\n`);

  if (toClean.length > 0) {
    console.log('--- Changes to Apply ---');
    toClean.forEach((item, i) => {
      const status = item.sent ? '✉️' : '📭';
      console.log(`${(i+1).toString().padStart(3)}. ${status} "${item.original}"`);
      console.log(`     → "${item.cleaned}"\n`);
    });
  }

  if (DRY_RUN) {
    console.log('✅ DRY RUN complete. Run without DRY_RUN=true to apply changes.');
    process.exit(0);
  }

  if (toClean.length === 0) {
    console.log('✅ No firmNames need cleaning.');
    process.exit(0);
  }

  // Apply updates
  console.log('Applying updates to Firestore...');
  const BATCH_SIZE = 500;
  let processed = 0;

  for (let i = 0; i < toClean.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toClean.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const docRef = db.collection('preintake_emails').doc(item.id);
      batch.update(docRef, { firmName: item.cleaned });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  Processed ${processed}/${toClean.length}`);
  }

  console.log(`\n✅ Successfully cleaned ${toClean.length} firmNames!`);

  process.exit(0);
}

cleanup().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
