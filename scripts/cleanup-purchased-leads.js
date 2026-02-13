#!/usr/bin/env node
/**
 * Cleanup Purchased Leads - Remove Corporate Email Contacts
 *
 * Identifies and removes contacts with corporate MLM domain emails
 * that are likely to bounce.
 *
 * Usage:
 *   node scripts/cleanup-purchased-leads.js --audit      # Analyze only
 *   node scripts/cleanup-purchased-leads.js --delete     # Delete corporate emails
 *   node scripts/cleanup-purchased-leads.js --mark       # Mark as invalid (don't delete)
 */

const admin = require('firebase-admin');
const path = require('path');

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'teambuilder-plus-fe74d'
});
const db = admin.firestore();

console.log('Firebase initialized');

// ============================================================================
// CORPORATE DOMAINS TO REMOVE
// ============================================================================

const CORPORATE_MLM_DOMAINS = [
  // Major MLM/Direct Sales companies
  'youngliving.com', 'itworks.com', 'herbalife.com', 'avon.com', 'lifevantage.com',
  'stelladot.com', 'shaklee.com', 'senegence.com', 'partylite.com', 'pamperedchef.com',
  'myitworks.com', '4life.com', 'nuskin.com', 'origamiowl.com', 'beachbody.com',
  'rodanandfields.com', 'arbonne.com', 'monat.com', 'melaleuca.com', 'marykay.com',
  'tupperware.com', 'primerica.com', 'amway.com', 'isagenix.com', 'plexus.com',
  'doterra.com', 'usana.com', 'advocare.com', 'nerium.com', 'neora.com',
  'younique.com', 'youniqueproducts.com', 'worldventures.com', 'zurvita.com',
  'modere.com', 'ariix.com', 'jeunesseglobal.com', 'seacretdirect.com',
  'legalshield.com', 'acn.com', 'lifewave.com', 'mannatech.com',
  'marketamerica.com', 'shop.com', 'fuxion.net', 'zyia.com',
  // Additional MLM domains from "unknown" list
  'pureromance.com', 'tranont.com', 'monatglobal.com', 'myrandf.com',
  'teambeachbody.com', 'my.tupperware.com', 'qsciences.com', 'avonfoundation.org',
  'itworksglobal.com', 'enagic.com', 'xyngular.com', 'tfaconnect.com',
  'foreverliving.com', 'unicity.com', 'yoli.com', 'relivinc.com',
  'youngevity.com', 'sunrider.com', 'univerahealthcare.com', 'wfgmail.com',
  'lularoe.com', 'colorstreet.com', 'scentsy.com', 'thirtyone.com',
  // Additional corporate domains found in data
  'wkrg.com', 'utc.edu', 'wellsfargo.com', 'dena.de', 'lls.org',
  'qg.com', 'totalenergies.com', 'utsouthwestern.edu', 'avoyanetwork.com',
  'ieee.org', 'ngkf.com', 'agwest.com', 'centurytel.net', 'bedbath.com',
  'prudential.com', 'vivint.com'
];

// Personal email domains to KEEP
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'me.com', 'live.com', 'msn.com', 'protonmail.com',
  'ymail.com', 'rocketmail.com', 'mail.com', 'zoho.com', 'gmx.com',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net',
  'cox.net', 'charter.net', 'earthlink.net', 'juno.com', 'netzero.com',
  'frontier.com', 'windstream.net', 'optimum.net', 'optonline.net'
];

function getEmailDomain(email) {
  if (!email) return null;
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : null;
}

function isPersonalEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return PERSONAL_DOMAINS.includes(domain);
}

function isCorporateMLMEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return CORPORATE_MLM_DOMAINS.includes(domain);
}

// ============================================================================
// AUDIT FUNCTION
// ============================================================================

async function auditPurchasedLeads() {
  console.log('\n=== Auditing Purchased Leads ===\n');

  const snapshot = await db.collection('purchased_leads').get();
  console.log(`Total purchased_leads: ${snapshot.size}\n`);

  const personal = [];
  const corporate = [];
  const unknown = [];
  const alreadySent = [];

  const domainCounts = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const domain = getEmailDomain(data.email);

    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }

    if (data.sent === true) {
      alreadySent.push({ id: doc.id, ...data });
    } else if (isPersonalEmail(data.email)) {
      personal.push({ id: doc.id, ...data });
    } else if (isCorporateMLMEmail(data.email)) {
      corporate.push({ id: doc.id, ...data });
    } else {
      unknown.push({ id: doc.id, ...data, domain });
    }
  });

  console.log('=== CATEGORIZATION ===\n');
  console.log(`✓ Personal emails (KEEP): ${personal.length}`);
  console.log(`✗ Corporate MLM emails (DELETE): ${corporate.length}`);
  console.log(`? Unknown domain emails (REVIEW): ${unknown.length}`);
  console.log(`📤 Already sent (KEEP): ${alreadySent.length}`);

  // Top corporate domains
  console.log('\n=== TOP CORPORATE DOMAINS TO DELETE ===\n');
  const corporateDomains = {};
  corporate.forEach(c => {
    const domain = getEmailDomain(c.email);
    corporateDomains[domain] = (corporateDomains[domain] || 0) + 1;
  });
  Object.entries(corporateDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([domain, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${domain}`);
    });

  // Unknown domains for review
  console.log('\n=== UNKNOWN DOMAINS (need review) ===\n');
  const unknownDomains = {};
  unknown.forEach(c => {
    unknownDomains[c.domain] = (unknownDomains[c.domain] || 0) + 1;
  });
  Object.entries(unknownDomains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([domain, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${domain}`);
    });

  // Personal domains breakdown
  console.log('\n=== PERSONAL EMAIL DOMAINS (keeping) ===\n');
  const personalDomains = {};
  personal.forEach(c => {
    const domain = getEmailDomain(c.email);
    personalDomains[domain] = (personalDomains[domain] || 0) + 1;
  });
  Object.entries(personalDomains)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      console.log(`  ${count.toString().padStart(4)} - ${domain}`);
    });

  console.log('\n=== SUMMARY ===\n');
  console.log(`Total contacts: ${snapshot.size}`);
  console.log(`To DELETE (corporate): ${corporate.length}`);
  console.log(`To KEEP (personal + sent): ${personal.length + alreadySent.length}`);
  console.log(`To REVIEW (unknown): ${unknown.length}`);
  console.log(`\nAfter cleanup: ${personal.length + alreadySent.length + unknown.length} contacts`);

  return { personal, corporate, unknown, alreadySent };
}

// ============================================================================
// DELETE FUNCTION
// ============================================================================

async function deleteCorporateLeads(dryRun = false) {
  const { corporate } = await auditPurchasedLeads();

  if (corporate.length === 0) {
    console.log('\nNo corporate emails to delete.');
    return;
  }

  console.log(`\n=== ${dryRun ? '[DRY RUN] ' : ''}Deleting ${corporate.length} Corporate Email Contacts ===\n`);

  if (dryRun) {
    console.log('Sample contacts that would be deleted:');
    corporate.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i+1}. ${c.firstName} ${c.lastName} <${c.email}>`);
    });
    if (corporate.length > 10) {
      console.log(`  ... and ${corporate.length - 10} more`);
    }
    return;
  }

  // Delete in batches of 500
  const BATCH_SIZE = 500;
  let deleted = 0;

  for (let i = 0; i < corporate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchContacts = corporate.slice(i, i + BATCH_SIZE);

    for (const contact of batchContacts) {
      batch.delete(db.collection('purchased_leads').doc(contact.id));
    }

    await batch.commit();
    deleted += batchContacts.length;
    console.log(`  Deleted batch: ${deleted}/${corporate.length}`);
  }

  console.log(`\n=== Deletion Complete ===`);
  console.log(`Deleted: ${deleted} corporate email contacts`);

  // Show final stats
  const finalSnapshot = await db.collection('purchased_leads').count().get();
  console.log(`Remaining purchased_leads: ${finalSnapshot.data().count}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const audit = args.includes('--audit');
  const deleteCmd = args.includes('--delete');
  const dryRun = args.includes('--dry-run');

  if (!audit && !deleteCmd) {
    console.log('Usage:');
    console.log('  node scripts/cleanup-purchased-leads.js --audit      # Analyze only');
    console.log('  node scripts/cleanup-purchased-leads.js --delete     # Delete corporate emails');
    console.log('  node scripts/cleanup-purchased-leads.js --dry-run    # Preview deletions');
    process.exit(1);
  }

  if (audit) {
    await auditPurchasedLeads();
  }

  if (deleteCmd) {
    await deleteCorporateLeads(dryRun);
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
