// lib/services/deep_link_service.dart

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:app_links/app_links.dart';
import '../screens/homepage_screen.dart';
import '../main.dart' show navigatorKey, appId;

class DeepLinkService {
  static final DeepLinkService _instance = DeepLinkService._internal();
  factory DeepLinkService() => _instance;
  DeepLinkService._internal();

  String? _latestReferralCode; // NEW
  String? get latestReferralCode => _latestReferralCode; // NEW

  String? _latestQueryType; // 'ref' or 'new'
  String? get latestQueryType => _latestQueryType;

  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSubscription;

  /// Initialize deep link handling and manage initial navigation.
  Future<void> initialize() async {
    try {
      // Handle app launch from a deep link
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        if (kDebugMode) {
          debugPrint("🔗 Deep Link: App launched with URI: $initialUri");
        }
        _handleDeepLink(initialUri);
      } else {
        // --- THIS IS THE CRITICAL FIX ---
        // Handle a normal app launch (no deep link)
        if (kDebugMode) {
          debugPrint(
              "🔗 Deep Link: No initial URI found. Navigating to generic homepage.");
        }
        _navigateToHomepage(null, null); // Pass null to show the generic page
      }

      // Listen for deep links while the app is running
      _linkSubscription = _appLinks.uriLinkStream.listen(
        (uri) {
          if (kDebugMode) {
            debugPrint("🔗 Deep Link: Received URI while running: $uri");
          }
          _handleDeepLink(uri);
        },
        onError: (err) {
          if (kDebugMode) {
            debugPrint("🔗 Deep Link Error: $err");
          }
        },
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint("🔗 Deep Link Initialization Error: $e");
      }
    }
  }

  void _handleDeepLink(Uri uri) {
    if (kDebugMode) {
      debugPrint('🔗 Deep Link: Processing URI: $uri');
    }

    final qp = uri.queryParameters;
    final referralCode = (qp['ref'] ?? qp['new'])?.trim();
    final queryType =
        qp.containsKey('new') ? 'new' : (qp.containsKey('ref') ? 'ref' : null);

    _latestReferralCode =
        (referralCode != null && referralCode.isNotEmpty) ? referralCode : null;
    _latestQueryType = queryType;

    // Navigate with both values (may be nulls)
    _navigateToHomepage(_latestReferralCode, _latestQueryType);
  }

  void _navigateToHomepage(String? referralCode, String? queryType) {
    navigatorKey.currentState?.pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (context) => HomepageScreen(
          appId: appId,
          referralCode: referralCode,
          queryType: queryType, // <-- new
        ),
      ),
      (route) => false,
    );
  }

  /// Dispose of the stream subscription.
  void dispose() {
    _linkSubscription?.cancel();
  }
}
