const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

/**
 * Cloud Function to get current demo request count
 * Used by website to determine if demo option should be shown
 */
exports.getDemoCount = onRequest(
  {
    cors: true,
    region: 'us-central1',
  },
  async (req, res) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      const db = admin.firestore();

      // Count all demo requests (wantDemo = true)
      const demoRequestsQuery = await db.collection('launch_notifications')
        .where('wantDemo', '==', true)
        .get();

      const currentCount = demoRequestsQuery.size;
      const isLimitReached = currentCount >= 100;

      console.log(`📊 DEMO_COUNT: Current demo requests: ${currentCount}/100, Limit reached: ${isLimitReached}`);

      res.status(200).json({
        success: true,
        currentCount: currentCount,
        limit: 100,
        isLimitReached: isLimitReached,
        remainingSlots: Math.max(0, 100 - currentCount)
      });

    } catch (error) {
      console.error('❌ DEMO_COUNT: Error checking demo count:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to check demo count',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);