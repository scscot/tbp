import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/services.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import '../services/session_manager.dart';
import '../services/invite_link_parser.dart';
import '../services/analytics_service.dart';

/// Clipboard helper that prevents iOS paste-permission modal from appearing
/// at app launch. It only reads the clipboard after explicit user consent.
class ClipboardHelper {
  static const MethodChannel _channel = MethodChannel('clipboard_utils');

  /// Returns true when running on a physical iOS device.
  static Future<bool> isPhysicalIOSDevice() async {
    if (!Platform.isIOS) return false;
    final info = await DeviceInfoPlugin().iosInfo;
    return info.isPhysicalDevice;
  }

  /// iOS-only, safe preflight check that **does not** trigger the paste modal.
  /// Returns true if UIPasteboard has any string content.
  static Future<bool> iosHasStrings() async {
    if (!Platform.isIOS) return false;
    try {
      final has = await _channel.invokeMethod<bool>('hasStrings');
      return has ?? false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ ClipboardHelper: hasStrings failed: $e');
      }
      return false;
    }
  }

  /// UI helper: decides whether to show a contextual "Paste" affordance.
  /// Rules:
  ///  - iOS only
  ///  - physical device (skip Simulator)
  ///  - Remote Config flag enabled
  ///  - pasteboard reports it *has* strings (safe preflight; no permission prompt)
  static Future<bool> shouldOfferPaste() async {
    // Skip on non-iOS or Simulator
    if (!Platform.isIOS) return false;
    if (!await isPhysicalIOSDevice()) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Skip paste offer (Simulator)');
      }
      return false;
    }

    // Check Remote Config feature flag
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;
      final isEnabled = remoteConfig.getBool('referral_clipboard_offer_enabled');
      if (!isEnabled) {
        if (kDebugMode) {
          debugPrint('📋 ClipboardHelper: Skip paste offer (Remote Config disabled)');
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('⚠️ ClipboardHelper: Remote Config check failed, defaulting to enabled: $e');
      }
      // Default to enabled if Remote Config fails
    }

    // Safe preflight check (no permission prompt)
    final has = await iosHasStrings();
    if (kDebugMode) {
      debugPrint('📋 ClipboardHelper: Clipboard has strings: $has');
    }
    return has;
  }

  /// Gets plain text from clipboard (may trigger Apple's paste sheet on iOS 16+).
  /// Returns null if clipboard is empty or contains non-text data.
  static Future<String?> pastePlainText() async {
    final data = await Clipboard.getData('text/plain');
    final text = data?.text?.trim();
    if (text == null || text.isEmpty) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Clipboard text empty');
      }
      return null;
    }

    if (kDebugMode) {
      debugPrint('📋 ClipboardHelper: Retrieved clipboard text: ${text.substring(0, text.length > 50 ? 50 : text.length)}...');
    }
    return text;
  }

  /// Validates and applies pasted invite link from clipboard.
  /// Returns the referral code if valid, null otherwise.
  static Future<String?> pasteAndValidateReferral() async {
    final analytics = AnalyticsService();
    analytics.logInviteLinkPasteClicked();

    final text = await pastePlainText();
    if (text == null) {
      analytics.logInviteLinkParseFailure(reason: 'clipboard_empty');
      return null;
    }

    final parseResult = InviteLinkParser.parse(text);

    if (!parseResult.success) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Invalid invite link format: $text');
        debugPrint('📋 ClipboardHelper: Failure reason: ${parseResult.failureReason}');
      }
      analytics.logInviteLinkParseFailure(reason: parseResult.failureReason ?? 'unknown');
      return null;
    }

    if (kDebugMode) {
      debugPrint('📋 ClipboardHelper: Valid invite link, storing: ref=${parseResult.referralCode}, type=${parseResult.queryType}');
    }

    analytics.logInviteLinkParseSuccess(tokenLength: parseResult.referralCode!.length);

    await SessionManager.instance.setReferralData(
      parseResult.referralCode!,
      '',
      queryType: parseResult.queryType,
      source: 'invite_link_paste_inline',
      capturedAt: DateTime.now(),
    );

    await Clipboard.setData(const ClipboardData(text: ''));

    if (kDebugMode) {
      debugPrint('✅ ClipboardHelper: Referral applied and clipboard cleared');
    }

    return parseResult.referralCode;
  }

}
