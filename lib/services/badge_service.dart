// lib/services/badge_service.dart
import 'package:flutter_app_badger/flutter_app_badger.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class BadgeService {
  /// Clears the app badge count on the device.
  static Future<void> clearBadge() async {
    try {
      if (await FlutterAppBadger.isAppBadgeSupported()) {
        FlutterAppBadger.removeBadge();
        if (kDebugMode) {
          print('✅ BadgeService: Badge cleared successfully.');
        }
      } else {
        if (kDebugMode) {
          print('⚠️ BadgeService: App badge not supported on this device.');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ BadgeService: Failed to clear badge: $e');
      }
    }
  }

  /// Updates the badge count to the specified [count].
  static Future<void> updateBadgeCount(int count) async {
    try {
      if (await FlutterAppBadger.isAppBadgeSupported()) {
        if (count > 0) {
          FlutterAppBadger.updateBadgeCount(count);
          if (kDebugMode) {
            print('✅ BadgeService: Badge updated to $count.');
          }
        } else {
          await clearBadge();
        }
      } else {
        if (kDebugMode) {
          print('⚠️ BadgeService: App badge not supported on this device.');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ BadgeService: Failed to update badge: $e');
      }
    }
  }
}
