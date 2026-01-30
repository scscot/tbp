const { google } = require('googleapis');
const path = require('path');

async function resubmitSitemaps() {
  const keyFile = path.join(__dirname, '..', 'secrets', 'ga4-service-account.json');

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/webmasters']
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const sites = [
    { url: 'sc-domain:es.teambuildpro.com', sitemap: 'https://es.teambuildpro.com/sitemap.xml' },
    { url: 'sc-domain:de.teambuildpro.com', sitemap: 'https://de.teambuildpro.com/sitemap.xml' },
    { url: 'sc-domain:pt.teambuildpro.com', sitemap: 'https://pt.teambuildpro.com/sitemap.xml' }
  ];

  for (const site of sites) {
    try {
      console.log('Resubmitting sitemap for ' + site.url + '...');
      await searchconsole.sitemaps.submit({
        siteUrl: site.url,
        feedpath: site.sitemap
      });
      console.log('  SUCCESS: Sitemap resubmitted\n');
    } catch (error) {
      console.log('  ERROR: ' + error.message + '\n');
    }
  }

  console.log('Done! Google should re-crawl these sitemaps within the next few days.');
}

resubmitSitemaps();
