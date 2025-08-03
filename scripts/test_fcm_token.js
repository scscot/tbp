const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

async function testFCMToken(userId) {
  console.log(`🧪 FCM TEST: Testing FCM token functionality for user ${userId}`);
  
  try {
    // Get user's FCM token
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    
    if (!fcmToken) {
      console.log(`❌ No FCM token found for user`);
      return;
    }
    
    console.log(`✅ FCM token found: ${fcmToken.substring(0, 20)}...`);
    
    // Test 1: Send a simple test notification
    console.log(`\n📱 TEST 1: Sending test notification...`);
    try {
      const testMessage = {
        token: fcmToken,
        notification: {
          title: "FCM Test",
          body: "This is a test notification to verify FCM is working",
        },
        apns: {
          payload: {
            aps: {
              badge: 1, // Temporarily set to 1 to test if badge updates work
              sound: 'default'
            },
          },
        },
        data: {
          type: "fcm_test"
        }
      };
      
      const response1 = await messaging.send(testMessage);
      console.log(`✅ Test notification sent: ${response1}`);
    } catch (error) {
      console.log(`❌ Test notification failed:`, error.message);
      return;
    }
    
    // Wait 3 seconds
    console.log(`⏳ Waiting 3 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test 2: Clear the badge back to 0
    console.log(`\n🔄 TEST 2: Clearing badge back to 0...`);
    try {
      const clearMessage = {
        token: fcmToken,
        notification: {
          title: "Badge Cleared",
          body: "Badge should now be cleared",
        },
        apns: {
          payload: {
            aps: {
              badge: 0,
              sound: 'default'
            },
          },
        },
        data: {
          type: "badge_clear_test"
        }
      };
      
      const response2 = await messaging.send(clearMessage);
      console.log(`✅ Badge clear sent: ${response2}`);
    } catch (error) {
      console.log(`❌ Badge clear failed:`, error.message);
    }
    
    console.log(`\n🎯 FCM TEST COMPLETE:`);
    console.log(`   - FCM token is valid and working`);
    console.log(`   - Test notification sent successfully`);
    console.log(`   - Badge clear command sent`);
    console.log(`   - Check your device for the test notifications`);
    console.log(`   - Badge should now be 0`);
    
  } catch (error) {
    console.error(`❌ FCM TEST: Failed to test FCM token:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node test_fcm_token.js <userId>');
  console.log('Example: node test_fcm_token.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

testFCMToken(userId)
  .then(() => {
    console.log('\nFCM token test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('FCM token test failed:', error);
    process.exit(1);
  });
