// lib/screens/add_link_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_model.dart';
import '../services/firestore_service.dart';
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
  final TextEditingController _refLinkController = TextEditingController();
  final TextEditingController _refLinkConfirmController =
      TextEditingController();
  final FirestoreService _firestoreService = FirestoreService();

  String? _baseUrl;
  String? _bizOpp;
  String? _originalIdentifierExample;
  bool _isLoading = true;
  bool _isSaving = false;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

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
    
    // Add listener to update preview in real-time
    _refLinkController.addListener(() {
      setState(() {}); // Rebuild to update preview
    });
    
    _loadData();
  }

  @override
  void dispose() {
    _refLinkController.dispose();
    _refLinkConfirmController.dispose();
    _animationController.dispose();
    super.dispose();
  }


  bool _validateIdentifierFormat(String userIdentifier) {
    // Simplified validation - just check for basic requirements
    // Don't be too strict about format matching since users need flexibility
    
    // Allow any reasonable identifier format
    // Just prevent obviously wrong inputs like URLs or special characters that would break URLs
    if (userIdentifier.contains(' ')) {
      return false; // No spaces in URLs
    }
    
    return true; // Allow most other formats
  }

  String _buildPreviewUrl() {
    if (_baseUrl == null) return '';
    
    final userInput = _refLinkController.text.trim();
    
    if (_originalIdentifierExample != null && _originalIdentifierExample!.startsWith('?')) {
      // Query parameter format
      final paramMatch = RegExp(r'\?(\w+)=').firstMatch(_originalIdentifierExample!);
      if (paramMatch != null) {
        final paramName = paramMatch.group(1)!;
        return userInput.isEmpty 
          ? '${_baseUrl}?${paramName}=[your_${paramName}_here]'
          : '${_baseUrl}?${paramName}=${userInput}';
      }
    }
    
    // Path-based format
    return userInput.isEmpty 
      ? '${_baseUrl}[your_identifier_here]'
      : '${_baseUrl}${userInput}';
  }

  String _getInputHint() {
    if (_originalIdentifierExample != null && _originalIdentifierExample!.startsWith('?')) {
      // Extract parameter name for query format
      final paramMatch = RegExp(r'\?(\w+)=').firstMatch(_originalIdentifierExample!);
      if (paramMatch != null) {
        final paramName = paramMatch.group(1)!;
        return 'your_${paramName}_here';
      }
    }
    return 'your_username_here';
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
            if (originalUrl != null && originalUrl.isNotEmpty) {
              final uri = Uri.parse(originalUrl);
              
              // Extract the base URL and identifier pattern
              if (uri.hasQuery) {
                // Handle query parameter format (e.g., ?id=1234)
                _baseUrl = "${uri.scheme}://${uri.host}${uri.path}";
                final queryParams = uri.queryParameters;
                if (queryParams.isNotEmpty) {
                  final firstParam = queryParams.entries.first;
                  _originalIdentifierExample = "?${firstParam.key}=[your_${firstParam.key}_here]";
                }
              } else {
                // Handle path-based format (e.g., /username)
                _baseUrl = "${uri.scheme}://${uri.host}/";
                final pathSegments = uri.pathSegments;
                if (pathSegments.isNotEmpty) {
                  _originalIdentifierExample = pathSegments.last;
                }
              }
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
      // Combine base URL with user's unique identifier
      String completeReferralUrl;
      final userInput = _refLinkController.text.trim();
      
      if (_originalIdentifierExample != null && _originalIdentifierExample!.startsWith('?')) {
        // Query parameter format: extract parameter name and construct URL
        final paramMatch = RegExp(r'\?(\w+)=').firstMatch(_originalIdentifierExample!);
        if (paramMatch != null) {
          final paramName = paramMatch.group(1)!;
          completeReferralUrl = '${_baseUrl}?${paramName}=${userInput}';
        } else {
          completeReferralUrl = '${_baseUrl}${userInput}';
        }
      } else {
        // Path-based format
        completeReferralUrl = '${_baseUrl}${userInput}';
      }
      
      // Check if the referral URL is already in use
      final isUnique = await _checkReferralUrlUniqueness(completeReferralUrl, user.uid);
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

  /// Check if the referral URL is unique across all users
  Future<bool> _checkReferralUrlUniqueness(String referralUrl, String currentUserId) async {
    try {
      return await _firestoreService.checkReferralUrlUniqueness(referralUrl, currentUserId);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error checking referral URL uniqueness: $e');
      }
      // In case of error, assume it's not unique to be safe
      return false;
    }
  }

  /// Show dialog when referral URL is already in use
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
                      text: ' referral link you entered is already in use by another Team Build Pro member.',
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
                        'You must use a different referral URL to continue.',
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
            'Add Your\n$_bizOpp Link',
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
                  text: 'You are updating your Team Build Pro account to track referrals to ',
                ),
                TextSpan(
                  text: _bizOpp ?? 'this business opportunity',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const TextSpan(
                  text: '. This is a separate, independent business entity that is ',
                ),
                const TextSpan(
                  text: 'NOT owned, operated, or affiliated with Team Build Pro',
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
            'Your referral link will be stored in your Team Build Pro profile for tracking purposes only.',
          ),
          _buildBulletPoint(
            'Should your Team Build Pro community members decide to join $_bizOpp after you, they will automatically be placed in your $_bizOpp organization.',
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
                    'Team Build Pro is a referral tracking platform only. We do not endorse or guarantee any business opportunities.',
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
    if (_baseUrl == null) return const SizedBox.shrink();

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
                  'Set Up Your Referral Link',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.info, 0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.info.withOpacity(0.2)),
            ),
            child: Text(
              'We\'ll combine the base URL below with your unique identifier to create your complete referral link.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                height: 1.3,
              ),
            ),
          ),
          const SizedBox(height: 20),
          
          // Base URL Display
          Text(
            'Base URL',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1.5),
              color: AppColors.withOpacity(AppColors.textTertiary, 0.1),
            ),
            child: Row(
              children: [
                Icon(Icons.lock, color: AppColors.textTertiary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _baseUrl!,
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Unique identifier input field
          Text(
            'Your Unique Identifier',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.primary, 0.05),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withOpacity(0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'What to enter:',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '• Your username, ID, or referral code\n• Just the identifier part, not the full URL\n• Example: if your link is "herbalife.com/go/john123", enter "john123"',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1.5),
              color: AppColors.backgroundPrimary,
            ),
            child: TextFormField(
              controller: _refLinkController,
              keyboardType: TextInputType.text,
              style: TextStyle(fontSize: 16, color: AppColors.textPrimary),
              decoration: InputDecoration(
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(16),
                hintText: _getInputHint(),
                hintStyle: TextStyle(color: AppColors.textTertiary),
                prefixIcon: Icon(Icons.person, color: AppColors.primary),
              ),
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Please enter your unique identifier.';
                }
                if (value.contains('/') || value.contains('http') || value.contains('.') || value.contains('?')) {
                  return 'Enter only your identifier, not a full URL.';
                }
                if (!_validateIdentifierFormat(value)) {
                  return 'No spaces allowed in identifier.';
                }
                return null;
              },
            ),
          ),
          
          const SizedBox(height: 20),
          
          // Confirmation input field
          Text(
            'Confirm Your Unique Identifier',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border, width: 1.5),
              color: AppColors.backgroundPrimary,
            ),
            child: TextFormField(
              controller: _refLinkConfirmController,
              keyboardType: TextInputType.text,
              style: TextStyle(fontSize: 16, color: AppColors.textPrimary),
              decoration: InputDecoration(
                border: InputBorder.none,
                contentPadding: const EdgeInsets.all(16),
                hintText: 'Re-enter your username/ID',
                hintStyle: TextStyle(color: AppColors.textTertiary),
                prefixIcon: Icon(Icons.verified, color: AppColors.success),
              ),
              validator: (value) {
                if (value != _refLinkController.text) {
                  return 'Identifiers do not match';
                }
                return null;
              },
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Preview of complete URL
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
                    Icon(Icons.preview, color: AppColors.success, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Complete Referral Link Preview:',
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
                  _buildPreviewUrl(),
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
                    'Saving...',
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
