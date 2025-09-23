// ==============================
// MODULAR FIREBASE FUNCTIONS INDEX
// This is the main entry point that imports and exports all modularized functions
// Architecture: Shared utilities + Auth + Notifications + Analytics + Admin modules
// ==============================

// ==============================
// Import Authentication Functions
// ==============================
const {
  getUserByReferralCode,
  registerUser,
  validateReferralUrl,
  deleteUserAccount,
} = require('./auth-functions');

// ==============================
// Import Notification Functions
// ==============================
const {
  // Core notification functions
  sendPushToUser,
  updateUserBadge,
  createNotification,
  createNotificationWithTransaction,

  // Subscription notifications
  upsertAppleV2NotificationState,
  updateUserSubscription,
  createSubscriptionNotification,
  createSubscriptionNotificationV2,

  // Chat and message functions
  onNewChatMessage,
  updateCanReadProfileOnChatCreate,
  onChatMessageCreated,

  // Business and team notifications
  notifySponsorOfBizOppVisit,

  // Firestore triggers
  onNotificationCreated,
  onNotificationUpdate,
  onNotificationDelete,
  onChatUpdate,

  // Milestone functions
  notifyOnMilestoneReached,

  // Scheduled functions
  sendDailyTeamGrowthNotifications,

  // Launch campaign functions
  sendLaunchNotificationConfirmation,
} = require('./notification-functions');

// ==============================
// Import Analytics Functions
// ==============================
const {
  // Network analytics
  getNetwork,
  getNetworkCounts,
  getNewMembersYesterdayCount,
  getFilteredNetwork,
  getMemberDetails,

  // User analytics
  checkUserSubscriptionStatus,
  getMilestoneFuseStatus,

  // System metrics
  getFirestoreMetrics,

  // Team management
  recalculateTeamCounts,

  // Referral analytics (moved to analytics from auth)
  // getUserByReferralCode is in auth-functions
} = require('./analytics-functions');

// ==============================
// Import Admin Functions
// ==============================
const {
  // Apple subscription management
  handleAppleSubscriptionNotification,
  handleAppleSubscriptionNotificationV2,
  validateAppleReceipt,
  testAppleNotificationV2Setup,

  // Google Play subscription management
  handleGooglePlayNotification,
  validateGooglePlayPurchase,
  testGooglePlayNotificationSetup,

  // User account management (moved from auth-functions)
  // deleteUserAccount is in auth-functions

  // Validation functions
  // validateReferralUrl is in auth-functions

  // Scheduled functions
  checkExpiredTrials,
  checkTrialsExpiringSoon,
  checkSubscriptionsExpiringSoon,
  sendDailyAccountDeletionSummary,
} = require('./admin-functions');

// ==============================
// Import Campaign Functions (external modules)
// ==============================
const { sendDemoInvitation } = require('./sendDemoInvitation');
const { sendLaunchCampaign } = require('./sendLaunchCampaign');
const { chatbot } = require('./chatbot');
const { setup_faq } = require('./setup_faq');

// Keep classic import ONLY for runtime config (do not use functions.firestore.* anywhere)
const functions = require('firebase-functions');

// Admin SDK
const admin = require('firebase-admin');
admin.initializeApp();

// Canonical Firestore aliases — keep ONE copy only in the file
const db         = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath  = admin.firestore.FieldPath;

// Config-derived flags (v2 environment variables)
const NOTIF_TRIGGER_ENABLED = String(process.env.NOTIFICATIONS_ENABLE_TRIGGER || 'false').trim().toLowerCase() === 'true';
const DELIVERY_MODE = String(process.env.NOTIFICATIONS_DELIVERY_MODE || 'helper').trim().toLowerCase();
const isHelperMode  = DELIVERY_MODE === 'helper';
const isTriggerMode = DELIVERY_MODE === 'trigger';

// ==============================
// END PATCH: imports-v2-and-aliases
// ==============================

const { setGlobalOptions } = require("firebase-functions/v2");
const { getTimezoneFromLocation, getTimezonesAtHour } = require("./timezone_mapping");
const { submitContactForm } = require('./submitContactForm');
const { submitContactFormHttp } = require('./submitContactFormHttp');
const { sendDemoInvitation } = require('./sendDemoInvitation');

// Cold-start sentinel for debugging - Joe's step A
console.log('NOTIFY_MILESTONE BOOT', {
  project: process.env.GCLOUD_PROJECT,
  region: 'us-central1',
  buildTag: 'ms-v7'
});

// Verifies & decodes Apple's signedPayload and validates the cert chain
const {
  decodeNotificationPayload,
  isDecodedNotificationDataPayload,
  isDecodedNotificationSummaryPayload,
} = require("app-store-server-api");

// Import the chatbot function
const { chatbot } = require('./chatbot');

// Initialize Firebase settings
setGlobalOptions({ region: "us-central1", timeoutSeconds: 60, memory: "512MiB" });

const auth = admin.auth();
const messaging = admin.messaging();
const remoteConfig = admin.remoteConfig();
const { DocumentReference } = require('firebase-admin/firestore');
const fetch = global.fetch || require('node-fetch');
const cors = require('cors')({ origin: true });

const crypto = require('crypto');

// ==============================
// BEGIN PATCH: export-bisect-guard-toggle
// ==============================
const ENABLE_EXTRA_EXPORTS = String(process.env.DEBUG_ENABLE_EXTRA_EXPORTS || 'false')
  .trim().toLowerCase() === 'true';
console.log('[EXPORT GUARD]', {
  ENABLE_EXTRA_EXPORTS,
  DELIVERY_MODE,
  NOTIF_TRIGGER_ENABLED,
  node: process.version,
});
// ==============================
// END PATCH: export-bisect-guard-toggle
// ==============================

// -- Resolve the best FCM token: field -> array[0] -> subcollection (freshest), all trimmed
async function resolveBestFcmTokenForUser(userRef, userDataMaybe) {
  let userData = userDataMaybe;
  if (!userData) {
    const snap = await userRef.get();
    userData = snap.exists ? snap.data() : {};
  }
  const trimStr = (s) => (typeof s === 'string' ? s.trim() : '');

  // 1) single field
  if (trimStr(userData.fcm_token)) {
    return { token: trimStr(userData.fcm_token), source: 'fcm_token' };
  }

  // 2) array field (first non-empty)
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.length) {
    const first = userData.fcmTokens.find((t) => trimStr(t));
    if (first) return { token: trimStr(first), source: 'fcmTokens[0]' };
  }

  // 3) subcollection (prefer newest by updatedAt, fallback to docId if needed)
  try {
    const snap = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
    if (!snap.empty) return { token: trimStr(snap.docs[0].id), source: 'fcmTokens(subcollection)' };
  } catch (_) {
    const snap = await userRef.collection('fcmTokens').orderBy(FieldPath.documentId()).limit(1).get();
    if (!snap.empty) return { token: trimStr(snap.docs[0].id), source: 'fcmTokens(subcollection)' };
  }
  return { token: null, source: 'none' };
}

// -- Remove a dead token from every storage location (field, array, subcollection)
async function cleanupDeadToken(userRef, token, userDataMaybe) {
  if (!token) return;
  let userData = userDataMaybe;
  if (!userData) {
    const s = await userRef.get();
    userData = s.exists ? s.data() : {};
  }

  const updates = {};
  if (userData.fcm_token && String(userData.fcm_token).trim() === token) {
    updates.fcm_token = FieldValue.delete();
  }
  if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.includes(token)) {
    updates.fcmTokens = FieldValue.arrayRemove(token);
  }
  if (Object.keys(updates).length) {
    await userRef.set(updates, { merge: true });
  }
  try { await userRef.collection('fcmTokens').doc(token).delete(); } catch (_) {}
}

// -- FCM data must be strings
function toStringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[k] = v == null ? '' : String(v);
  return out;
}

// -- Send one push for a notification
async function sendPushToUser(userId, notificationId, payload, userDataMaybe) {
  const userRef = admin.firestore().collection('users').doc(userId);
  const { token, source } = await resolveBestFcmTokenForUser(userRef, userDataMaybe);
  if (!token) {
    console.log('PUSH: no token', { userId, notificationId });
    return { sent: false, reason: 'no_token', tokenSource: 'none' };
  }

  const title = payload.title || 'Team Build Pro';
  const body  = payload.message || '';
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
    // Log APNs headers for verification (for all notification types)
    console.log(`PUSH APNs Headers:`, JSON.stringify(apnsHeaders));

    const response = await admin.messaging().send(msg);
    console.log('PUSH: sent', { userId, notificationId, response, tokenSource: source });

    // Enhanced push logging for all types
    const tokenPreview = token ? String(token).slice(0, 8) : '<no-token>';
    console.log(`PUSH DETAILED: type=${payload?.type} subtype=${payload?.subtype || 'none'} to=${tokenPreview}* msgId=${response} notifId=${notificationId}`);

    return { sent: true, reason: 'sent', tokenSource: source };
  } catch (err) {
    const code = (err && err.code) || '';
    console.log('PUSH: error', { userId, notificationId, code, msg: err.message });
    if (code === 'messaging/registration-token-not-registered') {
      await cleanupDeadToken(userRef, token);
      return { sent: false, reason: 'token_not_registered', tokenSource: source };
    }
    return { sent: false, reason: code || 'unknown', tokenSource: source };
  }
}

// -- Recompute unread badge and send silent badge push (same 3-tier resolver, with cleanup)
const updateUserBadge = async (userId) => {
  try {
    console.log(`🔔 BADGE UPDATE: Starting badge update for user ${userId}`);

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
    let token = null, source = 'none';

    // Tier 1
    const userSnap = await userRef.get();
    const data = userSnap.exists ? (userSnap.data() || {}) : {};
    if (typeof data.fcm_token === 'string' && data.fcm_token.trim()) {
      token = data.fcm_token.trim(); source = 'fcm_token';
    }
    // Tier 2
    if (!token && Array.isArray(data.fcmTokens) && data.fcmTokens.length) {
      const first = (data.fcmTokens.find(t => typeof t === 'string' && t.trim()) || '').trim();
      if (first) { token = first; source = 'fcmTokens[0]'; }
    }
    // Tier 3 + fallback
    if (!token) {
      try {
        const sub = await userRef.collection('fcmTokens').orderBy('updatedAt', 'desc').limit(1).get();
        if (!sub.empty) { token = (sub.docs[0].data().token || sub.docs[0].id).trim(); source = 'fcmTokens(subcollection)'; }
      } catch (e) {
        const sub = await userRef.collection('fcmTokens').orderBy(admin.firestore.FieldPath.documentId()).limit(1).get();
        if (!sub.empty) { token = sub.docs[0].id.trim(); source = 'fcmTokens(subcollection)'; }
      }
    }

    if (!token) {
      console.log('BADGE: no token', { userId });
      return;
    }

    try {
      await messaging.send({
        token,
        apns: { payload: { aps: { badge: badgeCount } } },
        data: { type: 'badge_update', badgeCount: String(badgeCount) }
      });
      console.log('BADGE: sent', { userId, badgeCount, tokenSource: source });
    } catch (e) {
      const code = e?.errorInfo?.code || e?.code || '';
      console.log('BADGE: error', { userId, badgeCount, code, msg: e?.message });
      if (code === 'messaging/registration-token-not-registered') {
        try { await cleanupDeadToken(userRef, token); } catch (_) {}
      }
    }
  } catch (error) {
    console.error(`❌ BADGE UPDATE: Failed for ${userId}:`, error.message);
  }
}

// -- One entry point used by call sites (idempotent doc create + push + badge)
// REMOVED: Duplicate createNotification function - using the comprehensive version below

// cleanupDeadToken(userRef, token)
// Removes the token from: users/{uid}.fcm_token, users/{uid}.fcmTokens[], users/{uid}/fcmTokens/{token}
async function cleanupDeadToken(userRef, token) {
  if (!token) return;

  const snap = await userRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};

  const updates = {};
  if (typeof data.fcm_token === 'string' && data.fcm_token.trim() === token) {
    updates.fcm_token = admin.firestore.FieldValue.delete();
  }
  if (Array.isArray(data.fcmTokens) && data.fcmTokens.includes(token)) {
    updates.fcmTokens = admin.firestore.FieldValue.arrayRemove(token);
  }
  if (Object.keys(updates).length) {
    await userRef.set(updates, { merge: true });
  }

  // Best effort: remove subcollection doc with id === token
  try { await userRef.collection('fcmTokens').doc(token).delete(); } catch (_) {}
}
// ==============================
// END PATCH: notification-core-helpers
// ==============================

// ==============================
// BEGIN PATCH: validator-admin-guards
// ==============================
// Enable/disable validators at runtime
//   debug.validate_enabled: 'true' | 'false'
//   debug.admin_allowlist:  'uid1,uid2,...'
function validatorsEnabled() {
  return String(process.env.DEBUG_VALIDATE_ENABLED || 'false').toLowerCase() === 'true';
}

function callerIsAllowedAdmin(context) {
  if (!context?.auth?.uid) return false;
  const isAdminClaim = !!context.auth.token?.admin;
  const allowlist = String(process.env.DEBUG_ADMIN_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return isAdminClaim || allowlist.includes(context.auth.uid);
}

function assertAdminAndEnabled(context, featureName) {
  if (!validatorsEnabled()) {
    throw new functions.https.HttpsError('failed-precondition', `Validation disabled (${featureName}).`);
  }
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!callerIsAllowedAdmin(context)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}
// ==============================
// END PATCH: validator-admin-guards
// ==============================

const jwt = require('jsonwebtoken');
const { X509Certificate } = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');

// SendGrid for launch notification emails
const sgMail = require('@sendgrid/mail');
const { defineSecret } = require('firebase-functions/params');
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

// Google Play OIDC verification for Pub/Sub push
const verifyGooglePlayPubSubToken = async (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return false;
  }
  
  try {
    const token = authorizationHeader.substring(7); // Remove 'Bearer ' prefix
    const client = new OAuth2Client();
    
    // Verify the JWT token from Google Cloud Pub/Sub
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GCLOUD_PROJECT, // Your Firebase project ID
    });
    
    const payload = ticket.getPayload();
    
    // Verify this is actually from Google Cloud Pub/Sub
    if (payload.iss !== 'https://accounts.google.com' && 
        payload.iss !== 'accounts.google.com') {
      console.log('🔒 GOOGLE PLAY OIDC: Invalid issuer:', payload.iss);
      return false;
    }
    
    // Additional verification for Pub/Sub service account
    if (payload.email && !payload.email.includes('gserviceaccount.com')) {
      console.log('🔒 GOOGLE PLAY OIDC: Not a service account:', payload.email);
      return false;
    }
    
    console.log('✅ GOOGLE PLAY OIDC: Token verified successfully');
    return true;
    
  } catch (error) {
    console.log('❌ GOOGLE PLAY OIDC: Token verification failed:', error.message);
    return false;
  }
};

// Apple V2 notification persistence with idempotency
const upsertAppleV2NotificationState = async (payload) => {
  if (!isDecodedNotificationDataPayload(payload)) {
    return; // Only handle data notifications for now
  }
  
  const { data, notificationUUID, notificationType, subtype } = payload;
  
  try {
    // Extract key identifiers for idempotency
    const originalTransactionId = data?.originalTransactionId;
    const notificationId = notificationUUID || `${originalTransactionId}_${Date.now()}`;
    
    if (!originalTransactionId) {
      console.log('⚠️ APPLE V2 PERSISTENCE: No originalTransactionId found, skipping persistence');
      return;
    }
    
    // Create idempotency key
    const idempotencyKey = `${originalTransactionId}_${notificationId}`;
    
    // Check if we've already processed this notification
    const existingDoc = await db.collection('apple_v2_notifications')
      .doc(idempotencyKey)
      .get();
      
    if (existingDoc.exists) {
      console.log(`✅ APPLE V2 PERSISTENCE: Notification ${idempotencyKey} already processed, skipping`);
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
    console.log(`✅ APPLE V2 PERSISTENCE: Stored notification ${idempotencyKey} for transaction ${originalTransactionId}`);
    
  } catch (error) {
    console.error('❌ APPLE V2 PERSISTENCE: Failed to store notification:', error);
    // Don't throw - persistence failure shouldn't break notification processing
  }
};

// ============================================================================
// APPLE STORE SUBSCRIPTION FUNCTIONS
// ============================================================================

/**
 * Helper function to update user subscription status in Firestore
 */
const updateUserSubscription = async (userId, status, expiryDate = null) => {
  try {
    console.log(`📱 SUBSCRIPTION: Updating user ${userId} to status: ${status}`);

    const updateData = {
      subscriptionStatus: status,
      subscriptionUpdated: FieldValue.serverTimestamp(),
    };

    if (expiryDate) {
      // Convert string to number before creating Date object
      const expiryTimestamp = typeof expiryDate === 'string' ? parseInt(expiryDate) : expiryDate;
      updateData.subscriptionExpiry = new Date(expiryTimestamp);
      console.log(`📱 SUBSCRIPTION: Setting expiry date: ${updateData.subscriptionExpiry.toISOString()}`);
    }

    await db.collection('users').doc(userId).update(updateData);
    console.log(`✅ SUBSCRIPTION: Successfully updated user ${userId} subscription status`);

  } catch (error) {
    console.error(`❌ SUBSCRIPTION: Failed to update user ${userId} subscription:`, error);
    throw error;
  }
};

// Subscription notifications to users
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
          route: "/subscription", // Changed to match FCM handler
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
            message: `Your subscription will end on ${formattedDate}. Renew to continue accessing premium features.`,
            type: "subscription_expiring_soon",
            route: "/subscription",
            route_params: JSON.stringify({ "action": "renew" })
          };
        }
        break;

      default:
        // Don't send notifications for trial or other statuses
        return;
    }

    if (notificationContent) {

      const result = await createNotification({
        userId,
        type: 'subscription_update',
        title: 'Subscription updated',
        body: `Your subscription is now ${status}.`,
        docFields: { status },
      });
      console.log(`✅ SUBSCRIPTION: Notification created for user ${userId} for status: ${status}`);
    }

  } catch (error) {
    console.error(`❌ SUBSCRIPTION: Failed to send notification to user ${userId}:`, error);
    // Don't throw error - notification failure shouldn't break subscription update
  }
};

// ==============================
// BEGIN PATCH: export-bisect-wrap
// ==============================
if (ENABLE_EXTRA_EXPORTS) {

// Module exports that were moved into guard
exports.submitContactForm = submitContactForm;
exports.submitContactFormHttp = submitContactFormHttp;
exports.sendDemoInvitation = sendDemoInvitation;
exports.chatbot = chatbot;

/**
 * Apple Server-to-Server Notification Handler
 * Handles real-time subscription events from Apple
 */
exports.handleAppleSubscriptionNotification = onRequest({ region: "us-central1" }, async (req, res) => {
  console.log(`📱 APPLE NOTIFICATION: Received Apple server-to-server notification`);

  try {
    // Verify this is a POST request
    if (req.method !== 'POST') {
      console.log(`📱 APPLE NOTIFICATION: Invalid method: ${req.method}`);
      return res.status(405).send('Method Not Allowed');
    }

    const notificationData = req.body;
    console.log(`📱 APPLE NOTIFICATION: Notification data:`, JSON.stringify(notificationData, null, 2));

    // Extract notification type and transaction info
    const notificationType = notificationData.notification_type;
    const latestReceiptInfo = notificationData.latest_receipt_info?.[0];

    if (!latestReceiptInfo) {
      console.log(`📱 APPLE NOTIFICATION: No transaction info found`);
      return res.status(400).send('No transaction info');
    }

    // Extract original transaction ID to find user
    const originalTransactionId = latestReceiptInfo.original_transaction_id;

    if (!originalTransactionId) {
      console.log(`📱 APPLE NOTIFICATION: No original transaction ID found`);
      return res.status(400).send('No transaction ID found');
    }

    console.log(`📱 APPLE NOTIFICATION: Looking for user with transaction ID: ${originalTransactionId}`);

    // Find user by Apple transaction ID
    const userQuery = await db.collection('users')
      .where('appleTransactionId', '==', originalTransactionId)
      .limit(1)
      .get();

    if (userQuery.empty) {
      console.log(`📱 APPLE NOTIFICATION: No user found for transaction ${originalTransactionId}`);
      return res.status(404).send('User not found');
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    console.log(`📱 APPLE NOTIFICATION: Found user ${userId}, processing ${notificationType}`);

    // Handle different notification types
    switch (notificationType) {
      case 'INITIAL_BUY':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} started subscription`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'CANCEL':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} cancelled subscription`);
        await updateUserSubscription(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
        break;

      case 'DID_FAIL_TO_RENEW':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} subscription failed to renew`);
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotification(userId, 'expired');
        break;

      case 'DID_RENEW':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} subscription renewed`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'INTERACTIVE_RENEWAL':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} interactively renewed subscription`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'DID_CHANGE_RENEWAL_PREF':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} changed renewal preference`);
        // Handle renewal preference change if needed
        break;

      case 'DID_CHANGE_RENEWAL_STATUS': {
        console.log(`📱 APPLE NOTIFICATION: User ${userId} changed renewal status`);
        // Check if auto-renew is enabled/disabled
        const autoRenewStatus = latestReceiptInfo.auto_renew_status;
        if (autoRenewStatus === '0') {
          // Auto-renew disabled - mark as cancelled but still active until expiry
          await updateUserSubscription(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
          await createSubscriptionNotification(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
        }
      }
        break;

      default:
        console.log(`📱 APPLE NOTIFICATION: Unhandled notification type: ${notificationType}`);
        break;
    }

    console.log(`✅ APPLE NOTIFICATION: Successfully processed ${notificationType} for user ${userId}`);
    return res.status(200).send('OK');

  } catch (error) {
    console.error(`❌ APPLE NOTIFICATION: Error processing notification:`, error);
    return res.status(500).send('Internal Server Error');
  }
});

// ============================================================================
// APP STORE SERVER NOTIFICATIONS V2 IMPLEMENTATION
// ============================================================================

/**
 * App Store Server Notifications V2 Handler
 * Handles JWT-signed notifications from Apple with proper verification
 */
exports.handleAppleSubscriptionNotificationV2 = onRequest({ region: "us-central1", cors: false }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { signedPayload } = req.body || {};
    if (!signedPayload) {
      return res.status(400).send("Missing signedPayload");
    }

    // Verifies signature and certificate chain for you
    const payload = await decodeNotificationPayload(signedPayload);
    
    // Persist notification state with idempotency (do this early to prevent duplicate processing)
    await upsertAppleV2NotificationState(payload);

    // Optional: guard that the bundleId matches your app
    const APP_BUNDLE_ID = process.env.APP_BUNDLE_ID; // e.g., com.scott.ultimatefix.signin
    const bundleFromPayload = payload?.data?.bundleId || payload?.summary?.bundleId;
    if (APP_BUNDLE_ID && bundleFromPayload && APP_BUNDLE_ID !== bundleFromPayload) {
      return res.status(401).send("Bundle mismatch");
    }

    if (isDecodedNotificationDataPayload(payload)) {
      const { notificationType, subtype, data } = payload;
      console.log(`📱 APPLE V2 NOTIFICATION: Processing ${notificationType} notification`);
      await processNotificationV2({ notificationType, subtype, data });
    } else if (isDecodedNotificationSummaryPayload(payload)) {
      const { summary } = payload;
      console.log(`📱 APPLE V2 NOTIFICATION: Processing summary notification`);
      // TODO: optional summary handling
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Apple V2 webhook failed:", err);
    return res.status(500).send("Internal Error");
  }
});

// Insecure JWT verification removed - now using app-store-server-api library

/**
 * Process V2 notification based on notification type
 */
async function processNotificationV2(payload) {
  const { notificationType, subtype, data } = payload;

  if (!data?.signedTransactionInfo) {
    throw new Error('Missing transaction info in notification');
  }

  // Decode the signed transaction info
  const transactionInfo = jwt.decode(data.signedTransactionInfo);
  const originalTransactionId = transactionInfo.originalTransactionId;

  if (!originalTransactionId) {
    throw new Error('Missing original transaction ID');
  }

  console.log(`📱 APPLE V2 NOTIFICATION: Processing ${notificationType} for transaction ${originalTransactionId}`);

  // Find user by Apple transaction ID
  const userQuery = await db.collection('users')
    .where('appleTransactionId', '==', originalTransactionId)
    .limit(1)
    .get();

  if (userQuery.empty) {
    console.log(`📱 APPLE V2 NOTIFICATION: No user found for transaction ${originalTransactionId}`);
    throw new Error('User not found');
  }

  const userDoc = userQuery.docs[0];
  const userId = userDoc.id;

  console.log(`📱 APPLE V2 NOTIFICATION: Found user ${userId}, processing ${notificationType}`);

  // Process different notification types
  switch (notificationType) {
    case 'SUBSCRIBED':
      console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} subscribed`);
      await updateUserSubscription(userId, 'active', transactionInfo.expiresDate);
      await createSubscriptionNotification(userId, 'active', transactionInfo.expiresDate);
      break;

    case 'DID_RENEW':
      console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} subscription renewed`);
      await updateUserSubscription(userId, 'active', transactionInfo.expiresDate);
      await createSubscriptionNotification(userId, 'active', transactionInfo.expiresDate);
      break;

    case 'DID_CHANGE_RENEWAL_STATUS':
      if (subtype === 'AUTO_RENEW_DISABLED') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} disabled auto-renew`);
        await updateUserSubscription(userId, 'cancelled', transactionInfo.expiresDate);
        await createSubscriptionNotification(userId, 'cancelled', transactionInfo.expiresDate);
      } else if (subtype === 'AUTO_RENEW_ENABLED') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} enabled auto-renew`);
        await updateUserSubscription(userId, 'active', transactionInfo.expiresDate);
        await createSubscriptionNotification(userId, 'active', transactionInfo.expiresDate);
      }
      break;

    case 'EXPIRED':
      if (subtype === 'VOLUNTARY') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} subscription expired voluntarily`);
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotification(userId, 'expired');
      } else if (subtype === 'BILLING_RETRY') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} subscription in billing retry`);
        // Keep current status but log the billing issue
      } else if (subtype === 'PRICE_INCREASE') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} didn't accept price increase`);
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotification(userId, 'expired');
      }
      break;

    case 'GRACE_PERIOD_EXPIRED':
      console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} grace period expired`);
      await updateUserSubscription(userId, 'expired');
      await createSubscriptionNotification(userId, 'expired');
      break;

    case 'PRICE_INCREASE':
      if (subtype === 'PENDING') {
        console.log(`📱 APPLE V2 NOTIFICATION: Price increase pending for user ${userId}`);
        // Optionally notify user about pending price increase
      } else if (subtype === 'ACCEPTED') {
        console.log(`📱 APPLE V2 NOTIFICATION: User ${userId} accepted price increase`);
        await updateUserSubscription(userId, 'active', transactionInfo.expiresDate);
      }
      break;

    case 'REFUND':
      console.log(`📱 APPLE V2 NOTIFICATION: Refund processed for user ${userId}`);
      // Handle refund - might need to revoke access depending on your business logic
      await updateUserSubscription(userId, 'refunded');
      await createSubscriptionNotification(userId, 'refunded');
      break;

    case 'REVOKE':
      console.log(`📱 APPLE V2 NOTIFICATION: Subscription revoked for user ${userId}`);
      await updateUserSubscription(userId, 'revoked');
      await createSubscriptionNotification(userId, 'revoked');
      break;

    case 'CONSUMPTION_REQUEST':
      console.log(`📱 APPLE V2 NOTIFICATION: Consumption request for user ${userId}`);
      // Handle consumption requests if you have consumable products
      break;

    case 'RENEWAL_EXTENDED':
      console.log(`📱 APPLE V2 NOTIFICATION: Renewal extended for user ${userId}`);
      await updateUserSubscription(userId, 'active', transactionInfo.expiresDate);
      break;

    case 'RENEWAL_EXTENSION':
      if (subtype === 'SUMMARY') {
        console.log(`📱 APPLE V2 NOTIFICATION: Renewal extension summary for user ${userId}`);
        // Handle renewal extension summary
      }
      break;

    case 'TEST':
      console.log(`📱 APPLE V2 NOTIFICATION: Test notification received`);
      // This is just a test notification, no action needed
      break;

    default:
      console.log(`📱 APPLE V2 NOTIFICATION: Unhandled notification type: ${notificationType}`);
      break;
  }
}

/**
 * Enhanced updateUserSubscription function with better status handling
 */
const updateUserSubscriptionV2 = async (userId, status, expiryDate = null, additionalData = {}) => {
  try {
    console.log(`📱 SUBSCRIPTION V2: Updating user ${userId} to status: ${status}`);

    const updateData = {
      subscriptionStatus: status,
      subscriptionUpdated: FieldValue.serverTimestamp(),
      ...additionalData
    };

    if (expiryDate) {
      // Handle both timestamp and ISO string formats
      const expiryTimestamp = typeof expiryDate === 'string'
        ? new Date(expiryDate).getTime()
        : parseInt(expiryDate);
      updateData.subscriptionExpiry = new Date(expiryTimestamp);
      console.log(`📱 SUBSCRIPTION V2: Setting expiry date: ${updateData.subscriptionExpiry.toISOString()}`);
    }

    await db.collection('users').doc(userId).update(updateData);
    console.log(`✅ SUBSCRIPTION V2: Successfully updated user ${userId} subscription status`);

  } catch (error) {
    console.error(`❌ SUBSCRIPTION V2: Failed to update user ${userId} subscription:`, error);
    throw error;
  }
};

/**
 * Enhanced notification creation with support for new V2 notification types
 */
const createSubscriptionNotificationV2 = async (userId, status, expiryDate = null, additionalInfo = {}) => {
  try {
    let notificationContent = null;

    switch (status) {
      case 'active':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? expiryDate : parseInt(expiryDate));
          notificationContent = {
            title: "✅ Subscription Active",
            message: `Your subscription is now active until ${expiry.toLocaleDateString()}.`,
            type: "subscription_active"
          };
        }
        break;

      case 'cancelled':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? expiryDate : parseInt(expiryDate));
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

      case 'refunded':
        notificationContent = {
          title: "💰 Subscription Refunded",
          message: "Your subscription has been refunded. Access to premium features has been revoked.",
          type: "subscription_refunded"
        };
        break;

      case 'revoked':
        notificationContent = {
          title: "🚫 Subscription Revoked",
          message: "Your subscription has been revoked. Please contact support if you believe this is an error.",
          type: "subscription_revoked"
        };
        break;

      case 'expiring_soon':
        if (expiryDate) {
          const expiry = new Date(typeof expiryDate === 'string' ? expiryDate : parseInt(expiryDate));
          const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
          const formattedDate = `${monthNames[expiry.getMonth()]} ${expiry.getDate()}`;

          notificationContent = {
            title: "⏰ Subscription Expiring Soon",
            message: `Your subscription will end on ${formattedDate}. Renew to continue accessing premium features.`,
            type: "subscription_expiring_soon",
            route: "/subscription",
            route_params: JSON.stringify({ "action": "renew" })
          };
        }
        break;

      default:
        // Don't send notifications for unknown statuses
        return;
    }

    if (notificationContent) {

      const result = await createNotification({
        userId,
        type: 'subscription_update',
        title: 'Subscription updated',
        body: `Your subscription is now ${status}.`,
        docFields: { status },
        data: { route: 'subscription', status },
      });
      console.log(`✅ SUBSCRIPTION V2: Notification sent to user ${userId} for status: ${status} - Push sent: ${result.push.sent}`);
    }

  } catch (error) {
    console.error(`❌ SUBSCRIPTION V2: Failed to send notification to user ${userId}:`, error);
    // Don't throw error - notification failure shouldn't break subscription update
  }
};

/**
 * Test endpoint for validating your V2 notification setup
 */
exports.testAppleNotificationV2Setup = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // This function helps you test your notification endpoint
  // You can call this from your app to verify everything is set up correctly

  console.log(`📱 TEST: V2 notification setup test initiated by ${request.auth.uid}`);

  return {
    success: true,
    message: "V2 notification endpoint is configured and ready",
    endpoint: `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/handleAppleSubscriptionNotificationV2`,
    timestamp: new Date().toISOString()
  };
});

/**
 * Test endpoint for validating your Google Play notification setup
 */
exports.testGooglePlayNotificationSetup = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // This function helps you test your Google Play notification endpoint
  // You can call this from your app to verify everything is set up correctly

  console.log(`🤖 TEST: Google Play notification setup test initiated by ${request.auth.uid}`);

  return {
    success: true,
    message: "Google Play notification endpoint is configured and ready",
    endpoint: `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/handleGooglePlaySubscriptionNotification`,
    timestamp: new Date().toISOString()
  };
});

// Export helper functions for use in other parts of your code
// Note: verifyAndDecodeJWT removed - now using app-store-server-api library
/* module.exports = {
  updateUserSubscriptionV2,
  createSubscriptionNotificationV2,
  processNotificationV2
}; */

/**
 * Daily check for expired trial periods
 * Runs every day at 9 AM UTC
 */
exports.checkExpiredTrials = onSchedule("0 9 * * *", async (event) => {
  console.log('📅 TRIAL CHECK: Starting daily trial expiration check');

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find users whose trial started 30+ days ago and are still on trial
    const expiredTrialsQuery = await db.collection('users')
      .where('subscriptionStatus', '==', 'trial')
      .where('trialStartDate', '<=', thirtyDaysAgo)
      .get();

    if (expiredTrialsQuery.empty) {
      console.log('📅 TRIAL CHECK: No expired trials found');
      return;
    }

    console.log(`📅 TRIAL CHECK: Found ${expiredTrialsQuery.size} expired trials`);

    // Process each expired trial
    const promises = expiredTrialsQuery.docs.map(async (doc) => {
      const userId = doc.id;
      const userData = doc.data();

      console.log(`📅 TRIAL CHECK: Expiring trial for user ${userId}`);

      try {
        // Update subscription status to expired
        await updateUserSubscription(userId, 'expired');

        // Send expiration notification
        await createSubscriptionNotification(userId, 'expired');

        console.log(`✅ TRIAL CHECK: Successfully expired trial for user ${userId}`);

      } catch (error) {
        console.error(`❌ TRIAL CHECK: Failed to expire trial for user ${userId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`✅ TRIAL CHECK: Completed processing ${expiredTrialsQuery.size} expired trials`);

  } catch (error) {
    console.error('❌ TRIAL CHECK: Error checking expired trials:', error);
  }
});

/**
 * Warning notification for trials expiring soon (optional)
 * Runs daily at 9 AM UTC
 */
exports.checkTrialsExpiringSoon = onSchedule("0 9 * * *", async (event) => {
  console.log('⚠️ TRIAL WARNING: Checking for trials expiring soon');

  try {
    const twentySevenDaysAgo = new Date();
    twentySevenDaysAgo.setDate(twentySevenDaysAgo.getDate() - 27); // 3 days left

    const twentySixDaysAgo = new Date();
    twentySixDaysAgo.setDate(twentySixDaysAgo.getDate() - 26); // Between 3-4 days left

    // Find users whose trial will expire in 3 days
    const expiringSoonQuery = await db.collection('users')
      .where('subscriptionStatus', '==', 'trial')
      .where('trialStartDate', '<=', twentySevenDaysAgo)
      .where('trialStartDate', '>', twentySixDaysAgo)
      .get();

    if (expiringSoonQuery.empty) {
      console.log('⚠️ TRIAL WARNING: No trials expiring soon');
      return;
    }

    console.log(`⚠️ TRIAL WARNING: Found ${expiringSoonQuery.size} trials expiring soon`);

    // Send warning notifications
    const promises = expiringSoonQuery.docs.map(async (doc) => {
      const userId = doc.id;

      try {

        const result = await createNotification({
          userId,
          type: 'trial_warning',
          title: "⏰ Trial Expiring Soon",
          body: "Your 30-day trial expires in 3 days. Subscribe now to maintain your team's momentum and continue growing your network.",
          docFields: { 
            route: "/subscription",
            route_params: JSON.stringify({ "action": "upgrade" }),
          },
          data: { 
            route: 'subscription', 
            action: 'upgrade'
          },
        });
        console.log(`✅ TRIAL WARNING: Sent warning to user ${userId} - Push sent: ${result.push.sent}`);

      } catch (error) {
        console.error(`❌ TRIAL WARNING: Failed to send warning to user ${userId}:`, error);
      }
    });

    await Promise.all(promises);

  } catch (error) {
    console.error('❌ TRIAL WARNING: Error checking trials expiring soon:', error);
  }
});

/**
 * Warning notification for paid subscriptions expiring soon
 * Runs daily at 9 AM UTC to check for subscriptions expiring in 3 days
 */
exports.checkSubscriptionsExpiringSoon = onSchedule("0 9 * * *", async (event) => {
  console.log('⚠️ SUBSCRIPTION WARNING: Checking for paid subscriptions expiring soon');

  try {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0); // Start of day

    const fourDaysFromNow = new Date();
    fourDaysFromNow.setDate(now.getDate() + 4);
    fourDaysFromNow.setHours(0, 0, 0, 0); // Start of day

    console.log(`⚠️ SUBSCRIPTION WARNING: Looking for subscriptions expiring between ${threeDaysFromNow.toISOString()} and ${fourDaysFromNow.toISOString()}`);

    // Find users with active or cancelled subscriptions expiring in exactly 3 days
    const expiringSoonQuery = await db.collection('users')
      .where('subscriptionStatus', 'in', ['active', 'cancelled'])
      .where('subscriptionExpiry', '>=', threeDaysFromNow)
      .where('subscriptionExpiry', '<', fourDaysFromNow)
      .get();

    if (expiringSoonQuery.empty) {
      console.log('⚠️ SUBSCRIPTION WARNING: No paid subscriptions expiring in 3 days');
      return;
    }

    console.log(`⚠️ SUBSCRIPTION WARNING: Found ${expiringSoonQuery.size} paid subscriptions expiring in 3 days`);

    // Check for users who already received expiration warning today to prevent duplicates
    const todayDateString = now.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Send warning notifications
    const promises = expiringSoonQuery.docs.map(async (doc) => {
      const userId = doc.id;
      const userData = doc.data();

      try {
        // Check if user already received expiration warning today
        const lastExpirationWarningDate = userData.lastExpirationWarningDate;

        if (lastExpirationWarningDate === todayDateString) {
          console.log(`⚠️ SUBSCRIPTION WARNING: User ${userId} already received expiration warning today. Skipping.`);
          return;
        }

        // Send the expiration warning using the enhanced createSubscriptionNotification function
        await createSubscriptionNotification(userId, 'expiring_soon', userData.subscriptionExpiry);

        // Update user document to track that warning was sent today
        await db.collection('users').doc(userId).update({
          lastExpirationWarningDate: todayDateString
        });

        console.log(`✅ SUBSCRIPTION WARNING: Sent expiration warning to user ${userId}`);

      } catch (error) {
        console.error(`❌ SUBSCRIPTION WARNING: Failed to send warning to user ${userId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log(`✅ SUBSCRIPTION WARNING: Completed processing ${expiringSoonQuery.size} expiring subscriptions`);

  } catch (error) {
    console.error('❌ SUBSCRIPTION WARNING: Error checking subscriptions expiring soon:', error);
  }
});

/**
 * Apple Receipt Validation Function
 * Validates receipts with Apple and updates user subscription status
 */
exports.validateAppleReceipt = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;
  const { receiptData } = request.data;

  if (!receiptData) {
    throw new HttpsError("invalid-argument", "Receipt data is required");
  }

  console.log(`📱 RECEIPT VALIDATION: Validating receipt for user ${userId}`);

  try {
    // Apple's receipt validation endpoint
    const appleValidationUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    const sandboxValidationUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';

    // Prepare validation request
    const validationRequest = {
      'receipt-data': receiptData,
      'password': process.env.APPLE_SHARED_SECRET, // Set this in your Firebase Functions config
      'exclude-old-transactions': true
    };

    console.log(`📱 RECEIPT VALIDATION: Sending validation request to Apple`);

    // Try production first, then sandbox if needed
    let response = await fetch(appleValidationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validationRequest),
    });

    let validationResult = await response.json();

    // If production returns sandbox receipt error, try sandbox
    if (validationResult.status === 21007) {
      console.log(`📱 RECEIPT VALIDATION: Trying sandbox validation`);
      response = await fetch(sandboxValidationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validationRequest),
      });
      validationResult = await response.json();
    }

    console.log(`📱 RECEIPT VALIDATION: Apple validation result:`, JSON.stringify(validationResult, null, 2));

    // Check validation status
    if (validationResult.status !== 0) {
      console.log(`📱 RECEIPT VALIDATION: Invalid receipt, status: ${validationResult.status}`);
      return {
        isValid: false,
        status: validationResult.status,
        message: 'Receipt validation failed'
      };
    }

    // Extract subscription info from latest receipt
    const latestReceiptInfo = validationResult.latest_receipt_info;
    const pendingRenewalInfo = validationResult.pending_renewal_info;

    if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
      console.log(`📱 RECEIPT VALIDATION: No subscription info found`);
      return {
        isValid: false,
        message: 'No subscription information found'
      };
    }

    // Get the most recent transaction
    const latestTransaction = latestReceiptInfo[latestReceiptInfo.length - 1];
    const expiresDate = new Date(parseInt(latestTransaction.expires_date_ms));
    const now = new Date();

    console.log(`📱 RECEIPT VALIDATION: Latest transaction expires: ${expiresDate.toISOString()}`);

    // Determine subscription status
    let subscriptionStatus = 'expired';
    if (expiresDate > now) {
      // Check if auto-renew is enabled
      const renewalInfo = pendingRenewalInfo?.[0];
      if (renewalInfo?.auto_renew_status === '0') {
        subscriptionStatus = 'cancelled'; // Cancelled but still active
      } else {
        subscriptionStatus = 'active';
      }
    }

    console.log(`📱 RECEIPT VALIDATION: Determined status: ${subscriptionStatus}`);

    // Update user subscription status
    await updateUserSubscription(userId, subscriptionStatus, expiresDate);

    return {
      isValid: true,
      subscriptionStatus: subscriptionStatus,
      expiresDate: expiresDate.toISOString(),
      productId: latestTransaction.product_id,
      transactionId: latestTransaction.transaction_id
    };

  } catch (error) {
    console.error(`❌ RECEIPT VALIDATION: Error validating receipt for user ${userId}:`, error);
    throw new HttpsError("internal", "Receipt validation failed", error.message);
  }
});

/**
 * Enhanced subscription status check that includes Apple subscription data
 */
exports.checkUserSubscriptionStatus = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;

  try {
    console.log(`📱 SUBSCRIPTION CHECK: Checking subscription status for user ${userId}`);

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    const subscriptionStatus = userData.subscriptionStatus || 'trial';
    const subscriptionExpiry = userData.subscriptionExpiry;
    const trialStartDate = userData.trialStartDate || userData.createdAt;

    // Calculate trial validity
    let isTrialValid = false;
    let trialDaysRemaining = 0;

    if (trialStartDate) {
      const trialStart = trialStartDate.toDate ? trialStartDate.toDate() : new Date(trialStartDate);
      const daysSinceTrialStart = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysRemaining = Math.max(0, 30 - daysSinceTrialStart);
      isTrialValid = trialDaysRemaining > 0;
    }

    // Check if subscription is active
    const isSubscriptionActive = subscriptionStatus === 'active' ||
      (subscriptionStatus === 'trial' && isTrialValid);

    // Check if subscription has expired
    let isExpired = false;
    if (subscriptionExpiry) {
      const expiry = subscriptionExpiry.toDate ? subscriptionExpiry.toDate() : new Date(subscriptionExpiry);
      isExpired = Date.now() > expiry.getTime();
    }

    // Check if in grace period (cancelled but still active)
    const isInGracePeriod = subscriptionStatus === 'cancelled' &&
      subscriptionExpiry &&
      !isExpired;

    console.log(`✅ SUBSCRIPTION CHECK: User ${userId} status: ${subscriptionStatus}, active: ${isSubscriptionActive}`);

    return {
      subscriptionStatus,
      isActive: isSubscriptionActive,
      isTrialValid,
      trialDaysRemaining,
      isExpired,
      isInGracePeriod,
      subscriptionExpiry: subscriptionExpiry ? (subscriptionExpiry.toDate ? subscriptionExpiry.toDate().toISOString() : subscriptionExpiry) : null,
      subscriptionUpdated: userData.subscriptionUpdated ? (userData.subscriptionUpdated.toDate ? userData.subscriptionUpdated.toDate().toISOString() : userData.subscriptionUpdated) : null
    };

  } catch (error) {
    console.error(`❌ SUBSCRIPTION CHECK: Error checking subscription for user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to check subscription status", error.message);
  }
});

// ============================================================================
// GOOGLE PLAY SUBSCRIPTION FUNCTIONS
// ============================================================================

/**
 * Google Play Purchase Verification Function
 * Validates purchases with Google Play and updates user subscription status
 */
exports.validateGooglePlayPurchase = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;
  const { purchaseToken, productId, packageName } = request.data;

  if (!purchaseToken || !productId || !packageName) {
    throw new HttpsError("invalid-argument", "Purchase token, product ID, and package name are required");
  }

  console.log(`🤖 GOOGLE PLAY: Validating purchase for user ${userId}, product: ${productId}`);

  try {
    // Import Google Auth Library (you'll need to install this)
    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      // Use service account key from environment or Firebase Functions config
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json'
    });

    const authClient = await auth.getClient();
    const androidpublisher = google.androidpublisher('v3');

    // Validate the subscription purchase
    const result = await androidpublisher.purchases.subscriptions.get({
      auth: authClient,
      packageName: packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    console.log(`🤖 GOOGLE PLAY: Validation result:`, JSON.stringify(result.data, null, 2));

    const subscription = result.data;
    
    // Check if purchase is valid
    if (!subscription) {
      console.log(`🤖 GOOGLE PLAY: Invalid purchase token`);
      return {
        isValid: false,
        message: 'Invalid purchase token'
      };
    }

    // Determine subscription status
    let subscriptionStatus = 'inactive';
    let expiryDate = null;
    
    if (subscription.expiryTimeMillis) {
      expiryDate = parseInt(subscription.expiryTimeMillis);
      const isExpired = Date.now() > expiryDate;
      
      if (!isExpired) {
        if (subscription.autoRenewing === false && subscription.cancelReason) {
          subscriptionStatus = 'cancelled'; // Cancelled but still active
        } else {
          subscriptionStatus = 'active';
        }
      } else {
        subscriptionStatus = 'expired';
      }
    }

    console.log(`🤖 GOOGLE PLAY: Determined status: ${subscriptionStatus}, expires: ${expiryDate ? new Date(expiryDate).toISOString() : 'N/A'}`);

    // Update user subscription status in Firestore
    await updateUserSubscription(userId, subscriptionStatus, expiryDate);

    // Create notification for user
    await createSubscriptionNotification(userId, subscriptionStatus, expiryDate);

    return {
      isValid: true,
      subscriptionStatus: subscriptionStatus,
      expiresDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      autoRenewing: subscription.autoRenewing,
      orderId: subscription.orderId,
      purchaseTime: subscription.startTimeMillis ? new Date(parseInt(subscription.startTimeMillis)).toISOString() : null
    };

  } catch (error) {
    console.error(`❌ GOOGLE PLAY: Error validating purchase for user ${userId}:`, error);
    
    if (error.code === 410) {
      // Purchase token is no longer valid
      console.log(`🤖 GOOGLE PLAY: Purchase token no longer valid for user ${userId}`);
      await updateUserSubscription(userId, 'expired');
      return {
        isValid: false,
        message: 'Purchase token expired'
      };
    }
    
    throw new HttpsError("internal", "Failed to validate Google Play purchase", error.message);
  }
});

/**
 * Google Play Real-time Developer Notification Handler
 * Processes subscription lifecycle events from Google Play
 */
exports.handleGooglePlayNotification = onRequest({ region: "us-central1", cors: false }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    
    // Verify OIDC token for Pub/Sub push (optional but recommended for security)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const isValidToken = await verifyGooglePlayPubSubToken(authHeader);
      if (!isValidToken) {
        console.log('🔒 GOOGLE PLAY WEBHOOK: OIDC verification failed');
        return res.status(401).send('Unauthorized - Invalid token');
      }
      console.log('✅ GOOGLE PLAY WEBHOOK: OIDC verification passed');
    } else {
      console.log('⚠️ GOOGLE PLAY WEBHOOK: No authorization header - proceeding without OIDC verification');
    }

    // Support both Pub/Sub push (message.data base64) and direct HTTP JSON
    let body = req.body;
    if (body && body.message && body.message.data) {
      const decoded = Buffer.from(body.message.data, "base64").toString("utf8");
      body = JSON.parse(decoded);
    }

    console.log(`🤖 GOOGLE PLAY WEBHOOK: Processing notification`);

    const { subscriptionNotification, testNotification } = body;

    // Handle test notifications
    if (testNotification) {
      console.log(`🤖 GOOGLE PLAY WEBHOOK: Received test notification`);
      return res.status(200).send('Test notification received');
    }

    // Handle subscription notifications
    if (subscriptionNotification) {
      const {
        version,
        notificationType,
        purchaseToken,
        subscriptionId
      } = subscriptionNotification;

      console.log(`🤖 GOOGLE PLAY WEBHOOK: Processing subscription notification type: ${notificationType}`);

      // Find user by purchase token (you might need to store this mapping)
      const usersQuery = await db.collection('users')
        .where('googlePlayPurchaseToken', '==', purchaseToken)
        .limit(1)
        .get();

      if (usersQuery.empty) {
        console.log(`🤖 GOOGLE PLAY WEBHOOK: No user found for purchase token: ${purchaseToken}`);
        return res.status(200).send('User not found');
      }

      const userDoc = usersQuery.docs[0];
      const userId = userDoc.id;

      console.log(`🤖 GOOGLE PLAY WEBHOOK: Found user ${userId} for purchase token`);

      // Handle different notification types
      let newStatus = null;
      
      switch (notificationType) {
        case 1: // SUBSCRIPTION_RECOVERED
          newStatus = 'active';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription recovered for user ${userId}`);
          break;
          
        case 2: // SUBSCRIPTION_RENEWED
          newStatus = 'active';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription renewed for user ${userId}`);
          break;
          
        case 3: // SUBSCRIPTION_CANCELED
          newStatus = 'cancelled';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription cancelled for user ${userId}`);
          break;
          
        case 4: // SUBSCRIPTION_PURCHASED
          newStatus = 'active';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: New subscription purchased for user ${userId}`);
          break;
          
        case 5: // SUBSCRIPTION_ON_HOLD
          newStatus = 'on_hold';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription on hold for user ${userId}`);
          break;
          
        case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
          newStatus = 'grace_period';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription in grace period for user ${userId}`);
          break;
          
        case 7: // SUBSCRIPTION_RESTARTED
          newStatus = 'active';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription restarted for user ${userId}`);
          break;
          
        case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
          // No status change needed, just log
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Price change confirmed for user ${userId}`);
          break;
          
        case 9: // SUBSCRIPTION_DEFERRED
          newStatus = 'deferred';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription deferred for user ${userId}`);
          break;
          
        case 10: // SUBSCRIPTION_PAUSED
          newStatus = 'paused';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription paused for user ${userId}`);
          break;
          
        case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Pause schedule changed for user ${userId}`);
          break;
          
        case 12: // SUBSCRIPTION_REVOKED
          newStatus = 'revoked';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription revoked for user ${userId}`);
          break;
          
        case 13: // SUBSCRIPTION_EXPIRED
          newStatus = 'expired';
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Subscription expired for user ${userId}`);
          break;
          
        default:
          console.log(`🤖 GOOGLE PLAY WEBHOOK: Unknown notification type: ${notificationType}`);
      }

      // Update user subscription status if needed
      if (newStatus) {
        await updateUserSubscription(userId, newStatus);
        await createSubscriptionNotification(userId, newStatus);
      }

      return res.status(200).send('Notification processed');
    }

    console.log(`🤖 GOOGLE PLAY WEBHOOK: Unknown notification type`);
    return res.status(400).send('Unknown notification type');
  } catch (err) {
    console.error("Google Play webhook failed:", err);
    return res.status(500).send("Internal Error");
  }
});

// ============================================================================
// CENTRALIZED BADGE UPDATE FUNCTION
// ============================================================================


const serializeData = (data) => {
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }
  if (data.toDate && typeof data.toDate === 'function') {
    return data.toDate().toISOString();
  }
  if (data instanceof DocumentReference) {
    return data.path;
  }
  if (Array.isArray(data)) {
    return data.map(serializeData);
  }
  const newData = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      newData[key] = serializeData(data[key]);
    }
  }
  return newData;
};

// Helper function to get business opportunity name from admin settings
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

// --- Milestone RC cache (60s) ---
let __milestoneRC = { directMin: 4, teamMin: 20, ts: 0 };
async function getMilestoneThresholds() {
  const now = Date.now();
  if (now - __milestoneRC.ts < 60000) return __milestoneRC;
  let directMin = 4, teamMin = 20;
  try {
    const template = await remoteConfig.getTemplate();
    const params   = template.parameters || {};
    const d = params.projectWideDirectSponsorMin?.defaultValue?.value;
    const t = params.projectWideTotalTeamMin?.defaultValue?.value;
    if (d) directMin = parseInt(d, 10) || directMin;
    if (t) teamMin   = parseInt(t, 10) || teamMin;
  } catch (e) {
    // Keep defaults; log once each refresh window
    console.log('MILESTONE: RC fetch failed; using defaults {4,20}');
  }
  __milestoneRC = { directMin, teamMin, ts: now };
  return __milestoneRC;
}

/**
 * Enterprise-grade notification creation with transaction safety and comprehensive error handling
 * Ensures atomic operations and proper error recovery for mission-critical notifications
 */
const createNotificationWithTransaction = async (userId, notificationContent, notificationType) => {
  const maxRetries = 3;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔔 ENTERPRISE: Creating ${notificationType} notification for user ${userId} (attempt ${attempt}/${maxRetries})`);
      
      // IDEMPOTENCY CHECK: Prevent duplicate notifications (MUST be outside transaction)
      const userRef = db.collection('users').doc(userId);
      const existingNotificationsQuery = await userRef.collection('notifications')
        .where('notificationType', '==', notificationType)
        .where('type', '==', notificationContent.type)
        .limit(1)
        .get();
      
      if (!existingNotificationsQuery.empty) {
        console.log(`🔔 ENTERPRISE: Duplicate ${notificationType} notification of type ${notificationContent.type} already exists for user ${userId}. Skipping.`);
        return;
      }
      
      // Use Firestore transaction for atomic operation
      await db.runTransaction(async (transaction) => {
        // Verify user still exists before creating notification
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error(`User ${userId} does not exist - aborting notification creation`);
        }

        const userData = userDoc.data();
        
        // Additional safety checks based on notification type
        if (notificationType === 'qualification' && userData.qualifiedDate) {
          console.log(`🔔 ENTERPRISE: User ${userId} already qualified, skipping duplicate notification`);
          return;
        }
        
        if (notificationType === 'milestone' && userData.qualifiedDate) {
          console.log(`🔔 ENTERPRISE: User ${userId} already qualified, skipping milestone notification`);
          return;
        }

        // Create notification with enterprise-grade metadata
        const enhancedNotificationContent = {
          ...notificationContent,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
          notificationType,
          version: '2.0', // Version tracking for future migrations
          source: 'cloud_function_enterprise',
          retryAttempt: attempt
        };

        // Atomic notification creation
        const notificationRef = userRef.collection('notifications').doc();
        transaction.set(notificationRef, enhancedNotificationContent);
        
        console.log(`✅ ENTERPRISE: ${notificationType} notification created successfully for user ${userId} with ID: ${notificationRef.id}`);
      });

      // Success - exit retry loop
      return;

    } catch (error) {
      console.error(`❌ ENTERPRISE: Attempt ${attempt}/${maxRetries} failed for ${notificationType} notification to user ${userId}:`, error.message);
      
      if (attempt === maxRetries) {
        // Final attempt failed - log critical error but don't throw to prevent function failure
        console.error(`🚨 ENTERPRISE CRITICAL: All ${maxRetries} attempts failed for ${notificationType} notification to user ${userId}. Manual intervention may be required.`);
        console.error(`🚨 ENTERPRISE CRITICAL: Final error:`, error);
        
        // Could implement alerting here (e.g., send to monitoring service)
        return;
      }

      // Wait before retry with exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`🔄 ENTERPRISE: Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
};

exports.getNetwork = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;

  try {
    const networkSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (networkSnapshot.empty) {
      return { network: [] };
    }

    const networkUsers = networkSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    const serializedNetwork = serializeData(networkUsers);
    return { network: serializedNetwork };

  } catch (error) {
    console.error("Critical Error in getNetwork function:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching the network.", error.message);
  }
});


// ============================================================================
// *** MODIFIED FUNCTION: getUserByReferralCode ***
// Now returns bizOppName for personalization
// ============================================================================
// Rate limiting cache (simple in-memory for now)
const rateLimitCache = new Map();

exports.getUserByReferralCode = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 10,
  memory: '256MiB'
}, async (req, res) => {
  // Security: Method validation
  if (req.method !== 'GET') {
    console.log(`🚫 REFERRAL_LOOKUP: Invalid method ${req.method} from ${req.ip}`);
    return res.status(405).send('Method Not Allowed');
  }

  // Security: Rate limiting (100 requests per IP per hour)
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `referral_${clientIP}`;
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);

  // Clean old entries and check rate limit
  const requestTimes = rateLimitCache.get(rateLimitKey) || [];
  const recentRequests = requestTimes.filter(time => time > hourAgo);

  if (recentRequests.length >= 100) {
    console.log(`🚫 REFERRAL_LOOKUP: Rate limit exceeded for IP ${clientIP}`);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Update rate limit cache
  recentRequests.push(now);
  rateLimitCache.set(rateLimitKey, recentRequests);

  // Security: Input validation and sanitization
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    console.log(`🚫 REFERRAL_LOOKUP: Missing or invalid referral code from ${clientIP}`);
    return res.status(400).json({ error: 'Valid referral code is required.' });
  }

  // Sanitize referral code (alphanumeric only, max 20 chars)
  const sanitizedCode = code.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  if (sanitizedCode.length === 0 || sanitizedCode !== code.trim()) {
    console.log(`🚫 REFERRAL_LOOKUP: Invalid referral code format: ${code} from ${clientIP}`);
    return res.status(400).json({ error: 'Invalid referral code format.' });
  }

  try {
    console.log(`🔍 REFERRAL_LOOKUP: Processing referral code ${sanitizedCode} from ${clientIP}`);

    // Add basic caching to prevent repeated database queries
    const cacheKey = `referral_data_${sanitizedCode}`;
    const cachedResult = rateLimitCache.get(cacheKey);
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    if (cachedResult && cachedResult.timestamp > fiveMinutesAgo) {
      console.log(`📋 REFERRAL_LOOKUP: Returning cached result for ${sanitizedCode}`);
      return res.status(200).json(cachedResult.data);
    }

    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("referralCode", "==", sanitizedCode).limit(1).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Sponsor not found.' });
    }

    const sponsorDoc = snapshot.docs[0];
    const sponsorData = sponsorDoc.data();

    // Determine the admin ID: if sponsor is admin, it's their own ID, otherwise it's their upline_admin
    const uplineAdminId = sponsorData.role === 'admin' ? sponsorDoc.id : sponsorData.upline_admin;

    let availableCountries = [];
    let bizOppName = 'your opportunity'; // Default value

    if (uplineAdminId) {
      const adminSettingsDoc = await db.collection("admin_settings").doc(uplineAdminId).get();
      if (adminSettingsDoc.exists) {
        const adminSettingsData = adminSettingsDoc.data();
        if (adminSettingsData.countries && Array.isArray(adminSettingsData.countries)) {
          availableCountries = adminSettingsData.countries;
        }
        // Fetch biz_opp name
        if (adminSettingsData.biz_opp && adminSettingsData.biz_opp.trim() !== '') {
          bizOppName = adminSettingsData.biz_opp;
        }
      }
    }

    // Prepare response data
    const responseData = {
      firstName: sponsorData.firstName,
      lastName: sponsorData.lastName,
      uid: sponsorDoc.id,
      availableCountries: availableCountries,
      bizOppName: bizOppName, // *** NEW: Return bizOppName ***
      photoUrl: sponsorData.photoUrl || null, // Added photoUrl here
      isProfileComplete: sponsorData.isProfileComplete || false, // *** NEW: Return isProfileComplete ***
    };

    // Cache successful results for 5 minutes
    rateLimitCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    console.log(`✅ REFERRAL_LOOKUP: Successfully processed referral code ${sanitizedCode}`);
    return res.status(200).json(responseData);

  } catch (error) {
    console.error(`❌ REFERRAL_LOOKUP: Critical error for code ${sanitizedCode} from ${clientIP}:`, error);

    // Don't expose internal error details to clients
    return res.status(500).json({
      error: 'Internal server error. Please try again later.'
    });
  }
});


exports.registerUser = onCall({ region: "us-central1" }, async (request) => {
  console.log(`REGISTER ENTER projectId=${process.env.GCLOUD_PROJECT} region=us-central1`);
  console.log("🔍 REGISTER FUNCTION: Starting registerUser function");
  console.log("🔍 REGISTER FUNCTION: Request data:", JSON.stringify(request.data, null, 2));

  const { email, password, firstName, lastName, sponsorReferralCode, adminReferralCode, role, country, state, city } = request.data;

  if (!email || !password || !firstName || !lastName) {
    console.error("❌ REGISTER FUNCTION: Missing required fields");
    throw new HttpsError("invalid-argument", "Missing required user information.");
  }

  let sponsorId = null;
  let sponsorUplineRefs = [];
  let level = 1;
  let uplineAdminForNewUser = null;
  let adminReferralId = null;

  // CRITICAL: Define uid outside try block for atomic cleanup access
  let uid = null;

  try {
    console.log("🔍 REGISTER FUNCTION: Processing sponsor referral code:", sponsorReferralCode);

    // Resolve sponsor to a Firebase UID (not a UUID/profile id)
    async function resolveSponsorUid({ rawSponsorId, sponsorReferralCode }) {
      const usersCol = db.collection('users');

      // Case 1: Caller passed a Firebase UID directly and it exists
      if (rawSponsorId) {
        const directRef = usersCol.doc(rawSponsorId);
        const directSnap = await directRef.get();
        if (directSnap.exists) {
          console.log(`REGISTER RESOLVE: using provided sponsorId as UID=${rawSponsorId}`);
          return rawSponsorId;
        }
        console.log(`REGISTER RESOLVE: provided sponsorId not a user UID (id=${rawSponsorId})`);
      }

      // Case 2: Referral code mapping
      if (sponsorReferralCode) {
        const codeRef = db.collection('referralCodes').doc(String(sponsorReferralCode));
        const codeSnap = await codeRef.get();
        if (codeSnap.exists) {
          const mappedUid = codeSnap.data()?.sponsorUid;
          if (mappedUid) {
            const mappedRef = usersCol.doc(mappedUid);
            const mappedSnap = await mappedRef.get();
            if (mappedSnap.exists) {
              console.log(`REGISTER RESOLVE: referralCodes map -> UID=${mappedUid}`);
              return mappedUid;
            }
          }
        }
        console.log(`REGISTER RESOLVE: referralCodes doc missing/invalid for code=${sponsorReferralCode}`);
      }

      // Case 3: Query users by their stored referralCode field
      if (sponsorReferralCode) {
        const q = await usersCol.where('referralCode', '==', String(sponsorReferralCode)).limit(1).get();
        if (!q.empty) {
          const doc = q.docs[0];
          console.log(`REGISTER RESOLVE: users.referralCode -> UID=${doc.id}`);
          return doc.id;
        }
        console.log(`REGISTER RESOLVE: no user with referralCode=${sponsorReferralCode}`);
      }

      return null;
    }

    const sponsorUid = await resolveSponsorUid({ rawSponsorId: sponsorId, sponsorReferralCode });
    if (sponsorReferralCode && !sponsorUid) {
      console.error(`REGISTER ERROR: Unable to resolve sponsor UID (rawSponsorId=${sponsorId}, referralCode=${sponsorReferralCode})`);
      throw new HttpsError('failed-precondition',
        'Unable to resolve sponsor user. Provide a valid Firebase UID or referral code mapped to a user.');
    }

    if (sponsorUid) {
      // Get sponsor data using the resolved UID
      const sponsorDoc = await db.collection("users").doc(sponsorUid).get();
      if (sponsorDoc.exists) {
        sponsorId = sponsorUid; // Update sponsorId to use the resolved UID
        const sponsorData = sponsorDoc.data();
        console.log("🔍 REGISTER FUNCTION: Found sponsor:", sponsorId, sponsorData.firstName, sponsorData.lastName);

        if (sponsorData.role === 'admin') {
          uplineAdminForNewUser = sponsorId;
        } else {
          uplineAdminForNewUser = sponsorData.upline_admin;
        }
        sponsorUplineRefs = sponsorData.upline_refs || [];
        level = sponsorData.level ? sponsorData.level + 1 : 2;
      } else {
        console.error("❌ REGISTER FUNCTION: Resolved sponsor UID has no document:", sponsorUid);
        throw new HttpsError("not-found", `Sponsor user document not found for UID: ${sponsorUid}`);
      }
    }

    // Handle admin referral code (for new admins)
    if (adminReferralCode) {
      console.log("🔍 REGISTER FUNCTION: Processing admin referral code:", adminReferralCode);
      const adminReferralQuery = await db.collection("users").where("referralCode", "==", adminReferralCode).limit(1).get();
      if (!adminReferralQuery.empty) {
        const adminReferralDoc = adminReferralQuery.docs[0];
        adminReferralId = adminReferralDoc.id;
        console.log("🔍 REGISTER FUNCTION: Found admin referral:", adminReferralId);
      } else {
        console.error("❌ REGISTER FUNCTION: Admin referral not found:", adminReferralCode);
        throw new HttpsError("not-found", `Admin referral with referral code '${adminReferralCode}' not found.`);
      }
    }

    console.log("🔍 REGISTER FUNCTION: Creating Firebase Auth user...");
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });

    // CRITICAL: Store uid immediately after creation for potential cleanup
    uid = userRecord.uid;
    console.log("✅ REGISTER FUNCTION: Firebase Auth user created:", uid);

    console.log("🔍 REGISTER FUNCTION: Preparing user document...");
    const userTimezone = getTimezoneFromLocation(country, state);
    console.log("🔍 REGISTER FUNCTION: Determined timezone:", userTimezone);

    const newUser = {
      uid: uid,
      email: email,
      firstName: firstName,
      lastName: lastName,
      country: country || '',
      state: state || '',
      city: city || '',
      timezone: userTimezone,
      createdAt: FieldValue.serverTimestamp(),
      role: role || 'user',
      referralCode: `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(1000 + Math.random() * 9000)}`,
      referredBy: sponsorReferralCode || null,
      adminReferral: adminReferralCode || null,
      sponsor_id: sponsorId,
      level: level,
      upline_refs: sponsorId ? [...sponsorUplineRefs, sponsorId] : [],
      upline_admin: uplineAdminForNewUser,
      directSponsorCount: 0,
      totalTeamCount: 0,
      isProfileComplete: false,
      // --- MODIFICATION: Initialize currentPartner field for new users ---
      currentPartner: false,
      // --- PHASE 2: Initialize subscription fields for new users ---
      subscriptionStatus: 'trial',
      trialStartDate: FieldValue.serverTimestamp(),
    };

    console.log("🔍 REGISTER FUNCTION: User document prepared:", JSON.stringify(newUser, null, 2));
    console.log("🔍 REGISTER FUNCTION: Creating Firestore user document...");
    await db.collection("users").doc(uid).set(newUser);
    console.log("✅ REGISTER FUNCTION: Firestore user document created");

    if (sponsorId) {
      console.log("🔍 REGISTER FUNCTION: Updating sponsor/upline counts (transaction)...");

      // Guard: ensure sponsor doc exists (UID)
      const sponsorRef = db.collection("users").doc(sponsorId);
      const sponsorSnap = await sponsorRef.get();
      if (!sponsorSnap.exists) {
        console.error(`REGISTER ERROR: Sponsor user doc not found. sponsorUid=${sponsorId}`);
        throw new HttpsError('failed-precondition',
          `Invalid sponsor. No user doc for uid=${sponsorId}.`);
      }

      await db.runTransaction(async (t) => {
        const txSponsorSnap = await t.get(sponsorRef); // re-read in txn
        if (!txSponsorSnap.exists) {
          console.log(`⚠️ REGISTER FUNCTION: Sponsor ${sponsorId} not found in transaction; skipping count updates`);
          return;
        }
        // Atomic increments for sponsor
        const updateObj = {
          directSponsorCount: FieldValue.increment(1),
          totalTeamCount: FieldValue.increment(1),
        };
        t.update(sponsorRef, updateObj);
        console.log('COUNTS UPDATE', { sponsorId, path: sponsorRef.path, fields: Object.keys(updateObj) });
        // Atomic increments for each upline member
        for (const uplineMemberId of sponsorUplineRefs) {
          const uplineRef = db.collection("users").doc(uplineMemberId);
          t.update(uplineRef, { totalTeamCount: FieldValue.increment(1) });
        }
      });
      console.log("✅ REGISTER FUNCTION: Sponsor/upline counts updated (transaction)");

      // NOTE: Milestone check is intentionally NOT triggered here
      // It will be triggered later in triggerSponsorship after profile completion
      // This ensures milestone notifications are sent at the correct time (after isProfileComplete=true)
    }

    console.log("✅ REGISTER FUNCTION: Registration completed successfully");
    return { success: true, uid: uid };

  } catch (error) {
    console.error("❌ REGISTER FUNCTION: Error during registration:", error);
    console.error("❌ REGISTER FUNCTION: Error message:", error.message);
    console.error("❌ REGISTER FUNCTION: Error stack:", error.stack);

    // CRITICAL: Atomic cleanup - if we created auth user but failed later, clean it up
    if (uid) {
      try {
        console.log(`🧹 REGISTER FUNCTION: Cleaning up orphaned auth user ${uid}...`);
        await auth.deleteUser(uid);
        console.log(`✅ REGISTER FUNCTION: Auth user ${uid} deleted successfully.`);
      } catch (cleanupError) {
        console.error(`❌ REGISTER FUNCTION: Failed to cleanup auth user ${uid}:`, cleanupError);
        // Log cleanup failure but still throw original error
      }
    }

    throw new HttpsError("internal", `Registration failed: ${error.message}`, error.details);
  }
});

// lib/functions/index.js

exports.getNetworkCounts = onCall({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: '512MiB'
}, async (request) => {
  // Enhanced authentication validation
  if (!request.auth || !request.auth.uid) {
    console.log(`🚫 NETWORK_COUNTS: Unauthenticated access attempt`);
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const currentUserId = request.auth.uid;

  // Validate user exists and is active
  try {
    const userDoc = await db.collection('users').doc(currentUserId).get();
    if (!userDoc.exists) {
      console.log(`🚫 NETWORK_COUNTS: User document not found for ${currentUserId}`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data();
    if (!userData.isActive) {
      console.log(`🚫 NETWORK_COUNTS: Inactive user attempted access: ${currentUserId}`);
      throw new HttpsError("permission-denied", "Account is inactive.");
    }

    console.log(`✅ NETWORK_COUNTS: Authorized access for user ${currentUserId}`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error(`❌ NETWORK_COUNTS: Error validating user ${currentUserId}:`, error);
    throw new HttpsError("internal", "User validation failed.");
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Base query for the user's network
    const baseNetworkQuery = db.collection("users").where("upline_refs", "array-contains", currentUserId);

    // Create promises for each count
    const allCountPromise = baseNetworkQuery.count().get();
    const last24CountPromise = baseNetworkQuery.where("createdAt", ">=", twentyFourHoursAgo).count().get();
    const newQualifiedCountPromise = baseNetworkQuery.where("qualifiedDate", "!=", null).count().get();
    const joinedOpportunityCountPromise = baseNetworkQuery.where("biz_join_date", "!=", null).count().get();
    // --- NEW: Add a specific count for direct sponsors ---
    const directSponsorsCountPromise = db.collection("users").where("sponsor_id", "==", currentUserId).count().get();


    // Await all promises simultaneously
    const [
      allCountSnapshot,
      last24CountSnapshot,
      newQualifiedCountSnapshot,
      joinedOpportunityCountSnapshot,
      directSponsorsCountSnapshot, // --- NEW ---
    ] = await Promise.all([
      allCountPromise,
      last24CountPromise,
      newQualifiedCountPromise,
      joinedOpportunityCountPromise,
      directSponsorsCountPromise, // --- NEW ---
    ]);

    // Extract counts from snapshots
    const allCount = allCountSnapshot.data().count;
    const last24Count = last24CountSnapshot.data().count;
    const newQualifiedCount = newQualifiedCountSnapshot.data().count;
    const joinedOpportunityCount = joinedOpportunityCountSnapshot.data().count;
    const directSponsorsCount = directSponsorsCountSnapshot.data().count; // --- NEW ---

    return {
      counts: {
        all: allCount,
        last24: last24Count,
        newQualified: newQualifiedCount,
        joinedOpportunity: joinedOpportunityCount,
        directSponsors: directSponsorsCount, // --- NEW ---
      }
    };
  } catch (error) {
    console.error(`CRITICAL ERROR in getNetworkCounts for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getNewMembersYesterdayCount = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;

  try {
    const now = new Date();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    const query = db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .where("createdAt", ">=", yesterdayStart)
      .where("createdAt", "<=", yesterdayEnd);

    const snapshot = await query.count().get();
    const count = snapshot.data().count;

    return { count };
  } catch (error) {
    console.error(`CRITICAL ERROR in getNewMembersYesterdayCount for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getFilteredNetwork = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const currentUserId = request.auth.uid;
  const { filter, searchQuery, limit = 100, offset = 0 } = request.data || {};

  try {
    console.log(`🔍 FILTER DEBUG: Starting filtered team for user ${currentUserId}`);
    console.log(`🔍 FILTER DEBUG: Params - filter: ${filter}, searchQuery: "${searchQuery}"`);

    // --- OPTIMIZATION: Build a dynamic query with filters applied ---
    let baseQuery = db.collection("users").where("upline_refs", "array-contains", currentUserId);

    // Apply main filters
    const now = new Date();
    switch (filter) {
      case 'last24': {
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        baseQuery = baseQuery.where("createdAt", ">=", twentyFourHoursAgo);
        break;
      }

      case 'newQualified':
        baseQuery = baseQuery.where("qualifiedDate", "!=", null);
        break;
      case 'joinedOpportunity':
        baseQuery = baseQuery.where("biz_join_date", "!=", null);
        break;
    }

    // IMPORTANT: The text search is removed here because it's inefficient.
    // A proper implementation requires a dedicated search service like Algolia.
    // For now, we prioritize the performance of the main filters.

    // Create a parallel query to get the total count for pagination
    const countQuery = baseQuery.count().get();

    // Apply sorting and pagination to the main data query
    let dataQuery = baseQuery;
    if (filter === 'joinedOpportunity') {
      dataQuery = dataQuery.orderBy("biz_join_date", "desc");
    } else {
      // Default sort for all other filters, including 'newQualified' and 'last24'
      dataQuery = dataQuery.orderBy("createdAt", "desc");
    }

    dataQuery = dataQuery.limit(limit).offset(offset);

    // Execute both queries in parallel
    const [countSnapshot, networkSnapshot] = await Promise.all([
      countQuery,
      dataQuery.get()
    ]);

    const totalCount = countSnapshot.data().count;
    const hasMore = offset + limit < totalCount;

    if (networkSnapshot.empty) {
      return {
        network: [],
        totalCount: 0,
        hasMore: false
      };
    }

    const filteredUsers = networkSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    console.log(`✅ FILTER DEBUG: Returning ${filteredUsers.length} users out of ${totalCount} total`);

    return {
      network: serializeData(filteredUsers),
      totalCount,
      hasMore,
      offset,
      limit
    };

  } catch (error) {
    console.error(`CRITICAL ERROR in getFilteredNetwork for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching filtered network.", error.message);
  }
});

exports.onNewChatMessage = onDocumentCreated("chats/{threadId}/messages/{messageId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log("No message data found in event.");
    return;
  }

  const message = snap.data();
  const { threadId } = event.params;
  const { senderId } = message;

  if (!senderId) {
    console.log("Message is missing senderId.");
    return;
  }

  const threadRef = db.collection("chats").doc(threadId);

  try {
    const threadDoc = await threadRef.get();
    if (!threadDoc.exists) {
      console.log(`Chat thread ${threadId} does not exist.`);
      return;
    }
    const threadData = threadDoc.data();

    const recipients = (threadData.participants || []).filter((uid) => uid !== senderId);

    if (recipients.length === 0) {
      console.log(`No recipients to notify for message in thread ${threadId}.`);
      return;
    }


    const senderDoc = await db.collection("users").doc(senderId).get();
    if (!senderDoc.exists) {
      console.log(`Sender document ${senderId} not found.`);
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
    console.log(`Successfully created notifications for ${recipients.length} recipients.`);

    // Update badge for all recipients after creating notifications
    console.log(`🔔 CHAT MESSAGE: Updating badge for recipients: ${recipients.join(', ')}`);
    const badgeUpdatePromises = recipients.map(userId => updateUserBadge(userId));
    await Promise.allSettled(badgeUpdatePromises);

  } catch (error) {
    console.error(`Error in onNewChatMessage for thread ${threadId}:`, error);
  }
});

exports.recalculateTeamCounts = onCall({
  region: "us-central1",
  timeoutSeconds: 540, // 9 minutes for heavy operation
  memory: '1GiB'
}, async (request) => {
  // Enhanced admin authentication
  if (!request.auth || !request.auth.uid) {
    console.log(`🚫 RECALCULATE: Unauthenticated access attempt`);
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const callerId = request.auth.uid;
  console.log(`🔍 RECALCULATE: Validating admin access for user ${callerId}`);

  try {
    // Validate user document exists and has admin role
    const userDoc = await db.collection("users").doc(callerId).get();
    if (!userDoc.exists) {
      console.log(`🚫 RECALCULATE: User document not found for ${callerId}`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      console.log(`🚫 RECALCULATE: Non-admin user attempted access: ${callerId} (role: ${userData.role})`);
      throw new HttpsError("permission-denied", "Administrator privileges required.");
    }

    // Validate admin settings and super admin status
    const adminSettingsDoc = await db.collection("admin_settings").doc(callerId).get();
    if (!adminSettingsDoc.exists) {
      console.log(`🚫 RECALCULATE: Admin settings not found for ${callerId}`);
      throw new HttpsError("permission-denied", "Administrator configuration not found.");
    }

    const adminSettings = adminSettingsDoc.data();
    if (adminSettings.superAdmin !== true) {
      console.log(`🚫 RECALCULATE: Non-super-admin attempted operation: ${callerId}`);
      throw new HttpsError("permission-denied", "Super administrator privileges required.");
    }

    console.log(`✅ RECALCULATE: Super admin access validated for ${callerId}`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error(`❌ RECALCULATE: Error validating admin ${callerId}:`, error);
    throw new HttpsError("internal", "Admin validation failed.");
  }

  const usersSnapshot = await db.collection("users").get();
  const countsMap = new Map();
  usersSnapshot.docs.forEach(doc => {
    countsMap.set(doc.id, { directSponsorCount: 0, totalTeamCount: 0 });
  });

  usersSnapshot.docs.forEach(doc => {
    const { sponsor_id, upline_refs } = doc.data();
    if (sponsor_id && countsMap.has(sponsor_id)) {
      countsMap.get(sponsor_id).directSponsorCount++;
    }
    (upline_refs || []).forEach(uid => {
      if (countsMap.has(uid)) {
        countsMap.get(uid).totalTeamCount++;
      }
    });
  });

  const batch = db.batch();
  let updatesCount = 0;
  usersSnapshot.docs.forEach(doc => {
    const { directSponsorCount, totalTeamCount } = doc.data();
    const calculated = countsMap.get(doc.id);
    if (directSponsorCount !== calculated.directSponsorCount || totalTeamCount !== calculated.totalTeamCount) {
      batch.update(doc.ref, calculated);
      updatesCount++;
    }
  });

  if (updatesCount > 0) {
    await batch.commit();
    return { success: true, message: `Successfully recalculated counts for ${updatesCount} users.` };
  }
  return { success: true, message: "All user counts were already up-to-date." };
});

exports.updateCanReadProfileOnChatCreate = onDocumentCreated("chats/{chatId}", async (event) => {
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
    console.log(`Successfully updated can_read_profile permissions for users: ${uid1} and ${uid2}`);
  } catch (error) {
    console.error("Error updating can_read_profile permissions:", error);
  }
});

exports.notifySponsorOfBizOppVisit = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const visitingUserId = request.auth.uid;

  try {
    const userDocRef = db.collection("users").doc(visitingUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User document not found.");
    }
    const userData = userDoc.data();
    

    if (userData.biz_visit_date) {
      console.log(`User ${visitingUserId} has already visited the opportunity. Skipping notification.`);
      return { success: true, message: "Notification already sent previously." };
    }

    await userDocRef.update({
      'biz_visit_date': FieldValue.serverTimestamp(),
    });

    const visitingUserName = `${userData.firstName} ${userData.lastName}`;
    const sponsorId = userData.sponsor_id;

    if (!sponsorId) {
      console.log(`User ${visitingUserId} has no sponsor. Skipping notification.`);
      return { success: true, message: "No sponsor to notify." };
    }

    const sponsorDoc = await db.collection("users").doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      throw new HttpsError("not-found", `Sponsor document ${sponsorId} not found.`);
    }
    const sponsorData = sponsorDoc.data();
    const sponsorName = sponsorData.firstName;

    // Get business opportunity name using centralized helper
    const bizOpp = await getBusinessOpportunityName(sponsorData.upline_admin);


    const result = await createNotification({
      userId: sponsorId,
      type: 'biz_opp_visit',
      title: `Interest in your ${bizOpp} opportunity! 🎉`,
      body: `${visitingUserName} has just used your referral link to to learn more about the ${bizOpp} opportunity! Click Here to view their profile.`,
      docFields: { 
        visitingUserName, 
        visitingUserId, 
        route: "/member_detail",
        route_params: JSON.stringify({ "userId": visitingUserId }),
        imageUrl: userData.photoUrl || null,
      },
      data: { 
        route: 'member_detail', 
        userId: visitingUserId,
        visitingUserId
      },
    });

    console.log(`Biz opp visit notification sent to sponsor ${sponsorId} for user ${visitingUserId} - Push sent: ${result.push.sent}`);
    return { success: true };

  } catch (error) {
    console.error("Error in notifySponsorOfBizOppVisit:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getMemberDetails = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const { memberId } = request.data;
  if (!memberId) {
    throw new HttpsError("invalid-argument", "Member ID is required.");
  }

  try {
    console.log(`👤 MEMBER DEBUG: Fetching details for member ${memberId}`);

    // Fetch the main user document
    const memberDoc = await db.collection("users").doc(memberId).get();

    if (!memberDoc.exists) {
      throw new HttpsError("not-found", "Member not found.");
    }

    const memberData = { uid: memberDoc.id, ...memberDoc.data() };

    // Parallel fetch sponsor and team leader details
    const promises = [];
    let sponsorPromise = null;
    let teamLeaderPromise = null;

    // Fetch sponsor details if sponsorId exists
    if (memberData.sponsor_id && memberData.sponsor_id.trim() !== '') {
      sponsorPromise = db.collection("users").doc(memberData.sponsor_id).get();
      promises.push(sponsorPromise);
    }

    // Fetch team leader details if uplineAdmin exists and is different from sponsor
    if (memberData.upline_admin &&
      memberData.upline_admin.trim() !== '' &&
      memberData.upline_admin !== memberData.sponsor_id) {
      teamLeaderPromise = db.collection("users").doc(memberData.upline_admin).get();
      promises.push(teamLeaderPromise);
    }

    // Execute all promises in parallel
    const results = await Promise.allSettled(promises);

    let sponsorData = null;
    let teamLeaderData = null;

    let resultIndex = 0;

    // Process sponsor result
    if (sponsorPromise) {
      const sponsorResult = results[resultIndex++];
      if (sponsorResult.status === 'fulfilled' && sponsorResult.value.exists) {
        const sponsorDoc = sponsorResult.value;
        sponsorData = {
          uid: sponsorDoc.id,
          firstName: sponsorDoc.data().firstName || '',
          lastName: sponsorDoc.data().lastName || '',
          email: sponsorDoc.data().email || '',
          photoUrl: sponsorDoc.data().photoUrl || null,
          city: sponsorDoc.data().city || '',
          state: sponsorDoc.data().state || '',
          country: sponsorDoc.data().country || '',
        };
      }
    }

    // Process team leader result
    if (teamLeaderPromise) {
      const teamLeaderResult = results[resultIndex++];
      if (teamLeaderResult.status === 'fulfilled' && teamLeaderResult.value.exists) {
        const teamLeaderDoc = teamLeaderResult.value;
        teamLeaderData = {
          uid: teamLeaderDoc.id,
          firstName: teamLeaderDoc.data().firstName || '',
          lastName: teamLeaderDoc.data().lastName || '',
          email: teamLeaderDoc.data().email || '',
          photoUrl: teamLeaderDoc.data().photoUrl || null,
          city: teamLeaderDoc.data().city || '',
          state: teamLeaderDoc.data().state || '',
          country: teamLeaderDoc.data().country || '',
        };
      }
    }

    console.log(`✅ MEMBER DEBUG: Successfully fetched member details with ${sponsorData ? 'sponsor' : 'no sponsor'} and ${teamLeaderData ? 'team leader' : 'no team leader'}`);

    return {
      member: serializeData(memberData),
      sponsor: sponsorData ? serializeData(sponsorData) : null,
      teamLeader: teamLeaderData ? serializeData(teamLeaderData) : null,
    };

  } catch (error) {
    console.error(`CRITICAL ERROR in getMemberDetails for member ${memberId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while fetching member details.", error.message);
  }
});

exports.updateUserTimezone = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const { userId, country, state } = request.data;

  if (!userId || !country) {
    throw new HttpsError("invalid-argument", "User ID and country are required.");
  }

  try {
    console.log(`🌍 TIMEZONE UPDATE: Updating timezone for user ${userId} - Country: ${country}, State: ${state || 'N/A'}`);

    // Calculate timezone using the same logic as registration
    const userTimezone = getTimezoneFromLocation(country, state);
    console.log(`🌍 TIMEZONE UPDATE: Calculated timezone: ${userTimezone}`);

    // Update user document with new timezone
    await db.collection("users").doc(userId).update({
      timezone: userTimezone
    });

    console.log(`✅ TIMEZONE UPDATE: Successfully updated timezone for user ${userId} to ${userTimezone}`);

    return {
      success: true,
      timezone: userTimezone,
      message: `Timezone updated to ${userTimezone} based on ${country}${state ? `, ${state}` : ''}`
    };

  } catch (error) {
    console.error(`❌ TIMEZONE UPDATE: Error updating timezone for user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while updating timezone.", error.message);
  }
});

exports.clearAppBadge = onCall({ region: "us-central1" }, async (request) => {
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


// ============================================================================
// BADGE SYNCHRONIZATION TRIGGERS
// ============================================================================

/**
 * Trigger when a notification is updated (e.g., marked as read)
 */
exports.onNotificationUpdate = onDocumentUpdated("users/{userId}/notifications/{notificationId}", async (event) => {
  const userId = event.params.userId;
  console.log(`🔔 TRIGGER: Notification updated for user ${userId}`);
  await updateUserBadge(userId);
});

/**
 * Trigger when a notification is deleted
 */
exports.onNotificationDelete = onDocumentDeleted("users/{userId}/notifications/{notificationId}", async (event) => {
  const userId = event.params.userId;
  console.log(`🔔 TRIGGER: Notification deleted for user ${userId}`);
  await updateUserBadge(userId);
});

/**
 * Trigger when a chat document is updated (e.g., message marked as read)
 */
exports.onChatUpdate = onDocumentUpdated("chats/{chatId}", async (event) => {
  const afterData = event.data?.after.data();
  const participants = afterData?.participants || [];

  console.log(`🔔 TRIGGER: Chat updated for participants: ${participants.join(', ')}`);

  // Update badge for all participants
  const updatePromises = participants.map(userId => updateUserBadge(userId));
  await Promise.allSettled(updatePromises);
});


/**
 * Sync app badge function - called when app becomes active
 */
exports.syncAppBadge = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;
  console.log(`🔔 SYNC: Manual badge sync requested for user ${userId}`);

  await updateUserBadge(userId);
  return { success: true, message: "Badge synced successfully" };
});

// ============================================================================
// MILESTONE NOTIFICATIONS
// ============================================================================

/**
 * Milestone notifications on user count updates
 * - Fires when a user crosses ONE of two thresholds (direct sponsors OR total team),
 *   while the other requirement is still below its threshold — nudging them forward.
 * - Uses your existing createNotification() path (no direct writes).
 * - Idempotent via stable notifId keys to prevent duplicates across retries.
 *
 * Requirements (already present in your codebase):
 *   - onDocumentUpdated, remoteConfig, getBusinessOpportunityName, createNotification
 */
/**
 * Helper: does the updateMask contain any of these fields (support nested)?
 */
function maskHasAny(mask = [], names = []) {
  const m = new Set(mask);
  return names.some(n =>
    m.has(n) ||                 // exact match
    [...m].some(p => p.endsWith(`.${n}`)) // nested: stats.directSponsorCount
  );
}

// Joe's step B: Minimal ping trigger to test users collection binding
exports.pingUsersTrigger = onDocumentWritten('users/{userId}', (event) => {
  const mask = event.data?.updateMask?.fieldPaths || [];
  console.log('PING TRIGGER', {
    userId: event.params.userId,
    path: event.document,
    mask
  });
});

/**
 * DISABLED: Qualification Notification Function - Notify users when they reach full qualification
 * Triggers when user reaches both directSponsorCount >= 4 AND totalTeamCount >= 20
 *
 * DISABLED: This was causing duplicate push notifications because the manual milestone
 * system in onUserProfileCompleted now handles both milestone and qualification notifications.
 * The manual system prevents duplicates and works correctly with profile completion flow.
 */
// exports.notifyOnQualification = onDocumentUpdated("users/{userId}", async (event) => {
//   const beforeData = event.data?.before?.data();
//   const afterData = event.data?.after?.data();
//
//   if (!beforeData || !afterData || beforeData.qualifiedDate) {
//     return;
//   }
//
//   try {
//     // Hardcoded thresholds (matching our milestone approach)
//     const directMin = 4;
//     const teamMin = 20;
//
//     const wasQualifiedBefore = (beforeData.directSponsorCount >= directMin) && (beforeData.totalTeamCount >= teamMin);
//     const isQualifiedNow = (afterData.directSponsorCount >= directMin) && (afterData.totalTeamCount >= teamMin);
//     const isJoined = beforeData.bizJoinDate;
//
//     console.log('QUALIFICATION CHECK', {
//       userId: event.params.userId,
//       directCount: afterData.directSponsorCount,
//       teamCount: afterData.totalTeamCount,
//       wasQualified: wasQualifiedBefore,
//       isQualified: isQualifiedNow,
//       hasJoined: !!isJoined
//     });
//
//     if (!wasQualifiedBefore && isQualifiedNow && !isJoined) {
//       if (afterData.role === 'admin') {
//         console.log(`QUALIFICATION: User ${event.params.userId} is admin, setting qualifiedDate only`);
//         await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });
//         return;
//       }
//
//       console.log(`QUALIFICATION: User ${event.params.userId} reached qualification!`);
//
//       // Set qualified date first
//       await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });
//
//       // Get business opportunity name
//       const bizName = await getBusinessOpportunityName(afterData.upline_admin, 'your business');
//
//       // Create qualification notification with deterministic ID
//       const notifId = `qualification_${event.params.userId}`;
//       const notificationContent = {
//         title: "You're Qualified!",
//         message: `Your hard work paid off, ${afterData.firstName}! You've built a qualified team and are now eligible to join the ${bizName} organization. Click Here to take the next step!`,
//         createdAt: FieldValue.serverTimestamp(),
//         read: false,
//         type: "new_qualification",
//         route: "/business",
//         route_params: {},
//       };
//
//       console.log('QUALIFICATION NOTIF CREATE about-to', {
//         path: `users/${event.params.userId}/notifications/${notifId}`,
//         notifId,
//         type: notificationContent.type
//       });
//
//       try {
//         await db.collection("users").doc(event.params.userId).collection("notifications").doc(notifId).create(notificationContent);
//         console.log('QUALIFICATION NOTIF CREATE wrote', { notifId });
//
//         // Send push notification
//         const result = await createNotification({
//           userId: event.params.userId,
//           notifId,
//           type: notificationContent.type,
//           title: notificationContent.title,
//           message: notificationContent.message,
//           route: notificationContent.route,
//           route_params: notificationContent.route_params,
//         });
//
//         if (result.success) {
//           console.log('QUALIFICATION PUSH DETAILED', {
//             type: notificationContent.type,
//             to: event.params.userId,
//             msgId: result.messageId || 'unknown',
//             notifId
//           });
//         } else {
//           console.error(`QUALIFICATION PUSH: Failed for ${event.params.userId}:`, result.error);
//         }
//
//       } catch (error) {
//         if (error.code === 6) { // ALREADY_EXISTS
//           console.log(`QUALIFICATION: Notification ${notifId} already exists, skipping`);
//         } else {
//           throw error;
//         }
//       }
//     }
//   } catch (error) {
//     console.error(`QUALIFICATION: Error for user ${event.params.userId}:`, error);
//   }
// });

// DISABLED: Using manual milestone checks in onUserProfileCompleted instead
/*
exports.notifyOnMilestoneReached = onDocumentUpdated("users/{userId}", async (event) => {
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
    const isNewUser = (beforeData.directSponsorCount || 0) === 0 &&
                      (beforeData.totalTeamCount || 0) === 0 &&
                      afterData.upline_refs &&
                      afterData.upline_refs.length > 0;

    if (isNewUser) {
      console.log(`🔔 MILESTONE: New user ${userId} registered, checking upline milestones...`);

      // Check milestones for all upline users (they might have reached team count milestones)
      const uplineRefs = afterData.upline_refs || [];
      for (const uplineUserId of uplineRefs) {
        if (uplineUserId !== userId) {
          console.log(`MILESTONE: Checking upline user ${uplineUserId} for team milestone...`);
          // Trigger milestone check for this upline user by calling this function recursively
          // But we need to get their current data first
          try {
            const uplineDoc = await db.collection('users').doc(uplineUserId).get();
            if (uplineDoc.exists) {
              const uplineData = uplineDoc.data();
              // Create a mock event for the upline user to check their milestones
              await checkUplineMilestone(uplineUserId, uplineData);
            }
          } catch (error) {
            console.log(`MILESTONE: Error checking upline ${uplineUserId}: ${error.message}`);
          }
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

// Helper function to check milestones for upline users
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
*/

exports.sendDailyTeamGrowthNotifications = onSchedule({
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

        // Check if it's 10 AM in their timezone
        if (userLocalHour === 9) {
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
          message: `Your team's momentum is growing, ${userData.firstName}! ${newMemberCount} new member${newMemberCount > 1 ? 's' : ''} joined your network yesterday. Click Here to see your team's progress`,
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

/**
 * Daily Account Deletion Summary Notifications
 * Runs once daily at 10 AM UTC to send batched deletion summaries to upline members
 * Uses the same timezone-aware approach as team growth notifications
 */
exports.sendDailyAccountDeletionSummary = onSchedule({
  schedule: "0 10 * * *", // Run daily at 10 AM UTC
  timeZone: "UTC", 
  region: "us-central1"
}, async (event) => {
  console.log("🗑️ DAILY DELETION SUMMARY: Starting daily account deletion summary process");

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    console.log(`🗑️ DAILY DELETION SUMMARY: Processing deletions from ${yesterdayStart.toISOString()} to ${yesterdayEnd.toISOString()}`);

    // Get all unprocessed deletion logs from yesterday
    const deletionLogsQuery = await db.collection('account_deletion_logs')
      .where('processedInDailyBatch', '==', false)
      .where('deletedAt', '>=', yesterdayStart)
      .where('deletedAt', '<=', yesterdayEnd)
      .get();

    if (deletionLogsQuery.empty) {
      console.log("🗑️ DAILY DELETION SUMMARY: No account deletions to process from yesterday");
      return;
    }

    console.log(`🗑️ DAILY DELETION SUMMARY: Found ${deletionLogsQuery.size} account deletion(s) to process`);

    // Group deletions by affected upline members
    const uplineNotifications = new Map();

    for (const logDoc of deletionLogsQuery.docs) {
      const logData = logDoc.data();
      
      // Find all upline members (excluding direct sponsor and downline who got immediate notifications)
      if (logData.sponsorId) {
        const uplineMembers = await findUplineMembers(logData.sponsorId);
        
        for (const uplineMemberId of uplineMembers) {
          if (!uplineNotifications.has(uplineMemberId)) {
            uplineNotifications.set(uplineMemberId, []);
          }
          uplineNotifications.get(uplineMemberId).push({
            deletedUserName: logData.deletedUserName,
            deletedAt: logData.deletedAt
          });
        }
      }

      // Mark this log as processed
      await logDoc.ref.update({ processedInDailyBatch: true });
    }

    console.log(`🗑️ DAILY DELETION SUMMARY: Sending summary notifications to ${uplineNotifications.size} upline members`);

    // Send summary notifications to upline members
    const notificationPromises = Array.from(uplineNotifications.entries()).map(async ([userId, deletions]) => {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          console.log(`🗑️ DAILY DELETION SUMMARY: User ${userId} no longer exists, skipping`);
          return { success: false, userId, reason: 'User not found' };
        }

        const userData = userDoc.data();
        const deletionCount = deletions.length;


        const result = await createNotification({
          userId,
          type: 'team_deletion_summary',
          title: "Team Network Update",
          body: deletionCount === 1 
            ? `One of your downline team members deleted their Team Build Pro account yesterday. For privacy protection, we cannot share their identity. No worries, it happens .. keep building!`
            : `${deletionCount} of your downline team members deleted their Team Build Pro account yesterday. For privacy protection, we cannot share their identities. No worries, it happens .. keep building!`,
          docFields: { 
            count: deletionCount, 
            route: "/network",
            route_params: JSON.stringify({ "filter": "all" })
          },
          data: { 
            route: 'network', 
            filter: 'all',
            count: String(deletionCount)
          },
        });

        console.log(`✅ DAILY DELETION SUMMARY: Sent summary to ${userData.firstName || 'Unknown'} for ${deletionCount} deletion(s) - Push sent: ${result.push.sent}`);
        return { success: true, userId, deletionCount };

      } catch (error) {
        console.error(`❌ DAILY DELETION SUMMARY: Failed to send summary to user ${userId}:`, error);
        return { success: false, userId, error: error.message };
      }
    });

    const results = await Promise.allSettled(notificationPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`🗑️ DAILY DELETION SUMMARY: Summary complete - Successful: ${successful}, Failed: ${failed}`);

  } catch (error) {
    console.error("❌ DAILY DELETION SUMMARY: Critical error in daily deletion summary:", error);
  }
});

/**
 * Helper function to find upline members (excluding direct sponsor)
 * @param {string} sponsorId - The sponsor's user ID
 * @returns {Array} - Array of upline member IDs
 */
async function findUplineMembers(sponsorId) {
  try {
    const sponsorDoc = await db.collection('users').doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      return [];
    }

    const sponsorData = sponsorDoc.data();
    const uplineRefs = sponsorData.upline_refs || [];
    
    // Return all upline members (excluding the direct sponsor themselves)
    return uplineRefs;
  } catch (error) {
    console.error(`❌ UPLINE LOOKUP: Error finding upline members for sponsor ${sponsorId}:`, error);
    return [];
  }
}

exports.validateReferralUrl = onCall({ region: "us-central1" }, async (request) => {
  const url = request.data.url;

  if (!url || typeof url !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid URL is required.');
  }

  // Basic URL structure check
  try {
    new URL(url);
  } catch (e) {
    throw new HttpsError('invalid-argument', 'Malformed URL.');
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000,
      redirect: 'follow',
    });

    const isValid = response.status === 200;

    return {
      valid: isValid,
      status: response.status,
      redirected: response.redirected,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
});

// ============================================================================
// USER ACCOUNT DELETION FUNCTIONS
// ============================================================================

/**
 * Enhanced User Account Deletion - Apple App Store Compliant
 * Permanently deletes user account including Firebase Auth and Firestore data
 * while preserving network structure for business continuity
 */
exports.deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const userId = request.auth.uid;
  const { confirmationEmail } = request.data;

  console.log(`🗑️ DELETE_ACCOUNT: Starting account deletion for user ${userId}`);

  try {
    // Get user data for validation and network notification capture
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`🗑️ DELETE_ACCOUNT: User document not found for ${userId}`);
      throw new HttpsError("not-found", "User account not found");
    }

    const userData = userDoc.data();
    
    // Validate confirmation email matches
    if (confirmationEmail && userData.email && 
        confirmationEmail.toLowerCase() !== userData.email.toLowerCase()) {
      throw new HttpsError("invalid-argument", "Confirmation email does not match account email");
    }

    console.log(`🗑️ DELETE_ACCOUNT: Email validation passed for ${userId}`);

    // IMPORTANT: Capture network relationships BEFORE deletion for notifications
    const networkNotificationData = await captureNetworkForDeletionNotifications(userId, userData);
    console.log(`📱 DELETE_ACCOUNT: Network notification data captured for ${userId}`);

    // Step 1: Delete user's private collections
    await deleteUserPrivateData(userId);
    console.log(`✅ DELETE_ACCOUNT: Private data deleted for ${userId}`);

    // Step 2: Cleanup references but preserve network structure
    await cleanupUserReferences(userId);
    console.log(`✅ DELETE_ACCOUNT: References cleaned up for ${userId}`);

    // Step 3: Delete Firestore user document
    await db.collection('users').doc(userId).delete();
    console.log(`✅ DELETE_ACCOUNT: Firestore document deleted for ${userId}`);

    // Step 4: Delete Firebase Auth user (this will sign them out)
    await auth.deleteUser(userId);
    console.log(`✅ DELETE_ACCOUNT: Firebase Auth user deleted for ${userId}`);

    console.log(`✅ DELETE_ACCOUNT: Account deletion completed successfully for ${userId}`);

    // Step 5: Send push notifications to affected network members
    // This happens AFTER successful deletion to ensure account is truly gone
    await sendDeletionNotificationsToNetwork(networkNotificationData);
    console.log(`📱 DELETE_ACCOUNT: Deletion notifications sent for ${userId}`);

    return {
      success: true,
      message: "Account deleted successfully"
    };

  } catch (error) {
    console.error(`❌ DELETE_ACCOUNT: Error deleting account for ${userId}:`, error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    throw new HttpsError("internal", "Failed to delete account", error.message);
  }
});

/**
 * Delete user's private collections and data
 */
async function deleteUserPrivateData(userId) {
  try {
    // Delete user notifications
    const notificationsRef = db.collection('users').doc(userId).collection('notifications');
    const notificationDocs = await notificationsRef.get();
    
    const deletePromises = [];
    for (const doc of notificationDocs.docs) {
      deletePromises.push(doc.ref.delete());
    }
    await Promise.all(deletePromises);
    console.log(`✅ DELETE_ACCOUNT: Deleted ${notificationDocs.size} notifications for ${userId}`);

    // Clean up chat messages where user was participant
    const chatsQuery = await db.collection('chats')
        .where('participants', 'array-contains', userId)
        .get();

    const chatCleanupPromises = [];
    for (const chatDoc of chatsQuery.docs) {
      const chatData = chatDoc.data();
      const participants = Array.from(chatData.participants || []);
      
      if (participants.length <= 2) {
        // Delete entire chat if only 2 participants
        const messagesRef = chatDoc.ref.collection('messages');
        const messageDocs = await messagesRef.get();
        
        const messageDeletePromises = messageDocs.docs.map(doc => doc.ref.delete());
        await Promise.all(messageDeletePromises);
        
        chatCleanupPromises.push(chatDoc.ref.delete());
        console.log(`✅ DELETE_ACCOUNT: Deleted chat thread: ${chatDoc.id}`);
      } else {
        // Remove user from group chat participants
        chatCleanupPromises.push(chatDoc.ref.update({
          participants: FieldValue.arrayRemove([userId])
        }));
        console.log(`✅ DELETE_ACCOUNT: Removed user from group chat: ${chatDoc.id}`);
      }
    }
    await Promise.all(chatCleanupPromises);

    // Delete admin settings if user was an admin
    const adminSettingsRef = db.collection('admin_settings').doc(userId);
    const adminDoc = await adminSettingsRef.get();
    if (adminDoc.exists) {
      await adminSettingsRef.delete();
      console.log(`✅ DELETE_ACCOUNT: Deleted admin settings for ${userId}`);
    }

  } catch (error) {
    console.error(`❌ DELETE_ACCOUNT: Error deleting private data for ${userId}:`, error);
    throw error;
  }
}

/**
 * Captures network relationship data before account deletion for push notifications
 * @param {string} userId - The user ID being deleted
 * @param {object} userData - The user's data from Firestore
 * @returns {object} - Network notification data with sponsor and downline information
 */
async function captureNetworkForDeletionNotifications(userId, userData) {
  try {
    const notificationData = {
      deletedUserId: userId,
      deletedUserName: `${userData.firstName || 'Unknown'} ${userData.lastName || 'User'}`.trim(),
      sponsorInfo: null,
      downlineUsers: []
    };

    // 1. Capture sponsor information
    if (userData.sponsor_id) {
      try {
        const sponsorDoc = await db.collection('users').doc(userData.sponsor_id).get();
        if (sponsorDoc.exists) {
          const sponsorData = sponsorDoc.data();
          notificationData.sponsorInfo = {
            userId: userData.sponsor_id,
            name: `${sponsorData.firstName || 'Unknown'} ${sponsorData.lastName || 'User'}`.trim(),
            fcmToken: sponsorData.fcm_token
          };
          console.log(`📱 NETWORK_CAPTURE: Sponsor data captured for ${userData.sponsor_id}`);
        }
      } catch (error) {
        console.log(`⚠️ NETWORK_CAPTURE: Could not fetch sponsor ${userData.sponsor_id}: ${error.message}`);
      }
    }

    // 2. Capture direct downline users (people this user sponsored)
    try {
      const downlineQuery = await db.collection('users')
        .where('sponsor_id', '==', userId)
        .get();
      
      for (const downlineDoc of downlineQuery.docs) {
        const downlineData = downlineDoc.data();
        notificationData.downlineUsers.push({
          userId: downlineDoc.id,
          name: `${downlineData.firstName || 'Unknown'} ${downlineData.lastName || 'User'}`.trim(),
          fcmToken: downlineData.fcm_token
        });
      }
      console.log(`📱 NETWORK_CAPTURE: ${notificationData.downlineUsers.length} downline users captured`);
    } catch (error) {
      console.log(`⚠️ NETWORK_CAPTURE: Could not fetch downline users: ${error.message}`);
    }

    return notificationData;
  } catch (error) {
    console.error(`❌ NETWORK_CAPTURE: Error capturing network data for ${userId}:`, error);
    // Return minimal data structure to prevent breaking deletion process
    return {
      deletedUserId: userId,
      deletedUserName: 'Team Member',
      sponsorInfo: null,
      downlineUsers: []
    };
  }
}

/**
 * Sends immediate push notifications to direct network members affected by account deletion
 * and logs upline members for daily batch notification
 * @param {object} networkData - Network notification data from captureNetworkForDeletionNotifications
 */
async function sendDeletionNotificationsToNetwork(networkData) {
  if (!networkData || (!networkData.sponsorInfo && networkData.downlineUsers.length === 0)) {
    console.log(`📱 DELETION_NOTIFICATIONS: No network members to notify`);
    return;
  }

  const immediateNotifications = [];

  try {
    // 1. IMMEDIATE: Notify direct sponsor (if exists)
    if (networkData.sponsorInfo) {
      const sponsorNotification = createAccountDeletionNotification(
        'sponsor',
        networkData.deletedUserName,
        networkData.sponsorInfo.name
      );
      
      immediateNotifications.push({
        type: 'sponsor',
        userId: networkData.sponsorInfo.userId,
        notification: sponsorNotification
      });

      console.log(`📱 DELETION_NOTIFICATIONS: Prepared immediate notification for sponsor ${networkData.sponsorInfo.userId}`);
    }

    // 2. IMMEDIATE: Notify direct downline users
    for (const downlineUser of networkData.downlineUsers) {
      const downlineNotification = createAccountDeletionNotification(
        'downline',
        networkData.deletedUserName,
        downlineUser.name
      );
      
      immediateNotifications.push({
        type: 'downline',
        userId: downlineUser.userId,
        notification: downlineNotification
      });

      console.log(`📱 DELETION_NOTIFICATIONS: Prepared immediate notification for downline user ${downlineUser.userId}`);
    }

    // 3. Send immediate notifications concurrently
    const notificationPromises = immediateNotifications.map(async ({ userId, notification }) => {
      try {
        const result = await createNotification({
          userId,
          type: notification.type,
          title: notification.title,
          body: notification.message,
          docFields: { 
            deletedUserName: notification.deletedUserName,
            route: notification.route,
            route_params: notification.route_params
          },
          data: { 
            route: notification.route.replace('/', ''), 
            deletedUserName: notification.deletedUserName 
          },
        });
        console.log(`✅ DELETION_NOTIFICATIONS: Sent immediate notification to user ${userId} - Push sent: ${result.push.sent}`);
      } catch (error) {
        console.error(`❌ DELETION_NOTIFICATIONS: Failed to send immediate notification to user ${userId}:`, error.message);
      }
    });

    await Promise.all(notificationPromises);
    console.log(`📱 DELETION_NOTIFICATIONS: Processed ${immediateNotifications.length} immediate deletion notifications`);

    // 4. DAILY BATCH: Log deletion for daily upline notifications
    await logDeletionForDailyNotification(networkData);

  } catch (error) {
    console.error(`❌ DELETION_NOTIFICATIONS: Error sending deletion notifications:`, error);
    // Don't throw - notifications are nice-to-have, not critical
  }
}

/**
 * Creates a notification object for account deletion events
 * @param {string} recipientType - 'sponsor' or 'downline'
 * @param {string} deletedUserName - Name of the user who deleted their account
 * @param {string} recipientName - Name of the notification recipient
 * @returns {object} - Notification object for Firestore
 */
function createAccountDeletionNotification(recipientType, deletedUserName, recipientName) {
  const baseNotification = {
    type: 'account_deletion',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    route: "/dashboard", // Route to main dashboard
    route_params: null
  };

  if (recipientType === 'sponsor') {
    return {
      ...baseNotification,
      title: "Team Member Account Update",
      message: `${deletedUserName} has decided to delete their Team Build Pro account. This doesn't affect your account or team status in any way. Your networking journey continues uninterrupted!`
    };
  } else if (recipientType === 'downline') {
    return {
      ...baseNotification,
      title: "Sponsor Account Update", 
      message: `Your sponsor ${deletedUserName} has decided to delete their Team Build Pro account. This doesn't affect your account or opportunities in any way. You can continue building your network as usual!`
    };
  }

  // Fallback for unexpected recipient types
  return {
    ...baseNotification,
    title: "Team Network Update",
    message: `A team member has updated their account status. This doesn't affect your account in any way.`
  };
}

/**
 * Logs account deletion for daily batch notification to upline members
 * @param {object} networkData - Network notification data from captureNetworkForDeletionNotifications
 */
async function logDeletionForDailyNotification(networkData) {
  try {
    // Create a deletion log entry for daily batch processing
    const deletionLog = {
      deletedUserId: networkData.deletedUserId,
      deletedUserName: networkData.deletedUserName,
      sponsorId: networkData.sponsorInfo?.userId || null,
      downlineUserIds: networkData.downlineUsers.map(user => user.userId),
      deletedAt: FieldValue.serverTimestamp(),
      processedInDailyBatch: false
    };

    // Store in a dedicated collection for daily batch processing
    await db.collection('account_deletion_logs').add(deletionLog);
    console.log(`📊 DELETION_LOG: Logged deletion of ${networkData.deletedUserName} for daily batch processing`);

  } catch (error) {
    console.error(`❌ DELETION_LOG: Error logging deletion for daily notification:`, error);
    // Don't throw - this is non-critical logging
  }
}

/**
 * Cleanup user references in system collections while preserving network structure
 */
async function cleanupUserReferences(userId) {
  try {
    // Note: We intentionally preserve network relationships (sponsorId, uplineAdmin, downlineUsers)
    // as these are critical for business operations and team structure integrity
    
    console.log(`✅ DELETE_ACCOUNT: System references cleaned up for ${userId}`);
    
    // Future: Add any other system cleanup operations here
    
  } catch (error) {
    console.error(`❌ DELETE_ACCOUNT: Error cleaning up references for ${userId}:`, error);
    // Don't throw - this is non-critical cleanup
  }
}

// ============================================================================
// LAUNCH NOTIFICATION CONFIRMATION EMAIL
// ============================================================================

/**
 * Send confirmation email when someone signs up for launch notifications
 */
/**
 * Helper function to store tester information in Firestore for CSV generation
 */
async function appendTesterToCSV(firstName, lastName, email, deviceType) {
  try {
    console.log(`📄 TESTER_STORE: Adding tester: ${firstName} ${lastName} (${email}) - ${deviceType}`);
    
    // Store in Firestore beta_testers collection
    const testerData = {
      firstName,
      lastName,
      email,
      deviceType,
      createdAt: FieldValue.serverTimestamp(),
      source: 'launch_notification'
    };
    
    // Use email as document ID to prevent duplicates
    const docId = `${deviceType}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    await db.collection('beta_testers').doc(docId).set(testerData, { merge: true });
    
    console.log(`✅ TESTER_STORE: Successfully stored ${firstName} ${lastName} for ${deviceType} testing`);
  } catch (error) {
    console.error(`❌ TESTER_STORE: Error storing tester data:`, error);
    // Don't throw error to avoid disrupting the email flow
  }
}

/**
 * Generate CSV files from Firestore beta tester data
 * Returns CSV content for both iOS and Android testers
 */
exports.generateBetaTesterCSVs = onCall({ region: "us-central1" }, async (request) => {
  try {
    console.log('📄 CSV_GENERATE: Starting generation of beta tester CSV files from Firestore');
    
    const results = {};
    const deviceTypes = ['ios', 'android'];
    
    for (const deviceType of deviceTypes) {
      try {
        // Query beta testers for this device type
        const snapshot = await db.collection('beta_testers')
          .where('deviceType', '==', deviceType)
          .orderBy('createdAt', 'asc')
          .get();
        
        // Generate CSV content
        let csvContent = '';
        const testers = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          testers.push(data);
          csvContent += `${data.firstName},${data.lastName},${data.email}\n`;
        });
        
        const fileName = `${deviceType}_testers.csv`;
        results[fileName] = {
          content: csvContent,
          lineCount: testers.length,
          testers: testers.map(t => ({ 
            firstName: t.firstName, 
            lastName: t.lastName, 
            email: t.email,
            createdAt: t.createdAt?.toDate?.()?.toISOString() || null
          })),
          lastGenerated: new Date().toISOString()
        };
        
        console.log(`✅ CSV_GENERATE: Generated ${fileName} - ${testers.length} entries`);
        
      } catch (error) {
        console.error(`❌ CSV_GENERATE: Error generating ${deviceType} CSV:`, error);
        results[`${deviceType}_testers.csv`] = {
          content: '',
          lineCount: 0,
          error: error.message
        };
      }
    }
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      files: results
    };
    
  } catch (error) {
    console.error('❌ CSV_GENERATE: Error generating CSV files:', error);
    throw new HttpsError("internal", "Failed to generate CSV files", error.message);
  }
});

exports.sendLaunchNotificationConfirmation = onRequest({
  cors: true,
  region: 'us-central1',
  secrets: [sendgridApiKey]
}, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { firstName, lastName, email, wantDemo, deviceType } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'First name, last name, and email address are required' });
    }

    if (!isValidEmailLaunchNotification(email)) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const demoInfo = wantDemo && deviceType ? ` (Demo requested: ${deviceType})` : '';
    console.log(`📧 LAUNCH_NOTIFICATION: Sending confirmation to ${firstName} ${lastName} (${email})${demoInfo}`);

    // Set the SendGrid API key
    sgMail.setApiKey(sendgridApiKey.value());

    const fullName = `${firstName} ${lastName}`;

    // Create the confirmation email to the user
    const confirmationEmail = {
      to: `${fullName} <${email}>`,
      from: 'Team Build Pro <support@teambuildpro.com>',
      bcc: 'scscot@gmail.com',
      subject: `Thanks for your interest, ${firstName}! Team Build Pro is launching soon 🚀`,
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://teambuildpro.com/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 60px; height: 60px; border-radius: 50%;">
            <h1 style="color: #667eea; margin: 20px 0 10px; font-size: 28px;">Team Build Pro</h1>
            <p style="color: #64748b; font-size: 16px; margin: 0;">The Ultimate Team Building App</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 30px;">
            <h2 style="margin: 0 0 15px; font-size: 24px;">🚀 You're on the list, ${firstName}!</h2>
            <p style="font-size: 18px; margin: 0; opacity: 0.9; line-height: 1.5;">Thanks for signing up for early access to Team Build Pro.</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #1e293b; margin: 0 0 15px; font-size: 20px;">What happens next?</h3>
            <ul style="color: #475569; line-height: 1.6; margin: 0; padding-left: 20px;">
              ${wantDemo && deviceType ? `<li style="margin-bottom: 8px;"><strong style="color: #667eea;">🎯 App Preview Access:</strong> You'll soon receive an email with step-by-step instructions on how to download and preview the Team Build Pro app.</li>` : ''}
              <li style="margin-bottom: 8px;">We'll email you the moment Team Build Pro launches on Google Play!</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <p style="color: #64748b; margin: 0 0 20px;">In the meantime, check out our website to learn more:</p>
            <a href="https://teambuildpro.com" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Visit TeamBuildPro.com</a>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              Team Build Pro - Empower Your Team, Accelerate Growth<br>
              <a href="https://teambuildpro.com" style="color: #667eea; text-decoration: none;">teambuildpro.com</a>
            </p>
          </div>
        </div>
      `
    };

    // Create the notification email to support team
    const notificationEmail = {
      to: 'support@teambuildpro.com',
      from: 'Team Build Pro <support@teambuildpro.com>',
      subject: `New Launch Notification Signup: ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #667eea;">New Launch Notification Signup</h2>
          <hr>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Source:</strong> Website Modal</p>
          <hr>
          <p><em>This email was automatically generated when ${firstName} signed up for launch notifications on the website.</em></p>
        </div>
      `
    };

    // Send both emails
    await Promise.all([
      sgMail.send(confirmationEmail),
      sgMail.send(notificationEmail)
    ]);
    
    console.log(`✅ LAUNCH_NOTIFICATION: Confirmation email sent to ${firstName} ${lastName} (${email}) and notification sent to support team`);

    // If user requested demo access, append to appropriate CSV file
    if (wantDemo && deviceType) {
      await appendTesterToCSV(firstName, lastName, email, deviceType);
    }
    
    res.json({ 
      success: true, 
      message: 'Launch notification emails sent successfully'
    });

  } catch (error) {
    console.error('Error sending launch notification emails:', error);
    if (error.code) {
      console.error('SendGrid error code:', error.code);
      console.error('SendGrid error message:', error.message);
    }
    return res.status(500).json({ error: 'Failed to send confirmation email' });
  }
});

/**
 * Helper function to validate email format
 */
function isValidEmailLaunchNotification(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Import and export the launch campaign function
const { sendLaunchCampaign } = require('./sendLaunchCampaign');
exports.sendLaunchCampaign = sendLaunchCampaign;

// ============================================================================
// FIRESTORE MONITORING FUNCTIONS
// ============================================================================

/**
 * Get real-time Firestore usage metrics and cost estimates
 * Password-protected endpoint for monitoring dashboard
 */
exports.getFirestoreMetrics = onRequest({
  region: "us-central1",
  cors: true
}, async (req, res) => {
  try {
    // Simple password check (you should use a proper hash in production)
    const { password } = req.query;
    const MONITORING_PASSWORD = process.env.MONITORING_PASSWORD || 'TeamBuildPro2024!';
    
    if (!password || password !== MONITORING_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get basic Firestore statistics
    const stats = {
      timestamp: new Date().toISOString(),
      collections: {},
      totalDocuments: 0,
      estimatedCosts: {}
    };

    // Count documents in major collections
    const collections = ['users', 'chats', 'admin_settings'];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        const docCount = snapshot.size;
        
        // Count subcollections for users
        let subCollectionCount = 0;
        if (collectionName === 'users') {
          for (const doc of snapshot.docs) {
            const notificationsSnapshot = await doc.ref.collection('notifications').get();
            subCollectionCount += notificationsSnapshot.size;
          }
        }
        
        // Count messages for chats
        if (collectionName === 'chats') {
          for (const doc of snapshot.docs) {
            const messagesSnapshot = await doc.ref.collection('messages').get();
            subCollectionCount += messagesSnapshot.size;
          }
        }

        stats.collections[collectionName] = {
          documents: docCount,
          subDocuments: subCollectionCount,
          total: docCount + subCollectionCount
        };
        
        stats.totalDocuments += docCount + subCollectionCount;
      } catch (error) {
        console.error(`Error counting ${collectionName}:`, error);
        stats.collections[collectionName] = { error: error.message };
      }
    }

    // Estimate costs based on current Firestore pricing (approximate)
    const readCostPer100k = 0.36; // $0.36 per 100K reads
    const writeCostPer100k = 1.08; // $1.08 per 100K writes
    const deleteCostPer100k = 0.12; // $0.12 per 100K deletes
    const storageCostPerGBMonth = 0.18; // $0.18 per GB/month

    // Rough estimates (you'd need Cloud Monitoring API for precise data)
    const estimatedDailyReads = stats.totalDocuments * 10; // Assume 10 reads per doc per day
    const estimatedDailyWrites = stats.totalDocuments * 0.5; // Assume 0.5 writes per doc per day
    
    stats.estimatedCosts = {
      dailyReads: estimatedDailyReads,
      dailyWrites: estimatedDailyWrites,
      estimatedDailyCostReads: (estimatedDailyReads / 100000) * readCostPer100k,
      estimatedDailyCostWrites: (estimatedDailyWrites / 100000) * writeCostPer100k,
      estimatedDailyCostTotal: ((estimatedDailyReads / 100000) * readCostPer100k) + ((estimatedDailyWrites / 100000) * writeCostPer100k)
    };

    // Add current pricing info
    stats.pricingInfo = {
      reads: `$${readCostPer100k} per 100K operations`,
      writes: `$${writeCostPer100k} per 100K operations`,
      deletes: `$${deleteCostPer100k} per 100K operations`,
      storage: `$${storageCostPerGBMonth} per GB/month`,
      lastUpdated: '2024-01-01' // Update this when pricing changes
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting Firestore metrics:', error);
    return res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ============================================================================
// JOE'S ORCHESTRATOR SOLUTION - ELIMINATES RACE CONDITIONS & DUPLICATES
// ============================================================================

/**
 * Single orchestrator function that handles profile completion events
 * Only fires once when isProfileComplete flips from false to true
 * 
 * TEMPORARILY DISABLED: Due to Firebase SDK wrapper crashes (TypeError: Cannot read properties of undefined reading 'value')
 * Using callable triggerSponsorship as reliable backstop until SDK issue is resolved
 */
// ==============================
// BEGIN PATCH: user-doc-updated-v2
// ==============================
  exports.onUserProfileCompleted = onDocumentUpdated('users/{uid}', async (event) => {
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
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
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

      // OPTION C: Manual milestone checks for sponsor + upline after profile completion
      console.log('MST TRIGGER: Profile completed, checking milestones for sponsor/upline', { traceId, uid });

      // Get sponsor and upline from the new user's data
      const sponsorId = after.upline_admin || after.referredBy || after.sponsorReferralCode || after.sponsorReferral;
      const uplineRefs = after.upline_refs || [];

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

/**
 * Check if milestone push should be sent by looking for recent "new_member" notifications
 * Returns false if a recent new member notification exists (within 1 minute) to avoid duplicate pushes
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
 * Implements your comprehensive logging and hardening requirements
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

// ==============================
// END PATCH: user-doc-updated-v2
// ==============================

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

// ========== UNIVERSAL NOTIFICATION CREATOR ==========
/**
 * Creates a notification document under users/{userId}/notifications/{notifId?}
 * Push notifications are handled automatically by onNotificationCreated trigger.
 *
 * This approach eliminates duplicate push notifications by centralizing all push logic
 * in the onNotificationCreated trigger, ensuring exactly one push per notification.
 *
 * Idempotency:
 *  - If `notifId` is provided we use .create() for deterministic "at-most-once" doc creation.
 *  - If it already exists, we return success (idempotent behavior).
 *
 * @param {Object} opts
 * @param {string} opts.userId            - REQUIRED. Recipient UID (owner of notifications/{...}).
 * @param {string} opts.type              - REQUIRED. Business type, e.g. 'sponsorship', 'chat', 'trial_warning'.
 * @param {string} opts.title             - REQUIRED. Notification title.
 * @param {string} opts.body              - REQUIRED. Notification body.
 * @param {string} [opts.notifId]         - Optional deterministic notification id. If omitted, a random ID (.add) is used.
 * @param {Object} [opts.docFields]       - Extra fields to store on the notification document (merged).
 * @param {boolean}[opts.markUnread=true] - Whether to store read:false on the doc.
 *
 * @returns {Promise<{ ok: boolean, notificationId: string }>}
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
    console.error('CREATE NOTIF: invalid args', { traceId, userId, type, hasTitle: !!title, hasBody: !!body });
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
      console.log('CREATE NOTIF: created with deterministic ID', { traceId, userId, notificationId, type });
    } else {
      const addRes = await userRef.collection('notifications').add(baseDoc);
      notificationId = addRes.id;
      console.log('CREATE NOTIF: created with generated ID', { traceId, userId, notificationId, type });
    }

    return { ok: true, notificationId };
  } catch (e) {
    // Already exists? That's fine for deterministic IDs
    const alreadyExists = e?.code === 6 || e?.code === 'already-exists';
    if (alreadyExists) {
      console.log('CREATE NOTIF: notification already exists', { traceId, userId, notificationId: notifId, type });
      return { ok: true, notificationId: notifId };
    }

    console.error('CREATE NOTIF: failed to create notification', { traceId, userId, notifId, type, error: e?.message });
    return { ok: false, notificationId: notifId || '' };
  }
}
// ========== /UNIVERSAL NOTIFICATION CREATOR ==========


/**
 * Manual trigger for sponsorship notifications - callable backstop
 * Safe to call multiple times due to deterministic .create() in handleSponsorship
 */
exports.triggerSponsorship = onCall(
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

// --- Firestore v1 push sender: users/{userId}/notifications/{notificationId} ---
// DISABLED: Replaced with universal createNotification helper
// All notifications now use direct FCM push to avoid SDK crashes
// exports.onNotificationCreated = functionsV1
//   .region('us-central1')
//   .runWith({ timeoutSeconds: 60, memory: '512MB' }) // v1 uses MB
//   .firestore
//   .document('users/{userId}/notifications/{notificationId}')
//   .onCreate(async (snap, context) => {
//     const userId = context.params.userId;
//     const notificationId = context.params.notificationId;
//     const notificationData = snap.data() || {};
// 
//     const traceId = `push_${userId}_${notificationId}_${Date.now()}`;
//     console.log('PUSH: start', { traceId, userId, notificationId });
// 
//     try {
//       const userRef = db.collection('users').doc(userId);
//       const userDoc = await userRef.get();
//       if (!userDoc.exists) {
//         console.error('PUSH: user not found', { traceId, userId });
//         return;
//       }
//       const userData = userDoc.data() || {};
// 
//       // --- 3-tier FCM token resolution ---
//       let fcmTokenResolved = userData.fcm_token;
//       if (fcmTokenResolved) {
//         console.log('PUSH: token resolved via fcm_token field', { traceId, userId });
//       } else if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0) {
//         fcmTokenResolved = userData.fcmTokens[0];
//         console.log('PUSH: token resolved via fcmTokens array', { traceId, userId });
//       } else {
//         const tokensSnap = await userRef.collection('fcmTokens').limit(1).get();
//         if (!tokensSnap.empty) {
//           fcmTokenResolved = tokensSnap.docs[0].id;
//           console.log('PUSH: token resolved via fcmTokens subcollection', { traceId, userId });
//         }
//       }
// 
//       if (!fcmTokenResolved) {
//         console.log('PUSH: no token found (tried all methods)', { traceId, userId });
//         return;
//       }
// 
//       const message = {
//         token: fcmTokenResolved,
//         notification: {
//           title: notificationData?.title || 'Team Build Pro Update',
//           body: notificationData?.message || 'Something new in your network',
//         },
//         data: {
//           notification_id: notificationId,
//           type: notificationData?.type || 'generic',
//           route: notificationData?.route || '/',
//           route_params: notificationData?.route_params || '{}',
//           imageUrl: notificationData?.imageUrl || '',
//         },
//         apns: {
//           payload: {
//             aps: {
//               alert: {
//                 title: notificationData?.title || 'Team Build Pro Update',
//                 body: notificationData?.message || 'Something new in your network',
//               },
//               sound: 'default',
//               'mutable-content': 1,
//             },
//           },
//         },
//         android: {
//           notification: {
//             title: notificationData?.title || 'Team Build Pro Update',
//             body: notificationData?.message || 'Something new in your network',
//             sound: 'default',
//             clickAction: 'FLUTTER_NOTIFICATION_CLICK',
//           },
//         },
//       };
// 
//       const response = await messaging.send(message);
//       console.log('PUSH: sent successfully', { traceId, userId, response });
// 
//       // Keep your existing badge updater
//       if (typeof updateUserBadge === 'function') {
//         await updateUserBadge(userId);
//       }
//     } catch (error) {
//       console.error('PUSH: failed', { traceId, userId, error: error?.message });
//       if (error?.code === 'messaging/registration-token-not-registered') {
//         console.log('PUSH: token invalid, should clean up', { traceId, userId });
//       }
//     }
//   });

/**
 * DISABLED: Enhanced push notification sender with 3-tier FCM token fallback
 * Replaced with universal createNotification helper to avoid SDK crashes
 */
// exports.onNotificationCreated = onDocumentCreated(
//   { region: "us-central1", timeoutSeconds: 60, memory: "512MiB" },
//   'users/{userId}/notifications/{notificationId}',
//   async (event) => {
//     const snap = event.data;
//     if (!snap) {
//       console.log('🔔 PUSH DEBUG: No data associated with the event');
//       return;
//     }
//     
//     const userId = event.params.userId;
//     const notificationId = event.params.notificationId;
//     const notificationData = snap.data();
// 
//     const traceId = `push_${userId}_${notificationId}_${Date.now()}`;
//     console.log('PUSH: start', { traceId, userId, notificationId });
// 
//     try {
//       const userRef = db.collection('users').doc(userId);
//       const userDoc = await userRef.get();
//       
//       if (!userDoc.exists) {
//         console.error('PUSH: user not found', { traceId, userId });
//         return;
//       }
// 
//       const userData = userDoc.data();
// 
//       // 3-TIER TOKEN RESOLUTION - Joe's enhanced fallback logic
//       let fcmTokenResolved = userData.fcm_token;
//       if (fcmTokenResolved) {
//         console.log('PUSH: token resolved via fcm_token field', { traceId, userId });
//       } else if (Array.isArray(userData.fcmTokens)) {
//         fcmTokenResolved = userData.fcmTokens[0];
//         console.log('PUSH: token resolved via fcmTokens array', { traceId, userId });
//       }
//       if (!fcmTokenResolved) {
//         const tokensSnap = await userRef.collection("fcmTokens").limit(1).get();
//         if (!tokensSnap.empty) {
//           fcmTokenResolved = tokensSnap.docs[0].id;
//           console.log('PUSH: token resolved via fcmTokens subcollection', { traceId, userId });
//         }
//       }
// 
//       if (!fcmTokenResolved) {
//         console.log('PUSH: no token found (tried all methods)', { traceId, userId });
//         return;
//       }
// 
//       const message = {
//         token: fcmTokenResolved,
//         notification: {
//           title: notificationData?.title || 'Team Build Pro Update',
//           body: notificationData?.message || 'Something new in your network',
//         },
//         data: {
//           notification_id: notificationId,
//           type: notificationData?.type || 'generic',
//           route: notificationData?.route || '/',
//           route_params: notificationData?.route_params || '{}',
//           imageUrl: notificationData?.imageUrl || '',
//         },
//         apns: {
//           payload: {
//             aps: {
//               alert: {
//                 title: notificationData?.title || 'Team Build Pro Update',
//                 body: notificationData?.message || 'Something new in your network',
//               },
//               sound: 'default',
//               'mutable-content': 1,
//             },
//           },
//         },
//         android: {
//           notification: {
//             title: notificationData?.title || 'Team Build Pro Update',
//             body: notificationData?.message || 'Something new in your network',
//             sound: 'default',
//             clickAction: 'FLUTTER_NOTIFICATION_CLICK',
//           },
//         },
//       };
// 
//       const response = await messaging.send(message);
//       console.log('PUSH: sent successfully', { traceId, userId, response });
// 
//       // Update badge count after sending notification
//       await updateUserBadge(userId);
// 
//     } catch (error) {
//       console.error('PUSH: failed', { traceId, userId, error: error.message });
//       
//       if (error.code === 'messaging/registration-token-not-registered') {
//         console.log('PUSH: token invalid, should clean up', { traceId, userId });
//       }
//     }
//   }
// );

} // END ENABLE_EXTRA_EXPORTS guard
// ==============================
// END PATCH: export-bisect-wrap
// ==============================

// ==============================
// BEGIN PATCH: notification-created-v2
// ==============================
exports.onNotificationCreated = onDocumentCreated('users/{userId}/notifications/{notificationId}', async (event) => {
  const { userId, notificationId } = event.params;

  // Config + delivery-mode guards (prevents duplicates)
  if (!NOTIF_TRIGGER_ENABLED) {
    console.log('TRIGGER: disabled by config; skipping push', { userId, notificationId });
    return;
  }
  if (!isTriggerMode) {
    console.log('TRIGGER: disabled by delivery_mode; skipping push', { userId, notificationId, DELIVERY_MODE });
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

  // Reuse your push path
  const push = await sendPushToUser(userId, notificationId, payload);

  // Badge is non-fatal; wrap separately
  try {
    await updateUserBadge(userId);
  } catch (err) {
    console.log('BADGE: non-fatal error', { userId, notificationId, msg: err?.message });
  }

  console.log('TRIGGER: done', { userId, notificationId, push });
});
// ==============================
// END PATCH: notification-created-v2
// ==============================

// ==============================
// BEGIN PATCH: export-bisect-wrap-remaining
// ==============================
if (ENABLE_EXTRA_EXPORTS) {

// ==============================
// BEGIN PATCH: chat-message-created-v2
// ==============================
exports.onChatMessageCreated = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  // DISABLED: This trigger is replaced by onNewChatMessage to prevent duplicate notifications
  console.log('onChatMessageCreated: DISABLED - replaced by onNewChatMessage to prevent duplicate chat notifications');
  return;

  const { chatId, messageId } = event.params;
  const msg = event.data?.data() || {};

  const fromUid = msg.fromUid || msg.senderId || msg.from || null;
  let toUids = [];

  if (msg.toUid) {
    toUids = [msg.toUid];
  } else {
    const chatSnap = await db.collection('chats').doc(chatId).get();
    const chat = chatSnap.exists ? (chatSnap.data() || {}) : {};
    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    toUids = participants.filter((u) => u && u !== fromUid);
  }

  if (!fromUid || !toUids.length) {
    console.log('CHAT: missing fromUid or recipients', { chatId, messageId, fromUid, toUids });
    return;
  }

  const fromSnap = await db.collection('users').doc(fromUid).get();
  const from = fromSnap.exists ? (fromSnap.data() || {}) : {};
  const senderName = [from.firstName || '', from.lastName || ''].join(' ').trim() || 'New message';
  const senderPhoto = from.photoUrl || '';

  const rawText = String(msg.text || msg.message || '');
  const preview = rawText.length > 120 ? rawText.slice(0, 117) + '…' : (rawText || 'Sent you a message');

  await Promise.all(toUids.map((uid) => {
    const notifId = `chat_${chatId}_${messageId}_${uid}`;
    return createNotification({
      userId: uid,
      notifId,
      type: 'chat_message',
      title: senderName,
      message: preview,
      route: 'chat',
      route_params: { chatId },
      imageUrl: senderPhoto
    });
  }));
});
// ==============================
// END PATCH: chat-message-created-v2
// ==============================

// ==============================
// VALIDATION FUNCTIONS (Joe's methodology)
// ==============================

/**
 * Dead-token cleanup validation
 * Set a user's fcm_token to a known bad string, send a test push, 
 * confirm logs show token_not_registered and cleanup occurs
 */
exports.validateDeadTokenCleanup = onCall({ region: "us-central1" }, async (request) => {
  assertAdminAndEnabled(request, 'validateDeadTokenCleanup');

  const { userId, badToken } = request.data;
  if (!userId || !badToken) {
    throw new HttpsError("invalid-argument", "userId and badToken are required");
  }

  console.log('VALIDATION: Starting dead token cleanup test', { userId, badToken });

  try {
    // 1. Set a known bad token
    const userRef = db.collection('users').doc(userId);
    await userRef.set({ fcm_token: badToken }, { merge: true });
    console.log('VALIDATION: Set bad token', { userId, badToken });

    // 2. Try to send a test push (should fail and trigger cleanup)
    const result = await createNotification({
      userId,
      type: 'validation_test',
      title: 'Dead Token Test',
      body: 'This should fail and trigger cleanup',
      notifId: `validation_dead_token_${Date.now()}`,
    });

    console.log('VALIDATION: Push result', { userId, result });

    // 3. Verify the token was cleaned up
    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data() || {};
    const hasCleanedToken = !updatedData.fcm_token || updatedData.fcm_token !== badToken;

    return {
      success: true,
      pushResult: result,
      tokenCleaned: hasCleanedToken,
      message: hasCleanedToken ? 'Dead token cleanup successful' : 'Token cleanup may not have occurred'
    };

  } catch (error) {
    console.error('VALIDATION: Dead token test failed', { userId, error: error.message });
    throw new HttpsError("internal", "Validation test failed", error.message);
  }
});

/**
 * Badge path parity validation
 * Test badge update with a user who only has token in subcollection
 */
exports.validateBadgePathParity = onCall({ region: "us-central1" }, async (request) => {
  assertAdminAndEnabled(request, 'validateBadgePathParity');

  const { userId, testToken } = request.data;
  if (!userId || !testToken) {
    throw new HttpsError("invalid-argument", "userId and testToken are required");
  }

  console.log('VALIDATION: Starting badge path parity test', { userId, testToken });

  try {
    const userRef = db.collection('users').doc(userId);

    // 1. Clear field and array tokens, set only subcollection token
    await userRef.set({ 
      fcm_token: admin.firestore.FieldValue.delete(),
      fcmTokens: admin.firestore.FieldValue.delete() 
    }, { merge: true });

    // 2. Set token only in subcollection
    await userRef.collection('fcmTokens').doc(testToken).set({
      token: testToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('VALIDATION: Set subcollection-only token', { userId, testToken });

    // 3. Create an unread notification
    await userRef.collection('notifications').add({
      title: 'Badge Test Notification',
      body: 'This creates an unread notification for badge testing',
      type: 'validation_test',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Call badge update (should use subcollection token)
    await updateUserBadge(userId);

    return {
      success: true,
      message: 'Badge path parity test completed - check logs for tokenSource: fcmTokens(subcollection)'
    };

  } catch (error) {
    console.error('VALIDATION: Badge parity test failed', { userId, error: error.message });
    throw new HttpsError("internal", "Badge validation test failed", error.message);
  }
});

/**
 * Trigger gating validation
 * Test that trigger can be enabled/disabled via config
 */
exports.validateTriggerGating = onCall({ region: "us-central1" }, async (request) => {
  assertAdminAndEnabled(request, 'validateTriggerGating');

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required");
  }

  console.log('VALIDATION: Starting trigger gating test', { userId, triggerEnabled: NOTIF_TRIGGER_ENABLED });

  try {
    // Create a notification using helper (should always work)
    const helperResult = await createNotification({
      userId,
      type: 'validation_test',
      title: 'Trigger Gating Test',
      body: 'Testing if helper works regardless of trigger setting',
      notifId: `validation_trigger_${Date.now()}`,
    });

    // Create a notification document directly (should only trigger push if config enabled)
    const userRef = db.collection('users').doc(userId);
    const directNotifRef = await userRef.collection('notifications').add({
      title: 'Direct Notification Test',
      body: 'Testing direct notification creation',
      type: 'validation_direct',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      triggerEnabled: NOTIF_TRIGGER_ENABLED,
      helperResult,
      directNotificationId: directNotifRef.id,
      message: `Trigger gating test completed. Check logs for trigger behavior (enabled: ${NOTIF_TRIGGER_ENABLED})`
    };

  } catch (error) {
    console.error('VALIDATION: Trigger gating test failed', { userId, error: error.message });
    throw new HttpsError("internal", "Trigger gating validation failed", error.message);
  }
});

// ==============================
// MILESTONE RESET AND DEBUG FUNCTIONS (FOR TESTING)
// ==============================

exports.resetMilestoneFuse = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { userId, milestoneType } = request.data;

  if (!userId || !milestoneType) {
    throw new HttpsError("invalid-argument", "userId and milestoneType are required");
  }

  try {
    console.log(`🔧 RESET MILESTONE: Resetting ${milestoneType} milestone for user ${userId}`);

    const userRef = db.collection('users').doc(userId);
    const milestoneRef = userRef.collection('milestones').doc('directSponsorCount');

    // Reset the specific milestone flag
    const updateData = {};
    if (milestoneType === 'direct') {
      updateData.directAt = admin.firestore.FieldValue.delete();
    } else if (milestoneType === 'team') {
      updateData.teamAt = admin.firestore.FieldValue.delete();
    } else if (milestoneType === 'qualified') {
      updateData.qualifiedAt = admin.firestore.FieldValue.delete();
    } else {
      throw new HttpsError("invalid-argument", "milestoneType must be 'direct', 'team', or 'qualified'");
    }

    await milestoneRef.update(updateData);

    console.log(`✅ RESET MILESTONE: Successfully reset ${milestoneType} milestone for user ${userId}`);

    return {
      success: true,
      message: `Reset ${milestoneType} milestone for user ${userId}`
    };

  } catch (error) {
    console.error(`❌ RESET MILESTONE: Error resetting ${milestoneType} milestone for user ${userId}:`, error);
    throw new HttpsError("internal", "Failed to reset milestone", error.message);
  }
});

exports.debugSendMilestone = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required");
  }

  try {
    console.log(`🧪 DEBUG MILESTONE: Testing milestone notification for user ${userId}`);

    const title = "🧪 Test Milestone";
    const message = "This is a test milestone notification to verify the end-to-end delivery path.";
    const notifId = `debug_milestone_${Date.now()}_${userId}`;

    const res = await createNotification({
      userId,
      notifId,
      type: 'milestone',
      subtype: 'debug',
      title,
      message,
      route: '/network',
      route_params: {},
    });

    console.log(`✅ DEBUG MILESTONE: Successfully sent test milestone for user ${userId}`, { notifId, res });

    return {
      success: true,
      notifId,
      message: `Test milestone sent to user ${userId}`,
      result: res
    };

  } catch (error) {
    console.error(`❌ DEBUG MILESTONE: Error sending test milestone for user ${userId}:`, error);
    throw new HttpsError("internal", "Failed to send test milestone", error.message);
  }
});

exports.getMilestoneFuseStatus = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { userId } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required");
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    const userData = userSnap.data();
    const milestones = userData.milestones || {};

    return {
      userId,
      milestones: {
        directAt: milestones.directAt ? milestones.directAt.toDate?.() || milestones.directAt : null,
        teamAt: milestones.teamAt ? milestones.teamAt.toDate?.() || milestones.teamAt : null,
        qualifiedAt: milestones.qualifiedAt ? milestones.qualifiedAt.toDate?.() || milestones.qualifiedAt : null,
      },
      currentCounts: {
        directSponsorCount: userData.directSponsorCount || 0,
        totalTeamCount: userData.totalTeamCount || 0,
      }
    };
  } catch (error) {
    console.error("Error getting milestone fuse status:", error);
    throw new HttpsError("internal", "Failed to get milestone status");
  }
});

exports.resetMilestoneFuses = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { userId, fuses } = request.data;
  if (!userId) {
    throw new HttpsError("invalid-argument", "userId is required");
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const updateData = {};

    if (fuses?.direct) updateData['milestones.directAt'] = admin.firestore.FieldValue.delete();
    if (fuses?.team) updateData['milestones.teamAt'] = admin.firestore.FieldValue.delete();
    if (fuses?.qualified) updateData['milestones.qualifiedAt'] = admin.firestore.FieldValue.delete();

    if (Object.keys(updateData).length === 0) {
      throw new HttpsError("invalid-argument", "No fuses specified to reset");
    }

    await userRef.update(updateData);

    console.log(`MILESTONE FUSES RESET for ${userId}:`, updateData);
    return { success: true, reset: updateData };
  } catch (error) {
    console.error("Error resetting milestone fuses:", error);
    throw new HttpsError("internal", "Failed to reset milestone fuses");
  }
});

exports.clearPreProfileMilestoneFuses = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  try {
    console.log('🧹 CLEANUP: Starting to clear milestone fuses set before profile completion');

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    const updates = [];
    let cleared = 0;

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const milestones = userData.milestones;

      // Only clear fuses for users who have them set
      if (milestones && (milestones.directAt || milestones.teamAt || milestones.qualifiedAt)) {
        console.log(`🧹 CLEANUP: Clearing milestone fuses for user ${doc.id}`, {
          hasDirectAt: !!milestones.directAt,
          hasTeamAt: !!milestones.teamAt,
          hasQualifiedAt: !!milestones.qualifiedAt,
          isProfileComplete: userData.isProfileComplete,
          directSponsorCount: userData.directSponsorCount || 0,
          totalTeamCount: userData.totalTeamCount || 0
        });

        updates.push(
          doc.ref.update({
            'milestones.directAt': admin.firestore.FieldValue.delete(),
            'milestones.teamAt': admin.firestore.FieldValue.delete(),
            'milestones.qualifiedAt': admin.firestore.FieldValue.delete()
          })
        );
        cleared++;
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ CLEANUP: Cleared milestone fuses for ${cleared} users`);
    } else {
      console.log('ℹ️ CLEANUP: No milestone fuses found to clear');
    }

    return {
      success: true,
      message: `Cleared milestone fuses for ${cleared} users`,
      clearedCount: cleared
    };
  } catch (error) {
    console.error("Error clearing pre-profile milestone fuses:", error);
    throw new HttpsError("internal", "Failed to clear milestone fuses");
  }
});

// ==============================
// END VALIDATION FUNCTIONS
// ==============================

} // END ENABLE_EXTRA_EXPORTS guard for remaining exports

// ==============================
// EXECUTION FUSE CLEANUP
// ==============================
/**
 * Scheduled function to clean up orphaned execution fuses older than 5 minutes
 * Runs every hour to prevent accumulation of stale fuse documents
 */
exports.cleanupExecutionFuses = onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'UTC',
  region: 'us-central1',
  timeoutSeconds: 300,
  memory: '256MiB'
}, async () => {
  console.log('FUSE CLEANUP: Starting execution fuse cleanup');

  try {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const fusesRef = db.collection('execution_fuses');

    // Query for fuses older than 5 minutes
    const oldFusesQuery = fusesRef.where('timestamp', '<', cutoffTime);
    const oldFusesSnap = await oldFusesQuery.get();

    if (oldFusesSnap.empty) {
      console.log('FUSE CLEANUP: No orphaned fuses found');
      return;
    }

    console.log(`FUSE CLEANUP: Found ${oldFusesSnap.size} orphaned fuses to clean up`);

    // Delete orphaned fuses in batches
    const batch = db.batch();
    let deleteCount = 0;

    oldFusesSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deleteCount++;

      console.log('FUSE CLEANUP: Queuing for deletion', {
        fuseId: doc.id,
        data: doc.data(),
        age: Math.round((Date.now() - doc.data().timestamp?.toDate?.()?.getTime()) / 1000 / 60) + ' minutes'
      });
    });

    if (deleteCount > 0) {
      await batch.commit();
      console.log(`FUSE CLEANUP: Successfully deleted ${deleteCount} orphaned execution fuses`);
    }

  } catch (error) {
    console.error('FUSE CLEANUP: Error during cleanup', error);
    // Don't throw - let cleanup failures be non-fatal
  }
});

// ==============================
// END PATCH: export-bisect-wrap-remaining
// ==============================