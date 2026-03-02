#!/usr/bin/env node

/**
 * Fix subscription status for existing Prospect users
 *
 * Prospects (role=='user' OR userType=='prospect') should have:
 * - subscriptionStatus: 'prospect_free' (NOT 'trial' or 'expired')
 * - trialStartDate: null (prospects don't have a trial period)
 * - milestoneReached: false (unless they've actually hit 3+12)
 *
 * Usage:
 *   node scripts/fix-prospect-subscription-status.js --dry-run    # Preview changes
 *   node scripts/fix-prospect-subscription-status.js              # Execute updates
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

async function fixProspectSubscriptionStatus(dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fix Prospect Subscription Status - ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Query all users - we need to check both role and userType
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} total users\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let notProspectCount = 0;

    for (const doc of usersSnapshot.docs) {
      const uid = doc.id;
      const data = doc.data();

      // Determine if user is a prospect
      // Prospects have: role=='user' AND/OR userType=='prospect'
      const isProspect = data.role === 'user' || data.userType === 'prospect';

      if (!isProspect) {
        notProspectCount++;
        continue;
      }

      const currentStatus = data.subscriptionStatus;
      const currentTrialStartDate = data.trialStartDate;
      const currentMilestoneReached = data.milestoneReached;

      // Check if already correct
      const statusCorrect = currentStatus === 'prospect_free';
      const trialDateCorrect = currentTrialStartDate === null || currentTrialStartDate === undefined;
      const milestoneCorrect = currentMilestoneReached === false || currentMilestoneReached === true;

      if (statusCorrect && trialDateCorrect && milestoneCorrect) {
        console.log(`SKIP: ${uid} (${data.email || 'no email'}) - already correct`);
        skippedCount++;
        continue;
      }

      console.log(`UPDATE: ${uid} (${data.email || 'no email'})`);
      console.log(`  role: ${data.role}, userType: ${data.userType}`);
      console.log(`  subscriptionStatus: ${currentStatus} → prospect_free`);
      if (currentTrialStartDate) {
        console.log(`  trialStartDate: ${currentTrialStartDate?.toDate?.()} → null`);
      }
      if (currentMilestoneReached === undefined) {
        console.log(`  milestoneReached: undefined → false`);
      }

      if (!dryRun) {
        try {
          const updateData = {
            subscriptionStatus: 'prospect_free',
            trialStartDate: admin.firestore.FieldValue.delete(),
            prospectStatusFixedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          // Only set milestoneReached if it's undefined
          if (currentMilestoneReached === undefined) {
            updateData.milestoneReached = false;
          }

          await db.collection('users').doc(uid).update(updateData);
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
    console.log(`  Total users: ${usersSnapshot.size}`);
    console.log(`  Not prospects (skipped): ${notProspectCount}`);
    console.log(`  Prospects updated: ${updatedCount}`);
    console.log(`  Prospects already correct: ${skippedCount}`);
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

fixProspectSubscriptionStatus(dryRun).then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
