#!/usr/bin/env node

const admin = require('firebase-admin');
const { getNotificationText } = require('../functions/translations');

if (!admin.apps.length) {
  const serviceAccount = require('../secrets/serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMultiLanguageNotifications(userId) {
  console.log('🧪 Multi-Language Notification Test');
  console.log('═'.repeat(50));

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found`);
      process.exit(1);
    }

    const userData = userDoc.data();
    const userLang = userData.preferredLanguage || 'en';
    const firstName = userData.firstName || 'User';
    const lastName = userData.lastName || '';
    const email = userData.email || 'N/A';

    console.log(`User: ${firstName} ${lastName} (${email})`);
    console.log(`Preferred Language: ${userLang}`);
    console.log('═'.repeat(50));
    console.log('');

    const bizNameTranslations = {
      en: 'your business opportunity',
      es: 'tu oportunidad de negocio',
      pt: 'sua oportunidade de negócio',
      de: 'Ihre Geschäftsmöglichkeit',
    };

    const notifications = [];

    notifications.push({
      name: 'Milestone Direct',
      type: 'milestone',
      subtype: 'direct',
      title: getNotificationText('milestoneDirectTitle', userLang),
      body: getNotificationText('milestoneDirectMessage', userLang, {
        firstName: firstName,
        directCount: 4,
        remainingTeam: 16,
        pluralTeam: 's',
        bizName: bizNameTranslations[userLang] || bizNameTranslations.en,
      }),
      route: '/dashboard',
    });

    notifications.push({
      name: 'Milestone Team',
      type: 'milestone',
      subtype: 'team',
      title: getNotificationText('milestoneTeamTitle', userLang),
      body: getNotificationText('milestoneTeamMessage', userLang, {
        firstName: firstName,
        teamCount: 20,
        remainingDirect: 1,
        pluralDirect: '',
        bizName: bizNameTranslations[userLang] || bizNameTranslations.en,
      }),
      route: '/dashboard',
    });

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();

    notifications.push({
      name: 'Subscription Active',
      type: 'subscription_active',
      title: getNotificationText('subscriptionActiveTitle', userLang),
      body: getNotificationText('subscriptionActiveMessage', userLang, {
        expiryDate: expiryDate,
      }),
      route: '/settings',
    });

    notifications.push({
      name: 'Subscription Cancelled',
      type: 'subscription_cancelled',
      title: getNotificationText('subscriptionCancelledTitle', userLang),
      body: getNotificationText('subscriptionCancelledMessage', userLang, {
        expiryDate: expiryDate,
      }),
      route: '/settings',
    });

    notifications.push({
      name: 'Subscription Expired',
      type: 'subscription_expired',
      title: getNotificationText('subscriptionExpiredTitle', userLang),
      body: getNotificationText('subscriptionExpiredMessage', userLang),
      route: '/settings',
    });

    notifications.push({
      name: 'Subscription Expiring Soon',
      type: 'subscription_expiring_soon',
      title: getNotificationText('subscriptionExpiringSoonTitle', userLang),
      body: getNotificationText('subscriptionExpiringSoonMessage', userLang, {
        expiryDate: expiryDate,
      }),
      route: '/settings',
    });

    notifications.push({
      name: 'Subscription Paused',
      type: 'subscription_paused',
      title: getNotificationText('subscriptionPausedTitle', userLang),
      body: getNotificationText('subscriptionPausedMessage', userLang),
      route: '/settings',
    });

    notifications.push({
      name: 'Subscription Payment Issue',
      type: 'subscription_on_hold',
      title: getNotificationText('subscriptionPaymentIssueTitle', userLang),
      body: getNotificationText('subscriptionPaymentIssueMessage', userLang),
      route: '/settings',
    });

    notifications.push({
      name: 'Chat Message',
      type: 'chat_message',
      title: getNotificationText('chatMessageTitle', userLang, {
        senderName: 'Test User',
      }),
      body: 'This is a test message to verify multi-language notifications are working correctly!',
      route: '/chat',
    });

    notifications.push({
      name: 'Team Activity',
      type: 'biz_opp_visit',
      title: getNotificationText('teamActivityTitle', userLang),
      body: getNotificationText('teamActivityMessage', userLang, {
        firstName: 'John',
        lastName: 'Doe',
        bizName: bizNameTranslations[userLang] || bizNameTranslations.en,
      }),
      route: '/network',
    });

    const languageNames = {
      en: 'English',
      es: 'Spanish',
      pt: 'Portuguese',
      de: 'German',
    };

    console.log(`📱 Sending ${notifications.length} test notifications in ${languageNames[userLang] || userLang}...\n`);

    for (let i = 0; i < notifications.length; i++) {
      const notif = notifications[i];

      try {
        await db.collection('users').doc(userId).collection('notifications').add({
          type: notif.type,
          ...(notif.subtype ? { subtype: notif.subtype } : {}),
          title: notif.title,
          body: notif.body,
          route: notif.route,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });

        console.log(`✅ [${i + 1}/${notifications.length}] ${notif.name}`);
        console.log(`   Title: ${notif.title}`);
        console.log(`   Body: ${notif.body.substring(0, 80)}${notif.body.length > 80 ? '...' : ''}`);
        console.log('');

        await delay(5000);

      } catch (error) {
        console.log(`❌ [${i + 1}/${notifications.length}] ${notif.name} - Error: ${error.message}`);
      }
    }

    console.log('═'.repeat(50));
    console.log(`✅ Test Complete: ${notifications.length} notifications sent`);
    console.log(`📱 Check your device for push notifications in ${languageNames[userLang] || userLang}`);
    console.log('');
    console.log('Note: Push notifications are triggered by the onNotificationCreated');
    console.log('      Firebase function. There may be a 1-2 second delay.');

  } catch (error) {
    console.error('❌ Error in test:', error);
    process.exit(1);
  }
}

const userId = process.argv[2];

if (!userId) {
  console.log('Usage: node test_multilanguage_notifications.js <userId>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/test_multilanguage_notifications.js KJ8uFnlhKhWgBa4NVcwT');
  console.log('');
  console.log('This script will:');
  console.log('  1. Read the user\'s preferredLanguage setting');
  console.log('  2. Send 10 test notifications (one of each type)');
  console.log('  3. All notifications will be in the user\'s preferred language');
  console.log('  4. FCM push notifications will be triggered automatically');
  process.exit(1);
}

testMultiLanguageNotifications(userId)
  .then(() => {
    console.log('Test complete - exiting');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
