import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
import '../screens/member_detail_screen.dart';
import '../screens/subscription_screen_enhanced.dart';
import '../screens/getting_started_screen.dart';
import '../models/user_model.dart';
import '../services/subscription_navigation_guard.dart';
import 'subscription_required_modal.dart';

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

// Global reference to access NavigationShell from anywhere
NavigationShellState? _globalNavigationShellState;

// Global function to navigate within tabs while preserving bottom menu
void navigateWithinTabs({
  required String route,
  Map<String, dynamic>? arguments,
  int? preferredTabIndex,
}) {
  if (_globalNavigationShellState != null) {
    _globalNavigationShellState!.navigateWithinTab(
      route: route,
      arguments: arguments,
      preferredTabIndex: preferredTabIndex,
    );
  }
}

class NavigationShellState extends State<NavigationShell> {
  @override
  void initState() {
    super.initState();
    _globalNavigationShellState = this;
  }

  @override
  void dispose() {
    _globalNavigationShellState = null;
    super.dispose();
  }

  // Method to navigate within the appropriate tab's navigator
  void navigateWithinTab({
    required String route,
    Map<String, dynamic>? arguments,
    int? preferredTabIndex,
  }) {
    // Determine which tab to use for navigation
    int tabIndex = preferredTabIndex ?? _getAppropriateTabForRoute(route);

    // Switch to the appropriate tab if not already there
    if (_currentIndex != tabIndex) {
      setState(() => _currentIndex = tabIndex);
    }

    // Navigate within the tab's navigator
    final navigator = _navigatorKeys[tabIndex].currentState;
    if (navigator != null) {
      navigator.pushNamed(route, arguments: arguments);
    }
  }

  // Determine which tab is most appropriate for a given route
  int _getAppropriateTabForRoute(String route) {
    switch (route) {
      case '/network':
        return 1; // Network tab
      case '/member_detail':
        return 1; // Show member details in Network tab
      case '/business':
        return 0; // Business screen in Dashboard tab
      case '/subscription':
        return 0; // Subscription in Dashboard tab
      default:
        return 0; // Default to Dashboard tab
    }
  }

  // Interpret command codes from child screens: 0..4 = tab switch; 5+ = push inside current tab
  void handleCommand(int code) {
    if (code >= 0 && code <= 4) {
      // Tab switches for protected tabs (1=Network, 2=Share, 3=Messages)
      if (code == 1 || code == 2 || code == 3) {
        _navigateToTabWithGuard(code);
      } else {
        navigateToTab(code);
      }
      return;
    }
    // Default to using Dashboard tab's navigator for detail flows
    final nav = _navigatorKeys[0].currentState;
    if (nav == null) return;
    final navContext = nav.context;

    switch (code) {
      case 5:
        nav.push(MaterialPageRoute(
            builder: (_) => HowItWorksScreen(appId: widget.appId)));
        break;
      case 6:
        SubscriptionNavigationGuard.pushGuarded(
          context: navContext,
          routeName: 'company',
          screen: CompanyScreen(appId: widget.appId),
          appId: widget.appId,
        );
        break;
      case 7:
        SubscriptionNavigationGuard.pushGuarded(
          context: navContext,
          routeName: 'business',
          screen: BusinessScreen(appId: widget.appId),
          appId: widget.appId,
        );
        break;
      case 8:
        SubscriptionNavigationGuard.pushGuarded(
          context: navContext,
          routeName: 'eligibility',
          screen: EligibilityScreen(appId: widget.appId),
          appId: widget.appId,
        );
        break;
      case 9:
        SubscriptionNavigationGuard.pushGuarded(
          context: navContext,
          routeName: 'profile',
          screen: ProfileScreen(appId: widget.appId),
          appId: widget.appId,
        );
        break;
      case 10:
        nav.push(MaterialPageRoute(
            builder: (_) => NotificationsScreen(appId: widget.appId)));
        break;
      case 11:
        SubscriptionNavigationGuard.pushGuarded(
          context: navContext,
          routeName: 'platform_management',
          screen: PlatformManagementScreen(appId: widget.appId),
          appId: widget.appId,
        );
        break;
      case 12:
        nav.push(MaterialPageRoute(
            builder: (_) => GettingStartedScreen(appId: widget.appId)));
        break;
      default:
        break;
    }
  }

  void _navigateToTabWithGuard(int tabIndex) {
    final navContext = _navigatorKeys[0].currentState?.context;
    if (navContext == null) return;

    if (tabIndex < 1 || tabIndex > 3) {
      navigateToTab(tabIndex);
      return;
    }

    if (SubscriptionNavigationGuard.hasValidSubscription(
        Provider.of<UserModel?>(navContext, listen: false))) {
      navigateToTab(tabIndex);
    } else {
      showSubscriptionRequiredModal(
        navContext,
        Provider.of<UserModel?>(navContext, listen: false)?.subscriptionStatus ??
            'expired',
        widget.appId,
      );
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
        onGenerateRoute: (settings) {
          // Handle special routes within tabs
          if (settings.name == '/member_detail') {
            final args = settings.arguments as Map<String, dynamic>?;
            String userId = '';

            final userIdValue = args?['userId'];
            if (userIdValue is String) {
              userId = userIdValue;
            } else if (userIdValue is Map<String, dynamic>) {
              userId = userIdValue['userId'] as String? ?? '';
            }

            return MaterialPageRoute(
              builder: (context) {
                SubscriptionNavigationGuard.pushGuarded(
                  context: context,
                  routeName: 'member_detail',
                  screen: MemberDetailScreen(
                    userId: userId,
                    appId: widget.appId,
                  ),
                  appId: widget.appId,
                );
                return const SizedBox.shrink();
              },
              settings: settings,
            );
          } else if (settings.name == '/network') {
            final args = settings.arguments as Map<String, dynamic>?;
            return MaterialPageRoute(
              builder: (context) {
                SubscriptionNavigationGuard.pushGuarded(
                  context: context,
                  routeName: 'network',
                  screen: NetworkScreen(
                    appId: widget.appId,
                    initialFilter: args != null && args.containsKey('filter')
                        ? args['filter'] as String
                        : null,
                  ),
                  appId: widget.appId,
                );
                return const SizedBox.shrink();
              },
              settings: settings,
            );
          } else if (settings.name == '/business') {
            return MaterialPageRoute(
              builder: (context) {
                SubscriptionNavigationGuard.pushGuarded(
                  context: context,
                  routeName: 'business',
                  screen: BusinessScreen(appId: widget.appId),
                  appId: widget.appId,
                );
                return const SizedBox.shrink();
              },
              settings: settings,
            );
          } else if (settings.name == '/subscription') {
            return MaterialPageRoute(
              builder: (context) => SubscriptionScreenEnhanced(appId: widget.appId),
              settings: settings,
            );
          }

          // Default route - return the tab's main screen
          return MaterialPageRoute(builder: (_) => child);
        },
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
            selectedFontSize: 12.0,
            unselectedFontSize: 12.0,
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
                icon: Icon(Icons.share),
                label: 'Share',
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
