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

  // Build targeted referral link with language-specific domain
  String _buildTargetedLink(String messageKey, bool isPartner) {
    final selectedLanguage = _selectedLanguages[messageKey];

    // Determine base domain based on selected language
    String baseDomain = 'https://teambuildpro.com';
    if (selectedLanguage == 'es') {
      baseDomain = 'https://es.teambuildpro.com';
    } else if (selectedLanguage == 'pt') {
      baseDomain = 'https://pt.teambuildpro.com';
    }

    final referralParam = isPartner ? 'ref' : 'new';
    final referralCode = _currentUser!.referralCode;

    return '$baseDomain/?$referralParam=$referralCode';
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
        'subject': context.l10n?.shareProspectGeneralInvitationSubject ?? 'Build Your Team Before Joining $_bizOppName',
        'message': (context.l10n?.shareProspectGeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Thinking about $_bizOppName? Here\'s a smarter way to start.\n\nTeam Build Pro lets you build your team BEFORE you officially join. An AI Coach helps you:\n\n- Draft personalized recruiting messages\n- Schedule follow-ups automatically\n- Track who\'s interested and ready\n- Build real momentum risk-free\n\nSo when you do join $_bizOppName, you\'re not starting from zero. You launch with people already waiting for you.\n\nSee how it works: $_prospectReferralLink\n\nDay 1 isn\'t a cold start. It\'s a running start.'),
      },
      'past_struggles': {
        'title': context.l10n?.shareProspectPastStrugglesTitle ?? 'Addressing Past Struggles',
        'description': context.l10n?.shareProspectPastStrugglesDescription ?? 'Perfect for prospects who have tried before and struggled',
        'subject': context.l10n?.shareProspectPastStrugglesSubject ?? 'Try $_bizOppName Differently This Time',
        'message': (context.l10n?.shareProspectPastStrugglesMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Been burned before in direct sales? Past attempts at $_bizOppName or similar businesses left you stuck at zero?\n\nThis time, start smarter.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join. The AI Coach drafts your messages, times your follow-ups, and tracks who\'s interested.\n\nSo you don\'t start from scratch. You launch with real people already waiting for you.\n\nThe AI walks you through every step. You won\'t be alone.\n\nSee how it works: $_prospectReferralLink\n\nYou deserve a real shot this time.'),
      },
      'not_salesperson': {
        'title': context.l10n?.shareProspectNotSalespersonTitle ?? 'For Non-Sales Minded',
        'description': context.l10n?.shareProspectNotSalespersonDescription ?? 'Great for people who don\'t see themselves as "salespeople"',
        'subject': context.l10n?.shareProspectNotSalespersonSubject ?? 'Build Your $_bizOppName Team Without Being "Salesy"',
        'message': (context.l10n?.shareProspectNotSalespersonMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Not a "natural salesperson"? Considering $_bizOppName but worried about the recruiting part?\n\nYou don\'t need a sales personality. You just need smart AI tools.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you join - with an AI Coach that:\n\n- Drafts your recruiting messages for you\n- Schedules follow-ups automatically\n- Tracks who\'s interested\n- Coaches every conversation\n\nIt\'s like having a recruiting assistant who never sleeps. You focus on genuine relationships. The AI handles the awkward sales stuff.\n\nStart building before you even join: $_prospectReferralLink'),
      },
      'hope_after_disappointment': {
        'title': context.l10n?.shareProspectHopeAfterDisappointmentTitle ?? 'Hope After Disappointment',
        'description': context.l10n?.shareProspectHopeAfterDisappointmentDescription ?? 'Ideal for prospects burned by previous opportunities',
        'subject': context.l10n?.shareProspectHopeAfterDisappointmentSubject ?? 'Try $_bizOppName With Real Support This Time',
        'message': (context.l10n?.shareProspectHopeAfterDisappointmentMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Been burned before? Promised the world by $_bizOppName or other opportunities, then left starting from zero?\n\nThis time is different.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join. The AI Coach drafts your recruiting messages, times your follow-ups, tracks who\'s interested, and coaches every step.\n\nYou gain real momentum before Day 1. No hype. No empty promises. Just AI-powered tools that actually work.\n\nSee how: $_prospectReferralLink\n\nYou deserve a system that sets you up to win.'),
      },
      'social_anxiety': {
        'title': context.l10n?.shareProspectSocialAnxietyTitle ?? 'Avoiding Awkward Conversations',
        'description': context.l10n?.shareProspectSocialAnxietyDescription ?? 'Perfect for introverts or those uncomfortable with face-to-face recruiting',
        'subject': context.l10n?.shareProspectSocialAnxietySubject ?? 'Build Your $_bizOppName Team Without Awkward Conversations',
        'message': (context.l10n?.shareProspectSocialAnxietyMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Considering $_bizOppName but uncomfortable with awkward conversations? You\'re not alone.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - online, at your own pace, where it feels comfortable.\n\nThe AI Coach:\n- Drafts recruiting messages for you\n- Suggests who to contact next\n- Tracks responses and engagement\n- Guides every conversation step-by-step\n\nNo cold calls. No awkward face-to-face pitches. Just genuine online connections guided by AI.\n\nYou build real momentum risk-free. So when you do join $_bizOppName, you\'re launching with people already waiting for you.\n\nStart building on your terms: $_prospectReferralLink'),
      },
      'time_constrained': {
        'title': context.l10n?.shareProspectTimeConstrainedTitle ?? 'For Busy Professionals',
        'description': context.l10n?.shareProspectTimeConstrainedDescription ?? 'Ideal for prospects juggling job, family, and other commitments',
        'subject': context.l10n?.shareProspectTimeConstrainedSubject ?? 'Build Your $_bizOppName Team in the Gaps',
        'message': (context.l10n?.shareProspectTimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Interested in $_bizOppName but can\'t dedicate full-time hours? You don\'t need to.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - in the gaps of your busy life.\n\nMorning coffee? Lunch break? Evening downtime? The AI Coach works around your schedule:\n- Drafts recruiting messages for you\n- Schedules follow-ups automatically\n- Reminds you when it\'s time to reach out\n- Tracks everything so momentum never stops\n\nWork 15 minutes here, 20 minutes there. The AI makes every minute count.\n\nSo when you do join $_bizOppName, you\'re launching with people already waiting - not starting from zero.\n\nSee how it fits your life: $_prospectReferralLink'),
      },
      'financial_risk_averse': {
        'title': context.l10n?.shareProspectFinancialRiskAverseTitle ?? 'Afraid of Losing Money',
        'description': context.l10n?.shareProspectFinancialRiskAverseDescription ?? 'Great for prospects worried about financial risk',
        'subject': context.l10n?.shareProspectFinancialRiskAverseSubject ?? 'See Results Before Investing in $_bizOppName',
        'message': (context.l10n?.shareProspectFinancialRiskAverseMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Considering $_bizOppName but worried about losing money? Smart.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - so you see real results before investing heavily.\n\nStart for free. Test the AI recruiting system. Track your actual progress in real-time:\n- See who\'s interested in joining your team\n- Watch your momentum build\n- Prove the system works for you\n\nOnly \$4.99/month once you\'re ready to invite prospects. No expensive lead funnels. No complex systems.\n\nWhen you finally join $_bizOppName, you\'re launching with people already waiting - not risking everything on zero momentum.\n\nSee proof first: $_prospectReferralLink'),
      },
      'skeptical_realist': {
        'title': context.l10n?.shareProspectSkepticalRealistTitle ?? 'Show Me Proof',
        'description': context.l10n?.shareProspectSkepticalRealistDescription ?? 'Perfect for prospects burned by false promises',
        'subject': context.l10n?.shareProspectSkepticalRealistSubject ?? 'No Hype. Track Your Real $_bizOppName Progress',
        'message': (context.l10n?.shareProspectSkepticalRealistMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Considering $_bizOppName but tired of empty promises and hype?\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - and shows you real metrics every step of the way.\n\nNo fluff. No exaggeration. Your dashboard tracks:\n- How many people you\'ve contacted\n- Who\'s responded and who\'s interested\n- Your actual momentum toward qualification (4 direct + 20 total)\n- Next steps the AI Coach recommends\n\nYou see exactly where you stand before joining $_bizOppName. No surprises. No false hope. Just data.\n\nWhen you finally do join, you\'re launching with proof - not blind faith.\n\nSee the transparency: $_prospectReferralLink'),
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
        'subject': context.l10n?.sharePartnerGeneralTeamToolSubject ?? 'The AI Recruiting Advantage for Your $_bizOppName Team',
        'message': (context.l10n?.sharePartnerGeneralTeamToolMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team deserves a real competitive edge.\n\nTeam Build Pro gives your entire $_bizOppName organization AI recruiting tools that actually duplicate:\n\n- Draft personalized recruiting messages\n- Schedule follow-ups automatically\n- Track prospect engagement in real-time\n- Coach every conversation step-by-step\n\nYour team\'s prospects pre-build their teams BEFORE joining. Your partners duplicate the exact same AI tools. Everyone in your $_bizOppName organization grows faster.\n\nGive your team the AI advantage: $_partnerReferralLink\n\nThis is how modern leaders scale their teams.'),
      },
      'warm_market_exhausted': {
        'title': context.l10n?.sharePartnerWarmMarketExhaustedTitle ?? 'Warm Market Exhausted',
        'description': context.l10n?.sharePartnerWarmMarketExhaustedDescription ?? 'For partners who\'ve tapped out friends and family',
        'subject': context.l10n?.sharePartnerWarmMarketExhaustedSubject ?? 'Give Your $_bizOppName Team an AI Recruiting Companion',
        'message': (context.l10n?.sharePartnerWarmMarketExhaustedMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team tapped out their warm market? Tired of watching them chase leads that ghost them?\n\nGive your entire $_bizOppName organization an AI recruiting companion.\n\nTeam Build Pro works for every person on your team:\n- Drafts their recruiting messages\n- Times their follow-ups perfectly\n- Tracks prospect interest automatically\n- Coaches every conversation\n\nTheir prospects pre-build teams BEFORE joining - launching with momentum, not from zero.\n\nYour entire $_bizOppName team gets the same AI advantage. True duplication at scale.\n\nEmpower your team: $_partnerReferralLink\n\nStop watching them chase. Start watching them succeed.'),
      },
      'expensive_system_fatigue': {
        'title': context.l10n?.sharePartnerExpensiveSystemFatigueTitle ?? 'System Fatigue & Expense',
        'description': context.l10n?.sharePartnerExpensiveSystemFatigueDescription ?? 'For partners burned out on expensive recruiting methods',
        'subject': context.l10n?.sharePartnerExpensiveSystemFatigueSubject ?? 'Stop Overpaying. Empower Your $_bizOppName Team with AI',
        'message': (context.l10n?.sharePartnerExpensiveSystemFatigueMessage(_bizOppName, _partnerReferralLink ?? '') ??
            'Your $_bizOppName team burning money on leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro gives your entire $_bizOppName organization AI recruiting tools - built right in. No extra costs. No complex setup.\n\nEvery person on your team gets:\n- AI-drafted recruiting messages\n- Automated follow-up scheduling\n- Real-time engagement tracking\n- Step-by-step conversation coaching\n\nTheir prospects pre-build teams BEFORE joining. Your $_bizOppName team duplicates the exact same AI tools. Everyone wins.\n\nOne simple system. Real results.\n\nEmpower your team: $_partnerReferralLink\n\nStop overpaying. Start scaling smart.'),
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
            'Your $_bizOppName team burned out from constant recruiting? The endless follow-ups? The manual tracking?\n\nTeam Build Pro\'s AI handles the grind for your entire $_bizOppName organization.\n\nFor every person on your team, the AI:\n- Schedules follow-ups automatically\n- Tracks every prospect and their status\n- Reminds them when to reach out\n- Coaches them on what to say next\n\nYou stay focused on leadership. Your $_bizOppName team stays productive without burning out.\n\nThe AI never gets tired. Your team\'s momentum never stops.\n\nEmpower sustainable growth: $_partnerReferralLink\n\nGrowth without the burnout. Finally.'),
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
      appBar: AppScreenBar(title: context.l10n?.shareTitle ?? 'Grow', appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
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

 /*  Widget _buildHeader() {
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
  } */

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
              Expanded(
                child: Text(
                  context.l10n?.shareProTipsTitle ?? 'Pro Tips for Success',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
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
