const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

async function sendEmailViaMailgun(contact, apiKey, domain) {
  const form = new FormData();

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

  const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;
  const response = await axios.post(`${mailgunBaseUrl}/messages`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
    }
  });

  return response.data;
}

async function sendTestEmail() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN || 'info.teambuildpro.com';

  if (!apiKey) {
    console.error('❌ ERROR: MAILGUN_API_KEY not found in .env file');
    process.exit(1);
  }

  const testContact = {
    firstName: 'Stephen',
    lastName: 'Scott',
    email: 'scscot@gmail.com'
  };

  console.log(`📧 Sending test email to ${testContact.email}...`);
  console.log(`📝 Subject: ${testContact.firstName}, recruiting just got easier (AI does the talking)`);
  console.log(`📬 From: Stephen Scott | Team Build Pro <sscott@info.teambuildpro.com>`);
  console.log(`🏷️  Template: initial (2version)`);
  console.log('');

  try {
    const result = await sendEmailViaMailgun(testContact, apiKey, domain);
    console.log('✅ Email sent successfully!');
    console.log(`📮 Mailgun ID: ${result.id}`);
    console.log(`📊 Message: ${result.message}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

sendTestEmail();
