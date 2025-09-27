const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

// Initialize Firebase Admin and Cloud Storage
if (!admin.apps.length) {
  admin.initializeApp();
}
const storage = new Storage();
const bucket = storage.bucket('teambuilder-plus-fe74d.appspot.com');

/**
 * Simple function to append email to demo_leads.csv file
 * Only stores email addresses - nothing more
 */
exports.appendDemoEmail = onRequest(
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
        console.error('❌ DEMO_CSV: Missing email address');
        res.status(400).json({
          success: false,
          error: 'Missing email address',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('❌ DEMO_CSV: Invalid email format:', email);
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
        });
        return;
      }

      // Check current count in Firestore to enforce 100 limit
      const db = admin.firestore();
      const demoRequestsQuery = await db.collection('launch_notifications')
        .where('wantDemo', '==', true)
        .get();

      const currentDemoCount = demoRequestsQuery.size;
      console.log(`📊 DEMO_CSV: Current demo requests count: ${currentDemoCount}`);

      if (currentDemoCount >= 100) {
        console.warn(`⚠️ DEMO_CSV: Demo limit reached (${currentDemoCount}/100)`);
        res.status(429).json({
          success: false,
          error: 'Demo request limit reached (100 users)',
          limitReached: true
        });
        return;
      }

      console.log(`🎯 DEMO_CSV: Adding ${email} to demo_leads.csv`);

      const fileName = 'demo_leads.csv';
      const file = bucket.file(fileName);

      // Read existing file from Cloud Storage
      let existingEmails = [];
      let csvContent = '';

      try {
        const [exists] = await file.exists();
        if (exists) {
          const [data] = await file.download();
          csvContent = data.toString();
          existingEmails = csvContent.split('\n').filter(line => line.trim()).map(line => line.trim());
        }
      } catch (readError) {
        console.log('📝 DEMO_CSV: Creating new demo_leads.csv file in Cloud Storage');
      }

      // Check if email already exists
      if (existingEmails.includes(email)) {
        console.log(`ℹ️ DEMO_CSV: Email ${email} already in CSV`);
        res.status(200).json({
          success: true,
          message: 'Email already in demo list',
          alreadyExists: true,
          downloadUrl: `https://console.firebase.google.com/project/teambuilder-plus-fe74d/storage/teambuilder-plus-fe74d.appspot.com/files`
        });
        return;
      }

      // Add email to content
      const updatedContent = csvContent + email + '\n';

      // Save updated file to Cloud Storage
      await file.save(updatedContent, {
        metadata: {
          contentType: 'text/csv',
          cacheControl: 'no-cache'
        }
      });

      console.log(`✅ DEMO_CSV: Added ${email} to demo_leads.csv in Cloud Storage`);

      // Generate download URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      res.status(200).json({
        success: true,
        message: 'Email added to demo list',
        email: email,
        currentCount: currentDemoCount + 1,
        fileName: 'demo_leads.csv',
        downloadUrl: url,
        storageLocation: `gs://teambuilder-plus-fe74d.appspot.com/${fileName}`
      });

    } catch (error) {
      console.error('❌ DEMO_CSV: Error processing demo email:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to add email to demo list',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);