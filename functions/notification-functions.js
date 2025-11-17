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

const { getNotificationText } = require('./translations');
const { trackFCMDelivery, trackMilestoneNotification, recordMetric } = require('./monitoring-functions');

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

    // Validate userData exists
    if (!userData || typeof userData !== 'object') {
      logger.warn(`MILESTONE UPLINE: Invalid userData for user ${userId}`);
      return;
    }

    // Skip admins and qualified users
    if (userData.role === 'admin' || userData.qualifiedDate) {
      console.log(`MILESTONE UPLINE: Skipping ${userId} - admin or qualified`);
      return;
    }

    // Safely extract and validate counts
    const directSponsors = Number(userData.directSponsorCount) || 0;
    const totalTeam = Number(userData.totalTeamCount) || 0;

    if (isNaN(directSponsors) || isNaN(totalTeam)) {
      logger.warn(`MILESTONE UPLINE: Invalid milestone counts for user ${userId} - Direct: ${userData.directSponsorCount}, Team: ${userData.totalTeamCount}`);
      return;
    }

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
        const userLang = userData.preferredLanguage || 'en';

        notificationContent = {
          title: getNotificationText('milestoneDirectTitle', userLang),
          message: getNotificationText('milestoneDirectMessage', userLang, {
            firstName: userData.firstName,
            directCount: directMin,
            remainingTeam: remainingTeamNeeded,
            pluralTeam: remainingTeamNeeded > 1 ? 's' : '',
            bizName: bizName,
          }),
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
        const userLang = userData.preferredLanguage || 'en';

        notificationContent = {
          title: getNotificationText('milestoneTeamTitle', userLang),
          message: getNotificationText('milestoneTeamMessage', userLang, {
            firstName: userData.firstName,
            teamCount: teamMin,
            remainingDirect: remainingDirectNeeded,
            pluralDirect: remainingDirectNeeded > 1 ? 's' : '',
            bizName: bizName,
          }),
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
        await trackMilestoneNotification(userId, notificationContent.subtype, 'success', {
          directSponsors,
          totalTeam,
        });
      } else {
        console.log(`❌ MILESTONE UPLINE: Failed to create notification for ${userId}`);
        await trackMilestoneNotification(userId, notificationContent.subtype, 'failure', {
          directSponsors,
          totalTeam,
          error: result.error || 'unknown',
        });
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
  let token = null, source = 'none', tokenDoc = null;

  // Tier 1 (NEW PRIORITY): users/{uid}/fcmTokens/{tokenId} subcollection
  // This is now the PRIMARY source - most up-to-date and tracks device metadata
  try {
    const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
    if (!sub.empty) {
      tokenDoc = sub.docs[0];
      const tokenData = tokenDoc.data();
      token = (tokenData.token || tokenDoc.id).trim();
      source = 'fcmTokens(subcollection)';

      // Update lastUsedAt to track token usage for stale cleanup
      try {
        await tokenDoc.ref.update({
          lastUsedAt: FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        // Non-critical - continue if lastUsedAt update fails
        logger.warn(`Could not update lastUsedAt for token ${tokenDoc.id}:`, updateError.message);
      }
    }
  } catch (e) {
    // Fallback: Try ordering by document ID if updatedAt field doesn't exist
    try {
      const sub = await userRef.collection('fcmTokens').orderBy(FieldPath.documentId()).limit(1).get();
      if (!sub.empty) {
        tokenDoc = sub.docs[0];
        token = (tokenDoc.data().token || tokenDoc.id).trim();
        source = 'fcmTokens(subcollection)';
      }
    } catch (fallbackError) {
      logger.error(`FCM token subcollection query failed for user ${userRef.id}:`, fallbackError);
    }
  }

  // Tier 2 (LEGACY FALLBACK): users/{uid}.fcm_token field
  if (!token) {
    const data = userDataMaybe || (await userRef.get()).data() || {};
    if (typeof data.fcm_token === 'string' && data.fcm_token.trim()) {
      token = data.fcm_token.trim();
      source = 'fcm_token(legacy)';
    }
  }

  // Tier 3 (LEGACY FALLBACK): users/{uid}.fcmTokens[0] array
  if (!token) {
    const data = userDataMaybe || (await userRef.get()).data() || {};
    if (Array.isArray(data.fcmTokens) && data.fcmTokens.length) {
      const first = (data.fcmTokens.find(t => typeof t === 'string' && t.trim()) || '').trim();
      if (first) {
        token = first;
        source = 'fcmTokens[0](legacy)';
      }
    }
  }

  return { token, source, tokenDoc };
}

/**
 * Cleanup dead FCM tokens from all storage locations
 * @param {DocumentReference} userRef - Reference to the user document
 * @param {string} token - The dead FCM token to remove
 * @param {DocumentSnapshot} tokenDocSnap - Optional: the tokenDoc from resolution for efficient deletion
 */
async function cleanupDeadToken(userRef, token, tokenDocSnap) {
  if (!token) return;

  const batch = db.batch();

  try {
    // Remove from legacy fcm_token field
    batch.update(userRef, { fcm_token: FieldValue.delete() });

    // Remove from legacy fcmTokens array
    batch.update(userRef, { fcmTokens: FieldValue.arrayRemove(token) });

    // Remove from fcmTokens subcollection (primary storage)
    if (tokenDocSnap && tokenDocSnap.exists) {
      // Use the provided tokenDoc reference for efficient deletion
      batch.delete(tokenDocSnap.ref);
    } else {
      // Fallback: construct the document reference from the token
      const tokenDoc = userRef.collection('fcmTokens').doc(token);
      batch.delete(tokenDoc);
    }

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
  const { token, source, tokenDoc } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);

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

    // Track successful FCM delivery
    await trackFCMDelivery(userId, true);

    return { sent: true, reason: 'sent', tokenSource: source };
  } catch (err) {
    const code = (err && err.code) || '';
    logger.error('PUSH: error', { userId, notificationId, code, msg: err.message });

    // Track failed FCM delivery
    await trackFCMDelivery(userId, false, err.message);

    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token, tokenDoc);
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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`User ${userId} not found for subscription notification`);
      return;
    }
    const userData = userDoc.data();
    const userLang = userData.preferredLanguage || 'en';

    let notificationContent = null;

    switch (status) {
      case 'active':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: getNotificationText('subscriptionActiveTitle', userLang),
            message: getNotificationText('subscriptionActiveMessage', userLang, {
              expiryDate: expiry.toLocaleDateString(),
            }),
            type: "subscription_active"
          };
        }
        break;

      case 'cancelled':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: getNotificationText('subscriptionCancelledTitle', userLang),
            message: getNotificationText('subscriptionCancelledMessage', userLang, {
              expiryDate: expiry.toLocaleDateString(),
            }),
            type: "subscription_cancelled"
          };
        }
        break;

      case 'expired':
        notificationContent = {
          title: getNotificationText('subscriptionExpiredTitle', userLang),
          message: getNotificationText('subscriptionExpiredMessage', userLang),
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
            title: getNotificationText('subscriptionExpiringSoonTitle', userLang),
            message: getNotificationText('subscriptionExpiringSoonMessage', userLang, {
              expiryDate: formattedDate,
            }),
            type: "subscription_expiring_soon",
            route: "/subscription",
            route_params: JSON.stringify({ "action": "renew" })
          };
        }
        break;

      case 'paused':
        notificationContent = {
          title: getNotificationText('subscriptionPausedTitle', userLang),
          message: getNotificationText('subscriptionPausedMessage', userLang),
          type: "subscription_paused",
          route: "/subscription",
          route_params: JSON.stringify({ "action": "resume" })
        };
        break;

      case 'on_hold':
        notificationContent = {
          title: getNotificationText('subscriptionPaymentIssueTitle', userLang),
          message: getNotificationText('subscriptionPaymentIssueMessage', userLang),
          type: "subscription_on_hold",
          route: "/subscription",
          route_params: JSON.stringify({ "action": "update_payment" })
        };
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
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`User ${userId} not found for subscription notification V2`);
      return;
    }
    const userData = userDoc.data();
    const userLang = userData.preferredLanguage || 'en';

    let notificationContent = null;

    switch (status) {
      case 'active':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: getNotificationText('subscriptionActiveTitle', userLang),
            message: getNotificationText('subscriptionActiveMessage', userLang, {
              expiryDate: expiry.toLocaleDateString(),
            }),
            type: "subscription_active",
            additionalInfo
          };
        }
        break;

      case 'cancelled':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate);
          notificationContent = {
            title: getNotificationText('subscriptionCancelledTitle', userLang),
            message: getNotificationText('subscriptionCancelledMessage', userLang, {
              expiryDate: expiry.toLocaleDateString(),
            }),
            type: "subscription_cancelled",
            additionalInfo
          };
        }
        break;

      case 'expired':
        notificationContent = {
          title: getNotificationText('subscriptionExpiredTitle', userLang),
          message: getNotificationText('subscriptionExpiredMessage', userLang),
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

    const notificationPromises = recipients.map(async recipientId => {
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      const recipientLang = recipientDoc.exists && recipientDoc.data().preferredLanguage
        ? recipientDoc.data().preferredLanguage
        : 'en';

      return createNotification({
        userId: recipientId,
        type: 'chat_message',
        title: getNotificationText('chatMessageTitle', recipientLang, {
          senderName: senderName,
        }),
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
  try {
    const snap = event.data;
    if (!snap) {
      logger.warn('updateCanReadProfileOnChatCreate: No event data');
      return;
    }

    const chatData = snap.data();
    if (!chatData) {
      logger.warn('updateCanReadProfileOnChatCreate: No chat data');
      return;
    }

    const { participants } = chatData;
    if (!participants || !Array.isArray(participants) || participants.length !== 2) {
      logger.warn(`updateCanReadProfileOnChatCreate: Invalid participants array - length: ${participants?.length}`);
      return;
    }

    const [uid1, uid2] = participants;
    if (!uid1 || !uid2) {
      logger.warn('updateCanReadProfileOnChatCreate: Invalid participant UIDs');
      return;
    }

    const userRef1 = db.collection("users").doc(uid1);
    const userRef2 = db.collection("users").doc(uid2);
    const batch = db.batch();
    batch.update(userRef1, { can_read_profile: FieldValue.arrayUnion(uid2) });
    batch.update(userRef2, { can_read_profile: FieldValue.arrayUnion(uid1) });

    await batch.commit();
    logger.info(`✅ CHAT PERMISSIONS: Updated can_read_profile for users ${uid1} and ${uid2}`);
  } catch (error) {
    logger.error(`❌ CHAT PERMISSIONS: Failed to update can_read_profile for chat ${event.params.chatId}:`, error);
    // Don't throw - log and continue to prevent chat creation failures
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
    const uplineRefs = visitingUserData.upline_refs || [];

    // Find business opportunity sponsor by traversing upline_refs
    // This matches the logic in business_screen.dart
    let bizOppSponsorId = null;
    for (const uplineId of uplineRefs) {
      const uplineDoc = await db.collection("users").doc(uplineId).get();
      if (uplineDoc.exists) {
        const uplineData = uplineDoc.data();
        if (uplineData.biz_opp_ref_url) {
          bizOppSponsorId = uplineId;
          logger.info(`✅ BIZ OPP VISIT: Found biz opp sponsor ${bizOppSponsorId} for user ${visitingUserId}`);
          break;
        }
      }
    }

    // ALWAYS update biz_visit_date and lock in the sponsor (if found)
    const updateData = {
      biz_visit_date: FieldValue.serverTimestamp()
    };

    if (bizOppSponsorId) {
      updateData.biz_opp_sponsor_id = bizOppSponsorId;
    }

    await db.collection("users").doc(visitingUserId).update(updateData);

    if (!bizOppSponsorId) {
      logger.info("✅ BIZ OPP VISIT: Updated biz_visit_date for user with no biz opp sponsor:", visitingUserId);
      return { success: true, message: "Visit date recorded (no business opportunity sponsor found)." };
    }

    // Get sponsor data for notification
    const sponsorDoc = await db.collection("users").doc(bizOppSponsorId).get();
    if (!sponsorDoc.exists) {
      logger.warn("Business opportunity sponsor not found:", bizOppSponsorId);
      return { success: true, message: "Visit date recorded but sponsor not found." };
    }

    const sponsorData = sponsorDoc.data();
    const sponsorLang = sponsorData.preferredLanguage || 'en';

    const visitingUserName = `${visitingUserData.firstName || ''} ${visitingUserData.lastName || ''}`.trim();
    const firstName = visitingUserData.firstName || '';
    const lastName = visitingUserData.lastName || '';
    const bizName = visitingUserData.bizOpp || sponsorData.biz_opp || 'business opportunity';

    // Create notification for business opportunity sponsor
    await createNotification({
      userId: bizOppSponsorId,
      type: 'biz_opp_visit',
      title: getNotificationText('teamActivityTitle', sponsorLang),
      body: getNotificationText('teamActivityMessage', sponsorLang, {
        firstName: firstName,
        lastName: lastName,
        bizName: bizName,
      }),
      docFields: {
        visitingUserId,
        visitingUserName,
        route: "/team",
        route_params: JSON.stringify({ "action": "view_activity" })
      }
    });

    logger.info(`✅ BIZ OPP VISIT: Updated biz_visit_date, locked sponsor ${bizOppSponsorId}, and sent notification for user ${visitingUserId}`);
    return { success: true, message: "Visit date recorded and sponsor notified." };

  } catch (error) {
    logger.error("Error notifying sponsor of business opportunity visit:", error);
    throw new HttpsError("internal", "Failed to notify sponsor.");
  }
});

const notifySponsorOfBizOppCompletion = onDocumentUpdated('users/{userId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const userId = event.params.userId;

  // Only trigger when biz_join_date transitions from null to set
  const wasNull = !before?.biz_join_date;
  const nowSet = !!after?.biz_join_date;

  if (!wasNull || !nowSet) {
    return;
  }

  // Check if already notified
  if (after.biz_completion_notified === true) {
    logger.info(`Completion already notified for user ${userId}, skipping`);
    return;
  }

  // Execution fuse for idempotency
  const fuseId = `bizOppCompletion_${userId}`;
  const fuseRef = db.collection('execution_fuses').doc(fuseId);

  try {
    await fuseRef.create({
      userId,
      timestamp: FieldValue.serverTimestamp(),
      type: 'biz_opp_completion'
    });
  } catch (e) {
    if (e?.code === 6 || e?.code === 'already-exists') {
      logger.info(`Completion notification already sent for user ${userId}`);
      return;
    }
  }

  try {
    // Use the locked-in business opportunity sponsor
    const sponsorId = after.biz_opp_sponsor_id;

    if (!sponsorId) {
      logger.info(`User ${userId} has no locked-in biz opp sponsor, skipping completion notification`);
      return;
    }

    const sponsorDoc = await db.collection('users').doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      logger.warn(`Sponsor ${sponsorId} not found for user ${userId}`);
      return;
    }

    const sponsorData = sponsorDoc.data();
    const sponsorLang = sponsorData.preferredLanguage || 'en';
    const userName = `${after.firstName || ''} ${after.lastName || ''}`.trim();
    const bizName = after.biz_opp || await getBusinessOpportunityName(after.upline_admin, 'business opportunity');

    // Create notification for sponsor
    const notifId = `bizOppCompletion_${userId}`;
    await createNotification({
      userId: sponsorId,
      notifId,
      type: 'biz_opp_completion',
      title: getNotificationText('bizOppCompletionTitle', sponsorLang, { bizName }),
      body: getNotificationText('bizOppCompletionMessage', sponsorLang, {
        firstName: after.firstName,
        lastName: after.lastName,
        bizName: bizName,
      }),
      docFields: {
        completedUserId: userId,
        completedUserName: userName,
        route: '/team',
        route_params: JSON.stringify({ action: 'view_activity' })
      }
    });

    logger.info(`Notified sponsor ${sponsorId} of ${bizName} completion by ${userId}`);

    // Mark as notified to prevent duplicates
    await db.collection('users').doc(userId).update({
      biz_completion_notified: true,
      biz_completion_notified_at: FieldValue.serverTimestamp()
    });

  } catch (error) {
    logger.error(`Error notifying sponsor of biz opp completion for ${userId}:`, error);
  } finally {
    // Clean up fuse
    try {
      await fuseRef.delete();
    } catch (e) {
      logger.warn('Failed to cleanup execution fuse (non-fatal)');
    }
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
      const userLang = afterData.preferredLanguage || 'en';
      console.log(`🎯 MILESTONE: User ${userId} reached ${directMin} direct sponsors, needs ${remainingTeamNeeded} more total team members`);

      notificationContent = {
        title: getNotificationText('milestoneDirectTitle', userLang),
        message: getNotificationText('milestoneDirectMessage', userLang, {
          firstName: afterData.firstName,
          directCount: directMin,
          remainingTeam: remainingTeamNeeded,
          pluralTeam: remainingTeamNeeded > 1 ? 's' : '',
          bizName: bizName,
        }),
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
      const userLang = afterData.preferredLanguage || 'en';
      console.log(`🎯 MILESTONE: User ${userId} reached ${teamMin} total team, needs ${remainingDirectNeeded} more direct sponsors`);

      notificationContent = {
        title: getNotificationText('milestoneTeamTitle', userLang),
        message: getNotificationText('milestoneTeamMessage', userLang, {
          firstName: afterData.firstName,
          teamCount: teamMin,
          remainingDirect: remainingDirectNeeded,
          pluralDirect: remainingDirectNeeded > 1 ? 's' : '',
          bizName: bizName,
        }),
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
// Testing and Debugging Functions
// ==============================

/**
 * Test push notifications for all notification types
 * Callable function to validate FCM delivery across all notification types
 */
const testPushNotifications = onCall(
  { region: 'us-central1', timeoutSeconds: 60, memory: '512MiB' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in');

    const traceId = `test_notif_${uid}_${Date.now()}`;
    console.log('TEST NOTIF: Starting notification tests', { traceId, uid });

    const { notificationTypes } = req.data || {};
    const typesToTest = notificationTypes || [
      'milestone_direct',
      'milestone_team',
      'chat_message',
      'subscription_active',
      'subscription_cancelled',
      'subscription_expired',
      'subscription_expiring_soon',
      'biz_opp_visit',
      'new_member',
      'new_network_members',
      'launch_confirmation'
    ];

    const results = {};

    // Get user data for personalized messages
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();
    const firstName = userData.firstName || 'User';

    // Test each notification type
    for (const type of typesToTest) {
      try {
        console.log(`TEST NOTIF: Testing ${type}`, { traceId, uid });

        let notificationContent = null;
        const notifId = `test_${type}_${uid}_${Date.now()}`;

        switch (type) {
          case 'milestone_direct':
            notificationContent = {
              type: 'milestone',
              title: '🎉 Amazing Progress!',
              body: `[TEST] Congratulations, ${firstName}! You've reached 4 direct sponsors! Just 15 more team members needed to unlock your business invitation. Keep building!`,
              docFields: {
                subtype: 'direct',
                route: '/network',
                route_params: JSON.stringify({}),
              }
            };
            break;

          case 'milestone_team':
            notificationContent = {
              type: 'milestone',
              title: '🚀 Incredible Growth!',
              body: `[TEST] Amazing progress, ${firstName}! You've built a team of 20! Just 3 more direct sponsors needed to qualify for your business. You're so close!`,
              docFields: {
                subtype: 'team',
                route: '/network',
                route_params: JSON.stringify({}),
              }
            };
            break;

          case 'chat_message':
            notificationContent = {
              type: 'chat_message',
              title: 'New Message from Test User',
              body: '[TEST] This is a test chat message notification',
              docFields: {
                chatId: 'test_thread_123',
                messageId: 'test_msg_456',
                fromUid: uid,
                fromName: 'Test User',
                route: '/message_thread',
                route_params: JSON.stringify({ threadId: 'test_thread_123' }),
              }
            };
            break;

          case 'subscription_active':
            notificationContent = {
              type: 'subscription_active',
              title: '✅ Subscription Active',
              body: `[TEST] Your subscription is now active until ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}.`,
              docFields: {}
            };
            break;

          case 'subscription_cancelled':
            notificationContent = {
              type: 'subscription_cancelled',
              title: '⚠️ Subscription Cancelled',
              body: `[TEST] Your subscription has been cancelled but remains active until ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}.`,
              docFields: {}
            };
            break;

          case 'subscription_expired':
            notificationContent = {
              type: 'subscription_expired',
              title: '❌ Subscription Expired',
              body: '[TEST] Your subscription has expired. Renew now to keep building your team and accessing all recruiting tools.',
              docFields: {
                route: '/subscription',
                route_params: JSON.stringify({ action: 'renew' }),
              }
            };
            break;

          case 'subscription_expiring_soon':
            notificationContent = {
              type: 'subscription_expiring_soon',
              title: '⏰ Subscription Expiring Soon',
              body: `[TEST] Your subscription expires on ${new Date(Date.now() + 5*24*60*60*1000).toLocaleDateString()}. Renew now to avoid interruption.`,
              docFields: {
                route: '/subscription',
                route_params: JSON.stringify({ action: 'renew' }),
              }
            };
            break;

          case 'biz_opp_visit':
            notificationContent = {
              type: 'biz_opp_visit',
              title: '👀 Team Member Activity',
              body: `[TEST] Test User visited the business opportunity page!`,
              docFields: {
                visitingUserId: uid,
                visitingUserName: 'Test User',
                route: '/team',
                route_params: JSON.stringify({ action: 'view_activity' }),
              }
            };
            break;

          case 'new_member':
            notificationContent = {
              type: 'new_member',
              title: '🎉 You have a new team member!',
              body: `[TEST] Congratulations, ${firstName}! Test User from Test City, Test State has just joined your team on the Team Build Pro app. This is the first step in creating powerful momentum together! Click Here to view their profile.`,
              docFields: {
                route: '/member_detail',
                route_params: JSON.stringify({ userId: uid }),
              }
            };
            break;

          case 'new_network_members':
            notificationContent = {
              type: 'new_network_members',
              title: 'Your Team Is Growing!',
              body: `[TEST] Your team's momentum is growing, ${firstName}! 3 new members joined your downline team yesterday. Click Here to see your team's progress`,
              docFields: {
                route: '/network',
                route_params: JSON.stringify({ filter: 'newMembersYesterday' }),
              }
            };
            break;

          case 'launch_confirmation':
            notificationContent = {
              type: 'launch_confirmation',
              title: '🚀 Launch Campaign Sent!',
              body: '[TEST] Your launch campaign has been successfully sent to your network.',
              docFields: {
                campaignId: 'test_campaign_123',
                route: '/campaigns',
                route_params: JSON.stringify({ action: 'view_campaign', id: 'test_campaign_123' }),
              }
            };
            break;

          default:
            console.warn(`TEST NOTIF: Unknown notification type ${type}`, { traceId });
            continue;
        }

        if (notificationContent) {
          const result = await createNotification({
            userId: uid,
            notifId,
            type: notificationContent.type,
            title: notificationContent.title,
            body: notificationContent.body,
            docFields: notificationContent.docFields,
          });

          results[type] = {
            success: result.ok,
            notificationId: result.notificationId,
            message: result.ok ? 'Notification created and sent' : 'Failed to create notification'
          };

          console.log(`TEST NOTIF: ${type} - ${result.ok ? 'SUCCESS' : 'FAILED'}`, { traceId, notifId: result.notificationId });
        }

      } catch (error) {
        console.error(`TEST NOTIF: Error testing ${type}:`, { traceId, error: error.message });
        results[type] = {
          success: false,
          message: error.message
        };
      }
    }

    const summary = {
      total: Object.keys(results).length,
      successful: Object.values(results).filter(r => r.success).length,
      failed: Object.values(results).filter(r => !r.success).length
    };

    console.log('TEST NOTIF: Complete', { traceId, uid, summary });

    return {
      success: true,
      userId: uid,
      summary,
      results,
      traceId
    };
  }
);

// ============================================================================
// SCHEDULED FCM TOKEN CLEANUP
// ============================================================================

/**
 * Weekly scheduled function to cleanup stale FCM tokens
 * Removes tokens that haven't been used in 90 days to keep the database clean
 * and prevent pushes to long-inactive devices
 */
const cleanupStaleFcmTokens = onSchedule(
  {
    schedule: '0 2 * * 0', // Weekly at 2am UTC on Sundays
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    logger.info('🧹 FCM TOKEN CLEANUP: Starting weekly cleanup of stale tokens');

    const now = Date.now();
    const staleThresholdMs = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
    const staleTimestamp = new Date(now - staleThresholdMs);

    let totalScanned = 0;
    let totalDeleted = 0;
    let usersProcessed = 0;
    let errors = 0;

    try {
      // Query all users (using select() for minimal data transfer)
      const usersSnap = await db.collection('users').select().get();
      logger.info(`🧹 FCM TOKEN CLEANUP: Found ${usersSnap.size} users to process`);

      // Process users in batches to avoid memory issues
      for (const userDoc of usersSnap.docs) {
        try {
          // Query tokens older than 90 days based on updatedAt
          const staleTokensSnap = await userDoc.ref
            .collection('fcmTokens')
            .where('updatedAt', '<', staleTimestamp)
            .get();

          totalScanned += staleTokensSnap.size;

          if (!staleTokensSnap.empty) {
            // Delete stale tokens in batch (max 500 per batch)
            const batch = db.batch();
            let batchCount = 0;

            for (const tokenDoc of staleTokensSnap.docs) {
              batch.delete(tokenDoc.ref);
              batchCount++;
              totalDeleted++;

              // Commit batch if we hit 500 operations
              if (batchCount >= 500) {
                await batch.commit();
                batchCount = 0;
              }
            }

            // Commit remaining operations
            if (batchCount > 0) {
              await batch.commit();
            }

            logger.info(
              `🧹 FCM TOKEN CLEANUP: Deleted ${staleTokensSnap.size} stale tokens for user ${userDoc.id}`
            );
          }

          usersProcessed++;
        } catch (userError) {
          errors++;
          logger.error(
            `❌ FCM TOKEN CLEANUP: Error processing user ${userDoc.id}:`,
            userError
          );
        }
      }

      logger.info(
        `✅ FCM TOKEN CLEANUP: Complete - Processed ${usersProcessed} users, Scanned ${totalScanned} tokens, Deleted ${totalDeleted} stale tokens, Errors: ${errors}`
      );

      // Record metrics
      await recordMetric('fcm_stale_tokens_scanned', totalScanned);
      await recordMetric('fcm_stale_tokens_deleted', totalDeleted);
      await recordMetric('fcm_cleanup_errors', errors);

    } catch (error) {
      logger.error('❌ FCM TOKEN CLEANUP: Critical failure:', error);
      throw error;
    }
  }
);

/**
 * Hourly scheduled function to send reminder notifications to users
 * who copied the business opportunity link but haven't completed registration
 *
 * Sends reminders at:
 * - 24 hours after copying link
 * - 72 hours after copying link
 * - 7 days after copying link
 *
 * Deep links users directly to add_link_screen when they tap the notification
 */
const sendBizOppReminderNotifications = onSchedule(
  {
    schedule: '0 * * * *', // Every hour
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    logger.info('📬 BIZ OPP REMINDERS: Starting reminder notification check');

    const now = new Date(event.scheduleTime);

    const reminderIntervals = [
      { hours: 24, label: '24-hour' },
      { hours: 72, label: '72-hour' },
      { hours: 168, label: '7-day' }
    ];

    let totalReminders = 0;

    try {
      for (const interval of reminderIntervals) {
        const windowStart = new Date(now.getTime() - (interval.hours * 60 * 60 * 1000) - (30 * 60 * 1000));
        const windowEnd = new Date(now.getTime() - (interval.hours * 60 * 60 * 1000) + (30 * 60 * 1000));

        logger.info(`📬 BIZ OPP REMINDERS: Checking ${interval.label} window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

        const usersSnapshot = await db.collection('users')
          .where('biz_visit_date', '>=', windowStart)
          .where('biz_visit_date', '<=', windowEnd)
          .get();

        logger.info(`📬 BIZ OPP REMINDERS: Found ${usersSnapshot.size} users in ${interval.label} window`);

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          const userId = userDoc.id;

          if (userData.biz_join_date) {
            logger.info(`📬 BIZ OPP REMINDERS: Skipping user ${userId} - already completed registration`);
            continue;
          }

          const reminderKey = `biz_opp_reminder_${interval.hours}h`;
          if (userData[reminderKey] === true) {
            logger.info(`📬 BIZ OPP REMINDERS: Skipping user ${userId} - ${interval.label} reminder already sent`);
            continue;
          }

          const bizOppName = userData.biz_opp || 'business opportunity';
          const userLang = userData.preferredLanguage || 'en';

          let titleKey, bodyKey;
          if (interval.hours === 24) {
            titleKey = 'bizOppReminder24hTitle';
            bodyKey = 'bizOppReminder24hMessage';
          } else if (interval.hours === 72) {
            titleKey = 'bizOppReminder72hTitle';
            bodyKey = 'bizOppReminder72hMessage';
          } else {
            titleKey = 'bizOppReminder168hTitle';
            bodyKey = 'bizOppReminder168hMessage';
          }

          const title = getNotificationText(titleKey, userLang);
          const body = getNotificationText(bodyKey, userLang, { bizName: bizOppName });

          try {
            await createNotification({
              userId,
              type: 'biz_opp_reminder',
              title,
              body,
              docFields: {
                bizOpp: bizOppName,
                reminderType: interval.label,
                route: '/business-add-link',
                route_params: JSON.stringify({ action: 'complete_registration' })
              }
            });

            await db.collection('users').doc(userId).update({
              [reminderKey]: true
            });

            totalReminders++;
            logger.info(`📬 BIZ OPP REMINDERS: Sent ${interval.label} reminder to user ${userId}`);
          } catch (error) {
            logger.error(`📬 BIZ OPP REMINDERS: Error sending reminder to user ${userId}:`, error);
          }
        }
      }

      logger.info(`📬 BIZ OPP REMINDERS: Completed - sent ${totalReminders} reminders`);
    } catch (error) {
      logger.error('❌ BIZ OPP REMINDERS: Critical failure:', error);
      throw error;
    }
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
  notifySponsorOfBizOppCompletion,

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
  cleanupStaleFcmTokens,
  sendBizOppReminderNotifications,

  // Launch campaign functions
  sendLaunchNotificationConfirmation,

  // Testing and debugging functions
  testPushNotifications,

  // Utility functions
  toStringMap,
  resolveBestFcmTokenForUser,
  cleanupDeadToken,
};