// ==============================
// BETA TESTER LIFETIME ACCESS FUNCTIONS
// Grants lifetime free access to beta testers
// ==============================

const {
  onCall,
  HttpsError,
  logger,
  db,
  FieldValue,
  validateAuthentication,
  validateAdminRole,
} = require('./shared/utilities');

/**
 * Grant lifetime access to beta testers
 * Queries launch_notifications for demo recipients and updates their user records
 */
const grantBetaTesterLifetimeAccess = onCall({ region: "us-central1" }, async (request) => {
  const userId = validateAuthentication(request);
  validateAdminRole(request);

  try {
    const { dryRun = true } = request.data || {};

    logger.info(`🎁 GRANT LIFETIME ACCESS: Starting ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);

    // Query all demo recipients from launch_notifications
    const demoQuery = await db.collection('launch_notifications')
      .where('wantDemo', '==', true)
      .where('emailSent', '==', true)
      .get();

    logger.info(`📊 Found ${demoQuery.size} demo recipients`);

    if (demoQuery.empty) {
      return {
        success: true,
        granted: 0,
        notFound: 0,
        alreadyGranted: 0,
        message: 'No demo recipients found'
      };
    }

    const emails = [];
    demoQuery.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        emails.push(data.email.toLowerCase().trim());
      }
    });

    logger.info(`📧 Processing ${emails.length} email addresses`);

    let granted = 0;
    let notFound = 0;
    let alreadyGranted = 0;
    const results = [];

    // Process each email
    for (const email of emails) {
      try {
        // Find user by email
        const userQuery = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();

        if (userQuery.empty) {
          logger.warn(`⚠️ No user found for email: ${email}`);
          notFound++;
          results.push({ email, status: 'not_found' });
          continue;
        }

        const userDoc = userQuery.docs[0];
        const userData = userDoc.data();

        // Check if already granted
        if (userData.lifetimeAccess === true) {
          logger.info(`✓ Already granted: ${email}`);
          alreadyGranted++;
          results.push({ email, status: 'already_granted', uid: userDoc.id });
          continue;
        }

        // Grant lifetime access
        if (!dryRun) {
          await userDoc.ref.update({
            lifetimeAccess: true,
            betaTester: true,
            lifetimeAccessGrantedAt: FieldValue.serverTimestamp(),
            lifetimeAccessGrantedBy: userId
          });
          logger.info(`✅ Granted lifetime access: ${email} (${userDoc.id})`);
        } else {
          logger.info(`🧪 DRY RUN - Would grant: ${email} (${userDoc.id})`);
        }

        granted++;
        results.push({ email, status: 'granted', uid: userDoc.id });

      } catch (error) {
        logger.error(`❌ Error processing ${email}:`, error);
        results.push({ email, status: 'error', error: error.message });
      }
    }

    logger.info(`\n📊 GRANT LIFETIME ACCESS COMPLETE:`);
    logger.info(`   Total processed: ${emails.length}`);
    logger.info(`   Granted: ${granted}`);
    logger.info(`   Not found: ${notFound}`);
    logger.info(`   Already granted: ${alreadyGranted}`);

    return {
      success: true,
      dryRun,
      totalProcessed: emails.length,
      granted,
      notFound,
      alreadyGranted,
      results: dryRun ? results : results.filter(r => r.status !== 'already_granted')
    };

  } catch (error) {
    logger.error('❌ Error granting lifetime access:', error);
    throw new HttpsError('internal', `Failed to grant lifetime access: ${error.message}`);
  }
});

/**
 * Revoke lifetime access from a user (admin only)
 */
const revokeBetaTesterLifetimeAccess = onCall({ region: "us-central1" }, async (request) => {
  validateAuthentication(request);
  validateAdminRole(request);

  try {
    const { targetUserId } = request.data || {};

    if (!targetUserId) {
      throw new HttpsError('invalid-argument', 'targetUserId is required');
    }

    const userDoc = await db.collection('users').doc(targetUserId).get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    await userDoc.ref.update({
      lifetimeAccess: false,
      betaTester: false,
      lifetimeAccessRevokedAt: FieldValue.serverTimestamp()
    });

    logger.info(`✅ Revoked lifetime access for user: ${targetUserId}`);

    return {
      success: true,
      message: 'Lifetime access revoked',
      userId: targetUserId
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('❌ Error revoking lifetime access:', error);
    throw new HttpsError('internal', `Failed to revoke lifetime access: ${error.message}`);
  }
});

/**
 * Get beta tester statistics
 */
const getBetaTesterStats = onCall({ region: "us-central1" }, async (request) => {
  validateAuthentication(request);
  validateAdminRole(request);

  try {
    // Count users with lifetime access
    const lifetimeAccessQuery = await db.collection('users')
      .where('lifetimeAccess', '==', true)
      .get();

    // Count beta testers
    const betaTesterQuery = await db.collection('users')
      .where('betaTester', '==', true)
      .get();

    // Count demo recipients
    const demoRecipientsQuery = await db.collection('launch_notifications')
      .where('wantDemo', '==', true)
      .where('emailSent', '==', true)
      .get();

    const stats = {
      lifetimeAccessUsers: lifetimeAccessQuery.size,
      betaTesters: betaTesterQuery.size,
      demoRecipients: demoRecipientsQuery.size
    };

    logger.info('📊 Beta tester stats:', stats);

    return {
      success: true,
      stats
    };

  } catch (error) {
    logger.error('❌ Error getting beta tester stats:', error);
    throw new HttpsError('internal', `Failed to get stats: ${error.message}`);
  }
});

// ==============================
// Exports
// ==============================

module.exports = {
  grantBetaTesterLifetimeAccess,
  revokeBetaTesterLifetimeAccess,
  getBetaTesterStats,
};
