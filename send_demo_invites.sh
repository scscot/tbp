#!/bin/bash

# Team Build Pro - Android Preview Invitation Script
# Sends welcome emails to users who requested Android preview access

echo "🚀 Team Build Pro - Android Preview Invitation Sender"
echo "================================================="

# Google Play Internal Testing URL
DEMO_URL="https://play.google.com/apps/internaltest/4701750664602012744"

# Create the Node.js script inline
cat > send_demo_emails.js << 'EOF'
const admin = require('firebase-admin');
require('dotenv').config({ path: 'assets/env.prod' });

// Initialize Firebase Admin
const serviceAccount = require('./secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Use existing Firebase Cloud Functions for email sending (no SMTP needed)
const CLOUD_FUNCTION_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendDemoInvitation';

async function sendDemoInvitations() {
  try {
    console.log('🔍 Fetching users who need preview invitations...');

    // Query for users who want preview but haven't been sent email
    const snapshot = await db.collection('launch_notifications')
      .where('wantDemo', '==', true)
      .where('emailSent', '==', false)
      .where('deviceType', '==', 'android')
      .get();
    
    if (snapshot.empty) {
      console.log('✅ No pending preview invitations to send.');
      return;
    }

    console.log(`📧 Found ${snapshot.docs.length} users to send preview invitations to:`);

    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const { firstName, lastName, email } = data;
      
      try {
        console.log(`   📤 Sending to: ${firstName} ${lastName} (${email})`);

        // Send the preview invitation email via Cloud Function
        await sendDemoInvitationEmail(firstName, lastName, email);
        
        // Update the document to mark email as sent
        await doc.ref.update({
          emailSent: true,
          emailSentDate: admin.firestore.FieldValue.serverTimestamp()
        });
        
        successCount++;
        console.log(`   ✅ Email sent and marked as completed`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Failed to send to ${email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully sent: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📧 Total processed: ${successCount + errorCount}`);
    
  } catch (error) {
    console.error('❌ Error in sendDemoInvitations:', error);
  }
}

async function sendDemoInvitationEmail(firstName, lastName, email) {
  // Use Firebase Cloud Function instead of direct SMTP
  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName,
      lastName,
      email,
      demoUrl: process.env.DEMO_URL || 'https://play.google.com/apps/internaltest/4701750664602012744'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloud Function failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Cloud Function returned error');
  }

  return result;
}

// Run the script
sendDemoInvitations()
  .then(() => {
    console.log('\n✅ Preview invitation process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
EOF

echo "📧 Running preview invitation sender..."
node send_demo_emails.js

# Cleanup temporary file
rm -f send_demo_emails.js

echo "✅ Preview invitation script completed!"