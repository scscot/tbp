// lib/screens/new_registration_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:crypto/crypto.dart';
import 'dart:math' as math;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/session_manager.dart';
import '../config/app_colors.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'edit_profile_screen.dart';
import 'admin_edit_profile_screen.dart';
import 'login_screen.dart';
import '../models/user_model.dart';
import '../main.dart';
import 'dart:async';

class NewRegistrationScreen extends StatefulWidget {
  final String? referralCode;
  final String appId;
  final String? queryType;

  const NewRegistrationScreen({
    super.key,
    this.referralCode,
    required this.appId,
    this.queryType,
  });

  @override
  State<NewRegistrationScreen> createState() => _NewRegistrationScreenState();
}

class _NewRegistrationScreenState extends State<NewRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String? _sponsorName;
  String? _initialReferralCode;
  bool _isLoading = true;
  bool _acceptedPrivacyPolicy = false;
  bool _isAppleSignUp = false;
  bool _isGoogleSignUp = false;
  Map<String, String?>? _appleUserData;
  bool _navigated = false;
  StreamSubscription<User?>? _authSub;

  bool isDevMode = true;

  @override
  void initState() {
    super.initState();
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (!mounted || user == null || _navigated) return;

      debugPrint('🔐 REGISTER: Auth state -> ${user.email} (${user.uid})');
      
      // CRITICAL: Don't interfere if we're actively processing Apple or Google sign-up
      if (_isAppleSignUp || _isGoogleSignUp) {
        debugPrint('🔐 REGISTER: Sign-up in progress, skipping auth state navigation');
        return;
      }

      try {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
          debugPrint('🧹 REGISTER: No user doc; signing out');
          await FirebaseAuth.instance.signOut();
          return;
        }

        // No arbitrary delays; wait exactly for a frame, then navigate
        await Future<void>.delayed(Duration.zero);

        final nav = navigatorKey.currentState;
        if (nav != null) {
          _navigated = true;            // guard against double navigation
          _authSub?.cancel();           // stop listening once we commit to UI
          nav.pushNamedAndRemoveUntil(
            '/',                        // AuthWrapper route
            (route) => false,
          );
          debugPrint('✅ REGISTER: Pushed AuthWrapper and cleared stack');
        }
      } catch (e) {
        debugPrint('❌ REGISTER: Error after auth: $e');
      }
    });
    _initializeScreen();
  }

  Future<void> _initializeScreen() async {
    debugPrint('🔍 NewRegistrationScreen._initializeScreen() called');
    debugPrint('🔍 Constructor parameters received:');
    debugPrint('🔍   widget.referralCode: ${widget.referralCode}');
    debugPrint('🔍   widget.appId: ${widget.appId}');

    // Prioritize fresh constructor parameters over cached data (for deep links)
    if (widget.referralCode != null && widget.referralCode!.isNotEmpty) {
      debugPrint('🔍 Using fresh constructor referral code: ${widget.referralCode}');
      _initialReferralCode = widget.referralCode;
      // Clear any stale cached data when fresh referral code is provided
      await SessionManager.instance.clearReferralData();
    } else {
      // Fallback: try to get cached referral data from SessionManager
      final cachedReferralData = await SessionManager.instance.getReferralData();

      if (cachedReferralData != null) {
        debugPrint('🔍 Using cached referral data');
        _initialReferralCode = cachedReferralData['referralCode'];
        _sponsorName = cachedReferralData['sponsorName'];
        debugPrint('🔍 Cached referral code: $_initialReferralCode');
        debugPrint('🔍 Cached sponsor name: $_sponsorName');
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      // Final fallback: no referral code at all
      _initialReferralCode = null;
    }

    debugPrint('🔍 After assignment:');
    debugPrint('🔍   _initialReferralCode: $_initialReferralCode');

    if (isDevMode && _initialReferralCode == null) {
      // _initialReferralCode = '88888888'; // Admin
      // _initialReferralCode = '28F37ECD'; // Direct
    }

    final code = _initialReferralCode;
    debugPrint('🔍 Using referral code: $code');

    if (code == null || code.isEmpty) {
      debugPrint('🔍 No referral code - admin registration');
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    // Only make HTTP request if we don't have cached data (fallback scenario)
    debugPrint(
        '🔍 Making HTTP request to get referral code data (fallback)...');
    try {
      final uri = Uri.parse(
          'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code');
      final response = await http.get(uri);

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final sponsorName =
            '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();

        setState(() {
          _sponsorName = sponsorName;
        });

        // Cache this data for future use
        await SessionManager.instance.setReferralData(code, sponsorName, queryType: widget.queryType);
        debugPrint(
            '✅ NewRegistrationScreen: Referral data cached from fallback');
      } else {
        debugPrint(
            'Failed to get sponsor data. Status code: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint("Error finding sponsor: $e.");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    // Skip form validation if this is social sign-up (already handled)
    if (_isAppleSignUp || _isGoogleSignUp) return;
    
    if (!_formKey.currentState!.validate() || _isLoading) return;

    if (!_acceptedPrivacyPolicy) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Please accept the Privacy Policy and Terms of Service to continue'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    final authService = context.read<AuthService>();
    final firestoreService = FirestoreService();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      debugPrint('🔍 REGISTER: Starting registration process...');

      final HttpsCallable callable =
          FirebaseFunctions.instanceFor(region: 'us-central1')
              .httpsCallable('registerUser');

      // Prepare registration data
      final registrationData = <String, dynamic>{
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'sponsorReferralCode': _initialReferralCode,
        'role': _initialReferralCode == null ? 'admin' : 'user',
      };

      debugPrint(
          '🔍 REGISTER: Registration data prepared: ${registrationData.toString()}');
      debugPrint('🔍 REGISTER: Calling registerUser Cloud Function...');

      final result =
          await callable.call<Map<String, dynamic>>(registrationData);
      debugPrint('🔍 REGISTER: Cloud Function call successful: ${result.data}');

      debugPrint('🔍 REGISTER: Attempting to sign in user...');
      final userCredential = await authService.signInWithEmailAndPassword(
        _emailController.text.trim(),
        _passwordController.text,
      );
      debugPrint(
          '🔍 REGISTER: Sign in successful, UID: ${userCredential.user?.uid}');

      debugPrint('🔍 REGISTER: Fetching user model from Firestore...');
      final userModel =
          await firestoreService.getUser(userCredential.user!.uid);

      if (userModel == null) {
        debugPrint('❌ REGISTER: Failed to fetch user model from Firestore');
        throw Exception("Failed to fetch new user profile.");
      }

      // Store user data for biometric authentication
      await SessionManager.instance.setCurrentUser(userModel);
      debugPrint('✅ REGISTER: User data stored for biometric authentication');

      debugPrint(
          '✅ REGISTER: User model fetched successfully: ${userModel.firstName} ${userModel.lastName}');

      // Clear referral data after successful registration
      await SessionManager.instance.clearReferralData();
      debugPrint(
          '🧹 REGISTER: Referral data cleared after successful registration');

      if (!mounted) return;

      // Navigate based on user role - bypass WelcomeScreen
      if (userModel.role == 'admin') {
        debugPrint(
            '🔍 REGISTER: Navigating admin user to AdminEditProfileScreen...');
        navigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (context) => AdminEditProfileScreen(appId: widget.appId),
          ),
          (Route<dynamic> route) => false,
        );
      } else {
        debugPrint(
            '🔍 REGISTER: Navigating regular user to EditProfileScreen...');
        navigator.pushAndRemoveUntil(
          MaterialPageRoute(
            builder: (context) => EditProfileScreen(
                appId: widget.appId, user: userModel, isFirstTimeSetup: true),
          ),
          (Route<dynamic> route) => false,
        );
      }
    } on FirebaseFunctionsException catch (e) {
      debugPrint(
          '❌ REGISTER: FirebaseFunctionsException - Code: ${e.code}, Message: ${e.message}');
      debugPrint(
          '❌ REGISTER: FirebaseFunctionsException - Details: ${e.details}');
      _showErrorSnackbar(
          scaffoldMessenger, e.message ?? 'Registration failed.');
    } on FirebaseAuthException catch (e) {
      debugPrint(
          '❌ REGISTER: FirebaseAuthException - Code: ${e.code}, Message: ${e.message}');
      _showErrorSnackbar(scaffoldMessenger, e.message ?? 'Login failed.');
    } catch (e, stackTrace) {
      debugPrint('❌ REGISTER: Unexpected error: $e');
      debugPrint('❌ REGISTER: Stack trace: $stackTrace');
      _showErrorSnackbar(scaffoldMessenger, 'An unexpected error occurred: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showErrorSnackbar(ScaffoldMessengerState messenger, String message) {
    messenger.showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: Colors.red,
    ));
  }

  void _navigateToLogin() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LoginScreen(appId: widget.appId),
      ),
    );
  }

  /// Apple Sign-In credential generation - native iOS flow
  Future<AuthCredential> _getAppleCredential() async {
    final rawNonce = _generateNonce();
    final nonce = sha256.convert(utf8.encode(rawNonce)).toString();

    debugPrint("🍎 REGISTER: Starting Apple Sign In...");

    try {
      // Check Apple Sign-In availability first
      if (!await SignInWithApple.isAvailable()) {
        throw Exception('Apple Sign-In is not available on this device');
      }

      late final AuthorizationCredentialAppleID appleCredential;

      if (kIsWeb) {
        // Web flow with proper Service ID
        appleCredential = await SignInWithApple.getAppleIDCredential(
          scopes: [
            AppleIDAuthorizationScopes.email,
            AppleIDAuthorizationScopes.fullName
          ],
          nonce: nonce,
          webAuthenticationOptions: WebAuthenticationOptions(
            clientId: 'com.scott.ultimatefix.auth', // Proper Service ID for web
            redirectUri: Uri.parse('https://teambuildpro.com/apple-signin-callback'),
          ),
        );
      } else {
        // Native iOS/iPadOS flow - NO webAuthenticationOptions
        appleCredential = await SignInWithApple.getAppleIDCredential(
          scopes: [
            AppleIDAuthorizationScopes.email,
            AppleIDAuthorizationScopes.fullName
          ],
          nonce: nonce,
          // IMPORTANT: No webAuthenticationOptions on iOS - uses native flow
        );
      }

      debugPrint("🍎 REGISTER: Apple credential received successfully");
      debugPrint("🍎 REGISTER: User identifier: ${appleCredential.userIdentifier}");
      
      // Store Apple-provided user data for creating user profile
      _appleUserData = {
        'email': appleCredential.email,
        'givenName': appleCredential.givenName,
        'familyName': appleCredential.familyName,
      };
      debugPrint("🍎 REGISTER: Apple user data stored: $_appleUserData");

      return OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
        rawNonce: rawNonce,
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      debugPrint("🍎 REGISTER: Apple Sign-In authorization error: ${e.code}");
      switch (e.code) {
        case AuthorizationErrorCode.canceled:
        case AuthorizationErrorCode.unknown:  // Error 1000 - also user cancellation
          debugPrint("🔄 APPLE_REGISTER: User canceled Apple Sign-In (${e.code}), treating as cancellation");
          throw Exception('USER_CANCELED_APPLE_SIGNIN');
        case AuthorizationErrorCode.failed:
        case AuthorizationErrorCode.invalidResponse:
        case AuthorizationErrorCode.notHandled:
        case AuthorizationErrorCode.notInteractive:
        default:
          rethrow;
      }
    }
  }

  String _generateNonce([int length = 32]) {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = math.Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)]).join();
  }

  /// Google Sign-In credential generation
  Future<AuthCredential> _getGoogleCredential() async {
    final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
    final GoogleSignInAuthentication? googleAuth = await googleUser?.authentication;
    if (googleAuth == null) throw Exception('Google sign-in aborted.');
    return GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
  }

  /// Handle Google Sign-In Registration
  Future<void> _signUpWithGoogle() async {
    if (_isLoading) return;
    
    setState(() {
      _isLoading = true;
      _isGoogleSignUp = true;
    });

    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      debugPrint("🔍 REGISTER: Getting Google credential...");
      final credential = await _getGoogleCredential();
      
      debugPrint("🔍 REGISTER: Credential obtained, signing up with Firebase...");
      await authService.signInWithCredential(credential);

      // Get current user after authentication
      final currentUser = FirebaseAuth.instance.currentUser;
      debugPrint('🔍 REGISTER: Current user after auth: ${currentUser?.uid}');
      
      if (currentUser != null) {
        debugPrint('🔍 REGISTER: Checking if user document exists...');
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(currentUser.uid)
            .get();
            
        if (userDoc.exists) {
          debugPrint('🔍 REGISTER: User already exists, treating as login...');
          // User already exists - this is effectively a login
          final userModel = UserModel.fromFirestore(userDoc);
          await SessionManager.instance.setCurrentUser(userModel);
          
          // Let the auth state listener handle navigation
          debugPrint('🔄 GOOGLE_REGISTER: User already exists, auth listener will handle navigation');
        } else {
          debugPrint('🔍 REGISTER: Creating new user profile with Google data...');
          await _createGoogleUserProfile(currentUser);
          
          // Navigate based on user role
          final userModel = await FirestoreService().getUser(currentUser.uid);
          if (userModel != null) {
            await SessionManager.instance.setCurrentUser(userModel);
            
            if (mounted) {
              if (userModel.role == 'admin') {
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => AdminEditProfileScreen(appId: widget.appId),
                  ),
                  (Route<dynamic> route) => false,
                );
              } else {
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(
                      appId: widget.appId, 
                      user: userModel, 
                      isFirstTimeSetup: true
                    ),
                  ),
                  (Route<dynamic> route) => false,
                );
              }
            }
          }
        }
      }

      debugPrint("✅ REGISTER: Google Sign-In registration successful!");

    } on FirebaseAuthException catch (e) {
      debugPrint("❌ REGISTER: Google Sign-In failed: ${e.code} - ${e.message}");
      scaffoldMessenger.showSnackBar(SnackBar(
          content: Text(e.message ?? 'Google Sign-In failed.'),
          backgroundColor: Colors.red));
    } catch (e) {
      debugPrint("❌ REGISTER: Unexpected Google Sign-In error: $e");

      // Check if this is a user cancellation
      if (_isUserCancellation(null, e.toString())) {
        debugPrint('🔄 GOOGLE_REGISTER: User canceled Google Sign-In, returning silently');
        return; // Exit gracefully without showing error
      }

      scaffoldMessenger.showSnackBar(const SnackBar(
          content: Text('An unexpected error occurred with Google Sign-In.'),
          backgroundColor: Colors.red));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isGoogleSignUp = false;
        });
      }
    }
  }

  /// Creates user profile for Google Sign-In using Google-provided data
  Future<void> _createGoogleUserProfile(User firebaseUser) async {
    try {
      debugPrint('🔍 GOOGLE_REGISTER: Creating user profile with Google data...');
      
      // Use Google-provided data
      final email = firebaseUser.email ?? '';
      final displayName = firebaseUser.displayName ?? '';
      final nameParts = displayName.split(' ');
      final firstName = nameParts.isNotEmpty ? nameParts.first : 'Google';
      final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : 'User';
      
      debugPrint('🔍 GOOGLE_REGISTER: Email: $email, FirstName: $firstName, LastName: $lastName');

      // Create user document in Firestore
      final userDoc = FirebaseFirestore.instance.collection('users').doc(firebaseUser.uid);
      
      final userData = {
        'uid': firebaseUser.uid,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'photoUrl': firebaseUser.photoURL,
        'role': _initialReferralCode == null ? 'admin' : 'user',
        'isActive': true,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
        'authProvider': 'google',
        'subscriptionStatus': 'trial',
        'trialStartDate': FieldValue.serverTimestamp(),
        'country': 'US', // Default country
        'deviceSelection': 'both', // Default for Google users
        'notificationsEnabled': true,
        'soundEnabled': true,
        'sponsorReferralCode': _initialReferralCode,
      };

      await userDoc.set(userData);
      debugPrint('✅ GOOGLE_REGISTER: User profile created successfully in Firestore');

      // Clear referral data after successful registration
      await SessionManager.instance.clearReferralData();
      debugPrint('🧹 GOOGLE_REGISTER: Referral data cleared after successful registration');

    } catch (e) {
      debugPrint('❌ GOOGLE_REGISTER: Error creating user profile: $e');
      rethrow;
    }
  }

  /// Handle Apple Sign-In Registration
  Future<void> _signUpWithApple() async {
    if (_isLoading) return;
    
    setState(() {
      _isLoading = true;
      _isAppleSignUp = true;
    });

    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      debugPrint("🍎 REGISTER: Getting Apple credential...");
      final credential = await _getAppleCredential();
      
      debugPrint("🍎 REGISTER: Credential obtained, signing up with Firebase...");
      await authService.signInWithCredential(credential);

      // Get current user after authentication
      final currentUser = FirebaseAuth.instance.currentUser;
      debugPrint('🍎 REGISTER: Current user after auth: ${currentUser?.uid}');
      
      if (currentUser != null) {
        debugPrint('🍎 REGISTER: Checking if user document exists...');
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(currentUser.uid)
            .get();
            
        if (userDoc.exists) {
          debugPrint('🍎 REGISTER: User already exists, treating as login...');
          // User already exists - this is effectively a login
          final userModel = UserModel.fromFirestore(userDoc);
          await SessionManager.instance.setCurrentUser(userModel);
          
          // Let the auth state listener handle navigation
          debugPrint('🔄 APPLE_REGISTER: User already exists, auth listener will handle navigation');
        } else {
          debugPrint('🍎 REGISTER: Creating new user profile with Apple data...');
          await _createAppleUserProfile(currentUser);
          
          // Navigate based on user role
          final userModel = await FirestoreService().getUser(currentUser.uid);
          if (userModel != null) {
            await SessionManager.instance.setCurrentUser(userModel);
            
            if (mounted) {
              if (userModel.role == 'admin') {
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => AdminEditProfileScreen(appId: widget.appId),
                  ),
                  (Route<dynamic> route) => false,
                );
              } else {
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => EditProfileScreen(
                      appId: widget.appId, 
                      user: userModel, 
                      isFirstTimeSetup: true
                    ),
                  ),
                  (Route<dynamic> route) => false,
                );
              }
            }
          }
        }
      }

      debugPrint("✅ REGISTER: Apple Sign-In registration successful!");

    } on FirebaseAuthException catch (e) {
      debugPrint("❌ REGISTER: Apple Sign-In failed: ${e.code} - ${e.message}");

      // Check if this is a user cancellation disguised as a Firebase error
      if (_isUserCancellation(e.code, e.message)) {
        debugPrint('🔄 APPLE_REGISTER: User canceled Apple Sign-In (Firebase error), returning silently');
        return; // Exit gracefully without showing error
      }

      scaffoldMessenger.showSnackBar(SnackBar(
          content: Text(e.message ?? 'Apple Sign-In failed.'),
          backgroundColor: Colors.red));
    } catch (e) {
      debugPrint("❌ REGISTER: Unexpected Apple Sign-In error: $e");

      // Enhanced user cancellation detection
      if (_isUserCancellation(null, e.toString())) {
        debugPrint('🔄 APPLE_REGISTER: User canceled Apple Sign-In, returning silently');
        return; // Exit gracefully without showing error
      }

      // Handle Apple Sign-In availability error
      if (e.toString().contains('not available')) {
        scaffoldMessenger.showSnackBar(const SnackBar(
            content: Text('Apple Sign-In is not available. Please use email registration.'),
            backgroundColor: Colors.orange));
        return;
      }

      // Handle authentication errors
      if (e.toString().contains('authentication') || e.toString().contains('credential')) {
        scaffoldMessenger.showSnackBar(const SnackBar(
            content: Text('Apple authentication failed. Please try again or use email registration.'),
            backgroundColor: Colors.red));
        return;
      }

      scaffoldMessenger.showSnackBar(const SnackBar(
          content: Text('Unable to Sign up with Apple. Please try email registration.'),
          backgroundColor: Colors.red));
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isAppleSignUp = false;
        });
      }
    }
  }

  /// Creates user profile for Apple Sign-In using Apple-provided data
  Future<void> _createAppleUserProfile(User firebaseUser) async {
    try {
      if (_appleUserData == null) {
        debugPrint('❌ APPLE_REGISTER: No Apple user data available');
        return;
      }

      debugPrint('🍎 APPLE_REGISTER: Creating user profile with Apple data...');
      
      // Use Apple-provided data or fallback to Firebase Auth data
      final email = _appleUserData!['email'] ?? firebaseUser.email ?? '';
      final firstName = _appleUserData!['givenName'] ?? 'Apple';
      final lastName = _appleUserData!['familyName'] ?? 'User';
      
      debugPrint('🍎 APPLE_REGISTER: Email: $email, FirstName: $firstName, LastName: $lastName');

      // Create user document in Firestore
      final userDoc = FirebaseFirestore.instance.collection('users').doc(firebaseUser.uid);
      
      final userData = {
        'uid': firebaseUser.uid,
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'photoUrl': firebaseUser.photoURL,
        'role': _initialReferralCode == null ? 'admin' : 'user',
        'isActive': true,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
        'authProvider': 'apple',
        'subscriptionStatus': 'trial',
        'trialStartDate': FieldValue.serverTimestamp(),
        'country': 'US', // Default country
        'deviceSelection': 'ios', // Default for Apple users
        'notificationsEnabled': true,
        'soundEnabled': true,
        'sponsorReferralCode': _initialReferralCode,
      };

      await userDoc.set(userData);
      debugPrint('✅ APPLE_REGISTER: User profile created successfully in Firestore');

      // Clear Apple user data after successful creation
      _appleUserData = null;

      // Clear referral data after successful registration
      await SessionManager.instance.clearReferralData();
      debugPrint('🧹 APPLE_REGISTER: Referral data cleared after successful registration');

    } catch (e) {
      debugPrint('❌ APPLE_REGISTER: Error creating user profile: $e');
      _appleUserData = null;
      rethrow;
    }
  }

  /// Helper method to detect user cancellation vs actual errors
  bool _isUserCancellation(String? errorCode, String? errorMessage) {
    final code = errorCode?.toLowerCase() ?? '';
    final message = (errorMessage ?? '').toLowerCase();

    // Check for our specific Apple cancellation marker first
    if (message.contains('user_canceled_apple_signin')) {
      return true;
    }

    // Apple Sign-In and Google Sign-In cancellation keywords
    final cancellationKeywords = [
      'user_cancelled',
      'user_canceled',
      'cancelled',
      'canceled',
      'user cancelled',
      'user canceled',
      'user_cancelled_authorize',
      'user_cancelled_login',
      'authorization_cancelled',
      'authorization_canceled',
      'user interaction was cancelled',
      'user interaction was canceled',
      'the user canceled',
      'the user cancelled',
      'operation_cancelled',
      'operation_canceled',
      'request was cancelled',
      'request was canceled',
      'user closed',
      'user dismissed',
      'user pressed cancel',
      'authentication cancelled',
      'authentication canceled',
      'sign_in_cancelled',
      'sign_in_canceled',
      'apple_id_auth_cancelled',
      'apple_id_auth_canceled',
      'cancelled by user',
      'canceled by user',
      'user aborted',
      'user declined',
      'user rejected',
      'authorization denied by user',
      'access_denied',
      'user_denied',
      'authentication_cancelled',
      'authentication_canceled',
      'login_cancelled',
      'login_canceled',
      'abort',
      'aborted',  // Added for Google Sign-In
      'dismiss',
      'close',
      'user backed out',
      'user exited',
      'flow cancelled',
      'flow canceled',
      'signin_cancelled',
      'signin_canceled',
      'google sign-in aborted',  // Specific Google cancellation
      'sign-in aborted'  // Generic sign-in aborted
    ];

    // Check error code first
    if (code.isNotEmpty) {
      for (final keyword in cancellationKeywords) {
        if (code.contains(keyword)) {
          return true;
        }
      }
    }

    // Check error message
    for (final keyword in cancellationKeywords) {
      if (message.contains(keyword)) {
        return true;
      }
    }

    return false;
  }

  PreferredSizeWidget _buildCustomAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      automaticallyImplyLeading: false,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0A0E27),
              Color(0xFF1A237E),
              Color(0xFF3949AB),
            ],
          ),
        ),
      ),
      leading: IconButton(
        icon: const Icon(
          Icons.arrow_back,
          color: Colors.white,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ),
      title: const Text(
        'TEAM BUILD PRO',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      centerTitle: true,
      actions: [
        TextButton(
          onPressed: _navigateToLogin,
          style: TextButton.styleFrom(
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.login,
                color: Colors.white,
                size: 18,
              ),
              SizedBox(width: 6),
              Text(
                'Log In',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildCustomAppBar(context),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Account Registration',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    if (_sponsorName != null && _sponsorName!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4.0, bottom: 16.0),
                        child: Text(
                          'Your sponsor is $_sponsorName',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                    const SizedBox(height: 24),
                    
                    // Social Sign-In Section
                    if (!kIsWeb && Platform.isIOS) ...[
                      ElevatedButton.icon(
                        icon: const FaIcon(FontAwesomeIcons.apple,
                            color: Colors.white, size: 20),
                        label: const Text('Sign up with Apple'),
                        onPressed: (_isLoading && !_isAppleSignUp) ? null : _signUpWithApple,
                        style: ElevatedButton.styleFrom(
                          foregroundColor: Colors.white,
                          backgroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          minimumSize: const Size(double.infinity, 50),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    
                    ElevatedButton.icon(
                      icon: const FaIcon(FontAwesomeIcons.google, size: 20),
                      label: const Text('Sign up with Google'),
                      onPressed: (_isLoading && !_isGoogleSignUp) ? null : _signUpWithGoogle,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    const Row(
                      children: [
                        Expanded(child: Divider()),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Text('or sign up with email', 
                            style: TextStyle(
                              color: Colors.grey,
                              fontSize: 14,
                            )
                          ),
                        ),
                        Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 24),
                    
                    TextFormField(
                        controller: _firstNameController,
                        decoration: const InputDecoration(
                          labelText: 'First Name',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _lastNameController,
                        decoration: const InputDecoration(
                          labelText: 'Last Name',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),

                    // Create Your Login section with privacy assurance
                    Container(
                      margin: const EdgeInsets.symmetric(vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Create Your Login',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '🔒 Your email will never be shared with anyone',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Colors.black,
                                      fontStyle: FontStyle.italic,
                                    ),
                          ),
                        ],
                      ),
                    ),

                    TextFormField(
                        controller: _emailController,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) => v == null || !v.contains('@')
                            ? 'A valid email is required'
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _passwordController,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        obscureText: true,
                        validator: (v) => (v?.length ?? 0) < 6
                            ? 'Password must be at least 6 characters'
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _confirmPasswordController,
                        decoration: const InputDecoration(
                          labelText: 'Confirm Password',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        obscureText: true,
                        validator: (v) => v != _passwordController.text
                            ? 'Passwords do not match'
                            : null),
                    const SizedBox(height: 24),

                    // Privacy Policy Agreement
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundSecondary,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Checkbox(
                                value: _acceptedPrivacyPolicy,
                                onChanged: (value) {
                                  setState(() {
                                    _acceptedPrivacyPolicy = value ?? false;
                                  });
                                },
                                activeColor: AppColors.primary,
                              ),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _acceptedPrivacyPolicy =
                                          !_acceptedPrivacyPolicy;
                                    });
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: RichText(
                                      text: TextSpan(
                                        style: const TextStyle(
                                          fontSize: 14,
                                          color: AppColors.textSecondary,
                                          height: 1.4,
                                        ),
                                        children: [
                                          const TextSpan(
                                              text: 'I agree to the '),
                                          WidgetSpan(
                                            child: GestureDetector(
                                              onTap: () {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (context) =>
                                                        PrivacyPolicyScreen(
                                                      appId: widget.appId,
                                                    ),
                                                  ),
                                                );
                                              },
                                              child: const Text(
                                                'Privacy Policy',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  color: AppColors.primary,
                                                  fontWeight: FontWeight.w600,
                                                  decoration:
                                                      TextDecoration.underline,
                                                ),
                                              ),
                                            ),
                                          ),
                                          const TextSpan(text: ' and '),
                                          WidgetSpan(
                                            child: GestureDetector(
                                              onTap: () {
                                                Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                    builder: (context) =>
                                                        TermsOfServiceScreen(
                                                      appId: widget.appId,
                                                    ),
                                                  ),
                                                );
                                              },
                                              child: const Text(
                                                'Terms of Service',
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  color: AppColors.primary,
                                                  fontWeight: FontWeight.w600,
                                                  decoration:
                                                      TextDecoration.underline,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '🔒 Required for account creation',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textTertiary,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _register,
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 3),
                              )
                            : const Text('Create Account with Email'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
