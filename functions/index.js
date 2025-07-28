const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, DocumentReference } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");
const cors = require("cors")({ origin: true });
const { getRemoteConfig } = require("firebase-admin/remote-config");
const { getTimezoneFromLocation, getTimezonesAtHour } = require("./timezone_mapping");

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();
const remoteConfig = getRemoteConfig();

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
          message: "Your 30-day trial expires in 3 days. Subscribe now to continue accessing premium features.",
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
// CENTRALIZED BADGE UPDATE FUNCTION
// ============================================================================

/**
 * Centralized function to calculate and update badge count for a user
 * Includes both notifications and chat messages
 */
const updateUserBadge = async (userId) => {
  try {
    console.log(`🔔 BADGE UPDATE: Starting badge update for user ${userId}`);

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.log(`🔔 BADGE UPDATE: User document for ${userId} does not exist`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    if (!fcmToken) {
      console.log(`🔔 BADGE UPDATE: No FCM token for user ${userId}`);
      return;
    }

    // Count unread notifications
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();

    const notificationCount = unreadNotificationsSnapshot.size;

    // Count unread chat messages  
    const unreadChatsSnapshot = await db.collection("chats")
      .where("participants", "array-contains", userId)
      .get();

    let messageCount = 0;
    unreadChatsSnapshot.docs.forEach(doc => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      if (isReadMap[userId] === false) {
        messageCount++;
      }
    });

    const totalBadgeCount = notificationCount + messageCount;

    console.log(`🔔 BADGE UPDATE: User ${userId} - Notifications: ${notificationCount}, Messages: ${messageCount}, Total: ${totalBadgeCount}`);

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
        // Android handles badges differently, but we include for completeness
      },
    };

    await messaging.send(message);
    console.log(`✅ BADGE UPDATE: Badge updated successfully for user ${userId} to ${totalBadgeCount}`);

  } catch (error) {
    console.error(`❌ BADGE UPDATE: Failed to update badge for user ${userId}:`, error);
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

exports.getUserByReferralCode = onRequest({ region: "us-central1" }, (req, res) => {
  cors(req, res, async () => {
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
      const uplineAdminId = sponsorData.upline_admin;
      let availableCountries = [];

      if (uplineAdminId) {
        const adminSettingsDoc = await db.collection("admin_settings").doc(uplineAdminId).get();
        if (adminSettingsDoc.exists) {
          const adminSettingsData = adminSettingsDoc.data();
          if (adminSettingsData.countries && Array.isArray(adminSettingsData.countries)) {
            availableCountries = adminSettingsData.countries;
          }
        }
      }

      return res.status(200).json({
        firstName: sponsorData.firstName,
        lastName: sponsorData.lastName,
        uid: sponsorDoc.id,
        availableCountries: availableCountries,
      });

    } catch (error) {
      console.error("Critical Error in getUserByReferralCode:", error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  });
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

exports.getNetworkCounts = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;
  try {
    const networkSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (networkSnapshot.empty) {
      return {
        counts: { all: 0, last24: 0, last7: 0, last30: 0, newQualified: 0, joinedOpportunity: 0 }
      };
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let last24Count = 0;
    let last7Count = 0;
    let last30Count = 0;
    let newQualifiedCount = 0;
    let joinedOpportunityCount = 0;

    networkSnapshot.docs.forEach(doc => {
      const user = doc.data();
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : null;

      if (createdAt) {
        if (createdAt >= twentyFourHoursAgo) last24Count++;
        if (createdAt >= sevenDaysAgo) last7Count++;
        if (createdAt >= thirtyDaysAgo) last30Count++;
      }
      if (user.qualifiedDate) {
        newQualifiedCount++;
      }
      if (user.biz_join_date) {
        joinedOpportunityCount++;
      }
    });

    return {
      counts: {
        all: networkSnapshot.size,
        last24: last24Count,
        last7: last7Count,
        last30: last30Count,
        newQualified: newQualifiedCount,
        joinedOpportunity: joinedOpportunityCount,
      }
    };
  } catch (error) {
    console.error(`CRITICAL ERROR in getNetworkCounts for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getFilteredNetwork = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const currentUserId = request.auth.uid;
  const { filter, searchQuery, levelOffset, limit = 100, offset = 0 } = request.data || {};

  try {
    console.log(`🔍 FILTER DEBUG: Starting filtered network for user ${currentUserId}`);
    console.log(`🔍 FILTER DEBUG: Params - filter: ${filter}, searchQuery: "${searchQuery}", levelOffset: ${levelOffset}`);

    // Get base network
    const networkSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (networkSnapshot.empty) {
      return {
        network: [],
        totalCount: 0,
        hasMore: false
      };
    }

    let filteredUsers = [];
    const now = new Date();

    // Apply time-based and status filters
    networkSnapshot.docs.forEach(doc => {
      const user = { uid: doc.id, ...doc.data() };
      const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : null;
      const qualifiedDate = user.qualifiedDate?.toDate ? user.qualifiedDate.toDate() : null;
      const bizJoinDate = user.biz_join_date?.toDate ? user.biz_join_date.toDate() : null;

      // Apply filter logic
      let includeUser = false;
      switch (filter) {
        case 'last24':
          includeUser = createdAt && createdAt >= new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last7':
          includeUser = createdAt && createdAt >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30':
          includeUser = createdAt && createdAt >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'newQualified':
          includeUser = !!qualifiedDate;
          break;
        case 'joinedOpportunity':
          includeUser = !!bizJoinDate;
          break;
        case 'all':
        default:
          includeUser = true;
          break;
      }

      if (includeUser) {
        // Apply search filter if provided
        if (searchQuery && searchQuery.trim() !== '') {
          const searchLower = searchQuery.toLowerCase();
          const matchesSearch =
            (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
            (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
            (user.email && user.email.toLowerCase().includes(searchLower)) ||
            (user.city && user.city.toLowerCase().includes(searchLower)) ||
            (user.state && user.state.toLowerCase().includes(searchLower)) ||
            (user.country && user.country.toLowerCase().includes(searchLower));

          if (matchesSearch) {
            filteredUsers.push(user);
          }
        } else {
          filteredUsers.push(user);
        }
      }
    });

    // Sort users based on filter type
    filteredUsers.sort((a, b) => {
      if (filter === 'joinedOpportunity') {
        const aDate = a.biz_join_date?.toDate ? a.biz_join_date.toDate() : null;
        const bDate = b.biz_join_date?.toDate ? b.biz_join_date.toDate() : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.getTime() - aDate.getTime();
      } else {
        // Default sort by creation date
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : null;
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : null;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.getTime() - aDate.getTime();
      }
    });

    // Group by level if levelOffset is provided
    const groupedByLevel = {};
    if (levelOffset !== undefined) {
      filteredUsers.forEach(user => {
        const displayLevel = (user.level || 1) - levelOffset;
        if (displayLevel > 0 || filter === 'newQualified' || filter === 'joinedOpportunity') {
          if (!groupedByLevel[displayLevel]) {
            groupedByLevel[displayLevel] = [];
          }
          groupedByLevel[displayLevel].push(user);
        }
      });
    }

    // Apply pagination
    const totalCount = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    console.log(`✅ FILTER DEBUG: Returning ${paginatedUsers.length} users out of ${totalCount} total`);

    return {
      network: serializeData(paginatedUsers),
      groupedByLevel: levelOffset !== undefined ? serializeData(groupedByLevel) : null,
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

exports.checkAdminSubscriptionStatus = onCall(async (request) => {
  const { uid } = request.data;
  const adminRef = db.collection("admins").doc(uid);
  try {
    const doc = await adminRef.get();
    return { isSubscribed: doc.exists && doc.data().isSubscribed };
  } catch (error) {
    console.error("Error checking subscription status:", error);
    throw new HttpsError("internal", "Could not check subscription status.");
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
        title: "🎉 You have a new Network member!",
        message: `Congratulations, ${sponsor.firstName}! You shared the Network with your current ${bizOppName} organization member, ${afterData.firstName} ${afterData.lastName} from ${newUserLocation} and they have just downloaded and installed the Network Build Pro app! This means any of their Network members that ultimately join the ${bizOppName} organization will automatically be placed in your ${bizOppName} organization! Click Here to view their profile.`,
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
        title: "🎉 You have a new Network member!",
        message: `Congratulations, ${sponsor.firstName}! You connected with ${afterData.firstName} ${afterData.lastName} from ${newUserLocation}. Click Here to view their profile.`,
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
        message: `Congratulations, ${afterData.firstName}! You are now qualified to join the ${bizName} organization. Click Here to learn more.`,
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
      title: `🎉 New ${bizOpp} interest!`,
      message: `${visitingUserName} has just used your referral link to explore ${bizOpp}! Click Here to view their profile.`,
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

    // Parallel fetch sponsor and network leader details
    const promises = [];
    let sponsorPromise = null;
    let teamLeaderPromise = null;

    // Fetch sponsor details if sponsorId exists
    if (memberData.sponsor_id && memberData.sponsor_id.trim() !== '') {
      sponsorPromise = db.collection("users").doc(memberData.sponsor_id).get();
      promises.push(sponsorPromise);
    }

    // Fetch network leader details if uplineAdmin exists and is different from sponsor
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

    // Process network leader result
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

    console.log(`✅ MEMBER DEBUG: Successfully fetched member details with ${sponsorData ? 'sponsor' : 'no sponsor'} and ${teamLeaderData ? 'team leader' : 'no network leader'}`);

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
 * Scheduled function that runs every hour to send daily network growth notifications
 * at 12 noon local time to users who had new network members join the previous day.
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
  console.log("🔔 DAILY NOTIFICATIONS: Starting daily network growth notification process");

  try {
    const now = new Date();
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

      // CRITICAL: Skip admin users - they should not trigger daily network growth notifications
      if (newMember.role === 'admin') {
        console.log(`🔔 DAILY NOTIFICATIONS: Skipping admin user ${newMember.firstName} ${newMember.lastName} (${doc.id}) - admins don't trigger network notifications`);
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

    console.log(`🔔 DAILY NOTIFICATIONS: ${notificationCounts.size} users have new network members to be notified about`);

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

        // Check if it's 12 noon in their timezone
        if (userLocalHour === 12) {
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

    console.log(`🔔 DAILY NOTIFICATIONS: ${usersToNotify.length} users are in 12 noon timezone and will receive notifications`);

    if (usersToNotify.length === 0) {
      console.log("🔔 DAILY NOTIFICATIONS: No users in 12 noon timezone to notify at this time");
      return;
    }

    // Step 5: Send notifications to eligible users and record the date to prevent duplicates
    const notificationPromises = usersToNotify.map(async ({ userId, userData, newMemberCount, newMembers }) => {
      try {
        console.log(`🔔 DAILY NOTIFICATIONS: Creating notification for ${userData.firstName} ${userData.lastName} (${userId}) - ${newMemberCount} new members`);

        const notificationContent = {
          title: "Your Network Is Growing!",
          message: `Congratulations, ${userData.firstName}! ${newMemberCount} new member${newMemberCount > 1 ? 's' : ''} joined your Network yesterday. Click Here to view their profiles`,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
          type: "new_network_members",
          route: "/network",
          route_params: JSON.stringify({ filter: "last24" }),
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
    console.log(`✅ DAILY NOTIFICATIONS: Daily network growth notification process completed`);

  } catch (error) {
    console.error("❌ DAILY NOTIFICATIONS: Critical error in daily network growth notifications:", error);
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


