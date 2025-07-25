// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app_links/app_links.dart';
import '../screens/homepage_screen.dart';
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
  Future<void> _handleDeepLink(Uri uri) async {
    debugPrint('🔗 Deep Link: Processing URI: $uri');

    final queryParams = uri.queryParameters;
    final referralCode = queryParams['ref'];

    // Only handle deep links that have actual referral codes
    if (referralCode != null && referralCode.isNotEmpty) {
      debugPrint('🔗 Deep Link: Found referral code: $referralCode');
      
      // Navigate to homepage screen with referral code
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => HomepageScreen(
            referralCode: referralCode,
            appId: appId,
          ),
        ),
        (route) => false, // Clear the navigation stack
      );
    } else {
      debugPrint('🔗 Deep Link: No referral code found, ignoring deep link');
      // Don't navigate anywhere if there's no referral code
      // Let the normal app flow handle authentication and routing
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
