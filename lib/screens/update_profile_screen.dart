// lib/screens/update_profile_screen.dart

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:cloud_functions/cloud_functions.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../services/storage_service.dart';
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';
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

  Future<void> _saveProfile() async {
    // Check if this is the demo user
    if (widget.user.uid == 'qzvHp5bIjvTEniYuds544aHLNE93') {
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
        _imageErrorText = context.l10n?.profileUpdatePictureRequired ?? 'Please upload your profile pic.';
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

        if (!mounted) return;
        if (photoUrl == null || photoUrl.isEmpty) {
          throw Exception(context.l10n?.profileUpdateImageNotProvided ?? 'Image was not provided.');
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
          SnackBar(
              content: Text(context.l10n?.profileUpdateSuccess ?? 'Profile updated successfully!'),
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
              content: Text(context.l10n?.profileUpdateError(e) ?? 'Error updating profile: $e'),
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
          title: Text(context.l10n?.profileUpdateDemoModeTitle ?? 'Demo Mode'),
          content: Text(context.l10n?.profileUpdateDemoModeMessage ?? 'Profile editing disabled in demo mode.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: Text(context.l10n?.profileUpdateDemoUnderstandButton ?? 'I Understand'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.profileUpdateScreenTitle ?? 'Update Profile'),
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
                    widget.user.email ?? (context.l10n?.profileUpdateNoEmail ?? 'No email'),
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
                    initialValue: _selectedCountry,
                    hint: Text(context.l10n?.profileUpdateSelectCountry ?? 'Select Country'),
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
                    decoration: InputDecoration(
                      labelText: context.l10n?.profileUpdateCountryLabel ?? 'Country',
                      border: const OutlineInputBorder(),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value == null ? (context.l10n?.profileUpdateCountryRequired ?? 'Please select a country') : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedState,
                    hint: Text(context.l10n?.profileUpdateSelectState ?? 'Select State/Province'),
                    isExpanded: true,
                    disabledHint: _selectedCountry == null
                        ? Text(context.l10n?.profileUpdateSelectCountryFirst ?? 'Select a country first')
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
                    decoration: InputDecoration(
                      labelText: context.l10n?.profileUpdateStateLabel ?? 'State/Province',
                      border: const OutlineInputBorder(),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value == null ? (context.l10n?.profileUpdateStateRequired ?? 'Please select a state/province') : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _cityController,
                    decoration: InputDecoration(
                      labelText: context.l10n?.profileUpdateCityLabel ?? 'City',
                      border: const OutlineInputBorder(),
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value!.isEmpty ? (context.l10n?.profileUpdateCityRequired ?? 'Please enter a city') : null,
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
                          : Text(context.l10n?.profileUpdateSaveButton ?? 'Save Changes'),
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
