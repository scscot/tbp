#!/usr/bin/env node
/**
 * resend-missed-notifications.js
 *
 * One-time script to resend push notifications that were missed
 * due to NOTIFICATIONS_ENABLE_TRIGGER not being set (Dec 11-22, 2025).
 *
 * Usage:
 *   # Dry run (default) - shows what would be sent
 *   GOOGLE_APPLICATION_CREDENTIALS="../secrets/serviceAccountKey.json" node resend-missed-notifications.js
 *
 *   # Actually send notifications
 *   GOOGLE_APPLICATION_CREDENTIALS="../secrets/serviceAccountKey.json" node resend-missed-notifications.js --send
 */

const admin = require('firebase-admin');
const path = require('path');

// Configuration
const CONFIG = {
  // Notification types to resend
  includedTypes: ['profile_reminder', 'new_network_members'],

  // Date range (Dec 11, 2025 00:00:00 UTC to now)
  startDate: new Date('2025-12-11T00:00:00Z'),

  // Delay between sends to avoid FCM throttling (ms)
  sendDelay: 100,
};

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, '../secrets/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = admin.firestore();

/**
 * Convert object values to strings for FCM data payload
 */
function toStringMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

/**
 * Resolve the best FCM token for a user using 3-tier approach
 * @param {FirebaseFirestore.DocumentReference} userRef
 * @returns {Promise<{token: string|null, source: string}>}
 */
async function resolveBestFcmTokenForUser(userRef) {
  let token = null;
  let source = 'none';

  try {
    // Tier 1: users/{uid}/fcmTokens/{tokenId} subcollection (newest first)
    const subcollection = await userRef.collection('fcmTokens')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();

    if (!subcollection.empty) {
      const tokenDoc = subcollection.docs[0];
      token = (tokenDoc.data().token || tokenDoc.id).trim();
      source = 'fcmTokens(subcollection)';
      if (token) return { token, source };
    }
  } catch (e) {
    // Subcollection may not exist, continue to fallbacks
  }

  // Tier 2: users/{uid}.fcm_token field
  try {
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data();

      if (userData.fcm_token) {
        token = String(userData.fcm_token).trim();
        source = 'fcm_token(field)';
        if (token) return { token, source };
      }

      // Tier 3: users/{uid}.fcmTokens[0] array
      if (Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0) {
        token = String(userData.fcmTokens[0]).trim();
        source = 'fcmTokens[0](array)';
        if (token) return { token, source };
      }
    }
  } catch (e) {
    console.error(`Error reading user document: ${e.message}`);
  }

  return { token: null, source: 'none' };
}

/**
 * Send a push notification via FCM
 * @param {string} token FCM token
 * @param {object} notification Notification document data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendPush(token, notification) {
  const { title, body, data = {} } = notification;

  const message = {
    token,
    notification: { title, body },
    data: toStringMap(data),
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
  };

  try {
    await admin.messaging().send(message);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  const dryRun = !process.argv.includes('--send');

  console.log('='.repeat(60));
  console.log('RESEND MISSED PUSH NOTIFICATIONS');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --send to actually send)' : 'LIVE - SENDING NOTIFICATIONS'}`);
  console.log(`Date range: ${CONFIG.startDate.toISOString()} to now`);
  console.log(`Types: ${CONFIG.includedTypes.join(', ')}`);
  console.log('='.repeat(60));
  console.log('');

  // Get all users
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users to check`);
  console.log('');

  const stats = {
    usersChecked: 0,
    notificationsFound: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    noTokenUsers: 0,
    errors: 0,
  };

  const results = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    stats.usersChecked++;

    // Query notifications for this user (filter in code to avoid composite index)
    const notificationsRef = db.collection('users').doc(userId).collection('notifications');
    const allNotificationsSnapshot = await notificationsRef.get();

    if (allNotificationsSnapshot.empty) continue;

    // Filter notifications in code
    const startTimestamp = admin.firestore.Timestamp.fromDate(CONFIG.startDate);
    const matchingNotifications = allNotificationsSnapshot.docs.filter(doc => {
      const data = doc.data();
      const createdAt = data.createdAt;

      // Check type
      if (!CONFIG.includedTypes.includes(data.type)) return false;

      // Check date range
      if (!createdAt || createdAt.toMillis() < startTimestamp.toMillis()) return false;

      return true;
    });

    if (matchingNotifications.length === 0) continue;

    // Use the filtered array instead
    const notificationsSnapshot = { docs: matchingNotifications, size: matchingNotifications.length };

    // Check for FCM token first
    const userRef = db.collection('users').doc(userId);
    const { token, source } = await resolveBestFcmTokenForUser(userRef);

    if (!token) {
      stats.noTokenUsers++;
      console.log(`[SKIP] User ${userId} (${userData.email || 'no email'}) - No FCM token`);
      stats.notificationsSkipped += notificationsSnapshot.size;
      continue;
    }

    for (const notifDoc of notificationsSnapshot.docs) {
      const notifData = notifDoc.data();
      stats.notificationsFound++;

      // Skip if already sent
      if (notifData.pushSent === true) {
        stats.notificationsSkipped++;
        continue;
      }

      const notifInfo = {
        userId,
        userEmail: userData.email || 'no email',
        notificationId: notifDoc.id,
        type: notifData.type,
        title: notifData.title,
        createdAt: notifData.createdAt?.toDate?.()?.toISOString() || 'unknown',
        tokenSource: source,
      };

      if (dryRun) {
        console.log(`[DRY RUN] Would send to ${notifInfo.userEmail}:`);
        console.log(`  Type: ${notifInfo.type}`);
        console.log(`  Title: ${notifInfo.title}`);
        console.log(`  Created: ${notifInfo.createdAt}`);
        console.log(`  Token source: ${notifInfo.tokenSource}`);
        console.log('');
        results.push({ ...notifInfo, status: 'dry_run' });
        stats.notificationsSent++;
      } else {
        // Actually send
        console.log(`[SENDING] ${notifInfo.userEmail} - ${notifInfo.title}`);

        const result = await sendPush(token, {
          title: notifData.title,
          body: notifData.body,
          data: notifData.data || {},
        });

        if (result.success) {
          // Mark as sent
          await notifDoc.ref.update({
            pushSent: true,
            pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
            pushResendNote: 'Resent via resend-missed-notifications.js',
          });

          console.log(`  [SUCCESS] Push sent and marked`);
          results.push({ ...notifInfo, status: 'sent' });
          stats.notificationsSent++;
        } else {
          console.log(`  [ERROR] ${result.error}`);
          results.push({ ...notifInfo, status: 'error', error: result.error });
          stats.errors++;
        }

        // Rate limiting
        await sleep(CONFIG.sendDelay);
      }
    }
  }

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Users checked: ${stats.usersChecked}`);
  console.log(`Users without FCM token: ${stats.noTokenUsers}`);
  console.log(`Notifications found: ${stats.notificationsFound}`);
  console.log(`Notifications already sent (skipped): ${stats.notificationsSkipped}`);
  console.log(`Notifications ${dryRun ? 'would send' : 'sent'}: ${stats.notificationsSent}`);
  if (!dryRun) {
    console.log(`Errors: ${stats.errors}`);
  }
  console.log('='.repeat(60));

  if (dryRun && stats.notificationsSent > 0) {
    console.log('');
    console.log('To actually send these notifications, run:');
    console.log('GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" node resend-missed-notifications.js --send');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
