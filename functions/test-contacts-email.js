#!/usr/bin/env node
/**
 * Test script for email-campaign-contacts.js
 * Sends a test email using the same Mailgun templates (v3/v4)
 *
 * Usage:
 *   node test-contacts-email.js scscot@gmail.com
 *   node test-contacts-email.js scscot@gmail.com "Herbalife"
 *   node test-contacts-email.js scscot@gmail.com "doTERRA" v7
 *   node test-contacts-email.js scscot@gmail.com "Herbalife" v8
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env.teambuilder-plus-fe74d');
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

const axios = require('axios');
const FormData = require('form-data');

// Configuration
const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.TBP_MAILGUN_DOMAIN || 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const TRACKING_BASE_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';
const LANDING_PAGE_URL = 'https://teambuildpro.com';

// A/B Test Variants (must match email-campaign-contacts.js)
const AB_TEST_VARIANTS = {
  v3: {
    templateVersion: 'v3',
    subject: "This isn't another opportunity email",
    subjectTag: 'mobile_first_v3',
    description: 'Pattern interrupt - anti-pitch positioning (legacy)'
  },
  v4: {
    templateVersion: 'v4',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'mobile_first_v4',
    description: 'Flip the script - confidence before joining (legacy)'
  },
  v5: {
    templateVersion: 'v5',
    subject: 'Using AI to Build Your Direct Sales Team',
    subjectTag: 'mobile_first_v5',
    description: 'AI focus - direct sales team building (legacy)'
  },
  v6: {
    templateVersion: 'v6',
    subject: 'Using AI to Build Your Direct Sales Team',
    subjectTag: 'mobile_first_v6',
    description: 'AI focus - direct sales team building (legacy)'
  },
  v7: {
    templateVersion: 'v7',
    subject: 'The future of direct sales is here',
    subjectTag: 'mobile_first_v7',
    description: 'Conversational - personal app sharing'
  },
  v8: {
    templateVersion: 'v8',
    subject: 'Not an opportunity. Just a tool.',
    subjectTag: 'mobile_first_v8',
    description: 'Direct value proposition - tool focus'
  }
};

function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

function buildLandingPageUrl(utmCampaign, utmContent, firstName, lastName) {
  const params = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });

  // Add contact name for personalized welcome message on landing page
  if (firstName) {
    params.set('fn', firstName);
    if (lastName) {
      params.set('ln', lastName);
    }
  }

  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

async function sendTestEmail(toEmail, company, templateVariant) {
  if (!MAILGUN_API_KEY) {
    console.error('❌ TBP_MAILGUN_API_KEY not found in environment');
    process.exit(1);
  }

  const variant = AB_TEST_VARIANTS[templateVariant];
  if (!variant) {
    console.error(`❌ Invalid template variant: ${templateVariant}. Use v3, v4, v5, v6, v7, or v8`);
    process.exit(1);
  }

  // Use subject directly (no longer company-specific in v3/v4)
  const subject = variant.subject;

  // Use a test tracking ID
  const trackingId = `test_${Date.now()}`;

  // Test contact name for welcome bar
  const testFirstName = 'Test';
  const testLastName = 'User';

  // Build URLs (includes name for personalized welcome on landing page)
  const landingPageUrl = buildLandingPageUrl('direct_sales_contacts_test', variant.subjectTag, testFirstName, testLastName);
  const trackedCtaUrl = buildClickUrl(trackingId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(toEmail)}`;

  console.log('\n📧 Sending Test Email');
  console.log('━'.repeat(50));
  console.log(`To:       ${toEmail}`);
  console.log(`Company:  ${company}`);
  console.log(`Subject:  ${subject}`);
  console.log(`Template: ${templateVariant.toUpperCase()} → Mailgun version ${variant.templateVersion}`);
  console.log(`Tag:      ${variant.subjectTag}`);
  console.log('━'.repeat(50));

  // Build form data
  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', toEmail);
  form.append('subject', subject);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', variant.templateVersion);

  // Tracking disabled (using Firestore-based tracking)
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags
  form.append('o:tag', 'contacts_campaign_test');
  form.append('o:tag', variant.templateVersion);
  form.append('o:tag', variant.subjectTag);
  form.append('o:tag', 'test');

  // List-Unsubscribe headers
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  // Template variables
  const templateVars = {
    first_name: 'Test',
    company: company,
    tracked_cta_url: trackedCtaUrl,
    unsubscribe_url: unsubscribeUrl
  };
  form.append('h:X-Mailgun-Variables', JSON.stringify(templateVars));

  console.log('\nTemplate Variables:');
  console.log(JSON.stringify(templateVars, null, 2));

  try {
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
    console.log(`   Message ID: ${response.data.id}`);
    console.log(`   Response: ${response.data.message}`);

  } catch (error) {
    console.error('\n❌ Failed to send email:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const toEmail = args[0];
const company = args[1] || 'Herbalife';
const templateVariant = args[2] || 'v7';

if (!toEmail) {
  console.log('Usage: node test-contacts-email.js <email> [company] [v3|v4|v5|v6|v7|v8]');
  console.log('');
  console.log('Examples:');
  console.log('  node test-contacts-email.js scscot@gmail.com');
  console.log('  node test-contacts-email.js scscot@gmail.com "doTERRA"');
  console.log('  node test-contacts-email.js scscot@gmail.com "Herbalife" v7');
  console.log('  node test-contacts-email.js scscot@gmail.com "Herbalife" v8');
  process.exit(1);
}

sendTestEmail(toEmail, company, templateVariant);
