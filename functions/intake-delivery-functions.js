/**
 * PreIntake.ai - Intake Delivery Functions
 * Handles delivery of completed intake data to law firms
 *
 * Key Principle: NO DATA RETENTION
 * All intake data is immediately delivered and then discarded.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database
const db = getFirestore('preintake');

// SMTP secrets (same as preintake-functions.js)
const smtpUser = defineSecret("PREINTAKE_SMTP_USER");
const smtpPass = defineSecret("PREINTAKE_SMTP_PASS");

const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const NOTIFY_EMAIL = 'stephen@preintake.ai';

/**
 * Handle completed intake submissions from demo pages
 * This is the webhook endpoint that demo-intake.html posts to
 */
const handleIntakeCompletion = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [smtpUser, smtpPass],
        timeoutSeconds: 60
    },
    async (req, res) => {
        // Only accept POST requests
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const payload = req.body;

            // Extract leadId from source (format: "preintake-demo-{leadId}")
            const leadId = payload.source?.replace('preintake-demo-', '') || null;

            if (!leadId) {
                console.error('No leadId in payload source:', payload.source);
                return res.status(400).json({ error: 'Invalid source identifier' });
            }

            console.log(`Processing intake completion for lead: ${leadId}`);

            // === DEDUPLICATION CHECK ===
            // Prevent duplicate emails if user submits multiple times
            const email = payload.lead?.email?.toLowerCase()?.trim() || '';
            const phone = payload.lead?.phone?.replace(/\D/g, '') || '';

            if (email || phone) {
                const dedupKey = `${leadId}_${email}_${phone}`;
                const dedupRef = db.collection('intake_dedup').doc(dedupKey);
                const dedupDoc = await dedupRef.get();

                if (dedupDoc.exists) {
                    console.log(`Duplicate submission detected for ${dedupKey}, skipping email`);
                    return res.status(200).json({
                        success: true,
                        duplicate: true,
                        message: 'Intake already submitted'
                    });
                }

                // Mark as submitted (do this before sending to prevent race conditions)
                await dedupRef.set({
                    leadId,
                    email,
                    phone,
                    submittedAt: FieldValue.serverTimestamp()
                });
            }
            // === END DEDUPLICATION CHECK ===

            // Get lead document to find delivery config
            const leadDoc = await db.collection('preintake_leads').doc(leadId).get();

            if (!leadDoc.exists) {
                console.error(`Inquiry not found: ${leadId}`);
                return res.status(404).json({ error: 'Inquiry not found' });
            }

            const leadData = leadDoc.data();
            const deliveryConfig = leadData.deliveryConfig || {
                method: 'email',
                emailAddress: leadData.email
            };

            // Create SMTP transporter
            const transporter = nodemailer.createTransport({
                host: 'smtp.dreamhost.com',
                port: 587,
                secure: false,
                requireTLS: true,
                auth: {
                    user: smtpUser.value(),
                    pass: smtpPass.value()
                },
                tls: { rejectUnauthorized: false }
            });

            // Deliver based on configured method
            let deliveryResult = { success: false };

            switch (deliveryConfig.method) {
                case 'email':
                    deliveryResult = await deliverViaEmail(transporter, payload, deliveryConfig, leadData);
                    break;
                case 'webhook':
                    deliveryResult = await deliverViaWebhook(payload, deliveryConfig);
                    break;
                case 'crm':
                    // Future: CRM-specific delivery
                    deliveryResult = await deliverViaCRM(payload, deliveryConfig);
                    break;
                default:
                    // Default to email
                    deliveryResult = await deliverViaEmail(transporter, payload, deliveryConfig, leadData);
            }

            // Log delivery (metadata only - NO intake data stored)
            await logDelivery(leadId, deliveryConfig.method, deliveryResult.success);

            // Also notify Stephen of completed intake
            await notifyIntakeComplete(transporter, payload, leadData, deliveryResult);

            // Send conversion email if first intake and delivery was successful
            if (deliveryResult.success) {
                await sendConversionEmail(transporter, leadId, leadData);
            }

            return res.status(200).json({
                success: true,
                deliveryMethod: deliveryConfig.method,
                delivered: deliveryResult.success
            });

        } catch (error) {
            console.error('Intake completion error:', error);
            return res.status(500).json({ error: 'Delivery failed', message: error.message });
        }
    }
);

/**
 * Deliver intake data via email to the law firm
 */
async function deliverViaEmail(transporter, payload, config, leadData) {
    try {
        const firmName = leadData.analysis?.firmName || 'Your Firm';
        const htmlSummary = generateIntakeSummary(payload, firmName);

        const leadName = payload.lead?.name || 'New Inquiry';
        const caseType = payload.case_info?.case_type || 'Legal Matter';
        const routing = payload.routing || 'unknown';

        // Determine subject based on qualification
        let subjectPrefix = '';
        if (routing === 'green') {
            subjectPrefix = '[QUALIFIED] ';
        } else if (routing === 'yellow') {
            subjectPrefix = '[REVIEW] ';
        } else if (routing === 'red') {
            subjectPrefix = '[NOT QUALIFIED] ';
        }

        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: config.emailAddress,
            subject: `${subjectPrefix}New Inquiry: ${leadName} - ${caseType}`,
            html: htmlSummary
        });

        console.log(`Email delivered to ${config.emailAddress} for lead ${leadName}`);
        return { success: true };

    } catch (error) {
        console.error('Email delivery failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deliver intake data via webhook to firm's custom URL
 */
async function deliverViaWebhook(payload, config) {
    if (!config.webhookUrl) {
        console.error('No webhook URL configured');
        return { success: false, error: 'No webhook URL' };
    }

    try {
        const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': config.webhookKey || '',
                'X-Source': 'preintake.ai'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}`);
        }

        console.log(`Webhook delivered to ${config.webhookUrl}`);
        return { success: true };

    } catch (error) {
        console.error('Webhook delivery failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deliver intake data via CRM integration
 * Future: Add specific CRM adapters (Law Ruler, Filevine, Captorra, etc.)
 */
async function deliverViaCRM(payload, config) {
    // For now, fall back to webhook if URL is provided
    if (config.webhookUrl) {
        return await deliverViaWebhook(payload, config);
    }

    console.log(`CRM delivery not yet implemented for: ${config.crmType}`);
    return { success: false, error: 'CRM integration not yet available' };
}

/**
 * Log delivery attempt (metadata only - NO intake data)
 */
async function logDelivery(leadId, method, success) {
    try {
        await db.collection('preintake_leads').doc(leadId).update({
            'intakeDelivery': {
                deliveredAt: FieldValue.serverTimestamp(),
                method: method,
                success: success
            }
        });
    } catch (error) {
        console.error('Failed to log delivery:', error);
    }
}

/**
 * Notify Stephen of completed intake (for monitoring)
 */
async function notifyIntakeComplete(transporter, payload, leadData, deliveryResult) {
    try {
        const firmName = leadData.analysis?.firmName || 'Unknown Firm';
        const leadName = payload.lead?.name || 'Unknown';
        const routing = payload.routing || 'unknown';

        const routingEmoji = routing === 'green' ? '🟢' : routing === 'yellow' ? '🟡' : '🔴';

        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: NOTIFY_EMAIL,
            subject: `${routingEmoji} Intake Complete: ${firmName} - ${leadName}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0c1f3f;">Intake Completed</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Firm:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${firmName}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Inquiry:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${payload.lead?.name || 'N/A'} (${payload.lead?.email || 'N/A'})</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Case Type:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${payload.case_info?.case_type || 'N/A'}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Routing:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${routingEmoji} ${routing.toUpperCase()}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Delivery:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${deliveryResult.success ? '✅ Delivered' : '❌ Failed'} via ${leadData.deliveryConfig?.method || 'email'}</td>
        </tr>
    </table>

    <p style="color: #64748b; font-size: 12px;">
        Lead delivered to: ${leadData.deliveryConfig?.emailAddress || leadData.email}<br>
        Timestamp: ${new Date().toISOString()}
    </p>
</body>
</html>`
        });
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
}

/**
 * Send conversion email after first demo intake
 * Encourages demo user to activate their account
 */
async function sendConversionEmail(transporter, leadId, leadData) {
    // Skip if already sent or if firm is already active (paid)
    if (leadData.conversionEmailSent || leadData.status === 'active') {
        return;
    }

    const firmName = leadData.analysis?.firmName || 'Your Firm';
    const toEmail = leadData.email;
    const firstName = leadData.name?.split(' ')[0] || '';
    const accountUrl = `https://preintake.ai/create-account.html?firm=${leadId}`;

    try {
        await transporter.sendMail({
            from: 'PreIntake.ai <support@preintake.ai>',
            to: toEmail,
            subject: `Your PreIntake.ai Demo Just Captured an Inquiry`,
            html: generateConversionEmailHtml(firmName, firstName, accountUrl)
        });

        // Mark as sent
        await db.collection('preintake_leads').doc(leadId).update({
            conversionEmailSent: true,
            conversionEmailSentAt: FieldValue.serverTimestamp()
        });

        console.log(`Conversion email sent to ${toEmail} for lead ${leadId}`);
    } catch (error) {
        console.error('Failed to send conversion email:', error);
    }
}

/**
 * Generate HTML for conversion email
 */
function generateConversionEmailHtml(firmName, firstName, accountUrl) {
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: white; border-radius: 12px; padding: 35px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-family: Georgia, serif; color: #0c1f3f; font-size: 24px; margin: 0;">
                Pre<span style="color: #c9a962;">Intake</span>.ai
            </h1>
        </div>

        <!-- Body -->
        <p style="margin: 0 0 20px 0;">${greeting}</p>

        <p style="margin: 0 0 20px 0;">
            Great news — your PreIntake.ai demo just captured its first inquiry for <strong>${firmName}</strong>.
        </p>

        <p style="margin: 0 0 20px 0;">
            You should have received an email with the full intake details, including the AI screening summary and qualification status.
        </p>

        <p style="margin: 0 0 25px 0;">
            <strong>Ready to go live?</strong> Activate your account to add AI-powered intake to your website. The same intelligent screening you just experienced will work 24/7 on your site, qualifying inquiries while you focus on your cases.
        </p>

        <!-- CTA Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${accountUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #e5d4a1 50%, #c9a962 100%); color: #0c1f3f; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(201, 169, 98, 0.4);">
                Activate Your Account
            </a>
        </div>

        <!-- What's Included -->
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #0c1f3f;">What's included:</p>
            <ul style="margin: 0; padding-left: 20px; color: #475569;">
                <li style="margin-bottom: 8px;">AI intake customized to your practice areas</li>
                <li style="margin-bottom: 8px;">Embeddable widget for your website</li>
                <li style="margin-bottom: 8px;">24/7 inquiry qualification and screening</li>
                <li style="margin-bottom: 8px;">Email or webhook delivery to your CRM</li>
                <li>Cancel anytime — no long-term contracts</li>
            </ul>
        </div>

        <p style="margin: 25px 0 0 0; color: #64748b; font-size: 14px;">
            Questions? Just reply to this email and I'll be happy to help.
        </p>

        <p style="margin: 20px 0 0 0;">
            Best,<br>
            <strong>Support Team</strong><br>
            <span style="color: #64748b;">PreIntake.ai</span>
        </p>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 25px; margin-top: 25px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
            <a href="https://preintake.ai" style="color: #64748b; text-decoration: none;">PreIntake.ai</a> — AI-Powered Legal Intake
        </div>

    </div>
</body>
</html>`;
}

/**
 * Generate HTML summary of intake for email delivery
 */
function generateIntakeSummary(payload, firmName) {
    const routing = payload.routing || 'unknown';
    const routingColor = routing === 'green' ? '#22c55e' : routing === 'yellow' ? '#eab308' : '#ef4444';
    const routingLabel = routing === 'green' ? 'QUALIFIED' : routing === 'yellow' ? 'NEEDS REVIEW' : 'NOT QUALIFIED';

    const keyFactors = payload.key_factors || [];
    const positiveFactors = keyFactors.filter(f => f.impact === 'positive');
    const negativeFactors = keyFactors.filter(f => f.impact === 'negative');

    // SOL status formatting
    const solStatus = payload.sol_status;
    const solNote = solStatus?.note || 'N/A';
    const solIsExpired = solStatus?.status === 'expired';
    const solColor = solIsExpired ? '#ef4444' : '#1a1a2e';

    // Format transcript for HTML display
    const transcriptHtml = payload.transcript
        ? payload.transcript
            .split('\n\n')
            .map(line => {
                if (line.startsWith('Visitor:')) {
                    return `<div style="margin-bottom: 12px;"><span style="color: #0c1f3f; font-weight: 600;">Visitor:</span> ${escapeHtml(line.replace('Visitor: ', ''))}</div>`;
                } else if (line.startsWith('Assistant:')) {
                    return `<div style="margin-bottom: 12px;"><span style="color: #c9a962; font-weight: 600;">Assistant:</span> ${escapeHtml(line.replace('Assistant: ', ''))}</div>`;
                }
                return `<div style="margin-bottom: 12px;">${escapeHtml(line)}</div>`;
            })
            .join('')
        : '<p style="color: #64748b; font-style: italic;">Transcript not available</p>';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
            <h1 style="color: #0c1f3f; font-size: 22px; margin: 0 0 10px 0;">New Intake Submission</h1>
            <p style="color: #64748b; margin: 0;">via PreIntake.ai</p>
        </div>

        <!-- Qualification Badge -->
        <div style="text-align: center; margin-bottom: 25px;">
            <span style="display: inline-block; background: ${routingColor}; color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                ${routingLabel}
            </span>
            <p style="color: #64748b; font-size: 13px; margin-top: 8px;">
                Confidence: ${payload.confidence_level || 'N/A'} |
                Recommended: ${formatRecommendation(payload.recommended_next_action)}
            </p>
        </div>

        <!-- Contact Information -->
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #0c1f3f; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">Contact Information</h3>
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 5px 0; color: #64748b; width: 100px;">Name:</td>
                    <td style="padding: 5px 0; font-weight: 500;">${payload.lead?.name || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Phone:</td>
                    <td style="padding: 5px 0; font-weight: 500;"><a href="tel:${payload.lead?.phone}" style="color: #0c1f3f;">${payload.lead?.phone || 'N/A'}</a></td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Email:</td>
                    <td style="padding: 5px 0; font-weight: 500;"><a href="mailto:${payload.lead?.email}" style="color: #0c1f3f;">${payload.lead?.email || 'N/A'}</a></td>
                </tr>
            </table>
        </div>

        <!-- Screening Summary -->
        ${payload.ai_screening_summary ? `
        <div style="background: #f8fafc; border-left: 4px solid #c9a962; padding: 15px 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <h3 style="color: #c9a962; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Screening Summary</h3>
            <p style="margin: 0; color: #1a1a2e; font-size: 15px; line-height: 1.7;">${payload.ai_screening_summary}</p>
        </div>
        ` : ''}

        <!-- Case Information -->
        <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #0c1f3f; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">Case Information</h3>
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 5px 0; color: #64748b; width: 120px;">Case Type:</td>
                    <td style="padding: 5px 0; font-weight: 500;">${payload.case_info?.case_type || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Date Occurred:</td>
                    <td style="padding: 5px 0;">${payload.case_info?.date_occurred || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Location:</td>
                    <td style="padding: 5px 0;">${payload.case_info?.location || 'N/A'}</td>
                </tr>
                ${solStatus && solNote !== 'N/A' ? `
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">SOL Status:</td>
                    <td style="padding: 5px 0; font-weight: 500; color: ${solColor};">${solNote}</td>
                </tr>
                ` : ''}
                ${payload.injuries ? `
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Injuries:</td>
                    <td style="padding: 5px 0;">${payload.injuries}</td>
                </tr>
                ` : ''}
                ${payload.treatment_status ? `
                <tr>
                    <td style="padding: 5px 0; color: #64748b;">Treatment:</td>
                    <td style="padding: 5px 0;">${payload.treatment_status}</td>
                </tr>
                ` : ''}
            </table>
            ${payload.case_info?.description ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 5px 0;">Description:</p>
                <p style="margin: 0;">${payload.case_info.description}</p>
            </div>
            ` : ''}
        </div>

        <!-- Key Factors -->
        ${keyFactors.length > 0 ? `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #0c1f3f; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">Key Factors</h3>
            ${positiveFactors.length > 0 ? `
            <div style="margin-bottom: 10px;">
                ${positiveFactors.map(f => `<span style="display: inline-block; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-size: 13px; margin: 2px 4px 2px 0;">✓ ${f.factor}</span>`).join('')}
            </div>
            ` : ''}
            ${negativeFactors.length > 0 ? `
            <div>
                ${negativeFactors.map(f => `<span style="display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 4px; font-size: 13px; margin: 2px 4px 2px 0;">✗ ${f.factor}</span>`).join('')}
            </div>
            ` : ''}
        </div>
        ` : ''}

        <!-- Primary Factors -->
        ${(payload.primary_strength_factor || payload.primary_disqualifier) ? `
        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            ${payload.primary_strength_factor ? `<p style="margin: 0 0 8px 0;"><strong style="color: #166534;">Strength:</strong> ${payload.primary_strength_factor}</p>` : ''}
            ${payload.primary_disqualifier ? `<p style="margin: 0;"><strong style="color: #991b1b;">Concern:</strong> ${payload.primary_disqualifier}</p>` : ''}
        </div>
        ` : ''}

        <!-- Additional Comments from Client -->
        ${payload.additional_comments ? `
        <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
            <h3 style="color: #0ea5e9; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Additional Comments from Client</h3>
            <p style="margin: 0; color: #1a1a2e; font-size: 15px; line-height: 1.7;">${escapeHtml(payload.additional_comments)}</p>
        </div>
        ` : ''}

        <!-- Full Conversation Transcript -->
        <div style="margin-bottom: 20px;">
            <h3 style="color: #0c1f3f; font-size: 14px; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">Full Conversation Transcript</h3>
            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; font-size: 14px; line-height: 1.6; border: 1px solid #e2e8f0;">
                ${transcriptHtml}
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
            <p style="margin: 0;">Intake completed: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT</p>
            <p style="margin: 5px 0 0 0;">Powered by <a href="https://preintake.ai" style="color: #0c1f3f;">PreIntake.ai</a></p>
        </div>

    </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Format recommendation action for display
 */
function formatRecommendation(action) {
    const labels = {
        'schedule_consult': 'Schedule Consultation',
        'request_documents': 'Request Documents',
        'decline_with_resources': 'Provide Resources',
        'refer_to_specialist': 'Refer to Specialist'
    };
    return labels[action] || action || 'N/A';
}

module.exports = {
    handleIntakeCompletion
};
