#!/usr/bin/env node
/**
 * Migrate Apollo Contacts to Purchased Leads Collection
 *
 * Migrates contacts from apollo_contacts to purchased_leads collection
 * so they can use the existing purchased leads email campaign infrastructure.
 *
 * Usage:
 *   node scripts/migrate-apollo-to-purchased-leads.js --dry-run    # Preview only
 *   node scripts/migrate-apollo-to-purchased-leads.js --migrate    # Perform migration
 *   node scripts/migrate-apollo-to-purchased-leads.js --stats      # Show stats
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
const FieldValue = admin.firestore.FieldValue;

console.log('Firebase initialized');

// ============================================================================
// MIGRATION FUNCTION
// ============================================================================

async function migrateContacts(dryRun = false) {
  console.log('\n=== Migrating Apollo Contacts to Purchased Leads ===\n');

  // Load existing emails in purchased_leads to avoid duplicates
  const existingEmails = new Set();
  const purchasedSnapshot = await db.collection('purchased_leads').get();
  purchasedSnapshot.forEach(doc => {
    const email = doc.data().email;
    if (email) existingEmails.add(email.toLowerCase());
  });
  console.log(`Existing purchased_leads: ${purchasedSnapshot.size}`);

  // Load apollo_contacts
  const apolloSnapshot = await db.collection('apollo_contacts').get();
  console.log(`Apollo contacts to migrate: ${apolloSnapshot.size}`);

  // Categorize
  const toMigrate = [];
  const duplicates = [];
  const alreadySent = [];

  apolloSnapshot.forEach(doc => {
    const data = doc.data();
    const emailLower = data.email?.toLowerCase();

    if (existingEmails.has(emailLower)) {
      duplicates.push({ id: doc.id, ...data });
    } else if (data.sent === true) {
      alreadySent.push({ id: doc.id, ...data });
    } else {
      toMigrate.push({ id: doc.id, ...data });
    }
  });

  console.log(`\nMigration breakdown:`);
  console.log(`  To migrate: ${toMigrate.length}`);
  console.log(`  Duplicates (skip): ${duplicates.length}`);
  console.log(`  Already sent (skip): ${alreadySent.length}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would migrate the following contacts:\n');
    toMigrate.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i+1}. ${c.firstName} ${c.lastName} <${c.email}> (${c.company || 'N/A'})`);
    });
    if (toMigrate.length > 10) {
      console.log(`  ... and ${toMigrate.length - 10} more`);
    }
    return { migrated: 0, duplicates: duplicates.length, dryRun: true };
  }

  // Migrate in batches of 500
  const BATCH_SIZE = 500;
  let migrated = 0;

  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchContacts = toMigrate.slice(i, i + BATCH_SIZE);

    for (const contact of batchContacts) {
      const docRef = db.collection('purchased_leads').doc();

      // Map apollo source to purchased_leads format
      let source = 'apollo';
      if (contact.source === 'apollo_secondary') {
        source = 'apollo_secondary';
      } else if (contact.source === 'apollo_serpapi') {
        source = 'apollo_serpapi';
      }

      batch.set(docRef, {
        firstName: contact.firstName,
        lastName: contact.lastName || '',
        fullName: contact.fullName || `${contact.firstName} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        company: contact.company || null,
        title: contact.title || null,
        source: source,
        originalSource: contact.source,
        batchId: `apollo_migration_${Date.now()}`,
        randomIndex: Math.random(), // For A/B test distribution
        sent: false,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
        importedAt: FieldValue.serverTimestamp(),
        migratedFrom: 'apollo_contacts',
        originalDocId: contact.id
      });
    }

    await batch.commit();
    migrated += batchContacts.length;
    console.log(`  Migrated batch: ${migrated}/${toMigrate.length}`);
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Duplicates skipped: ${duplicates.length}`);

  return { migrated, duplicates: duplicates.length };
}

// ============================================================================
// ENABLE CAMPAIGN CONFIG
// ============================================================================

async function enableCampaignConfig() {
  console.log('\n=== Setting up Purchased Leads Campaign Config ===\n');

  const configRef = db.collection('purchased_leads_config').doc('schema');
  const configDoc = await configRef.get();

  if (configDoc.exists) {
    console.log('Current config:', JSON.stringify(configDoc.data(), null, 2));
  } else {
    console.log('No config exists. Creating default config...');
    await configRef.set({
      campaignEnabled: false, // Set to true when ready to send
      batchSize: 25,
      description: 'Purchased leads email campaign configuration',
      createdAt: FieldValue.serverTimestamp()
    });
    console.log('Default config created (campaignEnabled: false)');
  }

  console.log('\nTo enable the campaign, set campaignEnabled to true in Firestore:');
  console.log('  Collection: purchased_leads_config');
  console.log('  Document: schema');
  console.log('  Field: campaignEnabled = true');
}

// ============================================================================
// STATS
// ============================================================================

async function showStats() {
  console.log('\n=== Collection Stats ===\n');

  // Apollo contacts
  const apolloSnapshot = await db.collection('apollo_contacts').get();
  let apolloSent = 0;
  let apolloUnsent = 0;
  apolloSnapshot.forEach(doc => {
    if (doc.data().sent) apolloSent++;
    else apolloUnsent++;
  });
  console.log(`apollo_contacts: ${apolloSnapshot.size} total (${apolloSent} sent, ${apolloUnsent} unsent)`);

  // Purchased leads
  const purchasedSnapshot = await db.collection('purchased_leads').get();
  let purchasedSent = 0;
  let purchasedUnsent = 0;
  const bySource = {};
  purchasedSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.sent) purchasedSent++;
    else purchasedUnsent++;
    const source = data.source || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
  });
  console.log(`purchased_leads: ${purchasedSnapshot.size} total (${purchasedSent} sent, ${purchasedUnsent} unsent)`);
  console.log(`  By source:`);
  Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    console.log(`    ${source}: ${count}`);
  });

  // Config
  const configDoc = await db.collection('purchased_leads_config').doc('schema').get();
  if (configDoc.exists) {
    const config = configDoc.data();
    console.log(`\nCampaign config:`);
    console.log(`  Enabled: ${config.campaignEnabled}`);
    console.log(`  Batch size: ${config.batchSize}`);
  } else {
    console.log('\nNo campaign config found.');
  }

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const migrate = args.includes('--migrate');
  const dryRun = args.includes('--dry-run');
  const stats = args.includes('--stats');

  if (!migrate && !dryRun && !stats) {
    console.log('Usage:');
    console.log('  node scripts/migrate-apollo-to-purchased-leads.js --dry-run    # Preview only');
    console.log('  node scripts/migrate-apollo-to-purchased-leads.js --migrate    # Perform migration');
    console.log('  node scripts/migrate-apollo-to-purchased-leads.js --stats      # Show stats');
    console.log('');
    console.log('This script migrates apollo_contacts to purchased_leads collection');
    console.log('to use the existing purchased leads email campaign infrastructure.');
    process.exit(1);
  }

  if (stats) {
    await showStats();
    process.exit(0);
  }

  if (migrate || dryRun) {
    await migrateContacts(dryRun);
    await enableCampaignConfig();
  }

  await showStats();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
