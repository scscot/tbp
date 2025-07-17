// lib/screens/notifications_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
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

class _NotificationsScreenState extends State<NotificationsScreen> with RouteAware {
  Future<List<QueryDocumentSnapshot>>? _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Subscribe to route changes
    final route = ModalRoute.of(context);
    if (route is PageRoute) {
      routeObserver.subscribe(this, route);
    }
  }

  @override
  void didPopNext() {
    // Called when returning to this screen via back arrow
    // This is more precise than didChangeDependencies as it only triggers on back navigation
    debugPrint('📱 NotificationsScreen: Returned via back arrow, reloading notifications');
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
      
      // Separate unread and read notifications
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
      
      // Combine lists: unread first (chronologically sorted), then read (chronologically sorted)
      final List<QueryDocumentSnapshot> sortedNotifications = [];
      sortedNotifications.addAll(unreadNotifications);
      sortedNotifications.addAll(readNotifications);
      
      return sortedNotifications;
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

  // New method to mark individual notification as read when tapped
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

                    // Restore original logic for determining read status
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
                          // Mark notification as read when tapped
                          await _markNotificationAsRead(doc.id);
                          
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
