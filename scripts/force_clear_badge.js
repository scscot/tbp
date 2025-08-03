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

async function forceClearBadge(userId) {
  console.log(`🔧 FORCE CLEAR: Aggressively clearing badge for user ${userId}`);
  
  try {
    // Step 1: Verify there are truly no unread items
    console.log(`\n🔍 STEP 1: Double-checking unread items...`);
    
    // Check notifications
    const notificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .get();

    console.log(`📧 Total notifications: ${notificationsSnapshot.size}`);
    
    let unreadNotifications = 0;
    notificationsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      if (data.read === false) {
        unreadNotifications++;
        console.log(`   UNREAD: ${data.title} - ${data.createdAt ? data.createdAt.toDate().toISOString() : 'No date'}`);
      }
    });
    
    console.log(`📧 Unread notifications: ${unreadNotifications}`);

    // Check chats
    const chatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    console.log(`💬 Total chat threads: ${chatsSnapshot.size}`);
    
    let unreadChats = 0;
    chatsSnapshot.docs.forEach((doc) => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      if (isReadMap[userId] === false) {
        unreadChats++;
        console.log(`   UNREAD CHAT: ${doc.id}`);
      }
    });
    
    console.log(`💬 Unread chats: ${unreadChats}`);

    const shouldBeBadgeCount = unreadNotifications + unreadChats;
    console.log(`🔔 Badge should be: ${shouldBeBadgeCount}`);

    // Step 2: Get FCM token
    console.log(`\n📱 STEP 2: Getting FCM token...`);
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    
    if (!fcmToken) {
      console.log(`❌ No FCM token found`);
      return;
    }
    
    console.log(`✅ FCM token: ${fcmToken.substring(0, 20)}...`);

    // Step 3: Try multiple badge clearing approaches
    console.log(`\n🔄 STEP 3: Trying multiple badge clearing approaches...`);
    
    // Approach 1: Set badge to 0 with content-available
    console.log(`   Approach 1: Silent badge update to 0...`);
    try {
      const silentMessage = {
        token: fcmToken,
        apns: {
          payload: {
            aps: {
              badge: 0,
              'content-available': 1
            },
          },
        },
      };
      
      const response1 = await messaging.send(silentMessage);
      console.log(`   ✅ Silent update sent: ${response1}`);
    } catch (error) {
      console.log(`   ❌ Silent update failed:`, error.message);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Approach 2: Send a visible notification with badge 0
    console.log(`   Approach 2: Visible notification with badge 0...`);
    try {
      const visibleMessage = {
        token: fcmToken,
        notification: {
          title: "Badge Sync",
          body: "Clearing badge count...",
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
          type: "badge_sync",
          badge_count: "0"
        }
      };
      
      const response2 = await messaging.send(visibleMessage);
      console.log(`   ✅ Visible notification sent: ${response2}`);
    } catch (error) {
      console.log(`   ❌ Visible notification failed:`, error.message);
    }

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Approach 3: Send multiple badge updates
    console.log(`   Approach 3: Multiple badge updates...`);
    for (let i = 0; i < 3; i++) {
      try {
        const multiMessage = {
          token: fcmToken,
          apns: {
            payload: {
              aps: {
                badge: 0,
                'content-available': 1
              },
            },
          },
        };
        
        const response3 = await messaging.send(multiMessage);
        console.log(`   ✅ Update ${i + 1} sent: ${response3}`);
        
        // Small delay between updates
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`   ❌ Update ${i + 1} failed:`, error.message);
      }
    }

    // Step 4: Update user document with clear badge flag
    console.log(`\n📝 STEP 4: Updating user document...`);
    await db.collection('users').doc(userId).update({
      badgeClearAttempt: admin.firestore.FieldValue.serverTimestamp(),
      lastBadgeCount: 0,
      forceBadgeClear: true
    });

    console.log(`✅ User document updated with clear badge flag`);

    console.log(`\n🎯 FORCE CLEAR COMPLETE:`);
    console.log(`   - Verified unread count: ${shouldBeBadgeCount}`);
    console.log(`   - Sent multiple FCM badge updates`);
    console.log(`   - Updated user document with clear flag`);
    console.log(`   - Badge should now be cleared on device`);
    console.log(`\n💡 If badge still shows, try:`);
    console.log(`   1. Force close and reopen the app`);
    console.log(`   2. Restart the device`);
    console.log(`   3. Check iOS Settings > Notifications > Team Build Pro > Badges`);

  } catch (error) {
    console.error(`❌ FORCE CLEAR: Failed to clear badge for user ${userId}:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node force_clear_badge.js <userId>');
  console.log('Example: node force_clear_badge.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

forceClearBadge(userId)
  .then(() => {
    console.log('\nForce badge clear complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Force badge clear failed:', error);
    process.exit(1);
  });
