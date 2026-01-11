/**
 * Team Build Pro SMTP Email Template
 *
 * Professional HTML email template with embedded tracking:
 * - Click tracking via redirect URLs
 * - UTM parameters for GA4 attribution
 */

// Base URL for tracking endpoints
const TRACKING_BASE_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';

// Destination URL for CTA
const LANDING_PAGE_URL = 'https://teambuildpro.com';

/**
 * Build a click-tracked URL
 * @param {string} trackingId - Contact document ID for tracking
 * @param {string} destinationUrl - Final destination URL
 * @returns {string} Click tracking URL that redirects to destination
 */
function buildClickUrl(trackingId, destinationUrl) {
  const encodedUrl = encodeURIComponent(destinationUrl);
  return `${TRACKING_BASE_URL}/trackEmailClick?id=${trackingId}&url=${encodedUrl}`;
}

/**
 * Build the open tracking pixel URL
 * @param {string} trackingId - Contact document ID for tracking
 * @returns {string} Open tracking pixel URL
 */
function buildOpenPixelUrl(trackingId) {
  return `${TRACKING_BASE_URL}/trackEmailOpen?id=${trackingId}`;
}

/**
 * Build destination URL with UTM parameters
 * @param {object} options - UTM configuration
 * @returns {string} Landing page URL with UTM params
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
 * Generate the email HTML content
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} trackingId - Contact document ID for tracking
 * @param {object} config - Campaign configuration
 * @param {string} config.subjectTag - Subject line identifier for UTM
 * @param {string} config.utmCampaign - UTM campaign name
 * @param {string} seasonalSignoff - Optional seasonal greeting (unused in new template)
 * @returns {string} Complete HTML email
 */
function generateEmailHTML(contact, trackingId, config, seasonalSignoff = '') {
  const { firstName } = contact;
  const { subjectTag = 'default', utmCampaign = 'tbp_campaign' } = config;

  // Build tracked URLs
  const landingPageUrl = buildLandingPageUrl({
    utmSource: 'email',
    utmMedium: 'smtp',
    utmCampaign: utmCampaign,
    utmContent: subjectTag
  });

  const trackedCtaUrl = buildClickUrl(trackingId, landingPageUrl);

  // Simple unsubscribe URL (no tracking needed for one-time campaign)
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
      Hello ${firstName},
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
      If you're curious, you can take a look here: <a href="${trackedCtaUrl}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Best,<br>
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="${trackedCtaUrl}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
      &nbsp;·&nbsp;
      <a href="${unsubscribeUrl}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Generate plain text version of email
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} trackingId - Contact document ID for tracking
 * @param {object} config - Campaign configuration
 * @param {string} seasonalSignoff - Optional seasonal greeting (unused in new template)
 * @returns {string} Plain text email
 */
function generateEmailPlainText(contact, trackingId, config, seasonalSignoff = '') {
  const { firstName } = contact;
  const { subjectTag = 'default', utmCampaign = 'tbp_campaign' } = config;

  const landingPageUrl = buildLandingPageUrl({
    utmSource: 'email',
    utmMedium: 'smtp',
    utmCampaign: utmCampaign,
    utmContent: subjectTag
  });

  // For plain text, we use the tracked URL directly
  const trackedCtaUrl = buildClickUrl(trackingId, landingPageUrl);
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html`;

  return `Hello ${firstName},

I'm not recruiting you, and this isn't an opportunity.

I built something for people already in direct sales who want a better way to support their existing team.

It's meant to help with things like:

* knowing what to say without overthinking it
* giving new people structure instead of starting from zero
* letting prospects build confidence before joining anything

It works alongside whatever company you're already with.

If you're curious, you can take a look here:
${trackedCtaUrl}

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
  buildOpenPixelUrl,
  buildLandingPageUrl
};
