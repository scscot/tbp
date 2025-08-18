import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import 'navigation_shell.dart';
import '../services/navigation_service.dart';

class AuthenticatedWrapper extends StatelessWidget {
  final String appId;

  const AuthenticatedWrapper({
    super.key,
    required this.appId,
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<UserModel?>(
      builder: (context, user, child) {
        if (user == null) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        final navigationShellKey = GlobalKey<NavigationShellState>();
        NavigationService.registerNavigationShell(navigationShellKey);

        return NavigationShell(
          key: navigationShellKey,
          appId: appId,
        );
      },
    );
  }
}
