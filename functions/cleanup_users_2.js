const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Target UIDs to DELETE
const TARGET_UIDS = [
  'CXefvRnFZMZ6JyGPDe5Fw56u6dl1',
  'E9AuHMGRwXh8tKp64nvUBwl0YFD3',
  'LTLeAkWvEvfAMYt9jQzZIA5fKmH3',
  'QJWTPaWLnGQA1aVlzuyL7s8DT7g2',
  'SSfueeRLIhOAsJ7H9zoYVP6MvF13',
  'Vy4mKZC60jRPug8Lf9mLwwwJqj53',
  'X64tWY9OFqdg3KAu0ScKioX0X9k2',
  'jD1PovQ8Dhhbjt2pxVLo2GdfyGH3',
  't41DgUG5IVPx3bUP3im08h5KSmf2'
];

// Batch size for processing
const BATCH_SIZE = 100;

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
let stats = {
  totalScanned: 0,
  markedForDeletion: 0,
  actuallyDeleted: 0,
  authDeleteFailed: 0,
  firestoreDeleteFailed: 0,
  adminSettingsDeleteFailed: 0
};

// CSV log data
let deletedUsers = [];

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
 * Delete user from Auth, Firestore users, and admin_settings
 */
async function deleteUser(uid, email, reason) {
  let authDeleted = false;
  let firestoreUserDeleted = false;
  let adminSettingsDeleted = false;

  // Delete from Firebase Auth
  try {
    await auth.deleteUser(uid);
    authDeleted = true;
  } catch (error) {
    console.error(`   ❌ Failed to delete auth for ${email}: ${error.message}`);
    stats.authDeleteFailed++;
  }

  // Delete from Firestore users collection
  try {
    await db.collection('users').doc(uid).delete();
    firestoreUserDeleted = true;
  } catch (error) {
    console.error(`   ❌ Failed to delete users doc for ${email}: ${error.message}`);
    stats.firestoreDeleteFailed++;
  }

  // Delete from admin_settings collection
  try {
    await db.collection('admin_settings').doc(uid).delete();
    adminSettingsDeleted = true;
  } catch (error) {
    console.error(`   ❌ Failed to delete admin_settings for ${email}: ${error.message}`);
    stats.adminSettingsDeleteFailed++;
  }

  if (authDeleted && firestoreUserDeleted && adminSettingsDeleted) {
    stats.actuallyDeleted++;
  }

  return { authDeleted, firestoreUserDeleted, adminSettingsDeleted };
}

/**
 * Process targeted users for deletion
 */
async function processUsers() {
  console.log('\n🔍 Starting targeted user deletion...\n');
  console.log(`TARGET UIDs to DELETE: ${TARGET_UIDS.length} users\n`);

  if (isDryRun) {
    console.log('🔒 DRY RUN MODE - No users will be deleted\n');
  } else {
    console.log('⚠️  DELETE MODE - Users will be permanently deleted\n');
  }

  // Process each target UID
  for (const uid of TARGET_UIDS) {
    stats.totalScanned++;

    // Fetch user data
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.log(`⚠️  User not found: ${uid}`);
      continue;
    }

    const userData = userDoc.data();
    const email = userData.email || 'no-email';
    const firstName = userData.firstName || '';
    const lastName = userData.lastName || '';
    const level = userData.level || 0;

    const reason = 'Targeted deletion (UID in deletion list)';
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
    console.log(`Total target UIDs:            ${TARGET_UIDS.length}`);
    console.log(`UIDs processed:               ${stats.totalScanned}`);
    console.log(`Marked for deletion:          ${stats.markedForDeletion}`);

    if (isDelete) {
      console.log(`Actually deleted:             ${stats.actuallyDeleted}`);
      console.log(`Auth deletion failed:         ${stats.authDeleteFailed}`);
      console.log(`Firestore deletion failed:    ${stats.firestoreDeleteFailed}`);
      console.log(`Admin settings delete failed: ${stats.adminSettingsDeleteFailed}`);
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
