const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const _auth = admin.auth();

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
  emptyDocuments: 0,
  nonEmptyDocuments: 0,
  markedForDeletion: 0,
  actuallyDeleted: 0,
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
 * Check if a user document is empty or contains no meaningful data
 */
function isEmptyDocument(userData) {
  if (!userData || typeof userData !== 'object') {
    return true;
  }

  const keys = Object.keys(userData);

  if (keys.length === 0) {
    return true;
  }

  const hasEmail = userData.email && userData.email.trim() !== '';
  const hasFirstName = userData.firstName && userData.firstName.trim() !== '';
  const hasLastName = userData.lastName && userData.lastName.trim() !== '';

  return !hasEmail && !hasFirstName && !hasLastName;
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
 * Delete empty user document from Firestore
 */
async function deleteEmptyUserDocument(uid) {
  try {
    await db.collection('users').doc(uid).delete();
    stats.actuallyDeleted++;
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to delete user doc ${uid}: ${error.message}`);
    stats.firestoreDeleteFailed++;
    return false;
  }
}

/**
 * Process all users and delete empty documents
 */
async function processUsers() {
  console.log('\n🔍 Scanning for empty user documents...\n');

  if (isDryRun) {
    console.log('🔒 DRY RUN MODE - No users will be deleted\n');
  } else {
    console.log('⚠️  DELETE MODE - Empty documents will be permanently deleted\n');
  }

  const usersSnapshot = await db.collection('users').get();
  const totalUsers = usersSnapshot.size;

  console.log(`📊 Total user documents in database: ${totalUsers}\n`);

  for (const doc of usersSnapshot.docs) {
    stats.totalScanned++;
    const uid = doc.id;
    const userData = doc.data();

    if (isEmptyDocument(userData)) {
      stats.emptyDocuments++;
      stats.markedForDeletion++;

      const email = userData?.email || 'no-email';
      const firstName = userData?.firstName || '';
      const lastName = userData?.lastName || '';

      console.log(`❌ EMPTY DOCUMENT: ${uid} (email: ${email || 'none'})`);

      deletedUsers.push({
        uid,
        email,
        firstName,
        lastName,
        level: 0,
        upline_refs: userData?.upline_refs || [],
        createdAt: userData?.createdAt?.toDate?.()?.toISOString() || 'unknown',
        reason: 'Empty document - no meaningful data'
      });

      if (isDelete) {
        await deleteEmptyUserDocument(uid);
      }
    } else {
      stats.nonEmptyDocuments++;
    }

    if (stats.totalScanned % 50 === 0) {
      console.log(`\n📈 Progress: ${stats.totalScanned}/${totalUsers} documents scanned\n`);
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
    console.log(`Total documents scanned:      ${stats.totalScanned}`);
    console.log(`Empty documents found:        ${stats.emptyDocuments}`);
    console.log(`Non-empty documents:          ${stats.nonEmptyDocuments}`);
    console.log(`Marked for deletion:          ${stats.markedForDeletion}`);

    if (isDelete) {
      console.log(`Actually deleted:             ${stats.actuallyDeleted}`);
      console.log(`Deletion failed:              ${stats.firestoreDeleteFailed}`);
    }
    console.log('='.repeat(60));

    // Save CSV if users were marked for deletion
    if (deletedUsers.length > 0) {
      saveToCSV();
    }

    if (isDryRun && stats.markedForDeletion > 0) {
      console.log(`\n⚠️  ${stats.markedForDeletion} empty user documents would be deleted.`);
      console.log('Run with --delete to actually delete them (requires confirmation).');
    } else if (isDryRun && stats.markedForDeletion === 0) {
      console.log(`\n✅ No empty user documents found. Database is clean!`);
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
    console.log('\n⚠️  WARNING: You are about to permanently delete empty user documents!');
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
