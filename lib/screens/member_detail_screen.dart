// lib/screens/member_detail_screen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'dart:developer' as developer;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
// import 'package:provider/provider.dart';
import '../widgets/header_widgets.dart';
import '../services/firestore_service.dart';
import '../models/user_model.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import 'message_thread_screen.dart';

class MemberDetailScreen extends StatefulWidget {
  final String userId;
  final String appId;

  const MemberDetailScreen({
    super.key,
    required this.userId,
    required this.appId,
  });

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  final FirestoreService _firestoreService = FirestoreService();
  UserModel? _user;
  String? _sponsorName;
  String? _sponsorUid;
  String? _teamLeaderName;
  String? _teamLeaderUid;
  String? _currentUserId;
  String? _bizOpp;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  void _log(String message) {
    if (kDebugMode) {
      developer.log(message, name: 'MemberDetailScreen');
    }
  }

  Future<void> _loadUserData() async {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    _currentUserId = authUser.uid;

    try {
      // Check if current user is admin
      final currentUserDoc = await _firestoreService.getUser(_currentUserId!);
      if (currentUserDoc != null) {}

      // Use the new backend aggregation method
      final memberDetails =
          await _firestoreService.getMemberDetails(widget.userId);

      if (!mounted) return;

      if (memberDetails != null) {
        // Parse the member data
        if (memberDetails['member'] != null) {
          final memberData = Map<String, dynamic>.from(memberDetails['member']);

          // Fetch biz_opp from admin_settings if upline_admin exists
          final uplineAdmin = memberData['upline_admin'] as String?;
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
                  memberData['biz_opp'] = bizOpp;
                  setState(() {
                    _bizOpp = bizOpp;
                  });
                }
              }
            } catch (e) {
              _log('Error fetching biz_opp from admin_settings: $e');
            }
          }

          setState(() {
            _user = UserModel.fromMap(memberData);
          });
        }

        // Parse sponsor data
        if (memberDetails['sponsor'] != null) {
          final sponsorData =
              Map<String, dynamic>.from(memberDetails['sponsor']);
          setState(() {
            _sponsorUid = sponsorData['uid'];
            _sponsorName =
                '${sponsorData['firstName'] ?? ''} ${sponsorData['lastName'] ?? ''}'
                    .trim();
          });
        }

        // Parse team leader data
        if (memberDetails['teamLeader'] != null) {
          final leaderData =
              Map<String, dynamic>.from(memberDetails['teamLeader']);
          setState(() {
            _teamLeaderUid = leaderData['uid'];
            _teamLeaderName =
                '${leaderData['firstName'] ?? ''} ${leaderData['lastName'] ?? ''}'
                    .trim();
          });
        }
      }
    } catch (e) {
      _log("Error loading member details: $e");
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _handleSendMessage() {
    if (_currentUserId == null || _user == null) return;

    final ids = [_currentUserId!, _user!.uid];
    ids.sort();
    final threadId = ids.join('_');

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MessageThreadScreen(
          threadId: threadId,
          appId: widget.appId,
          recipientId: _user!.uid,
          recipientName: '${_user!.firstName ?? ''} ${_user!.lastName ?? ''}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // final authUser = Provider.of<UserModel?>(context);
    // final bool isCurrentUserAnAdmin = authUser?.role == 'admin';

    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _user == null
              ? const Center(child: Text('Team member not found.'))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: CircleAvatar(
                          radius: 50,
                          backgroundImage: _user!.photoUrl != null &&
                                  _user!.photoUrl!.isNotEmpty
                              ? NetworkImage(_user!.photoUrl!)
                              : null,
                          child: _user!.photoUrl == null ||
                                  _user!.photoUrl!.isEmpty
                              ? const Icon(Icons.person, size: 50)
                              : null,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(
                        child: Text(
                          '${_user!.firstName ?? ''} ${_user!.lastName ?? ''}',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                      ),
                      const SizedBox(height: 24),
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 300),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildInfoRow('City', _user!.city ?? 'N/A'),
                              _buildInfoRow('State', _user!.state ?? 'N/A'),
                              _buildInfoRow('Country', _user!.country ?? 'N/A'),
                              // Hide these rows if the profile being viewed has role == admin
                              if (_user!.role != 'admin') ...[
                                _buildInfoRow(
                                    'Joined Network',
                                    DateFormat.yMMMd()
                                        .format(_user!.createdAt!)),
                                _buildInfoRow('Direct Sponsors',
                                    _user!.directSponsorCount.toString()),
                                _buildInfoRow('Total Team',
                                    _user!.totalTeamCount.toString()),
                                if (_user!.currentPartner == true)
                                  _buildQualifiedInfoRow('Qualified', 'Yes')
                                else ...[
                                  if (_user!.qualifiedDate != null)
                                    _buildQualifiedInfoRow(
                                        'Qualified',
                                        DateFormat.yMMMd()
                                            .format(_user!.qualifiedDate!))
                                  else
                                    _buildQualifiedInfoRow(
                                        'Qualified', 'Not Yet'),
                                  if (_user!.bizJoinDate != null)
                                    _buildInfoRow(
                                        'Joined ${_bizOpp ?? 'organization'}',
                                        DateFormat.yMMMd()
                                            .format(_user!.bizJoinDate!))
                                  else
                                    _buildInfoRow(
                                        'Joined ${_bizOpp ?? 'organization'}',
                                        'Not Yet'),
                                ],
                                if (_sponsorName != null)
                                  // If current user is the sponsor, show as plain text, otherwise as clickable link
                                  _currentUserId == _sponsorUid
                                      ? _buildInfoRow('Sponsor', _sponsorName!)
                                      : _buildClickableInfoRow('Sponsor',
                                          _sponsorName!, _sponsorUid!),
                                if (_teamLeaderName != null &&
                                    _teamLeaderUid != null &&
                                    _user!.referredBy != _teamLeaderUid)
                                  _currentUserId == _teamLeaderUid
                                      ? _buildInfoRow(
                                          'Team Leader', _teamLeaderName!)
                                      : _buildClickableInfoRow('Team Leader',
                                          _teamLeaderName!, _teamLeaderUid!),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 30),
                      if (_currentUserId != widget.userId)
                        Center(
                          child: ElevatedButton.icon(
                            onPressed: _handleSendMessage,
                            icon: const Icon(Icons.message),
                            label: const Text('Send Message'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24.0, vertical: 12.0),
                              textStyle: const TextStyle(fontSize: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8.0),
                              ),
                            ),
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
        crossAxisAlignment: CrossAxisAlignment.start,
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
              child: Text(
                displayName,
                style: const TextStyle(
                    color: Colors.blue, decoration: TextDecoration.underline),
              ),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              "$label:",
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _buildQualifiedInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              "$label:",
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            child: Row(
              children: [
                Text(value),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _showEligibilityRequirementsModal,
                  child: Icon(
                    Icons.info_outline,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showEligibilityRequirementsModal() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Container(
            padding: const EdgeInsets.all(20),
            constraints: const BoxConstraints(maxWidth: 350, maxHeight: 400),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'ELIGIBILITY REQUIREMENTS',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.warning,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      _buildMetricCard(
                        icon: Icons.people,
                        value:
                            AppConstants.projectWideDirectSponsorMin.toString(),
                        label: 'Direct Sponsors',
                      ),
                      const SizedBox(width: 16),
                      _buildMetricCard(
                        icon: Icons.groups,
                        value: AppConstants.projectWideTotalTeamMin.toString(),
                        label: 'Total MembersMembers',
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    _user!.currentPartner == true
                        ? 'Eligibility requirements are waived for individuals who joined the ${_bizOpp ?? 'organization'} prior to joining the Network.'
                        : 'Team members who meet these requirements are automatically invited to join the ${_bizOpp ?? 'organization'}.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMetricCard({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: AppColors.warningGradient,
          borderRadius: BorderRadius.circular(12),
          boxShadow: AppColors.lightShadow,
        ),
        child: Column(
          children: [
            Icon(icon, size: 28, color: AppColors.textInverse),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textInverse,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.withOpacity(AppColors.textInverse, 0.9),
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
