#!/usr/bin/env node
/**
 * Company Page Text Extractor
 *
 * Extracts translatable text elements from company HTML pages to speed up
 * translation workflow for Spanish, Portuguese, and German versions.
 *
 * Usage:
 *   node scripts/extract-company-text.js <company-slug>
 *   node scripts/extract-company-text.js young-living
 *   node scripts/extract-company-text.js --all
 *
 * Output:
 *   Creates a JSON file with all translatable text elements organized by section.
 */

const fs = require('fs');
const path = require('path');

const WEB_DIR = path.join(__dirname, '..', 'web', 'companies');
const OUTPUT_DIR = path.join(__dirname, '..', 'translation-extracts');

// Patterns for text extraction
const EXTRACT_PATTERNS = [
  { tag: 'title', selector: /<title>([^<]+)<\/title>/g },
  { tag: 'meta-description', selector: /<meta name="description" content="([^"]+)"/g },
  { tag: 'og-title', selector: /<meta property="og:title" content="([^"]+)"/g },
  { tag: 'og-description', selector: /<meta property="og:description" content="([^"]+)"/g },
  { tag: 'twitter-title', selector: /<meta name="twitter:title" content="([^"]+)"/g },
  { tag: 'twitter-description', selector: /<meta name="twitter:description" content="([^"]+)"/g },
  { tag: 'json-ld-headline', selector: /"headline":\s*"([^"]+)"/g },
  { tag: 'json-ld-description', selector: /"description":\s*"([^"]+)"/g },
  { tag: 'h1', selector: /<h1[^>]*>([^<]+)<\/h1>/g },
  { tag: 'h2', selector: /<h2[^>]*>([^<]+)<\/h2>/g },
  { tag: 'h3', selector: /<h3[^>]*>([^<]+)<\/h3>/g },
  { tag: 'eyebrow', selector: /<span class="eyebrow">([^<]+)<\/span>/g },
  { tag: 'breadcrumb-text', selector: /<span>([^<]+AI Recruiting[^<]*)<\/span>/g },
];

// Common UI strings that appear across all pages
const COMMON_UI_STRINGS = {
  navigation: {
    'Home': 'Inicio',
    'Screenshots': 'Capturas',
    'Pricing': 'Precios',
    'FAQ': 'FAQ',
    'Books': 'Libros',
    'Contact Us': 'Contacto',
  },
  buttons: {
    'Download on the App Store': 'Descargar en App Store',
    'Get it on Google Play': 'Disponible en Google Play',
    'Free 30-day trial · $4.99/mo · Cancel anytime': 'Prueba gratis 30 días · $4.99/mes · Cancela cuando quieras',
  },
  footer: {
    'Privacy Policy': 'Política de Privacidad',
    'Terms of Service': 'Términos de Servicio',
    'All Rights Reserved': 'Todos los Derechos Reservados',
  },
  cta: {
    'Pre-building advantage: Prospects build teams before joining': 'Ventaja de pre-construcción: Los prospectos construyen equipos antes de unirse',
    'AI Coach guidance: Personalized coaching and milestone roadmaps': 'Guía del Coach IA: Coaching personalizado y hojas de ruta de logros',
    'Real-time network visibility: Track your entire organization': 'Visibilidad de red en tiempo real: Rastrea toda tu organización',
  }
};

function extractTextFromHtml(html, companyName) {
  const extracted = {
    company: companyName,
    extractedAt: new Date().toISOString(),
    meta: {},
    headings: [],
    paragraphs: [],
    listItems: [],
    cards: [],
  };

  // Extract meta tags
  EXTRACT_PATTERNS.forEach(pattern => {
    const matches = [...html.matchAll(pattern.selector)];
    if (matches.length > 0) {
      extracted.meta[pattern.tag] = matches.map(m => m[1]);
    }
  });

  // Extract paragraphs (excluding those with just HTML entities or very short)
  const pRegex = /<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/g;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 20 && !text.startsWith('©')) {
      extracted.paragraphs.push(text);
    }
  }

  // Extract list items with strong tags (formatted tips/steps)
  const liRegex = /<li[^>]*>(?:<strong>)?([^<]+)(?:<\/strong>)?([^<]*(?:<[^>]+>[^<]*)*)<\/li>/g;
  while ((match = liRegex.exec(html)) !== null) {
    const boldPart = match[1]?.trim() || '';
    const restPart = match[2]?.replace(/<[^>]+>/g, '').trim() || '';
    if (boldPart.length > 5) {
      extracted.listItems.push({
        bold: boldPart,
        text: restPart
      });
    }
  }

  // Extract card content
  const cardRegex = /<div class="card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  while ((match = cardRegex.exec(html)) !== null) {
    const cardContent = match[1];
    const h3Match = cardContent.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const pMatch = cardContent.match(/<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/);
    if (h3Match || pMatch) {
      extracted.cards.push({
        title: h3Match ? h3Match[1].trim() : null,
        text: pMatch ? pMatch[1].replace(/<[^>]+>/g, '').trim() : null
      });
    }
  }

  return extracted;
}

function processCompany(slug) {
  const filePath = path.join(WEB_DIR, `ai-recruiting-${slug}.html`);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const extracted = extractTextFromHtml(html, slug);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `${slug}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2));

  console.log(`Extracted text for ${slug} -> ${outputPath}`);
  console.log(`  - Meta tags: ${Object.keys(extracted.meta).length}`);
  console.log(`  - Paragraphs: ${extracted.paragraphs.length}`);
  console.log(`  - List items: ${extracted.listItems.length}`);
  console.log(`  - Cards: ${extracted.cards.length}`);

  return extracted;
}

function getAllCompanies() {
  const files = fs.readdirSync(WEB_DIR);
  return files
    .filter(f => f.startsWith('ai-recruiting-') && f.endsWith('.html'))
    .map(f => f.replace('ai-recruiting-', '').replace('.html', ''));
}

function generateTranslationTemplate(slug, targetLang) {
  const extractPath = path.join(OUTPUT_DIR, `${slug}.json`);

  if (!fs.existsSync(extractPath)) {
    console.log(`Extracting text first for ${slug}...`);
    processCompany(slug);
  }

  const extracted = JSON.parse(fs.readFileSync(extractPath, 'utf8'));

  const template = {
    source: 'en',
    target: targetLang,
    company: slug,
    translations: {
      meta: {},
      headings: [],
      paragraphs: [],
      listItems: [],
      cards: []
    }
  };

  // Create translation placeholders
  Object.entries(extracted.meta).forEach(([key, values]) => {
    template.translations.meta[key] = values.map(v => ({
      original: v,
      translated: ''
    }));
  });

  extracted.paragraphs.forEach(p => {
    template.translations.paragraphs.push({
      original: p,
      translated: ''
    });
  });

  extracted.listItems.forEach(item => {
    template.translations.listItems.push({
      original: item,
      translated: { bold: '', text: '' }
    });
  });

  extracted.cards.forEach(card => {
    template.translations.cards.push({
      original: card,
      translated: { title: '', text: '' }
    });
  });

  const templatePath = path.join(OUTPUT_DIR, `${slug}-${targetLang}-template.json`);
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

  console.log(`Generated translation template: ${templatePath}`);
  return template;
}

// CLI handling
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Company Page Text Extractor');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/extract-company-text.js <company-slug>');
  console.log('  node scripts/extract-company-text.js young-living');
  console.log('  node scripts/extract-company-text.js --all');
  console.log('  node scripts/extract-company-text.js --template <slug> <lang>');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/extract-company-text.js herbalife');
  console.log('  node scripts/extract-company-text.js --all');
  console.log('  node scripts/extract-company-text.js --template amway es');
  process.exit(0);
}

if (args[0] === '--all') {
  const companies = getAllCompanies();
  console.log(`Processing ${companies.length} company pages...`);
  companies.forEach(slug => processCompany(slug));
  console.log('\nDone! All extracts saved to translation-extracts/');
} else if (args[0] === '--template' && args.length >= 3) {
  generateTranslationTemplate(args[1], args[2]);
} else if (args[0] === '--list') {
  const companies = getAllCompanies();
  console.log(`Found ${companies.length} company pages:`);
  companies.forEach(c => console.log(`  - ${c}`));
} else {
  processCompany(args[0]);
}
