const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with service account (same as generateUsers.js)
if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Debug badge count for a specific user
 * Usage: node test_badge_debug.js <userId>
 */
async function debugBadgeCount(userId) {
  try {
    console.log(`🔍 BADGE DEBUG: Analyzing badge count for user ${userId}`);
    
    // Check unread notifications
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();

    const notificationCount = unreadNotificationsSnapshot.size;
    console.log(`📧 Unread notifications: ${notificationCount}`);
    
    if (notificationCount > 0) {
      console.log(`📧 Unread notification details:`);
      unreadNotificationsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.title} - ${data.type} (${doc.id})`);
      });
    }

    // Check unread chat messages
    const unreadChatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    let messageCount = 0;
    console.log(`💬 Total chat threads: ${unreadChatsSnapshot.size}`);
    
    for (const doc of unreadChatsSnapshot.docs) {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      
      console.log(`💬 Chat ${doc.id}:`);
      console.log(`  - Participants: ${chatData.participants?.join(', ')}`);
      console.log(`  - isRead map: ${JSON.stringify(isReadMap)}`);
      console.log(`  - User ${userId} read status: ${isReadMap[userId]}`);
      
      if (isReadMap.hasOwnProperty(userId) && isReadMap[userId] === false) {
        messageCount++;
        console.log(`  ❌ COUNTED as unread for user ${userId}`);
        
        // Get actual messages in this thread
        const messagesSnapshot = await db.collection("chats")
          .doc(doc.id)
          .collection("messages")
          .orderBy("timestamp", "desc")
          .limit(5)
          .get();
          
        console.log(`  📝 Recent messages (${messagesSnapshot.size} total):`);
        messagesSnapshot.docs.forEach((msgDoc, index) => {
          const msgData = msgDoc.data();
          console.log(`    ${index + 1}. From ${msgData.senderId}: "${msgData.text}" (${msgData.timestamp?.toDate?.()?.toISOString() || 'no timestamp'})`);
        });
      } else {
        console.log(`  ✅ NOT counted - read status: ${isReadMap[userId]}`);
      }
    }

    const totalBadgeCount = notificationCount + messageCount;
    console.log(`\n🔔 FINAL BADGE COUNT: ${totalBadgeCount} (${notificationCount} notifications + ${messageCount} chat threads)`);
    
    if (totalBadgeCount !== 2) {
      console.log(`⚠️  Expected badge count of 2, but calculated ${totalBadgeCount}`);
    } else {
      console.log(`✅ Badge count matches expected value of 2`);
    }

  } catch (error) {
    console.error(`❌ Error debugging badge count:`, error);
  }
}

// Get userId from command line arguments
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node test_badge_debug.js <userId>');
  process.exit(1);
}

debugBadgeCount(userId).then(() => {
  console.log('Debug complete');
  process.exit(0);
});
