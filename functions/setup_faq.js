// Script to populate FAQ collection in Firestore
// Run this once to set up the knowledge base

const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
// admin.initializeApp();

const faqData = [
  {
    id: 'what_is_tbp',
    question: 'What is Team Build Pro?',
    answer:
      'Team Build Pro is a SaaS software tool that helps professionals build teams BEFORE joining business opportunities. We charge $6.99/month - we are NOT a business opportunity or MLM. Think of us like LinkedIn for direct sales professionals.',
    keywords: ['team build pro', 'what is', 'software', 'saas', 'tool'],
    category: 'business_model',
  },
  {
    id: 'qualification_system',
    question: 'How does the qualification system work?',
    answer:
      'You need 4 direct sponsors + 20 total team members to qualify. Direct sponsors are people you personally invite. Total team includes everyone in your network (directs + their teams). Once qualified, you receive business opportunity invitations.',
    keywords: ['qualification', 'direct sponsors', '4 direct', '20 total', 'qualify'],
    category: 'getting_started',
  },
  {
    id: 'after_qualification',
    question: 'What happens after I qualify?',
    answer:
      'After qualifying with 4 direct sponsors and 20 total team members, you receive invitations to legitimate business opportunities. Your Team Build Pro network becomes your foundation - ready to join opportunities with an established team. You can continue growing your Team Build Pro network, support your team members, and evaluate which business opportunities align with your goals. Your subscription continues at $6.99/month to maintain access to your network and team building tools.',
    keywords: ['after qualify', 'post qualification', 'once qualified', 'what happens', 'what next', 'qualified now what'],
    category: 'getting_started',
  },
  {
    id: 'not_mlm',
    question: 'How is this different from an MLM?',
    answer:
      'Team Build Pro is NOT an MLM. Key differences: You pay us monthly ($6.99), we never pay you. No income opportunities. No recruitment commissions. We are a software tool, not a business opportunity. Use us to build your foundation, then join legitimate opportunities.',
    keywords: ['mlm', 'network marketing', 'difference', 'not mlm', 'business opportunity'],
    category: 'business_model',
  },
  {
    id: 'how_to_invite',
    question: 'How do I invite people to my team?',
    answer:
      'Use the Share screen to send personalized invitations via email, text, or social media. Each invitation includes your unique referral code. Focus on people interested in team building or direct sales. Quality over quantity - invite people who align with your goals.',
    keywords: ['invite', 'share', 'referral', 'team building', 'recruit'],
    category: 'team_building',
  },
  {
    id: 'team_analytics',
    question: 'How do I view my team analytics?',
    answer:
      'Go to the Dashboard or Network screen to see detailed analytics. Track direct sponsors, total team size, growth trends, and qualification progress. Use filters to view specific team segments and monitor individual member progress.',
    keywords: ['analytics', 'dashboard', 'network', 'team stats', 'progress'],
    category: 'app_features',
  },
  {
    id: 'focus_strategy',
    question: 'What should I focus on next?',
    answer:
      'Focus depends on your current progress: 0-1 direct sponsors: Focus on inviting quality people. 2-3 direct sponsors: Help your team invite others while continuing to invite. Near qualification: Final push on both direct and total numbers. Qualified: Prepare for business opportunities.',
    keywords: ['focus', 'strategy', 'next steps', 'what should', 'progress'],
    category: 'success_strategies',
  },
  {
    id: 'cancel_subscription',
    question: 'How do I cancel my subscription?',
    answer:
      'Cancel through your Apple App Store or Google Play Store subscription settings. Go to Settings > Subscriptions on your device, find Team Build Pro, and cancel. Your access continues until the current billing period ends.',
    keywords: ['cancel', 'subscription', 'billing', 'app store', 'unsubscribe'],
    category: 'pricing_billing',
  },
  {
    id: 'failure_rates',
    question: 'Why do most people fail at direct sales?',
    answer:
      'Industry statistics show 99% failure rates due to: Starting with no foundation, lack of systems, poor team building skills, joining wrong opportunities, and giving up too early. Team Build Pro addresses these by helping you build your foundation first.',
    keywords: ['failure', '99%', 'why fail', 'statistics', 'direct sales'],
    category: 'industry_insights',
  },
  {
    id: 'qualification_timeline',
    question: 'How long does it take to qualify?',
    answer:
      'Qualification requires 4 direct sponsors + 20 total team members. Timeline depends entirely on your effort and activity level. Very active users who dedicate consistent daily effort can qualify in less than 30 days. More casual users typically take 1-3 months. The built-in pre-qualification system lets you build at your own pace before joining any business opportunity.',
    keywords: ['how long', 'timeline', 'qualify', 'time frame', 'duration', '30 days', 'less than 30', 'fast qualification'],
    category: 'success_strategies',
  },
  {
    id: 'messaging_system',
    question: 'How does the messaging system work?',
    answer:
      'Secure encrypted messaging connects you with team members. Start conversations, share updates, and coordinate team building activities. All messages are private and encrypted. Use this to maintain team momentum and provide support.',
    keywords: ['messaging', 'chat', 'communication', 'team', 'encrypted'],
    category: 'app_features',
  },
  {
    id: 'privacy_security',
    question: 'How is my data protected?',
    answer:
      'Enterprise-grade security with end-to-end encryption for all communications. Data stored in secure Firebase servers with strict access controls. We never share personal information. Full compliance with privacy regulations including GDPR.',
    keywords: ['privacy', 'security', 'data protection', 'encryption', 'gdpr'],
    category: 'privacy_security',
  },
  {
    id: 'legitimate_opportunities',
    question: 'What are legitimate business opportunities?',
    answer:
      'Legitimate opportunities have: Clear products/services, transparent compensation, compliance with regulations, established company track record, and realistic income expectations. Team Build Pro helps you qualify for invitations to these opportunities.',
    keywords: [
      'legitimate',
      'business opportunities',
      'legitimate companies',
      'real opportunities',
    ],
    category: 'industry_insights',
  },
  {
    id: 'account_setup',
    question: 'How do I set up my account?',
    answer:
      'Download from App Store/Google Play, create account with email/Google/Apple, complete profile setup, and start inviting team members. Your unique referral code is automatically generated. Begin with the 30-day free trial.',
    keywords: ['setup', 'account', 'getting started', 'sign up', 'profile'],
    category: 'getting_started',
  },
  {
    id: 'referral_code',
    question: 'How does my referral code work?',
    answer:
      'Your unique 8-digit referral code tracks people you invite. When someone joins using your code, they become part of your team. The code appears in all your share links and is used for building your team structure.',
    keywords: ['referral code', 'unique code', 'tracking', '8-digit', 'team structure'],
    category: 'team_building',
  },
  {
    id: 'team_support',
    question: 'How do I support my team members?',
    answer:
      "Stay connected through messaging, celebrate milestones, share successful strategies, provide encouragement during challenges, and help them understand the qualification system. Active team support increases everyone's success rates.",
    keywords: ['support team', 'help members', 'team leadership', 'motivation', 'encourage'],
    category: 'team_building',
  },
  {
    id: 'global_availability',
    question: 'Is Team Build Pro available globally?',
    answer:
      'Yes, Team Build Pro supports users in 120+ countries with timezone-aware features. The app handles multiple languages and international team building. Global reach helps you build diverse, worldwide teams.',
    keywords: ['global', 'international', 'countries', 'worldwide', 'timezone'],
    category: 'app_features',
  },
  {
    id: 'free_trial',
    question: 'How does the free trial work?',
    answer:
      '30-day free trial with full access to all premium features. No credit card required to start. Trial begins when you create your account. After 30 days, subscription automatically begins at $6.99/month unless cancelled.',
    keywords: ['free trial', '30 days', 'no credit card', 'trial period', 'premium features'],
    category: 'pricing_billing',
  },
  {
    id: 'network_visualization',
    question: 'How do I view my team network?',
    answer:
      'The Network screen shows your complete team structure with visual diagrams. See direct sponsors highlighted, total team members, growth patterns, and individual member progress. Filter by activity, qualification status, and more.',
    keywords: ['network', 'team view', 'visualization', 'structure', 'diagram'],
    category: 'app_features',
  },
  {
    id: 'success_tips',
    question: 'What are the keys to success?',
    answer:
      'Daily consistent activity, focus on quality invitations, support your team actively, use app analytics to track progress, stay persistent through challenges, and maintain realistic expectations. Success requires patience and consistent effort.',
    keywords: ['success tips', 'keys to success', 'winning strategies', 'how to succeed'],
    category: 'success_strategies',
  },
  {
    id: 'app_updates',
    question: 'How do I get app updates?',
    answer:
      'Updates are delivered through App Store and Google Play Store. Enable automatic updates in your device settings for seamless feature additions. Major updates include new features, performance improvements, and security enhancements.',
    keywords: ['updates', 'app store', 'google play', 'new features', 'automatic updates'],
    category: 'technical_support',
  },
];

async function setupFAQ() {
  try {
    const db = admin.firestore();
    const batch = db.batch();

    // Clear existing FAQ data (optional)
    const existingDocs = await db.collection('faq').get();
    existingDocs.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new FAQ data
    faqData.forEach((faq) => {
      const docRef = db.collection('faq').doc(faq.id);
      batch.set(docRef, {
        ...faq,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`✅ Successfully added ${faqData.length} FAQ items to Firestore`);
  } catch (error) {
    console.error('❌ Error setting up FAQ:', error);
  }
}

// Export for use in other functions
module.exports = { setupFAQ, faqData };

// Uncomment to run directly
// setupFAQ();
