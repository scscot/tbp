import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:in_app_review/in_app_review.dart';

class ReviewService {
  static final InAppReview _inAppReview = InAppReview.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  static Future<void> checkAndPromptReview(String uid) async {
    try {
      final userDoc = await _firestore.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        debugPrint('REVIEW: User document not found for $uid');
        return;
      }

      final data = userDoc.data();
      if (data == null) return;

      final directSponsorCount = data['directSponsorCount'] ?? 0;
      final hasPromptedForReview = data['hasPromptedForReview'] ?? false;

      debugPrint(
          'REVIEW: Checking criteria - directSponsors: $directSponsorCount, hasPrompted: $hasPromptedForReview');

      if (directSponsorCount >= 2 && !hasPromptedForReview) {
        debugPrint('✅ REVIEW: User eligible for review prompt');

        await Future.delayed(const Duration(seconds: 2));

        if (await _inAppReview.isAvailable()) {
          await _inAppReview.requestReview();

          await userDoc.reference.update({
            'hasPromptedForReview': true,
            'reviewPromptedAt': FieldValue.serverTimestamp(),
          });

          debugPrint(
              '✅ REVIEW: Prompted user $uid for review ($directSponsorCount sponsors)');
        } else {
          debugPrint('⚠️ REVIEW: In-app review not available on this device');
        }
      } else {
        debugPrint(
            'REVIEW: User not eligible (sponsors: $directSponsorCount, prompted: $hasPromptedForReview)');
      }
    } catch (e) {
      debugPrint('❌ REVIEW: Error checking review prompt: $e');
    }
  }
}
