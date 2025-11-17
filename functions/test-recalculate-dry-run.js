#!/usr/bin/env node

/**
 * Test script to execute recalculateTeamCounts in DRY RUN mode
 *
 * Usage: node test-recalculate-dry-run.js
 *
 * This will call the Cloud Function locally with dryRun: true
 * to preview what changes would be made WITHOUT actually making them.
 */

async function testDryRun() {
  console.log('🔒 Starting DRY RUN test of recalculateTeamCounts...\n');

  try {
    // Import the function (this will initialize Firebase Admin automatically)
    const { recalculateTeamCounts } = require('./analytics-functions');

    // Create mock request with super admin context
    // IMPORTANT: This UID must be a super admin (level: 0) in your database
    const SUPER_ADMIN_UID = 'KJ8uFnlhKhWgBa4NVcwT';

    const mockRequest = {
      auth: {
        uid: SUPER_ADMIN_UID,
      },
      data: {
        dryRun: true,
      },
    };

    console.log(`📋 Calling recalculateTeamCounts with dryRun: true`);
    console.log(`👤 Authenticated as: ${SUPER_ADMIN_UID}\n`);

    const result = await recalculateTeamCounts(mockRequest);

    console.log('\n✅ DRY RUN COMPLETED SUCCESSFULLY\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(JSON.stringify(result.summary, null, 2));
    console.log('\n' + result.message);

    if (result.summary.deletedUsers?.length > 0) {
      console.log('\n🗑️ USERS THAT WOULD BE DELETED:');
      console.log('───────────────────────────────────────────────────────');
      result.summary.deletedUsers.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.email} (${user.uid})`);
        console.log(`   Reason: ${user.reason}\n`);
      });
    }

    console.log('\n💡 To execute for real, run with dryRun: false');
    console.log('⚠️  WARNING: This will permanently delete orphaned users!\n');

  } catch (error) {
    console.error('\n❌ DRY RUN FAILED:', error.message);
    if (error.code === 'permission-denied') {
      console.error('\n🔐 Permission denied. Make sure the UID is a super admin (level: 0)');
    }
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testDryRun();
