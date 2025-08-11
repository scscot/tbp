// lib/screens/profile_screen.dart

import 'dart:developer' as developer;
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../screens/member_detail_screen.dart';
import '../screens/update_profile_screen.dart';
import '../services/firestore_service.dart';
import '../widgets/header_widgets.dart';

class ProfileScreen extends StatefulWidget {
  final String appId;
  const ProfileScreen({super.key, required this.appId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final FirestoreService _firestoreService = FirestoreService();

   bool _checkingSuperAdminStatus = true;

  String? _sponsorName;
  String? _sponsorUid;
  String? _teamLeaderName;
  String? _teamLeaderUid;

  @override
  void initState() {
    super.initState();
    // Load data when screen is first created
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshData();
    });
  }

  void _refreshData() {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user != null) {
      _loadUplineData(user);
      _checkSuperAdminStatus(user);
    } else {
      if (mounted) setState(() => _checkingSuperAdminStatus = false);
    }
  }

  Future<void> _checkSuperAdminStatus(UserModel user) async {
    if (!_checkingSuperAdminStatus) {
      if (mounted) setState(() => _checkingSuperAdminStatus = true);
    }

    if (user.role == 'admin') {
      try {
        if (mounted) {
          setState(() {});
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint("Error checking super admin status: $e");
        }
      }
    }
    if (mounted) {
      setState(() {
        _checkingSuperAdminStatus = false;
      });
    }
  }

  void _loadUplineData(UserModel user) {
    if (user.role == 'admin') {
      developer.log('Admin user detected, skipping upline data load');
      return;
    }
    
    developer.log('🔍 _loadUplineData called for user: ${user.uid}');
    developer.log('🔍 user.role: ${user.role}');
    developer.log('🔍 user.sponsorId: ${user.sponsorId}');
    developer.log('🔍 user.uplineAdmin: ${user.uplineAdmin}');

    // Fetch Sponsor info
    if (user.sponsorId != null && user.sponsorId!.isNotEmpty) {
      developer.log('🔍 Fetching sponsor with ID: ${user.sponsorId}');
  
      _firestoreService.getUser(user.sponsorId!).then((sponsor) {
        developer.log('🔍 Sponsor fetch result: ${sponsor != null ? 'found' : 'not found'}');
        
        if (mounted && sponsor != null) {
          setState(() {
            _sponsorName =
                '${sponsor.firstName ?? ''} ${sponsor.lastName ?? ''}'.trim();
            _sponsorUid = sponsor.uid;
          });
          developer.log('🔍 _sponsorName set to: $_sponsorName');
          developer.log('🔍 _sponsorUid set to: $_sponsorUid');
        } else {
          developer.log('🔍 Sponsor not found for ID: ${user.sponsorId}');
        }
      }).catchError((error) {
        developer.log('🔍 Error fetching sponsor: $error', error: error);
      });
    } else {
      developer.log('🔍 No sponsorId found for user');
    }

    // Fetch Team Leader info
    if (user.uplineAdmin != null && user.uplineAdmin!.isNotEmpty) {
      final leaderId = user.uplineAdmin!;
      developer.log('🔍 Fetching team leader with ID: $leaderId');
      
      _firestoreService.getUser(leaderId).then((leader) {
        developer.log('🔍 Team leader fetch result: ${leader != null ? 'found' : 'not found'}');
        if (mounted && leader != null) {
          setState(() {
            _teamLeaderName =
                '${leader.firstName ?? ''} ${leader.lastName ?? ''}'.trim();
            _teamLeaderUid = leader.uid;
          });
          developer.log('🔍 _teamLeaderName set to: $_teamLeaderName');
          developer.log('🔍 _teamLeaderUid set to: $_teamLeaderUid');
        } else {
          developer.log('🔍 Team leader not found for ID: $leaderId');
        }
      }).catchError((error) {
        developer.log('🔍 Error fetching team leader: $error', error: error);
      });
    } else {
      developer.log('🔍 No uplineAdmin found for user');
    }
  }
  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<UserModel?>(context);

    if (currentUser == null) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 50,
                    backgroundImage: currentUser.photoUrl != null &&
                            currentUser.photoUrl!.isNotEmpty
                        ? NetworkImage(currentUser.photoUrl!)
                        : null,
                    child: currentUser.photoUrl == null ||
                            currentUser.photoUrl!.isEmpty
                        ? const Icon(Icons.person, size: 50)
                        : null,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '${currentUser.firstName ?? ''} ${currentUser.lastName ?? ''}',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(currentUser.email ?? 'No email'),
                ],
              ),
            ),
            const SizedBox(height: 24),
            _buildInfoRow('City', currentUser.city ?? 'N/A'),
            _buildInfoRow('State', currentUser.state ?? 'N/A'),
            _buildInfoRow('Country', currentUser.country ?? 'N/A'),
            if (currentUser.createdAt != null)
              _buildInfoRow(
                  'Joined', DateFormat.yMMMd().format(currentUser.createdAt!)),
            if (currentUser.role != 'admin') ...[
              if (_sponsorName != null && _sponsorUid != null)
                _buildClickableInfoRow(
                    'Your Sponsor', _sponsorName!, _sponsorUid!),
              if (_teamLeaderName != null &&
                  _teamLeaderUid != null)
                _buildClickableInfoRow(
                    'Team Leader', _teamLeaderName!, _teamLeaderUid!),
            ],
            const SizedBox(height: 20),
            Center(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => UpdateProfileScreen(
                        user: currentUser,
                        appId: widget.appId,
                      ),
                    ),
                  ).then((_) {
                    if (mounted) {
                      setState(() {
                        _refreshData();
                      });
                    }
                  });
                },
                child: const Text('Edit Profile'),
              ),
            ),
            
          ],
        ),
      ),
    );
  }

  Widget _buildClickableInfoRow(
      String label, String displayName, String userId) {
    if (userId.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          SizedBox(
              width: 130,
              child: Text('$label:',
                  style: const TextStyle(fontWeight: FontWeight.w600))),
          Expanded(
            child: GestureDetector(
              onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => MemberDetailScreen(
                          userId: userId, appId: widget.appId))),
              child: Text(displayName,
                  style: const TextStyle(
                      color: Colors.blue,
                      decoration: TextDecoration.underline)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        children: [
          SizedBox(
              width: 130,
              child: Text('$label:',
                  style: const TextStyle(fontWeight: FontWeight.w600))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
