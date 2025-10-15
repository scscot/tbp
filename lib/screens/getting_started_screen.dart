import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../config/app_colors.dart';
import '../widgets/header_widgets.dart';
import '../models/user_model.dart';
import 'share_screen.dart';

class GettingStartedScreen extends StatefulWidget {
  final String appId;

  const GettingStartedScreen({
    super.key,
    required this.appId,
  });

  @override
  State<GettingStartedScreen> createState() => _GettingStartedScreenState();
}

class _GettingStartedScreenState extends State<GettingStartedScreen>
    with TickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  String _bizOppName = 'your opportunity';

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
    _loadBizOppName();
    _animationController.forward();
  }

  Future<void> _loadBizOppName() async {
    try {
      final authUser = FirebaseAuth.instance.currentUser;
      if (authUser != null) {
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(authUser.uid)
            .get();
        if (doc.exists) {
          final user = UserModel.fromFirestore(doc);
          if (user.bizOppRefUrl != null && user.bizOppRefUrl!.isNotEmpty) {
            final adminDoc = await FirebaseFirestore.instance
                .collection('admin_settings')
                .doc(user.uplineAdmin)
                .get();
            if (adminDoc.exists) {
              final data = adminDoc.data();
              final bizOpp = data?['biz_opp'] as String?;

              if (bizOpp != null && bizOpp.isNotEmpty) {
                if (mounted) {
                  setState(() {
                    _bizOppName = bizOpp;
                  });
                }
                return;
              }
            }
          }
        }
      }
    } catch (e) {
      // Fallback to default
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppScreenBar(
        title: 'Getting Started',
        appId: widget.appId,
      ),
      body: FadeTransition(
        opacity: _fadeAnimation,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
                      Text(
                        'Getting Started with Team Build Pro',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Follow these simple steps to start building your team',
                        style: TextStyle(
                          fontSize: 16,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Step 1
                      _buildStepCard(
                        stepNumber: 1,
                        title: 'Make Your List',
                        description:
                            'Create a list of recruiting prospects and current $_bizOppName team members you want to share Team Build Pro with. Think about who could benefit from this tool to accelerate their team building.',
                        color: AppColors.primary,
                      ),
                      const SizedBox(height: 20),

                      // Step 2
                      _buildStepCard(
                        stepNumber: 2,
                        title: 'Share with Your Network',
                        description:
                            'Use the Share feature to quickly and easily send targeted text messages and emails to your recruiting prospects and $_bizOppName team members.',
                        color: AppColors.secondary,
                        actionButton: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    ShareScreen(appId: widget.appId),
                              ),
                            );
                          },
                          icon: const Icon(Icons.share),
                          label: const Text('Open Share'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.secondary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Step 3
                      _buildStepCard(
                        stepNumber: 3,
                        title: 'Welcome Your New Team Members',
                        description:
                            'When you receive a new team member notification, follow up immediately to welcome them to your team. First impressions matter!',
                        color: AppColors.opportunityPrimary,
                      ),
                      const SizedBox(height: 32),

                      // Bottom tip card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.lightbulb_outline,
                              color: AppColors.primary,
                              size: 32,
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Pro Tip',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Consistent follow-up and engagement are key to building a strong, active team.',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepCard({
    required int stepNumber,
    required String title,
    required String description,
    required Color color,
    Widget? actionButton,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    '$stepNumber',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            description,
            style: TextStyle(
              fontSize: 15,
              height: 1.5,
              color: AppColors.textSecondary,
            ),
          ),
          if (actionButton != null) ...[
            const SizedBox(height: 16),
            actionButton,
          ],
        ],
      ),
    );
  }
}
