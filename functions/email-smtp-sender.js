/**
 * SMTP Email Sender Module
 *
 * Provides SMTP-based email sending using nodemailer.
 * Configured for Dreamhost SMTP server.
 */

const nodemailer = require('nodemailer');
const { defineString } = require("firebase-functions/params");

// =============================================================================
// SMTP CONFIGURATION PARAMETERS
// =============================================================================

const smtpHost = defineString("TBP_SMTP_HOST", { default: "smtp.dreamhost.com" });
const smtpPort = defineString("TBP_SMTP_PORT", { default: "587" });
const smtpUser = defineString("TBP_SMTP_USER");
const smtpPass = defineString("TBP_SMTP_PASS");

// =============================================================================
// CONSTANTS
// =============================================================================

const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';

// Transporter instance (lazy initialization)
let transporterInstance = null;

// =============================================================================
// TRANSPORTER MANAGEMENT
// =============================================================================

/**
 * Get or create the SMTP transporter
 * Uses lazy initialization to avoid creating connection before needed
 *
 * @returns {object} Nodemailer transporter
 */
function getTransporter() {
  if (!transporterInstance) {
    const host = smtpHost.value();
    const port = parseInt(smtpPort.value());
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
      throw new Error('SMTP credentials not configured. Set TBP_SMTP_USER and TBP_SMTP_PASS environment variables.');
    }

    transporterInstance = nodemailer.createTransport({
      host: host,
      port: port,
      secure: false, // Use STARTTLS
      requireTLS: true,
      auth: {
        user: user,
        pass: pass
      },
      tls: {
        rejectUnauthorized: true
      },
      // Connection pool settings for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    });

    console.log(`📧 SMTP transporter initialized: ${host}:${port}`);
  }

  return transporterInstance;
}

/**
 * Verify SMTP connection
 * Useful for health checks before sending batches
 *
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function verifyConnection() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return false;
  }
}

/**
 * Close the SMTP connection pool
 * Call this at the end of batch processing
 */
function closeConnection() {
  if (transporterInstance) {
    transporterInstance.close();
    transporterInstance = null;
    console.log('📧 SMTP connection closed');
  }
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Send an email via SMTP
 *
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.toName - Recipient name (optional)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional, recommended)
 * @param {string} options.from - From address (optional, defaults to FROM_ADDRESS)
 * @returns {Promise<object>} Send result with messageId
 */
async function sendEmail(options) {
  const {
    to,
    toName,
    subject,
    html,
    text,
    from = FROM_ADDRESS
  } = options;

  const transporter = getTransporter();

  // Format recipient address
  const toAddress = toName ? `${toName} <${to}>` : to;

  const mailOptions = {
    from: from,
    to: toAddress,
    subject: subject,
    html: html
  };

  // Add plain text version if provided
  if (text) {
    mailOptions.text = text;
  }

  try {
    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      response: result.response
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Send an email to a contact with tracking
 *
 * Convenience wrapper that handles the full flow:
 * 1. Generate HTML with tracking
 * 2. Send via SMTP
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
    text: textContent
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  getTransporter,
  verifyConnection,
  closeConnection,
  sendEmail,
  sendTrackedEmail,
  FROM_ADDRESS
};
