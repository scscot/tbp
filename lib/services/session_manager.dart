// lib/services/session_manager.dart

import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';

class SessionManager {
  static final SessionManager instance = SessionManager();

  static const String _userKey = 'user';
  static const String _biometricKey = 'biometric_enabled';
  static const String _logoutTimeKey = 'last_logout_time';
  static const String _referralDataKey = 'referral_data';

  // --- The 'pending_referral_code' keys and methods have been removed ---

  Future<void> setCurrentUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    final userMap = jsonEncode(user.toJsonMap());
    await prefs.setString(_userKey, userMap);
    if (kDebugMode) {
      debugPrint(
          '📂 SessionManager — User session saved with UID: ${user.uid}');
    }
  }

  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_userKey);
    if (userData == null) {
      if (kDebugMode) {
        debugPrint('⚠️ SessionManager — No session data found');
      }
      return null;
    }
    try {
      final map = jsonDecode(userData);
      final user = UserModel.fromMap(map);
      if (kDebugMode) {
        debugPrint('✅ SessionManager — Loaded user: ${user.uid}');
      }
      return user;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ SessionManager — Error decoding user: $e');
      }
      return null;
    }
  }

  /// Clears all session, biometric, and referral data.
  Future<void> clearAllData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await prefs.remove(_biometricKey);
    await prefs.remove(_logoutTimeKey);
    await prefs.remove(_referralDataKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — All session and referral data cleared');
    }
  }

  /// Clears only logout time and referral data, preserving user data and biometric settings for biometric login
  Future<void> clearLogoutData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_logoutTimeKey);
    await prefs.remove(_referralDataKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — Logout and referral data cleared (preserving user and biometric data)');
    }
  }

  // --- Biometric and Logout time methods remain the same ---

  /// Caches data for a successfully validated referral code.
  Future<void> setReferralData(String referralCode, String sponsorName,
      {String? queryType}) async {
    final prefs = await SharedPreferences.getInstance();
    final referralData = {
      'referralCode': referralCode,
      'sponsorName': sponsorName,
      'queryType': queryType,
    };
    await prefs.setString(_referralDataKey, jsonEncode(referralData));
    if (kDebugMode) {
      debugPrint(
          '📂 SessionManager — Referral data cached: $referralCode -> $sponsorName (type: $queryType)');
    }
  }

  /// Retrieves cached referral data.
  Future<Map<String, dynamic>?> getReferralData() async {
    final prefs = await SharedPreferences.getInstance();
    final referralDataString = prefs.getString(_referralDataKey);
    if (referralDataString == null) {
      return null;
    }
    try {
      final data = jsonDecode(referralDataString);
      return {
        'referralCode': data['referralCode'] as String,
        'sponsorName': data['sponsorName'] as String,
        'queryType': data['queryType'] as String?,
      };
    } catch (e) {
      return null;
    }
  }

  /// Clears only the cached referral data.
  Future<void> clearReferralData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_referralDataKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — Referral data cleared');
    }
  }
}
