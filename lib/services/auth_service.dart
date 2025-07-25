// lib/services/auth_service.dart

import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:rxdart/rxdart.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart'; // Import the new model
import 'fcm_service.dart';

class AuthService {
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn();

  Stream<UserModel?> get user {
    return _firebaseAuth.authStateChanges().switchMap((firebaseUser) {
      if (firebaseUser == null) {
        debugPrint('🔐 AUTH_SERVICE: No Firebase user, returning null');
        return Stream.value(null);
      } else {
        debugPrint('🔐 AUTH_SERVICE: Firebase user found: ${firebaseUser.uid}, fetching user data from Firestore');
        return _firestore
            .collection('users')
            .doc(firebaseUser.uid)
            .snapshots()
            .map((snapshot) {
              if (snapshot.exists) {
                debugPrint('🔐 AUTH_SERVICE: User document exists, creating UserModel');
                final userModel = UserModel.fromFirestore(snapshot);
                debugPrint('🔐 AUTH_SERVICE: UserModel created - uid: ${userModel.uid}, role: ${userModel.role}, firstName: ${userModel.firstName}');
                return userModel;
              } else {
                debugPrint('🔐 AUTH_SERVICE: User document does not exist for uid: ${firebaseUser.uid}');
                return null;
              }
            });
      }
    });
  }

  // --- FIX: The adminSettings stream was missing. It is now restored. ---
  Stream<AdminSettingsModel?> get adminSettings {
    return user.switchMap((currentUser) {
      debugPrint(
          '🔧 AUTH_SERVICE: adminSettings stream - currentUser: ${currentUser?.uid}, role: ${currentUser?.role}');

      if (currentUser != null && currentUser.role == 'admin') {
        debugPrint(
            '🔧 AUTH_SERVICE: Admin user detected, fetching admin settings for: ${currentUser.uid}');

        return _firestore
            .collection('admin_settings')
            .doc(currentUser.uid)
            .snapshots()
            .map((snapshot) {
          debugPrint(
              '🔧 AUTH_SERVICE: Admin settings snapshot - exists: ${snapshot.exists}');
          if (snapshot.exists) {
            debugPrint(
                '🔧 AUTH_SERVICE: Admin settings data: ${snapshot.data()}');
            return AdminSettingsModel.fromFirestore(snapshot);
          } else {
            debugPrint(
                '🔧 AUTH_SERVICE: Admin settings document does not exist for user: ${currentUser.uid}');
            return null;
          }
        });
      } else {
        debugPrint(
            '🔧 AUTH_SERVICE: Not an admin user (role: ${currentUser?.role}), returning null admin settings');
        return Stream.value(null);
      }
    });
  }

  Future<UserCredential> signInWithEmailAndPassword(
      String email, String password) async {
    return await _firebaseAuth.signInWithEmailAndPassword(
        email: email, password: password);
  }

  Future<UserCredential> signInWithCredential(AuthCredential credential) async {
    if (kDebugMode) {
      debugPrint("🔥 DEBUG: AuthService.signInWithCredential called");
    }
    if (kDebugMode) {
      debugPrint("🔥 DEBUG: Credential provider: ${credential.providerId}");
    }
    try {
      final result = await _firebaseAuth.signInWithCredential(credential);
      debugPrint("🔥 DEBUG: Firebase Auth successful for user: ${result.user?.uid}");
      return result;
    } catch (e) {
      debugPrint("🔥 DEBUG: Firebase Auth failed: $e");
      rethrow;
    }
  }

  // This is correct. The service should only handle auth logic, not UI logic.
  Future<void> signOut() async {
    try {
      final user = _firebaseAuth.currentUser;
      if (user != null) {
        await FCMService().clearFCMToken(user.uid);
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('AuthService: Error clearing FCM token: $e');
      }
    }
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
  }

  Future<void> sendPasswordResetEmail(String email) async {
    return await _firebaseAuth.sendPasswordResetEmail(email: email);
  }
}
