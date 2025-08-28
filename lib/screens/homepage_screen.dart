import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:firebase_auth/firebase_auth.dart';

// App imports
import '../services/session_manager.dart';
import '../config/app_colors.dart';
import '../widgets/header_widgets.dart';
import 'login_screen.dart';
import 'new_registration_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';

class HomepageScreen extends StatefulWidget {
  final String appId;
  final String? referralCode;
  final String? queryType;

  const HomepageScreen({
    super.key,
    required this.appId,
    this.referralCode,
    this.queryType,
  });

  @override
  State<HomepageScreen> createState() => _HomepageScreenState();
}

class _HomepageScreenState extends State<HomepageScreen>
    with TickerProviderStateMixin {
  // State variables
  bool _isLoading = true;
  String? _sponsorName;
  String? _sponsorPhotoUrl;
  String? _bizOpp;
  bool _isAndroidDemoMode = false;
  String? _demoEmail;
  String? _demoPassword;
  bool _isDemoLoading = false;

  // Animation controllers
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _initializeAnimations();
    _checkAndroidDemoMode();
    _initializeReferralData(widget.referralCode);
  }

  void _initializeAnimations() {
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeInOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  // -------------------------------------------------------------
  // DEMO MODE LOGIC
  // -------------------------------------------------------------

  Future<void> _checkAndroidDemoMode() async {
    try {
      if (Platform.isAndroid) {
        final remoteConfig = FirebaseRemoteConfig.instance;
        final isDemo = remoteConfig.getBool('android_demo_mode');
        final demoEmail = remoteConfig.getString('demo_account_email');
        final demoPassword = remoteConfig.getString('demo_account_password');

        if (mounted) {
          setState(() {
            _isAndroidDemoMode = isDemo;
            _demoEmail = demoEmail.isNotEmpty ? demoEmail : null;
            _demoPassword = demoPassword.isNotEmpty ? demoPassword : null;
          });
        }
        debugPrint('🤖 HOMEPAGE: Android demo mode: $isDemo');
      }
    } catch (e) {
      debugPrint('❌ HOMEPAGE: Error checking Android demo mode: $e');
    }
  }

  Future<void> _performDemoLogin() async {
    if (_demoEmail == null || _demoPassword == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Demo credentials not available'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isDemoLoading = true;
    });

    try {
      debugPrint('🔐 DEMO LOGIN: Attempting login with $_demoEmail');
      final credential = await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _demoEmail!,
        password: _demoPassword!,
      );

      if (credential.user != null && mounted) {
        debugPrint('✅ DEMO LOGIN: Success, user authenticated');
        // Give a moment for auth state to propagate, then let auth wrapper handle navigation
        await Future.delayed(const Duration(milliseconds: 100));
        // Don't pop - let the auth wrapper detect the state change and navigate properly
      }
    } on FirebaseAuthException catch (e) {
      debugPrint('❌ DEMO LOGIN: Firebase Auth Error - ${e.code}: ${e.message}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Demo login failed: ${e.message}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      debugPrint('❌ DEMO LOGIN: Unexpected error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Demo login failed. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDemoLoading = false;
        });
      }
    }
  }

  // -------------------------------------------------------------
  // DATA FETCHING LOGIC (Unchanged)
  // -------------------------------------------------------------

  Future<void> _applySponsorFromNetwork({
    required String referralCode,
    required String sponsorName,
    String? sponsorPhotoUrl,
    String? queryType,
  }) async {
    await SessionManager.instance
        .setReferralData(referralCode, sponsorName, queryType: queryType);
    if (!mounted) return;
    setState(() {
      _sponsorName = sponsorName;
      _sponsorPhotoUrl = sponsorPhotoUrl;
    });
    if (kDebugMode) {
      print(
          "📂 SessionManager — Referral data cached: $referralCode -> $sponsorName (type: $queryType)");
    }
  }

  Future<void> _initializeReferralData(String? code) async {
    if (mounted) setState(() => _isLoading = true);
    try {
      if ((code ?? '').isEmpty) {
        await SessionManager.instance.clearReferralData();
        if (!mounted) return;
        setState(() {
          _sponsorName = null;
          _sponsorPhotoUrl = null;
        });
        return;
      }

      final uri = Uri.parse(
        'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code',
      );
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;
        final sponsorName =
            [data['firstName'], data['lastName']].join(' ').trim();
        final sponsorPhotoUrl = data['photoUrl'];
        final bizOppName = data['bizOppName'];

        if (bizOppName != null && mounted) {
          setState(() {
            _bizOpp = bizOppName;
          });
        }

        await _applySponsorFromNetwork(
          referralCode: code!,
          sponsorName: sponsorName,
          sponsorPhotoUrl: sponsorPhotoUrl,
          queryType: widget.queryType,
        );
      } else {
        await SessionManager.instance.clearReferralData();
        if (!mounted) return;
        setState(() {
          _sponsorName = null;
          _sponsorPhotoUrl = null;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        print('❌ HOMEPAGE: Error during referral init: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
        _fadeController.forward();
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) _slideController.forward();
        });
      }
    }
  }

  // -------------------------------------------------------------
  // UI BUILD METHOD (Enhanced Design)
  // -------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: const EntryAppBar(),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: AppColors.primaryGradient,
        ),
        child: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20.0),
                    child: Column(
                      children: [
                        const SizedBox(height: 40),
                        FadeTransition(
                          opacity: _fadeAnimation,
                          child: _buildHeroSection(),
                        ),
                        const SizedBox(height: 40),
                        // Hide message card for Android test users
                        if (!(_isAndroidDemoMode && _demoEmail != null))
                          SlideTransition(
                            position: _slideAnimation,
                            child: FadeTransition(
                              opacity: _fadeAnimation,
                              child: _buildMessageCard(),
                            ),
                          ),
                        if (!(_isAndroidDemoMode && _demoEmail != null))
                          const SizedBox(height: 48)
                        else
                          const SizedBox(height: 24),
                        SlideTransition(
                          position: _slideAnimation,
                          child: FadeTransition(
                            opacity: _fadeAnimation,
                            child: _buildCtaButtons(),
                          ),
                        ),
                        const SizedBox(height: 32),
                      ],
                    ),
                  ),
                ),
              ),
              _buildFooter(),
            ],
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // UI HELPER WIDGETS (Enhanced with Professional Polish)
  // -------------------------------------------------------------


  Widget _buildHeroSection() {
    final heroTitle = (_sponsorName ?? '').isNotEmpty
        ? (widget.queryType == 'new'
            ? 'JUMPSTART YOUR SUCCESS'
            : (widget.queryType == 'ref'
                ? 'GROW AND MANAGE YOUR TEAM'
                : 'PROVEN TEAM BUILDING SYSTEM'))
        : 'PROVEN TEAM BUILDING SYSTEM';

    return Column(
      children: [
        // Hero badge - responsive width
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.3),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              heroTitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ),
        const SizedBox(height: 32),

        // Main hero text with responsive sizing
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: widget.queryType == 'new'
              ? Column(
                  children: [
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final screenWidth = MediaQuery.of(context).size.width;
                        final fontSize = screenWidth < 375 ? 26.0 : 30.0;
                        
                        return Text.rich(
                          TextSpan(
                            style: TextStyle(
                              fontSize: fontSize,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1.1,
                              shadows: [
                                Shadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  offset: const Offset(0, 2),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            children: [
                              const TextSpan(text: 'Build Your Foundation\n'),
                              TextSpan(
                                text: 'Before Day One',
                                style: TextStyle(
                                  color: Colors.amber.shade300,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                          textAlign: TextAlign.center,
                        );
                      },
                    ),
                  ],
                )
              : Column(
                  children: [
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final screenWidth = MediaQuery.of(context).size.width;
                        final fontSize = screenWidth < 375 ? 28.0 : 32.0;
                        
                        return FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            'Empower Your Team',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: fontSize,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1.1,
                              shadows: [
                                Shadow(
                                  color: Colors.black.withValues(alpha: 0.3),
                                  offset: const Offset(0, 2),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final screenWidth = MediaQuery.of(context).size.width;
                        final fontSize = screenWidth < 375 ? 28.0 : 32.0;
                        
                        return FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text.rich(
                            TextSpan(
                              style: TextStyle(
                                fontSize: fontSize,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                height: 1.1,
                                shadows: [
                                  Shadow(
                                    color: Colors.black.withValues(alpha: 0.3),
                                    offset: const Offset(0, 2),
                                    blurRadius: 8,
                                  ),
                                ],
                              ),
                              children: [
                                const TextSpan(text: 'Accelerate '),
                                TextSpan(
                                  text: 'Growth',
                                  style: TextStyle(
                                    color: Colors.amber.shade300,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                            textAlign: TextAlign.center,
                          ),
                        );
                      },
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildMessageCard() {
    final messageTitle = _isLoading
        ? 'Loading...'
        : (_sponsorName ?? '').isNotEmpty
            ? 'A Personal Message\nFrom $_sponsorName'
            : 'A Message From\nTeam Build Pro';

    final messageBody = TextSpan(
      style: TextStyle(
        fontSize: 16,
        height: 1.6,
        color: AppColors.textPrimary,
      ),
      children: (_sponsorName ?? '').isNotEmpty
          ? (widget.queryType == 'new'
              ? <InlineSpan>[
                  const TextSpan(
                      text:
                          'I\'m so glad you\'re here to get a head start on building your '),
                  TextSpan(
                    text: _bizOpp,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const TextSpan(
                      text:
                          '  team. The next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'),
                ]
              : (widget.queryType == 'ref'
                  ? <InlineSpan>[
                      const TextSpan(
                          text:
                              'I\'m using the Team Build Pro app to accelerate the growth of my '),
                      TextSpan(
                        text: _bizOpp,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const TextSpan(
                          text:
                              ' team and income! I highly recommend it for you as well.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'),
                    ]
                  : <InlineSpan>[
                      const TextSpan(
                        text:
                            'Team Build Pro is the ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial!',
                      ),
                    ]))
          : <InlineSpan>[
              const TextSpan(
                text:
                    'Team Build Pro is the ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial!',
              ),
            ],
    );

    return AnimatedOpacity(
      opacity: _isLoading ? 0.0 : 1.0,
      duration: const Duration(milliseconds: 800),
      child: Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: 0.2),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 30,
              offset: const Offset(0, 15),
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.1),
              blurRadius: 1,
              offset: const Offset(0, -1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: (_sponsorPhotoUrl ?? '').isNotEmpty
                      ? CircleAvatar(
                          radius: 28,
                          backgroundColor: AppColors.backgroundSecondary,
                          backgroundImage: NetworkImage(_sponsorPhotoUrl!),
                        )
                      : CircleAvatar(
                          radius: 28,
                          backgroundColor:
                              AppColors.primary.withValues(alpha: 0.1),
                          child: Icon(
                            Icons.person_pin_circle_outlined,
                            color: AppColors.primary,
                            size: 32,
                          ),
                        ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        messageTitle,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.borderLight,
                  width: 1,
                ),
              ),
              child: Text.rich(messageBody),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCtaButtons() {
    // Android Demo Mode: Show demo login instead of signup/login
    if (_isAndroidDemoMode && _demoEmail != null) {
      return _buildDemoModeCard();
    }

    // Normal mode: Show regular signup and login buttons
    return Column(
      children: [
        // Primary CTA - Create Account
        Container(
          width: double.infinity,
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.4),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => NewRegistrationScreen(
                  appId: widget.appId,
                  referralCode: widget.referralCode,
                ),
              ));
            },
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.person_add_alt_1,
                color: AppColors.primary,
                size: 20,
              ),
            ),
            label: const Text(
              'Create Account',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
            style: ElevatedButton.styleFrom(
              foregroundColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Secondary CTA - Login
        Container(
          width: double.infinity,
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.3),
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 15,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: OutlinedButton.icon(
            onPressed: () async {
              final navigator = Navigator.of(context);
              // Don't clear user data here - only clear referral data to avoid conflicts
              await SessionManager.instance.clearReferralData();
              navigator.push(MaterialPageRoute(
                builder: (_) => LoginScreen(appId: widget.appId),
              ));
            },
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.login,
                color: Colors.white,
                size: 18,
              ),
            ),
            label: const Text(
              'I Already Have an Account',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
                letterSpacing: 0.3,
              ),
            ),
            style: OutlinedButton.styleFrom(
              backgroundColor: Colors.transparent,
              side: BorderSide.none,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
          ),
        ),

        const SizedBox(height: 24),

        // Trust indicators
        _buildTrustIndicators(),
      ],
    );
  }

  Widget _buildDemoModeCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Colors.orange.withValues(alpha: 0.3),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Demo Mode Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.science,
                  color: Colors.orange.shade700,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Test Mode Active',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.orange.shade800,
                      ),
                    ),
                    Text(
                      'Testing Environment',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.orange.shade600,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 20),
          
          // Demo Description
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: Colors.orange.withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome to the Team Build Pro',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey.shade800,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'This is a fully functional test account pre-loaded with sample data. You can explore all features without affecting any real user accounts.',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey.shade700,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Access Credentials:',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Email: ${_demoEmail ?? 'Loading...'}',
                        style: TextStyle(
                          fontSize: 13,
                          fontFamily: 'monospace',
                          color: Colors.grey.shade700,
                        ),
                      ),
                      Text(
                        'Password: ${_demoPassword != null ? '••••••••••' : 'Loading...'}',
                        style: TextStyle(
                          fontSize: 13,
                          fontFamily: 'monospace',
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Demo Login Button
          Container(
            width: double.infinity,
            height: 60,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(30),
              boxShadow: [
                BoxShadow(
                  color: Colors.orange.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ElevatedButton.icon(
              onPressed: _isDemoLoading ? null : _performDemoLogin,
              icon: _isDemoLoading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.orange.shade700),
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.play_arrow,
                        color: Colors.orange.shade700,
                        size: 20,
                      ),
                    ),
              label: Text(
                _isDemoLoading ? 'Logging In...' : 'Start Testing!',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                foregroundColor: Colors.orange.shade700,
                backgroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustIndicators() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildTrustItem(Icons.security, '100% Secure'),
          Container(
            width: 1,
            height: 20,
            color: Colors.white.withValues(alpha: 0.3),
          ),
          _buildTrustItem(Icons.timer, '30-Day Free'),
          Container(
            width: 1,
            height: 20,
            color: Colors.white.withValues(alpha: 0.3),
          ),
          _buildTrustItem(Icons.support_agent, '24/7 Support'),
        ],
      ),
    );
  }

  Widget _buildTrustItem(IconData icon, String text) {
    return Column(
      children: [
        Icon(
          icon,
          color: Colors.white,
          size: 20,
        ),
        const SizedBox(height: 4),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.white.withValues(alpha: 0.9),
          ),
        ),
      ],
    );
  }

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: Border(
          top: BorderSide(
            color: Colors.white.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => TermsOfServiceScreen(appId: widget.appId),
            )),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            child: Text(
              'Terms of Service',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 8),
            width: 1,
            height: 16,
            color: Colors.white.withValues(alpha: 0.4),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => PrivacyPolicyScreen(appId: widget.appId),
            )),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
            child: Text(
              'Privacy Policy',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
