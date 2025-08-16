// lib/screens/homepage_screen.dart

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

  // Referral code related state
  String? _sponsorName;
  String? _sponsorPhotoUrl;
  String? _bizOpp = 'your opportunity';
  bool _isLoggingOut = true;
  bool _hasPerformedLogout = false;

  // Add this variable to track the current operation
  String? _activeReferralOperation;

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

      // Only check for pending referral code for logout logic
      String? pendingCode =
          await SessionManager.instance.getPendingReferralCode();

      // For logout logic, only consider pending codes, not cached ones
      final hasPendingReferralCode =
          pendingCode != null && pendingCode.isNotEmpty;

      if (kDebugMode) {
        print('🔐 HOMEPAGE: Pending referral code: $pendingCode');
        print(
            '🔐 HOMEPAGE: Has pending referral code: $hasPendingReferralCode');
      }

      if (hasPendingReferralCode && currentUser != null) {
        if (kDebugMode) {
          print(
              '🔐 HOMEPAGE: Found pending referral code and existing user session, performing logout...');
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
              '🔐 HOMEPAGE: No pending referral code or no user session, skipping logout');
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
    String? pendingCode =
        await SessionManager.instance.consumePendingReferralCode();

    // Set the active operation to this new code.
    // Use a unique identifier like DateTime if the code could be null.
    final String currentOperationId =
        pendingCode ?? DateTime.now().toIso8601String();
    _activeReferralOperation = currentOperationId;

    // Reset state to ensure a clean slate for every new operation
    if (mounted) {
      setState(() {
        _sponsorName = null;
        _sponsorPhotoUrl = null;
        _bizOpp = 'your opportunity';
      });
    }

    // If there's no pending code, we are done.
    if (pendingCode == null || pendingCode.isEmpty) {
      if (kDebugMode) {
        print("🔍 No pending code. Clearing state and stopping.");
      }
      return;
    }

    if (kDebugMode) {
      print("🔍 Initializing with NEW pending referral code: $pendingCode");
    }

    try {
      final uri = Uri.parse(
          'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$pendingCode');
      final response = await http.get(uri);

      // CRITICAL FIX: Check if this operation is still the active one.
      if (_activeReferralOperation != currentOperationId) {
        if (kDebugMode) {
          print(
              "🏃‍♂️ Race condition detected. Discarding stale result for code: $pendingCode");
        }
        return; // Exit without updating state
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);

        if (data == null || data['uid'] == null) {
          await SessionManager.instance.clearReferralData();
          if (kDebugMode) {
            print(
                "❌ HOMEPAGE: New referral code '$pendingCode' does not exist, clearing ALL cached data");
          }
          return;
        }

        // Valid new referral code - update state and cache
        final fetchedSponsorName =
            '${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'.trim();
        final fetchedSponsorPhotoUrl = data['photoUrl'] as String?;
        String? fetchedBizOpp;

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

        if (fetchedSponsorName.isNotEmpty) {
          await SessionManager.instance
              .setReferralData(pendingCode, fetchedSponsorName);
        }

        if (mounted) {
          setState(() {
            _sponsorName = fetchedSponsorName;
            _sponsorPhotoUrl = fetchedSponsorPhotoUrl;
            _bizOpp = fetchedBizOpp;
          });
        }
      } else {
        // API error for new referral code
        await SessionManager.instance.clearReferralData();
        if (kDebugMode) {
          print(
              "❌ HOMEPAGE: API error ${response.statusCode} for new referral code '$pendingCode', clearing cached data");
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print(
            "❌ HOMEPAGE: Network error for new referral code '$pendingCode': $e");
      }
      await SessionManager.instance.clearReferralData();
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
    String? referralCode = await SessionManager.instance
        .getReferralData()
        .then((data) => data?['referralCode']);

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
    final bool isLandscape =
        MediaQuery.of(context).orientation == Orientation.landscape;

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
    final bool hasReferralCode =
        _sponsorName != null && _sponsorName!.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
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
                    color: hasReferralCode && _sponsorPhotoUrl != null
                        ? Colors.green
                        : Colors.blue,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    hasReferralCode && _sponsorPhotoUrl != null
                        ? Icons.person_add
                        : Icons.trending_up,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  hasReferralCode && _sponsorPhotoUrl != null
                      ? 'A Message From $_sponsorName'
                      : 'INNOVATIVE APPROACH',
                  style: const TextStyle(
                    fontSize: 16,
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
            hasReferralCode && _sponsorPhotoUrl != null
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
          ElevatedButton(
            onPressed: _navigateToRegistration,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              'BEGIN FREE 30-DAY TRIAL!',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
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
                      builder: (context) =>
                          PrivacyPolicyScreen(appId: widget.appId),
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
                      builder: (context) =>
                          TermsOfServiceScreen(appId: widget.appId),
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
