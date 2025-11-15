const { onRequest } = require('firebase-functions/v2/https');
const nodemailer = require('nodemailer');

// Dreamhost SMTP configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.dreamhost.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: 'info@stephenscott.us',
    pass: 'csdDreamHost$100',
  },
});

exports.submitStephenScottContact = onRequest(
  {
    cors: true,
    maxInstances: 10,
  },
  async (req, res) => {
    // Manual CORS headers
    const allowedOrigins = [
      'https://www.stephenscott.us',
      'https://stephenscott.us',
      'https://sscott.web.app',
      'https://www.teambuildingproject.com',
      'https://teambuildingproject.com',
      'https://teambuildingproject.web.app'
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'Method not allowed' });
      return;
    }

    try {
      const { name, email, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      if (!email.includes('@') || email.length < 5) {
        res.status(400).json({ success: false, error: 'Invalid email address' });
        return;
      }

      console.log(`📧 CONTACT FORM: New submission from ${name} (${email})`);

      const mailOptions = {
        from: '"Stephen Scott Contact Form" <info@stephenscott.us>',
        to: 'ss@stephenscott.us',
        replyTo: email,
        subject: `[Contact Form] ${subject}`,
        text: `
Contact Form Submission

From: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Sent via stephenscott.us contact form
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2563eb, #10b981); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
    .field { margin-bottom: 20px; }
    .label { font-weight: bold; color: #1e40af; margin-bottom: 5px; }
    .value { background: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; }
    .message-box { background: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb; min-height: 100px; white-space: pre-wrap; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Contact Form Submission</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">stephenscott.us</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">From:</div>
        <div class="value">${name}</div>
      </div>
      <div class="field">
        <div class="label">Email:</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>
      <div class="field">
        <div class="label">Subject:</div>
        <div class="value">${subject}</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>
    <div class="footer">
      Sent via stephenscott.us contact form
    </div>
  </div>
</body>
</html>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ CONTACT EMAIL SENT: ${info.messageId}`);

      res.status(200).json({
        success: true,
        message: 'Thank you for your message. I will get back to you soon!',
      });
    } catch (error) {
      console.error('❌ ERROR processing contact form:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);
