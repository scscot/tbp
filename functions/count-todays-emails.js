const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function countTodaysEmails() {
  try {
    // Get start and end of today in Pacific Time
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    console.log('📅 Checking emails sent today:');
    console.log(`   Start: ${startOfDay.toISOString()}`);
    console.log(`   End: ${endOfDay.toISOString()}`);
    console.log('');

    // Query emails sent today
    const snapshot = await db
      .collection('emailCampaigns')
      .doc('master')
      .collection('contacts')
      .where('sentTimestamp', '>=', startOfDay)
      .where('sentTimestamp', '<=', endOfDay)
      .get();

    console.log(`✅ Emails sent today: ${snapshot.size}`);
    console.log('');

    // Get total counts
    const totalSnapshot = await db
      .collection('emailCampaigns')
      .doc('master')
      .collection('contacts')
      .get();

    const sentCount = totalSnapshot.docs.filter(doc => doc.data().sent === true).length;
    const unsentCount = totalSnapshot.docs.filter(doc => doc.data().sent === false).length;

    console.log('📊 Overall Statistics:');
    console.log(`   Total contacts: ${totalSnapshot.size}`);
    console.log(`   Total sent: ${sentCount}`);
    console.log(`   Total unsent: ${unsentCount}`);

    // Show some recent sends
    if (snapshot.size > 0) {
      console.log('');
      console.log('📧 Recent sends today:');
      snapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.email} at ${data.sentTimestamp.toDate().toLocaleTimeString()}`);
      });
      if (snapshot.size > 5) {
        console.log(`   ... and ${snapshot.size - 5} more`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    process.exit(0);
  }
}

countTodaysEmails();
