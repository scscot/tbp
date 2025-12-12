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

// Persona 2: Sponsor/Recruiter screen (user HAS joined bizOppName)
// biz_opp_ref_url != NULL - mentor/leader recruiting tone
class ShareProspectScreen1 extends StatefulWidget {
  final String appId;

  const ShareProspectScreen1({
    super.key,
    required this.appId,
  });

  @override
  State<ShareProspectScreen1> createState() => _ShareProspectScreen1State();
}

class _ShareProspectScreen1State extends State<ShareProspectScreen1>
    with TickerProviderStateMixin {
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _prospectReferralLink;
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
      _prospectReferralLink =
          'https://teambuildpro.com/?new=${_currentUser!.referralCode}';
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

    return '$baseDomain/?new=$referralCode';
  }

  Future<void> _composeEmail({
    required String subject,
    required String body,
  }) async {
    final text = '$subject\n\n$body';

    if (kDebugMode) {
      debugPrint('📧 SHARE_PROSPECT_SCREEN: _composeEmail → Share.share()');
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
        debugPrint('✅ SHARE_PROSPECT_SCREEN: Share.share() completed successfully');
      }
    } catch (e, stack) {
      if (kDebugMode) {
        debugPrint('❌ SHARE_PROSPECT_SCREEN: Share.share() error: $e');
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
        debugPrint('🔧 SHARE_PROSPECT_SCREEN: Demo mode check - Android: ${Platform.isAndroid ? isDemoMode : 'N/A'}, iOS: ${Platform.isIOS ? isDemoMode : 'N/A'}');
      }

      // If in demo mode, sharing is disabled
      if (isDemoMode) {
        if (kDebugMode) {
          debugPrint('🚫 SHARE_PROSPECT_SCREEN: Sharing disabled due to demo mode');
        }
        return false;
      }

      // Production mode - sharing is always enabled
      if (kDebugMode) {
        debugPrint('✅ SHARE_PROSPECT_SCREEN: Sharing enabled');
      }
      return true;
    } catch (e) {
      // Default to enabled if Remote Config fails
      if (kDebugMode) {
        debugPrint('⚠️ SHARE_PROSPECT_SCREEN: Remote Config error, defaulting to enabled: $e');
      }
      return true;
    }
  }

  // Persona 2 Messages: Sponsor/Recruiter (user HAS joined bizOppName)
  // biz_opp_ref_url != NULL - mentor/leader recruiting tone
  Map<String, Map<String, String>> _getProspectMessages(BuildContext context) {
    return {
      'general_invitation': {
        'title': context.l10n?.shareProspect2GeneralInvitationTitle ?? 'General Invitation',
        'description': context.l10n?.shareProspect2GeneralInvitationDescription ?? 'A versatile message for any prospect situation',
        'subject': context.l10n?.shareProspect2GeneralInvitationSubject(_bizOppName) ?? 'Build Your $_bizOppName Team Before Day 1',
        'message': (context.l10n?.shareProspect2GeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Thinking about joining $_bizOppName? I want to share something that can give you a real advantage.\n\nTeam Build Pro lets you build your team BEFORE you officially join. So when you start with me, you\'re not starting from zero - you launch with people already waiting.\n\nThe app includes:\n- 16 pre-written recruiting messages ready to share\n- 24/7 AI Coach for recruiting questions\n- Real-time tracking of who\'s interested\n\nI\'ve seen what happens when new team members start cold. This changes that.\n\nCheck it out: $_prospectReferralLink\n\nWhen you\'re ready to join my $_bizOppName team, you\'ll hit the ground running.'),
      },
      'past_struggles': {
        'title': context.l10n?.shareProspect2PastStrugglesTitle ?? 'Addressing Past Struggles',
        'description': context.l10n?.shareProspect2PastStrugglesDescription ?? 'Perfect for prospects who have tried before and struggled',
        'subject': context.l10n?.shareProspect2PastStrugglesSubject ?? 'This Time Will Be Different - Here\'s Why',
        'message': (context.l10n?.shareProspect2PastStrugglesMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'I know you\'ve struggled before with direct sales. Past attempts at $_bizOppName or similar opportunities left you starting from zero.\n\nThat\'s exactly why I want you on my team - and why I\'m sharing Team Build Pro with you.\n\nIt lets you build your $_bizOppName team BEFORE you officially join. With 16 pre-written messages and an AI Coach walking you through every step, you won\'t be alone this time.\n\nI\'ll be your sponsor AND you\'ll have AI support 24/7.\n\nSee how it works: $_prospectReferralLink\n\nYou deserve a real shot. Let me help you get it right this time.'),
      },
      'not_salesperson': {
        'title': context.l10n?.shareProspect2NotSalespersonTitle ?? 'For Non-Sales Minded',
        'description': context.l10n?.shareProspect2NotSalespersonDescription ?? 'Great for people who don\'t see themselves as "salespeople"',
        'subject': context.l10n?.shareProspect2NotSalespersonSubject(_bizOppName) ?? 'Join My $_bizOppName Team - No Sales Personality Required',
        'message': (context.l10n?.shareProspect2NotSalespersonMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Not a natural salesperson? That\'s okay - you don\'t need to be to succeed on my team.\n\nTeam Build Pro gives you 16 pre-written recruiting messages and an AI Coach. You focus on genuine relationships. The AI handles the "sales stuff."\n\nAnd here\'s the best part: you can build your team BEFORE joining $_bizOppName. Build confidence with the tools first.\n\nI\'ll guide you as your sponsor, and the AI coaches you 24/7.\n\nStart building: $_prospectReferralLink\n\nIt\'s like having a recruiting assistant who never sleeps. Join my team and let the tools work for you.'),
      },
      'hope_after_disappointment': {
        'title': context.l10n?.shareProspect2HopeAfterDisappointmentTitle ?? 'Hope After Disappointment',
        'description': context.l10n?.shareProspect2HopeAfterDisappointmentDescription ?? 'Ideal for prospects burned by previous opportunities',
        'subject': context.l10n?.shareProspect2HopeAfterDisappointmentSubject(_bizOppName) ?? 'Join My $_bizOppName Team With Real Support This Time',
        'message': (context.l10n?.shareProspect2HopeAfterDisappointmentMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'I know you\'ve been burned before. Empty promises, zero support, starting from scratch.\n\nThat\'s not how I run my team.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join. Real momentum before Day 1. No hype - just AI-powered tools that actually work.\n\nI\'ll be your sponsor, the AI Coach guides you 24/7, and you\'ll have pre-written messages ready to go.\n\nSee how: $_prospectReferralLink\n\nYou deserve a system that sets you up to win. I want you on my team.'),
      },
      'social_anxiety': {
        'title': context.l10n?.shareProspect2SocialAnxietyTitle ?? 'Avoiding Awkward Conversations',
        'description': context.l10n?.shareProspect2SocialAnxietyDescription ?? 'Perfect for introverts or those uncomfortable with face-to-face recruiting',
        'subject': context.l10n?.shareProspect2SocialAnxietySubject(_bizOppName) ?? 'Build Your $_bizOppName Team Without Awkward Conversations',
        'message': (context.l10n?.shareProspect2SocialAnxietyMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Uncomfortable with awkward sales conversations? I get it. That\'s why I use Team Build Pro with my team.\n\nIt lets you build your $_bizOppName network online, at your own pace:\n- 16 pre-written messages - no "what do I say?"\n- Build prospects at your own pace\n- 24/7 AI guidance when you need it\n\nNo cold calls. No face-to-face pitches required. And you can start building BEFORE you join.\n\nStart on your terms: $_prospectReferralLink\n\nWhen you join my team, you\'ll have real momentum from people you recruited comfortably online.'),
      },
      'time_constrained': {
        'title': context.l10n?.shareProspect2TimeConstrainedTitle ?? 'For Busy Professionals',
        'description': context.l10n?.shareProspect2TimeConstrainedDescription ?? 'Ideal for prospects juggling job, family, and other commitments',
        'subject': context.l10n?.shareProspect2TimeConstrainedSubject(_bizOppName) ?? 'Build Your $_bizOppName Team in the Gaps of Your Life',
        'message': (context.l10n?.shareProspect2TimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'I know you\'re busy. That\'s actually why $_bizOppName could work for you - and why I want you on my team.\n\nTeam Build Pro lets you build your team BEFORE you officially join - in small pockets of time. Morning coffee. Lunch break. Evening downtime.\n\nThe AI Coach and 16 pre-written messages make every minute count:\n- Track all prospects in one place\n- Get AI guidance whenever you have a few minutes\n- See your momentum grow\n\nSee how it fits your life: $_prospectReferralLink\n\nWhen you\'re ready to join my team, you won\'t be starting from zero. You\'ll launch with people already waiting.'),
      },
      'financial_risk_averse': {
        'title': context.l10n?.shareProspect2FinancialRiskAverseTitle ?? 'Afraid of Losing Money',
        'description': context.l10n?.shareProspect2FinancialRiskAverseDescription ?? 'Great for prospects worried about financial risk',
        'subject': context.l10n?.shareProspect2FinancialRiskAverseSubject(_bizOppName) ?? 'See Results Before Investing in $_bizOppName',
        'message': (context.l10n?.shareProspect2FinancialRiskAverseMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Worried about losing money? Smart. That\'s why I recommend Team Build Pro to everyone joining my team.\n\nIt lets you build your $_bizOppName team BEFORE you officially invest - so you see real results first.\n\nTrack your actual progress:\n- Who\'s interested in joining\n- Your momentum building\n- Proof the system works for you\n\nOnly \$6.99/month after a free trial. Way less risk than jumping in blind.\n\nSee proof first: $_prospectReferralLink\n\nWhen you finally join my $_bizOppName team, you\'re launching with people already waiting - not risking everything on hope.'),
      },
      'skeptical_realist': {
        'title': context.l10n?.shareProspect2SkepticalRealistTitle ?? 'Show Me Proof',
        'description': context.l10n?.shareProspect2SkepticalRealistDescription ?? 'Perfect for prospects burned by false promises',
        'subject': context.l10n?.shareProspect2SkepticalRealistSubject(_bizOppName) ?? 'No Hype. Real Metrics. Join My $_bizOppName Team.',
        'message': (context.l10n?.shareProspect2SkepticalRealistMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Tired of empty promises? Me too. That\'s why I run my $_bizOppName team differently.\n\nTeam Build Pro shows you real metrics every step:\n- How many people you\'ve contacted\n- Who\'s responded and interested\n- Your actual progress toward qualification\n- Next steps the AI recommends\n\nNo fluff. No exaggeration. Just data. And you can do all this BEFORE joining.\n\nSee the transparency: $_prospectReferralLink\n\nWhen you join my team, you\'ll launch with proof - not blind faith. That\'s the only way I do business.'),
      },
    };
  }

  // Uses Persona 2 localization keys (shareProspect2*)
  Map<String, Map<String, String>> _getProspectMessagesForL10n(AppLocalizations l10n) {
    return {
      'general_invitation': {
        'title': l10n.shareProspect2GeneralInvitationTitle,
        'description': l10n.shareProspect2GeneralInvitationDescription,
        'subject': l10n.shareProspect2GeneralInvitationSubject(_bizOppName),
        'message': l10n.shareProspect2GeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'past_struggles': {
        'title': l10n.shareProspect2PastStrugglesTitle,
        'description': l10n.shareProspect2PastStrugglesDescription,
        'subject': l10n.shareProspect2PastStrugglesSubject,
        'message': l10n.shareProspect2PastStrugglesMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'not_salesperson': {
        'title': l10n.shareProspect2NotSalespersonTitle,
        'description': l10n.shareProspect2NotSalespersonDescription,
        'subject': l10n.shareProspect2NotSalespersonSubject(_bizOppName),
        'message': l10n.shareProspect2NotSalespersonMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'hope_after_disappointment': {
        'title': l10n.shareProspect2HopeAfterDisappointmentTitle,
        'description': l10n.shareProspect2HopeAfterDisappointmentDescription,
        'subject': l10n.shareProspect2HopeAfterDisappointmentSubject(_bizOppName),
        'message': l10n.shareProspect2HopeAfterDisappointmentMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'social_anxiety': {
        'title': l10n.shareProspect2SocialAnxietyTitle,
        'description': l10n.shareProspect2SocialAnxietyDescription,
        'subject': l10n.shareProspect2SocialAnxietySubject(_bizOppName),
        'message': l10n.shareProspect2SocialAnxietyMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'time_constrained': {
        'title': l10n.shareProspect2TimeConstrainedTitle,
        'description': l10n.shareProspect2TimeConstrainedDescription,
        'subject': l10n.shareProspect2TimeConstrainedSubject(_bizOppName),
        'message': l10n.shareProspect2TimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'financial_risk_averse': {
        'title': l10n.shareProspect2FinancialRiskAverseTitle,
        'description': l10n.shareProspect2FinancialRiskAverseDescription,
        'subject': l10n.shareProspect2FinancialRiskAverseSubject(_bizOppName),
        'message': l10n.shareProspect2FinancialRiskAverseMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
      'skeptical_realist': {
        'title': l10n.shareProspect2SkepticalRealistTitle,
        'description': l10n.shareProspect2SkepticalRealistDescription,
        'subject': l10n.shareProspect2SkepticalRealistSubject(_bizOppName),
        'message': l10n.shareProspect2SkepticalRealistMessage(_bizOppName, _prospectReferralLink ?? ''),
      },
    };
  }

  Future<AppLocalizations> _getLocalizationForLanguage(String languageCode) async {
    final locale = Locale(languageCode);
    return await AppLocalizations.delegate.load(locale);
  }

  Future<void> _shareProspectMessage(BuildContext context, String messageKey) async {
    if (kDebugMode) {
      debugPrint('🚀 SHARE_PROSPECT_SCREEN: _shareProspectMessage called with key: $messageKey');
    }

    // Check if sharing is disabled via Remote Config
    if (!_isSharingEnabled()) {
      if (kDebugMode) {
        debugPrint('🚫 SHARE_PROSPECT_SCREEN: Sharing disabled, showing demo dialog');
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
          final targetedLink = _buildTargetedLink(messageKey);
          final messageBody = selectedMessage['message']!.replaceAll(_prospectReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_PROSPECT_SCREEN: Composing email (lang: $selectedLanguage) with targeted link: $targetedLink');
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
          final targetedLink = _buildTargetedLink(messageKey);
          final messageBody = selectedMessage['message']!.replaceAll(_prospectReferralLink!, targetedLink);

          if (kDebugMode) {
            debugPrint('📧 SHARE_PROSPECT_SCREEN: Composing email with targeted link: $targetedLink');
          }

          _composeEmail(
            subject: selectedMessage['subject']!,
            body: messageBody,
          );
        } else {
          if (kDebugMode) {
            debugPrint('❌ SHARE_PROSPECT_SCREEN: No message found for key: $messageKey');
          }
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint('❌ SHARE_PROSPECT_SCREEN: _prospectReferralLink is null');
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
    return Scaffold(
      appBar: AppScreenBar(title: context.l10n?.shareProspectTitle ?? 'New Recruiting Prospects', appId: widget.appId),
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
                      _buildProspectHeader(),
                      const SizedBox(height: 20),
                      _buildProspectMessages(),
                      const SizedBox(height: 32),
                      _buildProTips(),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildProspectHeader() {
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
        ],
      ),
    );
  }

  Widget _buildProspectMessages() {
    final buttonColor = AppColors.growthPrimary;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n?.shareSelectMessageLabel ?? 'Select Message To Send',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        ..._getProspectMessages(context).entries.map((entry) {
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
                  onPressed: () => _shareProspectMessage(context, messageKey),
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
          color: isSelected ? AppColors.growthPrimary.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? AppColors.growthPrimary : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? AppColors.growthPrimary : Colors.grey.shade700,
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
