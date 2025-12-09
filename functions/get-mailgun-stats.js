const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read Mailgun config from secrets folder
const secretsPath = path.join(__dirname, '..', 'secrets', 'mailgun_config.json');
const mailgunConfig = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

const MAILGUN_API_KEY = mailgunConfig.api_key;
const MAILGUN_DOMAIN = mailgunConfig.domain;

/**
 * Extract campaign tags dynamically from email-campaign-functions.js and email-campaign-functions-yahoo.js
 * This ensures stats always reflect the current A/B test configuration
 */
function extractCampaignTags() {
  const tags = new Set();

  const campaignFiles = [
    path.join(__dirname, 'email-campaign-functions.js'),
    path.join(__dirname, 'email-campaign-functions-yahoo.js')
  ];

  for (const filePath of campaignFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract tags from form.append('o:tag', 'tagname') patterns
      const tagMatches = content.matchAll(/form\.append\s*\(\s*['"]o:tag['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of tagMatches) {
        tags.add(match[1]);
      }

      // Extract template versions from templateVersion ternary patterns
      // e.g., const templateVersion = (index % 2 === 0) ? 'curiosity_gap' : 'click_driver';
      const versionMatches = content.matchAll(/templateVersion\s*=\s*[^?]+\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g);
      for (const match of versionMatches) {
        tags.add(match[1]); // First option (e.g., curiosity_gap)
        tags.add(match[2]); // Second option (e.g., click_driver)
      }
    } catch (err) {
      console.warn(`⚠️  Could not read ${path.basename(filePath)}: ${err.message}`);
    }
  }

  // Convert to array and sort for consistent ordering
  // Put campaign tags first (ab_test_*, yahoo_*), then version tags
  const campaignTags = [...tags].filter(t => t.includes('_test_') || t.includes('_launch'));
  const versionTags = [...tags].filter(t => !t.includes('_test_') && !t.includes('_launch'));

  return [...campaignTags.sort(), ...versionTags.sort()];
}

async function getMailgunStats() {
  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

    // Get stats for today
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startTime = startOfDay.toISOString();

    console.log('📊 MAILGUN STATISTICS');
    console.log('='.repeat(60));
    console.log(`Domain: ${MAILGUN_DOMAIN}`);
    console.log(`Date: ${today.toLocaleDateString()}`);
    console.log(`Start time: ${startTime}`);
    console.log('');

    // Get total stats
    const statsResponse = await axios.get(`${mailgunBaseUrl}/stats/total`, {
      auth: {
        username: 'api',
        password: MAILGUN_API_KEY
      },
      params: {
        event: ['accepted', 'delivered', 'failed', 'opened', 'clicked'],
        duration: '1d',
        resolution: 'hour'
      }
    });

    console.log('📈 Today\'s Overall Statistics:');
    console.log('-'.repeat(60));

    if (statsResponse.data && statsResponse.data.stats) {
      const stats = statsResponse.data.stats;

      // Aggregate stats for the day
      let totals = {
        accepted: 0,
        delivered: 0,
        failed: 0,
        opened: 0,
        clicked: 0
      };

      stats.forEach(hourStat => {
        if (hourStat.accepted) totals.accepted += hourStat.accepted.total || 0;
        if (hourStat.delivered) totals.delivered += hourStat.delivered.total || 0;
        if (hourStat.failed) {
          if (hourStat.failed.permanent) totals.failed += hourStat.failed.permanent.total || 0;
          if (hourStat.failed.temporary) totals.failed += hourStat.failed.temporary.total || 0;
        }
        if (hourStat.opened) totals.opened += hourStat.opened.total || 0;
        if (hourStat.clicked) totals.clicked += hourStat.clicked.total || 0;
      });

      console.log(`   ✅ Accepted: ${totals.accepted}`);
      console.log(`   📬 Delivered: ${totals.delivered}`);
      console.log(`   ❌ Failed: ${totals.failed}`);
      console.log(`   👁️  Opened: ${totals.opened} (${totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) : 0}% open rate)`);
      console.log(`   🖱️  Clicked: ${totals.clicked} (${totals.delivered > 0 ? ((totals.clicked / totals.delivered) * 100).toFixed(1) : 0}% click rate)`);

      if (totals.delivered > 0) {
        const engagement = ((totals.opened + totals.clicked) / totals.delivered) * 100;
        console.log(`   💡 Engagement Rate: ${engagement.toFixed(1)}%`);
      }
    }

    console.log('');
    console.log('📋 Campaign Tag Statistics:');
    console.log('-'.repeat(60));

    // Dynamically extract tags from email campaign function files
    const tags = extractCampaignTags();
    console.log(`   (Tags extracted from campaign files: ${tags.join(', ')})`);
    console.log('');

    for (const tag of tags) {
      try {
        const tagStatsResponse = await axios.get(`${mailgunBaseUrl}/tags/${tag}/stats`, {
          auth: {
            username: 'api',
            password: MAILGUN_API_KEY
          },
          params: {
            event: ['accepted', 'delivered', 'failed', 'opened', 'clicked'],
            duration: '1d'
          }
        });

        if (tagStatsResponse.data && tagStatsResponse.data.stats) {
          const tagStats = tagStatsResponse.data.stats;

          // Aggregate stats from array (API returns hourly breakdown)
          let totals = { accepted: 0, delivered: 0, failed: 0, opened: 0, clicked: 0 };

          tagStats.forEach(hourStat => {
            if (hourStat.accepted) totals.accepted += hourStat.accepted.total || 0;
            if (hourStat.delivered) totals.delivered += hourStat.delivered.total || 0;
            if (hourStat.failed) {
              totals.failed += (hourStat.failed.permanent?.total || 0) + (hourStat.failed.temporary?.total || 0);
            }
            if (hourStat.opened) totals.opened += hourStat.opened.total || 0;
            if (hourStat.clicked) totals.clicked += hourStat.clicked.total || 0;
          });

          console.log(`\n   Tag: "${tag}"`);
          console.log(`   ${'─'.repeat(55)}`);

          const openRate = totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) : 0;
          const clickRate = totals.delivered > 0 ? ((totals.clicked / totals.delivered) * 100).toFixed(1) : 0;

          console.log(`     Delivered: ${totals.delivered}`);
          console.log(`     Opened: ${totals.opened} (${openRate}%)`);
          console.log(`     Clicked: ${totals.clicked} (${clickRate}%)`);
          console.log(`     Failed: ${totals.failed}`);
        }
      } catch (tagError) {
        if (tagError.response && tagError.response.status === 404) {
          // Tag not found, skip
        } else {
          console.log(`   ⚠️  Could not fetch stats for tag "${tag}"`);
        }
      }
    }

    console.log('');
    console.log('📅 Hourly Breakdown:');
    console.log('-'.repeat(60));

    if (statsResponse.data && statsResponse.data.stats) {
      const stats = statsResponse.data.stats;

      stats.slice(-8).forEach(hourStat => {
        const time = new Date(hourStat.time);
        const delivered = hourStat.delivered?.total || 0;
        const opened = hourStat.opened?.total || 0;
        const clicked = hourStat.clicked?.total || 0;

        if (delivered > 0) {
          console.log(`   ${time.toLocaleTimeString()}: ${delivered} sent, ${opened} opened, ${clicked} clicked`);
        }
      });
    }

    console.log('');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error fetching Mailgun stats:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

getMailgunStats();
