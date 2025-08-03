const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function checkRecentNotifications(userId) {
  console.log(`🔍 Checking recent notifications for user ${userId}...`);
  
  try {
    const notificationsSnapshot = await db.collection('users')
      .doc(userId)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log(`📧 Total notifications found: ${notificationsSnapshot.size}`);
    
    if (notificationsSnapshot.empty) {
      console.log('📧 No notifications found for this user');
      return;
    }
    
    notificationsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      const createdAt = data.createdAt ? data.createdAt.toDate().toISOString() : 'No date';
      const readStatus = data.read ? 'READ' : 'UNREAD';
      console.log(`${index + 1}. [${readStatus}] ${data.title || 'No title'} - ${createdAt}`);
      console.log(`   Message: ${data.message || 'No message'}`);
      console.log(`   Type: ${data.type || 'No type'}`);
      console.log('');
    });
    
    const unreadCount = notificationsSnapshot.docs.filter(doc => doc.data().read === false).length;
    console.log(`🔔 Unread notifications: ${unreadCount}`);
    
    // Also check chat threads
    console.log(`\n💬 Checking chat threads...`);
    const chatsSnapshot = await db.collection('chats')
      .where('participants', 'array-contains', userId)
      .get();
    
    console.log(`💬 Total chat threads: ${chatsSnapshot.size}`);
    
    let unreadChatCount = 0;
    chatsSnapshot.docs.forEach((doc, index) => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      const isUnread = isReadMap[userId] === false;
      if (isUnread) {
        unreadChatCount++;
        console.log(`${index + 1}. UNREAD chat: ${doc.id}`);
      }
    });
    
    console.log(`💬 Unread chat threads: ${unreadChatCount}`);
    
    const totalBadgeCount = unreadCount + unreadChatCount;
    console.log(`\n🔔 CALCULATED TOTAL BADGE COUNT: ${totalBadgeCount} (${unreadCount} notifications + ${unreadChatCount} chats)`);
    
    // Force badge update
    console.log(`\n🔄 Attempting to force badge update...`);
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    
    if (fcmToken) {
      console.log(`✅ FCM token found: ${fcmToken.substring(0, 20)}...`);
      
      // Send a silent badge update
      const messaging = admin.messaging();
      const message = {
        token: fcmToken,
        apns: {
          payload: {
            aps: {
              badge: totalBadgeCount,
              'content-available': 1
            },
          },
        },
        android: {
          // Android handles badges differently
        },
      };
      
      try {
        const response = await messaging.send(message);
        console.log(`✅ Badge update sent successfully: ${response}`);
      } catch (error) {
        console.error(`❌ Failed to send badge update:`, error);
      }
    } else {
      console.log(`❌ No FCM token found for user`);
    }
    
  } catch (error) {
    console.error(`❌ Error checking notifications:`, error);
  }
}

// Get user ID from command line arguments
const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node check_recent_notifications.js <userId>');
  console.log('Example: node check_recent_notifications.js KJ8uFnlhKhWgBa4NVcwT');
  process.exit(1);
}

checkRecentNotifications(userId)
  .then(() => {
    console.log('\nNotification check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Notification check failed:', error);
    process.exit(1);
  });
