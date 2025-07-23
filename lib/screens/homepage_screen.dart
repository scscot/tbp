// lib/screens/homepage_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../config/app_colors.dart';
import '../config/app_constants.dart';
import '../services/session_manager.dart';
import 'new_registration_screen.dart';
import 'login_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class HomepageScreen extends StatefulWidget {
  final String? referralCode;
  final String appId;

  const HomepageScreen({
    super.key,
    this.referralCode,
    required this.appId,
  });

  @override
  State<HomepageScreen> createState() => _HomepageScreenState();
}

class _HomepageScreenState extends State<HomepageScreen>
    with TickerProviderStateMixin {
  late AnimationController _heroAnimationController;
  late Animation<double> _heroFadeAnimation;
  late Animation<Offset> _heroSlideAnimation;

  // Referral code related state
  String? _sponsorName;
  bool _isLoadingReferral = false;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _initializeReferralData();
  }

  void _setupAnimations() {
    _heroAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1200),
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

    _heroAnimationController.forward();
  }

  Future<void> _initializeReferralData() async {
    final code = widget.referralCode;
    if (kDebugMode) {
      print('🔍 Initializing with referral code: $code');
    }

    if (code == null || code.isEmpty) {
      return; // No code, nothing to do.
    }

    setState(() {
      _isLoadingReferral = true;
    });

    String? fetchedSponsorName;

    try {
      final uri = Uri.parse(
          'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code');
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        fetchedSponsorName =
            '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();

        if (fetchedSponsorName.isNotEmpty) {
          await SessionManager.instance.setReferralData(code, fetchedSponsorName);
          if (kDebugMode) {
            print('✅ HomepageScreen: Referral data cached successfully');
          }
        } else {
          fetchedSponsorName = null; // Treat empty name as invalid.
        }
      } else {
        if (kDebugMode) {
          print(
              'Failed to get sponsor data. Status code: ${response.statusCode}');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print("Error finding sponsor: $e.");
      }
    } finally {
      if (mounted) {
        setState(() {
          _sponsorName = fetchedSponsorName;
          _isLoadingReferral = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _heroAnimationController.dispose();
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
          // Background pattern (removed since image doesn't exist)
          Positioned.fill(
            child: Opacity(
              opacity: 0.1,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.textInverse.withOpacity(0.1),
                      AppColors.textInverse.withOpacity(0.05),
                    ],
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
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.textInverse.withOpacity(0.15),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.rocket_launch,
                              size: 48,
                              color: AppColors.textInverse,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'BUILD YOUR',
                            style: TextStyle(
                              fontSize: 28,
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
                            'GLOBAL PROFESSIONAL',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textInverse.withOpacity(0.9),
                              letterSpacing: 1.5,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 10),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(30),
                              boxShadow: AppColors.mediumShadow,
                            ),
                            child: Text(
                              'COMMUNITY',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textInverse,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 8.0),
                            child: Text(
                              'An established platform that helps you organize and expand your professional community globally through meaningful connections.',
                              style: TextStyle(
                                fontSize: 16,
                                color: AppColors.textInverse.withOpacity(0.95),
                                height: 1.4,
                                fontWeight: FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                            ),
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
            description:
                'Start building your professional community with our platform - includes a 30-day trial period.',
            icon: Icons.person_add,
            color: AppColors.primary,
          ),
          _buildProcessStep(
            step: 2,
            title: 'Share Your Link',
            description:
                'Share your unique invitation link with your professional contacts. Watch your community grow as they join and connect.',
            icon: Icons.share,
            color: AppColors.growthPrimary,
          ),
          _buildProcessStep(
            step: 3,
            title: 'Stay Connected',
            description:
                'Receive notifications as new professionals join your growing community and engage with your connections.',
            icon: Icons.notifications_active,
            color: AppColors.notificationPrimary,
          ),
          _buildProcessStep(
            step: 4,
            title: 'Unlock Opportunities',
            description:
                'When members reach ${AppConstants.projectWideDirectSponsorMin} direct connections and ${AppConstants.projectWideTotalTeamMin} total community members, they may receive professional opportunities.',
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
                    color: color.withOpacity(0.3),
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
              color: AppColors.textInverse.withOpacity(0.9),
              letterSpacing: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            'PROFESSIONAL COMMUNITY!',
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
            'Join professionals worldwide who are building meaningful connections through Team Build Pro.',
            style: TextStyle(
              fontSize: 16,
              color: AppColors.textInverse.withOpacity(0.95),
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
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.rocket_launch,
                    size: 20,
                    color: AppColors.growthPrimary,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'START 30-DAY TRIAL',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.growthPrimary,
                        letterSpacing: 0.8,
                      ),
                      overflow: TextOverflow.ellipsis,
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

  // Helper widget for the loading/sponsor banner
  Widget _buildStatusBanner() {
    if (_isLoadingReferral) {
      return Container(
        width: double.infinity,
        color: AppColors.primaryDark,
        padding: const EdgeInsets.symmetric(vertical: 12.0),
        child: const Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              ),
              SizedBox(width: 12),
              Text(
                'Checking invitation...',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              )
            ],
          ),
        ),
      );
    }

    if (_sponsorName != null && _sponsorName!.isNotEmpty) {
      return Container(
        width: double.infinity,
        color: AppColors.primaryDark,
        padding: const EdgeInsets.symmetric(vertical: 12.0),
        child: Text(
          'Welcome! You were invited by $_sponsorName',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
          textAlign: TextAlign.center,
        ),
      );
    }

    // Return an empty container if there's nothing to show
    return const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildCustomAppBar(context),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildStatusBanner(),
            _buildHeroSection(),
            _buildHowItWorksSection(),
            _buildCTASection(),
            _buildFooterSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: AppColors.backgroundTertiary,
      child: Column(
        children: [
          const Divider(color: AppColors.border),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => PrivacyPolicyScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text(
                  'Privacy Policy',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const Text(
                ' | ',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
              ),
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => TermsOfServiceScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text(
                  'Terms of Service',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.textSecondary,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '© ${DateTime.now().year} Team Build Pro. All rights reserved.',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textTertiary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildCustomAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      automaticallyImplyLeading: false,
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
      ),
      title: const Text(
        'Team Build Pro',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      centerTitle: true,
      actions: [
        TextButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => LoginScreen(appId: widget.appId),
              ),
            );
          },
          style: TextButton.styleFrom(
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.login,
                color: Colors.white,
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                'Log In',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}
