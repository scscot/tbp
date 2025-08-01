import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import 'share_screen.dart';

class EligibilityScreen extends StatefulWidget {
  final String appId;

  const EligibilityScreen({
    super.key,
    required this.appId,
  });

  @override
  State<EligibilityScreen> createState() => _EligibilityScreenState();
}

class _EligibilityScreenState extends State<EligibilityScreen> {
  String _bizOpp = 'your opportunity';
  bool _isLoading = true;
  int _currentDirectCount = 0;
  int _currentTotalCount = 0;
  bool _isQualified = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();
            
        if (userDoc.exists) {
          final userData = userDoc.data();
          
          // Get current user's team stats
          _currentDirectCount = userData?['directSponsorCount']?.toInt() ?? 0;
          _currentTotalCount = userData?['totalTeamCount']?.toInt() ?? 0;
          
          // Check if qualified
          _isQualified = _currentDirectCount >= AppConstants.projectWideDirectSponsorMin &&
                        _currentTotalCount >= AppConstants.projectWideTotalTeamMin;
          
          // Get biz_opp from admin settings
          final userRole = userData?['role'] as String?;
          
          // Determine which admin settings to fetch
          String? adminUid;
          if (userRole == 'admin') {
            // If user is admin, use their own UID
            adminUid = user.uid;
          } else {
            // If user is not admin, use their upline_admin
            adminUid = userData?['upline_admin'] as String?;
          }
          
          if (adminUid != null && adminUid.isNotEmpty) {
            final adminSettingsDoc = await FirebaseFirestore.instance
                .collection('admin_settings')
                .doc(adminUid)
                .get();
                
            if (adminSettingsDoc.exists) {
              final adminData = adminSettingsDoc.data();
              final bizOppValue = adminData?['biz_opp'] as String?;
              if (bizOppValue != null && bizOppValue.isNotEmpty) {
                setState(() {
                  _bizOpp = bizOppValue;
                });
              }
            }
          }
        }
      }
    } catch (e) {
      // Handle error gracefully - keep default values
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Widget _buildHeroSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.growthGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.heavyShadow,
      ),
      child: Column(
        children: [
          Icon(
            Icons.rocket_launch,
            size: 48,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 16),
          Text(
            // REVISED TITLE LOGIC
            _isQualified
                ? 'CONGRATULATIONS\nYou\'re Qualified!'
                : 'Build Your Momentum',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            // REVISED MESSAGE LOGIC
            _isQualified
                ? 'Incredible work! You\'ve built your foundational team and unlocked the $_bizOpp opportunity. Continue growing your network to help others achieve the same success.'
                : 'You\'re on your way! Every professional you connect with builds momentum for your future launch in the $_bizOpp opportunity. Keep sharing to reach your goals!',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.textInverse.withValues(alpha: 0.9),
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ShareScreen(appId: widget.appId),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.textInverse,
              foregroundColor: AppColors.growthPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 4,
            ),
            child: const Text(
              'Proven Growth Strategies',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

 

  Widget _buildProgressCard({
    required IconData icon,
    required String label,
    required int current,
    required int target,
  }) {
    final progress = current / target;
    final isComplete = current >= target;
    
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: isComplete 
              ? LinearGradient(
                  colors: [AppColors.teamAccent, AppColors.darker(AppColors.teamAccent)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : LinearGradient(
                  colors: [AppColors.growthPrimary, AppColors.darker(AppColors.growthPrimary)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: AppColors.mediumShadow,
        ),
        child: Column(
          children: [
            Icon(
              isComplete ? Icons.check_circle : icon,
              size: 32,
              color: AppColors.textInverse,
            ),
            const SizedBox(height: 12),
            Text(
              '$current / $target',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textInverse,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.withOpacity(AppColors.textInverse, 0.9),
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              backgroundColor: AppColors.withOpacity(AppColors.textInverse, 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.textInverse),
            ),
          ],
        ),
      ),
    );
  }


  Widget _buildProcessStep({
    required int step,
    required String title,
    required String description,
    required IconData icon,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: Colors.orange, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: Text(
              description,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black54,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: AppColors.warningGradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: AppColors.mediumShadow,
        ),
        child: Column(
          children: [
            Icon(icon, size: 32, color: AppColors.textInverse),
            const SizedBox(height: 12),
            Text(
              value,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: AppColors.textInverse,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
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

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Hero Section
            _buildHeroSection(),
            const SizedBox(height: 24),

            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      'TEAM GROWTH\nQUALIFICATION THRESHOLDS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.warning,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        _buildMetricCard(
                          icon: Icons.connect_without_contact,
                          value: AppConstants.projectWideDirectSponsorMin
                              .toString(),
                          label: 'Direct Sponsors',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.hub,
                          value:
                              AppConstants.projectWideTotalTeamMin.toString(),
                          label: 'Total Team Members',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ), 
            // Progress Cards
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      'YOUR CURRENT TEAM COUNTS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.growthPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        _buildProgressCard(
                          icon: Icons.connect_without_contact,
                          label: 'Direct Sponsors',
                          current: _currentDirectCount,
                          target: AppConstants.projectWideDirectSponsorMin,
                        ),
                        const SizedBox(width: 16),
                        _buildProgressCard(
                          icon: Icons.hub,
                          label: 'Total Team Members',
                          current: _currentTotalCount,
                          target: AppConstants.projectWideTotalTeamMin,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // The Process
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.withOpacity(AppColors.teamAccent, 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.settings, color: AppColors.teamAccent, size: 28),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          'THE PROCESS',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.teamAccent,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _buildProcessStep(
                      step: 1,
                      title: 'INVITE - Expand Your Network',
                      description: 'Connect with like-minded professionals open to exploring $_bizOpp .',
                      icon: Icons.connect_without_contact,
                    ),
                    _buildProcessStep(
                      step: 2,
                      title: 'CULTIVATE - Nurture Professional Bonds',
                      description: 'Foster authentic relationships as your team grows, creating a thriving team of professionals who support each other\'s success.',
                      icon: Icons.psychology,
                    ),
                    _buildProcessStep(
                      step: 3,
                      title: 'PARTNER - Work Together For Mutual Success',
                      description: 'Team members receive an invitation to join $_bizOpp upon achieving key growth targets.',
                      icon: Icons.handshake,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            
          ],
        ),
      ),
    );
  }

}
