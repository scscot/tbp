const { logger } = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// MONITORING AND ALERTING SYSTEM
// ============================================================================

/**
 * Record a monitoring metric to Firestore
 * Metrics are stored in monitoring/metrics/daily/{date} for easy querying
 *
 * @param {string} metricName - Name of the metric (e.g., 'fcm_delivery_success')
 * @param {number} value - Numeric value for the metric
 * @param {object} metadata - Additional context (userId, errorMessage, etc.)
 */
async function recordMetric(metricName, value, metadata = {}) {
  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hour = now.getUTCHours();

    const metricRef = db
      .collection('monitoring')
      .doc('metrics')
      .collection('daily')
      .doc(dateKey);

    const hourKey = `hour_${hour}`;

    // Increment counter and track occurrences
    await metricRef.set(
      {
        date: dateKey,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        metrics: {
          [metricName]: {
            total: admin.firestore.FieldValue.increment(value),
            [hourKey]: admin.firestore.FieldValue.increment(value),
          },
        },
      },
      { merge: true }
    );

    // Store individual event if metadata provided
    if (Object.keys(metadata).length > 0) {
      await db.collection('monitoring').doc('metrics').collection('events').add({
        metricName,
        value,
        metadata,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        date: dateKey,
        hour,
      });
    }
  } catch (error) {
    logger.error(`Failed to record metric ${metricName}:`, error);
  }
}

/**
 * Track Cloud Function execution
 * Call this at the start and end of critical functions
 */
async function trackFunctionExecution(functionName, status, metadata = {}) {
  const metricName = `function_${functionName}_${status}`;
  await recordMetric(metricName, 1, { functionName, status, ...metadata });
}

/**
 * Track FCM push notification delivery
 */
async function trackFCMDelivery(userId, success, errorMessage = null) {
  const metricName = success ? 'fcm_delivery_success' : 'fcm_delivery_failure';
  await recordMetric(metricName, 1, {
    userId,
    success,
    errorMessage,
  });
}

/**
 * Track milestone notification events
 */
async function trackMilestoneNotification(userId, milestoneType, status, metadata = {}) {
  const metricName = `milestone_${milestoneType}_${status}`;
  await recordMetric(metricName, 1, {
    userId,
    milestoneType,
    status,
    ...metadata,
  });
}

/**
 * Scheduled function to check metrics and generate alerts
 * Runs every hour to analyze recent metrics
 */
const monitoringHealthCheck = onSchedule(
  {
    schedule: '0 * * * *', // Every hour at minute 0
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    logger.info('🔍 MONITORING: Starting hourly health check');

    try {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const currentHour = now.getUTCHours();
      const previousHour = currentHour === 0 ? 23 : currentHour - 1;

      // Get metrics for the previous hour
      const metricsSnap = await db
        .collection('monitoring')
        .doc('metrics')
        .collection('daily')
        .doc(dateKey)
        .get();

      if (!metricsSnap.exists) {
        logger.info('No metrics found for today');
        return;
      }

      const metrics = metricsSnap.data().metrics || {};
      const alerts = [];

      // Check FCM delivery rate
      const fcmSuccess = metrics.fcm_delivery_success?.[`hour_${previousHour}`] || 0;
      const fcmFailure = metrics.fcm_delivery_failure?.[`hour_${previousHour}`] || 0;
      const fcmTotal = fcmSuccess + fcmFailure;

      if (fcmTotal > 0) {
        const fcmSuccessRate = (fcmSuccess / fcmTotal) * 100;
        logger.info(`📊 FCM Success Rate (hour ${previousHour}): ${fcmSuccessRate.toFixed(2)}%`);

        if (fcmSuccessRate < 90) {
          alerts.push({
            type: 'fcm_low_success_rate',
            severity: 'warning',
            message: `FCM delivery success rate is ${fcmSuccessRate.toFixed(2)}% (${fcmSuccess}/${fcmTotal})`,
            hour: previousHour,
          });
        }
      }

      // Check function error rates
      const functionNames = ['registerUser', 'notifyOnMilestoneReached', 'createNotificationWithPush'];
      for (const funcName of functionNames) {
        const success = metrics[`function_${funcName}_success`]?.[`hour_${previousHour}`] || 0;
        const failure = metrics[`function_${funcName}_failure`]?.[`hour_${previousHour}`] || 0;
        const total = success + failure;

        if (total > 0) {
          const errorRate = (failure / total) * 100;
          logger.info(`📊 ${funcName} Error Rate (hour ${previousHour}): ${errorRate.toFixed(2)}%`);

          if (errorRate > 5) {
            alerts.push({
              type: 'function_high_error_rate',
              severity: 'critical',
              functionName: funcName,
              message: `${funcName} error rate is ${errorRate.toFixed(2)}% (${failure}/${total})`,
              hour: previousHour,
            });
          }
        }
      }

      // Check milestone notification failures
      const milestoneSuccess =
        metrics.milestone_direct_sponsor_success?.[`hour_${previousHour}`] || 0;
      const milestoneFailure =
        metrics.milestone_direct_sponsor_failure?.[`hour_${previousHour}`] || 0;
      const milestoneTotal = milestoneSuccess + milestoneFailure;

      if (milestoneTotal > 0) {
        const milestoneFailureRate = (milestoneFailure / milestoneTotal) * 100;
        logger.info(
          `📊 Milestone Notification Failure Rate (hour ${previousHour}): ${milestoneFailureRate.toFixed(2)}%`
        );

        if (milestoneFailureRate > 10) {
          alerts.push({
            type: 'milestone_high_failure_rate',
            severity: 'warning',
            message: `Milestone notification failure rate is ${milestoneFailureRate.toFixed(2)}% (${milestoneFailure}/${milestoneTotal})`,
            hour: previousHour,
          });
        }
      }

      // Store alerts if any
      if (alerts.length > 0) {
        logger.warn(`⚠️ MONITORING: Generated ${alerts.length} alerts`);
        await db.collection('monitoring').doc('alerts').collection('hourly').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          date: dateKey,
          hour: previousHour,
          alerts,
        });
      } else {
        logger.info('✅ MONITORING: All metrics within normal ranges');
      }
    } catch (error) {
      logger.error('❌ MONITORING: Health check failed:', error);
    }
  }
);

/**
 * Callable function to get current monitoring dashboard
 */
const getMonitoringDashboard = onCall({ region: 'us-central1' }, async (request) => {
  logger.info('📊 MONITORING: Fetching dashboard data');

  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];

    // Get today's metrics
    const metricsSnap = await db
      .collection('monitoring')
      .doc('metrics')
      .collection('daily')
      .doc(dateKey)
      .get();

    const metrics = metricsSnap.exists ? metricsSnap.data().metrics : {};

    // Get recent alerts (last 24 hours)
    const alertsSnap = await db
      .collection('monitoring')
      .doc('alerts')
      .collection('hourly')
      .orderBy('timestamp', 'desc')
      .limit(24)
      .get();

    const alerts = alertsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate summary statistics
    const fcmSuccessTotal = metrics.fcm_delivery_success?.total || 0;
    const fcmFailureTotal = metrics.fcm_delivery_failure?.total || 0;
    const fcmTotal = fcmSuccessTotal + fcmFailureTotal;
    const fcmSuccessRate = fcmTotal > 0 ? (fcmSuccessTotal / fcmTotal) * 100 : 0;

    return {
      success: true,
      data: {
        date: dateKey,
        fcm: {
          successCount: fcmSuccessTotal,
          failureCount: fcmFailureTotal,
          totalCount: fcmTotal,
          successRate: fcmSuccessRate.toFixed(2),
        },
        alerts: alerts.length,
        recentAlerts: alerts.slice(0, 5),
        metrics,
      },
    };
  } catch (error) {
    logger.error('❌ MONITORING: Failed to fetch dashboard:', error);
    throw error;
  }
});

module.exports = {
  recordMetric,
  trackFunctionExecution,
  trackFCMDelivery,
  trackMilestoneNotification,
  monitoringHealthCheck,
  getMonitoringDashboard,
};
