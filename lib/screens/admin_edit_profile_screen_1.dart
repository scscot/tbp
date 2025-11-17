import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../widgets/navigation_shell.dart';
import '../services/link_validator_service.dart';

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
  bool _isValidatingUrl = false;

  @override
  void initState() {
    super.initState();
    _refLinkController.addListener(_smartFormatUrl);
  }

  void _smartFormatUrl() {
    final text = _refLinkController.text.trim();

    if (text.isNotEmpty && !text.startsWith('http://') && !text.startsWith('https://')) {
      if (!text.contains('://')) {
        final cursorPos = _refLinkController.selection.baseOffset;
        _refLinkController.value = TextEditingValue(
          text: 'https://$text',
          selection: TextSelection.collapsed(offset: cursorPos + 8),
        );
      }
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

  void _showValidationErrorDialog(String errorMessage) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            const Icon(
              Icons.error_outline,
              color: Colors.red,
              size: 28,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Referral Link Error',
                style: TextStyle(
                  fontSize: 20,
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
            Text(
              errorMessage,
              style: const TextStyle(
                fontSize: 16,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Please verify your referral link and try again.',
                      style: TextStyle(
                        fontSize: 14,
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
                debugPrint('❌ ADMIN_PROFILE: Error closing validation dialog: $e');
                Navigator.of(context).pop();
              }
            },
            child: const Text(
              'OK',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<String?> _validateReferralLinkAsync(String referralLink) async {
    // Client-side pre-checks for instant feedback
    try {
      final uri = Uri.parse(referralLink);
      if (!uri.isAbsolute || uri.host.isEmpty) {
        return 'Please enter a valid URL (e.g., https://example.com)';
      }
      if (uri.scheme != 'https') {
        return 'Referral link must use HTTPS (not HTTP) for security';
      }

      // Ensure not localhost or IP address (business links should be public)
      if (uri.host == 'localhost' ||
          uri.host.startsWith('127.') ||
          uri.host.startsWith('192.168.') ||
          uri.host.startsWith('10.') ||
          RegExp(r'^\d+\.\d+\.\d+\.\d+$').hasMatch(uri.host)) {
        return 'Please enter a valid business referral link\n(not localhost or IP address)';
      }

      // Ensure proper TLD
      if (!uri.host.contains('.')) {
        return 'Please enter a valid URL with a proper domain\n(e.g., company.com)';
      }

      // Ensure it's not just a homepage - must have path or query parameters
      // Admins should provide their unique referral link, not just the base domain
      if ((uri.path.isEmpty || uri.path == '/' || uri.path == '') &&
          uri.query.isEmpty &&
          uri.fragment.isEmpty) {
        return 'Please enter your complete referral link, not just the homepage.\nYour referral link should include your unique identifier\n(e.g., https://company.com/join?ref=yourname)';
      }
    } catch (_) {
      return 'Invalid URL format. Please check your referral link.';
    }

    // Server-side validation with comprehensive checks
    setState(() => _isValidatingUrl = true);
    try {
      final result = await LinkValidatorService.validateReferralUrl(referralLink);
      if (!result.isValid) {
        return result.error ?? 'Unable to verify referral link';
      }
      return null; // Valid
    } catch (e) {
      debugPrint('❌ ADMIN_PROFILE: Validation error: $e');
      // Handle network/connection errors with user-friendly message
      if (e.toString().contains('fetch failed') || e.toString().contains('network')) {
        return 'The referral link you entered could not be verified. Please check your internet connection and try again.';
      }
      return 'The referral link you entered could not be verified. Please check the URL and try again.';
    } finally {
      if (mounted) {
        setState(() => _isValidatingUrl = false);
      }
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

    // Referral Link URL Validation - basic client-side check only
    // (comprehensive validation happens in _submit() via async call)
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

    // Comprehensive async referral link validation
    final referralLink = _refLinkController.text.trim();
    final urlValidationError = await _validateReferralLinkAsync(referralLink);
    if (urlValidationError != null) {
      _scrollToField(_refLinkKey);
      if (mounted) {
        _showValidationErrorDialog(urlValidationError);
      }
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
      appBar: const AppScreenBar(title: 'Business Setup', actions: []),
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
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          "⚠️ Important: This information cannot be changed once saved.",
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.red,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Your business opportunity name and referral link ensure that Team Build Pro members "
                          "are accurately placed in your business opportunity downline when they qualify. "
                          "Changing this would break the connection between your networks.",
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            height: 1.4,
                          ),
                        ),
                      ],
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
                            decoration: InputDecoration(
                              labelText: 'Your Referral Link',
                              helperText: 'This cannot be changed once set',
                              border: const OutlineInputBorder(),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                              suffixIcon: _isValidatingUrl
                                  ? const Padding(
                                      padding: EdgeInsets.all(12.0),
                                      child: SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      ),
                                    )
                                  : null,
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
                          if (_refLinkController.text.isNotEmpty) ...{
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                color: Colors.green.withValues(alpha: 0.1),
                                border: Border.all(
                                    color: Colors.green.withValues(alpha: 0.3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.check_circle,
                                          color: Colors.green.shade700, size: 20),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Referral Link Preview:',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.green,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    _refLinkController.text.trim(),
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: Colors.black87,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          },
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
    _refLinkController.removeListener(_smartFormatUrl);
    _scrollController.dispose();
    _bizNameController.dispose();
    _bizNameConfirmController.dispose();
    _refLinkController.dispose();
    _refLinkConfirmController.dispose();
    super.dispose();
  }
}
