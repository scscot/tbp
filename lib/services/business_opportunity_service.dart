// lib/services/business_opportunity_service.dart

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';

class BizOppResult {
  final String? bizOppRefUrl;
  final String? sponsorName;
  final String? sponsorUid;

  BizOppResult({
    this.bizOppRefUrl,
    this.sponsorName,
    this.sponsorUid,
  });

  Map<String, String?> toMap() {
    return {
      'bizOppRefUrl': bizOppRefUrl,
      'sponsorName': sponsorName,
      'sponsorUid': sponsorUid,
    };
  }
}

class BusinessOpportunityService {
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  /// Find the first upline member with a valid business opportunity referral URL
  ///
  /// Traverses the upline chain in reverse order (closest to furthest sponsor)
  /// and returns the first person with a valid biz_opp_ref_url and active subscription.
  ///
  /// [uplineRefs] - Array of Firebase UIDs representing the user's upline chain
  /// Structure: [furthest_upline, ..., direct_sponsor]
  ///
  /// Returns [BizOppResult] with referral URL and sponsor information, or nulls if none found
  static Future<BizOppResult> findUplineReferralInfo(List<String> uplineRefs) async {
    try {
      // Traverse upline_refs in REVERSE order (UP the upline: closest to furthest)
      // uplineRefs structure: [furthest_upline, ..., direct_sponsor]
      // So we traverse from last index (direct_sponsor) to index 0 (furthest_upline)
      for (int i = uplineRefs.length - 1; i >= 0; i--) {
        final uplineUid = uplineRefs[i];
        debugPrint('🔍 BIZ_OPP_SERVICE: Checking upline user at index $i: $uplineUid');

        final uplineUserDoc = await _firestore
            .collection('users')
            .doc(uplineUid)
            .get();

        if (uplineUserDoc.exists) {
          final uplineUserData = uplineUserDoc.data();
          final bizOppRefUrl = uplineUserData?['biz_opp_ref_url'] as String?;
          final subscriptionStatus = uplineUserData?['subscriptionStatus'] as String?;
          final validStatuses = ['active', 'trial'];

          if (bizOppRefUrl != null &&
              bizOppRefUrl.isNotEmpty &&
              validStatuses.contains(subscriptionStatus)) {
            debugPrint('✅ BIZ_OPP_SERVICE: Found biz_opp_ref_url in upline user at index $i: $uplineUid');

            // Get sponsor name from the same user
            final firstName = uplineUserData?['firstName'] as String? ?? '';
            final lastName = uplineUserData?['lastName'] as String? ?? '';
            final sponsorName = '$firstName $lastName'.trim();

            return BizOppResult(
              bizOppRefUrl: bizOppRefUrl,
              sponsorName: sponsorName.isNotEmpty ? sponsorName : null,
              sponsorUid: uplineUid,
            );
          } else {
            debugPrint('❌ BIZ_OPP_SERVICE: No biz_opp_ref_url found for upline user at index $i: $uplineUid');
          }
        } else {
          debugPrint('❌ BIZ_OPP_SERVICE: Upline user document does not exist at index $i: $uplineUid');
        }
      }

      debugPrint('🚫 BIZ_OPP_SERVICE: No biz_opp_ref_url found in entire upline chain');
      return BizOppResult(
        bizOppRefUrl: null,
        sponsorName: null,
        sponsorUid: null,
      );
    } catch (e) {
      debugPrint('💥 BIZ_OPP_SERVICE: Error traversing upline refs: $e');
      return BizOppResult(
        bizOppRefUrl: null,
        sponsorName: null,
        sponsorUid: null,
      );
    }
  }

  /// Find the direct sponsor (last person in upline_refs array)
  ///
  /// [uplineRefs] - Array of Firebase UIDs representing the user's upline chain
  /// Returns the UID of the direct sponsor, or null if no upline exists
  static String? findDirectSponsor(List<String> uplineRefs) {
    if (uplineRefs.isEmpty) return null;
    return uplineRefs.last;
  }

  /// Validate if a business opportunity referral URL is properly formatted
  ///
  /// [url] - The URL to validate
  /// Returns true if URL format is valid, false otherwise
  static bool isValidReferralUrl(String? url) {
    if (url == null || url.isEmpty) return false;

    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && uri.hasAuthority;
    } catch (e) {
      return false;
    }
  }

  /// Fetch specific sponsor's information by UID (for locked-in sponsors)
  ///
  /// [sponsorUid] - The Firebase UID of the locked-in business opportunity sponsor
  /// Returns [BizOppResult] with referral URL and sponsor information, or nulls if not found
  static Future<BizOppResult> getLockedInSponsorInfo(String sponsorUid) async {
    try {
      debugPrint('🔒 BIZ_OPP_SERVICE: Fetching locked-in sponsor info for: $sponsorUid');

      final sponsorDoc = await _firestore
          .collection('users')
          .doc(sponsorUid)
          .get();

      if (sponsorDoc.exists) {
        final sponsorData = sponsorDoc.data();
        final bizOppRefUrl = sponsorData?['biz_opp_ref_url'] as String?;

        if (bizOppRefUrl != null && bizOppRefUrl.isNotEmpty) {
          final firstName = sponsorData?['firstName'] as String? ?? '';
          final lastName = sponsorData?['lastName'] as String? ?? '';
          final sponsorName = '$firstName $lastName'.trim();

          debugPrint('✅ BIZ_OPP_SERVICE: Locked-in sponsor found: $sponsorName');

          return BizOppResult(
            bizOppRefUrl: bizOppRefUrl,
            sponsorName: sponsorName.isNotEmpty ? sponsorName : null,
            sponsorUid: sponsorUid,
          );
        } else {
          debugPrint('⚠️ BIZ_OPP_SERVICE: Locked-in sponsor has no biz_opp_ref_url');
        }
      } else {
        debugPrint('❌ BIZ_OPP_SERVICE: Locked-in sponsor document does not exist: $sponsorUid');
      }

      return BizOppResult(
        bizOppRefUrl: null,
        sponsorName: null,
        sponsorUid: null,
      );
    } catch (e) {
      debugPrint('💥 BIZ_OPP_SERVICE: Error fetching locked-in sponsor info: $e');
      return BizOppResult(
        bizOppRefUrl: null,
        sponsorName: null,
        sponsorUid: null,
      );
    }
  }
}