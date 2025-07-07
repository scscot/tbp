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
      // FIX: Set a low fetch interval for development to bypass caching.
      // The default is 12 hours, which is too long for testing.
      await _remoteConfig.setConfigSettings(RemoteConfigSettings(
        fetchTimeout: const Duration(minutes: 1),
        minimumFetchInterval: const Duration(seconds: 10),
      ));

      await _remoteConfig.setDefaults(_defaultValues);
      await _remoteConfig.fetchAndActivate();
    } catch (e) {
      debugPrint('Error initializing Remote Config: $e');
    }
  }

  static int get projectWideDirectSponsorMin =>
      _remoteConfig.getInt('projectWideDirectSponsorMin');
  static int get projectWideTotalTeamMin =>
      _remoteConfig.getInt('projectWideTotalTeamMin');
}
