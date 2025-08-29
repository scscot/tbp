#!/usr/bin/env node

/**
 * Script to initialize beta tester CSV files in Firebase Cloud Storage
 * Usage: node init_cloud_csvs.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('./secrets/serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'teambuilder-plus-fe74d.appspot.com'
  });
}

async function initCloudCSVs() {
  try {
    console.log('📤 Initializing CSV files in Cloud Storage...');
    
    const bucket = admin.storage().bucket();
    const csvFiles = ['ios_testers.csv', 'android_testers.csv'];
    
    for (const fileName of csvFiles) {
      try {
        // Read local file
        const localContent = await fs.readFile(fileName, 'utf8');
        const lineCount = localContent.split('\n').filter(line => line.trim()).length;
        
        // Upload to Cloud Storage
        const cloudFile = bucket.file(`beta_testers/${fileName}`);
        await cloudFile.save(localContent, {
          metadata: {
            contentType: 'text/csv',
            metadata: {
              lastUpdated: new Date().toISOString(),
              totalTesters: lineCount.toString(),
              source: 'manual_upload'
            }
          }
        });
        
        console.log(`✅ Uploaded ${fileName} - ${lineCount} entries`);
        
      } catch (error) {
        console.error(`❌ Error uploading ${fileName}:`, error.message);
      }
    }
    
    console.log('\n🎯 Cloud Storage is now initialized and ready for automatic updates!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the initialization
initCloudCSVs().then(() => {
  console.log('\n✅ Initialization complete!');
  process.exit(0);
});