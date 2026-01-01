/**
 * PreIntake.ai - Stripe Functions
 * Handles payment processing for account creation
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
const STRIPE_SETUP_FEE_PRICE_ID = 'price_1SksYAJBdoLMDposleabMPli'; // $149 one-time setup fee
const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SksalJBdoLMDposiiL704de'; // $79/month subscription
// TEST MODE price IDs (for testing with 4242 4242 4242 4242)
// const STRIPE_SETUP_FEE_PRICE_ID = 'price_1SjQ1aJaJO3EHqOSH5tYPJOB';
// const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SjNpAJaJO3EHqOSHh4DbhNM';
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SjNi9JBdoLMDposKpLCGI1NRg0cDPmKwRhDQfZ1kkiVlGxFyYi6OBUyLhfFkIpgFlrX2kJR8kR6uS4Wy7VGXVQR00M7hdJJkG';

/**
 * Create a Stripe Checkout session for subscription
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
            const { firmId, email, firmName } = req.body;

            if (!firmId) {
                return res.status(400).json({ error: 'Missing firmId' });
            }

            if (!email) {
                return res.status(400).json({ error: 'Missing email' });
            }

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

            // Create checkout session with setup fee + subscription
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        // One-time setup fee
                        price: STRIPE_SETUP_FEE_PRICE_ID,
                        quantity: 1,
                    },
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
                },
                subscription_data: {
                    metadata: {
                        firmId: firmId,
                        firmName: firmName || '',
                    },
                },
                // Send invoice/receipt emails for this subscription
                invoice_creation: {
                    enabled: true,
                    invoice_data: {
                        description: `PreIntake.ai - AI-Powered Legal Intake for ${firmName || 'Your Firm'}`,
                        metadata: {
                            firmId: firmId,
                        },
                    },
                },
            });

            return res.json({
                sessionId: session.id,
                url: session.url,
            });

        } catch (error) {
            console.error('createCheckoutSession error:', error);
            return res.status(500).json({ error: 'Failed to create checkout session' });
        }
    }
);

/**
 * Get Stripe publishable key (for frontend)
 */
const getStripeConfig = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        return res.json({
            publishableKey: STRIPE_PUBLISHABLE_KEY,
            setupFeePriceId: STRIPE_SETUP_FEE_PRICE_ID,
            subscriptionPriceId: STRIPE_SUBSCRIPTION_PRICE_ID,
            setupFeeAmount: 399,
            subscriptionAmount: 129,
        });
    }
);

/**
 * Handle Stripe webhook events
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
 */
function generateActivationEmail(firmName, firmId, customerEmail) {
    const embedCode = `<script src="https://preintake.ai/intake-button.js" data-firm="${firmId}" data-position="bottom-right"></script>`;

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

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #0c1f3f; font-size: 16px; margin: 0 0 15px 0;">Quick Start: Add Intake to Your Website</h3>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Copy this code and paste it before the closing <code>&lt;/body&gt;</code> tag of your website pages:</p>
            <div style="background: #1a1a2e; color: #ffffff; padding: 15px; border-radius: 6px; font-family: Monaco, Menlo, monospace; font-size: 12px; overflow-x: auto; word-break: break-all;">
                ${embedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            <p style="margin: 15px 0 5px 0; font-size: 14px; color: #64748b;"><strong><em>Change <code>data-position</code> to control button placement:</em></strong></p>
            <ul style="margin: 5px 0 10px 20px; padding: 0; font-size: 14px; color: #64748b;">
                <li><code>bottom-right</code></li>
                <li><code>bottom-left</code></li>
                <li><code>bottom-center</code></li>
                <li><code>top-right</code></li>
                <li><code>top-left</code></li>
                <li><code>top-center</code></li>
            </ul>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">That's it—the intake button appears automatically and starts screening leads immediately.</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">Works with any website platform: WordPress, Squarespace, Wix, custom sites, or any CMS. No special plugins or technical expertise required.</p>
        </div>

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

/**
 * Generate notification email to Stephen for new activation
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
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #48bb78;">$228 ($149 + $79/mo)</td>
        </tr>
    </table>

    <p>
        <a href="https://preintake.ai/demo/${firmId}" style="color: #c9a962;">View Demo</a> |
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/databases/preintake/data/~2Fpreintake_leads~2F${firmId}" style="color: #c9a962;">Firestore</a> |
        <a href="https://dashboard.stripe.com/customers" style="color: #c9a962;">Stripe</a>
    </p>
</body>
</html>
`;
}

/**
 * Handle successful checkout
 */
async function handleCheckoutComplete(session) {
    const firmId = session.metadata?.firmId;
    if (!firmId) {
        console.error('No firmId in checkout session metadata');
        return;
    }

    try {
        // Get lead document to retrieve firm details
        const leadDoc = await db.collection('preintake_leads').doc(firmId).get();
        const leadData = leadDoc.exists ? leadDoc.data() : {};

        const firmName = leadData.analysis?.firmName || leadData.website || 'Your Firm';
        const customerEmail = session.customer_details?.email || leadData.email;

        // Update lead document with subscription info
        await db.collection('preintake_leads').doc(firmId).update({
            status: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active',
            deliveryEmail: customerEmail, // Default lead delivery to their email
            activatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Checkout complete for firm ${firmId}`);

        // Send activation email to customer
        try {
            const customerHtml = generateActivationEmail(firmName, firmId, customerEmail);
            await sendEmail(
                customerEmail,
                'Your PreIntake.ai Account is Active!',
                customerHtml
            );
            await db.collection('preintake_leads').doc(firmId).update({
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
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        await db.collection('preintake_leads').doc(firmId).update({
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Subscription created for firm ${firmId}`);
    } catch (error) {
        console.error('Error handling subscription created:', error);
    }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        await db.collection('preintake_leads').doc(firmId).update({
            subscriptionStatus: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Subscription updated for firm ${firmId}: ${subscription.status}`);
    } catch (error) {
        console.error('Error handling subscription updated:', error);
    }
}

/**
 * Handle subscription deleted (cancelled)
 */
async function handleSubscriptionDeleted(subscription) {
    const firmId = subscription.metadata?.firmId;
    if (!firmId) return;

    try {
        await db.collection('preintake_leads').doc(firmId).update({
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
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    try {
        // Find firm by subscription ID
        const snapshot = await db.collection('preintake_leads')
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
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    try {
        // Find firm by subscription ID
        const snapshot = await db.collection('preintake_leads')
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

module.exports = {
    createCheckoutSession,
    getStripeConfig,
    stripeWebhook,
    verifyCheckoutSession,
};
