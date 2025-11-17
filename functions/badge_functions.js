const admin = require('firebase-admin');
const db = admin.firestore();
const messaging = admin.messaging();

// ============================================================================
// CENTRALIZED BADGE UPDATE FUNCTION
// ============================================================================

/**
 * Centralized function to calculate and update badge count for a user
 * Includes both notifications and chat messages. Optimized to accept optional
 * new counts to avoid redundant database reads.
 *
 * @param {string} userId The ID of the user.
 * @param {number | null} newNotificationCount Optional new count of unread notifications.
 * @param {number | null} newUnreadChatCount Optional new count of unread chat threads.
 */
const updateUserBadge = async (userId, newNotificationCount = null, newUnreadChatCount = null) => {
  try {
    console.log(`🔔 BADGE UPDATE: Starting badge update for user ${userId} (notifCount=${newNotificationCount}, chatCount=${newUnreadChatCount})`);

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`⚠️ BADGE UPDATE: User document for ${userId} does not exist - skipping badge update`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    if (!fcmToken) {
      console.log(`⚠️ BADGE UPDATE: No FCM token for user ${userId} - skipping badge update (user may not have enabled notifications)`);
      return;
    }

    console.log(`🔔 BADGE UPDATE: Resolved FCM token for user ${userId} (token length: ${fcmToken.length})`);

    // Count unread notifications
    let notificationCount = newNotificationCount;
    if (notificationCount === null) {
      console.log(`🔔 BADGE UPDATE: Querying unread notifications for user ${userId}...`);
      const unreadNotificationsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .where('read', '==', false)
        .count()
        .get();
      notificationCount = unreadNotificationsSnapshot.data().count;
      console.log(`🔔 BADGE UPDATE: Found ${notificationCount} unread notifications`);
    } else {
      console.log(`🔔 BADGE UPDATE: Using provided notification count: ${notificationCount}`);
    }

    // Count unread chat messages (count threads with unread messages)
    let messageCount = newUnreadChatCount;
    if (messageCount === null) {
      console.log(`🔔 BADGE UPDATE: Querying unread chats for user ${userId}...`);
      const chatDocs = await db
        .collection('chats')
        .where('participants', 'array-contains', userId)
        .get();

      messageCount = 0;
      chatDocs.docs.forEach((doc) => {
        const chatData = doc.data();
        const isReadMap = chatData.isRead || {};

        // Only count if this chat thread has unread messages for this user
        if (
          isReadMap.Object.prototype.hasOwnProperty.call(isReadMap, userId) &&
          isReadMap[userId] === false
        ) {
          messageCount++;
        }
      });
      console.log(`🔔 BADGE UPDATE: Found ${messageCount} unread chat threads (from ${chatDocs.docs.length} total chats)`);
    } else {
      console.log(`🔔 BADGE UPDATE: Using provided chat count: ${messageCount}`);
    }

    const totalBadgeCount = notificationCount + messageCount;

    console.log(
      `🔔 BADGE UPDATE: User ${userId} - Notifications: ${notificationCount}, Messages: ${messageCount}, Total Badge: ${totalBadgeCount}`
    );

    // Send badge update message
    const message = {
      token: fcmToken,
      apns: {
        payload: {
          aps: {
            badge: totalBadgeCount,
          },
        },
      },
      android: {
        notification: {
          // Android handles badges differently, but we include for completeness
        },
      },
    };

    await messaging.send(message);
    console.log(
      `✅ BADGE UPDATE: Badge updated successfully for user ${userId} to ${totalBadgeCount}`
    );
  } catch (error) {
    console.error(`❌ BADGE UPDATE: Failed to update badge for user ${userId}:`, error);
  }
};

module.exports = { updateUserBadge };
