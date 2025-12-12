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
  String get authLoginHeaderTitle => 'Bienvenido de nuevo';

  @override
  String get authLoginLabelEmail => 'Correo electrónico';

  @override
  String get authLoginHintEmail => 'Ingresa tu correo electrónico';

  @override
  String get authLoginEmailRequired => 'Por favor ingresa tu correo';

  @override
  String get authLoginEmailInvalid => 'Por favor ingresa un correo válido';

  @override
  String get authLoginLabelPassword => 'Contraseña';

  @override
  String get authLoginHintPassword => 'Ingresa tu contraseña';

  @override
  String get authLoginPasswordRequired => 'Por favor ingresa tu contraseña';

  @override
  String authLoginPasswordTooShort(int min) {
    return 'La contraseña debe tener al menos $min caracteres';
  }

  @override
  String get authLoginButtonSignIn => 'Iniciar Sesión';

  @override
  String get authLoginNoAccountPrompt => '¿No tienes una cuenta?';

  @override
  String get authLoginLinkSignUp => 'Regístrate';

  @override
  String authLoginBiometric(String method) {
    return 'Iniciar sesión con $method';
  }

  @override
  String get authLoginBiometricMethodFace => 'Face ID';

  @override
  String get authLoginBiometricMethodTouch => 'Touch ID';

  @override
  String get authLoginBiometricMethodGeneric => 'Biometría';

  @override
  String get authSignupHeaderTitle => 'Crea tu cuenta';

  @override
  String get authSignupLabelFirstName => 'Nombre';

  @override
  String get authSignupHintFirstName => 'Ingresa tu nombre';

  @override
  String get authSignupFirstNameRequired => 'Por favor ingresa tu nombre';

  @override
  String get authSignupLabelLastName => 'Apellido';

  @override
  String get authSignupHintLastName => 'Ingresa tu apellido';

  @override
  String get authSignupLastNameRequired => 'Por favor ingresa tu apellido';

  @override
  String get authSignupLabelEmail => 'Correo electrónico';

  @override
  String get authSignupHintEmail => 'Ingresa tu correo electrónico';

  @override
  String get authSignupEmailRequired => 'Por favor ingresa tu correo';

  @override
  String get authSignupEmailInvalid => 'Por favor ingresa un correo válido';

  @override
  String get authSignupLabelPassword => 'Contraseña';

  @override
  String get authSignupHintPassword => 'Crea una contraseña';

  @override
  String get authSignupPasswordRequired => 'Por favor ingresa una contraseña';

  @override
  String authSignupPasswordTooShort(int min) {
    return 'La contraseña debe tener al menos $min caracteres';
  }

  @override
  String get authSignupLabelConfirmPassword => 'Confirmar Contraseña';

  @override
  String get authSignupHintConfirmPassword => 'Vuelve a ingresar tu contraseña';

  @override
  String get authSignupConfirmPasswordRequired =>
      'Por favor confirma tu contraseña';

  @override
  String get authSignupPasswordMismatch => 'Las contraseñas no coinciden';

  @override
  String get authSignupLabelReferralCode => 'Código de Referido (Opcional)';

  @override
  String get authSignupHintReferralCode =>
      'Ingresa el código de invitación si tienes uno';

  @override
  String get authSignupButtonPasteCode => 'Pegar';

  @override
  String get authSignupTosConsent =>
      'Al continuar, aceptas los Términos de Servicio y la Política de Privacidad';

  @override
  String get authSignupTermsShort => 'Términos de Servicio';

  @override
  String get authSignupPrivacyShort => 'Política de Privacidad';

  @override
  String get authSignupTosRequired => 'Requerido para crear la cuenta';

  @override
  String get authSignupButtonCreateAccount => 'Crear Cuenta';

  @override
  String get authSignupHaveAccountPrompt => '¿Ya tienes una cuenta?';

  @override
  String get authSignupLinkSignIn => 'Iniciar Sesión';

  @override
  String get authPasswordShow => 'Mostrar contraseña';

  @override
  String get authPasswordHide => 'Ocultar contraseña';

  @override
  String get authErrorInvalidEmail =>
      'Ese correo no es válido. Por favor verifica e intenta de nuevo.';

  @override
  String get authErrorUserDisabled =>
      'Esta cuenta ha sido deshabilitada. Por favor contacta a soporte.';

  @override
  String get authErrorUserNotFound =>
      'No se encontró ninguna cuenta con ese correo.';

  @override
  String get authErrorWrongPassword =>
      'Contraseña incorrecta. Por favor intenta de nuevo.';

  @override
  String get authErrorEmailInUse => 'Ya existe una cuenta con ese correo.';

  @override
  String get authErrorWeakPassword =>
      'Por favor elige una contraseña más segura.';

  @override
  String get authErrorNetworkError =>
      'Error de red. Por favor verifica tu conexión.';

  @override
  String get authErrorTooMany =>
      'Demasiados intentos. Por favor espera un momento.';

  @override
  String get authErrorInvalidCredential =>
      'Esos datos no coinciden con nuestros registros.';

  @override
  String get authErrorUnknown =>
      'Ocurrió un error. Por favor intenta de nuevo.';

  @override
  String get navHome => 'Inicio';

  @override
  String get navTeam => 'Equipo';

  @override
  String get navShare => 'Crecer';

  @override
  String get navMessages => 'Mensajes';

  @override
  String get navNotices => 'Avisos';

  @override
  String get navProfile => 'Perfil';

  @override
  String get dashTitle => 'Centro de Control';

  @override
  String get dashKpiDirectSponsors => 'Patrocinadores Directos';

  @override
  String get dashKpiTotalTeam => 'Total de Miembros del Equipo';

  @override
  String get dashStatsRefreshed => 'Estadísticas del equipo actualizadas';

  @override
  String dashStatsError(String error) {
    return 'Error al actualizar estadísticas: $error';
  }

  @override
  String get dashTileGettingStarted => 'Primeros Pasos';

  @override
  String get dashTileOpportunity => 'Detalles de Oportunidad';

  @override
  String get dashTileEligibility => 'Tu Estado de Elegibilidad';

  @override
  String get dashTileGrowTeam => 'Haz Crecer tu Equipo';

  @override
  String get dashTileViewTeam => 'Ver tu Equipo';

  @override
  String get dashTileAiCoach => 'Tu Entrenador AI';

  @override
  String get dashTileMessageCenter => 'Centro de Mensajes';

  @override
  String get dashTileNotifications => 'Notificaciones';

  @override
  String get dashTileHowItWorks => 'Cómo Funciona';

  @override
  String get dashTileFaqs => 'Preguntas Frecuentes';

  @override
  String get dashTileProfile => 'Ver tu Perfil';

  @override
  String get dashTileCreateAccount => 'Crear Nueva Cuenta';

  @override
  String recruitT01FirstTouch(String prospectName, String senderFirst,
      String companyName, String shortLink) {
    return 'Hola $prospectName, soy $senderFirst. Uso una app para ayudar amigos con $companyName. ¿Echas un vistazo? $shortLink';
  }

  @override
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink) {
    return 'Hola, soy $senderFirst. Estoy usando una app para ayudar a amigos a lanzarse con $companyName. ¿Le echas un vistazo? $shortLink';
  }

  @override
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink) {
    return '¡Hola $prospectName! Siguiendo con $companyName. Buenos resultados esta semana. ¿Tiempo para charlar? $shortLink';
  }

  @override
  String recruitT03DeadlineNudge(
      String prospectName, String companyName, String shortLink) {
    return '$prospectName, lugares llenándose para el lanzamiento $companyName. ¿Te guardo uno? $shortLink';
  }

  @override
  String recruitT04TeamNeeded(int remaining) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'Estás a # personas de un comienzo sólido.',
      one: 'Estás a # persona de un comienzo sólido.',
      zero: 'Estás listo para el primer día.',
    );
    return '$_temp0';
  }

  @override
  String recruitT05MilestoneReached(String prospectName, String companyName) {
    return '🎉 ¡$prospectName, alcanzaste tu primer hito con $companyName! Tu equipo está creciendo. ¡Sigue así!';
  }

  @override
  String recruitT06WelcomeOnboard(
      String prospectName, String senderFirst, String inviteLink) {
    return '¡Bienvenido, $prospectName! Soy $senderFirst y estoy aquí para ayudarte. Comencemos: $inviteLink';
  }

  @override
  String recruitT07WeeklyCheckIn(String prospectName, String companyName) {
    return 'Hola $prospectName, revisión rápida sobre $companyName. ¿Cómo van las cosas? ¿Alguna pregunta en la que pueda ayudar?';
  }

  @override
  String recruitT08Deadline(int days, String shortLink) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '# días',
      one: '# día',
    );
    return 'Comenzamos en $_temp0. ¿Quieres que te reserve un lugar? $shortLink';
  }

  @override
  String recruitT09ResourceShare(
      String prospectName, String companyName, String inviteLink) {
    return '$prospectName, encontré esto útil para $companyName. Pensé que querrías verlo: $inviteLink';
  }

  @override
  String recruitT10InviteReminder(
      String prospectName, String companyName, String shortLink) {
    return 'Hola $prospectName, todavía tienes una invitación esperándote para $companyName. ¿Listo para unirte? $shortLink';
  }

  @override
  String recruitT11TeamGrowth(String prospectName, String companyName) {
    return '¡Excelentes noticias, $prospectName! Tu equipo de $companyName creció esta semana. ¡Estás haciendo un progreso real!';
  }

  @override
  String recruitT12Encouragement(String prospectName, String companyName) {
    return '$prospectName, construir con $companyName toma tiempo. Lo estás haciendo genial. ¡Sigue adelante!';
  }

  @override
  String recruitT13TrainingInvite(
      String prospectName, String companyName, String inviteLink) {
    return 'Hola $prospectName, capacitación $companyName próximamente. ¿Te unes? $inviteLink';
  }

  @override
  String recruitT14QuickWin(String prospectName, String companyName) {
    return '¡Buen trabajo, $prospectName! Esa fue una victoria sólida con $companyName. ¡Mantengamos el impulso!';
  }

  @override
  String recruitT15SupportOffer(String prospectName, String companyName) {
    return 'Hola $prospectName, estoy aquí si necesitas ayuda con $companyName. Solo comunícate en cualquier momento.';
  }

  @override
  String recruitT16Gratitude(String prospectName, String companyName) {
    return 'Gracias por ser parte de nuestro equipo de $companyName, $prospectName. ¡Tu energía marca la diferencia!';
  }

  @override
  String get notifMilestoneDirectTitle => '🎉 ¡Progreso Increíble!';

  @override
  String notifMilestoneDirectBody(
      String firstName, int directCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'miembros',
      one: 'miembro',
    );
    return '¡Felicitaciones, $firstName! ¡Alcanzaste $directCount patrocinadores directos! Solo necesitas $remaining $_temp0 más del equipo para desbloquear tu invitación a $bizName. ¡Sigue construyendo!';
  }

  @override
  String get notifMilestoneTeamTitle => '🚀 ¡Crecimiento Increíble!';

  @override
  String notifMilestoneTeamBody(
      String firstName, int teamCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'patrocinadores',
      one: 'patrocinador',
    );
    return '¡Progreso asombroso, $firstName! ¡Construiste un equipo de $teamCount! Solo necesitas $remaining $_temp0 directos más para calificar para $bizName. ¡Estás muy cerca!';
  }

  @override
  String get notifSubActiveTitle => '✅ Suscripción Activa';

  @override
  String notifSubActiveBody(String expiryDate) {
    return 'Tu suscripción está activa hasta $expiryDate.';
  }

  @override
  String get notifSubCancelledTitle => '⚠️ Suscripción Cancelada';

  @override
  String notifSubCancelledBody(String expiryDate) {
    return 'Tu suscripción ha sido cancelada pero permanece activa hasta $expiryDate.';
  }

  @override
  String get notifSubExpiredTitle => '❌ Suscripción Vencida';

  @override
  String get notifSubExpiredBody =>
      'Tu suscripción ha vencido. Renueva ahora para seguir construyendo tu equipo y accediendo a todas las herramientas de reclutamiento.';

  @override
  String get notifSubExpiringSoonTitle => '⏰ Suscripción por Vencer';

  @override
  String notifSubExpiringSoonBody(String expiryDate) {
    return 'Tu suscripción vence el $expiryDate. Renueva ahora para evitar interrupciones.';
  }

  @override
  String get notifSubPausedTitle => '⏸️ Suscripción Pausada';

  @override
  String get notifSubPausedBody =>
      'Tu suscripción ha sido pausada. Reanúdala en Play Store para restaurar el acceso a todas las funciones.';

  @override
  String get notifSubPaymentIssueTitle => '⚠️ Problema de Pago';

  @override
  String get notifSubPaymentIssueBody =>
      'Tu suscripción está en espera debido a un problema de pago. Por favor actualiza tu método de pago en Play Store.';

  @override
  String notifNewMessageTitle(String senderName) {
    return 'Nuevo Mensaje de $senderName';
  }

  @override
  String get notifTeamActivityTitle => '👀 Actividad de Miembro del Equipo';

  @override
  String notifTeamActivityBody(String visitorName) {
    return '¡$visitorName visitó la página de oportunidad de negocio!';
  }

  @override
  String get notifLaunchSentTitle => 'Campaña de Lanzamiento Enviada';

  @override
  String get notifLaunchSentBody =>
      'Tu campaña de lanzamiento se ha enviado exitosamente a tu red.';

  @override
  String get emptyNotifications => 'Aún no hay notificaciones.';

  @override
  String get emptyMessageContent => 'Sin contenido de mensaje.';

  @override
  String get emptyNotificationTitle => 'Sin Título';

  @override
  String get emptyMessageThreads => 'No se encontraron conversaciones.';

  @override
  String get emptyTeamMember => 'Miembro del equipo no encontrado.';

  @override
  String get errorLoadingNotifications => 'Error al cargar notificaciones';

  @override
  String errorGeneric(String error) {
    return 'Error: $error';
  }

  @override
  String get dashKpiTitle => 'Estadísticas Actuales de Su Equipo';

  @override
  String get dashKpiRefreshTooltip => 'Actualizar estadísticas del equipo';

  @override
  String get dashTileJoinOpportunity => '¡Unirse a Oportunidad!';

  @override
  String dashSubscriptionTrial(int daysLeft) {
    return 'Iniciar Suscripción\n($daysLeft días restantes de prueba)';
  }

  @override
  String get dashSubscriptionExpired =>
      'Renovar Su Suscripción\nPrueba gratuita de 30 días vencida.';

  @override
  String get dashSubscriptionCancelled =>
      'Usted Canceló Su Suscripción\nReactive Su Suscripción Ahora';

  @override
  String get dashSubscriptionManage => 'Administrar Suscripción';

  @override
  String get networkTitle => 'Su Equipo Global';

  @override
  String get networkLabelDirectSponsors => 'Patrocinadores Directos';

  @override
  String get networkLabelTotalTeam => 'Total del Equipo';

  @override
  String get networkLabelNewMembers => 'Nuevos Miembros';

  @override
  String get networkSearchHint => 'Buscar miembros del equipo...';

  @override
  String get networkRefreshTooltip => 'Forzar actualización de datos';

  @override
  String get networkFilterSelectReport => 'Ver Reporte del Equipo';

  @override
  String get networkFilterAllMembers => 'Todos los Miembros';

  @override
  String get networkFilterDirectSponsors => 'Patrocinadores Directos';

  @override
  String get networkFilterNewMembers => 'Nuevos Miembros - Hoy';

  @override
  String get networkFilterNewMembersYesterday => 'Nuevos Miembros - Ayer';

  @override
  String get networkFilterQualified => 'Miembros Calificados';

  @override
  String get networkFilterJoined => 'Se Unió';

  @override
  String networkFilterAllMembersWithCount(int count) {
    return 'Todos los Miembros ($count)';
  }

  @override
  String networkFilterDirectSponsorsWithCount(int count) {
    return 'Patrocinadores Directos ($count)';
  }

  @override
  String networkFilterNewMembersWithCount(int count) {
    return 'Nuevos Miembros - Hoy ($count)';
  }

  @override
  String networkFilterNewMembersYesterdayWithCount(int count) {
    return 'Nuevos Miembros - Ayer ($count)';
  }

  @override
  String networkFilterQualifiedWithCount(int count) {
    return 'Miembros Calificados ($count)';
  }

  @override
  String networkFilterJoinedWithCount(String business, int count) {
    return 'Se Unió a $business ($count)';
  }

  @override
  String get networkMessageSelectReport =>
      'Seleccione un reporte del menú desplegable arriba o use la barra de búsqueda para ver y administrar su equipo.';

  @override
  String get networkMessageNoSearchResults =>
      'Mostrando resultados de búsqueda de Todos los Miembros. No hay miembros que coincidan con su búsqueda.';

  @override
  String get networkMessageNoMembers =>
      'No se encontraron miembros para este filtro.';

  @override
  String get networkSearchingContext => 'Buscando en: Todos los Miembros';

  @override
  String get networkSearchingContextInfo =>
      'Mostrando resultados de búsqueda de Todos los Miembros';

  @override
  String networkPaginationInfo(int showing, int total) {
    return 'Mostrando $showing de $total miembros';
  }

  @override
  String networkLevelLabel(int level) {
    return 'Nivel $level';
  }

  @override
  String networkMembersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Miembros',
      one: '$count Miembro',
    );
    return '$_temp0';
  }

  @override
  String get networkLoadingMore => 'Cargando más miembros...';

  @override
  String networkLoadMoreButton(int remaining) {
    return 'Cargar Más Miembros ($remaining restantes)';
  }

  @override
  String networkAllMembersLoaded(int count) {
    return 'Todos los $count miembros cargados';
  }

  @override
  String networkMemberJoined(String date) {
    return 'Se unió $date';
  }

  @override
  String get networkAnalyticsPerformance => 'Rendimiento de la Red';

  @override
  String get networkAnalyticsGeographic => 'Distribución Geográfica';

  @override
  String get networkAnalyticsLevels => 'Distribución por Niveles';

  @override
  String get networkAnalyticsChartPlaceholder =>
      'Gráfico de Rendimiento\n(La implementación del gráfico iría aquí)';

  @override
  String networkLevelBadge(int level) {
    return 'Nivel $level';
  }

  @override
  String networkLevelMembersCount(int count) {
    return '$count miembros';
  }

  @override
  String get settingsTitle => 'Configuración';

  @override
  String get settingsTitleOrganization => 'Configuración de Organización';

  @override
  String settingsWelcomeMessage(String name) {
    return '¡Bienvenido $name!\n\nEstablezcamos la base para su oportunidad de negocio.';
  }

  @override
  String get settingsLabelOrganizationName => 'Nombre de Su Organización';

  @override
  String get settingsLabelConfirmOrganizationName =>
      'Confirmar Nombre de Organización';

  @override
  String get settingsDialogImportantTitle => '¡Muy Importante!';

  @override
  String settingsDialogReferralImportance(String organization) {
    return 'Debe ingresar el enlace de referido exacto que recibió de su patrocinador de $organization.';
  }

  @override
  String get settingsDialogButtonUnderstand => 'Entiendo';

  @override
  String get settingsLabelReferralLink => 'Su Enlace de Referido';

  @override
  String get settingsLabelConfirmReferralLink =>
      'Confirmar URL del Enlace de Referido';

  @override
  String get settingsLabelCountries => 'Países Disponibles';

  @override
  String get settingsImportantLabel => 'Importante:';

  @override
  String get settingsCountriesInstruction =>
      'Solo seleccione los países donde su oportunidad está actualmente disponible.';

  @override
  String get settingsButtonAddCountry => 'Agregar un País';

  @override
  String get settingsButtonSave => 'Guardar Configuración';

  @override
  String get settingsDisplayOrganization => 'Su Organización';

  @override
  String get settingsDisplayReferralLink => 'Su Enlace de Referido';

  @override
  String get settingsDisplayCountries => 'Países Disponibles Seleccionados';

  @override
  String get settingsNoCountries => 'No se seleccionaron países.';

  @override
  String get settingsFeederSystemTitle => 'Sistema de Alimentación de Red';

  @override
  String get settingsFeederSystemDescription =>
      'Este es su motor de crecimiento automatizado. Cuando los miembros se unen a Team Build Pro a través de su enlace pero aún no califican para su oportunidad de negocio, se colocan en su red de alimentación. En el momento en que cumple con los requisitos de elegibilidad a continuación, estos miembros se transfieren automáticamente a su equipo de oportunidad de negocio. Es un sistema poderoso que recompensa su dedicación: cuanto más crezca su red de alimentación, más fuerte será su lanzamiento cuando califique.';

  @override
  String get settingsEligibilityTitle => 'Requisitos Mínimos de Elegibilidad';

  @override
  String get settingsEligibilityDirectSponsors => 'Patrocinadores Directos';

  @override
  String get settingsEligibilityTotalTeam => 'Total de Miembros';

  @override
  String get settingsPrivacyLegalTitle => 'Privacidad y Legal';

  @override
  String get settingsPrivacyPolicy => 'Política de Privacidad';

  @override
  String get settingsPrivacyPolicySubtitle =>
      'Ver nuestras prácticas de privacidad y manejo de datos';

  @override
  String get settingsTermsOfService => 'Términos de Servicio';

  @override
  String get settingsTermsOfServiceSubtitle =>
      'Ver los términos y condiciones de nuestra plataforma';

  @override
  String get profileTitle => 'Perfil';

  @override
  String get profileLabelCity => 'Ciudad';

  @override
  String get profileLabelState => 'Estado';

  @override
  String get profileLabelCountry => 'País';

  @override
  String get profileLabelJoined => 'Se Unió';

  @override
  String get profileLabelSponsor => 'Su Patrocinador';

  @override
  String get profileLabelTeamLeader => 'Líder del Equipo';

  @override
  String get profileButtonEdit => 'Editar Perfil';

  @override
  String get profileButtonSignOut => 'Cerrar Sesión';

  @override
  String get profileSigningOut => 'Cerrando sesión...';

  @override
  String get profileButtonTerms => 'Términos de Servicio';

  @override
  String get profileButtonPrivacy => 'Política de Privacidad';

  @override
  String get profileButtonDeleteAccount => 'Eliminar Cuenta';

  @override
  String get profileDemoAccountTitle => 'Información de Cuenta Demo';

  @override
  String get profileDemoAccountMessage =>
      'Esta es una cuenta de demostración para fines de prueba y no se puede eliminar.';

  @override
  String get profileDemoAccountSubtext =>
      'Las cuentas de demostración se proporcionan para mostrar las características y funcionalidades de la aplicación. Si necesita crear una cuenta real, regístrese con su información personal.';

  @override
  String get profileDemoAccountButton => 'Entiendo';

  @override
  String get profileAdminProtectionTitle =>
      'Protección de Cuenta de Administrador';

  @override
  String get profileAdminProtectionMessage =>
      'Las cuentas de administrador con miembros activos del equipo no se pueden eliminar a través de la aplicación. Esta protección garantiza que los datos y relaciones de su equipo permanezcan intactos.';

  @override
  String profileAdminTeamSize(int directCount) {
    return 'Su Equipo: $directCount Patrocinadores Directos';
  }

  @override
  String get profileAdminProtectionInstructions =>
      'Para eliminar su cuenta de administrador, comuníquese con nuestro equipo de soporte en legal@teambuildpro.com. Trabajaremos con usted para garantizar una transición fluida para los miembros de su equipo.';

  @override
  String get profileAdminProtectionContact =>
      'Contacto: legal@teambuildpro.com';

  @override
  String get messageCenterTitle => 'Centro de Mensajes';

  @override
  String get messageCenterSearchHint => 'Buscar mensajes...';

  @override
  String get messageCenterFilterAll => 'Todos';

  @override
  String get messageCenterFilterUnread => 'No Leídos';

  @override
  String get messageCenterFilterTeam => 'Equipo';

  @override
  String get messageCenterNewThread => 'Nuevo Mensaje';

  @override
  String get messageCenterEmptyState =>
      'Aún no hay mensajes. ¡Inicie una conversación con los miembros de su equipo!';

  @override
  String get messageCenterNotLoggedIn =>
      'Por favor inicia sesión para ver mensajes.';

  @override
  String get messageCenterSponsorLabel => 'Su Patrocinador';

  @override
  String get messageCenterTeamLeaderLabel => 'Líder del Equipo';

  @override
  String get messageCenterSupportTeamTitle => 'Su Equipo de Soporte';

  @override
  String get messageCenterSupportTeamSubtitle =>
      'Toque para iniciar una conversación';

  @override
  String get messageCenterError => 'Error al cargar mensajes';

  @override
  String get messageCenterLoadingChat => 'Cargando chat...';

  @override
  String get messageCenterErrorLoadingUser =>
      'Error al cargar detalles del usuario';

  @override
  String get messageCenterUnknownUser => 'Usuario Desconocido';

  @override
  String messageCenterUnreadBadge(int count) {
    return '$count nuevos';
  }

  @override
  String messageCenterLastMessage(String time) {
    return 'Último mensaje hace $time';
  }

  @override
  String get notificationsTitle => 'Notificaciones';

  @override
  String get notificationsFilterAll => 'Todas';

  @override
  String get notificationsFilterUnread => 'No Leídas';

  @override
  String get notificationsFilterMilestones => 'Hitos';

  @override
  String get notificationsFilterTeam => 'Equipo';

  @override
  String get notificationsMarkAllRead => 'Marcar Todas Leídas';

  @override
  String get notificationsClearAll => 'Limpiar Todas';

  @override
  String get notificationsEmptyState =>
      'Aún no hay notificaciones. ¡Le notificaremos sobre actualizaciones importantes del equipo!';

  @override
  String get notificationsTimeNow => 'Ahora mismo';

  @override
  String notificationsTimeMinutes(int minutes) {
    return 'Hace ${minutes}m';
  }

  @override
  String notificationsTimeHours(int hours) {
    return 'Hace ${hours}h';
  }

  @override
  String notificationsTimeDays(int days) {
    return 'Hace ${days}d';
  }

  @override
  String get gettingStartedTitle => 'Primeros Pasos';

  @override
  String get gettingStartedWelcome => '¡Bienvenido a Team Build Pro!';

  @override
  String get gettingStartedIntro =>
      'Preparémoslo para el éxito. Esta guía rápida le mostrará las funciones esenciales para comenzar a construir su equipo.';

  @override
  String get gettingStartedStep1Title => 'Haz tu lista';

  @override
  String get gettingStartedStep2Title => 'Comparte con tu red';

  @override
  String get gettingStartedStep3Title =>
      'Da la bienvenida a tus nuevos miembros del equipo';

  @override
  String get gettingStartedStep3Description =>
      'Cuando recibas una notificación de nuevo miembro del equipo, haz un seguimiento inmediato para darles la bienvenida a tu equipo. ¡Las primeras impresiones importan!';

  @override
  String get gettingStartedStep4Title => 'Involucre a Su Equipo';

  @override
  String get gettingStartedStep4Description =>
      'Use el centro de mensajes para comunicarse con su equipo y brindar apoyo.';

  @override
  String get gettingStartedButtonStart => 'Comenzar';

  @override
  String get gettingStartedButtonNext => 'Siguiente';

  @override
  String get gettingStartedButtonBack => 'Atrás';

  @override
  String get gettingStartedButtonSkip => 'Omitir';

  @override
  String get welcomeTitle => 'Bienvenido';

  @override
  String get welcomeHeadline => 'Construya Su Equipo.\nHaga Crecer Su Negocio.';

  @override
  String get welcomeSubheadline =>
      'La plataforma profesional para construcción de equipos y crecimiento de redes.';

  @override
  String get welcomeButtonSignIn => 'Iniciar Sesión';

  @override
  String get welcomeButtonSignUp => 'Crear Cuenta';

  @override
  String get welcomeFeature1Title => 'Seguimiento Inteligente';

  @override
  String get welcomeFeature1Description =>
      'Monitoree el crecimiento de su equipo en tiempo real con análisis potentes.';

  @override
  String get welcomeFeature2Title => 'Crecimiento Automatizado';

  @override
  String get welcomeFeature2Description =>
      'El sistema de alimentación de red transfiere automáticamente miembros calificados a su equipo.';

  @override
  String get welcomeFeature3Title => 'Mensajería Segura';

  @override
  String get welcomeFeature3Description =>
      'Comuníquese de forma segura con su equipo a través de mensajería encriptada.';

  @override
  String get addLinkTitle => 'Agregar enlace';

  @override
  String get addLinkDescription =>
      'Agregue su enlace de oportunidad de negocio para comenzar a construir su equipo.';

  @override
  String get addLinkLabelUrl => 'URL de Oportunidad de Negocio';

  @override
  String get addLinkHintUrl =>
      'Ingrese la URL completa a su página de oportunidad de negocio';

  @override
  String get addLinkUrlRequired => 'Por favor ingrese una URL';

  @override
  String get addLinkUrlInvalid => 'Por favor ingrese una URL válida';

  @override
  String get addLinkButtonSave => 'Guardar Enlace';

  @override
  String get addLinkButtonTest => 'Probar Enlace';

  @override
  String get addLinkSuccessMessage =>
      '¡Enlace de negocio guardado exitosamente!';

  @override
  String get addLinkErrorMessage =>
      'Error al guardar el enlace. Por favor intente de nuevo.';

  @override
  String get businessTitle => 'Oportunidad de Negocio';

  @override
  String get businessLoadingMessage => 'Cargando detalles de oportunidad...';

  @override
  String get businessErrorMessage =>
      'No se pueden cargar los detalles de oportunidad';

  @override
  String get businessButtonJoin => 'Unirse Ahora';

  @override
  String get businessButtonLearnMore => 'Saber Más';

  @override
  String get businessButtonContact => 'Contactar Patrocinador';

  @override
  String get changePasswordTitle => 'Cambiar Contraseña';

  @override
  String get changePasswordLabelCurrent => 'Contraseña Actual';

  @override
  String get changePasswordHintCurrent => 'Ingrese su contraseña actual';

  @override
  String get changePasswordCurrentRequired =>
      'Por favor ingrese su contraseña actual';

  @override
  String get changePasswordLabelNew => 'Nueva Contraseña';

  @override
  String get changePasswordHintNew => 'Ingrese su nueva contraseña';

  @override
  String get changePasswordNewRequired =>
      'Por favor ingrese una nueva contraseña';

  @override
  String get changePasswordLabelConfirm => 'Confirmar Nueva Contraseña';

  @override
  String get changePasswordHintConfirm =>
      'Vuelva a ingresar su nueva contraseña';

  @override
  String get changePasswordConfirmRequired =>
      'Por favor confirme su nueva contraseña';

  @override
  String get changePasswordMismatch => 'Las nuevas contraseñas no coinciden';

  @override
  String get changePasswordButtonUpdate => 'Actualizar Contraseña';

  @override
  String get changePasswordSuccessMessage =>
      '¡Contraseña actualizada exitosamente!';

  @override
  String get changePasswordErrorMessage =>
      'Error al actualizar contraseña. Por favor intente de nuevo.';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatInputHint => 'Escriba un mensaje...';

  @override
  String get chatButtonSend => 'Enviar';

  @override
  String get chatEmptyState => 'Aún no hay mensajes. ¡Inicie la conversación!';

  @override
  String get chatMessageDeleted => 'Este mensaje fue eliminado';

  @override
  String get chatMessageEdited => 'editado';

  @override
  String chatTypingIndicator(String name) {
    return '$name está escribiendo...';
  }

  @override
  String get chatbotTitle => 'Entrenador AI';

  @override
  String get chatbotWelcome =>
      '¡Hola! Soy su entrenador AI. ¿Cómo puedo ayudarle a hacer crecer su equipo hoy?';

  @override
  String get chatbotInputHint =>
      'Pregúnteme cualquier cosa sobre construcción de equipos...';

  @override
  String get chatbotSuggestion1 => '¿Cómo puedo reclutar más efectivamente?';

  @override
  String get chatbotSuggestion2 =>
      '¿Cuáles son los requisitos de elegibilidad?';

  @override
  String get chatbotSuggestion3 => '¿Cómo funciona el sistema de alimentación?';

  @override
  String get chatbotThinking => 'Pensando...';

  @override
  String get companyTitle => 'Información de la Compañía';

  @override
  String get companyAboutHeading => 'Acerca de Team Build Pro';

  @override
  String get companyAboutText =>
      'Team Build Pro es una plataforma SaaS profesional diseñada para la construcción de equipos y el crecimiento de redes. Proporcionamos las herramientas y la tecnología para ayudarle a construir y administrar su equipo profesional de manera efectiva.';

  @override
  String get companyVersionLabel => 'Versión de la Aplicación';

  @override
  String get companyContactHeading => 'Contáctenos';

  @override
  String get companyContactEmail => 'support@teambuildpro.com';

  @override
  String get companyContactWebsite => 'www.teambuildpro.com';

  @override
  String get deleteAccountTitle => 'Eliminar Cuenta';

  @override
  String get deleteAccountWarning =>
      'Advertencia: ¡Esta acción no se puede deshacer!';

  @override
  String get deleteAccountDescription =>
      'Eliminar su cuenta eliminará permanentemente todos sus datos, incluido su perfil, información del equipo e historial de mensajes. Esta acción es irreversible.';

  @override
  String get deleteAccountConfirmPrompt =>
      'Para confirmar la eliminación, escriba DELETE a continuación:';

  @override
  String get deleteAccountConfirmHint =>
      'Ingresa tu dirección de correo electrónico';

  @override
  String get deleteAccountConfirmMismatch =>
      'Por favor escriba DELETE exactamente como se muestra';

  @override
  String get deleteAccountButtonDelete => 'Eliminar cuenta';

  @override
  String get deleteAccountButtonCancel => 'Cancelar';

  @override
  String get deleteAccountSuccessMessage =>
      'Cuenta eliminada exitosamente. Gracias por usar Team Build Pro.';

  @override
  String get deleteAccountErrorMessage =>
      'Error al eliminar cuenta. Por favor contacte a soporte.';

  @override
  String get editProfileTitle => 'Editar Perfil';

  @override
  String get editProfileLabelFirstName => 'Nombre';

  @override
  String get editProfileLabelLastName => 'Apellido';

  @override
  String get editProfileLabelEmail => 'Correo Electrónico';

  @override
  String get editProfileLabelPhone => 'Número de Teléfono';

  @override
  String get editProfileLabelCity => 'Ciudad';

  @override
  String get editProfileLabelState => 'Estado/Provincia';

  @override
  String get editProfileLabelCountry => 'País';

  @override
  String get editProfileLabelBio => 'Biografía';

  @override
  String get editProfileHintBio => 'Cuéntele a su equipo sobre usted...';

  @override
  String get editProfileButtonSave => 'Guardar Cambios';

  @override
  String get editProfileButtonCancel => 'Cancelar';

  @override
  String get editProfileButtonChangePhoto => 'Cambiar Foto';

  @override
  String get editProfileSuccessMessage => '¡Perfil actualizado exitosamente!';

  @override
  String get editProfileErrorMessage =>
      'Error al actualizar perfil. Por favor intente de nuevo.';

  @override
  String get eligibilityTitle => 'Estado de Elegibilidad';

  @override
  String get eligibilityCurrentStatus => 'Estado Actual';

  @override
  String get eligibilityStatusQualified => '¡Calificado!';

  @override
  String get eligibilityStatusNotQualified => 'Aún No Calificado';

  @override
  String get eligibilityRequirementsHeading => 'Requisitos';

  @override
  String get eligibilityDirectSponsorsLabel => 'Patrocinadores Directos';

  @override
  String eligibilityDirectSponsorsProgress(int current, int required) {
    return '$current de $required requeridos';
  }

  @override
  String get eligibilityTotalTeamLabel => 'Total de Miembros del Equipo';

  @override
  String eligibilityTotalTeamProgress(int current, int required) {
    return '$current de $required requeridos';
  }

  @override
  String eligibilityProgressBar(int percent) {
    return 'Progreso: $percent%';
  }

  @override
  String get eligibilityNextSteps => 'Próximos Pasos';

  @override
  String get eligibilityNextStepsDescription =>
      '¡Siga compartiendo su enlace de referido para hacer crecer su equipo y cumplir con los requisitos!';

  @override
  String get shareTitle => 'Crecer';

  @override
  String get shareYourLinkHeading => 'Su Enlace de Referido';

  @override
  String get shareButtonCopyLink => 'Copiar Enlace';

  @override
  String get shareLinkCopied => '¡Enlace copiado al portapapeles!';

  @override
  String get shareButtonSms => 'Compartir vía SMS';

  @override
  String get shareButtonEmail => 'Compartir vía Email';

  @override
  String get shareButtonWhatsApp => 'Compartir vía WhatsApp';

  @override
  String get shareButtonMore => 'Más Opciones';

  @override
  String shareMessageTemplate(String link) {
    return '¡Hola! Estoy construyendo mi equipo con Team Build Pro. Únete a mí: $link';
  }

  @override
  String get shareStatsHeading => 'Su Impacto al Compartir';

  @override
  String get shareStatsViews => 'Vistas del Enlace';

  @override
  String get shareStatsSignups => 'Registros';

  @override
  String get shareStatsConversion => 'Tasa de Conversión';

  @override
  String get memberDetailTitle => 'Detalles del Miembro';

  @override
  String get memberDetailLabelName => 'Nombre';

  @override
  String get memberDetailLabelEmail => 'Email';

  @override
  String get memberDetailLabelPhone => 'Teléfono';

  @override
  String get memberDetailLabelLocation => 'Ubicación';

  @override
  String get memberDetailLabelJoined => 'Se Unió';

  @override
  String get memberDetailLabelSponsor => 'Patrocinador';

  @override
  String get memberDetailLabelLevel => 'Nivel';

  @override
  String get memberDetailTeamStats => 'Estadísticas del Equipo';

  @override
  String memberDetailDirectSponsors(int count) {
    return 'Patrocinadores Directos: $count';
  }

  @override
  String memberDetailTotalTeam(int count) {
    return 'Total del Equipo: $count';
  }

  @override
  String get memberDetailButtonMessage => 'Enviar Mensaje';

  @override
  String get memberDetailButtonViewTeam => 'Ver Su Equipo';

  @override
  String get messageThreadTitle => 'Mensajes';

  @override
  String get messageThreadInputHint => 'Escriba su mensaje...';

  @override
  String get messageThreadButtonSend => 'Enviar';

  @override
  String get messageThreadEmptyState =>
      'Aún no hay mensajes. ¡Inicie la conversación!';

  @override
  String get messageThreadDelivered => 'Entregado';

  @override
  String get messageThreadRead => 'Leído';

  @override
  String get messageThreadSending => 'Enviando...';

  @override
  String get messageThreadFailed => 'Error al enviar';

  @override
  String get loginTitle => 'Iniciar Sesión';

  @override
  String get loginButtonGoogle => 'Continuar con Google';

  @override
  String get loginButtonApple => 'Continuar con Apple';

  @override
  String get loginDivider => 'o';

  @override
  String get loginForgotPassword => '¿Olvidó su Contraseña?';

  @override
  String get loginResetPasswordTitle => 'Restablecer Contraseña';

  @override
  String get loginResetPasswordDescription =>
      'Ingrese su dirección de correo electrónico y le enviaremos un enlace para restablecer su contraseña.';

  @override
  String get loginResetPasswordButton => 'Enviar Enlace';

  @override
  String get loginResetPasswordSuccess =>
      '¡Email de restablecimiento de contraseña enviado! Revise su bandeja de entrada.';

  @override
  String get loginResetPasswordError =>
      'Error al enviar email de restablecimiento. Por favor intente de nuevo.';

  @override
  String get commonButtonCancel => 'Cancelar';

  @override
  String get commonButtonSave => 'Guardar';

  @override
  String get commonButtonDelete => 'Eliminar';

  @override
  String get commonButtonEdit => 'Editar';

  @override
  String get commonButtonClose => 'Cerrar';

  @override
  String get commonButtonOk => 'OK';

  @override
  String get commonButtonYes => 'Sí';

  @override
  String get commonButtonNo => 'No';

  @override
  String get commonLoading => 'Cargando...';

  @override
  String get commonLoadingMessage => 'Cargando...';

  @override
  String get commonErrorMessage =>
      'Algo salió mal. Por favor intente de nuevo.';

  @override
  String get commonSuccessMessage => '¡Éxito!';

  @override
  String get commonNoDataMessage => 'No hay datos disponibles';

  @override
  String get commonRetryButton => 'Reintentar';

  @override
  String get commonRefreshButton => 'Actualizar';

  @override
  String get authSignupErrorFirstName => 'El nombre no puede estar vacío';

  @override
  String get authSignupErrorLastName => 'El apellido no puede estar vacío';

  @override
  String addLinkHeading(String business) {
    return 'Agrega tu enlace de\n$business';
  }

  @override
  String get addLinkImportantLabel => 'INFORMACIÓN IMPORTANTE';

  @override
  String addLinkDisclaimer(String business) {
    return 'Estás actualizando tu cuenta de Team Build Pro para rastrear referencias a $business. Esta es una entidad comercial separada e independiente que NO es propiedad, operada ni afiliada con Team Build Pro.';
  }

  @override
  String get addLinkGrowthTitle => 'Desbloqueando tu motor de crecimiento';

  @override
  String get addLinkInstructionBullet1 =>
      'Tu enlace de referencia se almacenará en tu perfil de Team Build Pro solo para fines de seguimiento.';

  @override
  String addLinkInstructionBullet2(String business) {
    return 'Cuando tus miembros del equipo califiquen y se unan a la oportunidad de $business, serán automáticamente colocados en tu equipo oficial';
  }

  @override
  String get addLinkInstructionBullet3 =>
      'Este enlace solo se puede configurar una vez, así que verifica que sea correcto antes de guardar.';

  @override
  String get addLinkWarning =>
      'Team Build Pro es solo una plataforma de seguimiento de referencias. No respaldamos ni garantizamos ninguna oportunidad de negocio.';

  @override
  String get addLinkFinalStepTitle => 'Paso final: Vincula tu cuenta';

  @override
  String addLinkFinalStepSubtitle(String business) {
    return 'Esto asegura que tus nuevos miembros del equipo se coloquen automáticamente en tu organización de $business.';
  }

  @override
  String addLinkFieldInstruction(String business) {
    return 'Ingresa tu enlace de referencia de $business a continuación. Se utilizará para rastrear referencias de tu equipo.';
  }

  @override
  String addLinkMustBeginWith(String baseUrl) {
    return 'Debe comenzar con:\n$baseUrl';
  }

  @override
  String get addLinkFieldLabel => 'Ingresa tu enlace de referencia';

  @override
  String addLinkFieldHelper(String baseUrl) {
    return 'Debe comenzar con $baseUrl\nEsto no se puede cambiar una vez configurado';
  }

  @override
  String addLinkFieldError(String business) {
    return 'Por favor ingresa tu enlace de referencia de $business.';
  }

  @override
  String get addLinkConfirmFieldLabel =>
      'Confirmar URL del enlace de referencia';

  @override
  String get addLinkConfirmFieldError =>
      'Por favor confirma tu enlace de referencia.';

  @override
  String get addLinkPreviewLabel => 'Vista previa del enlace de referencia:';

  @override
  String get addLinkSaving => 'Validando y guardando...';

  @override
  String get addLinkDialogImportantTitle => '¡Muy importante!';

  @override
  String addLinkDialogImportantMessage(String business) {
    return 'Debes ingresar el enlace de referencia exacto que recibiste de $business. Esto asegurará que los miembros de tu equipo que se unan a $business se coloquen automáticamente en tu equipo de $business.';
  }

  @override
  String get addLinkDialogImportantButton => 'Entiendo';

  @override
  String get addLinkDialogDuplicateTitle => 'Enlace de referencia ya en uso';

  @override
  String addLinkDialogDuplicateMessage(String business) {
    return 'El enlace de referencia de $business que ingresaste ya está siendo utilizado por otro miembro de Team Build Pro.';
  }

  @override
  String get addLinkDialogDuplicateInfo =>
      'Debes usar un enlace de referencia diferente para continuar.';

  @override
  String get addLinkDialogDuplicateButton => 'Probar enlace diferente';

  @override
  String get businessHeroTitle => '¡Felicitaciones!\n¡Estás calificado!';

  @override
  String businessHeroMessage(String business) {
    return 'Tu arduo trabajo y construcción de equipo han dado frutos. Ahora eres elegible para unirte a la oportunidad de $business.';
  }

  @override
  String get businessDisclaimerTitle => 'Aviso de descargo de responsabilidad';

  @override
  String businessDisclaimerMessage(String business) {
    return 'El crecimiento de tu equipo ha desbloqueado el acceso a $business. Esta oportunidad opera como un negocio independiente y no tiene afiliación con la plataforma Team Build Pro.';
  }

  @override
  String businessDisclaimerInfo(String business) {
    return 'La aplicación Team Build Pro simplemente facilita el acceso a $business a través de tu patrocinador de línea ascendente. No respalda ni garantiza ningún resultado específico de esta oportunidad.';
  }

  @override
  String get businessSponsorTitle => 'Tu contacto de referencia';

  @override
  String businessSponsorMessage(String business, String sponsor) {
    return 'Si eliges explorar $business, tu contacto de referencia será $sponsor. Esta persona es miembro de tu equipo de línea ascendente que ya se ha unido a $business.';
  }

  @override
  String businessInstructionsTitle(String business) {
    return 'Cómo unirse a $business';
  }

  @override
  String businessInstructions(String business) {
    return '1. Copia el enlace de referencia a continuación\n2. Abre tu navegador web\n3. Pega el enlace y completa el registro de $business\n4. Regresa aquí para agregar tu enlace de referencia de $business';
  }

  @override
  String get businessNoUrlMessage =>
      'URL de registro no disponible. Por favor contacta a tu patrocinador.';

  @override
  String get businessUrlLabel => 'Enlace de referencia de tu patrocinador:';

  @override
  String get businessUrlCopyTooltip => 'Copiar URL';

  @override
  String get businessUrlCopiedMessage =>
      '¡URL de registro copiada al portapapeles!';

  @override
  String businessUrlCopyError(String error) {
    return 'Error al copiar URL: $error';
  }

  @override
  String get businessFollowUpTitle => 'Paso final: Vincula tu cuenta';

  @override
  String businessFollowUpMessage(String business) {
    return 'Después de explorar $business, debes regresar aquí y agregar tu nuevo enlace de referencia de $business a tu perfil de Team Build Pro. Esto asegura que las conexiones de tu equipo se rastreen correctamente.';
  }

  @override
  String get businessCompleteButton1 => 'Registro completo';

  @override
  String get businessCompleteButton2 => 'Agregar mi enlace de referencia';

  @override
  String get businessConfirmDialogTitle => 'Antes de continuar';

  @override
  String businessConfirmDialogMessage(String business) {
    return 'Este es el siguiente paso en tu viaje. Después de unirte a $business a través del enlace de tu patrocinador, debes regresar aquí para agregar tu nuevo enlace de referencia de $business a tu perfil. Este es un paso crítico para asegurar que tus nuevos miembros del equipo se coloquen correctamente.';
  }

  @override
  String get businessConfirmDialogButton => 'Entiendo';

  @override
  String get businessVisitRequiredTitle => 'Visita requerida primero';

  @override
  String businessVisitRequiredMessage(String business) {
    return 'Antes de actualizar tu perfil, primero debes usar el botón \'Copiar enlace de registro\' en esta página para visitar $business y completar tu registro.';
  }

  @override
  String get businessVisitRequiredButton => 'OK';

  @override
  String get gettingStartedHeading => 'Comenzando con Team Build Pro';

  @override
  String get gettingStartedSubheading =>
      'Sigue estos sencillos pasos para comenzar a construir tu equipo';

  @override
  String gettingStartedStep1Description(String business) {
    return 'Crea una lista de prospectos de reclutamiento y miembros actuales del equipo de $business con quienes quieras compartir Team Build Pro. Piensa en quién podría beneficiarse de esta herramienta para acelerar la construcción de su equipo.';
  }

  @override
  String gettingStartedStep2Description(String business) {
    return 'Usa la función Compartir para enviar rápida y fácilmente mensajes de texto y correos electrónicos dirigidos a tus prospectos de reclutamiento y miembros del equipo de $business.';
  }

  @override
  String get gettingStartedStep2Button => 'Abrir compartir';

  @override
  String get gettingStartedProTipTitle => 'Consejo profesional';

  @override
  String get gettingStartedProTipMessage =>
      'El seguimiento constante y el compromiso son clave para construir un equipo fuerte y activo.';

  @override
  String get eligibilityHeroTitleQualified =>
      '¡FELICITACIONES!\n¡Estás calificado!';

  @override
  String get eligibilityHeroTitleNotQualified => 'Construye tu impulso';

  @override
  String eligibilityHeroMessageQualified(String business) {
    return '¡Trabajo increíble! Has construido tu equipo fundamental y desbloqueado la oportunidad de $business. Continúa creciendo tu red para ayudar a otros a lograr el mismo éxito.';
  }

  @override
  String eligibilityHeroMessageNotQualified(String business) {
    return '¡Estás en camino! Cada profesional con el que te conectas construye impulso para tu futuro lanzamiento en la oportunidad de $business. ¡Sigue compartiendo para alcanzar tus metas!';
  }

  @override
  String get eligibilityHeroButton => 'Estrategias de Crecimiento';

  @override
  String get eligibilityThresholdsTitle => 'UMBRALES DE CALIFICACIÓN';

  @override
  String get eligibilityLabelDirectSponsors => 'Patrocinadores directos';

  @override
  String get eligibilityLabelTotalTeam => 'Equipo total';

  @override
  String get eligibilityCurrentCountsTitle => 'TUS CONTEOS ACTUALES DEL EQUIPO';

  @override
  String get eligibilityCurrentDirectSponsors => 'Patrocinadores directos';

  @override
  String get eligibilityCurrentTotalTeam => 'Equipo total';

  @override
  String get eligibilityProcessTitle => 'EL PROCESO';

  @override
  String get eligibilityProcessStep1Title =>
      'INVITAR - Construye tu fundamento';

  @override
  String eligibilityProcessStep1Description(String business) {
    return 'Conéctate con profesionales de ideas afines abiertos a explorar $business.';
  }

  @override
  String get eligibilityProcessStep2Title => 'CULTIVAR - Crea impulso';

  @override
  String get eligibilityProcessStep2Description =>
      'Fomenta relaciones auténticas a medida que tu equipo crece, creando un equipo próspero de profesionales que se apoyan mutuamente en el éxito.';

  @override
  String get eligibilityProcessStep3Title => 'ASOCIAR - Lanza con éxito';

  @override
  String eligibilityProcessStep3Description(String business) {
    return 'Los miembros del equipo reciben una invitación para unirse a $business al lograr objetivos clave de crecimiento.';
  }

  @override
  String get shareHeading => 'Poderoso sistema de referencias';

  @override
  String get shareSubheading =>
      'Comparte tus enlaces de referencia para pre-construir un nuevo equipo con prospectos de reclutamiento o expandir tu equipo existente.';

  @override
  String get shareStrategiesTitle => 'Estrategias de crecimiento comprobadas';

  @override
  String get shareProspectTitle => 'Nuevos prospectos de reclutamiento';

  @override
  String get shareProspectSubtitle =>
      'Invita a prospectos de reclutamiento para comenzar con ventaja.';

  @override
  String shareProspectDescription(String business) {
    return 'Invita a prospectos de reclutamiento a pre-construir su equipo de $business con esta aplicación. Pueden crear un poderoso impulso antes de unirse oficialmente a $business, asegurando el éxito desde el primer día.';
  }

  @override
  String get sharePartnerTitle => 'Socios comerciales actuales';

  @override
  String sharePartnerSubtitle(String business) {
    return 'Ideal para tu equipo existente de $business';
  }

  @override
  String sharePartnerDescription(String business) {
    return 'Empodera a tus socios existentes de $business con la misma herramienta que usas. Esto promueve la duplicación y ayuda a acelerar el crecimiento en toda tu organización de $business.';
  }

  @override
  String get shareSelectMessageLabel => 'Seleccionar mensaje para enviar';

  @override
  String get shareButtonShare => 'Compartir';

  @override
  String get shareLinkCopiedMessage => '¡Enlace copiado al portapapeles!';

  @override
  String get shareProTipsTitle => 'Consejos profesionales para el éxito';

  @override
  String get shareProTip1 => '💬 Personaliza tu mensaje al compartir';

  @override
  String get shareProTip2 =>
      '📱 Comparte consistentemente en todas las plataformas sociales';

  @override
  String get shareProTip3 =>
      '🤝 Haz seguimiento con prospectos que muestren interés';

  @override
  String get shareProTip4 => '📈 Rastrea tus resultados y ajusta tu enfoque';

  @override
  String get shareProTip5 =>
      '🎯 Usa ambas estrategias para máximo potencial de crecimiento';

  @override
  String get shareDemoTitle => 'Modo de demostración';

  @override
  String get shareDemoMessage =>
      'Compartir deshabilitado durante el modo de demostración.';

  @override
  String get shareDemoButton => 'Entiendo';

  @override
  String get memberDetailButtonSendMessage => 'Enviar mensaje';

  @override
  String get memberDetailLabelDirectSponsors => 'Patrocinadores directos';

  @override
  String get memberDetailLabelJoinedNetwork => 'Se unió a la red';

  @override
  String memberDetailLabelJoinedOrganization(String bizOpp) {
    return 'Se unió a $bizOpp';
  }

  @override
  String get memberDetailLabelQualified => 'Calificado';

  @override
  String get memberDetailLabelQualifiedDate => 'Fecha de calificación';

  @override
  String get memberDetailLabelTeamLeader => 'Líder de equipo';

  @override
  String get memberDetailLabelTotalTeam => 'Equipo total';

  @override
  String get memberDetailNotYet => 'Aún no';

  @override
  String get memberDetailNotYetJoined => 'Aún no se ha unido';

  @override
  String get memberDetailEligibilityTitle => 'Requisitos de elegibilidad';

  @override
  String get memberDetailEligibilityDirectSponsors => 'Patrocinadores directos';

  @override
  String get memberDetailEligibilityTotalTeam => 'Equipo total';

  @override
  String memberDetailEligibilityMessage(String organization) {
    return 'Los miembros del equipo que cumplan estos requisitos son invitados automáticamente a unirse a $organization.';
  }

  @override
  String get memberDetailEligibilityWaived => 'Exonerado';

  @override
  String memberDetailEligibilityWaivedMessage(String organization) {
    return 'Los requisitos de elegibilidad están exentos para personas que se unieron a $organization antes de unirse a la Red.';
  }

  @override
  String get messageThreadHeading => 'Centro de mensajes';

  @override
  String get messageThreadEmptyMessage => '¡Comienza la conversación!';

  @override
  String get messageThreadUrlWarningTitle => 'Advertencia de enlace externo';

  @override
  String get messageThreadUrlWarningMessage =>
      'Este mensaje contiene un enlace externo. Ten cuidado al hacer clic en enlaces de fuentes desconocidas.';

  @override
  String get messageThreadUrlWarningButton => 'Entendido';

  @override
  String get chatbotAssistantTitle => 'Asistente de IA';

  @override
  String get chatbotAssistantSubtitle =>
      'Pregúntame cualquier cosa sobre Team Build Pro';

  @override
  String get chatbotClearTooltip => 'Borrar conversación';

  @override
  String get chatbotSignInRequired =>
      'Por favor inicia sesión para usar el Asistente de IA';

  @override
  String get companyHeading => 'Detalles de la compañía';

  @override
  String get companyLabelName => 'Nombre de la compañía';

  @override
  String get companyLabelReferralLink =>
      'Mi enlace de referencia de la compañía';

  @override
  String get companyLinkedTitle => '¡Cuenta vinculada!';

  @override
  String companyLinkedMessage(String business) {
    return '¡Buenas noticias! A medida que tus miembros del equipo ganen impulso y califiquen, recibirán una invitación para unirse a tu organización de $business.';
  }

  @override
  String get companyNotAvailable => 'No disponible';

  @override
  String get deleteAccountHeading => 'Eliminación de cuenta';

  @override
  String get deleteAccountSubheading =>
      'Lamentamos verte partir. Por favor revisa la información a continuación cuidadosamente.';

  @override
  String get deleteAccountWarningTitle => 'ELIMINACIÓN PERMANENTE DE CUENTA';

  @override
  String get deleteAccountWarningMessage =>
      'Esta acción no se puede deshacer. Cuando elimines tu cuenta:';

  @override
  String get deleteAccountWarning1 =>
      'Tus datos personales serán eliminados permanentemente';

  @override
  String get deleteAccountWarning2 =>
      'Perderás el acceso a todas las funciones premium';

  @override
  String get deleteAccountWarning3 =>
      'Tu cuenta no se puede recuperar ni reactivar';

  @override
  String get deleteAccountWarning4 =>
      'Tus relaciones de red se preservarán para la continuidad del negocio';

  @override
  String get deleteAccountWarning5 =>
      'Cerrarás sesión inmediatamente en todos los dispositivos';

  @override
  String get deleteAccountInfoTitle => 'Información de la cuenta';

  @override
  String get deleteAccountConfirmTitle => 'Confirmación requerida';

  @override
  String get deleteAccountConfirmLabel =>
      'Para confirmar la eliminación, por favor escribe tu dirección de correo electrónico:';

  @override
  String get deleteAccountCheckbox1 =>
      'Entiendo que esta acción es permanente y no se puede deshacer';

  @override
  String get deleteAccountCheckbox2 =>
      'Entiendo que perderé el acceso a todos los datos y funciones premium';

  @override
  String get deleteAccountCheckbox3 =>
      'Reconozco que mis relaciones de red se preservarán para operaciones comerciales';

  @override
  String get deleteAccountDeleting => 'Eliminando...';

  @override
  String get deleteAccountHelpTitle => '¿Necesitas ayuda?';

  @override
  String get deleteAccountHelpMessage =>
      'Si estás experimentando problemas con la aplicación, por favor contacta a nuestro equipo de soporte antes de eliminar tu cuenta.';

  @override
  String get deleteAccountHelpButton => 'Contactar soporte';

  @override
  String get deleteAccountDemoTitle => 'Protección de cuenta de demostración';

  @override
  String get deleteAccountDemoMessage =>
      'Esta es una cuenta de demostración protegida y no se puede eliminar.\n\nLas cuentas de demostración se mantienen para revisión de aplicaciones y fines de demostración.\n\nSi estás probando la aplicación, por favor crea una nueva cuenta para probar las funciones de eliminación de cuenta.';

  @override
  String get deleteAccountDemoButton => 'OK';

  @override
  String deleteAccountErrorFailed(String error) {
    return 'Error al eliminar la cuenta: $error';
  }

  @override
  String get deleteAccountErrorEmailMismatch =>
      'La dirección de correo electrónico que ingresaste no coincide con el correo de tu cuenta. Por favor verifica e inténtalo de nuevo.';

  @override
  String get deleteAccountErrorNotFound =>
      'No pudimos encontrar tu cuenta en nuestro sistema. Por favor contacta a soporte para asistencia.';

  @override
  String get deleteAccountErrorSessionExpired =>
      'Tu sesión ha expirado. Por favor cierra sesión e inicia sesión nuevamente, luego reintenta la eliminación de cuenta.';

  @override
  String get deleteAccountErrorPermissionDenied =>
      'No tienes permiso para eliminar esta cuenta. Por favor contacta a soporte si necesitas asistencia.';

  @override
  String get deleteAccountErrorServerError =>
      'Ocurrió un error inesperado en nuestros servidores. Por favor intenta de nuevo en unos minutos o contacta a soporte.';

  @override
  String get deleteAccountErrorServiceUnavailable =>
      'El servicio está temporalmente no disponible. Por favor verifica tu conexión a internet e intenta de nuevo.';

  @override
  String get deleteAccountErrorProcessing =>
      'Encontramos un problema al procesar tu solicitud. Por favor intenta de nuevo o contacta a soporte para ayuda.';

  @override
  String get deleteAccountErrorUnexpected =>
      'Ocurrió un error inesperado. Por favor intenta de nuevo o contacta a support@teambuildpro.com para asistencia.';

  @override
  String get deleteAccountErrorEmailApp =>
      'No se pudo abrir la aplicación de correo. Por favor contacta a support@teambuildpro.com manualmente.';

  @override
  String get editProfileHeading => 'Editar perfil';

  @override
  String get editProfileHeadingFirstTime => 'Completa tu perfil';

  @override
  String get editProfileInstructionsFirstTime =>
      'Por favor completa tu perfil para comenzar';

  @override
  String get editProfileBusinessQuestion => '¿Eres actualmente un ';

  @override
  String get editProfileBusinessQuestionSuffix => ' representante?';

  @override
  String get editProfileYes => 'Sí';

  @override
  String get editProfileNo => 'No';

  @override
  String get editProfileDialogImportantTitle => '¡Muy importante!';

  @override
  String editProfileDialogImportantMessage(String business) {
    return 'Debes ingresar el enlace de referencia exacto que recibiste de tu patrocinador de $business.';
  }

  @override
  String get editProfileDialogImportantButton => 'Entiendo';

  @override
  String get editProfileReferralLinkField => 'Ingresa tu enlace de referencia';

  @override
  String get editProfileReferralLinkLabel => 'Tu enlace de referencia';

  @override
  String editProfileReferralLinkHelper(String business) {
    return 'Ingresa el enlace de referencia de tu patrocinador de $business';
  }

  @override
  String get editProfileConfirmReferralLink => 'Confirmar enlace de referencia';

  @override
  String get editProfileSelectCountry => 'Selecciona tu país';

  @override
  String get editProfileSelectState => 'Selecciona tu estado/provincia';

  @override
  String get editProfileSelectStateDisabled => 'Primero selecciona un país';

  @override
  String get editProfileErrorCity => 'Por favor ingresa tu ciudad';

  @override
  String get editProfileErrorState =>
      'Por favor selecciona tu estado/provincia';

  @override
  String get editProfileErrorCountry => 'Por favor selecciona tu país';

  @override
  String get editProfilePhotoError =>
      'Error al cargar la foto. Por favor intenta de nuevo.';

  @override
  String get editProfileDeletionTitle => 'Eliminar cuenta';

  @override
  String get editProfileDeletionMessage =>
      'Eliminar permanentemente tu cuenta y todos los datos asociados.';

  @override
  String get editProfileDeletionSubtext => 'Esta acción no se puede deshacer';

  @override
  String get editProfileDeletionButton => 'Completar eliminación';

  @override
  String get loginLabelEmail => 'Correo electrónico';

  @override
  String get loginLabelPassword => 'Contraseña';

  @override
  String get loginValidatorEmail => 'Por favor ingrese su correo electrónico';

  @override
  String get loginValidatorPassword => 'Por favor ingrese su contraseña';

  @override
  String get loginButtonLogin => 'Iniciar sesión';

  @override
  String get loginButtonBiometric => 'Iniciar sesión con biometría';

  @override
  String get loginDividerOr => 'o';

  @override
  String get loginNoAccount => '¿No tiene una cuenta? ';

  @override
  String get loginCreateAccount => 'Crear cuenta';

  @override
  String get loginPrivacyPolicy => 'Política de privacidad';

  @override
  String get loginTermsOfService => 'Términos de servicio';

  @override
  String welcomeGreeting(String firstName) {
    return '¡Bienvenido, $firstName!';
  }

  @override
  String get welcomeMessageAdmin =>
      '¿Listo para liderar la revolución de redes profesionales? Complete su perfil de administrador y configure su equipo. Después de completar su perfil, tendrá acceso a la plataforma completa de Team Build Pro.';

  @override
  String get welcomeMessageUser =>
      '¿Listo para transformar su red profesional? Complete su perfil para desbloquear todo el poder de Team Build Pro.';

  @override
  String get welcomeButtonJoin => 'Únase a la revolución';

  @override
  String get changePasswordHeading => 'Cambiar contraseña';

  @override
  String get changePasswordTodoMessage =>
      'TODO: Implementar formulario de cambio de contraseña aquí.';

  @override
  String get chatPlaceholder => 'La interfaz de chat va aquí.';

  @override
  String get quickPromptsWelcomeTitle => '¡Bienvenido a su Coach de IA!';

  @override
  String get quickPromptsWelcomeDescription =>
      'Estoy aquí para ayudarle a tener éxito con Team Build Pro. Puedo responder preguntas sobre la aplicación, estrategias de construcción de equipo y guiarle a través de las funciones.';

  @override
  String get quickPromptsDisclaimerMessage =>
      'El Coach de IA puede cometer errores. Verifique la información importante.';

  @override
  String get quickPromptsQuestionHeader => '¿En qué puedo ayudarle?';

  @override
  String get quickPromptsQuestionSubheader =>
      'Toque cualquier pregunta a continuación para comenzar, o escriba su propia pregunta.';

  @override
  String get quickPromptsProTipLabel => 'Consejo Pro';

  @override
  String get quickPromptsProTipText =>
      'Sea específico con sus preguntas. Por ejemplo: \"Tengo 2 patrocinadores directos, ¿en qué debo enfocarme a continuación?\"';

  @override
  String get chatbotPrompt1 => '¿Cómo funciona la calificación?';

  @override
  String get chatbotPrompt2 => '¿Cuál es la diferencia entre esto y un MLM?';

  @override
  String get chatbotPrompt3 => '¿Cómo invito a personas a mi equipo?';

  @override
  String get chatbotPrompt4 => 'Muéstrame el análisis de mi equipo';

  @override
  String get chatbotPrompt5 => '¿En qué debo enfocarme a continuación?';

  @override
  String get chatbotPrompt6 => '¿Cómo cancelo mi suscripción?';

  @override
  String get chatbotPrompt7 =>
      '¿Por qué fracasa la mayoría de las personas en las ventas directas?';

  @override
  String get chatbotPrompt8 => '¿Qué sucede después de que califique?';

  @override
  String get shareProspectPastStrugglesTitle => 'Abordando Luchas Pasadas';

  @override
  String get shareProspectPastStrugglesDescription =>
      'Perfecto para prospectos que lo han intentado antes y han tenido dificultades';

  @override
  String shareProspectPastStrugglesSubject(Object business) {
    return '¿Pensando en $business de Nuevo? Encontré un Enfoque Diferente';
  }

  @override
  String shareProspectPastStrugglesMessage(Object business, Object link) {
    return 'Sé que ambos hemos tenido experiencias difíciles con las ventas directas antes. $business sigue apareciendo, y yo también he sido reacio.\n\nPero encontré algo diferente - una app llamada Team Build Pro que te permite construir un equipo ANTES de unirte a algo. La idea es que puedes ver si realmente puedes reclutar personas antes de invertir.\n\nTiene coaching de IA y mensajes pre-escritos para que no tengas que resolver todo solo.\n\nLo estoy probando yo mismo. Si todavía tienes curiosidad sobre $business, podría valer la pena echarle un vistazo:\n\n$link\n\nPensé que podríamos explorar esto juntos y ver si es diferente esta vez.';
  }

  @override
  String get shareProspectNotSalespersonTitle => 'Para No Vendedores';

  @override
  String get shareProspectNotSalespersonDescription =>
      'Ideal para personas que no se ven a sí mismas como \"vendedores\"';

  @override
  String get shareProspectNotSalespersonSubject =>
      'Encontré Algo para No-Vendedores Como Nosotros';

  @override
  String shareProspectNotSalespersonMessage(Object business, Object link) {
    return 'Sabes que no soy un vendedor natural. Por eso siempre he dudado con cosas como $business.\n\nEncontré esta app llamada Team Build Pro que está diseñada para personas como nosotros. Tiene 16 mensajes pre-escritos y un Coach de IA, así que no tienes que inventar discursos de venta por tu cuenta.\n\n¿La parte genial? Puedes construir un equipo ANTES de unirte a cualquier oportunidad. Así puedes ver si realmente te sientes cómodo con la parte de reclutamiento sin comprometerte primero.\n\nLo estoy probando yo mismo. Pensé que te identificarías:\n\n$link\n\nQuizás no somos tan \"no-vendedores\" como pensamos - solo necesitábamos las herramientas correctas.';
  }

  @override
  String get shareProspectHopeAfterDisappointmentTitle =>
      'Esperanza Después de la Decepción';

  @override
  String get shareProspectHopeAfterDisappointmentDescription =>
      'Ideal para prospectos quemados por oportunidades anteriores';

  @override
  String shareProspectHopeAfterDisappointmentSubject(Object business) {
    return '¿Otra Mirada a $business? Esta Vez Con una Red de Seguridad';
  }

  @override
  String shareProspectHopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'Sé que te han quemado antes. A mí también. Las promesas de $business y otras oportunidades que nunca se cumplieron.\n\nEncontré algo que se siente diferente - no otra oportunidad, sino una herramienta. Team Build Pro te permite construir un equipo ANTES de unirte a nada. Puedes ver resultados reales antes de invertir.\n\nSin exageraciones. Solo un Coach de IA, mensajes pre-escritos, y una forma de rastrear el progreso real.\n\nLo estoy explorando yo mismo porque estoy cansado de empezar desde cero cada vez:\n\n$link\n\nSi no funciona, al menos lo sabremos antes de poner dinero. Pensé que querrías probarlo conmigo.';
  }

  @override
  String get shareProspectGeneralInvitationTitle => 'Invitación General';

  @override
  String get shareProspectGeneralInvitationDescription =>
      'Un mensaje versátil para cualquier situación de prospecto';

  @override
  String shareProspectGeneralInvitationSubject(Object business) {
    return '¿Explorando $business? Encontré Algo Interesante';
  }

  @override
  String shareProspectGeneralInvitationMessage(Object business, Object link) {
    return '¡Hola! He estado investigando $business y encontré algo que me llamó la atención.\n\nHay una app llamada Team Build Pro que te permite construir un equipo ANTES de unirte oficialmente a cualquier oportunidad. La idea es que puedes probar las aguas y ganar impulso sin comprometerte primero.\n\nTiene:\n- 16 mensajes de reclutamiento pre-escritos\n- Un Coach de IA para orientación\n- Una forma de rastrear quién está interesado\n\nLo estoy explorando yo mismo. Pensé que querrías verlo también ya que sé que has tenido curiosidad sobre $business.\n\nEchale un vistazo: $link\n\nSin presión - solo compartiendo lo que encontré.';
  }

  @override
  String get shareProspectSocialAnxietyTitle =>
      'Evitando Conversaciones Incómodas';

  @override
  String get shareProspectSocialAnxietyDescription =>
      'Perfecto para introvertidos o aquellos incómodos con el reclutamiento cara a cara';

  @override
  String get shareProspectSocialAnxietySubject =>
      'Construyendo una Red Sin las Conversaciones Incómodas';

  @override
  String shareProspectSocialAnxietyMessage(Object business, Object link) {
    return 'La razón por la que nunca me he lanzado completamente con $business o similar? El pensamiento de conversaciones de venta incómodas me hace temblar.\n\nEncontré Team Build Pro - te permite construir un equipo en línea, a tu propio ritmo, con mensajes pre-escritos. Sin llamadas en frío, sin presentaciones cara a cara.\n\nY aquí está lo importante: puedes hacer todo esto ANTES de unirte a cualquier oportunidad. Así puedes ganar confianza y ver si funciona para ti sin la presión.\n\nLo estoy probando yo mismo. Pensé que apreciarías el enfoque sin presión también:\n\n$link\n\nPodemos construir redes sin ser \"esa persona\" en las fiestas.';
  }

  @override
  String get shareProspectTimeConstrainedTitle => 'Para Profesionales Ocupados';

  @override
  String get shareProspectTimeConstrainedDescription =>
      'Ideal para prospectos haciendo malabarismos con trabajo, familia y otros compromisos';

  @override
  String shareProspectTimeConstrainedSubject(Object business) {
    return 'Explorando $business en Momentos Libres';
  }

  @override
  String shareProspectTimeConstrainedMessage(Object business, Object link) {
    return 'Sé que estás tan ocupado como yo. Esa siempre ha sido la excusa para no explorar cosas como $business.\n\nEncontré Team Build Pro - puedes construir un equipo en pequeños trozos de tiempo. 15 minutos aquí, 20 minutos allá. El Coach de IA y los mensajes pre-escritos lo hacen eficiente.\n\n¿La mejor parte? Haces esto ANTES de unirte a cualquier oportunidad. Así puedes probarlo alrededor de tu horario sin compromiso.\n\nLo estoy probando durante pausas de almuerzo y tiempo de café:\n\n$link\n\nSi funciona para alguien tan apretado de tiempo como nosotros, podría valer la pena explorarlo juntos.';
  }

  @override
  String get shareProspectFinancialRiskAverseTitle => 'Miedo a Perder Dinero';

  @override
  String get shareProspectFinancialRiskAverseDescription =>
      'Ideal para prospectos preocupados por el riesgo financiero';

  @override
  String shareProspectFinancialRiskAverseSubject(Object business) {
    return 'Probando $business Sin Riesgo Financiero Primero';
  }

  @override
  String shareProspectFinancialRiskAverseMessage(Object business, Object link) {
    return 'Lo que siempre me ha detenido de $business? Odio perder dinero en cosas que no funcionan.\n\nEncontré Team Build Pro - te permite construir un equipo ANTES de unirte a cualquier oportunidad. Puedes ver resultados reales antes de invertir en nada.\n\nLa app cuesta solo \$6.99/mes después de una prueba gratis. Mucho menos que comprar una oportunidad a ciegas.\n\nLo estoy probando para ver si realmente puedo reclutar personas primero:\n\n$link\n\nPensé que apreciarías el enfoque de bajo riesgo también. Ver pruebas antes de gastar dinero real.';
  }

  @override
  String get shareProspectSkepticalRealistTitle => 'Muéstreme Pruebas';

  @override
  String get shareProspectSkepticalRealistDescription =>
      'Perfecto para prospectos quemados por falsas promesas';

  @override
  String shareProspectSkepticalRealistSubject(Object business) {
    return 'Sin Exageraciones - Solo Probando $business de Forma Inteligente';
  }

  @override
  String shareProspectSkepticalRealistMessage(Object business, Object link) {
    return 'Soy tan escéptico como tú. Cada presentación de $business suena igual - \"¡ingresos que cambian la vida!\" Sí, claro.\n\nEncontré Team Build Pro - no otra oportunidad, solo una herramienta. Te muestra métricas reales: a quién has contactado, quién está interesado, tu progreso real. Sin relleno.\n\nY puedes hacer todo esto ANTES de unirte a nada. Datos antes de decisiones.\n\nLo estoy probando para ver si los números realmente funcionan:\n\n$link\n\nSin promesas. Sin exageraciones. Solo déjame saber si los datos te parecen interesantes.';
  }

  @override
  String get shareProspect2GeneralInvitationTitle => 'Invitación General';

  @override
  String get shareProspect2GeneralInvitationDescription =>
      'Un mensaje versátil para cualquier situación de prospecto';

  @override
  String shareProspect2GeneralInvitationSubject(Object business) {
    return 'Construye Tu Equipo de $business Antes del Día 1';
  }

  @override
  String shareProspect2GeneralInvitationMessage(Object business, Object link) {
    return '¿Pensando en unirte a $business? Quiero compartir algo que puede darte una ventaja real.\n\nTeam Build Pro te permite construir tu equipo ANTES de unirte oficialmente. Así que cuando empieces conmigo, no estás empezando desde cero - lanzas con personas ya esperando.\n\nLa app incluye:\n- 16 mensajes de reclutamiento pre-escritos listos para compartir\n- Coach de IA 24/7 para preguntas de reclutamiento\n- Seguimiento en tiempo real de quién está interesado\n\nHe visto lo que pasa cuando nuevos miembros del equipo empiezan en frío. Esto lo cambia.\n\nMíralo: $link\n\nCuando estés listo para unirte a mi equipo de $business, arrancarás con todo.';
  }

  @override
  String get shareProspect2PastStrugglesTitle => 'Abordando Luchas Pasadas';

  @override
  String get shareProspect2PastStrugglesDescription =>
      'Perfecto para prospectos que lo han intentado antes y han tenido dificultades';

  @override
  String get shareProspect2PastStrugglesSubject =>
      'Esta Vez Será Diferente - Aquí Está el Por Qué';

  @override
  String shareProspect2PastStrugglesMessage(Object business, Object link) {
    return 'Sé que has tenido dificultades antes con las ventas directas. Intentos pasados con $business u oportunidades similares te dejaron empezando desde cero.\n\nEso es exactamente por lo que te quiero en mi equipo - y por qué te comparto Team Build Pro.\n\nTe permite construir tu equipo de $business ANTES de unirte oficialmente. Con 16 mensajes pre-escritos y un Coach de IA guiándote en cada paso, no estarás solo esta vez.\n\nSeré tu patrocinador Y tendrás soporte de IA 24/7.\n\nMira cómo funciona: $link\n\nTe mereces una oportunidad real. Déjame ayudarte a hacerlo bien esta vez.';
  }

  @override
  String get shareProspect2NotSalespersonTitle => 'Para No Vendedores';

  @override
  String get shareProspect2NotSalespersonDescription =>
      'Ideal para personas que no se ven a sí mismas como \"vendedores\"';

  @override
  String shareProspect2NotSalespersonSubject(Object business) {
    return 'Únete a Mi Equipo de $business - Sin Necesidad de Personalidad de Vendedor';
  }

  @override
  String shareProspect2NotSalespersonMessage(Object business, Object link) {
    return '¿No eres un vendedor natural? Está bien - no necesitas serlo para tener éxito en mi equipo.\n\nTeam Build Pro te da 16 mensajes de reclutamiento pre-escritos y un Coach de IA. Tú te enfocas en relaciones genuinas. La IA maneja lo de \"ventas\".\n\nY aquí está lo mejor: puedes construir tu equipo ANTES de unirte a $business. Gana confianza con las herramientas primero.\n\nTe guiaré como tu patrocinador, y la IA te asesora 24/7.\n\nEmpieza a construir: $link\n\nEs como tener un asistente de reclutamiento que nunca duerme. Únete a mi equipo y deja que las herramientas trabajen para ti.';
  }

  @override
  String get shareProspect2HopeAfterDisappointmentTitle =>
      'Esperanza Después de la Decepción';

  @override
  String get shareProspect2HopeAfterDisappointmentDescription =>
      'Ideal para prospectos quemados por oportunidades anteriores';

  @override
  String shareProspect2HopeAfterDisappointmentSubject(Object business) {
    return 'Únete a Mi Equipo de $business Con Soporte Real Esta Vez';
  }

  @override
  String shareProspect2HopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'Sé que te han quemado antes. Promesas vacías, cero soporte, empezando desde cero.\n\nAsí no es como yo dirijo mi equipo.\n\nTeam Build Pro te permite construir tu equipo de $business ANTES de unirte oficialmente. Impulso real antes del Día 1. Sin exageraciones - solo herramientas impulsadas por IA que realmente funcionan.\n\nSeré tu patrocinador, el Coach de IA te guía 24/7, y tendrás mensajes pre-escritos listos para usar.\n\nMira cómo: $link\n\nTe mereces un sistema que te prepare para ganar. Te quiero en mi equipo.';
  }

  @override
  String get shareProspect2SocialAnxietyTitle =>
      'Evitando Conversaciones Incómodas';

  @override
  String get shareProspect2SocialAnxietyDescription =>
      'Perfecto para introvertidos o aquellos incómodos con el reclutamiento cara a cara';

  @override
  String shareProspect2SocialAnxietySubject(Object business) {
    return 'Construye Tu Equipo de $business Sin Conversaciones Incómodas';
  }

  @override
  String shareProspect2SocialAnxietyMessage(Object business, Object link) {
    return '¿Incómodo con conversaciones de venta incómodas? Lo entiendo. Por eso uso Team Build Pro con mi equipo.\n\nTe permite construir tu red de $business en línea, a tu propio ritmo:\n- 16 mensajes pre-escritos - sin \"¿qué digo?\"\n- Construye prospectos a tu propio ritmo\n- Guía de IA 24/7 cuando la necesites\n\nSin llamadas en frío. Sin presentaciones cara a cara requeridas. Y puedes empezar a construir ANTES de unirte.\n\nEmpieza en tus términos: $link\n\nCuando te unas a mi equipo, tendrás impulso real de personas que reclutaste cómodamente en línea.';
  }

  @override
  String get shareProspect2TimeConstrainedTitle =>
      'Para Profesionales Ocupados';

  @override
  String get shareProspect2TimeConstrainedDescription =>
      'Ideal para prospectos haciendo malabarismos con trabajo, familia y otros compromisos';

  @override
  String shareProspect2TimeConstrainedSubject(Object business) {
    return 'Construye Tu Equipo de $business en los Huecos de Tu Vida';
  }

  @override
  String shareProspect2TimeConstrainedMessage(Object business, Object link) {
    return 'Sé que estás ocupado. En realidad por eso $business podría funcionar para ti - y por qué te quiero en mi equipo.\n\nTeam Build Pro te permite construir tu equipo ANTES de unirte oficialmente - en pequeños momentos de tiempo. Café de la mañana. Pausa de almuerzo. Tiempo libre nocturno.\n\nEl Coach de IA y 16 mensajes pre-escritos hacen que cada minuto cuente:\n- Rastrea todos los prospectos en un solo lugar\n- Obtén guía de IA cuando tengas unos minutos\n- Mira crecer tu impulso\n\nMira cómo encaja en tu vida: $link\n\nCuando estés listo para unirte a mi equipo, no empezarás desde cero. Lanzarás con personas ya esperando.';
  }

  @override
  String get shareProspect2FinancialRiskAverseTitle => 'Miedo a Perder Dinero';

  @override
  String get shareProspect2FinancialRiskAverseDescription =>
      'Ideal para prospectos preocupados por el riesgo financiero';

  @override
  String shareProspect2FinancialRiskAverseSubject(Object business) {
    return 'Ve Resultados Antes de Invertir en $business';
  }

  @override
  String shareProspect2FinancialRiskAverseMessage(
      Object business, Object link) {
    return '¿Preocupado por perder dinero? Inteligente. Por eso recomiendo Team Build Pro a todos los que se unen a mi equipo.\n\nTe permite construir tu equipo de $business ANTES de invertir oficialmente - así ves resultados reales primero.\n\nRastrea tu progreso real:\n- Quién está interesado en unirse\n- Tu impulso creciendo\n- Prueba de que el sistema funciona para ti\n\nSolo \$6.99/mes después de una prueba gratis. Mucho menos riesgo que lanzarte a ciegas.\n\nVe la prueba primero: $link\n\nCuando finalmente te unas a mi equipo de $business, lanzarás con personas ya esperando - no arriesgando todo en esperanza.';
  }

  @override
  String get shareProspect2SkepticalRealistTitle => 'Muéstreme Pruebas';

  @override
  String get shareProspect2SkepticalRealistDescription =>
      'Perfecto para prospectos quemados por falsas promesas';

  @override
  String shareProspect2SkepticalRealistSubject(Object business) {
    return 'Sin Exageraciones. Métricas Reales. Únete a Mi Equipo de $business.';
  }

  @override
  String shareProspect2SkepticalRealistMessage(Object business, Object link) {
    return '¿Cansado de promesas vacías? Yo también. Por eso dirijo mi equipo de $business diferente.\n\nTeam Build Pro te muestra métricas reales en cada paso:\n- Cuántas personas has contactado\n- Quién ha respondido y está interesado\n- Tu progreso real hacia la calificación\n- Próximos pasos que recomienda la IA\n\nSin relleno. Sin exageración. Solo datos. Y puedes hacer todo esto ANTES de unirte.\n\nVe la transparencia: $link\n\nCuando te unas a mi equipo, lanzarás con pruebas - no con fe ciega. Esa es la única forma en que hago negocios.';
  }

  @override
  String get sharePartnerWarmMarketExhaustedTitle => 'Mercado Cálido Agotado';

  @override
  String get sharePartnerWarmMarketExhaustedDescription =>
      'Para socios que han agotado amigos y familiares';

  @override
  String get sharePartnerWarmMarketExhaustedSubject =>
      'Dé a Su Equipo un Compañero de Reclutamiento de IA';

  @override
  String sharePartnerWarmMarketExhaustedMessage(Object business, Object link) {
    return '¿Su equipo de $business agotó su mercado cálido? ¿Cansado de verlos perseguir leads que los ignoran?\n\nDé a toda su organización de $business un compañero de reclutamiento de IA.\n\nTeam Build Pro funciona para cada persona en su equipo:\n- 16 mensajes pre-escritos eliminan el \"¿qué digo?\"\n- Rastrean el interés y participación de prospectos\n- Coach de IA 24/7 responde sus preguntas\n- Todos duplican el mismo sistema probado\n\nSus prospectos pre-construyen equipos ANTES de unirse - lanzando con impulso, no desde cero.\n\nTodo su equipo de $business obtiene la misma ventaja de IA. Verdadera duplicación a escala.\n\nEmpodere a su equipo: $link\n\nDeje de verlos perseguir. Comience a verlos tener éxito.';
  }

  @override
  String get sharePartnerExpensiveSystemFatigueTitle =>
      'Fatiga de Sistemas y Gastos';

  @override
  String get sharePartnerExpensiveSystemFatigueDescription =>
      'Para socios agotados de métodos de reclutamiento costosos';

  @override
  String get sharePartnerExpensiveSystemFatigueSubject =>
      'Deje de Pagar de Más. Empodere a Su Equipo con IA';

  @override
  String sharePartnerExpensiveSystemFatigueMessage(
      Object business, Object link) {
    return '¿Su equipo de $business quemando dinero en leads, embudos y sistemas que no se duplican?\n\nTeam Build Pro da a toda su organización de $business herramientas de reclutamiento de IA - integradas. Sin costos extras. Sin configuración compleja.\n\nCada persona en su equipo obtiene:\n- 16 mensajes de reclutamiento pre-escritos\n- Rastreo de participación en tiempo real\n- Coach de IA 24/7 para asesoría\n- Un sistema simple que se duplica\n\nSus prospectos pre-construyen equipos ANTES de unirse. Su equipo de $business duplica las mismas herramientas de IA exactas. Todos ganan.\n\nUn sistema simple. Resultados reales.\n\nEmpodere a su equipo: $link\n\nDeje de pagar de más. Comience a escalar inteligentemente.';
  }

  @override
  String get sharePartnerDuplicationStruggleTitle => 'Desafíos de Duplicación';

  @override
  String get sharePartnerDuplicationStruggleDescription =>
      'Para líderes que luchan para que su equipo duplique';

  @override
  String get sharePartnerDuplicationStruggleSubject =>
      'Finalmente, Duplicación Real para Su Equipo';

  @override
  String sharePartnerDuplicationStruggleMessage(Object business, Object link) {
    return '¿Su equipo de $business lucha para duplicar su éxito de reclutamiento? Eso termina hoy.\n\nTeam Build Pro da a cada persona en su equipo de $business el mismo coach de reclutamiento de IA que hubiera deseado tener:\n- Redacta sus mensajes de reclutamiento\n- Programa sus seguimientos perfectamente\n- Rastrea sus prospectos automáticamente\n- Asesora sus próximos pasos\n\nRecluta nuevo o líder veterano - todos en su organización de $business obtienen herramientas de IA idénticas. Verdadera duplicación del sistema.\n\nSus prospectos pre-construyen equipos ANTES de unirse. Su equipo crece más rápido. Consistentemente.\n\nEmpodere la verdadera duplicación: $link\n\nFinalmente, todo su equipo tiene éxito de la misma manera.';
  }

  @override
  String get sharePartnerGeneralTeamToolTitle => 'Invitación General';

  @override
  String get sharePartnerGeneralTeamToolDescription =>
      'Un mensaje versátil para cualquier situación de socio';

  @override
  String get sharePartnerGeneralTeamToolSubject =>
      'La Ventaja de Reclutamiento de IA para Su Equipo';

  @override
  String sharePartnerGeneralTeamToolMessage(Object business, Object link) {
    return 'Su equipo de $business merece una verdadera ventaja competitiva.\n\nTeam Build Pro da a toda su organización de $business herramientas de reclutamiento de IA que realmente se duplican:\n\n- 16 mensajes de reclutamiento pre-escritos para cualquier situación\n- Rastrear participación de prospectos en tiempo real\n- Coach de IA 24/7 para asesoría de reclutamiento\n- Verdadera duplicación - todos obtienen las mismas herramientas\n\nLos prospectos de su equipo pre-construyen sus equipos ANTES de unirse. Sus socios duplican las mismas herramientas de IA exactas. Todos en su organización de $business crecen más rápido.\n\nDé a su equipo la ventaja de IA: $link\n\nAsí es como los líderes modernos escalan sus equipos.';
  }

  @override
  String get sharePartnerRetentionCrisisTitle =>
      'Problema de Abandono del Equipo';

  @override
  String get sharePartnerRetentionCrisisDescription =>
      'Para líderes frustrados por miembros del equipo que renuncian temprano';

  @override
  String get sharePartnerRetentionCrisisSubject =>
      'Deje de Perder a Su Equipo en el Primer Año';

  @override
  String sharePartnerRetentionCrisisMessage(Object business, Object link) {
    return '¿Viendo a su equipo de $business renunciar antes de tener éxito?\n\nEl 75% abandona en su primer año - usualmente porque se sienten perdidos, sin apoyo o abrumados.\n\nTeam Build Pro cambia eso para toda su organización de $business. Cada persona en su equipo obtiene un Coach de IA que:\n- Responde sus preguntas de reclutamiento 24/7\n- Rastrea su progreso y celebra victorias\n- Proporciona 16 mensajes pre-escritos para confianza\n- Mantiene el impulso cuando la motivación baja\n\nNunca están solos. Siempre saben su próximo paso. Se mantienen comprometidos por más tiempo.\n\nSu equipo de $business finalmente tiene el apoyo que necesita para tener éxito.\n\nEmpodere a su equipo: $link\n\nDeje de verlos renunciar. Comience a verlos ganar.';
  }

  @override
  String get sharePartnerSkillGapTeamTitle => 'Miembros del Equipo Sin Ventas';

  @override
  String get sharePartnerSkillGapTeamDescription =>
      'Perfecto para equipos donde la mayoría carece de experiencia en ventas';

  @override
  String get sharePartnerSkillGapTeamSubject =>
      'Su Equipo Sin Ventas Puede Ganar con IA';

  @override
  String sharePartnerSkillGapTeamMessage(Object business, Object link) {
    return 'La mayoría de su equipo de $business no son vendedores naturales. Eso los ha estado frenando.\n\nTeam Build Pro convierte a sus socios de $business sin ventas en reclutadores seguros:\n- 16 mensajes de reclutamiento pre-escritos listos para enviar\n- Rastrean prospectos y ven impulso real\n- Coach de IA 24/7 para asesoría y apoyo\n- Todos usan el mismo sistema probado\n\nSus introvertidos, sus trabajadores a tiempo parcial, sus personas de \"no soy bueno en ventas\" - todos en su organización de $business obtienen la misma ventaja de IA.\n\nFinalmente, todo su equipo puede duplicar su éxito.\n\nEmpodere a todos: $link\n\nNo necesita un equipo de vendedores. Necesita un equipo con IA.';
  }

  @override
  String get sharePartnerRecruitmentFatigueTitle =>
      'Cansado del Reclutamiento Constante';

  @override
  String get sharePartnerRecruitmentFatigueDescription =>
      'Para socios agotados del ciclo interminable de reclutamiento';

  @override
  String get sharePartnerRecruitmentFatigueSubject =>
      'Automatice el Trabajo. Haga Crecer Su Equipo.';

  @override
  String sharePartnerRecruitmentFatigueMessage(Object business, Object link) {
    return '¿Su equipo de $business agotado del reclutamiento constante? ¿Los seguimientos interminables? ¿El rastreo manual?\n\nLa IA de Team Build Pro maneja el trabajo para toda su organización de $business.\n\nPara cada persona en su equipo, la IA:\n- Proporciona 16 mensajes de reclutamiento pre-escritos\n- Rastrea cada prospecto y su estado\n- Responde preguntas de reclutamiento 24/7\n- Mantiene a todos enfocados en lo que funciona\n\nUsted se mantiene enfocado en el liderazgo. Su equipo de $business se mantiene productivo sin agotarse.\n\nLa IA nunca se cansa. El impulso de su equipo nunca se detiene.\n\nEmpodere el crecimiento sostenible: $link\n\nCrecimiento sin el agotamiento. Finalmente.';
  }

  @override
  String get sharePartnerAvailabilityGapTitle => 'No Puede Estar Allí 24/7';

  @override
  String get sharePartnerAvailabilityGapDescription =>
      'Ideal para líderes que no pueden estar constantemente disponibles para su equipo';

  @override
  String get sharePartnerAvailabilityGapSubject =>
      'Su Equipo Crece Incluso Cuando Usted No Está Allí';

  @override
  String sharePartnerAvailabilityGapMessage(Object business, Object link) {
    return 'Su equipo de $business le necesita. Pero usted no puede estar disponible 24/7.\n\nTeam Build Pro da a toda su organización de $business un Coach de IA que siempre está activo.\n\nMientras duerme, trabaja en su trabajo diurno o pasa tiempo con la familia, la IA:\n- Responde sus preguntas de reclutamiento en cualquier momento\n- Proporciona 16 mensajes pre-escritos listos para usar\n- Rastrea su progreso y los mantiene motivados\n- Asegura que nada se pierda\n\nSu equipo de $business obtiene apoyo exactamente cuando lo necesita - no solo cuando usted está disponible.\n\nUsted se mantiene enfocado en el liderazgo. La IA maneja la asesoría diaria.\n\nEmpodere a su equipo: $link\n\nFinalmente, su equipo crece sin necesitarle cada minuto.';
  }

  @override
  String get homepageDemoCredentialsNotAvailable =>
      'Credenciales de demostración no disponibles';

  @override
  String homepageDemoLoginFailed(Object error) {
    return 'Inicio de sesión de demostración falló: $error';
  }

  @override
  String get homepageDemoLoginFailedGeneric =>
      'Inicio de sesión de demostración falló. Por favor, inténtelo de nuevo.';

  @override
  String get homepageHeroJumpstart => 'IMPULSE SU ÉXITO';

  @override
  String get homepageHeroGrow => 'CREZCA Y GESTIONE SU EQUIPO';

  @override
  String get homepageHeroProven => 'SISTEMA PROBADO DE CONSTRUCCIÓN DE EQUIPO';

  @override
  String get homepageHeroBuildFoundation => 'Construya Su Fundamento';

  @override
  String get homepageHeroBeforeDayOne => 'Antes del Día Uno';

  @override
  String get homepageHeroEmpowerTeam => 'Empodere a Su Equipo';

  @override
  String get homepageHeroAccelerate => 'Acelere el ';

  @override
  String get homepageHeroGrowth => 'Crecimiento';

  @override
  String get homepageLoading => 'Cargando...';

  @override
  String homepageMessageTitlePersonal(Object sponsorName) {
    return 'Un Mensaje Personal\nDe $sponsorName';
  }

  @override
  String get homepageMessageTitleGeneric => 'Un Mensaje De\nTeam Build Pro';

  @override
  String get homepageMessageBodyNewProspect1 =>
      'Estoy muy contento de que esté aquí para obtener una ventaja inicial en la construcción de su equipo de ';

  @override
  String get homepageMessageBodyNewProspect2 =>
      '. El siguiente paso es fácil: solo cree su cuenta a continuación y comience a disfrutar de su prueba gratuita de 30 días. Una vez que esté registrado, me comunicaré personalmente dentro de la aplicación para saludarlo y ayudarle a comenzar.\n\n¡Espero conectarme!';

  @override
  String get homepageMessageBodyRefPartner1 =>
      'Estoy usando la aplicación Team Build Pro para acelerar el crecimiento de mi equipo de ';

  @override
  String get homepageMessageBodyRefPartner2 =>
      ' e ingresos. ¡Se lo recomiendo mucho también!\n\nEl siguiente paso es fácil: solo cree su cuenta a continuación y comience a disfrutar de su prueba gratuita de 30 días. Una vez que esté registrado, me comunicaré personalmente dentro de la aplicación para saludarlo y ayudarle a comenzar.\n\n¡Espero conectarme!';

  @override
  String get homepageMessageBodyGeneric =>
      'Team Build Pro es la aplicación definitiva para profesionales de ventas directas para gestionar y escalar sus equipos existentes con impulso imparable y crecimiento exponencial.\n\n¡El siguiente paso es fácil: solo cree su cuenta a continuación y comience a disfrutar de su prueba gratuita de 30 días!';

  @override
  String get homepageButtonCreateAccount => 'Crear Cuenta';

  @override
  String get homepageButtonAlreadyHaveAccount => 'Ya Tengo una Cuenta';

  @override
  String get homepageDemoModeActive => 'Modo Demo Activo';

  @override
  String get homepageDemoPreLoaded => 'Cuenta de Demo Precargada';

  @override
  String get homepageDemoWelcome => 'Bienvenido a la Demo de Team Build Pro';

  @override
  String get homepageDemoDescription =>
      'Esta es una cuenta de demostración completamente funcional precargada con datos de equipo realistas. ¡Explore todas las funciones y vea cómo Team Build Pro puede transformar su negocio de ventas directas!';

  @override
  String get homepageDemoCredentialsLabel => 'Credenciales de Acceso:';

  @override
  String homepageDemoEmail(Object email) {
    return 'Correo electrónico: $email';
  }

  @override
  String homepageDemoPassword(Object password) {
    return 'Contraseña: $password';
  }

  @override
  String get homepageDemoLoggingIn => 'Iniciando sesión...';

  @override
  String get homepageDemoStartDemo => '¡Iniciar Demo!';

  @override
  String get homepageTrust100Secure => '100% Seguro';

  @override
  String get homepageTrust30DayFree => '30 Días Gratis';

  @override
  String get homepageTrust24Support => 'Soporte 24/7';

  @override
  String get homepageFooterTerms => 'Términos de Servicio';

  @override
  String get homepageFooterPrivacy => 'Política de Privacidad';

  @override
  String get authLoginAccountRequiredTitle => 'Cuenta Requerida';

  @override
  String get authLoginAccountRequiredMessage =>
      'Parece que necesita crear una cuenta primero. ¿Le gustaría registrarse ahora?';

  @override
  String get authLoginCancelButton => 'Cancelar';

  @override
  String get authLoginRegisterButton => 'Registrarse';

  @override
  String get authLoginAppBarTitle => 'Iniciar Sesión';

  @override
  String get authLoginSubtitle =>
      'Inicie sesión para continuar construyendo su equipo';

  @override
  String get authLoginOrContinueWith => 'o continuar con';

  @override
  String get authLoginForgotPassword => '¿Olvidó su Contraseña?';

  @override
  String get authLoginContinueWithGoogle => 'Continuar con Google';

  @override
  String get authLoginContinueWithApple => 'Continuar con Apple';

  @override
  String get authLoginBiometricButton => 'Iniciar sesión con biométrico';

  @override
  String get authLoginResetPasswordTitle => 'Restablecer Contraseña';

  @override
  String get authLoginCheckEmailTitle => 'Revise Su Correo Electrónico';

  @override
  String get authLoginResetEmailSent =>
      'Hemos enviado un enlace para restablecer su contraseña a:';

  @override
  String get authLoginResetInstructions =>
      'Por favor, revise su bandeja de entrada y siga las instrucciones para restablecer su contraseña.';

  @override
  String get authLoginResetPrompt =>
      'Ingrese su dirección de correo electrónico y le enviaremos un enlace para restablecer su contraseña.';

  @override
  String get authLoginResetEmailLabel => 'Correo Electrónico';

  @override
  String get authLoginResetEmailHint =>
      'Ingrese su dirección de correo electrónico';

  @override
  String get authLoginResetEmailRequired =>
      'Por favor, ingrese su correo electrónico';

  @override
  String get authLoginResetEmailInvalid =>
      'Por favor, ingrese un correo electrónico válido';

  @override
  String get authLoginDoneButton => 'Listo';

  @override
  String get authLoginSendResetLink => 'Enviar Enlace de Restablecimiento';

  @override
  String get authSignupInvalidInviteLinkMessage =>
      'Eso no parece un enlace de invitación. Por favor, pegue el enlace completo que recibió.';

  @override
  String get authSignupNewReferralDialogTitle =>
      'Nuevo Código de Referencia Detectado';

  @override
  String get authSignupNewReferralDialogMessage =>
      'Se ha detectado un nuevo código de referencia:';

  @override
  String authSignupNewReferralNewCode(Object code) {
    return 'Nuevo código: $code';
  }

  @override
  String authSignupNewReferralNewSource(Object source) {
    return 'Fuente: $source';
  }

  @override
  String authSignupNewReferralCurrentCode(Object code) {
    return 'Código actual: $code';
  }

  @override
  String authSignupNewReferralCurrentSource(Object source) {
    return 'Fuente actual: $source';
  }

  @override
  String get authSignupNewReferralPrompt =>
      '¿Le gustaría actualizar su código de referencia?';

  @override
  String get authSignupKeepCurrentButton => 'Mantener Actual';

  @override
  String get authSignupUseNewCodeButton => 'Usar Nuevo Código';

  @override
  String get authSignupAppBarTitle => 'TEAM BUILD PRO';

  @override
  String get authSignupLoginButton => 'Iniciar Sesión';

  @override
  String get authSignupConfirmSponsorButton => 'Confirmar su Patrocinador';

  @override
  String get authSignupNoSponsorFound =>
      'Lo siento, no se encontró patrocinador';

  @override
  String get authSignupPageTitle => 'Registro de Cuenta';

  @override
  String get authSignupInviteLinkButton => 'Tengo un enlace de invitación';

  @override
  String get authSignupInviteLinkInstructions =>
      'Si alguien le envió un enlace de invitación, puede pegarlo aquí.';

  @override
  String get authSignupPasteInviteLinkButton => 'Pegar enlace de invitación';

  @override
  String authSignupInvitedBy(Object sponsorName) {
    return 'Invitado por: $sponsorName';
  }

  @override
  String authSignupReferralCodeDebug(Object code, Object source) {
    return 'Código: $code (fuente: $source)';
  }

  @override
  String get authSignupAppleButton => 'Registrarse con Apple';

  @override
  String get authSignupGoogleButton => 'Registrarse con Google';

  @override
  String get authSignupOrEmailDivider => 'o registrarse con correo electrónico';

  @override
  String get authSignupLoginSectionTitle => 'Cree Su Inicio de Sesión';

  @override
  String get authSignupPrivacyAssurance =>
      '🔒 Su correo electrónico nunca será compartido con nadie';

  @override
  String get authSignupRequiredForAccount =>
      '🔒 Requerido para la creación de cuenta';

  @override
  String get settingsAuthRequired => 'Autenticación requerida.';

  @override
  String get settingsUserNotFound => 'Perfil de usuario no encontrado.';

  @override
  String get settingsAccessDenied =>
      'Acceso Denegado: Se requiere rol de administrador.';

  @override
  String settingsLoadFailed(Object error) {
    return 'Error al cargar configuración: $error';
  }

  @override
  String get settingsBusinessNameInvalid =>
      'El nombre del negocio solo puede contener letras, números y puntuación común.';

  @override
  String get settingsReferralLinkInvalid =>
      'Por favor, ingrese un enlace de referencia válido (ej., https://example.com).';

  @override
  String get settingsOrgNameMismatch =>
      'Los campos de Nombre de Organización deben coincidir para confirmar.';

  @override
  String get settingsReferralLinkMismatch =>
      'Los campos de Enlace de Referencia deben coincidir para confirmar.';

  @override
  String get settingsUserNotAuthenticated => 'Usuario no autenticado.';

  @override
  String get settingsUpgradeRequiredTitle => 'Actualización Requerida';

  @override
  String get settingsUpgradeRequiredMessage =>
      'Actualice su suscripción de Administrador para guardar estos cambios.';

  @override
  String get settingsCancelButton => 'Cancelar';

  @override
  String get settingsUpgradeButton => 'Actualizar Ahora';

  @override
  String get settingsSavedSuccess => 'Configuración guardada exitosamente.';

  @override
  String settingsSaveFailed(Object error) {
    return 'Error al guardar configuración: $error';
  }

  @override
  String get settingsRequired => 'Requerido';

  @override
  String get settingsNotSet => 'No Establecido';

  @override
  String get settingsSuperAdminOnly =>
      '🚫 Solo el Super Administrador puede realizar la limpieza de la base de datos';

  @override
  String settingsCleanupError(Object error) {
    return 'Error: $error';
  }

  @override
  String get settingsCleanupDryRunTitle => '🔍 Resultados de Prueba';

  @override
  String get settingsCleanupCompleteTitle => '✅ Limpieza Completada';

  @override
  String get settingsCleanupTotalUsers => 'Total de Usuarios:';

  @override
  String get settingsCleanupNonAdminUsers => 'Usuarios No Administradores:';

  @override
  String get settingsCleanupProtectedAdmins => 'Administradores Protegidos:';

  @override
  String get settingsCleanupDeleted => 'Eliminados:';

  @override
  String get settingsCleanupDeletedUsers => 'Usuarios:';

  @override
  String get settingsCleanupDeletedChats => 'Chats:';

  @override
  String get settingsCleanupDeletedChatLogs => 'Registros de Chat:';

  @override
  String get settingsCleanupDeletedChatUsage => 'Uso de Chat:';

  @override
  String get settingsCleanupDeletedReferralCodes => 'Códigos de Referencia:';

  @override
  String get settingsOkButton => 'Aceptar';

  @override
  String get profileUpdateBiometricFailed =>
      'La autenticación biométrica falló. Por favor, inténtelo de nuevo.';

  @override
  String get profileUpdatePasswordRequired =>
      'Se requiere contraseña para habilitar inicio de sesión biométrico';

  @override
  String get profileUpdateEmailNotFound =>
      'Correo electrónico del usuario no encontrado';

  @override
  String get profileUpdateBiometricEnabled =>
      '✅ Inicio de sesión biométrico habilitado exitosamente';

  @override
  String get profileUpdatePasswordIncorrect =>
      'Contraseña incorrecta. Por favor, inténtelo de nuevo.';

  @override
  String profileUpdateBiometricError(Object error) {
    return 'Error al habilitar biométrico: $error';
  }

  @override
  String get profileUpdateBiometricDisabled =>
      'Inicio de sesión biométrico deshabilitado';

  @override
  String get profileUpdateConfirmPasswordTitle => 'Confirmar Contraseña';

  @override
  String get profileUpdateConfirmPasswordMessage =>
      'Para almacenar de forma segura sus credenciales para el inicio de sesión biométrico, por favor ingrese su contraseña.';

  @override
  String get profileUpdatePasswordLabel => 'Contraseña';

  @override
  String get profileUpdateCancelButton => 'Cancelar';

  @override
  String get profileUpdateConfirmButton => 'Confirmar';

  @override
  String get profileUpdateDisableBiometricTitle =>
      'Deshabilitar Inicio de Sesión Biométrico';

  @override
  String get profileUpdateDisableBiometricMessage =>
      '¿Está seguro de que desea deshabilitar el inicio de sesión biométrico? Deberá usar su correo electrónico y contraseña para iniciar sesión.';

  @override
  String get profileUpdateDisableButton => 'Deshabilitar';

  @override
  String get profileUpdatePictureRequired =>
      'Por favor, suba su foto de perfil.';

  @override
  String get profileUpdateImageNotProvided => 'No se proporcionó la imagen.';

  @override
  String get profileUpdateSuccess => '¡Perfil actualizado exitosamente!';

  @override
  String profileUpdateError(Object error) {
    return 'Error al actualizar perfil: $error';
  }

  @override
  String get profileUpdateDemoModeTitle => 'Modo Demo';

  @override
  String get profileUpdateDemoModeMessage =>
      'Edición de perfil deshabilitada en modo demo.';

  @override
  String get profileUpdateDemoUnderstandButton => 'Entiendo';

  @override
  String get profileUpdateScreenTitle => 'Actualizar Perfil';

  @override
  String get profileUpdateNoEmail => 'Sin correo electrónico';

  @override
  String get profileUpdateSelectCountry => 'Seleccionar País';

  @override
  String get profileUpdateCountryLabel => 'País';

  @override
  String get profileUpdateCountryRequired => 'Por favor, seleccione un país';

  @override
  String get profileUpdateSelectState => 'Seleccionar Estado/Provincia';

  @override
  String get profileUpdateSelectCountryFirst => 'Seleccione un país primero';

  @override
  String get profileUpdateStateLabel => 'Estado/Provincia';

  @override
  String get profileUpdateStateRequired =>
      'Por favor, seleccione un estado/provincia';

  @override
  String get profileUpdateCityLabel => 'Ciudad';

  @override
  String get profileUpdateCityRequired => 'Por favor, ingrese una ciudad';

  @override
  String get profileUpdateSecurityHeader => 'Configuración de Seguridad';

  @override
  String get profileUpdateBiometricToggle =>
      'Habilitar Inicio de Sesión Biométrico';

  @override
  String get profileUpdateBiometricChecking =>
      'Verificando compatibilidad del dispositivo...';

  @override
  String get profileUpdateBiometricDescription =>
      'Use huella digital o reconocimiento facial para iniciar sesión';

  @override
  String get profileUpdateBiometricNotAvailable =>
      'No disponible en este dispositivo';

  @override
  String get profileUpdateSaveButton => 'Guardar Cambios';

  @override
  String get profileEditDeletionSuccess =>
      'Eliminación de cuenta completada. Gracias por usar Team Build Pro.';

  @override
  String profileEditDeletionError(Object error) {
    return 'Error al completar eliminación de cuenta: $error';
  }

  @override
  String get profileEditUrlInvalid =>
      'Por favor, ingrese una URL válida (ej., https://example.com)';

  @override
  String get profileEditHttpsRequired =>
      'El enlace de referencia debe usar HTTPS (no HTTP) por seguridad';

  @override
  String get profileEditUrlFormatInvalid =>
      'Formato de URL inválido. Por favor, verifique su enlace de referencia.';

  @override
  String get profileEditUnableToVerify =>
      'No se puede verificar el enlace de referencia';

  @override
  String get profileEditDomainRequired =>
      'Por favor, ingrese un enlace válido con un dominio apropiado';

  @override
  String get profileEditNoLocalhost =>
      'Por favor, ingrese un enlace de referencia de negocio válido\n(no localhost o dirección IP)';

  @override
  String get profileEditDomainWithTld =>
      'Por favor, ingrese un enlace válido con un dominio apropiado\n(ej., company.com)';

  @override
  String profileEditBaseUrlRequired(Object baseUrl) {
    return 'El enlace de referencia debe comenzar con:\n$baseUrl';
  }

  @override
  String get profileEditNotHomepage =>
      'Por favor, ingrese su enlace de referencia único,\nno solo la página principal';

  @override
  String get profileEditInvalidFormat => 'Formato de enlace inválido';

  @override
  String get profileEditReferralRequired =>
      'Por favor, ingrese su enlace de referencia';

  @override
  String get profileEditConfirmReferral =>
      'Por favor, confirme su enlace de referencia';

  @override
  String get profileEditCompleteLink =>
      'Por favor, ingrese un enlace completo que comience con\nhttp:// o https://';

  @override
  String get profileEditValidReferralRequired =>
      'Por favor, ingrese un enlace de referencia válido (ej., https://example.com).';

  @override
  String get profileEditReferralMismatch =>
      'Los campos de Enlace de Referencia deben coincidir para confirmar.';

  @override
  String get profileEditInvalidLinkTitle => 'Enlace de Referencia Inválido';

  @override
  String profileEditInvalidLinkMessage(Object businessName) {
    return 'El enlace de referencia de $businessName no pudo ser verificado. El enlace puede ser incorrecto, inactivo o temporalmente no disponible.';
  }

  @override
  String get profileEditContactSponsor =>
      'Por favor, verifique el enlace e intente de nuevo, o contacte a su patrocinador para obtener el enlace de referencia correcto.';

  @override
  String get profileEditTryAgainButton => 'Intentar de Nuevo';

  @override
  String profileEditReferralHint(Object baseUrl) {
    return 'ej., ${baseUrl}su_nombre_de_usuario_aqui';
  }

  @override
  String get profileEditRequiredForRep => 'Requerido cuando es representante';

  @override
  String get adminProfilePictureRequired =>
      'Por favor, seleccione una foto de perfil';

  @override
  String get adminProfileCountryRequired => 'Por favor, seleccione un país';

  @override
  String get adminProfileStateRequired =>
      'Por favor, seleccione un estado/provincia';

  @override
  String get adminProfileCityRequired => 'Por favor, ingrese su ciudad';

  @override
  String get adminProfileSetupTitle =>
      '🛠️ Configurando su perfil de negocio...';

  @override
  String get adminProfileSetupDescription =>
      'Preparando la información de su negocio';

  @override
  String get adminProfileUserNotAuthenticated => 'Usuario no autenticado';

  @override
  String get adminProfileUploadFailed => 'Error al subir imagen';

  @override
  String get adminProfileSaveSuccess =>
      '¡Información de perfil guardada exitosamente!';

  @override
  String adminProfileSaveError(Object error) {
    return 'Error: $error';
  }

  @override
  String get adminProfileScreenTitle => 'Perfil de Administrador';

  @override
  String get adminProfileSetupHeader => 'Configuración de Perfil';

  @override
  String get adminProfileNoEmail => 'Sin correo electrónico';

  @override
  String get adminProfileCountryLabel => 'País';

  @override
  String get adminProfileStateLabel => 'Estado/Provincia';

  @override
  String get adminProfileCityLabel => 'Ciudad';

  @override
  String get adminProfileNextButton => 'Siguiente - Información del Negocio';

  @override
  String get subscriptionAppBarTitle => 'Team Build Pro';

  @override
  String get subscriptionPremiumHeader => 'Funciones Premium:';

  @override
  String get subscriptionStatusActive => 'Suscripción Activa';

  @override
  String get subscriptionStatusActiveSubtitle =>
      'Tiene acceso completo a todas las funciones premium';

  @override
  String get subscriptionStatusPaused => 'Suscripción Pausada';

  @override
  String get subscriptionStatusPausedSubtitle =>
      'Su suscripción está pausada. Reanude para restaurar el acceso.';

  @override
  String get subscriptionStatusPaymentIssue => 'Problema de Pago';

  @override
  String get subscriptionStatusPaymentIssueSubtitle =>
      'Actualice el método de pago para restaurar el acceso';

  @override
  String get subscriptionStatusTrialActive => 'Prueba Gratuita Activa';

  @override
  String subscriptionStatusTrialDaysRemaining(Object days) {
    return '$days días restantes en su prueba';
  }

  @override
  String get subscriptionStatusCancelled => 'Suscripción Cancelada';

  @override
  String get subscriptionStatusCancelledSubtitle =>
      'El acceso continúa hasta la fecha de vencimiento';

  @override
  String get subscriptionStatusExpired => 'Suscripción Expirada';

  @override
  String get subscriptionStatusExpiredSubtitle =>
      'Actualice para restaurar las funciones premium';

  @override
  String subscriptionFeature1(Object businessName) {
    return 'Envíe su enlace de referencia único de $businessName';
  }

  @override
  String get subscriptionFeature2 =>
      'Coaching de IA personalizado para reclutamiento y construcción de equipos';

  @override
  String get subscriptionFeature3 =>
      'Desbloquee mensajería para usuarios en su equipo';

  @override
  String subscriptionFeature4(Object businessName) {
    return 'Asegure que los miembros del equipo se unan bajo USTED en $businessName';
  }

  @override
  String get subscriptionFeature5 => 'Análisis e información avanzados';

  @override
  String get subscriptionActivatedSuccess =>
      '✅ ¡Suscripción activada exitosamente!';

  @override
  String get subscriptionNotActiveTitle => 'Suscripción No Activa';

  @override
  String get subscriptionNotActiveMessage =>
      'Compra iniciada pero aún no activa. Inténtelo de nuevo.';

  @override
  String get subscriptionNotAvailableTitle => 'Suscripción No Disponible';

  @override
  String get subscriptionNotAvailableMessageIOS =>
      'Las compras dentro de la aplicación no están disponibles actualmente en su dispositivo. Esto puede deberse a restricciones establecidas por su organización o administrador del dispositivo.\n\nPor favor, verifique la configuración de Tiempo en Pantalla o contacte a su departamento de TI si está usando un dispositivo administrado.\n\nAlternativamente, puede suscribirse a través de nuestro sitio web.';

  @override
  String get subscriptionNotAvailableMessageAndroid =>
      'Las compras dentro de la aplicación no están disponibles actualmente en su dispositivo. Esto puede deberse a restricciones o problemas de red.\n\nPor favor, intente de nuevo más tarde o contacte a soporte si el problema persiste.';

  @override
  String get subscriptionNotAvailableMessageDefault =>
      'Las compras dentro de la aplicación no están disponibles actualmente. Por favor, intente de nuevo más tarde.';

  @override
  String get subscriptionOkButton => 'OK';

  @override
  String get subscriptionRestoredSuccess =>
      '✅ ¡Suscripción restaurada exitosamente!';

  @override
  String get subscriptionNoPreviousFound =>
      'No se encontró ninguna suscripción anterior para restaurar.';

  @override
  String get subscriptionSubscribeButton => 'Suscribirse Ahora - \$6.99/mes';

  @override
  String get subscriptionRestoreButton => 'Restaurar Suscripción Anterior';

  @override
  String get subscriptionLegalNotice =>
      'Al suscribirse, acepta nuestros Términos de Servicio y Política de Privacidad.';

  @override
  String get subscriptionTermsLink => 'Términos de Servicio';

  @override
  String get subscriptionSeparator => ' | ';

  @override
  String get subscriptionPrivacyLink => 'Política de Privacidad';

  @override
  String subscriptionAutoRenewNotice(String managementText) {
    return 'La suscripción se renueva automáticamente a menos que se cancele al menos 24 horas antes del final del período actual. $managementText';
  }

  @override
  String get subscriptionManageIOS =>
      'Puede administrar su suscripción en la configuración de su cuenta de Apple ID.';

  @override
  String get subscriptionManageAndroid =>
      'Puede administrar su suscripción en Google Play Store.';

  @override
  String get subscriptionManageDefault =>
      'Puede administrar su suscripción en la tienda de aplicaciones de su dispositivo.';

  @override
  String get subscriptionPlatformAppStore => 'App Store';

  @override
  String get subscriptionPlatformPlayStore => 'Google Play Store';

  @override
  String get subscriptionPlatformGeneric => 'tienda de aplicaciones';

  @override
  String get subscriptionDefaultBizOpp => 'su oportunidad';

  @override
  String get termsScreenTitle => 'Términos de Servicio';

  @override
  String get termsHeaderTitle => 'Términos de Servicio';

  @override
  String get termsSubtitle => 'Acuerdo de Plataforma de Redes Profesionales';

  @override
  String termsLastUpdated(Object date) {
    return 'Última Actualización: $date';
  }

  @override
  String get termsFooterBadgeTitle => 'Cumple con App Store de Apple';

  @override
  String get termsFooterBadgeDescription =>
      'Estos Términos de Servicio cumplen con todas las pautas y requisitos del App Store de Apple para aplicaciones de plataforma.';

  @override
  String get termsDisclaimerTitle => 'PLATAFORMA DE NETWORKING PROFESIONAL';

  @override
  String get termsDisclaimerSubtitle => 'Resumen del Servicio';

  @override
  String get privacyScreenTitle => 'Política de Privacidad';

  @override
  String get privacyHeaderTitle => 'Política de Privacidad';

  @override
  String privacyLastUpdated(Object date) {
    return 'Última Actualización: $date';
  }

  @override
  String get privacyEmailSubject =>
      'subject=Consulta sobre Política de Privacidad';

  @override
  String privacyEmailError(Object email) {
    return 'No se pudo abrir el cliente de correo electrónico. Por favor, contacte a $email';
  }

  @override
  String get privacyMattersTitle => 'Su Privacidad Importa';

  @override
  String get privacyMattersDescription =>
      'Estamos comprometidos a proteger su información personal y su derecho a la privacidad. Esta política explica cómo recopilamos, usamos y protegemos sus datos.';

  @override
  String get privacyAppleComplianceTitle =>
      'Cumplimiento de Privacidad de Apple';

  @override
  String get privacyAppleComplianceDescription =>
      'Esta aplicación sigue las pautas de privacidad de Apple y los requisitos de App Store. Somos transparentes sobre la recopilación de datos y le damos control sobre su información.';

  @override
  String get privacyContactHeading => 'Contáctenos';

  @override
  String get privacyContactSubheading =>
      '¿Preguntas sobre esta Política de Privacidad?';

  @override
  String get privacyContactDetails =>
      'Team Build Pro\nOficial de Privacidad\nRespuesta en 48 horas';

  @override
  String privacyCopyright(Object year) {
    return '© $year Team Build Pro. Todos los derechos reservados.';
  }

  @override
  String get privacyFooterDisclaimer =>
      'Esta Política de Privacidad es efectiva a partir de la fecha indicada arriba y se aplica a todos los usuarios de la aplicación móvil Team Build Pro.';

  @override
  String get howItWorksScreenTitle => 'Cómo Funciona';

  @override
  String get howItWorksHeaderTitle => 'Cómo Funciona';

  @override
  String get howItWorksHeroSubtitle =>
      'Transforme su reclutamiento con un flujo de equipo precalificado.';

  @override
  String get howItWorksFeaturedOpportunity => 'Oportunidad Destacada';

  @override
  String get howItWorksPipelineSystem => 'SISTEMA DE FLUJO';

  @override
  String get howItWorksStep1Title => 'Establezca Su Fundamento';

  @override
  String howItWorksStep1Description(Object business) {
    return 'Personalice su cuenta de Team Build Pro con los detalles de su oportunidad y conecte su enlace de referencia, convirtiendo la aplicación en su flujo de reclutamiento personal.';
  }

  @override
  String get howItWorksStep2Title =>
      'Construya de Manera Inteligente, No Difícil';

  @override
  String get howItWorksStep2Description =>
      'Use coaching impulsado por IA para redactar mensajes, programar seguimientos y rastrear interés. Construya relaciones con prospectos antes de que se unan a su oportunidad de negocio.';

  @override
  String get howItWorksStep3Title => 'Calificación Automática';

  @override
  String howItWorksStep3Description(Object business) {
    return 'A medida que los prospectos construyen sus propios equipos dentro de la aplicación, automáticamente alcanzan hitos de calificación (4 patrocinadores directos + 20 equipo total), demostrando su compromiso antes de unirse.';
  }

  @override
  String get howItWorksStep4Title => 'Crecimiento Rápido';

  @override
  String get howItWorksStep4Description =>
      'Sus prospectos precalificados se lanzan con impulso, equipos ya establecidos y capacidad comprobada para reclutar. Esto crea un motor de crecimiento autosostenible.';

  @override
  String get howItWorksKeyTargetsTitle => ' OBJETIVOS CLAVE DE CRECIMIENTO';

  @override
  String get howItWorksDirectSponsors => 'Patrocinadores Directos';

  @override
  String get howItWorksTotalTeam => 'Miembros Totales del Equipo';

  @override
  String get howItWorksCtaHeading => 'Crezca Su Red';

  @override
  String get howItWorksCtaDescription =>
      '¡Expanda su Red para impulsar el crecimiento de la organización!';

  @override
  String get howItWorksCtaButton => 'Estrategias de Crecimiento Probadas';

  @override
  String get howItWorksDefaultBizOpp => 'su oportunidad';

  @override
  String get termsDisclaimerContent =>
      '• Team Build Pro es una plataforma de networking basada en suscripción\n• Los usuarios pagan una tarifa de suscripción mensual para acceder a herramientas de networking\n• La plataforma proporciona gestión de relaciones y características de conexión empresarial\n• Todas las oportunidades de negocio son proporcionadas por terceros independientes\n\nTeam Build Pro opera como una plataforma de networking y no garantiza resultados comerciales.';

  @override
  String get termsSection1Title => '1. ACEPTACIÓN DE TÉRMINOS';

  @override
  String get termsSection1Content =>
      'Al descargar, instalar, acceder o usar la aplicación móvil Team Build Pro (\"Aplicación\"), acepta estar sujeto a estos Términos de Servicio (\"Términos\"). Si no está de acuerdo con estos Términos, no use la Aplicación.\n\nEstos Términos constituyen un acuerdo legalmente vinculante entre usted y Team Build Pro con respecto a su uso de nuestro servicio de plataforma de networking profesional.';

  @override
  String get termsSection2Title => '2. DESCRIPCIÓN DEL SERVICIO';

  @override
  String get termsSection2Content =>
      'Team Build Pro es una plataforma de networking profesional basada en suscripción que proporciona:\n\n• Herramientas de gestión de relaciones de contactos\n• Características de construcción de equipos y networking\n• Herramientas de comunicación y colaboración\n• Información de oportunidades de negocio de proveedores terceros\n• Coaching y orientación impulsada por IA\n\nDESCARGOS DE RESPONSABILIDAD IMPORTANTES:\n• Team Build Pro es un servicio de plataforma de networking, no una oportunidad de negocio\n• Los usuarios pagan una tarifa de suscripción mensual por el acceso a la plataforma\n• No garantizamos ningún resultado comercial o ingreso\n• Todas las oportunidades de negocio son proporcionadas por terceros independientes\n• El éxito depende enteramente del esfuerzo individual y las condiciones del mercado';

  @override
  String get termsSection3Title => '3. SUSCRIPCIÓN Y PAGO';

  @override
  String get termsSection3Content =>
      'ACCESO Y TARIFAS:\n• La Aplicación opera bajo un modelo de suscripción\n• Las tarifas de suscripción mensual se cobran a través de su cuenta de Apple ID\n• La suscripción se renueva automáticamente a menos que se cancele\n• Los precios se muestran en la Aplicación y pueden variar según la región\n\nCICLO DE FACTURACIÓN:\n• Se le cobrará al confirmar la compra\n• Su suscripción se renueva automáticamente cada mes\n• Los cargos ocurren 24 horas antes del final del período actual\n• Puede administrar las suscripciones en la Configuración de su Cuenta de Apple ID\n\nCANCELACIÓN:\n• Cancele en cualquier momento a través de la Configuración de Cuenta de Apple ID\n• La cancelación entra en vigencia al final del período de facturación actual\n• Sin reembolsos por meses parciales\n• El acceso continúa hasta el final del período pagado';

  @override
  String get termsSection4Title => '4. PRUEBA GRATUITA (SI APLICA)';

  @override
  String get termsSection4Content =>
      'TÉRMINOS DE PRUEBA:\n• Algunos planes de suscripción pueden incluir un período de prueba gratuito\n• La duración de la prueba se mostrará claramente antes de registrarse\n• Puede cancelar durante la prueba para evitar cargos\n• Si no cancela, se le cobrará la tarifa de suscripción\n\nCONVERSIÓN A PAGO:\n• Las pruebas se convierten en suscripciones pagas automáticamente\n• Los cargos comienzan inmediatamente después de que finaliza la prueba\n• Se aplica el precio de suscripción mostrado al registrarse\n• Cancele antes de que finalice la prueba para evitar cargos';

  @override
  String get termsSection5Title =>
      '5. TÉRMINOS DE COMPRA DENTRO DE LA APLICACIÓN DE APPLE';

  @override
  String get termsSection5Content =>
      'Todas las suscripciones se procesan a través del sistema de Compra Dentro de la Aplicación de Apple y están sujetas a los Términos de Servicio y políticas de Apple.\n\nROL DE APPLE:\n• El pago se cobra a su cuenta de Apple ID\n• Suscripciones administradas a través de la Configuración de Cuenta de Apple ID\n• Solicitudes de reembolso manejadas por Apple según sus políticas\n• Se aplican los términos del EULA estándar de Apple a menos que se especifique lo contrario\n\nSUS RESPONSABILIDADES:\n• Mantener información de pago precisa en Apple ID\n• Monitorear el estado de la suscripción en su cuenta de Apple\n• Contactar al Soporte de Apple para problemas de facturación\n• Revisar los términos de Apple en: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

  @override
  String get termsSection6Title => '6. CUENTAS DE USUARIO Y REGISTRO';

  @override
  String get termsSection6Content =>
      'CREACIÓN DE CUENTA:\n• Debe crear una cuenta para usar la Aplicación\n• Proporcione información precisa, actual y completa\n• Usted es responsable de mantener la confidencialidad de la cuenta\n• Debe tener al menos 18 años para crear una cuenta\n\nSEGURIDAD DE LA CUENTA:\n• Mantenga su contraseña segura y confidencial\n• Notifíquenos inmediatamente de acceso no autorizado\n• Usted es responsable de toda la actividad bajo su cuenta\n• No comparta su cuenta con otros\n\nTERMINACIÓN DE CUENTA:\n• Podemos suspender o terminar cuentas que violen estos Términos\n• Puede eliminar su cuenta en cualquier momento a través de la Aplicación\n• La terminación no afecta la facturación de la suscripción a menos que se cancele\n• Nos reservamos el derecho de rechazar el servicio a cualquier persona';

  @override
  String get termsSection7Title => '7. CONDUCTA PROHIBIDA';

  @override
  String get termsSection7Content =>
      'Acepta NO:\n\n• Usar la Aplicación para ningún propósito ilegal\n• Violar ninguna ley o regulación aplicable\n• Infringir derechos de propiedad intelectual\n• Transmitir código dañino, virus o malware\n• Acosar, abusar o dañar a otros usuarios\n• Hacerse pasar por otros o proporcionar información falsa\n• Intentar obtener acceso no autorizado a la Aplicación\n• Interferir con la funcionalidad o seguridad de la Aplicación\n• Usar sistemas automatizados para acceder a la Aplicación sin permiso\n• Recopilar información de usuarios sin consentimiento\n• Participar en cualquier actividad que interrumpa la Aplicación\n• Usar la Aplicación para promover esquemas ilegales o estafas';

  @override
  String get termsSection8Title => '8. PROPIEDAD INTELECTUAL';

  @override
  String get termsSection8Content =>
      'PROPIEDAD:\n• Team Build Pro posee todos los derechos de la Aplicación y su contenido\n• Esto incluye software, diseño, texto, gráficos y logotipos\n• Nuestras marcas comerciales y branding están protegidos\n• Usted recibe solo una licencia limitada para usar la Aplicación\n\nSU LICENCIA:\n• Le otorgamos una licencia limitada, no exclusiva e intransferible\n• Puede usar la Aplicación para fines personales y no comerciales\n• Esta licencia no incluye reventa o uso comercial\n• La licencia termina cuando finaliza su suscripción\n\nCONTENIDO DEL USUARIO:\n• Usted conserva la propiedad del contenido que crea en la Aplicación\n• Nos otorga una licencia para usar su contenido para proporcionar servicios\n• Usted declara que tiene derechos sobre cualquier contenido que cargue\n• Podemos eliminar contenido que viole estos Términos';

  @override
  String get termsSection9Title => '9. PRIVACIDAD Y DATOS';

  @override
  String get termsSection9Content =>
      'RECOPILACIÓN Y USO DE DATOS:\n• Recopilamos y usamos datos según lo descrito en nuestra Política de Privacidad\n• Revise nuestra Política de Privacidad en: https://info.teambuildpro.com/privacy-policy.html\n• Al usar la Aplicación, acepta nuestras prácticas de datos\n• Implementamos medidas de seguridad para proteger sus datos\n\nSUS DERECHOS DE PRIVACIDAD:\n• Tiene derechos con respecto a sus datos personales\n• Puede solicitar acceso a sus datos\n• Puede solicitar la eliminación de su cuenta y datos\n• Contáctenos en support@teambuildpro.com para solicitudes de privacidad\n\nSEGURIDAD DE DATOS:\n• Usamos medidas de seguridad estándar de la industria\n• Sin embargo, ningún sistema es completamente seguro\n• Usa la Aplicación bajo su propio riesgo\n• Reporte problemas de seguridad a support@teambuildpro.com';

  @override
  String get termsSection10Title => '10. SERVICIOS Y CONTENIDO DE TERCEROS';

  @override
  String get termsSection10Content =>
      'OPORTUNIDADES DE NEGOCIO:\n• La Aplicación puede mostrar información sobre oportunidades de negocio de terceros\n• Estas oportunidades son proporcionadas por compañías independientes\n• Team Build Pro no está afiliado con estas oportunidades\n• No respaldamos ni garantizamos ninguna oportunidad de terceros\n• Investigue las oportunidades independientemente antes de participar\n\nENLACES DE TERCEROS:\n• La Aplicación puede contener enlaces a sitios web de terceros\n• No somos responsables del contenido o prácticas de terceros\n• Los sitios de terceros tienen sus propios términos y políticas de privacidad\n• Acceda al contenido de terceros bajo su propio riesgo\n\nINTEGRACIONES:\n• La Aplicación puede integrarse con servicios de terceros\n• Su uso de servicios integrados está sujeto a sus términos\n• No somos responsables del rendimiento del servicio de terceros\n• Las integraciones pueden modificarse o discontinuarse en cualquier momento';

  @override
  String get termsSection11Title => '11. DESCARGOS DE RESPONSABILIDAD';

  @override
  String get termsSection11Content =>
      'SIN OPORTUNIDAD DE NEGOCIO:\n• Team Build Pro es solo un servicio de plataforma de networking\n• No ofrecemos ni garantizamos ninguna oportunidad de negocio\n• No garantizamos ingresos, ganancias o éxito\n• Cualquier información de oportunidad de negocio proviene de terceros\n\nSERVICIO PROPORCIONADO \"TAL CUAL\":\n• La Aplicación se proporciona \"tal cual\" y \"según disponibilidad\"\n• No ofrecemos garantías sobre la confiabilidad o disponibilidad de la Aplicación\n• No garantizamos servicio sin errores o ininterrumpido\n• Podemos modificar o discontinuar características en cualquier momento\n\nSIN ASESORAMIENTO PROFESIONAL:\n• La Aplicación no proporciona asesoramiento legal, financiero o fiscal\n• El coaching de IA es solo para fines informativos\n• Consulte profesionales calificados para decisiones importantes\n• No somos responsables de decisiones basadas en el contenido de la Aplicación\n\nDESCARGO DE RESULTADOS:\n• Los resultados individuales varían y no están garantizados\n• El éxito depende del esfuerzo individual y las circunstancias\n• El rendimiento pasado no indica resultados futuros\n• No hacemos representaciones sobre resultados potenciales';

  @override
  String get termsSection12Title => '12. LIMITACIÓN DE RESPONSABILIDAD';

  @override
  String get termsSection12Content =>
      'EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY:\n\nNO SOMOS RESPONSABLES POR:\n• Ningún daño indirecto, incidental o consecuente\n• Pérdida de ganancias, ingresos, datos u oportunidades comerciales\n• Interrupciones del servicio o errores\n• Acceso no autorizado a su cuenta o datos\n• Acciones o contenido de terceros\n• Ningún daño que exceda la cantidad que nos pagó en los últimos 12 meses\n\nLÍMITE DE RESPONSABILIDAD:\n• Nuestra responsabilidad total se limita a las tarifas de suscripción pagadas en los últimos 12 meses\n• Esto se aplica independientemente de la teoría legal de responsabilidad\n• Algunas jurisdicciones no permiten estas limitaciones\n• En esos casos, la responsabilidad se limita al mínimo requerido por ley\n\nRESPONSABILIDAD DEL USUARIO:\n• Usted es responsable de su uso de la Aplicación\n• Usted es responsable de las decisiones basadas en el contenido de la Aplicación\n• Asume todos los riesgos asociados con el uso de la Aplicación\n• Acepta evaluar las oportunidades de negocio independientemente';

  @override
  String get termsSection13Title => '13. INDEMNIZACIÓN';

  @override
  String get termsSection13Content =>
      'Acepta indemnizar, defender y eximir de responsabilidad a Team Build Pro, sus funcionarios, directores, empleados y agentes de cualquier reclamo, daño, pérdida, responsabilidad y gasto (incluidos los honorarios legales) que surjan de:\n\n• Su uso de la Aplicación\n• Su violación de estos Términos\n• Su violación de cualquier derecho de otros\n• Su contenido o información publicada en la Aplicación\n• Su participación en cualquier oportunidad de negocio\n• Su violación de leyes o regulaciones aplicables\n\nEsta obligación de indemnización sobrevive a la terminación de estos Términos y su uso de la Aplicación.';

  @override
  String get termsSection14Title => '14. RESOLUCIÓN DE DISPUTAS';

  @override
  String get termsSection14Content =>
      'LEY APLICABLE:\n• Estos Términos se rigen por las leyes del Estado de Utah, USA\n• La ley federal se aplica cuando corresponda\n• Usted consiente a la jurisdicción en los tribunales de Utah\n\nRESOLUCIÓN INFORMAL:\n• Contáctenos primero para resolver disputas informalmente\n• Email: support@teambuildpro.com\n• Intentaremos resolver problemas de buena fe\n• La mayoría de las preocupaciones se pueden abordar mediante comunicación\n\nARBITRAJE (SI SE REQUIERE):\n• Las disputas pueden estar sujetas a arbitraje vinculante\n• Arbitraje realizado bajo las reglas de la American Arbitration Association\n• Arbitraje individual solamente - sin acciones de clase\n• Ubicación del arbitraje: Utah, USA\n\nEXCEPCIONES:\n• Cualquiera de las partes puede buscar medidas cautelares en tribunales\n• Las disputas de propiedad intelectual pueden litigarse\n• El tribunal de reclamos menores permanece disponible para reclamos calificados';

  @override
  String get termsSection15Title => '15. CAMBIOS EN LOS TÉRMINOS';

  @override
  String get termsSection15Content =>
      'MODIFICACIONES:\n• Podemos actualizar estos Términos en cualquier momento\n• Los cambios entran en vigencia al publicarse en la Aplicación\n• El uso continuado constituye aceptación de cambios\n• Los cambios materiales se comunicarán por correo electrónico o notificación de la Aplicación\n\nSUS OPCIONES:\n• Revise los Términos periódicamente para cambios\n• Si no está de acuerdo con los cambios, deje de usar la Aplicación\n• Cancele su suscripción si no acepta los nuevos Términos\n• Contacte a support@teambuildpro.com con preguntas\n\nFECHA EFECTIVA:\n• Versión actual efectiva a partir de la fecha de publicación\n• Las versiones anteriores son reemplazadas\n• Mantenemos registros de las versiones de los Términos';

  @override
  String get termsSection16Title => '16. DISPOSICIONES GENERALES';

  @override
  String get termsSection16Content =>
      'ACUERDO COMPLETO:\n• Estos Términos constituyen el acuerdo completo entre usted y Team Build Pro\n• Reemplazan todos los acuerdos o entendimientos previos\n• Los términos del EULA de Apple también se aplican a las compras de App Store\n\nSEPARABILIDAD:\n• Si alguna disposición se encuentra inválida, el resto permanece en vigor\n• Las disposiciones inválidas se modificarán para ser ejecutables\n• Los Términos permanecen vinculantes incluso con disposiciones inválidas\n\nSIN RENUNCIA:\n• Nuestro incumplimiento de hacer cumplir cualquier derecho no renuncia a ese derecho\n• La renuncia de un incumplimiento no renuncia a incumplimientos futuros\n• Todos los derechos y recursos son acumulativos\n\nASIGNACIÓN:\n• No puede asignar estos Términos sin nuestro consentimiento\n• Podemos asignar nuestros derechos y obligaciones\n• Los Términos vinculan a sucesores y cesionarios permitidos\n\nINFORMACIÓN DE CONTACTO:\nTeam Build Pro\nEmail: support@teambuildpro.com\nSitio web: https://www.teambuildpro.com\nPolítica de Privacidad: https://info.teambuildpro.com/privacy-policy.html\n\nÚltima Actualización: Enero 2025';

  @override
  String get privacySection1Title => '1. INFORMACIÓN QUE RECOPILAMOS';

  @override
  String get privacySection1Content =>
      'INFORMACIÓN DE CUENTA:\n• Nombre y dirección de correo electrónico\n• Número de teléfono (opcional)\n• Información de perfil que proporciona\n• Credenciales de autenticación\n\nDATOS DE USO:\n• Interacciones con la aplicación y características utilizadas\n• Información del dispositivo (modelo, versión del SO)\n• Datos de rendimiento y fallos\n• Datos de análisis (anonimizados cuando sea posible)\n\nCONTENIDO QUE CREA:\n• Mensajes y comunicaciones\n• Información de contacto que agrega\n• Notas y datos de relaciones\n• Archivos y medios que carga\n\nDATOS DE UBICACIÓN:\n• No recopilamos datos de ubicación precisa\n• La ubicación general puede derivarse de la dirección IP\n• Puede administrar los permisos de ubicación en la configuración del dispositivo';

  @override
  String get privacySection2Title => '2. CÓMO USAMOS SU INFORMACIÓN';

  @override
  String get privacySection2Content =>
      'Usamos la información recopilada para:\n\nPROPORCIONAR SERVICIOS:\n• Crear y administrar su cuenta\n• Habilitar características y funcionalidad de la Aplicación\n• Procesar sus pagos de suscripción\n• Proporcionar atención al cliente\n• Enviar notificaciones relacionadas con el servicio\n\nMEJORAR NUESTRA APLICACIÓN:\n• Analizar patrones de uso y tendencias\n• Corregir errores y mejorar el rendimiento\n• Desarrollar nuevas características\n• Realizar investigaciones y análisis\n\nCOMUNICACIONES:\n• Enviar actualizaciones importantes del servicio\n• Responder a sus consultas\n• Proporcionar soporte técnico\n• Enviar marketing opcional (puede optar por no participar)\n\nCUMPLIMIENTO LEGAL:\n• Cumplir con obligaciones legales\n• Hacer cumplir nuestros Términos de Servicio\n• Proteger derechos y seguridad\n• Prevenir fraude y abuso';

  @override
  String get privacySection3Title => '3. CÓMO COMPARTIMOS SU INFORMACIÓN';

  @override
  String get privacySection3Content =>
      'Compartimos información solo en estas circunstancias limitadas:\n\nPROVEEDORES DE SERVICIOS:\n• Alojamiento en la nube (Firebase/Google Cloud)\n• Procesamiento de pagos (Apple)\n• Servicios de análisis\n• Herramientas de atención al cliente\n• Estos proveedores están contractualmente obligados a proteger sus datos\n\nREQUISITOS LEGALES:\n• Cuando lo requiera la ley o proceso legal\n• Para proteger derechos, propiedad o seguridad\n• En relación con procedimientos legales\n• Para prevenir fraude o actividad ilegal\n\nTRANSFERENCIAS COMERCIALES:\n• En relación con fusión, adquisición o venta de activos\n• Sus datos pueden transferirse a entidad sucesora\n• Se le notificará de cualquier transferencia\n\nCON SU CONSENTIMIENTO:\n• Cuando usted autoriza explícitamente el compartir\n• Para propósitos que aprueba\n\nNO HACEMOS:\n• Vender su información personal\n• Compartir datos para marketing de terceros\n• Proporcionar datos a corredores de datos';

  @override
  String get privacySection4Title => '4. SEGURIDAD DE DATOS';

  @override
  String get privacySection4Content =>
      'MEDIDAS DE SEGURIDAD:\n• Cifrado estándar de la industria en tránsito y en reposo\n• Sistemas de autenticación seguros\n• Evaluaciones de seguridad regulares\n• Controles de acceso y monitoreo\n• Centros de datos seguros (Google Cloud/Firebase)\n\nSUS RESPONSABILIDADES:\n• Mantenga su contraseña confidencial\n• Use características de seguridad del dispositivo (código de acceso, biometría)\n• Reporte actividad sospechosa inmediatamente\n• Mantenga su dispositivo y aplicación actualizados\n\nLIMITACIONES:\n• Ningún sistema es 100% seguro\n• Usa la Aplicación bajo su propio riesgo\n• No podemos garantizar seguridad absoluta\n• Reporte problemas de seguridad a: support@teambuildpro.com';

  @override
  String get privacySection5Title => '5. SUS DERECHOS DE PRIVACIDAD';

  @override
  String get privacySection5Content =>
      'Tiene los siguientes derechos con respecto a sus datos:\n\nACCESO Y PORTABILIDAD:\n• Solicitar una copia de sus datos personales\n• Exportar sus datos en un formato portable\n• Revisar qué información tenemos sobre usted\n\nCORRECCIÓN:\n• Actualizar información inexacta\n• Modificar los detalles de su perfil\n• Corregir errores en su cuenta\n\nELIMINACIÓN:\n• Solicitar eliminación de su cuenta y datos\n• Usar la función \"Eliminar Cuenta\" en la Aplicación\n• Algunos datos pueden retenerse para cumplimiento legal\n• La eliminación es permanente y no se puede deshacer\n\nOPTAR POR NO PARTICIPAR:\n• Cancelar suscripción a correos electrónicos de marketing\n• Desactivar notificaciones push en la configuración del dispositivo\n• Limitar la recopilación de datos de análisis\n\nPARA EJERCER DERECHOS:\n• Use la configuración en la aplicación cuando esté disponible\n• Email: support@teambuildpro.com\n• Responderemos dentro de 30 días\n• Puede requerirse verificación de identidad';

  @override
  String get privacySection6Title => '6. RETENCIÓN DE DATOS';

  @override
  String get privacySection6Content =>
      'CUÁNTO TIEMPO CONSERVAMOS LOS DATOS:\n\nCUENTAS ACTIVAS:\n• Datos retenidos mientras su cuenta esté activa\n• Necesario para proporcionar servicio continuo\n• Puede eliminar datos o cuenta en cualquier momento\n\nCUENTAS ELIMINADAS:\n• La mayoría de los datos se eliminan dentro de 30 días\n• Algunos datos retenidos para cumplimiento legal\n• Sistemas de respaldo purgados dentro de 90 días\n• Registros financieros conservados según requisitos legales\n\nRETENCIÓN LEGAL:\n• Registros de transacciones: 7 años (ley tributaria)\n• Disputas legales: hasta resolución + estatuto de limitaciones\n• Prevención de fraude: según lo requerido legalmente\n• Análisis agregados: indefinidamente (anonimizados)\n\nSU CONTROL:\n• Solicitar eliminación en cualquier momento\n• Exportar datos antes de la eliminación de cuenta\n• La eliminación es permanente e irreversible';

  @override
  String get privacySection7Title => '7. PRIVACIDAD DE MENORES';

  @override
  String get privacySection7Content =>
      'RESTRICCIÓN DE EDAD:\n• La Aplicación no está destinada a usuarios menores de 18 años\n• No recopilamos datos de menores a sabiendas\n• Debe tener 18+ para crear una cuenta\n\nSI NOS ENTERAMOS DE USUARIOS MENORES DE EDAD:\n• Eliminaremos sus cuentas de inmediato\n• Eliminaremos todos los datos asociados\n• Tomaremos medidas para prevenir el acceso futuro de menores\n\nDERECHOS PARENTALES:\n• Los padres pueden solicitar la eliminación de datos de menores\n• Contacto: support@teambuildpro.com\n• Proporcione prueba de relación parental\n• Actuaremos rápidamente en solicitudes verificadas';

  @override
  String get privacySection8Title => '8. CAMBIOS A LA POLÍTICA DE PRIVACIDAD';

  @override
  String get privacySection8Content =>
      'ACTUALIZACIONES:\n• Podemos actualizar esta Política de Privacidad periódicamente\n• Cambios publicados en la Aplicación y en nuestro sitio web\n• Cambios materiales comunicados por correo electrónico o notificación\n• El uso continuado significa aceptación de cambios\n\nSUS OPCIONES:\n• Revise esta política regularmente\n• Contáctenos con preguntas: support@teambuildpro.com\n• Deje de usar la Aplicación si no está de acuerdo con los cambios\n• Elimine su cuenta si no acepta las actualizaciones\n\nFECHA EFECTIVA:\n• Versión actual: Enero 2025\n• Última Actualización: Enero 2025\n• Las versiones anteriores son reemplazadas\n\nINFORMACIÓN DE CONTACTO:\nTeam Build Pro\nEmail: support@teambuildpro.com\nSitio web: https://www.teambuildpro.com\nTérminos de Servicio: https://info.teambuildpro.com/terms-of-service.html';

  @override
  String get subscriptionScreenTitle => 'Team Build Pro';

  @override
  String get subscriptionSuccessMessage => '✅ ¡Suscripción activada con éxito!';

  @override
  String get subscriptionRestoreSuccess =>
      '✅ ¡Suscripción restaurada con éxito!';

  @override
  String get subscriptionRestoreNone =>
      'No se encontró ninguna suscripción anterior para restaurar.';

  @override
  String get subscriptionStatusTrial => 'Prueba Gratuita Activa';

  @override
  String subscriptionStatusTrialSubtitle(int days) {
    return '$days días restantes en su prueba';
  }

  @override
  String get subscriptionPremiumFeaturesHeader => 'Funciones Premium:';

  @override
  String subscriptionFeatureReferralLink(String bizOpp) {
    return 'Envíe su enlace de referencia único de $bizOpp';
  }

  @override
  String get subscriptionFeatureAiCoaching =>
      'Entrenamiento de IA personalizado para reclutamiento y construcción de equipos';

  @override
  String get subscriptionFeatureMessaging =>
      'Desbloquee mensajes para usuarios de su equipo';

  @override
  String subscriptionFeatureEnsureTeam(String bizOpp) {
    return 'Asegure que los miembros del equipo se unan bajo USTED en $bizOpp';
  }

  @override
  String get subscriptionFeatureAnalytics =>
      'Análisis avanzados e información detallada';

  @override
  String get subscriptionManagementApple =>
      'Puede administrar su suscripción en la configuración de su cuenta de Apple ID.';

  @override
  String get subscriptionManagementGoogle =>
      'Puede administrar su suscripción en Google Play Store.';

  @override
  String get faqTitle => 'Preguntas Frecuentes';

  @override
  String get faqSearchHint => 'Buscar preguntas...';

  @override
  String get faqCategoryGettingStarted => 'Primeros Pasos';

  @override
  String get faqCategoryBusinessModel => 'Modelo de Negocio y Legitimidad';

  @override
  String get faqCategoryHowItWorks => 'Cómo Funciona';

  @override
  String get faqCategoryTeamBuilding => 'Construcción y Gestión de Equipos';

  @override
  String get faqCategoryGlobalFeatures => 'Características Globales y Técnicas';

  @override
  String get faqCategoryPrivacySecurity => 'Privacidad y Seguridad';

  @override
  String get faqCategoryPricing => 'Precios y Valor del Negocio';

  @override
  String get faqCategoryConcerns => 'Preocupaciones y Objeciones Comunes';

  @override
  String get faqCategorySuccess => 'Éxito y Resultados';

  @override
  String get faqCategorySupport => 'Soporte y Capacitación';

  @override
  String get faqQ1 => '¿Qué es exactamente Team Build Pro?';

  @override
  String get faqA1 =>
      'Team Build Pro es una herramienta de software profesional diseñada para ayudar a profesionales de ventas directas a construir, gestionar y rastrear sus equipos antes y durante su trayectoria empresarial. NO es una oportunidad de negocio ni una empresa MLM - es la herramienta que te ayuda a tener éxito en cualquier oportunidad que elijas.';

  @override
  String get faqQ2 =>
      '¿En qué se diferencia de otras aplicaciones de construcción de equipos o sistemas CRM?';

  @override
  String get faqA2 =>
      'A diferencia de los CRM genéricos, Team Build Pro está específicamente diseñado para la industria de ventas directas. Comprende los desafíos únicos que enfrentas: comenzar desde cero, ganar impulso, calificar prospectos y mantener la motivación del equipo. Nuestro sistema te permite pre-construir tu equipo incluso antes de unirte a una oportunidad, dándote una ventaja masiva.';

  @override
  String get faqQ3 =>
      '¿Realmente puedo construir un equipo ANTES de unirme a una oportunidad de negocio?';

  @override
  String get faqA3 =>
      '¡Absolutamente! Esta es nuestra innovación principal. Puedes invitar prospectos y miembros de equipo existentes a Team Build Pro, dejar que experimenten el éxito en la construcción de equipos, y cuando alcancen los hitos de calificación (4 patrocinadores directos + 20 miembros totales del equipo), automáticamente reciben una invitación para unirse a tu oportunidad de negocio. Elimina el problema del \"inicio en frío\" que mata a la mayoría de los nuevos distribuidores.';

  @override
  String get faqQ4 => '¿Necesito una tarjeta de crédito para probarlo?';

  @override
  String get faqA4 =>
      'No. Obtienes acceso completo a todas las funciones premium durante 30 días completamente gratis, sin necesidad de tarjeta de crédito. Puedes decidir suscribirte en cualquier momento durante o después de tu prueba.';

  @override
  String get faqQ5 => '¿Es Team Build Pro un MLM u oportunidad de negocio?';

  @override
  String get faqA5 =>
      'No. Team Build Pro no es una oportunidad de negocio, MLM o plataforma de ingresos de ningún tipo. Somos una herramienta de software diseñada exclusivamente para ayudar a profesionales a construir y rastrear sus equipos. No proporcionamos ninguna forma de compensación al usuario.';

  @override
  String get faqQ6 =>
      '¿Puedo usar esto con cualquier empresa de ventas directas?';

  @override
  String get faqA6 =>
      '¡Sí! Team Build Pro es agnóstico a la empresa. Ya sea que estés en salud y bienestar, servicios financieros, belleza, tecnología o cualquier otra industria de ventas directas, nuestras herramientas funcionan con tu negocio. Simplemente personaliza tu perfil con los detalles de tu oportunidad.';

  @override
  String get faqQ7 =>
      '¿Qué pasa si actualmente no estoy con una empresa pero quiero unirme a una?';

  @override
  String get faqA7 =>
      '¡Perfecto! Aquí es donde Team Build Pro brilla. Puedes comenzar a construir tu equipo inmediatamente, incluso antes de elegir a qué empresa unirte. Cuando decidas, lanzarás con un equipo pre-construido y motivado en lugar de comenzar desde cero.';

  @override
  String get faqQ8 => '¿Cómo funciona el sistema de calificación?';

  @override
  String get faqA8 =>
      'Cuando alguien se une a Team Build Pro a través de tu referencia, comienza a construir su propio equipo. Una vez que alcancen nuestros hitos de éxito (4 patrocinadores directos + 20 miembros totales del equipo), automáticamente reciben una invitación para unirse a tu oportunidad de negocio. Esto asegura que solo constructores de equipos motivados y probados avancen a tu negocio real.';

  @override
  String get faqQ9 =>
      '¿Qué pasa si alguien se une a mi equipo de Team Build Pro pero no quiere unirse a mi oportunidad de negocio?';

  @override
  String get faqA9 =>
      '¡Está perfectamente bien! Pueden continuar usando Team Build Pro para construir su propio equipo para cualquier oportunidad que elijan, o pueden mantenerse enfocados en la construcción de equipos. No hay presión. La belleza es que solo estás trabajando con personas que han demostrado compromiso y éxito.';

  @override
  String get faqQ10 =>
      '¿Puedo rastrear el progreso y la actividad de mi equipo?';

  @override
  String get faqA10 =>
      '¡Sí! Obtienes analíticas completas incluyendo estadísticas de crecimiento del equipo en tiempo real, progreso individual de miembros hacia la calificación, niveles de actividad y métricas de participación, distribución geográfica de tu equipo, tendencias de rendimiento e hitos, e informes de crecimiento diarios/semanales.';

  @override
  String get faqQ11 => '¿Cómo obtengo mi enlace de referencia?';

  @override
  String get faqA11 =>
      'Una vez que crees tu cuenta, obtienes un enlace de referencia personalizado que puedes compartir a través de redes sociales, correo electrónico, texto o en persona.';

  @override
  String get faqQ12 =>
      '¿Cuál es la diferencia entre \"patrocinadores\" y \"miembros del equipo\"?';

  @override
  String get faqA12 =>
      'Los patrocinadores directos son personas que invitas personalmente y que se unen a través de tu enlace de referencia. Los miembros totales del equipo incluyen tus patrocinadores directos más todos a quienes ellos patrocinan (tu línea descendente). Para la calificación, necesitas 4 patrocinadores directos y 20 miembros totales del equipo.';

  @override
  String get faqQ13 =>
      '¿Pueden mis miembros del equipo enviarse mensajes entre sí?';

  @override
  String get faqA13 =>
      '¡Sí! Team Build Pro incluye mensajería segura y encriptada para que tu equipo pueda comunicarse, compartir consejos y apoyarse mutuamente.';

  @override
  String get faqQ14 =>
      '¿Qué pasa si alguien en mi equipo se califica antes que yo?';

  @override
  String get faqA14 =>
      '¡Eso es realmente genial! Muestra que el sistema está funcionando. Pueden avanzar a tu oportunidad de negocio independientemente, y tú continúas construyendo tu propia calificación. El éxito genera éxito - tener miembros del equipo calificados a menudo motiva a otros.';

  @override
  String get faqQ15 => '¿Cómo sé si mis miembros del equipo están activos?';

  @override
  String get faqA15 =>
      'Nuestro panel muestra niveles de actividad, fechas de último inicio de sesión, progreso en la construcción del equipo y métricas de participación para cada miembro. Puedes identificar fácilmente quién podría necesitar ánimo o apoyo.';

  @override
  String get faqQ16 => '¿Puedo eliminar a alguien de mi equipo?';

  @override
  String get faqA16 =>
      'Los miembros del equipo pueden elegir irse por su cuenta, pero no puedes eliminarlos. Esto protege la integridad del equipo y asegura que el trabajo duro de todos en la construcción de sus equipos esté preservado.';

  @override
  String get faqQ17 => '¿Esto funciona internacionalmente?';

  @override
  String get faqA17 =>
      '¡Sí! Team Build Pro funciona en más de 120 países con características conscientes de la zona horaria. Puedes construir un equipo verdaderamente global, y nuestro sistema maneja diferentes zonas horarias para notificaciones e informes.';

  @override
  String get faqQ18 => '¿En qué dispositivos funciona?';

  @override
  String get faqA18 =>
      'Team Build Pro está disponible en dispositivos iOS (iPhone/iPad) y Android, con un complemento web para características adicionales. Todo se sincroniza en todos tus dispositivos.';

  @override
  String get faqQ19 => '¿Qué pasa si no soy experto en tecnología?';

  @override
  String get faqA19 =>
      'La aplicación está diseñada para la simplicidad. Si puedes usar redes sociales, puedes usar Team Build Pro. Además, proporcionamos tutoriales de incorporación y soporte al cliente para ayudarte a comenzar.';

  @override
  String get faqQ20 => '¿La aplicación funciona sin conexión?';

  @override
  String get faqA20 =>
      'Necesitas una conexión a internet para características en tiempo real como mensajería y actualizaciones en vivo, pero puedes ver tu equipo y algunas analíticas sin conexión. Los datos se sincronizan cuando te reconectas.';

  @override
  String get faqQ21 => '¿Qué tan seguros están mis datos?';

  @override
  String get faqA21 =>
      'Usamos seguridad de grado empresarial incluyendo encriptación de extremo a extremo para todas las comunicaciones, almacenamiento en la nube seguro con copias de seguridad regulares, opciones de autenticación multifactor, cumplimiento GDPR para protección de datos, y sin compartir datos con terceros.';

  @override
  String get faqQ22 => '¿Quién puede ver la información de mi equipo?';

  @override
  String get faqA22 =>
      'Solo tú puedes ver tu equipo completo. Los miembros del equipo pueden ver sus propios patrocinadores directos y línea descendente, pero no pueden ver toda tu organización. Esto protege la privacidad de todos mientras mantiene la transparencia en las relaciones directas.';

  @override
  String get faqQ23 => '¿Qué pasa con mis datos si cancelo?';

  @override
  String get faqA23 =>
      'Puedes exportar los datos de tu equipo antes de cancelar. Después de la cancelación, tu cuenta se desactiva pero tus relaciones de equipo permanecen intactas para otros en tu equipo. Retenemos datos mínimos solo para fines legales/de facturación.';

  @override
  String get faqQ24 => '¿Venden mi información a otras empresas?';

  @override
  String get faqA24 =>
      'Absolutamente no. Nunca vendemos, alquilamos o compartimos tu información personal con terceros. Nuestros ingresos provienen de suscripciones, no de ventas de datos.';

  @override
  String get faqQ25 =>
      '¿Vale la pena \$6.99/mes en comparación con alternativas gratuitas?';

  @override
  String get faqA25 =>
      'Las herramientas gratuitas no están diseñadas para la industria de ventas directas y carecen de características cruciales como seguimiento de calificación, integración de oportunidades de negocio y analíticas de equipo. Por menos del costo de un café, obtienes herramientas profesionales de construcción de equipos que pueden transformar tu negocio.';

  @override
  String get faqQ26 => '¿Puedo deducir esto como gasto de negocio?';

  @override
  String get faqA26 =>
      'Muchos profesionales de ventas directas lo tratan como un gasto de herramienta de negocio, pero consulta a tu asesor fiscal para orientación específica a tu situación.';

  @override
  String get faqQ27 => '¿Qué pasa si necesito cancelar?';

  @override
  String get faqA27 =>
      'Puedes cancelar en cualquier momento sin tarifas de cancelación ni compromisos a largo plazo. Mantienes el acceso hasta el final de tu período de facturación actual.';

  @override
  String get faqQ28 => '¿Ofrecen descuentos por equipo o volumen?';

  @override
  String get faqA28 =>
      'Actualmente, ofrecemos solo suscripciones individuales. Esto mantiene los costos bajos y asegura que todos tengan acceso igual a todas las características.';

  @override
  String get faqQ29 =>
      '¿No está esto simplemente complicando más las ventas directas?';

  @override
  String get faqA29 =>
      '¡En realidad, simplifica todo! En lugar de llamar en frío a extraños o presionar a amigos, estás construyendo relaciones con personas que están activamente comprometidas en la construcción de equipos. Elimina las conjeturas y la incomodidad del reclutamiento tradicional.';

  @override
  String get faqQ30 =>
      '¿Qué pasa si la gente piensa que esto es \"otra cosa de MLM\"?';

  @override
  String get faqA30 =>
      'Por eso somos muy claros que Team Build Pro es software, no una oportunidad. Estás invitando a personas a usar una herramienta profesional, no a unirse a un negocio. Muchas personas están más abiertas a probar una aplicación que a unirse a un MLM.';

  @override
  String get faqQ31 => '¿Cómo explico esto a los prospectos sin confundirlos?';

  @override
  String get faqA31 =>
      'Simple: \"Es como LinkedIn para profesionales de ventas directas. Construyes conexiones, rastreas el crecimiento de tu equipo, y cuando estás listo para avanzar en tu carrera, las oportunidades se vuelven disponibles.\" Enfócate en el ángulo del desarrollo profesional.';

  @override
  String get faqQ32 =>
      '¿Qué pasa si mi empresa actual no permite herramientas externas?';

  @override
  String get faqA32 =>
      'Revisa las políticas de tu empresa, pero la mayoría de las empresas de ventas directas dan la bienvenida a herramientas que te ayudan a construir tu negocio. Team Build Pro no compite con tu empresa - alimenta prospectos calificados hacia ella.';

  @override
  String get faqQ33 => '¿Cuánto tiempo toma ver resultados?';

  @override
  String get faqA33 =>
      'El éxito en ventas directas toma tiempo independientemente de las herramientas. Sin embargo, los usuarios de Team Build Pro a menudo ven crecimiento del equipo en semanas porque están enfocados en construir relaciones en lugar de vender. La clave es la actividad diaria consistente.';

  @override
  String get faqQ34 =>
      '¿Cuál es un cronograma realista para construir un equipo calificado?';

  @override
  String get faqA34 =>
      'Esto varía mucho según el esfuerzo individual y el mercado, pero nuestros usuarios más exitosos logran la calificación (4 directos, 20 totales) dentro de unas semanas de actividad consistente. Recuerda, estás construyendo relaciones, no solo recolectando inscripciones.';

  @override
  String get faqQ35 => '¿Garantizan resultados?';

  @override
  String get faqA35 =>
      'Ningún software puede garantizar tu éxito empresarial - eso depende de tu esfuerzo, mercado y oportunidad. Proporcionamos las herramientas; tú proporcionas la ética de trabajo y las habilidades de construcción de relaciones.';

  @override
  String get faqQ36 => '¿Pueden compartir historias de éxito?';

  @override
  String get faqA36 =>
      'Aunque mantenemos la privacidad del usuario, podemos compartir que nuestros usuarios más exitosos comparten consistentemente su enlace de Team Build Pro, se comprometen con su equipo diariamente y se enfocan en ayudar a otros a tener éxito en lugar de solo reclutar.';

  @override
  String get faqQ37 => '¿Qué tipo de soporte proporcionan?';

  @override
  String get faqA37 =>
      'Ofrecemos soporte al cliente 24/7 a través de mensajería en la aplicación, mejores prácticas para construcción de equipos, y actualizaciones y mejoras de características regulares.';

  @override
  String get faqQ38 => '¿Qué hace exactamente el Coach de IA?';

  @override
  String get faqA38 =>
      'El Coach de IA te ayuda a navegar la aplicación Team Build Pro, responde preguntas sobre características y requisitos de calificación, proporciona orientación sobre construcción de equipos y puede sugerir qué secciones de la aplicación visitar para tareas específicas.';

  @override
  String get faqQ39 =>
      '¿Proporcionan capacitación sobre cómo reclutar o vender?';

  @override
  String get faqA39 =>
      'Nos enfocamos en mostrarte cómo usar Team Build Pro efectivamente. Para capacitación en ventas y reclutamiento, recomendamos trabajar con tu patrocinador o los programas de capacitación de tu empresa.';

  @override
  String get faqQ40 => '¿Qué pasa si tengo problemas técnicos?';

  @override
  String get faqA40 =>
      'Contacta a nuestro equipo de soporte a través de la aplicación o sitio web. La mayoría de los problemas se resuelven rápidamente, y estamos comprometidos a mantener tus actividades de construcción de equipos funcionando sin problemas.';

  @override
  String get faqFooterTitle =>
      '¿Listo para Transformar tu Construcción de Equipos?';

  @override
  String get faqFooterSubtitle =>
      'Comienza tu prueba gratuita de 30 días hoy y experimenta la diferencia que hacen las herramientas profesionales.';

  @override
  String get faqFooterContact =>
      '¿Preguntas no respondidas aquí? Contacta a nuestro equipo de soporte - ¡estamos aquí para ayudarte a tener éxito!';

  @override
  String get bizOppEducationTitle => '¡Asegure Su Posición de Patrocinio!';

  @override
  String get bizOppEducationWorksTitle => 'Cómo Funciona el Patrocinio';

  @override
  String bizOppEducationWorksBody(String business) {
    return 'Cuando los miembros de tu equipo se unan a $business, su patrocinador será la PRIMERA persona en su línea ascendente que ya se haya unido.';
  }

  @override
  String get bizOppEducationBenefitsTitle => 'Únete ahora para asegurar:';

  @override
  String get bizOppEducationBenefit1 => 'Tus reclutas son patrocinados bajo TI';

  @override
  String get bizOppEducationBenefit2 => 'Recibes crédito por su actividad';

  @override
  String get bizOppEducationBenefit3 => 'No te pierdes esta oportunidad';

  @override
  String get bizOppEducationRemindLater => 'Recuérdamelo Más Tarde';

  @override
  String get bizOppEducationJoinNow => 'Unirse Ahora';

  @override
  String get sharePartnerImportantLabel => 'Importante:';

  @override
  String sharePartnerImportantText(String business) {
    return 'Recomendamos encarecidamente que compartas la aplicación Team Build Pro con los miembros de tu equipo de primera línea de $business (personas que has patrocinado personalmente) antes de compartirla con miembros del equipo de $business que no patrocinaste personalmente. Esto brindará la oportunidad de respetar las relaciones de patrocinio establecidas en tu línea descendente de $business.';
  }

  @override
  String get bizProgressTitle => 'Progreso de Registro';

  @override
  String get bizProgressStep1 => 'Copiar Enlace de Registro';

  @override
  String get bizProgressStep2 => 'Completar Registro';

  @override
  String get bizProgressStep3 => 'Agregar Tu Enlace de Referencia';

  @override
  String get hiwTitle => 'Cómo Funciona';

  @override
  String get hiwSubtitle =>
      'Transforma tu reclutamiento con un equipo pre-calificado.';

  @override
  String get hiwFeaturedOpp => 'Oportunidad Destacada';

  @override
  String get hiwPipelineSystem => 'SISTEMA DE CANALIZACIÓN';

  @override
  String get hiwStep1Title => 'Establece Tu Base';

  @override
  String get hiwStep1Desc =>
      'Personaliza tu cuenta de Team Build Pro con los detalles de tu oportunidad y conecta tu enlace de referencia, convirtiendo la aplicación en tu canal personal de reclutamiento.';

  @override
  String get hiwStep2Title => 'Construye Inteligentemente, No Duramente';

  @override
  String get hiwStep2Desc =>
      'Comparte Team Build Pro con prospectos y miembros del equipo existentes. Los miembros actuales del equipo crean impulso instantáneo, y los prospectos de reclutamiento experimentan un éxito real en la construcción del equipo antes de unirse a tu oportunidad, eliminando el problema del \"arranque en frío\".';

  @override
  String get hiwStep3Title => 'Calificación Automática';

  @override
  String get hiwStep3Desc =>
      'Cuando los prospectos de reclutamiento alcanzan nuestros hitos de éxito (4 patrocinadores directos + 20 miembros totales del equipo), automáticamente reciben una invitación para unirse a tu oportunidad.';

  @override
  String get hiwStep4Title => 'Crecimiento Rápido';

  @override
  String get hiwStep4Desc =>
      'A medida que tu organización de Team Build Pro se expande, cada líder calificado alimenta nuevos prospectos pre-entrenados en tu oportunidad, creando un motor de crecimiento autosostenible.';

  @override
  String get hiwKeyTargets => 'OBJETIVOS CLAVE DE CRECIMIENTO';

  @override
  String get hiwDirectSponsors => 'Patrocinadores Directos';

  @override
  String get hiwTotalTeam => 'Miembros Totales del Equipo';

  @override
  String get hiwGrowNetwork => 'Haz Crecer Tu Red';

  @override
  String get hiwExpandNetwork =>
      '¡Expande tu Red para impulsar el crecimiento de la organización!';

  @override
  String get hiwProvenStrategies => 'Estrategias Probadas de Crecimiento';

  @override
  String get pmTitle => 'Crear Cuenta';

  @override
  String get pmDialogTitle => 'Términos Importantes';

  @override
  String get pmDialogIntro =>
      'Estás creando una nueva cuenta de administrador separada. Al continuar, comprendes y aceptas lo siguiente:';

  @override
  String get pmTerm1 =>
      'Esta nueva cuenta es completamente separada y no se puede fusionar con tu cuenta actual.';

  @override
  String pmTerm2(String bizOpp) {
    return 'Tu equipo existente de \"$bizOpp\" no es transferible.';
  }

  @override
  String get pmTerm3 =>
      'Esta cuenta debe usarse para una oportunidad de negocio nueva y diferente.';

  @override
  String get pmTerm4 =>
      'La promoción cruzada o el reclutamiento de miembros entre tus cuentas separadas está estrictamente prohibido.';

  @override
  String get pmTerm5 =>
      'La violación de estos términos puede resultar en la suspensión o cancelación de TODAS tus cuentas asociadas.';

  @override
  String get pmAgreeTerms => 'Comprendo y acepto estos términos';

  @override
  String get pmCancel => 'Cancelar';

  @override
  String get pmContinue => 'Continuar';

  @override
  String get pmCardTitle => 'Administrar Otra Oportunidad';

  @override
  String get pmCardDesc =>
      'Crea una cuenta separada para administrar y hacer crecer una oportunidad diferente.';

  @override
  String get pmCreateButton => 'Crear Nueva Cuenta';

  @override
  String get authSignupTitle => 'Registro de Cuenta';

  @override
  String get authSignupCreateLoginHeader => 'Crea Tu Inicio de Sesión';

  @override
  String get authSignupEmailPrivacy =>
      'Tu correo electrónico nunca será compartido con nadie';

  @override
  String get adminEditProfileTitle => 'Configuración del Negocio';

  @override
  String get adminEditProfileHeaderTitle => 'Tu Oportunidad de Negocio';

  @override
  String get adminEditProfileWarningCannotChange =>
      '⚠️ Importante: Esta información no se puede cambiar una vez guardada.';

  @override
  String get adminEditProfileWarningExplanation =>
      'El nombre de tu oportunidad de negocio y el enlace de referencia aseguran que los miembros de Team Build Pro se coloquen con precisión en tu línea descendente de oportunidad de negocio cuando califiquen. Cambiar esto rompería la conexión entre tus redes.';

  @override
  String get adminEditProfileLabelBizOppName =>
      'Nombre de Tu Oportunidad de Negocio';

  @override
  String get adminEditProfileHelperCannotChange =>
      'Esto no se puede cambiar una vez establecido';

  @override
  String get adminEditProfileLabelBizOppNameConfirm =>
      'Confirmar Nombre de Oportunidad de Negocio';

  @override
  String get adminEditProfileLabelReferralLink => 'Tu Enlace de Referencia';

  @override
  String get adminEditProfileLabelReferralLinkConfirm =>
      'Confirmar URL del Enlace de Referencia';

  @override
  String get adminEditProfileValidationRequired => 'Requerido';

  @override
  String get adminEditProfileDialogErrorTitle =>
      'Error de Enlace de Referencia';

  @override
  String get adminEditProfileDialogErrorHelper =>
      'Por favor verifica tu enlace de referencia e intenta nuevamente.';

  @override
  String get adminEditProfileDialogImportantTitle => '¡Muy Importante!';

  @override
  String get adminEditProfileDialogImportantMessage =>
      'Debes ingresar el enlace de referencia exacto que recibiste de tu compañía. Esto asegurará que los miembros de tu equipo que se unan a tu oportunidad de negocio sean colocados automáticamente en tu equipo de oportunidad de negocio.';

  @override
  String get adminEditProfileButtonUnderstand => 'Entiendo';

  @override
  String get adminEditProfilePreviewTitle =>
      'Vista Previa del Enlace de Referencia:';

  @override
  String get adminEditProfileButtonComplete => '¡Completar Perfil y Comenzar!';

  @override
  String get adminEditProfileSuccessSaved => '¡Perfil completado exitosamente!';

  @override
  String adminEditProfileErrorSaving(String error) {
    return 'Error: $error';
  }

  @override
  String get adminEditProfileValidationBizNameRequired =>
      'Por favor ingresa el nombre de tu oportunidad de negocio';

  @override
  String get adminEditProfileValidationBizNameConfirmRequired =>
      'Por favor confirma el nombre de tu oportunidad de negocio';

  @override
  String get adminEditProfileValidationReferralLinkRequired =>
      'Por favor ingresa tu enlace de referencia';

  @override
  String get adminEditProfileValidationReferralLinkConfirmRequired =>
      'Por favor confirma tu enlace de referencia';

  @override
  String get adminEditProfileValidationBizNameInvalidChars =>
      'El nombre del negocio solo puede contener letras, números y puntuación común.';

  @override
  String get adminEditProfileValidationUrlBasic =>
      'Por favor ingresa un enlace de referencia válido (ej., https://ejemplo.com).';

  @override
  String get adminEditProfileValidationBizNameMismatch =>
      'Los campos de Nombre de Negocio deben coincidir para confirmación.';

  @override
  String get adminEditProfileValidationReferralLinkMismatch =>
      'Los campos de Enlace de Referencia deben coincidir para confirmación.';

  @override
  String get adminEditProfileValidationUrlInvalid =>
      'Por favor ingresa una URL válida (ej., https://ejemplo.com)';

  @override
  String get adminEditProfileValidationUrlNotHttps =>
      'El enlace de referencia debe usar HTTPS (no HTTP) por seguridad';

  @override
  String get adminEditProfileValidationUrlLocalhost =>
      'Por favor ingresa un enlace de referencia de negocio válido\n(no localhost o dirección IP)';

  @override
  String get adminEditProfileValidationUrlNoTld =>
      'Por favor ingresa una URL válida con un dominio apropiado\n(ej., compania.com)';

  @override
  String get adminEditProfileValidationUrlHomepageOnly =>
      'Por favor ingresa tu enlace de referencia completo, no solo la página principal.\nTu enlace de referencia debe incluir tu identificador único\n(ej., https://compania.com/unirse?ref=tunombre)';

  @override
  String get adminEditProfileValidationUrlFormat =>
      'Formato de URL inválido. Por favor verifica tu enlace de referencia.';

  @override
  String get adminEditProfileValidationUrlVerificationFailed =>
      'El enlace de referencia que ingresaste no pudo ser verificado. Por favor verifica tu conexión a internet e intenta nuevamente.';

  @override
  String get adminEditProfileValidationUrlVerificationError =>
      'El enlace de referencia que ingresaste no pudo ser verificado. Por favor verifica la URL e intenta nuevamente.';
}
