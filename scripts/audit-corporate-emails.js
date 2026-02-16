#!/usr/bin/env node
/**
 * Audit emailCampaigns/master/contacts for blacklisted corporate domains
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'teambuilder-plus-fe74d'
});

const db = admin.firestore();

// Load corporate domains from base_urls.txt
function loadCorporateDomains() {
  const baseUrlsPath = path.join(__dirname, 'base_urls.txt');
  const content = fs.readFileSync(baseUrlsPath, 'utf8');
  const domains = new Set();

  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line) return;
    try {
      const url = new URL(line);
      domains.add(url.hostname.replace(/^www\./, ''));
    } catch (e) {
      // Skip invalid URLs
    }
  });

  return domains;
}

async function auditCollection(collectionPath, CORPORATE_DOMAINS) {
  console.log('\n' + '='.repeat(60));
  console.log('AUDITING:', collectionPath);
  console.log('='.repeat(60));

  // Handle subcollection path
  const parts = collectionPath.split('/');
  let ref;
  if (parts.length === 3) {
    ref = db.collection(parts[0]).doc(parts[1]).collection(parts[2]);
  } else {
    ref = db.collection(collectionPath);
  }

  const snapshot = await ref.get();
  console.log('Total contacts:', snapshot.size);

  const corporateContacts = [];
  const domainCounts = {};

  snapshot.forEach(doc => {
    const email = (doc.data().email || '').toLowerCase();
    if (!email.includes('@')) return;

    const domain = email.split('@')[1];
    if (CORPORATE_DOMAINS.has(domain)) {
      corporateContacts.push({
        id: doc.id,
        email,
        name: doc.data().fullName || ((doc.data().firstName || '') + ' ' + (doc.data().lastName || '')).trim(),
        sent: doc.data().sent || false
      });
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }
  });

  console.log('Contacts with BLACKLISTED domains:', corporateContacts.length);

  if (corporateContacts.length > 0) {
    // Sort domains by count
    const sortedDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);

    console.log('\nTop corporate domains found:');
    sortedDomains.slice(0, 15).forEach(([domain, count]) => {
      console.log('  ' + count.toString().padStart(4) + ' - ' + domain);
    });

    // Count sent vs unsent
    const sent = corporateContacts.filter(c => c.sent).length;
    const unsent = corporateContacts.filter(c => !c.sent).length;

    console.log('\nSent status:');
    console.log('  Sent:', sent);
    console.log('  Unsent:', unsent);

    console.log('\nSample contacts:');
    corporateContacts.slice(0, 5).forEach((c, i) => {
      console.log('  ' + (i+1) + '. ' + c.email);
    });
  }

  return { collection: collectionPath, total: snapshot.size, corporate: corporateContacts.length, contacts: corporateContacts };
}

async function audit() {
  const CORPORATE_DOMAINS = loadCorporateDomains();
  console.log('Loaded', CORPORATE_DOMAINS.size, 'corporate domains');

  const collections = [
    'emailCampaigns/master/contacts',
    'bfh_contacts',
    'direct_sales_contacts',
    'purchased_leads'
  ];

  const results = [];
  for (const coll of collections) {
    const result = await auditCollection(coll, CORPORATE_DOMAINS);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log('\nCollection'.padEnd(35) + 'Total'.padStart(8) + 'Corporate'.padStart(12));
  console.log('-'.repeat(55));
  results.forEach(r => {
    console.log(r.collection.padEnd(35) + r.total.toString().padStart(8) + r.corporate.toString().padStart(12));
  });

  const totalCorporate = results.reduce((sum, r) => sum + r.corporate, 0);
  console.log('-'.repeat(55));
  console.log('TOTAL CORPORATE EMAILS TO CLEAN:'.padEnd(43) + totalCorporate.toString().padStart(12));

  // If --remove flag is passed, delete the corporate contacts
  if (process.argv.includes('--remove')) {
    console.log('\n' + '='.repeat(60));
    console.log('REMOVING CORPORATE CONTACTS');
    console.log('='.repeat(60));

    for (const result of results) {
      if (result.contacts.length === 0) continue;

      const parts = result.collection.split('/');
      let ref;
      if (parts.length === 3) {
        ref = db.collection(parts[0]).doc(parts[1]).collection(parts[2]);
      } else {
        ref = db.collection(result.collection);
      }

      // Delete in batches of 500
      const BATCH_SIZE = 500;
      let deleted = 0;
      for (let i = 0; i < result.contacts.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchContacts = result.contacts.slice(i, i + BATCH_SIZE);
        batchContacts.forEach(c => batch.delete(ref.doc(c.id)));
        await batch.commit();
        deleted += batchContacts.length;
      }
      console.log('Removed', deleted, 'from', result.collection);
    }

    console.log('\nDone. Total removed:', totalCorporate);
  }

  process.exit(0);
}

audit().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
