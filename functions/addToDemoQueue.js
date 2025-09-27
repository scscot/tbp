const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Simple function to add email to demo queue in Firestore
 * You can then export these emails easily from Firebase Console
 */
exports.addToDemoQueue = onRequest(
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

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      const { email } = req.body;

      // Validate input
      if (!email) {
        console.error('❌ DEMO_QUEUE: Missing email address');
        res.status(400).json({
          success: false,
          error: 'Missing email address',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('❌ DEMO_QUEUE: Invalid email format:', email);
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
        });
        return;
      }

      const db = admin.firestore();

      // Check current count to enforce 100 limit
      const demoRequestsQuery = await db.collection('launch_notifications')
        .where('wantDemo', '==', true)
        .get();

      const currentDemoCount = demoRequestsQuery.size;
      console.log(`📊 DEMO_QUEUE: Current demo requests count: ${currentDemoCount}`);

      if (currentDemoCount >= 100) {
        console.warn(`⚠️ DEMO_QUEUE: Demo limit reached (${currentDemoCount}/100)`);
        res.status(429).json({
          success: false,
          error: 'Demo request limit reached (100 users)',
          limitReached: true
        });
        return;
      }

      // Check if email already exists in demo queue
      const existingDemoQuery = await db.collection('demo_queue')
        .where('email', '==', email)
        .get();

      if (!existingDemoQuery.empty) {
        console.log(`ℹ️ DEMO_QUEUE: Email ${email} already in demo queue`);
        res.status(200).json({
          success: true,
          message: 'Email already in demo queue',
          alreadyExists: true
        });
        return;
      }

      // Add email to demo queue
      await db.collection('demo_queue').add({
        email: email,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        processed: false
      });

      console.log(`✅ DEMO_QUEUE: Added ${email} to demo queue`);

      res.status(200).json({
        success: true,
        message: 'Email added to demo queue',
        email: email,
        currentCount: currentDemoCount + 1,
        exportUrl: 'https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/data/~2Fdemo_queue'
      });

    } catch (error) {
      console.error('❌ DEMO_QUEUE: Error processing demo email:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to add email to demo queue',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);