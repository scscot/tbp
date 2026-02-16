#!/usr/bin/env node
/**
 * Apollo CSV Personal Email Analyzer
 *
 * Identifies Apollo contacts that already have usable personal email addresses
 * in their Secondary or Tertiary Email fields (not corporate emails).
 */

const fs = require('fs');
const path = require('path');

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

  return { headers, records };
}

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.toLowerCase().trim();
  if (!cleaned.includes('@') || !cleaned.includes('.')) return null;
  return cleaned;
}

// Load corporate domains from base_urls.txt (blacklist approach)
function loadCorporateDomains() {
  const baseUrlsPath = path.join(__dirname, 'base_urls.txt');
  const content = fs.readFileSync(baseUrlsPath, 'utf8');
  const domains = new Set();

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    // Extract domain from URL like "https://youngliving.com"
    try {
      const url = new URL(line);
      domains.add(url.hostname.replace(/^www\./, ''));
    } catch {
      // Skip invalid URLs
    }
  });

  return domains;
}

const CORPORATE_DOMAINS = loadCorporateDomains();
console.log(`Loaded ${CORPORATE_DOMAINS.size} corporate domains from base_urls.txt`);

function isNonCorporateEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;
  // Accept email if domain is NOT in corporate list
  return !CORPORATE_DOMAINS.has(domain.toLowerCase());
}

function isCorporateEmail(email, company) {
  if (!email || !company) return false;
  const domain = email.split('@')[1];
  const companyLower = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domainPart = domain.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return domainPart.includes(companyLower) || companyLower.includes(domainPart);
}

async function analyze() {
  console.log('\n========================================');
  console.log('  APOLLO PERSONAL EMAIL ANALYSIS');
  console.log('========================================\n');

  const apolloPath = path.join(__dirname, '../purchased-emails/apollo-contacts-export.csv');
  const { headers, records } = parseCSV(apolloPath);

  console.log(`CSV Columns: ${headers.join(', ')}\n`);
  console.log(`Total records: ${records.length}\n`);

  // Categorize contacts
  const withPersonalSecondary = [];
  const withPersonalPrimary = [];
  const withCorporateOnly = [];
  const noEmail = [];

  // Domain frequency analysis
  const secondaryDomains = {};
  const primaryDomains = {};

  records.forEach(record => {
    const primary = normalizeEmail(record['Email']);
    const secondary = normalizeEmail(record['Secondary Email']);
    const company = record['Company Name'] || '';

    // Track domains
    if (primary) {
      const domain = primary.split('@')[1];
      primaryDomains[domain] = (primaryDomains[domain] || 0) + 1;
    }
    if (secondary) {
      const domain = secondary.split('@')[1];
      secondaryDomains[domain] = (secondaryDomains[domain] || 0) + 1;
    }

    // Categorize using blacklist approach
    // Priority: non-corporate secondary > non-corporate primary > corporate only > no email
    if (isNonCorporateEmail(secondary)) {
      withPersonalSecondary.push({
        firstName: record['First Name'],
        lastName: record['Last Name'],
        company: record['Company Name'],
        primaryEmail: primary,
        personalEmail: secondary,
        title: record['Title']
      });
    } else if (isNonCorporateEmail(primary)) {
      withPersonalPrimary.push({
        firstName: record['First Name'],
        lastName: record['Last Name'],
        company: record['Company Name'],
        personalEmail: primary,
        title: record['Title']
      });
    } else if (primary) {
      withCorporateOnly.push({
        firstName: record['First Name'],
        lastName: record['Last Name'],
        company: record['Company Name'],
        corporateEmail: primary,
        secondaryEmail: secondary,
        title: record['Title']
      });
    } else {
      noEmail.push({
        firstName: record['First Name'],
        lastName: record['Last Name'],
        company: record['Company Name'],
        title: record['Title']
      });
    }
  });

  // Summary
  console.log('----------------------------------------');
  console.log('CONTACT CATEGORIZATION');
  console.log('----------------------------------------\n');

  console.log(`✓ Contacts with PERSONAL email in Secondary field: ${withPersonalSecondary.length}`);
  console.log(`  (Ready to use - these bypass SerpAPI)`);
  console.log(`\n✓ Contacts with PERSONAL email in Primary field: ${withPersonalPrimary.length}`);
  console.log(`  (Already have usable email)`);
  console.log(`\n⚠ Contacts with CORPORATE email only: ${withCorporateOnly.length}`);
  console.log(`  (Need SerpAPI search)`);
  console.log(`\n✗ Contacts with NO email: ${noEmail.length}`);
  console.log(`  (Need SerpAPI search)`);

  // Top secondary email domains
  console.log('\n----------------------------------------');
  console.log('TOP SECONDARY EMAIL DOMAINS');
  console.log('----------------------------------------\n');

  const topSecondary = Object.entries(secondaryDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  topSecondary.forEach(([domain, count]) => {
    const type = !CORPORATE_DOMAINS.has(domain) ? '✓ NON-CORPORATE' : '✗ CORPORATE';
    console.log(`  ${count.toString().padStart(4)} - ${domain} ${type}`);
  });

  // Top primary email domains (corporate)
  console.log('\n----------------------------------------');
  console.log('TOP PRIMARY EMAIL DOMAINS');
  console.log('----------------------------------------\n');

  const topPrimary = Object.entries(primaryDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  topPrimary.forEach(([domain, count]) => {
    const type = !CORPORATE_DOMAINS.has(domain) ? '✓ NON-CORPORATE' : '✗ CORPORATE';
    console.log(`  ${count.toString().padStart(4)} - ${domain} ${type}`);
  });

  // Sample of contacts with personal secondary emails
  console.log('\n----------------------------------------');
  console.log('SAMPLE: CONTACTS WITH PERSONAL SECONDARY EMAILS');
  console.log('----------------------------------------\n');

  withPersonalSecondary.slice(0, 10).forEach((c, i) => {
    console.log(`${i+1}. ${c.firstName} ${c.lastName} (${c.company})`);
    console.log(`   Corporate: ${c.primaryEmail}`);
    console.log(`   Personal:  ${c.personalEmail}`);
    console.log('');
  });

  // Sample of corporate-only contacts
  console.log('----------------------------------------');
  console.log('SAMPLE: CORPORATE-ONLY (NEED SERPAPI)');
  console.log('----------------------------------------\n');

  withCorporateOnly.slice(0, 10).forEach((c, i) => {
    console.log(`${i+1}. ${c.firstName} ${c.lastName} (${c.company})`);
    console.log(`   Corporate: ${c.corporateEmail}`);
    if (c.secondaryEmail) {
      console.log(`   Secondary: ${c.secondaryEmail} (also corporate)`);
    }
    console.log('');
  });

  // Summary for next steps
  console.log('========================================');
  console.log('RECOMMENDED NEXT STEPS');
  console.log('========================================\n');

  const totalUsable = withPersonalSecondary.length + withPersonalPrimary.length;
  const needSearch = withCorporateOnly.length + noEmail.length;

  console.log(`IMMEDIATELY USABLE: ${totalUsable} contacts`);
  console.log(`  - ${withPersonalSecondary.length} with personal secondary email`);
  console.log(`  - ${withPersonalPrimary.length} with personal primary email`);
  console.log(`\nNEED SERPAPI SEARCH: ${needSearch} contacts`);
  console.log(`  - Expected yield (29%): ~${Math.round(needSearch * 0.29)} new emails`);
  console.log(`\nTOTAL EXPECTED EMAILS: ${totalUsable + Math.round(needSearch * 0.29)}`);

  // Export ready-to-use contacts
  console.log('\n----------------------------------------');
  console.log('EXPORTING READY-TO-USE CONTACTS');
  console.log('----------------------------------------\n');

  const exportPath = path.join(__dirname, '../purchased-emails/apollo-personal-emails.json');
  const exportData = {
    generatedAt: new Date().toISOString(),
    totalContacts: withPersonalSecondary.length + withPersonalPrimary.length,
    contacts: [
      ...withPersonalSecondary.map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        email: c.personalEmail,
        title: c.title,
        source: 'apollo_secondary'
      })),
      ...withPersonalPrimary.map(c => ({
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        email: c.personalEmail,
        title: c.title,
        source: 'apollo_primary'
      }))
    ]
  };

  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`✓ Exported ${exportData.totalContacts} contacts to:`);
  console.log(`  ${exportPath}\n`);

  // Also export corporate-only for SerpAPI
  const serpApiPath = path.join(__dirname, '../purchased-emails/apollo-needs-serpapi.json');
  const serpApiData = {
    generatedAt: new Date().toISOString(),
    totalContacts: withCorporateOnly.length,
    contacts: withCorporateOnly.map(c => ({
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      corporateEmail: c.corporateEmail,
      title: c.title
    }))
  };

  fs.writeFileSync(serpApiPath, JSON.stringify(serpApiData, null, 2));
  console.log(`✓ Exported ${serpApiData.totalContacts} contacts needing SerpAPI to:`);
  console.log(`  ${serpApiPath}\n`);

  process.exit(0);
}

analyze().catch(err => {
  console.error('Analysis failed:', err);
  process.exit(1);
});
