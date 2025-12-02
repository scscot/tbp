/**
 * Mark Permanent Failures Script
 *
 * Marks contacts as permanently failed (hard bounces) so they won't be retried.
 * Use this for emails that:
 * - Don't exist (550 5.1.1)
 * - Are blocked/rejected (550 Access denied)
 * - Failed spam filters permanently
 *
 * Usage:
 *   node mark-permanent-failures.js
 *   node mark-permanent-failures.js --csv /path/to/mailgun-export.csv
 *   node mark-permanent-failures.js --emails email1@test.com,email2@test.com
 */

const admin = require('firebase-admin');
const fs = require('fs');

admin.initializeApp({
  projectId: 'teambuilder-plus-fe74d'
});

const db = admin.firestore();

// Default list of permanently failed emails (hard bounces from recent analysis)
const DEFAULT_PERMANENT_FAILURES = [
  'lennebacker1@gmail.com',      // 550 - Account does not exist
  'leeanne@livebig.com.au',      // 550 - Access denied (blocked)
  'cdsilence@cablelynx.com',     // 550 - Blocked by spam filter
];

async function markPermanentFailures(emails) {
  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
  const contactsYahooRef = db.collection('emailCampaigns').doc('master').collection('contacts_yahoo');

  let markedCount = 0;
  let notFoundCount = 0;
  let alreadyMarkedCount = 0;

  console.log('🚫 Marking permanent failures...\n');

  for (const email of emails) {
    try {
      // Check main contacts collection
      let querySnapshot = await contactsRef.where('email', '==', email).limit(1).get();
      let collection = 'contacts';

      // If not in main, check yahoo collection
      if (querySnapshot.empty) {
        querySnapshot = await contactsYahooRef.where('email', '==', email).limit(1).get();
        collection = 'contacts_yahoo';
      }

      if (querySnapshot.empty) {
        console.log(`⚠️  Not found: ${email}`);
        notFoundCount++;
        continue;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      if (data.permanentFailure === true) {
        console.log(`✓  Already marked: ${email}`);
        alreadyMarkedCount++;
        continue;
      }

      await doc.ref.update({
        sent: true,
        permanentFailure: true,
        status: 'permanent_failure',
        failureReason: 'hard_bounce',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`🚫 Marked as permanent failure (${collection}): ${email}`);
      markedCount++;

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error processing ${email}: ${error.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total emails processed: ${emails.length}`);
  console.log(`   Marked as permanent failure: ${markedCount}`);
  console.log(`   Already marked (skipped): ${alreadyMarkedCount}`);
  console.log(`   Not found in database: ${notFoundCount}`);
  console.log(`\n✅ Complete!`);
}

async function extractPermanentFailuresFromCSV(csvPath) {
  console.log(`📄 Reading CSV: ${csvPath}\n`);

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');

  // Find column indices
  const eventIdx = headers.indexOf('event');
  const severityIdx = headers.indexOf('severity');
  const recipientIdx = headers.indexOf('recipient');
  const codeIdx = headers.indexOf('deliveryStatus.code');
  const bounceTypeIdx = headers.indexOf('deliveryStatus.bounceType');

  const permanentFailures = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',');
    const event = columns[eventIdx];
    const severity = columns[severityIdx];
    const code = columns[codeIdx];
    const bounceType = columns[bounceTypeIdx];
    const recipient = columns[recipientIdx];

    // Only mark permanent failures (hard bounces)
    if (event === 'failed' && severity === 'permanent') {
      if (recipient && recipient.includes('@')) {
        permanentFailures.add(recipient.trim());
        console.log(`Found permanent failure: ${recipient} (code: ${code}, type: ${bounceType})`);
      }
    }
  }

  return Array.from(permanentFailures);
}

async function main() {
  const args = process.argv.slice(2);
  let emails = [];

  if (args.includes('--csv')) {
    const csvIndex = args.indexOf('--csv');
    const csvPath = args[csvIndex + 1];
    if (!csvPath || !fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      process.exit(1);
    }
    emails = await extractPermanentFailuresFromCSV(csvPath);
  } else if (args.includes('--emails')) {
    const emailsIndex = args.indexOf('--emails');
    const emailList = args[emailsIndex + 1];
    emails = emailList.split(',').map(e => e.trim());
  } else {
    console.log('Using default permanent failures list...\n');
    emails = DEFAULT_PERMANENT_FAILURES;
  }

  if (emails.length === 0) {
    console.log('No permanent failures to process.');
    process.exit(0);
  }

  await markPermanentFailures(emails);
  process.exit(0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
