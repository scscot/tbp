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
const axios = require('axios');
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
            const _deepResearch = data.deepResearch || {};

            // Build practice areas list
            // Handle both formats:
            // - Website-based: data.practiceAreas?.breakdown is an object { "PI": 50, "Family": 50 }
            // - Hosted leads: data.practiceAreas is an array ["Personal Injury", "Family Law"]
            let practiceAreasList = [];
            if (data.practiceAreas?.breakdown && typeof data.practiceAreas.breakdown === 'object') {
                // Website-based leads use breakdown object
                const practiceBreakdown = data.practiceAreas.breakdown;
                const otherPracticeAreaName = data.practiceAreas?.otherName || null;
                practiceAreasList = buildPracticeAreasList(practiceBreakdown, otherPracticeAreaName);
            } else if (Array.isArray(data.practiceAreas)) {
                // Hosted leads store practice areas as array
                // Convert to the expected format with equal percentages
                const percentage = Math.floor(100 / data.practiceAreas.length);
                practiceAreasList = data.practiceAreas.map(name => ({
                    name: name,
                    percentage: percentage
                }));
            }

            // Determine firm name based on lead source:
            // - Campaign leads: data.name (from contact database)
            // - Hosted leads: data.firmName (entered in form)
            // - Website leads: analysis.firmName (scraped)
            let firmName = 'Law Firm';
            if (data.hosted === true || data.hasWebsite === false) {
                // Hosted leads - use firmName directly
                firmName = data.firmName || data.name || 'Law Firm';
            } else if (data.source === 'campaign') {
                // Campaign leads - prioritize data.name
                firmName = data.name || analysis.firmName || 'Law Firm';
            } else {
                // Website-based leads - use analysis.firmName
                firmName = analysis.firmName || data.firmName || data.name || 'Law Firm';
            }

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
            const { firmId, sessionId: _sessionId, messages } = req.body;

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
            // Note: generateSystemPrompt signature is (firmName, practiceArea, state, analysis, deepResearch, practiceAreasList, isMultiPractice)
            const systemPrompt = generateSystemPrompt(
                analysis.firmName || data.name || 'Law Firm',
                primaryPracticeArea,
                analysis.state || data.state || 'California',
                analysis,
                deepResearch,
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
    const toolCalls = [];

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
            // Extract firmId from URL path first (/demo/FIRM_ID), then fall back to query params
            // Path takes priority because query param 'firm' may contain firm NAME (not ID)
            let firmId = null;

            // First try to extract from path (for /demo/:firmId rewrite)
            if (req.path) {
                const pathMatch = req.path.match(/\/demo\/([a-zA-Z0-9]+)/);
                if (pathMatch) {
                    firmId = pathMatch[1];
                }
            }

            // Fall back to query param firmId (not 'firm' which may be the firm name)
            if (!firmId) {
                firmId = req.query.firmId;
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

/**
 * Serve the hosted intake page for subscribers (with or without websites)
 * URL formats:
 *   - /{intakeCode} - short URL (6-char alphanumeric code, e.g., /ABC123)
 *   - /intake/{intakeCode} - legacy format with /intake/ prefix
 *
 * Unlike serveDemo, this:
 * 1. Uses intakeCode (6-char code generated during demo creation) for URL routing
 * 2. Requires active subscription (not demo mode)
 * 3. Serves in LIVE mode (not demo mode)
 * 4. Falls back to barNumber lookup for backwards compatibility
 */
const serveHostedIntake = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            // Extract intakeCode from URL path
            // Supports both formats:
            //   /intake/CODE - legacy format with /intake/ prefix
            //   /CODE - short URL format (6-char alphanumeric)
            let intakeCode = null;

            if (req.path) {
                // Try /intake/CODE format first
                const intakeMatch = req.path.match(/\/intake\/([a-zA-Z0-9]+)/);
                if (intakeMatch) {
                    intakeCode = intakeMatch[1];
                } else {
                    // Try short URL format /CODE (matches 6-char uppercase alphanumeric)
                    const shortMatch = req.path.match(/^\/([A-Z0-9]{6})$/);
                    if (shortMatch) {
                        intakeCode = shortMatch[1];
                    }
                }
            }

            // Fall back to query param
            if (!intakeCode) {
                intakeCode = req.query.intakeCode || req.query.code || req.query.barNumber || req.query.bar;
            }

            if (!intakeCode) {
                return res.status(400).send('Intake code required');
            }

            // Validate intakeCode format (alphanumeric only)
            if (!/^[a-zA-Z0-9]+$/.test(intakeCode)) {
                return res.status(400).send('Invalid intake code format');
            }

            // Look up lead by intakeCode first (new hosted solution)
            let leadsSnapshot = await db.collection('preintake_leads')
                .where('intakeCode', '==', intakeCode)
                .limit(1)
                .get();

            // Fallback to barNumber lookup (campaign-sourced leads, backwards compatibility)
            if (leadsSnapshot.empty) {
                leadsSnapshot = await db.collection('preintake_leads')
                    .where('barNumber', '==', intakeCode)
                    .limit(1)
                    .get();
            }

            if (leadsSnapshot.empty) {
                return res.status(404).send('Intake page not found');
            }

            const leadDoc = leadsSnapshot.docs[0];
            const leadId = leadDoc.id;
            const data = leadDoc.data();

            // Validate subscription status - must be active (not demo mode)
            if (data.subscriptionStatus !== 'active') {
                // Check for grace period
                if (data.cancelAtPeriodEnd === true && data.currentPeriodEnd) {
                    const periodEnd = data.currentPeriodEnd.toDate ? data.currentPeriodEnd.toDate() : new Date(data.currentPeriodEnd);
                    if (periodEnd <= new Date()) {
                        return res.status(403).send('This intake page is no longer active');
                    }
                } else {
                    return res.status(404).send('Intake page not found');
                }
            }

            // Get the demo HTML from Firebase Storage
            const bucket = getStorage().bucket('teambuilder-plus-fe74d.firebasestorage.app');
            const file = bucket.file(`preintake-demos/${leadId}/index.html`);

            // Check if file exists
            const [exists] = await file.exists();
            if (!exists) {
                return res.status(404).send('Intake page not found');
            }

            // Download the HTML
            const [contents] = await file.download();
            let html = contents.toString();

            // Modify HTML to indicate LIVE mode (not demo mode)
            // This disables the "demo sent to {email}" confirmation modal
            html = html.replace(
                'window.PREINTAKE_DEMO_MODE = true',
                'window.PREINTAKE_DEMO_MODE = false'
            );

            // Also update any explicit demo mode checks
            html = html.replace(
                'const DEMO_MODE = true;',
                'const DEMO_MODE = false;'
            );

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
            res.send(html);

        } catch (error) {
            console.error('serveHostedIntake error:', error);
            return res.status(500).send('Error loading intake page');
        }
    }
);

/**
 * Track demo visits and views for click rate analytics
 * - type=visit: Records when someone clicks an email link (page load)
 * - type=view: Records when someone actually engages with the demo
 */
const trackDemoView = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            const firmId = req.query.firmId || req.query.firm || req.body?.firmId;
            const trackType = req.query.type || 'view'; // Default to 'view' for backwards compatibility

            if (!firmId) {
                return res.status(400).json({ error: 'Missing firmId parameter' });
            }

            // Validate firmId format (alphanumeric only)
            if (!/^[a-zA-Z0-9]+$/.test(firmId)) {
                return res.status(400).json({ error: 'Invalid firm ID' });
            }

            // Validate type
            if (trackType !== 'visit' && trackType !== 'view') {
                return res.status(400).json({ error: 'Invalid type parameter (must be visit or view)' });
            }

            // Get lead document
            const leadRef = db.collection('preintake_leads').doc(firmId);
            const leadDoc = await leadRef.get();

            if (!leadDoc.exists) {
                return res.status(404).json({ error: 'Lead not found' });
            }

            const data = leadDoc.data();

            // Track all demo sources (campaign and landing page)
            const now = admin.firestore.FieldValue.serverTimestamp();
            const updateData = {};

            if (trackType === 'visit') {
                // Track page visit (email CTA click)
                updateData.lastVisitAt = now;
                updateData.visitCount = admin.firestore.FieldValue.increment(1);
                if (!data.firstVisitAt) {
                    updateData.firstVisitAt = now;
                }
                console.log(`Visit tracked for lead ${firmId}`);
            } else {
                // Track demo view (engagement)
                updateData.lastViewedAt = now;
                updateData.viewCount = admin.firestore.FieldValue.increment(1);
                if (!data.firstViewedAt) {
                    updateData.firstViewedAt = now;
                }
                console.log(`Demo view tracked for lead ${firmId}`);
            }

            await leadRef.update(updateData);

            return res.json({
                success: true,
                tracked: true,
                type: trackType,
                firmId: firmId,
            });

        } catch (error) {
            console.error('trackDemoView error:', error);
            return res.status(500).json({ error: 'Failed to track' });
        }
    }
);

/**
 * Get email campaign analytics data
 * Returns aggregated stats for the analytics dashboard
 */
const getEmailAnalytics = onRequest(
    {
        cors: true,
        region: 'us-west1',
    },
    async (req, res) => {
        try {
            const now = new Date();

            // Fetch Mailgun stats for law.preintake.ai domain
            let mailgunStats = null;
            try {
                const MAILGUN_DOMAIN = process.env.PREINTAKE_MAILGUN_DOMAIN || 'law.preintake.ai';
                const MAILGUN_API_KEY = process.env.PREINTAKE_MAILGUN_API_KEY;

                if (!MAILGUN_API_KEY) {
                    console.warn('PREINTAKE_MAILGUN_API_KEY not set, skipping Mailgun stats');
                    throw new Error('Mailgun API key not configured');
                }

                const mailgunBaseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

                const statsResponse = await axios.get(`${mailgunBaseUrl}/stats/total`, {
                    auth: {
                        username: 'api',
                        password: MAILGUN_API_KEY
                    },
                    params: {
                        event: ['accepted', 'delivered', 'failed', 'opened', 'clicked', 'unsubscribed', 'complained'],
                        duration: '7d',
                        resolution: 'day'
                    }
                });

                // Extract totals from the stats response
                const stats = statsResponse.data?.stats || [];
                mailgunStats = {
                    accepted: 0,
                    delivered: 0,
                    failed: 0,
                    uniqueOpens: 0,
                    totalOpens: 0,
                    uniqueClicks: 0,
                    totalClicks: 0,
                    unsubscribed: 0,
                    complained: 0
                };

                stats.forEach(day => {
                    mailgunStats.accepted += day.accepted?.total || 0;
                    mailgunStats.delivered += day.delivered?.total || 0;
                    mailgunStats.failed += (day.failed?.permanent?.total || 0) + (day.failed?.temporary?.total || 0);
                    // Use unique counts for rate calculations (one per recipient)
                    mailgunStats.uniqueOpens += day.opened?.unique || 0;
                    mailgunStats.totalOpens += day.opened?.total || 0;
                    mailgunStats.uniqueClicks += day.clicked?.unique || 0;
                    mailgunStats.totalClicks += day.clicked?.total || 0;
                    mailgunStats.unsubscribed += day.unsubscribed?.total || 0;
                    mailgunStats.complained += day.complained?.total || 0;
                });

                // Calculate rates using unique opens/clicks (industry standard)
                // Cap at 100% since Mailgun's "unique" may count multiple devices per recipient
                if (mailgunStats.delivered > 0) {
                    const rawOpenRate = (mailgunStats.uniqueOpens / mailgunStats.delivered) * 100;
                    const rawClickRate = (mailgunStats.uniqueClicks / mailgunStats.delivered) * 100;
                    mailgunStats.openRate = Math.min(rawOpenRate, 100).toFixed(1);
                    mailgunStats.clickRate = Math.min(rawClickRate, 100).toFixed(1);
                } else {
                    mailgunStats.openRate = '0.0';
                    mailgunStats.clickRate = '0.0';
                }
            } catch (mailgunError) {
                console.error('Mailgun stats fetch error:', mailgunError.message);
                // Continue without Mailgun stats
            }

            // Calculate date boundaries in PST (UTC-8)
            // This ensures consistent "today" regardless of server timezone
            const PST_OFFSET = -8 * 60 * 60 * 1000; // -8 hours in ms
            const nowPST = new Date(now.getTime() + PST_OFFSET);

            // Get PST date components
            const pstYear = nowPST.getUTCFullYear();
            const pstMonth = nowPST.getUTCMonth();
            const pstDay = nowPST.getUTCDate();

            // Create boundaries at midnight PST (converted back to UTC)
            const todayStart = new Date(Date.UTC(pstYear, pstMonth, pstDay) - PST_OFFSET);
            const yesterdayStart = new Date(Date.UTC(pstYear, pstMonth, pstDay - 1) - PST_OFFSET);
            const endDate = new Date(Date.UTC(pstYear, pstMonth, pstDay + 1) - PST_OFFSET);
            const startDate = new Date(Date.UTC(pstYear, pstMonth, pstDay - 7) - PST_OFFSET);

            // Get all sent emails
            const emailsSnap = await db.collection('preintake_emails')
                .where('sent', '==', true)
                .get();

            const totalSent = emailsSnap.size;
            let withDemo = 0;
            let withoutDemo = 0;
            let last7DaysSent = 0;
            let last7DaysWithDemo = 0;
            let todaySent = 0;
            let todayWithDemo = 0;
            let yesterdaySent = 0;
            let yesterdayWithDemo = 0;
            const templateVersions = {};

            emailsSnap.forEach(doc => {
                const data = doc.data();

                // Count demo vs fallback
                if (data.demoGenerated) {
                    withDemo++;
                } else {
                    withoutDemo++;
                }

                // Template versions
                const version = data.templateVersion || 'unknown';
                templateVersions[version] = (templateVersions[version] || 0) + 1;

                // Date-based counts
                if (data.sentTimestamp) {
                    const sentDate = data.sentTimestamp.toDate();

                    // Last 7 days
                    if (sentDate >= startDate && sentDate < endDate) {
                        last7DaysSent++;
                        if (data.demoGenerated) last7DaysWithDemo++;
                    }

                    // Today
                    if (sentDate >= todayStart && sentDate < endDate) {
                        todaySent++;
                        if (data.demoGenerated) todayWithDemo++;
                    }

                    // Yesterday
                    if (sentDate >= yesterdayStart && sentDate < todayStart) {
                        yesterdaySent++;
                        if (data.demoGenerated) yesterdayWithDemo++;
                    }
                }
            });

            // Get campaign-sourced leads
            const leadsSnap = await db.collection('preintake_leads')
                .where('source', '==', 'campaign')
                .get();

            // Visit tracking (email CTA clicks)
            let visitedCount = 0;
            let last7DaysVisited = 0;
            let todayVisited = 0;
            let yesterdayVisited = 0;

            // View tracking (demo engagement)
            let viewedCount = 0;
            let last7DaysViewed = 0;
            let todayViewed = 0;
            let yesterdayViewed = 0;

            let activeLeads = 0;
            const leadDetails = [];

            leadsSnap.forEach(doc => {
                const data = doc.data();

                // Visit tracking
                const visitCount = data.visitCount || 0;
                const firstVisitAt = data.firstVisitAt?.toDate();

                if (visitCount > 0) {
                    visitedCount++;
                    if (firstVisitAt) {
                        if (firstVisitAt >= startDate) last7DaysVisited++;
                        if (firstVisitAt >= todayStart && firstVisitAt < endDate) todayVisited++;
                        if (firstVisitAt >= yesterdayStart && firstVisitAt < todayStart) yesterdayVisited++;
                    }
                }

                // View tracking
                const viewCount = data.viewCount || 0;
                const firstViewedAt = data.firstViewedAt?.toDate();

                if (viewCount > 0) {
                    viewedCount++;
                    if (firstViewedAt) {
                        if (firstViewedAt >= startDate) last7DaysViewed++;
                        if (firstViewedAt >= todayStart && firstViewedAt < endDate) todayViewed++;
                        if (firstViewedAt >= yesterdayStart && firstViewedAt < todayStart) yesterdayViewed++;
                    }
                }

                // Active leads (status changed or has delivery config)
                if (data.status !== 'demo_ready' || data.deliveryConfig) {
                    activeLeads++;
                }

                leadDetails.push({
                    firmName: data.name || data.analysis?.firmName || 'Unknown',
                    status: data.status || 'unknown',
                    createdAt: data.createdAt?.toDate()?.toISOString().split('T')[0] || null,
                    firstVisitAt: firstVisitAt?.toISOString().split('T')[0] || null,
                    visitCount: visitCount,
                    firstViewedAt: firstViewedAt?.toISOString().split('T')[0] || null,
                    viewCount: viewCount,
                });
            });

            // Sort leads by creation date (newest first)
            leadDetails.sort((a, b) => {
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return b.createdAt.localeCompare(a.createdAt);
            });

            return res.json({
                dateRange: `${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
                totalSent,
                withDemo,
                withoutDemo,
                last7DaysSent,
                last7DaysWithDemo,
                todaySent,
                todayWithDemo,
                yesterdaySent,
                yesterdayWithDemo,
                campaignLeads: leadsSnap.size,
                // Visits (email CTA clicks)
                visitedCount,
                last7DaysVisited,
                todayVisited,
                yesterdayVisited,
                // Views (demo engagement)
                viewedCount,
                last7DaysViewed,
                todayViewed,
                yesterdayViewed,
                activeLeads,
                templateVersions,
                leadDetails,
                // Mailgun delivery & engagement stats (last 7 days)
                mailgunStats,
            });

        } catch (error) {
            console.error('getEmailAnalytics error:', error);
            return res.status(500).json({ error: 'Failed to load analytics' });
        }
    }
);

module.exports = {
    getWidgetConfig,
    intakeChat,
    serveDemo,
    serveHostedIntake,
    trackDemoView,
    getEmailAnalytics,
};
