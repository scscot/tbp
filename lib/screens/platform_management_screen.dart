// lib/screens/platform_management_screen.dart

import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';
import '../services/session_manager.dart';
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';
import 'new_registration_screen.dart';

class PlatformManagementScreen extends StatefulWidget {
  final String appId;

  const PlatformManagementScreen({
    super.key,
    required this.appId,
  });

  @override
  State<PlatformManagementScreen> createState() =>
      _PlatformManagementScreenState();
}

class _PlatformManagementScreenState extends State<PlatformManagementScreen> {
  String? _bizOpp;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    // Use WidgetsBinding to ensure context is available
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadAdminData();
      }
    });
  }

  /// Fetches necessary data for the admin, like the current business opportunity name.

  Future<void> _loadAdminData() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null || user.role != 'admin') {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final adminSettingsDoc = await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(user.uid)
          .get();

      if (mounted && adminSettingsDoc.exists) {
        setState(() {
          _bizOpp = adminSettingsDoc.data()?['biz_opp'] as String?;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print("Error loading admin data: $e");
      }
      // Keep default _bizOpp value if there's an error
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  /// Shows a dialog with terms and conditions for creating a new admin account.
  Future<void> _createNewAdminAccount(UserModel currentUser) async {
    final bizOpp = _bizOpp ?? 'your current opportunity';

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        bool isChecked = false;

        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: Colors.orange, size: 28),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      context.l10n?.pmDialogTitle ?? 'Important Terms',
                      style:
                          const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: ListBody(
                  children: <Widget>[
                    Text(
                      context.l10n?.pmDialogIntro ?? 'You are creating a new, separate admin account. By proceeding, you understand and agree to the following:',
                    ),
                    const SizedBox(height: 16),
                    _buildTermPoint(
                        context.l10n?.pmTerm1 ?? 'This new account is completely separate and cannot be merged with your current account.'),
                    _buildTermPoint(
                        context.l10n?.pmTerm2(bizOpp) ?? 'Your existing "$bizOpp" team is non-transferable.'),
                    _buildTermPoint(
                        context.l10n?.pmTerm3 ?? 'This account must be used for a new, different business opportunity.'),
                    _buildTermPoint(
                      context.l10n?.pmTerm4 ?? 'Cross-promoting or recruiting members between your separate accounts is strictly prohibited.',
                    ),
                    _buildTermPoint(
                        context.l10n?.pmTerm5 ?? 'Violation of these terms may result in the suspension or cancellation of ALL your associated accounts.'),
                    const SizedBox(height: 16),
                    CheckboxListTile(
                      title: Text(
                        context.l10n?.pmAgreeTerms ?? "I understand and agree to these terms",
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      value: isChecked,
                      onChanged: (bool? value) {
                        setState(() {
                          isChecked = value ?? false;
                        });
                      },
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(context.l10n?.pmCancel ?? 'Cancel'),
                ),
                ElevatedButton(
                  onPressed:
                      isChecked ? () => Navigator.of(context).pop(true) : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    disabledBackgroundColor: Colors.grey.shade400,
                  ),
                  child: Text(context.l10n?.pmContinue ?? 'Continue',
                      style: const TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );

    if (result == true && mounted) {
      final authService = AuthService();
      final navigator = Navigator.of(context);

      if (navigator.canPop()) {
        navigator.popUntil((route) => route.isFirst);
      }

      await SessionManager.instance.clearAllData();
      await SessionManager.instance.clearReferralData();
      await authService.signOut();

      if (mounted) {
        navigator.pushReplacement(
          MaterialPageRoute(
            builder: (context) => NewRegistrationScreen(
              referralCode: null,
              appId: widget.appId,
            ),
          ),
        );
      }
    }
  }

  /// Helper widget for formatting the terms in the dialog.
  Widget _buildTermPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: TextStyle(fontWeight: FontWeight.bold)),
          Expanded(
            child:
                Text(text, style: const TextStyle(fontSize: 14, height: 1.4)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<UserModel?>(context);

    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.pmTitle ?? 'Create Account'),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // "Manage a New Opportunity" Card
                      Card(
                        elevation: 2,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                context.l10n?.pmCardTitle ?? 'Manage Another Opportunity',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                context.l10n?.pmCardDesc ?? 'Create a separate account to manage and grow a different opportunity.',
                                style: const TextStyle(color: Colors.black54),
                              ),
                              const SizedBox(height: 16),
                              Center(
                                child: ElevatedButton.icon(
                                  onPressed: currentUser != null ? () =>
                                      _createNewAdminAccount(currentUser) : null,
                                  icon: const Icon(Icons.person_add),
                                  label: Text(context.l10n?.pmCreateButton ?? 'Create New Account'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blue,
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // Add other admin tool cards here in the future
                    ],
                  ),
                ),
    );
  }
}
