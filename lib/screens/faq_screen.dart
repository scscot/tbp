import 'package:flutter/material.dart';
import '../config/app_colors.dart';

class FAQScreen extends StatefulWidget {
  const FAQScreen({super.key});

  @override
  State<FAQScreen> createState() => _FAQScreenState();
}

class _FAQScreenState extends State<FAQScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  final Map<String, bool> _expandedCategories = {
    'getting_started': true,
    'business_model': false,
    'how_it_works': false,
    'team_building': false,
    'global_features': false,
    'privacy_security': false,
    'pricing': false,
    'concerns': false,
    'success': false,
    'support': false,
  };

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundSecondary,
      appBar: AppBar(
        title: const Text(
          'Frequently Asked Questions',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textInverse,
          ),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textInverse,
        elevation: 0,
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 16),
              children: [
                _buildCategorySection(
                  'getting_started',
                  'Getting Started',
                  '🚀',
                  _gettingStartedFAQs,
                ),
                _buildCategorySection(
                  'business_model',
                  'Business Model & Legitimacy',
                  '💼',
                  _businessModelFAQs,
                ),
                _buildCategorySection(
                  'how_it_works',
                  'How It Works',
                  '🔧',
                  _howItWorksFAQs,
                ),
                _buildCategorySection(
                  'team_building',
                  'Team Building & Management',
                  '👥',
                  _teamBuildingFAQs,
                ),
                _buildCategorySection(
                  'global_features',
                  'Global & Technical Features',
                  '🌍',
                  _globalFeaturesFAQs,
                ),
                _buildCategorySection(
                  'privacy_security',
                  'Privacy & Security',
                  '🔒',
                  _privacySecurityFAQs,
                ),
                _buildCategorySection(
                  'pricing',
                  'Pricing & Business Value',
                  '💰',
                  _pricingFAQs,
                ),
                _buildCategorySection(
                  'concerns',
                  'Common Concerns & Objections',
                  '🤔',
                  _concernsFAQs,
                ),
                _buildCategorySection(
                  'success',
                  'Success & Results',
                  '📈',
                  _successFAQs,
                ),
                _buildCategorySection(
                  'support',
                  'Support & Training',
                  '📞',
                  _supportFAQs,
                ),
                _buildFooterSection(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: const EdgeInsets.all(16),
      child: TextField(
        controller: _searchController,
        decoration: InputDecoration(
          hintText: 'Search FAQs...',
          prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary),
          filled: true,
          fillColor: AppColors.backgroundPrimary,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
        ),
        onChanged: (value) {
          setState(() {
            _searchQuery = value.toLowerCase();
          });
        },
      ),
    );
  }

  Widget _buildCategorySection(
    String categoryKey,
    String title,
    String icon,
    List<FAQItem> items,
  ) {
    final filteredItems = _filterItems(items);

    if (filteredItems.isEmpty && _searchQuery.isNotEmpty) {
      return const SizedBox.shrink();
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      elevation: 2,
      shadowColor: AppColors.border,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          leading: Text(
            icon,
            style: const TextStyle(fontSize: 20),
          ),
          title: Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          initiallyExpanded: _expandedCategories[categoryKey] ?? false,
          onExpansionChanged: (expanded) {
            setState(() {
              _expandedCategories[categoryKey] = expanded;
            });
          },
          children: filteredItems.map((item) => _buildFAQItem(item)).toList(),
        ),
      ),
    );
  }

  Widget _buildFAQItem(FAQItem item) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text(
            item.question,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
          ),
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              width: double.infinity,
              child: Text(
                item.answer,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterSection() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppColors.mediumShadow,
      ),
      child: Column(
        children: [
          const Icon(
            Icons.help_outline,
            size: 48,
            color: AppColors.textInverse,
          ),
          const SizedBox(height: 16),
          const Text(
            'Ready to Transform Your Team Building?',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          const Text(
            'Start your 30-day free trial today and experience the difference professional tools make.',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textInverse,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          const Text(
            'Questions not answered here? Contact our support team - we\'re here to help you succeed!',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textInverse,
              fontStyle: FontStyle.italic,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  List<FAQItem> _filterItems(List<FAQItem> items) {
    if (_searchQuery.isEmpty) return items;

    return items.where((item) {
      return item.question.toLowerCase().contains(_searchQuery) ||
          item.answer.toLowerCase().contains(_searchQuery);
    }).toList();
  }
}

class FAQItem {
  final String question;
  final String answer;

  const FAQItem({
    required this.question,
    required this.answer,
  });
}

final List<FAQItem> _gettingStartedFAQs = [
  FAQItem(
    question: 'What exactly is Team Build Pro?',
    answer: 'Team Build Pro is a professional software tool designed to help direct sales professionals build, manage, and track their teams before and during their business journey. It\'s NOT a business opportunity or MLM company - it\'s the tool that helps you succeed in whatever opportunity you choose.',
  ),
  FAQItem(
    question: 'How is this different from other team building apps or CRM systems?',
    answer: 'Unlike generic CRMs, Team Build Pro is specifically designed for the direct sales industry. It understands the unique challenges you face: starting from zero, building momentum, qualifying prospects, and maintaining team motivation. Our system lets you pre-build your team before you even join an opportunity, giving you a massive head start.',
  ),
  FAQItem(
    question: 'Can I really build a team BEFORE joining a business opportunity?',
    answer: 'Absolutely! This is our core innovation. You can invite prospects and existing team members to Team Build Pro, let them experience team building success, and when they hit qualification milestones (4 direct sponsors + 20 total team members), they automatically get invited to join your business opportunity. It eliminates the "cold start" problem that kills most new distributors.',
  ),
  FAQItem(
    question: 'Do I need a credit card to try it?',
    answer: 'No. You get full access to all premium features for 30 days completely free, with no credit card required. You can decide to subscribe at any point during or after your trial.',
  ),
];

final List<FAQItem> _businessModelFAQs = [
  FAQItem(
    question: 'Is Team Build Pro an MLM or business opportunity?',
    answer: 'No. Team Build Pro is not a business opportunity, MLM, or income platform of any kind. We are a software tool designed exclusively to help professionals build and track their teams. We do not provide any form of user compensation. You pay us a monthly software fee - we don\'t pay you anything.',
  ),
  FAQItem(
    question: 'How do you make money if you\'re not an MLM?',
    answer: 'We operate on a simple Software-as-a-Service (SaaS) model. Users pay \$4.99/month for access to our professional team building platform. That\'s it. No complicated compensation plans, no recruitment requirements, no income claims.',
  ),
  FAQItem(
    question: 'Can I use this with any direct sales company?',
    answer: 'Yes! Team Build Pro is company-agnostic. Whether you\'re in health and wellness, financial services, beauty, technology, or any other direct sales industry, our tools work with your business. You simply customize your profile with your opportunity details.',
  ),
  FAQItem(
    question: 'What if I\'m not currently with a company but want to join one?',
    answer: 'Perfect! This is where Team Build Pro shines. You can start building your team immediately, even before you\'ve chosen which company to join. When you do decide, you\'ll launch with a pre-built, motivated team instead of starting from zero.',
  ),
];

final List<FAQItem> _howItWorksFAQs = [
  FAQItem(
    question: 'How does the qualification system work?',
    answer: 'When someone joins Team Build Pro through your referral, they begin building their own team. Once they reach our success milestones (4 direct sponsors + 20 total team members), they automatically receive an invitation to join your business opportunity. This ensures only motivated, proven team builders advance to your actual business.',
  ),
  FAQItem(
    question: 'What happens if someone joins my Team Build Pro team but doesn\'t want to join my business opportunity?',
    answer: 'That\'s perfectly fine! They can continue using Team Build Pro to build their own team for whatever opportunity they choose, or they can stay focused on team building. There\'s no pressure. The beauty is that you\'re only working with people who have demonstrated commitment and success.',
  ),
  FAQItem(
    question: 'Can I track my team\'s progress and activity?',
    answer: 'Yes! You get comprehensive analytics including real-time team growth statistics, individual member progress toward qualification, activity levels and engagement metrics, geographic distribution of your team, performance trends and milestones, and daily/weekly growth reports.',
  ),
  FAQItem(
    question: 'How do I get my referral link?',
    answer: 'Once you create your account, you get a personalized referral link that you can share via social media, email, text, or in person.',
  ),
];

final List<FAQItem> _teamBuildingFAQs = [
  FAQItem(
    question: 'What\'s the difference between "sponsors" and "team members"?',
    answer: 'Direct sponsors are people you personally invite who join through your referral link. Total team members include your direct sponsors plus everyone they sponsor (your downline). For qualification, you need 4 direct sponsors and 20 total team members.',
  ),
  FAQItem(
    question: 'Can my team members message each other?',
    answer: 'Yes! Team Build Pro includes secure, encrypted messaging so your team can communicate, share tips, and support each other.',
  ),
  FAQItem(
    question: 'What if someone in my team becomes qualified before me?',
    answer: 'That\'s actually great! It shows the system is working. They can advance to your business opportunity independently, and you continue building your own qualification. Success breeds success - having qualified team members often motivates others.',
  ),
  FAQItem(
    question: 'How do I know if my team members are active?',
    answer: 'Our dashboard shows activity levels, last login dates, team building progress, and engagement metrics for each member. You can easily identify who might need encouragement or support.',
  ),
  FAQItem(
    question: 'Can I remove someone from my team?',
    answer: 'Team members can choose to leave on their own, but you cannot remove them. This protects the integrity of the team and ensures everyone\'s hard work building their teams is preserved.',
  ),
];

final List<FAQItem> _globalFeaturesFAQs = [
  FAQItem(
    question: 'Does this work internationally?',
    answer: 'Yes! Team Build Pro works in 120+ countries with timezone-aware features. You can build a truly global team, and our system handles different time zones for notifications and reporting.',
  ),
  FAQItem(
    question: 'What devices does it work on?',
    answer: 'Team Build Pro is available on iOS (iPhone/iPad) and Android devices, with a web companion for additional features. Everything syncs across all your devices.',
  ),
  FAQItem(
    question: 'What if I\'m not tech-savvy?',
    answer: 'The app is designed for simplicity. If you can use social media, you can use Team Build Pro. Plus, we provide onboarding tutorials and customer support to help you get started.',
  ),
  FAQItem(
    question: 'Does the app work offline?',
    answer: 'You need an internet connection for real-time features like messaging and live updates, but you can view your team and some analytics offline. Data syncs when you reconnect.',
  ),
];

final List<FAQItem> _privacySecurityFAQs = [
  FAQItem(
    question: 'How secure is my data?',
    answer: 'We use enterprise-grade security including end-to-end encryption for all communications, secure cloud storage with regular backups, multi-factor authentication options, GDPR compliance for data protection, and no data sharing with third parties.',
  ),
  FAQItem(
    question: 'Who can see my team information?',
    answer: 'Only you can see your complete team. Team members can see their own direct sponsors and downline, but cannot see your entire organization. This protects everyone\'s privacy while maintaining transparency in direct relationships.',
  ),
  FAQItem(
    question: 'What happens to my data if I cancel?',
    answer: 'You can export your team data before canceling. After cancellation, your account is deactivated but your team relationships remain intact for others in your team. We retain minimal data for legal/billing purposes only.',
  ),
  FAQItem(
    question: 'Do you sell my information to other companies?',
    answer: 'Absolutely not. We never sell, rent, or share your personal information with third parties. Our revenue comes from subscriptions, not data sales.',
  ),
];

final List<FAQItem> _pricingFAQs = [
  FAQItem(
    question: 'Is \$4.99/month worth it compared to free alternatives?',
    answer: 'Free tools aren\'t built for the direct sales industry and lack crucial features like qualification tracking, business opportunity integration, and team analytics. For less than the cost of a coffee, you get professional-grade team building tools that can transform your business.',
  ),
  FAQItem(
    question: 'Can I write this off as a business expense?',
    answer: 'Many direct sales professionals do treat it as a business tool expense, but consult your tax advisor for guidance specific to your situation.',
  ),
  FAQItem(
    question: 'What if I need to cancel?',
    answer: 'You can cancel anytime with no cancellation fees or long-term commitments. You retain access until the end of your current billing period.',
  ),
  FAQItem(
    question: 'Do you offer team or volume discounts?',
    answer: 'Currently, we offer individual subscriptions only. This keeps costs low and ensures everyone has equal access to all features.',
  ),
];

final List<FAQItem> _concernsFAQs = [
  FAQItem(
    question: 'Isn\'t this just making direct sales more complicated?',
    answer: 'Actually, it simplifies everything! Instead of cold calling strangers or pressuring friends, you\'re building relationships with people who are actively engaged in team building. It removes the guesswork and awkwardness from traditional recruiting.',
  ),
  FAQItem(
    question: 'What if people think this is "another MLM thing"?',
    answer: 'That\'s why we\'re very clear that Team Build Pro is software, not an opportunity. You\'re inviting people to use a professional tool, not join a business. Many people are more open to trying an app than joining an MLM.',
  ),
  FAQItem(
    question: 'How do I explain this to prospects without confusing them?',
    answer: 'Simple: "It\'s like LinkedIn for direct sales professionals. You build connections, track your team growth, and when you\'re ready to advance your career, opportunities become available." Focus on the professional development angle.',
  ),
  FAQItem(
    question: 'What if my current company doesn\'t allow outside tools?',
    answer: 'Check your company\'s policies, but most direct sales companies welcome tools that help you build your business. Team Build Pro doesn\'t compete with your company - it feeds qualified prospects into it.',
  ),
];

final List<FAQItem> _successFAQs = [
  FAQItem(
    question: 'How long does it take to see results?',
    answer: 'Direct sales success takes time regardless of tools. However, Team Build Pro users often see team growth within weeks because they\'re focused on relationship building rather than selling. The key is consistent daily activity.',
  ),
  FAQItem(
    question: 'What\'s a realistic timeline to build a qualified team?',
    answer: 'This varies greatly by individual effort and market, but our most successful users achieve qualification (4 direct, 20 total) within a few weeks of consistent activity. Remember, you\'re building relationships, not just collecting sign-ups.',
  ),
  FAQItem(
    question: 'Do you guarantee results?',
    answer: 'No software can guarantee your business success - that depends on your effort, market, and opportunity. We provide the tools; you provide the work ethic and relationship building skills.',
  ),
  FAQItem(
    question: 'Can you share success stories?',
    answer: 'While we maintain user privacy, we can share that our most successful users consistently share their Team Build Pro link, engage with their team daily, and focus on helping others succeed rather than just recruiting.',
  ),
];

final List<FAQItem> _supportFAQs = [
  FAQItem(
    question: 'What kind of support do you provide?',
    answer: 'We offer 24/7 customer support via in-app messaging, best practices for team building, and regular feature updates and improvements.',
  ),
  FAQItem(
    question: 'What exactly does AI Coach do?',
    answer: 'AI Coach helps you navigate the Team Build Pro app, answers questions about features and qualification requirements, provides team building guidance, and can suggest which app sections to visit for specific tasks.',
  ),
  FAQItem(
    question: 'Do you provide training on how to recruit or sell?',
    answer: 'We focus on showing you how to use Team Build Pro effectively. For sales and recruiting training, we recommend working with your sponsor or company\'s training programs.',
  ),
  FAQItem(
    question: 'What if I have technical problems?',
    answer: 'Contact our support team through the app or website. Most issues are resolved quickly, and we\'re committed to keeping your team building activities running smoothly.',
  ),
];