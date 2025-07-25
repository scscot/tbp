// lib/screens/terms_of_service_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../widgets/header_widgets.dart';

class TermsOfServiceScreen extends StatefulWidget {
  final String appId;

  const TermsOfServiceScreen({
    super.key,
    required this.appId,
  });

  @override
  State<TermsOfServiceScreen> createState() => _TermsOfServiceScreenState();
}

class _TermsOfServiceScreenState extends State<TermsOfServiceScreen> {
  static const String legalEmail = 'legal@networkbuildpro.com';
  late final String lastUpdated;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    lastUpdated = '${now.day}/${now.month}/${now.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: widget.appId),
      backgroundColor: AppColors.backgroundPrimary,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
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
                  Icon(
                    Icons.gavel,
                    size: 48,
                    color: AppColors.textInverse,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Terms of Service',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textInverse,
                      letterSpacing: 1.2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Professional Networking Platform Agreement',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textInverse.withValues(alpha: 0.9),
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Last Updated
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.update,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Last Updated: $lastUpdated',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            // IMPORTANT DISCLAIMER - MLM/Network Marketing
            _buildImportantDisclaimer(),
            
            const SizedBox(height: 32),

            // Terms Sections
            _buildSection(
              '1. ACCEPTANCE OF TERMS',
            '''By downloading, installing, accessing, or using the Network Build Pro mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

These Terms constitute a legally binding agreement between you and Network Build Pro regarding your use of our professional networking platform service.''',
            ),

            _buildSection(
              '2. SERVICE DESCRIPTION',
            '''Network Build Pro is a subscription-based professional networking platform that provides:
• Relationship management and tracking tools
• Professional network analytics and insights
• Business opportunity connections
• Systematic networking frameworks
• Communication and collaboration features

The platform operates on a subscription model with a 30-day free trial, followed by a monthly fee of \$4.95 (subject to change with notice).''',
            ),

            _buildSection(
              '3. SUBSCRIPTION TERMS',
            '''BILLING AND PAYMENT:
• 30-day free trial for new users
• Monthly subscription fee of \$4.95 after trial period
• Automatic renewal unless cancelled
• Payment charged to your selected payment method
• Subscription rates subject to change with 30 days notice

CANCELLATION:
• Cancel anytime through account settings
• Cancellation effective at end of current billing period
• No refunds for partial subscription periods
• Account access continues until end of paid period''',
            ),

            _buildSection(
              '4. BUSINESS OPPORTUNITIES',
            '''THIRD-PARTY OPPORTUNITIES:
• Business opportunities are provided by independent companies
• Network Build Pro does not own or operate these businesses
• All business partnerships are separate from Network Build Pro
• Users make independent decisions regarding participation
• Network Build Pro provides connection services only

DISCLAIMER:
• Network Build Pro does not guarantee business success
• All business decisions and outcomes are user responsibility
• Independent evaluation of opportunities is required
• Network Build Pro is not liable for third-party business results''',
            ),

            _buildSection(
              '5. USER RESPONSIBILITIES',
              '''ACCOUNT MANAGEMENT:
• Provide accurate and current information
• Maintain confidentiality of account credentials
• Use the platform in compliance with these Terms
• Respect other users' privacy and rights
• Report violations or inappropriate behavior

PROFESSIONAL CONDUCT:
• Engage in lawful and ethical networking activities
• Maintain professional standards in all communications
• Respect intellectual property rights
• Avoid spam, harassment, or disruptive behavior
• Use platform features as intended''',
            ),


            _buildSection(
              '7. ACCEPTABLE USE',
            '''Users agree to:
• Use the platform for legitimate networking purposes only
• Maintain professional conduct in all interactions
• Comply with applicable laws and regulations
• Provide accurate information during registration
• Respect other users' privacy and rights
• Report violations or inappropriate behavior
• Protect platform security through responsible usage

Users must not engage in spam, harassment, illegal activities, or misuse of platform features.''',
            ),

            _buildSection(
              '8. PROHIBITED ACTIVITIES',
            '''The following activities are strictly prohibited:
• Spam, unsolicited messages, or bulk communications
• Harassment, threats, or abusive behavior
• Impersonation or misrepresentation of identity
• Automated or artificial manipulation of platform features
• Sharing false, misleading, or inaccurate information
• Violation of intellectual property rights
• Any illegal activities or content

Violations may result in account suspension or termination.''',
            ),

            _buildSection(
              '9. INTELLECTUAL PROPERTY',
              '''All content, features, and functionality of Network Build Pro, including but not limited to text, graphics, logos, icons, images, audio clips, and software, are owned by Network Build Pro and protected by copyright, trademark, and other intellectual property laws.

Users may not reproduce, distribute, modify, or create derivative works without explicit written permission.''',
            ),

            _buildSection(
              '10. PRIVACY AND DATA PROTECTION',
              '''Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.

By using Network Build Pro, you consent to the collection and use of information as outlined in our Privacy Policy.''',
            ),

            _buildSection(
              '11. DISCLAIMERS AND LIMITATIONS',
              '''Network Build Pro is provided "AS IS" without warranties of any kind. We disclaim all warranties, express or implied, including but not limited to:
• Merchantability and fitness for a particular purpose
• Non-infringement of third-party rights
• Uninterrupted or error-free service
• Security of data transmission

We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.''',
            ),

            _buildSection(
              '12. INDEMNIFICATION',
              '''You agree to indemnify and hold harmless Network Build Pro, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from:
• Your use of the platform
• Your violation of these Terms
• Your violation of any third-party rights
• Any content you submit or share through the platform''',
            ),

            _buildSection(
              '13. TERMINATION',
              '''We reserve the right to terminate or suspend your account and access to Network Build Pro at any time, with or without notice, for any reason, including violation of these Terms.

Upon termination, your right to use the platform ceases immediately, and we may delete your account and associated data.''',
            ),

            _buildSection(
              '14. GOVERNING LAW',
              '''These Terms are governed by and construed in accordance with the laws of California, without regard to conflict of law principles.

Any disputes arising from these Terms or your use of Network Build Pro shall be resolved in the courts of California.''',
            ),

            _buildSection(
              '15. CHANGES TO TERMS',
              '''We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting in the App.

Your continued use of Network Build Pro after changes are posted constitutes acceptance of the modified Terms.''',
            ),

            _buildSection(
              '16. CONTACT INFORMATION',
              '''For questions about these Terms of Service, please contact us:

Email: $legalEmail
Website: www.networkbuildpro.com

We will respond to all inquiries within 48 hours during business days.''',
            ),

            const SizedBox(height: 32),

            // Footer
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.verified_user,
                    color: AppColors.primary,
                    size: 32,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Apple Store Compliant',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'These Terms of Service meet all Apple App Store guidelines and requirements for platform applications.',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
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

  Widget _buildImportantDisclaimer() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.1),
            AppColors.growthPrimary.withValues(alpha: 0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.info_outline,
                color: AppColors.primary,
                size: 28,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'PROFESSIONAL NETWORKING PLATFORM',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Service Overview',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            '''• Network Build Pro is a subscription-based networking platform
• Users pay a monthly subscription fee for access to networking tools
• The platform provides relationship management and business connection features
• All business opportunities are provided by independent third parties

Network Build Pro operates as a networking platform and does not guarantee business outcomes.''',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textPrimary,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, String content) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
            ),
            child: Text(
              content,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textPrimary,
                height: 1.6,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
