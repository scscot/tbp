// lib/screens/downline_team_screen.dart
// Professional UI redesign with modern layouts and enhanced reporting

import 'package:flutter/material.dart';
import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../models/admin_settings_model.dart';
import '../services/downline_service.dart';
import '../screens/member_detail_screen.dart';
import '../widgets/header_widgets.dart';
import '../config/app_colors.dart';

enum ViewMode { grid, list, analytics }

enum FilterBy { allMembers, directSponsors, newMembers, qualifiedMembers, joinedMembers }

enum SortBy { name, joinDate, level, location }

class DownlineTeamScreen extends StatefulWidget {
  final String appId;

  const DownlineTeamScreen({
    super.key,
    required this.appId,
  });

  @override
  State<DownlineTeamScreen> createState() => _DownlineTeamScreenState();
}

class _DownlineTeamScreenState extends State<DownlineTeamScreen>
    with TickerProviderStateMixin {
  late TabController _tabController;
  final DownlineService _downlineService = DownlineService();
  final TextEditingController _searchController = TextEditingController();

  List<UserModel> _allMembers = [];
  List<UserModel> _filteredMembers = [];
  final Map<int, List<UserModel>> _membersByLevel = {};

  bool _isLoading = true;
  ViewMode _currentView = ViewMode.list;
  FilterBy _filterBy = FilterBy.allMembers;
  final SortBy _sortBy = SortBy.joinDate;
  String _searchQuery = '';
  final Set<int> _expandedPanels = {};
  int _levelOffset = 0;

  // Analytics data
  Map<String, dynamic> _analytics = {};
  
  // Business opportunity name
  String _bizOppName = 'biz_opp';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
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
          final userData = currentUserDoc.data() as Map<String, dynamic>?;
          final uplineAdmin = userData?['upline_admin'] as String?;
          debugPrint('🔍 BIZ_OPP DEBUG: Current user upline_admin: $uplineAdmin');
          
          if (uplineAdmin != null && uplineAdmin.isNotEmpty) {
            // Get admin settings for the upline admin
            final adminSettingsDoc = await FirebaseFirestore.instance
                .collection('admin_settings')
                .doc(uplineAdmin)
                .get();

            if (adminSettingsDoc.exists) {
              final data = adminSettingsDoc.data() as Map<String, dynamic>?;
              final bizOpp = data?['biz_opp'] as String?;
              debugPrint('🔍 BIZ_OPP DEBUG: Admin settings data: $data');
              debugPrint('🔍 BIZ_OPP DEBUG: biz_opp field: $bizOpp');
              
              if (bizOpp != null && bizOpp.isNotEmpty) {
                setState(() {
                  _bizOppName = bizOpp;
                });
                debugPrint('🔍 BIZ_OPP DEBUG: Set bizOppName from admin settings: $_bizOppName');
                return;
              }
            } else {
              debugPrint('🔍 BIZ_OPP DEBUG: Admin settings document does not exist for admin: $uplineAdmin');
            }
          }
          
          // Fallback: try to get bizOpp from current user's data
          final userBizOpp = userData?['bizOpp'] as String?;
          debugPrint('🔍 BIZ_OPP DEBUG: Current user bizOpp: $userBizOpp');
          
          if (userBizOpp != null && userBizOpp.isNotEmpty) {
            setState(() {
              _bizOppName = userBizOpp;
            });
            debugPrint('🔍 BIZ_OPP DEBUG: Set bizOppName from current user: $_bizOppName');
            return;
          }
        }
      }
      
      debugPrint('🔍 BIZ_OPP DEBUG: No bizOpp found, using default: $_bizOppName');
    } catch (e) {
      debugPrint('🔍 BIZ_OPP DEBUG: Error fetching biz opp name: $e');
    }
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);

    try {
      // Get counts for analytics
      final counts = await _downlineService.getDownlineCounts();

      if (!mounted) return;

      // Fetch all downline data
      final result = await _downlineService.getFilteredDownline(
        filter: 'all',
        searchQuery: '',
        levelOffset: _levelOffset,
        limit: 1000,
      );

      _allMembers = result['downline'] as List<UserModel>;
      _calculateAnalytics(counts);
      _applyFiltersAndSort();
    } catch (e) {
      debugPrint('Error loading downline data: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          // Force rebuild of dropdown with updated analytics
        });
      }
    }
  }

  void _calculateAnalytics(Map<String, dynamic> counts) {
    // Calculate direct sponsors from the actual member data since backend doesn't provide level1 count
    final directSponsorsCount = _allMembers.where((m) => 
      (m.level - _levelOffset) == 1
    ).length;
    
    // Use backend counts for accurate analytics
    _analytics = {
      'totalMembers': counts['all'] ?? 0,
      'directSponsors': directSponsorsCount, // Calculate from actual data
      'newMembers': counts['last24'] ?? 0,
      'qualified': counts['newQualified'] ?? 0,
      'withOpportunity': counts['joinedOpportunity'] ?? 0,
    };
    
    debugPrint('🔍 ANALYTICS DEBUG: Backend counts: $counts');
    debugPrint('🔍 ANALYTICS DEBUG: Direct sponsors calculated: $directSponsorsCount');
    debugPrint('🔍 ANALYTICS DEBUG: All members count: ${_allMembers.length}');
    debugPrint('🔍 ANALYTICS DEBUG: Final analytics: $_analytics');
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
    if (_filterBy == FilterBy.directSponsors) {
      // Filter for direct sponsors (level 1 relative to current user)
      filtered = filtered
          .where((m) => (m.level - _levelOffset) == 1)
          .toList();
    } else if (_filterBy == FilterBy.newMembers) {
      final last24h = DateTime.now().subtract(const Duration(hours: 24));
      filtered = filtered
          .where((m) => m.createdAt != null && m.createdAt!.isAfter(last24h))
          .toList();
    } else if (_filterBy == FilterBy.qualifiedMembers) {
      filtered = filtered.where((m) => m.qualifiedDate != null).toList();
    } else if (_filterBy == FilterBy.joinedMembers) {
      filtered = filtered.where((m) => m.bizJoinDate != null).toList();

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
    debugPrint('🔍 DOWNLINE DEBUG: Total filtered members: ${_filteredMembers.length}');
    debugPrint('🔍 DOWNLINE DEBUG: Level offset: $_levelOffset');
    debugPrint('🔍 DOWNLINE DEBUG: Members by level: $_membersByLevel');
    
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
                : _buildContent(),
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
        'Downline Team',
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
      String title, String value, IconData icon, Color color, {VoidCallback? onTap}) {
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
          // Search bar
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search members...',
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
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
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
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Text(
            _searchQuery.isNotEmpty
                ? 'No members match your search.'
                : 'No members found for this filter.',
            style: const TextStyle(fontSize: 16, color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: Column(
        children: _membersByLevel.entries.map((entry) {
          final level = entry.key;
          final users = entry.value;
          final isExpanded = _expandedPanels.contains(level);
          
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
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
                    children: users.map((user) => _buildMemberListCard(user)).toList(),
                  ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMemberListCard(UserModel member) {
    // Calculate display level relative to current user
    final displayLevel = member.level - _levelOffset;
    
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
                        style:
                            const TextStyle(color: AppColors.textTertiary, fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ),
              if ((member.directSponsorCount ?? 0) >= 3)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.successBackground,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Qualified',
                    style: const TextStyle(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
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
            'Team Performance',
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
