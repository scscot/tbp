// lib/services/auth_service.dart

import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:rxdart/rxdart.dart';
import 'package:cloud_functions/cloud_functions.dart';
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

  /// Check if user needs to be routed to subscription screen
  /// Returns true if user should be shown subscription screen
  Future<bool> shouldShowSubscriptionScreen(UserModel user) async {
    try {
      debugPrint('🔐 AUTH_SERVICE: Checking subscription status for user ${user.uid}');
      debugPrint('🔐 AUTH_SERVICE: User subscription status: ${user.subscriptionStatus}');
      debugPrint('🔐 AUTH_SERVICE: User trial start date: ${user.trialStartDate}');
      debugPrint('🔐 AUTH_SERVICE: User is trial valid: ${user.isTrialValid}');
      
      // First check local user model for quick assessment
      final localCheck = _checkLocalSubscriptionStatus(user);
      debugPrint('🔐 AUTH_SERVICE: Local subscription check - needs subscription: $localCheck');
      
      // If local check suggests subscription is needed, verify with cloud function
      if (localCheck) {
        debugPrint('🔐 AUTH_SERVICE: Local check suggests subscription needed, verifying with cloud function...');
        return await _verifySubscriptionStatusViaFunction();
      }
      
      debugPrint('🔐 AUTH_SERVICE: Local check passed, no subscription screen needed');
      return false;
      
    } catch (e) {
      debugPrint('❌ AUTH_SERVICE: Error checking subscription status: $e');
      // Fail-safe: if we can't check, don't block access but log the issue
      return false;
    }
  }

  /// Local subscription status check using UserModel data
  bool _checkLocalSubscriptionStatus(UserModel user) {
    // Check subscription status from user model
    final subscriptionStatus = user.subscriptionStatus;
    
    // If status is active, no need for subscription screen
    if (subscriptionStatus == 'active') {
      return false;
    }
    
    // If status is trial, check if trial is still valid
    if (subscriptionStatus == 'trial') {
      return !user.isTrialValid;
    }
    
    // For cancelled, expired, or any other status, show subscription screen
    return true;
  }

  /// Verify subscription status via cloud function for authoritative check
  Future<bool> _verifySubscriptionStatusViaFunction() async {
    try {
      debugPrint('🔐 AUTH_SERVICE: Verifying subscription via cloud function');
      
      final HttpsCallable callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('checkUserSubscriptionStatus');
      
      debugPrint('🔐 AUTH_SERVICE: Calling cloud function...');
      final result = await callable.call().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('❌ AUTH_SERVICE: Cloud function call timed out after 10 seconds');
          throw TimeoutException('Cloud function call timed out', const Duration(seconds: 10));
        },
      );
      
      debugPrint('🔐 AUTH_SERVICE: Cloud function call completed');
      final data = result.data;
      
      final isActive = data['isActive'] as bool? ?? false;
      final isTrialValid = data['isTrialValid'] as bool? ?? false;
      
      debugPrint('🔐 AUTH_SERVICE: Cloud Function check - Active: $isActive, Trial Valid: $isTrialValid');
      
      // Show subscription screen if neither active subscription nor valid trial
      final needsSubscription = !isActive && !isTrialValid;
      debugPrint('🔐 AUTH_SERVICE: User needs subscription screen: $needsSubscription');
      
      return needsSubscription;
      
    } catch (e) {
      debugPrint('❌ AUTH_SERVICE: Error checking subscription via Cloud Function: $e');
      // On error, be conservative - allow access but log the issue
      debugPrint('🔐 AUTH_SERVICE: Allowing access due to cloud function error');
      return false;
    }
  }

  /// Check subscription status when app resumes (called from app lifecycle)
  Future<bool> checkSubscriptionOnAppResume() async {
    try {
      final firebaseUser = _firebaseAuth.currentUser;
      if (firebaseUser == null) return false;
      
      debugPrint('🔐 AUTH_SERVICE: Checking subscription on app resume for user ${firebaseUser.uid}');
      
      // Get current user data
      final userDoc = await _firestore.collection('users').doc(firebaseUser.uid).get();
      if (!userDoc.exists) return false;
      
      final user = UserModel.fromFirestore(userDoc);
      return await shouldShowSubscriptionScreen(user);
      
    } catch (e) {
      debugPrint('❌ AUTH_SERVICE: Error checking subscription on app resume: $e');
      return false;
    }
  }
}
