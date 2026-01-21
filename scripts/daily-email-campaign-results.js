#!/usr/bin/env node
/**
 * Daily Email Campaign Results Report
 * Analyzes preintake_emails collection and sends a formatted report
 *
 * Run: node scripts/daily-email-campaign-results.js
 */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const path = require("path");

// Initialize Firebase
const serviceAccount = require(path.join(__dirname, "..", "secrets", "serviceAccountKey.json"));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: "preintake" });

// SMTP config
const smtpUser = process.env.PREINTAKE_SMTP_USER;
const smtpPass = process.env.PREINTAKE_SMTP_PASS;
const RECIPIENT_EMAIL = "sscot@gmail.com";

/**
 * Check if a date is today (in PST timezone)
 */
function isToday(date) {
    if (!date) return false;
    const now = new Date();
    // Convert to PST
    const pstOffset = -8 * 60; // PST is UTC-8
    const nowPST = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60000);
    const datePST = new Date(date.getTime() + (date.getTimezoneOffset() + pstOffset) * 60000);

    return nowPST.toDateString() === datePST.toDateString();
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Generate HTML report
 */
function generateHtmlReport(stateStats, totals, reportDate) {
    const sortedStates = Object.keys(stateStats).sort((a, b) => {
        // Sort by total contacts descending
        const totalA = stateStats[a].withWebsite.total + stateStats[a].withoutWebsite.total;
        const totalB = stateStats[b].withWebsite.total + stateStats[b].withoutWebsite.total;
        return totalB - totalA;
    });

    let stateRows = '';
    for (const state of sortedStates) {
        const s = stateStats[state];
        stateRows += `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">${state}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withWebsite.addedToday)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withWebsite.total)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withoutWebsite.addedToday)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withoutWebsite.total)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withWebsite.sentToday)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withWebsite.sentTotal)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withoutWebsite.sentToday)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${formatNumber(s.withoutWebsite.sentTotal)}</td>
        </tr>`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>PreIntake Email Campaign Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333;">
    <h1 style="color: #0a1628; border-bottom: 3px solid #c9a962; padding-bottom: 10px;">
        PreIntake Email Campaign Report
    </h1>
    <p style="color: #666; font-size: 14px;">Report Date: ${reportDate}</p>

    <h2 style="color: #0a1628; margin-top: 30px;">Summary Totals</h2>
    <table style="border-collapse: collapse; width: 100%; margin-bottom: 30px; background: #f8f9fa; border-radius: 8px;">
        <tr>
            <td style="padding: 15px; width: 25%;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Total Contacts</div>
                <div style="font-size: 28px; font-weight: bold; color: #0a1628;">${formatNumber(totals.totalContacts)}</div>
            </td>
            <td style="padding: 15px; width: 25%;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Added Today</div>
                <div style="font-size: 28px; font-weight: bold; color: #2e7d32;">${formatNumber(totals.addedToday)}</div>
            </td>
            <td style="padding: 15px; width: 25%;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Total Sent</div>
                <div style="font-size: 28px; font-weight: bold; color: #1565c0;">${formatNumber(totals.totalSent)}</div>
            </td>
            <td style="padding: 15px; width: 25%;">
                <div style="font-size: 12px; color: #666; text-transform: uppercase;">Sent Today</div>
                <div style="font-size: 28px; font-weight: bold; color: #7b1fa2;">${formatNumber(totals.sentToday)}</div>
            </td>
        </tr>
    </table>

    <h2 style="color: #0a1628;">By State</h2>
    <div style="overflow-x: auto;">
        <table style="border-collapse: collapse; width: 100%; font-size: 13px;">
            <thead>
                <tr style="background: #0a1628; color: white;">
                    <th style="padding: 10px 12px; text-align: left;" rowspan="2">State</th>
                    <th style="padding: 10px 12px; text-align: center; border-left: 1px solid #333;" colspan="2">Contacts w/ Website</th>
                    <th style="padding: 10px 12px; text-align: center; border-left: 1px solid #333;" colspan="2">Contacts w/o Website</th>
                    <th style="padding: 10px 12px; text-align: center; border-left: 1px solid #333;" colspan="2">Sent w/ Website</th>
                    <th style="padding: 10px 12px; text-align: center; border-left: 1px solid #333;" colspan="2">Sent w/o Website</th>
                </tr>
                <tr style="background: #1a3a5c; color: white;">
                    <th style="padding: 8px 12px; text-align: center; border-left: 1px solid #333;">Today</th>
                    <th style="padding: 8px 12px; text-align: center;">Total</th>
                    <th style="padding: 8px 12px; text-align: center; border-left: 1px solid #333;">Today</th>
                    <th style="padding: 8px 12px; text-align: center;">Total</th>
                    <th style="padding: 8px 12px; text-align: center; border-left: 1px solid #333;">Today</th>
                    <th style="padding: 8px 12px; text-align: center;">Total</th>
                    <th style="padding: 8px 12px; text-align: center; border-left: 1px solid #333;">Today</th>
                    <th style="padding: 8px 12px; text-align: center;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${stateRows}
            </tbody>
            <tfoot>
                <tr style="background: #f0f0f0; font-weight: bold;">
                    <td style="padding: 10px 12px; border-top: 2px solid #0a1628;">TOTAL</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withWebsite.addedToday)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withWebsite.total)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withoutWebsite.addedToday)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withoutWebsite.total)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withWebsite.sentToday)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withWebsite.sentTotal)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withoutWebsite.sentToday)}</td>
                    <td style="padding: 10px 12px; text-align: center; border-top: 2px solid #0a1628;">${formatNumber(totals.withoutWebsite.sentTotal)}</td>
                </tr>
            </tfoot>
        </table>
    </div>

    <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
        Generated by PreIntake.ai Campaign Analytics
    </p>
</body>
</html>`;
}

/**
 * Send email report
 */
async function sendReport(htmlContent, reportDate) {
    if (!smtpUser || !smtpPass) {
        console.log('SMTP credentials not configured, skipping email');
        console.log('\n--- Report Preview ---');
        console.log('Would send to:', RECIPIENT_EMAIL);
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
    });

    try {
        await transporter.sendMail({
            from: 'PreIntake Analytics <stephen@preintake.ai>',
            to: RECIPIENT_EMAIL,
            subject: `PreIntake Email Campaign Report - ${reportDate}`,
            html: htmlContent
        });
        console.log(`Report sent to ${RECIPIENT_EMAIL}`);
        return true;
    } catch (error) {
        console.error('Failed to send report:', error.message);
        return false;
    }
}

/**
 * Main analysis function
 */
async function analyzeAndReport() {
    console.log('Fetching preintake_emails collection...');

    const snapshot = await db.collection('preintake_emails').get();
    console.log(`Total documents: ${snapshot.size}`);

    // Initialize stats structure
    const stateStats = {};
    const totals = {
        totalContacts: 0,
        addedToday: 0,
        totalSent: 0,
        sentToday: 0,
        withWebsite: { addedToday: 0, total: 0, sentToday: 0, sentTotal: 0 },
        withoutWebsite: { addedToday: 0, total: 0, sentToday: 0, sentTotal: 0 }
    };

    snapshot.forEach(doc => {
        const data = doc.data();
        const state = data.state || 'Unknown';
        const hasWebsite = !!data.website;
        const isSent = data.sent === true;

        // Check if added today
        let addedToday = false;
        if (data.createdAt) {
            const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            addedToday = isToday(createdDate);
        }

        // Check if sent today
        let sentToday = false;
        if (isSent && data.sentTimestamp) {
            const sentDate = data.sentTimestamp.toDate ? data.sentTimestamp.toDate() : new Date(data.sentTimestamp);
            sentToday = isToday(sentDate);
        }

        // Initialize state if not exists
        if (!stateStats[state]) {
            stateStats[state] = {
                withWebsite: { addedToday: 0, total: 0, sentToday: 0, sentTotal: 0 },
                withoutWebsite: { addedToday: 0, total: 0, sentToday: 0, sentTotal: 0 }
            };
        }

        // Update stats
        const bucket = hasWebsite ? 'withWebsite' : 'withoutWebsite';

        stateStats[state][bucket].total++;
        totals[bucket].total++;
        totals.totalContacts++;

        if (addedToday) {
            stateStats[state][bucket].addedToday++;
            totals[bucket].addedToday++;
            totals.addedToday++;
        }

        if (isSent) {
            stateStats[state][bucket].sentTotal++;
            totals[bucket].sentTotal++;
            totals.totalSent++;

            if (sentToday) {
                stateStats[state][bucket].sentToday++;
                totals[bucket].sentToday++;
                totals.sentToday++;
            }
        }
    });

    // Generate report
    const reportDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles'
    });

    console.log('\n=== Summary ===');
    console.log(`Total Contacts: ${totals.totalContacts}`);
    console.log(`Added Today: ${totals.addedToday}`);
    console.log(`Total Sent: ${totals.totalSent}`);
    console.log(`Sent Today: ${totals.sentToday}`);
    console.log(`States: ${Object.keys(stateStats).length}`);

    const htmlReport = generateHtmlReport(stateStats, totals, reportDate);
    await sendReport(htmlReport, reportDate);
}

// Run
analyzeAndReport()
    .then(() => {
        console.log('\nReport complete');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
