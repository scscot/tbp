// lib/services/admin_settings_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

class AdminSettingsService {
  static final AdminSettingsService _instance = AdminSettingsService._internal();
  factory AdminSettingsService() => _instance;
  AdminSettingsService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;

  // Cache for admin settings to reduce Firebase calls
  final Map<String, Map<String, dynamic>> _cache = {};
  final Map<String, DateTime> _cacheTimestamps = {};
  static const Duration _cacheTimeout = Duration(minutes: 5);

  /// Get admin settings with caching
  /// For admin users, use their own UID
  /// For regular users, use their upline_admin
  Future<Map<String, dynamic>?> getAdminSettings(String? adminUid) async {
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint('🔧 ADMIN_SETTINGS: No admin UID provided');
      return null;
    }

    try {
      // Check cache first
      final now = DateTime.now();
      final cacheKey = adminUid;

      if (_cache.containsKey(cacheKey) && _cacheTimestamps.containsKey(cacheKey)) {
        final cacheTime = _cacheTimestamps[cacheKey]!;
        if (now.difference(cacheTime) < _cacheTimeout) {
          debugPrint('🔧 ADMIN_SETTINGS: Returning cached data for admin $adminUid');
          return _cache[cacheKey];
        }
      }

      debugPrint('🔧 ADMIN_SETTINGS: Fetching admin settings for $adminUid');

      final adminSettingsDoc = await _db
          .collection('admin_settings')
          .doc(adminUid)
          .get();

      if (adminSettingsDoc.exists) {
        final data = adminSettingsDoc.data()!;

        // Cache the result
        _cache[cacheKey] = data;
        _cacheTimestamps[cacheKey] = now;

        debugPrint('🔧 ADMIN_SETTINGS: Successfully fetched and cached admin settings');
        return data;
      } else {
        debugPrint('🔧 ADMIN_SETTINGS: Admin settings document not found for $adminUid');
        return null;
      }
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error fetching admin settings for $adminUid: $e');
      return null;
    }
  }

  /// Get business opportunity name with fallback
  Future<String> getBizOppName(String? adminUid, {String fallback = 'your opportunity'}) async {
    try {
      final adminSettings = await getAdminSettings(adminUid);
      final bizOpp = adminSettings?['biz_opp'] as String?;

      if (bizOpp != null && bizOpp.trim().isNotEmpty) {
        return bizOpp.trim();
      }

      return fallback;
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error getting biz_opp name: $e');
      return fallback;
    }
  }

  /// Get available countries list
  Future<List<String>> getAvailableCountries(String? adminUid) async {
    try {
      final adminSettings = await getAdminSettings(adminUid);
      final countries = adminSettings?['countries'] as List<dynamic>?;

      if (countries != null && countries.isNotEmpty) {
        return countries.map((country) => country.toString()).toList();
      }

      return [];
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error getting countries: $e');
      return [];
    }
  }

  /// Clear cache for specific admin (useful when admin settings are updated)
  void clearCache(String adminUid) {
    _cache.remove(adminUid);
    _cacheTimestamps.remove(adminUid);
    debugPrint('🧹 ADMIN_SETTINGS: Cache cleared for admin $adminUid');
  }

  /// Clear all cache (useful for logout or complete refresh)
  void clearAllCache() {
    _cache.clear();
    _cacheTimestamps.clear();
    debugPrint('🧹 ADMIN_SETTINGS: All cache cleared');
  }

  /// Preload admin settings (useful for performance optimization)
  Future<void> preloadAdminSettings(String adminUid) async {
    await getAdminSettings(adminUid);
  }
}