import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/services.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import '../services/pasteboard_attribution_service.dart';
import '../services/session_manager.dart';

/// Clipboard helper that prevents iOS paste-permission modal from appearing
/// at app launch. It only reads the clipboard after explicit user consent.
class ClipboardHelper {
  static const MethodChannel _channel = MethodChannel('clipboard_utils');

  static bool _hasOfferedThisSession = false;

  /// Returns true when running on a physical iOS device.
  static Future<bool> isPhysicalIOSDevice() async {
    if (!Platform.isIOS) return false;
    final info = await DeviceInfoPlugin().iosInfo;
    return info.isPhysicalDevice ?? false;
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

  /// Offers to paste a referral code *after* screen render.
  /// Only performs an actual paste if the user agrees.
  ///
  /// Guards:
  /// - Skip on non-iOS or Simulator
  /// - Skip if already offered this session (cooldown)
  /// - Skip if Remote Config flag is disabled
  /// - Skip if referral already exists in SessionManager
  /// - Validate payload before applying
  static Future<void> maybeOfferPasteReferral(BuildContext context) async {
    // Skip entirely on non-iOS or Simulator to avoid "CoreSimulator-Bridge" prompts
    if (!Platform.isIOS) return;
    if (!await isPhysicalIOSDevice()) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Skipping (Simulator)');
      }
      return;
    }

    // Cooldown: only offer once per app session
    if (_hasOfferedThisSession) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Skipping (already offered this session)');
      }
      return;
    }

    // Feature flag check
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;
      final isEnabled = remoteConfig.getBool('referral_clipboard_offer_enabled');
      if (!isEnabled) {
        if (kDebugMode) {
          debugPrint('📋 ClipboardHelper: Skipping (Remote Config disabled)');
        }
        return;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('⚠️ ClipboardHelper: Remote Config check failed, defaulting to enabled: $e');
      }
      // Default to enabled if Remote Config fails
    }

    // Check if referral already exists in SessionManager
    final cachedData = await SessionManager.instance.getReferralData();
    if (cachedData != null && cachedData['referralCode']?.toString().isNotEmpty == true) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Skipping (referral already exists)');
      }
      return;
    }

    // Preflight: check if clipboard has strings (no modal trigger)
    final has = await iosHasStrings();
    if (!has || !context.mounted) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: No clipboard content or context unmounted');
      }
      return;
    }

    // Mark as offered to prevent repeated prompts this session
    _hasOfferedThisSession = true;

    // Show user consent dialog
    final consent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Paste referral from clipboard?'),
        content: const Text(
          'We detected text on your clipboard. Would you like to paste it to auto-fill your referral code?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No thanks'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Paste'),
          ),
        ],
      ),
    );

    if (consent != true) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: User declined paste');
      }
      return;
    }

    // User consented - this call may present Apple's system paste sheet with proper context
    if (kDebugMode) {
      debugPrint('📋 ClipboardHelper: User consented, reading clipboard');
    }

    final data = await Clipboard.getData('text/plain');
    final text = data?.text?.trim();

    if (text?.isEmpty ?? true) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Clipboard text empty after consent');
      }
      return;
    }

    // Process through PasteboardAttributionService for validation and handling
    final pasteboardService = PasteboardAttributionService();

    // Parse and validate the payload
    final parsedPayload = _parsePayload(text!);
    if (parsedPayload == null) {
      if (kDebugMode) {
        debugPrint('📋 ClipboardHelper: Invalid payload format: $text');
      }

      // Show error dialog
      if (context.mounted) {
        await showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Invalid Format'),
            content: const Text('The clipboard content is not a valid referral link.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
      return;
    }

    // Valid payload - store in SessionManager
    if (kDebugMode) {
      debugPrint('📋 ClipboardHelper: Valid payload, storing: ref=${parsedPayload.ref}, t=${parsedPayload.t}');
    }

    await SessionManager.instance.setReferralData(
      parsedPayload.ref,
      '', // sponsor name will be resolved later by registration screen
      queryType: 'ref',
      source: 'pasteboard-clipboard_helper',
      campaignType: parsedPayload.t,
      capturedAt: DateTime.now(),
    );

    // Clear clipboard to prevent re-processing
    await Clipboard.setData(const ClipboardData(text: ''));

    if (kDebugMode) {
      debugPrint('✅ ClipboardHelper: Referral applied and clipboard cleared');
    }

    // Show success feedback
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Referral code applied!'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  /// Parse payload using same logic as PasteboardAttributionService
  /// Returns null if invalid format
  static _Payload? _parsePayload(String raw) {
    if (raw.isEmpty) return null;

    // Example formats:
    // TBP_REF:88888888;TKN:;T:2                 // ref-only
    // TBP_REF:88888888;TKN:ABCDEF...32HEX;T:2  // token flow
    final text = raw.trim();
    if (!text.startsWith('TBP_')) return null;

    String ref = '';
    String token = '';
    String t = '';

    for (final seg in text.split(';')) {
      final s = seg.trim();
      if (s.isEmpty) continue;
      final i = s.indexOf(':');
      if (i <= 0) continue;

      final key = s.substring(0, i).trim().toUpperCase();
      final val = s.substring(i + 1).trim();

      switch (key) {
        case 'TBP_REF':
          ref = val;
          break;
        case 'TKN':
          token = val;
          break;
        case 'T':
          t = val;
          break;
      }
    }

    if (ref.isEmpty && token.isEmpty) return null;

    // If a token exists, require 32 hex chars; otherwise treat as no token.
    if (token.isNotEmpty &&
        !RegExp(r'^[A-Fa-f0-9]{32}$').hasMatch(token)) {
      token = '';
    }

    return _Payload(ref: ref, token: token, t: t);
  }

  /// Reset the session flag (useful for testing)
  static void resetSessionFlag() {
    _hasOfferedThisSession = false;
  }
}

/// Simple payload structure for clipboard parsing
class _Payload {
  final String ref;   // may be empty for organic
  final String token; // may be empty for ref-only
  final String t;     // campaign type; may be empty
  const _Payload({required this.ref, required this.token, required this.t});
}
