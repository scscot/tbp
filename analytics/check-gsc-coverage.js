const { google } = require('googleapis');
const path = require('path');

async function checkAllServiceAccounts() {
  const accounts = [
    { name: 'ga4-service-account', file: 'ga4-service-account.json' },
    { name: 'firebase-adminsdk', file: 'serviceAccountKey.json' },
    { name: 'android-testing-manager', file: 'teambuilder-plus-fe74d-a65db77ff55f.json' }
  ];

  for (const account of accounts) {
    const keyFile = path.join(__dirname, '..', 'secrets', account.file);
    
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    try {
      console.log(`\n=== Trying ${account.name} ===`);
      const sites = await searchconsole.sites.list();
      
      if (sites.data.siteEntry && sites.data.siteEntry.length > 0) {
        console.log('SUCCESS! Sites found:');
        for (const site of sites.data.siteEntry) {
          console.log(`  - ${site.siteUrl} (${site.permissionLevel})`);
        }
        return account; // Found one that works
      } else {
        console.log('Access granted but no sites found');
      }
    } catch (error) {
      if (error.code === 403) {
        console.log(`No GSC access`);
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n❌ None of the service accounts have Search Console access.');
  console.log('\nTo fix, add one of these emails to GSC:');
  console.log('  - ga4-data-reader@teambuilder-plus-fe74d.iam.gserviceaccount.com');
  console.log('  - firebase-adminsdk-fbsvc@teambuilder-plus-fe74d.iam.gserviceaccount.com');
}

checkAllServiceAccounts();
