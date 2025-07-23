// lib/services/firestore_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../models/message_model.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseFunctions _functions = FirebaseFunctions.instance;

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

  // New method to get member details with sponsor and community leader info in one call
  Future<Map<String, dynamic>?> getMemberDetails(String userId) async {
    try {
      final callable = _functions.httpsCallable('getMemberDetails');
      final result = await callable.call({'memberId': userId});

      return result.data;
    } on FirebaseFunctionsException catch (e, s) {
      debugPrint('Firebase Functions Error calling getMemberDetails:');
      debugPrint('Code: ${e.code}');
      debugPrint('Message: ${e.message}');
      debugPrint('Details: ${e.details}');
      debugPrint('Stacktrace: $s');
      rethrow;
    } catch (e, s) {
      debugPrint('Error calling getMemberDetails Cloud Function: $e');
      debugPrint('Stacktrace: $s');
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

  /// Check if a referral URL is unique across all users
  /// Returns true if the URL is unique, false if it's already in use
  Future<bool> checkReferralUrlUniqueness(String referralUrl, String currentUserId) async {
    try {
      debugPrint('FirestoreService: Checking uniqueness for referral URL: $referralUrl');
      
      // Query all users with the same biz_opp_ref_url
      final querySnapshot = await _db
          .collection('users')
          .where('biz_opp_ref_url', isEqualTo: referralUrl)
          .get();

      // If no documents found, the URL is unique
      if (querySnapshot.docs.isEmpty) {
        debugPrint('FirestoreService: Referral URL is unique');
        return true;
      }

      // If documents found, check if any belong to a different user
      for (final doc in querySnapshot.docs) {
        if (doc.id != currentUserId) {
          debugPrint('FirestoreService: Referral URL already exists for user: ${doc.id}');
          return false;
        }
      }

      // If we reach here, the URL only exists for the current user (updating their own)
      debugPrint('FirestoreService: Referral URL exists only for current user');
      return true;
    } catch (e) {
      debugPrint('FirestoreService: Error checking referral URL uniqueness: $e');
      // In case of error, assume it's not unique to be safe
      return false;
    }
  }
}
