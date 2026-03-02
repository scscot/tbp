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

  // Messaging routes require professional status or paid subscription
  // These are NOT available to free prospects
  static const Set<String> _messagingRoutes = {
    'messages',
    'message_thread',
  };

  static Future<T?> pushGuarded<T>({
    required BuildContext context,
    required String routeName,
    required Widget screen,
    required String appId,
  }) async {
    final user = Provider.of<UserModel?>(context, listen: false);

    if (_protectedRoutes.contains(routeName)) {
      // Messaging features have stricter requirements
      if (_messagingRoutes.contains(routeName)) {
        if (!hasMessagingAccess(user)) {
          await showSubscriptionRequiredModal(
            context,
            user?.subscriptionStatus ?? 'expired',
            appId,
          );
          return null;
        }
      } else if (!hasValidSubscription(user)) {
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

  /// Check if user has FULL access to messaging features (can message anyone).
  /// Full messaging is only available to:
  /// - Professionals (userType == 'professional')
  /// - Users with active subscription
  /// - Users with lifetime access
  /// Free prospects have LIMITED messaging (see canMessageUser)
  static bool hasFullMessagingAccess(UserModel? user) {
    if (user == null) return false;

    // Lifetime access always grants full access
    if (user.lifetimeAccess == true) return true;

    // Professionals always have full messaging access
    if (user.userType == 'professional') return true;

    // Active subscribers have full messaging access
    if (user.subscriptionStatus == 'active') return true;

    // Prospects with valid trial have full messaging access
    if (user.subscriptionStatus == 'trial' && user.trialDaysRemaining > 0) return true;

    // Free prospects do NOT have full messaging access
    return false;
  }

  /// Check if user can message a specific target user.
  /// - Users with full messaging access can message anyone
  /// - Free prospects can ONLY message their direct sponsor or upline admin
  static bool canMessageUser(UserModel? user, String? targetUserId) {
    if (user == null || targetUserId == null || targetUserId.isEmpty) return false;

    // Users with full messaging access can message anyone
    if (hasFullMessagingAccess(user)) return true;

    // Free prospects can message their direct sponsor
    // Note: sponsorId is a Firebase UID; referredBy is a referral code (not a UID)
    if (user.sponsorId != null && user.sponsorId == targetUserId) return true;

    // Free prospects can message their upline admin
    if (user.uplineAdmin != null && user.uplineAdmin == targetUserId) return true;

    // Cannot message this user
    return false;
  }

  /// Check if user has any messaging access (full or limited).
  /// Returns true if user can access the messaging feature at all.
  static bool hasMessagingAccess(UserModel? user) {
    if (user == null) return false;

    // Users with full access
    if (hasFullMessagingAccess(user)) return true;

    // Free prospects have limited messaging access (sponsor + admin only)
    // They can access the Messages tab but will see filtered contacts
    if (hasValidSubscription(user)) return true;

    return false;
  }

  static bool hasValidSubscription(UserModel? user) {
    if (user == null) return false;

    if (user.lifetimeAccess == true) return true;

    final status = user.subscriptionStatus;

    if (status == 'active') return true;

    if (status == 'trial' && user.trialDaysRemaining > 0) return true;

    // --- PROSPECT FREE: Free until milestone is reached ---
    if (status == 'prospect_free') {
      // Prospects get free access until they hit 3+12 milestone
      if (!user.milestoneReached) return true;
      // Once milestone is reached, they need to subscribe
      return false;
    }

    return false;
  }
}
