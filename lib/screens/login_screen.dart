// lib/screens/login_screen.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:math' as math;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../services/auth_service.dart';
import '../models/user_model.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'new_registration_screen.dart';
import '../widgets/header_widgets.dart';
import 'dart:async';
import '../services/biometric_service.dart';
import '../services/session_manager.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  final String appId;
  const LoginScreen({super.key, required this.appId});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _hasStoredUser = false;
  String? _storedEmail;
  StreamSubscription<User?>? _authSub;
  Map<String, String?>? _appleUserData;
  bool _navigated = false;

  @override
  void initState() {
    super.initState();
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (!mounted || user == null || _navigated) return;

      debugPrint('🔐 LOGIN: Auth state -> ${user.email} (${user.uid})');
      
      // CRITICAL: Don't interfere if we're actively processing a social sign-in
      if (_isLoading) {
        debugPrint('🔐 LOGIN: Sign-in in progress, skipping auth state navigation');
        return;
      }

      try {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
          debugPrint('🧹 LOGIN: No user doc found - showing registration prompt');
          await FirebaseAuth.instance.signOut();
          
          // Show modal explaining the user needs to register first
          if (mounted) {
            _showRegistrationRequiredModal();
          }
          return;
        }

        // No arbitrary delays; wait exactly for a frame, then navigate
        await Future<void>.delayed(Duration.zero);

        final nav = navigatorKey.currentState;
        if (nav != null) {
          _navigated = true;            // guard against double navigation
          _authSub?.cancel();           // stop listening once we commit to UI

          // Clear recent sign-out timestamp since user successfully logged in
          await SessionManager.instance.clearRecentSignOut();

          nav.pushNamedAndRemoveUntil(
            '/',                        // AuthWrapper route
            (route) => false,
          );
          debugPrint('✅ LOGIN: Pushed AuthWrapper and cleared stack');
        }
      } catch (e) {
        debugPrint('❌ LOGIN: Error after auth: $e');
      }
    });
    _initializeBiometric();
  }

  Future<void> _initializeBiometric() async {
    try {
      // Check if user is already authenticated - if so, don't auto-prompt biometric
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser != null) {
        debugPrint('🔐 LOGIN: User already authenticated, skipping biometric auto-prompt');
        return;
      }
      
      final available = await BiometricService.isDeviceSupported();
      final enabled = await BiometricService.isBiometricEnabled();
      final hasStoredCredentials = await BiometricService.hasStoredCredentials();
      final storedEmail = await BiometricService.getStoredEmail();
      final storedUser = await SessionManager.instance.getCurrentUser();
      
      debugPrint('🔐 LOGIN: Biometric debug info:');
      debugPrint('  - Device supported: $available');
      debugPrint('  - Biometric enabled: $enabled');
      debugPrint('  - Has stored credentials: $hasStoredCredentials');
      debugPrint('  - Stored email: $storedEmail');
      debugPrint('  - Session user exists: ${storedUser != null}');
      
      if (mounted) {
        setState(() {
          _biometricAvailable = available;
          _biometricEnabled = enabled;
          _hasStoredUser = hasStoredCredentials;
          _storedEmail = storedEmail ?? storedUser?.email;
        });
      }
      
      // Check if user recently signed out to prevent immediate biometric auto-login
      final wasRecentSignOut = await SessionManager.instance.wasRecentSignOut();

      // Auto-prompt biometric if device supports it, biometric is enabled, we have stored credentials, and user didn't recently sign out
      final shouldAutoPrompt = available && enabled && hasStoredCredentials && !wasRecentSignOut;
      debugPrint('🔐 LOGIN: Should auto-prompt biometric: $shouldAutoPrompt (recent sign-out: $wasRecentSignOut)');

      if (shouldAutoPrompt) {
        debugPrint('🔐 LOGIN: Auto-prompting biometric login...');
        _showBiometricLogin();
      } else if (wasRecentSignOut) {
        debugPrint('🔐 LOGIN: Skipping biometric auto-prompt due to recent sign-out');
      }
    } catch (e) {
      debugPrint('❌ LOGIN: Error initializing biometric: $e');
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate() || _isLoading) return;
    
    await _signInWithCredentials(
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
      isBiometricLogin: false,
    );
  }

  Future<void> _signInWithCredentials({
    required String email,
    required String password,
    required bool isBiometricLogin,
  }) async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    try {
      debugPrint('🔐 LOGIN: Signing in with email: $email (biometric: $isBiometricLogin)');
      
      await authService.signInWithEmailAndPassword(email, password);

      // Store user data for SessionManager (for compatibility)
      final currentUser = FirebaseAuth.instance.currentUser;
      debugPrint('🔐 LOGIN: Current user after auth: ${currentUser?.uid}');
      
      if (currentUser != null) {
        debugPrint('🔐 LOGIN: Fetching user document from Firestore...');
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(currentUser.uid)
            .get();
            
        debugPrint('🔐 LOGIN: User document exists: ${userDoc.exists}');
        
        if (userDoc.exists) {
          debugPrint('🔐 LOGIN: Creating UserModel from Firestore data...');
          final userModel = UserModel.fromFirestore(userDoc);
          debugPrint('🔐 LOGIN: UserModel created - Email: ${userModel.email}, UID: ${userModel.uid}');
          
          debugPrint('🔐 LOGIN: Storing user data in SessionManager...');
          await SessionManager.instance.setCurrentUser(userModel);
          debugPrint('✅ LOGIN: User data stored in SessionManager');

          // Store credentials securely for biometric authentication (only for manual login)
          if (!isBiometricLogin && _biometricAvailable) {
            debugPrint('🔐 LOGIN: Storing credentials for biometric authentication...');
            await BiometricService.storeCredentials(email: email, password: password);
            
            // Enable biometric authentication automatically after successful login
            await BiometricService.setBiometricEnabled(true);
            debugPrint('✅ LOGIN: Credentials stored securely and biometric enabled');
            
            // Show user that biometric login is now available
            if (mounted) {
              scaffoldMessenger.showSnackBar(
                const SnackBar(
                  content: Text('✅ Biometric login enabled! You can now use biometric authentication for future logins.'),
                  backgroundColor: Colors.green,
                  duration: Duration(seconds: 4),
                ),
              );
            }
          }
        } else {
          debugPrint('❌ LOGIN: User document does not exist in Firestore for UID: ${currentUser.uid}');
        }
      } else {
        debugPrint('❌ LOGIN: No current user found after authentication');
      }

      if (mounted) {
        Navigator.of(context, rootNavigator: true)
            .popUntil((route) => route.isFirst);
      }
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ LOGIN: Firebase authentication error: ${e.code} - ${e.message}');
      scaffoldMessenger.showSnackBar(
        SnackBar(
            content: Text(e.message ?? 'Login failed'),
            backgroundColor: Colors.red),
      );
    } catch (e) {
      debugPrint('❌ LOGIN: Unexpected error: $e');
      scaffoldMessenger.showSnackBar(
        SnackBar(
            content: Text('Login failed: $e'),
            backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _showBiometricLogin() async {
    // Small delay to ensure UI is ready
    await Future.delayed(const Duration(milliseconds: 500));
    
    if (!mounted) return;
    
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    
    try {
      debugPrint('🔐 LOGIN: Starting biometric authentication and credential retrieval...');
      
      // Perform biometric authentication and get stored credentials
      final credentials = await BiometricService.authenticateAndGetCredentials(
        localizedReason: 'Use your biometric to sign in to Team Build Pro',
      );
      
      if (credentials != null && mounted) {
        debugPrint('✅ LOGIN: Biometric authentication successful, signing in...');
        await _signInWithCredentials(
          email: credentials['email']!,
          password: credentials['password']!,
          isBiometricLogin: true,
        );
      } else if (mounted) {
        debugPrint('❌ LOGIN: Biometric authentication failed or no credentials found');
        scaffoldMessenger.showSnackBar(
          const SnackBar(
            content: Text('Biometric authentication failed or no stored credentials found'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (e) {
      debugPrint('❌ LOGIN: Biometric auth error: $e');
      scaffoldMessenger.showSnackBar(
        SnackBar(
          content: Text('Biometric authentication failed: $e'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }


  Future<void> _signInWithSocial(
      Future<AuthCredential> Function() getCredential) async {
    if (_isLoading) return;
    setState(() => _isLoading = true);
    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    
    try {
      debugPrint("🔄 DEBUG: Getting credential...");
      final credential = await getCredential();
      debugPrint("🔄 DEBUG: Credential obtained, signing in with Firebase...");
      debugPrint("🔄 DEBUG: Credential provider: ${credential.providerId}");
      
      // CRITICAL iPad Fix: Don't rely on automatic navigation
      // Instead, manually handle the auth flow without letting AuthWrapper interfere
      
      await authService.signInWithCredential(credential);
      debugPrint("✅ DEBUG: Firebase sign-in successful!");

      // Store user data for biometric authentication
      final currentUser = FirebaseAuth.instance.currentUser;
      debugPrint('🔐 SOCIAL_LOGIN: Current user after auth: ${currentUser?.uid}');
      
      if (currentUser != null) {
        debugPrint('🔐 SOCIAL_LOGIN: Fetching user document from Firestore...');
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(currentUser.uid)
            .get();
            
        debugPrint('🔐 SOCIAL_LOGIN: User document exists: ${userDoc.exists}');
        
        if (userDoc.exists) {
          debugPrint('🔐 SOCIAL_LOGIN: Creating UserModel from Firestore data...');
          final userModel = UserModel.fromFirestore(userDoc);
          debugPrint('🔐 SOCIAL_LOGIN: UserModel created - Email: ${userModel.email}, UID: ${userModel.uid}');
          
          debugPrint('🔐 SOCIAL_LOGIN: Storing user data in SessionManager...');
          await SessionManager.instance.setCurrentUser(userModel);
          debugPrint('✅ SOCIAL_LOGIN: User data stored for biometric authentication');
        } else {
          debugPrint('❌ SOCIAL_LOGIN: User document does not exist in Firestore for UID: ${currentUser.uid}');
          
          // Sign out and show registration modal for social logins without existing accounts
          await FirebaseAuth.instance.signOut();
          if (mounted) {
            _showRegistrationRequiredModal();
          }
          return;
        }

        // Let the auth state listener handle navigation immediately
        debugPrint('🔄 NAVIGATION: Authentication successful, auth listener will handle navigation');
        
      } else {
        debugPrint('❌ SOCIAL_LOGIN: No current user found after authentication');
        throw Exception('Authentication succeeded but no user found');
      }

    } on FirebaseAuthException catch (e) {
      debugPrint("❌ DEBUG: FirebaseAuthException: ${e.code} - ${e.message}");

      // Check if this is a user cancellation disguised as a Firebase error
      if (_isUserCancellation(e.code, e.message)) {
        debugPrint('🔄 SOCIAL_LOGIN: User canceled sign-in (Firebase error), returning silently');
        return; // Exit gracefully without showing error
      }

      if (mounted) {
        scaffoldMessenger.showSnackBar(SnackBar(
            content: Text(e.message ?? 'Sign-in failed.'),
            backgroundColor: Colors.red));
      }
    } catch (e) {
      debugPrint("❌ DEBUG: Unexpected error: $e");

      // Enhanced user cancellation detection
      if (_isUserCancellation(null, e.toString())) {
        debugPrint('🔄 SOCIAL_LOGIN: User canceled sign-in, returning silently');
        return; // Exit gracefully without showing error
      }

      if (mounted) {
        scaffoldMessenger.showSnackBar(SnackBar(
            content: Text('Sign-in error: $e'),
            backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showRegistrationRequiredModal() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Row(
            children: [
              const Icon(
                Icons.info_outline,
                color: Colors.blue,
                size: 24,
              ),
              const SizedBox(width: 8),
              const Text(
                'Account Required',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'To use "Sign in with Apple", you must first create a Team Build Pro account.',
                style: TextStyle(fontSize: 16, height: 1.4),
              ),
              SizedBox(height: 16),
              Text(
                'Please tap "Create Account" below and choose "Sign up with Apple" to register your new account.',
                style: TextStyle(
                  fontSize: 16,
                  height: 1.4,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop(); // Close modal
                // Navigate to registration screen
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                    builder: (context) => NewRegistrationScreen(
                      appId: widget.appId,
                    ),
                  ),
                );
              },
              style: TextButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Create Account',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: const EntryAppBar(),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child:
                Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(
                'Login',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 32),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _emailController,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) => value == null || value.isEmpty
                          ? 'Please enter your email'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(labelText: 'Password'),
                      obscureText: true,
                      validator: (value) => value == null || value.isEmpty
                          ? 'Please enter your password'
                          : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _login,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 3))
                      : const Text('Login'),
                ),
              ),
              const SizedBox(height: 16),
              if (_biometricAvailable && _biometricEnabled && _hasStoredUser) ...[
                ElevatedButton.icon(
                  icon: const Icon(Icons.fingerprint, size: 24),
                  label: Text('Sign in with ${_storedEmail ?? 'Biometric'}'),
                  onPressed: _isLoading ? null : _showBiometricLogin,
                  style: ElevatedButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text('or', style: TextStyle(color: Colors.grey)),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              if (!kIsWeb && Platform.isIOS) ...[
                ElevatedButton.icon(
                  icon: const FaIcon(FontAwesomeIcons.apple,
                      color: Colors.white, size: 20),
                  label: const Text('Sign in with Apple'),
                  onPressed: _isLoading
                      ? null
                      : () => _signInWithSocial(_getAppleCredential),
                  style: ElevatedButton.styleFrom(
                    foregroundColor: Colors.white,
                    backgroundColor: Colors.black,
                  ),
                ),
                const SizedBox(height: 16),
              ],
              ElevatedButton.icon(
                icon: const FaIcon(FontAwesomeIcons.google, size: 20),
                label: const Text('Sign in with Google'),
                onPressed: _isLoading
                    ? null
                    : () => _signInWithSocial(_getGoogleCredential),
              ),
              const SizedBox(height: 32),
              
              // Create Account Link
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    "Don't have an account? ",
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      // Store context before async operations
                      final navigator = Navigator.of(context);
                      
                      // Clear any existing user data/state before registration
                      debugPrint('🔄 LOGIN: Clearing user data before registration...');
                      
                      // Clear session manager data
                      await SessionManager.instance.clearAllData();
                      debugPrint('✅ LOGIN: SessionManager data cleared');
                      
                      // Clear any stored Apple user data
                      _appleUserData = null;
                      debugPrint('✅ LOGIN: Apple user data cleared');
                      
                      // Clear form data
                      _emailController.clear();
                      _passwordController.clear();
                      debugPrint('✅ LOGIN: Form data cleared');
                      
                      // Navigate to registration screen
                      debugPrint('🔄 LOGIN: Navigating to registration screen...');
                      if (mounted) {
                        navigator.push(
                          MaterialPageRoute(
                            builder: (context) => NewRegistrationScreen(
                              appId: widget.appId,
                            ),
                          ),
                        );
                      }
                    },
                    child: const Text(
                      'Create Account',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              
              // Privacy Policy Footer
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              PrivacyPolicyScreen(appId: widget.appId),
                        ),
                      );
                    },
                    child: const Text(
                      'Privacy Policy',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                  const Text(
                    ' | ',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              TermsOfServiceScreen(appId: widget.appId),
                        ),
                      );
                    },
                    child: const Text(
                      'Terms of Service',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              )
            ]),
          ),
        ));
  }

  Future<AuthCredential> _getGoogleCredential() async {
    final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
    final GoogleSignInAuthentication? googleAuth =
        await googleUser?.authentication;
    if (googleAuth == null) throw Exception('Google sign-in aborted.');
    return GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
  }

  Future<AuthCredential> _getAppleCredential() async {
    final rawNonce = _generateNonce();
    final nonce = sha256.convert(utf8.encode(rawNonce)).toString();

    debugPrint("🍎 DEBUG: Starting Apple Sign In...");
    debugPrint("🍎 DEBUG: Device info - Platform: ${Platform.operatingSystem}, Model: ${Platform.operatingSystemVersion}");

    try {
      // Check if Sign in with Apple is available on this device
      final isAvailable = await SignInWithApple.isAvailable();
      debugPrint("🍎 DEBUG: Apple Sign-In available: $isAvailable");
      
      if (!isAvailable) {
        throw Exception('Apple Sign-In is not available on this device');
      }

      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName
        ],
        nonce: nonce,
        webAuthenticationOptions: kIsWeb 
          ? WebAuthenticationOptions(
              clientId: 'your-apple-client-id',
              redirectUri: Uri.parse('https://your-domain.com/auth/callback'),
            )
          : null,
      );
      
      debugPrint("✅ APPLE_DEBUG: Apple credential successfully obtained");
      
      return _processAppleCredential(appleCredential, rawNonce);
      
    } on SignInWithAppleAuthorizationException catch (e) {
      debugPrint("❌ APPLE_AUTHORIZATION_ERROR: Code: ${e.code}, Message: ${e.message}");
      
      switch (e.code) {
        case AuthorizationErrorCode.canceled:
        case AuthorizationErrorCode.unknown:  // Error 1000 - also user cancellation
          // Create a custom exception for user cancellation that we can handle differently
          debugPrint("🔄 APPLE_LOGIN: User canceled Apple Sign-In (${e.code}), treating as cancellation");
          throw Exception('USER_CANCELED_APPLE_SIGNIN');
        case AuthorizationErrorCode.failed:
          throw Exception('Apple Sign-In failed. Please check your Apple ID settings and try again.');
        case AuthorizationErrorCode.invalidResponse:
          throw Exception('Invalid response from Apple. Please try again.');
        case AuthorizationErrorCode.notHandled:
          throw Exception('Apple Sign-In not properly configured. Please contact support.');
        case AuthorizationErrorCode.notInteractive:
          throw Exception('Apple Sign-In requires user interaction. Please try again.');
        default:
          throw Exception('Unknown Apple Sign-In error. Please try again or contact support.');
      }
    } catch (e) {
      debugPrint("❌ APPLE_ERROR: Apple Sign-In failed: $e");
      debugPrint("❌ APPLE_ERROR: Error type: ${e.runtimeType}");
      
      // Handle specific iPad/iPadOS errors
      if (e.toString().contains('ASAuthorizationError') || 
          e.toString().contains('canceled') ||
          e.toString().contains('unknown')) {
        throw Exception('Apple Sign-In was canceled or failed. Please try again.');
      }
      
      rethrow;
    }
  }
  
  AuthCredential _processAppleCredential(AuthorizationCredentialAppleID appleCredential, String rawNonce) {
    debugPrint("🍎 DEBUG: Apple credential received: ${appleCredential.identityToken != null}");
    debugPrint("🍎 DEBUG: User identifier: ${appleCredential.userIdentifier}");
    debugPrint("🍎 DEBUG: Authorization code present: ${appleCredential.authorizationCode.isNotEmpty}");
    debugPrint("🍎 DEBUG: Identity token length: ${appleCredential.identityToken?.length ?? 0}");
    
    // Validate required fields for iPad compatibility
    if (appleCredential.identityToken == null) {
      debugPrint("❌ APPLE_ERROR: Missing identity token");
      throw Exception('Apple Sign-In failed: Missing identity token');
    }
    
    if (appleCredential.authorizationCode.isEmpty) {
      debugPrint("❌ APPLE_ERROR: Missing authorization code");
      throw Exception('Apple Sign-In failed: Missing authorization code');
    }
    
    // Store Apple-provided user data for creating user profile
    _appleUserData = {
      'email': appleCredential.email,
      'givenName': appleCredential.givenName,
      'familyName': appleCredential.familyName,
    };
    debugPrint("🍎 DEBUG: Apple user data stored: $_appleUserData");

    return OAuthProvider('apple.com').credential(
      idToken: appleCredential.identityToken,
      accessToken: appleCredential.authorizationCode,
      rawNonce: rawNonce,
    );
  }

  String _generateNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = math.Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  /// Enhanced detection for user cancellation across all authentication methods
  bool _isUserCancellation(String? errorCode, String? errorMessage) {
    final code = errorCode?.toLowerCase() ?? '';
    final message = (errorMessage ?? '').toLowerCase();

    // Check for explicit cancellation indicators
    final cancellationKeywords = [
      'user_canceled_apple_signin',
      'canceled',
      'cancelled',
      'user_cancelled',
      'user_canceled',
      'abort',
      'aborted',
      'dismiss',
      'dismissed',
      'close',
      'closed',
      'cancel',
      'network_canceled',
      'user-cancelled',
      'user-canceled',
      'googlesignin',
      'sign_in_canceled',
      'sign_in_cancelled',
      'authorization_canceled',
      'authorization_cancelled',
      'web_cancel_on_load',
      'web_closed_by_user',
      'popup_closed_by_user',
      'credential_canceled',
      'google sign-in aborted',  // Specific Google cancellation
      'sign-in aborted',  // Generic sign-in aborted
      'credential_cancelled',
    ];

    // Check for Firebase-specific cancellation error codes
    final firebaseCancellationCodes = [
      'cancelled',
      'canceled',
      'user-cancelled',
      'user-canceled',
      'web-storage-unsupported',
      'operation-not-allowed',
      'popup-closed-by-user',
      'cancelled-popup-request',
    ];

    // Check if error code indicates cancellation
    if (firebaseCancellationCodes.contains(code)) {
      return true;
    }

    // Check if message contains cancellation keywords
    for (final keyword in cancellationKeywords) {
      if (message.contains(keyword)) {
        return true;
      }
    }

    return false;
  }

}
