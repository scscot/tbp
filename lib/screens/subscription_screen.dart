import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/iap_service.dart';
import '../services/auth_service.dart';
import '../config/app_colors.dart';
import '../models/user_model.dart';
import '../widgets/header_widgets.dart';

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
  
  // Debug info for TestFlight diagnosis
  String _debugInfo = "Debug info will appear here...";
  final List<String> _debugLogs = [];

  @override
  void initState() {
    super.initState();
    _addDebugLog('🔄 SUBSCRIPTION_SCREEN: initState called');
    _addDebugLog('📱 Starting IAP initialization...');
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

  // --- 3. New function to load biz_opp data, similar to dashboard_screen.dart ---
  Future<void> _loadBizOppData() async {
    // This check ensures context is available before using Provider
    if (!mounted) return;

    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) return;

    final adminUid = user.uplineAdmin;
    if (adminUid == null || adminUid.isEmpty) {
      return;
    }

    try {
      final adminSettingsDoc = await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(adminUid)
          .get();

      if (adminSettingsDoc.exists && mounted) {
        final adminData = adminSettingsDoc.data();
        final retrievedBizOpp = adminData?['biz_opp'] as String?;

        setState(() {
          _bizOpp = retrievedBizOpp;
        });
      }
    } catch (e) {
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

  void _addDebugLog(String message) {
    setState(() {
      _debugLogs.add('${DateTime.now().toString().substring(11, 19)}: $message');
      if (_debugLogs.length > 10) _debugLogs.removeAt(0); // Keep only last 10
      _debugInfo = _debugLogs.join('\n');
    });
    debugPrint(message);
  }

  Future<void> _handleUpgrade() async {
    _addDebugLog('🔄 UPGRADE: Button clicked - starting upgrade process');
    setState(() => isPurchasing = true);

    _addDebugLog('🔍 IAP Status: Available=${_iapService.available}, Products=${_iapService.products.length}');
    
    await _iapService.purchaseMonthlySubscription(
      onSuccess: () async {
        _addDebugLog('🎉 SUCCESS CALLBACK: Called at ${DateTime.now()}');
        if (!mounted) return;

        // Refresh subscription status after successful purchase
        await _loadSubscriptionStatus();

        // Trigger user data refresh to update subscription status across the app
        try {
          if (mounted) {
            final authService = Provider.of<AuthService>(context, listen: false);
            await authService.checkSubscriptionOnAppResume();
            _addDebugLog('✅ User data refreshed after successful purchase');
          }
        } catch (e) {
          _addDebugLog('❌ Error refreshing user data: $e');
        }

        setState(() => isPurchasing = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Subscription activated successfully!'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pop(context);
        }
      },
      onFailure: () {
        _addDebugLog('❌ FAILURE CALLBACK: Called at ${DateTime.now()}');
        if (!mounted) return;
        setState(() => isPurchasing = false);
        showDialog(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Subscription Not Available'),
            content: const Text(
                'In-app purchases are not available at the moment. This may be due to:\n\n• App Store configuration\n• Network connectivity\n• Device restrictions\n\nPlease try again later or contact support.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('OK'),
              ),
            ],
          ),
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

        // Trigger user data refresh to update subscription status across the app
        try {
          if (mounted) {
            final authService = Provider.of<AuthService>(context, listen: false);
            await authService.checkSubscriptionOnAppResume();
            debugPrint('✅ SUBSCRIPTION_SCREEN: User data refreshed after restore');
          }
        } catch (e) {
          debugPrint('❌ SUBSCRIPTION_SCREEN: Error refreshing user data after restore: $e');
        }

        setState(() => isPurchasing = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✅ Subscription restored successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      },
      onFailure: () {
        if (!mounted) return;
        setState(() => isPurchasing = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No previous subscription found to restore.'),
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
      statusText = 'Active Subscription';
      subtitle = 'You have full access to all premium features';
      icon = Icons.check_circle;
    } else if (isTrialValid) {
      cardColor = Colors.blue.shade50;
      statusText = 'Free Trial Active';
      subtitle = '$trialDaysRemaining days remaining in your trial';
      icon = Icons.schedule;
    } else if (isInGracePeriod) {
      cardColor = Colors.orange.shade50;
      statusText = 'Subscription Cancelled';
      subtitle = 'Access continues until expiry date';
      icon = Icons.warning;
    } else {
      cardColor = Colors.red.shade50;
      statusText = 'Subscription Expired';
      subtitle = 'Upgrade to restore premium features';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppScreenBar(
        title: 'Team Build Pro',
        appId: widget.appId ?? 'subscription', // Use passed appId or fallback
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Subscription Status Card
                  _buildSubscriptionStatusCard(),
                  const SizedBox(height: 24),

                  // Features Section
                  const Text(
                    'Premium Features:',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  _buildFeatureItem(
                      'Submit your unique $_bizOpp referral link'),
                  _buildFeatureItem('Unlock messaging to users on your team'),
                  _buildFeatureItem(
                      'Ensure team members join under YOU in $_bizOpp'),
                  _buildFeatureItem('Priority customer support'),
                  _buildFeatureItem('Advanced analytics and insights'),

                  const Spacer(),

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
                                    ? 'Upgrade Now - \$4.99/month'
                                    : 'Subscribe - \$4.99/month',
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

                  // Restore Purchases Button
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: isPurchasing ? null : _handleRestorePurchases,
                      child: const Text('Restore Previous Purchases'),
                    ),
                  ),

                  // Debug Info Display for TestFlight - ALWAYS VISIBLE
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade300, width: 2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '🔧 TESTFLIGHT DEBUG (ALWAYS VISIBLE):',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.red.shade700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          height: 150,
                          child: SingleChildScrollView(
                            child: Text(
                              _debugLogs.isEmpty ? 'No debug logs yet - this is the problem!' : _debugInfo,
                              style: TextStyle(
                                fontSize: 11,
                                fontFamily: 'Courier',
                                color: Colors.red.shade600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Text(
                              'Debug logs: ${_debugLogs.length} entries',
                              style: TextStyle(
                                fontSize: 10,
                                color: Colors.red.shade500,
                              ),
                            ),
                            const Spacer(),
                            ElevatedButton(
                              onPressed: () => _addDebugLog('🧪 TEST: Debug button clicked'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red.shade600,
                                foregroundColor: Colors.white,
                                minimumSize: const Size(80, 30),
                              ),
                              child: const Text('TEST', style: TextStyle(fontSize: 10)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Terms and Privacy
                  const SizedBox(height: 16),
                  Text(
                    'Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. You can manage your subscription in your Apple ID account settings.',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                    textAlign: TextAlign.center,
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
