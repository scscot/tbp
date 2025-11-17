const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with service account (same as generateUsers.js)
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function debugBizOppNotification(userId) {
  console.log(`🔍 BIZ OPP DEBUG: Analyzing notification flow for user ${userId}`);
  
  try {
    // Step 1: Get user data
    console.log(`\n📋 STEP 1: Fetching user data...`);
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ User document ${userId} does not exist`);
      return;
    }
    
    const userData = userDoc.data();
    console.log(`✅ User found: ${userData.firstName} ${userData.lastName}`);
    console.log(`   - biz_visit_date: ${userData.biz_visit_date ? userData.biz_visit_date.toDate() : 'null'}`);
    console.log(`   - sponsor_id: ${userData.sponsor_id || 'null'}`);
    
    // Step 2: Check if user has already visited
    if (userData.biz_visit_date) {
      console.log(`\n⚠️  ISSUE FOUND: User has already visited the opportunity`);
      console.log(`   Visit date: ${userData.biz_visit_date.toDate()}`);
      console.log(`   This explains why no notification was sent - function exits early`);
      return;
    }
    
    console.log(`\n✅ User has NOT visited opportunity yet - should proceed with notification`);
    
    // Step 3: Check sponsor
    console.log(`\n📋 STEP 2: Checking sponsor...`);
    const sponsorId = userData.sponsor_id;
    
    if (!sponsorId) {
      console.log(`❌ No sponsor_id found for user ${userId}`);
      return;
    }
    
    const sponsorDoc = await db.collection('users').doc(sponsorId).get();
    
    if (!sponsorDoc.exists) {
      console.log(`❌ Sponsor document ${sponsorId} not found`);
      return;
    }
    
    const sponsorData = sponsorDoc.data();
    console.log(`✅ Sponsor found: ${sponsorData.firstName} ${sponsorData.lastName}`);
    console.log(`   - FCM token: ${sponsorData.fcm_token ? 'Present' : 'Missing'}`);
    
    // Step 4: Check business opportunity name
    console.log(`\n📋 STEP 3: Checking business opportunity...`);
    const uplineAdminId = sponsorData.upline_admin;
    
    if (!uplineAdminId) {
      console.log(`❌ No upline_admin found for sponsor ${sponsorId}`);
      return;
    }
    
    const adminSettingsDoc = await db.collection('admin_settings').doc(uplineAdminId).get();
    let bizOpp = 'your business opportunity';
    
    if (adminSettingsDoc.exists) {
      const adminData = adminSettingsDoc.data();
      bizOpp = adminData?.biz_opp || bizOpp;
      console.log(`✅ Business opportunity: ${bizOpp}`);
    } else {
      console.log(`⚠️  Admin settings not found, using default: ${bizOpp}`);
    }
    
    // Step 5: Simulate notification creation
    console.log(`\n📋 STEP 4: Simulating notification creation...`);
    const visitingUserName = `${userData.firstName} ${userData.lastName}`;
    
    const notificationContent = {
      title: `Interest in your ${bizOpp} opportunity! 🎉`,
      message: `${visitingUserName} has just used your referral link to to learn more about the ${bizOpp} opportunity! Click Here to view their profile.`,
      imageUrl: userData.photoUrl || null,
      createdAt: new Date(),
      read: false,
      type: "biz_opp_visit",
      route: "/member_detail",
      route_params: JSON.stringify({ "userId": userId }),
    };
    
    console.log(`✅ Notification would be created:`);
    console.log(`   Title: ${notificationContent.title}`);
    console.log(`   Message: ${notificationContent.message}`);
    console.log(`   Route: ${notificationContent.route}`);
    console.log(`   Route params: ${notificationContent.route_params}`);
    
    // Step 6: Check if notification would be sent
    if (sponsorData.fcm_token) {
      console.log(`\n✅ CONCLUSION: Notification SHOULD be sent successfully`);
      console.log(`   - User has not visited before: ✅`);
      console.log(`   - Sponsor exists: ✅`);
      console.log(`   - FCM token present: ✅`);
      console.log(`   - Business opportunity name: ✅`);
    } else {
      console.log(`\n⚠️  ISSUE: Notification would be created but FCM push might fail`);
      console.log(`   - User has not visited before: ✅`);
      console.log(`   - Sponsor exists: ✅`);
      console.log(`   - FCM token present: ❌`);
      console.log(`   - Business opportunity name: ✅`);
    }
    
  } catch (error) {
    console.error(`❌ Error debugging biz opp notification:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node debug_biz_opp_notification.js <userId>');
  console.log('Example: node debug_biz_opp_notification.js qzvHp5bIjvTEniYuds544aHLNE93');
  process.exit(1);
}

debugBizOppNotification(userId)
  .then(() => {
    console.log('\nDebug complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Debug failed:', error);
    process.exit(1);
  });
