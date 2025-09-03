const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

// Define SendGrid API key secret
const sendgridApiKey = defineSecret('SENDGRID_API_KEY');

// Load the email template
const templatePath = path.join(__dirname, 'email_templates/launch_campaign_with_hero.html');
let emailTemplate;

try {
  emailTemplate = fs.readFileSync(templatePath, 'utf8');
  console.log('✅ Email template loaded successfully');
} catch (error) {
  console.error('❌ Failed to load email template:', error);
  emailTemplate = null;
}

exports.sendLaunchCampaign = onRequest({
  cors: true,
  region: 'us-central1',
  secrets: [sendgridApiKey],
  timeoutSeconds: 540, // 9 minutes for large campaigns
  memory: '1GiB'
}, async (req, res) => {
  try {
    console.log('🚀 LAUNCH_CAMPAIGN: Starting campaign send');
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate template is loaded
    if (!emailTemplate) {
      console.error('❌ LAUNCH_CAMPAIGN: Email template not available');
      return res.status(500).json({ error: 'Email template not available' });
    }

    // Set the SendGrid API key
    sgMail.setApiKey(sendgridApiKey.value());

    // Get request parameters
    const { 
      dryRun = false, 
      batchSize = 50, 
      testEmail = null,
      deviceFilter = null // 'ios', 'android', 'both', or null for all
    } = req.body;

    console.log(`🔧 LAUNCH_CAMPAIGN: Configuration - dryRun: ${dryRun}, batchSize: ${batchSize}, deviceFilter: ${deviceFilter}`);

    // If test email provided, send only to that email
    if (testEmail) {
      console.log(`🧪 LAUNCH_CAMPAIGN: Test mode - sending to ${testEmail}`);
      const testResult = await sendTestEmail(testEmail, emailTemplate);
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        testEmail: testEmail,
        result: testResult
      });
    }

    // Query launch_notifications collection
    const db = admin.firestore();
    let query = db.collection('launch_notifications');
    
    // Apply device filter if specified
    if (deviceFilter) {
      if (deviceFilter === 'both') {
        query = query.where('deviceSelection', '==', 'both');
      } else {
        query = query.where('deviceSelection', '==', deviceFilter);
      }
      console.log(`🔍 LAUNCH_CAMPAIGN: Filtering for device type: ${deviceFilter}`);
    }

    const snapshot = await query.get();
    const subscribers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 LAUNCH_CAMPAIGN: Found ${subscribers.length} subscribers`);

    if (subscribers.length === 0) {
      return res.json({
        success: true,
        message: 'No subscribers found',
        sent: 0,
        failed: 0
      });
    }

    // If dry run, return subscriber count without sending
    if (dryRun) {
      const deviceBreakdown = getDeviceBreakdown(subscribers);
      return res.json({
        success: true,
        message: 'Dry run completed',
        totalSubscribers: subscribers.length,
        deviceBreakdown: deviceBreakdown,
        wouldSend: subscribers.length,
        dryRun: true
      });
    }

    // Send campaign in batches
    const results = await sendCampaignInBatches(subscribers, emailTemplate, batchSize);
    
    // Log campaign completion
    await logCampaignCompletion(results, deviceFilter);

    console.log(`✅ LAUNCH_CAMPAIGN: Campaign completed - Sent: ${results.sent}, Failed: ${results.failed}`);

    res.json({
      success: true,
      message: 'Launch campaign completed',
      sent: results.sent,
      failed: results.failed,
      totalSubscribers: subscribers.length,
      deviceFilter: deviceFilter || 'all',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ LAUNCH_CAMPAIGN: Error sending campaign:', error);
    res.status(500).json({ 
      error: 'Failed to send launch campaign',
      details: error.message 
    });
  }
});

/**
 * Send test email to specified address
 */
async function sendTestEmail(testEmail, template) {
  const personalizedTemplate = personalizeTemplate(template, {
    firstName: 'Test User',
    deviceSelection: 'both'
  });

  const emailData = {
    to: testEmail,
    from: 'Team Build Pro <support@teambuildpro.com>',
    subject: '🚀 Team Build Pro is Now Available! [TEST]',
    html: personalizedTemplate
  };

  try {
    await sgMail.send(emailData);
    console.log(`✅ LAUNCH_CAMPAIGN: Test email sent to ${testEmail}`);
    return { success: true, email: testEmail };
  } catch (error) {
    console.error(`❌ LAUNCH_CAMPAIGN: Test email failed for ${testEmail}:`, error);
    throw error;
  }
}

/**
 * Send campaign in batches to avoid rate limits
 */
async function sendCampaignInBatches(subscribers, template, batchSize) {
  let sent = 0;
  let failed = 0;
  const totalBatches = Math.ceil(subscribers.length / batchSize);

  console.log(`📦 LAUNCH_CAMPAIGN: Processing ${totalBatches} batches of ${batchSize} emails each`);

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`🔄 LAUNCH_CAMPAIGN: Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

    const batchResults = await Promise.allSettled(
      batch.map(subscriber => sendPersonalizedEmail(subscriber, template))
    );

    // Count results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        console.error(`❌ LAUNCH_CAMPAIGN: Failed to send to ${batch[index].email}:`, result.reason);
      }
    });

    // Small delay between batches to be respectful to SendGrid
    if (i + batchSize < subscribers.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { sent, failed };
}

/**
 * Send personalized email to individual subscriber
 */
async function sendPersonalizedEmail(subscriber, template) {
  const { firstName, lastName, email, deviceSelection } = subscriber;
  
  // Personalize the template
  const personalizedTemplate = personalizeTemplate(template, subscriber);
  
  const emailData = {
    to: `${firstName} ${lastName} <${email}>`,
    from: 'Team Build Pro <support@teambuildpro.com>',
    bcc: 'scscot@gmail.com', // Keep your BCC for tracking
    subject: `🚀 Team Build Pro is Now Available, ${firstName}!`,
    html: personalizedTemplate,
    // Add custom args for SendGrid tracking
    customArgs: {
      campaign: 'launch_2025',
      device_preference: deviceSelection || 'unknown',
      subscriber_id: subscriber.id
    }
  };

  await sgMail.send(emailData);
  console.log(`✅ LAUNCH_CAMPAIGN: Email sent to ${firstName} ${lastName} (${email})`);
  
  return { success: true, email: email };
}

/**
 * Personalize template with subscriber data
 */
function personalizeTemplate(template, subscriber) {
  const { firstName = 'Team Builder', deviceSelection } = subscriber;
  
  // Determine which download buttons to show
  const showAppleButton = !deviceSelection || deviceSelection === 'ios' || deviceSelection === 'both';
  const showGoogleButton = !deviceSelection || deviceSelection === 'android' || deviceSelection === 'both';
  
  // App Store URLs (you may want to add referral tracking here)
  const appStoreUrl = 'https://apps.apple.com/app/team-build-pro/id6751211622';
  const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.scott.ultimatefix';
  
  // Screenshot composite URL - Correct location
  const screenshotCompositeUrl = 'http://teambuildpro.com/assets/images/hero-composite.png';

  let personalizedTemplate = template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{appStoreUrl\}\}/g, appStoreUrl)
    .replace(/\{\{googlePlayUrl\}\}/g, googlePlayUrl)
    .replace(/\{\{screenshotCompositeUrl\}\}/g, screenshotCompositeUrl);

  // Handle conditional download buttons using simple string replacement
  if (showAppleButton) {
    personalizedTemplate = personalizedTemplate.replace(/\{\{#if showAppleButton\}\}/g, '');
    personalizedTemplate = personalizedTemplate.replace(/\{\{\/if\}\}/g, '');
  } else {
    // Remove the Apple button section
    personalizedTemplate = personalizedTemplate.replace(/\{\{#if showAppleButton\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  if (showGoogleButton) {
    personalizedTemplate = personalizedTemplate.replace(/\{\{#if showGoogleButton\}\}/g, '');
    personalizedTemplate = personalizedTemplate.replace(/\{\{\/if\}\}/g, '');
  } else {
    // Remove the Google button section
    personalizedTemplate = personalizedTemplate.replace(/\{\{#if showGoogleButton\}\}[\s\S]*?\{\{\/if\}\}/g, '');
  }

  return personalizedTemplate;
}

/**
 * Get device breakdown for analytics
 */
function getDeviceBreakdown(subscribers) {
  const breakdown = {
    ios: 0,
    android: 0,
    both: 0,
    unspecified: 0
  };

  subscribers.forEach(subscriber => {
    const device = subscriber.deviceSelection;
    if (device === 'ios') {
      breakdown.ios++;
    } else if (device === 'android') {
      breakdown.android++;
    } else if (device === 'both') {
      breakdown.both++;
    } else {
      breakdown.unspecified++;
    }
  });

  return breakdown;
}

/**
 * Log campaign completion to Firestore for analytics
 */
async function logCampaignCompletion(results, deviceFilter) {
  try {
    const db = admin.firestore();
    await db.collection('campaign_logs').add({
      campaign: 'launch_2025',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      sent: results.sent,
      failed: results.failed,
      total: results.sent + results.failed,
      deviceFilter: deviceFilter || 'all',
      completedAt: new Date().toISOString()
    });
    console.log('📝 LAUNCH_CAMPAIGN: Campaign completion logged');
  } catch (error) {
    console.error('❌ LAUNCH_CAMPAIGN: Failed to log campaign:', error);
  }
}