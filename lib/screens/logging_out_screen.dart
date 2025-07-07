// lib/screens/logging_out_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class LoggingOutScreen extends StatefulWidget {
  const LoggingOutScreen({super.key});

  @override
  State<LoggingOutScreen> createState() => _LoggingOutScreenState();
}

class _LoggingOutScreenState extends State<LoggingOutScreen> {
  @override
  void initState() {
    super.initState();
    // Use addPostFrameCallback to ensure the widget is built before calling this.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Trigger the sign out *after* this screen is displayed.
      context.read<AuthService>().signOut();
    });
  }

  @override
  Widget build(BuildContext context) {
    // This screen is only visible for a fraction of a second.
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
