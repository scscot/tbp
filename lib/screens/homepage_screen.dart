// lib/screens/homepage_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:math' as math;
import 'package:firebase_auth/firebase_auth.dart';
import '../services/session_manager.dart';
import '../services/auth_service.dart';
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
  late AnimationController _networkAnimationController;
  late Animation<double> _heroFadeAnimation;
  late Animation<Offset> _heroSlideAnimation;
  late Animation<double> _networkAnimation;

  // Referral code related state
  String? _sponsorName;
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
        print('🔐 HOMEPAGE: Checking if logout is needed before homepage render...');
      }
      
      final authService = AuthService();
      final currentUser = FirebaseAuth.instance.currentUser;
      final hasReferralCode = widget.referralCode != null && widget.referralCode!.isNotEmpty;
      
      if (hasReferralCode && currentUser != null) {
        if (kDebugMode) {
          print('🔐 HOMEPAGE: Found referral code and existing user session, performing logout...');
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
          print('🔐 HOMEPAGE: No referral code or no user session, skipping logout');
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

    setState(() {
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
          fetchedSponsorName = null;
        }
      } else {
        if (kDebugMode) {
          print('Failed to get sponsor data. Status code: ${response.statusCode}');
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
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => LoginScreen(appId: widget.appId),
        ),
      );
    } else {
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

  Widget _buildDynamicWelcomeSection() {
    if (_sponsorName != null && _sponsorName!.isNotEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.green.withOpacity(0.2), Colors.green.withOpacity(0.1)],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.green.withOpacity(0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: Colors.green,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_add, color: Colors.white, size: 16),
                ),
                const SizedBox(width: 8),
                const Flexible(
                  child: Text(
                    'PERSONAL INVITATION',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '$_sponsorName has invited you to join their professional network infrastructure.',
              style: const TextStyle(
                fontSize: 14,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

  return const SizedBox.shrink();
  }


  Widget _buildHeroSection() {
    return Container(
      constraints: BoxConstraints(
        minHeight: MediaQuery.of(context).size.height * 0.5, // Reduced from 0.6
        maxHeight: MediaQuery.of(context).size.height * 0.65, // Reduced from 0.8
      ),
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
              padding: const EdgeInsets.all(16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center, // Changed from spaceEvenly
                mainAxisSize: MainAxisSize.min,
                children: [
                  FadeTransition(
                    opacity: _heroFadeAnimation,
                    child: SlideTransition(
                      position: _heroSlideAnimation,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: 32), 
                          _buildPlatformLogo(),
                          const SizedBox(height: 24), 
                          
                          // Main headline
                          ShaderMask(
                            shaderCallback: (bounds) => LinearGradient(
                              colors: [Colors.white, Colors.blue.shade200],
                            ).createShader(bounds),
                            child: const Text(
                              'TEAM BUILD PRO',
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 2.5,
                                height: 1.1,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          
                          const SizedBox(height: 16), 
                          
                          // Subtitle
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Colors.orange, Colors.deepOrange],
                              ),
                              borderRadius: BorderRadius.circular(30),
                            ),
                            child: const Text(
                              'DIRECT SALES SUCCESS PLATFORM',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                          
                          const SizedBox(height: 16),
                          
                          // Value proposition
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8),
                            child: Text(
                              'The comprehensive platform designed specifically for direct sales professionals to systematically build and manage their teams.',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.white,
                                height: 1.4,
                                fontWeight: FontWeight.w500,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          
                          const SizedBox(height: 24), // Reduced from 24
                          
                          // Sponsor welcome or stats
                          _buildDynamicWelcomeSection(),
                          
                          const SizedBox(height: 12), // Add bottom spacing
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

  Widget _buildPlatformCapabilities() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.grey.shade50,
      child: Column(
        children: [
          const Text(
            'ENTERPRISE CAPABILITIES',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A237E),
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          
          Row(
            children: [
              Expanded(
                child: _buildCapabilityCard(
                  icon: Icons.group,
                  title: 'Network Hub',
                  description: 'Centralized platform connecting professionals across organizations',
                  color: Colors.blue,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildCapabilityCard(
                  icon: Icons.analytics_outlined,
                  title: 'Growth Analytics',
                  description: 'Real-time insights and performance tracking for your network',
                  color: Colors.green,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: _buildCapabilityCard(
                  icon: Icons.security_outlined,
                  title: 'Enterprise Security',
                  description: 'Bank-level security protecting your business relationships',
                  color: Colors.orange,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildCapabilityCard(
                  icon: Icons.rocket_launch_outlined,
                  title: 'Scale Ready',
                  description: 'Built to support organizations from startup to enterprise',
                  color: Colors.purple,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCapabilityCard({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
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
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: const TextStyle(
              fontSize: 14,
              color: Colors.black87,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
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
          const Text(
            'BUILT FOR DIRECT SALES SUCCESS',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1A237E),
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          
          _buildOrganizationType(
            icon: Icons.trending_up,
            title: 'Direct Sales Professionals',
            examples:
                'Network Marketing • MLM • Direct Sales • Affiliate Marketing',
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

  Widget _buildSuccessMetrics() {
    return Container(
      margin: const EdgeInsets.all(24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF1A237E),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text(
            'NETWORK IMPACT',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(
                  number: '10K+',
                  label: 'Active Professionals',
                  icon: Icons.people_outline,
                ),
              ),
              Expanded(
                child: _buildMetricCard(
                  number: '500+',
                  label: 'Organizations',
                  icon: Icons.corporate_fare_outlined,
                ),
              ),
              Expanded(
                child: _buildMetricCard(
                  number: '50K+',
                  label: 'Connections Made',
                  icon: Icons.handshake_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String number,
    required String label,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Icon(icon, color: Colors.white, size: 32),
          const SizedBox(height: 12),
          Text(
            number,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withOpacity(0.8),
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
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
            'JOIN TEAM BUILD PRO',
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
                child: const Icon(Icons.person_add, color: Colors.white, size: 20),
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
                      'Welcome! $_sponsorName has invited you to join their professional network.',
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
                'Accept Invitation & Join',
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
                child: const Icon(Icons.rocket_launch, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Start Your Network',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.blue,
                      ),
                    ),
                    Text(
                      'Join as a founding member and build your professional infrastructure.',
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
                'Join TEAM BUILD PRO',
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
            _buildSuccessMetrics(),
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
                      builder: (context) => PrivacyPolicyScreen(appId: widget.appId),
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
                      builder: (context) => TermsOfServiceScreen(appId: widget.appId),
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
