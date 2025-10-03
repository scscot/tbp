#!/usr/bin/env node

const {
  sendTestEmail,
  readCSV,
  readUnsentContacts,
  sendBatchCampaign,
  getCampaignStatus,
  uploadContactsToList,
  sendCampaignToList,
  getListStats,
  runFullCampaign
} = require('./mailgun_email_campaign_TBP');

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

      case 'test-batch':
        console.log('🧪 Running test batch (no emails sent)...');
        await sendBatchCampaign({ limit: 5, testMode: true });
        break;

      case 'batch':
        const limit = parseInt(process.argv[3]) || 10;
        const testMode = process.argv.includes('--test');
        console.log(`📧 Sending batch campaign (${limit} emails)...`);
        await sendBatchCampaign({ limit, testMode });
        break;

      case 'status':
        console.log('📊 Getting campaign status...');
        getCampaignStatus();
        break;

      case 'resume':
        console.log('🔄 Resuming failed/pending emails...');
        const resumeLimit = parseInt(process.argv[3]) || 50;
        await sendBatchCampaign({ limit: resumeLimit });
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
        console.log('');
        console.log('📧 BATCH CAMPAIGN COMMANDS (Recommended):');
        console.log('  test-batch       - Test batch processing without sending emails');
        console.log('  batch [N]        - Send batch of N emails (default: 100)');
        console.log('  batch [N] --test - Test batch of N emails without sending');
        console.log('  status           - Show campaign progress and statistics');
        console.log('  resume [N]       - Resume sending failed/pending emails (default: 50)');
        console.log('');
        console.log('🔧 UTILITY COMMANDS:');
        console.log('  test-email       - Send single test email to scscot@gmail.com');
        console.log('  test-csv         - Test reading the CSV file');
        console.log('');
        console.log('📨 MAILING LIST COMMANDS (Legacy):');
        console.log('  upload           - Upload CSV contacts to Mailgun mailing list');
        console.log('  stats            - Show mailing list statistics');
        console.log('  send             - Send campaign to existing mailing list');
        console.log('  full             - Complete workflow: upload + send campaign');
        console.log('');
        console.log('  help             - Show this help message');
        console.log('');
        console.log('📋 EXAMPLES:');
        console.log('  node run-email-campaign.js test-batch');
        console.log('  node run-email-campaign.js batch 50');
        console.log('  node run-email-campaign.js status');
        console.log('  node run-email-campaign.js batch 100 --test');
        console.log('  node run-email-campaign.js resume 25');
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