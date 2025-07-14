// lib/screens/update_profile_screen.dart

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../services/storage_service.dart';
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

  List<String> get statesForSelectedCountry =>
      statesByCountry[_selectedCountry] ?? [];

  @override
  void initState() {
    super.initState();
    _cityController = TextEditingController(text: widget.user.city);

    _selectedCountry = widget.user.country;
    _selectedState = widget.user.state;
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
        };

        await _firestoreService.updateUser(widget.user.uid, updatedData);

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
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
                    '${widget.user.firstName ?? ''} ${widget.user.lastName ?? ''}'.trim(),
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
                            value: country, child: Text(country)))
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
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                        .map((state) =>
                            DropdownMenuItem(value: state, child: Text(state)))
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
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value!.isEmpty ? 'Please enter a city' : null,
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
