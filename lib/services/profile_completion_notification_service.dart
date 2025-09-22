import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import 'admin_settings_service.dart';

class ProfileCompletionNotificationService {
  static final FirebaseFirestore _db = FirebaseFirestore.instance;
  static final AdminSettingsService _adminSettingsService = AdminSettingsService();

  static Future<void> handleProfileCompletion(UserModel user) async {
    debugPrint('🔔 PROFILE_NOTIFICATION: Handling profile completion for user ${user.uid}');
    
    try {
      await Future.wait([
        _checkAndCreateSponsorshipNotification(user),
        _checkAndCreateQualificationNotification(user),
        _checkAndCreateMilestoneNotification(user),
      ]);
    } catch (e) {
      debugPrint('❌ PROFILE_NOTIFICATION: Error handling profile completion: $e');
    }
  }

  static Future<void> _checkAndCreateSponsorshipNotification(UserModel user) async {
    try {
      if (user.referredBy == null || user.referredBy!.trim().isEmpty) {
        debugPrint('🔔 SPONSORSHIP: User ${user.uid} has no referredBy field, skipping sponsorship notification');
        return;
      }

      debugPrint('🔔 SPONSORSHIP: Looking for sponsor with referral code: ${user.referredBy}');
      
      // Find sponsor by referral code
      final sponsorQuery = await _db.collection('users')
          .where('referralCode', isEqualTo: user.referredBy!)
          .limit(1)
          .get();

      if (sponsorQuery.docs.isEmpty) {
        debugPrint('🔔 SPONSORSHIP: Sponsor with referral code ${user.referredBy} not found');
        return;
      }

      final sponsorDoc = sponsorQuery.docs.first;
      final sponsorData = sponsorDoc.data();
      final sponsorId = sponsorDoc.id;
      
      debugPrint('🔔 SPONSORSHIP: Found sponsor - ID: $sponsorId, Name: ${sponsorData['firstName']} ${sponsorData['lastName']}');

      // Get business opportunity name using AdminSettingsService
      final bizOppName = await _adminSettingsService.getBizOppName(
        sponsorData['upline_admin'] as String?,
        fallback: 'your business opportunity'
      );
      
      // Create user location string
      final userLocation = [
        user.city ?? '',
        user.state ?? '',
        user.country ?? ''
      ].where((s) => s.isNotEmpty).join(', ');

      Map<String, dynamic> notificationContent;

      // Determine notification type based on referral method
      if (user.adminReferral != null && 
          user.adminReferral!.isNotEmpty && 
          sponsorData['role'] == 'admin') {
        // Admin-to-existing-downline scenario
        debugPrint('🔔 SPONSORSHIP: Admin-to-existing-downline scenario detected');
        notificationContent = {
          'title': '🎉 You have a new team member!',
          'message': 'Congratulations, ${sponsorData['firstName']}! Your existing $bizOppName partner, ${user.firstName} ${user.lastName}, has joined you on the Team Build Pro app. You\'re now on the same system to accelerate growth and duplication! Click Here to view their profile.',
          'imageUrl': user.photoUrl,
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
          'type': 'new_member',
          'route': '/member_detail',
          'route_params': '{"userId": "${user.uid}"}',
        };
      } else {
        // Regular sponsorship scenario
        debugPrint('🔔 SPONSORSHIP: Regular sponsorship scenario detected');
        final locationText = userLocation.isNotEmpty ? ' from $userLocation' : '';
        notificationContent = {
          'title': '🎉 You have a new team member!',
          'message': 'Congratulations, ${sponsorData['firstName']}! ${user.firstName} ${user.lastName}$locationText has just joined your team on the Team Build Pro app. This is the first step in creating powerful momentum together! Click Here to view their profile.',
          'imageUrl': user.photoUrl,
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
          'type': 'new_member',
          'route': '/member_detail',
          'route_params': '{"userId": "${user.uid}"}',
        };
      }

      await _createNotification(sponsorId, notificationContent);
      debugPrint('✅ SPONSORSHIP: Created sponsorship notification for sponsor $sponsorId');
      
    } catch (e) {
      debugPrint('❌ SPONSORSHIP: Error creating sponsorship notification: $e');
    }
  }

  static Future<void> _checkAndCreateQualificationNotification(UserModel user) async {
    try {
      if (user.role == 'admin') {
        debugPrint('🔔 QUALIFICATION: User ${user.uid} is admin, skipping qualification check');
        if (user.qualifiedDate == null) {
          await _updateQualifiedDate(user.uid);
        }
        return;
      }

      if (user.qualifiedDate != null) {
        debugPrint('🔔 QUALIFICATION: User ${user.uid} already qualified, skipping');
        return;
      }

      if (user.bizJoinDate != null) {
        debugPrint('🔔 QUALIFICATION: User ${user.uid} already joined business, skipping');
        return;
      }

      final config = FirebaseRemoteConfig.instance;
      final directSponsorMin = config.getInt('projectWideDirectSponsorMin');
      final totalTeamMin = config.getInt('projectWideDataTeamMin');
      
      final actualDirectMin = directSponsorMin > 0 ? directSponsorMin : 4;
      final actualTotalMin = totalTeamMin > 0 ? totalTeamMin : 20;

      final directCount = user.directSponsorCount;
      final totalCount = user.totalTeamCount;

      if (directCount >= actualDirectMin && totalCount >= actualTotalMin) {
        debugPrint('🔔 QUALIFICATION: User ${user.uid} meets qualification criteria ($directCount/$actualDirectMin direct, $totalCount/$actualTotalMin total)');
        
        await _updateQualifiedDate(user.uid);

        final bizName = await _adminSettingsService.getBizOppName(
          user.uplineAdmin,
          fallback: 'your business opportunity'
        );
        
        final notificationContent = {
          'title': "You're Qualified!",
          'message': "Your hard work paid off, ${user.firstName}! You've built a qualified team and are now eligible to join the $bizName organization. Click Here to take the next step!",
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
          'type': 'new_qualification',
          'route': '/business',
          'route_params': '{}',
        };
        
        await _createNotification(user.uid, notificationContent);
        debugPrint('✅ QUALIFICATION: Created qualification notification for user ${user.uid}');
      } else {
        debugPrint('🔔 QUALIFICATION: User ${user.uid} does not meet criteria ($directCount/$actualDirectMin direct, $totalCount/$actualTotalMin total)');
      }
    } catch (e) {
      debugPrint('❌ QUALIFICATION: Error checking qualification for user ${user.uid}: $e');
    }
  }

  static Future<void> _checkAndCreateMilestoneNotification(UserModel user) async {
    try {
      if (user.role == 'admin') {
        debugPrint('🎯 MILESTONE: User ${user.uid} is admin, skipping milestone check');
        return;
      }

      if (user.qualifiedDate != null) {
        debugPrint('🎯 MILESTONE: User ${user.uid} already qualified, skipping milestone check');
        return;
      }

      final config = FirebaseRemoteConfig.instance;
      final directSponsorMin = config.getInt('projectWideDirectSponsorMin');
      final totalTeamMin = config.getInt('projectWideDataTeamMin');
      
      final actualDirectMin = directSponsorMin > 0 ? directSponsorMin : 4;
      final actualTotalMin = totalTeamMin > 0 ? totalTeamMin : 20;

      final directCount = user.directSponsorCount;
      final totalCount = user.totalTeamCount;

      final bizName = await _adminSettingsService.getBizOppName(
        user.uplineAdmin,
        fallback: 'your business opportunity'
      );
      Map<String, dynamic>? notificationContent;

      if (directCount >= actualDirectMin && totalCount < actualTotalMin) {
        final remainingTeamNeeded = actualTotalMin - totalCount;
        debugPrint('🎯 MILESTONE: User ${user.uid} reached $actualDirectMin direct sponsors, needs $remainingTeamNeeded more total team members');
        
        notificationContent = {
          'title': '🎉 Amazing Progress!',
          'message': 'Congratulations, ${user.firstName}! You\'ve reached $actualDirectMin direct sponsors! Just $remainingTeamNeeded more team member${remainingTeamNeeded > 1 ? 's' : ''} needed to unlock your $bizName invitation. Keep building!',
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
          'type': 'milestone_direct_sponsors',
          'route': '/network',
          'route_params': '{"filter": "all"}',
        };
      } else if (totalCount >= actualTotalMin && directCount < actualDirectMin) {
        final remainingDirectNeeded = actualDirectMin - directCount;
        debugPrint('🎯 MILESTONE: User ${user.uid} reached $actualTotalMin total team, needs $remainingDirectNeeded more direct sponsors');
        
        notificationContent = {
          'title': '🚀 Incredible Growth!',
          'message': 'Amazing progress, ${user.firstName}! You\'ve built a team of $actualTotalMin! Just $remainingDirectNeeded more direct sponsor${remainingDirectNeeded > 1 ? 's' : ''} needed to qualify for $bizName. You\'re so close!',
          'createdAt': FieldValue.serverTimestamp(),
          'read': false,
          'type': 'milestone_total_team',
          'route': '/network',
          'route_params': '{"filter": "all"}',
        };
      }

      if (notificationContent != null) {
        await _createNotification(user.uid, notificationContent);
        debugPrint('✅ MILESTONE: Created milestone notification for user ${user.uid} - ${notificationContent['type']}');
      } else {
        debugPrint('🎯 MILESTONE: No milestone reached for user ${user.uid} - Direct: $directCount/$actualDirectMin, Total: $totalCount/$actualTotalMin');
      }
    } catch (e) {
      debugPrint('❌ MILESTONE: Error checking milestone for user ${user.uid}: $e');
    }
  }

  static Future<void> _updateQualifiedDate(String userId) async {
    await _db.collection('users').doc(userId).update({
      'qualifiedDate': FieldValue.serverTimestamp(),
    });
  }

  static Future<void> _createNotification(String userId, Map<String, dynamic> content) async {
    await _db.collection('users').doc(userId).collection('notifications').add(content);
  }

}