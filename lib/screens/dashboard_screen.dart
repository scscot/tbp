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
import 'platform_management_screen.dart';
import 'share_screen.dart';
import 'how_it_works_screen.dart';
import 'package:flutter/foundation.dart';
import '../services/auth_service.dart';
import '../services/network_service.dart'; // Added for caching
import '../widgets/restart_widget.dart';
import '../main.dart';
import 'subscription_screen.dart'; // --- 1. New import for SubscriptionScreen ---

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
  String? _bizOpp;

  // Network service for cached counts
  final NetworkService _networkService = NetworkService();
  Map<String, int> _cachedNetworkCounts = {};
  bool _isLoadingCounts = false;

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
    _loadBizOppData();
    _loadNetworkCounts();
  }

  /// Load cached network counts from NetworkService
  Future<void> _loadNetworkCounts() async {
    if (!mounted) return;

    setState(() {
      _isLoadingCounts = true;
    });

    try {
      if (kDebugMode) {
        debugPrint('📊 DASHBOARD: Loading cached network counts...');
      }

      final counts = await _networkService.getNetworkCounts();

      if (mounted) {
        setState(() {
          _cachedNetworkCounts = counts;
          _isLoadingCounts = false;
        });

        if (kDebugMode) {
          debugPrint('✅ DASHBOARD: Cached counts loaded: $counts');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ DASHBOARD: Error loading cached counts: $e');
      }

      if (mounted) {
        setState(() {
          _isLoadingCounts = false;
        });
      }
    }
  }

  /// Force refresh network counts (bypasses cache)
  Future<void> _refreshNetworkCounts() async {
    if (!mounted) return;

    try {
      if (kDebugMode) {
        debugPrint('🔄 DASHBOARD: Force refreshing network counts...');
      }

      final counts = await _networkService.refreshNetworkCounts();

      if (mounted) {
        setState(() {
          _cachedNetworkCounts = counts;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Team stats refreshed'),
            duration: Duration(seconds: 2),
            backgroundColor: Colors.green,
          ),
        );

        if (kDebugMode) {
          debugPrint('✅ DASHBOARD: Force refresh completed: $counts');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ DASHBOARD: Error refreshing counts: $e');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error refreshing stats: $e'),
            duration: const Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // --- 2. New helper method to check subscription before navigating ---
  Future<void> _navigateTo(Widget screen) async {
    final authService = context.read<AuthService>();
    final user = context.read<UserModel?>();

    if (user == null || !mounted) return;

    final needsSubscription =
        await authService.shouldShowSubscriptionScreen(user);

    if (!mounted) return;

    if (needsSubscription) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const SubscriptionScreen()),
      );
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => screen),
      );
    }
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
                color: Colors.black.withAlpha(75),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(50),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Icon(
                  Icons.assignment_return_outlined,
                  size: 40,
                  color: AppColors.textInverse,
                ),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'Finalize Your $_bizOpp Connection',
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
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'Update your profile now to ensure new team members are automatically placed in your organization.',
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textInverse.withAlpha(240),
                    height: 1.4,
                    fontWeight: FontWeight.w400,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 32),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.textInverse,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(25),
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
                        _navigateTo(AddLinkScreen(appId: widget.appId));
                      },
                      borderRadius: BorderRadius.circular(16),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                            vertical: 20, horizontal: 16),
                        child: Column(
                          children: [
                            Text(
                              "Add My $_bizOpp Referral Link Now",
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFFF6B00),
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
              TextButton(
                onPressed: () {
                  Navigator.pop(dialogContext);
                  _navigateTo(BusinessScreen(appId: widget.appId));
                },
                style: TextButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                child: Text(
                  'Skip for now!\nI haven\'t joined $_bizOpp',
                  style: TextStyle(
                    color: AppColors.textInverse,
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.textInverse.withAlpha(180),
                  ),
                  textAlign: TextAlign.center,
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
                        color:
                            AppColors.withOpacity(AppColors.textInverse, 0.9),
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
        ],
      ),
    );
  }

  Widget _buildStatsCard(UserModel user) {
    // Use cached network counts if available, fallback to user model data
    final directSponsors =
        _cachedNetworkCounts['directSponsors'] ?? user.directSponsorCount;
    final totalTeam = _cachedNetworkCounts['all'] ?? user.totalTeamCount;

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
                'Your Team Growth',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const Spacer(),
              // Refresh button for manual cache refresh
              IconButton(
                onPressed: _isLoadingCounts ? null : _refreshNetworkCounts,
                icon: _isLoadingCounts
                    ? SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      )
                    : Icon(
                        Icons.refresh,
                        color: AppColors.primary,
                        size: 20,
                      ),
                tooltip: 'Refresh team stats',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  minimumSize: const Size(32, 32),
                  padding: const EdgeInsets.all(6),
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
                  value: directSponsors.toString(),
                  label: 'Direct\nSponsors',
                  color: Colors.blue.shade600,
                  isLoading: _isLoadingCounts,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildStatItem(
                  icon: Icons.groups,
                  value: totalTeam.toString(),
                  label: 'Total Team\nMembers',
                  color: Colors.green.shade600,
                  isLoading: _isLoadingCounts,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: AppConstants.projectWideDirectSponsorMin > 0
                ? (directSponsors / AppConstants.projectWideDirectSponsorMin)
                    .clamp(0.0, 1.0)
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
    bool isLoading = false,
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
          isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: color,
                  ),
                )
              : Text(
                  value,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                ),
          const SizedBox(height: 4),
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
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
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

  // --- 3. All onTap handlers updated to use the new _navigateTo method ---
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
          onTap: () => _navigateTo(HowItWorksScreen(appId: widget.appId)),
        ), 
        if (user.role == 'admin') ...[
          _buildActionCard(
            icon: Icons.rocket_launch,
            title: 'Company Details',
            color: AppColors.opportunityPrimary,
            onTap: () => _navigateTo(CompanyScreen(appId: widget.appId)),
          ),
        ] else if ((user.role == 'user' && user.qualifiedDate != null)) ...[
          _buildActionCard(
            icon: Icons.rocket_launch,
            title: user.bizOppRefUrl != null
                ? 'Company Details'
                : 'Get Started Today',
            color: AppColors.opportunityPrimary,
            onTap: () {
              if (user.bizOppRefUrl != null) {
                _navigateTo(CompanyScreen(appId: widget.appId));
              } else {
                if (user.bizVisitDate != null && user.bizOppRefUrl == null) {
                  _showBizOppFollowUpModal(user);
                } else {
                  _navigateTo(BusinessScreen(appId: widget.appId));
                }
              }
            },
          ),
        ] else ...[
          _buildActionCard(
            icon: Icons.assessment,
            title: 'Your Eligibility Status',
            color: AppColors.opportunityPrimary,
            onTap: () => _navigateTo(EligibilityScreen(appId: widget.appId)),
          ),
        ], 
        _buildActionCard(
          icon: Icons.trending_up,
          title: 'Grow Your Team',
          color: AppColors.growthPrimary,
          onTap: () => _navigateTo(ShareScreen(appId: widget.appId)),
        ),
        _buildActionCard(
          icon: Icons.groups,
          title: 'View Your Team',
          color: AppColors.teamPrimary,
          onTap: () => _navigateTo(NetworkScreen(appId: widget.appId)),
        ),
        _buildActionCard(
          icon: Icons.notifications,
          title: 'Notifications',
          color: AppColors.notificationPrimary,
          hasBadge: _unreadNotificationCount > 0,
          badgeCount: _unreadNotificationCount,
          onTap: () => _navigateTo(NotificationsScreen(appId: widget.appId)),
        ),
        _buildActionCard(
          icon: Icons.message,
          title: 'Message Center',
          color: AppColors.messagePrimary,
          hasBadge: _unreadMessageCount > 0,
          badgeCount: _unreadMessageCount,
          onTap: () => _navigateTo(MessageCenterScreen(appId: widget.appId)),
        ),

        _buildActionCard(
          icon: Icons.person,
          title: 'View Your Profile',
          color: AppColors.primary,
          onTap: () => _navigateTo(ProfileScreen(appId: widget.appId)),
        ),

        if (user.role == 'admin')
          _buildActionCard(
            icon: Icons.manage_accounts,
            title: 'Platform Management',
            color: AppColors.opportunityPrimary,
            onTap: () =>
                _navigateTo(PlatformManagementScreen(appId: widget.appId)),
          ),

        // The Log Out button remains unchanged
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
        child: RefreshIndicator(
          onRefresh: () async {
            await _refreshNetworkCounts();
            await _loadBizOppData();
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
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
      ),
    );
  }
}
