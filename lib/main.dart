// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'config/app_constants.dart';
import 'firebase_options.dart';
import 'models/user_model.dart';
import 'models/admin_settings_model.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/admin_edit_profile_screen.dart';
import 'screens/admin_edit_profile_screen_1.dart';
import 'screens/edit_profile_screen.dart';
import 'services/auth_service.dart';
import 'services/fcm_service.dart' show FCMService, navigateToRoute;
import 'services/deep_link_service.dart';
import 'widgets/restart_widget.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'services/notification_service.dart';

// --- The global key is now defined here, at the top level ---
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// --- RouteObserver for tracking navigation events ---
final RouteObserver<PageRoute> routeObserver = RouteObserver<PageRoute>();

const String appId = 'L8n1tJqHqYd3F5j6';

void main() async {
  try {
    debugPrint('🚀 MAIN: Starting app initialization...');

    WidgetsFlutterBinding.ensureInitialized();
    debugPrint('🚀 MAIN: Flutter binding initialized');

    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    debugPrint('🚀 MAIN: Firebase initialized');

    await AppConstants.initialize();
    debugPrint('🚀 MAIN: AppConstants initialized');

    await initializeDateFormatting('en_US', null);
    debugPrint('🚀 MAIN: Date formatting initialized');

    // Initialize deep linking
    await DeepLinkService().initialize();
    debugPrint('🚀 MAIN: Deep link service initialized');

    debugPrint('🚀 MAIN: Starting app...');
    runApp(RestartWidget(child: const MyApp()));
    debugPrint('🚀 MAIN: App started successfully');
  } catch (e, stackTrace) {
    debugPrint('❌ MAIN: Error during app initialization: $e');
    debugPrint('❌ MAIN: Stack trace: $stackTrace');
    // Still try to run the app with basic initialization
    runApp(RestartWidget(child: const MyApp()));
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
      // App became active - sync badge with server
      debugPrint('🔔 APP LIFECYCLE: App resumed, syncing badge');
      _syncAppBadge();
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
          // --- The key is assigned here ---
          navigatorKey: navigatorKey,
          title: 'Network Build Pro',
          theme: ThemeData(
            primarySwatch: Colors.indigo,
            fontFamily: 'Inter',
          ),
          debugShowCheckedModeBanner: false,
          // --- Add RouteObserver to track navigation events ---
          navigatorObservers: [routeObserver],
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
      debugPrint('🔐 AUTH_WRAPPER: No user found, showing LoginScreen');
      return LoginScreen(key: const ValueKey('LoginScreen'), appId: appId);
    }

    debugPrint(
        '🔐 AUTH_WRAPPER: User found: ${user.uid}, role: ${user.role}, photoUrl: ${user.photoUrl}, country: ${user.country}, firstName: ${user.firstName}');

    // Profile completion logic based on user role
    if (user.role == 'admin') {
      // Admin user profile completion check
      if (user.country == null || user.country!.isEmpty) {
        debugPrint(
            '🔐 AUTH_WRAPPER: Admin missing country, showing AdminEditProfileScreen');
        return AdminEditProfileScreen(
            key: const ValueKey('AdminEditProfileScreen'), appId: appId);
      }

      // Admin has country, check if admin_settings exist
      if (adminSettings == null) {
        debugPrint(
            '🔐 AUTH_WRAPPER: Admin missing business settings, showing AdminEditProfileScreen1');
        return AdminEditProfileScreen1(
            key: const ValueKey('AdminEditProfileScreen1'), appId: appId);
      }
    } else {
      // Non-admin user profile completion check
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

    // Profile is complete, show dashboard
    debugPrint('🔐 AUTH_WRAPPER: Profile complete, showing DashboardScreen');
    return DashboardScreen(
        key: const ValueKey('DashboardScreen'), appId: appId);
  }
}
