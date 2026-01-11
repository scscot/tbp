const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

// Target upline_admin UIDs - delete all users with these upline_admin values
const UPLINE_ADMIN_UIDS = [
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
  matchingUplineAdmin: 0,
  markedForDeletion: 0,
  actuallyDeleted: 0,
  authDeleteFailed: 0,
  firestoreDeleteFailed: 0
};

// CSV log data
const deletedUsers = [];

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
 * Delete user from Auth and Firestore users
 */
async function deleteUser(uid, email, _reason) {
  let authDeleted = false;
  let firestoreUserDeleted = false;

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

  if (authDeleted && firestoreUserDeleted) {
    stats.actuallyDeleted++;
  }

  return { authDeleted, firestoreUserDeleted };
}

/**
 * Process users with matching upline_admin for deletion
 */
async function processUsers() {
  console.log('\n🔍 Scanning for users with matching upline_admin...\n');
  console.log(`TARGET upline_admin UIDs: ${UPLINE_ADMIN_UIDS.length}\n`);

  if (isDryRun) {
    console.log('🔒 DRY RUN MODE - No users will be deleted\n');
  } else {
    console.log('⚠️  DELETE MODE - Users will be permanently deleted\n');
  }

  const usersSnapshot = await db.collection('users').get();
  const totalUsers = usersSnapshot.size;

  console.log(`📊 Total user documents in database: ${totalUsers}\n`);

  for (const doc of usersSnapshot.docs) {
    stats.totalScanned++;
    const uid = doc.id;
    const userData = doc.data();
    const uplineAdmin = userData.upline_admin || '';

    if (UPLINE_ADMIN_UIDS.includes(uplineAdmin)) {
      stats.matchingUplineAdmin++;
      stats.markedForDeletion++;

      const email = userData.email || 'no-email';
      const firstName = userData.firstName || '';
      const lastName = userData.lastName || '';
      const level = userData.level || 0;

      const reason = `Has upline_admin: ${uplineAdmin}`;

      console.log(`❌ DELETE: ${email} (level: ${level}, upline_admin: ${uplineAdmin}, uid: ${uid})`);

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

      if (isDelete) {
        await deleteUser(uid, email, reason);
      }
    }

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
    console.log(`Matching upline_admin found:  ${stats.matchingUplineAdmin}`);
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
      console.log(`\n⚠️  ${stats.markedForDeletion} users with matching upline_admin would be deleted.`);
      console.log('Run with --delete to actually delete them (requires confirmation).');
    } else if (isDryRun && stats.markedForDeletion === 0) {
      console.log(`\n✅ No users found with matching upline_admin values.`);
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
    console.log('\n⚠️  WARNING: You are about to permanently delete users with matching upline_admin values!');
    console.log(`This will delete users where upline_admin matches any of ${UPLINE_ADMIN_UIDS.length} target UIDs.`);
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
