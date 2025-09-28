// lib/services/network_service.dart

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';
import '../models/user_model.dart';

/// Cached result wrapper with timestamp for expiration checking
class CachedResult<T> {
  final T data;
  final DateTime timestamp;
  final String cacheKey;

  CachedResult(this.data, this.timestamp, this.cacheKey);

  /// Check if cache is expired based on duration in minutes
  bool isExpired(int durationMinutes) {
    return DateTime.now().difference(timestamp).inMinutes >= durationMinutes;
  }

  /// Get age of cache in minutes
  int getAgeMinutes() {
    return DateTime.now().difference(timestamp).inMinutes;
  }
}

class NetworkService {
  final FirebaseFunctions _functions =
      FirebaseFunctions.instanceFor(region: 'us-central1');

  // Static cache storage - survives widget rebuilds but clears on app restart
  static final Map<String, CachedResult> _cache = {};

  // Cache configuration
  static const int _networkCountsCacheDuration = 5; // 5 minutes
  static const int _filteredNetworkCacheDuration = 3; // 3 minutes
  static const int _fullNetworkCacheDuration = 10; // 10 minutes
  static const int _maxCacheSize = 50; // Maximum number of cached items

  /// Get current user ID for cache key generation
  String? get _currentUserId => FirebaseAuth.instance.currentUser?.uid;

  /// Generate cache key with user context
  String _generateCacheKey(String operation, [Map<String, dynamic>? params]) {
    final userId = _currentUserId ?? 'anonymous';
    if (params == null || params.isEmpty) {
      return '${operation}_$userId';
    }

    // Create deterministic key from parameters
    final sortedParams = Map.fromEntries(
        params.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
    final paramString =
        sortedParams.entries.map((e) => '${e.key}:${e.value}').join('|');

    return '${operation}_${userId}_${paramString.hashCode}';
  }

  /// Clean up expired cache entries and enforce size limits
  void _cleanupCache() {
    if (_cache.length <= _maxCacheSize) return;

    // Remove expired entries first
    final expiredKeys = <String>[];
    _cache.forEach((key, cached) {
      if (cached.isExpired(15)) {
        // Remove anything older than 15 minutes
        expiredKeys.add(key);
      }
    });

    for (final key in expiredKeys) {
      _cache.remove(key);
      if (kDebugMode) {
        debugPrint('🗑️ CACHE: Removed expired cache entry: $key');
      }
    }

    // If still over limit, remove oldest entries
    if (_cache.length > _maxCacheSize) {
      final sortedEntries = _cache.entries.toList()
        ..sort((a, b) => a.value.timestamp.compareTo(b.value.timestamp));

      final entriesToRemove = sortedEntries.take(_cache.length - _maxCacheSize);
      for (final entry in entriesToRemove) {
        _cache.remove(entry.key);
        if (kDebugMode) {
          debugPrint('🗑️ CACHE: Removed old cache entry: ${entry.key}');
        }
      }
    }
  }

  /// Get cached result if available and not expired
  T? _getCachedResult<T>(String cacheKey, int cacheDurationMinutes) {
    final cached = _cache[cacheKey];
    if (cached != null && !cached.isExpired(cacheDurationMinutes)) {
      if (kDebugMode) {
        debugPrint(
            '✅ CACHE HIT: $cacheKey (age: ${cached.getAgeMinutes()}min)');
      }
      return cached.data as T?;
    }

    if (cached != null && kDebugMode) {
      debugPrint(
          '⏰ CACHE EXPIRED: $cacheKey (age: ${cached.getAgeMinutes()}min)');
    }

    return null;
  }

  /// Store result in cache
  void _setCachedResult<T>(String cacheKey, T data) {
    _cleanupCache();
    _cache[cacheKey] = CachedResult(data, DateTime.now(), cacheKey);
    if (kDebugMode) {
      debugPrint(
          '💾 CACHE STORED: $cacheKey (total entries: ${_cache.length})');
    }
  }

  /// Clear all cache entries for current user
  void clearUserCache() {
    final userId = _currentUserId;
    if (userId == null) return;

    final keysToRemove =
        _cache.keys.where((key) => key.contains(userId)).toList();

    for (final key in keysToRemove) {
      _cache.remove(key);
    }

    if (kDebugMode) {
      debugPrint(
          '🧹 CACHE: Cleared ${keysToRemove.length} entries for user $userId');
    }
  }

  /// Clear specific cache entry
  void clearCache(String operation, [Map<String, dynamic>? params]) {
    final cacheKey = _generateCacheKey(operation, params);
    _cache.remove(cacheKey);
    if (kDebugMode) {
      debugPrint('🧹 CACHE: Cleared cache for $cacheKey');
    }
  }

  /// Clear all cache entries (use sparingly)
  static void clearAllCache() {
    _cache.clear();
    if (kDebugMode) {
      debugPrint('🧹 CACHE: Cleared all cache entries');
    }
  }

  /// Get cache statistics for debugging
  Map<String, dynamic> getCacheStats() {
    final now = DateTime.now();
    final stats = <String, dynamic>{
      'totalEntries': _cache.length,
      'maxSize': _maxCacheSize,
      'entries': <Map<String, dynamic>>[],
    };

    _cache.forEach((key, cached) {
      stats['entries'].add({
        'key': key,
        'ageMinutes': now.difference(cached.timestamp).inMinutes,
        'size': cached.data.toString().length, // Rough size estimate
      });
    });

    return stats;
  }

  Future<List<UserModel>> getNetwork() async {
    final cacheKey = _generateCacheKey('network');

    // Try to get from cache first
    final cached =
        _getCachedResult<List<UserModel>>(cacheKey, _fullNetworkCacheDuration);
    if (cached != null) {
      return cached;
    }

    if (kDebugMode) {
      debugPrint('🌐 NETWORK: Cache miss, fetching from server...');
    }

    try {
      final callable = _functions.httpsCallable('getNetwork');
      final result = await callable.call();

      final List<dynamic> networkData = result.data['network'] ?? [];

      final networkUsers = networkData.map((data) {
        final Map<String, dynamic> userMap = Map<String, dynamic>.from(data);
        return UserModel.fromMap(userMap);
      }).toList();

      // Cache the result
      _setCachedResult(cacheKey, networkUsers);

      if (kDebugMode) {
        debugPrint(
            '✅ NETWORK: Fetched ${networkUsers.length} users from server');
      }

      return networkUsers;
    } on FirebaseFunctionsException catch (e, s) {
      // Improved logging for Firebase-specific errors
      debugPrint('Firebase Functions Error calling getNetwork:');
      debugPrint('Code: ${e.code}');
      debugPrint('Message: ${e.message}');
      debugPrint('Details: ${e.details}');
      debugPrint('Stacktrace: $s');
      // Re-throwing the exception preserves the original error type for upstream handling
      rethrow;
    } catch (e, s) {
      // Improved logging for any other unexpected errors
      debugPrint(
          'An unexpected error occurred in NetworkService.getNetwork: $e');
      debugPrint('Stacktrace: $s');
      rethrow;
    }
  }

  Future<Map<String, int>> getNetworkCounts() async {
    final cacheKey = _generateCacheKey('networkCounts');

    // Try to get from cache first
    final cached = _getCachedResult<Map<String, int>>(
        cacheKey, _networkCountsCacheDuration);
    if (cached != null) {
      return cached;
    }

    if (kDebugMode) {
      debugPrint('📊 COUNTS: Cache miss, fetching from server...');
    }

    try {
      final callable = _functions.httpsCallable('getNetworkCounts');
      final result = await callable.call();

      Map<String, int> counts = {};
      if (result.data != null && result.data['counts'] != null) {
        final Map<String, dynamic> countsData =
            Map<String, dynamic>.from(result.data['counts']);
        counts = countsData
            .map((key, value) => MapEntry(key, (value as num).toInt()));
      }

      // Cache the result
      _setCachedResult(cacheKey, counts);

      if (kDebugMode) {
        debugPrint(
            '✅ COUNTS: Fetched counts from server including newMembersYesterday: $counts');
      }

      return counts;
    } on FirebaseFunctionsException catch (e, s) {
      // Improved logging for Firebase-specific errors
      debugPrint('Firebase Functions Error calling getNetworkCounts:');
      debugPrint('Code: ${e.code}');
      debugPrint('Message: ${e.message}');
      debugPrint('Details: ${e.details}');
      debugPrint('Stacktrace: $s');
      rethrow;
    } catch (e, s) {
      // Improved logging for any other unexpected errors
      debugPrint(
          'An unexpected error occurred in NetworkService.getNetworkCounts: $e');
      debugPrint('Stacktrace: $s');
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getFilteredNetwork({
    String filter = 'all',
    String searchQuery = '',
    int? levelOffset,
    int limit = 100,
    int offset = 0,
  }) async {
    final params = {
      'filter': filter,
      'searchQuery': searchQuery,
      'levelOffset': levelOffset,
      'limit': limit,
      'offset': offset,
    };
    final cacheKey = _generateCacheKey('filteredNetwork', params);

    // Try to get from cache first
    final cached = _getCachedResult<Map<String, dynamic>>(
        cacheKey, _filteredNetworkCacheDuration);
    if (cached != null) {
      return cached;
    }

    if (kDebugMode) {
      debugPrint(
          '🔍 FILTERED: Cache miss, fetching from server (filter: $filter, search: "$searchQuery")...');
    }

    try {
      final callable = _functions.httpsCallable('getFilteredNetwork');
      final result = await callable.call(params);

      // Safely cast the result data
      final Map<String, dynamic> data = result.data is Map<String, dynamic>
          ? result.data as Map<String, dynamic>
          : Map<String, dynamic>.from(result.data ?? {});

      // Convert team array to UserModel objects
      final List<dynamic> networkData = data['network'] ?? [];
      final List<UserModel> networkUsers = networkData.map((userData) {
        final Map<String, dynamic> userMap = userData is Map<String, dynamic>
            ? userData
            : Map<String, dynamic>.from(userData ?? {});
        return UserModel.fromMap(userMap);
      }).toList();

      // Safely handle groupedByLevel data
      Map<int, List<UserModel>>? processedGroupedByLevel;
      if (data['groupedByLevel'] != null) {
        final rawGrouped = data['groupedByLevel'];
        if (rawGrouped is Map) {
          processedGroupedByLevel = <int, List<UserModel>>{};
          rawGrouped.forEach((key, value) {
            final levelKey = int.tryParse(key.toString()) ?? 0;
            if (value is List) {
              final levelUsers = value.map((userData) {
                final Map<String, dynamic> userMap =
                    userData is Map<String, dynamic>
                        ? userData
                        : Map<String, dynamic>.from(userData ?? {});
                return UserModel.fromMap(userMap);
              }).toList();
              processedGroupedByLevel![levelKey] = levelUsers;
            }
          });
        }
      }

      final processedData = {
        'network': networkUsers,
        'groupedByLevel': processedGroupedByLevel,
        'totalCount': data['totalCount'] ?? 0,
        'hasMore': data['hasMore'] ?? false,
        'offset': data['offset'] ?? 0,
        'limit': data['limit'] ?? limit,
      };

      // Cache the result
      _setCachedResult(cacheKey, processedData);

      if (kDebugMode) {
        debugPrint(
            '✅ FILTERED: Fetched ${networkUsers.length} users from server (total: ${data['totalCount']})');
      }

      return processedData;
    } on FirebaseFunctionsException catch (e, s) {
      debugPrint('Firebase Functions Error calling getFilteredNetwork:');
      debugPrint('Code: ${e.code}');
      debugPrint('Message: ${e.message}');
      debugPrint('Details: ${e.details}');
      debugPrint('Stacktrace: $s');
      rethrow;
    } catch (e, s) {
      debugPrint(
          'An unexpected error occurred in NetworkService.getFilteredNetwork: $e');
      debugPrint('Stacktrace: $s');
      rethrow;
    }
  }

  /// Force refresh network counts (bypasses cache)
  Future<Map<String, int>> refreshNetworkCounts() async {
    final cacheKey = _generateCacheKey('networkCounts');
    _cache.remove(cacheKey);
    if (kDebugMode) {
      debugPrint('🔄 REFRESH: Force refreshing network counts...');
    }
    return getNetworkCounts();
  }

  /// Force refresh filtered network (bypasses cache)
  Future<Map<String, dynamic>> refreshFilteredNetwork({
    String filter = 'all',
    String searchQuery = '',
    int? levelOffset,
    int limit = 100,
    int offset = 0,
  }) async {
    final params = {
      'filter': filter,
      'searchQuery': searchQuery,
      'levelOffset': levelOffset,
      'limit': limit,
      'offset': offset,
    };
    final cacheKey = _generateCacheKey('filteredNetwork', params);
    _cache.remove(cacheKey);
    if (kDebugMode) {
      debugPrint('🔄 REFRESH: Force refreshing filtered network...');
    }
    return getFilteredNetwork(
      filter: filter,
      searchQuery: searchQuery,
      levelOffset: levelOffset,
      limit: limit,
      offset: offset,
    );
  }

  // Real-time user document listener for cache invalidation
  StreamSubscription<DocumentSnapshot>? _userDocListener;
  Map<String, dynamic>? _previousUserData;

  /// Start listening to current user's document for real-time count updates
  void startUserDocumentListener({
    required Function() onCountsChanged,
  }) {
    final userId = _currentUserId;
    if (userId == null) {
      if (kDebugMode) {
        debugPrint('⚠️ REALTIME: Cannot start listener - no authenticated user');
      }
      return;
    }

    // Stop existing listener if any
    stopUserDocumentListener();

    if (kDebugMode) {
      debugPrint('🔄 REALTIME: Starting user document listener for $userId');
    }

    _userDocListener = FirebaseFirestore.instance
        .collection('users')
        .doc(userId)
        .snapshots()
        .listen((DocumentSnapshot snapshot) {
      if (!snapshot.exists) return;

      final currentData = snapshot.data() as Map<String, dynamic>?;
      if (currentData == null) return;

      // Check if relevant count fields have changed
      if (_previousUserData != null) {
        final previousDirectCount = _previousUserData!['directSponsorCount'] as int? ?? 0;
        final currentDirectCount = currentData['directSponsorCount'] as int? ?? 0;
        final previousTotalCount = _previousUserData!['totalTeamCount'] as int? ?? 0;
        final currentTotalCount = currentData['totalTeamCount'] as int? ?? 0;

        if (previousDirectCount != currentDirectCount ||
            previousTotalCount != currentTotalCount) {
          if (kDebugMode) {
            debugPrint('🔄 REALTIME: Count changes detected!');
            debugPrint('  - Direct sponsors: $previousDirectCount → $currentDirectCount');
            debugPrint('  - Total team: $previousTotalCount → $currentTotalCount');
          }

          // CRITICAL FIX: Only trigger UI updates for legitimate count increases
          // that come from completed profiles, not partial registrations
          final isLegitimateIncrease = (currentDirectCount > previousDirectCount) ||
                                     (currentTotalCount > previousTotalCount);

          if (isLegitimateIncrease) {
            if (kDebugMode) {
              debugPrint('✅ REALTIME: Legitimate count increase - updating UI');
            }

            // Invalidate network counts cache to force refresh
            _invalidateNetworkCountsCache();

            // Notify UI to refresh
            onCountsChanged();
          } else {
            if (kDebugMode) {
              debugPrint('⚠️ REALTIME: Count change detected but not triggering UI (might be correction/decrease)');
            }
          }
        }
      }

      _previousUserData = Map<String, dynamic>.from(currentData);
    }, onError: (error) {
      if (kDebugMode) {
        debugPrint('❌ REALTIME: Error in user document listener: $error');
      }
    });
  }

  /// Stop listening to user document changes
  void stopUserDocumentListener() {
    _userDocListener?.cancel();
    _userDocListener = null;
    _previousUserData = null;
    if (kDebugMode) {
      debugPrint('🛑 REALTIME: Stopped user document listener');
    }
  }

  /// Invalidate network counts cache to force refresh on next request
  void _invalidateNetworkCountsCache() {
    final cacheKey = _generateCacheKey('networkCounts');
    _cache.remove(cacheKey);
    if (kDebugMode) {
      debugPrint('🗑️ REALTIME: Invalidated network counts cache');
    }
  }

  /// Dispose method to clean up resources
  void dispose() {
    stopUserDocumentListener();
  }
}
