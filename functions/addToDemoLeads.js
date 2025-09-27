const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Define the SendGrid secret for email notifications
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

/**
 * Cloud Function to add demo requesters to CSV file and send BCC notification
 * This function logs demo requests to demo_leads.csv and notifies admin
 */
exports.addToDemoLeads = onRequest(
  {
    cors: true,
    secrets: [sendgridApiKey],
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
      const { firstName, lastName, email } = req.body;

      // Validate input
      if (!email || !firstName || !lastName) {
        console.error('❌ DEMO_LEADS: Missing required fields');
        res.status(400).json({
          success: false,
          error: 'Missing required fields: email, firstName, lastName',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(email)) {
        console.error('❌ DEMO_LEADS: Invalid email format:', email);
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
        });
        return;
      }

      console.log(`🎯 DEMO_LEADS: Processing ${firstName} ${lastName} (${email})`);

      // Check current count in Firestore to see if we're at limit
      const db = admin.firestore();
      const demoRequestsQuery = await db.collection('launch_notifications')
        .where('wantDemo', '==', true)
        .get();

      const currentDemoCount = demoRequestsQuery.size;
      console.log(`📊 DEMO_LEADS: Current demo requests count: ${currentDemoCount}`);

      if (currentDemoCount >= 100) {
        console.warn(`⚠️ DEMO_LEADS: Demo limit reached (${currentDemoCount}/100)`);
        res.status(429).json({
          success: false,
          error: 'Demo request limit reached. Please sign up for launch notification only.',
          limitReached: true
        });
        return;
      }

      // Create CSV line for download
      const currentDate = new Date().toISOString().split('T')[0];
      const csvLine = `"${firstName}","${lastName}","${email}","${currentDate}"`;

      console.log(`✅ DEMO_LEADS: Prepared CSV entry for ${email}`);

      // Send BCC notification to admin
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(sendgridApiKey.value());

        const adminEmail = 'scscot@gmail.com';
        const msg = {
          to: email,
          from: {
            name: 'Team Build Pro',
            email: 'hello@teambuildpro.com'
          },
          bcc: adminEmail, // BCC the admin
          subject: 'Team Build Pro - Demo Access Request Received',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563EB;">Thanks for Your Interest in Team Build Pro!</h2>

              <p>Hi ${firstName},</p>

              <p>We've received your request to preview the Team Build Pro Android app! 🎉</p>

              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #6366f1; margin-top: 0;">What Happens Next:</h3>
                <ol style="color: #4b5563; line-height: 1.6;">
                  <li><strong>Manual Review</strong>: Our team will manually add you to the internal testing list</li>
                  <li><strong>Demo Invitation</strong>: You'll receive another email with download instructions within 24 hours</li>
                  <li><strong>App Access</strong>: Follow the instructions to download and test the app</li>
                </ol>
              </div>

              <p>We're taking this manual approach to ensure the best experience for our early testers. Thanks for your patience!</p>

              <p>Best regards,<br>
              <strong>The Team Build Pro Team</strong></p>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                <p>This is an automated message. Demo request count: ${currentDemoCount + 1}/100</p>
              </div>
            </div>
          `
        };

        await sgMail.send(msg);
        console.log(`📧 DEMO_LEADS: BCC notification sent to ${adminEmail} for ${email}`);

      } catch (emailError) {
        console.error('❌ DEMO_LEADS: Error sending BCC notification:', emailError);
        // Don't fail the entire request if email fails
      }

      // Return the CSV line for manual addition to your CSV file
      res.status(200).json({
        success: true,
        message: 'Successfully processed demo request',
        email: email,
        currentCount: currentDemoCount + 1,
        csvLine: csvLine, // CSV line to add to your demo_leads.csv
        fileName: 'demo_leads.csv'
      });

    } catch (error) {
      console.error('❌ DEMO_LEADS: Error processing demo lead:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to process demo lead request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);