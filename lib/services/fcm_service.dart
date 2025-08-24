// lib/services/fcm_service.dart
import 'dart:convert';
import 'dart:io' show Platform;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import 'notification_service.dart';

class FCMService {
  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

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

    if (kDebugMode) {
      debugPrint("--- FCMService: Current user UID: ${user.uid} ---");
    }

    final notificationService =
        Provider.of<NotificationService>(context, listen: false);

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // Only wait for APNS token on iOS
      if (Platform.isIOS) {
        await _waitForAPNSToken();
      }
      await _saveToken();

      _messaging.onTokenRefresh.listen((token) async {
        if (kDebugMode) {
          debugPrint("--- FCMService: FCM token refreshed: $token");
        }
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

      FirebaseMessaging.onMessage.listen((message) {
        if (kDebugMode) {
          debugPrint(
              "📱 Received foreground FCM message: ${message.messageId}");
          debugPrint("📱 Title: ${message.notification?.title}");
          debugPrint("📱 Body: ${message.notification?.body}");
          debugPrint("📱 Data: ${message.data}");
        }

        _showForegroundNotification(message);

        _handleMessage(notificationService, message);
      });
    }
  }

  Future<void> _waitForAPNSToken() async {
    // This method is iOS-specific for APNS token handling
    if (!Platform.isIOS) return;
    
    if (kDebugMode) {
      debugPrint("--- WAITING FOR APNS TOKEN (iOS) ---");
    }

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

      await Future.delayed(Duration(milliseconds: 500));
    }

    if (kDebugMode) {
      debugPrint("⚠️ APNS token still not available after 10 attempts");
    }
  }

  void _handleMessage(
      NotificationService notificationService, RemoteMessage message,
      {bool isTerminated = false, bool shouldNavigate = false}) {
    if (isTerminated || shouldNavigate) {
      final notificationId = message.data['notification_id'] as String?;
      _markNotificationAsRead(notificationId);
      if (kDebugMode) {
        debugPrint(
            "📨 FCM: Marking notification as read due to user click (isTerminated: $isTerminated, shouldNavigate: $shouldNavigate)");
      }
    } else {
      if (kDebugMode) {
        debugPrint(
            "📨 FCM: Foreground notification - NOT marking as read automatically");
      }
    }

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
          notificationService.setPendingNotification(pendingNotification);
        } else if (shouldNavigate) {
          if (kDebugMode) {
            debugPrint(
                "📨 FCM: App opened from background - scheduling navigation");
          }
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
      // Only check APNS token on iOS
      if (Platform.isIOS) {
        final apnsToken = await _messaging.getAPNSToken();
        if (apnsToken == null) {
          if (kDebugMode) {
            debugPrint(
                "--- SAVE TOKEN FAILED: APNS token not available, will retry later");
          }
          Future.delayed(Duration(seconds: 10), () => _saveToken()); // Retry less frequently
          return;
        }
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

      // Only retry for APNS token issues on iOS
      if (Platform.isIOS && error.toString().contains('apns-token-not-set')) {
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
    if (message.notification != null && navigatorKey.currentState != null) {
      final context = navigatorKey.currentState!.context;

      final title = message.notification!.title ?? 'New Notification';
      final body = message.notification!.body ?? '';

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
        ),
      );

      if (kDebugMode) {
        debugPrint("🔔 Showed foreground notification: $title");
      }
    }
  }
}

// This function exists outside of the FCMService class
void navigateToRoute(PendingNotification notification) {
  if (kDebugMode) {
    debugPrint(
        "🚀 NAVIGATION: Attempting to navigate to route: ${notification.route}");
    debugPrint("🚀 NAVIGATION: Arguments: ${notification.arguments}");
    debugPrint(
        "🚀 NAVIGATION: Navigator state available: ${navigatorKey.currentState != null}");
  }

  if (navigatorKey.currentState != null) {
    navigatorKey.currentState!.pushNamed(
      notification.route,
      arguments: notification.arguments,
    );
  } else {
    if (kDebugMode) {
      debugPrint("❌ NAVIGATION: Cannot navigate. Navigator state is null.");
      debugPrint("❌ NAVIGATION: Will retry navigation in 1 second...");
    }
    Future.delayed(const Duration(seconds: 1), () {
      navigateToRoute(notification);
    });
  }
}
