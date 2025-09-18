// lib/services/fcm_service.dart
import 'dart:async';
import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../main.dart';
import 'notification_service.dart';

class FCMService {
  // Singleton pattern
  static final FCMService _instance = FCMService._internal();
  factory FCMService() => _instance;
  FCMService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Track which user we're currently bound to
  String? _boundUid;

  /// Token refresh subscription so we can cancel on logout or user switch
  StreamSubscription<String>? _tokenRefreshSub;

  /// Message handling subscriptions to prevent duplicates
  StreamSubscription<RemoteMessage>? _onMessageSub;
  StreamSubscription<RemoteMessage>? _onMessageOpenedAppSub;

  /// Client-side de-dup cache for notification IDs
  final Map<String, DateTime> _recentNotifications = <String, DateTime>{};

  /// Check if notification was seen recently (client-side de-dup)
  bool _seenRecently(String? id) {
    if (id == null) return false;
    final now = DateTime.now();
    // Clean up old entries (older than 5 minutes)
    _recentNotifications.removeWhere((_, timestamp) =>
        now.difference(timestamp) > const Duration(minutes: 5));

    final seen = _recentNotifications.containsKey(id);
    _recentNotifications[id] = now;
    return seen;
  }

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

  /// Initialize FCM for a specific user.
  /// Safe to call repeatedly; it will re-bind when uid changes.
  Future<void> initialize({required String uid, BuildContext? context}) async {
    // If we're already bound to this uid and all listeners are active, nothing to do.
    if (_boundUid == uid && _onMessageSub != null && _onMessageOpenedAppSub != null && _tokenRefreshSub != null) {
      if (kDebugMode) {
        debugPrint('FCMService: already initialized for $uid');
      }
      return;
    }

    // If bound to a different user, unbind first.
    if (_boundUid != null && _boundUid != uid) {
      await _unbindInternal();
    }

    // Zero listeners before (re)subscribing to ensure clean state
    await _onMessageSub?.cancel();
    _onMessageSub = null;
    await _onMessageOpenedAppSub?.cancel();
    _onMessageOpenedAppSub = null;
    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;

    if (kDebugMode) {
      debugPrint("--- FCMService: Initializing for user UID: $uid ---");
    }

    // Request permissions on iOS/macOS; no-op on Android if already granted.
    await _ensurePermissions();

    // Set iOS foreground presentation options to prevent system banner while app is active
    await _messaging.setForegroundNotificationPresentationOptions(
      alert: false, // prevents iOS system banner in foreground
      badge: true,
      sound: true,
    );

    // Some iOS builds need the APNS token to be available first.
    // This is harmless on Android.
    try {
      await _messaging.getAPNSToken();
    } catch (_) {}

    // Get an initial token and save it.
    String? token = await _messaging.getToken();
    if (token != null && token.trim().isNotEmpty) {
      await _saveToken(uid: uid, token: token);
    }

    // Listen for future token changes and persist them for this uid.
    _tokenRefreshSub = _messaging.onTokenRefresh.listen((t) async {
      if (_boundUid != uid) return; // guard: ignore if user switched mid-stream
      if (t.trim().isEmpty) return;
      await _saveToken(uid: uid, token: t);
    });

    _boundUid = uid;

    // Set up message handling if context is provided
    if (context != null && context.mounted) {
      final notificationService =
          Provider.of<NotificationService>(context, listen: false);

      _messaging.getInitialMessage().then((message) {
        if (message != null) {
          // Cold-start de-dup protection
          final id = message.data['notification_id'] ?? message.messageId;
          if (_seenRecently(id)) {
            if (kDebugMode) {
              debugPrint("🚫 FCM: Ignoring duplicate cold-start message: $id");
            }
            return;
          }
          _handleMessage(notificationService, message, isTerminated: true);
        }
      });

      _onMessageOpenedAppSub = FirebaseMessaging.onMessageOpenedApp.listen((message) {
        // Client-side de-dup check
        final id = message.data['notification_id'] ?? message.messageId;
        if (_seenRecently(id)) return;

        _handleMessage(notificationService, message, shouldNavigate: true);
      });

      _onMessageSub = FirebaseMessaging.onMessage.listen((message) {
        // Client-side de-dup check
        final id = message.data['notification_id'] ?? message.messageId;
        if (_seenRecently(id)) {
          if (kDebugMode) {
            debugPrint("🚫 FCM: Ignoring duplicate message: $id");
          }
          return;
        }

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

    if (kDebugMode) {
      debugPrint('✅ FCMService: bound to $uid with token ${token?.substring(0, 10)}...');
    }
  }

  Future<void> _ensurePermissions() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    if (kDebugMode) {
      debugPrint("--- FCMService: Permission status: ${settings.authorizationStatus}");
    }
  }

  /// Internal: cancel listeners and forget current uid (no Firestore I/O).
  Future<void> _unbindInternal() async {
    await _tokenRefreshSub?.cancel();
    _tokenRefreshSub = null;

    await _onMessageSub?.cancel();
    _onMessageSub = null;

    await _onMessageOpenedAppSub?.cancel();
    _onMessageOpenedAppSub = null;

    // Clear de-dup cache to avoid cross-user notification ID collisions
    _recentNotifications.clear();

    _boundUid = null;

    if (kDebugMode) {
      debugPrint("--- FCMService: Unbound from previous user and canceled all listeners");
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

  Future<void> _saveToken({required String uid, required String token}) async {
    if (kDebugMode) {
      debugPrint("--- SAVE TOKEN START for UID: $uid ---");
      debugPrint("--- SAVE TOKEN: Got FCM token starting with: ${token.substring(0, 15)}...");
    }

    try {
      // Minimal write: single `fcm_token` field (server already resolves across 3 tiers)
      final doc = _firestore.collection('users').doc(uid);
      await doc.update({'fcm_token': token.trim()});

      if (kDebugMode) {
        debugPrint("✅✅✅ SAVE TOKEN SUCCESS: Firestore write completed without error.");
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint("❌❌❌ SAVE TOKEN FAILED: Error during Firestore write: $error");
      }
    }

    if (kDebugMode) {
      debugPrint("--- SAVE TOKEN END ---");
    }
  }

  /// Clear token in Firestore for this user and unbind locally.
  Future<void> clearFCMToken({required String uid}) async {
    // Delete from Firestore
    try {
      final doc = _firestore.collection('users').doc(uid);
      await doc.update({'fcm_token': FieldValue.delete()});
      if (kDebugMode) {
        debugPrint('🧹 Cleared FCM token for user: $uid');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('⚠️ Error clearing FCM token: $e');
      }
    }

    // Unbind locally so the next login reinitializes
    await _unbindInternal();
  }

  /// Public method to unbind FCM service (for logout)
  /// Ensures clean state for next login
  Future<void> unbind() async {
    await _unbindInternal();
    if (kDebugMode) {
      debugPrint('🧹 FCMService: Public unbind completed');
    }
  }

  void _showForegroundNotification(RemoteMessage message) {
    // Only show local notification if no system notification block exists (data-only pushes)
    // This prevents system notification + local notification duplicates on iOS
    if (message.notification == null && navigatorKey.currentState != null) {
      final context = navigatorKey.currentState!.context;

      // For data-only messages, extract title/body from data payload
      final title = message.data['title'] ?? 'New Notification';
      final body = message.data['body'] ?? '';

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
          backgroundColor: Colors.green[700],
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
