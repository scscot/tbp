#!/usr/bin/env node

/**
 * One-time script to update all users with role=='user' to userType: 'prospect'
 *
 * Usage:
 *   node scripts/update-users-to-prospect.js --dry-run    # Preview changes
 *   node scripts/update-users-to-prospect.js              # Execute updates
 */

const path = require('path');

// Resolve firebase-admin from functions directory
const functionsDir = path.join(__dirname, '../functions');
const admin = require(path.join(functionsDir, 'node_modules/firebase-admin'));

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

async function updateUsersToProspect(dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Update Users to Prospect - ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Query all users with role == 'user'
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'user')
      .get();

    console.log(`Found ${usersSnapshot.size} users with role=='user'\n`);

    if (usersSnapshot.empty) {
      console.log('No users to update.');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const currentUserType = data.userType;

      // Skip if already set to 'prospect'
      if (currentUserType === 'prospect') {
        console.log(`SKIP: ${doc.id} (${data.email || 'no email'}) - already prospect`);
        skippedCount++;
        continue;
      }

      console.log(`UPDATE: ${doc.id} (${data.email || 'no email'}) - userType: "${currentUserType || 'undefined'}" → "prospect"`);

      if (!dryRun) {
        try {
          await db.collection('users').doc(doc.id).update({
            userType: 'prospect',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updatedCount++;
        } catch (err) {
          console.error(`  ERROR updating ${doc.id}: ${err.message}`);
          errorCount++;
        }
      } else {
        updatedCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary:');
    console.log(`  Total users found: ${usersSnapshot.size}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped (already prospect): ${skippedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

    if (dryRun) {
      console.log('This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to apply changes.\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

updateUsersToProspect(dryRun).then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
