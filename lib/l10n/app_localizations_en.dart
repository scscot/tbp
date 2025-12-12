// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Team Build Pro';

  @override
  String get authLoginHeaderTitle => 'Welcome back';

  @override
  String get authLoginLabelEmail => 'Email';

  @override
  String get authLoginHintEmail => 'Enter your email address';

  @override
  String get authLoginEmailRequired => 'Please enter your email';

  @override
  String get authLoginEmailInvalid => 'Please enter a valid email';

  @override
  String get authLoginLabelPassword => 'Password';

  @override
  String get authLoginHintPassword => 'Enter your password';

  @override
  String get authLoginPasswordRequired => 'Please enter your password';

  @override
  String authLoginPasswordTooShort(int min) {
    return 'Password must be at least $min characters';
  }

  @override
  String get authLoginButtonSignIn => 'Sign In';

  @override
  String get authLoginNoAccountPrompt => 'Don\'t have an account?';

  @override
  String get authLoginLinkSignUp => 'Sign Up';

  @override
  String authLoginBiometric(String method) {
    return 'Sign in with $method';
  }

  @override
  String get authLoginBiometricMethodFace => 'Face ID';

  @override
  String get authLoginBiometricMethodTouch => 'Touch ID';

  @override
  String get authLoginBiometricMethodGeneric => 'Biometrics';

  @override
  String get authSignupHeaderTitle => 'Create your account';

  @override
  String get authSignupLabelFirstName => 'First Name';

  @override
  String get authSignupHintFirstName => 'Enter your first name';

  @override
  String get authSignupFirstNameRequired => 'Please enter your first name';

  @override
  String get authSignupLabelLastName => 'Last Name';

  @override
  String get authSignupHintLastName => 'Enter your last name';

  @override
  String get authSignupLastNameRequired => 'Please enter your last name';

  @override
  String get authSignupLabelEmail => 'Email';

  @override
  String get authSignupHintEmail => 'Enter your email address';

  @override
  String get authSignupEmailRequired => 'Please enter your email';

  @override
  String get authSignupEmailInvalid => 'Please enter a valid email';

  @override
  String get authSignupLabelPassword => 'Password';

  @override
  String get authSignupHintPassword => 'Create a password';

  @override
  String get authSignupPasswordRequired => 'Please enter a password';

  @override
  String authSignupPasswordTooShort(int min) {
    return 'Password must be at least $min characters';
  }

  @override
  String get authSignupLabelConfirmPassword => 'Confirm Password';

  @override
  String get authSignupHintConfirmPassword => 'Re-enter your password';

  @override
  String get authSignupConfirmPasswordRequired =>
      'Please confirm your password';

  @override
  String get authSignupPasswordMismatch => 'Passwords don\'t match';

  @override
  String get authSignupLabelReferralCode => 'Referral Code (Optional)';

  @override
  String get authSignupHintReferralCode => 'Enter invite code if you have one';

  @override
  String get authSignupButtonPasteCode => 'Paste';

  @override
  String get authSignupTosConsent =>
      'By continuing, you agree to the Terms of Service and Privacy Policy';

  @override
  String get authSignupTermsShort => 'Terms of Service';

  @override
  String get authSignupPrivacyShort => 'Privacy Policy';

  @override
  String get authSignupTosRequired => 'Required for account creation';

  @override
  String get authSignupButtonCreateAccount => 'Create Account';

  @override
  String get authSignupHaveAccountPrompt => 'Already have an account?';

  @override
  String get authSignupLinkSignIn => 'Sign In';

  @override
  String get authPasswordShow => 'Show password';

  @override
  String get authPasswordHide => 'Hide password';

  @override
  String get authErrorInvalidEmail =>
      'That email isn\'t valid. Please check and try again.';

  @override
  String get authErrorUserDisabled =>
      'This account has been disabled. Please contact support.';

  @override
  String get authErrorUserNotFound => 'No account found with that email.';

  @override
  String get authErrorWrongPassword => 'Incorrect password. Please try again.';

  @override
  String get authErrorEmailInUse =>
      'An account with that email already exists.';

  @override
  String get authErrorWeakPassword => 'Please choose a stronger password.';

  @override
  String get authErrorNetworkError =>
      'Network error. Please check your connection.';

  @override
  String get authErrorTooMany => 'Too many attempts. Please wait a moment.';

  @override
  String get authErrorInvalidCredential =>
      'Those details don\'t match our records.';

  @override
  String get authErrorUnknown => 'An error occurred. Please try again.';

  @override
  String get navHome => 'Home';

  @override
  String get navTeam => 'Team';

  @override
  String get navShare => 'Grow';

  @override
  String get navMessages => 'Messages';

  @override
  String get navNotices => 'Notices';

  @override
  String get navProfile => 'Profile';

  @override
  String get dashTitle => 'Control Center';

  @override
  String get dashKpiDirectSponsors => 'Direct Sponsors';

  @override
  String get dashKpiTotalTeam => 'Total Team Members';

  @override
  String get dashStatsRefreshed => 'Team stats refreshed';

  @override
  String dashStatsError(String error) {
    return 'Error refreshing stats: $error';
  }

  @override
  String get dashTileGettingStarted => 'Getting Started';

  @override
  String get dashTileOpportunity => 'Opportunity Details';

  @override
  String get dashTileEligibility => 'Your Eligibility Status';

  @override
  String get dashTileGrowTeam => 'Grow Your Team';

  @override
  String get dashTileViewTeam => 'View Your Team';

  @override
  String get dashTileAiCoach => 'Your AI Coach';

  @override
  String get dashTileMessageCenter => 'Message Center';

  @override
  String get dashTileNotifications => 'Notifications';

  @override
  String get dashTileHowItWorks => 'How It Works';

  @override
  String get dashTileFaqs => 'FAQ\'s';

  @override
  String get dashTileProfile => 'View Your Profile';

  @override
  String get dashTileCreateAccount => 'Create New Account';

  @override
  String recruitT01FirstTouch(String prospectName, String senderFirst,
      String companyName, String shortLink) {
    return 'Hey $prospectName, it\'s $senderFirst. Using an app to help friends start with $companyName. Look? $shortLink';
  }

  @override
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink) {
    return 'Hey, it\'s $senderFirst. I\'m using an app to help friends launch with $companyName. Quick look? $shortLink';
  }

  @override
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink) {
    return 'Hi $prospectName! Following up on $companyName. Great results this week. Quick chat? $shortLink';
  }

  @override
  String recruitT03DeadlineNudge(
      String prospectName, String companyName, String shortLink) {
    return '$prospectName, spots are filling up for our $companyName launch. Want me to save you one? $shortLink';
  }

  @override
  String recruitT04TeamNeeded(int remaining) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'You\'re # people away from a strong start.',
      one: 'You\'re # person away from a strong start.',
      zero: 'You\'re day-one ready.',
    );
    return '$_temp0';
  }

  @override
  String recruitT05MilestoneReached(String prospectName, String companyName) {
    return '🎉 $prospectName, you hit your first milestone with $companyName! Your team is growing. Keep it up!';
  }

  @override
  String recruitT06WelcomeOnboard(
      String prospectName, String senderFirst, String inviteLink) {
    return 'Welcome, $prospectName! I\'m $senderFirst and here to help. Let\'s get started: $inviteLink';
  }

  @override
  String recruitT07WeeklyCheckIn(String prospectName, String companyName) {
    return 'Hey $prospectName, quick check-in on $companyName. How are things going? Any questions I can help with?';
  }

  @override
  String recruitT08Deadline(int days, String shortLink) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '# days',
      one: '# day',
    );
    return 'We kick off in $_temp0. Want me to hold your spot? $shortLink';
  }

  @override
  String recruitT09ResourceShare(
      String prospectName, String companyName, String inviteLink) {
    return '$prospectName, I found this helpful for $companyName. Thought you\'d want to see it: $inviteLink';
  }

  @override
  String recruitT10InviteReminder(
      String prospectName, String companyName, String shortLink) {
    return 'Hi $prospectName, you still have an invite waiting for $companyName. Ready to join? $shortLink';
  }

  @override
  String recruitT11TeamGrowth(String prospectName, String companyName) {
    return 'Great news, $prospectName! Your $companyName team grew this week. You\'re making real progress!';
  }

  @override
  String recruitT12Encouragement(String prospectName, String companyName) {
    return '$prospectName, building with $companyName takes time. You\'re doing great. Keep going!';
  }

  @override
  String recruitT13TrainingInvite(
      String prospectName, String companyName, String inviteLink) {
    return 'Hey $prospectName, $companyName training session coming up. Join? $inviteLink';
  }

  @override
  String recruitT14QuickWin(String prospectName, String companyName) {
    return 'Nice work, $prospectName! That was a solid win with $companyName. Let\'s keep the momentum going!';
  }

  @override
  String recruitT15SupportOffer(String prospectName, String companyName) {
    return 'Hey $prospectName, I\'m here if you need help with $companyName. Just reach out anytime.';
  }

  @override
  String recruitT16Gratitude(String prospectName, String companyName) {
    return 'Thanks for being part of our $companyName team, $prospectName. Your energy makes a difference!';
  }

  @override
  String get notifMilestoneDirectTitle => '🎉 Amazing Progress!';

  @override
  String notifMilestoneDirectBody(
      String firstName, int directCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'members',
      one: 'member',
    );
    return 'Congratulations, $firstName! You\'ve reached $directCount direct sponsors! Just $remaining more team $_temp0 needed to unlock your $bizName invitation. Keep building!';
  }

  @override
  String get notifMilestoneTeamTitle => '🚀 Incredible Growth!';

  @override
  String notifMilestoneTeamBody(
      String firstName, int teamCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'sponsors',
      one: 'sponsor',
    );
    return 'Amazing progress, $firstName! You\'ve built a team of $teamCount! Just $remaining more direct $_temp0 needed to qualify for $bizName. You\'re so close!';
  }

  @override
  String get notifSubActiveTitle => '✅ Subscription Active';

  @override
  String notifSubActiveBody(String expiryDate) {
    return 'Your subscription is now active until $expiryDate.';
  }

  @override
  String get notifSubCancelledTitle => '⚠️ Subscription Cancelled';

  @override
  String notifSubCancelledBody(String expiryDate) {
    return 'Your subscription has been cancelled but remains active until $expiryDate.';
  }

  @override
  String get notifSubExpiredTitle => '❌ Subscription Expired';

  @override
  String get notifSubExpiredBody =>
      'Your subscription has expired. Renew now to keep building your team and accessing all recruiting tools.';

  @override
  String get notifSubExpiringSoonTitle => '⏰ Subscription Expiring Soon';

  @override
  String notifSubExpiringSoonBody(String expiryDate) {
    return 'Your subscription expires on $expiryDate. Renew now to avoid interruption.';
  }

  @override
  String get notifSubPausedTitle => '⏸️ Subscription Paused';

  @override
  String get notifSubPausedBody =>
      'Your subscription has been paused. Resume in the Play Store to restore access to all features.';

  @override
  String get notifSubPaymentIssueTitle => '⚠️ Payment Issue';

  @override
  String get notifSubPaymentIssueBody =>
      'Your subscription is on hold due to a payment issue. Please update your payment method in the Play Store.';

  @override
  String notifNewMessageTitle(String senderName) {
    return 'New Message from $senderName';
  }

  @override
  String get notifTeamActivityTitle => '👀 Team Member Activity';

  @override
  String notifTeamActivityBody(String visitorName) {
    return '$visitorName visited the business opportunity page!';
  }

  @override
  String get notifLaunchSentTitle => 'Launch Campaign Sent';

  @override
  String get notifLaunchSentBody =>
      'Your launch campaign has been successfully sent to your network.';

  @override
  String get emptyNotifications => 'No notifications yet.';

  @override
  String get emptyMessageContent => 'No message content.';

  @override
  String get emptyNotificationTitle => 'No Title';

  @override
  String get emptyMessageThreads => 'No message threads found.';

  @override
  String get emptyTeamMember => 'Team member not found.';

  @override
  String get errorLoadingNotifications => 'Error loading notifications';

  @override
  String errorGeneric(String error) {
    return 'Error: $error';
  }

  @override
  String get dashKpiTitle => 'Your Current Team Stats';

  @override
  String get dashKpiRefreshTooltip => 'Refresh team stats';

  @override
  String get dashTileJoinOpportunity => 'Join Opportunity!';

  @override
  String dashSubscriptionTrial(int daysLeft) {
    return 'Start Subscription\n($daysLeft days left in trial)';
  }

  @override
  String get dashSubscriptionExpired =>
      'Renew Your Subscription\n30-day Free trial expired.';

  @override
  String get dashSubscriptionCancelled =>
      'You Cancelled Your Subscription\nReactivate Your Subscription Now';

  @override
  String get dashSubscriptionManage => 'Manage Subscription';

  @override
  String get networkTitle => 'Your Global Team';

  @override
  String get networkLabelDirectSponsors => 'Direct Sponsors';

  @override
  String get networkLabelTotalTeam => 'Total Team';

  @override
  String get networkLabelNewMembers => 'New Members';

  @override
  String get networkSearchHint => 'Search team members...';

  @override
  String get networkRefreshTooltip => 'Force refresh data';

  @override
  String get networkFilterSelectReport => 'View Team Report';

  @override
  String get networkFilterAllMembers => 'All Members';

  @override
  String get networkFilterDirectSponsors => 'Direct Sponsors';

  @override
  String get networkFilterNewMembers => 'New Members - Today';

  @override
  String get networkFilterNewMembersYesterday => 'New Members - Yesterday';

  @override
  String get networkFilterQualified => 'Qualified Members';

  @override
  String get networkFilterJoined => 'Joined';

  @override
  String networkFilterAllMembersWithCount(int count) {
    return 'All Members ($count)';
  }

  @override
  String networkFilterDirectSponsorsWithCount(int count) {
    return 'Direct Sponsors ($count)';
  }

  @override
  String networkFilterNewMembersWithCount(int count) {
    return 'New Members - Today ($count)';
  }

  @override
  String networkFilterNewMembersYesterdayWithCount(int count) {
    return 'New Members - Yesterday ($count)';
  }

  @override
  String networkFilterQualifiedWithCount(int count) {
    return 'Qualified Members ($count)';
  }

  @override
  String networkFilterJoinedWithCount(String business, int count) {
    return 'Joined $business ($count)';
  }

  @override
  String get networkMessageSelectReport =>
      'Select a report from the dropdown above or use the search bar to view and manage your team.';

  @override
  String get networkMessageNoSearchResults =>
      'Showing search results from All Members. No members match your search.';

  @override
  String get networkMessageNoMembers => 'No members found for this filter.';

  @override
  String get networkSearchingContext => 'Searching in: All Members';

  @override
  String get networkSearchingContextInfo =>
      'Showing search results from All Members';

  @override
  String networkPaginationInfo(int showing, int total) {
    return 'Showing $showing of $total members';
  }

  @override
  String networkLevelLabel(int level) {
    return 'Level $level';
  }

  @override
  String networkMembersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Members',
      one: '$count Member',
    );
    return '$_temp0';
  }

  @override
  String get networkLoadingMore => 'Loading more members...';

  @override
  String networkLoadMoreButton(int remaining) {
    return 'Load More Members ($remaining remaining)';
  }

  @override
  String networkAllMembersLoaded(int count) {
    return 'All $count members loaded';
  }

  @override
  String networkMemberJoined(String date) {
    return 'Joined $date';
  }

  @override
  String get networkAnalyticsPerformance => 'Network Performance';

  @override
  String get networkAnalyticsGeographic => 'Geographic Distribution';

  @override
  String get networkAnalyticsLevels => 'Level Distribution';

  @override
  String get networkAnalyticsChartPlaceholder =>
      'Performance Chart\n(Chart implementation would go here)';

  @override
  String networkLevelBadge(int level) {
    return 'Level $level';
  }

  @override
  String networkLevelMembersCount(int count) {
    return '$count members';
  }

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsTitleOrganization => 'Organization Settings';

  @override
  String settingsWelcomeMessage(String name) {
    return 'Welcome $name!\n\nLet\'s set up the foundation for your business opportunity.';
  }

  @override
  String get settingsLabelOrganizationName => 'Your Organization Name';

  @override
  String get settingsLabelConfirmOrganizationName =>
      'Confirm Organization Name';

  @override
  String get settingsDialogImportantTitle => 'Very Important!';

  @override
  String settingsDialogReferralImportance(String organization) {
    return 'You must enter the exact referral link you received from your $organization sponsor.';
  }

  @override
  String get settingsDialogButtonUnderstand => 'I Understand';

  @override
  String get settingsLabelReferralLink => 'Your Referral Link';

  @override
  String get settingsLabelConfirmReferralLink => 'Confirm Referral Link URL';

  @override
  String get settingsLabelCountries => 'Available Countries';

  @override
  String get settingsImportantLabel => 'Important:';

  @override
  String get settingsCountriesInstruction =>
      'Only select the countries where your opportunity is currently available.';

  @override
  String get settingsButtonAddCountry => 'Add a Country';

  @override
  String get settingsButtonSave => 'Save Settings';

  @override
  String get settingsDisplayOrganization => 'Your Organization';

  @override
  String get settingsDisplayReferralLink => 'Your Referral Link';

  @override
  String get settingsDisplayCountries => 'Selected Available Countries';

  @override
  String get settingsNoCountries => 'No countries selected.';

  @override
  String get settingsFeederSystemTitle => 'Network Feeder System';

  @override
  String get settingsFeederSystemDescription =>
      'This is your automated growth engine. When members join Team Build Pro through your link but haven\'t yet qualified for your business opportunity, they\'re placed in your feeder network. The moment you meet the eligibility requirements below, these members automatically transfer to your business opportunity team. It\'s a powerful system that rewards your dedication - the bigger your feeder network grows, the stronger your launch will be when you qualify.';

  @override
  String get settingsEligibilityTitle => 'Minimum Eligibility Requirements';

  @override
  String get settingsEligibilityDirectSponsors => 'Direct Sponsors';

  @override
  String get settingsEligibilityTotalTeam => 'Total Members';

  @override
  String get settingsPrivacyLegalTitle => 'Privacy & Legal';

  @override
  String get settingsPrivacyPolicy => 'Privacy Policy';

  @override
  String get settingsPrivacyPolicySubtitle =>
      'View our privacy practices and data handling';

  @override
  String get settingsTermsOfService => 'Terms of Service';

  @override
  String get settingsTermsOfServiceSubtitle =>
      'View our platform terms and conditions';

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileLabelCity => 'City';

  @override
  String get profileLabelState => 'State';

  @override
  String get profileLabelCountry => 'Country';

  @override
  String get profileLabelJoined => 'Joined';

  @override
  String get profileLabelSponsor => 'Your Sponsor';

  @override
  String get profileLabelTeamLeader => 'Team Leader';

  @override
  String get profileButtonEdit => 'Edit Profile';

  @override
  String get profileButtonSignOut => 'Sign Out';

  @override
  String get profileSigningOut => 'Signing out...';

  @override
  String get profileButtonTerms => 'Terms of Service';

  @override
  String get profileButtonPrivacy => 'Privacy Policy';

  @override
  String get profileButtonDeleteAccount => 'Delete Account';

  @override
  String get profileDemoAccountTitle => 'Demo Account Information';

  @override
  String get profileDemoAccountMessage =>
      'This is a demo account for testing purposes and cannot be deleted.';

  @override
  String get profileDemoAccountSubtext =>
      'Demo accounts are provided to showcase the app\'s features and functionality. If you need to create a real account, please sign up with your personal information.';

  @override
  String get profileDemoAccountButton => 'I Understand';

  @override
  String get profileAdminProtectionTitle => 'Admin Account Protection';

  @override
  String get profileAdminProtectionMessage =>
      'Administrator accounts with active team members cannot be deleted through the app. This protection ensures your team\'s data and relationships remain intact.';

  @override
  String profileAdminTeamSize(int directCount) {
    return 'Your Team: $directCount Direct Sponsors';
  }

  @override
  String get profileAdminProtectionInstructions =>
      'To delete your admin account, please contact our support team at legal@teambuildpro.com. We\'ll work with you to ensure a smooth transition for your team members.';

  @override
  String get profileAdminProtectionContact => 'Contact: legal@teambuildpro.com';

  @override
  String get messageCenterTitle => 'Message Center';

  @override
  String get messageCenterSearchHint => 'Search messages...';

  @override
  String get messageCenterFilterAll => 'All';

  @override
  String get messageCenterFilterUnread => 'Unread';

  @override
  String get messageCenterFilterTeam => 'Team';

  @override
  String get messageCenterNewThread => 'New Message';

  @override
  String get messageCenterEmptyState =>
      'No messages yet. Start a conversation with your team members!';

  @override
  String get messageCenterNotLoggedIn => 'Please log in to see messages.';

  @override
  String get messageCenterSponsorLabel => 'Your Sponsor';

  @override
  String get messageCenterTeamLeaderLabel => 'Team Leader';

  @override
  String get messageCenterSupportTeamTitle => 'Your Support Team';

  @override
  String get messageCenterSupportTeamSubtitle => 'Tap to start a conversation';

  @override
  String get messageCenterError => 'Error loading messages';

  @override
  String get messageCenterLoadingChat => 'Loading chat...';

  @override
  String get messageCenterErrorLoadingUser => 'Error loading user details';

  @override
  String get messageCenterUnknownUser => 'Unknown User';

  @override
  String messageCenterUnreadBadge(int count) {
    return '$count new';
  }

  @override
  String messageCenterLastMessage(String time) {
    return 'Last message $time';
  }

  @override
  String get notificationsTitle => 'Notifications';

  @override
  String get notificationsFilterAll => 'All';

  @override
  String get notificationsFilterUnread => 'Unread';

  @override
  String get notificationsFilterMilestones => 'Milestones';

  @override
  String get notificationsFilterTeam => 'Team';

  @override
  String get notificationsMarkAllRead => 'Mark All Read';

  @override
  String get notificationsClearAll => 'Clear All';

  @override
  String get notificationsEmptyState =>
      'No notifications yet. We\'ll notify you of important team updates!';

  @override
  String get notificationsTimeNow => 'Just now';

  @override
  String notificationsTimeMinutes(int minutes) {
    return '${minutes}m ago';
  }

  @override
  String notificationsTimeHours(int hours) {
    return '${hours}h ago';
  }

  @override
  String notificationsTimeDays(int days) {
    return '${days}d ago';
  }

  @override
  String get gettingStartedTitle => 'Getting Started';

  @override
  String get gettingStartedWelcome => 'Welcome to Team Build Pro!';

  @override
  String get gettingStartedIntro =>
      'Let\'s get you set up for success. This quick guide will walk you through the essential features to start building your team.';

  @override
  String get gettingStartedStep1Title => 'Make Your List';

  @override
  String get gettingStartedStep2Title => 'Share with Your Network';

  @override
  String get gettingStartedStep3Title => 'Welcome Your New Team Members';

  @override
  String get gettingStartedStep3Description =>
      'When you receive a new team member notification, follow up immediately to welcome them to your team. First impressions matter!';

  @override
  String get gettingStartedStep4Title => 'Engage Your Team';

  @override
  String get gettingStartedStep4Description =>
      'Use the message center to communicate with your team and provide support.';

  @override
  String get gettingStartedButtonStart => 'Get Started';

  @override
  String get gettingStartedButtonNext => 'Next';

  @override
  String get gettingStartedButtonBack => 'Back';

  @override
  String get gettingStartedButtonSkip => 'Skip';

  @override
  String get welcomeTitle => 'Welcome';

  @override
  String get welcomeHeadline => 'Build Your Team.\nGrow Your Business.';

  @override
  String get welcomeSubheadline =>
      'The professional platform for team building and network growth.';

  @override
  String get welcomeButtonSignIn => 'Sign In';

  @override
  String get welcomeButtonSignUp => 'Create Account';

  @override
  String get welcomeFeature1Title => 'Smart Team Tracking';

  @override
  String get welcomeFeature1Description =>
      'Monitor your team growth in real-time with powerful analytics.';

  @override
  String get welcomeFeature2Title => 'Automated Growth';

  @override
  String get welcomeFeature2Description =>
      'Network feeder system automatically transfers qualified members to your team.';

  @override
  String get welcomeFeature3Title => 'Secure Messaging';

  @override
  String get welcomeFeature3Description =>
      'Communicate securely with your team through encrypted messaging.';

  @override
  String get addLinkTitle => 'Add Link';

  @override
  String get addLinkDescription =>
      'Add your business opportunity link to start building your team.';

  @override
  String get addLinkLabelUrl => 'Business Opportunity URL';

  @override
  String get addLinkHintUrl =>
      'Enter the full URL to your business opportunity page';

  @override
  String get addLinkUrlRequired => 'Please enter a URL';

  @override
  String get addLinkUrlInvalid => 'Please enter a valid URL';

  @override
  String get addLinkButtonSave => 'Save Link';

  @override
  String get addLinkButtonTest => 'Test Link';

  @override
  String get addLinkSuccessMessage => 'Business link saved successfully!';

  @override
  String get addLinkErrorMessage => 'Error saving link. Please try again.';

  @override
  String get businessTitle => 'Business Opportunity';

  @override
  String get businessLoadingMessage => 'Loading opportunity details...';

  @override
  String get businessErrorMessage => 'Unable to load opportunity details';

  @override
  String get businessButtonJoin => 'Join Now';

  @override
  String get businessButtonLearnMore => 'Learn More';

  @override
  String get businessButtonContact => 'Contact Sponsor';

  @override
  String get changePasswordTitle => 'Change Password';

  @override
  String get changePasswordLabelCurrent => 'Current Password';

  @override
  String get changePasswordHintCurrent => 'Enter your current password';

  @override
  String get changePasswordCurrentRequired =>
      'Please enter your current password';

  @override
  String get changePasswordLabelNew => 'New Password';

  @override
  String get changePasswordHintNew => 'Enter your new password';

  @override
  String get changePasswordNewRequired => 'Please enter a new password';

  @override
  String get changePasswordLabelConfirm => 'Confirm New Password';

  @override
  String get changePasswordHintConfirm => 'Re-enter your new password';

  @override
  String get changePasswordConfirmRequired =>
      'Please confirm your new password';

  @override
  String get changePasswordMismatch => 'New passwords don\'t match';

  @override
  String get changePasswordButtonUpdate => 'Update Password';

  @override
  String get changePasswordSuccessMessage => 'Password updated successfully!';

  @override
  String get changePasswordErrorMessage =>
      'Error updating password. Please try again.';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatInputHint => 'Type a message...';

  @override
  String get chatButtonSend => 'Send';

  @override
  String get chatEmptyState => 'No messages yet. Start the conversation!';

  @override
  String get chatMessageDeleted => 'This message was deleted';

  @override
  String get chatMessageEdited => 'edited';

  @override
  String chatTypingIndicator(String name) {
    return '$name is typing...';
  }

  @override
  String get chatbotTitle => 'AI Coach';

  @override
  String get chatbotWelcome =>
      'Hi! I\'m your AI coach. How can I help you grow your team today?';

  @override
  String get chatbotInputHint => 'Ask me anything about team building...';

  @override
  String get chatbotSuggestion1 => 'How do I recruit more effectively?';

  @override
  String get chatbotSuggestion2 => 'What are the eligibility requirements?';

  @override
  String get chatbotSuggestion3 => 'How does the feeder system work?';

  @override
  String get chatbotThinking => 'Thinking...';

  @override
  String get companyTitle => 'Company Information';

  @override
  String get companyAboutHeading => 'About Team Build Pro';

  @override
  String get companyAboutText =>
      'Team Build Pro is a professional SaaS platform designed for team building and network growth. We provide the tools and technology to help you build and manage your professional team effectively.';

  @override
  String get companyVersionLabel => 'App Version';

  @override
  String get companyContactHeading => 'Contact Us';

  @override
  String get companyContactEmail => 'support@teambuildpro.com';

  @override
  String get companyContactWebsite => 'www.teambuildpro.com';

  @override
  String get deleteAccountTitle => 'Delete Account';

  @override
  String get deleteAccountWarning => 'Warning: This action cannot be undone!';

  @override
  String get deleteAccountDescription =>
      'Deleting your account will permanently remove all your data, including your profile, team information, and message history. This action is irreversible.';

  @override
  String get deleteAccountConfirmPrompt =>
      'To confirm deletion, please type DELETE below:';

  @override
  String get deleteAccountConfirmHint => 'Enter your email address';

  @override
  String get deleteAccountConfirmMismatch =>
      'Please type DELETE exactly as shown';

  @override
  String get deleteAccountButtonDelete => 'Delete Account';

  @override
  String get deleteAccountButtonCancel => 'Cancel';

  @override
  String get deleteAccountSuccessMessage =>
      'Account successfully deleted. Thank you for using Team Build Pro.';

  @override
  String get deleteAccountErrorMessage =>
      'Error deleting account. Please contact support.';

  @override
  String get editProfileTitle => 'Edit Profile';

  @override
  String get editProfileLabelFirstName => 'First Name';

  @override
  String get editProfileLabelLastName => 'Last Name';

  @override
  String get editProfileLabelEmail => 'Email';

  @override
  String get editProfileLabelPhone => 'Phone Number';

  @override
  String get editProfileLabelCity => 'City';

  @override
  String get editProfileLabelState => 'State/Province';

  @override
  String get editProfileLabelCountry => 'Country';

  @override
  String get editProfileLabelBio => 'Bio';

  @override
  String get editProfileHintBio => 'Tell your team about yourself...';

  @override
  String get editProfileButtonSave => 'Save Changes';

  @override
  String get editProfileButtonCancel => 'Cancel';

  @override
  String get editProfileButtonChangePhoto => 'Change Photo';

  @override
  String get editProfileSuccessMessage => 'Profile updated successfully!';

  @override
  String get editProfileErrorMessage =>
      'Error updating profile. Please try again.';

  @override
  String get eligibilityTitle => 'Eligibility Status';

  @override
  String get eligibilityCurrentStatus => 'Current Status';

  @override
  String get eligibilityStatusQualified => 'Qualified!';

  @override
  String get eligibilityStatusNotQualified => 'Not Yet Qualified';

  @override
  String get eligibilityRequirementsHeading => 'Requirements';

  @override
  String get eligibilityDirectSponsorsLabel => 'Direct Sponsors';

  @override
  String eligibilityDirectSponsorsProgress(int current, int required) {
    return '$current of $required required';
  }

  @override
  String get eligibilityTotalTeamLabel => 'Total Team Members';

  @override
  String eligibilityTotalTeamProgress(int current, int required) {
    return '$current of $required required';
  }

  @override
  String eligibilityProgressBar(int percent) {
    return 'Progress: $percent%';
  }

  @override
  String get eligibilityNextSteps => 'Next Steps';

  @override
  String get eligibilityNextStepsDescription =>
      'Keep sharing your referral link to grow your team and meet the requirements!';

  @override
  String get shareTitle => 'Grow';

  @override
  String get shareYourLinkHeading => 'Your Referral Link';

  @override
  String get shareButtonCopyLink => 'Copy Link';

  @override
  String get shareLinkCopied => 'Link copied to clipboard!';

  @override
  String get shareButtonSms => 'Share via SMS';

  @override
  String get shareButtonEmail => 'Share via Email';

  @override
  String get shareButtonWhatsApp => 'Share via WhatsApp';

  @override
  String get shareButtonMore => 'More Options';

  @override
  String shareMessageTemplate(String link) {
    return 'Hey! I\'m building my team with Team Build Pro. Join me: $link';
  }

  @override
  String get shareStatsHeading => 'Your Sharing Impact';

  @override
  String get shareStatsViews => 'Link Views';

  @override
  String get shareStatsSignups => 'Signups';

  @override
  String get shareStatsConversion => 'Conversion Rate';

  @override
  String get memberDetailTitle => 'Member Details';

  @override
  String get memberDetailLabelName => 'Name';

  @override
  String get memberDetailLabelEmail => 'Email';

  @override
  String get memberDetailLabelPhone => 'Phone';

  @override
  String get memberDetailLabelLocation => 'Location';

  @override
  String get memberDetailLabelJoined => 'Joined';

  @override
  String get memberDetailLabelSponsor => 'Sponsor';

  @override
  String get memberDetailLabelLevel => 'Level';

  @override
  String get memberDetailTeamStats => 'Team Statistics';

  @override
  String memberDetailDirectSponsors(int count) {
    return 'Direct Sponsors: $count';
  }

  @override
  String memberDetailTotalTeam(int count) {
    return 'Total Team: $count';
  }

  @override
  String get memberDetailButtonMessage => 'Send Message';

  @override
  String get memberDetailButtonViewTeam => 'View Their Team';

  @override
  String get messageThreadTitle => 'Messages';

  @override
  String get messageThreadInputHint => 'Type your message...';

  @override
  String get messageThreadButtonSend => 'Send';

  @override
  String get messageThreadEmptyState =>
      'No messages yet. Start the conversation!';

  @override
  String get messageThreadDelivered => 'Delivered';

  @override
  String get messageThreadRead => 'Read';

  @override
  String get messageThreadSending => 'Sending...';

  @override
  String get messageThreadFailed => 'Failed to send';

  @override
  String get loginTitle => 'Sign In';

  @override
  String get loginButtonGoogle => 'Continue with Google';

  @override
  String get loginButtonApple => 'Continue with Apple';

  @override
  String get loginDivider => 'or';

  @override
  String get loginForgotPassword => 'Forgot Password?';

  @override
  String get loginResetPasswordTitle => 'Reset Password';

  @override
  String get loginResetPasswordDescription =>
      'Enter your email address and we\'ll send you a link to reset your password.';

  @override
  String get loginResetPasswordButton => 'Send Reset Link';

  @override
  String get loginResetPasswordSuccess =>
      'Password reset email sent! Check your inbox.';

  @override
  String get loginResetPasswordError =>
      'Error sending reset email. Please try again.';

  @override
  String get commonButtonCancel => 'Cancel';

  @override
  String get commonButtonSave => 'Save';

  @override
  String get commonButtonDelete => 'Delete';

  @override
  String get commonButtonEdit => 'Edit';

  @override
  String get commonButtonClose => 'Close';

  @override
  String get commonButtonOk => 'OK';

  @override
  String get commonButtonYes => 'Yes';

  @override
  String get commonButtonNo => 'No';

  @override
  String get commonLoading => 'Loading...';

  @override
  String get commonLoadingMessage => 'Loading...';

  @override
  String get commonErrorMessage => 'Something went wrong. Please try again.';

  @override
  String get commonSuccessMessage => 'Success!';

  @override
  String get commonNoDataMessage => 'No data available';

  @override
  String get commonRetryButton => 'Retry';

  @override
  String get commonRefreshButton => 'Refresh';

  @override
  String get authSignupErrorFirstName => 'First name cannot be empty';

  @override
  String get authSignupErrorLastName => 'Last name cannot be empty';

  @override
  String addLinkHeading(String business) {
    return 'Add Your\n$business Link';
  }

  @override
  String get addLinkImportantLabel => 'IMPORTANT INFORMATION';

  @override
  String addLinkDisclaimer(String business) {
    return 'You are updating your Team Build Pro account to track referrals to $business. This is a separate, independent business entity that is NOT owned, operated, or affiliated with Team Build Pro.';
  }

  @override
  String get addLinkGrowthTitle => 'Unlocking Your Growth Engine';

  @override
  String get addLinkInstructionBullet1 =>
      'Your referral link will be stored in your Team Build Pro profile for tracking purposes only.';

  @override
  String addLinkInstructionBullet2(String business) {
    return 'When your team members qualify and join the $business opportunity, they will automatically be placed in your official team';
  }

  @override
  String get addLinkInstructionBullet3 =>
      'This link can only be set once, so please verify it\'s correct before saving.';

  @override
  String get addLinkWarning =>
      'Team Build Pro is a referral tracking platform only. We do not endorse or guarantee any business opportunities.';

  @override
  String get addLinkFinalStepTitle => 'Final Step: Link Your Account';

  @override
  String addLinkFinalStepSubtitle(String business) {
    return 'This ensures your new team members are automatically placed in your $business organization.';
  }

  @override
  String addLinkFieldInstruction(String business) {
    return 'Enter your $business referral link below. This will be used to track referrals from your team.';
  }

  @override
  String addLinkMustBeginWith(String baseUrl) {
    return 'Must begin with:\n$baseUrl';
  }

  @override
  String get addLinkFieldLabel => 'Enter Your Referral Link';

  @override
  String addLinkFieldHelper(String baseUrl) {
    return 'Must start with $baseUrl\nThis cannot be changed once set';
  }

  @override
  String addLinkFieldError(String business) {
    return 'Please enter your $business referral link.';
  }

  @override
  String get addLinkConfirmFieldLabel => 'Confirm Referral Link URL';

  @override
  String get addLinkConfirmFieldError => 'Please confirm your referral link.';

  @override
  String get addLinkPreviewLabel => 'Referral Link Preview:';

  @override
  String get addLinkSaving => 'Validating & Saving...';

  @override
  String get addLinkDialogImportantTitle => 'Very Important!';

  @override
  String addLinkDialogImportantMessage(String business) {
    return 'You must enter the exact referral link you received from $business. This will ensure your team members that join $business are automatically placed in your $business team.';
  }

  @override
  String get addLinkDialogImportantButton => 'I Understand';

  @override
  String get addLinkDialogDuplicateTitle => 'Referral Link Already in Use';

  @override
  String addLinkDialogDuplicateMessage(String business) {
    return 'The $business referral link you entered is already in use by another Team Build Pro member.';
  }

  @override
  String get addLinkDialogDuplicateInfo =>
      'You must use a different referral link to continue.';

  @override
  String get addLinkDialogDuplicateButton => 'Try Different Link';

  @override
  String get businessHeroTitle => 'Congratulations\nYou\'re Qualified!';

  @override
  String businessHeroMessage(String business) {
    return 'Your hard work and team-building have paid off. You are now eligible to join the $business opportunity.';
  }

  @override
  String get businessDisclaimerTitle => 'Disclaimer Notice';

  @override
  String businessDisclaimerMessage(String business) {
    return 'Your team growth has unlocked access to $business. This opportunity operates as an independent business and has no affiliation with the Team Build Pro platform.';
  }

  @override
  String businessDisclaimerInfo(String business) {
    return 'The Team Build Pro App simply facilitates access to $business via your upline sponsor. It does not endorse or guarantee any specific outcomes from this opportunity.';
  }

  @override
  String get businessSponsorTitle => 'Your Referral Contact';

  @override
  String businessSponsorMessage(String business, String sponsor) {
    return 'If you choose to explore $business, your referral contact will be $sponsor. This person is a member of your upline team who has already joined $business.';
  }

  @override
  String businessInstructionsTitle(String business) {
    return 'How to Join $business';
  }

  @override
  String businessInstructions(String business) {
    return '1. Copy the referral link below\n2. Open your web browser\n3. Paste the link and complete the $business registration\n4. Return here to add your $business referral link';
  }

  @override
  String get businessNoUrlMessage =>
      'Registration URL not available. Please contact your sponsor.';

  @override
  String get businessUrlLabel => 'Your Sponsors Referral Link:';

  @override
  String get businessUrlCopyTooltip => 'Copy URL';

  @override
  String get businessUrlCopiedMessage =>
      'Registration URL copied to clipboard!';

  @override
  String businessUrlCopyError(String error) {
    return 'Failed to copy URL: $error';
  }

  @override
  String get businessFollowUpTitle => 'Final Step: Link Your Account';

  @override
  String businessFollowUpMessage(String business) {
    return 'After exploring $business, you must return here and add your new $business referral link to your Team Build Pro profile. This ensures your team connections are tracked correctly.';
  }

  @override
  String get businessCompleteButton1 => 'Registration Complete';

  @override
  String get businessCompleteButton2 => 'Add My Referral Link';

  @override
  String get businessConfirmDialogTitle => 'Before You Continue';

  @override
  String businessConfirmDialogMessage(String business) {
    return 'This is the next step in your journey. After joining $business through your sponsor\'s link, you must return here to add your new $business referral link to your profile. This is a critical step to ensure your new team members are placed correctly.';
  }

  @override
  String get businessConfirmDialogButton => 'I Understand';

  @override
  String get businessVisitRequiredTitle => 'Visit Required First';

  @override
  String businessVisitRequiredMessage(String business) {
    return 'Before updating your profile, you must first use the \'Copy Registration Link\' button on this page to visit $business and complete your registration.';
  }

  @override
  String get businessVisitRequiredButton => 'OK';

  @override
  String get gettingStartedHeading => 'Getting Started with Team Build Pro';

  @override
  String get gettingStartedSubheading =>
      'Follow these simple steps to start building your team';

  @override
  String gettingStartedStep1Description(String business) {
    return 'Create a list of recruiting prospects and current $business team members you want to share Team Build Pro with. Think about who could benefit from this tool to accelerate their team building.';
  }

  @override
  String gettingStartedStep2Description(String business) {
    return 'Use the Share feature to quickly and easily send targeted text messages and emails to your recruiting prospects and $business team members.';
  }

  @override
  String get gettingStartedStep2Button => 'Open Share';

  @override
  String get gettingStartedProTipTitle => 'Pro Tip';

  @override
  String get gettingStartedProTipMessage =>
      'Consistent follow-up and engagement are key to building a strong, active team.';

  @override
  String get eligibilityHeroTitleQualified =>
      'CONGRATULATIONS\nYou\'re Qualified!';

  @override
  String get eligibilityHeroTitleNotQualified => 'Build Your Momentum';

  @override
  String eligibilityHeroMessageQualified(String business) {
    return 'Incredible work! You\'ve built your foundational team and unlocked the $business opportunity. Continue growing your network to help others achieve the same success.';
  }

  @override
  String eligibilityHeroMessageNotQualified(String business) {
    return 'You\'re on your way! Every professional you connect with builds momentum for your future launch in the $business opportunity. Keep sharing to reach your goals!';
  }

  @override
  String get eligibilityHeroButton => 'Proven Growth Strategies';

  @override
  String get eligibilityThresholdsTitle => 'QUALIFICATION THRESHOLDS';

  @override
  String get eligibilityLabelDirectSponsors => 'Direct Sponsors';

  @override
  String get eligibilityLabelTotalTeam => 'Total Team';

  @override
  String get eligibilityCurrentCountsTitle => 'YOUR CURRENT TEAM COUNTS';

  @override
  String get eligibilityCurrentDirectSponsors => 'Direct Sponsors';

  @override
  String get eligibilityCurrentTotalTeam => 'Total Team';

  @override
  String get eligibilityProcessTitle => 'THE PROCESS';

  @override
  String get eligibilityProcessStep1Title => 'INVITE - Build Your Foundation';

  @override
  String eligibilityProcessStep1Description(String business) {
    return 'Connect with like-minded professionals open to exploring $business.';
  }

  @override
  String get eligibilityProcessStep2Title => 'CULTIVATE - Create Momentum';

  @override
  String get eligibilityProcessStep2Description =>
      'Foster authentic relationships as your team grows, creating a thriving team of professionals who support each other\'s success.';

  @override
  String get eligibilityProcessStep3Title => 'PARTNER - Launch with Success';

  @override
  String eligibilityProcessStep3Description(String business) {
    return 'Team members receive an invitation to join $business upon achieving key growth targets.';
  }

  @override
  String get shareHeading => 'Powerful Referral System';

  @override
  String get shareSubheading =>
      'Share your referral links to pre-build a new team with recruiting prospects or expand your existing team.';

  @override
  String get shareStrategiesTitle => 'Proven Growth Strategies';

  @override
  String get shareProspectTitle => 'New Recruiting Prospects';

  @override
  String get shareProspectSubtitle =>
      'Invite recruiting prospects to get a head start.';

  @override
  String shareProspectDescription(String business) {
    return 'Invite recruiting prospects to pre-build their $business team with this app. They can create powerful momentum before officially joining $business, ensuring success from day one.';
  }

  @override
  String get sharePartnerTitle => 'Current Business Partners';

  @override
  String sharePartnerSubtitle(String business) {
    return 'Great for your existing $business team';
  }

  @override
  String sharePartnerDescription(String business) {
    return 'Empower your existing $business partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire $business organization.';
  }

  @override
  String get shareSelectMessageLabel => 'Select Message To Send';

  @override
  String get shareButtonShare => 'Share';

  @override
  String get shareLinkCopiedMessage => 'Link copied to clipboard!';

  @override
  String get shareProTipsTitle => 'Pro Tips for Success';

  @override
  String get shareProTip1 => '💬 Personalize your message when sharing';

  @override
  String get shareProTip2 =>
      '📱 Share consistently across all social platforms';

  @override
  String get shareProTip3 => '🤝 Follow up with prospects who show interest';

  @override
  String get shareProTip4 => '📈 Track your results and adjust your approach';

  @override
  String get shareProTip5 =>
      '🎯 Use both strategies for maximum growth potential';

  @override
  String get shareDemoTitle => 'Demo Mode';

  @override
  String get shareDemoMessage => 'Sharing disabled during demo mode.';

  @override
  String get shareDemoButton => 'I Understand';

  @override
  String get memberDetailButtonSendMessage => 'Send Message';

  @override
  String get memberDetailLabelDirectSponsors => 'Direct Sponsors';

  @override
  String get memberDetailLabelJoinedNetwork => 'Joined Network';

  @override
  String memberDetailLabelJoinedOrganization(String bizOpp) {
    return 'Joined $bizOpp';
  }

  @override
  String get memberDetailLabelQualified => 'Qualified';

  @override
  String get memberDetailLabelQualifiedDate => 'Qualified Date';

  @override
  String get memberDetailLabelTeamLeader => 'Team Leader';

  @override
  String get memberDetailLabelTotalTeam => 'Total Team';

  @override
  String get memberDetailNotYet => 'Not Yet';

  @override
  String get memberDetailNotYetJoined => 'Not Yet Joined';

  @override
  String get memberDetailEligibilityTitle => 'Eligibility Requirements';

  @override
  String get memberDetailEligibilityDirectSponsors => 'Direct Sponsors';

  @override
  String get memberDetailEligibilityTotalTeam => 'Total Team';

  @override
  String memberDetailEligibilityMessage(String organization) {
    return 'Team members who meet these requirements are automatically invited to join the $organization.';
  }

  @override
  String get memberDetailEligibilityWaived => 'Waived';

  @override
  String memberDetailEligibilityWaivedMessage(String organization) {
    return 'Eligibility requirements are waived for individuals who joined $organization prior to joining the Network.';
  }

  @override
  String get messageThreadHeading => 'Message Center';

  @override
  String get messageThreadEmptyMessage => 'Start the conversation!';

  @override
  String get messageThreadUrlWarningTitle => 'External Link Warning';

  @override
  String get messageThreadUrlWarningMessage =>
      'This message contains an external link. Be cautious when clicking links from unknown sources.';

  @override
  String get messageThreadUrlWarningButton => 'Understood';

  @override
  String get chatbotAssistantTitle => 'AI Assistant';

  @override
  String get chatbotAssistantSubtitle => 'Ask me anything about Team Build Pro';

  @override
  String get chatbotClearTooltip => 'Clear conversation';

  @override
  String get chatbotSignInRequired => 'Please sign in to use the AI Assistant';

  @override
  String get companyHeading => 'Company Details';

  @override
  String get companyLabelName => 'Company Name';

  @override
  String get companyLabelReferralLink => 'My Company Referral Link';

  @override
  String get companyLinkedTitle => 'Account Linked!';

  @override
  String companyLinkedMessage(String business) {
    return 'Great news! As your team members gain momentum and qualify, they will receive an invitation to join your $business organization.';
  }

  @override
  String get companyNotAvailable => 'Not available';

  @override
  String get deleteAccountHeading => 'Account Deletion';

  @override
  String get deleteAccountSubheading =>
      'We\'re sorry to see you go. Please review the information below carefully.';

  @override
  String get deleteAccountWarningTitle => 'PERMANENT ACCOUNT DELETION';

  @override
  String get deleteAccountWarningMessage =>
      'This action cannot be undone. When you delete your account:';

  @override
  String get deleteAccountWarning1 =>
      'Your personal data will be permanently deleted';

  @override
  String get deleteAccountWarning2 =>
      'You will lose access to all premium features';

  @override
  String get deleteAccountWarning3 =>
      'Your account cannot be recovered or reactivated';

  @override
  String get deleteAccountWarning4 =>
      'Your network relationships will be preserved for business continuity';

  @override
  String get deleteAccountWarning5 =>
      'You will be immediately signed out of all devices';

  @override
  String get deleteAccountInfoTitle => 'Account Information';

  @override
  String get deleteAccountConfirmTitle => 'Confirmation Required';

  @override
  String get deleteAccountConfirmLabel =>
      'To confirm deletion, please type your email address:';

  @override
  String get deleteAccountCheckbox1 =>
      'I understand this action is permanent and cannot be undone';

  @override
  String get deleteAccountCheckbox2 =>
      'I understand I will lose access to all data and premium features';

  @override
  String get deleteAccountCheckbox3 =>
      'I acknowledge my network relationships will be preserved for business operations';

  @override
  String get deleteAccountDeleting => 'Deleting...';

  @override
  String get deleteAccountHelpTitle => 'Need Help?';

  @override
  String get deleteAccountHelpMessage =>
      'If you\'re experiencing issues with the app, please contact our support team before deleting your account.';

  @override
  String get deleteAccountHelpButton => 'Contact Support';

  @override
  String get deleteAccountDemoTitle => 'Demo Account Protection';

  @override
  String get deleteAccountDemoMessage =>
      'This is a protected demo account and cannot be deleted.\n\nDemo accounts are maintained for app review and demonstration purposes.\n\nIf you are testing the app, please create a new account for testing account deletion features.';

  @override
  String get deleteAccountDemoButton => 'OK';

  @override
  String deleteAccountErrorFailed(String error) {
    return 'Account deletion failed: $error';
  }

  @override
  String get deleteAccountErrorEmailMismatch =>
      'The email address you entered does not match your account email. Please check and try again.';

  @override
  String get deleteAccountErrorNotFound =>
      'We could not find your account in our system. Please contact support for assistance.';

  @override
  String get deleteAccountErrorSessionExpired =>
      'Your session has expired. Please sign out and sign in again, then retry account deletion.';

  @override
  String get deleteAccountErrorPermissionDenied =>
      'You do not have permission to delete this account. Please contact support if you need assistance.';

  @override
  String get deleteAccountErrorServerError =>
      'An unexpected error occurred on our servers. Please try again in a few minutes or contact support.';

  @override
  String get deleteAccountErrorServiceUnavailable =>
      'The service is temporarily unavailable. Please check your internet connection and try again.';

  @override
  String get deleteAccountErrorProcessing =>
      'We encountered an issue processing your request. Please try again or contact support for help.';

  @override
  String get deleteAccountErrorUnexpected =>
      'An unexpected error occurred. Please try again or contact support@teambuildpro.com for assistance.';

  @override
  String get deleteAccountErrorEmailApp =>
      'Could not launch email app. Please contact support@teambuildpro.com manually.';

  @override
  String get editProfileHeading => 'Edit Profile';

  @override
  String get editProfileHeadingFirstTime => 'Complete Your Profile';

  @override
  String get editProfileInstructionsFirstTime =>
      'Please complete your profile to get started';

  @override
  String get editProfileBusinessQuestion => 'Are you currently a ';

  @override
  String get editProfileBusinessQuestionSuffix => ' representative?';

  @override
  String get editProfileYes => 'Yes';

  @override
  String get editProfileNo => 'No';

  @override
  String get editProfileDialogImportantTitle => 'Very Important!';

  @override
  String editProfileDialogImportantMessage(String business) {
    return 'You must enter the exact referral link you received from your $business sponsor.';
  }

  @override
  String get editProfileDialogImportantButton => 'I Understand';

  @override
  String get editProfileReferralLinkField => 'Enter Your Referral Link';

  @override
  String get editProfileReferralLinkLabel => 'Your Referral Link';

  @override
  String editProfileReferralLinkHelper(String business) {
    return 'Enter the referral link from your $business sponsor';
  }

  @override
  String get editProfileConfirmReferralLink => 'Confirm Referral Link';

  @override
  String get editProfileSelectCountry => 'Select Your Country';

  @override
  String get editProfileSelectState => 'Select Your State/Province';

  @override
  String get editProfileSelectStateDisabled => 'First select a country';

  @override
  String get editProfileErrorCity => 'Please enter your city';

  @override
  String get editProfileErrorState => 'Please select your state/province';

  @override
  String get editProfileErrorCountry => 'Please select your country';

  @override
  String get editProfilePhotoError =>
      'Error uploading photo. Please try again.';

  @override
  String get editProfileDeletionTitle => 'Delete Account';

  @override
  String get editProfileDeletionMessage =>
      'Permanently delete your account and all associated data.';

  @override
  String get editProfileDeletionSubtext => 'This action cannot be undone';

  @override
  String get editProfileDeletionButton => 'Complete Deletion';

  @override
  String get loginLabelEmail => 'Email';

  @override
  String get loginLabelPassword => 'Password';

  @override
  String get loginValidatorEmail => 'Please enter your email';

  @override
  String get loginValidatorPassword => 'Please enter your password';

  @override
  String get loginButtonLogin => 'Login';

  @override
  String get loginButtonBiometric => 'Sign in with Biometric';

  @override
  String get loginDividerOr => 'or';

  @override
  String get loginNoAccount => 'Don\'t have an account? ';

  @override
  String get loginCreateAccount => 'Create Account';

  @override
  String get loginPrivacyPolicy => 'Privacy Policy';

  @override
  String get loginTermsOfService => 'Terms of Service';

  @override
  String welcomeGreeting(String firstName) {
    return 'Welcome, $firstName!';
  }

  @override
  String get welcomeMessageAdmin =>
      'Ready to lead the professional networking revolution? Complete your admin profile and set up your team. After completing your profile you will have access to the full Team Build Pro platform.';

  @override
  String get welcomeMessageUser =>
      'Ready to transform your professional network? Complete your profile to unlock the full power of Team Build Pro.';

  @override
  String get welcomeButtonJoin => 'Join the Revolution';

  @override
  String get changePasswordHeading => 'Change Password';

  @override
  String get changePasswordTodoMessage =>
      'TODO: Implement change password form here.';

  @override
  String get chatPlaceholder => 'Chat interface goes here.';

  @override
  String get quickPromptsWelcomeTitle => 'Welcome to your AI Coach!';

  @override
  String get quickPromptsWelcomeDescription =>
      'I\'m here to help you succeed with Team Build Pro. I can answer questions about the app, team building strategies, and guide you through features.';

  @override
  String get quickPromptsDisclaimerMessage =>
      'AI Coach can make mistakes. Check important info.';

  @override
  String get quickPromptsQuestionHeader => 'What can I help you with?';

  @override
  String get quickPromptsQuestionSubheader =>
      'Tap any question below to get started, or type your own question.';

  @override
  String get quickPromptsProTipLabel => 'Pro Tip';

  @override
  String get quickPromptsProTipText =>
      'Be specific with your questions. For example: \"I have 2 direct sponsors, what should I focus on next?\"';

  @override
  String get chatbotPrompt1 => 'How does qualification work?';

  @override
  String get chatbotPrompt2 =>
      'What\'s the difference between this and an MLM?';

  @override
  String get chatbotPrompt3 => 'How do I invite people to my team?';

  @override
  String get chatbotPrompt4 => 'Show me my team analytics';

  @override
  String get chatbotPrompt5 => 'What should I focus on next?';

  @override
  String get chatbotPrompt6 => 'How do I cancel my subscription?';

  @override
  String get chatbotPrompt7 => 'Why do most people fail at direct sales?';

  @override
  String get chatbotPrompt8 => 'What happens after I qualify?';

  @override
  String get shareProspectPastStrugglesTitle => 'Addressing Past Struggles';

  @override
  String get shareProspectPastStrugglesDescription =>
      'Perfect for prospects who have tried before and struggled';

  @override
  String shareProspectPastStrugglesSubject(Object business) {
    return 'Thinking About $business Again? Found a Different Approach';
  }

  @override
  String shareProspectPastStrugglesMessage(Object business, Object link) {
    return 'I know we\'ve both had some rough experiences with direct sales before. $business keeps coming up, and I\'ve been hesitant too.\n\nBut I found something different - an app called Team Build Pro that lets you build a team BEFORE actually joining anything. The idea is you can see if you can actually recruit people before investing.\n\nIt has AI coaching and pre-written messages so you don\'t have to figure everything out alone.\n\nI\'m trying it out myself. If you\'re still curious about $business, this might be worth a look:\n\n$link\n\nFigured we could explore this together and see if it\'s any different this time.';
  }

  @override
  String get shareProspectNotSalespersonTitle => 'For Non-Sales Minded';

  @override
  String get shareProspectNotSalespersonDescription =>
      'Great for people who don\'t see themselves as \"salespeople\"';

  @override
  String get shareProspectNotSalespersonSubject =>
      'Found Something for Non-Salespeople Like Us';

  @override
  String shareProspectNotSalespersonMessage(Object business, Object link) {
    return 'You know I\'m not a natural salesperson. That\'s why I\'ve always hesitated with things like $business.\n\nI found this app called Team Build Pro that\'s designed for people like us. It has 16 pre-written messages and an AI Coach, so you don\'t have to come up with sales pitches on your own.\n\nThe cool part? You can build a team BEFORE joining any opportunity. So you can see if you\'re actually comfortable with the recruiting part without committing first.\n\nI\'m testing it out myself. Thought you might relate:\n\n$link\n\nMaybe we\'re not as \"non-salesy\" as we think - we just needed the right tools.';
  }

  @override
  String get shareProspectHopeAfterDisappointmentTitle =>
      'Hope After Disappointment';

  @override
  String get shareProspectHopeAfterDisappointmentDescription =>
      'Ideal for prospects burned by previous opportunities';

  @override
  String shareProspectHopeAfterDisappointmentSubject(Object business) {
    return 'Another Look at $business? This Time With a Safety Net';
  }

  @override
  String shareProspectHopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'I know you\'ve been burned before. Me too. The promises of $business and other opportunities that never panned out.\n\nI found something that feels different - not another opportunity, but a tool. Team Build Pro lets you build a team BEFORE joining anything. You can see actual results before investing.\n\nNo hype. Just an AI Coach, pre-written messages, and a way to track real progress.\n\nI\'m exploring it myself because I\'m tired of starting from zero every time:\n\n$link\n\nIf it doesn\'t work, at least we\'ll know before putting money in. Thought you might want to try alongside me.';
  }

  @override
  String get shareProspectGeneralInvitationTitle => 'General Invitation';

  @override
  String get shareProspectGeneralInvitationDescription =>
      'A versatile message for any prospect situation';

  @override
  String shareProspectGeneralInvitationSubject(Object business) {
    return 'Exploring $business? Found Something Interesting';
  }

  @override
  String shareProspectGeneralInvitationMessage(Object business, Object link) {
    return 'Hey! I\'ve been looking into $business and found something that caught my attention.\n\nThere\'s an app called Team Build Pro that lets you build a team BEFORE you officially join any opportunity. The idea is you can test the waters and build momentum without committing first.\n\nIt has:\n- 16 pre-written recruiting messages\n- An AI Coach for guidance\n- A way to track who\'s interested\n\nI\'m exploring it myself. Thought you might want to check it out too since I know you\'ve been curious about $business.\n\nTake a look: $link\n\nNo pressure - just sharing what I found.';
  }

  @override
  String get shareProspectSocialAnxietyTitle =>
      'Avoiding Awkward Conversations';

  @override
  String get shareProspectSocialAnxietyDescription =>
      'Perfect for introverts or those uncomfortable with face-to-face recruiting';

  @override
  String get shareProspectSocialAnxietySubject =>
      'Building a Network Without the Awkward Conversations';

  @override
  String shareProspectSocialAnxietyMessage(Object business, Object link) {
    return 'The reason I\'ve never gone all-in on $business or similar? The thought of awkward sales conversations makes me cringe.\n\nI found Team Build Pro - it lets you build a team online, at your own pace, with pre-written messages. No cold calls, no face-to-face pitches.\n\nAnd here\'s the thing: you can do all this BEFORE joining any opportunity. So you can build confidence and see if it works for you without the pressure.\n\nI\'m trying it myself. Figured you might appreciate the low-pressure approach too:\n\n$link\n\nWe can build networks without being \"that person\" at parties.';
  }

  @override
  String get shareProspectTimeConstrainedTitle => 'For Busy Professionals';

  @override
  String get shareProspectTimeConstrainedDescription =>
      'Ideal for prospects juggling job, family, and other commitments';

  @override
  String shareProspectTimeConstrainedSubject(Object business) {
    return 'Exploring $business in Spare Moments';
  }

  @override
  String shareProspectTimeConstrainedMessage(Object business, Object link) {
    return 'I know you\'re as busy as I am. That\'s always been the excuse for not exploring things like $business.\n\nI found Team Build Pro - you can build a team in small chunks of time. 15 minutes here, 20 minutes there. The AI Coach and pre-written messages make it efficient.\n\nBest part? You do this BEFORE joining any opportunity. So you can test it around your schedule without commitment.\n\nI\'m trying it during lunch breaks and coffee time:\n\n$link\n\nIf it works for someone as time-crunched as us, might be worth exploring together.';
  }

  @override
  String get shareProspectFinancialRiskAverseTitle => 'Afraid of Losing Money';

  @override
  String get shareProspectFinancialRiskAverseDescription =>
      'Great for prospects worried about financial risk';

  @override
  String shareProspectFinancialRiskAverseSubject(Object business) {
    return 'Testing $business Without Financial Risk First';
  }

  @override
  String shareProspectFinancialRiskAverseMessage(Object business, Object link) {
    return 'The thing that\'s always stopped me from $business? I hate losing money on things that don\'t work out.\n\nI found Team Build Pro - it lets you build a team BEFORE joining any opportunity. You can see actual results before investing in anything.\n\nThe app is just \$6.99/month after a free trial. Way less than buying into an opportunity blind.\n\nI\'m testing it to see if I can actually recruit people first:\n\n$link\n\nThought you might appreciate the low-risk approach too. See proof before spending real money.';
  }

  @override
  String get shareProspectSkepticalRealistTitle => 'Show Me Proof';

  @override
  String get shareProspectSkepticalRealistDescription =>
      'Perfect for prospects burned by false promises';

  @override
  String shareProspectSkepticalRealistSubject(Object business) {
    return 'No Hype - Just Testing $business the Smart Way';
  }

  @override
  String shareProspectSkepticalRealistMessage(Object business, Object link) {
    return 'I\'m as skeptical as you are. Every $business pitch sounds the same - \"life-changing income!\" Yeah, right.\n\nI found Team Build Pro - not another opportunity, just a tool. It shows you real metrics: who you\'ve contacted, who\'s interested, your actual progress. No fluff.\n\nAnd you can do all this BEFORE joining anything. Data before decisions.\n\nI\'m testing it to see if the numbers actually work:\n\n$link\n\nNo promises. No hype. Just let me know if the data looks interesting to you.';
  }

  @override
  String get shareProspect2GeneralInvitationTitle => 'General Invitation';

  @override
  String get shareProspect2GeneralInvitationDescription =>
      'A versatile message for any prospect situation';

  @override
  String shareProspect2GeneralInvitationSubject(Object business) {
    return 'Build Your $business Team Before Day 1';
  }

  @override
  String shareProspect2GeneralInvitationMessage(Object business, Object link) {
    return 'Thinking about joining $business? I want to share something that can give you a real advantage.\n\nTeam Build Pro lets you build your team BEFORE you officially join. So when you start with me, you\'re not starting from zero - you launch with people already waiting.\n\nThe app includes:\n- 16 pre-written recruiting messages ready to share\n- 24/7 AI Coach for recruiting questions\n- Real-time tracking of who\'s interested\n\nI\'ve seen what happens when new team members start cold. This changes that.\n\nCheck it out: $link\n\nWhen you\'re ready to join my $business team, you\'ll hit the ground running.';
  }

  @override
  String get shareProspect2PastStrugglesTitle => 'Addressing Past Struggles';

  @override
  String get shareProspect2PastStrugglesDescription =>
      'Perfect for prospects who have tried before and struggled';

  @override
  String get shareProspect2PastStrugglesSubject =>
      'This Time Will Be Different - Here\'s Why';

  @override
  String shareProspect2PastStrugglesMessage(Object business, Object link) {
    return 'I know you\'ve struggled before with direct sales. Past attempts at $business or similar opportunities left you starting from zero.\n\nThat\'s exactly why I want you on my team - and why I\'m sharing Team Build Pro with you.\n\nIt lets you build your $business team BEFORE you officially join. With 16 pre-written messages and an AI Coach walking you through every step, you won\'t be alone this time.\n\nI\'ll be your sponsor AND you\'ll have AI support 24/7.\n\nSee how it works: $link\n\nYou deserve a real shot. Let me help you get it right this time.';
  }

  @override
  String get shareProspect2NotSalespersonTitle => 'For Non-Sales Minded';

  @override
  String get shareProspect2NotSalespersonDescription =>
      'Great for people who don\'t see themselves as \"salespeople\"';

  @override
  String shareProspect2NotSalespersonSubject(Object business) {
    return 'Join My $business Team - No Sales Personality Required';
  }

  @override
  String shareProspect2NotSalespersonMessage(Object business, Object link) {
    return 'Not a natural salesperson? That\'s okay - you don\'t need to be to succeed on my team.\n\nTeam Build Pro gives you 16 pre-written recruiting messages and an AI Coach. You focus on genuine relationships. The AI handles the \"sales stuff.\"\n\nAnd here\'s the best part: you can build your team BEFORE joining $business. Build confidence with the tools first.\n\nI\'ll guide you as your sponsor, and the AI coaches you 24/7.\n\nStart building: $link\n\nIt\'s like having a recruiting assistant who never sleeps. Join my team and let the tools work for you.';
  }

  @override
  String get shareProspect2HopeAfterDisappointmentTitle =>
      'Hope After Disappointment';

  @override
  String get shareProspect2HopeAfterDisappointmentDescription =>
      'Ideal for prospects burned by previous opportunities';

  @override
  String shareProspect2HopeAfterDisappointmentSubject(Object business) {
    return 'Join My $business Team With Real Support This Time';
  }

  @override
  String shareProspect2HopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'I know you\'ve been burned before. Empty promises, zero support, starting from scratch.\n\nThat\'s not how I run my team.\n\nTeam Build Pro lets you build your $business team BEFORE you officially join. Real momentum before Day 1. No hype - just AI-powered tools that actually work.\n\nI\'ll be your sponsor, the AI Coach guides you 24/7, and you\'ll have pre-written messages ready to go.\n\nSee how: $link\n\nYou deserve a system that sets you up to win. I want you on my team.';
  }

  @override
  String get shareProspect2SocialAnxietyTitle =>
      'Avoiding Awkward Conversations';

  @override
  String get shareProspect2SocialAnxietyDescription =>
      'Perfect for introverts or those uncomfortable with face-to-face recruiting';

  @override
  String shareProspect2SocialAnxietySubject(Object business) {
    return 'Build Your $business Team Without Awkward Conversations';
  }

  @override
  String shareProspect2SocialAnxietyMessage(Object business, Object link) {
    return 'Uncomfortable with awkward sales conversations? I get it. That\'s why I use Team Build Pro with my team.\n\nIt lets you build your $business network online, at your own pace:\n- 16 pre-written messages - no \"what do I say?\"\n- Build prospects at your own pace\n- 24/7 AI guidance when you need it\n\nNo cold calls. No face-to-face pitches required. And you can start building BEFORE you join.\n\nStart on your terms: $link\n\nWhen you join my team, you\'ll have real momentum from people you recruited comfortably online.';
  }

  @override
  String get shareProspect2TimeConstrainedTitle => 'For Busy Professionals';

  @override
  String get shareProspect2TimeConstrainedDescription =>
      'Ideal for prospects juggling job, family, and other commitments';

  @override
  String shareProspect2TimeConstrainedSubject(Object business) {
    return 'Build Your $business Team in the Gaps of Your Life';
  }

  @override
  String shareProspect2TimeConstrainedMessage(Object business, Object link) {
    return 'I know you\'re busy. That\'s actually why $business could work for you - and why I want you on my team.\n\nTeam Build Pro lets you build your team BEFORE you officially join - in small pockets of time. Morning coffee. Lunch break. Evening downtime.\n\nThe AI Coach and 16 pre-written messages make every minute count:\n- Track all prospects in one place\n- Get AI guidance whenever you have a few minutes\n- See your momentum grow\n\nSee how it fits your life: $link\n\nWhen you\'re ready to join my team, you won\'t be starting from zero. You\'ll launch with people already waiting.';
  }

  @override
  String get shareProspect2FinancialRiskAverseTitle => 'Afraid of Losing Money';

  @override
  String get shareProspect2FinancialRiskAverseDescription =>
      'Great for prospects worried about financial risk';

  @override
  String shareProspect2FinancialRiskAverseSubject(Object business) {
    return 'See Results Before Investing in $business';
  }

  @override
  String shareProspect2FinancialRiskAverseMessage(
      Object business, Object link) {
    return 'Worried about losing money? Smart. That\'s why I recommend Team Build Pro to everyone joining my team.\n\nIt lets you build your $business team BEFORE you officially invest - so you see real results first.\n\nTrack your actual progress:\n- Who\'s interested in joining\n- Your momentum building\n- Proof the system works for you\n\nOnly \$6.99/month after a free trial. Way less risk than jumping in blind.\n\nSee proof first: $link\n\nWhen you finally join my $business team, you\'re launching with people already waiting - not risking everything on hope.';
  }

  @override
  String get shareProspect2SkepticalRealistTitle => 'Show Me Proof';

  @override
  String get shareProspect2SkepticalRealistDescription =>
      'Perfect for prospects burned by false promises';

  @override
  String shareProspect2SkepticalRealistSubject(Object business) {
    return 'No Hype. Real Metrics. Join My $business Team.';
  }

  @override
  String shareProspect2SkepticalRealistMessage(Object business, Object link) {
    return 'Tired of empty promises? Me too. That\'s why I run my $business team differently.\n\nTeam Build Pro shows you real metrics every step:\n- How many people you\'ve contacted\n- Who\'s responded and interested\n- Your actual progress toward qualification\n- Next steps the AI recommends\n\nNo fluff. No exaggeration. Just data. And you can do all this BEFORE joining.\n\nSee the transparency: $link\n\nWhen you join my team, you\'ll launch with proof - not blind faith. That\'s the only way I do business.';
  }

  @override
  String get sharePartnerWarmMarketExhaustedTitle => 'Warm Market Exhausted';

  @override
  String get sharePartnerWarmMarketExhaustedDescription =>
      'For partners who\'ve tapped out friends and family';

  @override
  String get sharePartnerWarmMarketExhaustedSubject =>
      'Give Your Team an AI Recruiting Companion';

  @override
  String sharePartnerWarmMarketExhaustedMessage(Object business, Object link) {
    return 'Your $business team tapped out their warm market? Tired of watching them chase leads that ghost them?\n\nGive your entire $business organization an AI recruiting companion.\n\nTeam Build Pro works for every person on your team:\n- 16 pre-written messages eliminate \"what do I say?\"\n- Track prospect interest and engagement\n- 24/7 AI Coach answers their questions\n- Everyone duplicates the same proven system\n\nTheir prospects pre-build teams BEFORE joining - launching with momentum, not from zero.\n\nYour entire $business team gets the same AI advantage. True duplication at scale.\n\nEmpower your team: $link\n\nStop watching them chase. Start watching them succeed.';
  }

  @override
  String get sharePartnerExpensiveSystemFatigueTitle =>
      'System Fatigue & Expense';

  @override
  String get sharePartnerExpensiveSystemFatigueDescription =>
      'For partners burned out on expensive recruiting methods';

  @override
  String get sharePartnerExpensiveSystemFatigueSubject =>
      'Stop Overpaying. Empower Your Team with AI';

  @override
  String sharePartnerExpensiveSystemFatigueMessage(
      Object business, Object link) {
    return 'Your $business team burning money on leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro gives your entire $business organization AI recruiting tools - built right in. No extra costs. No complex setup.\n\nEvery person on your team gets:\n- 16 pre-written recruiting messages\n- Real-time engagement tracking\n- 24/7 AI Coach for guidance\n- One simple system that duplicates\n\nTheir prospects pre-build teams BEFORE joining. Your $business team duplicates the exact same AI tools. Everyone wins.\n\nOne simple system. Real results.\n\nEmpower your team: $link\n\nStop overpaying. Start scaling smart.';
  }

  @override
  String get sharePartnerDuplicationStruggleTitle => 'Duplication Challenges';

  @override
  String get sharePartnerDuplicationStruggleDescription =>
      'For leaders struggling to get their team to duplicate';

  @override
  String get sharePartnerDuplicationStruggleSubject =>
      'Finally, Real Duplication for Your Team';

  @override
  String sharePartnerDuplicationStruggleMessage(Object business, Object link) {
    return 'Your $business team struggles to duplicate your recruiting success? That ends today.\n\nTeam Build Pro gives every person on your $business team the same AI recruiting coach you wish you\'d had:\n- Drafts their recruiting messages\n- Times their follow-ups perfectly\n- Tracks their prospects automatically\n- Coaches their next steps\n\nNew recruit or veteran leader - everyone in your $business organization gets identical AI tools. True system duplication.\n\nTheir prospects pre-build teams BEFORE joining. Your team grows faster. Consistently.\n\nEmpower true duplication: $link\n\nFinally, your entire team succeeds the same way.';
  }

  @override
  String get sharePartnerGeneralTeamToolTitle => 'General Invitation';

  @override
  String get sharePartnerGeneralTeamToolDescription =>
      'A versatile message for any partner situation';

  @override
  String get sharePartnerGeneralTeamToolSubject =>
      'The AI Recruiting Advantage for Your Team';

  @override
  String sharePartnerGeneralTeamToolMessage(Object business, Object link) {
    return 'Your $business team deserves a real competitive edge.\n\nTeam Build Pro gives your entire $business organization AI recruiting tools that actually duplicate:\n\n- 16 pre-written recruiting messages for any situation\n- Track prospect engagement in real-time\n- 24/7 AI Coach for recruiting guidance\n- True duplication - everyone gets the same tools\n\nYour team\'s prospects pre-build their teams BEFORE joining. Your partners duplicate the exact same AI tools. Everyone in your $business organization grows faster.\n\nGive your team the AI advantage: $link\n\nThis is how modern leaders scale their teams.';
  }

  @override
  String get sharePartnerRetentionCrisisTitle => 'Team Dropout Problem';

  @override
  String get sharePartnerRetentionCrisisDescription =>
      'For leaders frustrated by team members quitting early';

  @override
  String get sharePartnerRetentionCrisisSubject =>
      'Stop Losing Your Team in the First Year';

  @override
  String sharePartnerRetentionCrisisMessage(Object business, Object link) {
    return 'Watching your $business team quit before they succeed?\n\n75% drop out in their first year - usually because they feel lost, unsupported, or overwhelmed.\n\nTeam Build Pro changes that for your entire $business organization. Every person on your team gets an AI Coach that:\n- Answers their recruiting questions 24/7\n- Tracks their progress and celebrates wins\n- Provides 16 pre-written messages for confidence\n- Keeps momentum going when motivation dips\n\nThey\'re never alone. They always know their next step. They stay engaged longer.\n\nYour $business team finally has the support they need to succeed.\n\nEmpower your team: $link\n\nStop watching them quit. Start watching them win.';
  }

  @override
  String get sharePartnerSkillGapTeamTitle => 'Non-Sales Team Members';

  @override
  String get sharePartnerSkillGapTeamDescription =>
      'Perfect for teams where most people lack sales experience';

  @override
  String get sharePartnerSkillGapTeamSubject =>
      'Your Non-Sales Team Can Win with AI';

  @override
  String sharePartnerSkillGapTeamMessage(Object business, Object link) {
    return 'Most of your $business team aren\'t natural salespeople. That\'s been holding them back.\n\nTeam Build Pro turns your non-sales $business partners into confident recruiters:\n- 16 pre-written recruiting messages ready to send\n- Track prospects and see real momentum\n- 24/7 AI Coach for guidance and support\n- Everyone uses the same proven system\n\nYour introverts, your part-timers, your \"I\'m not good at sales\" people - everyone in your $business organization gets the same AI advantage.\n\nFinally, your entire team can duplicate your success.\n\nEmpower everyone: $link\n\nYou don\'t need a team of salespeople. You need a team with AI.';
  }

  @override
  String get sharePartnerRecruitmentFatigueTitle =>
      'Tired of Constant Recruiting';

  @override
  String get sharePartnerRecruitmentFatigueDescription =>
      'For partners exhausted from the endless recruiting cycle';

  @override
  String get sharePartnerRecruitmentFatigueSubject =>
      'Automate the Grind. Grow Your Team.';

  @override
  String sharePartnerRecruitmentFatigueMessage(Object business, Object link) {
    return 'Your $business team burned out from constant recruiting? The endless follow-ups? The manual tracking?\n\nTeam Build Pro\'s AI handles the grind for your entire $business organization.\n\nFor every person on your team, the AI:\n- Provides 16 pre-written recruiting messages\n- Tracks every prospect and their status\n- Answers recruiting questions 24/7\n- Keeps everyone focused on what works\n\nYou stay focused on leadership. Your $business team stays productive without burning out.\n\nThe AI never gets tired. Your team\'s momentum never stops.\n\nEmpower sustainable growth: $link\n\nGrowth without the burnout. Finally.';
  }

  @override
  String get sharePartnerAvailabilityGapTitle => 'Can\'t Be There 24/7';

  @override
  String get sharePartnerAvailabilityGapDescription =>
      'Ideal for leaders who can\'t be constantly available to their team';

  @override
  String get sharePartnerAvailabilityGapSubject =>
      'Your Team Grows Even When You\'re Not There';

  @override
  String sharePartnerAvailabilityGapMessage(Object business, Object link) {
    return 'Your $business team needs you. But you can\'t be available 24/7.\n\nTeam Build Pro gives your entire $business organization an AI Coach that\'s always on.\n\nWhile you sleep, work your day job, or spend time with family, the AI:\n- Answers their recruiting questions anytime\n- Provides 16 pre-written messages ready to use\n- Tracks their progress and keeps them motivated\n- Ensures nothing falls through the cracks\n\nYour $business team gets support exactly when they need it - not just when you\'re available.\n\nYou stay focused on leadership. The AI handles daily coaching.\n\nEmpower your team: $link\n\nFinally, your team grows without needing you every minute.';
  }

  @override
  String get homepageDemoCredentialsNotAvailable =>
      'Demo credentials not available';

  @override
  String homepageDemoLoginFailed(Object error) {
    return 'Demo login failed: $error';
  }

  @override
  String get homepageDemoLoginFailedGeneric =>
      'Demo login failed. Please try again.';

  @override
  String get homepageHeroJumpstart => 'JUMPSTART YOUR SUCCESS';

  @override
  String get homepageHeroGrow => 'GROW AND MANAGE YOUR TEAM';

  @override
  String get homepageHeroProven => 'PROVEN TEAM BUILDING SYSTEM';

  @override
  String get homepageHeroBuildFoundation => 'Build Your Foundation';

  @override
  String get homepageHeroBeforeDayOne => 'Before Day One';

  @override
  String get homepageHeroEmpowerTeam => 'Empower Your Team';

  @override
  String get homepageHeroAccelerate => 'Accelerate ';

  @override
  String get homepageHeroGrowth => 'Growth';

  @override
  String get homepageLoading => 'Loading...';

  @override
  String homepageMessageTitlePersonal(Object sponsorName) {
    return 'A Personal Message\nFrom $sponsorName';
  }

  @override
  String get homepageMessageTitleGeneric => 'A Message From\nTeam Build Pro';

  @override
  String get homepageMessageBodyNewProspect1 =>
      'I\'m so glad you\'re here to get a head start on building your ';

  @override
  String get homepageMessageBodyNewProspect2 =>
      ' team. The next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!';

  @override
  String get homepageMessageBodyRefPartner1 =>
      'I\'m using the Team Build Pro app to accelerate the growth of my ';

  @override
  String get homepageMessageBodyRefPartner2 =>
      ' team and income! I highly recommend it for you as well.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!';

  @override
  String get homepageMessageBodyGeneric =>
      'Team Build Pro is the ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial!';

  @override
  String get homepageButtonCreateAccount => 'Create Account';

  @override
  String get homepageButtonAlreadyHaveAccount => 'I Already Have an Account';

  @override
  String get homepageDemoModeActive => 'Demo Mode Active';

  @override
  String get homepageDemoPreLoaded => 'Pre-Loaded Demo Account';

  @override
  String get homepageDemoWelcome => 'Welcome to Team Build Pro Demo';

  @override
  String get homepageDemoDescription =>
      'This is a fully functional demo account pre-loaded with realistic team data. Explore all features and see how Team Build Pro can transform your direct sales business!';

  @override
  String get homepageDemoCredentialsLabel => 'Access Credentials:';

  @override
  String homepageDemoEmail(Object email) {
    return 'Email: $email';
  }

  @override
  String homepageDemoPassword(Object password) {
    return 'Password: $password';
  }

  @override
  String get homepageDemoLoggingIn => 'Logging In...';

  @override
  String get homepageDemoStartDemo => 'Start Demo!';

  @override
  String get homepageTrust100Secure => '100% Secure';

  @override
  String get homepageTrust30DayFree => '30-Day Free';

  @override
  String get homepageTrust24Support => '24/7 Support';

  @override
  String get homepageFooterTerms => 'Terms of Service';

  @override
  String get homepageFooterPrivacy => 'Privacy Policy';

  @override
  String get authLoginAccountRequiredTitle => 'Account Required';

  @override
  String get authLoginAccountRequiredMessage =>
      'It looks like you need to create an account first. Would you like to register now?';

  @override
  String get authLoginCancelButton => 'Cancel';

  @override
  String get authLoginRegisterButton => 'Register';

  @override
  String get authLoginAppBarTitle => 'Sign In';

  @override
  String get authLoginSubtitle => 'Sign in to continue building your team';

  @override
  String get authLoginOrContinueWith => 'or continue with';

  @override
  String get authLoginForgotPassword => 'Forgot Password?';

  @override
  String get authLoginContinueWithGoogle => 'Continue with Google';

  @override
  String get authLoginContinueWithApple => 'Continue with Apple';

  @override
  String get authLoginBiometricButton => 'Sign in with biometric';

  @override
  String get authLoginResetPasswordTitle => 'Reset Password';

  @override
  String get authLoginCheckEmailTitle => 'Check Your Email';

  @override
  String get authLoginResetEmailSent => 'We\'ve sent a password reset link to:';

  @override
  String get authLoginResetInstructions =>
      'Please check your inbox and follow the instructions to reset your password.';

  @override
  String get authLoginResetPrompt =>
      'Enter your email address and we\'ll send you a link to reset your password.';

  @override
  String get authLoginResetEmailLabel => 'Email';

  @override
  String get authLoginResetEmailHint => 'Enter your email address';

  @override
  String get authLoginResetEmailRequired => 'Please enter your email';

  @override
  String get authLoginResetEmailInvalid => 'Please enter a valid email';

  @override
  String get authLoginDoneButton => 'Done';

  @override
  String get authLoginSendResetLink => 'Send Reset Link';

  @override
  String get authSignupInvalidInviteLinkMessage =>
      'That doesn\'t look like an invite link. Please paste the full link you received.';

  @override
  String get authSignupNewReferralDialogTitle => 'New Referral Code Detected';

  @override
  String get authSignupNewReferralDialogMessage =>
      'A new referral code has been detected:';

  @override
  String authSignupNewReferralNewCode(Object code) {
    return 'New code: $code';
  }

  @override
  String authSignupNewReferralNewSource(Object source) {
    return 'Source: $source';
  }

  @override
  String authSignupNewReferralCurrentCode(Object code) {
    return 'Current code: $code';
  }

  @override
  String authSignupNewReferralCurrentSource(Object source) {
    return 'Current source: $source';
  }

  @override
  String get authSignupNewReferralPrompt =>
      'Would you like to update your referral code?';

  @override
  String get authSignupKeepCurrentButton => 'Keep Current';

  @override
  String get authSignupUseNewCodeButton => 'Use New Code';

  @override
  String get authSignupAppBarTitle => 'TEAM BUILD PRO';

  @override
  String get authSignupLoginButton => 'Log In';

  @override
  String get authSignupConfirmSponsorButton => 'Tap to confirm your sponsor';

  @override
  String get authSignupNoSponsorFound => 'Sorry, no sponsor found';

  @override
  String get authSignupPageTitle => 'Account Registration';

  @override
  String get authSignupInviteLinkButton => 'I have an invite link';

  @override
  String get authSignupInviteLinkInstructions =>
      'If someone sent you an invite link, you can paste it here.';

  @override
  String get authSignupPasteInviteLinkButton => 'Paste invite link';

  @override
  String authSignupInvitedBy(Object sponsorName) {
    return 'Invited by: $sponsorName';
  }

  @override
  String authSignupReferralCodeDebug(Object code, Object source) {
    return 'Code: $code (source: $source)';
  }

  @override
  String get authSignupAppleButton => 'Sign up with Apple';

  @override
  String get authSignupGoogleButton => 'Sign up with Google';

  @override
  String get authSignupOrEmailDivider => 'or sign up with email';

  @override
  String get authSignupLoginSectionTitle => 'Create Your Login';

  @override
  String get authSignupPrivacyAssurance =>
      '🔒 Your email will never be shared with anyone';

  @override
  String get authSignupRequiredForAccount => '🔒 Required for account creation';

  @override
  String get settingsAuthRequired => 'Authentication required.';

  @override
  String get settingsUserNotFound => 'User profile not found.';

  @override
  String get settingsAccessDenied => 'Access Denied: Admin role required.';

  @override
  String settingsLoadFailed(Object error) {
    return 'Failed to load settings: $error';
  }

  @override
  String get settingsBusinessNameInvalid =>
      'Business name can only contain letters, numbers, and common punctuation.';

  @override
  String get settingsReferralLinkInvalid =>
      'Please enter a valid referral link (e.g., https://example.com).';

  @override
  String get settingsOrgNameMismatch =>
      'Organization Name fields must match for confirmation.';

  @override
  String get settingsReferralLinkMismatch =>
      'Referral Link fields must match for confirmation.';

  @override
  String get settingsUserNotAuthenticated => 'User not authenticated.';

  @override
  String get settingsUpgradeRequiredTitle => 'Upgrade Required';

  @override
  String get settingsUpgradeRequiredMessage =>
      'Upgrade your Admin subscription to save these changes.';

  @override
  String get settingsCancelButton => 'Cancel';

  @override
  String get settingsUpgradeButton => 'Upgrade Now';

  @override
  String get settingsSavedSuccess => 'Settings saved successfully.';

  @override
  String settingsSaveFailed(Object error) {
    return 'Failed to save settings: $error';
  }

  @override
  String get settingsRequired => 'Required';

  @override
  String get settingsNotSet => 'Not Set';

  @override
  String get settingsSuperAdminOnly =>
      '🚫 Only Super Admin can perform database cleanup';

  @override
  String settingsCleanupError(Object error) {
    return 'Error: $error';
  }

  @override
  String get settingsCleanupDryRunTitle => '🔍 Dry-Run Results';

  @override
  String get settingsCleanupCompleteTitle => '✅ Cleanup Complete';

  @override
  String get settingsCleanupTotalUsers => 'Total Users:';

  @override
  String get settingsCleanupNonAdminUsers => 'Non-Admin Users:';

  @override
  String get settingsCleanupProtectedAdmins => 'Protected Admins:';

  @override
  String get settingsCleanupDeleted => 'Deleted:';

  @override
  String get settingsCleanupDeletedUsers => 'Users:';

  @override
  String get settingsCleanupDeletedChats => 'Chats:';

  @override
  String get settingsCleanupDeletedChatLogs => 'Chat Logs:';

  @override
  String get settingsCleanupDeletedChatUsage => 'Chat Usage:';

  @override
  String get settingsCleanupDeletedReferralCodes => 'Referral Codes:';

  @override
  String get settingsOkButton => 'OK';

  @override
  String get profileUpdateBiometricFailed =>
      'Biometric authentication failed. Please try again.';

  @override
  String get profileUpdatePasswordRequired =>
      'Password required to enable biometric login';

  @override
  String get profileUpdateEmailNotFound => 'User email not found';

  @override
  String get profileUpdateBiometricEnabled =>
      '✅ Biometric login enabled successfully';

  @override
  String get profileUpdatePasswordIncorrect =>
      'Incorrect password. Please try again.';

  @override
  String profileUpdateBiometricError(Object error) {
    return 'Error enabling biometric: $error';
  }

  @override
  String get profileUpdateBiometricDisabled => 'Biometric login disabled';

  @override
  String get profileUpdateConfirmPasswordTitle => 'Confirm Password';

  @override
  String get profileUpdateConfirmPasswordMessage =>
      'To securely store your credentials for biometric login, please enter your password.';

  @override
  String get profileUpdatePasswordLabel => 'Password';

  @override
  String get profileUpdateCancelButton => 'Cancel';

  @override
  String get profileUpdateConfirmButton => 'Confirm';

  @override
  String get profileUpdateDisableBiometricTitle => 'Disable Biometric Login';

  @override
  String get profileUpdateDisableBiometricMessage =>
      'Are you sure you want to disable biometric login? You will need to use your email and password to sign in.';

  @override
  String get profileUpdateDisableButton => 'Disable';

  @override
  String get profileUpdatePictureRequired => 'Please upload your profile pic.';

  @override
  String get profileUpdateImageNotProvided => 'Image was not provided.';

  @override
  String get profileUpdateSuccess => 'Profile updated successfully!';

  @override
  String profileUpdateError(Object error) {
    return 'Error updating profile: $error';
  }

  @override
  String get profileUpdateDemoModeTitle => 'Demo Mode';

  @override
  String get profileUpdateDemoModeMessage =>
      'Profile editing disabled in demo mode.';

  @override
  String get profileUpdateDemoUnderstandButton => 'I Understand';

  @override
  String get profileUpdateScreenTitle => 'Update Profile';

  @override
  String get profileUpdateNoEmail => 'No email';

  @override
  String get profileUpdateSelectCountry => 'Select Country';

  @override
  String get profileUpdateCountryLabel => 'Country';

  @override
  String get profileUpdateCountryRequired => 'Please select a country';

  @override
  String get profileUpdateSelectState => 'Select State/Province';

  @override
  String get profileUpdateSelectCountryFirst => 'Select a country first';

  @override
  String get profileUpdateStateLabel => 'State/Province';

  @override
  String get profileUpdateStateRequired => 'Please select a state/province';

  @override
  String get profileUpdateCityLabel => 'City';

  @override
  String get profileUpdateCityRequired => 'Please enter a city';

  @override
  String get profileUpdateSecurityHeader => 'Security Settings';

  @override
  String get profileUpdateBiometricToggle => 'Enable Biometric Login';

  @override
  String get profileUpdateBiometricChecking =>
      'Checking device compatibility...';

  @override
  String get profileUpdateBiometricDescription =>
      'Use fingerprint or face recognition to login';

  @override
  String get profileUpdateBiometricNotAvailable =>
      'Not available on this device';

  @override
  String get profileUpdateSaveButton => 'Save Changes';

  @override
  String get profileEditDeletionSuccess =>
      'Account deletion completed. Thank you for using Team Build Pro.';

  @override
  String profileEditDeletionError(Object error) {
    return 'Error completing account deletion: $error';
  }

  @override
  String get profileEditUrlInvalid =>
      'Please enter a valid URL (e.g., https://example.com)';

  @override
  String get profileEditHttpsRequired =>
      'Referral link must use HTTPS (not HTTP) for security';

  @override
  String get profileEditUrlFormatInvalid =>
      'Invalid URL format. Please check your referral link.';

  @override
  String get profileEditUnableToVerify => 'Unable to verify referral link';

  @override
  String get profileEditDomainRequired =>
      'Please enter a valid link with a proper domain';

  @override
  String get profileEditNoLocalhost =>
      'Please enter a valid business referral link\n(not localhost or IP address)';

  @override
  String get profileEditDomainWithTld =>
      'Please enter a valid link with a proper domain\n(e.g., company.com)';

  @override
  String profileEditBaseUrlRequired(Object baseUrl) {
    return 'Referral link must begin with:\n$baseUrl';
  }

  @override
  String get profileEditNotHomepage =>
      'Please enter your unique referral link,\nnot just the homepage';

  @override
  String get profileEditInvalidFormat => 'Invalid link format';

  @override
  String get profileEditReferralRequired => 'Please enter your referral link';

  @override
  String get profileEditConfirmReferral => 'Please confirm your referral link';

  @override
  String get profileEditCompleteLink =>
      'Please enter a complete link starting with\nhttp:// or https://';

  @override
  String get profileEditValidReferralRequired =>
      'Please enter a valid referral link (e.g., https://example.com).';

  @override
  String get profileEditReferralMismatch =>
      'Referral Link fields must match for confirmation.';

  @override
  String get profileEditInvalidLinkTitle => 'Invalid Referral Link';

  @override
  String profileEditInvalidLinkMessage(Object businessName) {
    return 'The $businessName referral link could not be verified. The link may be incorrect, inactive, or temporarily unavailable.';
  }

  @override
  String get profileEditContactSponsor =>
      'Please check the link and try again, or contact your sponsor for the correct referral link.';

  @override
  String get profileEditTryAgainButton => 'Try Again';

  @override
  String profileEditReferralHint(Object baseUrl) {
    return 'e.g., ${baseUrl}your_username_here';
  }

  @override
  String get profileEditRequiredForRep =>
      'Required when you are a representative';

  @override
  String get adminProfilePictureRequired => 'Please select a profile picture';

  @override
  String get adminProfileCountryRequired => 'Please select a country';

  @override
  String get adminProfileStateRequired => 'Please select a state/province';

  @override
  String get adminProfileCityRequired => 'Please enter your city';

  @override
  String get adminProfileSetupTitle =>
      '🛠️ Setting up your business profile...';

  @override
  String get adminProfileSetupDescription =>
      'Getting your business information ready';

  @override
  String get adminProfileUserNotAuthenticated => 'User not authenticated';

  @override
  String get adminProfileUploadFailed => 'Failed to upload image';

  @override
  String get adminProfileSaveSuccess =>
      'Profile information saved successfully!';

  @override
  String adminProfileSaveError(Object error) {
    return 'Error: $error';
  }

  @override
  String get adminProfileScreenTitle => 'Admin Profile';

  @override
  String get adminProfileSetupHeader => 'Profile Setup';

  @override
  String get adminProfileNoEmail => 'No email';

  @override
  String get adminProfileCountryLabel => 'Country';

  @override
  String get adminProfileStateLabel => 'State/Province';

  @override
  String get adminProfileCityLabel => 'City';

  @override
  String get adminProfileNextButton => 'Next - Business Information';

  @override
  String get subscriptionAppBarTitle => 'Team Build Pro';

  @override
  String get subscriptionPremiumHeader => 'Premium Features:';

  @override
  String get subscriptionStatusActive => 'Active Subscription';

  @override
  String get subscriptionStatusActiveSubtitle =>
      'You have full access to all premium features';

  @override
  String get subscriptionStatusPaused => 'Subscription Paused';

  @override
  String get subscriptionStatusPausedSubtitle =>
      'Your subscription is paused. Resume to restore access.';

  @override
  String get subscriptionStatusPaymentIssue => 'Payment Issue';

  @override
  String get subscriptionStatusPaymentIssueSubtitle =>
      'Update payment method to restore access';

  @override
  String get subscriptionStatusTrialActive => 'Free Trial Active';

  @override
  String subscriptionStatusTrialDaysRemaining(Object days) {
    return '$days days remaining in your trial';
  }

  @override
  String get subscriptionStatusCancelled => 'Subscription Cancelled';

  @override
  String get subscriptionStatusCancelledSubtitle =>
      'Access continues until expiry date';

  @override
  String get subscriptionStatusExpired => 'Subscription Expired';

  @override
  String get subscriptionStatusExpiredSubtitle =>
      'Upgrade to restore premium features';

  @override
  String subscriptionFeature1(Object businessName) {
    return 'Submit your unique $businessName referral link';
  }

  @override
  String get subscriptionFeature2 =>
      'Custom AI Coaching for recruiting and team building';

  @override
  String get subscriptionFeature3 => 'Unlock messaging to users on your team';

  @override
  String subscriptionFeature4(Object businessName) {
    return 'Ensure team members join under YOU in $businessName';
  }

  @override
  String get subscriptionFeature5 => 'Advanced analytics and insights';

  @override
  String get subscriptionActivatedSuccess =>
      '✅ Subscription activated successfully!';

  @override
  String get subscriptionNotActiveTitle => 'Subscription Not Active';

  @override
  String get subscriptionNotActiveMessage =>
      'Purchase started but not active yet. Try again.';

  @override
  String get subscriptionNotAvailableTitle => 'Subscription Not Available';

  @override
  String get subscriptionNotAvailableMessageIOS =>
      'In-app purchases are currently unavailable on your device. This may be due to restrictions set by your organization or device administrator.\n\nPlease check your Screen Time settings or contact your IT department if you\'re using a managed device.\n\nAlternatively, you can subscribe through our website.';

  @override
  String get subscriptionNotAvailableMessageAndroid =>
      'In-app purchases are currently unavailable on your device. This may be due to restrictions or network issues.\n\nPlease try again later or contact support if the problem persists.';

  @override
  String get subscriptionNotAvailableMessageDefault =>
      'In-app purchases are currently unavailable. Please try again later.';

  @override
  String get subscriptionOkButton => 'OK';

  @override
  String get subscriptionRestoredSuccess =>
      '✅ Subscription restored successfully!';

  @override
  String get subscriptionNoPreviousFound =>
      'No previous subscription found to restore.';

  @override
  String get subscriptionSubscribeButton => 'Subscribe Now - \$6.99/month';

  @override
  String get subscriptionRestoreButton => 'Restore Previous Subscription';

  @override
  String get subscriptionLegalNotice =>
      'By subscribing, you agree to our Terms of Service and Privacy Policy.';

  @override
  String get subscriptionTermsLink => 'Terms of Service';

  @override
  String get subscriptionSeparator => ' | ';

  @override
  String get subscriptionPrivacyLink => 'Privacy Policy';

  @override
  String subscriptionAutoRenewNotice(String managementText) {
    return 'Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. $managementText';
  }

  @override
  String get subscriptionManageIOS =>
      'You can manage your subscription in your Apple ID account settings.';

  @override
  String get subscriptionManageAndroid =>
      'You can manage your subscription in the Google Play Store.';

  @override
  String get subscriptionManageDefault =>
      'You can manage your subscription in your device\'s app store.';

  @override
  String get subscriptionPlatformAppStore => 'App Store';

  @override
  String get subscriptionPlatformPlayStore => 'Google Play Store';

  @override
  String get subscriptionPlatformGeneric => 'app store';

  @override
  String get subscriptionDefaultBizOpp => 'your opportunity';

  @override
  String get termsScreenTitle => 'Terms of Service';

  @override
  String get termsHeaderTitle => 'Terms of Service';

  @override
  String get termsSubtitle => 'Professional Networking Platform Agreement';

  @override
  String termsLastUpdated(Object date) {
    return 'Last Updated: $date';
  }

  @override
  String get termsFooterBadgeTitle => 'Apple Store Compliant';

  @override
  String get termsFooterBadgeDescription =>
      'These Terms of Service meet all Apple App Store guidelines and requirements for platform applications.';

  @override
  String get termsDisclaimerTitle => 'PROFESSIONAL NETWORKING PLATFORM';

  @override
  String get termsDisclaimerSubtitle => 'Service Overview';

  @override
  String get privacyScreenTitle => 'Privacy Policy';

  @override
  String get privacyHeaderTitle => 'Privacy Policy';

  @override
  String privacyLastUpdated(Object date) {
    return 'Last Updated: $date';
  }

  @override
  String get privacyEmailSubject => 'subject=Privacy Policy Inquiry';

  @override
  String privacyEmailError(Object email) {
    return 'Could not open email client. Please contact $email';
  }

  @override
  String get privacyMattersTitle => 'Your Privacy Matters';

  @override
  String get privacyMattersDescription =>
      'We are committed to protecting your personal information and your right to privacy. This policy explains how we collect, use, and safeguard your data.';

  @override
  String get privacyAppleComplianceTitle => 'Apple Privacy Compliance';

  @override
  String get privacyAppleComplianceDescription =>
      'This app follows Apple\'s privacy guidelines and App Store requirements. We are transparent about data collection and give you control over your information.';

  @override
  String get privacyContactHeading => 'Contact Us';

  @override
  String get privacyContactSubheading => 'Questions about this Privacy Policy?';

  @override
  String get privacyContactDetails =>
      'Team Build Pro\nPrivacy Officer\nResponse within 48 hours';

  @override
  String privacyCopyright(Object year) {
    return '© $year Team Build Pro. All rights reserved.';
  }

  @override
  String get privacyFooterDisclaimer =>
      'This Privacy Policy is effective as of the date listed above and applies to all users of the Team Build Pro mobile application.';

  @override
  String get howItWorksScreenTitle => 'How It Works';

  @override
  String get howItWorksHeaderTitle => 'How It Works';

  @override
  String get howItWorksHeroSubtitle =>
      'Transform your recruiting with a pre-qualified team pipeline.';

  @override
  String get howItWorksFeaturedOpportunity => 'Featured Opportunity';

  @override
  String get howItWorksPipelineSystem => 'PIPELINE SYSTEM';

  @override
  String get howItWorksStep1Title => 'Set Your Foundation';

  @override
  String howItWorksStep1Description(Object business) {
    return 'Customize your Team Build Pro account with your opportunity details and connect your referral link - turning the app into your personal recruiting pipeline.';
  }

  @override
  String get howItWorksStep2Title => 'Build Smart, Not Hard';

  @override
  String get howItWorksStep2Description =>
      'Use AI-powered coaching to draft messages, schedule follow-ups, and track interest. Build relationships with prospects before they even join your business opportunity.';

  @override
  String get howItWorksStep3Title => 'Automatic Qualification';

  @override
  String howItWorksStep3Description(Object business) {
    return 'As prospects build their own teams within the app, they automatically hit qualification milestones (4 direct sponsors + 20 total team) - proving their commitment before joining.';
  }

  @override
  String get howItWorksStep4Title => 'Rapid Growth';

  @override
  String get howItWorksStep4Description =>
      'Your pre-qualified prospects launch with momentum, teams already in place, and proven ability to recruit. This creates a self-sustaining growth engine.';

  @override
  String get howItWorksKeyTargetsTitle => ' KEY GROWTH TARGETS';

  @override
  String get howItWorksDirectSponsors => 'Direct Sponsors';

  @override
  String get howItWorksTotalTeam => 'Total Team Members';

  @override
  String get howItWorksCtaHeading => 'Grow Your Network';

  @override
  String get howItWorksCtaDescription =>
      'Expand your Network to drive organization growth!';

  @override
  String get howItWorksCtaButton => 'Proven Growth Strategies';

  @override
  String get howItWorksDefaultBizOpp => 'your opportunity';

  @override
  String get termsDisclaimerContent =>
      '• Team Build Pro is a subscription-based networking platform\n• Users pay a monthly subscription fee for access to networking tools\n• The platform provides relationship management and business connection features\n• All business opportunities are provided by independent third parties\n\nTeam Build Pro operates as a networking platform and does not guarantee business outcomes.';

  @override
  String get termsSection1Title => '1. ACCEPTANCE OF TERMS';

  @override
  String get termsSection1Content =>
      'By downloading, installing, accessing, or using the Team Build Pro mobile application (\"App\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, do not use the App.\n\nThese Terms constitute a legally binding agreement between you and Team Build Pro regarding your use of our professional networking platform service.';

  @override
  String get termsSection2Title => '2. SERVICE DESCRIPTION';

  @override
  String get termsSection2Content =>
      'Team Build Pro is a subscription-based professional networking platform that provides:\n\n• Contact relationship management tools\n• Team building and networking features\n• Communication and collaboration tools\n• Business opportunity information from third-party providers\n• AI-powered coaching and guidance\n\nIMPORTANT DISCLAIMERS:\n• Team Build Pro is a networking platform service, not a business opportunity\n• Users pay a monthly subscription fee for platform access\n• We do not guarantee any business results or income\n• All business opportunities are provided by independent third parties\n• Success depends entirely on individual effort and market conditions';

  @override
  String get termsSection3Title => '3. SUBSCRIPTION AND PAYMENT';

  @override
  String get termsSection3Content =>
      'ACCESS AND FEES:\n• The App operates on a subscription basis\n• Monthly subscription fees are charged through your Apple ID account\n• Subscription automatically renews unless cancelled\n• Prices are shown in the App and may vary by region\n\nBILLING CYCLE:\n• You will be charged at confirmation of purchase\n• Your subscription automatically renews each month\n• Charges occur 24 hours before the end of the current period\n• You can manage subscriptions in your Apple ID Account Settings\n\nCANCELLATION:\n• Cancel anytime through Apple ID Account Settings\n• Cancellation takes effect at the end of the current billing period\n• No refunds for partial months\n• Access continues until the end of the paid period';

  @override
  String get termsSection4Title => '4. FREE TRIAL (IF APPLICABLE)';

  @override
  String get termsSection4Content =>
      'TRIAL TERMS:\n• Some subscription plans may include a free trial period\n• Trial duration will be clearly displayed before signup\n• You may cancel during the trial to avoid charges\n• If you don\'t cancel, you\'ll be charged the subscription fee\n\nCONVERSION TO PAID:\n• Trials convert to paid subscriptions automatically\n• Charges begin immediately after trial ends\n• The subscription price shown at signup applies\n• Cancel before trial ends to avoid charges';

  @override
  String get termsSection5Title => '5. APPLE IN-APP PURCHASE TERMS';

  @override
  String get termsSection5Content =>
      'All subscriptions are processed through Apple\'s In-App Purchase system and are subject to Apple\'s Terms of Service and policies.\n\nAPPLE\'S ROLE:\n• Payment is charged to your Apple ID account\n• Subscriptions managed through Apple ID Account Settings\n• Refund requests handled by Apple according to their policies\n• Apple\'s Standard EULA terms apply unless otherwise specified\n\nYOUR RESPONSIBILITIES:\n• Maintain accurate Apple ID payment information\n• Monitor subscription status in your Apple account\n• Contact Apple Support for billing issues\n• Review Apple\'s terms at: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

  @override
  String get termsSection6Title => '6. USER ACCOUNTS AND REGISTRATION';

  @override
  String get termsSection6Content =>
      'ACCOUNT CREATION:\n• You must create an account to use the App\n• Provide accurate, current, and complete information\n• You are responsible for maintaining account confidentiality\n• You must be at least 18 years old to create an account\n\nACCOUNT SECURITY:\n• Keep your password secure and confidential\n• Notify us immediately of unauthorized access\n• You are responsible for all activity under your account\n• Do not share your account with others\n\nACCOUNT TERMINATION:\n• We may suspend or terminate accounts that violate these Terms\n• You may delete your account at any time through the App\n• Termination does not affect subscription billing unless cancelled\n• We reserve the right to refuse service to anyone';

  @override
  String get termsSection7Title => '7. PROHIBITED CONDUCT';

  @override
  String get termsSection7Content =>
      'You agree NOT to:\n\n• Use the App for any illegal purpose\n• Violate any applicable laws or regulations\n• Infringe on intellectual property rights\n• Transmit harmful code, viruses, or malware\n• Harass, abuse, or harm other users\n• Impersonate others or provide false information\n• Attempt to gain unauthorized access to the App\n• Interfere with App functionality or security\n• Use automated systems to access the App without permission\n• Collect user information without consent\n• Engage in any activity that disrupts the App\n• Use the App to promote illegal schemes or scams';

  @override
  String get termsSection8Title => '8. INTELLECTUAL PROPERTY';

  @override
  String get termsSection8Content =>
      'OWNERSHIP:\n• Team Build Pro owns all rights to the App and its content\n• This includes software, design, text, graphics, and logos\n• Our trademarks and branding are protected\n• You receive only a limited license to use the App\n\nYOUR LICENSE:\n• We grant you a limited, non-exclusive, non-transferable license\n• You may use the App for personal, non-commercial purposes\n• This license does not include resale or commercial use\n• The license terminates when your subscription ends\n\nUSER CONTENT:\n• You retain ownership of content you create in the App\n• You grant us a license to use your content to provide services\n• You represent that you have rights to any content you upload\n• We may remove content that violates these Terms';

  @override
  String get termsSection9Title => '9. PRIVACY AND DATA';

  @override
  String get termsSection9Content =>
      'DATA COLLECTION AND USE:\n• We collect and use data as described in our Privacy Policy\n• Review our Privacy Policy at: https://info.teambuildpro.com/privacy-policy.html\n• By using the App, you consent to our data practices\n• We implement security measures to protect your data\n\nYOUR PRIVACY RIGHTS:\n• You have rights regarding your personal data\n• You may request access to your data\n• You may request deletion of your account and data\n• Contact us at support@teambuildpro.com for privacy requests\n\nDATA SECURITY:\n• We use industry-standard security measures\n• However, no system is completely secure\n• You use the App at your own risk\n• Report security concerns to support@teambuildpro.com';

  @override
  String get termsSection10Title => '10. THIRD-PARTY SERVICES AND CONTENT';

  @override
  String get termsSection10Content =>
      'BUSINESS OPPORTUNITIES:\n• The App may display information about third-party business opportunities\n• These opportunities are provided by independent companies\n• Team Build Pro is not affiliated with these opportunities\n• We do not endorse or guarantee any third-party opportunity\n• Research opportunities independently before participating\n\nTHIRD-PARTY LINKS:\n• The App may contain links to third-party websites\n• We are not responsible for third-party content or practices\n• Third-party sites have their own terms and privacy policies\n• Access third-party content at your own risk\n\nINTEGRATIONS:\n• The App may integrate with third-party services\n• Your use of integrated services is subject to their terms\n• We are not responsible for third-party service performance\n• Integrations may be modified or discontinued at any time';

  @override
  String get termsSection11Title => '11. DISCLAIMERS';

  @override
  String get termsSection11Content =>
      'NO BUSINESS OPPORTUNITY:\n• Team Build Pro is a networking platform service only\n• We do not offer or guarantee any business opportunity\n• We do not guarantee income, earnings, or success\n• Any business opportunity information comes from third parties\n\nSERVICE PROVIDED \"AS IS\":\n• The App is provided \"as is\" and \"as available\"\n• We make no warranties about App reliability or availability\n• We do not guarantee error-free or uninterrupted service\n• We may modify or discontinue features at any time\n\nNO PROFESSIONAL ADVICE:\n• The App does not provide legal, financial, or tax advice\n• AI coaching is for informational purposes only\n• Consult qualified professionals for important decisions\n• We are not responsible for decisions based on App content\n\nRESULTS DISCLAIMER:\n• Individual results vary and are not guaranteed\n• Success depends on individual effort and circumstances\n• Past performance does not indicate future results\n• We make no representations about potential outcomes';

  @override
  String get termsSection12Title => '12. LIMITATION OF LIABILITY';

  @override
  String get termsSection12Content =>
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n\nWE ARE NOT LIABLE FOR:\n• Any indirect, incidental, or consequential damages\n• Loss of profits, revenue, data, or business opportunities\n• Service interruptions or errors\n• Unauthorized access to your account or data\n• Third-party actions or content\n• Any damages exceeding the amount you paid us in the past 12 months\n\nCAP ON LIABILITY:\n• Our total liability is limited to subscription fees paid in the past 12 months\n• This applies regardless of the legal theory of liability\n• Some jurisdictions don\'t allow these limitations\n• In those cases, liability is limited to the minimum required by law\n\nUSER RESPONSIBILITY:\n• You are responsible for your use of the App\n• You are responsible for decisions based on App content\n• You assume all risks associated with App use\n• You agree to evaluate business opportunities independently';

  @override
  String get termsSection13Title => '13. INDEMNIFICATION';

  @override
  String get termsSection13Content =>
      'You agree to indemnify, defend, and hold harmless Team Build Pro, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:\n\n• Your use of the App\n• Your violation of these Terms\n• Your violation of any rights of others\n• Your content or information posted in the App\n• Your participation in any business opportunity\n• Your violation of applicable laws or regulations\n\nThis indemnification obligation survives termination of these Terms and your use of the App.';

  @override
  String get termsSection14Title => '14. DISPUTE RESOLUTION';

  @override
  String get termsSection14Content =>
      'GOVERNING LAW:\n• These Terms are governed by the laws of the State of Utah, USA\n• Federal law applies where applicable\n• You consent to jurisdiction in Utah courts\n\nINFORMAL RESOLUTION:\n• Contact us first to resolve disputes informally\n• Email: support@teambuildpro.com\n• We will attempt to resolve issues in good faith\n• Most concerns can be addressed through communication\n\nARBITRATION (IF REQUIRED):\n• Disputes may be subject to binding arbitration\n• Arbitration conducted under American Arbitration Association rules\n• Individual arbitration only - no class actions\n• Arbitration location: Utah, USA\n\nEXCEPTIONS:\n• Either party may seek injunctive relief in court\n• Intellectual property disputes may be litigated\n• Small claims court remains available for qualifying claims';

  @override
  String get termsSection15Title => '15. CHANGES TO TERMS';

  @override
  String get termsSection15Content =>
      'MODIFICATIONS:\n• We may update these Terms at any time\n• Changes effective upon posting in the App\n• Continued use constitutes acceptance of changes\n• Material changes will be communicated via email or App notification\n\nYOUR OPTIONS:\n• Review Terms periodically for changes\n• If you disagree with changes, stop using the App\n• Cancel your subscription if you don\'t accept new Terms\n• Contact support@teambuildpro.com with questions\n\nEFFECTIVE DATE:\n• Current version effective as of posting date\n• Previous versions are superseded\n• We maintain records of Terms versions';

  @override
  String get termsSection16Title => '16. GENERAL PROVISIONS';

  @override
  String get termsSection16Content =>
      'ENTIRE AGREEMENT:\n• These Terms constitute the entire agreement between you and Team Build Pro\n• They supersede all prior agreements or understandings\n• Apple\'s EULA terms also apply to App Store purchases\n\nSEVERABILITY:\n• If any provision is found invalid, the rest remains in effect\n• Invalid provisions will be modified to be enforceable\n• The Terms remain binding even with invalid provisions\n\nNO WAIVER:\n• Our failure to enforce any right doesn\'t waive that right\n• Waiver of one breach doesn\'t waive future breaches\n• All rights and remedies are cumulative\n\nASSIGNMENT:\n• You may not assign these Terms without our consent\n• We may assign our rights and obligations\n• Terms bind permitted successors and assigns\n\nCONTACT INFORMATION:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nPrivacy Policy: https://info.teambuildpro.com/privacy-policy.html\n\nLast Updated: January 2025';

  @override
  String get privacySection1Title => '1. INFORMATION WE COLLECT';

  @override
  String get privacySection1Content =>
      'ACCOUNT INFORMATION:\n• Name and email address\n• Phone number (optional)\n• Profile information you provide\n• Authentication credentials\n\nUSAGE DATA:\n• App interactions and features used\n• Device information (model, OS version)\n• Performance and crash data\n• Analytics data (anonymized where possible)\n\nCONTENT YOU CREATE:\n• Messages and communications\n• Contact information you add\n• Notes and relationship data\n• Files and media you upload\n\nLOCATION DATA:\n• We do not collect precise location data\n• General location may be derived from IP address\n• You can manage location permissions in device settings';

  @override
  String get privacySection2Title => '2. HOW WE USE YOUR INFORMATION';

  @override
  String get privacySection2Content =>
      'We use collected information to:\n\nPROVIDE SERVICES:\n• Create and manage your account\n• Enable App features and functionality\n• Process your subscription payments\n• Provide customer support\n• Send service-related notifications\n\nIMPROVE OUR APP:\n• Analyze usage patterns and trends\n• Fix bugs and improve performance\n• Develop new features\n• Conduct research and analytics\n\nCOMMUNICATIONS:\n• Send important service updates\n• Respond to your inquiries\n• Provide technical support\n• Send optional marketing (you can opt out)\n\nLEGAL COMPLIANCE:\n• Comply with legal obligations\n• Enforce our Terms of Service\n• Protect rights and safety\n• Prevent fraud and abuse';

  @override
  String get privacySection3Title => '3. HOW WE SHARE YOUR INFORMATION';

  @override
  String get privacySection3Content =>
      'We share information only in these limited circumstances:\n\nSERVICE PROVIDERS:\n• Cloud hosting (Firebase/Google Cloud)\n• Payment processing (Apple)\n• Analytics services\n• Customer support tools\n• These providers are contractually obligated to protect your data\n\nLEGAL REQUIREMENTS:\n• When required by law or legal process\n• To protect rights, property, or safety\n• In connection with legal proceedings\n• To prevent fraud or illegal activity\n\nBUSINESS TRANSFERS:\n• In connection with merger, acquisition, or sale of assets\n• Your data may transfer to successor entity\n• You will be notified of any such transfer\n\nWITH YOUR CONSENT:\n• When you explicitly authorize sharing\n• For purposes you approve\n\nWE DO NOT:\n• Sell your personal information\n• Share data for third-party marketing\n• Provide data to data brokers';

  @override
  String get privacySection4Title => '4. DATA SECURITY';

  @override
  String get privacySection4Content =>
      'SECURITY MEASURES:\n• Industry-standard encryption in transit and at rest\n• Secure authentication systems\n• Regular security assessments\n• Access controls and monitoring\n• Secure data centers (Google Cloud/Firebase)\n\nYOUR RESPONSIBILITIES:\n• Keep your password confidential\n• Use device security features (passcode, biometrics)\n• Report suspicious activity immediately\n• Keep your device and app updated\n\nLIMITATIONS:\n• No system is 100% secure\n• You use the App at your own risk\n• We cannot guarantee absolute security\n• Report security concerns to: support@teambuildpro.com';

  @override
  String get privacySection5Title => '5. YOUR PRIVACY RIGHTS';

  @override
  String get privacySection5Content =>
      'You have the following rights regarding your data:\n\nACCESS AND PORTABILITY:\n• Request a copy of your personal data\n• Export your data in a portable format\n• Review what information we have about you\n\nCORRECTION:\n• Update inaccurate information\n• Modify your profile details\n• Correct errors in your account\n\nDELETION:\n• Request deletion of your account and data\n• Use the \"Delete Account\" feature in the App\n• Some data may be retained for legal compliance\n• Deletion is permanent and cannot be undone\n\nOPT-OUT:\n• Unsubscribe from marketing emails\n• Disable push notifications in device settings\n• Limit analytics data collection\n\nTO EXERCISE RIGHTS:\n• Use in-app settings where available\n• Email: support@teambuildpro.com\n• We will respond within 30 days\n• Identity verification may be required';

  @override
  String get privacySection6Title => '6. DATA RETENTION';

  @override
  String get privacySection6Content =>
      'HOW LONG WE KEEP DATA:\n\nACTIVE ACCOUNTS:\n• Data retained while your account is active\n• Necessary to provide ongoing service\n• You can delete data or account anytime\n\nDELETED ACCOUNTS:\n• Most data deleted within 30 days\n• Some data retained for legal compliance\n• Backup systems purged within 90 days\n• Financial records kept per legal requirements\n\nLEGAL RETENTION:\n• Transaction records: 7 years (tax law)\n• Legal disputes: until resolution + statute of limitations\n• Fraud prevention: as legally required\n• Aggregated analytics: indefinitely (anonymized)\n\nYOUR CONTROL:\n• Request deletion at any time\n• Export data before account deletion\n• Deletion is permanent and irreversible';

  @override
  String get privacySection7Title => '7. CHILDREN\'S PRIVACY';

  @override
  String get privacySection7Content =>
      'AGE RESTRICTION:\n• The App is not intended for users under 18\n• We do not knowingly collect data from minors\n• You must be 18+ to create an account\n\nIF WE LEARN OF UNDERAGE USERS:\n• We will promptly delete their accounts\n• We will delete all associated data\n• We will take steps to prevent future underage access\n\nPARENTAL RIGHTS:\n• Parents may request deletion of minor\'s data\n• Contact: support@teambuildpro.com\n• Provide proof of parental relationship\n• We will act promptly on verified requests';

  @override
  String get privacySection8Title => '8. CHANGES TO PRIVACY POLICY';

  @override
  String get privacySection8Content =>
      'UPDATES:\n• We may update this Privacy Policy periodically\n• Changes posted in the App and on our website\n• Material changes communicated via email or notification\n• Continued use means acceptance of changes\n\nYOUR OPTIONS:\n• Review this policy regularly\n• Contact us with questions: support@teambuildpro.com\n• Stop using the App if you disagree with changes\n• Delete your account if you don\'t accept updates\n\nEFFECTIVE DATE:\n• Current version: January 2025\n• Last Updated: January 2025\n• Previous versions are superseded\n\nCONTACT INFORMATION:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nTerms of Service: https://info.teambuildpro.com/terms-of-service.html';

  @override
  String get subscriptionScreenTitle => 'Team Build Pro';

  @override
  String get subscriptionSuccessMessage =>
      '✅ Subscription activated successfully!';

  @override
  String get subscriptionRestoreSuccess =>
      '✅ Subscription restored successfully!';

  @override
  String get subscriptionRestoreNone =>
      'No previous subscription found to restore.';

  @override
  String get subscriptionStatusTrial => 'Free Trial Active';

  @override
  String subscriptionStatusTrialSubtitle(int days) {
    return '$days days remaining in your trial';
  }

  @override
  String get subscriptionPremiumFeaturesHeader => 'Premium Features:';

  @override
  String subscriptionFeatureReferralLink(String bizOpp) {
    return 'Submit your unique $bizOpp referral link';
  }

  @override
  String get subscriptionFeatureAiCoaching =>
      'Custom AI Coaching for recruiting and team building';

  @override
  String get subscriptionFeatureMessaging =>
      'Unlock messaging to users on your team';

  @override
  String subscriptionFeatureEnsureTeam(String bizOpp) {
    return 'Ensure team members join under YOU in $bizOpp';
  }

  @override
  String get subscriptionFeatureAnalytics => 'Advanced analytics and insights';

  @override
  String get subscriptionManagementApple =>
      'You can manage your subscription in your Apple ID account settings.';

  @override
  String get subscriptionManagementGoogle =>
      'You can manage your subscription in the Google Play Store.';

  @override
  String get faqTitle => 'Frequently Asked Questions';

  @override
  String get faqSearchHint => 'Search FAQs...';

  @override
  String get faqCategoryGettingStarted => 'Getting Started';

  @override
  String get faqCategoryBusinessModel => 'Business Model & Legitimacy';

  @override
  String get faqCategoryHowItWorks => 'How It Works';

  @override
  String get faqCategoryTeamBuilding => 'Team Building & Management';

  @override
  String get faqCategoryGlobalFeatures => 'Global & Technical Features';

  @override
  String get faqCategoryPrivacySecurity => 'Privacy & Security';

  @override
  String get faqCategoryPricing => 'Pricing & Business Value';

  @override
  String get faqCategoryConcerns => 'Common Concerns & Objections';

  @override
  String get faqCategorySuccess => 'Success & Results';

  @override
  String get faqCategorySupport => 'Support & Training';

  @override
  String get faqQ1 => 'What exactly is Team Build Pro?';

  @override
  String get faqA1 =>
      'Team Build Pro is a professional software tool designed to help direct sales professionals build, manage, and track their teams before and during their business journey. It\'s NOT a business opportunity or MLM company - it\'s the tool that helps you succeed in whatever opportunity you choose.';

  @override
  String get faqQ2 =>
      'How is this different from other team building apps or CRM systems?';

  @override
  String get faqA2 =>
      'Unlike generic CRMs, Team Build Pro is specifically designed for the direct sales industry. It understands the unique challenges you face: starting from zero, building momentum, qualifying prospects, and maintaining team motivation. Our system lets you pre-build your team before you even join an opportunity, giving you a massive head start.';

  @override
  String get faqQ3 =>
      'Can I really build a team BEFORE joining a business opportunity?';

  @override
  String get faqA3 =>
      'Absolutely! This is our core innovation. You can invite prospects and existing team members to Team Build Pro, let them experience team building success, and when they hit qualification milestones (4 direct sponsors + 20 total team members), they automatically get invited to join your business opportunity. It eliminates the \"cold start\" problem that kills most new distributors.';

  @override
  String get faqQ4 => 'Do I need a credit card to try it?';

  @override
  String get faqA4 =>
      'No. You get full access to all premium features for 30 days completely free, with no credit card required. You can decide to subscribe at any point during or after your trial.';

  @override
  String get faqQ5 => 'Is Team Build Pro an MLM or business opportunity?';

  @override
  String get faqA5 =>
      'No. Team Build Pro is not a business opportunity, MLM, or income platform of any kind. We are a software tool designed exclusively to help professionals build and track their teams. We do not provide any form of user compensation.';

  @override
  String get faqQ6 => 'Can I use this with any direct sales company?';

  @override
  String get faqA6 =>
      'Yes! Team Build Pro is company-agnostic. Whether you\'re in health and wellness, financial services, beauty, technology, or any other direct sales industry, our tools work with your business. You simply customize your profile with your opportunity details.';

  @override
  String get faqQ7 =>
      'What if I\'m not currently with a company but want to join one?';

  @override
  String get faqA7 =>
      'Perfect! This is where Team Build Pro shines. You can start building your team immediately, even before you\'ve chosen which company to join. When you do decide, you\'ll launch with a pre-built, motivated team instead of starting from zero.';

  @override
  String get faqQ8 => 'How does the qualification system work?';

  @override
  String get faqA8 =>
      'When someone joins Team Build Pro through your referral, they begin building their own team. Once they reach our success milestones (4 direct sponsors + 20 total team members), they automatically receive an invitation to join your business opportunity. This ensures only motivated, proven team builders advance to your actual business.';

  @override
  String get faqQ9 =>
      'What happens if someone joins my Team Build Pro team but doesn\'t want to join my business opportunity?';

  @override
  String get faqA9 =>
      'That\'s perfectly fine! They can continue using Team Build Pro to build their own team for whatever opportunity they choose, or they can stay focused on team building. There\'s no pressure. The beauty is that you\'re only working with people who have demonstrated commitment and success.';

  @override
  String get faqQ10 => 'Can I track my team\'s progress and activity?';

  @override
  String get faqA10 =>
      'Yes! You get comprehensive analytics including real-time team growth statistics, individual member progress toward qualification, activity levels and engagement metrics, geographic distribution of your team, performance trends and milestones, and daily/weekly growth reports.';

  @override
  String get faqQ11 => 'How do I get my referral link?';

  @override
  String get faqA11 =>
      'Once you create your account, you get a personalized referral link that you can share via social media, email, text, or in person.';

  @override
  String get faqQ12 =>
      'What\'s the difference between \"sponsors\" and \"team members\"?';

  @override
  String get faqA12 =>
      'Direct sponsors are people you personally invite who join through your referral link. Total team members include your direct sponsors plus everyone they sponsor (your downline). For qualification, you need 4 direct sponsors and 20 total team members.';

  @override
  String get faqQ13 => 'Can my team members message each other?';

  @override
  String get faqA13 =>
      'Yes! Team Build Pro includes secure, encrypted messaging so your team can communicate, share tips, and support each other.';

  @override
  String get faqQ14 =>
      'What if someone in my team becomes qualified before me?';

  @override
  String get faqA14 =>
      'That\'s actually great! It shows the system is working. They can advance to your business opportunity independently, and you continue building your own qualification. Success breeds success - having qualified team members often motivates others.';

  @override
  String get faqQ15 => 'How do I know if my team members are active?';

  @override
  String get faqA15 =>
      'Our dashboard shows activity levels, last login dates, team building progress, and engagement metrics for each member. You can easily identify who might need encouragement or support.';

  @override
  String get faqQ16 => 'Can I remove someone from my team?';

  @override
  String get faqA16 =>
      'Team members can choose to leave on their own, but you cannot remove them. This protects the integrity of the team and ensures everyone\'s hard work building their teams is preserved.';

  @override
  String get faqQ17 => 'Does this work internationally?';

  @override
  String get faqA17 =>
      'Yes! Team Build Pro works in 120+ countries with timezone-aware features. You can build a truly global team, and our system handles different time zones for notifications and reporting.';

  @override
  String get faqQ18 => 'What devices does it work on?';

  @override
  String get faqA18 =>
      'Team Build Pro is available on iOS (iPhone/iPad) and Android devices, with a web companion for additional features. Everything syncs across all your devices.';

  @override
  String get faqQ19 => 'What if I\'m not tech-savvy?';

  @override
  String get faqA19 =>
      'The app is designed for simplicity. If you can use social media, you can use Team Build Pro. Plus, we provide onboarding tutorials and customer support to help you get started.';

  @override
  String get faqQ20 => 'Does the app work offline?';

  @override
  String get faqA20 =>
      'You need an internet connection for real-time features like messaging and live updates, but you can view your team and some analytics offline. Data syncs when you reconnect.';

  @override
  String get faqQ21 => 'How secure is my data?';

  @override
  String get faqA21 =>
      'We use enterprise-grade security including end-to-end encryption for all communications, secure cloud storage with regular backups, multi-factor authentication options, GDPR compliance for data protection, and no data sharing with third parties.';

  @override
  String get faqQ22 => 'Who can see my team information?';

  @override
  String get faqA22 =>
      'Only you can see your complete team. Team members can see their own direct sponsors and downline, but cannot see your entire organization. This protects everyone\'s privacy while maintaining transparency in direct relationships.';

  @override
  String get faqQ23 => 'What happens to my data if I cancel?';

  @override
  String get faqA23 =>
      'You can export your team data before canceling. After cancellation, your account is deactivated but your team relationships remain intact for others in your team. We retain minimal data for legal/billing purposes only.';

  @override
  String get faqQ24 => 'Do you sell my information to other companies?';

  @override
  String get faqA24 =>
      'Absolutely not. We never sell, rent, or share your personal information with third parties. Our revenue comes from subscriptions, not data sales.';

  @override
  String get faqQ25 =>
      'Is \$6.99/month worth it compared to free alternatives?';

  @override
  String get faqA25 =>
      'Free tools aren\'t built for the direct sales industry and lack crucial features like qualification tracking, business opportunity integration, and team analytics. For less than the cost of a coffee, you get professional-grade team building tools that can transform your business.';

  @override
  String get faqQ26 => 'Can I write this off as a business expense?';

  @override
  String get faqA26 =>
      'Many direct sales professionals do treat it as a business tool expense, but consult your tax advisor for guidance specific to your situation.';

  @override
  String get faqQ27 => 'What if I need to cancel?';

  @override
  String get faqA27 =>
      'You can cancel anytime with no cancellation fees or long-term commitments. You retain access until the end of your current billing period.';

  @override
  String get faqQ28 => 'Do you offer team or volume discounts?';

  @override
  String get faqA28 =>
      'Currently, we offer individual subscriptions only. This keeps costs low and ensures everyone has equal access to all features.';

  @override
  String get faqQ29 => 'Isn\'t this just making direct sales more complicated?';

  @override
  String get faqA29 =>
      'Actually, it simplifies everything! Instead of cold calling strangers or pressuring friends, you\'re building relationships with people who are actively engaged in team building. It removes the guesswork and awkwardness from traditional recruiting.';

  @override
  String get faqQ30 => 'What if people think this is \"another MLM thing\"?';

  @override
  String get faqA30 =>
      'That\'s why we\'re very clear that Team Build Pro is software, not an opportunity. You\'re inviting people to use a professional tool, not join a business. Many people are more open to trying an app than joining an MLM.';

  @override
  String get faqQ31 =>
      'How do I explain this to prospects without confusing them?';

  @override
  String get faqA31 =>
      'Simple: \"It\'s like LinkedIn for direct sales professionals. You build connections, track your team growth, and when you\'re ready to advance your career, opportunities become available.\" Focus on the professional development angle.';

  @override
  String get faqQ32 =>
      'What if my current company doesn\'t allow outside tools?';

  @override
  String get faqA32 =>
      'Check your company\'s policies, but most direct sales companies welcome tools that help you build your business. Team Build Pro doesn\'t compete with your company - it feeds qualified prospects into it.';

  @override
  String get faqQ33 => 'How long does it take to see results?';

  @override
  String get faqA33 =>
      'Direct sales success takes time regardless of tools. However, Team Build Pro users often see team growth within weeks because they\'re focused on relationship building rather than selling. The key is consistent daily activity.';

  @override
  String get faqQ34 =>
      'What\'s a realistic timeline to build a qualified team?';

  @override
  String get faqA34 =>
      'This varies greatly by individual effort and market, but our most successful users achieve qualification (4 direct, 20 total) within a few weeks of consistent activity. Remember, you\'re building relationships, not just collecting sign-ups.';

  @override
  String get faqQ35 => 'Do you guarantee results?';

  @override
  String get faqA35 =>
      'No software can guarantee your business success - that depends on your effort, market, and opportunity. We provide the tools; you provide the work ethic and relationship building skills.';

  @override
  String get faqQ36 => 'Can you share success stories?';

  @override
  String get faqA36 =>
      'While we maintain user privacy, we can share that our most successful users consistently share their Team Build Pro link, engage with their team daily, and focus on helping others succeed rather than just recruiting.';

  @override
  String get faqQ37 => 'What kind of support do you provide?';

  @override
  String get faqA37 =>
      'We offer 24/7 customer support via in-app messaging, best practices for team building, and regular feature updates and improvements.';

  @override
  String get faqQ38 => 'What exactly does AI Coach do?';

  @override
  String get faqA38 =>
      'AI Coach helps you navigate the Team Build Pro app, answers questions about features and qualification requirements, provides team building guidance, and can suggest which app sections to visit for specific tasks.';

  @override
  String get faqQ39 => 'Do you provide training on how to recruit or sell?';

  @override
  String get faqA39 =>
      'We focus on showing you how to use Team Build Pro effectively. For sales and recruiting training, we recommend working with your sponsor or company\'s training programs.';

  @override
  String get faqQ40 => 'What if I have technical problems?';

  @override
  String get faqA40 =>
      'Contact our support team through the app or website. Most issues are resolved quickly, and we\'re committed to keeping your team building activities running smoothly.';

  @override
  String get faqFooterTitle => 'Ready to Transform Your Team Building?';

  @override
  String get faqFooterSubtitle =>
      'Start your 30-day free trial today and experience the difference professional tools make.';

  @override
  String get faqFooterContact =>
      'Questions not answered here? Contact our support team - we\'re here to help you succeed!';

  @override
  String get bizOppEducationTitle => 'Secure Your Sponsorship Position!';

  @override
  String get bizOppEducationWorksTitle => 'How Sponsorship Works';

  @override
  String bizOppEducationWorksBody(String business) {
    return 'When your team members join $business, their sponsor will be the FIRST person in their upline who has already joined.';
  }

  @override
  String get bizOppEducationBenefitsTitle => 'Join now to ensure:';

  @override
  String get bizOppEducationBenefit1 => 'Your recruits are sponsored under YOU';

  @override
  String get bizOppEducationBenefit2 => 'You receive credit for their activity';

  @override
  String get bizOppEducationBenefit3 =>
      'You don\'t miss out on this opportunity';

  @override
  String get bizOppEducationRemindLater => 'Remind Me Later';

  @override
  String get bizOppEducationJoinNow => 'Join Now';

  @override
  String get sharePartnerImportantLabel => 'Important:';

  @override
  String sharePartnerImportantText(String business) {
    return 'We highly recommend you share the Team Build Pro app with your front-line $business team members (individuals you have personally sponsored) before sharing it with $business team members you did not personally sponsor. This will provide an opportunity to respect the established sponsoring relationships in your $business downline.';
  }

  @override
  String get bizProgressTitle => 'Registration Progress';

  @override
  String get bizProgressStep1 => 'Copy Registration Link';

  @override
  String get bizProgressStep2 => 'Complete Registration';

  @override
  String get bizProgressStep3 => 'Add Your Referral Link';

  @override
  String get hiwTitle => 'How It Works';

  @override
  String get hiwSubtitle =>
      'Transform your recruiting with a pre-qualified team pipeline.';

  @override
  String get hiwFeaturedOpp => 'Featured Opportunity';

  @override
  String get hiwPipelineSystem => 'PIPELINE SYSTEM';

  @override
  String get hiwStep1Title => 'Set Your Foundation';

  @override
  String get hiwStep1Desc =>
      'Customize your Team Build Pro account with your opportunity details and connect your referral link - turning the app into your personal recruiting pipeline.';

  @override
  String get hiwStep2Title => 'Build Smart, Not Hard';

  @override
  String get hiwStep2Desc =>
      'Share Team Build Pro with prospects and existing team members. Current team members create instant momentum, and recruiting prospects experience real team building success before joining your opportunity, eliminating the \"cold start\" problem.';

  @override
  String get hiwStep3Title => 'Automatic Qualification';

  @override
  String get hiwStep3Desc =>
      'When recruiting prospects reach our success milestones (4 direct sponsors + 20 total team members), they automatically receive an invitation to join your opportunity.';

  @override
  String get hiwStep4Title => 'Rapid Growth';

  @override
  String get hiwStep4Desc =>
      'As your Team Build Pro organization expands, each qualified leader feeds new, pre-trained prospects into your opportunity - creating a self-sustaining growth engine.';

  @override
  String get hiwKeyTargets => 'KEY GROWTH TARGETS';

  @override
  String get hiwDirectSponsors => 'Direct Sponsors';

  @override
  String get hiwTotalTeam => 'Total Team Members';

  @override
  String get hiwGrowNetwork => 'Grow Your Network';

  @override
  String get hiwExpandNetwork =>
      'Expand your Network to drive organization growth!';

  @override
  String get hiwProvenStrategies => 'Proven Growth Strategies';

  @override
  String get pmTitle => 'Create Account';

  @override
  String get pmDialogTitle => 'Important Terms';

  @override
  String get pmDialogIntro =>
      'You are creating a new, separate admin account. By proceeding, you understand and agree to the following:';

  @override
  String get pmTerm1 =>
      'This new account is completely separate and cannot be merged with your current account.';

  @override
  String pmTerm2(String bizOpp) {
    return 'Your existing \"$bizOpp\" team is non-transferable.';
  }

  @override
  String get pmTerm3 =>
      'This account must be used for a new, different business opportunity.';

  @override
  String get pmTerm4 =>
      'Cross-promoting or recruiting members between your separate accounts is strictly prohibited.';

  @override
  String get pmTerm5 =>
      'Violation of these terms may result in the suspension or cancellation of ALL your associated accounts.';

  @override
  String get pmAgreeTerms => 'I understand and agree to these terms';

  @override
  String get pmCancel => 'Cancel';

  @override
  String get pmContinue => 'Continue';

  @override
  String get pmCardTitle => 'Manage Another Opportunity';

  @override
  String get pmCardDesc =>
      'Create a separate account to manage and grow a different opportunity.';

  @override
  String get pmCreateButton => 'Create New Account';

  @override
  String get authSignupTitle => 'Account Registration';

  @override
  String get authSignupCreateLoginHeader => 'Create Your Login';

  @override
  String get authSignupEmailPrivacy =>
      'Your email will never be shared with anyone';

  @override
  String get adminEditProfileTitle => 'Business Setup';

  @override
  String get adminEditProfileHeaderTitle => 'Your Business Opportunity';

  @override
  String get adminEditProfileWarningCannotChange =>
      '⚠️ Important: This information cannot be changed once saved.';

  @override
  String get adminEditProfileWarningExplanation =>
      'Your business opportunity name and referral link ensure that Team Build Pro members are accurately placed in your business opportunity downline when they qualify. Changing this would break the connection between your networks.';

  @override
  String get adminEditProfileLabelBizOppName =>
      'Your Business Opportunity Name';

  @override
  String get adminEditProfileHelperCannotChange =>
      'This cannot be changed once set';

  @override
  String get adminEditProfileLabelBizOppNameConfirm =>
      'Confirm Business Opportunity Name';

  @override
  String get adminEditProfileLabelReferralLink => 'Your Referral Link';

  @override
  String get adminEditProfileLabelReferralLinkConfirm =>
      'Confirm Referral Link URL';

  @override
  String get adminEditProfileValidationRequired => 'Required';

  @override
  String get adminEditProfileDialogErrorTitle => 'Referral Link Error';

  @override
  String get adminEditProfileDialogErrorHelper =>
      'Please verify your referral link and try again.';

  @override
  String get adminEditProfileDialogImportantTitle => 'Very Important!';

  @override
  String get adminEditProfileDialogImportantMessage =>
      'You must enter the exact referral link you received from your company. This will ensure your team members that join your business opportunity are automatically placed in your business opportunity team.';

  @override
  String get adminEditProfileButtonUnderstand => 'I Understand';

  @override
  String get adminEditProfilePreviewTitle => 'Referral Link Preview:';

  @override
  String get adminEditProfileButtonComplete =>
      'Complete Profile & Start Building!';

  @override
  String get adminEditProfileSuccessSaved => 'Profile completed successfully!';

  @override
  String adminEditProfileErrorSaving(String error) {
    return 'Error: $error';
  }

  @override
  String get adminEditProfileValidationBizNameRequired =>
      'Please enter your business opportunity name';

  @override
  String get adminEditProfileValidationBizNameConfirmRequired =>
      'Please confirm your business opportunity name';

  @override
  String get adminEditProfileValidationReferralLinkRequired =>
      'Please enter your referral link';

  @override
  String get adminEditProfileValidationReferralLinkConfirmRequired =>
      'Please confirm your referral link';

  @override
  String get adminEditProfileValidationBizNameInvalidChars =>
      'Business name can only contain letters, numbers, and common punctuation.';

  @override
  String get adminEditProfileValidationUrlBasic =>
      'Please enter a valid referral link (e.g., https://example.com).';

  @override
  String get adminEditProfileValidationBizNameMismatch =>
      'Business Name fields must match for confirmation.';

  @override
  String get adminEditProfileValidationReferralLinkMismatch =>
      'Referral Link fields must match for confirmation.';

  @override
  String get adminEditProfileValidationUrlInvalid =>
      'Please enter a valid URL (e.g., https://example.com)';

  @override
  String get adminEditProfileValidationUrlNotHttps =>
      'Referral link must use HTTPS (not HTTP) for security';

  @override
  String get adminEditProfileValidationUrlLocalhost =>
      'Please enter a valid business referral link\n(not localhost or IP address)';

  @override
  String get adminEditProfileValidationUrlNoTld =>
      'Please enter a valid URL with a proper domain\n(e.g., company.com)';

  @override
  String get adminEditProfileValidationUrlHomepageOnly =>
      'Please enter your complete referral link, not just the homepage.\nYour referral link should include your unique identifier\n(e.g., https://company.com/join?ref=yourname)';

  @override
  String get adminEditProfileValidationUrlFormat =>
      'Invalid URL format. Please check your referral link.';

  @override
  String get adminEditProfileValidationUrlVerificationFailed =>
      'The referral link you entered could not be verified. Please check your internet connection and try again.';

  @override
  String get adminEditProfileValidationUrlVerificationError =>
      'The referral link you entered could not be verified. Please check the URL and try again.';
}
