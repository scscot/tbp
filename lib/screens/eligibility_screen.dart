import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import '../services/admin_settings_service.dart';
import 'share_screen.dart';
import '../widgets/localized_text.dart';

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
  final AdminSettingsService _adminSettingsService = AdminSettingsService();

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
          _isQualified =
              _currentDirectCount >= AppConstants.projectWideDirectSponsorMin &&
                  _currentTotalCount >= AppConstants.projectWideTotalTeamMin;

          // Get biz_opp from admin settings using shared service
          final userRole = userData?['role'] as String?;

          // Determine admin UID based on user role
          final adminUid = userRole == 'admin'
              ? user.uid
              : userData?['upline_admin'] as String?;

          if (adminUid != null && adminUid.isNotEmpty) {
            final bizOpp = await _adminSettingsService.getBizOppName(
              adminUid,
              fallback: 'your opportunity'
            );

            if (mounted) {
              setState(() {
                _bizOpp = bizOpp;
              });
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
            _isQualified
                ? (context.l10n?.eligibilityHeroTitleQualified ?? 'CONGRATULATIONS\nYou\'re Qualified!')
                : (context.l10n?.eligibilityHeroTitleNotQualified ?? 'Build Your Momentum'),
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            _isQualified
                ? (context.l10n?.eligibilityHeroMessageQualified ?? 'Incredible work! You\'ve built your foundational team and unlocked the $_bizOpp opportunity. Continue growing your network to help others achieve the same success.').toString()
                : (context.l10n?.eligibilityHeroMessageNotQualified ?? 'You\'re on your way! Every professional you connect with builds momentum for your future launch in the $_bizOpp opportunity. Keep sharing to reach your goals!').toString(),
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
            child: Text(
              context.l10n?.eligibilityHeroButton ?? 'Proven Growth Strategies',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
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
        appBar: AppScreenBar(title: context.l10n?.eligibilityTitle ?? 'Eligibility Status'),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.eligibilityTitle ?? 'Eligibility Status'),
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
                      context.l10n?.eligibilityThresholdsTitle ?? 'QUALIFICATION THRESHOLDS',
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
                          label: context.l10n?.eligibilityLabelDirectSponsors ?? 'Direct Sponsors',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.hub,
                          value:
                              AppConstants.projectWideTotalTeamMin.toString(),
                          label: context.l10n?.eligibilityLabelTotalTeam ?? 'Total Team Members',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            // Current Team Counts
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      context.l10n?.eligibilityCurrentCountsTitle ?? 'YOUR CURRENT TEAM COUNTS',
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
                          value: _currentDirectCount.toString(),
                          label: context.l10n?.eligibilityCurrentDirectSponsors ?? 'Direct Sponsors',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.hub,
                          value: _currentTotalCount.toString(),
                          label: context.l10n?.eligibilityCurrentTotalTeam ?? 'Total Team Members',
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
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
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
                            color: AppColors.withOpacity(
                                AppColors.teamAccent, 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(Icons.settings,
                              color: AppColors.teamAccent, size: 28),
                        ),
                        const SizedBox(width: 16),
                        Text(
                          context.l10n?.eligibilityProcessTitle ?? 'THE PROCESS',
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
                      title: context.l10n?.eligibilityProcessStep1Title ?? 'INVITE - Build Your Foundation',
                      description:
                          (context.l10n?.eligibilityProcessStep1Description ?? 'Connect with like-minded professionals open to exploring $_bizOpp .').toString(),
                      icon: Icons.connect_without_contact,
                    ),
                    _buildProcessStep(
                      step: 2,
                      title: context.l10n?.eligibilityProcessStep2Title ?? 'CULTIVATE - Create Momentum',
                      description:
                          context.l10n?.eligibilityProcessStep2Description ?? 'Foster authentic relationships as your team grows, creating a thriving team of professionals who support each other\'s success.',
                      icon: Icons.psychology,
                    ),
                    _buildProcessStep(
                      step: 3,
                      title: context.l10n?.eligibilityProcessStep3Title ?? 'PARTNER - Launch with Success',
                      description:
                          (context.l10n?.eligibilityProcessStep3Description ?? 'Team members receive an invitation to join $_bizOpp upon achieving key growth targets.').toString(),
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
