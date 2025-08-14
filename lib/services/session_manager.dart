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
  static const String _pendingReferralKey = 'pending_referral_code';

  Future<void> setCurrentUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    final userMap = jsonEncode(user.toMap());
    await prefs.setString(_userKey, userMap);
    debugPrint('📂 SessionManager — User session saved with UID: ${user.uid}');
  }

  Future<UserModel?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userData = prefs.getString(_userKey);
    if (userData == null) {
      debugPrint('⚠️ SessionManager — No session data found');
      return null;
    }
    try {
      final map = jsonDecode(userData);
      final user = UserModel.fromMap(map);
      debugPrint('✅ SessionManager — Loaded user: ${user.uid}');
      return user;
    } catch (e) {
      debugPrint('❌ SessionManager — Error decoding user: $e');
      return null;
    }
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_userKey);
    await prefs.remove(_biometricKey);
    await prefs.remove(_logoutTimeKey);
    debugPrint('🧹 SessionManager — Session cleared');
  }

  Future<void> setBiometricEnabled(bool isEnabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_biometricKey, isEnabled);
  }

  Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_biometricKey) ?? false;
  }

  Future<void> saveLogoutTime() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_logoutTimeKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<DateTime?> getLastLogoutTime() async {
    final prefs = await SharedPreferences.getInstance();
    final millis = prefs.getInt(_logoutTimeKey);
    if (millis != null) {
      return DateTime.fromMillisecondsSinceEpoch(millis);
    }
    return null;
  }

  /// Saves a referral code received from a deep link
  Future<void> setPendingReferralCode(String code) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_pendingReferralKey, code);
    debugPrint('📂 SessionManager — Pending referral code saved: $code');
  }

  /// Retrieves and clears the pending referral code
  Future<String?> consumePendingReferralCode() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_pendingReferralKey);
    if (code != null) {
      await prefs.remove(_pendingReferralKey);
      debugPrint('✅ SessionManager — Pending referral code consumed: $code');
    }
    return code;
  }

  // Referral data caching methods
  Future<void> setReferralData(String referralCode, String sponsorName) async {
    // Validate referral code before caching
    if (!_isValidReferralCode(referralCode)) {
      debugPrint('❌ SessionManager — Invalid referral code, not caching: $referralCode');
      return;
    }

    // Sanitize the data
    final sanitizedReferralCode = _sanitizeReferralCode(referralCode);
    final sanitizedSponsorName = _sanitizeSponsorName(sponsorName);

    final prefs = await SharedPreferences.getInstance();
    final referralData = {
      'referralCode': sanitizedReferralCode,
      'sponsorName': sanitizedSponsorName,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
    await prefs.setString(_referralDataKey, jsonEncode(referralData));
    debugPrint(
        '📂 SessionManager — Referral data cached: $sanitizedReferralCode -> $sanitizedSponsorName');
  }

  /// Validate if the referral code is valid
  bool _isValidReferralCode(String referralCode) {
    if (referralCode.trim().isEmpty) {
      return false;
    }

    // Reject codes that are too long (likely file paths)
    if (referralCode.length > 50) {
      debugPrint('❌ SessionManager — Rejecting overly long referral code');
      return false;
    }

    // Reject codes that contain file path indicators
    if (referralCode.contains('/') || referralCode.contains('\\') || referralCode.contains(':')) {
      debugPrint('❌ SessionManager — Rejecting referral code with path indicators');
      return false;
    }

    // Reject codes that look like file paths or URLs
    if (referralCode.startsWith('file://') || referralCode.startsWith('C:') || referralCode.startsWith('/')) {
      debugPrint('❌ SessionManager — Rejecting file path referral code');
      return false;
    }

    return true;
  }

/// Sanitize referral code by removing unwanted characters
  String _sanitizeReferralCode(String referralCode) {
    return referralCode.trim().replaceAll(RegExp(r'[^\w-]'), '');
  }

  /// Sanitize sponsor name by removing unwanted characters
  String _sanitizeSponsorName(String sponsorName) {
    // ignore: valid_regexps
    return sponsorName.trim().replaceAll('[<>"\' ]', '');
  }

  Future<Map<String, String>?> getReferralData() async {
    final prefs = await SharedPreferences.getInstance();
    final referralDataString = prefs.getString(_referralDataKey);
    if (referralDataString == null) {
      debugPrint('⚠️ SessionManager — No referral data found');
      return null;
    }
    try {
      final data = jsonDecode(referralDataString);
      final referralData = {
        'referralCode': data['referralCode'] as String,
        'sponsorName': data['sponsorName'] as String,
      };
      debugPrint(
          '✅ SessionManager — Loaded referral data: ${referralData['referralCode']} -> ${referralData['sponsorName']}');
      return referralData;
    } catch (e) {
      debugPrint('❌ SessionManager — Error decoding referral data: $e');
      return null;
    }
  }

  Future<void> clearReferralData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_referralDataKey);
    debugPrint('🧹 SessionManager — Referral data cleared');
  }
}
