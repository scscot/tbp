// lib/services/downline_service.dart

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';

class DownlineService {
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

  Future<List<UserModel>> getDownline() async {
    try {
      final callable = _functions.httpsCallable('getDownline');
      final result = await callable.call();

      final List<dynamic> downlineData = result.data['downline'] ?? [];

      return downlineData.map((data) {
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
          'An unexpected error occurred in DownlineService.getDownline: $e');
      debugPrint('Stacktrace: $s');
      rethrow;
    }
  }

  Future<Map<String, int>> getDownlineCounts() async {
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
          'An unexpected error occurred in DownlineService.getDownlineCounts: $e');
      debugPrint('Stacktrace: $s');
      rethrow;
    }
  }
}
