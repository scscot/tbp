// ==============================
// EMAIL STATS FUNCTIONS MODULE
// Provides email campaign statistics for the web dashboard
// Now uses Firestore for tracking data (SMTP migration)
// ==============================

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { db } = require('./shared/utilities');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// GA4 Service Account credentials (stored as secret)
const ga4ServiceAccount = defineSecret('GA4_SERVICE_ACCOUNT');

// Constants
const MAIN_CAMPAIGN_COLLECTION = 'emailCampaigns/master/contacts';
const CONTACTS_CAMPAIGN_COLLECTION = 'direct_sales_contacts';
const PURCHASED_CAMPAIGN_COLLECTION = 'purchased_leads';
const BFH_CAMPAIGN_COLLECTION = 'bfh_contacts';
const ZINZINO_CAMPAIGN_COLLECTION = 'zinzino_contacts';
const FSR_CAMPAIGN_COLLECTION = 'fsr_contacts';
const PAPARAZZI_CAMPAIGN_COLLECTION = 'paparazzi_contacts';
const PRUVIT_CAMPAIGN_COLLECTION = 'pruvit_contacts';
const SCENTSY_CAMPAIGN_COLLECTION = 'scentsy_contacts';
const MPG_CAMPAIGN_COLLECTION = 'mpg_contacts';
const THREE_CAMPAIGN_COLLECTION = 'three_contacts';
const FARMASIUS_CAMPAIGN_COLLECTION = 'farmasius_contacts';
const SPANISH_CAMPAIGN_COLLECTION = 'spanish_contacts';
const RODANFIELDS_CAMPAIGN_COLLECTION = 'rodanfields_contacts';
const MONITORING_PASSWORD = process.env.MONITORING_PASSWORD || 'TeamBuildPro2024!';
const GA4_PROPERTY_ID = '485651473';

/**
 * Get email tracking statistics from Firestore
 * Click tracking now via GA4 UTM parameters (not Firestore clickedAt field)
 * Open tracking disabled — Mailgun pixel removed for deliverability
 *
 * NOTE: clicked count is populated by fetchPerCampaignGA4Sessions() which queries GA4
 * The old clickedAt Firestore field is NOT populated and should not be used.
 */
async function fetchEmailTrackingStats(contactsRef) {
  try {
    // Get sent count
    const sentSnapshot = await contactsRef.where('sent', '==', true).count().get();
    const sent = sentSnapshot.data().count;

    // Get failed count
    const failedSnapshot = await contactsRef.where('status', '==', 'failed').count().get();
    const failed = failedSnapshot.data().count;

    // NOTE: clicked is now populated from GA4 session data, not Firestore clickedAt
    // See fetchPerCampaignGA4Sessions() which queries GA4 by utm_campaign
    // Return 0 here as placeholder - actual value comes from GA4
    const clicked = 0;
    const clickRate = '0%';

    return {
      sent,
      failed,
      clicked,
      clickRate
    };
  } catch (error) {
    console.error('Error fetching email tracking stats:', error.message);
    return null;
  }
}

/**
 * Get A/B test subject line breakdown from Firestore
 */
async function fetchSubjectLineStats(contactsRef) {
  try {
    // Get all sent contacts with their subject tags
    const sentSnapshot = await contactsRef
      .where('sent', '==', true)
      .select('subjectTag', 'clickedAt')
      .get();

    // Aggregate by subject tag (exclude legacy/unknown tags from A/B results)
    const EXCLUDED_TAGS = new Set(['subject_recruiting_app', 'unknown']);
    const subjectStats = {};

    sentSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const tag = data.subjectTag || 'unknown';

      if (EXCLUDED_TAGS.has(tag)) return;

      if (!subjectStats[tag]) {
        subjectStats[tag] = { sent: 0, clicked: 0 };
      }

      subjectStats[tag].sent++;
      if (data.clickedAt) subjectStats[tag].clicked++;
    });

    // Calculate click rate for each subject
    const result = Object.entries(subjectStats).map(([tag, stats]) => ({
      subjectTag: tag,
      sent: stats.sent,
      clicked: stats.clicked,
      clickRate: stats.sent > 0 ? ((stats.clicked / stats.sent) * 100).toFixed(1) + '%' : '0%'
    }));

    return result;
  } catch (error) {
    console.error('Error fetching subject line stats:', error.message);
    return [];
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
          fieldName: 'sessionMedium',
          stringFilter: {
            value: 'email',
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
    const totals = {
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
 * Fetch per-campaign GA4 sessions for accurate click tracking
 * Maps utm_campaign values back to TBP campaign names
 *
 * GA4 utm_campaign patterns used by TBP campaigns:
 * - main_v14, main_v9, etc. → Main campaign
 * - purchased_v14, purchased_apollo, purchased_serpapi → Purchased campaign
 * - bfh_v14_en, bfh_v14_es, etc. → BFH campaign
 * - scentsy_v14_en, scentsy_outreach_feb → Scentsy campaign
 * - zinzino_v14, etc. → Zinzino campaign
 * - fsr_v14, etc. → FSR campaign
 * - paparazzi_v14, etc. → Paparazzi campaign
 * - pruvit_v14, etc. → Pruvit campaign
 * - mpg_v14, etc. → MPG campaign
 * - three_v14, etc. → Three campaign
 * - farmasius_v14, etc. → Farmasius campaign
 */
async function fetchPerCampaignGA4Sessions(serviceAccountJson) {
  try {
    const credentials = JSON.parse(serviceAccountJson);

    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key
      },
      projectId: credentials.project_id
    });

    // Fetch last 30 days of email campaign traffic by campaign name
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [
        { name: 'sessionCampaignName' }
      ],
      metrics: [
        { name: 'sessions' }
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionMedium',
          stringFilter: {
            value: 'email',
            matchType: 'EXACT'
          }
        }
      }
    });

    if (!response.rows || response.rows.length === 0) {
      return {};
    }

    // Map GA4 campaign names to TBP campaign identifiers
    const campaignSessions = {
      main: 0,
      purchased: 0,
      bfh: 0,
      zinzino: 0,
      fsr: 0,
      paparazzi: 0,
      pruvit: 0,
      scentsy: 0,
      mpg: 0,
      three: 0,
      farmasius: 0,
      contacts: 0,
      unknown: 0
    };

    response.rows.forEach(row => {
      const campaignName = (row.dimensionValues[0].value || '').toLowerCase();
      const sessions = parseInt(row.metricValues[0].value) || 0;

      // Map to campaign based on prefix patterns
      if (campaignName.startsWith('main_') || campaignName === 'tbp_campaign') {
        campaignSessions.main += sessions;
      } else if (campaignName.startsWith('purchased_') || campaignName.includes('purchased')) {
        campaignSessions.purchased += sessions;
      } else if (campaignName.startsWith('bfh_') || campaignName.includes('bfh')) {
        campaignSessions.bfh += sessions;
      } else if (campaignName.startsWith('scentsy_') || campaignName.includes('scentsy')) {
        campaignSessions.scentsy += sessions;
      } else if (campaignName.startsWith('zinzino_') || campaignName.includes('zinzino')) {
        campaignSessions.zinzino += sessions;
      } else if (campaignName.startsWith('fsr_') || campaignName.includes('fsr')) {
        campaignSessions.fsr += sessions;
      } else if (campaignName.startsWith('paparazzi_') || campaignName.includes('paparazzi')) {
        campaignSessions.paparazzi += sessions;
      } else if (campaignName.startsWith('pruvit_') || campaignName.includes('pruvit')) {
        campaignSessions.pruvit += sessions;
      } else if (campaignName.startsWith('mpg_') || campaignName.includes('mpg')) {
        campaignSessions.mpg += sessions;
      } else if (campaignName.startsWith('three_') || campaignName.includes('three')) {
        campaignSessions.three += sessions;
      } else if (campaignName.startsWith('farmasius_') || campaignName.includes('farmasius')) {
        campaignSessions.farmasius += sessions;
      } else if (campaignName.startsWith('contacts_') || campaignName.includes('contacts')) {
        campaignSessions.contacts += sessions;
      } else {
        campaignSessions.unknown += sessions;
      }
    });

    return campaignSessions;

  } catch (error) {
    console.error('Error fetching per-campaign GA4 sessions:', error.message);
    return {};
  }
}

/**
 * Fetch campaign stats for a given collection
 */
async function fetchCampaignStats(collectionPath, now, twentyFourHoursAgo, startOfTodayUTC, options = {}) {
  const contactsRef = db.collection(collectionPath);
  const { isContactsCampaign = false, isZinzinoCampaign = false, isFsrCampaign = false, isPaparazziCampaign = false, isScentsyCampaign = false } = options;

  // Get total count
  let totalSnapshot;
  if (isContactsCampaign) {
    // For contacts campaign, count scraped contacts (email validation done during scraping)
    totalSnapshot = await contactsRef
      .where('scraped', '==', true)
      .count()
      .get();
  } else {
    // For main, purchased, and BFH campaigns, count all contacts in collection
    totalSnapshot = await contactsRef.count().get();
  }
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
      template: data.templateVersion || data.template || 'N/A',
      subjectTag: data.subjectTag || '-',
      clicked: !!data.clickedAt,
      company: data.company || null,  // Include company for contacts campaign
      country: data.country || null   // Include country for zinzino campaign
    };
  });

  // Get email tracking stats from Firestore
  const trackingStats = await fetchEmailTrackingStats(contactsRef);

  // Get subject line breakdown
  const subjectLineStats = await fetchSubjectLineStats(contactsRef);

  // Get language breakdown for Zinzino and Scentsy campaigns (multilingual)
  let languageBreakdown = null;
  if (isZinzinoCampaign || isScentsyCampaign) {
    try {
      const sentDocs = await contactsRef
        .where('sent', '==', true)
        .select('sentLanguage')
        .get();

      const langCounts = { en: 0, es: 0, de: 0 };
      sentDocs.docs.forEach(doc => {
        const lang = doc.data().sentLanguage || 'en';
        if (langCounts.hasOwnProperty(lang)) {
          langCounts[lang]++;
        } else {
          langCounts.en++;  // Default to English if unknown
        }
      });
      languageBreakdown = langCounts;
    } catch (langError) {
      console.error('Error fetching language breakdown:', langError.message);
    }
  }

  // Get company/state distribution for FSR and Paparazzi campaigns
  let distribution = null;
  if (isFsrCampaign || isPaparazziCampaign) {
    try {
      const sentDocs = await contactsRef
        .where('sent', '==', true)
        .select('company', 'state')
        .get();

      const companies = new Set();
      const states = new Set();
      sentDocs.docs.forEach(doc => {
        const data = doc.data();
        if (data.company) companies.add(data.company);
        if (data.state) states.add(data.state);
      });
      distribution = {
        companies: companies.size,
        states: states.size
      };
    } catch (distError) {
      console.error('Error fetching campaign distribution:', distError.message);
    }
  }

  return {
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
    tracking: trackingStats || {
      sent: 0,
      failed: 0,
      clicked: 0,
      clickRate: '0%'
    },
    subjectLines: subjectLineStats,
    recentSends,
    languageBreakdown,
    distribution
  };
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

    // Fetch stats for all campaigns in parallel
    const [mainCampaignStats, contactsCampaignStats, purchasedCampaignStats, bfhCampaignStats, zinzinoCampaignStats, fsrCampaignStats, paparazziCampaignStats, pruvitCampaignStats, scentsyCampaignStats, mpgCampaignStats, threeCampaignStats, farmasiusCampaignStats, spanishCampaignStats, rodanfieldsCampaignStats] = await Promise.all([
      fetchCampaignStats(MAIN_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(CONTACTS_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isContactsCampaign: true }),
      fetchCampaignStats(PURCHASED_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(BFH_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(ZINZINO_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isZinzinoCampaign: true }),
      fetchCampaignStats(FSR_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isFsrCampaign: true }),
      fetchCampaignStats(PAPARAZZI_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isPaparazziCampaign: true }),
      fetchCampaignStats(PRUVIT_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(SCENTSY_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isScentsyCampaign: true }),
      fetchCampaignStats(MPG_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(THREE_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(FARMASIUS_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC, { isFarmasiusCampaign: true }),
      fetchCampaignStats(SPANISH_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC),
      fetchCampaignStats(RODANFIELDS_CAMPAIGN_COLLECTION, now, twentyFourHoursAgo, startOfTodayUTC)
    ]);

    // Get GA4 stats (shared across campaigns)
    let ga4Stats = null;
    let perCampaignClicks = {};
    try {
      const serviceAccountJson = ga4ServiceAccount.value();
      if (serviceAccountJson) {
        // Fetch both aggregate stats and per-campaign sessions in parallel
        const [aggregateStats, campaignClicks] = await Promise.all([
          fetchGA4Stats(serviceAccountJson),
          fetchPerCampaignGA4Sessions(serviceAccountJson)
        ]);
        ga4Stats = aggregateStats;
        perCampaignClicks = campaignClicks;
      }
    } catch (ga4Error) {
      console.error('GA4 stats error:', ga4Error.message);
    }

    // Helper to inject GA4 click data into campaign tracking stats
    const injectClickData = (stats, campaignKey) => {
      if (perCampaignClicks && perCampaignClicks[campaignKey] !== undefined) {
        const clicked = perCampaignClicks[campaignKey];
        const sent = stats.tracking?.sent || 0;
        stats.tracking.clicked = clicked;
        stats.tracking.clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) + '%' : '0%';
      }
      return stats;
    };

    // Inject GA4 click data into each campaign's tracking stats
    injectClickData(mainCampaignStats, 'main');
    injectClickData(contactsCampaignStats, 'contacts');
    injectClickData(purchasedCampaignStats, 'purchased');
    injectClickData(bfhCampaignStats, 'bfh');
    injectClickData(zinzinoCampaignStats, 'zinzino');
    injectClickData(fsrCampaignStats, 'fsr');
    injectClickData(paparazziCampaignStats, 'paparazzi');
    injectClickData(pruvitCampaignStats, 'pruvit');
    injectClickData(scentsyCampaignStats, 'scentsy');
    injectClickData(mpgCampaignStats, 'mpg');
    injectClickData(threeCampaignStats, 'three');
    injectClickData(farmasiusCampaignStats, 'farmasius');
    injectClickData(spanishCampaignStats, 'spanish');
    injectClickData(rodanfieldsCampaignStats, 'rodanfields');

    // Build response - maintain backward compatibility with existing dashboard
    // while adding contacts campaign data
    const response = {
      // Main campaign data (for backward compatibility)
      campaign: mainCampaignStats.campaign,
      last24h: mainCampaignStats.last24h,
      today: mainCampaignStats.today,
      tracking: mainCampaignStats.tracking,
      subjectLines: mainCampaignStats.subjectLines,
      recentSends: mainCampaignStats.recentSends,

      // Contacts campaign data
      contactsCampaign: {
        campaign: contactsCampaignStats.campaign,
        last24h: contactsCampaignStats.last24h,
        today: contactsCampaignStats.today,
        tracking: contactsCampaignStats.tracking,
        subjectLines: contactsCampaignStats.subjectLines,
        recentSends: contactsCampaignStats.recentSends
      },

      // Purchased leads campaign data
      purchasedCampaign: {
        campaign: purchasedCampaignStats.campaign,
        last24h: purchasedCampaignStats.last24h,
        today: purchasedCampaignStats.today,
        tracking: purchasedCampaignStats.tracking,
        subjectLines: purchasedCampaignStats.subjectLines,
        recentSends: purchasedCampaignStats.recentSends
      },

      // BFH (Business For Home) campaign data
      bfhCampaign: {
        campaign: bfhCampaignStats.campaign,
        last24h: bfhCampaignStats.last24h,
        today: bfhCampaignStats.today,
        tracking: bfhCampaignStats.tracking,
        subjectLines: bfhCampaignStats.subjectLines,
        recentSends: bfhCampaignStats.recentSends
      },

      // Zinzino campaign data
      zinzinoCampaign: {
        campaign: zinzinoCampaignStats.campaign,
        last24h: zinzinoCampaignStats.last24h,
        today: zinzinoCampaignStats.today,
        tracking: zinzinoCampaignStats.tracking,
        subjectLines: zinzinoCampaignStats.subjectLines,
        recentSends: zinzinoCampaignStats.recentSends,
        languageBreakdown: zinzinoCampaignStats.languageBreakdown
      },

      // FSR (FindSalesRep) campaign data
      fsrCampaign: {
        campaign: fsrCampaignStats.campaign,
        last24h: fsrCampaignStats.last24h,
        today: fsrCampaignStats.today,
        tracking: fsrCampaignStats.tracking,
        subjectLines: fsrCampaignStats.subjectLines,
        recentSends: fsrCampaignStats.recentSends,
        distribution: fsrCampaignStats.distribution
      },

      // Paparazzi Accessories campaign data
      paparazziCampaign: {
        campaign: paparazziCampaignStats.campaign,
        last24h: paparazziCampaignStats.last24h,
        today: paparazziCampaignStats.today,
        tracking: paparazziCampaignStats.tracking,
        subjectLines: paparazziCampaignStats.subjectLines,
        recentSends: paparazziCampaignStats.recentSends,
        distribution: paparazziCampaignStats.distribution
      },

      // Pruvit campaign data
      pruvitCampaign: {
        campaign: pruvitCampaignStats.campaign,
        last24h: pruvitCampaignStats.last24h,
        today: pruvitCampaignStats.today,
        tracking: pruvitCampaignStats.tracking,
        subjectLines: pruvitCampaignStats.subjectLines,
        recentSends: pruvitCampaignStats.recentSends
      },

      // Scentsy campaign data
      scentsyCampaign: {
        campaign: scentsyCampaignStats.campaign,
        last24h: scentsyCampaignStats.last24h,
        today: scentsyCampaignStats.today,
        tracking: scentsyCampaignStats.tracking,
        subjectLines: scentsyCampaignStats.subjectLines,
        recentSends: scentsyCampaignStats.recentSends,
        languageBreakdown: scentsyCampaignStats.languageBreakdown
      },

      // MPG campaign data
      mpgCampaign: {
        campaign: mpgCampaignStats.campaign,
        last24h: mpgCampaignStats.last24h,
        today: mpgCampaignStats.today,
        tracking: mpgCampaignStats.tracking,
        subjectLines: mpgCampaignStats.subjectLines,
        recentSends: mpgCampaignStats.recentSends
      },

      // Three campaign data
      threeCampaign: {
        campaign: threeCampaignStats.campaign,
        last24h: threeCampaignStats.last24h,
        today: threeCampaignStats.today,
        tracking: threeCampaignStats.tracking,
        subjectLines: threeCampaignStats.subjectLines,
        recentSends: threeCampaignStats.recentSends
      },

      // Farmasius campaign data
      farmasiusCampaign: {
        campaign: farmasiusCampaignStats.campaign,
        last24h: farmasiusCampaignStats.last24h,
        today: farmasiusCampaignStats.today,
        tracking: farmasiusCampaignStats.tracking,
        subjectLines: farmasiusCampaignStats.subjectLines,
        recentSends: farmasiusCampaignStats.recentSends,
        languageBreakdown: farmasiusCampaignStats.languageBreakdown
      },

      // Spanish (Omnilife) campaign data
      spanishCampaign: {
        campaign: spanishCampaignStats.campaign,
        last24h: spanishCampaignStats.last24h,
        today: spanishCampaignStats.today,
        tracking: spanishCampaignStats.tracking,
        subjectLines: spanishCampaignStats.subjectLines,
        recentSends: spanishCampaignStats.recentSends
      },

      // Rodan + Fields campaign data
      rodanfieldsCampaign: {
        campaign: rodanfieldsCampaignStats.campaign,
        last24h: rodanfieldsCampaignStats.last24h,
        today: rodanfieldsCampaignStats.today,
        tracking: rodanfieldsCampaignStats.tracking,
        subjectLines: rodanfieldsCampaignStats.subjectLines,
        recentSends: rodanfieldsCampaignStats.recentSends
      },

      // GA4 stats (shared)
      ga4: ga4Stats || {
        sessions: 0,
        users: 0,
        newUsers: 0,
        avgSessionDuration: '0s',
        engagementRate: '0%'
      },

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
