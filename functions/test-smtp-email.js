/**
 * Test SMTP Email Send
 *
 * Usage: node test-smtp-email.js [email]
 * Default: scscot@gmail.com
 */

// Load environment variables
require('dotenv').config({ path: '.env.teambuilder-plus-fe74d' });

const nodemailer = require('nodemailer');
const { generateEmailHTML, generateEmailPlainText } = require('./email_templates/tbp-smtp-template');

const recipient = process.argv[2] || 'scscot@gmail.com';

async function sendTestEmail() {
  console.log('📧 SMTP Test Email Script');
  console.log('========================\n');

  // Get SMTP config from environment
  const host = process.env.TBP_SMTP_HOST || 'smtp.dreamhost.com';
  const port = parseInt(process.env.TBP_SMTP_PORT || '587');
  const user = process.env.TBP_SMTP_USER;
  const pass = process.env.TBP_SMTP_PASS;

  console.log(`SMTP Host: ${host}:${port}`);
  console.log(`SMTP User: ${user}`);
  console.log(`Password: ${pass ? '****' + pass.slice(-4) : 'NOT SET'}`);
  console.log(`Recipient: ${recipient}\n`);

  if (!user || !pass) {
    console.error('❌ Error: TBP_SMTP_USER and TBP_SMTP_PASS must be set');
    process.exit(1);
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: true }
  });

  // Verify connection
  console.log('🔌 Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified\n');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    process.exit(1);
  }

  // Generate test email content
  const testContact = {
    firstName: 'Test',
    lastName: 'User',
    email: recipient
  };
  const testTrackingId = 'test_' + Date.now();
  const testConfig = {
    subjectTag: 'smtp_test',
    utmCampaign: 'smtp_test'
  };

  const htmlContent = generateEmailHTML(testContact, testTrackingId, testConfig, '');
  const textContent = generateEmailPlainText(testContact, testTrackingId, testConfig, '');

  // Send email
  console.log('📤 Sending test email...');
  try {
    const result = await transporter.sendMail({
      from: 'Stephen Scott <stephen@news.teambuildpro.com>',
      to: `Test User <${recipient}>`,
      subject: 'Not an opportunity. Just a tool.',
      html: htmlContent,
      text: textContent
    });

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   Response: ${result.response}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }

  transporter.close();
  console.log('\n📧 Test complete!');
}

sendTestEmail();
