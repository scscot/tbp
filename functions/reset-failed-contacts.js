const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  projectId: 'teambuilder-plus-fe74d'
});

const db = admin.firestore();

async function resetFailedContacts() {
  const csvPath = '/Users/sscott/Downloads/exported-logs-11-20-2025-3-26-15-PM-to-11-21-2025-3-26-15-PM.csv';

  console.log('📧 Reading failed emails from Mailgun export...');

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n');

  const emailSet = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(',');
    const emailColumn = columns[32];

    if (emailColumn && emailColumn.includes('@')) {
      emailSet.add(emailColumn.trim());
    }
  }

  const emails = Array.from(emailSet);
  console.log(`\n📊 Found ${emails.length} unique email addresses to reset`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

  let resetCount = 0;
  let notFoundCount = 0;
  let alreadyUnsentCount = 0;

  console.log('\n🔄 Starting Firestore reset process...\n');

  for (const email of emails) {
    try {
      const querySnapshot = await contactsRef.where('email', '==', email).limit(1).get();

      if (querySnapshot.empty) {
        console.log(`⚠️  Not found: ${email}`);
        notFoundCount++;
        continue;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      if (data.sent === false) {
        console.log(`✓  Already unsent: ${email}`);
        alreadyUnsentCount++;
        continue;
      }

      await doc.ref.update({
        sent: false,
        status: 'pending',
        errorMessage: '',
        sentTimestamp: null,
        batchId: '',
        mailgunId: ''
      });

      console.log(`✅ Reset: ${email}`);
      resetCount++;

      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Error processing ${email}: ${error.message}`);
    }
  }

  console.log(`\n📊 Reset Summary:`);
  console.log(`   Total emails processed: ${emails.length}`);
  console.log(`   Successfully reset: ${resetCount}`);
  console.log(`   Already unsent (skipped): ${alreadyUnsentCount}`);
  console.log(`   Not found in database: ${notFoundCount}`);
  console.log(`\n✅ Reset process complete!`);

  process.exit(0);
}

resetFailedContacts().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
