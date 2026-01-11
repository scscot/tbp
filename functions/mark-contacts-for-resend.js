const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function markContactsForResend() {
  try {
    console.log('📧 MARK CONTACTS FOR ANDROID LAUNCH RESEND');
    console.log('='.repeat(70));
    console.log('');

    const nov12_2025 = new Date('2025-11-12T00:00:00Z');
    console.log(`📅 Target: Contacts sent before ${nov12_2025.toISOString()}`);
    console.log('');

    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    const preNov12Query = contactsRef
      .where('sent', '==', true)
      .where('sentTimestamp', '<', nov12_2025);

    console.log('🔍 Querying contacts...');
    const snapshot = await preNov12Query.get();

    if (snapshot.empty) {
      console.log('❌ No contacts found matching criteria');
      return;
    }

    console.log(`✅ Found ${snapshot.size} contacts to mark for resend`);
    console.log('');

    let processed = 0;
    let failed = 0;

    console.log('📝 Updating contacts with resend: false...');
    console.log('');

    const _batch = db.batch();
    const batchLimit = 500;
    let batchCount = 0;
    const batches = [];
    let currentBatch = db.batch();

    for (const doc of snapshot.docs) {
      const _contact = doc.data();

      currentBatch.update(doc.ref, {
        resend: false,
        androidResendMarked: new Date()
      });

      batchCount++;

      if (batchCount >= batchLimit) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }

      processed++;
      if (processed % 100 === 0) {
        console.log(`   Progress: ${processed}/${snapshot.size} contacts marked`);
      }
    }

    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    console.log('');
    console.log('💾 Committing updates to Firestore...');

    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        console.log(`   Batch ${i + 1}/${batches.length} committed`);
      } catch (error) {
        console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
        failed += batchLimit;
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('✅ MARKING COMPLETE');
    console.log('');
    console.log(`📊 Summary:`);
    console.log(`   Total contacts found: ${snapshot.size}`);
    console.log(`   Successfully marked: ${processed - failed}`);
    console.log(`   Failed: ${failed}`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Verify contacts marked correctly in Firestore');
    console.log('   2. Deploy updated email-campaign-functions.js');
    console.log('   3. Set ANDROID_CAMPAIGN_ENABLED=false (keep disabled initially)');
    console.log('   4. Enable after Phase 1 campaign completes');
    console.log('');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('💥 Error:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

markContactsForResend();
