import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import '../widgets/header_widgets.dart';
import '../services/firestore_service.dart';
import 'message_thread_screen.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';

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
  UserModel? _currentUser;
  UserModel? _sponsor;
  UserModel? _teamLeader;
  bool _isLoadingContacts = true;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  void _initialize() async {
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

      // Load current user and contacts for regular users
      await _loadUserAndContacts();
    }
  }

  Future<void> _loadUserAndContacts() async {
    try {
      // Load current user data
      final currentUser = await _firestoreService.getUser(_currentUserId!);
      if (!mounted) return;

      setState(() {
        _currentUser = currentUser;
      });

      // Only load contacts for regular users, not admins
      if (currentUser?.role == 'user') {
        await _loadSponsorAndTeamLeader(currentUser!);
      } else {
        setState(() {
          _isLoadingContacts = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading user and contacts: $e');
      setState(() {
        _isLoadingContacts = false;
      });
    }
  }

  Future<void> _loadSponsorAndTeamLeader(UserModel user) async {
    try {

      // Load sponsor (direct sponsor)
      UserModel? sponsor;
      if (user.sponsorId != null && user.sponsorId!.isNotEmpty) {
        sponsor = await _firestoreService.getUser(user.sponsorId!);
      }

      // Load team leader (upline admin)
      UserModel? teamLeader;
      if (user.uplineAdmin != null &&
          user.uplineAdmin!.isNotEmpty &&
          user.uplineAdmin != user.sponsorId) {
        teamLeader = await _firestoreService.getUser(user.uplineAdmin!);
      }

      if (!mounted) return;

      setState(() {
        _sponsor = sponsor;
        _teamLeader = teamLeader;
        _isLoadingContacts = false;
      });
    } catch (e) {
      debugPrint('Error loading sponsor and team leader: $e');
      setState(() {
        _isLoadingContacts = false;
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

  void _startChatWithUser(UserModel user, String displayName) {
    final ids = [_currentUserId!, user.uid];
    ids.sort();
    final threadId = ids.join('_');

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MessageThreadScreen(
          threadId: threadId,
          appId: widget.appId,
          recipientId: user.uid,
          recipientName: displayName,
        ),
      ),
    );
  }

  Widget _buildContactCard(UserModel user, String role, String subtitle) {
    final displayName = '${user.firstName ?? ''} ${user.lastName ?? ''}'.trim();
    final displaySubtitle = displayName.isNotEmpty ? displayName : 'Team Member';

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => _startChatWithUser(user, displaySubtitle),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundImage: user.photoUrl?.isNotEmpty == true
                    ? NetworkImage(user.photoUrl!)
                    : null,
                child: user.photoUrl?.isEmpty != false
                    ? const Icon(Icons.person, size: 30)
                    : null,
              ),
              const SizedBox(height: 12),
              Text(
                role,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                displaySubtitle,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContactsSection() {
    // Only show for regular users, not admins
    if (_currentUser?.role != 'user') {
      return const SizedBox.shrink();
    }

    if (_isLoadingContacts) {
      return Container(
        padding: const EdgeInsets.all(16),
        child: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    // Build list of available contacts
    final List<Widget> contactCards = [];

    if (_sponsor != null) {
      contactCards.add(
        Expanded(
          child: _buildContactCard(
            _sponsor!,
            'Your Sponsor',
            ''
          ),
        ),
      );
    }

    if (_teamLeader != null) {
      contactCards.add(
        Expanded(
          child: _buildContactCard(
            _teamLeader!,
            'Team Leader',
            ''
          ),
        ),
      );
    }

    // If no contacts available, don't show the section
    if (contactCards.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your Support Team',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Tap to start a conversation',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: contactCards,
              ),
            ],
          ),
        ),
        Divider(
          height: 1,
          color: AppColors.border,
          indent: 16,
          endIndent: 16,
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppScreenBar(title: 'Messages', appId: widget.appId),
      body: _currentUserId == null
          ? const Center(child: Text('Please log in to see messages.'))
          : Column(
              children: [
                _buildContactsSection(),
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
