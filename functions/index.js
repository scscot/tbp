const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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

exports.getTeam = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;

  try {
    const teamSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (teamSnapshot.empty) {
      return { downline: [] }; // Keep API response key for backward compatibility
    }

    const teamUsers = teamSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    const serializedTeam = serializeData(teamUsers);
    return { downline: serializedTeam }; // Keep API response key for backward compatibility

  } catch (error) {
    console.error("Critical Error in getTeam function:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching the team.", error.message);
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
    const uid = userRecord.uid;
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
    
    // If we created the auth user but failed to create the Firestore document, clean up
    if (error.message && error.message.includes("auth/")) {
      console.log("🔍 REGISTER FUNCTION: Auth error, no cleanup needed");
    } else {
      console.log("🔍 REGISTER FUNCTION: Non-auth error, may need to clean up auth user");
    }
    
    throw new HttpsError("internal", `Registration failed: ${error.message}`, error.details);
  }
});

exports.getTeamCounts = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;
  try {
    const teamSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (teamSnapshot.empty) {
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

    teamSnapshot.docs.forEach(doc => {
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
        all: teamSnapshot.size,
        last24: last24Count,
        last7: last7Count,
        last30: last30Count,
        newQualified: newQualifiedCount,
        joinedOpportunity: joinedOpportunityCount,
      }
    };
  } catch (error) {
    console.error(`CRITICAL ERROR in getTeamCounts for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getFilteredTeam = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const currentUserId = request.auth.uid;
  const { filter, searchQuery, levelOffset, limit = 100, offset = 0 } = request.data || {};

  try {
    console.log(`🔍 FILTER DEBUG: Starting filtered team for user ${currentUserId}`);
    console.log(`🔍 FILTER DEBUG: Params - filter: ${filter}, searchQuery: "${searchQuery}", levelOffset: ${levelOffset}`);

    // Get base team
    const teamSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (teamSnapshot.empty) {
      return {
        downline: [], // Keep API response key for backward compatibility
        totalCount: 0,
        hasMore: false
      };
    }

    let filteredUsers = [];
    const now = new Date();

    // Apply time-based and status filters
    teamSnapshot.docs.forEach(doc => {
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
      downline: serializeData(paginatedUsers), // Keep API response key for backward compatibility
      groupedByLevel: levelOffset !== undefined ? serializeData(groupedByLevel) : null,
      totalCount,
      hasMore,
      offset,
      limit
    };

  } catch (error) {
    console.error(`CRITICAL ERROR in getFilteredTeam for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching filtered team.", error.message);
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

    // Count unread notifications to set correct badge number
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();
    
    const badgeCount = unreadNotificationsSnapshot.size;
    console.log(`🔔 PUSH DEBUG: Unread notifications count: ${badgeCount}`);

    const imageUrl = notificationData?.imageUrl;

    // Build APNS payload, always including the correct badge count
    const apnsPayload = {
      alert: {
        title: notificationData?.title || "New Notification",
        body: notificationData?.message || "You have a new message.",
      },
      sound: "default",
      badge: badgeCount, // Always set the badge. APNS correctly handles 0 by clearing the badge.
    };

    console.log(`🔔 PUSH DEBUG: Setting badge count to: ${badgeCount} ${badgeCount === 0 ? '(will clear badge)' : '(will show badge)'}`);


    const message ={ 
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
          aps: apnsPayload,
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
      message: `${messageText} CLICK HERE to REPLY.`,
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

  // Check if photoUrl was added for the first time
  const beforePhotoUrl = beforeData.photoUrl;
  const afterPhotoUrl = afterData.photoUrl;

  if ((beforePhotoUrl && beforePhotoUrl !== "") || !afterPhotoUrl || afterPhotoUrl === "") {
    console.log(`🔔 SPONSORSHIP DEBUG: photoUrl not added for the first time for user ${newUserId}. Skipping notification.`);
    return;
  }

  console.log(`🔔 SPONSORSHIP DEBUG: photoUrl added for the first time for user ${newUserId}`);

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
        title: "🎉 You have a new Team Member!",
        message: `Congratulations, ${sponsor.firstName}! You shared the Team Build Pro App with your current ${bizOppName} downline member, ${afterData.firstName} ${afterData.lastName} from ${newUserLocation} and they have just downloaded and installed the Team Build Pro app! This means any of their Team Build Pro team members that ultimately join ${bizOppName} will automatically be placed in your ${bizOppName} organization! VIEW PROFILE`,
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
        title: "🎉 You have a new Team Member!",
        message: `Congratulations, ${sponsor.firstName}! You sponsored ${afterData.firstName} ${afterData.lastName} from ${newUserLocation}. VIEW PROFILE`,
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
        message: `Congratulations, ${afterData.firstName}! You are now qualified to join ${bizName}. LEARN MORE!`,
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
      title: `🎉 New ${bizOpp} visit!`,
      message: `${visitingUserName} has just used your referral link to check out ${bizOpp}! Introduce yourself and answer any questions they might have. VIEW PROFILE`,
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
    console.log(`🔔 CLEAR BADGE: Starting badge clear process for user ${userId}`);

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error(`🔔 CLEAR BADGE: User document for ${userId} does not exist.`);
      return { success: false, message: "User not found" };
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    if (!fcmToken) {
      console.log(`🔔 CLEAR BADGE: Missing FCM token for user ${userId}. Cannot clear badge.`);
      return { success: false, message: "No FCM token found" };
    }

    console.log(`🔔 CLEAR BADGE: FCM token found: ${fcmToken.substring(0, 20)}...`);

    // Count unread notifications to verify badge should be cleared
    const unreadNotificationsSnapshot = await db.collection("users")
      .doc(userId)
      .collection("notifications")
      .where("read", "==", false)
      .get();
    
    const badgeCount = unreadNotificationsSnapshot.size;
    console.log(`🔔 CLEAR BADGE: Current unread notifications count: ${badgeCount}`);

    // Only send clear badge message if there are actually 0 unread notifications
    if (badgeCount === 0) {
      const message = {
        token: fcmToken,
        apns: {
          payload: {
            aps: {
              badge: 0, // Explicitly set to 0 to clear the badge
            },
          },
        },
        android: {
          // Android doesn't need badge clearing
        },
      };

      console.log(`🔔 CLEAR BADGE: Sending badge clear message`);
      const response = await messaging.send(message);
      console.log(`✅ CLEAR BADGE: Badge cleared successfully for user ${userId}`);
      console.log(`✅ CLEAR BADGE: FCM Response:`, response);

      return { success: true, message: "Badge cleared successfully" };
    } else {
      console.log(`🔔 CLEAR BADGE: User has ${badgeCount} unread notifications, not clearing badge`);
      return { success: false, message: `User has ${badgeCount} unread notifications` };
    }

  } catch (error) {
    console.error(`❌ CLEAR BADGE: Failed to clear badge for user ${userId}:`, error);
    return { success: false, message: error.message };
  }
});


// ============================================================================
// DAILY TEAM GROWTH NOTIFICATIONS
// ============================================================================

/**
 * Scheduled function that runs every hour to send daily team growth notifications
 * at 12 noon local time to users who had new team members join the previous day.
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
          title: "Your Team Is Growing!",
          message: `Congratulations, ${userData.firstName}! ${newMemberCount} new member${newMemberCount > 1 ? 's' : ''} joined your Team Build Pro team yesterday. VIEW PROFILES!`,
          createdAt: FieldValue.serverTimestamp(),
          read: false,
          type: "new_team_members",
          route: "/team",
          route_params: JSON.stringify({ filter: "newMembers" }),
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
