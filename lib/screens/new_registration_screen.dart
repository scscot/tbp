// lib/screens/new_registration_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb, kDebugMode;
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:crypto/crypto.dart';
import 'dart:math' as math;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/session_manager.dart';
import '../services/clipboard_helper.dart';
import '../widgets/localized_text.dart';
import '../config/app_colors.dart';
import '../i18n/analytics_events.dart';
import 'edit_profile_screen.dart';
import 'admin_edit_profile_screen.dart';
import 'login_screen_enhanced.dart';
import '../models/user_model.dart';
import '../main.dart';
import 'dart:async';

class NewRegistrationScreen extends StatefulWidget {
  final String? referralCode;
  final String appId;
  final String? queryType;
  final bool? showBackButton;

  const NewRegistrationScreen({
    super.key,
    this.referralCode,
    required this.appId,
    this.queryType,
    this.showBackButton,
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
  String? _referralSource; // Track source: 'constructor', 'branch', 'cache'
  bool _userHasStartedForm = false; // Track if user has started entering data
  bool _userHasStartedRegistration = false; // Track if registration process has begun
  bool _isLoading = true;
  bool _acceptedPrivacyPolicy = false;
  bool _isAppleSignUp = false;
  bool _isGoogleSignUp = false;
  Map<String, String?>? _appleUserData;
  bool _navigated = false;
  StreamSubscription<User?>? _authSub;
  bool _isAppleSignInAvailable = false;
  bool _isGoogleSignInAvailable = false;

  // Clipboard paste affordance - hidden by default, revealed on demand
  bool _canOfferPaste = false;
  bool _checkedPasteOffer = false;
  bool _showPasteUI = false;

  bool isDevMode = true;

  @override
  void initState() {
    super.initState();

    FirebaseAnalytics.instance.logEvent(
      name: AnalyticsEvents.authView,
      parameters: {'screen': 'signup'},
    );

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
    _checkAppleSignInAvailability();
    _checkGoogleSignInAvailability();
    _setupFormListeners();

    // After first frame, check if clipboard has content (for "I have an invite link" fallback)
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || _checkedPasteOffer) return;
      _checkedPasteOffer = true;

      // Check if clipboard has content, but don't show paste UI automatically
      if (_initialReferralCode == null || _initialReferralCode!.isEmpty) {
        final offer = await ClipboardHelper.shouldOfferPaste();
        if (mounted) {
          setState(() => _canOfferPaste = offer);
        }
      }
    });
  }

  Future<void> _checkAppleSignInAvailability() async {
    // TEMPORARILY DISABLED FOR APP STORE APPROVAL
    debugPrint('🍎 REGISTER: Apple Sign-In temporarily disabled for App Store approval');
    if (mounted) {
      setState(() {
        _isAppleSignInAvailable = false;
      });
    }
  }

  Future<void> _checkGoogleSignInAvailability() async {
    // TEMPORARILY DISABLED FOR APP STORE APPROVAL
    debugPrint('🔵 REGISTER: Google Sign-In temporarily disabled for App Store approval');
    if (mounted) {
      setState(() {
        _isGoogleSignInAvailable = false;
      });
    }
  }

  void _setupFormListeners() {
    // Set up listeners to track when user starts entering form data
    _firstNameController.addListener(_onFormInput);
    _lastNameController.addListener(_onFormInput);
    _emailController.addListener(_onFormInput);
    _passwordController.addListener(_onFormInput);
    _confirmPasswordController.addListener(_onFormInput);
  }

  void _onFormInput() {
    if (!_userHasStartedForm &&
        (_firstNameController.text.isNotEmpty ||
         _lastNameController.text.isNotEmpty ||
         _emailController.text.isNotEmpty ||
         _passwordController.text.isNotEmpty ||
         _confirmPasswordController.text.isNotEmpty)) {

      setState(() {
        _userHasStartedForm = true;
      });

      if (kDebugMode) {
        debugPrint('🔍 REGISTER: User has started entering form data');
      }
    }
  }

  /// Handle inline paste button tap
  Future<void> _handlePasteReferral() async {
    final referralCode = await ClipboardHelper.pasteAndValidateReferral();

    if (referralCode == null) {
      if (kDebugMode) {
        debugPrint('📋 REGISTER: Paste failed - invalid or empty clipboard');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('That doesn\'t look like an invite link. Please paste the full link you received.'),
            duration: Duration(seconds: 3),
          ),
        );
      }
      return;
    }

    if (kDebugMode) {
      debugPrint('📋 REGISTER: Pasted invite link with referral code: $referralCode');
    }

    setState(() {
      _canOfferPaste = false;
      _showPasteUI = false;
    });

    await _initializeScreen();
  }

  /// Shows dialog when new referral code conflicts with user-entered data
  Future<bool> _showReferralOverwriteDialog(String newReferralCode, String newSource) async {
    debugPrint('🔍 OVERWRITE DIALOG: Showing referral code overwrite dialog');
    debugPrint('🔍 OVERWRITE DIALOG: Current code: $_initialReferralCode (source: $_referralSource)');
    debugPrint('🔍 OVERWRITE DIALOG: New code: $newReferralCode (source: $newSource)');

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('New Referral Code Detected'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('A new referral code has been detected:'),
              const SizedBox(height: 8),
              Text('New code: $newReferralCode'),
              Text('Source: $newSource'),
              const SizedBox(height: 8),
              if (_initialReferralCode != null) ...[
                Text('Current code: $_initialReferralCode'),
                Text('Current source: $_referralSource'),
                const SizedBox(height: 8),
              ],
              const Text('Would you like to update your referral code?'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Keep Current'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Use New Code'),
            ),
          ],
        );
      },
    ) ?? false;

    // Audit logging for overwrite decision
    if (result) {
      debugPrint('🔍 OVERWRITE AUDIT: User ACCEPTED referral code overwrite');
      debugPrint('🔍 OVERWRITE AUDIT: Changed from $_initialReferralCode ($_referralSource) to $newReferralCode ($newSource)');
    } else {
      debugPrint('🔍 OVERWRITE AUDIT: User REJECTED referral code overwrite');
      debugPrint('🔍 OVERWRITE AUDIT: Kept $_initialReferralCode ($_referralSource), rejected $newReferralCode ($newSource)');
    }

    return result;
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
      _referralSource = 'constructor';
      // Clear any stale cached data when fresh referral code is provided
      await SessionManager.instance.clearReferralData();
    } else {
      // Fallback: try to get cached referral data from SessionManager
      final cachedReferralData = await SessionManager.instance.getReferralData();

      debugPrint('[TBP-REG-INIT] SessionManager => ${cachedReferralData?.toString() ?? 'null'}');

      if (cachedReferralData != null) {
        debugPrint('[TBP-REG-INIT] Using cached referral data');
        final newReferralCode = cachedReferralData['referralCode'];
        final newSponsorName = cachedReferralData['sponsorName'];

        // Check if user has started entering form data and we have a different referral code
        if (_userHasStartedForm && _initialReferralCode != null &&
            _initialReferralCode != newReferralCode) {
          debugPrint('🔍 REGISTER: Potential referral code conflict detected');
          debugPrint('🔍 Current: $_initialReferralCode, New: $newReferralCode');

          // Prevent overwrite if registration has already started
          if (_userHasStartedRegistration) {
            debugPrint('🔍 REGISTER: Registration already started - preventing referral code overwrite');
            if (mounted) setState(() => _isLoading = false);
            return;
          }

          // Show overwrite dialog
          final shouldOverwrite = await _showReferralOverwriteDialog(newReferralCode!, 'branch');
          if (shouldOverwrite) {
            _initialReferralCode = newReferralCode;
            _sponsorName = newSponsorName;
            _referralSource = 'branch';
            debugPrint('🔍 User confirmed referral code overwrite');
          } else {
            debugPrint('🔍 User declined referral code overwrite');
            if (mounted) setState(() => _isLoading = false);
            return;
          }
        } else {
          _initialReferralCode = newReferralCode;
          _sponsorName = newSponsorName;
          _referralSource = 'cache'; // Could be from Branch or previous session
        }

        debugPrint('🔍 Cached referral code: $_initialReferralCode (source: $_referralSource)');
        debugPrint('🔍 Cached sponsor name: $_sponsorName');
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      // Clipboard fallback: check for TBP_REF payload (from claim.html flow)
      try {
        final clipboardData = await Clipboard.getData('text/plain');
        final text = clipboardData?.text ?? '';

        // Parse TBP_REF payload: TBP_REF:{sponsor};TKN:{token};T:{t};V:{version}
        // V: is optional for backward compatibility with older payloads
        final regex = RegExp(r'TBP_REF:([^;]*);TKN:([^;]*);T:([0-9]+)(?:;V:([0-9]+))?');
        final match = regex.firstMatch(text);

        if (match != null) {
          final clipboardSponsor = match.group(1) ?? '';
          final clipboardToken = match.group(2) ?? '';

          if (clipboardSponsor.isNotEmpty) {
            debugPrint('🔍 REGISTER: Found TBP_REF payload in clipboard - sponsor=$clipboardSponsor, token=${clipboardToken.substring(0, 8)}...');

            _initialReferralCode = clipboardSponsor;
            _referralSource = 'clipboard_fallback';

            // Store in SessionManager for future use
            await SessionManager.instance.setReferralData(
              clipboardSponsor,
              '', // sponsor name will be resolved later
              queryType: widget.queryType,
              source: 'clipboard_fallback'
            );

            // Clear clipboard to prevent reprocessing
            await Clipboard.setData(const ClipboardData(text: ''));
            debugPrint('✅ REGISTER: Clipboard referral applied and cleared');

            // Continue to resolve sponsor name below
          }
        }
      } catch (e) {
        debugPrint('🔍 REGISTER: Clipboard fallback check failed (expected on web): $e');
      }
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

  /// Consumes clipboard if TBP_REF payload is present (gesture-based for iOS permissions)
  Future<void> _consumeClipboardIfPresent() async {
    try {
      final clipboardData = await Clipboard.getData('text/plain');
      final text = clipboardData?.text ?? '';

      debugPrint('[TBP-CLIPBOARD] Checking clipboard: ${text.isNotEmpty ? "has content" : "empty"}');

      // Parse TBP_REF payload: TBP_REF:{sponsor};TKN:{token};T:{t};V:{version}
      // V: is optional for backward compatibility
      final regex = RegExp(r'TBP_REF:([^;]*);TKN:([^;]*);T:([0-9]+)(?:;V:([0-9]+))?');
      final match = regex.firstMatch(text);

      if (match != null) {
        final clipboardSponsor = match.group(1) ?? '';
        final clipboardToken = match.group(2) ?? '';
        final clipboardT = match.group(3) ?? '1';

        if (clipboardSponsor.isNotEmpty) {
          debugPrint('[TBP-CLIPBOARD] Found payload - sponsor=$clipboardSponsor token=${clipboardToken.substring(0, 8)}... t=$clipboardT');

          // Apply to current registration if not already set
          if (_initialReferralCode == null || _initialReferralCode!.isEmpty) {
            _initialReferralCode = clipboardSponsor;
            _referralSource = 'clipboard_gesture';

            // Store in SessionManager
            await SessionManager.instance.setReferralData(
              clipboardSponsor,
              '', // sponsor name will be fetched below
              queryType: widget.queryType,
              source: 'clipboard_gesture',
              campaignType: clipboardT
            );

            debugPrint('[TBP-CLIPBOARD] Applied and stored - ref=$_initialReferralCode source=$_referralSource');

            // Fetch sponsor name from backend
            try {
              final uri = Uri.parse(
                'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$clipboardSponsor');
              final response = await http.get(uri);

              if (response.statusCode == 200) {
                final data = jsonDecode(response.body);
                final sponsorName = '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();

                _sponsorName = sponsorName;

                // Update SessionManager with sponsor name
                await SessionManager.instance.setReferralData(
                  clipboardSponsor,
                  sponsorName,
                  queryType: widget.queryType,
                  source: 'clipboard_gesture',
                  campaignType: clipboardT
                );

                debugPrint('[TBP-CLIPBOARD] Sponsor name resolved: $sponsorName');
              } else {
                debugPrint('[TBP-CLIPBOARD] Failed to fetch sponsor name: ${response.statusCode}');
              }
            } catch (e) {
              debugPrint('[TBP-CLIPBOARD] Error fetching sponsor name: $e');
            }
          } else {
            debugPrint('[TBP-CLIPBOARD] Payload found but already have ref=$_initialReferralCode');
          }

          // Clear clipboard to prevent reprocessing
          await Clipboard.setData(const ClipboardData(text: ''));
          debugPrint('[TBP-CLIPBOARD] Cleared clipboard');
        }
      } else {
        debugPrint('[TBP-CLIPBOARD] No TBP_REF payload found');
      }
    } catch (e) {
      debugPrint('[TBP-CLIPBOARD] Check failed: $e');
    }
  }

  Future<void> _register() async {
    // Skip form validation if this is social sign-up (already handled)
    if (_isAppleSignUp || _isGoogleSignUp) return;

    if (!_formKey.currentState!.validate() || _isLoading) return;

    if (!_acceptedPrivacyPolicy) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              context.l10n?.authSignupTosRequired ?? 'Please accept the Privacy Policy and Terms of Service to continue'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    FirebaseAnalytics.instance.logEvent(
      name: AnalyticsEvents.authSubmit,
      parameters: {'method': 'email', 'screen': 'signup'},
    );

    setState(() {
      _isLoading = true;
      _userHasStartedRegistration = true; // Mark registration as started
    });

    final authService = context.read<AuthService>();
    final firestoreService = FirestoreService();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    // Check clipboard for TBP_REF payload (iOS requires user gesture)
    // Done after capturing context values to avoid async gap warnings
    await _consumeClipboardIfPresent();

    try {
      debugPrint('🔍 REGISTER: Starting registration process...');

      final HttpsCallable callable =
          FirebaseFunctions.instanceFor(region: 'us-central1')
              .httpsCallable('registerUser');

      // Prepare registration data
      String deviceLanguage = 'en';
      try {
        final locale = Platform.localeName;
        final languageCode = locale.split('_')[0].toLowerCase();
        if (['en', 'es', 'pt', 'de'].contains(languageCode)) {
          deviceLanguage = languageCode;
        }
        debugPrint('🌍 REGISTER: Device language detected: $deviceLanguage (from locale: $locale)');
      } catch (e) {
        debugPrint('⚠️ REGISTER: Could not detect device language, defaulting to English: $e');
      }

      final registrationData = <String, dynamic>{
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'sponsorReferralCode': _initialReferralCode,
        'referralSource': _referralSource, // Track attribution source
        'role': _initialReferralCode == null ? 'admin' : 'user',
        'preferredLanguage': deviceLanguage,
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

      FirebaseAnalytics.instance.logEvent(
        name: AnalyticsEvents.authError,
        parameters: {
          'screen': 'signup',
          'method': 'email',
          'code': e.code,
          'message': e.message ?? 'Registration failed',
        },
      );

      _showErrorSnackbar(
          scaffoldMessenger, e.message ?? 'Registration failed.');
    } on FirebaseAuthException catch (e) {
      debugPrint(
          '❌ REGISTER: FirebaseAuthException - Code: ${e.code}, Message: ${e.message}');

      FirebaseAnalytics.instance.logEvent(
        name: AnalyticsEvents.authError,
        parameters: {
          'screen': 'signup',
          'method': 'email',
          'code': e.code,
          'message': e.message ?? 'Login failed',
        },
      );

      _showErrorSnackbar(scaffoldMessenger, e.message ?? 'Login failed.');
    } catch (e, stackTrace) {
      debugPrint('❌ REGISTER: Unexpected error: $e');
      debugPrint('❌ REGISTER: Stack trace: $stackTrace');

      FirebaseAnalytics.instance.logEvent(
        name: AnalyticsEvents.authError,
        parameters: {
          'screen': 'signup',
          'method': 'email',
          'message': e.toString(),
        },
      );

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
        builder: (context) => LoginScreenEnhanced(appId: widget.appId),
      ),
    );
  }

  /// Apple Sign-In credential generation - native iOS flow
  Future<AuthCredential> _getAppleCredential() async {
    final rawNonce = _generateNonce();
    final nonce = sha256.convert(utf8.encode(rawNonce)).toString();

    debugPrint("🍎 REGISTER: Starting Apple Sign In...");

    try {
      // Check Apple Sign-In availability first (should already be checked, but double-check for safety)
      if (!await SignInWithApple.isAvailable()) {
        debugPrint('🔄 APPLE_REGISTER: Apple Sign-In not available on this device');
        throw Exception('USER_CANCELED_APPLE_SIGNIN'); // Use cancellation marker for silent handling
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
        'referralSource': _referralSource, // Track attribution source
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
        debugPrint('🔄 APPLE_REGISTER: Apple Sign-In not available on device');
        // Show brief, non-disruptive info message
        scaffoldMessenger.showSnackBar(const SnackBar(
            content: Text('Apple Sign-In is not available on this device'),
            backgroundColor: Colors.blue,
            duration: Duration(seconds: 2)));
        return;
      }

      // Handle authentication errors
      if (e.toString().contains('authentication') || e.toString().contains('credential')) {
        debugPrint('🔄 APPLE_REGISTER: Apple authentication failed, returning silently');
        // Don't show error message - just return silently for better UX
        return;
      }

      // Handle network and other transient errors silently
      if (e.toString().contains('network') ||
          e.toString().contains('timeout') ||
          e.toString().contains('connection') ||
          e.toString().contains('unavailable')) {
        debugPrint('🔄 APPLE_REGISTER: Network/connection issue, returning silently');
        return;
      }

      // Only show error for truly unexpected errors
      debugPrint('❌ APPLE_REGISTER: Unexpected error, showing minimal notification');
      scaffoldMessenger.showSnackBar(const SnackBar(
          content: Text('Apple Sign-In is temporarily unavailable'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 2)));
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
        'referralSource': _referralSource, // Track attribution source
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
    // Smart back button logic: show only when there's a valid previous screen
    final shouldShowBackButton = widget.showBackButton ?? Navigator.canPop(context);

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
      leading: shouldShowBackButton ? IconButton(
        icon: const Icon(
          Icons.arrow_back,
          color: Colors.white,
        ),
        onPressed: () => Navigator.of(context).pop(),
      ) : null,
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
                    // Prominent "Confirm sponsor" button (only if no ref yet)
                    if ((_initialReferralCode == null || _initialReferralCode!.isEmpty) &&
                        (!Platform.isIOS || _canOfferPaste))
                      Container(
                        margin: const EdgeInsets.only(bottom: 16.0),
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.card_giftcard),
                          label: const Text('Tap to confirm your sponsor'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0A66FF),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                          ),
                          onPressed: () async {
                            final messenger = ScaffoldMessenger.of(context);
                            await _consumeClipboardIfPresent();
                            if (_initialReferralCode != null && mounted) {
                              setState(() {});
                            } else if (mounted) {
                              messenger.showSnackBar(
                                const SnackBar(
                                  content: Text('Sorry, no sponsor found'),
                                  backgroundColor: Colors.orange,
                                ),
                              );
                            }
                          },
                        ),
                      ),

                    Text(
                      'Account Registration',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),

                    // "I have an invite link" reveal button (only when clipboard has content and no referral yet)
                    if (_canOfferPaste && (_sponsorName == null || _sponsorName!.isEmpty) && !_showPasteUI)
                      Container(
                        margin: const EdgeInsets.only(top: 8.0, bottom: 16.0),
                        child: TextButton(
                          onPressed: () {
                            setState(() {
                              _showPasteUI = true;
                            });
                          },
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.blue.shade700,
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          ),
                          child: const Text(
                            'I have an invite link',
                            style: TextStyle(fontSize: 14, decoration: TextDecoration.underline),
                          ),
                        ),
                      ),

                    // Actual paste UI (shown after tapping "I have an invite link")
                    if (_showPasteUI && (_sponsorName == null || _sponsorName!.isEmpty))
                      Container(
                        margin: const EdgeInsets.only(top: 8.0, bottom: 16.0),
                        child: Column(
                          children: [
                            const Text(
                              'If someone sent you an invite link, you can paste it here.',
                              style: TextStyle(fontSize: 14, color: Colors.black87),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            TextButton.icon(
                              onPressed: _handlePasteReferral,
                              icon: const Icon(Icons.content_paste, size: 18),
                              label: const Text('Paste invite link'),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.blue.shade700,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Sponsor banner (shown when referral code is detected)
                    if (_sponsorName != null && _sponsorName!.isNotEmpty)
                      Container(
                        margin: const EdgeInsets.only(top: 8.0, bottom: 16.0),
                        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add, color: Colors.blue.shade600, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Invited by: $_sponsorName',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    color: Colors.blue.shade800,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            if (_initialReferralCode != null && kDebugMode) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Code: $_initialReferralCode (source: $_referralSource)',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.blue.shade600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    const SizedBox(height: 24),
                    
                    // Social Sign-In Section
                    if (!kIsWeb && Platform.isIOS && _isAppleSignInAvailable) ...[
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
                    
                    if (_isGoogleSignInAvailable) ...[
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
                    ],
                    
                    // Only show divider if at least one social sign-in option is available
                    if (_isAppleSignInAvailable || _isGoogleSignInAvailable) ...[
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
                    ],
                    
                    TextFormField(
                        controller: _firstNameController,
                        decoration: InputDecoration(
                          labelText: context.l10n?.authSignupLabelFirstName,
                          hintText: context.l10n?.authSignupHintFirstName,
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? (context.l10n?.authSignupFirstNameRequired ?? 'Required') : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _lastNameController,
                        decoration: InputDecoration(
                          labelText: context.l10n?.authSignupLabelLastName,
                          hintText: context.l10n?.authSignupHintLastName,
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? (context.l10n?.authSignupLastNameRequired ?? 'Required') : null),

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
                        decoration: InputDecoration(
                          labelText: context.l10n?.authSignupLabelEmail,
                          hintText: context.l10n?.authSignupHintEmail,
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) => v == null || !v.contains('@')
                            ? (context.l10n?.authSignupEmailInvalid ?? 'A valid email is required')
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _passwordController,
                        decoration: InputDecoration(
                          labelText: context.l10n?.authSignupLabelPassword,
                          hintText: context.l10n?.authSignupHintPassword,
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        obscureText: true,
                        validator: (v) => (v?.length ?? 0) < 6
                            ? (context.l10n?.authSignupPasswordTooShort(6) ?? 'Password must be at least 6 characters')
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _confirmPasswordController,
                        decoration: InputDecoration(
                          labelText: context.l10n?.authSignupLabelConfirmPassword,
                          hintText: context.l10n?.authSignupHintConfirmPassword,
                          border: const OutlineInputBorder(),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        obscureText: true,
                        validator: (v) => v != _passwordController.text
                            ? (context.l10n?.authSignupPasswordMismatch ?? 'Passwords do not match')
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
                                    child: LocalizedText(
                                      (l10n) => l10n.authSignupTosConsent,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        color: AppColors.textSecondary,
                                        height: 1.4,
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
                            : LocalizedText((l10n) => l10n.authSignupButtonCreateAccount),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
