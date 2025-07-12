// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'config/app_constants.dart';
import 'firebase_options.dart';
import 'models/user_model.dart';
import 'models/admin_settings_model.dart';
import 'screens/welcome_screen.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/settings_screen.dart';
import 'services/auth_service.dart';
import 'services/fcm_service.dart';
import 'services/deep_link_service.dart';
import 'widgets/restart_widget.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'services/notification_service.dart';

// --- The global key is now defined here, at the top level ---
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

const String appId = 'L8n1tJqHqYd3F5j6';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await AppConstants.initialize();
  await initializeDateFormatting('en_US', null);

  // Initialize deep linking
  await DeepLinkService().initialize();

  runApp(RestartWidget(child: const MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

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
          title: 'TeamBuild Pro',
          theme: ThemeData(
            primarySwatch: Colors.indigo,
            fontFamily: 'Inter',
          ),
          debugShowCheckedModeBanner: false,
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

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      child: _buildContent(context, user, adminSettings),
    );
  }

  Widget _buildContent(BuildContext context, UserModel? user,
      AdminSettingsModel? adminSettings) {
    if (user == null) {
      return LoginScreen(key: const ValueKey('LoginScreen'), appId: appId);
    }

    final bool hasMissingPhoto =
        user.photoUrl == null || user.photoUrl!.isEmpty;
    if (hasMissingPhoto) {
      return WelcomeScreen(
          key: const ValueKey('WelcomeScreen'), appId: appId, user: user);
    }

    if (user.role == 'admin') {
      if (adminSettings == null) {
        return const Scaffold(
            key: ValueKey('Loading'),
            body: Center(child: CircularProgressIndicator()));
      }
      final bool settingsIncomplete = adminSettings.bizOpp == null ||
          adminSettings.bizOpp!.isEmpty ||
          adminSettings.bizOppRefUrl == null ||
          adminSettings.bizOppRefUrl!.isEmpty;
      if (settingsIncomplete) {
        return SettingsScreen(
            key: const ValueKey('SettingsScreen'), appId: appId);
      }
    }

    return DashboardScreen(
        key: const ValueKey('DashboardScreen'), appId: appId);
  }
}
