const axios = require('axios');
const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', 'secrets', 'mailgun_config.json');
const mailgunConfig = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

const MAILGUN_API_KEY = mailgunConfig.api_key;
const MAILGUN_DOMAIN = mailgunConfig.domain;

async function getStats() {
  const mailgunBaseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

  console.log('📊 TEMPLATE VERSION STATISTICS (Last 24 Hours)');
  console.log('='.repeat(55));
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log('');

  // First, let's get the template versions to see what's available
  try {
    const versionsResponse = await axios.get(`${mailgunBaseUrl}/templates/campaign/versions`, {
      auth: { username: 'api', password: MAILGUN_API_KEY }
    });

    const versions = versionsResponse.data.template?.versions || [];
    console.log('📋 Template "campaign" versions:');
    versions.forEach(v => {
      console.log(`   - ${v.tag}${v.active ? ' (ACTIVE)' : ''}`);
    });
    console.log('');
  } catch (err) {
    console.log('Could not fetch template versions:', err.message);
    console.log('');
  }

  // Check stats by common tags used in the campaigns
  // A/B Test versions: 'initial' vs 'initial_1'
  const tags = ['initial', 'initial_1', 'winning_combination', 'yahoo_campaign', 'android_launch'];

  console.log('📈 Stats by Campaign Tag (Last 24 Hours):');
  console.log('-'.repeat(55));

  for (const tag of tags) {
    try {
      const tagStatsResponse = await axios.get(`${mailgunBaseUrl}/tags/${tag}/stats`, {
        auth: { username: 'api', password: MAILGUN_API_KEY },
        params: {
          event: ['delivered', 'failed', 'opened', 'clicked'],
          duration: '24h'
        }
      });

      const stats = tagStatsResponse.data.stats || [];
      let delivered = 0, failed = 0, opened = 0, clicked = 0;

      if (Array.isArray(stats)) {
        stats.forEach(s => {
          delivered += s.delivered?.total || 0;
          failed += (s.failed?.permanent?.total || 0) + (s.failed?.temporary?.total || 0);
          opened += s.opened?.total || 0;
          clicked += s.clicked?.total || 0;
        });
      }

      console.log('');
      console.log(`   📌 Tag: "${tag}"`);
      console.log(`   ${'─'.repeat(40)}`);
      console.log(`      Delivered: ${delivered}`);
      console.log(`      Failed: ${failed}`);
      console.log(`      Opened: ${opened}${delivered > 0 ? ` (${(opened/delivered*100).toFixed(1)}%)` : ''}`);
      console.log(`      Clicked: ${clicked}${delivered > 0 ? ` (${(clicked/delivered*100).toFixed(1)}%)` : ''}`);

    } catch (tagError) {
      // Only show error if it's not a 404 (tag not found)
      if (tagError.response && tagError.response.status === 404) {
        // Tag doesn't exist, skip silently
      } else {
        console.log(`   Tag "${tag}" - Error: ${tagError.message}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(55));
}

getStats().catch(console.error);
