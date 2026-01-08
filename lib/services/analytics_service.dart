import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Centralized analytics service for tracking app events via Firebase Analytics.
///
/// This service provides:
/// - Type-safe methods for common events
/// - Automatic user property tracking
/// - Screen view tracking helpers
/// - Subscription and engagement events
class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  /// Set user ID for cross-device tracking
  Future<void> setUserId(String? userId) async {
    try {
      await _analytics.setUserId(id: userId);
      debugPrint('📊 Analytics: Set user ID to $userId');
    } catch (e) {
      debugPrint('❌ Analytics: Failed to set user ID: $e');
    }
  }

  /// Set user properties for segmentation
  Future<void> setUserProperty({
    required String name,
    required String? value,
  }) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
      debugPrint('📊 Analytics: Set user property $name=$value');
    } catch (e) {
      debugPrint('❌ Analytics: Failed to set user property: $e');
    }
  }

  /// Log a custom event with optional parameters
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {
    try {
      await _analytics.logEvent(
        name: name,
        parameters: parameters,
      );
      debugPrint('📊 Analytics: Event "$name" ${parameters ?? {}}');
    } catch (e) {
      debugPrint('❌ Analytics: Failed to log event "$name": $e');
    }
  }

  /// Log screen view (use when navigatorObserver doesn't capture the screen)
  Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    try {
      await _analytics.logScreenView(
        screenName: screenName,
        screenClass: screenClass ?? screenName,
      );
      debugPrint('📊 Analytics: Screen view "$screenName"');
    } catch (e) {
      debugPrint('❌ Analytics: Failed to log screen view: $e');
    }
  }

  // ============================================
  // Authentication Events
  // ============================================

  Future<void> logAuthView({required String screen}) async {
    await logEvent(
      name: 'auth_view',
      parameters: {'screen': screen},
    );
  }

  Future<void> logAuthSubmit({
    required String method,
    required String screen,
  }) async {
    await logEvent(
      name: 'auth_submit',
      parameters: {'method': method, 'screen': screen},
    );
  }

  Future<void> logAuthError({
    required String code,
    required String screen,
    String? method,
  }) async {
    await logEvent(
      name: 'auth_error',
      parameters: {
        'code': code,
        'screen': screen,
        if (method != null) 'method': method,
      },
    );
  }

  Future<void> logSignUp({required String method}) async {
    await _analytics.logSignUp(signUpMethod: method);
  }

  Future<void> logLogin({required String method}) async {
    await _analytics.logLogin(loginMethod: method);
  }

  // ============================================
  // Subscription Events
  // ============================================

  Future<void> logTrialStart() async {
    await logEvent(name: 'trial_start');
  }

  Future<void> logSubscriptionStart({
    required String productId,
    required double price,
    required String currency,
  }) async {
    await logEvent(
      name: 'subscription_start',
      parameters: {
        'product_id': productId,
        'price': price,
        'currency': currency,
      },
    );
    // Also log as a purchase for revenue tracking
    await _analytics.logPurchase(
      currency: currency,
      value: price,
      items: [
        AnalyticsEventItem(
          itemId: productId,
          itemName: 'Team Build Pro Subscription',
          itemCategory: 'subscription',
          price: price,
          quantity: 1,
        ),
      ],
    );
  }

  Future<void> logSubscriptionCancel({required String reason}) async {
    await logEvent(
      name: 'subscription_cancel',
      parameters: {'reason': reason},
    );
  }

  Future<void> logSubscriptionView() async {
    await logEvent(name: 'subscription_view');
  }

  Future<void> logPaywallView({required String source}) async {
    await logEvent(
      name: 'paywall_view',
      parameters: {'source': source},
    );
  }

  // ============================================
  // Share / Referral Events
  // ============================================

  Future<void> logShareMessage({
    required String messageType,
    required String platform,
    String? recipientType,
  }) async {
    await logEvent(
      name: 'share_message',
      parameters: {
        'message_type': messageType,
        'platform': platform,
        if (recipientType != null) 'recipient_type': recipientType,
      },
    );
    // Also use standard share event
    await _analytics.logShare(
      contentType: messageType,
      itemId: messageType,
      method: platform,
    );
  }

  Future<void> logReferralLinkGenerated({required String type}) async {
    await logEvent(
      name: 'referral_link_generated',
      parameters: {'type': type},
    );
  }

  void logInviteLinkPasteClicked() {
    logEvent(
      name: 'invite_link_paste_clicked',
      parameters: {'timestamp': DateTime.now().toIso8601String()},
    );
  }

  void logInviteLinkParseSuccess({required int tokenLength}) {
    logEvent(
      name: 'invite_link_parse_success',
      parameters: {
        'token_length': tokenLength,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  void logInviteLinkParseFailure({required String reason}) {
    logEvent(
      name: 'invite_link_parse_failure',
      parameters: {
        'reason': reason,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
  }

  // ============================================
  // Network / Team Events
  // ============================================

  Future<void> logTeamMemberView({required String memberId}) async {
    await logEvent(
      name: 'team_member_view',
      parameters: {'member_id': memberId},
    );
  }

  Future<void> logTeamMemberAdd() async {
    await logEvent(name: 'team_member_add');
  }

  Future<void> logTeamMilestone({
    required String milestone,
    required int count,
  }) async {
    await logEvent(
      name: 'team_milestone',
      parameters: {'milestone': milestone, 'count': count},
    );
  }

  // ============================================
  // AI Coach Events
  // ============================================

  Future<void> logAiCoachOpen() async {
    await logEvent(name: 'ai_coach_open');
  }

  Future<void> logAiCoachMessage({
    required String messageType,
    String? promptId,
  }) async {
    await logEvent(
      name: 'ai_coach_message',
      parameters: {
        'message_type': messageType,
        if (promptId != null) 'prompt_id': promptId,
      },
    );
  }

  Future<void> logAiCoachPromptSelect({required String promptId}) async {
    await logEvent(
      name: 'ai_coach_prompt_select',
      parameters: {'prompt_id': promptId},
    );
  }

  // ============================================
  // Messaging Events
  // ============================================

  Future<void> logMessageSend({required String threadType}) async {
    await logEvent(
      name: 'message_send',
      parameters: {'thread_type': threadType},
    );
  }

  Future<void> logMessageCenterView() async {
    await logEvent(name: 'message_center_view');
  }

  // ============================================
  // Dashboard Events
  // ============================================

  Future<void> logDashboardView({required String locale}) async {
    await logEvent(
      name: 'dash_view',
      parameters: {'locale': locale},
    );
  }

  Future<void> logDashboardTileTap({
    required String tile,
    required String locale,
  }) async {
    await logEvent(
      name: 'dash_tile_tap',
      parameters: {'tile': tile, 'locale': locale},
    );
  }

  Future<void> logDashboardCtaTap({
    required String cta,
    required String locale,
  }) async {
    await logEvent(
      name: 'dash_cta_tap',
      parameters: {'cta': cta, 'locale': locale},
    );
  }

  Future<void> logDashboardStatsRefresh({
    required String method,
    required String locale,
    required bool success,
  }) async {
    await logEvent(
      name: 'dash_stats_refresh',
      parameters: {
        'method': method,
        'locale': locale,
        'success': success,
      },
    );
  }

  // ============================================
  // Profile Events
  // ============================================

  Future<void> logProfileView() async {
    await logEvent(name: 'profile_view');
  }

  Future<void> logProfileEdit({required String field}) async {
    await logEvent(
      name: 'profile_edit',
      parameters: {'field': field},
    );
  }

  Future<void> logProfilePhotoUpload({required bool success}) async {
    await logEvent(
      name: 'profile_photo_upload',
      parameters: {'success': success},
    );
  }

  // ============================================
  // App Store Button Events
  // ============================================

  Future<void> logAppStoreButtonTap({
    required String store,
    required String source,
  }) async {
    await logEvent(
      name: 'app_store_button_tap',
      parameters: {'store': store, 'source': source},
    );
  }

  // ============================================
  // Onboarding Events
  // ============================================

  Future<void> logOnboardingStart() async {
    await logEvent(name: 'onboarding_start');
  }

  Future<void> logOnboardingStep({required int step, String? stepName}) async {
    await logEvent(
      name: 'onboarding_step',
      parameters: {
        'step': step,
        if (stepName != null) 'step_name': stepName,
      },
    );
  }

  Future<void> logOnboardingComplete() async {
    await logEvent(name: 'onboarding_complete');
  }

  // ============================================
  // Error Events
  // ============================================

  Future<void> logError({
    required String errorType,
    required String errorMessage,
    String? screen,
  }) async {
    await logEvent(
      name: 'app_error',
      parameters: {
        'error_type': errorType,
        'error_message': errorMessage.length > 100
            ? errorMessage.substring(0, 100)
            : errorMessage,
        if (screen != null) 'screen': screen,
      },
    );
  }
}
