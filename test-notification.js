const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials
admin.initializeApp({
  projectId: 'teambuilder-plus-fe74d'
});

// Create a custom token for the user
const userId = 'KJ8uFnlhKhWgBa4NVcwT';

async function testNotification() {
  try {
    console.log(`Creating test notification for user ${userId}...`);

    // Get Firestore reference
    const db = admin.firestore();

    // Create the notification directly in Firestore
    const notificationRef = db.collection('users').doc(userId).collection('notifications').doc();

    const firstName = 'Stephen'; // Your first name

    await notificationRef.set({
      type: 'launch_confirmation',
      title: '🚀 Launch Campaign Sent!',
      body: '[TEST] Your launch campaign has been successfully sent to your network.',
      campaignId: 'test_campaign_123',
      route: '/campaigns',
      route_params: JSON.stringify({ action: 'view_campaign', id: 'test_campaign_123' }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    console.log('✅ Test notification created successfully!');
    console.log(`Notification ID: ${notificationRef.id}`);
    console.log('\nCheck your iPhone 16 - you should receive a push notification momentarily.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    process.exit(1);
  }
}

testNotification();
