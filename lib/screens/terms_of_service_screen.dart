// lib/screens/terms_of_service_screen.dart

// ignore_for_file: deprecated_member_use

import 'package:flutter/material.dart';
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
            '''By downloading, installing, accessing, or using the Network Build Pro mobile application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

These Terms constitute a legally binding agreement between you and Network Build Pro regarding your use of our professional networking platform service.''',
            ),

            _buildSection(
              '2. DESCRIPTION OF SERVICE',
            '''Network Build Pro is a premium subscription-based professional networking platform designed to help users:
• Build and cultivate meaningful business relationships
• Develop thriving professional networks
• Connect with business opportunities
• Receive insights about network growth and engagement
• Access tools for systematic relationship building

SUBSCRIPTION MODEL: Network Build Pro operates on a subscription basis with a 30-day free trial period, followed by a monthly subscription fee of \$4.95/month (subject to change).

PLATFORM FOCUS: Network Build Pro specializes in authentic professional relationship building, helping users expand their networks and discover business ventures through genuine connections.''',
            ),

            _buildSection(
              '3. SUBSCRIPTION VALUE AND FEATURES',
            '''Your monthly subscription provides access to premium features including:
• Advanced relationship management and tracking tools
• Professional network analytics and insights
• Business venture opportunity matching
• Systematic relationship development frameworks
• Premium networking functionality

SUBSCRIPTION VALUE: Your investment provides ongoing access to cutting-edge tools, resources, and opportunities that facilitate meaningful business relationships and professional growth.

MEASURABLE RESULTS: Our platform delivers tangible value through enhanced networking capabilities, strategic connections, and business opportunities that drive real professional advancement.''',
            ),

            _buildSection(
              '4. PLATFORM LEADERSHIP AND PARTNERSHIPS',
            '''Network Build Pro leads the industry through:
• Cutting-edge relationship management technology
• Systematic networking methodologies
• Premium business connections
• Advanced analytics and insights
• Industry-leading tools and resources

INDUSTRY LEADERSHIP: We set the standard for authentic professional relationship building, helping users develop meaningful connections through proven strategies and innovative features.

THIRD-PARTY PARTNERSHIPS: Business opportunities are provided by independent, established companies that maintain separate operations and partnerships with our members.''',
            ),

            _buildSection(
              '5. COLLABORATIVE BUSINESS VENTURES',
              '''Network Build Pro excels at connecting professionals with premium business opportunities through our advanced networking platform:

VENTURE FACILITATION:
• Curated access to established, legitimate business collaborations
• Strategic partnerships with industry-leading companies
• Quality-focused opportunity matching based on professional qualifications
• Comprehensive vetting process for all ventures
• Ongoing support for successful partnership development

PROFESSIONAL AUTONOMY:
• Users maintain complete decision-making authority over business partnerships
• Full transparency in all opportunity presentations
• Independent evaluation and selection of business ventures
• Direct relationship building between users and business partners
• Professional guidance throughout the partnership evaluation process

QUALITY STANDARDS: Network Build Pro maintains rigorous standards for business ventures, ensuring all opportunities meet our professional networking excellence criteria and provide genuine value for qualified professionals.''',
            ),

            _buildSection(
              '6. SUBSCRIPTION TERMS AND BILLING',
              '''SUBSCRIPTION MODEL:
• Network Build Pro operates on a subscription basis
• New users receive a 30-day free trial period
• After the trial period, users are charged a monthly subscription fee
• Current subscription rate: \$4.95/month (subject to change)
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
              '7. USER COMMITMENTS',
            '''As members of the Network Build Pro community, users commit to:
• Maximize the platform's capabilities for legitimate relationship building
• Accurately represent Network Build Pro as a premium networking platform
• Maintain the highest standards of professional conduct and legal compliance
• Foster a positive environment for all members
• Protect fellow members' privacy, confidentiality, and professional rights
• Provide complete and accurate information during registration
• Safeguard platform security through responsible and ethical usage

PLATFORM EXCELLENCE: These commitments ensure Network Build Pro maintains its position as the premier networking platform where meaningful business relationships and opportunities thrive.''',
            ),

            _buildSection(
              '8. CONDUCT STANDARDS',
            '''Network Build Pro maintains high professional standards. Users are expected to:
• Use the platform exclusively for legitimate networking and relationship building
• Respect fellow members and maintain courteous communication
• Share accurate and truthful information in all interactions
• Protect platform security and integrity through responsible usage
• Engage authentically without automated or artificial manipulation
• Comply with all applicable laws and regulations

PLATFORM INTEGRITY: These standards ensure Network Build Pro remains a premium environment where meaningful business relationships can flourish and opportunities can develop successfully.''',
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
              '''These Terms are governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to conflict of law principles.

Any disputes arising from these Terms or your use of Network Build Pro shall be resolved in the courts of [Your Jurisdiction].''',
            ),

            _buildSection(
              '15. CHANGES TO TERMS',
              '''We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting in the App.

Your continued use of Network Build Pro after changes are posted constitutes acceptance of the modified Terms.''',
            ),

            _buildSection(
              '16. CONTACT INFORMATION',
              '''For questions about these Terms of Service, please contact us:

Email: legal@networkbuildpro.com 
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
            'Network Build Pro: The Future of Professional Network Building',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            '''• Network Build Pro is a subscription-based professional networking platform
• We help professionals build meaningful business relationships
• Users pay a monthly subscription fee for access to our networking and relationship building tools
• We focus on authentic relationship building and professional growth

Network Build Pro empowers professionals to expand their networks systematically and discover opportunities through genuine relationship building.''',
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
