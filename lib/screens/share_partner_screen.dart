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
        'subject': context.l10n?.sharePartnerGeneralTeamToolSubject ?? 'Give your team an AI recruiting advantage',
        'message': (context.l10n?.sharePartnerGeneralTeamToolMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Want to help your $_bizOppName team grow faster?\n\nTeam Build Pro gives everyone on your team the same AI recruiting tools - 16 pre-written messages, prospect tracking, and a 24/7 AI Coach.\n\nTrue duplication. Everyone succeeds the same way.\n\nShare with your team: $_partnerReferralLink'),
      },
      'warm_market_exhausted': {
        'title': context.l10n?.sharePartnerWarmMarketExhaustedTitle ?? 'Warm Market Exhausted',
        'description': context.l10n?.sharePartnerWarmMarketExhaustedDescription ?? 'For partners who\'ve tapped out friends and family',
        'subject': context.l10n?.sharePartnerWarmMarketExhaustedSubject ?? 'When your warm market runs dry',
        'message': (context.l10n?.sharePartnerWarmMarketExhaustedMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Tapped out your warm market? Your team probably has too.\n\nTeam Build Pro gives them AI-written messages for any situation - cold outreach, follow-ups, objection handling. Plus a 24/7 AI Coach when they get stuck.\n\nHelp them keep recruiting: $_partnerReferralLink'),
      },
      'expensive_system_fatigue': {
        'title': context.l10n?.sharePartnerExpensiveSystemFatigueTitle ?? 'System Fatigue & Expense',
        'description': context.l10n?.sharePartnerExpensiveSystemFatigueDescription ?? 'For partners burned out on expensive recruiting methods',
        'subject': context.l10n?.sharePartnerExpensiveSystemFatigueSubject ?? 'Stop overpaying for recruiting tools',
        'message': (context.l10n?.sharePartnerExpensiveSystemFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Tired of expensive leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro is one simple tool: AI messages, prospect tracking, 24/7 coaching. Works for everyone on your team the same way.\n\nSimple. Affordable. Duplicatable.\n\nShare with your team: $_partnerReferralLink'),
      },
      'duplication_struggle': {
        'title': context.l10n?.sharePartnerDuplicationStruggleTitle ?? 'Duplication Challenges',
        'description': context.l10n?.sharePartnerDuplicationStruggleDescription ?? 'For leaders struggling to get their team to duplicate',
        'subject': context.l10n?.sharePartnerDuplicationStruggleSubject ?? 'Finally - real duplication for your team',
        'message': (context.l10n?.sharePartnerDuplicationStruggleMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Struggling to get your team to duplicate?\n\nTeam Build Pro gives every person the same AI tools - new recruit or veteran. Same messages. Same tracking. Same coaching.\n\nThey don\'t need your skills. They just need the same system.\n\nShare with your team: $_partnerReferralLink'),
      },
      'retention_crisis': {
        'title': context.l10n?.sharePartnerRetentionCrisisTitle ?? 'Team Dropout Problem',
        'description': context.l10n?.sharePartnerRetentionCrisisDescription ?? 'For leaders frustrated by team members quitting early',
        'subject': context.l10n?.sharePartnerRetentionCrisisSubject ?? 'Keep your team from quitting',
        'message': (context.l10n?.sharePartnerRetentionCrisisMessage(_bizOppName, _partnerReferralLink ?? '') ??
            '75% quit in their first year. Usually because they feel lost.\n\nTeam Build Pro keeps them on track - AI Coach answers questions 24/7, tracks their progress, tells them what to do next.\n\nThey\'re never alone. They stay engaged longer.\n\nShare with your team: $_partnerReferralLink'),
      },
      'skill_gap_team': {
        'title': context.l10n?.sharePartnerSkillGapTeamTitle ?? 'Non-Sales Team Members',
        'description': context.l10n?.sharePartnerSkillGapTeamDescription ?? 'Perfect for teams where most people lack sales experience',
        'subject': context.l10n?.sharePartnerSkillGapTeamSubject ?? 'Your non-sales team can recruit too',
        'message': (context.l10n?.sharePartnerSkillGapTeamMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Most of your team aren\'t natural salespeople. That\'s okay.\n\nTeam Build Pro writes their messages for them. AI handles the "what do I say?" problem so they can just share.\n\nIntroverts, part-timers, non-sales types - everyone can recruit now.\n\nShare with your team: $_partnerReferralLink'),
      },
      'recruitment_fatigue': {
        'title': context.l10n?.sharePartnerRecruitmentFatigueTitle ?? 'Tired of Constant Recruiting',
        'description': context.l10n?.sharePartnerRecruitmentFatigueDescription ?? 'For partners exhausted from the endless recruiting cycle',
        'subject': context.l10n?.sharePartnerRecruitmentFatigueSubject ?? 'Let AI handle the recruiting grind',
        'message': (context.l10n?.sharePartnerRecruitmentFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Burned out from constant recruiting? Your team probably is too.\n\nTeam Build Pro handles the grind - AI writes messages, tracks prospects, answers questions 24/7.\n\nThe AI never gets tired. Your team keeps growing.\n\nShare with your team: $_partnerReferralLink'),
      },
      'availability_gap': {
        'title': context.l10n?.sharePartnerAvailabilityGapTitle ?? 'Can\'t Be There 24/7',
        'description': context.l10n?.sharePartnerAvailabilityGapDescription ?? 'Ideal for leaders who can\'t be constantly available to their team',
        'subject': context.l10n?.sharePartnerAvailabilityGapSubject ?? 'Your team grows even when you\'re busy',
        'message': (context.l10n?.sharePartnerAvailabilityGapMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your team needs support but you can\'t be available 24/7.\n\nTeam Build Pro\'s AI Coach is always on - answers their questions, guides their conversations, keeps them moving forward.\n\nThey get help when they need it. You focus on leadership.\n\nShare with your team: $_partnerReferralLink'),
      },
      'ai_script_generator': {
        'title': context.l10n?.sharePartnerAiScriptGeneratorTitle ?? 'Share AI Script Generator',
        'description': context.l10n?.sharePartnerAiScriptGeneratorDescription ?? 'Give your team a free AI recruiting script tool',
        'subject': context.l10n?.sharePartnerAiScriptGeneratorSubject(_bizOppName) ?? 'Free AI recruiting scripts for your team',
        'message': (context.l10n?.sharePartnerAiScriptGeneratorMessage(_bizOppName, _scriptsReferralLink ?? '') ??
            'Quick win for your team - a free AI Script Generator.\n\nNo signup needed. Creates recruiting messages for cold outreach, follow-ups, objections - any scenario in seconds.\n\nShare this free tool: $_scriptsReferralLink'),
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
    final partnerTitle = context.l10n?.sharePartnerTitle ?? 'Your Team Partners';

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
                      _buildRefLinkHeader(),
                      const SizedBox(height: 20),
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

  Widget _buildInfoCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    Color? subtitleColor,
    required String description,
    Widget? footer,
  }) {
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
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                          fontSize: 12,
                          color: subtitleColor ?? AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            description,
            style: TextStyle(
                fontSize: 14, color: AppColors.textSecondary, height: 1.4),
          ),
          if (footer != null) ...[
            const SizedBox(height: 16),
            footer,
          ],
        ],
      ),
    );
  }

  Widget _buildRefLinkHeader() {
    return _buildInfoCard(
      icon: Icons.link,
      iconColor: AppColors.opportunityPrimary,
      title: context.l10n?.sharePartnerRefLinkTitle ?? 'Your Referral Link',
      subtitle: _partnerReferralLink ?? '',
      subtitleColor: AppColors.primary,
      description: context.l10n?.sharePartnerRefLinkDescription(_bizOppName) ??
          'Share your referral link with your $_bizOppName team members to give them the same AI recruiting tools you use.',
    );
  }

  Widget _buildPartnerHeader() {
    return _buildInfoCard(
      icon: Icons.handshake,
      iconColor: AppColors.opportunityPrimary,
      title: context.l10n?.sharePartnerHeaderTitle ?? 'Customized Messages',
      subtitle: context.l10n?.sharePartnerSubtitle(_bizOppName) ??
          'Great for your existing $_bizOppName team',
      description: context.l10n?.sharePartnerDescription(_bizOppName) ??
          'Empower your existing $_bizOppName partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire $_bizOppName organization.',
      footer: _buildImportantNote(),
    );
  }

  Widget _buildImportantNote() {
    return Container(
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
                    text: context.l10n?.sharePartnerImportantText(_bizOppName) ??
                        'We highly recommend you share the Team Build Pro app with your front-line $_bizOppName team members (individuals you have personally sponsored) before sharing it with $_bizOppName team members you did not personally sponsor. This will provide an opportunity to respect the established sponsoring relationships in your $_bizOppName downline.',
                  ),
                ],
              ),
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
    final selectedLanguage = _selectedLanguages[messageKey];
    final isExpanded = selectedLanguage != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isExpanded ? buttonColor.withValues(alpha: 0.5) : AppColors.border),
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
          // Language selection hint
          if (!isExpanded)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                'Select language to preview message:',
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
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
          // Animated expandable message preview
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: isExpanded
                ? _buildMessagePreviewSection(messageKey, selectedLanguage, buttonColor)
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildMessagePreviewSection(String messageKey, String languageCode, Color buttonColor) {
    return FutureBuilder<Map<String, String>?>(
      future: _getMessageForLanguage(messageKey, languageCode),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: buttonColor,
                ),
              ),
            ),
          );
        }

        final message = snapshot.data;
        if (message == null) {
          return const SizedBox.shrink();
        }

        final subject = message['subject'] ?? '';
        final body = message['message'] ?? '';

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 12),
            // Message preview container
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Subject line
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Subject:',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          subject,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  // Message body
                  Text(
                    body,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Action buttons
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
                      // Use scripts link for AI Script Generator, otherwise use regular link
                      final targetedLink = messageKey == 'ai_script_generator'
                          ? _buildScriptsLink(messageKey)
                          : _buildTargetedLink(messageKey);
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
        );
      },
    );
  }

  Future<Map<String, String>?> _getMessageForLanguage(String messageKey, String languageCode) async {
    try {
      final currentLocale = Localizations.localeOf(context).languageCode;

      if (languageCode == currentLocale) {
        // Use current context's localization
        final messages = _getPartnerMessages(context);
        return messages[messageKey];
      } else {
        // Load specific language localization
        final l10n = await _getLocalizationForLanguage(languageCode);
        final messages = _getPartnerMessagesForL10n(l10n);
        return messages[messageKey];
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error getting message for language $languageCode: $e');
      }
      return null;
    }
  }

  Widget _buildLanguageButton(String messageKey, String languageCode, String label) {
    final isSelected = _selectedLanguages[messageKey] == languageCode;

    return GestureDetector(
      onTap: () {
        setState(() {
          // Toggle: if already selected, deselect (collapse); otherwise select
          if (_selectedLanguages[messageKey] == languageCode) {
            _selectedLanguages.remove(messageKey);
          } else {
            _selectedLanguages[messageKey] = languageCode;
          }
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
