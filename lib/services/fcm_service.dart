// lib/services/fcm_service.dart
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// --- MODIFICATION: Import main.dart for navigatorKey ---
import '../main.dart';
import 'notification_service.dart';
import '../screens/member_detail_screen.dart';
import '../screens/message_thread_screen.dart';
import '../screens/join_opportunity_screen.dart';

// --- MODIFICATION: The key is now defined in main.dart and removed from here ---

class FCMService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  Future<void> initialize(BuildContext context) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null || user.uid.isEmpty) return;

    final notificationService =
        Provider.of<NotificationService>(context, listen: false);

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // Wait for APNS token to be available before getting FCM token
      await _waitForAPNSToken();
      await _saveToken();

      _messaging.onTokenRefresh.listen((token) async {
        await _saveToken();
      });

      _messaging.getInitialMessage().then((message) {
        if (message != null) {
          _handleMessage(notificationService, message, isTerminated: true);
        }
      });

      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _handleMessage(notificationService, message);
      });

      // Handle foreground messages (when app is open)
      FirebaseMessaging.onMessage.listen((message) {
        if (kDebugMode) {
          debugPrint(
              "📱 Received foreground FCM message: ${message.messageId}");
          debugPrint("📱 Title: ${message.notification?.title}");
          debugPrint("📱 Body: ${message.notification?.body}");
          debugPrint("📱 Data: ${message.data}");
        }

        // Show in-app notification when app is in foreground
        _showForegroundNotification(message);

        // Handle the message data for navigation
        _handleMessage(notificationService, message);
      });
    }
  }

  Future<void> _waitForAPNSToken() async {
    if (kDebugMode) {
      debugPrint("--- WAITING FOR APNS TOKEN ---");
    }

    // Try to get APNS token with retries
    for (int i = 0; i < 10; i++) {
      try {
        final apnsToken = await _messaging.getAPNSToken();
        if (apnsToken != null) {
          if (kDebugMode) {
            debugPrint(
                "✅ APNS token available: ${apnsToken.substring(0, 10)}...");
          }
          return;
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint("⚠️ APNS token not ready, attempt ${i + 1}/10: $e");
        }
      }

      // Wait before retrying
      await Future.delayed(Duration(milliseconds: 500));
    }

    if (kDebugMode) {
      debugPrint("⚠️ APNS token still not available after 10 attempts");
    }
  }

  void _handleMessage(
      NotificationService notificationService, RemoteMessage message,
      {bool isTerminated = false}) {
    final route = message.data['route'] as String?;
    final paramsString = message.data['route_params'] as String?;

    if (route != null && paramsString != null) {
      try {
        final Map<String, dynamic> arguments = jsonDecode(paramsString);
        final pendingNotification = PendingNotification(
          route: route,
          arguments: arguments,
        );
        // Only auto-navigate if the app was terminated and reopened by the notification
        // For foreground messages, just store the notification data without auto-navigation
        if (isTerminated) {
          notificationService.setPendingNotification(pendingNotification);
        }
        // Removed auto-navigation for foreground messages to prevent unwanted routing
      } catch (e) {
        if (kDebugMode) {
          debugPrint("Error parsing notification route_params: $e");
        }
      }
    }
  }

  Future<void> _saveToken() async {
    if (kDebugMode) {
      debugPrint("--- SAVE TOKEN START ---");
    }
    final user = FirebaseAuth.instance.currentUser;

    if (user == null || user.uid.isEmpty) {
      if (kDebugMode) {
        debugPrint(
            "--- SAVE TOKEN FAILED: Aborting, user is null or has no UID.");
      }
      return;
    }
    if (kDebugMode) {
      debugPrint("--- SAVE TOKEN: User found with UID: ${user.uid} ---");
    }

    try {
      // Check APNS token availability first
      final apnsToken = await _messaging.getAPNSToken();
      if (apnsToken == null) {
        if (kDebugMode) {
          debugPrint(
              "--- SAVE TOKEN FAILED: APNS token not available, will retry later");
        }
        // Retry after a delay
        Future.delayed(Duration(seconds: 2), () => _saveToken());
        return;
      }

      final token = await _messaging.getToken();

      if (token == null) {
        if (kDebugMode) {
          debugPrint(
              "--- SAVE TOKEN FAILED: Aborting, token received from FCM was null.");
        }
        return;
      }
      if (kDebugMode) {
        debugPrint(
            "--- SAVE TOKEN: Got FCM token starting with: ${token.substring(0, 15)}...");
        debugPrint(
            "--- SAVE TOKEN: Preparing to write to Firestore document... ---");
      }

      await _firestore
          .collection('users')
          .doc(user.uid)
          .set({'fcm_token': token}, SetOptions(merge: true));

      if (kDebugMode) {
        debugPrint(
            "✅✅✅ SAVE TOKEN SUCCESS: Firestore write completed without error.");
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint(
            "❌❌❌ SAVE TOKEN FAILED: Error during token generation or Firestore write: $error");
      }

      // If it's an APNS token error, retry after a delay
      if (error.toString().contains('apns-token-not-set')) {
        if (kDebugMode) {
          debugPrint(
              "--- SAVE TOKEN: Will retry in 3 seconds due to APNS token issue");
        }
        Future.delayed(Duration(seconds: 3), () => _saveToken());
      }
    }

    if (kDebugMode) {
      debugPrint("--- SAVE TOKEN END ---");
    }
  }

  Future<void> clearFCMToken(String uid) async {
    try {
      await _firestore
          .collection('users')
          .doc(uid)
          .update({'fcm_token': FieldValue.delete()});
      if (kDebugMode) {
        debugPrint('🧹 Cleared FCM token for user: $uid');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('⚠️ Error clearing FCM token: $e');
      }
    }
  }

  void _showForegroundNotification(RemoteMessage message) {
    // Only show if we have valid notification data and can access the navigator
    if (message.notification != null && navigatorKey.currentState != null) {
      final context = navigatorKey.currentState!.context;

      // Create the notification content
      final title = message.notification!.title ?? 'New Notification';
      final body = message.notification!.body ?? '';

      // Show a SnackBar with the notification
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              if (body.isNotEmpty)
                Text(
                  body.replaceAll('\nREPLY', ''),
                  style: const TextStyle(color: Colors.white),
                ),
            ],
          ),
          backgroundColor: Colors.blue[700],
          duration: const Duration(seconds: 4),
          // Remove automatic navigation - let user manually go to notifications
        ),
      );

      if (kDebugMode) {
        debugPrint("🔔 Showed foreground notification: $title");
      }
    }
  }
}

void navigateToRoute(PendingNotification notification) {
  if (navigatorKey.currentState != null) {
    if (notification.route == '/member_detail') {
      final userId = notification.arguments['userId'] as String?;
      if (userId != null) {
        const String appId = 'L8n1tJqHqYd3F5j6';
        navigatorKey.currentState!.push(MaterialPageRoute(
          builder: (_) => MemberDetailScreen(userId: userId, appId: appId),
        ));
      }
    } else if (notification.route == '/message_thread') {
      final threadId = notification.arguments['threadId'] as String?;
      if (threadId != null) {
        // Navigate to message thread - the screen will determine participants from threadId
        const String appId = 'L8n1tJqHqYd3F5j6';
        navigatorKey.currentState!.push(MaterialPageRoute(
          builder: (_) => MessageThreadScreen(
            threadId: threadId,
            recipientId: '', // Will be determined from threadId in the screen
            recipientName: '', // Will be determined from threadId in the screen
            appId: appId,
          ),
        ));
      }
    } else if (notification.route == '/join_opportunity') {
      const String appId = 'L8n1tJqHqYd3F5j6';
      navigatorKey.currentState!.push(MaterialPageRoute(
        builder: (_) => JoinOpportunityScreen(appId: appId),
      ));
    }
  }
}
