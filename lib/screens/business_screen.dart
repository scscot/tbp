// ignore_for_file: unnecessary_cast, deprecated_member_use, sized_box_for_whitespace

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';
import '../services/admin_settings_service.dart';
import '../services/business_opportunity_service.dart';
import 'add_link_screen.dart';
import 'member_detail_screen.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import '../widgets/localized_text.dart';

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
  final AdminSettingsService _adminSettingsService = AdminSettingsService();

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
      // Fetch biz_opp using AdminSettingsService for consistent caching
      final retrievedBizOpp = await _adminSettingsService.getBizOppName(
        adminUid,
        fallback: '' // Use empty string instead of null
      );

      // Fetch bizOppRefUrl and sponsor info by traversing upline_refs
      String? retrievedBizOppRefUrl;
      String? retrievedSponsorName;
      String? retrievedSponsorUid;

      if (user.uplineRefs.isNotEmpty) {
        final result =
            await BusinessOpportunityService.findUplineReferralInfo(user.uplineRefs);
        retrievedBizOppRefUrl = result.bizOppRefUrl;
        retrievedSponsorName = result.sponsorName;
        retrievedSponsorUid = result.sponsorUid;
      }

      if (!mounted) return;

      setState(() {
        bizOpp = retrievedBizOpp.isNotEmpty ? retrievedBizOpp : null;
        bizOppRefUrl = retrievedBizOppRefUrl;
        sponsorName = retrievedSponsorName;
        sponsorUid = retrievedSponsorUid;
        hasVisitedOpp = user.bizVisitDate != null;
        bizJoinDate = user.bizJoinDate;
        loading = false;
      });

      _animationController.forward();
    } catch (e) {
      debugPrint('Error loading opportunity data: $e');
      if (mounted) setState(() => loading = false);
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 400),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.info_outline,
                        color: AppColors.primary, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        context.l10n?.businessConfirmDialogTitle ?? 'Before You Continue',
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
                  context.l10n?.businessConfirmDialogMessage(bizOpp ?? 'business') ?? "This is the next step in your journey. After joining ${bizOpp ?? 'business'} through your sponsor's link, you must return here to add your new ${bizOpp ?? 'business'} referral link to your profile. This is a critical step to ensure your new team members are placed correctly.",
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
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: Text(
                      context.l10n?.businessConfirmDialogButton ?? 'I Understand',
                      style: const TextStyle(
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
        HttpsCallable callable =
            FirebaseFunctions.instanceFor(region: 'us-central1')
                .httpsCallable('notifySponsorOfBizOppVisit');
        await callable.call();

        if (mounted) {
          // Update the local state to reflect the change immediately
          setState(() => hasVisitedOpp = true);
          if (kDebugMode) {
            debugPrint(
                "Successfully triggered sponsor notification function on first copy.");
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
        debugPrint(
            "User has already visited opportunity - skipping notification call.");
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
                Text(context.l10n?.businessUrlCopiedMessage ?? 'Registration URL copied to clipboard!'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                Text(context.l10n?.businessUrlCopyError(e.toString()) ?? 'Failed to copy URL: ${e.toString()}'),
              ],
            ),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.warning_amber,
                          color: AppColors.warning, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          context.l10n?.businessVisitRequiredTitle ?? 'Visit Required First',
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
                    context.l10n?.businessVisitRequiredMessage(bizOpp ?? 'business') ?? "Before updating your profile, you must first use the 'Copy Registration Link' button on this page to visit ${bizOpp ?? 'business'} and complete your registration.",
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
                      onPressed: () {
                        try {
                          Navigator.of(dialogContext).pop();
                        } catch (e) {
                          debugPrint('❌ BUSINESS: Error closing qualification dialog: $e');
                          Navigator.of(context).pop();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.textInverse,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      child: Text(
                        context.l10n?.businessVisitRequiredButton ?? 'OK',
                        style: const TextStyle(
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
            context.l10n?.businessHeroTitle ?? 'Congratulations\nYou\'re Qualified!',
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
            context.l10n?.businessHeroMessage(bizOpp ?? 'business') ?? 'Your hard work and team-building have paid off. You are now eligible to join the ${bizOpp ?? 'business'} opportunity.',
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
                  context.l10n?.businessDisclaimerTitle ?? 'Disclaimer Notice',
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
          Text(
            context.l10n?.businessDisclaimerMessage(bizOpp ?? 'business') ?? 'Your team growth has unlocked access to ${bizOpp ?? 'business'}. This opportunity operates as an independent business and has no affiliation with the Team Build Pro platform.',
            style: TextStyle(
              fontSize: 15,
              color: AppColors.textPrimary,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.successBackground,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.success.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.verified, color: AppColors.success, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context.l10n?.businessDisclaimerInfo(bizOpp ?? 'business') ?? 'The Team Build Pro App simply facilitates access to ${bizOpp ?? 'business'} via your upline sponsor. It does not endorse or guarantee any specific outcomes from this opportunity.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.darker(AppColors.success),
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
                context.l10n?.businessSponsorTitle ?? 'Your Referral Contact',
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
              children: () {
                final fullMessage = context.l10n?.businessSponsorMessage(
                  bizOpp ?? 'business',
                  sponsorName ?? 'an upline Team Leader',
                ) ?? 'If you choose to explore ${bizOpp ?? 'business'}, your referral contact will be ${sponsorName ?? 'an upline Team Leader'}. This person is a member of your upline team who has already joined ${bizOpp ?? 'business'}.';

                final parts = fullMessage.split(sponsorName ?? 'an upline Team Leader');

                return <InlineSpan>[
                  TextSpan(text: parts[0]),
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
                  if (parts.length > 1)
                    TextSpan(text: parts.skip(1).join(sponsorName ?? 'an upline Team Leader')),
                ];
              }(),
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
                context.l10n?.businessInstructionsTitle(bizOpp ?? 'business') ?? 'How to Join ${bizOpp ?? 'business'}',
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
            context.l10n?.businessInstructions(bizOpp ?? 'business') ?? '1. Copy the referral link below\n2. Open your web browser\n3. Paste the link and complete the ${bizOpp ?? 'business'} registration\n4. Return here to add your ${bizOpp ?? 'business'} referral link',
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

  Widget _buildProgressTracker() {
    final user = Provider.of<UserModel?>(context);
    final hasVisited = user?.bizVisitDate != null;
    final hasJoined = user?.bizJoinDate != null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary.withOpacity(0.1), AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.timeline, color: AppColors.primary, size: 24),
              const SizedBox(width: 12),
              Text(
                'Registration Progress',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildProgressStep(
            stepNumber: 1,
            title: 'Copy Registration Link',
            isComplete: hasVisited,
            completedDate: user?.bizVisitDate,
          ),
          const SizedBox(height: 12),
          _buildProgressStep(
            stepNumber: 2,
            title: 'Complete Registration',
            isComplete: hasJoined,
            completedDate: user?.bizJoinDate,
          ),
          const SizedBox(height: 12),
          _buildProgressStep(
            stepNumber: 3,
            title: 'Add Your Referral Link',
            isComplete: hasJoined,
            icon: Icons.link,
          ),
        ],
      ),
    );
  }

  Widget _buildProgressStep({
    required int stepNumber,
    required String title,
    required bool isComplete,
    DateTime? completedDate,
    IconData? icon,
  }) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: isComplete ? AppColors.success : AppColors.border,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: isComplete
                ? Icon(Icons.check, color: AppColors.textInverse, size: 20)
                : Text(
                    '$stepNumber',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: isComplete ? AppColors.success : AppColors.textPrimary,
                ),
              ),
              if (completedDate != null)
                Text(
                  'Completed ${_formatDate(completedDate)}',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
        if (isComplete)
          Icon(Icons.verified, color: AppColors.success, size: 20),
      ],
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    } else {
      return '${date.month}/${date.day}/${date.year}';
    }
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
                context.l10n?.businessNoUrlMessage ?? 'Registration URL not available. Please contact your sponsor.',
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
          context.l10n?.businessUrlLabel ?? 'Your Sponsors Referral Link:',
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
                      fontSize: 16,
                      color: Colors.blue,
                      decoration: TextDecoration.underline,
                      fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _confirmAndCopyUrl,
                icon: const Icon(Icons.copy),
                tooltip: context.l10n?.businessUrlCopyTooltip ?? 'Copy URL',
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
            context.l10n?.businessFollowUpTitle ?? 'Final Step: Link Your Account',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            context.l10n?.businessFollowUpMessage(bizOpp ?? 'business') ?? "After exploring ${bizOpp ?? 'business'}, you must return here and add your new ${bizOpp ?? 'business'} referral link to your Team Build Pro profile. This ensures your team connections are tracked correctly.",
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
                    context.l10n?.businessCompleteButton1 ?? "Registration Complete",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.l10n?.businessCompleteButton2 ?? "Add My Referral Link",
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
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
        appBar: AppScreenBar(title: context.l10n?.businessTitle ?? 'Business'),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundSecondary,
      appBar: AppScreenBar(title: context.l10n?.businessTitle ?? 'Business'),
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
                    _buildProgressTracker(),
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
