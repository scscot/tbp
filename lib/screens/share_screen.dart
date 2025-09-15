import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';

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
        default: return '8';
      }
    } else {
      switch (messageKey) {
        case 'past_struggles': return '1';
        case 'not_salesperson': return '2';
        case 'hope_after_disappointment': return '3';
        case 'general_invitation': return '4';
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
    if (kDebugMode) {
      debugPrint('📧 SHARE_SCREEN: _composeEmail called');
      debugPrint('📧 Subject: $subject');
      debugPrint('📧 Body length: ${body.length} characters');
    }
    
    // Custom encoding that preserves spaces properly
    String enc(String s) => Uri.encodeComponent(s).replaceAll('+', '%20');

    final uri = Uri.parse(
      'mailto:?subject=${enc(subject)}&body=${enc(body)}',
    );

    if (kDebugMode) {
      debugPrint('📧 SHARE_SCREEN: Launching email client with URI: ${uri.toString()}');
    }

    // Try to launch and check the boolean result
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );

    if (launched) {
      if (kDebugMode) debugPrint('✅ SHARE_SCREEN: Email client launched successfully');
      return;
    }

    // If we get here, the system couldn't open mailto:
    if (kDebugMode) {
      debugPrint('❌ SHARE_SCREEN: Failed to open $uri (no handler / simulator / not configured)');
    }

    // Fallback: show message and/or share sheet
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('No email app available. Try sharing with Messages or copy link.'),
      ),
    );
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

  Map<String, Map<String, String>> _getProspectMessages() {
    return {
      'past_struggles': {
        'title': 'Addressing Past Struggles',
        'description': 'Perfect for prospects who have tried before and struggled',
        'subject': 'A Different Approach This Time',
        'message': 'I know the direct sales journey can feel overwhelming - maybe you\'ve even tried before and it didn\'t work out the way you hoped.\n\n'
            'Here\'s what\'s different this time: you can build your $_bizOppName team BEFORE you even join, so you\'re not starting from zero like most people do.\n\n'
            'Think about it - instead of that scary "cold start" where you\'re scrambling to find people, you could launch with a team already in place and growing.\n\n'
            'Check it out: $_prospectReferralLink\n\n'
            'This could be the game-changer you\'ve been looking for!\n\n'
            'Please don\'t hesitate to reach out if you have questions or want to discuss further.\n\n'
            'Best regards!',
      },
      'not_salesperson': {
        'title': 'For Non-Sales Minded',
        'description': 'Great for people who don\'t see themselves as "salespeople"',
        'subject': 'No Pressure, Just Opportunity',
        'message': 'I get it - when you hear "direct sales," you might think "I\'m not a salesperson" or worry about having to pressure friends and family.\n\n'
            'What if I told you there\'s a way to build your $_bizOppName team that feels natural and authentic? You can actually pre-build your network BEFORE joining, focusing on relationships first.\n\n'
            'No cold calls, no awkward pitches to relatives, no starting from scratch. Just a proven system with AI-powered coaching that guides you step-by-step, letting you build genuine connections naturally.\n\n'
            'Take a look: $_prospectReferralLink\n\n'
            'It might just change how you think about building a business!\n\n'
            'Feel free to reach out with any questions.\n\n'
            'Kind regards!',
      },
      'hope_after_disappointment': {
        'title': 'Hope After Disappointment',
        'description': 'Ideal for prospects burned by previous opportunities',
        'subject': 'You Deserve a Real Shot',
        'message': 'If you\'ve been burned before by opportunities that promised the world but left you starting from zero... I understand.\n\n'
            'Here\'s something different: imagine building your $_bizOppName team BEFORE you even join. No more hoping and praying for momentum - you create it first.\n\n'
            'This isn\'t about empty promises or overnight success. It\'s about giving yourself the advantage that successful leaders have always had: starting with a foundation already in place.\n\n'
            'See how it works: $_prospectReferralLink\n\n'
            'You deserve a real shot at success.\n\n'
            'I\'m here if you\'d like to discuss this further.\n\n'
            'Take care!',
      },
      'general_invitation': {
        'title': 'General Invitation',
        'description': 'A versatile message for any prospect situation',
        'subject': 'Pre-Build Your Team!',
        'message': 'Thanks for your interest in joining our $_bizOppName team! Here\'s something that could give you a HUGE advantage.\n\n'
            'You can pre-build your $_bizOppName team *before* you even join, so you launch with instant momentum instead of starting from zero.\n\n'
            'Check it out here: $_prospectReferralLink\n\n'
            'This could be the difference between struggling to get started and hitting the ground running!\n\n'
            'Please don\'t hesitate to reach out if you have questions or want to discuss further.\n\n'
            'Best regards!',
      },
    };
  }

  void _shareProspectMessage(String messageKey) {
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
      final messages = _getProspectMessages();
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
    } else {
      if (kDebugMode) {
        debugPrint('❌ SHARE_SCREEN: _prospectReferralLink is null');
      }
    }
  }

  Map<String, Map<String, String>> _getPartnerMessages() {
    return {
      'warm_market_exhausted': {
        'title': 'Warm Market Exhausted',
        'description': 'For partners who\'ve tapped out friends and family',
        'subject': 'Finally, a Fresh Approach',
        'message': 'I know you\'ve been grinding - maybe you\'ve already talked to everyone you know, spent money on leads that didn\'t pan out, or gotten tired of trying to get people to webinars they don\'t show up for.\n\n'
            'I found something different that\'s working for me. Instead of chasing prospects, this lets them build momentum FIRST, before they even join $_bizOppName.\n\n'
            'It\'s mobile-first (no more hotel meetings!), simple to duplicate, and prospects actually engage because they\'re building something for themselves.\n\n'
            'Take a look: $_partnerReferralLink\n\n'
            'This could be the breakthrough we\'ve been looking for.\n\n'
            'Let me know what you think!\n\n'
            'Best regards!',
      },
      'expensive_system_fatigue': {
        'title': 'System Fatigue & Expense',
        'description': 'For partners burned out on expensive recruiting methods',
        'subject': 'Stop Spending, Start Building',
        'message': 'How much have we all spent on leads, funnels, and recruiting systems that promise the world but leave us starting from scratch every time?\n\n'
            'I\'ve discovered a tool that flips the script entirely. Instead of expensive lead generation, prospects actually BUILD their $_bizOppName teams before joining - creating their own motivation and momentum.\n\n'
            'No more paying for leads that don\'t convert. No more complex funnels your team can\'t duplicate. Just a simple, mobile system that works.\n\n'
            'Check it out: $_partnerReferralLink\n\n'
            'Finally, a system that makes sense and doesn\'t break the bank.\n\n'
            'Would love your thoughts on this.\n\n'
            'Kind regards!',
      },
      'duplication_struggle': {
        'title': 'Duplication Challenges',
        'description': 'For leaders struggling to get their team to duplicate',
        'subject': 'Simple System Your Team Can Copy',
        'message': 'You know the frustration - you\'ve found systems that work for you, but your team can\'t seem to duplicate them. Too complex, too expensive, or they just don\'t have your experience level.\n\n'
            'I\'ve been testing something that changes this completely. It\'s so simple that anyone on your team can use it, and prospects actually WANT to engage because they\'re building their own $_bizOppName foundation.\n\n'
            'Mobile-first, easy to share, and it creates momentum before prospects even join. Your team will actually be able to duplicate this.\n\n'
            'See for yourself: $_partnerReferralLink\n\n'
            'This could be the game-changer for true duplication.\n\n'
            'I\'d love to hear your thoughts!\n\n'
            'Take care!',
      },
      'general_team_tool': {
        'title': 'General Team Tool',
        'description': 'A versatile message for any partner situation',
        'subject': 'A Great App for Growth!',
        'message': 'I\'ve found an incredible tool that\'s transforming how we build our $_bizOppName teams.\n\n'
            'Here\'s what makes it special:\n\n'
            '✅ Prospects can pre-build their teams BEFORE joining.\n'
            '✅ Creates instant momentum from day one.\n'
            '✅ AI coaching companion provides personalized guidance.\n'
            '✅ Simple system that promotes duplication.\n'
            '✅ Accelerates growth across our entire organization.\n\n'
            'This is what we\'ve been looking for to give our team a competitive edge!\n\n'
            'Check it out: $_partnerReferralLink\n\n'
            'Let\'s help our recruiting prospects start strong!\n\n'
            'I\'d love to hear your thoughts on this.\n\n'
            'Best regards!',
      },
    };
  }

  void _sharePartnerMessage(String messageKey) {
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
      final messages = _getPartnerMessages();
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
          title: const Text('Demo Mode'),
          content: const Text('Sharing disabled during demo mode.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('I Understand'),
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
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Text('Referral link copied! 🎉'),
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
      appBar: AppScreenBar(title: 'Share', appId: widget.appId),
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
          const Text('Powerful Referral System',
              style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: Colors.white)),
          const SizedBox(height: 8),
          Text(
            'Share your referral links to pre-build a new team with recruiting prospects or expand your existing team.',
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
        const Text('Proven Growth Strategies',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
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
                    const Text('New Recruiting Prospects',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    Text('Invite recruiting prospects to get a head start.',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Invite recruiting prospects to pre-build their $_bizOppName team with this app. They can create powerful momentum before officially joining $_bizOppName, ensuring success from day one.',
              style: TextStyle(
                  fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
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
                      'Choose Your Message (4 Options)',
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
                        ..._getProspectMessages().entries.map((entry) {
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
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => isPartner ? _sharePartnerMessage(messageKey) : _shareProspectMessage(messageKey),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: buttonColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.share, size: 16),
                  label: const Text('Share', style: TextStyle(fontSize: 13)),
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
                  label: const Text('Copy Link', style: TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
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
                    const Text('Current Business Partners',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    Text('Great for your existing $_bizOppName team',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text('Empower your existing $_bizOppName partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire $_bizOppName organization.',
              style: TextStyle(
                  fontSize: 14, color: AppColors.textSecondary, height: 1.4)),
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
                      'Choose Your Message (4 Options)',
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
                        ..._getPartnerMessages().entries.map((entry) {
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
              const Text('Pro Tips for Success',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 16),
          _buildTip('💬 Personalize your message when sharing'),
          _buildTip('📱 Share consistently across all social platforms'),
          _buildTip('🤝 Follow up with prospects who show interest'),
          _buildTip('📈 Track your results and adjust your approach'),
          if (_currentUser?.role == 'admin')
            _buildTip('🎯 Use both strategies for maximum growth potential'),
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
