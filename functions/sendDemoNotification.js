const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

/**
 * HTTP Function: Send email notification when demo request is submitted
 * Called directly from web form after creating launch_notifications document
 */
exports.sendDemoNotification = onRequest(
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
      const { firstName, lastName, email, deviceType } = req.body;

      // Validate input
      if (!firstName || !lastName || !email || !deviceType) {
        console.error('❌ DEMO_NOTIFICATION: Missing required fields');
        res.status(400).json({
          success: false,
          error: 'Missing required fields: firstName, lastName, email, deviceType',
        });
        return;
      }

      console.log(`🎯 DEMO_NOTIFICATION: Sending notification for ${firstName} ${lastName} (${email})`);

      // Get current demo count
      const db = admin.firestore();
      const demoQuery = await db.collection('launch_notifications')
        .where('wantDemo', '==', true)
        .get();
      const currentCount = demoQuery.size;

      console.log(`📊 DEMO_NOTIFICATION: Current demo count: ${currentCount}/100`);

      // Configure Dreamhost SMTP transporter
      const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        auth: {
          user: 'demo@teambuildpro.com',
          pass: 'csdTeambuildpro$100'
        }
      });

      // Send notification email to admin
      const deviceName = deviceType === 'ios' ? 'iOS' : 'Android';
      const mailOptions = {
        from: 'Team Build Pro <demo@teambuildpro.com>',
        to: 'scscot@gmail.com',
        subject: `🎉 New Demo Request: ${firstName} ${lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563EB;">New Demo Request Received!</h2>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #6366f1; margin-top: 0;">Requester Details:</h3>
              <ul style="color: #4b5563; line-height: 1.8;">
                <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Device:</strong> ${deviceName}</li>
                <li><strong>Demo Count:</strong> ${currentCount}/100</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}</li>
              </ul>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>📝 To export CSV:</strong> Run <code>node export_demo_emails.js</code>
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px;">
              This notification was triggered by a demo request submission from the website.
            </p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ DEMO_NOTIFICATION: Email sent to scscot@gmail.com for ${email} (Message ID: ${info.messageId}, Demo count: ${currentCount}/100)`);

      res.status(200).json({
        success: true,
        message: 'Demo notification sent successfully',
        demoCount: currentCount,
      });

    } catch (error) {
      console.error('❌ DEMO_NOTIFICATION: Error sending notification:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to send demo notification',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);
