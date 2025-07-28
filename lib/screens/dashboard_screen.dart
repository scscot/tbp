import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'add_link_screen.dart';
import 'business_screen.dart';
import 'dart:async';
import '../models/user_model.dart';
import '../widgets/header_widgets.dart';
import 'company_screen.dart';
import 'message_center_screen.dart';
import 'notifications_screen.dart';
import 'eligibility_screen.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import 'network_screen.dart';
import 'profile_screen.dart';
import 'share_screen.dart';
import 'how_it_works_screen.dart';
import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../widgets/restart_widget.dart';
import '../main.dart';


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
  int _unreadMessageCount = 0;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  String? _bizOpp; // Add state variable to store biz_opp value

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
    _loadBizOppData(); // Load biz_opp data on init
  }

  Future<void> _loadBizOppData() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null) return;

    final adminUid = user.uplineAdmin;
    if (adminUid == null || adminUid.isEmpty) {
      debugPrint("User does not have an upline admin.");
      return;
    }

    try {
      // Fetch biz_opp from admin_settings (following BusinessScreen pattern)
      final adminSettingsDoc = await FirebaseFirestore.instance
          .collection('admin_settings')
          .doc(adminUid)
          .get();
      
      if (adminSettingsDoc.exists && mounted) {
        final adminData = adminSettingsDoc.data();
        final retrievedBizOpp = adminData?['biz_opp'] as String?;
        
        setState(() {
          _bizOpp = retrievedBizOpp;
        });
      }
    } catch (e) {
      debugPrint('Error loading biz_opp data: $e');
    }
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
      int unreadCount = 0;
      for (var doc in snapshot.docs) {
        final data = doc.data();
        final isReadMap = data['isRead'] as Map<String, dynamic>?;
        if (isReadMap?[userId] == false) {
          unreadCount++;
        }
      }

      if (mounted) {
        setState(() {
          _unreadMessageCount = unreadCount;
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

  void _showBizOppFollowUpModal(UserModel user) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (BuildContext dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        elevation: 0,
        backgroundColor: Colors.transparent,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          margin: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFFFF8A00),
                const Color(0xFFFF6B00),
              ],
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 32),
              // Enhanced icon with background
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  Icons.assignment_return_outlined,
                  size: 40,
                  color: AppColors.textInverse,
                ),
              ),
              const SizedBox(height: 24),
              // Title with better typography
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'Don\'t Miss Out on Growing Your $_bizOpp Organization!',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textInverse,
                    height: 1.2,
                    letterSpacing: -0.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
              // Description with improved readability
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'You\'ve joined the $_bizOpp opportunity — great! Update your profile now so every Team member that joins the $_bizOpp opportunity after you is placed directly into your $_bizOpp team.',
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textInverse.withValues(alpha: 0.95),
                    height: 1.4,
                    fontWeight: FontWeight.w400,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 32),
              // Enhanced button styling
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.textInverse,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        Navigator.pop(dialogContext);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => AddLinkScreen(appId: widget.appId),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
                        child: Column(
                          children: [
                            Text(
                              "Add My $_bizOpp Organization Link Now",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFFF6B00),
                              ),
                              textAlign: TextAlign.center,
                            ),
 
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Enhanced close button
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: Text(
                  'Skip for now - I haven’t joined $_bizOpp',
                  style: TextStyle(
                    color: AppColors.textInverse,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.textInverse.withValues(alpha: 0.7),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
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
                        fontSize: 24,
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
                    'Ready to expand your team!',
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
                'Your Network Growth',
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
            value: AppConstants.projectWideDirectSponsorMin > 0 
                ? (user.directSponsorCount / AppConstants.projectWideDirectSponsorMin).clamp(0.0, 1.0)
                : 0.0,
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
            child: Row(
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
                  child: Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (hasBadge && badgeCount > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          constraints: const BoxConstraints(
                            minWidth: 20,
                            minHeight: 20,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.error,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Center(
                            child: Text(
                              badgeCount.toString(),
                              style: const TextStyle(
                                color: AppColors.textInverse,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ],
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
          color: AppColors.teamAccent,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => HowItWorksScreen(appId: widget.appId),
            ),
          ),
        ),
// Business opportunity card - conditional based on qualification status

if (user.role == 'admin') ...[
  _buildActionCard(
    icon: Icons.rocket_launch,
    title: 'My Opportunity Details',
    color: AppColors.opportunityPrimary,
    onTap: () {
      // Navigate to company screen normally
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CompanyScreen(appId: widget.appId),
        ),
      );
    },
  ),
] else if ((user.role == 'user' && user.qualifiedDate != null)) ...[
  // QUALIFIED: Show business details or join business option
  _buildActionCard(
    icon: Icons.rocket_launch,
    title: user.bizOppRefUrl != null
        ? 'My Opportunity Details'
        : 'Get Started Today',
    color: AppColors.opportunityPrimary,
    onTap: () {
      if (user.bizOppRefUrl != null) {
        // User has already joined - show company details
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CompanyScreen(appId: widget.appId),
          ),
        );
      } else {
        // Check if user has visited business opportunity but hasn't added referral link
        if (user.bizVisitDate != null && user.bizOppRefUrl == null) {
          // Show follow-up modal
          _showBizOppFollowUpModal(user);
        } else {
          // User is qualified but hasn't visited - show business screen
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => BusinessScreen(appId: widget.appId),
            ),
          );
        }
      }
    },
  ),
] else ...[
  // NOT QUALIFIED: Show eligibility status
  _buildActionCard(
    icon: Icons.assessment,
    title: 'Eligibility Status',
    color: AppColors.opportunityPrimary,
    onTap: () {
      // Navigate to eligibility screen normally
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => EligibilityScreen(appId: widget.appId),
        ),
      );
    },
  ),
],
        _buildActionCard(
          icon: Icons.trending_up,
          title: 'Grow My Team',
          color: AppColors.growthPrimary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ShareScreen(appId: widget.appId),
            ),
          ),
        ),
        _buildActionCard(
          icon: Icons.groups,
          title: 'View My Team',
          color: AppColors.teamPrimary,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => NetworkScreen(appId: widget.appId),
            ),
          ),
        ),

        _buildActionCard(
          icon: Icons.notifications,
          title: 'Notifications',
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
        _buildActionCard(
          icon: Icons.message,
          title: 'Message Center',
          color: AppColors.messagePrimary,
          hasBadge: _unreadMessageCount > 0,
          badgeCount: _unreadMessageCount,
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => MessageCenterScreen(appId: widget.appId),
            ),
          ),
        ),
        
        _buildActionCard(
          icon: Icons.person,
          title: 'My Profile',
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
          color: AppColors.errorLight,
          onTap: () async {
            final authService = context.read<AuthService>();
            final navigator = Navigator.of(context);

            if (navigator.canPop()) {
              navigator.popUntil((route) => route.isFirst);
            }

            await authService.signOut();

            final rootNavigatorContext = navigatorKey.currentContext;
            if (rootNavigatorContext != null && rootNavigatorContext.mounted) {
              RestartWidget.restartApp(rootNavigatorContext);
            }
          },
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
