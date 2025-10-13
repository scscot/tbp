import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../widgets/subscription_required_modal.dart';

class SubscriptionNavigationGuard {
  static const Set<String> _protectedRoutes = {
    'network',
    'share',
    'messages',
    'message_thread',
    'chatbot',
    'business',
    'company',
    'eligibility',
    'platform_management',
    'add_link',
    'member_detail',
  };

  static Future<T?> pushGuarded<T>({
    required BuildContext context,
    required String routeName,
    required Widget screen,
    required String appId,
  }) async {
    final user = Provider.of<UserModel?>(context, listen: false);

    if (_protectedRoutes.contains(routeName)) {
      if (!hasValidSubscription(user)) {
        await showSubscriptionRequiredModal(
          context,
          user?.subscriptionStatus ?? 'expired',
          appId,
        );
        return null;
      }
    }

    return Navigator.push<T>(
      context,
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  static bool hasValidSubscription(UserModel? user) {
    if (user == null) return false;

    if (user.lifetimeAccess == true) return true;

    final status = user.subscriptionStatus;

    if (status == 'active') return true;

    if (status == 'trial' && user.trialDaysRemaining > 0) return true;

    return false;
  }
}
