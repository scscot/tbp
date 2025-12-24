// ==============================
// EMAIL STATS FUNCTIONS MODULE
// Provides email campaign statistics for the web dashboard
// ==============================

const { onRequest } = require('firebase-functions/v2/https');
const { defineString, defineSecret } = require('firebase-functions/params');
const { db } = require('./shared/utilities');
const axios = require('axios');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Parameters (loaded from .env file)
const mailgunApiKey = defineString('MAILGUN_API_KEY');

// GA4 Service Account credentials (stored as secret)
const ga4ServiceAccount = defineSecret('GA4_SERVICE_ACCOUNT');

// Constants
const MAILGUN_DOMAIN = 'mailer.teambuildpro.com';
const CONTACTS_COLLECTION = 'emailCampaigns/master/contacts';
const MONITORING_PASSWORD = process.env.MONITORING_PASSWORD || 'TeamBuildPro2024!';
const GA4_PROPERTY_ID = '485651473';

/**
 * Get Mailgun statistics for today
 */
async function fetchMailgunStats(apiKey, domain) {
  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${domain}`;

    // Build URL with proper event parameter format for Mailgun API
    const events = ['accepted', 'delivered', 'failed', 'opened', 'clicked'];
    const eventParams = events.map(e => `event=${e}`).join('&');
    const url = `${mailgunBaseUrl}/stats/total?${eventParams}&duration=1d&resolution=hour`;

    const statsResponse = await axios.get(url, {
      auth: {
        username: 'api',
        password: apiKey
      }
    });

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

      const openRate = totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) + '%' : '0%';
      const clickRate = totals.delivered > 0 ? ((totals.clicked / totals.delivered) * 100).toFixed(1) + '%' : '0%';
      const engagementRate = totals.delivered > 0 ? (((totals.opened + totals.clicked) / totals.delivered) * 100).toFixed(1) + '%' : '0%';

      return {
        accepted: totals.accepted,
        delivered: totals.delivered,
        failed: totals.failed,
        opened: totals.opened,
        clicked: totals.clicked,
        openRate,
        clickRate,
        engagementRate
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching Mailgun stats:', error.message);
    return null;
  }
}

/**
 * Get GA4 analytics for email campaign traffic
 */
async function fetchGA4Stats(serviceAccountJson) {
  try {
    // Parse service account credentials
    const credentials = JSON.parse(serviceAccountJson);

    // Initialize GA4 client with credentials
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key
      },
      projectId: credentials.project_id
    });

    // Fetch last 24 hours of email campaign traffic
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'averageSessionDuration' },
        { name: 'engagementRate' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionSource',
          stringFilter: {
            value: 'mailgun',
            matchType: 'EXACT'
          }
        }
      }
    });

    if (!response.rows || response.rows.length === 0) {
      return {
        sessions: 0,
        users: 0,
        newUsers: 0,
        avgSessionDuration: '0s',
        engagementRate: '0%'
      };
    }

    // Aggregate results
    let totals = {
      sessions: 0,
      users: 0,
      newUsers: 0,
      avgSessionDuration: 0,
      engagementRate: 0
    };

    response.rows.forEach(row => {
      totals.sessions += parseInt(row.metricValues[0].value) || 0;
      totals.users += parseInt(row.metricValues[1].value) || 0;
      totals.newUsers += parseInt(row.metricValues[2].value) || 0;
      totals.avgSessionDuration += parseFloat(row.metricValues[3].value) || 0;
      totals.engagementRate += parseFloat(row.metricValues[4].value) || 0;
    });

    // Average the rates
    const rowCount = response.rows.length;
    if (rowCount > 0) {
      totals.avgSessionDuration = totals.avgSessionDuration / rowCount;
      totals.engagementRate = totals.engagementRate / rowCount;
    }

    return {
      sessions: totals.sessions,
      users: totals.users,
      newUsers: totals.newUsers,
      avgSessionDuration: totals.avgSessionDuration.toFixed(1) + 's',
      engagementRate: (totals.engagementRate * 100).toFixed(1) + '%'
    };

  } catch (error) {
    console.error('Error fetching GA4 stats:', error.message);
    return null;
  }
}

/**
 * HTTP endpoint to get email campaign statistics for the dashboard
 */
const getEmailCampaignStats = onRequest({
  region: 'us-central1',
  cors: true,
  secrets: [ga4ServiceAccount]
}, async (req, res) => {
  try {
    // Password validation
    const { password } = req.query;

    if (!password || password !== MONITORING_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get start of today in PT timezone
    const ptOffset = -8 * 60; // PST offset in minutes
    const nowPT = new Date(now.getTime() + (ptOffset + now.getTimezoneOffset()) * 60 * 1000);
    const startOfTodayPT = new Date(nowPT.getFullYear(), nowPT.getMonth(), nowPT.getDate());
    // Convert back to UTC for Firestore query
    const startOfTodayUTC = new Date(startOfTodayPT.getTime() - (ptOffset + now.getTimezoneOffset()) * 60 * 1000);

    // Query campaign contacts
    const contactsRef = db.collection(CONTACTS_COLLECTION);

    // Get total count
    const totalSnapshot = await contactsRef.count().get();
    const totalContacts = totalSnapshot.data().count;

    // Get sent count
    const sentSnapshot = await contactsRef.where('sent', '==', true).count().get();
    const sentCount = sentSnapshot.data().count;

    // Get last 24 hours count
    const last24hSnapshot = await contactsRef
      .where('sentTimestamp', '>=', twentyFourHoursAgo)
      .count()
      .get();
    const last24hCount = last24hSnapshot.data().count;

    // Get today's count (PT timezone)
    const todaySnapshot = await contactsRef
      .where('sentTimestamp', '>=', startOfTodayUTC)
      .count()
      .get();
    const todayCount = todaySnapshot.data().count;

    // Get recent sends (last 20)
    const recentSendsSnapshot = await contactsRef
      .where('sent', '==', true)
      .orderBy('sentTimestamp', 'desc')
      .limit(20)
      .get();

    const recentSends = recentSendsSnapshot.docs.map(doc => {
      const data = doc.data();
      const timestamp = data.sentTimestamp?.toDate?.() || new Date(data.sentTimestamp);
      return {
        time: timestamp.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
        email: data.email || 'Unknown',
        template: data.templateVersion || data.template || 'N/A'
      };
    });

    // Get Mailgun stats
    const mailgunStats = await fetchMailgunStats(
      mailgunApiKey.value(),
      MAILGUN_DOMAIN
    );

    // Get GA4 stats
    let ga4Stats = null;
    try {
      const serviceAccountJson = ga4ServiceAccount.value();
      if (serviceAccountJson) {
        ga4Stats = await fetchGA4Stats(serviceAccountJson);
      }
    } catch (ga4Error) {
      console.error('GA4 stats error:', ga4Error.message);
    }

    // Build response
    const response = {
      campaign: {
        sent: sentCount,
        remaining: totalContacts - sentCount,
        total: totalContacts
      },
      last24h: {
        sent: last24hCount
      },
      today: {
        sent: todayCount
      },
      mailgun: mailgunStats || {
        accepted: 0,
        delivered: 0,
        failed: 0,
        opened: 0,
        clicked: 0,
        openRate: '0%',
        clickRate: '0%',
        engagementRate: '0%'
      },
      ga4: ga4Stats || {
        sessions: 0,
        users: 0,
        newUsers: 0,
        avgSessionDuration: '0s',
        engagementRate: '0%'
      },
      recentSends,
      timestamp: now.toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error in getEmailCampaignStats:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

module.exports = {
  getEmailCampaignStats
};
