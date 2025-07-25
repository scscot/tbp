const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./functions/service-account-key.json'); // You'll need to add this
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'teambuilder-plus-fe74d'
});

const db = admin.firestore();

async function testBadgeSync() {
  console.log('🧪 Testing badge synchronization...');
  
  try {
    // Test 1: Create a test notification to trigger badge update
    const testUserId = 'test-user-123';
    const testNotification = {
      title: 'Test Notification',
      message: 'Testing badge sync functionality',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      type: 'test'
    };
    
    console.log('📝 Creating test notification...');
    await db.collection('users').doc(testUserId).collection('notifications').add(testNotification);
    console.log('✅ Test notification created');
    
    // Test 2: Query unread notifications count
    console.log('📊 Counting unread notifications...');
    const unreadNotifications = await db.collection('users')
      .doc(testUserId)
      .collection('notifications')
      .where('read', '==', false)
      .get();
    
    console.log(`📈 Found ${unreadNotifications.size} unread notifications`);
    
    // Test 3: Query unread chats count
    console.log('💬 Counting unread chats...');
    const unreadChats = await db.collection('chats')
      .where('participants', 'array-contains', testUserId)
      .get();
    
    let messageCount = 0;
    unreadChats.docs.forEach(doc => {
      const chatData = doc.data();
      const isReadMap = chatData.isRead || {};
      if (isReadMap[testUserId] === false) {
        messageCount++;
      }
    });
    
    console.log(`💬 Found ${messageCount} unread messages`);
    console.log(`🔔 Total badge count would be: ${unreadNotifications.size + messageCount}`);
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    const batch = db.batch();
    unreadNotifications.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log('✅ Test data cleaned up');
    
    console.log('🎉 Badge sync test completed successfully!');
    
  } catch (error) {
    console.error('❌ Badge sync test failed:', error);
  }
}

testBadgeSync().then(() => {
  console.log('Test finished');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
