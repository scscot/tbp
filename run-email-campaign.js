#!/usr/bin/env node

const {
  sendTestEmail,
  readCSV,
  uploadContactsToList,
  sendCampaignToList,
  getListStats,
  runFullCampaign
} = require('./mailgun_email_campaign');

// Command line interface for email campaigns
const command = process.argv[2];

async function main() {
  try {
    console.log('🚀 Team Build Pro Email Campaign Manager\n');
    
    switch (command) {
      case 'test-email':
        console.log('📧 Sending single test email...');
        await sendTestEmail();
        break;
        
      case 'test-csv':
        console.log('📊 Testing CSV reading...');
        const contacts = readCSV();
        console.log(`Found ${contacts.length} contacts`);
        console.log('First few contacts:', contacts.slice(0, 3));
        break;
        
      case 'upload':
        console.log('📤 Uploading contacts to Mailgun...');
        await uploadContactsToList();
        break;
        
      case 'stats':
        console.log('📊 Getting mailing list statistics...');
        await getListStats();
        break;
        
      case 'send':
        console.log('📧 Sending campaign to mailing list...');
        await sendCampaignToList();
        break;
        
      case 'full':
        console.log('🎯 Running complete campaign workflow...');
        await runFullCampaign();
        break;
        
      case 'help':
      default:
        console.log('Available commands:');
        console.log('  test-email - Send single test email to scscot@gmail.com');
        console.log('  test-csv   - Test reading the CSV file');
        console.log('  upload     - Upload CSV contacts to Mailgun mailing list');
        console.log('  stats     - Show mailing list statistics');
        console.log('  send      - Send campaign to existing mailing list');
        console.log('  full      - Complete workflow: upload + send campaign');
        console.log('  help      - Show this help message');
        console.log('\nExamples:');
        console.log('  node run-email-campaign.js test-csv');
        console.log('  node run-email-campaign.js full');
        break;
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}