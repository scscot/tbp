#!/usr/bin/env node
/**
 * Check GA4 for page views on professionals.html and prospects.html
 * to identify potential 404 access attempts
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const path = require('path');

const client = new BetaAnalyticsDataClient({
  keyFilename: path.join(__dirname, '..', 'functions', 'ga4-service-account.json')
});

const propertyId = '485651473';

async function check404Pages() {
  console.log('=== GA4: Checking for professionals.html / prospects.html access (Last 30 Days) ===\n');

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' }
    ],
    metrics: [
      { name: 'screenPageViews' }
    ],
    dimensionFilter: {
      orGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'CONTAINS',
                value: 'professionals'
              }
            }
          },
          {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'CONTAINS',
                value: 'prospects'
              }
            }
          }
        ]
      }
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50
  });

  if (!response.rows || response.rows.length === 0) {
    console.log('No page views found for pages containing "professionals" or "prospects"');
    console.log('\nThis could mean:');
    console.log('1. No users attempted to access these pages, OR');
    console.log('2. 404 pages are not being tracked in GA4 (common - GA tracking script may not load on 404)');
    return;
  }

  console.log('Page Path'.padEnd(60) + 'Title'.padEnd(40) + 'Views');
  console.log('-'.repeat(110));

  let total404Indicators = 0;

  for (const row of response.rows) {
    const pagePath = row.dimensionValues[0].value;
    const pageTitle = row.dimensionValues[1].value || '(not set)';
    const views = parseInt(row.metricValues[0].value);

    // Check if title indicates 404
    const is404 = pageTitle.toLowerCase().includes('404') ||
                  pageTitle.toLowerCase().includes('not found') ||
                  pageTitle === '(not set)';

    const indicator = is404 ? ' [POSSIBLE 404]' : '';
    if (is404) total404Indicators += views;

    console.log(
      pagePath.substring(0, 59).padEnd(60) +
      pageTitle.substring(0, 39).padEnd(40) +
      views + indicator
    );
  }

  console.log('-'.repeat(110));
  console.log(`Total page views: ${response.rows.reduce((sum, r) => sum + parseInt(r.metricValues[0].value), 0)}`);
  if (total404Indicators > 0) {
    console.log(`Possible 404 views: ${total404Indicators}`);
  }
}

async function checkAllPagesWith404Title() {
  console.log('\n\n=== GA4: All Pages with "404" or "Not Found" in Title (Last 30 Days) ===\n');

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' }
    ],
    metrics: [
      { name: 'screenPageViews' }
    ],
    dimensionFilter: {
      orGroup: {
        expressions: [
          {
            filter: {
              fieldName: 'pageTitle',
              stringFilter: {
                matchType: 'CONTAINS',
                value: '404'
              }
            }
          },
          {
            filter: {
              fieldName: 'pageTitle',
              stringFilter: {
                matchType: 'CONTAINS',
                value: 'Not Found'
              }
            }
          }
        ]
      }
    },
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 50
  });

  if (!response.rows || response.rows.length === 0) {
    console.log('No pages with 404/Not Found titles found in GA4');
    console.log('(Note: 404 pages may not trigger GA4 tracking if the tracking script is not on the error page)');
    return;
  }

  console.log('Page Path'.padEnd(60) + 'Title'.padEnd(30) + 'Views');
  console.log('-'.repeat(100));

  for (const row of response.rows) {
    const pagePath = row.dimensionValues[0].value;
    const pageTitle = row.dimensionValues[1].value || '(not set)';
    const views = row.metricValues[0].value;
    console.log(
      pagePath.substring(0, 59).padEnd(60) +
      pageTitle.substring(0, 29).padEnd(30) +
      views
    );
  }
}

async function main() {
  try {
    await check404Pages();
    await checkAllPagesWith404Title();
  } catch (error) {
    console.error('Error querying GA4:', error.message);
    process.exit(1);
  }
}

main();
