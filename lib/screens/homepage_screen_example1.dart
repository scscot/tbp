// lib/screens/homepage_screen_example1.dart

import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../config/app_constants.dart';
import 'new_registration_screen.dart';

class HomepageScreenExample1 extends StatefulWidget {
  final String? referralCode;
  final String appId;

  const HomepageScreenExample1({
    super.key,
    this.referralCode,
    required this.appId,
  });

  @override
  State<HomepageScreenExample1> createState() => _HomepageScreenExample1State();
}

class _HomepageScreenExample1State extends State<HomepageScreenExample1>
    with TickerProviderStateMixin {
  late AnimationController _heroAnimationController;
  late AnimationController _statsAnimationController;
  late Animation<double> _heroFadeAnimation;
  late Animation<Offset> _heroSlideAnimation;
  late Animation<double> _statsCountAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
  }

  void _setupAnimations() {
    _heroAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    
    _statsAnimationController = AnimationController(
      duration: const Duration(milliseconds: 2000),
      vsync: this,
    );

    _heroFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _heroAnimationController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    ));

    _heroSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _heroAnimationController,
      curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic),
    ));

    _statsCountAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _statsAnimationController,
      curve: Curves.easeOutCubic,
    ));

    _heroAnimationController.forward();
    Future.delayed(const Duration(milliseconds: 800), () {
      _statsAnimationController.forward();
    });
  }

  @override
  void dispose() {
    _heroAnimationController.dispose();
    _statsAnimationController.dispose();
    super.dispose();
  }

  Widget _buildHeroSection() {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primaryDark,
            AppColors.teamAccent,
          ],
        ),
      ),
      child: Stack(
        children: [
          // Background pattern
          Positioned.fill(
            child: Opacity(
              opacity: 0.1,
              child: Container(
                decoration: const BoxDecoration(
                  image: DecorationImage(
                    image: AssetImage('assets/images/network_pattern.png'),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          ),
          // Content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FadeTransition(
                    opacity: _heroFadeAnimation,
                    child: SlideTransition(
                      position: _heroSlideAnimation,
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: AppColors.withOpacity(AppColors.textInverse, 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.rocket_launch,
                              size: 64,
                              color: AppColors.textInverse,
                            ),
                          ),
                          const SizedBox(height: 32),
                          Text(
                            'BREAKTHROUGH',
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textInverse,
                              letterSpacing: 2.0,
                              shadows: [
                                Shadow(
                                  offset: const Offset(0, 2),
                                  blurRadius: 4,
                                  color: Colors.black.withOpacity(0.3),
                                ),
                              ],
                            ),
                            textAlign: TextAlign.center,
                          ),
                          Text(
                            'THE DIRECT SALES',
                            style: TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: AppColors.withOpacity(AppColors.textInverse, 0.9),
                              letterSpacing: 1.5,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(30),
                              boxShadow: AppColors.mediumShadow,
                            ),
                            child: Text(
                              'SUCCESS BARRIER',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textInverse,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(height: 32),
                          Text(
                            'Finally! A proven system that eliminates the #1 reason people fail in direct sales - the inability to build a strong downline team.',
                            style: TextStyle(
                              fontSize: 18,
                              color: AppColors.withOpacity(AppColors.textInverse, 0.95),
                              height: 1.5,
                              fontWeight: FontWeight.w500,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: AppColors.backgroundSecondary,
      child: Column(
        children: [
          Text(
            'PROVEN RESULTS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'The original Team Building Project reached:',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          AnimatedBuilder(
            animation: _statsCountAnimation,
            builder: (context, child) {
              return Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      icon: Icons.people,
                      value: (70000 * _statsCountAnimation.value).toInt().toString() + '+',
                      label: 'Members',
                      color: AppColors.growthPrimary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildStatCard(
                      icon: Icons.public,
                      value: (120 * _statsCountAnimation.value).toInt().toString() + '+',
                      label: 'Countries',
                      color: AppColors.teamAccent,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppColors.warningGradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: AppColors.mediumShadow,
            ),
            child: Column(
              children: [
                Icon(
                  Icons.trending_up,
                  size: 32,
                  color: AppColors.textInverse,
                ),
                const SizedBox(height: 12),
                Text(
                  'NOW IT\'S YOUR TURN',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textInverse,
                    letterSpacing: 1.2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Be the admin of your own organization and experience exponential growth!',
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
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String value,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.withOpacity(color, 0.2), width: 2),
        boxShadow: AppColors.lightShadow,
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: color),
          const SizedBox(height: 16),
          Text(
            value,
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorksSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'HOW IT WORKS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          _buildProcessStep(
            step: 1,
            title: 'Join Team Build Pro',
            description: 'Start building your pre-qualified team with zero barriers to entry - no fees, no meetings, no product purchases required.',
            icon: Icons.person_add,
            color: AppColors.primary,
          ),
          _buildProcessStep(
            step: 2,
            title: 'Share Your Link',
            description: 'Share your unique referral link with your network. Watch your team grow exponentially as they do the same.',
            icon: Icons.share,
            color: AppColors.growthPrimary,
          ),
          _buildProcessStep(
            step: 3,
            title: 'Get Daily Notifications',
            description: 'Receive exciting daily notifications as new members join your growing downline organization.',
            icon: Icons.notifications_active,
            color: AppColors.notificationPrimary,
          ),
          _buildProcessStep(
            step: 4,
            title: 'Automatic Invitations',
            description: 'When members reach ${AppConstants.projectWideDirectSponsorMin} direct sponsors and ${AppConstants.projectWideTotalTeamMin} total team members, they\'re automatically invited to your business opportunity.',
            icon: Icons.auto_awesome,
            color: AppColors.opportunityPrimary,
            isLast: true,
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
    required Color color,
    bool isLast = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [color, AppColors.darker(color, 0.2)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: AppColors.mediumShadow,
                ),
                child: Center(
                  child: Text(
                    step.toString(),
                    style: const TextStyle(
                      color: AppColors.textInverse,
                      fontWeight: FontWeight.w900,
                      fontSize: 24,
                    ),
                  ),
                ),
              ),
              if (!isLast)
                Container(
                  width: 3,
                  height: 40,
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.withOpacity(color, 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(icon, color: color, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                    height: 1.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCTASection() {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: AppColors.growthGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.heavyShadow,
      ),
      child: Column(
        children: [
          Icon(
            Icons.celebration,
            size: 56,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 20),
          Text(
            'START BUILDING YOUR',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.withOpacity(AppColors.textInverse, 0.9),
              letterSpacing: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            'SUCCESS STORY TODAY!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: AppColors.textInverse,
              letterSpacing: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            'Join thousands who are already pre-building their direct sales success with Team Build Pro.',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.withOpacity(AppColors.textInverse, 0.95),
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => NewRegistrationScreen(
                      referralCode: widget.referralCode,
                      appId: widget.appId,
                    ),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.textInverse,
                foregroundColor: AppColors.growthPrimary,
                padding: const EdgeInsets.symmetric(vertical: 20),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.rocket_launch,
                    size: 24,
                    color: AppColors.growthPrimary,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'GET STARTED FREE',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.growthPrimary,
                      letterSpacing: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.check_circle,
                size: 20,
                color: AppColors.withOpacity(AppColors.textInverse, 0.8),
              ),
              const SizedBox(width: 8),
              Text(
                'No fees • No meetings • No purchases required',
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.withOpacity(AppColors.textInverse, 0.8),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeroSection(),
            _buildStatsSection(),
            _buildHowItWorksSection(),
            _buildCTASection(),
          ],
        ),
      ),
    );
  }
}
