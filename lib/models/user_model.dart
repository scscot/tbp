import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class UserModel {
  final String uid;
  final String? email;
  final String? firstName;
  final String? lastName;
  final String? country;
  final String? state;
  final String? city;
  final String? referralCode;
  final String? referredBy;
  final String? adminReferral;
  final String? photoUrl;
  final DateTime? createdAt;
  final DateTime? joined;
  final int level;
  final DateTime? qualifiedDate;
  final List<String> uplineRefs;
  final int directSponsorCount;
  final int totalTeamCount;
  final String? bizOppRefUrl;
  final String? bizOpp;
  final String? role;
  final DateTime? bizVisitDate;
  final String? sponsorId;
  final String? uplineAdmin;
  // --- MODIFICATION: Added field for business opportunity join date ---
  final DateTime? bizJoinDate;
  
  // --- PHASE 1: Apple Store Subscription Fields ---
  final String subscriptionStatus; // 'trial', 'active', 'cancelled', 'expired'
  final DateTime? subscriptionExpiry;
  final DateTime? trialStartDate;
  final DateTime? subscriptionUpdated;

  UserModel({
    required this.uid,
    this.sponsorId,
    this.email,
    this.firstName,
    this.lastName,
    this.country,
    this.state,
    this.city,
    this.referralCode,
    this.referredBy,
    this.adminReferral,
    this.photoUrl,
    this.createdAt,
    this.joined,
    this.level = 1,
    this.qualifiedDate,
    required this.uplineRefs,
    this.directSponsorCount = 0,
    this.totalTeamCount = 0,
    this.bizOppRefUrl,
    this.bizOpp,
    this.role,
    this.uplineAdmin,
    this.bizVisitDate,
    // --- MODIFICATION: Added to constructor ---
    this.bizJoinDate,
    // --- PHASE 1: Apple Store Subscription Fields ---
    this.subscriptionStatus = 'trial',
    this.subscriptionExpiry,
    this.trialStartDate,
    this.subscriptionUpdated,
  });

  factory UserModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return UserModel.fromMap(data..['uid'] = doc.id);
  }

  static Future<UserModel> fromFirestoreWithBizOpp(DocumentSnapshot doc) async {
    final data = doc.data() as Map<String, dynamic>;
    data['uid'] = doc.id;
    
    // Fetch biz_opp from admin_settings if upline_admin exists
    final uplineAdmin = data['upline_admin'] as String?;
    if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
      try {
        final adminSettingsDoc = await FirebaseFirestore.instance
            .collection('admin_settings')
            .doc(uplineAdmin)
            .get();
            
        if (adminSettingsDoc.exists) {
          final adminData = adminSettingsDoc.data();
          final bizOpp = adminData?['biz_opp'] as String?;
          if (bizOpp != null && bizOpp.isNotEmpty) {
            data['biz_opp'] = bizOpp;
          }
        }
      } catch (e) {
        // If there's an error fetching admin settings, continue with existing data
        debugPrint('Error fetching biz_opp from admin_settings: $e');
      }
    }
    
    return UserModel.fromMap(data);
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    DateTime? parseDate(dynamic dateValue) {
      if (dateValue == null) return null;
      if (dateValue is Timestamp) return dateValue.toDate();
      if (dateValue is String) return DateTime.tryParse(dateValue);
      return null;
    }

    // Safely parse the upline_refs list.
    final dynamic uplineRefsRaw = map['upline_refs'];
    final List<String> uplineRefsSafe = (uplineRefsRaw is List)
        ? List<String>.from(uplineRefsRaw.map((item) => item.toString()))
        : <String>[];

    return UserModel(
      uid: map['uid'] ?? '',
      email: map['email'],
      firstName: map['firstName'],
      lastName: map['lastName'],
      country: map['country'],
      sponsorId: map['sponsor_id'],
      state: map['state'],
      city: map['city'],
      referralCode: map['referralCode'],
      referredBy: map['referredBy'],
      adminReferral: map['adminReferral'],
      photoUrl: map['photoUrl'],
      createdAt: parseDate(map['createdAt'] ?? map['joined']),
      joined: parseDate(map['createdAt'] ?? map['joined']),
      level: (map['level'] as num?)?.toInt() ?? 1,
      qualifiedDate: parseDate(map['qualifiedDate']),
      uplineRefs: uplineRefsSafe,
      directSponsorCount: (map['directSponsorCount'] as num?)?.toInt() ?? 0,
      totalTeamCount: (map['totalTeamCount'] as num?)?.toInt() ?? 0,
      bizOppRefUrl: map['biz_opp_ref_url'],
      bizOpp: map['biz_opp'],
      role: map['role'],
      uplineAdmin: map['upline_admin'],
      bizVisitDate: parseDate(map['biz_visit_date']),
      // --- MODIFICATION: Parse biz_join_date from the map ---
      bizJoinDate: parseDate(map['biz_join_date']),
      // --- PHASE 1: Parse subscription fields from the map ---
      subscriptionStatus: map['subscriptionStatus'] ?? 'trial',
      subscriptionExpiry: parseDate(map['subscriptionExpiry']),
      trialStartDate: parseDate(map['trialStartDate']),
      subscriptionUpdated: parseDate(map['subscriptionUpdated']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'country': country,
      'state': state,
      'city': city,
      'referralCode': referralCode,
      'referredBy': referredBy,
      'adminReferral': adminReferral,
      'photoUrl': photoUrl,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : null,
      'joined': joined != null ? Timestamp.fromDate(joined!) : null,
      'level': level,
      // --- MODIFICATION: Ensured all dates are converted to Timestamps for Firestore ---
      'qualifiedDate':
          qualifiedDate != null ? Timestamp.fromDate(qualifiedDate!) : null,
      'sponsor_id': sponsorId,
      'upline_refs': uplineRefs,
      'directSponsorCount': directSponsorCount,
      'totalTeamCount': totalTeamCount,
      'biz_opp_ref_url': bizOppRefUrl,
      'biz_opp': bizOpp,
      'role': role,
      'upline_admin': uplineAdmin,
      'biz_visit_date':
          bizVisitDate != null ? Timestamp.fromDate(bizVisitDate!) : null,
      'biz_join_date':
          bizJoinDate != null ? Timestamp.fromDate(bizJoinDate!) : null,
      // --- PHASE 1: Convert subscription fields to Firestore format ---
      'subscriptionStatus': subscriptionStatus,
      'subscriptionExpiry': subscriptionExpiry != null ? Timestamp.fromDate(subscriptionExpiry!) : null,
      'trialStartDate': trialStartDate != null ? Timestamp.fromDate(trialStartDate!) : null,
      'subscriptionUpdated': subscriptionUpdated != null ? Timestamp.fromDate(subscriptionUpdated!) : null,
    };
  }

  // --- PHASE 1: Subscription Helper Methods ---
  
  /// Returns true if the user has an active subscription or valid trial
  bool get isSubscriptionActive => 
    subscriptionStatus == 'active' || 
    (subscriptionStatus == 'trial' && isTrialValid);
    
  /// Returns true if the trial period is still valid (30 days from start)
  bool get isTrialValid {
    if (trialStartDate == null) return false;
    final daysSinceTrialStart = DateTime.now().difference(trialStartDate!).inDays;
    return daysSinceTrialStart <= 30;
  }
  
  /// Returns the number of days remaining in trial period
  int get trialDaysRemaining {
    if (trialStartDate == null) return 0;
    final daysSinceTrialStart = DateTime.now().difference(trialStartDate!).inDays;
    return (30 - daysSinceTrialStart).clamp(0, 30);
  }
  
  /// Returns true if subscription has expired
  bool get isSubscriptionExpired {
    if (subscriptionStatus == 'expired') return true;
    if (subscriptionExpiry == null) return false;
    return DateTime.now().isAfter(subscriptionExpiry!);
  }
  
  /// Returns true if user is in grace period (cancelled but still active)
  bool get isInGracePeriod {
    return subscriptionStatus == 'cancelled' && 
           subscriptionExpiry != null && 
           DateTime.now().isBefore(subscriptionExpiry!);
  }
}
