/**
 * Team Build Pro SMTP Email Template - V2 (A/B Test Variant)
 *
 * "Pre-Build Advantage" messaging:
 * - Leads with unique differentiator (prospects pre-build before joining)
 * - Benefit framed for the recipient (their recruits succeed = their team grows)
 * - Personal tone that tested well (8.3% open vs 2.4% marketing)
 * - Styled arrow CTA link
 *
 * Updated: 2026-01-23
 */

// Base URL for tracking endpoints
const TRACKING_BASE_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';

// Destination URL for CTA
const LANDING_PAGE_URL = 'https://teambuildpro.com';

/**
 * Build a click-tracked URL
 */
function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

/**
 * Build destination URL with UTM parameters
 */
function buildLandingPageUrl(options = {}) {
  const {
    utmSource = 'email',
    utmMedium = 'smtp',
    utmCampaign = 'tbp_campaign',
    utmContent = 'cta_link'
  } = options;

  const params = new URLSearchParams({
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent
  });

  return `${LANDING_PAGE_URL}?${params.toString()}`;
}

/**
 * Generate the email HTML content - V2 (Pre-Build Advantage)
 *
 * Key differences from V1:
 * - Opens with unique hook (prospects pre-build 20 people before joining)
 * - Benefit framed for recipient (their recruits succeed = their team grows)
 * - Styled arrow CTA link
 * - Personal tone maintained
 */
function generateEmailHTML(contact, trackingId, config, seasonalSignoff = '') {
  const { firstName } = contact;
  const { subjectTag = 'default', utmCampaign = 'tbp_campaign' } = config;

  // Build tracked URLs
  const landingPageUrl = buildLandingPageUrl({
    utmSource: 'email',
    utmMedium: 'smtp',
    utmCampaign: utmCampaign,
    utmContent: `${subjectTag}_v2`
  });

  const trackedCtaUrl = buildClickUrl(trackingId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html`;

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
  <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

    <p style="margin:0 0 16px 0;">
      Hi ${firstName},
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
      <a href="${trackedCtaUrl}" style="color:#7c3aed; font-weight:600; text-decoration:none; font-size:17px;">&#8594; See how it works</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Best,<br>
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
      <a href="${trackedCtaUrl}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="${unsubscribeUrl}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Generate plain text version - V2 (Pre-Build Advantage)
 */
function generateEmailPlainText(contact, trackingId, config, seasonalSignoff = '') {
  const { firstName } = contact;
  const { subjectTag = 'default', utmCampaign = 'tbp_campaign' } = config;

  const landingPageUrl = buildLandingPageUrl({
    utmSource: 'email',
    utmMedium: 'smtp',
    utmCampaign: utmCampaign,
    utmContent: `${subjectTag}_v2`
  });

  const trackedCtaUrl = buildClickUrl(trackingId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html`;

  return `Hi ${firstName},

What if your next recruit joined with 20 people already lined up?

That's what Team Build Pro does — it lets prospects pre-build their downline BEFORE they sign up. Day 1 momentum instead of Day 1 doubt.

For you, that means:

* Recruits who stick (not quit in 90 days)
* A tool you hand off that does the heavy lifting
* Growth that compounds while you focus elsewhere

Works with any company. Fuels the one you already have.

-> See how it works: ${trackedCtaUrl}

Best,
Stephen Scott

---
teambuildpro.com
Unsubscribe: ${unsubscribeUrl}`;
}

module.exports = {
  generateEmailHTML,
  generateEmailPlainText,
  buildClickUrl,
  buildLandingPageUrl
};
