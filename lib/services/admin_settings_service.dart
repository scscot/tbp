// lib/services/admin_settings_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'cache_service.dart';

class AdminSettingsService {
  static final AdminSettingsService _instance = AdminSettingsService._internal();
  factory AdminSettingsService() => _instance;
  AdminSettingsService._internal();

  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final CacheService _cacheService = CacheService();

  // Legacy memory cache for backward compatibility
  final Map<String, Map<String, dynamic>> _cache = {};
  final Map<String, DateTime> _cacheTimestamps = {};
  static const Duration _cacheTimeout = Duration(minutes: 5);

  /// Get admin settings with enhanced multi-layer caching
  /// For admin users, use their own UID
  /// For regular users, use their upline_admin
  Future<Map<String, dynamic>?> getAdminSettings(String? adminUid) async {
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint('🔧 ADMIN_SETTINGS: No admin UID provided');
      return null;
    }

    try {
      // Initialize cache service
      await _cacheService.init();

      // Try comprehensive cache first (memory + persistent)
      var cachedData = await _cacheService.getAdminSettings(adminUid);
      if (cachedData != null) {
        debugPrint('🔧 ADMIN_SETTINGS: Returning cached data for admin $adminUid');
        return cachedData;
      }

      // Fallback to legacy cache for backward compatibility
      final now = DateTime.now();
      final cacheKey = adminUid;

      if (_cache.containsKey(cacheKey) && _cacheTimestamps.containsKey(cacheKey)) {
        final cacheTime = _cacheTimestamps[cacheKey]!;
        if (now.difference(cacheTime) < _cacheTimeout) {
          debugPrint('🔧 ADMIN_SETTINGS: Returning legacy cached data for admin $adminUid');
          final data = _cache[cacheKey]!;
          // Migrate to new cache
          await _cacheService.setAdminSettings(adminUid, data);
          return data;
        }
      }

      debugPrint('🔧 ADMIN_SETTINGS: Fetching admin settings for $adminUid');

      final adminSettingsDoc = await _db
          .collection('admin_settings')
          .doc(adminUid)
          .get();

      if (adminSettingsDoc.exists) {
        final data = adminSettingsDoc.data()!;

        // Cache in both legacy and new cache systems
        _cache[cacheKey] = data;
        _cacheTimestamps[cacheKey] = now;
        await _cacheService.setAdminSettings(adminUid, data);

        debugPrint('🔧 ADMIN_SETTINGS: Successfully fetched and cached admin settings');
        return data;
      } else {
        debugPrint('🔧 ADMIN_SETTINGS: Admin settings document not found for $adminUid');
        return null;
      }
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error fetching admin settings for $adminUid: $e');

      // Try offline cache as fallback
      try {
        final offlineData = await _cacheService.getOfflineAdminSettings(adminUid);
        if (offlineData != null) {
          debugPrint('🔧 ADMIN_SETTINGS: Returning offline cached data for admin $adminUid');
          return offlineData;
        }
      } catch (offlineError) {
        debugPrint('❌ ADMIN_SETTINGS: Offline cache also failed: $offlineError');
      }

      return null;
    }
  }

  /// Get business opportunity name with enhanced caching and fallback
  Future<String> getBizOppName(String? adminUid, {String fallback = 'your opportunity'}) async {
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint('🔧 ADMIN_SETTINGS: No admin UID provided, using fallback: $fallback');
      return fallback;
    }

    try {
      // Initialize cache service
      await _cacheService.init();

      // Try dedicated biz_opp cache first
      var cachedBizOpp = await _cacheService.getBizOpp(adminUid);
      if (cachedBizOpp != null && cachedBizOpp.trim().isNotEmpty) {
        debugPrint('🔧 ADMIN_SETTINGS: Returning cached biz_opp for admin $adminUid');
        return cachedBizOpp.trim();
      }

      // Fallback to admin settings
      final adminSettings = await getAdminSettings(adminUid);
      final bizOpp = adminSettings?['biz_opp'] as String?;

      if (bizOpp != null && bizOpp.trim().isNotEmpty) {
        // Cache the biz_opp for faster future access
        await _cacheService.setBizOpp(adminUid, bizOpp.trim());
        return bizOpp.trim();
      }

      debugPrint('🔧 ADMIN_SETTINGS: No biz_opp found for admin $adminUid, using fallback: $fallback');
      return fallback;
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error getting biz_opp name: $e');
      return fallback;
    }
  }

  /// Get available countries list with enhanced caching
  Future<List<String>> getAvailableCountries(String? adminUid) async {
    if (adminUid == null || adminUid.isEmpty) {
      return [];
    }

    try {
      // Initialize cache service
      await _cacheService.init();

      // Try dedicated countries cache first
      var cachedCountries = await _cacheService.getCountries(adminUid);
      if (cachedCountries != null && cachedCountries.isNotEmpty) {
        debugPrint('🔧 ADMIN_SETTINGS: Returning cached countries for admin $adminUid');
        return cachedCountries;
      }

      // Fallback to admin settings
      final adminSettings = await getAdminSettings(adminUid);
      final countries = adminSettings?['countries'] as List<dynamic>?;

      if (countries != null && countries.isNotEmpty) {
        final countryList = countries.map((country) => country.toString()).toList();
        // Cache the countries for faster future access
        await _cacheService.setCountries(adminUid, countryList);
        return countryList;
      }

      return [];
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error getting countries: $e');
      return [];
    }
  }

  /// Clear cache for specific admin (useful when admin settings are updated)
  Future<void> clearCache(String adminUid) async {
    // Clear legacy cache
    _cache.remove(adminUid);
    _cacheTimestamps.remove(adminUid);

    // Clear comprehensive cache
    try {
      await _cacheService.init();
      await _cacheService.clearAllAdminData(adminUid);
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error clearing comprehensive cache: $e');
    }

    debugPrint('🧹 ADMIN_SETTINGS: Cache cleared for admin $adminUid');
  }

  /// Clear all cache (useful for logout or complete refresh)
  Future<void> clearAllCache() async {
    // Clear legacy cache
    _cache.clear();
    _cacheTimestamps.clear();

    // Clear comprehensive cache
    try {
      await _cacheService.init();
      await _cacheService.clearAllCache();
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error clearing all comprehensive cache: $e');
    }

    debugPrint('🧹 ADMIN_SETTINGS: All cache cleared');
  }

  /// Preload admin settings (useful for performance optimization)
  Future<void> preloadAdminSettings(String adminUid) async {
    await getAdminSettings(adminUid);
  }

  /// Get cache statistics for debugging
  Future<Map<String, dynamic>> getCacheStats() async {
    try {
      await _cacheService.init();
      final comprehensiveStats = _cacheService.getCacheStats();

      return {
        'legacy_cache_size': _cache.length,
        'legacy_cache_keys': _cache.keys.toList(),
        'comprehensive_cache': comprehensiveStats,
      };
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error getting cache stats: $e');
      return {
        'legacy_cache_size': _cache.length,
        'legacy_cache_keys': _cache.keys.toList(),
        'error': e.toString(),
      };
    }
  }

  /// Perform cache maintenance
  Future<void> performCacheMaintenance() async {
    try {
      await _cacheService.init();
      await _cacheService.performMaintenance();
    } catch (e) {
      debugPrint('❌ ADMIN_SETTINGS: Error performing cache maintenance: $e');
    }
  }
}