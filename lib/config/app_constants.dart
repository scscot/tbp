// lib/config/app_constants.dart

import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';

const Map<String, String?> firebaseConfig = {
  'apiKey': "AIzaSyA45ZN9KUuaYT0OHYZ9DmX2Jc8028Ftcvc",
  'authDomain': "teambuilder-plus-fe74d.firebaseapp.com",
  'projectId': "teambuilder-plus-fe74d",
  'storageBucket': "teambuilder-plus-fe74d.appspot.com",
  'messagingSenderId': "312163687148",
  'appId': "1:312163687148:web:43385dff773dab0b3763c9",
};

class AppConstants {
  static final FirebaseRemoteConfig _remoteConfig =
      FirebaseRemoteConfig.instance;

  static final Map<String, dynamic> _defaultValues = {
    'projectWideDirectSponsorMin': 4,
    'projectWideTotalTeamMin': 20,
  };

  static Future<void> initialize() async {
    try {
      debugPrint('🔧 AppConstants: Starting Remote Config initialization...');

      // Set a shorter fetch timeout to prevent hanging
      await _remoteConfig.setConfigSettings(RemoteConfigSettings(
        fetchTimeout: const Duration(seconds: 30), // Reduced from 1 minute
        minimumFetchInterval: const Duration(seconds: 10),
      ));

      debugPrint('🔧 AppConstants: Setting default values...');
      await _remoteConfig.setDefaults(_defaultValues);

      debugPrint('🔧 AppConstants: Fetching and activating Remote Config...');

      // Add timeout to prevent hanging
      await _remoteConfig.fetchAndActivate().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          debugPrint(
              '⚠️ AppConstants: Remote Config fetch timed out, using defaults');
          return false;
        },
      );

      debugPrint(
          '✅ AppConstants: Remote Config initialization completed successfully');
    } catch (e) {
      debugPrint('❌ AppConstants: Error initializing Remote Config: $e');
      debugPrint('🔧 AppConstants: Continuing with default values...');
      // Don't rethrow - continue with defaults
    }
  }

  static int get projectWideDirectSponsorMin =>
      _remoteConfig.getInt('projectWideDirectSponsorMin');
  static int get projectWideTotalTeamMin =>
      _remoteConfig.getInt('projectWideTotalTeamMin');
}
