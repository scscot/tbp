// lib/screens/member_detail_screen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'dart:developer' as developer;
import 'package:firebase_auth/firebase_auth.dart';
// import 'package:provider/provider.dart';
import '../widgets/header_widgets.dart';
import '../services/firestore_service.dart';
import '../models/user_model.dart';
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
  bool _isCurrentUserAdmin = false;
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
      if (currentUserDoc != null) {
        _isCurrentUserAdmin = currentUserDoc.role == 'admin';
      }

      // Use the new backend aggregation method
      final memberDetails =
          await _firestoreService.getMemberDetails(widget.userId);

      if (!mounted) return;

      if (memberDetails != null) {
        // Parse the member data
        if (memberDetails['member'] != null) {
          final memberData = Map<String, dynamic>.from(memberDetails['member']);
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
              ? const Center(child: Text('Member not found.'))
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
                      _buildInfoRow('City', _user!.city ?? 'N/A'),
                      _buildInfoRow('State', _user!.state ?? 'N/A'),
                      _buildInfoRow('Country', _user!.country ?? 'N/A'),


                        _buildInfoRow('Joined TBP',
                            DateFormat.yMMMd().format(_user!.createdAt!)),

                       _buildInfoRow('Direct Sponsors',
                          (_user!.directSponsorCount ?? 0).toString()),

                       _buildInfoRow(
                          'Total Team',
                          (_user!.totalTeamCount ?? 0).toString()),


                      if (_user!.qualifiedDate != null)
                        _buildInfoRow('Qualified',
                            DateFormat.yMMMd().format(_user!.qualifiedDate!)),

                      if (_user!.bizJoinDate != null)
                        _buildInfoRow('Joined ${_user!.bizOpp}',
                            DateFormat.yMMMd().format(_user!.bizJoinDate!)),


                      if (_sponsorName != null)
                        _buildClickableInfoRow(
                            'Sponsor', _sponsorName!, _sponsorUid!),


                      if (_teamLeaderName != null &&
                          _teamLeaderUid != null &&
                          _user!.referredBy != _teamLeaderUid)
                        _buildClickableInfoRow(
                            'Team Leader', _teamLeaderName!, _teamLeaderUid!),


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
}
