const axios = require('axios');
const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', 'secrets', 'mailgun_config.json');
const mailgunConfig = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));

const MAILGUN_API_KEY = mailgunConfig.api_key;
const MAILGUN_DOMAIN = mailgunConfig.domain;

async function get2VersionStats() {
  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

    console.log('📊 2VERSION CAMPAIGN PERFORMANCE');
    console.log('='.repeat(70));
    console.log(`Domain: ${MAILGUN_DOMAIN}`);
    console.log(`Date Range: ${twoDaysAgo.toLocaleString()} to ${now.toLocaleString()}`);
    console.log(`Subject Line: "The hidden reason most reps stall after Day 1."`);
    console.log('');

    const events = {
      accepted: [],
      delivered: [],
      failed: [],
      opened: [],
      clicked: []
    };

    for (const eventType of ['accepted', 'delivered', 'failed', 'opened', 'clicked']) {
      try {
        const response = await axios.get(`${mailgunBaseUrl}/events`, {
          auth: {
            username: 'api',
            password: MAILGUN_API_KEY
          },
          params: {
            begin: twoDaysAgo.getTime() / 1000,
            end: now.getTime() / 1000,
            event: eventType,
            tags: '2version',
            limit: 300
          }
        });

        if (response.data && response.data.items) {
          events[eventType] = response.data.items;
        }
      } catch (error) {
        console.log(`⚠️  Error fetching ${eventType} events:`, error.message);
      }
    }

    console.log('📈 Campaign Statistics:');
    console.log('-'.repeat(70));
    console.log(`   ✅ Accepted: ${events.accepted.length}`);
    console.log(`   📬 Delivered: ${events.delivered.length}`);
    console.log(`   ❌ Failed: ${events.failed.length}`);
    console.log(`   👁️  Opened: ${events.opened.length}`);
    console.log(`   🖱️  Clicked: ${events.clicked.length}`);
    console.log('');

    if (events.delivered.length > 0) {
      const openRate = ((events.opened.length / events.delivered.length) * 100).toFixed(2);
      const clickRate = ((events.clicked.length / events.delivered.length) * 100).toFixed(2);
      const uniqueOpens = new Set(events.opened.map(e => e.recipient)).size;
      const uniqueClicks = new Set(events.clicked.map(e => e.recipient)).size;

      console.log('📊 Performance Metrics:');
      console.log('-'.repeat(70));
      console.log(`   Open Rate: ${openRate}% (${uniqueOpens} unique recipients)`);
      console.log(`   Click Rate: ${clickRate}% (${uniqueClicks} unique recipients)`);
      console.log(`   Engagement Rate: ${((parseFloat(openRate) + parseFloat(clickRate))).toFixed(2)}%`);
      console.log('');
    }

    if (events.delivered.length > 0) {
      console.log('📅 Send Timeline (Last 10 deliveries):');
      console.log('-'.repeat(70));
      events.delivered.slice(-10).forEach(event => {
        const time = new Date(event.timestamp * 1000);
        console.log(`   ${time.toLocaleString()} - ${event.recipient}`);
      });
      console.log('');
    }

    if (events.opened.length > 0) {
      console.log('👁️  Open Timeline (Last 10 opens):');
      console.log('-'.repeat(70));
      events.opened.slice(-10).forEach(event => {
        const time = new Date(event.timestamp * 1000);
        const deliveryTime = events.delivered.find(d => d.recipient === event.recipient);
        let timeToOpen = '';
        if (deliveryTime) {
          const minutesToOpen = Math.round((event.timestamp - deliveryTime.timestamp) / 60);
          timeToOpen = ` (opened ${minutesToOpen} min after delivery)`;
        }
        console.log(`   ${time.toLocaleString()} - ${event.recipient}${timeToOpen}`);
      });
      console.log('');
    }

    if (events.failed.length > 0) {
      console.log('❌ Failed Deliveries:');
      console.log('-'.repeat(70));
      events.failed.forEach(event => {
        const time = new Date(event.timestamp * 1000);
        console.log(`   ${time.toLocaleString()} - ${event.recipient}`);
        console.log(`      Reason: ${event.reason || event['delivery-status']?.message || 'Unknown'}`);
      });
      console.log('');
    }

    if (events.clicked.length > 0) {
      console.log('🖱️  Click Details:');
      console.log('-'.repeat(70));
      events.clicked.forEach(event => {
        const time = new Date(event.timestamp * 1000);
        console.log(`   ${time.toLocaleString()} - ${event.recipient}`);
        console.log(`      URL: ${event.url}`);
      });
      console.log('');
    }

    const sendHours = {};
    events.delivered.forEach(event => {
      const hour = new Date(event.timestamp * 1000).getHours();
      sendHours[hour] = (sendHours[hour] || 0) + 1;
    });

    if (Object.keys(sendHours).length > 0) {
      console.log('⏰ Send Distribution by Hour (PT):');
      console.log('-'.repeat(70));
      Object.entries(sendHours)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([hour, count]) => {
          const hourInt = parseInt(hour);
          const ampm = hourInt >= 12 ? 'PM' : 'AM';
          const hour12 = hourInt > 12 ? hourInt - 12 : (hourInt === 0 ? 12 : hourInt);
          console.log(`   ${hour12}:00 ${ampm}: ${count} emails`);
        });
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('');
    console.log('💡 Analysis:');
    console.log('-'.repeat(70));

    if (events.delivered.length > 0) {
      const openRate = ((events.opened.length / events.delivered.length) * 100);

      if (openRate < 5) {
        console.log('   ⚠️  VERY LOW open rate - Subject line may need optimization');
        console.log('   ⚠️  Consider A/B testing alternative subject lines');
      } else if (openRate < 15) {
        console.log('   ⚠️  Below average open rate - Room for improvement');
      } else if (openRate < 25) {
        console.log('   ✅ Good open rate - Within industry standards');
      } else {
        console.log('   🎉 Excellent open rate - Well above average!');
      }

      if (events.clicked.length === 0) {
        console.log('   ⚠️  No clicks yet - May need stronger call-to-action');
      }
    }

    console.log('');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Error fetching 2version campaign stats:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

get2VersionStats();
