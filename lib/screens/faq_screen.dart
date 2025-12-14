import 'package:flutter/material.dart';
import '../config/app_colors.dart';
import '../widgets/localized_text.dart';

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
        automaticallyImplyLeading: true,
        title: Text(
          context.l10n?.faqTitle ?? 'Frequently Asked Questions',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textInverse,
          ),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.textInverse,
        iconTheme: const IconThemeData(color: AppColors.textInverse),
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
                  context.l10n?.faqCategoryGettingStarted ?? 'Getting Started',
                  '🚀',
                  _gettingStartedFAQs(context),
                ),
                _buildCategorySection(
                  'business_model',
                  context.l10n?.faqCategoryBusinessModel ?? 'Business Model & Legitimacy',
                  '💼',
                  _businessModelFAQs(context),
                ),
                _buildCategorySection(
                  'how_it_works',
                  context.l10n?.faqCategoryHowItWorks ?? 'How It Works',
                  '🔧',
                  _howItWorksFAQs(context),
                ),
                _buildCategorySection(
                  'team_building',
                  context.l10n?.faqCategoryTeamBuilding ?? 'Team Building & Management',
                  '👥',
                  _teamBuildingFAQs(context),
                ),
                _buildCategorySection(
                  'global_features',
                  context.l10n?.faqCategoryGlobalFeatures ?? 'Global & Technical Features',
                  '🌍',
                  _globalFeaturesFAQs(context),
                ),
                _buildCategorySection(
                  'privacy_security',
                  context.l10n?.faqCategoryPrivacySecurity ?? 'Privacy & Security',
                  '🔒',
                  _privacySecurityFAQs(context),
                ),
                _buildCategorySection(
                  'pricing',
                  context.l10n?.faqCategoryPricing ?? 'Pricing & Business Value',
                  '💰',
                  _pricingFAQs(context),
                ),
                _buildCategorySection(
                  'concerns',
                  context.l10n?.faqCategoryConcerns ?? 'Common Concerns & Objections',
                  '🤔',
                  _concernsFAQs(context),
                ),
                _buildCategorySection(
                  'success',
                  context.l10n?.faqCategorySuccess ?? 'Success & Results',
                  '📈',
                  _successFAQs(context),
                ),
                _buildCategorySection(
                  'support',
                  context.l10n?.faqCategorySupport ?? 'Support & Training',
                  '📞',
                  _supportFAQs(context),
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
          hintText: context.l10n?.faqSearchHint ?? 'Search FAQs...',
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
          Text(
            context.l10n?.faqFooterTitle ?? 'Ready to Transform Your Team Building?',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textInverse,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            context.l10n?.faqFooterSubtitle ?? 'Start your 30-day free trial today and experience the difference professional tools make.',
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textInverse,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text(
            context.l10n?.faqFooterContact ?? 'Questions not answered here? Contact our support team - we\'re here to help you succeed!',
            style: const TextStyle(
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

List<FAQItem> _gettingStartedFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ1 ?? 'What exactly is Team Build Pro?',
    answer: context.l10n?.faqA1 ?? 'Team Build Pro is a professional software tool designed to help direct sales professionals build, manage, and track their teams before and during their business journey. It\'s NOT a business opportunity or MLM company - it\'s the tool that helps you succeed in whatever opportunity you choose.',
  ),
  FAQItem(
    question: context.l10n?.faqQ2 ?? 'How is this different from other team building apps or CRM systems?',
    answer: context.l10n?.faqA2 ?? 'Unlike generic CRMs, Team Build Pro is specifically designed for the direct sales industry. It understands the unique challenges you face: starting from zero, building momentum, qualifying prospects, and maintaining team motivation. Our system lets you pre-build your team before you even join an opportunity, giving you a massive head start.',
  ),
  FAQItem(
    question: context.l10n?.faqQ3 ?? 'Can I really build a team BEFORE joining a business opportunity?',
    answer: context.l10n?.faqA3 ?? 'Absolutely! This is our core innovation. You can invite prospects and existing team members to Team Build Pro, let them experience team building success, and when they hit qualification milestones (4 direct sponsors + 20 total team members), they automatically get invited to join your business opportunity. It eliminates the "cold start" problem that kills most new distributors.',
  ),
  FAQItem(
    question: context.l10n?.faqQ4 ?? 'Do I need a credit card to try it?',
    answer: context.l10n?.faqA4 ?? 'No. You get full access to all premium features for 30 days completely free, with no credit card required. You can decide to subscribe at any point during or after your trial.',
  ),
];

List<FAQItem> _businessModelFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ5 ?? 'Is Team Build Pro an MLM or business opportunity?',
    answer: context.l10n?.faqA5 ?? 'No. Team Build Pro is not a business opportunity, MLM, or income platform of any kind. We are a software tool designed exclusively to help professionals build and track their teams. We do not provide any form of user compensation.',
  ),
  FAQItem(
    question: context.l10n?.faqQ6 ?? 'Can I use this with any direct sales company?',
    answer: context.l10n?.faqA6 ?? 'Yes! Team Build Pro is company-agnostic. Whether you\'re in health and wellness, financial services, beauty, technology, or any other direct sales industry, our tools work with your business. You simply customize your profile with your opportunity details.',
  ),
  FAQItem(
    question: context.l10n?.faqQ7 ?? 'What if I\'m not currently with a company but want to join one?',
    answer: context.l10n?.faqA7 ?? 'Perfect! This is where Team Build Pro shines. You can start building your team immediately, even before you\'ve chosen which company to join. When you do decide, you\'ll launch with a pre-built, motivated team instead of starting from zero.',
  ),
];

List<FAQItem> _howItWorksFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ8 ?? 'How does the qualification system work?',
    answer: context.l10n?.faqA8 ?? 'When someone joins Team Build Pro through your referral, they begin building their own team. Once they reach our success milestones (4 direct sponsors + 20 total team members), they automatically receive an invitation to join your business opportunity. This ensures only motivated, proven team builders advance to your actual business.',
  ),
  FAQItem(
    question: context.l10n?.faqQ9 ?? 'What happens if someone joins my Team Build Pro team but doesn\'t want to join my business opportunity?',
    answer: context.l10n?.faqA9 ?? 'That\'s perfectly fine! They can continue using Team Build Pro to build their own team for whatever opportunity they choose, or they can stay focused on team building. There\'s no pressure. The beauty is that you\'re only working with people who have demonstrated commitment and success.',
  ),
  FAQItem(
    question: context.l10n?.faqQ10 ?? 'Can I track my team\'s progress and activity?',
    answer: context.l10n?.faqA10 ?? 'Yes! You get comprehensive analytics including real-time team growth statistics, individual member progress toward qualification, activity levels and engagement metrics, geographic distribution of your team, performance trends and milestones, and daily/weekly growth reports.',
  ),
  FAQItem(
    question: context.l10n?.faqQ11 ?? 'How do I get my referral link?',
    answer: context.l10n?.faqA11 ?? 'Once you create your account, you get a personalized referral link that you can share via social media, email, text, or in person.',
  ),
];

List<FAQItem> _teamBuildingFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ12 ?? 'What\'s the difference between "sponsors" and "team members"?',
    answer: context.l10n?.faqA12 ?? 'Direct sponsors are people you personally invite who join through your referral link. Total team members include your direct sponsors plus everyone they sponsor (your downline). For qualification, you need 4 direct sponsors and 20 total team members.',
  ),
  FAQItem(
    question: context.l10n?.faqQ13 ?? 'Can my team members message each other?',
    answer: context.l10n?.faqA13 ?? 'Yes! Team Build Pro includes secure, encrypted messaging so your team can communicate, share tips, and support each other.',
  ),
  FAQItem(
    question: context.l10n?.faqQ14 ?? 'What if someone in my team becomes qualified before me?',
    answer: context.l10n?.faqA14 ?? 'That\'s actually great! It shows the system is working. They can advance to your business opportunity independently, and you continue building your own qualification. Success breeds success - having qualified team members often motivates others.',
  ),
  FAQItem(
    question: context.l10n?.faqQ15 ?? 'How do I know if my team members are active?',
    answer: context.l10n?.faqA15 ?? 'Our dashboard shows activity levels, last login dates, team building progress, and engagement metrics for each member. You can easily identify who might need encouragement or support.',
  ),
  FAQItem(
    question: context.l10n?.faqQ16 ?? 'Can I remove someone from my team?',
    answer: context.l10n?.faqA16 ?? 'Team members can choose to leave on their own, but you cannot remove them. This protects the integrity of the team and ensures everyone\'s hard work building their teams is preserved.',
  ),
];

List<FAQItem> _globalFeaturesFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ17 ?? 'Does this work internationally?',
    answer: context.l10n?.faqA17 ?? 'Yes! Team Build Pro works in 120+ countries with timezone-aware features. The app is fully localized in 4 languages: English, Spanish, Portuguese, and German. You can build a truly global team, and our system handles different time zones for notifications and reporting.',
  ),
  FAQItem(
    question: context.l10n?.faqQ18 ?? 'What devices does it work on?',
    answer: context.l10n?.faqA18 ?? 'Team Build Pro is available on iOS (iPhone/iPad) and Android devices. Everything syncs across all your devices.',
  ),
  FAQItem(
    question: context.l10n?.faqQ19 ?? 'What if I\'m not tech-savvy?',
    answer: context.l10n?.faqA19 ?? 'The app is designed for simplicity. If you can use social media, you can use Team Build Pro. Plus, we provide onboarding tutorials and customer support to help you get started.',
  ),
  FAQItem(
    question: context.l10n?.faqQ20 ?? 'Does the app work offline?',
    answer: context.l10n?.faqA20 ?? 'You need an internet connection for real-time features like messaging and live updates, but you can view your team and some analytics offline. Data syncs when you reconnect.',
  ),
];

List<FAQItem> _privacySecurityFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ21 ?? 'How secure is my data?',
    answer: context.l10n?.faqA21 ?? 'We use enterprise-grade security including end-to-end encryption for all communications, secure cloud storage with regular backups, multi-factor authentication options, GDPR compliance for data protection, and no data sharing with third parties.',
  ),
  FAQItem(
    question: context.l10n?.faqQ22 ?? 'Who can see my team information?',
    answer: context.l10n?.faqA22 ?? 'Only you can see your complete team. Team members can see their own direct sponsors and downline, but cannot see your entire organization. This protects everyone\'s privacy while maintaining transparency in direct relationships.',
  ),
  FAQItem(
    question: context.l10n?.faqQ23 ?? 'What happens to my data if I cancel?',
    answer: context.l10n?.faqA23 ?? 'You can export your team data before canceling. After cancellation, your account is deactivated but your team relationships remain intact for others in your team. We retain minimal data for legal/billing purposes only.',
  ),
  FAQItem(
    question: context.l10n?.faqQ24 ?? 'Do you sell my information to other companies?',
    answer: context.l10n?.faqA24 ?? 'Absolutely not. We never sell, rent, or share your personal information with third parties. Our revenue comes from subscriptions, not data sales.',
  ),
];

List<FAQItem> _pricingFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ25 ?? 'Is \$6.99/month worth it compared to free alternatives?',
    answer: context.l10n?.faqA25 ?? 'Free tools aren\'t built for the direct sales industry and lack crucial features like qualification tracking, business opportunity integration, and team analytics. For less than the cost of a coffee, you get professional-grade team building tools that can transform your business.',
  ),
  FAQItem(
    question: context.l10n?.faqQ26 ?? 'Can I write this off as a business expense?',
    answer: context.l10n?.faqA26 ?? 'Many direct sales professionals do treat it as a business tool expense, but consult your tax advisor for guidance specific to your situation.',
  ),
  FAQItem(
    question: context.l10n?.faqQ27 ?? 'What if I need to cancel?',
    answer: context.l10n?.faqA27 ?? 'You can cancel anytime with no cancellation fees or long-term commitments. You retain access until the end of your current billing period.',
  ),
  FAQItem(
    question: context.l10n?.faqQ28 ?? 'Do you offer team or volume discounts?',
    answer: context.l10n?.faqA28 ?? 'Currently, we offer individual subscriptions only. This keeps costs low and ensures everyone has equal access to all features.',
  ),
];

List<FAQItem> _concernsFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ29 ?? 'Isn\'t this just making direct sales more complicated?',
    answer: context.l10n?.faqA29 ?? 'Actually, it simplifies everything! Instead of cold calling strangers or pressuring friends, you\'re building relationships with people who are actively engaged in team building. It removes the guesswork and awkwardness from traditional recruiting.',
  ),
  FAQItem(
    question: context.l10n?.faqQ30 ?? 'What if people think this is "another MLM thing"?',
    answer: context.l10n?.faqA30 ?? 'That\'s why we\'re very clear that Team Build Pro is software, not an opportunity. You\'re inviting people to use a professional tool, not join a business. Many people are more open to trying an app than joining an MLM.',
  ),
  FAQItem(
    question: context.l10n?.faqQ31 ?? 'How do I explain this to prospects without confusing them?',
    answer: context.l10n?.faqA31 ?? 'Simple: "It\'s like LinkedIn for direct sales professionals. You build connections, track your team growth, and when you\'re ready to advance your career, opportunities become available." Focus on the professional development angle.',
  ),
  FAQItem(
    question: context.l10n?.faqQ32 ?? 'What if my current company doesn\'t allow outside tools?',
    answer: context.l10n?.faqA32 ?? 'Check your company\'s policies, but most direct sales companies welcome tools that help you build your business. Team Build Pro doesn\'t compete with your company - it feeds qualified prospects into it.',
  ),
];

List<FAQItem> _successFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ33 ?? 'How long does it take to see results?',
    answer: context.l10n?.faqA33 ?? 'Direct sales success takes time regardless of tools. However, Team Build Pro users often see team growth within weeks because they\'re focused on relationship building rather than selling. The key is consistent daily activity.',
  ),
  FAQItem(
    question: context.l10n?.faqQ34 ?? 'What\'s a realistic timeline to build a qualified team?',
    answer: context.l10n?.faqA34 ?? 'This varies greatly by individual effort and market, but our most successful users achieve qualification (4 direct, 20 total) within a few weeks of consistent activity. Remember, you\'re building relationships, not just collecting sign-ups.',
  ),
  FAQItem(
    question: context.l10n?.faqQ35 ?? 'Do you guarantee results?',
    answer: context.l10n?.faqA35 ?? 'No software can guarantee your business success - that depends on your effort, market, and opportunity. We provide the tools; you provide the work ethic and relationship building skills.',
  ),
  FAQItem(
    question: context.l10n?.faqQ36 ?? 'Can you share success stories?',
    answer: context.l10n?.faqA36 ?? 'While we maintain user privacy, we can share that our most successful users consistently share their Team Build Pro link, engage with their team daily, and focus on helping others succeed rather than just recruiting.',
  ),
];

List<FAQItem> _supportFAQs(BuildContext context) => [
  FAQItem(
    question: context.l10n?.faqQ37 ?? 'What kind of support do you provide?',
    answer: context.l10n?.faqA37 ?? 'We offer 24/7 customer support via in-app messaging, best practices for team building, and regular feature updates and improvements.',
  ),
  FAQItem(
    question: context.l10n?.faqQ38 ?? 'What exactly does AI Coach do?',
    answer: context.l10n?.faqA38 ?? 'AI Coach helps you navigate the Team Build Pro app, answers questions about features and qualification requirements, provides team building guidance, and can suggest which app sections to visit for specific tasks.',
  ),
  FAQItem(
    question: context.l10n?.faqQ39 ?? 'Do you provide training on how to recruit or sell?',
    answer: context.l10n?.faqA39 ?? 'We focus on showing you how to use Team Build Pro effectively. For sales and recruiting training, we recommend working with your sponsor or company\'s training programs.',
  ),
  FAQItem(
    question: context.l10n?.faqQ40 ?? 'What if I have technical problems?',
    answer: context.l10n?.faqA40 ?? 'Contact our support team through the app or website. Most issues are resolved quickly, and we\'re committed to keeping your team building activities running smoothly.',
  ),
];