// lib/screens/new_registration_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../services/session_manager.dart';
import '../config/app_colors.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'edit_profile_screen.dart';
import 'admin_edit_profile_screen.dart';
import 'login_screen.dart';

class NewRegistrationScreen extends StatefulWidget {
  final String? referralCode;
  final String appId;

  const NewRegistrationScreen({
    super.key,
    this.referralCode,
    required this.appId,
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

  bool isDevMode = true;

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  Future<void> _initializeScreen() async {
    debugPrint('🔍 NewRegistrationScreen._initializeScreen() called');
    debugPrint('🔍 Constructor parameters received:');
    debugPrint('🔍   widget.referralCode: ${widget.referralCode}');
    debugPrint('🔍   widget.appId: ${widget.appId}');

    // First, try to get cached referral data from SessionManager
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

    // Fallback: use constructor parameter (for direct access scenarios)
    _initialReferralCode = widget.referralCode;

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
        await SessionManager.instance.setReferralData(code, sponsorName);
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
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
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
                            : const Text('Create Account'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
