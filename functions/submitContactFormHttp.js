const { onRequest } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const sgMail = require('@sendgrid/mail');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Define your secrets
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const recaptchaSecretKey = defineSecret('RECAPTCHA_SECRET_KEY');

exports.submitContactFormHttp = onRequest({ 
  cors: true, 
  secrets: [sendgridApiKey, recaptchaSecretKey] 
}, async (req, res) => {
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

    if (!recaptchaToken) {
      console.error('No reCAPTCHA token provided');
      res.status(400).json({ success: false, error: 'reCAPTCHA token required' });
      return;
    }

    // Get the API key from environment variables
    const recaptchaApiKey = recaptchaSecretKey.value();
    if (!recaptchaApiKey) {
      console.error('reCAPTCHA API key not configured');
      res.status(500).json({ success: false, error: 'Server configuration error' });
      return;
    }

    const projectId = '994629973621';

    console.log('Attempting reCAPTCHA Enterprise verification...');

    // Use reCAPTCHA Enterprise API for verification
    const assessmentUrl = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${recaptchaApiKey}`;
    
    const assessmentBody = {
      event: {
        token: recaptchaToken,
        expectedAction: 'submit',
        // Updated to use the same site key as in the HTML
        siteKey: '6Lfwj5orAAAAADS--lFfBYWuz1b4LiQVUlOHZiyE'
      }
    };

    // Use native fetch (available in Node.js 18+)
    const response = await fetch(assessmentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assessmentBody)
    });

    const assessment = await response.json();
    console.log('reCAPTCHA Enterprise assessment response:', JSON.stringify(assessment, null, 2));

    // Check if the assessment was successful
    if (!response.ok) {
      console.error('reCAPTCHA Enterprise API error:', assessment);
      res.status(403).json({ success: false, error: 'reCAPTCHA verification failed' });
      return;
    }

    // Validate the token properties
    const tokenProperties = assessment.tokenProperties;
    if (!tokenProperties.valid) {
      console.error('Invalid reCAPTCHA token:', tokenProperties.invalidReason);
      res.status(403).json({ 
        success: false, 
        error: `reCAPTCHA token invalid: ${tokenProperties.invalidReason}` 
      });
      return;
    }

    // Check the action matches
    if (tokenProperties.action !== 'submit') {
      console.error('reCAPTCHA action mismatch. Expected: submit, Got:', tokenProperties.action);
      res.status(403).json({ 
        success: false, 
        error: 'reCAPTCHA action mismatch' 
      });
      return;
    }

    // Check the risk analysis score
    const riskScore = assessment.riskAnalysis.score;
    console.log('reCAPTCHA risk score:', riskScore);
    
    if (riskScore < 0.3) {
      console.error('reCAPTCHA score too low:', riskScore);
      res.status(403).json({ 
        success: false, 
        error: 'reCAPTCHA verification failed - low score' 
      });
      return;
    }

    console.log("reCAPTCHA verification successful, preparing to send email...");

    // Set the SendGrid API key
    sgMail.setApiKey(sendgridApiKey.value());

    // Create the email message object
    const msg = {
      to: 'support@teambuildpro.com',
      from: 'support@teambuildpro.com',
      subject: `New Contact Form Submission: ${data.subject}`,
      replyTo: data.email,
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
        <p><em>reCAPTCHA Score: ${riskScore}</em></p>
      `,
    };

    // Send the email
    await sgMail.send(msg);
    console.log("Contact form email sent successfully to support@teambuildpro.com");

    res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully.',
      score: riskScore 
    });

  } catch (error) {
    console.error('ERROR processing contact form:', error);
    res.status(500).json({ success: false, error: 'Failed to process contact form' });
  }
});