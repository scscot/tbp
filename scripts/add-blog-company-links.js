#!/usr/bin/env node
/**
 * add-blog-company-links.js
 *
 * Scans blog posts for company name mentions and adds internal links
 * to the corresponding company pages.
 *
 * Usage:
 *   node scripts/add-blog-company-links.js --scan          # Scan and report opportunities
 *   node scripts/add-blog-company-links.js --apply         # Apply links to blog posts
 *   node scripts/add-blog-company-links.js --dry-run       # Show what would be changed
 */

const fs = require('fs');
const path = require('path');

// Company name to slug mapping
// Format: { 'Display Name': { slug: 'url-slug', caseSensitive: bool } }
// caseSensitive: true means exact case match required (for common words like THRIVE)
const COMPANY_MAP = {
  // Essential Oils
  'Young Living': { slug: 'young-living', caseSensitive: false },
  'doTERRA': { slug: 'doterra', caseSensitive: true },
  'Scentsy': { slug: 'scentsy', caseSensitive: false },
  'Forever Living': { slug: 'forever-living', caseSensitive: false },

  // Beauty & Skincare
  'Monat': { slug: 'monat', caseSensitive: false },
  'Rodan + Fields': { slug: 'rodan-fields', caseSensitive: false },
  'Rodan+Fields': { slug: 'rodan-fields', caseSensitive: false },
  'Rodan and Fields': { slug: 'rodan-fields', caseSensitive: false },
  'Younique': { slug: 'younique', caseSensitive: false },
  'Paparazzi Accessories': { slug: 'paparazzi', caseSensitive: false },
  'Paparazzi Jewelry': { slug: 'paparazzi', caseSensitive: false },
  'Mary Kay': { slug: 'mary-kay', caseSensitive: false },
  'Avon': { slug: 'avon', caseSensitive: false },
  'SeneGence': { slug: 'senegence', caseSensitive: false },
  'Arbonne': { slug: 'arbonne', caseSensitive: false },
  'Beautycounter': { slug: 'beautycounter', caseSensitive: false },
  'Nu Skin': { slug: 'nu-skin', caseSensitive: false },
  'Oriflame': { slug: 'oriflame', caseSensitive: false },
  'Farmasi': { slug: 'farmasi', caseSensitive: false },

  // Health & Wellness
  'Herbalife': { slug: 'herbalife', caseSensitive: false },
  'Isagenix': { slug: 'isagenix', caseSensitive: false },
  'USANA': { slug: 'usana', caseSensitive: true },
  'Pruvit': { slug: 'pruvit', caseSensitive: false },
  'Plexus': { slug: 'plexus', caseSensitive: false },
  'LifeVantage': { slug: 'lifevantage', caseSensitive: false },
  'Juice Plus': { slug: 'juice-plus', caseSensitive: false },
  'Juice Plus+': { slug: 'juice-plus', caseSensitive: false },
  'Optavia': { slug: 'optavia', caseSensitive: false },
  'Shaklee': { slug: 'shaklee', caseSensitive: false },
  'Melaleuca': { slug: 'melaleuca', caseSensitive: false },
  'It Works!': { slug: 'it-works', caseSensitive: true },  // Require exclamation to avoid "how it works"
  'ItWorks': { slug: 'it-works', caseSensitive: false },
  'Modere': { slug: 'modere', caseSensitive: false },
  'Amway': { slug: 'amway', caseSensitive: false },
  '4Life': { slug: '4life', caseSensitive: false },
  'Mannatech': { slug: 'mannatech', caseSensitive: false },
  'Xyngular': { slug: 'xyngular', caseSensitive: false },
  'Q Sciences': { slug: 'q-sciences', caseSensitive: false },
  'Amare Global': { slug: 'amare', caseSensitive: false },
  'Amare': { slug: 'amare', caseSensitive: false },
  'Tranont': { slug: 'tranont', caseSensitive: false },
  'Total Life Changes': { slug: 'total-life-changes', caseSensitive: false },
  'Neora': { slug: 'neora', caseSensitive: false },
  'LiveGood': { slug: 'livegood', caseSensitive: false },
  'Healy World': { slug: 'healy', caseSensitive: false },
  'ASEA Global': { slug: 'asea-global', caseSensitive: false },
  'ASEA': { slug: 'asea-global', caseSensitive: true },
  'Valentus': { slug: 'valentus', caseSensitive: false },

  // Home & Lifestyle
  'Tupperware': { slug: 'tupperware', caseSensitive: false },
  'Pampered Chef': { slug: 'pampered-chef', caseSensitive: false },
  'Cutco': { slug: 'cutco', caseSensitive: false },
  'PartyLite': { slug: 'partylite', caseSensitive: false },

  // Financial & Services
  'Primerica': { slug: 'primerica', caseSensitive: false },
  'LegalShield': { slug: 'legalshield', caseSensitive: false },
  'Ambit Energy': { slug: 'ambit-energy', caseSensitive: false },
  'ACN': { slug: 'acn', caseSensitive: true },  // Avoid matching "acn" in words
  'eXp Realty': { slug: 'exp-realty', caseSensitive: false },

  // Technology & Travel
  'ByDzyne': { slug: 'bydzyne', caseSensitive: false },
  'iGenius': { slug: 'igenius-global', caseSensitive: false },
  'JIFU': { slug: 'jifu', caseSensitive: true },
  'inCruises': { slug: 'incruises', caseSensitive: false },

  // Specialty
  'Le-Vel': { slug: 'le-vel', caseSensitive: false },
  'Le-Vel THRIVE': { slug: 'le-vel', caseSensitive: false },  // Full name match
  'Beachbody': { slug: 'beachbody', caseSensitive: false },
  'Stella & Dot': { slug: 'stella-dot', caseSensitive: false },
  'Jeunesse': { slug: 'jeunesse', caseSensitive: false },
  'Market America': { slug: 'market-america', caseSensitive: false },
  'Kannaway': { slug: 'kannaway', caseSensitive: false },
  'PM International': { slug: 'pm-international', caseSensitive: false },
  'Nikken': { slug: 'nikken', caseSensitive: false },
  'Enagic': { slug: 'enagic', caseSensitive: false },
  'Kangen Water': { slug: 'enagic', caseSensitive: false },
  'Vorwerk': { slug: 'vorwerk', caseSensitive: false },
  'Thermomix': { slug: 'vorwerk', caseSensitive: false },
  'Atomy': { slug: 'atomy', caseSensitive: false },
  'DXN': { slug: 'dxn', caseSensitive: true },
  'Omnilife': { slug: 'omnilife', caseSensitive: false },
  'Grupo Hinode': { slug: 'grupo-hinode', caseSensitive: false },
  'Hinode': { slug: 'grupo-hinode', caseSensitive: false },
  'Coway': { slug: 'coway', caseSensitive: false },
  'QNET': { slug: 'qnet', caseSensitive: true },
  'Unicity': { slug: 'unicity', caseSensitive: false },
  'Vestige': { slug: 'vestige', caseSensitive: false },
  "Nature's Sunshine": { slug: 'natures-sunshine', caseSensitive: false },
};

// Directories - can be overridden with --lang flag
const LANG = process.argv.find(a => a.startsWith('--lang='))?.split('=')[1] || 'en';
const LANG_DIRS = {
  en: { blog: 'web/blog', companies: 'web/companies' },
  es: { blog: 'web-es/blog', companies: 'web-es/companies' },
  pt: { blog: 'web-pt/blog', companies: 'web-pt/companies' },
  de: { blog: 'web-de/blog', companies: 'web-de/companies' },
};
const dirs = LANG_DIRS[LANG] || LANG_DIRS.en;
const BLOG_DIR = path.join(__dirname, '..', dirs.blog);
const COMPANIES_DIR = path.join(__dirname, '..', dirs.companies);

// Get list of all company page slugs that actually exist
function getExistingCompanySlugs() {
  const files = fs.readdirSync(COMPANIES_DIR);
  return files
    .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'))
    .map(f => f.replace('ai-recruiting-', '').replace('.html', ''));
}

// Check if text is already inside a link
function isInsideLink(content, matchIndex) {
  // Look backwards for opening <a tag without closing </a>
  const before = content.substring(Math.max(0, matchIndex - 500), matchIndex);
  const lastOpenA = before.lastIndexOf('<a ');
  const lastCloseA = before.lastIndexOf('</a>');

  // If there's an <a tag after the last </a>, we're inside a link
  if (lastOpenA > lastCloseA) {
    return true;
  }

  // Also check if we're in an href attribute
  const lastHref = before.lastIndexOf('href=');
  if (lastHref > -1 && lastHref > before.lastIndexOf('>')) {
    return true;
  }

  return false;
}

// Check if text is inside an HTML tag attribute
function isInsideTag(content, matchIndex) {
  const before = content.substring(Math.max(0, matchIndex - 200), matchIndex);
  const lastOpenTag = before.lastIndexOf('<');
  const lastCloseTag = before.lastIndexOf('>');
  return lastOpenTag > lastCloseTag;
}

// Scan a single blog post for company mentions
function scanBlogPost(filePath, existingSlugs) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const opportunities = [];

  for (const [companyName, config] of Object.entries(COMPANY_MAP)) {
    const { slug, caseSensitive } = config;

    // Skip if company page doesn't exist
    if (!existingSlugs.includes(slug)) {
      continue;
    }

    // Create regex for company name
    // Case sensitive matches require exact case; otherwise case-insensitive
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escapeRegex(companyName)}\\b`, flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const index = match.index;

      // Skip if already inside a link
      if (isInsideLink(content, index)) {
        continue;
      }

      // Skip if inside an HTML tag
      if (isInsideTag(content, index)) {
        continue;
      }

      // Skip if in script, style, or meta tags
      const lineStart = content.lastIndexOf('\n', index);
      const lineEnd = content.indexOf('\n', index);
      const line = content.substring(lineStart, lineEnd);
      if (line.includes('<script') || line.includes('<style') ||
          line.includes('<meta') || line.includes('<!--')) {
        continue;
      }

      // Get context around the match
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(content.length, index + companyName.length + 50);
      const context = content.substring(contextStart, contextEnd)
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ');

      opportunities.push({
        file: fileName,
        companyName: match[0], // Actual matched text (preserves case)
        slug,
        index,
        context: `...${context}...`,
        line: content.substring(0, index).split('\n').length
      });
    }
  }

  return opportunities;
}

// Escape special regex characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Apply links to a blog post
function applyLinks(filePath, opportunities, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);

  // Sort by index descending so we don't mess up positions
  const sorted = opportunities
    .filter(o => o.file === fileName)
    .sort((a, b) => b.index - a.index);

  // Track which slugs we've already linked (only link first occurrence)
  const linkedSlugs = new Set();

  // Check for existing links to company pages
  for (const config of Object.values(COMPANY_MAP)) {
    if (content.includes(`/companies/ai-recruiting-${config.slug}.html`)) {
      linkedSlugs.add(config.slug);
    }
  }

  let changes = 0;

  for (const opp of sorted) {
    // Only link first occurrence of each company
    if (linkedSlugs.has(opp.slug)) {
      continue;
    }

    // Double-check we're still not inside a link (content may have changed)
    if (isInsideLink(content, opp.index)) {
      continue;
    }

    // Create the link
    const link = `<a href="/companies/ai-recruiting-${opp.slug}.html" class="company-link">${opp.companyName}</a>`;

    // Replace the text
    const before = content.substring(0, opp.index);
    const after = content.substring(opp.index + opp.companyName.length);
    content = before + link + after;

    linkedSlugs.add(opp.slug);
    changes++;

    console.log(`  + Linking "${opp.companyName}" → /companies/ai-recruiting-${opp.slug}.html (line ${opp.line})`);
  }

  if (changes > 0 && !dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return changes;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const scanOnly = args.includes('--scan');
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');

  if (!scanOnly && !apply && !dryRun) {
    console.log('Usage:');
    console.log('  node scripts/add-blog-company-links.js --scan              # Scan and report opportunities');
    console.log('  node scripts/add-blog-company-links.js --dry-run           # Show what would be changed');
    console.log('  node scripts/add-blog-company-links.js --apply             # Apply links to blog posts');
    console.log('  node scripts/add-blog-company-links.js --apply --lang=es   # Apply to Spanish blog');
    console.log('');
    console.log('Languages: en (default), es, pt, de');
    process.exit(0);
  }

  console.log(`Language: ${LANG.toUpperCase()}`);
  console.log(`Blog dir: ${dirs.blog}`);
  console.log(`Companies dir: ${dirs.companies}\n`);

  console.log('Blog Company Link Scanner\n');

  // Get existing company slugs
  const existingSlugs = getExistingCompanySlugs();
  console.log(`Found ${existingSlugs.length} company pages\n`);

  // Get all blog posts
  const blogFiles = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => path.join(BLOG_DIR, f));

  console.log(`Scanning ${blogFiles.length} blog posts...\n`);

  // Scan all posts
  const allOpportunities = [];
  for (const file of blogFiles) {
    const opps = scanBlogPost(file, existingSlugs);
    allOpportunities.push(...opps);
  }

  // Group by file
  const byFile = {};
  for (const opp of allOpportunities) {
    if (!byFile[opp.file]) {
      byFile[opp.file] = [];
    }
    byFile[opp.file].push(opp);
  }

  // Report
  console.log('='.repeat(60));
  console.log('LINKING OPPORTUNITIES');
  console.log('='.repeat(60));

  let totalOpportunities = 0;
  let totalChanges = 0;

  for (const [file, opps] of Object.entries(byFile)) {
    // Dedupe by slug (only show first occurrence)
    const seenSlugs = new Set();
    const uniqueOpps = opps.filter(o => {
      if (seenSlugs.has(o.slug)) return false;
      seenSlugs.add(o.slug);
      return true;
    });

    if (uniqueOpps.length === 0) continue;

    totalOpportunities += uniqueOpps.length;

    console.log(`\n${file} (${uniqueOpps.length} companies):`);

    if (scanOnly) {
      for (const opp of uniqueOpps) {
        console.log(`  - ${opp.companyName} → ai-recruiting-${opp.slug}.html (line ${opp.line})`);
        console.log(`    Context: ${opp.context}`);
      }
    } else {
      const filePath = path.join(BLOG_DIR, file);
      const changes = applyLinks(filePath, opps, dryRun);
      totalChanges += changes;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total linking opportunities: ${totalOpportunities}`);

  if (apply || dryRun) {
    console.log(`Links ${dryRun ? 'to be ' : ''}added: ${totalChanges}`);
    if (dryRun) {
      console.log('\nRun with --apply to make changes.');
    }
  } else {
    console.log('\nRun with --dry-run to preview changes or --apply to add links.');
  }
}

main().catch(console.error);
