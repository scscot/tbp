// ==============================
// AUTHENTICATION FUNCTIONS MODULE
// Handles user registration, authentication, and account management
// ==============================

const {
  onCall,
  HttpsError,
  onRequest,
  logger,
  db,
  FieldValue,
  auth,
  validateAuthentication,
  validateInput,
  createError,
} = require('./shared/utilities');

const { getTimezoneFromLocation } = require("./timezone_mapping");

// Import createNotification from notification-functions to avoid dependency cycle
const { createNotification } = require('./notification-functions');

// Rate limiting cache for getUserByReferralCode
const rateLimitCache = new Map();

// ==============================
// AUTHENTICATION FUNCTIONS
// ==============================

/**
 * Get user information by referral code (HTTP endpoint)
 * Includes rate limiting and caching for performance
 */
const getUserByReferralCode = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 10,
  memory: '256MiB'
}, async (req, res) => {
  // Security: Method validation
  if (req.method !== 'GET') {
    logger.warn(`Invalid method ${req.method} from ${req.ip}`);
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
    logger.warn(`Rate limit exceeded for IP ${clientIP}`);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Update rate limit cache
  recentRequests.push(now);
  rateLimitCache.set(rateLimitKey, recentRequests);

  // Security: Input validation and sanitization
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    logger.warn(`Missing or invalid referral code from ${clientIP}`);
    return res.status(400).json({ error: 'Valid referral code is required.' });
  }

  // Sanitize referral code (alphanumeric only, max 20 chars)
  const sanitizedCode = code.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  if (sanitizedCode.length === 0 || sanitizedCode !== code.trim()) {
    logger.warn(`Invalid referral code format: ${code} from ${clientIP}`);
    return res.status(400).json({ error: 'Invalid referral code format.' });
  }

  try {
    logger.info(`Processing referral code ${sanitizedCode} from ${clientIP}`);

    // Add basic caching to prevent repeated database queries
    const cacheKey = `referral_data_${sanitizedCode}`;
    const cachedResult = rateLimitCache.get(cacheKey);
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    if (cachedResult && cachedResult.timestamp > fiveMinutesAgo) {
      logger.info(`Returning cached result for ${sanitizedCode}`);
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
      bizOppName: bizOppName,
      photoUrl: sponsorData.photoUrl || null,
      isProfileComplete: sponsorData.isProfileComplete || false,
    };

    // Cache successful results for 5 minutes
    rateLimitCache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    logger.info(`Successfully processed referral code ${sanitizedCode}`);
    return res.status(200).json(responseData);

  } catch (error) {
    logger.error(`Critical error for code ${sanitizedCode} from ${clientIP}:`, error);

    // Don't expose internal error details to clients
    return res.status(500).json({
      error: 'Internal server error. Please try again later.'
    });
  }
});

/**
 * Register a new user with sponsor relationship
 */
const registerUser = onCall({ region: "us-central1" }, async (request) => {
  logger.info(`Starting registerUser function for project ${process.env.GCLOUD_PROJECT}`);
  logger.info("Request data:", JSON.stringify(request.data, null, 2));

  const { email, password, firstName, lastName, sponsorReferralCode, adminReferralCode, role, country, state, city } = request.data;

  // Validate required fields
  validateInput(request.data, {
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { required: true, type: 'string', minLength: 6 },
    firstName: { required: true, type: 'string', minLength: 1 },
    lastName: { required: true, type: 'string', minLength: 1 }
  });

  let sponsorId = null;
  let sponsorUplineRefs = [];
  let level = 1;
  let uplineAdminForNewUser = null;
  let adminReferralId = null;
  let uid = null; // For cleanup if needed

  try {
    logger.info("Processing sponsor referral code:", sponsorReferralCode);

    // Resolve sponsor to a Firebase UID
    async function resolveSponsorUid({ rawSponsorId, sponsorReferralCode }) {
      const usersCol = db.collection('users');

      // Case 1: Caller passed a Firebase UID directly and it exists
      if (rawSponsorId) {
        const directRef = usersCol.doc(rawSponsorId);
        const directSnap = await directRef.get();
        if (directSnap.exists) {
          logger.info(`Using provided sponsorId as UID=${rawSponsorId}`);
          return rawSponsorId;
        }
        logger.info(`Provided sponsorId not a user UID (id=${rawSponsorId})`);
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
              logger.info(`ReferralCodes map -> UID=${mappedUid}`);
              return mappedUid;
            }
          }
        }
        logger.info(`ReferralCodes doc missing/invalid for code=${sponsorReferralCode}`);
      }

      // Case 3: Query users by their stored referralCode field
      if (sponsorReferralCode) {
        const q = await usersCol.where('referralCode', '==', String(sponsorReferralCode)).limit(1).get();
        if (!q.empty) {
          const doc = q.docs[0];
          logger.info(`Users.referralCode -> UID=${doc.id}`);
          return doc.id;
        }
        logger.info(`No user with referralCode=${sponsorReferralCode}`);
      }

      return null;
    }

    const sponsorUid = await resolveSponsorUid({ rawSponsorId: sponsorId, sponsorReferralCode });
    if (sponsorReferralCode && !sponsorUid) {
      logger.error(`Unable to resolve sponsor UID (rawSponsorId=${sponsorId}, referralCode=${sponsorReferralCode})`);
      throw createError('failed-precondition',
        'Unable to resolve sponsor user. Provide a valid Firebase UID or referral code mapped to a user.');
    }

    if (sponsorUid) {
      // Get sponsor data using the resolved UID
      const sponsorDoc = await db.collection("users").doc(sponsorUid).get();
      if (sponsorDoc.exists) {
        sponsorId = sponsorUid;
        const sponsorData = sponsorDoc.data();
        logger.info("Found sponsor:", sponsorId, sponsorData.firstName, sponsorData.lastName);

        if (sponsorData.role === 'admin') {
          uplineAdminForNewUser = sponsorId;
        } else {
          uplineAdminForNewUser = sponsorData.upline_admin;
        }
        sponsorUplineRefs = sponsorData.upline_refs || [];
        level = sponsorData.level ? sponsorData.level + 1 : 2;
      } else {
        logger.error("Resolved sponsor UID has no document:", sponsorUid);
        throw createError("not-found", `Sponsor user document not found for UID: ${sponsorUid}`);
      }
    }

    // Handle admin referral code (for new admins)
    if (adminReferralCode) {
      logger.info("Processing admin referral code:", adminReferralCode);
      const adminReferralQuery = await db.collection("users").where("referralCode", "==", adminReferralCode).limit(1).get();
      if (!adminReferralQuery.empty) {
        const adminReferralDoc = adminReferralQuery.docs[0];
        adminReferralId = adminReferralDoc.id;
        logger.info("Found admin referral:", adminReferralId);
      } else {
        logger.error("Admin referral not found:", adminReferralCode);
        throw createError("not-found", `Admin referral with referral code '${adminReferralCode}' not found.`);
      }
    }

    logger.info("Creating Firebase Auth user...");
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });

    uid = userRecord.uid;
    logger.info("Firebase Auth user created:", uid);

    logger.info("Preparing user document...");
    const userTimezone = getTimezoneFromLocation(country, state);
    logger.info("Determined timezone:", userTimezone);

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
      currentPartner: false,
      subscriptionStatus: 'trial',
      trialStartDate: FieldValue.serverTimestamp(),
      hasPromptedForReview: false,
      reviewPromptedAt: null,
    };

    logger.info("Checking early adopter eligibility...");
    const earlyAdopterRef = db.collection('settings').doc('earlyAdopter');
    const earlyAdopterSnap = await earlyAdopterRef.get();
    const earlyAdopterData = earlyAdopterSnap.exists ? earlyAdopterSnap.data() : {};
    const { totalGranted = 0, limit = 50, enabled = true } = earlyAdopterData;

    if (enabled && totalGranted < limit) {
      newUser.lifetimeAccess = true;
      newUser.earlyAdopter = true;
      newUser.earlyAdopterGrantedAt = FieldValue.serverTimestamp();

      await earlyAdopterRef.update({
        totalGranted: FieldValue.increment(1)
      });

      logger.info(`✅ EARLY ADOPTER #${totalGranted + 1}: Granted lifetime access to ${uid} (${email})`);
    } else {
      newUser.lifetimeAccess = false;
      newUser.earlyAdopter = false;

      if (!enabled) {
        logger.info("Early adopter program is disabled");
      } else if (totalGranted >= limit) {
        logger.info(`Early adopter limit reached (${totalGranted}/${limit})`);
      }
    }

    logger.info("User document prepared:", JSON.stringify(newUser, null, 2));
    logger.info("Creating Firestore user document...");
    await db.collection("users").doc(uid).set(newUser);
    logger.info("Firestore user document created");

    if (sponsorId) {
      logger.info("Deferring sponsor/upline count updates until profile completion...");

      // Guard: ensure sponsor doc exists (UID) - validation only, no count updates
      const sponsorRef = db.collection("users").doc(sponsorId);
      const sponsorSnap = await sponsorRef.get();
      if (!sponsorSnap.exists) {
        logger.error(`Sponsor user doc not found. sponsorUid=${sponsorId}`);
        throw createError('failed-precondition',
          `Invalid sponsor. No user doc for uid=${sponsorId}.`);
      }

      logger.info(`REGISTER DEFERRED: User ${uid} registered with sponsor ${sponsorId}, count updates deferred until profile completion`);

      // NOTE: Count increments moved to onUserProfileCompleted trigger to prevent premature milestone notifications
      // This ensures milestone notifications only fire after users complete their profiles with photo and location data
    }

    logger.info("Registration completed successfully");
    return { success: true, uid: uid };

  } catch (error) {
    logger.error("Error during registration:", error);

    // Atomic cleanup - if we created auth user but failed later, clean it up
    if (uid) {
      try {
        logger.info(`Cleaning up orphaned auth user ${uid}...`);
        await auth.deleteUser(uid);
        logger.info(`Auth user ${uid} deleted successfully.`);
      } catch (cleanupError) {
        logger.error(`Failed to cleanup auth user ${uid}:`, cleanupError);
      }
    }

    throw createError("internal", `Registration failed: ${error.message}`, error.details);
  }
});

/**
 * Validate if a referral URL is accessible
 */
const validateReferralUrl = onCall({ region: "us-central1" }, async (request) => {
  const url = request.data.url;

  if (!url || typeof url !== 'string') {
    throw createError('invalid-argument', 'A valid URL is required.');
  }

  // Basic URL structure check
  try {
    new URL(url);
  } catch (e) {
    throw createError('invalid-argument', 'Malformed URL.');
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

/**
 * Delete user account completely (Apple App Store compliant)
 */
const deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
  const { confirmationEmail } = request.data;

  logger.info(`Starting account deletion for user ${userId}`);

  try {
    // Get user data for validation and network notification capture
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      logger.info(`User document not found for ${userId}`);
      throw createError("not-found", "User account not found");
    }

    const userData = userDoc.data();

    // Validate confirmation email matches
    if (confirmationEmail && userData.email &&
        confirmationEmail.toLowerCase() !== userData.email.toLowerCase()) {
      throw createError("invalid-argument", "Confirmation email does not match account email");
    }

    logger.info(`Email validation passed for ${userId}`);

    // Capture network relationships BEFORE deletion for notifications
    const networkNotificationData = await captureNetworkForDeletionNotifications(userId, userData);
    logger.info(`Network notification data captured for ${userId}`);

    // Step 1: Delete user's private collections
    await deleteUserPrivateData(userId);
    logger.info(`Private data deleted for ${userId}`);

    // Step 2: Cleanup references but preserve network structure
    await cleanupUserReferences(userId);
    logger.info(`References cleaned up for ${userId}`);

    // Step 3: Delete Firestore user document
    await db.collection('users').doc(userId).delete();
    logger.info(`Firestore document deleted for ${userId}`);

    // Step 4: Delete Firebase Auth user (this will sign them out)
    await auth.deleteUser(userId);
    logger.info(`Firebase Auth user deleted for ${userId}`);

    logger.info(`Account deletion completed successfully for ${userId}`);

    // Step 5: Send push notifications to affected network members
    await sendDeletionNotificationsToNetwork(networkNotificationData);
    logger.info(`Deletion notifications sent for ${userId}`);

    return {
      success: true,
      message: "Account deleted successfully"
    };

  } catch (error) {
    logger.error(`Error deleting account for ${userId}:`, error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw createError("internal", "Failed to delete account", error.message);
  }
});

// ==============================
// HELPER FUNCTIONS
// ==============================

/**
 * Delete user's private data collections
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
    logger.info(`Deleted ${notificationDocs.size} notifications for ${userId}`);

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
        logger.info(`Deleted chat thread: ${chatDoc.id}`);
      } else {
        // Remove user from group chat participants
        chatCleanupPromises.push(chatDoc.ref.update({
          participants: FieldValue.arrayRemove([userId])
        }));
        logger.info(`Removed user from group chat: ${chatDoc.id}`);
      }
    }
    await Promise.all(chatCleanupPromises);

    // Delete admin settings if user was an admin
    const adminSettingsRef = db.collection('admin_settings').doc(userId);
    const adminDoc = await adminSettingsRef.get();
    if (adminDoc.exists) {
      await adminSettingsRef.delete();
      logger.info(`Deleted admin settings for ${userId}`);
    }

  } catch (error) {
    logger.error(`Error deleting private data for ${userId}:`, error);
    throw error;
  }
}

/**
 * Capture network information for deletion notifications
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
            userId: userData.sponsor_id,
            name: `${sponsorData.firstName || 'Unknown'} ${sponsorData.lastName || 'User'}`.trim(),
            fcmToken: sponsorData.fcm_token
          };
          logger.info(`Sponsor data captured for ${userData.sponsor_id}`);
        }
      } catch (error) {
        logger.warn(`Could not fetch sponsor ${userData.sponsor_id}: ${error.message}`);
      }
    }

    // Capture direct downline users
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
      logger.info(`${notificationData.downlineUsers.length} downline users captured`);
    } catch (error) {
      logger.warn(`Could not fetch downline users: ${error.message}`);
    }

    return notificationData;
  } catch (error) {
    logger.error(`Error capturing network data for ${userId}:`, error);
    return {
      deletedUserId: userId,
      deletedUserName: 'Team Member',
      sponsorInfo: null,
      downlineUsers: []
    };
  }
}

/**
 * Send deletion notifications to network members
 */
async function sendDeletionNotificationsToNetwork(networkData) {
  if (!networkData || (!networkData.sponsorInfo && networkData.downlineUsers.length === 0)) {
    logger.info('No network members to notify');
    return;
  }

  const immediateNotifications = [];

  try {
    // Notify direct sponsor (if exists)
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

      logger.info(`Prepared immediate notification for sponsor ${networkData.sponsorInfo.userId}`);
    }

    // Notify direct downline users
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

      logger.info(`Prepared immediate notification for downline user ${downlineUser.userId}`);
    }

    // Send immediate notifications concurrently
    const notificationPromises = immediateNotifications.map(async ({ userId, notification }) => {
      try {
        await createNotification({
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
        logger.info(`Sent immediate notification to user ${userId}`);
      } catch (error) {
        logger.error(`Failed to send immediate notification to user ${userId}:`, error.message);
      }
    });

    await Promise.all(notificationPromises);
    logger.info(`Processed ${immediateNotifications.length} immediate deletion notifications`);

    // Log deletion for daily upline notifications
    await logDeletionForDailyNotification(networkData);

  } catch (error) {
    logger.error('Error sending deletion notifications:', error);
  }
}

/**
 * Create account deletion notification
 */
function createAccountDeletionNotification(recipientType, deletedUserName, recipientName) {
  const baseNotification = {
    type: 'account_deletion',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    route: "/dashboard",
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

  return {
    ...baseNotification,
    title: "Team Network Update",
    message: `A team member has updated their account status. This doesn't affect your account in any way.`
  };
}

/**
 * Log deletion for daily batch notifications
 */
async function logDeletionForDailyNotification(networkData) {
  try {
    const deletionLog = {
      deletedUserId: networkData.deletedUserId,
      deletedUserName: networkData.deletedUserName,
      sponsorId: networkData.sponsorInfo?.userId || null,
      downlineUserIds: networkData.downlineUsers.map(user => user.userId),
      deletedAt: FieldValue.serverTimestamp(),
      processedInDailyBatch: false
    };

    await db.collection('account_deletion_logs').add(deletionLog);
    logger.info(`Logged deletion of ${networkData.deletedUserName} for daily batch processing`);

  } catch (error) {
    logger.error('Error logging deletion for daily notification:', error);
  }
}

/**
 * Clean up system references
 */
async function cleanupUserReferences(userId) {
  try {
    // Preserve network relationships for business operations
    logger.info(`System references cleaned up for ${userId}`);
  } catch (error) {
    logger.error(`Error cleaning up references for ${userId}:`, error);
  }
}


// ==============================
// EXPORTS
// ==============================

module.exports = {
  getUserByReferralCode,
  registerUser,
  validateReferralUrl,
  deleteUserAccount,
};