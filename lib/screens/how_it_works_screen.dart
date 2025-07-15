import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';

class HowItWorksScreen extends StatefulWidget {
  final String appId;

  const HowItWorksScreen({
    super.key,
    required this.appId,
  });

  @override
  State<HowItWorksScreen> createState() => _HowItWorksScreenState();
}

class _HowItWorksScreenState extends State<HowItWorksScreen> {
  String _bizOpp = 'your business opportunity';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBizOpp();
  }

  Future<void> _loadBizOpp() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final userDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();
            
        if (userDoc.exists) {
          final userData = userDoc.data() as Map<String, dynamic>?;
          final uplineAdmin = userData?['upline_admin'] as String?;
          
          if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
            final adminSettingsDoc = await FirebaseFirestore.instance
                .collection('admin_settings')
                .doc(uplineAdmin)
                .get();
                
            if (adminSettingsDoc.exists) {
              final adminData = adminSettingsDoc.data() as Map<String, dynamic>?;
              final bizOpp = adminData?['biz_opp'] as String?;
              if (bizOpp != null && bizOpp.isNotEmpty) {
                setState(() {
                  _bizOpp = bizOpp;
                });
              }
            }
          }
        }
      }
    } catch (e) {
      // Handle error gracefully - keep default value
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
            Icons.rocket_launch,
            size: 48,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 16),
          Text(
            'TEAM BUILD PRO FEEDER SYSTEM',
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
            'Whether you have years of experience, are just getting started, or are even considering joining, the Team Build Pro app will help turbo-charge the growth of your $_bizOpp business!',
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

  Widget _buildSectionCard({
    required String title,
    required String content,
    required IconData icon,
    required Color color,
  }) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.withOpacity(color, 0.2), width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.withOpacity(color, 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: color,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              content,
              style: TextStyle(
                fontSize: 16,
                height: 1.6,
                color: AppColors.textSecondary,
              ),
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

            // The Challenge
            _buildSectionCard(
              title: 'THE CHALLENGE',
              content: 'The main obstacle to achieving success with $_bizOpp is recruiting and building your team. In fact, it\'s the number one reason people give up before achieving financial success.',
              icon: Icons.warning_amber,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),

            // The Solution
            _buildSectionCard(
              title: 'THE SOLUTION',
              content: 'The Team Build Pro app is a proven system that provides your $_bizOpp recruiting prospects the opportunity to pre-build their team before joining $_bizOpp, thereby significantly increasing their chances at short and long-term success.',
              icon: Icons.lightbulb,
              color: AppColors.primary,
            ),
            const SizedBox(height: 16),

            // Why It Works
            _buildSectionCard(
              title: 'WHY IT WORKS',
              content: 'There are no barriers to entry. No start-up fees. No initial product or service purchases required. This enables them to quickly pre-build large, global teams.',
              icon: Icons.trending_up,
              color: AppColors.growthPrimary,
            ),
            const SizedBox(height: 24),

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
                      title: 'Share the App',
                      description: 'You share the Team Build Pro app with your existing $_bizOpp downline members and your recruiting prospects who have committed to joining $_bizOpp but have not yet done so.',
                      icon: Icons.share,
                    ),
                    _buildProcessStep(
                      step: 2,
                      title: 'They Do the Same',
                      description: 'Your team members begin sharing the app with their networks, creating exponential growth.',
                      icon: Icons.group_add,
                    ),
                    _buildProcessStep(
                      step: 3,
                      title: 'Automatic Invitations',
                      description: 'When your Team Build Pro downline members meet the minimum eligibility criteria, they are automatically invited to join your $_bizOpp opportunity – with their growing Team Build Pro downline members ready to follow.',
                      icon: Icons.auto_awesome,
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
                              'Remember: Every member of your Team Build Pro downline that ultimately joins $_bizOpp will automatically be placed in your $_bizOpp downline!',
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
            const SizedBox(height: 24),

            // Minimum Eligibility Requirements
            Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      'MINIMUM ELIGIBILITY REQUIREMENTS',
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
                          icon: Icons.people,
                          value: AppConstants.projectWideDirectSponsorMin.toString(),
                          label: 'Direct Sponsors',
                        ),
                        const SizedBox(width: 16),
                        _buildMetricCard(
                          icon: Icons.groups,
                          value: AppConstants.projectWideTotalTeamMin.toString(),
                          label: 'Total Team Members',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Call to Action
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppColors.growthGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppColors.heavyShadow,
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.celebration,
                    size: 48,
                    color: AppColors.textInverse,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Ready to Turbo-Charge Your Success?',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textInverse,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Start building your pre-qualified $_bizOpp team today with Team Build Pro!',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.withOpacity(AppColors.textInverse, 0.9),
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
