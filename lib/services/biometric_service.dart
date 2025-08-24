import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';

class BiometricService {
  static final LocalAuthentication _localAuth = LocalAuthentication();
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  // Keys for secure storage
  static const String _credentialsKey = 'biometric_credentials';
  static const String _emailKey = 'biometric_email';

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
    
    // If disabling biometric, clear stored credentials
    if (!enabled) {
      await clearStoredCredentials();
    }
  }

  /// Securely store user credentials for biometric authentication
  static Future<void> storeCredentials({
    required String email, 
    required String password
  }) async {
    try {
      debugPrint('🔐 BiometricService: Storing credentials securely...');
      await _secureStorage.write(key: _emailKey, value: email);
      await _secureStorage.write(key: _credentialsKey, value: password);
      debugPrint('✅ BiometricService: Credentials stored securely');
    } catch (e) {
      debugPrint('❌ BiometricService: Error storing credentials: $e');
      rethrow;
    }
  }

  /// Retrieve stored credentials after biometric authentication
  static Future<Map<String, String>?> getStoredCredentials() async {
    try {
      debugPrint('🔐 BiometricService: Retrieving stored credentials...');
      final email = await _secureStorage.read(key: _emailKey);
      final password = await _secureStorage.read(key: _credentialsKey);
      
      if (email != null && password != null) {
        debugPrint('✅ BiometricService: Credentials retrieved for email: $email');
        return {'email': email, 'password': password};
      } else {
        debugPrint('⚠️ BiometricService: No stored credentials found');
        return null;
      }
    } catch (e) {
      debugPrint('❌ BiometricService: Error retrieving credentials: $e');
      return null;
    }
  }

  /// Check if credentials are stored
  static Future<bool> hasStoredCredentials() async {
    try {
      final email = await _secureStorage.read(key: _emailKey);
      return email != null;
    } catch (e) {
      debugPrint('❌ BiometricService: Error checking stored credentials: $e');
      return false;
    }
  }

  /// Get stored email without password (for UI display)
  static Future<String?> getStoredEmail() async {
    try {
      return await _secureStorage.read(key: _emailKey);
    } catch (e) {
      debugPrint('❌ BiometricService: Error getting stored email: $e');
      return null;
    }
  }

  /// Clear all stored credentials
  static Future<void> clearStoredCredentials() async {
    try {
      debugPrint('🔐 BiometricService: Clearing stored credentials...');
      await _secureStorage.delete(key: _emailKey);
      await _secureStorage.delete(key: _credentialsKey);
      debugPrint('✅ BiometricService: Credentials cleared');
    } catch (e) {
      debugPrint('❌ BiometricService: Error clearing credentials: $e');
    }
  }

  /// Perform full biometric authentication with automatic login
  static Future<Map<String, String>?> authenticateAndGetCredentials({
    String localizedReason = 'Use your biometric to sign in to Team Build Pro',
  }) async {
    try {
      // Check if credentials are stored
      final hasCredentials = await hasStoredCredentials();
      if (!hasCredentials) {
        debugPrint('⚠️ BiometricService: No credentials stored for biometric login');
        return null;
      }

      // Perform biometric authentication
      final authenticated = await authenticate(localizedReason: localizedReason);
      if (!authenticated) {
        debugPrint('❌ BiometricService: Biometric authentication failed');
        return null;
      }

      // Retrieve and return credentials
      return await getStoredCredentials();
    } catch (e) {
      debugPrint('❌ BiometricService: Error in authenticateAndGetCredentials: $e');
      return null;
    }
  }
}
