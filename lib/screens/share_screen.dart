import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
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

class _ShareScreenState extends State<ShareScreen> with TickerProviderStateMixin {
  UserModel? _currentUser;
  bool _isLoading = true;
  String? _referralLink;
  String _bizOppName = 'your opportunity'; // Default fallback
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

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
          await _fetchBizOppName(); // Fetch business opportunity name
          _buildReferralLink();
        }
      }
    } catch (e) {
      debugPrint('Error loading current user: $e');
    } finally {
      setState(() {
        _isLoading = false;
      });
      _animationController.forward();
    }
  }

  Future<void> _fetchBizOppName() async {
    try {
      if (_currentUser != null) {
        final uplineAdmin = _currentUser!.uplineAdmin;
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
              debugPrint('🔍 BIZ_OPP DEBUG: Set bizOppName from admin_settings: $_bizOppName');
              return;
            }
          }
        }
      }
      
      debugPrint('🔍 BIZ_OPP DEBUG: No bizOpp found, using default: $_bizOppName');
    } catch (e) {
      debugPrint('🔍 BIZ_OPP DEBUG: Error fetching biz opp name: $e');
    }
  }

  void _buildReferralLink() {
    if (_currentUser != null) {
      // Unified referral link format
      _referralLink = 'https://teambuildpro.com/?ref=${_currentUser!.referralCode}';
    }
  }

  void _shareForNewProspects() {
    if (_referralLink != null) {
      final userName =
          '${_currentUser?.firstName ?? ''} ${_currentUser?.lastName ?? ''}'
              .trim();

      final message = _currentUser?.role == 'admin'
          ? '🚀 Get a head start on building your $_bizOppName team! I\'m inviting you to use the Team Build Pro app to pre-build your network so you can launch with momentum. Join me ($userName): $_referralLink'
          : '🌟 Let\'s build our $_bizOppName team together! I\'m using the Team Build Pro app to get a head start and create momentum before day one. Connect with me and start pre-building your network: $_referralLink';

      Share.share(message);
    }
  }

  void _shareForExistingMembers() {
    if (_referralLink != null) {
      final message = _currentUser?.role == 'admin'
          ? '💪 Fellow $_bizOppName partners! Let\'s use the same powerful system. Join me on the Team Build Pro app to accelerate your team\'s growth and duplication: $_referralLink'
          : '🎯 Let\'s duplicate our success in $_bizOppName! I\'m using the Team Build Pro app to help our whole team grow faster. Get on the same system with me: $_referralLink';

      Share.share(message);
    }
  }

  void _copyReferralLink() {
    if (_referralLink != null) {
      Clipboard.setData(ClipboardData(text: _referralLink!));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Text('Link copied to clipboard! 🎉'),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : FadeTransition(
              opacity: _fadeAnimation,
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    children: [
                      // Header Section
                      _buildHeader(),
                      const SizedBox(height: 32),
                      
                      // Sharing Strategies (MOVED UP)
                      _buildSharingStrategies(),
                      const SizedBox(height: 24),
                      
                      // Your Referral Link Section (MOVED DOWN)
                      _buildReferralLinkCard(),
                      const SizedBox(height: 32),
                      
                      // Pro Tips
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
          const Icon(
            Icons.share_rounded,
            size: 48,
            color: Colors.white,
          ),
          const SizedBox(height: 16),
          const Text(
            'Build & Grow Your Team',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Share your link to pre-build a new team with aspiring leaders or expand your existing network.',
            style: TextStyle(
              fontSize: 16,
              color: Colors.white.withValues(alpha: 0.9),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildReferralLinkCard() {
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
                  color: AppColors.primaryExtraLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.link,
                  color: AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Your Referral Link',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderLight),
            ),
            child: Column(
              children: [
                Text(
                  _referralLink ?? 'Generating link...',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy Link'),
                    onPressed: _copyReferralLink,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
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

  Widget _buildSharingStrategies() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Business Growth Strategies',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 16),

        // Strategy 1: New Business Prospects
        _buildStrategyCard(
          title: '🌟 New Business Prospects',
          subtitle: 'Invite aspiring leaders to get a head start.',
          description:
              'Invite professionals to pre-build their team on this platform. They can create powerful momentum before officially joining $_bizOppName, ensuring success from day one.',
          buttonText: 'Share with Prospects',
          buttonColor: AppColors.growthPrimary,
          onPressed: _shareForNewProspects,
          icon: Icons.connect_without_contact,
        ),

        const SizedBox(height: 16),

        // Strategy 2: Current Business Partners
        _buildStrategyCard(
          title: '🚀 Current Business Partners',
          subtitle: 'Great for your existing $_bizOppName network',
          description:
              'Empower your existing partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire $_bizOppName organization.',
          buttonText: 'Share with Partners',
          buttonColor: AppColors.opportunityPrimary,
          onPressed: _shareForExistingMembers,
          icon: Icons.handshake,
        ),
      ],
    );
  }

  Widget _buildStrategyCard({
    required String title,
    required String subtitle,
    required String description,
    required String buttonText,
    required Color buttonColor,
    required VoidCallback onPressed,
    required IconData icon,
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
                  color: buttonColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: buttonColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      subtitle,
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
          Text(
            description,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.share_rounded),
              label: Text(buttonText),
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: buttonColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
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
              const Text(
                'Pro Tips for Success',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
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
            decoration: BoxDecoration(
              color: AppColors.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 14, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  
}
