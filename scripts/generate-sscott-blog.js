#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// ===== TEAM BUILD PRO VALIDATION UTILITIES =====
// Load and extract facts from all sources of truth for TBP-related blogs

// Load and extract Team Build Pro facts from all sources
function loadTeamBuildProFacts() {
  const facts = {
    claudeMd: loadClaudeMdSections(),
    faq: loadWebsitePage('faq.html'),
    privacyPolicy: loadWebsitePage('privacy_policy.html'),
    termsOfService: loadWebsitePage('terms_of_service.html')
  };

  return facts;
}

// Load sections from TEAM_BUILD_PRO_KNOWLEDGE.md
function loadClaudeMdSections() {
  const claudeMdPath = path.join(__dirname, '..', 'TEAM_BUILD_PRO_KNOWLEDGE.md');
  if (!fs.existsSync(claudeMdPath)) {
    console.log(`${colors.yellow}Warning: TEAM_BUILD_PRO_KNOWLEDGE.md not found${colors.reset}`);
    return null;
  }

  const content = fs.readFileSync(claudeMdPath, 'utf8');

  return {
    coreIdentity: extractMarkdownSection(content, '## 🎯 Core Product Identity', '##'),
    statistics: extractMarkdownSection(content, '## 📊 Critical Statistics', '##'),
    messaging: extractMarkdownSection(content, '## 💬 Messaging & Positioning', '##'),
    appStoreListing: extractMarkdownSection(content, '## 📱 App Store Listing', '##'),
    criticalDonts: extractMarkdownSection(content, '## 🚨 Critical Don\'ts', '##')
  };
}

// Extract a section from markdown content
function extractMarkdownSection(content, startMarker, endMarker) {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) return '';

  const afterStart = content.substring(startIndex);
  const nextSection = afterStart.indexOf(endMarker, startMarker.length);

  if (nextSection === -1) return afterStart;
  return afterStart.substring(0, nextSection).trim();
}

// Load and extract text from website HTML pages
function loadWebsitePage(filename) {
  const filePath = path.join(__dirname, '..', 'web', filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${colors.yellow}Warning: ${filename} not found${colors.reset}`);
    return null;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  return extractTextFromHTML(html);
}

// Extract readable text from HTML
function extractTextFromHTML(html) {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags but preserve structure
  text = text.replace(/<h[1-6][^>]*>/gi, '\n### ');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n- ');
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, ' ');

  // Clean up whitespace and HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');

  return text.trim();
}

// Validate generated content for suspicious/fabricated features
function validateGeneratedContent(content) {
  const suspiciousTerms = [
    'E2E encryption', 'end-to-end encryption', 'biometric',
    'AI Script Generator', 'Script Generator button',
    'voice recognition', 'facial recognition',
    'blockchain', 'cryptocurrency',
    'video conferencing', 'screen sharing',
    '120+ countries', '100+ companies'
  ];

  const warnings = [];
  for (const term of suspiciousTerms) {
    if (content.toLowerCase().includes(term.toLowerCase())) {
      warnings.push(`Content mentions "${term}" - verify this feature exists`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}VALIDATION WARNINGS:${colors.reset}`);
    warnings.forEach(w => console.log(`  ${colors.yellow}* ${w}${colors.reset}`));
  }

  return warnings;
}
// ===== END TEAM BUILD PRO VALIDATION UTILITIES =====

// Parse command line arguments
const args = process.argv.slice(2);
const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
const title = nonFlagArgs[0] || null;
const positionalNotes = nonFlagArgs.slice(1).join(' ') || '';

const categoryFlag = args.find(arg => arg.startsWith('--category='));
const keywordsFlag = args.find(arg => arg.startsWith('--keywords='));
const notesFlag = args.find(arg => arg.startsWith('--notes='));
const generateFlag = args.includes('--generate');
const researchFlag = args.includes('--research');
const fullAutoFlag = args.includes('--full-auto');
const notifyEmailFlag = args.find(arg => arg.startsWith('--notify-email='));
const notifyEmail = notifyEmailFlag ? notifyEmailFlag.split('=')[1] : 'scscot@gmail.com';

const category = categoryFlag ? categoryFlag.split('=')[1] : 'Recruiting Tips';
const keywords = keywordsFlag ? keywordsFlag.split('=')[1] : '';
const flagNotes = notesFlag ? notesFlag.split('=')[1] : '';
const extraNotes = [positionalNotes, flagNotes].filter(Boolean).join(' ');

const validCategories = ['Recruiting Tips', 'Product Updates', 'Tutorials'];

// Get existing blog posts to avoid duplicate topics
function getExistingBlogs(blogDir) {
  try {
    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.html') && f !== 'index.html');
    const blogs = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const titleMatch = content.match(/<title>([^<|]+)/);
      if (titleMatch) {
        blogs.push({
          slug: file.replace('.html', ''),
          title: titleMatch[1].trim()
        });
      }
    }
    return blogs;
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not read existing blogs: ${error.message}${colors.reset}`);
    return [];
  }
}

// Call Anthropic API
async function callClaudeWithStdin(prompt, description, timeoutMs = 180000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  console.log(`${colors.cyan}  Calling Claude API for ${description}...${colors.reset}`);

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: timeoutMs
    });

    if (response.data && response.data.content && response.data.content[0]) {
      return response.data.content[0].text.trim();
    }
    throw new Error('Unexpected API response format');
  } catch (error) {
    if (error.response) {
      throw new Error(`Anthropic API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Anthropic API call failed: ${error.message}`);
  }
}

function extractJsonFromResponse(response) {
  let jsonStr = response;
  const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1];
  } else {
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    }
  }
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(jsonStr);
}

function generateSlug(title) {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'we', 'they', 'what', 'which', 'who', 'whom', 'how', 'when', 'where',
    'why', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once'
  ]);
  const maxLength = 50;
  const words = title
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0 && !stopWords.has(word));

  let slug = '';
  for (const word of words) {
    const potentialSlug = slug ? `${slug}-${word}` : word;
    if (potentialSlug.length <= maxLength) {
      slug = potentialSlug;
    } else {
      break;
    }
  }
  return slug || words.slice(0, 3).join('-');
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function validateBlogPost(post) {
  const errors = [];
  if (!post.slug || post.slug.length < 3) errors.push('Invalid or missing slug');
  if (!post.title || post.title.length < 10) errors.push('Title too short');
  if (!post.excerpt || post.excerpt.length < 100) errors.push('Excerpt too short');
  if (post.excerpt && post.excerpt.length > 180) errors.push('Excerpt too long');
  if (!post.metaDescription || post.metaDescription.length < 120) errors.push('Meta description too short');
  if (post.metaDescription && post.metaDescription.length > 160) errors.push('Meta description too long');
  if (!post.content || post.content.length < 3000) errors.push('Content too short');
  if (!post.category || !validCategories.includes(post.category)) errors.push(`Invalid category`);
  if (!post.content.includes('<h2>')) errors.push('Content missing H2 headings');
  return errors;
}

function generateBlogPromptPlain(title, category, keywords, extraNotes) {
  const slug = generateSlug(title);
  const date = getTodayDate();
  const extraSection = extraNotes ? `\nADDITIONAL CONTEXT / ANGLE:\n${extraNotes}\n` : '';

  // Check if this blog topic relates to TBP/direct sales and needs validation
  const isRelevantTopic = /team build pro|direct sales|network marketing|mlm|ai recruit|downline|upline/i.test(title + ' ' + (keywords || ''));

  // Build TBP validation section if topic is relevant
  let validationSection = '';
  if (isRelevantTopic) {
    const tbpFacts = loadTeamBuildProFacts();
    if (tbpFacts && tbpFacts.claudeMd) {
      validationSection = `
TEAM BUILD PRO FACTS (USE ONLY THESE - DO NOT FABRICATE FEATURES):
If you mention Team Build Pro in this article, only reference features documented below.

=== FROM TEAM_BUILD_PRO_KNOWLEDGE.MD (Product Identity) ===
${tbpFacts.claudeMd.coreIdentity || ''}

${tbpFacts.claudeMd.statistics || ''}

${tbpFacts.claudeMd.messaging || ''}

=== FROM FAQ PAGE (Features & How It Works) ===
${tbpFacts.faq ? tbpFacts.faq.substring(0, 3000) : ''}

=== FROM PRIVACY POLICY (Data & Security) ===
${tbpFacts.privacyPolicy ? tbpFacts.privacyPolicy.substring(0, 1500) : ''}

CRITICAL VALIDATION RULES:
- Only reference Team Build Pro features documented in the sources above
- Never invent new features, buttons, or capabilities
- Use exact statistics (75% quit rate, 16 messages, 4 languages, etc.)
- Do not claim security features not documented (no E2E encryption, no biometric auth)
- App works with ANY direct sales company (company-agnostic)
- Available wherever App Store and Google Play operate (NOT "120+ countries")
- Core features: 16 pre-written messages, AI Coach, downline tracking, 30-day free trial, $6.99/month

`;
    }
  }

  return `Generate a comprehensive, SEO-optimized blog post for Stephen Scott's website (stephenscott.us) with the following requirements:
${validationSection}
TITLE: "${title}"
CATEGORY: ${category}
TARGET KEYWORDS: ${keywords || 'ai recruiting, direct sales, team building, network marketing'}${extraSection}SLUG: ${slug}
PUBLISH DATE: ${date}

ABOUT STEPHEN SCOTT:
- Technology entrepreneur and author with 14 published books
- Creator of Team Build Pro, an AI-powered platform for network marketers
- Expert in AI, network marketing, direct sales, and personal development
- Website: stephenscott.us

SEO REQUIREMENTS:
- Word count: 1,500-2,500 words
- Include 5-8 H2 headings
- Include 10-15 H3 subheadings where appropriate
- Use <ul class="checklist"> for actionable bullet points
- Include real examples, statistics, or case studies
- Add <p class="note"> callout boxes for key insights
- Use <div class="divider"></div> before final CTA
- Meta description: 150-160 characters
- Excerpt: 140-160 characters

BRAND VOICE & STYLE:
- Direct, actionable, no fluff
- Focus on practical strategies over theory
- Use specific examples and data points
- Speak directly to direct sales professionals and network marketers
- Professional but conversational tone
- No emojis in content

CONTENT STRUCTURE:
1. Opening Hook (1-2 paragraphs) - Address a specific pain point
2. Why This Matters Now (1 H2 section) - Current trends, why traditional approaches fail
3. Main Content (5-7 H2 sections) - Each 200-400 words with H3 subheadings
4. Real-World Examples (integrate throughout)
5. Implementation Steps (1 H2 section) - Step-by-step action plan
6. Common Mistakes (optional H2 section)
7. Conclusion (final paragraph before CTA)
8. CTA Section (after divider) - Reference Team Build Pro and Stephen's books

INTERNAL LINKING:
- Link to /books.html when mentioning books or resources
- Link to /about.html when mentioning Stephen Scott's background
- Link to other blog posts if relevant (use /blog/slug.html format)
- Link to https://teambuildpro.com when mentioning the app

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:

{
  "slug": "${slug}",
  "title": "${title}",
  "excerpt": "Your 140-160 character excerpt here...",
  "category": "${category}",
  "author": "Stephen Scott",
  "publishDate": "${date}",
  "metaDescription": "Your 150-160 character meta description...",
  "featured": false,
  "content": "<p>Your opening paragraph...</p><h2>First H2</h2>..."
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Ensure content is original and valuable
- Include specific tactics readers can implement immediately
- All HTML in content field should be on a single line or use \\n for newlines`;
}

function generateBlogHTML(blogPost) {
  const baseUrl = 'https://www.stephenscott.us';
  const dateObj = new Date(blogPost.publishDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const encodedTitle = encodeURIComponent(blogPost.title);
  const encodedUrl = encodeURIComponent(`${baseUrl}/blog/${blogPost.slug}.html`);

  const categoryBadge = blogPost.category === 'Recruiting Tips' ? 'RECRUITING TIPS' :
                        blogPost.category === 'Product Updates' ? 'PRODUCT UPDATES' : 'TUTORIALS';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <script async src="https://www.googletagmanager.com/gtag/js?id=G-CSBMH9D41J"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-CSBMH9D41J');
  </script>

  <title>${blogPost.title} | Stephen Scott</title>
  <meta name="description" content="${blogPost.metaDescription}">
  <link rel="canonical" href="${baseUrl}/blog/${blogPost.slug}.html">

  <meta property="og:type" content="article">
  <meta property="og:url" content="${baseUrl}/blog/${blogPost.slug}.html">
  <meta property="og:title" content="${blogPost.title} | Stephen Scott">
  <meta property="og:description" content="${blogPost.metaDescription}">
  <meta property="og:image" content="${baseUrl}/assets/images/stephen-scott-about.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${blogPost.title}">
  <meta name="twitter:description" content="${blogPost.metaDescription}">
  <meta name="twitter:image" content="${baseUrl}/assets/images/stephen-scott-about.jpg">

  <link rel="stylesheet" href="/assets/css/main.css">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${blogPost.title}",
    "description": "${blogPost.metaDescription}",
    "author": {
      "@type": "Person",
      "name": "Stephen Scott",
      "url": "${baseUrl}/about.html"
    },
    "publisher": {
      "@type": "Person",
      "name": "Stephen Scott"
    },
    "datePublished": "${blogPost.publishDate}",
    "dateModified": "${blogPost.publishDate}",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${baseUrl}/blog/${blogPost.slug}.html"
    }
  }
  </script>

  <style>
    .blog-wrapper{padding:60px 0}
    .blog-wrapper .container{max-width:800px;margin:0 auto;padding:0 20px}
    .blog-wrapper h1{font-size:2.5rem;font-weight:900;margin-bottom:1rem;color:#1e293b;line-height:1.2}
    .blog-wrapper h2{font-size:2rem;font-weight:700;margin:2.5rem 0 1rem;color:#1e293b}
    .blog-wrapper h3{font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;color:#1e293b}
    .blog-wrapper .eyebrow{display:inline-block;font-weight:700;letter-spacing:.08em;font-size:.8rem;text-transform:uppercase;color:var(--color-primary);margin-bottom:12px}
    .blog-wrapper .meta{color:#64748b;font-size:0.95rem;margin-bottom:2rem;display:flex;gap:16px;align-items:center}
    .blog-wrapper p{line-height:1.8;color:#475569;margin-bottom:1.5rem;font-size:1.1rem}
    .blog-wrapper ul,.blog-wrapper ol{line-height:1.8;color:#475569;margin:1.5rem 0;padding-left:1.5rem}
    .blog-wrapper li{margin:8px 0}
    .breadcrumb{font-size:0.875rem;color:#64748b;margin-bottom:1.5rem}
    .breadcrumb a{color:var(--color-primary);text-decoration:none;transition:color 0.2s}
    .breadcrumb a:hover{color:var(--color-primary-dark)}
    .note{background:#f9fafb;border-left:4px solid var(--color-primary);padding:16px 20px;border-radius:8px;margin:1.5rem 0}
    .note strong{color:#1e293b}
    .cta-inline{color:var(--color-primary);font-weight:600;text-decoration:none;transition:color 0.2s}
    .cta-inline:hover{color:var(--color-primary-dark)}
    .checklist{list-style:none;padding-left:0}
    .checklist li{padding-left:28px;position:relative;margin:12px 0}
    .checklist li:before{content:"\\2713";position:absolute;left:0;color:var(--color-primary);font-weight:bold;font-size:1.2rem}
    .divider{height:1px;background:#e5e7eb;margin:3rem 0}
    .social-share{margin:3rem 0;padding:1.5rem;background:#f9fafb;border-radius:12px;text-align:center}
    .social-share h3{margin-top:0;font-size:1.1rem;color:#1e293b}
    .social-share .share-buttons{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:1rem}
    .social-share .share-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;transition:all 0.2s;font-size:0.95rem}
    .share-btn.twitter{background:#1DA1F2;color:#fff}
    .share-btn.twitter:hover{background:#1a8cd8}
    .share-btn.linkedin{background:#0A66C2;color:#fff}
    .share-btn.linkedin:hover{background:#004182}
    .share-btn.facebook{background:#1877F2;color:#fff}
    .share-btn.facebook:hover{background:#0d65d9}
    @media (max-width: 768px){
      .blog-wrapper h1{font-size:2rem}
      .blog-wrapper h2{font-size:1.75rem}
      .blog-wrapper p{font-size:1.05rem}
      .social-share .share-buttons{flex-direction:column}
      .share-btn{width:100%;justify-content:center}
    }
  </style>
</head>
<body>
  <div id="ss-header"></div>

  <main class="blog-wrapper">
    <div class="container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/blog.html">Blog</a> / <span>${blogPost.title}</span>
      </nav>

      <span class="eyebrow">${categoryBadge}</span>
      <h1>${blogPost.title}</h1>

      <div class="meta">
        <span>By ${blogPost.author || 'Stephen Scott'}</span>
        <span>&bull;</span>
        <span>${formattedDate}</span>
      </div>

      <article>
        ${blogPost.content}
      </article>

      <div class="social-share">
        <h3>Share this article</h3>
        <div class="share-buttons">
          <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" class="share-btn twitter">
            <span>X</span> Share on Twitter
          </a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" class="share-btn linkedin">
            <span>in</span> Share on LinkedIn
          </a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" class="share-btn facebook">
            <span>f</span> Share on Facebook
          </a>
        </div>
      </div>

      <div class="tbp-cta">
        <h3>Ready to Transform Your Network Marketing?</h3>
        <p>Download Team Build Pro and give your prospects a 30-day team building experience before they join.</p>
        <a href="https://teambuildpro.com" class="btn" target="_blank">Get Team Build Pro</a>
      </div>

    </div>
  </main>

  <div id="ss-footer"></div>
  <script src="/js/components.js"></script>
</body>
</html>`;
}

function updateBlogIndex(blogIndexPath, blogPost) {
  if (!fs.existsSync(blogIndexPath)) {
    console.log(`${colors.yellow}Blog index not found: ${blogIndexPath}${colors.reset}`);
    return false;
  }

  let blogIndexContent = fs.readFileSync(blogIndexPath, 'utf8');

  if (blogIndexContent.includes(`/blog/${blogPost.slug}.html`)) {
    console.log(`${colors.cyan}  Blog post already in blog index, skipping...${colors.reset}`);
    return true;
  }

  const dateObj = new Date(blogPost.publishDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let excerpt = blogPost.excerpt || '';
  if (excerpt.length > 120) {
    excerpt = excerpt.substring(0, 117) + '...';
  }

  const blogCardHTML = `
          <a href="/blog/${blogPost.slug}.html" class="blog-card card" data-category="${blogPost.category}">
            <div class="card-content">
              <span class="category-badge">${blogPost.category.toUpperCase()}</span>
              <h3>${blogPost.title}</h3>
              <p>${excerpt}</p>
              <div class="meta" style="font-size: 0.875rem; color: var(--color-text-light); margin-top: auto;">
                <span>${formattedDate}</span>
                <span>&bull;</span>
                <span>By ${blogPost.author || 'Stephen Scott'}</span>
              </div>
              <span class="cta-link" style="margin-top: 1rem;">Read More &rarr;</span>
            </div>
          </a>
`;

  const blogGridMarker = '<div class="blog-grid" id="blog-grid">';
  const insertPosition = blogIndexContent.indexOf(blogGridMarker);

  if (insertPosition === -1) {
    console.log(`${colors.yellow}Could not find blog-grid in ${blogIndexPath}${colors.reset}`);
    return false;
  }

  const insertPoint = insertPosition + blogGridMarker.length;
  blogIndexContent = blogIndexContent.slice(0, insertPoint) + blogCardHTML + blogIndexContent.slice(insertPoint);

  fs.writeFileSync(blogIndexPath, blogIndexContent, 'utf8');
  console.log(`${colors.green}  Updated blog index${colors.reset}`);
  return true;
}

function updateSitemap(sitemapPath, blogPost) {
  const baseUrl = 'https://www.stephenscott.us';
  const today = getTodayDate();

  if (!fs.existsSync(sitemapPath)) {
    console.log(`${colors.yellow}Sitemap not found: ${sitemapPath}${colors.reset}`);
    return false;
  }

  let sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

  if (sitemapContent.includes(`${baseUrl}/blog/${blogPost.slug}.html`)) {
    console.log(`${colors.cyan}  Blog post already in sitemap, skipping...${colors.reset}`);
    return true;
  }

  const blogEntry = `
  <url>
    <loc>${baseUrl}/blog/${blogPost.slug}.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  const insertPosition = sitemapContent.lastIndexOf('</urlset>');
  if (insertPosition === -1) {
    console.log(`${colors.yellow}Could not find </urlset> in ${sitemapPath}${colors.reset}`);
    return false;
  }

  sitemapContent = sitemapContent.slice(0, insertPosition) + blogEntry + '\n' + sitemapContent.slice(insertPosition);
  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log(`${colors.green}  Updated sitemap${colors.reset}`);
  return true;
}

function generateResearchPrompt(existingBlogs = []) {
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${oneWeekAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`;

  return `You are a research analyst specializing in direct sales, network marketing, MLM, AI technology, and recruiting trends.

TASK: Conduct deep research on what's being discussed in the direct sales/network marketing/MLM industry within the past week (${dateRange}). Identify trending topics that would make excellent blog content for Stephen Scott's website (stephenscott.us).

ABOUT STEPHEN SCOTT:
- Author of 14 books on AI, network marketing, and personal development
- Creator of Team Build Pro, an AI-powered platform for network marketers
- Focus: Practical, field-level advice for direct sales professionals

RESEARCH SOURCES TO ANALYZE:
1. BusinessForHome.org - Industry news, company updates
2. Direct Selling News - Industry publications
3. Social media trends in MLM/direct sales communities
4. AI/technology integration in direct sales
5. Training/coaching content trends

EXISTING BLOG POSTS (DO NOT DUPLICATE):
The following blogs have already been published. Do NOT recommend topics that are too similar unless you're proposing an explicit "update" or "2025/2026 edition":

${existingBlogs.length > 0 ? existingBlogs.map(b => `- "${b.title}" (${b.slug})`).join('\n') : '(No existing blogs found)'}

UNIQUENESS RULES:
1. Avoid topics with >70% keyword overlap with existing posts
2. If recommending an update to an existing post, prefix title with "[UPDATE]" and reference the original
3. Prefer fresh angles, new trends, or different audiences than covered before
4. It's OK to cover similar themes if the angle is substantially different

OUTPUT FORMAT:
Return a JSON object with exactly this structure:

{
  "researchDate": "${today.toISOString().split('T')[0]}",
  "industryTrends": [
    {"trend": "Brief description", "relevance": "Why this matters"}
  ],
  "recommendations": [
    {
      "rank": 1,
      "title": "SEO-optimized blog title",
      "category": "Recruiting Tips|Product Updates|Tutorials",
      "keywords": "comma, separated, keywords",
      "notes": "Detailed angle and context for the blog post",
      "urgency": "high|medium|low"
    }
  ]
}

Provide 5-10 blog recommendations ranked by relevance.`;
}

async function runResearchMode() {
  console.log(`\n${colors.bright}${colors.blue}RESEARCH MODE - Analyzing Industry Trends${colors.reset}\n`);
  console.log(`${colors.cyan}Researching trends... (2-3 minutes)${colors.reset}\n`);

  // Get existing blogs to avoid duplicate topics
  const blogDir = path.join(__dirname, '..', 'sscott', 'public', 'blog');
  const existingBlogs = getExistingBlogs(blogDir);
  if (existingBlogs.length > 0) {
    console.log(`${colors.cyan}Found ${existingBlogs.length} existing blog posts to check against${colors.reset}\n`);
  }

  const researchPrompt = generateResearchPrompt(existingBlogs);

  try {
    const response = await callClaudeWithStdin(researchPrompt, 'industry research', 300000);
    const research = extractJsonFromResponse(response);

    const outputFile = path.join(__dirname, 'sscott-blog-recommendations.json');
    fs.writeFileSync(outputFile, JSON.stringify(research, null, 2), 'utf8');

    console.log(`${colors.green}\nResearch complete!${colors.reset}\n`);

    if (research.recommendations) {
      console.log(`${colors.bright}Blog Recommendations:${colors.reset}`);
      research.recommendations.forEach((rec, i) => {
        console.log(`\n  #${rec.rank || i + 1}: ${rec.title}`);
        console.log(`      Category: ${rec.category}`);
        console.log(`      Urgency: ${rec.urgency}`);
      });
    }

    console.log(`\n${colors.bright}Saved to:${colors.reset} scripts/sscott-blog-recommendations.json`);
    return research;
  } catch (error) {
    console.error(`${colors.yellow}Research failed: ${error.message}${colors.reset}`);
    throw error;
  }
}

async function runFullAutomation(title, category, keywords, extraNotes) {
  console.log(`\n${colors.bright}${colors.blue}GENERATING BLOG: ${title}${colors.reset}\n`);

  const slug = generateSlug(title);

  console.log(`${colors.bright}Step 1/4:${colors.reset} Generating blog content...`);
  const blogPrompt = generateBlogPromptPlain(title, category, keywords, extraNotes);

  let blogPost;
  try {
    const response = await callClaudeWithStdin(blogPrompt, 'blog generation', 300000);
    blogPost = extractJsonFromResponse(response);
    console.log(`${colors.green}  Blog content generated${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.yellow}Error generating blog: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.bright}Step 2/4:${colors.reset} Validating content...`);
  const errors = validateBlogPost(blogPost);
  if (errors.length > 0) {
    console.log(`${colors.yellow}  Warnings: ${errors.join(', ')}${colors.reset}\n`);
  } else {
    console.log(`${colors.green}  Validation passed${colors.reset}\n`);
  }

  // Validate for suspicious/fabricated TBP features
  const contentWarnings = validateGeneratedContent(blogPost.content || '');
  if (contentWarnings.length > 0) {
    console.log(`${colors.yellow}  Review generated content for potentially fabricated features${colors.reset}\n`);
  }

  const blogResponseFile = path.join(__dirname, 'sscott-blog-response.json');
  fs.writeFileSync(blogResponseFile, JSON.stringify(blogPost, null, 2), 'utf8');

  console.log(`${colors.bright}Step 3/4:${colors.reset} Generating HTML...`);
  const html = generateBlogHTML(blogPost);
  const blogDir = path.join(__dirname, '..', 'sscott', 'public', 'blog');
  if (!fs.existsSync(blogDir)) {
    fs.mkdirSync(blogDir, { recursive: true });
  }
  const blogPath = path.join(blogDir, `${blogPost.slug}.html`);
  fs.writeFileSync(blogPath, html, 'utf8');
  console.log(`${colors.green}  Created: sscott/public/blog/${blogPost.slug}.html${colors.reset}\n`);

  console.log(`${colors.bright}Step 4/4:${colors.reset} Updating index and sitemap...`);
  const blogIndexPath = path.join(__dirname, '..', 'sscott', 'public', 'blog.html');
  updateBlogIndex(blogIndexPath, blogPost);

  const sitemapPath = path.join(__dirname, '..', 'sscott', 'public', 'sitemap.xml');
  updateSitemap(sitemapPath, blogPost);

  console.log(`\n${colors.bright}${colors.green}BLOG GENERATION COMPLETE${colors.reset}\n`);
  console.log(`${colors.bright}Generated:${colors.reset} sscott/public/blog/${blogPost.slug}.html`);
  console.log(`\n${colors.bright}Deploy:${colors.reset} firebase deploy --only hosting:sscott`);
  console.log('');

  return blogPost;
}

/**
 * Initialize Firebase Admin SDK for Firestore access
 */
function initializeFirebase() {
  const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(serviceAccountPath))
    });
  }

  return admin.firestore();
}

/**
 * Send email notification via Firestore
 *
 * Creates a document in 'blog_notifications' collection which triggers
 * the sendBlogNotification Cloud Function to send the email via SMTP.
 *
 * @param {string} subject - Email subject
 * @param {string} htmlBody - HTML content
 * @param {string} textBody - Plain text content
 * @param {string} toEmail - Recipient email address
 * @returns {Promise<boolean>} True if document was created successfully
 */
async function sendEmailNotification(subject, htmlBody, textBody, toEmail) {
  try {
    const db = initializeFirebase();

    const notificationDoc = {
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      textBody: textBody,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    };

    const docRef = await db.collection('blog_notifications').add(notificationDoc);

    console.log(`${colors.green}Email notification queued: ${docRef.id}${colors.reset}`);
    console.log(`${colors.cyan}  Recipient: ${toEmail}${colors.reset}`);
    console.log(`${colors.cyan}  Subject: ${subject}${colors.reset}`);
    console.log(`${colors.cyan}  Cloud Function will send via SMTP${colors.reset}`);

    return true;
  } catch (error) {
    console.error(`${colors.yellow}Failed to queue email notification: ${error.message}${colors.reset}`);
    return false;
  }
}

async function deployToFirebase() {
  const { execSync } = require('child_process');
  console.log(`${colors.cyan}Deploying to Firebase Hosting...${colors.reset}`);

  try {
    execSync('firebase deploy --only hosting:sscott --project teambuilder-plus-fe74d', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 300000
    });
    console.log(`${colors.green}Firebase deployment complete${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.yellow}Deployment failed: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runFullAutoMode(emailTo) {
  const startTime = Date.now();
  let blogPost = null;
  let deploySuccess = false;
  let errors = [];

  console.log(`\n${colors.bright}${colors.magenta}FULL AUTOMATION MODE${colors.reset}`);
  console.log(`${colors.magenta}Research -> Generate -> Deploy -> Notify${colors.reset}\n`);

  try {
    console.log(`${colors.bright}Step 1/4:${colors.reset} Researching trends...\n`);
    const research = await runResearchMode();

    if (!research.recommendations || research.recommendations.length === 0) {
      throw new Error('No recommendations from research');
    }

    const topRec = research.recommendations[0];
    console.log(`\n${colors.bright}Step 2/4:${colors.reset} Generating blog from top recommendation...`);
    console.log(`  Title: ${topRec.title}\n`);

    blogPost = await runFullAutomation(topRec.title, topRec.category, topRec.keywords, topRec.notes);

    console.log(`${colors.bright}Step 3/4:${colors.reset} Deploying to Firebase...\n`);
    deploySuccess = await deployToFirebase();
    if (!deploySuccess) errors.push('Deployment failed');

  } catch (error) {
    errors.push(error.message);
    console.error(`${colors.yellow}Error: ${error.message}${colors.reset}`);
  }

  console.log(`\n${colors.bright}Step 4/4:${colors.reset} Sending notification...\n`);

  const duration = Math.round((Date.now() - startTime) / 1000 / 60);
  const status = errors.length === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS';

  const htmlBody = `
    <h2>Stephen Scott Blog Automation - ${status}</h2>
    <p><strong>Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</p>
    <p><strong>Duration:</strong> ${duration} minutes</p>
    ${blogPost ? `
      <h3>Blog Generated:</h3>
      <ul>
        <li><strong>Title:</strong> ${blogPost.title}</li>
        <li><strong>Category:</strong> ${blogPost.category}</li>
        <li><strong>URL:</strong> <a href="https://www.stephenscott.us/blog/${blogPost.slug}.html">View Blog</a></li>
      </ul>
    ` : '<p>No blog was generated.</p>'}
    ${errors.length > 0 ? `<h3>Errors:</h3><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
  `;

  const textBody = `Stephen Scott Blog - ${status}\nTitle: ${blogPost ? blogPost.title : 'None'}\nURL: https://www.stephenscott.us/blog/${blogPost ? blogPost.slug + '.html' : ''}`;

  await sendEmailNotification(
    `[Blog Bot] ${status}: ${blogPost ? blogPost.title : 'Automation Run'}`,
    htmlBody,
    textBody,
    emailTo
  );

  console.log(`\n${colors.bright}${colors.green}FULL AUTOMATION COMPLETE - ${status}${colors.reset}\n`);

  if (blogPost) {
    console.log(`${colors.bright}Published:${colors.reset} https://www.stephenscott.us/blog/${blogPost.slug}.html`);
  }
  console.log('');

  return { blogPost, deploySuccess, errors };
}

async function main() {
  console.log(`\n${colors.bright}${colors.blue}Stephen Scott - AI Blog Generator${colors.reset}\n`);

  if (fullAutoFlag) {
    await runFullAutoMode(notifyEmail);
    return;
  }

  if (researchFlag) {
    await runResearchMode();
    return;
  }

  if (!title) {
    console.log(`${colors.yellow}Usage:${colors.reset}`);
    console.log(`\n${colors.bright}Full automation:${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-sscott-blog.js --full-auto${colors.reset}`);
    console.log(`\n${colors.bright}Research mode:${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-sscott-blog.js --research${colors.reset}`);
    console.log(`\n${colors.bright}Generate from title:${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-sscott-blog.js "Blog Title" --generate${colors.reset}`);
    console.log(`\n${colors.bright}Valid categories:${colors.reset} ${validCategories.join(', ')}`);
    console.log('');
    process.exit(1);
  }

  if (!validCategories.includes(category)) {
    console.error(`${colors.yellow}Invalid category: "${category}"${colors.reset}`);
    process.exit(1);
  }

  if (generateFlag) {
    await runFullAutomation(title, category, keywords, extraNotes);
    return;
  }

  console.log(`${colors.yellow}Use --generate flag to create the blog${colors.reset}`);
}

main();
