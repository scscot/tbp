// lib/screens/homepage_screen_example3.dart

import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../config/app_constants.dart';
import 'new_registration_screen.dart';

class HomepageScreenExample3 extends StatefulWidget {
  final String? referralCode;
  final String appId;

  const HomepageScreenExample3({
    super.key,
    this.referralCode,
    required this.appId,
  });

  @override
  State<HomepageScreenExample3> createState() => _HomepageScreenExample3State();
}

class _HomepageScreenExample3State extends State<HomepageScreenExample3>
    with TickerProviderStateMixin {
  late AnimationController _waveController;
  late AnimationController _fadeController;
  late Animation<double> _waveAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
  }

  void _setupAnimations() {
    _waveController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
    )..repeat();

    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _waveAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _waveController,
      curve: Curves.easeInOut,
    ));

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    ));

    _fadeController.forward();
  }

  @override
  void dispose() {
    _waveController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  Widget _buildFloatingHeader() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(25),
        boxShadow: AppColors.mediumShadow,
      ),
      child: SafeArea(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.diamond,
                color: AppColors.textInverse,
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'Team Build Pro',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroSection() {
    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      child: Stack(
        children: [
          // Animated background
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _waveAnimation,
              builder: (context, child) {
                return Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.primary,
                        AppColors.teamAccent,
                        AppColors.growthPrimary,
                      ],
                      stops: [
                        0.0,
                        0.5 + 0.3 * _waveAnimation.value,
                        1.0,
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          // Floating shapes
          Positioned(
            top: 100,
            right: 30,
            child: AnimatedBuilder(
              animation: _waveAnimation,
              builder: (context, child) {
                return Transform.translate(
                  offset: Offset(0, 20 * _waveAnimation.value),
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: AppColors.withOpacity(AppColors.textInverse, 0.1),
                      shape: BoxShape.circle,
                    ),
                  ),
                );
              },
            ),
          ),
          Positioned(
            top: 200,
            left: 40,
            child: AnimatedBuilder(
              animation: _waveAnimation,
              builder: (context, child) {
                return Transform.translate(
                  offset: Offset(0, -15 * _waveAnimation.value),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.withOpacity(AppColors.textInverse, 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                );
              },
            ),
          ),
          // Content
          Positioned.fill(
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.withOpacity(AppColors.textInverse, 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'REVOLUTIONARY SYSTEM',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textInverse,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'PRE-BUILD YOUR',
                        style: TextStyle(
                          fontSize: 36,
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
                      RichText(
                        textAlign: TextAlign.center,
                        text: TextSpan(
                          style: TextStyle(
                            fontSize: 36,
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
                          children: [
                            TextSpan(
                              text: 'DIRECT SALES ',
                              style: TextStyle(color: AppColors.textInverse),
                            ),
                            TextSpan(
                              text: 'EMPIRE',
                              style: TextStyle(color: AppColors.warning),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppColors.withOpacity(AppColors.textInverse, 0.15),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: AppColors.withOpacity(AppColors.textInverse, 0.3),
                            width: 1,
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.psychology,
                              size: 40,
                              color: AppColors.textInverse,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Eliminate the #1 barrier to direct sales success: the struggle to build a qualified downline team.',
                              style: TextStyle(
                                fontSize: 18,
                                color: AppColors.withOpacity(AppColors.textInverse, 0.95),
                                height: 1.5,
                                fontWeight: FontWeight.w600,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildQuickStat('70K+', 'Proven'),
                          const SizedBox(width: 24),
                          _buildQuickStat('120+', 'Countries'),
                          const SizedBox(width: 24),
                          _buildQuickStat('100%', 'Free'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickStat(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: AppColors.textInverse,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.withOpacity(AppColors.textInverse, 0.8),
          ),
        ),
      ],
    );
  }

  Widget _buildJourneySection() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'YOUR SUCCESS JOURNEY',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: AppColors.textPrimary,
              letterSpacing: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'From struggling to thriving in 4 simple steps',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 40),
          _buildJourneyStep(
            step: 1,
            title: 'Join the Revolution',
            subtitle: 'FREE Registration',
            description: 'Sign up instantly with no fees, no commitments, and no barriers. Start your empire-building journey today.',
            icon: Icons.person_add_alt_1,
            gradient: AppColors.primaryGradient,
          ),
          _buildJourneyStep(
            step: 2,
            title: 'Share & Multiply',
            subtitle: 'Viral Growth System',
            description: 'Share your unique link and watch your team grow exponentially as each member does the same.',
            icon: Icons.share,
            gradient: AppColors.growthGradient,
          ),
          _buildJourneyStep(
            step: 3,
            title: 'Track & Celebrate',
            subtitle: 'Real-Time Notifications',
            description: 'Get daily excitement as notifications show your growing empire with complete transparency.',
            icon: Icons.trending_up,
            gradient: AppColors.warningGradient,
          ),
          _buildJourneyStep(
            step: 4,
            title: 'Harvest Success',
            subtitle: 'Automatic Invitations',
            description: 'When members reach ${AppConstants.projectWideDirectSponsorMin} sponsors and ${AppConstants.projectWideTotalTeamMin} team members, they\'re invited to your business opportunity with their teams ready to follow.',
            icon: Icons.celebration,
            gradient: AppColors.successGradient,
            isLast: true,
          ),
        ],
      ),
    );
  }

  Widget _buildJourneyStep({
    required int step,
    required String title,
    required String subtitle,
    required String description,
    required IconData icon,
    required LinearGradient gradient,
    bool isLast = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 32),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  gradient: gradient,
                  shape: BoxShape.circle,
                  boxShadow: AppColors.mediumShadow,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      step.toString(),
                      style: const TextStyle(
                        color: AppColors.textInverse,
                        fontWeight: FontWeight.w900,
                        fontSize: 20,
                      ),
                    ),
                    Icon(
                      icon,
                      color: AppColors.textInverse,
                      size: 20,
                    ),
                  ],
                ),
              ),
              if (!isLast)
                Container(
                  width: 3,
                  height: 60,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.primary,
                        AppColors.withOpacity(AppColors.primary, 0.3),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppColors.lightShadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
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
          ),
        ],
      ),
    );
  }

  Widget _buildTestimonialSection() {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.backgroundSecondary,
            AppColors.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: AppColors.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.format_quote,
              size: 32,
              color: AppColors.textInverse,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'FROM THE CREATOR',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
              letterSpacing: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            '"In 2009, I proved this concept works by building The Team Building Project to over 70,000 members across 120+ countries. Now, with Team Build Pro, YOU can be the admin of your own empire and experience the same exponential growth that transforms direct sales careers."',
            style: TextStyle(
              fontSize: 18,
              color: AppColors.textSecondary,
              height: 1.6,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Team Build Pro Founder',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.textInverse,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitsGrid() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Text(
            'WHY TEAM BUILD PRO WORKS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
              letterSpacing: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 1.1,
            children: [
              _buildBenefitCard(
                icon: Icons.money_off,
                title: 'Zero Barriers',
                description: 'No fees, meetings, or purchases required',
                color: AppColors.success,
              ),
              _buildBenefitCard(
                icon: Icons.visibility,
                title: 'Full Transparency',
                description: 'See your entire organization in real-time',
                color: AppColors.primary,
              ),
              _buildBenefitCard(
                icon: Icons.notifications_active,
                title: 'Daily Excitement',
                description: 'Growth notifications keep you motivated',
                color: AppColors.notificationPrimary,
              ),
              _buildBenefitCard(
                icon: Icons.chat_bubble,
                title: 'Team Communication',
                description: 'Built-in messaging for team building',
                color: AppColors.messagePrimary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitCard({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.withOpacity(color, 0.2)),
        boxShadow: AppColors.lightShadow,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(color, 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.3,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildFinalCTA() {
    return Container(
      margin: const EdgeInsets.all(24),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.teamAccent,
                  AppColors.primary,
                  AppColors.growthPrimary,
                ],
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: AppColors.heavyShadow,
            ),
            child: Column(
              children: [
                AnimatedBuilder(
                  animation: _waveAnimation,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: 1.0 + 0.1 * _waveAnimation.value,
                      child: Icon(
                        Icons.diamond,
                        size: 64,
                        color: AppColors.textInverse,
                      ),
                    );
                  },
                ),
                const SizedBox(height: 24),
                Text(
                  'YOUR EMPIRE',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textInverse,
                    letterSpacing: 2.0,
                  ),
                  textAlign: TextAlign.center,
                ),
                Text(
                  'AWAITS',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: AppColors.warning,
                    letterSpacing: 2.0,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Text(
                  'Stop dreaming about direct sales success.\nStart building your pre-qualified empire today.',
                  style: TextStyle(
                    fontSize: 18,
                    color: AppColors.withOpacity(AppColors.textInverse, 0.95),
                    height: 1.5,
                    fontWeight: FontWeight.w600,
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
                      foregroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 12,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.diamond,
                          size: 24,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'BUILD MY EMPIRE NOW',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primary,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.withOpacity(AppColors.textInverse, 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildCTAFeature(Icons.flash_on, 'Instant Access'),
                      _buildCTAFeature(Icons.security, '100% Secure'),
                      _buildCTAFeature(Icons.favorite, 'Risk Free'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCTAFeature(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: AppColors.withOpacity(AppColors.textInverse, 0.9),
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.withOpacity(AppColors.textInverse, 0.9),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              children: [
                _buildHeroSection(),
                _buildJourneySection(),
                _buildTestimonialSection(),
                _buildBenefitsGrid(),
                _buildFinalCTA(),
              ],
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _buildFloatingHeader(),
          ),
        ],
      ),
    );
  }
}
