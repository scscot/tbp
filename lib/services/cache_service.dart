// lib/services/cache_service.dart

import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Comprehensive caching service for admin settings and user profiles
/// Provides multi-layer caching with memory, persistent storage, and secure storage
class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  // ==============================
  // Storage Configuration
  // ==============================
  late SharedPreferences _prefs;
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  // ==============================
  // Memory Cache
  // ==============================
  final Map<String, dynamic> _memoryCache = {};
  final Map<String, DateTime> _memoryCacheTimestamps = {};

  // ==============================
  // Cache Configuration
  // ==============================
  static const Duration _shortCacheDuration = Duration(minutes: 5);
  static const Duration _mediumCacheDuration = Duration(minutes: 30);
  static const Duration _longCacheDuration = Duration(hours: 2);
  static const Duration _extendedCacheDuration = Duration(hours: 24);

  // Cache key prefixes
  static const String _adminSettingsPrefix = 'admin_settings_';
  static const String _userProfilePrefix = 'user_profile_';
  static const String _bizOppPrefix = 'biz_opp_';
  static const String _countriesPrefix = 'countries_';
  static const String _timestampSuffix = '_timestamp';

  bool _initialized = false;

  // ==============================
  // Initialization
  // ==============================
  Future<void> init() async {
    if (_initialized) return;

    try {
      _prefs = await SharedPreferences.getInstance();
      _initialized = true;
      debugPrint('✅ CACHE_SERVICE: Initialized successfully');
    } catch (e) {
      debugPrint('❌ CACHE_SERVICE: Initialization failed: $e');
      rethrow;
    }
  }

  // ==============================
  // Memory Cache Operations
  // ==============================
  void _setMemoryCache(String key, dynamic data, Duration? customDuration) {
    _memoryCache[key] = data;
    _memoryCacheTimestamps[key] = DateTime.now();
    debugPrint('💾 CACHE_SERVICE: Memory cache set for key: $key');
  }

  T? _getMemoryCache<T>(String key, Duration cacheDuration) {
    if (!_memoryCache.containsKey(key) || !_memoryCacheTimestamps.containsKey(key)) {
      return null;
    }

    final cacheTime = _memoryCacheTimestamps[key]!;
    final now = DateTime.now();

    if (now.difference(cacheTime) > cacheDuration) {
      _clearMemoryCacheKey(key);
      return null;
    }

    debugPrint('🎯 CACHE_SERVICE: Memory cache hit for key: $key');
    return _memoryCache[key] as T?;
  }

  void _clearMemoryCacheKey(String key) {
    _memoryCache.remove(key);
    _memoryCacheTimestamps.remove(key);
  }

  // ==============================
  // Persistent Cache Operations
  // ==============================
  Future<void> _setPersistentCache(String key, Map<String, dynamic> data, {bool secure = false}) async {
    await _ensureInitialized();

    try {
      final jsonString = json.encode(data);
      final timestampKey = key + _timestampSuffix;
      final timestamp = DateTime.now().millisecondsSinceEpoch;

      if (secure) {
        await _secureStorage.write(key: key, value: jsonString);
        await _secureStorage.write(key: timestampKey, value: timestamp.toString());
      } else {
        await _prefs.setString(key, jsonString);
        await _prefs.setInt(timestampKey, timestamp);
      }

      debugPrint('💾 CACHE_SERVICE: Persistent cache set for key: $key (secure: $secure)');
    } catch (e) {
      debugPrint('❌ CACHE_SERVICE: Failed to set persistent cache for $key: $e');
    }
  }

  Future<Map<String, dynamic>?> _getPersistentCache(String key, Duration cacheDuration, {bool secure = false}) async {
    await _ensureInitialized();

    try {
      final timestampKey = key + _timestampSuffix;

      String? jsonString;
      int? timestamp;

      if (secure) {
        jsonString = await _secureStorage.read(key: key);
        final timestampString = await _secureStorage.read(key: timestampKey);
        timestamp = timestampString != null ? int.tryParse(timestampString) : null;
      } else {
        jsonString = _prefs.getString(key);
        timestamp = _prefs.getInt(timestampKey);
      }

      if (jsonString == null || timestamp == null) {
        return null;
      }

      final cacheTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
      final now = DateTime.now();

      if (now.difference(cacheTime) > cacheDuration) {
        await _clearPersistentCacheKey(key, secure: secure);
        return null;
      }

      final data = json.decode(jsonString) as Map<String, dynamic>;
      debugPrint('🎯 CACHE_SERVICE: Persistent cache hit for key: $key (secure: $secure)');
      return data;
    } catch (e) {
      debugPrint('❌ CACHE_SERVICE: Failed to get persistent cache for $key: $e');
      return null;
    }
  }

  Future<void> _clearPersistentCacheKey(String key, {bool secure = false}) async {
    await _ensureInitialized();

    try {
      final timestampKey = key + _timestampSuffix;

      if (secure) {
        await _secureStorage.delete(key: key);
        await _secureStorage.delete(key: timestampKey);
      } else {
        await _prefs.remove(key);
        await _prefs.remove(timestampKey);
      }

      debugPrint('🧹 CACHE_SERVICE: Persistent cache cleared for key: $key (secure: $secure)');
    } catch (e) {
      debugPrint('❌ CACHE_SERVICE: Failed to clear persistent cache for $key: $e');
    }
  }

  // ==============================
  // Admin Settings Cache
  // ==============================
  Future<void> setAdminSettings(String adminUid, Map<String, dynamic> settings) async {
    final key = _adminSettingsPrefix + adminUid;

    // Set in both memory and persistent cache
    _setMemoryCache(key, settings, _mediumCacheDuration);
    await _setPersistentCache(key, settings);
  }

  Future<Map<String, dynamic>?> getAdminSettings(String adminUid) async {
    final key = _adminSettingsPrefix + adminUid;

    // Try memory cache first
    var data = _getMemoryCache<Map<String, dynamic>>(key, _mediumCacheDuration);
    if (data != null) return data;

    // Try persistent cache
    data = await _getPersistentCache(key, _longCacheDuration);
    if (data != null) {
      // Populate memory cache for faster subsequent access
      _setMemoryCache(key, data, _mediumCacheDuration);
      return data;
    }

    return null;
  }

  Future<void> clearAdminSettings(String adminUid) async {
    final key = _adminSettingsPrefix + adminUid;
    _clearMemoryCacheKey(key);
    await _clearPersistentCacheKey(key);
  }

  // ==============================
  // User Profile Cache
  // ==============================
  Future<void> setUserProfile(String userId, Map<String, dynamic> profile) async {
    final key = _userProfilePrefix + userId;

    // User profiles contain sensitive data - use secure storage
    _setMemoryCache(key, profile, _shortCacheDuration);
    await _setPersistentCache(key, profile, secure: true);
  }

  Future<Map<String, dynamic>?> getUserProfile(String userId) async {
    final key = _userProfilePrefix + userId;

    // Try memory cache first
    var data = _getMemoryCache<Map<String, dynamic>>(key, _shortCacheDuration);
    if (data != null) return data;

    // Try secure persistent cache
    data = await _getPersistentCache(key, _mediumCacheDuration, secure: true);
    if (data != null) {
      // Populate memory cache for faster subsequent access
      _setMemoryCache(key, data, _shortCacheDuration);
      return data;
    }

    return null;
  }

  Future<void> clearUserProfile(String userId) async {
    final key = _userProfilePrefix + userId;
    _clearMemoryCacheKey(key);
    await _clearPersistentCacheKey(key, secure: true);
  }

  // ==============================
  // Business Opportunity Cache
  // ==============================
  Future<void> setBizOpp(String adminUid, String bizOpp) async {
    final key = _bizOppPrefix + adminUid;
    final data = {'biz_opp': bizOpp, 'admin_uid': adminUid};

    _setMemoryCache(key, data, _longCacheDuration);
    await _setPersistentCache(key, data);
  }

  Future<String?> getBizOpp(String adminUid) async {
    final key = _bizOppPrefix + adminUid;

    // Try memory cache first
    var data = _getMemoryCache<Map<String, dynamic>>(key, _longCacheDuration);
    if (data != null) return data['biz_opp'] as String?;

    // Try persistent cache
    data = await _getPersistentCache(key, _extendedCacheDuration);
    if (data != null) {
      _setMemoryCache(key, data, _longCacheDuration);
      return data['biz_opp'] as String?;
    }

    return null;
  }

  Future<void> clearBizOpp(String adminUid) async {
    final key = _bizOppPrefix + adminUid;
    _clearMemoryCacheKey(key);
    await _clearPersistentCacheKey(key);
  }

  // ==============================
  // Countries Cache
  // ==============================
  Future<void> setCountries(String adminUid, List<String> countries) async {
    final key = _countriesPrefix + adminUid;
    final data = {'countries': countries, 'admin_uid': adminUid};

    _setMemoryCache(key, data, _longCacheDuration);
    await _setPersistentCache(key, data);
  }

  Future<List<String>?> getCountries(String adminUid) async {
    final key = _countriesPrefix + adminUid;

    // Try memory cache first
    var data = _getMemoryCache<Map<String, dynamic>>(key, _longCacheDuration);
    if (data != null) {
      final countries = data['countries'] as List<dynamic>?;
      return countries?.map((c) => c.toString()).toList();
    }

    // Try persistent cache
    data = await _getPersistentCache(key, _extendedCacheDuration);
    if (data != null) {
      _setMemoryCache(key, data, _longCacheDuration);
      final countries = data['countries'] as List<dynamic>?;
      return countries?.map((c) => c.toString()).toList();
    }

    return null;
  }

  Future<void> clearCountries(String adminUid) async {
    final key = _countriesPrefix + adminUid;
    _clearMemoryCacheKey(key);
    await _clearPersistentCacheKey(key);
  }

  // ==============================
  // Bulk Operations
  // ==============================
  Future<void> clearAllUserData(String userId) async {
    await clearUserProfile(userId);
    debugPrint('🧹 CACHE_SERVICE: Cleared all user data for: $userId');
  }

  Future<void> clearAllAdminData(String adminUid) async {
    await clearAdminSettings(adminUid);
    await clearBizOpp(adminUid);
    await clearCountries(adminUid);
    debugPrint('🧹 CACHE_SERVICE: Cleared all admin data for: $adminUid');
  }

  Future<void> clearAllCache() async {
    await _ensureInitialized();

    // Clear memory cache
    _memoryCache.clear();
    _memoryCacheTimestamps.clear();

    // Clear persistent cache
    final keys = _prefs.getKeys().where((key) =>
      key.startsWith(_adminSettingsPrefix) ||
      key.startsWith(_bizOppPrefix) ||
      key.startsWith(_countriesPrefix) ||
      key.endsWith(_timestampSuffix)
    ).toList();

    for (final key in keys) {
      await _prefs.remove(key);
    }

    // Clear secure storage (user profiles)
    try {
      await _secureStorage.deleteAll();
    } catch (e) {
      debugPrint('⚠️ CACHE_SERVICE: Failed to clear all secure storage: $e');
    }

    debugPrint('🧹 CACHE_SERVICE: All cache cleared');
  }

  // ==============================
  // Cache Statistics & Maintenance
  // ==============================
  Map<String, dynamic> getCacheStats() {
    return {
      'memory_cache_size': _memoryCache.length,
      'memory_cache_keys': _memoryCache.keys.toList(),
      'initialized': _initialized,
    };
  }

  Future<void> performMaintenance() async {
    await _ensureInitialized();

    debugPrint('🔧 CACHE_SERVICE: Starting cache maintenance');

    // Clean expired memory cache entries
    final now = DateTime.now();
    final expiredMemoryKeys = <String>[];

    for (final entry in _memoryCacheTimestamps.entries) {
      if (now.difference(entry.value) > _longCacheDuration) {
        expiredMemoryKeys.add(entry.key);
      }
    }

    for (final key in expiredMemoryKeys) {
      _clearMemoryCacheKey(key);
    }

    debugPrint('🔧 CACHE_SERVICE: Maintenance complete - removed ${expiredMemoryKeys.length} expired memory entries');
  }

  // ==============================
  // Utilities
  // ==============================
  Future<void> _ensureInitialized() async {
    if (!_initialized) {
      await init();
    }
  }

  // ==============================
  // Offline Support
  // ==============================
  Future<bool> hasOfflineData(String key) async {
    await _ensureInitialized();
    return _prefs.containsKey(key) || await _secureStorage.containsKey(key: key);
  }

  Future<Map<String, dynamic>?> getOfflineAdminSettings(String adminUid) async {
    final key = _adminSettingsPrefix + adminUid;
    return await _getPersistentCache(key, _extendedCacheDuration);
  }

  Future<Map<String, dynamic>?> getOfflineUserProfile(String userId) async {
    final key = _userProfilePrefix + userId;
    return await _getPersistentCache(key, _extendedCacheDuration, secure: true);
  }
}