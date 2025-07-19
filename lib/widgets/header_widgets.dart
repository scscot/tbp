// lib/widgets/header_widgets.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:ultimatefix/screens/business_screen.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart';
import '../config/app_constants.dart';
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
      return;
    }

    if (!isProfileComplete) return;

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

  bool _shouldShowJoinCompany(UserModel? currentUser) {
    if (currentUser == null ||
        currentUser.role == 'admin' ||
        currentUser.bizVisitDate != null) {
      return false;
    }
    return (currentUser.directSponsorCount) >=
            AppConstants.projectWideDirectSponsorMin &&
        (currentUser.totalTeamCount) >= AppConstants.projectWideTotalTeamMin;
  }

  bool _shouldShowBackButton(BuildContext context) {
    return Navigator.of(context).canPop();
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
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
      ),
      leading: _shouldShowBackButton(context)
          ? const BackButton(color: Colors.white)
          : const SizedBox(),
      iconTheme: const IconThemeData(color: Colors.white),
      title: GestureDetector(
        onTap: () {
          if (isProfileComplete) {
            Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                    builder: (_) => DashboardScreen(appId: widget.appId)));
          }
        },
        child: Text('Team Build Pro',
            style: const TextStyle(
              fontSize: 22, 
              fontWeight: FontWeight.bold,
              color: Colors.white,
            )),
      ),
      centerTitle: true,
      actions: [
        if (currentUser != null)
          PopupMenuButton<String>(
            onSelected: (value) =>
                _handleMenuSelection(value, isProfileComplete),
            itemBuilder: (BuildContext context) => [
              if (isProfileComplete) ...[
                const PopupMenuItem<String>(
                    value: 'dashboard', child: Text('Dashboard')),
                const PopupMenuItem<String>(
                    value: 'how_it_works', child: Text('How It Works')),
                const PopupMenuItem<String>(
                    value: 'team', child: Text('My Team')),
                const PopupMenuItem<String>(
                    value: 'share', child: Text('Grow My Team')),
                const PopupMenuItem<String>(
                    value: 'messages', child: Text('Messages Center')),
                const PopupMenuItem<String>(
                    value: 'notifications', child: Text('Notifications')),
                const PopupMenuItem<String>(
                    value: 'profile', child: Text('My Profile')),
                const PopupMenuItem<String>(
                    value: 'privacy', child: Text('Privacy Policy')),
                const PopupMenuItem<String>(
                    value: 'terms', child: Text('Terms of Service')),
              ],
              const PopupMenuItem<String>(
                  value: 'logout', child: Text('Logout')),
            ],
          )
      ],
    );
  }
}
