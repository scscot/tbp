const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { admin } = require('@googleapis/admin');
const { GoogleAuth } = require('google-auth-library');

// Define the service account secret
const serviceAccountKey = defineSecret('GOOGLE_SERVICE_ACCOUNT_KEY');
const googleGroupEmail = defineSecret('ANDROID_LEADS_GROUP_EMAIL');

/**
 * Cloud Function to add users to Google Groups for Play Console internal testing
 * This function adds external Gmail users to the Android Leads testing group
 * which is linked to Google Play Console internal testing track
 */
exports.addToInternalTesting = onRequest(
  {
    cors: true,
    secrets: [serviceAccountKey, googleGroupEmail],
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
      const { email, firstName, lastName } = req.body;

      // Validate input
      if (!email || !firstName || !lastName) {
        console.error('❌ INTERNAL_TESTING: Missing required fields');
        res.status(400).json({
          success: false,
          error: 'Missing required fields: email, firstName, lastName',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('❌ INTERNAL_TESTING: Invalid email format:', email);
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
        });
        return;
      }

      console.log(`🎯 INTERNAL_TESTING: Adding ${firstName} ${lastName} (${email}) to Android testing group`);

      // Setup Google Admin SDK authentication
      const serviceAccountData = JSON.parse(serviceAccountKey.value());
      const groupEmail = googleGroupEmail.value();

      const auth = new GoogleAuth({
        credentials: serviceAccountData,
        scopes: [
          'https://www.googleapis.com/auth/admin.directory.group',
          'https://www.googleapis.com/auth/admin.directory.group.member',
        ],
        // Subject is required for domain-wide delegation
        subject: serviceAccountData.client_email,
      });

      const adminClient = admin({ version: 'directory_v1', auth });

      // Check if user is already in the group
      let alreadyMember = false;
      try {
        await adminClient.members.get({
          groupKey: groupEmail,
          memberKey: email,
        });
        alreadyMember = true;
        console.log(`ℹ️ INTERNAL_TESTING: User ${email} is already in testing group`);
      } catch (error) {
        if (error.code !== 404) {
          console.error('❌ INTERNAL_TESTING: Error checking membership:', error.message);
          throw error;
        }
        // 404 means user is not in group - this is expected for new users
      }

      if (!alreadyMember) {
        // Add user to Google Group
        const memberData = {
          email: email,
          role: 'MEMBER',
          type: 'USER',
          delivery_settings: 'NONE', // Don't send group emails to testers
        };

        await adminClient.members.insert({
          groupKey: groupEmail,
          requestBody: memberData,
        });

        console.log(`✅ INTERNAL_TESTING: Successfully added ${email} to Android testing group`);
      }

      // Success response
      res.status(200).json({
        success: true,
        message: alreadyMember
          ? 'User already has testing access'
          : 'Successfully added to internal testing group',
        email: email,
        groupEmail: groupEmail,
      });

    } catch (error) {
      console.error('❌ INTERNAL_TESTING: Error adding user to group:', error);

      // Handle specific Google API errors
      let errorMessage = 'Failed to add user to internal testing group';
      let statusCode = 500;

      if (error.code === 403) {
        errorMessage = 'Permission denied - check service account permissions';
        statusCode = 403;
      } else if (error.code === 404) {
        errorMessage = 'Google Group not found - check group email configuration';
        statusCode = 404;
      } else if (error.code === 409) {
        errorMessage = 'User already exists in group';
        statusCode = 200; // Treat as success
      }

      res.status(statusCode).json({
        success: statusCode === 200,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);