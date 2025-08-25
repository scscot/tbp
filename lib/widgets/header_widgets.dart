import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_model.dart';
import '../config/app_colors.dart';
import '../widgets/navigation_shell.dart';
import '../screens/profile_screen.dart';
import '../screens/notifications_screen.dart';

// Notification Badge Widget with unread count
class NotificationBadge extends StatelessWidget {
  final String appId;

  const NotificationBadge({
    super.key,
    required this.appId,
  });

  @override
  Widget build(BuildContext context) {
    final authUser = FirebaseAuth.instance.currentUser;
    if (authUser == null) return const SizedBox.shrink();

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('users')
          .doc(authUser.uid)
          .collection('notifications')
          .where('read', isEqualTo: false)
          .snapshots(),
      builder: (context, snapshot) {
        final unreadCount = snapshot.hasData ? snapshot.data!.docs.length : 0;
        
        return GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => NotificationsScreen(appId: appId),
              ),
            );
          },
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            child: Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  child: const Icon(
                    Icons.notifications_outlined,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                if (unreadCount > 0)
                  Positioned(
                    right: 2,
                    top: 2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 20,
                        minHeight: 20,
                      ),
                      child: Text(
                        unreadCount.toString(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// Entry screen header: Groups Icon + "Team Build Pro" (left justified)
class EntryAppBar extends StatelessWidget implements PreferredSizeWidget {
  const EntryAppBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      automaticallyImplyLeading: false,
      elevation: 0,
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withValues(alpha: 0.9),
              AppColors.secondary.withValues(alpha: 0.7),
            ],
          ),
        ),
      ),
      title: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.groups,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 12),
          const Text(
            'Team Build Pro',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
      centerTitle: false,
    );
  }
}

// Tab screen header: Screen Title (centered) + Notifications Badge + Profile Image (right) - NO back arrow
class TabScreenBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? appId;
  final List<Widget>? actions;

  const TabScreenBar({
    super.key,
    required this.title,
    this.appId,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      automaticallyImplyLeading: false, // No back arrow for tab screens
      elevation: 0,
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withValues(alpha: 0.9),
              AppColors.secondary.withValues(alpha: 0.7),
            ],
          ),
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      actions: actions ?? [
        Consumer<UserModel?>(
          builder: (context, user, child) {
            return GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProfileScreen(appId: appId ?? 'default'),
                  ),
                );
              },
              child: Container(
                margin: const EdgeInsets.only(right: 16),
                child: CircleAvatar(
                  radius: 18,
                  backgroundImage: user?.photoUrl != null && user!.photoUrl!.isNotEmpty
                      ? NetworkImage(user.photoUrl!)
                      : null,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  child: user?.photoUrl == null || user!.photoUrl!.isEmpty
                      ? const Icon(Icons.person, color: Colors.white, size: 20)
                      : null,
                ),
              ),
            );
          },
        ),
      ],
      centerTitle: true,
    );
  }
}

// App screen header: Back Arrow (left) + Screen Title (centered) + Profile Image (right)
class AppScreenBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? appId;
  final List<Widget>? actions;

  const AppScreenBar({
    super.key,
    required this.title,
    this.appId,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false, // Disable automatic back arrow
      iconTheme: const IconThemeData(color: Colors.white),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: Colors.white),
        onPressed: () {
          if (Navigator.canPop(context)) {
            Navigator.pop(context);
          } else {
            // For tab screens with no navigation stack, navigate to dashboard
            final navigationShell = context.findAncestorStateOfType<NavigationShellState>();
            navigationShell?.handleCommand(0); // Navigate to dashboard
          }
        },
      ),
      flexibleSpace: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withValues(alpha: 0.9),
              AppColors.secondary.withValues(alpha: 0.7),
            ],
          ),
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      actions: actions ?? [
        Consumer<UserModel?>(
          builder: (context, user, child) {
            return GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ProfileScreen(appId: appId ?? 'default'),
                  ),
                );
              },
              child: Container(
                margin: const EdgeInsets.only(right: 16),
                child: CircleAvatar(
                  radius: 18,
                  backgroundImage: user?.photoUrl != null && user!.photoUrl!.isNotEmpty
                      ? NetworkImage(user.photoUrl!)
                      : null,
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  child: user?.photoUrl == null || user!.photoUrl!.isEmpty
                      ? const Icon(Icons.person, color: Colors.white, size: 20)
                      : null,
                ),
              ),
            );
          },
        ),
      ],
      centerTitle: true,
    );
  }
}

// Legacy widgets for backward compatibility - use EntryAppBar and AppScreenBar instead
class AppHeaderWithMenu extends StatelessWidget implements PreferredSizeWidget {
  final String appId;
  final UserModel? user;

  const AppHeaderWithMenu({super.key, required this.appId, this.user});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return const EntryAppBar();
  }
}

class PrimaryAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;

  const PrimaryAppBar({
    super.key,
    required this.title,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppScreenBar(title: title, appId: 'legacy', actions: actions);
  }
}