import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import '../widgets/header_widgets.dart';
import '../services/firestore_service.dart';
import 'message_thread_screen.dart';
import '../models/user_model.dart';

class MessageCenterScreen extends StatefulWidget {
  final String appId;

  const MessageCenterScreen({
    super.key,
    required this.appId,
  });

  @override
  State<MessageCenterScreen> createState() => _MessageCenterScreenState();
}

class _MessageCenterScreenState extends State<MessageCenterScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  String? _currentUserId;
  Stream<QuerySnapshot>? _threadsStream;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  void _initialize() {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      setState(() {
        _currentUserId = user.uid;
        _threadsStream = FirebaseFirestore.instance
            .collection('chats')
            .where('participants', arrayContains: _currentUserId)
            .orderBy('lastMessageTimestamp', descending: true)
            .snapshots();
      });
    }
  }

  Future<UserModel?> _getOtherUser(
      List<dynamic> participants, String currentUserId) async {
    // --- FINAL DEBUGGING CODE ---
    debugPrint("--- [GET_USER] Function called.");
    debugPrint("--- [GET_USER] currentUserId is: $currentUserId");
    debugPrint("--- [GET_USER] participants list is: $participants");
    // --- END DEBUGGING CODE ---

    String? otherUserId;
    for (final id in participants) {
      if (id.toString() != currentUserId) {
        otherUserId = id.toString();
        break; // Exit the loop as soon as we find the other user
      }
    }

    debugPrint("--- [GET_USER] otherUserId was determined to be: $otherUserId");

    if (otherUserId != null) {
      // This now calls the service as before.
      return await _firestoreService.getUser(otherUserId);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const PrimaryAppBar(title: 'Message Center'),
      body: _currentUserId == null
          ? const Center(child: Text('Please log in to see messages.'))
          : Column(
              children: [
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('Message Center',
                      style:
                          TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                ),
                Expanded(
                  child: StreamBuilder<QuerySnapshot>(
                    stream: _threadsStream,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return Center(child: Text('Error: ${snapshot.error}'));
                      }
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                        return const Center(
                            child: Text('No message threads found.'));
                      }
                      final threads = snapshot.data!.docs;
                      return ListView.builder(
                        itemCount: threads.length,
                        itemBuilder: (context, index) {
                          final thread = threads[index];
                          final data = thread.data() as Map<String, dynamic>;
                          final participants =
                              List<String>.from(data['participants'] ?? []);
                          final lastMessage =
                              data['lastMessage'] ?? 'No message yet.';
                          final timestamp =
                              data['lastMessageTimestamp'] as Timestamp?;

                          return FutureBuilder<UserModel?>(
                            // --- PASS THE CURRENT USER ID HERE ---
                            future:
                                _getOtherUser(participants, _currentUserId!),
                            builder: (context, userSnapshot) {
                              // --- THIS IS THE CORRECTED LOGIC ---
                              // First, handle the loading state explicitly.
                              if (userSnapshot.connectionState ==
                                  ConnectionState.waiting) {
                                return const ListTile(
                                  leading: CircleAvatar(),
                                  title: Text('Loading chat...'),
                                );
                              }

                              // Then, handle any errors from the future.
                              if (userSnapshot.hasError) {
                                return const ListTile(
                                  leading:
                                      CircleAvatar(child: Icon(Icons.error)),
                                  title: Text('Error loading user details'),
                                );
                              }

                              // Now it's safe to work with the data.
                              final otherUser = userSnapshot.data;
                              final otherUserName = otherUser != null
                                  ? '${otherUser.firstName} ${otherUser.lastName}'
                                  : 'Unknown User';
                              final otherUserPhotoUrl = otherUser
                                  ?.photoUrl; // Safely get the photo URL

                              return ListTile(
                                leading: CircleAvatar(
                                  // Use the safe URL variable here.
                                  backgroundImage: otherUserPhotoUrl != null
                                      ? NetworkImage(otherUserPhotoUrl)
                                      : null,
                                  child: otherUserPhotoUrl == null
                                      ? const Icon(Icons.person)
                                      : null,
                                ),
                                title: Text(otherUserName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                subtitle: Text(lastMessage,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                trailing: timestamp != null
                                    ? Text(
                                        DateFormat.yMMMd()
                                            .add_jm()
                                            .format(timestamp.toDate()),
                                        style: const TextStyle(
                                            fontSize: 12, color: Colors.grey))
                                    : null,
                                onTap: () {
                                  if (otherUser != null) {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => MessageThreadScreen(
                                          threadId: thread.id,
                                          appId: widget.appId,
                                          recipientId: otherUser.uid,
                                          recipientName: otherUserName,
                                        ),
                                      ),
                                    );
                                  }
                                },
                              );
                            },
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
