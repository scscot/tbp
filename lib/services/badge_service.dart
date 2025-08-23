// lib/services/badge_service.dart
import 'package:app_badge_plus/app_badge_plus.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class BadgeService {
  /// Clears the app badge count on the device.
  static Future<void> clearBadge() async {
    try {
      if (await AppBadgePlus.isSupported()) {
        await AppBadgePlus.updateBadge(0);
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
      if (await AppBadgePlus.isSupported()) {
        await AppBadgePlus.updateBadge(count);
        if (kDebugMode) {
          print('✅ BadgeService: Badge updated to $count.');
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
