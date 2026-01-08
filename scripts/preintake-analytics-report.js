#!/usr/bin/env node
/**
 * PreIntake.ai Weekly Analytics Report
 *
 * Generates a comprehensive email campaign performance report including:
 * - GA4 traffic and engagement metrics
 * - Firestore campaign send statistics
 * - Week-over-week comparisons
 *
 * Sends report via Dreamhost SMTP (support@preintake.ai).
 *
 * Environment Variables:
 *   PREINTAKE_SMTP_USER - SMTP username (support@preintake.ai)
 *   PREINTAKE_SMTP_PASS - SMTP password
 *   REPORT_EMAIL - Email address to send report to (default: scscot@gmail.com)
 *   GA4_PROPERTY_ID - PreIntake.ai GA4 property ID
 *
 * Usage:
 *   node scripts/preintake-analytics-report.js
 */

const admin = require('firebase-admin');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '../secrets/serviceAccountKey.json';
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// Use the dedicated 'preintake' database
const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// GA4 client - uses GOOGLE_APPLICATION_CREDENTIALS or default credentials
const analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: process.env.GA4_CREDENTIALS || '../secrets/ga4-service-account.json'
});

// Configuration
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '485651473'; // Update with PreIntake property ID
const REPORT_EMAIL = process.env.REPORT_EMAIL || 'scscot@gmail.com';
const SMTP_HOST = 'smtp.dreamhost.com';
const SMTP_PORT = 587;
const SMTP_USER = process.env.PREINTAKE_SMTP_USER || 'support@preintake.ai';
const SMTP_PASS = process.env.PREINTAKE_SMTP_PASS;
const FROM_ADDRESS = 'PreIntake.ai Analytics <support@preintake.ai>';

/**
 * Get Firestore campaign statistics
 */
async function getFirestoreStats() {
    const collection = db.collection('preintake_emails');
    const allDocs = await collection.get();

    const stats = {
        total: 0,
        sent: 0,
        pending: 0,
        failed: 0,
        unsubscribed: 0,
        sentThisWeek: 0,
        sentLastWeek: 0
    };

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    allDocs.forEach(doc => {
        const data = doc.data();
        stats.total++;

        if (data.status === 'pending') stats.pending++;
        else if (data.status === 'sent') {
            stats.sent++;

            if (data.sentTimestamp) {
                const sentDate = data.sentTimestamp.toDate();
                if (sentDate >= oneWeekAgo) {
                    stats.sentThisWeek++;
                } else if (sentDate >= twoWeeksAgo && sentDate < oneWeekAgo) {
                    stats.sentLastWeek++;
                }
            }
        }
        else if (data.status === 'failed') stats.failed++;
        else if (data.status === 'unsubscribed') stats.unsubscribed++;
    });

    return stats;
}

/**
 * Get GA4 email traffic metrics
 */
async function getGA4EmailMetrics(startDate, endDate) {
    try {
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${GA4_PROPERTY_ID}`,
            dateRanges: [{ startDate, endDate }],
            dimensions: [
                { name: 'sessionDefaultChannelGroup' }
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'engagedSessions' },
                { name: 'averageSessionDuration' },
                { name: 'screenPageViews' },
                { name: 'bounceRate' }
            ],
            dimensionFilter: {
                filter: {
                    fieldName: 'sessionDefaultChannelGroup',
                    stringFilter: { value: 'Email', matchType: 'EXACT' }
                }
            }
        });

        if (!response.rows || response.rows.length === 0) {
            return {
                sessions: 0,
                engagedSessions: 0,
                engagementRate: 0,
                avgDuration: 0,
                pageViews: 0,
                bounceRate: 0
            };
        }

        const row = response.rows[0];
        const sessions = parseInt(row.metricValues[0].value) || 0;
        const engagedSessions = parseInt(row.metricValues[1].value) || 0;

        return {
            sessions,
            engagedSessions,
            engagementRate: sessions > 0 ? ((engagedSessions / sessions) * 100).toFixed(1) : 0,
            avgDuration: parseFloat(row.metricValues[2].value).toFixed(1),
            pageViews: parseInt(row.metricValues[3].value) || 0,
            bounceRate: (parseFloat(row.metricValues[4].value) * 100).toFixed(1)
        };
    } catch (error) {
        console.error('GA4 Error:', error.message);
        return null;
    }
}

/**
 * Get demo request count from Firestore
 */
async function getDemoRequests(startDate) {
    const leadsCollection = db.collection('preintake_leads');
    const snapshot = await leadsCollection
        .where('createdAt', '>=', startDate)
        .get();

    return snapshot.size;
}

/**
 * Generate HTML email report
 */
function generateReportHTML(firestoreStats, thisWeekGA4, lastWeekGA4, demoRequests) {
    const now = new Date();
    const reportDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Calculate week-over-week changes
    const sessionChange = lastWeekGA4 && lastWeekGA4.sessions > 0
        ? (((thisWeekGA4.sessions - lastWeekGA4.sessions) / lastWeekGA4.sessions) * 100).toFixed(0)
        : 'N/A';

    const engagementChange = lastWeekGA4 && lastWeekGA4.engagedSessions > 0
        ? (((thisWeekGA4.engagedSessions - lastWeekGA4.engagedSessions) / lastWeekGA4.engagedSessions) * 100).toFixed(0)
        : 'N/A';

    const clickRate = firestoreStats.sentThisWeek > 0
        ? ((thisWeekGA4.sessions / firestoreStats.sentThisWeek) * 100).toFixed(1)
        : 'N/A';

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px; margin:0 auto; padding:20px;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:24px; border-radius:12px 12px 0 0; text-align:center;">
            <h1 style="color:#ffffff; font-size:24px; margin:0;">
                <span style="color:#c9a962;">PreIntake.ai</span> Weekly Report
            </h1>
            <p style="color:#94a3b8; margin:8px 0 0 0; font-size:14px;">${reportDate}</p>
        </div>

        <!-- Main Content -->
        <div style="background:#ffffff; padding:24px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">

            <!-- Campaign Progress -->
            <h2 style="color:#0c1f3f; font-size:18px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:2px solid #c9a962;">
                📧 Email Campaign Progress
            </h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Total Contacts</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${firestoreStats.total}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Sent (Total)</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600; color:#10b981;">${firestoreStats.sent}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Sent This Week</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${firestoreStats.sentThisWeek}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Remaining</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600; color:#f59e0b;">${firestoreStats.pending}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Progress</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${((firestoreStats.sent / firestoreStats.total) * 100).toFixed(1)}%</td>
                </tr>
            </table>

            <!-- Click Performance -->
            <h2 style="color:#0c1f3f; font-size:18px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:2px solid #c9a962;">
                🖱️ Click Performance (This Week)
            </h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Sessions from Email</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${thisWeekGA4?.sessions || 0}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Click Rate</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600; color:#10b981;">${clickRate}%</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Engaged Sessions</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${thisWeekGA4?.engagedSessions || 0}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Engagement Rate</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${thisWeekGA4?.engagementRate || 0}%</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Avg Session Duration</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">${thisWeekGA4?.avgDuration || 0}s</td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Bounce Rate</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600; color:#ef4444;">${thisWeekGA4?.bounceRate || 0}%</td>
                </tr>
            </table>

            <!-- Week over Week -->
            <h2 style="color:#0c1f3f; font-size:18px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:2px solid #c9a962;">
                📈 Week-over-Week Change
            </h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Sessions</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">
                        ${sessionChange !== 'N/A' ? (sessionChange > 0 ? '↑' : '↓') + ' ' + Math.abs(sessionChange) + '%' : 'N/A'}
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Engaged Sessions</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600;">
                        ${engagementChange !== 'N/A' ? (engagementChange > 0 ? '↑' : '↓') + ' ' + Math.abs(engagementChange) + '%' : 'N/A'}
                    </td>
                </tr>
            </table>

            <!-- Conversions -->
            <h2 style="color:#0c1f3f; font-size:18px; margin:0 0 16px 0; padding-bottom:8px; border-bottom:2px solid #c9a962;">
                🎯 Conversions
            </h2>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                <tr>
                    <td style="padding:8px 0; color:#64748b;">Demo Requests (This Week)</td>
                    <td style="padding:8px 0; text-align:right; font-weight:600; color:#8b5cf6;">${demoRequests}</td>
                </tr>
            </table>

            <!-- Key Insights -->
            <div style="background:#f8fafc; border-left:4px solid #c9a962; padding:16px; margin-top:24px;">
                <h3 style="color:#0c1f3f; font-size:14px; margin:0 0 8px 0;">💡 Key Insights</h3>
                <ul style="color:#64748b; font-size:14px; margin:0; padding-left:20px;">
                    ${thisWeekGA4?.sessions > 0 && firestoreStats.sentThisWeek > 0 ? `
                    <li style="margin-bottom:4px;">Click rate of ${clickRate}% ${parseFloat(clickRate) > 5 ? 'exceeds' : 'is below'} industry average (2-5%)</li>
                    ` : ''}
                    ${thisWeekGA4?.engagementRate < 50 ? `
                    <li style="margin-bottom:4px;">Engagement rate of ${thisWeekGA4?.engagementRate}% suggests homepage optimization opportunity</li>
                    ` : ''}
                    ${demoRequests === 0 && thisWeekGA4?.sessions > 10 ? `
                    <li style="margin-bottom:4px;">0 demos despite ${thisWeekGA4?.sessions} clicks - review homepage conversion</li>
                    ` : ''}
                    ${firestoreStats.pending > 0 ? `
                    <li style="margin-bottom:4px;">${firestoreStats.pending} emails remaining (~${Math.ceil(firestoreStats.pending / 80)} days at current pace)</li>
                    ` : ''}
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
            <p style="margin:0;">Automated report from PreIntake.ai Analytics</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Send report via Dreamhost SMTP
 */
async function sendReport(htmlContent) {
    if (!SMTP_PASS) {
        console.log('⚠️  PREINTAKE_SMTP_PASS not set - printing report to console instead');
        console.log('Report would be sent to:', REPORT_EMAIL);
        return false;
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: false,
        requireTLS: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const now = new Date();
    const weekOf = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: REPORT_EMAIL,
            subject: `PreIntake.ai Weekly Report - Week of ${weekOf}`,
            html: htmlContent
        });
        console.log('✅ Report sent to', REPORT_EMAIL);
        return true;
    } catch (error) {
        console.error('❌ Failed to send report:', error.message);
        return false;
    }
}

/**
 * Main function
 */
async function generateReport() {
    console.log('📊 PreIntake.ai Analytics Report Generator');
    console.log('==========================================\n');

    // Get date ranges
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log('📅 Fetching data...\n');

    // Fetch all data
    const [firestoreStats, thisWeekGA4, lastWeekGA4, demoRequests] = await Promise.all([
        getFirestoreStats(),
        getGA4EmailMetrics('7daysAgo', 'today'),
        getGA4EmailMetrics('14daysAgo', '7daysAgo'),
        getDemoRequests(thisWeekStart)
    ]);

    console.log('📧 Firestore Stats:', firestoreStats);
    console.log('📈 This Week GA4:', thisWeekGA4);
    console.log('📉 Last Week GA4:', lastWeekGA4);
    console.log('🎯 Demo Requests:', demoRequests);
    console.log('');

    // Generate and send report
    const reportHTML = generateReportHTML(firestoreStats, thisWeekGA4, lastWeekGA4, demoRequests);
    await sendReport(reportHTML);

    console.log('\n✅ Report generation complete');
    process.exit(0);
}

// Run
generateReport().catch(err => {
    console.error('❌ Report failed:', err);
    process.exit(1);
});
