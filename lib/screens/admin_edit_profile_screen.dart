import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../data/states_by_country.dart';
import '../widgets/header_widgets.dart';
import 'admin_edit_profile_screen_1.dart';

class AdminEditProfileScreen extends StatefulWidget {
  final String appId;

  const AdminEditProfileScreen({
    super.key,
    required this.appId,
  });

  @override
  State<AdminEditProfileScreen> createState() => _AdminEditProfileScreenState();
}

class _AdminEditProfileScreenState extends State<AdminEditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final TextEditingController _countryController = TextEditingController();
  final TextEditingController _stateController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();

  // Global keys for form fields to enable scrolling to specific fields
  final _profileImageKey = GlobalKey();
  final _countryKey = GlobalKey();
  final _stateKey = GlobalKey();
  final _cityKey = GlobalKey();

  File? _imageFile;
  bool _isLoading = false;
  List<String> _availableStates = [];
  String? _adminFirstName;
  String? _adminLastName;
  String? _adminEmail;
  String? _adminPhotoUrl;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final doc = await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .get();

      if (doc.exists) {
        final userData = doc.data()!;
        setState(() {
          _adminFirstName = userData['firstName'];
          _adminLastName = userData['lastName'];
          _adminEmail = userData['email'] ?? user.email;
          _adminPhotoUrl = userData['photoUrl'];
        });
      }
    }
  }

  void _onCountryChanged(String country) {
    setState(() {
      _availableStates = statesByCountry[country] ?? [];
      _stateController.clear();
    });
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
      });
    }
  }

  Future<String?> _uploadImage() async {
    if (_imageFile == null) return null;

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) return null;

      final ref = FirebaseStorage.instance
          .ref()
          .child('profile_images')
          .child('${user.uid}.jpg');

      await ref.putFile(_imageFile!);
      return await ref.getDownloadURL();
    } catch (e) {
      debugPrint('Error uploading image: $e');
      return null;
    }
  }

  Future<void> _scrollToField(GlobalKey fieldKey) async {
    if (fieldKey.currentContext != null) {
      await Future.delayed(const Duration(milliseconds: 100));
      await Scrollable.ensureVisible(
        fieldKey.currentContext!,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        alignment: 0.2, // Position field at 20% from top of visible area
      );
    }
  }

  String? _getFirstValidationError() {
    // Check image selection
    if (_imageFile == null) {
      _scrollToField(_profileImageKey);
      return 'Please select a profile picture';
    }

    // Check country
    if (_countryController.text.trim().isEmpty) {
      _scrollToField(_countryKey);
      return 'Please select a country';
    }

    // Check state
    if (_stateController.text.trim().isEmpty) {
      _scrollToField(_stateKey);
      return 'Please select a state/province';
    }

    // Check city
    if (_cityController.text.trim().isEmpty) {
      _scrollToField(_cityKey);
      return 'Please enter your city';
    }

    return null; // No validation errors
  }

  Future<void> _next() async {
    // Check for validation errors and scroll to first problematic field
    final validationError = _getFirstValidationError();
    if (validationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(validationError)),
      );
      return;
    }

    // Additional form validation check
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw Exception('User not authenticated');

      // Upload image
      final imageUrl = await _uploadImage();
      if (imageUrl == null) {
        throw Exception('Failed to upload image');
      }

      // Update user profile
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .update({
        'country': _countryController.text.trim(),
        'state': _stateController.text.trim(),
        'city': _cityController.text.trim(),
        'photoUrl': imageUrl,
      });

      // Add timezone recalculation when location data is updated
      final country = _countryController.text.trim();
      final state = _stateController.text.trim();
      if (country.isNotEmpty && state.isNotEmpty) {
        // Call backend function to recalculate timezone based on new location
        try {
          final HttpsCallable callable =
              FirebaseFunctions.instance.httpsCallable('updateUserTimezone');
          await callable.call({
            'userId': user.uid,
            'country': country,
            'state': state,
          });
          debugPrint(
              '✅ ADMIN PROFILE UPDATE: Timezone recalculated for country: $country, state: $state');
        } catch (e) {
          debugPrint(
              '⚠️ ADMIN PROFILE UPDATE: Failed to recalculate timezone: $e');
          // Continue with profile update even if timezone update fails
        }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Profile information saved successfully!')),
        );

        // Navigate to Step 2
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => AdminEditProfileScreen1(appId: widget.appId),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Center(
                      child: Text(
                        'Profile Setup',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // User Profile Display Section with Camera Icon
                    Center(
                      child: Column(
                        key: _profileImageKey,
                        children: [
                          GestureDetector(
                            onTap: _pickImage,
                            child: Stack(
                              children: [
                                CircleAvatar(
                                  radius: 60,
                                  backgroundImage: _imageFile != null
                                      ? FileImage(_imageFile!)
                                      : (_adminPhotoUrl != null &&
                                              _adminPhotoUrl!.isNotEmpty
                                          ? NetworkImage(_adminPhotoUrl!)
                                          : null) as ImageProvider?,
                                  child: _imageFile == null &&
                                          (_adminPhotoUrl == null ||
                                              _adminPhotoUrl!.isEmpty)
                                      ? const Icon(Icons.person, size: 60)
                                      : null,
                                ),
                                Positioned(
                                  bottom: 0,
                                  right: 0,
                                  child: Container(
                                    decoration: BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                            color: Colors.white, width: 2)),
                                    child: const Padding(
                                      padding: EdgeInsets.all(6.0),
                                      child: Icon(Icons.camera_alt,
                                          color: Colors.white, size: 20),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            '${_adminFirstName ?? ''} ${_adminLastName ?? ''}'
                                .trim(),
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 8),
                          Text(_adminEmail ?? 'No email'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Location Fields
                    DropdownButtonFormField<String>(
                      key: _countryKey,
                      decoration: const InputDecoration(
                        labelText: 'Country',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      value: _countryController.text.isEmpty
                          ? null
                          : _countryController.text,
                      isExpanded: true,
                      items: statesByCountry.keys.map((country) {
                        return DropdownMenuItem(
                          value: country,
                          child: Text(
                            country,
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value != null) {
                          _countryController.text = value;
                          _onCountryChanged(value);
                        }
                      },
                      validator: (value) =>
                          value == null ? 'Please select a country' : null,
                    ),
                    const SizedBox(height: 16),

                    DropdownButtonFormField<String>(
                      key: _stateKey,
                      decoration: const InputDecoration(
                        labelText: 'State/Province',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      value: _stateController.text.isEmpty
                          ? null
                          : _stateController.text,
                      isExpanded: true,
                      items: _availableStates.map((state) {
                        return DropdownMenuItem(
                          value: state,
                          child: Text(
                            state,
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value != null) {
                          _stateController.text = value;
                        }
                      },
                      validator: (value) => value == null
                          ? 'Please select a state/province'
                          : null,
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      key: _cityKey,
                      controller: _cityController,
                      decoration: const InputDecoration(
                        labelText: 'City',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      validator: (value) =>
                          value!.isEmpty ? 'Please enter your city' : null,
                    ),
                    const SizedBox(height: 48),

                    Center(
                      child: ElevatedButton(
                        onPressed: _next,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 32, vertical: 16),
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Next - Business Information',
                            style: TextStyle(fontSize: 16)),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _countryController.dispose();
    _stateController.dispose();
    _cityController.dispose();
    super.dispose();
  }
}
