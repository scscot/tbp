// lib/screens/login_screen.dart

import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
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
import 'new_registration_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import '../widgets/header_widgets.dart'; // Already imported, which is great.

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

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate() || _isLoading) return;
    setState(() => _isLoading = true);

    final authService = context.read<AuthService>();
    final scaffoldMessenger = ScaffoldMessenger.of(context);

    try {
      await authService.signInWithEmailAndPassword(
          _emailController.text.trim(), _passwordController.text.trim());
      
      // Navigate back after successful login
      if (mounted) {
        Navigator.of(context).pop();
      }
    } on FirebaseAuthException catch (e) {
      scaffoldMessenger.showSnackBar(
        SnackBar(
            content: Text(e.message ?? 'Login failed'),
            backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
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
      await authService.signInWithCredential(credential);
      debugPrint("✅ DEBUG: Firebase sign-in successful!");
      
      // Navigate back after successful login
      if (mounted) {
        Navigator.of(context).pop();
      }
    } on FirebaseAuthException catch (e) {
      debugPrint("❌ DEBUG: FirebaseAuthException: ${e.code} - ${e.message}");
      scaffoldMessenger.showSnackBar(SnackBar(
          content: Text(e.message ?? 'Sign-in failed.'),
          backgroundColor: Colors.red));
    } catch (e) {
      debugPrint("❌ DEBUG: Unexpected error: $e");
      scaffoldMessenger.showSnackBar(const SnackBar(
          content: Text('An unexpected social sign-in error occurred.'),
          backgroundColor: Colors.red));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        // --- FIX: Added the AppHeaderWithMenu here ---
        appBar: AppHeaderWithMenu(appId: widget.appId),
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
              if (!kIsWeb && Platform.isIOS) ...[
                ElevatedButton.icon(
                  icon:
                      const FaIcon(FontAwesomeIcons.apple, color: Colors.white, size: 20),
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
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text("Don't have an account?"),
                  TextButton(
                    onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (context) =>
                                NewRegistrationScreen(appId: widget.appId))),
                    child: const Text('Create Account'),
                  )
                ],
              ),
              const SizedBox(height: 32),
              // Privacy Policy Footer
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PrivacyPolicyScreen(appId: widget.appId),
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
                          builder: (context) => TermsOfServiceScreen(appId: widget.appId),
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

    final appleCredential = await SignInWithApple.getAppleIDCredential(
      scopes: [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName
      ],
      nonce: nonce,
    );

    debugPrint(
        "🍎 DEBUG: Apple credential received: ${appleCredential.identityToken != null}");
    debugPrint("🍎 DEBUG: User identifier: ${appleCredential.userIdentifier}");
    debugPrint(
        "🍎 DEBUG: Authorization code present: ${appleCredential.authorizationCode.isNotEmpty}");
    debugPrint(
        "🍎 DEBUG: Identity token length: ${appleCredential.identityToken?.length ?? 0}");

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
}
