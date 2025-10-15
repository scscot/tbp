const { db, FieldValue } = require('./shared/utilities');

async function initEarlyAdopter() {
  try {
    const docRef = db.collection('settings').doc('earlyAdopter');

    await docRef.set({
      totalGranted: 0,
      limit: 50,
      enabled: true,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log('✅ Early adopter settings document created successfully');
    console.log('   Path: settings/earlyAdopter');
    console.log('   Initial values: { totalGranted: 0, limit: 50, enabled: true }');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating document:', error);
    process.exit(1);
  }
}

initEarlyAdopter();
