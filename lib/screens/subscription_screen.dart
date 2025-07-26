import 'package:flutter/material.dart';
import '../services/iap_service.dart';
import '../config/app_colors.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen> {
  bool isPurchasing = false;
  bool isLoading = true;
  Map<String, dynamic>? subscriptionStatus;
  final IAPService _iapService = IAPService();

  @override
  void initState() {
    super.initState();
    _loadSubscriptionStatus();
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
    setState(() => isPurchasing = true);
    
    await _iapService.purchaseMonthlySubscription(
      onSuccess: () async {
        if (!mounted) return;
        
        // Refresh subscription status after successful purchase
        await _loadSubscriptionStatus();
        
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
        if (!mounted) return;
        setState(() => isPurchasing = false);
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Subscription Failed'),
            content: const Text('Unable to process your subscription. Please check your payment method and try again.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
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
      appBar: AppBar(
        title: const Text('Subscription'),
        centerTitle: true,
        actions: [
          if (!isLoading && subscriptionStatus != null)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _loadSubscriptionStatus,
              tooltip: 'Refresh Status',
            ),
        ],
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
                  _buildFeatureItem('Submit your unique Business referral link'),
                  _buildFeatureItem('Unlock messaging to users on your team'),
                  _buildFeatureItem('Ensure network members join under YOU in your business'),
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
                                    ? 'Upgrade Now - \$4.95/month'
                                    : 'Subscribe - \$4.95/month',
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
