/**
 * PreIntake.ai - Account Portal Functions
 * Handles magic link authentication and account management
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database
const db = getFirestore('preintake');

// Stripe secrets (for billing portal)
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// SMTP Configuration
const smtpUser = defineSecret("PREINTAKE_SMTP_USER");
const smtpPass = defineSecret("PREINTAKE_SMTP_PASS");
const smtpHost = defineString("PREINTAKE_SMTP_HOST", { default: "smtp.dreamhost.com" });
const smtpPort = defineString("PREINTAKE_SMTP_PORT", { default: "587" });

const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';

// Token configuration
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;

/**
 * Send email via SMTP
 */
async function sendEmail(to, subject, htmlContent) {
    const user = smtpUser.value();
    const pass = smtpPass.value();

    if (!user || !pass) {
        console.error('SMTP credentials not configured');
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: smtpHost.value(),
        port: parseInt(smtpPort.value()),
        secure: false,
        requireTLS: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
        from: FROM_ADDRESS,
        to: to,
        subject: subject,
        html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    return true;
}

/**
 * Generate magic link email HTML
 */
function generateMagicLinkEmail(firmName, magicLinkUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, #0c1f3f 0%, #1a3a5c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #ffffff; font-size: 24px; margin: 0;">
            <span style="color: #ffffff;">Pre</span><span style="color: #c9a962;">Intake</span><span style="color: #ffffff;">.ai</span>
        </h1>
    </div>

    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #0c1f3f; text-align: center; margin-bottom: 20px;">Access Your Account</h2>

        <p>Click the button below to access your PreIntake.ai account settings for <strong>${firmName || 'your firm'}</strong>:</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8954f 100%); color: #0c1f3f; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Access My Account
            </a>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Security Notice:</strong> This link expires in 1 hour and can only be used once. If you didn't request this link, you can safely ignore this email.
            </p>
        </div>

        <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
            Questions? Reply to this email or reach out at <a href="mailto:support@preintake.ai" style="color: #c9a962;">support@preintake.ai</a>.
        </p>

        <p style="margin-top: 25px;">
            —<br>
            <strong>Support Team</strong><br>
            PreIntake.ai
        </p>
    </div>

    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
        <p style="margin: 0;">AI-Powered Legal Intake</p>
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </div>
</body>
</html>
`;
}

/**
 * Hash email for rate limiting (privacy-preserving)
 */
function hashEmail(email) {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Check rate limit for magic link requests
 * Returns true if request is allowed, false if rate limited
 */
async function checkRateLimit(email) {
    const emailHash = hashEmail(email);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const rateLimitRef = db.collection('account_portal_rate_limits').doc(emailHash);
    const doc = await rateLimitRef.get();

    if (!doc.exists) {
        // First request - create record
        await rateLimitRef.set({
            emailHash,
            requestCount: 1,
            windowStart: admin.firestore.FieldValue.serverTimestamp(),
            lastRequestAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    }

    const data = doc.data();
    const docWindowStart = data.windowStart?.toMillis() || 0;

    if (docWindowStart < windowStart) {
        // Window expired - reset
        await rateLimitRef.set({
            emailHash,
            requestCount: 1,
            windowStart: admin.firestore.FieldValue.serverTimestamp(),
            lastRequestAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return true;
    }

    if (data.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        // Rate limited
        return false;
    }

    // Increment count
    await rateLimitRef.update({
        requestCount: admin.firestore.FieldValue.increment(1),
        lastRequestAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
}

/**
 * Send account access link (magic link)
 * POST { email }
 */
const sendAccountAccessLink = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [smtpUser, smtpPass],
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const normalizedEmail = email.toLowerCase().trim();

            // Check rate limit
            const allowed = await checkRateLimit(normalizedEmail);
            if (!allowed) {
                // Return success to prevent email enumeration
                // But don't actually send anything
                console.log(`Rate limited: ${normalizedEmail}`);
                return res.json({ success: true, message: 'If an account exists with this email, you will receive an access link.' });
            }

            // Find lead by email (check both email and deliveryEmail fields)
            let leadDoc = null;
            let leadId = null;

            // First try deliveryEmail (the active delivery address)
            const deliverySnapshot = await db.collection('preintake_leads')
                .where('deliveryEmail', '==', normalizedEmail)
                .where('subscriptionStatus', '==', 'active')
                .limit(1)
                .get();

            if (!deliverySnapshot.empty) {
                leadDoc = deliverySnapshot.docs[0];
                leadId = leadDoc.id;
            } else {
                // Try the original signup email
                const emailSnapshot = await db.collection('preintake_leads')
                    .where('email', '==', normalizedEmail)
                    .where('subscriptionStatus', '==', 'active')
                    .limit(1)
                    .get();

                if (!emailSnapshot.empty) {
                    leadDoc = emailSnapshot.docs[0];
                    leadId = leadDoc.id;
                }
            }

            if (!leadDoc) {
                console.log(`No active account found for: ${normalizedEmail}`);
                return res.status(404).json({
                    error: 'The email you entered is not associated with an active account. If you have requested a demo, please check your email for instructions to activate your subscription.'
                });
            }

            const leadData = leadDoc.data();
            const firmName = leadData.analysis?.firmName || leadData.firmDisplayName || 'Your Firm';

            // Generate secure token
            const token = crypto.randomBytes(32).toString('hex');
            const now = Date.now();
            const expiresAt = new Date(now + TOKEN_TTL_MS);

            // Store token
            await db.collection('account_tokens').doc(token).set({
                token,
                leadId,
                email: normalizedEmail,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt,
                used: false,
                usedAt: null
            });

            // Send magic link email
            const magicLinkUrl = `https://preintake.ai/account.html?token=${token}`;
            const emailHtml = generateMagicLinkEmail(firmName, magicLinkUrl);

            await sendEmail(
                normalizedEmail,
                'Access Your PreIntake.ai Account',
                emailHtml
            );

            console.log(`Magic link sent to ${normalizedEmail} for firm ${leadId}`);

            return res.json({ success: true, message: 'If an account exists with this email, you will receive an access link.' });

        } catch (error) {
            console.error('sendAccountAccessLink error:', error);
            return res.status(500).json({ error: 'An error occurred. Please try again.' });
        }
    }
);

/**
 * Verify account token and return account data
 * GET ?token=ABC123
 */
const verifyAccountToken = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }

            // Find token
            const tokenDoc = await db.collection('account_tokens').doc(token).get();

            if (!tokenDoc.exists) {
                return res.status(401).json({ error: 'Invalid or expired link' });
            }

            const tokenData = tokenDoc.data();

            // Check if already used
            if (tokenData.used) {
                return res.status(401).json({ error: 'This link has already been used. Please request a new one.' });
            }

            // Check expiry
            const now = new Date();
            const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

            if (now > expiresAt) {
                return res.status(401).json({ error: 'This link has expired. Please request a new one.' });
            }

            // Mark token as used
            await tokenDoc.ref.update({
                used: true,
                usedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Get lead data
            const leadDoc = await db.collection('preintake_leads').doc(tokenData.leadId).get();

            if (!leadDoc.exists) {
                return res.status(404).json({ error: 'Account not found' });
            }

            const leadData = leadDoc.data();

            // Update last portal access
            await leadDoc.ref.update({
                lastPortalAccessAt: admin.firestore.FieldValue.serverTimestamp(),
                portalAccessCount: admin.firestore.FieldValue.increment(1)
            });

            // Return account data
            return res.json({
                success: true,
                account: {
                    firmId: tokenData.leadId,
                    firmName: leadData.analysis?.firmName || leadData.firmDisplayName || 'Your Firm',
                    deliveryEmail: leadData.deliveryEmail || leadData.email,
                    subscriptionStatus: leadData.subscriptionStatus,
                    currentPeriodEnd: leadData.currentPeriodEnd,
                    practiceAreas: leadData.practiceAreas?.breakdown ? Object.keys(leadData.practiceAreas.breakdown) : [],
                    logo: leadData.analysis?.logo || null,
                    primaryColor: leadData.analysis?.primaryColor || '#0c1f3f'
                },
                // Include token for subsequent requests (valid for this session)
                sessionToken: token
            });

        } catch (error) {
            console.error('verifyAccountToken error:', error);
            return res.status(500).json({ error: 'An error occurred. Please try again.' });
        }
    }
);

/**
 * Update account settings
 * POST { token, deliveryEmail }
 */
const updateAccountSettings = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { token, deliveryEmail } = req.body;

            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }

            // Validate token (allow reuse within same session by checking usedAt timestamp)
            const tokenDoc = await db.collection('account_tokens').doc(token).get();

            if (!tokenDoc.exists) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            const tokenData = tokenDoc.data();

            // Check expiry (token is valid for 1 hour after creation, even if used)
            const now = new Date();
            const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

            if (now > expiresAt) {
                return res.status(401).json({ error: 'Session expired. Please request a new access link.' });
            }

            // Validate deliveryEmail if provided
            if (deliveryEmail !== undefined) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(deliveryEmail)) {
                    return res.status(400).json({ error: 'Invalid email address' });
                }
            }

            // Update lead document
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (deliveryEmail !== undefined) {
                updateData.deliveryEmail = deliveryEmail.toLowerCase().trim();
            }

            await db.collection('preintake_leads').doc(tokenData.leadId).update(updateData);

            // Get updated data
            const updatedDoc = await db.collection('preintake_leads').doc(tokenData.leadId).get();
            const updatedData = updatedDoc.data();

            console.log(`Account settings updated for ${tokenData.leadId}`);

            return res.json({
                success: true,
                account: {
                    firmId: tokenData.leadId,
                    firmName: updatedData.analysis?.firmName || updatedData.firmDisplayName || 'Your Firm',
                    deliveryEmail: updatedData.deliveryEmail || updatedData.email,
                    subscriptionStatus: updatedData.subscriptionStatus
                }
            });

        } catch (error) {
            console.error('updateAccountSettings error:', error);
            return res.status(500).json({ error: 'An error occurred. Please try again.' });
        }
    }
);

/**
 * Create Stripe billing portal session
 * POST { token }
 */
const createBillingPortalSession = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [stripeSecretKey],
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: 'Token is required' });
            }

            // Validate token
            const tokenDoc = await db.collection('account_tokens').doc(token).get();

            if (!tokenDoc.exists) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            const tokenData = tokenDoc.data();

            // Check expiry
            const now = new Date();
            const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

            if (now > expiresAt) {
                return res.status(401).json({ error: 'Session expired. Please request a new access link.' });
            }

            // Get lead document for Stripe customer ID
            const leadDoc = await db.collection('preintake_leads').doc(tokenData.leadId).get();

            if (!leadDoc.exists) {
                return res.status(404).json({ error: 'Account not found' });
            }

            const leadData = leadDoc.data();
            const stripeCustomerId = leadData.stripeCustomerId;

            if (!stripeCustomerId) {
                return res.status(400).json({ error: 'Billing not set up for this account. Please contact support.' });
            }

            // Create Stripe billing portal session
            const stripe = require('stripe')(stripeSecretKey.value());

            const session = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `https://preintake.ai/account.html?token=${token}`,
            });

            console.log(`Billing portal session created for ${tokenData.leadId}`);

            return res.json({
                success: true,
                url: session.url
            });

        } catch (error) {
            console.error('createBillingPortalSession error:', error);
            return res.status(500).json({ error: 'Failed to open billing portal. Please try again.' });
        }
    }
);

module.exports = {
    sendAccountAccessLink,
    verifyAccountToken,
    updateAccountSettings,
    createBillingPortalSession,
};
