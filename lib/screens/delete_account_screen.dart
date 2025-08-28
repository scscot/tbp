// lib/screens/delete_account_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_model.dart';
import '../services/session_manager.dart';
import '../widgets/header_widgets.dart';
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

  @override
  void initState() {
    super.initState();
    // Listen to text field changes to update button state
    _confirmationController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _confirmationController.dispose();
    super.dispose();
  }

  Future<void> _performAccountDeletion() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) return;

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
      final messenger = ScaffoldMessenger.of(navigatorKey.currentContext!);
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Account successfully deleted. Thank you for using Team Build Pro.'),
          backgroundColor: AppColors.success,
          duration: Duration(seconds: 5),
        ),
      );

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
          return 'Email confirmation does not match your account email.';
        case 'not-found':
          return 'Account not found.';
        case 'unauthenticated':
          return 'Please sign in again to delete your account.';
        default:
          return 'Account deletion failed. Please try again.';
      }
    }
    return 'Account deletion failed. Please try again.';
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
              const Expanded(
                child: Text(
                  'PERMANENT ACCOUNT DELETION',
                  style: TextStyle(
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
          const Text(
            'This action cannot be undone. When you delete your account:',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _buildWarningItem('Your personal data will be permanently deleted'),
          _buildWarningItem('You will lose access to all premium features'),
          _buildWarningItem('Your account cannot be recovered or reactivated'),
          _buildWarningItem('Your network relationships will be preserved for business continuity'),
          _buildWarningItem('You will be immediately signed out of all devices'),
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
          title: const Text(
            'I understand this action is permanent and cannot be undone',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          activeColor: AppColors.error,
          dense: true,
        ),
        CheckboxListTile(
          value: _understandConsequences,
          onChanged: (value) {
            setState(() => _understandConsequences = value ?? false);
          },
          title: const Text(
            'I understand I will lose access to all data and premium features',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
          ),
          activeColor: AppColors.error,
          dense: true,
        ),
        CheckboxListTile(
          value: _acknowledgeNetworkImpact,
          onChanged: (value) {
            setState(() => _acknowledgeNetworkImpact = value ?? false);
          },
          title: const Text(
            'I acknowledge my network relationships will be preserved for business operations',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
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
        const Text(
          'To confirm deletion, please type your email address:',
          style: TextStyle(
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
            hintText: 'Enter your email address',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.error, width: 2),
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
      appBar: const AppScreenBar(title: 'Delete Account'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            const Text(
              'Account Deletion',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'We\'re sorry to see you go. Please review the information below carefully.',
              style: TextStyle(
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
                  const Text(
                    'Account Information',
                    style: TextStyle(
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
            const Text(
              'Confirmation Required',
              style: TextStyle(
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
                    child: const Text('Cancel'),
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
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              ),
                              SizedBox(width: 8),
                              Text('Deleting...'),
                            ],
                          )
                        : const Text('Delete Account'),
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
                  const Text(
                    'Need Help?',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'If you\'re experiencing issues with the app, please contact our support team before deleting your account.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      // Navigate to contact or support screen
                      Navigator.pushNamed(context, '/contact');
                    },
                    icon: const Icon(Icons.email, size: 16),
                    label: const Text('Contact Support'),
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