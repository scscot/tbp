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

enum ViewMode { grid, list, analytics }

enum FilterBy { allMembers, newMembers, qualifiedMembers, joinedMembers }

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

    await _fetchData();
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
    if (_filterBy == FilterBy.newMembers) {
      final last24h = DateTime.now().subtract(const Duration(hours: 24));
      filtered = filtered
          .where((m) => m.createdAt != null && m.createdAt!.isAfter(last24h))
          .toList();
    } else if (_filterBy == FilterBy.qualifiedMembers) {
      filtered =
          filtered.where((m) => (m.directSponsorCount ?? 0) >= 3).toList();
    } else if (_filterBy == FilterBy.joinedMembers) {
      filtered = filtered
          .where((m) => m.bizOppRefUrl != null && m.bizOppRefUrl!.isNotEmpty)
          .toList();
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
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.indigo.shade600, Colors.indigo.shade400],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Text(
        'Team Analytics',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: Colors.white,
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
              'Total Team',
              _analytics['totalMembers']?.toString() ?? '0',
              Icons.people,
              Colors.blue,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildAnalyticsCard(
              'Direct Sponsors',
              _analytics['directSponsors']?.toString() ?? '0',
              Icons.person_add,
              Colors.green,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _buildAnalyticsCard(
              'New Members',
              _analytics['newMembers']?.toString() ?? '0',
              Icons.trending_up,
              Colors.orange,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyticsCard(
      String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            spreadRadius: 1,
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
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
              color: Colors.black,
              fontWeight: FontWeight.w500,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
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
              fillColor: Colors.grey.shade100,
            ),
          ),
          const SizedBox(height: 12),
          // Professional dropdown filter
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300),
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
                      color: Colors.black87,
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
    final adminSettings = Provider.of<AdminSettingsModel?>(context, listen: false);
    final bizOppName = adminSettings?.bizOpp ?? 'biz_opp';
    
    switch (filter) {
      case FilterBy.allMembers:
        return 'All Members (${_analytics['totalMembers'] ?? _allMembers.length})';
      case FilterBy.newMembers:
        return 'New Members (${_analytics['newMembers'] ?? 0})';
      case FilterBy.qualifiedMembers:
        return 'Qualified Members (${_analytics['qualified'] ?? 0})';
      case FilterBy.joinedMembers:
        return 'Joined $bizOppName (${_analytics['withOpportunity'] ?? 0})';
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
                  color: Colors.blue,
                  decoration: TextDecoration.underline,
                  decorationColor: Colors.blue,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                '${member.city ?? ''}, ${member.state ?? ''}',
                style: const TextStyle(color: Colors.black, fontSize: 12),
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
            style: const TextStyle(fontSize: 16, color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: ExpansionPanelList(
        elevation: 0,
        expandedHeaderPadding: EdgeInsets.zero,
        expansionCallback: (panelIndex, isExpanded) {
          final level = _membersByLevel.keys.elementAt(panelIndex);
          setState(() {
            if (_expandedPanels.contains(level)) {
              _expandedPanels.remove(level);
            } else {
              _expandedPanels.add(level);
            }
          });
        },
        children: _membersByLevel.entries.map((entry) {
          final level = entry.key;
          final users = entry.value;
          return ExpansionPanel(
            isExpanded: _expandedPanels.contains(level),
            headerBuilder: (context, isExpanded) {
              return ListTile(
                title: Text(
                  'Level $level',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 18),
                ),
                trailing: Text(
                  '${users.length} Members',
                  style: const TextStyle(color: Colors.black, fontSize: 14),
                ),
              );
            },
            body: Column(
              children:
                  users.map((user) => _buildMemberListCard(user)).toList(),
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
                        color: Colors.blue,
                        decoration: TextDecoration.underline,
                        decorationColor: Colors.blue,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${member.city ?? ''}, ${member.state ?? ''}, ${member.country ?? ''}',
                      style: const TextStyle(color: Colors.black),
                    ),
                    if (member.createdAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Joined ${DateFormat('MMM d, yyyy').format(member.createdAt!)}',
                        style:
                            const TextStyle(color: Colors.black, fontSize: 12),
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
                    color: Colors.green.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Qualified',
                    style: TextStyle(
                      color: Colors.green.shade700,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Center(
        child: Text(
          'Performance Chart\n(Chart implementation would go here)',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
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
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation(Colors.indigo.shade400),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
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
                    color: Colors.indigo.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      'L${entry.key}',
                      style: TextStyle(
                        color: Colors.indigo.shade700,
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
                  style: const TextStyle(color: Colors.grey),
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
