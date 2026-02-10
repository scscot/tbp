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
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
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

            // Skip onboarding modal for hosted intake (live mode)
            // The onboarding modal is for demo users; live customers should see intake directly
            html = html.replace(
                "if (urlParams.get('skip_onboarding') === 'true') {",
                "if (true) { // Live mode: always skip onboarding"
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
            if (trackType !== 'visit' && trackType !== 'view' && trackType !== 'explore') {
                return res.status(400).json({ error: 'Invalid type parameter (must be visit, view, or explore)' });
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
            } else if (trackType === 'explore') {
                // Track "I'll explore the site first" click
                updateData.lastExploreAt = now;
                updateData.exploreCount = admin.firestore.FieldValue.increment(1);
                if (!data.firstExploreAt) {
                    updateData.firstExploreAt = now;
                }
                console.log(`Explore tracked for lead ${firmId}`);
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

            // Data cutoff date: February 9, 2026 at midnight PST
            // All data before this date is excluded from analytics
            const DATA_START_DATE = new Date('2026-02-09T00:00:00-08:00');

            // Create date strings for GA4 (YYYY-MM-DD format in PST)
            const formatDateStr = (date) => {
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };
            // Use Date.UTC to properly handle month/day rollover
            const todayDatePST = new Date(Date.UTC(pstYear, pstMonth, pstDay));
            const yesterdayDatePST = new Date(Date.UTC(pstYear, pstMonth, pstDay - 1));
            const sevenDaysAgoDatePST = new Date(Date.UTC(pstYear, pstMonth, pstDay - 7));
            const todayStr = formatDateStr(todayDatePST);
            const yesterdayStr = formatDateStr(yesterdayDatePST);
            const sevenDaysAgoStr = formatDateStr(sevenDaysAgoDatePST);

            // Fetch GA4 website analytics for preintake.ai
            let ga4Stats = null;
            try {
                const GA4_PREINTAKE_PROPERTY_ID = '517857439';
                const ga4Client = new BetaAnalyticsDataClient({
                    keyFilename: './ga4-service-account.json'
                });

                // Define metrics once for reuse
                const ga4Metrics = [
                    { name: 'activeUsers' },
                    { name: 'sessions' },
                    { name: 'screenPageViews' },
                    { name: 'engagementRate' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' }
                ];

                // Run SEPARATE queries for each date range to avoid row alignment issues
                // When using multi-dateRange, GA4 may skip empty date ranges, causing misalignment
                const [last7DaysResponse, todayResponse, yesterdayResponse, trafficResponse] = await Promise.all([
                    // 7-day metrics
                    ga4Client.runReport({
                        property: `properties/${GA4_PREINTAKE_PROPERTY_ID}`,
                        dateRanges: [{ startDate: sevenDaysAgoStr, endDate: todayStr }],
                        metrics: ga4Metrics
                    }),
                    // Today metrics
                    ga4Client.runReport({
                        property: `properties/${GA4_PREINTAKE_PROPERTY_ID}`,
                        dateRanges: [{ startDate: todayStr, endDate: todayStr }],
                        metrics: ga4Metrics
                    }),
                    // Yesterday metrics
                    ga4Client.runReport({
                        property: `properties/${GA4_PREINTAKE_PROPERTY_ID}`,
                        dateRanges: [{ startDate: yesterdayStr, endDate: yesterdayStr }],
                        metrics: ga4Metrics
                    }),
                    // Traffic sources (last 7 days)
                    ga4Client.runReport({
                        property: `properties/${GA4_PREINTAKE_PROPERTY_ID}`,
                        dateRanges: [{ startDate: sevenDaysAgoStr, endDate: todayStr }],
                        dimensions: [
                            { name: 'sessionSource' },
                            { name: 'sessionMedium' }
                        ],
                        metrics: [
                            { name: 'sessions' },
                            { name: 'activeUsers' },
                            { name: 'engagementRate' }
                        ],
                        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                        limit: 10
                    })
                ]);

                // Parse each response separately - now each is guaranteed to be for the correct date range
                const parseRow = (row) => ({
                    activeUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
                    sessions: parseInt(row?.metricValues?.[1]?.value || '0'),
                    pageViews: parseInt(row?.metricValues?.[2]?.value || '0'),
                    engagementRate: parseFloat(row?.metricValues?.[3]?.value || '0'),
                    avgSessionDuration: parseFloat(row?.metricValues?.[4]?.value || '0'),
                    bounceRate: parseFloat(row?.metricValues?.[5]?.value || '0')
                });

                const last7Days = parseRow(last7DaysResponse[0]?.rows?.[0]);
                const today = parseRow(todayResponse[0]?.rows?.[0]);
                const yesterday = parseRow(yesterdayResponse[0]?.rows?.[0]);

                // Parse traffic sources
                const trafficRows = trafficResponse[0]?.rows || [];
                const trafficSources = trafficRows.map(row => ({
                    source: row.dimensionValues?.[0]?.value || '(not set)',
                    medium: row.dimensionValues?.[1]?.value || '(not set)',
                    sessions: parseInt(row.metricValues?.[0]?.value || '0'),
                    users: parseInt(row.metricValues?.[1]?.value || '0'),
                    engagementRate: parseFloat(row.metricValues?.[2]?.value || '0')
                }));

                ga4Stats = { last7Days, today, yesterday, trafficSources };
            } catch (ga4Error) {
                console.error('GA4 stats fetch error:', ga4Error.message);
                // Continue without GA4 stats
            }

            // Get sent emails + database overview in parallel
            const [emailsSnapRaw, unsubSnapRaw, failedSnapRaw, pendingSnap] = await Promise.all([
                db.collection('preintake_emails').where('sent', '==', true).get(),
                db.collection('preintake_emails').where('status', '==', 'unsubscribed').get(),
                db.collection('preintake_emails').where('status', '==', 'failed').get(),
                db.collection('preintake_emails').where('sent', '==', false).get()
            ]);

            // Filter by DATA_START_DATE to exclude pre-Feb 2, 2026 data
            const filterByDate = (snap) => {
                const filtered = [];
                snap.forEach(doc => {
                    const data = doc.data();
                    const sentDate = data.sentTimestamp?.toDate();
                    if (sentDate && sentDate >= DATA_START_DATE) {
                        filtered.push({ id: doc.id, data: () => data });
                    }
                });
                return { docs: filtered, size: filtered.length, forEach: (fn) => filtered.forEach(d => fn({ id: d.id, data: d.data })) };
            };

            const emailsSnap = filterByDate(emailsSnapRaw);
            const unsubSnap = filterByDate(unsubSnapRaw);
            const failedSnap = filterByDate(failedSnapRaw);

            const totalSent = emailsSnap.size;
            const totalUnsubscribed = unsubSnap.size;
            const totalFailed = failedSnap.size;
            const totalPending = pendingSnap.size;
            const totalContacts = totalSent + totalPending;

            let withDemo = 0;
            let withoutDemo = 0;
            let last7DaysSent = 0;
            let last7DaysWithDemo = 0;
            let todaySent = 0;
            let todayWithDemo = 0;
            let yesterdaySent = 0;
            let yesterdayWithDemo = 0;
            const templateVersions = {};
            const sourceBreakdown = {};
            const stateBreakdown = {};

            emailsSnap.forEach(doc => {
                const data = doc.data();

                // Count demo vs fallback
                if (data.demoGenerated) {
                    withDemo++;
                } else {
                    withoutDemo++;
                }

                // Source breakdown (calbar, flbar, ohbar, mibar, mobar, kybar, gabar, etc.)
                const source = data.source || 'unknown';
                sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;

                // State breakdown (CA, FL, OH, MI, MO, KY, GA, etc.)
                const state = data.state || 'unknown';
                stateBreakdown[state] = (stateBreakdown[state] || 0) + 1;

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

            // Get campaign-sourced leads (includes both 'campaign' and 'bar_profile_campaign')
            const leadsSnapRaw = await db.collection('preintake_leads')
                .where('source', 'in', ['campaign', 'bar_profile_campaign'])
                .get();

            // Filter by DATA_START_DATE to exclude pre-Feb 2, 2026 data
            const filteredLeads = [];
            leadsSnapRaw.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate();
                if (createdAt && createdAt >= DATA_START_DATE) {
                    filteredLeads.push({ id: doc.id, data: () => data });
                }
            });
            const leadsSnap = { docs: filteredLeads, size: filteredLeads.length, forEach: (fn) => filteredLeads.forEach(d => fn({ id: d.id, data: d.data })) };

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

            // Intake completion tracking
            let intakeCompletedCount = 0;
            let last7DaysCompleted = 0;
            let todayCompleted = 0;
            let yesterdayCompleted = 0;

            // Explore tracking (aggregate)
            let exploredCount = 0;

            let activeLeads = 0;
            const leadDetails = [];

            // Build leadId → engagement map for per-template/per-source performance
            const leadEngagement = {};

            leadsSnap.forEach(doc => {
                const data = doc.data();
                const leadId = doc.id;

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

                // Explore tracking
                const exploreCount = data.exploreCount || 0;
                if (exploreCount > 0) exploredCount++;

                // Intake completion tracking (set by logDelivery in intake-delivery-functions.js)
                const intakeDelivery = data.intakeDelivery;
                const intakeCompleted = !!(intakeDelivery && intakeDelivery.success);
                const deliveredAt = intakeDelivery?.deliveredAt?.toDate();

                if (intakeCompleted) {
                    intakeCompletedCount++;
                    if (deliveredAt) {
                        if (deliveredAt >= startDate) last7DaysCompleted++;
                        if (deliveredAt >= todayStart && deliveredAt < endDate) todayCompleted++;
                        if (deliveredAt >= yesterdayStart && deliveredAt < todayStart) yesterdayCompleted++;
                    }
                }

                // Active leads (status changed or has delivery config)
                if (data.status !== 'demo_ready' || data.deliveryConfig) {
                    activeLeads++;
                }

                // Store engagement data for per-template/per-source cross-reference
                leadEngagement[leadId] = {
                    visited: visitCount > 0,
                    viewed: viewCount > 0,
                    explored: exploreCount > 0,
                    completed: intakeCompleted
                };

                leadDetails.push({
                    firmName: data.name || data.analysis?.firmName || 'Unknown',
                    source: data.source || 'unknown',
                    createdAt: data.createdAt?.toDate()?.toISOString().split('T')[0] || null,
                    firstVisitAt: firstVisitAt?.toISOString().split('T')[0] || null,
                    visitCount: visitCount,
                    exploreCount: exploreCount,
                    firstViewedAt: firstViewedAt?.toISOString().split('T')[0] || null,
                    viewCount: viewCount,
                    intakeCompleted: intakeCompleted,
                    intakeDeliveredAt: deliveredAt?.toISOString().split('T')[0] || null,
                    subscriptionStatus: data.subscriptionStatus || null,
                });
            });

            // Build per-template and per-source performance by cross-referencing
            // preintake_emails (via preintakeLeadId) with lead engagement data
            const templatePerformance = {};
            const sourcePerformance = {};

            emailsSnap.forEach(doc => {
                const data = doc.data();
                const template = data.templateVersion || 'unknown';
                const source = data.source || 'unknown';
                const leadId = data.preintakeLeadId || null;

                // Initialize template entry
                if (!templatePerformance[template]) {
                    templatePerformance[template] = { sent: 0, visited: 0, viewed: 0, completed: 0 };
                }
                templatePerformance[template].sent++;

                // Initialize source entry
                if (!sourcePerformance[source]) {
                    sourcePerformance[source] = { sent: 0, visited: 0, viewed: 0, completed: 0 };
                }
                sourcePerformance[source].sent++;

                // Cross-reference with lead engagement
                if (leadId && leadEngagement[leadId]) {
                    const eng = leadEngagement[leadId];
                    if (eng.visited) {
                        templatePerformance[template].visited++;
                        sourcePerformance[source].visited++;
                    }
                    if (eng.viewed) {
                        templatePerformance[template].viewed++;
                        sourcePerformance[source].viewed++;
                    }
                    if (eng.completed) {
                        templatePerformance[template].completed++;
                        sourcePerformance[source].completed++;
                    }
                }
            });

            // Sort leads by most recent activity (visit, view, or creation)
            leadDetails.sort((a, b) => {
                const aDate = a.firstViewedAt || a.firstVisitAt || a.createdAt || '';
                const bDate = b.firstViewedAt || b.firstVisitAt || b.createdAt || '';
                if (!aDate) return 1;
                if (!bDate) return -1;
                return bDate.localeCompare(aDate);
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
                // Intake completion
                intakeCompletedCount,
                last7DaysCompleted,
                todayCompleted,
                yesterdayCompleted,
                // Explore aggregate
                exploredCount,
                activeLeads,
                templateVersions,
                templatePerformance,
                sourcePerformance,
                leadDetails,
                // Database overview
                totalContacts,
                totalPending,
                totalUnsubscribed,
                totalFailed,
                sourceBreakdown,
                stateBreakdown,
                // GA4 website analytics
                ga4Stats,
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
