// lib/screens/homepage_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:math' as math;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/session_manager.dart';
import '../services/auth_service.dart';
import 'new_registration_screen.dart';
import 'login_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import '../config/app_constants.dart';
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
  late AnimationController _networkAnimationController;
  late Animation<double> _heroFadeAnimation;
  late Animation<Offset> _heroSlideAnimation;
  late Animation<double> _networkAnimation;

  // Referral code related state
  String? _sponsorName;
  String? _bizOpp = 'your opportunity';
  String? _bizOpp1;
  bool _isLoggingOut = true;
  bool _hasPerformedLogout = false;

  @override
  void initState() {
    super.initState();
    _setupAnimations();
    _performLogoutAndInitialize();
  }

  Future<void> _performLogoutAndInitialize() async {
    try {
      if (kDebugMode) {
        print(
            '🔐 HOMEPAGE: Checking if logout is needed before homepage render...');
      }

      final authService = AuthService();
      final currentUser = FirebaseAuth.instance.currentUser;
      final hasReferralCode =
          widget.referralCode != null && widget.referralCode!.isNotEmpty;

      if (hasReferralCode && currentUser != null) {
        if (kDebugMode) {
          print(
              '🔐 HOMEPAGE: Found referral code and existing user session, performing logout...');
        }

        await authService.signOut();
        await SessionManager.instance.clearSession();
        await SessionManager.instance.clearReferralData();

        if (kDebugMode) {
          print('✅ HOMEPAGE: Logout completed successfully');
        }

        await Future.delayed(const Duration(milliseconds: 500));
      } else {
        if (kDebugMode) {
          print(
              '🔐 HOMEPAGE: No referral code or no user session, skipping logout');
        }
      }

      _hasPerformedLogout = true;
    } catch (e) {
      if (kDebugMode) {
        print('❌ HOMEPAGE: Error during logout check: $e');
      }
      _hasPerformedLogout = true;
    } finally {
      if (mounted) {
        setState(() {
          _isLoggingOut = false;
        });
        _initializeReferralData();
      }
    }
  }

  void _setupAnimations() {
    _heroAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _networkAnimationController = AnimationController(
      duration: const Duration(seconds: 8),
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

    _networkAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _networkAnimationController,
      curve: Curves.linear,
    ));

    _heroAnimationController.forward();
    _networkAnimationController.repeat();
  }

  Future<void> _initializeReferralData() async {
    final code = widget.referralCode;
    if (kDebugMode) {
      print('🔍 Initializing with referral code: $code');
    }

    if (code == null || code.isEmpty) {
      return;
    }

    setState(() {});

    String? fetchedSponsorName;
    String? fetchedSponsorUid;
    String? fetchedBizOpp;

    try {
      final uri = Uri.parse(
          'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code');
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        fetchedSponsorName =
            '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();
        fetchedSponsorUid = data['uid'] as String?;

        if (fetchedSponsorName.isNotEmpty) {
          await SessionManager.instance
              .setReferralData(code, fetchedSponsorName);
          if (kDebugMode) {
            print('✅ HomepageScreen: Referral data cached successfully');
          }
        } else {
          fetchedSponsorName = null;
        }

        // Fetch biz_opp from admin_settings using sponsor's upline_admin
        if (fetchedSponsorUid != null) {
          try {
            // Get sponsor's user document to find their upline_admin
            final sponsorDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(fetchedSponsorUid)
                .get();

            if (sponsorDoc.exists) {
              final sponsorData = sponsorDoc.data();
              String? uplineAdmin;

              // If sponsor is admin, use their UID, otherwise use their upline_admin
              if (sponsorData?['role'] == 'admin') {
                uplineAdmin = fetchedSponsorUid;
              } else {
                uplineAdmin = sponsorData?['upline_admin'] as String?;
              }

              // Fetch biz_opp from admin_settings
              if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
                final adminSettingsDoc = await FirebaseFirestore.instance
                    .collection('admin_settings')
                    .doc(uplineAdmin)
                    .get();

                if (adminSettingsDoc.exists) {
                  final adminData = adminSettingsDoc.data();
                  fetchedBizOpp = adminData?['biz_opp'] as String?;
                  if (kDebugMode) {
                    print('✅ HomepageScreen: Fetched biz_opp: $fetchedBizOpp');
                  }
                }
              }
            }
          } catch (e) {
            if (kDebugMode) {
              print('❌ Error fetching biz_opp: $e');
            }
          }
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
          _bizOpp = fetchedBizOpp;
          _bizOpp1 = fetchedBizOpp;
        });
      }
    }
  }

  @override
  void dispose() {
    _heroAnimationController.dispose();
    _networkAnimationController.dispose();
    super.dispose();
  }

void _navigateToLogin() {
    if (_hasPerformedLogout) {
      // Dismiss the homepage to reveal the underlying login screen
      Navigator.of(context).pop();
    } else {
      // This logic ensures the pop only happens after the initial logout check is complete
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          _navigateToLogin();
        }
      });
    }
  }

  void _navigateToRegistration() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => NewRegistrationScreen(
          referralCode: widget.referralCode,
          appId: widget.appId,
        ),
      ),
    );
  }

  Widget _buildAnimatedNetworkBackground() {
    return AnimatedBuilder(
      animation: _networkAnimation,
      builder: (context, child) {
        return CustomPaint(
          painter: NetworkNodesPainter(_networkAnimation.value),
          size: Size.infinite,
        );
      },
    );
  }

  Widget _buildPlatformLogo() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Colors.white.withOpacity(0.2),
            Colors.white.withOpacity(0.1),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        Icons.groups_3,
        size: 48,
        color: Colors.white,
      ),
    );
  }

  double _calculateContentHeight(bool isLandscape) {
    double height = 0;
    height += isLandscape ? 12 : 32; // top spacing (reduced for landscape)
    height += isLandscape ? 60 : 80; // platform logo (smaller in landscape)
    height += isLandscape ? 12 : 24; // spacing
    height += isLandscape ? 45 : 60; // main title (smaller in landscape)
    height += isLandscape ? 12 : 24; // spacing  
    height += isLandscape ? 35 : 50; // subtitle badge (smaller in landscape)
    height += isLandscape ? 12 : 24; // spacing
    height += isLandscape ? 100 : 140; // value proposition text (less in landscape)
    height += isLandscape ? 12 : 24; // spacing
    height += _estimateWelcomeCardHeight(isLandscape); // dynamic card with landscape consideration
    height += isLandscape ? 6 : 12; // bottom spacing
    height += isLandscape ? 20 : 30; // safety buffer (less needed in landscape)
    
    return height;
  }

  double _estimateWelcomeCardHeight(bool isLandscape) {
    if (_sponsorName != null && _sponsorName!.isNotEmpty) {
      return isLandscape ? 100 : 120; // Personal invitation card (shorter in landscape)
    } else {
      return isLandscape ? 140 : 180; // Innovative approach card (shorter in landscape)
    }
  }

  Widget _buildDynamicWelcomeSection() {
    final bool hasReferral = _sponsorName != null && _sponsorName!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.green.withOpacity(0.2),
            Colors.green.withOpacity(0.1)
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.withOpacity(0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildWelcomeHeader(hasReferral),
          const SizedBox(height: 16),
          _buildWelcomeContent(hasReferral),
        ],
      ),
    );
  }

  Widget _buildWelcomeHeader(bool hasReferral) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: const BoxDecoration(
            color: Colors.green,
            shape: BoxShape.circle,
          ),
          child: Icon(
            hasReferral ? Icons.person_add : Icons.trending_up,
            color: Colors.white,
            size: 16,
          ),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            hasReferral ? 'PERSONAL INVITATION' : 'INNOVATIVE APPROACH',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 1.0,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWelcomeContent(bool hasReferral) {
    if (hasReferral) {
      // REVISED RichText for a more direct and personal invitation
      return RichText(
        textAlign: TextAlign.center,
        text: TextSpan(
          style: const TextStyle(
            fontSize: 14,
            color: Colors.white,
            fontWeight: FontWeight.w500,
          ),
          children: [
            TextSpan(
              text: _sponsorName ?? 'A team leader',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(
                text: ' is inviting you to get a head start on building your '),
            TextSpan(
              text: _bizOpp ?? 'direct sales',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(
              text: ' team with the Team Build Pro app.',
            ),
          ],
        ),
      );
    }

    // This text is already excellent. No changes needed.
    return const Text(
      'Transform your recruitment and team building strategy! Help prospects start building their organization immediately and your existing team members accelerate their growth - creating unstoppable momentum throughout your entire network!',
      style: TextStyle(
        fontSize: 14,
        color: Colors.white,
        fontWeight: FontWeight.w500,
      ),
      textAlign: TextAlign.center,
    );
  }


  Widget _buildHeroSection() {
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    final isLandscape = screenWidth > screenHeight;
    
    // Calculate content-based height
    final baseContentHeight = _calculateContentHeight(isLandscape);
    final safeHeight = screenHeight - MediaQuery.of(context).padding.top - kToolbarHeight;
    final optimalHeight = math.min(baseContentHeight, safeHeight);

    return Container(
      height: optimalHeight, // Use calculated height instead of BoxConstraints
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF0A0E27), // Deep navy
            Color(0xFF1A237E), // Indigo
            Color(0xFF3949AB), // Material indigo
          ],
        ),
      ),
      child: Stack(
        children: [
          // Animated network nodes background
          _buildAnimatedNetworkBackground(),

          SafeArea(
            child: Padding(
              padding: EdgeInsets.all(isLandscape ? 12.0 : 16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                      FadeTransition(
                        opacity: _heroFadeAnimation,
                        child: SlideTransition(
                          position: _heroSlideAnimation,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(height: isLandscape ? 16 : 32),
                              _buildPlatformLogo(),
                              SizedBox(height: isLandscape ? 16 : 24),

                              // Main headline
                              ShaderMask(
                                shaderCallback: (bounds) => LinearGradient(
                                  colors: [Colors.white, Colors.blue.shade200],
                                ).createShader(bounds),
                                child: Text(
                                  'TEAM BUILD PRO',
                                  style: TextStyle(
                                    fontSize: isLandscape ? 28 : 32,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: 2.5,
                                    height: 1.1,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),

                              SizedBox(height: isLandscape ? 16 : 32),

                              // Subtitle
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 6),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Colors.orange, Colors.deepOrange],
                                  ),
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                child: Text(
                                  (_sponsorName != null &&
                                          _sponsorName!.isNotEmpty)
                                      ? 'JUMPSTART YOUR TEAM GROWTH'
                                      : 'PROVEN TEAM BUILDING SYSTEM',
                                  style: TextStyle(
                                    fontSize: isLandscape ? 12 : 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                              ),

                              SizedBox(height: isLandscape ? 16 : 24),

                              // Value proposition
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 8),
                                child: Text(
                                  (_sponsorName != null &&
                                          _sponsorName!.isNotEmpty)
                                      ? 'Get the ultimate head start. This platform empowers aspiring leaders to pre-build their team before day one, ensuring you launch your new venture with powerful, immediate momentum.'
                                      : 'From aspiring leaders to seasoned mentors, Team Build Pro provides the tools to build, manage, and scale your global network at every stage of your direct sales journey.',
                                  style: TextStyle(
                                    fontSize: isLandscape ? 14 : 16,
                                    color: Colors.white,
                                    height: 1.4,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),

                              SizedBox(height: isLandscape ? 16 : 24),

                              // Sponsor welcome or stats
                              _buildDynamicWelcomeSection(),

                              // SizedBox(height: isLandscape ? 8 : 12),
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

  Widget _buildOrganizationShowcase() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.white, Colors.blue.shade50],
        ),
      ),
      child: Column(
        children: [
          const Center(
            child: Text(
              'BUILT FOR EVERY\nSTAGE OF SUCCESS', // Title subtly revised for inclusivity
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A237E),
                letterSpacing: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),

          // Card 1: For those who haven't started yet.
          _buildOrganizationType(
            icon: Icons.rocket_launch,
            title: 'For Aspiring Leaders',
            examples: 'Pre-Building • Head Start • Momentum',
            description:
                'Get a powerful head start. Begin building your team before you officially join an opportunity and launch with unstoppable momentum.',
            color: Colors.orange,
          ),

          // Card 2: For those actively building.
          _buildOrganizationType(
            icon: Icons.trending_up,
            title: 'For Active Team Builders',
            examples: 'Team Growth • Prospecting • Analytics',
            description:
                'Efficiently track, manage, and expand your organization with powerful analytics and seamless, secure communication tools.',
            color: Colors.blue,
          ),

          // Card 3: For established leaders.
          _buildOrganizationType(
            icon: Icons.groups,
            title: 'For Seasoned Mentors',
            examples: 'Leadership • Duplication • Global Reach',
            description:
                'Cultivate a thriving global network, mentor emerging leaders, and ensure sustainable growth across your entire organization.',
            color: Colors.purple,
          ),
        ],
      ),
    );
  }

  Widget _buildOrganizationType({
    required IconData icon,
    required String title,
    required String examples,
    required String description,
    required Color color,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row with icon
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: color,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Examples subtitle
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: Text(
              examples,
              style: TextStyle(
                fontSize: 12,
                color: color.withOpacity(0.7),
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 12),
          // Description
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: Text(
              description,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
                height: 1.5,
                fontWeight: FontWeight.w400,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHighPerformance() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.white, Colors.blue.shade50],
        ),
      ),
      child: Column(
        children: [
          const Center(
            child: Text(
              'HIGH-PERFORMANCE TEAM BUILDING',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A237E),
                letterSpacing: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),

          _buildOrganizationType1(
            icon: Icons.rocket_launch,
            title: 'BUILD & GROW - Complete Team Development',
            description:
                '• Expand your team reach across multiple countries worldwide\n'
                '• Connect with like-minded direct sales professionals\n'
                '• Track team growth and engagement metrics in real-time\n'
                '• Monitor qualification progress and achievements\n'
                '• Foster collaborative team building relationships',
            color: Colors.orange,
          ),

          // REVISED Card 2: Focuses on user benefits instead of technical jargon.
          _buildOrganizationType1(
            icon: Icons.insights, // Changed icon to better reflect "insights"
            title: 'POWERFUL INSIGHTS, INSTANTLY', // New, benefit-driven title
            description: '• Access real-time team analytics with zero delays\n'
                '• Generate comprehensive team reports in an instant\n'
                '• Instantly track growth and monitor key performance metrics\n'
                '• Experience a lightning-fast interface that never slows you down\n'
                '• Make smarter decisions with essential data at your fingertips',
            color: Colors.purple,
          ),

          _buildOrganizationType1(
            icon: Icons.message,
            title: 'SECURE GLOBAL COMMUNICATION & COLLABORATION',
            description:
                '• Built-in messaging system with enterprise-grade security\n'
                '• Daily team growth updates and milestone notifications\n'
                '• Share updates and opportunities safely across your network\n'
                '• Customizable notification preferences for optimal workflow',
            color: Colors.blue,
          ),

          _buildOrganizationType1(
            icon: Icons.info,
            title: 'Important Disclaimers',
            description:
                '• Team Build Pro is NOT a business opportunity or income platform\n'
                '• We do NOT pay users any money or compensation\n'
                '• We are a team building tool and tracking platform ONLY',
            color: Colors.green,
          ),
        ],
      ),
    );
  }

  Widget _buildOrganizationType1({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row with icon
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: color,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Description with improved bullet point formatting
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: _buildBulletPointList(description),
          ),
        ],
      ),
    );
  }

  Widget _buildWhyChooseTeamBuildPro() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.grey.shade50, Colors.white],
        ),
      ),
      child: Column(
        children: [
          const Center(
            child: Text(
              'WHY CHOOSE\nTEAM BUILD PRO',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1A237E),
                letterSpacing: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),

          // Card 1: Focuses on the transparent business model. (No changes)
          _buildOrganizationType1(
            icon: Icons.credit_card,
            title: 'TRANSPARENT SUBSCRIPTION MODEL',
            description:
                '• 30-day free trial with full access to all premium features\n'
                '• Clear monthly subscription fee with no hidden costs\n'
                '• Complete transparency in pricing and billing\n'
                '• Access to all team management and networking tools\n'
                '• Cancel anytime with no long-term commitments',
            color: Colors.green,
          ),

          // Card 2: Clearly defines the target audience. (No changes)
          _buildOrganizationType1(
            icon: Icons.people,
            title: 'PERFECT FOR PROFESSIONALS',
            description:
                '• Direct sales professionals building and managing teams\n'
                '• Team leaders managing growing organizations\n'
                '• Entrepreneurs building collaborative partnerships\n'
                '• Sales professionals nurturing team relationships\n'
                '• Anyone serious about professional team building excellence',
            color: Colors.blue,
          ),

          // REVISED Card 3: Focuses on Trust, Security, and Quality.
          _buildOrganizationType1(
            icon: Icons.verified_user, // Changed icon for better specificity
            title: 'TRUST, SECURITY & PERFORMANCE', // New, clearer title
            description:
                '• Apple Store compliant with enterprise-grade security\n'
                '• Engineered for a lightning-fast, reliable experience\n'
                '• User-friendly interface designed for efficient team management\n'
                '• Global reach to support worldwide network building\n'
                '• Continuous improvements with regular feature updates',
            color: Colors.purple,
          ),
        ],
      ),
    );
  }

  Widget _buildBulletPointList(String description) {
    // Split the description by newlines and filter out empty lines
    final lines = description.split('\n').where((line) => line.trim().isNotEmpty).toList();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.asMap().entries.map((entry) {
        final line = entry.value.trim();
        
        // Check if line starts with bullet point
        if (line.startsWith('•')) {
          final bulletText = line.substring(1).trim(); // Remove bullet and trim
          return Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 6.0),
                  width: 4,
                  height: 4,
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    bulletText,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Colors.black87,
                      height: 1.5,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          );
        } else {
          // Handle non-bullet text (fallback)
          return Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Text(
              line,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.black87,
                height: 1.5,
                fontWeight: FontWeight.w400,
              ),
            ),
          );
        }
      }).toList(),
    );
  }

  

  Widget _buildSmartOnboarding() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const Text(
            'GET STARTED TODAY!',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A237E),
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 24),

          // Dynamic onboarding based on referral
          if (_sponsorName != null)
            _buildInvitedUserFlow()
          else
            _buildDirectJoinFlow(),

          const SizedBox(height: 24),

          // Trust indicators
          _buildTrustIndicators(),
        ],
      ),
    );
  }

  Widget _buildInvitedUserFlow() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.green.shade50, Colors.green.shade100],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.green.shade300),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Colors.green,
                  shape: BoxShape.circle,
                ),
                child:
                    const Icon(Icons.person_add, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Personal Invitation',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.green,
                      ),
                    ),
                    Text(
                      '$_sponsorName has invited you to download the app and get started!',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.green.shade800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _navigateToRegistration,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Begin Free 30-Day Trial!',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDirectJoinFlow() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.blue.shade50, Colors.blue.shade100],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blue.shade300),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Colors.blue,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.rocket_launch,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Join The Revolution',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.blue,
                      ),
                    ),
                    Text(
                      'Join thousands of direct sales professionals worldwide who are using the Team Build Pro app to grow their teams.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.blue,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _navigateToRegistration,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'BEGIN FREE 30-DAY TRIAL!',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustIndicators() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildTrustBadge(Icons.security, 'Enterprise\nSecurity'),
        _buildTrustBadge(Icons.verified_user, 'Verified\nPlatform'),
        _buildTrustBadge(Icons.support_agent, '24/7\nSupport'),
      ],
    );
  }

  Widget _buildTrustBadge(IconData icon, String label) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: Colors.grey.shade600, size: 24),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey.shade600,
            fontWeight: FontWeight.w500,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildStatusBanner() {
    // Remove redundant banner - invitation info is shown in hero section
    return const SizedBox.shrink();
  }

  Widget _buildHowItWorks() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.grey.shade50,
      child: Column(
        children: [
          // Section Title
          const Text(
            'HOW IT WORKS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A237E),
              letterSpacing: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Hero Section
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1A237E), Color(0xFF3949AB)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.groups,
                  size: 48,
                  color: Colors.white,
                ),
                const SizedBox(height: 16),
                const Text(
                  'CREATING MOMENTUM',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: 1.2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(


(_sponsorName != null && _sponsorName!.isNotEmpty)
                      ? 'For the forward-thinking leader about to join $_bizOpp, the Team Build Pro app is your tool to build your team before day one, positioning you for immediate success.'
                      : 'For the ambitious direct sales professional, whether a beginner, rising star, or seasoned leader, the Team Build Pro app is your tool for building a powerful global organization, one meaningful connection at a time.',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.9),
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Featured Collaboration Section
          Card(
            elevation: 4,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: const Color(0xFF1A237E).withOpacity(0.2), width: 2),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1A237E).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.star,
                            color: Color(0xFF1A237E), size: 28),
                      ),
                      const SizedBox(width: 16),
                      const Expanded(
                        child: Text(
                          'Featured Opportuntiy',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1A237E),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF1A237E).withOpacity(0.05),
                          Colors.green.withOpacity(0.05),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: const Color(0xFF1A237E).withOpacity(0.3),
                          width: 1),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1A237E).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.business,
                            color: Color(0xFF1A237E),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _bizOpp1 ?? 'Your Company',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A237E),
                              letterSpacing: 0.5,
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

          // The Challenge, Solution, Why It Works
          _buildHowItWorksSectionCard(
            title: 'THE CHALLENGE',
            content:
                'Starting from zero is the biggest hurdle in direct sales. Professionals often struggle to find motivated prospects and build momentum quickly, leading to frustration and slow growth.',
            icon: Icons.warning,
            color: Colors.red,
          ),
          const SizedBox(height: 16),

          _buildHowItWorksSectionCard(
            title: 'THE SOLUTION',
            content:
                'The Team Build Pro app offers a unique system for pre-building your team. Our platform provides the tools to cultivate a network of interested prospects before day one, turning a cold start into a running start.',
            icon: Icons.lightbulb,
            color: const Color(0xFF1A237E),
          ),
          const SizedBox(height: 16),

          _buildHowItWorksSectionCard(
            title: 'WHY IT WORKS',
            content:
                'By focusing on relationship-building first, our platform creates genuine momentum. When prospects are part of a growing community from the beginning, they are more engaged, motivated, and prepared for success the moment they officially join.',
            icon: Icons.trending_up,
            color: Colors.green,
          ),
          const SizedBox(height: 24),

          // The Process
          Card(
            elevation: 4,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.settings,
                            color: Colors.orange, size: 28),
                      ),
                      const SizedBox(width: 16),
                      const Text(
                        'THE PROCESS',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.orange,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _buildHowItWorksProcessStep(
                    step: 1,
                    title: 'INVITE - Expand Your Network',
                    description:
                        'Connect with like-minded professionals open to exploring ${_bizOpp ?? 'your opportunity'}.',
                    icon: Icons.connect_without_contact,
                  ),
                  _buildHowItWorksProcessStep(
                    step: 2,
                    title: 'CULTIVATE - Nurture Professional Bonds',
                    description:
                        'Foster authentic relationships as your network grows, creating a thriving network of professionals who support each other\'s success.',
                    icon: Icons.psychology,
                  ),
                  _buildHowItWorksProcessStep(
                    step: 3,
                    title: 'PARTNER - Work Together For Mutual Success',
                    description:
                        "Team members receive an invitation to join ${_bizOpp ?? 'your opportunity'} upon achieving key growth targets.",
                    icon: Icons.handshake,
                  ),

                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorksSectionCard({
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
          border: Border.all(color: color.withOpacity(0.2), width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
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
              style: const TextStyle(
                fontSize: 16,
                height: 1.6,
                color: Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHowItWorksProcessStep({
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
                  color: Colors.orange.withOpacity(0.1),
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

  Widget _buildHowItWorksMetricCard({
    required IconData icon,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Colors.orange, Colors.deepOrange],
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, size: 32, color: Colors.white),
            const SizedBox(height: 12),
            Text(
              value,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: Colors.white.withOpacity(0.9),
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
    // Show loading screen while logout is in progress
    if (_isLoggingOut) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF0A0E27),
                Color(0xFF1A237E),
                Color(0xFF3949AB),
              ],
            ),
          ),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [
                        Colors.white.withOpacity(0.2),
                        Colors.white.withOpacity(0.1),
                      ],
                    ),
                  ),
                  child: const Icon(
                    Icons.hub_outlined,
                    size: 60,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'TEAM BUILD PRO',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 2.0,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Initializing platform...',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: _buildCustomAppBar(context),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildStatusBanner(),
            _buildHeroSection(),
            _buildOrganizationShowcase(),
            _buildHighPerformance(),
            _buildHowItWorks(),
            _buildWhyChooseTeamBuildPro(),
            _buildSmartOnboarding(),
            _buildFooterSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.grey.shade100,
      child: Column(
        children: [
          const Divider(color: Colors.grey),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          PrivacyPolicyScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text(
                  'Privacy Policy',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const Text(
                ' | ',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          TermsOfServiceScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text(
                  'Terms of Service',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
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
              color: Colors.grey,
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
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF0A0E27),
              Color(0xFF1A237E),
              Color(0xFF3949AB),
            ],
          ),
        ),
      ),
      title: const Text(
        'TEAM BUILD PRO',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      centerTitle: true,
      actions: [
        TextButton(
          onPressed: _navigateToLogin,
          style: TextButton.styleFrom(
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.login,
                color: Colors.white,
                size: 18,
              ),
              SizedBox(width: 6),
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

// Custom painter for animated network background
class NetworkNodesPainter extends CustomPainter {
  final double animationValue;

  NetworkNodesPainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.1)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    final nodePaint = Paint()
      ..color = Colors.white.withOpacity(0.2)
      ..style = PaintingStyle.fill;

    // Create animated network nodes
    final nodes = <Offset>[];
    for (int i = 0; i < 8; i++) {
      final angle = (i * 2 * math.pi / 8) + (animationValue * 2 * math.pi);
      final radius = size.width * 0.3;
      final x = size.width / 2 + radius * math.cos(angle);
      final y = size.height / 2 + radius * math.sin(angle);
      nodes.add(Offset(x, y));
    }

    // Draw connections
    for (int i = 0; i < nodes.length; i++) {
      for (int j = i + 1; j < nodes.length; j++) {
        if ((i - j).abs() <= 2) {
          canvas.drawLine(nodes[i], nodes[j], paint);
        }
      }
    }

    // Draw nodes
    for (final node in nodes) {
      canvas.drawCircle(node, 4, nodePaint);
    }
  }

  @override
  bool shouldRepaint(NetworkNodesPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}
