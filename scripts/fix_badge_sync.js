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

async function fixBadgeSync(userId) {
  console.log(`🔧 BADGE SYNC: Fixing badge synchronization for user ${userId}`);
  
  try {
    // Step 1: Calculate correct badge count
    console.log(`\n📊 STEP 1: Calculating correct badge count...`);
    
    // Count unread notifications
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();

    const notificationCount = unreadNotificationsSnapshot.size;
    console.log(`📧 Unread notifications: ${notificationCount}`);

    // Count unread chat messages  
    const unreadChatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    let messageCount = 0;
    unreadChatsSnapshot.docs.forEach(doc => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      if (isReadMap[userId] === false) {
        messageCount++;
      }
    });

    console.log(`💬 Unread chat threads: ${messageCount}`);

    const correctBadgeCount = notificationCount + messageCount;
    console.log(`🔔 Correct badge count: ${correctBadgeCount}`);

    // Step 2: Get user's FCM token
    console.log(`\n📱 STEP 2: Getting user's FCM token...`);
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ User document for ${userId} does not exist`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    if (!fcmToken) {
      console.log(`❌ No FCM token for user ${userId}`);
      return;
    }

    console.log(`✅ FCM token found: ${fcmToken.substring(0, 20)}...`);

    // Step 3: Send badge update message
    console.log(`\n🔄 STEP 3: Sending badge update...`);
    
    const message = {
      token: fcmToken,
      apns: {
        payload: {
          aps: {
            badge: correctBadgeCount,
            'content-available': 1
          },
        },
      },
      android: {
        // Android handles badges differently, but we include for completeness
      },
    };

    const response = await messaging.send(message);
    console.log(`✅ Badge update sent successfully: ${response}`);

    // Step 4: Update user document with sync timestamp
    console.log(`\n📝 STEP 4: Recording sync timestamp...`);
    
    await db.collection('users').doc(userId).update({
      lastBadgeSync: admin.firestore.FieldValue.serverTimestamp(),
      lastBadgeCount: correctBadgeCount
    });

    console.log(`✅ Badge sync timestamp recorded`);

    console.log(`\n🎉 BADGE SYNC COMPLETE:`);
    console.log(`   - Correct badge count: ${correctBadgeCount}`);
    console.log(`   - FCM update sent successfully`);
    console.log(`   - Sync timestamp recorded`);
    console.log(`   - Badge should now display correctly on device`);

  } catch (error) {
    console.error(`❌ BADGE SYNC: Failed to fix badge sync for user ${userId}:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node fix_badge_sync.js <userId>');
  console.log('Example: node fix_badge_sync.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

fixBadgeSync(userId)
  .then(() => {
    console.log('\nBadge sync fix complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Badge sync fix failed:', error);
    process.exit(1);
  });
