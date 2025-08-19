import 'dart:convert';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// App imports
import '../services/session_manager.dart';
import 'login_screen.dart';
import 'new_registration_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';

class HomepageScreen extends StatefulWidget {
  final String appId;
  final String? referralCode;
  final String? queryType; // New parameter to track query type

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
  late final AnimationController _heroAnimationController;

  // State variables (mutable; not final by design)
  bool _isLoading = true;
  String? _sponsorName;
  String? _sponsorPhotoUrl; // optional, used if backend returns photo URL
  String? _bizOpp; // NEW: Added to store biz_opp value

  @override
  void initState() {
    super.initState();
    _heroAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();

    // Debug print for queryType
    if (kDebugMode) {
      print('🏠 HOMEPAGE: queryType = ${widget.queryType}');
    }

    // Kick off referral init with code (if any) passed into the widget
    _initializeReferralData(widget.referralCode);
  }

  @override
  void dispose() {
    _heroAnimationController.dispose();
    super.dispose();
  }

  // -------------------------------------------------------------
  // Fully inclusive referral initializer (Map-based cache)
  // -------------------------------------------------------------

  Future<void> _applySponsorFromNetwork({
    required String referralCode,
    required String sponsorName,
    String? sponsorPhotoUrl,
    String? queryType,
  }) async {
    await SessionManager.instance.setReferralData(referralCode, sponsorName, queryType: queryType);
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
      // 1) No code passed → clear cache and treat as new user
      if ((code ?? '').isEmpty) {
        if (kDebugMode) {
          print("🔍 HOMEPAGE: No referral code provided. Clearing cache and treating as new user.");
        }
        await SessionManager.instance.clearReferralData();
        if (!mounted) return;
        setState(() {
          _sponsorName = null;
          _sponsorPhotoUrl = null;
        });
        return;
      }
      // 2) Code present → fetch
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
        final firstName = (data['firstName'] ?? '').toString().trim();
        final lastName = (data['lastName'] ?? '').toString().trim();
        final fullName = (data['fullName'] ?? '').toString().trim();
        final display = (data['displayName'] ?? '').toString().trim();
        final joined =
            [firstName, lastName].where((s) => s.isNotEmpty).join(' ').trim();
        final sponsorName = joined.isNotEmpty
            ? joined
            : (fullName.isNotEmpty
                ? fullName
                : (display.isNotEmpty ? display : 'Sponsor'));

        final sponsorPhotoUrl = data['photoUrl'];
        final bizOppName = data['bizOppName'];

        if (kDebugMode) {
          print(
              "bizOppName: $bizOppName");
        }

        // Use the bizOppName directly from the response
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
        return;
      }
      // 3) Non-200 → skip cache fallback entirely and clear cache
      if (kDebugMode) {
        print(
            "⚠️ HOMEPAGE: Referral fetch failed (${response.statusCode}). Skipping cache fallback and clearing cache.");
      }
      // Clear cached referral data and treat as not referred
      await SessionManager.instance.clearReferralData();
      if (!mounted) return;
      setState(() {
        _sponsorName = null;
        _sponsorPhotoUrl = null;
      });
    } catch (e, st) {
      if (kDebugMode) {
        print('❌ HOMEPAGE: Error during referral init: $e');
        print('❌ HOMEPAGE: Stack: $st');
      }
      // On error, clear cache and treat as not referred
      await SessionManager.instance.clearReferralData();
      if (!mounted) return;
      setState(() {
        _sponsorName = null;
        _sponsorPhotoUrl = null;
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ------------------------- UI ------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
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
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _buildHeroSection(context),
            ),
            SliverToBoxAdapter(child: const SizedBox(height: 16)),
            SliverToBoxAdapter(child: _buildCTASection(context)),
            SliverFillRemaining(
              hasScrollBody: false,
              fillOverscroll: true,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: _buildFooter(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroSection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            (_sponsorName ?? '').isNotEmpty
                ? (widget.queryType == 'new'
                    ? 'JUMPSTART YOUR TEAM GROWTH'
                    : (widget.queryType == 'ref'
                        ? 'GROW AND MANAGE YOUR TEAM'
                        : 'PROVEN TEAM BUILDING SYSTEM'))
                : 'PROVEN TEAM BUILDING SYSTEM',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          
          const SizedBox(height: 16),
          AnimatedOpacity(
            opacity: _isLoading ? 0.5 : 1.0,
            duration: const Duration(milliseconds: 300),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.blue.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ((_sponsorPhotoUrl ?? '').isNotEmpty)
                          ? CircleAvatar(
                              radius: 20,
                              backgroundImage: NetworkImage(_sponsorPhotoUrl!))
                          : const Icon(Icons.person_pin_circle_outlined),
                      const SizedBox(width: 8),
                      Text(
                        _isLoading
                            ? 'Loading sponsor...'
                            : (_sponsorName ?? '').isNotEmpty
                ? (widget.queryType == 'new'
                    ? 'A Message From $_sponsorName'
                    : (widget.queryType == 'ref'
                        ? 'A Message From $_sponsorName'
                        : 'A Message From Team Build Pro'))
                : 'A Message From Team Build Pro',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
Text.rich(
            TextSpan(
              children: (_sponsorName ?? '').isNotEmpty
                  ? (widget.queryType == 'new'
                      ? <InlineSpan>[
                          const TextSpan(
                              text:
                                  'Welcome!\n\nI\'m so glad you\'re here to get a head start on building your '),
                          TextSpan(
                            text: _bizOpp,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const TextSpan(text: '  team. The next step is easy—just create your account below and begin enjoying your free 30-day trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'),
                        ]
                      : (widget.queryType == 'ref'
                          ? <InlineSpan>[
                              const TextSpan(
                                  text:
                                      'Welcome!\n\nI\'m using the Team Build Pro app to accelerate the growth of my '),
                              TextSpan(
                                text: _bizOpp,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold),
                              ),
                              const TextSpan(
                                  text:
                                      ' team and income! I highly recommend it for you as well.\n\nThe next step is easy—just create your account below and begin enjoying your free 30-day trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'),
                            ]
                          : <InlineSpan>[
                              const TextSpan(
                                text:
                                    'Welcome!\n\nTeam Build Pro is the ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your free 30-day trial!',
                              ),
                            ]))
                  : <InlineSpan>[
                      const TextSpan(
                        text:
                            'Welcome!\n\nThe ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your free 30-day trial!',
                      ),
                    ],
            ),
            textAlign: TextAlign.left,
            style: TextStyle(fontSize: 15, height: 1.4),
          ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCTASection(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                if (!mounted) return;
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => NewRegistrationScreen(
                      appId: widget.appId,
                      referralCode: null, // Explicitly null for admin registration
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Create Account'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () async {
                // Clear all cached user information before navigating to login
                final navigator =
                    Navigator.of(context); // <-- capture before await
                await SessionManager.instance.clearAllData();
                navigator.push(
                  // <-- use captured navigator
                  MaterialPageRoute(
                    builder: (_) => LoginScreen(appId: widget.appId),
                  ),
                );
              },

              icon: const Icon(Icons.login),
              label: const Text('Log In'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => TermsOfServiceScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text('Terms of Service'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => PrivacyPolicyScreen(appId: widget.appId),
                    ),
                  );
                },
                child: const Text('Privacy Policy'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
