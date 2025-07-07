// lib/screens/new_registration_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../data/states_by_country.dart';
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
  final _cityController = TextEditingController();

  String? _selectedCountry;
  String? _selectedState;
  String? _sponsorName;
  String? _initialReferralCode;
  bool _isLoading = true;
  List<String> _availableCountries = [];

  bool isDevMode = true;

  List<String> get states => statesByCountry[_selectedCountry] ?? [];

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  Future<void> _initializeScreen() async {
    _initialReferralCode = widget.referralCode;
    if (isDevMode && _initialReferralCode == null) {
      // _initialReferralCode = '88888888'; // Admin
      _initialReferralCode = '28F37ECD'; // Direct
    }

    final code = _initialReferralCode;

    if (code == null || code.isEmpty) {
      _availableCountries = statesByCountry.keys.toList();
      if (mounted) setState(() => _isLoading = false);
      return;
    }

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

        final countriesFromServer = data['availableCountries'] as List?;
        if (countriesFromServer != null && countriesFromServer.isNotEmpty) {
          _availableCountries = List<String>.from(countriesFromServer);
        } else {
          _availableCountries = statesByCountry.keys.toList();
        }
      } else {
        _availableCountries = statesByCountry.keys.toList();
        debugPrint(
            'Failed to get sponsor data. Status code: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint("Error finding sponsor or countries: $e.");
      if (mounted) {
        _availableCountries = statesByCountry.keys.toList();
      }
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
    _cityController.dispose();
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
      final HttpsCallable callable =
          FirebaseFunctions.instance.httpsCallable('registerUser');

      // FIX: Removed the unused 'result' variable to resolve the linter warning.
      await callable.call<Map<String, dynamic>>(<String, dynamic>{
        'email': _emailController.text.trim(),
        'password': _passwordController.text,
        'firstName': _firstNameController.text.trim(),
        'lastName': _lastNameController.text.trim(),
        'country': _selectedCountry,
        'state': _selectedState,
        'city': _cityController.text.trim(),
        'sponsorReferralCode': _initialReferralCode,
        'role': _initialReferralCode == null ? 'admin' : 'user',
      });

      final userCredential = await authService.signInWithEmailAndPassword(
        _emailController.text.trim(),
        _passwordController.text,
      );

      final userModel =
          await firestoreService.getUser(userCredential.user!.uid);

      if (userModel == null) {
        throw Exception("Failed to fetch new user profile.");
      }

      if (!mounted) return;
      navigator.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) =>
              WelcomeScreen(appId: widget.appId, user: userModel),
        ),
        (Route<dynamic> route) => false,
      );
    } on FirebaseFunctionsException catch (e) {
      _showErrorSnackbar(
          scaffoldMessenger, e.message ?? 'Registration failed.');
    } on FirebaseAuthException catch (e) {
      _showErrorSnackbar(scaffoldMessenger, e.message ?? 'Login failed.');
    } catch (e) {
      _showErrorSnackbar(scaffoldMessenger, 'An unexpected error occurred.');
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
                      'Registration',
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
                        decoration:
                            const InputDecoration(labelText: 'First Name'),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _lastNameController,
                        decoration:
                            const InputDecoration(labelText: 'Last Name'),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _emailController,
                        decoration:
                            const InputDecoration(labelText: 'Email Address'),
                        keyboardType: TextInputType.emailAddress,
                        validator: (v) => v == null || !v.contains('@')
                            ? 'A valid email is required'
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _passwordController,
                        decoration:
                            const InputDecoration(labelText: 'Password'),
                        obscureText: true,
                        validator: (v) => (v?.length ?? 0) < 6
                            ? 'Password must be at least 6 characters'
                            : null),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _confirmPasswordController,
                        decoration: const InputDecoration(
                            labelText: 'Confirm Password'),
                        obscureText: true,
                        validator: (v) => v != _passwordController.text
                            ? 'Passwords do not match'
                            : null),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedCountry,
                      hint: const Text('Select Country'),
                      items: _availableCountries
                          .map(
                              (c) => DropdownMenuItem(value: c, child: Text(c)))
                          .toList(),
                      onChanged: (v) => setState(() {
                        _selectedCountry = v;
                        _selectedState = null;
                      }),
                      decoration: const InputDecoration(labelText: 'Country'),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedState,
                      hint: const Text('Select State/Province'),
                      items: states
                          .map(
                              (s) => DropdownMenuItem(value: s, child: Text(s)))
                          .toList(),
                      onChanged: (v) => setState(() => _selectedState = v),
                      decoration:
                          const InputDecoration(labelText: 'State/Province'),
                      validator: (v) => v == null ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                        controller: _cityController,
                        decoration: const InputDecoration(labelText: 'City'),
                        validator: (v) =>
                            v == null || v.isEmpty ? 'Required' : null),
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
