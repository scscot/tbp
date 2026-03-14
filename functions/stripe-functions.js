/**
 * PreIntake.ai - Stripe Functions
 * Handles payment processing for account creation
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database
const db = getFirestore('preintake');

// Stripe secrets
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// SMTP Configuration (same as preintake-functions.js)
const smtpUser = defineSecret("PREINTAKE_SMTP_USER");
const smtpPass = defineSecret("PREINTAKE_SMTP_PASS");
const smtpHost = defineString("PREINTAKE_SMTP_HOST", { default: "smtp.dreamhost.com" });
const smtpPort = defineString("PREINTAKE_SMTP_PORT", { default: "587" });

const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const NOTIFY_EMAIL = 'stephen@preintake.ai';

// Stripe configuration
// LIVE MODE price IDs
const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SmPbhJBdoLMDposfgTFIJSA'; // $99/month subscription
// TEST MODE price IDs (for testing with 4242 4242 4242 4242)
// const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SjNpAJaJO3EHqOSHh4DbhNM';
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SjNi9JBdoLMDposKpLCGI1NRg0cDPmKwRhDQfZ1kkiVlGxFyYi6OBUyLhfFkIpgFlrX2kJR8kR6uS4Wy7VGXVQR00M7hdJJkG';

/**
 * Create a Stripe Checkout session for subscription
 *
 * @description Creates a Stripe Checkout session for new subscriber sign-up.
 * Handles customer creation/lookup, password hashing, and session generation.
 *
 * @route POST /createCheckoutSession
 * @param {Object} req.body - Request body
 * @param {string} req.body.firmId - Unique identifier for the law firm (lead document ID)
 * @param {string} req.body.email - Customer email address
 * @param {string} req.body.firmName - Name of the law firm
 * @param {string} req.body.password - Password (min 8 characters, will be hashed with bcrypt)
 * @returns {Object} JSON response with sessionId and publishableKey, or error
 * @throws {400} Missing firmId, email, or invalid password
 * @throws {500} Stripe API error
 */
const createCheckoutSession = onRequest(
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
            const { firmId, email, firmName, password } = req.body;

            if (!firmId) {
                return res.status(400).json({ error: 'Missing firmId' });
            }

            if (!email) {
                return res.status(400).json({ error: 'Missing email' });
            }

            if (!password || password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters' });
            }

            // Hash the password
            const passwordHash = await bcrypt.hash(password, 10);

            // Initialize Stripe with secret key
            const stripe = require('stripe')(stripeSecretKey.value());

            // Check if customer already exists
            const existingCustomers = await stripe.customers.list({
                email: email,
                limit: 1,
            });

            let customerId;
            if (existingCustomers.data.length > 0) {
                customerId = existingCustomers.data[0].id;
            } else {
                // Create new customer
                const customer = await stripe.customers.create({
                    email: email,
                    metadata: {
                        firmId: firmId,
                        firmName: firmName || '',
                    },
                });
                customerId = customer.id;
            }

            // Create checkout session with subscription only (no setup fee)
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        // Monthly subscription
                        price: STRIPE_SUBSCRIPTION_PRICE_ID,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                allow_promotion_codes: true,
                billing_address_collection: 'required', // Collect full billing info for receipts
                success_url: `https://preintake.ai/payment-success.html?session_id={CHECKOUT_SESSION_ID}&firm=${firmId}`,
                cancel_url: `https://preintake.ai/create-account.html?firm=${firmId}&cancelled=true`,
                metadata: {
                    firmId: firmId,
                    firmName: firmName || '',
                    passwordHash: passwordHash,
                },
                subscription_data: {
                    trial_period_days: 14, // 14-day free trial
                    metadata: {
                        firmId: firmId,
                        firmName: firmName || '',
                    },
                },
                // Note: invoice_creation is not needed for subscription mode
                // Stripe automatically creates invoices for subscriptions
            });

            return res.json({
                sessionId: session.id,
                url: session.url,
            });

        } catch (error) {
            console.error('createCheckoutSession error:', error.message);
            console.error('createCheckoutSession stack:', error.stack);
            console.error('createCheckoutSession type:', error.type || 'unknown');
            // Return more specific error info for debugging
            return res.status(500).json({
                error: 'Failed to create checkout session',
                details: error.message || 'Unknown error'
            });
        }
    }
);

/**
 * Get Stripe configuration for frontend
 *
 * @description Returns Stripe publishable key and pricing information
 * for initializing Stripe.js on the client side.
 *
 * @route GET /getStripeConfig
 * @returns {Object} JSON response with publishableKey, subscriptionPriceId, and subscriptionAmount
 */
const getStripeConfig = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        return res.json({
            publishableKey: STRIPE_PUBLISHABLE_KEY,
            subscriptionPriceId: STRIPE_SUBSCRIPTION_PRICE_ID,
            subscriptionAmount: 99,
        });
    }
);

/**
 * Handle Stripe webhook events
 *
 * @description Receives and processes Stripe webhook events for subscription lifecycle.
 * Handles checkout completion, subscription updates, and payment events.
 * Signature verification ensures requests are authentic from Stripe.
 *
 * @route POST /stripeWebhook
 * @param {Buffer} req.rawBody - Raw request body for signature verification
 * @param {string} req.headers['stripe-signature'] - Stripe signature header
 * @returns {Object} JSON response with received: true
 *
 * @event checkout.session.completed - New subscription checkout completed
 * @event customer.subscription.created - Subscription created
 * @event customer.subscription.updated - Subscription modified (cancel, reactivate, etc.)
 * @event customer.subscription.deleted - Subscription ended
 * @event invoice.payment_succeeded - Payment processed successfully
 * @event invoice.payment_failed - Payment failed
 */
const stripeWebhook = onRequest(
    {
        cors: false,
        region: 'us-west1',
        secrets: [stripeSecretKey, stripeWebhookSecret, smtpUser, smtpPass],
    },
    async (req, res) => {
        const stripe = require('stripe')(stripeSecretKey.value());

        // Get the webhook signing secret
        const endpointSecret = stripeWebhookSecret.value();

        let event;

        if (endpointSecret) {
            // Verify webhook signature
            const sig = req.headers['stripe-signature'];

            // In Firebase v2, raw body may be in req.rawBody or req.body (as Buffer)
            const rawBody = req.rawBody || req.body;

            try {
                event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                console.error('Signature:', sig?.substring(0, 50) + '...');
                console.error('Raw body type:', typeof rawBody);
                console.error('Raw body length:', rawBody?.length);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }
        } else {
            // For testing without signature verification
            console.log('No endpoint secret - skipping signature verification');
            event = req.body;
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                await handleCheckoutComplete(session);
                break;
            }

            case 'customer.subscription.created': {
                const subscription = event.data.object;
                await handleSubscriptionCreated(subscription);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await handleSubscriptionUpdated(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await handleSubscriptionDeleted(subscription);
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                await handlePaymentSucceeded(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                await handlePaymentFailed(invoice);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    }
);

/**
 * Send email via SMTP
 *
 * @description Internal helper to send transactional emails via Dreamhost SMTP.
 * Used for activation emails, cancellation confirmations, and admin notifications.
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
 * Generate account activation email HTML for customer
 *
 * @description Creates branded HTML email with embed instructions (for website subscribers)
 * or hosted intake URL (for subscribers without websites).
 *
 * @param {string} firmName - The firm name
 * @param {string} firmId - The lead ID (used for embed code generation)
 * @param {string} customerEmail - Customer's email (shown as delivery destination)
 * @param {boolean} [hasWebsite=true] - Whether the subscriber has a website
 * @param {string|null} [hostedIntakeUrl=null] - Hosted intake URL for website-less subscribers
 * @returns {string} HTML email content
 * @private
 */
function generateActivationEmail(firmName, firmId, customerEmail, hasWebsite = true, hostedIntakeUrl = null) {
    // For subscribers WITH a website - show embed code options
    if (hasWebsite) {
        const buttonEmbedCode = `<script src="https://preintake.ai/intake-button.js" data-firm="${firmId}" data-position="bottom-right"></script>`;
        const pageEmbedCode = `<div id="preintake-form" style="width: 100%; min-height: 700px;"></div>\n<script src="https://preintake.ai/intake-page.js" data-firm="${firmId}"></script>`;

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
        <h2 style="color: #0c1f3f; text-align: center; margin-bottom: 20px;">Your Account is Active!</h2>

        <p>Welcome to PreIntake.ai! Your AI-powered intake system for <strong>${firmName || 'your firm'}</strong> is now ready to use.</p>

        <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Choose the embed option that works best for your site:</p>

        <!-- Option 1: Button Embed -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c1f3f; font-size: 16px; margin: 0 0 10px 0;">Option 1: Floating Button (Recommended)</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Add to any page. A button appears that opens the intake form in a modal.</p>
            <div style="background: #1a1a2e; color: #ffffff; padding: 15px; border-radius: 6px; font-family: Monaco, Menlo, monospace; font-size: 11px; overflow-x: auto; word-break: break-all;">
                ${buttonEmbedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            <p style="margin: 10px 0 5px 0; font-size: 13px; color: #64748b;"><em>Position options: bottom-right, bottom-left, bottom-center, top-right, top-left, top-center</em></p>
        </div>

        <!-- Option 2: Page Embed -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0c1f3f; font-size: 16px; margin: 0 0 10px 0;">Option 2: Full Page Embed</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Add to a dedicated "Free Case Evaluation" page. The form fills the container.</p>
            <div style="background: #1a1a2e; color: #ffffff; padding: 15px; border-radius: 6px; font-family: Monaco, Menlo, monospace; font-size: 11px; overflow-x: auto; word-break: break-all; white-space: pre-wrap;">
${pageEmbedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #64748b;"><em>Style the container div to control dimensions.</em></p>
        </div>

        <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748b;">Both options work with any website platform: WordPress, Squarespace, Wix, or custom sites. No special plugins required.</p>

        <p style="margin: 0 0 25px 0; font-size: 14px; color: #64748b;"><strong><em>Not technical?</em></strong> Forward this email to your web developer—they'll have everything they need.</p>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Lead Delivery:</strong> Qualified leads will be sent to <strong>${customerEmail}</strong>.
                Need leads delivered to a different email or your CRM? Just reply to this email.
            </p>
        </div>

        <p style="margin-top: 30px; color: #64748b;">
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

    // For subscribers WITHOUT a website - show hosted intake URL
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
        <p style="margin: 0 0 20px 0;">Your intake page for <strong>${firmName || 'your firm'}</strong> is ready.</p>

        <p style="margin: 0 0 16px 0;">Here's your link to share with potential clients:</p>

        <p style="margin: 0 0 24px 0;">
            <a href="${hostedIntakeUrl}" style="color: #1a73e8; font-size: 18px; font-weight: 500;">${hostedIntakeUrl}</a>
        </p>

        <p style="margin: 0 0 20px 0;">Add it to your email signature, business cards, social profiles, or anywhere you connect with potential clients.</p>

        <p style="margin: 0 0 28px 0;">Completed intakes will be delivered to <strong>${customerEmail}</strong>. Need them sent somewhere else? Just reply to this email.</p>

        <p style="margin: 0; color: #64748b;">
            —<br>
            Support Team<br>
            PreIntake.ai
        </p>
    </div>
</body>
</html>
`;
}

/**
 * Generate cancellation confirmation email for customer
 *
 * @description Creates HTML email confirming subscription cancellation with
 * access end date and reactivation link.
 *
 * @param {string} firmName - The firm name
 * @param {Date} periodEndDate - Date when access ends
 * @returns {string} HTML email content
 * @private
 */
function generateCancellationEmail(firmName, periodEndDate) {
    const formattedDate = new Date(periodEndDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

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
        <h2 style="color: #0c1f3f; text-align: center; margin-bottom: 20px;">Subscription Cancelled</h2>

        <p>We're sorry to see you go. Your PreIntake.ai subscription for <strong>${firmName || 'your firm'}</strong> has been cancelled.</p>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 25px 0;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Your access remains active until:</strong><br>
                <span style="font-size: 18px; font-weight: 600;">${formattedDate}</span>
            </p>
        </div>

        <p>Your AI intake widget will continue to work and deliver leads until this date. After that, the widget will stop functioning on your website.</p>

        <h3 style="color: #0c1f3f; font-size: 16px; margin-top: 25px;">Changed your mind?</h3>
        <p>You can reactivate your subscription anytime before ${formattedDate} by visiting your account portal:</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="https://preintake.ai/account.html" style="display: inline-block; background: linear-gradient(135deg, #c9a962 0%, #b8954f 100%); color: #0c1f3f; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Manage My Account
            </a>
        </div>

        <p style="margin-top: 30px; color: #64748b; font-size: 14px;">
            We'd love to hear your feedback. If there's anything we could have done better, please let us know at <a href="mailto:support@preintake.ai" style="color: #c9a962;">support@preintake.ai</a>.
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
 * Generate notification email to Stephen for new activation
 *
 * @description Creates HTML email with new subscription details including
 * firm info, customer email, and quick links to demo/Firestore/Stripe.
 *
 * @param {string} firmName - The firm name
 * @param {string} customerEmail - Customer's email
 * @param {string} firmId - The lead/account ID
 * @returns {string} HTML email content
 * @private
 */
function generateActivationNotifyEmail(firmName, customerEmail, firmId) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #48bb78;">💰 New PreIntake.ai Subscription!</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Firm</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${firmName || 'Unknown'}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Email</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${customerEmail}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Firm ID</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${firmId}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Amount</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #48bb78;">$99/month</td>
        </tr>
    </table>

    <p>
        <a href="https://preintake.ai/demo/${firmId}" style="color: #c9a962;">View Demo</a> |
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/databases/preintake/data/~2Fpreintake_accounts~2F${firmId}" style="color: #c9a962;">Firestore</a> |
        <a href="https://dashboard.stripe.com/customers" style="color: #c9a962;">Stripe</a>
    </p>
</body>
</html>
`;
}

/**
 * Handle successful checkout completion
 *
 * @description Creates account in preintake_accounts collection, marks lead as converted,
 * sends activation email to customer and notification to admin.
 *
 * @param {Object} session - Stripe checkout session object
 * @param {string} session.metadata.firmId - Firm/lead ID
 * @param {string} session.metadata.passwordHash - Bcrypt hashed password
 * @param {string} session.customer - Stripe customer ID
 * @param {string} session.subscription - Stripe subscription ID
 * @returns {Promise<void>}
 * @private
 */
async function handleCheckoutComplete(session) {
    const firmId = session.metadata?.firmId;
    const passwordHash = session.metadata?.passwordHash;
    if (!firmId) {
        console.error('No firmId in checkout session metadata');
        return;
    }

    try {
        // Get lead document to retrieve firm details
        const leadDoc = await db.collection('preintake_leads').doc(firmId).get();
        const leadData = leadDoc.exists ? leadDoc.data() : {};

        const firmName = leadData.firmName || leadData.analysis?.firmName || leadData.website || 'Your Firm';
        const customerEmail = session.customer_details?.email || leadData.email;

        // Determine if subscriber has a website
        const hasWebsite = !!(leadData.website && leadData.website.trim());
        const barNumber = leadData.barNumber || null;

        // Get intakeCode from lead document (generated during demo creation)
        // Fall back to barNumber or firmId for legacy leads without intakeCode
        const intakeCode = leadData.intakeCode || barNumber || firmId;
        const hostedIntakeUrl = `https://preintake.ai/${intakeCode}`;

        // Build account data for preintake_accounts collection
        const accountData = {
            // Copy relevant lead data
            email: leadData.email || customerEmail,
            firmName: firmName,
            firstName: leadData.firstName || '',
            lastName: leadData.lastName || '',
            name: leadData.name || '',
            website: leadData.website || '',
            primaryPracticeArea: leadData.primaryPracticeArea || null,
            additionalPracticeAreas: leadData.additionalPracticeAreas || [],
            practiceAreas: leadData.practiceAreas || [],
            confirmedPracticeAreas: leadData.confirmedPracticeAreas || null,
            analysis: leadData.analysis || null,
            deepResearch: leadData.deepResearch || null,
            barNumber: barNumber,
            source: leadData.source || 'organic_signup',

            // Subscription data
            status: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active',
            deliveryEmail: customerEmail,
            hasWebsite: hasWebsite,
            deliveryMethod: hasWebsite ? 'embed' : 'hosted',
            intakeCode: intakeCode,
            hostedIntakeUrl: hostedIntakeUrl,

            // Timestamps
            createdAt: leadData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            activatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            // Reference to original lead
            originalLeadId: firmId,
        };

        // Add passwordHash if provided (from checkout session metadata)
        if (passwordHash) {
            accountData.passwordHash = passwordHash;
        }

        // Create document in preintake_accounts collection (same ID as lead for easy lookup)
        await db.collection('preintake_accounts').doc(firmId).set(accountData);

        // Also update the lead document to mark it as converted
        await db.collection('preintake_leads').doc(firmId).update({
            status: 'converted',
            convertedToAccountAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Checkout complete for firm ${firmId}, account created in preintake_accounts`);

        // Send activation email to customer
        try {
            // Use hosted URL for website-less subscribers, null for those with websites
            const emailHostedUrl = !hasWebsite ? hostedIntakeUrl : null;
            const customerHtml = generateActivationEmail(firmName, firmId, customerEmail, hasWebsite, emailHostedUrl);
            await sendEmail(
                customerEmail,
                'Your PreIntake.ai Account is Active!',
                customerHtml
            );
            await db.collection('preintake_accounts').doc(firmId).update({
                activationEmailSent: true,
                activationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Activation email sent to ${customerEmail}`);
        } catch (emailErr) {
            console.error('Error sending activation email:', emailErr.message);
        }

        // Send notification to Stephen
        try {
            const notifyHtml = generateActivationNotifyEmail(firmName, customerEmail, firmId);
            await sendEmail(
                NOTIFY_EMAIL,
                `💰 New Subscription: ${firmName}`,
                notifyHtml
            );
            console.log(`Activation notification sent to ${NOTIFY_EMAIL}`);
        } catch (emailErr) {
            console.error('Error sending activation notification:', emailErr.message);
        }

    } catch (error) {
        console.error('Error handling checkout complete:', error);
    }
}

/**
 * Handle subscription created event
 *
 * @description Updates account with subscription ID and period dates.
 *
 * @param {Object} subscription - Stripe subscription object
 * @param {string} subscription.metadata.firmId - Firm ID
 * @param {string} subscription.id - Subscription ID
 * @param {string} subscription.status - Subscription status
 * @returns {Promise<void>}
 * @private
 */
async function handleSubscriptionCreated(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        // Build update object with required fields
        const updateData = {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Only add period timestamps if they exist and are valid numbers
        if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
            updateData.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        }
        if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
            updateData.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }

        // Update preintake_accounts (where active subscribers are stored)
        await db.collection('preintake_accounts').doc(firmId).update(updateData);

        console.log(`Subscription created for firm ${firmId}`);
    } catch (error) {
        console.error('Error handling subscription created:', error);
    }
}

/**
 * Handle subscription updated event
 *
 * @description Updates subscription status, handles cancellation/reactivation,
 * sends cancellation confirmation email when cancel_at_period_end is set.
 *
 * @param {Object} subscription - Stripe subscription object
 * @param {string} subscription.metadata.firmId - Firm ID
 * @param {string} subscription.status - Subscription status
 * @param {boolean} subscription.cancel_at_period_end - Whether subscription will cancel at period end
 * @returns {Promise<void>}
 * @private
 */
async function handleSubscriptionUpdated(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        // Get current document to check if cancel_at_period_end changed
        const accountDoc = await db.collection('preintake_accounts').doc(firmId).get();
        const accountData = accountDoc.exists ? accountDoc.data() : {};
        const wasNotCancelling = !accountData.cancelAtPeriodEnd;
        const isNowCancelling = subscription.cancel_at_period_end === true;

        // Build update object with required fields
        const updateData = {
            subscriptionStatus: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Only add period timestamps if they exist and are valid numbers
        if (subscription.current_period_start && typeof subscription.current_period_start === 'number') {
            updateData.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        }
        if (subscription.current_period_end && typeof subscription.current_period_end === 'number') {
            updateData.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        }

        // Update the account document
        await db.collection('preintake_accounts').doc(firmId).update(updateData);

        console.log(`Subscription updated for firm ${firmId}: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}`);

        // Send cancellation email if user just cancelled (and we haven't sent one already)
        if (wasNotCancelling && isNowCancelling && !accountData.cancellationEmailSent) {
            const firmName = accountData.firmName || accountData.analysis?.firmName || accountData.website || 'Your Firm';
            const customerEmail = accountData.deliveryEmail || accountData.email;
            const periodEndDate = new Date(subscription.current_period_end * 1000);

            try {
                const emailHtml = generateCancellationEmail(firmName, periodEndDate);
                await sendEmail(
                    customerEmail,
                    'Your PreIntake.ai Subscription Has Been Cancelled',
                    emailHtml
                );

                // Mark that we sent the cancellation email
                await db.collection('preintake_accounts').doc(firmId).update({
                    cancellationEmailSent: true,
                    cancellationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                console.log(`Cancellation email sent to ${customerEmail} for firm ${firmId}`);

                // Also notify Stephen
                await sendEmail(
                    NOTIFY_EMAIL,
                    `⚠️ Subscription Cancelled: ${firmName}`,
                    `<p>Subscription cancelled for <strong>${firmName}</strong> (${customerEmail}).</p>
                     <p>Access remains active until: ${periodEndDate.toLocaleDateString()}</p>
                     <p><a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/databases/preintake/data/~2Fpreintake_accounts~2F${firmId}">View in Firestore</a></p>`
                );
            } catch (emailErr) {
                console.error('Error sending cancellation email:', emailErr.message);
            }
        }

        // If user reactivated (was cancelling, now not cancelling), reset the flag
        if (!isNowCancelling && accountData.cancelAtPeriodEnd === true) {
            await db.collection('preintake_accounts').doc(firmId).update({
                cancellationEmailSent: false,
            });
            console.log(`Subscription reactivated for firm ${firmId}`);
        }

    } catch (error) {
        console.error('Error handling subscription updated:', error);
    }
}

/**
 * Handle subscription deleted (cancelled) event
 *
 * @description Updates account status to cancelled when subscription ends.
 *
 * @param {Object} subscription - Stripe subscription object
 * @param {string} subscription.metadata.firmId - Firm ID
 * @returns {Promise<void>}
 * @private
 */
async function handleSubscriptionDeleted(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        await db.collection('preintake_accounts').doc(firmId).update({
            status: 'cancelled',
            subscriptionStatus: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Subscription cancelled for firm ${firmId}`);
    } catch (error) {
        console.error('Error handling subscription deleted:', error);
    }
}

/**
 * Handle successful payment event
 *
 * @description Updates account with last payment timestamp and amount.
 *
 * @param {Object} invoice - Stripe invoice object
 * @param {string} invoice.subscription - Subscription ID
 * @param {number} invoice.amount_paid - Amount paid in cents
 * @returns {Promise<void>}
 * @private
 */
async function handlePaymentSucceeded(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    try {
        // Find account by subscription ID
        const snapshot = await db.collection('preintake_accounts')
            .where('stripeSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

        if (snapshot.empty) return;

        const doc = snapshot.docs[0];
        await doc.ref.update({
            lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastPaymentAmount: invoice.amount_paid / 100,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Payment succeeded for subscription ${subscriptionId}`);
    } catch (error) {
        console.error('Error handling payment succeeded:', error);
    }
}

/**
 * Handle failed payment event
 *
 * @description Updates account with payment failure timestamp and sets
 * subscription status to past_due.
 *
 * @param {Object} invoice - Stripe invoice object
 * @param {string} invoice.subscription - Subscription ID
 * @returns {Promise<void>}
 * @private
 */
async function handlePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    try {
        // Find account by subscription ID
        const snapshot = await db.collection('preintake_accounts')
            .where('stripeSubscriptionId', '==', subscriptionId)
            .limit(1)
            .get();

        if (snapshot.empty) return;

        const doc = snapshot.docs[0];
        await doc.ref.update({
            paymentFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            subscriptionStatus: 'past_due',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Payment failed for subscription ${subscriptionId}`);
    } catch (error) {
        console.error('Error handling payment failed:', error);
    }
}

/**
 * Verify checkout session and get subscription status
 *
 * @description Retrieves checkout session details from Stripe to verify payment
 * completion. Called by payment-success.html to confirm transaction.
 *
 * @route GET /verifyCheckoutSession
 * @param {string} req.query.sessionId - Stripe Checkout session ID
 * @returns {Object} JSON with status, paymentStatus, customerEmail, firmId, firmName
 * @throws {400} Missing sessionId
 * @throws {500} Stripe API error
 */
const verifyCheckoutSession = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [stripeSecretKey],
    },
    async (req, res) => {
        try {
            const { sessionId } = req.query;

            if (!sessionId) {
                return res.status(400).json({ error: 'Missing sessionId' });
            }

            const stripe = require('stripe')(stripeSecretKey.value());
            const session = await stripe.checkout.sessions.retrieve(sessionId);

            return res.json({
                status: session.status,
                paymentStatus: session.payment_status,
                customerEmail: session.customer_details?.email,
                firmId: session.metadata?.firmId,
                firmName: session.metadata?.firmName,
            });

        } catch (error) {
            console.error('verifyCheckoutSession error:', error);
            return res.status(500).json({ error: 'Failed to verify session' });
        }
    }
);

/**
 * Resend activation email (admin endpoint)
 *
 * @description Admin endpoint to resend activation email with embed code or
 * hosted intake URL. Requires secret key for authorization.
 *
 * @route GET /resendActivationEmail
 * @param {string} req.query.leadId - Account/lead ID to resend email for
 * @param {string} req.query.secret - Admin secret (must match 'resend2026')
 * @returns {Object} JSON with success, message, firmName, hasWebsite, hostedIntakeUrl
 * @throws {403} Invalid or missing secret
 * @throws {404} Account not found
 * @throws {500} Email send failure
 */
const resendActivationEmail = onRequest(
    {
        region: 'us-west1',
        secrets: [smtpUser, smtpPass],
    },
    async (req, res) => {
        // CORS
        res.set('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            return res.status(204).send('');
        }

        try {
            const { leadId, secret } = req.query;

            // Simple secret check (use a hard-to-guess value)
            if (secret !== 'resend2026') {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            if (!leadId) {
                return res.status(400).json({ error: 'Missing leadId' });
            }

            // Fetch account data (accounts collection has active subscribers)
            const accountDoc = await db.collection('preintake_accounts').doc(leadId).get();
            if (!accountDoc.exists) {
                return res.status(404).json({ error: 'Account not found' });
            }

            const accountData = accountDoc.data();
            const firmName = accountData.firmName || 'Your Firm';
            const customerEmail = accountData.deliveryEmail || accountData.email;
            const hasWebsite = accountData.hasWebsite !== false;
            const hostedIntakeUrl = accountData.hostedIntakeUrl || null;

            // Generate and send email
            const emailHtml = generateActivationEmail(firmName, leadId, customerEmail, hasWebsite, hostedIntakeUrl);
            await sendEmail(customerEmail, 'Your PreIntake.ai Account is Active!', emailHtml);

            console.log(`Resent activation email to ${customerEmail} for account ${leadId}`);

            return res.json({
                success: true,
                message: `Activation email resent to ${customerEmail}`,
                firmName,
                hasWebsite,
                hostedIntakeUrl,
            });

        } catch (error) {
            console.error('resendActivationEmail error:', error);
            return res.status(500).json({ error: 'Failed to resend email', details: error.message });
        }
    }
);

module.exports = {
    createCheckoutSession,
    getStripeConfig,
    stripeWebhook,
    verifyCheckoutSession,
    resendActivationEmail,
};
