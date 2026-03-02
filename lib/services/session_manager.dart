// lib/services/session_manager.dart

import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';

class SessionManager {
  static final SessionManager instance = SessionManager();

  static const String _userKey = 'user';
  static const String _logoutTimeKey = 'last_logout_time';
  static const String _referralDataKey = 'referral_data';
  static const String _logoutStateKey = 'user_logged_out';
  static const String _recentSignOutKey = 'recent_sign_out_timestamp';

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

  /// Clears all session and referral data.
  Future<void> clearAllData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await prefs.remove(_logoutTimeKey);
    await prefs.remove(_referralDataKey);
    await prefs.remove(_logoutStateKey);
    await prefs.remove(_recentSignOutKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — All session and referral data cleared');
    }
  }

  /// Clears only logout time and referral data, preserving user data
  Future<void> clearLogoutData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_logoutTimeKey);
    await prefs.remove(_referralDataKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — Logout and referral data cleared (preserving user data)');
    }
  }

  /// Caches data for a successfully validated referral code.
  Future<void> setReferralData(String referralCode, String sponsorName,
      {String? queryType, String? source, String? campaignType, DateTime? capturedAt}) async {
    final prefs = await SharedPreferences.getInstance();
    final referralData = {
      'referralCode': referralCode,
      'sponsorName': sponsorName,
      'queryType': queryType,
      'source': source,
      'campaignType': campaignType,
      'capturedAt': capturedAt?.toIso8601String(),
    };
    await prefs.setString(_referralDataKey, jsonEncode(referralData));
    if (kDebugMode) {
      debugPrint(
          '📂 SessionManager — Referral data cached: $referralCode -> $sponsorName (type: $queryType, source: $source, campaign: $campaignType)');
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
        'campaignType': data['campaignType'] as String?,
        'capturedAt': data['capturedAt'] as String?,
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

  /// Sets the logout state to indicate user has logged out (not first time user)
  Future<void> setLogoutState(bool hasLoggedOut) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_logoutStateKey, hasLoggedOut);
    if (kDebugMode) {
      debugPrint('📂 SessionManager — Logout state set: $hasLoggedOut');
    }
  }

  /// Checks if user has logged out (distinguishes from first time user)
  Future<bool> hasLoggedOut() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_logoutStateKey) ?? false;
  }

  /// Clears the logout state (called when user successfully logs in)
  Future<void> clearLogoutState() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_logoutStateKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — Logout state cleared');
    }
  }

  /// Sets timestamp when user manually signs out
  Future<void> setRecentSignOut() async {
    final prefs = await SharedPreferences.getInstance();
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    await prefs.setInt(_recentSignOutKey, timestamp);
    if (kDebugMode) {
      debugPrint('📂 SessionManager — Recent sign-out timestamp set: $timestamp');
    }
  }

  /// Checks if user recently signed out (within the last 10 seconds)
  Future<bool> wasRecentSignOut({int delaySeconds = 10}) async {
    final prefs = await SharedPreferences.getInstance();
    final timestamp = prefs.getInt(_recentSignOutKey);
    if (timestamp == null) return false;

    final signOutTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
    final timeDifference = DateTime.now().difference(signOutTime);
    final isRecent = timeDifference.inSeconds < delaySeconds;

    if (kDebugMode) {
      debugPrint('🔍 SessionManager — Sign-out was ${timeDifference.inSeconds} seconds ago, recent: $isRecent');
    }

    return isRecent;
  }

  /// Clears the recent sign-out timestamp
  Future<void> clearRecentSignOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_recentSignOutKey);
    if (kDebugMode) {
      debugPrint('🧹 SessionManager — Recent sign-out timestamp cleared');
    }
  }
}
