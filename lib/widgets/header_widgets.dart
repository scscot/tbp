import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ultimatefix/screens/add_link_screen.dart';
import 'package:ultimatefix/screens/business_screen.dart';
import 'package:ultimatefix/screens/company_screen.dart';
import 'package:ultimatefix/screens/eligibility_screen.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart';
import '../config/app_colors.dart';
import '../screens/profile_screen.dart';
import '../screens/network_screen.dart';
import '../screens/share_screen.dart';
import '../screens/how_it_works_screen.dart';
import '../screens/message_center_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/privacy_policy_screen.dart';
import '../screens/terms_of_service_screen.dart';
import '../screens/platform_management_screen.dart';
import '../services/auth_service.dart';
import '../widgets/restart_widget.dart';
import '../main.dart';
import 'navigation_shell.dart';
import '../services/navigation_service.dart';
import 'package:flutter/services.dart';

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
      case 'company':
        navigator.push(MaterialPageRoute(
            builder: (_) => CompanyScreen(appId: widget.appId)));
        break;
      case 'business':
        navigator.push(MaterialPageRoute(
            builder: (_) => BusinessScreen(appId: widget.appId)));
        break;
      case 'eligibility':
        navigator.push(MaterialPageRoute(
            builder: (_) => EligibilityScreen(appId: widget.appId)));
        break;
      case 'dashboard':
        navigator.push(MaterialPageRoute(
            builder: (_) => NavigationShell(appId: widget.appId)));
        break;
      case 'how_it_works':
        navigator.push(MaterialPageRoute(
            builder: (_) => HowItWorksScreen(appId: widget.appId)));
        break;
      case 'team':
        navigator.push(MaterialPageRoute(
            builder: (_) => NetworkScreen(appId: widget.appId)));
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
      case 'platform_management':
        navigator.push(MaterialPageRoute(
            builder: (_) => PlatformManagementScreen(appId: widget.appId)));
        break;
      case 'privacy':
        navigator.push(MaterialPageRoute(
            builder: (_) => PrivacyPolicyScreen(appId: widget.appId)));
        break;
      case 'terms':
        navigator.push(MaterialPageRoute(
            builder: (_) => TermsOfServiceScreen(appId: widget.appId)));
        break;
      case 'business_details':
        navigator.push(MaterialPageRoute(
            builder: (_) => CompanyScreen(appId: widget.appId)));
        break;
      case 'get_started':
        final user = Provider.of<UserModel?>(context, listen: false);
        if (user != null) {
          // Check if user has visited business opportunity but hasn't added referral link
          if (user.bizVisitDate != null && user.bizOppRefUrl == null) {
            // Show follow-up modal
            _showBizOppFollowUpModal(user);
          } else {
            // User is qualified but hasn't visited - show business screen
            navigator.push(MaterialPageRoute(
                builder: (_) => BusinessScreen(appId: widget.appId)));
          }
        }
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

    if (result == true && mounted) {
      final authService = context.read<AuthService>();
      final navigator = Navigator.of(context);

      if (navigator.canPop()) {
        navigator.popUntil((route) => route.isFirst);
      }

      await authService.signOut();

      // Use mounted check before accessing context after await
      if (!mounted) return;

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

  void _showBizOppFollowUpModal(UserModel user) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: AppColors.warningGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.assignment_return,
                size: 32,
                color: AppColors.textInverse,
              ),
              const SizedBox(height: 16),
              Text(
                'Automatically grow your ${user.bizOpp ?? 'business opportunity'} network.',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textInverse,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Once you\'ve registered with ${user.bizOpp ?? 'your business opportunity'}, add your referral link to your Team Build Pro profile. This ensures anyone from your team who joins is placed in your network.',
                style: TextStyle(
                  fontSize: 16,
                  color: AppColors.textInverse.withValues(alpha: 0.9),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(dialogContext);
                        // Navigate to add link screen
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AddLinkScreen(appId: widget.appId),
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.textInverse,
                        foregroundColor: AppColors.warning,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Column(
                        children: [
                          Text(
                            "I've completed registration",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            "Add my referral link now",
                            style: TextStyle(
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: Text(
                      'Close - I haven\'t joined ${user.bizOpp ?? 'yet'}',
                      style: TextStyle(
                        color: AppColors.textInverse,
                        fontSize: 14,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _shouldShowBackButton(BuildContext context) {
    return Navigator.of(context).canPop();
  }

  Widget _buildMenuIcon() {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: AppColors.textInverse.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(
        Icons.menu,
        color: AppColors.textInverse,
        size: 20,
      ),
    );
  }

  List<PopupMenuEntry<String>> _buildMenuItems(
      bool isProfileComplete, UserModel? currentUser) {
    final List<PopupMenuEntry<String>> items = [];

    if (isProfileComplete) {
      // Main navigation items
      items.addAll([
        _buildMenuItem(
          value: 'how_it_works',
          icon: Icons.help_outline,
          title: 'How It Works',
          color: AppColors.teamAccent,
        ),
        _buildBusinessOpportunityMenuItem(currentUser),
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

    // Platform Management (admin only)
    if (currentUser?.role == 'admin') {
      items.add(
        _buildMenuItem(
          value: 'platform_management',
          icon: Icons.settings,
          title: 'Platform Management',
          color: AppColors.primary,
        ),
      );
    }

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
                color: color.withValues(alpha: 0.1),
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

  PopupMenuItem<String> _buildBusinessOpportunityMenuItem(UserModel? user) {
    if (user == null) {
      return _buildMenuItem(
        value: 'eligibility',
        icon: Icons.assessment,
        title: 'Eligibility Status',
        color: AppColors.opportunityPrimary,
      );
    }

    // Determine the menu item based on user qualification status
    if (user.role == 'user' && user.qualifiedDate != null) {
      // QUALIFIED: Show business details or get started
      if (user.bizOppRefUrl != null) {
        // User has already joined - show business details
        return _buildMenuItem(
          value: 'business_details',
          icon: Icons.details,
          title: 'My Business Details',
          color: AppColors.opportunityPrimary,
        );
      } else {
        // User is qualified but hasn't joined yet
        return _buildMenuItem(
          value: 'get_started',
          icon: Icons.start,
          title: 'Get Started',
          color: AppColors.opportunityPrimary,
        );
      }
    } else {
      // NOT QUALIFIED: Show eligibility status
      return _buildMenuItem(
        value: 'eligibility',
        icon: Icons.assessment,
        title: 'Eligibility Status',
        color: AppColors.opportunityPrimary,
      );
    }
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
                color: AppColors.textInverse.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const BackButton(color: AppColors.textInverse),
            )
          : null,
      iconTheme: const IconThemeData(color: AppColors.textInverse),
      title: GestureDetector(
        onTap: () {
          if (isProfileComplete) {
            Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                    builder: (_) => NavigationShell(appId: widget.appId)),
                (route) => false);
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
        PopupMenuButton<String>(
          icon: _buildMenuIcon(),
          onSelected: (value) => _handleMenuSelection(value, isProfileComplete),
          itemBuilder: (context) =>
              _buildMenuItems(isProfileComplete, currentUser),
        ),
      ],
    );
  }
}

class PrimaryAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;

  const PrimaryAppBar({
    super.key,
    required this.title,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false,
      systemOverlayStyle: SystemUiOverlayStyle.light,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient, // your blue header
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white), // white title
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new,
            color: Colors.white), // white chevron
        onPressed: () {
          // Robust back behavior for nested navigators:
          // 1) Try the nearest Navigator (tab's navigator)
          final nav = Navigator.of(context);
          if (nav.canPop()) {
            nav.pop();
          } else {
            // 2) Try the root navigator (e.g., if a modal or external push was used)
            final rootNav = Navigator.of(context, rootNavigator: true);
            if (rootNav.canPop()) {
              rootNav.pop();
            } else {
              // 3) Fallback to the NavigationShell (switch to Dashboard)
              final shell =
                  context.findAncestorStateOfType<NavigationShellState>();
              if (shell != null) {
                shell.navigateToTab(0);
              } else {
                // 4) Last resort: use the global service
                NavigationService.navigateToTab(0);
              }
            }
          }
        },
      ),
      actions: actions,
      iconTheme: const IconThemeData(color: Colors.white), // white action icons
    );
  }
}
