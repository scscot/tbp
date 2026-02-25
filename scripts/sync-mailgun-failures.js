#!/usr/bin/env node

/**
 * Sync Mailgun Failures to Firestore
 *
 * This script queries Mailgun for permanently failed email deliveries
 * and marks them in Firestore to prevent future send attempts.
 *
 * Usage:
 *   node scripts/sync-mailgun-failures.js [--dry-run]
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

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Load Mailgun config
const mailgunConfigPath = path.join(__dirname, '../secrets/mailgun_config.json');
const mailgunConfig = require(mailgunConfigPath);

const MAILGUN_API_KEY = mailgunConfig.preintake_api_key;
const MAILGUN_DOMAIN = mailgunConfig.preintake_domain;
const FROM_EMAIL = 'stephen@law.preintake.ai';

/**
 * Fetch failed events from Mailgun API
 * @returns {Promise<string[]>} Array of unique failed email addresses
 */
async function fetchMailgunFailures() {
  const failedEmails = new Set();
  let nextUrl = null;
  let pageCount = 0;
  const maxPages = 20; // Safety limit

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
 * Mark failed emails in Firestore
 * @param {string[]} failedEmails Array of email addresses to mark as failed
 */
async function markFailedInFirestore(failedEmails) {
  let updated = 0;
  let alreadyFailed = 0;
  let notFound = 0;

  console.log('Updating Firestore records...');

  for (const email of failedEmails) {
    const snapshot = await db.collection('preintake_emails')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      notFound++;
      continue;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Skip if already marked as failed
    if (data.status === 'failed') {
      alreadyFailed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would mark as failed: ${email}`);
      updated++;
    } else {
      await doc.ref.update({
        status: 'failed',
        failReason: 'permanent_bounce',
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  Updated: ${email}`);
      updated++;
    }
  }

  return { updated, alreadyFailed, notFound };
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Mailgun Failure Sync');
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log(`From: ${FROM_EMAIL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));
  console.log();

  // Fetch failures from Mailgun
  const failedEmails = await fetchMailgunFailures();

  if (failedEmails.length === 0) {
    console.log('No failed emails to process.');
    return;
  }

  // Mark in Firestore
  const { updated, alreadyFailed, notFound } = await markFailedInFirestore(failedEmails);

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Total failures from Mailgun: ${failedEmails.length}`);
  console.log(`  Newly marked as failed: ${updated}`);
  console.log(`  Already marked as failed: ${alreadyFailed}`);
  console.log(`  Not found in database: ${notFound}`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
