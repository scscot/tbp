#!/usr/bin/env node
/**
 * PreIntake.ai Mailgun Event Sync
 *
 * Syncs Mailgun delivery/engagement events to Firestore before they expire.
 * Mailgun logs expire after ~30 days, so this preserves analytics data permanently.
 *
 * Events synced:
 * - delivered: Email successfully delivered to recipient
 * - failed: Email bounced or rejected
 * - opened: Recipient opened the email (if tracking enabled)
 * - clicked: Recipient clicked a link (if tracking enabled)
 *
 * Environment Variables:
 *   MAILGUN_API_KEY - Mailgun API key for law.preintake.ai domain
 *   MAILGUN_DOMAIN - Mailgun sending domain (default: law.preintake.ai)
 *   LOOKBACK_HOURS - How many hours back to query events (default: 2)
 *
 * Usage:
 *   # Normal run (syncs last 2 hours of events)
 *   MAILGUN_API_KEY=xxx node scripts/sync-preintake-mailgun-events.js
 *
 *   # Custom lookback window
 *   LOOKBACK_HOURS=24 MAILGUN_API_KEY=xxx node scripts/sync-preintake-mailgun-events.js
 */

const axios = require('axios');

// Initialize Firebase Admin
const serviceAccount = require('../secrets/serviceAccountKey.json');
const admin = require('firebase-admin');

// Initialize with the preintake database
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
db.settings({ databaseId: 'preintake' });

// Configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'law.preintake.ai';
const LOOKBACK_HOURS = parseInt(process.env.LOOKBACK_HOURS || '2');
const COLLECTION_NAME = 'preintake_emails';

/**
 * Main sync function
 */
async function syncMailgunEvents() {
  console.log('🔄 PREINTAKE MAILGUN EVENT SYNC: Starting event synchronization');
  console.log(`   Domain: ${MAILGUN_DOMAIN}`);
  console.log(`   Lookback: ${LOOKBACK_HOURS} hours`);
  console.log('');

  if (!MAILGUN_API_KEY) {
    console.error('❌ Missing MAILGUN_API_KEY environment variable');
    process.exit(1);
  }

  try {
    const mailgunBaseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;
    const now = new Date();
    const lookbackMs = LOOKBACK_HOURS * 60 * 60 * 1000;
    const startTime = new Date(now.getTime() - lookbackMs);

    console.log(`🔄 Querying events from ${startTime.toISOString()} to ${now.toISOString()}`);

    const eventTypes = ['delivered', 'failed', 'opened', 'clicked'];
    const eventsByEmail = {};

    // Fetch events for each type
    for (const eventType of eventTypes) {
      try {
        const response = await axios.get(`${mailgunBaseUrl}/events`, {
          auth: {
            username: 'api',
            password: MAILGUN_API_KEY
          },
          params: {
            begin: Math.floor(startTime.getTime() / 1000),
            end: Math.floor(now.getTime() / 1000),
            event: eventType,
            limit: 300
          }
        });

        if (response.data && response.data.items) {
          for (const event of response.data.items) {
            const email = event.recipient;
            if (!eventsByEmail[email]) {
              eventsByEmail[email] = {
                delivered: [],
                failed: [],
                opened: [],
                clicked: []
              };
            }
            eventsByEmail[email][eventType].push(event);
          }
          console.log(`   Fetched ${response.data.items.length} ${eventType} events`);
        }
      } catch (error) {
        console.error(`⚠️  Error fetching ${eventType} events: ${error.message}`);
      }
    }

    const emailsToSync = Object.keys(eventsByEmail);
    console.log(`\n🔄 Processing ${emailsToSync.length} unique email addresses`);

    if (emailsToSync.length === 0) {
      console.log('✅ No events to sync');
      process.exit(0);
    }

    const contactsRef = db.collection(COLLECTION_NAME);
    let synced = 0;
    let notFound = 0;
    let errors = 0;

    const batches = [];
    let currentBatch = db.batch();
    let batchCount = 0;

    for (const email of emailsToSync) {
      try {
        // Find contact by email
        const contactSnapshot = await contactsRef.where('email', '==', email).limit(1).get();

        if (contactSnapshot.empty) {
          notFound++;
          continue;
        }

        const contactDoc = contactSnapshot.docs[0];
        const events = eventsByEmail[email];
        const updateData = {
          lastMailgunSync: now
        };

        // Process delivered events
        if (events.delivered.length > 0) {
          const latestDelivered = events.delivered.sort((a, b) => b.timestamp - a.timestamp)[0];
          updateData.deliveryStatus = 'delivered';
          updateData.deliveredAt = new Date(latestDelivered.timestamp * 1000);
        }

        // Process failed events (overrides delivered if both exist)
        if (events.failed.length > 0) {
          const latestFailed = events.failed.sort((a, b) => b.timestamp - a.timestamp)[0];
          updateData.deliveryStatus = 'failed';
          updateData.failedAt = new Date(latestFailed.timestamp * 1000);
          updateData.failureReason = latestFailed.reason ||
            latestFailed['delivery-status']?.message ||
            latestFailed['delivery-status']?.description ||
            'Unknown';
        }

        // Process opened events
        if (events.opened.length > 0) {
          const firstOpen = events.opened.sort((a, b) => a.timestamp - b.timestamp)[0];
          const existingData = contactDoc.data();

          // Only set openedAt if not already set (preserve first open)
          if (!existingData.openedAt) {
            updateData.openedAt = new Date(firstOpen.timestamp * 1000);
          }

          // Update open count (add to existing or set new)
          updateData.openCount = (existingData.openCount || 0) + events.opened.length;
          updateData.lastOpenedAt = new Date(events.opened.sort((a, b) => b.timestamp - a.timestamp)[0].timestamp * 1000);
        }

        // Process clicked events
        if (events.clicked.length > 0) {
          const firstClick = events.clicked.sort((a, b) => a.timestamp - b.timestamp)[0];
          const existingData = contactDoc.data();

          // Only set clickedAt if not already set (preserve first click)
          if (!existingData.clickedAt) {
            updateData.clickedAt = new Date(firstClick.timestamp * 1000);
          }

          // Update click count (add to existing or set new)
          updateData.clickCount = (existingData.clickCount || 0) + events.clicked.length;
          updateData.lastClickedAt = new Date(events.clicked.sort((a, b) => b.timestamp - a.timestamp)[0].timestamp * 1000);

          // Track clicked URLs
          const clickedUrls = events.clicked.map(e => e.url).filter(Boolean);
          if (clickedUrls.length > 0) {
            updateData.clickedUrls = admin.firestore.FieldValue.arrayUnion(...clickedUrls);
          }
        }

        currentBatch.update(contactDoc.ref, updateData);
        batchCount++;
        synced++;

        // Firestore batch limit is 500 operations
        if (batchCount >= 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Error processing ${email}: ${error.message}`);
        errors++;
      }
    }

    // Don't forget the last batch
    if (batchCount > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches
    console.log(`\n💾 Committing ${batches.length} batch(es)...`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await batches[i].commit();
        console.log(`   Batch ${i + 1}/${batches.length} committed`);
      } catch (error) {
        console.error(`   ❌ Batch ${i + 1} failed: ${error.message}`);
      }
    }

    // Summary
    console.log(`\n✅ PREINTAKE MAILGUN EVENT SYNC: Complete`);
    console.log(`   Emails processed: ${emailsToSync.length}`);
    console.log(`   Contacts updated: ${synced}`);
    console.log(`   Contacts not found: ${notFound}`);
    console.log(`   Errors: ${errors}`);

    process.exit(errors > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the sync
syncMailgunEvents();
