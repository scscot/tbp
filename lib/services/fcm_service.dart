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
        if (isTerminated) {
          notificationService.setPendingNotification(pendingNotification);
        } else {
          navigateToRoute(pendingNotification);
        }
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
        .set({'fcm_token': token}, SetOptions(merge: true)).then((_) {
      if (kDebugMode) {
        debugPrint(
            "✅✅✅ SAVE TOKEN SUCCESS: Firestore write completed without error.");
      }
    }).catchError((error) {
      if (kDebugMode) {
        debugPrint(
            "❌❌❌ SAVE TOKEN FAILED: Firestore write failed with an error: $error");
      }
    });

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
      final recipientId = notification.arguments['recipientId'] as String?;
      final recipientName = notification.arguments['recipientName'] as String?;
      if (threadId != null && recipientId != null && recipientName != null) {
        const String appId = 'L8n1tJqHqYd3F5j6';
        navigatorKey.currentState!.push(MaterialPageRoute(
          builder: (_) => MessageThreadScreen(
            threadId: threadId,
            recipientId: recipientId,
            recipientName: recipientName,
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
