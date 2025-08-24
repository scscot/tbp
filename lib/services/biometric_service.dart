import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

class BiometricService {
  static final LocalAuthentication _localAuth = LocalAuthentication();

  static Future<bool> isDeviceSupported() async {
    try {
      final bool isSupported = await _localAuth.isDeviceSupported();
      final bool canCheckBiometrics = await _localAuth.canCheckBiometrics;
      final result = isSupported && canCheckBiometrics;
      debugPrint('🔐 BiometricService: Device support check:');
      debugPrint('  - isSupported: $isSupported');
      debugPrint('  - canCheckBiometrics: $canCheckBiometrics');
      debugPrint('  - final result: $result');
      return result;
    } catch (e) {
      debugPrint('❌ BiometricService: Device support check failed: $e');
      return false;
    }
  }

  static Future<bool> authenticate({
    String localizedReason = 'Please authenticate to access your account',
    bool biometricOnly = true,
  }) async {
    try {
      debugPrint('🔐 BiometricService: Attempting authentication...');
      debugPrint('  - localizedReason: $localizedReason');
      debugPrint('  - biometricOnly: $biometricOnly');
      
      final result = await _localAuth.authenticate(
        localizedReason: localizedReason,
        options: AuthenticationOptions(
          biometricOnly: biometricOnly,
          stickyAuth: true,
        ),
      );
      
      debugPrint('🔐 BiometricService: Authentication result: $result');
      return result;
    } catch (e) {
      debugPrint('❌ BiometricService: Authentication error: $e');
      return false;
    }
  }

  static Future<bool> isBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool('biometric_enabled') ?? false;
    debugPrint('🔐 BiometricService: Biometric enabled setting: $enabled');
    return enabled;
  }

  static Future<void> setBiometricEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', enabled);
    debugPrint('🔐 BiometricService: Biometric setting saved: $enabled');
  }
}
