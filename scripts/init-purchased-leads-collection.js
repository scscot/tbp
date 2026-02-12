#!/usr/bin/env node
/**
 * Initialize Firestore schema for purchased leads tracking
 *
 * Collections:
 * - purchased_leads: Individual lead records from paid sources
 * - purchased_leads_config: Configuration and batch tracking
 * - purchased_leads_stats: Aggregated performance metrics by source
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'secrets', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Schema definitions for documentation
const SCHEMA = {
  // Individual lead document
  lead: {
    // Source information
    source: 'apollo | apache | exactdata | other',
    batchId: 'string - links to purchase batch',
    purchaseDate: 'timestamp',
    costPerLead: 'number',

    // Contact information
    firstName: 'string',
    lastName: 'string',
    email: 'string',
    phone: 'string (optional)',

    // Additional data (varies by source)
    company: 'string (optional)',
    jobTitle: 'string (optional)',
    city: 'string (optional)',
    state: 'string (optional)',

    // Campaign tracking
    sent: 'boolean',
    sentAt: 'timestamp',
    templateVersion: 'v7 | v8',
    subjectTag: 'string',
    mailgunId: 'string',

    // Engagement tracking
    delivered: 'boolean',
    deliveredAt: 'timestamp',
    opened: 'boolean',
    openedAt: 'timestamp',
    clicked: 'boolean',
    clickedAt: 'timestamp',

    // Status
    status: 'pending | sent | delivered | clicked | bounced | unsubscribed',
    errorMessage: 'string (if failed)',

    // Metadata
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },

  // Batch/purchase tracking
  batch: {
    batchId: 'string',
    source: 'apollo | apache | exactdata',
    purchaseDate: 'timestamp',
    totalLeads: 'number',
    totalCost: 'number',
    costPerLead: 'number',

    // Quality metrics (updated after campaign)
    validEmails: 'number',
    invalidEmails: 'number',
    emailValidityRate: 'number (0-1)',

    // Campaign metrics
    sent: 'number',
    delivered: 'number',
    opened: 'number',
    clicked: 'number',
    bounced: 'number',

    // Calculated metrics
    deliveryRate: 'number (0-1)',
    openRate: 'number (0-1)',
    clickRate: 'number (0-1)',
    costPerClick: 'number',

    // Status
    status: 'pending | in_progress | complete',
    notes: 'string'
  },

  // Aggregated source performance
  sourceStats: {
    source: 'apollo | apache | exactdata',

    // Totals
    totalLeads: 'number',
    totalCost: 'number',
    totalSent: 'number',
    totalDelivered: 'number',
    totalOpened: 'number',
    totalClicked: 'number',
    totalBounced: 'number',

    // Rates
    avgDeliveryRate: 'number (0-1)',
    avgOpenRate: 'number (0-1)',
    avgClickRate: 'number (0-1)',
    avgCostPerClick: 'number',

    // Best/worst batches
    bestBatchId: 'string',
    bestClickRate: 'number',
    worstBatchId: 'string',
    worstClickRate: 'number',

    // Metadata
    lastUpdated: 'timestamp',
    batchCount: 'number'
  }
};

async function initializeCollections() {
  console.log('Initializing Firestore collections for purchased leads...\n');

  // Create config document with schema reference
  const configRef = db.collection('purchased_leads_config').doc('schema');
  await configRef.set({
    version: '1.0',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    schema: SCHEMA,
    sources: ['apollo', 'apache', 'exactdata'],
    activeTemplates: ['v7', 'v8'],
    campaignEnabled: false, // Enable when ready to send
    batchSize: 50, // Emails per campaign run
    notes: 'Purchased leads email campaign configuration'
  });
  console.log('✅ Created: purchased_leads_config/schema');

  // Initialize source stats documents
  const sources = ['apollo', 'apache', 'exactdata'];
  for (const source of sources) {
    const statsRef = db.collection('purchased_leads_stats').doc(source);
    await statsRef.set({
      source,
      totalLeads: 0,
      totalCost: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      avgDeliveryRate: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
      avgCostPerClick: 0,
      bestBatchId: null,
      bestClickRate: 0,
      worstBatchId: null,
      worstClickRate: 1,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      batchCount: 0
    });
    console.log(`✅ Created: purchased_leads_stats/${source}`);
  }

  // Create example batch document (for reference)
  const exampleBatchRef = db.collection('purchased_leads_batches').doc('example_batch');
  await exampleBatchRef.set({
    batchId: 'example_batch',
    source: 'apollo',
    purchaseDate: admin.firestore.FieldValue.serverTimestamp(),
    totalLeads: 0,
    totalCost: 0,
    costPerLead: 0,
    validEmails: 0,
    invalidEmails: 0,
    emailValidityRate: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    costPerClick: 0,
    status: 'example',
    notes: 'This is an example batch document for schema reference. Delete when adding real batches.'
  });
  console.log('✅ Created: purchased_leads_batches/example_batch');

  console.log('\n✅ Firestore schema initialization complete!');
  console.log('\nCollections created:');
  console.log('  - purchased_leads (empty, ready for imports)');
  console.log('  - purchased_leads_config (campaign configuration)');
  console.log('  - purchased_leads_stats (per-source performance tracking)');
  console.log('  - purchased_leads_batches (batch/purchase tracking)');

  console.log('\nNext steps:');
  console.log('  1. Import leads using import-purchased-leads.js');
  console.log('  2. Enable campaign in purchased_leads_config/schema');
  console.log('  3. Deploy email-campaign-purchased.js Cloud Function');

  process.exit(0);
}

initializeCollections().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
