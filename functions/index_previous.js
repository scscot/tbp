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
