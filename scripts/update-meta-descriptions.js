#!/usr/bin/env node
/**
 * Update meta descriptions on all company pages for better SEO CTR
 *
 * This script updates:
 * - <meta name="description">
 * - <meta property="og:description">
 * - <meta name="twitter:description">
 */

const fs = require('fs');
const path = require('path');

// Meta description templates by language
const templates = {
  en: (company) => `Grow your ${company} team with AI. 16 pre-written recruiting messages, 24/7 AI coach, and build your downline before joining. Free 30-day trial.`,
  es: (company) => `Haz crecer tu equipo de ${company} con IA. 16 mensajes de reclutamiento, coach IA 24/7, y construye tu red antes de unirte. Prueba gratis 30 días.`,
  pt: (company) => `Aumente sua equipe ${company} com IA. 16 mensagens de recrutamento, coach IA 24/7, e construa sua rede antes de entrar. Teste grátis por 30 dias.`,
  de: (company) => `Bauen Sie Ihr ${company}-Team mit KI auf. 16 Recruiting-Nachrichten, 24/7 KI-Coach, und bauen Sie Ihr Netzwerk vor dem Beitritt auf. 30 Tage kostenlos.`
};

// OG/Twitter description templates (shorter)
const ogTemplates = {
  en: (company) => `Build your ${company} downline with AI tools. 16 recruiting messages, 24/7 AI coach, real-time tracking. Start free today.`,
  es: (company) => `Construye tu red de ${company} con herramientas IA. 16 mensajes, coach IA 24/7, seguimiento en tiempo real. Empieza gratis.`,
  pt: (company) => `Construa sua rede ${company} com ferramentas de IA. 16 mensagens, coach IA 24/7, rastreamento em tempo real. Comece grátis.`,
  de: (company) => `Bauen Sie Ihr ${company}-Netzwerk mit KI-Tools auf. 16 Nachrichten, 24/7 KI-Coach, Echtzeit-Tracking. Jetzt kostenlos starten.`
};

// Directory configurations
const configs = [
  { dir: '/Users/sscott/tbp/web/companies', lang: 'en' },
  { dir: '/Users/sscott/tbp/web-es/companies', lang: 'es' },
  { dir: '/Users/sscott/tbp/web-pt/companies', lang: 'pt' },
  { dir: '/Users/sscott/tbp/web-de/companies', lang: 'de' }
];

// Extract company name from filename
function getCompanyName(filename) {
  // ai-recruiting-amway.html -> Amway
  const match = filename.match(/ai-recruiting-(.+)\.html$/);
  if (!match) return null;

  const slug = match[1];
  // Convert slug to display name
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Update meta descriptions in HTML content
function updateMetaDescriptions(html, company, lang) {
  const metaDesc = templates[lang](company);
  const ogDesc = ogTemplates[lang](company);

  let updated = html;

  // Update <meta name="description">
  updated = updated.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${metaDesc}" />`
  );

  // Update <meta property="og:description">
  updated = updated.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${ogDesc}" />`
  );

  // Update <meta name="twitter:description">
  updated = updated.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${ogDesc}" />`
  );

  return updated;
}

// Process all files in a directory
function processDirectory(config) {
  const { dir, lang } = config;

  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return { processed: 0, skipped: 0 };
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f.startsWith('ai-recruiting-'));
  let processed = 0;
  let skipped = 0;

  for (const file of files) {
    const company = getCompanyName(file);
    if (!company) {
      console.log(`  Skipped (no company name): ${file}`);
      skipped++;
      continue;
    }

    const filepath = path.join(dir, file);
    const html = fs.readFileSync(filepath, 'utf8');
    const updated = updateMetaDescriptions(html, company, lang);

    if (html !== updated) {
      fs.writeFileSync(filepath, updated);
      processed++;
    } else {
      skipped++;
    }
  }

  return { processed, skipped, total: files.length };
}

// Main execution
console.log('Updating meta descriptions on company pages...\n');

let totalProcessed = 0;
let totalSkipped = 0;
let totalFiles = 0;

for (const config of configs) {
  console.log(`Processing ${config.lang.toUpperCase()} (${config.dir})...`);
  const result = processDirectory(config);
  console.log(`  Updated: ${result.processed}, Skipped: ${result.skipped}, Total: ${result.total}\n`);
  totalProcessed += result.processed;
  totalSkipped += result.skipped;
  totalFiles += result.total || 0;
}

console.log('='.repeat(50));
console.log(`Total: ${totalProcessed} updated, ${totalSkipped} unchanged, ${totalFiles} files`);
