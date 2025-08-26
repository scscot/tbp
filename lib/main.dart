// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'config/app_constants.dart';
import 'firebase_options.dart';
import 'models/user_model.dart';
import 'models/admin_settings_model.dart';
import 'screens/admin_edit_profile_screen.dart';
import 'screens/admin_edit_profile_screen_1.dart';
import 'screens/edit_profile_screen.dart';
import 'screens/subscription_screen.dart';
import 'screens/member_detail_screen.dart';
import 'screens/business_screen.dart';
import 'screens/message_thread_screen.dart';
import 'services/auth_service.dart';
import 'services/fcm_service.dart' show FCMService, navigateToRoute;
import 'services/deep_link_service.dart';
import 'widgets/restart_widget.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'services/notification_service.dart';
import 'screens/network_screen.dart';
import 'services/badge_service.dart';
import 'screens/homepage_screen.dart';
import 'widgets/navigation_shell.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
final RouteObserver<PageRoute> routeObserver = RouteObserver<PageRoute>();
const String appId = 'L8n1tJqHqYd3F5j6';

void main() async {
  try {
    debugPrint('🚀 MAIN: Starting app initialization...');
    WidgetsFlutterBinding.ensureInitialized();
    debugPrint('🚀 MAIN: Flutter binding initialized');
    await _initializeFirebaseWithRetry();
    debugPrint('🚀 MAIN: Firebase initialized');
    await AppConstants.initialize();
    debugPrint('🚀 MAIN: AppConstants initialized');
    await initializeDateFormatting('en_US', null);
    debugPrint('🚀 MAIN: Date formatting initialized');
    // The DeepLinkService is now the single source of truth for initial navigation.
    await DeepLinkService().initialize();
    debugPrint('🚀 MAIN: Deep link service initialized');
    debugPrint('🚀 MAIN: Starting app...');
    runApp(RestartWidget(child: const MyApp()));
    debugPrint('🚀 MAIN: App started successfully');
  } catch (e, stackTrace) {
    debugPrint('❌ MAIN: Error during app initialization: $e');
    debugPrint('❌ MAIN: Stack trace: $stackTrace');
    runApp(RestartWidget(child: const MyApp()));
  }
}

Future<void> _initializeFirebaseWithRetry() async {
  int retryCount = 0;
  const maxRetries = 3;
  const retryDelay = Duration(seconds: 2);

  while (retryCount < maxRetries) {
    try {
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      debugPrint(
          '🚀 MAIN: Firebase initialized successfully on attempt ${retryCount + 1}');
      return;
    } catch (e) {
      retryCount++;
      debugPrint(
          '❌ MAIN: Firebase initialization failed (attempt $retryCount/$maxRetries): $e');

      if (retryCount >= maxRetries) {
        debugPrint(
            '❌ MAIN: Firebase initialization failed after $maxRetries attempts');
        return;
      }

      debugPrint(
          '🔄 MAIN: Retrying Firebase initialization in ${retryDelay.inSeconds} seconds...');
      await Future.delayed(retryDelay);
    }
  }
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);

    if (state == AppLifecycleState.resumed) {
      debugPrint('🔔 APP LIFECYCLE: App resumed, syncing badge');
      _syncAppBadge();
      _clearAppBadge();
      _checkSubscriptionOnResume();
    }
  }

  Future<void> _clearAppBadge() async {
    try {
      await BadgeService.clearBadge();
      debugPrint('✅ APP LIFECYCLE: Cleared app badge on resume');
    } catch (e) {
      debugPrint('❌ APP LIFECYCLE: Failed to clear app badge: $e');
    }
  }

  Future<void> _checkSubscriptionOnResume() async {
    try {
      final context = navigatorKey.currentContext;
      if (context == null) return;

      final authService = Provider.of<AuthService>(context, listen: false);
      final needsSubscription =
          await authService.checkSubscriptionOnAppResume();

      if (needsSubscription && context.mounted) {
        debugPrint(
            '🔔 APP LIFECYCLE: User needs subscription on resume, navigating to subscription screen');
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
          (route) => false,
        );
      }
    } catch (e) {
      debugPrint('❌ APP LIFECYCLE: Error checking subscription on resume: $e');
    }
  }

  Future<void> _syncAppBadge() async {
    try {
      await FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('syncAppBadge')
          .call();
      debugPrint('✅ APP LIFECYCLE: Badge sync completed');
    } catch (e) {
      debugPrint('❌ APP LIFECYCLE: Badge sync failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Provider<AuthService>(
      create: (_) => AuthService(),
      child: MultiProvider(
        providers: [
          ChangeNotifierProvider<NotificationService>(
            create: (_) => NotificationService(),
          ),
          StreamProvider<UserModel?>(
            create: (context) => context.read<AuthService>().user,
            initialData: null,
            catchError: (_, error) {
              debugPrint("❌ Auth stream error: $error");
              return null;
            },
          ),
          StreamProvider<AdminSettingsModel?>(
            create: (context) => context.read<AuthService>().adminSettings,
            initialData: null,
            catchError: (_, error) {
              debugPrint("❌ Admin settings stream error: $error");
              return null;
            },
          ),
        ],
        child: MaterialApp(
          navigatorKey: navigatorKey,
          title: 'Team Build Pro',
          theme: ThemeData(
            primarySwatch: Colors.indigo,
            fontFamily: 'Inter',
          ),
          debugShowCheckedModeBanner: false,
          navigatorObservers: [routeObserver],
          onGenerateRoute: (settings) {
            if (settings.name == '/network') {
              final args = settings.arguments as Map<String, dynamic>?;
              return MaterialPageRoute(
                builder: (context) => NetworkScreen(
                  appId: appId,
                  initialFilter: args != null && args.containsKey('filter')
                      ? args['filter'] as String
                      : null,
                ),
                settings: settings,
              );
            } else if (settings.name == '/subscription') {
              debugPrint('🔄 MAIN: Handling /subscription route');
              return MaterialPageRoute(
                builder: (context) {
                  debugPrint('🔄 MAIN: Building SubscriptionScreen');
                  return SubscriptionScreen(appId: appId);
                },
                settings: settings,
              );
            } else if (settings.name == '/member_detail') {
              final args = settings.arguments as Map<String, dynamic>?;
              return MaterialPageRoute(
                builder: (context) => MemberDetailScreen(
                  userId: args?['userId'] as String? ?? '',
                  appId: appId,
                ),
                settings: settings,
              );
            } else if (settings.name == '/business') {
              return MaterialPageRoute(
                builder: (context) => BusinessScreen(appId: appId),
                settings: settings,
              );
            } else if (settings.name == '/message_thread') {
              final args = settings.arguments as Map<String, dynamic>?;
              return MaterialPageRoute(
                builder: (context) => MessageThreadScreen(
                  threadId: args?['threadId'] as String? ?? '',
                  recipientId: args?['recipientId'] as String? ?? '',
                  recipientName: args?['recipientName'] as String? ?? '',
                  appId: appId,
                ),
                settings: settings,
              );
            }
            return MaterialPageRoute(
              builder: (context) => const AuthWrapper(),
              settings: settings,
            );
          },
          home: const AuthWrapper(),
        ),
      ),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});
  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _hasInitializedServices = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final user = Provider.of<UserModel?>(context);
    if (user != null && !_hasInitializedServices) {
      setState(() {
        _hasInitializedServices = true;
      });
      FCMService().initialize(context);
      final notificationService =
          Provider.of<NotificationService>(context, listen: false);
      final pending = notificationService.pendingNotification;
      if (pending != null) {
        navigateToRoute(pending);
        notificationService.clearPendingNotification();
      }
    } else if (user == null) {
      if (_hasInitializedServices) {
        setState(() {
          _hasInitializedServices = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<UserModel?>();
    final adminSettings = context.watch<AdminSettingsModel?>();
    debugPrint(
        '🔐 AUTH_WRAPPER: Building with user: ${user?.uid ?? 'null'}, admin settings: ${adminSettings != null ? 'loaded' : 'null'}');
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      child: _buildContent(context, user, adminSettings),
    );
  }

  Widget _buildContent(BuildContext context, UserModel? user,
      AdminSettingsModel? adminSettings) {
    debugPrint(
        '🔐 AUTH_WRAPPER: _buildContent called with user: ${user?.uid ?? 'null'}');

    if (user == null) {
      debugPrint('🔐 AUTH_WRAPPER: No user found, showing HOMEPAGE');
      final dls = DeepLinkService();
      return HomepageScreen(
        appId: appId,
        referralCode: dls.latestReferralCode,
        queryType: dls.latestQueryType, // <-- pass the type as well
      );
    }

    debugPrint(
        '🔐 AUTH_WRAPPER: User found: ${user.uid}, role: ${user.role}, photoUrl: ${user.photoUrl}, country: ${user.country}, firstName: ${user.firstName}');

    if (user.role == 'admin') {
      if (user.country == null || user.country!.isEmpty) {
        debugPrint(
            '🔐 AUTH_WRAPPER: Admin missing country, showing AdminEditProfileScreen');
        return AdminEditProfileScreen(
            key: const ValueKey('AdminEditProfileScreen'), appId: appId);
      }
      if (adminSettings == null) {
        debugPrint(
            '🔐 AUTH_WRAPPER: Admin missing business settings, showing AdminEditProfileScreen1');
        return AdminEditProfileScreen1(
            key: const ValueKey('AdminEditProfileScreen1'), appId: appId);
      }
    } else {
      if (user.photoUrl == null || user.photoUrl!.isEmpty) {
        debugPrint(
            '🔐 AUTH_WRAPPER: User missing photo, showing EditProfileScreen');
        return EditProfileScreen(
            key: const ValueKey('EditProfileScreen'),
            appId: appId,
            user: user,
            isFirstTimeSetup: true);
      }
    }
    debugPrint('🔐 AUTH_WRAPPER: Profile complete, showing NavigationShell');
    return NavigationShell(appId: appId);
  }
}

/// A simple splash screen to show while the app initializes.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 20),
            Text('Loading...'),
          ],
        ),
      ),
    );
  }
}
