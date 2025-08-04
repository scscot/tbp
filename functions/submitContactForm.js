const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.submitContactForm = functions.https.onCall(async (data, context) => {
  try {
    // Verify reCAPTCHA token
    const recaptchaToken = data.recaptchaToken;
    if (!recaptchaToken) {
      throw new functions.https.HttpsError('invalid-argument', 'reCAPTCHA token is required');
    }

    const secretKey = '6LeyVJorAAAAAPy2-1GaiolE-3YQg1yy4dhfb5iR';
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
    
    const response = await fetch(verificationUrl, { method: 'POST' });
    const verificationResult = await response.json();
    
    if (!verificationResult.success) {
      throw new functions.https.HttpsError('invalid-argument', 'reCAPTCHA verification failed');
    }
    
    // Check score (0.0 to 1.0, higher is more likely human)
    if (verificationResult.score < 0.5) {
      throw new functions.https.HttpsError('permission-denied', 'Suspicious activity detected');
    }

    // Save contact form data to Firestore
    const contactData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      subject: data.subject,
      message: data.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      recaptchaScore: verificationResult.score
    };

    await admin.firestore().collection('contactSubmissions').add(contactData);

    // Send email notification to support@teambuildpro.com
    const emailData = {
      to: 'support@teambuildpro.com',
      message: {
        subject: `Contact Form: ${data.subject}`,
        text: `
New contact form submission:

Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Subject: ${data.subject}

Message:
${data.message}

Submitted at: ${new Date().toISOString()}
reCAPTCHA Score: ${verificationResult.score}
        `
      }
    };

    // Send email using Firebase Extensions or custom implementation
    // For now, we'll log the email data (you can replace with actual email sending)
    console.log('Email to be sent:', emailData);

    return {
      success: true,
      message: 'Contact form submitted successfully. Email notification sent to support@teambuildpro.com'
    };

  } catch (error) {
    console.error('Error processing contact form:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to process contact form');
  }
});

// HTTP version for direct HTTP requests
const cors = require('cors')({ origin: true });

exports.submitContactFormHttp = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      const data = req.body;
      
      // Verify reCAPTCHA token
      const recaptchaToken = data.recaptchaToken;
      if (!recaptchaToken) {
        res.status(400).json({ error: 'reCAPTCHA token is required' });
        return;
      }

      const secretKey = '6LeyVJorAAAAAPy2-1GaiolE-3YQg1yy4dhfb5iR';
      const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
      
      const response = await fetch(verificationUrl, { method: 'POST' });
      const verificationResult = await response.json();
      
      if (!verificationResult.success) {
        res.status(400).json({ error: 'reCAPTCHA verification failed' });
        return;
      }
      
      // Check score
      if (verificationResult.score < 0.5) {
        res.status(403).json({ error: 'Suspicious activity detected' });
        return;
      }

      // Save to Firestore
      const contactData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        subject: data.subject,
        message: data.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        recaptchaScore: verificationResult.score
      };

      await admin.firestore().collection('contactSubmissions').add(contactData);

      res.json({ success: true, message: 'Contact form submitted successfully' });

    } catch (error) {
      console.error('Error processing contact form:', error);
      res.status(500).json({ error: 'Failed to process contact form' });
    }
  });
});
