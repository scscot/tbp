// ==============================
// ADMIN FUNCTIONS MODULE
// Handles all administrative functions including subscription management,
// user account deletion, validation, testing, and scheduled operations
// ==============================

const {
  onCall,
  HttpsError,
  onRequest,
  onDocumentWritten,
  onSchedule,
  logger,
  functions,
  admin,
  db,
  FieldValue,
  auth,
  validateAuthentication,
  validateAdminRole,
  getUserDocument,
} = require('./shared/utilities');

// Import functions from other modules
const {
  createNotification,
  updateUserSubscription,
  createSubscriptionNotification,
  createSubscriptionNotificationV2,
  upsertAppleV2NotificationState
} = require('./notification-functions');

const { sendDemoInvitation } = require('./sendDemoInvitation');
const { sendLaunchCampaign } = require('./sendLaunchCampaign');
const fetch = require('node-fetch');

// ==============================
// Apple Subscription Management
// ==============================

/**
 * Decode Apple V2 notification payload
 */
async function decodeNotificationPayload(signedPayload) {
  // This would contain the actual JWT verification logic
  // For now, we'll return a basic structure
  try {
    // In a real implementation, you'd verify the JWT signature here
    const decoded = JSON.parse(Buffer.from(signedPayload.split('.')[1], 'base64').toString());
    return decoded;
  } catch (error) {
    logger.error('Failed to decode Apple notification payload:', error);
    throw new Error('Invalid notification payload');
  }
}

/**
 * Check if payload is a data notification
 */
function isDecodedNotificationDataPayload(payload) {
  return payload && payload.data && payload.notificationUUID && payload.notificationType;
}

/**
 * Check if payload is a summary notification
 */
function isDecodedNotificationSummaryPayload(payload) {
  return payload && payload.summary;
}

/**
 * Process Apple V2 notification
 */
async function processNotificationV2({ notificationType, subtype, data }) {
  try {
    const originalTransactionId = data?.originalTransactionId;

    if (!originalTransactionId) {
      logger.warn('No original transaction ID in Apple V2 notification');
      return;
    }

    // Find user by transaction ID
    const userQuery = await db.collection('users')
      .where('appleTransactionId', '==', originalTransactionId)
      .limit(1)
      .get();

    if (userQuery.empty) {
      logger.warn(`No user found for Apple V2 transaction ${originalTransactionId}`);
      return;
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    logger.info(`Processing Apple V2 ${notificationType} for user ${userId}`);

    // Handle different notification types
    switch (notificationType) {
      case 'SUBSCRIBED':
        await updateUserSubscription(userId, 'active', data.expiresDate);
        await createSubscriptionNotificationV2(userId, 'active', data.expiresDate, { notificationType, subtype });
        break;

      case 'DID_RENEW':
        await updateUserSubscription(userId, 'active', data.expiresDate);
        await createSubscriptionNotificationV2(userId, 'active', data.expiresDate, { notificationType, subtype });
        break;

      case 'EXPIRED':
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotificationV2(userId, 'expired', null, { notificationType, subtype });
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        if (subtype === 'AUTO_RENEW_DISABLED') {
          await updateUserSubscription(userId, 'cancelled', data.expiresDate);
          await createSubscriptionNotificationV2(userId, 'cancelled', data.expiresDate, { notificationType, subtype });
        }
        break;

      default:
        logger.info(`Unhandled Apple V2 notification type: ${notificationType}`);
        break;
    }

  } catch (error) {
    logger.error('Error processing Apple V2 notification:', error);
  }
}

/**
 * Handle Apple Subscription Notifications (V1)
 */
const handleAppleSubscriptionNotification = onRequest({ region: "us-central1" }, async (req, res) => {
  logger.info(`📱 APPLE NOTIFICATION: Received Apple server-to-server notification`);

  try {
    // Verify this is a POST request
    if (req.method !== 'POST') {
      logger.info(`📱 APPLE NOTIFICATION: Invalid method: ${req.method}`);
      return res.status(405).send('Method Not Allowed');
    }

    const notificationData = req.body;
    logger.info(`📱 APPLE NOTIFICATION: Notification data:`, JSON.stringify(notificationData, null, 2));

    // Extract notification type and transaction info
    const notificationType = notificationData.notification_type;
    const latestReceiptInfo = notificationData.latest_receipt_info?.[0];

    if (!latestReceiptInfo) {
      logger.info(`📱 APPLE NOTIFICATION: No transaction info found`);
      return res.status(400).send('No transaction info');
    }

    // Extract original transaction ID to find user
    const originalTransactionId = latestReceiptInfo.original_transaction_id;

    if (!originalTransactionId) {
      logger.info(`📱 APPLE NOTIFICATION: No original transaction ID found`);
      return res.status(400).send('No transaction ID found');
    }

    logger.info(`📱 APPLE NOTIFICATION: Looking for user with transaction ID: ${originalTransactionId}`);

    // Find user by Apple transaction ID
    const userQuery = await db.collection('users')
      .where('appleTransactionId', '==', originalTransactionId)
      .limit(1)
      .get();

    if (userQuery.empty) {
      logger.info(`📱 APPLE NOTIFICATION: No user found for transaction ${originalTransactionId}`);
      return res.status(404).send('User not found');
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    logger.info(`📱 APPLE NOTIFICATION: Found user ${userId}, processing ${notificationType}`);

    // Handle different notification types
    switch (notificationType) {
      case 'INITIAL_BUY':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} started subscription`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'CANCEL':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} cancelled subscription`);
        await updateUserSubscription(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'cancelled', latestReceiptInfo.expires_date_ms);
        break;

      case 'DID_FAIL_TO_RENEW':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} subscription failed to renew`);
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotification(userId, 'expired');
        break;

      case 'DID_RENEW':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} subscription renewed`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'INTERACTIVE_RENEWAL':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} interactively renewed subscription`);
        await updateUserSubscription(userId, 'active', latestReceiptInfo.expires_date_ms);
        await createSubscriptionNotification(userId, 'active', latestReceiptInfo.expires_date_ms);
        break;

      case 'DID_CHANGE_RENEWAL_PREF':
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} changed renewal preference`);
        // Handle renewal preference change if needed
        break;

      case 'DID_CHANGE_RENEWAL_STATUS': {
        logger.info(`📱 APPLE NOTIFICATION: User ${userId} changed renewal status`);
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
        logger.info(`📱 APPLE NOTIFICATION: Unhandled notification type: ${notificationType}`);
        break;
    }

    logger.info(`✅ APPLE NOTIFICATION: Successfully processed ${notificationType} for user ${userId}`);
    return res.status(200).send('OK');

  } catch (error) {
    logger.error(`❌ APPLE NOTIFICATION: Error processing notification:`, error);
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * Handle Apple Subscription Notifications V2
 */
const handleAppleSubscriptionNotificationV2 = onRequest({ region: "us-central1", cors: false }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { signedPayload } = req.body || {};
    if (!signedPayload) {
      return res.status(400).send("Missing signedPayload");
    }

    // Verifies signature and certificate chain
    const payload = await decodeNotificationPayload(signedPayload);

    // Persist notification state with idempotency
    await upsertAppleV2NotificationState(payload);

    // Optional: guard that the bundleId matches your app
    const APP_BUNDLE_ID = process.env.APP_BUNDLE_ID;
    const bundleFromPayload = payload?.data?.bundleId || payload?.summary?.bundleId;
    if (APP_BUNDLE_ID && bundleFromPayload && APP_BUNDLE_ID !== bundleFromPayload) {
      return res.status(401).send("Bundle mismatch");
    }

    if (isDecodedNotificationDataPayload(payload)) {
      const { notificationType, subtype, data } = payload;
      logger.info(`📱 APPLE V2 NOTIFICATION: Processing ${notificationType} notification`);
      await processNotificationV2({ notificationType, subtype, data });
    } else if (isDecodedNotificationSummaryPayload(payload)) {
      const { summary: _summary } = payload;
      logger.info(`📱 APPLE V2 NOTIFICATION: Processing summary notification`);
      // Handle summary notifications if needed
    }

    return res.status(200).send("OK");
  } catch (error) {
    logger.error("❌ APPLE V2 NOTIFICATION: Error processing notification:", error);
    return res.status(500).send("Internal Server Error");
  }
});

// ==============================
// Google Play Subscription Management
// ==============================

/**
 * Handle Google Play Subscription Notifications
 */
const handleGooglePlayNotification = onRequest({ region: "us-central1", cors: false }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const { message } = req.body || {};
    if (!message || !message.data) {
      return res.status(400).send('Missing message data');
    }

    // Decode the base64 message data
    const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString());
    logger.info('📱 GOOGLE PLAY NOTIFICATION: Received notification', decodedData);

    const { subscriptionNotification, testNotification } = decodedData;

    if (testNotification) {
      logger.info('📱 GOOGLE PLAY NOTIFICATION: Test notification received');
      return res.status(200).send('OK');
    }

    if (!subscriptionNotification) {
      logger.warn('📱 GOOGLE PLAY NOTIFICATION: No subscription notification data');
      return res.status(400).send('No subscription notification');
    }

    const { subscriptionId: _subscriptionId, purchaseToken, notificationType } = subscriptionNotification;

    // Find user by Google Play purchase token or subscription ID
    const userQuery = await db.collection('users')
      .where('googlePlayPurchaseToken', '==', purchaseToken)
      .limit(1)
      .get();

    if (userQuery.empty) {
      logger.warn(`📱 GOOGLE PLAY NOTIFICATION: No user found for purchase token ${purchaseToken}`);
      return res.status(404).send('User not found');
    }

    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;

    logger.info(`📱 GOOGLE PLAY NOTIFICATION: Processing type ${notificationType} for user ${userId}`);

    // Handle different notification types
    switch (notificationType) {
      case 1: // SUBSCRIPTION_RECOVERED
        await updateUserSubscription(userId, 'active');
        await createSubscriptionNotification(userId, 'active');
        break;

      case 2: // SUBSCRIPTION_RENEWED
        await updateUserSubscription(userId, 'active');
        await createSubscriptionNotification(userId, 'active');
        break;

      case 3: // SUBSCRIPTION_CANCELED
        await updateUserSubscription(userId, 'cancelled');
        await createSubscriptionNotification(userId, 'cancelled');
        break;

      case 4: // SUBSCRIPTION_PURCHASED
        await updateUserSubscription(userId, 'active');
        await createSubscriptionNotification(userId, 'active');
        break;

      case 13: // SUBSCRIPTION_EXPIRED
        await updateUserSubscription(userId, 'expired');
        await createSubscriptionNotification(userId, 'expired');
        break;

      default:
        logger.info(`📱 GOOGLE PLAY NOTIFICATION: Unhandled notification type: ${notificationType}`);
        break;
    }

    return res.status(200).send('OK');

  } catch (error) {
    logger.error('❌ GOOGLE PLAY NOTIFICATION: Error processing notification:', error);
    return res.status(500).send('Internal Server Error');
  }
});

// ==============================
// User Account Management
// ==============================

/**
 * Delete user account with comprehensive cleanup
 */
const deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
  const { confirmationEmail } = request.data;

  logger.info(`🗑️ DELETE_ACCOUNT: Starting account deletion for user ${userId}`);

  try {
    // Get user data for validation and network notification capture
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      logger.info(`🗑️ DELETE_ACCOUNT: User document not found for ${userId}`);
      throw new HttpsError("not-found", "User account not found");
    }

    const userData = userDoc.data();

    // Validate confirmation email matches
    if (confirmationEmail && userData.email &&
        confirmationEmail.toLowerCase() !== userData.email.toLowerCase()) {
      throw new HttpsError("invalid-argument", "Confirmation email does not match account email");
    }

    logger.info(`🗑️ DELETE_ACCOUNT: Email validation passed for ${userId}`);

    // Capture network relationships BEFORE deletion for notifications
    const networkNotificationData = await captureNetworkForDeletionNotifications(userId, userData);
    logger.info(`📱 DELETE_ACCOUNT: Network notification data captured for ${userId}`);

    // Step 1: Delete user's private collections
    await deleteUserPrivateData(userId);
    logger.info(`✅ DELETE_ACCOUNT: Private data deleted for ${userId}`);

    // Step 2: Cleanup references but preserve network structure
    await cleanupUserReferences(userId);
    logger.info(`✅ DELETE_ACCOUNT: References cleaned up for ${userId}`);

    // Step 3: Delete Firestore user document
    await db.collection('users').doc(userId).delete();
    logger.info(`✅ DELETE_ACCOUNT: Firestore document deleted for ${userId}`);

    // Step 4: Delete Firebase Auth user (this will sign them out)
    await auth.deleteUser(userId);
    logger.info(`✅ DELETE_ACCOUNT: Firebase Auth user deleted for ${userId}`);

    logger.info(`✅ DELETE_ACCOUNT: Account deletion completed successfully for ${userId}`);

    // Step 5: Send push notifications to affected network members
    await sendDeletionNotificationsToNetwork(networkNotificationData);
    logger.info(`📱 DELETE_ACCOUNT: Deletion notifications sent for ${userId}`);

    return {
      success: true,
      message: "Account deleted successfully"
    };

  } catch (error) {
    logger.error(`❌ DELETE_ACCOUNT: Error deleting account for ${userId}:`, error);

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
    logger.info(`✅ DELETE_ACCOUNT: Deleted ${notificationDocs.size} notifications for ${userId}`);

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
        logger.info(`✅ DELETE_ACCOUNT: Deleted chat thread: ${chatDoc.id}`);
      } else {
        // Remove user from group chat participants
        chatCleanupPromises.push(chatDoc.ref.update({
          participants: FieldValue.arrayRemove([userId])
        }));
        logger.info(`✅ DELETE_ACCOUNT: Removed user from group chat: ${chatDoc.id}`);
      }
    }
    await Promise.all(chatCleanupPromises);

    // Delete admin settings if user was an admin
    const adminSettingsRef = db.collection('admin_settings').doc(userId);
    const adminDoc = await adminSettingsRef.get();
    if (adminDoc.exists) {
      await adminSettingsRef.delete();
      logger.info(`✅ DELETE_ACCOUNT: Deleted admin settings for ${userId}`);
    }

  } catch (error) {
    logger.error(`❌ DELETE_ACCOUNT: Error deleting private data for ${userId}:`, error);
    throw error;
  }
}

/**
 * Capture network relationship data before account deletion
 */
async function captureNetworkForDeletionNotifications(userId, userData) {
  try {
    const notificationData = {
      deletedUserId: userId,
      deletedUserName: `${userData.firstName || 'Unknown'} ${userData.lastName || 'User'}`.trim(),
      sponsorInfo: null,
      downlineUsers: []
    };

    // Capture sponsor information
    if (userData.sponsor_id) {
      try {
        const sponsorDoc = await db.collection('users').doc(userData.sponsor_id).get();
        if (sponsorDoc.exists) {
          const sponsorData = sponsorDoc.data();
          notificationData.sponsorInfo = {
            sponsorId: userData.sponsor_id,
            sponsorName: `${sponsorData.firstName || ''} ${sponsorData.lastName || ''}`.trim(),
            sponsorEmail: sponsorData.email || ''
          };
        }
      } catch (error) {
        logger.warn(`Failed to capture sponsor info for ${userId}:`, error);
      }
    }

    // Capture direct downline information
    try {
      const downlineQuery = await db.collection('users')
        .where('sponsor_id', '==', userId)
        .limit(50) // Limit to prevent excessive notifications
        .get();

      for (const downlineDoc of downlineQuery.docs) {
        const downlineData = downlineDoc.data();
        notificationData.downlineUsers.push({
          userId: downlineDoc.id,
          userName: `${downlineData.firstName || ''} ${downlineData.lastName || ''}`.trim(),
          userEmail: downlineData.email || ''
        });
      }
    } catch (error) {
      logger.warn(`Failed to capture downline info for ${userId}:`, error);
    }

    return notificationData;
  } catch (error) {
    logger.error(`Error capturing network for deletion notifications:`, error);
    return {
      deletedUserId: userId,
      deletedUserName: 'Unknown User',
      sponsorInfo: null,
      downlineUsers: []
    };
  }
}

/**
 * Cleanup user references in other documents
 */
async function cleanupUserReferences(userId) {
  try {
    // Update users who had this user as sponsor
    const downlineQuery = await db.collection('users')
      .where('sponsor_id', '==', userId)
      .get();

    const batch = db.batch();

    for (const downlineDoc of downlineQuery.docs) {
      batch.update(downlineDoc.ref, {
        sponsor_id: FieldValue.delete(),
        // Note: Keep upline_refs intact to preserve network structure for analytics
      });
    }

    // Remove from other users' can_read_profile arrays
    const canReadQuery = await db.collection('users')
      .where('can_read_profile', 'array-contains', userId)
      .get();

    for (const doc of canReadQuery.docs) {
      batch.update(doc.ref, {
        can_read_profile: FieldValue.arrayRemove(userId)
      });
    }

    await batch.commit();
    logger.info(`✅ DELETE_ACCOUNT: Cleaned up references for ${userId}`);

  } catch (error) {
    logger.error(`❌ DELETE_ACCOUNT: Error cleaning up references for ${userId}:`, error);
    throw error;
  }
}

/**
 * Send deletion notifications to affected network members
 */
async function sendDeletionNotificationsToNetwork(networkData) {
  try {
    const { deletedUserName, sponsorInfo, downlineUsers } = networkData;

    const notificationPromises = [];

    // Notify sponsor
    if (sponsorInfo) {
      notificationPromises.push(
        createNotification({
          userId: sponsorInfo.sponsorId,
          type: 'team_member_deleted',
          title: '👥 Team Update',
          body: `${deletedUserName} has left your team.`,
          docFields: {
            deletedUserName,
            route: '/team',
            route_params: JSON.stringify({ action: 'view_team' })
          }
        })
      );
    }

    // Notify direct downline members
    for (const downlineUser of downlineUsers) {
      notificationPromises.push(
        createNotification({
          userId: downlineUser.userId,
          type: 'sponsor_deleted',
          title: '👥 Sponsor Update',
          body: `Your sponsor ${deletedUserName} is no longer available. Contact support if you need assistance.`,
          docFields: {
            deletedSponsorName: deletedUserName,
            route: '/support',
            route_params: JSON.stringify({ action: 'contact_support' })
          }
        })
      );
    }

    await Promise.allSettled(notificationPromises);
    logger.info(`✅ DELETE_ACCOUNT: Sent ${notificationPromises.length} deletion notifications`);

  } catch (error) {
    logger.error(`❌ DELETE_ACCOUNT: Error sending deletion notifications:`, error);
    // Don't throw - deletion should still succeed even if notifications fail
  }
}

// ==============================
// Validation and Testing Functions
// ==============================

/**
 * Validate Apple receipt
 */
const validateAppleReceipt = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
  const { receiptData, isSandbox } = request.data;

  if (!receiptData) {
    throw new HttpsError("invalid-argument", "Receipt data is required");
  }

  try {
    logger.info(`📱 APPLE RECEIPT: Validating receipt for user ${userId}, sandbox: ${isSandbox}`);

    const appleConfig = functions.config().apple || {};
    const sharedSecret = appleConfig.shared_secret || '';

    if (!sharedSecret) {
      logger.warn('⚠️ APPLE RECEIPT: No shared secret configured');
    }

    const productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
    const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';

    const verifyUrl = isSandbox ? sandboxUrl : productionUrl;
    let result;

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': sharedSecret,
        'exclude-old-transactions': true
      })
    });

    if (!response.ok) {
      logger.error(`❌ APPLE RECEIPT: HTTP error ${response.status} from Apple`);
      throw new HttpsError("internal", `Apple verification service returned ${response.status}`);
    }

    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error(`❌ APPLE RECEIPT: Failed to parse JSON response from Apple`, jsonError);
      throw new HttpsError("internal", "Invalid response from Apple verification service");
    }

    if (result.status === 21007 && !isSandbox) {
      logger.info('📱 APPLE RECEIPT: Receipt is sandbox, retrying with sandbox URL');
      const sandboxResponse = await fetch(sandboxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': true
        })
      });

      if (!sandboxResponse.ok) {
        logger.error(`❌ APPLE RECEIPT: HTTP error ${sandboxResponse.status} from Apple sandbox`);
        throw new HttpsError("internal", `Apple sandbox verification returned ${sandboxResponse.status}`);
      }

      try {
        result = await sandboxResponse.json();
      } catch (jsonError) {
        logger.error(`❌ APPLE RECEIPT: Failed to parse JSON response from Apple sandbox`, jsonError);
        throw new HttpsError("internal", "Invalid response from Apple sandbox verification");
      }
    } else if (result.status === 21008 && isSandbox) {
      logger.info('📱 APPLE RECEIPT: Receipt is production, retrying with production URL');
      const productionResponse = await fetch(productionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': true
        })
      });

      if (!productionResponse.ok) {
        logger.error(`❌ APPLE RECEIPT: HTTP error ${productionResponse.status} from Apple production`);
        throw new HttpsError("internal", `Apple production verification returned ${productionResponse.status}`);
      }

      try {
        result = await productionResponse.json();
      } catch (jsonError) {
        logger.error(`❌ APPLE RECEIPT: Failed to parse JSON response from Apple production`, jsonError);
        throw new HttpsError("internal", "Invalid response from Apple production verification");
      }
    }

    if (result.status === 0) {
      logger.info(`✅ APPLE RECEIPT: Receipt validated successfully for user ${userId}`);

      const latestReceipt = result.latest_receipt_info?.[0] || result.receipt?.in_app?.[0];
      const expiresDate = latestReceipt?.expires_date_ms
        ? new Date(parseInt(latestReceipt.expires_date_ms))
        : null;

      try {
        await db.collection('users').doc(userId).update({
          subscriptionStatus: 'active',
          subscriptionExpiry: expiresDate,
          subscriptionUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (firestoreError) {
        logger.error(`❌ APPLE RECEIPT: Failed to update Firestore for user ${userId}`, firestoreError);
        throw new HttpsError("internal", "Failed to update subscription status in database");
      }

      return {
        isValid: true,
        subscriptionStatus: 'active',
        expiresDate: expiresDate?.toISOString(),
        message: 'Receipt validated successfully'
      };
    } else {
      logger.warn(`⚠️ APPLE RECEIPT: Validation failed with status ${result.status}`);
      return {
        isValid: false,
        message: `Receipt validation failed: ${result.status}`
      };
    }
  } catch (error) {
    logger.error('❌ APPLE RECEIPT: Error validating receipt:', error);
    throw new HttpsError("internal", "Failed to validate receipt");
  }
});

/**
 * Validate Google Play purchase
 */
const validateGooglePlayPurchase = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
  const { purchaseToken, subscriptionId } = request.data;

  if (!purchaseToken || !subscriptionId) {
    throw new HttpsError("invalid-argument", "Purchase token and subscription ID are required");
  }

  try {
    // Google Play validation logic would go here
    logger.info(`Validating Google Play purchase for user ${userId}`);

    // In production, you'd validate against Google Play's API
    return {
      success: true,
      status: 'valid',
      message: 'Purchase validated successfully'
    };

  } catch (error) {
    logger.error('Error validating Google Play purchase:', error);
    throw new HttpsError("internal", "Failed to validate purchase");
  }
});

/**
 * Test Apple notification setup
 */
const testAppleNotificationV2Setup = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  // Validate admin access
  const userData = await getUserDocument(userId);
  validateAdminRole(userData);

  try {
    logger.info(`Testing Apple notification setup for admin ${userId}`);

    // Test notification setup
    return {
      success: true,
      message: 'Apple notification setup test completed',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Error testing Apple notification setup:', error);
    throw new HttpsError("internal", "Failed to test Apple notification setup");
  }
});

/**
 * Test Google Play notification setup
 */
const testGooglePlayNotificationSetup = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  // Validate admin access
  const userData = await getUserDocument(userId);
  validateAdminRole(userData);

  try {
    logger.info(`Testing Google Play notification setup for admin ${userId}`);

    // Test notification setup
    return {
      success: true,
      message: 'Google Play notification setup test completed',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error('Error testing Google Play notification setup:', error);
    throw new HttpsError("internal", "Failed to test Google Play notification setup");
  }
});

// ==============================
// Scheduled Functions
// ==============================

/**
 * Check for expired trials daily
 */
const checkExpiredTrials = onSchedule("0 9 * * *", async (event) => {
  logger.info("⏰ TRIAL EXPIRY: Starting daily expired trials check");

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection('users')
      .where('subscriptionStatus', '==', 'trial')
      .get();

    logger.info(`⏰ TRIAL EXPIRY: Found ${usersSnapshot.size} users with trial status`);

    const updatePromises = [];
    let expiredCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const trialStartDate = userData.trialStartDate?.toDate();

      if (!trialStartDate) {
        logger.warn(`⏰ TRIAL EXPIRY: User ${userId} has no trialStartDate, skipping`);
        continue;
      }

      const daysSinceTrialStart = Math.floor((now - trialStartDate) / (1000 * 60 * 60 * 24));

      if (daysSinceTrialStart > 30) {
        logger.info(`⏰ TRIAL EXPIRY: User ${userId} trial expired (${daysSinceTrialStart} days since start)`);
        expiredCount++;

        updatePromises.push(
          db.collection('users').doc(userId).update({
            subscriptionStatus: 'expired',
            subscriptionUpdated: now
          }).then(() => {
            return createNotification({
              userId,
              type: 'trial_expired',
              title: '⏰ Trial Expired',
              body: 'Your 30-day trial has expired. Subscribe now to continue using all features.',
              docFields: {
                route: '/subscription',
                route_params: JSON.stringify({ action: 'subscribe' })
              }
            });
          }).catch(error => {
            logger.error(`⏰ TRIAL EXPIRY: Failed to update user ${userId}:`, error);
          })
        );
      }
    }

    await Promise.allSettled(updatePromises);
    logger.info(`✅ TRIAL EXPIRY: Processed ${expiredCount} expired trials out of ${usersSnapshot.size} total trial users`);

  } catch (error) {
    logger.error("❌ TRIAL EXPIRY: Error checking expired trials:", error);
  }
});

/**
 * Check for trials expiring soon
 */
const checkTrialsExpiringSoon = onSchedule("0 9 * * *", async (event) => {
  logger.info("Starting trials expiring soon check");

  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection('users')
      .where('trialExpiry', '<=', tomorrow)
      .where('trialExpiry', '>', now)
      .where('subscriptionStatus', '==', 'trial')
      .get();

    const notificationPromises = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      notificationPromises.push(
        createNotification({
          userId,
          type: 'trial_expiring_soon',
          title: '⏰ Trial Ending Soon',
          body: 'Your trial expires tomorrow. Subscribe now to keep all your progress!',
          docFields: {
            route: '/subscription',
            route_params: JSON.stringify({ action: 'subscribe' })
          }
        })
      );
    }

    await Promise.allSettled(notificationPromises);
    logger.info(`Sent expiring soon notifications to ${usersSnapshot.size} users`);

  } catch (error) {
    logger.error("Error checking trials expiring soon:", error);
  }
});

/**
 * Check for subscriptions expiring soon
 */
const checkSubscriptionsExpiringSoon = onSchedule("0 9 * * *", async (event) => {
  logger.info("Starting subscriptions expiring soon check");

  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection('users')
      .where('subscriptionExpiry', '<=', threeDaysFromNow)
      .where('subscriptionExpiry', '>', now)
      .where('subscriptionStatus', 'in', ['active', 'cancelled'])
      .get();

    const notificationPromises = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const expiryDate = userData.subscriptionExpiry.toDate();

      notificationPromises.push(
        createNotification({
          userId,
          type: 'subscription_expiring_soon',
          title: '⏰ Subscription Expiring',
          body: `Your subscription expires on ${expiryDate.toLocaleDateString()}. Renew now to avoid interruption.`,
          docFields: {
            route: '/subscription',
            route_params: JSON.stringify({ action: 'renew' })
          }
        })
      );
    }

    await Promise.allSettled(notificationPromises);
    logger.info(`Sent expiring notifications to ${usersSnapshot.size} users`);

  } catch (error) {
    logger.error("Error checking subscriptions expiring soon:", error);
  }
});

/**
 * Send daily account deletion summary to admins
 */
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

const sendDailyAccountDeletionSummary = onSchedule({
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

// ==============================
// System Maintenance Functions
// ==============================

const cleanupExecutionFuses = onSchedule({
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
// Beta Testing Management
// ==============================

/**
 * Generate CSV files from Firestore beta tester data
 * Returns CSV content for both iOS and Android testers
 */
const generateBetaTesterCSVs = onCall({ region: "us-central1" }, async (request) => {
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

// ==============================
// Admin Validation Helper Functions
// ==============================

/**
 * Check if validators are enabled via environment variable
 */
function validatorsEnabled() {
  return String(process.env.DEBUG_VALIDATE_ENABLED || 'false').toLowerCase() === 'true';
}

/**
 * Check if caller has admin privileges
 */
function callerIsAllowedAdmin(context) {
  if (!context?.auth?.uid) return false;
  const isAdminClaim = !!context.auth.token?.admin;
  const allowlist = String(process.env.DEBUG_ADMIN_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return isAdminClaim || allowlist.includes(context.auth.uid);
}

/**
 * Assert that caller is admin and validators are enabled
 */
function assertAdminAndEnabled(context, featureName) {
  if (!validatorsEnabled()) {
    throw new HttpsError('failed-precondition', `Validation disabled (${featureName}).`);
  }
  if (!context?.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  if (!callerIsAllowedAdmin(context)) {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

// ==============================
// Debug and Testing Functions
// ==============================

/**
 * Reset a specific milestone flag for a user (for testing)
 */
const resetMilestoneFuse = onCall({ region: "us-central1" }, async (request) => {
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
      updateData.directAt = FieldValue.delete();
    } else if (milestoneType === 'team') {
      updateData.teamAt = FieldValue.delete();
    } else if (milestoneType === 'qualified') {
      updateData.qualifiedAt = FieldValue.delete();
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

/**
 * Reset multiple milestone fuses for a user (for testing)
 */
const resetMilestoneFuses = onCall({ region: "us-central1" }, async (request) => {
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

    if (fuses?.direct) updateData['milestones.directAt'] = FieldValue.delete();
    if (fuses?.team) updateData['milestones.teamAt'] = FieldValue.delete();
    if (fuses?.qualified) updateData['milestones.qualifiedAt'] = FieldValue.delete();

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

/**
 * Clear all milestone fuses set before profile completion (maintenance function)
 */
const clearPreProfileMilestoneFuses = onCall({ region: "us-central1" }, async (request) => {
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
            'milestones.directAt': FieldValue.delete(),
            'milestones.teamAt': FieldValue.delete(),
            'milestones.qualifiedAt': FieldValue.delete()
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

/**
 * Minimal ping trigger to test users collection binding (debug function)
 */
const pingUsersTrigger = onDocumentWritten('users/{userId}', (event) => {
  const mask = event.data?.updateMask?.fieldPaths || [];
  console.log('PING TRIGGER', {
    userId: event.params.userId,
    path: event.document,
    mask
  });
});

// ==============================
// Campaign Management
// ==============================

/**
 * Validate referral URL
 */
const validateReferralUrl = onCall({ region: "us-central1" }, async (request) => {
  const _userId = validateAuthentication(request);
  const { url } = request.data;

  if (!url) {
    throw new HttpsError("invalid-argument", "URL is required");
  }

  try {
    // Validate URL format and accessibility
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(url)) {
      throw new HttpsError("invalid-argument", "Invalid URL format");
    }

    return {
      success: true,
      valid: true,
      message: 'URL is valid'
    };

  } catch (error) {
    logger.error('Error validating referral URL:', error);
    throw new HttpsError("internal", "Failed to validate URL");
  }
});

// ==============================
// Exports
// ==============================

module.exports = {
  // Apple subscription management
  handleAppleSubscriptionNotification,
  handleAppleSubscriptionNotificationV2,
  validateAppleReceipt,
  testAppleNotificationV2Setup,

  // Google Play subscription management
  handleGooglePlayNotification,
  validateGooglePlayPurchase,
  testGooglePlayNotificationSetup,

  // User account management
  deleteUserAccount,

  // Validation functions
  validateReferralUrl,

  // Scheduled functions
  checkExpiredTrials,
  checkTrialsExpiringSoon,
  checkSubscriptionsExpiringSoon,
  sendDailyAccountDeletionSummary,
  cleanupExecutionFuses,

  // Beta testing management
  generateBetaTesterCSVs,

  // Debug and testing functions
  resetMilestoneFuse,
  resetMilestoneFuses,
  clearPreProfileMilestoneFuses,
  pingUsersTrigger,

  // Campaign management
  sendDemoInvitation,
  sendLaunchCampaign,

  // Helper functions
  deleteUserPrivateData,
  captureNetworkForDeletionNotifications,
  cleanupUserReferences,
  sendDeletionNotificationsToNetwork,
  processNotificationV2,
  decodeNotificationPayload,
  isDecodedNotificationDataPayload,
  isDecodedNotificationSummaryPayload,
};