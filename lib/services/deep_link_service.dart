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
import '../services/install_referrer_bridge.dart';
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
      bool branchInitialized = false;

      // Initialize Branch SDK first for deferred deep linking
      try {
        await FlutterBranchSdk.init();
        branchInitialized = true;
        if (kDebugMode) {
          debugPrint("🌿 Branch: SDK initialized successfully");
        }
      } catch (branchError) {
        if (kDebugMode) {
          debugPrint("⚠️ Branch: SDK initialization failed: $branchError");
          debugPrint("⚠️ Branch: Continuing without Branch SDK (deep links will still work via AppLinks)");
        }
      }

      // Listen for Branch data only if SDK initialized successfully
      if (branchInitialized) {
        try {
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
          }, onError: (error) {
            if (kDebugMode) {
              debugPrint("⚠️ Branch: Session listener error: $error");
            }
          });
        } catch (e) {
          if (kDebugMode) {
            debugPrint("⚠️ Branch: Failed to start session listener: $e");
          }
        }
      }

      // Handle app launch from a direct deep link (Universal Links or URI schemes)
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        if (kDebugMode) {
          debugPrint("🔗 Deep Link: App launched with URI: $initialUri");
        }

        // Try unified claim handler first (cold start)
        final handled = await _handleClaimUri(initialUri, source: 'initial');
        if (!handled) {
          // Fall back to existing complex logic for non-claim URIs
          _handleDeepLink(initialUri);
        }
      } else {
        // Handle a normal app launch (no direct deep link)
        // Note: Branch deferred data might still arrive via the listener above
        if (kDebugMode) {
          debugPrint(
              "🔗 Deep Link: No initial URI found. Checking for cached referral or navigating to generic homepage.");
        }

        // Android: Check for Install Referrer (deferred deep linking from Play Store)
        if (Platform.isAndroid) {
          final installReferrer = await InstallReferrerBridge.fetchOnce();
          if (installReferrer != null && installReferrer.ref != null && installReferrer.ref!.isNotEmpty) {
            debugPrint('[TBP-ANDROID-IR] Install Referrer found: ref=${installReferrer.ref} t=${installReferrer.t}');

            _latestReferralCode = installReferrer.ref;
            _latestQueryType = 'install_referrer';

            await SessionManager.instance.setReferralData(
              installReferrer.ref!,
              '', // sponsor name will be resolved by registration screen
              queryType: 'install_referrer',
              source: 'install_referrer',
              campaignType: installReferrer.t ?? '1'
            );

            _navigateToHomepage(_latestReferralCode, _latestQueryType);
            return; // Skip cached data check
          } else {
            debugPrint('[TBP-ANDROID-IR] No Install Referrer data found');
          }
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
        (uri) async {
          if (kDebugMode) {
            debugPrint("🔗 Deep Link: Received URI while running: $uri");
          }

          // Try unified claim handler first (warm start)
          final handled = await _handleClaimUri(uri, source: 'stream');
          if (!handled) {
            // Fall back to existing complex logic for non-claim URIs
            _handleDeepLink(uri);
          }
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

  /// Unified claim URI handler for both cold and warm starts.
  /// Returns true if the URI was a claim path and was handled.
  Future<bool> _handleClaimUri(Uri uri, {required String source}) async {
    final raw = uri.toString();
    debugPrint('[TBP-DEEPLINK-$source] $raw');

    final path = uri.path.toLowerCase();
    if (!path.contains('claim')) {
      debugPrint('[TBP-DEEPLINK-$source] Not a claim path, skipping');
      return false; // Not a claim path, let other handlers process it
    }

    // Parse query params safely
    final ref = uri.queryParameters['ref']?.trim();
    final tkn = uri.queryParameters['tkn']?.trim();
    final t = uri.queryParameters['t']?.trim();

    debugPrint('[TBP-CLAIM-PARSED] ref:$ref tkn:${tkn != null ? 'present' : 'none'} t:$t');

    if (ref != null && ref.isNotEmpty) {
      // Store in SessionManager with all available data
      await SessionManager.instance.setReferralData(
        ref,
        '', // sponsor name will be resolved by registration screen
        queryType: 'claim',
        source: 'claim_uri_$source',
        campaignType: t
      );

      _latestReferralCode = ref;
      _latestQueryType = 'claim';

      debugPrint('[TBP-SESSIONMGR] Stored ref=$ref source=claim_uri_$source tkn=${tkn != null ? 'present' : 'none'}');

      // Navigate to registration with claim data
      _navigateToHomepage(ref, 'claim');
      return true;
    } else {
      debugPrint('[TBP-CLAIM-PARSED] No ref parameter found');
      return false;
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
