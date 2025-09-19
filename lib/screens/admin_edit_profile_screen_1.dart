import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../widgets/navigation_shell.dart';

class AdminEditProfileScreen1 extends StatefulWidget {
  final String appId;

  const AdminEditProfileScreen1({
    super.key,
    required this.appId,
  });

  @override
  State<AdminEditProfileScreen1> createState() =>
      _AdminEditProfileScreen1State();
}

class _AdminEditProfileScreen1State extends State<AdminEditProfileScreen1> {
  final _formKey = GlobalKey<FormState>();
  final _scrollController = ScrollController();
  final TextEditingController _bizNameController = TextEditingController();
  final TextEditingController _bizNameConfirmController =
      TextEditingController();
  final TextEditingController _refLinkController = TextEditingController();
  final TextEditingController _refLinkConfirmController =
      TextEditingController();

  // Global keys for form fields to enable scrolling to specific fields
  final _bizNameKey = GlobalKey();
  final _bizNameConfirmKey = GlobalKey();
  final _refLinkKey = GlobalKey();
  final _refLinkConfirmKey = GlobalKey();

  bool _isLoading = false;

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
    // Check business name
    if (_bizNameController.text.trim().isEmpty) {
      _scrollToField(_bizNameKey);
      return 'Please enter your business opportunity name';
    }

    // Check business name confirmation
    if (_bizNameConfirmController.text.trim().isEmpty) {
      _scrollToField(_bizNameConfirmKey);
      return 'Please confirm your business opportunity name';
    }

    // Check referral link
    if (_refLinkController.text.trim().isEmpty) {
      _scrollToField(_refLinkKey);
      return 'Please enter your referral link';
    }

    // Check referral link confirmation
    if (_refLinkConfirmController.text.trim().isEmpty) {
      _scrollToField(_refLinkConfirmKey);
      return 'Please confirm your referral link';
    }

    // Business Name Content Validation
    final businessName = _bizNameController.text.trim();
    final RegExp businessNameRegExp = RegExp(r"^[a-zA-Z0-9\s&'\-.,]+$");

    if (!businessNameRegExp.hasMatch(businessName)) {
      _scrollToField(_bizNameKey);
      return 'Business name can only contain letters, numbers, and common punctuation.';
    }

    // Referral Link URL Validation
    final referralLink = _refLinkController.text.trim();
    try {
      final uri = Uri.parse(referralLink);
      if (!uri.isAbsolute || uri.host.isEmpty) {
        throw const FormatException('Invalid URL format');
      }
    } catch (_) {
      _scrollToField(_refLinkKey);
      return 'Please enter a valid referral link (e.g., https://example.com).';
    }

    // Confirmation field validation
    if (_bizNameController.text != _bizNameConfirmController.text) {
      _scrollToField(_bizNameConfirmKey);
      return 'Business Name fields must match for confirmation.';
    }

    if (_refLinkController.text != _refLinkConfirmController.text) {
      _scrollToField(_refLinkConfirmKey);
      return 'Referral Link fields must match for confirmation.';
    }

    return null; // No validation errors
  }

  Future<void> _submit() async {
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

      // 🆕 Set profile completion flag for admin users
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .update({
        'isProfileComplete': true,
        //SUBSCRIPTION TRIAL FIELDS:
        'subscriptionStatus': 'trial',
        'trialStartDate': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile completed successfully!')),
        );

        // Navigate to profile screen
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => NavigationShell(appId: widget.appId),
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
      appBar: const AppScreenBar(title: 'Admin Setup', actions: []),
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
                        'Your Business Opportunity',
                        style: TextStyle(
                            fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Business Opportunity Section
                    const Divider(color: Colors.blue, thickness: 2),
                    const SizedBox(height: 16),
                    const Text(
                      "Your business opportunity information can only be set once and cannot be changed.",
                      style: TextStyle(
                          fontWeight: FontWeight.bold, color: Colors.red),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: _bizNameKey,
                      controller: _bizNameController,
                      decoration: const InputDecoration(
                        labelText: 'Your Business Opportunity Name',
                        helperText: 'This cannot be changed once set',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      validator: (value) => value!.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      key: _bizNameConfirmKey,
                      controller: _bizNameConfirmController,
                      decoration: const InputDecoration(
                        labelText: 'Confirm Business Opportunity Name',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      validator: (value) => value!.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 16),

                    GestureDetector(
                      onTap: () {
                        showDialog(
                          context: context,
                          barrierDismissible: true,
                          builder: (BuildContext dialogContext) => AlertDialog(
                            title: const Text(
                              'Very Important!',
                              style: TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold),
                            ),
                            content: const Text(
                                'You must enter the exact referral link you received from your company. '
                                'This will ensure your team members that join your business opportunity '
                                'are automatically placed in your business opportunity team.'),
                            actions: [
                              TextButton(
                                onPressed: () {
                                  try {
                                    Navigator.of(dialogContext).pop();
                                  } catch (e) {
                                    debugPrint('❌ ADMIN_PROFILE: Error closing info dialog: $e');
                                    Navigator.of(context).pop();
                                  }
                                },
                                child: const Text('I Understand'),
                              ),
                            ],
                          ),
                        );
                      },
                      child: Column(
                        children: [
                          TextFormField(
                            key: _refLinkKey,
                            controller: _refLinkController,
                            decoration: const InputDecoration(
                              labelText: 'Your Referral Link',
                              helperText: 'This cannot be changed once set',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                            ),
                            validator: (value) =>
                                value!.isEmpty ? 'Required' : null,
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            key: _refLinkConfirmKey,
                            controller: _refLinkConfirmController,
                            decoration: const InputDecoration(
                              labelText: 'Confirm Referral Link URL',
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                            ),
                            validator: (value) =>
                                value!.isEmpty ? 'Required' : null,
                          ),
                        ],
                      ),
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
    _scrollController.dispose();
    _bizNameController.dispose();
    _bizNameConfirmController.dispose();
    _refLinkController.dispose();
    _refLinkConfirmController.dispose();
    super.dispose();
  }
}
