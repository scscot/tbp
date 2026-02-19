/**
 * Update Mailgun v9 template with credentials version and send test email
 */

const axios = require('axios');
const FormData = require('form-data');

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';
const VERSION_TAG = 'v9';

// New v9 template with credentials
const V9_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

    <p style="margin:0 0 16px 0;">
      Hello {{first_name}},
    </p>

    <p style="margin:0 0 16px 0;">
      I'm not recruiting you, and this isn't an opportunity.
    </p>

    <p style="margin:0 0 16px 0;">
      After 20+ years building tools for direct sales and training thousands of team builders, I kept seeing the same problem: new recruits quit before they ever get momentum. So I built something to fix that.
    </p>

    <p style="margin:0 0 16px 0;">
      Team Build Pro is an AI tool for people in direct sales who want a better way to support their team. It helps with things like:
    </p>

    <ul style="margin:0 0 16px 10px;">
      <li style="margin-bottom:6px;">knowing what to say without overthinking it</li>
      <li style="margin-bottom:6px;">giving new people structure instead of starting from zero</li>
      <li style="margin-bottom:0;">letting prospects build confidence before joining</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      It works alongside whatever company you're already with.
    </p>

    <p style="margin:0 0 16px 0;">
      If you're curious: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Best,<br>
      Stephen Scott<br>
      <span style="font-size:13px; color:#666;">Founder, Team Build Pro<br>
      Author, <em>How to Grow Your Network Marketing Business Using AI</em></span>
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
      &nbsp;·&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>
</body>
</html>`;

const V9_TEXT = `Hello {{first_name}},

I'm not recruiting you, and this isn't an opportunity.

After 20+ years building tools for direct sales and training thousands of team builders, I kept seeing the same problem: new recruits quit before they ever get momentum. So I built something to fix that.

Team Build Pro is an AI tool for people in direct sales who want a better way to support their team. It helps with things like:

* knowing what to say without overthinking it
* giving new people structure instead of starting from zero
* letting prospects build confidence before joining

It works alongside whatever company you're already with.

If you're curious: {{tracked_cta_url}}

Best,
Stephen Scott
Founder, Team Build Pro
Author, How to Grow Your Network Marketing Business Using AI

---
teambuildpro.com
Unsubscribe: {{unsubscribe_url}}`;

async function updateTemplate() {
  console.log('Updating v9 template in Mailgun...');

  const form = new FormData();
  form.append('template', V9_HTML);
  form.append('text', V9_TEXT);
  form.append('active', 'yes');

  try {
    const response = await axios.put(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions/${VERSION_TAG}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log('✅ Template v9 updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating template:', error.response?.data || error.message);
    return false;
  }
}

async function sendTestEmail() {
  console.log('\nSending test email to scscot@gmail.com...');

  const trackingId = 'test_v9_credentials_' + Date.now();
  const landingPageUrl = 'https://teambuildpro.com?utm_source=mailgun&utm_medium=email&utm_campaign=tbp_outreach_test&utm_content=v9_credentials';
  const trackedUrl = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/trackEmailClick?id=' + trackingId + '&url=' + encodeURIComponent(landingPageUrl);
  const unsubscribeUrl = 'https://teambuildpro.com/unsubscribe.html?email=' + encodeURIComponent('scscot@gmail.com');

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', 'Stephen <scscot@gmail.com>');
  form.append('subject', 'Not an opportunity. Just a tool. [TEST v9 with credentials]');
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', VERSION_TAG);
  form.append('t:text', 'yes');
  form.append('o:tag', 'test_v9_credentials');
  form.append('o:tracking', 'false');
  form.append('o:tracking-opens', 'false');
  form.append('o:tracking-clicks', 'false');
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: 'Stephen',
    tracked_cta_url: trackedUrl,
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
    console.log('✅ Test email sent successfully');
    console.log('   Message ID:', response.data.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending test email:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  if (!MAILGUN_API_KEY) {
    console.error('❌ TBP_MAILGUN_API_KEY environment variable not set');
    process.exit(1);
  }

  const updated = await updateTemplate();
  if (updated) {
    await sendTestEmail();
  }
}

main();
