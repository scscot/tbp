import 'dart:io' show Platform;
import 'package:flutter/services.dart';

class TBPReferral {
  final String? ref;
  final String? tkn;
  final String? t;
  final String? v;
  const TBPReferral({this.ref, this.tkn, this.t, this.v});
}

class InstallReferrerBridge {
  static const _ch = MethodChannel('tbp/install_referrer');

  static Future<TBPReferral?> fetchOnce() async {
    if (!Platform.isAndroid) return null;
    final map = await _ch.invokeMethod<Map<dynamic, dynamic>?>('getInstallReferrer');
    if (map == null) return null;
    return TBPReferral(
      ref: map['ref'] as String?,
      tkn: map['tkn'] as String?,
      t:   map['t'] as String?,
      v:   map['v'] as String?,
    );
  }
}
