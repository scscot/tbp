const admin = require('firebase-admin');
const serviceAccount = require('../secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countUnsentEmails() {
  try {
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    const unsentSnapshot = await contactsRef.where('sent', '==', false).get();
    const sentSnapshot = await contactsRef.where('sent', '==', true).get();
    const totalSnapshot = await contactsRef.get();

    console.log('\n=== EMAIL CAMPAIGN STATUS ===');
    console.log(`Total contacts: ${totalSnapshot.size}`);
    console.log(`Sent: ${sentSnapshot.size}`);
    console.log(`Remaining (unsent): ${unsentSnapshot.size}`);
    console.log(`\nAt 75 emails per batch, 5 batches per day (375/day):`);
    console.log(`Days remaining: ${Math.ceil(unsentSnapshot.size / 375)} days`);
    console.log(`Batches remaining: ${Math.ceil(unsentSnapshot.size / 75)} batches`);

    process.exit(0);
  } catch (error) {
    console.error('Error counting emails:', error);
    process.exit(1);
  }
}

countUnsentEmails();
