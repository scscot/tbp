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
}

/// The translations for English (`en_XA`).
class AppLocalizationsEnXa extends AppLocalizationsEn {
  AppLocalizationsEnXa() : super('en_XA');

  @override
  String get appTitle => '[Ṫḗȧm ßüïld Þrö ÞÞÞÞ]';

  @override
  String get authLoginHeaderTitle => '[Wḗlċömḗ bȧċk ÞÞÞÞ]';

  @override
  String get authLoginLabelEmail => '[Ḗmȧïl ÞÞ]';

  @override
  String get authLoginHintEmail => '[Ḗñtḗr yöür ḗmȧïl ȧddrḗšš ÞÞÞÞÞÞÞ]';

  @override
  String get authLoginEmailRequired => '[Þlḗȧšḗ ḗñtḗr yöür ḗmȧïl ÞÞÞÞÞÞÞ]';

  @override
  String get authLoginEmailInvalid => '[Þlḗȧšḗ ḗñtḗr ȧ vȧlïd ḗmȧïl ÞÞÞÞÞÞÞÞ]';

  @override
  String get authLoginLabelPassword => '[Þȧššwörd ÞÞ]';

  @override
  String get authLoginHintPassword => '[Ḗñtḗr yöür pȧššwörd ÞÞÞÞÞÞ]';

  @override
  String get authLoginPasswordRequired =>
      '[Þlḗȧšḗ ḗñtḗr yöür pȧššwörd ÞÞÞÞÞÞÞÞ]';

  @override
  String authLoginPasswordTooShort(int min) {
    return '[Þȧššwörd müšt bḗ ȧt lḗȧšt $min ċhȧrȧċtḗrš ÞÞÞÞÞÞÞÞÞÞÞÞÞ]';
  }

  @override
  String get authLoginButtonSignIn => '[Šïgñ Ïñ ÞÞ]';

  @override
  String get authLoginNoAccountPrompt => '[Döñ\'t hȧvḗ ȧñ ȧċċöüñt? ÞÞÞÞÞÞÞ]';

  @override
  String get authLoginLinkSignUp => '[Šïgñ Üp ÞÞ]';

  @override
  String authLoginBiometric(String method) {
    return '[Šïgñ ïñ wïth $method ÞÞÞÞÞÞ]';
  }

  @override
  String get authLoginBiometricMethodFace => '[Fȧċḗ ÏD ÞÞ]';

  @override
  String get authLoginBiometricMethodTouch => '[Ṫöüċh ÏD ÞÞ]';

  @override
  String get authLoginBiometricMethodGeneric => '[ßïömḗtrïċš ÞÞÞ]';

  @override
  String get authSignupHeaderTitle => '[Ċrḗȧtḗ yöür ȧċċöüñt ÞÞÞÞÞÞ]';

  @override
  String get authSignupLabelFirstName => '[Fïršt Ñȧmḗ ÞÞÞ]';

  @override
  String get authSignupHintFirstName => '[Ḗñtḗr yöür fïršt ñȧmḗ ÞÞÞÞÞÞ]';

  @override
  String get authSignupFirstNameRequired =>
      '[Þlḗȧšḗ ḗñtḗr yöür fïršt ñȧmḗ ÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupLabelLastName => '[Lȧšt Ñȧmḗ ÞÞÞ]';

  @override
  String get authSignupHintLastName => '[Ḗñtḗr yöür lȧšt ñȧmḗ ÞÞÞÞÞÞ]';

  @override
  String get authSignupLastNameRequired =>
      '[Þlḗȧšḗ ḗñtḗr yöür lȧšt ñȧmḗ ÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupLabelEmail => '[Ḗmȧïl ÞÞ]';

  @override
  String get authSignupHintEmail => '[Ḗñtḗr yöür ḗmȧïl ȧddrḗšš ÞÞÞÞÞÞÞ]';

  @override
  String get authSignupEmailRequired => '[Þlḗȧšḗ ḗñtḗr yöür ḗmȧïl ÞÞÞÞÞÞÞ]';

  @override
  String get authSignupEmailInvalid => '[Þlḗȧšḗ ḗñtḗr ȧ vȧlïd ḗmȧïl ÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupLabelPassword => '[Þȧššwörd ÞÞ]';

  @override
  String get authSignupHintPassword => '[Ċrḗȧtḗ ȧ pȧššwörd ÞÞÞÞÞ]';

  @override
  String get authSignupPasswordRequired => '[Þlḗȧšḗ ḗñtḗr ȧ pȧššwörd ÞÞÞÞÞÞÞ]';

  @override
  String authSignupPasswordTooShort(int min) {
    return '[Þȧššwörd müšt bḗ ȧt lḗȧšt $min ċhȧrȧċtḗrš ÞÞÞÞÞÞÞÞÞÞÞÞÞ]';
  }

  @override
  String get authSignupLabelConfirmPassword => '[Ċöñfïrm Þȧššwörd ÞÞÞÞÞ]';

  @override
  String get authSignupHintConfirmPassword =>
      '[Rḗ-ḗñtḗr yöür pȧššwörd ÞÞÞÞÞÞÞ]';

  @override
  String get authSignupConfirmPasswordRequired =>
      '[Þlḗȧšḗ ċöñfïrm yöür pȧššwörd ÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupPasswordMismatch => '[Þȧššwördš döñ\'t mȧtċh ÞÞÞÞÞÞ]';

  @override
  String get authSignupLabelReferralCode =>
      '[Rḗfḗrrȧl Ċödḗ (Öptïöñȧl) ÞÞÞÞÞÞÞ]';

  @override
  String get authSignupHintReferralCode =>
      '[Ḗñtḗr ïñvïtḗ ċödḗ ïf yöü hȧvḗ öñḗ ÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupButtonPasteCode => '[Þȧštḗ ÞÞ]';

  @override
  String get authSignupTosConsent =>
      '[ßy ċöñtïñüïñg, yöü ȧgrḗḗ tö thḗ Ṫḗrmš öf Šḗrvïċḗ ȧñd Þrïvȧċy Þölïċy ÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupTermsShort => '[Ṫḗrmš öf Šḗrvïċḗ ÞÞÞÞÞ]';

  @override
  String get authSignupPrivacyShort => '[Þrïvȧċy Þölïċy ÞÞÞÞ]';

  @override
  String get authSignupTosRequired =>
      '[Yöü müšt ȧċċḗpt thḗ tḗrmš tö ċöñtïñüḗ ÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authSignupButtonCreateAccount => '[Ċrḗȧtḗ Ȧċċöüñt ÞÞÞÞ]';

  @override
  String get authSignupHaveAccountPrompt =>
      '[Ȧlrḗȧdy hȧvḗ ȧñ ȧċċöüñt? ÞÞÞÞÞÞÞ]';

  @override
  String get authSignupLinkSignIn => '[Šïgñ Ïñ ÞÞ]';

  @override
  String get authPasswordShow => '[Šhöw pȧššwörd ÞÞÞÞ]';

  @override
  String get authPasswordHide => '[Hïdḗ pȧššwörd ÞÞÞÞ]';

  @override
  String get authErrorInvalidEmail =>
      '[Ṫhȧt ḗmȧïl ïšñ\'t vȧlïd. Þlḗȧšḗ ċhḗċk ȧñd try ȧgȧïñ. ÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorUserDisabled =>
      '[Ṫhïš ȧċċöüñt hȧš bḗḗñ dïšȧblḗd. Þlḗȧšḗ ċöñtȧċt šüppört. ÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorUserNotFound =>
      '[Ñö ȧċċöüñt föüñd wïth thȧt ḗmȧïl. ÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorWrongPassword =>
      '[Ïñċörrḗċt pȧššwörd. Þlḗȧšḗ try ȧgȧïñ. ÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorEmailInUse =>
      '[Ȧñ ȧċċöüñt wïth thȧt ḗmȧïl ȧlrḗȧdy ḗxïštš. ÞÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorWeakPassword =>
      '[Þlḗȧšḗ ċhööšḗ ȧ štröñgḗr pȧššwörd. ÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorNetworkError =>
      '[Ñḗtwörk ḗrrör. Þlḗȧšḗ ċhḗċk yöür ċöññḗċtïöñ. ÞÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorTooMany =>
      '[Ṫöö mȧñy ȧttḗmptš. Þlḗȧšḗ wȧït ȧ mömḗñt. ÞÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorInvalidCredential =>
      '[Ṫhöšḗ dḗtȧïlš döñ\'t mȧtċh öür rḗċördš. ÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get authErrorUnknown =>
      '[Ȧñ ḗrrör öċċürrḗd. Þlḗȧšḗ try ȧgȧïñ. ÞÞÞÞÞÞÞÞÞÞÞ]';

  @override
  String get navHome => '[Hömḗ Þ]';

  @override
  String get navTeam => '[Ṫḗȧm Þ]';

  @override
  String get navShare => '[Šhȧrḗ ÞÞ]';

  @override
  String get navMessages => '[Mḗššȧgḗš ÞÞ]';

  @override
  String get navNotices => '[Ñötïċḗš ÞÞ]';

  @override
  String get navProfile => '[Þröfïlḗ ÞÞ]';

  @override
  String get dashTitle => '[Ċöñtröl Ċḗñtḗr ÞÞÞÞ]';

  @override
  String get dashKpiDirectSponsors => '[Dïrḗċt Špöñšörš ÞÞÞÞÞ]';

  @override
  String get dashKpiTotalTeam => '[Ṫötȧl Ṫḗȧm Mḗmbḗrš ÞÞÞÞÞ]';

  @override
  String get dashStatsRefreshed => '[Ṫḗȧm štȧtš rḗfrḗšhḗd ÞÞÞÞÞÞ]';

  @override
  String dashStatsError(String error) {
    return '[Ḗrrör rḗfrḗšhïñg štȧtš: $error ÞÞÞÞÞÞÞÞÞ]';
  }

  @override
  String get dashTileGettingStarted => '[Gḗttïñg Štȧrtḗd ÞÞÞÞÞ]';

  @override
  String get dashTileOpportunity => '[Öppörtüñïty Dḗtȧïlš ÞÞÞÞÞÞ]';

  @override
  String get dashTileEligibility => '[Yöür Ḗlïgïbïlïty Štȧtüš ÞÞÞÞÞÞÞ]';

  @override
  String get dashTileGrowTeam => '[Gröw Yöür Ṫḗȧm ÞÞÞÞ]';

  @override
  String get dashTileViewTeam => '[Vïḗw Yöür Ṫḗȧm ÞÞÞÞ]';

  @override
  String get dashTileAiCoach => '[Yöür ȦÏ Ċöȧċh ÞÞÞÞ]';

  @override
  String get dashTileMessageCenter => '[Mḗššȧgḗ Ċḗñtḗr ÞÞÞÞ]';

  @override
  String get dashTileNotifications => '[Ñötïfïċȧtïöñš ÞÞÞÞ]';

  @override
  String get dashTileHowItWorks => '[Höw Ït Wörkš ÞÞÞÞ]';

  @override
  String get dashTileFaqs => '[FȦQ\'š ÞÞ]';

  @override
  String get dashTileProfile => '[Vïḗw Yöür Þröfïlḗ ÞÞÞÞÞ]';

  @override
  String get dashTileCreateAccount => '[Ċrḗȧtḗ Ñḗw Ȧċċöüñt ÞÞÞÞÞ]';
}
