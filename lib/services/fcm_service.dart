// lib/services/fcm_service.dart
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import 'notification_service.dart';
import '../screens/member_detail_screen.dart';
import '../screens/message_thread_screen.dart';
import '../screens/join_company_screen.dart';
import '../screens/team_screen.dart';

class FCMService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // --- NEW: Private helper method to mark notification as read ---
  Future<void> _markNotificationAsRead(String? notificationId) async {
    final currentUser = FirebaseAuth.instance.currentUser;
    if (notificationId == null || currentUser == null) return;

    if (kDebugMode) {
      debugPrint(
          "🔔 FCM_SERVICE: Marking notification as read: $notificationId");
    }
    try {
      await _firestore
          .collection('users')
          .doc(currentUser.uid)
          .collection('notifications')
          .doc(notificationId)
          .update({'read': true});
      if (kDebugMode) {
        debugPrint("✅ FCM_SERVICE: Successfully marked as read.");
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint("❌ FCM_SERVICE: Error marking notification as read: $e");
      }
    }
  }

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
        _handleMessage(notificationService, message, shouldNavigate: true);
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

  // --- MODIFIED: This function now conditionally marks the notification as read ---
  void _handleMessage(
      NotificationService notificationService, RemoteMessage message,
      {bool isTerminated = false, bool shouldNavigate = false}) {
    // --- MODIFIED: Only mark as read when user actually clicks system notification ---
    // Don't mark as read for foreground SnackBar notifications
    if (isTerminated || shouldNavigate) {
      final notificationId = message.data['notification_id'] as String?;
      _markNotificationAsRead(notificationId);
      if (kDebugMode) {
        debugPrint("📨 FCM: Marking notification as read due to user click (isTerminated: $isTerminated, shouldNavigate: $shouldNavigate)");
      }
    } else {
      if (kDebugMode) {
        debugPrint("📨 FCM: Foreground notification - NOT marking as read automatically");
      }
    }
    // --- END MODIFIED ---

    if (kDebugMode) {
      debugPrint(
          "📨 FCM: Handling message - isTerminated: $isTerminated, shouldNavigate: $shouldNavigate");
      debugPrint("📨 FCM: Message data: ${message.data}");
    }

    final route = message.data['route'] as String?;
    final paramsString = message.data['route_params'] as String?;

    if (route != null && paramsString != null) {
      if (kDebugMode) {
        debugPrint("📨 FCM: Route: $route, Params: $paramsString");
      }

      try {
        final Map<String, dynamic> arguments = jsonDecode(paramsString);
        final pendingNotification = PendingNotification(
          route: route,
          arguments: arguments,
        );

        if (isTerminated) {
          if (kDebugMode) {
            debugPrint(
                "📨 FCM: App was terminated - storing pending notification");
          }
          // Store pending notification for terminated app
          notificationService.setPendingNotification(pendingNotification);
        } else if (shouldNavigate) {
          if (kDebugMode) {
            debugPrint(
                "📨 FCM: App opened from background - scheduling navigation");
          }
          // Navigate when app is opened from background, with a small delay to ensure navigator is ready
          Future.delayed(Duration(milliseconds: 500), () {
            navigateToRoute(pendingNotification);
          });
        } else {
          if (kDebugMode) {
            debugPrint("📨 FCM: Foreground message - no navigation scheduled");
          }
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint("❌ FCM: Error parsing notification route_params: $e");
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint("📨 FCM: No route or params found in message data");
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
  if (kDebugMode) {
    debugPrint(
        "🚀 NAVIGATION: Attempting to navigate to route: ${notification.route}");
    debugPrint("🚀 NAVIGATION: Arguments: ${notification.arguments}");
    debugPrint(
        "🚀 NAVIGATION: Navigator state available: ${navigatorKey.currentState != null}");
  }

  if (navigatorKey.currentState != null) {
    if (notification.route == '/member_detail') {
      final userId = notification.arguments['userId'] as String?;
      if (userId != null) {
        if (kDebugMode) {
          debugPrint(
              "🚀 NAVIGATION: Navigating to MemberDetailScreen for userId: $userId");
        }
        const String appId = 'L8n1tJqHqYd3F5j6';
        navigatorKey.currentState!.push(MaterialPageRoute(
          builder: (_) => MemberDetailScreen(userId: userId, appId: appId),
        ));
      } else {
        if (kDebugMode) {
          debugPrint("❌ NAVIGATION: userId is null for member_detail route");
        }
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
        builder: (_) => JoinCompanyScreen(appId: appId),
      ));
    } else if (notification.route == '/team') {
      const String appId = 'L8n1tJqHqYd3F5j6';
      final filter = notification.arguments['filter'] as String?;

      // Navigate to TeamScreen with initial filter
      navigatorKey.currentState!.push(MaterialPageRoute(
        builder: (_) => TeamScreen(
          appId: appId,
          initialFilter: filter,
        ),
      ));
    }
  } else {
    if (kDebugMode) {
      debugPrint("❌ NAVIGATION: Navigator state is null, cannot navigate");
      debugPrint("❌ NAVIGATION: Will retry navigation in 1 second...");
    }
    // Retry navigation after a longer delay if navigator is not ready
    Future.delayed(Duration(seconds: 1), () {
      navigateToRoute(notification);
    });
  }
}
