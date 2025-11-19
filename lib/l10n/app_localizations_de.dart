// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appTitle => 'Team Build Pro';

  @override
  String get authLoginHeaderTitle => 'Willkommen zurück';

  @override
  String get authLoginLabelEmail => 'E-Mail';

  @override
  String get authLoginHintEmail => 'Geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get authLoginEmailRequired =>
      'Bitte geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get authLoginEmailInvalid =>
      'Bitte geben Sie eine gültige E-Mail-Adresse ein';

  @override
  String get authLoginLabelPassword => 'Passwort';

  @override
  String get authLoginHintPassword => 'Geben Sie Ihr Passwort ein';

  @override
  String get authLoginPasswordRequired => 'Bitte geben Sie Ihr Passwort ein';

  @override
  String authLoginPasswordTooShort(int min) {
    return 'Das Passwort muss mindestens $min Zeichen lang sein';
  }

  @override
  String get authLoginButtonSignIn => 'Anmelden';

  @override
  String get authLoginNoAccountPrompt => 'Sie haben noch kein Konto?';

  @override
  String get authLoginLinkSignUp => 'Registrieren';

  @override
  String authLoginBiometric(String method) {
    return 'Anmelden mit $method';
  }

  @override
  String get authLoginBiometricMethodFace => 'Face ID';

  @override
  String get authLoginBiometricMethodTouch => 'Touch ID';

  @override
  String get authLoginBiometricMethodGeneric => 'Biometrie';

  @override
  String get authSignupHeaderTitle => 'Erstellen Sie Ihr Konto';

  @override
  String get authSignupLabelFirstName => 'Vorname';

  @override
  String get authSignupHintFirstName => 'Geben Sie Ihren Vornamen ein';

  @override
  String get authSignupFirstNameRequired =>
      'Bitte geben Sie Ihren Vornamen ein';

  @override
  String get authSignupLabelLastName => 'Nachname';

  @override
  String get authSignupHintLastName => 'Geben Sie Ihren Nachnamen ein';

  @override
  String get authSignupLastNameRequired =>
      'Bitte geben Sie Ihren Nachnamen ein';

  @override
  String get authSignupLabelEmail => 'E-Mail';

  @override
  String get authSignupHintEmail => 'Geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get authSignupEmailRequired =>
      'Bitte geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get authSignupEmailInvalid =>
      'Bitte geben Sie eine gültige E-Mail-Adresse ein';

  @override
  String get authSignupLabelPassword => 'Passwort';

  @override
  String get authSignupHintPassword => 'Erstellen Sie ein Passwort';

  @override
  String get authSignupPasswordRequired => 'Bitte geben Sie ein Passwort ein';

  @override
  String authSignupPasswordTooShort(int min) {
    return 'Das Passwort muss mindestens $min Zeichen lang sein';
  }

  @override
  String get authSignupLabelConfirmPassword => 'Passwort bestätigen';

  @override
  String get authSignupHintConfirmPassword =>
      'Geben Sie Ihr Passwort erneut ein';

  @override
  String get authSignupConfirmPasswordRequired =>
      'Bitte bestätigen Sie Ihr Passwort';

  @override
  String get authSignupPasswordMismatch =>
      'Die Passwörter stimmen nicht überein';

  @override
  String get authSignupLabelReferralCode => 'Empfehlungscode (Optional)';

  @override
  String get authSignupHintReferralCode =>
      'Geben Sie einen Einladungscode ein, falls vorhanden';

  @override
  String get authSignupButtonPasteCode => 'Einfügen';

  @override
  String get authSignupTosConsent =>
      'Mit der Fortsetzung stimmen Sie den Nutzungsbedingungen und der Datenschutzerklärung zu';

  @override
  String get authSignupTermsShort => 'Nutzungsbedingungen';

  @override
  String get authSignupPrivacyShort => 'Datenschutzerklärung';

  @override
  String get authSignupTosRequired =>
      'Sie müssen den Bedingungen zustimmen, um fortzufahren';

  @override
  String get authSignupButtonCreateAccount => 'Konto erstellen';

  @override
  String get authSignupHaveAccountPrompt => 'Sie haben bereits ein Konto?';

  @override
  String get authSignupLinkSignIn => 'Anmelden';

  @override
  String get authPasswordShow => 'Passwort anzeigen';

  @override
  String get authPasswordHide => 'Passwort verbergen';

  @override
  String get authErrorInvalidEmail =>
      'Diese E-Mail-Adresse ist ungültig. Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.';

  @override
  String get authErrorUserDisabled =>
      'Dieses Konto wurde deaktiviert. Bitte kontaktieren Sie den Support.';

  @override
  String get authErrorUserNotFound =>
      'Es wurde kein Konto mit dieser E-Mail-Adresse gefunden.';

  @override
  String get authErrorWrongPassword =>
      'Falsches Passwort. Bitte versuchen Sie es erneut.';

  @override
  String get authErrorEmailInUse =>
      'Ein Konto mit dieser E-Mail-Adresse existiert bereits.';

  @override
  String get authErrorWeakPassword =>
      'Bitte wählen Sie ein stärkeres Passwort.';

  @override
  String get authErrorNetworkError =>
      'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.';

  @override
  String get authErrorTooMany =>
      'Zu viele Versuche. Bitte warten Sie einen Moment.';

  @override
  String get authErrorInvalidCredential =>
      'Diese Angaben stimmen nicht mit unseren Aufzeichnungen überein.';

  @override
  String get authErrorUnknown =>
      'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';

  @override
  String get navHome => 'Startseite';

  @override
  String get navTeam => 'Team';

  @override
  String get navShare => 'Teilen';

  @override
  String get navMessages => 'Nachrichten';

  @override
  String get navNotices => 'Hinweise';

  @override
  String get navProfile => 'Profil';

  @override
  String get dashTitle => 'Kontrollzentrum';

  @override
  String get dashKpiDirectSponsors => 'Direkte Sponsoren';

  @override
  String get dashKpiTotalTeam => 'Gesamte Teammitglieder';

  @override
  String get dashStatsRefreshed => 'Teamstatistiken aktualisiert';

  @override
  String dashStatsError(String error) {
    return 'Fehler beim Aktualisieren der Statistiken: $error';
  }

  @override
  String get dashTileGettingStarted => 'Erste Schritte';

  @override
  String get dashTileOpportunity => 'Details zur Geschäftsmöglichkeit';

  @override
  String get dashTileEligibility => 'Ihr Berechtigungsstatus';

  @override
  String get dashTileGrowTeam => 'Bauen Sie Ihr Team auf';

  @override
  String get dashTileViewTeam => 'Zeigen Sie Ihr Team an';

  @override
  String get dashTileAiCoach => 'Ihr KI-Coach';

  @override
  String get dashTileMessageCenter => 'Nachrichtenzentrale';

  @override
  String get dashTileNotifications => 'Benachrichtigungen';

  @override
  String get dashTileHowItWorks => 'So funktioniert es';

  @override
  String get dashTileFaqs => 'Häufige Fragen';

  @override
  String get dashTileProfile => 'Zeigen Sie Ihr Profil an';

  @override
  String get dashTileCreateAccount => 'Neues Konto erstellen';

  @override
  String recruitT01FirstTouch(String prospectName, String senderFirst,
      String companyName, String shortLink) {
    return 'Hallo $prospectName, hier ist $senderFirst. Ich verwende eine App, um Freunden beim Start mit $companyName zu helfen. Kurzer Blick? $shortLink';
  }

  @override
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink) {
    return 'Hallo, hier ist $senderFirst. Ich verwende eine App, um Freunden beim Start mit $companyName zu helfen. Kurzer Blick? $shortLink';
  }

  @override
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink) {
    return 'Hallo $prospectName! Ich melde mich bezüglich $companyName. Ich habe diese Woche großartige Ergebnisse gesehen. Haben Sie Zeit für ein kurzes Gespräch? $shortLink';
  }

  @override
  String recruitT03DeadlineNudge(
      String prospectName, String companyName, String shortLink) {
    return '$prospectName, die Plätze für unseren $companyName-Start füllen sich. Soll ich einen für Sie reservieren? $shortLink';
  }

  @override
  String recruitT04TeamNeeded(int remaining) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'Sie sind nur noch # Personen von einem starken Start entfernt.',
      one: 'Sie sind nur noch # Person von einem starken Start entfernt.',
      zero: 'Sie sind startbereit.',
    );
    return '$_temp0';
  }

  @override
  String recruitT05MilestoneReached(String prospectName, String companyName) {
    return '🎉 $prospectName, Sie haben Ihren ersten Meilenstein mit $companyName erreicht! Ihr Team wächst. Machen Sie weiter so!';
  }

  @override
  String recruitT06WelcomeOnboard(
      String prospectName, String senderFirst, String inviteLink) {
    return 'Willkommen, $prospectName! Ich bin $senderFirst und helfe Ihnen gerne. Lassen Sie uns beginnen: $inviteLink';
  }

  @override
  String recruitT07WeeklyCheckIn(String prospectName, String companyName) {
    return 'Hallo $prospectName, kurzer Check-in zu $companyName. Wie läuft es? Gibt es Fragen, bei denen ich helfen kann?';
  }

  @override
  String recruitT08Deadline(int days, String shortLink) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '# Tagen',
      one: '# Tag',
    );
    return 'Wir starten in $_temp0. Soll ich Ihren Platz reservieren? $shortLink';
  }

  @override
  String recruitT09ResourceShare(
      String prospectName, String companyName, String inviteLink) {
    return '$prospectName, ich habe dies hilfreich für $companyName gefunden. Ich dachte, Sie möchten es sehen: $inviteLink';
  }

  @override
  String recruitT10InviteReminder(
      String prospectName, String companyName, String shortLink) {
    return 'Hallo $prospectName, Sie haben noch eine ausstehende Einladung für $companyName. Bereit beizutreten? $shortLink';
  }

  @override
  String recruitT11TeamGrowth(String prospectName, String companyName) {
    return 'Großartige Neuigkeiten, $prospectName! Ihr $companyName-Team ist diese Woche gewachsen. Sie machen echte Fortschritte!';
  }

  @override
  String recruitT12Encouragement(String prospectName, String companyName) {
    return '$prospectName, der Aufbau mit $companyName braucht Zeit. Sie machen das großartig. Bleiben Sie dran!';
  }

  @override
  String recruitT13TrainingInvite(
      String prospectName, String companyName, String inviteLink) {
    return 'Hallo $prospectName, wir haben bald eine $companyName-Schulung. Möchten Sie teilnehmen? $inviteLink';
  }

  @override
  String recruitT14QuickWin(String prospectName, String companyName) {
    return 'Gut gemacht, $prospectName! Das war ein solider Erfolg mit $companyName. Lassen Sie uns die Dynamik beibehalten!';
  }

  @override
  String recruitT15SupportOffer(String prospectName, String companyName) {
    return 'Hallo $prospectName, ich bin hier, falls Sie Hilfe mit $companyName benötigen. Melden Sie sich jederzeit.';
  }

  @override
  String recruitT16Gratitude(String prospectName, String companyName) {
    return 'Danke, dass Sie Teil unseres $companyName-Teams sind, $prospectName. Ihre Energie macht einen Unterschied!';
  }

  @override
  String get notifMilestoneDirectTitle => '🎉 Erstaunlicher Fortschritt!';

  @override
  String notifMilestoneDirectBody(
      String firstName, int directCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'mitglieder',
      one: 'mitglied',
    );
    return 'Herzlichen Glückwunsch, $firstName! Sie haben $directCount direkte Sponsoren erreicht! Nur noch $remaining weitere Team$_temp0 benötigt, um Ihre $bizName-Einladung freizuschalten. Bauen Sie weiter!';
  }

  @override
  String get notifMilestoneTeamTitle => '🚀 Unglaubliches Wachstum!';

  @override
  String notifMilestoneTeamBody(
      String firstName, int teamCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'Sponsoren',
      one: 'Sponsor',
    );
    return 'Erstaunlicher Fortschritt, $firstName! Sie haben ein Team von $teamCount aufgebaut! Nur noch $remaining direkte $_temp0 benötigt, um sich für $bizName zu qualifizieren. Sie sind so nah!';
  }

  @override
  String get notifSubActiveTitle => '✅ Abonnement aktiv';

  @override
  String notifSubActiveBody(String expiryDate) {
    return 'Ihr Abonnement ist jetzt bis $expiryDate aktiv.';
  }

  @override
  String get notifSubCancelledTitle => '⚠️ Abonnement gekündigt';

  @override
  String notifSubCancelledBody(String expiryDate) {
    return 'Ihr Abonnement wurde gekündigt, bleibt aber bis $expiryDate aktiv.';
  }

  @override
  String get notifSubExpiredTitle => '❌ Abonnement abgelaufen';

  @override
  String get notifSubExpiredBody =>
      'Ihr Abonnement ist abgelaufen. Verlängern Sie jetzt, um weiterhin Ihr Team aufzubauen und auf alle Recruiting-Tools zuzugreifen.';

  @override
  String get notifSubExpiringSoonTitle => '⏰ Abonnement läuft bald ab';

  @override
  String notifSubExpiringSoonBody(String expiryDate) {
    return 'Ihr Abonnement läuft am $expiryDate ab. Verlängern Sie jetzt, um Unterbrechungen zu vermeiden.';
  }

  @override
  String get notifSubPausedTitle => '⏸️ Abonnement pausiert';

  @override
  String get notifSubPausedBody =>
      'Ihr Abonnement wurde pausiert. Setzen Sie im Play Store fort, um den Zugriff auf alle Funktionen wiederherzustellen.';

  @override
  String get notifSubPaymentIssueTitle => '⚠️ Zahlungsproblem';

  @override
  String get notifSubPaymentIssueBody =>
      'Ihr Abonnement ist aufgrund eines Zahlungsproblems zurückgestellt. Bitte aktualisieren Sie Ihre Zahlungsmethode im Play Store.';

  @override
  String notifNewMessageTitle(String senderName) {
    return 'Neue Nachricht von $senderName';
  }

  @override
  String get notifTeamActivityTitle => '👀 Teammitglied-Aktivität';

  @override
  String notifTeamActivityBody(String visitorName) {
    return '$visitorName hat die Geschäftsmöglichkeitsseite besucht!';
  }

  @override
  String get notifLaunchSentTitle => 'Startkampagne gesendet';

  @override
  String get notifLaunchSentBody =>
      'Ihre Startkampagne wurde erfolgreich an Ihr Netzwerk gesendet.';

  @override
  String get emptyNotifications => 'Noch keine Benachrichtigungen.';

  @override
  String get emptyMessageContent => 'Kein Nachrichteninhalt.';

  @override
  String get emptyNotificationTitle => 'Kein Titel';

  @override
  String get emptyMessageThreads => 'Keine Nachrichtenverläufe gefunden.';

  @override
  String get emptyTeamMember => 'Teammitglied nicht gefunden.';

  @override
  String get errorLoadingNotifications =>
      'Fehler beim Laden der Benachrichtigungen';

  @override
  String errorGeneric(String error) {
    return 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.';
  }

  @override
  String get dashKpiTitle => 'Ihre aktuellen Teamstatistiken';

  @override
  String get dashKpiRefreshTooltip => 'Teamstatistiken aktualisieren';

  @override
  String get dashTileJoinOpportunity => 'Geschäftsmöglichkeit beitreten!';

  @override
  String dashSubscriptionTrial(int daysLeft) {
    return 'Abonnement starten\n($daysLeft Tage in der Testphase verbleibend)';
  }

  @override
  String get dashSubscriptionExpired =>
      'Verlängern Sie Ihr Abonnement\n30-tägige kostenlose Testphase abgelaufen.';

  @override
  String get dashSubscriptionCancelled =>
      'Sie haben Ihr Abonnement gekündigt\nReaktivieren Sie Ihr Abonnement jetzt';

  @override
  String get dashSubscriptionManage => 'Abonnement verwalten';

  @override
  String get networkTitle => 'Netzwerk';

  @override
  String get networkLabelDirectSponsors => 'Direkte Sponsoren';

  @override
  String get networkLabelTotalTeam => 'Gesamtes Team';

  @override
  String get networkLabelNewMembers => 'Neue Mitglieder';

  @override
  String get networkSearchHint => 'Netzwerk durchsuchen...';

  @override
  String get networkRefreshTooltip => 'Daten aktualisieren erzwingen';

  @override
  String get networkFilterSelectReport => 'Teambericht anzeigen';

  @override
  String get networkFilterAllMembers => 'Alle Mitglieder';

  @override
  String get networkFilterDirectSponsors => 'Direkte Sponsoren';

  @override
  String get networkFilterNewMembers => 'Neue Mitglieder - Heute';

  @override
  String get networkFilterNewMembersYesterday => 'Neue Mitglieder - Gestern';

  @override
  String get networkFilterQualified => 'Qualifizierte Mitglieder';

  @override
  String get networkFilterJoined => 'Beigetreten';

  @override
  String networkFilterAllMembersWithCount(int count) {
    return 'Alle Mitglieder ($count)';
  }

  @override
  String networkFilterDirectSponsorsWithCount(int count) {
    return 'Direkte Sponsoren ($count)';
  }

  @override
  String networkFilterNewMembersWithCount(int count) {
    return 'Neue Mitglieder - Heute ($count)';
  }

  @override
  String networkFilterNewMembersYesterdayWithCount(int count) {
    return 'Neue Mitglieder - Gestern ($count)';
  }

  @override
  String networkFilterQualifiedWithCount(int count) {
    return 'Qualifizierte Mitglieder ($count)';
  }

  @override
  String networkFilterJoinedWithCount(String business, int count) {
    return '$business beigetreten ($count)';
  }

  @override
  String get networkMessageSelectReport =>
      'Wählen Sie einen Bericht aus dem Dropdown-Menü oben aus oder verwenden Sie die Suchleiste, um Ihr Team anzuzeigen und zu verwalten.';

  @override
  String get networkMessageNoSearchResults =>
      'Suchergebnisse aus Alle Mitglieder werden angezeigt. Keine Mitglieder entsprechen Ihrer Suche.';

  @override
  String get networkMessageNoMembers =>
      'Keine Mitglieder für diesen Filter gefunden.';

  @override
  String get networkSearchingContext => 'Suchen in: Alle Mitglieder';

  @override
  String get networkSearchingContextInfo =>
      'Suchergebnisse aus Alle Mitglieder werden angezeigt';

  @override
  String networkPaginationInfo(int showing, int total) {
    return '$showing von $total Mitgliedern werden angezeigt';
  }

  @override
  String networkLevelLabel(int level) {
    return 'Ebene $level';
  }

  @override
  String networkMembersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Mitglieder',
      one: '$count Mitglied',
    );
    return '$_temp0';
  }

  @override
  String get networkLoadingMore => 'Weitere Mitglieder werden geladen...';

  @override
  String networkLoadMoreButton(int remaining) {
    return 'Weitere Mitglieder laden ($remaining verbleibend)';
  }

  @override
  String networkAllMembersLoaded(int count) {
    return 'Alle $count Mitglieder geladen';
  }

  @override
  String networkMemberJoined(String date) {
    return 'Beigetreten am $date';
  }

  @override
  String get networkAnalyticsPerformance => 'Netzwerk-Performance';

  @override
  String get networkAnalyticsGeographic => 'Geografische Verteilung';

  @override
  String get networkAnalyticsLevels => 'Ebenenverteilung';

  @override
  String get networkAnalyticsChartPlaceholder =>
      'Performance-Diagramm\n(Diagrammimplementierung würde hier erscheinen)';

  @override
  String networkLevelBadge(int level) {
    return 'Ebene $level';
  }

  @override
  String networkLevelMembersCount(int count) {
    return '$count Mitglieder';
  }

  @override
  String get settingsTitle => 'Einstellungen';

  @override
  String get settingsTitleOrganization => 'Organisationseinstellungen';

  @override
  String settingsWelcomeMessage(String name) {
    return 'Willkommen $name!\n\nLassen Sie uns das Fundament für Ihre Geschäftsmöglichkeit einrichten.';
  }

  @override
  String get settingsLabelOrganizationName => 'Ihr Organisationsname';

  @override
  String get settingsLabelConfirmOrganizationName =>
      'Organisationsnamen bestätigen';

  @override
  String get settingsDialogImportantTitle => 'Sehr wichtig!';

  @override
  String settingsDialogReferralImportance(String organization) {
    return 'Sie müssen den genauen Empfehlungslink eingeben, den Sie von Ihrem $organization-Sponsor erhalten haben.';
  }

  @override
  String get settingsDialogButtonUnderstand => 'Ich verstehe';

  @override
  String get settingsLabelReferralLink => 'Ihr Empfehlungslink';

  @override
  String get settingsLabelConfirmReferralLink =>
      'Empfehlungslink-URL bestätigen';

  @override
  String get settingsLabelCountries => 'Verfügbare Länder';

  @override
  String get settingsImportantLabel => 'Wichtig:';

  @override
  String get settingsCountriesInstruction =>
      'Wählen Sie nur die Länder aus, in denen Ihre Geschäftsmöglichkeit derzeit verfügbar ist.';

  @override
  String get settingsButtonAddCountry => 'Land hinzufügen';

  @override
  String get settingsButtonSave => 'Einstellungen speichern';

  @override
  String get settingsDisplayOrganization => 'Ihre Organisation';

  @override
  String get settingsDisplayReferralLink => 'Ihr Empfehlungslink';

  @override
  String get settingsDisplayCountries => 'Ausgewählte verfügbare Länder';

  @override
  String get settingsNoCountries => 'Keine Länder ausgewählt.';

  @override
  String get settingsFeederSystemTitle => 'Netzwerk-Feeder-System';

  @override
  String get settingsFeederSystemDescription =>
      'Dies ist Ihr automatisierter Wachstumsmotor. Wenn Mitglieder Team Build Pro über Ihren Link beitreten, aber sich noch nicht für Ihre Geschäftsmöglichkeit qualifiziert haben, werden sie in Ihr Feeder-Netzwerk aufgenommen. In dem Moment, in dem Sie die unten stehenden Berechtigungsanforderungen erfüllen, werden diese Mitglieder automatisch in Ihr Geschäftsmöglichkeits-Team übertragen. Es ist ein leistungsstarkes System, das Ihr Engagement belohnt - je größer Ihr Feeder-Netzwerk wächst, desto stärker wird Ihr Start sein, wenn Sie sich qualifizieren.';

  @override
  String get settingsEligibilityTitle => 'Mindestberechtigungsanforderungen';

  @override
  String get settingsEligibilityDirectSponsors => 'Direkte Sponsoren';

  @override
  String get settingsEligibilityTotalTeam => 'Gesamte Mitglieder';

  @override
  String get settingsPrivacyLegalTitle => 'Datenschutz & Rechtliches';

  @override
  String get settingsPrivacyPolicy => 'Datenschutzerklärung';

  @override
  String get settingsPrivacyPolicySubtitle =>
      'Sehen Sie unsere Datenschutzpraktiken und Datenverarbeitung ein';

  @override
  String get settingsTermsOfService => 'Nutzungsbedingungen';

  @override
  String get settingsTermsOfServiceSubtitle =>
      'Sehen Sie unsere Plattformbedingungen ein';

  @override
  String get profileTitle => 'Profil';

  @override
  String get profileLabelCity => 'Stadt';

  @override
  String get profileLabelState => 'Bundesland';

  @override
  String get profileLabelCountry => 'Land';

  @override
  String get profileLabelJoined => 'Beigetreten';

  @override
  String get profileLabelSponsor => 'Ihr Sponsor';

  @override
  String get profileLabelTeamLeader => 'Teamleiter';

  @override
  String get profileButtonEdit => 'Profil bearbeiten';

  @override
  String get profileButtonSignOut => 'Abmelden';

  @override
  String get profileSigningOut => 'Wird abgemeldet...';

  @override
  String get profileButtonTerms => 'Nutzungsbedingungen';

  @override
  String get profileButtonPrivacy => 'Datenschutzerklärung';

  @override
  String get profileButtonDeleteAccount => 'Konto löschen';

  @override
  String get profileDemoAccountTitle => 'Demo-Konto-Informationen';

  @override
  String get profileDemoAccountMessage =>
      'Dies ist ein Demo-Konto zu Testzwecken und kann nicht gelöscht werden.';

  @override
  String get profileDemoAccountSubtext =>
      'Demo-Konten werden bereitgestellt, um die Funktionen und Funktionalität der App zu präsentieren. Wenn Sie ein echtes Konto erstellen müssen, registrieren Sie sich bitte mit Ihren persönlichen Daten.';

  @override
  String get profileDemoAccountButton => 'Ich verstehe';

  @override
  String get profileAdminProtectionTitle => 'Administratorkonto-Schutz';

  @override
  String get profileAdminProtectionMessage =>
      'Administratorkonten mit aktiven Teammitgliedern können nicht über die App gelöscht werden. Dieser Schutz stellt sicher, dass die Daten und Beziehungen Ihres Teams intakt bleiben.';

  @override
  String profileAdminTeamSize(int directCount) {
    return 'Ihr Team: $directCount Direkte Sponsoren';
  }

  @override
  String get profileAdminProtectionInstructions =>
      'Um Ihr Administratorkonto zu löschen, wenden Sie sich bitte an unser Support-Team unter legal@teambuildpro.com. Wir arbeiten mit Ihnen zusammen, um einen reibungslosen Übergang für Ihre Teammitglieder zu gewährleisten.';

  @override
  String get profileAdminProtectionContact => 'Kontakt: legal@teambuildpro.com';

  @override
  String get messageCenterTitle => 'Nachrichten';

  @override
  String get messageCenterSearchHint => 'Nachrichten durchsuchen...';

  @override
  String get messageCenterFilterAll => 'Alle';

  @override
  String get messageCenterFilterUnread => 'Ungelesen';

  @override
  String get messageCenterFilterTeam => 'Team';

  @override
  String get messageCenterNewThread => 'Neue Nachricht';

  @override
  String get messageCenterEmptyState => 'Keine Nachrichten';

  @override
  String get messageCenterNotLoggedIn =>
      'Bitte melden Sie sich an, um Nachrichten zu sehen.';

  @override
  String get messageCenterSponsorLabel => 'Ihr Sponsor';

  @override
  String get messageCenterTeamLeaderLabel => 'Teamleiter';

  @override
  String get messageCenterSupportTeamTitle => 'Ihr Support-Team';

  @override
  String get messageCenterSupportTeamSubtitle =>
      'Tippen Sie, um ein Gespräch zu beginnen';

  @override
  String get messageCenterError => 'Fehler beim Laden der Nachrichten';

  @override
  String get messageCenterLoadingChat => 'Chat wird geladen...';

  @override
  String get messageCenterErrorLoadingUser =>
      'Fehler beim Laden der Benutzerdetails';

  @override
  String get messageCenterUnknownUser => 'Unbekannter Benutzer';

  @override
  String messageCenterUnreadBadge(int count) {
    return '$count neu';
  }

  @override
  String messageCenterLastMessage(String time) {
    return 'Letzte Nachricht vor $time';
  }

  @override
  String get notificationsTitle => 'Benachrichtigungen';

  @override
  String get notificationsFilterAll => 'Alle';

  @override
  String get notificationsFilterUnread => 'Ungelesen';

  @override
  String get notificationsFilterMilestones => 'Meilensteine';

  @override
  String get notificationsFilterTeam => 'Team';

  @override
  String get notificationsMarkAllRead => 'Alle als gelesen markieren';

  @override
  String get notificationsClearAll => 'Alle löschen';

  @override
  String get notificationsEmptyState => 'Keine Benachrichtigungen';

  @override
  String get notificationsTimeNow => 'Gerade eben';

  @override
  String notificationsTimeMinutes(int minutes) {
    return 'vor ${minutes}m';
  }

  @override
  String notificationsTimeHours(int hours) {
    return 'vor ${hours}h';
  }

  @override
  String notificationsTimeDays(int days) {
    return 'vor ${days}d';
  }

  @override
  String get gettingStartedTitle => 'Erste Schritte';

  @override
  String get gettingStartedWelcome => 'Willkommen bei Team Build Pro!';

  @override
  String get gettingStartedIntro =>
      'Lassen Sie uns Sie für den Erfolg einrichten. Diese kurze Anleitung führt Sie durch die wesentlichen Funktionen, um mit dem Aufbau Ihres Teams zu beginnen.';

  @override
  String get gettingStartedStep1Title => 'Vervollständigen Sie Ihr Profil';

  @override
  String get gettingStartedStep2Title => 'Teilen Sie Ihren Link';

  @override
  String get gettingStartedStep3Title => 'Verfolgen Sie Ihren Fortschritt';

  @override
  String get gettingStartedStep3Description =>
      'Überwachen Sie Ihr Teamwachstum im Dashboard und sehen Sie Ihren Fortschritt in Richtung Berechtigung.';

  @override
  String get gettingStartedStep4Title => 'Binden Sie Ihr Team ein';

  @override
  String get gettingStartedStep4Description =>
      'Verwenden Sie die Nachrichtenzentrale, um mit Ihrem Team zu kommunizieren und Unterstützung zu bieten.';

  @override
  String get gettingStartedButtonStart => 'Erste Schritte';

  @override
  String get gettingStartedButtonNext => 'Weiter';

  @override
  String get gettingStartedButtonBack => 'Zurück';

  @override
  String get gettingStartedButtonSkip => 'Überspringen';

  @override
  String get welcomeTitle => 'Willkommen!';

  @override
  String get welcomeHeadline =>
      'Bauen Sie Ihr Team auf.\nLassen Sie Ihr Geschäft wachsen.';

  @override
  String get welcomeSubheadline =>
      'Die professionelle Plattform für Teamaufbau und Netzwerkwachstum';

  @override
  String get welcomeButtonSignIn => 'Anmelden';

  @override
  String get welcomeButtonSignUp => 'Konto erstellen';

  @override
  String get welcomeFeature1Title => 'Intelligente Teamverfolgung';

  @override
  String get welcomeFeature1Description =>
      'Überwachen Sie Ihr Teamwachstum in Echtzeit mit leistungsstarken Analysen';

  @override
  String get welcomeFeature2Title => 'Automatisiertes Wachstum';

  @override
  String get welcomeFeature2Description =>
      'Das Netzwerk-Feeder-System überträgt automatisch qualifizierte Mitglieder';

  @override
  String get welcomeFeature3Title => 'Sichere Nachrichten';

  @override
  String get welcomeFeature3Description =>
      'Kommunizieren Sie sicher mit Ihrem Team durch verschlüsselte Nachrichten';

  @override
  String get addLinkTitle => 'Link hinzufügen';

  @override
  String get addLinkDescription =>
      'Fügen Sie Ihren Geschäftsmöglichkeits-Link hinzu, um mit dem Aufbau Ihres Teams zu beginnen';

  @override
  String get addLinkLabelUrl => 'Geschäftsmöglichkeits-URL';

  @override
  String get addLinkHintUrl =>
      'Geben Sie die vollständige URL zu Ihrer Geschäftsmöglichkeitsseite ein';

  @override
  String get addLinkUrlRequired => 'Bitte geben Sie eine URL ein';

  @override
  String get addLinkUrlInvalid => 'Bitte geben Sie eine gültige URL ein';

  @override
  String get addLinkButtonSave => 'Link speichern';

  @override
  String get addLinkButtonTest => 'Link testen';

  @override
  String get addLinkSuccessMessage => 'Geschäftslink erfolgreich gespeichert!';

  @override
  String get addLinkErrorMessage =>
      'Fehler beim Speichern des Links. Bitte versuchen Sie es erneut.';

  @override
  String get businessTitle => 'Geschäftsmöglichkeit';

  @override
  String get businessLoadingMessage =>
      'Geschäftsmöglichkeitsdetails werden geladen...';

  @override
  String get businessErrorMessage =>
      'Geschäftsmöglichkeitsdetails können nicht geladen werden';

  @override
  String get businessButtonJoin => 'Jetzt beitreten';

  @override
  String get businessButtonLearnMore => 'Mehr erfahren';

  @override
  String get businessButtonContact => 'Sponsor kontaktieren';

  @override
  String get changePasswordTitle => 'Passwort ändern';

  @override
  String get changePasswordLabelCurrent => 'Aktuelles Passwort';

  @override
  String get changePasswordHintCurrent =>
      'Geben Sie Ihr aktuelles Passwort ein';

  @override
  String get changePasswordCurrentRequired =>
      'Bitte geben Sie Ihr aktuelles Passwort ein';

  @override
  String get changePasswordLabelNew => 'Neues Passwort';

  @override
  String get changePasswordHintNew => 'Geben Sie Ihr neues Passwort ein';

  @override
  String get changePasswordNewRequired =>
      'Bitte geben Sie ein neues Passwort ein';

  @override
  String get changePasswordLabelConfirm => 'Neues Passwort bestätigen';

  @override
  String get changePasswordHintConfirm =>
      'Geben Sie Ihr neues Passwort erneut ein';

  @override
  String get changePasswordConfirmRequired =>
      'Bitte bestätigen Sie Ihr neues Passwort';

  @override
  String get changePasswordMismatch => 'Passwörter stimmen nicht überein';

  @override
  String get changePasswordButtonUpdate => 'Passwort aktualisieren';

  @override
  String get changePasswordSuccessMessage =>
      'Passwort erfolgreich aktualisiert!';

  @override
  String get changePasswordErrorMessage =>
      'Fehler beim Aktualisieren des Passworts. Bitte versuchen Sie es erneut.';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatInputHint => 'Nachricht eingeben...';

  @override
  String get chatButtonSend => 'Senden';

  @override
  String get chatEmptyState =>
      'Noch keine Nachrichten. Beginnen Sie das Gespräch!';

  @override
  String get chatMessageDeleted => 'Diese Nachricht wurde gelöscht';

  @override
  String get chatMessageEdited => 'bearbeitet';

  @override
  String chatTypingIndicator(String name) {
    return '$name schreibt...';
  }

  @override
  String get chatbotTitle => 'KI-Coach';

  @override
  String get chatbotWelcome =>
      'Hallo! Ich bin Ihr KI-Coach. Wie kann ich Ihnen heute beim Aufbau Ihres Teams helfen?';

  @override
  String get chatbotInputHint => 'Fragen Sie mich alles über Teamaufbau...';

  @override
  String get chatbotSuggestion1 => 'Wie kann ich effektiver rekrutieren?';

  @override
  String get chatbotSuggestion2 => 'Was sind die Zulassungsvoraussetzungen?';

  @override
  String get chatbotSuggestion3 => 'Wie funktioniert das Feeder-System?';

  @override
  String get chatbotThinking => 'Denke nach...';

  @override
  String get companyTitle => 'Unternehmensinformationen';

  @override
  String get companyAboutHeading => 'Über Team Build Pro';

  @override
  String get companyAboutText =>
      'Team Build Pro ist eine professionelle SaaS-Plattform für Teamaufbau und Netzwerkwachstum. Wir stellen die Tools und Technologien bereit, um Ihr professionelles Team effektiv aufzubauen und zu verwalten.';

  @override
  String get companyVersionLabel => 'App-Version';

  @override
  String get companyContactHeading => 'Kontaktieren Sie uns';

  @override
  String get companyContactEmail => 'support@teambuildpro.com';

  @override
  String get companyContactWebsite => 'www.teambuildpro.com';

  @override
  String get deleteAccountTitle => 'Konto löschen';

  @override
  String get deleteAccountWarning =>
      'Warnung: Diese Aktion kann nicht rückgängig gemacht werden!';

  @override
  String get deleteAccountDescription =>
      'Das Löschen Ihres Kontos entfernt dauerhaft alle Ihre Daten, einschließlich Ihres Profils, Teaminformationen und Nachrichtenverlaufs. Diese Aktion ist unwiderruflich.';

  @override
  String get deleteAccountConfirmPrompt =>
      'Um die Löschung zu bestätigen, geben Sie bitte DELETE unten ein:';

  @override
  String get deleteAccountConfirmHint => 'Geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get deleteAccountConfirmMismatch =>
      'Bitte geben Sie DELETE genau wie angezeigt ein';

  @override
  String get deleteAccountButtonDelete => 'Konto löschen';

  @override
  String get deleteAccountButtonCancel => 'Abbrechen';

  @override
  String get deleteAccountSuccessMessage =>
      'Ihr Konto wurde erfolgreich gelöscht.';

  @override
  String get deleteAccountErrorMessage =>
      'Fehler beim Löschen des Kontos. Bitte kontaktieren Sie den Support.';

  @override
  String get editProfileTitle => 'Profil bearbeiten';

  @override
  String get editProfileLabelFirstName => 'Vorname';

  @override
  String get editProfileLabelLastName => 'Nachname';

  @override
  String get editProfileLabelEmail => 'E-Mail';

  @override
  String get editProfileLabelPhone => 'Telefonnummer';

  @override
  String get editProfileLabelCity => 'Stadt';

  @override
  String get editProfileLabelState => 'Bundesland/Provinz';

  @override
  String get editProfileLabelCountry => 'Land';

  @override
  String get editProfileLabelBio => 'Bio';

  @override
  String get editProfileHintBio => 'Erzählen Sie Ihrem Team etwas über sich...';

  @override
  String get editProfileButtonSave => 'Änderungen speichern';

  @override
  String get editProfileButtonCancel => 'Abbrechen';

  @override
  String get editProfileButtonChangePhoto => 'Foto ändern';

  @override
  String get editProfileSuccessMessage => 'Profil erfolgreich aktualisiert!';

  @override
  String get editProfileErrorMessage =>
      'Fehler beim Aktualisieren des Profils. Bitte versuchen Sie es erneut.';

  @override
  String get eligibilityTitle => 'Berechtigungsstatus';

  @override
  String get eligibilityCurrentStatus => 'Aktueller Status';

  @override
  String get eligibilityStatusQualified => 'Qualifiziert';

  @override
  String get eligibilityStatusNotQualified => 'Nicht qualifiziert';

  @override
  String get eligibilityRequirementsHeading => 'Anforderungen';

  @override
  String get eligibilityDirectSponsorsLabel => 'Direkte Sponsoren';

  @override
  String eligibilityDirectSponsorsProgress(int current, int required) {
    return '$current von $required erforderlich';
  }

  @override
  String get eligibilityTotalTeamLabel => 'Gesamte Teammitglieder';

  @override
  String eligibilityTotalTeamProgress(int current, int required) {
    return '$current von $required erforderlich';
  }

  @override
  String eligibilityProgressBar(int percent) {
    return 'Fortschritt: $percent%';
  }

  @override
  String get eligibilityNextSteps => 'Nächste Schritte';

  @override
  String get eligibilityNextStepsDescription =>
      'Teilen Sie weiterhin Ihren Empfehlungslink, um Ihr Team zu vergrößern und die Anforderungen zu erfüllen!';

  @override
  String get shareTitle => 'Wachsen';

  @override
  String get shareYourLinkHeading => 'Ihr Empfehlungslink';

  @override
  String get shareButtonCopyLink => 'Link kopieren';

  @override
  String get shareLinkCopied => 'Link in die Zwischenablage kopiert!';

  @override
  String get shareButtonSms => 'Per SMS teilen';

  @override
  String get shareButtonEmail => 'Per E-Mail teilen';

  @override
  String get shareButtonWhatsApp => 'Per WhatsApp teilen';

  @override
  String get shareButtonMore => 'Weitere Optionen';

  @override
  String shareMessageTemplate(String link) {
    return 'Hey! Ich baue mein Team mit Team Build Pro auf. Mach mit: $link';
  }

  @override
  String get shareStatsHeading => 'Ihre Teilungswirkung';

  @override
  String get shareStatsViews => 'Link-Aufrufe';

  @override
  String get shareStatsSignups => 'Anmeldungen';

  @override
  String get shareStatsConversion => 'Konversionsrate';

  @override
  String get memberDetailTitle => 'Mitgliederdetails';

  @override
  String get memberDetailLabelName => 'Name';

  @override
  String get memberDetailLabelEmail => 'E-Mail';

  @override
  String get memberDetailLabelPhone => 'Telefon';

  @override
  String get memberDetailLabelLocation => 'Standort';

  @override
  String get memberDetailLabelJoined => 'Beigetreten';

  @override
  String get memberDetailLabelSponsor => 'Sponsor';

  @override
  String get memberDetailLabelLevel => 'Ebene';

  @override
  String get memberDetailTeamStats => 'Teamstatistiken';

  @override
  String memberDetailDirectSponsors(int count) {
    return 'Direkte Sponsoren: $count';
  }

  @override
  String memberDetailTotalTeam(int count) {
    return 'Gesamtes Team: $count';
  }

  @override
  String get memberDetailButtonMessage => 'Nachricht senden';

  @override
  String get memberDetailButtonViewTeam => 'Ihr Team anzeigen';

  @override
  String get messageThreadTitle => 'Nachrichten';

  @override
  String get messageThreadInputHint => 'Geben Sie Ihre Nachricht ein...';

  @override
  String get messageThreadButtonSend => 'Senden';

  @override
  String get messageThreadEmptyState =>
      'Noch keine Nachrichten. Starten Sie das Gespräch!';

  @override
  String get messageThreadDelivered => 'Zugestellt';

  @override
  String get messageThreadRead => 'Gelesen';

  @override
  String get messageThreadSending => 'Wird gesendet...';

  @override
  String get messageThreadFailed => 'Senden fehlgeschlagen';

  @override
  String get loginTitle => 'Anmelden';

  @override
  String get loginButtonGoogle => 'Mit Google fortfahren';

  @override
  String get loginButtonApple => 'Mit Apple fortfahren';

  @override
  String get loginDivider => 'oder';

  @override
  String get loginForgotPassword => 'Passwort vergessen?';

  @override
  String get loginResetPasswordTitle => 'Passwort zurücksetzen';

  @override
  String get loginResetPasswordDescription =>
      'Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.';

  @override
  String get loginResetPasswordButton => 'Zurücksetzungslink senden';

  @override
  String get loginResetPasswordSuccess =>
      'Zurücksetzungslink gesendet! Überprüfen Sie Ihre E-Mails.';

  @override
  String get loginResetPasswordError =>
      'Fehler beim Senden des Zurücksetzungslinks. Bitte versuchen Sie es erneut.';

  @override
  String get commonButtonCancel => 'Abbrechen';

  @override
  String get commonButtonSave => 'Speichern';

  @override
  String get commonButtonDelete => 'Löschen';

  @override
  String get commonButtonEdit => 'Bearbeiten';

  @override
  String get commonButtonClose => 'Schließen';

  @override
  String get commonButtonOk => 'OK';

  @override
  String get commonButtonYes => 'Ja';

  @override
  String get commonButtonNo => 'Nein';

  @override
  String get commonLoadingMessage => 'Lädt...';

  @override
  String get commonErrorMessage =>
      'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.';

  @override
  String get commonSuccessMessage => 'Erfolg!';

  @override
  String get commonNoDataMessage => 'Keine Daten verfügbar';

  @override
  String get commonRetryButton => 'Erneut versuchen';

  @override
  String get commonRefreshButton => 'Aktualisieren';

  @override
  String get authSignupErrorFirstName => 'Vorname darf nicht leer sein';

  @override
  String get authSignupErrorLastName => 'Nachname darf nicht leer sein';

  @override
  String addLinkHeading(String business) {
    return 'Ihren $business-Link hinzufügen';
  }

  @override
  String get addLinkImportantLabel => 'WICHTIGE INFORMATIONEN';

  @override
  String addLinkDisclaimer(String business) {
    return 'Sie aktualisieren Ihr Team Build Pro-Konto, um Empfehlungen an $business zu verfolgen. Dies ist eine separate, unabhängige Geschäftseinheit, die NICHT im Besitz von Team Build Pro ist, von diesem betrieben wird oder mit diesem verbunden ist.';
  }

  @override
  String get addLinkGrowthTitle => 'Ihr Wachstumspotenzial freischalten';

  @override
  String get addLinkInstructionBullet1 =>
      'Ihr Empfehlungslink wird nur zu Tracking-Zwecken in Ihrem Team Build Pro-Profil gespeichert.';

  @override
  String addLinkInstructionBullet2(String business) {
    return 'Wenn sich Ihre Teammitglieder qualifizieren und der $business-Möglichkeit beitreten, werden sie automatisch in Ihrem offiziellen Team platziert';
  }

  @override
  String get addLinkInstructionBullet3 =>
      'Dieser Link kann nur einmal festgelegt werden. Bitte überprüfen Sie, ob er korrekt ist, bevor Sie ihn speichern.';

  @override
  String get addLinkWarning =>
      'Team Build Pro ist nur eine Empfehlungs-Tracking-Plattform. Wir unterstützen oder garantieren keine Geschäftsmöglichkeiten.';

  @override
  String get addLinkFinalStepTitle =>
      'Letzter Schritt: Verknüpfen Sie Ihr Konto';

  @override
  String addLinkFinalStepSubtitle(String business) {
    return 'Dies stellt sicher, dass Ihre neuen Teammitglieder automatisch in Ihrer $business-Organisation platziert werden.';
  }

  @override
  String addLinkFieldInstruction(String business) {
    return 'Geben Sie unten Ihren $business-Empfehlungslink ein. Dieser wird verwendet, um Empfehlungen von Ihrem Team zu verfolgen.';
  }

  @override
  String addLinkMustBeginWith(String baseUrl) {
    return 'Muss beginnen mit:\n$baseUrl';
  }

  @override
  String get addLinkFieldLabel => 'Geben Sie Ihren Empfehlungslink ein';

  @override
  String addLinkFieldHelper(String baseUrl) {
    return 'Muss mit $baseUrl beginnen\nKann nach dem Festlegen nicht geändert werden';
  }

  @override
  String addLinkFieldError(String business) {
    return 'Bitte geben Sie Ihren $business-Empfehlungslink ein.';
  }

  @override
  String get addLinkConfirmFieldLabel => 'Empfehlungslink-URL bestätigen';

  @override
  String get addLinkConfirmFieldError =>
      'Bitte bestätigen Sie Ihren Empfehlungslink.';

  @override
  String get addLinkPreviewLabel => 'Empfehlungslink-Vorschau:';

  @override
  String get addLinkSaving => 'Wird validiert und gespeichert...';

  @override
  String get addLinkDialogImportantTitle => 'Sehr wichtig!';

  @override
  String addLinkDialogImportantMessage(String business) {
    return 'Sie müssen den genauen Empfehlungslink eingeben, den Sie von $business erhalten haben. Dadurch wird sichergestellt, dass Ihre Teammitglieder, die $business beitreten, automatisch in Ihrem $business-Team platziert werden.';
  }

  @override
  String get addLinkDialogImportantButton => 'Ich verstehe';

  @override
  String get addLinkDialogDuplicateTitle =>
      'Empfehlungslink bereits in Verwendung';

  @override
  String addLinkDialogDuplicateMessage(String business) {
    return 'Der $business-Empfehlungslink, den Sie eingegeben haben, wird bereits von einem anderen Team Build Pro-Mitglied verwendet.';
  }

  @override
  String get addLinkDialogDuplicateInfo =>
      'Sie müssen einen anderen Empfehlungslink verwenden, um fortzufahren.';

  @override
  String get addLinkDialogDuplicateButton => 'Anderen Link versuchen';

  @override
  String get businessHeroTitle =>
      'Herzlichen Glückwunsch!\nSie sind qualifiziert!';

  @override
  String businessHeroMessage(String business) {
    return 'Ihre harte Arbeit und Ihr Teamaufbau haben sich ausgezahlt. Sie sind jetzt berechtigt, der $business-Möglichkeit beizutreten.';
  }

  @override
  String get businessDisclaimerTitle => 'Haftungsausschluss';

  @override
  String businessDisclaimerMessage(String business) {
    return 'Ihr Teamwachstum hat Ihnen Zugang zu $business ermöglicht. Diese Möglichkeit funktioniert als unabhängiges Geschäft und hat keine Verbindung zur Team Build Pro-Plattform.';
  }

  @override
  String businessDisclaimerInfo(String business) {
    return 'Die Team Build Pro App erleichtert lediglich den Zugang zu $business über Ihren Upline-Sponsor. Sie unterstützt oder garantiert keine spezifischen Ergebnisse aus dieser Möglichkeit.';
  }

  @override
  String get businessSponsorTitle => 'Ihr Empfehlungskontakt';

  @override
  String businessSponsorMessage(String business, String sponsor) {
    return 'Wenn Sie sich entscheiden, $business zu erkunden, ist Ihr Empfehlungskontakt $sponsor. Diese Person ist ein Mitglied Ihres Upline-Teams, das $business bereits beigetreten ist.';
  }

  @override
  String businessInstructionsTitle(String business) {
    return '$business beitreten';
  }

  @override
  String businessInstructions(String business) {
    return '1. Kopieren Sie den Empfehlungslink unten\n2. Öffnen Sie Ihren Webbrowser\n3. Fügen Sie den Link ein und schließen Sie die $business-Registrierung ab\n4. Kehren Sie hierher zurück, um Ihren $business-Empfehlungslink hinzuzufügen';
  }

  @override
  String get businessNoUrlMessage =>
      'Registrierungs-URL nicht verfügbar. Bitte kontaktieren Sie Ihren Sponsor.';

  @override
  String get businessUrlLabel => 'Empfehlungslink Ihres Sponsors:';

  @override
  String get businessUrlCopyTooltip => 'URL kopieren';

  @override
  String get businessUrlCopiedMessage =>
      'Registrierungs-URL in die Zwischenablage kopiert!';

  @override
  String businessUrlCopyError(String error) {
    return 'Fehler beim Kopieren der URL: $error';
  }

  @override
  String get businessFollowUpTitle =>
      'Letzter Schritt: Verknüpfen Sie Ihr Konto';

  @override
  String businessFollowUpMessage(String business) {
    return 'Nachdem Sie $business erkundet haben, müssen Sie hierher zurückkehren und Ihren neuen $business-Empfehlungslink zu Ihrem Team Build Pro-Profil hinzufügen. Dies stellt sicher, dass Ihre Teamverbindungen korrekt verfolgt werden.';
  }

  @override
  String get businessCompleteButton1 => 'Registrierung abgeschlossen';

  @override
  String get businessCompleteButton2 => 'Meinen Empfehlungslink hinzufügen';

  @override
  String get businessConfirmDialogTitle => 'Bevor Sie fortfahren';

  @override
  String businessConfirmDialogMessage(String business) {
    return 'Dies ist der nächste Schritt in Ihrer Reise. Nachdem Sie $business über den Link Ihres Sponsors beigetreten sind, müssen Sie hierher zurückkehren, um Ihren neuen $business-Empfehlungslink zu Ihrem Profil hinzuzufügen. Dies ist ein kritischer Schritt, um sicherzustellen, dass Ihre neuen Teammitglieder korrekt platziert werden.';
  }

  @override
  String get businessConfirmDialogButton => 'Ich verstehe';

  @override
  String get businessVisitRequiredTitle => 'Besuch zuerst erforderlich';

  @override
  String businessVisitRequiredMessage(String business) {
    return 'Bevor Sie Ihr Profil aktualisieren, müssen Sie zuerst die Schaltfläche \'Registrierungslink kopieren\' auf dieser Seite verwenden, um $business zu besuchen und Ihre Registrierung abzuschließen.';
  }

  @override
  String get businessVisitRequiredButton => 'OK';

  @override
  String get gettingStartedHeading => 'Erste Schritte mit Team Build Pro';

  @override
  String get gettingStartedSubheading =>
      'Folgen Sie diesen einfachen Schritten, um Ihr Team aufzubauen';

  @override
  String gettingStartedStep1Description(String business) {
    return 'Erstellen Sie eine Liste von Rekrutierungskandidaten und aktuellen $business-Teammitgliedern, mit denen Sie Team Build Pro teilen möchten. Denken Sie darüber nach, wer von diesem Tool profitieren könnte, um ihren Teamaufbau zu beschleunigen.';
  }

  @override
  String gettingStartedStep2Description(String business) {
    return 'Verwenden Sie die Teilen-Funktion, um schnell und einfach gezielte Textnachrichten und E-Mails an Ihre Rekrutierungskandidaten und $business-Teammitglieder zu senden.';
  }

  @override
  String get gettingStartedStep2Button => 'Teilen öffnen';

  @override
  String get gettingStartedProTipTitle => 'Profi-Tipp';

  @override
  String get gettingStartedProTipMessage =>
      'Konsequente Nachverfolgung und Engagement sind der Schlüssel zum Aufbau eines starken, aktiven Teams.';

  @override
  String get eligibilityHeroTitleQualified =>
      'HERZLICHEN GLÜCKWUNSCH!\nSie sind qualifiziert!';

  @override
  String get eligibilityHeroTitleNotQualified => 'Bauen Sie Ihre Dynamik auf';

  @override
  String eligibilityHeroMessageQualified(String business) {
    return 'Unglaubliche Arbeit! Sie haben Ihr Grundlagenteam aufgebaut und die $business-Möglichkeit freigeschaltet. Erweitern Sie weiterhin Ihr Netzwerk, um anderen zu helfen, denselben Erfolg zu erzielen.';
  }

  @override
  String eligibilityHeroMessageNotQualified(String business) {
    return 'Sie sind auf dem Weg! Jeder Fachmann, mit dem Sie sich verbinden, baut Dynamik für Ihren zukünftigen Start in der $business-Möglichkeit auf. Teilen Sie weiter, um Ihre Ziele zu erreichen!';
  }

  @override
  String get eligibilityHeroButton => 'Bewährte Wachstumsstrategien';

  @override
  String get eligibilityThresholdsTitle => 'QUALIFIKATIONSSCHWELLEN';

  @override
  String get eligibilityLabelDirectSponsors => 'Direkte Sponsoren';

  @override
  String get eligibilityLabelTotalTeam => 'Gesamte Teammitglieder';

  @override
  String get eligibilityCurrentCountsTitle => 'IHRE AKTUELLEN TEAMZAHLEN';

  @override
  String get eligibilityCurrentDirectSponsors => 'Direkte Sponsoren';

  @override
  String get eligibilityCurrentTotalTeam => 'Gesamte Teammitglieder';

  @override
  String get eligibilityProcessTitle => 'DER PROZESS';

  @override
  String get eligibilityProcessStep1Title =>
      'EINLADEN - Bauen Sie Ihr Fundament auf';

  @override
  String eligibilityProcessStep1Description(String business) {
    return 'Verbinden Sie sich mit gleichgesinnten Fachleuten, die offen sind, $business zu erkunden.';
  }

  @override
  String get eligibilityProcessStep2Title =>
      'KULTIVIEREN - Schaffen Sie Dynamik';

  @override
  String get eligibilityProcessStep2Description =>
      'Fördern Sie authentische Beziehungen, während Ihr Team wächst, und schaffen Sie ein florierendes Team von Fachleuten, die sich gegenseitig beim Erfolg unterstützen.';

  @override
  String get eligibilityProcessStep3Title =>
      'PARTNERSCHAFT - Starten Sie mit Erfolg';

  @override
  String eligibilityProcessStep3Description(String business) {
    return 'Teammitglieder erhalten eine Einladung, $business beizutreten, wenn sie wichtige Wachstumsziele erreichen.';
  }

  @override
  String get shareHeading => 'Leistungsstarkes Empfehlungssystem';

  @override
  String get shareSubheading =>
      'Teilen Sie Ihre Empfehlungslinks, um ein neues Team mit Rekrutierungskandidaten vorzubauen oder Ihr bestehendes Team zu erweitern.';

  @override
  String get shareStrategiesTitle => 'Bewährte Wachstumsstrategien';

  @override
  String get shareProspectTitle => 'Neue Rekrutierungskandidaten';

  @override
  String get shareProspectSubtitle =>
      'Laden Sie Rekrutierungskandidaten ein, um einen Vorsprung zu erhalten.';

  @override
  String shareProspectDescription(String business) {
    return 'Laden Sie Rekrutierungskandidaten ein, ihr $business-Team mit dieser App vorzubauen. Sie können kraftvolle Dynamik aufbauen, bevor sie offiziell $business beitreten, und so den Erfolg vom ersten Tag an sicherstellen.';
  }

  @override
  String get sharePartnerTitle => 'Aktuelle Geschäftspartner';

  @override
  String sharePartnerSubtitle(String business) {
    return 'Großartig für Ihr bestehendes $business-Team';
  }

  @override
  String sharePartnerDescription(String business) {
    return 'Stärken Sie Ihre bestehenden $business-Partner mit demselben Tool, das Sie verwenden. Dies fördert die Duplikation und hilft, das Wachstum in Ihrer gesamten $business-Organisation zu beschleunigen.';
  }

  @override
  String get shareSelectMessageLabel => 'Zu sendende Nachricht auswählen';

  @override
  String get shareButtonShare => 'Teilen';

  @override
  String get shareLinkCopiedMessage => 'Link in die Zwischenablage kopiert!';

  @override
  String get shareProTipsTitle => 'Profi-Tipps für den Erfolg';

  @override
  String get shareProTip1 =>
      '💬 Personalisieren Sie Ihre Nachricht beim Teilen';

  @override
  String get shareProTip2 =>
      '📱 Teilen Sie konsequent auf allen Social-Media-Plattformen';

  @override
  String get shareProTip3 =>
      '🤝 Verfolgen Sie Kandidaten nach, die Interesse zeigen';

  @override
  String get shareProTip4 =>
      '📈 Verfolgen Sie Ihre Ergebnisse und passen Sie Ihren Ansatz an';

  @override
  String get shareProTip5 =>
      '🎯 Verwenden Sie beide Strategien für maximales Wachstumspotenzial';

  @override
  String get shareDemoTitle => 'Demo-Modus';

  @override
  String get shareDemoMessage => 'Teilen im Demo-Modus deaktiviert.';

  @override
  String get shareDemoButton => 'Ich verstehe';

  @override
  String get memberDetailButtonSendMessage => 'Nachricht senden';

  @override
  String get memberDetailLabelDirectSponsors => 'Direkte Sponsoren';

  @override
  String get memberDetailLabelJoinedNetwork => 'Netzwerk beigetreten';

  @override
  String memberDetailLabelJoinedOrganization(String bizOpp) {
    return '$bizOpp beigetreten';
  }

  @override
  String get memberDetailLabelQualified => 'Qualifiziert';

  @override
  String get memberDetailLabelQualifiedDate => 'Qualifikationsdatum';

  @override
  String get memberDetailLabelTeamLeader => 'Teamleiter';

  @override
  String get memberDetailLabelTotalTeam => 'Gesamtes Team';

  @override
  String get memberDetailNotYet => 'Noch nicht';

  @override
  String get memberDetailNotYetJoined => 'Noch nicht beigetreten';

  @override
  String get memberDetailEligibilityTitle => 'Berechtigungsanforderungen';

  @override
  String get memberDetailEligibilityDirectSponsors => 'Direkte Sponsoren';

  @override
  String get memberDetailEligibilityTotalTeam => 'Gesamtes Team';

  @override
  String memberDetailEligibilityMessage(String organization) {
    return 'Teammitglieder, die diese Anforderungen erfüllen, werden automatisch eingeladen, der $organization beizutreten.';
  }

  @override
  String get memberDetailEligibilityWaived => 'Verzichtet';

  @override
  String memberDetailEligibilityWaivedMessage(String organization) {
    return 'Berechtigungsanforderungen sind für Personen erlassen, die $organization vor dem Beitritt zum Netzwerk beigetreten sind.';
  }

  @override
  String get messageThreadHeading => 'Nachrichtencenter';

  @override
  String get messageThreadEmptyMessage => 'Starten Sie das Gespräch!';

  @override
  String get messageThreadUrlWarningTitle => 'Warnung vor externem Link';

  @override
  String get messageThreadUrlWarningMessage =>
      'Diese Nachricht enthält einen externen Link. Seien Sie vorsichtig beim Klicken auf Links von unbekannten Quellen.';

  @override
  String get messageThreadUrlWarningButton => 'Verstanden';

  @override
  String get chatbotAssistantTitle => 'KI-Assistent';

  @override
  String get chatbotAssistantSubtitle =>
      'Fragen Sie mich alles über Team Build Pro';

  @override
  String get chatbotClearTooltip => 'Unterhaltung löschen';

  @override
  String get chatbotSignInRequired =>
      'Bitte melden Sie sich an, um den KI-Assistenten zu verwenden';

  @override
  String get companyHeading => 'Unternehmensdetails';

  @override
  String get companyLabelName => 'Unternehmensname';

  @override
  String get companyLabelReferralLink => 'Mein Unternehmens-Empfehlungslink';

  @override
  String get companyLinkedTitle => 'Konto verknüpft!';

  @override
  String companyLinkedMessage(String business) {
    return 'Großartige Neuigkeiten! Während Ihre Teammitglieder Dynamik gewinnen und sich qualifizieren, erhalten sie eine Einladung, Ihrer $business-Organisation beizutreten.';
  }

  @override
  String get companyNotAvailable => 'Nicht verfügbar';

  @override
  String get deleteAccountHeading => 'Kontolöschung';

  @override
  String get deleteAccountSubheading =>
      'Es tut uns leid, Sie gehen zu sehen. Bitte lesen Sie die folgenden Informationen sorgfältig durch.';

  @override
  String get deleteAccountWarningTitle => 'PERMANENTE KONTOLÖSCHUNG';

  @override
  String get deleteAccountWarningMessage =>
      'Diese Aktion kann nicht rückgängig gemacht werden. Wenn Sie Ihr Konto löschen:';

  @override
  String get deleteAccountWarning1 =>
      'Werden Ihre persönlichen Daten dauerhaft gelöscht';

  @override
  String get deleteAccountWarning2 =>
      'Verlieren Sie den Zugang zu allen Premium-Funktionen';

  @override
  String get deleteAccountWarning3 =>
      'Kann Ihr Konto nicht wiederhergestellt oder reaktiviert werden';

  @override
  String get deleteAccountWarning4 =>
      'Werden Ihre Netzwerkbeziehungen zur Geschäftskontinuität erhalten';

  @override
  String get deleteAccountWarning5 =>
      'Werden Sie sofort von allen Geräten abgemeldet';

  @override
  String get deleteAccountInfoTitle => 'Kontoinformationen';

  @override
  String get deleteAccountConfirmTitle => 'Konto löschen?';

  @override
  String get deleteAccountConfirmLabel =>
      'Um die Löschung zu bestätigen, geben Sie bitte Ihre E-Mail-Adresse ein:';

  @override
  String get deleteAccountCheckbox1 =>
      'Ich verstehe, dass diese Aktion dauerhaft ist und nicht rückgängig gemacht werden kann';

  @override
  String get deleteAccountCheckbox2 =>
      'Ich verstehe, dass ich den Zugang zu allen Daten und Premium-Funktionen verlieren werde';

  @override
  String get deleteAccountCheckbox3 =>
      'Ich bestätige, dass meine Netzwerkbeziehungen für Geschäftszwecke erhalten bleiben';

  @override
  String get deleteAccountDeleting => 'Wird gelöscht...';

  @override
  String get deleteAccountHelpTitle => 'Benötigen Sie Hilfe?';

  @override
  String get deleteAccountHelpMessage =>
      'Wenn Sie Probleme mit der App haben, kontaktieren Sie bitte unser Support-Team, bevor Sie Ihr Konto löschen.';

  @override
  String get deleteAccountHelpButton => 'Support kontaktieren';

  @override
  String get deleteAccountDemoTitle => 'Demo-Konto-Schutz';

  @override
  String get deleteAccountDemoMessage =>
      'Dies ist ein geschütztes Demo-Konto und kann nicht gelöscht werden.\n\nDemo-Konten werden für App-Reviews und Demonstrationszwecke gepflegt.\n\nWenn Sie die App testen, erstellen Sie bitte ein neues Konto zum Testen der Kontolöschungsfunktionen.';

  @override
  String get deleteAccountDemoButton => 'OK';

  @override
  String get editProfileHeading => 'Profil bearbeiten';

  @override
  String get editProfileHeadingFirstTime => 'Vervollständigen Sie Ihr Profil';

  @override
  String get editProfileInstructionsFirstTime =>
      'Bitte vervollständigen Sie Ihr Profil, um zu beginnen';

  @override
  String get editProfileBusinessQuestion => 'Sind Sie derzeit ein ';

  @override
  String get editProfileBusinessQuestionSuffix => '-Vertreter?';

  @override
  String get editProfileYes => 'Ja';

  @override
  String get editProfileNo => 'Nein';

  @override
  String get editProfileDialogImportantTitle => 'Sehr wichtig!';

  @override
  String editProfileDialogImportantMessage(String business) {
    return 'Sie müssen den genauen Empfehlungslink eingeben, den Sie von Ihrem $business-Sponsor erhalten haben.';
  }

  @override
  String get editProfileDialogImportantButton => 'Ich verstehe';

  @override
  String get editProfileReferralLinkField =>
      'Geben Sie Ihren Empfehlungslink ein';

  @override
  String get editProfileReferralLinkLabel => 'Ihr Empfehlungslink';

  @override
  String editProfileReferralLinkHelper(String business) {
    return 'Geben Sie den Empfehlungslink von Ihrem $business-Sponsor ein';
  }

  @override
  String get editProfileConfirmReferralLink => 'Empfehlungslink bestätigen';

  @override
  String get editProfileSelectCountry => 'Wählen Sie Ihr Land';

  @override
  String get editProfileSelectState => 'Wählen Sie Ihr Bundesland/Ihre Provinz';

  @override
  String get editProfileSelectStateDisabled => 'Wählen Sie zuerst ein Land';

  @override
  String get editProfileErrorCity => 'Bitte geben Sie Ihre Stadt ein';

  @override
  String get editProfileErrorState =>
      'Bitte wählen Sie Ihr Bundesland/Ihre Provinz';

  @override
  String get editProfileErrorCountry => 'Bitte wählen Sie Ihr Land';

  @override
  String get editProfilePhotoError =>
      'Fehler beim Hochladen des Fotos. Bitte versuchen Sie es erneut.';

  @override
  String get editProfileDeletionTitle => 'Konto löschen';

  @override
  String get editProfileDeletionMessage =>
      'Löschen Sie Ihr Konto und alle zugehörigen Daten dauerhaft.';

  @override
  String get editProfileDeletionSubtext =>
      'Diese Aktion kann nicht rückgängig gemacht werden';

  @override
  String get editProfileDeletionButton => 'Löschung abschließen';

  @override
  String get loginLabelEmail => 'E-Mail';

  @override
  String get loginLabelPassword => 'Passwort';

  @override
  String get loginValidatorEmail => 'Bitte geben Sie Ihre E-Mail ein';

  @override
  String get loginValidatorPassword => 'Bitte geben Sie Ihr Passwort ein';

  @override
  String get loginButtonLogin => 'Anmelden';

  @override
  String get loginButtonBiometric => 'Mit Biometrie anmelden';

  @override
  String get loginDividerOr => 'oder';

  @override
  String get loginNoAccount => 'Noch kein Konto? ';

  @override
  String get loginCreateAccount => 'Konto erstellen';

  @override
  String get loginPrivacyPolicy => 'Datenschutzerklärung';

  @override
  String get loginTermsOfService => 'Nutzungsbedingungen';

  @override
  String welcomeGreeting(String firstName) {
    return 'Willkommen, $firstName!';
  }

  @override
  String get welcomeMessageAdmin =>
      'Bereit, die professionelle Netzwerkrevolution anzuführen? Vervollständigen Sie Ihr Admin-Profil und richten Sie Ihr Team ein. Nach Abschluss Ihres Profils haben Sie Zugriff auf die vollständige Team Build Pro-Plattform.';

  @override
  String get welcomeMessageUser =>
      'Bereit, Ihr professionelles Netzwerk zu transformieren? Vervollständigen Sie Ihr Profil, um die volle Kraft von Team Build Pro freizuschalten.';

  @override
  String get welcomeButtonJoin => 'Der Revolution beitreten';

  @override
  String get changePasswordHeading => 'Passwort ändern';

  @override
  String get changePasswordTodoMessage =>
      'Hier muss das Formular zum Ändern des Passworts implementiert werden.';

  @override
  String get chatPlaceholder => 'Chat-Oberfläche wird hier angezeigt.';

  @override
  String get quickPromptsWelcomeTitle => 'Willkommen bei Ihrem KI-Coach!';

  @override
  String get quickPromptsWelcomeDescription =>
      'Ich bin hier, um Ihnen zum Erfolg mit Team Build Pro zu verhelfen. Ich kann Fragen zur App, zu Teamaufbau-Strategien beantworten und Sie durch Funktionen führen.';

  @override
  String get quickPromptsDisclaimerMessage =>
      'KI-Coach kann Fehler machen. Überprüfen Sie wichtige Informationen.';

  @override
  String get quickPromptsQuestionHeader => 'Womit kann ich Ihnen helfen?';

  @override
  String get quickPromptsQuestionSubheader =>
      'Tippen Sie auf eine Frage unten, um zu beginnen, oder geben Sie Ihre eigene Frage ein.';

  @override
  String get quickPromptsProTipLabel => 'Profi-Tipp';

  @override
  String get quickPromptsProTipText =>
      'Seien Sie spezifisch mit Ihren Fragen. Zum Beispiel: \"Ich habe 2 direkte Sponsoren, worauf sollte ich mich als Nächstes konzentrieren?\"';

  @override
  String get chatbotPrompt1 => 'Wie funktioniert die Qualifikation?';

  @override
  String get chatbotPrompt2 =>
      'Was ist der Unterschied zwischen diesem und einem MLM?';

  @override
  String get chatbotPrompt3 => 'Wie lade ich Leute in mein Team ein?';

  @override
  String get chatbotPrompt4 => 'Zeigen Sie mir meine Team-Analysen';

  @override
  String get chatbotPrompt5 =>
      'Worauf sollte ich mich als Nächstes konzentrieren?';

  @override
  String get chatbotPrompt6 => 'Wie kündige ich mein Abonnement?';

  @override
  String get chatbotPrompt7 =>
      'Warum scheitern die meisten Menschen im Direktvertrieb?';

  @override
  String get chatbotPrompt8 =>
      'Was passiert, nachdem ich mich qualifiziert habe?';

  @override
  String get shareProspectPastStrugglesTitle =>
      'Vergangene Schwierigkeiten ansprechen';

  @override
  String get shareProspectPastStrugglesDescription =>
      'Perfekt für Kandidaten, die es schon einmal versucht haben und Schwierigkeiten hatten';

  @override
  String get shareProspectPastStrugglesSubject =>
      'Ein smarterer Weg, dieses Mal zu starten';

  @override
  String shareProspectPastStrugglesMessage(Object business, Object link) {
    return 'Wenn vergangene Versuche Sie bei Null ohne Dynamik zurückließen, hier ist ein smarterer Pfad.\n\nDer KI-Coach von Team Build Pro hilft Ihnen, Ihr $business-Team vorzubauen, bevor Sie überhaupt beitreten.\n\nEr entwirft Ihre Nachrichten, plant Ihre Follow-ups und verfolgt, wer interessiert ist - damit Sie dieses Mal nicht von vorne anfangen. Sie starten mit Leuten, die bereits auf Sie warten.\n\nDie KI führt Sie durch jeden Schritt. Sie werden nicht allein sein.\n\nSehen Sie, wie es funktioniert: $link\n\nSie verdienen dieses Mal eine echte Chance.';
  }

  @override
  String get shareProspectNotSalespersonTitle =>
      'Sie können ein erfolgreiches Team aufbauen';

  @override
  String get shareProspectNotSalespersonDescription =>
      'Team Build Pro wurde für Fachleute entwickelt, die ein Netzwerk aufbauen möchten, ohne aggressive Verkaufstaktiken anzuwenden. Unsere Plattform konzentriert sich auf authentische Beziehungen und organisches Wachstum.';

  @override
  String get shareProspectNotSalespersonSubject =>
      'Sie müssen kein \"Verkäufer\" sein';

  @override
  String shareProspectNotSalespersonMessage(Object business, Object link) {
    return 'Kein \"natürlicher Verkäufer\"? Das ist okay. Sie haben einen KI-Coach.\n\nTeam Build Pro hilft Ihnen, Ihr $business-Team mit KI vorzubauen, die Ihre Nachrichten entwirft, Ihre Follow-ups plant und das Interesse aller verfolgt.\n\nEs ist wie ein Rekrutierungs-Assistent, der nie schläft. Sie konzentrieren sich auf Beziehungen. Die KI übernimmt den Rest.\n\nBeginnen Sie mit dem Aufbau, bevor Sie überhaupt beitreten: $link\n\nSie brauchen keine \"Verkaufspersönlichkeit\". Sie brauchen smarte Tools. Jetzt haben Sie sie.';
  }

  @override
  String get shareProspectHopeAfterDisappointmentTitle =>
      'Hoffnung nach Enttäuschung';

  @override
  String get shareProspectHopeAfterDisappointmentDescription =>
      'Ideal für Kandidaten, die von früheren Gelegenheiten enttäuscht wurden';

  @override
  String get shareProspectHopeAfterDisappointmentSubject =>
      'Ein smarterer Weg, dieses Mal zu starten';

  @override
  String shareProspectHopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'Schon mal enttäuscht worden? Die Welt versprochen, dann bei Null anfangen gelassen?\n\nDieses Mal ist anders. Der KI-Coach von Team Build Pro hilft Ihnen, Ihr $business-Team vorzubauen, bevor Sie beitreten.\n\nEr entwirft Ihre Rekrutierungsnachrichten, plant Ihre Follow-ups, verfolgt, wer interessiert ist, und coacht Sie bei den nächsten Schritten. Sie gewinnen echte Dynamik vor Tag 1.\n\nKein Hype. Keine leeren Versprechen. Nur KI-gestützte Tools, die funktionieren.\n\nSehen Sie wie: $link\n\nSie verdienen ein System, das Sie tatsächlich zum Erfolg führt.';
  }

  @override
  String get shareProspectGeneralInvitationTitle => 'Allgemeine Einladung';

  @override
  String get shareProspectGeneralInvitationDescription =>
      'Eine vielseitige Nachricht für jede Kandidatensituation';

  @override
  String get shareProspectGeneralInvitationSubject =>
      'Bauen Sie Ihr Team auf, bevor Sie beitreten';

  @override
  String shareProspectGeneralInvitationMessage(Object business, Object link) {
    return 'Denken Sie über $business nach? Hier ist ein intelligenterer Start.\n\nTeam Build Pro lässt Sie Ihr Team aufbauen, BEVOR Sie offiziell beitreten. Ein KI-Coach hilft Ihnen:\n\n- Personalisierte Recruiting-Nachrichten entwerfen\n- Follow-ups automatisch planen\n- Verfolgen, wer interessiert und bereit ist\n- Echte Dynamik risikofrei aufbauen\n\nWenn Sie dann $business beitreten, starten Sie nicht bei Null. Sie starten mit Menschen, die bereits auf Sie warten.\n\nSehen Sie, wie es funktioniert: $link\n\nTag 1 ist kein Kaltstart. Es ist ein fliegender Start.';
  }

  @override
  String get shareProspectSocialAnxietyTitle =>
      'Unbeholfene Gespräche vermeiden';

  @override
  String get shareProspectSocialAnxietyDescription =>
      'Perfekt für Introvertierte oder solche, die sich bei persönlicher Rekrutierung unwohl fühlen';

  @override
  String get shareProspectSocialAnxietySubject =>
      'Bauen Sie Ihr Team ohne peinliche Gespräche auf';

  @override
  String shareProspectSocialAnxietyMessage(Object business, Object link) {
    return 'Denken Sie über $business nach, aber fühlen sich bei schwierigen Gesprächen unwohl? Sie sind nicht allein.\n\nTeam Build Pro lässt Sie Ihr $business-Team aufbauen, BEVOR Sie offiziell beitreten - online, in Ihrem eigenen Tempo, wo es sich angenehm anfühlt.\n\nDer KI-Coach:\n- Entwirft Recruiting-Nachrichten für Sie\n- Schlägt vor, wen Sie als Nächstes kontaktieren\n- Verfolgt Antworten und Engagement\n- Führt Sie Schritt für Schritt durch jedes Gespräch\n\nKeine Kaltakquise. Keine peinlichen persönlichen Pitches. Nur echte Online-Verbindungen, geführt von KI.\n\nSie bauen risikofrei echte Dynamik auf. Wenn Sie dann $business beitreten, starten Sie mit Menschen, die bereits auf Sie warten.\n\nBeginnen Sie nach Ihren Bedingungen: $link';
  }

  @override
  String get shareProspectTimeConstrainedTitle => 'Für vielbeschäftigte Profis';

  @override
  String get shareProspectTimeConstrainedDescription =>
      'Ideal für Kandidaten, die Job, Familie und andere Verpflichtungen jonglieren';

  @override
  String get shareProspectTimeConstrainedSubject =>
      'Bauen Sie Ihr Team in den Lücken auf';

  @override
  String shareProspectTimeConstrainedMessage(Object business, Object link) {
    return 'Interessiert an $business, aber können keine Vollzeitstunden aufbringen? Das müssen Sie nicht.\n\nTeam Build Pro lässt Sie Ihr $business-Team aufbauen, BEVOR Sie offiziell beitreten - in den Lücken Ihres geschäftigen Lebens.\n\nMorgenkaffee? Mittagspause? Abendzeit? Der KI-Coach arbeitet um Ihren Zeitplan herum:\n- Entwirft Recruiting-Nachrichten für Sie\n- Plant Follow-ups automatisch\n- Erinnert Sie, wenn es Zeit ist, sich zu melden\n- Verfolgt alles, damit die Dynamik nie stoppt\n\nArbeiten Sie 15 Minuten hier, 20 Minuten dort. Die KI lässt jede Minute zählen.\n\nWenn Sie dann $business beitreten, starten Sie mit Menschen, die bereits warten - nicht bei Null.\n\nSehen Sie, wie es in Ihr Leben passt: $link';
  }

  @override
  String get shareProspectFinancialRiskAverseTitle =>
      'Angst, Geld zu verlieren';

  @override
  String get shareProspectFinancialRiskAverseDescription =>
      'Großartig für Kandidaten, die sich vor finanziellem Risiko sorgen';

  @override
  String get shareProspectFinancialRiskAverseSubject =>
      'Sehen Sie Ergebnisse, bevor Sie investieren';

  @override
  String shareProspectFinancialRiskAverseMessage(Object business, Object link) {
    return 'Denken Sie über $business nach, aber sorgen sich, Geld zu verlieren? Klug.\n\nTeam Build Pro lässt Sie Ihr $business-Team aufbauen, BEVOR Sie offiziell beitreten - damit Sie echte Ergebnisse sehen, bevor Sie stark investieren.\n\nStarten Sie kostenlos. Testen Sie das KI-Recruiting-System. Verfolgen Sie Ihren tatsächlichen Fortschritt in Echtzeit:\n- Sehen Sie, wer daran interessiert ist, Ihrem Team beizutreten\n- Beobachten Sie, wie Ihre Dynamik wächst\n- Beweisen Sie, dass das System für Sie funktioniert\n\nNur 4,99 €/Monat, sobald Sie bereit sind, Kandidaten einzuladen. Keine teuren Lead-Funnels. Keine komplexen Systeme.\n\nWenn Sie schließlich $business beitreten, starten Sie mit Menschen, die bereits warten - nicht alles auf Null-Dynamik riskierend.\n\nSehen Sie zuerst Beweise: $link';
  }

  @override
  String get shareProspectSkepticalRealistTitle => 'Zeigen Sie mir Beweise';

  @override
  String get shareProspectSkepticalRealistDescription =>
      'Perfekt für Kandidaten, die von falschen Versprechen enttäuscht wurden';

  @override
  String get shareProspectSkepticalRealistSubject =>
      'Kein Hype. Verfolgen Sie Ihren echten Fortschritt';

  @override
  String shareProspectSkepticalRealistMessage(Object business, Object link) {
    return 'Denken Sie über $business nach, aber müde von leeren Versprechen und Hype?\n\nTeam Build Pro lässt Sie Ihr $business-Team aufbauen, BEVOR Sie offiziell beitreten - und zeigt Ihnen bei jedem Schritt echte Metriken.\n\nKein Geschwätz. Keine Übertreibung. Ihr Dashboard verfolgt:\n- Wie viele Menschen Sie kontaktiert haben\n- Wer geantwortet hat und wer interessiert ist\n- Ihre tatsächliche Dynamik zur Qualifikation (4 direkte + 20 gesamt)\n- Nächste Schritte, die der KI-Coach empfiehlt\n\nSie sehen genau, wo Sie stehen, bevor Sie $business beitreten. Keine Überraschungen. Keine falsche Hoffnung. Nur Daten.\n\nWenn Sie schließlich beitreten, starten Sie mit Beweisen - nicht mit blindem Glauben.\n\nSehen Sie die Transparenz: $link';
  }

  @override
  String get sharePartnerWarmMarketExhaustedTitle => 'Warmer Markt erschöpft';

  @override
  String get sharePartnerWarmMarketExhaustedDescription =>
      'Für Partner, die Freunde und Familie ausgeschöpft haben';

  @override
  String get sharePartnerWarmMarketExhaustedSubject =>
      'Geben Sie Ihrem Team einen KI-Recruiting-Begleiter';

  @override
  String sharePartnerWarmMarketExhaustedMessage(Object business, Object link) {
    return 'Ihr $business-Team hat den warmen Markt ausgeschöpft? Müde, sie Leads nachjagen zu sehen, die sie ghosten?\n\nGeben Sie Ihrer gesamten $business-Organisation einen KI-Recruiting-Begleiter.\n\nTeam Build Pro funktioniert für jede Person in Ihrem Team:\n- Entwirft ihre Recruiting-Nachrichten\n- Plant ihre Follow-ups perfekt\n- Verfolgt Kandidateninteresse automatisch\n- Coacht jedes Gespräch\n\nIhre Kandidaten bauen Teams vor, BEVOR sie beitreten - starten mit Dynamik, nicht von Null.\n\nIhr gesamtes $business-Team erhält denselben KI-Vorteil. Echte Duplikation im großen Maßstab.\n\nStärken Sie Ihr Team: $link\n\nHören Sie auf, ihnen beim Jagen zuzusehen. Fangen Sie an, ihnen beim Gewinnen zuzusehen.';
  }

  @override
  String get sharePartnerExpensiveSystemFatigueTitle =>
      'System-Müdigkeit & Kosten';

  @override
  String get sharePartnerExpensiveSystemFatigueDescription =>
      'Für Partner, die von teuren Rekrutierungsmethoden ausgebrannt sind';

  @override
  String get sharePartnerExpensiveSystemFatigueSubject =>
      'Hören Sie auf zu viel zu zahlen. Stärken Sie Ihr Team mit KI';

  @override
  String sharePartnerExpensiveSystemFatigueMessage(
      Object business, Object link) {
    return 'Ihr $business-Team verbrennt Geld für Leads, Funnels und Systeme, die sich nicht duplizieren?\n\nTeam Build Pro gibt Ihrer gesamten $business-Organisation KI-Recruiting-Tools - direkt integriert. Keine Extrakosten. Kein komplexes Setup.\n\nJede Person in Ihrem Team erhält:\n- KI-entworfene Recruiting-Nachrichten\n- Automatisierte Follow-up-Planung\n- Echtzeit-Engagement-Tracking\n- Schritt-für-Schritt-Gesprächscoaching\n\nIhre Kandidaten bauen Teams vor, BEVOR sie beitreten. Ihr $business-Team dupliziert exakt dieselben KI-Tools. Alle gewinnen.\n\nEin einfaches System. Echte Ergebnisse.\n\nStärken Sie Ihr Team: $link\n\nHören Sie auf zu viel zu zahlen. Fangen Sie an, smart zu skalieren.';
  }

  @override
  String get sharePartnerDuplicationStruggleTitle =>
      'Duplikationsherausforderungen';

  @override
  String get sharePartnerDuplicationStruggleDescription =>
      'Für Führungskräfte, die Schwierigkeiten haben, ihr Team zu duplizieren';

  @override
  String get sharePartnerDuplicationStruggleSubject =>
      'Endlich echte Duplikation für Ihr Team';

  @override
  String sharePartnerDuplicationStruggleMessage(Object business, Object link) {
    return 'Ihr $business-Team hat Schwierigkeiten, Ihren Recruiting-Erfolg zu duplizieren? Das endet heute.\n\nTeam Build Pro gibt jeder Person in Ihrem $business-Team denselben KI-Recruiting-Coach, den Sie sich gewünscht hätten:\n- Entwirft ihre Recruiting-Nachrichten\n- Plant ihre Follow-ups perfekt\n- Verfolgt ihre Kandidaten automatisch\n- Coacht ihre nächsten Schritte\n\nNeuer Rekrut oder erfahrene Führungskraft - alle in Ihrer $business-Organisation erhalten identische KI-Tools. Echte Systemduplikation.\n\nIhre Kandidaten bauen Teams vor, BEVOR sie beitreten. Ihr Team wächst schneller. Konstant.\n\nStärken Sie echte Duplikation: $link\n\nEndlich hat Ihr gesamtes Team auf dieselbe Weise Erfolg.';
  }

  @override
  String get sharePartnerGeneralTeamToolTitle => 'Allgemeine Einladung';

  @override
  String get sharePartnerGeneralTeamToolDescription =>
      'Eine vielseitige Nachricht für jede Partnersituation';

  @override
  String get sharePartnerGeneralTeamToolSubject =>
      'Der KI-Recruiting-Vorteil für Ihr Team';

  @override
  String sharePartnerGeneralTeamToolMessage(Object business, Object link) {
    return 'Ihr $business-Team verdient einen echten Wettbewerbsvorteil.\n\nTeam Build Pro gibt Ihrer gesamten $business-Organisation KI-Recruiting-Tools, die sich tatsächlich duplizieren:\n\n- Personalisierte Recruiting-Nachrichten entwerfen\n- Follow-ups automatisch planen\n- Kandidaten-Engagement in Echtzeit verfolgen\n- Jedes Gespräch Schritt für Schritt coachen\n\nDie Kandidaten Ihres Teams bauen ihre Teams vor, BEVOR sie beitreten. Ihre Partner duplizieren exakt dieselben KI-Tools. Alle in Ihrer $business-Organisation wachsen schneller.\n\nGeben Sie Ihrem Team den KI-Vorteil: $link\n\nSo skalieren moderne Führungskräfte ihre Teams.';
  }

  @override
  String get sharePartnerRetentionCrisisTitle => 'Team-Abbruchproblem';

  @override
  String get sharePartnerRetentionCrisisDescription =>
      'Für Führungskräfte, die frustriert sind über früh kündigende Teammitglieder';

  @override
  String get sharePartnerRetentionCrisisSubject =>
      'Hören Sie auf, Ihr Team im ersten Jahr zu verlieren';

  @override
  String sharePartnerRetentionCrisisMessage(Object business, Object link) {
    return 'Sehen Sie zu, wie Ihr $business-Team aufgibt, bevor es Erfolg hat?\n\n75% steigen im ersten Jahr aus - normalerweise, weil sie sich verloren, nicht unterstützt oder überfordert fühlen.\n\nTeam Build Pro ändert das für Ihre gesamte $business-Organisation. Jede Person in Ihrem Team erhält einen KI-Coach, der:\n- Sie durch jedes Recruiting-Gespräch führt\n- Ihren Fortschritt verfolgt und Erfolge feiert\n- Sie daran erinnert, was als Nächstes zu tun ist\n- Die Dynamik aufrechterhält, wenn die Motivation sinkt\n\nSie sind nie allein. Sie wissen immer ihren nächsten Schritt. Sie bleiben länger engagiert.\n\nIhr $business-Team hat endlich die Unterstützung, die es zum Erfolg braucht.\n\nStärken Sie Ihr Team: $link\n\nHören Sie auf zuzusehen, wie sie aufgeben. Fangen Sie an zuzusehen, wie sie gewinnen.';
  }

  @override
  String get sharePartnerSkillGapTeamTitle => 'Nicht-Verkaufs-Teammitglieder';

  @override
  String get sharePartnerSkillGapTeamDescription =>
      'Perfekt für Teams, in denen die meisten Menschen keine Verkaufserfahrung haben';

  @override
  String get sharePartnerSkillGapTeamSubject =>
      'Ihr Team ohne Verkaufserfahrung kann mit KI gewinnen';

  @override
  String sharePartnerSkillGapTeamMessage(Object business, Object link) {
    return 'Die meisten in Ihrem $business-Team sind keine geborenen Verkäufer. Das hat sie zurückgehalten.\n\nTeam Build Pro verwandelt Ihre $business-Partner ohne Verkaufserfahrung in selbstbewusste Recruiter:\n- Entwirft ihre Recruiting-Nachrichten für sie\n- Schlägt genau vor, wen sie als Nächstes kontaktieren\n- Coacht sie durch jedes Gespräch\n- Verfolgt den Fortschritt, damit sie echte Dynamik sehen\n\nIhre Introvertierten, Ihre Teilzeitkräfte, Ihre \"Ich bin nicht gut im Verkauf\"-Leute - alle in Ihrer $business-Organisation erhalten denselben KI-Vorteil.\n\nEndlich kann Ihr gesamtes Team Ihren Erfolg duplizieren.\n\nStärken Sie alle: $link\n\nSie brauchen kein Team von Verkäufern. Sie brauchen ein Team mit KI.';
  }

  @override
  String get sharePartnerRecruitmentFatigueTitle =>
      'Müde von ständiger Rekrutierung';

  @override
  String get sharePartnerRecruitmentFatigueDescription =>
      'Für Partner, die von dem endlosen Rekrutierungszyklus erschöpft sind';

  @override
  String get sharePartnerRecruitmentFatigueSubject =>
      'Automatisieren Sie die Arbeit. Lassen Sie Ihr Team wachsen.';

  @override
  String sharePartnerRecruitmentFatigueMessage(Object business, Object link) {
    return 'Ihr $business-Team ausgebrannt vom ständigen Recruiting? Die endlosen Follow-ups? Das manuelle Tracking?\n\nDie KI von Team Build Pro übernimmt die Arbeit für Ihre gesamte $business-Organisation.\n\nFür jede Person in Ihrem Team plant die KI:\n- Follow-ups automatisch\n- Verfolgt jeden Kandidaten und seinen Status\n- Erinnert sie, wann sie sich melden sollen\n- Coacht sie, was sie als Nächstes sagen\n\nSie bleiben auf Führung fokussiert. Ihr $business-Team bleibt produktiv, ohne auszubrennen.\n\nDie KI wird nie müde. Die Dynamik Ihres Teams stoppt nie.\n\nStärken Sie nachhaltiges Wachstum: $link\n\nWachstum ohne Burnout. Endlich.';
  }

  @override
  String get sharePartnerAvailabilityGapTitle => 'Nicht 24/7 verfügbar';

  @override
  String get sharePartnerAvailabilityGapDescription =>
      'Ideal für Führungskräfte, die nicht ständig für ihr Team verfügbar sein können';

  @override
  String get sharePartnerAvailabilityGapSubject =>
      'Ihr Team wächst, auch wenn Sie nicht da sind';

  @override
  String sharePartnerAvailabilityGapMessage(Object business, Object link) {
    return 'Ihr $business-Team braucht Sie. Aber Sie können nicht 24/7 verfügbar sein.\n\nTeam Build Pro gibt Ihrer gesamten $business-Organisation einen KI-Coach, der immer aktiv ist.\n\nWährend Sie schlafen, Ihrem Tagesjob nachgehen oder Zeit mit der Familie verbringen, macht die KI:\n- Führt Ihr Team durch Recruiting-Gespräche\n- Beantwortet ihre \"Was mache ich als Nächstes?\"-Fragen\n- Verfolgt ihren Fortschritt und hält sie motiviert\n- Stellt sicher, dass nichts durchs Raster fällt\n\nIhr $business-Team erhält Unterstützung genau dann, wenn es sie braucht - nicht nur, wenn Sie verfügbar sind.\n\nSie bleiben auf Führung fokussiert. Die KI übernimmt das tägliche Coaching.\n\nStärken Sie Ihr Team: $link\n\nEndlich wächst Ihr Team, ohne Sie jede Minute zu brauchen.';
  }

  @override
  String get homepageDemoCredentialsNotAvailable =>
      'Demo-Zugangsdaten nicht verfügbar';

  @override
  String homepageDemoLoginFailed(Object error) {
    return 'Demo-Anmeldung fehlgeschlagen: $error';
  }

  @override
  String get homepageDemoLoginFailedGeneric =>
      'Demo-Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.';

  @override
  String get homepageHeroJumpstart => 'STARTEN SIE IHREN ERFOLG';

  @override
  String get homepageHeroGrow => 'WACHSEN UND VERWALTEN SIE IHR TEAM';

  @override
  String get homepageHeroProven => 'BEWÄHRTES TEAMAUFBAU-SYSTEM';

  @override
  String get homepageHeroBuildFoundation => 'Bauen Sie Ihr Fundament auf';

  @override
  String get homepageHeroBeforeDayOne => 'Vor Tag Eins';

  @override
  String get homepageHeroEmpowerTeam => 'Stärken Sie Ihr Team';

  @override
  String get homepageHeroAccelerate => 'Beschleunigen Sie';

  @override
  String get homepageHeroGrowth => 'Wachstum';

  @override
  String get homepageLoading => 'Lädt...';

  @override
  String homepageMessageTitlePersonal(Object sponsorName) {
    return 'Eine persönliche Nachricht\nvon $sponsorName';
  }

  @override
  String get homepageMessageTitleGeneric =>
      'Eine Nachricht von\nTeam Build Pro';

  @override
  String get homepageMessageBodyNewProspect1 =>
      'Ich freue mich so sehr, dass Sie hier sind, um einen Vorsprung beim Aufbau Ihres';

  @override
  String get homepageMessageBodyNewProspect2 =>
      ' Team. Der nächste Schritt ist einfach – erstellen Sie einfach Ihr Konto unten und beginnen Sie Ihre 30-tägige kostenlose Testversion!';

  @override
  String get homepageMessageBodyRefPartner1 =>
      'Ich verwende die Team Build Pro App, um das Wachstum meines ';

  @override
  String get homepageMessageBodyRefPartner2 =>
      ' Teams und Einkommens zu beschleunigen! Ich empfehle es auch für Sie wärmstens.\n\nDer nächste Schritt ist einfach – erstellen Sie einfach Ihr Konto unten und beginnen Sie Ihre 30-tägige kostenlose Testversion!';

  @override
  String get homepageMessageBodyGeneric =>
      'Team Build Pro ist die ultimative App für Direktvertriebsprofis zum Verwalten und Skalieren ihrer bestehenden Teams mit unaufhaltsamem Schwung und exponentiellem Wachstum.\n\nDer nächste Schritt ist einfach – erstellen Sie einfach Ihr Konto unten und beginnen Sie Ihre 30-tägige kostenlose Testversion!';

  @override
  String get homepageButtonCreateAccount => 'Konto erstellen';

  @override
  String get homepageButtonAlreadyHaveAccount => 'Ich habe bereits ein Konto';

  @override
  String get homepageDemoModeActive => 'Demo-Modus aktiv';

  @override
  String get homepageDemoPreLoaded => 'Vorgeladenes Demo-Konto';

  @override
  String get homepageDemoWelcome => 'Willkommen zur Team Build Pro Demo';

  @override
  String get homepageDemoDescription =>
      'Dies ist ein vollständig funktionsfähiges Demo-Konto, das mit echten Testdaten vorgeladen ist, um Ihnen zu zeigen, wie Team Build Pro funktioniert.';

  @override
  String get homepageDemoCredentialsLabel => 'Zugangsdaten:';

  @override
  String homepageDemoEmail(Object email) {
    return 'E-Mail: $email';
  }

  @override
  String homepageDemoPassword(Object password) {
    return 'Passwort: $password';
  }

  @override
  String get homepageDemoLoggingIn => 'Wird angemeldet...';

  @override
  String get homepageDemoStartDemo => 'Demo starten!';

  @override
  String get homepageTrust100Secure => '100% Sicher';

  @override
  String get homepageTrust30DayFree => '30 Tage kostenlos';

  @override
  String get homepageTrust24Support => '24/7 Support';

  @override
  String get homepageFooterTerms => 'Nutzungsbedingungen';

  @override
  String get homepageFooterPrivacy => 'Datenschutzerklärung';

  @override
  String get authLoginAccountRequiredTitle => 'Konto erforderlich';

  @override
  String get authLoginAccountRequiredMessage =>
      'Es sieht so aus, als müssten Sie zuerst ein Konto erstellen. Möchten Sie sich registrieren?';

  @override
  String get authLoginCancelButton => 'Abbrechen';

  @override
  String get authLoginRegisterButton => 'Registrieren';

  @override
  String get authLoginAppBarTitle => 'Anmelden';

  @override
  String get authLoginSubtitle =>
      'Willkommen zurück! Melden Sie sich an, um fortzufahren.';

  @override
  String get authLoginOrContinueWith => 'oder fortfahren mit';

  @override
  String get authLoginForgotPassword => 'Passwort vergessen?';

  @override
  String get authLoginContinueWithGoogle => 'Mit Google fortfahren';

  @override
  String get authLoginContinueWithApple => 'Mit Apple fortfahren';

  @override
  String get authLoginBiometricButton => 'Mit Biometrie anmelden';

  @override
  String get authLoginResetPasswordTitle => 'Passwort zurücksetzen';

  @override
  String get authLoginCheckEmailTitle => 'Überprüfen Sie Ihre E-Mail';

  @override
  String get authLoginResetEmailSent =>
      'Wir haben einen Link zum Zurücksetzen des Passworts gesendet an:';

  @override
  String get authLoginResetInstructions =>
      'Bitte überprüfen Sie Ihren Posteingang und folgen Sie den Anweisungen zum Zurücksetzen Ihres Passworts.';

  @override
  String get authLoginResetPrompt =>
      'Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.';

  @override
  String get authLoginResetEmailLabel => 'E-Mail';

  @override
  String get authLoginResetEmailHint => 'Geben Sie Ihre E-Mail-Adresse ein';

  @override
  String get authLoginResetEmailRequired => 'Bitte geben Sie Ihre E-Mail ein';

  @override
  String get authLoginResetEmailInvalid =>
      'Bitte geben Sie eine gültige E-Mail ein';

  @override
  String get authLoginDoneButton => 'Fertig';

  @override
  String get authLoginSendResetLink => 'Zurücksetzungslink senden';

  @override
  String get authSignupInvalidInviteLinkMessage =>
      'Das sieht nicht wie ein Einladungslink aus. Bitte fügen Sie den vollständigen Link ein, den Sie erhalten haben.';

  @override
  String get authSignupNewReferralDialogTitle =>
      'Neuer Empfehlungscode erkannt';

  @override
  String get authSignupNewReferralDialogMessage =>
      'Ein neuer Empfehlungscode wurde erkannt:';

  @override
  String authSignupNewReferralNewCode(Object code) {
    return 'Neuer Code: $code';
  }

  @override
  String authSignupNewReferralNewSource(Object source) {
    return 'Quelle: $source';
  }

  @override
  String authSignupNewReferralCurrentCode(Object code) {
    return 'Aktueller Code: $code';
  }

  @override
  String authSignupNewReferralCurrentSource(Object source) {
    return 'Aktuelle Quelle: $source';
  }

  @override
  String get authSignupNewReferralPrompt =>
      'Möchten Sie Ihren Empfehlungscode aktualisieren?';

  @override
  String get authSignupKeepCurrentButton => 'Aktuellen behalten';

  @override
  String get authSignupUseNewCodeButton => 'Neuen Code verwenden';

  @override
  String get authSignupAppBarTitle => 'TEAM BUILD PRO';

  @override
  String get authSignupLoginButton => 'Anmelden';

  @override
  String get authSignupConfirmSponsorButton =>
      'Tippen Sie, um Ihren Sponsor zu bestätigen';

  @override
  String get authSignupNoSponsorFound =>
      'Entschuldigung, kein Sponsor gefunden';

  @override
  String get authSignupPageTitle => 'Kontoregistrierung';

  @override
  String get authSignupInviteLinkButton => 'Ich habe einen Einladungslink';

  @override
  String get authSignupInviteLinkInstructions =>
      'Wenn Ihnen jemand einen Einladungslink gesendet hat, können Sie ihn hier einfügen.';

  @override
  String get authSignupPasteInviteLinkButton => 'Einladungslink einfügen';

  @override
  String authSignupInvitedBy(Object sponsorName) {
    return 'Eingeladen von: $sponsorName';
  }

  @override
  String authSignupReferralCodeDebug(Object code, Object source) {
    return 'Code: $code (Quelle: $source)';
  }

  @override
  String get authSignupAppleButton => 'Mit Apple registrieren';

  @override
  String get authSignupGoogleButton => 'Mit Google registrieren';

  @override
  String get authSignupOrEmailDivider => 'oder mit E-Mail registrieren';

  @override
  String get authSignupLoginSectionTitle => 'Erstellen Sie Ihre Anmeldung';

  @override
  String get authSignupPrivacyAssurance =>
      '🔒 Ihre E-Mail wird niemals mit jemandem geteilt';

  @override
  String get authSignupRequiredForAccount =>
      '🔒 Erforderlich zur Kontoerstellung';

  @override
  String get settingsAuthRequired => 'Authentifizierung erforderlich.';

  @override
  String get settingsUserNotFound => 'Benutzerprofil nicht gefunden.';

  @override
  String get settingsAccessDenied =>
      'Zugriff verweigert: Admin-Rolle erforderlich.';

  @override
  String settingsLoadFailed(Object error) {
    return 'Fehler beim Laden der Einstellungen: $error';
  }

  @override
  String get settingsBusinessNameInvalid =>
      'Geschäftsname darf nur Buchstaben, Zahlen und gängige Satzzeichen enthalten.';

  @override
  String get settingsReferralLinkInvalid =>
      'Bitte geben Sie einen gültigen Empfehlungslink ein (z.B. https://example.com).';

  @override
  String get settingsOrgNameMismatch =>
      'Organisationsname-Felder müssen zur Bestätigung übereinstimmen.';

  @override
  String get settingsReferralLinkMismatch =>
      'Empfehlungslink-Felder müssen zur Bestätigung übereinstimmen.';

  @override
  String get settingsUserNotAuthenticated => 'Benutzer nicht authentifiziert.';

  @override
  String get settingsUpgradeRequiredTitle => 'Upgrade erforderlich';

  @override
  String get settingsUpgradeRequiredMessage =>
      'Upgraden Sie Ihr Admin-Abonnement, um diese Änderungen zu speichern.';

  @override
  String get settingsCancelButton => 'Abbrechen';

  @override
  String get settingsUpgradeButton => 'Jetzt upgraden';

  @override
  String get settingsSavedSuccess => 'Einstellungen erfolgreich gespeichert.';

  @override
  String settingsSaveFailed(Object error) {
    return 'Fehler beim Speichern der Einstellungen: $error';
  }

  @override
  String get settingsRequired => 'Erforderlich';

  @override
  String get settingsNotSet => 'Nicht festgelegt';

  @override
  String get profileUpdateBiometricFailed =>
      'Biometrische Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.';

  @override
  String get profileUpdatePasswordRequired =>
      'Passwort erforderlich, um biometrische Anmeldung zu aktivieren';

  @override
  String get profileUpdateEmailNotFound => 'Benutzer-E-Mail nicht gefunden';

  @override
  String get profileUpdateBiometricEnabled =>
      '✅ Biometrische Anmeldung erfolgreich aktiviert';

  @override
  String get profileUpdatePasswordIncorrect =>
      'Falsches Passwort. Bitte versuchen Sie es erneut.';

  @override
  String profileUpdateBiometricError(Object error) {
    return 'Fehler beim Aktivieren der Biometrie: $error';
  }

  @override
  String get profileUpdateBiometricDisabled =>
      'Biometrische Anmeldung deaktiviert';

  @override
  String get profileUpdateConfirmPasswordTitle => 'Passwort bestätigen';

  @override
  String get profileUpdateConfirmPasswordMessage =>
      'Um Ihre Anmeldedaten sicher für die biometrische Anmeldung zu speichern, geben Sie bitte Ihr Passwort ein.';

  @override
  String get profileUpdatePasswordLabel => 'Passwort';

  @override
  String get profileUpdateCancelButton => 'Abbrechen';

  @override
  String get profileUpdateConfirmButton => 'Bestätigen';

  @override
  String get profileUpdateDisableBiometricTitle =>
      'Biometrische Anmeldung deaktivieren';

  @override
  String get profileUpdateDisableBiometricMessage =>
      'Sind Sie sicher, dass Sie die biometrische Anmeldung deaktivieren möchten? Sie müssen Ihre E-Mail und Ihr Passwort zur Anmeldung verwenden.';

  @override
  String get profileUpdateDisableButton => 'Deaktivieren';

  @override
  String get profileUpdatePictureRequired =>
      'Bitte laden Sie Ihr Profilbild hoch.';

  @override
  String get profileUpdateImageNotProvided =>
      'Bild wurde nicht bereitgestellt.';

  @override
  String get profileUpdateSuccess => 'Profil erfolgreich aktualisiert!';

  @override
  String profileUpdateError(Object error) {
    return 'Fehler beim Aktualisieren des Profils: $error';
  }

  @override
  String get profileUpdateDemoModeTitle => 'Demo-Modus';

  @override
  String get profileUpdateDemoModeMessage =>
      'Profilbearbeitung im Demo-Modus deaktiviert.';

  @override
  String get profileUpdateDemoUnderstandButton => 'Ich verstehe';

  @override
  String get profileUpdateScreenTitle => 'Profil aktualisieren';

  @override
  String get profileUpdateNoEmail => 'Keine E-Mail';

  @override
  String get profileUpdateSelectCountry => 'Land auswählen';

  @override
  String get profileUpdateCountryLabel => 'Land';

  @override
  String get profileUpdateCountryRequired => 'Bitte wählen Sie ein Land';

  @override
  String get profileUpdateSelectState => 'Bundesland/Provinz auswählen';

  @override
  String get profileUpdateSelectCountryFirst => 'Wählen Sie zuerst ein Land';

  @override
  String get profileUpdateStateLabel => 'Bundesland/Provinz';

  @override
  String get profileUpdateStateRequired =>
      'Bitte wählen Sie ein Bundesland/eine Provinz';

  @override
  String get profileUpdateCityLabel => 'Stadt';

  @override
  String get profileUpdateCityRequired => 'Bitte geben Sie eine Stadt ein';

  @override
  String get profileUpdateSecurityHeader => 'Sicherheitseinstellungen';

  @override
  String get profileUpdateBiometricToggle =>
      'Biometrische Anmeldung aktivieren';

  @override
  String get profileUpdateBiometricChecking =>
      'Gerätekompatibilität wird überprüft...';

  @override
  String get profileUpdateBiometricDescription =>
      'Verwenden Sie Fingerabdruck oder Gesichtserkennung zur Anmeldung';

  @override
  String get profileUpdateBiometricNotAvailable =>
      'Auf diesem Gerät nicht verfügbar';

  @override
  String get profileUpdateSaveButton => 'Änderungen speichern';

  @override
  String get profileEditDeletionSuccess =>
      'Kontolöschung abgeschlossen. Vielen Dank, dass Sie Team Build Pro verwendet haben.';

  @override
  String profileEditDeletionError(Object error) {
    return 'Fehler beim Abschließen der Kontolöschung: $error';
  }

  @override
  String get profileEditUrlInvalid =>
      'Bitte geben Sie eine gültige URL ein (z.B. https://example.com)';

  @override
  String get profileEditHttpsRequired =>
      'Empfehlungslink muss HTTPS (nicht HTTP) zur Sicherheit verwenden';

  @override
  String get profileEditUrlFormatInvalid =>
      'Ungültiges URL-Format. Bitte überprüfen Sie Ihren Empfehlungslink.';

  @override
  String get profileEditUnableToVerify =>
      'Empfehlungslink kann nicht verifiziert werden';

  @override
  String get profileEditDomainRequired =>
      'Bitte geben Sie einen gültigen Link mit einer richtigen Domain ein';

  @override
  String get profileEditNoLocalhost =>
      'Bitte geben Sie einen gültigen geschäftlichen Empfehlungslink ein\n(nicht localhost oder IP-Adresse)';

  @override
  String get profileEditDomainWithTld =>
      'Bitte geben Sie einen gültigen Link mit einer richtigen Domain ein\n(z.B. firma.com)';

  @override
  String profileEditBaseUrlRequired(Object baseUrl) {
    return 'Empfehlungslink muss beginnen mit:\n$baseUrl';
  }

  @override
  String get profileEditNotHomepage =>
      'Bitte geben Sie Ihren eindeutigen Empfehlungslink ein,\nnicht nur die Startseite';

  @override
  String get profileEditInvalidFormat => 'Ungültiges Link-Format';

  @override
  String get profileEditReferralRequired =>
      'Bitte geben Sie Ihren Empfehlungslink ein';

  @override
  String get profileEditConfirmReferral =>
      'Bitte bestätigen Sie Ihren Empfehlungslink';

  @override
  String get profileEditCompleteLink =>
      'Bitte geben Sie einen vollständigen Link ein, der mit\nhttp:// oder https:// beginnt';

  @override
  String get profileEditValidReferralRequired =>
      'Bitte geben Sie einen gültigen Empfehlungslink ein (z.B. https://example.com).';

  @override
  String get profileEditReferralMismatch =>
      'Empfehlungslink-Felder müssen zur Bestätigung übereinstimmen.';

  @override
  String get profileEditInvalidLinkTitle => 'Ungültiger Empfehlungslink';

  @override
  String profileEditInvalidLinkMessage(Object businessName) {
    return 'Der $businessName-Empfehlungslink konnte nicht verifiziert werden. Der Link könnte falsch, inaktiv oder vorübergehend nicht verfügbar sein.';
  }

  @override
  String get profileEditContactSponsor =>
      'Bitte überprüfen Sie den Link und versuchen Sie es erneut oder kontaktieren Sie Ihren Sponsor für den korrekten Empfehlungslink.';

  @override
  String get profileEditTryAgainButton => 'Erneut versuchen';

  @override
  String profileEditReferralHint(Object baseUrl) {
    return 'z.B. ${baseUrl}ihr_benutzername_hier';
  }

  @override
  String get profileEditRequiredForRep =>
      'Erforderlich, wenn Sie ein Vertreter sind';

  @override
  String get adminProfilePictureRequired => 'Bitte wählen Sie ein Profilbild';

  @override
  String get adminProfileCountryRequired => 'Bitte wählen Sie ein Land';

  @override
  String get adminProfileStateRequired =>
      'Bitte wählen Sie ein Bundesland/eine Provinz';

  @override
  String get adminProfileCityRequired => 'Bitte geben Sie Ihre Stadt ein';

  @override
  String get adminProfileSetupTitle =>
      '🛠️ Richten Sie Ihr Geschäftsprofil ein...';

  @override
  String get adminProfileSetupDescription =>
      'Bereiten Sie Ihre Geschäftsinformationen vor';

  @override
  String get adminProfileUserNotAuthenticated =>
      'Benutzer nicht authentifiziert';

  @override
  String get adminProfileUploadFailed => 'Fehler beim Hochladen des Bildes';

  @override
  String get adminProfileSaveSuccess =>
      'Profilinformationen erfolgreich gespeichert!';

  @override
  String adminProfileSaveError(Object error) {
    return 'Fehler: $error';
  }

  @override
  String get adminProfileScreenTitle => 'Admin-Profil';

  @override
  String get adminProfileSetupHeader => 'Profil-Setup';

  @override
  String get adminProfileNoEmail => 'Keine E-Mail';

  @override
  String get adminProfileCountryLabel => 'Land';

  @override
  String get adminProfileStateLabel => 'Bundesland/Provinz';

  @override
  String get adminProfileCityLabel => 'Stadt';

  @override
  String get adminProfileNextButton => 'Weiter - Geschäftsinformationen';

  @override
  String get subscriptionAppBarTitle => 'Team Build Pro';

  @override
  String get subscriptionPremiumHeader => 'Premium-Funktionen:';

  @override
  String get subscriptionStatusActive => 'Aktives Abonnement';

  @override
  String get subscriptionStatusActiveSubtitle =>
      'Sie haben vollen Zugriff auf alle Premium-Funktionen';

  @override
  String get subscriptionStatusPaused => 'Abonnement pausiert';

  @override
  String get subscriptionStatusPausedSubtitle =>
      'Ihr Abonnement ist pausiert. Setzen Sie es fort, um den Zugriff wiederherzustellen.';

  @override
  String get subscriptionStatusPaymentIssue => 'Zahlungsproblem';

  @override
  String get subscriptionStatusPaymentIssueSubtitle =>
      'Aktualisieren Sie die Zahlungsmethode, um den Zugriff wiederherzustellen';

  @override
  String get subscriptionStatusTrialActive => 'Kostenlose Testversion aktiv';

  @override
  String subscriptionStatusTrialDaysRemaining(Object days) {
    return '$days Tage verbleiben in Ihrer Testversion';
  }

  @override
  String get subscriptionStatusCancelled => 'Abonnement gekündigt';

  @override
  String get subscriptionStatusCancelledSubtitle =>
      'Der Zugriff läuft bis zum Ablaufdatum weiter';

  @override
  String get subscriptionStatusExpired => 'Abonnement abgelaufen';

  @override
  String get subscriptionStatusExpiredSubtitle =>
      'Upgraden Sie, um Premium-Funktionen wiederherzustellen';

  @override
  String subscriptionFeature1(Object businessName) {
    return 'Reichen Sie Ihren eindeutigen $businessName-Empfehlungslink ein';
  }

  @override
  String get subscriptionFeature2 =>
      'Verfolgen Sie Ihr Teamwachstum in Echtzeit';

  @override
  String get subscriptionFeature3 =>
      'Erhalten Sie Benachrichtigungen, wenn Sie Meilensteine erreichen';

  @override
  String subscriptionFeature4(Object businessName) {
    return 'Zugriff auf erweiterte Analysen und Einblicke';
  }

  @override
  String get subscriptionFeature5 => 'Erweiterte Analysen und Einblicke';

  @override
  String get subscriptionActivatedSuccess =>
      '✅ Abonnement erfolgreich aktiviert!';

  @override
  String get subscriptionNotActiveTitle => 'Abonnement nicht aktiv';

  @override
  String get subscriptionNotActiveMessage =>
      'Kauf gestartet, aber noch nicht aktiv. Bitte versuchen Sie es erneut.';

  @override
  String get subscriptionNotAvailableTitle => 'Abonnement nicht verfügbar';

  @override
  String get subscriptionNotAvailableMessageIOS =>
      'In-App-Käufe sind derzeit auf Ihrem Gerät nicht verfügbar. Um ein Abonnement abzuschließen, gehen Sie bitte zu Einstellungen > iTunes & App Store und stellen Sie sicher, dass Sie mit Ihrer Apple ID angemeldet sind und In-App-Käufe aktiviert sind.';

  @override
  String get subscriptionNotAvailableMessageAndroid =>
      'In-App-Käufe sind derzeit auf Ihrem Gerät nicht verfügbar. Dies kann an Einschränkungen oder Netzwerkproblemen liegen.\n\nBitte versuchen Sie es später erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.';

  @override
  String get subscriptionNotAvailableMessageDefault =>
      'In-App-Käufe sind derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.';

  @override
  String get subscriptionOkButton => 'OK';

  @override
  String get subscriptionRestoredSuccess =>
      '✅ Abonnement erfolgreich wiederhergestellt!';

  @override
  String get subscriptionNoPreviousFound =>
      'Kein vorheriges Abonnement zum Wiederherstellen gefunden.';

  @override
  String get subscriptionSubscribeButton => 'Jetzt abonnieren - \$4.99/Monat';

  @override
  String get subscriptionRestoreButton =>
      'Vorheriges Abonnement wiederherstellen';

  @override
  String get subscriptionLegalNotice =>
      'Mit dem Abonnieren stimmen Sie unseren Nutzungsbedingungen und Datenschutzrichtlinien zu.';

  @override
  String get subscriptionTermsLink => 'Nutzungsbedingungen';

  @override
  String get subscriptionSeparator => ' | ';

  @override
  String get subscriptionPrivacyLink => 'Datenschutzrichtlinie';

  @override
  String subscriptionAutoRenewNotice(String managementText) {
    return 'Das Abonnement verlängert sich automatisch, es sei denn, es wird mindestens 24 Stunden vor Ende des aktuellen Zeitraums gekündigt. $managementText';
  }

  @override
  String get subscriptionManageIOS =>
      'Sie können Ihr Abonnement in Ihren Apple ID-Kontoeinstellungen verwalten.';

  @override
  String get subscriptionManageAndroid =>
      'Sie können Ihr Abonnement im Google Play Store verwalten.';

  @override
  String get subscriptionManageDefault =>
      'Sie können Ihr Abonnement im App Store Ihres Geräts verwalten.';

  @override
  String get subscriptionPlatformAppStore => 'App Store';

  @override
  String get subscriptionPlatformPlayStore => 'Google Play Store';

  @override
  String get subscriptionPlatformGeneric => 'App Store';

  @override
  String get subscriptionDefaultBizOpp => 'Ihre Gelegenheit';

  @override
  String get termsScreenTitle => 'Nutzungsbedingungen';

  @override
  String get termsHeaderTitle => 'Nutzungsbedingungen';

  @override
  String get termsSubtitle =>
      'Vereinbarung für professionelle Netzwerkplattform';

  @override
  String termsLastUpdated(Object date) {
    return 'Zuletzt aktualisiert: $date';
  }

  @override
  String get termsFooterBadgeTitle => 'Apple Store-konform';

  @override
  String get termsFooterBadgeDescription =>
      'Diese Nutzungsbedingungen erfüllen alle Apple App Store-Richtlinien und -Anforderungen für Plattform-Anwendungen.';

  @override
  String get termsDisclaimerTitle => 'PROFESSIONELLE NETZWERKPLATTFORM';

  @override
  String get termsDisclaimerSubtitle => 'Dienstübersicht';

  @override
  String get privacyScreenTitle => 'Datenschutzerklärung';

  @override
  String get privacyHeaderTitle => 'Datenschutzerklärung';

  @override
  String privacyLastUpdated(Object date) {
    return 'Zuletzt aktualisiert: $date';
  }

  @override
  String get privacyEmailSubject => 'subject=Datenschutzerklärung-Anfrage';

  @override
  String privacyEmailError(Object email) {
    return 'Konnte E-Mail-Client nicht öffnen. Bitte kontaktieren Sie $email';
  }

  @override
  String get privacyMattersTitle => 'Ihr Datenschutz ist wichtig';

  @override
  String get privacyMattersDescription =>
      'Wir verpflichten uns, Ihre persönlichen Informationen zu schützen und Transparenz darüber zu bieten, wie Ihre Daten gesammelt, verwendet und geschützt werden.';

  @override
  String get privacyAppleComplianceTitle => 'Apple Datenschutz-Compliance';

  @override
  String get privacyAppleComplianceDescription =>
      'Diese App folgt Apples Datenschutzrichtlinien und App Store-Anforderungen für den Umgang mit Benutzerdaten.';

  @override
  String get privacyContactHeading => 'Kontaktieren Sie uns';

  @override
  String get privacyContactSubheading =>
      'Fragen zu dieser Datenschutzerklärung?';

  @override
  String get privacyContactDetails =>
      'Team Build Pro\nDatenschutzbeauftragter\nAntwort innerhalb von 48 Stunden';

  @override
  String privacyCopyright(Object year) {
    return '© $year Team Build Pro. Alle Rechte vorbehalten.';
  }

  @override
  String get privacyFooterDisclaimer =>
      'Diese Datenschutzerklärung ist wirksam ab dem oben genannten Datum und gilt für alle Benutzer der mobilen Team Build Pro-Anwendung.';

  @override
  String get howItWorksScreenTitle => 'Wie es funktioniert';

  @override
  String get howItWorksHeaderTitle => 'Wie es funktioniert';

  @override
  String get howItWorksHeroSubtitle =>
      'Transformieren Sie Ihre Rekrutierung mit einer vorqualifizierten Team-Pipeline.';

  @override
  String get howItWorksFeaturedOpportunity => 'Hervorgehobene Gelegenheit';

  @override
  String get howItWorksPipelineSystem => 'PIPELINE-SYSTEM';

  @override
  String get howItWorksStep1Title => '1. Profil einrichten';

  @override
  String howItWorksStep1Description(Object business) {
    return 'Richten Sie Ihr Profil ein und fügen Sie Ihren $business-Empfehlungslink hinzu.';
  }

  @override
  String get howItWorksStep2Title => '2. Teilen Sie Ihren Link';

  @override
  String get howItWorksStep2Description =>
      'Teilen Sie Ihren eindeutigen Empfehlungslink mit Kandidaten über Text, E-Mail, Social Media oder persönlich.';

  @override
  String get howItWorksStep3Title => '3. Automatisches Tracking & Wachstum';

  @override
  String howItWorksStep3Description(Object business) {
    return 'Während Kandidaten ihre eigenen Teams innerhalb der App aufbauen, werden sie automatisch zu Ihrem Team hinzugefügt, sobald sie der $business-Möglichkeit beitreten.';
  }

  @override
  String get howItWorksStep4Title => 'Schnelles Wachstum';

  @override
  String get howItWorksStep4Description =>
      'Ihre vorqualifizierten Kandidaten starten mit Dynamik, bereits vorhandenen Teams und bewährter Fähigkeit zu rekrutieren. Dies schafft eine sich selbst erhaltende Wachstumsmaschine.';

  @override
  String get howItWorksKeyTargetsTitle => ' WICHTIGE WACHSTUMSZIELE';

  @override
  String get howItWorksDirectSponsors => 'Direkte Sponsoren';

  @override
  String get howItWorksTotalTeam => 'Gesamte Teammitglieder';

  @override
  String get howItWorksCtaHeading => 'Erweitern Sie Ihr Netzwerk';

  @override
  String get howItWorksCtaDescription =>
      'Erweitern Sie Ihr Netzwerk, um das Organisationswachstum voranzutreiben!';

  @override
  String get howItWorksCtaButton => 'Bewährte Wachstumsstrategien';

  @override
  String get howItWorksDefaultBizOpp => 'Ihre Gelegenheit';

  @override
  String get termsDisclaimerContent =>
      '• Team Build Pro ist eine abonnementbasierte Netzwerkplattform\n• Benutzer zahlen für Software-Tools, nicht für eine Geschäftsmöglichkeit\n• Wir sind NICHT verbunden mit Drittanbieter-Geschäften\n• Keine Garantien für Einnahmen oder Geschäftserfolg';

  @override
  String get termsSection1Title => '1. AKZEPTANZ DER BEDINGUNGEN';

  @override
  String get termsSection1Content =>
      'Durch die Erstellung eines Kontos oder die Nutzung der App bestätigen Sie, dass:\n\n• Sie mindestens 18 Jahre alt sind oder das Mindestalter in Ihrer Gerichtsbarkeit erreicht haben\n• Sie die Fähigkeit haben, einen rechtsverbindlichen Vertrag abzuschließen\n• Sie diese Bedingungen vollständig gelesen und verstanden haben\n• Sie sich verpflichten, diese Bedingungen einzuhalten\n\nWenn Sie die App im Namen einer Organisation nutzen, bestätigen Sie, dass Sie die Befugnis haben, diese Organisation an diese Bedingungen zu binden.';

  @override
  String get termsSection2Title => '2. BESCHREIBUNG DES DIENSTES';

  @override
  String get termsSection2Content =>
      'Team Build Pro ist eine Software-as-a-Service (SaaS) Plattform, die Folgendes bietet:\n\nKERNFUNKTIONEN:\n• Empfehlungslink-Tracking und -Verwaltung\n• Team-Netzwerkvisualisierung und -Analysen\n• Kommunikationstools für Teammitglieder\n• Fortschrittsverfolgung für Geschäftsmöglichkeiten\n• Benachrichtigungen und Updates\n\nWICHTIGER DISCLAIMER:\n• Team Build Pro ist ein WERKZEUG, KEINE Geschäftsmöglichkeit\n• Wir sind NICHT verbunden mit Drittanbieter-Geschäftsmöglichkeiten\n• Wir VERKAUFEN KEINE Produkte oder Dienstleistungen\n• Wir GARANTIEREN KEINE Einnahmen oder Ergebnisse\n• Wir sind nur eine Softwareplattform für Tracking-Zwecke';

  @override
  String get termsSection3Title => '3. BENUTZERKONTEN UND VERANTWORTLICHKEITEN';

  @override
  String get termsSection3Content =>
      'KONTOERSTELLUNG:\n• Sie müssen genaue, vollständige Informationen bereitstellen\n• Sie sind verantwortlich für die Vertraulichkeit Ihres Kontos\n• Sie sind verantwortlich für alle Aktivitäten unter Ihrem Konto\n• Sie müssen uns sofort über unbefugte Zugriffe informieren\n\nVERBOTENE AKTIVITÄTEN:\n✗ Bereitstellung falscher oder irreführender Informationen\n✗ Ausgeben als eine andere Person oder Entität\n✗ Zugriff auf Konten anderer ohne Erlaubnis\n✗ Störung oder Unterbrechung des Dienstes\n✗ Reverse Engineering oder Versuch, Quellcode zu extrahieren\n✗ Verwendung automatisierter Systeme zum Scraping von Daten\n✗ Übertragung von Viren, Malware oder schädlichem Code\n✗ Verstoß gegen Gesetze oder Vorschriften\n✗ Belästigung, Missbrauch oder Schädigung anderer Benutzer\n\nVERSTÖSSE:\nVerletzungen können zu Kontosperrung oder -kündigung führen.';

  @override
  String get termsSection4Title => '4. DRITTANBIETER-GESCHÄFTSMÖGLICHKEITEN';

  @override
  String get termsSection4Content =>
      'KRITISCHER DISCLAIMER:\n\nTeam Build Pro ist eine UNABHÄNGIGE Softwareplattform. Wir:\n\n✗ BESITZEN KEINE Geschäftsmöglichkeiten\n✗ BETREIBEN KEINE Geschäftsmöglichkeiten\n✗ SIND NICHT VERBUNDEN MIT Geschäftsmöglichkeiten\n✗ UNTERSTÜTZEN KEINE Geschäftsmöglichkeiten\n✗ GARANTIEREN KEINE Ergebnisse von Geschäftsmöglichkeiten\n\nWenn Sie sich entscheiden, einer Geschäftsmöglichkeit beizutreten:\n\n• Sie tun dies UNABHÄNGIG von Team Build Pro\n• Sie unterliegen DEREN Bedingungen und Vereinbarungen\n• Team Build Pro ist NICHT verantwortlich für deren Handlungen\n• Team Build Pro GARANTIERT KEINE Einnahmen oder Ergebnisse\n• Sie erkennen an, dass es ein SEPARATES Geschäft ist\n\nREFERRAL LINK TRACKING:\n• Wir verfolgen nur Empfehlungslinks zu Tracking-Zwecken\n• Wir validieren oder garantieren keine Links\n• Wir sind nicht verantwortlich für Link-Funktionalität\n• Sie sind verantwortlich für die Genauigkeit Ihrer Links\n\nRISIKO-ANERKENNUNG:\n• Alle Geschäftsmöglichkeiten bergen finanzielle Risiken\n• Sie sollten Ihre eigene Due Diligence durchführen\n• Konsultieren Sie bei Bedarf Fachleute (Rechts-, Finanz-, etc.)\n• Team Build Pro bietet keine Geschäfts- oder Anlageberatung';

  @override
  String get termsSection5Title => '5. GEISTIGE EIGENTUMSRECHTE';

  @override
  String get termsSection5Content =>
      'UNSERE RECHTE:\nTeam Build Pro besitzt alle Rechte an:\n• App-Quellcode und Software\n• Marken, Logos und Branding\n• Inhalte, Texte und Bilder\n• Design, Layout und Benutzeroberfläche\n• Datenbank-Struktur und Organisation\n\nIHRE RECHTE:\nSie behalten das Eigentum an:\n• Ihren persönlichen Informationen\n• Von Ihnen erstellten Inhalten\n• Ihrer Geschäftsinformationen\n\nLIZENZ FÜR UNS:\nDurch das Hochladen von Inhalten gewähren Sie uns das Recht:\n• Ihre Inhalte zu speichern und zu verarbeiten\n• Inhalte anzuzeigen, um den Dienst bereitzustellen\n• Backups für Datenschutzzwecke zu erstellen\n\nBESCHRÄNKUNGEN:\nSie dürfen NICHT:\n• Unsere Marken ohne Erlaubnis verwenden\n• Die App oder Teile davon kopieren\n• White-Label-Lösungen erstellen\n• Unseren Code oder unsere Designs stehlen';

  @override
  String get termsSection6Title => '6. ZAHLUNGSBEDINGUNGEN';

  @override
  String get termsSection6Content =>
      'ABONNEMENTSTRUKTUR:\n• Abonnements werden monatlich oder jährlich abgerechnet\n• Zahlungen werden über App Store oder Google Play verarbeitet\n• Die Preisgestaltung wird in der App angezeigt\n• Alle Preise sind in USD, sofern nicht anders angegeben\n\nAUTOMATISCHE VERLÄNGERUNG:\n• Abonnements verlängern sich automatisch\n• Sie werden 24 Stunden vor der Verlängerung belastet\n• Stornieren Sie mindestens 24 Stunden im Voraus, um Gebühren zu vermeiden\n• Verwalten Sie Abonnements in den App Store-Einstellungen\n\nRÜCKERSTATTUNGSRICHTLINIE:\n• Rückerstattungen unterliegen den Richtlinien von Apple/Google\n• Kontaktieren Sie den Support für Rückerstattungsanfragen\n• Wir können nach eigenem Ermessen Rückerstattungen gewähren\n• Keine Rückerstattungen für teilweise genutzte Zeiträume\n\nKOSTENLOSE TESTVERSIONEN:\n• Kostenlose Testversionen können verfügbar sein\n• Kreditkarte kann für Testversionen erforderlich sein\n• Stornieren Sie vor Ende der Testversion, um Gebühren zu vermeiden\n• Nur eine kostenlose Testversion pro Benutzer';

  @override
  String get termsSection7Title => '7. DATENSCHUTZ UND SICHERHEIT';

  @override
  String get termsSection7Content =>
      'DATENSAMMLUNG:\nWir sammeln:\n• Kontoinformationen (Name, E-Mail, etc.)\n• Teamnetzwerkdaten\n• Nutzungsstatistiken\n• Geräteinformationen\n• Standortdaten (wenn erlaubt)\n\nDATENNUTZUNG:\nIhre Daten werden verwendet für:\n• Bereitstellung und Verbesserung des Dienstes\n• Senden von Benachrichtigungen und Updates\n• Kundenservice und Support\n• Analysen und Erkenntnisse\n• Rechtliche Compliance\n\nDATENSICHERHEIT:\nWir implementieren:\n• Branchen-Standard-Verschlüsselung\n• Sichere Datenspeicherung\n• Zugangskontrollen\n• Regelmäßige Sicherheitsaudits\n\nVollständige Details finden Sie in unserer Datenschutzerklärung.';

  @override
  String get termsSection8Title =>
      '8. HAFTUNGSAUSSCHLUSS UND HAFTUNGSBESCHRÄNKUNGEN';

  @override
  String get termsSection8Content =>
      'DER DIENST WIRD \"WIE BESEHEN\" BEREITGESTELLT:\n• Wir garantieren keine ununterbrochene Verfügbarkeit\n• Wir garantieren keine fehlerfreie Bedienung\n• Wir garantieren keine spezifischen Ergebnisse\n• Wir garantieren keine Kompatibilität mit allen Geräten\n\nKEINE GESCHÄFTSGARANTIEN:\n• Wir garantieren KEINE Einnahmen oder Gewinne\n• Wir garantieren KEINEN Geschäftserfolg\n• Wir garantieren KEINE Empfehlungen oder Signups\n• Wir sind NICHT verantwortlich für Ihre Geschäftsentscheidungen\n\nHAFTUNGSBESCHRÄNKUNG:\nIn maximalem gesetzlich zulässigem Umfang:\n\n• Unsere Haftung ist auf die Gebühren beschränkt, die Sie bezahlt haben\n• Wir haften nicht für indirekte oder Folgeschäden\n• Wir haften nicht für entgangene Gewinne oder Daten\n• Wir haften nicht für Handlungen Dritter\n\nFREISPRUCH:\nSie verpflichten sich, Team Build Pro von Ansprüchen freizustellen, die sich ergeben aus:\n• Ihrer Nutzung der App\n• Ihrer Verletzung dieser Bedingungen\n• Ihrer Verletzung von Rechten Dritter\n• Ihren Geschäftsaktivitäten';

  @override
  String get termsSection9Title => '9. KÜNDIGUNG';

  @override
  String get termsSection9Content =>
      'KÜNDIGUNG DURCH SIE:\n• Sie können Ihr Konto jederzeit schließen\n• Verwenden Sie die Funktion \"Konto löschen\" in der App\n• Stornieren Sie Abonnements über App Store-Einstellungen\n• Die Löschung ist dauerhaft und kann nicht rückgängig gemacht werden\n\nKÜNDIGUNG DURCH UNS:\nWir können Ihr Konto beenden, wenn:\n• Sie gegen diese Bedingungen verstoßen\n• Sie sich an verbotenen Aktivitäten beteiligen\n• Wir den Dienst einstellen\n• Gesetzlich erforderlich\n\nFOLGEN DER KÜNDIGUNG:\n• Sofortiger Verlust des Zugangs zur App\n• Löschen Sie Kontodaten gemäß unserer Richtlinie\n• Keine Rückerstattung für teilweise genutzte Zeiträume\n• Netzwerkbeziehungen können zur Geschäftskontinuität erhalten bleiben';

  @override
  String get termsSection10Title => '10. ÄNDERUNGEN DER BEDINGUNGEN';

  @override
  String get termsSection10Content =>
      'Wir behalten uns das Recht vor, diese Bedingungen jederzeit zu ändern:\n\n• Änderungen treten beim Posten in Kraft\n• Wir werden Sie über wesentliche Änderungen informieren\n• Die fortgesetzte Nutzung bedeutet Akzeptanz der neuen Bedingungen\n• Wenn Sie nicht zustimmen, müssen Sie die Nutzung einstellen\n\nÜberprüfen Sie diese Bedingungen regelmäßig auf Updates.';

  @override
  String get termsSection11Title => '11. ANWENDBARES RECHT';

  @override
  String get termsSection11Content =>
      'GERICHTSSTAND:\nDiese Bedingungen unterliegen den Gesetzen von [Gerichtsbarkeit], ohne Berücksichtigung von Kollisionsnormen.\n\nSTREITBEILEGUNG:\n• Versuchen Sie zunächst, Streitigkeiten informell beizulegen\n• Kontaktieren Sie support@teambuildpro.com\n• Bei Bedarf kann Mediation oder Schiedsverfahren erforderlich sein\n• Einige Gerichtsbarkeiten erlauben keine Beschränkung von Rechten\n\nKLASSENKLAGENVERZICHT:\nSie stimmen zu, Ansprüche nur auf individueller Basis geltend zu machen, nicht als Sammelklage.';

  @override
  String get termsSection12Title => '12. VERSCHIEDENES';

  @override
  String get termsSection12Content =>
      'VOLLSTÄNDIGE VEREINBARUNG:\nDiese Bedingungen stellen die vollständige Vereinbarung zwischen Ihnen und Team Build Pro dar.\n\nTRENNBARKEIT:\nWenn eine Bestimmung für ungültig befunden wird, bleiben die übrigen Bestimmungen in Kraft.\n\nVERZICHT:\nDas Versäumnis, ein Recht durchzusetzen, stellt keinen Verzicht dar.\n\nABTRETUNG:\nSie dürfen diese Bedingungen nicht ohne unsere schriftliche Zustimmung abtreten.\n\nKONTAKT:\nFür Fragen zu diesen Bedingungen:\n• E-Mail: support@teambuildpro.com\n• Website: www.teambuildpro.com';

  @override
  String get termsSection13Title => '13. FREISTELLUNG';

  @override
  String get termsSection13Content =>
      'Sie stimmen zu, Team Build Pro, seine verbundenen Unternehmen, Direktoren, leitenden Angestellten, Mitarbeiter und Agenten von allen Ansprüchen, Verbindlichkeiten, Schäden, Verlusten und Ausgaben freizustellen und schadlos zu halten, einschließlich, aber nicht beschränkt auf angemessene Rechts- und Buchhaltungsgebühren, die sich aus oder in irgendeiner Weise im Zusammenhang mit (a) Ihrer Nutzung der App, (b) Ihrer Verletzung dieser Bedingungen oder (c) Ihrer Verletzung von Rechten Dritter ergeben.';

  @override
  String get termsSection14Title => '14. STREITBEILEGUNG';

  @override
  String get termsSection14Content =>
      'INFORMELLE LÖSUNG:\nBevor Sie ein formelles Streitbeilegungsverfahren einleiten, kontaktieren Sie uns bitte zuerst unter support@teambuildpro.com und beschreiben Sie das Problem. Wir werden versuchen, es informell zu lösen.\n\nSCHIEDSVERFAHREN:\nFalls die informelle Lösung fehlschlägt, stimmen Sie zu, dass alle Streitigkeiten durch verbindliches Schiedsverfahren beigelegt werden. Jede Partei wird ihre eigenen Kosten tragen.\n\nKLASSENKLAGENVERZICHT:\nSie stimmen zu, Ansprüche nur auf individueller Basis geltend zu machen, nicht als Teil einer Sammelklage.\n\nGERICHTSSTAND:\nFür Streitigkeiten, die nicht dem Schiedsverfahren unterliegen, unterliegen diese den Gerichten von [Gerichtsbarkeit].';

  @override
  String get termsSection15Title => '15. ÄNDERUNGEN DER BEDINGUNGEN';

  @override
  String get termsSection15Content =>
      'ÄNDERUNGEN:\n• Wir können diese Bedingungen jederzeit aktualisieren\n• Änderungen werden bei Veröffentlichung in der App wirksam\n• Fortgesetzte Nutzung stellt Akzeptanz der Änderungen dar\n• Wesentliche Änderungen werden per E-Mail oder App-Benachrichtigung kommuniziert\n\nIHRE OPTIONEN:\n• Überprüfen Sie die Bedingungen regelmäßig auf Änderungen\n• Wenn Sie mit Änderungen nicht einverstanden sind, beenden Sie die Nutzung der App\n• Kündigen Sie Ihr Abonnement, wenn Sie neue Bedingungen nicht akzeptieren\n• Kontaktieren Sie support@teambuildpro.com bei Fragen\n\nINKRAFTTRETEN:\n• Aktuelle Version gilt ab Veröffentlichungsdatum\n• Frühere Versionen werden ersetzt\n• Wir führen Aufzeichnungen über Bedingungsversionen';

  @override
  String get termsSection16Title => '16. ALLGEMEINE BESTIMMUNGEN';

  @override
  String get termsSection16Content =>
      'VOLLSTÄNDIGKEIT:\nDiese Bedingungen stellen die vollständige Vereinbarung zwischen Ihnen und Team Build Pro dar.\n\nTRENNBARKEIT:\nWenn eine Bestimmung für ungültig befunden wird, bleiben die übrigen Bestimmungen wirksam.\n\nVERZICHT:\nDas Versäumnis, eine Bestimmung durchzusetzen, stellt keinen Verzicht dar.\n\nABTRETUNG:\nSie dürfen diese Bedingungen nicht ohne unsere schriftliche Zustimmung abtreten.\n\nÄNDERUNGEN:\nWir können diese Bedingungen jederzeit ändern. Änderungen treten beim Posten in Kraft.\n\nBENACHRICHTIGUNGEN:\nBenachrichtigungen werden per E-Mail oder In-App-Nachricht gesendet.\n\nSPRACHE:\nIm Falle von Konflikten hat die englische Version Vorrang.\n\nÜBERLEBEN:\nBestimmungen, die nach Kündigung überleben sollten, bleiben wirksam.';

  @override
  String get privacySection1Title => '1. VON UNS GESAMMELTE INFORMATIONEN';

  @override
  String get privacySection1Content =>
      'Wir sammeln verschiedene Arten von Informationen:\n\nKONTOINFORMATIONEN:\n• Vollständiger Name\n• E-Mail-Adresse\n• Telefonnummer (optional)\n• Standortinformationen (Stadt, Bundesland, Land)\n• Profilbild (optional)\n• Bio und persönliche Beschreibung\n\nGESCHÄFTSINFORMATIONEN:\n• Empfehlungslinks zu Geschäftsmöglichkeiten\n• Teamnetzwerkbeziehungen\n• Sponsor-/Upline-Informationen\n• Fortschrittsmeilensteine und Leistungen\n\nNUTZUNGSDATEN:\n• App-Nutzungsstatistiken\n• Funktion-Interaktionen\n• Anmelde-/Abmeldeereignisse\n• Fehlerberichte und Absturzprotokolle\n• Gerätetyp und Betriebssystemversion\n\nKOMMUNIKATIONEN:\n• In-App-Nachrichten zwischen Benutzern\n• Kontaktaufnahmen mit dem Kundensupport\n• Feedback und Umfrageantworten\n\nAUTOMATISCH GESAMMELTE DATEN:\n• IP-Adresse\n• Gerät-Identifikatoren\n• Cookie-Daten\n• Standortdaten (mit Erlaubnis)\n• Analytics-Informationen';

  @override
  String get privacySection2Title => '2. WIE WIR IHRE INFORMATIONEN VERWENDEN';

  @override
  String get privacySection2Content =>
      'Wir verwenden Ihre Informationen für:\n\nDIENSTBEREITSTELLUNG:\n• Erstellen und Verwalten Ihres Kontos\n• Bereitstellen von Teamnetzwerk-Tracking\n• Ermöglichen der Kommunikation zwischen Benutzern\n• Verarbeiten von Empfehlungslinks\n• Liefern von Benachrichtigungen und Updates\n\nVERBESSERUNG DES DIENSTES:\n• Analysieren der App-Nutzung\n• Identifizieren und Beheben technischer Probleme\n• Entwickeln neuer Funktionen\n• Verbessern der Benutzererfahrung\n• Durchführen von Forschung und Analyse\n\nKOMMUNIKATION:\n• Senden von transaktionalen E-Mails\n• Bereitstellen von Kundensupport\n• Senden von Marketing-Mitteilungen (mit Zustimmung)\n• Benachrichtigen über wichtige Updates\n\nRECHTLICHE COMPLIANCE:\n• Erfüllung rechtlicher Verpflichtungen\n• Durchsetzen unserer Nutzungsbedingungen\n• Schutz unserer Rechte und Sicherheit\n• Verhinderung von Betrug und Missbrauch';

  @override
  String get privacySection3Title => '3. DATENWEITERGABE UND OFFENLEGUNG';

  @override
  String get privacySection3Content =>
      'Wir verkaufen Ihre persönlichen Daten NICHT. Wir können Daten teilen mit:\n\nDIENSTLEISTERN:\n• Cloud-Hosting-Anbieter (Firebase/Google Cloud)\n• Analytics-Anbieter\n• Zahlungsabwickler (Apple, Google)\n• Kundensupport-Tools\n• E-Mail-Dienstleister\n\nGESCHÄFTLICHE ÜBERTRAGUNGEN:\n• Im Falle von Fusion, Akquisition oder Vermögensverkauf\n• Mit ordnungsgemäßer Benachrichtigung an Benutzer\n\nRECHTLICHE ANFORDERUNGEN:\n• Wenn gesetzlich erforderlich\n• Zur Reaktion auf Vorladungen oder Gerichtsbeschlüsse\n• Zum Schutz unserer Rechte oder der Sicherheit anderer\n• Zur Verhinderung illegaler Aktivitäten\n\nMIT IHRER ZUSTIMMUNG:\n• Wenn Sie uns ausdrückliche Erlaubnis geben\n• Für spezifische Zwecke, die Sie autorisieren\n\nÖFFENTLICHE INFORMATIONEN:\n• Profilname und Bild (kontrollierbar in den Einstellungen)\n• Teamnetzwerkbeziehungen (sichtbar für verbundene Benutzer)\n• Öffentlich geteilte Inhalte';

  @override
  String get privacySection4Title => '4. DATENSICHERHEIT';

  @override
  String get privacySection4Content =>
      'Wir implementieren Sicherheitsmaßnahmen gemäß Industriestandards:\n\nVERSCHLÜSSELUNG:\n• SSL/TLS-Verschlüsselung für die Datenübertragung\n• Verschlüsselung im Ruhezustand für gespeicherte Daten\n• End-to-End-Verschlüsselung für Nachrichten\n\nZUGANGSKONTROLLEN:\n• Sichere Authentifizierung\n• Rollenbasierte Zugangsberechtigungen\n• Regelmäßige Zugriffsaudits\n• Biometrische Authentifizierung (optional)\n\nINFRASTRUKTUR:\n• Sichere Cloud-Hosting (Google Cloud/Firebase)\n• Regelmäßige Sicherheitspatches und Updates\n• Firewalls und Eindringlingserkennung\n• Backup- und Wiederherstellungssysteme\n\nBESTE PRAKTIKEN:\n• Verwenden Sie sichere Passwörter\n• Aktivieren Sie biometrische Authentifizierung\n• Halten Sie die App auf dem neuesten Stand\n• Melden Sie verdächtige Aktivitäten sofort\n• Halten Sie Ihr Gerät und die App auf dem neuesten Stand\n\nEINSCHRÄNKUNGEN:\n• Kein System ist zu 100% sicher\n• Sie nutzen die App auf eigenes Risiko\n• Wir können absolute Sicherheit nicht garantieren\n• Melden Sie Sicherheitsbedenken an: support@teambuildpro.com';

  @override
  String get privacySection5Title => '5. IHRE DATENSCHUTZRECHTE';

  @override
  String get privacySection5Content =>
      'Sie haben die folgenden Rechte in Bezug auf Ihre Daten:\n\nZUGANG UND PORTABILITÄT:\n• Fordern Sie eine Kopie Ihrer persönlichen Daten an\n• Exportieren Sie Ihre Daten in einem portablen Format\n• Überprüfen Sie, welche Informationen wir über Sie haben\n\nKORREKTUR:\n• Aktualisieren Sie ungenaue Informationen\n• Ändern Sie Ihre Profildetails\n• Korrigieren Sie Fehler in Ihrem Konto\n\nLÖSCHUNG:\n• Fordern Sie die Löschung Ihres Kontos und Ihrer Daten an\n• Verwenden Sie die Funktion \"Konto löschen\" in der App\n• Einige Daten können aus rechtlichen Compliance-Gründen aufbewahrt werden\n• Die Löschung ist dauerhaft und kann nicht rückgängig gemacht werden\n\nOPT-OUT:\n• Abmelden von Marketing-E-Mails\n• Deaktivieren von Push-Benachrichtigungen in den Geräteeinstellungen\n• Begrenzen der Analytics-Datenerfassung\n\nUM RECHTE AUSZUÜBEN:\n• Verwenden Sie In-App-Einstellungen, wo verfügbar\n• E-Mail: support@teambuildpro.com\n• Wir werden innerhalb von 30 Tagen antworten\n• Identitätsverifizierung kann erforderlich sein';

  @override
  String get privacySection6Title => '6. DATENAUFBEWAHRUNG';

  @override
  String get privacySection6Content =>
      'WIE LANGE WIR DATEN AUFBEWAHREN:\n\nAKTIVE KONTEN:\n• Daten werden aufbewahrt, während Ihr Konto aktiv ist\n• Notwendig zur Bereitstellung fortlaufender Dienste\n• Sie können Daten oder Konto jederzeit löschen\n\nGELÖSCHTE KONTEN:\n• Die meisten Daten werden innerhalb von 30 Tagen gelöscht\n• Einige Daten werden aus rechtlichen Compliance-Gründen aufbewahrt\n• Backup-Systeme werden innerhalb von 90 Tagen gelöscht\n• Finanzunterlagen werden gemäß gesetzlichen Anforderungen aufbewahrt\n\nGESETZLICHE AUFBEWAHRUNG:\n• Transaktionsaufzeichnungen: Wie gesetzlich vorgeschrieben\n• Steuerunterlagen: Gemäß Steuergesetzen\n• Streitbeilegung: Bis zur Beilegung\n• Sicherheitsprotokolle: Wie für Sicherheitszwecke erforderlich';

  @override
  String get privacySection7Title => '7. KINDER-DATENSCHUTZ';

  @override
  String get privacySection7Content =>
      'Die App ist NICHT für Kinder unter 18 Jahren bestimmt:\n\n• Wir sammeln wissentlich keine Daten von Kindern\n• Benutzer müssen 18+ sein oder das Mindestalter in ihrer Gerichtsbarkeit erreicht haben\n• Wenn wir von Minderjährigen-Daten erfahren, löschen wir diese\n• Eltern sollten die Internetnutzung von Kindern überwachen\n\nWenn Sie glauben, dass wir unbeabsichtigt Daten von einem Minderjährigen gesammelt haben, kontaktieren Sie uns sofort unter support@teambuildpro.com';

  @override
  String get privacySection8Title => '8. INTERNATIONALE DATENÜBERTRAGUNGEN';

  @override
  String get privacySection8Content =>
      'Ihre Daten können verarbeitet werden in:\n\n• Vereinigte Staaten\n• Europäische Union\n• Andere Länder, in denen unsere Dienstleister tätig sind\n\nDATENSCHUTZSCHILDE:\nWir implementieren geeignete Sicherheitsvorkehrungen:\n• Standard-Vertragsklauseln\n• Angemessenheitsbeschlüsse\n• Zertifizierungen und Compliance-Programme\n\nGDPR COMPLIANCE:\nFür EU-Benutzer:\n• Rechtmäßige Grundlage für die Verarbeitung\n• Datenschutz-Folgenabschätzungen\n• Einhaltung der GDPR-Anforderungen\n• Rechte gemäß GDPR';

  @override
  String get subscriptionScreenTitle => 'Team Build Pro';

  @override
  String get subscriptionSuccessMessage =>
      '✅ Abonnement erfolgreich aktiviert!';

  @override
  String get subscriptionRestoreSuccess =>
      '✅ Abonnement erfolgreich wiederhergestellt!';

  @override
  String get subscriptionRestoreNone =>
      'Kein früheres Abonnement zur Wiederherstellung gefunden.';

  @override
  String get subscriptionStatusTrial => 'Kostenlose Testversion aktiv';

  @override
  String subscriptionStatusTrialSubtitle(int days) {
    return '$days Tage verbleiben in Ihrer Testversion';
  }

  @override
  String get subscriptionPremiumFeaturesHeader => 'Premium-Funktionen:';

  @override
  String subscriptionFeatureReferralLink(String bizOpp) {
    return 'Reichen Sie Ihren einzigartigen $bizOpp-Empfehlungslink ein';
  }

  @override
  String get subscriptionFeatureAiCoaching =>
      'Individuelles KI-Coaching für Rekrutierung und Teamentwicklung';

  @override
  String get subscriptionFeatureMessaging =>
      'Schalten Sie Nachrichten an Benutzer in Ihrem Team frei';

  @override
  String subscriptionFeatureEnsureTeam(String bizOpp) {
    return 'Stellen Sie sicher, dass Teammitglieder unter IHNEN in $bizOpp beitreten';
  }

  @override
  String get subscriptionFeatureAnalytics =>
      'Erweiterte Analysen und Einblicke';

  @override
  String get subscriptionManagementApple =>
      'Sie können Ihr Abonnement in den Einstellungen Ihres Apple-ID-Kontos verwalten.';

  @override
  String get subscriptionManagementGoogle =>
      'Sie können Ihr Abonnement im Google Play Store verwalten.';

  @override
  String get faqTitle => 'Häufig gestellte Fragen';

  @override
  String get faqSearchHint => 'FAQs durchsuchen...';

  @override
  String get faqCategoryGettingStarted => 'Erste Schritte';

  @override
  String get faqCategoryBusinessModel => 'Geschäftsmodell und Legitimität';

  @override
  String get faqCategoryHowItWorks => 'Wie es funktioniert';

  @override
  String get faqCategoryTeamBuilding => 'Teamaufbau und Management';

  @override
  String get faqCategoryGlobalFeatures => 'Globale und technische Funktionen';

  @override
  String get faqCategoryPrivacySecurity => 'Datenschutz und Sicherheit';

  @override
  String get faqCategoryPricing => 'Preise und geschäftlicher Wert';

  @override
  String get faqCategoryConcerns => 'Häufige Bedenken und Einwände';

  @override
  String get faqCategorySuccess => 'Erfolg und Ergebnisse';

  @override
  String get faqCategorySupport => 'Support und Schulung';

  @override
  String get faqQ1 => 'Was genau ist Team Build Pro?';

  @override
  String get faqA1 =>
      'Team Build Pro ist ein professionelles Software-Tool, das Direktvertriebs- und Teamaufbau-Profis dabei hilft, ihre Netzwerke effektiver zu verwalten und auszubauen. Es ist eine abonnementbasierte SaaS-Lösung, keine Geschäftsmöglichkeit oder MLM-Firma.';

  @override
  String get faqQ2 =>
      'Ist Team Build Pro ein MLM- oder Network-Marketing-Unternehmen?';

  @override
  String get faqA2 =>
      'Nein. Team Build Pro ist ein Technologieunternehmen, das Unternehmenssoftware für Teamaufbau-Profis bereitstellt. Wir sind ein legitimes SaaS-Tool ähnlich wie Salesforce oder HubSpot, aber fokussiert auf die einzigartigen Bedürfnisse von Direktvertriebs- und Teamaufbau-Profis.';

  @override
  String get faqQ3 =>
      'Warum konzentriert sich Team Build Pro auf Direktvertriebsprofis, wenn Sie kein MLM-Unternehmen sind?';

  @override
  String get faqA3 =>
      'So wie Salesforce Vertriebsmitarbeiter bedient, bedienen wir Direktvertriebsprofis. Direktvertrieb und Network-Marketing sind legitime Branchen, die professionelle Software benötigen. Wir sind das Werkzeug, nicht die Geschäftsmöglichkeit.';

  @override
  String get faqQ4 => 'Wie melde ich mich an?';

  @override
  String get faqA4 =>
      'Laden Sie die Team Build Pro App aus dem App Store oder Google Play herunter. Sie können sich mit einem Empfehlungscode eines bestehenden Mitglieds oder direkt über unsere Website anmelden. Neue Benutzer erhalten eine 30-tägige kostenlose Testversion, keine Kreditkarte erforderlich.';

  @override
  String get faqQ5 => 'Wie funktioniert das Empfehlungssystem?';

  @override
  String get faqA5 =>
      'Bestehende Mitglieder können Empfehlungscodes mit neuen Benutzern teilen. Wenn sich jemand mit Ihrem Code anmeldet, wird er Teil Ihres Netzwerks in der App. Dies ist einfach eine Netzwerk-Tracking-Funktion - es gibt keine Provisionen, Zahlungen oder Vergütungsstruktur.';

  @override
  String get faqQ6 => 'Wie verfolgt Team Build Pro mein Netzwerk?';

  @override
  String get faqA6 =>
      'Die App verfolgt automatisch Ihre Teammitglieder, wenn sie sich mit Ihrem Empfehlungscode anmelden. Sie können Ihr gesamtes Netzwerk, Teamwachstum und erreichte Aufbau-Meilensteine einsehen. Die Netzwerkstruktur basiert darauf, wer wen empfohlen hat, und erstellt eine visuelle Hierarchie Ihrer Organisation.';

  @override
  String get faqQ7 =>
      'Kann ich mit Teammitgliedern über die App kommunizieren?';

  @override
  String get faqA7 =>
      'Ja! Team Build Pro enthält sichere Direktnachrichten, Gruppen-Chats und ein umfassendes Benachrichtigungssystem, um Sie mit Ihrem Team verbunden zu halten. Sie können Updates teilen, Support bieten und Teamaufbau-Aktivitäten koordinieren - alles innerhalb der App.';

  @override
  String get faqQ8 =>
      'Kann ich Teammitglieder einladen, die nicht in der App sind?';

  @override
  String get faqA8 =>
      'Absolut. Team Build Pro ermöglicht es Ihnen, personalisierte Empfehlungscodes per SMS, E-Mail oder Social Media zu versenden. Neue Mitglieder können sich mit diesen Codes anmelden, um automatisch Ihrem Netzwerk im System beizutreten.';

  @override
  String get faqQ9 => 'Was sind Aufbau-Meilensteine?';

  @override
  String get faqA9 =>
      'Aufbau-Meilensteine sind Teamwachstums-Erfolge, die Sie freischalten, während Ihr Netzwerk wächst. Sie erhalten Benachrichtigungen, wenn Teammitglieder bestimmte Ebenen erreichen, was Ihnen hilft, Fortschritte zu verfolgen und Erfolge gemeinsam zu feiern.';

  @override
  String get faqQ10 => 'Wie funktioniert die Berechtigungs-Verfolgung?';

  @override
  String get faqA10 =>
      'Team Build Pro ermöglicht es Ihnen, benutzerdefinierte Berechtigungsqualifikationen basierend auf den Anforderungen Ihrer Geschäftsmöglichkeit einzurichten und zu verfolgen. Diese Qualifikationen sind für Sie und relevante Teammitglieder sichtbar und helfen allen, auf Kurs mit ihren Zielen zu bleiben.';

  @override
  String get faqQ11 => 'Kann ich Team Build Pro in mehreren Ländern verwenden?';

  @override
  String get faqA11 =>
      'Ja! Team Build Pro unterstützt über 120 Länder mit nativer Zeitzonen-Unterstützung, lokalen Währungen und mehreren Sprachen. Ob Ihr Team in New York, London, Tokio oder São Paulo ist, jeder sieht relevante lokalisierte Informationen.';

  @override
  String get faqQ12 => 'Welche Sprachen unterstützt die App?';

  @override
  String get faqA12 =>
      'Wir unterstützen derzeit Englisch, Spanisch, Portugiesisch und Deutsch, mit Plänen, weitere Sprachen basierend auf der Benutzernachfrage hinzuzufügen. Die App erkennt automatisch die Spracheinstellung Ihres Geräts.';

  @override
  String get faqQ13 =>
      'Wie geht Team Build Pro mit verschiedenen Zeitzonen um?';

  @override
  String get faqA13 =>
      'Alle Benachrichtigungen, Event-Zeiten und Aktivitätsprotokolle werden automatisch an die lokale Zeitzone jedes Benutzers angepasst. Dies stellt sicher, dass globale Teammitglieder genaue und relevante Informationen sehen, unabhängig davon, wo sie sich befinden.';

  @override
  String get faqQ14 => 'Sind meine persönlichen Daten sicher?';

  @override
  String get faqA14 =>
      'Ja. Wir verwenden Unternehmensverschlüsselung, sichere Server-zu-Server-Kommunikation und halten die höchsten Datenschutzstandards ein. Ihre persönlichen Daten werden niemals ohne Ihre ausdrückliche Zustimmung an Dritte weitergegeben.';

  @override
  String get faqQ15 => 'Wer kann meine Netzwerkinformationen sehen?';

  @override
  String get faqA15 =>
      'Nur Sie und Ihre direkten Sponsoren können vollständige Details Ihres Netzwerks sehen. Teammitglieder können ihre eigene Upline und Downline sehen, können aber nicht auf Informationen über parallele Zweige oder persönliche Informationen anderer Mitglieder ohne entsprechende Berechtigungen zugreifen.';

  @override
  String get faqQ16 => 'Speichert die App meine Kreditkarteninformationen?';

  @override
  String get faqA16 =>
      'Nein. Die gesamte Zahlungsabwicklung erfolgt über Apples sicheres In-App-Kaufsystem. Wir sehen oder speichern niemals Ihre Kreditkarteninformationen. Abonnements werden über Ihr Apple-ID-Konto verwaltet.';

  @override
  String get faqQ17 => 'Kann ich mein Konto und meine Daten löschen?';

  @override
  String get faqA17 =>
      'Ja. Sie können jederzeit über die App-Einstellungen eine vollständige Kontolöschung anfordern. Dies entfernt dauerhaft Ihre persönlichen Daten aus unseren Systemen gemäß DSGVO- und LGPD-Vorschriften.';

  @override
  String get faqQ18 => 'Was kostet Team Build Pro?';

  @override
  String get faqA18 =>
      'Wir bieten eine 30-tägige kostenlose Testversion an, danach kostet Team Build Pro 4,99 USD pro Monat oder 49,99 USD pro Jahr (17% Ersparnis). Die Preise können je nach Region aufgrund von Wechselkursen und lokalen Steuern variieren.';

  @override
  String get faqQ19 => 'Gibt es eine kostenlose Testphase?';

  @override
  String get faqA19 =>
      'Ja! Alle neuen Benutzer erhalten 30 volle Tage Premium-Zugang ohne Kreditkarte. Testen Sie alle Funktionen, bevor Sie sich für ein Abonnement verpflichten.';

  @override
  String get faqQ20 => 'Wie kündige ich mein Abonnement?';

  @override
  String get faqA20 =>
      'Kündigen Sie jederzeit über Ihre Apple App Store Abonnementeinstellungen. Keine Kündigungsgebühren oder Verpflichtungszeiträume. Ihr Zugriff bleibt bis zum Ende des aktuellen Abrechnungszeitraums bestehen.';

  @override
  String get faqQ21 => 'Gibt es einen Familien- oder Team-Plan?';

  @override
  String get faqA21 =>
      'Jedes Teammitglied führt sein eigenes individuelles Abonnement. Dies stellt sicher, dass jeder vollen Zugriff auf Funktionen hat und sein eigenes Konto unabhängig verwalten kann. Wir prüfen Team-Lizenzierungsoptionen für zukünftige Versionen.';

  @override
  String get faqQ22 => 'Welchen Wert bekomme ich für das Abonnement?';

  @override
  String get faqA22 =>
      'Für weniger als die Kosten eines Kaffees pro Monat erhalten Sie professionelles Netzwerk-Tracking, unbegrenzte Team-Kommunikation, Wachstumsanalysen, automatisierte Meilensteine, Compliance-Funktionen und kontinuierlichen Support. Vergleichen Sie das mit ähnlicher Unternehmenssoftware, die 50-500+ USD pro Monat kostet.';

  @override
  String get faqQ23 => 'Ist Team Build Pro ein Pyramidensystem?';

  @override
  String get faqA23 =>
      'Nein. Team Build Pro ist ein Software-Tool, keine Geschäftsmöglichkeit. Es gibt keine Rekrutierung, Zahlungen oder Vergütungsstrukturen. Sie zahlen einfach für ein Software-Abonnement, genauso wie Sie für Microsoft Office oder Adobe Creative Cloud bezahlen würden.';

  @override
  String get faqQ24 => 'Warum brauche ich einen Empfehlungscode zur Anmeldung?';

  @override
  String get faqA24 =>
      'Empfehlungscodes helfen, Ihre anfängliche Netzwerkverbindung im System herzustellen. Dies gewährleistet ordnungsgemäßes Netzwerk-Tracking und ermöglicht es Ihnen und Ihrem Sponsor, effektiv über die App zu kommunizieren. Wenn Sie keinen Code haben, können Sie sich direkt über unsere Website anmelden.';

  @override
  String get faqQ25 =>
      'Werde ich gezwungen, zu rekrutieren oder etwas zu verkaufen?';

  @override
  String get faqA25 =>
      'Absolut nicht. Team Build Pro ist nur ein Software-Tool. Wir verkaufen keine Produkte, verlangen keine Rekrutierung und haben keine Verkaufsziele. Wie Sie die App verwenden, um Ihre eigene Teamaufbau-Aktivität zu verwalten, liegt ganz bei Ihnen.';

  @override
  String get faqQ26 => 'Das klingt zu gut, um wahr zu sein. Was ist der Haken?';

  @override
  String get faqA26 =>
      'Es gibt keinen Haken. Wir sind ein legitimes SaaS-Tool, das eine transparente monatliche Abonnementgebühr für professionelle Software berechnet. Keine versteckten Gebühren, keine Rekrutierungsanforderungen, keine Versprechungen von Reichtum. Einfach gute Software zu einem fairen Preis.';

  @override
  String get faqQ27 => 'Machen Sie Einkommensversprechungen?';

  @override
  String get faqA27 =>
      'Nein. Team Build Pro ist ein Software-Tool, keine Geschäftsmöglichkeit. Wir machen keine Einkommensversprechungen, weil Sie durch unsere App kein Geld verdienen. Sie zahlen für ein Tool, das Ihnen hilft, Ihre eigenen Teamaufbau-Aktivitäten zu verwalten.';

  @override
  String get faqQ28 => 'Woher weiß ich, dass Team Build Pro legitim ist?';

  @override
  String get faqA28 =>
      'Wir sind ein registriertes Softwareunternehmen mit einer Live-App im Apple App Store (der strenge Überprüfungsprozesse hat). Wir verlangen keine Vorabkäufe, machen keine unrealistischen Versprechungen und sind transparent darüber, was unsere Software tut. Wir haben klare Nutzungsbedingungen, Datenschutzrichtlinien und Support-Kontaktinformationen.';

  @override
  String get faqQ29 => 'Wie schnell wird mein Netzwerk wachsen?';

  @override
  String get faqA29 =>
      'Wir können das Netzwerkwachstum nicht vorhersagen, da es vollständig von Ihren eigenen Teamaufbau-Aktivitäten abhängt. Team Build Pro hilft Ihnen einfach, jedes Wachstum zu verfolgen und zu verwalten, das Sie durch Ihre eigenen Bemühungen schaffen.';

  @override
  String get faqQ30 => 'Welche Ergebnisse kann ich erwarten?';

  @override
  String get faqA30 =>
      'Sie können bessere Organisation, klarere Kommunikation und einfacheres Tracking Ihrer Teamaufbau-Aktivitäten erwarten. Team Build Pro ist ein Tool für Effizienz - Ihre tatsächlichen Ergebnisse hängen davon ab, wie Sie es verwenden und Ihre eigenen Geschäftsaktivitäten.';

  @override
  String get faqQ31 => 'Haben andere Leute Erfolg mit Team Build Pro?';

  @override
  String get faqA31 =>
      'Viele Benutzer berichten von besserer Team-Organisation, einfacherer Kommunikation und besserem Wachstums-Tracking. Denken Sie jedoch daran, dass Team Build Pro nur ein Tool ist - Erfolg kommt von Ihren eigenen Teamaufbau-Bemühungen, nicht von der Software selbst.';

  @override
  String get faqQ32 => 'Kann ich Testimonials oder Bewertungen sehen?';

  @override
  String get faqA32 =>
      'Sie können verifizierte Benutzerbewertungen im Apple App Store sehen. Wir konzentrieren Testimonials auf Software-Funktionen und Benutzererfahrung, nicht auf Geschäftsergebnisse, da Team Build Pro ein Tool ist, keine Geschäftsmöglichkeit.';

  @override
  String get faqQ33 => 'Was macht Team Build Pro anders als andere Tools?';

  @override
  String get faqA33 =>
      'Wir sind speziell für Teamaufbau und Direktvertriebs-Netzwerke entwickelt. Während andere Tools generische CRM-Funktionen bieten, liefern wir spezialisiertes Netzwerk-Tracking, Aufbau-Meilensteine, Team-Kommunikation und Compliance-Funktionen, die auf Ihre einzigartigen Bedürfnisse zugeschnitten sind.';

  @override
  String get faqQ34 =>
      'Welche Schulung oder Unterstützung wird bereitgestellt?';

  @override
  String get faqA34 =>
      'Wir bieten umfassende In-App-Dokumentation, FAQs, einen Erste-Schritte-Bereich und E-Mail-Support. Neue Benutzer erhalten auch Onboarding-Benachrichtigungen, um ihnen beim Erlernen der Hauptfunktionen zu helfen. Wir aktualisieren regelmäßig unsere Hilferessourcen basierend auf Benutzerfeedback.';

  @override
  String get faqQ35 => 'Kann ich persönliche Schulung erhalten?';

  @override
  String get faqA35 =>
      'Für Software-Probleme bietet unser E-Mail-Support personalisierte Hilfe. Für Teamaufbau-Anleitung empfehlen wir die Zusammenarbeit mit Ihrem Sponsor oder Ihrer Organisation. Wir konzentrieren uns auf Software-Support, nicht auf Geschäftsschulung.';

  @override
  String get faqQ36 => 'Wie oft wird die App aktualisiert?';

  @override
  String get faqA36 =>
      'Wir veröffentlichen regelmäßige Updates mit neuen Funktionen, Leistungsverbesserungen und Fehlerbehebungen. Alle Updates sind für Abonnenten kostenlos. Sie können unsere Versionshinweise im App Store einsehen, um die neuesten Verbesserungen zu sehen.';

  @override
  String get faqQ37 => 'Funktioniert Team Build Pro offline?';

  @override
  String get faqA37 =>
      'Sie können zuvor geladene Daten offline anzeigen, aber die meisten Funktionen erfordern eine Internetverbindung für Echtzeit-Synchronisation. Dies stellt sicher, dass Sie und Ihr Team immer die aktuellsten Informationen sehen.';

  @override
  String get faqQ38 => 'Was ist der KI-Coach und wie funktioniert er?';

  @override
  String get faqA38 =>
      'Der KI-Coach hilft Ihnen, durch die Team Build Pro App zu navigieren, beantwortet Fragen zu Funktionen und Qualifikationsanforderungen, bietet Teamaufbau-Anleitung und kann vorschlagen, welche App-Bereiche Sie für bestimmte Aufgaben besuchen sollten.';

  @override
  String get faqQ39 =>
      'Bieten Sie Schulung zur Rekrutierung oder zum Verkauf an?';

  @override
  String get faqA39 =>
      'Wir konzentrieren uns darauf, zu zeigen, wie man Team Build Pro effektiv nutzt. Für Verkaufs- und Rekrutierungsschulung empfehlen wir die Zusammenarbeit mit Ihrem Sponsor oder den Schulungsprogrammen Ihres Unternehmens.';

  @override
  String get faqQ40 => 'Was ist, wenn ich technische Probleme habe?';

  @override
  String get faqA40 =>
      'Kontaktieren Sie unser Support-Team über die App oder Website. Die meisten Probleme werden schnell gelöst, und wir sind bestrebt, Ihre Teamaufbau-Aktivitäten reibungslos am Laufen zu halten.';

  @override
  String get faqFooterTitle => 'Bereit, Ihren Teamaufbau zu transformieren?';

  @override
  String get faqFooterSubtitle =>
      'Starten Sie heute Ihre 30-tägige kostenlose Testversion und erleben Sie den Unterschied, den professionelle Tools machen.';

  @override
  String get faqFooterContact =>
      'Fragen nicht hier beantwortet? Kontaktieren Sie unser Support-Team - wir sind hier, um Ihnen zum Erfolg zu verhelfen!';

  @override
  String get bizOppEducationTitle => 'Sichern Sie Ihre Sponsorenposition!';

  @override
  String get bizOppEducationWorksTitle => 'Wie Sponsoring Funktioniert';

  @override
  String bizOppEducationWorksBody(String business) {
    return 'Wenn Ihre Teammitglieder $business beitreten, wird ihr Sponsor die ERSTE Person in ihrer Upline sein, die bereits beigetreten ist.';
  }

  @override
  String get bizOppEducationBenefitsTitle =>
      'Treten Sie jetzt bei um sicherzustellen:';

  @override
  String get bizOppEducationBenefit1 =>
      'Ihre Rekruten werden unter IHNEN gesponsert';

  @override
  String get bizOppEducationBenefit2 =>
      'Sie erhalten Anerkennung für ihre Aktivität';

  @override
  String get bizOppEducationBenefit3 => 'Sie verpassen diese Gelegenheit nicht';

  @override
  String get bizOppEducationRemindLater => 'Später Erinnern';

  @override
  String get bizOppEducationJoinNow => 'Jetzt Beitreten';

  @override
  String get sharePartnerImportantLabel => 'Wichtig:';

  @override
  String sharePartnerImportantText(String business) {
    return 'Wir empfehlen dringend, dass Sie die Team Build Pro App zuerst mit Ihren Frontline-$business-Teammitgliedern (Personen, die Sie persönlich gesponsert haben) teilen, bevor Sie sie mit $business-Teammitgliedern teilen, die Sie nicht persönlich gesponsert haben. Dies bietet die Möglichkeit, die etablierten Sponsoring-Beziehungen in Ihrer $business-Downline zu respektieren.';
  }

  @override
  String get bizProgressTitle => 'Registrierungsfortschritt';

  @override
  String get bizProgressStep1 => 'Registrierungslink Kopieren';

  @override
  String get bizProgressStep2 => 'Registrierung Abschließen';

  @override
  String get bizProgressStep3 => 'Ihren Empfehlungslink Hinzufügen';

  @override
  String get hiwTitle => 'So Funktioniert Es';

  @override
  String get hiwSubtitle =>
      'Verwandeln Sie Ihre Rekrutierung mit einem vorqualifizierten Team.';

  @override
  String get hiwFeaturedOpp => 'Ausgewählte Gelegenheit';

  @override
  String get hiwPipelineSystem => 'PIPELINE-SYSTEM';

  @override
  String get hiwStep1Title => 'Legen Sie Ihre Grundlage Fest';

  @override
  String get hiwStep1Desc =>
      'Passen Sie Ihr Team Build Pro-Konto mit Ihren Geschäftsmöglichkeitsdetails an und verbinden Sie Ihren Empfehlungslink - verwandeln Sie die App in Ihre persönliche Rekrutierungs-Pipeline.';

  @override
  String get hiwStep2Title => 'Bauen Sie Klug, Nicht Hart';

  @override
  String get hiwStep2Desc =>
      'Teilen Sie Team Build Pro mit Interessenten und bestehenden Teammitgliedern. Aktuelle Teammitglieder schaffen sofortige Dynamik, und Rekrutierungsinteressenten erleben echten Teamerfolg, bevor sie Ihrer Gelegenheit beitreten, wodurch das \"Kaltstart\"-Problem eliminiert wird.';

  @override
  String get hiwStep3Title => 'Automatische Qualifikation';

  @override
  String get hiwStep3Desc =>
      'Wenn Rekrutierungsinteressenten unsere Erfolgsmeilensteine erreichen (4 direkte Sponsoren + 20 Teammitglieder insgesamt), erhalten sie automatisch eine Einladung, Ihrer Gelegenheit beizutreten.';

  @override
  String get hiwStep4Title => 'Schnelles Wachstum';

  @override
  String get hiwStep4Desc =>
      'Während Ihre Team Build Pro-Organisation wächst, bringt jeder qualifizierte Leiter neue, vorgeschulte Interessenten in Ihre Gelegenheit - wodurch ein selbsttragender Wachstumsmotor entsteht.';

  @override
  String get hiwKeyTargets => 'SCHLÜSSEL-WACHSTUMSZIELE';

  @override
  String get hiwDirectSponsors => 'Direkte Sponsoren';

  @override
  String get hiwTotalTeam => 'Teammitglieder Insgesamt';

  @override
  String get hiwGrowNetwork => 'Erweitern Sie Ihr Netzwerk';

  @override
  String get hiwExpandNetwork =>
      'Erweitern Sie Ihr Netzwerk, um das Organisationswachstum voranzutreiben!';

  @override
  String get hiwProvenStrategies => 'Bewährte Wachstumsstrategien';

  @override
  String get pmTitle => 'Konto Erstellen';

  @override
  String get pmDialogTitle => 'Wichtige Bedingungen';

  @override
  String get pmDialogIntro =>
      'Sie erstellen ein neues, separates Administratorkonto. Wenn Sie fortfahren, verstehen und akzeptieren Sie Folgendes:';

  @override
  String get pmTerm1 =>
      'Dieses neue Konto ist vollständig getrennt und kann nicht mit Ihrem aktuellen Konto zusammengeführt werden.';

  @override
  String pmTerm2(String bizOpp) {
    return 'Ihr bestehendes \"$bizOpp\"-Team ist nicht übertragbar.';
  }

  @override
  String get pmTerm3 =>
      'Dieses Konto muss für eine neue, andere Geschäftsmöglichkeit verwendet werden.';

  @override
  String get pmTerm4 =>
      'Cross-Promotion oder die Rekrutierung von Mitgliedern zwischen Ihren separaten Konten ist strengstens untersagt.';

  @override
  String get pmTerm5 =>
      'Die Verletzung dieser Bedingungen kann zur Aussetzung oder Kündigung ALLER Ihrer zugehörigen Konten führen.';

  @override
  String get pmAgreeTerms => 'Ich verstehe und akzeptiere diese Bedingungen';

  @override
  String get pmCancel => 'Abbrechen';

  @override
  String get pmContinue => 'Fortfahren';

  @override
  String get pmCardTitle => 'Andere Gelegenheit Verwalten';

  @override
  String get pmCardDesc =>
      'Erstellen Sie ein separates Konto, um eine andere Gelegenheit zu verwalten und auszubauen.';

  @override
  String get pmCreateButton => 'Neues Konto Erstellen';
}
