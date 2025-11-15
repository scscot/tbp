// Test Dreamhost SMTP connection
// Run with: node test-dreamhost-smtp.js

const nodemailer = require('nodemailer');

async function testDreamhostSMTP() {
  console.log('📧 Testing Dreamhost SMTP connection...\n');

  const transporter = nodemailer.createTransport({
    host: 'smtp.dreamhost.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: 'info@stephenscott.us',
      pass: 'csdDreamHost$100',
    },
  });

  try {
    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Send test email
    console.log('📨 Sending test email...');
    const info = await transporter.sendMail({
      from: '"Stephen Scott Contact Form" <info@stephenscott.us>',
      to: 'ss@stephenscott.us',
      replyTo: 'test@example.com',
      subject: 'Test Contact Form - Dreamhost SMTP',
      text: `
This is a test email from the new contact form system.

From: Test User
Email: test@example.com
Subject: Test Contact Form

Message:
This is a test message to verify that the Dreamhost SMTP connection is working properly.

---
Sent via Firebase Function using Dreamhost SMTP
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb, #10b981); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 20px; }
    .label { font-weight: bold; color: #1e40af; }
    .value { background: white; padding: 10px; border-radius: 4px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Test Contact Form Submission</h2>
      <p style="margin: 5px 0 0 0;">stephenscott.us</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">From:</div>
        <div class="value">Test User</div>
      </div>
      <div class="field">
        <div class="label">Email:</div>
        <div class="value">test@example.com</div>
      </div>
      <div class="field">
        <div class="label">Subject:</div>
        <div class="value">Test Contact Form</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="value">This is a test message to verify that the Dreamhost SMTP connection is working properly.</div>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
      Sent via Firebase Function using Dreamhost SMTP
    </div>
  </div>
</body>
</html>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    console.log('\n📬 Check ss@stephenscott.us for the test email!');
  } catch (error) {
    console.error('❌ SMTP Test Failed:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    throw error;
  }
}

testDreamhostSMTP();
