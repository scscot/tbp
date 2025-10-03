// lib/services/deep_link_service.dart

import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:app_links/app_links.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter_branch_sdk/flutter_branch_sdk.dart';
import '../screens/homepage_screen.dart';
import '../screens/new_registration_screen.dart';
import '../services/session_manager.dart';
import '../services/pasteboard_attribution_service.dart';
import '../services/deep_link_claim_parser.dart';
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
  StreamSubscription<Map>? _branchSubscription;

  /// Initialize deep link handling and manage initial navigation.
  Future<void> initialize() async {
    try {
      // Initialize Branch SDK first for deferred deep linking
      await FlutterBranchSdk.init();
      if (kDebugMode) {
        debugPrint("🌿 Branch: SDK initialized");
      }

      // Listen for Branch data (handles deferred deep links from App Store installs)
      _branchSubscription = FlutterBranchSdk.listSession().listen((data) async {
        if (kDebugMode) {
          debugPrint("🌿 Branch: Session data received: $data");
        }

        if (data.containsKey('+clicked_branch_link') &&
            data['+clicked_branch_link'] == true) {

          final referralCode = data['ref'] ?? data['new'];
          final queryType = data.containsKey('new') ? 'new' :
                           data.containsKey('ref') ? 'ref' : null;

          if (referralCode != null && referralCode.toString().isNotEmpty) {
            _latestReferralCode = referralCode.toString();
            _latestQueryType = queryType;

            if (kDebugMode) {
              debugPrint("🌿 Branch: Deferred deep link captured: $_latestReferralCode (type: $_latestQueryType)");
            }

            // Store in SessionManager for registration screen to pick up
            await SessionManager.instance.setReferralData(
              _latestReferralCode!,
              '', // sponsor name will be resolved later by registration screen
              queryType: _latestQueryType
            );

            _navigateToHomepage(_latestReferralCode, _latestQueryType);
          }
        }
      });

      // Handle app launch from a direct deep link (Universal Links or URI schemes)
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        if (kDebugMode) {
          debugPrint("🔗 Deep Link: App launched with URI: $initialUri");
        }
        _handleDeepLink(initialUri);
      } else {
        // Handle a normal app launch (no direct deep link)
        // Note: Branch deferred data might still arrive via the listener above
        if (kDebugMode) {
          debugPrint(
              "🔗 Deep Link: No initial URI found. Checking for cached referral or navigating to generic homepage.");
        }

        // Clipboard checks are now user-initiated in UI (see ClipboardHelper)
        // Check if we have cached referral data before showing generic page
        final cachedData = await SessionManager.instance.getReferralData();
        if (cachedData != null) {
          _latestReferralCode = cachedData['referralCode'];
          _latestQueryType = cachedData['queryType'];
          if (kDebugMode) {
            debugPrint("🔗 Deep Link: Found cached referral data: $_latestReferralCode");
          }
        }

        _navigateToHomepage(_latestReferralCode, _latestQueryType);
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

  void _handleDeepLink(Uri uri) async {
    if (kDebugMode) {
      debugPrint('🔗 Deep Link: Processing URI: $uri');
    }

    // Use Joe's new ClaimParams parser - supports both token and tkn parameters
    final claimParams = parseClaimParams(uri);

    if (claimParams.hasToken) {
      if (kDebugMode) {
        debugPrint('🎫 Deep Link: Token claim detected - token=${claimParams.token}, sponsor=${claimParams.sponsorCode}, type=${claimParams.campaignType}');
      }

      // Compose pasteboard payload to keep one code path in the app
      final payload = 'TBP_REF:${claimParams.sponsorCode ?? ''};TKN:${claimParams.token};T:${claimParams.campaignType ?? ''}';

      // Redeem via direct method (skips clipboard)
      final pasteboardService = PasteboardAttributionService();
      final result = await pasteboardService.redeemPayloadDirect(payload);

      if (result.applied) {
        _latestReferralCode = result.sponsorCode;
        _latestQueryType = 'claim'; // distinct from 'pasteboard'

        if (kDebugMode) {
          debugPrint('✅ Token directly redeemed: ${result.sponsorCode} (${result.status})');
        }

        // Store in SessionManager for registration screen
        await SessionManager.instance.setReferralData(
          result.sponsorCode,
          '', // sponsor name will be resolved later
          queryType: _latestQueryType,
          source: 'claim-direct'
        );

        _navigateToHomepage(_latestReferralCode, _latestQueryType);
        return;
      } else {
        if (kDebugMode) {
          debugPrint('🚨 Direct token redemption failed: ${claimParams.token}');
        }
      }
    }

    // Handle traditional referral URL parameters
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

  void _navigateToHomepage(String? referralCode, String? queryType) async {
    final isDemoMode = await _checkDemoMode();
    
    if (isDemoMode) {
      // Demo mode: show homepage with demo functionality
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => HomepageScreen(
            appId: appId,
            referralCode: referralCode,
            queryType: queryType,
          ),
        ),
        (route) => false,
      );
    } else {
      // Normal mode: route directly to registration with referral data
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => NewRegistrationScreen(
            appId: appId,
            referralCode: referralCode,
            queryType: queryType,
          ),
        ),
        (route) => false,
      );
    }
  }

  Future<bool> _checkDemoMode() async {
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;
      bool isDemo = false;
      
      if (Platform.isAndroid) {
        isDemo = remoteConfig.getBool('android_demo_mode');
      } else if (Platform.isIOS) {
        isDemo = remoteConfig.getBool('ios_demo_mode');
      }
      
      return isDemo;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ DEEP_LINK: Error checking demo mode: $e');
      }
      return false;
    }
  }

  /// Clear referral data (used during logout)
  void clearReferralData() {
    _latestReferralCode = null;
    _latestQueryType = null;
    if (kDebugMode) {
      debugPrint('🧹 DEEP_LINK: Referral data cleared');
    }
  }

  /// Dispose of the stream subscription.
  void dispose() {
    _linkSubscription?.cancel();
    _branchSubscription?.cancel();
  }
}
