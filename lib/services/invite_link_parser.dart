import 'package:flutter/foundation.dart';

class InviteLinkParseResult {
  final bool success;
  final String? referralCode;
  final String? queryType;
  final String? failureReason;

  const InviteLinkParseResult({
    required this.success,
    this.referralCode,
    this.queryType,
    this.failureReason,
  });

  factory InviteLinkParseResult.success(String code, String type) {
    return InviteLinkParseResult(
      success: true,
      referralCode: code,
      queryType: type,
    );
  }

  factory InviteLinkParseResult.failure(String reason) {
    return InviteLinkParseResult(
      success: false,
      failureReason: reason,
    );
  }
}

class InviteLinkParser {
  static const List<String> _firstPartyHosts = [
    'teambuildpro.com',
    'www.teambuildpro.com',
    'go.teambuildpro.com',
  ];

  static InviteLinkParseResult parse(String rawText) {
    if (rawText.isEmpty) {
      return InviteLinkParseResult.failure('empty_input');
    }

    String normalized = _normalizeText(rawText);

    if (kDebugMode) {
      debugPrint('🔗 InviteLinkParser: Input: $rawText');
      debugPrint('🔗 InviteLinkParser: Normalized: $normalized');
    }

    Uri? uri;
    try {
      uri = Uri.parse(normalized);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ InviteLinkParser: Malformed URI: $e');
      }
      return InviteLinkParseResult.failure('malformed_uri');
    }

    if (uri.scheme == 'teambuildpro') {
      return _extractReferralFromUri(uri);
    }

    if ((uri.scheme == 'http' || uri.scheme == 'https') &&
        _firstPartyHosts.contains(uri.host.toLowerCase())) {
      return _extractReferralFromUri(uri);
    }

    if (kDebugMode) {
      debugPrint('❌ InviteLinkParser: Unrecognized host: ${uri.host}');
    }
    return InviteLinkParseResult.failure('unrecognized_host');
  }

  static String _normalizeText(String raw) {
    String text = raw.trim();

    text = text.replaceAll(RegExp(r'[)\]}\.,]+$'), '');

    text = Uri.decodeFull(text);

    if (!text.contains('://')) {
      for (final host in _firstPartyHosts) {
        if (text.toLowerCase().startsWith(host)) {
          text = 'https://$text';
          break;
        }
      }
    }

    return text;
  }

  static InviteLinkParseResult _extractReferralFromUri(Uri uri) {
    final ref = uri.queryParameters['ref']?.trim();
    final newParam = uri.queryParameters['new']?.trim();

    if (ref != null && ref.isNotEmpty) {
      if (kDebugMode) {
        debugPrint('✅ InviteLinkParser: Found ref=$ref');
      }
      return InviteLinkParseResult.success(ref, 'ref');
    }

    if (newParam != null && newParam.isNotEmpty) {
      if (kDebugMode) {
        debugPrint('✅ InviteLinkParser: Found new=$newParam');
      }
      return InviteLinkParseResult.success(newParam, 'new');
    }

    if (kDebugMode) {
      debugPrint('❌ InviteLinkParser: No ref or new query param found');
    }
    return InviteLinkParseResult.failure('no_query_param');
  }
}
