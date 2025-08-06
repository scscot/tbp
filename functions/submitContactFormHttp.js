// All your existing imports
const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const fetch = require('node-fetch');

// --- NEW: Import SendGrid ---
const sgMail = require('@sendgrid/mail');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Define your secrets
const recaptchaSecretKey = defineSecret('RECAPTCHA_SECRET_KEY');
// --- NEW: Define SendGrid Secret ---
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

// --- NEW: Update function signature to include the new secret ---
exports.submitContactFormHttp = onRequest({ cors: true, secrets: [recaptchaSecretKey, sendgridApiKey] }, async (req, res) => {
  // ... (All existing CORS and method checks remain the same) ...
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const data = req.body;
    const recaptchaToken = data.recaptchaToken;

    // ... (All existing reCAPTCHA verification logic remains exactly the same) ...
    // ... This includes checking the token, verifying with Google, and checking the score ...
    const secretKey = recaptchaSecretKey.value();
    // (verification logic continues here...)

    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
    const verificationBody = new URLSearchParams({
      secret: secretKey,
      response: recaptchaToken
    });
    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verificationBody
    });
    const verificationResult = await response.json();

    if (!verificationResult.success || verificationResult.score < 0.3) {
      console.error('reCAPTCHA verification failed or score too low.');
      res.status(403).json({ success: false, error: 'reCAPTCHA verification failed.' });
      return;
    }

    // --- THIS IS THE MODIFIED SECTION ---
    console.log("reCAPTCHA verification successful, preparing to send email...");

    // Set the SendGrid API key
    sgMail.setApiKey(sendgridApiKey.value());

    // Create the email message object
    const msg = {
      to: 'support@teambuildpro.com', // Your support email
      from: 'support@teambuildpro.comm', // IMPORTANT: Use the domain you verified with SendGrid
      subject: `New Contact Form Submission: ${data.subject}`,
      replyTo: data.email, // Allows you to reply directly to the user from your email client
      html: `
        <p>You have received a new contact form submission.</p>
        <hr>
        <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <hr>
        <p><strong>Message:</strong></p>
        <p>${data.message}</p>
        <br>
        <p><em>reCAPTCHA Score: ${verificationResult.score}</em></p>
      `,
    };

    // Send the email
    await sgMail.send(msg);
    console.log("Contact form email sent successfully to support@teambuildpro.com");

    res.status(200).json({ success: true, message: 'Contact form submitted successfully.' });
    // --- END OF MODIFIED SECTION ---

  } catch (error) {
    console.error('ERROR processing contact form:', error);
    res.status(500).json({ success: false, error: 'Failed to process contact form' });
  }
});