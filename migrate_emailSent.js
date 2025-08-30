#!/usr/bin/env node

// One-time migration script to add emailSent field to existing documents
// Run this once to update all existing launch_notifications documents

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateEmailSentField() {
  try {
    console.log('🔍 Fetching all launch_notifications documents...');
    
    // Get all documents in the collection
    const snapshot = await db.collection('launch_notifications').get();
    
    if (snapshot.empty) {
      console.log('✅ No documents found in launch_notifications collection.');
      return;
    }
    
    console.log(`📝 Found ${snapshot.docs.length} documents to update`);
    
    let updateCount = 0;
    let skipCount = 0;
    
    // Use batch for efficient updates
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      
      // Check if emailSent field already exists
      if (data.hasOwnProperty('emailSent')) {
        console.log(`   ⏭️  Skipping ${data.email || doc.id} - emailSent field already exists`);
        skipCount++;
        return;
      }
      
      // Add emailSent: true to existing documents (assume they were already handled manually)
      console.log(`   ✅ Updating ${data.email || doc.id} - adding emailSent: true`);
      batch.update(doc.ref, { emailSent: true });
      updateCount++;
    });
    
    if (updateCount > 0) {
      console.log(`\n📤 Committing batch update for ${updateCount} documents...`);
      await batch.commit();
      console.log('✅ Batch update completed successfully!');
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Updated: ${updateCount}`);
    console.log(`   ⏭️  Skipped (already had field): ${skipCount}`);
    console.log(`   📄 Total documents: ${snapshot.docs.length}`);
    
    if (updateCount > 0) {
      console.log(`\n💡 All existing documents now have emailSent: true`);
      console.log(`   New signups going forward will automatically get emailSent: false`);
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  }
}

// Run the migration
migrateEmailSentField()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });