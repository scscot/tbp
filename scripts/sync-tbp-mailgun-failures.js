#!/usr/bin/env node

/**
 * Sync TBP Mailgun Failures to Firestore
 *
 * This script queries Mailgun for permanently failed email deliveries
 * from the Team Build Pro campaigns and marks them in Firestore to
 * prevent future send attempts.
 *
 * Collections checked:
 *   - bfh_contacts
 *   - fsr_contacts
 *   - paparazzi_contacts
 *   - pruvit_contacts
 *   - scentsy_contacts
 *   - zinzino_contacts
 *   - purchased_leads
 *   - direct_sales_contacts
 *   - emailCampaigns/master/contacts
 *
 * Usage:
 *   node scripts/sync-tbp-mailgun-failures.js [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *
 * Schedule: Daily via GitHub Actions
 */

const admin = require('firebase-admin');
const axios = require('axios');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Initialize Firebase Admin (default database for TBP)
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// Note: TBP uses the default database, not 'preintake'

// Load Mailgun config
const mailgunConfigPath = path.join(__dirname, '../secrets/mailgun_config.json');
const mailgunConfig = require(mailgunConfigPath);

const MAILGUN_API_KEY = mailgunConfig.tbp_api_key;
const MAILGUN_DOMAIN = mailgunConfig.tbp_domain;
const FROM_EMAIL = 'stephen@news.teambuildpro.com';

// All TBP contact collections to check
const CONTACT_COLLECTIONS = [
  'bfh_contacts',
  'fsr_contacts',
  'paparazzi_contacts',
  'pruvit_contacts',
  'scentsy_contacts',
  'zinzino_contacts',
  'purchased_leads',
  'direct_sales_contacts',
  'emailCampaigns/master/contacts'
];

/**
 * Fetch failed events from Mailgun API
 * @returns {Promise<string[]>} Array of unique failed email addresses
 */
async function fetchMailgunFailures() {
  const failedEmails = new Set();
  let nextUrl = null;
  let pageCount = 0;
  const maxPages = 50; // Higher limit for TBP (more volume)

  console.log('Fetching failed deliveries from Mailgun...');

  do {
    const url = nextUrl || `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/events`;
    const params = nextUrl ? {} : {
      event: 'failed',
      limit: 300,
      from: FROM_EMAIL
    };

    try {
      const response = await axios.get(url, {
        auth: {
          username: 'api',
          password: MAILGUN_API_KEY
        },
        params
      });

      const { items, paging } = response.data;

      // Extract email addresses from failed events
      for (const item of items) {
        // Only count permanent failures (not temporary/soft bounces)
        if (item.severity === 'permanent' && item.recipient) {
          failedEmails.add(item.recipient.toLowerCase());
        }
      }

      pageCount++;
      console.log(`  Page ${pageCount}: ${items.length} events, ${failedEmails.size} unique failures so far`);

      // Stop if we got an empty page (no more results)
      if (items.length === 0) {
        break;
      }

      // Get next page URL if available
      nextUrl = paging?.next || null;

    } catch (error) {
      console.error('Mailgun API error:', error.response?.data || error.message);
      break;
    }

  } while (nextUrl && pageCount < maxPages);

  console.log(`Found ${failedEmails.size} unique permanently failed email addresses\n`);
  return Array.from(failedEmails);
}

/**
 * Find and update a failed email across all contact collections
 * @param {string} email Email address to mark as failed
 * @returns {Promise<{found: boolean, collection: string|null, alreadyFailed: boolean}>}
 */
async function findAndMarkEmail(email) {
  for (const collectionPath of CONTACT_COLLECTIONS) {
    const snapshot = await db.collection(collectionPath)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();

      // Check if already marked as failed
      if (data.status === 'failed') {
        return { found: true, collection: collectionPath, alreadyFailed: true };
      }

      if (!DRY_RUN) {
        await doc.ref.update({
          status: 'failed',
          failReason: 'permanent_bounce',
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return { found: true, collection: collectionPath, alreadyFailed: false };
    }
  }

  return { found: false, collection: null, alreadyFailed: false };
}

/**
 * Mark failed emails in Firestore
 * @param {string[]} failedEmails Array of email addresses to mark as failed
 */
async function markFailedInFirestore(failedEmails) {
  const stats = {
    updated: 0,
    alreadyFailed: 0,
    notFound: 0,
    byCollection: {}
  };

  // Initialize collection counters
  for (const col of CONTACT_COLLECTIONS) {
    stats.byCollection[col] = { updated: 0, alreadyFailed: 0 };
  }

  console.log('Updating Firestore records...');

  for (const email of failedEmails) {
    const result = await findAndMarkEmail(email);

    if (!result.found) {
      stats.notFound++;
      continue;
    }

    if (result.alreadyFailed) {
      stats.alreadyFailed++;
      stats.byCollection[result.collection].alreadyFailed++;
      continue;
    }

    stats.updated++;
    stats.byCollection[result.collection].updated++;

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would mark as failed in ${result.collection}: ${email}`);
    } else {
      console.log(`  Updated in ${result.collection}: ${email}`);
    }
  }

  return stats;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(70));
  console.log('TBP Mailgun Failure Sync');
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log(`From: ${FROM_EMAIL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(70));
  console.log();

  // Fetch failures from Mailgun
  const failedEmails = await fetchMailgunFailures();

  if (failedEmails.length === 0) {
    console.log('No failed emails to process.');
    return;
  }

  // Mark in Firestore
  const stats = await markFailedInFirestore(failedEmails);

  // Summary
  console.log();
  console.log('='.repeat(70));
  console.log('Summary:');
  console.log(`  Total failures from Mailgun: ${failedEmails.length}`);
  console.log(`  Newly marked as failed: ${stats.updated}`);
  console.log(`  Already marked as failed: ${stats.alreadyFailed}`);
  console.log(`  Not found in any collection: ${stats.notFound}`);
  console.log();
  console.log('By Collection:');
  for (const [col, colStats] of Object.entries(stats.byCollection)) {
    if (colStats.updated > 0 || colStats.alreadyFailed > 0) {
      console.log(`  ${col}: ${colStats.updated} updated, ${colStats.alreadyFailed} already failed`);
    }
  }
  console.log('='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
