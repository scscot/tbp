const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const sgMail = require('@sendgrid/mail');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Define your secrets - reusing existing SendGrid configuration
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

exports.sendDemoInvitation = onRequest({ 
  cors: true, 
  secrets: [sendgridApiKey] 
}, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { firstName, lastName, email, demoUrl } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !demoUrl) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: firstName, lastName, email, demoUrl' 
      });
      return;
    }

    console.log(`📧 DEMO_INVITATION: Sending demo invitation to ${firstName} ${lastName} (${email})`);

    // Set the SendGrid API key
    sgMail.setApiKey(sendgridApiKey.value());

    // Create the demo invitation email
    const msg = {
      to: email,
      from: 'demo@teambuildpro.com',
      subject: '🚀 Welcome to Team Build Pro Android Demo!',
      html: getEmailTemplate(firstName, demoUrl)
    };

    // Send the email
    await sgMail.send(msg);
    console.log(`✅ DEMO_INVITATION: Successfully sent demo invitation to ${email}`);

    res.status(200).json({ 
      success: true, 
      message: 'Demo invitation sent successfully.' 
    });

  } catch (error) {
    console.error('❌ DEMO_INVITATION: Error sending demo invitation:', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send demo invitation' 
    });
  }
});

// Email template for demo invitations
function getEmailTemplate(firstName, demoUrl) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://teambuildpro.com/assets/icons/app_icon.png" alt="Team Build Pro" style="width: 64px; height: 64px; border-radius: 50%; margin-bottom: 1rem;">
        <h1 style="color: #ffffff; margin: 0; font-size: 1.75rem; font-weight: 700;">Welcome to Team Build Pro!</h1>
        <p style="color: #e2e8f0; margin: 0.5rem 0 0 0; font-size: 1.1rem;">Your Android demo access is ready</p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 2rem; background-color: #ffffff;">
        <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
          Hi ${firstName},
        </p>
        
        <p style="color: #334155; line-height: 1.6; margin-bottom: 1.5rem;">
          Thank you for your interest in Team Build Pro! We're excited to give you early access to our Android demo version.
        </p>
        
        <!-- Download Instructions -->
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
          <h3 style="color: #1e293b; margin-top: 0; margin-bottom: 1rem; font-size: 1.2rem;">📱 How to Download the Demo:</h3>
          
          <ol style="color: #334155; line-height: 1.8; margin-left: 1rem;">
            <li><strong>Click this link</strong> to access the demo: <br>
                <a href="${demoUrl}" 
                   style="color: #10b981; text-decoration: none; font-weight: 600; word-break: break-all;">
                  ${demoUrl}
                </a>
            </li>
            <li><strong>Install the demo app</strong> from Google Play Store</li>
            <li><strong>Start exploring!</strong> Build your network and test all features</li>
          </ol>
        </div>
        
        <!-- Important Notice -->
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin: 1.5rem 0;">
          <h4 style="color: #92400e; margin-top: 0; margin-bottom: 0.5rem; font-size: 1rem;">⚠️ Important Demo Details:</h4>
          <p style="color: #b45309; margin: 0; line-height: 1.6; font-size: 0.95rem;">
            The demo app will appear with a temporary name: <strong>"com.scott.ultimatefix - unreviewed"</strong>. 
            This is just Google Play's temporary naming for internal testing - don't worry, it's the real Team Build Pro app!
          </p>
        </div>
        
        <!-- What's Next -->
        <div style="background-color: #ecfdf5; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0;">
          <h3 style="color: #1e293b; margin-top: 0; margin-bottom: 1rem; font-size: 1.2rem;">🎯 What to Expect:</h3>
          <ul style="color: #334155; line-height: 1.8; margin-left: 1rem;">
            <li><strong>Full Feature Access:</strong> Experience all Team Build Pro capabilities</li>
            <li><strong>Your Feedback Matters:</strong> Help us perfect the app before official launch</li>
            <li><strong>Official Launch Notice:</strong> We'll email you when to delete the demo and download the official app</li>
          </ul>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 2rem 0;">
          <a href="${demoUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #10b981, #34d399); color: #ffffff; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.1rem;">
            🚀 Download Demo Now
          </a>
        </div>
        
        <p style="color: #64748b; line-height: 1.6; margin-top: 2rem;">
          Questions or need help? Just reply to this email - we're here to help make your team building journey successful.
        </p>
        
        <p style="color: #64748b; margin-bottom: 0;">
          Best regards,<br><br>
          <strong>Support Team</strong><br>
          Team Build Pro<br>
          <a href="mailto:demo@teambuildpro.com" style="color: #10b981;">demo@teambuildpro.com</a>
        </p>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 1.5rem; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; margin: 0; font-size: 0.9rem;">
          © 2024 Team Build Pro. Professional team building software.
        </p>
        <p style="color: #94a3b8; margin: 0.5rem 0 0 0; font-size: 0.8rem;">
          This is a demo invitation. The official app will be available soon on Google Play Store.
        </p>
      </div>
    </div>
  `;
}