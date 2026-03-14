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
const bcrypt = require('bcrypt');

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

            // Find account by email (check both email and deliveryEmail fields)
            let accountDoc = null;
            let accountId = null;

            // First try deliveryEmail (the active delivery address)
            const deliverySnapshot = await db.collection('preintake_accounts')
                .where('deliveryEmail', '==', normalizedEmail)
                .limit(1)
                .get();

            if (!deliverySnapshot.empty) {
                accountDoc = deliverySnapshot.docs[0];
                accountId = accountDoc.id;
            } else {
                // Try the original signup email
                const emailSnapshot = await db.collection('preintake_accounts')
                    .where('email', '==', normalizedEmail)
                    .limit(1)
                    .get();

                if (!emailSnapshot.empty) {
                    accountDoc = emailSnapshot.docs[0];
                    accountId = emailSnapshot.docs[0].id;
                }
            }

            if (!accountDoc) {
                console.log(`No active account found for: ${normalizedEmail}`);
                return res.status(404).json({
                    error: 'The email you entered is not associated with an active account. If you have requested a demo, please check your email for instructions to activate your subscription.'
                });
            }

            const accountData = accountDoc.data();
            const firmName = accountData.firmName || accountData.analysis?.firmName || accountData.firmDisplayName || 'Your Firm';

            // Generate secure token
            const token = crypto.randomBytes(32).toString('hex');
            const now = Date.now();
            const expiresAt = new Date(now + TOKEN_TTL_MS);

            // Store token
            await db.collection('account_tokens').doc(token).set({
                token,
                accountId,
                leadId: accountId, // backward compatibility
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

            console.log(`Magic link sent to ${normalizedEmail} for account ${accountId}`);

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
            const isSessionToken = tokenData.type === 'session';

            // Check if already used (only for magic link tokens, not session tokens)
            if (!isSessionToken && tokenData.used) {
                return res.status(401).json({ error: 'This link has already been used. Please request a new one.' });
            }

            // Check expiry
            const now = new Date();
            const expiresAt = tokenData.expiresAt?.toDate ? tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);

            if (now > expiresAt) {
                return res.status(401).json({ error: 'This link has expired. Please request a new one.' });
            }

            // Mark token as used (only for magic link tokens, session tokens remain reusable)
            if (!isSessionToken) {
                await tokenDoc.ref.update({
                    used: true,
                    usedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // Get account data (support both accountId and legacy leadId)
            const accountId = tokenData.accountId || tokenData.leadId;
            const accountDoc = await db.collection('preintake_accounts').doc(accountId).get();

            if (!accountDoc.exists) {
                return res.status(404).json({ error: 'Account not found' });
            }

            const accountData = accountDoc.data();

            // Update last portal access
            await accountDoc.ref.update({
                lastPortalAccessAt: admin.firestore.FieldValue.serverTimestamp(),
                portalAccessCount: admin.firestore.FieldValue.increment(1)
            });

            // Resolve firstName/lastName (some accounts store name as full string)
            let firstName = accountData.firstName || '';
            let lastName = accountData.lastName || '';
            if (!firstName && accountData.name) {
                const parts = accountData.name.trim().split(' ');
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
            }

            // Return account data
            return res.json({
                success: true,
                account: {
                    firmId: accountId,
                    firmName: accountData.firmName || accountData.analysis?.firmName || accountData.firmDisplayName || 'Your Firm',
                    firstName,
                    lastName,
                    deliveryEmail: accountData.deliveryEmail || accountData.email,
                    subscriptionStatus: accountData.subscriptionStatus || 'active', // preintake_accounts only has active subscribers
                    currentPeriodEnd: accountData.currentPeriodEnd,
                    primaryPracticeArea: accountData.primaryPracticeArea || null,
                    additionalPracticeAreas: accountData.additionalPracticeAreas || [],
                    practiceAreas: accountData.confirmedPracticeAreas?.areas
                        || (Array.isArray(accountData.practiceAreas) ? accountData.practiceAreas : null)
                        || accountData.analysis?.practiceAreas
                        || [],
                    logo: accountData.analysis?.logo || null,
                    primaryColor: accountData.analysis?.primaryColor || '#0c1f3f',
                    intakeCode: accountData.intakeCode || null,
                    hostedIntakeUrl: accountData.hostedIntakeUrl || null
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
 * POST { token, deliveryEmail?, practiceAreas?, primaryPracticeArea?, additionalPracticeAreas?, firstName?, lastName? }
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
            const { token, deliveryEmail, practiceAreas, primaryPracticeArea, additionalPracticeAreas, firstName, lastName } = req.body;

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

            // Validate practiceAreas if provided (legacy support)
            if (practiceAreas !== undefined) {
                if (!Array.isArray(practiceAreas)) {
                    return res.status(400).json({ error: 'Practice areas must be an array' });
                }
            }

            // Validate primaryPracticeArea if provided
            if (primaryPracticeArea !== undefined) {
                if (typeof primaryPracticeArea !== 'string' || !primaryPracticeArea.trim()) {
                    return res.status(400).json({ error: 'Primary practice area must be a non-empty string' });
                }
            }

            // Validate additionalPracticeAreas if provided
            if (additionalPracticeAreas !== undefined) {
                if (!Array.isArray(additionalPracticeAreas)) {
                    return res.status(400).json({ error: 'Additional practice areas must be an array' });
                }
            }

            // Update lead document
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (deliveryEmail !== undefined) {
                updateData.deliveryEmail = deliveryEmail.toLowerCase().trim();
            }

            if (practiceAreas !== undefined) {
                updateData['confirmedPracticeAreas.areas'] = practiceAreas;
                // Trigger demo regeneration so the intake page reflects the new practice areas
                updateData.status = 'generating_demo';
                updateData.regeneratingDemo = true;
            }

            // Handle new primary + additional practice area structure
            let practiceAreasChanged = false;
            if (primaryPracticeArea !== undefined) {
                updateData.primaryPracticeArea = primaryPracticeArea.trim();
                practiceAreasChanged = true;
            }

            if (additionalPracticeAreas !== undefined) {
                updateData.additionalPracticeAreas = additionalPracticeAreas;
                practiceAreasChanged = true;
            }

            // Also update confirmedPracticeAreas.areas for backward compatibility
            if (practiceAreasChanged && primaryPracticeArea !== undefined) {
                const allAreas = [primaryPracticeArea.trim()];
                if (additionalPracticeAreas && additionalPracticeAreas.length > 0) {
                    allAreas.push(...additionalPracticeAreas);
                }
                updateData['confirmedPracticeAreas.areas'] = allAreas;
                // Trigger demo regeneration so the intake page reflects the new practice areas
                updateData.status = 'generating_demo';
                updateData.regeneratingDemo = true;
            }

            if (firstName !== undefined) {
                updateData.firstName = firstName.trim();
            }

            if (lastName !== undefined) {
                updateData.lastName = lastName.trim();
            }

            // Support both accountId and legacy leadId
            const accountId = tokenData.accountId || tokenData.leadId;
            await db.collection('preintake_accounts').doc(accountId).update(updateData);

            // Get updated data
            const updatedDoc = await db.collection('preintake_accounts').doc(accountId).get();
            const updatedData = updatedDoc.data();

            console.log(`Account settings updated for ${accountId}`);

            // Resolve names from updated data
            let resolvedFirstName = updatedData.firstName || '';
            let resolvedLastName = updatedData.lastName || '';
            if (!resolvedFirstName && updatedData.name) {
                const parts = updatedData.name.trim().split(' ');
                resolvedFirstName = parts[0] || '';
                resolvedLastName = parts.slice(1).join(' ') || '';
            }

            return res.json({
                success: true,
                regeneratingDemo: practiceAreas !== undefined || practiceAreasChanged,
                account: {
                    firmId: accountId,
                    firmName: updatedData.firmName || updatedData.analysis?.firmName || updatedData.firmDisplayName || 'Your Firm',
                    firstName: resolvedFirstName,
                    lastName: resolvedLastName,
                    deliveryEmail: updatedData.deliveryEmail || updatedData.email,
                    subscriptionStatus: updatedData.subscriptionStatus || 'active',
                    primaryPracticeArea: updatedData.primaryPracticeArea || null,
                    additionalPracticeAreas: updatedData.additionalPracticeAreas || [],
                    practiceAreas: updatedData.confirmedPracticeAreas?.areas
                        || (Array.isArray(updatedData.practiceAreas) ? updatedData.practiceAreas : null)
                        || updatedData.analysis?.practiceAreas
                        || []
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

            // Get account document for Stripe customer ID
            const accountId = tokenData.accountId || tokenData.leadId;
            const accountDoc = await db.collection('preintake_accounts').doc(accountId).get();

            if (!accountDoc.exists) {
                return res.status(404).json({ error: 'Account not found' });
            }

            const accountData = accountDoc.data();
            const stripeCustomerId = accountData.stripeCustomerId;

            if (!stripeCustomerId) {
                return res.status(400).json({ error: 'Billing not set up for this account. Please contact support.' });
            }

            // Create Stripe billing portal session
            const stripe = require('stripe')(stripeSecretKey.value());

            const session = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `https://preintake.ai/account.html?token=${token}`,
            });

            console.log(`Billing portal session created for ${accountId}`);

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

/**
 * Login with email and password
 * POST { email, password }
 * Returns session token valid for 7 days
 */
const loginWithPassword = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ success: false, error: 'Email and password are required' });
            }

            const normalizedEmail = email.toLowerCase().trim();

            // Find user by email in preintake_accounts (active subscribers)
            let userDoc = null;
            let accountId = null;

            // First try deliveryEmail
            const deliverySnapshot = await db.collection('preintake_accounts')
                .where('deliveryEmail', '==', normalizedEmail)
                .limit(1)
                .get();

            if (!deliverySnapshot.empty) {
                userDoc = deliverySnapshot.docs[0];
                accountId = userDoc.id;
            } else {
                // Try the original signup email
                const emailSnapshot = await db.collection('preintake_accounts')
                    .where('email', '==', normalizedEmail)
                    .limit(1)
                    .get();

                if (!emailSnapshot.empty) {
                    userDoc = emailSnapshot.docs[0];
                    accountId = userDoc.id;
                }
            }

            if (!userDoc) {
                // Generic error to prevent email enumeration
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }

            const userData = userDoc.data();

            // Check if user has a password set
            if (!userData.passwordHash) {
                return res.status(401).json({
                    success: false,
                    error: 'No password set for this account. Please use the magic link option.'
                });
            }

            // Verify password
            const validPassword = await bcrypt.compare(password, userData.passwordHash);

            if (!validPassword) {
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }

            // Generate session token (7 days validity)
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
            const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

            // Store session token
            await db.collection('account_tokens').doc(sessionToken).set({
                token: sessionToken,
                accountId: accountId,
                leadId: accountId, // Keep for backward compatibility
                email: normalizedEmail,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt,
                used: false,
                usedAt: null,
                type: 'session' // Distinguish from magic link tokens
            });

            console.log(`Password login successful for ${normalizedEmail} (${accountId})`);

            return res.json({
                success: true,
                sessionToken,
                firmName: userData.firmName || ''
            });

        } catch (error) {
            console.error('loginWithPassword error:', error);
            return res.status(500).json({ success: false, error: 'An error occurred. Please try again.' });
        }
    }
);

module.exports = {
    sendAccountAccessLink,
    verifyAccountToken,
    updateAccountSettings,
    createBillingPortalSession,
    loginWithPassword,
};
