/**
 * PreIntake.ai Functions
 * Handles demo form submissions and lead capture
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database (separate from default TBP database)
const db = getFirestore('preintake');

// SMTP configuration for Dreamhost
const smtpUser = defineSecret("PREINTAKE_SMTP_USER");
const smtpPass = defineSecret("PREINTAKE_SMTP_PASS");
const smtpHost = defineString("PREINTAKE_SMTP_HOST", { default: "mail.preintake.ai" });
const smtpPort = defineString("PREINTAKE_SMTP_PORT", { default: "587" });

const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const NOTIFY_EMAIL = 'stephen@preintake.ai';

/**
 * Send email via SMTP (Dreamhost)
 */
async function sendEmail(transporter, to, subject, htmlContent) {
    const mailOptions = {
        from: FROM_ADDRESS,
        to: to,
        subject: subject,
        html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
}

/**
 * Generate confirmation email HTML for prospect
 */
function generateProspectEmail(name, website) {
    const firstName = name.split(' ')[0];
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0c1f3f; font-size: 24px; margin-bottom: 10px;">PreIntake.ai</h1>
    </div>

    <p>Hi ${firstName},</p>

    <p>Thanks for your interest in PreIntake.ai! We've received your demo request for <strong>${website}</strong>.</p>

    <p>Here's what happens next:</p>

    <ol style="color: #64748b;">
        <li><strong>We analyze your website</strong> - Practice areas, branding, current intake methods</li>
        <li><strong>We build your custom demo</strong> - A working intake page with your branding</li>
        <li><strong>You receive your demo link</strong> - Usually within 24 hours</li>
    </ol>

    <p>In the meantime, if you have any questions or want to schedule a quick call, just reply to this email.</p>

    <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Stephen Scott</strong><br>
        <span style="color: #64748b;">PreIntake.ai</span>
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        PreIntake.ai - AI-Powered Legal Intake<br>
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </p>
</body>
</html>
`;
}

// Practice area display names
const PRACTICE_AREA_NAMES = {
    personal_injury: 'Personal Injury',
    immigration: 'Immigration',
    family_law: 'Family Law',
    bankruptcy: 'Bankruptcy',
    criminal_defense: 'Criminal Defense',
    tax: 'Tax / IRS',
    estate_planning: 'Estate Planning',
    employment: 'Employment Law',
    workers_comp: 'Workers\' Compensation',
    real_estate: 'Real Estate',
    other: 'Other'
};

/**
 * Format practice areas for email display
 */
function formatPracticeAreasForEmail(practiceAreas) {
    if (!practiceAreas || !practiceAreas.breakdown) {
        return '<em>Not specified</em>';
    }

    const breakdown = practiceAreas.breakdown;
    const otherName = practiceAreas.otherName || null;
    const sorted = Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1]) // Sort by percentage descending
        .map(([area, pct]) => {
            // Use custom name for "other" if provided
            let name;
            if (area === 'other' && otherName) {
                name = otherName;
            } else {
                name = PRACTICE_AREA_NAMES[area] || area;
            }
            const isPrimary = area === practiceAreas.primaryArea;
            return `<li>${name}: <strong>${pct}%</strong>${isPrimary ? ' ★' : ''}</li>`;
        });

    return `<ul style="margin: 0; padding-left: 20px;">${sorted.join('')}</ul>`;
}

/**
 * Generate notification email HTML for Stephen
 */
function generateNotifyEmail(name, email, website, leadId, practiceAreas) {
    const practiceAreasHtml = formatPracticeAreasForEmail(practiceAreas);
    const primaryArea = practiceAreas?.primaryAreaName || 'Not specified';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0c1f3f;">New PreIntake.ai Demo Request</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${name}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Website:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${website}" target="_blank">${website}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Primary Area:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #c9a962;">${primaryArea}</strong></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; vertical-align: top;">Practice Mix:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${practiceAreasHtml}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Lead ID:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${leadId}</td>
        </tr>
    </table>

    <p style="margin-top: 20px;">
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/data/~2Fpreintake_leads~2F${leadId}"
           style="background: #c9a962; color: #0c1f3f; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Firestore
        </a>
    </p>
</body>
</html>
`;
}

/**
 * Submit Demo Request
 * Accepts POST with name, email, website URL
 * Stores lead in Firestore preintake_leads collection
 * Sends confirmation email to prospect and notification to Stephen
 */
const submitDemoRequest = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [smtpUser, smtpPass]
    },
    async (req, res) => {
        // Only allow POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { name, email, website, practiceAreas } = req.body;

            // Validate required fields
            if (!name || !email || !website) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['name', 'email', 'website']
                });
            }

            // Validate practice areas if provided
            if (practiceAreas && practiceAreas.breakdown) {
                const total = Object.values(practiceAreas.breakdown).reduce((sum, val) => sum + val, 0);
                if (total !== 100) {
                    return res.status(400).json({
                        error: 'Practice area percentages must total 100%',
                        currentTotal: total
                    });
                }
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Invalid email format' });
            }

            // Validate website URL
            let websiteUrl;
            try {
                // Add https if not present
                const urlToValidate = website.startsWith('http') ? website : `https://${website}`;
                websiteUrl = new URL(urlToValidate);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid website URL' });
            }

            // Create lead document
            const leadData = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                website: websiteUrl.href,
                status: 'pending', // pending, analyzing, researching, generating_demo, demo_ready
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'landing_page',
                // Self-reported practice areas from form
                practiceAreas: practiceAreas || null,
                // Will be populated by analysis function later
                analysis: null,
                deepResearch: null,
                demoUrl: null,
                // Email tracking
                confirmationSent: false,
                notificationSent: false
            };

            // Store in Firestore
            const docRef = await db.collection('preintake_leads').add(leadData);
            const leadId = docRef.id;

            console.log(`PreIntake lead created: ${leadId} - ${email}`);

            // Create SMTP transporter
            const user = smtpUser.value();
            const pass = smtpPass.value();

            if (!user || !pass) {
                console.error('SMTP credentials not configured');
            } else {
                const transporter = nodemailer.createTransport({
                    host: smtpHost.value(),
                    port: parseInt(smtpPort.value()),
                    secure: false,
                    requireTLS: true, // Force STARTTLS upgrade
                    auth: {
                        user: user,
                        pass: pass
                    },
                    tls: {
                        rejectUnauthorized: false // Allow self-signed certs
                    }
                });

                // Send confirmation email to prospect
                try {
                    const prospectHtml = generateProspectEmail(name.trim(), websiteUrl.href);
                    await sendEmail(
                        transporter,
                        `${name.trim()} <${email.trim().toLowerCase()}>`,
                        'Your PreIntake.ai Demo Request',
                        prospectHtml
                    );
                    await docRef.update({ confirmationSent: true });
                    console.log(`Confirmation email sent to ${email}`);
                } catch (emailErr) {
                    console.error('Error sending confirmation email:', emailErr.message);
                }

                // Send notification email to Stephen
                try {
                    const notifyHtml = generateNotifyEmail(
                        name.trim(),
                        email.trim().toLowerCase(),
                        websiteUrl.href,
                        leadId,
                        practiceAreas
                    );
                    const primaryAreaLabel = practiceAreas?.primaryAreaName ? ` (${practiceAreas.primaryAreaName})` : '';
                    await sendEmail(
                        transporter,
                        NOTIFY_EMAIL,
                        `New PreIntake Lead: ${name.trim()} - ${websiteUrl.hostname}${primaryAreaLabel}`,
                        notifyHtml
                    );
                    await docRef.update({ notificationSent: true });
                    console.log(`Notification email sent to ${NOTIFY_EMAIL}`);
                } catch (emailErr) {
                    console.error('Error sending notification email:', emailErr.message);
                }
            }

            // Return success with lead ID
            return res.status(200).json({
                success: true,
                message: 'Demo request received',
                leadId: leadId
            });

        } catch (error) {
            console.error('Error submitting demo request:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
);

module.exports = {
    submitDemoRequest
};
