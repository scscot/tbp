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
function processImport(importFile) {
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

    console.log(`\n${colors.green}✅ Blog HTML files generated successfully!${colors.reset}`);
    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  1. Review the generated files:`);
    console.log(`     ${colors.cyan}web/blog/${blogPost.slug}.html${colors.reset}`);
    console.log(`     ${colors.cyan}web/blog.html${colors.reset} (updated index)`);
    console.log(`  2. Update sitemap.xml to include the new blog post`);
    console.log(`  3. Deploy: ${colors.yellow}firebase deploy --only hosting:main${colors.reset}`);
    console.log(`\n${colors.green}🎉 Blog creation complete!${colors.reset}\n`);

  } catch (error) {
    console.error(`\n${colors.yellow}❌ Error generating HTML: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Main execution
function main() {
  console.log(`\n${colors.bright}${colors.blue}Team Build Pro - AI Blog Generator${colors.reset}\n`);

  // If importing, process the import
  if (importFile) {
    processImport(importFile);
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
