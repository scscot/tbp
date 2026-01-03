#!/usr/bin/env node
/**
 * Send Lead Generation Notification Email
 *
 * Reads the summary from build-preintake-leads.py and sends an email
 * to stephen@preintake.ai with the results.
 *
 * Environment Variables:
 *   PREINTAKE_SMTP_USER - SMTP username (scott@legal.preintake.ai)
 *   PREINTAKE_SMTP_PASS - SMTP password
 *
 * Usage:
 *   node scripts/send-lead-gen-notification.js
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Configuration
const SUMMARY_FILE = path.join(__dirname, 'lead-gen-summary.json');
const RECIPIENT = 'Stephen Scott <stephen@preintake.ai>';
const FROM_ADDRESS = 'PreIntake Lead Gen <scott@legal.preintake.ai>';
const SMTP_HOST = 'smtp.dreamhost.com';
const SMTP_PORT = 587;

// SMTP credentials from environment
const SMTP_USER = process.env.PREINTAKE_SMTP_USER;
const SMTP_PASS = process.env.PREINTAKE_SMTP_PASS;

/**
 * Format date for email
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

/**
 * Generate email HTML content
 */
function generateEmailHTML(summary) {
    const statusIcon = summary.blocked ? '⚠️' : '✅';
    const statusText = summary.blocked
        ? `BLOCKED: ${summary.block_reason}`
        : 'All systems operational';

    // Practice areas breakdown
    let practiceAreasHTML = '';
    if (Object.keys(summary.practice_areas).length > 0) {
        const sortedAreas = Object.entries(summary.practice_areas)
            .sort((a, b) => b[1] - a[1]);
        practiceAreasHTML = sortedAreas
            .map(([area, count]) => `<li>${area}: ${count}</li>`)
            .join('\n');
    } else {
        practiceAreasHTML = '<li>No new firms scraped</li>';
    }

    // New firms list (first 10)
    let firmsListHTML = '';
    if (summary.new_firms_list && summary.new_firms_list.length > 0) {
        const firms = summary.new_firms_list.slice(0, 10);
        firmsListHTML = firms.map(f =>
            `<tr>
                <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${f.firm}</td>
                <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${f.area}</td>
            </tr>`
        ).join('\n');

        if (summary.new_firms_list.length > 10) {
            firmsListHTML += `<tr><td colspan="2" style="padding: 4px 8px; color: #666;">... and ${summary.new_firms_list.length - 10} more</td></tr>`;
        }
    }

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">
            PreIntake.ai Lead Generation Report
        </h1>
    </div>

    <div style="background: #ffffff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
            ${formatDate(summary.run_date)}
        </p>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Summary</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">New firms scraped:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${summary.scrape.new_firms}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Emails extracted:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${summary.extract.success}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Email extraction failed:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.extract.failed}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Skipped (recent attempt):</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.extract.skipped}</td>
            </tr>
        </table>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Practice Areas</h2>
        <ul style="margin: 0 0 20px 0; padding-left: 20px;">
            ${practiceAreasHTML}
        </ul>

        ${firmsListHTML ? `
        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">New Firms Added</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr style="background: #f1f5f9;">
                <th style="padding: 8px; text-align: left;">Firm</th>
                <th style="padding: 8px; text-align: left;">Practice Area</th>
            </tr>
            ${firmsListHTML}
        </table>
        ` : ''}

        <div style="background: ${summary.blocked ? '#fef2f2' : '#f0fdf4'}; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; font-weight: 600; color: ${summary.blocked ? '#991b1b' : '#166534'};">
                ${statusIcon} Status: ${statusText}
            </p>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </div>
</body>
</html>`;
}

/**
 * Generate plain text version
 */
function generatePlainText(summary) {
    const statusText = summary.blocked
        ? `BLOCKED: ${summary.block_reason}`
        : 'All systems operational';

    let text = `PreIntake.ai Lead Generation Report
${formatDate(summary.run_date)}

SUMMARY
-------
New firms scraped: ${summary.scrape.new_firms}
Emails extracted: ${summary.extract.success}
Email extraction failed: ${summary.extract.failed}
Skipped (recent attempt): ${summary.extract.skipped}

PRACTICE AREAS
--------------
`;

    for (const [area, count] of Object.entries(summary.practice_areas).sort((a, b) => b[1] - a[1])) {
        text += `${area}: ${count}\n`;
    }

    if (summary.new_firms_list && summary.new_firms_list.length > 0) {
        text += `\nNEW FIRMS ADDED\n---------------\n`;
        for (const firm of summary.new_firms_list.slice(0, 10)) {
            text += `- ${firm.firm} (${firm.area})\n`;
        }
        if (summary.new_firms_list.length > 10) {
            text += `... and ${summary.new_firms_list.length - 10} more\n`;
        }
    }

    text += `\nSTATUS: ${statusText}\n`;

    return text;
}

/**
 * Main function
 */
async function main() {
    console.log('📧 PreIntake.ai Lead Generation Notification');
    console.log('=============================================\n');

    // Check credentials
    if (!SMTP_USER || !SMTP_PASS) {
        console.error('❌ Missing SMTP credentials');
        console.error('   Set PREINTAKE_SMTP_USER and PREINTAKE_SMTP_PASS');
        process.exit(1);
    }

    // Read summary file
    if (!fs.existsSync(SUMMARY_FILE)) {
        console.error(`❌ Summary file not found: ${SUMMARY_FILE}`);
        console.error('   Run build-preintake-leads.py first');
        process.exit(1);
    }

    const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
    console.log(`📂 Loaded summary from ${SUMMARY_FILE}`);
    console.log(`   New firms: ${summary.scrape.new_firms}`);
    console.log(`   Emails extracted: ${summary.extract.success}`);
    console.log(`   Blocked: ${summary.blocked}`);

    // Create transporter
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

    // Verify connection
    try {
        await transporter.verify();
        console.log('\n✅ SMTP connection verified');
    } catch (error) {
        console.error('❌ SMTP connection failed:', error.message);
        process.exit(1);
    }

    // Build subject line
    let subject = 'New Law Firms Added';
    if (summary.blocked) {
        subject = '⚠️ Lead Generation BLOCKED - Action Required';
    } else if (summary.scrape.new_firms === 0) {
        subject = 'Lead Generation Report - No New Firms';
    } else {
        subject = `New Law Firms Added: ${summary.scrape.new_firms} firms, ${summary.extract.success} emails`;
    }

    // Send email
    const mailOptions = {
        from: FROM_ADDRESS,
        to: RECIPIENT,
        subject: subject,
        text: generatePlainText(summary),
        html: generateEmailHTML(summary)
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`\n✅ Email sent to ${RECIPIENT}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Message ID: ${result.messageId}`);
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        process.exit(1);
    }

    console.log('\n✅ Notification complete');
}

// Run
main().catch(error => {
    console.error('❌ Notification failed:', error);
    process.exit(1);
});
