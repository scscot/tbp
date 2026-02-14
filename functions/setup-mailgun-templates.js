/**
 * Setup Mailgun Templates for TBP Email Campaign
 *
 * Creates/updates the 'mailer' template with V1 and V2 versions.
 *
 * Usage:
 *   node setup-mailgun-templates.js
 *
 * Requires:
 *   - MAILGUN_API_KEY environment variable
 *   - MAILGUN_DOMAIN environment variable (defaults to news.teambuildpro.com)
 */

const axios = require('axios');
const FormData = require('form-data');

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || process.env.TBP_MAILGUN_DOMAIN || 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

// =============================================================================
// TEMPLATE CONTENT
// =============================================================================

/**
 * V1 Template: "Not an opportunity" - Personal Disarm Approach
 *
 * Variables expected:
 * - first_name: Recipient's first name
 * - tracked_cta_url: Click-tracked URL to landing page
 * - unsubscribe_url: Unsubscribe page URL
 */
const V1_HTML = `<!DOCTYPE html>
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
      I built something for people already in direct sales who want a better way to support their existing team.
    </p>

    <p style="margin:0 0 16px 0;">
      It's meant to help with things like:
    </p>

    <ul style="margin:0 0 16px 10px;">
      <li style="margin-bottom:6px;">knowing what to say without overthinking it</li>
      <li style="margin-bottom:6px;">giving new people structure instead of starting from zero</li>
      <li style="margin-bottom:0;">letting prospects build confidence before joining anything</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      It works alongside whatever company you're already with.
    </p>

    <p style="margin:0 0 16px 0;">
      If you're curious, you can take a look here: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Best,<br>
      Stephen Scott
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

/**
 * V2 Template: "Pre-Build Advantage" - Unique Differentiator Hook
 *
 * Variables expected:
 * - first_name: Recipient's first name
 * - tracked_cta_url: Click-tracked URL to landing page
 * - unsubscribe_url: Unsubscribe page URL
 */
const V2_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

    <p style="margin:0 0 16px 0;">
      Hi {{first_name}},
    </p>

    <p style="margin:0 0 16px 0;">
      What if your next recruit joined with <strong>20 people already lined up?</strong>
    </p>

    <p style="margin:0 0 16px 0;">
      That's what Team Build Pro does — it lets prospects pre-build their downline BEFORE they sign up. Day 1 momentum instead of Day 1 doubt.
    </p>

    <p style="margin:0 0 16px 0;">
      For you, that means:
    </p>

    <ul style="margin:0 0 16px 20px; padding:0; color:#1a1a1a;">
      <li style="margin-bottom:8px;">Recruits who stick (not quit in 90 days)</li>
      <li style="margin-bottom:8px;">A tool you hand off that does the heavy lifting</li>
      <li style="margin-bottom:0;">Growth that compounds while you focus elsewhere</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Works with any company. Fuels the one you already have.
    </p>

    <p style="margin:0 0 24px 0;">
      <a href="{{tracked_cta_url}}" style="color:#7c3aed; font-weight:600; text-decoration:none; font-size:17px;">&#8594; See how it works</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Best,<br>
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>
</body>
</html>`;

/**
 * V11 Template: Personal Disarm with Personalized Intro
 * (V1 with {{personalized_intro}} support)
 *
 * Variables expected:
 * - first_name: Recipient's first name
 * - personalized_intro: AI-generated personalized paragraph (optional)
 * - tracked_cta_url: Click-tracked URL to landing page
 * - unsubscribe_url: Unsubscribe page URL
 */
const V11_HTML = `<!DOCTYPE html>
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

    {{#if personalized_intro}}
    <p style="margin:0 0 16px 0;">
      {{personalized_intro}}
    </p>
    {{/if}}

    <p style="margin:0 0 16px 0;">
      I built an AI-driven app for people in direct sales who want a better way to recruit and support their existing team.
    </p>

    <p style="margin:0 0 16px 0;">
      Here's the idea: prospects can pre-build their team BEFORE they join — so they start Day 1 with momentum instead of doubt.
    </p>

    <p style="margin:0 0 16px 0;">
      You share it with them, they use it to line up their first contacts, and when they're ready to commit, they're not starting from zero.
    </p>

    <p style="margin:0 0 16px 0;">
      Works for new recruits or existing team members who need a jumpstart. It's compatible with any company.
    </p>

    <p style="margin:0 0 16px 0;">
      If you're curious, you can take a look here: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Here's to your continued success,
    </p>

    <p style="margin:0 0 16px 0;">
      Stephen Scott<br>
      Founder, Team Build Pro
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>
</body>
</html>`;

/**
 * V12 Template: Pre-Build Advantage with Personalized Intro
 * (V2 with {{personalized_intro}} support)
 *
 * Variables expected:
 * - first_name: Recipient's first name
 * - personalized_intro: AI-generated personalized paragraph (optional)
 * - tracked_cta_url: Click-tracked URL to landing page
 * - unsubscribe_url: Unsubscribe page URL
 */
const V12_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

    <p style="margin:0 0 16px 0;">
      Hi {{first_name}},
    </p>

    <p style="margin:0 0 16px 0;">
      I'm not recruiting you, and this isn't an opportunity.
    </p>

    {{#if personalized_intro}}
    <p style="margin:0 0 16px 0;">
      {{personalized_intro}}
    </p>
    {{/if}}

    <p style="margin:0 0 16px 0;">
      What if your next recruit joined with <strong>20 people already lined up?</strong>
    </p>

    <p style="margin:0 0 16px 0;">
      I created an AI-driven app called <b>Team Build Pro</b> that does exactly that — it lets prospects pre-build their downline BEFORE they sign up. Day 1 momentum instead of Day 1 doubt.
    </p>

    <p style="margin:0 0 16px 0;">
      You share it with them, they use it to line up their first contacts, and when they're ready to commit, they're not starting from zero.
    </p>

    <p style="margin:0 0 16px 0;">
      Works for new recruits or existing team members who need a jumpstart. It's compatible with any company.
    </p>

    <p style="margin:0 0 16px 0;">
      If you're curious, you can take a look here: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Here's to your continued success,
    </p>

    <p style="margin:0 0 16px 0;">
      Stephen Scott<br>
      Founder, Team Build Pro
    </p>

    <!-- Footer -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>
</body>
</html>`;

// Plain text versions (with personalized_intro support)
const V11_TEXT = `Hello {{first_name}},

I'm not recruiting you, and this isn't an opportunity.

{{#if personalized_intro}}
{{personalized_intro}}

{{/if}}
I built an AI-driven app for people in direct sales who want a better way to recruit and support their existing team.

Here's the idea: prospects can pre-build their team BEFORE they join — so they start Day 1 with momentum instead of doubt.

You share it with them, they use it to line up their first contacts, and when they're ready to commit, they're not starting from zero.

Works for new recruits or existing team members who need a jumpstart. It's compatible with any company.

If you're curious, you can take a look here:
{{tracked_cta_url}}

Here's to your continued success,

Stephen Scott
Founder, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

const V12_TEXT = `Hi {{first_name}},

I'm not recruiting you, and this isn't an opportunity.

{{#if personalized_intro}}
{{personalized_intro}}

{{/if}}
What if your next recruit joined with 20 people already lined up?

I created an AI-driven app called Team Build Pro that does exactly that — it lets prospects pre-build their downline BEFORE they sign up. Day 1 momentum instead of Day 1 doubt.

You share it with them, they use it to line up their first contacts, and when they're ready to commit, they're not starting from zero.

Works for new recruits or existing team members who need a jumpstart. It's compatible with any company.

If you're curious, you can take a look here:
{{tracked_cta_url}}

Here's to your continued success,

Stephen Scott
Founder, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

// Plain text versions
const V1_TEXT = `Hello {{first_name}},

I'm not recruiting you, and this isn't an opportunity.

I built something for people already in direct sales who want a better way to support their existing team.

It's meant to help with things like:

* knowing what to say without overthinking it
* giving new people structure instead of starting from zero
* letting prospects build confidence before joining anything

It works alongside whatever company you're already with.

If you're curious, you can take a look here:
{{tracked_cta_url}}

Best,
Stephen Scott

---
teambuildpro.com
Unsubscribe: {{unsubscribe_url}}`;

const V2_TEXT = `Hi {{first_name}},

What if your next recruit joined with 20 people already lined up?

That's what Team Build Pro does — it lets prospects pre-build their downline BEFORE they sign up. Day 1 momentum instead of Day 1 doubt.

For you, that means:

* Recruits who stick (not quit in 90 days)
* A tool you hand off that does the heavy lifting
* Growth that compounds while you focus elsewhere

Works with any company. Fuels the one you already have.

-> See how it works: {{tracked_cta_url}}

Best,
Stephen Scott

---
teambuildpro.com
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// MAILGUN API HELPERS
// =============================================================================

function getAuthHeader() {
  return `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`;
}

async function createOrUpdateTemplate() {
  const baseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates`;

  // Check if template exists
  try {
    await axios.get(`${baseUrl}/${TEMPLATE_NAME}`, {
      headers: { 'Authorization': getAuthHeader() }
    });
    console.log(`✅ Template '${TEMPLATE_NAME}' already exists`);
  } catch (error) {
    if (error.response?.status === 404) {
      // Create template
      console.log(`📝 Creating template '${TEMPLATE_NAME}'...`);
      const form = new FormData();
      form.append('name', TEMPLATE_NAME);
      form.append('description', 'TBP Email Campaign Template');

      await axios.post(baseUrl, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': getAuthHeader()
        }
      });
      console.log(`✅ Template '${TEMPLATE_NAME}' created`);
    } else {
      throw error;
    }
  }
}

async function createOrUpdateVersion(tag, html, text, description) {
  const baseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions`;

  // Try to update existing version first
  try {
    const form = new FormData();
    form.append('template', html);
    form.append('comment', description);
    form.append('active', 'yes');

    await axios.put(`${baseUrl}/${tag}`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': getAuthHeader()
      }
    });
    console.log(`✅ Updated version '${tag}'`);
    return;
  } catch (error) {
    if (error.response?.status !== 404) {
      // If not a 404, it's a real error
      if (error.response?.status !== 400) {
        throw error;
      }
    }
  }

  // Create new version
  console.log(`📝 Creating version '${tag}'...`);
  const form = new FormData();
  form.append('tag', tag);
  form.append('template', html);
  form.append('comment', description);
  form.append('active', 'yes');

  try {
    await axios.post(baseUrl, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': getAuthHeader()
      }
    });
    console.log(`✅ Created version '${tag}'`);
  } catch (error) {
    console.error(`❌ Failed to create version '${tag}':`, error.response?.data || error.message);
    throw error;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('TBP Mailgun Template Setup');
  console.log('='.repeat(60));
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log(`Template: ${TEMPLATE_NAME}`);
  console.log('');

  if (!MAILGUN_API_KEY) {
    console.error('❌ MAILGUN_API_KEY environment variable not set');
    console.log('Usage: MAILGUN_API_KEY=your-key node setup-mailgun-templates.js');
    process.exit(1);
  }

  try {
    // Create or verify template exists
    await createOrUpdateTemplate();

    // Create/update V1 version
    console.log('\n--- V1: Personal Disarm ---');
    await createOrUpdateVersion('v1', V1_HTML, V1_TEXT, 'V1: Not an opportunity - Personal disarm approach');

    // Create/update V2 version
    console.log('\n--- V2: Pre-Build Advantage ---');
    await createOrUpdateVersion('v2', V2_HTML, V2_TEXT, 'V2: Pre-Build Advantage - Unique differentiator hook');

    // Create/update V11 version (V1 + personalized_intro)
    console.log('\n--- V11: Personal Disarm + AI Personalization ---');
    await createOrUpdateVersion('v11', V11_HTML, V11_TEXT, 'V11: V1 with personalized_intro support for BFH AI campaign');

    // Create/update V12 version (V2 + personalized_intro)
    console.log('\n--- V12: Pre-Build Advantage + AI Personalization ---');
    await createOrUpdateVersion('v12', V12_HTML, V12_TEXT, 'V12: V2 with personalized_intro support for BFH AI campaign');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Template setup complete!');
    console.log('='.repeat(60));
    console.log('\nTemplate variables expected:');
    console.log('  - first_name: Recipient first name');
    console.log('  - tracked_cta_url: Click-tracked landing page URL');
    console.log('  - unsubscribe_url: Unsubscribe page URL');
    console.log('  - personalized_intro: AI-generated intro (V11/V12 only, optional)');
    console.log('\nVersions created:');
    console.log('  - v1: "Not an opportunity. Just a tool."');
    console.log('  - v2: "What if your next recruit already had a team?"');
    console.log('  - v11: V1 + personalized_intro support (BFH AI campaign)');
    console.log('  - v12: V2 + personalized_intro support (BFH AI campaign)');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
