// lib/screens/profile_screen.dart

import 'dart:developer' as developer;
import 'dart:io';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import '../models/user_model.dart';
import '../screens/member_detail_screen.dart';
import '../screens/update_profile_screen.dart';
import '../screens/delete_account_screen.dart';
import '../services/firestore_service.dart';
import '../services/auth_service.dart';
import '../widgets/header_widgets.dart';
import '../main.dart';
import 'package:firebase_auth/firebase_auth.dart';

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
  
  // Android demo mode state
  bool _isAndroidDemoMode = false;
  String? _demoEmail;

  @override
  void initState() {
    super.initState();
    // Load data when screen is first created
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAndroidDemoMode();
      _refreshData();
    });
  }

  Future<void> _checkAndroidDemoMode() async {
    try {
      if (Platform.isAndroid) {
        final remoteConfig = FirebaseRemoteConfig.instance;
        final isDemo = remoteConfig.getBool('android_demo_mode');
        final demoEmail = remoteConfig.getString('demo_account_email');

        if (mounted) {
          setState(() {
            _isAndroidDemoMode = isDemo;
            _demoEmail = demoEmail.isNotEmpty ? demoEmail : null;
          });
        }
        debugPrint('🤖 PROFILE: Android demo mode: $isDemo');
      }
    } catch (e) {
      debugPrint('❌ PROFILE: Error checking Android demo mode: $e');
    }
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
        developer.log(
            '🔍 Sponsor fetch result: ${sponsor != null ? 'found' : 'not found'}');

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
        developer.log(
            '🔍 Team leader fetch result: ${leader != null ? 'found' : 'not found'}');
        if (mounted && leader != null) {
          setState(() {
            _teamLeaderName =
                '${leader.firstName ?? ''} ${leader.lastName ?? ''}'.trim();
            _teamLeaderUid = leader.uid;
          });
          developer.log('🔍 _teamLeaderName set to: $_teamLeaderName');
          developer.log('🔍 _teamLeaderUid set to: $_teamLeaderUid');
        } else {
          developer.log('⚠️ Team leader not found for ID: $leaderId - admin account may have been deleted');
          // Explicitly set to null to ensure UI doesn't show stale data
          if (mounted) {
            setState(() {
              _teamLeaderName = null;
              _teamLeaderUid = null;
            });
          }
        }
      }).catchError((error) {
        developer.log('❌ Error fetching team leader: $error', error: error);
        // Explicitly set to null in case of error
        if (mounted) {
          setState(() {
            _teamLeaderName = null;
            _teamLeaderUid = null;
          });
        }
      });
    } else {
      developer.log('🔍 No uplineAdmin found for user');
    }
  }

  Future<void> _performSignOut() async {
    try {
      final authService = context.read<AuthService>();
      debugPrint('🔓 PROFILE: Starting immediate sign out process...');
      
      await authService.signOut();
      debugPrint('✅ PROFILE: Auth service sign out completed');

      // Wait until Firebase reports "no user" to avoid race condition
      debugPrint('🔄 PROFILE: Waiting for auth state to confirm null user...');
      await FirebaseAuth.instance
          .authStateChanges()
          .firstWhere((u) => u == null);
      debugPrint('✅ PROFILE: Auth state confirmed null user');
      
      if (!mounted) return;

      // Close any lingering dialogs/sheets from the root just in case
      while (navigatorKey.currentState?.canPop() == true) {
        navigatorKey.currentState?.pop();
      }
      debugPrint('✅ PROFILE: Cleared any lingering dialogs');

      // Reset the full app stack via root navigator using global key
      navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (route) => false);
      debugPrint('✅ PROFILE: Navigation to root completed via global navigator key');
      
    } catch (e) {
      debugPrint('❌ PROFILE: Error during sign out: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sign out failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showDemoAccountDeletionModal() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue, size: 24),
              SizedBox(width: 12),
              Text('Demo Account Information'),
            ],
          ),
          content: const Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'This is a demo account for testing purposes and cannot be deleted.',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
              ),
              SizedBox(height: 12),
              Text(
                'Demo accounts are provided to showcase the app\'s features and functionality for review purposes.',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              style: TextButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: const Text('I Understand'),
            ),
          ],
        );
      },
    );
  }

  void _handleAdminAccountDeletion(UserModel currentUser) {
    final directSponsorsCount = currentUser.directSponsorCount;
    
    if (directSponsorsCount > 0) {
      // Admin has team members - show protection modal
      _showAdminAccountProtectionModal(directSponsorsCount);
    } else {
      // Admin has no team members - allow deletion
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => const DeleteAccountScreen(),
        ),
      );
    }
  }


  void _showAdminAccountProtectionModal(int teamSize) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.business_center, color: Colors.amber, size: 24),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Admin Account Protection',
                  style: TextStyle(fontSize: 18),
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Administrator accounts with active team members cannot be deleted as this would disrupt business operations.',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.people, color: Colors.amber, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Your Team: $teamSize Direct Sponsors',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'To delete your admin account, please contact our support team to arrange proper account transfer procedures that protect your team members.',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Contact: legal@teambuildpro.com',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.blue),
                ),
              ],
            ),
          ),
          actions: [
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                style: TextButton.styleFrom(
                  backgroundColor: Colors.amber,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'I Understand',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentUser = Provider.of<UserModel?>(context);

    if (currentUser == null) {
      // Immediately redirect out of Profile when signed out
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;

        // Pop any lingering overlays/dialogs from root navigator
        while (navigatorKey.currentState?.canPop() == true) {
          navigatorKey.currentState?.pop();
        }

        navigatorKey.currentState?.pushNamedAndRemoveUntil('/', (route) => false);
      });

      // Render nothing instead of keeping Profile alive
      return const SizedBox.shrink();
    }

    return Scaffold(
      appBar: const AppScreenBar(title: 'Profile'),
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
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildInfoRow('City', currentUser.city ?? 'N/A'),
                    _buildInfoRow('State', currentUser.state ?? 'N/A'),
                    _buildInfoRow('Country', currentUser.country ?? 'N/A'),
                    if (currentUser.createdAt != null)
                      _buildInfoRow('Joined',
                          DateFormat.yMMMd().format(currentUser.createdAt!)),
                    if (currentUser.role != 'admin') ...[
                      if (_sponsorName != null && _sponsorUid != null)
                        _buildClickableInfoRow(
                            'Your Sponsor', _sponsorName!, _sponsorUid!),
                      if (_teamLeaderName != null &&
                          _teamLeaderName!.isNotEmpty &&
                          _teamLeaderUid != null &&
                          _teamLeaderUid!.isNotEmpty &&
                          _teamLeaderUid != _sponsorUid)
                        _buildClickableInfoRow(
                            'Team Leader', _teamLeaderName!, _teamLeaderUid!),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            Center(
              child: Material( // <— ensures correct gesture semantics for buttons
                color: Colors.transparent,
                child: Column(
                  children: [
                    ElevatedButton(
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
                    const SizedBox(height: 16),
                    // --- Sign Out button (patched) ---
                    ElevatedButton.icon(
                      onPressed: () async {
                        debugPrint('🔘 PROFILE: Sign Out tapped'); // prove tap reached handler
                        // Optional: brief UI feedback so you can "feel" the tap even if signOut is slow
                        final messenger = ScaffoldMessenger.maybeOf(context);
                        messenger?.hideCurrentSnackBar();
                        messenger?.showSnackBar(
                          const SnackBar(
                            content: Text('Signing out...'),
                            duration: Duration(milliseconds: 600),
                          ),
                        );

                        await _performSignOut();
                      },
                      icon: const Icon(Icons.logout),
                      label: const Text('Sign Out'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red.shade600,
                        foregroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Account Deletion button
                    OutlinedButton.icon(
                      onPressed: () {
                        // Check if this is a demo account
                        if (_isAndroidDemoMode && _demoEmail != null && 
                            currentUser.email?.toLowerCase() == _demoEmail?.toLowerCase()) {
                          _showDemoAccountDeletionModal();
                        } 
                        // Check if this is an admin account with team members
                        else if (currentUser.role == 'admin') {
                          _handleAdminAccountDeletion(currentUser);
                        } 
                        else {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const DeleteAccountScreen(),
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.delete_forever, size: 18),
                      label: const Text('Delete Account'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red.shade600,
                        side: BorderSide(color: Colors.red.shade600),
                      ),
                    ),
                  ],
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
        children: [
          SizedBox(
              width: 130,
              child: Text('$label:',
                  style: const TextStyle(fontWeight: FontWeight.w600))),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.deferToChild, // <— let children (buttons) handle taps first
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
