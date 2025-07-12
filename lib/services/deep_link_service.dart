// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app_links/app_links.dart';
import '../screens/new_registration_screen.dart';
import '../screens/login_screen.dart';
import '../main.dart' show navigatorKey, appId;

class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSubscription;

  String? _pendingReferralCode;
  String? _pendingAdminReferralCode;

  /// Initialize deep link handling
  Future<void> initialize() async {
    try {
      // Handle app launch from deep link
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        debugPrint("🔗 Deep Link: App launched with URI: $initialUri");
        _handleDeepLink(initialUri);
      }

      // Handle deep links while app is running
      _linkSubscription = _appLinks.uriLinkStream.listen(
        (uri) {
          debugPrint("🔗 Deep Link: Received URI while running: $uri");
          _handleDeepLink(uri);
        },
        onError: (err) {
          debugPrint("🔗 Deep Link Error: $err");
        },
      );
    } catch (e) {
      debugPrint("🔗 Deep Link Initialization Error: $e");
    }
  }

  /// Handle incoming deep link
  void _handleDeepLink(Uri uri) {
    debugPrint('🔗 Deep Link: Processing URI: $uri');

    final queryParams = uri.queryParameters;
    debugPrint('🔗 Deep Link: Query parameters: $queryParams');

    final referralCode = queryParams['ref'];
    final adminReferralCode = queryParams['new'];

    debugPrint(
        '🔗 Deep Link: Found referral codes - ref: $referralCode, new: $adminReferralCode');

    if (referralCode != null || adminReferralCode != null) {
      debugPrint('🔗 Deep Link: Navigating to registration screen');
      debugPrint('🔗 Deep Link: Parameters being passed:');
      debugPrint('🔗   referralCode: $referralCode');
      debugPrint('🔗   adminReferralCode: $adminReferralCode');
      debugPrint('🔗   appId: $appId');
      debugPrint('🔗 Deep Link: Creating NewRegistrationScreen widget...');

      // Navigate to registration screen with referral codes
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) {
            debugPrint('🔗 Deep Link: MaterialPageRoute builder called');
            debugPrint('🔗   Creating NewRegistrationScreen with:');
            debugPrint('🔗     referralCode: $referralCode');
            debugPrint('🔗     adminReferralCode: $adminReferralCode');
            debugPrint('🔗     appId: $appId');

            return NewRegistrationScreen(
              referralCode: referralCode,
              adminReferralCode: adminReferralCode,
              appId: appId,
            );
          },
        ),
        (route) => false, // Clear the navigation stack
      );

      debugPrint('🔗 Deep Link: Navigation completed');
    } else {
      debugPrint('🔗 Deep Link: No referral codes found, navigating to login');
      // Navigate to login screen if no referral codes
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => LoginScreen(appId: appId),
        ),
        (route) => false,
      );
    }
  }

  /// Get pending referral codes (for use during app initialization)
  Map<String, String?> getPendingReferralCodes() {
    return {
      'referralCode': _pendingReferralCode,
      'adminReferralCode': _pendingAdminReferralCode,
    };
  }

  /// Clear pending referral codes
  void clearPendingCodes() {
    _pendingReferralCode = null;
    _pendingAdminReferralCode = null;
  }

  /// Dispose resources
  void dispose() {
    _linkSubscription?.cancel();
  }
}
