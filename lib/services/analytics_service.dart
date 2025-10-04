import 'package:flutter/foundation.dart';

class AnalyticsService {
  void logEvent(String name, Map<String, dynamic> params) {
    debugPrint('Analytics event: $name, data: $params');
  }

  void logInviteLinkPasteClicked() {
    logEvent('invite_link_paste_clicked', {
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void logInviteLinkParseSuccess({required int tokenLength}) {
    logEvent('invite_link_parse_success', {
      'token_length': tokenLength,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void logInviteLinkParseFailure({required String reason}) {
    logEvent('invite_link_parse_failure', {
      'reason': reason,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }
}
