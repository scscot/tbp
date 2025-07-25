// lib/screens/privacy_policy_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/header_widgets.dart';
import '../config/app_colors.dart';

class PrivacyPolicyScreen extends StatefulWidget {
  final String appId;

  const PrivacyPolicyScreen({
    super.key,
    required this.appId,
  });

  @override
  State<PrivacyPolicyScreen> createState() => _PrivacyPolicyScreenState();
}

class _PrivacyPolicyScreenState extends State<PrivacyPolicyScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _launchEmail() async {
    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: 'privacy@networkbuildpro.com ',
      query: 'subject=Privacy Policy Inquiry',
    );
    
    if (await canLaunchUrl(emailUri)) {
      await launchUrl(emailUri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open email client. Please contact privacy@networkbuildpro.com '),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Widget _buildSection({
    required String title,
    required String content,
    IconData? icon,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: AppColors.lightShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  color: AppColors.primary,
                  size: 24,
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            content,
            style: const TextStyle(
              fontSize: 15,
              height: 1.6,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHighlightBox({
    required String title,
    required String content,
    Color? backgroundColor,
    Color? borderColor,
    IconData? icon,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.infoBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: borderColor ?? AppColors.info.withOpacity(0.3),
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  color: borderColor ?? AppColors.info,
                  size: 24,
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: borderColor ?? AppColors.info,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            content,
            style: const TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      backgroundColor: AppColors.backgroundSecondary,
      body: SingleChildScrollView(
        controller: _scrollController,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Section
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppColors.mediumShadow,
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.privacy_tip,
                    size: 48,
                    color: AppColors.textInverse,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Privacy Policy',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textInverse,
                      letterSpacing: 0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Last Updated: ${DateTime.now().month}/${DateTime.now().day}/${DateTime.now().year}',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textInverse.withOpacity(0.9),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Important Notice
            _buildHighlightBox(
              title: 'Your Privacy Matters',
              content: 'Network Build Pro is committed to protecting your privacy and personal information. This policy explains how we collect, use, and safeguard your data as part of our professional networking platform, in compliance with Apple App Store guidelines and applicable privacy laws.',
              icon: Icons.shield_outlined,
              backgroundColor: AppColors.successBackground,
              borderColor: AppColors.success,
            ),

            // Information We Collect
            _buildSection(
              title: '1. Information We Collect',
              icon: Icons.info_outline,
              content: '''We collect the following types of information:

Personal Information:
• Name (first and last name)
• Email address
• Profile photo (optional)
• Country/location information

Account Information:
• User authentication data (managed by Firebase Auth)
• Account preferences and settings
• Referral codes and network structure data

Usage Information:
• App usage analytics (non-personal)
• Device information (iOS version, device type)
• Crash reports and performance data

Communication Data:
• Messages sent through our in-app messaging system
• Network communications and interactions
• Notifications and alerts you receive''',
            ),

            // How We Use Your Information
            _buildSection(
              title: '2. How We Use Your Information',
              icon: Icons.settings_outlined,
              content: '''We use your information for the following purposes:

Service Provision:
• Create and manage your professional networking account
• Enable network building and network features
• Facilitate communication between network members
• Send important notifications about your account and network

App Improvement:
• Analyze app usage to improve functionality
• Fix bugs and enhance user experience
• Develop new features based on user needs

Legal Compliance:
• Comply with applicable laws and regulations
• Respond to legal requests when required
• Protect against fraud and abuse''',
            ),

            // Information Sharing
            _buildSection(
              title: '3. Information Sharing and Disclosure',
              icon: Icons.share_outlined,
              content: '''We do not sell your personal information. We may share information in these limited circumstances:

Within Your Network:
• Your name and profile photo are visible to your network members
• Network relationships are shared within your network structure

Service Providers:
• Firebase (Google) for authentication and database services
• Apple for in-app purchases and subscriptions
• Cloud Functions for app functionality

Legal Requirements:
• When required by law or legal process
• To protect our rights or the safety of users
• In case of business transfer or merger

We never share your email address or personal contact information with other users or third parties for marketing purposes.''',
            ),

            // Data Security
            _buildSection(
              title: '4. Data Security',
              icon: Icons.security_outlined,
              content: '''We implement industry-standard security measures:

Technical Safeguards:
• Encryption of data in transit and at rest
• Secure Firebase authentication system
• Regular security updates and monitoring

Access Controls:
• Limited access to personal data by authorized personnel only
• Multi-factor authentication for administrative access
• Regular security audits and assessments

Data Retention:
• We retain your data only as long as necessary for service provision
• You can request account deletion at any time
• Deleted accounts are permanently removed within 30 days''',
            ),

            // Your Rights and Choices
            _buildSection(
              title: '5. Your Rights and Choices',
              icon: Icons.account_circle_outlined,
              content: '''You have the following rights regarding your personal information:

Access and Control:
• View and update your profile information
• Download your personal data
• Delete your account and associated data

Privacy Settings:
• Control who can see your profile information
• Manage notification preferences
• Opt out of non-essential communications

Data Portability:
• Export your network and network structure data
• Transfer your information to another service (where applicable)

To exercise these rights, contact us at privacy@networkbuildpro.com  or use the in-app settings.''',
            ),

            // Apple-Specific Privacy
            _buildHighlightBox(
              title: 'Apple Privacy Compliance',
              content: 'This professional networking app complies with Apple\'s App Store privacy requirements. We use Apple\'s In-App Purchase system for subscriptions and do not collect payment information directly. All data collection is transparent and with your consent.',
              icon: Icons.apple,
              backgroundColor: AppColors.backgroundTertiary,
              borderColor: AppColors.textSecondary,
            ),

            // Children's Privacy
            _buildSection(
              title: '6. Children\'s Privacy',
              icon: Icons.child_care_outlined,
              content: '''Network Build Pro is intended for users 18 years and older. We do not knowingly collect personal information from children under 18.

If we discover that we have collected information from a child under 18:
• We will delete the information immediately
• We will terminate the account
• We will notify the parents/guardians if possible

Parents who believe their child has provided information to us should contact privacy@networkbuildpro.com  immediately.''',
            ),

            // International Users
            _buildSection(
              title: '7. International Data Transfers',
              icon: Icons.public_outlined,
              content: '''Network Build Pro is available globally. Your information may be transferred to and processed in:

• United States (Firebase/Google servers)
• Other countries where our service providers operate

We ensure appropriate safeguards are in place for international transfers:
• Standard contractual clauses
• Adequacy decisions where applicable
• Your explicit consent for transfers

All transfers comply with applicable data protection laws including GDPR and CCPA.''',
            ),

            // Updates to Policy
            _buildSection(
              title: '8. Changes to This Privacy Policy',
              icon: Icons.update_outlined,
              content: '''We may update this Privacy Policy from time to time. When we make changes:

• We will notify you through the app
• We will update the "Last Updated" date
• Significant changes will require your consent
• You can review the current policy anytime in the app

Continued use of the app after changes constitutes acceptance of the updated policy.''',
            ),

            // Contact Information
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppColors.growthGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: AppColors.mediumShadow,
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.contact_support,
                    size: 40,
                    color: AppColors.textInverse,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Contact Us',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textInverse,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Questions about this Privacy Policy?',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textInverse,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _launchEmail,
                    icon: const Icon(Icons.email, size: 20),
                    label: const Text(
                      'privacy@networkbuildpro.com ',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.textInverse,
                      foregroundColor: AppColors.growthPrimary,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Network Build Pro\nPrivacy Officer\nResponse within 48 hours',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textInverse.withOpacity(0.9),
                      fontWeight: FontWeight.w400,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Footer
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Text(
                    '© ${DateTime.now().year} Network Build Pro. All rights reserved.',
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'This Privacy Policy is effective as of the date listed above and applies to all users of the Network Build Pro mobile application.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                      fontWeight: FontWeight.w400,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
