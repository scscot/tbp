// Script to update FAQ data in Firestore
const admin = require('firebase-admin');
const { setupFAQ } = require('./setup_faq');

// Initialize Firebase Admin (uses default credentials from environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Run the setup
console.log('🚀 Starting FAQ update...');
setupFAQ()
  .then(() => {
    console.log('✅ FAQ update complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ FAQ update failed:', error);
    process.exit(1);
  });
