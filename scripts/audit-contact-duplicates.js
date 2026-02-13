#!/usr/bin/env node
/**
 * Contact Deduplication Audit
 *
 * Analyzes all contact sources for duplicates:
 * - bfh_contacts (Firestore)
 * - direct_sales_contacts (Firestore)
 * - emailCampaigns/master/contacts (Firestore)
 * - Apollo CSV export (local file)
 *
 * Reports overlaps and recommends deduplication strategy.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'teambuilder-plus-fe74d'
});
const db = admin.firestore();

// Parse CSV
function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Handle quoted CSV fields
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });
    records.push(record);
  }

  return records;
}

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();
  // Basic validation
  if (!cleaned.includes('@') || !cleaned.includes('.')) return null;
  return cleaned;
}

async function runAudit() {
  console.log('\n========================================');
  console.log('  CONTACT DEDUPLICATION AUDIT');
  console.log('========================================\n');

  // ============================================
  // 1. Load all data sources
  // ============================================
  console.log('Loading data sources...\n');

  // BFH Contacts
  const bfhSnapshot = await db.collection('bfh_contacts').get();
  const bfhEmails = new Set();
  const bfhData = [];
  bfhSnapshot.forEach(doc => {
    const data = doc.data();
    bfhData.push({ id: doc.id, ...data });
    if (data.email) {
      const normalized = normalizeEmail(data.email);
      if (normalized) bfhEmails.add(normalized);
    }
  });
  console.log(`✓ bfh_contacts: ${bfhSnapshot.size} total, ${bfhEmails.size} unique emails`);

  // Direct Sales Contacts
  const dscSnapshot = await db.collection('direct_sales_contacts').get();
  const dscEmails = new Set();
  const dscData = [];
  dscSnapshot.forEach(doc => {
    const data = doc.data();
    dscData.push({ id: doc.id, ...data });
    if (data.email) {
      const normalized = normalizeEmail(data.email);
      if (normalized) dscEmails.add(normalized);
    }
  });
  console.log(`✓ direct_sales_contacts: ${dscSnapshot.size} total, ${dscEmails.size} unique emails`);

  // Email Campaign Contacts
  const ecSnapshot = await db.collection('emailCampaigns').doc('master').collection('contacts').get();
  const ecEmails = new Set();
  const ecData = [];
  ecSnapshot.forEach(doc => {
    const data = doc.data();
    ecData.push({ id: doc.id, ...data });
    if (data.email) {
      const normalized = normalizeEmail(data.email);
      if (normalized) ecEmails.add(normalized);
    }
  });
  console.log(`✓ emailCampaigns/master/contacts: ${ecSnapshot.size} total, ${ecEmails.size} unique emails`);

  // Apollo CSV
  const apolloPath = path.join(__dirname, '../purchased-emails/apollo-contacts-export.csv');
  const apolloRecords = parseCSV(apolloPath);
  const apolloPrimaryEmails = new Set();
  const apolloSecondaryEmails = new Set();
  const apolloTertiaryEmails = new Set();
  const apolloAllEmails = new Set();

  apolloRecords.forEach(record => {
    const primary = normalizeEmail(record['Email']);
    const secondary = normalizeEmail(record['Secondary Email']);
    const tertiary = normalizeEmail(record['Tertiary Email']);

    if (primary) {
      apolloPrimaryEmails.add(primary);
      apolloAllEmails.add(primary);
    }
    if (secondary) {
      apolloSecondaryEmails.add(secondary);
      apolloAllEmails.add(secondary);
    }
    if (tertiary) {
      apolloTertiaryEmails.add(tertiary);
      apolloAllEmails.add(tertiary);
    }
  });
  console.log(`✓ Apollo CSV: ${apolloRecords.length} records`);
  console.log(`  - Primary emails: ${apolloPrimaryEmails.size}`);
  console.log(`  - Secondary emails: ${apolloSecondaryEmails.size}`);
  console.log(`  - Tertiary emails: ${apolloTertiaryEmails.size}`);
  console.log(`  - All unique emails: ${apolloAllEmails.size}`);

  // ============================================
  // 2. Analyze overlaps
  // ============================================
  console.log('\n----------------------------------------');
  console.log('OVERLAP ANALYSIS');
  console.log('----------------------------------------\n');

  // Helper to find intersection
  const intersection = (setA, setB) => new Set([...setA].filter(x => setB.has(x)));

  // BFH vs Direct Sales Contacts
  const bfhVsDsc = intersection(bfhEmails, dscEmails);
  console.log(`BFH ↔ Direct Sales Contacts: ${bfhVsDsc.size} duplicates`);
  if (bfhVsDsc.size > 0 && bfhVsDsc.size <= 10) {
    console.log(`  Examples: ${[...bfhVsDsc].slice(0, 5).join(', ')}`);
  }

  // BFH vs Email Campaign
  const bfhVsEc = intersection(bfhEmails, ecEmails);
  console.log(`BFH ↔ Email Campaign: ${bfhVsEc.size} duplicates`);
  if (bfhVsEc.size > 0 && bfhVsEc.size <= 10) {
    console.log(`  Examples: ${[...bfhVsEc].slice(0, 5).join(', ')}`);
  }

  // Direct Sales vs Email Campaign
  const dscVsEc = intersection(dscEmails, ecEmails);
  console.log(`Direct Sales ↔ Email Campaign: ${dscVsEc.size} duplicates`);
  if (dscVsEc.size > 0 && dscVsEc.size <= 10) {
    console.log(`  Examples: ${[...dscVsEc].slice(0, 5).join(', ')}`);
  }

  // Apollo vs all existing
  const apolloVsBfh = intersection(apolloAllEmails, bfhEmails);
  const apolloVsDsc = intersection(apolloAllEmails, dscEmails);
  const apolloVsEc = intersection(apolloAllEmails, ecEmails);

  console.log(`\nApollo CSV overlaps:`);
  console.log(`  Apollo ↔ BFH: ${apolloVsBfh.size} duplicates`);
  console.log(`  Apollo ↔ Direct Sales: ${apolloVsDsc.size} duplicates`);
  console.log(`  Apollo ↔ Email Campaign: ${apolloVsEc.size} duplicates`);

  // Apollo unique (not in any existing collection)
  const allExistingEmails = new Set([...bfhEmails, ...dscEmails, ...ecEmails]);
  const apolloUnique = new Set([...apolloAllEmails].filter(x => !allExistingEmails.has(x)));
  console.log(`\nApollo emails NOT in any existing collection: ${apolloUnique.size}`);

  // ============================================
  // 3. Analyze Apollo Secondary/Tertiary emails
  // ============================================
  console.log('\n----------------------------------------');
  console.log('APOLLO SECONDARY/TERTIARY EMAIL ANALYSIS');
  console.log('----------------------------------------\n');

  // Count records with secondary email
  let withSecondary = 0;
  let withTertiary = 0;
  let withAnyAlternate = 0;

  apolloRecords.forEach(record => {
    const hasSecondary = normalizeEmail(record['Secondary Email']) !== null;
    const hasTertiary = normalizeEmail(record['Tertiary Email']) !== null;
    if (hasSecondary) withSecondary++;
    if (hasTertiary) withTertiary++;
    if (hasSecondary || hasTertiary) withAnyAlternate++;
  });

  console.log(`Records with Secondary Email: ${withSecondary} (${(withSecondary/apolloRecords.length*100).toFixed(1)}%)`);
  console.log(`Records with Tertiary Email: ${withTertiary} (${(withTertiary/apolloRecords.length*100).toFixed(1)}%)`);
  console.log(`Records with ANY alternate email: ${withAnyAlternate} (${(withAnyAlternate/apolloRecords.length*100).toFixed(1)}%)`);

  // Check if secondary/tertiary emails are likely personal (gmail, yahoo, etc)
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'me.com', 'live.com', 'msn.com'];
  let personalSecondary = 0;
  let personalTertiary = 0;

  apolloRecords.forEach(record => {
    const secondary = normalizeEmail(record['Secondary Email']);
    const tertiary = normalizeEmail(record['Tertiary Email']);

    if (secondary) {
      const domain = secondary.split('@')[1];
      if (personalDomains.includes(domain)) personalSecondary++;
    }
    if (tertiary) {
      const domain = tertiary.split('@')[1];
      if (personalDomains.includes(domain)) personalTertiary++;
    }
  });

  console.log(`\nPersonal email domains found:`);
  console.log(`  Secondary (personal): ${personalSecondary} of ${withSecondary}`);
  console.log(`  Tertiary (personal): ${personalTertiary} of ${withTertiary}`);

  // ============================================
  // 4. SerpAPI Search Analysis
  // ============================================
  console.log('\n----------------------------------------');
  console.log('SERPAPI SEARCH RECOMMENDATION');
  console.log('----------------------------------------\n');

  // Contacts that need SerpAPI search:
  // Apollo records WITHOUT a valid secondary/tertiary personal email
  // AND whose primary email is corporate (likely to bounce)

  let needsSerpAPISearch = 0;
  let hasValidAlternate = 0;

  apolloRecords.forEach(record => {
    const secondary = normalizeEmail(record['Secondary Email']);
    const tertiary = normalizeEmail(record['Tertiary Email']);

    // Check if we already have a usable personal email
    let hasUsable = false;
    [secondary, tertiary].forEach(email => {
      if (email) {
        const domain = email.split('@')[1];
        if (personalDomains.includes(domain)) {
          hasUsable = true;
        }
      }
    });

    if (hasUsable) {
      hasValidAlternate++;
    } else {
      needsSerpAPISearch++;
    }
  });

  console.log(`Apollo contacts with usable alternate email: ${hasValidAlternate}`);
  console.log(`Apollo contacts needing SerpAPI search: ${needsSerpAPISearch}`);
  console.log(`\nSerpAPI search cost estimate:`);
  console.log(`  Searches needed: ${needsSerpAPISearch}`);
  console.log(`  At Developer plan ($75/month, 5000 searches): ${(needsSerpAPISearch/5000*100).toFixed(1)}% of monthly quota`);
  console.log(`  Expected yield (29%): ~${Math.round(needsSerpAPISearch * 0.29)} new emails`);

  // ============================================
  // 5. Summary & Recommendations
  // ============================================
  console.log('\n========================================');
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('========================================\n');

  console.log('CURRENT CONTACT INVENTORY:');
  console.log(`  BFH contacts with email: ${bfhEmails.size}`);
  console.log(`  Direct Sales contacts with email: ${dscEmails.size}`);
  console.log(`  Email Campaign contacts: ${ecEmails.size}`);
  console.log(`  Total unique across all: ${allExistingEmails.size}`);

  console.log('\nAPOLLO CSV STRATEGY:');
  console.log(`  1. Extract ${hasValidAlternate} contacts with existing personal emails`);
  console.log(`  2. Run SerpAPI on ${needsSerpAPISearch} contacts without personal emails`);
  console.log(`  3. Skip ${apolloVsBfh.size + apolloVsDsc.size + apolloVsEc.size} that overlap with existing`);

  console.log('\nDUPLICATION RISKS:');
  if (bfhVsDsc.size > 0) {
    console.log(`  ⚠️  ${bfhVsDsc.size} emails exist in both BFH and Direct Sales collections`);
  }
  if (bfhVsEc.size > 0) {
    console.log(`  ⚠️  ${bfhVsEc.size} BFH emails already in Email Campaign`);
  }
  if (dscVsEc.size > 0) {
    console.log(`  ⚠️  ${dscVsEc.size} Direct Sales emails already in Email Campaign`);
  }

  console.log('\nRECOMMENDED ACTIONS:');
  console.log('  1. Create apollo-email-extractor.js to pull contacts with personal emails');
  console.log('  2. Modify bfh-email-search.js OR create apollo-email-search.js for SerpAPI');
  console.log('  3. Implement deduplication check before adding to any collection');
  console.log('  4. Add source tracking field to identify contact origin');

  console.log('\n');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
