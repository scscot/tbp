#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
const title = args.find(arg => !arg.startsWith('--'));
const categoryFlag = args.find(arg => arg.startsWith('--category='));
const keywordsFlag = args.find(arg => arg.startsWith('--keywords='));
const importFlag = args.find(arg => arg.startsWith('--import='));
const interactiveFlag = args.includes('--interactive');

// Extract values
const category = categoryFlag ? categoryFlag.split('=')[1] : 'Recruiting Tips';
const keywords = keywordsFlag ? keywordsFlag.split('=')[1] : '';
const importFile = importFlag ? importFlag.split('=')[1] : null;

// Valid categories
const validCategories = ['Recruiting Tips', 'Product Updates', 'Tutorials'];

// Helper function to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

// Function to call Claude API for translation
async function callClaudeForTranslation(prompt, languageName) {
  console.log(`${colors.cyan}  Calling Claude API for ${languageName} translation...${colors.reset}`);

  const { execSync } = require('child_process');
  const tempPromptFile = path.join(__dirname, `temp-${languageName.toLowerCase()}-prompt.txt`);
  const tempResponseFile = path.join(__dirname, `temp-${languageName.toLowerCase()}-response.json`);

  fs.writeFileSync(tempPromptFile, prompt, 'utf8');

  const claudeCommand = `claude -p "$(cat ${tempPromptFile})" --format json > ${tempResponseFile}`;

  try {
    execSync(claudeCommand, {
      stdio: 'pipe',
      shell: '/bin/bash',
      timeout: 120000
    });

    const response = fs.readFileSync(tempResponseFile, 'utf8');
    const translation = JSON.parse(response);

    fs.unlinkSync(tempPromptFile);
    fs.unlinkSync(tempResponseFile);

    return translation;
  } catch (error) {
    if (fs.existsSync(tempPromptFile)) fs.unlinkSync(tempPromptFile);
    if (fs.existsSync(tempResponseFile)) fs.unlinkSync(tempResponseFile);
    throw new Error(`Claude API call failed: ${error.message}`);
  }
}

// Translation helper function - generates translation prompt for Claude Code
function generateTranslationPrompt(blogPost, targetLang) {
  const langName = targetLang === 'es' ? 'Spanish' : 'Portuguese';
  const baseUrl = targetLang === 'es' ? 'es.teambuildpro.com' : 'pt.teambuildpro.com';

  return `Translate the following blog post to ${langName} with cultural adaptation.

IMPORTANT TRANSLATION REQUIREMENTS:
- This is NOT a literal translation - adapt the content for ${langName}-speaking cultures
- Maintain the marketing impact and professional tone
- Translate ALL text including: title, excerpt, meta description, and full content
- Update ALL URLs from "teambuildpro.com" to "${baseUrl}"
- Preserve HTML structure exactly (all tags, classes, attributes)
- Keep the same slug: "${blogPost.slug}"
- Maintain SEO quality - meta description should be compelling in ${langName}

BLOG POST TO TRANSLATE:
${JSON.stringify(blogPost, null, 2)}

OUTPUT FORMAT:
Return ONLY a valid JSON object with the exact same structure, with all text translated to ${langName}.
The output must be valid JSON that can be parsed directly.`;
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

// Generate HTML for translated blog post
function generateTranslatedBlogHTML(blogPost, lang) {
  const baseUrl = lang === 'es' ? 'https://es.teambuildpro.com' : 'https://pt.teambuildpro.com';
  const langCode = lang === 'es' ? 'es' : 'pt';
  const langName = lang === 'es' ? 'Spanish' : 'Portuguese';

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
        <img src="/assets/icons/team-build-pro.png" alt="Team Build Pro">
        <span>Team Build Pro</span>
      </a>
    </nav>
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
        ${blogPost.content}
      </div>

    </div>
  </article>

  <!-- Footer -->
  <footer class="footer">
    <div class="container" style="max-width:1200px;margin:0 auto;padding:40px 20px;text-align:center;color:#64748b">
      <p style="margin:0 0 16px 0">&copy; 2025 Team Build Pro. All rights reserved.</p>
    </div>
  </footer>

</body>
</html>`;

  return html;
}

// Generate the AI prompt for Claude Code
function generatePrompt(title, category, keywords) {
  const slug = generateSlug(title);
  const date = getTodayDate();

  return `
${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}
${colors.bright}${colors.blue}AI BLOG GENERATION PROMPT FOR CLAUDE CODE${colors.reset}
${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════════${colors.reset}

${colors.yellow}Copy the text below and paste it into Claude Code:${colors.reset}

${colors.bright}────────────────────────────────────────────────────────────────────${colors.reset}

Generate a comprehensive, SEO-optimized blog post for Team Build Pro with the following requirements:

${colors.bright}TITLE:${colors.reset} "${title}"
${colors.bright}CATEGORY:${colors.reset} ${category}
${colors.bright}TARGET KEYWORDS:${colors.reset} ${keywords || 'ai recruiting, direct sales, team building, network marketing'}
${colors.bright}SLUG:${colors.reset} ${slug}
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

  generateBlogContent =
    generateBlogContent.slice(0, insertPosition) +
    blogPostString +
    generateBlogContent.slice(insertPosition);

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

// Main execution
async function main() {
  console.log(`\n${colors.bright}${colors.blue}Team Build Pro - AI Blog Generator${colors.reset}\n`);

  // If importing, process the import
  if (importFile) {
    await processImport(importFile);
    return;
  }

  // Validate inputs
  if (!title) {
    console.log(`${colors.yellow}Usage:${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title Here"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --category="Tutorials"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js "Blog Title" --keywords="seo, keywords"${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/generate-ai-blog.js --import=scripts/blog-response.json${colors.reset}`);
    console.log(`\n${colors.bright}Valid categories:${colors.reset} ${validCategories.join(', ')}`);
    console.log('');
    process.exit(1);
  }

  if (!validCategories.includes(category)) {
    console.error(`${colors.yellow}❌ Invalid category: "${category}"${colors.reset}`);
    console.log(`${colors.cyan}Valid categories: ${validCategories.join(', ')}${colors.reset}\n`);
    process.exit(1);
  }

  // Generate and display the prompt
  const prompt = generatePrompt(title, category, keywords);
  console.log(prompt);
}

main();
