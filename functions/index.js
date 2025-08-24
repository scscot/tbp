const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getTimezoneFromLocation, getTimezonesAtHour } = require("./timezone_mapping");
const { submitContactForm } = require('./submitContactForm');
const { submitContactFormHttp } = require('./submitContactFormHttp');

// This makes the callable function available for your apps
exports.submitContactForm = submitContactForm;

// This makes the HTTPS function available for your contact_us.html page
exports.submitContactFormHttp = submitContactFormHttp;

// Initialize Firebase Admin SDK only if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();
const remoteConfig = admin.remoteConfig();
const { FieldValue, DocumentReference } = admin.firestore;
const fetch = global.fetch || require('node-fetch');
const cors = require('cors')({ origin: true });

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { X509Certificate } = require('crypto');

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
          message: "Your subscription has expired. Renew to continue accessing premium features.",
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
      const notification = {
        ...notificationContent,
        createdAt: FieldValue.serverTimestamp(),
        read: false
      };

      await db.collection('users').doc(userId).collection('notifications').add(notification);
      console.log(`✅ SUBSCRIPTION: Notification sent to user ${userId} for status: ${status}`);
    }

  } catch (error) {
    console.error(`❌ SUBSCRIPTION: Failed to send notification to user ${userId}:`, error);
    // Don't throw error - notification failure shouldn't break subscription update
  }
};

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

      case 'DID_CHANGE_RENEWAL_STATUS':
        console.log(`📱 APPLE NOTIFICATION: User ${userId} changed renewal status`);
        // Check if auto-renew is enabled/disabled
        const autoRenewStatus = latestReceiptInfo.auto_renew_status;
        if (autoRenewStatus === '0') {
          // Auto-renew disabled - mark as cancelled but still active until expiry
          await updateUserSubscription(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
          await createSubscriptionNotification(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
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
exports.handleAppleSubscriptionNotificationV2 = onRequest({
  region: "us-central1",
  cors: false // Disable CORS for server-to-server communication
}, async (req, res) => {
  console.log(`📱 APPLE V2 NOTIFICATION: Received notification`);

  try {
    // Verify this is a POST request
    if (req.method !== 'POST') {
      console.log(`📱 APPLE V2 NOTIFICATION: Invalid method: ${req.method}`);
      return res.status(405).send('Method Not Allowed');
    }

    // Extract the signed payload from request body
    const signedPayload = req.body?.signedPayload;

    if (!signedPayload) {
      console.log(`📱 APPLE V2 NOTIFICATION: No signedPayload found`);
      return res.status(400).send('Missing signedPayload');
    }

    console.log(`📱 APPLE V2 NOTIFICATION: Processing signed payload`);

    // Step 1: Verify and decode the JWT
    const decodedPayload = await verifyAndDecodeJWT(signedPayload);

    if (!decodedPayload) {
      console.log(`📱 APPLE V2 NOTIFICATION: JWT verification failed`);
      return res.status(401).send('Invalid JWT signature');
    }

    console.log(`📱 APPLE V2 NOTIFICATION: JWT verified successfully`);
    console.log(`📱 APPLE V2 NOTIFICATION: Notification type: ${decodedPayload.notificationType}`);

    // Step 2: Process the notification based on type
    await processNotificationV2(decodedPayload);

    console.log(`✅ APPLE V2 NOTIFICATION: Successfully processed`);
    return res.status(200).send('OK');

  } catch (error) {
    console.error(`❌ APPLE V2 NOTIFICATION: Error processing notification:`, error);
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * Verify JWT signature using Apple's certificates and decode payload
 */
async function verifyAndDecodeJWT(signedPayload) {
  try {
    // Decode JWT header to get certificate chain
    const header = jwt.decode(signedPayload, { complete: true })?.header;

    if (!header?.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
      throw new Error('Missing or invalid certificate chain in JWT header');
    }

    // Get the leaf certificate (first in chain)
    const leafCertPEM = `-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`;

    // Create X509 certificate object
    const leafCert = new X509Certificate(leafCertPEM);

    // Verify certificate chain and extract public key
    const publicKey = leafCert.publicKey;

    // Verify JWT signature using the public key
    const decoded = jwt.verify(signedPayload, publicKey, {
      algorithms: ['ES256'],
      issuer: 'https://appleid.apple.com' // Apple's issuer
    });

    return decoded;

  } catch (error) {
    console.error(`❌ JWT VERIFICATION: Failed to verify JWT:`, error);
    return null;
  }
}

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
          message: "Your subscription has expired. Renew to continue accessing premium features.",
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
      const notification = {
        ...notificationContent,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        ...additionalInfo // Allow passing additional info
      };

      await db.collection('users').doc(userId).collection('notifications').add(notification);
      console.log(`✅ SUBSCRIPTION V2: Notification sent to user ${userId} for status: ${status}`);
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

// Export the enhanced helper functions for use in other parts of your code
/* module.exports = {
  updateUserSubscriptionV2,
  createSubscriptionNotificationV2,
  verifyAndDecodeJWT,
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
        const warningNotification = {
          title: "⏰ Trial Expiring Soon",
          message: "Your 30-day trial expires in 3 days. Subscribe now to maintain your team's momentum and continue growing your network.",
          type: "trial_warning",
          route: "/subscription",
          route_params: JSON.stringify({ "action": "upgrade" }),
          createdAt: FieldValue.serverTimestamp(),
          read: false
        };

        await db.collection('users').doc(userId).collection('notifications').add(warningNotification);
        console.log(`✅ TRIAL WARNING: Sent warning to user ${userId}`);

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
exports.handleGooglePlayNotification = onRequest({ region: "us-central1" }, async (req, res) => {
  // Enable CORS
  cors(req, res, async () => {
    try {
      console.log(`🤖 GOOGLE PLAY WEBHOOK: Received notification`);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body:', JSON.stringify(req.body, null, 2));

      // Verify the notification is from Google Play (optional but recommended)
      // You can implement signature verification here if needed

      const message = req.body.message;
      if (!message || !message.data) {
        console.log(`🤖 GOOGLE PLAY WEBHOOK: Invalid message format`);
        res.status(400).send('Invalid message format');
        return;
      }

      // Decode the base64 message data
      const notificationData = JSON.parse(Buffer.from(message.data, 'base64').toString());
      console.log(`🤖 GOOGLE PLAY WEBHOOK: Decoded notification:`, JSON.stringify(notificationData, null, 2));

      const { subscriptionNotification, testNotification } = notificationData;

      // Handle test notifications
      if (testNotification) {
        console.log(`🤖 GOOGLE PLAY WEBHOOK: Received test notification`);
        res.status(200).send('Test notification received');
        return;
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
          res.status(200).send('User not found');
          return;
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

        res.status(200).send('Notification processed');
        return;
      }

      console.log(`🤖 GOOGLE PLAY WEBHOOK: Unknown notification type`);
      res.status(400).send('Unknown notification type');

    } catch (error) {
      console.error('❌ GOOGLE PLAY WEBHOOK: Error processing notification:', error);
      res.status(500).send('Internal server error');
    }
  });
});

// ============================================================================
// CENTRALIZED BADGE UPDATE FUNCTION
// ============================================================================

/**
 * Centralized function to calculate and update badge count for a user
 * Includes both notifications and chat messages - with optimizations
 */
const updateUserBadge = async (userId) => {
  try {
    console.log(`🔔 BADGE UPDATE: Starting badge update for user ${userId}`);

    // Use transaction for consistent badge calculation
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(db.collection('users').doc(userId));
      if (!userDoc.exists) {
        console.log(`🔔 BADGE UPDATE: User document for ${userId} does not exist`);
        return { success: false, error: "User not found" };
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcm_token;
      
      if (!fcmToken) {
        console.log(`🔔 BADGE UPDATE: No FCM token for user ${userId}`);
        return { success: false, error: "No FCM token" };
      }

      // Count unread notifications using optimized query
      let notificationCount = 0;
      try {
        const unreadNotifQuery = db.collection("users")
          .doc(userId)
          .collection("notifications")
          .where("read", "==", false);
        
        const unreadNotifSnapshot = await transaction.get(unreadNotifQuery);
        notificationCount = unreadNotifSnapshot.size;
      } catch (e) {
        console.warn(`🔔 BADGE WARN: unread notifications count failed for ${userId}:`, e.message);
        notificationCount = 0;
      }

      // Count unread chat messages with pagination and optimization
      let messageCount = 0;
      try {
        // Use a more efficient approach - query only chats with unread messages
        const unreadChatsQuery = db.collection("chats")
          .where("participants", "array-contains", userId)
          .where(`isRead.${userId}`, "==", false)
          .limit(100); // Add pagination limit

        const unreadChatsSnapshot = await transaction.get(unreadChatsQuery);
        
        // Process chats in parallel with proper error handling
        const chatPromises = unreadChatsSnapshot.docs.map(async (doc) => {
          const chatData = doc.data();
          
          // Check if last message exists and is from someone else
          const lastMessageRef = doc.ref.collection("messages")
            .orderBy("createdAt", "desc")
            .limit(1);
          
          const lastMessageSnapshot = await transaction.get(lastMessageRef);
          
          if (!lastMessageSnapshot.empty) {
            const lastMessage = lastMessageSnapshot.docs[0].data();
            if (lastMessage.senderId && lastMessage.senderId !== userId) {
              return 1; // Count this chat
            }
          }
          return 0;
        });

        const chatResults = await Promise.allSettled(chatPromises);
        messageCount = chatResults.reduce((sum, result) => {
          return sum + (result.status === 'fulfilled' ? result.value : 0);
        }, 0);
        
      } catch (e) {
        console.warn(`🔔 BADGE WARN: Failed to count unread messages for ${userId}:`, e.message);
        messageCount = 0;
      }

      const totalBadgeCount = notificationCount + messageCount;

      console.log(`🔔 BADGE UPDATE: User ${userId} - Notifications: ${notificationCount}, Messages: ${messageCount}, Total: ${totalBadgeCount}`);

      // Update badge count in user document
      transaction.update(db.collection("users").doc(userId), {
        currentBadge: totalBadgeCount,
        lastBadgeUpdate: FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        fcmToken, 
        badgeCount: totalBadgeCount,
        notificationCount,
        messageCount
      };
    });

    if (!result.success) {
      console.error(`❌ BADGE UPDATE: Failed to calculate badge for user ${userId}:`, result.error);
      return;
    }

    // Send badge update with retry mechanism
    await sendBadgeUpdateWithRetry(userId, result.fcmToken, result.badgeCount);

    console.log(`✅ BADGE UPDATE: Badge updated successfully for user ${userId} to ${result.badgeCount}`);

  } catch (error) {
    console.error(`❌ BADGE UPDATE: Failed to update badge for user ${userId}:`, error);
    
    // Handle specific error cases
    if (error.code === 'NOT_FOUND') {
      console.log(`🔔 BADGE UPDATE: User ${userId} not found, skipping update`);
    } else if (error.code === 'PERMISSION_DENIED') {
      console.log(`🔔 BADGE UPDATE: Permission denied for user ${userId}, skipping update`);
    }
  }
};

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

const sendBadgeUpdateWithRetry = async (userId, fcmToken, badgeCount, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await messaging.send({
        token: fcmToken,
        data: { badge: badgeCount.toString() },
        apns: {
          payload: {
            aps: { badge: badgeCount }
          }
        }
      });
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// ============================================================================
// *** MODIFIED FUNCTION: getUserByReferralCode ***
// Now returns bizOppName for personalization
// ============================================================================
exports.getUserByReferralCode = onRequest({ region: "us-central1", cors: true }, async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: 'Referral code is required.' });
  }

  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("referralCode", "==", code).limit(1).get();

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

    // Include photoUrl and isProfileComplete in the response
    return res.status(200).json({
      firstName: sponsorData.firstName,
      lastName: sponsorData.lastName,
      uid: sponsorDoc.id,
      availableCountries: availableCountries,
      bizOppName: bizOppName, // *** NEW: Return bizOppName ***
      photoUrl: sponsorData.photoUrl || null, // Added photoUrl here
      isProfileComplete: sponsorData.isProfileComplete || false, // *** NEW: Return isProfileComplete ***
    });

  } catch (error) {
    console.error("Critical Error in getUserByReferralCode:", error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


exports.registerUser = onCall({ region: "us-central1" }, async (request) => {
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

    if (sponsorReferralCode) {
      const sponsorQuery = await db.collection("users").where("referralCode", "==", sponsorReferralCode).limit(1).get();
      if (!sponsorQuery.empty) {
        const sponsorDoc = sponsorQuery.docs[0];
        sponsorId = sponsorDoc.id;
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
        console.error("❌ REGISTER FUNCTION: Sponsor not found:", sponsorReferralCode);
        throw new HttpsError("not-found", `Sponsor with referral code '${sponsorReferralCode}' not found.`);
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
      console.log("🔍 REGISTER FUNCTION: Updating sponsor counts...");
      const batch = db.batch();
      const sponsorRef = db.collection("users").doc(sponsorId);
      batch.update(sponsorRef, {
        directSponsorCount: FieldValue.increment(1),
        totalTeamCount: FieldValue.increment(1)
      });

      sponsorUplineRefs.forEach(uplineMemberId => {
        const uplineMemberRef = db.collection("users").doc(uplineMemberId);
        batch.update(uplineMemberRef, { totalTeamCount: FieldValue.increment(1) });
      });
      await batch.commit();
      console.log("✅ REGISTER FUNCTION: Sponsor counts updated");
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

exports.getNetworkCounts = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;

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
      case 'last24':
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        baseQuery = baseQuery.where("createdAt", ">=", twentyFourHoursAgo);
        break;
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


exports.sendPushNotification = onDocumentCreated("users/{userId}/notifications/{notificationId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log("🔔 PUSH DEBUG: No data associated with the event");
    return;
  }
  const userId = event.params.userId;
  const notificationId = event.params.notificationId;
  const notificationData = snap.data();

  console.log(`🔔 PUSH DEBUG: Starting push notification process`);
  console.log(`🔔 PUSH DEBUG: User ID: ${userId}`);
  console.log(`🔔 PUSH DEBUG: Notification ID: ${notificationId}`);
  console.log(`🔔 PUSH DEBUG: Notification data:`, JSON.stringify(notificationData, null, 2));

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error(`🔔 PUSH DEBUG: User document for ${userId} does not exist.`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    console.log(`🔔 PUSH DEBUG: User found - Name: ${userData?.firstName} ${userData?.lastName}`);

    if (!fcmToken) {
      console.log(`🔔 PUSH DEBUG: Missing FCM token for user ${userId}. Skipping push notification.`);
      return;
    }

    console.log(`🔔 PUSH DEBUG: FCM token found: ${fcmToken.substring(0, 20)}...`);

    const imageUrl = notificationData?.imageUrl;

    // Send the push notification without badge (badge will be updated by centralized function)
    const message = {
      token: fcmToken,
      notification: {
        title: notificationData?.title || "New Notification",
        body: notificationData?.message || "You have a new message.",
        // Removed imageUrl to prevent iOS notification failures
      },
      data: {
        notification_id: notificationId,
        type: notificationData?.type || "generic",
        route: notificationData?.route || "/",
        route_params: notificationData?.route_params || "{}",
        imageUrl: imageUrl || "", // Keep in data for app handling
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notificationData?.title || "New Notification",
              body: notificationData?.message || "You have a new message.",
            },
            sound: "default",
            // Badge will be set by updateUserBadge function
          },
        },
      },
      android: {
        notification: {
          sound: "default",
        },
      },
    };

    console.log(`🔔 PUSH DEBUG: Message payload:`, JSON.stringify(message, null, 2));

    const response = await messaging.send(message);
    console.log(`✅ PUSH DEBUG: FCM push sent successfully to user ${userId}`);
    console.log(`✅ PUSH DEBUG: FCM Response:`, response);

    // Update badge using centralized function after notification is created
    console.log(`🔔 PUSH DEBUG: Updating badge using centralized function`);
    await updateUserBadge(userId);

  } catch (error) {
    console.error(`❌ PUSH DEBUG: Failed to send FCM push to user ${userId}:`, error);
    console.error(`❌ PUSH DEBUG: Error code:`, error.code);
    console.error(`❌ PUSH DEBUG: Error message:`, error.message);
    console.error(`❌ PUSH DEBUG: Full error:`, error);
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

    const notificationContent = {
      title: `New Message from ${senderName}`,
      message: `${messageText}`,
      imageUrl: senderPhotoUrl || null,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
      type: "new_message",
      route: "/message_thread",
      route_params: JSON.stringify({ "threadId": threadId }),
    };

    const notificationPromises = recipients.map(recipientId => {
      return db.collection("users").doc(recipientId).collection("notifications").add(notificationContent);
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

exports.notifyOnNewSponsorship = onDocumentUpdated("users/{userId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData) {
    console.log("🔔 SPONSORSHIP DEBUG: Missing before or after data");
    return;
  }

  const newUserId = event.params.userId;

  // Check if profile was completed for the first time using explicit flag
  const beforeIsProfileComplete = beforeData.isProfileComplete;
  const afterIsProfileComplete = afterData.isProfileComplete;

  if (beforeIsProfileComplete === true || afterIsProfileComplete !== true) {
    console.log(`🔔 SPONSORSHIP DEBUG: Profile not completed for the first time for user ${newUserId}. Before: ${beforeIsProfileComplete}, After: ${afterIsProfileComplete}. Skipping notification.`);
    return;
  }

  console.log(`🔔 SPONSORSHIP DEBUG: Profile completed for the first time for user ${newUserId}`);

  if (!afterData.referredBy) {
    console.log(`🔔 SPONSORSHIP DEBUG: New user ${newUserId} has no referredBy field. Skipping sponsorship notification.`);
    return;
  }

  try {
    console.log(`🔔 SPONSORSHIP DEBUG: Looking for sponsor with referral code: ${afterData.referredBy}`);

    const sponsorQuery = await db.collection("users").where("referralCode", "==", afterData.referredBy).limit(1).get();
    if (sponsorQuery.empty) {
      console.log(`🔔 SPONSORSHIP DEBUG: Sponsor with referral code ${afterData.referredBy} not found.`);
      return;
    }

    const sponsorDoc = sponsorQuery.docs[0];
    const sponsor = sponsorDoc.data();
    const sponsorId = sponsorDoc.id;

    console.log(`🔔 SPONSORSHIP DEBUG: Found sponsor - ID: ${sponsorId}, Name: ${sponsor.firstName} ${sponsor.lastName}`);
    console.log(`🔔 SPONSORSHIP DEBUG: Sponsor role: ${sponsor.role}`);
    console.log(`🔔 SPONSORSHIP DEBUG: New user adminReferral: ${afterData.adminReferral}`);

    const newUserLocation = `${afterData.city || ""}, ${afterData.state || ""}${afterData.country ? ` - ${afterData.country}` : ""}`;

    // Get business opportunity name using centralized helper
    const bizOppName = await getBusinessOpportunityName(sponsor.upline_admin);

    let notificationContent;

    // Determine notification type based on referral method
    if (afterData.adminReferral && sponsor.role === 'admin') {
      // Scenario 2: Admin sharing with existing business opportunity downline member (new= parameter)
      console.log(`🔔 SPONSORSHIP DEBUG: Admin-to-existing-downline scenario detected`);

      notificationContent = {
        title: "🎉 You have a new team member!",
        message: `Congratulations, ${sponsor.firstName}! Your existing ${bizOppName} partner, ${afterData.firstName} ${afterData.lastName}, has joined you on the Team Build Pro app. You're now on the same system to accelerate growth and duplication! Click Here to view their profile.`,
        imageUrl: afterData.photoUrl || null,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "new_member",
        route: "/member_detail",
        route_params: JSON.stringify({ "userId": newUserId }),
      };
    } else {
      // Scenario 1: Regular sponsorship (ref= parameter) - user-to-user or admin-to-new-prospect
      console.log(`🔔 SPONSORSHIP DEBUG: Regular sponsorship scenario detected`);

      notificationContent = {
        title: "🎉 You have a new team member!",
        message: `Congratulations, ${sponsor.firstName}! ${afterData.firstName} ${afterData.lastName} from ${newUserLocation} has just joined your team on the Team Build Pro app. This is the first step in creating powerful momentum together! Click Here to view their profile.`,
        imageUrl: afterData.photoUrl || null,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "new_member",
        route: "/member_detail",
        route_params: JSON.stringify({ "userId": newUserId }),
      };
    }

    console.log(`🔔 SPONSORSHIP DEBUG: Creating notification for sponsor ${sponsorId}`);
    console.log(`🔔 SPONSORSHIP DEBUG: Notification content:`, JSON.stringify(notificationContent, null, 2));

    await db.collection("users").doc(sponsorId).collection("notifications").add(notificationContent);
    console.log(`✅ SPONSORSHIP DEBUG: Sponsorship notification successfully sent to ${sponsorId}.`);

  } catch (error) {
    console.error(`❌ SPONSORSHIP DEBUG: Error creating sponsorship notification:`, error);
    console.error(`❌ SPONSORSHIP DEBUG: Error details:`, error.message, error.stack);
  }
});

exports.notifyOnQualification = onDocumentUpdated("users/{userId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();

  if (!beforeData || !afterData || beforeData.qualifiedDate) {
    return;
  }

  try {
    const template = await remoteConfig.getTemplate();
    const parameters = template.parameters;
    const projectWideDirectSponsorMin = parseInt(parameters.projectWideDirectSponsorMin?.defaultValue?.value || '4', 10);
    const projectWideTotalTeamMin = parseInt(parameters.projectWideDataTeamMin?.defaultValue?.value || '20', 10);

    const wasQualifiedBefore = (beforeData.directSponsorCount >= projectWideDirectSponsorMin) && (beforeData.totalTeamCount >= projectWideTotalTeamMin);
    const isQualifiedNow = (afterData.directSponsorCount >= projectWideDirectSponsorMin) && (afterData.totalTeamCount >= projectWideTotalTeamMin);
    const isJoined = beforeData.bizJoinDate;

    if (!wasQualifiedBefore && isQualifiedNow && !isJoined) {
      if (afterData.role === 'admin') {
        console.log(`User ${event.params.userId} is an admin. Skipping qualification notification.`);
        await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });
        return;
      }

      await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });

      // Get business opportunity name using centralized helper
      const bizName = await getBusinessOpportunityName(afterData.upline_admin);

      const notificationContent = {
        title: "You're Qualified!",
        message: `Your hard work paid off, ${afterData.firstName}! You've built a qualified team and are now eligible to join the ${bizName} organization. Click Here to take the next step!`,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "new_qualification",
        route: "/business",
        route_params: JSON.stringify({}),
      };
      await db.collection("users").doc(event.params.userId).collection("notifications").add(notificationContent);
    }
  } catch (error) {
    console.error(`Error in notifyOnQualification for user ${event.params.userId}:`, error);
  }
});

exports.recalculateTeamCounts = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("permission-denied", "You must be an administrator to perform this operation.");
  }
  const callerId = request.auth.uid;
  const userDoc = await db.collection("users").doc(callerId).get();
  const adminSettingsDoc = await db.collection("admin_settings").doc(callerId).get();

  if (!userDoc.exists || userDoc.data().role !== 'admin' || !adminSettingsDoc.exists || adminSettingsDoc.data().superAdmin !== true) {
    throw new HttpsError("permission-denied", "You must be a super administrator to perform this operation.");
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

    const notificationContent = {
      title: `Interest in your ${bizOpp} opportunity! 🎉`,
      message: `${visitingUserName} has just used your referral link to to learn more about the ${bizOpp} opportunity! Click Here to view their profile.`,
      imageUrl: userData.photoUrl || null,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
      type: "biz_opp_visit",
      route: "/member_detail",
      route_params: JSON.stringify({ "userId": visitingUserId }),
    };

    await db.collection("users").doc(sponsorId).collection("notifications").add(notificationContent);

    console.log(`Biz opp visit notification sent to sponsor ${sponsorId} for user ${visitingUserId}.`);
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
// DAILY TEAM GROWTH NOTIFICATIONS
// ============================================================================

/**
 * Scheduled function that runs every hour to send daily team growth notifications
 * at 10am local time to users who had new team members join the previous day.
 *
 * This function uses an efficient approach:
 * 1. Query all users who joined yesterday with photoUrl != null
 * 2. Use their upline_refs arrays to identify which users should receive notifications
 * 3. Count new members per user and send notifications
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
