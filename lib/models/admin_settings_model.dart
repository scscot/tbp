// lib/models/admin_settings_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';

class AdminSettingsModel {
  final String uid;
  final String? bizOpp;
  final String? bizOppRefUrl;
  final bool isSubscribed;
  final bool superAdmin;

  AdminSettingsModel({
    required this.uid,
    this.bizOpp,
    this.bizOppRefUrl,
    this.isSubscribed = false,
    this.superAdmin = false,
  });

  factory AdminSettingsModel.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>? ?? {};
    return AdminSettingsModel(
      uid: doc.id,
      bizOpp: data['biz_opp'] as String?,
      bizOppRefUrl: data['biz_opp_ref_url'] as String?,
      isSubscribed: data['isSubscribed'] ?? false,
      superAdmin: data['superAdmin'] ?? false,
    );
  }
}
