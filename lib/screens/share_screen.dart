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

class ShareScreen extends StatefulWidget {
  final String appId;

  const ShareScreen({
    super.key,
    required this.appId,
  });

  @override
  State<ShareScreen> createState() => _ShareScreenState();
}

class _ShareScreenState extends State<ShareScreen>
    with TickerProviderStateMixin {
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _prospectReferralLink;
  String? _partnerReferralLink;
  String _bizOppName = 'your opportunity'; // Default fallback
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  bool _showProspectMessages = false;
  bool _showPartnerMessages = false;
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
      _prospectReferralLink =
          'https://teambuildpro.com/?new=${_currentUser!.referralCode}';
      _partnerReferralLink =
          'https://teambuildpro.com/?ref=${_currentUser!.referralCode}';
    }
  }

  // Get message type index for targeting
  String _getMessageTypeIndex(String messageKey, bool isPartner) {
    if (isPartner) {
      switch (messageKey) {
        case 'warm_market_exhausted': return '5';
        case 'expensive_system_fatigue': return '6';
        case 'duplication_struggle': return '7';
        case 'general_team_tool': return '8';
        case 'retention_crisis': return '13';
        case 'skill_gap_team': return '14';
        case 'recruitment_fatigue': return '15';
        case 'availability_gap': return '16';
        default: return '8';
      }
    } else {
      switch (messageKey) {
        case 'past_struggles': return '1';
        case 'not_salesperson': return '2';
        case 'hope_after_disappointment': return '3';
        case 'general_invitation': return '4';
        case 'social_anxiety': return '9';
        case 'time_constrained': return '10';
        case 'financial_risk_averse': return '11';
        case 'skeptical_realist': return '12';
        default: return '4';
      }
    }
  }

  // Build targeted referral link with message type
  String _buildTargetedLink(String messageKey, bool isPartner) {
    final baseLink = isPartner ? _partnerReferralLink : _prospectReferralLink;
    final messageType = _getMessageTypeIndex(messageKey, isPartner);
    return '$baseLink&t=$messageType';
  }

  Future<void> _composeEmail({
    required String subject,
    required String body,
  }) async {
    final text = '$subject\n\n$body';

    if (kDebugMode) {
      debugPrint('📧 SHARE_SCREEN: _composeEmail → Share.share()');
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
        debugPrint('✅ SHARE_SCREEN: Share.share() completed successfully');
      }
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('❌ SHARE_SCREEN: Share.share() error: $e');
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
        debugPrint('🔧 SHARE_SCREEN: Demo mode check - Android: ${Platform.isAndroid ? isDemoMode : 'N/A'}, iOS: ${Platform.isIOS ? isDemoMode : 'N/A'}');
      }
      
      // If in demo mode, sharing is disabled
      if (isDemoMode) {
        if (kDebugMode) {
          debugPrint('🚫 SHARE_SCREEN: Sharing disabled due to demo mode');
        }
        return false;
      }
      
      // Production mode - sharing is always enabled
      if (kDebugMode) {
        debugPrint('✅ SHARE_SCREEN: Sharing enabled');
      }
      return true;
    } catch (e) {
      // Default to enabled if Remote Config fails
      if (kDebugMode) {
        debugPrint('⚠️ SHARE_SCREEN: Remote Config error, defaulting to enabled: $e');
      }
      return true;
    }
  }

  Map<String, Map<String, String>> _getProspectMessages(BuildContext context) {
    return {
      'general_invitation': {
        'title': context.l10n?.shareProspectGeneralInvitationTitle ?? 'General Invitation',
        'description': context.l10n?.shareProspectGeneralInvitationDescription ?? 'A versatile message for any prospect situation',
        'subject': context.l10n?.shareProspectGeneralInvitationSubject ?? 'Build Before You Join - Guided by AI',
        'message': (context.l10n?.shareProspectGeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'You\'re invited to try a smarter way to start.\n\nWith Team Build Pro, an AI Coach helps you pre-build your $_bizOppName team before you officially join.\n\nHere\'s how it helps:\n- Drafts personalized messages\n- Schedules follow-ups automatically\n- Tracks momentum and next steps\n\nSo Day 1 isn\'t a cold start - it\'s a running start.\n\nTake a look: $_prospectReferralLink'),
      },
      'past_struggles': {
        'title': context.l10n?.shareProspectPastStrugglesTitle ?? 'Addressing Past Struggles',
        'description': context.l10n?.shareProspectPastStrugglesDescription ?? 'Perfect for prospects who have tried before and struggled',
        'subject': context.l10n?.shareProspectPastStrugglesSubject ?? 'A Smarter Way to Start This Time',
        'message': (context.l10n?.shareProspectPastStrugglesMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'If past attempts left you stuck at zero with no momentum, here\'s a smarter path.\n\nTeam Build Pro\'s AI Coach helps you pre-build your $_bizOppName team before you even join.\n\nIt drafts your messages, times your follow-ups, and tracks who\'s interested - so you don\'t start from scratch this time. You launch with people already waiting for you.\n\nThe AI walks you through every step. You won\'t be alone.\n\nSee how it works: $_prospectReferralLink\n\nYou deserve a real shot this time.'),
      },
      'not_salesperson': {
        'title': context.l10n?.shareProspectNotSalespersonTitle ?? 'For Non-Sales Minded',
        'description': context.l10n?.shareProspectNotSalespersonDescription ?? 'Great for people who don\'t see themselves as "salespeople"',
        'subject': context.l10n?.shareProspectNotSalespersonSubject ?? 'You Don\'t Have to Be a "Salesperson"',
        'message': (context.l10n?.shareProspectNotSalespersonMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Not a "natural salesperson"? That\'s okay. You have an AI Coach.\n\nTeam Build Pro helps you pre-build your $_bizOppName team with AI that drafts your messages, schedules your follow-ups, and tracks everyone\'s interest.\n\nIt\'s like having a recruiting assistant who never sleeps. You focus on relationships. The AI handles the rest.\n\nStart building before you even join: $_prospectReferralLink\n\nYou don\'t need a "sales personality." You need smart tools. Now you have them.'),
      },
      'hope_after_disappointment': {
        'title': context.l10n?.shareProspectHopeAfterDisappointmentTitle ?? 'Hope After Disappointment',
        'description': context.l10n?.shareProspectHopeAfterDisappointmentDescription ?? 'Ideal for prospects burned by previous opportunities',
        'subject': context.l10n?.shareProspectHopeAfterDisappointmentSubject ?? 'A Smarter Way to Start This Time',
        'message': (context.l10n?.shareProspectHopeAfterDisappointmentMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Been burned before? Promised the world, then left starting from zero?\n\nThis time is different. Team Build Pro\'s AI Coach helps you pre-build your $_bizOppName team before you join.\n\nIt drafts your recruiting messages, times your follow-ups, tracks who\'s interested, and coaches you on next steps. You gain real momentum before Day 1.\n\nNo hype. No empty promises. Just AI-powered tools that work.\n\nSee how: $_prospectReferralLink\n\nYou deserve a system that actually sets you up to win.'),
      },
      'social_anxiety': {
        'title': context.l10n?.shareProspectSocialAnxietyTitle ?? 'Avoiding Awkward Conversations',
        'description': context.l10n?.shareProspectSocialAnxietyDescription ?? 'Perfect for introverts or those uncomfortable with face-to-face recruiting',
        'subject': context.l10n?.shareProspectSocialAnxietySubject ?? 'Build Your Team Without Awkward Conversations',
        'message': (context.l10n?.shareProspectSocialAnxietyMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Uncomfortable approaching friends and family? You don\'t have to.\n\nTeam Build Pro lets you build your $_bizOppName network online first - where it feels comfortable.\n\nThe AI Coach drafts your messages, suggests who to contact, and tracks responses. You build relationships at your own pace, without pressure.\n\nNo cold calls. No awkward pitches. Just genuine connections guided by AI.\n\nStart building on your terms: $_prospectReferralLink\n\nFinally, a way to grow your network that feels natural to you.'),
      },
      'time_constrained': {
        'title': context.l10n?.shareProspectTimeConstrainedTitle ?? 'For Busy Professionals',
        'description': context.l10n?.shareProspectTimeConstrainedDescription ?? 'Ideal for prospects juggling job, family, and other commitments',
        'subject': context.l10n?.shareProspectTimeConstrainedSubject ?? 'Build Your Team in the Gaps',
        'message': (context.l10n?.shareProspectTimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Can\'t dedicate full-time hours? You don\'t need to.\n\nTeam Build Pro works around your schedule. Build your $_bizOppName team during morning coffee, lunch breaks, or evening downtime.\n\nThe AI handles the heavy lifting:\n- Schedules your follow-ups automatically\n- Reminds you when it\'s time to reach out\n- Tracks everything so you never lose momentum\n\nWork 15 minutes here, 20 minutes there. The AI makes every minute count.\n\nSee how it fits your life: $_prospectReferralLink\n\nBuild a real business without sacrificing everything else.'),
      },
      'financial_risk_averse': {
        'title': context.l10n?.shareProspectFinancialRiskAverseTitle ?? 'Afraid of Losing Money',
        'description': context.l10n?.shareProspectFinancialRiskAverseDescription ?? 'Great for prospects worried about financial risk',
        'subject': context.l10n?.shareProspectFinancialRiskAverseSubject ?? 'See Results Before Investing Heavily',
        'message': (context.l10n?.shareProspectFinancialRiskAverseMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Worried about losing money? Smart.\n\nWith Team Build Pro, you can pre-build your $_bizOppName team and see real results before investing heavily.\n\nStart for free. Test the system. Track your actual progress in real-time. Only \$4.99/month once you\'re ready to invite your first prospects.\n\nNo expensive lead funnels. No complex systems. Just AI-powered tools that help you build real relationships and real momentum.\n\nSee proof first: $_prospectReferralLink\n\nYou deserve to see what\'s possible before risking anything.'),
      },
      'skeptical_realist': {
        'title': context.l10n?.shareProspectSkepticalRealistTitle ?? 'Show Me Proof',
        'description': context.l10n?.shareProspectSkepticalRealistDescription ?? 'Perfect for prospects burned by false promises',
        'subject': context.l10n?.shareProspectSkepticalRealistSubject ?? 'No Hype. Just Track Your Real Progress',
        'message': (context.l10n?.shareProspectSkepticalRealistMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Tired of empty promises and hype?\n\nTeam Build Pro shows you real metrics. No fluff. No exaggeration.\n\nYour dashboard tracks:\n- How many people you\'ve contacted\n- Who\'s responded and who\'s interested\n- Your actual momentum toward qualification (4 direct + 20 total)\n- Next steps the AI recommends\n\nYou\'ll know exactly where you stand before joining $_bizOppName. No surprises. No false hope. Just data.\n\nSee the transparency: $_prospectReferralLink\n\nFinally, a system that shows you the truth.'),
      },
    };
  }

  Map<String, Map<String, String>> _getProspectMessagesForL10n(AppLocalizations l10n) {
    return {
      'general_invitation': {
        'title': l10n.shareProspectGeneralInvitationTitle,
        'description': l10n.shareProspectGeneralInvitationDescription,
        'subject': l10n.shareProspectGeneralInvitationSubject,
        'message': l10n.shareProspectGeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'past_struggles': {
        'title': l10n.shareProspectPastStrugglesTitle,
        'description': l10n.shareProspectPastStrugglesDescription,
        'subject': l10n.shareProspectPastStrugglesSubject,
        'message': l10n.shareProspectPastStrugglesMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'not_salesperson': {
        'title': l10n.shareProspectNotSalespersonTitle,
        'description': l10n.shareProspectNotSalespersonDescription,
        'subject': l10n.shareProspectNotSalespersonSubject,
        'message': l10n.shareProspectNotSalespersonMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'hope_after_disappointment': {
        'title': l10n.shareProspectHopeAfterDisappointmentTitle,
        'description': l10n.shareProspectHopeAfterDisappointmentDescription,
        'subject': l10n.shareProspectHopeAfterDisappointmentSubject,
        'message': l10n.shareProspectHopeAfterDisappointmentMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'social_anxiety': {
        'title': l10n.shareProspectSocialAnxietyTitle,
        'description': l10n.shareProspectSocialAnxietyDescription,
        'subject': l10n.shareProspectSocialAnxietySubject,
        'message': l10n.shareProspectSocialAnxietyMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'time_constrained': {
        'title': l10n.shareProspectTimeConstrainedTitle,
        'description': l10n.shareProspectTimeConstrainedDescription,
        'subject': l10n.shareProspectTimeConstrainedSubject,
        'message': l10n.shareProspectTimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'financial_risk_averse': {
        'title': l10n.shareProspectFinancialRiskAverseTitle,
        'description': l10n.shareProspectFinancialRiskAverseDescription,
        'subject': l10n.shareProspectFinancialRiskAverseSubject,
        'message': l10n.shareProspectFinancialRiskAverseMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'skeptical_realist': {
        'title': l10n.shareProspectSkepticalRealistTitle,
        'description': l10n.shareProspectSkepticalRealistDescription,
        'subject': l10n.shareProspectSkepticalRealistSubject,
        'message': l10n.shareProspectSkepticalRealistMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
    };
  }

  Future<void> _shareProspectMessage(BuildContext context, String messageKey) async {
    if (kDebugMode) {
      debugPrint('🚀 SHARE_SCREEN: _shareProspectMessage called with key: $messageKey');
    }

    // Check if sharing is disabled via Remote Config
    if (!_isSharingEnabled()) {
      if (kDebugMode) {
        debugPrint('🚫 SHARE_SCREEN: Sharing disabled, showing demo dialog');
      }
      _showDemoModeDialog();
      return;
    }

    if (_prospectReferralLink != null) {
      final selectedLanguage = _selectedLanguages[messageKey];

      if (selectedLanguage != null && selectedLanguage != Localizations.localeOf(context).languageCode) {
        final l10n = await _getLocalizationForLanguage(selectedLanguage);
        final messages = _getProspectMessagesForL10n(l10n);
        final selectedMessage = messages[messageKey];

        if (selectedMessage != null) {
          final targetedLink = _buildTargetedLink(messageKey, false);
          final messageBody = selectedMessage['message']!.replaceAll(_prospectReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_SCREEN: Composing email (lang: $selectedLanguage) with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        }
      } else {
        final messages = _getProspectMessages(context);
        final selectedMessage = messages[messageKey];

        if (selectedMessage != null) {
          final targetedLink = _buildTargetedLink(messageKey, false);
          final messageBody = selectedMessage['message']!.replaceAll(_prospectReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_SCREEN: Composing email with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        } else {
          if (kDebugMode) {
            debugPrint('❌ SHARE_SCREEN: No message found for key: $messageKey');
          }
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint('❌ SHARE_SCREEN: _prospectReferralLink is null');
      }
    }
  }

  Map<String, Map<String, String>> _getPartnerMessages(BuildContext context) {
    return {
      'general_team_tool': {
        'title': context.l10n?.sharePartnerGeneralTeamToolTitle ?? 'General Invitation',
        'description': context.l10n?.sharePartnerGeneralTeamToolDescription ?? 'A versatile message for any partner situation',
        'subject': context.l10n?.sharePartnerGeneralTeamToolSubject ?? 'The AI Recruiting Advantage for Your Team',
        'message': (context.l10n?.sharePartnerGeneralTeamToolMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Want to give your $_bizOppName team a real competitive edge?\n\nTeam Build Pro has AI recruiting built in. It helps your entire team:\n\n- Draft personalized recruiting messages\n- Schedule follow-ups automatically\n- Track prospect engagement\n- Coach every conversation\n\nYour prospects pre-build their teams before joining. Your team duplicates the same AI tools. Everyone grows faster.\n\nCheck it out: $_partnerReferralLink\n\nThis is the AI advantage your team needs.'),
      },
      'warm_market_exhausted': {
        'title': context.l10n?.sharePartnerWarmMarketExhaustedTitle ?? 'Warm Market Exhausted',
        'description': context.l10n?.sharePartnerWarmMarketExhaustedDescription ?? 'For partners who\'ve tapped out friends and family',
        'subject': context.l10n?.sharePartnerWarmMarketExhaustedSubject ?? 'Give Your Team an AI Recruiting Companion',
        'message': (context.l10n?.sharePartnerWarmMarketExhaustedMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Tapped out your warm market? Tired of leads that ghost you?\n\nGive your $_bizOppName team an AI recruiting companion instead.\n\nTeam Build Pro drafts your team\'s recruiting messages, times their follow-ups, tracks prospect interest, and coaches every conversation.\n\nYour prospects pre-build their teams before joining - so they launch with momentum, not from zero.\n\nBest part? Your entire team gets the same AI advantage. True duplication at scale.\n\nSee how: $_partnerReferralLink\n\nStop chasing. Start coaching with AI.'),
      },
      'expensive_system_fatigue': {
        'title': context.l10n?.sharePartnerExpensiveSystemFatigueTitle ?? 'System Fatigue & Expense',
        'description': context.l10n?.sharePartnerExpensiveSystemFatigueDescription ?? 'For partners burned out on expensive recruiting methods',
        'subject': context.l10n?.sharePartnerExpensiveSystemFatigueSubject ?? 'The AI Recruiting System Inside Team Build Pro',
        'message': (context.l10n?.sharePartnerExpensiveSystemFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Sick of paying for leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro has AI recruiting built right in - no extra cost, no complex setup.\n\nIt drafts recruiting messages, schedules follow-ups, tracks engagement, and coaches your entire $_bizOppName team through every conversation.\n\nYour prospects pre-build their teams before joining. Your team duplicates the same AI tools. Everyone wins.\n\nOne simple system. Real results.\n\nCheck it out: $_partnerReferralLink\n\nStop overpaying. Start using AI.'),
      },
      'duplication_struggle': {
        'title': context.l10n?.sharePartnerDuplicationStruggleTitle ?? 'Duplication Challenges',
        'description': context.l10n?.sharePartnerDuplicationStruggleDescription ?? 'For leaders struggling to get their team to duplicate',
        'subject': context.l10n?.sharePartnerDuplicationStruggleSubject ?? 'AI-Powered Duplication for Your Entire Team',
        'message': (context.l10n?.sharePartnerDuplicationStruggleMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your team struggles to duplicate your recruiting success? Not anymore.\n\nTeam Build Pro gives every person on your $_bizOppName team the same AI recruiting coach.\n\nIt drafts their messages. Times their follow-ups. Tracks their prospects. Coaches their next steps.\n\nNew recruit or veteran leader - everyone gets the same AI advantage. True system duplication.\n\nYour prospects pre-build teams before joining. Your team grows faster using identical AI tools.\n\nSee it work: $_partnerReferralLink\n\nFinally, a system your entire team can duplicate.'),
      },
      'retention_crisis': {
        'title': context.l10n?.sharePartnerRetentionCrisisTitle ?? 'Team Dropout Problem',
        'description': context.l10n?.sharePartnerRetentionCrisisDescription ?? 'For leaders frustrated by team members quitting early',
        'subject': context.l10n?.sharePartnerRetentionCrisisSubject ?? 'Stop Losing Your Team in the First Year',
        'message': (context.l10n?.sharePartnerRetentionCrisisMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Watching your $_bizOppName team quit before they succeed?\n\n75% drop out in their first year. Usually because they feel lost, unsupported, or overwhelmed.\n\nTeam Build Pro changes that. Every person on your team gets an AI Coach that:\n- Guides them through every recruiting conversation\n- Tracks their progress and celebrates wins\n- Reminds them what to do next\n- Keeps momentum going when motivation dips\n\nThey\'re never alone. They always know their next step. They stay engaged longer.\n\nGive your team the support they need: $_partnerReferralLink\n\nStop watching them quit. Start watching them succeed.'),
      },
      'skill_gap_team': {
        'title': context.l10n?.sharePartnerSkillGapTeamTitle ?? 'Non-Sales Team Members',
        'description': context.l10n?.sharePartnerSkillGapTeamDescription ?? 'Perfect for teams where most people lack sales experience',
        'subject': context.l10n?.sharePartnerSkillGapTeamSubject ?? 'Your Non-Sales Team Can Win with AI',
        'message': (context.l10n?.sharePartnerSkillGapTeamMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Most of your $_bizOppName team aren\'t natural salespeople. That\'s been the problem.\n\nTeam Build Pro solves it. The AI Coach turns non-sales people into confident recruiters by:\n- Drafting their recruiting messages for them\n- Suggesting exactly who to contact next\n- Coaching them through every conversation\n- Tracking progress so they see real momentum\n\nYour introverts, your part-timers, your "I\'m not good at sales" people - they all get the same AI advantage.\n\nFinally, everyone can duplicate your success.\n\nSee how: $_partnerReferralLink\n\nYou don\'t need a team of salespeople. You need a team with AI.'),
      },
      'recruitment_fatigue': {
        'title': context.l10n?.sharePartnerRecruitmentFatigueTitle ?? 'Tired of Constant Recruiting',
        'description': context.l10n?.sharePartnerRecruitmentFatigueDescription ?? 'For partners exhausted from the endless recruiting cycle',
        'subject': context.l10n?.sharePartnerRecruitmentFatigueSubject ?? 'Automate the Grind. Keep the Growth.',
        'message': (context.l10n?.sharePartnerRecruitmentFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Burned out from constant recruiting? The endless follow-ups? The manual tracking?\n\nTeam Build Pro\'s AI handles the grind so you don\'t have to.\n\nFor your entire $_bizOppName team, the AI:\n- Schedules follow-ups automatically\n- Tracks every prospect and their status\n- Reminds your team when to reach out\n- Coaches them on what to say next\n\nYou stay focused on high-value activities. Your team stays productive without burning out.\n\nThe AI never gets tired. Your momentum never stops.\n\nTry it: $_partnerReferralLink\n\nSustainable growth without the burnout.'),
      },
      'availability_gap': {
        'title': context.l10n?.sharePartnerAvailabilityGapTitle ?? 'Can\'t Be There 24/7',
        'description': context.l10n?.sharePartnerAvailabilityGapDescription ?? 'Ideal for leaders who can\'t be constantly available to their team',
        'subject': context.l10n?.sharePartnerAvailabilityGapSubject ?? 'Your Team Grows Even When You\'re Not There',
        'message': (context.l10n?.sharePartnerAvailabilityGapMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team needs you. But you can\'t be available 24/7.\n\nTeam Build Pro gives your team an AI Coach that\'s always on. While you sleep, work your day job, or spend time with family, the AI:\n- Guides your team through recruiting conversations\n- Answers their "what do I do next?" questions\n- Tracks their progress and keeps them motivated\n- Ensures nothing falls through the cracks\n\n'
            'Your team gets the support they need, exactly when they need it.\n\n'
            'You stay focused on leadership. The AI handles daily coaching.\n\n'
            'See it work: $_partnerReferralLink\n\n'
            'Finally, a team that grows without needing you every minute.'),
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
    };
  }

  Future<AppLocalizations> _getLocalizationForLanguage(String languageCode) async {
    final locale = Locale(languageCode);
    return await AppLocalizations.delegate.load(locale);
  }

  Future<void> _sharePartnerMessage(BuildContext context, String messageKey) async {
    if (kDebugMode) {
      debugPrint('🚀 SHARE_SCREEN: _sharePartnerMessage called with key: $messageKey');
    }

    // Check if sharing is disabled via Remote Config
    if (!_isSharingEnabled()) {
      if (kDebugMode) {
        debugPrint('🚫 SHARE_SCREEN: Sharing disabled, showing demo dialog');
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
          final targetedLink = _buildTargetedLink(messageKey, true);
          final messageBody = selectedMessage['message']!.replaceAll(_partnerReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_SCREEN: Composing email (lang: $selectedLanguage) with targeted link: $targetedLink');
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
          final targetedLink = _buildTargetedLink(messageKey, true);
          final messageBody = selectedMessage['message']!.replaceAll(_partnerReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_SCREEN: Composing email with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        } else {
          if (kDebugMode) {
            debugPrint('❌ SHARE_SCREEN: No message found for key: $messageKey');
          }
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint('❌ SHARE_SCREEN: _partnerReferralLink is null');
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
              Text(context.l10n?.shareLinkCopiedMessage ?? 'Referral link copied! 🎉'),
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
    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.shareTitle ?? 'Share', appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 32),
                      _buildSharingStrategies(),
                      const SizedBox(height: 32),
                      _buildProTips(),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: [
          const Icon(Icons.share_rounded, size: 40, color: Colors.white),
          const SizedBox(height: 16),
          Text(
            context.l10n?.shareHeading ?? 'Powerful Referral System',
            style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            context.l10n?.shareSubheading ?? 'Share your referral links to pre-build a new team with recruiting prospects or expand your existing team.',
            style: TextStyle(
                fontSize: 16, color: Colors.white.withValues(alpha: 0.9)),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildSharingStrategies() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n?.shareStrategiesTitle ?? 'Proven Growth Strategies',
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        _buildProspectStrategyCard(),
        const SizedBox(height: 16),
        _buildPartnerStrategyCard(),
      ],
    );
  }

  Widget _buildProspectStrategyCard() {
    final buttonColor = AppColors.growthPrimary;
    final icon = Icons.connect_without_contact;
    
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
                      context.l10n?.shareProspectTitle ?? 'New Recruiting Prospects',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      context.l10n?.shareProspectSubtitle ?? 'Invite recruiting prospects to get a head start.',
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
            context.l10n?.shareProspectDescription(_bizOppName) ?? 'Invite recruiting prospects to pre-build their $_bizOppName team with this app. They can create powerful momentum before officially joining $_bizOppName, ensuring success from day one.',
            style: TextStyle(
                fontSize: 14, color: AppColors.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 20),
          
          // Message Selection Toggle
          GestureDetector(
            onTap: () {
              setState(() {
                _showProspectMessages = !_showProspectMessages;
              });
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: buttonColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: buttonColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.message_rounded, color: buttonColor, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      context.l10n?.shareSelectMessageLabel ?? 'Select Message To Send',
                      style: TextStyle(
                        color: buttonColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(
                    _showProspectMessages ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: buttonColor,
                  ),
                ],
              ),
            ),
          ),
          
          // Expandable Message Options
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            height: _showProspectMessages ? null : 0,
            child: _showProspectMessages
                ? Container(
                    margin: const EdgeInsets.only(top: 12),
                    child: Column(
                      children: [
                        ..._getProspectMessages(context).entries.map((entry) {
                          return _buildMessageOption(
                            entry.key,
                            entry.value['title']!,
                            entry.value['description']!,
                            buttonColor,
                          );
                        }),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
          
        ],
      ),
    );
  }

  Widget _buildMessageOption(String messageKey, String title, String description, Color buttonColor, {bool isPartner = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
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
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 12,
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
              _buildLanguageButton(messageKey, 'en', '🇺🇸', 'English'),
              _buildLanguageButton(messageKey, 'es', '🇪🇸', 'Español'),
              _buildLanguageButton(messageKey, 'pt', '🇵🇹', 'Português'),
              _buildLanguageButton(messageKey, 'de', '🇩🇪', 'Deutsch'),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => isPartner ? _sharePartnerMessage(context, messageKey) : _shareProspectMessage(context, messageKey),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: buttonColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.share, size: 16),
                  label: Text(context.l10n?.shareButtonShare ?? 'Share', style: const TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    final targetedLink = _buildTargetedLink(messageKey, isPartner);
                    _copyLink(targetedLink);
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: buttonColor,
                    side: BorderSide(color: buttonColor),
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.copy_rounded, size: 16),
                  label: Text(context.l10n?.shareButtonCopyLink ?? 'Copy Link', style: const TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageButton(String messageKey, String languageCode, String flag, String label) {
    final isSelected = _selectedLanguages[messageKey] == languageCode;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedLanguages[messageKey] = languageCode;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? Colors.blue.shade50 : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? Colors.blue : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(flag, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                color: isSelected ? Colors.blue : Colors.grey.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPartnerStrategyCard() {
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
                      context.l10n?.sharePartnerTitle ?? 'Current Business Partners',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      (context.l10n?.sharePartnerSubtitle ?? 'Great for your existing $_bizOppName team').toString(),
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
          const SizedBox(height: 20),
          
          // Message Selection Toggle
          GestureDetector(
            onTap: () {
              setState(() {
                _showPartnerMessages = !_showPartnerMessages;
              });
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: buttonColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: buttonColor.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(Icons.message_rounded, color: buttonColor, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      context.l10n?.shareSelectMessageLabel ?? 'Select Message To Send',
                      style: TextStyle(
                        color: buttonColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(
                    _showPartnerMessages ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: buttonColor,
                  ),
                ],
              ),
            ),
          ),
          
          // Expandable Message Options
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            height: _showPartnerMessages ? null : 0,
            child: _showPartnerMessages
                ? Container(
                    margin: const EdgeInsets.only(top: 12),
                    child: Column(
                      children: [
                        ..._getPartnerMessages(context).entries.map((entry) {
                          return _buildMessageOption(
                            entry.key,
                            entry.value['title']!,
                            entry.value['description']!,
                            buttonColor,
                            isPartner: true,
                          );
                        }),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
          
        ],
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
              Text(
                context.l10n?.shareProTipsTitle ?? 'Pro Tips for Success',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildTip(context.l10n?.shareProTip1 ?? '💬 Personalize your message when sharing'),
          _buildTip(context.l10n?.shareProTip2 ?? '📱 Share consistently across all social platforms'),
          _buildTip(context.l10n?.shareProTip3 ?? '🤝 Follow up with prospects who show interest'),
          _buildTip(context.l10n?.shareProTip4 ?? '📈 Track your results and adjust your approach'),
          if (_currentUser?.role == 'admin')
            _buildTip(context.l10n?.shareProTip5 ?? '🎯 Use both strategies for maximum growth potential'),
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
