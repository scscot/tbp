/**
 * Government/Institutional Contact Filter Utilities
 *
 * Shared module for detecting and filtering out government agencies, courts,
 * public defenders, prosecutors, and other institutional contacts that are
 * not valid targets for PreIntake.ai marketing.
 *
 * Also includes state name normalization utilities.
 *
 * Usage:
 *   const { isGovernmentContact, normalizeState } = require('./gov-filter-utils');
 *   if (isGovernmentContact(email, firmName)) {
 *       // Skip this contact
 *   }
 *   const stateAbbrev = normalizeState('Mississippi'); // Returns 'MS'
 */

// ============================================================================
// STATE NAME TO ABBREVIATION MAPPING
// ============================================================================

const STATE_NAME_TO_ABBREV = {
    'alabama': 'AL',
    'alaska': 'AK',
    'arizona': 'AZ',
    'arkansas': 'AR',
    'california': 'CA',
    'colorado': 'CO',
    'connecticut': 'CT',
    'delaware': 'DE',
    'florida': 'FL',
    'georgia': 'GA',
    'hawaii': 'HI',
    'idaho': 'ID',
    'illinois': 'IL',
    'indiana': 'IN',
    'iowa': 'IA',
    'kansas': 'KS',
    'kentucky': 'KY',
    'louisiana': 'LA',
    'maine': 'ME',
    'maryland': 'MD',
    'massachusetts': 'MA',
    'michigan': 'MI',
    'minnesota': 'MN',
    'mississippi': 'MS',
    'missouri': 'MO',
    'montana': 'MT',
    'nebraska': 'NE',
    'nevada': 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    'ohio': 'OH',
    'oklahoma': 'OK',
    'oregon': 'OR',
    'pennsylvania': 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    'tennessee': 'TN',
    'texas': 'TX',
    'utah': 'UT',
    'vermont': 'VT',
    'virginia': 'VA',
    'washington': 'WA',
    'west virginia': 'WV',
    'wisconsin': 'WI',
    'wyoming': 'WY',
    'district of columbia': 'DC',
    'washington dc': 'DC',
    'washington d.c.': 'DC',
    'd.c.': 'DC',
    'dc': 'DC',
    // Common variations
    'n. carolina': 'NC',
    'n carolina': 'NC',
    's. carolina': 'SC',
    's carolina': 'SC',
    'n. dakota': 'ND',
    'n dakota': 'ND',
    's. dakota': 'SD',
    's dakota': 'SD',
    'w. virginia': 'WV',
    'w virginia': 'WV',
    'n. hampshire': 'NH',
    'n hampshire': 'NH',
    'n. jersey': 'NJ',
    'n jersey': 'NJ',
    'n. mexico': 'NM',
    'n mexico': 'NM',
    'n. york': 'NY',
    'n york': 'NY',
};

// Valid two-letter state abbreviations for validation
const VALID_STATE_ABBREVS = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

/**
 * Normalize a state name to its two-letter abbreviation
 * @param {string} state - State name or abbreviation
 * @param {string} defaultState - Default state if normalization fails
 * @returns {string} Two-letter state abbreviation
 */
function normalizeState(state, defaultState = '') {
    if (!state) return defaultState;

    const trimmed = state.trim();
    const upper = trimmed.toUpperCase();

    // If already a valid 2-letter abbreviation, return it
    if (trimmed.length === 2 && VALID_STATE_ABBREVS.has(upper)) {
        return upper;
    }

    // Look up full state name
    const lower = trimmed.toLowerCase();
    if (STATE_NAME_TO_ABBREV[lower]) {
        return STATE_NAME_TO_ABBREV[lower];
    }

    // If it's already uppercase and 2 chars, might be valid even if not in our list
    if (trimmed.length === 2 && /^[A-Z]{2}$/.test(upper)) {
        return upper;
    }

    // Return default if we can't normalize
    return defaultState || trimmed;
}

// Email domain patterns that indicate government/institutional contacts
const GOV_EMAIL_PATTERNS = [
    /\.gov$/i,                    // Federal .gov
    /\.gov\./i,                   // .gov subdomains
    /\.state\.\w+$/i,             // .state.XX (state government)
    /\.\w{2}\.us$/i,              // .XX.us (state/local government)
    /\.mil$/i,                    // Military
    /\.mil\./i,                   // Military subdomains
    /@.*county/i,                 // County government emails
    /@.*\.co\.\w{2}\./i,          // County format: .co.XX.us
    /@courts?\./i,                // Court systems
    /@.*judicial/i,               // Judicial systems
];

// Firm name patterns that indicate government/institutional contacts
const GOV_FIRM_PATTERNS = [
    // Social Security Administration
    { pattern: /social security/i },
    { pattern: /\bssa\b/i },

    // Public Defenders
    { pattern: /public defender/i },
    { pattern: /indigent defense/i },
    { pattern: /assigned counsel/i },

    // Legal Aid (non-profit, not private practice)
    { pattern: /legal aid/i },
    { pattern: /legal services corporation/i },

    // Prosecutors / District Attorneys
    { pattern: /district attorney/i },
    { pattern: /\bda\s*office\b/i },
    { pattern: /\bda\s*'?s\s*office\b/i },
    { pattern: /prosecutor/i },
    { pattern: /state attorney/i },
    { pattern: /solicitor general/i },
    { pattern: /commonwealth attorney/i },
    { pattern: /county attorney(?!'s fee)/i },  // Exclude "county attorney's fee"

    // Attorney General
    { pattern: /attorney general/i },
    { pattern: /\bag\s*office\b/i },

    // Government Departments/Agencies
    { pattern: /\bdepartment of\b/i },
    { pattern: /^state of\s/i },
    { pattern: /^county of\s/i },
    { pattern: /^city of\s/i },
    { pattern: /^town of\s/i },
    { pattern: /^village of\s/i },
    { pattern: /\bstate\s+government\b/i },
    { pattern: /\bfederal\s+government\b/i },

    // Courts and Judicial
    { pattern: /\bcourt\b/i, exclude: /courtney|courthouse|courtland|courtyard|court\s*house|court\s*yard|courtside|food\s*court/i },
    { pattern: /\bjudicial\b/i },
    { pattern: /\bmagistrate\b/i },
    { pattern: /\bjudge\b/i, exclude: /judge\s+advocate/i },  // Allow JAG corps private attorneys
    { pattern: /\bclerk of\b/i },

    // Military
    { pattern: /\bu\.?s\.?\s*(army|navy|air force|marine|coast guard)/i },
    { pattern: /\bmilitary\s+(legal|law)/i },
    { pattern: /\bjag\s*(corps|office)\b/i },
    { pattern: /armed forces/i },

    // Veterans Affairs
    { pattern: /veterans?\s*(admin|affairs|administration)/i },
    { pattern: /\bva\s*(hospital|medical|healthcare|regional)/i },
    { pattern: /\bdva\b/i },

    // Other Government
    { pattern: /\birs\b/i },
    { pattern: /internal revenue/i },
    { pattern: /\bfbi\b/i },
    { pattern: /\bdoj\b/i },
    { pattern: /\bdhs\b/i },
    { pattern: /\bice\b(?!\s*cream)/i },  // Immigration and Customs, not ice cream
    { pattern: /\buscis\b/i },
    { pattern: /homeland security/i },
    { pattern: /\bftc\b/i },
    { pattern: /\bsec\b(?!\s*(and|tion|urity))/i },  // SEC but not "section" or "security"
    { pattern: /\bepa\b/i },
    { pattern: /\bhud\b/i },
    { pattern: /\beeoc\b/i },
    { pattern: /\bnlrb\b/i },
    { pattern: /\bosha\b/i },

    // Schools/Education (not private practice)
    { pattern: /\bschool\s*(district|board)\b/i },
    { pattern: /\bpublic\s*schools?\b/i },
    { pattern: /\buniversity\b(?!\s*(of\s+)?(law|legal))/i },  // University but allow "University of X Law"

    // Corrections/Prisons
    { pattern: /\bprison\b/i },
    { pattern: /\bcorrections?\b/i },
    { pattern: /\bpenitentiary\b/i },
    { pattern: /\bjail\b/i },
    { pattern: /\bdetention\s*center\b/i },
];

/**
 * Check if an email address belongs to a government/institutional domain
 * @param {string} email - Email address to check
 * @returns {boolean} True if government email
 */
function isGovernmentEmail(email) {
    if (!email) return false;
    const emailLower = email.toLowerCase();

    for (const pattern of GOV_EMAIL_PATTERNS) {
        if (pattern.test(emailLower)) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a firm name indicates a government/institutional organization
 * @param {string} firmName - Firm/organization name to check
 * @returns {boolean} True if government organization
 */
function isGovernmentFirm(firmName) {
    if (!firmName) return false;

    for (const { pattern, exclude } of GOV_FIRM_PATTERNS) {
        if (pattern.test(firmName)) {
            // Check exclusion pattern if exists
            if (exclude && exclude.test(firmName)) {
                continue;
            }
            return true;
        }
    }
    return false;
}

/**
 * Check if a contact is a government/institutional contact
 * @param {string} email - Email address
 * @param {string} firmName - Firm/organization name
 * @returns {boolean} True if government contact (should be filtered)
 */
function isGovernmentContact(email, firmName) {
    return isGovernmentEmail(email) || isGovernmentFirm(firmName);
}

/**
 * Get the category of government contact (for logging/reporting)
 * @param {string} email - Email address
 * @param {string} firmName - Firm/organization name
 * @returns {string|null} Category name or null if not government
 */
function getGovernmentCategory(email, firmName) {
    const emailLower = (email || '').toLowerCase();
    const firmLower = (firmName || '').toLowerCase();

    // Check email patterns
    if (/\.gov$/i.test(emailLower)) return 'federal_gov';
    if (/\.mil$/i.test(emailLower)) return 'military';
    if (/\.state\./i.test(emailLower) || /\.\w{2}\.us$/i.test(emailLower)) return 'state_gov';
    if (/@.*county/i.test(emailLower)) return 'county_gov';
    if (/@courts?\./i.test(emailLower)) return 'court';

    // Check firm patterns
    if (/social security|\bssa\b/i.test(firmLower)) return 'ssa';
    if (/public defender|indigent defense/i.test(firmLower)) return 'public_defender';
    if (/legal aid/i.test(firmLower)) return 'legal_aid';
    if (/district attorney|prosecutor|state attorney/i.test(firmLower)) return 'prosecutor';
    if (/attorney general/i.test(firmLower)) return 'attorney_general';
    if (/\bcourt\b/i.test(firmLower) && !/courtney|courthouse/i.test(firmLower)) return 'court';
    if (/department of|^state of|^county of|^city of/i.test(firmLower)) return 'govt_agency';
    if (/veterans|^va\s/i.test(firmLower)) return 'va';
    if (/\b(army|navy|air force|marine|military)\b/i.test(firmLower)) return 'military';

    // Generic government check
    if (isGovernmentContact(email, firmName)) return 'other_govt';

    return null;
}

// ============================================================================
// EMAIL CLEANING UTILITIES
// ============================================================================

/**
 * Clean and validate an email address
 * Handles common data quality issues from bar association sources:
 * - Removes whitespace (e.g., "john@ example.com" → "john@example.com")
 * - Takes first email if multiple are present (semicolon/comma separated)
 * - Lowercases the email
 * - Returns null if email is invalid after cleaning
 *
 * @param {string} email - Raw email address to clean
 * @returns {string|null} Cleaned email or null if invalid
 */
function cleanEmail(email) {
    if (!email || typeof email !== 'string') return null;

    // Trim and remove all internal whitespace
    let cleaned = email.trim().replace(/\s+/g, '');

    // If multiple emails separated by semicolon or comma, take the first one
    if (cleaned.includes(';')) {
        cleaned = cleaned.split(';')[0].trim();
    }
    if (cleaned.includes(',')) {
        cleaned = cleaned.split(',')[0].trim();
    }

    // Lowercase
    cleaned = cleaned.toLowerCase();

    // Basic email format validation
    // Must have exactly one @, something before it, and a dot after it
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleaned)) {
        return null;
    }

    return cleaned;
}

/**
 * Validate email format without cleaning
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

module.exports = {
    isGovernmentContact,
    isGovernmentEmail,
    isGovernmentFirm,
    getGovernmentCategory,
    normalizeState,
    cleanEmail,
    isValidEmail,
    GOV_EMAIL_PATTERNS,
    GOV_FIRM_PATTERNS,
    STATE_NAME_TO_ABBREV,
    VALID_STATE_ABBREVS
};
