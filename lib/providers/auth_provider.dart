// lib/providers/auth_provider.dart

import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:rxdart/rxdart.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart';
import '../services/session_manager.dart';
import '../services/biometric_service.dart';

/// Enhanced AuthStateProvider with ChangeNotifier for centralized state management
/// Extends your existing AuthService with proper Provider pattern implementation
class AuthStateProvider extends ChangeNotifier {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  // ==============================
  // State Management Properties
  // ==============================

  AuthState _state = AuthState.initial;
  UserModel? _currentUser;
  AdminSettingsModel? _adminSettings;
  String? _errorMessage;
  bool _isLoading = false;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  String? _storedEmail;

  // Stream subscriptions
  StreamSubscription<User?>? _authStateSubscription;
  StreamSubscription<DocumentSnapshot>? _userDocSubscription;
  StreamSubscription<DocumentSnapshot>? _adminSettingsSubscription;

  // ==============================
  // Getters
  // ==============================

  AuthState get state => _state;
  UserModel? get currentUser => _currentUser;
  AdminSettingsModel? get adminSettings => _adminSettings;
  String? get errorMessage => _errorMessage;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null && _state == AuthState.authenticated;
  bool get biometricAvailable => _biometricAvailable;
  bool get biometricEnabled => _biometricEnabled;
  String? get storedEmail => _storedEmail;

  // Legacy streams for backward compatibility
  Stream<UserModel?> get user {
    return _firebaseAuth.authStateChanges().switchMap((firebaseUser) {
      if (firebaseUser == null) {
        return Stream.value(null);
      } else {
        return _firestore
            .collection('users')
            .doc(firebaseUser.uid)
            .snapshots()
            .map((snapshot) {
          if (snapshot.exists) {
            return UserModel.fromFirestore(snapshot);
          } else {
            return null;
          }
        });
      }
    });
  }

  Stream<AdminSettingsModel?> get adminSettingsStream {
    return user.switchMap((currentUser) {
      if (currentUser != null && currentUser.role == 'admin') {
        return _firestore
            .collection('admin_settings')
            .doc(currentUser.uid)
            .snapshots()
            .map((snapshot) {
          if (snapshot.exists) {
            return AdminSettingsModel.fromFirestore(snapshot);
          } else {
            return null;
          }
        });
      } else {
        return Stream.value(null);
      }
    });
  }

  // ==============================
  // Constructor & Initialization
  // ==============================

  AuthStateProvider() {
    _initialize();
  }

  void _initialize() {
    _initializeBiometric();
    _setupAuthStateListener();
  }

  Future<void> _initializeBiometric() async {
    try {
      final available = await BiometricService.isDeviceSupported();
      final enabled = await BiometricService.isBiometricEnabled();
      final storedEmail = await BiometricService.getStoredEmail();

      _biometricAvailable = available;
      _biometricEnabled = enabled;
      _storedEmail = storedEmail;

      notifyListeners();

      debugPrint('🔐 AUTH_STATE_PROVIDER: Biometric initialized - Available: $available, Enabled: $enabled');
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Error initializing biometric: $e');
    }
  }

  void _setupAuthStateListener() {
    _authStateSubscription = _firebaseAuth.authStateChanges().listen((User? firebaseUser) {
      if (firebaseUser == null) {
        _handleSignOut();
      } else {
        _handleSignIn(firebaseUser);
      }
    });
  }

  void _handleSignOut() {
    debugPrint('🔐 AUTH_PROVIDER: User signed out');
    _currentUser = null;
    _adminSettings = null;
    _state = AuthState.unauthenticated;
    _errorMessage = null;
    _userDocSubscription?.cancel();
    _adminSettingsSubscription?.cancel();
    notifyListeners();
  }

  void _handleSignIn(User firebaseUser) {
    debugPrint('🔐 AUTH_PROVIDER: User signed in: ${firebaseUser.uid}');

    // Listen to user document changes
    _userDocSubscription = _firestore
        .collection('users')
        .doc(firebaseUser.uid)
        .snapshots()
        .listen((snapshot) {
      if (snapshot.exists) {
        _currentUser = UserModel.fromFirestore(snapshot);
        _state = AuthState.authenticated;
        _errorMessage = null;

        // Setup admin settings listener if user is admin
        if (_currentUser?.role == 'admin') {
          _setupAdminSettingsListener(firebaseUser.uid);
        } else {
          _adminSettings = null;
        }

        notifyListeners();
        debugPrint('🔐 AUTH_PROVIDER: User document updated: ${_currentUser?.email}');
      } else {
        _currentUser = null;
        _state = AuthState.unauthenticated;
        _errorMessage = 'User document not found';
        notifyListeners();
        debugPrint('🔐 AUTH_PROVIDER: User document not found for ${firebaseUser.uid}');
      }
    });
  }

  void _setupAdminSettingsListener(String userId) {
    _adminSettingsSubscription = _firestore
        .collection('admin_settings')
        .doc(userId)
        .snapshots()
        .listen((snapshot) {
      if (snapshot.exists) {
        _adminSettings = AdminSettingsModel.fromFirestore(snapshot);
        notifyListeners();
        debugPrint('🔐 AUTH_PROVIDER: Admin settings updated');
      }
    });
  }

  // ==============================
  // State Management Helpers
  // ==============================

  void _setState(AuthState newState, {String? errorMessage}) {
    _state = newState;
    _errorMessage = errorMessage;
    notifyListeners();
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // ==============================
  // Authentication Methods
  // ==============================

  /// Sign in with email and password
  Future<UserCredential?> signInWithEmailAndPassword(String email, String password) async {
    try {
      _setLoading(true);
      _setState(AuthState.loading);

      debugPrint('🔐 AUTH_PROVIDER: Signing in with email: $email');

      final result = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password
      );

      // Clear logout state on successful login
      await SessionManager.instance.clearLogoutState();

      // Store credentials if biometric is enabled (for future biometric login)
      final biometricEnabled = await BiometricService.isBiometricEnabled();
      if (biometricEnabled) {
        await BiometricService.storeCredentials(
          email: email,
          password: password,
        );
        debugPrint('🔐 AUTH_PROVIDER: Stored credentials for biometric login');
      }

      debugPrint('🔐 AUTH_PROVIDER: Login successful');

      return result;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Login failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign in with credential (for social logins)
  Future<UserCredential?> signInWithCredential(AuthCredential credential) async {
    try {
      _setLoading(true);
      _setState(AuthState.loading);

      debugPrint('🔐 AUTH_PROVIDER: Signing in with credential');

      final result = await _firebaseAuth.signInWithCredential(credential);

      // Clear logout state on successful login
      await SessionManager.instance.clearLogoutState();
      debugPrint('🔐 AUTH_PROVIDER: Credential login successful');

      return result;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Credential login failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign in with Google - TEMPORARILY DISABLED FOR APP STORE APPROVAL
  Future<UserCredential?> signInWithGoogle() async {
    debugPrint('🔐 AUTH_PROVIDER: Google Sign-In is temporarily disabled');
    _setState(AuthState.error, errorMessage: 'Google Sign-In is temporarily unavailable. Please use email sign-in.');
    return null;

    /* COMMENTED OUT FOR APP STORE APPROVAL - UNCOMMENT WHEN READY TO RE-ENABLE
    try {
      _setLoading(true);
      _setState(AuthState.loading);

      debugPrint('🔐 AUTH_PROVIDER: Starting Google Sign-In');

      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        debugPrint('🔐 AUTH_PROVIDER: Google Sign-In cancelled by user');
        _setState(AuthState.unauthenticated);
        return null;
      }

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      return await signInWithCredential(credential);
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Google Sign-In failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
      return null;
    } finally {
      _setLoading(false);
    }
    */
  }

  /// Sign in with Apple - TEMPORARILY DISABLED FOR APP STORE APPROVAL
  Future<UserCredential?> signInWithApple() async {
    debugPrint('🔐 AUTH_PROVIDER: Apple Sign-In is temporarily disabled');
    _setState(AuthState.error, errorMessage: 'Apple Sign-In is temporarily unavailable. Please use email sign-in.');
    return null;

    /* COMMENTED OUT FOR APP STORE APPROVAL - UNCOMMENT WHEN READY TO RE-ENABLE
    try {
      _setLoading(true);
      _setState(AuthState.loading);

      debugPrint('🔐 AUTH_PROVIDER: Starting Apple Sign-In');

      // Check availability before attempting sign-in
      final isAvailable = await SignInWithApple.isAvailable();
      if (!isAvailable) {
        debugPrint('🍎 AUTH_PROVIDER: Apple Sign-In not available on this device');
        _setState(AuthState.error, errorMessage: 'Apple Sign-In is not available on this device. Please use email or Google sign-in instead.');
        return null;
      }

      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );

      return await signInWithCredential(oauthCredential);
    } on SignInWithAppleAuthorizationException catch (e) {
      debugPrint('🍎 AUTH_PROVIDER: Apple authorization exception: ${e.code} - ${e.message}');

      String errorMessage;
      switch (e.code) {
        case AuthorizationErrorCode.canceled:
          debugPrint('🍎 AUTH_PROVIDER: User cancelled Apple Sign-In');
          _setState(AuthState.unauthenticated);
          return null;
        case AuthorizationErrorCode.failed:
          errorMessage = 'Apple Sign-In failed. Please try again or use an alternative sign-in method.';
          break;
        case AuthorizationErrorCode.invalidResponse:
          errorMessage = 'Invalid response from Apple. Please try again.';
          break;
        case AuthorizationErrorCode.notHandled:
          errorMessage = 'Apple Sign-In could not be completed. Please try email or Google sign-in.';
          break;
        case AuthorizationErrorCode.unknown:
        default:
          errorMessage = 'Apple Sign-In is temporarily unavailable. Please try email or Google sign-in instead.';
          break;
      }

      _setState(AuthState.error, errorMessage: errorMessage);
      return null;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Apple Sign-In failed: $e');

      // Handle "temporarily disabled" or service unavailable errors
      String errorMessage = _getAppleSignInErrorMessage(e);
      _setState(AuthState.error, errorMessage: errorMessage);
      return null;
    } finally {
      _setLoading(false);
    }
    */
  }

  /// Sign in with biometric
  Future<bool> signInWithBiometric() async {
    try {
      _setLoading(true);

      debugPrint('🔐 AUTH_PROVIDER: Starting biometric authentication');

      final credentials = await BiometricService.authenticateAndGetCredentials();
      if (credentials == null) {
        debugPrint('🔐 AUTH_PROVIDER: Biometric authentication failed or cancelled');
        return false;
      }

      await signInWithEmailAndPassword(credentials['email']!, credentials['password']!);
      return _state == AuthState.authenticated;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Biometric sign-in failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Register new user
  Future<UserCredential?> registerUser(Map<String, dynamic> userData) async {
    try {
      _setLoading(true);
      _setState(AuthState.loading);

      debugPrint('🔐 AUTH_PROVIDER: Starting user registration');

      // Call cloud function for registration
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('registerUser');

      final result = await callable.call(userData);

      if (result.data['success'] == true) {
        debugPrint('🔐 AUTH_PROVIDER: Registration successful');
        // The auth state listener will handle the signed-in user
        return null; // Cloud function handles the auth
      } else {
        throw Exception(result.data['error'] ?? 'Registration failed');
      }
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Registration failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
      return null;
    } finally {
      _setLoading(false);
    }
  }

  /// Send password reset email
  Future<bool> sendPasswordResetEmail(String email) async {
    try {
      _setLoading(true);
      clearError();

      debugPrint('🔐 AUTH_PROVIDER: Sending password reset email to: $email');

      await _firebaseAuth.sendPasswordResetEmail(email: email);

      debugPrint('✅ AUTH_PROVIDER: Password reset email sent successfully');
      return true;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Password reset failed: $e');
      _setState(_state, errorMessage: _getPasswordResetErrorMessage(e));
      return false;
    } finally {
      _setLoading(false);
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      _setLoading(true);

      debugPrint('🔐 AUTH_PROVIDER: Starting sign out');

      // Sign out from all providers
      await Future.wait([
        _firebaseAuth.signOut(),
        _googleSignIn.signOut(),
      ]);

      // Clear session data
      await SessionManager.instance.clearAllData();

      debugPrint('🔐 AUTH_PROVIDER: Sign out successful');
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Sign out failed: $e');
      _setState(AuthState.error, errorMessage: _getErrorMessage(e));
    } finally {
      _setLoading(false);
    }
  }

  // ==============================
  // Subscription Management
  // ==============================

  /// Check if user should show subscription screen
  Future<bool> shouldShowSubscriptionScreen(UserModel? user) async {
    if (user == null) return false;

    try {
      debugPrint('🔐 AUTH_PROVIDER: Checking subscription status via Cloud Function');

      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('checkUserSubscriptionStatus');

      final result = await callable.call().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('❌ AUTH_PROVIDER: Cloud function call timed out');
          throw TimeoutException('Cloud function call timed out', const Duration(seconds: 10));
        },
      );

      final data = result.data;
      final isActive = data['isActive'] as bool? ?? false;
      final isTrialValid = data['isTrialValid'] as bool? ?? false;

      final needsSubscription = !isActive && !isTrialValid;
      debugPrint('🔐 AUTH_PROVIDER: User needs subscription screen: $needsSubscription');

      return needsSubscription;
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Error checking subscription: $e');
      return false; // Be conservative on error
    }
  }

  /// Check subscription status when app resumes
  Future<bool> checkSubscriptionOnAppResume() async {
    try {
      final firebaseUser = _firebaseAuth.currentUser;
      if (firebaseUser == null) return false;

      debugPrint('🔐 AUTH_PROVIDER: Checking subscription on app resume');

      final userDoc = await _firestore.collection('users').doc(firebaseUser.uid).get();
      if (!userDoc.exists) return false;

      final user = UserModel.fromFirestore(userDoc);
      return await shouldShowSubscriptionScreen(user);
    } catch (e) {
      debugPrint('❌ AUTH_PROVIDER: Error checking subscription on app resume: $e');
      return false;
    }
  }

  // ==============================
  // Helper Methods
  // ==============================

  String _getErrorMessage(dynamic error) {
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'user-not-found':
          return 'No user found with this email address.';
        case 'wrong-password':
          return 'Incorrect password.';
        case 'user-disabled':
          return 'This account has been disabled.';
        case 'too-many-requests':
          return 'Too many failed attempts. Please try again later.';
        case 'operation-not-allowed':
          return 'This sign-in method is not allowed.';
        case 'invalid-email':
          return 'Invalid email address.';
        case 'weak-password':
          return 'Password is too weak.';
        case 'email-already-in-use':
          return 'An account already exists with this email.';
        case 'invalid-credential':
          return 'Please check your email and password and try again.';
        case 'credential-already-in-use':
          return 'This account is already linked to another user.';
        case 'requires-recent-login':
          return 'Please sign out and sign back in to continue.';
        case 'expired-action-code':
        case 'invalid-action-code':
          return 'Your session has expired. Please try signing in again.';
        case 'network-request-failed':
          return 'Network error. Please check your connection and try again.';
        default:
          String message = error.message ?? 'An authentication error occurred.';
          if (message.toLowerCase().contains('malformed') ||
              message.toLowerCase().contains('expired')) {
            return 'Your session has expired. Please try signing in again.';
          }
          if (message.toLowerCase().contains('credential')) {
            return 'Please check your email and password and try again.';
          }
          return 'Something went wrong. Please try again.';
      }
    }

    String errorString = error.toString();
    if (errorString.toLowerCase().contains('malformed') ||
        errorString.toLowerCase().contains('expired')) {
      return 'Your session has expired. Please try signing in again.';
    }
    if (errorString.toLowerCase().contains('credential')) {
      return 'Please check your email and password and try again.';
    }

    return 'Something went wrong. Please try again.';
  }


  String _getPasswordResetErrorMessage(dynamic error) {
    if (error is FirebaseAuthException) {
      switch (error.code) {
        case 'user-not-found':
          return 'No account found with this email address.';
        case 'invalid-email':
          return 'Please enter a valid email address.';
        case 'too-many-requests':
          return 'Too many password reset requests. Please wait before trying again.';
        case 'user-disabled':
          return 'This account has been disabled. Please contact support.';
        default:
          return error.message ?? 'Failed to send password reset email.';
      }
    }
    return 'Failed to send password reset email. Please try again.';
  }

  // ==============================
  // Disposal
  // ==============================

  @override
  void dispose() {
    _authStateSubscription?.cancel();
    _userDocSubscription?.cancel();
    _adminSettingsSubscription?.cancel();
    super.dispose();
  }
}

// ==============================
// Authentication State Enum
// ==============================

enum AuthState {
  initial,
  loading,
  authenticated,
  unauthenticated,
  error,
}