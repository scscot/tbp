import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../data/states_by_country.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import 'dashboard_screen.dart';

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
  final TextEditingController _countryController = TextEditingController();
  final TextEditingController _stateController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _bizNameController = TextEditingController();
  final TextEditingController _bizNameConfirmController =
      TextEditingController();
  final TextEditingController _refLinkController = TextEditingController();
  final TextEditingController _refLinkConfirmController =
      TextEditingController();

  File? _imageFile;
  bool _isLoading = false;
  List<String> _availableStates = [];
  String? _adminFirstName;

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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_imageFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a profile picture')),
      );
      return;
    }

    // Business Name Content Validation
    final businessName = _bizNameController.text.trim();
    final RegExp businessNameRegExp = RegExp(r"^[a-zA-Z0-9\s&'\-.,]+$");

    if (!businessNameRegExp.hasMatch(businessName)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Business name can only contain letters, numbers, and common punctuation.')),
      );
      return;
    }

    // Referral Link URL Validation
    final referralLink = _refLinkController.text.trim();
    try {
      final uri = Uri.parse(referralLink);
      if (!uri.isAbsolute || uri.host.isEmpty) {
        throw const FormatException('Invalid URL format');
      }
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Please enter a valid referral link (e.g., https://example.com).')),
      );
      return;
    }

    // Confirmation field validation
    if (_bizNameController.text != _bizNameConfirmController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Business Name fields must match for confirmation.')),
      );
      return;
    }

    if (_refLinkController.text != _refLinkConfirmController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Referral Link fields must match for confirmation.')),
      );
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

      // Create/update admin settings
      await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(user.uid)
          .set({
        'biz_opp': _bizNameController.text.trim(),
        'biz_opp_ref_url': _refLinkController.text.trim(),
        'isSubscribed': true,
        'superAdmin': false,
      }, SetOptions(merge: true));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile completed successfully!')),
        );

        // Navigate to dashboard
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => DashboardScreen(appId: widget.appId),
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

  Widget _buildMetricCard({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Card(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 28, color: Colors.blue),
              const SizedBox(height: 8),
              Text(
                value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Center(
                      child: Text(
                        'Complete Your Admin Profile',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: "Hello ${_adminFirstName ?? 'Admin'}!\n\n",
                          ),
                          const TextSpan(
                            text:
                                "Complete your profile to start building your organization. ",
                          ),
                          TextSpan(
                            text:
                                "Your business opportunity information can only be set once and cannot be changed.",
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Profile Picture Section
                    const Text('Profile Picture',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Center(
                      child: GestureDetector(
                        onTap: _pickImage,
                        child: Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(60),
                            border: Border.all(color: Colors.grey),
                          ),
                          child: _imageFile != null
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(60),
                                  child: Image.file(_imageFile!,
                                      fit: BoxFit.cover),
                                )
                              : const Icon(Icons.add_a_photo,
                                  size: 40, color: Colors.grey),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Location Fields
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Country'),
                      value: _countryController.text.isEmpty
                          ? null
                          : _countryController.text,
                      items: statesByCountry.keys.map((country) {
                        return DropdownMenuItem(
                            value: country, child: Text(country));
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
                      decoration:
                          const InputDecoration(labelText: 'State/Province'),
                      value: _stateController.text.isEmpty
                          ? null
                          : _stateController.text,
                      items: _availableStates.map((state) {
                        return DropdownMenuItem(
                            value: state, child: Text(state));
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
                      controller: _cityController,
                      decoration: const InputDecoration(labelText: 'City'),
                      validator: (value) =>
                          value!.isEmpty ? 'Please enter your city' : null,
                    ),
                    const SizedBox(height: 24),

                    // Business Opportunity Section
                    const Divider(color: Colors.blue, thickness: 2),
                    const SizedBox(height: 16),
                    const Text('Business Opportunity Information',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: _bizNameController,
                      decoration: const InputDecoration(
                        labelText: 'Your Business Opportunity Name',
                        helperText: 'This cannot be changed once set',
                      ),
                      validator: (value) => value!.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: _bizNameConfirmController,
                      decoration: const InputDecoration(
                          labelText: 'Confirm Business Opportunity Name'),
                      validator: (value) => value!.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),

                    GestureDetector(
                      onTap: () {
                        showDialog(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text(
                              'Very Important!',
                              style: TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold),
                            ),
                            content: const Text(
                                'You must enter the exact referral link you received from your company. '
                                'This will ensure your TeamBuild Pro downline members that join your business opportunity '
                                'are automatically placed in your business opportunity downline.'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.of(context).pop(),
                                child: const Text('I Understand'),
                              ),
                            ],
                          ),
                        );
                      },
                      child: Column(
                        children: [
                          TextFormField(
                            controller: _refLinkController,
                            decoration: const InputDecoration(
                              labelText: 'Your Referral Link',
                              helperText: 'This cannot be changed once set',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _refLinkConfirmController,
                            decoration: const InputDecoration(
                              labelText: 'Confirm Referral Link URL',
                            ),
                            validator: (value) =>
                                value!.isEmpty ? 'Required' : null,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Team Build Pro Feeder System Section
                    const Divider(color: Colors.green, thickness: 2),
                    const SizedBox(height: 16),
                    const Text(
                      'TeamBuild Pro Feeder System',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.green),
                    ),
                    const SizedBox(height: 16),

                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Colors.green.withOpacity(0.2)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.auto_awesome,
                                  color: Colors.green, size: 24),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  'How It Works',
                                  style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Text.rich(
                            TextSpan(
                              children: [
                                const TextSpan(
                                    text:
                                        "When your downline members meet the minimum eligibility criteria, they are automatically invited to join your "),
                                TextSpan(
                                  text: 'business opportunity',
                                  style: const TextStyle(
                                      color: Colors.blue,
                                      fontWeight: FontWeight.w500),
                                ),
                                const TextSpan(
                                    text:
                                        " team — with their growing TeamBuild Pro downlines ready to follow."),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Minimum Eligibility Requirements
                    const Text(
                      'Minimum Eligibility Requirements',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildMetricCard(
                          icon: Icons.people,
                          value: AppConstants.projectWideDirectSponsorMin
                              .toString(),
                          label: 'Direct Sponsors',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.groups,
                          value:
                              AppConstants.projectWideTotalTeamMin.toString(),
                          label: 'Total Team Members',
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    Center(
                      child: ElevatedButton(
                        onPressed: _submit,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 32, vertical: 16),
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Complete Profile & Start Building!',
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
    _countryController.dispose();
    _stateController.dispose();
    _cityController.dispose();
    _bizNameController.dispose();
    _bizNameConfirmController.dispose();
    _refLinkController.dispose();
    _refLinkConfirmController.dispose();
    super.dispose();
  }
}
