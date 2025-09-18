const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Callable function for use within your apps (e.g., Flutter, React Native).
 */
exports.submitContactForm = onCall(async (request) => {
  try {
    const data = request.data;
    const recaptchaToken = data.recaptchaToken;

    if (!recaptchaToken) {
      throw new HttpsError('invalid-argument', 'reCAPTCHA token is required');
    }

    const secretKey = '6Lfwj5orAAAAAM_4a6UOeYs8n5VFeflZfmliAAQk';
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;

    const response = await fetch(verificationUrl, { method: 'POST' });
    const verificationResult = await response.json();

    if (!verificationResult.success || verificationResult.score < 0.5) {
      console.error('reCAPTCHA verification failed. Score:', verificationResult.score);
      throw new HttpsError(
        'permission-denied',
        'reCAPTCHA verification failed. Suspicious activity detected.'
      );
    }

    const contactData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      subject: data.subject,
      message: data.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      recaptchaScore: verificationResult.score,
    };

    await admin.firestore().collection('contactSubmissions').add(contactData);

    console.log(`Contact form submitted successfully by ${data.email}`);

    return {
      success: true,
      message: 'Contact form submitted successfully.',
    };
  } catch (error) {
    console.error('Error processing callable contact form:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to process contact form');
  }
});
