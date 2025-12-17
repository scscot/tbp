import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';
import '../widgets/localized_text.dart';
import '../l10n/app_localizations.dart';

class SharePartnerScreen extends StatefulWidget {
  final String appId;

  const SharePartnerScreen({
    super.key,
    required this.appId,
  });

  @override
  State<SharePartnerScreen> createState() => _SharePartnerScreenState();
}

class _SharePartnerScreenState extends State<SharePartnerScreen>
    with TickerProviderStateMixin {
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _partnerReferralLink;
  String? _scriptsReferralLink;
  String _bizOppName = 'your opportunity'; // Default fallback
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  final Map<String, String?> _selectedLanguages = {}; // Track selected language per message

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _loadCurrentUser();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadCurrentUser() async {
    try {
      final authUser = FirebaseAuth.instance.currentUser;
      if (authUser != null) {
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(authUser.uid)
            .get();

        if (doc.exists) {
          _currentUser = UserModel.fromMap(doc.data()!);
          await _fetchBizOppName();
          _buildReferralLinks();
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error loading current user: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
      _animationController.forward();
    }
  }

  Future<void> _fetchBizOppName() async {
    try {
      if (_currentUser != null) {
        final uplineAdmin = _currentUser!.role == 'admin'
            ? _currentUser!.uid
            : _currentUser!.uplineAdmin;

        if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
          final adminSettingsDoc = await FirebaseFirestore.instance
              .collection('admin_settings')
              .doc(uplineAdmin)
              .get();

          if (adminSettingsDoc.exists) {
            final adminData = adminSettingsDoc.data();
            final bizOpp = adminData?['biz_opp'] as String?;
            if (bizOpp != null && bizOpp.isNotEmpty) {
              setState(() {
                _bizOppName = bizOpp;
              });
              return;
            }
          }
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error fetching biz opp name: $e');
      }
    }
  }

  void _buildReferralLinks() {
    if (_currentUser != null) {
      _partnerReferralLink =
          'https://teambuildpro.com/?ref=${_currentUser!.referralCode}';
      _scriptsReferralLink =
          'https://teambuildpro.com/scripts.html?ref=${_currentUser!.referralCode}';
    }
  }

  // Build targeted referral link with language-specific domain
  String _buildTargetedLink(String messageKey) {
    final selectedLanguage = _selectedLanguages[messageKey];

    // Determine base domain based on selected language
    String baseDomain = 'https://teambuildpro.com';
    if (selectedLanguage == 'es') {
      baseDomain = 'https://es.teambuildpro.com';
    } else if (selectedLanguage == 'pt') {
      baseDomain = 'https://pt.teambuildpro.com';
    } else if (selectedLanguage == 'de') {
      baseDomain = 'https://de.teambuildpro.com';
    }

    final referralCode = _currentUser!.referralCode;

    return '$baseDomain/?ref=$referralCode';
  }

  // Build targeted scripts link with language-specific domain
  String _buildScriptsLink(String messageKey) {
    final selectedLanguage = _selectedLanguages[messageKey];

    // Determine base domain based on selected language
    String baseDomain = 'https://teambuildpro.com';
    if (selectedLanguage == 'es') {
      baseDomain = 'https://es.teambuildpro.com';
    } else if (selectedLanguage == 'pt') {
      baseDomain = 'https://pt.teambuildpro.com';
    } else if (selectedLanguage == 'de') {
      baseDomain = 'https://de.teambuildpro.com';
    }

    final referralCode = _currentUser!.referralCode;

    return '$baseDomain/scripts.html?ref=$referralCode';
  }

  Future<void> _composeEmail({
    required String subject,
    required String body,
  }) async {
    final text = '$subject\n\n$body';

    if (kDebugMode) {
      debugPrint('📧 SHARE_PARTNER_SCREEN: _composeEmail → Share.share()');
      debugPrint('📧 Subject: $subject');
      debugPrint('📧 Body length: ${body.length} characters');
      debugPrint('📧 Total text length: ${text.length} characters');
    }

    try {
      final box = context.findRenderObject() as RenderBox?;
      await Share.share(
        text,
        sharePositionOrigin: box!.localToGlobal(Offset.zero) & box.size,
      );

      if (kDebugMode) {
        debugPrint('✅ SHARE_PARTNER_SCREEN: Share.share() completed successfully');
      }
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('❌ SHARE_PARTNER_SCREEN: Share.share() error: $e');
        debugPrint(stack.toString());
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to open share sheet: $e'),
        ),
      );
    }
  }


  // Check if sharing is enabled via Firebase Remote Config
  bool _isSharingEnabled() {
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;

      // Check if we're in demo mode (either iOS or Android)
      bool isDemoMode = false;
      if (Platform.isAndroid) {
        isDemoMode = remoteConfig.getBool('android_demo_mode');
      } else if (Platform.isIOS) {
        isDemoMode = remoteConfig.getBool('ios_demo_mode');
      }

      // Debug print to see what's happening
      if (kDebugMode) {
        debugPrint('🔧 SHARE_PARTNER_SCREEN: Demo mode check - Android: ${Platform.isAndroid ? isDemoMode : 'N/A'}, iOS: ${Platform.isIOS ? isDemoMode : 'N/A'}');
      }

      // If in demo mode, sharing is disabled
      if (isDemoMode) {
        if (kDebugMode) {
          debugPrint('🚫 SHARE_PARTNER_SCREEN: Sharing disabled due to demo mode');
        }
        return false;
      }

      // Production mode - sharing is always enabled
      if (kDebugMode) {
        debugPrint('✅ SHARE_PARTNER_SCREEN: Sharing enabled');
      }
      return true;
    } catch (e) {
      // Default to enabled if Remote Config fails
      if (kDebugMode) {
        debugPrint('⚠️ SHARE_PARTNER_SCREEN: Remote Config error, defaulting to enabled: $e');
      }
      return true;
    }
  }

  Map<String, Map<String, String>> _getPartnerMessages(BuildContext context) {
    return {
      'general_team_tool': {
        'title': context.l10n?.sharePartnerGeneralTeamToolTitle ?? 'General Invitation',
        'description': context.l10n?.sharePartnerGeneralTeamToolDescription ?? 'A versatile message for any partner situation',
        'subject': context.l10n?.sharePartnerGeneralTeamToolSubject ?? 'The AI Recruiting Advantage for Your $_bizOppName Team',
        'message': (context.l10n?.sharePartnerGeneralTeamToolMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team deserves a real competitive edge.\n\nTeam Build Pro gives your entire $_bizOppName organization AI recruiting tools that actually duplicate:\n\n- 16 pre-written recruiting messages for any situation\n- Track prospect engagement in real-time\n- 24/7 AI Coach for recruiting guidance\n- True duplication - everyone gets the same tools\n\nYour team\'s prospects pre-build their teams BEFORE joining. Your partners duplicate the exact same AI tools. Everyone in your $_bizOppName organization grows faster.\n\nGive your team the AI advantage: $_partnerReferralLink\n\nThis is how modern leaders scale their teams.'),
      },
      'warm_market_exhausted': {
        'title': context.l10n?.sharePartnerWarmMarketExhaustedTitle ?? 'Warm Market Exhausted',
        'description': context.l10n?.sharePartnerWarmMarketExhaustedDescription ?? 'For partners who\'ve tapped out friends and family',
        'subject': context.l10n?.sharePartnerWarmMarketExhaustedSubject ?? 'Give Your $_bizOppName Team an AI Recruiting Companion',
        'message': (context.l10n?.sharePartnerWarmMarketExhaustedMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team tapped out their warm market? Tired of watching them chase leads that ghost them?\n\nGive your entire $_bizOppName organization an AI recruiting companion.\n\nTeam Build Pro works for every person on your team:\n- 16 pre-written messages eliminate "what do I say?"\n- Track prospect interest and engagement\n- 24/7 AI Coach answers their questions\n- Everyone duplicates the same proven system\n\nTheir prospects pre-build teams BEFORE joining - launching with momentum, not from zero.\n\nYour entire $_bizOppName team gets the same AI advantage. True duplication at scale.\n\nEmpower your team: $_partnerReferralLink\n\nStop watching them chase. Start watching them succeed.'),
      },
      'expensive_system_fatigue': {
        'title': context.l10n?.sharePartnerExpensiveSystemFatigueTitle ?? 'System Fatigue & Expense',
        'description': context.l10n?.sharePartnerExpensiveSystemFatigueDescription ?? 'For partners burned out on expensive recruiting methods',
        'subject': context.l10n?.sharePartnerExpensiveSystemFatigueSubject ?? 'Stop Overpaying. Empower Your $_bizOppName Team with AI',
        'message': (context.l10n?.sharePartnerExpensiveSystemFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team burning money on leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro gives your entire $_bizOppName organization AI recruiting tools - built right in. No extra costs. No complex setup.\n\nEvery person on your team gets:\n- 16 pre-written recruiting messages\n- Real-time engagement tracking\n- 24/7 AI Coach for guidance\n- One simple system that duplicates\n\nTheir prospects pre-build teams BEFORE joining. Your $_bizOppName team duplicates the exact same AI tools. Everyone wins.\n\nOne simple system. Real results.\n\nEmpower your team: $_partnerReferralLink\n\nStop overpaying. Start scaling smart.'),
      },
      'duplication_struggle': {
        'title': context.l10n?.sharePartnerDuplicationStruggleTitle ?? 'Duplication Challenges',
        'description': context.l10n?.sharePartnerDuplicationStruggleDescription ?? 'For leaders struggling to get their team to duplicate',
        'subject': context.l10n?.sharePartnerDuplicationStruggleSubject ?? 'Finally, Real Duplication for Your $_bizOppName Team',
        'message': (context.l10n?.sharePartnerDuplicationStruggleMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team struggles to duplicate your recruiting success? That ends today.\n\nTeam Build Pro gives every person on your $_bizOppName team the same AI recruiting coach you wish you\'d had:\n- Drafts their recruiting messages\n- Times their follow-ups perfectly\n- Tracks their prospects automatically\n- Coaches their next steps\n\nNew recruit or veteran leader - everyone in your $_bizOppName organization gets identical AI tools. True system duplication.\n\nTheir prospects pre-build teams BEFORE joining. Your team grows faster. Consistently.\n\nEmpower true duplication: $_partnerReferralLink\n\nFinally, your entire team succeeds the same way.'),
      },
      'retention_crisis': {
        'title': context.l10n?.sharePartnerRetentionCrisisTitle ?? 'Team Dropout Problem',
        'description': context.l10n?.sharePartnerRetentionCrisisDescription ?? 'For leaders frustrated by team members quitting early',
        'subject': context.l10n?.sharePartnerRetentionCrisisSubject ?? 'Stop Losing Your $_bizOppName Team in the First Year',
        'message': (context.l10n?.sharePartnerRetentionCrisisMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Watching your $_bizOppName team quit before they succeed?\n\n75% drop out in their first year - usually because they feel lost, unsupported, or overwhelmed.\n\nTeam Build Pro changes that for your entire $_bizOppName organization. Every person on your team gets an AI Coach that:\n- Guides them through every recruiting conversation\n- Tracks their progress and celebrates wins\n- Reminds them what to do next\n- Keeps momentum going when motivation dips\n\nThey\'re never alone. They always know their next step. They stay engaged longer.\n\nYour $_bizOppName team finally has the support they need to succeed.\n\nEmpower your team: $_partnerReferralLink\n\nStop watching them quit. Start watching them win.'),
      },
      'skill_gap_team': {
        'title': context.l10n?.sharePartnerSkillGapTeamTitle ?? 'Non-Sales Team Members',
        'description': context.l10n?.sharePartnerSkillGapTeamDescription ?? 'Perfect for teams where most people lack sales experience',
        'subject': context.l10n?.sharePartnerSkillGapTeamSubject ?? 'Your Non-Sales $_bizOppName Team Can Win with AI',
        'message': (context.l10n?.sharePartnerSkillGapTeamMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Most of your $_bizOppName team aren\'t natural salespeople. That\'s been holding them back.\n\nTeam Build Pro turns your non-sales $_bizOppName partners into confident recruiters:\n- Drafts their recruiting messages for them\n- Suggests exactly who to contact next\n- Coaches them through every conversation\n- Tracks progress so they see real momentum\n\nYour introverts, your part-timers, your "I\'m not good at sales" people - everyone in your $_bizOppName organization gets the same AI advantage.\n\nFinally, your entire team can duplicate your success.\n\nEmpower everyone: $_partnerReferralLink\n\nYou don\'t need a team of salespeople. You need a team with AI.'),
      },
      'recruitment_fatigue': {
        'title': context.l10n?.sharePartnerRecruitmentFatigueTitle ?? 'Tired of Constant Recruiting',
        'description': context.l10n?.sharePartnerRecruitmentFatigueDescription ?? 'For partners exhausted from the endless recruiting cycle',
        'subject': context.l10n?.sharePartnerRecruitmentFatigueSubject ?? 'Automate the Grind. Grow Your $_bizOppName Team.',
        'message': (context.l10n?.sharePartnerRecruitmentFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team burned out from constant recruiting? The endless follow-ups? The manual tracking?\n\nTeam Build Pro\'s AI handles the grind for your entire $_bizOppName organization.\n\nFor every person on your team, the AI:\n- Provides 16 pre-written recruiting messages\n- Tracks every prospect and their status\n- Answers recruiting questions 24/7\n- Keeps everyone focused on what works\n\nYou stay focused on leadership. Your $_bizOppName team stays productive without burning out.\n\nThe AI never gets tired. Your team\'s momentum never stops.\n\nEmpower sustainable growth: $_partnerReferralLink\n\nGrowth without the burnout. Finally.'),
      },
      'availability_gap': {
        'title': context.l10n?.sharePartnerAvailabilityGapTitle ?? 'Can\'t Be There 24/7',
        'description': context.l10n?.sharePartnerAvailabilityGapDescription ?? 'Ideal for leaders who can\'t be constantly available to their team',
        'subject': context.l10n?.sharePartnerAvailabilityGapSubject ?? 'Your $_bizOppName Team Grows Even When You\'re Not There',
        'message': (context.l10n?.sharePartnerAvailabilityGapMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team needs you. But you can\'t be available 24/7.\n\nTeam Build Pro gives your entire $_bizOppName organization an AI Coach that\'s always on.\n\nWhile you sleep, work your day job, or spend time with family, the AI:\n- Guides your team through recruiting conversations\n- Answers their "what do I do next?" questions\n- Tracks their progress and keeps them motivated\n- Ensures nothing falls through the cracks\n\n'
            'Your $_bizOppName team gets support exactly when they need it - not just when you\'re available.\n\n'
            'You stay focused on leadership. The AI handles daily coaching.\n\n'
            'Empower your team: $_partnerReferralLink\n\n'
            'Finally, your team grows without needing you every minute.'),
      },
      'ai_script_generator': {
        'title': context.l10n?.sharePartnerAiScriptGeneratorTitle ?? 'Share AI Script Generator',
        'description': context.l10n?.sharePartnerAiScriptGeneratorDescription ?? 'Give your team a free AI recruiting script tool',
        'subject': context.l10n?.sharePartnerAiScriptGeneratorSubject(_bizOppName) ?? 'Free AI Tool for Your $_bizOppName Team\'s Recruiting',
        'message': (context.l10n?.sharePartnerAiScriptGeneratorMessage(_bizOppName, _scriptsReferralLink ?? '') ??
            'Want to help your $_bizOppName team recruit more effectively?\n\nShare this free AI Script Generator with them. No signup required - it creates personalized recruiting messages for any scenario in seconds.\n\nYour team can generate scripts for:\n- Cold outreach\n- Follow-ups\n- Objection handling (no time, no money, is this MLM?)\n- Re-engaging old contacts\n\nShare with your team: $_scriptsReferralLink\n\nIt\'s an easy win - give them AI tools that help them succeed.'),
      },
    };
  }

  Map<String, Map<String, String>> _getPartnerMessagesForL10n(AppLocalizations l10n) {
    return {
      'general_team_tool': {
        'title': l10n.sharePartnerGeneralTeamToolTitle,
        'description': l10n.sharePartnerGeneralTeamToolDescription,
        'subject': l10n.sharePartnerGeneralTeamToolSubject,
        'message': l10n.sharePartnerGeneralTeamToolMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'warm_market_exhausted': {
        'title': l10n.sharePartnerWarmMarketExhaustedTitle,
        'description': l10n.sharePartnerWarmMarketExhaustedDescription,
        'subject': l10n.sharePartnerWarmMarketExhaustedSubject,
        'message': l10n.sharePartnerWarmMarketExhaustedMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'expensive_system_fatigue': {
        'title': l10n.sharePartnerExpensiveSystemFatigueTitle,
        'description': l10n.sharePartnerExpensiveSystemFatigueDescription,
        'subject': l10n.sharePartnerExpensiveSystemFatigueSubject,
        'message': l10n.sharePartnerExpensiveSystemFatigueMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'duplication_struggle': {
        'title': l10n.sharePartnerDuplicationStruggleTitle,
        'description': l10n.sharePartnerDuplicationStruggleDescription,
        'subject': l10n.sharePartnerDuplicationStruggleSubject,
        'message': l10n.sharePartnerDuplicationStruggleMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'retention_crisis': {
        'title': l10n.sharePartnerRetentionCrisisTitle,
        'description': l10n.sharePartnerRetentionCrisisDescription,
        'subject': l10n.sharePartnerRetentionCrisisSubject,
        'message': l10n.sharePartnerRetentionCrisisMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'skill_gap_team': {
        'title': l10n.sharePartnerSkillGapTeamTitle,
        'description': l10n.sharePartnerSkillGapTeamDescription,
        'subject': l10n.sharePartnerSkillGapTeamSubject,
        'message': l10n.sharePartnerSkillGapTeamMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'recruitment_fatigue': {
        'title': l10n.sharePartnerRecruitmentFatigueTitle,
        'description': l10n.sharePartnerRecruitmentFatigueDescription,
        'subject': l10n.sharePartnerRecruitmentFatigueSubject,
        'message': l10n.sharePartnerRecruitmentFatigueMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'availability_gap': {
        'title': l10n.sharePartnerAvailabilityGapTitle,
        'description': l10n.sharePartnerAvailabilityGapDescription,
        'subject': l10n.sharePartnerAvailabilityGapSubject,
        'message': l10n.sharePartnerAvailabilityGapMessage(_bizOppName, _partnerReferralLink ?? ''),
      },
      'ai_script_generator': {
        'title': l10n.sharePartnerAiScriptGeneratorTitle,
        'description': l10n.sharePartnerAiScriptGeneratorDescription,
        'subject': l10n.sharePartnerAiScriptGeneratorSubject(_bizOppName),
        'message': l10n.sharePartnerAiScriptGeneratorMessage(_bizOppName, _scriptsReferralLink ?? ''),
      },
    };
  }

  Future<AppLocalizations> _getLocalizationForLanguage(String languageCode) async {
    final locale = Locale(languageCode);
    return await AppLocalizations.delegate.load(locale);
  }

  Future<void> _sharePartnerMessage(BuildContext context, String messageKey) async {
    if (kDebugMode) {
      debugPrint('🚀 SHARE_PARTNER_SCREEN: _sharePartnerMessage called with key: $messageKey');
    }

    // Check if sharing is disabled via Remote Config
    if (!_isSharingEnabled()) {
      if (kDebugMode) {
        debugPrint('🚫 SHARE_PARTNER_SCREEN: Sharing disabled, showing demo dialog');
      }
      _showDemoModeDialog();
      return;
    }

    if (_partnerReferralLink != null) {
      final selectedLanguage = _selectedLanguages[messageKey];

      if (selectedLanguage != null && selectedLanguage != Localizations.localeOf(context).languageCode) {
        final l10n = await _getLocalizationForLanguage(selectedLanguage);
        final messages = _getPartnerMessagesForL10n(l10n);
        final selectedMessage = messages[messageKey];

        if (selectedMessage != null) {
          String messageBody;
          String targetedLink;

          // Handle AI Script Generator specially - it uses scripts.html link
          if (messageKey == 'ai_script_generator') {
            targetedLink = _buildScriptsLink(messageKey);
            messageBody = selectedMessage['message']!.replaceAll(_scriptsReferralLink ?? '', targetedLink);
          } else {
            targetedLink = _buildTargetedLink(messageKey);
            messageBody = selectedMessage['message']!.replaceAll(_partnerReferralLink!, targetedLink);
          }

          if (kDebugMode) {
            debugPrint('📧 SHARE_PARTNER_SCREEN: Composing email (lang: $selectedLanguage) with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        }
      } else {
        final messages = _getPartnerMessages(context);
        final selectedMessage = messages[messageKey];

        if (selectedMessage != null) {
          String messageBody;
          String targetedLink;

          // Handle AI Script Generator specially - it uses scripts.html link
          if (messageKey == 'ai_script_generator') {
            targetedLink = _buildScriptsLink(messageKey);
            messageBody = selectedMessage['message']!.replaceAll(_scriptsReferralLink ?? '', targetedLink);
          } else {
            targetedLink = _buildTargetedLink(messageKey);
            messageBody = selectedMessage['message']!.replaceAll(_partnerReferralLink!, targetedLink);
          }

          if (kDebugMode) {
            debugPrint('📧 SHARE_PARTNER_SCREEN: Composing email with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        } else {
          if (kDebugMode) {
            debugPrint('❌ SHARE_PARTNER_SCREEN: No message found for key: $messageKey');
          }
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint('❌ SHARE_PARTNER_SCREEN: _partnerReferralLink is null');
      }
    }
  }

  void _showDemoModeDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(context.l10n?.shareDemoTitle ?? 'Demo Mode'),
          content: Text(context.l10n?.shareDemoMessage ?? 'Sharing disabled during demo mode.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: Text(context.l10n?.shareDemoButton ?? 'I Understand'),
            ),
          ],
        );
      },
    );
  }

  void _copyLink(String? link) {
    // Check if sharing is disabled via Remote Config
    if (!_isSharingEnabled()) {
      _showDemoModeDialog();
      return;
    }

    if (link != null) {
      Clipboard.setData(ClipboardData(text: link));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white),
              const SizedBox(width: 8),
              Text(context.l10n?.shareLinkCopiedMessage ?? 'Referral link copied!'),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Dynamic title based on bizOppName
    final partnerTitle = context.l10n?.sharePartnerTitle ?? 'Current $_bizOppName Partners';

    return Scaffold(
      appBar: AppScreenBar(title: partnerTitle, appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildPartnerHeader(),
                      const SizedBox(height: 20),
                      _buildPartnerMessages(),
                      const SizedBox(height: 32),
                      _buildProTips(),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildPartnerHeader() {
    final buttonColor = AppColors.opportunityPrimary;
    final icon = Icons.handshake;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.lightShadow,
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
                    color: buttonColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: buttonColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n?.sharePartnerTitle ?? 'Current $_bizOppName Partners',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      context.l10n?.sharePartnerSubtitle(_bizOppName) ?? 'Great for your existing $_bizOppName team',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            context.l10n?.sharePartnerDescription(_bizOppName) ?? 'Empower your existing $_bizOppName partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire $_bizOppName organization.',
            style: TextStyle(
                fontSize: 14, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: Colors.amber.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline,
                  color: Colors.amber[700],
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: RichText(
                    overflow: TextOverflow.visible,
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                      children: [
                        TextSpan(
                          text: context.l10n?.sharePartnerImportantLabel ?? 'Important: ',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.amber[900],
                          ),
                        ),
                        TextSpan(
                          text: context.l10n?.sharePartnerImportantText(_bizOppName) ?? 'We highly recommend you share the Team Build Pro app with your front-line $_bizOppName team members (individuals you have personally sponsored) before sharing it with $_bizOppName team members you did not personally sponsor. This will provide an opportunity to respect the established sponsoring relationships in your $_bizOppName downline.',
                        ),
                      ],
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

  Widget _buildPartnerMessages() {
    final buttonColor = AppColors.opportunityPrimary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n?.shareSelectMessageLabel ?? 'Select Message To Send',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        ..._getPartnerMessages(context).entries.map((entry) {
          return _buildMessageOption(
            entry.key,
            entry.value['title']!,
            entry.value['description']!,
            buttonColor,
          );
        }),
      ],
    );
  }

  Widget _buildMessageOption(String messageKey, String title, String description, Color buttonColor) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.lightShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildLanguageButton(messageKey, 'en', 'English'),
              _buildLanguageButton(messageKey, 'es', 'Español'),
              _buildLanguageButton(messageKey, 'pt', 'Português'),
              _buildLanguageButton(messageKey, 'de', 'Deutsch'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _sharePartnerMessage(context, messageKey),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: buttonColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.share, size: 18),
                  label: Text(context.l10n?.shareButtonShare ?? 'Share', style: const TextStyle(fontSize: 14)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    final targetedLink = _buildTargetedLink(messageKey);
                    _copyLink(targetedLink);
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: buttonColor,
                    side: BorderSide(color: buttonColor),
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(context.l10n?.shareButtonCopyLink ?? 'Copy Link', style: const TextStyle(fontSize: 14)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageButton(String messageKey, String languageCode, String label) {
    final isSelected = _selectedLanguages[messageKey] == languageCode;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedLanguages[messageKey] = languageCode;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.opportunityPrimary.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? AppColors.opportunityPrimary : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? AppColors.opportunityPrimary : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }

  Widget _buildProTips() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.infoBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lightbulb_rounded, color: AppColors.warning, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  context.l10n?.shareProTipsTitle ?? 'Pro Tips for Success',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildTip(context.l10n?.shareProTip1 ?? 'Personalize your message when sharing'),
          _buildTip(context.l10n?.shareProTip2 ?? 'Share consistently across all social platforms'),
          _buildTip(context.l10n?.shareProTip3 ?? 'Follow up with prospects who show interest'),
          _buildTip(context.l10n?.shareProTip4 ?? 'Track your results and adjust your approach'),
          if (_currentUser?.role == 'admin')
            _buildTip(context.l10n?.shareProTip5 ?? 'Use both strategies for maximum growth potential'),
        ],
      ),
    );
  }

  Widget _buildTip(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6),
            width: 6,
            height: 6,
            decoration:
                BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
              child: Text(text,
                  style: const TextStyle(fontSize: 14, height: 1.4))),
        ],
      ),
    );
  }
}
