// ==============================
// NOTIFICATION FUNCTIONS MODULE
// Handles all notification-related functions including push notifications,
// subscription notifications, chat messages, and milestone achievements
// ==============================

const {
  onCall,
  HttpsError,
  onRequest,
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  onSchedule,
  logger,
  admin,
  db,
  FieldValue,
  FieldPath,
  NOTIF_TRIGGER_ENABLED,
  DELIVERY_MODE,
  isTriggerMode,
} = require('./shared/utilities');

// Additional Firebase setup
const messaging = admin.messaging();

// ==============================
// Core Notification Helper Functions
// ==============================

/**
 * Helper function to get business opportunity name from admin settings
 */
const getBusinessOpportunityName = async (uplineAdminId, defaultName = 'your business opportunity') => {
  if (!uplineAdminId || uplineAdminId.trim() === '') {
    return defaultName;
  }

  try {
    const adminSettingsDoc = await db.collection('admin_settings').doc(uplineAdminId).get();
    if (adminSettingsDoc.exists) {
      const bizOpp = adminSettingsDoc.data()?.biz_opp;
      return (bizOpp && bizOpp.trim() !== '') ? bizOpp : defaultName;
    }
    return defaultName;
  } catch (error) {
    console.log(`Error fetching business opportunity name for admin ${uplineAdminId}:`, error.message);
    return defaultName;
  }
};

/**
 * Helper function to check milestones for upline users
 */
async function checkUplineMilestone(userId, userData) {
  try {
    console.log(`MILESTONE UPLINE: Checking milestones for upline user ${userId}`);

    // Skip admins and qualified users
    if (userData.role === 'admin' || userData.qualifiedDate) {
      console.log(`MILESTONE UPLINE: Skipping ${userId} - admin or qualified`);
      return;
    }

    const directSponsors = userData.directSponsorCount || 0;
    const totalTeam = userData.totalTeamCount || 0;
    const directMin = 4;
    const teamMin = 20;

    console.log(`MILESTONE UPLINE: User ${userId} - Direct: ${directSponsors}, Total: ${totalTeam}`);

    let notificationContent = null;

    // Check for direct sponsors milestone (reached directMin but still needs total team)
    if (directSponsors >= directMin && totalTeam < teamMin) {
      // Check if this milestone notification already exists
      const existingQuery = await db.collection('users').doc(userId).collection('notifications')
        .where('type', '==', 'milestone')
        .where('subtype', '==', 'direct')
        .limit(1)
        .get();

      if (existingQuery.empty) {
        const remainingTeamNeeded = teamMin - totalTeam;
        const bizName = await getBusinessOpportunityName(userData.upline_admin, 'your business');

        notificationContent = {
          title: "🎉 Amazing Progress!",
          message: `Congratulations, ${userData.firstName}! You've reached ${directMin} direct sponsors! Just ${remainingTeamNeeded} more team member${remainingTeamNeeded > 1 ? 's' : ''} needed to unlock your ${bizName} invitation. Keep building!`,
          type: "milestone",
          subtype: "direct",
          route: "/network",
          route_params: {},
        };
      }
    }
    // Check for total team milestone (reached teamMin but still needs direct sponsors)
    else if (totalTeam >= teamMin && directSponsors < directMin) {
      // Check if this milestone notification already exists
      const existingQuery = await db.collection('users').doc(userId).collection('notifications')
        .where('type', '==', 'milestone')
        .where('subtype', '==', 'team')
        .limit(1)
        .get();

      if (existingQuery.empty) {
        const remainingDirectNeeded = directMin - directSponsors;
        const bizName = await getBusinessOpportunityName(userData.upline_admin, 'your business');

        notificationContent = {
          title: "🚀 Incredible Growth!",
          message: `Amazing progress, ${userData.firstName}! You've built a team of ${teamMin}! Just ${remainingDirectNeeded} more direct sponsor${remainingDirectNeeded > 1 ? 's' : ''} needed to qualify for ${bizName}. You're so close!`,
          type: "milestone",
          subtype: "team",
          route: "/network",
          route_params: {},
        };
      }
    }

    // Send notification if a milestone was reached
    if (notificationContent) {
      console.log(`MILESTONE UPLINE: Creating notification for ${userId} - ${notificationContent.subtype}`);
      const notifId = `milestone_${notificationContent.subtype}_${directMin}_${userId}_${Date.now()}`;

      const result = await createNotification({
        userId,
        notifId,
        type: notificationContent.type,
        title: notificationContent.title,
        body: notificationContent.message,
        docFields: {
          subtype: notificationContent.subtype,
          route: notificationContent.route,
          route_params: JSON.stringify(notificationContent.route_params),
        },
      });

      if (result.ok) {
        console.log(`✅ MILESTONE UPLINE: Milestone notification created for user ${userId} - ${notificationContent.subtype}`);
      } else {
        console.log(`❌ MILESTONE UPLINE: Failed to create notification for ${userId}`);
      }
    }

  } catch (error) {
    console.error(`❌ MILESTONE UPLINE: Error checking milestones for ${userId}:`, error);
  }
}

/**
 * Helper function to convert object to string map for FCM data payload
 */
function toStringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = v == null ? '' : String(v);
  return out;
}

/**
 * Resolves the best FCM token for a user using a 3-tier approach
 */
async function resolveBestFcmTokenForUser(userRef, userDataMaybe) {
  let token = null, source = 'none';
  const data = userDataMaybe || (await userRef.get()).data() || {};

  // Tier 1: users/{uid}.fcm_token
  if (typeof data.fcm_token === 'string' && data.fcm_token.trim()) {
    token = data.fcm_token.trim();
    source = 'fcm_token';
  }

  // Tier 2: users/{uid}.fcmTokens[0]
  if (!token && Array.isArray(data.fcmTokens) && data.fcmTokens.length) {
    const first = (data.fcmTokens.find(t => typeof t === 'string' && t.trim()) || '').trim();
    if (first) {
      token = first;
      source = 'fcmTokens[0]';
    }
  }

  // Tier 3: users/{uid}/fcmTokens/{tokenId} subcollection
  if (!token) {
    try {
      const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
      if (!sub.empty) {
        token = (sub.docs[0].data().token || sub.docs[0].id).trim();
        source = 'fcmTokens(subcollection)';
      }
    } catch (e) {
      const sub = await userRef.collection('fcmTokens').orderBy(FieldPath.documentId()).limit(1).get();
      if (!sub.empty) {
        token = sub.docs[0].id.trim();
        source = 'fcmTokens(subcollection)';
      }
    }
  }

  return { token, source };
}

/**
 * Cleanup dead FCM tokens from all storage locations
 */
async function cleanupDeadToken(userRef, token) {
  if (!token) return;

  const batch = db.batch();

  try {
    // Remove from fcm_token field
    batch.update(userRef, { fcm_token: FieldValue.delete() });

    // Remove from fcmTokens array
    batch.update(userRef, { fcmTokens: FieldValue.arrayRemove(token) });

    // Remove from fcmTokens subcollection
    const tokenDoc = userRef.collection('fcmTokens').doc(token);
    batch.delete(tokenDoc);

    await batch.commit();
    logger.info('Dead token cleaned up', { token: token.slice(0, 8) + '***' });
  } catch (error) {
    logger.error('Failed to cleanup dead token', { error: error.message });
  }
}

/**
 * Send push notification to a specific user
 */
async function sendPushToUser(userId, notificationId, payload, userDataMaybe) {
  const userRef = db.collection('users').doc(userId);
  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);

  if (!token) {
    logger.info('PUSH: no token', { userId, notificationId });
    return { sent: false, reason: 'no_token', tokenSource: 'none' };
  }

  const title = payload.title || 'Team Build Pro';
  const body = payload.message || '';
  const route = payload.route || '/';
  const route_params = payload.route_params || {};
  const imageUrl = payload.imageUrl || '';
  const apnsTopic = process.env.IOS_BUNDLE_ID || '';

  // Ensure iOS sees this as an alert push (banner/list/lockscreen)
  const apnsHeaders = {
    'apns-push-type': 'alert',
    'apns-priority': '10',
    ...(apnsTopic ? { 'apns-topic': apnsTopic } : {}),
  };

  const msg = {
    token,
    notification: { title, body },
    data: toStringMap({
      notification_id: notificationId,
      type: payload.type || 'generic',
      title,
      body,
      route,
      route_params: JSON.stringify(route_params),
      imageUrl
    }),
    apns: {
      headers: apnsHeaders,
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          'mutable-content': 1,
        },
      },
    },
    android: {
      notification: {
        sound: "default",
      },
    },
  };

  try {
    logger.info('PUSH APNs Headers:', JSON.stringify(apnsHeaders));
    const response = await messaging.send(msg);
    logger.info('PUSH: sent', { userId, notificationId, response, tokenSource: source });

    const tokenPreview = token ? String(token).slice(0, 8) : '<no-token>';
    logger.info(`PUSH DETAILED: type=${payload?.type} subtype=${payload?.subtype || 'none'} to=${tokenPreview}* msgId=${response} notifId=${notificationId}`);

    return { sent: true, reason: 'sent', tokenSource: source };
  } catch (err) {
    const code = (err && err.code) || '';
    logger.error('PUSH: error', { userId, notificationId, code, msg: err.message });

    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token);
      return { sent: false, reason: 'token_not_registered', tokenSource: source };
    }
    return { sent: false, reason: code || 'unknown', tokenSource: source };
  }
}

/**
 * Update user badge count and send silent badge push
 */
const updateUserBadge = async (userId) => {
  try {
    logger.info(`🔔 BADGE UPDATE: Starting badge update for user ${userId}`);

    // Recompute badge count transactionally
    const { badgeCount } = await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { badgeCount: 0 };

      // Unread notifications
      const unreadNotifs = await tx.get(
        userRef.collection('notifications').where('read', '==', false).limit(1000)
      );
      const notifCount = unreadNotifs.size;

      // If you track unread chat separately, add it here
      const chatCount = 0;

      const total = notifCount + chatCount;
      tx.set(userRef, { badgeCount: total }, { merge: true });
      return { badgeCount: total };
    });

    // Resolve token using same 3-tier logic
    const userRef = db.collection('users').doc(userId);
    const { token, source } = await resolveBestFcmTokenForUser(userRef);

    if (!token) {
      logger.info('BADGE: no token', { userId });
      return;
    }

    try {
      await messaging.send({
        token,
        apns: { payload: { aps: { badge: badgeCount } } },
        data: { type: 'badge_update', badgeCount: String(badgeCount) }
      });
      logger.info('BADGE: sent', { userId, badgeCount, tokenSource: source });
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || '';
      logger.error('BADGE: error', { userId, badgeCount, code, msg: e?.message });
      if (code === 'messaging/registration-token-not-registered') {
        try { await cleanupDeadToken(userRef, token); } catch (_) {
          // Token cleanup failure is logged internally, ignore
        }
      }
    }
  } catch (error) {
    logger.error(`❌ BADGE UPDATE: Failed for ${userId}:`, error.message);
  }
};

// ==============================
// User-Facing Badge Management Functions
// ==============================

const clearAppBadge = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const userId = request.auth.uid;

  try {
    console.log(`🔔 CLEAR BADGE: Badge clear requested for user ${userId} - using centralized update`);

    // Use centralized badge update function which will calculate and set correct badge
    await updateUserBadge(userId);

    return { success: true, message: "Badge updated successfully" };

  } catch (error) {
    console.error(`❌ CLEAR BADGE: Failed to update badge for user ${userId}:`, error);
    return { success: false, message: error.message };
  }
});

const syncAppBadge = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;
  console.log(`🔔 SYNC: Manual badge sync requested for user ${userId}`);

  await updateUserBadge(userId);
  return { success: true, message: "Badge synced successfully" };
});

/**
 * Universal notification creator that creates document and handles push via trigger
 */
async function createNotification(opts) {
  const {
    userId,
    type,
    title,
    body,
    notifId,
    docFields = {},
    markUnread = true,
  } = opts || {};

  const traceId = `notify_${userId}_${type}_${Date.now()}`;

  if (!userId || !type || !title || !body) {
    logger.error('CREATE NOTIF: invalid args', { traceId, userId, type, hasTitle: !!title, hasBody: !!body });
    return { ok: false, notificationId: '' };
  }

  const userRef = db.collection('users').doc(userId);

  // Create the notification document - onNotificationCreated trigger will handle push
  let notificationId = notifId || null;
  const baseDoc = {
    type,
    title,
    body,
    createdAt: FieldValue.serverTimestamp(),
    ...(markUnread ? { read: false } : {}),
    ...docFields,
  };

  try {
    if (notificationId) {
      // Deterministic: at-most-once create
      await userRef.collection('notifications').doc(notificationId).create(baseDoc);
      logger.info('CREATE NOTIF: created with deterministic ID', { traceId, userId, notificationId, type });
    } else {
      const addRes = await userRef.collection('notifications').add(baseDoc);
      notificationId = addRes.id;
      logger.info('CREATE NOTIF: created with generated ID', { traceId, userId, notificationId, type });
    }

    return { ok: true, notificationId };
  } catch (e) {
    // Already exists? That's fine for deterministic IDs
    const alreadyExists = e?.code === 6 || e?.code === 'already-exists';
    if (alreadyExists) {
      logger.info('CREATE NOTIF: notification already exists', { traceId, userId, notificationId: notifId, type });
      return { ok: true, notificationId: notifId };
    }

    logger.error('CREATE NOTIF: failed to create notification', { traceId, userId, notifId, type, error: e?.message });
    return { ok: false, notificationId: notifId || '' };
  }
}

// ==============================
// Subscription Notification Functions
// ==============================

/**
 * Apple V2 notification persistence with idempotency
 */
const upsertAppleV2NotificationState = async (payload) => {
  const isDecodedNotificationDataPayload = (payload) => {
    return payload && payload.data && payload.notificationUUID && payload.notificationType;
  };

  if (!isDecodedNotificationDataPayload(payload)) {
    return; // Only handle data notifications for now
  }

  const { data, notificationUUID, notificationType, subtype } = payload;

  try {
    // Extract key identifiers for idempotency
    const originalTransactionId = data?.originalTransactionId;
    const notificationId = notificationUUID || `${originalTransactionId}_${Date.now()}`;

    if (!originalTransactionId) {
      logger.warn('⚠️ APPLE V2 PERSISTENCE: No originalTransactionId found, skipping persistence');
      return;
    }

    // Create idempotency key
    const idempotencyKey = `${originalTransactionId}_${notificationId}`;

    // Check if we've already processed this notification
    const existingDoc = await db.collection('apple_v2_notifications')
      .doc(idempotencyKey)
      .get();

    if (existingDoc.exists) {
      logger.info(`✅ APPLE V2 PERSISTENCE: Notification ${idempotencyKey} already processed, skipping`);
      return;
    }

    // Persist the notification state
    const notificationData = {
      idempotencyKey,
      originalTransactionId,
      notificationUUID: notificationId,
      notificationType,
      subtype: subtype || null,
      signedTransactionInfo: data.signedTransactionInfo || null,
      signedRenewalInfo: data.signedRenewalInfo || null,
      bundleId: data.bundleId || null,
      environment: data.environment || null,
      processedAt: FieldValue.serverTimestamp(),
      rawPayload: {
        notificationType,
        subtype,
        data: {
          ...data,
          // Store key fields but don't duplicate large signed payloads
          signedTransactionInfo: data.signedTransactionInfo ? '[STORED_SEPARATELY]' : null,
          signedRenewalInfo: data.signedRenewalInfo ? '[STORED_SEPARATELY]' : null,
        }
      }
    };

    await db.collection('apple_v2_notifications').doc(idempotencyKey).set(notificationData);
    logger.info(`✅ APPLE V2 PERSISTENCE: Stored notification ${idempotencyKey} for transaction ${originalTransactionId}`);

  } catch (error) {
    logger.error('❌ APPLE V2 PERSISTENCE: Failed to store notification:', error);
    // Don't throw - persistence failure shouldn't break notification processing
  }
};

/**
 * Helper function to update user subscription status in Firestore
 */
const updateUserSubscription = async (userId, status, expiryDate = null) => {
  try {
    logger.info(`📱 SUBSCRIPTION: Updating user ${userId} to status: ${status}`);

    const updateData = {
      subscriptionStatus: status,
      subscriptionUpdated: FieldValue.serverTimestamp(),
    };

    if (expiryDate) {
      // Convert string to number before creating Date object
      const expiryTimestamp = typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate;
      updateData.subscriptionExpiry = new Date(expiryTimestamp);
      logger.info(`📱 SUBSCRIPTION: Setting expiry date: ${updateData.subscriptionExpiry.toISOString()}`);
    }

    await db.collection('users').doc(userId).update(updateData);
    logger.info(`✅ SUBSCRIPTION: Successfully updated user ${userId} subscription status`);

  } catch (error) {
    logger.error(`❌ SUBSCRIPTION: Failed to update user ${userId} subscription:`, error);
    throw error;
  }
};

/**
 * Create subscription notifications to users
 */
const createSubscriptionNotification = async (userId, status, expiryDate = null) => {
  try {
    let notificationContent = null;

    switch (status) {
      case 'active':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: "✅ Subscription Active",
            message: `Your subscription is now active until ${expiry.toLocaleDateString()}.`,
            type: "subscription_active"
          };
        }
        break;

      case 'cancelled':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: "⚠️ Subscription Cancelled",
            message: `Your subscription has been cancelled but remains active until ${expiry.toLocaleDateString()}.`,
            type: "subscription_cancelled"
          };
        }
        break;

      case 'expired':
        notificationContent = {
          title: "❌ Subscription Expired",
          message: "Your subscription has expired. Renew now to keep building your team and accessing all recruiting tools.",
          type: "subscription_expired",
          route: "/subscription",
          route_params: JSON.stringify({ "action": "renew" })
        };
        break;

      case 'expiring_soon':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
          const formattedDate = `${monthNames[expiry.getMonth()]} ${expiry.getDate()}`;

          notificationContent = {
            title: "⏰ Subscription Expiring Soon",
            message: `Your subscription expires on ${formattedDate}. Renew now to avoid interruption.`,
            type: "subscription_expiring_soon",
            route: "/subscription",
            route_params: JSON.stringify({ "action": "renew" })
          };
        }
        break;

      default:
        logger.warn('Unknown subscription status for notification:', status);
        return;
    }

    if (notificationContent) {
      await createNotification({
        userId,
        type: notificationContent.type,
        title: notificationContent.title,
        body: notificationContent.message,
        docFields: {
          route: notificationContent.route || null,
          route_params: notificationContent.route_params || null,
        }
      });
      logger.info(`✅ SUBSCRIPTION NOTIFICATION: Created ${status} notification for user ${userId}`);
    }

  } catch (error) {
    logger.error(`❌ SUBSCRIPTION NOTIFICATION: Failed to create ${status} notification for user ${userId}:`, error);
  }
};

/**
 * Enhanced subscription notification with additional info
 */
const createSubscriptionNotificationV2 = async (userId, status, expiryDate = null, additionalInfo = {}) => {
  try {
    let notificationContent = null;

    switch (status) {
      case 'active':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: "✅ Subscription Active",
            message: `Your subscription is now active until ${expiry.toLocaleDateString()}.`,
            type: "subscription_active",
            additionalInfo
          };
        }
        break;

      case 'cancelled':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: "⚠️ Subscription Cancelled",
            message: `Your subscription has been cancelled but remains active until ${expiry.toLocaleDateString()}.`,
            type: "subscription_cancelled",
            additionalInfo
          };
        }
        break;

      case 'expired':
        notificationContent = {
          title: "❌ Subscription Expired",
          message: "Your subscription has expired. Renew now to keep building your team and accessing all recruiting tools.",
          type: "subscription_expired",
          route: "/subscription",
          route_params: JSON.stringify({ "action": "renew" }),
          additionalInfo
        };
        break;

      default:
        logger.warn('Unknown subscription status for V2 notification:', status);
        return;
    }

    if (notificationContent) {
      await createNotification({
        userId,
        type: notificationContent.type,
        title: notificationContent.title,
        body: notificationContent.message,
        docFields: {
          route: notificationContent.route || null,
          route_params: notificationContent.route_params || null,
          additionalInfo: notificationContent.additionalInfo || {}
        }
      });
      logger.info(`✅ SUBSCRIPTION NOTIFICATION V2: Created ${status} notification for user ${userId}`);
    }

  } catch (error) {
    logger.error(`❌ SUBSCRIPTION NOTIFICATION V2: Failed to create ${status} notification for user ${userId}:`, error);
  }
};

/**
 * Create notification with transaction retry logic
 */
const createNotificationWithTransaction = async (userId, notificationContent, notificationType) => {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.runTransaction(async (transaction) => {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error(`User ${userId} not found`);
        }

        const notificationRef = userRef.collection('notifications').doc();
        const notification = {
          ...notificationContent,
          type: notificationType,
          createdAt: FieldValue.serverTimestamp(),
          read: false
        };

        transaction.set(notificationRef, notification);

        return { success: true, notificationId: notificationRef.id };
      });
    } catch (error) {
      logger.warn(`Transaction attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        logger.error(`All ${maxRetries} transaction attempts failed for user ${userId}`);
        throw error;
      }

      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// ==============================
// Chat and Message Functions
// ==============================

/**
 * Trigger on new chat message creation
 */
const onNewChatMessage = onDocumentCreated("chats/{threadId}/messages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.info("No message data found in event.");
    return;
  }

  const message = snap.data();
  const { threadId } = event.params;
  const { senderId } = message;

  if (!senderId) {
    logger.info("Message is missing senderId.");
    return;
  }

  const threadRef = db.collection("chats").doc(threadId);

  try {
    const threadDoc = await threadRef.get();
    if (!threadDoc.exists) {
      logger.info(`Chat thread ${threadId} does not exist.`);
      return;
    }
    const threadData = threadDoc.data();

    const recipients = (threadData.participants || []).filter((uid) => uid !== senderId);

    if (recipients.length === 0) {
      logger.info(`No recipients to notify for message in thread ${threadId}.`);
      return;
    }

    const senderDoc = await db.collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      logger.info(`Sender document ${senderId} not found.`);
      return;
    }
    const senderData = senderDoc.data();
    const senderName = `${senderData.firstName || ''} ${senderData.lastName || ''}`.trim();

    const senderPhotoUrl = senderData.photoUrl;
    const messageText = message.text || "You received a new message.";

    const notificationPromises = recipients.map(recipientId => {
      return createNotification({
        userId: recipientId,
        type: 'chat_message',
        title: `New Message from ${senderName}`,
        body: messageText,
        docFields: {
          chatId: threadId,
          messageId: snap.id,
          fromUid: senderId,
          fromName: senderName,
          imageUrl: senderPhotoUrl || null,
          route: "/message_thread",
          route_params: JSON.stringify({ "threadId": threadId }),
        },
        data: {
          route: 'message_thread',
          route_params: JSON.stringify({ "threadId": threadId }),
          threadId,
          messageId: snap.id,
          fromUid: senderId
        },
      });
    });

    await Promise.all(notificationPromises);
    logger.info(`Successfully created notifications for ${recipients.length} recipients.`);

    // Update badge for all recipients after creating notifications
    logger.info(`🔔 CHAT MESSAGE: Updating badge for recipients: ${recipients.join(', ')}`);
    const badgeUpdatePromises = recipients.map(userId => updateUserBadge(userId));
    await Promise.allSettled(badgeUpdatePromises);

  } catch (error) {
    logger.error(`Error in onNewChatMessage for thread ${threadId}:`, error);
  }
});

/**
 * Update profile reading permissions when chat is created
 */
const updateCanReadProfileOnChatCreate = onDocumentCreated("chats/{chatId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const chatData = snap.data();
  const { participants } = chatData;
  if (!participants || participants.length !== 2) return;

  const [uid1, uid2] = participants;
  const userRef1 = db.collection("users").doc(uid1);
  const userRef2 = db.collection("users").doc(uid2);
  const batch = db.batch();
  batch.update(userRef1, { can_read_profile: FieldValue.arrayUnion(uid2) });
  batch.update(userRef2, { can_read_profile: FieldValue.arrayUnion(uid1) });

  try {
    await batch.commit();
    logger.info(`Successfully updated can_read_profile permissions for users: ${uid1} and ${uid2}`);
  } catch (error) {
    logger.error("Error updating can_read_profile permissions:", error);
  }
});

// ==============================
// Business and Team Notifications
// ==============================

/**
 * Notify sponsor when team member visits business opportunity
 */
const notifySponsorOfBizOppVisit = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const visitingUserId = request.auth.uid;

  try {
    // Get visiting user data
    const visitingUserDoc = await db.collection("users").doc(visitingUserId).get();
    if (!visitingUserDoc.exists) {
      throw new HttpsError("not-found", "Visiting user not found.");
    }

    const visitingUserData = visitingUserDoc.data();
    const sponsorId = visitingUserData.sponsorId;

    if (!sponsorId) {
      logger.info("Visiting user has no sponsor, skipping notification.");
      return { success: true, message: "No sponsor to notify." };
    }

    // Get sponsor data
    const sponsorDoc = await db.collection("users").doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      logger.warn("Sponsor not found for user:", visitingUserId);
      return { success: true, message: "Sponsor not found." };
    }

    const visitingUserName = `${visitingUserData.firstName || ''} ${visitingUserData.lastName || ''}`.trim();

    // Create notification for sponsor
    await createNotification({
      userId: sponsorId,
      type: 'biz_opp_visit',
      title: '👀 Team Member Activity',
      body: `${visitingUserName} visited the business opportunity page!`,
      docFields: {
        visitingUserId,
        visitingUserName,
        route: "/team",
        route_params: JSON.stringify({ "action": "view_activity" })
      }
    });

    logger.info(`Notified sponsor ${sponsorId} of business opportunity visit by ${visitingUserId}`);
    return { success: true, message: "Sponsor notified successfully." };

  } catch (error) {
    logger.error("Error notifying sponsor of business opportunity visit:", error);
    throw new HttpsError("internal", "Failed to notify sponsor.");
  }
});

// ==============================
// Firestore Trigger Functions
// ==============================

/**
 * Trigger when notification document is created
 */
const onNotificationCreated = onDocumentCreated('users/{userId}/notifications/{notificationId}', async (event) => {
  const { userId, notificationId } = event.params;

  // Config + delivery-mode guards (prevents duplicates)
  if (!NOTIF_TRIGGER_ENABLED) {
    logger.info('TRIGGER: disabled by config; skipping push', { userId, notificationId });
    return;
  }
  if (!isTriggerMode) {
    logger.info('TRIGGER: disabled by delivery_mode; skipping push', { userId, notificationId, DELIVERY_MODE });
    return;
  }

  const d = event.data?.data() || {};
  const payload = {
    type: d.type || 'generic',
    title: d.title || 'Team Build Pro',
    message: d.message || d.body || '',
    route: d.route || '/',
    route_params: (() => { try { return JSON.parse(d.route_params || '{}'); } catch { return {}; } })(),
    imageUrl: d.imageUrl || ''
  };

  // Send push notification
  const push = await sendPushToUser(userId, notificationId, payload);

  // Badge is non-fatal; wrap separately
  try {
    await updateUserBadge(userId);
  } catch (err) {
    logger.info('BADGE: non-fatal error', { userId, notificationId, msg: err?.message });
  }

  logger.info('TRIGGER: done', { userId, notificationId, push });
});

/**
 * Trigger when notification is updated
 */
const onNotificationUpdate = onDocumentUpdated("users/{userId}/notifications/{notificationId}", async (event) => {
  // Implementation for notification updates if needed
  logger.info("Notification updated", event.params);
});

/**
 * Trigger when notification is deleted
 */
const onNotificationDelete = onDocumentDeleted("users/{userId}/notifications/{notificationId}", async (event) => {
  // Implementation for notification deletion cleanup if needed
  logger.info("Notification deleted", event.params);
});

/**
 * Trigger when chat is updated
 */
const onChatUpdate = onDocumentUpdated("chats/{chatId}", async (event) => {
  // Implementation for chat updates if needed
  logger.info("Chat updated", event.params);
});

// ==============================
// Milestone and Achievement Notifications
// ==============================

/**
 * RESTORED ORIGINAL LOGIC: Comprehensive milestone system with business opportunity integration
 * Trigger when user document is updated to check for milestones
 */
const notifyOnMilestoneReached = onDocumentUpdated("users/{userId}", async (event) => {
  const beforeData = event.data?.before?.data();
  const afterData  = event.data?.after?.data();
  const userId = event.params.userId;

  // Log updateMask for debugging but don't filter on it
  try {
    const mask = event.data?.updateMask?.fieldPaths || [];
    console.log(`MILESTONE EVT user=${userId} mask=${JSON.stringify(mask)}`);
  } catch (_) {
    console.log(`MILESTONE EVT user=${userId} mask=<unavailable>`);
  }

  if (!beforeData || !afterData) return;

  console.log(`🎯 MILESTONE: Function triggered for user ${userId}`);

  try {
    // SIMPLIFIED APPROACH: Use index-2.js working logic + upline_refs processing
    // Skip admins from milestone notifications
    if (afterData.role === 'admin') {
      console.log(`MILESTONE: skip admin role for ${userId}`);
      return;
    }

    // Skip if user is already qualified (they get the main qualification notification instead)
    if (afterData.qualifiedDate) {
      console.log(`MILESTONE: skip qualified user ${userId}`);
      return;
    }

    // Check if this is a new user completing registration (has upline_refs but no prior counts)
    // CRITICAL: Only trigger for users with completed profiles to prevent premature milestone notifications
    const isNewUser = (beforeData.directSponsorCount || 0) === 0 &&
                      (beforeData.totalTeamCount || 0) === 0 &&
                      afterData.upline_refs &&
                      afterData.upline_refs.length > 0 &&
                      afterData.isProfileComplete === true;

    if (isNewUser) {
      console.log(`🔔 MILESTONE: New user ${userId} registered, checking upline milestones...`);

      // Check milestones for all upline users (they might have reached team count milestones)
      const uplineRefs = afterData.upline_refs || [];
      for (const uplineUserId of uplineRefs) {
        if (uplineUserId !== userId) {
          console.log(`MILESTONE: Upline user ${uplineUserId} will be checked automatically when their counts update`);
        }
      }
    }

    // Get before/after counts (user's own counts, not sponsor's)
    const beforeDirectSponsors = beforeData.directSponsorCount || 0;
    const afterDirectSponsors = afterData.directSponsorCount || 0;
    const beforeTotalTeam = beforeData.totalTeamCount || 0;
    const afterTotalTeam = afterData.totalTeamCount || 0;

    console.log(`🎯 MILESTONE: User ${userId} - Direct: ${beforeDirectSponsors}→${afterDirectSponsors}, Total: ${beforeTotalTeam}→${afterTotalTeam}`);

    // Only proceed if counts actually increased
    if (afterDirectSponsors <= beforeDirectSponsors && afterTotalTeam <= beforeTotalTeam) {
      console.log(`MILESTONE: no count increase for ${userId}`);
      return;
    }

    // Use hardcoded thresholds (eliminates remote config timeout issues)
    const directMin = 4;
    const teamMin = 20;
    console.log(`MILESTONE: Using hardcoded thresholds - directMin=${directMin}, teamMin=${teamMin}`);

    // Get business opportunity name
    const bizName = await getBusinessOpportunityName(afterData.upline_admin, 'your business');

    let notificationContent = null;

    // Check for direct sponsors milestone (reached directMin but still needs total team)
    if (beforeDirectSponsors < directMin &&
        afterDirectSponsors >= directMin &&
        afterTotalTeam < teamMin) {

      const remainingTeamNeeded = teamMin - afterTotalTeam;
      console.log(`🎯 MILESTONE: User ${userId} reached ${directMin} direct sponsors, needs ${remainingTeamNeeded} more total team members`);

      notificationContent = {
        title: "🎉 Amazing Progress!",
        message: `Congratulations, ${afterData.firstName}! You've reached ${directMin} direct sponsors! Just ${remainingTeamNeeded} more team member${remainingTeamNeeded > 1 ? 's' : ''} needed to unlock your ${bizName} invitation. Keep building!`,
        type: "milestone",
        subtype: "direct",
        route: "/network",
        route_params: {},
      };
    }
    // Check for total team milestone (reached teamMin but still needs direct sponsors)
    else if (beforeTotalTeam < teamMin &&
             afterTotalTeam >= teamMin &&
             afterDirectSponsors < directMin) {

      const remainingDirectNeeded = directMin - afterDirectSponsors;
      console.log(`🎯 MILESTONE: User ${userId} reached ${teamMin} total team, needs ${remainingDirectNeeded} more direct sponsors`);

      notificationContent = {
        title: "🚀 Incredible Growth!",
        message: `Amazing progress, ${afterData.firstName}! You've built a team of ${teamMin}! Just ${remainingDirectNeeded} more direct sponsor${remainingDirectNeeded > 1 ? 's' : ''} needed to qualify for ${bizName}. You're so close!`,
        type: "milestone",
        subtype: "team",
        route: "/network",
        route_params: {},
      };
    }

    // Send notification if a milestone was reached
    if (notificationContent) {
      console.log(`MILESTONE: Creating notification for ${userId} - ${notificationContent.subtype}`);

      // Simple duplicate protection - check if milestone notification already exists
      const existingQuery = await db.collection('users').doc(userId).collection('notifications')
        .where('type', '==', 'milestone')
        .where('subtype', '==', notificationContent.subtype)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        console.log(`MILESTONE: ${notificationContent.subtype} milestone notification already exists for ${userId}, skipping`);
        return;
      }

      const notifId = `milestone_${notificationContent.subtype}_${directMin}_${userId}_${Date.now()}`;

      const result = await createNotification({
        userId,
        notifId,
        type: notificationContent.type,
        title: notificationContent.title,
        body: notificationContent.message,
        docFields: {
          subtype: notificationContent.subtype,
          route: notificationContent.route,
          route_params: JSON.stringify(notificationContent.route_params),
        },
      });

      if (result.ok) {
        console.log(`✅ MILESTONE: Milestone notification created for user ${userId} - ${notificationContent.subtype}`);
      } else {
        console.log(`❌ MILESTONE: Failed to create notification for ${userId}`);
      }
    }

  } catch (error) {
    console.error(`❌ MILESTONE: Error in notifyOnMilestoneReached for user ${userId}:`, error);
    throw error;
  }
});

// ==============================
// Scheduled Notification Functions
// ==============================

/**
 * Send daily team growth notifications - RESTORED ORIGINAL LOGIC
 * Only sends notifications to users who had actual team growth yesterday
 */
const sendDailyTeamGrowthNotifications = onSchedule({
  schedule: "0 * * * *", // Run every hour
  timeZone: "UTC",
  region: "us-central1"
}, async (event) => {
  console.log("🔔 DAILY NOTIFICATIONS: Starting daily team growth notification process");

  try {
    const now = new Date(event.scheduleTime);
    const currentHour = now.getUTCHours();

    console.log(`🔔 DAILY NOTIFICATIONS: Current UTC time: ${now.toISOString()}, Hour: ${currentHour}`);

    // Calculate yesterday's date range in UTC
    const yesterdayStart = new Date(now);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);

    const yesterdayEnd = new Date(now);
    yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    console.log(`🔔 DAILY NOTIFICATIONS: Yesterday range: ${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()}`);

    // Step 1: Get all users who joined yesterday with photoUrl != null (completed profiles)
    console.log("🔔 DAILY NOTIFICATIONS: Querying new members from yesterday...");
    const newMembersSnapshot = await db.collection("users")
      .where("createdAt", ">=", yesterdayStart)
      .where("createdAt", "<=", yesterdayEnd)
      .where("photoUrl", "!=", null)
      .get();

    if (newMembersSnapshot.empty) {
      console.log("🔔 DAILY NOTIFICATIONS: No new members with completed profiles found for yesterday");
      return;
    }

    console.log(`🔔 DAILY NOTIFICATIONS: Found ${newMembersSnapshot.size} new members with completed profiles`);

    // Step 2: Use the efficient approach - extract upline_refs to identify notification recipients
    const notificationCounts = new Map(); // userId -> count of new members
    const newMembersByUpline = new Map(); // userId -> array of new member data

    newMembersSnapshot.docs.forEach(doc => {
      const newMember = doc.data();
      const uplineRefs = newMember.upline_refs || [];

      // CRITICAL: Skip admin users - they should not trigger daily team growth notifications
      if (newMember.role === 'admin') {
        console.log(`🔔 DAILY NOTIFICATIONS: Skipping admin user ${newMember.firstName} ${newMember.lastName} (${doc.id}) - admins don't trigger team notifications`);
        return;
      }

      console.log(`🔔 DAILY NOTIFICATIONS: Processing regular user ${newMember.firstName} ${newMember.lastName} (${doc.id}) with ${uplineRefs.length} upline members`);

      // For each person in this new member's upline, increment their notification count
      uplineRefs.forEach(uplineUserId => {
        if (!notificationCounts.has(uplineUserId)) {
          notificationCounts.set(uplineUserId, 0);
          newMembersByUpline.set(uplineUserId, []);
        }
        notificationCounts.set(uplineUserId, notificationCounts.get(uplineUserId) + 1);
        newMembersByUpline.get(uplineUserId).push({
          uid: doc.id,
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          photoUrl: newMember.photoUrl,
          city: newMember.city,
          state: newMember.state,
          country: newMember.country,
          role: newMember.role // Include role for debugging
        });
      });
    });

    console.log(`🔔 DAILY NOTIFICATIONS: ${notificationCounts.size} users have new team members to be notified about`);

    if (notificationCounts.size === 0) {
      console.log("🔔 DAILY NOTIFICATIONS: No users to notify");
      return;
    }

    // Step 3: Get user details for those who should receive notifications
    const userIds = Array.from(notificationCounts.keys());
    const userPromises = userIds.map(userId => db.collection("users").doc(userId).get());
    const userDocs = await Promise.allSettled(userPromises);

    // Step 4: Filter users by timezone and check for duplicate notifications
    const usersToNotify = [];
    const todayDateString = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    for (let i = 0; i < userDocs.length; i++) {
      const result = userDocs[i];
      if (result.status !== 'fulfilled' || !result.value.exists) {
        continue;
      }

      const userDoc = result.value;
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userTimezone = userData.timezone || 'UTC';

      try {
        // Calculate what time it is in the user's timezone
        const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
        const userLocalHour = userLocalTime.getHours();

        console.log(`🔔 DAILY NOTIFICATIONS: User ${userData.firstName} ${userData.lastName} (${userId}) - Timezone: ${userTimezone}, Local hour: ${userLocalHour}`);

        // Check if it's 10 AM in their timezone (was 10 AM, but comment in original said 10AM)
        if (userLocalHour === 10) {
          // CRITICAL: Check if user already received notification today to prevent duplicates
          const lastNotificationDate = userData.lastDailyNotificationDate;

          if (lastNotificationDate === todayDateString) {
            console.log(`🔔 DAILY NOTIFICATIONS: User ${userId} already received notification today (${todayDateString}). Skipping.`);
            continue;
          }

          console.log(`🔔 DAILY NOTIFICATIONS: User ${userId} eligible for notification. Last notification: ${lastNotificationDate || 'never'}, Today: ${todayDateString}`);

          usersToNotify.push({
            userId: userId,
            userData: userData,
            newMemberCount: notificationCounts.get(userId),
            newMembers: newMembersByUpline.get(userId)
          });
        }
      } catch (timezoneError) {
        console.error(`🔔 DAILY NOTIFICATIONS: Error processing timezone for user ${userId}:`, timezoneError);
        // Skip this user if timezone processing fails
      }
    }

    console.log(`🔔 DAILY NOTIFICATIONS: ${usersToNotify.length} users are in 10am timezone and will receive notifications`);

    if (usersToNotify.length === 0) {
      console.log("🔔 DAILY NOTIFICATIONS: No users in 10am timezone to notify at this time");
      return;
    }

    // Step 5: Send notifications to eligible users and record the date to prevent duplicates
    const notificationPromises = usersToNotify.map(async ({ userId, userData, newMemberCount, newMembers }) => {
      try {
        console.log(`🔔 DAILY NOTIFICATIONS: Creating notification for ${userData.firstName} ${userData.lastName} (${userId}) - ${newMemberCount} new members`);

        const notificationContent = {
          title: "Your Team Is Growing!",
          message: `Your team's momentum is growing, ${userData.firstName}! ${newMemberCount} new member${newMemberCount > 1 ? 's' : ''} joined your downline team yesterday. Click Here to see your team's progress`,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
          type: "new_network_members",
          route: "/network",
          // The route_params are now updated to be more specific to the new report
          route_params: JSON.stringify({ "filter": "newMembersYesterday" }),
        };

        // Use a batch to atomically create notification and update the tracking date
        const batch = db.batch();

        // Add the notification
        const notificationRef = db.collection("users").doc(userId).collection("notifications").doc();
        batch.set(notificationRef, notificationContent);

        // Update user document with today's date to prevent duplicate notifications
        const userRef = db.collection("users").doc(userId);
        batch.update(userRef, {
          lastDailyNotificationDate: todayDateString
        });

        await batch.commit();

        console.log(`✅ DAILY NOTIFICATIONS: Successfully sent notification to ${userData.firstName} ${userData.lastName} and recorded date ${todayDateString}`);
        return { success: true, userId, count: newMemberCount };

      } catch (error) {
        console.error(`❌ DAILY NOTIFICATIONS: Failed to send notification to user ${userId}:`, error);
        return { success: false, userId, error: error.message };
      }
    });

    // Wait for all notifications to be sent
    const results = await Promise.allSettled(notificationPromises);

    // Log summary
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`🔔 DAILY NOTIFICATIONS: Notification summary - Successful: ${successful}, Failed: ${failed}`);
    console.log(`✅ DAILY NOTIFICATIONS: Daily team growth notification process completed`);

  } catch (error) {
    console.error("❌ DAILY NOTIFICATIONS: Critical error in daily team growth notifications:", error);
  }
});

// ==============================
// Launch Campaign Notifications
// ==============================

/**
 * Send launch notification confirmation
 */
const sendLaunchNotificationConfirmation = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { userId, campaignId } = req.body;

    if (!userId || !campaignId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    await createNotification({
      userId,
      type: 'launch_confirmation',
      title: '🚀 Launch Campaign Sent!',
      body: 'Your launch campaign has been successfully sent to your network.',
      docFields: {
        campaignId,
        route: "/campaigns",
        route_params: JSON.stringify({ "action": "view_campaign", "id": campaignId })
      }
    });

    res.status(200).json({ success: true, message: 'Launch notification sent' });

  } catch (error) {
    logger.error("Error sending launch notification confirmation:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================
// Disabled/Legacy Functions (kept for reference)
// ==============================

/**
 * DISABLED: Alternative chat message trigger (replaced by onNewChatMessage)
 */
const onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  // DISABLED: This trigger is replaced by onNewChatMessage to prevent duplicate notifications
  logger.info('onChatMessageCreated: DISABLED - replaced by onNewChatMessage to prevent duplicate chat notifications');
  return;
});

// ==============================
// Profile Completion and Milestone Functions
// ==============================

/**
 * Helper function to check for recent new member notifications to avoid duplicate pushes
 */
async function shouldSendMilestonePush(userId, traceId) {
  try {
    console.log('MST PUSH CHECK: Checking for recent new member notifications', { userId, traceId });

    // Look for recent "new_member" notifications (within 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);

    const recentNotifications = await db.collection('users').doc(userId).collection('notifications')
      .where('type', '==', 'new_member')
      .where('createdAt', '>=', oneMinuteAgo)
      .limit(5)
      .get();

    if (!recentNotifications.empty) {
      console.log('MST PUSH CHECK: Found recent new member notifications, skipping milestone push', {
        userId,
        count: recentNotifications.size,
        traceId
      });
      return false;
    }

    console.log('MST PUSH CHECK: No recent new member notifications found, proceeding with milestone push', { userId, traceId });
    return true;

  } catch (error) {
    console.error('MST PUSH CHECK: Error checking recent notifications, proceeding with milestone push', { userId, traceId, error });
    // If there's an error, err on the side of sending the notification
    return true;
  }
}

/**
 * Manual milestone checker for sponsor/upline users after profile completion
 */
async function checkMilestoneForUserManual(userId, traceId) {
  try {
    console.log(`MST CHECK: Starting milestone check for ${userId}`, { traceId });

    // Get current user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`MST CHECK: User ${userId} does not exist, skipping`);
      return;
    }

    const userData = userDoc.data();

    // Skip admins and qualified users
    if (userData.role === 'admin') {
      console.log(`MST CHECK: User ${userId} is admin, skipping`);
      return;
    }

    if (userData.qualifiedDate) {
      console.log(`MST CHECK: User ${userId} already qualified, skipping`);
      return;
    }

    // Get current counts
    const bDir = 0; // We don't have before data in manual mode
    const aDir = userData.directSponsorCount || 0;
    const bTeam = 0; // We don't have before data in manual mode
    const aTeam = userData.totalTeamCount || 0;

    // Your specified logging pattern
    console.log('MST INPUT', {
      userId,
      bDir,
      aDir,
      bTeam,
      aTeam,
      traceId
    });

    // Hardcoded thresholds
    const directMin = 4;
    const teamMin = 20;

    // Check milestone conditions
    const crossedDirect = aDir >= directMin && aTeam < teamMin;
    const crossedTeam = aTeam >= teamMin && aDir < directMin;
    const qualified = aDir >= directMin && aTeam >= teamMin;

    console.log('MST DECISION', {
      userId,
      crossedDirect,
      crossedTeam,
      qualified,
      traceId
    });

    // Skip if already qualified or no milestone reached
    if (qualified || (!crossedDirect && !crossedTeam)) {
      console.log(`MST CHECK: No milestone for ${userId} - qualified:${qualified}, crossedDirect:${crossedDirect}, crossedTeam:${crossedTeam}`);
      return;
    }

    // Determine milestone type and content
    let notificationContent = null;
    let subtype = null;

    if (crossedDirect) {
      const remainingTeamNeeded = teamMin - aTeam;
      const bizName = await getBusinessOpportunityName(userData.upline_admin, 'your business');

      subtype = 'direct';
      notificationContent = {
        title: "🎉 Amazing Progress!",
        message: `Congratulations, ${userData.firstName}! You've reached ${directMin} direct sponsors! Just ${remainingTeamNeeded} more team member${remainingTeamNeeded > 1 ? 's' : ''} needed to unlock your ${bizName} invitation. Keep building!`,
        type: "milestone",
        subtype: "direct",
        route: "/network",
        route_params: {},
      };
    } else if (crossedTeam) {
      const remainingDirectNeeded = directMin - aDir;
      const bizName = await getBusinessOpportunityName(userData.upline_admin, 'your business');

      subtype = 'team';
      notificationContent = {
        title: "🚀 Incredible Growth!",
        message: `Amazing progress, ${userData.firstName}! You've built a team of ${teamMin}! Just ${remainingDirectNeeded} more direct sponsor${remainingDirectNeeded > 1 ? 's' : ''} needed to qualify for ${bizName}. You're so close!`,
        type: "milestone",
        subtype: "team",
        route: "/network",
        route_params: {},
      };
    }

    if (!notificationContent) {
      console.log(`MST CHECK: No notification content generated for ${userId}`);
      return;
    }

    // Deterministic notification ID (fixes race condition)
    const notifId = `milestone_${subtype}_${directMin}_${userId}`;

    console.log('NOTIF CREATE about-to', {
      path: `users/${userId}/notifications/${notifId}`,
      notifId,
      type: notificationContent.type,
      subtype,
      traceId
    });

    // Create notification with deterministic ID (idempotent)
    const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notifId);

    try {
      await notifRef.create({
        ...notificationContent,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
      });

      console.log('NOTIF CREATE wrote', { notifId, traceId });

      // Check for recent "new_member" notifications to avoid duplicate pushes
      const shouldSendPush = await shouldSendMilestonePush(userId, traceId);

      if (!shouldSendPush) {
        console.log('MST PUSH SKIP: Recent "new_member" notification found, skipping milestone push to avoid duplicates', { userId, notifId, traceId });
        return;
      }

      // Send push notification
      const result = await createNotification({
        userId,
        notifId,
        type: notificationContent.type,
        title: notificationContent.title,
        body: notificationContent.message,
        docFields: {
          subtype: notificationContent.subtype,
          route: notificationContent.route,
          route_params: JSON.stringify(notificationContent.route_params),
        },
      });

      if (result.ok) {
        console.log('PUSH DETAILED', {
          type: notificationContent.type,
          subtype,
          to: userId,
          msgId: result.notificationId || 'unknown',
          notifId,
          traceId
        });
      } else {
        console.error(`MST PUSH: Failed to send push for ${userId}:`, result.push?.reason || 'unknown_error');
      }

    } catch (error) {
      if (error.code === 6) { // ALREADY_EXISTS
        console.log(`MST CHECK: Milestone notification ${notifId} already exists for ${userId}, skipping`);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error(`MST CHECK: Error checking milestones for ${userId}:`, error);
    throw error;
  }
}

/**
 * Deterministic sponsorship notification creation
 * Uses .create() with stable document IDs to prevent duplicates
 */
async function handleSponsorship(newUserId, userDoc, traceId) {
  console.log('SPONSOR: A lookup', { traceId, newUserId });

  let sponsorId = null;

  // 1) FIRST: Look for direct sponsor from referral code (this is the actual sponsor who should get notified)
  const referralCodeRaw = (
    userDoc.referredBy ||
    userDoc.sponsorReferralCode ||
    userDoc.sponsorReferral ||
    ''
  ).toString().trim();

  if (referralCodeRaw) {
    console.log('SPONSOR: B searching for referral code', { traceId, referralCodeRaw });

    // Try case-insensitive match first if you store normalized codes
    const referralCodeLower = referralCodeRaw.toLowerCase();
    let sponsorQuery = await db.collection('users')
      .where('referralCodeLower', '==', referralCodeLower)
      .limit(1)
      .get();

    if (sponsorQuery.empty) {
      // Fallback to the exact field if you don't have the normalized copy
      sponsorQuery = await db.collection('users')
        .where('referralCode', '==', referralCodeRaw)
        .limit(1)
        .get();
    }

    if (!sponsorQuery.empty) {
      sponsorId = sponsorQuery.docs[0].id;
      console.log('SPONSOR: B1 found sponsor via referral code', { traceId, sponsorId, referralCodeRaw });
    } else {
      console.log('SPONSOR: B2 no sponsor found for referral code', { traceId, referralCodeRaw });
    }
  }

  // 2) FALLBACK: Only use upline_admin if no direct sponsor found from referral code
  if (!sponsorId) {
    sponsorId = (userDoc.upline_admin || '').trim() || null;
    if (sponsorId) {
      console.log('SPONSOR: B3 using upline_admin fallback', { traceId, sponsorId });
    }
  }

  if (!sponsorId) {
    console.log('SPONSOR: skip (no sponsor found)', { traceId, newUserId });
    return { sponsorId: null, sponsorName: null };
  }

  const sponsorSnap = await db.collection('users').doc(sponsorId).get();
  if (!sponsorSnap.exists) {
    console.log('SPONSOR: skip (sponsor doc missing)', { traceId, sponsorId });
    return { sponsorId: null, sponsorName: null };
  }
  const sponsorData = sponsorSnap.data();
  const sponsorName = `${sponsorData.firstName} ${sponsorData.lastName}`;

  console.log('SPONSOR: C found sponsor', { traceId, sponsorId, sponsorName });

  // Write back upline_admin when derived from referral code (optimization for future lookups)
  if (!userDoc.upline_admin && sponsorId) {
    try {
      await db.collection('users').doc(newUserId).set({ upline_admin: sponsorId }, { merge: true });
      console.log('SPONSOR: wrote upline_admin', { traceId, newUserId, sponsorId });
    } catch (e) {
      console.warn('SPONSOR: failed to write upline_admin (non-fatal)', { traceId, msg: e?.message });
    }
  }

  // Create deterministic notification ID
  const notifId = `sponsorship_${newUserId}`;

  const newUserLocation = `${userDoc.city || ""}, ${userDoc.state || ""}${userDoc.country ? ` - ${userDoc.country}` : ""}`;
  const bizOppName = await getBusinessOpportunityName(sponsorData.upline_admin);

  let title, message;
  if (userDoc.adminReferral && sponsorData.role === 'admin') {
    title = "🎉 You have a new team member!";
    message = `Congratulations, ${sponsorData.firstName}! Your existing ${bizOppName} partner, ${userDoc.firstName} ${userDoc.lastName}, has joined you on the Team Build Pro app. You're now on the same system to accelerate growth and duplication! Click Here to view their profile.`;
  } else {
    title = "🎉 You have a new team member!";
    message = `Congratulations, ${sponsorData.firstName}! ${userDoc.firstName} ${userDoc.lastName} from ${newUserLocation} has just joined your team on the Team Build Pro app. This is the first step in creating powerful momentum together! Click Here to view their profile.`;
  }

  console.log('SPONSOR: D creating notification', { traceId, sponsorId, notifId });

  const result = await createNotification({
    userId: sponsorId,
    type: 'new_member',
    title,
    body: message,
    notifId,
    docFields: {
      imageUrl: userDoc.photoUrl || null,
      route: '/member_detail',
      route_params: JSON.stringify({ userId: newUserId }),
    },
  });

  if (result.ok) {
    console.log('SPONSOR: E notification created successfully', {
      traceId,
      sponsorId,
      notifId: result.notificationId
    });
  } else {
    console.warn('SPONSOR: notification creation failed', { traceId, sponsorId, notifId });
  }

  return { sponsorId, sponsorName };
}

/**
 * RESTORED ORIGINAL: Profile completion orchestration with execution fuses
 * Handles sponsorship and milestone checking when user completes profile
 */
const onUserProfileCompleted = onDocumentUpdated('users/{uid}', async (event) => {
  // Gate: only run when trigger delivery is explicitly enabled
  const triggerEnabled =
    process.env.NOTIFICATIONS_DELIVERY_MODE === 'trigger' &&
    String(process.env.NOTIFICATIONS_ENABLE_TRIGGER || 'false').toLowerCase() === 'true';

  if (!triggerEnabled) {
    console.info('onUserProfileCompleted: trigger disabled; skipping');
    return;
  }

  const { uid } = event.params;
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};

  const was = !!before.isProfileComplete;
  const now = !!after.isProfileComplete;
  if (was || !now) return;

  const traceId = `profileCompleted_${uid}_${Date.now()}`;
  console.log('ORCH: start', { traceId, uid, was, now });

  // ===== EXECUTION FUSE: Prevent multiple simultaneous executions =====
  const fuseId = `profile_completion_${uid}`;
  const fuseRef = db.collection('execution_fuses').doc(fuseId);

  try {
    // Attempt to create the execution fuse document atomically
    await fuseRef.create({
      uid,
      traceId,
      timestamp: FieldValue.serverTimestamp(),
      type: 'profile_completion'
    });
    console.log('ORCH: execution fuse acquired', { traceId, uid, fuseId });
  } catch (fuseError) {
    // If document already exists, another execution is already running
    if (fuseError?.code === 6 || fuseError?.code === 'already-exists') {
      console.log('ORCH: execution fuse exists - another instance already running', { traceId, uid, fuseId });
      return; // Exit silently to prevent duplicate execution
    }
    // For other errors, log and continue (don't let fuse creation failure break the function)
    console.warn('ORCH: execution fuse creation failed, continuing anyway', { traceId, uid, fuseId, error: fuseError?.message });
  }

  try {
    await handleSponsorship(uid, after, traceId);

    // CRITICAL: Now handle the count increments that were deferred from registerUser
    console.log('COUNT INCREMENT: Profile completed, updating sponsor/upline counts now', { traceId, uid });

    // Get sponsor and upline info for count updates
    const sponsorId = after.sponsor_id || after.upline_admin || after.referredBy || after.sponsorReferralCode || after.sponsorReferral;
    const uplineRefs = after.upline_refs || [];

    if (sponsorId && sponsorId !== uid) {
      console.log(`COUNT INCREMENT: Updating counts for sponsor ${sponsorId} and ${uplineRefs.length} upline members`);

      // DEDUPLICATION SAFEGUARD: Check if this user has already been counted to prevent double-counting
      const deduplicationKey = `profile_counted_${uid}`;
      const dedupeRef = db.collection('count_tracking').doc(deduplicationKey);

      try {
        // Attempt to create the deduplication tracking document atomically
        await dedupeRef.create({
          userId: uid,
          sponsorId,
          countedAt: FieldValue.serverTimestamp(),
          traceId,
          type: 'profile_completion_count'
        });
        console.log('COUNT INCREMENT: Deduplication key acquired', { deduplicationKey, traceId });
      } catch (dedupeError) {
        // If document already exists, this user has already been counted
        if (dedupeError?.code === 6 || dedupeError?.code === 'already-exists') {
          console.log('COUNT INCREMENT: User already counted, skipping to prevent double-counting', { uid, sponsorId, traceId });
          return; // Exit early to prevent duplicate counting
        }
        // For other errors, log warning and continue (don't let deduplication failure break the function)
        console.warn('COUNT INCREMENT: Deduplication check failed, continuing anyway', { uid, sponsorId, traceId, error: dedupeError?.message });
      }

      // Use transaction to atomically update sponsor and upline counts (originally from registerUser)
      await db.runTransaction(async (t) => {
        const sponsorRef = db.collection("users").doc(sponsorId);
        const txSponsorSnap = await t.get(sponsorRef);
        if (!txSponsorSnap.exists) {
          console.warn(`COUNT INCREMENT: Sponsor ${sponsorId} not found in transaction; skipping count updates`);
          return;
        }

        // Atomic increments for sponsor (moved from registerUser)
        const updateObj = {
          directSponsorCount: FieldValue.increment(1),
          totalTeamCount: FieldValue.increment(1),
        };
        t.update(sponsorRef, updateObj);
        console.log('COUNT INCREMENT: Sponsor counts updated', { sponsorId, fields: Object.keys(updateObj), traceId });

        // Atomic increments for each upline member (moved from registerUser)
        for (const uplineMemberId of uplineRefs) {
          if (uplineMemberId !== uid && uplineMemberId !== sponsorId) {
            const uplineRef = db.collection("users").doc(uplineMemberId);
            t.update(uplineRef, { totalTeamCount: FieldValue.increment(1) });
            console.log('COUNT INCREMENT: Upline count updated', { uplineMemberId, traceId });
          }
        }
      });

      console.log(`COUNT INCREMENT: Successfully updated counts for sponsor ${sponsorId} and upline members`);
    } else {
      console.log('COUNT INCREMENT: No sponsor found, skipping count updates', { traceId, uid });
    }

    // OPTION C: Manual milestone checks for sponsor + upline after profile completion
    console.log('MST TRIGGER: Profile completed, checking milestones for sponsor/upline', { traceId, uid });

    console.log('MST INPUT', {
      newUserId: uid,
      sponsorId,
      uplineCount: uplineRefs.length,
      traceId
    });

    // Check milestones for direct sponsor first
    if (sponsorId && sponsorId !== uid) {
      try {
        console.log(`MST SPONSOR: Checking milestones for sponsor ${sponsorId}`);
        await checkMilestoneForUserManual(sponsorId, traceId);
      } catch (error) {
        console.error(`MST SPONSOR: Error checking sponsor ${sponsorId}:`, error);
      }
    }

    // Check milestones for all upline members
    for (const uplineId of uplineRefs) {
      if (uplineId !== uid && uplineId !== sponsorId) {
        try {
          console.log(`MST UPLINE: Checking milestones for upline ${uplineId}`);
          await checkMilestoneForUserManual(uplineId, traceId);
        } catch (error) {
          console.error(`MST UPLINE: Error checking upline ${uplineId}:`, error);
        }
      }
    }

    console.log('ORCH: done', { traceId, uid });
  } catch (err) {
    console.error('ORCH: failed', { traceId, uid, err });
    throw err;
  } finally {
    // Clean up the execution fuse when done (non-blocking)
    try {
      await fuseRef.delete();
      console.log('ORCH: execution fuse cleaned up', { traceId, uid, fuseId });
    } catch (cleanupError) {
      console.warn('ORCH: execution fuse cleanup failed (non-fatal)', { traceId, uid, fuseId, error: cleanupError?.message });
    }
  }
});

// ==============================
// Manual Sponsorship Trigger (Reliability Backstop)
// ==============================

const triggerSponsorship = onCall(
  { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const traceId = `manual_orch_${uid}_${Date.now()}`;
    console.log('ORCH: manual start', { traceId, uid });

    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'User not found');

    const data = snap.data() || {};
    // Only run when profile is complete to mirror the orchestrator gate.
    if (!data.isProfileComplete) {
      console.log('ORCH: manual skip (profile incomplete)', { traceId, uid });
      return { ok: false, reason: 'profile_incomplete' };
    }

    const result = await handleSponsorship(uid, data, traceId);
    console.log('ORCH: manual done', { traceId, uid, result });

    // Manually trigger milestone check for the sponsor ONLY if the new user has completed their profile
    if (result?.sponsorId) {
      console.log('🎯 MANUAL MILESTONE: Checking if new user has completed profile before triggering milestone', { sponsorId: result.sponsorId, traceId, newUserId: uid });

      try {
        // Check if the new user has completed their profile
        console.log('🎯 MANUAL MILESTONE: About to check new user profile completion', { newUserId: uid, sponsorId: result.sponsorId, traceId });
        const newUserDoc = await db.collection('users').doc(uid).get();
        console.log('🎯 MANUAL MILESTONE: Got new user document', { exists: newUserDoc.exists, newUserId: uid });

        const newUserData = newUserDoc.data();
        const isProfileComplete = newUserData?.isProfileComplete === true;

        console.log('🎯 MANUAL MILESTONE: New user profile status', {
          newUserId: uid,
          isProfileComplete,
          hasPhoto: !!newUserData?.photoUrl,
          hasLocation: !!(newUserData?.country && newUserData?.state),
          sponsorId: result.sponsorId,
          traceId
        });

        if (isProfileComplete) {
          console.log('🎯 MANUAL MILESTONE: New user profile is complete, triggering milestone check for sponsor', { sponsorId: result.sponsorId, traceId });
          await checkMilestoneForUserManual(result.sponsorId, traceId);
          console.log('✅ MANUAL MILESTONE: Milestone check completed for sponsor', { sponsorId: result.sponsorId, traceId });
        } else {
          console.log('🔄 MANUAL MILESTONE: New user profile incomplete, skipping milestone check for sponsor', { sponsorId: result.sponsorId, traceId });
        }
      } catch (milestoneError) {
        console.error('❌ MANUAL MILESTONE: Error checking milestone for sponsor', { sponsorId: result.sponsorId, traceId, error: milestoneError });
        // Don't fail the triggerSponsorship if milestone check fails
      }
    }

    return {
      ok: true,
      sponsorId: result?.sponsorId || null,
      sponsorName: result?.sponsorName || null
    };
  }
);

// ==============================
// Exports
// ==============================

module.exports = {
  // Core helper functions
  sendPushToUser,
  updateUserBadge,
  createNotification,
  createNotificationWithTransaction,

  // User-facing badge management
  clearAppBadge,
  syncAppBadge,

  // Subscription functions
  upsertAppleV2NotificationState,
  updateUserSubscription,
  createSubscriptionNotification,
  createSubscriptionNotificationV2,

  // Chat and message functions
  onNewChatMessage,
  updateCanReadProfileOnChatCreate,
  onChatMessageCreated, // Disabled but exported for reference

  // Business and team notifications
  notifySponsorOfBizOppVisit,

  // Firestore triggers
  onNotificationCreated,
  onNotificationUpdate,
  onNotificationDelete,
  onChatUpdate,

  // Milestone and achievement functions
  notifyOnMilestoneReached,
  onUserProfileCompleted,
  triggerSponsorship,

  // Scheduled functions
  sendDailyTeamGrowthNotifications,

  // Launch campaign functions
  sendLaunchNotificationConfirmation,

  // Utility functions
  toStringMap,
  resolveBestFcmTokenForUser,
  cleanupDeadToken,
};