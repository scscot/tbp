import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class RedeemResult {
  final bool applied;
  final String sponsorCode;
  final String? status; // 'redeemed' | 'already_redeemed'
  final String? campaignType;

  const RedeemResult(this.applied, this.sponsorCode, this.status, this.campaignType);
}

class _Payload {
  final String ref;   // may be empty for organic
  final String token; // may be empty for ref-only
  final String t;     // campaign type; may be empty
  const _Payload({required this.ref, required this.token, required this.t});
}

_Payload? _parsePayload(String raw) {
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

class PasteboardAttributionService {
  static const String _functionBaseURL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net';

  static final PasteboardAttributionService _instance = PasteboardAttributionService._internal();
  factory PasteboardAttributionService() => _instance;
  PasteboardAttributionService._internal();

  String? _cachedToken;
  DateTime? _lastPasteboardCheck;

  /// Check pasteboard for referral token and redeem if found
  Future<Map<String, dynamic>?> checkAndRedeemPasteboardToken() async {
    try {
      // Throttle pasteboard checks to avoid excessive clipboard access
      final now = DateTime.now();
      if (_lastPasteboardCheck != null &&
          now.difference(_lastPasteboardCheck!).inSeconds < 5) {
        if (kDebugMode) print('📋 Pasteboard check throttled');
        return null;
      }
      _lastPasteboardCheck = now;

      // Get clipboard data
      final clipboardData = await Clipboard.getData(Clipboard.kTextPlain);
      final clipboardText = clipboardData?.text?.trim();

      if (clipboardText == null || clipboardText.isEmpty) {
        if (kDebugMode) print('📋 No clipboard data found');
        return null;
      }

      // Parse payload using tolerant key→value parser
      final payload = _parsePayload(clipboardText);
      if (payload == null) {
        if (kDebugMode) print('📋 Clipboard text does not match payload format');
        return null;
      }

      // Avoid re-processing the same payload
      if (_cachedToken == clipboardText) {
        if (kDebugMode) print('📋 Payload already processed: $clipboardText');
        return null;
      }

      if (kDebugMode) print('📋 Found valid payload in pasteboard: $clipboardText');

      Map<String, dynamic>? result;

      if (payload.token.isEmpty) {
        // REF-ONLY FLOW: No token redemption, use sponsor code directly
        if (kDebugMode) print('📋 REF-ONLY flow: sponsor=${payload.ref}, type=${payload.t}');

        result = {
          'sponsorCode': payload.ref,
          't': payload.t,
          'status': 'ref_only',
          'source': 'pasteboard-payload',
          'isFirstTime': true,
        };

        _cachedToken = clipboardText;

        // Clear the pasteboard to prevent re-processing
        await Clipboard.setData(const ClipboardData(text: ''));
        if (kDebugMode) print('📋 Pasteboard cleared after ref-only flow');

      } else {
        // TOKEN FLOW: Redeem token, fallback to ref if fails
        if (kDebugMode) print('📋 TOKEN flow: attempting redemption');

        result = await redeemReferralToken(payload.token);
        if (result != null) {
          _cachedToken = clipboardText;

          // Add payload data to result
          result['sponsorCode'] = result['sponsorCode'] ?? payload.ref;
          result['t'] = payload.t;
          result['source'] = 'pasteboard-payload';

          // Clear the pasteboard to prevent re-processing
          await Clipboard.setData(const ClipboardData(text: ''));
          if (kDebugMode) print('📋 Pasteboard cleared after successful token redemption');

        } else if (payload.ref.isNotEmpty) {
          // Fallback to ref-only if token redemption failed
          if (kDebugMode) print('📋 Token redemption failed, falling back to ref: ${payload.ref}');

          result = {
            'sponsorCode': payload.ref,
            't': payload.t,
            'status': 'token_fallback_to_ref',
            'source': 'pasteboard-payload',
            'isFirstTime': true,
          };

          _cachedToken = clipboardText;

          // Clear the pasteboard to prevent re-processing
          await Clipboard.setData(const ClipboardData(text: ''));
          if (kDebugMode) print('📋 Pasteboard cleared after fallback to ref');
        }
      }

      return result;
    } catch (error) {
      if (kDebugMode) print('❌ Error checking pasteboard: $error');
      return null;
    }
  }

  /// Redeem a referral token via Cloud Function
  Future<Map<String, dynamic>?> redeemReferralToken(String token) async {
    try {
      if (kDebugMode) print('🎫 Attempting to redeem token: $token');

      final response = await http.post(
        Uri.parse('$_functionBaseURL/redeemReferral'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'token': token,
        }),
      );

      if (kDebugMode) print('🎫 Token redemption response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (kDebugMode) {
          final statusMsg = data['status'] == 'already_redeemed' ? 'already applied' : 'successfully applied';
          print('✅ Token $statusMsg: ${data['sponsorCode']}');
        }

        return {
          'sponsorCode': data['sponsorCode'],
          't': data['t'],
          'status': data['status'], // 'redeemed' or 'already_redeemed'
          'source': 'pasteboard',
          'isFirstTime': data['status'] == 'redeemed', // For UI feedback
        };
      } else if (response.statusCode == 404) {
        if (kDebugMode) print('🚨 Token not found: $token');
      } else if (response.statusCode == 410) {
        if (kDebugMode) print('🚨 Token expired: $token');
      } else {
        if (kDebugMode) print('🚨 Token redemption failed: ${response.statusCode} - ${response.body}');
      }

      return null;
    } catch (error) {
      if (kDebugMode) print('❌ Error redeeming token: $error');
      return null;
    }
  }

  /// Extract token from URL claim link
  String? extractTokenFromClaimURL(String url) {
    try {
      final uri = Uri.parse(url);

      // Handle /claim?token=xxx or /claim?tkn=xxx URLs
      if (uri.path == '/claim') {
        final token = uri.queryParameters['token'] ?? uri.queryParameters['tkn'];
        if (token != null && _isValidTokenFormat(token)) {
          if (kDebugMode) print('🔗 Extracted token from claim URL: $token');
          return token;
        }
      }

      return null;
    } catch (error) {
      if (kDebugMode) print('❌ Error extracting token from URL: $error');
      return null;
    }
  }


  /// Check if string matches our token format (32-character hex) - for direct token redemption
  bool _isValidTokenFormat(String text) {
    // Our tokens are 32-character hex strings (from crypto.randomBytes(16))
    final tokenRegex = RegExp(r'^[0-9a-f]{32}$');
    return tokenRegex.hasMatch(text);
  }

  /// Copy token to pasteboard (for testing or sharing)
  Future<void> copyTokenToPasteboard(String token) async {
    try {
      await Clipboard.setData(ClipboardData(text: token));
      if (kDebugMode) print('📋 Token copied to pasteboard: $token');
    } catch (error) {
      if (kDebugMode) print('❌ Error copying token to pasteboard: $error');
    }
  }

  /// Clear cached token (useful for testing)
  void clearCachedToken() {
    _cachedToken = null;
    if (kDebugMode) print('🧹 Cleared cached token');
  }

  /// Get debug info for troubleshooting
  Map<String, dynamic> getDebugInfo() {
    return {
      'cachedToken': _cachedToken,
      'lastPasteboardCheck': _lastPasteboardCheck?.toIso8601String(),
      'service': 'PasteboardAttributionService',
    };
  }

  /// Direct redeem helper that bypasses clipboard (for claim URLs)
  Future<RedeemResult> redeemPayloadDirect(String payload) async {
    try {
      // Parse payload using tolerant key→value parser
      final p = _parsePayload(payload);

      if (p == null) {
        if (kDebugMode) print('🚨 Invalid payload format for direct redeem: $payload');
        return const RedeemResult(false, '', null, null);
      }

      final sponsorCode = p.ref;
      final campaignType = p.t;

      if (p.token.isEmpty) {
        // REF-ONLY: No token to redeem, just return sponsor info
        if (kDebugMode) print('🎫 Direct redeem REF-ONLY: sponsor=$sponsorCode, type=$campaignType');
        return RedeemResult(
          sponsorCode.isNotEmpty,
          sponsorCode,
          'ref_only',
          campaignType.isNotEmpty ? campaignType : null,
        );
      }

      // TOKEN FLOW: Redeem the token
      if (kDebugMode) print('🎫 Direct redeem attempt: token=${p.token}, sponsor=$sponsorCode, type=$campaignType');

      final response = await http.post(
        Uri.parse('$_functionBaseURL/redeemReferral'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'token': p.token}),
      );

      if (kDebugMode) print('🎫 Direct redeem response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final resultSponsorCode = (data['sponsorCode'] as String?) ?? sponsorCode;
        final status = data['status'] as String?;

        if (kDebugMode) {
          final statusMsg = status == 'already_redeemed' ? 'already applied' : 'successfully applied';
          print('✅ Direct redeem $statusMsg: $resultSponsorCode');
        }

        return RedeemResult(
          resultSponsorCode.isNotEmpty,
          resultSponsorCode,
          status,
          campaignType.isNotEmpty ? campaignType : null,
        );
      } else {
        if (kDebugMode) {
          if (response.statusCode == 404) {
            print('🚨 Token not found: ${p.token}');
          } else if (response.statusCode == 410) {
            print('🚨 Token expired: ${p.token}');
          } else {
            print('🚨 Direct redeem failed: ${response.statusCode} - ${response.body}');
          }
        }

        // Fallback to ref if token redemption failed
        if (sponsorCode.isNotEmpty) {
          if (kDebugMode) print('🎫 Token redemption failed, using ref: $sponsorCode');
          return RedeemResult(
            true,
            sponsorCode,
            'token_fallback_to_ref',
            campaignType.isNotEmpty ? campaignType : null,
          );
        }
      }

      return const RedeemResult(false, '', null, null);
    } catch (error) {
      if (kDebugMode) print('❌ Error in direct redeem: $error');
      return const RedeemResult(false, '', null, null);
    }
  }
}