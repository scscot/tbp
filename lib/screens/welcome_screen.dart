// lib/screens/welcome_screen.dart
import 'package:flutter/material.dart';
import '../main.dart' as widget;
import '../models/user_model.dart';
import 'edit_profile_screen.dart';
import '../widgets/header_widgets.dart';

class WelcomeScreen extends StatelessWidget {
  final String appId;
  final UserModel user;

  const WelcomeScreen({super.key, required this.appId, required this.user});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              'Welcome, ${user.firstName ?? 'New User'}!',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            const Text(
              'Please use the button below to complete your profile. After completing your profile you will have access to the full TeamBuild Pro app.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 36),
            ElevatedButton(
              onPressed: () {
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
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                    horizontal: 28.0, vertical: 14.0),
                textStyle: const TextStyle(fontSize: 16),
              ),
              child: const Text('Complete My Profile'),
            )
          ],
        ),
      ),
    );
  }
}
