// ==============================
// REFERRAL ATTRIBUTION FUNCTIONS
// Token handoff system for cross-device attribution without fingerprinting
// Based on Joe's privacy-compliant token approach
// ==============================

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const cors = require('cors');
const crypto = require('crypto');

// Configure CORS for production and development
const corsHandler = cors({
  origin: [
    'https://teambuildpro.com',
    'https://www.teambuildpro.com',
    /https:\/\/.*--teambuilder-plus-fe74d\.web\.app$/,  // Firebase Hosting preview channels
    /https:\/\/.*--teambuilder-plus-fe74d\.firebaseapp\.com$/,
    /^http:\/\/localhost(:\d+)?$/,  // localhost with any port
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,  // 127.0.0.1 with any port
    /^http:\/\/\[::1\](:\d+)?$/  // IPv6 localhost
  ],
  credentials: true
});

// Initialize Firestore
const db = admin.firestore();

// ==============================
// CONFIGURATION
// ==============================
const CONFIG = {
  TTL_HOURS: 24,
  MAX_ISSUE_PER_IP_PER_MIN: 30,
  MAX_ISSUE_PER_SPONSOR_PER_HOUR: 100,
  CLEANUP_BATCH_SIZE: 400,
};

// ==============================
// UTILITY FUNCTIONS
// ==============================

/**
 * Generate secure token for attribution
 */
function generateToken() {
  return crypto.randomBytes(16).toString('hex'); // 32-character hex string
}

/**
 * Hash IP for privacy-compliant logging
 */
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Calculate expiration date
 */
function getExpirationDate(hours = CONFIG.TTL_HOURS) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

/**
 * Extract client IP from request headers
 */
function getClientIP(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
}

/**
 * Rate limiting check for IP-based requests
 */
async function checkIPRateLimit(ip) {
  const hashedIP = hashIP(ip);
  const ref = db.collection('_rate_issue').doc(hashedIP);
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    await ref.set({ count: 1, windowStart: now }, { merge: false });
    return true;
  }

  const data = snap.data();
  const { count, windowStart } = data;

  // Reset window if more than 1 minute has passed
  if (now - windowStart > 60000) {
    await ref.set({ count: 1, windowStart: now }, { merge: false });
    return true;
  }

  // Check if under limit
  if (count >= CONFIG.MAX_ISSUE_PER_IP_PER_MIN) {
    return false;
  }

  // Increment counter
  await ref.update({ count: count + 1 });
  return true;
}

/**
 * Rate limiting check for sponsor-based requests
 */
async function checkSponsorRateLimit(sponsorCode) {
  const ref = db.collection('_rate_sponsor').doc(sponsorCode);
  const snap = await ref.get();
  const now = Date.now();

  if (!snap.exists) {
    await ref.set({ count: 1, windowStart: now }, { merge: false });
    return true;
  }

  const data = snap.data();
  const { count, windowStart } = data;

  // Reset window if more than 1 hour has passed
  if (now - windowStart > 3600000) {
    await ref.set({ count: 1, windowStart: now }, { merge: false });
    return true;
  }

  // Check if under limit
  if (count >= CONFIG.MAX_ISSUE_PER_SPONSOR_PER_HOUR) {
    return false;
  }

  // Increment counter
  await ref.update({ count: count + 1 });
  return true;
}

// ==============================
// CLOUD FUNCTIONS
// ==============================

/**
 * Issue Referral Token
 * POST /issueReferral
 * Body: { sponsorCode: string, t?: string, source?: string }
 * Returns: { token: string }
 */
const issueReferral = onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Only allow POST requests
      if (req.method !== 'POST') {
        console.warn('🚨 Invalid method attempted:', req.method);
        return res.status(405).json({ error: 'POST only' });
      }

      // Extract and validate request data
      const ip = getClientIP(req);
      const { sponsorCode, t, source } = req.body || {};

      // Validate required fields
      if (!sponsorCode || typeof sponsorCode !== 'string' || sponsorCode.trim().length === 0) {
        console.warn('🚨 Missing or invalid sponsorCode:', { sponsorCode, ip: hashIP(ip) });
        return res.status(400).json({ error: 'sponsorCode required' });
      }

      const trimmedSponsorCode = sponsorCode.trim();

      // Check rate limits
      if (!(await checkIPRateLimit(ip))) {
        console.warn('🚨 IP rate limit exceeded:', { ip: hashIP(ip) });
        return res.status(429).json({ error: 'rate_limited' });
      }

      if (!(await checkSponsorRateLimit(trimmedSponsorCode))) {
        console.warn('🚨 Sponsor rate limit exceeded:', { sponsorCode: trimmedSponsorCode });
        return res.status(429).json({ error: 'sponsor_rate_limited' });
      }

      // Generate token and create document
      const token = generateToken();
      const now = admin.firestore.Timestamp.now();
      const expiresAt = admin.firestore.Timestamp.fromDate(getExpirationDate());

      const tokenDoc = {
        sponsorCode: trimmedSponsorCode,
        token,
        status: 'issued',
        createdAt: now,
        expiresAt,
        redeemedAt: null,
        source: source || 'web',
        t: t || null,
        ipHash: hashIP(ip)
      };

      // Store token document
      await db.collection('referrals').doc(token).set(tokenDoc, { merge: false });

      console.log('✅ Token issued successfully:', {
        token,
        sponsorCode: trimmedSponsorCode,
        source: tokenDoc.source,
        ipHash: hashIP(ip)
      });

      return res.status(200).json({ token });

    } catch (error) {
      console.error('❌ Error in issueReferral:', error);
      return res.status(500).json({ error: 'internal' });
    }
  });
});

/**
 * Redeem Referral Token
 * POST /redeemReferral
 * Body: { token: string }
 * Returns: { sponsorCode: string, t?: string, status: 'redeemed'|'already_redeemed' }
 */
const redeemReferral = onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Only allow POST requests
      if (req.method !== 'POST') {
        console.warn('🚨 Invalid method attempted:', req.method);
        return res.status(405).json({ error: 'POST only' });
      }

      // Extract and validate token
      const { token } = req.body || {};
      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.warn('🚨 Missing or invalid token');
        return res.status(400).json({ error: 'token required' });
      }

      const trimmedToken = token.trim();

      // Get token document
      const tokenRef = db.collection('referrals').doc(trimmedToken);
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists) {
        console.warn('🚨 Token not found:', { token: trimmedToken });
        return res.status(404).json({ error: 'not_found' });
      }

      const tokenData = tokenSnap.data();
      const now = admin.firestore.Timestamp.now();

      // Check if token has expired
      if (tokenData.expiresAt && now.toMillis() > tokenData.expiresAt.toMillis()) {
        if (tokenData.status !== 'expired') {
          await tokenRef.update({ status: 'expired' });
        }
        console.warn('🚨 Token expired:', { token: trimmedToken, expiredAt: tokenData.expiresAt });
        return res.status(410).json({ error: 'expired' });
      }

      // Handle idempotent case - token already redeemed
      if (tokenData.status === 'redeemed') {
        console.log('ℹ️ Token already redeemed (idempotent):', {
          token: trimmedToken,
          sponsorCode: tokenData.sponsorCode
        });
        return res.status(200).json({
          sponsorCode: tokenData.sponsorCode,
          t: tokenData.t || null,
          status: 'already_redeemed'
        });
      }

      // Check if token is in valid state
      if (tokenData.status !== 'issued') {
        console.warn('🚨 Token in invalid state:', {
          token: trimmedToken,
          status: tokenData.status
        });
        return res.status(409).json({ error: 'invalid_token_state' });
      }

      // First-time redemption - mark as redeemed
      await tokenRef.update({
        status: 'redeemed',
        redeemedAt: now,
        redeemSource: 'pasteboard'
      });

      console.log('✅ Token redeemed successfully:', {
        token: trimmedToken,
        sponsorCode: tokenData.sponsorCode,
        t: tokenData.t
      });

      return res.status(200).json({
        sponsorCode: tokenData.sponsorCode,
        t: tokenData.t || null,
        status: 'redeemed'
      });

    } catch (error) {
      console.error('❌ Error in redeemReferral:', error);
      return res.status(500).json({ error: 'internal' });
    }
  });
});

/**
 * Cleanup Expired Referral Tokens
 * Scheduled function that runs daily to remove old tokens
 */
const cleanupReferrals = onSchedule('every 24 hours', async (event) => {
  try {
    console.log('🧹 Starting referral token cleanup...');

    // Calculate cutoff date (7 days ago)
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    const referralsCollection = db.collection('referrals');
    const batch = db.batch();

    // Query for tokens that are old and consumed/expired
    const expiredQuery = await referralsCollection
      .where('status', 'in', ['redeemed', 'expired'])
      .where('createdAt', '<=', cutoffTimestamp)
      .limit(CONFIG.CLEANUP_BATCH_SIZE)
      .get();

    let deletedCount = 0;

    expiredQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`✅ Cleanup completed: ${deletedCount} expired tokens deleted`);
    } else {
      console.log('ℹ️ No expired tokens to cleanup');
    }

    // Also cleanup rate limiting collections
    await cleanupRateLimitCollections();

  } catch (error) {
    console.error('❌ Error in cleanupReferrals:', error);
  }
});

/**
 * Cleanup rate limiting collections
 */
async function cleanupRateLimitCollections() {
  try {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const batch = db.batch();
    let cleanedCount = 0;

    // Cleanup IP rate limiting
    const ipRateQuery = await db.collection('_rate_issue')
      .where('windowStart', '<', oneDayAgo)
      .limit(100)
      .get();

    ipRateQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
      cleanedCount++;
    });

    // Cleanup sponsor rate limiting
    const sponsorRateQuery = await db.collection('_rate_sponsor')
      .where('windowStart', '<', oneDayAgo)
      .limit(100)
      .get();

    sponsorRateQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
      cleanedCount++;
    });

    if (cleanedCount > 0) {
      await batch.commit();
      console.log(`✅ Rate limit cleanup: ${cleanedCount} old records deleted`);
    }

  } catch (error) {
    console.error('❌ Error cleaning up rate limit collections:', error);
  }
}

// ==============================
// EXPORTS
// ==============================

module.exports = {
  issueReferral,
  redeemReferral,
  cleanupReferrals,
};