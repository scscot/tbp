// lib/screens/homepage1_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/session_manager.dart';
import '../services/auth_service.dart';
import '../config/app_colors.dart';
import 'new_registration_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'login_screen.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class Homepage1Screen extends StatefulWidget {
  final String? referralCode;
  final String appId;

  const Homepage1Screen({
    super.key,
    this.referralCode,
    required this.appId,
  });

  @override
  State<Homepage1Screen> createState() => _Homepage1ScreenState();
}

class _Homepage1ScreenState extends State<Homepage1Screen>
    with TickerProviderStateMixin {
  late AnimationController _heroAnimationController;

  // Referral code related state
  String? _sponsorName;
  String? _sponsorPhotoUrl;
  String? _bizOpp = 'your opportunity';
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

      // Get referral code exclusively from SessionManager - DO NOT consume yet
      String? referralCode =
          await SessionManager.instance.getPendingReferralCode();

      // If no pending code, check cached referral data
      if (referralCode == null || referralCode.isEmpty) {
        final cachedData = await SessionManager.instance.getReferralData();
        if (cachedData != null) {
          referralCode = cachedData['referralCode'];
        }
      }

      final hasReferralCode = referralCode != null && referralCode.isNotEmpty;

      if (kDebugMode) {
        print('🔐 HOMEPAGE: Session Manager referral code: $referralCode');
        print('🔐 HOMEPAGE: Has referral code: $hasReferralCode');
      }

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

    _heroAnimationController.forward();
  }

  Future<void> _initializeReferralData() async {
    String? code = await SessionManager.instance.consumePendingReferralCode();
    
    if (code == null || code.isEmpty) {
      final cachedData = await SessionManager.instance.getReferralData();
      if (cachedData != null) {
        code = cachedData['referralCode'];
      }
    }

    if (code == null || code.isEmpty) {
      return;
    }

    String? fetchedSponsorName;
    String? fetchedSponsorPhotoUrl;
    String? fetchedBizOpp;

    try {
      final uri = Uri.parse(
          'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code');
      final response = await http.get(uri);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        fetchedSponsorName =
            '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();
        fetchedSponsorPhotoUrl = data['photoUrl'] as String?;

        if (fetchedSponsorName.isNotEmpty) {
          await SessionManager.instance
              .setReferralData(code, fetchedSponsorName);
        } else {
          fetchedSponsorName = null;
        }

        // Fetch biz_opp from admin_settings
        String? fetchedSponsorUid = data['uid'] as String?;
        if (fetchedSponsorUid != null) {
          try {
            final sponsorDoc = await FirebaseFirestore.instance
                .collection('users')
                .doc(fetchedSponsorUid)
                .get();

            if (sponsorDoc.exists) {
              final sponsorData = sponsorDoc.data();
              String? uplineAdmin;

              if (sponsorData?['role'] == 'admin') {
                uplineAdmin = fetchedSponsorUid;
              } else {
                uplineAdmin = sponsorData?['upline_admin'] as String?;
              }

              if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
                final adminSettingsDoc = await FirebaseFirestore.instance
                    .collection('admin_settings')
                    .doc(uplineAdmin)
                    .get();

                if (adminSettingsDoc.exists) {
                  final adminData = adminSettingsDoc.data();
                  fetchedBizOpp = adminData?['biz_opp'] as String?;
                }
              }
            }
          } catch (e) {
            if (kDebugMode) {
              print('Error fetching biz_opp: $e');
            }
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print("Error finding sponsor: $e");
      }
    } finally {
      if (mounted) {
        setState(() {
          _sponsorName = fetchedSponsorName;
          _sponsorPhotoUrl = fetchedSponsorPhotoUrl;
          _bizOpp = fetchedBizOpp;
        });
      }
    }
  }

  @override
  void dispose() {
    _heroAnimationController.dispose();
    super.dispose();
  }

void _navigateToLogin() {
    if (_hasPerformedLogout) {
      // Navigate to LoginScreen instead of popping back
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => LoginScreen(appId: widget.appId),
        ),
      );
    } else {
      // Wait for logout check to complete, then navigate
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          _navigateToLogin();
        }
      });
    }
  }

  void _navigateToRegistration() async {
    String? referralCode = await SessionManager.instance.getReferralData().then((data) => data?['referralCode']);
    
    if (!mounted) return;
    
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => NewRegistrationScreen(
          referralCode: referralCode,
          appId: widget.appId,
        ),
      ),
    );
  }

  // Subtitle
  Widget _buildSubtitle() {
    final bool isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.orange, Colors.deepOrange],
        ),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        (_sponsorName != null && _sponsorName!.isNotEmpty)
            ? 'JUMPSTART YOUR TEAM GROWTH'
            : 'PROVEN TEAM BUILDING SYSTEM',
        style: TextStyle(
          fontSize: isLandscape ? 12 : 14,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildDynamicWelcomeSection() {
    final bool hasReferralCode = _sponsorName != null && _sponsorName!.isNotEmpty;


    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFF0A0E27),
            Color(0xFF1A237E),
            Color(0xFF3949AB),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.secondary.withOpacity(0.3)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (hasReferralCode && _sponsorPhotoUrl != null)
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    image: DecorationImage(
                      image: NetworkImage(_sponsorPhotoUrl!),
                      fit: BoxFit.cover,
                    ),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: hasReferralCode ? Colors.green : Colors.blue,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    hasReferralCode ? Icons.person_add : Icons.trending_up,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  hasReferralCode ? 'A Message From $_sponsorName' : 'INNOVATIVE APPROACH',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 1.0,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            hasReferralCode
                ? 'Welcome!\n\nI\'m so glad you\'re here to get a head start on building your ${_bizOpp ?? 'direct sales'} team. The next step is easy—just begin your free trial below. Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'
                : 'Transform your recruitment and team building strategy! Help prospects start building their organization immediately.',
            style: const TextStyle(
              fontSize: 15,
              color: Colors.white,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
            textAlign: TextAlign.left,
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
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _navigateToRegistration,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'BEGIN FREE 30-DAY TRIAL!',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooterSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: AppColors.backgroundSecondary,
      child: Column(
        children: [
          const Divider(color: AppColors.border),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
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
                  ),
                ),
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
                  ),
                ),
              ),
            ],
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
      title: Row(
        children: [
          Image.asset(
            'assets/icons/app_icon.png',
            width: 28,
            height: 28,
            fit: BoxFit.contain,
          ),
          const SizedBox(width: 12),
          const Text(
            'Team Build Pro',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
      centerTitle: false,
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

  @override
  Widget build(BuildContext context) {
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
            const SizedBox(height: 20),
            Center(child: _buildSubtitle()),
            const SizedBox(height: 20),
            _buildDynamicWelcomeSection(),
            _buildSmartOnboarding(),
            _buildFooterSection(),
          ],
        ),
      ),
    );
  }
}
