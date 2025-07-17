import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'package:ultimatefix/screens/login_screen_old.dart';
import 'visit_opportunity_screen.dart';
import 'dart:async';
import '../models/user_model.dart';
import '../widgets/header_widgets.dart';
import 'my_biz_screen.dart';
import 'message_center_screen.dart';
import 'notifications_screen.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import 'downline_team_screen.dart';
import 'profile_screen.dart';
import 'share_screen.dart';
import 'how_it_works_screen.dart';
import 'package:flutter/foundation.dart';

class DashboardScreen extends StatefulWidget {
  final String appId;

  const DashboardScreen({
    super.key,
    required this.appId,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with TickerProviderStateMixin {
  StreamSubscription? _unreadMessagesSubscription;
  StreamSubscription? _unreadNotificationsSubscription;
  int _unreadNotificationCount = 0;
  bool _hasUnreadMessages = false;
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
    _animationController.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final user = Provider.of<UserModel?>(context);

    if (user != null) {
      _setupListeners(user.uid);
    } else {
      _unreadMessagesSubscription?.cancel();
      _unreadNotificationsSubscription?.cancel();
    }
  }

  void _setupListeners(String userId) {
    _unreadMessagesSubscription?.cancel();
    _unreadNotificationsSubscription?.cancel();

    _unreadMessagesSubscription = FirebaseFirestore.instance
        .collection('chats')
        .where('participants', arrayContains: userId)
        .snapshots()
        .listen((snapshot) {
      final hasUnread = snapshot.docs.any((doc) {
        final data = doc.data();
        final isReadMap = data['isRead'] as Map<String, dynamic>?;
        return isReadMap?[userId] == false;
      });

      if (mounted) {
        setState(() {
          _hasUnreadMessages = hasUnread;
        });
      }
    }, onError: (error) {
      if (kDebugMode) {
        print("Error listening to unread messages: $error");
      }
    });

    _unreadNotificationsSubscription = FirebaseFirestore.instance
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .where('read', isEqualTo: false)
        .snapshots()
        .listen((snapshot) {
      if (mounted) {
        setState(() {
          _unreadNotificationCount = snapshot.docs.length;
        });
      }
    });
  }

  @override
  void dispose() {
    _unreadMessagesSubscription?.cancel();
    _unreadNotificationsSubscription?.cancel();
    _animationController.dispose();
    super.dispose();
  }

  Widget _buildWelcomeSection(UserModel user) {
    return Container(
      margin: const EdgeInsets.only(bottom: 32),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppColors.heavyShadow,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.withOpacity(AppColors.textInverse, 0.2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.waving_hand,
                  size: 32,
                  color: AppColors.textInverse,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back,',
                      style: TextStyle(
                        fontSize: 16,
                        color: AppColors.withOpacity(AppColors.textInverse, 0.9),
                      ),
                    ),
                    Text(
                      '${user.firstName}!',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textInverse,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.withOpacity(AppColors.textInverse, 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.rocket_launch, color: AppColors.textInverse, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Ready to grow your team and achieve success?',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.withOpacity(AppColors.textInverse, 0.95),
                      fontWeight: FontWeight.w500,
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

  Widget _buildStatsCard(UserModel user) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.analytics, color: AppColors.growthPrimary, size: 24),
              const SizedBox(width: 12),
              Text(
                'Your Team Progress',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  icon: Icons.people,
                  value: user.directSponsorCount.toString(),
                  label: 'Direct Sponsors',
                  color: Colors.blue.shade600,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildStatItem(
                  icon: Icons.groups,
                  value: user.totalTeamCount.toString(),
                  label: 'Total Team',
                  color: Colors.green.shade600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: (user.directSponsorCount / AppConstants.projectWideDirectSponsorMin)
                .clamp(0.0, 1.0),
            backgroundColor: AppColors.borderLight,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
          
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String value,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.withOpacity(color, 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    required Color color,
    bool hasBadge = false,
    int badgeCount = 0,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.withOpacity(color, 0.1),
                  AppColors.withOpacity(color, 0.05),
                ],
              ),
            ),
            child: Stack(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.withOpacity(color, 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: color, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            subtitle,
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios,
                      color: AppColors.textTertiary,
                      size: 16,
                    ),
                  ],
                ),
                if (hasBadge)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        badgeCount > 0 ? badgeCount.toString() : '',
                        style: const TextStyle(
                          color: AppColors.textInverse,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActions(UserModel user) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 16),
          child: Text(
            'Quick Actions',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.help_outline,
          title: 'How It Works',
          subtitle: 'Learn about the Team Build Pro system',
          color: AppColors.teamAccent,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => HowItWorksScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.groups,
          title: 'My Downline',
          subtitle: 'View and manage your team members',
          color: AppColors.teamPrimary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => DownlineTeamScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.trending_up,
          title: 'Grow My Team',
          subtitle: 'Share your referral link and invite others',
          color: AppColors.growthPrimary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ShareScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.message,
          title: 'Messages',
          subtitle: 'Chat with your team members',
          color: AppColors.messagePrimary,
          hasBadge: _hasUnreadMessages,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => MessageCenterScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.notifications,
          title: 'Notifications',
          subtitle: 'Stay updated with important alerts',
          color: AppColors.notificationPrimary,
          hasBadge: _unreadNotificationCount > 0,
          badgeCount: _unreadNotificationCount,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => NotificationsScreen(appId: widget.appId),
            ),
          ),
        ),
        if (user.role == 'user' &&
            user.directSponsorCount >= AppConstants.projectWideDirectSponsorMin &&
            user.totalTeamCount >= AppConstants.projectWideTotalTeamMin)
          _buildActionCard(
            icon: Icons.monetization_on,
            title: user.bizOppRefUrl != null ? 'My Opportunity' : 'Join Opportunity',
            subtitle: user.bizOppRefUrl != null
                ? 'Manage your business opportunity'
                : 'Ready to join the business opportunity',
            color: AppColors.opportunityPrimary,
            onTap: () {
              if (user.bizOppRefUrl != null) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => MyBizScreen(appId: widget.appId),
                  ),
                );
              } else {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => VisitOpportunityScreen(appId: widget.appId),
                  ),
                );
              }
            },
          ),
        _buildActionCard(
          icon: Icons.person,
          title: 'My Profile',
          subtitle: 'Update your personal information',
          color: AppColors.primary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ProfileScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.logout,
          title: 'Log Out',
          subtitle: 'Log out of your account',
          color: AppColors.teamPrimary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => LoginScreen(appId: widget.appId),
            ),
          ),
        ),
        
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);

    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundSecondary,
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildWelcomeSection(user),
              _buildStatsCard(user),
              _buildQuickActions(user),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
