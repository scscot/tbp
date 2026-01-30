const { google } = require('googleapis');
const path = require('path');

async function checkFullGSC() {
  const keyFile = path.join(__dirname, '..', 'secrets', 'ga4-service-account.json');

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/webmasters']
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const siteUrl = 'sc-domain:teambuildpro.com';

  // Resubmit main sitemap
  console.log('=== Resubmitting Main Site Sitemap ===\n');
  try {
    await searchconsole.sitemaps.submit({
      siteUrl,
      feedpath: 'https://teambuildpro.com/sitemap.xml'
    });
    console.log('Main sitemap resubmitted successfully!\n');
  } catch (e) {
    console.log('Error resubmitting: ' + e.message + '\n');
  }

  // Get search analytics for each domain to see actual indexed pages
  console.log('=== Search Analytics (Last 28 Days) ===\n');

  const domains = [
    'teambuildpro.com',
    'es.teambuildpro.com',
    'pt.teambuildpro.com',
    'de.teambuildpro.com'
  ];

  for (const domain of domains) {
    try {
      const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: '2026-01-01',
          endDate: '2026-01-30',
          dimensions: ['page'],
          dimensionFilterGroups: [{
            filters: [{
              dimension: 'page',
              operator: 'contains',
              expression: domain
            }]
          }],
          rowLimit: 5
        }
      });

      const rows = response.data.rows || [];
      const totalClicks = rows.reduce((sum, r) => sum + r.clicks, 0);
      const totalImpressions = rows.reduce((sum, r) => sum + r.impressions, 0);

      console.log(domain + ':');
      console.log('  Pages with impressions: ' + rows.length);
      console.log('  Total clicks: ' + totalClicks);
      console.log('  Total impressions: ' + totalImpressions);

      if (rows.length > 0) {
        console.log('  Top pages:');
        rows.slice(0, 3).forEach(r => {
          const page = r.keys[0].replace('https://' + domain, '');
          console.log('    ' + (page || '/') + ' - ' + r.impressions + ' imp, ' + r.clicks + ' clicks');
        });
      }
      console.log('');
    } catch (e) {
      console.log(domain + ': Error - ' + e.message + '\n');
    }
  }
}

checkFullGSC();
