// lib/screens/login_screen_enhanced.dart
// Enhanced Login Screen using Provider pattern with original enhanced layout
// Preserves all functionality while using the preferred visual design

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../providers/auth_provider.dart' as auth;
import '../widgets/header_widgets.dart';
import '../config/app_colors.dart';
import '../services/biometric_service.dart';
import '../services/session_manager.dart';
import '../main.dart';
import 'new_registration_screen.dart';

class LoginScreenEnhanced extends StatefulWidget {
  final String appId;

  const LoginScreenEnhanced({super.key, required this.appId});

  @override
  State<LoginScreenEnhanced> createState() => _LoginScreenEnhancedState();
}

class _LoginScreenEnhancedState extends State<LoginScreenEnhanced> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  // Local state for UI behavior
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _hasStoredUser = false;
  String? _storedEmail;
  bool _navigated = false;
  bool _isAppleSignInAvailable = false;
  bool _isGoogleSignInAvailable = false;

  // Firebase auth state subscription
  StreamSubscription<User?>? _authSub;

  @override
  void initState() {
    super.initState();
    _setupAuthStateListener();
    _initializeBiometric();
    _checkAppleSignInAvailability();
    _checkGoogleSignInAvailability();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _setupAuthStateListener() {
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) async {
      if (!mounted || user == null || _navigated) return;

      debugPrint('🔐 LOGIN_ENHANCED: Auth state -> ${user.email} (${user.uid})');

      // Get the auth provider to check loading state
      final authProvider = context.read<auth.AuthStateProvider>();
      if (authProvider.isLoading) {
        debugPrint('🔐 LOGIN_ENHANCED: Sign-in in progress, skipping auth state navigation');
        return;
      }

      try {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();

        if (!userDoc.exists) {
          debugPrint('🧹 LOGIN_ENHANCED: No user doc found - showing registration prompt');
          await FirebaseAuth.instance.signOut();

          if (mounted) {
            _showRegistrationRequiredModal();
          }
          return;
        }

        await Future<void>.delayed(Duration.zero);

        final nav = navigatorKey.currentState;
        if (nav != null) {
          _navigated = true;
          _authSub?.cancel();

          // Clear recent sign-out timestamp since user successfully logged in
          await SessionManager.instance.clearRecentSignOut();

          nav.pushNamedAndRemoveUntil(
            '/',
            (route) => false,
          );
          debugPrint('✅ LOGIN_ENHANCED: Pushed AuthWrapper and cleared stack');
        }
      } catch (e) {
        debugPrint('❌ LOGIN_ENHANCED: Error after auth: $e');
      }
    });
  }

  Future<void> _checkAppleSignInAvailability() async {
    // TEMPORARILY DISABLED FOR APP STORE APPROVAL
    debugPrint('🍎 LOGIN_ENHANCED: Apple Sign-In temporarily disabled for App Store approval');
    if (mounted) {
      setState(() {
        _isAppleSignInAvailable = false;
      });
    }
  }

  Future<void> _checkGoogleSignInAvailability() async {
    // TEMPORARILY DISABLED FOR APP STORE APPROVAL
    debugPrint('🔵 LOGIN_ENHANCED: Google Sign-In temporarily disabled for App Store approval');
    if (mounted) {
      setState(() {
        _isGoogleSignInAvailable = false;
      });
    }
  }

  Future<void> _initializeBiometric() async {
    try {
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser != null) {
        debugPrint('🔐 LOGIN_ENHANCED: User already authenticated, skipping biometric auto-prompt');
        return;
      }

      final available = await BiometricService.isDeviceSupported();
      final enabled = await BiometricService.isBiometricEnabled();
      final hasStoredCredentials = await BiometricService.hasStoredCredentials();
      final storedEmail = await BiometricService.getStoredEmail();
      final storedUser = await SessionManager.instance.getCurrentUser();

      debugPrint('🔐 LOGIN_ENHANCED: Biometric info - Available: $available, Enabled: $enabled, HasCredentials: $hasStoredCredentials');

      if (mounted) {
        setState(() {
          _biometricAvailable = available;
          _biometricEnabled = enabled;
          _hasStoredUser = hasStoredCredentials;
          _storedEmail = storedEmail ?? storedUser?.email;
        });
      }

      final wasRecentSignOut = await SessionManager.instance.wasRecentSignOut();
      final shouldAutoPrompt = available && enabled && hasStoredCredentials && !wasRecentSignOut;

      debugPrint('🔐 LOGIN_ENHANCED: Should auto-prompt biometric: $shouldAutoPrompt');

      if (shouldAutoPrompt) {
        _showBiometricLogin();
      }
    } catch (e) {
      debugPrint('❌ LOGIN_ENHANCED: Error initializing biometric: $e');
    }
  }

  void _showRegistrationRequiredModal() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Account Required'),
          content: const Text(
            'It looks like you need to create an account first. Would you like to register now?',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                _navigateToRegistration();
              },
              child: const Text('Register'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _showBiometricLogin() async {
    final authProvider = context.read<auth.AuthStateProvider>();
    await authProvider.signInWithBiometric();
  }


  void _navigateToRegistration() async {
    final navigator = Navigator.of(context);

    // Clear any existing user data/state before registration
    await SessionManager.instance.clearAllData();
    _emailController.clear();
    _passwordController.clear();

    if (mounted) {
      navigator.push(
        MaterialPageRoute(
          builder: (context) => NewRegistrationScreen(
            appId: widget.appId,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppScreenBar(title: 'Sign In', appId: widget.appId),
      resizeToAvoidBottomInset: true,
      body: Consumer<auth.AuthStateProvider>(
        builder: (context, authProvider, child) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                const SizedBox(height: 40),
                Text(
                  'Welcome Back',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Sign in to continue building your team',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 40),

                // Error Message
                if (authProvider.errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade600, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            authProvider.errorMessage!,
                            style: TextStyle(color: Colors.red.shade600),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: authProvider.clearError,
                          color: Colors.red.shade600,
                        ),
                      ],
                    ),
                  ),

                // Email/Password Form
                _EmailPasswordForm(),
                const SizedBox(height: 24),

                // Divider - only show if there are alternative login methods
                if (_isAppleSignInAvailable || _isGoogleSignInAvailable || (_biometricAvailable && _biometricEnabled && _hasStoredUser)) ...[
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'or continue with',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],

                // Social Login Buttons
                _SocialLoginButtons(
                  isAppleSignInAvailable: _isAppleSignInAvailable,
                  isGoogleSignInAvailable: _isGoogleSignInAvailable,
                ),

                // Add spacing only if social buttons are shown
                if (_isAppleSignInAvailable || _isGoogleSignInAvailable)
                  const SizedBox(height: 24),

                // Biometric Login
                if (_biometricAvailable && _biometricEnabled && _hasStoredUser)
                  _BiometricLoginButton(
                    storedEmail: _storedEmail,
                    onTap: _showBiometricLogin,
                  ),

                const SizedBox(height: 40),

                // Registration Link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Don't have an account? ",
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    TextButton(
                      onPressed: authProvider.isLoading ? null : _navigateToRegistration,
                      child: const Text('Sign Up'),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _EmailPasswordForm extends StatefulWidget {
  @override
  State<_EmailPasswordForm> createState() => _EmailPasswordFormState();
}

class _EmailPasswordFormState extends State<_EmailPasswordForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<auth.AuthStateProvider>(
      builder: (context, authProvider, child) {
        return Form(
          key: _formKey,
          child: Column(
            children: [
              // Email Field
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                enabled: !authProvider.isLoading,
                decoration: InputDecoration(
                  labelText: 'Email',
                  hintText: 'Enter your email address',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your email';
                  }
                  if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                    return 'Please enter a valid email';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Password Field
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                enabled: !authProvider.isLoading,
                decoration: InputDecoration(
                  labelText: 'Password',
                  hintText: 'Enter your password',
                  prefixIcon: const Icon(Icons.lock_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your password';
                  }
                  if (value.length < 6) {
                    return 'Password must be at least 6 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Sign In Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: authProvider.isLoading ? null : () => _signIn(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: authProvider.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Sign In',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _signIn(BuildContext context) async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<auth.AuthStateProvider>();

    final success = await authProvider.signInWithEmailAndPassword(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (success != null && mounted) {
      debugPrint('✅ LOGIN_ENHANCED: Sign-in successful');
    }
  }
}

class _SocialLoginButtons extends StatelessWidget {
  final bool isAppleSignInAvailable;
  final bool isGoogleSignInAvailable;

  const _SocialLoginButtons({
    required this.isAppleSignInAvailable,
    required this.isGoogleSignInAvailable,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<auth.AuthStateProvider>(
      builder: (context, authProvider, child) {
        return Column(
          children: [
            // Google Sign-In
            if (isGoogleSignInAvailable) ...[
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: authProvider.isLoading ? null : () => _signInWithGoogle(context),
                  icon: const FaIcon(FontAwesomeIcons.google, size: 20),
                  label: const Text('Continue with Google'),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Apple Sign-In
            if (isAppleSignInAvailable) ...[
              SizedBox(
                width: double.infinity,
                height: 50,
                child: OutlinedButton.icon(
                  onPressed: authProvider.isLoading ? null : () => _signInWithApple(context),
                  icon: const FaIcon(FontAwesomeIcons.apple, size: 20),
                  label: const Text('Continue with Apple'),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Future<void> _signInWithGoogle(BuildContext context) async {
    final authProvider = context.read<auth.AuthStateProvider>();
    await authProvider.signInWithGoogle();
  }

  Future<void> _signInWithApple(BuildContext context) async {
    final authProvider = context.read<auth.AuthStateProvider>();
    await authProvider.signInWithApple();
  }
}

class _BiometricLoginButton extends StatelessWidget {
  final String? storedEmail;
  final VoidCallback onTap;

  const _BiometricLoginButton({
    required this.storedEmail,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<auth.AuthStateProvider>(
      builder: (context, authProvider, child) {
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          child: SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: authProvider.isLoading ? null : onTap,
              icon: const Icon(Icons.fingerprint, size: 24),
              label: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Sign in with biometric'),
                  if (storedEmail != null)
                    Text(
                      storedEmail!,
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                ],
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}