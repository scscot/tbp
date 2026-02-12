#!/usr/bin/env node
/**
 * Import purchased leads into Firestore
 *
 * Usage:
 *   node import-purchased-leads.js <source> <csv_file> [--cost=X.XX]
 *
 * Examples:
 *   node import-purchased-leads.js apollo leads.csv --cost=0.049
 *   node import-purchased-leads.js apache leads.csv --cost=1.29
 *   node import-purchased-leads.js exactdata leads.csv --cost=0.21
 *
 * CSV Format:
 *   firstName,lastName,email,phone,company,jobTitle,city,state
 *   John,Doe,john@example.com,555-1234,Herbalife,Distributor,Denver,CO
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const source = args[0];
const csvFile = args[1];
const costArg = args.find(a => a.startsWith('--cost='));
const costPerLead = costArg ? parseFloat(costArg.split('=')[1]) : 0;

const VALID_SOURCES = ['apollo', 'apache', 'exactdata'];

function printUsage() {
  console.log(`
Usage: node import-purchased-leads.js <source> <csv_file> [--cost=X.XX]

Arguments:
  source     Lead source: apollo, apache, or exactdata
  csv_file   Path to CSV file with leads
  --cost     Cost per lead in dollars (optional)

CSV Format:
  firstName,lastName,email,phone,company,jobTitle,city,state

Examples:
  node import-purchased-leads.js apollo ~/Downloads/apollo-export.csv --cost=0.049
  node import-purchased-leads.js apache leads.csv --cost=1.29
  node import-purchased-leads.js exactdata mlm-leads.csv --cost=0.21
`);
}

async function parseCSV(filePath) {
  const leads = [];
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = null;
  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

    if (!headers) {
      headers = values.map(h => h.toLowerCase().replace(/\s+/g, '_'));
      continue;
    }

    const lead = {};
    headers.forEach((header, index) => {
      lead[header] = values[index] || '';
    });

    // Normalize field names
    const normalized = {
      firstName: lead.firstname || lead.first_name || lead.first || '',
      lastName: lead.lastname || lead.last_name || lead.last || '',
      email: lead.email || lead.email_address || '',
      phone: lead.phone || lead.telephone || lead.mobile || '',
      company: lead.company || lead.organization || '',
      jobTitle: lead.jobtitle || lead.job_title || lead.title || '',
      city: lead.city || '',
      state: lead.state || lead.region || ''
    };

    // Validate email
    if (normalized.email && normalized.email.includes('@')) {
      leads.push(normalized);
    } else {
      console.log(`⚠️ Line ${lineNumber}: Invalid email - ${normalized.email || '(empty)'}`);
    }
  }

  return leads;
}

async function importLeads(source, leads, costPerLead) {
  const batchId = `${source}_${Date.now()}`;
  const now = admin.firestore.FieldValue.serverTimestamp();

  console.log(`\nImporting ${leads.length} leads from ${source}...`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`Cost per lead: $${costPerLead.toFixed(4)}`);

  // Check for duplicates
  const existingEmails = new Set();
  const existingSnapshot = await db.collection('purchased_leads')
    .select('email')
    .get();

  existingSnapshot.forEach(doc => {
    existingEmails.add(doc.data().email.toLowerCase());
  });

  console.log(`\nExisting leads in database: ${existingEmails.size}`);

  // Filter out duplicates
  const newLeads = leads.filter(lead => {
    const email = lead.email.toLowerCase();
    if (existingEmails.has(email)) {
      return false;
    }
    existingEmails.add(email); // Also dedupe within batch
    return true;
  });

  const duplicates = leads.length - newLeads.length;
  if (duplicates > 0) {
    console.log(`Skipping ${duplicates} duplicate emails`);
  }

  console.log(`New leads to import: ${newLeads.length}`);

  if (newLeads.length === 0) {
    console.log('\nNo new leads to import.');
    return { imported: 0, duplicates, batchId };
  }

  // Import in batches of 500
  let imported = 0;
  const BATCH_SIZE = 500;

  for (let i = 0; i < newLeads.length; i += BATCH_SIZE) {
    const chunk = newLeads.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const lead of chunk) {
      const docRef = db.collection('purchased_leads').doc();
      batch.set(docRef, {
        // Source info
        source,
        batchId,
        purchaseDate: now,
        costPerLead,

        // Contact info
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email.toLowerCase(),
        phone: lead.phone,
        company: lead.company,
        jobTitle: lead.jobTitle,
        city: lead.city,
        state: lead.state,

        // Campaign tracking (initialized)
        sent: false,
        sentAt: null,
        templateVersion: null,
        subjectTag: null,
        mailgunId: null,

        // Engagement tracking
        delivered: false,
        deliveredAt: null,
        opened: false,
        openedAt: null,
        clicked: false,
        clickedAt: null,

        // Status
        status: 'pending',
        errorMessage: null,

        // Metadata
        createdAt: now,
        updatedAt: now
      });
    }

    await batch.commit();
    imported += chunk.length;
    console.log(`  Imported ${imported}/${newLeads.length}...`);
  }

  // Create batch record
  await db.collection('purchased_leads_batches').doc(batchId).set({
    batchId,
    source,
    purchaseDate: now,
    totalLeads: newLeads.length,
    totalCost: newLeads.length * costPerLead,
    costPerLead,
    validEmails: newLeads.length,
    invalidEmails: 0,
    emailValidityRate: 1,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    costPerClick: 0,
    status: 'pending',
    notes: `Imported from CSV on ${new Date().toISOString()}`
  });

  // Update source stats
  const statsRef = db.collection('purchased_leads_stats').doc(source);
  await statsRef.update({
    totalLeads: admin.firestore.FieldValue.increment(newLeads.length),
    totalCost: admin.firestore.FieldValue.increment(newLeads.length * costPerLead),
    batchCount: admin.firestore.FieldValue.increment(1),
    lastUpdated: now
  });

  return { imported, duplicates, batchId };
}

async function main() {
  if (!source || !csvFile) {
    printUsage();
    process.exit(1);
  }

  if (!VALID_SOURCES.includes(source.toLowerCase())) {
    console.error(`❌ Invalid source: ${source}`);
    console.error(`   Valid sources: ${VALID_SOURCES.join(', ')}`);
    process.exit(1);
  }

  const absolutePath = path.resolve(csvFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('PURCHASED LEADS IMPORT');
  console.log('='.repeat(60));
  console.log(`Source: ${source}`);
  console.log(`File: ${absolutePath}`);
  console.log(`Cost per lead: $${costPerLead.toFixed(4)}`);

  try {
    const leads = await parseCSV(absolutePath);
    console.log(`\nParsed ${leads.length} leads from CSV`);

    if (leads.length === 0) {
      console.error('❌ No valid leads found in CSV');
      process.exit(1);
    }

    const result = await importLeads(source.toLowerCase(), leads, costPerLead);

    console.log('\n' + '='.repeat(60));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Imported: ${result.imported}`);
    console.log(`Duplicates skipped: ${result.duplicates}`);
    console.log(`Batch ID: ${result.batchId}`);
    console.log(`Total cost: $${(result.imported * costPerLead).toFixed(2)}`);

    console.log('\nNext steps:');
    console.log('  1. Enable campaign: Set campaignEnabled=true in purchased_leads_config/schema');
    console.log('  2. Deploy function: firebase deploy --only functions:sendPurchasedLeadsCampaign');
    console.log('  3. Monitor: node scripts/analyze-purchased-leads.js');

    process.exit(0);

  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

main();
