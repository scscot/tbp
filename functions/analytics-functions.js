// ==============================
// ANALYTICS FUNCTIONS MODULE
// Handles all analytics, metrics, and data retrieval functions including
// network analytics, user statistics, and system metrics
// ==============================

const {
  onCall,
  HttpsError,
  onRequest,
  logger,
  db,
  FieldValue,
  admin,
  validateAuthentication,
  retryWithBackoff,
} = require('./shared/utilities');

const { getTimezoneFromLocation } = require('./timezone_mapping');
const { defineSecret } = require('firebase-functions/params');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// App Store Connect API secrets
const ascKeyId = defineSecret('ASC_KEY_ID');
const ascIssuerId = defineSecret('ASC_ISSUER_ID');
const ascPrivateKey = defineSecret('ASC_PRIVATE_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');
const OpenAI = require('openai');

// ==============================
// Helper Functions
// ==============================

/**
 * Serializes Firestore data for safe JSON transport
 */
function serializeData(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    // Convert Firestore Timestamps to ISO strings
    if (value && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    // Convert other special objects
    if (value && value._delegate && value._delegate._key) {
      return value._delegate._key.path.segments.join('/');
    }
    return value;
  }));
}

/**
 * Rate limiting cache for functions that need protection
 */
const rateLimitCache = new Map();

/**
 * Clean rate limit cache of old entries
 */
function cleanRateLimitCache() {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);

  for (const [key, times] of rateLimitCache.entries()) {
    const recentTimes = times.filter(time => time > hourAgo);
    if (recentTimes.length === 0) {
      rateLimitCache.delete(key);
    } else {
      rateLimitCache.set(key, recentTimes);
    }
  }
}

// ==============================
// Network Analytics Functions
// ==============================

/**
 * Get user's network/downline members
 */
const getNetwork = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const networkSnapshot = await db.collection("users")
      .where("upline_refs", "array-contains", userId)
      .get();

    if (networkSnapshot.empty) {
      return { network: [] };
    }

    const networkUsers = networkSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    const serializedNetwork = serializeData(networkUsers);
    return { network: serializedNetwork };

  } catch (error) {
    logger.error("Critical Error in getNetwork function:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching the network.", error.message);
  }
});

/**
 * Get comprehensive network counts and statistics
 */
const getNetworkCounts = onCall({
  region: "us-central1",
  timeoutSeconds: 60,
  memory: '512MiB'
}, async (request) => {
  const userId = validateAuthentication(request);

  // Validate user exists and is active
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`🚫 NETWORK_COUNTS: User document not found for ${userId}`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data();
    // Allow access for users with active subscription, valid trial, or if isActive field doesn't exist
    const hasActiveSubscription = userData.isActive === true;
    const hasValidTrial = userData.isTrialValid === true;
    const isActiveFieldUndefined = userData.isActive === undefined;

    if (!hasActiveSubscription && !hasValidTrial && !isActiveFieldUndefined) {
      logger.warn(`🚫 NETWORK_COUNTS: User without active subscription or trial attempted access: ${userId}`);
      throw new HttpsError("permission-denied", "Active subscription or trial required to access network data.");
    }

    logger.info(`✅ NETWORK_COUNTS: Authorized access for user ${userId}`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error(`❌ NETWORK_COUNTS: Error validating user ${userId}:`, error);
    throw new HttpsError("internal", "User validation failed.");
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Calculate yesterday's date range
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    // Base query for the user's network
    const baseNetworkQuery = db.collection("users").where("upline_refs", "array-contains", userId);

    // Create promises for each count
    const allCountPromise = baseNetworkQuery.count().get();
    const last24CountPromise = baseNetworkQuery.where("createdAt", ">=", twentyFourHoursAgo).count().get();
    const newQualifiedCountPromise = baseNetworkQuery.where("qualifiedDate", "!=", null).count().get();
    const joinedOpportunityCountPromise = baseNetworkQuery.where("biz_join_date", "!=", null).count().get();
    // Add yesterday's new members count
    const newMembersYesterdayPromise = baseNetworkQuery
      .where("createdAt", ">=", yesterdayStart)
      .where("createdAt", "<=", yesterdayEnd)
      .count().get();
    // Add a specific count for direct sponsors
    const directSponsorsCountPromise = db.collection("users").where("sponsor_id", "==", userId).count().get();

    // Await all promises simultaneously
    const [
      allCountSnapshot,
      last24CountSnapshot,
      newQualifiedCountSnapshot,
      joinedOpportunityCountSnapshot,
      newMembersYesterdaySnapshot,
      directSponsorsCountSnapshot,
    ] = await Promise.all([
      allCountPromise,
      last24CountPromise,
      newQualifiedCountPromise,
      joinedOpportunityCountPromise,
      newMembersYesterdayPromise,
      directSponsorsCountPromise,
    ]);

    // Extract counts from snapshots
    const allCount = allCountSnapshot.data().count;
    const last24Count = last24CountSnapshot.data().count;
    const newQualifiedCount = newQualifiedCountSnapshot.data().count;
    const joinedOpportunityCount = joinedOpportunityCountSnapshot.data().count;
    const newMembersYesterdayCount = newMembersYesterdaySnapshot.data().count;
    const directSponsorsCount = directSponsorsCountSnapshot.data().count;

    return {
      counts: {
        all: allCount,
        last24: last24Count,
        newQualified: newQualifiedCount,
        joinedOpportunity: joinedOpportunityCount,
        newMembersYesterday: newMembersYesterdayCount,
        directSponsors: directSponsorsCount,
      }
    };
  } catch (error) {
    logger.error(`CRITICAL ERROR in getNetworkCounts for user ${userId}:`, error);
    throw new HttpsError("internal", "An unexpected error occurred.");
  }
});

/**
 * Get count of new members from yesterday
 */
const getNewMembersYesterdayCount = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const now = new Date();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);

    const query = db.collection("users")
      .where("upline_refs", "array-contains", userId)
      .where("createdAt", ">=", yesterdayStart)
      .where("createdAt", "<=", yesterdayEnd);

    const countSnapshot = await query.count().get();
    const count = countSnapshot.data().count;

    return { count };
  } catch (error) {
    logger.error("Error in getNewMembersYesterdayCount:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching yesterday's member count.");
  }
});

/**
 * Get filtered network with specific criteria
 */
const getFilteredNetwork = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const {
      filter = 'all',
      searchQuery = '',
      _levelOffset,
      limit = 100,
      offset = 0,
      filters = {}
    } = request.data || {};

    console.log(`🔍 FILTERED: Received params - filter: ${filter}, limit: ${limit}, offset: ${offset}, searchQuery: "${searchQuery}"`);

    let query = db.collection("users").where("upline_refs", "array-contains", userId);

    // Apply filters from the filters object (legacy support)
    if (filters.qualified === true) {
      query = query.where("qualifiedDate", "!=", null);
    }

    if (filters.hasJoinedOpportunity === true) {
      query = query.where("biz_join_date", "!=", null);
    }

    if (filters.isActive === true) {
      query = query.where("isActive", "==", true);
    }

    if (filters.subscriptionStatus) {
      query = query.where("subscriptionStatus", "==", filters.subscriptionStatus);
    }

    // Apply date range filters
    if (filters.createdAfter) {
      query = query.where("createdAt", ">=", new Date(filters.createdAfter));
    }

    if (filters.createdBefore) {
      query = query.where("createdAt", "<=", new Date(filters.createdBefore));
    }

    // Apply search query filter
    if (searchQuery && searchQuery.trim() !== '') {
      // Note: Firestore doesn't support full-text search natively
      // This is a simplified search that would need to be enhanced
      console.log(`🔍 FILTERED: Applying search filter for: "${searchQuery}"`);
    }

    // Handle pagination with offset
    if (offset > 0) {
      query = query.offset(offset);
    }

    // Use the limit parameter from root level, with reasonable max
    const finalLimit = Math.min(limit, 2500); // Support up to 2500 for large team pagination
    query = query.limit(finalLimit);
    console.log(`🔍 FILTERED: Using limit: ${finalLimit}, offset: ${offset}`);

    const snapshot = await query.get();
    console.log(`🔍 FILTERED: Query returned ${snapshot.docs.length} documents`);

    if (snapshot.empty) {
      console.log(`🔍 FILTERED: No documents found, returning empty result`);
      return {
        network: [],
        totalCount: 0,
        hasMore: false,
        offset: offset,
        limit: finalLimit
      };
    }

    const networkUsers = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    const serializedNetwork = serializeData(networkUsers);

    // For proper totalCount, we need to get the total count from a separate query
    // For now, we'll use a simplified approach
    const hasMore = networkUsers.length === finalLimit;

    console.log(`🔍 FILTERED: Returning ${networkUsers.length} users, hasMore: ${hasMore}`);

    return {
      network: serializedNetwork,
      totalCount: networkUsers.length, // This should be the actual total, not just current batch
      hasMore: hasMore,
      offset: offset,
      limit: finalLimit
    };

  } catch (error) {
    logger.error("Error in getFilteredNetwork:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching filtered network.", error.message);
  }
});

/**
 * Get detailed member information
 */
const getMemberDetails = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const { memberId } = request.data || {};

    if (!memberId) {
      throw new HttpsError("invalid-argument", "Member ID is required.");
    }

    // Verify that the requested member is in the user's network
    const memberDoc = await db.collection("users").doc(memberId).get();

    if (!memberDoc.exists) {
      throw new HttpsError("not-found", "Member not found.");
    }

    const memberData = memberDoc.data();

    // Check if the member is in the user's network (either direction)
    // 1. Downline: member has userId in their upline_refs (you're above them)
    // 2. Upline: userId has member in their upline_refs (they're above you - sponsor/team leader)
    const isDownline = memberData.upline_refs && memberData.upline_refs.includes(userId);

    let isUpline = false;
    if (!isDownline) {
      // Check if the requested member is in the current user's upline
      const currentUserDoc = await db.collection("users").doc(userId).get();
      if (currentUserDoc.exists) {
        const currentUserData = currentUserDoc.data();
        isUpline = currentUserData.upline_refs && currentUserData.upline_refs.includes(memberId);
      }
    }

    if (!isDownline && !isUpline) {
      throw new HttpsError("permission-denied", "You don't have permission to view this member's details.");
    }

    // Return sanitized member data
    const sanitizedData = {
      uid: memberId,
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      email: memberData.email,
      photoUrl: memberData.photoUrl,
      createdAt: memberData.createdAt,
      isActive: memberData.isActive,
      subscriptionStatus: memberData.subscriptionStatus,
      qualifiedDate: memberData.qualifiedDate,
      biz_join_date: memberData.biz_join_date,
      country: memberData.country,
      state: memberData.state,
      city: memberData.city,
      directSponsorCount: memberData.directSponsorCount || 0,
      totalTeamCount: memberData.totalTeamCount || 0,
      sponsor_id: memberData.sponsor_id,
      role: memberData.role,
      currentPartner: memberData.currentPartner,
      referredBy: memberData.referredBy,
      upline_admin: memberData.upline_admin,
    };

    // Fetch sponsor information if sponsor_id exists
    let sponsorData = null;
    if (memberData.sponsor_id) {
      try {
        const sponsorDoc = await db.collection("users").doc(memberData.sponsor_id).get();
        if (sponsorDoc.exists) {
          const sponsor = sponsorDoc.data();
          sponsorData = {
            uid: memberData.sponsor_id,
            firstName: sponsor.firstName,
            lastName: sponsor.lastName,
          };
        }
      } catch (error) {
        logger.warn(`Failed to fetch sponsor data for ${memberData.sponsor_id}:`, error);
      }
    }

    // Fetch team leader information if upline_admin exists
    let teamLeaderData = null;
    if (memberData.upline_admin) {
      try {
        const teamLeaderDoc = await db.collection("users").doc(memberData.upline_admin).get();
        if (teamLeaderDoc.exists) {
          const teamLeader = teamLeaderDoc.data();
          teamLeaderData = {
            uid: memberData.upline_admin,
            firstName: teamLeader.firstName,
            lastName: teamLeader.lastName,
          };
        }
      } catch (error) {
        logger.warn(`Failed to fetch team leader data for ${memberData.upline_admin}:`, error);
      }
    }

    return {
      member: serializeData(sanitizedData),
      sponsor: sponsorData ? serializeData(sponsorData) : null,
      teamLeader: teamLeaderData ? serializeData(teamLeaderData) : null,
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in getMemberDetails:", error);
    throw new HttpsError("internal", "An unexpected error occurred while fetching member details.");
  }
});

// ==============================
// User Analytics Functions
// ==============================

/**
 * Check user subscription status with detailed analytics
 */
const checkUserSubscriptionStatus = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userDoc.data();
    const subscriptionStatus = userData.subscriptionStatus || 'trial';
    const subscriptionExpiry = userData.subscriptionExpiry;
    const isActive = userData.isActive || false;
    const trialStartDate = userData.trialStartDate || userData.createdAt;

    // Calculate trial validity and days remaining
    let isTrialValid = false;
    let trialDaysRemaining = 0;

    if (trialStartDate) {
      const trialStart = trialStartDate.toDate ? trialStartDate.toDate() : new Date(trialStartDate);
      const daysSinceTrialStart = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      trialDaysRemaining = Math.max(0, 30 - daysSinceTrialStart);
      isTrialValid = trialDaysRemaining > 0;
    }

    // Calculate days until subscription expiry
    let daysUntilExpiry = null;
    if (subscriptionExpiry) {
      const expiryDate = subscriptionExpiry.toDate ? subscriptionExpiry.toDate() : new Date(subscriptionExpiry);
      const now = new Date();
      const diffTime = expiryDate - now;
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Determine if subscription is in grace period
    const isInGracePeriod = subscriptionStatus === 'cancelled' && daysUntilExpiry > 0;

    // Get usage analytics
    const networkCount = userData.totalTeamCount || 0;
    const directSponsors = userData.directSponsorCount || 0;

    // Return data in format expected by Flutter IAP service
    return {
      subscriptionStatus,
      isActive,
      isTrialValid,
      trialDaysRemaining,
      isInGracePeriod,
      subscriptionExpiry: subscriptionExpiry ? (subscriptionExpiry.toDate ? subscriptionExpiry.toDate().toISOString() : subscriptionExpiry) : null,
      daysUntilExpiry,
      analytics: {
        networkCount,
        directSponsors,
        lastActive: userData.lastActiveAt ? (userData.lastActiveAt.toDate ? userData.lastActiveAt.toDate().toISOString() : userData.lastActiveAt) : null,
      }
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error checking subscription status:", error);
    throw new HttpsError("internal", "Failed to check subscription status.");
  }
});

/**
 * Get milestone fuse status and progress
 */
const getMilestoneFuseStatus = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userDoc.data();
    const teamCount = userData.totalTeamCount || 0;

    // Define milestone levels
    const milestones = [
      { level: 1, required: 5, title: "Team Builder" },
      { level: 2, required: 10, title: "Network Starter" },
      { level: 3, required: 25, title: "Growth Leader" },
      { level: 4, required: 50, title: "Team Captain" },
      { level: 5, required: 100, title: "Network Leader" },
      { level: 6, required: 250, title: "Master Builder" },
      { level: 7, required: 500, title: "Elite Leader" },
      { level: 8, required: 1000, title: "Grand Master" },
    ];

    // Find current milestone
    let currentMilestone = null;
    let nextMilestone = null;
    let progress = 0;

    for (let i = 0; i < milestones.length; i++) {
      if (teamCount >= milestones[i].required) {
        currentMilestone = milestones[i];
      } else {
        nextMilestone = milestones[i];
        if (currentMilestone) {
          progress = ((teamCount - currentMilestone.required) / (nextMilestone.required - currentMilestone.required)) * 100;
        } else {
          progress = (teamCount / nextMilestone.required) * 100;
        }
        break;
      }
    }

    // If user has reached the highest milestone
    if (!nextMilestone && currentMilestone) {
      progress = 100;
    }

    return {
      currentTeamCount: teamCount,
      currentMilestone,
      nextMilestone,
      progress: Math.round(progress * 100) / 100, // Round to 2 decimal places
      milestonesAchieved: milestones.filter(m => teamCount >= m.required).length,
      totalMilestones: milestones.length,
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error getting milestone fuse status:", error);
    throw new HttpsError("internal", "Failed to get milestone status.");
  }
});

// ==============================
// System Metrics Functions
// ==============================

/**
 * Get comprehensive Firestore metrics and cost estimates
 */
const getFirestoreMetrics = onRequest({
  region: "us-central1",
  cors: true
}, async (req, res) => {
  try {
    // Simple password check for monitoring access
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

    // First pass: identify excluded user UIDs (demo/test data)
    const DEMO_UID = 'KJ8uFnlhKhWgBa4NVcwT';
    const excludedUserUids = new Set();
    const usersSnapshot = await db.collection('users').get();
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const isExcluded =
        doc.id === DEMO_UID ||
        userData.upline_admin === DEMO_UID ||
        userData.sponsor_id === DEMO_UID ||
        (userData.upline_refs && userData.upline_refs.includes(DEMO_UID));

      if (isExcluded) {
        excludedUserUids.add(doc.id);
      }
    }

    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        let docCount = snapshot.size;

        // Count subcollections for users
        let subCollectionCount = 0;
        const countryDistribution = {};
        if (collectionName === 'users') {
          let excludedUsersCount = 0;
          for (const doc of snapshot.docs) {
            if (excludedUserUids.has(doc.id)) {
              excludedUsersCount++;
              continue;
            }

            const notificationsSnapshot = await doc.ref.collection('notifications').get();
            const userData = doc.data();

            subCollectionCount += notificationsSnapshot.size;
            const country = userData.country || 'Unknown';
            countryDistribution[country] = (countryDistribution[country] || 0) + 1;
          }
          docCount -= excludedUsersCount;
        }

        // Count messages for chats
        if (collectionName === 'chats') {
          let excludedChatsCount = 0;
          for (const doc of snapshot.docs) {
            const chatData = doc.data();
            const participants = chatData.participants || [];

            const hasExcludedUser = participants.some(uid => excludedUserUids.has(uid));
            if (hasExcludedUser) {
              excludedChatsCount++;
              continue;
            }

            const messagesSnapshot = await doc.ref.collection('messages').get();
            subCollectionCount += messagesSnapshot.size;
          }
          docCount -= excludedChatsCount;
        }

        // Filter admin_settings for excluded users
        if (collectionName === 'admin_settings') {
          let excludedAdminSettingsCount = 0;
          for (const doc of snapshot.docs) {
            if (doc.id === DEMO_UID || excludedUserUids.has(doc.id)) {
              excludedAdminSettingsCount++;
            }
          }
          docCount -= excludedAdminSettingsCount;
        }

        stats.collections[collectionName] = {
          documents: docCount,
          subDocuments: subCollectionCount,
          total: docCount + subCollectionCount
        };

        if (collectionName === 'users' && Object.keys(countryDistribution).length > 0) {
          stats.collections[collectionName].countryDistribution = countryDistribution;
        }

        stats.totalDocuments += docCount + subCollectionCount;
      } catch (error) {
        logger.error(`Error counting ${collectionName}:`, error);
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
    logger.error('Error getting Firestore metrics:', error);
    return res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * Get App Store Connect analytics metrics
 * Password-protected endpoint for the appstore-monitor dashboard
 */
const getAppStoreMetrics = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: [ascKeyId, ascIssuerId, ascPrivateKey, openaiApiKey]
}, async (req, res) => {
  try {
    // Simple password check for monitoring access
    const { password } = req.query;
    const MONITORING_PASSWORD = process.env.MONITORING_PASSWORD || 'TeamBuildPro2024!';

    if (!password || password !== MONITORING_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // App Store Connect constants
    const ASC_APP_ID = '6751211622'; // Team Build Pro iOS app ID
    const ASC_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

    // Generate JWT token for App Store Connect API
    function generateASCToken() {
      const privateKey = ascPrivateKey.value();
      // Handle base64-encoded private key (for Cloud Functions secrets)
      let decodedKey;
      try {
        decodedKey = Buffer.from(privateKey, 'base64').toString('utf8');
        // Verify it looks like a PEM key
        if (!decodedKey.includes('-----BEGIN PRIVATE KEY-----')) {
          decodedKey = privateKey; // Not base64, use as-is
        }
      } catch {
        decodedKey = privateKey;
      }

      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: ascIssuerId.value(),
        iat: now,
        exp: now + (20 * 60), // 20 minutes (Apple max)
        aud: 'appstoreconnect-v1'
      };

      return jwt.sign(payload, decodedKey, {
        algorithm: 'ES256',
        header: {
          alg: 'ES256',
          kid: ascKeyId.value(),
          typ: 'JWT'
        }
      });
    }

    // Make authenticated request to App Store Connect API
    async function ascRequest(endpoint, method = 'GET', data = null, params = {}) {
      const token = generateASCToken();
      const url = `${ASC_BASE_URL}${endpoint}`;

      try {
        let response;
        if (method === 'POST') {
          response = await axios.post(url, data, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } else {
          response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            params
          });
        }
        return response.data;
      } catch (error) {
        if (error.response) {
          logger.error(`ASC API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      }
    }

    // Fetch app info
    async function getAppInfo() {
      const response = await ascRequest(`/apps/${ASC_APP_ID}`);
      const app = response.data;
      return {
        id: app.id,
        name: app.attributes.name,
        bundleId: app.attributes.bundleId,
        sku: app.attributes.sku
      };
    }

    // Fetch recent app versions
    async function getAppVersions() {
      const response = await ascRequest(
        `/apps/${ASC_APP_ID}/appStoreVersions`,
        'GET',
        null,
        { limit: 5 }
      );
      return response.data.map(v => ({
        id: v.id,
        versionString: v.attributes.versionString,
        platform: v.attributes.platform,
        appStoreState: v.attributes.appStoreState,
        releaseType: v.attributes.releaseType,
        createdDate: v.attributes.createdDate
      }));
    }

    // Fetch customer reviews
    async function getCustomerReviews() {
      const response = await ascRequest(
        `/apps/${ASC_APP_ID}/customerReviews`,
        'GET',
        null,
        { sort: '-createdDate', limit: 10 }
      );

      const reviews = response.data.map(r => ({
        id: r.id,
        rating: r.attributes.rating,
        title: r.attributes.title,
        body: r.attributes.body,
        reviewerNickname: r.attributes.reviewerNickname,
        territory: r.attributes.territory,
        createdDate: r.attributes.createdDate
      }));

      // Calculate rating distribution
      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalRating = 0;
      reviews.forEach(r => {
        ratingDistribution[r.rating]++;
        totalRating += r.rating;
      });

      return {
        reviews,
        totalReviews: reviews.length,
        averageRating: reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 'N/A',
        ratingDistribution
      };
    }

    // Get analytics report summary (available report types)
    async function getAnalyticsReportSummary() {
      let requestId;

      // First, try to get existing report requests for this app
      try {
        const existingRequests = await ascRequest(
          `/apps/${ASC_APP_ID}/analyticsReportRequests`,
          'GET',
          null,
          { 'filter[accessType]': 'ONGOING' }
        );

        if (existingRequests.data && existingRequests.data.length > 0) {
          // Use existing request
          requestId = existingRequests.data[0].id;
        }
      } catch (error) {
        // If the filter doesn't work, try without filter
        logger.info('Could not filter existing requests, will try creating new one');
      }

      // If no existing request found, create a new one
      if (!requestId) {
        try {
          const reportRequest = await ascRequest('/analyticsReportRequests', 'POST', {
            data: {
              type: 'analyticsReportRequests',
              attributes: {
                accessType: 'ONGOING'
              },
              relationships: {
                app: {
                  data: {
                    type: 'apps',
                    id: ASC_APP_ID
                  }
                }
              }
            }
          });
          requestId = reportRequest.data.id;
        } catch (error) {
          if (error.response && error.response.status === 409) {
            // Conflict - request already exists, fetch it
            const existingRequests = await ascRequest(
              `/apps/${ASC_APP_ID}/analyticsReportRequests`
            );
            if (existingRequests.data && existingRequests.data.length > 0) {
              requestId = existingRequests.data[0].id;
            }
          } else {
            throw error;
          }
        }
      }

      if (!requestId) {
        return {
          requestId: null,
          totalReports: 0,
          categories: {},
          reportTypes: []
        };
      }

      // Get available report types
      const reportsResponse = await ascRequest(
        `/analyticsReportRequests/${requestId}/reports`,
        'GET',
        null,
        { limit: 50 }
      );

      const reportTypes = reportsResponse.data.map(r => ({
        id: r.id,
        name: r.attributes.name,
        category: r.attributes.category
      }));

      // Group by category
      const categories = {};
      reportTypes.forEach(r => {
        categories[r.category] = (categories[r.category] || 0) + 1;
      });

      return {
        requestId,
        totalReports: reportTypes.length,
        categories,
        reportTypes
      };
    }

    // Get actual metrics data from specific reports
    async function getActualMetrics(reportRequestId, reportTypes) {
      const metrics = {
        downloads: { total: 0, byTerritory: {}, bySource: {}, daily: [] },
        engagement: { totalImpressions: 0, totalPageViews: 0, conversionRate: 0, byTerritory: {}, pageViewsByTerritory: {} },
        sessions: { totalSessions: 0, averageDuration: 0, activeDevices: 0 },
        dataAvailable: false,
        message: null
      };

      if (!reportRequestId || !reportTypes || reportTypes.length === 0) {
        metrics.message = 'No analytics report request available';
        return metrics;
      }

      // Find key reports
      const downloadsReport = reportTypes.find(r => r.name === 'App Downloads Detailed' || r.name === 'App Downloads Standard');
      const engagementReport = reportTypes.find(r => r.name === 'App Store Discovery and Engagement Detailed' || r.name === 'App Store Discovery and Engagement Standard');
      const sessionsReport = reportTypes.find(r => r.name === 'App Sessions Detailed' || r.name === 'App Sessions Standard');

      // Fetch report instances and data
      async function fetchReportData(reportId, reportName) {
        try {
          // Get report instances (last 30 days of data)
          // Correct endpoint: /analyticsReports/{id}/instances
          const instancesResponse = await ascRequest(
            `/analyticsReports/${reportId}/instances`,
            'GET',
            null,
            { limit: 30 }
          );

          if (!instancesResponse.data || instancesResponse.data.length === 0) {
            logger.info(`No instances available for ${reportName} - data may take 24-48 hours to appear`);
            return null;
          }

          logger.info(`Found ${instancesResponse.data.length} instances for ${reportName}`);

          // Get the most recent instance with data
          const instances = instancesResponse.data;
          const reportData = [];

          for (const instance of instances.slice(0, 7)) { // Last 7 days
            try {
              // Get the download URL for this instance
              // Correct endpoint: /analyticsReportInstances/{id}/segments
              const segmentsResponse = await ascRequest(
                `/analyticsReportInstances/${instance.id}/segments`,
                'GET',
                null,
                { limit: 10 }
              );

              if (segmentsResponse.data && segmentsResponse.data.length > 0) {
                for (const segment of segmentsResponse.data) {
                  if (segment.attributes && segment.attributes.url) {
                    // Download the actual data
                    const dataResponse = await axios.get(segment.attributes.url, {
                      responseType: 'text',
                      decompress: true
                    });

                    // Parse TSV data
                    const lines = dataResponse.data.split('\n');
                    if (lines.length > 1) {
                      const headers = lines[0].split('\t');
                      for (let i = 1; i < lines.length; i++) {
                        if (lines[i].trim()) {
                          const values = lines[i].split('\t');
                          const row = {};
                          headers.forEach((h, idx) => {
                            row[h.trim()] = values[idx] ? values[idx].trim() : '';
                          });
                          row._date = instance.attributes?.processingDate || '';
                          reportData.push(row);
                        }
                      }
                    }
                  }
                }
              }
            } catch (instanceError) {
              logger.warn(`Could not fetch instance data: ${instanceError.message}`);
            }
          }

          return reportData;
        } catch (error) {
          logger.warn(`Could not fetch ${reportName}: ${error.message}`);
          return null;
        }
      }

      // Fetch downloads data
      if (downloadsReport) {
        const downloadData = await fetchReportData(downloadsReport.id, 'Downloads');
        if (downloadData && downloadData.length > 0) {
          metrics.dataAvailable = true;

          downloadData.forEach(row => {
            const count = parseInt(row['Total Downloads'] || row['Downloads'] || row['First Time Downloads'] || '0', 10);
            metrics.downloads.total += count;

            // By territory
            const territory = row['Territory'] || row['Storefront'] || 'Unknown';
            metrics.downloads.byTerritory[territory] = (metrics.downloads.byTerritory[territory] || 0) + count;

            // By source
            const source = row['Source Type'] || row['Source'] || 'Unknown';
            metrics.downloads.bySource[source] = (metrics.downloads.bySource[source] || 0) + count;

            // Daily
            if (row._date) {
              const existing = metrics.downloads.daily.find(d => d.date === row._date);
              if (existing) {
                existing.count += count;
              } else {
                metrics.downloads.daily.push({ date: row._date, count });
              }
            }
          });
        }
      }

      // Fetch engagement data
      if (engagementReport) {
        const engagementData = await fetchReportData(engagementReport.id, 'Engagement');
        if (engagementData && engagementData.length > 0) {
          metrics.dataAvailable = true;

          engagementData.forEach(row => {
            const impressions = parseInt(row['Impressions'] || row['Total Impressions'] || '0', 10);
            const pageViews = parseInt(row['Product Page Views'] || row['Page Views'] || '0', 10);

            metrics.engagement.totalImpressions += impressions;
            metrics.engagement.totalPageViews += pageViews;

            const territory = row['Territory'] || row['Storefront'] || 'Unknown';
            metrics.engagement.byTerritory[territory] = (metrics.engagement.byTerritory[territory] || 0) + impressions;
            metrics.engagement.pageViewsByTerritory[territory] = (metrics.engagement.pageViewsByTerritory[territory] || 0) + pageViews;
          });

          // Calculate conversion rate
          if (metrics.engagement.totalImpressions > 0 && metrics.downloads.total > 0) {
            metrics.engagement.conversionRate = ((metrics.downloads.total / metrics.engagement.totalImpressions) * 100).toFixed(2);
          }
        }
      }

      // Fetch sessions data
      if (sessionsReport) {
        const sessionsData = await fetchReportData(sessionsReport.id, 'Sessions');
        if (sessionsData && sessionsData.length > 0) {
          metrics.dataAvailable = true;

          sessionsData.forEach(row => {
            const sessions = parseInt(row['Sessions'] || row['Total Sessions'] || '0', 10);
            const devices = parseInt(row['Active Devices'] || row['Unique Devices'] || '0', 10);

            metrics.sessions.totalSessions += sessions;
            metrics.sessions.activeDevices += devices;
          });
        }
      }

      // Add helpful message when data not available
      if (!metrics.dataAvailable) {
        metrics.message = 'Analytics Reports API data not yet available. The API requires 24-48 hours to populate after initial request. Real-time data is available in App Store Connect web dashboard.';
      }

      return metrics;
    }

    // Generate AI-powered observations and recommendations
    async function generateObservationsAndRecommendations(data) {
      try {
        const openai = new OpenAI({
          apiKey: openaiApiKey.value(),
        });

        // Prepare context for AI
        const context = {
          appName: data.appInfo?.name || 'Team Build Pro',
          currentVersion: data.versions?.[0]?.versionString || 'Unknown',
          averageRating: data.reviews?.averageRating || 'N/A',
          totalReviews: data.reviews?.totalReviews || 0,
          recentReview: data.reviews?.reviews?.[0] || null,
          downloads: data.actualMetrics?.downloads || {},
          engagement: data.actualMetrics?.engagement || {},
          sessions: data.actualMetrics?.sessions || {},
          metricsAvailable: data.actualMetrics?.dataAvailable || false
        };

        const prompt = `You are an App Store optimization expert analyzing data for "${context.appName}" (iOS app).

Current Data:
- App Version: ${context.currentVersion}
- Average Rating: ${context.averageRating}/5 (${context.totalReviews} reviews)
- Recent Review: ${context.recentReview ? `"${context.recentReview.title}" - ${context.recentReview.rating}/5 stars` : 'None'}
${context.metricsAvailable ? `
- Total Downloads (7 days): ${context.downloads.total || 0}
- Top Download Territories: ${Object.entries(context.downloads.byTerritory || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, c]) => `${t}: ${c}`).join(', ') || 'N/A'}
- Download Sources: ${Object.entries(context.downloads.bySource || {}).map(([s, c]) => `${s}: ${c}`).join(', ') || 'N/A'}
- App Store Impressions: ${context.engagement.impressions || 0}
- Product Page Views: ${context.engagement.pageViews || 0}
- Conversion Rate: ${context.engagement.conversionRate || 'N/A'}%
- Total Sessions: ${context.sessions.total || 0}
- Active Devices: ${context.sessions.activeDevices || 0}
` : '- Detailed metrics not yet available (new app or insufficient data)'}

Return a JSON object with the following structure:
{
  "keyObservations": ["observation 1", "observation 2", ...],
  "strengths": ["strength 1", "strength 2", ...],
  "areasForImprovement": ["area 1", "area 2", ...],
  "recommendedActions": ["action 1", "action 2", ...]
}

Provide:
- keyObservations: 3-5 bullet points about the current state
- strengths: 2-3 things going well
- areasForImprovement: 2-3 actionable items
- recommendedActions: 3-5 specific, prioritized recommendations for the next 30 days

Focus on ASO (App Store Optimization), user acquisition, and retention. Be specific and actionable.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert mobile app growth consultant specializing in App Store optimization and user acquisition. Always respond with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 800,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        });

        const responseText = completion.choices[0]?.message?.content || '{}';
        let analysis;
        try {
          analysis = JSON.parse(responseText);
        } catch (parseError) {
          logger.warn('Failed to parse AI response as JSON:', parseError);
          analysis = {
            keyObservations: ['AI analysis format error - please try again'],
            strengths: [],
            areasForImprovement: [],
            recommendedActions: []
          };
        }

        return {
          generatedAt: new Date().toISOString(),
          analysis,
          inputMetrics: {
            rating: context.averageRating,
            reviews: context.totalReviews,
            downloads: context.downloads.total || 0,
            impressions: context.engagement.impressions || 0,
            conversionRate: context.engagement.conversionRate || 'N/A'
          }
        };
      } catch (error) {
        logger.error('Error generating AI analysis:', error);
        return {
          generatedAt: new Date().toISOString(),
          analysis: {
            keyObservations: ['AI analysis temporarily unavailable'],
            strengths: [],
            areasForImprovement: [],
            recommendedActions: []
          },
          error: error.message
        };
      }
    }

    // Get performance metrics (if available)
    async function getPerformanceMetrics() {
      try {
        const response = await ascRequest(
          `/apps/${ASC_APP_ID}/perfPowerMetrics`,
          'GET',
          null,
          { 'filter[deviceType]': 'iPhone', 'filter[metricType]': 'HANG' }
        );
        return {
          productData: response.productData || [],
          insights: response.insights || { trendingUp: [], regressions: [] },
          version: response.version || '1.0.0'
        };
      } catch (error) {
        // Performance metrics may not be available for all apps
        return {
          productData: [],
          insights: { trendingUp: [], regressions: [] },
          version: '1.0.0'
        };
      }
    }

    // Gather all metrics
    logger.info('Fetching App Store Connect metrics...');

    const [appInfo, versions, reviews, analyticsReports, performanceMetrics] = await Promise.all([
      getAppInfo(),
      getAppVersions(),
      getCustomerReviews(),
      getAnalyticsReportSummary(),
      getPerformanceMetrics()
    ]);

    // Fetch actual report data (downloads, engagement, sessions)
    logger.info('Fetching actual analytics report data...');
    let actualMetrics = null;
    if (analyticsReports.requestId && analyticsReports.reportTypes) {
      actualMetrics = await getActualMetrics(analyticsReports.requestId, analyticsReports.reportTypes);
    }

    // Generate AI-powered observations and recommendations
    logger.info('Generating AI observations and recommendations...');
    let observations = null;
    try {
      observations = await generateObservationsAndRecommendations({
        appInfo,
        versions,
        reviews,
        actualMetrics,
        performanceMetrics
      });
    } catch (aiError) {
      logger.error('Failed to generate AI observations:', aiError);
      observations = {
        error: 'Failed to generate observations',
        details: aiError.message
      };
    }

    const metrics = {
      generatedAt: new Date().toISOString(),
      ios: {
        appInfo,
        versions,
        reviews,
        analyticsReports,
        actualMetrics,
        performanceMetrics,
        observations
      }
    };

    logger.info('App Store Connect metrics fetched successfully');
    res.json(metrics);

  } catch (error) {
    logger.error('Error getting App Store metrics:', error);
    return res.status(500).json({
      error: 'Failed to get App Store metrics',
      details: error.message
    });
  }
});

// ==============================
// Team and User Management Analytics
// ==============================

/**
 * Recalculate team counts for all users (admin only)
 */
const recalculateTeamCounts = onCall({
  region: "us-central1",
  timeoutSeconds: 540,
  memory: '1GiB'
}, async (request) => {
  const userId = validateAuthentication(request);
  const { dryRun = false } = request.data || {};

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`🚫 RECALCULATE: User document not found for ${userId}`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      logger.warn(`🚫 RECALCULATE: Non-admin user attempted access: ${userId}`);
      throw new HttpsError("permission-denied", "Administrator privileges required.");
    }

    const adminSettingsDoc = await db.collection("admin_settings").doc(userId).get();
    if (!adminSettingsDoc.exists) {
      logger.warn(`🚫 RECALCULATE: Admin settings not found for ${userId}`);
      throw new HttpsError("permission-denied", "Administrator configuration not found.");
    }

    const adminSettings = adminSettingsDoc.data();
    if (adminSettings.superAdmin !== true) {
      logger.warn(`🚫 RECALCULATE: Non-super-admin attempted operation: ${userId}`);
      throw new HttpsError("permission-denied", "Super administrator privileges required.");
    }

    logger.info(`✅ RECALCULATE: Super admin access validated for ${userId}`);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error(`❌ RECALCULATE: Error validating admin:`, error);
    throw new HttpsError("internal", "Admin validation failed.");
  }

  if (dryRun) {
    logger.info('🔒 DRY RUN MODE - No changes will be made');
  }

  logger.info('📊 RECALCULATE: Fetching all users...');
  const usersSnapshot = await db.collection("users").get();
  const allUsers = usersSnapshot.docs;
  logger.info(`📊 RECALCULATE: Found ${allUsers.length} total users`);

  const existingUids = new Set(allUsers.map(doc => doc.id));
  const completedUsers = allUsers.filter(doc => doc.data().isProfileComplete === true);
  logger.info(`📊 RECALCULATE: ${completedUsers.length} users with completed profiles`);

  const countsMap = new Map();
  allUsers.forEach(doc => countsMap.set(doc.id, { directSponsorCount: 0, totalTeamCount: 0 }));

  let _orphanedSponsorRefs = 0;
  let _orphanedUplineRefs = 0;

  completedUsers.forEach(doc => {
    const { sponsor_id, upline_refs } = doc.data();

    if (sponsor_id) {
      if (existingUids.has(sponsor_id)) {
        countsMap.get(sponsor_id).directSponsorCount++;
      } else {
        _orphanedSponsorRefs++;
      }
    }

    (upline_refs || []).forEach(uid => {
      if (existingUids.has(uid)) {
        countsMap.get(uid).totalTeamCount++;
      } else {
        _orphanedUplineRefs++;
      }
    });
  });

  const usersToDelete = [];
  const deletedUsersList = [];

  allUsers.forEach(doc => {
    const uid = doc.id;
    const data = doc.data();
    const { sponsor_id, level } = data;
    const calculatedCounts = countsMap.get(uid);

    const isOrphaned = !sponsor_id || !existingUids.has(sponsor_id);
    const hasNoTeam = calculatedCounts.directSponsorCount === 0;
    const isNotAdmin = level !== 0;

    if (isOrphaned && hasNoTeam && isNotAdmin) {
      usersToDelete.push({
        uid,
        email: data.email || 'no-email',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        sponsorId: sponsor_id || 'none',
        reason: sponsor_id ? `Orphaned sponsor (${sponsor_id})` : 'No sponsor'
      });
    }
  });

  logger.info(`🗑️ RECALCULATE: Found ${usersToDelete.length} orphaned users to delete`);

  let usersDeleted = 0;
  let authDeleteFailed = 0;
  let firestoreDeleteFailed = 0;

  if (!dryRun && usersToDelete.length > 0) {
    for (const user of usersToDelete) {
      let authDeleted = false;
      let firestoreDeleted = false;

      try {
        await admin.auth().deleteUser(user.uid);
        authDeleted = true;
        logger.info(`🗑️ DELETED AUTH: ${user.email} (${user.uid})`);
      } catch (error) {
        authDeleteFailed++;
        logger.warn(`⚠️ AUTH DELETE FAILED: ${user.uid} - ${error.message}`);
      }

      try {
        await db.collection('users').doc(user.uid).delete();
        firestoreDeleted = true;
        logger.info(`🗑️ DELETED FIRESTORE: ${user.email} (${user.uid})`);
      } catch (error) {
        firestoreDeleteFailed++;
        logger.warn(`⚠️ FIRESTORE DELETE FAILED: ${user.uid} - ${error.message}`);
      }

      if (authDeleted || firestoreDeleted) {
        usersDeleted++;
        deletedUsersList.push({
          email: user.email,
          uid: user.uid,
          firstName: user.firstName,
          lastName: user.lastName,
          sponsorId: user.sponsorId,
          reason: user.reason
        });
      }
    }

    existingUids.clear();
    allUsers.forEach(doc => {
      if (!usersToDelete.some(u => u.uid === doc.id)) {
        existingUids.add(doc.id);
      }
    });
  }

  const referencesToClean = [];
  let orphanedSponsorsCleaned = 0;
  let orphanedUplineRefsCleaned = 0;

  allUsers.forEach(doc => {
    if (usersToDelete.some(u => u.uid === doc.id)) return;

    const { sponsor_id, upline_refs } = doc.data();
    const cleanupNeeded = {};

    if (sponsor_id && !existingUids.has(sponsor_id)) {
      cleanupNeeded.sponsor_id = null;
      orphanedSponsorsCleaned++;
    }

    const validRefs = (upline_refs || []).filter(uid => existingUids.has(uid));
    if (validRefs.length !== (upline_refs || []).length) {
      cleanupNeeded.upline_refs = validRefs;
      orphanedUplineRefsCleaned += (upline_refs || []).length - validRefs.length;
    }

    if (Object.keys(cleanupNeeded).length > 0) {
      referencesToClean.push({ docRef: doc.ref, updates: cleanupNeeded });
    }
  });

  const BATCH_SIZE = 500;
  const batches = [];
  let currentBatch = db.batch();
  let batchCount = 0;
  let countsUpdated = 0;
  let referencesModified = 0;

  allUsers.forEach(doc => {
    if (usersToDelete.some(u => u.uid === doc.id)) return;

    const currentData = doc.data();
    const calculated = countsMap.get(doc.id);

    const needsCountUpdate =
      currentData.directSponsorCount !== calculated.directSponsorCount ||
      currentData.totalTeamCount !== calculated.totalTeamCount;

    const refCleanup = referencesToClean.find(r => r.docRef.id === doc.id);

    if (needsCountUpdate || refCleanup) {
      const updateData = needsCountUpdate ? { ...calculated } : {};
      if (refCleanup) Object.assign(updateData, refCleanup.updates);

      if (!dryRun) {
        currentBatch.update(doc.ref, updateData);
        batchCount++;
      }

      if (needsCountUpdate) countsUpdated++;
      if (refCleanup) referencesModified++;

      logger.info(`🔄 UPDATE: ${doc.id} - ${needsCountUpdate ? 'counts' : ''}${needsCountUpdate && refCleanup ? '+' : ''}${refCleanup ? 'refs' : ''}`);

      if (batchCount >= BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    }
  });

  if (batchCount > 0 && !dryRun) batches.push(currentBatch);

  if (!dryRun && batches.length > 0) {
    logger.info(`📊 RECALCULATE: Committing ${batches.length} batches...`);
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      logger.info(`✅ Batch ${i + 1}/${batches.length} committed`);
    }
  }

  if (!dryRun && deletedUsersList.length > 0) {
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `deleted_orphaned_users_${timestamp}.csv`;
    const header = 'UID,Email,FirstName,LastName,SponsorId,Reason\n';
    const rows = deletedUsersList.map(u =>
      `"${u.uid}","${u.email}","${u.firstName}","${u.lastName}","${u.sponsorId}","${u.reason}"`
    ).join('\n');
    fs.writeFileSync(filename, header + rows);
    logger.info(`📄 Deleted users log saved to: ${filename}`);
  }

  return {
    success: true,
    dryRun,
    summary: {
      totalUsers: allUsers.length,
      completedProfiles: completedUsers.length,
      incompleteProfiles: allUsers.length - completedUsers.length,
      usersDeleted,
      authDeleteFailed,
      firestoreDeleteFailed,
      deletedUsers: dryRun ? usersToDelete.map(u => ({ email: u.email, uid: u.uid, reason: u.reason })) : deletedUsersList,
      countsUpdated,
      countsUnchanged: allUsers.length - usersDeleted - countsUpdated,
      orphanedSponsorsCleaned,
      orphanedUplineRefsCleaned,
      referencesModified,
      batchesCommitted: dryRun ? 0 : batches.length
    },
    message: dryRun
      ? `DRY RUN: Would delete ${usersToDelete.length} users, update ${countsUpdated} counts, clean ${referencesModified} references.`
      : `Deleted ${usersDeleted} users, updated ${countsUpdated} counts, cleaned ${referencesModified} references.`
  };
});

// ==============================
// Database Cleanup Functions
// ==============================

const deleteNonAdminUsers = onCall({
  region: "us-central1",
  timeoutSeconds: 540,
  memory: '1GiB'
}, async (request) => {
  const userId = validateAuthentication(request);
  const { dryRun = false } = request.data || {};

  const PROTECTED_ADMIN_UIDS = [
    'JIMtU2WyFfQAfOkrI4ez3d62wUi2',
    'KJ8uFnlhKhWgBa4NVcwT',
    'lGHtGq9yRdWkhUyQGnzES5hkWiu1',
    'q3G4qodwR2MAHisuHzTREcS6hJu1'
  ];

  const SUPER_ADMIN_UID = 'KJ8uFnlhKhWgBa4NVcwT';

  if (userId !== SUPER_ADMIN_UID) {
    logger.warn(`🚫 DELETE_NON_ADMIN: Unauthorized attempt by ${userId}`);
    throw new HttpsError('permission-denied', 'Only super admin can delete non-admin users');
  }

  logger.info(`🗑️ DELETE_NON_ADMIN: Starting cleanup (dryRun: ${dryRun}) by ${userId}`);

  if (dryRun) {
    logger.info('🔒 DRY RUN MODE - No changes will be made');
  }

  const admin = require('firebase-admin');
  const startTime = Date.now();

  try {
    const usersSnapshot = await db.collection('users').get();
    const allUsers = usersSnapshot.docs;

    const nonAdminUsers = allUsers.filter(doc => {
      const data = doc.data();
      const uid = doc.id;
      return data.level > 0 && !PROTECTED_ADMIN_UIDS.includes(uid);
    });

    logger.info(`📊 DELETE_NON_ADMIN: Found ${nonAdminUsers.length} non-admin users to delete`);
    logger.info(`📊 DELETE_NON_ADMIN: Protected ${PROTECTED_ADMIN_UIDS.length} admin accounts`);

    if (nonAdminUsers.length === 0) {
      return {
        success: true,
        dryRun,
        message: 'No non-admin users found to delete',
        summary: {
          totalUsers: allUsers.length,
          nonAdminUsers: 0,
          protectedAdmins: PROTECTED_ADMIN_UIDS.length,
          deleted: { users: 0, chats: 0, chatLogs: 0, chatUsage: 0, referralCodes: 0 }
        }
      };
    }

    const deletedUsersList = [];
    const stats = {
      users: { attempted: 0, firestoreSuccess: 0, authSuccess: 0, failed: 0 },
      chats: { attempted: 0, success: 0, failed: 0 },
      chatLogs: { attempted: 0, success: 0, failed: 0 },
      chatUsage: { attempted: 0, success: 0, failed: 0 },
      referralCodes: { attempted: 0, success: 0, failed: 0 }
    };

    for (const userDoc of nonAdminUsers) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      deletedUsersList.push({
        uid,
        email: userData.email || 'no-email',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        level: userData.level || 0,
        directSponsorCount: userData.directSponsorCount || 0,
        totalTeamCount: userData.totalTeamCount || 0
      });

      if (!dryRun) {
        stats.users.attempted++;

        try {
          await db.collection('users').doc(uid).delete();
          stats.users.firestoreSuccess++;
          logger.info(`🗑️ Deleted Firestore user: ${userData.email} (${uid})`);
        } catch (error) {
          logger.error(`❌ Failed to delete Firestore user ${uid}:`, error);
          stats.users.failed++;
        }

        try {
          await admin.auth().deleteUser(uid);
          stats.users.authSuccess++;
          logger.info(`🗑️ Deleted Auth user: ${userData.email} (${uid})`);
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            logger.info(`ℹ️ Auth user already deleted: ${uid}`);
          } else {
            logger.error(`❌ Failed to delete Auth user ${uid}:`, error);
            stats.users.failed++;
          }
        }

        try {
          const chatsSnapshot = await db.collection('chats')
            .where('participants', 'array-contains', uid)
            .get();

          for (const chatDoc of chatsSnapshot.docs) {
            stats.chats.attempted++;
            try {
              const messagesSnapshot = await chatDoc.ref.collection('messages').get();
              for (const msgDoc of messagesSnapshot.docs) {
                await msgDoc.ref.delete();
              }
              await chatDoc.ref.delete();
              stats.chats.success++;
            } catch (error) {
              logger.error(`❌ Failed to delete chat ${chatDoc.id}:`, error);
              stats.chats.failed++;
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to query chats for ${uid}:`, error);
        }

        try {
          const chatLogsSnapshot = await db.collection('chat_logs')
            .where('userId', '==', uid)
            .get();

          for (const logDoc of chatLogsSnapshot.docs) {
            stats.chatLogs.attempted++;
            try {
              await logDoc.ref.delete();
              stats.chatLogs.success++;
            } catch (error) {
              logger.error(`❌ Failed to delete chat_log ${logDoc.id}:`, error);
              stats.chatLogs.failed++;
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to query chat_logs for ${uid}:`, error);
        }

        try {
          const chatUsageSnapshot = await db.collection('chat_usage')
            .where(admin.firestore.FieldPath.documentId(), '>=', uid)
            .where(admin.firestore.FieldPath.documentId(), '<', uid + '\uf8ff')
            .get();

          for (const usageDoc of chatUsageSnapshot.docs) {
            stats.chatUsage.attempted++;
            try {
              await usageDoc.ref.delete();
              stats.chatUsage.success++;
            } catch (error) {
              logger.error(`❌ Failed to delete chat_usage ${usageDoc.id}:`, error);
              stats.chatUsage.failed++;
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to query chat_usage for ${uid}:`, error);
        }

        try {
          const referralCodesSnapshot = await db.collection('referralCodes')
            .where('uid', '==', uid)
            .get();

          for (const codeDoc of referralCodesSnapshot.docs) {
            stats.referralCodes.attempted++;
            try {
              await codeDoc.ref.delete();
              stats.referralCodes.success++;
            } catch (error) {
              logger.error(`❌ Failed to delete referralCode ${codeDoc.id}:`, error);
              stats.referralCodes.failed++;
            }
          }
        } catch (error) {
          logger.error(`❌ Failed to query referralCodes for ${uid}:`, error);
        }
      }
    }

    if (!dryRun && deletedUsersList.length > 0) {
      const fs = require('fs');
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `deleted_non_admin_users_${timestamp}.csv`;
      const header = 'UID,Email,FirstName,LastName,Level,DirectSponsors,TotalTeam\n';
      const rows = deletedUsersList.map(u =>
        `"${u.uid}","${u.email}","${u.firstName}","${u.lastName}",${u.level},${u.directSponsorCount},${u.totalTeamCount}`
      ).join('\n');
      fs.writeFileSync(filename, header + rows);
      logger.info(`📄 Deleted users log saved to: ${filename}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    const summary = {
      totalUsers: allUsers.length,
      nonAdminUsers: nonAdminUsers.length,
      protectedAdmins: PROTECTED_ADMIN_UIDS.length,
      executionTime: `${duration}s`,
      deleted: {
        users: stats.users.firestoreSuccess,
        authUsers: stats.users.authSuccess,
        chats: stats.chats.success,
        chatLogs: stats.chatLogs.success,
        chatUsage: stats.chatUsage.success,
        referralCodes: stats.referralCodes.success
      },
      failed: {
        users: stats.users.failed,
        chats: stats.chats.failed,
        chatLogs: stats.chatLogs.failed,
        chatUsage: stats.chatUsage.failed,
        referralCodes: stats.referralCodes.failed
      },
      deletedUsers: dryRun ? deletedUsersList : deletedUsersList.slice(0, 10)
    };

    logger.info(`✅ DELETE_NON_ADMIN: Completed in ${duration}s`);

    return {
      success: true,
      dryRun,
      summary,
      message: dryRun
        ? `DRY RUN: Would delete ${nonAdminUsers.length} users and all related data`
        : `Deleted ${stats.users.firestoreSuccess} users and cleaned up ${stats.chats.success} chats, ${stats.chatLogs.success} logs, ${stats.chatUsage.success} usage records, ${stats.referralCodes.success} referral codes`
    };

  } catch (error) {
    logger.error(`❌ DELETE_NON_ADMIN: Fatal error:`, error);
    throw new HttpsError('internal', `Cleanup failed: ${error.message}`);
  }
});

const cleanupOrphanedUsers = onCall({
  region: "us-central1",
  timeoutSeconds: 540,
  memory: '1GiB'
}, async (request) => {
  const startTime = Date.now();
  const caller = request.auth;

  if (!caller) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const SUPER_ADMIN_UID = 'KJ8uFnlhKhWgBa4NVcwT';
  if (caller.uid !== SUPER_ADMIN_UID) {
    logger.warn(`🚫 CLEANUP_ORPHANED: Unauthorized attempt by ${caller.uid}`);
    throw new HttpsError('permission-denied', 'Super Admin only');
  }

  const dryRun = request.data?.dryRun === true;
  logger.info(`🧹 CLEANUP_ORPHANED: Starting ${dryRun ? 'DRY RUN' : 'LIVE'} subcollection cleanup by ${caller.uid}`);

  const PROTECTED_ADMIN_UIDS = [
    'JIMtU2WyFfQAfOkrI4ez3d62wUi2',
    'KJ8uFnlhKhWgBa4NVcwT',
    'lGHtGq9yRdWkhUyQGnzES5hkWiu1',
    'q3G4qodwR2MAHisuHzTREcS6hJu1'
  ];

  try {
    const orphanedSubcollections = [];
    const stats = {
      notificationsScanned: 0,
      fcmTokensScanned: 0,
      orphanedNotifications: 0,
      orphanedFcmTokens: 0,
      uniqueOrphanedParents: new Set(),
      deleted: {
        notifications: { success: 0, failed: 0 },
        fcmTokens: { success: 0, failed: 0 }
      }
    };

    logger.info(`🔍 Scanning all notifications using collectionGroup...`);
    const allNotifications = await db.collectionGroup('notifications').get();
    stats.notificationsScanned = allNotifications.docs.length;
    logger.info(`📊 Found ${stats.notificationsScanned} total notification documents across all users`);

    for (const notifDoc of allNotifications.docs) {
      const parentUserRef = notifDoc.ref.parent.parent;
      const parentUserId = parentUserRef.id;

      if (PROTECTED_ADMIN_UIDS.includes(parentUserId)) {
        continue;
      }

      const parentSnapshot = await parentUserRef.get();

      if (!parentSnapshot.exists) {
        stats.orphanedNotifications++;
        stats.uniqueOrphanedParents.add(parentUserId);

        orphanedSubcollections.push({
          type: 'notification',
          parentUserId,
          docId: notifDoc.id,
          path: notifDoc.ref.path,
          data: notifDoc.data()
        });

        if (!dryRun) {
          try {
            await notifDoc.ref.delete();
            stats.deleted.notifications.success++;
          } catch (error) {
            logger.error(`Failed to delete orphaned notification ${notifDoc.ref.path}:`, error);
            stats.deleted.notifications.failed++;
          }
        }
      }

      if (stats.notificationsScanned % 100 === 0) {
        logger.info(`📊 Progress: ${stats.notificationsScanned} notifications scanned, ${stats.orphanedNotifications} orphaned`);
      }
    }

    logger.info(`🔍 Scanning all fcmTokens using collectionGroup...`);
    const allFcmTokens = await db.collectionGroup('fcmTokens').get();
    stats.fcmTokensScanned = allFcmTokens.docs.length;
    logger.info(`📊 Found ${stats.fcmTokensScanned} total fcmToken documents across all users`);

    for (const tokenDoc of allFcmTokens.docs) {
      const parentUserRef = tokenDoc.ref.parent.parent;
      const parentUserId = parentUserRef.id;

      if (PROTECTED_ADMIN_UIDS.includes(parentUserId)) {
        continue;
      }

      const parentSnapshot = await parentUserRef.get();

      if (!parentSnapshot.exists) {
        stats.orphanedFcmTokens++;
        stats.uniqueOrphanedParents.add(parentUserId);

        orphanedSubcollections.push({
          type: 'fcmToken',
          parentUserId,
          docId: tokenDoc.id,
          path: tokenDoc.ref.path,
          data: tokenDoc.data()
        });

        if (!dryRun) {
          try {
            await tokenDoc.ref.delete();
            stats.deleted.fcmTokens.success++;
          } catch (error) {
            logger.error(`Failed to delete orphaned fcmToken ${tokenDoc.ref.path}:`, error);
            stats.deleted.fcmTokens.failed++;
          }
        }
      }

      if (stats.fcmTokensScanned % 100 === 0) {
        logger.info(`📊 Progress: ${stats.fcmTokensScanned} fcmTokens scanned, ${stats.orphanedFcmTokens} orphaned`);
      }
    }

    if (!dryRun && orphanedSubcollections.length > 0) {
      const csvPath = `/tmp/deleted_orphaned_subcollections_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      const csvHeader = 'Type,ParentUserId,DocId,Path\n';
      const csvRows = orphanedSubcollections.map(s =>
        `"${s.type}","${s.parentUserId}","${s.docId}","${s.path}"`
      ).join('\n');
      require('fs').writeFileSync(csvPath, csvHeader + csvRows);
      logger.info(`📄 CSV backup written to ${csvPath}`);
    }

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalOrphaned = stats.orphanedNotifications + stats.orphanedFcmTokens;
    const uniqueParents = Array.from(stats.uniqueOrphanedParents);

    const summary = {
      notificationsScanned: stats.notificationsScanned,
      fcmTokensScanned: stats.fcmTokensScanned,
      totalOrphanedSubcollections: totalOrphaned,
      orphanedNotifications: stats.orphanedNotifications,
      orphanedFcmTokens: stats.orphanedFcmTokens,
      uniqueOrphanedParents: uniqueParents.length,
      executionTime: `${executionTime}s`,
      deleted: stats.deleted,
      sampleOrphanedParents: uniqueParents.slice(0, 10),
      sampleSubcollections: orphanedSubcollections.slice(0, 10).map(s => ({
        type: s.type,
        parentUserId: s.parentUserId,
        path: s.path
      }))
    };

    logger.info(`✅ CLEANUP_ORPHANED: Completed in ${executionTime}s - ${totalOrphaned} orphaned subcollections ${dryRun ? 'identified' : 'deleted'} from ${uniqueParents.length} non-existent parent users`);

    return {
      success: true,
      dryRun,
      summary,
      message: dryRun
        ? `DRY RUN: Would delete ${totalOrphaned} orphaned subcollections from ${uniqueParents.length} non-existent user documents`
        : `Deleted ${stats.deleted.notifications.success} orphaned notifications and ${stats.deleted.fcmTokens.success} orphaned fcmTokens from ${uniqueParents.length} non-existent user documents`
    };

  } catch (error) {
    logger.error(`❌ CLEANUP_ORPHANED: Fatal error:`, error);
    throw new HttpsError('internal', `Cleanup failed: ${error.message}`);
  }
});

// ==============================
// Referral Analytics
// ==============================

/**
 * Get user by referral code with analytics tracking
 */
const getUserByReferralCode = onRequest({
  region: "us-central1",
  cors: true,
  timeoutSeconds: 10,
  memory: '256MiB'
}, async (req, res) => {
  // Security: Method validation
  if (req.method !== 'GET') {
    logger.warn(`🚫 REFERRAL_LOOKUP: Invalid method ${req.method} from ${req.ip}`);
    return res.status(405).send('Method Not Allowed');
  }

  // Security: Rate limiting (100 requests per IP per hour)
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const rateLimitKey = `referral_${clientIP}`;
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);

  // Clean old entries and check rate limit
  cleanRateLimitCache();
  const requestTimes = rateLimitCache.get(rateLimitKey) || [];
  const recentRequests = requestTimes.filter(time => time > hourAgo);

  if (recentRequests.length >= 100) {
    logger.warn(`🚫 REFERRAL_LOOKUP: Rate limit exceeded for IP ${clientIP}`);
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Update rate limit cache
  recentRequests.push(now);
  rateLimitCache.set(rateLimitKey, recentRequests);

  // Security: Input validation and sanitization
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    logger.warn(`🚫 REFERRAL_LOOKUP: Missing or invalid referral code from ${clientIP}`);
    return res.status(400).json({ error: 'Valid referral code is required.' });
  }

  // Sanitize referral code (alphanumeric only, max 20 chars)
  const sanitizedCode = code.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  if (sanitizedCode.length === 0 || sanitizedCode !== code.trim()) {
    logger.warn(`🚫 REFERRAL_LOOKUP: Invalid referral code format: ${code} from ${clientIP}`);
    return res.status(400).json({ error: 'Invalid referral code format.' });
  }

  try {
    logger.info(`🔍 REFERRAL_LOOKUP: Processing referral code ${sanitizedCode} from ${clientIP}`);

    // Query Firestore for user with matching referral code
    const userQuery = await retryWithBackoff(async () => {
      return db.collection('users')
        .where('referralCode', '==', sanitizedCode)
        .limit(1)
        .get();
    }, 3, 500);

    if (userQuery.empty) {
      logger.info(`❌ REFERRAL_LOOKUP: No user found for code ${sanitizedCode} from ${clientIP}`);
      return res.status(404).json({
        error: 'Referral code not found.',
        code: sanitizedCode
      });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Security: Only return safe, public information
    const safeUserData = {
      uid: userDoc.id,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      photoUrl: userData.photoUrl || '',
      referralCode: userData.referralCode || '',
      bizOppName: userData.bizOppName || 'Business Opportunity',
      country: userData.country || '',
      state: userData.state || '',
      isActive: userData.isActive === true,
    };

    // Analytics: Track referral code lookup
    try {
      await db.collection('analytics').doc('referral_lookups').collection('events').add({
        referralCode: sanitizedCode,
        userId: userDoc.id,
        clientIP: clientIP,
        timestamp: FieldValue.serverTimestamp(),
        userAgent: req.headers['user-agent'] || 'unknown'
      });
    } catch (analyticsError) {
      // Don't fail the request if analytics logging fails
      logger.warn('Failed to log referral lookup analytics:', analyticsError);
    }

    logger.info(`✅ REFERRAL_LOOKUP: Found user ${userDoc.id} for code ${sanitizedCode} from ${clientIP}`);
    return res.status(200).json({
      success: true,
      user: safeUserData
    });

  } catch (error) {
    logger.error(`❌ REFERRAL_LOOKUP: Database error for code ${sanitizedCode} from ${clientIP}:`, error);
    return res.status(500).json({
      error: 'Internal server error. Please try again later.',
      code: sanitizedCode
    });
  }
});

// ==============================
// User Profile Management Functions
// ==============================

const updateUserTimezone = onCall({ region: "us-central1" }, async (request) => {
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

// ==============================
// Exports
// ==============================

module.exports = {
  // Network analytics functions
  getNetwork,
  getNetworkCounts,
  getNewMembersYesterdayCount,
  getFilteredNetwork,
  getMemberDetails,

  // User analytics functions
  checkUserSubscriptionStatus,
  getMilestoneFuseStatus,

  // System metrics functions
  getFirestoreMetrics,
  getAppStoreMetrics,

  // Team management analytics
  recalculateTeamCounts,
  deleteNonAdminUsers,
  cleanupOrphanedUsers,

  // User profile management
  updateUserTimezone,

  // Referral analytics
  getUserByReferralCode,

  // Helper functions
  serializeData,
  cleanRateLimitCache,
};