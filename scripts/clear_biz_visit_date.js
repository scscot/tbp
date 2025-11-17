const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with service account (same as generateUsers.js)
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function clearBizVisitDate(userId) {
  console.log(`🔧 CLEAR BIZ VISIT: Clearing biz_visit_date for user ${userId}`);
  
  try {
    // Get current user data
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User document ${userId} does not exist`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`📋 Current user: ${userData.firstName} ${userData.lastName}`);
    console.log(`📋 Current biz_visit_date: ${userData.biz_visit_date ? userData.biz_visit_date.toDate() : 'null'}`);
    
    if (!userData.biz_visit_date) {
      console.log(`✅ biz_visit_date is already null - no action needed`);
      return;
    }
    
    // Clear the biz_visit_date field
    await db.collection('users').doc(userId).update({
      biz_visit_date: admin.firestore.FieldValue.delete()
    });
    
    console.log(`✅ Successfully cleared biz_visit_date for user ${userId}`);
    console.log(`🔔 User can now trigger the notification on next business opportunity visit`);
    
  } catch (error) {
    console.error(`❌ Error clearing biz_visit_date:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node clear_biz_visit_date.js <userId>');
  console.log('Example: node clear_biz_visit_date.js qzvHp5bIjvTEniYuds544aHLNE93');
  process.exit(1);
}

clearBizVisitDate(userId)
  .then(() => {
    console.log('\nClear operation complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Clear operation failed:', error);
    process.exit(1);
  });
