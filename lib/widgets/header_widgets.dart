// lib/widgets/header_widgets.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ultimatefix/screens/business_screen.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart';
import '../config/app_colors.dart';
import '../screens/dashboard_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/team_screen.dart';
import '../screens/share_screen.dart';
import '../screens/how_it_works_screen.dart';
import '../screens/message_center_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/privacy_policy_screen.dart';
import '../screens/terms_of_service_screen.dart';
import '../services/auth_service.dart';
import '../widgets/restart_widget.dart';
// --- MODIFICATION: Import main.dart for the navigatorKey, remove fcm_service import ---
import '../main.dart';

class AppHeaderWithMenu extends StatefulWidget implements PreferredSizeWidget {
  final String appId;
  final UserModel? user;

  const AppHeaderWithMenu({super.key, required this.appId, this.user});

  @override
  State<AppHeaderWithMenu> createState() => _AppHeaderWithMenuState();

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class _AppHeaderWithMenuState extends State<AppHeaderWithMenu> {
  void _handleMenuSelection(String value, bool isProfileComplete) async {
    if (value == 'logout') {
      await _showLogoutConfirmation();
      return;
    }

    if (!isProfileComplete && value != 'profile') {
      _showProfileIncompleteDialog();
      return;
    }

    final navigator = Navigator.of(context);
    switch (value) {
      case 'join':
        navigator.push(MaterialPageRoute(
            builder: (_) => BusinessScreen(appId: widget.appId)));
        break;
      case 'dashboard':
        navigator.push(MaterialPageRoute(
            builder: (_) => DashboardScreen(appId: widget.appId)));
        break;
      case 'how_it_works':
        navigator.push(MaterialPageRoute(
            builder: (_) => HowItWorksScreen(appId: widget.appId)));
        break;
      case 'team':
        navigator.push(MaterialPageRoute(
            builder: (_) => TeamScreen(appId: widget.appId)));
        break;
      case 'share':
        navigator.push(MaterialPageRoute(
            builder: (_) => ShareScreen(appId: widget.appId)));
        break;
      case 'messages':
        navigator.push(MaterialPageRoute(
            builder: (_) => MessageCenterScreen(appId: widget.appId)));
        break;
      case 'notifications':
        navigator.push(MaterialPageRoute(
            builder: (_) => NotificationsScreen(appId: widget.appId)));
        break;
      case 'profile':
        navigator.push(MaterialPageRoute(
            builder: (_) => ProfileScreen(appId: widget.appId)));
        break;
      case 'privacy':
        navigator.push(MaterialPageRoute(
            builder: (_) => PrivacyPolicyScreen(appId: widget.appId)));
        break;
      case 'terms':
        navigator.push(MaterialPageRoute(
            builder: (_) => TermsOfServiceScreen(appId: widget.appId)));
        break;
    }
  }

  Future<void> _showLogoutConfirmation() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Icon(
                Icons.logout,
                color: AppColors.error,
                size: 24,
              ),
              const SizedBox(width: 12),
              const Text(
                'Sign Out',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: const Text(
            'Are you sure you want to sign out of your account?',
            style: TextStyle(fontSize: 16),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: AppColors.textInverse,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Sign Out',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        );
      },
    );

    if (result == true) {
      final authService = context.read<AuthService>();
      final navigator = Navigator.of(context);

      if (navigator.canPop()) {
        navigator.popUntil((route) => route.isFirst);
      }

      await authService.signOut();

      final rootNavigatorContext = navigatorKey.currentContext;
      if (rootNavigatorContext != null && rootNavigatorContext.mounted) {
        RestartWidget.restartApp(rootNavigatorContext);
      }
    }
  }

  void _showProfileIncompleteDialog() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          title: Row(
            children: [
              Icon(
                Icons.account_circle_outlined,
                color: AppColors.warning,
                size: 24,
              ),
              const SizedBox(width: 12),
              const Text(
                'Complete Your Profile',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          content: const Text(
            'Please complete your profile by adding a photo to access all features.',
            style: TextStyle(fontSize: 16),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                'Later',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProfileScreen(appId: widget.appId),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.textInverse,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Complete Profile',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        );
      },
    );
  }


  bool _shouldShowBackButton(BuildContext context) {
    return Navigator.of(context).canPop();
  }

  Widget _buildMenuIcon() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.withOpacity(AppColors.textInverse, 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(
        Icons.menu,
        color: AppColors.textInverse,
        size: 20,
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(bool isProfileComplete) {
    final List<PopupMenuEntry<String>> items = [];

    if (isProfileComplete) {
      // Main navigation items
      items.addAll([
        _buildMenuItem(
          value: 'dashboard',
          icon: Icons.dashboard,
          title: 'Dashboard',
          color: AppColors.primary,
        ),
        _buildMenuItem(
          value: 'how_it_works',
          icon: Icons.help_outline,
          title: 'How It Works',
          color: AppColors.teamAccent,
        ),
        const PopupMenuDivider(),
        
        // Team & Growth section
        _buildMenuItem(
          value: 'share',
          icon: Icons.trending_up,
          title: 'Grow My Team',
          color: AppColors.growthPrimary,
        ),
        _buildMenuItem(
          value: 'team',
          icon: Icons.groups,
          title: 'View My Team',
          color: AppColors.teamPrimary,
        ),
        const PopupMenuDivider(),
        
        // Communication section
        _buildMenuItem(
          value: 'notifications',
          icon: Icons.notifications,
          title: 'Notifications',
          color: AppColors.notificationPrimary,
        ),
        _buildMenuItem(
          value: 'messages',
          icon: Icons.message,
          title: 'Message Center',
          color: AppColors.messagePrimary,
        ),
        const PopupMenuDivider(),
      ]);
    }

    // Profile and settings (always available)
    items.addAll([
      _buildMenuItem(
        value: 'profile',
        icon: isProfileComplete ? Icons.person : Icons.account_circle_outlined,
        title: isProfileComplete ? 'My Profile' : 'Complete Profile',
        color: isProfileComplete ? AppColors.primary : AppColors.warning,
      ),
    ]);

    if (isProfileComplete) {
      items.addAll([
        const PopupMenuDivider(),
        _buildMenuItem(
          value: 'privacy',
          icon: Icons.privacy_tip_outlined,
          title: 'Privacy Policy',
          color: AppColors.textSecondary,
        ),
        _buildMenuItem(
          value: 'terms',
          icon: Icons.description_outlined,
          title: 'Terms of Service',
          color: AppColors.textSecondary,
        ),
      ]);
    }

    // Logout (always available)
    items.addAll([
      const PopupMenuDivider(),
      _buildMenuItem(
        value: 'logout',
        icon: Icons.logout,
        title: 'Sign Out',
        color: AppColors.error,
      ),
    ]);

    return items;
  }

  PopupMenuItem<String> _buildMenuItem({
    required String value,
    required IconData icon,
    required String title,
    required Color color,
  }) {
    return PopupMenuItem<String>(
      value: value,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.withOpacity(color, 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                icon,
                color: color,
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final userFromProvider = Provider.of<UserModel?>(context);
    final currentUser = widget.user ?? userFromProvider;
    final adminSettings = Provider.of<AdminSettingsModel?>(context);

    bool isProfileComplete = false;
    if (currentUser != null &&
        currentUser.photoUrl != null &&
        currentUser.photoUrl!.isNotEmpty) {
      if (currentUser.role == 'admin') {
        if (adminSettings != null) {
          isProfileComplete = (adminSettings.bizOpp != null &&
                  adminSettings.bizOpp!.isNotEmpty) &&
              (adminSettings.bizOppRefUrl != null &&
                  adminSettings.bizOppRefUrl!.isNotEmpty);
        }
      } else {
        isProfileComplete = true;
      }
    }

    return AppBar(
      backgroundColor: Colors.transparent,
      automaticallyImplyLeading: false,
      elevation: 0,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
      ),
      leading: _shouldShowBackButton(context)
          ? Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.withOpacity(AppColors.textInverse, 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const BackButton(color: AppColors.textInverse),
            )
          : null,
      iconTheme: const IconThemeData(color: AppColors.textInverse),
      title: GestureDetector(
        onTap: () {
          if (isProfileComplete) {
            Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                    builder: (_) => DashboardScreen(appId: widget.appId)));
          }
        },
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Team Build Pro',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.textInverse,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
      centerTitle: true,
      actions: [
        if (currentUser != null)
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: PopupMenuButton<String>(
              onSelected: (value) =>
                  _handleMenuSelection(value, isProfileComplete),
              icon: _buildMenuIcon(),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 8,
              offset: const Offset(0, 8),
              itemBuilder: (BuildContext context) => _buildMenuItems(isProfileComplete),
            ),
          ),
      ],
    );
  }
}
