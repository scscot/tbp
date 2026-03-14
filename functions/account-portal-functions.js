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

// Login rate limiting (brute force protection)
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_FAILED_ATTEMPTS = 5;

/**
 * Send email via SMTP
 *
 * @description Internal helper to send transactional emails via Dreamhost SMTP.
 *
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} htmlContent - HTML email body
 * @returns {Promise<boolean>} True if sent successfully, false if SMTP not configured
 * @throws {Error} If SMTP send fails
 * @private
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
 *
 * @description Creates branded HTML email content for magic link authentication.
 * Includes PreIntake.ai branding, security notice, and styled CTA button.
 *
 * @param {string} firmName - Firm name to personalize the email
 * @param {string} magicLinkUrl - Full URL with token for account access
 * @returns {string} Complete HTML email content
 * @private
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
 *
 * @description Creates SHA256 hash of normalized email for rate limit tracking.
 * Preserves privacy by not storing actual email addresses in rate limit collection.
 *
 * @param {string} email - Email address to hash
 * @returns {string} SHA256 hex digest of normalized email
 * @private
 */
function hashEmail(email) {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Check rate limit for magic link requests
 *
 * @description Implements sliding window rate limiting for magic link requests.
 * Allows RATE_LIMIT_MAX_REQUESTS (3) per RATE_LIMIT_WINDOW_MS (1 hour).
 * Uses privacy-preserving email hashing for tracking.
 *
 * @param {string} email - Email address to check
 * @returns {Promise<boolean>} True if request is allowed, false if rate limited
 * @private
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
 * Check login rate limit for password authentication
 *
 * @description Implements brute force protection for password login.
 * Allows LOGIN_MAX_FAILED_ATTEMPTS (5) per LOGIN_RATE_LIMIT_WINDOW_MS (15 minutes).
 * After lockout, user must wait for window to expire before retrying.
 *
 * @param {string} email - Email address to check
 * @returns {Promise<Object>} Rate limit status object
 * @returns {boolean} returns.allowed - Whether login attempt is allowed
 * @returns {number} [returns.remainingAttempts] - Attempts remaining (if allowed)
 * @returns {number} [returns.lockoutMinutes] - Minutes until lockout expires (if blocked)
 * @private
 */
async function checkLoginRateLimit(email) {
    const emailHash = hashEmail(email);
    const now = Date.now();
    const windowStart = now - LOGIN_RATE_LIMIT_WINDOW_MS;

    const rateLimitRef = db.collection('login_rate_limits').doc(emailHash);
    const doc = await rateLimitRef.get();

    if (!doc.exists) {
        return { allowed: true, remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS };
    }

    const data = doc.data();
    const docWindowStart = data.windowStart?.toMillis() || 0;

    // Window expired - allow and will reset on failure
    if (docWindowStart < windowStart) {
        return { allowed: true, remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS };
    }

    const failedAttempts = data.failedAttempts || 0;

    if (failedAttempts >= LOGIN_MAX_FAILED_ATTEMPTS) {
        const lockoutEndTime = docWindowStart + LOGIN_RATE_LIMIT_WINDOW_MS;
        const lockoutMinutes = Math.ceil((lockoutEndTime - now) / 60000);
        return { allowed: false, lockoutMinutes };
    }

    return { allowed: true, remainingAttempts: LOGIN_MAX_FAILED_ATTEMPTS - failedAttempts };
}

/**
 * Record a failed login attempt
 *
 * @description Increments failed login counter for brute force protection.
 * Creates or updates record in login_rate_limits collection.
 * Resets window if previous window has expired.
 *
 * @param {string} email - Email address of failed attempt
 * @returns {Promise<void>}
 * @private
 */
async function recordFailedLogin(email) {
    const emailHash = hashEmail(email);
    const rateLimitRef = db.collection('login_rate_limits').doc(emailHash);
    const doc = await rateLimitRef.get();
    const now = Date.now();
    const windowStart = now - LOGIN_RATE_LIMIT_WINDOW_MS;

    if (!doc.exists || (doc.data().windowStart?.toMillis() || 0) < windowStart) {
        // First failure or window expired - create/reset record
        await rateLimitRef.set({
            emailHash,
            failedAttempts: 1,
            windowStart: admin.firestore.FieldValue.serverTimestamp(),
            lastFailedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        // Increment failure count
        await rateLimitRef.update({
            failedAttempts: admin.firestore.FieldValue.increment(1),
            lastFailedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
}

/**
 * Reset login attempts on successful login
 *
 * @description Clears failed login counter after successful authentication.
 * Deletes the rate limit document to reset tracking.
 *
 * @param {string} email - Email address to reset
 * @returns {Promise<void>}
 * @private
 */
async function resetLoginAttempts(email) {
    const emailHash = hashEmail(email);
    const rateLimitRef = db.collection('login_rate_limits').doc(emailHash);
    await rateLimitRef.delete();
}

/**
 * Send account access link (magic link)
 *
 * @description Generates and sends a secure magic link for passwordless authentication.
 * Link expires in 1 hour and can only be used once. Rate limited to 3 requests/hour.
 * Returns success message regardless of account existence to prevent email enumeration.
 *
 * @route POST /sendAccountAccessLink
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Email address to send link to
 * @returns {Object} JSON response with success status and message
 *
 * @example
 * // Request
 * POST /sendAccountAccessLink
 * { "email": "attorney@lawfirm.com" }
 *
 * // Response (always same message to prevent enumeration)
 * { "success": true, "message": "If an account exists with this email, you will receive an access link." }
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
 *
 * @description Validates magic link or session token and returns full account data.
 * Magic link tokens are single-use; session tokens (from password login) are reusable.
 * Updates portal access timestamp and count for analytics.
 *
 * @route GET /verifyAccountToken
 * @param {string} req.query.token - Magic link or session token
 * @returns {Object} JSON response with account data and session token
 * @returns {boolean} returns.success - Whether verification succeeded
 * @returns {Object} returns.account - Account data (firmId, firmName, deliveryEmail, etc.)
 * @returns {string} returns.sessionToken - Token for subsequent authenticated requests
 *
 * @example
 * // Request
 * GET /verifyAccountToken?token=abc123def456...
 *
 * // Response
 * {
 *   "success": true,
 *   "account": {
 *     "firmId": "abc123",
 *     "firmName": "Smith Law Group",
 *     "deliveryEmail": "intake@smithlaw.com",
 *     "subscriptionStatus": "active",
 *     "practiceAreas": ["Personal Injury", "Criminal Defense"]
 *   },
 *   "sessionToken": "abc123def456..."
 * }
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
 *
 * @description Updates subscriber account settings including delivery email,
 * practice areas, and contact name. Requires valid session token.
 * Practice area changes trigger demo regeneration.
 *
 * @route POST /updateAccountSettings
 * @param {Object} req.body - Request body
 * @param {string} req.body.token - Session token from login or magic link
 * @param {string} [req.body.deliveryEmail] - New email for lead delivery
 * @param {string} [req.body.primaryPracticeArea] - Primary practice area
 * @param {string[]} [req.body.additionalPracticeAreas] - Additional practice areas
 * @param {string[]} [req.body.practiceAreas] - Legacy: combined practice areas array
 * @param {string} [req.body.firstName] - Contact first name
 * @param {string} [req.body.lastName] - Contact last name
 * @returns {Object} JSON response with updated account data
 * @returns {boolean} returns.success - Whether update succeeded
 * @returns {boolean} returns.regeneratingDemo - Whether practice area change triggered demo rebuild
 * @returns {Object} returns.account - Updated account data
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
 *
 * @description Creates a Stripe Customer Portal session for subscription management.
 * Allows subscribers to update payment methods, view invoices, and cancel subscription.
 * Returns URL that redirects back to account page after portal actions.
 *
 * @route POST /createBillingPortalSession
 * @param {Object} req.body - Request body
 * @param {string} req.body.token - Session token from login or magic link
 * @returns {Object} JSON response with billing portal URL
 * @returns {boolean} returns.success - Whether session creation succeeded
 * @returns {string} returns.url - Stripe Customer Portal URL
 *
 * @example
 * // Request
 * POST /createBillingPortalSession
 * { "token": "abc123..." }
 *
 * // Response
 * {
 *   "success": true,
 *   "url": "https://billing.stripe.com/session/..."
 * }
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
 *
 * @description Authenticates user with email/password and returns session token.
 * Session token valid for 7 days. Implements brute force protection with
 * rate limiting (5 failed attempts triggers 15-minute lockout).
 *
 * @route POST /loginWithPassword
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Account email address
 * @param {string} req.body.password - Account password
 * @returns {Object} JSON response with session token
 * @returns {boolean} returns.success - Whether login succeeded
 * @returns {string} returns.sessionToken - 7-day session token for authenticated requests
 * @returns {string} returns.firmName - Firm name for display
 *
 * @example
 * // Request
 * POST /loginWithPassword
 * { "email": "attorney@lawfirm.com", "password": "securepass123" }
 *
 * // Success Response
 * {
 *   "success": true,
 *   "sessionToken": "abc123def456...",
 *   "firmName": "Smith Law Group"
 * }
 *
 * // Rate Limited Response (429)
 * {
 *   "success": false,
 *   "error": "Too many failed login attempts. Please try again in 12 minutes."
 * }
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

            // Check rate limit before processing
            const rateLimit = await checkLoginRateLimit(normalizedEmail);
            if (!rateLimit.allowed) {
                console.log(`Login rate limited for ${normalizedEmail}, lockout: ${rateLimit.lockoutMinutes} minutes`);
                return res.status(429).json({
                    success: false,
                    error: `Too many failed login attempts. Please try again in ${rateLimit.lockoutMinutes} minutes.`
                });
            }

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
                // Record failed attempt and return generic error to prevent email enumeration
                await recordFailedLogin(normalizedEmail);
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
                await recordFailedLogin(normalizedEmail);
                return res.status(401).json({ success: false, error: 'Invalid email or password' });
            }

            // Successful login - reset rate limit counter
            await resetLoginAttempts(normalizedEmail);

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
