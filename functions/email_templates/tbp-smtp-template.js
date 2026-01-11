/**
 * Team Build Pro SMTP Email Template
 *
 * Generates inline HTML email with embedded tracking:
 * - Open tracking pixel (1x1 transparent GIF)
 * - Click tracking via redirect URLs
 * - UTM parameters for GA4 attribution
 * - Seasonal sign-off support
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
 * @param {string} seasonalSignoff - Optional seasonal greeting
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
  const openPixelUrl = buildOpenPixelUrl(trackingId);

  // Build unsubscribe URL (can be updated to a proper unsubscribe endpoint)
  const unsubscribeUrl = `${LANDING_PAGE_URL}/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
  const trackedUnsubscribeUrl = buildClickUrl(trackingId, unsubscribeUrl);

  // Seasonal sign-off HTML (if provided)
  const seasonalHtml = seasonalSignoff
    ? `<p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">${seasonalSignoff}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Build Pro</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="padding: 10px; background-color: #ffffff;">
                            ${seasonalHtml}

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">${firstName},</p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                What if your recruits could start Day 1 with <strong>pre-built teams, proven skills, and real momentum?</strong>
                            </p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                That's what Team Build Pro delivers—an <strong>AI-powered downline building system</strong> that works before AND after they join your opportunity.
                            </p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                <strong>What your team gets:</strong>
                            </p>

                            <ul style="margin: 10px 0 10px 20px; font-size: 16px; line-height: 1.8; color: #333;">
                                <li><strong>24/7 AI Assistant in 4 languages</strong> (English, Spanish, Portuguese, German)</li>
                                <li><strong>Pre-building system</strong> that eliminates cold starts</li>
                                <li><strong>Real-time team tracking</strong> & analytics</li>
                                <li><strong>Secure team messaging</strong> & coaching tools</li>
                                <li>Works with <strong>any direct sales opportunity</strong></li>
                            </ul>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                <strong>The advantage:</strong> Your prospects build and qualify their teams BEFORE joining—hitting milestones (4 direct + 20 total) while still prospects. When they join YOUR business? They bring established teams, momentum, and confidence.
                            </p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                <strong>Even better:</strong> Team Build Pro becomes their perpetual recruiting engine AFTER they join—helping them build THEIR downlines with the same AI-powered tools.
                            </p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                <strong>Build globally:</strong> Full multilingual support means your team can recruit and coach in English, Spanish (Español), Portuguese (Português), and German (Deutsch)—all with localized AI coaching.
                            </p>

                            <div style="background-color: #f8f9fa; border-left: 4px solid #007AFF; padding: 15px; margin: 20px 0;">
                                <p style="margin:0 0 10px 0; font-size:17px; line-height:1.6; color:#333333;">
                                    <strong>Try it free for 30 days:</strong>
                                </p>
                                <p style="margin:0; font-size:16px; line-height:1.5;">
                                    <a href="${trackedCtaUrl}"
                                       style="color: #007AFF; text-decoration: underline; font-weight: 500;">
                                        Learn more at TeamBuildPro.com
                                    </a>
                                </p>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">
                                    Available on iOS and Android
                                </p>
                            </div>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                Not pitching an opportunity, ${firstName}—this is the AI downline-building system that fuels the growth you're already creating.
                            </p>

                            <p style="margin: 10px 0; font-size: 16px; line-height: 1.5; color: #333;">
                                If it doesn't help you recruit stronger leaders in 30 days, delete it. No commitment.
                            </p>

                            <p style="margin: 10px 0 0 0; font-size: 16px; color: #333;">
                                — Stephen Scott<br>
                                Creator, Team Build Pro
                            </p>

                            <p style="margin: 10px 0 0 0; font-size: 14px; font-style: italic; color: #000;">
                                <strong>P.S. Now available in 4 languages for global team building!</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">
                                Team Build Pro<br>
                                <a href="${trackedCtaUrl}" style="color: #007AFF; text-decoration: none;">teambuildpro.com</a>
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #999;">
                                <a href="${trackedUnsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Open Tracking Pixel -->
                <img src="${openPixelUrl}" width="1" height="1" alt="" style="display:none; width:1px; height:1px; border:0;" />
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Generate plain text version of email
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} trackingId - Contact document ID for tracking
 * @param {object} config - Campaign configuration
 * @param {string} seasonalSignoff - Optional seasonal greeting
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

  const seasonalText = seasonalSignoff ? `${seasonalSignoff}\n\n` : '';

  return `${seasonalText}${firstName},

What if your recruits could start Day 1 with pre-built teams, proven skills, and real momentum?

That's what Team Build Pro delivers—an AI-powered downline building system that works before AND after they join your opportunity.

What your team gets:
• 24/7 AI Assistant in 4 languages (English, Spanish, Portuguese, German)
• Pre-building system that eliminates cold starts
• Real-time team tracking & analytics
• Secure team messaging & coaching tools
• Works with any direct sales opportunity

The advantage: Your prospects build and qualify their teams BEFORE joining—hitting milestones (4 direct + 20 total) while still prospects. When they join YOUR business? They bring established teams, momentum, and confidence.

Even better: Team Build Pro becomes their perpetual recruiting engine AFTER they join—helping them build THEIR downlines with the same AI-powered tools.

Build globally: Full multilingual support means your team can recruit and coach in English, Spanish (Español), Portuguese (Português), and German (Deutsch)—all with localized AI coaching.

Try it free for 30 days:
${trackedCtaUrl}

Available on iOS and Android

Not pitching an opportunity, ${firstName}—this is the AI downline-building system that fuels the growth you're already creating.

If it doesn't help you recruit stronger leaders in 30 days, delete it. No commitment.

— Stephen Scott
Creator, Team Build Pro

P.S. Now available in 4 languages for global team building!

---
Team Build Pro
teambuildpro.com

To unsubscribe, visit: https://teambuildpro.com/unsubscribe.html?email=${encodeURIComponent(contact.email)}`;
}

module.exports = {
  generateEmailHTML,
  generateEmailPlainText,
  buildClickUrl,
  buildOpenPixelUrl,
  buildLandingPageUrl
};
