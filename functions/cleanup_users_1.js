const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Safe level threshold - users with level <= 4 are SAFE
const SAFE_LEVEL = 4;

// Batch size for processing
const _BATCH_SIZE = 100;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isDelete = args.includes('--delete');

if (!isDryRun && !isDelete) {
  console.error('❌ Usage: node cleanup_users.js [--dry-run | --delete]');
  console.error('   --dry-run: Preview what will be deleted (safe)');
  console.error('   --delete:  Actually delete users (requires confirmation)');
  process.exit(1);
}

// Statistics
const stats = {
  totalScanned: 0,
  keptSafeLevel: 0,
  markedForDeletion: 0,
  actuallyDeleted: 0,
  authDeleteFailed: 0,
  firestoreDeleteFailed: 0
};

// CSV log data
const deletedUsers = [];

/**
 * Check if user should be kept (is safe)
 */
function isSafeUser(userData) {
  const level = userData.level || 0;

  // SAFE if level <= 4
  const isSafeLevel = level <= SAFE_LEVEL;

  return {
    safe: isSafeLevel,
    isSafeLevel,
    level
  };
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Save deleted users to CSV
 */
function saveToCSV() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `deleted_users_${timestamp}.csv`;

  const header = 'UID,Email,FirstName,LastName,Level,UplineRefs,CreatedAt,Reason\n';
  const rows = deletedUsers.map(user => {
    const uplineRefs = (user.upline_refs || []).join('|');
    return `"${user.uid}","${user.email}","${user.firstName}","${user.lastName}","${user.level}","${uplineRefs}","${user.createdAt}","${user.reason}"`;
  }).join('\n');

  fs.writeFileSync(filename, header + rows);
  console.log(`\n📄 Deleted users log saved to: ${filename}`);
}

/**
 * Delete user from Auth and Firestore
 */
async function deleteUser(uid, email, _reason) {
  let authDeleted = false;
  let firestoreDeleted = false;

  // Delete from Firebase Auth
  try {
    await auth.deleteUser(uid);
    authDeleted = true;
  } catch (error) {
    console.error(`   ❌ Failed to delete auth for ${email}: ${error.message}`);
    stats.authDeleteFailed++;
  }

  // Delete from Firestore
  try {
    await db.collection('users').doc(uid).delete();
    firestoreDeleted = true;
  } catch (error) {
    console.error(`   ❌ Failed to delete Firestore doc for ${email}: ${error.message}`);
    stats.firestoreDeleteFailed++;
  }

  if (authDeleted && firestoreDeleted) {
    stats.actuallyDeleted++;
  }

  return { authDeleted, firestoreDeleted };
}

/**
 * Process users in batches
 */
async function processUsers() {
  console.log('\n🔍 Starting user scan...\n');
  console.log('SAFE CRITERIA (users will be KEPT):');
  console.log(`   - level ≤ ${SAFE_LEVEL}\n`);
  console.log('DELETION CRITERIA (users will be DELETED):');
  console.log(`   - level > ${SAFE_LEVEL}\n`);

  if (isDryRun) {
    console.log('🔒 DRY RUN MODE - No users will be deleted\n');
  } else {
    console.log('⚠️  DELETE MODE - Users will be permanently deleted\n');
  }

  // Fetch all users
  const usersSnapshot = await db.collection('users').get();
  const totalUsers = usersSnapshot.size;

  console.log(`📊 Total users in database: ${totalUsers}\n`);

  // Process each user
  for (const doc of usersSnapshot.docs) {
    stats.totalScanned++;
    const userData = doc.data();
    const uid = doc.id;
    const email = userData.email || 'no-email';
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';

    const { safe, isSafeLevel: _isSafeLevel, level } = isSafeUser(userData);

    if (safe) {
      // User is safe - keep them
      stats.keptSafeLevel++;
    } else {
      // User should be deleted
      const reason = `level > ${SAFE_LEVEL} (level=${level})`;
      stats.markedForDeletion++;

      console.log(`❌ DELETE: ${email} (level: ${level}, uid: ${uid})`);

      deletedUsers.push({
        uid,
        email,
        firstName,
        lastName,
        level,
        upline_refs: userData.upline_refs,
        createdAt: userData.createdAt?.toDate?.()?.toISOString() || 'unknown',
        reason
      });

      // Actually delete if not in dry-run mode
      if (isDelete) {
        await deleteUser(uid, email, reason);
      }
    }

    // Progress indicator
    if (stats.totalScanned % 50 === 0) {
      console.log(`\n📈 Progress: ${stats.totalScanned}/${totalUsers} users scanned\n`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await processUsers();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users scanned:          ${stats.totalScanned}`);
    console.log(`Kept (level ≤ ${SAFE_LEVEL}):            ${stats.keptSafeLevel}`);
    console.log(`Marked for deletion:          ${stats.markedForDeletion}`);

    if (isDelete) {
      console.log(`Actually deleted:             ${stats.actuallyDeleted}`);
      console.log(`Auth deletion failed:         ${stats.authDeleteFailed}`);
      console.log(`Firestore deletion failed:    ${stats.firestoreDeleteFailed}`);
    }
    console.log('='.repeat(60));

    // Save CSV if users were marked for deletion
    if (deletedUsers.length > 0) {
      saveToCSV();
    }

    if (isDryRun && stats.markedForDeletion > 0) {
      console.log(`\n⚠️  ${stats.markedForDeletion} users would be deleted.`);
      console.log('Run with --delete to actually delete them (requires confirmation).');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run with confirmation if in delete mode
if (isDelete) {
  (async () => {
    console.log('\n⚠️  WARNING: You are about to permanently delete users!');
    console.log('This action CANNOT be undone.\n');

    const confirmed = await askConfirmation('Type "yes" to confirm deletion: ');

    if (!confirmed) {
      console.log('❌ Deletion cancelled.');
      process.exit(0);
    }

    console.log('✅ Confirmed. Starting deletion...\n');
    await main();
  })();
} else {
  main();
}
