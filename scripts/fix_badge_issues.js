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
 * Fix badge issues for a specific user
 * Usage: node fix_badge_issues.js <userId>
 */
async function fixBadgeIssues(userId) {
  try {
    console.log(`🔧 BADGE FIX: Starting badge fix for user ${userId}`);
    
    // Get all chat threads for this user
    const chatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    console.log(`💬 Found ${chatsSnapshot.size} chat threads for user ${userId}`);
    
    let fixedChats = 0;
    const batch = db.batch();
    
    for (const chatDoc of chatsSnapshot.docs) {
      const chatData = chatDoc.data();
      const isReadMap = chatData.isRead || {};
      const participants = chatData.participants || [];
      
      console.log(`💬 Checking chat ${chatDoc.id} with participants: ${participants.join(', ')}`);
      
      // Check if this chat has any messages
      const messagesSnapshot = await db.collection("chats")
        .doc(chatDoc.id)
        .collection("messages")
        .limit(1)
        .get();
      
      if (messagesSnapshot.empty) {
        console.log(`  📝 No messages found in chat ${chatDoc.id}`);
        
        // If no messages, mark as read for all participants
        const updatedIsReadMap = {};
        participants.forEach(participantId => {
          updatedIsReadMap[participantId] = true;
        });
        
        batch.update(chatDoc.ref, { isRead: updatedIsReadMap });
        fixedChats++;
        console.log(`  ✅ Marked empty chat ${chatDoc.id} as read for all participants`);
        
      } else {
        // Check if user's read status makes sense
        const userReadStatus = isReadMap[userId];
        
        if (userReadStatus === false) {
          // Get the latest message to see if user should have it marked as read
          const latestMessageSnapshot = await db.collection("chats")
            .doc(chatDoc.id)
            .collection("messages")
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();
          
          if (!latestMessageSnapshot.empty) {
            const latestMessage = latestMessageSnapshot.docs[0].data();
            console.log(`  📝 Latest message from ${latestMessage.senderId}: "${latestMessage.text}"`);
            
            // If the latest message is from the user themselves, they should have read it
            if (latestMessage.senderId === userId) {
              console.log(`  🔧 User sent the latest message, marking as read`);
              batch.update(chatDoc.ref, { 
                [`isRead.${userId}`]: true 
              });
              fixedChats++;
            }
          }
        }
      }
    }
    
    if (fixedChats > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixedChats} chat threads`);
    } else {
      console.log(`✅ No chat threads needed fixing`);
    }
    
    // Now trigger a badge update
    console.log(`🔔 Triggering badge update...`);
    
    // Call the updateUserBadge function (we'll need to simulate this)
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found`);
      return;
    }
    
    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    
    if (!fcmToken) {
      console.log(`⚠️  No FCM token for user ${userId}, cannot send badge update`);
      return;
    }
    
    // Recalculate badge count
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();

    const notificationCount = unreadNotificationsSnapshot.size;

    const unreadChatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    let messageCount = 0;
    unreadChatsSnapshot.docs.forEach(doc => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      
      if (isReadMap.hasOwnProperty(userId) && isReadMap[userId] === false) {
        messageCount++;
      }
    });

    const totalBadgeCount = notificationCount + messageCount;
    console.log(`🔔 New badge count: ${totalBadgeCount} (${notificationCount} notifications + ${messageCount} chat threads)`);
    
    // Send badge update via FCM
    const messaging = admin.messaging();
    const message = {
      token: fcmToken,
      apns: {
        payload: {
          aps: {
            badge: totalBadgeCount,
          },
        },
      },
    };

    await messaging.send(message);
    console.log(`✅ Badge updated successfully to ${totalBadgeCount}`);

  } catch (error) {
    console.error(`❌ Error fixing badge issues:`, error);
  }
}

// Get userId from command line arguments
const userId = process.argv[2];
if (!userId) {
  console.log('Usage: node fix_badge_issues.js <userId>');
  process.exit(1);
}

fixBadgeIssues(userId).then(() => {
  console.log('Badge fix complete');
  process.exit(0);
});
