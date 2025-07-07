// lib/screens/notifications_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import '../widgets/header_widgets.dart';
import '../services/notification_service.dart';
import '../services/fcm_service.dart';

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

class _NotificationsScreenState extends State<NotificationsScreen> {
  Future<List<QueryDocumentSnapshot>>? _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
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
      for (final doc in snapshot.docs) {
        // --- FIX: Removed unnecessary type check ---
        if ((doc.data() as Map).containsKey('read') &&
            (doc.data() as Map)['read'] == false) {
          doc.reference.update({'read': true});
        }
      }
      return snapshot.docs;
    } catch (e) {
      debugPrint('Error fetching notifications for UID $uid: $e');
      return [];
    }
  }

  // --- FIX: This function is now referenced by the delete button ---
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
      if (mounted) {
        setState(() {
          _notificationsFuture = _fetchNotifications(authUser.uid);
        });
      }
    } catch (e) {
      debugPrint("Error deleting notification: $e");
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
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 24.0),
            child: Center(
              child: Text(
                'Notifications',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 12),
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

                    // --- FIX: This variable is now used below ---
                    final String formattedTime = timestamp != null
                        ? DateFormat.yMMMMd().add_jm().format(timestamp)
                        : 'N/A';

                    // --- FIX: This variable is now used below ---
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
                        onTap: () {
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
