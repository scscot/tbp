// lib/screens/downline_team_screen.dart

import 'package:flutter/material.dart';
import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';
import '../models/user_model.dart';
import '../services/downline_service.dart';
import '../screens/member_detail_screen.dart';
import '../widgets/header_widgets.dart';

// --- ADDED: Helper functions for country data ---
String countryNameToCode(String? countryName) {
  if (countryName == null) return '';
  // This is a simplified map. For a production app, a more robust
  // mapping or a dedicated package would be better.
  final map = {
    'united states': 'US',
    'canada': 'CA',
    'mexico': 'MX',
  };
  return map[countryName.toLowerCase()] ?? countryName;
}

String countryCodeToFlag(String countryCode) {
  if (countryCode.length != 2) return '';
  return countryCode
      .toUpperCase()
      .runes
      .map((e) => e + 127397)
      .map((e) => String.fromCharCode(e))
      .join();
}

enum DownlineFilter {
  all('All Members'),
  last24('Last 24 Hours'),
  last7('Last 7 Days'),
  last30('Last 30 Days'),
  newQualified('Qualified'),
  joinedOpportunity('Joined Opportunity');

  const DownlineFilter(this.displayTitle);
  final String displayTitle;
}

class DownlineTeamScreen extends StatefulWidget {
  final String? initialAuthToken;
  final String appId;

  const DownlineTeamScreen({
    super.key,
    this.initialAuthToken,
    required this.appId,
  });

  @override
  State<DownlineTeamScreen> createState() => _DownlineTeamScreenState();
}

class _DownlineTeamScreenState extends State<DownlineTeamScreen> {
  final DownlineService _downlineService = DownlineService();
  final TextEditingController _searchController = TextEditingController();

  // Note: For the 'Joined Opportunity' filter to work, the UserModel
  // must contain a `bizJoinDate` field, like:
  // final DateTime? bizJoinDate;
  List<UserModel> _filteredDownline = [];
  Map<int, List<UserModel>> _downlineByLevel = {};

  bool _isLoading = true;
  String _searchQuery = '';
  DownlineFilter _selectedFilter = DownlineFilter.all;
  int _levelOffset = 0;
  final Map<DownlineFilter, int> _filterCounts = {
    for (var filter in DownlineFilter.values) filter: 0
  };
  final Set<int> _expandedPanels = {};

  @override
  void initState() {
    super.initState();
    _initializeData();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    if (_searchQuery != _searchController.text) {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
      // Trigger backend filtering instead of local processing
      _fetchFilteredData();
    }
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
      setState(() {
        _levelOffset = userModel.level;
      });
    }

    await _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);

    try {
      // Get counts for filter chips
      final counts = await _downlineService.getDownlineCounts();

      if (!mounted) return;

      // Update filter counts
      setState(() {
        _filterCounts[DownlineFilter.all] = counts['all'] ?? 0;
        _filterCounts[DownlineFilter.last24] = counts['last24'] ?? 0;
        _filterCounts[DownlineFilter.last7] = counts['last7'] ?? 0;
        _filterCounts[DownlineFilter.last30] = counts['last30'] ?? 0;
        _filterCounts[DownlineFilter.newQualified] =
            counts['newQualified'] ?? 0;
        _filterCounts[DownlineFilter.joinedOpportunity] =
            counts['joinedOpportunity'] ?? 0;
      });

      // Fetch filtered data from backend
      await _fetchFilteredData();
    } catch (e) {
      debugPrint('Error fetching downline data: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _fetchFilteredData() async {
    try {
      // Convert filter enum to string
      String filterString;
      switch (_selectedFilter) {
        case DownlineFilter.last24:
          filterString = 'last24';
          break;
        case DownlineFilter.last7:
          filterString = 'last7';
          break;
        case DownlineFilter.last30:
          filterString = 'last30';
          break;
        case DownlineFilter.newQualified:
          filterString = 'newQualified';
          break;
        case DownlineFilter.joinedOpportunity:
          filterString = 'joinedOpportunity';
          break;
        case DownlineFilter.all:
          filterString = 'all';
          break;
      }

      // Use the new backend-optimized filtering
      final result = await _downlineService.getFilteredDownline(
        filter: filterString,
        searchQuery: _searchQuery,
        levelOffset: _levelOffset,
        limit: 1000, // Increase limit for now, can add pagination later
      );

      if (!mounted) return;

      setState(() {
        _filteredDownline = result['downline'] as List<UserModel>;

        // If we have grouped data from backend, use it; otherwise group locally
        final backendGrouped = result['groupedByLevel'];
        if (backendGrouped != null &&
            backendGrouped is Map<int, List<UserModel>>) {
          _downlineByLevel = Map<int, List<UserModel>>.from(backendGrouped);
        } else {
          // Fallback to local grouping if backend doesn't provide it
          _groupDataByLevel();
        }
      });
    } catch (e) {
      debugPrint('Error fetching filtered downline data: $e');
    }
  }

  void _groupDataByLevel() {
    final Map<int, List<UserModel>> grouped = {};
    for (var user in _filteredDownline) {
      final displayLevel = user.level - _levelOffset;
      if (displayLevel > 0 ||
          _selectedFilter == DownlineFilter.newQualified ||
          _selectedFilter == DownlineFilter.joinedOpportunity) {
        grouped.putIfAbsent(displayLevel, () => []).add(user);
      }
    }

    _downlineByLevel = Map.fromEntries(
        grouped.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 8),
            child: Text('Downline Report',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
          ),
          _buildFilterChips(),
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by name, city, state, country...',
                prefixIcon: const Icon(Icons.search, size: 20),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _buildDownlineList(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Wrap(
        spacing: 8.0,
        runSpacing: 8.0,
        children: DownlineFilter.values.map((filter) {
          final isSelected = _selectedFilter == filter;
          final count = _filterCounts[filter] ?? 0;
          return ChoiceChip(
            label: Text('${filter.displayTitle} ($count)'),
            selected: isSelected,
            onSelected: (selected) {
              if (selected) {
                setState(() {
                  _selectedFilter = filter;
                });
                // Trigger backend filtering instead of local processing
                _fetchFilteredData();
              }
            },
            selectedColor: Colors.indigo.shade100,
            labelStyle: TextStyle(
              color: isSelected ? Colors.indigo.shade900 : Colors.black87,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
            side: BorderSide(
              color: isSelected ? Colors.indigo : Colors.grey.shade400,
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildDownlineList() {
    if (_downlineByLevel.isEmpty) {
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
        elevation: 1,
        expandedHeaderPadding: EdgeInsets.zero,
        expansionCallback: (panelIndex, isExpanded) {
          final level = _downlineByLevel.keys.elementAt(panelIndex);
          setState(() {
            if (_expandedPanels.contains(level)) {
              _expandedPanels.remove(level);
            } else {
              _expandedPanels.add(level);
            }
          });
        },
        children: _downlineByLevel.entries.map((entry) {
          final level = entry.key;
          final users = entry.value;
          return ExpansionPanel(
            isExpanded: _expandedPanels.contains(level),
            headerBuilder: (context, isExpanded) {
              return ListTile(
                title: Text(
                  'Level $level',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 16),
                ),
                trailing: Text(
                  '${users.length} Members',
                  style: const TextStyle(color: Colors.grey, fontSize: 14),
                ),
              );
            },
            body: Column(
              children: users.map((user) => _buildUserCard(user)).toList(),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildUserCard(UserModel user) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => MemberDetailScreen(
                userId: user.uid,
                appId: widget.appId,
              ),
            ),
          );
        },
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundImage:
                    user.photoUrl != null && user.photoUrl!.isNotEmpty
                        ? NetworkImage(user.photoUrl!)
                        : null,
                child: user.photoUrl == null || user.photoUrl!.isEmpty
                    ? const Icon(Icons.person, size: 24)
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        style: const TextStyle(
                            fontSize: 15, color: Colors.black87),
                        children: [
                          TextSpan(
                            text:
                                '${user.firstName ?? ''} ${user.lastName ?? ''}',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          if (user.country != null)
                            TextSpan(
                                text:
                                    ' ${countryCodeToFlag(countryNameToCode(user.country!))}'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${user.city ?? ''}, ${user.state ?? ''}${user.country != null && countryNameToCode(user.country!).isNotEmpty ? ' - ${countryNameToCode(user.country!)}' : ''}',
                      style: const TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (user.createdAt != null)
                Text(
                  DateFormat('MMM d, yyyy').format(user.createdAt!),
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
