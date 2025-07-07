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

    // --- MODIFICATION: Fetch the recipient's user data to get their photo ---
    try {
      final recipientDoc = await FirebaseFirestore.instance
          .collection('users')
          .doc(widget.recipientId)
          .get();
      if (mounted && recipientDoc.exists) {
        setState(() {
          _recipientPhotoUrl = recipientDoc.data()?['photoUrl'];
        });
      }
    } catch (e) {
      debugPrint("Error fetching recipient's profile: $e");
    }
    // --- End of modification ---

    final ids = [_currentUserId!, widget.recipientId];
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
    _controller.clear();

    final chatDocRef =
        FirebaseFirestore.instance.collection('chats').doc(_threadId!);

    chatDocRef.collection('messages').add({
      'text': textToSend,
      'senderId': _currentUserId!,
      'timestamp': FieldValue.serverTimestamp(),
    });

    chatDocRef.update({
      'lastMessage': textToSend,
      'lastMessageTimestamp': FieldValue.serverTimestamp(),
      'isRead': {_currentUserId!: true, widget.recipientId: false}
    });

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

  @override
  Widget build(BuildContext context) {
    if (!_isThreadReady) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: Column(
        children: [
          // --- MODIFICATION: Added CircleAvatar for the recipient's photo ---
          const SizedBox(height: 16),
          CircleAvatar(
            radius: 40,
            backgroundImage:
                _recipientPhotoUrl != null && _recipientPhotoUrl!.isNotEmpty
                    ? NetworkImage(_recipientPhotoUrl!)
                    : null,
            child: (_recipientPhotoUrl == null || _recipientPhotoUrl!.isEmpty)
                ? const Icon(Icons.person, size: 40)
                : null,
          ),
          const SizedBox(height: 8),
          // --- End of modification ---
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Text(
              widget.recipientName,
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
