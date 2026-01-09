/**
 * PreIntake.ai - Widget Functions
 * Server-side endpoints for embeddable widget
 *
 * These functions handle:
 * 1. getWidgetConfig - Returns public config (branding, practice areas)
 * 2. intakeChat - Handles AI chat with server-side prompts (protects IP)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database
const db = getFirestore('preintake');

// Anthropic API key secret
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Import prompt/tools generators from demo-generator
const {
    generateSystemPrompt,
    generateTools,
    buildPracticeAreasList,
} = require('./demo-generator-functions');

/**
 * Validate subscription status for widget access
 * Returns { valid: boolean, reason: string }
 */
function validateSubscription(data) {
    // Allow demo mode (not yet paid)
    if (data.status === 'demo_ready' || data.status === 'pending' || data.status === 'analyzing' || data.status === 'researching' || data.status === 'generating_demo') {
        return { valid: true, reason: 'demo_mode' };
    }

    // Allow active subscriptions
    if (data.subscriptionStatus === 'active') {
        return { valid: true, reason: 'active_subscription' };
    }

    // Allow grace period (cancelled but not yet expired)
    if (data.cancelAtPeriodEnd === true && data.currentPeriodEnd) {
        const periodEnd = data.currentPeriodEnd.toDate ? data.currentPeriodEnd.toDate() : new Date(data.currentPeriodEnd);
        if (periodEnd > new Date()) {
            return { valid: true, reason: 'grace_period' };
        }
    }

    // Subscription expired or cancelled
    return {
        valid: false,
        reason: data.subscriptionStatus === 'cancelled' ? 'subscription_cancelled' : 'subscription_expired'
    };
}

/**
 * Get public widget configuration for a firm
 * Returns ONLY public data - no prompts, tools, or qualification criteria
 */
const getWidgetConfig = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            const firmId = req.query.firm || req.query.firmId;

            if (!firmId) {
                return res.status(400).json({ error: 'Missing firm parameter' });
            }

            // Get lead document
            const leadDoc = await db.collection('preintake_leads').doc(firmId).get();

            if (!leadDoc.exists) {
                return res.status(404).json({ error: 'Firm not found' });
            }

            const data = leadDoc.data();

            // Validate subscription status
            const subscriptionCheck = validateSubscription(data);
            if (!subscriptionCheck.valid) {
                return res.status(403).json({
                    error: 'subscription_inactive',
                    reason: subscriptionCheck.reason,
                    message: subscriptionCheck.reason === 'subscription_cancelled'
                        ? 'This intake widget has been deactivated because the subscription was cancelled.'
                        : 'This intake widget has been deactivated because the subscription has expired.'
                });
            }

            const analysis = data.analysis || {};
            const deepResearch = data.deepResearch || {};

            // Build practice areas list from breakdown
            const practiceBreakdown = data.practiceAreas?.breakdown || {};
            const otherPracticeAreaName = data.practiceAreas?.otherName || null;
            const practiceAreasList = buildPracticeAreasList(practiceBreakdown, otherPracticeAreaName);

            // For campaign-sourced leads, prioritize data.name (from contact database)
            // over analysis.firmName (scraped from website, often unreliable)
            const firmName = data.source === 'campaign'
                ? (data.name || analysis.firmName || 'Law Firm')
                : (analysis.firmName || data.name || 'Law Firm');

            // Return ONLY public data
            return res.json({
                firmName: firmName,
                logoUrl: analysis.logo || null,
                colors: {
                    primary: analysis.primaryColor || '#0c1f3f',
                    accent: analysis.accentColor || '#c9a962',
                },
                practiceAreas: practiceAreasList.map(a => a.name),
                welcomeMessage: `Hello! I'm here to help you with your legal matter. Let's start by getting some basic information.`,
                state: analysis.state || data.state || 'California',
                // UI hints
                totalSteps: practiceAreasList.length > 1 ? 5 : 4,
                // Demo URL for campaign personalization
                demoUrl: data.demoUrl || null,
            });

        } catch (error) {
            console.error('getWidgetConfig error:', error);
            return res.status(500).json({ error: 'Failed to load config' });
        }
    }
);

/**
 * Handle chat messages with server-side AI processing
 * Client sends messages, server loads prompts and calls Claude
 * PROTECTS: System prompts, tools definitions, qualification criteria
 */
const intakeChat = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [anthropicApiKey],
        timeoutSeconds: 120,
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { firmId, sessionId, messages } = req.body;

            if (!firmId) {
                return res.status(400).json({ error: 'Missing firmId' });
            }

            if (!messages || !Array.isArray(messages) || messages.length === 0) {
                return res.status(400).json({ error: 'Missing or invalid messages' });
            }

            // Get lead document
            const leadDoc = await db.collection('preintake_leads').doc(firmId).get();

            if (!leadDoc.exists) {
                return res.status(404).json({ error: 'Firm not found' });
            }

            const data = leadDoc.data();

            // Validate subscription status
            const subscriptionCheck = validateSubscription(data);
            if (!subscriptionCheck.valid) {
                return res.status(403).json({
                    error: 'subscription_inactive',
                    reason: subscriptionCheck.reason,
                    message: subscriptionCheck.reason === 'subscription_cancelled'
                        ? 'This intake widget has been deactivated because the subscription was cancelled.'
                        : 'This intake widget has been deactivated because the subscription has expired.'
                });
            }

            const analysis = data.analysis || {};
            const deepResearch = data.deepResearch || {};

            // Build practice areas configuration
            const practiceBreakdown = data.practiceAreas?.breakdown || {};
            const otherPracticeAreaName = data.practiceAreas?.otherName || null;
            const practiceAreasList = buildPracticeAreasList(practiceBreakdown, otherPracticeAreaName);
            const isMultiPractice = practiceAreasList.length > 1;

            // Determine primary practice area
            let primaryPracticeArea = 'Personal Injury';
            if (practiceAreasList.length > 0) {
                // Sort by percentage and get the highest
                const sorted = [...practiceAreasList].sort((a, b) => b.percentage - a.percentage);
                primaryPracticeArea = sorted[0].name;
            }

            // Generate system prompt (SERVER-SIDE ONLY - never exposed to client)
            const systemPrompt = generateSystemPrompt(
                analysis.firmName || data.name || 'Law Firm',
                primaryPracticeArea,
                analysis.state || data.state || 'California',
                analysis,
                deepResearch,
                practiceBreakdown,
                otherPracticeAreaName,
                practiceAreasList,
                isMultiPractice
            );

            // Generate tools (SERVER-SIDE ONLY - never exposed to client)
            const tools = generateTools(primaryPracticeArea);

            // Initialize Anthropic client
            const anthropic = new Anthropic({
                apiKey: anthropicApiKey.value(),
            });

            // Call Claude with server-side prompt
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                tools: tools,
                messages: messages,
            });

            // Process response - extract text and UI hints
            const processed = processResponse(response);

            // Return processed response (no prompts, no tools)
            return res.json({
                content: processed.text,
                buttons: processed.buttons,
                toolCalls: processed.toolCalls,
                stopReason: response.stop_reason,
            });

        } catch (error) {
            console.error('intakeChat error:', error);

            // Handle rate limiting
            if (error.status === 429) {
                return res.status(429).json({
                    error: 'Rate limited',
                    message: 'Please wait a moment before sending another message.',
                    retryAfter: 5,
                });
            }

            return res.status(500).json({ error: 'Failed to process message' });
        }
    }
);

/**
 * Process Claude response to extract text and UI hints
 * Parses [OPTIONS: ...] format for button rendering
 */
function processResponse(response) {
    let text = '';
    let buttons = [];
    let toolCalls = [];

    for (const block of response.content) {
        if (block.type === 'text') {
            let blockText = block.text;

            // Extract [OPTIONS: ...] for button rendering
            const optionsMatch = blockText.match(/\[OPTIONS:\s*([^\]]+)\]/);
            if (optionsMatch) {
                const optionsStr = optionsMatch[1];
                buttons = optionsStr.split('|').map(opt => opt.trim()).filter(opt => opt);
                // Remove the OPTIONS tag from text
                blockText = blockText.replace(/\[OPTIONS:\s*[^\]]+\]/, '').trim();
            }

            text += blockText;

        } else if (block.type === 'tool_use') {
            // Include tool calls so widget can handle them
            toolCalls.push({
                id: block.id,
                name: block.name,
                input: block.input,
            });
        }
    }

    return {
        text: text.trim(),
        buttons,
        toolCalls,
    };
}

/**
 * Serve demo HTML from Firebase Storage
 * Proxies the demo to enable iframe embedding (bypasses CORS)
 */
const serveDemo = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            // Extract firmId from query params or URL path (/demo/FIRM_ID)
            let firmId = req.query.firm || req.query.firmId;

            // If not in query, try to extract from path (for /demo/:firmId rewrite)
            if (!firmId && req.path) {
                const pathMatch = req.path.match(/\/demo\/([a-zA-Z0-9]+)/);
                if (pathMatch) {
                    firmId = pathMatch[1];
                }
            }

            if (!firmId) {
                return res.status(400).send('Missing firm parameter');
            }

            // Validate firmId format (alphanumeric only)
            if (!/^[a-zA-Z0-9]+$/.test(firmId)) {
                return res.status(400).send('Invalid firm ID');
            }

            // Get the demo HTML from Firebase Storage
            const bucket = getStorage().bucket('teambuilder-plus-fe74d.firebasestorage.app');
            const file = bucket.file(`preintake-demos/${firmId}/index.html`);

            // Check if file exists
            const [exists] = await file.exists();
            if (!exists) {
                return res.status(404).send('Demo not found for this firm');
            }

            // Download and serve the HTML
            const [contents] = await file.download();

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(contents.toString());

        } catch (error) {
            console.error('serveDemo error:', error);
            return res.status(500).send('Failed to load demo');
        }
    }
);

module.exports = {
    getWidgetConfig,
    intakeChat,
    serveDemo,
};
