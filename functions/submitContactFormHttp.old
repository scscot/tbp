const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');

// Import fetch for Node.js compatibility
const fetch = require('node-fetch');

if (!admin.apps.length) {
  admin.initializeApp();
}

const recaptchaSecretKey = defineSecret('RECAPTCHA_SECRET_KEY');

exports.submitContactFormHttp = onRequest({ cors: true, secrets: [recaptchaSecretKey] }, async (req, res) => {
  console.log("=== CONTACT FORM DEBUG LOGS ===");
  console.log("V2 ENTERPRISE FUNCTION ACTIVATED");
  console.log("Request method:", req.method);
  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  console.log("Request body:", JSON.stringify(req.body, null, 2));

  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS preflight request");
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    console.log("Method not allowed:", req.method);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const data = req.body;
    console.log("Received form data:", JSON.stringify(data, null, 2));
    
    const recaptchaToken = data.recaptchaToken;
    console.log("reCAPTCHA token received:", recaptchaToken ? "Yes" : "No");

    if (!recaptchaToken) {
      console.log("ERROR: reCAPTCHA token is missing");
      res.status(400).json({ success: false, error: 'reCAPTCHA token is required' });
      return;
    }

    // --- RECAPTCHA v3 CONFIGURATION ---
    const secretKey = recaptchaSecretKey.value();

    console.log("reCAPTCHA secret key configured:", secretKey ? "Yes" : "No");
    
    if (!secretKey) {
      console.error('ERROR: reCAPTCHA secret key not configured');
      res.status(500).json({ success: false, error: 'Server configuration error' });
      return;
    }

    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;
    console.log("Verifying reCAPTCHA with Google...");

    const verificationBody = new URLSearchParams({
      secret: secretKey,
      response: recaptchaToken
    });

    console.log("Sending verification request to Google...");
    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: verificationBody
    });

    console.log("Google reCAPTCHA response status:", response.status);
    
    if (!response.ok) {
      console.error("Google reCAPTCHA HTTP error:", response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const verificationResult = await response.json();
    console.log("reCAPTCHA v3 Verification Result:", JSON.stringify(verificationResult, null, 2));

    // For reCAPTCHA v3, we check if verification succeeded and score is acceptable
    if (!verificationResult.success) {
      console.error('reCAPTCHA verification failed:', verificationResult['error-codes']);
      res.status(403).json({ success: false, error: 'reCAPTCHA verification failed' });
      return;
    }

    // Accept scores >= 0.3 (lower scores indicate higher risk)
    console.log("reCAPTCHA score:", verificationResult.score);
    if (verificationResult.score < 0.3) {
      console.error('reCAPTCHA score too low:', verificationResult.score);
      res.status(403).json({ success: false, error: 'Suspicious activity detected. Please try again.' });
      return;
    }

    console.log("reCAPTCHA verification successful, preparing to save data...");
    
    const contactData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      subject: data.subject,
      message: data.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      recaptchaScore: verificationResult.score
    };

    console.log("Saving contact data to Firestore:", JSON.stringify(contactData, null, 2));
    
    await admin.firestore().collection('contactSubmissions').add(contactData);
    console.log("Contact form data saved successfully");
    
    res.status(200).json({ success: true, message: 'Contact form submitted successfully.' });

  } catch (error) {
    console.error('ERROR processing HTTP contact form:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ success: false, error: 'Failed to process contact form' });
  }
});
