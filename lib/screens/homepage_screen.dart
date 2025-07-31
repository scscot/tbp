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
    height += isLandscape ? 80 : 120; // safety buffer (less needed in landscape)
    
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
          const SizedBox(height: 8),
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
        const SizedBox(width: 8),
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
              text: _sponsorName ?? '',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(text: ' is building their '),
            TextSpan(
              text: _bizOpp ?? 'direct sales',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const TextSpan(
              text:
                  ' team using the Team Build Pro app, recommending you to use it too!',
            ),
          ],
        ),
      );
    }

    return const Text(
      'Transform your recruitment and team building strategy! Help prospects start building their organization immediately while your existing team members accelerate their growth - creating unstoppable momentum throughout your entire network!',
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

                              SizedBox(height: isLandscape ? 16 : 24),

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
                                      ? 'This platform was built with a clear understanding of what it takes to succeed in direct sales. It helps those just starting out by making it possible to begin building before they officially launch—so they\'re not starting from zero when it matters most.'
                                      : 'This platform was built with a clear understanding of what it takes to succeed in direct sales. It supports professionals actively growing their teams, helping them build and organize their global network effectively, creating lasting professional relationships.',
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

                              SizedBox(height: isLandscape ? 8 : 12),
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
              'BUILT FOR DIRECT SALES SUCCESS',
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
          _buildOrganizationType(
            icon: Icons.trending_up,
            title: 'Direct Sales Professionals',
            examples: 'Direct Sales • Affiliate Marketing',
            description:
                'Build, track, and grow your direct sales team with professional tools designed for your success',
            color: Colors.orange,
          ),
          _buildOrganizationType(
            icon: Icons.groups,
            title: 'Team Leaders & Recruiters',
            examples: 'Team Building • Recruitment • Leadership Development',
            description:
                'Manage your growing team with powerful analytics and communication tools',
            color: Colors.blue,
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
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 32),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  examples,
                  style: TextStyle(
                    fontSize: 12,
                    color: color.withOpacity(0.8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
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
            title: 'BUILD - Expand Your Team Network',
            description:
                '• Build meaningful professional relationships globally\n'
                '• Connect with like-minded direct sales professionals\n'
                '• Expand your team reach across 120+ countries\n'
                '• Create authentic business connections that drive results',
            color: Colors.orange,
          ),
          
          _buildOrganizationType1(
            icon: Icons.trending_up,
            title: 'GROW - Nurture Team Development',
            description:
                '• Track team growth and engagement metrics in real-time\n'
                '• Monitor qualification progress and achievements\n'
                '• Foster collaborative team building relationships\n'
                '• Strengthen your organization with data-driven insights',
            color: Colors.green,
          ),
          
          _buildOrganizationType1(
            icon: Icons.analytics,
            title: 'Advanced Team Analytics & Caching',
            description:
                '• Monitor team expansion with instant data loading\n'
                '• Receive daily team growth notifications\n'
                '• Track member engagement and qualification activity\n'
                '• Generate comprehensive team reports with cached performance\n'
                '• 90% reduction in database queries through smart caching',
            color: Colors.purple,
          ),
          
          _buildOrganizationType1(
            icon: Icons.message,
            title: 'Secure Team Communication',
            description:
                '• Built-in messaging system with privacy protection\n'
                '• Connect with team members globally\n'
                '• Share updates and opportunities safely\n'
                '• Build meaningful professional relationships',
            color: Colors.blue,
          ),
          
          _buildOrganizationType1(
            icon: Icons.notifications_active,
            title: 'Smart Notification System',
            description:
                '• Daily team growth updates\n'
                '• New team member welcome notifications\n'
                '• Important milestone and qualification alerts\n'
                '• Fully customizable notification preferences',
            color: Colors.teal,
          ),
          
          _buildOrganizationType1(
            icon: Icons.warning,
            title: 'IMPORTANT DISCLAIMERS',
            description:
                '• Team Build Pro is NOT an MLM or network marketing company\n'
                '• We do NOT pay users any money or compensation\n'
                '• We are NOT a business opportunity or income platform\n'
                '• Users pay US a subscription fee - we do NOT pay users\n'
                '• We are a team organization tool and tracking platform ONLY',
            color: Colors.red,
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
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 32),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.black87,
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
                  'Whether you\'re an experienced professional, just starting your career, or looking to expand your network, Team Build Pro helps you build meaningful professional connections worldwide.',
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
                'Building meaningful professional connections can be difficult in today\'s digital world. Many professionals struggle to expand their network beyond their immediate circle.',
            icon: Icons.warning_amber,
            color: Colors.red,
          ),
          const SizedBox(height: 16),

          _buildHowItWorksSectionCard(
            title: 'THE SOLUTION',
            content:
                'Team Build Pro provides a structured platform that helps professionals build and organize their global network systematically, creating lasting professional relationships.',
            icon: Icons.lightbulb,
            color: const Color(0xFF1A237E),
          ),
          const SizedBox(height: 16),

          _buildHowItWorksSectionCard(
            title: 'WHY IT WORKS',
            content:
                'Our platform removes traditional networking barriers by providing an accessible, user-friendly environment where professionals can connect, collaborate, and grow their networks organically.',
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
                        'Connect with like-minded professionals open to exploring $_bizOpp.',
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
                        'Team members receive an invitation to join $_bizOpp upon achieving key growth targets.',
                    icon: Icons.handshake,
                  ),

                  const SizedBox(height: 8),

                  // Key Growth Targets section
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.withOpacity(0.3)),
                    ),
                    child: Column(
                      children: [
                        const Text(
                          'KEY GROWTH TARGETS',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            _buildHowItWorksMetricCard(
                              icon: Icons.connect_without_contact,
                              value: AppConstants.projectWideDirectSponsorMin
                                  .toString(),
                              label: 'Direct Sponsors',
                            ),
                            const SizedBox(width: 16),
                            _buildHowItWorksMetricCard(
                              icon: Icons.hub,
                              value: AppConstants.projectWideTotalTeamMin
                                  .toString(),
                              label: 'Total Team Members',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.star, color: Colors.green, size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Note: Team Build Pro focuses on building genuine professional relationships and networks that can lead to meaningful career opportunities.',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.green.shade800,
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
