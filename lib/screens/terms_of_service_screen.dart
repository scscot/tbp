// lib/screens/terms_of_service_screen.dart

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/app_colors.dart';
import '../widgets/header_widgets.dart';

class TermsOfServiceScreen extends StatelessWidget {
  final String appId;

  const TermsOfServiceScreen({
    super.key,
    required this.appId,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeaderWithMenu(appId: appId),
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
                    'Team Build Pro Platform Agreement',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppColors.textInverse.withOpacity(0.9),
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
                    'Last Updated: ${DateTime.now().day}/${DateTime.now().month}/${DateTime.now().year}',
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
              '''By downloading, installing, accessing, or using the Team Build Pro mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

These Terms constitute a legally binding agreement between you and Team Build Pro regarding your use of our team-building platform service.''',
            ),

            _buildSection(
              '2. DESCRIPTION OF SERVICE',
              '''Team Build Pro is a subscription-based team-building platform designed to help users:
• Build and manage referral networks
• Track community growth and development
• Connect with potential companies
• Receive notifications about community activities

SUBSCRIPTION MODEL: Team Build Pro operates on a subscription basis with a 30-day free trial period, followed by a monthly subscription fee (currently planned at \$4.99/month, subject to change).

IMPORTANT: Team Build Pro is NOT a business opportunity, MLM company, network marketing company, or income-generating platform. We are solely a team-building tool and platform.''',
            ),

            _buildSection(
              '3. NO COMPENSATION OR EARNINGS',
              '''Team Build Pro does NOT:
• Pay users any money, commissions, or compensation
• Provide income opportunities or earnings potential
• Guarantee financial returns or business success
• Operate as a multi-level marketing (MLM) business
• Function as a network marketing company
• Offer investment or financial products

Users understand that Team Build Pro is a subscription-based platform service that charges users a monthly fee. We do not provide monetary compensation of any kind to users.''',
            ),

            _buildSection(
              '4. MLM/NETWORK MARKETING DISCLAIMER',
              '''Team Build Pro explicitly disclaims any association with:
• Multi-Level Marketing (MLM) companies
• Network Marketing businesses
• Pyramid schemes or similar structures
• Direct sales companies
• Any business opportunity that promises income

We are NOT affiliated with, endorsed by, or connected to any MLM, network marketing, or direct sales organization. Our platform simply helps users organize and track their referral networks for legitimate business purposes.

Any business opportunities presented to users come from third-party companies that are completely separate from Team Build Pro.''',
            ),

            _buildSection(
              '5. THIRD-PARTY BUSINESS OPPORTUNITIES',
              '''Team Build Pro may facilitate introductions to legitimate third-party business opportunities. However:
• These opportunities are NOT owned or operated by Team Build Pro
• We do not endorse, guarantee, or take responsibility for third-party businesses
• Users must conduct their own due diligence before joining any business opportunity
• Team Build Pro receives no compensation from third-party businesses
• All business relationships are directly between users and third-party companies''',
            ),

            _buildSection(
              '6. SUBSCRIPTION TERMS AND BILLING',
              '''SUBSCRIPTION MODEL:
• Team Build Pro operates on a subscription basis
• New users receive a 30-day free trial period
• After the trial period, users are charged a monthly subscription fee
• Current planned subscription rate: \$4.99/month (subject to change)
• Subscription fees are charged automatically to your payment method

BILLING TERMS:
• Subscriptions automatically renew monthly unless cancelled
• Users can cancel their subscription at any time through their account settings
• Cancellation takes effect at the end of the current billing period
• No refunds are provided for partial months of service
• Subscription rates may change with 30 days advance notice

TRIAL PERIOD:
• The 30-day free trial begins when you first register your account
• No payment method is required during the trial period
• You will be notified before the trial period ends
• If you do not subscribe, your account will be deactivated after the trial''',
            ),

            _buildSection(
              '7. USER RESPONSIBILITIES',
              '''Users agree to:
• Use the platform for legitimate team-building purposes only
• Not misrepresent Team Build Pro as a business opportunity
• Comply with all applicable laws and regulations
• Not use the platform for illegal activities
• Respect other users' privacy and rights
• Provide accurate information when registering
• Not attempt to circumvent platform security measures''',
            ),

            _buildSection(
              '8. PROHIBITED ACTIVITIES',
              '''Users may NOT:
• Represent Team Build Pro as an MLM or income opportunity
• Use the platform to promote illegal schemes
• Spam or harass other users
• Share false or misleading information
• Attempt to hack or compromise the platform
• Use automated tools to manipulate the system
• Violate any applicable laws or regulations''',
            ),

            _buildSection(
              '9. INTELLECTUAL PROPERTY',
              '''All content, features, and functionality of Team Build Pro, including but not limited to text, graphics, logos, icons, images, audio clips, and software, are owned by Team Build Pro and protected by copyright, trademark, and other intellectual property laws.

Users may not reproduce, distribute, modify, or create derivative works without explicit written permission.''',
            ),

            _buildSection(
              '10. PRIVACY AND DATA PROTECTION',
              '''Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.

By using Team Build Pro, you consent to the collection and use of information as outlined in our Privacy Policy.''',
            ),

            _buildSection(
              '11. DISCLAIMERS AND LIMITATIONS',
              '''Team Build Pro is provided "AS IS" without warranties of any kind. We disclaim all warranties, express or implied, including but not limited to:
• Merchantability and fitness for a particular purpose
• Non-infringement of third-party rights
• Uninterrupted or error-free service
• Security of data transmission

We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.''',
            ),

            _buildSection(
              '12. INDEMNIFICATION',
              '''You agree to indemnify and hold harmless Team Build Pro, its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from:
• Your use of the platform
• Your violation of these Terms
• Your violation of any third-party rights
• Any content you submit or share through the platform''',
            ),

            _buildSection(
              '13. TERMINATION',
              '''We reserve the right to terminate or suspend your account and access to Team Build Pro at any time, with or without notice, for any reason, including violation of these Terms.

Upon termination, your right to use the platform ceases immediately, and we may delete your account and associated data.''',
            ),

            _buildSection(
              '14. GOVERNING LAW',
              '''These Terms are governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to conflict of law principles.

Any disputes arising from these Terms or your use of Team Build Pro shall be resolved in the courts of [Your Jurisdiction].''',
            ),

            _buildSection(
              '15. CHANGES TO TERMS',
              '''We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting in the App.

Your continued use of Team Build Pro after changes are posted constitutes acceptance of the modified Terms.''',
            ),

            _buildSection(
              '16. CONTACT INFORMATION',
              '''For questions about these Terms of Service, please contact us:

Email: legal@teambuildpro.com
Website: www.teambuildpro.com

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
            AppColors.error.withOpacity(0.1),
            AppColors.warning.withOpacity(0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.error, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.warning,
                color: AppColors.error,
                size: 28,
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'IMPORTANT DISCLAIMER',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.error,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Team Build Pro is NOT an MLM, Network Marketing, or Multi-Level Marketing Business',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            '''• Team Build Pro does NOT pay users any money or compensation
• We are NOT a business opportunity or income-generating platform
• We are NOT affiliated with any MLM or network marketing company
• We do NOT operate as a pyramid scheme or similar structure
• We are a subscription-based team-building platform and organizational tool
• Users pay US a monthly subscription fee - we do NOT pay users

Team Build Pro helps users organize referral networks for legitimate business purposes only. Any business opportunities come from separate third-party companies that are completely independent from Team Build Pro.''',
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
              border: Border.all(color: AppColors.border.withOpacity(0.5)),
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
