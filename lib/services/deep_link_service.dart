// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app_links/app_links.dart';
import '../screens/homepage_screen.dart';
import '../main.dart' show navigatorKey, appId;
import 'session_manager.dart';

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

    // First, validate the URI scheme and host
    if (!_isValidReferralUri(uri)) {
      debugPrint('🔗 Deep Link: Invalid URI scheme or host, ignoring: $uri');
      return;
    }

    final queryParams = uri.queryParameters;
    final referralCode = queryParams['ref'];

    // Only handle deep links that have actual referral codes
    if (referralCode != null && referralCode.isNotEmpty && _isValidReferralCode(referralCode)) {
      debugPrint('🔗 Deep Link: Found valid referral code: $referralCode');

      // Store the referral code for later use
      _pendingReferralCode = referralCode;

      // ✅ IMMEDIATELY SAVE THE CODE TO THE SESSION
      await SessionManager.instance.setPendingReferralCode(referralCode);

      // Navigate to homepage screen with referral code
      navigatorKey.currentState?.pushReplacement(
        MaterialPageRoute(
          builder: (context) => HomepageScreen(
            referralCode: referralCode,
            appId: appId,
          ),
        ),
      );
    } else {
      debugPrint('🔗 Deep Link: No valid referral code found, ignoring deep link');
      // Don't navigate anywhere if there's no referral code
      // Let the normal app flow handle authentication and routing
    }
  }

  /// Validate if the URI is a valid referral URI
  bool _isValidReferralUri(Uri uri) {
    // Reject file:// protocol URLs
    if (uri.scheme == 'file') {
      debugPrint('🔗 Deep Link: Rejecting file:// protocol URL');
      return false;
    }

    // Reject localhost and IP addresses
    if (uri.host.isEmpty) {
      debugPrint('🔗 Deep Link: Rejecting URI with empty host');
      return false;
    }

    if (uri.host == 'localhost' || uri.host == '127.0.0.1') {
      debugPrint('🔗 Deep Link: Rejecting localhost URL');
      return false;
    }

    // Reject IP addresses (simple regex check)
    final ipRegex = RegExp(r'^\d+\.\d+\.\d+\.\d+$');
    if (ipRegex.hasMatch(uri.host)) {
      debugPrint('🔗 Deep Link: Rejecting IP address URL');
      return false;
    }

    // Only accept http, https, or custom app schemes
    if (!['http', 'https', 'teambuildpro'].contains(uri.scheme)) {
      debugPrint('🔗 Deep Link: Rejecting unsupported scheme: ${uri.scheme}');
      return false;
    }

    return true;
  }

  /// Validate if the referral code is valid
  bool _isValidReferralCode(String referralCode) {
    // Basic validation - not empty, reasonable length, alphanumeric
    if (referralCode.trim().isEmpty) {
      return false;
    }

    // Reject codes that are too long (likely file paths)
    if (referralCode.length > 50) {
      debugPrint('🔗 Deep Link: Rejecting overly long referral code');
      return false;
    }

    // Reject codes that contain file path indicators
    if (referralCode.contains('/') || referralCode.contains('\\') || referralCode.contains(':')) {
      debugPrint('🔗 Deep Link: Rejecting referral code with path indicators');
      return false;
    }

    return true;
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
