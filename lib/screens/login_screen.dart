// lib/screens/login_screen.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../models/user_model.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'new_registration_screen.dart';
import '../widgets/header_widgets.dart';
import 'dart:async';
import '../services/session_manager.dart';
import '../main.dart';
import '../widgets/localized_text.dart';

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
  StreamSubscription<User?>? _authSub;
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

    setState(() => _isLoading = true);

    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    try {
      debugPrint('🔐 LOGIN: Signing in with email: $email');

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
                'You must first create a Team Build Pro account to sign in.',
                style: TextStyle(fontSize: 16, height: 1.4),
              ),
              SizedBox(height: 16),
              Text(
                'Please tap "Create Account" below to register your new account.',
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
                context.l10n?.loginTitle ?? 'Login',
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
                      decoration: InputDecoration(labelText: context.l10n?.loginLabelEmail ?? 'Email'),
                      keyboardType: TextInputType.emailAddress,
                      validator: (value) => value == null || value.isEmpty
                          ? (context.l10n?.loginValidatorEmail ?? 'Please enter your email')
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passwordController,
                      decoration: InputDecoration(labelText: context.l10n?.loginLabelPassword ?? 'Password'),
                      obscureText: true,
                      validator: (value) => value == null || value.isEmpty
                          ? (context.l10n?.loginValidatorPassword ?? 'Please enter your password')
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
                      : Text(context.l10n?.loginButtonLogin ?? 'Login'),
                ),
              ),
              const SizedBox(height: 32),
              
              // Create Account Link
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    context.l10n?.loginNoAccount ?? "Don't have an account? ",
                    style: const TextStyle(
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
                    child: Text(
                      context.l10n?.loginCreateAccount ?? 'Create Account',
                      style: const TextStyle(
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
                    child: Text(
                      context.l10n?.loginPrivacyPolicy ?? 'Privacy Policy',
                      style: const TextStyle(
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
                    child: Text(
                      context.l10n?.loginTermsOfService ?? 'Terms of Service',
                      style: const TextStyle(
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
}
