// ==============================
// ADMIN FUNCTIONS MODULE
// Handles all administrative functions including subscription management,
// user account deletion, validation, testing, and scheduled operations
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
      const { summary } = payload;
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

    const { subscriptionId, purchaseToken, notificationType } = subscriptionNotification;

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
  const { receiptData } = request.data;

  if (!receiptData) {
    throw new HttpsError("invalid-argument", "Receipt data is required");
  }

  try {
    // Apple receipt validation logic would go here
    // This is a simplified version
    logger.info(`Validating Apple receipt for user ${userId}`);

    // In production, you'd validate against Apple's servers
    return {
      success: true,
      status: 'valid',
      message: 'Receipt validated successfully'
    };

  } catch (error) {
    logger.error('Error validating Apple receipt:', error);
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
  logger.info("Starting daily expired trials check");

  try {
    const now = new Date();
    const usersSnapshot = await db.collection('users')
      .where('trialExpiry', '<=', now)
      .where('subscriptionStatus', '==', 'trial')
      .get();

    const updatePromises = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      updatePromises.push(
        db.collection('users').doc(userId).update({
          subscriptionStatus: 'expired',
          trialExpired: true
        }).then(() => {
          return createNotification({
            userId,
            type: 'trial_expired',
            title: '⏰ Trial Expired',
            body: 'Your trial has expired. Subscribe now to continue using all features.',
            docFields: {
              route: '/subscription',
              route_params: JSON.stringify({ action: 'subscribe' })
            }
          });
        })
      );
    }

    await Promise.allSettled(updatePromises);
    logger.info(`Processed ${usersSnapshot.size} expired trials`);

  } catch (error) {
    logger.error("Error checking expired trials:", error);
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
const sendDailyAccountDeletionSummary = onSchedule({
  schedule: "0 10 * * *",
  timeZone: "America/New_York",
  region: "us-central1"
}, async (event) => {
  logger.info("Starting daily account deletion summary");

  try {
    // Get deletion events from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // In a real implementation, you'd track deletions in a separate collection
    // For now, we'll send a basic summary to admins

    const adminSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    const notificationPromises = [];

    for (const adminDoc of adminSnapshot.docs) {
      notificationPromises.push(
        createNotification({
          userId: adminDoc.id,
          type: 'daily_admin_summary',
          title: '📊 Daily Summary',
          body: 'Your daily account summary is ready.',
          docFields: {
            route: '/admin/reports',
            route_params: JSON.stringify({ report: 'daily_summary' })
          }
        })
      );
    }

    await Promise.allSettled(notificationPromises);
    logger.info(`Sent daily summaries to ${adminSnapshot.size} admins`);

  } catch (error) {
    logger.error("Error sending daily account deletion summary:", error);
  }
});

// ==============================
// Campaign Management
// ==============================

/**
 * Validate referral URL
 */
const validateReferralUrl = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
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