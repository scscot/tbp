import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/user_model.dart';

class AppBottomNavigationBar extends StatelessWidget {
  final int currentIndex;
  final String appId;
  final ValueChanged<int> onTap;

  const AppBottomNavigationBar({
    super.key,
    required this.currentIndex,
    required this.appId,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<UserModel?>(context);

    // Don't show navigation bar if user is not logged in
    if (user == null) {
      return const SizedBox.shrink();
    }

    return BottomNavigationBar(
      currentIndex: currentIndex,
      onTap: onTap,
      type: BottomNavigationBarType.fixed,
      selectedItemColor: Theme.of(context).primaryColor,
      unselectedItemColor: Colors.grey,
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
    );
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
}
