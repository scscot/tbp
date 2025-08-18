import 'package:flutter/material.dart';
import '../widgets/navigation_shell.dart';

class NavigationService {
  static final NavigationService _instance = NavigationService._internal();
  factory NavigationService() => _instance;
  NavigationService._internal();

  static GlobalKey<NavigationShellState>? _navigationShellKey;

  static void registerNavigationShell(GlobalKey<NavigationShellState> key) {
    _navigationShellKey = key;
  }

  static void navigateToTab(int index) {
    if (_navigationShellKey?.currentState != null) {
      _navigationShellKey!.currentState!.navigateToTab(index);
    }
  }

  static void navigateToAction(int code) {
    _navigationShellKey?.currentState?.handleCommand(code);
  }

  static void navigateTo(int codeOrTab) { // convenience
    }
  }

  void navigateToScreen(Widget Function(BuildContext) screenBuilder) {
    // For now, we'll use the current approach but ensure we maintain the shell
    // This would need to be enhanced for more complex navigation
  }
  