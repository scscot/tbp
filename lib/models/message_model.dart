// lib/models/message_model.dart

import 'package:cloud_firestore/cloud_firestore.dart';

class Message {
  final String text;
  final String senderId;
  // The timestamp can be temporarily null during server-side generation.
  final DateTime? timestamp;

  Message({
    required this.text,
    required this.senderId,
    this.timestamp,
  });

  // Converts a Firestore DocumentSnapshot into a Message object.
  factory Message.fromFirestore(DocumentSnapshot doc) {
    Map<String, dynamic> data = doc.data() as Map<String, dynamic>;
    return Message(
      text: data['text'] ?? '',
      senderId: data['senderId'] ?? '',
      // Handle the case where the timestamp is null.
      timestamp: data['timestamp'] != null
          ? (data['timestamp'] as Timestamp).toDate()
          : null,
    );
  }

  // --- NEW METHOD ---
  // Converts a Message object into a Map for storing in Firestore.
  // This resolves the "undefined_method 'toMap'" error.
  Map<String, dynamic> toMap() {
    return {
      'text': text,
      'senderId': senderId,
      // This sends the special server timestamp token to Firestore.
      'timestamp': FieldValue.serverTimestamp(),
    };
  }
  // --- END OF NEW METHOD ---
}
