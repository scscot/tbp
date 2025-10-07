// lib/screens/update_profile_screen.dart

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../services/storage_service.dart';
import '../services/biometric_service.dart';
import '../widgets/header_widgets.dart';
import '../data/states_by_country.dart';
import 'dashboard_screen.dart';

class UpdateProfileScreen extends StatefulWidget {
  final UserModel user;
  final String appId;
  final bool isFirstTimeSetup;

  const UpdateProfileScreen({
    super.key,
    required this.user,
    required this.appId,
    this.isFirstTimeSetup = false,
  });

  @override
  UpdateProfileScreenState createState() => UpdateProfileScreenState();
}

class UpdateProfileScreenState extends State<UpdateProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firestoreService = FirestoreService();
  final _storageService = StorageService();

  late TextEditingController _cityController;
  String? _selectedCountry;
  String? _selectedState;

  File? _imageFile;
  bool _isLoading = false;

  // Added state variable to hold the image validation error text.
  String? _imageErrorText;
  
  // Biometric authentication variables
  bool _biometricAvailable = false;
  bool _biometricEnabled = false;
  bool _checkingBiometric = true;

  List<String> get statesForSelectedCountry =>
      statesByCountry[_selectedCountry] ?? [];

  @override
  void initState() {
    super.initState();
    _cityController = TextEditingController(text: widget.user.city);

    _selectedCountry = widget.user.country;
    _selectedState = widget.user.state;
    // Guard against invalid dropdown values if saved values are not in the lists
    if (_selectedCountry != null &&
        !statesByCountry.keys.contains(_selectedCountry)) {
      _selectedCountry = null;
    }
    if (_selectedCountry != null) {
      final states = statesByCountry[_selectedCountry] ?? const <String>[];
      if (_selectedState != null && !states.contains(_selectedState)) {
        _selectedState = null;
      }
    }
    
    // Initialize biometric settings
    _initializeBiometric();
  }
  
  Future<void> _initializeBiometric() async {
    try {
      final available = await BiometricService.isDeviceSupported();
      final enabled = await BiometricService.isBiometricEnabled();
      
      if (mounted) {
        setState(() {
          _biometricAvailable = available;
          _biometricEnabled = enabled && available; // Only enable if device supports it
          _checkingBiometric = false;
        });
      }
    } catch (e) {
      debugPrint('Error initializing biometric: $e');
      if (mounted) {
        setState(() {
          _biometricAvailable = false;
          _biometricEnabled = false;
          _checkingBiometric = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final imagePicker = ImagePicker();
    final pickedFile = await imagePicker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        // Clear the error message when an image is successfully picked.
        _imageErrorText = null;
      });
    }
  }
  
  Future<void> _handleBiometricToggle(bool value) async {
    if (!_biometricAvailable) return;

    final scaffoldMessenger = ScaffoldMessenger.of(context);

    if (value) {
      // Enabling biometric - test authentication first
      try {
        final authenticated = await BiometricService.authenticate(
          localizedReason: 'Test biometric authentication to enable this feature',
        );

        if (!authenticated) {
          scaffoldMessenger.showSnackBar(
            const SnackBar(
              content: Text('Biometric authentication failed. Please try again.'),
              backgroundColor: Colors.orange,
            ),
          );
          return;
        }

        // Request password to securely store credentials
        final password = await _showPasswordDialog();
        if (password == null || password.isEmpty) {
          scaffoldMessenger.showSnackBar(
            const SnackBar(
              content: Text('Password required to enable biometric login'),
              backgroundColor: Colors.orange,
            ),
          );
          return;
        }

        // Verify password by attempting Firebase authentication
        final email = widget.user.email;
        if (email == null) {
          scaffoldMessenger.showSnackBar(
            const SnackBar(
              content: Text('User email not found'),
              backgroundColor: Colors.red,
            ),
          );
          return;
        }

        try {
          // Verify password is correct
          await FirebaseAuth.instance.signInWithEmailAndPassword(
            email: email,
            password: password,
          );

          // Password is correct - store credentials
          await BiometricService.storeCredentials(
            email: email,
            password: password,
          );

          // Enable biometric setting
          await BiometricService.setBiometricEnabled(true);
          setState(() => _biometricEnabled = true);

          scaffoldMessenger.showSnackBar(
            const SnackBar(
              content: Text('✅ Biometric login enabled successfully'),
              backgroundColor: Colors.green,
            ),
          );
        } on FirebaseAuthException catch (e) {
          debugPrint('Password verification failed: ${e.code}');
          scaffoldMessenger.showSnackBar(
            const SnackBar(
              content: Text('Incorrect password. Please try again.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } catch (e) {
        debugPrint('Biometric enable error: $e');
        scaffoldMessenger.showSnackBar(
          SnackBar(
            content: Text('Error enabling biometric: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } else {
      // Disabling biometric - show confirmation dialog
      final confirmed = await _showDisableBiometricDialog();
      if (confirmed) {
        await BiometricService.setBiometricEnabled(false);
        setState(() => _biometricEnabled = false);

        scaffoldMessenger.showSnackBar(
          const SnackBar(
            content: Text('Biometric login disabled'),
            backgroundColor: Colors.blue,
          ),
        );
      }
    }
  }

  Future<String?> _showPasswordDialog() async {
    final passwordController = TextEditingController();

    return await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Confirm Password'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'To securely store your credentials for biometric login, please enter your password.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: true,
                autofocus: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
                onSubmitted: (value) => Navigator.of(context).pop(value),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(passwordController.text),
              style: TextButton.styleFrom(
                foregroundColor: Colors.blue,
              ),
              child: const Text('Confirm'),
            ),
          ],
        );
      },
    );
  }
  
  Future<bool> _showDisableBiometricDialog() async {
    return await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Disable Biometric Login'),
          content: const Text(
            'Are you sure you want to disable biometric login? '
            'You will need to use your email and password to sign in.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(
                foregroundColor: Colors.red,
              ),
              child: const Text('Disable'),
            ),
          ],
        );
      },
    ) ?? false;
  }

  Future<void> _saveProfile() async {
    // Check if this is the demo user
    if (widget.user.uid == 'a6f3b223-993b-4efd-9f62-df1961aa8f46') {
      // Show popup for demo user
      _showDemoModeDialog();
      return;
    }

    // First, validate the standard form fields.
    final isFormValid = _formKey.currentState!.validate();

    // Next, manually validate the image requirement.
    bool isImageValid = true;
    // The image is only mandatory during the first time setup.
    if (widget.isFirstTimeSetup && _imageFile == null) {
      setState(() {
        _imageErrorText = 'Please upload your profile pic.';
      });
      isImageValid = false;
    } else {
      setState(() {
        _imageErrorText = null;
      });
    }

    // Only proceed if both the form and the image are valid.
    if (isFormValid && isImageValid) {
      setState(() => _isLoading = true);

      final navigator = Navigator.of(context);
      final scaffoldMessenger = ScaffoldMessenger.of(context);

      try {
        String? photoUrl = widget.user.photoUrl;
        if (_imageFile != null) {
          photoUrl = await _storageService.uploadProfileImage(
            userId: widget.user.uid,
            imageFile: _imageFile!,
          );
        }

        if (photoUrl == null || photoUrl.isEmpty) {
          throw Exception('Image was not provided.');
        }

        final updatedData = {
          'city': _cityController.text.trim(),
          'country': _selectedCountry,
          'state': _selectedState,
          'photoUrl': photoUrl,
          // 🆕 Set profile completion flag for first-time setup
          if (widget.isFirstTimeSetup) 'isProfileComplete': true,
        };

        await _firestoreService.updateUser(widget.user.uid, updatedData);

        // Add timezone recalculation when location data is updated
        if (_selectedCountry != null && _selectedState != null) {
          // Call backend function to recalculate timezone based on new location
          try {
            final HttpsCallable callable =
                FirebaseFunctions.instance.httpsCallable('updateUserTimezone');
            await callable.call({
              'userId': widget.user.uid,
              'country': _selectedCountry,
              'state': _selectedState,
            });
            debugPrint(
                '✅ UPDATE PROFILE: Timezone recalculated for country: $_selectedCountry, state: $_selectedState');
          } catch (e) {
            debugPrint('⚠️ UPDATE PROFILE: Failed to recalculate timezone: $e');
            // Continue with profile update even if timezone update fails
          }
        }

        if (!mounted) return;
        scaffoldMessenger.showSnackBar(
          const SnackBar(
              content: Text('Profile updated successfully!'),
              backgroundColor: Colors.green),
        );

        if (widget.isFirstTimeSetup) {
          navigator.pushAndRemoveUntil(
              MaterialPageRoute(
                  builder: (_) => DashboardScreen(appId: widget.appId)),
              (route) => false);
        } else {
          navigator.pop();
        }
      } catch (e) {
        if (!mounted) return;
        scaffoldMessenger.showSnackBar(
          SnackBar(
              content: Text('Error updating profile: $e'),
              backgroundColor: Colors.red),
        );
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  void _showDemoModeDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Demo Mode'),
          content: const Text('Profile editing disabled in demo mode.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('I Understand'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppScreenBar(title: 'Update Profile'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Profile Photo Section
            Center(
              child: GestureDetector(
                onTap: _pickImage,
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 50,
                      backgroundImage: _imageFile != null
                          ? FileImage(_imageFile!)
                          : (widget.user.photoUrl != null &&
                                  widget.user.photoUrl!.isNotEmpty
                              ? NetworkImage(widget.user.photoUrl!)
                              : null) as ImageProvider?,
                      child: _imageFile == null &&
                              (widget.user.photoUrl == null ||
                                  widget.user.photoUrl!.isEmpty)
                          ? const Icon(Icons.person, size: 50)
                          : null,
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        decoration: BoxDecoration(
                            color: Colors.black54,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2)),
                        child: const Padding(
                          padding: EdgeInsets.all(6.0),
                          child: Icon(Icons.camera_alt,
                              color: Colors.white, size: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // User Name and Email Display
            const SizedBox(height: 16),
            Center(
              child: Column(
                children: [
                  Text(
                    '${widget.user.firstName ?? ''} ${widget.user.lastName ?? ''}'
                        .trim(),
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.user.email ?? 'No email',
                    style: Theme.of(context).textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            // Image validation error
            if (_imageErrorText != null) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  _imageErrorText!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontSize: 12,
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),
            const Divider(),

            // Form Section
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Location Information
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _selectedCountry,
                    hint: const Text('Select Country'),
                    isExpanded: true,
                    items: statesByCountry.keys
                        .map((country) => DropdownMenuItem(
                              value: country,
                              child: Text(
                                country,
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ))
                        .toList(),
                    onChanged: (newValue) {
                      setState(() {
                        _selectedCountry = newValue;
                        _selectedState = null;
                      });
                    },
                    decoration: const InputDecoration(
                      labelText: 'Country',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value == null ? 'Please select a country' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _selectedState,
                    hint: const Text('Select State/Province'),
                    isExpanded: true,
                    disabledHint: _selectedCountry == null
                        ? const Text('Select a country first')
                        : null,
                    items: statesForSelectedCountry
                        .map((state) => DropdownMenuItem(
                              value: state,
                              child: Text(
                                state,
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1,
                              ),
                            ))
                        .toList(),
                    onChanged: _selectedCountry == null
                        ? null
                        : (newValue) {
                            setState(() {
                              _selectedState = newValue;
                            });
                          },
                    decoration: const InputDecoration(
                      labelText: 'State/Province',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value == null ? 'Please select a state/province' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _cityController,
                    decoration: const InputDecoration(
                      labelText: 'City',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value!.isEmpty ? 'Please enter a city' : null,
                  ),

                  const SizedBox(height: 24),
                  
                  // Security Settings Section
                  const Divider(),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Icon(
                        Icons.security,
                        size: 20,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Security Settings',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // Biometric Login Toggle
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.grey.shade300,
                      ),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SwitchListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 4,
                      ),
                      title: const Text('Enable Biometric Login'),
                      subtitle: _checkingBiometric
                          ? const Text('Checking device compatibility...')
                          : Text(
                              _biometricAvailable
                                  ? 'Use fingerprint or face recognition to login'
                                  : 'Not available on this device',
                            ),
                      value: _biometricEnabled && _biometricAvailable,
                      onChanged: _biometricAvailable && !_checkingBiometric
                          ? _handleBiometricToggle
                          : null,
                      secondary: _checkingBiometric
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                              ),
                            )
                          : Icon(
                              _biometricAvailable
                                  ? Icons.fingerprint
                                  : Icons.fingerprint_outlined,
                              color: _biometricAvailable
                                  ? Theme.of(context).colorScheme.primary
                                  : Colors.grey,
                            ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Save Button
                  Center(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _saveProfile,
                      child: _isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 3,
                              ))
                          : const Text('Save Changes'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
