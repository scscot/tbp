/**
 * PreIntake.ai Deep Research Functions
 * Performs comprehensive website research after initial analysis
 * Extracts attorney bios, practice area details, case results, and testimonials
 */

const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

// Secrets
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Constants
const FETCH_TIMEOUT = 15000; // 15 seconds per page
const MAX_PAGES = 15; // Maximum pages to scrape
const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB per page

// URL patterns for page type detection
const PAGE_PATTERNS = {
    attorneys: [
        '/attorney', '/attorneys', '/lawyer', '/lawyers',
        '/our-team', '/team', '/about-us', '/about',
        '/staff', '/people', '/professionals', '/partners'
    ],
    practiceAreas: [
        '/practice', '/practice-area', '/services', '/areas-of-practice',
        '/what-we-do', '/legal-services', '/expertise', '/specialties'
    ],
    results: [
        '/results', '/case-results', '/verdicts', '/settlements',
        '/wins', '/successes', '/track-record', '/outcomes'
    ],
    testimonials: [
        '/testimonials', '/reviews', '/client-reviews', '/what-clients-say',
        '/client-testimonials', '/feedback', '/success-stories'
    ],
    contact: [
        '/contact', '/contact-us', '/get-in-touch', '/reach-us',
        '/locations', '/offices', '/find-us'
    ]
};

/**
 * Main deep research function - called after initial analysis completes
 */
async function performDeepResearch(websiteUrl, initialAnalysis) {
    console.log(`Starting deep research for: ${websiteUrl}`);

    const baseUrl = new URL(websiteUrl);
    const baseOrigin = baseUrl.origin;

    // Fetch homepage to discover links
    const homepageHtml = await fetchPage(websiteUrl);
    if (!homepageHtml) {
        console.log('Could not fetch homepage for deep research');
        return createEmptyResearch();
    }

    // Discover internal pages
    const discoveredPages = discoverPages(homepageHtml, baseOrigin);
    console.log(`Discovered ${Object.values(discoveredPages).flat().length} internal pages`);

    // Scrape pages by type
    const scrapedData = {
        attorneys: [],
        practiceAreas: [],
        results: [],
        testimonials: [],
        firmInfo: {}
    };

    // Scrape attorney pages
    for (const url of discoveredPages.attorneys.slice(0, 5)) {
        try {
            const html = await fetchPage(url);
            if (html) {
                const attorneys = extractAttorneys(html, url);
                scrapedData.attorneys.push(...attorneys);
            }
        } catch (err) {
            console.log(`Error scraping attorney page ${url}: ${err.message}`);
        }
    }

    // Scrape practice area pages
    for (const url of discoveredPages.practiceAreas.slice(0, 5)) {
        try {
            const html = await fetchPage(url);
            if (html) {
                const areas = extractPracticeAreas(html, url);
                scrapedData.practiceAreas.push(...areas);
            }
        } catch (err) {
            console.log(`Error scraping practice area page ${url}: ${err.message}`);
        }
    }

    // Scrape results pages
    for (const url of discoveredPages.results.slice(0, 3)) {
        try {
            const html = await fetchPage(url);
            if (html) {
                const results = extractCaseResults(html);
                scrapedData.results.push(...results);
            }
        } catch (err) {
            console.log(`Error scraping results page ${url}: ${err.message}`);
        }
    }

    // Scrape testimonial pages
    for (const url of discoveredPages.testimonials.slice(0, 2)) {
        try {
            const html = await fetchPage(url);
            if (html) {
                const testimonials = extractTestimonials(html);
                scrapedData.testimonials.push(...testimonials);
            }
        } catch (err) {
            console.log(`Error scraping testimonial page ${url}: ${err.message}`);
        }
    }

    // Also extract testimonials from homepage (often present)
    const homepageTestimonials = extractTestimonials(homepageHtml);
    scrapedData.testimonials.push(...homepageTestimonials);

    // Extract firm info from about page or homepage
    const aboutUrl = discoveredPages.attorneys.find(u =>
        u.includes('/about') || u.includes('/about-us')
    );
    if (aboutUrl) {
        try {
            const aboutHtml = await fetchPage(aboutUrl);
            if (aboutHtml) {
                scrapedData.firmInfo = extractFirmInfo(aboutHtml);
            }
        } catch (err) {
            console.log(`Error scraping about page: ${err.message}`);
        }
    }

    // If no firm info from about page, try homepage
    if (!scrapedData.firmInfo.description) {
        scrapedData.firmInfo = extractFirmInfo(homepageHtml);
    }

    // Use Claude to structure and enhance the data
    const structuredData = await structureWithClaude(scrapedData, initialAnalysis);

    // Calculate pages analyzed
    const pagesAnalyzed = 1 + // homepage
        discoveredPages.attorneys.slice(0, 5).length +
        discoveredPages.practiceAreas.slice(0, 5).length +
        discoveredPages.results.slice(0, 3).length +
        discoveredPages.testimonials.slice(0, 2).length;

    return {
        ...structuredData,
        pagesAnalyzed,
        discoveredUrls: {
            attorneys: discoveredPages.attorneys.slice(0, 5),
            practiceAreas: discoveredPages.practiceAreas.slice(0, 5),
            results: discoveredPages.results.slice(0, 3),
            testimonials: discoveredPages.testimonials.slice(0, 2)
        }
    };
}

/**
 * Fetch a page with timeout
 */
async function fetchPage(url) {
    try {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Fetch timed out')), FETCH_TIMEOUT);
        });

        const fetchPromise = fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PreIntakeBot/1.0; +https://preintake.ai)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            timeout: FETCH_TIMEOUT,
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
            console.log(`HTTP ${response.status} for ${url}`);
            return null;
        }

        let html = await response.text();
        if (html.length > MAX_HTML_SIZE) {
            html = html.substring(0, MAX_HTML_SIZE);
        }

        return html;
    } catch (err) {
        console.log(`Fetch error for ${url}: ${err.message}`);
        return null;
    }
}

/**
 * Discover internal pages from homepage
 */
function discoverPages(html, baseOrigin) {
    const $ = cheerio.load(html);
    const discovered = {
        attorneys: [],
        practiceAreas: [],
        results: [],
        testimonials: [],
        contact: []
    };

    const seenUrls = new Set();

    $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        // Skip external links, anchors, and special protocols
        if (href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:')) {
            return;
        }

        // Resolve relative URLs
        let fullUrl;
        try {
            fullUrl = new URL(href, baseOrigin).href;
        } catch {
            return;
        }

        // Only process same-origin links
        if (!fullUrl.startsWith(baseOrigin)) {
            return;
        }

        // Skip if already seen
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // Categorize by URL pattern
        const path = new URL(fullUrl).pathname.toLowerCase();

        for (const [category, patterns] of Object.entries(PAGE_PATTERNS)) {
            for (const pattern of patterns) {
                if (path.includes(pattern)) {
                    discovered[category].push(fullUrl);
                    break;
                }
            }
        }
    });

    return discovered;
}

/**
 * Extract attorney information from a page
 */
function extractAttorneys(html, pageUrl) {
    const $ = cheerio.load(html);
    const attorneys = [];

    // Remove scripts and styles
    $('script, style, noscript, nav, footer, header').remove();

    // Try to find attorney cards/sections
    const attorneySelectors = [
        '.attorney', '.lawyer', '.team-member', '.staff-member',
        '[class*="attorney"]', '[class*="lawyer"]', '[class*="team"]',
        '.partner', '.associate', '.counsel'
    ];

    for (const selector of attorneySelectors) {
        $(selector).each((i, el) => {
            const $el = $(el);

            // Extract name
            const name = $el.find('h1, h2, h3, h4, .name, [class*="name"]').first().text().trim() ||
                        $el.find('strong, b').first().text().trim();

            if (!name || name.length > 100) return;

            // Extract title
            const title = $el.find('.title, .position, .role, [class*="title"]').first().text().trim() ||
                         $el.find('em, i, .subtitle').first().text().trim();

            // Extract bio
            const bio = $el.find('p, .bio, .description, [class*="bio"]').first().text().trim();

            // Extract photo
            const photo = $el.find('img').first().attr('src');
            let photoUrl = null;
            if (photo) {
                try {
                    photoUrl = new URL(photo, pageUrl).href;
                } catch {}
            }

            // Extract email
            const emailLink = $el.find('a[href^="mailto:"]').attr('href');
            const email = emailLink ? emailLink.replace('mailto:', '').split('?')[0] : null;

            // Extract practice areas from content
            const content = $el.text().toLowerCase();
            const practiceAreas = detectPracticeAreasFromText(content);

            if (name && !attorneys.find(a => a.name === name)) {
                attorneys.push({
                    name,
                    title: title || null,
                    bio: bio ? bio.substring(0, 500) : null,
                    photoUrl,
                    email,
                    practiceAreas
                });
            }
        });
    }

    // If no structured attorney cards found, try to extract from general content
    if (attorneys.length === 0) {
        // Look for heading + paragraph patterns
        $('h1, h2, h3').each((i, el) => {
            const $heading = $(el);
            const headingText = $heading.text().trim();

            // Check if heading looks like a name (2-4 words, capitalized)
            const words = headingText.split(/\s+/);
            if (words.length >= 2 && words.length <= 5) {
                const isName = words.every(w => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]\.$/.test(w));
                if (isName) {
                    const $next = $heading.next('p, div');
                    const bio = $next.text().trim();

                    // Find nearby image
                    const $container = $heading.parent();
                    const photo = $container.find('img').first().attr('src');
                    let photoUrl = null;
                    if (photo) {
                        try {
                            photoUrl = new URL(photo, pageUrl).href;
                        } catch {}
                    }

                    if (!attorneys.find(a => a.name === headingText)) {
                        attorneys.push({
                            name: headingText,
                            title: null,
                            bio: bio ? bio.substring(0, 500) : null,
                            photoUrl,
                            email: null,
                            practiceAreas: []
                        });
                    }
                }
            }
        });
    }

    return attorneys.slice(0, 10); // Limit to 10 attorneys
}

/**
 * Extract practice area information from a page
 */
function extractPracticeAreas(html, pageUrl) {
    const $ = cheerio.load(html);
    const areas = [];

    // Remove scripts and styles
    $('script, style, noscript, nav, footer, header').remove();

    // Get page title for context
    const pageTitle = $('h1').first().text().trim() || $('title').text().trim();

    // Extract main content
    const content = $('main, article, .content, #content, .main').first().text().trim() ||
                   $('body').text().trim();

    // Extract description (first meaningful paragraph)
    const description = $('main p, article p, .content p').first().text().trim() ||
                       $('p').first().text().trim();

    // Find sub-practice areas from lists and links
    const subAreas = [];
    $('ul li a, ol li a, .practice-area a, [class*="service"] a').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 3 && text.length < 100) {
            subAreas.push(text);
        }
    });

    if (pageTitle) {
        areas.push({
            name: pageTitle,
            description: description ? description.substring(0, 500) : null,
            subAreas: [...new Set(subAreas)].slice(0, 10)
        });
    }

    return areas;
}

/**
 * Extract case results from a page
 */
function extractCaseResults(html) {
    const $ = cheerio.load(html);
    const results = [];

    // Remove scripts and styles
    $('script, style, noscript').remove();

    // Look for dollar amounts
    const text = $('body').text();
    const moneyPattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B|K))?/gi;
    const amounts = text.match(moneyPattern) || [];

    // Look for result cards/items
    const resultSelectors = [
        '.result', '.case-result', '.verdict', '.settlement',
        '[class*="result"]', '[class*="verdict"]', '[class*="settlement"]',
        '.win', '.success'
    ];

    for (const selector of resultSelectors) {
        $(selector).each((i, el) => {
            const $el = $(el);
            const content = $el.text();

            // Find amount in this element
            const amountMatch = content.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B|K))?/i);
            const amount = amountMatch ? amountMatch[0] : null;

            if (amount) {
                // Try to find case type
                const caseType = detectCaseType(content);

                results.push({
                    amount,
                    caseType: caseType || 'Case Result',
                    description: content.substring(0, 200).trim()
                });
            }
        });
    }

    // If no structured results, look for prominent amounts
    if (results.length === 0 && amounts.length > 0) {
        amounts.slice(0, 5).forEach(amount => {
            results.push({
                amount,
                caseType: 'Case Result',
                description: null
            });
        });
    }

    return results.slice(0, 10);
}

/**
 * Extract testimonials from a page
 */
function extractTestimonials(html) {
    const $ = cheerio.load(html);
    const testimonials = [];

    // Remove scripts and styles
    $('script, style, noscript').remove();

    // Common testimonial selectors
    const testimonialSelectors = [
        '.testimonial', '.review', '.quote', '.client-review',
        '[class*="testimonial"]', '[class*="review"]',
        'blockquote', '.blockquote'
    ];

    for (const selector of testimonialSelectors) {
        $(selector).each((i, el) => {
            const $el = $(el);

            // Get quote text
            let quote = $el.find('p, .quote-text, .text').first().text().trim();
            if (!quote) {
                quote = $el.text().trim();
            }

            // Skip if too short or too long
            if (!quote || quote.length < 20 || quote.length > 1000) return;

            // Try to find author
            const author = $el.find('.author, .name, .client, cite, [class*="author"]').first().text().trim() ||
                          $el.find('strong, b').last().text().trim();

            // Skip duplicates
            if (testimonials.find(t => t.quote === quote)) return;

            testimonials.push({
                quote: quote.substring(0, 500),
                author: author && author.length < 100 ? author : null
            });
        });
    }

    return testimonials.slice(0, 5);
}

/**
 * Extract general firm information
 */
function extractFirmInfo(html) {
    const $ = cheerio.load(html);

    // Remove scripts and styles
    $('script, style, noscript, nav, footer').remove();

    // Get main content paragraphs
    const paragraphs = [];
    $('main p, article p, .content p, .about p').each((i, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 50) {
            paragraphs.push(text);
        }
    });

    // Look for years in business
    const text = $('body').text();
    const yearsMatch = text.match(/(\d+)\+?\s*years?\s*(?:of\s+)?experience/i) ||
                      text.match(/(?:since|established|founded|serving)\s*(?:in\s+)?(\d{4})/i);

    let yearsInBusiness = null;
    if (yearsMatch) {
        const match = yearsMatch[1];
        if (match.length === 4) {
            yearsInBusiness = new Date().getFullYear() - parseInt(match);
        } else {
            yearsInBusiness = parseInt(match);
        }
    }

    // Look for office locations
    const locations = [];
    const locationPattern = /(?:office|location|serving)\s*(?:in|:)?\s*([A-Z][a-z]+(?:\s*,?\s*[A-Z]{2})?)/gi;
    let locMatch;
    while ((locMatch = locationPattern.exec(text)) !== null) {
        if (locMatch[1] && !locations.includes(locMatch[1])) {
            locations.push(locMatch[1]);
        }
    }

    return {
        description: paragraphs.slice(0, 3).join(' ').substring(0, 1000) || null,
        yearsInBusiness,
        officeLocations: locations.slice(0, 5)
    };
}

/**
 * Detect practice areas from text content
 */
function detectPracticeAreasFromText(text) {
    const practiceKeywords = {
        'Personal Injury': ['personal injury', 'car accident', 'auto accident', 'injury'],
        'Tax': ['tax', 'irs', 'audit', 'tax debt'],
        'Immigration': ['immigration', 'visa', 'green card', 'deportation'],
        'Family Law': ['family law', 'divorce', 'custody', 'child support'],
        'Criminal Defense': ['criminal', 'dui', 'defense', 'felony'],
        'Bankruptcy': ['bankruptcy', 'chapter 7', 'chapter 13', 'debt'],
        'Estate Planning': ['estate planning', 'wills', 'trusts', 'probate'],
        'Employment': ['employment', 'wrongful termination', 'discrimination'],
        'Real Estate': ['real estate', 'property', 'closing', 'title']
    };

    const detected = [];
    const lowerText = text.toLowerCase();

    for (const [area, keywords] of Object.entries(practiceKeywords)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                detected.push(area);
                break;
            }
        }
    }

    return detected;
}

/**
 * Detect case type from text
 */
function detectCaseType(text) {
    const caseTypes = [
        'Car Accident', 'Truck Accident', 'Motorcycle Accident',
        'Slip and Fall', 'Medical Malpractice', 'Wrongful Death',
        'Dog Bite', 'Product Liability', 'Workplace Injury',
        'Personal Injury', 'Settlement', 'Verdict'
    ];

    const lowerText = text.toLowerCase();
    for (const type of caseTypes) {
        if (lowerText.includes(type.toLowerCase())) {
            return type;
        }
    }

    return null;
}

/**
 * Use Claude to structure and enhance the scraped data
 */
async function structureWithClaude(scrapedData, initialAnalysis) {
    // Support both Cloud Functions (defineSecret) and scripts (env var)
    const apiKey = process.env.ANTHROPIC_API_KEY || anthropicApiKey.value();
    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    const prompt = `You are analyzing scraped law firm website data to create a comprehensive firm profile.

CRITICAL TASK: Identify ALL practice areas this firm handles. The initial analysis found these practice areas: ${initialAnalysis.practiceAreas?.join(', ') || 'Unknown'}. Use these as a starting point but verify and expand based on the scraped data.

INITIAL ANALYSIS:
- Firm Name: ${initialAnalysis.firmName || 'Unknown'}
- Primary Practice Area: ${initialAnalysis.primaryPracticeArea || 'Unknown'}
- Detected Practice Areas: ${initialAnalysis.practiceAreas?.join(', ') || 'Unknown'}
- Location: ${initialAnalysis.location?.city || 'Unknown'}, ${initialAnalysis.location?.state || ''}

SCRAPED DATA FROM MULTIPLE PAGES:

ATTORNEYS (${scrapedData.attorneys.length} found):
${scrapedData.attorneys.map(a => `- ${a.name}${a.title ? ` (${a.title})` : ''}${a.practiceAreas?.length ? ` - Areas: ${a.practiceAreas.join(', ')}` : ''}`).join('\n') || 'None found'}

PRACTICE AREA PAGES SCRAPED (${scrapedData.practiceAreas.length} pages):
${scrapedData.practiceAreas.map(p => `- ${p.name}${p.subAreas?.length ? ` (sub-areas: ${p.subAreas.slice(0, 5).join(', ')})` : ''}`).join('\n') || 'None found'}

CASE RESULTS (${scrapedData.results.length} found):
${scrapedData.results.map(r => `- ${r.amount}: ${r.caseType}`).join('\n') || 'None found'}

TESTIMONIALS (${scrapedData.testimonials.length} found):
${scrapedData.testimonials.map(t => `- "${t.quote.substring(0, 100)}..." - ${t.author || 'Anonymous'}`).join('\n') || 'None found'}

FIRM INFO:
${scrapedData.firmInfo.description?.substring(0, 300) || 'No description'}
Years in Business: ${scrapedData.firmInfo.yearsInBusiness || 'Unknown'}
Offices: ${scrapedData.firmInfo.officeLocations?.join(', ') || 'Unknown'}

INSTRUCTIONS FOR PRACTICE AREAS:
1. Use the practice areas from initial analysis as your primary source
2. Add any additional practice areas found in the scraped pages
3. Use standard practice area names (e.g., "Personal Injury", "Employment Law", "Tenant Rights", "Criminal Defense")
4. The practiceAreaDetails keys should match the practice areas exactly

Respond with ONLY valid JSON (no markdown, no explanation) in this exact format:
{
    "attorneys": [
        {
            "name": "Full Name",
            "title": "Partner/Associate/etc",
            "practiceAreas": ["Area 1", "Area 2"],
            "bio": "Brief professional bio",
            "photoUrl": "URL or null",
            "email": "email or null"
        }
    ],
    "caseResults": [
        {
            "amount": "$X.XM or $XXX,XXX",
            "caseType": "Type of Case",
            "description": "Brief description"
        }
    ],
    "testimonials": [
        {
            "quote": "Testimonial text",
            "author": "Client Name or Anonymous"
        }
    ],
    "practiceAreaDetails": {
        "Practice Area Name": {
            "description": "What they handle in this area",
            "subAreas": ["Sub-specialty 1", "Sub-specialty 2"]
        }
    },
    "firmDescription": "A professional description of the firm suitable for intake messaging",
    "yearsInBusiness": number or null,
    "officeLocations": ["City 1", "City 2"]
}`;

    try {
        const message = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
        });

        const responseText = message.content[0].text.trim();
        const structured = JSON.parse(responseText);

        return {
            attorneys: structured.attorneys || scrapedData.attorneys,
            caseResults: structured.caseResults || scrapedData.results,
            testimonials: structured.testimonials || scrapedData.testimonials,
            practiceAreaDetails: structured.practiceAreaDetails || {},
            firmDescription: structured.firmDescription || scrapedData.firmInfo.description,
            yearsInBusiness: structured.yearsInBusiness || scrapedData.firmInfo.yearsInBusiness,
            officeLocations: structured.officeLocations || scrapedData.firmInfo.officeLocations,
            status: 'completed'
        };

    } catch (error) {
        console.error('Claude structuring error:', error.message);

        // Return raw scraped data on failure
        return {
            attorneys: scrapedData.attorneys,
            caseResults: scrapedData.results,
            testimonials: scrapedData.testimonials,
            practiceAreaDetails: scrapedData.practiceAreas.reduce((acc, p) => {
                acc[p.name] = { description: p.description, subAreas: p.subAreas };
                return acc;
            }, {}),
            firmDescription: scrapedData.firmInfo.description,
            yearsInBusiness: scrapedData.firmInfo.yearsInBusiness,
            officeLocations: scrapedData.firmInfo.officeLocations,
            status: 'completed_without_ai',
            aiError: error.message
        };
    }
}

/**
 * Create empty research result
 */
function createEmptyResearch() {
    return {
        attorneys: [],
        caseResults: [],
        testimonials: [],
        practiceAreaDetails: {},
        firmDescription: null,
        yearsInBusiness: null,
        officeLocations: [],
        pagesAnalyzed: 0,
        discoveredUrls: {},
        status: 'failed'
    };
}

module.exports = {
    performDeepResearch,
    // Export for testing
    discoverPages,
    extractAttorneys,
    extractPracticeAreas,
    extractCaseResults,
    extractTestimonials,
    extractFirmInfo
};
