#!/usr/bin/env node
/**
 * Test script to send a personalized BFH email
 * Usage: node test-bfh-personalized-email.js
 */

require('dotenv').config({ path: '.env.teambuilder-plus-fe74d' });
const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');

// Initialize Firebase (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud default)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.TBP_MAILGUN_DOMAIN || 'news.teambuildpro.com';
const TEST_RECIPIENT = 'scscot@gmail.com';

async function main() {
  console.log('🔍 Finding a personalized BFH contact...\n');

  // Find a contact with approved personalization
  const snapshot = await db.collection('bfh_contacts')
    .where('personalizationApproved', '==', true)
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('❌ No personalized contacts found');
    process.exit(1);
  }

  // Pick first one with personalizedSubject
  let selectedContact = null;
  let contactId = null;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.personalizedSubject) {
      selectedContact = data;
      contactId = doc.id;
      break;
    }
  }

  if (!selectedContact) {
    console.log('❌ No contacts with personalized subjects found');
    process.exit(1);
  }

  console.log('📧 Selected contact for test:');
  console.log(`   Name: ${selectedContact.fullName}`);
  console.log(`   Company: ${selectedContact.company}`);
  console.log(`   BFH URL: ${selectedContact.bfhProfileUrl}`);
  console.log(`   Subject: ${selectedContact.personalizedSubject}`);
  console.log(`   Score: ${selectedContact.selfValidationScore}/10`);
  console.log('');
  console.log('📝 Personalized Content:');
  console.log(`   "${selectedContact.personalizedIntro}"`);
  console.log('');

  // Build tracking URLs
  const utmParams = new URLSearchParams({
    utm_source: 'mailgun',
    utm_medium: 'email',
    utm_campaign: 'bfh_personalized_test',
    utm_content: 'test_v1'
  });
  const landingPageUrl = `https://teambuildpro.com?${utmParams.toString()}`;
  const trackingId = `bfh_test_${Date.now()}`;
  const trackedCtaUrl = `https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/trackEmailClick?id=${trackingId}&url=${encodeURIComponent(landingPageUrl)}`;
  const unsubscribeUrl = `https://teambuildpro.com/unsubscribe.html?email=${encodeURIComponent(TEST_RECIPIENT)}`;

  // Send via Mailgun with personalized subject
  console.log(`📤 Sending test email to: ${TEST_RECIPIENT}`);
  console.log(`   Using subject: "${selectedContact.personalizedSubject}"`);
  console.log('');

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', `Test <${TEST_RECIPIENT}>`);
  form.append('subject', selectedContact.personalizedSubject);
  form.append('template', 'mailer');
  form.append('t:version', 'v11'); // Use v11 template with personalized_intro support
  form.append('t:text', 'yes');
  form.append('o:tag', 'bfh_personalized_test');
  form.append('o:tag', 'test');
  form.append('o:tracking', 'false');
  form.append('o:tracking-opens', 'false');
  form.append('o:tracking-clicks', 'false');
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: selectedContact.firstName || selectedContact.fullName.split(' ')[0],
    personalized_intro: selectedContact.personalizedIntro,
    tracked_cta_url: trackedCtaUrl,
    unsubscribe_url: unsubscribeUrl
  }));

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')
        }
      }
    );

    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${response.data.id}`);
    console.log(`   Response: ${response.data.message}`);
    console.log('');
    console.log('📬 Check your inbox at scscot@gmail.com');
  } catch (error) {
    console.error('❌ Failed to send email:', error.response?.data || error.message);
  }

  process.exit(0);
}

main().catch(console.error);
