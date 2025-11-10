// lib/screens/delete_account_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/user_model.dart';
import '../services/session_manager.dart';
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';
import '../config/app_colors.dart';
import '../main.dart';
import 'homepage_screen.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final FirebaseFunctions _functions = FirebaseFunctions.instanceFor(region: 'us-central1');
  bool _isDeleting = false;
  bool _confirmationChecked = false;
  bool _understandConsequences = false;
  bool _acknowledgeNetworkImpact = false;
  final TextEditingController _confirmationController = TextEditingController();
  String? _demoEmail;

  @override
  void initState() {
    super.initState();
    _loadRemoteConfig();
    _confirmationController.addListener(() {
      setState(() {});
    });
  }

  Future<void> _loadRemoteConfig() async {
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;

      final demoEmail = remoteConfig.getString('demo_account_email');
      if (mounted) {
        setState(() {
          _demoEmail = demoEmail.isNotEmpty ? demoEmail : null;
        });
      }

      await remoteConfig.fetchAndActivate();
      final updatedDemoEmail = remoteConfig.getString('demo_account_email');
      if (mounted && updatedDemoEmail != demoEmail) {
        setState(() {
          _demoEmail = updatedDemoEmail.isNotEmpty ? updatedDemoEmail : null;
        });
      }
    } catch (e) {
      debugPrint('❌ DELETE_ACCOUNT: Error loading Remote Config: $e');
    }
  }

  @override
  void dispose() {
    _confirmationController.dispose();
    super.dispose();
  }

  Future<void> _performAccountDeletion() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) return;

    if (_demoEmail != null && user.email?.toLowerCase() == _demoEmail?.toLowerCase()) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: Row(
              children: [
                Icon(Icons.info_outline, color: AppColors.info, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(context.l10n?.deleteAccountDemoTitle ?? 'Demo Account Protection', style: const TextStyle(fontSize: 18)),
                ),
              ],
            ),
            content: Text(
              context.l10n?.deleteAccountDemoMessage ?? 'This is a protected demo account and cannot be deleted.\n\nDemo accounts are maintained for app review and demonstration purposes.\n\nIf you are testing the app, please create a new account for testing account deletion features.',
              style: const TextStyle(fontSize: 14, height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(context.l10n?.deleteAccountDemoButton ?? 'OK'),
              ),
            ],
          ),
        );
      }
      return;
    }

    setState(() => _isDeleting = true);

    try {
      debugPrint('🗑️ DELETE_ACCOUNT: Starting cloud function account deletion...');
      
      // Call the cloud function to delete the account
      final callable = _functions.httpsCallable('deleteUserAccount');
      final result = await callable.call({
        'confirmationEmail': user.email,
      });
      
      debugPrint('✅ DELETE_ACCOUNT: Cloud function completed: ${result.data}');

      if (!mounted) return;
      
      // Force immediate Firebase sign out first (don't wait for server deletion)
      debugPrint('🗑️ DELETE_ACCOUNT: Starting immediate Firebase sign out...');
      await FirebaseAuth.instance.signOut();
      debugPrint('✅ DELETE_ACCOUNT: Firebase Auth sign out completed');
      
      // Clear ALL cached data (including biometric data)
      debugPrint('🗑️ DELETE_ACCOUNT: Clearing all session data...');
      await SessionManager.instance.clearAllData();
      debugPrint('✅ DELETE_ACCOUNT: All cached data cleared');
      
      // Give the auth state changes a moment to propagate
      await Future.delayed(const Duration(milliseconds: 500));

      if (!mounted) return;

      // Clear navigation stack and return to homepage
      while (navigatorKey.currentState?.canPop() == true) {
        navigatorKey.currentState?.pop();
      }
      
      // Navigate to homepage screen
      navigatorKey.currentState?.pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => HomepageScreen(appId: 'team-build-pro'),
        ),
        (route) => false,
      );

      // Show confirmation to user
      final currentContext = navigatorKey.currentContext;
      if (currentContext != null) {
        // ignore: use_build_context_synchronously
        ScaffoldMessenger.of(currentContext).showSnackBar(
          SnackBar(
            content: Text(context.l10n?.deleteAccountSuccessMessage ?? 'Account successfully deleted. Thank you for using Team Build Pro.'),
            backgroundColor: AppColors.success,
            duration: const Duration(seconds: 5),
          ),
        );
      }

    } catch (e) {
      debugPrint('❌ DELETE_ACCOUNT: Error during deletion: $e');
      
      setState(() => _isDeleting = false);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Account deletion failed: ${_getErrorMessage(e)}'),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  String _getErrorMessage(dynamic error) {
    if (error is FirebaseFunctionsException) {
      switch (error.code) {
        case 'invalid-argument':
          return 'The email address you entered does not match your account email. Please check and try again.';
        case 'not-found':
          return 'We could not find your account in our system. Please contact support for assistance.';
        case 'unauthenticated':
          return 'Your session has expired. Please sign out and sign in again, then retry account deletion.';
        case 'permission-denied':
          return 'You do not have permission to delete this account. Please contact support if you need assistance.';
        case 'internal':
          return 'An unexpected error occurred on our servers. Please try again in a few minutes or contact support.';
        case 'unavailable':
          return 'The service is temporarily unavailable. Please check your internet connection and try again.';
        default:
          return 'We encountered an issue processing your request. Please try again or contact support for help.';
      }
    }
    return 'An unexpected error occurred. Please try again or contact support@teambuildpro.com for assistance.';
  }

  Future<void> _launchSupportEmail() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    final userEmail = user?.email ?? 'Unknown';
    final userName = '${user?.firstName ?? ''} ${user?.lastName ?? ''}'.trim();
    
    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: 'support@teambuildpro.com',
      query: 'subject=Account Deletion Support Request&body=Hello Team Build Pro Support,%0A%0AI need assistance with my account deletion request.%0A%0AAccount Details:%0A- Name: $userName%0A- Email: $userEmail%0A%0APlease describe your issue or question below:%0A%0A',
    );

    try {
      if (await canLaunchUrl(emailUri)) {
        await launchUrl(emailUri);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Could not launch email app. Please contact support@teambuildpro.com manually.'),
              duration: Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not launch email app. Please contact support@teambuildpro.com manually.'),
            duration: Duration(seconds: 4),
          ),
        );
      }
    }
  }

  Widget _buildWarningSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.error, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning, color: AppColors.error, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  context.l10n?.deleteAccountWarningTitle ?? 'PERMANENT ACCOUNT DELETION',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.error,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n?.deleteAccountWarningMessage ?? 'This action cannot be undone. When you delete your account:',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _buildWarningItem(context.l10n?.deleteAccountWarning1 ?? 'Your personal data will be permanently deleted'),
          _buildWarningItem(context.l10n?.deleteAccountWarning2 ?? 'You will lose access to all premium features'),
          _buildWarningItem(context.l10n?.deleteAccountWarning3 ?? 'Your account cannot be recovered or reactivated'),
          _buildWarningItem(context.l10n?.deleteAccountWarning4 ?? 'Your network relationships will be preserved for business continuity'),
          _buildWarningItem(context.l10n?.deleteAccountWarning5 ?? 'You will be immediately signed out of all devices'),
        ],
      ),
    );
  }

  Widget _buildWarningItem(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6),
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.error,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmationChecks() {
    return Column(
      children: [
        CheckboxListTile(
          value: _confirmationChecked,
          onChanged: (value) {
            setState(() => _confirmationChecked = value ?? false);
          },
          title: Text(
            context.l10n?.deleteAccountCheckbox1 ?? 'I understand this action is permanent and cannot be undone',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          activeColor: AppColors.error,
          dense: true,
        ),
        CheckboxListTile(
          value: _understandConsequences,
          onChanged: (value) {
            setState(() => _understandConsequences = value ?? false);
          },
          title: Text(
            context.l10n?.deleteAccountCheckbox2 ?? 'I understand I will lose access to all data and premium features',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          activeColor: AppColors.error,
          dense: true,
        ),
        CheckboxListTile(
          value: _acknowledgeNetworkImpact,
          onChanged: (value) {
            setState(() => _acknowledgeNetworkImpact = value ?? false);
          },
          title: Text(
            context.l10n?.deleteAccountCheckbox3 ?? 'I acknowledge my network relationships will be preserved for business operations',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          activeColor: AppColors.error,
          dense: true,
        ),
      ],
    );
  }

  Widget _buildConfirmationInput(UserModel user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n?.deleteAccountConfirmLabel ?? 'To confirm deletion, please type your email address:',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          user.email ?? 'No email',
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _confirmationController,
          decoration: InputDecoration(
            hintText: context.l10n?.deleteAccountConfirmHint ?? 'Enter your email address',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.error, width: 2),
            ),
          ),
          style: const TextStyle(fontSize: 14),
        ),
      ],
    );
  }

  bool _canProceedWithDeletion(UserModel user) {
    if (user.email == null) return false;
    
    return _confirmationChecked &&
           _understandConsequences &&
           _acknowledgeNetworkImpact &&
           _confirmationController.text.trim().toLowerCase() == user.email!.toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);
    
    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.deleteAccountTitle ?? 'Delete Account'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Text(
              context.l10n?.deleteAccountHeading ?? 'Account Deletion',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              context.l10n?.deleteAccountSubheading ?? 'We\'re sorry to see you go. Please review the information below carefully.',
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),

            // Warning section
            _buildWarningSection(),
            const SizedBox(height: 24),

            // Account info
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.l10n?.deleteAccountInfoTitle ?? 'Account Information',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Name: ${user.firstName ?? ''} ${user.lastName ?? ''}'.trim(),
                    style: const TextStyle(fontSize: 14),
                  ),
                  Text(
                    'Email: ${user.email ?? 'No email'}',
                    style: const TextStyle(fontSize: 14),
                  ),
                  if (user.createdAt != null)
                    Text(
                      'Member Since: ${user.createdAt!.year}',
                      style: const TextStyle(fontSize: 14),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Confirmation checks
            Text(
              context.l10n?.deleteAccountConfirmTitle ?? 'Confirmation Required',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            _buildConfirmationChecks(),
            const SizedBox(height: 24),

            // Email confirmation
            _buildConfirmationInput(user),
            const SizedBox(height: 32),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isDeleting ? null : () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: Text(context.l10n?.deleteAccountButtonCancel ?? 'Cancel'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: (_canProceedWithDeletion(user) && !_isDeleting)
                        ? _performAccountDeletion
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isDeleting
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(context.l10n?.deleteAccountDeleting ?? 'Deleting...'),
                            ],
                          )
                        : Text(context.l10n?.deleteAccountButtonDelete ?? 'Delete Account'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Support contact
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.infoBackground,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  Icon(Icons.support_agent, color: AppColors.info, size: 24),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n?.deleteAccountHelpTitle ?? 'Need Help?',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n?.deleteAccountHelpMessage ?? 'If you\'re experiencing issues with the app, please contact our support team before deleting your account.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: _launchSupportEmail,
                    icon: const Icon(Icons.email, size: 16),
                    label: Text(context.l10n?.deleteAccountHelpButton ?? 'Contact Support'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.info,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
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