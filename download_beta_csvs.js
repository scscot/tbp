#!/usr/bin/env node

/**
 * Script to generate beta tester CSV files from Firestore data
 * Usage: node download_beta_csvs.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('./secrets/serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function generateBetaTesterCSVs() {
  try {
    console.log('📄 Generating beta tester CSV files from Firestore...');
    
    const deviceTypes = ['ios', 'android'];
    
    for (const deviceType of deviceTypes) {
      try {
        console.log(`\n📱 Processing ${deviceType.toUpperCase()} testers...`);
        
        // Query beta testers for this device type
        const snapshot = await db.collection('beta_testers')
          .where('deviceType', '==', deviceType)
          .orderBy('createdAt', 'asc')
          .get();
        
        // Generate CSV content
        let csvContent = '';
        const testers = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          testers.push(data);
          csvContent += `${data.firstName},${data.lastName},${data.email}\n`;
        });
        
        // Write to local file
        const fileName = `${deviceType}_testers.csv`;
        await fs.writeFile(fileName, csvContent, 'utf8');
        
        console.log(`✅ Generated ${fileName} - ${testers.length} entries`);
        
        // Show some sample entries
        if (testers.length > 0) {
          console.log(`   📝 Recent entries:`);
          testers.slice(-Math.min(3, testers.length)).forEach(tester => {
            const date = tester.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown';
            console.log(`      • ${tester.firstName} ${tester.lastName} (${tester.email}) - ${date}`);
          });
        }
        
      } catch (error) {
        console.error(`❌ Error generating ${deviceType} CSV:`, error.message);
        // Create empty file
        await fs.writeFile(`${deviceType}_testers.csv`, '', 'utf8');
      }
    }
    
    console.log('\n🎯 Files are ready for upload to:');
    console.log('   • ios_testers.csv → App Store Connect TestFlight External Testing');
    console.log('   • android_testers.csv → Google Play Console Internal Testing');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the generation
generateBetaTesterCSVs().then(() => {
  console.log('\n✅ Generation complete!');
  process.exit(0);
});