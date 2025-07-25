import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';

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
  String _bizOpp = 'your business opportunity';
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
          
          // Get current user's community stats
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
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(
            _isQualified ? Icons.celebration : Icons.trending_up,
            size: 48,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 16),
          Text(
            'KEEP GROWING!',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
              letterSpacing: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Continue building your community to unlock your opportunity with $_bizOpp.',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.withOpacity(AppColors.textInverse, 0.9),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
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
      margin: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.growthPrimary,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                step.toString(),
                style: const TextStyle(
                  color: AppColors.textInverse,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, color: AppColors.growthPrimary, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
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
                      'COMMUNITY ENGAGEMENT THRESHOLDS',
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
                          label: 'Direct Connections',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.hub,
                          value:
                              AppConstants.projectWideTotalTeamMin.toString(),
                          label: 'Community Network',
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
                      'YOUR PROGRESS',
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
                          label: 'Direct Connections',
                          current: _currentDirectCount,
                          target: AppConstants.projectWideDirectSponsorMin,
                        ),
                        const SizedBox(width: 16),
                        _buildProgressCard(
                          icon: Icons.hub,
                          label: 'Community Network',
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
                      title: 'CONNECT - Expand Your Network',
                      description: 'Connect with like-minded professionals and introduce Network Build Pro to colleagues who value meaningful business relationships.',
                      icon: Icons.connect_without_contact,
                    ),
                    _buildProcessStep(
                      step: 2,
                      title: 'CULTIVATE - Nurture Professional Bonds',
                      description: 'Foster authentic relationships as your network grows, creating a thriving community of professionals who support each other\'s success.',
                      icon: Icons.psychology,
                    ),
                    _buildProcessStep(
                      step: 3,
                      title: 'COLLABORATE - Unlock Opportunities Together',
                      description: 'When your professional community reaches engagement milestones, unlock collaborative business ventures and development opportunities.',
                      icon: Icons.handshake,
                    ),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.successBackground,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.withOpacity(AppColors.success, 0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.star, color: AppColors.success, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Note: Network Build Pro focuses on building genuine professional relationships and networks that can lead to meaningful long-term success.',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppColors.darker(AppColors.success),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

        Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: _isQualified ? AppColors.successGradient : AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: [
          Icon(
            _isQualified ? Icons.celebration : Icons.share_rounded,
            size: 48,
            color: Colors.white,
          ),
          const SizedBox(height: 16),
          Text(
            _isQualified ? 'You\'re Qualified!' : 'Grow Your Community',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _isQualified
                ? 'Congratulations! You\'ve unlocked $_bizOpp opportunities. Keep growing your community!'
                : 'Share your referral link and start building your community!',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white.withValues(alpha: 0.9),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

}
