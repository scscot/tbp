#!/usr/bin/env node
/**
 * Send Lead Generation Notification Email
 *
 * Reads the summary from build-preintake-leads.py and sends an email
 * to stephen@preintake.ai with the results.
 *
 * Environment Variables:
 *   PREINTAKE_SMTP_USER - SMTP username (stephen@preintake.ai)
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
const FROM_ADDRESS = 'Stephen Scott <stephen@preintake.ai>';
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
    const successRate = summary.extract.success + summary.extract.failed > 0
        ? Math.round((summary.extract.success / (summary.extract.success + summary.extract.failed)) * 100)
        : 0;

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">
            PreIntake.ai Email Extraction Report
        </h1>
    </div>

    <div style="background: #ffffff; padding: 25px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 20px 0;">
            ${formatDate(summary.run_date)}
        </p>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Email Extraction Results</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Emails extracted this run:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #166534;">${summary.extract.success}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Failed extractions:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.extract.failed}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Skipped (recently attempted):</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${summary.extract.skipped}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Success rate:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${successRate}%</td>
            </tr>
        </table>

        <h2 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Directory Totals</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Total firms in directory:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${summary.total_firms.toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Firms with emails:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #166534;">${summary.firms_with_emails.toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Failed extractions:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${(summary.total_failed || 0).toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Pending extraction:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${(summary.total_firms - summary.firms_with_emails - (summary.total_failed || 0)).toLocaleString()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">Total success rate:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${((summary.firms_with_emails + (summary.total_failed || 0)) > 0 ? Math.round((summary.firms_with_emails / (summary.firms_with_emails + (summary.total_failed || 0))) * 100) : 0)}%</td>
            </tr>
        </table>

        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; font-weight: 600; color: #166534;">
                ✅ Pipeline completed successfully
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
    const successRate = summary.extract.success + summary.extract.failed > 0
        ? Math.round((summary.extract.success / (summary.extract.success + summary.extract.failed)) * 100)
        : 0;

    return `PreIntake.ai Email Extraction Report
${formatDate(summary.run_date)}

EMAIL EXTRACTION RESULTS
------------------------
Emails extracted this run: ${summary.extract.success}
Failed extractions: ${summary.extract.failed}
Skipped (recently attempted): ${summary.extract.skipped}
Success rate: ${successRate}%

DIRECTORY TOTALS
----------------
Total firms in directory: ${summary.total_firms.toLocaleString()}
Firms with emails: ${summary.firms_with_emails.toLocaleString()}
Failed extractions: ${(summary.total_failed || 0).toLocaleString()}
Pending extraction: ${(summary.total_firms - summary.firms_with_emails - (summary.total_failed || 0)).toLocaleString()}
Total success rate: ${((summary.firms_with_emails + (summary.total_failed || 0)) > 0 ? Math.round((summary.firms_with_emails / (summary.firms_with_emails + (summary.total_failed || 0))) * 100) : 0)}%

STATUS: Pipeline completed successfully
`;
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
    console.log(`   Total firms: ${summary.total_firms}`);
    console.log(`   Emails extracted: ${summary.extract.success}`);
    console.log(`   Firms with emails: ${summary.firms_with_emails}`);

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
    let subject;
    if (summary.extract.success > 0) {
        subject = `Email Extraction: ${summary.extract.success} new emails (${summary.firms_with_emails} total)`;
    } else {
        subject = `Email Extraction Report - No new emails`;
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
