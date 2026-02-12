#!/usr/bin/env node
/**
 * Send inquiry email to Apache Leads requesting pricing and sample
 * Uses Mailgun API (same as email campaigns)
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=');
      }
    }
  });
}

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.TBP_MAILGUN_DOMAIN || 'news.teambuildpro.com';

const EMAIL_CONTENT = {
  from: 'Stephen Scott <stephen@news.teambuildpro.com>',
  to: 'admin@apacheleads.com',
  subject: 'Pricing Inquiry - Bulk Aged Leads for Software Tool Promotion',
  text: `Hello,

I'm interested in purchasing MLM leads for promoting a software tool (Team Build Pro - an AI downline builder app) to network marketing professionals.

I have a few questions:

1. What is the pricing for your aged leads (30+ days)?
2. Do you offer email-only leads at a reduced rate? (We primarily need email addresses, not phone numbers)
3. Can you provide a small sample (5-10 leads) to test data quality?
4. What percentage of your leads typically have valid email addresses?
5. Are your leads CAN-SPAM compliant for cold email outreach?

Our target audience:
- Active network marketers looking for recruiting tools
- People who have expressed interest in home-based business opportunities
- US-based primarily

Budget: Looking to start with 500-1,000 leads for initial testing.

Thank you,
Stephen Scott
Team Build Pro
https://teambuildpro.com
`,
  html: `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
<p>Hello,</p>

<p>I'm interested in purchasing MLM leads for promoting a software tool (<strong>Team Build Pro</strong> - an AI downline builder app) to network marketing professionals.</p>

<p>I have a few questions:</p>

<ol>
  <li>What is the pricing for your aged leads (30+ days)?</li>
  <li>Do you offer email-only leads at a reduced rate? (We primarily need email addresses, not phone numbers)</li>
  <li>Can you provide a small sample (5-10 leads) to test data quality?</li>
  <li>What percentage of your leads typically have valid email addresses?</li>
  <li>Are your leads CAN-SPAM compliant for cold email outreach?</li>
</ol>

<p><strong>Our target audience:</strong></p>
<ul>
  <li>Active network marketers looking for recruiting tools</li>
  <li>People who have expressed interest in home-based business opportunities</li>
  <li>US-based primarily</li>
</ul>

<p><strong>Budget:</strong> Looking to start with 500-1,000 leads for initial testing.</p>

<p>Thank you,<br>
<strong>Stephen Scott</strong><br>
Team Build Pro<br>
<a href="https://teambuildpro.com">https://teambuildpro.com</a></p>
</div>`
};

async function sendEmail() {
  if (!MAILGUN_API_KEY) {
    throw new Error('TBP_MAILGUN_API_KEY not found in environment');
  }

  console.log('Sending email via Mailgun API...');
  console.log(`From: ${EMAIL_CONTENT.from}`);
  console.log(`To: ${EMAIL_CONTENT.to}`);
  console.log(`Subject: ${EMAIL_CONTENT.subject}`);

  const form = new FormData();
  form.append('from', EMAIL_CONTENT.from);
  form.append('to', EMAIL_CONTENT.to);
  form.append('subject', EMAIL_CONTENT.subject);
  form.append('text', EMAIL_CONTENT.text);
  form.append('html', EMAIL_CONTENT.html);
  form.append('o:tag', 'vendor_inquiry');
  form.append('o:tag', 'apache_leads');

  const response = await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    }
  );

  console.log('\n✅ Email sent successfully!');
  console.log(`Message ID: ${response.data.id}`);
  console.log(`Response: ${response.data.message}`);

  return response.data;
}

sendEmail()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed to send email:', err.response?.data || err.message);
    process.exit(1);
  });
