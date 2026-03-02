#!/usr/bin/env node

/**
 * Recalculate directSponsorCount and totalTeamCount for all users
 * based on actual team membership data
 *
 * Usage:
 *   node scripts/recalculate-team-counts.js --dry-run    # Preview changes
 *   node scripts/recalculate-team-counts.js              # Execute updates
 *   node scripts/recalculate-team-counts.js --uid=ABC    # Update specific user
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

async function recalculateTeamCounts(dryRun = false, specificUid = null) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Recalculate Team Counts - ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get all users
    let usersQuery = db.collection('users');
    if (specificUid) {
      console.log(`Processing specific user: ${specificUid}\n`);
    }

    const usersSnapshot = await usersQuery.get();
    console.log(`Found ${usersSnapshot.size} total users\n`);

    // Build a map of sponsor_id -> count (for directSponsorCount)
    // Build a map of upline_refs member -> count (for totalTeamCount)
    const directCounts = {};
    const totalCounts = {};

    // First pass: count team members
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const sponsorId = data.sponsor_id;
      const uplineRefs = data.upline_refs || [];

      // Count direct sponsors
      if (sponsorId) {
        directCounts[sponsorId] = (directCounts[sponsorId] || 0) + 1;
      }

      // Count total team (everyone in upline_refs gets +1)
      for (const uplineMemberId of uplineRefs) {
        totalCounts[uplineMemberId] = (totalCounts[uplineMemberId] || 0) + 1;
      }
    }

    // Second pass: update users with correct counts
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of usersSnapshot.docs) {
      const uid = doc.id;

      // Skip if we're only processing a specific user
      if (specificUid && uid !== specificUid) {
        continue;
      }

      const data = doc.data();
      const currentDirect = data.directSponsorCount || 0;
      const currentTotal = data.totalTeamCount || 0;
      const calculatedDirect = directCounts[uid] || 0;
      const calculatedTotal = totalCounts[uid] || 0;

      // Check if update is needed
      if (currentDirect === calculatedDirect && currentTotal === calculatedTotal) {
        if (specificUid) {
          console.log(`SKIP: ${uid} (${data.email || 'no email'}) - counts already correct (direct: ${currentDirect}, total: ${currentTotal})`);
        }
        skippedCount++;
        continue;
      }

      console.log(`UPDATE: ${uid} (${data.email || 'no email'})`);
      console.log(`  directSponsorCount: ${currentDirect} → ${calculatedDirect}`);
      console.log(`  totalTeamCount: ${currentTotal} → ${calculatedTotal}`);

      if (!dryRun) {
        try {
          await db.collection('users').doc(uid).update({
            directSponsorCount: calculatedDirect,
            totalTeamCount: calculatedTotal,
            countsRecalculatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          updatedCount++;
        } catch (err) {
          console.error(`  ERROR updating ${uid}: ${err.message}`);
          errorCount++;
        }
      } else {
        updatedCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Summary:');
    console.log(`  Total users: ${specificUid ? 1 : usersSnapshot.size}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped (already correct): ${skippedCount}`);
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
const uidArg = args.find(a => a.startsWith('--uid='));
const specificUid = uidArg ? uidArg.split('=')[1] : null;

recalculateTeamCounts(dryRun, specificUid).then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
