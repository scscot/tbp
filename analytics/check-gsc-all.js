const { google } = require('googleapis');
const path = require('path');

async function checkAllSites() {
  const keyFile = path.join(__dirname, '..', 'secrets', 'ga4-service-account.json');

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  try {
    // List all sites
    console.log('=== Accessible Sites ===\n');
    const sites = await searchconsole.sites.list();

    if (!sites.data.siteEntry || sites.data.siteEntry.length === 0) {
      console.log('No sites found');
      return;
    }

    for (const site of sites.data.siteEntry) {
      const separator = '============================================================';
      console.log('\n' + separator);
      console.log('SITE: ' + site.siteUrl);
      console.log('Permission: ' + site.permissionLevel);
      console.log(separator);

      // Check sitemaps
      try {
        const sitemaps = await searchconsole.sitemaps.list({ siteUrl: site.siteUrl });
        if (sitemaps.data.sitemap && sitemaps.data.sitemap.length > 0) {
          console.log('\nSitemaps:');
          for (const sm of sitemaps.data.sitemap) {
            console.log('  Path: ' + sm.path);
            console.log('     Last submitted: ' + (sm.lastSubmitted || 'Never'));
            console.log('     Last downloaded: ' + (sm.lastDownloaded || 'Never'));
            console.log('     Errors: ' + (sm.errors || 0) + ', Warnings: ' + (sm.warnings || 0));
            if (sm.contents) {
              for (const c of sm.contents) {
                console.log('     ' + c.type + ': ' + (c.indexed || 0) + '/' + (c.submitted || 0) + ' indexed');
              }
            }
          }
        } else {
          console.log('\n*** NO SITEMAPS SUBMITTED ***');
        }
      } catch (e) {
        console.log('\nSitemap error: ' + e.message);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAllSites();
