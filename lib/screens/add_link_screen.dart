// lib/screens/add_link_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
import '../services/link_validator_service.dart';
import '../widgets/header_widgets.dart';
import '../config/app_colors.dart';
import 'company_screen.dart';
import 'package:flutter/foundation.dart';

class AddLinkScreen extends StatefulWidget {
  final String appId;

  const AddLinkScreen({super.key, required this.appId});

  @override
  State<AddLinkScreen> createState() => _AddLinkScreenState();
}

class _AddLinkScreenState extends State<AddLinkScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _bizOppRefUrlController = TextEditingController();
  final TextEditingController _bizOppRefUrlConfirmController = TextEditingController();
  final FirestoreService _firestoreService = FirestoreService();

  String? _baseUrl;
  String? _bizOpp;
  String _bizOppName = 'business opportunity';
  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasShownDialog = false; // Track if dialog has been shown
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  // Global keys for referral link fields
  final _bizOppRefUrlKey = GlobalKey();
  final _bizOppRefUrlConfirmKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));

    // Add listeners to update preview in real-time
    _bizOppRefUrlController.addListener(() {
      setState(() {}); // Rebuild to update preview
    });
    _bizOppRefUrlConfirmController.addListener(() {
      setState(() {}); // Rebuild to update confirmation validation
    });

    _loadData();
  }

  @override
  void dispose() {
    _bizOppRefUrlController.dispose();
    _bizOppRefUrlConfirmController.dispose();
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    try {
      final user = Provider.of<UserModel?>(context, listen: false);
      if (user == null) {
        if (mounted) setState(() => _isLoading = false);
        return;
      }

      String? adminUid;
      if (user.role == 'admin') {
        adminUid = user.uid;
      } else {
        adminUid = user.uplineAdmin;
      }

      if (adminUid != null && adminUid.isNotEmpty) {
        final doc = await FirebaseFirestore.instance
            .collection('admin_settings')
            .doc(adminUid)
            .get();

        if (mounted && doc.exists) {
          final data = doc.data();
          final String? originalUrl = data?['biz_opp_ref_url'];

          setState(() {
            _bizOpp = data?['biz_opp'];
            _bizOppName = data?['biz_opp'] ?? 'business opportunity';
            if (originalUrl != null && originalUrl.isNotEmpty) {
              final uri = Uri.parse(originalUrl);
              
              // Store base URL as scheme + host for validation
              _baseUrl = "${uri.scheme}://${uri.host}";
            }
          });
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint("Error fetching admin settings: $e");
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
        _animationController.forward();
      }
    }
  }

  /// Validate that the link begins with the expected host from the business opportunity
  String? _validateUrlStructure(String url) {
    if (_bizOpp == null || _baseUrl == null) {
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
      if (url.trim() == _baseUrl!.trim() || url.trim() == _baseUrl!.trim().replaceAll(RegExp(r'/$'), '')) {
        return 'Please enter your unique referral link,\nnot just the homepage';
      }

      return null; // Valid
    } catch (e) {
      return 'Invalid link format';
    }
  }

  Future<void> _saveAndContinue() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _isSaving = true);

    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) {
      if (mounted) setState(() => _isSaving = false);
      return;
    }

    try {
      // Use the complete referral link directly
      final completeReferralUrl = _bizOppRefUrlController.text.trim();

      // Validate the referral URL accessibility using Firebase Cloud Function
      final isValidUrl = await LinkValidatorService.validateReferralUrl(completeReferralUrl);
      if (!isValidUrl) {
        if (mounted) {
          setState(() => _isSaving = false);
          _showUrlValidationFailedDialog();
        }
        return;
      }

      // Check if the referral link is already in use
      final isUnique =
          await _checkReferralUrlUniqueness(completeReferralUrl, user.uid);
      if (!isUnique) {
        if (mounted) {
          setState(() => _isSaving = false);
          _showReferralUrlInUseDialog();
        }
        return;
      }

      await _firestoreService.updateUser(user.uid, {
        'biz_opp_ref_url': completeReferralUrl,
        'biz_join_date': FieldValue.serverTimestamp(),
        'biz_opp': _bizOpp,
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.textInverse),
              const SizedBox(width: 12),
              const Text('Profile Updated Successfully!'),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => CompanyScreen(appId: widget.appId)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(Icons.error, color: AppColors.textInverse),
              const SizedBox(width: 12),
              Text('Error: $e'),
            ],
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  /// Check if the referral link is unique across all users
  Future<bool> _checkReferralUrlUniqueness(
      String referralUrl, String currentUserId) async {
    try {
      return await _firestoreService.checkReferralUrlUniqueness(
          referralUrl, currentUserId);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error checking referral link uniqueness: $e');
      }
      // In case of error, assume it's not unique to be safe
      return false;
    }
  }

  /// Show dialog when referral link is already in use
  void _showReferralUrlInUseDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          backgroundColor: AppColors.surface,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.error, 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.warning_amber,
                  color: AppColors.error,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Referral Link Already in Use',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.error,
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
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                  children: [
                    const TextSpan(
                      text: 'The ',
                    ),
                    TextSpan(
                      text: _bizOpp ?? 'business opportunity',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const TextSpan(
                      text:
                          ' referral link you entered is already in use by another Network Build Pro member.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.info, 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.info.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.info, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You must use a different referral link to continue.',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textPrimary,
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
            Container(
              width: double.infinity,
              height: 48,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Try Different Link',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textInverse,
                  ),
                ),
              ),
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
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          backgroundColor: AppColors.surface,
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.error, 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.link_off,
                  color: AppColors.error,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Invalid Referral Link',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.error,
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
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                  children: [
                    const TextSpan(
                      text: 'The ',
                    ),
                    TextSpan(
                      text: _bizOpp ?? 'business opportunity',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const TextSpan(
                      text: ' referral link could not be verified. The link may be incorrect, inactive, or temporarily unavailable.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.warning, 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.warning.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.warning, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Please check the link and try again, or contact your sponsor for the correct referral link.',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textPrimary,
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
            Container(
              width: double.infinity,
              height: 48,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(12),
              ),
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Try Again',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textInverse,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildHeroSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.heavyShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.textInverse, 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.keyboard_double_arrow_right_outlined,
              size: 48,
              color: AppColors.textInverse,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Add Your\n${_bizOpp ?? 'Business'} Link',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
              letterSpacing: 0.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildDisclaimerCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.info.withOpacity(0.1),
            AppColors.primary.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.info, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.info, 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.info_outline,
                  color: AppColors.info,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'IMPORTANT INFORMATION',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.info,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textPrimary,
                height: 1.5,
              ),
              children: [
                const TextSpan(
                  text:
                      'You are updating your Network Build Pro account to track referrals to ',
                ),
                TextSpan(
                  text: _bizOpp ?? 'this business opportunity',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const TextSpan(
                  text:
                      '. This is a separate, independent business entity that is ',
                ),
                const TextSpan(
                  text:
                      'NOT owned, operated, or affiliated with Network Build Pro',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    decoration: TextDecoration.underline,
                  ),
                ),
                const TextSpan(text: '.'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.mediumShadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.growthPrimary, 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.settings,
                  color: AppColors.growthPrimary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'How This Works',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.growthPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildBulletPoint(
            'Your referral link will be stored in your Network Build Pro profile for tracking purposes only.',
          ),
          _buildBulletPoint(
            'Should your Network Build Pro network members decide to join ${_bizOpp ?? 'this business'} after you, they will automatically be placed in your ${_bizOpp ?? 'business'} organization.',
          ),
          _buildBulletPoint(
            'This link can only be set once, so please verify it\'s correct before saving.',
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warningBackground,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.warning.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber, color: AppColors.warning, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Network Build Pro is a referral tracking platform only. We do not endorse or guarantee any business opportunities.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.darker(AppColors.warning),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6),
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.growthPrimary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.primary, 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.link,
                  color: AppColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Your ${_bizOpp ?? 'Business'} Referral Link',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.info, 0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.info.withOpacity(0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Enter your $_bizOpp referral link below. This will be used to track referrals from your Network.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textPrimary,
                    height: 1.3,
                  ),
                ),
                if (_baseUrl != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Must begin with: $_baseUrl',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.blue, thickness: 1),
          const SizedBox(height: 16),
          TextFormField(
            key: _bizOppRefUrlKey,
            controller: _bizOppRefUrlController,
            decoration: InputDecoration(
              labelText: 'Enter Your Referral Link',
              helperText: _baseUrl != null 
                  ? 'Must start with $_baseUrl\nThis cannot be changed once set'
                  : 'This cannot be changed once set',
              hintText: _baseUrl != null ? 'e.g., ${_baseUrl}your_username_here' : null,
              border: const OutlineInputBorder(),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your $_bizOpp referral link.';
              }

              // Basic link validation
              if (!value.trim().startsWith('http://') &&
                  !value.trim().startsWith('https://')) {
                return 'Please enter a complete link starting with\nhttp:// or https://';
              }

              try {
                Uri.parse(value.trim());
              } catch (e) {
                return 'Please enter a valid link';
              }

              // Strict link structure validation
              final validationError = _validateUrlStructure(value.trim());
              if (validationError != null) {
                return validationError;
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
                  builder: (_) => AlertDialog(
                    title: const Text(
                      'Very Important!',
                      style: TextStyle(
                          color: Colors.red,
                          fontWeight: FontWeight.bold),
                    ),
                    content: RichText(
                      text: TextSpan(
                        style: const TextStyle(fontSize: 16, color: Colors.black),
                        children: [
                          const TextSpan(text: 'You must enter the exact referral link you received from '),
                          TextSpan(
                            text: _bizOppName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(text: '. This will ensure your Network Build Pro network members that join '),
                          TextSpan(
                            text: _bizOppName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(text: ' are automatically placed in your '),
                          TextSpan(
                            text: _bizOppName,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(text: ' team.'),
                        ],
                      ),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
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
              labelText: 'Confirm Referral Link URL',
              border: OutlineInputBorder(),
              contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please confirm your referral link.';
              }
              if (value.trim() != _bizOppRefUrlController.text.trim()) {
                return 'Referral links do not match exactly';
              }
              return null;
            },
          ),
          if (_bizOppRefUrlController.text.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: AppColors.withOpacity(AppColors.success, 0.1),
                border: Border.all(color: AppColors.success.withOpacity(0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.check_circle,
                          color: AppColors.success, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Referral Link Preview:',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.success,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _bizOppRefUrlController.text.trim(),
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    return Container(
      width: double.infinity,
      height: 56,
      decoration: BoxDecoration(
        gradient: _isSaving ? null : AppColors.primaryGradient,
        color: _isSaving ? AppColors.textTertiary : null,
        borderRadius: BorderRadius.circular(16),
        boxShadow: _isSaving ? null : AppColors.mediumShadow,
      ),
      child: ElevatedButton(
        onPressed: _isSaving ? null : _saveAndContinue,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: _isSaving
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.textInverse,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Validating & Saving...',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textInverse,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.save, color: AppColors.textInverse),
                  const SizedBox(width: 12),
                  Text(
                    'Save & Continue',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textInverse,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);

    if (user == null) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundSecondary,
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildHeroSection(),
                      const SizedBox(height: 24),
                      _buildDisclaimerCard(),
                      const SizedBox(height: 24),
                      _buildInstructionCard(),
                      const SizedBox(height: 24),
                      _buildFormSection(),
                      const SizedBox(height: 32),
                      _buildActionButton(),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
