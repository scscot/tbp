/// Analytics event names for tracking user dashboard interactions.
///
/// These constants should be used with Firebase Analytics to track:
/// - Dashboard screen views
/// - Tile taps
/// - CTA interactions
/// - Stats refresh events
///
/// Example usage:
/// ```dart
/// import 'package:firebase_analytics/firebase_analytics.dart';
/// final analytics = FirebaseAnalytics.instance;
///
/// // Track dashboard view
/// analytics.logEvent(
///   name: DashboardAnalytics.dashView,
///   parameters: {'locale': Localizations.localeOf(context).toLanguageTag()},
/// );
///
/// // Track tile tap
/// analytics.logEvent(
///   name: DashboardAnalytics.dashTileTap,
///   parameters: {'tile': 'getting_started', 'locale': Localizations.localeOf(context).toLanguageTag()},
/// );
///
/// // Track CTA tap
/// analytics.logEvent(
///   name: DashboardAnalytics.dashCtaTap,
///   parameters: {'cta': 'grow_team', 'locale': Localizations.localeOf(context).toLanguageTag()},
/// );
/// ```
class DashboardAnalytics {
  /// Tracks when a user views the dashboard screen.
  ///
  /// **Parameters:**
  /// - `locale`: String - The current locale code ('en', 'es', 'pt', 'tl', 'en_XA')
  ///
  /// **Where to add in Phase 1B PR#2:**
  /// - `lib/screens/dashboard_screen.dart`: In `initState()` or `build()`
  ///
  /// **Example:**
  /// ```dart
  /// @override
  /// void initState() {
  ///   super.initState();
  ///   FirebaseAnalytics.instance.logEvent(
  ///     name: DashboardAnalytics.dashView,
  ///     parameters: {'locale': Localizations.localeOf(context).toLanguageTag()},
  ///   );
  /// }
  /// ```
  static const dashView = 'dash_view';

  /// Tracks when a user taps a dashboard tile.
  ///
  /// **Parameters:**
  /// - `tile`: String - The tile identifier (e.g., 'getting_started', 'opportunity', 'eligibility')
  /// - `locale`: String - The current locale code
  ///
  /// **Tile identifiers:**
  /// - `getting_started`: Getting Started tile
  /// - `opportunity`: Opportunity Details tile
  /// - `eligibility`: Your Eligibility Status tile
  /// - `ai_coach`: Your AI Coach tile
  /// - `how_it_works`: How It Works tile
  /// - `faqs`: FAQ's tile
  /// - `profile`: View Your Profile tile
  /// - `create_account`: Create New Account tile (admin only)
  ///
  /// **Where to add in Phase 1B PR#2:**
  /// - `lib/screens/dashboard_screen.dart`: In each `_buildActionCard()` `onTap` callback
  ///
  /// **Example:**
  /// ```dart
  /// _buildActionCard(
  ///   icon: Icons.rocket_launch,
  ///   title: context.l10n?.dashTileGettingStarted ?? 'Getting Started',
  ///   color: AppColors.opportunityPrimary,
  ///   onTap: () {
  ///     FirebaseAnalytics.instance.logEvent(
  ///       name: DashboardAnalytics.dashTileTap,
  ///       parameters: {'tile': 'getting_started', 'locale': Localizations.localeOf(context).toLanguageTag()},
  ///     );
  ///     widget.onTabSelected?.call(12);
  ///   },
  /// ),
  /// ```
  static const dashTileTap = 'dash_tile_tap';

  /// Tracks when a user taps a dashboard CTA (Call-To-Action).
  ///
  /// **Parameters:**
  /// - `cta`: String - The CTA identifier (e.g., 'grow_team', 'view_team', 'message_center')
  /// - `locale`: String - The current locale code
  ///
  /// **CTA identifiers:**
  /// - `grow_team`: Grow Your Team CTA
  /// - `view_team`: View Your Team CTA
  /// - `message_center`: Message Center CTA
  /// - `notifications`: Notifications CTA
  /// - `refresh_stats`: Refresh team stats button
  ///
  /// **Where to add in Phase 1B PR#2:**
  /// - `lib/screens/dashboard_screen.dart`: In each CTA `onTap` callback
  ///
  /// **Example:**
  /// ```dart
  /// _buildActionCard(
  ///   icon: Icons.trending_up,
  ///   title: context.l10n?.dashTileGrowTeam ?? 'Grow Your Team',
  ///   color: AppColors.growthPrimary,
  ///   onTap: () {
  ///     FirebaseAnalytics.instance.logEvent(
  ///       name: DashboardAnalytics.dashCtaTap,
  ///       parameters: {'cta': 'grow_team', 'locale': Localizations.localeOf(context).toLanguageTag()},
  ///     );
  ///     widget.onTabSelected?.call(2);
  ///   },
  /// ),
  /// ```
  static const dashCtaTap = 'dash_cta_tap';

  /// Tracks when a user refreshes team statistics.
  ///
  /// **Parameters:**
  /// - `method`: String - The refresh method ('manual' or 'realtime')
  /// - `locale`: String - The current locale code
  /// - `success`: bool - Whether the refresh succeeded
  ///
  /// **Where to add in Phase 1B PR#2:**
  /// - `lib/screens/dashboard_screen.dart`:
  ///   - In `_refreshNetworkCounts()` (manual refresh)
  ///   - In `_onRealtimeCountsChanged()` (realtime update)
  ///
  /// **Example:**
  /// ```dart
  /// Future<void> _refreshNetworkCounts() async {
  ///   try {
  ///     final counts = await _networkService.refreshNetworkCounts();
  ///     FirebaseAnalytics.instance.logEvent(
  ///       name: DashboardAnalytics.dashStatsRefresh,
  ///       parameters: {'method': 'manual', 'locale': Localizations.localeOf(context).toLanguageTag(), 'success': true},
  ///     );
  ///     // ... success handling ...
  ///   } catch (e) {
  ///     FirebaseAnalytics.instance.logEvent(
  ///       name: DashboardAnalytics.dashStatsRefresh,
  ///       parameters: {'method': 'manual', 'locale': Localizations.localeOf(context).toLanguageTag(), 'success': false},
  ///     );
  ///     // ... error handling ...
  ///   }
  /// }
  /// ```
  static const dashStatsRefresh = 'dash_stats_refresh';

  /// Tracks when a user interacts with empty state CTAs.
  ///
  /// **Parameters:**
  /// - `state`: String - The empty state type (e.g., 'no_team', 'no_messages')
  /// - `action`: String - The CTA action taken
  /// - `locale`: String - The current locale code
  ///
  /// **Where to add in future phases:**
  /// - Empty states in dashboard when no team members exist
  /// - Empty states when no messages/notifications exist
  ///
  /// **Example:**
  /// ```dart
  /// // Future implementation
  /// _buildEmptyState(
  ///   message: context.l10n?.dashEmptyTeam ?? 'No team members yet',
  ///   ctaText: context.l10n?.dashCtaInvite ?? 'Invite Members',
  ///   onTap: () {
  ///     FirebaseAnalytics.instance.logEvent(
  ///       name: DashboardAnalytics.dashEmptyStateCta,
  ///       parameters: {'state': 'no_team', 'action': 'invite', 'locale': Localizations.localeOf(context).toLanguageTag()},
  ///     );
  ///     // Navigate to share screen...
  ///   },
  /// );
  /// ```
  static const dashEmptyStateCta = 'dash_empty_state_cta';
}

/// Helper extension for analytics in dashboard screens.
///
/// **Usage in Phase 1B PR#2:**
/// ```dart
/// // Add these imports at the top of dashboard_screen.dart
/// import 'package:firebase_analytics/firebase_analytics.dart';
/// import '../i18n/dashboard_analytics.dart';
///
/// // In the screen widget
/// final analytics = FirebaseAnalytics.instance;
///
/// // Track events using the constants above
/// analytics.logEvent(name: DashboardAnalytics.dashView, parameters: {...});
/// ```
