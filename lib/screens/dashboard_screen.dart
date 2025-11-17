import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';
import 'dart:async';
import 'dart:io';
import '../models/user_model.dart';
import '../widgets/header_widgets.dart';
import '../config/app_constants.dart';
import '../config/app_colors.dart';
import 'package:flutter/foundation.dart';
import '../services/network_service.dart';
import '../services/subscription_service.dart';
import '../services/subscription_navigation_guard.dart';
import 'profile_screen.dart';
import 'subscription_screen_enhanced.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'faq_screen.dart';
import 'chatbot_screen.dart';
import 'share_screen.dart';
import 'network_screen.dart';
import 'message_center_screen.dart';
import 'notifications_screen.dart';
import '../services/review_service.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import '../i18n/dashboard_analytics.dart';
import '../widgets/localized_text.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../widgets/biz_opp_education_modal.dart';

// --- 1. New import for SubscriptionScreen ---

class DashboardScreen extends StatefulWidget {
  final String appId;

  /// Callback to switch tabs in the persistent bottom navigation
  final void Function(int)? onTabSelected;
  const DashboardScreen({
    super.key,
    required this.appId,
    this.onTabSelected,
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

  // Network service for cached counts
  final NetworkService _networkService = NetworkService();
  Map<String, int> _cachedNetworkCounts = {};
  bool _isLoadingCounts = false;
  
  // Demo mode state (iOS & Android)
  bool _isDemoMode = false;
  String? _demoEmail;

  bool _hasTrackedView = false;

  // Business opportunity state
  String? _bizOppName;

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
    _checkDemoMode();
    _loadBizOppData();
    _loadNetworkCounts();

    // Start real-time listener for count updates
    _networkService.startUserDocumentListener(
      onCountsChanged: _onRealtimeCountsChanged,
    );

    // Check if user should be prompted for app review
    _checkReviewPrompt();
  }

  Future<void> _checkReviewPrompt() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user != null) {
      await ReviewService.checkAndPromptReview(user.uid);
    }
  }

  Future<void> _checkAndShowEducationModal() async {
    final user = Provider.of<UserModel?>(context, listen: false);
    if (user == null || _bizOppName == null) return;

    final shouldShowModal = user.qualifiedDate != null &&
        user.bizJoinDate == null &&
        !user.bizOppEducationShown;

    if (shouldShowModal) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          showBizOppEducationModal(
            context,
            user.uid,
            _bizOppName!,
            () {
              widget.onTabSelected?.call(7);
            },
          );
        }
      });
    }
  }

  // -------------------------------------------------------------
  // DEMO MODE LOGIC (iOS & Android)
  // -------------------------------------------------------------

  Future<void> _checkDemoMode() async {
    try {
      final remoteConfig = FirebaseRemoteConfig.instance;
      bool isDemo = false;
      
      if (Platform.isAndroid) {
        isDemo = remoteConfig.getBool('android_demo_mode');
        debugPrint('🤖 DASHBOARD: Android demo mode: $isDemo');
      } else if (Platform.isIOS) {
        isDemo = remoteConfig.getBool('ios_demo_mode');
        debugPrint('🍎 DASHBOARD: iOS demo mode: $isDemo');
      }
      
      final demoEmail = remoteConfig.getString('demo_account_email');

      if (mounted) {
        setState(() {
          _isDemoMode = isDemo;
          _demoEmail = demoEmail.isNotEmpty ? demoEmail : null;
        });
      }
    } catch (e) {
      debugPrint('❌ DASHBOARD: Error checking demo mode: $e');
    }
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

  /// Database cleanup function for Super Admin
  Future<void> _runDatabaseCleanup({required bool dryRun}) async {
    if (!mounted) return;

    try {
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('deleteNonAdminUsers');

      final result = await callable.call({
        'dryRun': dryRun,
      });

      if (!mounted) return;

      final data = Map<String, dynamic>.from(result.data as Map);
      final summary = Map<String, dynamic>.from(data['summary'] as Map);
      final deleted = Map<String, dynamic>.from(summary['deleted'] as Map);
      final message = data['message'] as String;

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(dryRun ? '🔍 Dry-Run Results' : '✅ Cleanup Complete'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(message, style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Text('Total Users: ${summary['totalUsers']}'),
                Text('Non-Admin Users: ${summary['nonAdminUsers']}'),
                Text('Protected Admins: ${summary['protectedAdmins']}'),
                const SizedBox(height: 12),
                const Text('Would Delete:', style: TextStyle(fontWeight: FontWeight.bold)),
                Text('  Users: ${deleted['users']}'),
                Text('  Chats: ${deleted['chats']}'),
                Text('  Chat Logs: ${deleted['chatLogs']}'),
                Text('  Chat Usage: ${deleted['chatUsage']}'),
                Text('  Referral Codes: ${deleted['referralCodes']}'),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );
    }
  }

  Future<void> _runOrphanedCleanup({required bool dryRun}) async {
    if (!mounted) return;

    try {
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('cleanupOrphanedUsers');

      final result = await callable.call({
        'dryRun': dryRun,
      });

      if (!mounted) return;

      final data = Map<String, dynamic>.from(result.data as Map);
      final summary = Map<String, dynamic>.from(data['summary'] as Map);
      final deleted = Map<String, dynamic>.from(summary['deleted'] as Map);
      final message = data['message'] as String;
      final sampleParents = (summary['sampleOrphanedParents'] as List?)?.cast<String>() ?? [];
      final sampleSubcollectionsList = summary['sampleSubcollections'] as List? ?? [];
      final sampleSubcollections = sampleSubcollectionsList.map((item) => Map<String, dynamic>.from(item as Map)).toList();

      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(dryRun ? '🔍 Orphaned Subcollections Preview' : '✅ Cleanup Complete'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(message, style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Text('Notifications Scanned: ${summary['notificationsScanned']}'),
                Text('FCM Tokens Scanned: ${summary['fcmTokensScanned']}'),
                const SizedBox(height: 12),
                const Text('Orphaned Data Found:', style: TextStyle(fontWeight: FontWeight.bold)),
                Text('  Total Orphaned Subcollections: ${summary['totalOrphanedSubcollections']}'),
                Text('  Orphaned Notifications: ${summary['orphanedNotifications']}'),
                Text('  Orphaned FCM Tokens: ${summary['orphanedFcmTokens']}'),
                Text('  Non-Existent Parent Users: ${summary['uniqueOrphanedParents']}'),
                Text('Execution Time: ${summary['executionTime']}'),
                if (!dryRun) ...[
                  const SizedBox(height: 12),
                  const Text('Deleted:', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text('  Notifications: ${deleted['notifications']['success']}'),
                  Text('  FCM Tokens: ${deleted['fcmTokens']['success']}'),
                ],
                if (sampleParents.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Sample Non-Existent Parent UIDs:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ...sampleParents.take(5).map((uid) => Padding(
                    padding: const EdgeInsets.only(left: 8, top: 2),
                    child: Text(uid, style: const TextStyle(fontSize: 10, fontFamily: 'monospace')),
                  )),
                ],
                if (sampleSubcollections.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Sample Orphaned Subcollections:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ...sampleSubcollections.take(5).map((sub) => Padding(
                    padding: const EdgeInsets.only(left: 8, top: 4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${sub['type']} under ${sub['parentUserId']}',
                          style: const TextStyle(fontSize: 10)),
                        Text('  Path: ${sub['path']}',
                          style: const TextStyle(fontSize: 9, color: Colors.grey)),
                      ],
                    ),
                  )),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 5),
        ),
      );
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

        FirebaseAnalytics.instance.logEvent(
          name: DashboardAnalytics.dashStatsRefresh,
          parameters: {'method': 'manual', 'locale': Localizations.localeOf(context).toLanguageTag(), 'success': true},
        );

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n?.dashStatsRefreshed ?? 'Team stats refreshed'),
            duration: const Duration(seconds: 2),
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
        FirebaseAnalytics.instance.logEvent(
          name: DashboardAnalytics.dashStatsRefresh,
          parameters: {'method': 'manual', 'locale': Localizations.localeOf(context).toLanguageTag(), 'success': false},
        );

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n?.dashStatsError(e.toString()) ?? 'Error refreshing stats: $e'),
            duration: const Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Called when real-time count changes are detected
  void _onRealtimeCountsChanged() async {
    if (kDebugMode) {
      debugPrint('🔄 DASHBOARD: Real-time counts changed, refreshing stats...');
    }

    try {
      // Get fresh counts (cache was invalidated by NetworkService)
      final counts = await _networkService.getNetworkCounts();
      if (!mounted) return;

      // Update cached counts
      setState(() {
        _cachedNetworkCounts = counts;
      });

      if (kDebugMode) {
        debugPrint('✅ DASHBOARD: Stats refreshed with real-time data: $counts');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ DASHBOARD: Error refreshing stats: $e');
      }
    }
  }

  // --- 2. New helper method to check subscription before navigating ---

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
        final bizOpp = adminData?['biz_opp'] as String?;

        setState(() {
          _bizOppName = bizOpp ?? user.bizOpp;
        });

        await _checkAndShowEducationModal();
      }
    } catch (e) {
      debugPrint('Error loading biz_opp data: $e');
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final user = Provider.of<UserModel?>(context);

    // Track dashboard view (only once, after localization is available)
    if (!_hasTrackedView) {
      _hasTrackedView = true;
      final locale = Localizations.localeOf(context);
      final l10n = context.l10n;
      debugPrint('🌍 DASHBOARD: Locale = $locale, l10n = ${l10n != null ? 'available' : 'NULL'}, dashTitle = ${l10n?.dashTitle}');
      FirebaseAnalytics.instance.logEvent(
        name: DashboardAnalytics.dashView,
        parameters: {'locale': locale.toLanguageTag()},
      );
    }

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
    _networkService.stopUserDocumentListener();
    _animationController.dispose();
    super.dispose();
  }

  /* Widget _buildWelcomeSection(UserModel user) {
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
  } */

  Widget _buildStatsCard(UserModel user) {
    // Use cached network counts if available, fallback to user model data
    final directSponsors =
        _cachedNetworkCounts['directSponsors'] ?? user.directSponsorCount;
    final totalTeam = _cachedNetworkCounts['all'] ?? user.totalTeamCount;

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
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
              Expanded(
                child: Text(
                  context.l10n?.dashKpiTitle ?? 'Your Current Team Stats',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
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
                tooltip: context.l10n?.dashKpiRefreshTooltip ?? 'Refresh team stats',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  minimumSize: const Size(32, 32),
                  padding: const EdgeInsets.all(6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: Row(
              children: [
                Expanded(
                  flex: 1,
                  child: _buildStatItem(
                    icon: Icons.people,
                    value: directSponsors.toString(),
                    label: context.l10n?.dashKpiDirectSponsors ?? 'Direct Sponsors',
                    color: Colors.blue.shade600,
                    isLoading: _isLoadingCounts,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: _buildStatItem(
                    icon: Icons.groups,
                    value: totalTeam.toString(),
                    label: context.l10n?.dashKpiTotalTeam ?? 'Total Team Members',
                    color: Colors.green.shade600,
                    isLoading: _isLoadingCounts,
                  ),
                ),
              ],
            ),
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
      padding: const EdgeInsets.all(12),
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
    bool hasAttentionBadge = false,
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
                Stack(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.withOpacity(color, 0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: color, size: 28),
                    ),
                    if (hasAttentionBadge)
                      Positioned(
                        right: 0,
                        top: 0,
                        child: Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: Colors.amber,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white,
                              width: 2,
                            ),
                          ),
                        ),
                      ),
                  ],
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

  Widget _buildQuickActions(UserModel user) {
    final subscriptionStatus = user.subscriptionStatus;
    final shouldShowSubscriptionCard =
      user.lifetimeAccess != true && (
        subscriptionStatus == 'expired' ||
        subscriptionStatus == 'cancelled' ||
        (subscriptionStatus == 'trial' && user.trialDaysRemaining <= 6)
      );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Show subscription card at top for expired/cancelled users or trial users in final 6 days (urgent action needed)
        if (!(_isDemoMode && _demoEmail != null) && shouldShowSubscriptionCard)
          _buildDynamicSubscriptionCard(user),

        // Getting Started card - always shown first
        _buildActionCard(
          icon: Icons.rocket_launch,
          title: context.l10n?.dashTileGettingStarted ?? 'Getting Started',
          color: AppColors.opportunityPrimary,
          onTap: () {
            FirebaseAnalytics.instance.logEvent(
              name: DashboardAnalytics.dashTileTap,
              parameters: {'tile': 'getting_started', 'locale': Localizations.localeOf(context).toLanguageTag()},
            );
            widget.onTabSelected?.call(12);
          },
        ),

        if (user.role == 'admin') ...[
          _buildActionCard(
            icon: Icons.list,
            title: context.l10n?.dashTileOpportunity ?? 'Opportunity Details',
            color: AppColors.opportunityPrimary,
            onTap: () => widget.onTabSelected?.call(6),
          ),
        ] else if ((user.role == 'user' && user.qualifiedDate != null)) ...[
          _buildActionCard(
            icon: Icons.list,
            title: user.bizOppRefUrl != null
                ? (context.l10n?.dashTileOpportunity ?? 'Opportunity Details')
                : (context.l10n?.dashTileJoinOpportunity ?? 'Join Opportunity!'),
            color: AppColors.opportunityPrimary,
            hasAttentionBadge: user.bizJoinDate == null,
            onTap: () => widget.onTabSelected?.call(
              user.bizOppRefUrl != null ? 6 : 7,
            ),
          ),
        ] else ...[
          _buildActionCard(
            icon: Icons.assessment,
            title: context.l10n?.dashTileEligibility ?? 'Your Eligibility Status',
            color: AppColors.opportunityPrimary,
            onTap: () => widget.onTabSelected?.call(8),
          ),
        ],
        _buildActionCard(
          icon: Icons.trending_up,
          title: context.l10n?.dashTileGrowTeam ?? 'Grow Your Team',
          color: AppColors.growthPrimary,
          onTap: () {
            FirebaseAnalytics.instance.logEvent(
              name: DashboardAnalytics.dashCtaTap,
              parameters: {'cta': 'grow_team', 'locale': Localizations.localeOf(context).toLanguageTag()},
            );
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => ShareScreen(appId: widget.appId)),
            );
          },
        ),
        _buildActionCard(
          icon: Icons.groups,
          title: context.l10n?.dashTileViewTeam ?? 'View Your Team',
          color: AppColors.teamPrimary,
          onTap: () {
            FirebaseAnalytics.instance.logEvent(
              name: DashboardAnalytics.dashCtaTap,
              parameters: {'cta': 'view_team', 'locale': Localizations.localeOf(context).toLanguageTag()},
            );
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => NetworkScreen(appId: widget.appId)),
            );
          },
        ),
        _buildActionCard(
          icon: Icons.smart_toy,
          title: context.l10n?.dashTileAiCoach ?? 'Your AI Coach',
          color: AppColors.chatPrimary,
          onTap: () {
            SubscriptionNavigationGuard.pushGuarded(
              context: context,
              routeName: 'chatbot',
              screen: ChatBotScreen(onTabSelected: widget.onTabSelected),
              appId: widget.appId,
            );
          },
        ),
        _buildActionCard(
          icon: Icons.message,
          title: context.l10n?.dashTileMessageCenter ?? 'Message Center',
          color: AppColors.messagePrimary,
          hasBadge: _unreadMessageCount > 0,
          badgeCount: _unreadMessageCount,
          onTap: () {
            FirebaseAnalytics.instance.logEvent(
              name: DashboardAnalytics.dashCtaTap,
              parameters: {'cta': 'message_center', 'locale': Localizations.localeOf(context).toLanguageTag()},
            );
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => MessageCenterScreen(appId: widget.appId)),
            );
          },
        ),
        _buildActionCard(
          icon: Icons.notifications,
          title: context.l10n?.dashTileNotifications ?? 'Notifications',
          color: AppColors.notificationPrimary,
          hasBadge: _unreadNotificationCount > 0,
          badgeCount: _unreadNotificationCount,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => NotificationsScreen(appId: widget.appId)),
            );
          },
        ),
        _buildActionCard(
          icon: Icons.help_outline,
          title: context.l10n?.dashTileHowItWorks ?? 'How It Works',
          color: AppColors.teamAccent,
          onTap: () => widget.onTabSelected?.call(5),
        ),
        _buildActionCard(
          icon: Icons.quiz,
          title: context.l10n?.dashTileFaqs ?? 'FAQ\'s',
          color: AppColors.info,
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const FAQScreen(),
              ),
            );
          },
        ),
        _buildActionCard(
          icon: Icons.person,
          title: context.l10n?.dashTileProfile ?? 'View Your Profile',
          color: AppColors.primary,
          onTap: () {
            SubscriptionNavigationGuard.pushGuarded(
              context: context,
              routeName: 'profile',
              screen: ProfileScreen(appId: widget.appId),
              appId: widget.appId,
            );
          },
        ),

        // Subscription card is only shown at top for expired/cancelled or trial (final 6 days)

          _buildActionCard(
            icon: Icons.manage_accounts,
            title: context.l10n?.dashTileCreateAccount ?? 'Create New Account',
            color: AppColors.opportunityPrimary,
            onTap: () => widget.onTabSelected?.call(11),
          ),
      ],
    );
  }

  Widget _buildDynamicSubscriptionCard(UserModel user) {
    // Calculate trial status using UserModel's built-in methods
    final subscriptionStatus = user.subscriptionStatus;
    
    String buttonText;
    IconData buttonIcon;
    Color buttonColor;
    
    if (subscriptionStatus == 'trial') {
      // User is in trial period
      final daysLeft = user.trialDaysRemaining;
      buttonText = context.l10n?.dashSubscriptionTrial(daysLeft) ?? 'Start Subscription\n($daysLeft days left in trial)';
      buttonIcon = Icons.diamond;
      buttonColor = Colors.deepPurple;
    } else if (subscriptionStatus == 'expired') {
      // Trial expired
      buttonText = context.l10n?.dashSubscriptionExpired ?? 'Renew Your Subscription\n30-day Free trial expired.';
      buttonIcon = Icons.diamond;
      buttonColor = Colors.red;
    } else if (subscriptionStatus == 'cancelled') {
      // User cancelled subscription
      buttonText = context.l10n?.dashSubscriptionCancelled ?? 'You Cancelled Your Subscription\nReactivate Your Subscription Now';
      buttonIcon = Icons.restart_alt;
      buttonColor = Colors.orange;
    } else {
      // Fallback (shouldn't reach here based on shouldShowSubscriptionCard logic)
      buttonText = context.l10n?.dashSubscriptionManage ?? 'Manage Subscription';
      buttonIcon = Icons.diamond;
      buttonColor = Colors.grey;
    }
    
    // Use custom card for subscription to handle multi-line text
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Card(
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: InkWell(
          onTap: () {
            debugPrint('🔄 DASHBOARD: Subscription button tapped, attempting direct navigation');
            try {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) {
                    debugPrint('🔄 DASHBOARD: Building SubscriptionScreen directly');
                    return SubscriptionScreenEnhanced(appId: widget.appId);
                  },
                ),
              ).then((result) {
                debugPrint('✅ DASHBOARD: Direct navigation to subscription completed with result: $result');
                // If subscription was updated, trigger a simple state refresh
                if (result == 'subscription_updated') {
                  debugPrint('🔄 DASHBOARD: Refreshing after subscription update');
                  setState(() {}); // Simple refresh to update subscription button text
                }
              }).catchError((error) {
                debugPrint('❌ DASHBOARD: Direct navigation to subscription failed: $error');
              });
            } catch (e) {
              debugPrint('❌ DASHBOARD: Exception during navigation: $e');
            }
          },
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.withOpacity(buttonColor, 0.1),
                  AppColors.withOpacity(buttonColor, 0.05),
                ],
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.withOpacity(buttonColor, 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(buttonIcon, color: buttonColor, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    buttonText,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                      height: 1.3, // Improved line spacing for multi-line text
                    ),
                    maxLines: 2, // Allow up to 2 lines
                    overflow: TextOverflow.visible, // Ensure text shows properly
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
      appBar: AppScreenBar(title: context.l10n?.dashTitle ?? 'Control Center', appId: widget.appId),
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
               // _buildWelcomeSection(user),
                _buildStatsCard(user),
                _buildQuickActions(user),
                const SizedBox(height: 32),

                // 🔧 DEBUG: Apple Test Widget for specific admin only
                if (user.uid == 'KJ8uFnlhKhWgBa4NVcwT') ...[
                  Container(
                    margin: const EdgeInsets.only(top: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.red, width: 2),
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.only(
                              topLeft: Radius.circular(14),
                              topRight: Radius.circular(14),
                            ),
                          ),
                          child: const Text(
                            '🔧 ADMIN DEBUG TOOLS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const AppleNotificationTestWidget(),
                        const GoogleNotificationTestWidget(),

                        // Database Cleanup Section
                        Container(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Divider(thickness: 2, color: Colors.orange),
                              const SizedBox(height: 12),
                              const Text(
                                '🗑️ DATABASE CLEANUP',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Remove all non-admin users and related data (chats, logs, etc.)',
                                style: TextStyle(fontSize: 12, color: Colors.black87),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => _runDatabaseCleanup(dryRun: true),
                                      icon: const Icon(Icons.preview, size: 18),
                                      label: const Text('Preview Cleanup'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.orange,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () {
                                        showDialog(
                                          context: context,
                                          builder: (context) => AlertDialog(
                                            title: const Text('⚠️ WARNING'),
                                            content: const Text(
                                              'This will PERMANENTLY delete all non-admin users and their data. This action cannot be undone!\n\nAre you sure?',
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.of(context).pop(),
                                                child: const Text('Cancel'),
                                              ),
                                              ElevatedButton(
                                                onPressed: () {
                                                  Navigator.of(context).pop();
                                                  _runDatabaseCleanup(dryRun: false);
                                                },
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: Colors.red,
                                                  foregroundColor: Colors.white,
                                                ),
                                                child: const Text('Execute'),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                      icon: const Icon(Icons.delete_forever, size: 18),
                                      label: const Text('Execute Cleanup'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.red,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Divider(thickness: 2, color: Colors.purple),
                              const SizedBox(height: 12),
                              const Text(
                                '🧹 ORPHANED DATA CLEANUP',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.purple,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Remove empty, UUID-based, and orphaned user documents',
                                style: TextStyle(fontSize: 12, color: Colors.black87),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () => _runOrphanedCleanup(dryRun: true),
                                      icon: const Icon(Icons.search, size: 18),
                                      label: const Text('Preview Orphaned'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.deepPurple,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: ElevatedButton.icon(
                                      onPressed: () {
                                        showDialog(
                                          context: context,
                                          builder: (context) => AlertDialog(
                                            title: const Text('⚠️ WARNING'),
                                            content: const Text(
                                              'This will PERMANENTLY delete all orphaned, empty, and UUID-based user documents. This action cannot be undone!\n\nAre you sure?',
                                            ),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.of(context).pop(),
                                                child: const Text('Cancel'),
                                              ),
                                              ElevatedButton(
                                                onPressed: () {
                                                  Navigator.of(context).pop();
                                                  _runOrphanedCleanup(dryRun: false);
                                                },
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: Colors.purple,
                                                  foregroundColor: Colors.white,
                                                ),
                                                child: const Text('Execute'),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                      icon: const Icon(Icons.cleaning_services, size: 18),
                                      label: const Text('Execute Cleanup'),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.purple,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 12),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
