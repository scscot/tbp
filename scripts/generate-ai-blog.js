#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

// Parse command line arguments
const args = process.argv.slice(2);

// First non-flag arg = title, everything after = extra notes (positional)
const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
const title = nonFlagArgs[0] || null;
const positionalNotes = nonFlagArgs.slice(1).join(' ') || '';

const categoryFlag = args.find(arg => arg.startsWith('--category='));
const keywordsFlag = args.find(arg => arg.startsWith('--keywords='));
const importFlag = args.find(arg => arg.startsWith('--import='));
const notesFlag = args.find(arg => arg.startsWith('--notes='));
const interactiveFlag = args.includes('--interactive');
const generateFlag = args.includes('--generate');
const researchFlag = args.includes('--research');
const fullAutoFlag = args.includes('--full-auto');
const notifyEmailFlag = args.find(arg => arg.startsWith('--notify-email='));
const notifyEmail = notifyEmailFlag ? notifyEmailFlag.split('=')[1] : 'scscot@gmail.com';

// Extract values
const category = categoryFlag ? categoryFlag.split('=')[1] : 'Recruiting Tips';
const keywords = keywordsFlag ? keywordsFlag.split('=')[1] : '';
const importFile = importFlag ? importFlag.split('=')[1] : null;
const flagNotes = notesFlag ? notesFlag.split('=')[1] : '';

// Combine positional notes and flag notes
const extraNotes = [positionalNotes, flagNotes].filter(Boolean).join(' ');

// Valid categories
const validCategories = ['Recruiting Tips', 'Product Updates', 'Tutorials'];

// Helper to strip ANSI color codes from text
function stripAnsiColors(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// Call Anthropic API directly (works in GitHub Actions without CLI auth)
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
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
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

// Extract JSON from Claude response (handles markdown code blocks)
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

// Generate plain text prompt for Claude API (no ANSI colors)
function generateBlogPromptPlain(title, category, keywords, extraNotes) {
  const slug = generateSlug(title);
  const date = getTodayDate();

  const extraSection = extraNotes
    ? `\nADDITIONAL CONTEXT / ANGLE:\n${extraNotes}\n`
    : '';

  return `Generate a comprehensive, SEO-optimized blog post for Team Build Pro with the following requirements:

TITLE: "${title}"
CATEGORY: ${category}
TARGET KEYWORDS: ${keywords || 'ai recruiting, direct sales, team building, network marketing'}${extraSection}SLUG: ${slug}
PUBLISH DATE: ${date}

SEO REQUIREMENTS:
- Word count: 1,500-2,500 words (optimal for SEO ranking)
- Include 5-8 H2 headings (clear hierarchy)
- Include 10-15 H3 subheadings where appropriate
- Use <ul class="checklist"> for actionable bullet points
- Include real examples, statistics, or case studies
- Add <p class="note"> callout boxes for key insights/tips
- Include internal links to /companies.html or specific company pages
- Use <div class="divider"></div> before final CTA
- Meta description: 150-160 characters
- Excerpt: 140-160 characters

BRAND VOICE & STYLE:
- Direct, actionable, no fluff or filler content
- Focus on practical strategies over theory
- Use specific examples and data points
- Speak directly to direct sales professionals and network marketers
- Emphasize Team Build Pro's unique pre-qualification approach
- Professional but conversational tone
- No emojis in content (only in examples if relevant)

CONTENT STRUCTURE:
1. **Opening Hook** (1-2 paragraphs)
   - Address a specific pain point or challenge
   - Make it relatable and urgent

2. **Why This Matters Now** (1 H2 section)
   - Current trends or context
   - Why traditional approaches fail
   - What's changed in 2025

3. **Main Content** (5-7 H2 sections)
   - Each section should be 200-400 words
   - Include H3 subheadings for deeper topics
   - Use checklists for actionable items
   - Include note boxes for pro tips or warnings

4. **Real-World Examples** (integrate throughout)
   - Specific scenarios or case studies
   - "Before/after" comparisons
   - Testimonial-style quotes (can be synthesized)

5. **Implementation Steps** (1 H2 section)
   - Step-by-step action plan
   - Use ordered list or checklist format

6. **Common Mistakes** (optional H2 section)
   - What NOT to do
   - How to avoid pitfalls

7. **Conclusion** (final paragraph before CTA)
   - Summarize key takeaways
   - Reinforce main benefit
   - Lead into CTA

8. **CTA Section** (after divider)
   - Strong call to action
   - Reference Team Build Pro features
   - Encourage download or trial

INTERNAL LINKING:
- Link to /companies.html when mentioning company-specific strategies
- Link to specific company pages like /companies/ai-recruiting-young-living.html
- Link to other blog posts if relevant (use realistic URLs like /blog/other-post-slug.html)
- Link to /faq.html or /contact_us.html where appropriate

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation, just JSON):

{
  "slug": "${slug}",
  "title": "${title}",
  "excerpt": "Your 140-160 character excerpt here that hooks the reader...",
  "category": "${category}",
  "author": "Team Build Pro",
  "publishDate": "${date}",
  "metaDescription": "Your 150-160 character meta description optimized for search engines...",
  "featured": false,
  "content": "<p>Your opening paragraph...</p><h2>First H2</h2>..."
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Ensure content is original and valuable (not generic)
- Focus on Team Build Pro's unique 30-day pre-qualification approach
- Include specific tactics readers can implement immediately
- Make it comprehensive enough to rank for target keywords
- Maintain professional quality throughout
- All HTML in content field should be on a single line or use \\n for newlines`;
}

// Helper function to generate SEO-optimized slug from title
// - Removes stop words for cleaner URLs
// - Limits length to ~50 characters for SEO best practices
// - Preserves important keywords
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
    'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
    'isn', 'isnt', "isn't", 'aren', 'arent', "aren't", 'don', 'dont', "don't",
    'doesn', 'doesnt', "doesn't", 'didn', 'didnt', "didn't", 'won', 'wont',
    "won't", 'wouldn', 'wouldnt', "wouldn't", 'couldn', 'couldnt', "couldn't",
    'shouldn', 'shouldnt', "shouldn't", 'actually', 'really', 'simply', 'about'
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

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Helper function to validate blog post object
function validateBlogPost(post) {
  const errors = [];

  if (!post.slug || post.slug.length < 3) {
    errors.push('Invalid or missing slug');
  }

  if (!post.title || post.title.length < 10) {
    errors.push('Title too short (minimum 10 characters)');
  }

  if (!post.excerpt || post.excerpt.length < 100) {
    errors.push('Excerpt too short (minimum 100 characters)');
  }

  if (post.excerpt && post.excerpt.length > 180) {
    errors.push('Excerpt too long (maximum 180 characters)');
  }

  if (!post.metaDescription || post.metaDescription.length < 120) {
    errors.push('Meta description too short (minimum 120 characters)');
  }

  if (post.metaDescription && post.metaDescription.length > 160) {
    errors.push('Meta description too long (maximum 160 characters)');
  }

  if (!post.content || post.content.length < 3000) {
    errors.push('Content too short (minimum ~1,500 words / 3,000 characters for SEO)');
  }

  if (!post.category || !validCategories.includes(post.category)) {
    errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  // Check for required HTML elements in content
  if (!post.content.includes('<h2>')) {
    errors.push('Content missing H2 headings (required for SEO)');
  }

  if (!post.content.includes('<ul class="checklist">')) {
    errors.push('Content missing checklist (recommended for actionable content)');
  }

  if (!post.content.includes('<div class="divider"></div>')) {
    errors.push('Content missing divider before final CTA');
  }

  return errors;
}

// Function to call Claude API for translation (uses robust stdin approach)
async function callClaudeForTranslation(prompt, languageName) {
  const response = await callClaudeWithStdin(prompt, `${languageName} translation`, 180000);
  return extractJsonFromResponse(response);
}

// Translation helper function - generates translation prompt for Claude Code
function generateTranslationPrompt(blogPost, targetLang) {
  const langName = targetLang === 'es' ? 'Spanish' : 'Portuguese';
  const baseUrl = targetLang === 'es' ? 'es.teambuildpro.com' : 'pt.teambuildpro.com';

  return `Translate the following blog post to ${langName} with cultural adaptation.

CRITICAL REQUIREMENTS:
- This is NOT a literal translation - adapt the content for ${langName}-speaking cultures
- Maintain the marketing impact and professional tone
- Translate ALL text including: title, excerpt, meta description, and full content
- Update ALL URLs from "teambuildpro.com" to "${baseUrl}"
- Keep the same slug: "${blogPost.slug}"
- Maintain SEO quality - meta description should be compelling in ${langName}

CONTENT FIELD FORMAT - VERY IMPORTANT:
- The "content" field must contain ONLY the article body HTML (p, h2, h3, ul, div tags, etc.)
- Do NOT include <!DOCTYPE>, <html>, <head>, <body>, <header>, <footer>, or <script> tags
- Do NOT wrap content in a full HTML document structure
- Just translate the existing content HTML as-is, preserving tags and classes

BLOG POST TO TRANSLATE:
${JSON.stringify(blogPost, null, 2)}

OUTPUT FORMAT:
Return ONLY a valid JSON object with the exact same structure, with all text translated to ${langName}.
The output must be valid JSON that can be parsed directly.
IMPORTANT: The "content" field should contain article body HTML only, not a full HTML page.`;
}

// Sitemap update helper function
function updateSitemap(sitemapPath, blogPost, lang) {
  const baseUrl = lang === 'en' ? 'https://teambuildpro.com'
                : lang === 'es' ? 'https://es.teambuildpro.com'
                : 'https://pt.teambuildpro.com';

  const today = getTodayDate();

  if (!fs.existsSync(sitemapPath)) {
    console.log(`${colors.yellow}⚠️  Sitemap not found: ${sitemapPath}${colors.reset}`);
    return false;
  }

  let sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

  // Check if blog post already exists in sitemap
  if (sitemapContent.includes(`${baseUrl}/blog/${blogPost.slug}.html`)) {
    console.log(`${colors.cyan}  Blog post already in ${lang.toUpperCase()} sitemap, skipping...${colors.reset}`);
    return true;
  }

  // Create new blog entry
  const blogEntry = `
  <!-- Blog Posts -->
  <url>
    <loc>${baseUrl}/blog/${blogPost.slug}.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;

  // Find the position to insert (before closing </urlset>)
  const insertPosition = sitemapContent.lastIndexOf('</urlset>');

  if (insertPosition === -1) {
    console.log(`${colors.yellow}⚠️  Could not find </urlset> in ${sitemapPath}${colors.reset}`);
    return false;
  }

  sitemapContent =
    sitemapContent.slice(0, insertPosition) +
    blogEntry +
    '\n' +
    sitemapContent.slice(insertPosition);

  fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
  console.log(`${colors.green}  ✅ Updated ${lang.toUpperCase()} sitemap${colors.reset}`);

  return true;
}

// Sanitize content - extract article body if content contains a full HTML document
function sanitizeContent(content) {
  if (!content) return '';

  // Check if content contains a full HTML document
  if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    // Try to extract content from <article> tag first
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      return articleMatch[1].trim();
    }

    // Try to extract from main content area
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) {
      // Look for article inside main
      const innerArticle = mainMatch[1].match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (innerArticle) {
        return innerArticle[1].trim();
      }
      return mainMatch[1].trim();
    }

    // Try to extract from body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      let bodyContent = bodyMatch[1];
      // Remove header and footer
      bodyContent = bodyContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
      bodyContent = bodyContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
      bodyContent = bodyContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
      bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      return bodyContent.trim();
    }
  }

  return content;
}

// Generate HTML for translated blog post
function generateTranslatedBlogHTML(blogPost, lang) {
  const baseUrl = lang === 'es' ? 'https://es.teambuildpro.com' : 'https://pt.teambuildpro.com';
  const langCode = lang === 'es' ? 'es' : 'pt';
  const langName = lang === 'es' ? 'Spanish' : 'Portuguese';

  // Sanitize content to remove any nested HTML documents
  const cleanContent = sanitizeContent(blogPost.content);

  // Format date in target language
  const dateObj = new Date(blogPost.publishDate);
  const formattedDate = lang === 'es'
    ? dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : dateObj.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' });

  // Read more text
  const readMoreText = lang === 'es' ? 'Leer Más →' : 'Ler Mais →';
  const backToBlogText = lang === 'es' ? '← Volver al Blog' : '← Voltar ao Blog';
  const relatedPostsText = lang === 'es' ? 'Artículos Relacionados' : 'Artigos Relacionados';
  const byText = lang === 'es' ? 'Por' : 'Por';

  const html = `<!DOCTYPE html>
<html lang="${langCode}" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${blogPost.title} - Team Build Pro</title>
  <meta name="description" content="${blogPost.metaDescription}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${baseUrl}/blog/${blogPost.slug}.html" />

  <!-- Open Graph Meta Tags -->
  <meta property="og:title" content="${blogPost.title}" />
  <meta property="og:description" content="${blogPost.metaDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${baseUrl}/blog/${blogPost.slug}.html" />
  <meta property="og:image" content="${baseUrl}/assets/icons/team-build-pro.png" />
  <meta property="og:site_name" content="Team Build Pro" />
  <meta property="article:published_time" content="${blogPost.publishDate}T00:00:00Z" />
  <meta property="article:author" content="${blogPost.author}" />

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${blogPost.title}" />
  <meta name="twitter:description" content="${blogPost.metaDescription}" />
  <meta name="twitter:image" content="${baseUrl}/assets/icons/team-build-pro.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <link rel="icon" href="/assets/icons/team-build-pro.png" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/icons/team-build-pro.png" />
  <link rel="stylesheet" href="/css/style.css" />
  <link rel="stylesheet" href="/css/blog-post.css" />

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${blogPost.title}",
    "description": "${blogPost.metaDescription}",
    "author": {
      "@type": "Organization",
      "name": "${blogPost.author}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Team Build Pro",
      "logo": {
        "@type": "ImageObject",
        "url": "${baseUrl}/assets/icons/team-build-pro.png"
      }
    },
    "datePublished": "${blogPost.publishDate}T00:00:00Z",
    "url": "${baseUrl}/blog/${blogPost.slug}.html"
  }
  </script>

  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-G4E4TBBPZ7"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-G4E4TBBPZ7');
  </script>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <nav class="nav container">
      <a href="${baseUrl}" class="logo">
        <img src="/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 32px; height: 32px; border-radius: 50%;">
        <span>Team Build Pro</span>
      </a>
      <button id="menu-btn" class="menu-btn" aria-label="${lang === 'es' ? 'Abrir menú' : 'Abrir menu'}" aria-haspopup="true" aria-expanded="false">
        <span aria-hidden="true" style="font-size:2rem;color:#ffffff">☰</span>
      </button>
      <div id="mobile-menu" class="mobile-menu" role="menu">
        <a href="/blog.html" role="menuitem">Blog</a>
        <a href="/faq.html" role="menuitem">FAQ</a>
        <a href="${baseUrl}/contact_us.html" role="menuitem">${lang === 'es' ? 'Contacto' : 'Contato'}</a>
      </div>
    </nav>
    <div class="language-switcher header-language-switcher">
      <a href="https://teambuildpro.com/" hreflang="en" lang="en" class="lang-link">English</a>
      <span class="lang-separator">|</span>
      ${lang === 'es' ? '<span class="lang-link active" lang="es">Español</span>' : '<a href="https://es.teambuildpro.com/" hreflang="es" lang="es" class="lang-link">Español</a>'}
      <span class="lang-separator">|</span>
      ${lang === 'pt' ? '<span class="lang-link active" lang="pt">Português</span>' : '<a href="https://pt.teambuildpro.com/" hreflang="pt" lang="pt" class="lang-link">Português</a>'}
    </div>
  </header>

  <!-- Blog Post -->
  <article class="blog-post">
    <div class="container" style="max-width:800px">

      <a href="/blog.html" class="back-link">${backToBlogText}</a>

      <header class="post-header">
        <h1>${blogPost.title}</h1>
        <div class="post-meta">
          <span class="author">${byText} ${blogPost.author}</span>
          <span class="date">${formattedDate}</span>
          <span class="category">${blogPost.category}</span>
        </div>
      </header>

      <div class="post-content">
        ${cleanContent}
      </div>

    </div>
  </article>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-logo">
        <img src="/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 32px; height: 32px; border-radius: 50%;">
        <span>Team Build Pro</span>
      </div>
      <div class="footer-links">
        <a href="/faq.html">FAQ</a>
        <a href="${baseUrl}/contact_us.html">${lang === 'es' ? 'Contacto' : 'Contato'}</a>
        <a href="${baseUrl}/privacy_policy.html">${lang === 'es' ? 'Política de Privacidad' : 'Política de Privacidade'}</a>
        <a href="${baseUrl}/terms_of_service.html">${lang === 'es' ? 'Términos de Servicio' : 'Termos de Serviço'}</a>
      </div>
      <p>&copy; 2025 Team Build Pro. ${lang === 'es' ? 'Todos los derechos reservados.' : 'Todos os Direitos Reservados.'}</p>
    </div>
  </footer>

  <script>
    document.getElementById('menu-btn').addEventListener('click', function() {
      const menu = document.getElementById('mobile-menu');
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      menu.style.display = isExpanded ? 'none' : 'flex';
    });
  </script>

</body>
</html>`;

  return html;
}

// Generate the AI prompt for Claude Code
function generatePrompt(title, category, keywords, extraNotes) {
  const slug = generateSlug(title);
  const date = getTodayDate();

  const extraSection = extraNotes
    ? `\n${colors.bright}ADDITIONAL CONTEXT / ANGLE:${colors.reset}\n${extraNotes}\n`
    : '';

  return `
${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}${colors.blue}AI BLOG GENERATION PROMPT FOR CLAUDE CODE${colors.reset}
${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}

${colors.yellow}Copy the text below and paste it into Claude Code:${colors.reset}

${colors.bright}────────────────────────────────────────────────────────────────────${colors.reset}

Generate a comprehensive, SEO-optimized blog post for Team Build Pro with the following requirements:

${colors.bright}TITLE:${colors.reset} "${title}"
${colors.bright}CATEGORY:${colors.reset} ${category}
${colors.bright}TARGET KEYWORDS:${colors.reset} ${keywords || 'ai recruiting, direct sales, team building, network marketing'}${extraSection}${colors.bright}SLUG:${colors.reset} ${slug}
${colors.bright}PUBLISH DATE:${colors.reset} ${date}

${colors.bright}SEO REQUIREMENTS:${colors.reset}
- Word count: 1,500-2,500 words (optimal for SEO ranking)
- Include 5-8 H2 headings (clear hierarchy)
- Include 10-15 H3 subheadings where appropriate
- Use <ul class="checklist"> for actionable bullet points
- Include real examples, statistics, or case studies
- Add <p class="note"> callout boxes for key insights/tips
- Include internal links to /companies.html or specific company pages
- Use <div class="divider"></div> before final CTA
- Meta description: 150-160 characters
- Excerpt: 140-160 characters

${colors.bright}BRAND VOICE & STYLE:${colors.reset}
- Direct, actionable, no fluff or filler content
- Focus on practical strategies over theory
- Use specific examples and data points
- Speak directly to direct sales professionals and network marketers
- Emphasize Team Build Pro's unique pre-qualification approach
- Professional but conversational tone
- No emojis in content (only in examples if relevant)

${colors.bright}CONTENT STRUCTURE:${colors.reset}
1. **Opening Hook** (1-2 paragraphs)
   - Address a specific pain point or challenge
   - Make it relatable and urgent

2. **Why This Matters Now** (1 H2 section)
   - Current trends or context
   - Why traditional approaches fail
   - What's changed in 2025

3. **Main Content** (5-7 H2 sections)
   - Each section should be 200-400 words
   - Include H3 subheadings for deeper topics
   - Use checklists for actionable items
   - Include note boxes for pro tips or warnings

4. **Real-World Examples** (integrate throughout)
   - Specific scenarios or case studies
   - "Before/after" comparisons
   - Testimonial-style quotes (can be synthesized)

5. **Implementation Steps** (1 H2 section)
   - Step-by-step action plan
   - Use ordered list or checklist format

6. **Common Mistakes** (optional H2 section)
   - What NOT to do
   - How to avoid pitfalls

7. **Conclusion** (final paragraph before CTA)
   - Summarize key takeaways
   - Reinforce main benefit
   - Lead into CTA

8. **CTA Section** (after divider)
   - Strong call to action
   - Reference Team Build Pro features
   - Encourage download or trial

${colors.bright}INTERNAL LINKING:${colors.reset}
- Link to /companies.html when mentioning company-specific strategies
- Link to specific company pages like /companies/ai-recruiting-young-living.html
- Link to other blog posts if relevant (use realistic URLs like /blog/other-post-slug.html)
- Link to /faq.html or /contact_us.html where appropriate

${colors.bright}OUTPUT FORMAT:${colors.reset}
Provide the complete blog post as a JavaScript object ready to add to the blogPosts array.
Use the EXACT format below (with proper template literal backticks for content):

{
  slug: "${slug}",
  title: "${title}",
  excerpt: "Your 140-160 character excerpt here that hooks the reader...",
  category: "${category}",
  author: "Team Build Pro",
  publishDate: "${date}",
  metaDescription: "Your 150-160 character meta description optimized for search engines...",
  featured: false,
  content: \`
    <p>Your opening paragraph that addresses the pain point...</p>

    <h2>Your First H2 Heading</h2>
    <p>Content for this section...</p>

    <ul class="checklist">
      <li>Actionable item 1</li>
      <li>Actionable item 2</li>
    </ul>

    <p class="note"><strong>Pro Tip:</strong> Your insightful tip here...</p>

    <!-- Continue with full content structure -->

    <div class="divider"></div>

    <p><strong>Ready to [action]?</strong> Download Team Build Pro and [specific benefit].</p>
  \`
}

${colors.bright}IMPORTANT:${colors.reset}
- Ensure content is original and valuable (not generic)
- Focus on Team Build Pro's unique 30-day pre-qualification approach
- Include specific tactics readers can implement immediately
- Make it comprehensive enough to rank for target keywords
- Maintain professional quality throughout

${colors.bright}────────────────────────────────────────────────────────────────────${colors.reset}

${colors.green}After Claude Code generates the blog post:${colors.reset}
1. Copy the entire JavaScript object (including the outer { } braces)
2. Save it to: ${colors.cyan}scripts/blog-response.json${colors.reset}
3. Run: ${colors.yellow}node scripts/generate-ai-blog.js --import=scripts/blog-response.json${colors.reset}

${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}
`;
}

// Process imported blog post
async function processImport(importFile) {
  console.log(`\n${colors.blue}📥 Processing imported blog post...${colors.reset}\n`);

  const filePath = path.resolve(importFile);

  if (!fs.existsSync(filePath)) {
    console.error(`${colors.yellow}❌ Error: File not found: ${filePath}${colors.reset}`);
    process.exit(1);
  }

  let blogPost;
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    blogPost = JSON.parse(fileContent);
  } catch (error) {
    console.error(`${colors.yellow}❌ Error parsing JSON: ${error.message}${colors.reset}`);
    console.log(`\n${colors.cyan}💡 Tip: Make sure the file contains a valid JavaScript object in JSON format${colors.reset}`);
    process.exit(1);
  }

  // Validate the blog post
  console.log(`${colors.cyan}🔍 Validating blog post...${colors.reset}\n`);
  const errors = validateBlogPost(blogPost);

  if (errors.length > 0) {
    console.error(`${colors.yellow}❌ Validation failed with ${errors.length} error(s):${colors.reset}\n`);
    errors.forEach(error => console.error(`   • ${error}`));
    console.log(`\n${colors.cyan}💡 Please fix these issues and try again${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✅ Validation passed!${colors.reset}\n`);

  // Display blog post summary
  console.log(`${colors.bright}Blog Post Summary:${colors.reset}`);
  console.log(`  Title: ${blogPost.title}`);
  console.log(`  Category: ${blogPost.category}`);
  console.log(`  Slug: ${blogPost.slug}`);
  console.log(`  Word count: ~${Math.round(blogPost.content.length / 5)} words`);
  console.log(`  Character count: ${blogPost.content.length}`);
  console.log(`  Excerpt length: ${blogPost.excerpt.length} chars`);
  console.log(`  Meta desc length: ${blogPost.metaDescription.length} chars`);

  // Add to generate-blog.js
  const generateBlogPath = path.join(__dirname, 'generate-blog.js');
  let generateBlogContent = fs.readFileSync(generateBlogPath, 'utf8');

  // Find the blogPosts array and add the new post
  const blogPostString = `  ${JSON.stringify(blogPost, null, 2).replace(/\n/g, '\n  ')},\n`;
  const insertPosition = generateBlogContent.indexOf('];\n');

  if (insertPosition === -1) {
    console.error(`${colors.yellow}❌ Error: Could not find blogPosts array in generate-blog.js${colors.reset}`);
    process.exit(1);
  }

  // Ensure previous entry has a trailing comma
  const contentBeforeInsert = generateBlogContent.slice(0, insertPosition);
  const lastClosingBrace = contentBeforeInsert.lastIndexOf('}');
  if (lastClosingBrace !== -1) {
    const afterBrace = contentBeforeInsert.slice(lastClosingBrace + 1).trim();
    if (afterBrace === '' || afterBrace === '\n') {
      // No comma after the last closing brace - add one
      generateBlogContent =
        generateBlogContent.slice(0, lastClosingBrace + 1) +
        ',' +
        generateBlogContent.slice(lastClosingBrace + 1);
    }
  }

  // Recalculate insert position after potential comma insertion
  const newInsertPosition = generateBlogContent.indexOf('];\n');
  generateBlogContent =
    generateBlogContent.slice(0, newInsertPosition) +
    blogPostString +
    generateBlogContent.slice(newInsertPosition);

  fs.writeFileSync(generateBlogPath, generateBlogContent, 'utf8');

  console.log(`\n${colors.green}✅ Blog post added to generate-blog.js${colors.reset}`);

  // Generate HTML files
  console.log(`\n${colors.cyan}🔨 Generating HTML files...${colors.reset}\n`);

  try {
    const { execSync } = require('child_process');
    execSync('node scripts/generate-blog.js', { stdio: 'inherit' });

    console.log(`\n${colors.green}✅ English blog HTML files generated successfully!${colors.reset}`);

    // Multilingual translation workflow - FULLY AUTOMATED
    console.log(`\n${colors.bright}${colors.blue}🌍 Starting automated multilingual translation workflow...${colors.reset}\n`);

    // Spanish translation
    console.log(`${colors.cyan}📝 Requesting Spanish translation from Claude Code API...${colors.reset}`);
    const spanishPrompt = generateTranslationPrompt(blogPost, 'es');

    try {
      // Call Claude Code API for Spanish translation
      const spanishTranslation = await callClaudeForTranslation(spanishPrompt, 'Spanish');
      const spanishTransFile = path.join(__dirname, 'spanish-translation.json');
      fs.writeFileSync(spanishTransFile, JSON.stringify(spanishTranslation, null, 2), 'utf8');
      console.log(`${colors.green}  ✅ Spanish translation received and saved${colors.reset}`);

      // Generate Spanish HTML
      const spanishHTML = generateTranslatedBlogHTML(spanishTranslation, 'es');
      const spanishPath = path.join(__dirname, '..', 'web-es', 'blog', `${blogPost.slug}.html`);
      fs.writeFileSync(spanishPath, spanishHTML, 'utf8');
      console.log(`${colors.green}  ✅ Spanish blog created: ${colors.cyan}web-es/blog/${blogPost.slug}.html${colors.reset}`);

      // Update Spanish sitemap
      const spanishSitemapPath = path.join(__dirname, '..', 'web-es', 'sitemap.xml');
      updateSitemap(spanishSitemapPath, blogPost, 'es');

    } catch (error) {
      console.error(`${colors.yellow}⚠️  Error with Spanish translation: ${error.message}${colors.reset}`);
      console.log(`${colors.cyan}  Falling back to manual translation workflow...${colors.reset}`);
      const spanishPromptFile = path.join(__dirname, 'spanish-translation-prompt.txt');
      fs.writeFileSync(spanishPromptFile, spanishPrompt, 'utf8');
      console.log(`${colors.yellow}  📝 Spanish prompt saved to: scripts/spanish-translation-prompt.txt${colors.reset}`);
    }

    // Portuguese translation
    console.log(`\n${colors.cyan}📝 Requesting Portuguese translation from Claude Code API...${colors.reset}`);
    const portuguesePrompt = generateTranslationPrompt(blogPost, 'pt');

    try {
      // Call Claude Code API for Portuguese translation
      const portugueseTranslation = await callClaudeForTranslation(portuguesePrompt, 'Portuguese');
      const portugueseTransFile = path.join(__dirname, 'portuguese-translation.json');
      fs.writeFileSync(portugueseTransFile, JSON.stringify(portugueseTranslation, null, 2), 'utf8');
      console.log(`${colors.green}  ✅ Portuguese translation received and saved${colors.reset}`);

      // Generate Portuguese HTML
      const portugueseHTML = generateTranslatedBlogHTML(portugueseTranslation, 'pt');
      const portuguesePath = path.join(__dirname, '..', 'web-pt', 'blog', `${blogPost.slug}.html`);
      fs.writeFileSync(portuguesePath, portugueseHTML, 'utf8');
      console.log(`${colors.green}  ✅ Portuguese blog created: ${colors.cyan}web-pt/blog/${blogPost.slug}.html${colors.reset}`);

      // Update Portuguese sitemap
      const portugueseSitemapPath = path.join(__dirname, '..', 'web-pt', 'sitemap.xml');
      updateSitemap(portugueseSitemapPath, blogPost, 'pt');

    } catch (error) {
      console.error(`${colors.yellow}⚠️  Error with Portuguese translation: ${error.message}${colors.reset}`);
      console.log(`${colors.cyan}  Falling back to manual translation workflow...${colors.reset}`);
      const portuguesePromptFile = path.join(__dirname, 'portuguese-translation-prompt.txt');
      fs.writeFileSync(portuguesePromptFile, portuguesePrompt, 'utf8');
      console.log(`${colors.yellow}  📝 Portuguese prompt saved to: scripts/portuguese-translation-prompt.txt${colors.reset}`);
    }

    console.log(`\n${colors.green}🎉 All translations complete!${colors.reset}\n`)

    // Update English sitemap
    console.log(`${colors.cyan}📋 Updating English sitemap...${colors.reset}`);
    const englishSitemapPath = path.join(__dirname, '..', 'web', 'sitemap.xml');
    updateSitemap(englishSitemapPath, blogPost, 'en');

    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Review the generated files:`);
    console.log(`     ${colors.cyan}web/blog/${blogPost.slug}.html${colors.reset}`);
    console.log(`     ${colors.cyan}web/blog.html${colors.reset} (updated index)`);
    if (fs.existsSync(spanishTransFile) && fs.existsSync(portugueseTransFile)) {
      console.log(`     ${colors.cyan}web-es/blog/${blogPost.slug}.html${colors.reset}`);
      console.log(`     ${colors.cyan}web-pt/blog/${blogPost.slug}.html${colors.reset}`);
    }
    console.log(`  2. Deploy: ${colors.yellow}firebase deploy --only hosting${colors.reset}`);
    console.log(`\n${colors.green}🎉 Blog creation complete!${colors.reset}\n`);

  } catch (error) {
    console.error(`\n${colors.yellow}❌ Error generating HTML: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Full automation mode - generates blog in all languages with a single command
async function runFullAutomation(title, category, keywords, extraNotes) {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}   FULL AUTOMATION MODE - Generating blog in EN, ES, PT${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.cyan}Title:${colors.reset} ${title}`);
  console.log(`${colors.cyan}Category:${colors.reset} ${category}`);
  if (keywords) console.log(`${colors.cyan}Keywords:${colors.reset} ${keywords}`);
  if (extraNotes) console.log(`${colors.cyan}Notes:${colors.reset} ${extraNotes}`);
  console.log('');

  const slug = generateSlug(title);

  // Step 1: Generate blog content via Claude
  console.log(`${colors.bright}${colors.yellow}Step 1/6:${colors.reset} Generating blog content via Claude API...`);
  console.log(`${colors.cyan}  This may take 1-2 minutes...${colors.reset}\n`);

  const blogPrompt = generateBlogPromptPlain(title, category, keywords, extraNotes);

  // Save prompt for debugging
  const promptLogFile = path.join(__dirname, 'last-blog-prompt.txt');
  fs.writeFileSync(promptLogFile, blogPrompt, 'utf8');
  console.log(`${colors.cyan}  Prompt saved to: scripts/last-blog-prompt.txt${colors.reset}\n`);

  let blogPost;
  try {
    const response = await callClaudeWithStdin(blogPrompt, 'blog generation', 300000);
    blogPost = extractJsonFromResponse(response);
    console.log(`${colors.green}  ✅ Blog content generated successfully${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.yellow}❌ Error generating blog content: ${error.message}${colors.reset}`);
    console.log(`\n${colors.cyan}Tip: Try running the prompt manually:${colors.reset}`);
    const prompt = generatePrompt(title, category, keywords, extraNotes);
    console.log(prompt);
    process.exit(1);
  }

  // Step 2: Validate blog content
  console.log(`${colors.bright}${colors.yellow}Step 2/6:${colors.reset} Validating blog content...`);
  const errors = validateBlogPost(blogPost);
  if (errors.length > 0) {
    console.error(`${colors.yellow}⚠️  Validation warnings (${errors.length}):${colors.reset}`);
    errors.forEach(error => console.log(`   • ${error}`));
    console.log(`${colors.cyan}  Proceeding with generation despite warnings...${colors.reset}\n`);
  } else {
    console.log(`${colors.green}  ✅ Validation passed${colors.reset}\n`);
  }

  // Save raw blog response
  const blogResponseFile = path.join(__dirname, 'blog-response.json');
  fs.writeFileSync(blogResponseFile, JSON.stringify(blogPost, null, 2), 'utf8');
  console.log(`${colors.cyan}  Saved raw response to: scripts/blog-response.json${colors.reset}\n`);

  // Step 3: Add to generate-blog.js and generate English HTML
  console.log(`${colors.bright}${colors.yellow}Step 3/6:${colors.reset} Adding blog to database and generating English HTML...`);

  const generateBlogPath = path.join(__dirname, 'generate-blog.js');
  let generateBlogContent = fs.readFileSync(generateBlogPath, 'utf8');

  const blogPostString = `  ${JSON.stringify(blogPost, null, 2).replace(/\n/g, '\n  ')},\n`;
  const insertPosition = generateBlogContent.indexOf('];\n');

  if (insertPosition === -1) {
    console.error(`${colors.yellow}❌ Error: Could not find blogPosts array in generate-blog.js${colors.reset}`);
    process.exit(1);
  }

  generateBlogContent =
    generateBlogContent.slice(0, insertPosition) +
    blogPostString +
    generateBlogContent.slice(insertPosition);

  fs.writeFileSync(generateBlogPath, generateBlogContent, 'utf8');
  console.log(`${colors.green}  ✅ Added blog post to generate-blog.js${colors.reset}`);

  // Generate HTML
  const { execSync } = require('child_process');
  execSync('node scripts/generate-blog.js', { stdio: 'inherit' });
  console.log(`${colors.green}  ✅ English HTML files generated${colors.reset}\n`);

  // Update English sitemap
  const englishSitemapPath = path.join(__dirname, '..', 'web', 'sitemap.xml');
  updateSitemap(englishSitemapPath, blogPost, 'en');

  // Step 4: Generate Spanish translation
  console.log(`${colors.bright}${colors.yellow}Step 4/6:${colors.reset} Generating Spanish translation...`);
  const spanishPrompt = generateTranslationPrompt(blogPost, 'es');

  try {
    const spanishTranslation = await callClaudeForTranslation(spanishPrompt, 'Spanish');
    const spanishTransFile = path.join(__dirname, 'spanish-translation.json');
    fs.writeFileSync(spanishTransFile, JSON.stringify(spanishTranslation, null, 2), 'utf8');
    console.log(`${colors.green}  ✅ Spanish translation received${colors.reset}`);

    // Generate Spanish HTML
    const spanishHTML = generateTranslatedBlogHTML(spanishTranslation, 'es');
    const spanishPath = path.join(__dirname, '..', 'web-es', 'blog', `${blogPost.slug}.html`);
    fs.writeFileSync(spanishPath, spanishHTML, 'utf8');
    console.log(`${colors.green}  ✅ Spanish blog created: web-es/blog/${blogPost.slug}.html${colors.reset}`);

    // Update Spanish sitemap
    const spanishSitemapPath = path.join(__dirname, '..', 'web-es', 'sitemap.xml');
    updateSitemap(spanishSitemapPath, blogPost, 'es');
    console.log('');
  } catch (error) {
    console.error(`${colors.yellow}⚠️  Spanish translation failed: ${error.message}${colors.reset}`);
    console.log(`${colors.cyan}  Saved prompt to scripts/spanish-translation-prompt.txt for manual retry${colors.reset}\n`);
    fs.writeFileSync(path.join(__dirname, 'spanish-translation-prompt.txt'), spanishPrompt, 'utf8');
  }

  // Step 5: Generate Portuguese translation
  console.log(`${colors.bright}${colors.yellow}Step 5/6:${colors.reset} Generating Portuguese translation...`);
  const portuguesePrompt = generateTranslationPrompt(blogPost, 'pt');

  try {
    const portugueseTranslation = await callClaudeForTranslation(portuguesePrompt, 'Portuguese');
    const portugueseTransFile = path.join(__dirname, 'portuguese-translation.json');
    fs.writeFileSync(portugueseTransFile, JSON.stringify(portugueseTranslation, null, 2), 'utf8');
    console.log(`${colors.green}  ✅ Portuguese translation received${colors.reset}`);

    // Generate Portuguese HTML
    const portugueseHTML = generateTranslatedBlogHTML(portugueseTranslation, 'pt');
    const portuguesePath = path.join(__dirname, '..', 'web-pt', 'blog', `${blogPost.slug}.html`);
    fs.writeFileSync(portuguesePath, portugueseHTML, 'utf8');
    console.log(`${colors.green}  ✅ Portuguese blog created: web-pt/blog/${blogPost.slug}.html${colors.reset}`);

    // Update Portuguese sitemap
    const portugueseSitemapPath = path.join(__dirname, '..', 'web-pt', 'sitemap.xml');
    updateSitemap(portugueseSitemapPath, blogPost, 'pt');
    console.log('');
  } catch (error) {
    console.error(`${colors.yellow}⚠️  Portuguese translation failed: ${error.message}${colors.reset}`);
    console.log(`${colors.cyan}  Saved prompt to scripts/portuguese-translation-prompt.txt for manual retry${colors.reset}\n`);
    fs.writeFileSync(path.join(__dirname, 'portuguese-translation-prompt.txt'), portuguesePrompt, 'utf8');
  }

  // Step 6: Summary
  console.log(`${colors.bright}${colors.yellow}Step 6/6:${colors.reset} Complete!\n`);

  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}   BLOG GENERATION COMPLETE${colors.reset}`);
  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.bright}Generated files:${colors.reset}`);
  console.log(`  ${colors.cyan}English:${colors.reset}    web/blog/${blogPost.slug}.html`);
  console.log(`  ${colors.cyan}Spanish:${colors.reset}    web-es/blog/${blogPost.slug}.html`);
  console.log(`  ${colors.cyan}Portuguese:${colors.reset} web-pt/blog/${blogPost.slug}.html`);

  console.log(`\n${colors.bright}Blog summary:${colors.reset}`);
  console.log(`  Title: ${blogPost.title}`);
  console.log(`  Slug: ${blogPost.slug}`);
  console.log(`  Category: ${blogPost.category}`);
  console.log(`  Content length: ~${Math.round(blogPost.content.length / 5)} words`);

  console.log(`\n${colors.bright}Next step:${colors.reset}`);
  console.log(`  ${colors.yellow}firebase deploy --only hosting${colors.reset}`);
  console.log('');
}

// Generate research prompt for trend analysis
function generateResearchPrompt() {
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dateRange = `${oneWeekAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`;

  return `You are a research analyst specializing in direct sales, network marketing, MLM, AI technology, and recruiting trends.

TASK: Conduct deep research on what's being discussed in the direct sales/network marketing/MLM industry within the past week (${dateRange}). Identify trending topics, emerging narratives, and content gaps that would make excellent blog topics for Team Build Pro.

RESEARCH SOURCES TO ANALYZE:
1. BusinessForHome.org - Industry news, company updates, momentum rankings
2. Direct Selling News - Industry publications and thought leadership
3. Social media trends - LinkedIn, Facebook, Twitter/X discussions in MLM/direct sales communities
4. Software vendor announcements - MLM software, AI tools for direct sales
5. Training/coaching content - What leaders and trainers are teaching
6. Compliance/legal updates - Regulatory changes affecting the industry
7. AI/technology integration - How companies are adopting AI

ANALYSIS FRAMEWORK:
1. What are the HOT TOPICS being discussed this week?
2. What GAPS exist in current coverage that Team Build Pro can fill?
3. What is the UNIQUE ANGLE Team Build Pro can offer (field-level practical advice vs corporate/vendor content)?
4. What PAIN POINTS are distributors discussing that need solutions?

TEAM BUILD PRO POSITIONING:
- Team Build Pro is an AI-powered recruiting app for direct sales professionals
- Unique value: Helps prospects pre-build their teams BEFORE joining a business opportunity
- Focus: Practical, field-level advice (not corporate/vendor perspective)
- Target audience: Direct sales professionals and network marketers
- Differentiator: 30-day pre-qualification approach, 16 pre-written messages, AI Coach

OUTPUT FORMAT:
Return a JSON object with exactly this structure:

{
  "researchDate": "${today.toISOString().split('T')[0]}",
  "industryTrends": [
    {
      "trend": "Brief description of the trend",
      "sources": ["Source 1", "Source 2"],
      "relevance": "Why this matters to Team Build Pro audience"
    }
  ],
  "contentGaps": [
    {
      "gap": "What's NOT being covered well",
      "opportunity": "How Team Build Pro can fill this gap"
    }
  ],
  "recommendations": [
    {
      "rank": 1,
      "title": "SEO-optimized blog title",
      "category": "Recruiting Tips|Product Updates|Tutorials",
      "keywords": "comma, separated, seo, keywords",
      "notes": "Detailed angle and context for the blog post - what specific points to cover, what examples to use, what makes this timely and relevant",
      "urgency": "high|medium|low",
      "reasoning": "Why this topic now, what gap it fills, expected audience interest"
    }
  ]
}

REQUIREMENTS:
- Provide 5-10 blog recommendations, ranked by relevance and timeliness
- Each recommendation must have actionable notes that can be passed to the blog generator
- Focus on topics where Team Build Pro's unique perspective adds value
- Prioritize evergreen content that will rank well in search
- Ensure titles are SEO-optimized (include relevant keywords naturally)
- Return ONLY the JSON object, no other text`;
}

// Run research mode - analyze trends and recommend topics
async function runResearchMode() {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}   RESEARCH MODE - Analyzing Industry Trends${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`${colors.cyan}Researching direct sales, network marketing, MLM, AI, and recruiting trends...${colors.reset}`);
  console.log(`${colors.cyan}This may take 2-3 minutes...${colors.reset}\n`);

  const researchPrompt = generateResearchPrompt();

  const promptLogFile = path.join(__dirname, 'last-research-prompt.txt');
  fs.writeFileSync(promptLogFile, researchPrompt, 'utf8');

  try {
    const response = await callClaudeWithStdin(researchPrompt, 'industry research', 300000);
    const research = extractJsonFromResponse(response);

    const outputFile = path.join(__dirname, 'blog-recommendations.json');
    fs.writeFileSync(outputFile, JSON.stringify(research, null, 2), 'utf8');

    console.log(`${colors.green}\n✅ Research complete!${colors.reset}\n`);
    console.log(`${colors.bright}Industry Trends Identified:${colors.reset}`);
    if (research.industryTrends) {
      research.industryTrends.forEach((trend, i) => {
        console.log(`  ${i + 1}. ${trend.trend}`);
      });
    }

    console.log(`\n${colors.bright}Content Gaps Found:${colors.reset}`);
    if (research.contentGaps) {
      research.contentGaps.forEach((gap, i) => {
        console.log(`  ${i + 1}. ${gap.gap}`);
      });
    }

    console.log(`\n${colors.bright}Blog Recommendations (ranked):${colors.reset}`);
    if (research.recommendations) {
      research.recommendations.forEach((rec, i) => {
        const urgencyColor = rec.urgency === 'high' ? colors.yellow : rec.urgency === 'medium' ? colors.cyan : colors.reset;
        console.log(`\n  ${colors.bright}#${rec.rank || i + 1}:${colors.reset} ${rec.title}`);
        console.log(`      Category: ${rec.category}`);
        console.log(`      Keywords: ${rec.keywords}`);
        console.log(`      Urgency: ${urgencyColor}${rec.urgency}${colors.reset}`);
        console.log(`      Notes: ${rec.notes.substring(0, 100)}...`);
      });
    }

    console.log(`\n${colors.bright}Saved to:${colors.reset} ${colors.cyan}scripts/blog-recommendations.json${colors.reset}`);
    console.log(`\n${colors.bright}To generate the top recommendation:${colors.reset}`);
    if (research.recommendations && research.recommendations[0]) {
      const top = research.recommendations[0];
      console.log(`  ${colors.yellow}node scripts/generate-ai-blog.js "${top.title}" --keywords="${top.keywords}" --notes="${top.notes.substring(0, 100)}..." --generate${colors.reset}`);
    }
    console.log('');

    return research;
  } catch (error) {
    console.error(`${colors.yellow}❌ Research failed: ${error.message}${colors.reset}`);
    throw error;
  }
}

// Send email notification via Mailgun
async function sendEmailNotification(subject, htmlBody, textBody, toEmail) {
  const axios = require('axios');
  const FormData = require('form-data');

  const mailgunApiKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = 'notify.teambuildpro.com';

  if (!mailgunApiKey) {
    console.log(`${colors.yellow}⚠️  MAILGUN_API_KEY not set, skipping email notification${colors.reset}`);
    return false;
  }

  try {
    const form = new FormData();
    form.append('from', 'Team Build Pro Blog Bot <blog@notify.teambuildpro.com>');
    form.append('to', toEmail);
    form.append('subject', subject);
    form.append('html', htmlBody);
    form.append('text', textBody);

    await axios.post(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from('api:' + mailgunApiKey).toString('base64')}`
      }
    });

    console.log(`${colors.green}✅ Email notification sent to ${toEmail}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.yellow}⚠️  Failed to send email: ${error.message}${colors.reset}`);
    return false;
  }
}

// Deploy to Firebase Hosting
async function deployToFirebase() {
  const { execSync } = require('child_process');

  console.log(`${colors.cyan}Deploying to Firebase Hosting...${colors.reset}`);

  try {
    execSync('firebase deploy --only hosting:main,hosting:es,hosting:pt --project teambuilder-plus-fe74d', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      timeout: 300000
    });
    console.log(`${colors.green}✅ Firebase deployment complete${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.yellow}⚠️  Firebase deployment failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Full automation mode: research -> generate -> deploy -> notify
async function runFullAutoMode(emailTo) {
  const startTime = Date.now();
  let blogPost = null;
  let deploySuccess = false;
  let errors = [];

  console.log(`\n${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}   FULL AUTOMATION MODE${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}   Research → Generate → Deploy → Notify${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  try {
    console.log(`${colors.bright}${colors.yellow}Step 1/4:${colors.reset} Researching industry trends...\n`);
    const research = await runResearchMode();

    if (!research.recommendations || research.recommendations.length === 0) {
      throw new Error('No blog recommendations generated from research');
    }

    const topRec = research.recommendations[0];
    console.log(`\n${colors.bright}${colors.yellow}Step 2/4:${colors.reset} Generating blog from top recommendation...`);
    console.log(`  Title: ${topRec.title}`);
    console.log(`  Category: ${topRec.category}`);
    console.log(`  Keywords: ${topRec.keywords}\n`);

    await runFullAutomation(topRec.title, topRec.category, topRec.keywords, topRec.notes);

    const blogResponseFile = path.join(__dirname, 'blog-response.json');
    if (fs.existsSync(blogResponseFile)) {
      blogPost = JSON.parse(fs.readFileSync(blogResponseFile, 'utf8'));
    }

    console.log(`\n${colors.bright}${colors.yellow}Step 3/4:${colors.reset} Deploying to Firebase Hosting...\n`);
    deploySuccess = await deployToFirebase();
    if (!deploySuccess) {
      errors.push('Firebase deployment failed');
    }

  } catch (error) {
    errors.push(error.message);
    console.error(`${colors.yellow}❌ Error during automation: ${error.message}${colors.reset}`);
  }

  console.log(`\n${colors.bright}${colors.yellow}Step 4/4:${colors.reset} Sending email notification...\n`);

  const duration = Math.round((Date.now() - startTime) / 1000 / 60);
  const status = errors.length === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS';

  const htmlBody = `
    <h2>Team Build Pro Blog Automation - ${status}</h2>
    <p><strong>Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST</p>
    <p><strong>Duration:</strong> ${duration} minutes</p>
    ${blogPost ? `
      <h3>Blog Generated:</h3>
      <ul>
        <li><strong>Title:</strong> ${blogPost.title}</li>
        <li><strong>Category:</strong> ${blogPost.category}</li>
        <li><strong>Slug:</strong> ${blogPost.slug}</li>
        <li><strong>Word Count:</strong> ~${Math.round(blogPost.content.length / 5)} words</li>
      </ul>
      <h3>Published URLs:</h3>
      <ul>
        <li><a href="https://teambuildpro.com/blog/${blogPost.slug}.html">English</a></li>
        <li><a href="https://es.teambuildpro.com/blog/${blogPost.slug}.html">Spanish</a></li>
        <li><a href="https://pt.teambuildpro.com/blog/${blogPost.slug}.html">Portuguese</a></li>
      </ul>
    ` : '<p>No blog was generated.</p>'}
    ${errors.length > 0 ? `
      <h3>Errors:</h3>
      <ul>
        ${errors.map(e => `<li>${e}</li>`).join('')}
      </ul>
    ` : ''}
    <hr>
    <p><em>This is an automated message from Team Build Pro Blog Bot</em></p>
  `;

  const textBody = `Team Build Pro Blog Automation - ${status}
Date: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PST
Duration: ${duration} minutes
${blogPost ? `
Blog Generated:
- Title: ${blogPost.title}
- Category: ${blogPost.category}
- Slug: ${blogPost.slug}

Published URLs:
- English: https://teambuildpro.com/blog/${blogPost.slug}.html
- Spanish: https://es.teambuildpro.com/blog/${blogPost.slug}.html
- Portuguese: https://pt.teambuildpro.com/blog/${blogPost.slug}.html
` : 'No blog was generated.'}
${errors.length > 0 ? `Errors: ${errors.join(', ')}` : ''}
`;

  await sendEmailNotification(
    `[Blog Bot] ${status}: ${blogPost ? blogPost.title : 'Automation Run'}`,
    htmlBody,
    textBody,
    emailTo
  );

  console.log(`\n${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}   FULL AUTOMATION COMPLETE - ${status}${colors.reset}`);
  console.log(`${colors.bright}${colors.green}═══════════════════════════════════════════════════════════════════${colors.reset}\n`);

  if (blogPost) {
    console.log(`${colors.bright}Published:${colors.reset}`);
    console.log(`  English:    https://teambuildpro.com/blog/${blogPost.slug}.html`);
    console.log(`  Spanish:    https://es.teambuildpro.com/blog/${blogPost.slug}.html`);
    console.log(`  Portuguese: https://pt.teambuildpro.com/blog/${blogPost.slug}.html`);
  }
  console.log('');

  return { blogPost, deploySuccess, errors };
}

// Main execution
async function main() {
  console.log(`\n${colors.bright}${colors.blue}Team Build Pro - AI Blog Generator${colors.reset}\n`);

  // Full auto mode: research -> generate -> deploy -> notify
  if (fullAutoFlag) {
    await runFullAutoMode(notifyEmail);
    return;
  }

  // Research mode: analyze trends and recommend topics
  if (researchFlag) {
    await runResearchMode();
    return;
  }

  // If importing, process the import
  if (importFile) {
    await processImport(importFile);
    return;
  }

  // Validate inputs
  if (!title) {
    console.log(`${colors.yellow}Usage:${colors.reset}`);
    console.log(`\n${colors.bright}Full automation (research + generate + deploy + notify):${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js --full-auto${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js --full-auto --notify-email="your@email.com"${colors.reset}`);
    console.log(`\n${colors.bright}Research mode (analyze trends, recommend topics):${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js --research${colors.reset}`);
    console.log(`\n${colors.bright}Generate mode (create blog from title):${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --generate${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --keywords="..." --notes="..." --generate${colors.reset}`);
    console.log(`\n${colors.bright}Prompt-only mode (manual workflow):${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title Here"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" "Additional context or angle"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --notes="Focus on X"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --category="Tutorials"${colors.reset}`);
    console.log(`\n${colors.bright}Import mode (from saved JSON):${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js --import=scripts/blog-response.json${colors.reset}`);
    console.log(`\n${colors.bright}Valid categories:${colors.reset} ${validCategories.join(', ')}`);
    console.log(`\n${colors.bright}Flags:${colors.reset}`);
    console.log(`  ${colors.cyan}--full-auto${colors.reset}         Complete automation: research + generate + deploy + email`);
    console.log(`  ${colors.cyan}--research${colors.reset}          Analyze trends and recommend blog topics`);
    console.log(`  ${colors.cyan}--generate${colors.reset}          Generate EN, ES, PT blogs from title`);
    console.log(`  ${colors.cyan}--notify-email=...${colors.reset} Email for notifications (default: scscot@gmail.com)`);
    console.log(`  ${colors.cyan}--category="..."${colors.reset}   Set blog category (default: Recruiting Tips)`);
    console.log(`  ${colors.cyan}--keywords="..."${colors.reset}   Set target SEO keywords`);
    console.log(`  ${colors.cyan}--notes="..."${colors.reset}      Add extra context or angle for the blog`);
    console.log(`  ${colors.cyan}--import=file${colors.reset}      Import blog from JSON file`);
    console.log('');
    process.exit(1);
  }

  if (!validCategories.includes(category)) {
    console.error(`${colors.yellow}❌ Invalid category: "${category}"${colors.reset}`);
    console.log(`${colors.cyan}Valid categories: ${validCategories.join(', ')}${colors.reset}\n`);
    process.exit(1);
  }

  // Full automation mode
  if (generateFlag) {
    if (!title) {
      console.error(`${colors.yellow}Error: Title is required when using --generate${colors.reset}`);
      process.exit(1);
    }
    await runFullAutomation(title, category, keywords, extraNotes);
    return;
  }

  // Prompt-only mode: generate and display the prompt
  const prompt = generatePrompt(title, category, keywords, extraNotes);
  console.log(prompt);
}

main();
