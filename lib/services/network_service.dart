// lib/services/network_service.dart

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';

class NetworkService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  Future<List<UserModel>> getNetwork() async {
    try {
      final callable = _functions.httpsCallable('getDownline');
      final result = await callable.call();

      final List<dynamic> networkData = result.data['downline'] ?? [];

      return networkData.map((data) {
        final Map<String, dynamic> userMap = Map<String, dynamic>.from(data);
        return UserModel.fromMap(userMap);
      }).toList();
    } on FirebaseFunctionsException catch (e, s) {
      // Improved logging for Firebase-specific errors
      debugPrint('Firebase Functions Error calling getDownline:');
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
    try {
      final callable = _functions.httpsCallable('getDownlineCounts');
      final result = await callable.call();

      if (result.data != null && result.data['counts'] != null) {
        final Map<String, dynamic> countsData =
            Map<String, dynamic>.from(result.data['counts']);
        return countsData
            .map((key, value) => MapEntry(key, (value as num).toInt()));
      }
      return {};
    } on FirebaseFunctionsException catch (e, s) {
      // Improved logging for Firebase-specific errors
      debugPrint('Firebase Functions Error calling getDownlineCounts:');
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
    try {
      final callable = _functions.httpsCallable('getFilteredDownline');
      final result = await callable.call({
        'filter': filter,
        'searchQuery': searchQuery,
        'levelOffset': levelOffset,
        'limit': limit,
        'offset': offset,
      });

      // Safely cast the result data
      final Map<String, dynamic> data = result.data is Map<String, dynamic>
          ? result.data as Map<String, dynamic>
          : Map<String, dynamic>.from(result.data ?? {});

      // Convert network array to UserModel objects
      final List<dynamic> networkData = data['downline'] ?? [];
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

      return {
        'network': networkUsers,
        'groupedByLevel': processedGroupedByLevel,
        'totalCount': data['totalCount'] ?? 0,
        'hasMore': data['hasMore'] ?? false,
        'offset': data['offset'] ?? 0,
        'limit': data['limit'] ?? limit,
      };
    } on FirebaseFunctionsException catch (e, s) {
      debugPrint('Firebase Functions Error calling getFilteredDownline:');
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
}
