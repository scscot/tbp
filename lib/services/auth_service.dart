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
        return Stream.value(null);
      } else {
        return _firestore
            .collection('users')
            .doc(firebaseUser.uid)
            .snapshots()
            .map((snapshot) =>
                snapshot.exists ? UserModel.fromFirestore(snapshot) : null);
      }
    });
  }

  // --- FIX: The adminSettings stream was missing. It is now restored. ---
  Stream<AdminSettingsModel?> get adminSettings {
    return user.switchMap((currentUser) {
      if (currentUser != null && currentUser.role == 'admin') {
        return _firestore
            .collection('admin_settings')
            .doc(currentUser.uid)
            .snapshots()
            .map((snapshot) => snapshot.exists
                ? AdminSettingsModel.fromFirestore(snapshot)
                : null);
      } else {
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
    return await _firebaseAuth.signInWithCredential(credential);
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
        print('AuthService: Error clearing FCM token: $e');
      }
    }
    await _googleSignIn.signOut();
    await _firebaseAuth.signOut();
  }

  Future<void> sendPasswordResetEmail(String email) async {
    return await _firebaseAuth.sendPasswordResetEmail(email: email);
  }
}
