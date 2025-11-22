const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');
const fs = require('fs');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetFailedBatch() {
  // Read the email list from the file created by awk
  const emailListPath = '/tmp/failed_emails_from_mailgun.txt';
  const failedEmails = fs.readFileSync(emailListPath, 'utf8')
    .split('\n')
    .map(email => email.trim())
    .filter(email => email.length > 0);

  console.log(`🔄 Starting reset for ${failedEmails.length} contacts from failed 6pm batch`);

  const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const email of failedEmails) {
    try {
      // Query for the contact by email
      const querySnapshot = await contactsRef.where('email', '==', email).limit(1).get();

      if (querySnapshot.empty) {
        console.log(`⚠️  Contact not found: ${email}`);
        notFound++;
        continue;
      }

      const doc = querySnapshot.docs[0];
      const currentData = doc.data();

      // Update the document to reset to unsent state
      await doc.ref.update({
        sent: false,
        sentTimestamp: admin.firestore.FieldValue.delete(),
        status: 'pending',
        errorMessage: '',
        mailgunId: ''
      });

      console.log(`✅ Reset: ${email} (was: ${currentData.status})`);
      updated++;

    } catch (error) {
      console.error(`❌ Error updating ${email}: ${error.message}`);
      errors++;
    }
  }

  console.log('\n📊 Reset Summary:');
  console.log(`   Successfully reset: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total processed: ${failedEmails.length}`);

  process.exit(0);
}

resetFailedBatch().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
