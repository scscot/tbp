// ==============================
// MODULAR FIREBASE FUNCTIONS INDEX
// This is the main entry point that imports and exports all modularized functions
// Architecture: Shared utilities + Auth + Notifications + Analytics + Admin modules
// ==============================

// ==============================
// Import Authentication Functions
// ==============================
const {
  getUserByReferralCode,
  registerUser,
  validateReferralUrl,
  deleteUserAccount,
} = require('./auth-functions');

// ==============================
// Import Referral Attribution Functions
// ==============================
const {
  issueReferral,
  redeemReferral,
  cleanupReferrals,
} = require('./referral-attribution-functions');

// ==============================
// Import New TypeScript Referral Functions (V2)
// ==============================
const {
  issueReferral: issueReferralV2,
  redeemReferral: redeemReferralV2,
  clipHandoffCreate: clipHandoffCreateV2,
  clipHandoffClaim: clipHandoffClaimV2,
  resolveSponsor: resolveSponsorV2,
} = require('./lib/referrals');

// ==============================
// Import Notification Functions
// ==============================
const {
  // Core notification functions
  sendPushToUser,
  updateUserBadge,
  createNotification,
  createNotificationWithTransaction,

  // User-facing badge management
  clearAppBadge,
  syncAppBadge,

  // Subscription notifications
  upsertAppleV2NotificationState,
  updateUserSubscription,
  createSubscriptionNotification,
  createSubscriptionNotificationV2,

  // Chat and message functions
  onNewChatMessage,
  updateCanReadProfileOnChatCreate,
  onChatMessageCreated,

  // Business and team notifications
  notifySponsorOfBizOppVisit,

  // Firestore triggers
  onNotificationCreated,
  onNotificationUpdate,
  onNotificationDelete,
  onChatUpdate,

  // Milestone functions
  notifyOnMilestoneReached,
  onUserProfileCompleted,
  triggerSponsorship,

  // Scheduled functions
  sendDailyTeamGrowthNotifications,

  // Launch campaign functions
  sendLaunchNotificationConfirmation,
} = require('./notification-functions');

// ==============================
// Import Analytics Functions
// ==============================
const {
  // Network analytics
  getNetwork,
  getNetworkCounts,
  getNewMembersYesterdayCount,
  getFilteredNetwork,
  getMemberDetails,

  // User analytics
  checkUserSubscriptionStatus,
  getMilestoneFuseStatus,

  // System metrics
  getFirestoreMetrics,

  // Team management
  recalculateTeamCounts,

  // User profile management
  updateUserTimezone,

  // Referral analytics (moved to analytics from auth)
  // getUserByReferralCode is in auth-functions
} = require('./analytics-functions');

// ==============================
// Import Email Campaign Functions
// ==============================
const {
  sendHourlyEmailCampaign,
} = require('./email-campaign-functions');

// ==============================
// Import Beta Tester Functions
// ==============================
const {
  grantBetaTesterLifetimeAccess,
  revokeBetaTesterLifetimeAccess,
  getBetaTesterStats,
} = require('./beta-tester-functions');

// ==============================
// Import Admin Functions
// ==============================
const {
  // Apple subscription management
  handleAppleSubscriptionNotification,
  handleAppleSubscriptionNotificationV2,
  validateAppleReceipt,
  testAppleNotificationV2Setup,

  // Google Play subscription management
  handleGooglePlayNotification,
  validateGooglePlayPurchase,
  testGooglePlayNotificationSetup,

  // User account management (moved from auth-functions)
  // deleteUserAccount is in auth-functions

  // Validation functions
  // validateReferralUrl is in auth-functions

  // Scheduled functions
  checkExpiredTrials,
  checkTrialsExpiringSoon,
  checkSubscriptionsExpiringSoon,
  sendDailyAccountDeletionSummary,
  cleanupExecutionFuses,

  // Beta testing management
  generateBetaTesterCSVs,

  // Debug and testing functions
  resetMilestoneFuse,
  resetMilestoneFuses,
  clearPreProfileMilestoneFuses,
  pingUsersTrigger,
} = require('./admin-functions');

// ==============================
// Import Campaign Functions (external modules)
// ==============================
const { sendDemoInvitation } = require('./sendDemoInvitation');
const { sendLaunchCampaign } = require('./sendLaunchCampaign');
const { chatbot } = require('./chatbot');
const { setup_faq } = require('./setup_faq');

// ==============================
// Import Additional Required Functions
// ==============================
const { submitContactForm } = require('./submitContactForm');
const { submitContactFormHttp } = require('./submitContactFormHttp');
const { submitStephenScottContact } = require('./submitStephenScottContact');
// const { addToInternalTesting } = require('./addToInternalTesting'); // Disabled - using CSV approach instead
const { addToDemoLeads } = require('./addToDemoLeads');
const { getDemoCount } = require('./getDemoCount');
const { appendDemoEmail } = require('./appendDemoEmail');
const { addToDemoQueue } = require('./addToDemoQueue');
const { sendDemoNotification } = require('./sendDemoNotification');

// ==============================
// Import Analytics Events Functions
// ==============================
const { tbpEventLog } = require('./analytics-events');

// ==============================
// Export All Functions
// ==============================

module.exports = {
  // ========== AUTHENTICATION FUNCTIONS ==========
  getUserByReferralCode,
  registerUser,
  validateReferralUrl,
  deleteUserAccount,

  // ========== REFERRAL ATTRIBUTION FUNCTIONS ==========
  issueReferral,
  redeemReferral,
  cleanupReferrals,

  // ========== REFERRAL ATTRIBUTION FUNCTIONS V2 (TypeScript) ==========
  issueReferralV2,
  redeemReferralV2,
  clipHandoffCreateV2,
  clipHandoffClaimV2,
  resolveSponsorV2,

  // ========== NOTIFICATION FUNCTIONS ==========
  // Core notification system
  onNotificationCreated,
  onNotificationUpdate,
  onNotificationDelete,
  onNewChatMessage,
  onChatMessageCreated,
  updateCanReadProfileOnChatCreate,
  onChatUpdate,
  notifyOnMilestoneReached,
  onUserProfileCompleted,
  triggerSponsorship,
  notifySponsorOfBizOppVisit,

  // User-facing badge management
  clearAppBadge,
  syncAppBadge,

  // Scheduled notifications
  sendDailyTeamGrowthNotifications,
  sendLaunchNotificationConfirmation,

  // ========== ANALYTICS FUNCTIONS ==========
  getNetwork,
  getNetworkCounts,
  getNewMembersYesterdayCount,
  getFilteredNetwork,
  getMemberDetails,
  checkUserSubscriptionStatus,
  getMilestoneFuseStatus,
  getFirestoreMetrics,
  recalculateTeamCounts,
  updateUserTimezone,

  // ========== ADMIN FUNCTIONS ==========
  // Apple subscription management
  handleAppleSubscriptionNotification,
  handleAppleSubscriptionNotificationV2,
  validateAppleReceipt,
  testAppleNotificationV2Setup,

  // Google Play subscription management
  handleGooglePlayNotification,
  validateGooglePlayPurchase,
  testGooglePlayNotificationSetup,

  // Scheduled admin functions
  checkExpiredTrials,
  checkTrialsExpiringSoon,
  checkSubscriptionsExpiringSoon,
  sendDailyAccountDeletionSummary,
  cleanupExecutionFuses,

  // Beta testing management
  generateBetaTesterCSVs,

  // Debug and testing functions
  resetMilestoneFuse,
  resetMilestoneFuses,
  clearPreProfileMilestoneFuses,
  pingUsersTrigger,

  // ========== CAMPAIGN FUNCTIONS ==========
  sendDemoInvitation,
  sendLaunchCampaign,
  chatbot,
  setup_faq,

  // Email campaign (scheduled)
  sendHourlyEmailCampaign,

  // ========== BETA TESTER FUNCTIONS ==========
  grantBetaTesterLifetimeAccess,
  revokeBetaTesterLifetimeAccess,
  getBetaTesterStats,

  // ========== CONTACT FUNCTIONS ==========
  submitContactForm,
  submitContactFormHttp,
  submitStephenScottContact,

  // ========== INTERNAL TESTING FUNCTIONS ==========
  // addToInternalTesting, // Disabled - using CSV approach instead
  addToDemoLeads,
  getDemoCount,
  appendDemoEmail,
  addToDemoQueue,
  sendDemoNotification,

  // ========== ANALYTICS FUNCTIONS ==========
  tbpEventLog,
};

// ==============================
// Development Notes
// ==============================
/*
MODULARIZATION COMPLETE - PHASE 2 BACKEND ARCHITECTURE

This index.js file now serves as a clean entry point that imports and exports
all Firebase Functions from their respective modules:

1. shared/utilities.js - Common Firebase setup and utility functions
2. auth-functions.js - Authentication, registration, and account management
3. notification-functions.js - Push notifications, chat messages, and triggers
4. analytics-functions.js - Network analytics, metrics, and data retrieval
5. admin-functions.js - Subscription management, validation, and admin operations

BENEFITS OF MODULAR ARCHITECTURE:
- Reduced function cold starts (smaller bundles)
- Better code organization and maintainability
- Easier testing and debugging
- Clear separation of concerns
- Reduced memory usage per function
- Faster deployment times

MIGRATION STATUS:
✅ Core utilities extracted to shared module
✅ Authentication functions modularized
✅ Notification system modularized
✅ Analytics and metrics modularized
✅ Admin and subscription management modularized
✅ Main index.js updated to import/export all functions

The original monolithic index.js (5,786 lines) has been successfully split into
focused, maintainable modules while preserving all functionality.

Next Phase: Frontend state management with Provider pattern
*/