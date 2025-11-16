const { db } = require('./shared/utilities');

async function countUnsentEmails() {
  try {
    console.log('📊 EMAIL CAMPAIGN STATUS');
    console.log('='.repeat(60));

    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    // Count total contacts
    const totalSnapshot = await contactsRef.count().get();
    const totalContacts = totalSnapshot.data().count;

    // Count unsent emails
    const unsentSnapshot = await contactsRef.where('sent', '==', false).count().get();
    const unsentCount = unsentSnapshot.data().count;

    // Count sent emails
    const sentSnapshot = await contactsRef.where('sent', '==', true).count().get();
    const sentCount = sentSnapshot.data().count;

    console.log(`📬 Total Contacts: ${totalContacts}`);
    console.log(`✅ Sent: ${sentCount}`);
    console.log(`⏳ Remaining (Unsent): ${unsentCount}`);
    console.log(`📈 Progress: ${((sentCount / totalContacts) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    // Get a sample of unsent emails (first 5)
    console.log('\n📋 Sample of Unsent Emails (first 5):');
    console.log('-'.repeat(60));
    const sampleSnapshot = await contactsRef
      .where('sent', '==', false)
      .limit(5)
      .get();

    sampleSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ${data.firstName} ${data.lastName} <${data.email}>`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

countUnsentEmails();
