#!/usr/bin/env node

/**
 * HTTP Client to call recalculateTeamCounts with dryRun: true
 *
 * Usage: node call-recalculate-dryrun.js
 *
 * This script uses the Firebase Admin SDK to get an auth token
 * and calls the deployed Cloud Function via HTTPS.
 */

const admin = require('firebase-admin');

admin.initializeApp();

const SUPER_ADMIN_UID = 'KJ8uFnlhKhWgBa4NVcwT';
const FUNCTION_URL = 'https://us-central1-teambuildpro-6.cloudfunctions.net/recalculateTeamCounts';

async function callDryRun() {
  console.log('🔒 Calling recalculateTeamCounts in DRY RUN mode...\n');

  try {
    const customToken = await admin.auth().createCustomToken(SUPER_ADMIN_UID);
    const idToken = await exchangeCustomTokenForIdToken(customToken);

    console.log('✅ Authenticated as super admin');
    console.log(`📡 Calling function: ${FUNCTION_URL}\n`);

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        data: { dryRun: true }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('✅ DRY RUN COMPLETED SUCCESSFULLY\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(JSON.stringify(result.result.summary, null, 2));
    console.log('\n' + result.result.message);

    if (result.result.summary.deletedUsers?.length > 0) {
      console.log('\n🗑️ USERS THAT WOULD BE DELETED:');
      console.log('───────────────────────────────────────────────────────');
      result.result.summary.deletedUsers.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.email} (${user.uid})`);
        console.log(`   Reason: ${user.reason}\n`);
      });
    }

    console.log('\n💡 To execute for real, change dryRun to false');
    console.log('⚠️  WARNING: This will permanently delete orphaned users!\n');

  } catch (error) {
    console.error('\n❌ CALL FAILED:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

async function exchangeCustomTokenForIdToken(customToken) {
  const firebaseApiKey = 'AIzaSyC8TjgR88cRPFAqVi3zQYS_5E3F_a5RRUA';

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to exchange custom token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.idToken;
}

callDryRun();
