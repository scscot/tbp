import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../screens/subscription_screen_enhanced.dart';

Future<void> showSubscriptionRequiredModal(
  BuildContext context,
  String subscriptionStatus,
  String appId,
) async {
  return showDialog(
    context: context,
    barrierDismissible: false,
    builder: (context) => SubscriptionRequiredModal(
      subscriptionStatus: subscriptionStatus,
      appId: appId,
    ),
  );
}

class SubscriptionRequiredModal extends StatelessWidget {
  final String subscriptionStatus;
  final String appId;

  const SubscriptionRequiredModal({
    super.key,
    required this.subscriptionStatus,
    required this.appId,
  });

  @override
  Widget build(BuildContext context) {
    final isExpired = subscriptionStatus == 'expired';
    final isCancelled = subscriptionStatus == 'cancelled';
    final isPaused = subscriptionStatus == 'paused';
    final isOnHold = subscriptionStatus == 'on_hold';

    String title;
    String message;
    IconData icon;
    Color iconColor;

    if (isExpired) {
      title = 'Trial Expired';
      message =
          'Your 30-day free trial has expired. Subscribe now to continue using Team Build Pro and access all premium features!';
      icon = Icons.schedule_outlined;
      iconColor = Colors.red;
    } else if (isCancelled) {
      title = 'Subscription Cancelled';
      message =
          'Your subscription was cancelled. Renew now to restore access to premium features and continue building your team!';
      icon = Icons.cancel_outlined;
      iconColor = Colors.orange;
    } else if (isPaused) {
      title = 'Subscription Paused';
      message =
          'Your subscription is currently paused. Resume your subscription in the Play Store to restore access to all features.';
      icon = Icons.pause_circle_outlined;
      iconColor = Colors.amber;
    } else if (isOnHold) {
      title = 'Payment Issue';
      message =
          'Your subscription is on hold due to a payment issue. Please update your payment method in the Play Store to restore access.';
      icon = Icons.payment_outlined;
      iconColor = Colors.orange;
    } else {
      title = 'Subscription Required';
      message =
          'An active subscription is required to access this feature. Subscribe now to unlock all premium tools!';
      icon = Icons.lock_outlined;
      iconColor = AppColors.primary;
    }

    return PopScope(
      canPop: false,
      child: Dialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: 48,
                  color: iconColor,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                message,
                style: const TextStyle(
                  fontSize: 15,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) =>
                            SubscriptionScreenEnhanced(appId: appId),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 2,
                  ),
                  child: const Text(
                    'Subscribe Now',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: TextButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Go Back',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
