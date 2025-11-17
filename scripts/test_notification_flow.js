const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function testNotificationFlow(userId) {
  console.log(`🧪 NOTIFICATION TEST: Testing complete flow for user ${userId}`);
  
  try {
    // Step 1: Verify user state
    console.log(`\n📋 STEP 1: Checking user state...`);
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User document ${userId} does not exist`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`✅ User: ${userData.firstName} ${userData.lastName}`);
    console.log(`   - biz_visit_date: ${userData.biz_visit_date ? userData.biz_visit_date.toDate() : 'null'}`);
    console.log(`   - sponsor_id: ${userData.sponsor_id || 'null'}`);
    
    // Step 2: Check if notification should be sent
    if (userData.biz_visit_date) {
      console.log(`\n❌ ISSUE: User has biz_visit_date set - notification will be skipped`);
      console.log(`   This explains why the function exits early`);
      return;
    }
    
    console.log(`\n✅ User has no biz_visit_date - notification should be sent`);
    
    // Step 3: Simulate the Firebase Function call
    console.log(`\n📋 STEP 2: Simulating Firebase Function call...`);
    
    // Check sponsor exists
    const sponsorId = userData.sponsor_id;
    if (!sponsorId) {
      console.log(`❌ No sponsor_id - function would fail`);
      return;
    }
    
    const sponsorDoc = await db.collection('users').doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      console.log(`❌ Sponsor ${sponsorId} not found - function would fail`);
      return;
    }
    
    const sponsorData = sponsorDoc.data();
    console.log(`✅ Sponsor: ${sponsorData.firstName} ${sponsorData.lastName}`);
    console.log(`   - FCM token: ${sponsorData.fcm_token ? 'Present' : 'Missing'}`);
    
    // Step 4: Simulate notification creation
    console.log(`\n📋 STEP 3: Simulating notification creation...`);
    
    const visitingUserName = `${userData.firstName} ${userData.lastName}`;
    const uplineAdminId = sponsorData.upline_admin;
    
    // Get business opportunity name
    let bizOpp = 'your business opportunity';
    if (uplineAdminId) {
      const adminSettingsDoc = await db.collection('admin_settings').doc(uplineAdminId).get();
      if (adminSettingsDoc.exists) {
        const adminData = adminSettingsDoc.data();
        bizOpp = adminData?.biz_opp || bizOpp;
      }
    }
    
    const notificationContent = {
      title: `Interest in your ${bizOpp} opportunity! 🎉`,
      message: `${visitingUserName} has just used your referral link to to learn more about the ${bizOpp} opportunity! Click Here to view their profile.`,
      imageUrl: userData.photoUrl || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      type: "biz_opp_visit",
      route: "/member_detail",
      route_params: JSON.stringify({ "userId": userId }),
    };
    
    console.log(`✅ Notification content prepared:`);
    console.log(`   Title: ${notificationContent.title}`);
    console.log(`   Message: ${notificationContent.message}`);
    
    // Step 5: Actually create the notification (for testing)
    console.log(`\n📋 STEP 4: Creating actual notification...`);
    
    await db.collection('users').doc(sponsorId).collection('notifications').add(notificationContent);
    console.log(`✅ Notification created successfully`);
    
    // Step 6: Update biz_visit_date (simulate function behavior)
    console.log(`\n📋 STEP 5: Updating biz_visit_date...`);
    
    await db.collection('users').doc(userId).update({
      'biz_visit_date': admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ biz_visit_date updated`);
    
    console.log(`\n🎉 SUCCESS: Complete notification flow executed successfully!`);
    console.log(`   - Notification sent to sponsor: ${sponsorData.firstName} ${sponsorData.lastName}`);
    console.log(`   - User visit date updated`);
    console.log(`   - FCM push notification should be triggered automatically`);
    
  } catch (error) {
    console.error(`❌ Error in notification flow test:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node test_notification_flow.js <userId>');
  console.log('Example: node test_notification_flow.js qzvHp5bIjvTEniYuds544aHLNE93');
  process.exit(1);
}

testNotificationFlow(userId)
  .then(() => {
    console.log('\nTest complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
