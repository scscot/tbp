#!/usr/bin/env node
/**
 * Filter tbpleads.csv to remove emails that already exist in Firestore.
 *
 * Usage:
 *   cd /Users/sscott/tbp/functions && \
 *   GOOGLE_APPLICATION_CREDENTIALS="/Users/sscott/tbp/secrets/serviceAccountKey.json" \
 *   node ../scripts/filter-existing-contacts.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'teambuilder-plus-fe74d' });
const db = admin.firestore();

async function getAllExistingEmails() {
  const existingEmails = new Set();

  // Get emails from contacts collection
  console.log('Fetching emails from contacts collection...');
  const contactsSnapshot = await db.collection('emailCampaigns').doc('master').collection('contacts').get();
  contactsSnapshot.forEach(doc => {
    const email = doc.data().email?.toLowerCase();
    if (email) existingEmails.add(email);
  });
  console.log(`  Found ${contactsSnapshot.size} contacts`);

  // Get emails from contacts_yahoo collection
  console.log('Fetching emails from contacts_yahoo collection...');
  const yahooSnapshot = await db.collection('emailCampaigns').doc('master').collection('contacts_yahoo').get();
  yahooSnapshot.forEach(doc => {
    const email = doc.data().email?.toLowerCase();
    if (email) existingEmails.add(email);
  });
  console.log(`  Found ${yahooSnapshot.size} yahoo contacts`);

  console.log(`Total unique existing emails: ${existingEmails.size}\n`);
  return existingEmails;
}

async function main() {
  const inputFile = '/Users/sscott/tbp/emails/tbpleads.csv';
  const outputFile = '/Users/sscott/tbp/emails/tbpleads-filtered.csv';

  // Get existing emails from Firestore
  const existingEmails = await getAllExistingEmails();

  // Read CSV
  console.log(`Reading ${inputFile}...`);
  const content = fs.readFileSync(inputFile, 'utf8');
  const lines = content.split('\n');
  const header = lines[0];

  // Filter out existing emails
  let kept = 0;
  let removed = 0;
  const filteredLines = [header];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const email = parts[2]?.toLowerCase();

    if (email && existingEmails.has(email)) {
      removed++;
    } else {
      filteredLines.push(line);
      kept++;
    }
  }

  // Write filtered CSV
  fs.writeFileSync(outputFile, filteredLines.join('\n'));

  console.log(`\nResults:`);
  console.log(`  Original leads: ${lines.length - 1}`);
  console.log(`  Removed (already in Firestore): ${removed}`);
  console.log(`  Kept (new leads): ${kept}`);
  console.log(`\nWritten to: ${outputFile}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
