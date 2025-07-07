// lib/services/firestore_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../models/message_model.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

// In lib/services/firestore_service.dart

  Future<UserModel?> getUser(String uid) async {
    // --- START OF FINAL DEBUGGING CODE ---
    debugPrint("--- [SERVICE] Attempting to get user: $uid ---");
    try {
      final doc = await _db.collection('users').doc(uid).get();
      debugPrint("--- [SERVICE] Firestore document get completed ---");

      if (doc.exists) {
        debugPrint(
            "--- [SERVICE] Document for $uid exists. Attempting to parse... ---");
        final user = UserModel.fromFirestore(doc);
        debugPrint(
            "--- [SERVICE] Successfully parsed user: ${user.firstName} ---");
        return user;
      } else {
        debugPrint("--- [SERVICE] Document for $uid does NOT exist. ---");
        return null;
      }
    } catch (e, s) {
      debugPrint("--- [SERVICE] !!! CATCH BLOCK EXECUTED IN GETUSER !!! ---");
      debugPrint("--- [SERVICE] Raw Error: $e");
      debugPrint("--- [SERVICE] Stack Trace: $s");
      rethrow; // Re-throw the error so the UI knows about it.
    }
    // --- END OF FINAL DEBUGGING CODE ---
  }

  // MODIFIED: This is the definitive, robust implementation.
  Future<void> updateUser(String uid, Map<String, dynamic> data) async {
    try {
      debugPrint("FirestoreService: Updating user $uid with data: $data");
      await _db.collection('users').doc(uid).set(data, SetOptions(merge: true));
      debugPrint("FirestoreService: Update for $uid successful.");
    } catch (e) {
      debugPrint("FirestoreService: Error updating user $uid: $e");
      // Re-throw the exception so the UI can catch it.
      rethrow;
    }
  }

  Future<void> sendMessage({
    required String threadId,
    required String senderId,
    required String text,
  }) async {
    try {
      final message = Message(
        senderId: senderId,
        text: text,
        timestamp: DateTime.now(),
      );
      await _db
          .collection('chats')
          .doc(threadId)
          .collection('messages')
          .add(message.toMap());

      await _db.collection('chats').doc(threadId).set({
        'lastMessage': text,
        'lastMessageTimestamp': FieldValue.serverTimestamp(),
        'participants': threadId.split('_'),
      }, SetOptions(merge: true));
    } catch (e) {
      debugPrint('Error sending message: $e');
    }
  }
}
