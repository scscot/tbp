// lib/screens/message_thread_screen.dart

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'dart:async';

import '../models/message_model.dart';
import '../widgets/header_widgets.dart';

class MessageThreadScreen extends StatefulWidget {
  final String recipientId;
  final String recipientName;
  final String? initialAuthToken;
  final String appId;
  final String? threadId;

  const MessageThreadScreen({
    super.key,
    required this.recipientId,
    required this.recipientName,
    this.initialAuthToken,
    required this.appId,
    this.threadId,
  });

  @override
  State<MessageThreadScreen> createState() => _MessageThreadScreenState();
}

class _MessageThreadScreenState extends State<MessageThreadScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  String? _currentUserId;
  String? _threadId;
  bool _isThreadReady = false;
  // --- MODIFICATION: Added state variable for the photo URL ---
  String? _recipientPhotoUrl;
  // --- MODIFICATION: Added state variable for actual recipient name ---
  String _actualRecipientName = '';
  // --- MODIFICATION: Added state variable for actual recipient ID ---
  String _actualRecipientId = '';
  // --- NEW: Added state variable for business opportunity ---
  String? _bizOpp;

  @override
  void initState() {
    super.initState();
    _initializeAndCreateThread();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initializeAndCreateThread() async {
    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      debugPrint("Error: User not authenticated.");
      if (mounted) Navigator.of(context).pop();
      return;
    }
    _currentUserId = currentUser.uid;

    // --- NEW: Fetch business opportunity information ---
    await _fetchBusinessOpportunity();

    String actualRecipientId = widget.recipientId;
    String actualRecipientName = widget.recipientName;

    // If we have a threadId but no recipientId, fetch participants from the thread
    if (widget.threadId != null &&
        (widget.recipientId.isEmpty || widget.recipientName.isEmpty)) {
      try {
        final threadDoc = await FirebaseFirestore.instance
            .collection('chats')
            .doc(widget.threadId)
            .get();

        if (threadDoc.exists) {
          final participants =
              List<String>.from(threadDoc.data()?['participants'] ?? []);
          final otherParticipant = participants.firstWhere(
            (id) => id != _currentUserId,
            orElse: () => '',
          );

          if (otherParticipant.isNotEmpty) {
            // Fetch the other participant's details
            final userDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(otherParticipant)
                .get();

            if (userDoc.exists) {
              final userData = userDoc.data()!;
              actualRecipientId = otherParticipant;
              actualRecipientName =
                  '${userData['firstName'] ?? ''} ${userData['lastName'] ?? ''}'
                      .trim();
              _recipientPhotoUrl = userData['photoUrl'];
            }
          }
        }
      } catch (e) {
        debugPrint("Error fetching thread participants: $e");
      }
    }

    // Store the actual recipient info in instance variables for use in _sendMessage
    _actualRecipientId = actualRecipientId;

    // Store the actual recipient name in state
    if (mounted) {
      setState(() {
        _actualRecipientName = actualRecipientName.isNotEmpty
            ? actualRecipientName
            : 'Unknown User';
      });
    }

    // --- MODIFICATION: Fetch the recipient's user data to get their photo if not already fetched ---
    if (actualRecipientId.isNotEmpty && _recipientPhotoUrl == null) {
      try {
        final recipientDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(actualRecipientId)
            .get();
        if (mounted && recipientDoc.exists) {
          setState(() {
            _recipientPhotoUrl = recipientDoc.data()?['photoUrl'];
          });
        }
      } catch (e) {
        debugPrint("Error fetching recipient's profile: $e");
      }
    }
    // --- End of modification ---

    final ids = [_currentUserId!, actualRecipientId];
    ids.sort();
    final determinedThreadId = widget.threadId ?? ids.join('_');

    final chatDocRef =
        FirebaseFirestore.instance.collection('chats').doc(determinedThreadId);

    try {
      final docSnapshot = await chatDocRef.get();
      if (!docSnapshot.exists) {
        await chatDocRef.set({
          'participants': ids,
          'createdAt': FieldValue.serverTimestamp(),
          'lastMessage': '',
          'isRead': {_currentUserId!: true}
        });
        debugPrint("New chat document created: $determinedThreadId");
      }

      if (mounted) {
        setState(() {
          _threadId = determinedThreadId;
          _isThreadReady = true;
        });
        _markMessagesAsRead();
      }
    } catch (e) {
      debugPrint("Error initializing chat thread: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text("You do not have permission to message this user.")));
        Navigator.of(context).pop();
      }
    }
  }

  // --- NEW: Method to fetch business opportunity ---
  Future<void> _fetchBusinessOpportunity() async {
    try {
      if (_currentUserId == null) return;

      // First, get the current user's data to determine admin UID
      final userDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(_currentUserId!)
          .get();

      if (!userDoc.exists) return;

      final userData = userDoc.data()!;
      String? adminUid;

      // Determine admin UID based on user role
      if (userData['role'] == 'admin') {
        adminUid = _currentUserId;
      } else {
        adminUid = userData['uplineAdmin'];
      }

      if (adminUid != null && adminUid.isNotEmpty) {
        // Fetch admin settings to get business opportunity
        final adminDoc = await FirebaseFirestore.instance
            .collection('admin_settings')
            .doc(adminUid)
            .get();

        if (mounted && adminDoc.exists) {
          final adminData = adminDoc.data();
          setState(() {
            _bizOpp = adminData?['biz_opp'];
          });
        }
      }
    } catch (e) {
      debugPrint("Error fetching business opportunity: $e");
    }
  }

  void _markMessagesAsRead() {
    if (_threadId == null || _currentUserId == null) return;
    FirebaseFirestore.instance
        .collection('chats')
        .doc(_threadId)
        .update({'isRead.${_currentUserId!}': true});
  }

  void _sendMessage() {
    if (_controller.text.trim().isEmpty || !_isThreadReady) {
      return;
    }

    final textToSend = _controller.text.trim();

    // Check for URLs in the message
    if (_containsUrl(textToSend)) {
      _showUrlWarningModal();
      return;
    }

    final chatDocRef =
        FirebaseFirestore.instance.collection('chats').doc(_threadId!);

    // Clear the controller only after capturing the text
    _controller.clear();

    chatDocRef.collection('messages').add({
      'text': textToSend,
      'senderId': _currentUserId!,
      'timestamp': FieldValue.serverTimestamp(),
    });

    // Build the update data
    final updateData = <String, dynamic>{
      'lastMessage': textToSend,
      'lastMessageTimestamp': FieldValue.serverTimestamp(),
    };

    // Use the actual recipient ID we determined during initialization
    final recipientIdToUse =
        _actualRecipientId.isNotEmpty ? _actualRecipientId : widget.recipientId;

    // Add isRead only if we have a valid recipient ID
    if (recipientIdToUse.isNotEmpty) {
      updateData['isRead'] = {_currentUserId!: true, recipientIdToUse: false};
    } else {
      updateData['isRead.${_currentUserId!}'] = true;
    }

    chatDocRef.update(updateData);

    Timer(const Duration(milliseconds: 300), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0.0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // --- NEW: URL Detection and Warning Methods ---
  bool _containsUrl(String text) {
    // Comprehensive URL regex pattern to match various URL formats
    final urlPatterns = [
      // HTTP/HTTPS URLs
      RegExp(r'https?://[^\s]+', caseSensitive: false),
      // www. URLs
      RegExp(r'www\.[^\s]+', caseSensitive: false),
      // Domain.extension patterns (e.g., google.com, site.org)
      RegExp(r'\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:/[^\s]*)?\b',
          caseSensitive: false),
      // FTP URLs
      RegExp(r'ftp://[^\s]+', caseSensitive: false),
      // Shortened URLs (bit.ly, tinyurl, etc.)
      RegExp(
          r'\b(?:bit\.ly|tinyurl\.com|t\.co|short\.link|ow\.ly|is\.gd)/[^\s]+',
          caseSensitive: false),
    ];

    // Check against all patterns
    for (final pattern in urlPatterns) {
      if (pattern.hasMatch(text)) {
        return true;
      }
    }
    return false;
  }

  void _showUrlWarningModal() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue),
              SizedBox(width: 8),
              Text('Links Not Permitted'),
            ],
          ),
          content: Text(
            'Links aren\'t allowed in messages to keep our team focused on ${_bizOpp ?? 'our business opportunity'}. Please share your message without any links.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Understood'),
            ),
          ],
        );
      },
    );
  }
  // --- END: URL Detection and Warning Methods ---

  @override
  Widget build(BuildContext context) {
    if (!_isThreadReady) {
      return Scaffold(
        appBar: const AppScreenBar(title: 'Messages'),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppScreenBar(
        title: 'Messages',
        appId: widget.appId,
      ),
      body: Column(
        children: [
          // --- MODIFICATION: Added CircleAvatar for the recipient's photo ---
          const Padding(
            padding: EdgeInsets.all(16.0),
            child: Text('Message Center',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 6),
          CircleAvatar(
            radius: 40,
            backgroundImage:
                _recipientPhotoUrl != null && _recipientPhotoUrl!.isNotEmpty
                    ? NetworkImage(_recipientPhotoUrl!)
                    : null,
            child: (_recipientPhotoUrl == null || _recipientPhotoUrl!.isEmpty)
                ? const Icon(Icons.person, size: 30)
                : null,
          ),
          const SizedBox(height: 8),
          // --- End of modification ---
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              _actualRecipientName.isNotEmpty
                  ? _actualRecipientName
                  : widget.recipientName,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ),
          Expanded(
            child: StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('chats')
                  .doc(_threadId!)
                  .collection('messages')
                  .orderBy('timestamp', descending: true)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(child: Text("Error: ${snapshot.error}"));
                }
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (!snapshot.hasData || snapshot.data!.docs.isEmpty) {
                  return const Center(child: Text('Start the conversation!'));
                }
                final messages = snapshot.data!.docs;
                return ListView.builder(
                  controller: _scrollController,
                  reverse: true,
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = Message.fromFirestore(messages[index]);
                    final isMe = message.senderId == _currentUserId;
                    return _buildMessageBubble(message, isMe);
                  },
                );
              },
            ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Message message, bool isMe) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75),
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
            decoration: BoxDecoration(
              color: isMe ? Colors.indigo : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment:
                  isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                Text(
                  message.text,
                  style: TextStyle(color: isMe ? Colors.white : Colors.black87),
                ),
                const SizedBox(height: 4),
                if (message.timestamp != null)
                  Text(
                    DateFormat.jm().format(message.timestamp!),
                    style: TextStyle(
                      fontSize: 10,
                      color: isMe ? Colors.white70 : Colors.black54,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        boxShadow: [
          BoxShadow(
            offset: const Offset(0, -1),
            blurRadius: 4,
            // ignore: deprecated_member_use
            color: Colors.black.withOpacity(0.05),
          )
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  filled: true,
                  fillColor: Colors.grey.shade200,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              decoration: BoxDecoration(
                color: Colors.indigo,
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: const Icon(Icons.send, color: Colors.white),
                onPressed: _sendMessage,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
