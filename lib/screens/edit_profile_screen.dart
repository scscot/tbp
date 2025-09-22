// lib/screens/edit_profile_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../services/storage_service.dart';
import '../services/link_validator_service.dart';
import '../services/auth_service.dart';
import '../services/admin_settings_service.dart';
import '../widgets/header_widgets.dart';
import '../data/states_by_country.dart';
import '../widgets/navigation_shell.dart';
import '../widgets/account_setup_modal.dart';
import '../main.dart';
import 'homepage_screen.dart';
import 'package:provider/provider.dart';

class EditProfileScreen extends StatefulWidget {
  final UserModel user;
  final String appId;
  final bool isFirstTimeSetup;

  const EditProfileScreen({
    super.key,
    required this.user,
    required this.appId,
    this.isFirstTimeSetup = false,
  });

  @override
  EditProfileScreenState createState() => EditProfileScreenState();
}

class EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firestoreService = FirestoreService();
  final _storageService = StorageService();
  final _adminSettingsService = AdminSettingsService();

  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _cityController;
  late TextEditingController _bizOppRefUrlController;
  late TextEditingController _bizOppRefUrlConfirmController;

  String? _selectedCountry;
  String? _selectedState;
  bool _isBizOppRepresentative = false;
  String _bizOppName = 'business opportunity';
  String? _baseUrl; // Added for base link validation
  bool _hasShownDialog = false; // Track if dialog has been shown

  File? _imageFile;
  bool _isLoading = false;

  // MODIFICATION: Added state variable to hold the image validation error text.
  String? _imageErrorText;

  // Global keys for referral link fields
  final _bizOppRefUrlKey = GlobalKey();
  final _bizOppRefUrlConfirmKey = GlobalKey();

  List<String> get statesForSelectedCountry =>
      statesByCountry[_selectedCountry] ?? [];

  /// Check if user has incomplete deletion (null essential fields)
  bool get _isIncompleteAccountDeletion {
    return widget.user.firstName == null && 
           widget.user.lastName == null && 
           widget.user.photoUrl == null &&
           widget.user.country == null;
  }

  /// Complete the account deletion process using Cloud Function
  Future<void> _completeAccountDeletion() async {
    try {
      debugPrint('🗑️ EDIT_PROFILE: Completing incomplete account deletion via Cloud Function...');
      
      // Call the cloud function to complete the deletion
      final FirebaseFunctions functions = FirebaseFunctions.instanceFor(region: 'us-central1');
      final callable = functions.httpsCallable('deleteUserAccount');
      
      final result = await callable.call({
        'confirmationEmail': widget.user.email,
      });
      
      debugPrint('✅ EDIT_PROFILE: Cloud function completed: ${result.data}');
      
      // Check if widget is still mounted before using context
      if (!mounted) return;
      
      // Clear all cached data
      final authService = context.read<AuthService>();
      await authService.signOutAndClearAllData();
      debugPrint('✅ EDIT_PROFILE: All cached data cleared');
      
      // Navigate to homepage
      while (navigatorKey.currentState?.canPop() == true) {
        navigatorKey.currentState?.pop();
      }
      
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => HomepageScreen(appId: widget.appId),
        ),
        (route) => false,
      );
      
      // Show completion message
      final messenger = ScaffoldMessenger.of(navigatorKey.currentContext!);
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Account deletion completed. Thank you for using Team Build Pro.'),
          backgroundColor: Colors.green,
          duration: Duration(seconds: 5),
        ),
      );
      
    } catch (e) {
      debugPrint('❌ EDIT_PROFILE: Error completing account deletion: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error completing account deletion: $e'),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    
    // Check if this is an incomplete account deletion
    if (_isIncompleteAccountDeletion) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _showIncompleteDeleteionDialog();
      });
    }
    _firstNameController = TextEditingController(text: widget.user.firstName);
    _lastNameController = TextEditingController(text: widget.user.lastName);
    _cityController = TextEditingController(text: widget.user.city);
    _bizOppRefUrlController =
        TextEditingController(text: widget.user.bizOppRefUrl);
    _bizOppRefUrlConfirmController =
        TextEditingController(text: widget.user.bizOppRefUrl);

    _selectedCountry =
        widget.user.country?.isNotEmpty == true ? widget.user.country : null;
    _selectedState =
        widget.user.state?.isNotEmpty == true ? widget.user.state : null;
    _isBizOppRepresentative = widget.user.bizOppRefUrl != null &&
        widget.user.bizOppRefUrl!.isNotEmpty;

    _fetchBizOppName();
  }

  Future<void> _fetchBizOppName() async {
    try {
      // Get the upline admin ID from current user's data
      final uplineAdmin = widget.user.uplineAdmin;

      if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
        // Get admin settings using AdminSettingsService for consistent caching
        final bizOpp = await _adminSettingsService.getBizOppName(
          uplineAdmin,
          fallback: 'business opportunity'
        );

        if (bizOpp.isNotEmpty) {
          setState(() {
            _bizOppName = bizOpp;
          });

          // Still need to get biz_opp_ref_url for base URL validation
          final adminSettingsDoc = await FirebaseFirestore.instance
              .collection('admin_settings')
              .doc(uplineAdmin)
              .get();

          if (adminSettingsDoc.exists) {
            final data = adminSettingsDoc.data();
            final bizOppRefUrl = data?['biz_opp_ref_url'] as String?;

            // Extract base link for validation (same logic as AddLinkScreen)
            if (bizOppRefUrl != null && bizOppRefUrl.isNotEmpty) {
              try {
                final uri = Uri.parse(bizOppRefUrl);

                // Store base URL as scheme + host for validation
                _baseUrl = "${uri.scheme}://${uri.host}";

                setState(() {});
              } catch (e) {
                debugPrint('Error parsing base URL: $e');
              }
            }
          }
        }
      }
    } catch (e) {
      debugPrint('Error fetching business opportunity name: $e');
    }
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _cityController.dispose();
    _bizOppRefUrlController.dispose();
    _bizOppRefUrlConfirmController.dispose();
    super.dispose();
  }

  Future<void> _scrollToField(GlobalKey fieldKey) async {
    if (fieldKey.currentContext != null) {
      await Future.delayed(const Duration(milliseconds: 100));
      await Scrollable.ensureVisible(
        fieldKey.currentContext!,
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
        alignment: 0.2,
      );
    }
  }

  /// Validate that the link begins with the expected host from the business opportunity
  String? _validateUrlStructure(String url) {
    if (_bizOppName == 'business opportunity' || _baseUrl == null) {
      return null; // No validation if no business opportunity set
    }

    try {
      final uri = Uri.parse(url);

      // Basic validation - ensure it's a proper link with host
      if (uri.host.isEmpty) {
        return 'Please enter a valid link with a proper domain';
      }

      // Ensure it's not a localhost or IP address (basic business link validation)
      if (uri.host == 'localhost' ||
          uri.host.startsWith('127.') ||
          uri.host.startsWith('192.168.') ||
          uri.host.startsWith('10.') ||
          RegExp(r'^\d+\.\d+\.\d+\.\d+$').hasMatch(uri.host)) {
        return 'Please enter a valid business referral link\n(not localhost or IP address)';
      }

      // Ensure it has a proper TLD
      if (!uri.host.contains('.')) {
        return 'Please enter a valid link with a proper domain\n(e.g., company.com)';
      }

      // Simple validation: entered link must begin with the base URL (scheme + host)
      if (!url.startsWith(_baseUrl!)) {
        return 'Referral link must begin with:\n$_baseUrl';
      }

      // Ensure the entered URL is not just the homepage (must have additional path/parameters)
      if (url.trim() == _baseUrl!.trim() ||
          url.trim() == _baseUrl!.trim().replaceAll(RegExp(r'/$'), '')) {
        return 'Please enter your unique referral link,\nnot just the homepage';
      }

      return null; // Valid
    } catch (e) {
      return 'Invalid link format';
    }
  }

  Future<void> _pickImage() async {
    final imagePicker = ImagePicker();
    final pickedFile = await imagePicker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
        // MODIFICATION: Clear the error message when an image is successfully picked.
        _imageErrorText = null;
      });
    }
  }

  String? _validateBizOppFields() {
    if (_isBizOppRepresentative) {
      // Check referral link
      if (_bizOppRefUrlController.text.trim().isEmpty) {
        _scrollToField(_bizOppRefUrlKey);
        return 'Please enter your referral link';
      }

      // Check referral link confirmation
      if (_bizOppRefUrlConfirmController.text.trim().isEmpty) {
        _scrollToField(_bizOppRefUrlConfirmKey);
        return 'Please confirm your referral link';
      }

      // Comprehensive Referral Link link Validation
      final referralLink = _bizOppRefUrlController.text.trim();

      // Basic link validation
      if (!referralLink.startsWith('http://') &&
          !referralLink.startsWith('https://')) {
        _scrollToField(_bizOppRefUrlKey);
        return 'Please enter a complete link starting with\nhttp:// or https://';
      }

      try {
        Uri.parse(referralLink);
      } catch (_) {
        _scrollToField(_bizOppRefUrlKey);
        return 'Please enter a valid referral link (e.g., https://example.com).';
      }

      // Comprehensive link structure validation
      final validationError = _validateUrlStructure(referralLink);
      if (validationError != null) {
        _scrollToField(_bizOppRefUrlKey);
        return validationError;
      }

      if (_bizOppRefUrlController.text != _bizOppRefUrlConfirmController.text) {
        _scrollToField(_bizOppRefUrlConfirmKey);
        return 'Referral Link fields must match for confirmation.';
      }
    }
    return null;
  }

  /// Show dialog for incomplete account deletion
  void _showIncompleteDeleteionDialog() {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Icon(
                Icons.warning,
                color: Colors.orange,
                size: 24,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Account Deletion Incomplete',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Your account deletion was not completed properly. Your personal data has been removed but your authentication session is still active.',
                style: TextStyle(fontSize: 16, height: 1.4),
              ),
              SizedBox(height: 16),
              Text(
                'We will now complete the account deletion process.',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () async {
                try {
                  Navigator.of(dialogContext).pop();
                } catch (e) {
                  debugPrint('❌ EDIT_PROFILE: Error closing deletion dialog: $e');
                  Navigator.of(context).pop();
                }
                await _completeAccountDeletion();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
              ),
              child: const Text('Complete Deletion'),
            ),
          ],
        );
      },
    );
  }

  /// Show dialog when referral URL validation fails
  void _showUrlValidationFailedDialog() {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Icon(
                Icons.link_off,
                color: Colors.red,
                size: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Invalid Referral Link',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.red,
                  ),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                text: TextSpan(
                  style: const TextStyle(
                    fontSize: 16,
                    color: Colors.black,
                    height: 1.4,
                  ),
                  children: [
                    const TextSpan(
                      text: 'The ',
                    ),
                    TextSpan(
                      text: _bizOppName,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const TextSpan(
                      text:
                          ' referral link could not be verified. The link may be incorrect, inactive, or temporarily unavailable.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.orange, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Please check the link and try again, or contact your sponsor for the correct referral link.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.black,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                try {
                  Navigator.of(dialogContext).pop();
                } catch (e) {
                  debugPrint('❌ EDIT_PROFILE: Error closing URL validation dialog: $e');
                  Navigator.of(context).pop();
                }
              },
              child: const Text(
                'Try Again',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> triggerSponsorshipAfterProfileComplete() async {
    final functions = FirebaseFunctions.instanceFor(region: 'us-central1');
    final callable = functions.httpsCallable('triggerSponsorship');
    try {
      final res = await callable.call(); // returns { ok: true, sponsorId: ..., sponsorName: ... }
      final data = res.data;
      if (data['ok'] == true) {
        final sponsorId = data['sponsorId'];
        final sponsorName = data['sponsorName'];
        if (sponsorId != null && sponsorName != null) {
          debugPrint('🟢 triggerSponsorship success: Notified sponsor $sponsorName (ID: $sponsorId)');
        } else {
          debugPrint('🟢 triggerSponsorship success: No sponsor found for this user');
        }
      } else {
        debugPrint('🟡 triggerSponsorship skipped: ${data['reason'] ?? 'unknown reason'}');
      }
    } on FirebaseFunctionsException catch (e) {
      debugPrint('🔴 triggerSponsorship failed: code=${e.code} message=${e.message}');
    } catch (e) {
      debugPrint('🔴 triggerSponsorship error: $e');
    }
  }

  Future<void> _saveProfile() async {
    // MODIFICATION: The validation logic is updated to handle both
    // the form fields and the custom image picker validation.

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

    // Validate business opportunity fields
    final bizOppValidationError = _validateBizOppFields();
    if (bizOppValidationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(bizOppValidationError)),
      );
      return;
    }

    // Validate referral URL accessibility if user is a business opportunity representative
    if (_isBizOppRepresentative &&
        _bizOppRefUrlController.text.trim().isNotEmpty) {
      final referralUrl = _bizOppRefUrlController.text.trim();
      final isValidUrl =
          await LinkValidatorService.validateReferralUrl(referralUrl);
      if (!isValidUrl) {
        if (mounted) {
          _showUrlValidationFailedDialog();
        }
        return;
      }
    }

    // Only proceed if both the form and the image are valid.

    if (isFormValid && isImageValid) {
      setState(() => _isLoading = true);

      // Show account setup modal for first-time setup
      if (widget.isFirstTimeSetup && mounted) {
        showAccountSetupModal(
          context: context,
          title: '🚀 Setting up your account...',
          description: 'Please wait while we get everything ready for you',
        );
      }

      // Capture context-dependent objects before async operations
      if (!mounted) return;
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

        final updatedData = <String, dynamic>{
          'firstName': _firstNameController.text.trim(),
          'lastName': _lastNameController.text.trim(),
          'city': _cityController.text.trim(),
          'country': _selectedCountry,
          'state': _selectedState,
          'photoUrl': photoUrl,
          'biz_opp_ref_url': _isBizOppRepresentative
              ? _bizOppRefUrlController.text.trim()
              : null,
          // 🆕 Set profile completion flag for first-time setup
          if (widget.isFirstTimeSetup) 'isProfileComplete': true,

          // SUBSCRIPTION TRIAL FIELDS:
          if (widget.isFirstTimeSetup) 'subscriptionStatus': 'trial',
          if (widget.isFirstTimeSetup)
            'trialStartDate': FieldValue.serverTimestamp(),
        };

        // Add timezone recalculation when location data is updated
        if (_selectedCountry != null && _selectedState != null) {
          // Call backend function to recalculate timezone based on new location
          try {
            final HttpsCallable callable =
                FirebaseFunctions.instanceFor(region: 'us-central1')
                    .httpsCallable('updateUserTimezone');
            await callable.call({
              'userId': widget.user.uid,
              'country': _selectedCountry,
              'state': _selectedState,
            });
            debugPrint(
                '✅ PROFILE UPDATE: Timezone recalculated for country: $_selectedCountry, state: $_selectedState');
          } catch (e) {
            debugPrint('⚠️ PROFILE UPDATE: Failed to recalculate timezone: $e');
            // Continue with profile update even if timezone update fails
          }
        }

        // Add business opportunity fields if user is a representative
        if (_isBizOppRepresentative) {
          final now = FieldValue.serverTimestamp();
          updatedData.addAll({
            'biz_join_date': now,
            'biz_visit_date': now,
            'qualifiedDate': now,
            'biz_opp': _bizOppName,
          });
        }

        await _firestoreService.updateUser(widget.user.uid, updatedData);

        // DISABLED: Manual sponsorship trigger to prevent duplicate push notifications
        // The automatic onUserProfileCompleted trigger handles sponsorship notifications
        // await triggerSponsorshipAfterProfileComplete();

        if (!mounted) return;

        // Hide modal if it was shown
        if (widget.isFirstTimeSetup) {
          hideAccountSetupModal(context);
        }

        scaffoldMessenger.showSnackBar(
          const SnackBar(
              content: Text('Profile updated successfully!'),
              backgroundColor: Colors.green),
        );

        if (widget.isFirstTimeSetup) {
          navigator.pushAndRemoveUntil(
              MaterialPageRoute(
                  builder: (_) => NavigationShell(appId: widget.appId)),
              (route) => false);
        } else {
          navigator.pop();
        }
      } catch (e) {
        if (!mounted) return;

        // Hide modal if it was shown and there was an error
        if (widget.isFirstTimeSetup) {
          hideAccountSetupModal(context);
        }

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
      appBar: const AppScreenBar(title: 'Edit Profile', actions: []),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            Text(
              widget.isFirstTimeSetup
                  ? 'Complete Your Profile'
                  : 'Edit Profile',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            if (widget.isFirstTimeSetup) ...[
              const SizedBox(height: 8),
              const Text(
                'Please upload a photo and confirm your details to get started.',
                textAlign: TextAlign.center,
              )
            ],
            const SizedBox(height: 24),
            GestureDetector(
              onTap: _pickImage,
              child: Stack(
                children: [
                  CircleAvatar(
                    radius: 60,
                    backgroundImage: _imageFile != null
                        ? FileImage(_imageFile!)
                        : (widget.user.photoUrl != null &&
                                widget.user.photoUrl!.isNotEmpty
                            ? NetworkImage(widget.user.photoUrl!)
                            : null) as ImageProvider?,
                    child: _imageFile == null &&
                            (widget.user.photoUrl == null ||
                                widget.user.photoUrl!.isEmpty)
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
                          border: Border.all(color: Colors.white, width: 2)),
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
            // MODIFICATION: This new block displays the validation error text
            // for the image, styled to match other form field errors.
            if (_imageErrorText != null) ...[
              const SizedBox(height: 8),
              Text(
                _imageErrorText!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: 24),
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _firstNameController,
                    decoration: const InputDecoration(
                      labelText: 'First Name',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value!.isEmpty ? 'First name cannot be empty' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _lastNameController,
                    decoration: const InputDecoration(
                      labelText: 'Last Name',
                      border: OutlineInputBorder(),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    validator: (value) =>
                        value!.isEmpty ? 'Last name cannot be empty' : null,
                  ),
                  const SizedBox(height: 16),
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
                  const SizedBox(height: 16),
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
                  const SizedBox(height: 16),
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
                  const SizedBox(height: 16),

                  // Business Opportunity Representative Section
                  RichText(
                    text: TextSpan(
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Colors.black),
                      children: [
                        const TextSpan(text: 'Are you currently a '),
                        TextSpan(
                          text: _bizOppName,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const TextSpan(text: ' representative?'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: RadioListTile<bool>(
                          title: const Text('Yes'),
                          value: true,
                          groupValue: _isBizOppRepresentative,
                          onChanged: (value) {
                            setState(() {
                              _isBizOppRepresentative = value ?? false;
                              if (!_isBizOppRepresentative) {
                                _bizOppRefUrlController.clear();
                                _bizOppRefUrlConfirmController.clear();
                              }
                            });
                          },
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<bool>(
                          title: const Text('No'),
                          value: false,
                          groupValue: _isBizOppRepresentative,
                          onChanged: (value) {
                            setState(() {
                              _isBizOppRepresentative = value ?? false;
                              if (!_isBizOppRepresentative) {
                                _bizOppRefUrlController.clear();
                                _bizOppRefUrlConfirmController.clear();
                              }
                            });
                          },
                        ),
                      ),
                    ],
                  ),

                  // Conditional Referral Link Fields
                  if (_isBizOppRepresentative) ...[
                    const SizedBox(height: 16),
                    const Divider(color: Colors.blue, thickness: 1),
                    const SizedBox(height: 16),
                    RichText(
                      text: TextSpan(
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.blue.shade700,
                        ),
                        children: [
                          const TextSpan(text: 'Your '),
                          TextSpan(
                            text: _bizOppName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(text: ' Referral Link'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    RichText(
                      text: TextSpan(
                        style: const TextStyle(
                          fontSize: 14,
                          color: Colors.black,
                        ),
                        children: [
                          const TextSpan(text: 'Please enter your '),
                          TextSpan(
                            text: _bizOppName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(
                              text:
                                  ' referral link. This will be used to track referrals from your team.'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: _bizOppRefUrlKey,
                      controller: _bizOppRefUrlController,
                      decoration: InputDecoration(
                        labelText: 'Enter Your Referral Link',
                        helperText: _baseUrl != null
                            ? 'Must start with $_baseUrl\nThis cannot be changed once set'
                            : 'This cannot be changed once set',
                        hintText: _baseUrl != null
                            ? 'e.g., ${_baseUrl}your_username_here'
                            : null,
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                      ),
                      validator: (value) {
                        if (_isBizOppRepresentative &&
                            (value == null || value.isEmpty)) {
                          return 'Required when you are a representative';
                        }

                        if (_isBizOppRepresentative &&
                            value != null &&
                            value.isNotEmpty) {
                          // Basic link validation
                          if (!value.trim().startsWith('http://') &&
                              !value.trim().startsWith('https://')) {
                            return 'Please enter a complete link starting with\nhttp:// or https://';
                          }

                          try {
                            Uri.parse(value.trim());
                          } catch (e) {
                            return 'Please enter a valid referral link (e.g., $_baseUrl).';
                          }

                          // Comprehensive link structure validation
                          final validationError =
                              _validateUrlStructure(value.trim());
                          if (validationError != null) {
                            return validationError;
                          }
                        }

                        return null;
                      },
                      onTap: () {
                        if (!_hasShownDialog) {
                          setState(() {
                            _hasShownDialog = true;
                          });
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
                              content: RichText(
                                text: TextSpan(
                                  style: const TextStyle(
                                      fontSize: 16, color: Colors.black),
                                  children: [
                                    const TextSpan(
                                        text:
                                            'You must enter the exact referral link you received from '),
                                    TextSpan(
                                      text: _bizOppName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold),
                                    ),
                                    const TextSpan(
                                        text:
                                            '. This will ensure your team members that join '),
                                    TextSpan(
                                      text: _bizOppName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold),
                                    ),
                                    const TextSpan(
                                        text:
                                            ' are automatically placed in your '),
                                    TextSpan(
                                      text: _bizOppName,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold),
                                    ),
                                    const TextSpan(text: ' team.'),
                                  ],
                                ),
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () {
                                    try {
                                      Navigator.of(dialogContext).pop();
                                    } catch (e) {
                                      debugPrint('❌ EDIT_PROFILE: Error closing info dialog: $e');
                                      Navigator.of(context).pop();
                                    }
                                  },
                                  child: const Text('I Understand'),
                                ),
                              ],
                            ),
                          );
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: _bizOppRefUrlConfirmKey,
                      controller: _bizOppRefUrlConfirmController,
                      decoration: const InputDecoration(
                        labelText: 'Confirm Referral Link',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      validator: (value) => _isBizOppRepresentative &&
                              (value == null || value.isEmpty)
                          ? 'Required when you are a representative'
                          : null,
                    ),
                    const SizedBox(height: 16),
                  ],

                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _saveProfile,
                    child: _isLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 3,
                            ))
                        : const Text('Save Changes'),
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
