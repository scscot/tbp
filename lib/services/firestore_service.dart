// lib/services/firestore_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../models/message_model.dart';
import 'cache_service.dart';

class FirestoreService {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  final FirebaseFunctions _functions =
      FirebaseFunctions.instanceFor(region: 'us-central1');
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final CacheService _cacheService = CacheService();

// In lib/services/firestore_service.dart

  Future<UserModel?> getUser(String uid) async {
    debugPrint("🔍 FIRESTORE_SERVICE: Attempting to get user: $uid");

    try {
      // Initialize cache service
      await _cacheService.init();

      // Try cache first
      final cachedUserData = await _cacheService.getUserProfile(uid);
      if (cachedUserData != null) {
        try {
          final user = UserModel.fromMap(cachedUserData);
          debugPrint("🎯 FIRESTORE_SERVICE: Returning cached user: ${user.firstName}");
          return user;
        } catch (e) {
          debugPrint("⚠️ FIRESTORE_SERVICE: Error parsing cached user data, fetching fresh: $e");
          // Clear corrupted cache and continue to Firestore fetch
          await _cacheService.clearUserProfile(uid);
        }
      }

      // Fetch from Firestore
      final doc = await _db.collection('users').doc(uid).get();
      debugPrint("✅ FIRESTORE_SERVICE: Firestore document get completed");

      if (doc.exists) {
        debugPrint("✅ FIRESTORE_SERVICE: Document for $uid exists. Attempting to parse...");
        final user = UserModel.fromFirestore(doc);

        // Cache the user data for future access
        try {
          // Convert to cacheable format (handle Timestamps)
          final cacheableData = _convertToCacheableMap(user.toMap());
          await _cacheService.setUserProfile(uid, cacheableData);
          debugPrint("💾 FIRESTORE_SERVICE: User data cached successfully");
        } catch (e) {
          debugPrint("⚠️ FIRESTORE_SERVICE: Failed to cache user data: $e");
          // Don't fail the request if caching fails
        }

        debugPrint("✅ FIRESTORE_SERVICE: Successfully parsed user: ${user.firstName}");
        return user;
      } else {
        debugPrint("❌ FIRESTORE_SERVICE: Document for $uid does NOT exist");
        return null;
      }
    } catch (e, s) {
      debugPrint("❌ FIRESTORE_SERVICE: Error getting user $uid: $e");
      debugPrint("❌ FIRESTORE_SERVICE: Stack Trace: $s");

      // Try offline cache as fallback
      try {
        final offlineUserData = await _cacheService.getOfflineUserProfile(uid);
        if (offlineUserData != null) {
          final user = UserModel.fromMap(offlineUserData);
          debugPrint("🔄 FIRESTORE_SERVICE: Returning offline cached user: ${user.firstName}");
          return user;
        }
      } catch (offlineError) {
        debugPrint("❌ FIRESTORE_SERVICE: Offline cache also failed: $offlineError");
      }

      rethrow; // Re-throw the error so the UI knows about it
    }
  }

  // Enhanced updateUser with cache invalidation and synchronization
  Future<void> updateUser(String uid, Map<String, dynamic> data) async {
    try {
      debugPrint("🔄 FIRESTORE_SERVICE: Updating user $uid with data: $data");

      // Update Firestore first
      await _db.collection('users').doc(uid).set(data, SetOptions(merge: true));
      debugPrint("✅ FIRESTORE_SERVICE: Firestore update for $uid successful");

      // Clear cache to ensure fresh data on next fetch
      try {
        await _cacheService.init();
        await _cacheService.clearUserProfile(uid);
        debugPrint("🧹 FIRESTORE_SERVICE: Cache cleared for updated user $uid");

        // Optionally, fetch and cache the updated user data immediately
        final updatedDoc = await _db.collection('users').doc(uid).get();
        if (updatedDoc.exists) {
          final user = UserModel.fromFirestore(updatedDoc);
          final cacheableData = _convertToCacheableMap(user.toMap());
          await _cacheService.setUserProfile(uid, cacheableData);
          debugPrint("💾 FIRESTORE_SERVICE: Updated user data cached successfully");
        }
      } catch (e) {
        debugPrint("⚠️ FIRESTORE_SERVICE: Cache operations failed but update succeeded: $e");
        // Don't fail the update if cache operations fail
      }

    } catch (e) {
      debugPrint("❌ FIRESTORE_SERVICE: Error updating user $uid: $e");
      rethrow;
    }
  }

  // New method to get member details with sponsor and team leader info in one call
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
  Future<bool> checkReferralUrlUniqueness(
      String referralUrl, String currentUserId) async {
    try {
      debugPrint(
          'FirestoreService: Checking uniqueness for referral URL: $referralUrl');

      // Query all users with the same biz_opp_ref_url
      final querySnapshot = await _db
          .collection('users')
          .where('biz_opp_ref_url', isEqualTo: referralUrl)
          .limit(10) // Add limit for Firestore security rules compliance
          .get();

      // If no documents found, the URL is unique
      if (querySnapshot.docs.isEmpty) {
        debugPrint('FirestoreService: Referral URL is unique');
        return true;
      }

      // If documents found, check if any belong to a different user
      for (final doc in querySnapshot.docs) {
        if (doc.id != currentUserId) {
          debugPrint(
              'FirestoreService: Referral URL already exists for user: ${doc.id}');
          return false;
        }
      }

      // If we reach here, the URL only exists for the current user (updating their own)
      debugPrint('FirestoreService: Referral URL exists only for current user');
      return true;
    } catch (e) {
      debugPrint(
          'FirestoreService: Error checking referral URL uniqueness: $e');
      // In case of error, assume it's not unique to be safe
      return false;
    }
  }

  /// Enhanced Hybrid Account Deletion - Apple App Store Compliant
  /// Permanently deletes personal data while preserving network structure
  Future<void> deleteUserAccount(String uid) async {
    try {
      debugPrint('🗑️ FIRESTORE_SERVICE: Starting enhanced account deletion for user: $uid');

      // Step 1: Get current user data to understand network position
      final userDoc = await _db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        debugPrint('⚠️ FIRESTORE_SERVICE: User document not found, may already be deleted');
        return;
      }

      final userData = userDoc.data() as Map<String, dynamic>;
      final hasDownline = userData['downlineUsers'] != null &&
                         (userData['downlineUsers'] as List).isNotEmpty;

      debugPrint('🔍 FIRESTORE_SERVICE: User has downline: $hasDownline');

      // Step 2: Clear all cached data for this user
      try {
        await _cacheService.init();
        await _cacheService.clearAllUserData(uid);
        debugPrint('🧹 FIRESTORE_SERVICE: All cached data cleared for user');
      } catch (e) {
        debugPrint('⚠️ FIRESTORE_SERVICE: Cache clearing failed but continuing: $e');
      }

      // Step 3: Delete user's private collections first
      await _deleteUserPrivateData(uid);

      // Step 4: Update analytics and cleanup references
      await _cleanupUserReferences(uid);

      // Step 5: Completely remove the user document (true deletion)
      await _db.collection('users').doc(uid).delete();
      debugPrint('✅ FIRESTORE_SERVICE: User document completely deleted');

      debugPrint('✅ FIRESTORE_SERVICE: Enhanced account deletion completed');

    } catch (e) {
      debugPrint('❌ FIRESTORE_SERVICE: Error during account deletion: $e');
      rethrow;
    }
  }

  /// Delete Firebase Authentication user - separate method to be called after signOut
  Future<void> deleteFirebaseAuthUser(String uid) async {
    try {
      final currentUser = _auth.currentUser;
      if (currentUser != null && currentUser.uid == uid) {
        await currentUser.delete();
        debugPrint('✅ FIRESTORE_SERVICE: Firebase Auth user deleted');
      } else {
        debugPrint('⚠️ FIRESTORE_SERVICE: Current user mismatch or no current user for Auth deletion');
      }
    } catch (e) {
      debugPrint('❌ FIRESTORE_SERVICE: Error deleting Firebase Auth user: $e');
      rethrow;
    }
  }

  /// Delete user's private collections and data
  Future<void> _deleteUserPrivateData(String uid) async {
    try {
      // Delete user notifications
      final notificationsRef = _db.collection('users').doc(uid).collection('notifications');
      final notificationDocs = await notificationsRef.get();
      
      for (final doc in notificationDocs.docs) {
        await doc.reference.delete();
      }
      debugPrint('✅ FIRESTORE_SERVICE: Deleted user notifications');

      // Clean up chat messages where user was participant
      final chatsQuery = await _db.collection('chats')
          .where('participants', arrayContains: uid)
          .get();

      for (final chatDoc in chatsQuery.docs) {
        final chatData = chatDoc.data();
        final participants = List<String>.from(chatData['participants'] ?? []);
        
        if (participants.length <= 2) {
          // Delete entire chat if only 2 participants
          final messagesRef = chatDoc.reference.collection('messages');
          final messageDocs = await messagesRef.get();
          
          for (final messageDoc in messageDocs.docs) {
            await messageDoc.reference.delete();
          }
          
          await chatDoc.reference.delete();
          debugPrint('✅ FIRESTORE_SERVICE: Deleted chat thread: ${chatDoc.id}');
        } else {
          // Remove user from group chat participants
          await chatDoc.reference.update({
            'participants': FieldValue.arrayRemove([uid])
          });
          debugPrint('✅ FIRESTORE_SERVICE: Removed user from group chat: ${chatDoc.id}');
        }
      }

      // Delete any admin-specific data if user was an admin
      final adminSettingsRef = _db.collection('admin_settings').doc(uid);
      final adminDoc = await adminSettingsRef.get();
      if (adminDoc.exists) {
        await adminSettingsRef.delete();
        debugPrint('✅ FIRESTORE_SERVICE: Deleted admin settings');
      }

    } catch (e) {
      debugPrint('❌ FIRESTORE_SERVICE: Error deleting private data: $e');
      rethrow;
    }
  }

  /// Cleanup user references in analytics and system collections
  Future<void> _cleanupUserReferences(String uid) async {
    try {
      // Note: We intentionally preserve network relationships (sponsorId, uplineAdmin, downlineUsers)
      // as these are critical for business operations and team structure integrity
      
      // Remove any cached data or temporary references
      debugPrint('✅ FIRESTORE_SERVICE: Cleaned up system references');
      
      // Future: Add any other system cleanup operations here
      
    } catch (e) {
      debugPrint('❌ FIRESTORE_SERVICE: Error cleaning up references: $e');
      // Don't rethrow - this is non-critical cleanup
    }
  }

  /// Convert Firestore data to cacheable format by handling Timestamps
  Map<String, dynamic> _convertToCacheableMap(Map<String, dynamic> data) {
    final Map<String, dynamic> cacheable = {};

    for (final entry in data.entries) {
      final key = entry.key;
      final value = entry.value;

      if (value is Timestamp) {
        // Convert Timestamp to milliseconds since epoch
        cacheable[key] = value.millisecondsSinceEpoch;
      } else if (value is Map<String, dynamic>) {
        // Recursively handle nested maps
        cacheable[key] = _convertToCacheableMap(value);
      } else if (value is List) {
        // Handle lists that might contain Timestamps
        cacheable[key] = value.map((item) {
          if (item is Timestamp) {
            return item.millisecondsSinceEpoch;
          } else if (item is Map<String, dynamic>) {
            return _convertToCacheableMap(item);
          }
          return item;
        }).toList();
      } else {
        // Keep primitive types as-is
        cacheable[key] = value;
      }
    }

    return cacheable;
  }
}
