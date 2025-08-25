import 'package:flutter/material.dart';
import 'package:ultimatefix/screens/how_it_works_screen.dart';
import '../screens/dashboard_screen.dart';
import '../screens/message_center_screen.dart';
import '../screens/share_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/platform_management_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/network_screen.dart';
import '../screens/eligibility_screen.dart';
import '../screens/business_screen.dart';
import '../screens/company_screen.dart';

class NavigationShell extends StatefulWidget {
  final String appId;
  final void Function(int)? onTabChange;

  const NavigationShell({
    super.key,
    required this.appId,
    this.onTabChange,
  });

  @override
  State<NavigationShell> createState() => NavigationShellState();
}

class NavigationShellState extends State<NavigationShell> {
  // Interpret command codes from child screens: 0..4 = tab switch; 5+ = push inside current tab
  void handleCommand(int code) {
    if (code >= 0 && code <= 4) {
      navigateToTab(code);
      return;
    }
    // Default to using Dashboard tab's navigator for detail flows
    final nav = _navigatorKeys[0].currentState;
    if (nav == null) return;

    switch (code) {
      case 5:
        nav.push(MaterialPageRoute(
            builder: (_) => HowItWorksScreen(appId: widget.appId)));
        break;
      case 6:
        nav.push(MaterialPageRoute(
            builder: (_) => CompanyScreen(appId: widget.appId)));
        break;
      case 7:
        nav.push(MaterialPageRoute(
            builder: (_) => BusinessScreen(appId: widget.appId)));
        break;
      case 8:
        nav.push(MaterialPageRoute(
            builder: (_) => EligibilityScreen(appId: widget.appId)));
        break;
      case 9:
        nav.push(MaterialPageRoute(
            builder: (_) => ProfileScreen(appId: widget.appId)));
        break;
      case 10:
        nav.push(MaterialPageRoute(
            builder: (_) => NotificationsScreen(appId: widget.appId)));
        break;
      case 11:
        nav.push(MaterialPageRoute(
            builder: (_) => PlatformManagementScreen(appId: widget.appId)));
        break;
      default:
        break;
    }
  }

  int _currentIndex = 0;

  /// One Navigator per tab to keep the bottom bar persistent while pushing detail pages.
  final List<GlobalKey<NavigatorState>> _navigatorKeys =
      List.generate(5, (_) => GlobalKey<NavigatorState>());

  void navigateToTab(int index) {
    if (!mounted) return;
    if (index == _currentIndex) {
      final nav = _navigatorKeys[index].currentState;
      if (nav != null) {
        while (nav.canPop()) {
          nav.pop();
        }
      }
      return;
    }
    setState(() => _currentIndex = index);
    widget.onTabChange?.call(index);
  }

  void _onItemTapped(int index) => handleCommand(index);

  Widget _buildTabNavigator(int index, Widget child) {
    return Offstage(
      offstage: _currentIndex != index,
      child: Navigator(
        key: _navigatorKeys[index],
        onGenerateRoute: (settings) => MaterialPageRoute(builder: (_) => child),
      ),
    );
  }


  @override
  Widget build(BuildContext context) {

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;

        final nav = _navigatorKeys[_currentIndex].currentState;
        if (nav != null && nav.canPop()) {
          nav.pop(result); // pass result through
          return;
        }
        Navigator.maybePop(context, result);
      },
      child: Scaffold(
        body: IndexedStack(
          index: _currentIndex,
          children: [
            _buildTabNavigator(
              0,
              DashboardScreen(
                appId: widget.appId,
                onTabSelected: _onItemTapped,
              ),
            ),
            _buildTabNavigator(
              1,
              NetworkScreen(appId: widget.appId),
            ),
            _buildTabNavigator(
              2,
              ShareScreen(appId: widget.appId),
            ),
            _buildTabNavigator(
              3,
              MessageCenterScreen(appId: widget.appId),
            ),
            _buildTabNavigator(
              4,
              NotificationsScreen(appId: widget.appId),
            ),
          ],
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: _onItemTapped,
            type: BottomNavigationBarType.fixed,
            selectedItemColor: Theme.of(context).colorScheme.primary,
            unselectedItemColor:
                Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.dashboard_outlined),
                label: 'Home',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.people_outline),
                label: 'Team',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.trending_up),
                label: 'Grow',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.message_outlined),
                label: 'Messages',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.notifications_outlined),
                label: 'Notices',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
