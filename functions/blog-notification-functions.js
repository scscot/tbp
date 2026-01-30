/**
 * Blog Notification Functions
 *
 * Handles sending email notifications for automated blog generation.
 * Triggered by Firestore document creation in 'blog_notifications' collection.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require('firebase-admin');
const { sendEmail, verifyConnection, closeConnection } = require('./email-smtp-sender');

// =============================================================================
// FIRESTORE TRIGGERED FUNCTION
// =============================================================================

/**
 * Send blog notification email when document is created
 *
 * Trigger: Firestore document creation in 'blog_notifications' collection
 *
 * Expected document structure:
 * {
 *   to: "email@example.com",
 *   subject: "Email subject",
 *   htmlBody: "<h1>HTML content</h1>",
 *   textBody: "Plain text content",
 *   createdAt: Timestamp,
 *   status: "pending"
 * }
 */
const sendBlogNotification = onDocumentCreated(
  {
    document: "blog_notifications/{docId}",
    region: "us-west1",
    timeoutSeconds: 60,
    memory: "256MiB"
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data in snapshot');
      return;
    }

    const data = snapshot.data();
    const docId = event.params.docId;

    console.log(`📧 Processing blog notification: ${docId}`);

    const { to, subject, htmlBody, textBody } = data;

    // Validate required fields
    if (!to || !subject || !htmlBody) {
      console.error('Missing required fields: to, subject, or htmlBody');
      await snapshot.ref.update({
        status: 'failed',
        error: 'Missing required fields',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    try {
      // Verify SMTP connection
      const isConnected = await verifyConnection();
      if (!isConnected) {
        throw new Error('SMTP connection verification failed');
      }

      // Send the email
      const result = await sendEmail({
        to: to,
        subject: subject,
        html: htmlBody,
        text: textBody || null,
        from: 'Stephen Scott Blog Bot <blog@news.teambuildpro.com>'
      });

      if (result.success) {
        console.log(`✅ Blog notification sent to ${to}: ${result.messageId}`);
        await snapshot.ref.update({
          status: 'sent',
          messageId: result.messageId,
          sentAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        console.error(`❌ Failed to send notification: ${result.error}`);
        await snapshot.ref.update({
          status: 'failed',
          error: result.error,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

    } catch (error) {
      console.error(`❌ Error sending blog notification: ${error.message}`);
      await snapshot.ref.update({
        status: 'failed',
        error: error.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } finally {
      closeConnection();
    }
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  sendBlogNotification
};
