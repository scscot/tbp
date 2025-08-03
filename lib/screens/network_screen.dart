// lib/screens/network_screen.dart
// Professional UI redesign with modern layouts and enhanced reporting

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../services/network_service.dart';
import '../screens/member_detail_screen.dart';
import '../widgets/header_widgets.dart';
import '../config/app_colors.dart';

enum ViewMode { grid, list, analytics }

enum FilterBy {
  selectReport,
  allMembers,
  directSponsors,
  newMembers,
  qualifiedMembers,
  joinedMembers
}

enum SortBy { name, joinDate, level, location }

class NetworkScreen extends StatefulWidget {
  final String appId;
  final String? initialFilter;

  const NetworkScreen({
    super.key,
    required this.appId,
    this.initialFilter,
  });

  @override
  State<NetworkScreen> createState() => _NetworkScreenState();
}

class _NetworkScreenState extends State<NetworkScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  final NetworkService _networkService = NetworkService();
  final TextEditingController _searchController = TextEditingController();

  final List<UserModel> _allMembers = [];
  List<UserModel> _filteredMembers = [];
  final Map<int, List<UserModel>> _membersByLevel = {};

  bool _isLoading = true;
  // ignore: prefer_final_fields
  ViewMode _currentView = ViewMode.list;
  FilterBy _filterBy = FilterBy.selectReport;
  final SortBy _sortBy = SortBy.joinDate;
  String _searchQuery = '';
  final Set<int> _expandedPanels = {};
  int _levelOffset = 0;

  // Analytics data
  Map<String, dynamic> _analytics = {};

  // Business opportunity name
  String _bizOppName = 'biz_opp';

  // Pagination state
  bool _hasMoreData = false;
  bool _isLoadingMore = false;
  int _currentOffset = 0;
  int _pageSize = 1000;
  int _totalNetworkSize = 0;
  bool _useIntelligentPagination = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);

    // Set initial filter based on notification parameter
    if (widget.initialFilter != null) {
      switch (widget.initialFilter) {
        case 'newMembers':
          _filterBy = FilterBy.newMembers;
          break;
        case 'directSponsors':
          _filterBy = FilterBy.directSponsors;
          break;
        case 'qualifiedMembers':
          _filterBy = FilterBy.qualifiedMembers;
          break;
        case 'joinedMembers':
          _filterBy = FilterBy.joinedMembers;
          break;
        default:
          _filterBy = FilterBy.allMembers;
      }
    }

    _initializeData();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {
      _searchQuery = _searchController.text.toLowerCase();

      // Auto-load "All Members" data if user is searching but no report is selected
      if (_searchQuery.isNotEmpty && _filterBy == FilterBy.selectReport) {
        _filterBy = FilterBy.allMembers;
        if (kDebugMode) {
          debugPrint(
              '🔍 SEARCH: Auto-loading All Members for search query: "$_searchQuery"');
        }
      }

      _applyFiltersAndSort();
    });
  }

  Future<void> _initializeData() async {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    final userDoc = await FirebaseFirestore.instance
        .collection('users')
        .doc(authUser.uid)
        .get();
    if (!mounted) return;

    if (userDoc.exists) {
      final userModel = UserModel.fromFirestore(userDoc);
      _levelOffset = userModel.level;
    }

    // Fetch business opportunity name
    await _fetchBizOppName();

    await _fetchData();
  }

  Future<void> _fetchBizOppName() async {
    try {
      final authUser = FirebaseAuth.instance.currentUser;
      if (authUser != null) {
        final currentUserDoc = await FirebaseFirestore.instance
            .collection('users')
            .doc(authUser.uid)
            .get();

        if (currentUserDoc.exists) {
          final userData = currentUserDoc.data();
          final uplineAdmin = userData?['upline_admin'] as String?;
          debugPrint(
              '🔍 BIZ_OPP DEBUG: Current user upline_admin: $uplineAdmin');

          if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
            // Get admin settings for the upline admin
            final adminSettingsDoc = await FirebaseFirestore.instance
                .collection('admin_settings')
                .doc(uplineAdmin)
                .get();

            if (adminSettingsDoc.exists) {
              final data = adminSettingsDoc.data();
              final bizOpp = data?['biz_opp'] as String?;
              debugPrint('🔍 BIZ_OPP DEBUG: Admin settings data: $data');
              debugPrint('🔍 BIZ_OPP DEBUG: biz_opp field: $bizOpp');

              if (bizOpp != null && bizOpp.isNotEmpty) {
                setState(() {
                  _bizOppName = bizOpp;
                });
                debugPrint(
                    '🔍 BIZ_OPP DEBUG: Set bizOppName from admin settings: $_bizOppName');
                return;
              }
            } else {
              debugPrint(
                  '🔍 BIZ_OPP DEBUG: Admin settings document does not exist for admin: $uplineAdmin');
            }
          }

          // Fallback: try to get bizOpp from current user's data
          final userBizOpp = userData?['bizOpp'] as String?;
          debugPrint('🔍 BIZ_OPP DEBUG: Current user bizOpp: $userBizOpp');

          if (userBizOpp != null && userBizOpp.isNotEmpty) {
            setState(() {
              _bizOppName = userBizOpp;
            });
            debugPrint(
                '🔍 BIZ_OPP DEBUG: Set bizOppName from current user: $_bizOppName');
            return;
          }
        }
      }

      debugPrint(
          '🔍 BIZ_OPP DEBUG: No bizOpp found, using default: $_bizOppName');
    } catch (e) {
      debugPrint('🔍 BIZ_OPP DEBUG: Error fetching biz opp name: $e');
    }
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);

    try {
      // Get counts for analytics
      final counts = await _networkService.getNetworkCounts();
      if (!mounted) return;

      _totalNetworkSize = counts['all'] ?? 0;
      debugPrint('🔍 PAGINATION DEBUG: Total network size: $_totalNetworkSize');

      // Determine pagination strategy based on network size
      _determineOptimalPaginationStrategy();

      // Reset pagination state
      _currentOffset = 0;
      _allMembers.clear();

      // Load initial data
      await _loadMoreData();

      _calculateAnalytics(counts);
      _applyFiltersAndSort();
    } catch (e) {
      debugPrint('Error loading team data: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _determineOptimalPaginationStrategy() {
    if (_totalNetworkSize <= 2000) {
      // Small network: Load all data at once
      _useIntelligentPagination = false;
      _pageSize = _totalNetworkSize + 100; // Add buffer
      debugPrint('🔍 PAGINATION DEBUG: Small network - loading all $_pageSize members');
    } else if (_totalNetworkSize <= 5000) {
      // Medium network: Use moderate pagination
      _useIntelligentPagination = true;
      _pageSize = 1500;
      debugPrint('🔍 PAGINATION DEBUG: Medium network - using pagination with $_pageSize per page');
    } else {
      // Large network: Use aggressive pagination
      _useIntelligentPagination = true;
      _pageSize = 1000;
      debugPrint('🔍 PAGINATION DEBUG: Large network - using aggressive pagination with $_pageSize per page');
    }
  }

  Future<void> _loadMoreData() async {
    if (_isLoadingMore) return;

    setState(() => _isLoadingMore = true);

    try {
      final result = await _networkService.getFilteredNetwork(
        filter: 'all',
        searchQuery: '',
        levelOffset: _levelOffset,
        limit: _pageSize,
        offset: _currentOffset,
      );

      final newMembers = result['network'] as List<UserModel>;
      final totalCount = result['totalCount'] as int? ?? _totalNetworkSize;

      if (mounted) {
        setState(() {
          _allMembers.addAll(newMembers);
          _currentOffset += newMembers.length;
          _hasMoreData = _allMembers.length < totalCount && newMembers.isNotEmpty;
        });

        debugPrint('🔍 PAGINATION DEBUG: Loaded ${newMembers.length} more members');
        debugPrint('🔍 PAGINATION DEBUG: Total loaded: ${_allMembers.length}/$totalCount');
        debugPrint('🔍 PAGINATION DEBUG: Has more data: $_hasMoreData');
      }
    } catch (e) {
      debugPrint('Error loading more data: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  /// Force refresh data (bypasses cache)
  Future<void> _refreshData() async {
    try {
      debugPrint('🔄 REFRESH: Force refreshing network data...');

      // Force refresh counts and network data
      final counts = await _networkService.refreshNetworkCounts();
      if (!mounted) return;

      _totalNetworkSize = counts['all'] ?? 0;
      _determineOptimalPaginationStrategy();

      // Reset pagination state
      _currentOffset = 0;
      _allMembers.clear();

      // Load initial data with refresh
      await _loadMoreDataWithRefresh();

      _calculateAnalytics(counts);
      _applyFiltersAndSort();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Network data refreshed'),
            duration: Duration(seconds: 2),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error refreshing team data: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Error refreshing data: $e'),
            duration: const Duration(seconds: 3),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadMoreDataWithRefresh() async {
    if (_isLoadingMore) return;

    setState(() => _isLoadingMore = true);

    try {
      final result = await _networkService.refreshFilteredNetwork(
        filter: 'all',
        searchQuery: '',
        levelOffset: _levelOffset,
        limit: _pageSize,
        offset: _currentOffset,
      );

      final newMembers = result['network'] as List<UserModel>;
      final totalCount = result['totalCount'] as int? ?? _totalNetworkSize;

      if (mounted) {
        setState(() {
          _allMembers.addAll(newMembers);
          _currentOffset += newMembers.length;
          _hasMoreData = _allMembers.length < totalCount && newMembers.isNotEmpty;
        });

        debugPrint('🔄 REFRESH DEBUG: Loaded ${newMembers.length} members');
        debugPrint('🔄 REFRESH DEBUG: Total loaded: ${_allMembers.length}/$totalCount');
      }
    } catch (e) {
      debugPrint('Error refreshing more data: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  void _calculateAnalytics(Map<String, dynamic> counts) {
    // --- REVISED: Use the server-provided counts directly ---
    _analytics = {
      'totalMembers': counts['all'] ?? 0,
      'directSponsors': counts['directSponsors'] ?? 0, // From new backend logic
      'newMembers':
          counts['last24'] ?? 0, // Use the 'last24' count from backend
      'qualified': counts['newQualified'] ?? 0,
      'withOpportunity': counts['joinedOpportunity'] ?? 0,
    };

    debugPrint('🔍 ANALYTICS DEBUG: Final analytics from server: $_analytics');
  }

  void _applyFiltersAndSort() {
    List<UserModel> filtered = List.from(_allMembers);

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((member) {
        final name =
            '${member.firstName ?? ''} ${member.lastName ?? ''}'.toLowerCase();
        final location =
            '${member.city ?? ''} ${member.state ?? ''} ${member.country ?? ''}'
                .toLowerCase();
        return name.contains(_searchQuery) || location.contains(_searchQuery);
      }).toList();
    }

    // Apply filtering based on filter type
    if (_filterBy == FilterBy.selectReport) {
      // Clear filtered members when no report is selected AND no search query
      if (_searchQuery.isEmpty) {
        filtered = [];
      }
      // If there's a search query, we keep the filtered results from search
    } else if (_filterBy == FilterBy.directSponsors) {
      // Filter for direct sponsors (users who have current user as sponsor)
      final currentUserId = FirebaseAuth.instance.currentUser?.uid;
      debugPrint('🔍 DIRECT SPONSORS DEBUG: Current user ID: $currentUserId');
      debugPrint('🔍 DIRECT SPONSORS DEBUG: Total members to filter: ${filtered.length}');
      
      if (currentUserId != null) {
        // Debug: Check first few members' sponsor IDs
        for (int i = 0; i < math.min(5, filtered.length); i++) {
          final member = filtered[i];
          debugPrint('🔍 DIRECT SPONSORS DEBUG: Member ${i + 1}: ${member.firstName} ${member.lastName}, sponsorId: "${member.sponsorId}", matches: ${member.sponsorId == currentUserId}');
        }
        
        filtered = filtered.where((m) => m.sponsorId == currentUserId).toList();
        debugPrint('🔍 DIRECT SPONSORS DEBUG: After filtering: ${filtered.length} members');
        
        // If we're using pagination and found no results, suggest loading more data
        if (filtered.isEmpty && _useIntelligentPagination && _hasMoreData) {
          debugPrint('🔍 DIRECT SPONSORS DEBUG: No results found, but more data available. Consider loading more.');
        }
      } else {
        debugPrint('🔍 DIRECT SPONSORS DEBUG: No current user ID, clearing filtered list');
        filtered = [];
      }
    } else if (_filterBy == FilterBy.newMembers) {
      final now = DateTime.now();
      final sinceYesterday = DateTime(now.year, now.month, now.day - 1, 0, 1);
      filtered = filtered
          .where((m) =>
              m.createdAt != null &&
              m.createdAt!.isAfter(sinceYesterday) &&
              m.photoUrl != null)
          .toList();
    } else if (_filterBy == FilterBy.qualifiedMembers) {
      filtered = filtered.where((m) => m.qualifiedDate != null).toList();
    } else if (_filterBy == FilterBy.joinedMembers) {
      debugPrint('🔍 JOINED MEMBERS DEBUG: Total members to filter: ${filtered.length}');
      
      // Debug: Check first few members' bizJoinDate
      for (int i = 0; i < math.min(5, filtered.length); i++) {
        final member = filtered[i];
        debugPrint('🔍 JOINED MEMBERS DEBUG: Member ${i + 1}: ${member.firstName} ${member.lastName}, bizJoinDate: ${member.bizJoinDate}, hasJoinDate: ${member.bizJoinDate != null}');
      }
      
      filtered = filtered.where((m) => m.bizJoinDate != null).toList();
      debugPrint('🔍 JOINED MEMBERS DEBUG: After filtering: ${filtered.length} members');
      
      // If we're using pagination and found no results, suggest loading more data
      if (filtered.isEmpty && _useIntelligentPagination && _hasMoreData) {
        debugPrint('🔍 JOINED MEMBERS DEBUG: No results found, but more data available. Consider loading more.');
      }
    }

    // Apply sorting (default descending by join date)
    filtered.sort((a, b) {
      int comparison = 0;
      switch (_sortBy) {
        case SortBy.name:
          final nameA = '${a.firstName ?? ''} ${a.lastName ?? ''}';
          final nameB = '${b.firstName ?? ''} ${b.lastName ?? ''}';
          comparison = nameA.compareTo(nameB);
          break;
        case SortBy.joinDate:
          comparison = (a.createdAt ?? DateTime(2000))
              .compareTo(b.createdAt ?? DateTime(2000));
          break;
        case SortBy.level:
          comparison = (a.level).compareTo(b.level);
          break;
        case SortBy.location:
          final locA = '${a.country ?? ''} ${a.state ?? ''} ${a.city ?? ''}';
          final locB = '${b.country ?? ''} ${b.state ?? ''} ${b.city ?? ''}';
          comparison = locA.compareTo(locB);
          break;
      }
      return -comparison; // Default descending order
    });

    setState(() {
      _filteredMembers = filtered;
      _groupMembersByLevel();
    });
  }

  void _groupMembersByLevel() {
    _membersByLevel.clear();

    for (var member in _filteredMembers) {
      // Calculate display level relative to current user
      final displayLevel = member.level - _levelOffset;

      // Only show levels > 0 (members below current user)
      if (displayLevel > 0) {
        _membersByLevel.putIfAbsent(displayLevel, () => []).add(member);
      }
    }

    // Debug logging
    debugPrint(
        '🔍 team DEBUG: Total filtered members: ${_filteredMembers.length}');
    debugPrint('🔍 team DEBUG: Level offset: $_levelOffset');
    debugPrint('🔍 team DEBUG: Members by level: $_membersByLevel');

    // Ensure levels are sorted
    final sortedEntries = _membersByLevel.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    _membersByLevel.clear();
    for (var entry in sortedEntries) {
      _membersByLevel[entry.key] = entry.value;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: Column(
        children: [
          _buildHeader(),
          _buildAnalyticsCards(),
          _buildControlsBar(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _refreshData,
                    child: _buildContent(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        gradient: AppColors.primaryGradient,
      ),
      child: const Text(
        'Your Global Network',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: AppColors.textInverse,
        ),
      ),
    );
  }

  Widget _buildAnalyticsCards() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: _buildAnalyticsCard(
              'Direct Sponsors',
              _analytics['directSponsors']?.toString() ?? '0',
              Icons.person_add,
              AppColors.growthPrimary,
              onTap: () {
                setState(() {
                  _filterBy = FilterBy.directSponsors;
                });
                _applyFiltersAndSort();
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildAnalyticsCard(
              'Total Team',
              _analytics['totalMembers']?.toString() ?? '0',
              Icons.people,
              AppColors.teamPrimary,
              onTap: () {
                setState(() {
                  _filterBy = FilterBy.allMembers;
                });
                _applyFiltersAndSort();
              },
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildAnalyticsCard(
              'New Members',
              _analytics['newMembers']?.toString() ?? '0',
              Icons.trending_up,
              AppColors.opportunityPrimary,
              onTap: () {
                setState(() {
                  _filterBy = FilterBy.newMembers;
                });
                _applyFiltersAndSort();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyticsCard(
      String title, String value, IconData icon, Color color,
      {VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(8),
          boxShadow: AppColors.lightShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildControlsBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Search bar with cache info
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search team members...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              _onSearchChanged();
                            },
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    filled: true,
                    fillColor: AppColors.backgroundSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Cache refresh button
              IconButton(
                onPressed: _refreshData,
                icon: const Icon(Icons.refresh),
                tooltip: 'Force refresh data',
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                  foregroundColor: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Professional dropdown filter
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButton<FilterBy>(
              value: _filterBy,
              isExpanded: true,
              underline: const SizedBox(),
              icon: const Icon(Icons.keyboard_arrow_down),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              items: FilterBy.values.map((filter) {
                final displayName = _getFilterDisplayName(filter);
                return DropdownMenuItem(
                  value: filter,
                  child: Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 16,
                      color: AppColors.textPrimary,
                    ),
                  ),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) {
                  setState(() => _filterBy = value);
                  _applyFiltersAndSort();
                }
              },
            ),
          ),
        ],
      ),
    );
  }

  String _getFilterDisplayName(FilterBy filter) {
    // Use the directly fetched business opportunity name
    // debugPrint('🔍 FILTER DEBUG: Using bizOppName: $_bizOppName');

    switch (filter) {
      case FilterBy.selectReport:
        return 'View Team Report';
      case FilterBy.allMembers:
        return 'All Members (${_analytics['totalMembers'] ?? _allMembers.length})';
      case FilterBy.directSponsors:
        return 'Direct Sponsors (${_analytics['directSponsors'] ?? 0})';
      case FilterBy.newMembers:
        return 'New Members (${_analytics['newMembers'] ?? 0})';
      case FilterBy.qualifiedMembers:
        return 'Qualified Members (${_analytics['qualified'] ?? 0})';
      case FilterBy.joinedMembers:
        return 'Joined $_bizOppName (${_analytics['withOpportunity'] ?? 0})';
    }
  }

  Widget _buildContent() {
    switch (_currentView) {
      case ViewMode.grid:
        return _buildGridView();
      case ViewMode.list:
        return _buildExpandableLevelView();
      case ViewMode.analytics:
        return _buildAnalyticsView();
    }
  }

  Widget _buildGridView() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: GridView.builder(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.8,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: _filteredMembers.length,
        itemBuilder: (context, index) {
          return _buildMemberGridCard(_filteredMembers[index]);
        },
      ),
    );
  }

  Widget _buildMemberGridCard(UserModel member) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => _navigateToMemberDetail(member),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundImage: member.photoUrl?.isNotEmpty == true
                    ? NetworkImage(member.photoUrl!)
                    : null,
                child: member.photoUrl?.isEmpty != false
                    ? const Icon(Icons.person, size: 30)
                    : null,
              ),
              const SizedBox(height: 12),
              Text(
                '${member.firstName ?? ''} ${member.lastName ?? ''}',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: AppColors.teamPrimary,
                  decoration: TextDecoration.underline,
                  decorationColor: AppColors.teamPrimary,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                '${member.city ?? ''}, ${member.state ?? ''}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildExpandableLevelView() {
    if (_membersByLevel.isEmpty) {
      String message;
      if (_filterBy == FilterBy.selectReport && _searchQuery.isEmpty) {
        message =
            'Select a report from the dropdown above or use the search bar to view and manage your team.';
      } else if (_searchQuery.isNotEmpty) {
        message = _filterBy == FilterBy.selectReport
            ? 'Showing search results from All Members. No members match your search.'
            : 'No members match your search.';
      } else {
        message = 'No members found for this filter.';
      }

      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                message,
                style: const TextStyle(
                    fontSize: 16, color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              if (_filterBy == FilterBy.selectReport &&
                  _searchQuery.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    'Searching in: All Members',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: Column(
        children: [
          // Show search context indicator when searching without explicit report selection
          if (_filterBy == FilterBy.allMembers && _searchQuery.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border:
                    Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Showing search results from All Members',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          
          // Show pagination info for large networks
          if (_useIntelligentPagination) ...[
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Showing ${_allMembers.length} of $_totalNetworkSize members',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          ..._membersByLevel.entries.map((entry) {
            final level = entry.key;
            final users = entry.value;
            final isExpanded = _expandedPanels.contains(level);

            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              elevation: 2,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
              child: Column(
                children: [
                  InkWell(
                    onTap: () {
                      setState(() {
                        if (_expandedPanels.contains(level)) {
                          _expandedPanels.remove(level);
                        } else {
                          _expandedPanels.add(level);
                        }
                      });
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Level $level',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 18),
                            ),
                          ),
                          Text(
                            '${users.length} Members',
                            style: const TextStyle(
                                color: AppColors.textSecondary, fontSize: 14),
                          ),
                          const SizedBox(width: 8),
                          Icon(
                            isExpanded ? Icons.expand_less : Icons.expand_more,
                            color: AppColors.primary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (isExpanded)
                    Column(
                      children: users
                          .map((user) => _buildMemberListCard(user))
                          .toList(),
                    ),
                ],
              ),
            );
          }),

          // Load More button for paginated data
          if (_useIntelligentPagination && _hasMoreData) ...[
            Container(
              margin: const EdgeInsets.all(16),
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoadingMore ? null : () async {
                  await _loadMoreData();
                  _applyFiltersAndSort();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _isLoadingMore
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          ),
                          SizedBox(width: 8),
                          Text('Loading more members...'),
                        ],
                      )
                    : Text('Load More Members (${_totalNetworkSize - _allMembers.length} remaining)'),
              ),
            ),
          ],

          // Show completion message when all data is loaded
          if (_useIntelligentPagination && !_hasMoreData && _allMembers.isNotEmpty) ...[
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: 16,
                    color: Colors.green,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'All ${_allMembers.length} members loaded',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.green,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMemberListCard(UserModel member) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: () => _navigateToMemberDetail(member),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 25,
                backgroundImage: member.photoUrl?.isNotEmpty == true
                    ? NetworkImage(member.photoUrl!)
                    : null,
                child: (member.photoUrl == null || member.photoUrl!.isEmpty)
                    ? const Icon(Icons.person)
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${member.firstName ?? ''} ${member.lastName ?? ''}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.teamPrimary,
                        decoration: TextDecoration.underline,
                        decorationColor: AppColors.teamPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${member.city ?? ''}, ${member.state ?? ''}, ${member.country ?? ''}',
                      style: const TextStyle(color: AppColors.textSecondary),
                    ),
                    if (member.createdAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Joined ${DateFormat('MMM d, yyyy').format(member.createdAt!)}',
                        style: const TextStyle(
                            color: AppColors.textTertiary, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAnalyticsView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Network Performance',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildPerformanceChart(),
          const SizedBox(height: 24),
          const Text(
            'Geographic Distribution',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildGeographicBreakdown(),
          const SizedBox(height: 24),
          const Text(
            'Level Distribution',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildLevelBreakdown(),
        ],
      ),
    );
  }

  Widget _buildPerformanceChart() {
    return Container(
      height: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppColors.mediumShadow,
      ),
      child: const Center(
        child: Text(
          'Performance Chart\n(Chart implementation would go here)',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary),
        ),
      ),
    );
  }

  Widget _buildGeographicBreakdown() {
    final countryGroups = <String, int>{};
    for (var member in _filteredMembers) {
      final country = member.country ?? 'Unknown';
      countryGroups[country] = (countryGroups[country] ?? 0) + 1;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: countryGroups.entries.map((entry) {
          final percentage =
              (entry.value / _filteredMembers.length * 100).round();
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(entry.key),
                ),
                Expanded(
                  flex: 5,
                  child: LinearProgressIndicator(
                    value: entry.value / _filteredMembers.length,
                    backgroundColor: AppColors.backgroundTertiary,
                    valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  ),
                ),
                const SizedBox(width: 8),
                Text('${entry.value} ($percentage%)'),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLevelBreakdown() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: _membersByLevel.entries.map((entry) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primaryExtraLight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      'L${entry.key}',
                      style: const TextStyle(
                        color: AppColors.primaryDark,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    'Level ${entry.key}',
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ),
                Text(
                  '${entry.value.length} members',
                  style: const TextStyle(color: AppColors.textSecondary),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  void _navigateToMemberDetail(UserModel member) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => MemberDetailScreen(
          userId: member.uid,
          appId: widget.appId,
        ),
      ),
    );
  }
}
