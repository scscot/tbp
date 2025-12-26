/**
 * PI Intake Configuration File
 *
 * This file contains firm-specific settings for the PI intake form.
 * Each law firm deployment should customize these values.
 *
 * SETUP INSTRUCTIONS:
 * 1. Replace all placeholder values with firm-specific information
 * 2. Set up your proxy endpoint to relay requests to Claude API
 * 3. Configure webhook URL to receive qualified leads
 * 4. Adjust scoring thresholds based on firm's intake criteria
 */

window.PI_INTAKE_CONFIG = {

    // =========================================================================
    // FIRM IDENTITY
    // =========================================================================

    /**
     * Your law firm's name as it should appear in the intake form
     */
    firmName: 'YOUR LAW FIRM NAME',

    /**
     * Firm's primary phone number (displayed on results/decline screens)
     */
    firmPhone: '(555) 555-5555',

    /**
     * Firm's website URL
     */
    firmWebsite: 'https://www.yourfirm.com',

    /**
     * URL to firm's logo image (displayed in header)
     * Recommended size: 200x60px, PNG or SVG with transparent background
     */
    firmLogo: null, // e.g., 'https://www.yourfirm.com/logo.png'

    /**
     * Primary brand color (hex code)
     * Used for buttons, progress bars, and accents
     */
    primaryColor: '#1a73e8',

    /**
     * Secondary brand color (hex code)
     * Used for hover states and secondary elements
     */
    secondaryColor: '#1557b0',


    // =========================================================================
    // API CONFIGURATION
    // =========================================================================

    /**
     * REQUIRED: Your proxy endpoint URL
     *
     * The intake form cannot call Claude API directly from the browser due to
     * CORS restrictions and API key exposure. You must set up a server-side
     * proxy that:
     * 1. Receives POST requests from this form
     * 2. Adds your Anthropic API key
     * 3. Forwards to https://api.anthropic.com/v1/messages
     * 4. Returns the response
     *
     * Example proxy endpoints:
     * - Firebase Function: https://us-central1-yourproject.cloudfunctions.net/claudeProxy
     * - Vercel Serverless: https://yourapp.vercel.app/api/claude
     * - AWS Lambda: https://xxxxxx.execute-api.us-west-2.amazonaws.com/prod/claude
     */
    proxyUrl: 'https://dpm-proxy-312163687148.us-central1.run.app/api/chat',

    /**
     * Claude model to use
     * Options: 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'
     * Recommended: claude-sonnet-4-20250514 for best quality
     */
    model: 'claude-sonnet-4-20250514',

    /**
     * Maximum tokens for Claude response
     * Higher values allow longer responses but increase cost
     */
    maxTokens: 1024,


    // =========================================================================
    // WEBHOOK CONFIGURATION (Lead Delivery)
    // =========================================================================

    /**
     * Webhook URL to receive qualified leads
     *
     * When a user completes the intake, their data is sent to this endpoint
     * as a POST request with JSON payload.
     *
     * Common integrations:
     * - Zapier: https://hooks.zapier.com/hooks/catch/xxxxx/xxxxxx/
     * - Lawmatics: Use Zapier webhook
     * - Clio Grow: Use Zapier webhook or direct API
     * - Make.com: https://hook.us1.make.com/xxxxx
     * - Custom CRM: Your own endpoint
     *
     * Set to null to disable webhook (data displayed on results screen only)
     */
    webhookUrl: null,

    /**
     * Optional API key for webhook authentication
     * Sent as X-API-Key header with webhook requests
     */
    webhookKey: null,

    /**
     * Send webhook for which routing categories?
     * Options: 'all', 'qualified', 'green_only'
     * - 'all': Send all leads (green, yellow, red)
     * - 'qualified': Send green and yellow only
     * - 'green_only': Send only green (highest quality) leads
     */
    webhookFilter: 'qualified',


    // =========================================================================
    // SCHEDULING INTEGRATION
    // =========================================================================

    /**
     * URL for consultation scheduling (shown on green/yellow results)
     *
     * Common options:
     * - Calendly: https://calendly.com/yourfirm/consultation
     * - Acuity: https://yourfirm.acuityscheduling.com/
     * - Lawmatics: Your Lawmatics booking link
     * - Custom: Your firm's scheduling page
     *
     * Set to null to show "We'll contact you" instead of scheduling button
     */
    scheduleUrl: null,

    /**
     * Text for the scheduling button
     */
    scheduleButtonText: 'Schedule Your Free Consultation',


    // =========================================================================
    // SCORING THRESHOLDS
    // =========================================================================

    /**
     * Minimum score for GREEN routing (book consultation immediately)
     * Scale: 0-100
     * Default: 70
     */
    greenThreshold: 70,

    /**
     * Minimum score for YELLOW routing (collect documents, then contact)
     * Cases below this threshold are RED (decline)
     * Scale: 0-100
     * Default: 40
     */
    yellowThreshold: 40,


    // =========================================================================
    // FIRM-SPECIFIC DISQUALIFIERS
    // =========================================================================

    /**
     * Statute of limitations cutoff in months
     * California PI default: 24 months (2 years)
     * Cases older than this are automatically RED
     */
    solCutoffMonths: 24,

    /**
     * Flag cases as urgent when SOL is within this many months
     * Default: 6 months
     */
    solUrgencyMonths: 6,

    /**
     * Accept cases with shared fault?
     * true = Accept (lower score)
     * false = Automatic RED if client admits any fault
     */
    acceptSharedFault: true,

    /**
     * Accept cases with no medical treatment?
     * true = Accept (much lower score)
     * false = Automatic RED if no treatment received
     */
    acceptNoTreatment: false,

    /**
     * Minimum estimated damages threshold (in dollars)
     * Cases below this are RED
     * Set to 0 to accept all damage amounts
     */
    minDamagesThreshold: 0,

    /**
     * Score boost for commercial defendants (Uber, delivery, company vehicles)
     * These cases often have deeper pockets
     * Default: 15 points
     */
    commercialDefendantBoost: 15,

    /**
     * Score boost for police report on file
     * Default: 10 points
     */
    policeReportBoost: 10,

    /**
     * Score boost for photo/video evidence
     * Default: 5 points
     */
    photoEvidenceBoost: 5,

    /**
     * Score boost for witness availability
     * Default: 5 points
     */
    witnessBoost: 5,


    // =========================================================================
    // CASE TYPE SETTINGS
    // =========================================================================

    /**
     * Which case types does your firm accept?
     * Unaccepted types will be automatically RED with referral message
     */
    acceptedCaseTypes: [
        'rear_end',
        't_bone',
        'head_on',
        'hit_and_run',
        'pedestrian',
        'bicycle',
        'slip_and_fall',
        'dog_bite',
        'wrongful_death',
        'other'
    ],

    /**
     * Case types that receive score boost (firm's specialty areas)
     * Default: 10 point boost
     */
    specialtyCaseTypes: [],
    specialtyBoost: 10,


    // =========================================================================
    // COMPLIANCE & DISCLAIMERS
    // =========================================================================

    /**
     * State for jurisdiction-specific compliance
     * Affects SOL calculations and disclaimer language
     */
    state: 'California',

    /**
     * Custom disclaimer text (appended to standard disclaimer)
     * Leave empty to use standard disclaimer only
     */
    customDisclaimer: '',

    /**
     * Privacy policy URL (linked in footer)
     */
    privacyPolicyUrl: null,

    /**
     * Terms of service URL (linked in footer)
     */
    termsUrl: null,


    // =========================================================================
    // DECLINE SCREEN RESOURCES
    // =========================================================================

    /**
     * Resources shown to declined (RED) leads
     * These should be general resources, not legal advice
     */
    declineResources: [
        {
            title: 'California State Bar Lawyer Referral Service',
            description: 'Find a licensed attorney in your area',
            phone: '1-866-442-2529',
            url: 'https://www.calbar.ca.gov/Public/Need-Legal-Help/Lawyer-Referral-Service'
        },
        {
            title: 'California Courts Self-Help Center',
            description: 'Free legal information and resources',
            url: 'https://www.courts.ca.gov/selfhelp.htm'
        }
    ],


    // =========================================================================
    // ANALYTICS (Optional)
    // =========================================================================

    /**
     * Google Analytics 4 Measurement ID
     * Format: G-XXXXXXXXXX
     * Set to null to disable
     */
    ga4MeasurementId: null,

    /**
     * Custom event tracking function
     * Called at key points: start, complete, decline
     * Receives: { event: string, data: object }
     */
    onAnalyticsEvent: null
};


// =========================================================================
// CONFIGURATION VALIDATION
// =========================================================================

(function validateConfig() {
    const config = window.PI_INTAKE_CONFIG;
    const warnings = [];

    if (config.proxyUrl === 'YOUR_PROXY_ENDPOINT_URL') {
        warnings.push('proxyUrl is not configured - API calls will fail');
    }

    if (config.firmName === 'YOUR LAW FIRM NAME') {
        warnings.push('firmName is using default value');
    }

    if (!config.scheduleUrl && !config.webhookUrl) {
        warnings.push('Neither scheduleUrl nor webhookUrl is configured - leads cannot be captured');
    }

    if (config.greenThreshold <= config.yellowThreshold) {
        warnings.push('greenThreshold should be greater than yellowThreshold');
    }

    if (warnings.length > 0) {
        console.warn('[PI Intake Config] Configuration warnings:');
        warnings.forEach(w => console.warn('  - ' + w));
    }
})();
