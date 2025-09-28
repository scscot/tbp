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
  validateAuthentication,
  retryWithBackoff,
} = require('./shared/utilities');

const { getTimezoneFromLocation } = require('./timezone_mapping');

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
      levelOffset,
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

    // Check if the member is in the user's network
    if (!memberData.upline_refs || !memberData.upline_refs.includes(userId)) {
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
      directSponsorCount: memberData.directSponsorCount || 0,
      totalTeamCount: memberData.totalTeamCount || 0,
      sponsor_id: memberData.sponsor_id,
    };

    return { member: serializeData(sanitizedData) };

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

// ==============================
// Team and User Management Analytics
// ==============================

/**
 * Recalculate team counts for all users (admin only)
 */
const recalculateTeamCounts = onCall({
  region: "us-central1",
  timeoutSeconds: 540, // 9 minutes for heavy operation
  memory: '1GiB'
}, async (request) => {
  const userId = validateAuthentication(request);

  try {
    // Validate user document exists and has admin role
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.warn(`🚫 RECALCULATE: User document not found for ${userId}`);
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      logger.warn(`🚫 RECALCULATE: Non-admin user attempted access: ${userId} (role: ${userData.role})`);
      throw new HttpsError("permission-denied", "Administrator privileges required.");
    }

    // Validate admin settings and super admin status
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
    logger.error(`❌ RECALCULATE: Error validating admin ${userId}:`, error);
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

  // Team management analytics
  recalculateTeamCounts,

  // User profile management
  updateUserTimezone,

  // Referral analytics
  getUserByReferralCode,

  // Helper functions
  serializeData,
  cleanRateLimitCache,
};