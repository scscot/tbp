// lib/screens/welcome_screen.dart
import 'package:flutter/material.dart';
import '../models/user_model.dart';
import 'edit_profile_screen.dart';
import 'admin_edit_profile_screen.dart';
import '../widgets/header_widgets.dart';
import '../widgets/localized_text.dart';

class WelcomeScreen extends StatelessWidget {
  final String appId;
  final UserModel user;

  const WelcomeScreen({super.key, required this.appId, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const EntryAppBar(),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              context.l10n?.welcomeGreeting(user.firstName ?? 'New User') ?? 'Welcome, ${user.firstName ?? 'New User'}!',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Text(
              user.role == 'admin'
                  ? (context.l10n?.welcomeMessageAdmin ?? 'Ready to lead the professional networking revolution? Complete your admin profile and set up your team. After completing your profile you will have access to the full Team Build Pro platform.')
                  : (context.l10n?.welcomeMessageUser ?? 'Ready to transform your professional network? Complete your profile to unlock the full power of Team Build Pro.'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 36),
            ElevatedButton(
              onPressed: () {
                if (user.role == 'admin') {
                  // Route admin users to AdminEditProfileScreen
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (_) => AdminEditProfileScreen(
                        appId: appId,
                      ),
                    ),
                  );
                } else {
                  // Route regular users to EditProfileScreen
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (_) => EditProfileScreen(
                        appId: appId,
                        user: user,
                        isFirstTimeSetup: true,
                      ),
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                    horizontal: 28.0, vertical: 14.0),
                textStyle: const TextStyle(fontSize: 16),
              ),
              child: Text(context.l10n?.welcomeButtonJoin ?? 'Join the Revolution'),
            )
          ],
        ),
      ),
    );
  }
}
