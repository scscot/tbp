import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:io';
import '../services/iap_service.dart';
import '../services/admin_settings_service.dart';
import '../config/app_colors.dart';
import '../models/user_model.dart';
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';
import '../screens/terms_of_service_screen.dart';
import '../screens/privacy_policy_screen.dart';

class SubscriptionScreen extends StatefulWidget {
  final String? appId;
  
  const SubscriptionScreen({super.key, this.appId});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  bool isPurchasing = false;
  bool isLoading = true;
  Map<String, dynamic>? subscriptionStatus;
  String? _bizOpp; // --- 1. State variable for biz_opp added ---
  final IAPService _iapService = IAPService();
  final AdminSettingsService _adminSettingsService = AdminSettingsService();

  @override
  void initState() {
    super.initState();
    debugPrint('🔄 SUBSCRIPTION_SCREEN: initState called');
    _initializeIAP();
    _loadSubscriptionStatus();
    _loadBizOppData(); // --- 2. Call to fetch biz_opp data added ---
  }

  // Initialize IAP service
  Future<void> _initializeIAP() async {
    try {
      debugPrint('🔄 SUBSCRIPTION_SCREEN: Initializing IAP service');
      await _iapService.init();
      debugPrint('✅ SUBSCRIPTION_SCREEN: IAP service initialized successfully');
      debugPrint('🔍 SUBSCRIPTION_SCREEN: IAP available: ${_iapService.available}');
      debugPrint('🔍 SUBSCRIPTION_SCREEN: Products loaded: ${_iapService.products.length}');
      if (_iapService.products.isNotEmpty) {
        for (var product in _iapService.products) {
          debugPrint('🔍 SUBSCRIPTION_SCREEN: Product: ${product.id} - ${product.title} - ${product.price}');
        }
      }
    } catch (e) {
      debugPrint('❌ SUBSCRIPTION_SCREEN: IAP service initialization failed: $e');
    }
  }

  // --- 3. Load biz_opp data using shared service ---
  Future<void> _loadBizOppData() async {
    if (!mounted) return;

    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) return;

    try {
      // Determine admin UID based on user role
      final adminUid = user.role == 'admin' ? user.uid : user.uplineAdmin;

      if (adminUid == null || adminUid.isEmpty) {
        return;
      }

      // Use shared service for streamlined admin settings access
      final bizOpp = await _adminSettingsService.getBizOppName(
        adminUid,
        fallback: 'your opportunity'
      );

      if (mounted) {
        setState(() {
          _bizOpp = bizOpp;
        });
      }
    } catch (e) {
      debugPrint("Error loading biz_opp data: $e");
      // Errors are handled silently to avoid disrupting the UI
    }
  }

  Future<void> _loadSubscriptionStatus() async {
    try {
      final status = await _iapService.checkSubscriptionStatus();
      if (mounted) {
        setState(() {
          subscriptionStatus = status;
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isLoading = false;
        });
      }
    }
  }

  Future<void> _handleUpgrade() async {
    debugPrint('🔄 SUBSCRIPTION_SCREEN: Starting upgrade process');
    setState(() => isPurchasing = true);

    debugPrint('🔍 SUBSCRIPTION_SCREEN: IAP Service Status - Available: ${_iapService.available}, Products: ${_iapService.products.length}');
    
    await _iapService.purchaseMonthlySubscription(
      onSuccess: () async {
        if (!mounted) return;
        await _loadSubscriptionStatus(); // pulls latest from Functions/Firestore

        final isActive = subscriptionStatus?['isActive'] == true;
        setState(() => isPurchasing = false);

        if (mounted && isActive) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.l10n?.subscriptionActivatedSuccess ?? '✅ Subscription activated successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pop(context, 'subscription_updated');
        } else {
          // Treat as failure if server says not active yet
          if (mounted) {
            showDialog(
              context: context,
              builder: (_) => AlertDialog(
                title: Text(context.l10n?.subscriptionNotActiveTitle ?? 'Subscription Not Active'),
                content: Text(context.l10n?.subscriptionNotActiveMessage ?? 'Purchase started but not active yet. Try again.'),
              ),
            );
          }
        }
      },
      onFailure: () {
        if (!mounted) return;
        setState(() => isPurchasing = false);
        showDialog(
          context: context,
          builder: (dialogContext) {
            final message = Platform.isIOS
              ? context.l10n?.subscriptionNotAvailableMessageIOS
              : (Platform.isAndroid
                ? context.l10n?.subscriptionNotAvailableMessageAndroid
                : context.l10n?.subscriptionNotAvailableMessageDefault);
            return AlertDialog(
              title: Text(context.l10n?.subscriptionNotAvailableTitle ?? 'Subscription Not Available'),
              content: Text(message ?? 'In-app purchases are currently unavailable. Please try again later.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: Text(context.l10n?.subscriptionOkButton ?? 'OK'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _handleRestorePurchases() async {
    setState(() => isPurchasing = true);

    await _iapService.restorePurchases(
      onSuccess: () async {
        if (!mounted) return;

        // Refresh subscription status after restore
        await _loadSubscriptionStatus();

        setState(() => isPurchasing = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(context.l10n?.subscriptionRestoredSuccess ?? '✅ Subscription restored successfully!'),
              backgroundColor: Colors.green,
            ),
          );

          // Safe dashboard update - pop with result to trigger refresh
          Navigator.pop(context, 'subscription_updated');
        }
      },
      onFailure: () {
        if (!mounted) return;
        setState(() => isPurchasing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n?.subscriptionNoPreviousFound ?? 'No previous subscription found to restore.'),
            backgroundColor: Colors.orange,
          ),
        );
      },
    );
  }

  Widget _buildSubscriptionStatusCard() {
    if (subscriptionStatus == null) return const SizedBox.shrink();

    final status = subscriptionStatus!['subscriptionStatus'] as String;
    final isActive = subscriptionStatus!['isActive'] as bool;
    final isTrialValid = subscriptionStatus!['isTrialValid'] as bool;
    final trialDaysRemaining = subscriptionStatus!['trialDaysRemaining'] as int;
    final isInGracePeriod = subscriptionStatus!['isInGracePeriod'] as bool;

    Color cardColor;
    String statusText;
    String subtitle;
    IconData icon;

    if (isActive && status == 'active') {
      cardColor = Colors.green.shade50;
      statusText = context.l10n?.subscriptionStatusActive ?? 'Active Subscription';
      subtitle = context.l10n?.subscriptionStatusActiveSubtitle ?? 'You have full access to all premium features';
      icon = Icons.check_circle;
    } else if (isTrialValid) {
      cardColor = Colors.blue.shade50;
      statusText = context.l10n?.subscriptionStatusTrialActive ?? 'Free Trial Active';
      subtitle = context.l10n?.subscriptionStatusTrialDaysRemaining(trialDaysRemaining) ?? '$trialDaysRemaining days remaining in your trial';
      icon = Icons.schedule;
    } else if (isInGracePeriod) {
      cardColor = Colors.orange.shade50;
      statusText = context.l10n?.subscriptionStatusCancelled ?? 'Subscription Cancelled';
      subtitle = context.l10n?.subscriptionStatusCancelledSubtitle ?? 'Access continues until expiry date';
      icon = Icons.warning;
    } else {
      cardColor = Colors.red.shade50;
      statusText = context.l10n?.subscriptionStatusExpired ?? 'Subscription Expired';
      subtitle = context.l10n?.subscriptionStatusExpiredSubtitle ?? 'Upgrade to restore premium features';
      icon = Icons.error;
    }

    return Card(
      color: cardColor,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Icon(icon, size: 32, color: _getStatusColor(status, isActive)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    statusText,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade600,
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

  Color _getStatusColor(String status, bool isActive) {
    if (isActive && status == 'active') return Colors.green;
    if (status == 'trial') return Colors.blue;
    if (status == 'cancelled') return Colors.orange;
    return Colors.red;
  }

  bool _shouldShowUpgradeButton() {
    if (subscriptionStatus == null) return true;

    final isActive = subscriptionStatus!['isActive'] as bool;
    final status = subscriptionStatus!['subscriptionStatus'] as String;

    // Show upgrade button if not active or if trial/expired
    return !isActive || status == 'trial' || status == 'expired';
  }

  // Platform-specific helper methods
  String get _platformSubscriptionManagementText {
    if (Platform.isIOS) {
      return context.l10n?.subscriptionManageIOS ?? 'You can manage your subscription in your Apple ID account settings.';
    } else if (Platform.isAndroid) {
      return context.l10n?.subscriptionManageAndroid ?? 'You can manage your subscription in the Google Play Store.';
    } else {
      return context.l10n?.subscriptionManageDefault ?? 'You can manage your subscription in your device\'s app store.';
    }
  }

  String get _platformSubscriptionText {
    return context.l10n?.subscriptionSubscribeButton ?? 'Subscribe Now - \$4.99/month';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppScreenBar(
        title: context.l10n?.subscriptionAppBarTitle ?? 'Team Build Pro',
        appId: widget.appId ?? 'subscription', // Use passed appId or fallback
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Subscription Status Card
                  _buildSubscriptionStatusCard(),
                  const SizedBox(height: 24),

                  // Features Section
                  Text(
                    context.l10n?.subscriptionPremiumHeader ?? 'Premium Features:',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildFeatureItem(
                      context.l10n?.subscriptionFeature1(_bizOpp ?? (context.l10n?.subscriptionDefaultBizOpp ?? 'your opportunity')) ?? 'Submit your unique ${_bizOpp ?? 'business opportunity'} referral link'),
                  _buildFeatureItem(context.l10n?.subscriptionFeature2 ?? 'Custom AI Coaching for recruiting and team building'),
                  _buildFeatureItem(context.l10n?.subscriptionFeature3 ?? 'Unlock messaging to users on your team'),
                  _buildFeatureItem(
                      context.l10n?.subscriptionFeature4(_bizOpp ?? (context.l10n?.subscriptionDefaultBizOpp ?? 'your opportunity')) ?? 'Ensure team members join under YOU in ${_bizOpp ?? 'your business opportunity'}'),
                  _buildFeatureItem(context.l10n?.subscriptionFeature5 ?? 'Advanced analytics and insights'),

                  const SizedBox(height: 32),

                  // Action Buttons
                  if (_shouldShowUpgradeButton()) ...[
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isPurchasing ? null : _handleUpgrade,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white, // Add this line
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        child: isPurchasing
                            ? const CircularProgressIndicator(
                                color: Colors.white)
                            : Text(
                                subscriptionStatus?['subscriptionStatus'] ==
                                        'trial'
                                    ? (context.l10n?.subscriptionSubscribeButton ?? 'Subscribe Now - \$4.99/month')
                                    : _platformSubscriptionText,
                                style: const TextStyle(
                                  fontSize: 16,
                                  color:
                                      Colors.white, // Add this line as backup
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Restore Subscription Button
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: isPurchasing ? null : _handleRestorePurchases,
                      child: Text(context.l10n?.subscriptionRestoreButton ?? 'Restore Previous Subscription'),
                    ),
                  ),

                  // Legal Notice with Links
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      children: [
                        Text(
                          context.l10n?.subscriptionLegalNotice ?? 'By subscribing, you agree to our Terms of Service and Privacy Policy.',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade700,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            TextButton(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => TermsOfServiceScreen(
                                      appId: widget.appId ?? '',
                                    ),
                                  ),
                                );
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.blue.shade600,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              ),
                              child: Text(
                                context.l10n?.subscriptionTermsLink ?? 'Terms of Service',
                                style: const TextStyle(
                                  fontSize: 12,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                            Text(
                              context.l10n?.subscriptionSeparator ?? ' | ',
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                            ),
                            TextButton(
                              onPressed: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => PrivacyPolicyScreen(
                                      appId: widget.appId ?? '',
                                    ),
                                  ),
                                );
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.blue.shade600,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              ),
                              child: Text(
                                context.l10n?.subscriptionPrivacyLink ?? 'Privacy Policy',
                                style: const TextStyle(
                                  fontSize: 12,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          context.l10n?.subscriptionAutoRenewNotice(_platformSubscriptionManagementText) ?? 'Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. $_platformSubscriptionManagementText',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade600,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildFeatureItem(String feature) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            Icons.check_circle,
            color: AppColors.primary,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              feature,
              style: const TextStyle(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}
