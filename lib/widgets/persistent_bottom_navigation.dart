import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';
import '../screens/dashboard_screen.dart';
import '../screens/message_center_screen.dart';
import '../screens/share_screen.dart';
import '../screens/profile_screen.dart';

class PersistentBottomNavigation extends StatefulWidget {
  final String appId;
  final Widget child;

  const PersistentBottomNavigation({
    super.key,
    required this.appId,
    required this.child,
  });

  @override
  State<PersistentBottomNavigation> createState() => _PersistentBottomNavigationState();
}

class _PersistentBottomNavigationState extends State<PersistentBottomNavigation> {
  int _currentIndex = 0;

  late final List<Widget> screens;

  @override
  void initState() {
    super.initState();

    /* screens = [
      DashboardScreen(appId: widget.appId),
      MessageCenterScreen(appId: widget.appId),
      ShareScreen(appId: widget.appId),
      ProfileScreen(appId: widget.appId),
    ]; */

    screens = [
      DashboardScreen(
        appId: widget.appId,
        onTabSelected: _onItemTapped, // <-- make sure this is wired
      ),
      MessageCenterScreen(appId: widget.appId),
      ShareScreen(appId: widget.appId),
      ProfileScreen(appId: widget.appId),
    ];


  }

  void _onItemTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  Widget _buildProfileIcon(UserModel user) {
    if (user.photoUrl != null && user.photoUrl!.isNotEmpty) {
      return Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          image: DecorationImage(
            image: NetworkImage(user.photoUrl!),
            fit: BoxFit.cover,
          ),
        ),
      );
    }
    return const Icon(Icons.person);
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);
    
    if (user == null) {
      return widget.child;
    }

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: _onItemTapped,
            type: BottomNavigationBarType.fixed,
            selectedItemColor: Theme.of(context).primaryColor,
            unselectedItemColor: Colors.grey,
            backgroundColor: Colors.white,
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.home),
                label: 'Home',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.message),
                label: 'Messages',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.share),
                label: 'Share',
              ),
              BottomNavigationBarItem(
                icon: _buildProfileIcon(user),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
