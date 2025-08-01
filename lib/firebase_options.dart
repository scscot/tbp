// File generated by FlutterFire CLI.
// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyA45ZN9KUuaYT0OHYZ9DmX2Jc8028Ftcvc',
    appId: '1:312163687148:web:43385dff773dab0b3763c9',
    messagingSenderId: '312163687148',
    projectId: 'teambuilder-plus-fe74d',
    authDomain: 'teambuilder-plus-fe74d.firebaseapp.com',
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app',
    measurementId: 'G-G4E4TBBPZ7',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAnB0-mdcWTqW0Ae4117hykVCT_zKXr1HU',
    appId: '1:312163687148:android:e3df886cab95a1123763c9',
    messagingSenderId: '312163687148',
    projectId: 'teambuilder-plus-fe74d',
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBCMVduZ1vACpCUNv5DQ9P17DnWj1_fjLw',
    appId: '1:312163687148:ios:9db93e08c23a25583763c9',
    messagingSenderId: '312163687148',
    projectId: 'teambuilder-plus-fe74d',
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app',
    iosClientId:
        '312163687148-uj2v3ldugflpr6b0iuph9412eoderjf7.apps.googleusercontent.com',
    iosBundleId: 'com.scott.ultimatefix',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyBCMVduZ1vACpCUNv5DQ9P17DnWj1_fjLw',
    appId: '1:312163687148:ios:90150363c309cdbb3763c9',
    messagingSenderId: '312163687148',
    projectId: 'teambuilder-plus-fe74d',
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app',
    iosClientId:
        '312163687148-5lj9aiqok14grs444lqpcs7ohpbqg799.apps.googleusercontent.com',
    iosBundleId: 'com.example.tbp',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyA45ZN9KUuaYT0OHYZ9DmX2Jc8028Ftcvc',
    appId: '1:312163687148:web:8e612b240cf864363763c9',
    messagingSenderId: '312163687148',
    projectId: 'teambuilder-plus-fe74d',
    authDomain: 'teambuilder-plus-fe74d.firebaseapp.com',
    storageBucket: 'teambuilder-plus-fe74d.firebasestorage.app',
    measurementId: 'G-BQWJW1EE0S',
  );
}
