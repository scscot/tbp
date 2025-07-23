// ignore_for_file: unnecessary_cast, deprecated_member_use, sized_box_for_whitespace

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';
import 'add_link_screen.dart';
import 'member_detail_screen.dart';
import 'package:flutter/foundation.dart' show kDebugMode;

class BusinessScreen extends StatefulWidget {
  final String appId;

  const BusinessScreen({
    super.key,
    required this.appId,
  });

  @override
  State<BusinessScreen> createState() => _BusinessScreenState();
}

class _BusinessScreenState extends State<BusinessScreen>
    with TickerProviderStateMixin {
  String? bizOpp;
  String? bizOppRefUrl;
  String? sponsorName;
  String? sponsorUid;
  bool loading = true;
  bool hasVisitedOpp = false;
  DateTime? bizJoinDate;
  bool hasSeenConfirmation = false;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
    _loadData();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) {
      if (mounted) setState(() => loading = false);
      return;
    }

    final adminUid = user.uplineAdmin;
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint("User does not have an upline admin.");
      if (mounted) setState(() => loading = false);
      return;
    }

    try {
      // Fetch biz_opp from admin_settings (following member_detail_screen pattern)
      final adminSettingsDoc = await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(adminUid)
          .get();
      
      String? retrievedBizOpp;
      if (adminSettingsDoc.exists) {
        final adminData = adminSettingsDoc.data() as Map<String, dynamic>?;
        retrievedBizOpp = adminData?['biz_opp'] as String?;
      }

      // Fetch bizOppRefUrl and sponsor info by traversing upline_refs
      String? retrievedBizOppRefUrl;
      String? retrievedSponsorName;
      String? retrievedSponsorUid;
      
      if (user.uplineRefs.isNotEmpty) {
        final result = await _findBizOppRefUrlAndSponsorInUpline(user.uplineRefs);
        retrievedBizOppRefUrl = result['bizOppRefUrl'];
        retrievedSponsorName = result['sponsorName'];
        retrievedSponsorUid = result['sponsorUid'];
      }

      if (!mounted) return;

      setState(() {
        bizOpp = retrievedBizOpp;
        bizOppRefUrl = retrievedBizOppRefUrl;
        sponsorName = retrievedSponsorName;
        sponsorUid = retrievedSponsorUid;
        hasVisitedOpp = user.bizVisitDate != null;
        bizJoinDate = user.bizVisitDate;
        loading = false;
      });

      _animationController.forward();

    } catch (e) {
      debugPrint('Error loading opportunity data: $e');
      if (mounted) setState(() => loading = false);
    }
  }

  Future<Map<String, String?>> _findBizOppRefUrlAndSponsorInUpline(List<String> uplineRefs) async {
    try {
      // Traverse upline_refs in REVERSE order (UP the upline: closest to furthest)
      // uplineRefs structure: [furthest_upline, ..., direct_sponsor]
      // So we traverse from last index (direct_sponsor) to index 0 (furthest_upline)
      for (int i = uplineRefs.length - 1; i >= 0; i--) {
        final uplineUid = uplineRefs[i];
        debugPrint('🔍 Checking upline user at index $i: $uplineUid');
        
        final uplineUserDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(uplineUid)
            .get();
        
        if (uplineUserDoc.exists) {
          final uplineUserData = uplineUserDoc.data() as Map<String, dynamic>?;
          final bizOppRefUrl = uplineUserData?['biz_opp_ref_url'] as String?;
          
          if (bizOppRefUrl != null && bizOppRefUrl.isNotEmpty) {
            debugPrint('✅ Found biz_opp_ref_url in upline user at index $i: $uplineUid');
            
            // Get sponsor name from the same user
            final firstName = uplineUserData?['firstName'] as String? ?? '';
            final lastName = uplineUserData?['lastName'] as String? ?? '';
            final sponsorName = '$firstName $lastName'.trim();
            
            return {
              'bizOppRefUrl': bizOppRefUrl,
              'sponsorName': sponsorName.isNotEmpty ? sponsorName : null,
              'sponsorUid': uplineUid,
            };
          } else {
            debugPrint('❌ No biz_opp_ref_url found for upline user at index $i: $uplineUid');
          }
        } else {
          debugPrint('❌ Upline user document does not exist at index $i: $uplineUid');
        }
      }
      
      debugPrint('🚫 No biz_opp_ref_url found in entire upline chain');
      return {
        'bizOppRefUrl': null,
        'sponsorName': null,
        'sponsorUid': null,
      };
    } catch (e) {
      debugPrint('💥 Error traversing upline refs: $e');
      return {
        'bizOppRefUrl': null,
        'sponsorName': null,
        'sponsorUid': null,
      };
    }
  }

  Future<void> _confirmAndCopyUrl() async {
    if (bizOppRefUrl == null) return;

    // Show confirmation dialog only on first tap
    if (!hasSeenConfirmation) {
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: false, // Prevent dismissing by tapping outside
        builder: (BuildContext dialogContext) => Dialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.primary, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Before You Continue',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  "Important: After completing your ${bizOpp ?? 'business opportunity'} registration, you must return here to add your new referral link to your Team Build Pro profile. This ensures your ${bizOpp ?? 'business opportunity'} team is built correctly.",
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.textInverse,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text(
                      'I Understand',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );

      if (!mounted || confirmed != true) return;

      // Mark that user has seen the confirmation
      setState(() {
        hasSeenConfirmation = true;
      });
    }

    // Only call the Cloud Function if the user hasn't visited the opportunity yet
    // This ensures the sponsor notification is only sent on the first copy
    if (!hasVisitedOpp) {
      try {
        HttpsCallable callable = FirebaseFunctions.instance
            .httpsCallable('notifySponsorOfBizOppVisit');
        await callable.call();

        if (mounted) {
          // Update the local state to reflect the change immediately
          setState(() => hasVisitedOpp = true);
          if (kDebugMode) {
            debugPrint("Successfully triggered sponsor notification function on first copy.");
          }
        }
      } on FirebaseFunctionsException catch (e) {
        if (kDebugMode) {
          debugPrint(
              "Error calling notifySponsorOfBizOppVisit: ${e.code} - ${e.message}");
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint("User has already visited opportunity - skipping notification call.");
      }
    }

    // Copy URL to clipboard (this happens every time)
    try {
      await Clipboard.setData(ClipboardData(text: bizOppRefUrl!));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle, color: AppColors.textInverse),
                const SizedBox(width: 12),
                const Text('Registration URL copied to clipboard!'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(Icons.error, color: AppColors.textInverse),
                const SizedBox(width: 12),
                Text('Failed to copy URL: $e'),
              ],
            ),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      }
    }
  }

  void _handleCompletedRegistrationClick() {
    if (hasVisitedOpp) {
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => AddLinkScreen(appId: widget.appId),
        ),
      );
    } else {
      if (mounted) {
        showDialog(
          context: context,
          builder: (BuildContext dialogContext) => Dialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.warning_amber, color: AppColors.warning, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Visit Required First',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    "Before updating your profile, you must first use the 'Copy Registration Link' button on this page to visit '${bizOpp ?? 'the opportunity'}' and complete your registration.",
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textInverse,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text(
                        'OK',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }
    }
  }

  Widget _buildHeroSection() {
    final user = Provider.of<UserModel?>(context);
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.heavyShadow,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.textInverse, 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.celebration,
              size: 48,
              color: AppColors.textInverse,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Congratulations, ${user?.firstName ?? 'User'}!',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
              letterSpacing: 0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            'You\'ve reached the community growth threshold',
            style: TextStyle(
              fontSize: 18,
              color: AppColors.withOpacity(AppColors.textInverse, 0.9),
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildDisclaimerCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.info.withOpacity(0.1),
            AppColors.primary.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.info, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.info, 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.info_outline,
                  color: AppColors.info,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'THIRD-PARTY OPPORTUNITY AVAILABLE',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.info,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textPrimary,
                height: 1.5,
              ),
              children: [
                const TextSpan(
                  text: 'Based on your community growth, you now have access to information about ',
                ),
                TextSpan(
                  text: bizOpp ?? 'a business opportunity',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const TextSpan(
                  text: '. This is a completely separate, independent business that is ',
                ),
                const TextSpan(
                  text: 'NOT owned, operated, or affiliated with Team Build Pro',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    decoration: TextDecoration.underline,
                  ),
                ),
                const TextSpan(text: '.'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.warningBackground,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.warning.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber, color: AppColors.warning, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Team Build Pro does not endorse or guarantee this opportunity. Please conduct your own research.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.darker(AppColors.warning),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSponsorInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.mediumShadow,
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.teamPrimary, 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.person,
                  color: AppColors.teamPrimary,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Your Referral Contact',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.teamPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: 15,
                color: AppColors.textSecondary,
                height: 1.5,
              ),
              children: [
                const TextSpan(
                  text: 'If you choose to explore this opportunity, your referral contact will be ',
                ),
                if (sponsorName != null && sponsorUid != null)
                  WidgetSpan(
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => MemberDetailScreen(
                              userId: sponsorUid!,
                              appId: widget.appId,
                            ),
                          ),
                        );
                      },
                      child: Text(
                        sponsorName!,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  )
                else
                  TextSpan(
                    text: sponsorName ?? 'an upline Team Leader',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                const TextSpan(
                  text: '. This person is a member of your Team Build Pro network who has already joined this opportunity.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionsCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, color: Colors.blue.shade700, size: 20),
              const SizedBox(width: 8),
              Text(
                'How to Join ${bizOpp ?? 'Opportunity'}',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.blue.shade700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '1. Copy the registration link below\n'
            '2. Open your web browser\n'
            '3. Paste the link and complete registration\n'
            '4. Return here to add your referral link',
            style: TextStyle(
              fontSize: 14,
              color: Colors.blue.shade800,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUrlSection() {
    if (bizOppRefUrl == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.orange.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.orange.shade200),
        ),
        child: Row(
          children: [
            Icon(Icons.warning_amber, color: Colors.orange.shade700),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Registration URL not available. Please contact your sponsor.',
                style: TextStyle(
                  color: Colors.orange.shade800,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Registration Link:',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.grey.shade700,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  bizOppRefUrl!,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Colors.blue,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _confirmAndCopyUrl,
                icon: const Icon(Icons.copy),
                tooltip: 'Copy URL',
                style: IconButton.styleFrom(
                  backgroundColor: Colors.blue.shade100,
                  foregroundColor: Colors.blue.shade700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFollowUpCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.warningGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: [
          Icon(
            Icons.assignment_return,
            size: 32,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 16),
          Text(
            'Important Follow-up Step!',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            "After exploring the opportunity, you must return here and add your new referral link to your Team Build Pro profile. This ensures your community connections are tracked correctly.",
            style: TextStyle(
              fontSize: 16,
              color: AppColors.withOpacity(AppColors.textInverse, 0.9),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _handleCompletedRegistrationClick,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.textInverse,
                foregroundColor: AppColors.warning,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    "I've completed registration",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    "Add my referral link now",
                    style: TextStyle(
                      fontSize: 14,
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

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);

    if (user == null) {
      return Scaffold(
        appBar: AppHeaderWithMenu(appId: widget.appId),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundSecondary,
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildHeroSection(),
                    const SizedBox(height: 24),
                    _buildDisclaimerCard(),
                    const SizedBox(height: 24),
                    _buildSponsorInfoCard(),
                    const SizedBox(height: 24),
                    _buildInstructionsCard(),
                    const SizedBox(height: 20),
                    _buildUrlSection(),
                    const SizedBox(height: 32),
                    _buildFollowUpCard(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }
}
