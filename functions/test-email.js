// Test script to send email via Mailgun
// Run with: node test-email.js

const axios = require('axios');
const FormData = require('form-data');

async function sendTestEmail() {
  const form = new FormData();

  // Test contact
  const contact = {
    firstName: 'Stephen',
    lastName: 'Scott',
    email: 'scscot@gmail.com'
  };

  // Updated Nov 2025: Aligned with new "AI Recruiting" positioning
  const selectedSubject = `${contact.firstName}, recruiting just got easier (AI does the talking)`;
  const selectedVersion = '2version';

  form.append('from', 'Stephen Scott | Team Build Pro <sscott@info.teambuildpro.com>');
  form.append('to', `${contact.firstName} ${contact.lastName} <${contact.email}>`);
  form.append('subject', selectedSubject);

  form.append('template', 'initial');
  form.append('t:version', selectedVersion);
  form.append('o:tag', 'test_email');
  form.append('o:tag', selectedVersion);
  form.append('o:tracking', 'yes');
  form.append('o:tracking-opens', 'yes');
  form.append('o:tracking-clicks', 'yes');
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: contact.firstName,
    last_name: contact.lastName,
    email: contact.email
  }));

  // Get API key from environment
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = 'info.teambuildpro.com';

  if (!apiKey) {
    console.error('❌ MAILGUN_API_KEY environment variable not set');
    console.error('Set it with: export MAILGUN_API_KEY=your_key_here');
    process.exit(1);
  }

  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
    const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
      }
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', response.data.id);
    console.log('To:', contact.email);
    console.log('Subject:', selectedSubject);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

sendTestEmail();
