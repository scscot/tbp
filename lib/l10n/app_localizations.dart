import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_pt.dart';

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
    Locale('de'),
    Locale('en'),
    Locale('en', 'XA'),
    Locale('es'),
    Locale('pt')
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

  /// Title for KPI stats section on dashboard
  ///
  /// In en, this message translates to:
  /// **'Your Current Team Stats'**
  String get dashKpiTitle;

  /// Tooltip for refresh button on team stats
  ///
  /// In en, this message translates to:
  /// **'Refresh team stats'**
  String get dashKpiRefreshTooltip;

  /// Dashboard tile CTA for joining business opportunity
  ///
  /// In en, this message translates to:
  /// **'Join Opportunity!'**
  String get dashTileJoinOpportunity;

  /// Subscription tile text during trial period
  ///
  /// In en, this message translates to:
  /// **'Start Subscription\n({daysLeft} days left in trial)'**
  String dashSubscriptionTrial(int daysLeft);

  /// Subscription tile text when trial has expired
  ///
  /// In en, this message translates to:
  /// **'Renew Your Subscription\n30-day Free trial expired.'**
  String get dashSubscriptionExpired;

  /// Subscription tile text when user cancelled subscription
  ///
  /// In en, this message translates to:
  /// **'You Cancelled Your Subscription\nReactivate Your Subscription Now'**
  String get dashSubscriptionCancelled;

  /// Button text to manage subscription settings
  ///
  /// In en, this message translates to:
  /// **'Manage Subscription'**
  String get dashSubscriptionManage;

  /// Network screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Your Global Team'**
  String get networkTitle;

  /// Label for direct sponsors count in network screen
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get networkLabelDirectSponsors;

  /// Label for total team count in network screen
  ///
  /// In en, this message translates to:
  /// **'Total Team'**
  String get networkLabelTotalTeam;

  /// Label for new members count in network screen
  ///
  /// In en, this message translates to:
  /// **'New Members'**
  String get networkLabelNewMembers;

  /// Placeholder text for network search field
  ///
  /// In en, this message translates to:
  /// **'Search team members...'**
  String get networkSearchHint;

  /// Tooltip for force refresh button in network screen
  ///
  /// In en, this message translates to:
  /// **'Force refresh data'**
  String get networkRefreshTooltip;

  /// Default dropdown text prompting user to select a report filter
  ///
  /// In en, this message translates to:
  /// **'View Team Report'**
  String get networkFilterSelectReport;

  /// Filter option to show all team members
  ///
  /// In en, this message translates to:
  /// **'All Members'**
  String get networkFilterAllMembers;

  /// Filter option to show only direct sponsors
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get networkFilterDirectSponsors;

  /// Filter option to show new members who joined today
  ///
  /// In en, this message translates to:
  /// **'New Members - Today'**
  String get networkFilterNewMembers;

  /// Filter option to show new members who joined yesterday
  ///
  /// In en, this message translates to:
  /// **'New Members - Yesterday'**
  String get networkFilterNewMembersYesterday;

  /// Filter option to show members who meet eligibility criteria
  ///
  /// In en, this message translates to:
  /// **'Qualified Members'**
  String get networkFilterQualified;

  /// Label prefix for member join date
  ///
  /// In en, this message translates to:
  /// **'Joined'**
  String get networkFilterJoined;

  /// Filter option showing all members with count
  ///
  /// In en, this message translates to:
  /// **'All Members ({count})'**
  String networkFilterAllMembersWithCount(int count);

  /// Filter option showing direct sponsors with count
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors ({count})'**
  String networkFilterDirectSponsorsWithCount(int count);

  /// Filter option showing new members today with count
  ///
  /// In en, this message translates to:
  /// **'New Members - Today ({count})'**
  String networkFilterNewMembersWithCount(int count);

  /// Filter option showing new members yesterday with count
  ///
  /// In en, this message translates to:
  /// **'New Members - Yesterday ({count})'**
  String networkFilterNewMembersYesterdayWithCount(int count);

  /// Filter option showing qualified members with count
  ///
  /// In en, this message translates to:
  /// **'Qualified Members ({count})'**
  String networkFilterQualifiedWithCount(int count);

  /// Filter option showing members who joined business with count
  ///
  /// In en, this message translates to:
  /// **'Joined {business} ({count})'**
  String networkFilterJoinedWithCount(String business, int count);

  /// Help message shown when no filter is selected
  ///
  /// In en, this message translates to:
  /// **'Select a report from the dropdown above or use the search bar to view and manage your team.'**
  String get networkMessageSelectReport;

  /// Message shown when search returns no results
  ///
  /// In en, this message translates to:
  /// **'Showing search results from All Members. No members match your search.'**
  String get networkMessageNoSearchResults;

  /// Message shown when selected filter has no members
  ///
  /// In en, this message translates to:
  /// **'No members found for this filter.'**
  String get networkMessageNoMembers;

  /// Context label showing which dataset is being searched
  ///
  /// In en, this message translates to:
  /// **'Searching in: All Members'**
  String get networkSearchingContext;

  /// Info message about search context
  ///
  /// In en, this message translates to:
  /// **'Showing search results from All Members'**
  String get networkSearchingContextInfo;

  /// Pagination status showing current count vs total
  ///
  /// In en, this message translates to:
  /// **'Showing {showing} of {total} members'**
  String networkPaginationInfo(int showing, int total);

  /// Label showing member's network level
  ///
  /// In en, this message translates to:
  /// **'Level {level}'**
  String networkLevelLabel(int level);

  /// Count of members with proper pluralization
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one {# Member} other {# Members}}'**
  String networkMembersCount(int count);

  /// Loading indicator when fetching additional members
  ///
  /// In en, this message translates to:
  /// **'Loading more members...'**
  String get networkLoadingMore;

  /// Button to load more members with count remaining
  ///
  /// In en, this message translates to:
  /// **'Load More Members ({remaining} remaining)'**
  String networkLoadMoreButton(int remaining);

  /// Message when all members have been loaded
  ///
  /// In en, this message translates to:
  /// **'All {count} members loaded'**
  String networkAllMembersLoaded(int count);

  /// Label showing when member joined
  ///
  /// In en, this message translates to:
  /// **'Joined {date}'**
  String networkMemberJoined(String date);

  /// Title for network performance analytics section
  ///
  /// In en, this message translates to:
  /// **'Network Performance'**
  String get networkAnalyticsPerformance;

  /// Title for geographic distribution analytics section
  ///
  /// In en, this message translates to:
  /// **'Geographic Distribution'**
  String get networkAnalyticsGeographic;

  /// Title for level distribution analytics section
  ///
  /// In en, this message translates to:
  /// **'Level Distribution'**
  String get networkAnalyticsLevels;

  /// Placeholder text for analytics chart area
  ///
  /// In en, this message translates to:
  /// **'Performance Chart\n(Chart implementation would go here)'**
  String get networkAnalyticsChartPlaceholder;

  /// Badge showing member level in analytics
  ///
  /// In en, this message translates to:
  /// **'Level {level}'**
  String networkLevelBadge(int level);

  /// Count of members at specific level
  ///
  /// In en, this message translates to:
  /// **'{count} members'**
  String networkLevelMembersCount(int count);

  /// Settings screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// Section title for organization settings
  ///
  /// In en, this message translates to:
  /// **'Organization Settings'**
  String get settingsTitleOrganization;

  /// Welcome message on settings screen for new admin users
  ///
  /// In en, this message translates to:
  /// **'Welcome {name}!\n\nLet\'s set up the foundation for your business opportunity.'**
  String settingsWelcomeMessage(String name);

  /// Label for organization name input field
  ///
  /// In en, this message translates to:
  /// **'Your Organization Name'**
  String get settingsLabelOrganizationName;

  /// Label for organization name confirmation field
  ///
  /// In en, this message translates to:
  /// **'Confirm Organization Name'**
  String get settingsLabelConfirmOrganizationName;

  /// Title for important information dialog
  ///
  /// In en, this message translates to:
  /// **'Very Important!'**
  String get settingsDialogImportantTitle;

  /// Important message about entering correct referral link
  ///
  /// In en, this message translates to:
  /// **'You must enter the exact referral link you received from your {organization} sponsor.'**
  String settingsDialogReferralImportance(String organization);

  /// Button to acknowledge important dialog
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get settingsDialogButtonUnderstand;

  /// Label for referral link input field
  ///
  /// In en, this message translates to:
  /// **'Your Referral Link'**
  String get settingsLabelReferralLink;

  /// Label for referral link confirmation field
  ///
  /// In en, this message translates to:
  /// **'Confirm Referral Link URL'**
  String get settingsLabelConfirmReferralLink;

  /// Label for countries selection section
  ///
  /// In en, this message translates to:
  /// **'Available Countries'**
  String get settingsLabelCountries;

  /// Label prefix for important information
  ///
  /// In en, this message translates to:
  /// **'Important:'**
  String get settingsImportantLabel;

  /// Instruction text for country selection
  ///
  /// In en, this message translates to:
  /// **'Only select the countries where your opportunity is currently available.'**
  String get settingsCountriesInstruction;

  /// Button to add country to selection
  ///
  /// In en, this message translates to:
  /// **'Add a Country'**
  String get settingsButtonAddCountry;

  /// Button to save settings changes
  ///
  /// In en, this message translates to:
  /// **'Save Settings'**
  String get settingsButtonSave;

  /// Label for displaying saved organization name
  ///
  /// In en, this message translates to:
  /// **'Your Organization'**
  String get settingsDisplayOrganization;

  /// Label for displaying saved referral link
  ///
  /// In en, this message translates to:
  /// **'Your Referral Link'**
  String get settingsDisplayReferralLink;

  /// Label for displaying selected countries list
  ///
  /// In en, this message translates to:
  /// **'Selected Available Countries'**
  String get settingsDisplayCountries;

  /// Message when no countries have been selected
  ///
  /// In en, this message translates to:
  /// **'No countries selected.'**
  String get settingsNoCountries;

  /// Title for network feeder system section
  ///
  /// In en, this message translates to:
  /// **'Network Feeder System'**
  String get settingsFeederSystemTitle;

  /// Detailed explanation of the network feeder system
  ///
  /// In en, this message translates to:
  /// **'This is your automated growth engine. When members join Team Build Pro through your link but haven\'t yet qualified for your business opportunity, they\'re placed in your feeder network. The moment you meet the eligibility requirements below, these members automatically transfer to your business opportunity team. It\'s a powerful system that rewards your dedication - the bigger your feeder network grows, the stronger your launch will be when you qualify.'**
  String get settingsFeederSystemDescription;

  /// Title for eligibility requirements section
  ///
  /// In en, this message translates to:
  /// **'Minimum Eligibility Requirements'**
  String get settingsEligibilityTitle;

  /// Label for minimum direct sponsors requirement
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get settingsEligibilityDirectSponsors;

  /// Label for minimum total team members requirement
  ///
  /// In en, this message translates to:
  /// **'Total Members'**
  String get settingsEligibilityTotalTeam;

  /// Section title for privacy and legal links
  ///
  /// In en, this message translates to:
  /// **'Privacy & Legal'**
  String get settingsPrivacyLegalTitle;

  /// Label for privacy policy link
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get settingsPrivacyPolicy;

  /// Subtitle explaining privacy policy link
  ///
  /// In en, this message translates to:
  /// **'View our privacy practices and data handling'**
  String get settingsPrivacyPolicySubtitle;

  /// Label for terms of service link
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get settingsTermsOfService;

  /// Subtitle explaining terms of service link
  ///
  /// In en, this message translates to:
  /// **'View our platform terms and conditions'**
  String get settingsTermsOfServiceSubtitle;

  /// Profile screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// Label for city field in profile
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get profileLabelCity;

  /// Label for state/province field in profile
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get profileLabelState;

  /// Label for country field in profile
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get profileLabelCountry;

  /// Label for join date in profile
  ///
  /// In en, this message translates to:
  /// **'Joined'**
  String get profileLabelJoined;

  /// Label for sponsor name in profile
  ///
  /// In en, this message translates to:
  /// **'Your Sponsor'**
  String get profileLabelSponsor;

  /// Label for team leader designation in profile
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get profileLabelTeamLeader;

  /// Button to edit profile information
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get profileButtonEdit;

  /// Button to sign out of account
  ///
  /// In en, this message translates to:
  /// **'Sign Out'**
  String get profileButtonSignOut;

  /// Loading message during sign out process
  ///
  /// In en, this message translates to:
  /// **'Signing out...'**
  String get profileSigningOut;

  /// Button to view terms of service
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get profileButtonTerms;

  /// Button to view privacy policy
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get profileButtonPrivacy;

  /// Button to delete user account
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get profileButtonDeleteAccount;

  /// Dialog title for demo account protection message
  ///
  /// In en, this message translates to:
  /// **'Demo Account Information'**
  String get profileDemoAccountTitle;

  /// Message explaining demo account cannot be deleted
  ///
  /// In en, this message translates to:
  /// **'This is a demo account for testing purposes and cannot be deleted.'**
  String get profileDemoAccountMessage;

  /// Additional information about demo accounts
  ///
  /// In en, this message translates to:
  /// **'Demo accounts are provided to showcase the app\'s features and functionality. If you need to create a real account, please sign up with your personal information.'**
  String get profileDemoAccountSubtext;

  /// Button to acknowledge demo account information
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get profileDemoAccountButton;

  /// Dialog title for admin account protection message
  ///
  /// In en, this message translates to:
  /// **'Admin Account Protection'**
  String get profileAdminProtectionTitle;

  /// Message explaining admin account deletion restrictions
  ///
  /// In en, this message translates to:
  /// **'Administrator accounts with active team members cannot be deleted through the app. This protection ensures your team\'s data and relationships remain intact.'**
  String get profileAdminProtectionMessage;

  /// Label showing admin's team size
  ///
  /// In en, this message translates to:
  /// **'Your Team: {directCount} Direct Sponsors'**
  String profileAdminTeamSize(int directCount);

  /// Instructions for admin account deletion
  ///
  /// In en, this message translates to:
  /// **'To delete your admin account, please contact our support team at legal@teambuildpro.com. We\'ll work with you to ensure a smooth transition for your team members.'**
  String get profileAdminProtectionInstructions;

  /// Contact information for admin account support
  ///
  /// In en, this message translates to:
  /// **'Contact: legal@teambuildpro.com'**
  String get profileAdminProtectionContact;

  /// Message center screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Message Center'**
  String get messageCenterTitle;

  /// Placeholder for message search field
  ///
  /// In en, this message translates to:
  /// **'Search messages...'**
  String get messageCenterSearchHint;

  /// Filter to show all message threads
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get messageCenterFilterAll;

  /// Filter to show unread message threads
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get messageCenterFilterUnread;

  /// Filter to show team message threads
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get messageCenterFilterTeam;

  /// Button to start new message thread
  ///
  /// In en, this message translates to:
  /// **'New Message'**
  String get messageCenterNewThread;

  /// Empty state message when no messages exist
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start a conversation with your team members!'**
  String get messageCenterEmptyState;

  /// Message shown when user is not logged in
  ///
  /// In en, this message translates to:
  /// **'Please log in to see messages.'**
  String get messageCenterNotLoggedIn;

  /// Label for sponsor contact card
  ///
  /// In en, this message translates to:
  /// **'Your Sponsor'**
  String get messageCenterSponsorLabel;

  /// Label for team leader contact card
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get messageCenterTeamLeaderLabel;

  /// Title for support team contacts section
  ///
  /// In en, this message translates to:
  /// **'Your Support Team'**
  String get messageCenterSupportTeamTitle;

  /// Subtitle for support team contacts section
  ///
  /// In en, this message translates to:
  /// **'Tap to start a conversation'**
  String get messageCenterSupportTeamSubtitle;

  /// Error message when messages fail to load
  ///
  /// In en, this message translates to:
  /// **'Error loading messages'**
  String get messageCenterError;

  /// Loading message while chat is being loaded
  ///
  /// In en, this message translates to:
  /// **'Loading chat...'**
  String get messageCenterLoadingChat;

  /// Error message when user details fail to load
  ///
  /// In en, this message translates to:
  /// **'Error loading user details'**
  String get messageCenterErrorLoadingUser;

  /// Fallback display name when user info is unavailable
  ///
  /// In en, this message translates to:
  /// **'Unknown User'**
  String get messageCenterUnknownUser;

  /// Badge showing unread message count
  ///
  /// In en, this message translates to:
  /// **'{count} new'**
  String messageCenterUnreadBadge(int count);

  /// Label showing time of last message
  ///
  /// In en, this message translates to:
  /// **'Last message {time}'**
  String messageCenterLastMessage(String time);

  /// Notifications screen title in app bar
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notificationsTitle;

  /// Filter to show all notifications
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get notificationsFilterAll;

  /// Filter to show unread notifications
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get notificationsFilterUnread;

  /// Filter to show milestone notifications
  ///
  /// In en, this message translates to:
  /// **'Milestones'**
  String get notificationsFilterMilestones;

  /// Filter to show team notifications
  ///
  /// In en, this message translates to:
  /// **'Team'**
  String get notificationsFilterTeam;

  /// Button to mark all notifications as read
  ///
  /// In en, this message translates to:
  /// **'Mark All Read'**
  String get notificationsMarkAllRead;

  /// Button to clear all notifications
  ///
  /// In en, this message translates to:
  /// **'Clear All'**
  String get notificationsClearAll;

  /// Empty state message when no notifications exist
  ///
  /// In en, this message translates to:
  /// **'No notifications yet. We\'ll notify you of important team updates!'**
  String get notificationsEmptyState;

  /// Time label for very recent notifications
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get notificationsTimeNow;

  /// Time label for notifications from minutes ago
  ///
  /// In en, this message translates to:
  /// **'{minutes}m ago'**
  String notificationsTimeMinutes(int minutes);

  /// Time label for notifications from hours ago
  ///
  /// In en, this message translates to:
  /// **'{hours}h ago'**
  String notificationsTimeHours(int hours);

  /// Time label for notifications from days ago
  ///
  /// In en, this message translates to:
  /// **'{days}d ago'**
  String notificationsTimeDays(int days);

  /// Getting started guide screen title
  ///
  /// In en, this message translates to:
  /// **'Getting Started'**
  String get gettingStartedTitle;

  /// Welcome heading in getting started guide
  ///
  /// In en, this message translates to:
  /// **'Welcome to Team Build Pro!'**
  String get gettingStartedWelcome;

  /// Introduction text for getting started guide
  ///
  /// In en, this message translates to:
  /// **'Let\'s get you set up for success. This quick guide will walk you through the essential features to start building your team.'**
  String get gettingStartedIntro;

  /// Title for step 1
  ///
  /// In en, this message translates to:
  /// **'Make Your List'**
  String get gettingStartedStep1Title;

  /// Title for step 2
  ///
  /// In en, this message translates to:
  /// **'Share with Your Network'**
  String get gettingStartedStep2Title;

  /// Title for step 3
  ///
  /// In en, this message translates to:
  /// **'Welcome Your New Team Members'**
  String get gettingStartedStep3Title;

  /// Description for step 3
  ///
  /// In en, this message translates to:
  /// **'When you receive a new team member notification, follow up immediately to welcome them to your team. First impressions matter!'**
  String get gettingStartedStep3Description;

  /// Title for step 4 in getting started
  ///
  /// In en, this message translates to:
  /// **'Engage Your Team'**
  String get gettingStartedStep4Title;

  /// Description for team engagement step
  ///
  /// In en, this message translates to:
  /// **'Use the message center to communicate with your team and provide support.'**
  String get gettingStartedStep4Description;

  /// Button to begin using the app after guide
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get gettingStartedButtonStart;

  /// Button to advance to next step in guide
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get gettingStartedButtonNext;

  /// Button to return to previous step in guide
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get gettingStartedButtonBack;

  /// Button to skip getting started guide
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get gettingStartedButtonSkip;

  /// Welcome screen title
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get welcomeTitle;

  /// Main headline on welcome screen
  ///
  /// In en, this message translates to:
  /// **'Build Your Team.\nGrow Your Business.'**
  String get welcomeHeadline;

  /// Subheadline explaining app purpose
  ///
  /// In en, this message translates to:
  /// **'The professional platform for team building and network growth.'**
  String get welcomeSubheadline;

  /// Button to navigate to sign in screen
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get welcomeButtonSignIn;

  /// Button to navigate to sign up screen
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get welcomeButtonSignUp;

  /// Title for feature 1 highlight
  ///
  /// In en, this message translates to:
  /// **'Smart Team Tracking'**
  String get welcomeFeature1Title;

  /// Description for feature 1
  ///
  /// In en, this message translates to:
  /// **'Monitor your team growth in real-time with powerful analytics.'**
  String get welcomeFeature1Description;

  /// Title for feature 2 highlight
  ///
  /// In en, this message translates to:
  /// **'Automated Growth'**
  String get welcomeFeature2Title;

  /// Description for feature 2
  ///
  /// In en, this message translates to:
  /// **'Network feeder system automatically transfers qualified members to your team.'**
  String get welcomeFeature2Description;

  /// Title for feature 3 highlight
  ///
  /// In en, this message translates to:
  /// **'Secure Messaging'**
  String get welcomeFeature3Title;

  /// Description for feature 3
  ///
  /// In en, this message translates to:
  /// **'Communicate securely with your team through encrypted messaging.'**
  String get welcomeFeature3Description;

  /// Add business link screen title
  ///
  /// In en, this message translates to:
  /// **'Add Link'**
  String get addLinkTitle;

  /// Instruction text for add link screen
  ///
  /// In en, this message translates to:
  /// **'Add your business opportunity link to start building your team.'**
  String get addLinkDescription;

  /// Label for business URL input field
  ///
  /// In en, this message translates to:
  /// **'Business Opportunity URL'**
  String get addLinkLabelUrl;

  /// Placeholder for business URL input
  ///
  /// In en, this message translates to:
  /// **'Enter the full URL to your business opportunity page'**
  String get addLinkHintUrl;

  /// Validation error when URL field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter a URL'**
  String get addLinkUrlRequired;

  /// Validation error when URL format is invalid
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid URL'**
  String get addLinkUrlInvalid;

  /// Button to save business link
  ///
  /// In en, this message translates to:
  /// **'Save Link'**
  String get addLinkButtonSave;

  /// Button to test if link works
  ///
  /// In en, this message translates to:
  /// **'Test Link'**
  String get addLinkButtonTest;

  /// Success message after saving link
  ///
  /// In en, this message translates to:
  /// **'Business link saved successfully!'**
  String get addLinkSuccessMessage;

  /// Error message when save fails
  ///
  /// In en, this message translates to:
  /// **'Error saving link. Please try again.'**
  String get addLinkErrorMessage;

  /// Business opportunity screen title
  ///
  /// In en, this message translates to:
  /// **'Business Opportunity'**
  String get businessTitle;

  /// Loading message while fetching business details
  ///
  /// In en, this message translates to:
  /// **'Loading opportunity details...'**
  String get businessLoadingMessage;

  /// Error message when loading fails
  ///
  /// In en, this message translates to:
  /// **'Unable to load opportunity details'**
  String get businessErrorMessage;

  /// Button to join business opportunity
  ///
  /// In en, this message translates to:
  /// **'Join Now'**
  String get businessButtonJoin;

  /// Button to learn more about opportunity
  ///
  /// In en, this message translates to:
  /// **'Learn More'**
  String get businessButtonLearnMore;

  /// Button to contact business sponsor
  ///
  /// In en, this message translates to:
  /// **'Contact Sponsor'**
  String get businessButtonContact;

  /// Change password screen title
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePasswordTitle;

  /// Label for current password field
  ///
  /// In en, this message translates to:
  /// **'Current Password'**
  String get changePasswordLabelCurrent;

  /// Placeholder for current password field
  ///
  /// In en, this message translates to:
  /// **'Enter your current password'**
  String get changePasswordHintCurrent;

  /// Validation error when current password is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your current password'**
  String get changePasswordCurrentRequired;

  /// Label for new password field
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get changePasswordLabelNew;

  /// Placeholder for new password field
  ///
  /// In en, this message translates to:
  /// **'Enter your new password'**
  String get changePasswordHintNew;

  /// Validation error when new password is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter a new password'**
  String get changePasswordNewRequired;

  /// Label for confirm new password field
  ///
  /// In en, this message translates to:
  /// **'Confirm New Password'**
  String get changePasswordLabelConfirm;

  /// Placeholder for confirm password field
  ///
  /// In en, this message translates to:
  /// **'Re-enter your new password'**
  String get changePasswordHintConfirm;

  /// Validation error when confirm password is empty
  ///
  /// In en, this message translates to:
  /// **'Please confirm your new password'**
  String get changePasswordConfirmRequired;

  /// Validation error when passwords don't match
  ///
  /// In en, this message translates to:
  /// **'New passwords don\'t match'**
  String get changePasswordMismatch;

  /// Button to update password
  ///
  /// In en, this message translates to:
  /// **'Update Password'**
  String get changePasswordButtonUpdate;

  /// Success message after password change
  ///
  /// In en, this message translates to:
  /// **'Password updated successfully!'**
  String get changePasswordSuccessMessage;

  /// Error message when password change fails
  ///
  /// In en, this message translates to:
  /// **'Error updating password. Please try again.'**
  String get changePasswordErrorMessage;

  /// Chat screen title
  ///
  /// In en, this message translates to:
  /// **'Chat'**
  String get chatTitle;

  /// Placeholder for chat message input
  ///
  /// In en, this message translates to:
  /// **'Type a message...'**
  String get chatInputHint;

  /// Button to send chat message
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chatButtonSend;

  /// Empty state when chat has no messages
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start the conversation!'**
  String get chatEmptyState;

  /// Placeholder for deleted message
  ///
  /// In en, this message translates to:
  /// **'This message was deleted'**
  String get chatMessageDeleted;

  /// Label showing message was edited
  ///
  /// In en, this message translates to:
  /// **'edited'**
  String get chatMessageEdited;

  /// Indicator showing someone is typing
  ///
  /// In en, this message translates to:
  /// **'{name} is typing...'**
  String chatTypingIndicator(String name);

  /// AI chatbot screen title
  ///
  /// In en, this message translates to:
  /// **'AI Coach'**
  String get chatbotTitle;

  /// Welcome message from AI chatbot
  ///
  /// In en, this message translates to:
  /// **'Hi! I\'m your AI coach. How can I help you grow your team today?'**
  String get chatbotWelcome;

  /// Placeholder for chatbot input field
  ///
  /// In en, this message translates to:
  /// **'Ask me anything about team building...'**
  String get chatbotInputHint;

  /// Suggested question 1 for chatbot
  ///
  /// In en, this message translates to:
  /// **'How do I recruit more effectively?'**
  String get chatbotSuggestion1;

  /// Suggested question 2 for chatbot
  ///
  /// In en, this message translates to:
  /// **'What are the eligibility requirements?'**
  String get chatbotSuggestion2;

  /// Suggested question 3 for chatbot
  ///
  /// In en, this message translates to:
  /// **'How does the feeder system work?'**
  String get chatbotSuggestion3;

  /// Loading indicator while chatbot generates response
  ///
  /// In en, this message translates to:
  /// **'Thinking...'**
  String get chatbotThinking;

  /// Company information screen title
  ///
  /// In en, this message translates to:
  /// **'Company Information'**
  String get companyTitle;

  /// Heading for about section
  ///
  /// In en, this message translates to:
  /// **'About Team Build Pro'**
  String get companyAboutHeading;

  /// About company description text
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is a professional SaaS platform designed for team building and network growth. We provide the tools and technology to help you build and manage your professional team effectively.'**
  String get companyAboutText;

  /// Label for app version information
  ///
  /// In en, this message translates to:
  /// **'App Version'**
  String get companyVersionLabel;

  /// Heading for contact section
  ///
  /// In en, this message translates to:
  /// **'Contact Us'**
  String get companyContactHeading;

  /// Support email address
  ///
  /// In en, this message translates to:
  /// **'support@teambuildpro.com'**
  String get companyContactEmail;

  /// Company website URL
  ///
  /// In en, this message translates to:
  /// **'www.teambuildpro.com'**
  String get companyContactWebsite;

  /// Delete account screen title
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get deleteAccountTitle;

  /// Warning message about permanent deletion
  ///
  /// In en, this message translates to:
  /// **'Warning: This action cannot be undone!'**
  String get deleteAccountWarning;

  /// Detailed description of account deletion consequences
  ///
  /// In en, this message translates to:
  /// **'Deleting your account will permanently remove all your data, including your profile, team information, and message history. This action is irreversible.'**
  String get deleteAccountDescription;

  /// Prompt for confirmation text input
  ///
  /// In en, this message translates to:
  /// **'To confirm deletion, please type DELETE below:'**
  String get deleteAccountConfirmPrompt;

  /// Hint for confirmation input
  ///
  /// In en, this message translates to:
  /// **'Enter your email address'**
  String get deleteAccountConfirmHint;

  /// Error when confirmation text doesn't match
  ///
  /// In en, this message translates to:
  /// **'Please type DELETE exactly as shown'**
  String get deleteAccountConfirmMismatch;

  /// Button to delete account
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get deleteAccountButtonDelete;

  /// Button to cancel deletion
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get deleteAccountButtonCancel;

  /// Success message after deletion
  ///
  /// In en, this message translates to:
  /// **'Your account has been deleted'**
  String get deleteAccountSuccessMessage;

  /// Error message when deletion fails
  ///
  /// In en, this message translates to:
  /// **'Error deleting account. Please contact support.'**
  String get deleteAccountErrorMessage;

  /// Edit profile screen title
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get editProfileTitle;

  /// Label for first name field
  ///
  /// In en, this message translates to:
  /// **'First Name'**
  String get editProfileLabelFirstName;

  /// Label for last name field
  ///
  /// In en, this message translates to:
  /// **'Last Name'**
  String get editProfileLabelLastName;

  /// Label for email field
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get editProfileLabelEmail;

  /// Label for phone number field
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get editProfileLabelPhone;

  /// Label for city field
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get editProfileLabelCity;

  /// Label for state/province field
  ///
  /// In en, this message translates to:
  /// **'State/Province'**
  String get editProfileLabelState;

  /// Label for country field
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get editProfileLabelCountry;

  /// Label for bio/about field
  ///
  /// In en, this message translates to:
  /// **'Bio'**
  String get editProfileLabelBio;

  /// Placeholder for bio field
  ///
  /// In en, this message translates to:
  /// **'Tell your team about yourself...'**
  String get editProfileHintBio;

  /// Button to save profile changes
  ///
  /// In en, this message translates to:
  /// **'Save Changes'**
  String get editProfileButtonSave;

  /// Button to cancel editing
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get editProfileButtonCancel;

  /// Button to change profile photo
  ///
  /// In en, this message translates to:
  /// **'Change Photo'**
  String get editProfileButtonChangePhoto;

  /// Success message after saving profile
  ///
  /// In en, this message translates to:
  /// **'Profile updated successfully!'**
  String get editProfileSuccessMessage;

  /// Error message when profile save fails
  ///
  /// In en, this message translates to:
  /// **'Error updating profile. Please try again.'**
  String get editProfileErrorMessage;

  /// Eligibility screen title
  ///
  /// In en, this message translates to:
  /// **'Eligibility Status'**
  String get eligibilityTitle;

  /// Section heading for current eligibility status
  ///
  /// In en, this message translates to:
  /// **'Current Status'**
  String get eligibilityCurrentStatus;

  /// Status label when user is qualified
  ///
  /// In en, this message translates to:
  /// **'Qualified!'**
  String get eligibilityStatusQualified;

  /// Status label when user is not qualified
  ///
  /// In en, this message translates to:
  /// **'Not Yet Qualified'**
  String get eligibilityStatusNotQualified;

  /// Section heading for eligibility requirements
  ///
  /// In en, this message translates to:
  /// **'Requirements'**
  String get eligibilityRequirementsHeading;

  /// Label for direct sponsors requirement
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get eligibilityDirectSponsorsLabel;

  /// Progress text for direct sponsors
  ///
  /// In en, this message translates to:
  /// **'{current} of {required} required'**
  String eligibilityDirectSponsorsProgress(int current, int required);

  /// Label for total team requirement
  ///
  /// In en, this message translates to:
  /// **'Total Team Members'**
  String get eligibilityTotalTeamLabel;

  /// Progress text for total team
  ///
  /// In en, this message translates to:
  /// **'{current} of {required} required'**
  String eligibilityTotalTeamProgress(int current, int required);

  /// Overall progress percentage
  ///
  /// In en, this message translates to:
  /// **'Progress: {percent}%'**
  String eligibilityProgressBar(int percent);

  /// Section heading for next steps
  ///
  /// In en, this message translates to:
  /// **'Next Steps'**
  String get eligibilityNextSteps;

  /// Encouragement text for next steps
  ///
  /// In en, this message translates to:
  /// **'Keep sharing your referral link to grow your team and meet the requirements!'**
  String get eligibilityNextStepsDescription;

  /// Share screen title
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get shareTitle;

  /// Heading for referral link section
  ///
  /// In en, this message translates to:
  /// **'Your Referral Link'**
  String get shareYourLinkHeading;

  /// Button to copy referral link
  ///
  /// In en, this message translates to:
  /// **'Copy Link'**
  String get shareButtonCopyLink;

  /// Success message when link is copied
  ///
  /// In en, this message translates to:
  /// **'Link copied to clipboard!'**
  String get shareLinkCopied;

  /// Button to share via SMS
  ///
  /// In en, this message translates to:
  /// **'Share via SMS'**
  String get shareButtonSms;

  /// Button to share via email
  ///
  /// In en, this message translates to:
  /// **'Share via Email'**
  String get shareButtonEmail;

  /// Button to share via WhatsApp
  ///
  /// In en, this message translates to:
  /// **'Share via WhatsApp'**
  String get shareButtonWhatsApp;

  /// Button to show more sharing options
  ///
  /// In en, this message translates to:
  /// **'More Options'**
  String get shareButtonMore;

  /// Default message template for sharing
  ///
  /// In en, this message translates to:
  /// **'Hey! I\'m building my team with Team Build Pro. Join me: {link}'**
  String shareMessageTemplate(String link);

  /// Heading for sharing statistics
  ///
  /// In en, this message translates to:
  /// **'Your Sharing Impact'**
  String get shareStatsHeading;

  /// Label for link view count
  ///
  /// In en, this message translates to:
  /// **'Link Views'**
  String get shareStatsViews;

  /// Label for signup count from link
  ///
  /// In en, this message translates to:
  /// **'Signups'**
  String get shareStatsSignups;

  /// Label for conversion rate percentage
  ///
  /// In en, this message translates to:
  /// **'Conversion Rate'**
  String get shareStatsConversion;

  /// Member detail screen title
  ///
  /// In en, this message translates to:
  /// **'Member Details'**
  String get memberDetailTitle;

  /// Label for member name
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get memberDetailLabelName;

  /// Label for member email
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get memberDetailLabelEmail;

  /// Label for member phone
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get memberDetailLabelPhone;

  /// Label for member location
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get memberDetailLabelLocation;

  /// Label for member join date
  ///
  /// In en, this message translates to:
  /// **'Joined'**
  String get memberDetailLabelJoined;

  /// Label for member's sponsor
  ///
  /// In en, this message translates to:
  /// **'Sponsor'**
  String get memberDetailLabelSponsor;

  /// Label for member's network level
  ///
  /// In en, this message translates to:
  /// **'Level'**
  String get memberDetailLabelLevel;

  /// Section heading for team stats
  ///
  /// In en, this message translates to:
  /// **'Team Statistics'**
  String get memberDetailTeamStats;

  /// Label showing direct sponsor count
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors: {count}'**
  String memberDetailDirectSponsors(int count);

  /// Label showing total team count
  ///
  /// In en, this message translates to:
  /// **'Total Team: {count}'**
  String memberDetailTotalTeam(int count);

  /// Button to message team member
  ///
  /// In en, this message translates to:
  /// **'Send Message'**
  String get memberDetailButtonMessage;

  /// Button to view member's team
  ///
  /// In en, this message translates to:
  /// **'View Their Team'**
  String get memberDetailButtonViewTeam;

  /// Message thread screen title
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get messageThreadTitle;

  /// Placeholder for message input field
  ///
  /// In en, this message translates to:
  /// **'Type your message...'**
  String get messageThreadInputHint;

  /// Button to send message
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get messageThreadButtonSend;

  /// Empty state when thread has no messages
  ///
  /// In en, this message translates to:
  /// **'No messages yet. Start the conversation!'**
  String get messageThreadEmptyState;

  /// Status label for delivered message
  ///
  /// In en, this message translates to:
  /// **'Delivered'**
  String get messageThreadDelivered;

  /// Status label for read message
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get messageThreadRead;

  /// Status label while message is sending
  ///
  /// In en, this message translates to:
  /// **'Sending...'**
  String get messageThreadSending;

  /// Status label when message fails to send
  ///
  /// In en, this message translates to:
  /// **'Failed to send'**
  String get messageThreadFailed;

  /// Login screen title
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get loginTitle;

  /// Button to sign in with Google
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get loginButtonGoogle;

  /// Button to sign in with Apple
  ///
  /// In en, this message translates to:
  /// **'Continue with Apple'**
  String get loginButtonApple;

  /// Divider text between social login and email login
  ///
  /// In en, this message translates to:
  /// **'or'**
  String get loginDivider;

  /// Link to password reset flow
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get loginForgotPassword;

  /// Title for password reset dialog
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get loginResetPasswordTitle;

  /// Instruction text for password reset
  ///
  /// In en, this message translates to:
  /// **'Enter your email address and we\'ll send you a link to reset your password.'**
  String get loginResetPasswordDescription;

  /// Button to send password reset email
  ///
  /// In en, this message translates to:
  /// **'Send Reset Link'**
  String get loginResetPasswordButton;

  /// Success message after sending reset email
  ///
  /// In en, this message translates to:
  /// **'Password reset email sent! Check your inbox.'**
  String get loginResetPasswordSuccess;

  /// Error message when reset email fails
  ///
  /// In en, this message translates to:
  /// **'Error sending reset email. Please try again.'**
  String get loginResetPasswordError;

  /// Generic cancel button label
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonButtonCancel;

  /// Generic save button label
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonButtonSave;

  /// Generic delete button label
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get commonButtonDelete;

  /// Generic edit button label
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get commonButtonEdit;

  /// Generic close button label
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get commonButtonClose;

  /// Generic OK button label
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get commonButtonOk;

  /// Generic yes button label
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get commonButtonYes;

  /// Generic no button label
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get commonButtonNo;

  /// Generic loading message
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get commonLoadingMessage;

  /// Generic error message
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get commonErrorMessage;

  /// Generic success message
  ///
  /// In en, this message translates to:
  /// **'Success!'**
  String get commonSuccessMessage;

  /// Generic message when no data exists
  ///
  /// In en, this message translates to:
  /// **'No data available'**
  String get commonNoDataMessage;

  /// Button to retry failed action
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get commonRetryButton;

  /// Button to refresh data
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get commonRefreshButton;

  /// Error when first name field is empty
  ///
  /// In en, this message translates to:
  /// **'First name cannot be empty'**
  String get authSignupErrorFirstName;

  /// Error when last name field is empty
  ///
  /// In en, this message translates to:
  /// **'Last name cannot be empty'**
  String get authSignupErrorLastName;

  /// Hero heading for add link screen
  ///
  /// In en, this message translates to:
  /// **'Add Your\n{business} Link'**
  String addLinkHeading(String business);

  /// Label for important information section
  ///
  /// In en, this message translates to:
  /// **'IMPORTANT INFORMATION'**
  String get addLinkImportantLabel;

  /// Disclaimer text for add link screen
  ///
  /// In en, this message translates to:
  /// **'You are updating your Team Build Pro account to track referrals to {business}. This is a separate, independent business entity that is NOT owned, operated, or affiliated with Team Build Pro.'**
  String addLinkDisclaimer(String business);

  /// Title for growth instruction section
  ///
  /// In en, this message translates to:
  /// **'Unlocking Your Growth Engine'**
  String get addLinkGrowthTitle;

  /// First instruction bullet point
  ///
  /// In en, this message translates to:
  /// **'Your referral link will be stored in your Team Build Pro profile for tracking purposes only.'**
  String get addLinkInstructionBullet1;

  /// Second instruction bullet point
  ///
  /// In en, this message translates to:
  /// **'When your team members qualify and join the {business} opportunity, they will automatically be placed in your official team'**
  String addLinkInstructionBullet2(String business);

  /// Third instruction bullet point
  ///
  /// In en, this message translates to:
  /// **'This link can only be set once, so please verify it\'s correct before saving.'**
  String get addLinkInstructionBullet3;

  /// Warning message about platform nature
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is a referral tracking platform only. We do not endorse or guarantee any business opportunities.'**
  String get addLinkWarning;

  /// Title for final step section
  ///
  /// In en, this message translates to:
  /// **'Final Step: Link Your Account'**
  String get addLinkFinalStepTitle;

  /// Subtitle for final step section
  ///
  /// In en, this message translates to:
  /// **'This ensures your new team members are automatically placed in your {business} organization.'**
  String addLinkFinalStepSubtitle(String business);

  /// Instruction for link field
  ///
  /// In en, this message translates to:
  /// **'Enter your {business} referral link below. This will be used to track referrals from your team.'**
  String addLinkFieldInstruction(String business);

  /// Message showing required URL prefix
  ///
  /// In en, this message translates to:
  /// **'Must begin with:\n{baseUrl}'**
  String addLinkMustBeginWith(String baseUrl);

  /// Label for referral link input field
  ///
  /// In en, this message translates to:
  /// **'Enter Your Referral Link'**
  String get addLinkFieldLabel;

  /// Helper text for link field
  ///
  /// In en, this message translates to:
  /// **'Must start with {baseUrl}\nThis cannot be changed once set'**
  String addLinkFieldHelper(String baseUrl);

  /// Error when link field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your {business} referral link.'**
  String addLinkFieldError(String business);

  /// Label for confirmation field
  ///
  /// In en, this message translates to:
  /// **'Confirm Referral Link URL'**
  String get addLinkConfirmFieldLabel;

  /// Error when confirmation field is empty
  ///
  /// In en, this message translates to:
  /// **'Please confirm your referral link.'**
  String get addLinkConfirmFieldError;

  /// Label for link preview section
  ///
  /// In en, this message translates to:
  /// **'Referral Link Preview:'**
  String get addLinkPreviewLabel;

  /// Message while saving link
  ///
  /// In en, this message translates to:
  /// **'Validating & Saving...'**
  String get addLinkSaving;

  /// Title for important dialog
  ///
  /// In en, this message translates to:
  /// **'Very Important!'**
  String get addLinkDialogImportantTitle;

  /// Important dialog message
  ///
  /// In en, this message translates to:
  /// **'You must enter the exact referral link you received from {business}. This will ensure your team members that join {business} are automatically placed in your {business} team.'**
  String addLinkDialogImportantMessage(String business);

  /// Button to acknowledge dialog
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get addLinkDialogImportantButton;

  /// Title for duplicate link dialog
  ///
  /// In en, this message translates to:
  /// **'Referral Link Already in Use'**
  String get addLinkDialogDuplicateTitle;

  /// Message for duplicate link
  ///
  /// In en, this message translates to:
  /// **'The {business} referral link you entered is already in use by another Team Build Pro member.'**
  String addLinkDialogDuplicateMessage(String business);

  /// Info about duplicate link requirement
  ///
  /// In en, this message translates to:
  /// **'You must use a different referral link to continue.'**
  String get addLinkDialogDuplicateInfo;

  /// Button to retry with different link
  ///
  /// In en, this message translates to:
  /// **'Try Different Link'**
  String get addLinkDialogDuplicateButton;

  /// Hero title on business screen
  ///
  /// In en, this message translates to:
  /// **'Congratulations\nYou\'re Qualified!'**
  String get businessHeroTitle;

  /// Hero message on business screen
  ///
  /// In en, this message translates to:
  /// **'Your hard work and team-building have paid off. You are now eligible to join the {business} opportunity.'**
  String businessHeroMessage(String business);

  /// Title for disclaimer section
  ///
  /// In en, this message translates to:
  /// **'Disclaimer Notice'**
  String get businessDisclaimerTitle;

  /// Disclaimer message
  ///
  /// In en, this message translates to:
  /// **'Your team growth has unlocked access to {business}. This opportunity operates as an independent business and has no affiliation with the Team Build Pro platform.'**
  String businessDisclaimerMessage(String business);

  /// Additional disclaimer info
  ///
  /// In en, this message translates to:
  /// **'The Team Build Pro App simply facilitates access to {business} via your upline sponsor. It does not endorse or guarantee any specific outcomes from this opportunity.'**
  String businessDisclaimerInfo(String business);

  /// Title for sponsor section
  ///
  /// In en, this message translates to:
  /// **'Your Referral Contact'**
  String get businessSponsorTitle;

  /// Sponsor message
  ///
  /// In en, this message translates to:
  /// **'If you choose to explore {business}, your referral contact will be {sponsor}. This person is a member of your upline team who has already joined {business}.'**
  String businessSponsorMessage(String business, String sponsor);

  /// Title for instructions section
  ///
  /// In en, this message translates to:
  /// **'How to Join {business}'**
  String businessInstructionsTitle(String business);

  /// Step-by-step instructions
  ///
  /// In en, this message translates to:
  /// **'1. Copy the referral link below\n2. Open your web browser\n3. Paste the link and complete the {business} registration\n4. Return here to add your {business} referral link'**
  String businessInstructions(String business);

  /// Message when URL is not available
  ///
  /// In en, this message translates to:
  /// **'Registration URL not available. Please contact your sponsor.'**
  String get businessNoUrlMessage;

  /// Label for sponsor's URL
  ///
  /// In en, this message translates to:
  /// **'Your Sponsors Referral Link:'**
  String get businessUrlLabel;

  /// Tooltip for copy button
  ///
  /// In en, this message translates to:
  /// **'Copy URL'**
  String get businessUrlCopyTooltip;

  /// Success message after copying URL
  ///
  /// In en, this message translates to:
  /// **'Registration URL copied to clipboard!'**
  String get businessUrlCopiedMessage;

  /// Error message when copy fails
  ///
  /// In en, this message translates to:
  /// **'Failed to copy URL: {error}'**
  String businessUrlCopyError(String error);

  /// Title for follow-up section
  ///
  /// In en, this message translates to:
  /// **'Final Step: Link Your Account'**
  String get businessFollowUpTitle;

  /// Follow-up message
  ///
  /// In en, this message translates to:
  /// **'After exploring {business}, you must return here and add your new {business} referral link to your Team Build Pro profile. This ensures your team connections are tracked correctly.'**
  String businessFollowUpMessage(String business);

  /// First line of completion button
  ///
  /// In en, this message translates to:
  /// **'Registration Complete'**
  String get businessCompleteButton1;

  /// Second line of completion button
  ///
  /// In en, this message translates to:
  /// **'Add My Referral Link'**
  String get businessCompleteButton2;

  /// Title for confirmation dialog
  ///
  /// In en, this message translates to:
  /// **'Before You Continue'**
  String get businessConfirmDialogTitle;

  /// Confirmation dialog message
  ///
  /// In en, this message translates to:
  /// **'This is the next step in your journey. After joining {business} through your sponsor\'s link, you must return here to add your new {business} referral link to your profile. This is a critical step to ensure your new team members are placed correctly.'**
  String businessConfirmDialogMessage(String business);

  /// Button to acknowledge confirmation
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get businessConfirmDialogButton;

  /// Title for visit required dialog
  ///
  /// In en, this message translates to:
  /// **'Visit Required First'**
  String get businessVisitRequiredTitle;

  /// Visit required message
  ///
  /// In en, this message translates to:
  /// **'Before updating your profile, you must first use the \'Copy Registration Link\' button on this page to visit {business} and complete your registration.'**
  String businessVisitRequiredMessage(String business);

  /// Button to acknowledge visit required
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get businessVisitRequiredButton;

  /// Main heading for getting started screen
  ///
  /// In en, this message translates to:
  /// **'Getting Started with Team Build Pro'**
  String get gettingStartedHeading;

  /// Subheading for getting started screen
  ///
  /// In en, this message translates to:
  /// **'Follow these simple steps to start building your team'**
  String get gettingStartedSubheading;

  /// Description for step 1
  ///
  /// In en, this message translates to:
  /// **'Create a list of recruiting prospects and current {business} team members you want to share Team Build Pro with. Think about who could benefit from this tool to accelerate their team building.'**
  String gettingStartedStep1Description(String business);

  /// Description for step 2
  ///
  /// In en, this message translates to:
  /// **'Use the Share feature to quickly and easily send targeted text messages and emails to your recruiting prospects and {business} team members.'**
  String gettingStartedStep2Description(String business);

  /// Button to open share screen
  ///
  /// In en, this message translates to:
  /// **'Open Share'**
  String get gettingStartedStep2Button;

  /// Title for pro tip section
  ///
  /// In en, this message translates to:
  /// **'Pro Tip'**
  String get gettingStartedProTipTitle;

  /// Pro tip message
  ///
  /// In en, this message translates to:
  /// **'Consistent follow-up and engagement are key to building a strong, active team.'**
  String get gettingStartedProTipMessage;

  /// Hero title when qualified
  ///
  /// In en, this message translates to:
  /// **'CONGRATULATIONS\nYou\'re Qualified!'**
  String get eligibilityHeroTitleQualified;

  /// Hero title when not qualified
  ///
  /// In en, this message translates to:
  /// **'Build Your Momentum'**
  String get eligibilityHeroTitleNotQualified;

  /// Hero message when qualified
  ///
  /// In en, this message translates to:
  /// **'Incredible work! You\'ve built your foundational team and unlocked the {business} opportunity. Continue growing your network to help others achieve the same success.'**
  String eligibilityHeroMessageQualified(String business);

  /// Hero message when not qualified
  ///
  /// In en, this message translates to:
  /// **'You\'re on your way! Every professional you connect with builds momentum for your future launch in the {business} opportunity. Keep sharing to reach your goals!'**
  String eligibilityHeroMessageNotQualified(String business);

  /// Hero button text
  ///
  /// In en, this message translates to:
  /// **'Proven Growth Strategies'**
  String get eligibilityHeroButton;

  /// Title for thresholds section
  ///
  /// In en, this message translates to:
  /// **'QUALIFICATION THRESHOLDS'**
  String get eligibilityThresholdsTitle;

  /// Label for direct sponsors metric
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get eligibilityLabelDirectSponsors;

  /// Label for total team metric
  ///
  /// In en, this message translates to:
  /// **'Total Team Members'**
  String get eligibilityLabelTotalTeam;

  /// Title for current counts section
  ///
  /// In en, this message translates to:
  /// **'YOUR CURRENT TEAM COUNTS'**
  String get eligibilityCurrentCountsTitle;

  /// Current direct sponsors label
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get eligibilityCurrentDirectSponsors;

  /// Current total team label
  ///
  /// In en, this message translates to:
  /// **'Total Team Members'**
  String get eligibilityCurrentTotalTeam;

  /// Title for process section
  ///
  /// In en, this message translates to:
  /// **'THE PROCESS'**
  String get eligibilityProcessTitle;

  /// Title for process step 1
  ///
  /// In en, this message translates to:
  /// **'INVITE - Build Your Foundation'**
  String get eligibilityProcessStep1Title;

  /// Description for process step 1
  ///
  /// In en, this message translates to:
  /// **'Connect with like-minded professionals open to exploring {business}.'**
  String eligibilityProcessStep1Description(String business);

  /// Title for process step 2
  ///
  /// In en, this message translates to:
  /// **'CULTIVATE - Create Momentum'**
  String get eligibilityProcessStep2Title;

  /// Description for process step 2
  ///
  /// In en, this message translates to:
  /// **'Foster authentic relationships as your team grows, creating a thriving team of professionals who support each other\'s success.'**
  String get eligibilityProcessStep2Description;

  /// Title for process step 3
  ///
  /// In en, this message translates to:
  /// **'PARTNER - Launch with Success'**
  String get eligibilityProcessStep3Title;

  /// Description for process step 3
  ///
  /// In en, this message translates to:
  /// **'Team members receive an invitation to join {business} upon achieving key growth targets.'**
  String eligibilityProcessStep3Description(String business);

  /// Main heading for share screen
  ///
  /// In en, this message translates to:
  /// **'Powerful Referral System'**
  String get shareHeading;

  /// Subheading for share screen
  ///
  /// In en, this message translates to:
  /// **'Share your referral links to pre-build a new team with recruiting prospects or expand your existing team.'**
  String get shareSubheading;

  /// Title for strategies section
  ///
  /// In en, this message translates to:
  /// **'Proven Growth Strategies'**
  String get shareStrategiesTitle;

  /// Title for prospect strategy
  ///
  /// In en, this message translates to:
  /// **'New Recruiting Prospects'**
  String get shareProspectTitle;

  /// Subtitle for prospect strategy
  ///
  /// In en, this message translates to:
  /// **'Invite recruiting prospects to get a head start.'**
  String get shareProspectSubtitle;

  /// Description for prospect strategy
  ///
  /// In en, this message translates to:
  /// **'Invite recruiting prospects to pre-build their {business} team with this app. They can create powerful momentum before officially joining {business}, ensuring success from day one.'**
  String shareProspectDescription(String business);

  /// Title for partner strategy
  ///
  /// In en, this message translates to:
  /// **'Current Business Partners'**
  String get sharePartnerTitle;

  /// Subtitle for partner strategy
  ///
  /// In en, this message translates to:
  /// **'Great for your existing {business} team'**
  String sharePartnerSubtitle(String business);

  /// Description for partner strategy
  ///
  /// In en, this message translates to:
  /// **'Empower your existing {business} partners with the same tool you use. This promotes duplication and helps accelerate growth throughout your entire {business} organization.'**
  String sharePartnerDescription(String business);

  /// Label for message selection
  ///
  /// In en, this message translates to:
  /// **'Select Message To Send'**
  String get shareSelectMessageLabel;

  /// Button to share message
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get shareButtonShare;

  /// Success message after copying link
  ///
  /// In en, this message translates to:
  /// **'Link copied to clipboard!'**
  String get shareLinkCopiedMessage;

  /// Title for pro tips section
  ///
  /// In en, this message translates to:
  /// **'Pro Tips for Success'**
  String get shareProTipsTitle;

  /// Pro tip 1
  ///
  /// In en, this message translates to:
  /// **'💬 Personalize your message when sharing'**
  String get shareProTip1;

  /// Pro tip 2
  ///
  /// In en, this message translates to:
  /// **'📱 Share consistently across all social platforms'**
  String get shareProTip2;

  /// Pro tip 3
  ///
  /// In en, this message translates to:
  /// **'🤝 Follow up with prospects who show interest'**
  String get shareProTip3;

  /// Pro tip 4
  ///
  /// In en, this message translates to:
  /// **'📈 Track your results and adjust your approach'**
  String get shareProTip4;

  /// Pro tip 5
  ///
  /// In en, this message translates to:
  /// **'🎯 Use both strategies for maximum growth potential'**
  String get shareProTip5;

  /// Title for demo mode dialog
  ///
  /// In en, this message translates to:
  /// **'Demo Mode'**
  String get shareDemoTitle;

  /// Message for demo mode
  ///
  /// In en, this message translates to:
  /// **'Sharing disabled during demo mode.'**
  String get shareDemoMessage;

  /// Button to acknowledge demo mode
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get shareDemoButton;

  /// Button to send message to member
  ///
  /// In en, this message translates to:
  /// **'Send Message'**
  String get memberDetailButtonSendMessage;

  /// Label for direct sponsors on detail screen
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get memberDetailLabelDirectSponsors;

  /// Label for network join date
  ///
  /// In en, this message translates to:
  /// **'Joined Network'**
  String get memberDetailLabelJoinedNetwork;

  /// Label for organization join date
  ///
  /// In en, this message translates to:
  /// **'Joined Organization'**
  String get memberDetailLabelJoinedOrganization;

  /// Label for qualified status
  ///
  /// In en, this message translates to:
  /// **'Qualified'**
  String get memberDetailLabelQualified;

  /// Label for qualification date
  ///
  /// In en, this message translates to:
  /// **'Qualified Date'**
  String get memberDetailLabelQualifiedDate;

  /// Label for team leader
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get memberDetailLabelTeamLeader;

  /// Label for total team count
  ///
  /// In en, this message translates to:
  /// **'Total Team'**
  String get memberDetailLabelTotalTeam;

  /// Status when not qualified
  ///
  /// In en, this message translates to:
  /// **'Not Yet'**
  String get memberDetailNotYet;

  /// Status when not joined
  ///
  /// In en, this message translates to:
  /// **'Not Yet Joined'**
  String get memberDetailNotYetJoined;

  /// Title for eligibility section
  ///
  /// In en, this message translates to:
  /// **'Eligibility Requirements'**
  String get memberDetailEligibilityTitle;

  /// Label for eligibility direct sponsors
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get memberDetailEligibilityDirectSponsors;

  /// Label for eligibility total team
  ///
  /// In en, this message translates to:
  /// **'Total Team'**
  String get memberDetailEligibilityTotalTeam;

  /// Eligibility explanation message
  ///
  /// In en, this message translates to:
  /// **'Team members who meet these requirements are automatically invited to join the {organization}.'**
  String memberDetailEligibilityMessage(String organization);

  /// Status when eligibility is waived
  ///
  /// In en, this message translates to:
  /// **'Waived'**
  String get memberDetailEligibilityWaived;

  /// Heading for message thread screen
  ///
  /// In en, this message translates to:
  /// **'Message Center'**
  String get messageThreadHeading;

  /// Empty state message for thread
  ///
  /// In en, this message translates to:
  /// **'Start the conversation!'**
  String get messageThreadEmptyMessage;

  /// Title for URL warning dialog
  ///
  /// In en, this message translates to:
  /// **'External Link Warning'**
  String get messageThreadUrlWarningTitle;

  /// Warning message about URLs
  ///
  /// In en, this message translates to:
  /// **'This message contains an external link. Be cautious when clicking links from unknown sources.'**
  String get messageThreadUrlWarningMessage;

  /// Button to acknowledge warning
  ///
  /// In en, this message translates to:
  /// **'Understood'**
  String get messageThreadUrlWarningButton;

  /// Title for AI assistant
  ///
  /// In en, this message translates to:
  /// **'AI Assistant'**
  String get chatbotAssistantTitle;

  /// Subtitle for AI assistant
  ///
  /// In en, this message translates to:
  /// **'Ask me anything about Team Build Pro'**
  String get chatbotAssistantSubtitle;

  /// Tooltip for clear button
  ///
  /// In en, this message translates to:
  /// **'Clear conversation'**
  String get chatbotClearTooltip;

  /// Message when not signed in
  ///
  /// In en, this message translates to:
  /// **'Please sign in to use the AI Assistant'**
  String get chatbotSignInRequired;

  /// Heading for company screen
  ///
  /// In en, this message translates to:
  /// **'Company Details'**
  String get companyHeading;

  /// Label for company name
  ///
  /// In en, this message translates to:
  /// **'Company Name'**
  String get companyLabelName;

  /// Label for referral link
  ///
  /// In en, this message translates to:
  /// **'My Company Referral Link'**
  String get companyLabelReferralLink;

  /// Title when account is linked
  ///
  /// In en, this message translates to:
  /// **'Account Linked!'**
  String get companyLinkedTitle;

  /// Message when account is linked
  ///
  /// In en, this message translates to:
  /// **'Great news! As your team members gain momentum and qualify, they will receive an invitation to join your {business} organization.'**
  String companyLinkedMessage(String business);

  /// Status when data not available
  ///
  /// In en, this message translates to:
  /// **'Not available'**
  String get companyNotAvailable;

  /// Main heading for delete account screen
  ///
  /// In en, this message translates to:
  /// **'Account Deletion'**
  String get deleteAccountHeading;

  /// Subheading for delete account screen
  ///
  /// In en, this message translates to:
  /// **'We\'re sorry to see you go. Please review the information below carefully.'**
  String get deleteAccountSubheading;

  /// Title for warning section
  ///
  /// In en, this message translates to:
  /// **'PERMANENT ACCOUNT DELETION'**
  String get deleteAccountWarningTitle;

  /// Warning message introduction
  ///
  /// In en, this message translates to:
  /// **'This action cannot be undone. When you delete your account:'**
  String get deleteAccountWarningMessage;

  /// First warning point
  ///
  /// In en, this message translates to:
  /// **'Your personal data will be permanently deleted'**
  String get deleteAccountWarning1;

  /// Second warning point
  ///
  /// In en, this message translates to:
  /// **'You will lose access to all premium features'**
  String get deleteAccountWarning2;

  /// Third warning point
  ///
  /// In en, this message translates to:
  /// **'Your account cannot be recovered or reactivated'**
  String get deleteAccountWarning3;

  /// Fourth warning point
  ///
  /// In en, this message translates to:
  /// **'Your network relationships will be preserved for business continuity'**
  String get deleteAccountWarning4;

  /// Fifth warning point
  ///
  /// In en, this message translates to:
  /// **'You will be immediately signed out of all devices'**
  String get deleteAccountWarning5;

  /// Title for account info section
  ///
  /// In en, this message translates to:
  /// **'Account Information'**
  String get deleteAccountInfoTitle;

  /// Title for confirmation section
  ///
  /// In en, this message translates to:
  /// **'Confirmation Required'**
  String get deleteAccountConfirmTitle;

  /// Label for confirmation input
  ///
  /// In en, this message translates to:
  /// **'To confirm deletion, please type your email address:'**
  String get deleteAccountConfirmLabel;

  /// First confirmation checkbox
  ///
  /// In en, this message translates to:
  /// **'I understand this action is permanent and cannot be undone'**
  String get deleteAccountCheckbox1;

  /// Second confirmation checkbox
  ///
  /// In en, this message translates to:
  /// **'I understand I will lose access to all data and premium features'**
  String get deleteAccountCheckbox2;

  /// Third confirmation checkbox
  ///
  /// In en, this message translates to:
  /// **'I acknowledge my network relationships will be preserved for business operations'**
  String get deleteAccountCheckbox3;

  /// Message while deleting
  ///
  /// In en, this message translates to:
  /// **'Deleting...'**
  String get deleteAccountDeleting;

  /// Title for help section
  ///
  /// In en, this message translates to:
  /// **'Need Help?'**
  String get deleteAccountHelpTitle;

  /// Help message
  ///
  /// In en, this message translates to:
  /// **'If you\'re experiencing issues with the app, please contact our support team before deleting your account.'**
  String get deleteAccountHelpMessage;

  /// Button to contact support
  ///
  /// In en, this message translates to:
  /// **'Contact Support'**
  String get deleteAccountHelpButton;

  /// Title for demo account dialog
  ///
  /// In en, this message translates to:
  /// **'Demo Account Protection'**
  String get deleteAccountDemoTitle;

  /// Message for demo account protection
  ///
  /// In en, this message translates to:
  /// **'This is a protected demo account and cannot be deleted.\n\nDemo accounts are maintained for app review and demonstration purposes.\n\nIf you are testing the app, please create a new account for testing account deletion features.'**
  String get deleteAccountDemoMessage;

  /// Button to acknowledge demo protection
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get deleteAccountDemoButton;

  /// Main heading for edit profile screen
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get editProfileHeading;

  /// Heading for first-time profile setup
  ///
  /// In en, this message translates to:
  /// **'Complete Your Profile'**
  String get editProfileHeadingFirstTime;

  /// Instructions for first-time setup
  ///
  /// In en, this message translates to:
  /// **'Please complete your profile to get started'**
  String get editProfileInstructionsFirstTime;

  /// First part of business question
  ///
  /// In en, this message translates to:
  /// **'Are you currently a '**
  String get editProfileBusinessQuestion;

  /// Second part of business question
  ///
  /// In en, this message translates to:
  /// **' representative?'**
  String get editProfileBusinessQuestionSuffix;

  /// Yes option
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get editProfileYes;

  /// No option
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get editProfileNo;

  /// Title for important dialog
  ///
  /// In en, this message translates to:
  /// **'Very Important!'**
  String get editProfileDialogImportantTitle;

  /// Important dialog message
  ///
  /// In en, this message translates to:
  /// **'You must enter the exact referral link you received from your {business} sponsor.'**
  String editProfileDialogImportantMessage(String business);

  /// Button to acknowledge dialog
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get editProfileDialogImportantButton;

  /// Label for referral link field
  ///
  /// In en, this message translates to:
  /// **'Enter Your Referral Link'**
  String get editProfileReferralLinkField;

  /// Label for referral link
  ///
  /// In en, this message translates to:
  /// **'Your Referral Link'**
  String get editProfileReferralLinkLabel;

  /// Helper text for referral link
  ///
  /// In en, this message translates to:
  /// **'Enter the referral link from your {business} sponsor'**
  String editProfileReferralLinkHelper(String business);

  /// Label for confirmation field
  ///
  /// In en, this message translates to:
  /// **'Confirm Referral Link'**
  String get editProfileConfirmReferralLink;

  /// Label for country selector
  ///
  /// In en, this message translates to:
  /// **'Select Your Country'**
  String get editProfileSelectCountry;

  /// Label for state selector
  ///
  /// In en, this message translates to:
  /// **'Select Your State/Province'**
  String get editProfileSelectState;

  /// Message when state selector is disabled
  ///
  /// In en, this message translates to:
  /// **'First select a country'**
  String get editProfileSelectStateDisabled;

  /// Error when city is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your city'**
  String get editProfileErrorCity;

  /// Error when state is not selected
  ///
  /// In en, this message translates to:
  /// **'Please select your state/province'**
  String get editProfileErrorState;

  /// Error when country is not selected
  ///
  /// In en, this message translates to:
  /// **'Please select your country'**
  String get editProfileErrorCountry;

  /// Error message for photo upload failure
  ///
  /// In en, this message translates to:
  /// **'Error uploading photo. Please try again.'**
  String get editProfilePhotoError;

  /// Title for deletion section
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get editProfileDeletionTitle;

  /// Message for deletion section
  ///
  /// In en, this message translates to:
  /// **'Permanently delete your account and all associated data.'**
  String get editProfileDeletionMessage;

  /// Warning subtext for deletion
  ///
  /// In en, this message translates to:
  /// **'This action cannot be undone'**
  String get editProfileDeletionSubtext;

  /// Button to proceed with deletion
  ///
  /// In en, this message translates to:
  /// **'Complete Deletion'**
  String get editProfileDeletionButton;

  /// Label for email input field on login screen
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get loginLabelEmail;

  /// Label for password input field on login screen
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get loginLabelPassword;

  /// Validation error when email field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get loginValidatorEmail;

  /// Validation error when password field is empty
  ///
  /// In en, this message translates to:
  /// **'Please enter your password'**
  String get loginValidatorPassword;

  /// Button text for main login action
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get loginButtonLogin;

  /// Button text for biometric authentication login
  ///
  /// In en, this message translates to:
  /// **'Sign in with Biometric'**
  String get loginButtonBiometric;

  /// Divider text between login options
  ///
  /// In en, this message translates to:
  /// **'or'**
  String get loginDividerOr;

  /// Text prompting user to create account
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account? '**
  String get loginNoAccount;

  /// Link text to navigate to account creation
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get loginCreateAccount;

  /// Link text for privacy policy
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get loginPrivacyPolicy;

  /// Link text for terms of service
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get loginTermsOfService;

  /// Greeting message on welcome screen with user's first name
  ///
  /// In en, this message translates to:
  /// **'Welcome, {firstName}!'**
  String welcomeGreeting(String firstName);

  /// Welcome message for admin users
  ///
  /// In en, this message translates to:
  /// **'Ready to lead the professional networking revolution? Complete your admin profile and set up your team. After completing your profile you will have access to the full Team Build Pro platform.'**
  String get welcomeMessageAdmin;

  /// Welcome message for regular users
  ///
  /// In en, this message translates to:
  /// **'Ready to transform your professional network? Complete your profile to unlock the full power of Team Build Pro.'**
  String get welcomeMessageUser;

  /// Button text to proceed from welcome screen
  ///
  /// In en, this message translates to:
  /// **'Join the Revolution'**
  String get welcomeButtonJoin;

  /// Heading for change password screen
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePasswordHeading;

  /// Placeholder message for change password implementation
  ///
  /// In en, this message translates to:
  /// **'TODO: Implement change password form here.'**
  String get changePasswordTodoMessage;

  /// Placeholder message for chat screen implementation
  ///
  /// In en, this message translates to:
  /// **'Chat interface goes here.'**
  String get chatPlaceholder;

  /// Title for AI Coach welcome message
  ///
  /// In en, this message translates to:
  /// **'Welcome to your AI Coach!'**
  String get quickPromptsWelcomeTitle;

  /// Description explaining AI Coach capabilities
  ///
  /// In en, this message translates to:
  /// **'I\'m here to help you succeed with Team Build Pro. I can answer questions about the app, team building strategies, and guide you through features.'**
  String get quickPromptsWelcomeDescription;

  /// Disclaimer message for AI Coach reliability
  ///
  /// In en, this message translates to:
  /// **'AI Coach can make mistakes. Check important info.'**
  String get quickPromptsDisclaimerMessage;

  /// Header asking user what they need help with
  ///
  /// In en, this message translates to:
  /// **'What can I help you with?'**
  String get quickPromptsQuestionHeader;

  /// Subheader instructing user how to interact with prompts
  ///
  /// In en, this message translates to:
  /// **'Tap any question below to get started, or type your own question.'**
  String get quickPromptsQuestionSubheader;

  /// Label for pro tip section
  ///
  /// In en, this message translates to:
  /// **'Pro Tip'**
  String get quickPromptsProTipLabel;

  /// Pro tip text with example question
  ///
  /// In en, this message translates to:
  /// **'Be specific with your questions. For example: \"I have 2 direct sponsors, what should I focus on next?\"'**
  String get quickPromptsProTipText;

  /// AI Coach quick prompt #1
  ///
  /// In en, this message translates to:
  /// **'How does qualification work?'**
  String get chatbotPrompt1;

  /// AI Coach quick prompt #2
  ///
  /// In en, this message translates to:
  /// **'What\'s the difference between this and an MLM?'**
  String get chatbotPrompt2;

  /// AI Coach quick prompt #3
  ///
  /// In en, this message translates to:
  /// **'How do I invite people to my team?'**
  String get chatbotPrompt3;

  /// AI Coach quick prompt #4
  ///
  /// In en, this message translates to:
  /// **'Show me my team analytics'**
  String get chatbotPrompt4;

  /// AI Coach quick prompt #5
  ///
  /// In en, this message translates to:
  /// **'What should I focus on next?'**
  String get chatbotPrompt5;

  /// AI Coach quick prompt #6
  ///
  /// In en, this message translates to:
  /// **'How do I cancel my subscription?'**
  String get chatbotPrompt6;

  /// AI Coach quick prompt #7
  ///
  /// In en, this message translates to:
  /// **'Why do most people fail at direct sales?'**
  String get chatbotPrompt7;

  /// AI Coach quick prompt #8
  ///
  /// In en, this message translates to:
  /// **'What happens after I qualify?'**
  String get chatbotPrompt8;

  /// No description provided for @shareProspectPastStrugglesTitle.
  ///
  /// In en, this message translates to:
  /// **'Addressing Past Struggles'**
  String get shareProspectPastStrugglesTitle;

  /// No description provided for @shareProspectPastStrugglesDescription.
  ///
  /// In en, this message translates to:
  /// **'Perfect for prospects who have tried before and struggled'**
  String get shareProspectPastStrugglesDescription;

  /// No description provided for @shareProspectPastStrugglesSubject.
  ///
  /// In en, this message translates to:
  /// **'A Smarter Way to Start This Time'**
  String get shareProspectPastStrugglesSubject;

  /// No description provided for @shareProspectPastStrugglesMessage.
  ///
  /// In en, this message translates to:
  /// **'If past attempts left you stuck at zero with no momentum, here\'s a smarter path.\n\nTeam Build Pro\'s AI Coach helps you pre-build your {business} team before you even join.\n\nIt drafts your messages, times your follow-ups, and tracks who\'s interested - so you don\'t start from scratch this time. You launch with people already waiting for you.\n\nThe AI walks you through every step. You won\'t be alone.\n\nSee how it works: {link}\n\nYou deserve a real shot this time.'**
  String shareProspectPastStrugglesMessage(Object business, Object link);

  /// No description provided for @shareProspectNotSalespersonTitle.
  ///
  /// In en, this message translates to:
  /// **'For Non-Sales Minded'**
  String get shareProspectNotSalespersonTitle;

  /// No description provided for @shareProspectNotSalespersonDescription.
  ///
  /// In en, this message translates to:
  /// **'Great for people who don\'t see themselves as \"salespeople\"'**
  String get shareProspectNotSalespersonDescription;

  /// No description provided for @shareProspectNotSalespersonSubject.
  ///
  /// In en, this message translates to:
  /// **'You Don\'t Have to Be a \"Salesperson\"'**
  String get shareProspectNotSalespersonSubject;

  /// No description provided for @shareProspectNotSalespersonMessage.
  ///
  /// In en, this message translates to:
  /// **'Not a \"natural salesperson\"? That\'s okay. You have an AI Coach.\n\nTeam Build Pro helps you pre-build your {business} team with AI that drafts your messages, schedules your follow-ups, and tracks everyone\'s interest.\n\nIt\'s like having a recruiting assistant who never sleeps. You focus on relationships. The AI handles the rest.\n\nStart building before you even join: {link}\n\nYou don\'t need a \"sales personality.\" You need smart tools. Now you have them.'**
  String shareProspectNotSalespersonMessage(Object business, Object link);

  /// No description provided for @shareProspectHopeAfterDisappointmentTitle.
  ///
  /// In en, this message translates to:
  /// **'Hope After Disappointment'**
  String get shareProspectHopeAfterDisappointmentTitle;

  /// No description provided for @shareProspectHopeAfterDisappointmentDescription.
  ///
  /// In en, this message translates to:
  /// **'Ideal for prospects burned by previous opportunities'**
  String get shareProspectHopeAfterDisappointmentDescription;

  /// No description provided for @shareProspectHopeAfterDisappointmentSubject.
  ///
  /// In en, this message translates to:
  /// **'A Smarter Way to Start This Time'**
  String get shareProspectHopeAfterDisappointmentSubject;

  /// No description provided for @shareProspectHopeAfterDisappointmentMessage.
  ///
  /// In en, this message translates to:
  /// **'Been burned before? Promised the world, then left starting from zero?\n\nThis time is different. Team Build Pro\'s AI Coach helps you pre-build your {business} team before you join.\n\nIt drafts your recruiting messages, times your follow-ups, tracks who\'s interested, and coaches you on next steps. You gain real momentum before Day 1.\n\nNo hype. No empty promises. Just AI-powered tools that work.\n\nSee how: {link}\n\nYou deserve a system that actually sets you up to win.'**
  String shareProspectHopeAfterDisappointmentMessage(
      Object business, Object link);

  /// No description provided for @shareProspectGeneralInvitationTitle.
  ///
  /// In en, this message translates to:
  /// **'General Invitation'**
  String get shareProspectGeneralInvitationTitle;

  /// No description provided for @shareProspectGeneralInvitationDescription.
  ///
  /// In en, this message translates to:
  /// **'A versatile message for any prospect situation'**
  String get shareProspectGeneralInvitationDescription;

  /// No description provided for @shareProspectGeneralInvitationSubject.
  ///
  /// In en, this message translates to:
  /// **'Build Before You Join - Guided by AI'**
  String get shareProspectGeneralInvitationSubject;

  /// No description provided for @shareProspectGeneralInvitationMessage.
  ///
  /// In en, this message translates to:
  /// **'You\'re invited to try a smarter way to start.\n\nWith Team Build Pro, an AI Coach helps you pre-build your {business} team before you officially join.\n\nHere\'s how it helps:\n- Drafts personalized messages\n- Schedules follow-ups automatically\n- Tracks momentum and next steps\n\nSo Day 1 isn\'t a cold start - it\'s a running start.\n\nTake a look: {link}'**
  String shareProspectGeneralInvitationMessage(Object business, Object link);

  /// No description provided for @shareProspectSocialAnxietyTitle.
  ///
  /// In en, this message translates to:
  /// **'Avoiding Awkward Conversations'**
  String get shareProspectSocialAnxietyTitle;

  /// No description provided for @shareProspectSocialAnxietyDescription.
  ///
  /// In en, this message translates to:
  /// **'Perfect for introverts or those uncomfortable with face-to-face recruiting'**
  String get shareProspectSocialAnxietyDescription;

  /// No description provided for @shareProspectSocialAnxietySubject.
  ///
  /// In en, this message translates to:
  /// **'Build Your Team Without Awkward Conversations'**
  String get shareProspectSocialAnxietySubject;

  /// No description provided for @shareProspectSocialAnxietyMessage.
  ///
  /// In en, this message translates to:
  /// **'Uncomfortable approaching friends and family? You don\'t have to.\n\nTeam Build Pro lets you build your {business} network online first - where it feels comfortable.\n\nThe AI Coach drafts your messages, suggests who to contact, and tracks responses. You build relationships at your own pace, without pressure.\n\nNo cold calls. No awkward pitches. Just genuine connections guided by AI.\n\nStart building on your terms: {link}\n\nFinally, a way to grow your network that feels natural to you.'**
  String shareProspectSocialAnxietyMessage(Object business, Object link);

  /// No description provided for @shareProspectTimeConstrainedTitle.
  ///
  /// In en, this message translates to:
  /// **'For Busy Professionals'**
  String get shareProspectTimeConstrainedTitle;

  /// No description provided for @shareProspectTimeConstrainedDescription.
  ///
  /// In en, this message translates to:
  /// **'Ideal for prospects juggling job, family, and other commitments'**
  String get shareProspectTimeConstrainedDescription;

  /// No description provided for @shareProspectTimeConstrainedSubject.
  ///
  /// In en, this message translates to:
  /// **'Build Your Team in the Gaps'**
  String get shareProspectTimeConstrainedSubject;

  /// No description provided for @shareProspectTimeConstrainedMessage.
  ///
  /// In en, this message translates to:
  /// **'Can\'t dedicate full-time hours? You don\'t need to.\n\nTeam Build Pro works around your schedule. Build your {business} team during morning coffee, lunch breaks, or evening downtime.\n\nThe AI handles the heavy lifting:\n- Schedules your follow-ups automatically\n- Reminds you when it\'s time to reach out\n- Tracks everything so you never lose momentum\n\nWork 15 minutes here, 20 minutes there. The AI makes every minute count.\n\nSee how it fits your life: {link}\n\nBuild a real business without sacrificing everything else.'**
  String shareProspectTimeConstrainedMessage(Object business, Object link);

  /// No description provided for @shareProspectFinancialRiskAverseTitle.
  ///
  /// In en, this message translates to:
  /// **'Afraid of Losing Money'**
  String get shareProspectFinancialRiskAverseTitle;

  /// No description provided for @shareProspectFinancialRiskAverseDescription.
  ///
  /// In en, this message translates to:
  /// **'Great for prospects worried about financial risk'**
  String get shareProspectFinancialRiskAverseDescription;

  /// No description provided for @shareProspectFinancialRiskAverseSubject.
  ///
  /// In en, this message translates to:
  /// **'See Results Before Investing Heavily'**
  String get shareProspectFinancialRiskAverseSubject;

  /// No description provided for @shareProspectFinancialRiskAverseMessage.
  ///
  /// In en, this message translates to:
  /// **'Worried about losing money? Smart.\n\nWith Team Build Pro, you can pre-build your {business} team and see real results before investing heavily.\n\nStart for free. Test the system. Track your actual progress in real-time. Only \$4.99/month once you\'re ready to invite your first prospects.\n\nNo expensive lead funnels. No complex systems. Just AI-powered tools that help you build real relationships and real momentum.\n\nSee proof first: {link}\n\nYou deserve to see what\'s possible before risking anything.'**
  String shareProspectFinancialRiskAverseMessage(Object business, Object link);

  /// No description provided for @shareProspectSkepticalRealistTitle.
  ///
  /// In en, this message translates to:
  /// **'Show Me Proof'**
  String get shareProspectSkepticalRealistTitle;

  /// No description provided for @shareProspectSkepticalRealistDescription.
  ///
  /// In en, this message translates to:
  /// **'Perfect for prospects burned by false promises'**
  String get shareProspectSkepticalRealistDescription;

  /// No description provided for @shareProspectSkepticalRealistSubject.
  ///
  /// In en, this message translates to:
  /// **'No Hype. Just Track Your Real Progress'**
  String get shareProspectSkepticalRealistSubject;

  /// No description provided for @shareProspectSkepticalRealistMessage.
  ///
  /// In en, this message translates to:
  /// **'Tired of empty promises and hype?\n\nTeam Build Pro shows you real metrics. No fluff. No exaggeration.\n\nYour dashboard tracks:\n- How many people you\'ve contacted\n- Who\'s responded and who\'s interested\n- Your actual momentum toward qualification (4 direct + 20 total)\n- Next steps the AI recommends\n\nYou\'ll know exactly where you stand before joining {business}. No surprises. No false hope. Just data.\n\nSee the transparency: {link}\n\nFinally, a system that shows you the truth.'**
  String shareProspectSkepticalRealistMessage(Object business, Object link);

  /// No description provided for @sharePartnerWarmMarketExhaustedTitle.
  ///
  /// In en, this message translates to:
  /// **'Warm Market Exhausted'**
  String get sharePartnerWarmMarketExhaustedTitle;

  /// No description provided for @sharePartnerWarmMarketExhaustedDescription.
  ///
  /// In en, this message translates to:
  /// **'For partners who\'ve tapped out friends and family'**
  String get sharePartnerWarmMarketExhaustedDescription;

  /// No description provided for @sharePartnerWarmMarketExhaustedSubject.
  ///
  /// In en, this message translates to:
  /// **'Give Your Team an AI Recruiting Companion'**
  String get sharePartnerWarmMarketExhaustedSubject;

  /// No description provided for @sharePartnerWarmMarketExhaustedMessage.
  ///
  /// In en, this message translates to:
  /// **'Tapped out your warm market? Tired of leads that ghost you?\n\nGive your {business} team an AI recruiting companion instead.\n\nTeam Build Pro drafts your team\'s recruiting messages, times their follow-ups, tracks prospect interest, and coaches every conversation.\n\nYour prospects pre-build their teams before joining - so they launch with momentum, not from zero.\n\nBest part? Your entire team gets the same AI advantage. True duplication at scale.\n\nSee how: {link}\n\nStop chasing. Start coaching with AI.'**
  String sharePartnerWarmMarketExhaustedMessage(Object business, Object link);

  /// No description provided for @sharePartnerExpensiveSystemFatigueTitle.
  ///
  /// In en, this message translates to:
  /// **'System Fatigue & Expense'**
  String get sharePartnerExpensiveSystemFatigueTitle;

  /// No description provided for @sharePartnerExpensiveSystemFatigueDescription.
  ///
  /// In en, this message translates to:
  /// **'For partners burned out on expensive recruiting methods'**
  String get sharePartnerExpensiveSystemFatigueDescription;

  /// No description provided for @sharePartnerExpensiveSystemFatigueSubject.
  ///
  /// In en, this message translates to:
  /// **'The AI Recruiting System Inside Team Build Pro'**
  String get sharePartnerExpensiveSystemFatigueSubject;

  /// No description provided for @sharePartnerExpensiveSystemFatigueMessage.
  ///
  /// In en, this message translates to:
  /// **'Sick of paying for leads, funnels, and systems that don\'t duplicate?\n\nTeam Build Pro has AI recruiting built right in - no extra cost, no complex setup.\n\nIt drafts recruiting messages, schedules follow-ups, tracks engagement, and coaches your entire {business} team through every conversation.\n\nYour prospects pre-build their teams before joining. Your team duplicates the same AI tools. Everyone wins.\n\nOne simple system. Real results.\n\nCheck it out: {link}\n\nStop overpaying. Start using AI.'**
  String sharePartnerExpensiveSystemFatigueMessage(
      Object business, Object link);

  /// No description provided for @sharePartnerDuplicationStruggleTitle.
  ///
  /// In en, this message translates to:
  /// **'Duplication Challenges'**
  String get sharePartnerDuplicationStruggleTitle;

  /// No description provided for @sharePartnerDuplicationStruggleDescription.
  ///
  /// In en, this message translates to:
  /// **'For leaders struggling to get their team to duplicate'**
  String get sharePartnerDuplicationStruggleDescription;

  /// No description provided for @sharePartnerDuplicationStruggleSubject.
  ///
  /// In en, this message translates to:
  /// **'AI-Powered Duplication for Your Entire Team'**
  String get sharePartnerDuplicationStruggleSubject;

  /// No description provided for @sharePartnerDuplicationStruggleMessage.
  ///
  /// In en, this message translates to:
  /// **'Your team struggles to duplicate your recruiting success? Not anymore.\n\nTeam Build Pro gives every person on your {business} team the same AI recruiting coach.\n\nIt drafts their messages. Times their follow-ups. Tracks their prospects. Coaches their next steps.\n\nNew recruit or veteran leader - everyone gets the same AI advantage. True system duplication.\n\nYour prospects pre-build teams before joining. Your team grows faster using identical AI tools.\n\nSee it work: {link}\n\nFinally, a system your entire team can duplicate.'**
  String sharePartnerDuplicationStruggleMessage(Object business, Object link);

  /// No description provided for @sharePartnerGeneralTeamToolTitle.
  ///
  /// In en, this message translates to:
  /// **'General Team Tool'**
  String get sharePartnerGeneralTeamToolTitle;

  /// No description provided for @sharePartnerGeneralTeamToolDescription.
  ///
  /// In en, this message translates to:
  /// **'A versatile message for any partner situation'**
  String get sharePartnerGeneralTeamToolDescription;

  /// No description provided for @sharePartnerGeneralTeamToolSubject.
  ///
  /// In en, this message translates to:
  /// **'The AI Recruiting Advantage for Your Team'**
  String get sharePartnerGeneralTeamToolSubject;

  /// No description provided for @sharePartnerGeneralTeamToolMessage.
  ///
  /// In en, this message translates to:
  /// **'Want to give your {business} team a real competitive edge?\n\nTeam Build Pro has AI recruiting built in. It helps your entire team:\n\n- Draft personalized recruiting messages\n- Schedule follow-ups automatically\n- Track prospect engagement\n- Coach every conversation\n\nYour prospects pre-build their teams before joining. Your team duplicates the same AI tools. Everyone grows faster.\n\nCheck it out: {link}\n\nThis is the AI advantage your team needs.'**
  String sharePartnerGeneralTeamToolMessage(Object business, Object link);

  /// No description provided for @sharePartnerRetentionCrisisTitle.
  ///
  /// In en, this message translates to:
  /// **'Team Dropout Problem'**
  String get sharePartnerRetentionCrisisTitle;

  /// No description provided for @sharePartnerRetentionCrisisDescription.
  ///
  /// In en, this message translates to:
  /// **'For leaders frustrated by team members quitting early'**
  String get sharePartnerRetentionCrisisDescription;

  /// No description provided for @sharePartnerRetentionCrisisSubject.
  ///
  /// In en, this message translates to:
  /// **'Stop Losing Your Team in the First Year'**
  String get sharePartnerRetentionCrisisSubject;

  /// No description provided for @sharePartnerRetentionCrisisMessage.
  ///
  /// In en, this message translates to:
  /// **'Watching your {business} team quit before they succeed?\n\n75% drop out in their first year. Usually because they feel lost, unsupported, or overwhelmed.\n\nTeam Build Pro changes that. Every person on your team gets an AI Coach that:\n- Guides them through every recruiting conversation\n- Tracks their progress and celebrates wins\n- Reminds them what to do next\n- Keeps momentum going when motivation dips\n\nThey\'re never alone. They always know their next step. They stay engaged longer.\n\nGive your team the support they need: {link}\n\nStop watching them quit. Start watching them succeed.'**
  String sharePartnerRetentionCrisisMessage(Object business, Object link);

  /// No description provided for @sharePartnerSkillGapTeamTitle.
  ///
  /// In en, this message translates to:
  /// **'Non-Sales Team Members'**
  String get sharePartnerSkillGapTeamTitle;

  /// No description provided for @sharePartnerSkillGapTeamDescription.
  ///
  /// In en, this message translates to:
  /// **'Perfect for teams where most people lack sales experience'**
  String get sharePartnerSkillGapTeamDescription;

  /// No description provided for @sharePartnerSkillGapTeamSubject.
  ///
  /// In en, this message translates to:
  /// **'Your Non-Sales Team Can Win with AI'**
  String get sharePartnerSkillGapTeamSubject;

  /// No description provided for @sharePartnerSkillGapTeamMessage.
  ///
  /// In en, this message translates to:
  /// **'Most of your {business} team aren\'t natural salespeople. That\'s been the problem.\n\nTeam Build Pro solves it. The AI Coach turns non-sales people into confident recruiters by:\n- Drafting their recruiting messages for them\n- Suggesting exactly who to contact next\n- Coaching them through every conversation\n- Tracking progress so they see real momentum\n\nYour introverts, your part-timers, your \"I\'m not good at sales\" people - they all get the same AI advantage.\n\nFinally, everyone can duplicate your success.\n\nSee how: {link}\n\nYou don\'t need a team of salespeople. You need a team with AI.'**
  String sharePartnerSkillGapTeamMessage(Object business, Object link);

  /// No description provided for @sharePartnerRecruitmentFatigueTitle.
  ///
  /// In en, this message translates to:
  /// **'Tired of Constant Recruiting'**
  String get sharePartnerRecruitmentFatigueTitle;

  /// No description provided for @sharePartnerRecruitmentFatigueDescription.
  ///
  /// In en, this message translates to:
  /// **'For partners exhausted from the endless recruiting cycle'**
  String get sharePartnerRecruitmentFatigueDescription;

  /// No description provided for @sharePartnerRecruitmentFatigueSubject.
  ///
  /// In en, this message translates to:
  /// **'Automate the Grind. Keep the Growth.'**
  String get sharePartnerRecruitmentFatigueSubject;

  /// No description provided for @sharePartnerRecruitmentFatigueMessage.
  ///
  /// In en, this message translates to:
  /// **'Burned out from constant recruiting? The endless follow-ups? The manual tracking?\n\nTeam Build Pro\'s AI handles the grind so you don\'t have to.\n\nFor your entire {business} team, the AI:\n- Schedules follow-ups automatically\n- Tracks every prospect and their status\n- Reminds your team when to reach out\n- Coaches them on what to say next\n\nYou stay focused on high-value activities. Your team stays productive without burning out.\n\nThe AI never gets tired. Your momentum never stops.\n\nTry it: {link}\n\nSustainable growth without the burnout.'**
  String sharePartnerRecruitmentFatigueMessage(Object business, Object link);

  /// No description provided for @sharePartnerAvailabilityGapTitle.
  ///
  /// In en, this message translates to:
  /// **'Can\'t Be There 24/7'**
  String get sharePartnerAvailabilityGapTitle;

  /// No description provided for @sharePartnerAvailabilityGapDescription.
  ///
  /// In en, this message translates to:
  /// **'Ideal for leaders who can\'t be constantly available to their team'**
  String get sharePartnerAvailabilityGapDescription;

  /// No description provided for @sharePartnerAvailabilityGapSubject.
  ///
  /// In en, this message translates to:
  /// **'Your Team Grows Even When You\'re Not There'**
  String get sharePartnerAvailabilityGapSubject;

  /// No description provided for @sharePartnerAvailabilityGapMessage.
  ///
  /// In en, this message translates to:
  /// **'Your {business} team needs you. But you can\'t be available 24/7.\n\nTeam Build Pro gives your team an AI Coach that\'s always on. While you sleep, work your day job, or spend time with family, the AI:\n- Guides your team through recruiting conversations\n- Answers their \"what do I do next?\" questions\n- Tracks their progress and keeps them motivated\n- Ensures nothing falls through the cracks\n\nYour team grows even when you\'re offline. No bottlenecks. No delays.\n\nTry it: {link}\n\nBe everywhere without being everywhere.'**
  String sharePartnerAvailabilityGapMessage(Object business, Object link);

  /// No description provided for @homepageDemoCredentialsNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Demo credentials not available'**
  String get homepageDemoCredentialsNotAvailable;

  /// No description provided for @homepageDemoLoginFailed.
  ///
  /// In en, this message translates to:
  /// **'Demo login failed: {error}'**
  String homepageDemoLoginFailed(Object error);

  /// No description provided for @homepageDemoLoginFailedGeneric.
  ///
  /// In en, this message translates to:
  /// **'Demo login failed. Please try again.'**
  String get homepageDemoLoginFailedGeneric;

  /// No description provided for @homepageHeroJumpstart.
  ///
  /// In en, this message translates to:
  /// **'JUMPSTART YOUR SUCCESS'**
  String get homepageHeroJumpstart;

  /// No description provided for @homepageHeroGrow.
  ///
  /// In en, this message translates to:
  /// **'GROW AND MANAGE YOUR TEAM'**
  String get homepageHeroGrow;

  /// No description provided for @homepageHeroProven.
  ///
  /// In en, this message translates to:
  /// **'PROVEN TEAM BUILDING SYSTEM'**
  String get homepageHeroProven;

  /// No description provided for @homepageHeroBuildFoundation.
  ///
  /// In en, this message translates to:
  /// **'Build Your Foundation'**
  String get homepageHeroBuildFoundation;

  /// No description provided for @homepageHeroBeforeDayOne.
  ///
  /// In en, this message translates to:
  /// **'Before Day One'**
  String get homepageHeroBeforeDayOne;

  /// No description provided for @homepageHeroEmpowerTeam.
  ///
  /// In en, this message translates to:
  /// **'Empower Your Team'**
  String get homepageHeroEmpowerTeam;

  /// No description provided for @homepageHeroAccelerate.
  ///
  /// In en, this message translates to:
  /// **'Accelerate '**
  String get homepageHeroAccelerate;

  /// No description provided for @homepageHeroGrowth.
  ///
  /// In en, this message translates to:
  /// **'Growth'**
  String get homepageHeroGrowth;

  /// No description provided for @homepageLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get homepageLoading;

  /// No description provided for @homepageMessageTitlePersonal.
  ///
  /// In en, this message translates to:
  /// **'A Personal Message\nFrom {sponsorName}'**
  String homepageMessageTitlePersonal(Object sponsorName);

  /// No description provided for @homepageMessageTitleGeneric.
  ///
  /// In en, this message translates to:
  /// **'A Message From\nTeam Build Pro'**
  String get homepageMessageTitleGeneric;

  /// No description provided for @homepageMessageBodyNewProspect1.
  ///
  /// In en, this message translates to:
  /// **'I\'m so glad you\'re here to get a head start on building your '**
  String get homepageMessageBodyNewProspect1;

  /// No description provided for @homepageMessageBodyNewProspect2.
  ///
  /// In en, this message translates to:
  /// **' team. The next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'**
  String get homepageMessageBodyNewProspect2;

  /// No description provided for @homepageMessageBodyRefPartner1.
  ///
  /// In en, this message translates to:
  /// **'I\'m using the Team Build Pro app to accelerate the growth of my '**
  String get homepageMessageBodyRefPartner1;

  /// No description provided for @homepageMessageBodyRefPartner2.
  ///
  /// In en, this message translates to:
  /// **' team and income! I highly recommend it for you as well.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial! Once you\'re registered, I\'ll personally reach out inside the app to say hello and help you get started.\n\nLooking forward to connecting!'**
  String get homepageMessageBodyRefPartner2;

  /// No description provided for @homepageMessageBodyGeneric.
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is the ultimate app for direct sales professionals to manage and scale their existing teams with unstoppable momentum and exponential growth.\n\nThe next step is easy—just create your account below and begin enjoying your 30-day free trial!'**
  String get homepageMessageBodyGeneric;

  /// No description provided for @homepageButtonCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get homepageButtonCreateAccount;

  /// No description provided for @homepageButtonAlreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'I Already Have an Account'**
  String get homepageButtonAlreadyHaveAccount;

  /// No description provided for @homepageDemoModeActive.
  ///
  /// In en, this message translates to:
  /// **'Demo Mode Active'**
  String get homepageDemoModeActive;

  /// No description provided for @homepageDemoPreLoaded.
  ///
  /// In en, this message translates to:
  /// **'Pre-Loaded Demo Account'**
  String get homepageDemoPreLoaded;

  /// No description provided for @homepageDemoWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome to Team Build Pro Demo'**
  String get homepageDemoWelcome;

  /// No description provided for @homepageDemoDescription.
  ///
  /// In en, this message translates to:
  /// **'This is a fully functional demo account pre-loaded with realistic team data. Explore all features and see how Team Build Pro can transform your direct sales business!'**
  String get homepageDemoDescription;

  /// No description provided for @homepageDemoCredentialsLabel.
  ///
  /// In en, this message translates to:
  /// **'Access Credentials:'**
  String get homepageDemoCredentialsLabel;

  /// No description provided for @homepageDemoEmail.
  ///
  /// In en, this message translates to:
  /// **'Email: {email}'**
  String homepageDemoEmail(Object email);

  /// No description provided for @homepageDemoPassword.
  ///
  /// In en, this message translates to:
  /// **'Password: {password}'**
  String homepageDemoPassword(Object password);

  /// No description provided for @homepageDemoLoggingIn.
  ///
  /// In en, this message translates to:
  /// **'Logging In...'**
  String get homepageDemoLoggingIn;

  /// No description provided for @homepageDemoStartDemo.
  ///
  /// In en, this message translates to:
  /// **'Start Demo!'**
  String get homepageDemoStartDemo;

  /// No description provided for @homepageTrust100Secure.
  ///
  /// In en, this message translates to:
  /// **'100% Secure'**
  String get homepageTrust100Secure;

  /// No description provided for @homepageTrust30DayFree.
  ///
  /// In en, this message translates to:
  /// **'30-Day Free'**
  String get homepageTrust30DayFree;

  /// No description provided for @homepageTrust24Support.
  ///
  /// In en, this message translates to:
  /// **'24/7 Support'**
  String get homepageTrust24Support;

  /// No description provided for @homepageFooterTerms.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get homepageFooterTerms;

  /// No description provided for @homepageFooterPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get homepageFooterPrivacy;

  /// No description provided for @authLoginAccountRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Account Required'**
  String get authLoginAccountRequiredTitle;

  /// No description provided for @authLoginAccountRequiredMessage.
  ///
  /// In en, this message translates to:
  /// **'It looks like you need to create an account first. Would you like to register now?'**
  String get authLoginAccountRequiredMessage;

  /// No description provided for @authLoginCancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get authLoginCancelButton;

  /// No description provided for @authLoginRegisterButton.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get authLoginRegisterButton;

  /// No description provided for @authLoginAppBarTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get authLoginAppBarTitle;

  /// No description provided for @authLoginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to continue building your team'**
  String get authLoginSubtitle;

  /// No description provided for @authLoginOrContinueWith.
  ///
  /// In en, this message translates to:
  /// **'or continue with'**
  String get authLoginOrContinueWith;

  /// No description provided for @authLoginForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get authLoginForgotPassword;

  /// No description provided for @authLoginContinueWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get authLoginContinueWithGoogle;

  /// No description provided for @authLoginContinueWithApple.
  ///
  /// In en, this message translates to:
  /// **'Continue with Apple'**
  String get authLoginContinueWithApple;

  /// No description provided for @authLoginBiometricButton.
  ///
  /// In en, this message translates to:
  /// **'Sign in with biometric'**
  String get authLoginBiometricButton;

  /// No description provided for @authLoginResetPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get authLoginResetPasswordTitle;

  /// No description provided for @authLoginCheckEmailTitle.
  ///
  /// In en, this message translates to:
  /// **'Check Your Email'**
  String get authLoginCheckEmailTitle;

  /// No description provided for @authLoginResetEmailSent.
  ///
  /// In en, this message translates to:
  /// **'We\'ve sent a password reset link to:'**
  String get authLoginResetEmailSent;

  /// No description provided for @authLoginResetInstructions.
  ///
  /// In en, this message translates to:
  /// **'Please check your inbox and follow the instructions to reset your password.'**
  String get authLoginResetInstructions;

  /// No description provided for @authLoginResetPrompt.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address and we\'ll send you a link to reset your password.'**
  String get authLoginResetPrompt;

  /// No description provided for @authLoginResetEmailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authLoginResetEmailLabel;

  /// No description provided for @authLoginResetEmailHint.
  ///
  /// In en, this message translates to:
  /// **'Enter your email address'**
  String get authLoginResetEmailHint;

  /// No description provided for @authLoginResetEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email'**
  String get authLoginResetEmailRequired;

  /// No description provided for @authLoginResetEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid email'**
  String get authLoginResetEmailInvalid;

  /// No description provided for @authLoginDoneButton.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get authLoginDoneButton;

  /// No description provided for @authLoginSendResetLink.
  ///
  /// In en, this message translates to:
  /// **'Send Reset Link'**
  String get authLoginSendResetLink;

  /// No description provided for @authSignupInvalidInviteLinkMessage.
  ///
  /// In en, this message translates to:
  /// **'That doesn\'t look like an invite link. Please paste the full link you received.'**
  String get authSignupInvalidInviteLinkMessage;

  /// No description provided for @authSignupNewReferralDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'New Referral Code Detected'**
  String get authSignupNewReferralDialogTitle;

  /// No description provided for @authSignupNewReferralDialogMessage.
  ///
  /// In en, this message translates to:
  /// **'A new referral code has been detected:'**
  String get authSignupNewReferralDialogMessage;

  /// No description provided for @authSignupNewReferralNewCode.
  ///
  /// In en, this message translates to:
  /// **'New code: {code}'**
  String authSignupNewReferralNewCode(Object code);

  /// No description provided for @authSignupNewReferralNewSource.
  ///
  /// In en, this message translates to:
  /// **'Source: {source}'**
  String authSignupNewReferralNewSource(Object source);

  /// No description provided for @authSignupNewReferralCurrentCode.
  ///
  /// In en, this message translates to:
  /// **'Current code: {code}'**
  String authSignupNewReferralCurrentCode(Object code);

  /// No description provided for @authSignupNewReferralCurrentSource.
  ///
  /// In en, this message translates to:
  /// **'Current source: {source}'**
  String authSignupNewReferralCurrentSource(Object source);

  /// No description provided for @authSignupNewReferralPrompt.
  ///
  /// In en, this message translates to:
  /// **'Would you like to update your referral code?'**
  String get authSignupNewReferralPrompt;

  /// No description provided for @authSignupKeepCurrentButton.
  ///
  /// In en, this message translates to:
  /// **'Keep Current'**
  String get authSignupKeepCurrentButton;

  /// No description provided for @authSignupUseNewCodeButton.
  ///
  /// In en, this message translates to:
  /// **'Use New Code'**
  String get authSignupUseNewCodeButton;

  /// No description provided for @authSignupAppBarTitle.
  ///
  /// In en, this message translates to:
  /// **'TEAM BUILD PRO'**
  String get authSignupAppBarTitle;

  /// No description provided for @authSignupLoginButton.
  ///
  /// In en, this message translates to:
  /// **'Log In'**
  String get authSignupLoginButton;

  /// No description provided for @authSignupConfirmSponsorButton.
  ///
  /// In en, this message translates to:
  /// **'Tap to confirm your sponsor'**
  String get authSignupConfirmSponsorButton;

  /// No description provided for @authSignupNoSponsorFound.
  ///
  /// In en, this message translates to:
  /// **'Sorry, no sponsor found'**
  String get authSignupNoSponsorFound;

  /// No description provided for @authSignupPageTitle.
  ///
  /// In en, this message translates to:
  /// **'Account Registration'**
  String get authSignupPageTitle;

  /// No description provided for @authSignupInviteLinkButton.
  ///
  /// In en, this message translates to:
  /// **'I have an invite link'**
  String get authSignupInviteLinkButton;

  /// No description provided for @authSignupInviteLinkInstructions.
  ///
  /// In en, this message translates to:
  /// **'If someone sent you an invite link, you can paste it here.'**
  String get authSignupInviteLinkInstructions;

  /// No description provided for @authSignupPasteInviteLinkButton.
  ///
  /// In en, this message translates to:
  /// **'Paste invite link'**
  String get authSignupPasteInviteLinkButton;

  /// No description provided for @authSignupInvitedBy.
  ///
  /// In en, this message translates to:
  /// **'Invited by: {sponsorName}'**
  String authSignupInvitedBy(Object sponsorName);

  /// No description provided for @authSignupReferralCodeDebug.
  ///
  /// In en, this message translates to:
  /// **'Code: {code} (source: {source})'**
  String authSignupReferralCodeDebug(Object code, Object source);

  /// No description provided for @authSignupAppleButton.
  ///
  /// In en, this message translates to:
  /// **'Sign up with Apple'**
  String get authSignupAppleButton;

  /// No description provided for @authSignupGoogleButton.
  ///
  /// In en, this message translates to:
  /// **'Sign up with Google'**
  String get authSignupGoogleButton;

  /// No description provided for @authSignupOrEmailDivider.
  ///
  /// In en, this message translates to:
  /// **'or sign up with email'**
  String get authSignupOrEmailDivider;

  /// No description provided for @authSignupLoginSectionTitle.
  ///
  /// In en, this message translates to:
  /// **'Create Your Login'**
  String get authSignupLoginSectionTitle;

  /// No description provided for @authSignupPrivacyAssurance.
  ///
  /// In en, this message translates to:
  /// **'🔒 Your email will never be shared with anyone'**
  String get authSignupPrivacyAssurance;

  /// No description provided for @authSignupRequiredForAccount.
  ///
  /// In en, this message translates to:
  /// **'🔒 Required for account creation'**
  String get authSignupRequiredForAccount;

  /// No description provided for @settingsAuthRequired.
  ///
  /// In en, this message translates to:
  /// **'Authentication required.'**
  String get settingsAuthRequired;

  /// No description provided for @settingsUserNotFound.
  ///
  /// In en, this message translates to:
  /// **'User profile not found.'**
  String get settingsUserNotFound;

  /// No description provided for @settingsAccessDenied.
  ///
  /// In en, this message translates to:
  /// **'Access Denied: Admin role required.'**
  String get settingsAccessDenied;

  /// No description provided for @settingsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load settings: {error}'**
  String settingsLoadFailed(Object error);

  /// No description provided for @settingsBusinessNameInvalid.
  ///
  /// In en, this message translates to:
  /// **'Business name can only contain letters, numbers, and common punctuation.'**
  String get settingsBusinessNameInvalid;

  /// No description provided for @settingsReferralLinkInvalid.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid referral link (e.g., https://example.com).'**
  String get settingsReferralLinkInvalid;

  /// No description provided for @settingsOrgNameMismatch.
  ///
  /// In en, this message translates to:
  /// **'Organization Name fields must match for confirmation.'**
  String get settingsOrgNameMismatch;

  /// No description provided for @settingsReferralLinkMismatch.
  ///
  /// In en, this message translates to:
  /// **'Referral Link fields must match for confirmation.'**
  String get settingsReferralLinkMismatch;

  /// No description provided for @settingsUserNotAuthenticated.
  ///
  /// In en, this message translates to:
  /// **'User not authenticated.'**
  String get settingsUserNotAuthenticated;

  /// No description provided for @settingsUpgradeRequiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Upgrade Required'**
  String get settingsUpgradeRequiredTitle;

  /// No description provided for @settingsUpgradeRequiredMessage.
  ///
  /// In en, this message translates to:
  /// **'Upgrade your Admin subscription to save these changes.'**
  String get settingsUpgradeRequiredMessage;

  /// No description provided for @settingsCancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get settingsCancelButton;

  /// No description provided for @settingsUpgradeButton.
  ///
  /// In en, this message translates to:
  /// **'Upgrade Now'**
  String get settingsUpgradeButton;

  /// No description provided for @settingsSavedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Settings saved successfully.'**
  String get settingsSavedSuccess;

  /// No description provided for @settingsSaveFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to save settings: {error}'**
  String settingsSaveFailed(Object error);

  /// No description provided for @settingsRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get settingsRequired;

  /// No description provided for @settingsNotSet.
  ///
  /// In en, this message translates to:
  /// **'Not Set'**
  String get settingsNotSet;

  /// No description provided for @profileUpdateBiometricFailed.
  ///
  /// In en, this message translates to:
  /// **'Biometric authentication failed. Please try again.'**
  String get profileUpdateBiometricFailed;

  /// No description provided for @profileUpdatePasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Password required to enable biometric login'**
  String get profileUpdatePasswordRequired;

  /// No description provided for @profileUpdateEmailNotFound.
  ///
  /// In en, this message translates to:
  /// **'User email not found'**
  String get profileUpdateEmailNotFound;

  /// No description provided for @profileUpdateBiometricEnabled.
  ///
  /// In en, this message translates to:
  /// **'✅ Biometric login enabled successfully'**
  String get profileUpdateBiometricEnabled;

  /// No description provided for @profileUpdatePasswordIncorrect.
  ///
  /// In en, this message translates to:
  /// **'Incorrect password. Please try again.'**
  String get profileUpdatePasswordIncorrect;

  /// No description provided for @profileUpdateBiometricError.
  ///
  /// In en, this message translates to:
  /// **'Error enabling biometric: {error}'**
  String profileUpdateBiometricError(Object error);

  /// No description provided for @profileUpdateBiometricDisabled.
  ///
  /// In en, this message translates to:
  /// **'Biometric login disabled'**
  String get profileUpdateBiometricDisabled;

  /// No description provided for @profileUpdateConfirmPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get profileUpdateConfirmPasswordTitle;

  /// No description provided for @profileUpdateConfirmPasswordMessage.
  ///
  /// In en, this message translates to:
  /// **'To securely store your credentials for biometric login, please enter your password.'**
  String get profileUpdateConfirmPasswordMessage;

  /// No description provided for @profileUpdatePasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get profileUpdatePasswordLabel;

  /// No description provided for @profileUpdateCancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get profileUpdateCancelButton;

  /// No description provided for @profileUpdateConfirmButton.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get profileUpdateConfirmButton;

  /// No description provided for @profileUpdateDisableBiometricTitle.
  ///
  /// In en, this message translates to:
  /// **'Disable Biometric Login'**
  String get profileUpdateDisableBiometricTitle;

  /// No description provided for @profileUpdateDisableBiometricMessage.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to disable biometric login? You will need to use your email and password to sign in.'**
  String get profileUpdateDisableBiometricMessage;

  /// No description provided for @profileUpdateDisableButton.
  ///
  /// In en, this message translates to:
  /// **'Disable'**
  String get profileUpdateDisableButton;

  /// No description provided for @profileUpdatePictureRequired.
  ///
  /// In en, this message translates to:
  /// **'Please upload your profile pic.'**
  String get profileUpdatePictureRequired;

  /// No description provided for @profileUpdateImageNotProvided.
  ///
  /// In en, this message translates to:
  /// **'Image was not provided.'**
  String get profileUpdateImageNotProvided;

  /// No description provided for @profileUpdateSuccess.
  ///
  /// In en, this message translates to:
  /// **'Profile updated successfully!'**
  String get profileUpdateSuccess;

  /// No description provided for @profileUpdateError.
  ///
  /// In en, this message translates to:
  /// **'Error updating profile: {error}'**
  String profileUpdateError(Object error);

  /// No description provided for @profileUpdateDemoModeTitle.
  ///
  /// In en, this message translates to:
  /// **'Demo Mode'**
  String get profileUpdateDemoModeTitle;

  /// No description provided for @profileUpdateDemoModeMessage.
  ///
  /// In en, this message translates to:
  /// **'Profile editing disabled in demo mode.'**
  String get profileUpdateDemoModeMessage;

  /// No description provided for @profileUpdateDemoUnderstandButton.
  ///
  /// In en, this message translates to:
  /// **'I Understand'**
  String get profileUpdateDemoUnderstandButton;

  /// No description provided for @profileUpdateScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'Update Profile'**
  String get profileUpdateScreenTitle;

  /// No description provided for @profileUpdateNoEmail.
  ///
  /// In en, this message translates to:
  /// **'No email'**
  String get profileUpdateNoEmail;

  /// No description provided for @profileUpdateSelectCountry.
  ///
  /// In en, this message translates to:
  /// **'Select Country'**
  String get profileUpdateSelectCountry;

  /// No description provided for @profileUpdateCountryLabel.
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get profileUpdateCountryLabel;

  /// No description provided for @profileUpdateCountryRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a country'**
  String get profileUpdateCountryRequired;

  /// No description provided for @profileUpdateSelectState.
  ///
  /// In en, this message translates to:
  /// **'Select State/Province'**
  String get profileUpdateSelectState;

  /// No description provided for @profileUpdateSelectCountryFirst.
  ///
  /// In en, this message translates to:
  /// **'Select a country first'**
  String get profileUpdateSelectCountryFirst;

  /// No description provided for @profileUpdateStateLabel.
  ///
  /// In en, this message translates to:
  /// **'State/Province'**
  String get profileUpdateStateLabel;

  /// No description provided for @profileUpdateStateRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a state/province'**
  String get profileUpdateStateRequired;

  /// No description provided for @profileUpdateCityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get profileUpdateCityLabel;

  /// No description provided for @profileUpdateCityRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a city'**
  String get profileUpdateCityRequired;

  /// No description provided for @profileUpdateSecurityHeader.
  ///
  /// In en, this message translates to:
  /// **'Security Settings'**
  String get profileUpdateSecurityHeader;

  /// No description provided for @profileUpdateBiometricToggle.
  ///
  /// In en, this message translates to:
  /// **'Enable Biometric Login'**
  String get profileUpdateBiometricToggle;

  /// No description provided for @profileUpdateBiometricChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking device compatibility...'**
  String get profileUpdateBiometricChecking;

  /// No description provided for @profileUpdateBiometricDescription.
  ///
  /// In en, this message translates to:
  /// **'Use fingerprint or face recognition to login'**
  String get profileUpdateBiometricDescription;

  /// No description provided for @profileUpdateBiometricNotAvailable.
  ///
  /// In en, this message translates to:
  /// **'Not available on this device'**
  String get profileUpdateBiometricNotAvailable;

  /// No description provided for @profileUpdateSaveButton.
  ///
  /// In en, this message translates to:
  /// **'Save Changes'**
  String get profileUpdateSaveButton;

  /// No description provided for @profileEditDeletionSuccess.
  ///
  /// In en, this message translates to:
  /// **'Account deletion completed. Thank you for using Team Build Pro.'**
  String get profileEditDeletionSuccess;

  /// No description provided for @profileEditDeletionError.
  ///
  /// In en, this message translates to:
  /// **'Error completing account deletion: {error}'**
  String profileEditDeletionError(Object error);

  /// No description provided for @profileEditUrlInvalid.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid URL (e.g., https://example.com)'**
  String get profileEditUrlInvalid;

  /// No description provided for @profileEditHttpsRequired.
  ///
  /// In en, this message translates to:
  /// **'Referral link must use HTTPS (not HTTP) for security'**
  String get profileEditHttpsRequired;

  /// No description provided for @profileEditUrlFormatInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid URL format. Please check your referral link.'**
  String get profileEditUrlFormatInvalid;

  /// No description provided for @profileEditUnableToVerify.
  ///
  /// In en, this message translates to:
  /// **'Unable to verify referral link'**
  String get profileEditUnableToVerify;

  /// No description provided for @profileEditDomainRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid link with a proper domain'**
  String get profileEditDomainRequired;

  /// No description provided for @profileEditNoLocalhost.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid business referral link\n(not localhost or IP address)'**
  String get profileEditNoLocalhost;

  /// No description provided for @profileEditDomainWithTld.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid link with a proper domain\n(e.g., company.com)'**
  String get profileEditDomainWithTld;

  /// No description provided for @profileEditBaseUrlRequired.
  ///
  /// In en, this message translates to:
  /// **'Referral link must begin with:\n{baseUrl}'**
  String profileEditBaseUrlRequired(Object baseUrl);

  /// No description provided for @profileEditNotHomepage.
  ///
  /// In en, this message translates to:
  /// **'Please enter your unique referral link,\nnot just the homepage'**
  String get profileEditNotHomepage;

  /// No description provided for @profileEditInvalidFormat.
  ///
  /// In en, this message translates to:
  /// **'Invalid link format'**
  String get profileEditInvalidFormat;

  /// No description provided for @profileEditReferralRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your referral link'**
  String get profileEditReferralRequired;

  /// No description provided for @profileEditConfirmReferral.
  ///
  /// In en, this message translates to:
  /// **'Please confirm your referral link'**
  String get profileEditConfirmReferral;

  /// No description provided for @profileEditCompleteLink.
  ///
  /// In en, this message translates to:
  /// **'Please enter a complete link starting with\nhttp:// or https://'**
  String get profileEditCompleteLink;

  /// No description provided for @profileEditValidReferralRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid referral link (e.g., https://example.com).'**
  String get profileEditValidReferralRequired;

  /// No description provided for @profileEditReferralMismatch.
  ///
  /// In en, this message translates to:
  /// **'Referral Link fields must match for confirmation.'**
  String get profileEditReferralMismatch;

  /// No description provided for @profileEditInvalidLinkTitle.
  ///
  /// In en, this message translates to:
  /// **'Invalid Referral Link'**
  String get profileEditInvalidLinkTitle;

  /// No description provided for @profileEditInvalidLinkMessage.
  ///
  /// In en, this message translates to:
  /// **'The {businessName} referral link could not be verified. The link may be incorrect, inactive, or temporarily unavailable.'**
  String profileEditInvalidLinkMessage(Object businessName);

  /// No description provided for @profileEditContactSponsor.
  ///
  /// In en, this message translates to:
  /// **'Please check the link and try again, or contact your sponsor for the correct referral link.'**
  String get profileEditContactSponsor;

  /// No description provided for @profileEditTryAgainButton.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get profileEditTryAgainButton;

  /// No description provided for @profileEditReferralHint.
  ///
  /// In en, this message translates to:
  /// **'e.g., {baseUrl}your_username_here'**
  String profileEditReferralHint(Object baseUrl);

  /// No description provided for @profileEditRequiredForRep.
  ///
  /// In en, this message translates to:
  /// **'Required when you are a representative'**
  String get profileEditRequiredForRep;

  /// No description provided for @adminProfilePictureRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a profile picture'**
  String get adminProfilePictureRequired;

  /// No description provided for @adminProfileCountryRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a country'**
  String get adminProfileCountryRequired;

  /// No description provided for @adminProfileStateRequired.
  ///
  /// In en, this message translates to:
  /// **'Please select a state/province'**
  String get adminProfileStateRequired;

  /// No description provided for @adminProfileCityRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your city'**
  String get adminProfileCityRequired;

  /// No description provided for @adminProfileSetupTitle.
  ///
  /// In en, this message translates to:
  /// **'🛠️ Setting up your business profile...'**
  String get adminProfileSetupTitle;

  /// No description provided for @adminProfileSetupDescription.
  ///
  /// In en, this message translates to:
  /// **'Getting your business information ready'**
  String get adminProfileSetupDescription;

  /// No description provided for @adminProfileUserNotAuthenticated.
  ///
  /// In en, this message translates to:
  /// **'User not authenticated'**
  String get adminProfileUserNotAuthenticated;

  /// No description provided for @adminProfileUploadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to upload image'**
  String get adminProfileUploadFailed;

  /// No description provided for @adminProfileSaveSuccess.
  ///
  /// In en, this message translates to:
  /// **'Profile information saved successfully!'**
  String get adminProfileSaveSuccess;

  /// No description provided for @adminProfileSaveError.
  ///
  /// In en, this message translates to:
  /// **'Error: {error}'**
  String adminProfileSaveError(Object error);

  /// No description provided for @adminProfileScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'Admin Profile'**
  String get adminProfileScreenTitle;

  /// No description provided for @adminProfileSetupHeader.
  ///
  /// In en, this message translates to:
  /// **'Profile Setup'**
  String get adminProfileSetupHeader;

  /// No description provided for @adminProfileNoEmail.
  ///
  /// In en, this message translates to:
  /// **'No email'**
  String get adminProfileNoEmail;

  /// No description provided for @adminProfileCountryLabel.
  ///
  /// In en, this message translates to:
  /// **'Country'**
  String get adminProfileCountryLabel;

  /// No description provided for @adminProfileStateLabel.
  ///
  /// In en, this message translates to:
  /// **'State/Province'**
  String get adminProfileStateLabel;

  /// No description provided for @adminProfileCityLabel.
  ///
  /// In en, this message translates to:
  /// **'City'**
  String get adminProfileCityLabel;

  /// No description provided for @adminProfileNextButton.
  ///
  /// In en, this message translates to:
  /// **'Next - Business Information'**
  String get adminProfileNextButton;

  /// No description provided for @subscriptionAppBarTitle.
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro'**
  String get subscriptionAppBarTitle;

  /// No description provided for @subscriptionPremiumHeader.
  ///
  /// In en, this message translates to:
  /// **'Premium Features:'**
  String get subscriptionPremiumHeader;

  /// Status card title for active subscription
  ///
  /// In en, this message translates to:
  /// **'Active Subscription'**
  String get subscriptionStatusActive;

  /// Status card subtitle for active subscription
  ///
  /// In en, this message translates to:
  /// **'You have full access to all premium features'**
  String get subscriptionStatusActiveSubtitle;

  /// Status card title for paused subscription
  ///
  /// In en, this message translates to:
  /// **'Subscription Paused'**
  String get subscriptionStatusPaused;

  /// Status card subtitle for paused subscription
  ///
  /// In en, this message translates to:
  /// **'Your subscription is paused. Resume to restore access.'**
  String get subscriptionStatusPausedSubtitle;

  /// Status card title for payment issue
  ///
  /// In en, this message translates to:
  /// **'Payment Issue'**
  String get subscriptionStatusPaymentIssue;

  /// Status card subtitle for payment issue
  ///
  /// In en, this message translates to:
  /// **'Update payment method to restore access'**
  String get subscriptionStatusPaymentIssueSubtitle;

  /// No description provided for @subscriptionStatusTrialActive.
  ///
  /// In en, this message translates to:
  /// **'Free Trial Active'**
  String get subscriptionStatusTrialActive;

  /// No description provided for @subscriptionStatusTrialDaysRemaining.
  ///
  /// In en, this message translates to:
  /// **'{days} days remaining in your trial'**
  String subscriptionStatusTrialDaysRemaining(Object days);

  /// Status card title for cancelled subscription
  ///
  /// In en, this message translates to:
  /// **'Subscription Cancelled'**
  String get subscriptionStatusCancelled;

  /// Status card subtitle for cancelled subscription
  ///
  /// In en, this message translates to:
  /// **'Access continues until expiry date'**
  String get subscriptionStatusCancelledSubtitle;

  /// Status card title for expired subscription
  ///
  /// In en, this message translates to:
  /// **'Subscription Expired'**
  String get subscriptionStatusExpired;

  /// Status card subtitle for expired subscription
  ///
  /// In en, this message translates to:
  /// **'Upgrade to restore premium features'**
  String get subscriptionStatusExpiredSubtitle;

  /// No description provided for @subscriptionFeature1.
  ///
  /// In en, this message translates to:
  /// **'Submit your unique {businessName} referral link'**
  String subscriptionFeature1(Object businessName);

  /// No description provided for @subscriptionFeature2.
  ///
  /// In en, this message translates to:
  /// **'Custom AI Coaching for recruiting and team building'**
  String get subscriptionFeature2;

  /// No description provided for @subscriptionFeature3.
  ///
  /// In en, this message translates to:
  /// **'Unlock messaging to users on your team'**
  String get subscriptionFeature3;

  /// No description provided for @subscriptionFeature4.
  ///
  /// In en, this message translates to:
  /// **'Ensure team members join under YOU in {businessName}'**
  String subscriptionFeature4(Object businessName);

  /// No description provided for @subscriptionFeature5.
  ///
  /// In en, this message translates to:
  /// **'Advanced analytics and insights'**
  String get subscriptionFeature5;

  /// No description provided for @subscriptionActivatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'✅ Subscription activated successfully!'**
  String get subscriptionActivatedSuccess;

  /// Dialog title when subscription purchase is not yet active
  ///
  /// In en, this message translates to:
  /// **'Subscription Not Active'**
  String get subscriptionNotActiveTitle;

  /// Dialog message when subscription purchase is not yet active
  ///
  /// In en, this message translates to:
  /// **'Purchase started but not active yet. Try again.'**
  String get subscriptionNotActiveMessage;

  /// Dialog title when in-app purchase is not available
  ///
  /// In en, this message translates to:
  /// **'Subscription Not Available'**
  String get subscriptionNotAvailableTitle;

  /// No description provided for @subscriptionNotAvailableMessageIOS.
  ///
  /// In en, this message translates to:
  /// **'In-app purchases are currently unavailable on your device. This may be due to restrictions set by your organization or device administrator.\n\nPlease check your Screen Time settings or contact your IT department if you\'re using a managed device.\n\nAlternatively, you can subscribe through our website.'**
  String get subscriptionNotAvailableMessageIOS;

  /// No description provided for @subscriptionNotAvailableMessageAndroid.
  ///
  /// In en, this message translates to:
  /// **'In-app purchases are currently unavailable on your device. This may be due to restrictions or network issues.\n\nPlease try again later or contact support if the problem persists.'**
  String get subscriptionNotAvailableMessageAndroid;

  /// No description provided for @subscriptionNotAvailableMessageDefault.
  ///
  /// In en, this message translates to:
  /// **'In-app purchases are currently unavailable. Please try again later.'**
  String get subscriptionNotAvailableMessageDefault;

  /// No description provided for @subscriptionOkButton.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get subscriptionOkButton;

  /// No description provided for @subscriptionRestoredSuccess.
  ///
  /// In en, this message translates to:
  /// **'✅ Subscription restored successfully!'**
  String get subscriptionRestoredSuccess;

  /// No description provided for @subscriptionNoPreviousFound.
  ///
  /// In en, this message translates to:
  /// **'No previous subscription found to restore.'**
  String get subscriptionNoPreviousFound;

  /// Subscribe button text
  ///
  /// In en, this message translates to:
  /// **'Subscribe Now - \$4.99/month'**
  String get subscriptionSubscribeButton;

  /// Restore subscription button text
  ///
  /// In en, this message translates to:
  /// **'Restore Previous Subscription'**
  String get subscriptionRestoreButton;

  /// Legal notice about terms and privacy
  ///
  /// In en, this message translates to:
  /// **'By subscribing, you agree to our Terms of Service and Privacy Policy.'**
  String get subscriptionLegalNotice;

  /// Link text for Terms of Service
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get subscriptionTermsLink;

  /// No description provided for @subscriptionSeparator.
  ///
  /// In en, this message translates to:
  /// **' | '**
  String get subscriptionSeparator;

  /// Link text for Privacy Policy
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get subscriptionPrivacyLink;

  /// Auto-renewal notice with platform-specific management text
  ///
  /// In en, this message translates to:
  /// **'Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. {managementText}'**
  String subscriptionAutoRenewNotice(String managementText);

  /// No description provided for @subscriptionManageIOS.
  ///
  /// In en, this message translates to:
  /// **'You can manage your subscription in your Apple ID account settings.'**
  String get subscriptionManageIOS;

  /// No description provided for @subscriptionManageAndroid.
  ///
  /// In en, this message translates to:
  /// **'You can manage your subscription in the Google Play Store.'**
  String get subscriptionManageAndroid;

  /// No description provided for @subscriptionManageDefault.
  ///
  /// In en, this message translates to:
  /// **'You can manage your subscription in your device\'s app store.'**
  String get subscriptionManageDefault;

  /// No description provided for @subscriptionPlatformAppStore.
  ///
  /// In en, this message translates to:
  /// **'App Store'**
  String get subscriptionPlatformAppStore;

  /// No description provided for @subscriptionPlatformPlayStore.
  ///
  /// In en, this message translates to:
  /// **'Google Play Store'**
  String get subscriptionPlatformPlayStore;

  /// No description provided for @subscriptionPlatformGeneric.
  ///
  /// In en, this message translates to:
  /// **'app store'**
  String get subscriptionPlatformGeneric;

  /// No description provided for @subscriptionDefaultBizOpp.
  ///
  /// In en, this message translates to:
  /// **'your opportunity'**
  String get subscriptionDefaultBizOpp;

  /// No description provided for @termsScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get termsScreenTitle;

  /// No description provided for @termsHeaderTitle.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get termsHeaderTitle;

  /// No description provided for @termsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Professional Networking Platform Agreement'**
  String get termsSubtitle;

  /// No description provided for @termsLastUpdated.
  ///
  /// In en, this message translates to:
  /// **'Last Updated: {date}'**
  String termsLastUpdated(Object date);

  /// No description provided for @termsFooterBadgeTitle.
  ///
  /// In en, this message translates to:
  /// **'Apple Store Compliant'**
  String get termsFooterBadgeTitle;

  /// No description provided for @termsFooterBadgeDescription.
  ///
  /// In en, this message translates to:
  /// **'These Terms of Service meet all Apple App Store guidelines and requirements for platform applications.'**
  String get termsFooterBadgeDescription;

  /// No description provided for @termsDisclaimerTitle.
  ///
  /// In en, this message translates to:
  /// **'PROFESSIONAL NETWORKING PLATFORM'**
  String get termsDisclaimerTitle;

  /// No description provided for @termsDisclaimerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Service Overview'**
  String get termsDisclaimerSubtitle;

  /// No description provided for @privacyScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyScreenTitle;

  /// No description provided for @privacyHeaderTitle.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get privacyHeaderTitle;

  /// No description provided for @privacyLastUpdated.
  ///
  /// In en, this message translates to:
  /// **'Last Updated: {date}'**
  String privacyLastUpdated(Object date);

  /// No description provided for @privacyEmailSubject.
  ///
  /// In en, this message translates to:
  /// **'subject=Privacy Policy Inquiry'**
  String get privacyEmailSubject;

  /// No description provided for @privacyEmailError.
  ///
  /// In en, this message translates to:
  /// **'Could not open email client. Please contact {email}'**
  String privacyEmailError(Object email);

  /// No description provided for @privacyMattersTitle.
  ///
  /// In en, this message translates to:
  /// **'Your Privacy Matters'**
  String get privacyMattersTitle;

  /// No description provided for @privacyMattersDescription.
  ///
  /// In en, this message translates to:
  /// **'We are committed to protecting your personal information and your right to privacy. This policy explains how we collect, use, and safeguard your data.'**
  String get privacyMattersDescription;

  /// No description provided for @privacyAppleComplianceTitle.
  ///
  /// In en, this message translates to:
  /// **'Apple Privacy Compliance'**
  String get privacyAppleComplianceTitle;

  /// No description provided for @privacyAppleComplianceDescription.
  ///
  /// In en, this message translates to:
  /// **'This app follows Apple\'s privacy guidelines and App Store requirements. We are transparent about data collection and give you control over your information.'**
  String get privacyAppleComplianceDescription;

  /// No description provided for @privacyContactHeading.
  ///
  /// In en, this message translates to:
  /// **'Contact Us'**
  String get privacyContactHeading;

  /// No description provided for @privacyContactSubheading.
  ///
  /// In en, this message translates to:
  /// **'Questions about this Privacy Policy?'**
  String get privacyContactSubheading;

  /// No description provided for @privacyContactDetails.
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro\nPrivacy Officer\nResponse within 48 hours'**
  String get privacyContactDetails;

  /// No description provided for @privacyCopyright.
  ///
  /// In en, this message translates to:
  /// **'© {year} Team Build Pro. All rights reserved.'**
  String privacyCopyright(Object year);

  /// No description provided for @privacyFooterDisclaimer.
  ///
  /// In en, this message translates to:
  /// **'This Privacy Policy is effective as of the date listed above and applies to all users of the Team Build Pro mobile application.'**
  String get privacyFooterDisclaimer;

  /// No description provided for @howItWorksScreenTitle.
  ///
  /// In en, this message translates to:
  /// **'How It Works'**
  String get howItWorksScreenTitle;

  /// No description provided for @howItWorksHeaderTitle.
  ///
  /// In en, this message translates to:
  /// **'How It Works'**
  String get howItWorksHeaderTitle;

  /// No description provided for @howItWorksHeroSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Transform your recruiting with a pre-qualified team pipeline.'**
  String get howItWorksHeroSubtitle;

  /// No description provided for @howItWorksFeaturedOpportunity.
  ///
  /// In en, this message translates to:
  /// **'Featured Opportunity'**
  String get howItWorksFeaturedOpportunity;

  /// No description provided for @howItWorksPipelineSystem.
  ///
  /// In en, this message translates to:
  /// **'PIPELINE SYSTEM'**
  String get howItWorksPipelineSystem;

  /// No description provided for @howItWorksStep1Title.
  ///
  /// In en, this message translates to:
  /// **'Set Your Foundation'**
  String get howItWorksStep1Title;

  /// No description provided for @howItWorksStep1Description.
  ///
  /// In en, this message translates to:
  /// **'Customize your Team Build Pro account with your opportunity details and connect your referral link - turning the app into your personal recruiting pipeline.'**
  String howItWorksStep1Description(Object business);

  /// No description provided for @howItWorksStep2Title.
  ///
  /// In en, this message translates to:
  /// **'Build Smart, Not Hard'**
  String get howItWorksStep2Title;

  /// No description provided for @howItWorksStep2Description.
  ///
  /// In en, this message translates to:
  /// **'Use AI-powered coaching to draft messages, schedule follow-ups, and track interest. Build relationships with prospects before they even join your business opportunity.'**
  String get howItWorksStep2Description;

  /// No description provided for @howItWorksStep3Title.
  ///
  /// In en, this message translates to:
  /// **'Automatic Qualification'**
  String get howItWorksStep3Title;

  /// No description provided for @howItWorksStep3Description.
  ///
  /// In en, this message translates to:
  /// **'As prospects build their own teams within the app, they automatically hit qualification milestones (4 direct sponsors + 20 total team) - proving their commitment before joining.'**
  String howItWorksStep3Description(Object business);

  /// No description provided for @howItWorksStep4Title.
  ///
  /// In en, this message translates to:
  /// **'Rapid Growth'**
  String get howItWorksStep4Title;

  /// No description provided for @howItWorksStep4Description.
  ///
  /// In en, this message translates to:
  /// **'Your pre-qualified prospects launch with momentum, teams already in place, and proven ability to recruit. This creates a self-sustaining growth engine.'**
  String get howItWorksStep4Description;

  /// No description provided for @howItWorksKeyTargetsTitle.
  ///
  /// In en, this message translates to:
  /// **' KEY GROWTH TARGETS'**
  String get howItWorksKeyTargetsTitle;

  /// No description provided for @howItWorksDirectSponsors.
  ///
  /// In en, this message translates to:
  /// **'Direct Sponsors'**
  String get howItWorksDirectSponsors;

  /// No description provided for @howItWorksTotalTeam.
  ///
  /// In en, this message translates to:
  /// **'Total Team Members'**
  String get howItWorksTotalTeam;

  /// No description provided for @howItWorksCtaHeading.
  ///
  /// In en, this message translates to:
  /// **'Grow Your Network'**
  String get howItWorksCtaHeading;

  /// No description provided for @howItWorksCtaDescription.
  ///
  /// In en, this message translates to:
  /// **'Expand your Network to drive organization growth!'**
  String get howItWorksCtaDescription;

  /// No description provided for @howItWorksCtaButton.
  ///
  /// In en, this message translates to:
  /// **'Proven Growth Strategies'**
  String get howItWorksCtaButton;

  /// No description provided for @howItWorksDefaultBizOpp.
  ///
  /// In en, this message translates to:
  /// **'your opportunity'**
  String get howItWorksDefaultBizOpp;

  /// No description provided for @termsDisclaimerContent.
  ///
  /// In en, this message translates to:
  /// **'• Team Build Pro is a subscription-based networking platform\n• Users pay a monthly subscription fee for access to networking tools\n• The platform provides relationship management and business connection features\n• All business opportunities are provided by independent third parties\n\nTeam Build Pro operates as a networking platform and does not guarantee business outcomes.'**
  String get termsDisclaimerContent;

  /// No description provided for @termsSection1Title.
  ///
  /// In en, this message translates to:
  /// **'1. ACCEPTANCE OF TERMS'**
  String get termsSection1Title;

  /// No description provided for @termsSection1Content.
  ///
  /// In en, this message translates to:
  /// **'By downloading, installing, accessing, or using the Team Build Pro mobile application (\"App\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, do not use the App.\n\nThese Terms constitute a legally binding agreement between you and Team Build Pro regarding your use of our professional networking platform service.'**
  String get termsSection1Content;

  /// No description provided for @termsSection2Title.
  ///
  /// In en, this message translates to:
  /// **'2. SERVICE DESCRIPTION'**
  String get termsSection2Title;

  /// No description provided for @termsSection2Content.
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is a subscription-based professional networking platform that provides:\n\n• Contact relationship management tools\n• Team building and networking features\n• Communication and collaboration tools\n• Business opportunity information from third-party providers\n• AI-powered coaching and guidance\n\nIMPORTANT DISCLAIMERS:\n• Team Build Pro is a networking platform service, not a business opportunity\n• Users pay a monthly subscription fee for platform access\n• We do not guarantee any business results or income\n• All business opportunities are provided by independent third parties\n• Success depends entirely on individual effort and market conditions'**
  String get termsSection2Content;

  /// No description provided for @termsSection3Title.
  ///
  /// In en, this message translates to:
  /// **'3. SUBSCRIPTION AND PAYMENT'**
  String get termsSection3Title;

  /// No description provided for @termsSection3Content.
  ///
  /// In en, this message translates to:
  /// **'ACCESS AND FEES:\n• The App operates on a subscription basis\n• Monthly subscription fees are charged through your Apple ID account\n• Subscription automatically renews unless cancelled\n• Prices are shown in the App and may vary by region\n\nBILLING CYCLE:\n• You will be charged at confirmation of purchase\n• Your subscription automatically renews each month\n• Charges occur 24 hours before the end of the current period\n• You can manage subscriptions in your Apple ID Account Settings\n\nCANCELLATION:\n• Cancel anytime through Apple ID Account Settings\n• Cancellation takes effect at the end of the current billing period\n• No refunds for partial months\n• Access continues until the end of the paid period'**
  String get termsSection3Content;

  /// No description provided for @termsSection4Title.
  ///
  /// In en, this message translates to:
  /// **'4. FREE TRIAL (IF APPLICABLE)'**
  String get termsSection4Title;

  /// No description provided for @termsSection4Content.
  ///
  /// In en, this message translates to:
  /// **'TRIAL TERMS:\n• Some subscription plans may include a free trial period\n• Trial duration will be clearly displayed before signup\n• You may cancel during the trial to avoid charges\n• If you don\'t cancel, you\'ll be charged the subscription fee\n\nCONVERSION TO PAID:\n• Trials convert to paid subscriptions automatically\n• Charges begin immediately after trial ends\n• The subscription price shown at signup applies\n• Cancel before trial ends to avoid charges'**
  String get termsSection4Content;

  /// No description provided for @termsSection5Title.
  ///
  /// In en, this message translates to:
  /// **'5. APPLE IN-APP PURCHASE TERMS'**
  String get termsSection5Title;

  /// No description provided for @termsSection5Content.
  ///
  /// In en, this message translates to:
  /// **'All subscriptions are processed through Apple\'s In-App Purchase system and are subject to Apple\'s Terms of Service and policies.\n\nAPPLE\'S ROLE:\n• Payment is charged to your Apple ID account\n• Subscriptions managed through Apple ID Account Settings\n• Refund requests handled by Apple according to their policies\n• Apple\'s Standard EULA terms apply unless otherwise specified\n\nYOUR RESPONSIBILITIES:\n• Maintain accurate Apple ID payment information\n• Monitor subscription status in your Apple account\n• Contact Apple Support for billing issues\n• Review Apple\'s terms at: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'**
  String get termsSection5Content;

  /// No description provided for @termsSection6Title.
  ///
  /// In en, this message translates to:
  /// **'6. USER ACCOUNTS AND REGISTRATION'**
  String get termsSection6Title;

  /// No description provided for @termsSection6Content.
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT CREATION:\n• You must create an account to use the App\n• Provide accurate, current, and complete information\n• You are responsible for maintaining account confidentiality\n• You must be at least 18 years old to create an account\n\nACCOUNT SECURITY:\n• Keep your password secure and confidential\n• Notify us immediately of unauthorized access\n• You are responsible for all activity under your account\n• Do not share your account with others\n\nACCOUNT TERMINATION:\n• We may suspend or terminate accounts that violate these Terms\n• You may delete your account at any time through the App\n• Termination does not affect subscription billing unless cancelled\n• We reserve the right to refuse service to anyone'**
  String get termsSection6Content;

  /// No description provided for @termsSection7Title.
  ///
  /// In en, this message translates to:
  /// **'7. PROHIBITED CONDUCT'**
  String get termsSection7Title;

  /// No description provided for @termsSection7Content.
  ///
  /// In en, this message translates to:
  /// **'You agree NOT to:\n\n• Use the App for any illegal purpose\n• Violate any applicable laws or regulations\n• Infringe on intellectual property rights\n• Transmit harmful code, viruses, or malware\n• Harass, abuse, or harm other users\n• Impersonate others or provide false information\n• Attempt to gain unauthorized access to the App\n• Interfere with App functionality or security\n• Use automated systems to access the App without permission\n• Collect user information without consent\n• Engage in any activity that disrupts the App\n• Use the App to promote illegal schemes or scams'**
  String get termsSection7Content;

  /// No description provided for @termsSection8Title.
  ///
  /// In en, this message translates to:
  /// **'8. INTELLECTUAL PROPERTY'**
  String get termsSection8Title;

  /// No description provided for @termsSection8Content.
  ///
  /// In en, this message translates to:
  /// **'OWNERSHIP:\n• Team Build Pro owns all rights to the App and its content\n• This includes software, design, text, graphics, and logos\n• Our trademarks and branding are protected\n• You receive only a limited license to use the App\n\nYOUR LICENSE:\n• We grant you a limited, non-exclusive, non-transferable license\n• You may use the App for personal, non-commercial purposes\n• This license does not include resale or commercial use\n• The license terminates when your subscription ends\n\nUSER CONTENT:\n• You retain ownership of content you create in the App\n• You grant us a license to use your content to provide services\n• You represent that you have rights to any content you upload\n• We may remove content that violates these Terms'**
  String get termsSection8Content;

  /// No description provided for @termsSection9Title.
  ///
  /// In en, this message translates to:
  /// **'9. PRIVACY AND DATA'**
  String get termsSection9Title;

  /// No description provided for @termsSection9Content.
  ///
  /// In en, this message translates to:
  /// **'DATA COLLECTION AND USE:\n• We collect and use data as described in our Privacy Policy\n• Review our Privacy Policy at: https://info.teambuildpro.com/privacy-policy.html\n• By using the App, you consent to our data practices\n• We implement security measures to protect your data\n\nYOUR PRIVACY RIGHTS:\n• You have rights regarding your personal data\n• You may request access to your data\n• You may request deletion of your account and data\n• Contact us at support@teambuildpro.com for privacy requests\n\nDATA SECURITY:\n• We use industry-standard security measures\n• However, no system is completely secure\n• You use the App at your own risk\n• Report security concerns to support@teambuildpro.com'**
  String get termsSection9Content;

  /// No description provided for @termsSection10Title.
  ///
  /// In en, this message translates to:
  /// **'10. THIRD-PARTY SERVICES AND CONTENT'**
  String get termsSection10Title;

  /// No description provided for @termsSection10Content.
  ///
  /// In en, this message translates to:
  /// **'BUSINESS OPPORTUNITIES:\n• The App may display information about third-party business opportunities\n• These opportunities are provided by independent companies\n• Team Build Pro is not affiliated with these opportunities\n• We do not endorse or guarantee any third-party opportunity\n• Research opportunities independently before participating\n\nTHIRD-PARTY LINKS:\n• The App may contain links to third-party websites\n• We are not responsible for third-party content or practices\n• Third-party sites have their own terms and privacy policies\n• Access third-party content at your own risk\n\nINTEGRATIONS:\n• The App may integrate with third-party services\n• Your use of integrated services is subject to their terms\n• We are not responsible for third-party service performance\n• Integrations may be modified or discontinued at any time'**
  String get termsSection10Content;

  /// No description provided for @termsSection11Title.
  ///
  /// In en, this message translates to:
  /// **'11. DISCLAIMERS'**
  String get termsSection11Title;

  /// No description provided for @termsSection11Content.
  ///
  /// In en, this message translates to:
  /// **'NO BUSINESS OPPORTUNITY:\n• Team Build Pro is a networking platform service only\n• We do not offer or guarantee any business opportunity\n• We do not guarantee income, earnings, or success\n• Any business opportunity information comes from third parties\n\nSERVICE PROVIDED \"AS IS\":\n• The App is provided \"as is\" and \"as available\"\n• We make no warranties about App reliability or availability\n• We do not guarantee error-free or uninterrupted service\n• We may modify or discontinue features at any time\n\nNO PROFESSIONAL ADVICE:\n• The App does not provide legal, financial, or tax advice\n• AI coaching is for informational purposes only\n• Consult qualified professionals for important decisions\n• We are not responsible for decisions based on App content\n\nRESULTS DISCLAIMER:\n• Individual results vary and are not guaranteed\n• Success depends on individual effort and circumstances\n• Past performance does not indicate future results\n• We make no representations about potential outcomes'**
  String get termsSection11Content;

  /// No description provided for @termsSection12Title.
  ///
  /// In en, this message translates to:
  /// **'12. LIMITATION OF LIABILITY'**
  String get termsSection12Title;

  /// No description provided for @termsSection12Content.
  ///
  /// In en, this message translates to:
  /// **'TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n\nWE ARE NOT LIABLE FOR:\n• Any indirect, incidental, or consequential damages\n• Loss of profits, revenue, data, or business opportunities\n• Service interruptions or errors\n• Unauthorized access to your account or data\n• Third-party actions or content\n• Any damages exceeding the amount you paid us in the past 12 months\n\nCAP ON LIABILITY:\n• Our total liability is limited to subscription fees paid in the past 12 months\n• This applies regardless of the legal theory of liability\n• Some jurisdictions don\'t allow these limitations\n• In those cases, liability is limited to the minimum required by law\n\nUSER RESPONSIBILITY:\n• You are responsible for your use of the App\n• You are responsible for decisions based on App content\n• You assume all risks associated with App use\n• You agree to evaluate business opportunities independently'**
  String get termsSection12Content;

  /// No description provided for @termsSection13Title.
  ///
  /// In en, this message translates to:
  /// **'13. INDEMNIFICATION'**
  String get termsSection13Title;

  /// No description provided for @termsSection13Content.
  ///
  /// In en, this message translates to:
  /// **'You agree to indemnify, defend, and hold harmless Team Build Pro, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:\n\n• Your use of the App\n• Your violation of these Terms\n• Your violation of any rights of others\n• Your content or information posted in the App\n• Your participation in any business opportunity\n• Your violation of applicable laws or regulations\n\nThis indemnification obligation survives termination of these Terms and your use of the App.'**
  String get termsSection13Content;

  /// No description provided for @termsSection14Title.
  ///
  /// In en, this message translates to:
  /// **'14. DISPUTE RESOLUTION'**
  String get termsSection14Title;

  /// No description provided for @termsSection14Content.
  ///
  /// In en, this message translates to:
  /// **'GOVERNING LAW:\n• These Terms are governed by the laws of the State of Utah, USA\n• Federal law applies where applicable\n• You consent to jurisdiction in Utah courts\n\nINFORMAL RESOLUTION:\n• Contact us first to resolve disputes informally\n• Email: support@teambuildpro.com\n• We will attempt to resolve issues in good faith\n• Most concerns can be addressed through communication\n\nARBITRATION (IF REQUIRED):\n• Disputes may be subject to binding arbitration\n• Arbitration conducted under American Arbitration Association rules\n• Individual arbitration only - no class actions\n• Arbitration location: Utah, USA\n\nEXCEPTIONS:\n• Either party may seek injunctive relief in court\n• Intellectual property disputes may be litigated\n• Small claims court remains available for qualifying claims'**
  String get termsSection14Content;

  /// No description provided for @termsSection15Title.
  ///
  /// In en, this message translates to:
  /// **'15. CHANGES TO TERMS'**
  String get termsSection15Title;

  /// No description provided for @termsSection15Content.
  ///
  /// In en, this message translates to:
  /// **'MODIFICATIONS:\n• We may update these Terms at any time\n• Changes effective upon posting in the App\n• Continued use constitutes acceptance of changes\n• Material changes will be communicated via email or App notification\n\nYOUR OPTIONS:\n• Review Terms periodically for changes\n• If you disagree with changes, stop using the App\n• Cancel your subscription if you don\'t accept new Terms\n• Contact support@teambuildpro.com with questions\n\nEFFECTIVE DATE:\n• Current version effective as of posting date\n• Previous versions are superseded\n• We maintain records of Terms versions'**
  String get termsSection15Content;

  /// No description provided for @termsSection16Title.
  ///
  /// In en, this message translates to:
  /// **'16. GENERAL PROVISIONS'**
  String get termsSection16Title;

  /// No description provided for @termsSection16Content.
  ///
  /// In en, this message translates to:
  /// **'ENTIRE AGREEMENT:\n• These Terms constitute the entire agreement between you and Team Build Pro\n• They supersede all prior agreements or understandings\n• Apple\'s EULA terms also apply to App Store purchases\n\nSEVERABILITY:\n• If any provision is found invalid, the rest remains in effect\n• Invalid provisions will be modified to be enforceable\n• The Terms remain binding even with invalid provisions\n\nNO WAIVER:\n• Our failure to enforce any right doesn\'t waive that right\n• Waiver of one breach doesn\'t waive future breaches\n• All rights and remedies are cumulative\n\nASSIGNMENT:\n• You may not assign these Terms without our consent\n• We may assign our rights and obligations\n• Terms bind permitted successors and assigns\n\nCONTACT INFORMATION:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nPrivacy Policy: https://info.teambuildpro.com/privacy-policy.html\n\nLast Updated: January 2025'**
  String get termsSection16Content;

  /// No description provided for @privacySection1Title.
  ///
  /// In en, this message translates to:
  /// **'1. INFORMATION WE COLLECT'**
  String get privacySection1Title;

  /// No description provided for @privacySection1Content.
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT INFORMATION:\n• Name and email address\n• Phone number (optional)\n• Profile information you provide\n• Authentication credentials\n\nUSAGE DATA:\n• App interactions and features used\n• Device information (model, OS version)\n• Performance and crash data\n• Analytics data (anonymized where possible)\n\nCONTENT YOU CREATE:\n• Messages and communications\n• Contact information you add\n• Notes and relationship data\n• Files and media you upload\n\nLOCATION DATA:\n• We do not collect precise location data\n• General location may be derived from IP address\n• You can manage location permissions in device settings'**
  String get privacySection1Content;

  /// No description provided for @privacySection2Title.
  ///
  /// In en, this message translates to:
  /// **'2. HOW WE USE YOUR INFORMATION'**
  String get privacySection2Title;

  /// No description provided for @privacySection2Content.
  ///
  /// In en, this message translates to:
  /// **'We use collected information to:\n\nPROVIDE SERVICES:\n• Create and manage your account\n• Enable App features and functionality\n• Process your subscription payments\n• Provide customer support\n• Send service-related notifications\n\nIMPROVE OUR APP:\n• Analyze usage patterns and trends\n• Fix bugs and improve performance\n• Develop new features\n• Conduct research and analytics\n\nCOMMUNICATIONS:\n• Send important service updates\n• Respond to your inquiries\n• Provide technical support\n• Send optional marketing (you can opt out)\n\nLEGAL COMPLIANCE:\n• Comply with legal obligations\n• Enforce our Terms of Service\n• Protect rights and safety\n• Prevent fraud and abuse'**
  String get privacySection2Content;

  /// No description provided for @privacySection3Title.
  ///
  /// In en, this message translates to:
  /// **'3. HOW WE SHARE YOUR INFORMATION'**
  String get privacySection3Title;

  /// No description provided for @privacySection3Content.
  ///
  /// In en, this message translates to:
  /// **'We share information only in these limited circumstances:\n\nSERVICE PROVIDERS:\n• Cloud hosting (Firebase/Google Cloud)\n• Payment processing (Apple)\n• Analytics services\n• Customer support tools\n• These providers are contractually obligated to protect your data\n\nLEGAL REQUIREMENTS:\n• When required by law or legal process\n• To protect rights, property, or safety\n• In connection with legal proceedings\n• To prevent fraud or illegal activity\n\nBUSINESS TRANSFERS:\n• In connection with merger, acquisition, or sale of assets\n• Your data may transfer to successor entity\n• You will be notified of any such transfer\n\nWITH YOUR CONSENT:\n• When you explicitly authorize sharing\n• For purposes you approve\n\nWE DO NOT:\n• Sell your personal information\n• Share data for third-party marketing\n• Provide data to data brokers'**
  String get privacySection3Content;

  /// No description provided for @privacySection4Title.
  ///
  /// In en, this message translates to:
  /// **'4. DATA SECURITY'**
  String get privacySection4Title;

  /// No description provided for @privacySection4Content.
  ///
  /// In en, this message translates to:
  /// **'SECURITY MEASURES:\n• Industry-standard encryption in transit and at rest\n• Secure authentication systems\n• Regular security assessments\n• Access controls and monitoring\n• Secure data centers (Google Cloud/Firebase)\n\nYOUR RESPONSIBILITIES:\n• Keep your password confidential\n• Use device security features (passcode, biometrics)\n• Report suspicious activity immediately\n• Keep your device and app updated\n\nLIMITATIONS:\n• No system is 100% secure\n• You use the App at your own risk\n• We cannot guarantee absolute security\n• Report security concerns to: support@teambuildpro.com'**
  String get privacySection4Content;

  /// No description provided for @privacySection5Title.
  ///
  /// In en, this message translates to:
  /// **'5. YOUR PRIVACY RIGHTS'**
  String get privacySection5Title;

  /// No description provided for @privacySection5Content.
  ///
  /// In en, this message translates to:
  /// **'You have the following rights regarding your data:\n\nACCESS AND PORTABILITY:\n• Request a copy of your personal data\n• Export your data in a portable format\n• Review what information we have about you\n\nCORRECTION:\n• Update inaccurate information\n• Modify your profile details\n• Correct errors in your account\n\nDELETION:\n• Request deletion of your account and data\n• Use the \"Delete Account\" feature in the App\n• Some data may be retained for legal compliance\n• Deletion is permanent and cannot be undone\n\nOPT-OUT:\n• Unsubscribe from marketing emails\n• Disable push notifications in device settings\n• Limit analytics data collection\n\nTO EXERCISE RIGHTS:\n• Use in-app settings where available\n• Email: support@teambuildpro.com\n• We will respond within 30 days\n• Identity verification may be required'**
  String get privacySection5Content;

  /// No description provided for @privacySection6Title.
  ///
  /// In en, this message translates to:
  /// **'6. DATA RETENTION'**
  String get privacySection6Title;

  /// No description provided for @privacySection6Content.
  ///
  /// In en, this message translates to:
  /// **'HOW LONG WE KEEP DATA:\n\nACTIVE ACCOUNTS:\n• Data retained while your account is active\n• Necessary to provide ongoing service\n• You can delete data or account anytime\n\nDELETED ACCOUNTS:\n• Most data deleted within 30 days\n• Some data retained for legal compliance\n• Backup systems purged within 90 days\n• Financial records kept per legal requirements\n\nLEGAL RETENTION:\n• Transaction records: 7 years (tax law)\n• Legal disputes: until resolution + statute of limitations\n• Fraud prevention: as legally required\n• Aggregated analytics: indefinitely (anonymized)\n\nYOUR CONTROL:\n• Request deletion at any time\n• Export data before account deletion\n• Deletion is permanent and irreversible'**
  String get privacySection6Content;

  /// No description provided for @privacySection7Title.
  ///
  /// In en, this message translates to:
  /// **'7. CHILDREN\'S PRIVACY'**
  String get privacySection7Title;

  /// No description provided for @privacySection7Content.
  ///
  /// In en, this message translates to:
  /// **'AGE RESTRICTION:\n• The App is not intended for users under 18\n• We do not knowingly collect data from minors\n• You must be 18+ to create an account\n\nIF WE LEARN OF UNDERAGE USERS:\n• We will promptly delete their accounts\n• We will delete all associated data\n• We will take steps to prevent future underage access\n\nPARENTAL RIGHTS:\n• Parents may request deletion of minor\'s data\n• Contact: support@teambuildpro.com\n• Provide proof of parental relationship\n• We will act promptly on verified requests'**
  String get privacySection7Content;

  /// No description provided for @privacySection8Title.
  ///
  /// In en, this message translates to:
  /// **'8. CHANGES TO PRIVACY POLICY'**
  String get privacySection8Title;

  /// No description provided for @privacySection8Content.
  ///
  /// In en, this message translates to:
  /// **'UPDATES:\n• We may update this Privacy Policy periodically\n• Changes posted in the App and on our website\n• Material changes communicated via email or notification\n• Continued use means acceptance of changes\n\nYOUR OPTIONS:\n• Review this policy regularly\n• Contact us with questions: support@teambuildpro.com\n• Stop using the App if you disagree with changes\n• Delete your account if you don\'t accept updates\n\nEFFECTIVE DATE:\n• Current version: January 2025\n• Last Updated: January 2025\n• Previous versions are superseded\n\nCONTACT INFORMATION:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nTerms of Service: https://info.teambuildpro.com/terms-of-service.html'**
  String get privacySection8Content;

  /// Title of the subscription screen
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro'**
  String get subscriptionScreenTitle;

  /// Success message when subscription is activated
  ///
  /// In en, this message translates to:
  /// **'✅ Subscription activated successfully!'**
  String get subscriptionSuccessMessage;

  /// Success message when subscription is restored
  ///
  /// In en, this message translates to:
  /// **'✅ Subscription restored successfully!'**
  String get subscriptionRestoreSuccess;

  /// Message when no previous subscription can be restored
  ///
  /// In en, this message translates to:
  /// **'No previous subscription found to restore.'**
  String get subscriptionRestoreNone;

  /// Status card title for trial subscription
  ///
  /// In en, this message translates to:
  /// **'Free Trial Active'**
  String get subscriptionStatusTrial;

  /// Status card subtitle for trial subscription
  ///
  /// In en, this message translates to:
  /// **'{days} days remaining in your trial'**
  String subscriptionStatusTrialSubtitle(int days);

  /// Header for premium features list
  ///
  /// In en, this message translates to:
  /// **'Premium Features:'**
  String get subscriptionPremiumFeaturesHeader;

  /// Premium feature: referral link submission
  ///
  /// In en, this message translates to:
  /// **'Submit your unique {bizOpp} referral link'**
  String subscriptionFeatureReferralLink(String bizOpp);

  /// Premium feature: AI coaching
  ///
  /// In en, this message translates to:
  /// **'Custom AI Coaching for recruiting and team building'**
  String get subscriptionFeatureAiCoaching;

  /// Premium feature: messaging capability
  ///
  /// In en, this message translates to:
  /// **'Unlock messaging to users on your team'**
  String get subscriptionFeatureMessaging;

  /// Premium feature: team placement guarantee
  ///
  /// In en, this message translates to:
  /// **'Ensure team members join under YOU in {bizOpp}'**
  String subscriptionFeatureEnsureTeam(String bizOpp);

  /// Premium feature: analytics
  ///
  /// In en, this message translates to:
  /// **'Advanced analytics and insights'**
  String get subscriptionFeatureAnalytics;

  /// iOS subscription management instructions
  ///
  /// In en, this message translates to:
  /// **'You can manage your subscription in your Apple ID account settings.'**
  String get subscriptionManagementApple;

  /// Android subscription management instructions
  ///
  /// In en, this message translates to:
  /// **'You can manage your subscription in the Google Play Store.'**
  String get subscriptionManagementGoogle;

  /// FAQ screen title
  ///
  /// In en, this message translates to:
  /// **'Frequently Asked Questions'**
  String get faqTitle;

  /// FAQ search bar placeholder text
  ///
  /// In en, this message translates to:
  /// **'Search FAQs...'**
  String get faqSearchHint;

  /// FAQ category: Getting Started
  ///
  /// In en, this message translates to:
  /// **'Getting Started'**
  String get faqCategoryGettingStarted;

  /// FAQ category: Business Model
  ///
  /// In en, this message translates to:
  /// **'Business Model & Legitimacy'**
  String get faqCategoryBusinessModel;

  /// FAQ category: How It Works
  ///
  /// In en, this message translates to:
  /// **'How It Works'**
  String get faqCategoryHowItWorks;

  /// FAQ category: Team Building
  ///
  /// In en, this message translates to:
  /// **'Team Building & Management'**
  String get faqCategoryTeamBuilding;

  /// FAQ category: Global Features
  ///
  /// In en, this message translates to:
  /// **'Global & Technical Features'**
  String get faqCategoryGlobalFeatures;

  /// FAQ category: Privacy & Security
  ///
  /// In en, this message translates to:
  /// **'Privacy & Security'**
  String get faqCategoryPrivacySecurity;

  /// FAQ category: Pricing
  ///
  /// In en, this message translates to:
  /// **'Pricing & Business Value'**
  String get faqCategoryPricing;

  /// FAQ category: Concerns
  ///
  /// In en, this message translates to:
  /// **'Common Concerns & Objections'**
  String get faqCategoryConcerns;

  /// FAQ category: Success
  ///
  /// In en, this message translates to:
  /// **'Success & Results'**
  String get faqCategorySuccess;

  /// FAQ category: Support
  ///
  /// In en, this message translates to:
  /// **'Support & Training'**
  String get faqCategorySupport;

  /// FAQ question 1
  ///
  /// In en, this message translates to:
  /// **'What exactly is Team Build Pro?'**
  String get faqQ1;

  /// FAQ answer 1
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is a professional software tool designed to help direct sales professionals build, manage, and track their teams before and during their business journey. It\'s NOT a business opportunity or MLM company - it\'s the tool that helps you succeed in whatever opportunity you choose.'**
  String get faqA1;

  /// FAQ question 2
  ///
  /// In en, this message translates to:
  /// **'How is this different from other team building apps or CRM systems?'**
  String get faqQ2;

  /// FAQ answer 2
  ///
  /// In en, this message translates to:
  /// **'Unlike generic CRMs, Team Build Pro is specifically designed for the direct sales industry. It understands the unique challenges you face: starting from zero, building momentum, qualifying prospects, and maintaining team motivation. Our system lets you pre-build your team before you even join an opportunity, giving you a massive head start.'**
  String get faqA2;

  /// FAQ question 3
  ///
  /// In en, this message translates to:
  /// **'Can I really build a team BEFORE joining a business opportunity?'**
  String get faqQ3;

  /// FAQ answer 3
  ///
  /// In en, this message translates to:
  /// **'Absolutely! This is our core innovation. You can invite prospects and existing team members to Team Build Pro, let them experience team building success, and when they hit qualification milestones (4 direct sponsors + 20 total team members), they automatically get invited to join your business opportunity. It eliminates the \"cold start\" problem that kills most new distributors.'**
  String get faqA3;

  /// FAQ question 4
  ///
  /// In en, this message translates to:
  /// **'Do I need a credit card to try it?'**
  String get faqQ4;

  /// FAQ answer 4
  ///
  /// In en, this message translates to:
  /// **'No. You get full access to all premium features for 30 days completely free, with no credit card required. You can decide to subscribe at any point during or after your trial.'**
  String get faqA4;

  /// FAQ question 5
  ///
  /// In en, this message translates to:
  /// **'Is Team Build Pro an MLM or business opportunity?'**
  String get faqQ5;

  /// FAQ answer 5
  ///
  /// In en, this message translates to:
  /// **'No. Team Build Pro is not a business opportunity, MLM, or income platform of any kind. We are a software tool designed exclusively to help professionals build and track their teams. We do not provide any form of user compensation.'**
  String get faqA5;

  /// FAQ question 6
  ///
  /// In en, this message translates to:
  /// **'Can I use this with any direct sales company?'**
  String get faqQ6;

  /// FAQ answer 6
  ///
  /// In en, this message translates to:
  /// **'Yes! Team Build Pro is company-agnostic. Whether you\'re in health and wellness, financial services, beauty, technology, or any other direct sales industry, our tools work with your business. You simply customize your profile with your opportunity details.'**
  String get faqA6;

  /// FAQ question 7
  ///
  /// In en, this message translates to:
  /// **'What if I\'m not currently with a company but want to join one?'**
  String get faqQ7;

  /// FAQ answer 7
  ///
  /// In en, this message translates to:
  /// **'Perfect! This is where Team Build Pro shines. You can start building your team immediately, even before you\'ve chosen which company to join. When you do decide, you\'ll launch with a pre-built, motivated team instead of starting from zero.'**
  String get faqA7;

  /// FAQ question 8
  ///
  /// In en, this message translates to:
  /// **'How does the qualification system work?'**
  String get faqQ8;

  /// FAQ answer 8
  ///
  /// In en, this message translates to:
  /// **'When someone joins Team Build Pro through your referral, they begin building their own team. Once they reach our success milestones (4 direct sponsors + 20 total team members), they automatically receive an invitation to join your business opportunity. This ensures only motivated, proven team builders advance to your actual business.'**
  String get faqA8;

  /// FAQ question 9
  ///
  /// In en, this message translates to:
  /// **'What happens if someone joins my Team Build Pro team but doesn\'t want to join my business opportunity?'**
  String get faqQ9;

  /// FAQ answer 9
  ///
  /// In en, this message translates to:
  /// **'That\'s perfectly fine! They can continue using Team Build Pro to build their own team for whatever opportunity they choose, or they can stay focused on team building. There\'s no pressure. The beauty is that you\'re only working with people who have demonstrated commitment and success.'**
  String get faqA9;

  /// FAQ question 10
  ///
  /// In en, this message translates to:
  /// **'Can I track my team\'s progress and activity?'**
  String get faqQ10;

  /// FAQ answer 10
  ///
  /// In en, this message translates to:
  /// **'Yes! You get comprehensive analytics including real-time team growth statistics, individual member progress toward qualification, activity levels and engagement metrics, geographic distribution of your team, performance trends and milestones, and daily/weekly growth reports.'**
  String get faqA10;

  /// FAQ question 11
  ///
  /// In en, this message translates to:
  /// **'How do I get my referral link?'**
  String get faqQ11;

  /// FAQ answer 11
  ///
  /// In en, this message translates to:
  /// **'Once you create your account, you get a personalized referral link that you can share via social media, email, text, or in person.'**
  String get faqA11;

  /// FAQ question 12
  ///
  /// In en, this message translates to:
  /// **'What\'s the difference between \"sponsors\" and \"team members\"?'**
  String get faqQ12;

  /// FAQ answer 12
  ///
  /// In en, this message translates to:
  /// **'Direct sponsors are people you personally invite who join through your referral link. Total team members include your direct sponsors plus everyone they sponsor (your downline). For qualification, you need 4 direct sponsors and 20 total team members.'**
  String get faqA12;

  /// FAQ question 13
  ///
  /// In en, this message translates to:
  /// **'Can my team members message each other?'**
  String get faqQ13;

  /// FAQ answer 13
  ///
  /// In en, this message translates to:
  /// **'Yes! Team Build Pro includes secure, encrypted messaging so your team can communicate, share tips, and support each other.'**
  String get faqA13;

  /// FAQ question 14
  ///
  /// In en, this message translates to:
  /// **'What if someone in my team becomes qualified before me?'**
  String get faqQ14;

  /// FAQ answer 14
  ///
  /// In en, this message translates to:
  /// **'That\'s actually great! It shows the system is working. They can advance to your business opportunity independently, and you continue building your own qualification. Success breeds success - having qualified team members often motivates others.'**
  String get faqA14;

  /// FAQ question 15
  ///
  /// In en, this message translates to:
  /// **'How do I know if my team members are active?'**
  String get faqQ15;

  /// FAQ answer 15
  ///
  /// In en, this message translates to:
  /// **'Our dashboard shows activity levels, last login dates, team building progress, and engagement metrics for each member. You can easily identify who might need encouragement or support.'**
  String get faqA15;

  /// FAQ question 16
  ///
  /// In en, this message translates to:
  /// **'Can I remove someone from my team?'**
  String get faqQ16;

  /// FAQ answer 16
  ///
  /// In en, this message translates to:
  /// **'Team members can choose to leave on their own, but you cannot remove them. This protects the integrity of the team and ensures everyone\'s hard work building their teams is preserved.'**
  String get faqA16;

  /// FAQ question 17
  ///
  /// In en, this message translates to:
  /// **'Does this work internationally?'**
  String get faqQ17;

  /// FAQ answer 17
  ///
  /// In en, this message translates to:
  /// **'Yes! Team Build Pro works in 120+ countries with timezone-aware features. You can build a truly global team, and our system handles different time zones for notifications and reporting.'**
  String get faqA17;

  /// FAQ question 18
  ///
  /// In en, this message translates to:
  /// **'What devices does it work on?'**
  String get faqQ18;

  /// FAQ answer 18
  ///
  /// In en, this message translates to:
  /// **'Team Build Pro is available on iOS (iPhone/iPad) and Android devices, with a web companion for additional features. Everything syncs across all your devices.'**
  String get faqA18;

  /// FAQ question 19
  ///
  /// In en, this message translates to:
  /// **'What if I\'m not tech-savvy?'**
  String get faqQ19;

  /// FAQ answer 19
  ///
  /// In en, this message translates to:
  /// **'The app is designed for simplicity. If you can use social media, you can use Team Build Pro. Plus, we provide onboarding tutorials and customer support to help you get started.'**
  String get faqA19;

  /// FAQ question 20
  ///
  /// In en, this message translates to:
  /// **'Does the app work offline?'**
  String get faqQ20;

  /// FAQ answer 20
  ///
  /// In en, this message translates to:
  /// **'You need an internet connection for real-time features like messaging and live updates, but you can view your team and some analytics offline. Data syncs when you reconnect.'**
  String get faqA20;

  /// FAQ question 21
  ///
  /// In en, this message translates to:
  /// **'How secure is my data?'**
  String get faqQ21;

  /// FAQ answer 21
  ///
  /// In en, this message translates to:
  /// **'We use enterprise-grade security including end-to-end encryption for all communications, secure cloud storage with regular backups, multi-factor authentication options, GDPR compliance for data protection, and no data sharing with third parties.'**
  String get faqA21;

  /// FAQ question 22
  ///
  /// In en, this message translates to:
  /// **'Who can see my team information?'**
  String get faqQ22;

  /// FAQ answer 22
  ///
  /// In en, this message translates to:
  /// **'Only you can see your complete team. Team members can see their own direct sponsors and downline, but cannot see your entire organization. This protects everyone\'s privacy while maintaining transparency in direct relationships.'**
  String get faqA22;

  /// FAQ question 23
  ///
  /// In en, this message translates to:
  /// **'What happens to my data if I cancel?'**
  String get faqQ23;

  /// FAQ answer 23
  ///
  /// In en, this message translates to:
  /// **'You can export your team data before canceling. After cancellation, your account is deactivated but your team relationships remain intact for others in your team. We retain minimal data for legal/billing purposes only.'**
  String get faqA23;

  /// FAQ question 24
  ///
  /// In en, this message translates to:
  /// **'Do you sell my information to other companies?'**
  String get faqQ24;

  /// FAQ answer 24
  ///
  /// In en, this message translates to:
  /// **'Absolutely not. We never sell, rent, or share your personal information with third parties. Our revenue comes from subscriptions, not data sales.'**
  String get faqA24;

  /// FAQ question 25
  ///
  /// In en, this message translates to:
  /// **'Is \$4.99/month worth it compared to free alternatives?'**
  String get faqQ25;

  /// FAQ answer 25
  ///
  /// In en, this message translates to:
  /// **'Free tools aren\'t built for the direct sales industry and lack crucial features like qualification tracking, business opportunity integration, and team analytics. For less than the cost of a coffee, you get professional-grade team building tools that can transform your business.'**
  String get faqA25;

  /// FAQ question 26
  ///
  /// In en, this message translates to:
  /// **'Can I write this off as a business expense?'**
  String get faqQ26;

  /// FAQ answer 26
  ///
  /// In en, this message translates to:
  /// **'Many direct sales professionals do treat it as a business tool expense, but consult your tax advisor for guidance specific to your situation.'**
  String get faqA26;

  /// FAQ question 27
  ///
  /// In en, this message translates to:
  /// **'What if I need to cancel?'**
  String get faqQ27;

  /// FAQ answer 27
  ///
  /// In en, this message translates to:
  /// **'You can cancel anytime with no cancellation fees or long-term commitments. You retain access until the end of your current billing period.'**
  String get faqA27;

  /// FAQ question 28
  ///
  /// In en, this message translates to:
  /// **'Do you offer team or volume discounts?'**
  String get faqQ28;

  /// FAQ answer 28
  ///
  /// In en, this message translates to:
  /// **'Currently, we offer individual subscriptions only. This keeps costs low and ensures everyone has equal access to all features.'**
  String get faqA28;

  /// FAQ question 29
  ///
  /// In en, this message translates to:
  /// **'Isn\'t this just making direct sales more complicated?'**
  String get faqQ29;

  /// FAQ answer 29
  ///
  /// In en, this message translates to:
  /// **'Actually, it simplifies everything! Instead of cold calling strangers or pressuring friends, you\'re building relationships with people who are actively engaged in team building. It removes the guesswork and awkwardness from traditional recruiting.'**
  String get faqA29;

  /// FAQ question 30
  ///
  /// In en, this message translates to:
  /// **'What if people think this is \"another MLM thing\"?'**
  String get faqQ30;

  /// FAQ answer 30
  ///
  /// In en, this message translates to:
  /// **'That\'s why we\'re very clear that Team Build Pro is software, not an opportunity. You\'re inviting people to use a professional tool, not join a business. Many people are more open to trying an app than joining an MLM.'**
  String get faqA30;

  /// FAQ question 31
  ///
  /// In en, this message translates to:
  /// **'How do I explain this to prospects without confusing them?'**
  String get faqQ31;

  /// FAQ answer 31
  ///
  /// In en, this message translates to:
  /// **'Simple: \"It\'s like LinkedIn for direct sales professionals. You build connections, track your team growth, and when you\'re ready to advance your career, opportunities become available.\" Focus on the professional development angle.'**
  String get faqA31;

  /// FAQ question 32
  ///
  /// In en, this message translates to:
  /// **'What if my current company doesn\'t allow outside tools?'**
  String get faqQ32;

  /// FAQ answer 32
  ///
  /// In en, this message translates to:
  /// **'Check your company\'s policies, but most direct sales companies welcome tools that help you build your business. Team Build Pro doesn\'t compete with your company - it feeds qualified prospects into it.'**
  String get faqA32;

  /// FAQ question 33
  ///
  /// In en, this message translates to:
  /// **'How long does it take to see results?'**
  String get faqQ33;

  /// FAQ answer 33
  ///
  /// In en, this message translates to:
  /// **'Direct sales success takes time regardless of tools. However, Team Build Pro users often see team growth within weeks because they\'re focused on relationship building rather than selling. The key is consistent daily activity.'**
  String get faqA33;

  /// FAQ question 34
  ///
  /// In en, this message translates to:
  /// **'What\'s a realistic timeline to build a qualified team?'**
  String get faqQ34;

  /// FAQ answer 34
  ///
  /// In en, this message translates to:
  /// **'This varies greatly by individual effort and market, but our most successful users achieve qualification (4 direct, 20 total) within a few weeks of consistent activity. Remember, you\'re building relationships, not just collecting sign-ups.'**
  String get faqA34;

  /// FAQ question 35
  ///
  /// In en, this message translates to:
  /// **'Do you guarantee results?'**
  String get faqQ35;

  /// FAQ answer 35
  ///
  /// In en, this message translates to:
  /// **'No software can guarantee your business success - that depends on your effort, market, and opportunity. We provide the tools; you provide the work ethic and relationship building skills.'**
  String get faqA35;

  /// FAQ question 36
  ///
  /// In en, this message translates to:
  /// **'Can you share success stories?'**
  String get faqQ36;

  /// FAQ answer 36
  ///
  /// In en, this message translates to:
  /// **'While we maintain user privacy, we can share that our most successful users consistently share their Team Build Pro link, engage with their team daily, and focus on helping others succeed rather than just recruiting.'**
  String get faqA36;

  /// FAQ question 37
  ///
  /// In en, this message translates to:
  /// **'What kind of support do you provide?'**
  String get faqQ37;

  /// FAQ answer 37
  ///
  /// In en, this message translates to:
  /// **'We offer 24/7 customer support via in-app messaging, best practices for team building, and regular feature updates and improvements.'**
  String get faqA37;

  /// FAQ question 38
  ///
  /// In en, this message translates to:
  /// **'What exactly does AI Coach do?'**
  String get faqQ38;

  /// FAQ answer 38
  ///
  /// In en, this message translates to:
  /// **'AI Coach helps you navigate the Team Build Pro app, answers questions about features and qualification requirements, provides team building guidance, and can suggest which app sections to visit for specific tasks.'**
  String get faqA38;

  /// FAQ question 39
  ///
  /// In en, this message translates to:
  /// **'Do you provide training on how to recruit or sell?'**
  String get faqQ39;

  /// FAQ answer 39
  ///
  /// In en, this message translates to:
  /// **'We focus on showing you how to use Team Build Pro effectively. For sales and recruiting training, we recommend working with your sponsor or company\'s training programs.'**
  String get faqA39;

  /// FAQ question 40
  ///
  /// In en, this message translates to:
  /// **'What if I have technical problems?'**
  String get faqQ40;

  /// FAQ answer 40
  ///
  /// In en, this message translates to:
  /// **'Contact our support team through the app or website. Most issues are resolved quickly, and we\'re committed to keeping your team building activities running smoothly.'**
  String get faqA40;

  /// FAQ footer title
  ///
  /// In en, this message translates to:
  /// **'Ready to Transform Your Team Building?'**
  String get faqFooterTitle;

  /// FAQ footer subtitle
  ///
  /// In en, this message translates to:
  /// **'Start your 30-day free trial today and experience the difference professional tools make.'**
  String get faqFooterSubtitle;

  /// FAQ footer contact text
  ///
  /// In en, this message translates to:
  /// **'Questions not answered here? Contact our support team - we\'re here to help you succeed!'**
  String get faqFooterContact;
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
      <String>['de', 'en', 'es', 'pt'].contains(locale.languageCode);

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
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
