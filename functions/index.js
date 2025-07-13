const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, DocumentReference } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");
const cors = require("cors")({ origin: true });
const { getRemoteConfig } = require("firebase-admin/remote-config");

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

exports.getDownline = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;

  try {
    const downlineSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (downlineSnapshot.empty) {
      return { downline: [] };
    }

    const downlineUsers = downlineSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    const serializedDownline = serializeData(downlineUsers);
    return { downline: serializedDownline };

  } catch (error) {
    console.error("Critical Error in getDownline function:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching the downline.", error.message);
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
  const { email, password, firstName, lastName, sponsorReferralCode, adminReferralCode, role, country, state, city } = request.data;

  if (!email || !password || !firstName || !lastName || !country || !state || !city) {
    throw new HttpsError("invalid-argument", "Missing required user information.");
  }

  let sponsorId = null;
  let sponsorUplineRefs = [];
  let level = 1;
  let uplineAdminForNewUser = null;
  let adminReferralId = null;

  if (sponsorReferralCode) {
    const sponsorQuery = await db.collection("users").where("referralCode", "==", sponsorReferralCode).limit(1).get();
    if (!sponsorQuery.empty) {
      const sponsorDoc = sponsorQuery.docs[0];
      sponsorId = sponsorDoc.id;
      const sponsorData = sponsorDoc.data();
      if (sponsorData.role === 'admin') {
        uplineAdminForNewUser = sponsorId;
      } else {
        uplineAdminForNewUser = sponsorData.upline_admin;
      }
      sponsorUplineRefs = sponsorData.upline_refs || [];
      level = sponsorData.level ? sponsorData.level + 1 : 2;
    } else {
      throw new HttpsError("not-found", `Sponsor with referral code '${sponsorReferralCode}' not found.`);
    }
  }

  // Handle admin referral code (for new admins)
  if (adminReferralCode) {
    const adminReferralQuery = await db.collection("users").where("referralCode", "==", adminReferralCode).limit(1).get();
    if (!adminReferralQuery.empty) {
      const adminReferralDoc = adminReferralQuery.docs[0];
      adminReferralId = adminReferralDoc.id;
    } else {
      throw new HttpsError("not-found", `Admin referral with referral code '${adminReferralCode}' not found.`);
    }
  }

  try {
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });
    const uid = userRecord.uid;

    const newUser = {
      uid: uid,
      email: email,
      firstName: firstName,
      lastName: lastName,
      country: country,
      state: state,
      city: city,
      createdAt: FieldValue.serverTimestamp(),
      role: role || 'user',
      referralCode: `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(1000 + Math.random() * 9000)}`,
      referredBy: sponsorReferralCode,
      adminReferral: adminReferralCode,
      sponsor_id: sponsorId,
      level: level,
      upline_refs: sponsorId ? [...sponsorUplineRefs, sponsorId] : [],
      upline_admin: uplineAdminForNewUser,
      directSponsorCount: 0,
      totalTeamCount: 0,
    };

    await db.collection("users").doc(uid).set(newUser);

    if (sponsorId) {
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
    }

    return { success: true, uid: uid };
  } catch (error) {
    console.error("Error registering user:", error);
    throw new HttpsError("internal", error.message, error.details);
  }
});

exports.getDownlineCounts = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const currentUserId = request.auth.uid;
  try {
    const downlineSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (downlineSnapshot.empty) {
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

    downlineSnapshot.docs.forEach(doc => {
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
        all: downlineSnapshot.size,
        last24: last24Count,
        last7: last7Count,
        last30: last30Count,
        newQualified: newQualifiedCount,
        joinedOpportunity: joinedOpportunityCount,
      }
    };
  } catch (error) {
    console.error(`CRITICAL ERROR in getDownlineCounts for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

exports.getFilteredDownline = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const currentUserId = request.auth.uid;
  const { filter, searchQuery, levelOffset, limit = 100, offset = 0 } = request.data || {};

  try {
    console.log(`🔍 FILTER DEBUG: Starting filtered downline for user ${currentUserId}`);
    console.log(`🔍 FILTER DEBUG: Params - filter: ${filter}, searchQuery: "${searchQuery}", levelOffset: ${levelOffset}`);

    // Get base downline
    const downlineSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", currentUserId)
      .get();

    if (downlineSnapshot.empty) {
      return {
        downline: [],
        totalCount: 0,
        hasMore: false
      };
    }

    let filteredUsers = [];
    const now = new Date();

    // Apply time-based and status filters
    downlineSnapshot.docs.forEach(doc => {
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
      downline: serializeData(paginatedUsers),
      groupedByLevel: levelOffset !== undefined ? serializeData(groupedByLevel) : null,
      totalCount,
      hasMore,
      offset,
      limit
    };

  } catch (error) {
    console.error(`CRITICAL ERROR in getFilteredDownline for user ${currentUserId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching filtered downline.", error.message);
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

    const message = {
      token: fcmToken,
      notification: {
        title: notificationData?.title || "New Notification",
        body: notificationData?.message || "You have a new message.",
        // Removed imageUrl to prevent iOS notification failures
      },
      data: {
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
            badge: 1,
          },
        },
      },
      android: {
        notification: {
          sound: "default",
        },
      },
    };

    console.log(`🔔 PUSH DEBUG: Sending FCM message...`);
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
      message: `${messageText}\nREPLY`,
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


exports.notifyOnNewSponsorship = onDocumentCreated("users/{userId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    console.log("🔔 SPONSORSHIP DEBUG: No snap data in event");
    return;
  }

  const newUser = snap.data();
  const newUserId = event.params.userId; // Get the actual document ID

  console.log(`🔔 SPONSORSHIP DEBUG: New user created - ID: ${newUserId}`);
  console.log(`🔔 SPONSORSHIP DEBUG: User data:`, JSON.stringify({
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    referredBy: newUser.referredBy,
    sponsor_id: newUser.sponsor_id
  }, null, 2));

  if (!newUser.referredBy) {
    console.log(`🔔 SPONSORSHIP DEBUG: New user ${newUserId} has no referredBy field. Skipping sponsorship notification.`);
    return;
  }

  try {
    console.log(`🔔 SPONSORSHIP DEBUG: Looking for sponsor with referral code: ${newUser.referredBy}`);

    const sponsorQuery = await db.collection("users").where("referralCode", "==", newUser.referredBy).limit(1).get();
    if (sponsorQuery.empty) {
      console.log(`🔔 SPONSORSHIP DEBUG: Sponsor with referral code ${newUser.referredBy} not found.`);
      return;
    }

    const sponsorDoc = sponsorQuery.docs[0];
    const sponsor = sponsorDoc.data();
    const sponsorId = sponsorDoc.id;

    console.log(`🔔 SPONSORSHIP DEBUG: Found sponsor - ID: ${sponsorId}, Name: ${sponsor.firstName} ${sponsor.lastName}`);
    console.log(`🔔 SPONSORSHIP DEBUG: Sponsor role: ${sponsor.role}`);
    console.log(`🔔 SPONSORSHIP DEBUG: New user adminReferral: ${newUser.adminReferral}`);

    const newUserLocation = `${newUser.city || ""}, ${newUser.state || ""}${newUser.country ? ` - ${newUser.country}` : ""}`;

    // Get business opportunity name for admin notifications
    let bizOppName = "your business opportunity";
    if (sponsor.upline_admin) {
      try {
        const adminSettingsDoc = await db.collection("admin_settings").doc(sponsor.upline_admin).get();
        if (adminSettingsDoc.exists && adminSettingsDoc.data().biz_opp) {
          bizOppName = adminSettingsDoc.data().biz_opp;
        }
      } catch (error) {
        console.log(`🔔 SPONSORSHIP DEBUG: Could not fetch admin settings for biz opp name: ${error.message}`);
      }
    }

    let notificationContent;

    // Determine notification type based on referral method
    if (newUser.adminReferral && sponsor.role === 'admin') {
      // Scenario 2: Admin sharing with existing business opportunity downline member (new= parameter)
      console.log(`🔔 SPONSORSHIP DEBUG: Admin-to-existing-downline scenario detected`);

      notificationContent = {
        title: "🎉 You have a new Team Member!",
        message: `Congratulations, ${sponsor.firstName}! You shared the Team Build Pro App with your current ${bizOppName} downline member, ${newUser.firstName} ${newUser.lastName} from ${newUserLocation} and they have just downloaded and installed the Team Build Pro app! This means any of their Team Build Pro team members that ultimately join ${bizOppName} will automatically be placed in your ${bizOppName} organization!`,
        imageUrl: newUser.photoUrl || null,
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
        message: `Congratulations, ${sponsor.firstName}! You sponsored ${newUser.firstName} ${newUser.lastName} from ${newUserLocation}.`,
        imageUrl: newUser.photoUrl || null,
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

    if (!wasQualifiedBefore && isQualifiedNow) {
      if (afterData.role === 'admin') {
        console.log(`User ${event.params.userId} is an admin. Skipping qualification notification.`);
        await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });
        return;
      }

      await event.data.after.ref.update({ qualifiedDate: FieldValue.serverTimestamp() });

      let bizName = "your business opportunity";
      if (afterData.upline_admin) {
        const adminSettingsDoc = await db.collection("admin_settings").doc(afterData.upline_admin).get();
        if (adminSettingsDoc.exists && adminSettingsDoc.data().biz_opp) {
          bizName = adminSettingsDoc.data().biz_opp;
        }
      }

      const notificationContent = {
        title: "You're Qualified!",
        message: `Congratulations, ${afterData.firstName}! You are now qualified to join ${bizName}.`,
        createdAt: FieldValue.serverTimestamp(),
        read: false,
        type: "new_qualification",
        route: "/visit_opportunity",
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
    const bizOpp = sponsorData.biz_opp;

    const notificationContent = {
      title: `🎉 New ${bizOpp || 'opportunity'} visit!`,
      message: `${visitingUserName} has just used your referral link to check out the opportunity! You can CLICK HERE to contact them directly to introduce yourself and answer any questions they might have. Good Luck!`,
      // --- MODIFICATION: Include the visitor's profile picture ---
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