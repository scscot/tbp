#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');

const serviceAccount = require('./secrets/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const CSV_FILE_PATH = path.join(__dirname, 'emails', 'master_email_list.csv');

async function migrateCsvToFirestore() {
  console.log('🚀 Starting CSV to Firestore migration...\n');

  try {
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📊 Loaded ${records.length} contacts from CSV`);

    const contactsRef = db.collection('emailCampaigns').doc('master').collection('contacts');

    const batchSize = 500;
    const batches = [];

    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    console.log(`📦 Processing ${batches.length} batch(es)...\n`);

    let totalImported = 0;
    let alreadySent = 0;
    let pending = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`⬆️  Uploading batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);

      const writeBatch = db.batch();

      for (const record of batch) {
        const docRef = contactsRef.doc(record.email);

        const isSent = record.sent === '1';
        const contactData = {
          firstName: record.first_name || '',
          lastName: record.last_name || '',
          email: record.email || '',
          sent: isSent,
          sentTimestamp: record.sent_timestamp ? new Date(record.sent_timestamp) : null,
          batchId: record.batch_id || '',
          status: record.status || (isSent ? 'sent' : 'pending'),
          errorMessage: record.error_message || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        writeBatch.set(docRef, contactData, { merge: true });

        if (isSent) {
          alreadySent++;
        } else {
          pending++;
        }
      }

      await writeBatch.commit();
      totalImported += batch.length;

      console.log(`✅ Batch ${i + 1} uploaded successfully`);

      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n🎉 Migration Complete!');
    console.log(`   Total contacts imported: ${totalImported}`);
    console.log(`   Already sent: ${alreadySent}`);
    console.log(`   Pending: ${pending}`);
    console.log(`\n📊 Firestore Collection Path: emailCampaigns/master/contacts`);
    console.log(`\n✅ Ready to deploy Cloud Function!`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

if (require.main === module) {
  migrateCsvToFirestore()
    .then(() => {
      console.log('\n✨ Migration script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateCsvToFirestore };
