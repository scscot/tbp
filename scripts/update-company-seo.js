#!/usr/bin/env node

/**
 * Update Company Page SEO Meta Tags
 *
 * This script batch-updates meta descriptions and titles for company recruiting pages
 * to improve CTR based on Google Search Console analysis.
 *
 * Usage:
 *   node scripts/update-company-seo.js [locale]
 *
 * Arguments:
 *   locale - 'en', 'es', 'pt' (default: 'en')
 *
 * Environment:
 *   ANTHROPIC_API_KEY - Required for Claude API calls
 *   DRY_RUN=true - Preview changes without writing files
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const locale = args[0] || 'en';
const dryRun = process.env.DRY_RUN === 'true';

// Directory mapping
const directoryMap = {
  'en': path.join(__dirname, '..', 'web', 'companies'),
  'es': path.join(__dirname, '..', 'web-es', 'companies'),
  'pt': path.join(__dirname, '..', 'web-pt', 'companies'),
  'de': path.join(__dirname, '..', 'web-de', 'companies')
};

// Domain mapping
const domainMap = {
  'en': 'teambuildpro.com',
  'es': 'es.teambuildpro.com',
  'pt': 'pt.teambuildpro.com',
  'de': 'de.teambuildpro.com'
};

// Company metadata for better descriptions
const companyMetadata = {
  // Technology & Services
  'primerica': { focus: 'financial services', keywords: 'term life insurance, financial education, RVP' },
  'legalshield': { focus: 'legal services', keywords: 'legal plan, attorney access, identity protection' },
  'acn': { focus: 'telecommunications', keywords: 'essential services, residual income' },
  'exp-realty': { focus: 'real estate', keywords: 'revenue share, cloud brokerage' },

  // Wellness & Supplements
  'herbalife': { focus: 'nutrition', keywords: 'weight management, protein shakes, wellness' },
  'amway': { focus: 'multi-category', keywords: 'Nutrilite, Artistry, home products' },
  'usana': { focus: 'nutritional supplements', keywords: 'cellular nutrition, health sciences' },
  'isagenix': { focus: 'wellness', keywords: 'cleansing, weight loss, performance' },
  'shaklee': { focus: 'natural nutrition', keywords: 'vitamins, protein, green products' },
  'plexus': { focus: 'gut health', keywords: 'pink drink, probiotics, weight management' },
  '4life': { focus: 'immune support', keywords: 'transfer factor, immune system' },
  'juice-plus': { focus: 'whole food nutrition', keywords: 'fruit vegetable capsules, plant-based' },
  'mannatech': { focus: 'glyconutrients', keywords: 'Ambrotose, cellular communication' },
  'lifevantage': { focus: 'biohacking', keywords: 'Protandim, Nrf2, nutrigenomics' },
  'pruvit': { focus: 'ketones', keywords: 'ketosis, NAT ketones, energy' },
  'modere': { focus: 'clean label', keywords: 'collagen, clean living, biohacking' },

  // Essential Oils
  'doterra': { focus: 'essential oils', keywords: 'CPTG oils, aromatherapy, wellness' },
  'young-living': { focus: 'essential oils', keywords: 'seed to seal, aromatherapy, wellness' },

  // Skincare & Beauty
  'nu-skin': { focus: 'anti-aging', keywords: 'ageLOC, skincare, devices' },
  'rodan-fields': { focus: 'dermatology', keywords: 'clinical skincare, premium products' },
  'mary-kay': { focus: 'cosmetics', keywords: 'skincare, color cosmetics, beauty consultant' },
  'arbonne': { focus: 'clean beauty', keywords: 'vegan, plant-based skincare' },
  'monat': { focus: 'hair care', keywords: 'premium hair, anti-aging skincare' },
  'jeunesse': { focus: 'youth enhancement', keywords: 'stem cell, anti-aging, Luminesce' },
  'neora': { focus: 'age-defying', keywords: 'skincare, wellness, brain health' },
  'farmasi': { focus: 'affordable beauty', keywords: 'cosmetics, skincare, fragrance' },

  // Personal Care
  'scentsy': { focus: 'home fragrance', keywords: 'wax warmers, scented products' },
  'pampered-chef': { focus: 'kitchen tools', keywords: 'cooking, parties, recipes' },
  'paparazzi': { focus: 'jewelry', keywords: '$5 accessories, fashion jewelry' },

  // Travel & Lifestyle
  'incruises': { focus: 'cruise travel', keywords: 'cruise credits, vacation club' },
  'jifu': { focus: 'travel savings', keywords: 'travel deals, vacation platform' },

  // Specialty
  'market-america': { focus: 'e-commerce', keywords: 'Shop.com, UnFranchise, cashback' },
  'beachbody': { focus: 'fitness', keywords: 'workout programs, Shakeology, BODi' },
  'melaleuca': { focus: 'wellness products', keywords: 'eco-friendly, household, vitamins' },
  'forever-living': { focus: 'aloe vera', keywords: 'aloe products, bee products, wellness' },
  'lifewave': { focus: 'phototherapy', keywords: 'patches, light therapy, X39' },
  'healy': { focus: 'frequency therapy', keywords: 'microcurrent, bioresonance, wellness device' },
  'enagic': { focus: 'water ionizers', keywords: 'Kangen water, alkaline, hydration' },
  'atomy': { focus: 'Korean wellness', keywords: 'absolute quality, absolute price' },
  'chogan-group': { focus: 'Italian beauty', keywords: 'perfumes, cosmetics, home care' },
  'coway': { focus: 'home wellness', keywords: 'water purifiers, air purifiers, mattresses' },
  'omnilife': { focus: 'Latin nutrition', keywords: 'supplements, sports nutrition' },
  'immunotec': { focus: 'immune health', keywords: 'Immunocal, glutathione, patented formula' },
  'bode-pro': { focus: 'premium wellness', keywords: 'nootropics, performance, biohacking' },
  'vital-health-global': { focus: 'cellular health', keywords: 'stem cell, regenerative, anti-aging' }
};

// Language-specific templates
const templates = {
  'en': {
    titlePrefix: '',
    titleSuffix: 'AI Recruiting Tools & Scripts | Team Build Pro',
    ctaSuffix: 'Free 30-day trial.'
  },
  'es': {
    titlePrefix: '',
    titleSuffix: 'Herramientas de Reclutamiento con IA | Team Build Pro',
    ctaSuffix: 'Prueba gratis de 30 dias.'
  },
  'pt': {
    titlePrefix: '',
    titleSuffix: 'Ferramentas de Recrutamento com IA | Team Build Pro',
    ctaSuffix: 'Teste gratuito de 30 dias.'
  }
};

/**
 * Call Claude API to generate meta description
 */
async function generateMetaDescription(companyName, companySlug, locale, pageContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const metadata = companyMetadata[companySlug] || { focus: 'direct sales', keywords: 'team building, recruiting' };

  // Extract existing JSON-LD description for context
  const jsonLdMatch = pageContent.match(/"description":\s*"([^"]+)"/);
  const existingContext = jsonLdMatch ? jsonLdMatch[1] : '';

  const languageInstructions = {
    'en': 'Write in English.',
    'es': 'Write in Spanish (Castilian). Use natural Spanish phrasing.',
    'pt': 'Write in Brazilian Portuguese. Use natural Portuguese phrasing.'
  };

  const prompt = `Generate an SEO meta description for a company recruiting page.

Company: ${companyName}
Industry focus: ${metadata.focus}
Keywords: ${metadata.keywords}
Existing context: ${existingContext}

Requirements:
- Maximum 155 characters (strict limit)
- ${languageInstructions[locale] || languageInstructions['en']}
- Include company name
- Mention "AI" or "AI recruiting" or "AI tools"
- Include one product/service keyword if possible
- End with brief CTA (e.g., "Start free today" or "Free trial")
- Make it unique and specific to this company
- Do NOT use generic phrases like "build your downline before joining"

Return ONLY the meta description text, nothing else. No quotes, no explanation.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    if (response.data?.content?.[0]?.text) {
      let description = response.data.content[0].text.trim();
      // Remove quotes if present
      description = description.replace(/^["']|["']$/g, '');
      // Ensure it's not too long
      if (description.length > 160) {
        description = description.substring(0, 157) + '...';
      }
      return description;
    }

    throw new Error('Unexpected API response format');
  } catch (error) {
    console.error(`${colors.red}API Error for ${companyName}: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Extract company name from HTML content
 */
function extractCompanyName(content, locale) {
  // Locale-specific patterns for title tags (multiple patterns per locale)
  const titlePatterns = {
    'en': [/<title>AI Recruiting for ([^|<]+)/],
    'es': [/<title>Reclutamiento con IA para ([^|<]+)/, /<title>Reclutamiento IA para ([^|<]+)/],
    'pt': [/<title>Recrutamento IA para ([^|<]+)/, /<title>Recrutamento com IA para ([^|<]+)/],
    'de': [/<title>KI-Rekrutierung für ([^|<]+)/]
  };

  // Locale-specific patterns for JSON-LD headlines (multiple patterns per locale)
  const jsonLdPatterns = {
    'en': [/"headline":\s*"AI Recruiting for ([^"]+)"/],
    'es': [/"headline":\s*"Reclutamiento con IA para ([^"]+)"/, /"headline":\s*"Reclutamiento IA para ([^"]+)"/],
    'pt': [/"headline":\s*"Recrutamento IA para ([^"]+)"/, /"headline":\s*"Recrutamento com IA para ([^"]+)"/],
    'de': [/"headline":\s*"KI-Rekrutierung für ([^"]+)"/]
  };

  // Words to strip from the end (role words in each language)
  const roleWords = {
    'en': ['Distributors', 'Representatives', 'Consultants', 'Partners', 'Agents', 'Associates', 'Advocates', 'Ambassadors', 'Coaches', 'Members', 'Owners', 'Sellers', 'Stylists', 'Reps'],
    'es': ['Distribuidores', 'Representantes', 'Consultores', 'Socios', 'Agentes', 'Asociados', 'Defensores', 'Embajadores', 'Coaches', 'Miembros', 'Propietarios', 'Vendedores', 'Estilistas', 'de'],
    'pt': ['Distribuidores', 'Representantes', 'Consultores', 'Parceiros', 'Agentes', 'Associados', 'Defensores', 'Embaixadores', 'Coaches', 'Membros', 'Proprietários', 'Vendedores', 'Estilistas'],
    'de': ['Vertriebspartner', 'Vertreter', 'Berater', 'Partner', 'Agenten', 'Mitarbeiter', 'Botschafter', 'Coaches', 'Mitglieder', 'Inhaber', 'Verkäufer', 'Stylisten']
  };

  const patterns = titlePatterns[locale] || titlePatterns['en'];
  const jsonLdPatternsForLocale = jsonLdPatterns[locale] || jsonLdPatterns['en'];
  const wordsToStrip = roleWords[locale] || roleWords['en'];

  // Try title tag patterns first (more reliable)
  for (const pattern of patterns) {
    const titleMatch = content.match(pattern);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }

  // Try JSON-LD patterns
  for (const jsonLdPattern of jsonLdPatternsForLocale) {
    const jsonLdMatch = content.match(jsonLdPattern);
    if (jsonLdMatch) {
      let name = jsonLdMatch[1];
      // Remove role words from the end
      const words = name.split(' ');
      while (words.length > 1 && wordsToStrip.includes(words[words.length - 1])) {
        words.pop();
      }
      return words.join(' ').trim();
    }
  }

  return null;
}

/**
 * Update meta tags in HTML content
 */
function updateMetaTags(content, companyName, newDescription, locale) {
  const template = templates[locale] || templates['en'];
  const newTitle = `${companyName} ${template.titleSuffix}`;

  let updated = content;

  // Update <title>
  updated = updated.replace(
    /<title>[^<]+<\/title>/,
    `<title>${newTitle}</title>`
  );

  // Update meta description
  updated = updated.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${newDescription}" />`
  );

  // Update OG title
  updated = updated.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${newTitle}" />`
  );

  // Update OG description
  updated = updated.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${newDescription}" />`
  );

  // Update Twitter title
  updated = updated.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${newTitle}" />`
  );

  // Update Twitter description
  updated = updated.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${newDescription}" />`
  );

  return updated;
}

/**
 * Process a single company page
 */
async function processCompanyPage(filePath, locale) {
  const filename = path.basename(filePath);
  const companySlug = filename.replace('ai-recruiting-', '').replace('.html', '');

  console.log(`${colors.cyan}Processing: ${filename}${colors.reset}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const companyName = extractCompanyName(content, locale);

  if (!companyName) {
    console.log(`${colors.yellow}  Skipping: Could not extract company name${colors.reset}`);
    return { success: false, reason: 'no company name' };
  }

  // Generate new meta description
  const newDescription = await generateMetaDescription(companyName, companySlug, locale, content);

  if (!newDescription) {
    console.log(`${colors.yellow}  Skipping: Could not generate description${colors.reset}`);
    return { success: false, reason: 'generation failed' };
  }

  console.log(`${colors.green}  Company: ${companyName}${colors.reset}`);
  console.log(`${colors.blue}  New description (${newDescription.length} chars): ${newDescription}${colors.reset}`);

  // Update the file
  const updatedContent = updateMetaTags(content, companyName, newDescription, locale);

  if (dryRun) {
    console.log(`${colors.yellow}  [DRY RUN] Would update file${colors.reset}`);
  } else {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`${colors.green}  Updated file${colors.reset}`);
  }

  return { success: true, companyName, description: newDescription };
}

/**
 * Main function
 */
async function main() {
  console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.bright}Company Page SEO Updater${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
  console.log(`Locale: ${locale}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  const companiesDir = directoryMap[locale];

  if (!companiesDir || !fs.existsSync(companiesDir)) {
    console.error(`${colors.red}Error: Directory not found for locale '${locale}'${colors.reset}`);
    process.exit(1);
  }

  // Get all company HTML files
  const files = fs.readdirSync(companiesDir)
    .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'))
    .map(f => path.join(companiesDir, f));

  console.log(`Found ${files.length} company pages in ${companiesDir}`);
  console.log('');

  const results = {
    success: 0,
    failed: 0,
    skipped: 0
  };

  // Process files with rate limiting (1 per second to avoid API rate limits)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}]`);

    try {
      const result = await processCompanyPage(file, locale);
      if (result.success) {
        results.success++;
      } else {
        results.skipped++;
      }
    } catch (error) {
      console.error(`${colors.red}Error processing ${file}: ${error.message}${colors.reset}`);
      results.failed++;
    }

    // Rate limiting: wait 1 second between API calls
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log(`\n${colors.bright}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.bright}Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.green}Success: ${results.success}${colors.reset}`);
  console.log(`${colors.yellow}Skipped: ${results.skipped}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`Total: ${files.length}`);

  if (dryRun) {
    console.log(`\n${colors.yellow}This was a DRY RUN. No files were modified.${colors.reset}`);
    console.log(`Run without DRY_RUN=true to apply changes.`);
  }
}

main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
