// Simple script to export demo emails from Firestore
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function exportDemoEmails() {
  try {
    console.log('🔍 Fetching demo requests...');

    const db = admin.firestore();
    const snapshot = await db.collection('launch_notifications')
      .where('wantDemo', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('No demo requests found');
      return;
    }

    console.log(`📊 Found ${snapshot.size} demo requests`);

    // Extract emails
    const emails = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        emails.push(data.email);
      }
    });

    // Remove duplicates
    const uniqueEmails = [...new Set(emails)];

    // Create CSV content (just emails, one per line)
    const csvContent = uniqueEmails.join('\n');

    // Write to file
    const outputPath = './emails/demo_leads.csv';
    fs.writeFileSync(outputPath, csvContent);

    console.log(`✅ Exported ${uniqueEmails.length} unique emails to ${outputPath}`);
    console.log('\nFirst 5 emails:');
    uniqueEmails.slice(0, 5).forEach(email => console.log(`  ${email}`));

  } catch (error) {
    console.error('❌ Error exporting emails:', error);
  }
}

exportDemoEmails();