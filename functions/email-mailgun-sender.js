/**
 * Mailgun Email Sender Module
 *
 * Provides Mailgun API-based email sending for TBP campaigns.
 * Drop-in replacement for email-smtp-sender.js
 */

const axios = require('axios');
const FormData = require('form-data');
const { defineString } = require("firebase-functions/params");

// =============================================================================
// MAILGUN CONFIGURATION PARAMETERS
// =============================================================================

const mailgunApiKey = defineString("TBP_MAILGUN_API_KEY");
const mailgunDomain = defineString("TBP_MAILGUN_DOMAIN", { default: "news.teambuildpro.com" });

// =============================================================================
// CONSTANTS
// =============================================================================

const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';

// =============================================================================
// MAILGUN API HELPERS
// =============================================================================

/**
 * Get Mailgun base URL for the configured domain
 */
function getMailgunBaseUrl() {
  return `https://api.mailgun.net/v3/${mailgunDomain.value()}`;
}

/**
 * Get Mailgun auth headers
 */
function getAuthHeaders(form) {
  const apiKey = mailgunApiKey.value();
  if (!apiKey) {
    throw new Error('Mailgun API key not configured. Set TBP_MAILGUN_API_KEY environment variable.');
  }

  return {
    ...form.getHeaders(),
    'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
  };
}

/**
 * Verify Mailgun connection/credentials
 * Tests API access by fetching domain info
 *
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function verifyConnection() {
  try {
    const apiKey = mailgunApiKey.value();
    const domain = mailgunDomain.value();

    if (!apiKey) {
      console.error('❌ Mailgun API key not configured');
      return false;
    }

    // Test API access by getting domain info
    await axios.get(`https://api.mailgun.net/v3/domains/${domain}`, {
      auth: {
        username: 'api',
        password: apiKey
      }
    });

    console.log(`✅ Mailgun connection verified for domain: ${domain}`);
    return true;

  } catch (error) {
    console.error('❌ Mailgun connection failed:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Close connection (no-op for Mailgun, kept for interface compatibility)
 */
function closeConnection() {
  // Mailgun uses stateless API calls, no connection to close
  console.log('📧 Mailgun sender cleanup complete');
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Send an email via Mailgun API
 *
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.toName - Recipient name (optional)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional, recommended)
 * @param {string} options.from - From address (optional, defaults to FROM_ADDRESS)
 * @param {string[]} options.tags - Mailgun tags for tracking (optional)
 * @returns {Promise<object>} Send result with messageId
 */
async function sendEmail(options) {
  const {
    to,
    toName,
    subject,
    html,
    text,
    from = FROM_ADDRESS,
    tags = []
  } = options;

  try {
    const form = new FormData();

    // Format recipient address
    const toAddress = toName ? `${toName} <${to}>` : to;

    form.append('from', from);
    form.append('to', toAddress);
    form.append('subject', subject);
    form.append('html', html);

    // Add plain text version if provided
    if (text) {
      form.append('text', text);
    }

    // Enable tracking
    form.append('o:tracking', 'yes');
    form.append('o:tracking-opens', 'yes');
    form.append('o:tracking-clicks', 'yes');

    // Add tags for analytics
    form.append('o:tag', 'tbp_campaign');
    tags.forEach(tag => form.append('o:tag', tag));

    const response = await axios.post(`${getMailgunBaseUrl()}/messages`, form, {
      headers: getAuthHeaders(form)
    });

    return {
      success: true,
      messageId: response.data.id,
      accepted: [to],
      rejected: [],
      response: response.data.message
    };

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error(`❌ Mailgun send failed to ${to}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      code: error.response?.status || 'UNKNOWN'
    };
  }
}

/**
 * Send an email to a contact with tracking
 *
 * Convenience wrapper that handles the full flow:
 * 1. Generate HTML with tracking
 * 2. Send via Mailgun
 * 3. Return result for Firestore update
 *
 * @param {object} contact - Contact data { firstName, lastName, email }
 * @param {string} trackingId - Contact document ID for tracking
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Pre-generated HTML content with tracking
 * @param {string} textContent - Pre-generated plain text content (optional)
 * @returns {Promise<object>} Send result
 */
async function sendTrackedEmail(contact, trackingId, subject, htmlContent, textContent) {
  const { firstName, lastName, email } = contact;
  const toName = `${firstName} ${lastName}`.trim();

  return sendEmail({
    to: email,
    toName: toName,
    subject: subject,
    html: htmlContent,
    text: textContent,
    tags: ['tracked', trackingId]
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  verifyConnection,
  closeConnection,
  sendEmail,
  sendTrackedEmail,
  FROM_ADDRESS
};
