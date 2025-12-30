/**
 * PreIntake.ai Functions
 * Handles demo form submissions and lead capture
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const dns = require('dns').promises;

// Ensure Firebase is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Use the dedicated 'preintake' database (separate from default TBP database)
const db = getFirestore('preintake');

// Rate limiting configuration
const MAX_SUBMISSIONS_PER_DAY = 5; // Per IP address
const RATE_LIMIT_COLLECTION = 'rate_limits';

/**
 * Hash IP address for privacy before storing
 */
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip + 'preintake_salt_2025').digest('hex').substring(0, 16);
}

/**
 * Check server-side rate limit by IP
 * Returns { allowed: boolean, remaining: number }
 */
async function checkIPRateLimit(ip) {
    const hashedIP = hashIP(ip);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docId = `${hashedIP}_${today}`;

    try {
        const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { allowed: true, remaining: MAX_SUBMISSIONS_PER_DAY };
        }

        const data = doc.data();
        const remaining = MAX_SUBMISSIONS_PER_DAY - (data.count || 0);
        return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // Allow on error to not block legitimate requests
        return { allowed: true, remaining: MAX_SUBMISSIONS_PER_DAY };
    }
}

/**
 * Record IP submission for rate limiting
 */
async function recordIPSubmission(ip) {
    const hashedIP = hashIP(ip);
    const today = new Date().toISOString().split('T')[0];
    const docId = `${hashedIP}_${today}`;

    try {
        const docRef = db.collection(RATE_LIMIT_COLLECTION).doc(docId);
        await docRef.set({
            count: admin.firestore.FieldValue.increment(1),
            lastSubmission: admin.firestore.FieldValue.serverTimestamp(),
            date: today
        }, { merge: true });
    } catch (error) {
        console.error('Rate limit record error:', error);
    }
}

/**
 * Normalize website URL for duplicate detection
 * Removes trailing slashes, lowercases hostname, removes www prefix
 */
function normalizeWebsiteUrl(url) {
    try {
        const parsed = new URL(url);
        // Lowercase hostname, remove www prefix
        let hostname = parsed.hostname.toLowerCase();
        if (hostname.startsWith('www.')) {
            hostname = hostname.substring(4);
        }
        // Remove trailing slash from pathname
        let pathname = parsed.pathname;
        if (pathname.endsWith('/') && pathname.length > 1) {
            pathname = pathname.slice(0, -1);
        }
        // Return normalized URL (protocol + hostname + pathname)
        return `${parsed.protocol}//${hostname}${pathname === '/' ? '' : pathname}`;
    } catch (e) {
        return url.toLowerCase();
    }
}

/**
 * Find existing lead by normalized website URL
 * Returns { id, data } if found, null otherwise
 */
async function findExistingLead(normalizedUrl) {
    try {
        // Query for leads with matching website (need to check normalized versions)
        const snapshot = await db.collection('preintake_leads')
            .where('normalizedWebsite', '==', normalizedUrl)
            .limit(1)
            .get();

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, data: doc.data() };
        }

        // Also check without normalization field (for older leads)
        // This catches cases where the exact URL matches
        const exactSnapshot = await db.collection('preintake_leads')
            .where('website', '==', normalizedUrl)
            .limit(1)
            .get();

        if (!exactSnapshot.empty) {
            const doc = exactSnapshot.docs[0];
            return { id: doc.id, data: doc.data() };
        }

        // Check with trailing slash variant
        const withSlash = normalizedUrl + '/';
        const slashSnapshot = await db.collection('preintake_leads')
            .where('website', '==', withSlash)
            .limit(1)
            .get();

        if (!slashSnapshot.empty) {
            const doc = slashSnapshot.docs[0];
            return { id: doc.id, data: doc.data() };
        }

        return null;
    } catch (error) {
        console.error('Error checking for existing lead:', error);
        return null; // Allow through on error
    }
}

/**
 * Validate email address format and domain
 * Checks format, common typos, disposable domains, and MX records
 */
async function validateEmail(email) {
    // Basic format validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, reason: 'Invalid email format. Please enter a valid email address.' };
    }

    const domain = email.split('@')[1].toLowerCase();

    // Check for obviously fake/test domains
    const fakeDomains = ['test.com', 'example.com', 'fake.com', 'asdf.com', 'aaa.com', 'abc.com', 'temp.com'];
    if (fakeDomains.includes(domain)) {
        return { isValid: false, reason: 'Please enter your actual business email address.' };
    }

    // Check for disposable email domains
    const disposableDomains = [
        'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
        'throwaway.email', 'fakeinbox.com', 'trashmail.com', 'yopmail.com',
        'sharklasers.com', 'mailnesia.com', 'getairmail.com', 'dispostable.com',
        'tempail.com', 'temp-mail.org', 'getnada.com', 'emailondeck.com',
        'mohmal.com', 'tempmailo.com', 'burnermail.io', 'guerrillamail.org'
    ];
    if (disposableDomains.includes(domain)) {
        return { isValid: false, reason: 'Disposable email addresses are not allowed. Please use your business email.' };
    }

    // Check for common typos in popular domains
    const typoSuggestions = {
        'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com',
        'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com',
        'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yaoo.com': 'yahoo.com',
        'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
        'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlool.com': 'outlook.com'
    };
    if (typoSuggestions[domain]) {
        const suggestion = email.split('@')[0] + '@' + typoSuggestions[domain];
        return { isValid: false, reason: `Did you mean ${suggestion}?` };
    }

    // Verify domain has MX records (can receive email)
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
            console.log(`Email validation: No MX records for ${domain}`);
            return { isValid: false, reason: 'This email domain cannot receive messages. Please check your email address.' };
        }
        console.log(`Email validation: ${domain} has ${mxRecords.length} MX records`);
    } catch (error) {
        // ENOTFOUND means domain doesn't exist
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            console.log(`Email validation: Domain ${domain} not found`);
            return { isValid: false, reason: 'This email domain does not exist. Please check your email address.' };
        }
        // Other DNS errors - allow through but log
        console.error(`Email validation DNS error for ${domain}:`, error.message);
    }

    return { isValid: true };
}

/**
 * Validate that the website is a law firm or attorney website
 * Checks for legal-related keywords in the page content
 */
async function validateLawFirmWebsite(url) {
    // Legal keywords to look for (case-insensitive)
    const legalKeywords = [
        'attorney', 'attorneys', 'lawyer', 'lawyers', 'law firm', 'law office',
        'legal', 'practice area', 'practice areas', 'case evaluation', 'free consultation',
        'personal injury', 'criminal defense', 'family law', 'immigration', 'bankruptcy',
        'estate planning', 'divorce', 'custody', 'dui', 'dwi', 'slip and fall',
        'workers compensation', 'wrongful death', 'medical malpractice', 'car accident',
        'truck accident', 'motorcycle accident', 'pedestrian accident',
        'esq', 'esquire', 'jd', 'juris doctor', 'bar association', 'state bar',
        'legal services', 'legal representation', 'litigation', 'trial lawyer',
        'defense attorney', 'plaintiff', 'defendant', 'settlement', 'verdict',
        'abogado', 'abogados', 'bufete', // Spanish
        'advogado', 'advogados', 'escritório de advocacia' // Portuguese
    ];

    // Keywords that suggest it's NOT a law firm (false positives)
    const excludeKeywords = [
        'buy now', 'add to cart', 'shopping cart', 'checkout', 'product reviews',
        'law enforcement', 'brother-in-law', 'mother-in-law', 'father-in-law',
        'outlaw', 'in-laws', 'lawn care', 'lawn mower'
    ];

    try {
        // Fetch the website with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PreIntake.ai/1.0; +https://preintake.ai)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.log(`Website validation: ${url} returned ${response.status}`);
            // Can't validate, allow through (might be behind auth, CDN issues, etc.)
            return { isValid: true, reason: 'Could not fetch website for validation', confidence: 0 };
        }

        const html = await response.text();
        const lowerHtml = html.toLowerCase();

        // Check for exclude keywords first
        for (const keyword of excludeKeywords) {
            if (lowerHtml.includes(keyword)) {
                console.log(`Website validation: ${url} contains exclude keyword "${keyword}"`);
                // Don't automatically reject, just lower confidence
            }
        }

        // Count matching legal keywords
        let matchCount = 0;
        const matchedKeywords = [];
        for (const keyword of legalKeywords) {
            if (lowerHtml.includes(keyword.toLowerCase())) {
                matchCount++;
                matchedKeywords.push(keyword);
            }
        }

        // Calculate confidence score (0-100)
        const confidence = Math.min(100, (matchCount / 5) * 100); // 5+ keywords = 100%

        console.log(`Website validation: ${url} - ${matchCount} keywords matched, confidence: ${confidence}%`);

        // Require at least 2 legal keywords for validation
        if (matchCount >= 2) {
            return { isValid: true, reason: 'Law firm website verified', confidence, matchedKeywords };
        } else if (matchCount === 1) {
            return { isValid: true, reason: 'Limited legal content detected', confidence, matchedKeywords };
        } else {
            return { isValid: false, reason: 'No legal content detected on website', confidence: 0, matchedKeywords: [] };
        }

    } catch (error) {
        console.error(`Website validation error for ${url}:`, error.message);
        // On error (timeout, network issues), allow through with note
        return { isValid: true, reason: `Validation skipped: ${error.message}`, confidence: 0 };
    }
}

// SMTP configuration for Dreamhost
const smtpUser = defineSecret("PREINTAKE_SMTP_USER");
const smtpPass = defineSecret("PREINTAKE_SMTP_PASS");
const smtpHost = defineString("PREINTAKE_SMTP_HOST", { default: "mail.preintake.ai" });
const smtpPort = defineString("PREINTAKE_SMTP_PORT", { default: "587" });

const FROM_ADDRESS = 'PreIntake.ai <support@preintake.ai>';
const NOTIFY_EMAIL = 'stephen@preintake.ai';

/**
 * Send email via SMTP (Dreamhost)
 */
async function sendEmail(transporter, to, subject, htmlContent) {
    const mailOptions = {
        from: FROM_ADDRESS,
        to: to,
        subject: subject,
        html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
}

/**
 * Generate confirmation email HTML for prospect
 */
function generateProspectEmail(name, website) {
    const firstName = name.split(' ')[0];
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0c1f3f; font-size: 24px; margin-bottom: 10px;">PreIntake.ai</h1>
    </div>

    <p>Hi ${firstName},</p>

    <p>We've received your request to generate a custom PreIntake.ai demo for <strong>${website}</strong>.</p>

    <p>Our system is now:</p>

    <ol style="color: #64748b;">
        <li>
            <strong>Analyzing your website</strong><br>
            Practice areas, positioning, intake signals, and structure
        </li>
        <li>
            <strong>Assembling a practice-specific intake flow</strong><br>
            Screening logic, disqualifiers, and routing behavior
        </li>
        <li>
            <strong>Generating a live demo</strong><br>
            A working intake experience branded to your firm
        </li>
    </ol>

    <p>You'll receive a private link to review your demo shortly. Most demos are ready within <strong>about 5 minutes</strong>, depending on site complexity.</p>

    <p>The demo shows how PreIntake.ai screens leads before they reach your CRM—highlighting which cases move forward, which need more information, and which are declined outright.</p>

    <p>If you have questions or want a second set of eyes on the demo once it's ready, just reply to this email.</p>

    <p style="margin-top: 30px;">
        —<br>
        <strong>Stephen Scott</strong><br>
        PreIntake.ai
    </p>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        AI-Powered Legal Intake<br>
        <a href="https://preintake.ai" style="color: #c9a962;">preintake.ai</a>
    </p>
</body>
</html>
`;
}

// Practice area display names
const PRACTICE_AREA_NAMES = {
    personal_injury: 'Personal Injury',
    immigration: 'Immigration',
    family_law: 'Family Law',
    bankruptcy: 'Bankruptcy',
    criminal_defense: 'Criminal Defense',
    tax: 'Tax / IRS',
    estate_planning: 'Estate Planning',
    employment: 'Employment Law',
    workers_comp: 'Workers\' Compensation',
    real_estate: 'Real Estate',
    other: 'Other'
};

/**
 * Format practice areas for email display
 */
function formatPracticeAreasForEmail(practiceAreas) {
    if (!practiceAreas || !practiceAreas.breakdown) {
        return '<em>Not specified</em>';
    }

    const breakdown = practiceAreas.breakdown;
    const otherName = practiceAreas.otherName || null;
    const sorted = Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1]) // Sort by percentage descending
        .map(([area, pct]) => {
            // Use custom name for "other" if provided
            let name;
            if (area === 'other' && otherName) {
                name = otherName;
            } else {
                name = PRACTICE_AREA_NAMES[area] || area;
            }
            const isPrimary = area === practiceAreas.primaryArea;
            return `<li>${name}: <strong>${pct}%</strong>${isPrimary ? ' ★' : ''}</li>`;
        });

    return `<ul style="margin: 0; padding-left: 20px;">${sorted.join('')}</ul>`;
}

/**
 * Generate notification email HTML for Stephen
 */
function generateNotifyEmail(name, email, website, leadId, practiceAreas) {
    const practiceAreasHtml = formatPracticeAreasForEmail(practiceAreas);
    const primaryArea = practiceAreas?.primaryAreaName || 'Not specified';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #0c1f3f;">New PreIntake.ai Demo Request</h2>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 140px;">Name:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${name}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Website:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${website}" target="_blank">${website}</a></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Primary Area:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #c9a962;">${primaryArea}</strong></td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; vertical-align: top;">Practice Mix:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${practiceAreasHtml}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Lead ID:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${leadId}</td>
        </tr>
    </table>

    <p style="margin-top: 20px;">
        <a href="https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/data/~2Fpreintake_leads~2F${leadId}"
           style="background: #c9a962; color: #0c1f3f; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Firestore
        </a>
    </p>
</body>
</html>
`;
}

/**
 * Submit Demo Request
 * Accepts POST with name, email, website URL
 * Stores lead in Firestore preintake_leads collection
 * Sends confirmation email to prospect and notification to Stephen
 */
const submitDemoRequest = onRequest(
    {
        cors: true,
        region: 'us-west1',
        secrets: [smtpUser, smtpPass]
    },
    async (req, res) => {
        // Only allow POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            // Get client IP for rate limiting
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                           req.headers['x-real-ip'] ||
                           req.connection?.remoteAddress ||
                           req.ip ||
                           'unknown';

            const { name, email, website, practiceAreas } = req.body;

            // Admin bypass for rate limiting
            const ADMIN_EMAILS = ['scscot@gmail.com'];
            const isAdmin = ADMIN_EMAILS.includes((email || '').toLowerCase());

            // Check server-side rate limit (skip for admins)
            if (!isAdmin) {
                const rateLimit = await checkIPRateLimit(clientIP);
                if (!rateLimit.allowed) {
                    console.log(`Rate limit exceeded for IP hash: ${hashIP(clientIP)}`);
                    return res.status(429).json({
                        error: 'Too many requests. Please try again tomorrow.',
                        remaining: 0
                    });
                }
            }

            // Validate required fields
            if (!name || !email || !website) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    required: ['name', 'email', 'website']
                });
            }

            // Practice areas are now optional - they'll be detected by Deep Research
            // and confirmed by the user via the confirmation modal

            // Validate email (format, domain existence, MX records)
            const emailValidation = await validateEmail(email);
            if (!emailValidation.isValid) {
                console.log(`Email validation failed for ${email}: ${emailValidation.reason}`);
                return res.status(400).json({
                    error: emailValidation.reason,
                    field: 'email'
                });
            }

            // Validate website URL
            let websiteUrl;
            try {
                // Add https if not present
                const urlToValidate = website.startsWith('http') ? website : `https://${website}`;
                websiteUrl = new URL(urlToValidate);
            } catch (e) {
                return res.status(400).json({ error: 'Invalid website URL' });
            }

            // Validate that the website is a law firm
            const validation = await validateLawFirmWebsite(websiteUrl.href);
            if (!validation.isValid) {
                console.log(`Website validation failed for ${websiteUrl.href}: ${validation.reason}`);
                return res.status(400).json({
                    error: 'This does not appear to be a law firm or attorney website. Please enter a valid law firm website URL.',
                    details: validation.reason
                });
            }

            // Check for duplicate - only allow ONE demo per law firm website
            // Normalize URL for comparison (remove trailing slash, lowercase hostname)
            const normalizedUrl = normalizeWebsiteUrl(websiteUrl.href);
            const existingLead = await findExistingLead(normalizedUrl);

            if (existingLead) {
                console.log(`Duplicate demo request blocked for ${normalizedUrl} - existing lead: ${existingLead.id}`);

                // If demo is ready, return the existing demo URL
                if (existingLead.data.demoUrl) {
                    return res.status(409).json({
                        error: 'A demo has already been created for this website.',
                        existingDemoUrl: existingLead.data.demoUrl,
                        message: 'You can access your existing demo at the URL provided.'
                    });
                }

                // If demo is still being processed, inform the user
                return res.status(409).json({
                    error: 'A demo request is already being processed for this website.',
                    status: existingLead.data.status,
                    message: 'Please check your email for the demo link, or wait for processing to complete.'
                });
            }

            // Record the submission for rate limiting (only after validation passes)
            await recordIPSubmission(clientIP);

            // Create lead document
            const leadData = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                website: websiteUrl.href,
                normalizedWebsite: normalizedUrl, // For duplicate detection
                status: 'pending', // pending, analyzing, researching, generating_demo, demo_ready
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'landing_page',
                // Self-reported practice areas from form
                practiceAreas: practiceAreas || null,
                // Website validation result
                websiteValidation: {
                    isValid: validation.isValid,
                    confidence: validation.confidence,
                    reason: validation.reason,
                    matchedKeywords: validation.matchedKeywords || []
                },
                // Will be populated by analysis function later
                analysis: null,
                deepResearch: null,
                demoUrl: null,
                // Email tracking
                confirmationSent: false,
                notificationSent: false
            };

            // Store in Firestore
            const docRef = await db.collection('preintake_leads').add(leadData);
            const leadId = docRef.id;

            console.log(`PreIntake lead created: ${leadId} - ${email}`);

            // Create SMTP transporter
            const user = smtpUser.value();
            const pass = smtpPass.value();

            if (!user || !pass) {
                console.error('SMTP credentials not configured');
            } else {
                const transporter = nodemailer.createTransport({
                    host: smtpHost.value(),
                    port: parseInt(smtpPort.value()),
                    secure: false,
                    requireTLS: true, // Force STARTTLS upgrade
                    auth: {
                        user: user,
                        pass: pass
                    },
                    tls: {
                        rejectUnauthorized: false // Allow self-signed certs
                    }
                });

                // Send confirmation email to prospect
                try {
                    const prospectHtml = generateProspectEmail(name.trim(), websiteUrl.href);
                    await sendEmail(
                        transporter,
                        `${name.trim()} <${email.trim().toLowerCase()}>`,
                        'Your AI Intake Demo Is Being Built',
                        prospectHtml
                    );
                    await docRef.update({ confirmationSent: true });
                    console.log(`Confirmation email sent to ${email}`);
                } catch (emailErr) {
                    console.error('Error sending confirmation email:', emailErr.message);
                }

                // Send notification email to Stephen
                try {
                    const notifyHtml = generateNotifyEmail(
                        name.trim(),
                        email.trim().toLowerCase(),
                        websiteUrl.href,
                        leadId,
                        practiceAreas
                    );
                    const primaryAreaLabel = practiceAreas?.primaryAreaName ? ` (${practiceAreas.primaryAreaName})` : '';
                    await sendEmail(
                        transporter,
                        NOTIFY_EMAIL,
                        `New PreIntake Lead: ${name.trim()} - ${websiteUrl.hostname}${primaryAreaLabel}`,
                        notifyHtml
                    );
                    await docRef.update({ notificationSent: true });
                    console.log(`Notification email sent to ${NOTIFY_EMAIL}`);
                } catch (emailErr) {
                    console.error('Error sending notification email:', emailErr.message);
                }
            }

            // Return success with lead ID
            return res.status(200).json({
                success: true,
                message: 'Demo request received',
                leadId: leadId
            });

        } catch (error) {
            console.error('Error submitting demo request:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
);

/**
 * Get firm status for intake page display logic
 * Called by intake page on load to determine Demo vs Live mode
 * Also used during demo request flow to poll for analysis completion
 */
const getPreIntakeFirmStatus = onRequest(
    { region: 'us-west1', cors: true },
    async (req, res) => {
        const leadId = req.query.leadId;
        if (!leadId) {
            return res.status(400).json({ error: 'Missing leadId' });
        }

        try {
            const doc = await db.collection('preintake_leads').doc(leadId).get();

            if (!doc.exists) {
                return res.status(404).json({ error: 'Firm not found' });
            }

            const data = doc.data();

            // Get practice areas - merge Deep Research and initial analysis
            // Initial analysis uses Claude to identify practice areas from nav menu
            // Deep Research scrapes individual practice area pages for more detail
            let practiceAreas = [];
            let primaryArea = null;

            const initialAreas = data.analysis?.practiceAreas || [];
            const deepResearchAreas = data.deepResearch?.practiceAreaDetails
                ? Object.keys(data.deepResearch.practiceAreaDetails)
                : [];

            // Use initial analysis as the primary source (Claude analyzes nav menu)
            // Deep Research often only captures pages it can find via URL patterns
            if (initialAreas.length > 0) {
                // Start with initial analysis (Claude identified these from nav menu)
                practiceAreas = [...initialAreas];

                // Add any Deep Research areas not already in the list
                for (const area of deepResearchAreas) {
                    // Normalize for comparison (case-insensitive, ignore minor differences)
                    const normalizedArea = area.toLowerCase().trim();
                    const exists = practiceAreas.some(a =>
                        a.toLowerCase().trim() === normalizedArea ||
                        a.toLowerCase().includes(normalizedArea) ||
                        normalizedArea.includes(a.toLowerCase())
                    );
                    if (!exists) {
                        practiceAreas.push(area);
                    }
                }

                primaryArea = data.analysis.primaryPracticeArea || practiceAreas[0];
            } else if (deepResearchAreas.length > 0) {
                // No initial analysis, use Deep Research
                practiceAreas = deepResearchAreas;
                primaryArea = deepResearchAreas[0];
            }

            // Return comprehensive status for both demo request flow and intake page
            return res.json({
                // Lead status: pending, analyzing, researching, awaiting_confirmation, generating_demo, demo_ready, analysis_failed
                status: data.status || 'pending',

                // Practice areas (from Deep Research if available, otherwise initial analysis)
                practiceAreas: practiceAreas,
                primaryArea: primaryArea,

                // Firm info from analysis
                firmName: data.analysis?.firmName || 'Your Firm',
                firmWebsite: data.website || null,
                location: data.analysis?.location || null,

                // For intake page display logic
                isLiveMode: data.subscriptionStatus === 'active',

                // Demo URL if ready
                demoUrl: data.demoUrl || null,

                // Error info if failed
                error: data.analysis?.error || null
            });
        } catch (error) {
            console.error('Error fetching firm status:', error);
            return res.status(500).json({ error: 'Internal error' });
        }
    }
);

/**
 * Confirm practice areas after Deep Research detection
 * User can modify the detected practice areas and set a primary area
 * Triggers demo generation after confirmation
 */
const confirmPracticeAreas = onRequest(
    {
        cors: true,
        region: 'us-west1'
    },
    async (req, res) => {
        // Only allow POST
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        try {
            const { leadId, practiceAreas, primaryArea } = req.body;

            // Validate required fields
            if (!leadId) {
                return res.status(400).json({ error: 'Missing leadId' });
            }

            if (!practiceAreas || !Array.isArray(practiceAreas) || practiceAreas.length === 0) {
                return res.status(400).json({ error: 'At least one practice area is required' });
            }

            if (!primaryArea) {
                return res.status(400).json({ error: 'Primary practice area is required' });
            }

            // Verify primary area is in the list
            if (!practiceAreas.includes(primaryArea)) {
                return res.status(400).json({ error: 'Primary area must be one of the selected practice areas' });
            }

            // Get the lead document
            const leadRef = db.collection('preintake_leads').doc(leadId);
            const doc = await leadRef.get();

            if (!doc.exists) {
                return res.status(404).json({ error: 'Lead not found' });
            }

            const data = doc.data();

            // Verify lead is in a valid state for confirmation
            // 'awaiting_confirmation' is the expected state after Deep Research completes
            if (data.status !== 'awaiting_confirmation') {
                return res.status(400).json({
                    error: 'Lead is not ready for practice area confirmation',
                    currentStatus: data.status
                });
            }

            // Update the lead with confirmed practice areas
            await leadRef.update({
                // Store user-confirmed practice areas separately from auto-detected ones
                confirmedPracticeAreas: {
                    areas: practiceAreas,
                    primaryArea: primaryArea,
                    confirmedAt: admin.firestore.FieldValue.serverTimestamp()
                },
                // Update analysis to use confirmed primary area
                'analysis.primaryPracticeArea': primaryArea,
                // Trigger demo generation
                status: 'generating_demo',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Practice areas confirmed for lead ${leadId}: ${practiceAreas.join(', ')} (primary: ${primaryArea})`);

            return res.status(200).json({
                success: true,
                message: 'Practice areas confirmed, demo generation started',
                leadId: leadId
            });

        } catch (error) {
            console.error('Error confirming practice areas:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
);

module.exports = {
    submitDemoRequest,
    getPreIntakeFirmStatus,
    confirmPracticeAreas
};
