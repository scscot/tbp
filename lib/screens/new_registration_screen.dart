// lib/screens/new_registration_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../widgets/header_widgets.dart';
import 'welcome_screen.dart';

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

    _initialReferralCode = widget.referralCode;

    debugPrint('🔍 After assignment:');
    debugPrint('🔍   _initialReferralCode: $_initialReferralCode');

    if (isDevMode && _initialReferralCode == null) {
       //_initialReferralCode = '88888888'; // Admin
      // _initialReferralCode = '28F37ECD'; // Direct
    }

    final code = _initialReferralCode;
    debugPrint('🔍 Using referral code: $code');

    if (code == null || code.isEmpty) {
      debugPrint('🔍 No referral code - admin registration');
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    debugPrint('🔍 Making HTTP request to get referral code data...');
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
    setState(() => _isLoading = true);

    final authService = context.read<AuthService>();
    final firestoreService = FirestoreService();
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    try {
      debugPrint('🔍 REGISTER: Starting registration process...');
      
      final HttpsCallable callable =
          FirebaseFunctions.instance.httpsCallable('registerUser');

      // Prepare registration data
      final registrationData = <String, dynamic>{
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'sponsorReferralCode': _initialReferralCode,
        'role': _initialReferralCode == null ? 'admin' : 'user',
      };

      debugPrint('🔍 REGISTER: Registration data prepared: ${registrationData.toString()}');
      debugPrint('🔍 REGISTER: Calling registerUser Cloud Function...');

      final result = await callable.call<Map<String, dynamic>>(registrationData);
      debugPrint('🔍 REGISTER: Cloud Function call successful: ${result.data}');

      debugPrint('🔍 REGISTER: Attempting to sign in user...');
      final userCredential = await authService.signInWithEmailAndPassword(
        _emailController.text.trim(),
        _passwordController.text,
      );
      debugPrint('🔍 REGISTER: Sign in successful, UID: ${userCredential.user?.uid}');

      debugPrint('🔍 REGISTER: Fetching user model from Firestore...');
      final userModel =
          await firestoreService.getUser(userCredential.user!.uid);

      if (userModel == null) {
        debugPrint('❌ REGISTER: Failed to fetch user model from Firestore');
        throw Exception("Failed to fetch new user profile.");
      }

      debugPrint('✅ REGISTER: User model fetched successfully: ${userModel.firstName} ${userModel.lastName}');

      if (!mounted) return;
      debugPrint('🔍 REGISTER: Navigating to WelcomeScreen...');
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) =>
              WelcomeScreen(appId: widget.appId, user: userModel),
        ),
        (Route<dynamic> route) => false,
      );
    } on FirebaseFunctionsException catch (e) {
      debugPrint('❌ REGISTER: FirebaseFunctionsException - Code: ${e.code}, Message: ${e.message}');
      debugPrint('❌ REGISTER: FirebaseFunctionsException - Details: ${e.details}');
      _showErrorSnackbar(
          scaffoldMessenger, e.message ?? 'Registration failed.');
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ REGISTER: FirebaseAuthException - Code: ${e.code}, Message: ${e.message}');
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
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
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _lastNameController,
                        decoration: const InputDecoration(
                          labelText: 'Last Name',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _emailController,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        ),
                        obscureText: true,
                        validator: (v) => v != _passwordController.text
                            ? 'Passwords do not match'
                            : null),
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
