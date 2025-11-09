// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

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
  String get authSignupTosRequired => 'You must accept the terms to continue';

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
  String get navShare => 'Share';

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
    return 'Hey $prospectName, it\'s $senderFirst. I\'m using an app to help friends launch with $companyName. Quick look? $shortLink';
  }

  @override
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink) {
    return 'Hey, it\'s $senderFirst. I\'m using an app to help friends launch with $companyName. Quick look? $shortLink';
  }

  @override
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink) {
    return 'Hi $prospectName! Following up on $companyName. I saw great results this week. Have time for a quick chat? $shortLink';
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
    return 'Hey $prospectName, we have a $companyName training session coming up. Want to join? $inviteLink';
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
}
