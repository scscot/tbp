#!/usr/bin/env node
/**
 * Update V19 Mailgun Templates (A/B/C Testing with Generic Greeting)
 *
 * Creates/updates all V19 template versions for A/B/C testing.
 * V19 uses "Greetings!" instead of "Hello {{first_name}}" for campaigns
 * where usable first names are not available (e.g., THREE International).
 *
 * - v19-a: Curiosity Hook - "What if your next recruit joined with 12 people?"
 * - v19-b: Pain Point Hook - "75% of your recruits will quit this year (here's why)"
 * - v19-c: Direct Value Hook - "Give your prospects an AI recruiting coach"
 *
 * Usage:
 *   node scripts/update-v19-templates.js           # Update all V19 templates
 *   node scripts/update-v19-templates.js --test    # Send test emails after update
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

// Load environment variables from functions/.env file
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

// =============================================================================
// V19-A CURIOSITY HOOK - GENERIC GREETING
// Subject: "What if your next recruit joined with 12 people?"
// =============================================================================
const V19_A_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          AI-Powered Mobile App for Direct Sales Growth
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">Greetings!</p>

      <p style="margin:0 0 16px 0;">What if your next recruit showed up on Day 1 with 12 people already in their downline?</p>

      <p style="margin:0 0 16px 0;">That's exactly what Team Build Pro does.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app that lets prospects pre-build their team BEFORE they even sign up with your company. No more cold starts. No more "I'll try it for 30 days" dropouts.</p>

      <p style="margin:0 0 16px 0;">Here's how it works:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Prospects use AI-powered tools to recruit while they're still deciding</li>
        <li>They build real momentum before making any commitment</li>
        <li>When they join YOUR business, they already have a team</li>
      </ul>

      <p style="margin:0 0 16px 0;">75% of new recruits quit in their first year. This changes that.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V19_A_TEXT = `Greetings!

What if your next recruit showed up on Day 1 with 12 people already in their downline?

That's exactly what Team Build Pro does.

It's a mobile app that lets prospects pre-build their team BEFORE they even sign up with your company. No more cold starts. No more "I'll try it for 30 days" dropouts.

Here's how it works:

- Prospects use AI-powered tools to recruit while they're still deciding
- They build real momentum before making any commitment
- When they join YOUR business, they already have a team

75% of new recruits quit in their first year. This changes that.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V19-B PAIN POINT HOOK - GENERIC GREETING
// Subject: "75% of your recruits will quit this year (here's why)"
// =============================================================================
const V19_B_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          AI-Powered Mobile App for Direct Sales Growth
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">Greetings!</p>

      <p style="margin:0 0 16px 0;">75% of new direct sales recruits quit within their first year.</p>

      <p style="margin:0 0 16px 0;">Not because they're lazy. Not because the business doesn't work.</p>

      <p style="margin:0 0 16px 0;">Because they start from zero. No team. No momentum. No structure.</p>

      <p style="margin:0 0 16px 0;">By day 30, doubt sets in. By day 60, they're gone.</p>

      <p style="margin:0 0 16px 0;">I built Team Build Pro to fix this.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app that lets your prospects pre-build their downline BEFORE they officially join. They show up on Day 1 with momentum instead of starting from scratch.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro<br>Author, <em>How to Grow Your Network Marketing Business Using AI</em></p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V19_B_TEXT = `Greetings!

75% of new direct sales recruits quit within their first year.

Not because they're lazy. Not because the business doesn't work.

Because they start from zero. No team. No momentum. No structure.

By day 30, doubt sets in. By day 60, they're gone.

I built Team Build Pro to fix this.

It's a mobile app that lets your prospects pre-build their downline BEFORE they officially join. They show up on Day 1 with momentum instead of starting from scratch.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro
Author, How to Grow Your Network Marketing Business Using AI

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V19-C DIRECT VALUE HOOK - GENERIC GREETING
// Subject: "Give your prospects an AI recruiting coach"
// =============================================================================
const V19_C_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          AI-Powered Mobile App for Direct Sales Growth
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">Greetings!</p>

      <p style="margin:0 0 16px 0;">Imagine if every prospect you talked to had access to:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>A 24/7 AI coach that answers their recruiting questions</li>
        <li>16 pre-written messages they can send immediately</li>
        <li>The ability to start building their team TODAY</li>
      </ul>

      <p style="margin:0 0 16px 0;">That's Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app I built specifically for direct sales professionals who want to give their prospects real tools, not just hope.</p>

      <p style="margin:0 0 16px 0;">The best part? They can pre-build their downline BEFORE they even sign up with your company. Day 1 momentum instead of Day 1 doubt.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V19_C_TEXT = `Greetings!

Imagine if every prospect you talked to had access to:

- A 24/7 AI coach that answers their recruiting questions
- 16 pre-written messages they can send immediately
- The ability to start building their team TODAY

That's Team Build Pro.

It's a mobile app I built specifically for direct sales professionals who want to give their prospects real tools, not just hope.

The best part? They can pre-build their downline BEFORE they even sign up with your company. Day 1 momentum instead of Day 1 doubt.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// TEMPLATE DEFINITIONS (3 total: A/B/C variants with generic greeting)
// =============================================================================

const templates = [
  // V19-A Curiosity Hook
  { version: 'v19-a', html: V19_A_HTML, text: V19_A_TEXT, description: 'Curiosity Hook (Generic Greeting)', subject: 'What if your next recruit joined with 12 people?', domain: 'teambuildpro.com' },

  // V19-B Pain Point Hook
  { version: 'v19-b', html: V19_B_HTML, text: V19_B_TEXT, description: 'Pain Point Hook (Generic Greeting)', subject: "75% of your recruits will quit this year (here's why)", domain: 'teambuildpro.com' },

  // V19-C Direct Value Hook
  { version: 'v19-c', html: V19_C_HTML, text: V19_C_TEXT, description: 'Direct Value Hook (Generic Greeting)', subject: 'Give your prospects an AI recruiting coach', domain: 'teambuildpro.com' }
];

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function updateTemplate(version, html, text, description) {
  console.log(`Updating ${version} (${description})...`);

  const form = new FormData();
  form.append('template', html);
  form.append('text', text);
  form.append('active', 'yes');

  try {
    // Try PUT first (update existing)
    const response = await axios.put(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions/${version}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  Updated ${version}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      // Template version doesn't exist, create it
      console.log(`  Creating new version ${version}...`);
      return await createTemplate(version, html, text, description);
    }
    console.error(`  Error updating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function createTemplate(version, html, text, description) {
  const form = new FormData();
  form.append('tag', version);
  form.append('template', html);
  form.append('text', text);
  form.append('active', 'yes');

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  Created ${version}`);
    return true;
  } catch (error) {
    console.error(`  Error creating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function sendTestEmail(version, subject, domain) {
  console.log(`Sending test email for ${version}...`);

  const landingPageUrl = `https://${domain}?utm_source=mailgun&utm_medium=email&utm_campaign=v19_test&utm_content=${version}`;
  const unsubscribeUrl = `https://${domain}/unsubscribe.html?email=scscot@gmail.com`;

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', 'Stephen Scott <scscot@gmail.com>');
  form.append('subject', `${subject} [TEST ${version.toUpperCase()}]`);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', version);
  form.append('t:text', 'yes');
  form.append('o:tag', `test_${version}`);
  form.append('o:tracking', 'false');
  form.append('o:tracking-opens', 'false');
  form.append('o:tracking-clicks', 'false');
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  }));

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  Sent test for ${version}: ${response.data.id}`);
    return true;
  } catch (error) {
    console.error(`  Error sending test email:`, error.response?.data || error.message);
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const sendTest = args.includes('--test');

  if (!MAILGUN_API_KEY) {
    console.error('TBP_MAILGUN_API_KEY environment variable not set');
    console.error('Make sure functions/.env.teambuilder-plus-fe74d exists');
    process.exit(1);
  }

  console.log('Updating V19 Mailgun Templates (A/B/C Testing - Generic Greeting)');
  console.log('=================================================================');
  console.log('');
  console.log('V19 templates use "Greetings!" instead of "Hello {{first_name}}"');
  console.log('Used for campaigns where usable first names are not available.');
  console.log('');
  console.log('V19-A: Curiosity Hook - "What if your next recruit joined with 12 people?"');
  console.log('V19-B: Pain Point Hook - "75% of your recruits will quit this year..."');
  console.log('V19-C: Direct Value Hook - "Give your prospects an AI recruiting coach"');
  console.log('');

  let successCount = 0;

  for (const { version, html, text, description } of templates) {
    const success = await updateTemplate(version, html, text, description);
    if (success) successCount++;
  }

  if (sendTest && successCount === templates.length) {
    console.log('\n--- Sending Test Emails ---');
    for (const { version, subject, domain } of templates) {
      await sendTestEmail(version, subject, domain);
    }
  }

  console.log('\n=================================================================');
  console.log(`${successCount}/${templates.length} templates updated successfully`);

  if (!sendTest) {
    console.log('\nRun with --test flag to send test emails:');
    console.log('  node scripts/update-v19-templates.js --test');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
