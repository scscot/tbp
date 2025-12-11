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

class ShareProspectScreen extends StatefulWidget {
  final String appId;

  const ShareProspectScreen({
    super.key,
    required this.appId,
  });

  @override
  State<ShareProspectScreen> createState() => _ShareProspectScreenState();
}

class _ShareProspectScreenState extends State<ShareProspectScreen>
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

  Map<String, Map<String, String>> _getProspectMessages(BuildContext context) {
    return {
      'general_invitation': {
        'title': context.l10n?.shareProspectGeneralInvitationTitle ?? 'General Invitation',
        'description': context.l10n?.shareProspectGeneralInvitationDescription ?? 'A versatile message for any prospect situation',
        'subject': context.l10n?.shareProspectGeneralInvitationSubject ?? 'Build Your Team Before Joining $_bizOppName',
        'message': (context.l10n?.shareProspectGeneralInvitationMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Thinking about $_bizOppName? Here\'s a smarter way to start.\n\nTeam Build Pro lets you build your team BEFORE you officially join. An AI Coach helps you:\n\n- 16 pre-written recruiting messages ready to share\n- Track who\'s interested and ready\n- Get 24/7 AI coaching for recruiting questions\n- Build real momentum risk-free\n\nSo when you do join $_bizOppName, you\'re not starting from zero. You launch with people already waiting for you.\n\nSee how it works: $_prospectReferralLink\n\nDay 1 isn\'t a cold start. It\'s a running start.'),
      },
      'past_struggles': {
        'title': context.l10n?.shareProspectPastStrugglesTitle ?? 'Addressing Past Struggles',
        'description': context.l10n?.shareProspectPastStrugglesDescription ?? 'Perfect for prospects who have tried before and struggled',
        'subject': context.l10n?.shareProspectPastStrugglesSubject ?? 'Try $_bizOppName Differently This Time',
        'message': (context.l10n?.shareProspectPastStrugglesMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Been burned before in direct sales? Past attempts at $_bizOppName or similar businesses left you stuck at zero?\n\nThis time, start smarter.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join. Choose from 16 pre-written recruiting messages, track who\'s interested, and get 24/7 AI coaching support.\n\nSo you don\'t start from scratch. You launch with real people already waiting for you.\n\nThe AI walks you through every step. You won\'t be alone.\n\nSee how it works: $_prospectReferralLink\n\nYou deserve a real shot this time.'),
      },
      'not_salesperson': {
        'title': context.l10n?.shareProspectNotSalespersonTitle ?? 'For Non-Sales Minded',
        'description': context.l10n?.shareProspectNotSalespersonDescription ?? 'Great for people who don\'t see themselves as "salespeople"',
        'subject': context.l10n?.shareProspectNotSalespersonSubject ?? 'Build Your $_bizOppName Team Without Being "Salesy"',
        'message': (context.l10n?.shareProspectNotSalespersonMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Not a "natural salesperson"? Considering $_bizOppName but worried about the recruiting part?\n\nYou don\'t need a sales personality. You just need smart AI tools.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you join - with an AI Coach that:\n\n- 16 pre-written recruiting messages ready to customize\n- 24/7 AI guidance for any recruiting question\n- Track your prospects and their interest level\n- Build confidence with proven messaging\n\nIt\'s like having a recruiting assistant who never sleeps. You focus on genuine relationships. The AI handles the awkward sales stuff.\n\nStart building before you even join: $_prospectReferralLink'),
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
            'Considering $_bizOppName but uncomfortable with awkward conversations? You\'re not alone.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - online, at your own pace, where it feels comfortable.\n\nThe AI Coach:\n- 16 pre-written messages - no awkward "what do I say?"\n- Track prospects at your own pace\n- Get 24/7 AI guidance when you need it\n- Build your network online, comfortably\n\nNo cold calls. No awkward face-to-face pitches. Just genuine online connections guided by AI.\n\nYou build real momentum risk-free. So when you do join $_bizOppName, you\'re launching with people already waiting for you.\n\nStart building on your terms: $_prospectReferralLink'),
      },
      'time_constrained': {
        'title': context.l10n?.shareProspectTimeConstrainedTitle ?? 'For Busy Professionals',
        'description': context.l10n?.shareProspectTimeConstrainedDescription ?? 'Ideal for prospects juggling job, family, and other commitments',
        'subject': context.l10n?.shareProspectTimeConstrainedSubject ?? 'Build Your $_bizOppName Team in the Gaps',
        'message': (context.l10n?.shareProspectTimeConstrainedMessage(_bizOppName, _prospectReferralLink ?? '') ??
            'Interested in $_bizOppName but can\'t dedicate full-time hours? You don\'t need to.\n\nTeam Build Pro lets you build your $_bizOppName team BEFORE you officially join - in the gaps of your busy life.\n\nMorning coffee? Lunch break? Evening downtime? The AI Coach works around your schedule:\n- 16 pre-written messages ready to send anytime\n- Track all your prospects in one place\n- Get AI guidance whenever you have a few minutes\n- See your progress and momentum grow\n\nWork 15 minutes here, 20 minutes there. The AI makes every minute count.\n\nSo when you do join $_bizOppName, you\'re launching with people already waiting - not starting from zero.\n\nSee how it fits your life: $_prospectReferralLink'),
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
