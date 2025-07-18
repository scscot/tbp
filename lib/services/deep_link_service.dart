// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app_links/app_links.dart';
import '../screens/homepage_screen.dart';
import '../screens/login_screen.dart';
import '../main.dart' show navigatorKey, appId;

class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSubscription;

  String? _pendingReferralCode;

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

    debugPrint('🔗 Deep Link: Found referral code - ref: $referralCode');

    if (referralCode != null) {
      debugPrint('🔗 Deep Link: Navigating to homepage screen with referral code');
      debugPrint('🔗 Deep Link: Parameters being passed:');
      debugPrint('🔗   referralCode: $referralCode');
      debugPrint('🔗   appId: $appId');
      debugPrint('🔗 Deep Link: Creating HomepageScreen widget...');

      // Navigate to homepage screen with referral code (updated flow)
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) {
            debugPrint('🔗 Deep Link: MaterialPageRoute builder called');
            debugPrint('🔗   Creating HomepageScreen with:');
            debugPrint('🔗     referralCode: $referralCode');
            debugPrint('🔗     appId: $appId');

            return HomepageScreen(
              referralCode: referralCode,
              appId: appId,
            );
          },
        ),
        (route) => false, // Clear the navigation stack
      );

      debugPrint('🔗 Deep Link: Navigation completed');
    } else {
      debugPrint('🔗 Deep Link: No referral code found, navigating to homepage');
      // Navigate to homepage screen if no referral code
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => HomepageScreen(appId: appId),
        ),
        (route) => false,
      );
    }
  }

  /// Get pending referral codes (for use during app initialization)
  Map<String, String?> getPendingReferralCodes() {
    return {
      'referralCode': _pendingReferralCode,
    };
  }

  /// Clear pending referral codes
  void clearPendingCodes() {
    _pendingReferralCode = null;
  }

  /// Dispose resources
  void dispose() {
    _linkSubscription?.cancel();
  }
}
