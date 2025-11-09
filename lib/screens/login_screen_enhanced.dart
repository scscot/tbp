// lib/screens/login_screen_enhanced.dart
// Enhanced Login Screen using Provider pattern with original enhanced layout
// Preserves all functionality while using the preferred visual design

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import '../providers/auth_provider.dart' as auth;
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';
import '../config/app_colors.dart';
import '../services/biometric_service.dart';
import '../services/session_manager.dart';
import '../i18n/analytics_events.dart';
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

    FirebaseAnalytics.instance.logEvent(
      name: AnalyticsEvents.authView,
      parameters: {'screen': 'login'},
    );

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
            showBackButton: true, // Explicitly show back button since user came from login
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
                LocalizedText(
                  (l10n) => l10n.authLoginHeaderTitle,
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
                    LocalizedText(
                      (l10n) => l10n.authLoginNoAccountPrompt,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(width: 4),
                    TextButton(
                      onPressed: authProvider.isLoading ? null : _navigateToRegistration,
                      child: LocalizedText((l10n) => l10n.authLoginLinkSignUp),
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
                  labelText: context.l10n?.authLoginLabelEmail,
                  hintText: context.l10n?.authLoginHintEmail,
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return context.l10n?.authLoginEmailRequired ?? 'Please enter your email';
                  }
                  if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                    return context.l10n?.authLoginEmailInvalid ?? 'Please enter a valid email';
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
                  labelText: context.l10n?.authLoginLabelPassword,
                  hintText: context.l10n?.authLoginHintPassword,
                  prefixIcon: const Icon(Icons.lock_outlined),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return context.l10n?.authLoginPasswordRequired ?? 'Please enter your password';
                  }
                  if (value.length < 6) {
                    return context.l10n?.authLoginPasswordTooShort(6) ?? 'Password must be at least 6 characters';
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
                      : LocalizedText(
                          (l10n) => l10n.authLoginButtonSignIn,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),

              // Forgot Password Link
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: authProvider.isLoading ? null : () => _showForgotPasswordDialog(context),
                  child: Text(
                    'Forgot Password?',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 14,
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

    FirebaseAnalytics.instance.logEvent(
      name: AnalyticsEvents.authSubmit,
      parameters: {'method': 'email', 'screen': 'login'},
    );

    final authProvider = context.read<auth.AuthStateProvider>();

    final success = await authProvider.signInWithEmailAndPassword(
      _emailController.text.trim(),
      _passwordController.text.trim(),
    );

    if (success != null && mounted) {
      debugPrint('✅ LOGIN_ENHANCED: Sign-in successful');
    } else if (authProvider.errorMessage != null && mounted) {
      FirebaseAnalytics.instance.logEvent(
        name: AnalyticsEvents.authError,
        parameters: {
          'screen': 'login',
          'method': 'email',
          'message': authProvider.errorMessage!,
        },
      );
    }
  }

  void _showForgotPasswordDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) {
        return _ForgotPasswordDialog(
          initialEmail: _emailController.text.trim(),
        );
      },
    );
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

class _ForgotPasswordDialog extends StatefulWidget {
  final String? initialEmail;

  const _ForgotPasswordDialog({
    this.initialEmail,
  });

  @override
  State<_ForgotPasswordDialog> createState() => _ForgotPasswordDialogState();
}

class _ForgotPasswordDialogState extends State<_ForgotPasswordDialog> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _emailSent = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialEmail?.isNotEmpty == true) {
      _emailController.text = widget.initialEmail!;
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<auth.AuthStateProvider>(
      builder: (context, authProvider, child) {
        return AlertDialog(
          title: Text(
            _emailSent ? 'Check Your Email' : 'Reset Password',
            style: TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: _emailSent
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.email_outlined,
                      size: 48,
                      color: AppColors.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'We\'ve sent a password reset link to:',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _emailController.text.trim(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Please check your inbox and follow the instructions to reset your password.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                )
              : Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Enter your email address and we\'ll send you a link to reset your password.',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 20),
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
                            borderRadius: BorderRadius.circular(8),
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
                    ],
                  ),
                ),
          actions: [
            TextButton(
              onPressed: authProvider.isLoading
                  ? null
                  : () {
                      Navigator.of(context).pop();
                    },
              child: Text(_emailSent ? 'Done' : 'Cancel'),
            ),
            if (!_emailSent)
              ElevatedButton(
                onPressed: authProvider.isLoading ? null : _sendResetEmail,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                child: authProvider.isLoading
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text('Send Reset Link'),
              ),
          ],
        );
      },
    );
  }

  Future<void> _sendResetEmail() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<auth.AuthStateProvider>();
    final email = _emailController.text.trim();

    final success = await authProvider.sendPasswordResetEmail(email);

    if (success && mounted) {
      setState(() {
        _emailSent = true;
      });
      debugPrint('✅ FORGOT_PASSWORD: Reset email sent to $email');
    }
  }
}