/// Analytics event names for tracking user authentication flows.
///
/// These constants should be used with Firebase Analytics to track:
/// - Screen views
/// - User interactions
/// - Error occurrences
///
/// Example usage:
/// ```dart
/// import 'package:firebase_analytics/firebase_analytics.dart';
/// final analytics = FirebaseAnalytics.instance;
///
/// // Track screen view
/// analytics.logEvent(
///   name: AnalyticsEvents.authView,
///   parameters: {'screen': 'login'},
/// );
///
/// // Track user action
/// analytics.logEvent(
///   name: AnalyticsEvents.authSubmit,
///   parameters: {'method': 'email'},
/// );
///
/// // Track error
/// analytics.logEvent(
///   name: AnalyticsEvents.authError,
///   parameters: {'code': 'auth/invalid-email'},
/// );
/// ```
class AnalyticsEvents {
  /// Tracks when a user views an authentication screen.
  ///
  /// **Parameters:**
  /// - `screen`: String - The screen name ('login' or 'signup')
  ///
  /// **Where to add in Phase 1C:**
  /// - `lib/screens/login_screen_enhanced.dart`: In `initState()` or `build()`
  /// - `lib/screens/new_registration_screen.dart`: In `initState()` or `build()`
  ///
  /// **Example:**
  /// ```dart
  /// @override
  /// void initState() {
  ///   super.initState();
  ///   FirebaseAnalytics.instance.logEvent(
  ///     name: AnalyticsEvents.authView,
  ///     parameters: {'screen': 'login'},
  ///   );
  /// }
  /// ```
  static const authView = 'auth_view';

  /// Tracks when a user submits an authentication form.
  ///
  /// **Parameters:**
  /// - `method`: String - The auth method used ('email', 'biometric', 'google', 'apple')
  /// - `screen`: String - The screen name ('login' or 'signup')
  ///
  /// **Where to add in Phase 1C:**
  /// - `lib/screens/login_screen_enhanced.dart`:
  ///   - In `_handleSignIn()` method (for email/password)
  ///   - In biometric auth handler (for Face ID/Touch ID)
  /// - `lib/screens/new_registration_screen.dart`:
  ///   - In `_handleCreateAccount()` method
  ///
  /// **Example:**
  /// ```dart
  /// Future<void> _handleSignIn() async {
  ///   // ... validation ...
  ///   FirebaseAnalytics.instance.logEvent(
  ///     name: AnalyticsEvents.authSubmit,
  ///     parameters: {'method': 'email', 'screen': 'login'},
  ///   );
  ///   // ... sign in logic ...
  /// }
  /// ```
  static const authSubmit = 'auth_submit';

  /// Tracks when an authentication error occurs.
  ///
  /// **Parameters:**
  /// - `code`: String - The Firebase error code (e.g., 'auth/invalid-email')
  /// - `screen`: String - The screen name ('login' or 'signup')
  /// - `method`: String - The auth method that failed
  ///
  /// **Where to add in Phase 1C:**
  /// - `lib/screens/login_screen_enhanced.dart`:
  ///   - In error handler of `_handleSignIn()`
  ///   - In biometric auth error handler
  /// - `lib/screens/new_registration_screen.dart`:
  ///   - In error handler of `_handleCreateAccount()`
  ///
  /// **Example:**
  /// ```dart
  /// try {
  ///   await FirebaseAuth.instance.signInWithEmailAndPassword(...);
  /// } catch (e) {
  ///   FirebaseAnalytics.instance.logEvent(
  ///     name: AnalyticsEvents.authError,
  ///     parameters: {
  ///       'code': e.code,
  ///       'screen': 'login',
  ///       'method': 'email',
  ///     },
  ///   );
  ///   // Show error to user using AuthErrorCodes.getLocalizationKey(e.code)
  /// }
  /// ```
  static const authError = 'auth_error';
}

/// Helper extension for analytics in authentication screens.
///
/// **Usage in Phase 1C:**
/// ```dart
/// // Add this import at the top of login_screen_enhanced.dart
/// import 'package:firebase_analytics/firebase_analytics.dart';
/// import '../i18n/analytics_events.dart';
///
/// // In the screen widget
/// final analytics = FirebaseAnalytics.instance;
///
/// // Track events using the constants above
/// analytics.logEvent(name: AnalyticsEvents.authView, parameters: {...});
/// ```
