const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateContactsRandomIndex() {
  console.log('🔄 Starting migration: Adding randomIndex to contacts...\n');

  try {
    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');
    const snapshot = await contactsRef.get();

    if (snapshot.empty) {
      console.log('✅ No contacts found. Migration complete.');
      process.exit(0);
    }

    console.log(`📊 Found ${snapshot.size} contacts to migrate`);

    let batch = db.batch();
    let count = 0;
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (data.randomIndex === undefined) {
        batch.update(doc.ref, {
          randomIndex: Math.random()
        });
        count++;
        batchCount++;

        if (batchCount >= 500) {
          await batch.commit();
          console.log(`✅ Migrated ${count} contacts...`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Total contacts migrated: ${count}`);
    console.log(`   Total contacts checked: ${snapshot.size}`);
    console.log(`   Skipped (already had randomIndex): ${snapshot.size - count}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateContactsRandomIndex();
