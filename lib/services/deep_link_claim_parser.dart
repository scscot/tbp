// lib/services/deep_link_claim_parser.dart
import 'dart:core';

class ClaimParams {
  final String? token;        // supports both `token` and short `tkn`
  final String? sponsorCode;  // `ref` or `new`
  final String? campaignType; // `t`

  const ClaimParams({this.token, this.sponsorCode, this.campaignType});

  bool get hasToken => (token != null && token!.isNotEmpty);
}

ClaimParams parseClaimParams(Uri uri) {
  // Accept either /claim?token=... or any URL with ?tkn=...
  final q = uri.queryParameters;
  final token = (q['token'] ?? q['tkn'])?.trim();
  final sponsor = (q['ref'] ?? q['new'])?.trim();
  final t = (q['t'] ?? '').trim();
  return ClaimParams(
    token: (token?.isEmpty ?? true) ? null : token,
    sponsorCode: (sponsor?.isEmpty ?? true) ? null : sponsor,
    campaignType: t.isEmpty ? null : t,
  );
}