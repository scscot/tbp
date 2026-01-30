const { google } = require('googleapis');
const path = require('path');

async function checkMainSite() {
  const keyFile = path.join(__dirname, '..', 'secrets', 'ga4-service-account.json');

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // Try different URL formats for the main site
  const formats = [
    'sc-domain:teambuildpro.com',
    'https://teambuildpro.com/',
    'https://www.teambuildpro.com/'
  ];

  console.log('=== Checking Main Site Access ===\n');

  for (const siteUrl of formats) {
    try {
      console.log('Trying: ' + siteUrl);
      const sitemaps = await searchconsole.sitemaps.list({ siteUrl });
      console.log('  SUCCESS - Sitemaps found: ' + (sitemaps.data.sitemap ? sitemaps.data.sitemap.length : 0));
      if (sitemaps.data.sitemap) {
        for (const sm of sitemaps.data.sitemap) {
          console.log('  - ' + sm.path);
          console.log('    Last downloaded: ' + (sm.lastDownloaded || 'Never'));
          if (sm.contents) {
            for (const c of sm.contents) {
              console.log('    ' + c.type + ': ' + (c.indexed || 0) + '/' + (c.submitted || 0) + ' indexed');
            }
          }
        }
      }
      console.log('');
    } catch (error) {
      console.log('  Not accessible: ' + error.message.split('\n')[0] + '\n');
    }
  }
}

checkMainSite();
