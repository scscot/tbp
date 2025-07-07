import 'package:flutter/material.dart';

/// A simple data class to hold the details for a pending navigation
/// that was triggered by a push notification.
class PendingNotification {
  final String route;
  final Map<String, dynamic> arguments;

  PendingNotification({required this.route, required this.arguments});
}

/// A ChangeNotifier service to manage the state of a pending notification.
/// This allows the app to store the deep link information while the user
/// goes through the login process.
class NotificationService with ChangeNotifier {
  PendingNotification? _pendingNotification;

  PendingNotification? get pendingNotification => _pendingNotification;

  /// Sets the pending notification data. This is called by the FCM service
  /// when a notification tap is handled.
  void setPendingNotification(PendingNotification notification) {
    _pendingNotification = notification;
  }

  /// Consumes the pending notification. This is called by the UI after
  /// navigation has occurred to prevent it from happening again.
  void clearPendingNotification() {
    _pendingNotification = null;
  }
}
