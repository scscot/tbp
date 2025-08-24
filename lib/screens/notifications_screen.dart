// lib/screens/notifications_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../widgets/header_widgets.dart';
import '../services/notification_service.dart';
import '../services/fcm_service.dart';
import '../main.dart';

class NotificationsScreen extends StatefulWidget {
  final String? initialAuthToken;
  final String appId;

  const NotificationsScreen({
    super.key,
    this.initialAuthToken,
    required this.appId,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen>
    with RouteAware {
  Future<List<QueryDocumentSnapshot>>? _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) {
      routeObserver.subscribe(this, route);
    }
  }

  @override
  void didPopNext() {
    debugPrint(
        '📱 NotificationsScreen: Returned via back arrow, reloading notifications');
    _loadNotifications();
  }

  @override
  void dispose() {
    routeObserver.unsubscribe(this);
    super.dispose();
  }

  void _loadNotifications() {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser != null) {
      setState(() {
        _notificationsFuture = _fetchNotifications(authUser.uid);
      });
    } else {
      setState(() {
        _notificationsFuture = Future.value([]);
      });
    }
  }

  Future<List<QueryDocumentSnapshot>> _fetchNotifications(String uid) async {
    try {
      final snapshot = await FirebaseFirestore.instance
          .collection('users')
          .doc(uid)
          .collection('notifications')
          .orderBy('createdAt', descending: true)
          .get();

      final List<QueryDocumentSnapshot> unreadNotifications = [];
      final List<QueryDocumentSnapshot> readNotifications = [];

      for (final doc in snapshot.docs) {
        final data = doc.data();
        final isRead = data.containsKey('read') && data['read'] == true;

        if (isRead) {
          readNotifications.add(doc);
        } else {
          unreadNotifications.add(doc);
        }
      }

      final List<QueryDocumentSnapshot> sortedNotifications = [];
      sortedNotifications.addAll(unreadNotifications);
      sortedNotifications.addAll(readNotifications);

      return sortedNotifications;
    } catch (e) {
      debugPrint('Error fetching notifications for UID $uid: $e');
      return [];
    }
  }

  Future<void> _deleteNotification(String docId) async {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) return;
    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(authUser.uid)
          .collection('notifications')
          .doc(docId)
          .delete();

      await _checkAndClearBadge();

      if (mounted) {
        _loadNotifications();
      }
    } catch (e) {
      debugPrint("Error deleting notification: $e");
    }
  }

  Future<void> _markNotificationAsRead(String docId) async {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) return;

    try {
      await FirebaseFirestore.instance
          .collection('users')
          .doc(authUser.uid)
          .collection('notifications')
          .doc(docId)
          .update({'read': true});
    } catch (e) {
      debugPrint('Error marking notification as read: $e');
    }
  }

  Future<void> _checkAndClearBadge() async {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) return;

    try {
      // Always call syncAppBadge to recalculate the correct badge count
      // This will handle both notifications AND messages properly
      if (kDebugMode) {
        print("🔔 Syncing badge after notification change...");
      }
      await FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('syncAppBadge')
          .call();
    } catch (e) {
      if (kDebugMode) {
        print("Error calling syncAppBadge: $e");
      }
    }
  }

  void _showSimpleNotificationDialog(Map<String, dynamic> data) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(data['title'] ?? 'Notification'),
        content: Text(data['body'] ?? data['message'] ?? 'No message content.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const AppScreenBar(title: 'Notifications'),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: FutureBuilder<List<QueryDocumentSnapshot>>(
              future: _notificationsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.hasError) {
                  return const Center(
                      child: Text('Error loading notifications'));
                }
                final docs = snapshot.data ?? [];
                if (docs.isEmpty) {
                  return const Center(child: Text('No notifications yet.'));
                }

                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (context, index) =>
                      const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final doc = docs[index];
                    final data = doc.data() as Map<String, dynamic>;
                    final timestamp =
                        (data['createdAt'] as Timestamp?)?.toDate().toLocal();

                    final String formattedTime = timestamp != null
                        ? DateFormat('MMM d, yyyy h:mm a').format(timestamp)
                        : 'N/A';

                    final isRead =
                        data.containsKey('read') && data['read'] == true;

                    return Card(
                      margin: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      elevation: 3,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        leading: Icon(
                          isRead
                              ? Icons.notifications_none
                              : Icons.notifications_active,
                          color: isRead ? Colors.grey : Colors.deepPurple,
                          size: 28,
                        ),
                        title: Text(
                          data['title'] ?? 'No Title',
                          style: TextStyle(
                            fontWeight:
                                isRead ? FontWeight.normal : FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 6),
                            Text(
                                data['body'] ??
                                    data['message'] ??
                                    'No message content.',
                                style: const TextStyle(fontSize: 13)),
                            const SizedBox(height: 6),
                            Text(
                              formattedTime,
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey),
                            ),
                          ],
                        ),
                        trailing: IconButton(
                          icon:
                              const Icon(Icons.delete, color: Colors.redAccent),
                          onPressed: () => _deleteNotification(doc.id),
                        ),
                        onTap: () async {
                          await _markNotificationAsRead(doc.id);
                          await _checkAndClearBadge();
                          _loadNotifications();

                          final route = data['route'] as String?;
                          if (route != null) {
                            try {
                              final paramsString =
                                  data['route_params'] as String? ?? '{}';
                              final arguments = jsonDecode(paramsString)
                                  as Map<String, dynamic>;
                              final pendingNotification = PendingNotification(
                                route: route,
                                arguments: arguments,
                              );
                              navigateToRoute(pendingNotification);
                            } catch (e) {
                              debugPrint(
                                  "Error handling notification tap navigation: $e");
                              _showSimpleNotificationDialog(data);
                            }
                          } else {
                            _showSimpleNotificationDialog(data);
                          }
                        },
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
