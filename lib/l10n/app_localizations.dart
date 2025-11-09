import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_pt.dart';
import 'app_localizations_tl.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('en', 'XA'),
    Locale('es'),
    Locale('pt'),
    Locale('tl')
  ];

  /// Application title
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro'**
  String get appTitle;

  /// Main header on login screen - sentence case
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get authLoginHeaderTitle;

  /// Email input field label
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authLoginLabelEmail;

  /// Email input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your email address'**
  String get authLoginHintEmail;

  /// Validation error when email field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get authLoginEmailRequired;

  /// Validation error when email format is invalid
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email'**
  String get authLoginEmailInvalid;

  /// Password input field label
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authLoginLabelPassword;

  /// Password input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get authLoginHintPassword;

  /// Validation error when password field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get authLoginPasswordRequired;

  /// Validation error when password is too short
  ///
  /// In en, this message translates to:
  /// **'Password must be at least {min} characters'**
  String authLoginPasswordTooShort(int min);

  /// Sign in button label - title case
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get authLoginButtonSignIn;

  /// Text shown before sign up link
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account?'**
  String get authLoginNoAccountPrompt;

  /// Link to navigate to sign up screen
  ///
  /// In en, this message translates to:
  /// **'Sign Up'**
  String get authLoginLinkSignUp;

  /// Biometric authentication button label with method placeholder
  ///
  /// In en, this message translates to:
  /// **'Sign in with {method}'**
  String authLoginBiometric(String method);

  /// Face ID biometric method name (iOS)
  ///
  /// In en, this message translates to:
  /// **'Face ID'**
  String get authLoginBiometricMethodFace;

  /// Touch ID biometric method name (iOS)
  ///
  /// In en, this message translates to:
  /// **'Touch ID'**
  String get authLoginBiometricMethodTouch;

  /// Generic biometric method name (Android/fallback)
  ///
  /// In en, this message translates to:
  /// **'Biometrics'**
  String get authLoginBiometricMethodGeneric;

  /// Main header on signup screen - sentence case
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get authSignupHeaderTitle;

  /// First name input field label
  ///
  /// In en, this message translates to:
  /// **'First Name'**
  String get authSignupLabelFirstName;

  /// First name input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your first name'**
  String get authSignupHintFirstName;

  /// Validation error when first name field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your first name'**
  String get authSignupFirstNameRequired;

  /// Last name input field label
  ///
  /// In en, this message translates to:
  /// **'Last Name'**
  String get authSignupLabelLastName;

  /// Last name input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your last name'**
  String get authSignupHintLastName;

  /// Validation error when last name field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your last name'**
  String get authSignupLastNameRequired;

  /// Email input field label
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authSignupLabelEmail;

  /// Email input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your email address'**
  String get authSignupHintEmail;

  /// Validation error when email field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get authSignupEmailRequired;

  /// Validation error when email format is invalid
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email'**
  String get authSignupEmailInvalid;

  /// Password input field label
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authSignupLabelPassword;

  /// Password input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Create a password'**
  String get authSignupHintPassword;

  /// Validation error when password field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter a password'**
  String get authSignupPasswordRequired;

  /// Validation error when password is too short
  ///
  /// In en, this message translates to:
  /// **'Password must be at least {min} characters'**
  String authSignupPasswordTooShort(int min);

  /// Confirm password input field label
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get authSignupLabelConfirmPassword;

  /// Confirm password input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Re-enter your password'**
  String get authSignupHintConfirmPassword;

  /// Validation error when confirm password field is empty
  ///
  /// In en, this message translates to:
  /// **'Please confirm your password'**
  String get authSignupConfirmPasswordRequired;

  /// Validation error when password and confirm password don't match
  ///
  /// In en, this message translates to:
  /// **'Passwords don\'t match'**
  String get authSignupPasswordMismatch;

  /// Referral code input field label
  ///
  /// In en, this message translates to:
  /// **'Referral Code (Optional)'**
  String get authSignupLabelReferralCode;

  /// Referral code input field placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter invite code if you have one'**
  String get authSignupHintReferralCode;

  /// Paste referral code from clipboard button
  ///
  /// In en, this message translates to:
  /// **'Paste'**
  String get authSignupButtonPasteCode;

  /// Terms and privacy consent text. Will be enhanced with tappable links in Phase 1C
  ///
  /// In en, this message translates to:
  /// **'By continuing, you agree to the Terms of Service and Privacy Policy'**
  String get authSignupTosConsent;

  /// Short label for terms of service link
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get authSignupTermsShort;

  /// Short label for privacy policy link
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get authSignupPrivacyShort;

  /// Validation error when user hasn't accepted terms
  ///
  /// In en, this message translates to:
  /// **'You must accept the terms to continue'**
  String get authSignupTosRequired;

  /// Create account button label - title case
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get authSignupButtonCreateAccount;

  /// Text shown before sign in link
  ///
  /// In en, this message translates to:
  /// **'Already have an account?'**
  String get authSignupHaveAccountPrompt;

  /// Link to navigate to sign in screen
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get authSignupLinkSignIn;

  /// Accessibility label for show password icon button
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get authPasswordShow;

  /// Accessibility label for hide password icon button
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get authPasswordHide;

  /// Error message for invalid email from Firebase auth
  ///
  /// In en, this message translates to:
  /// **'That email isn\'t valid. Please check and try again.'**
  String get authErrorInvalidEmail;

  /// Error message when user account is disabled
  ///
  /// In en, this message translates to:
  /// **'This account has been disabled. Please contact support.'**
  String get authErrorUserDisabled;

  /// Error message when user doesn't exist
  ///
  /// In en, this message translates to:
  /// **'No account found with that email.'**
  String get authErrorUserNotFound;

  /// Error message for wrong password
  ///
  /// In en, this message translates to:
  /// **'Incorrect password. Please try again.'**
  String get authErrorWrongPassword;

  /// Error message when email is already registered
  ///
  /// In en, this message translates to:
  /// **'An account with that email already exists.'**
  String get authErrorEmailInUse;

  /// Error message for weak password
  ///
  /// In en, this message translates to:
  /// **'Please choose a stronger password.'**
  String get authErrorWeakPassword;

  /// Error message for network failures
  ///
  /// In en, this message translates to:
  /// **'Network error. Please check your connection.'**
  String get authErrorNetworkError;

  /// Error message for too many failed attempts
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please wait a moment.'**
  String get authErrorTooMany;

  /// Error message for invalid credentials
  ///
  /// In en, this message translates to:
  /// **'Those details don\'t match our records.'**
  String get authErrorInvalidCredential;

  /// Generic error message for unknown errors
  ///
  /// In en, this message translates to:
  /// **'An error occurred. Please try again.'**
  String get authErrorUnknown;

  /// Bottom navigation tab label for home/dashboard
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// Bottom navigation tab label for team/network
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get navTeam;

  /// Bottom navigation tab label for sharing
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get navShare;

  /// Bottom navigation tab label for messages
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get navMessages;

  /// Bottom navigation tab label for notifications
  ///
  /// In en, this message translates to:
  /// **'Notices'**
  String get navNotices;

  /// Bottom navigation tab label for profile
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// Dashboard screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Control Center'**
  String get dashTitle;

  /// Label for direct sponsors count KPI
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get dashKpiDirectSponsors;

  /// Label for total team members count KPI
  ///
  /// In en, this message translates to:
  /// **'Total Team Members'**
  String get dashKpiTotalTeam;

  /// Success message after refreshing team statistics
  ///
  /// In en, this message translates to:
  /// **'Team stats refreshed'**
  String get dashStatsRefreshed;

  /// Error message when statistics refresh fails
  ///
  /// In en, this message translates to:
  /// **'Error refreshing stats: {error}'**
  String dashStatsError(String error);

  /// Dashboard tile title for getting started guide
  ///
  /// In en, this message translates to:
  /// **'Getting Started'**
  String get dashTileGettingStarted;

  /// Dashboard tile title for business opportunity details
  ///
  /// In en, this message translates to:
  /// **'Opportunity Details'**
  String get dashTileOpportunity;

  /// Dashboard tile title for eligibility status
  ///
  /// In en, this message translates to:
  /// **'Your Eligibility Status'**
  String get dashTileEligibility;

  /// Dashboard tile title/CTA for growing team
  ///
  /// In en, this message translates to:
  /// **'Grow Your Team'**
  String get dashTileGrowTeam;

  /// Dashboard tile title/CTA for viewing team
  ///
  /// In en, this message translates to:
  /// **'View Your Team'**
  String get dashTileViewTeam;

  /// Dashboard tile title for AI coaching assistant
  ///
  /// In en, this message translates to:
  /// **'Your AI Coach'**
  String get dashTileAiCoach;

  /// Dashboard tile title for message center
  ///
  /// In en, this message translates to:
  /// **'Message Center'**
  String get dashTileMessageCenter;

  /// Dashboard tile title for notifications
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get dashTileNotifications;

  /// Dashboard tile title for how it works guide
  ///
  /// In en, this message translates to:
  /// **'How It Works'**
  String get dashTileHowItWorks;

  /// Dashboard tile title for frequently asked questions
  ///
  /// In en, this message translates to:
  /// **'FAQ\'s'**
  String get dashTileFaqs;

  /// Dashboard tile title/CTA for viewing profile
  ///
  /// In en, this message translates to:
  /// **'View Your Profile'**
  String get dashTileProfile;

  /// Dashboard tile title/CTA for creating account (admin only)
  ///
  /// In en, this message translates to:
  /// **'Create New Account'**
  String get dashTileCreateAccount;

  /// Initial outreach message with prospect name
  ///
  /// In en, this message translates to:
  /// **'Hey {prospectName}, it\'s {senderFirst}. I\'m using an app to help friends launch with {companyName}. Quick look? {shortLink}'**
  String recruitT01FirstTouch(String prospectName, String senderFirst,
      String companyName, String shortLink);

  /// Initial outreach message without prospect name (fallback)
  ///
  /// In en, this message translates to:
  /// **'Hey, it\'s {senderFirst}. I\'m using an app to help friends launch with {companyName}. Quick look? {shortLink}'**
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink);

  /// Warm follow-up message after initial interest
  ///
  /// In en, this message translates to:
  /// **'Hi {prospectName}! Following up on {companyName}. I saw great results this week. Have time for a quick chat? {shortLink}'**
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink);

  /// Time-sensitive reminder about limited availability
  ///
  /// In en, this message translates to:
  /// **'{prospectName}, spots are filling up for our {companyName} launch. Want me to save you one? {shortLink}'**
  String recruitT03DeadlineNudge(
      String prospectName, String companyName, String shortLink);

  /// Team building progress message with plural logic
  ///
  /// In en, this message translates to:
  /// **'{remaining, plural, =0 {You\'re day-one ready.} one {You\'re # person away from a strong start.} other {You\'re # people away from a strong start.}}'**
  String recruitT04TeamNeeded(int remaining);

  /// Celebration message for reaching a milestone
  ///
  /// In en, this message translates to:
  /// **'🎉 {prospectName}, you hit your first milestone with {companyName}! Your team is growing. Keep it up!'**
  String recruitT05MilestoneReached(String prospectName, String companyName);

  /// Welcome message for new team member
  ///
  /// In en, this message translates to:
  /// **'Welcome, {prospectName}! I\'m {senderFirst} and here to help. Let\'s get started: {inviteLink}'**
  String recruitT06WelcomeOnboard(
      String prospectName, String senderFirst, String inviteLink);

  /// Regular weekly check-in message
  ///
  /// In en, this message translates to:
  /// **'Hey {prospectName}, quick check-in on {companyName}. How are things going? Any questions I can help with?'**
  String recruitT07WeeklyCheckIn(String prospectName, String companyName);

  /// Countdown to start date with days remaining
  ///
  /// In en, this message translates to:
  /// **'We kick off in {days, plural, one {# day} other {# days}}. Want me to hold your spot? {shortLink}'**
  String recruitT08Deadline(int days, String shortLink);

  /// Sharing a helpful resource or tool
  ///
  /// In en, this message translates to:
  /// **'{prospectName}, I found this helpful for {companyName}. Thought you\'d want to see it: {inviteLink}'**
  String recruitT09ResourceShare(
      String prospectName, String companyName, String inviteLink);

  /// Reminder about pending invitation
  ///
  /// In en, this message translates to:
  /// **'Hi {prospectName}, you still have an invite waiting for {companyName}. Ready to join? {shortLink}'**
  String recruitT10InviteReminder(
      String prospectName, String companyName, String shortLink);

  /// Team growth update and encouragement
  ///
  /// In en, this message translates to:
  /// **'Great news, {prospectName}! Your {companyName} team grew this week. You\'re making real progress!'**
  String recruitT11TeamGrowth(String prospectName, String companyName);

  /// Motivational encouragement message
  ///
  /// In en, this message translates to:
  /// **'{prospectName}, building with {companyName} takes time. You\'re doing great. Keep going!'**
  String recruitT12Encouragement(String prospectName, String companyName);

  /// Invitation to training or event
  ///
  /// In en, this message translates to:
  /// **'Hey {prospectName}, we have a {companyName} training session coming up. Want to join? {inviteLink}'**
  String recruitT13TrainingInvite(
      String prospectName, String companyName, String inviteLink);

  /// Quick win celebration message
  ///
  /// In en, this message translates to:
  /// **'Nice work, {prospectName}! That was a solid win with {companyName}. Let\'s keep the momentum going!'**
  String recruitT14QuickWin(String prospectName, String companyName);

  /// Offering help and support
  ///
  /// In en, this message translates to:
  /// **'Hey {prospectName}, I\'m here if you need help with {companyName}. Just reach out anytime.'**
  String recruitT15SupportOffer(String prospectName, String companyName);

  /// Thank you and appreciation message
  ///
  /// In en, this message translates to:
  /// **'Thanks for being part of our {companyName} team, {prospectName}. Your energy makes a difference!'**
  String recruitT16Gratitude(String prospectName, String companyName);

  /// Push notification title when user reaches direct sponsor milestone
  ///
  /// In en, this message translates to:
  /// **'🎉 Amazing Progress!'**
  String get notifMilestoneDirectTitle;

  /// Push notification body for direct sponsor milestone
  ///
  /// In en, this message translates to:
  /// **'Congratulations, {firstName}! You\'ve reached {directCount} direct sponsors! Just {remaining} more team {remaining, plural, one {member} other {members}} needed to unlock your {bizName} invitation. Keep building!'**
  String notifMilestoneDirectBody(
      String firstName, int directCount, int remaining, String bizName);

  /// Push notification title when user reaches team size milestone
  ///
  /// In en, this message translates to:
  /// **'🚀 Incredible Growth!'**
  String get notifMilestoneTeamTitle;

  /// Push notification body for team size milestone
  ///
  /// In en, this message translates to:
  /// **'Amazing progress, {firstName}! You\'ve built a team of {teamCount}! Just {remaining} more direct {remaining, plural, one {sponsor} other {sponsors}} needed to qualify for {bizName}. You\'re so close!'**
  String notifMilestoneTeamBody(
      String firstName, int teamCount, int remaining, String bizName);

  /// Push notification title when subscription is activated
  ///
  /// In en, this message translates to:
  /// **'✅ Subscription Active'**
  String get notifSubActiveTitle;

  /// Push notification body for active subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription is now active until {expiryDate}.'**
  String notifSubActiveBody(String expiryDate);

  /// Push notification title when subscription is cancelled
  ///
  /// In en, this message translates to:
  /// **'⚠️ Subscription Cancelled'**
  String get notifSubCancelledTitle;

  /// Push notification body for cancelled subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription has been cancelled but remains active until {expiryDate}.'**
  String notifSubCancelledBody(String expiryDate);

  /// Push notification title when subscription expires
  ///
  /// In en, this message translates to:
  /// **'❌ Subscription Expired'**
  String get notifSubExpiredTitle;

  /// Push notification body for expired subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription has expired. Renew now to keep building your team and accessing all recruiting tools.'**
  String get notifSubExpiredBody;

  /// Push notification title when subscription is expiring soon
  ///
  /// In en, this message translates to:
  /// **'⏰ Subscription Expiring Soon'**
  String get notifSubExpiringSoonTitle;

  /// Push notification body for expiring subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription expires on {expiryDate}. Renew now to avoid interruption.'**
  String notifSubExpiringSoonBody(String expiryDate);

  /// Push notification title when subscription is paused
  ///
  /// In en, this message translates to:
  /// **'⏸️ Subscription Paused'**
  String get notifSubPausedTitle;

  /// Push notification body for paused subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription has been paused. Resume in the Play Store to restore access to all features.'**
  String get notifSubPausedBody;

  /// Push notification title when there's a payment problem
  ///
  /// In en, this message translates to:
  /// **'⚠️ Payment Issue'**
  String get notifSubPaymentIssueTitle;

  /// Push notification body for payment issue
  ///
  /// In en, this message translates to:
  /// **'Your subscription is on hold due to a payment issue. Please update your payment method in the Play Store.'**
  String get notifSubPaymentIssueBody;

  /// Push notification title for new chat message
  ///
  /// In en, this message translates to:
  /// **'New Message from {senderName}'**
  String notifNewMessageTitle(String senderName);

  /// Push notification title when team member visits business page
  ///
  /// In en, this message translates to:
  /// **'👀 Team Member Activity'**
  String get notifTeamActivityTitle;

  /// Push notification body for team member activity
  ///
  /// In en, this message translates to:
  /// **'{visitorName} visited the business opportunity page!'**
  String notifTeamActivityBody(String visitorName);

  /// Confirmation that launch campaign was sent successfully
  ///
  /// In en, this message translates to:
  /// **'Launch Campaign Sent'**
  String get notifLaunchSentTitle;

  /// Body for launch campaign confirmation notification
  ///
  /// In en, this message translates to:
  /// **'Your launch campaign has been successfully sent to your network.'**
  String get notifLaunchSentBody;

  /// Empty state when user has no notifications
  ///
  /// In en, this message translates to:
  /// **'No notifications yet.'**
  String get emptyNotifications;

  /// Fallback when notification has no message body
  ///
  /// In en, this message translates to:
  /// **'No message content.'**
  String get emptyMessageContent;

  /// Fallback when notification has no title
  ///
  /// In en, this message translates to:
  /// **'No Title'**
  String get emptyNotificationTitle;

  /// Empty state when user has no message conversations
  ///
  /// In en, this message translates to:
  /// **'No message threads found.'**
  String get emptyMessageThreads;

  /// Error state when team member profile doesn't exist
  ///
  /// In en, this message translates to:
  /// **'Team member not found.'**
  String get emptyTeamMember;

  /// Error state when notifications fail to load
  ///
  /// In en, this message translates to:
  /// **'Error loading notifications'**
  String get errorLoadingNotifications;

  /// Generic error message with error details
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String errorGeneric(String error);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'es', 'pt', 'tl'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'en':
      {
        switch (locale.countryCode) {
          case 'XA':
            return AppLocalizationsEnXa();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'pt':
      return AppLocalizationsPt();
    case 'tl':
      return AppLocalizationsTl();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
