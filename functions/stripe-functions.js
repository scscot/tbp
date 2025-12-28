/**
 * PreIntake.ai - Stripe Functions
 * Handles payment processing for account creation
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database
const db = getFirestore('preintake');

// Stripe secret key
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// Stripe configuration
const STRIPE_SETUP_FEE_PRICE_ID = 'price_1SjOXiJBdoLMDposfZXL8nZX'; // $175 one-time
const STRIPE_SUBSCRIPTION_PRICE_ID = 'price_1SjORKJBdoLMDpos9wBBZbzd'; // $75/month
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SjNi9JBdoLMDposz9zUguoaB7fl4J1dzI5YFTnIzoge9IeAD9GcISLZq2cIT4Jh3x78pDuJtxSA0qmVEwBCV5gN007IHKxxOv';

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
            setupFeeAmount: 175,
            subscriptionAmount: 75,
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
        secrets: [stripeSecretKey],
    },
    async (req, res) => {
        const stripe = require('stripe')(stripeSecretKey.value());

        // Get the webhook signing secret from environment
        // You'll need to set this: firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        if (endpointSecret) {
            // Verify webhook signature
            const sig = req.headers['stripe-signature'];
            try {
                event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
            } catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }
        } else {
            // For testing without signature verification
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
 * Handle successful checkout
 */
async function handleCheckoutComplete(session) {
    const firmId = session.metadata?.firmId;
    if (!firmId) {
        console.error('No firmId in checkout session metadata');
        return;
    }

    try {
        // Update lead document with subscription info
        await db.collection('preintake_leads').doc(firmId).update({
            status: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            subscriptionStatus: 'active',
            activatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Checkout complete for firm ${firmId}`);
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
