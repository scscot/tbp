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
  functions,
  admin,
  db,
  FieldValue,
  FieldPath,
  auth,
  NOTIF_TRIGGER_ENABLED,
  DELIVERY_MODE,
  isHelperMode,
  isTriggerMode,
  validateAuthentication,
  validateAdminRole,
  validateUserRole,
  getUserDocument,
  retryWithBackoff,
  validateInput,
  sanitizeInput,
  getTimestamp,
  createError,
  checkRateLimit,
} = require('./shared/utilities');

// Additional Firebase setup
const messaging = admin.messaging();

// ==============================
// Core Notification Helper Functions
// ==============================

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
        try { await cleanupDeadToken(userRef, token); } catch (_) {}
      }
    }
  } catch (error) {
    logger.error(`❌ BADGE UPDATE: Failed for ${userId}:`, error.message);
  }
};

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
 * Trigger when user document is updated to check for milestones
 */
const notifyOnMilestoneReached = onDocumentUpdated("users/{userId}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();

  if (!after || !before) return;

  const { userId } = event.params;

  // Check if team count increased
  const beforeTeamCount = before.totalTeamCount || 0;
  const afterTeamCount = after.totalTeamCount || 0;

  if (afterTeamCount > beforeTeamCount) {
    // Check for milestone achievements
    const milestones = [5, 10, 25, 50, 100, 250, 500, 1000];

    for (const milestone of milestones) {
      if (beforeTeamCount < milestone && afterTeamCount >= milestone) {
        await createNotification({
          userId,
          type: 'milestone_reached',
          title: '🎉 Milestone Reached!',
          body: `Congratulations! Your team has grown to ${milestone} members!`,
          docFields: {
            milestone,
            teamCount: afterTeamCount,
            route: "/team",
            route_params: JSON.stringify({ "action": "view_stats" })
          }
        });

        logger.info(`Milestone notification sent for user ${userId}: ${milestone} team members`);
      }
    }
  }
});

// ==============================
// Scheduled Notification Functions
// ==============================

/**
 * Send daily team growth notifications
 */
const sendDailyTeamGrowthNotifications = onSchedule({
  schedule: "0 9 * * *", // 9 AM daily
  timeZone: "America/New_York",
  region: "us-central1"
}, async (event) => {
  logger.info("Starting daily team growth notifications");

  try {
    // Get all users with teams
    const usersSnapshot = await db.collection('users')
      .where('totalTeamCount', '>', 0)
      .get();

    const notificationPromises = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const teamCount = userData.totalTeamCount || 0;

      // Only send to users with significant teams (5+ members)
      if (teamCount >= 5) {
        notificationPromises.push(
          createNotification({
            userId,
            type: 'daily_team_update',
            title: '👥 Your Team Update',
            body: `Your team has ${teamCount} members. Keep growing!`,
            docFields: {
              teamCount,
              route: "/team",
              route_params: JSON.stringify({ "action": "view_team" })
            }
          })
        );
      }
    }

    await Promise.allSettled(notificationPromises);
    logger.info(`Sent daily team growth notifications to ${notificationPromises.length} users`);

  } catch (error) {
    logger.error("Error sending daily team growth notifications:", error);
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
// Exports
// ==============================

module.exports = {
  // Core helper functions
  sendPushToUser,
  updateUserBadge,
  createNotification,
  createNotificationWithTransaction,

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

  // Scheduled functions
  sendDailyTeamGrowthNotifications,

  // Launch campaign functions
  sendLaunchNotificationConfirmation,

  // Utility functions
  toStringMap,
  resolveBestFcmTokenForUser,
  cleanupDeadToken,
};