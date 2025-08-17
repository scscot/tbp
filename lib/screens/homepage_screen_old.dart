// lib/screens/homepage_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
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

  // State variables
  final bool _isProfileComplete = false;
  String? _sponsorName;
  String? _sponsorPhotoUrl;
  final String _bizOpp = 'your opportunity';
  bool _isLoading = false; // Start in a loading state


  @override
  void initState() {
    super.initState();
    _setupAnimations();
    // Use WidgetsBinding to ensure the build completes before async work
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initializePage();
    });
  }

  Future<void> _initializePage() async {
    try {
      await _performLogoutCheck();
      await _initializeReferralData(widget.referralCode);
    } catch (e) {
      if (kDebugMode) {
        print('❌ HOMEPAGE: Error during initialization: $e');
      }
    } finally {
      // This is the critical change: always turn off the loading indicator
      // after the initialization logic has completed, regardless of the outcome.
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _performLogoutCheck() async {
    final currentUser = FirebaseAuth.instance.currentUser;
    if (widget.referralCode != null &&
        widget.referralCode!.isNotEmpty &&
        currentUser != null) {
      if (kDebugMode) {
        print(
            '🔐 HOMEPAGE: Referral code detected with active session. Logging out...');
      }
      await AuthService().signOut();
      await SessionManager.instance.clearAllData();
    }
  }

  void _setupAnimations() {
    _heroAnimationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );
    _heroAnimationController.forward();
  }

  // -------------------------------------------------------------
// Step 3: Fully inclusive referral initializer (Map-based cache)
// - Works with SessionManager that returns Map<String, String>
// - Uses firstName + lastName, falls back to fullName/displayName
// - Does NOT clear cache when no code is present
// - Fixes all "undefined_*" and lint issues you reported
// -------------------------------------------------------------
  Future<void> _initializeReferralData(String? code) async {
    if (mounted) setState(() => _isLoading = true);
    final session = SessionManager.instance;

    // Use a non-underscored local fn to satisfy the lint
    Future<void> applySponsor({
      required String referralCode,
      required String sponsorName,
      String? sponsorPhotoUrl, // kept local only (not passed to SessionManager)
    }) async {
      // Your setReferralData currently takes (code, name) only
      await session.setReferralData(referralCode, sponsorName);

      if (!mounted) return;
      setState(() {
// this field exists now
        _sponsorName = sponsorName;
        _sponsorPhotoUrl = sponsorPhotoUrl;
      });
    }

    try {
      // 1) No code passed → hydrate from cache (DO NOT clear)
      if (code == null || code.isEmpty) {
        if (kDebugMode) {
          print("🔍 HOMEPAGE: No referral code provided. Trying cache.");
        }

        // Your API returns Map<String, String>
        final Map<String, String>? cached = await session.getReferralData();

        if (cached != null) {
          final cachedCode = cached['referralCode'];
          final cachedName = cached['sponsorName'];
          final cachedPhoto =
              cached['sponsorPhotoUrl']; // ok if missing in your SessionManager

          if ((cachedCode != null && cachedCode.isNotEmpty) &&
              (cachedName != null && cachedName.isNotEmpty)) {
            await applySponsor(
              referralCode: cachedCode,
              sponsorName: cachedName,
              sponsorPhotoUrl: cachedPhoto,
            );
            if (kDebugMode) {
              print(
                  "📦 HOMEPAGE: Hydrated sponsor from cache: $cachedName ($cachedCode)");
            }
          } else {
            if (kDebugMode) {
              print(
                  "📦 HOMEPAGE: No usable referral in cache. Showing generic page.");
            }
          }
        } else {
          if (kDebugMode) {
            print(
                "📦 HOMEPAGE: No referral cache found. Showing generic page.");
          }
        }
        return;
      }

      // 2) Code present → fetch fresh sponsor
      if (kDebugMode) {
        print("🔍 HOMEPAGE: Initializing with referral code: $code");
        print("🔍 HOMEPAGE: Fetching referral data for code: $code");
      }

      final uri = Uri.parse(
        'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/getUserByReferralCode?code=$code',
      );
      final response = await http.get(uri);

      if (kDebugMode) {
        print(
            "🔍 HOMEPAGE: Received response with status: ${response.statusCode}");
      }

      if (response.statusCode == 200) {
        final Map<String, dynamic> data =
            jsonDecode(response.body) as Map<String, dynamic>;

        // Prefer first+last, fallback to full/display, else 'Sponsor'
        final firstName = (data['firstName'] ?? '').toString().trim();
        final lastName = (data['lastName'] ?? '').toString().trim();
        final fullName = (data['fullName'] ?? '').toString().trim();
        final display = (data['displayName'] ?? '').toString().trim();

        final built =
            [firstName, lastName].where((s) => s.isNotEmpty).join(' ').trim();
        final sponsorName = built.isNotEmpty
            ? built
            : (fullName.isNotEmpty
                ? fullName
                : (display.isNotEmpty ? display : 'Sponsor'));

        final sponsorPhotoAny = data['photoURL'] ??
            data['photoUrl'] ??
            data['avatarUrl'] ??
            data['profileImageUrl'];
        final sponsorPhoto =
            sponsorPhotoAny?.toString();

        await applySponsor(
          referralCode: code,
          sponsorName: sponsorName,
          sponsorPhotoUrl: sponsorPhoto,
        );

        if (kDebugMode) {
          print(
              "📂 SessionManager — Referral data cached: $code -> $sponsorName");
        }
        return;
      }

      // 3) Non-200 → fall back to cache (no clearing)
      if (kDebugMode) {
        print(
            "⚠️ HOMEPAGE: Referral fetch failed (${response.statusCode}). Falling back to cache.");
      }
      final Map<String, String>? cached = await session.getReferralData();
      if (cached != null && (cached['sponsorName']?.isNotEmpty ?? false)) {
        await applySponsor(
          referralCode: cached['referralCode'] ?? code,
          sponsorName: cached['sponsorName']!,
          sponsorPhotoUrl: cached['sponsorPhotoUrl'],
        );
        if (kDebugMode) {
          print(
              "📦 HOMEPAGE: Fallback to cached sponsor: ${cached['sponsorName']}");
        }
      } else if (kDebugMode) {
        print("📦 HOMEPAGE: No cached sponsor available.");
      }
    } catch (e, st) {
      // 4) Network/parse error → fall back to cache
      if (kDebugMode) {
        print('❌ HOMEPAGE: Error during referral init: $e');
        print('❌ HOMEPAGE: Stack: $st');
      }
      final Map<String, String>? cached = await session.getReferralData();
      if (cached != null && (cached['sponsorName']?.isNotEmpty ?? false)) {
        await applySponsor(
          referralCode: cached['referralCode'] ?? (code ?? ''),
          sponsorName: cached['sponsorName']!,
          sponsorPhotoUrl: cached['sponsorPhotoUrl'],
        );
        if (kDebugMode) {
          print(
              "📦 HOMEPAGE: Fallback to cached sponsor after error: ${cached['sponsorName']}");
        }
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }


  @override
  void dispose() {
    _heroAnimationController.dispose();
    super.dispose();
  }

  void _navigateToLogin() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LoginScreen(appId: widget.appId),
      ),
    );
  }

  void _navigateToRegistration() async {
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

  @override
  Widget build(BuildContext context) {
    // Temporarily remove the loading indicator for testing
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
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
    final bool isProfileComplete = _isProfileComplete;
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
              if (isProfileComplete && _sponsorPhotoUrl != null)
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
                    color: isProfileComplete ? Colors.green : Colors.blue,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isProfileComplete ? Icons.person_add : Icons.trending_up,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  isProfileComplete
                      ? 'A Message From\n$_sponsorName'
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
            isProfileComplete
                ? 'Welcome!\n\nI\'m so glad you\'re here to get a head start on building your $_bizOpp team. The next step is easy—just begin your free trial below. Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'
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
}
