// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Team Build Pro';

  @override
  String get authLoginHeaderTitle => 'Bem-vindo de volta';

  @override
  String get authLoginLabelEmail => 'Email';

  @override
  String get authLoginHintEmail => 'Digite seu endereço de email';

  @override
  String get authLoginEmailRequired => 'Por favor, digite seu email';

  @override
  String get authLoginEmailInvalid => 'Por favor, digite um email válido';

  @override
  String get authLoginLabelPassword => 'Senha';

  @override
  String get authLoginHintPassword => 'Digite sua senha';

  @override
  String get authLoginPasswordRequired => 'Por favor, digite sua senha';

  @override
  String authLoginPasswordTooShort(int min) {
    return 'A senha deve ter pelo menos $min caracteres';
  }

  @override
  String get authLoginButtonSignIn => 'Entrar';

  @override
  String get authLoginNoAccountPrompt => 'Não tem uma conta?';

  @override
  String get authLoginLinkSignUp => 'Cadastre-se';

  @override
  String authLoginBiometric(String method) {
    return 'Entrar com $method';
  }

  @override
  String get authLoginBiometricMethodFace => 'Face ID';

  @override
  String get authLoginBiometricMethodTouch => 'Touch ID';

  @override
  String get authLoginBiometricMethodGeneric => 'Biometria';

  @override
  String get authSignupHeaderTitle => 'Crie sua conta';

  @override
  String get authSignupLabelFirstName => 'Nome';

  @override
  String get authSignupHintFirstName => 'Digite seu nome';

  @override
  String get authSignupFirstNameRequired => 'Por favor, digite seu nome';

  @override
  String get authSignupLabelLastName => 'Sobrenome';

  @override
  String get authSignupHintLastName => 'Digite seu sobrenome';

  @override
  String get authSignupLastNameRequired => 'Por favor, digite seu sobrenome';

  @override
  String get authSignupLabelEmail => 'Email';

  @override
  String get authSignupHintEmail => 'Digite seu endereço de email';

  @override
  String get authSignupEmailRequired => 'Por favor, digite seu email';

  @override
  String get authSignupEmailInvalid => 'Por favor, digite um email válido';

  @override
  String get authSignupLabelPassword => 'Senha';

  @override
  String get authSignupHintPassword => 'Crie uma senha';

  @override
  String get authSignupPasswordRequired => 'Por favor, digite uma senha';

  @override
  String authSignupPasswordTooShort(int min) {
    return 'A senha deve ter pelo menos $min caracteres';
  }

  @override
  String get authSignupLabelConfirmPassword => 'Confirmar Senha';

  @override
  String get authSignupHintConfirmPassword => 'Digite sua senha novamente';

  @override
  String get authSignupConfirmPasswordRequired =>
      'Por favor, confirme sua senha';

  @override
  String get authSignupPasswordMismatch => 'As senhas não coincidem';

  @override
  String get authSignupLabelReferralCode => 'Código de Indicação (Opcional)';

  @override
  String get authSignupHintReferralCode =>
      'Digite o código de convite se você tiver um';

  @override
  String get authSignupButtonPasteCode => 'Colar';

  @override
  String get authSignupTosConsent =>
      'Ao continuar, você concorda com os Termos de Serviço e Política de Privacidade';

  @override
  String get authSignupTermsShort => 'Termos de Serviço';

  @override
  String get authSignupPrivacyShort => 'Política de Privacidade';

  @override
  String get authSignupTosRequired => 'Obrigatório para criar a conta';

  @override
  String get authSignupButtonCreateAccount => 'Criar Conta';

  @override
  String get authSignupHaveAccountPrompt => 'Já tem uma conta?';

  @override
  String get authSignupLinkSignIn => 'Entrar';

  @override
  String get authPasswordShow => 'Mostrar senha';

  @override
  String get authPasswordHide => 'Ocultar senha';

  @override
  String get authErrorInvalidEmail =>
      'Esse email não é válido. Por favor, verifique e tente novamente.';

  @override
  String get authErrorUserDisabled =>
      'Esta conta foi desativada. Por favor, entre em contato com o suporte.';

  @override
  String get authErrorUserNotFound =>
      'Nenhuma conta encontrada com esse email.';

  @override
  String get authErrorWrongPassword =>
      'Senha incorreta. Por favor, tente novamente.';

  @override
  String get authErrorEmailInUse => 'Já existe uma conta com esse email.';

  @override
  String get authErrorWeakPassword =>
      'Por favor, escolha uma senha mais forte.';

  @override
  String get authErrorNetworkError =>
      'Erro de rede. Por favor, verifique sua conexão.';

  @override
  String get authErrorTooMany =>
      'Muitas tentativas. Por favor, aguarde um momento.';

  @override
  String get authErrorInvalidCredential =>
      'Esses dados não correspondem aos nossos registros.';

  @override
  String get authErrorUnknown => 'Ocorreu um erro. Por favor, tente novamente.';

  @override
  String get navHome => 'Início';

  @override
  String get navTeam => 'Equipe';

  @override
  String get navShare => 'Crescer';

  @override
  String get navMessages => 'Mensagens';

  @override
  String get navNotices => 'Avisos';

  @override
  String get navProfile => 'Perfil';

  @override
  String get dashTitle => 'Back Office';

  @override
  String get dashKpiDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get dashKpiTotalTeam => 'Total de Membros da Equipe';

  @override
  String get dashStatsRefreshed => 'Estatísticas da equipe atualizadas';

  @override
  String dashStatsError(String error) {
    return 'Erro ao atualizar estatísticas: $error';
  }

  @override
  String get dashTileGettingStarted => 'Primeiros Passos';

  @override
  String get dashTileOpportunity => 'Detalhes da Oportunidade';

  @override
  String get dashTileEligibility => 'Seu Status de Elegibilidade';

  @override
  String get dashTileGrowTeam => 'Expanda Sua Equipe';

  @override
  String get dashTileViewTeam => 'Ver Sua Equipe';

  @override
  String get dashTileAiCoach => 'Seu Coach de IA';

  @override
  String get dashTileMessageCenter => 'Central de Mensagens';

  @override
  String get dashTileNotifications => 'Notificações';

  @override
  String get dashTileHowItWorks => 'Como Funciona';

  @override
  String get dashTileFaqs => 'Perguntas Frequentes';

  @override
  String get dashTileProfile => 'Ver Seu Perfil';

  @override
  String get dashTileCreateAccount => 'Criar Nova Conta';

  @override
  String recruitT01FirstTouch(String prospectName, String senderFirst,
      String companyName, String shortLink) {
    return 'Oi $prospectName, sou $senderFirst. Uso app pra ajudar amigos com $companyName. Dá uma olhada? $shortLink';
  }

  @override
  String recruitT01FirstTouchNoName(
      String senderFirst, String companyName, String shortLink) {
    return 'Oi, é o $senderFirst. Estou usando um app para ajudar amigos a começar com $companyName. Dá uma olhada? $shortLink';
  }

  @override
  String recruitT02FollowUpWarm(
      String prospectName, String companyName, String shortLink) {
    return 'Oi $prospectName! Follow-up sobre $companyName. Ótimos resultados essa semana. Tempo pra um papo? $shortLink';
  }

  @override
  String recruitT03DeadlineNudge(
      String prospectName, String companyName, String shortLink) {
    return '$prospectName, vagas preenchendo pro lançamento $companyName. Reservo uma pra você? $shortLink';
  }

  @override
  String recruitT04TeamNeeded(int remaining) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'Você está a # pessoas de um começo forte.',
      one: 'Você está a # pessoa de um começo forte.',
      zero: 'Você está pronto para começar.',
    );
    return '$_temp0';
  }

  @override
  String recruitT05MilestoneReached(String prospectName, String companyName) {
    return '🎉 $prospectName, você alcançou seu primeiro marco com $companyName! Sua equipe está crescendo. Continue assim!';
  }

  @override
  String recruitT06WelcomeOnboard(
      String prospectName, String senderFirst, String inviteLink) {
    return 'Bem-vindo, $prospectName! Sou o $senderFirst e estou aqui para ajudar. Vamos começar: $inviteLink';
  }

  @override
  String recruitT07WeeklyCheckIn(String prospectName, String companyName) {
    return 'Oi $prospectName, check-in rápido sobre $companyName. Como estão as coisas? Alguma dúvida que eu possa ajudar?';
  }

  @override
  String recruitT08Deadline(int days, String shortLink) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '# dias',
      one: '# dia',
    );
    return 'Começamos em $_temp0. Quer que eu reserve sua vaga? $shortLink';
  }

  @override
  String recruitT09ResourceShare(
      String prospectName, String companyName, String inviteLink) {
    return '$prospectName, achei isso útil para $companyName. Achei que você ia querer ver: $inviteLink';
  }

  @override
  String recruitT10InviteReminder(
      String prospectName, String companyName, String shortLink) {
    return 'Oi $prospectName, você ainda tem um convite esperando para $companyName. Pronto para entrar? $shortLink';
  }

  @override
  String recruitT11TeamGrowth(String prospectName, String companyName) {
    return 'Ótimas notícias, $prospectName! Sua equipe $companyName cresceu essa semana. Você está fazendo um progresso real!';
  }

  @override
  String recruitT12Encouragement(String prospectName, String companyName) {
    return '$prospectName, construir com $companyName leva tempo. Você está indo muito bem. Continue!';
  }

  @override
  String recruitT13TrainingInvite(
      String prospectName, String companyName, String inviteLink) {
    return 'Oi $prospectName, treinamento $companyName chegando. Quer participar? $inviteLink';
  }

  @override
  String recruitT14QuickWin(String prospectName, String companyName) {
    return 'Bom trabalho, $prospectName! Foi uma vitória sólida com $companyName. Vamos manter o ritmo!';
  }

  @override
  String recruitT15SupportOffer(String prospectName, String companyName) {
    return 'Oi $prospectName, estou aqui se você precisar de ajuda com $companyName. É só me chamar quando quiser.';
  }

  @override
  String recruitT16Gratitude(String prospectName, String companyName) {
    return 'Obrigado por fazer parte da nossa equipe $companyName, $prospectName. Sua energia faz diferença!';
  }

  @override
  String get notifMilestoneDirectTitle => '🎉 Progresso Incrível!';

  @override
  String notifMilestoneDirectBody(
      String firstName, int directCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'membros',
      one: 'membro',
    );
    return 'Parabéns, $firstName! Você alcançou $directCount patrocinadores diretos! Só mais $remaining $_temp0 da equipe para desbloquear seu convite $bizName. Continue construindo!';
  }

  @override
  String get notifMilestoneTeamTitle => '🚀 Crescimento Incrível!';

  @override
  String notifMilestoneTeamBody(
      String firstName, int teamCount, int remaining, String bizName) {
    String _temp0 = intl.Intl.pluralLogic(
      remaining,
      locale: localeName,
      other: 'patrocinadores diretos',
      one: 'patrocinador direto',
    );
    return 'Progresso incrível, $firstName! Você construiu uma equipe de $teamCount! Só mais $remaining $_temp0 para se qualificar para $bizName. Você está tão perto!';
  }

  @override
  String get notifSubActiveTitle => '✅ Assinatura Ativa';

  @override
  String notifSubActiveBody(String expiryDate) {
    return 'Sua assinatura está ativa até $expiryDate.';
  }

  @override
  String get notifSubCancelledTitle => '⚠️ Assinatura Cancelada';

  @override
  String notifSubCancelledBody(String expiryDate) {
    return 'Sua assinatura foi cancelada, mas permanece ativa até $expiryDate.';
  }

  @override
  String get notifSubExpiredTitle => '❌ Assinatura Expirada';

  @override
  String get notifSubExpiredBody =>
      'Sua assinatura expirou. Renove agora para continuar construindo sua equipe e acessando todas as ferramentas de recrutamento.';

  @override
  String get notifSubExpiringSoonTitle => '⏰ Assinatura Expirando em Breve';

  @override
  String notifSubExpiringSoonBody(String expiryDate) {
    return 'Sua assinatura expira em $expiryDate. Renove agora para evitar interrupção.';
  }

  @override
  String get notifSubPausedTitle => '⏸️ Assinatura Pausada';

  @override
  String get notifSubPausedBody =>
      'Sua assinatura foi pausada. Retome na Play Store para restaurar o acesso a todos os recursos.';

  @override
  String get notifSubPaymentIssueTitle => '⚠️ Problema no Pagamento';

  @override
  String get notifSubPaymentIssueBody =>
      'Sua assinatura está suspensa devido a um problema no pagamento. Por favor, atualize seu método de pagamento na Play Store.';

  @override
  String notifNewMessageTitle(String senderName) {
    return 'Nova Mensagem de $senderName';
  }

  @override
  String get notifTeamActivityTitle => '👀 Atividade de Membro da Equipe';

  @override
  String notifTeamActivityBody(String visitorName) {
    return '$visitorName visitou a página da oportunidade de negócio!';
  }

  @override
  String get notifLaunchSentTitle => 'Campanha de Lançamento Enviada';

  @override
  String get notifLaunchSentBody =>
      'Sua campanha de lançamento foi enviada com sucesso para sua rede.';

  @override
  String get emptyNotifications => 'Nenhuma notificação ainda.';

  @override
  String get emptyMessageContent => 'Sem conteúdo de mensagem.';

  @override
  String get emptyNotificationTitle => 'Sem Título';

  @override
  String get emptyMessageThreads => 'Nenhuma conversa encontrada.';

  @override
  String get emptyTeamMember => 'Membro da equipe não encontrado.';

  @override
  String get errorLoadingNotifications => 'Erro ao carregar notificações';

  @override
  String errorGeneric(String error) {
    return 'Erro: $error';
  }

  @override
  String get dashKpiTitle => 'Estatísticas Atuais da Equipe';

  @override
  String get dashKpiRefreshTooltip => 'Atualizar estatísticas';

  @override
  String get dashTileJoinOpportunity => 'Participe da Oportunidade!';

  @override
  String dashSubscriptionTrial(int daysLeft) {
    return 'Iniciar Assinatura\n($daysLeft dias restantes no teste)';
  }

  @override
  String get dashSubscriptionExpired =>
      'Renovar Sua Assinatura\nTeste grátis de 30 dias expirou.';

  @override
  String get dashSubscriptionCancelled =>
      'Você Cancelou Sua Assinatura\nReative Sua Assinatura Agora';

  @override
  String get dashSubscriptionManage => 'Gerenciar Assinatura';

  @override
  String get networkTitle => 'Sua Equipe Global';

  @override
  String get networkLabelDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get networkLabelTotalTeam => 'Equipe Total';

  @override
  String get networkLabelNewMembers => 'Novos Membros';

  @override
  String get networkSearchHint => 'Buscar membros da equipe...';

  @override
  String get networkRefreshTooltip => 'Forçar atualização';

  @override
  String get networkFilterSelectReport => 'Ver Relatório da Equipe';

  @override
  String get networkFilterAllMembers => 'Todos os Membros';

  @override
  String get networkFilterDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get networkFilterNewMembers => 'Novos Membros - Hoje';

  @override
  String get networkFilterNewMembersYesterday => 'Novos Membros - Ontem';

  @override
  String get networkFilterQualified => 'Membros Qualificados';

  @override
  String get networkFilterJoined => 'Entrou';

  @override
  String networkFilterAllMembersWithCount(int count) {
    return 'Todos os Membros ($count)';
  }

  @override
  String networkFilterDirectSponsorsWithCount(int count) {
    return 'Patrocinadores Diretos ($count)';
  }

  @override
  String networkFilterNewMembersWithCount(int count) {
    return 'Novos Membros - Hoje ($count)';
  }

  @override
  String networkFilterNewMembersYesterdayWithCount(int count) {
    return 'Novos Membros - Ontem ($count)';
  }

  @override
  String networkFilterQualifiedWithCount(int count) {
    return 'Membros Qualificados ($count)';
  }

  @override
  String networkFilterJoinedWithCount(String business, int count) {
    return 'Entrou em $business ($count)';
  }

  @override
  String get networkMessageSelectReport =>
      'Selecione um relatório no menu acima ou use a barra de busca para visualizar e gerenciar sua equipe.';

  @override
  String get networkMessageNoSearchResults =>
      'Mostrando resultados de busca de Todos os Membros. Nenhum membro corresponde à sua busca.';

  @override
  String get networkMessageNoMembers =>
      'Nenhum membro encontrado para este filtro.';

  @override
  String get networkSearchingContext => 'Buscando em: Todos os Membros';

  @override
  String get networkSearchingContextInfo =>
      'Mostrando resultados de busca de Todos os Membros';

  @override
  String networkPaginationInfo(int showing, int total) {
    return 'Mostrando $showing de $total membros';
  }

  @override
  String networkLevelLabel(int level) {
    return 'Nível $level';
  }

  @override
  String networkMembersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count Membros',
      one: '$count Membro',
    );
    return '$_temp0';
  }

  @override
  String get networkLoadingMore => 'Carregando mais membros...';

  @override
  String networkLoadMoreButton(int remaining) {
    return 'Carregar Mais ($remaining)';
  }

  @override
  String networkAllMembersLoaded(int count) {
    return 'Todos os $count membros carregados';
  }

  @override
  String networkMemberJoined(String date) {
    return 'Entrou em $date';
  }

  @override
  String get networkAnalyticsPerformance => 'Desempenho da Rede';

  @override
  String get networkAnalyticsGeographic => 'Distribuição Geográfica';

  @override
  String get networkAnalyticsLevels => 'Distribuição por Nível';

  @override
  String get networkAnalyticsChartPlaceholder =>
      'Gráfico de Desempenho\n(Implementação do gráfico seria aqui)';

  @override
  String networkLevelBadge(int level) {
    return 'Nível $level';
  }

  @override
  String networkLevelMembersCount(int count) {
    return '$count membros';
  }

  @override
  String get settingsTitle => 'Configurações';

  @override
  String get settingsTitleOrganization => 'Configurações da Organização';

  @override
  String settingsWelcomeMessage(String name) {
    return 'Bem-vindo, $name!\n\nVamos configurar a base da sua oportunidade de negócio.';
  }

  @override
  String get settingsLabelOrganizationName => 'Nome da Sua Organização';

  @override
  String get settingsLabelConfirmOrganizationName =>
      'Confirmar Nome da Organização';

  @override
  String get settingsDialogImportantTitle => 'Muito Importante!';

  @override
  String settingsDialogReferralImportance(String organization) {
    return 'Você deve inserir o link de indicação exato que recebeu do seu patrocinador $organization.';
  }

  @override
  String get settingsDialogButtonUnderstand => 'Entendi';

  @override
  String get settingsLabelReferralLink => 'Seu Link de Indicação';

  @override
  String get settingsLabelConfirmReferralLink =>
      'Confirmar URL do Link de Indicação';

  @override
  String get settingsLabelCountries => 'Países Disponíveis';

  @override
  String get settingsImportantLabel => 'Importante:';

  @override
  String get settingsCountriesInstruction =>
      'Selecione apenas os países onde sua oportunidade está disponível atualmente.';

  @override
  String get settingsButtonAddCountry => 'Adicionar um País';

  @override
  String get settingsButtonSave => 'Salvar Configurações';

  @override
  String get settingsDisplayOrganization => 'Sua Organização';

  @override
  String get settingsDisplayReferralLink => 'Seu Link de Indicação';

  @override
  String get settingsDisplayCountries => 'Países Disponíveis Selecionados';

  @override
  String get settingsNoCountries => 'Nenhum país selecionado.';

  @override
  String get settingsFeederSystemTitle => 'Sistema de Rede de Alimentação';

  @override
  String get settingsFeederSystemDescription =>
      'Este é seu motor de crescimento automatizado. Quando membros entram no Team Build Pro através do seu link, mas ainda não se qualificaram para sua oportunidade de negócio, eles são colocados na sua rede de alimentação. No momento em que você atender aos requisitos de elegibilidade abaixo, esses membros são transferidos automaticamente para sua equipe da oportunidade de negócio. É um sistema poderoso que recompensa sua dedicação - quanto maior sua rede de alimentação crescer, mais forte será seu lançamento quando você se qualificar.';

  @override
  String get settingsEligibilityTitle => 'Requisitos Mínimos de Elegibilidade';

  @override
  String get settingsEligibilityDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get settingsEligibilityTotalTeam => 'Total de Membros';

  @override
  String get settingsPrivacyLegalTitle => 'Privacidade e Legal';

  @override
  String get settingsPrivacyPolicy => 'Política de Privacidade';

  @override
  String get settingsPrivacyPolicySubtitle =>
      'Veja nossas práticas de privacidade e tratamento de dados';

  @override
  String get settingsTermsOfService => 'Termos de Serviço';

  @override
  String get settingsTermsOfServiceSubtitle =>
      'Veja os termos e condições da plataforma';

  @override
  String get profileTitle => 'Perfil';

  @override
  String get profileLabelCity => 'Cidade';

  @override
  String get profileLabelState => 'Estado';

  @override
  String get profileLabelCountry => 'País';

  @override
  String get profileLabelJoined => 'Entrou';

  @override
  String get profileLabelSponsor => 'Seu Patrocinador';

  @override
  String get profileLabelTeamLeader => 'Líder de Equipe';

  @override
  String get profileButtonEdit => 'Editar Perfil';

  @override
  String get profileButtonSignOut => 'Sair';

  @override
  String get profileSigningOut => 'Saindo...';

  @override
  String get profileButtonTerms => 'Termos de Serviço';

  @override
  String get profileButtonPrivacy => 'Política de Privacidade';

  @override
  String get profileButtonDeleteAccount => 'Excluir Conta';

  @override
  String get profileDemoAccountTitle => 'Informações da Conta Demo';

  @override
  String get profileDemoAccountMessage =>
      'Esta é uma conta demo para testes e não pode ser excluída.';

  @override
  String get profileDemoAccountSubtext =>
      'Contas demo são fornecidas para demonstrar os recursos e funcionalidades do app. Se você precisa criar uma conta real, faça o cadastro com suas informações pessoais.';

  @override
  String get profileDemoAccountButton => 'Entendi';

  @override
  String get profileAdminProtectionTitle =>
      'Proteção de Conta de Administrador';

  @override
  String get profileAdminProtectionMessage =>
      'Contas de administrador com membros de equipe ativos não podem ser excluídas através do app. Esta proteção garante que os dados e relacionamentos da sua equipe permaneçam intactos.';

  @override
  String profileAdminTeamSize(int directCount) {
    return 'Sua Equipe: $directCount Patrocinadores Diretos';
  }

  @override
  String get profileAdminProtectionInstructions =>
      'Para excluir sua conta de administrador, entre em contato com nossa equipe de suporte em legal@teambuildpro.com. Trabalharemos com você para garantir uma transição suave para os membros da sua equipe.';

  @override
  String get profileAdminProtectionContact => 'Contato: legal@teambuildpro.com';

  @override
  String get messageCenterTitle => 'Central de Mensagens';

  @override
  String get messageCenterSearchHint => 'Buscar mensagens...';

  @override
  String get messageCenterFilterAll => 'Todas';

  @override
  String get messageCenterFilterUnread => 'Não lidas';

  @override
  String get messageCenterFilterTeam => 'Equipe';

  @override
  String get messageCenterNewThread => 'Nova Mensagem';

  @override
  String get messageCenterEmptyState =>
      'Nenhuma mensagem ainda. Inicie uma conversa com os membros da sua equipe!';

  @override
  String get messageCenterNotLoggedIn =>
      'Por favor, faça login para ver mensagens.';

  @override
  String get messageCenterSponsorLabel => 'Seu Patrocinador';

  @override
  String get messageCenterTeamLeaderLabel => 'Líder da Equipe';

  @override
  String get messageCenterSupportTeamTitle => 'Sua Equipe de Suporte';

  @override
  String get messageCenterSupportTeamSubtitle =>
      'Toque para iniciar uma conversa';

  @override
  String get messageCenterError => 'Erro ao carregar mensagens';

  @override
  String get messageCenterLoadingChat => 'Carregando chat...';

  @override
  String get messageCenterErrorLoadingUser =>
      'Erro ao carregar detalhes do usuário';

  @override
  String get messageCenterUnknownUser => 'Usuário Desconhecido';

  @override
  String messageCenterUnreadBadge(int count) {
    return '$count nova(s)';
  }

  @override
  String messageCenterLastMessage(String time) {
    return 'Última mensagem há $time';
  }

  @override
  String get notificationsTitle => 'Notificações';

  @override
  String get notificationsFilterAll => 'Todas';

  @override
  String get notificationsFilterUnread => 'Não lidas';

  @override
  String get notificationsFilterMilestones => 'Marcos';

  @override
  String get notificationsFilterTeam => 'Equipe';

  @override
  String get notificationsMarkAllRead => 'Marcar Todas Lidas';

  @override
  String get notificationsClearAll => 'Limpar Todas';

  @override
  String get notificationsEmptyState =>
      'Nenhuma notificação ainda. Avisaremos sobre atualizações importantes da equipe!';

  @override
  String get notificationsTimeNow => 'Agora';

  @override
  String notificationsTimeMinutes(int minutes) {
    return 'há ${minutes}m';
  }

  @override
  String notificationsTimeHours(int hours) {
    return 'há ${hours}h';
  }

  @override
  String notificationsTimeDays(int days) {
    return 'há ${days}d';
  }

  @override
  String get gettingStartedTitle => 'Primeiros Passos';

  @override
  String get gettingStartedWelcome => 'Bem-vindo ao Team Build Pro!';

  @override
  String get gettingStartedIntro =>
      'Vamos preparar você para o sucesso. Este guia rápido apresentará os recursos essenciais para começar a construir sua equipe.';

  @override
  String get gettingStartedStep1Title => 'Faça sua lista';

  @override
  String get gettingStartedStep2Title => 'Compartilhe com sua rede';

  @override
  String get gettingStartedStep3Title =>
      'Dê boas-vindas aos seus novos membros da equipe';

  @override
  String get gettingStartedStep3Description =>
      'Quando você receber uma notificação de novo membro da equipe, faça um acompanhamento imediato para dar boas-vindas à sua equipe. As primeiras impressões importam!';

  @override
  String get gettingStartedStep4Title => 'Engaje Sua Equipe';

  @override
  String get gettingStartedStep4Description =>
      'Use a central de mensagens para se comunicar com sua equipe e fornecer suporte.';

  @override
  String get gettingStartedButtonStart => 'Começar';

  @override
  String get gettingStartedButtonNext => 'Próximo';

  @override
  String get gettingStartedButtonBack => 'Voltar';

  @override
  String get gettingStartedButtonSkip => 'Pular';

  @override
  String get welcomeTitle => 'Boas-vindas';

  @override
  String get welcomeHeadline => 'Construa Sua Equipe.\nCresça Seu Negócio.';

  @override
  String get welcomeSubheadline =>
      'A plataforma profissional para construção de equipes e crescimento de rede.';

  @override
  String get welcomeButtonSignIn => 'Entrar';

  @override
  String get welcomeButtonSignUp => 'Criar Conta';

  @override
  String get welcomeFeature1Title => 'Rastreamento Inteligente';

  @override
  String get welcomeFeature1Description =>
      'Monitore o crescimento da sua equipe em tempo real com análises poderosas.';

  @override
  String get welcomeFeature2Title => 'Crescimento Automatizado';

  @override
  String get welcomeFeature2Description =>
      'Sistema de rede de alimentação transfere automaticamente membros qualificados para sua equipe.';

  @override
  String get welcomeFeature3Title => 'Mensagens Seguras';

  @override
  String get welcomeFeature3Description =>
      'Comunique-se com segurança com sua equipe através de mensagens criptografadas.';

  @override
  String get addLinkTitle => 'Adicionar link';

  @override
  String get addLinkDescription =>
      'Adicione seu link de oportunidade de negócio para começar a construir sua equipe.';

  @override
  String get addLinkLabelUrl => 'URL da Oportunidade de Negócio';

  @override
  String get addLinkHintUrl =>
      'Digite a URL completa da sua página de oportunidade de negócio';

  @override
  String get addLinkUrlRequired => 'Por favor, digite uma URL';

  @override
  String get addLinkUrlInvalid => 'Por favor, digite uma URL válida';

  @override
  String get addLinkButtonSave => 'Salvar Link';

  @override
  String get addLinkButtonTest => 'Testar Link';

  @override
  String get addLinkSuccessMessage => 'Link de negócio salvo com sucesso!';

  @override
  String get addLinkErrorMessage =>
      'Erro ao salvar link. Por favor, tente novamente.';

  @override
  String get businessTitle => 'Oportunidade de Negócio';

  @override
  String get businessLoadingMessage => 'Carregando detalhes da oportunidade...';

  @override
  String get businessErrorMessage =>
      'Não foi possível carregar detalhes da oportunidade';

  @override
  String get businessButtonJoin => 'Participar Agora';

  @override
  String get businessButtonLearnMore => 'Saiba Mais';

  @override
  String get businessButtonContact => 'Contatar Patrocinador';

  @override
  String get changePasswordTitle => 'Alterar Senha';

  @override
  String get changePasswordLabelCurrent => 'Senha Atual';

  @override
  String get changePasswordHintCurrent => 'Digite sua senha atual';

  @override
  String get changePasswordCurrentRequired =>
      'Por favor, digite sua senha atual';

  @override
  String get changePasswordLabelNew => 'Nova Senha';

  @override
  String get changePasswordHintNew => 'Digite sua nova senha';

  @override
  String get changePasswordNewRequired => 'Por favor, digite uma nova senha';

  @override
  String get changePasswordLabelConfirm => 'Confirmar Nova Senha';

  @override
  String get changePasswordHintConfirm => 'Digite sua nova senha novamente';

  @override
  String get changePasswordConfirmRequired =>
      'Por favor, confirme sua nova senha';

  @override
  String get changePasswordMismatch => 'As novas senhas não coincidem';

  @override
  String get changePasswordButtonUpdate => 'Atualizar Senha';

  @override
  String get changePasswordSuccessMessage => 'Senha atualizada com sucesso!';

  @override
  String get changePasswordErrorMessage =>
      'Erro ao atualizar senha. Por favor, tente novamente.';

  @override
  String get chatTitle => 'Chat';

  @override
  String get chatInputHint => 'Digite uma mensagem...';

  @override
  String get chatButtonSend => 'Enviar';

  @override
  String get chatEmptyState => 'Nenhuma mensagem ainda. Inicie a conversa!';

  @override
  String get chatMessageDeleted => 'Esta mensagem foi excluída';

  @override
  String get chatMessageEdited => 'editada';

  @override
  String chatTypingIndicator(String name) {
    return '$name está digitando...';
  }

  @override
  String get chatbotTitle => 'Coach de IA';

  @override
  String get chatbotWelcome =>
      'Oi! Sou seu coach de IA. Como posso ajudá-lo a expandir sua equipe hoje?';

  @override
  String get chatbotInputHint =>
      'Pergunte-me qualquer coisa sobre construção de equipe...';

  @override
  String get chatbotSuggestion1 => 'Como recrutar de forma mais eficaz?';

  @override
  String get chatbotSuggestion2 => 'Quais são os requisitos de elegibilidade?';

  @override
  String get chatbotSuggestion3 => 'Como funciona o sistema de alimentação?';

  @override
  String get chatbotThinking => 'Pensando...';

  @override
  String get companyTitle => 'Informações da Empresa';

  @override
  String get companyAboutHeading => 'Sobre o Team Build Pro';

  @override
  String get companyAboutText =>
      'Team Build Pro é uma plataforma SaaS profissional projetada para construção de equipes e crescimento de rede. Fornecemos as ferramentas e tecnologia para ajudá-lo a construir e gerenciar sua equipe profissional de forma eficaz.';

  @override
  String get companyVersionLabel => 'Versão do App';

  @override
  String get companyContactHeading => 'Fale Conosco';

  @override
  String get companyContactEmail => 'support@teambuildpro.com';

  @override
  String get companyContactWebsite => 'www.teambuildpro.com';

  @override
  String get deleteAccountTitle => 'Excluir Conta';

  @override
  String get deleteAccountWarning =>
      'Atenção: Esta ação não pode ser desfeita!';

  @override
  String get deleteAccountDescription =>
      'Excluir sua conta removerá permanentemente todos os seus dados, incluindo seu perfil, informações da equipe e histórico de mensagens. Esta ação é irreversível.';

  @override
  String get deleteAccountConfirmPrompt =>
      'Para confirmar a exclusão, digite EXCLUIR abaixo:';

  @override
  String get deleteAccountConfirmHint => 'Digite seu endereço de e-mail';

  @override
  String get deleteAccountConfirmMismatch =>
      'Por favor, digite EXCLUIR exatamente como mostrado';

  @override
  String get deleteAccountButtonDelete => 'Excluir conta';

  @override
  String get deleteAccountButtonCancel => 'Cancelar';

  @override
  String get deleteAccountSuccessMessage =>
      'Conta excluída com sucesso. Obrigado por usar o Team Build Pro.';

  @override
  String get deleteAccountErrorMessage =>
      'Erro ao excluir conta. Entre em contato com o suporte.';

  @override
  String get editProfileTitle => 'Editar Perfil';

  @override
  String get editProfileLabelFirstName => 'Nome';

  @override
  String get editProfileLabelLastName => 'Sobrenome';

  @override
  String get editProfileLabelEmail => 'Email';

  @override
  String get editProfileLabelPhone => 'Número de Telefone';

  @override
  String get editProfileLabelCity => 'Cidade';

  @override
  String get editProfileLabelState => 'Estado/Província';

  @override
  String get editProfileLabelCountry => 'País';

  @override
  String get editProfileLabelBio => 'Biografia';

  @override
  String get editProfileHintBio => 'Conte à sua equipe sobre você...';

  @override
  String get editProfileButtonSave => 'Salvar Alterações';

  @override
  String get editProfileButtonCancel => 'Cancelar';

  @override
  String get editProfileButtonChangePhoto => 'Alterar Foto';

  @override
  String get editProfileSuccessMessage => 'Perfil atualizado com sucesso!';

  @override
  String get editProfileErrorMessage =>
      'Erro ao atualizar perfil. Por favor, tente novamente.';

  @override
  String get eligibilityTitle => 'Status de Elegibilidade';

  @override
  String get eligibilityCurrentStatus => 'Status Atual';

  @override
  String get eligibilityStatusQualified => 'Qualificado!';

  @override
  String get eligibilityStatusNotQualified => 'Ainda Não Qualificado';

  @override
  String get eligibilityRequirementsHeading => 'Requisitos';

  @override
  String get eligibilityDirectSponsorsLabel => 'Patrocinadores Diretos';

  @override
  String eligibilityDirectSponsorsProgress(int current, int required) {
    return '$current de $required necessários';
  }

  @override
  String get eligibilityTotalTeamLabel => 'Total de Membros da Equipe';

  @override
  String eligibilityTotalTeamProgress(int current, int required) {
    return '$current de $required necessários';
  }

  @override
  String eligibilityProgressBar(int percent) {
    return 'Progresso: $percent%';
  }

  @override
  String get eligibilityNextSteps => 'Próximos Passos';

  @override
  String get eligibilityNextStepsDescription =>
      'Continue compartilhando seu link de indicação para expandir sua equipe e atender aos requisitos!';

  @override
  String get shareTitle => 'Crescer';

  @override
  String get shareYourLinkHeading => 'Seu Link de Indicação';

  @override
  String get shareButtonCopyLink => 'Copiar Link';

  @override
  String get shareLinkCopied => 'Link copiado para a área de transferência!';

  @override
  String get shareButtonSms => 'Compartilhar por SMS';

  @override
  String get shareButtonEmail => 'Compartilhar por Email';

  @override
  String get shareButtonWhatsApp => 'Compartilhar por WhatsApp';

  @override
  String get shareButtonMore => 'Mais Opções';

  @override
  String shareMessageTemplate(String link) {
    return 'Oi! Estou construindo minha equipe com Team Build Pro. Junte-se a mim: $link';
  }

  @override
  String get shareStatsHeading => 'Seu Impacto ao Compartilhar';

  @override
  String get shareStatsViews => 'Visualizações do Link';

  @override
  String get shareStatsSignups => 'Cadastros';

  @override
  String get shareStatsConversion => 'Taxa de Conversão';

  @override
  String get memberDetailTitle => 'Detalhes do Membro';

  @override
  String get memberDetailLabelName => 'Nome';

  @override
  String get memberDetailLabelEmail => 'Email';

  @override
  String get memberDetailLabelPhone => 'Telefone';

  @override
  String get memberDetailLabelLocation => 'Localização';

  @override
  String get memberDetailLabelJoined => 'Entrou';

  @override
  String get memberDetailLabelSponsor => 'Patrocinador';

  @override
  String get memberDetailLabelLevel => 'Nível';

  @override
  String get memberDetailTeamStats => 'Estatísticas da Equipe';

  @override
  String memberDetailDirectSponsors(int count) {
    return 'Patrocinadores Diretos: $count';
  }

  @override
  String memberDetailTotalTeam(int count) {
    return 'Equipe Total: $count';
  }

  @override
  String get memberDetailButtonMessage => 'Enviar Mensagem';

  @override
  String get memberDetailButtonViewTeam => 'Ver Equipe Deles';

  @override
  String get messageThreadTitle => 'Mensagens';

  @override
  String get messageThreadInputHint => 'Digite sua mensagem...';

  @override
  String get messageThreadButtonSend => 'Enviar';

  @override
  String get messageThreadEmptyState =>
      'Nenhuma mensagem ainda. Inicie a conversa!';

  @override
  String get messageThreadDelivered => 'Entregue';

  @override
  String get messageThreadRead => 'Lida';

  @override
  String get messageThreadSending => 'Enviando...';

  @override
  String get messageThreadFailed => 'Falha ao enviar';

  @override
  String get loginTitle => 'Entrar';

  @override
  String get loginButtonGoogle => 'Continuar com Google';

  @override
  String get loginButtonApple => 'Continuar com Apple';

  @override
  String get loginDivider => 'ou';

  @override
  String get loginForgotPassword => 'Esqueceu a Senha?';

  @override
  String get loginResetPasswordTitle => 'Redefinir Senha';

  @override
  String get loginResetPasswordDescription =>
      'Digite seu endereço de email e enviaremos um link para redefinir sua senha.';

  @override
  String get loginResetPasswordButton => 'Enviar Link';

  @override
  String get loginResetPasswordSuccess =>
      'Email de redefinição enviado! Verifique sua caixa de entrada.';

  @override
  String get loginResetPasswordError =>
      'Erro ao enviar email. Por favor, tente novamente.';

  @override
  String get commonButtonCancel => 'Cancelar';

  @override
  String get commonButtonSave => 'Salvar';

  @override
  String get commonButtonDelete => 'Excluir';

  @override
  String get commonButtonEdit => 'Editar';

  @override
  String get commonButtonClose => 'Fechar';

  @override
  String get commonButtonOk => 'OK';

  @override
  String get commonButtonYes => 'Sim';

  @override
  String get commonButtonNo => 'Não';

  @override
  String get commonLoading => 'Carregando...';

  @override
  String get commonLoadingMessage => 'Carregando...';

  @override
  String get commonErrorMessage =>
      'Algo deu errado. Por favor, tente novamente.';

  @override
  String get commonSuccessMessage => 'Sucesso!';

  @override
  String get commonNoDataMessage => 'Nenhum dado disponível';

  @override
  String get commonRetryButton => 'Tentar Novamente';

  @override
  String get commonRefreshButton => 'Atualizar';

  @override
  String get authSignupErrorFirstName => 'O primeiro nome não pode estar vazio';

  @override
  String get authSignupErrorLastName => 'O sobrenome não pode estar vazio';

  @override
  String addLinkHeading(String business) {
    return 'Adicione seu link de\n$business';
  }

  @override
  String get addLinkImportantLabel => 'INFORMAÇÕES IMPORTANTES';

  @override
  String addLinkDisclaimer(String business) {
    return 'Você está atualizando sua conta do Team Build Pro para rastrear referências para $business. Esta é uma entidade comercial separada e independente que NÃO é de propriedade, operada ou afiliada ao Team Build Pro.';
  }

  @override
  String get addLinkGrowthTitle => 'Desbloqueando seu motor de crescimento';

  @override
  String get addLinkInstructionBullet1 =>
      'Seu link de referência será armazenado no seu perfil do Team Build Pro apenas para fins de rastreamento.';

  @override
  String addLinkInstructionBullet2(String business) {
    return 'Quando seus membros da equipe qualificarem e se juntarem à oportunidade $business, eles serão automaticamente colocados em sua equipe oficial';
  }

  @override
  String get addLinkInstructionBullet3 =>
      'Este link só pode ser definido uma vez, portanto, verifique se está correto antes de salvar.';

  @override
  String get addLinkWarning =>
      'O Team Build Pro é apenas uma plataforma de rastreamento de referências. Não endossamos nem garantimos nenhuma oportunidade de negócio.';

  @override
  String get addLinkFinalStepTitle => 'Etapa final: Vincule sua conta';

  @override
  String addLinkFinalStepSubtitle(String business) {
    return 'Isso garante que seus novos membros da equipe sejam automaticamente colocados em sua organização $business.';
  }

  @override
  String addLinkFieldInstruction(String business) {
    return 'Digite seu link de referência $business abaixo. Ele será usado para rastrear referências de sua equipe.';
  }

  @override
  String addLinkMustBeginWith(String baseUrl) {
    return 'Deve começar com:\n$baseUrl';
  }

  @override
  String get addLinkFieldLabel => 'Digite seu link de referência';

  @override
  String addLinkFieldHelper(String baseUrl) {
    return 'Deve começar com $baseUrl\nIsso não pode ser alterado depois de definido';
  }

  @override
  String addLinkFieldError(String business) {
    return 'Por favor, digite seu link de referência $business.';
  }

  @override
  String get addLinkConfirmFieldLabel => 'Confirmar URL do link de referência';

  @override
  String get addLinkConfirmFieldError =>
      'Por favor, confirme seu link de referência.';

  @override
  String get addLinkPreviewLabel => 'Visualização do link de referência:';

  @override
  String get addLinkSaving => 'Validando e salvando...';

  @override
  String get addLinkDialogImportantTitle => 'Muito importante!';

  @override
  String addLinkDialogImportantMessage(String business) {
    return 'Você deve inserir o link de referência exato que recebeu de $business. Isso garantirá que os membros de sua equipe que se juntarem a $business sejam automaticamente colocados em sua equipe $business.';
  }

  @override
  String get addLinkDialogImportantButton => 'Eu entendo';

  @override
  String get addLinkDialogDuplicateTitle => 'Link de referência já em uso';

  @override
  String addLinkDialogDuplicateMessage(String business) {
    return 'O link de referência $business que você inseriu já está sendo usado por outro membro do Team Build Pro.';
  }

  @override
  String get addLinkDialogDuplicateInfo =>
      'Você deve usar um link de referência diferente para continuar.';

  @override
  String get addLinkDialogDuplicateButton => 'Tentar link diferente';

  @override
  String get businessHeroTitle => 'Parabéns!\nVocê está qualificado!';

  @override
  String businessHeroMessage(String business) {
    return 'Seu trabalho árduo e construção de equipe valeram a pena. Agora você está elegível para se juntar à oportunidade $business.';
  }

  @override
  String get businessDisclaimerTitle => 'Aviso de isenção de responsabilidade';

  @override
  String businessDisclaimerMessage(String business) {
    return 'O crescimento de sua equipe desbloqueou o acesso a $business. Esta oportunidade opera como um negócio independente e não tem afiliação com a plataforma Team Build Pro.';
  }

  @override
  String businessDisclaimerInfo(String business) {
    return 'O aplicativo Team Build Pro simplesmente facilita o acesso a $business através de seu patrocinador de upline. Ele não endossa nem garante nenhum resultado específico desta oportunidade.';
  }

  @override
  String get businessSponsorTitle => 'Seu contato de referência';

  @override
  String businessSponsorMessage(String business, String sponsor) {
    return 'Se você escolher explorar $business, seu contato de referência será $sponsor. Esta pessoa é membro de sua equipe upline que já se juntou a $business.';
  }

  @override
  String businessInstructionsTitle(String business) {
    return 'Como se juntar a $business';
  }

  @override
  String businessInstructions(String business) {
    return '1. Copie o link de referência abaixo\n2. Abra seu navegador da web\n3. Cole o link e complete o registro em $business\n4. Retorne aqui para adicionar seu link de referência $business';
  }

  @override
  String get businessNoUrlMessage =>
      'URL de registro não disponível. Entre em contato com seu patrocinador.';

  @override
  String get businessUrlLabel => 'Link de referência do seu patrocinador:';

  @override
  String get businessUrlCopyTooltip => 'Copiar URL';

  @override
  String get businessUrlCopiedMessage =>
      'URL de registro copiada para a área de transferência!';

  @override
  String businessUrlCopyError(String error) {
    return 'Falha ao copiar URL: $error';
  }

  @override
  String get businessFollowUpTitle => 'Etapa final: Vincule sua conta';

  @override
  String businessFollowUpMessage(String business) {
    return 'Depois de explorar $business, você deve retornar aqui e adicionar seu novo link de referência $business ao seu perfil do Team Build Pro. Isso garante que suas conexões de equipe sejam rastreadas corretamente.';
  }

  @override
  String get businessCompleteButton1 => 'Registro completo';

  @override
  String get businessCompleteButton2 => 'Adicionar meu link de referência';

  @override
  String get businessConfirmDialogTitle => 'Antes de continuar';

  @override
  String businessConfirmDialogMessage(String business) {
    return 'Este é o próximo passo em sua jornada. Depois de se juntar a $business através do link de seu patrocinador, você deve retornar aqui para adicionar seu novo link de referência $business ao seu perfil. Esta é uma etapa crítica para garantir que seus novos membros da equipe sejam colocados corretamente.';
  }

  @override
  String get businessConfirmDialogButton => 'Eu entendo';

  @override
  String get businessVisitRequiredTitle => 'Visita necessária primeiro';

  @override
  String businessVisitRequiredMessage(String business) {
    return 'Antes de atualizar seu perfil, você deve primeiro usar o botão \'Copiar link de registro\' nesta página para visitar $business e completar seu registro.';
  }

  @override
  String get businessVisitRequiredButton => 'OK';

  @override
  String get gettingStartedHeading => 'Começando com o Team Build Pro';

  @override
  String get gettingStartedSubheading =>
      'Siga estes passos simples para começar a construir sua equipe';

  @override
  String gettingStartedStep1Description(String business) {
    return 'Crie uma lista de prospects de recrutamento e membros atuais da equipe $business com quem você deseja compartilhar o Team Build Pro. Pense em quem poderia se beneficiar desta ferramenta para acelerar a construção de sua equipe.';
  }

  @override
  String gettingStartedStep2Description(String business) {
    return 'Use o recurso Compartilhar para enviar rapidamente e facilmente mensagens de texto e e-mails direcionados para seus prospects de recrutamento e membros da equipe $business.';
  }

  @override
  String get gettingStartedStep2Button => 'Abrir compartilhar';

  @override
  String get gettingStartedProTipTitle => 'Dica profissional';

  @override
  String get gettingStartedProTipMessage =>
      'O acompanhamento consistente e o engajamento são fundamentais para construir uma equipe forte e ativa.';

  @override
  String get gettingStartedProspectStep1Description =>
      'Crie uma lista de amigos, familiares e contatos que possam estar interessados em criar renda residual. Seu objetivo é recrutar 3 patrocinadores diretos e crescer sua equipe total para 12 membros.';

  @override
  String get gettingStartedProspectStep2Description =>
      'Use o recurso Compartilhar para convidar seus contatos a se juntarem à sua equipe. Cada pessoa que entrar através do seu link te aproxima da sua meta de 3 patrocinadores diretos + 12 membros totais da equipe.';

  @override
  String get eligibilityHeroTitleQualified =>
      'PARABÉNS!\nVocê está qualificado!';

  @override
  String get eligibilityHeroTitleNotQualified => 'Construa seu impulso';

  @override
  String eligibilityHeroMessageQualified(String business) {
    return 'Trabalho incrível! Você construiu sua equipe fundamental e desbloqueou a oportunidade $business. Continue crescendo sua rede para ajudar outros a alcançar o mesmo sucesso.';
  }

  @override
  String eligibilityHeroMessageNotQualified(String business) {
    return 'Você está no caminho! Cada profissional com quem você se conecta constrói impulso para seu futuro lançamento na oportunidade $business. Continue compartilhando para alcançar seus objetivos!';
  }

  @override
  String get eligibilityHeroButton => 'Estratégias de Crescimento Provadas';

  @override
  String get eligibilityThresholdsTitle => 'LIMIARES DE QUALIFICAÇÃO';

  @override
  String get eligibilityLabelDirectSponsors => 'Patrocinadores diretos';

  @override
  String get eligibilityLabelTotalTeam => 'Equipe total';

  @override
  String get eligibilityCurrentCountsTitle => 'SUAS CONTAGENS ATUAIS DA EQUIPE';

  @override
  String get eligibilityCurrentDirectSponsors => 'Patrocinadores diretos';

  @override
  String get eligibilityCurrentTotalTeam => 'Equipe total';

  @override
  String get eligibilityProcessTitle => 'O PROCESSO';

  @override
  String get eligibilityProcessStep1Title => 'CONVIDAR - Construa sua fundação';

  @override
  String eligibilityProcessStep1Description(String business) {
    return 'Conecte-se com profissionais com ideias semelhantes abertos a explorar $business.';
  }

  @override
  String get eligibilityProcessStep2Title => 'CULTIVAR - Crie impulso';

  @override
  String get eligibilityProcessStep2Description =>
      'Promova relacionamentos autênticos à medida que sua equipe cresce, criando uma equipe próspera de profissionais que se apoiam mutuamente no sucesso.';

  @override
  String get eligibilityProcessStep3Title => 'PARCERIA - Lance com sucesso';

  @override
  String eligibilityProcessStep3Description(String business) {
    return 'Os membros da equipe recebem um convite para se juntar a $business ao atingir metas de crescimento importantes.';
  }

  @override
  String get shareHeading => 'Sistema de referência poderoso';

  @override
  String get shareSubheading =>
      'Compartilhe seus links de referência para pré-construir uma nova equipe com prospects de recrutamento ou expandir sua equipe existente.';

  @override
  String get shareStrategiesTitle => 'Estratégias de crescimento comprovadas';

  @override
  String get shareProspectTitle => 'Construindo Sua Equipe';

  @override
  String get shareProspectHeaderTitle => 'Mensagens Personalizadas';

  @override
  String get shareProspectSubtitle =>
      'Convide prospects de recrutamento para começar com vantagem.';

  @override
  String shareProspectDescription(String business) {
    return 'Convide prospects de recrutamento para pré-construir sua equipe $business com este aplicativo. Eles podem criar um impulso poderoso antes de se juntarem oficialmente a $business, garantindo sucesso desde o primeiro dia.';
  }

  @override
  String get sharePartnerTitle => 'Parceiros da Sua Equipe';

  @override
  String get sharePartnerHeaderTitle => 'Mensagens Personalizadas';

  @override
  String sharePartnerSubtitle(String business) {
    return 'Ótimo para sua equipe $business existente';
  }

  @override
  String sharePartnerDescription(String business) {
    return 'Capacite seus parceiros $business existentes com a mesma ferramenta que você usa. Isso promove a duplicação e ajuda a acelerar o crescimento em toda a sua organização $business.';
  }

  @override
  String get shareSelectMessageLabel => 'Selecionar mensagem para enviar';

  @override
  String get shareButtonShare => 'Compartilhar';

  @override
  String get shareLinkCopiedMessage =>
      'Link copiado para a área de transferência!';

  @override
  String get shareProTipsTitle => 'Dicas profissionais para o sucesso';

  @override
  String get shareProTip1 => '💬 Personalize sua mensagem ao compartilhar';

  @override
  String get shareProTip2 =>
      '📱 Compartilhe consistentemente em todas as plataformas sociais';

  @override
  String get shareProTip3 =>
      '🤝 Faça acompanhamento com prospects que demonstrarem interesse';

  @override
  String get shareProTip4 =>
      '📈 Rastreie seus resultados e ajuste sua abordagem';

  @override
  String get shareProTip5 =>
      '🎯 Use ambas as estratégias para máximo potencial de crescimento';

  @override
  String get shareDemoTitle => 'Modo de demonstração';

  @override
  String get shareDemoMessage =>
      'Compartilhamento desabilitado durante o modo de demonstração.';

  @override
  String get shareDemoButton => 'Eu entendo';

  @override
  String get memberDetailButtonSendMessage => 'Enviar mensagem';

  @override
  String get memberDetailLabelDirectSponsors => 'Patrocinadores diretos';

  @override
  String get memberDetailLabelJoinedNetwork => 'Entrou na rede';

  @override
  String memberDetailLabelJoinedOrganization(String bizOpp) {
    return 'Entrou em $bizOpp';
  }

  @override
  String get memberDetailLabelQualified => 'Qualificado';

  @override
  String get memberDetailLabelQualifiedDate => 'Data de qualificação';

  @override
  String get memberDetailLabelTeamLeader => 'Líder da equipe';

  @override
  String get memberDetailLabelTotalTeam => 'Equipe total';

  @override
  String get memberDetailNotYet => 'Ainda não';

  @override
  String get memberDetailNotYetJoined => 'Ainda não entrou';

  @override
  String get memberDetailEligibilityTitle => 'Requisitos de elegibilidade';

  @override
  String get memberDetailEligibilityDirectSponsors => 'Patrocinadores diretos';

  @override
  String get memberDetailEligibilityTotalTeam => 'Equipe total';

  @override
  String memberDetailEligibilityMessage(String organization) {
    return 'Os membros da equipe que atenderem a esses requisitos são automaticamente convidados a se juntar a $organization.';
  }

  @override
  String get memberDetailEligibilityWaived => 'Dispensado';

  @override
  String memberDetailEligibilityWaivedMessage(String organization) {
    return 'Os requisitos de elegibilidade são dispensados para indivíduos que ingressaram em $organization antes de ingressar na Rede.';
  }

  @override
  String get messageThreadHeading => 'Centro de mensagens';

  @override
  String get messageThreadEmptyMessage => 'Comece a conversa!';

  @override
  String get messageThreadUrlWarningTitle => 'Aviso de link externo';

  @override
  String get messageThreadUrlWarningMessage =>
      'Esta mensagem contém um link externo. Tenha cuidado ao clicar em links de fontes desconhecidas.';

  @override
  String get messageThreadUrlWarningButton => 'Entendido';

  @override
  String get chatbotAssistantTitle => 'Assistente de IA';

  @override
  String get chatbotAssistantSubtitle =>
      'Pergunte-me qualquer coisa sobre o Team Build Pro';

  @override
  String get chatbotClearTooltip => 'Limpar conversa';

  @override
  String get chatbotSignInRequired =>
      'Por favor, faça login para usar o Assistente de IA';

  @override
  String get companyHeading => 'Detalhes da empresa';

  @override
  String get companyLabelName => 'Nome da empresa';

  @override
  String get companyLabelReferralLink => 'Meu link de referência da empresa';

  @override
  String get companyLinkedTitle => 'Conta vinculada!';

  @override
  String companyLinkedMessage(String business) {
    return 'Ótimas notícias! À medida que seus membros da equipe ganham impulso e se qualificam, eles receberão um convite para se juntar à sua organização $business.';
  }

  @override
  String get companyNotAvailable => 'Não disponível';

  @override
  String get deleteAccountHeading => 'Exclusão de conta';

  @override
  String get deleteAccountSubheading =>
      'Lamentamos vê-lo partir. Por favor, revise as informações abaixo cuidadosamente.';

  @override
  String get deleteAccountWarningTitle => 'EXCLUSÃO PERMANENTE DE CONTA';

  @override
  String get deleteAccountWarningMessage =>
      'Esta ação não pode ser desfeita. Quando você excluir sua conta:';

  @override
  String get deleteAccountWarning1 =>
      'Seus dados pessoais serão excluídos permanentemente';

  @override
  String get deleteAccountWarning2 =>
      'Você perderá o acesso a todos os recursos premium';

  @override
  String get deleteAccountWarning3 =>
      'Sua conta não pode ser recuperada ou reativada';

  @override
  String get deleteAccountWarning4 =>
      'Seus relacionamentos de rede serão preservados para continuidade dos negócios';

  @override
  String get deleteAccountWarning5 =>
      'Você será desconectado imediatamente de todos os dispositivos';

  @override
  String get deleteAccountInfoTitle => 'Informações da conta';

  @override
  String get deleteAccountConfirmTitle => 'Confirmação necessária';

  @override
  String get deleteAccountConfirmLabel =>
      'Para confirmar a exclusão, digite seu endereço de e-mail:';

  @override
  String get deleteAccountCheckbox1 =>
      'Eu entendo que esta ação é permanente e não pode ser desfeita';

  @override
  String get deleteAccountCheckbox2 =>
      'Eu entendo que perderei o acesso a todos os dados e recursos premium';

  @override
  String get deleteAccountCheckbox3 =>
      'Eu reconheço que meus relacionamentos de rede serão preservados para operações comerciais';

  @override
  String get deleteAccountDeleting => 'Excluindo...';

  @override
  String get deleteAccountHelpTitle => 'Precisa de ajuda?';

  @override
  String get deleteAccountHelpMessage =>
      'Se você estiver enfrentando problemas com o aplicativo, entre em contato com nossa equipe de suporte antes de excluir sua conta.';

  @override
  String get deleteAccountHelpButton => 'Contatar suporte';

  @override
  String get deleteAccountDemoTitle => 'Proteção de conta de demonstração';

  @override
  String get deleteAccountDemoMessage =>
      'Esta é uma conta de demonstração protegida e não pode ser excluída.\n\nAs contas de demonstração são mantidas para revisão de aplicativos e fins de demonstração.\n\nSe você estiver testando o aplicativo, crie uma nova conta para testar os recursos de exclusão de conta.';

  @override
  String get deleteAccountDemoButton => 'OK';

  @override
  String deleteAccountErrorFailed(String error) {
    return 'Falha ao excluir conta: $error';
  }

  @override
  String get deleteAccountErrorEmailMismatch =>
      'O endereço de e-mail que você digitou não corresponde ao e-mail da sua conta. Por favor, verifique e tente novamente.';

  @override
  String get deleteAccountErrorNotFound =>
      'Não conseguimos encontrar sua conta em nosso sistema. Por favor, entre em contato com o suporte para obter assistência.';

  @override
  String get deleteAccountErrorSessionExpired =>
      'Sua sessão expirou. Por favor, saia e faça login novamente, depois tente excluir a conta novamente.';

  @override
  String get deleteAccountErrorPermissionDenied =>
      'Você não tem permissão para excluir esta conta. Por favor, entre em contato com o suporte se precisar de assistência.';

  @override
  String get deleteAccountErrorServerError =>
      'Ocorreu um erro inesperado em nossos servidores. Por favor, tente novamente em alguns minutos ou entre em contato com o suporte.';

  @override
  String get deleteAccountErrorServiceUnavailable =>
      'O serviço está temporariamente indisponível. Por favor, verifique sua conexão com a internet e tente novamente.';

  @override
  String get deleteAccountErrorProcessing =>
      'Encontramos um problema ao processar sua solicitação. Por favor, tente novamente ou entre em contato com o suporte para obter ajuda.';

  @override
  String get deleteAccountErrorUnexpected =>
      'Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato com support@teambuildpro.com para obter assistência.';

  @override
  String get deleteAccountErrorEmailApp =>
      'Não foi possível abrir o aplicativo de e-mail. Por favor, entre em contato com support@teambuildpro.com manualmente.';

  @override
  String get editProfileHeading => 'Editar perfil';

  @override
  String get editProfileHeadingFirstTime => 'Complete seu perfil';

  @override
  String get editProfileInstructionsFirstTime =>
      'Por favor, complete seu perfil para começar';

  @override
  String get editProfileBusinessQuestion => 'Você é atualmente um ';

  @override
  String get editProfileBusinessQuestionSuffix => ' representante?';

  @override
  String get editProfileYes => 'Sim';

  @override
  String get editProfileNo => 'Não';

  @override
  String get editProfileDialogImportantTitle => 'Muito importante!';

  @override
  String editProfileDialogImportantMessage(String business) {
    return 'Você deve inserir o link de referência exato que recebeu de seu patrocinador $business.';
  }

  @override
  String get editProfileDialogImportantButton => 'Eu entendo';

  @override
  String get editProfileReferralLinkField => 'Digite seu link de referência';

  @override
  String get editProfileReferralLinkLabel => 'Seu link de referência';

  @override
  String editProfileReferralLinkHelper(String business) {
    return 'Digite o link de referência de seu patrocinador $business';
  }

  @override
  String get editProfileConfirmReferralLink => 'Confirmar link de referência';

  @override
  String get editProfileSelectCountry => 'Selecione seu país';

  @override
  String get editProfileSelectState => 'Selecione seu estado/província';

  @override
  String get editProfileSelectStateDisabled => 'Primeiro selecione um país';

  @override
  String get editProfileErrorCity => 'Por favor, digite sua cidade';

  @override
  String get editProfileErrorState =>
      'Por favor, selecione seu estado/província';

  @override
  String get editProfileErrorCountry => 'Por favor, selecione seu país';

  @override
  String get editProfilePhotoError =>
      'Erro ao carregar foto. Por favor, tente novamente.';

  @override
  String get editProfileDeletionTitle => 'Excluir conta';

  @override
  String get editProfileDeletionMessage =>
      'Excluir permanentemente sua conta e todos os dados associados.';

  @override
  String get editProfileDeletionSubtext => 'Esta ação não pode ser desfeita';

  @override
  String get editProfileDeletionButton => 'Concluir exclusão';

  @override
  String get loginLabelEmail => 'E-mail';

  @override
  String get loginLabelPassword => 'Senha';

  @override
  String get loginValidatorEmail => 'Por favor, insira seu e-mail';

  @override
  String get loginValidatorPassword => 'Por favor, insira sua senha';

  @override
  String get loginButtonLogin => 'Entrar';

  @override
  String get loginButtonBiometric => 'Entrar com biometria';

  @override
  String get loginDividerOr => 'ou';

  @override
  String get loginNoAccount => 'Não tem uma conta? ';

  @override
  String get loginCreateAccount => 'Criar conta';

  @override
  String get loginPrivacyPolicy => 'Política de privacidade';

  @override
  String get loginTermsOfService => 'Termos de serviço';

  @override
  String welcomeGreeting(String firstName) {
    return 'Bem-vindo, $firstName!';
  }

  @override
  String get welcomeMessageAdmin =>
      'Pronto para liderar a revolução das redes profissionais? Complete seu perfil de administrador e configure sua equipe. Após completar seu perfil, você terá acesso à plataforma completa do Team Build Pro.';

  @override
  String get welcomeMessageUser =>
      'Pronto para transformar sua rede profissional? Complete seu perfil para desbloquear todo o poder do Team Build Pro.';

  @override
  String get welcomeButtonJoin => 'Junte-se à revolução';

  @override
  String get changePasswordHeading => 'Alterar senha';

  @override
  String get changePasswordTodoMessage =>
      'TODO: Implementar formulário de alteração de senha aqui.';

  @override
  String get chatPlaceholder => 'A interface de chat vai aqui.';

  @override
  String get quickPromptsWelcomeTitle => 'Bem-vindo ao seu Coach de IA!';

  @override
  String get quickPromptsWelcomeDescription =>
      'Estou aqui para ajudar você a ter sucesso com o Team Build Pro. Posso responder perguntas sobre o app, estratégias de construção de equipe e guiá-lo através dos recursos.';

  @override
  String get quickPromptsDisclaimerMessage =>
      'O Coach de IA pode cometer erros. Verifique informações importantes.';

  @override
  String get quickPromptsQuestionHeader => 'Como posso ajudar você?';

  @override
  String get quickPromptsQuestionSubheader =>
      'Toque em qualquer pergunta abaixo para começar, ou digite sua própria pergunta.';

  @override
  String get quickPromptsProTipLabel => 'Dica Pro';

  @override
  String get quickPromptsProTipText =>
      'Seja específico com suas perguntas. Por exemplo: \"Tenho 2 patrocinadores diretos, no que devo focar a seguir?\"';

  @override
  String get chatbotPrompt1 => 'Como funciona a qualificação?';

  @override
  String get chatbotPrompt2 => 'Qual é a diferença entre isso e um MLM?';

  @override
  String get chatbotPrompt3 => 'Como convido pessoas para minha equipe?';

  @override
  String get chatbotPrompt4 => 'Mostre-me a análise da minha equipe';

  @override
  String get chatbotPrompt5 => 'No que devo focar a seguir?';

  @override
  String get chatbotPrompt6 => 'Como cancelo minha assinatura?';

  @override
  String get chatbotPrompt7 =>
      'Por que a maioria das pessoas falha nas vendas diretas?';

  @override
  String get chatbotPrompt8 => 'O que acontece depois que eu me qualificar?';

  @override
  String get shareProspectPastStrugglesTitle => 'Abordando Lutas Passadas';

  @override
  String get shareProspectPastStrugglesDescription =>
      'Perfeito para prospectos que tentaram antes e tiveram dificuldades';

  @override
  String shareProspectPastStrugglesSubject(Object business) {
    return 'Pensando em $business de Novo? Encontrei uma Abordagem Diferente';
  }

  @override
  String shareProspectPastStrugglesMessage(Object business, Object link) {
    return 'Sei que nós dois tivemos experiências difíceis com vendas diretas antes. $business continua surgindo, e eu também tenho hesitado.\n\nMas encontrei algo diferente - um app chamado Team Build Pro que te permite construir uma equipe ANTES de entrar em qualquer coisa. A ideia é que você pode ver se realmente consegue recrutar pessoas antes de investir.\n\nTem coaching de IA e mensagens pré-escritas para você não ter que descobrir tudo sozinho.\n\nEstou testando eu mesmo. Se você ainda tem curiosidade sobre $business, pode valer a pena dar uma olhada:\n\n$link\n\nPensei que poderíamos explorar isso juntos e ver se é diferente desta vez.';
  }

  @override
  String get shareProspectNotSalespersonTitle => 'Para Não Vendedores';

  @override
  String get shareProspectNotSalespersonDescription =>
      'Ótimo para pessoas que não se veem como \"vendedores\"';

  @override
  String get shareProspectNotSalespersonSubject =>
      'Encontrei Algo para Não-Vendedores Como Nós';

  @override
  String shareProspectNotSalespersonMessage(Object business, Object link) {
    return 'Você sabe que não sou um vendedor natural. Por isso sempre hesitei com coisas como $business.\n\nEncontrei este app chamado Team Build Pro que é projetado para pessoas como nós. Tem 16 mensagens pré-escritas e um Coach de IA, então você não precisa criar discursos de venda por conta própria.\n\nA parte legal? Você pode construir uma equipe ANTES de entrar em qualquer oportunidade. Assim você pode ver se está realmente confortável com a parte de recrutamento sem se comprometer primeiro.\n\nEstou testando eu mesmo. Achei que você se identificaria:\n\n$link\n\nTalvez não sejamos tão \"não-vendedores\" quanto pensamos - só precisávamos das ferramentas certas.';
  }

  @override
  String get shareProspectHopeAfterDisappointmentTitle =>
      'Esperança Após a Decepção';

  @override
  String get shareProspectHopeAfterDisappointmentDescription =>
      'Ideal para prospectos queimados por oportunidades anteriores';

  @override
  String shareProspectHopeAfterDisappointmentSubject(Object business) {
    return 'Outra Olhada em $business? Desta Vez Com uma Rede de Segurança';
  }

  @override
  String shareProspectHopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'Sei que você já foi queimado antes. Eu também. As promessas de $business e outras oportunidades que nunca se concretizaram.\n\nEncontrei algo que parece diferente - não outra oportunidade, mas uma ferramenta. Team Build Pro te permite construir uma equipe ANTES de entrar em qualquer coisa. Você pode ver resultados reais antes de investir.\n\nSem exageros. Só um Coach de IA, mensagens pré-escritas, e uma forma de rastrear progresso real.\n\nEstou explorando eu mesmo porque estou cansado de começar do zero toda vez:\n\n$link\n\nSe não funcionar, pelo menos saberemos antes de colocar dinheiro. Achei que você gostaria de tentar junto comigo.';
  }

  @override
  String get shareProspectGeneralInvitationTitle => 'Convite Geral';

  @override
  String get shareProspectGeneralInvitationDescription =>
      'Uma mensagem versátil para qualquer situação de prospecto';

  @override
  String shareProspectGeneralInvitationSubject(Object business) {
    return 'Explorando $business? Encontrei Algo Interessante';
  }

  @override
  String shareProspectGeneralInvitationMessage(Object business, Object link) {
    return 'Oi! Tenho pesquisado sobre $business e encontrei algo que chamou minha atenção.\n\nTem um app chamado Team Build Pro que te permite construir uma equipe ANTES de entrar oficialmente em qualquer oportunidade. A ideia é que você pode testar as águas e ganhar impulso sem se comprometer primeiro.\n\nTem:\n- 16 mensagens de recrutamento pré-escritas\n- Um Coach de IA para orientação\n- Uma forma de rastrear quem está interessado\n\nEstou explorando eu mesmo. Achei que você gostaria de ver também já que sei que tem curiosidade sobre $business.\n\nDá uma olhada: $link\n\nSem pressão - só compartilhando o que encontrei.';
  }

  @override
  String get shareProspectSocialAnxietyTitle =>
      'Evitando Conversas Constrangedoras';

  @override
  String get shareProspectSocialAnxietyDescription =>
      'Perfeito para introvertidos ou aqueles desconfortáveis com recrutamento cara a cara';

  @override
  String get shareProspectSocialAnxietySubject =>
      'Construindo uma Rede Sem as Conversas Constrangedoras';

  @override
  String shareProspectSocialAnxietyMessage(Object business, Object link) {
    return 'O motivo pelo qual nunca me joguei de cabeça em $business ou similar? O pensamento de conversas de venda constrangedoras me faz tremer.\n\nEncontrei Team Build Pro - te permite construir uma equipe online, no seu próprio ritmo, com mensagens pré-escritas. Sem ligações frias, sem pitches cara a cara.\n\nE aqui está a coisa: você pode fazer tudo isso ANTES de entrar em qualquer oportunidade. Assim você pode ganhar confiança e ver se funciona para você sem a pressão.\n\nEstou testando eu mesmo. Achei que você apreciaria a abordagem sem pressão também:\n\n$link\n\nPodemos construir redes sem ser \"aquela pessoa\" nas festas.';
  }

  @override
  String get shareProspectTimeConstrainedTitle => 'Para Profissionais Ocupados';

  @override
  String get shareProspectTimeConstrainedDescription =>
      'Ideal para prospectos fazendo malabarismos com trabalho, família e outros compromissos';

  @override
  String shareProspectTimeConstrainedSubject(Object business) {
    return 'Explorando $business nos Momentos Livres';
  }

  @override
  String shareProspectTimeConstrainedMessage(Object business, Object link) {
    return 'Sei que você está tão ocupado quanto eu. Essa sempre foi a desculpa para não explorar coisas como $business.\n\nEncontrei Team Build Pro - você pode construir uma equipe em pequenos pedaços de tempo. 15 minutos aqui, 20 minutos ali. O Coach de IA e mensagens pré-escritas tornam eficiente.\n\nA melhor parte? Você faz isso ANTES de entrar em qualquer oportunidade. Assim pode testar em torno da sua agenda sem compromisso.\n\nEstou testando durante pausas de almoço e hora do café:\n\n$link\n\nSe funciona para alguém tão apertado de tempo como nós, pode valer a pena explorar juntos.';
  }

  @override
  String get shareProspectFinancialRiskAverseTitle => 'Medo de Perder Dinheiro';

  @override
  String get shareProspectFinancialRiskAverseDescription =>
      'Ótimo para prospectos preocupados com risco financeiro';

  @override
  String shareProspectFinancialRiskAverseSubject(Object business) {
    return 'Testando $business Sem Risco Financeiro Primeiro';
  }

  @override
  String shareProspectFinancialRiskAverseMessage(Object business, Object link) {
    return 'O que sempre me impediu de $business? Odeio perder dinheiro em coisas que não funcionam.\n\nEncontrei Team Build Pro - te permite construir uma equipe ANTES de entrar em qualquer oportunidade. Você pode ver resultados reais antes de investir em qualquer coisa.\n\nO app custa apenas \$4,99/mês após um período grátis. Muito menos do que comprar uma oportunidade às cegas.\n\nEstou testando para ver se realmente consigo recrutar pessoas primeiro:\n\n$link\n\nAchei que você apreciaria a abordagem de baixo risco também. Ver prova antes de gastar dinheiro real.';
  }

  @override
  String get shareProspectSkepticalRealistTitle => 'Me Mostre Prova';

  @override
  String get shareProspectSkepticalRealistDescription =>
      'Perfeito para prospectos queimados por falsas promessas';

  @override
  String shareProspectSkepticalRealistSubject(Object business) {
    return 'Sem Exageros - Só Testando $business do Jeito Inteligente';
  }

  @override
  String shareProspectSkepticalRealistMessage(Object business, Object link) {
    return 'Sou tão cético quanto você. Cada apresentação de $business soa igual - \"renda que muda a vida!\" Tá bom.\n\nEncontrei Team Build Pro - não outra oportunidade, só uma ferramenta. Te mostra métricas reais: quem você contatou, quem está interessado, seu progresso real. Sem enrolação.\n\nE você pode fazer tudo isso ANTES de entrar em qualquer coisa. Dados antes de decisões.\n\nEstou testando para ver se os números realmente funcionam:\n\n$link\n\nSem promessas. Sem exageros. Só me avisa se os dados parecem interessantes para você.';
  }

  @override
  String get shareProspect2GeneralInvitationTitle => 'Convite Geral';

  @override
  String get shareProspect2GeneralInvitationDescription =>
      'Uma mensagem versátil para qualquer situação de prospecto';

  @override
  String shareProspect2GeneralInvitationSubject(Object business) {
    return 'Construa Sua Equipe $business Antes do Dia 1';
  }

  @override
  String shareProspect2GeneralInvitationMessage(Object business, Object link) {
    return 'Pensando em entrar na $business? Quero compartilhar algo que pode te dar uma vantagem real.\n\nTeam Build Pro te permite construir sua equipe ANTES de entrar oficialmente. Então quando você começar comigo, não está começando do zero - você lança com pessoas já esperando.\n\nO app inclui:\n- 16 mensagens de recrutamento pré-escritas prontas para compartilhar\n- Coach de IA 24/7 para perguntas de recrutamento\n- Rastreamento em tempo real de quem está interessado\n\nJá vi o que acontece quando novos membros da equipe começam no frio. Isso muda tudo.\n\nConfira: $link\n\nQuando estiver pronto para entrar na minha equipe $business, você vai começar com tudo.';
  }

  @override
  String get shareProspect2PastStrugglesTitle => 'Abordando Lutas Passadas';

  @override
  String get shareProspect2PastStrugglesDescription =>
      'Perfeito para prospectos que tentaram antes e tiveram dificuldades';

  @override
  String get shareProspect2PastStrugglesSubject =>
      'Desta Vez Será Diferente - Eis o Porquê';

  @override
  String shareProspect2PastStrugglesMessage(Object business, Object link) {
    return 'Sei que você teve dificuldades antes com vendas diretas. Tentativas passadas com $business ou oportunidades similares te deixaram começando do zero.\n\nÉ exatamente por isso que te quero na minha equipe - e por isso estou compartilhando Team Build Pro com você.\n\nTe permite construir sua equipe $business ANTES de entrar oficialmente. Com 16 mensagens pré-escritas e um Coach de IA te guiando em cada passo, você não estará sozinho desta vez.\n\nSerei seu patrocinador E você terá suporte de IA 24/7.\n\nVeja como funciona: $link\n\nVocê merece uma chance real. Deixa eu te ajudar a acertar desta vez.';
  }

  @override
  String get shareProspect2NotSalespersonTitle => 'Para Não Vendedores';

  @override
  String get shareProspect2NotSalespersonDescription =>
      'Ótimo para pessoas que não se veem como \"vendedores\"';

  @override
  String shareProspect2NotSalespersonSubject(Object business) {
    return 'Entre na Minha Equipe $business - Sem Necessidade de Personalidade de Vendedor';
  }

  @override
  String shareProspect2NotSalespersonMessage(Object business, Object link) {
    return 'Não é um vendedor natural? Tudo bem - você não precisa ser para ter sucesso na minha equipe.\n\nTeam Build Pro te dá 16 mensagens de recrutamento pré-escritas e um Coach de IA. Você foca em relacionamentos genuínos. A IA cuida das \"coisas de vendas\".\n\nE aqui está a melhor parte: você pode construir sua equipe ANTES de entrar na $business. Ganhe confiança com as ferramentas primeiro.\n\nVou te guiar como seu patrocinador, e a IA te orienta 24/7.\n\nComece a construir: $link\n\nÉ como ter um assistente de recrutamento que nunca dorme. Entre na minha equipe e deixe as ferramentas trabalharem por você.';
  }

  @override
  String get shareProspect2HopeAfterDisappointmentTitle =>
      'Esperança Após a Decepção';

  @override
  String get shareProspect2HopeAfterDisappointmentDescription =>
      'Ideal para prospectos queimados por oportunidades anteriores';

  @override
  String shareProspect2HopeAfterDisappointmentSubject(Object business) {
    return 'Entre na Minha Equipe $business Com Suporte Real Desta Vez';
  }

  @override
  String shareProspect2HopeAfterDisappointmentMessage(
      Object business, Object link) {
    return 'Sei que você já foi queimado antes. Promessas vazias, zero suporte, começando do zero.\n\nNão é assim que eu lidero minha equipe.\n\nTeam Build Pro te permite construir sua equipe $business ANTES de entrar oficialmente. Impulso real antes do Dia 1. Sem exageros - só ferramentas com IA que realmente funcionam.\n\nSerei seu patrocinador, o Coach de IA te guia 24/7, e você terá mensagens pré-escritas prontas para usar.\n\nVeja como: $link\n\nVocê merece um sistema que te prepara para vencer. Te quero na minha equipe.';
  }

  @override
  String get shareProspect2SocialAnxietyTitle =>
      'Evitando Conversas Constrangedoras';

  @override
  String get shareProspect2SocialAnxietyDescription =>
      'Perfeito para introvertidos ou aqueles desconfortáveis com recrutamento cara a cara';

  @override
  String shareProspect2SocialAnxietySubject(Object business) {
    return 'Construa Sua Equipe $business Sem Conversas Constrangedoras';
  }

  @override
  String shareProspect2SocialAnxietyMessage(Object business, Object link) {
    return 'Desconfortável com conversas de vendas constrangedoras? Entendo. Por isso uso Team Build Pro com minha equipe.\n\nTe permite construir sua rede $business online, no seu próprio ritmo:\n- 16 mensagens pré-escritas - sem \"o que eu digo?\"\n- Construa prospectos no seu próprio ritmo\n- Orientação de IA 24/7 quando precisar\n\nSem ligações frias. Sem pitches cara a cara necessários. E você pode começar a construir ANTES de entrar.\n\nComece nos seus termos: $link\n\nQuando você entrar na minha equipe, terá impulso real de pessoas que recrutou confortavelmente online.';
  }

  @override
  String get shareProspect2TimeConstrainedTitle =>
      'Para Profissionais Ocupados';

  @override
  String get shareProspect2TimeConstrainedDescription =>
      'Ideal para prospectos fazendo malabarismos com trabalho, família e outros compromissos';

  @override
  String shareProspect2TimeConstrainedSubject(Object business) {
    return 'Construa Sua Equipe $business nas Brechas da Sua Vida';
  }

  @override
  String shareProspect2TimeConstrainedMessage(Object business, Object link) {
    return 'Sei que você está ocupado. Na verdade por isso $business pode funcionar para você - e por isso te quero na minha equipe.\n\nTeam Build Pro te permite construir sua equipe ANTES de entrar oficialmente - em pequenos momentos de tempo. Café da manhã. Pausa do almoço. Tempo livre à noite.\n\nO Coach de IA e 16 mensagens pré-escritas fazem cada minuto contar:\n- Rastreie todos os prospectos em um só lugar\n- Obtenha orientação de IA quando tiver alguns minutos\n- Veja seu impulso crescer\n\nVeja como se encaixa na sua vida: $link\n\nQuando estiver pronto para entrar na minha equipe, não vai começar do zero. Você vai lançar com pessoas já esperando.';
  }

  @override
  String get shareProspect2FinancialRiskAverseTitle =>
      'Medo de Perder Dinheiro';

  @override
  String get shareProspect2FinancialRiskAverseDescription =>
      'Ótimo para prospectos preocupados com risco financeiro';

  @override
  String shareProspect2FinancialRiskAverseSubject(Object business) {
    return 'Veja Resultados Antes de Investir em $business';
  }

  @override
  String shareProspect2FinancialRiskAverseMessage(
      Object business, Object link) {
    return 'Preocupado em perder dinheiro? Inteligente. Por isso recomendo Team Build Pro para todos que entram na minha equipe.\n\nTe permite construir sua equipe $business ANTES de investir oficialmente - assim você vê resultados reais primeiro.\n\nRastreie seu progresso real:\n- Quem está interessado em entrar\n- Seu impulso crescendo\n- Prova de que o sistema funciona para você\n\nApenas \$4,99/mês após um período grátis. Muito menos risco do que pular às cegas.\n\nVeja a prova primeiro: $link\n\nQuando finalmente entrar na minha equipe $business, você vai lançar com pessoas já esperando - não arriscando tudo na esperança.';
  }

  @override
  String get shareProspect2SkepticalRealistTitle => 'Me Mostre Prova';

  @override
  String get shareProspect2SkepticalRealistDescription =>
      'Perfeito para prospectos queimados por falsas promessas';

  @override
  String shareProspect2SkepticalRealistSubject(Object business) {
    return 'Sem Exageros. Métricas Reais. Entre na Minha Equipe $business.';
  }

  @override
  String shareProspect2SkepticalRealistMessage(Object business, Object link) {
    return 'Cansado de promessas vazias? Eu também. Por isso lidero minha equipe $business de forma diferente.\n\nTeam Build Pro te mostra métricas reais em cada passo:\n- Quantas pessoas você contatou\n- Quem respondeu e está interessado\n- Seu progresso real em direção à qualificação\n- Próximos passos que a IA recomenda\n\nSem enrolação. Sem exagero. Só dados. E você pode fazer tudo isso ANTES de entrar.\n\nVeja a transparência: $link\n\nQuando você entrar na minha equipe, vai lançar com prova - não com fé cega. É a única forma que eu faço negócios.';
  }

  @override
  String get sharePartnerWarmMarketExhaustedTitle => 'Mercado Quente Esgotado';

  @override
  String get sharePartnerWarmMarketExhaustedDescription =>
      'Para parceiros que esgotaram amigos e familiares';

  @override
  String get sharePartnerWarmMarketExhaustedSubject =>
      'Dê à Sua Equipe um Companheiro de Recrutamento de IA';

  @override
  String sharePartnerWarmMarketExhaustedMessage(Object business, Object link) {
    return 'Sua equipe $business esgotou o mercado quente? Cansado de vê-los perseguindo leads que somem?\n\nDê à sua organização $business inteira um companheiro de recrutamento de IA.\n\nO Team Build Pro funciona para cada pessoa na sua equipe:\n- 16 mensagens pré-escritas eliminam o \"o que digo?\"\n- Rastreia interesse e engajamento de prospectos\n- Coach de IA 24/7 responde suas perguntas\n- Todos duplicam o mesmo sistema comprovado\n\nSeus prospectos pré-constroem equipes ANTES de entrar - lançando com impulso, não do zero.\n\nSua equipe $business inteira obtém a mesma vantagem de IA. Verdadeira duplicação em escala.\n\nEmpodere sua equipe: $link\n\nPare de vê-los perseguindo. Comece a vê-los tendo sucesso.';
  }

  @override
  String get sharePartnerExpensiveSystemFatigueTitle =>
      'Fadiga de Sistema e Despesa';

  @override
  String get sharePartnerExpensiveSystemFatigueDescription =>
      'Para parceiros esgotados de métodos de recrutamento caros';

  @override
  String get sharePartnerExpensiveSystemFatigueSubject =>
      'Pare de Pagar Demais. Empodere Sua Equipe com IA';

  @override
  String sharePartnerExpensiveSystemFatigueMessage(
      Object business, Object link) {
    return 'Sua equipe $business queimando dinheiro com leads, funis e sistemas que não duplicam?\n\nO Team Build Pro dá à sua organização $business inteira ferramentas de recrutamento de IA - integradas. Sem custos extras. Sem configuração complexa.\n\nCada pessoa na sua equipe obtém:\n- 16 mensagens de recrutamento pré-escritas\n- Rastreamento de engajamento em tempo real\n- Coach de IA 24/7 para orientação\n- Um sistema simples que duplica\n\nSeus prospectos pré-constroem equipes ANTES de entrar. Sua equipe $business duplica as mesmas ferramentas de IA. Todos ganham.\n\nUm sistema simples. Resultados reais.\n\nEmpodere sua equipe: $link\n\nPare de pagar demais. Comece a escalar com inteligência.';
  }

  @override
  String get sharePartnerDuplicationStruggleTitle => 'Desafios de Duplicação';

  @override
  String get sharePartnerDuplicationStruggleDescription =>
      'Para líderes lutando para fazer sua equipe duplicar';

  @override
  String get sharePartnerDuplicationStruggleSubject =>
      'Finalmente, Duplicação Real para Sua Equipe';

  @override
  String sharePartnerDuplicationStruggleMessage(Object business, Object link) {
    return 'Sua equipe $business luta para duplicar seu sucesso de recrutamento? Isso acaba hoje.\n\nO Team Build Pro dá a cada pessoa na sua equipe $business o mesmo coach de recrutamento de IA que você gostaria de ter tido:\n- Redige suas mensagens de recrutamento\n- Agenda seus acompanhamentos perfeitamente\n- Rastreia seus prospectos automaticamente\n- Orienta seus próximos passos\n\nRecém-chegado ou líder veterano - todos na sua organização $business obtêm ferramentas de IA idênticas. Verdadeira duplicação do sistema.\n\nSeus prospectos pré-constroem equipes ANTES de entrar. Sua equipe cresce mais rápido. Consistentemente.\n\nEmpodere duplicação verdadeira: $link\n\nFinalmente, sua equipe inteira tem sucesso da mesma forma.';
  }

  @override
  String get sharePartnerGeneralTeamToolTitle => 'Convite Geral';

  @override
  String get sharePartnerGeneralTeamToolDescription =>
      'Uma mensagem versátil para qualquer situação de parceiro';

  @override
  String get sharePartnerGeneralTeamToolSubject =>
      'A Vantagem de Recrutamento de IA para Sua Equipe';

  @override
  String sharePartnerGeneralTeamToolMessage(Object business, Object link) {
    return 'Sua equipe $business merece uma vantagem competitiva real.\n\nO Team Build Pro dá à sua organização $business inteira ferramentas de recrutamento de IA que realmente duplicam:\n\n- 16 mensagens de recrutamento pré-escritas para qualquer situação\n- Rastrear engajamento de prospectos em tempo real\n- Coach de IA 24/7 para orientação de recrutamento\n- Verdadeira duplicação - todos obtêm as mesmas ferramentas\n\nOs prospectos da sua equipe pré-constroem suas equipes ANTES de entrar. Seus parceiros duplicam as mesmas ferramentas de IA. Todos na sua organização $business crescem mais rápido.\n\nDê à sua equipe a vantagem de IA: $link\n\nÉ assim que líderes modernos escalam suas equipes.';
  }

  @override
  String get sharePartnerRetentionCrisisTitle =>
      'Problema de Abandono da Equipe';

  @override
  String get sharePartnerRetentionCrisisDescription =>
      'Para líderes frustrados por membros da equipe desistindo cedo';

  @override
  String get sharePartnerRetentionCrisisSubject =>
      'Pare de Perder Sua Equipe no Primeiro Ano';

  @override
  String sharePartnerRetentionCrisisMessage(Object business, Object link) {
    return 'Vendo sua equipe $business desistir antes de ter sucesso?\n\n75% desistem no primeiro ano - geralmente porque se sentem perdidos, sem apoio ou sobrecarregados.\n\nO Team Build Pro muda isso para toda sua organização $business. Cada pessoa na sua equipe recebe um Coach de IA que:\n- Responde suas perguntas de recrutamento 24/7\n- Rastreia seu progresso e celebra vitórias\n- Fornece 16 mensagens pré-escritas para confiança\n- Mantém o impulso quando a motivação cai\n\nEles nunca estão sozinhos. Sempre sabem seu próximo passo. Permanecem engajados por mais tempo.\n\nSua equipe $business finalmente tem o apoio que precisa para ter sucesso.\n\nEmpodere sua equipe: $link\n\nPare de vê-los desistir. Comece a vê-los vencendo.';
  }

  @override
  String get sharePartnerSkillGapTeamTitle => 'Membros da Equipe Sem Vendas';

  @override
  String get sharePartnerSkillGapTeamDescription =>
      'Perfeito para equipes onde a maioria carece de experiência em vendas';

  @override
  String get sharePartnerSkillGapTeamSubject =>
      'Sua Equipe Sem Vendas Pode Vencer com IA';

  @override
  String sharePartnerSkillGapTeamMessage(Object business, Object link) {
    return 'A maioria da sua equipe $business não são vendedores naturais. Isso tem os segurado.\n\nO Team Build Pro transforma seus parceiros $business sem vendas em recrutadores confiantes:\n- 16 mensagens de recrutamento pré-escritas prontas para enviar\n- Rastreie prospectos e veja impulso real\n- Coach de IA 24/7 para orientação e apoio\n- Todos usam o mesmo sistema comprovado\n\nSeus introvertidos, seus part-timers, suas pessoas \"não sou bom em vendas\" - todos na sua organização $business obtêm a mesma vantagem de IA.\n\nFinalmente, toda sua equipe pode duplicar seu sucesso.\n\nEmpodere todos: $link\n\nVocê não precisa de uma equipe de vendedores. Você precisa de uma equipe com IA.';
  }

  @override
  String get sharePartnerRecruitmentFatigueTitle =>
      'Cansado de Recrutamento Constante';

  @override
  String get sharePartnerRecruitmentFatigueDescription =>
      'Para parceiros exaustos do ciclo interminável de recrutamento';

  @override
  String get sharePartnerRecruitmentFatigueSubject =>
      'Automatize o Trabalho. Cresça Sua Equipe.';

  @override
  String sharePartnerRecruitmentFatigueMessage(Object business, Object link) {
    return 'Sua equipe $business esgotada de recrutamento constante? Os acompanhamentos intermináveis? O rastreamento manual?\n\nA IA do Team Build Pro cuida do trabalho para toda sua organização $business.\n\nPara cada pessoa na sua equipe, a IA:\n- Fornece 16 mensagens de recrutamento pré-escritas\n- Rastreia cada prospecto e seu status\n- Responde perguntas de recrutamento 24/7\n- Mantém todos focados no que funciona\n\nVocê permanece focado em liderança. Sua equipe $business permanece produtiva sem se esgotar.\n\nA IA nunca se cansa. O impulso da sua equipe nunca para.\n\nEmpodere crescimento sustentável: $link\n\nCrescimento sem o esgotamento. Finalmente.';
  }

  @override
  String get sharePartnerAvailabilityGapTitle => 'Não Pode Estar Lá 24/7';

  @override
  String get sharePartnerAvailabilityGapDescription =>
      'Ideal para líderes que não podem estar constantemente disponíveis para sua equipe';

  @override
  String get sharePartnerAvailabilityGapSubject =>
      'Sua Equipe Cresce Mesmo Quando Você Não Está Lá';

  @override
  String sharePartnerAvailabilityGapMessage(Object business, Object link) {
    return 'Sua equipe $business precisa de você. Mas você não pode estar disponível 24/7.\n\nO Team Build Pro dá à sua organização $business inteira um Coach de IA que está sempre ativo.\n\nEnquanto você dorme, trabalha no seu emprego diurno ou passa tempo com a família, a IA:\n- Responde perguntas de recrutamento a qualquer momento\n- Fornece 16 mensagens pré-escritas prontas para usar\n- Rastreia seu progresso e os mantém motivados\n- Garante que nada caia pelas rachaduras\n\nSua equipe $business obtém apoio exatamente quando precisa - não apenas quando você está disponível.\n\nVocê permanece focado em liderança. A IA cuida do coaching diário.\n\nEmpodere sua equipe: $link\n\nFinalmente, sua equipe cresce sem precisar de você a cada minuto.';
  }

  @override
  String get sharePartnerAiScriptGeneratorTitle =>
      'Compartilhar Gerador de Scripts IA';

  @override
  String get sharePartnerAiScriptGeneratorDescription =>
      'Dê à sua equipe uma ferramenta gratuita de scripts de recrutamento com IA';

  @override
  String sharePartnerAiScriptGeneratorSubject(Object business) {
    return 'Ferramenta de IA Gratuita para o Recrutamento da Sua Equipe $business';
  }

  @override
  String sharePartnerAiScriptGeneratorMessage(Object business, Object link) {
    return 'Quer ajudar sua equipe $business a recrutar de forma mais eficaz?\n\nCompartilhe este Gerador de Scripts IA gratuito com eles. Sem cadastro necessário - ele cria mensagens de recrutamento personalizadas para qualquer cenário em segundos.\n\nSua equipe pode gerar scripts para:\n- Prospecção fria\n- Acompanhamentos\n- Tratamento de objeções (sem tempo, sem dinheiro, isso é MLM?)\n- Reconectar com contatos antigos\n\nCompartilhe com sua equipe: $link\n\nÉ uma vitória fácil - dê a eles ferramentas de IA que os ajudam a ter sucesso.';
  }

  @override
  String get homepageDemoCredentialsNotAvailable =>
      'Credenciais de demonstração não disponíveis';

  @override
  String homepageDemoLoginFailed(Object error) {
    return 'Login de demonstração falhou: $error';
  }

  @override
  String get homepageDemoLoginFailedGeneric =>
      'Login de demonstração falhou. Por favor, tente novamente.';

  @override
  String get homepageHeroJumpstart => 'IMPULSIONE SEU SUCESSO';

  @override
  String get homepageHeroGrow => 'CRESÇA E GERENCIE SUA EQUIPE';

  @override
  String get homepageHeroProven => 'SISTEMA COMPROVADO DE CONSTRUÇÃO DE EQUIPE';

  @override
  String get homepageHeroBuildFoundation => 'Construa Sua Fundação';

  @override
  String get homepageHeroBeforeDayOne => 'Antes do Dia Um';

  @override
  String get homepageHeroEmpowerTeam => 'Empodere Sua Equipe';

  @override
  String get homepageHeroAccelerate => 'Acelere o ';

  @override
  String get homepageHeroGrowth => 'Crescimento';

  @override
  String get homepageLoading => 'Carregando...';

  @override
  String homepageMessageTitlePersonal(Object sponsorName) {
    return 'Uma Mensagem Pessoal\nDe $sponsorName';
  }

  @override
  String get homepageMessageTitleGeneric => 'Uma Mensagem Do\nTeam Build Pro';

  @override
  String get homepageMessageBodyNewProspect1 =>
      'Estou muito feliz que você esteja aqui para ter uma vantagem inicial na construção da sua equipe de ';

  @override
  String get homepageMessageBodyNewProspect2 =>
      '. O próximo passo é fácil—basta criar sua conta abaixo e começar a desfrutar de sua avaliação gratuita de 30 dias! Assim que estiver registrado, entrarei em contato pessoalmente dentro do app para dizer olá e ajudá-lo a começar.\n\nAnsioso para nos conectarmos!';

  @override
  String get homepageMessageBodyRefPartner1 =>
      'Estou usando o app Team Build Pro para acelerar o crescimento da minha equipe de ';

  @override
  String get homepageMessageBodyRefPartner2 =>
      ' e renda! Recomendo muito para você também.\n\nO próximo passo é fácil—basta criar sua conta abaixo e começar a desfrutar de sua avaliação gratuita de 30 dias! Assim que estiver registrado, entrarei em contato pessoalmente dentro do app para dizer olá e ajudá-lo a começar.\n\nAnsioso para nos conectarmos!';

  @override
  String get homepageMessageBodyGeneric =>
      'Team Build Pro é o app definitivo para profissionais de vendas diretas gerenciarem e escalarem suas equipes existentes com impulso imparável e crescimento exponencial.\n\nO próximo passo é fácil—basta criar sua conta abaixo e começar a desfrutar de sua avaliação gratuita de 30 dias!';

  @override
  String get homepageButtonCreateAccount => 'Criar Conta';

  @override
  String get homepageButtonAlreadyHaveAccount => 'Já Tenho uma Conta';

  @override
  String get homepageDemoModeActive => 'Modo Demo Ativo';

  @override
  String get homepageDemoPreLoaded => 'Conta Demo Pré-Carregada';

  @override
  String get homepageDemoWelcome => 'Bem-vindo à Demo do Team Build Pro';

  @override
  String get homepageDemoDescription =>
      'Esta é uma conta de demonstração totalmente funcional pré-carregada com dados de equipe realistas. Explore todos os recursos e veja como o Team Build Pro pode transformar seu negócio de vendas diretas!';

  @override
  String get homepageDemoCredentialsLabel => 'Credenciais de Acesso:';

  @override
  String homepageDemoEmail(Object email) {
    return 'E-mail: $email';
  }

  @override
  String homepageDemoPassword(Object password) {
    return 'Senha: $password';
  }

  @override
  String get homepageDemoLoggingIn => 'Entrando...';

  @override
  String get homepageDemoStartDemo => 'Iniciar Demo!';

  @override
  String get homepageTrust100Secure => '100% Seguro';

  @override
  String get homepageTrust30DayFree => '30 Dias Grátis';

  @override
  String get homepageTrust24Support => 'Suporte 24/7';

  @override
  String get homepageFooterTerms => 'Termos de Serviço';

  @override
  String get homepageFooterPrivacy => 'Política de Privacidade';

  @override
  String get authLoginAccountRequiredTitle => 'Conta Necessária';

  @override
  String get authLoginAccountRequiredMessage =>
      'Parece que você precisa criar uma conta primeiro. Gostaria de se registrar agora?';

  @override
  String get authLoginCancelButton => 'Cancelar';

  @override
  String get authLoginRegisterButton => 'Registrar';

  @override
  String get authLoginAppBarTitle => 'Entrar';

  @override
  String get authLoginSubtitle => 'Entre para continuar construindo sua equipe';

  @override
  String get authLoginOrContinueWith => 'ou continuar com';

  @override
  String get authLoginForgotPassword => 'Esqueceu a Senha?';

  @override
  String get authLoginContinueWithGoogle => 'Continuar com Google';

  @override
  String get authLoginContinueWithApple => 'Continuar com Apple';

  @override
  String get authLoginBiometricButton => 'Entrar com biométrica';

  @override
  String get authLoginResetPasswordTitle => 'Redefinir Senha';

  @override
  String get authLoginCheckEmailTitle => 'Verifique Seu E-mail';

  @override
  String get authLoginResetEmailSent =>
      'Enviamos um link para redefinir sua senha para:';

  @override
  String get authLoginResetInstructions =>
      'Por favor, verifique sua caixa de entrada e siga as instruções para redefinir sua senha.';

  @override
  String get authLoginResetPrompt =>
      'Digite seu endereço de e-mail e enviaremos um link para redefinir sua senha.';

  @override
  String get authLoginResetEmailLabel => 'E-mail';

  @override
  String get authLoginResetEmailHint => 'Digite seu endereço de e-mail';

  @override
  String get authLoginResetEmailRequired => 'Por favor, digite seu e-mail';

  @override
  String get authLoginResetEmailInvalid => 'Por favor, digite um e-mail válido';

  @override
  String get authLoginDoneButton => 'Pronto';

  @override
  String get authLoginSendResetLink => 'Enviar Link de Redefinição';

  @override
  String get authSignupInvalidInviteLinkMessage =>
      'Isso não parece um link de convite. Por favor, cole o link completo que você recebeu.';

  @override
  String get authSignupNewReferralDialogTitle =>
      'Novo Código de Indicação Detectado';

  @override
  String get authSignupNewReferralDialogMessage =>
      'Um novo código de indicação foi detectado:';

  @override
  String authSignupNewReferralNewCode(Object code) {
    return 'Novo código: $code';
  }

  @override
  String authSignupNewReferralNewSource(Object source) {
    return 'Fonte: $source';
  }

  @override
  String authSignupNewReferralCurrentCode(Object code) {
    return 'Código atual: $code';
  }

  @override
  String authSignupNewReferralCurrentSource(Object source) {
    return 'Fonte atual: $source';
  }

  @override
  String get authSignupNewReferralPrompt =>
      'Gostaria de atualizar seu código de indicação?';

  @override
  String get authSignupKeepCurrentButton => 'Manter Atual';

  @override
  String get authSignupUseNewCodeButton => 'Usar Novo Código';

  @override
  String get authSignupAppBarTitle => 'TEAM BUILD PRO';

  @override
  String get authSignupLoginButton => 'Entrar';

  @override
  String get authSignupConfirmSponsorButton => 'Confirmar Patrocinador';

  @override
  String get authSignupNoSponsorFound =>
      'Desculpe, nenhum patrocinador encontrado';

  @override
  String get authSignupPageTitle => 'Registro de Conta';

  @override
  String get authSignupInviteLinkButton => 'Tenho um link de convite';

  @override
  String get authSignupInviteLinkInstructions =>
      'Se alguém lhe enviou um link de convite, você pode colá-lo aqui.';

  @override
  String get authSignupPasteInviteLinkButton => 'Colar link de convite';

  @override
  String authSignupInvitedBy(Object sponsorName) {
    return 'Convidado por: $sponsorName';
  }

  @override
  String authSignupReferralCodeDebug(Object code, Object source) {
    return 'Código: $code (fonte: $source)';
  }

  @override
  String get authSignupAppleButton => 'Cadastrar-se com Apple';

  @override
  String get authSignupGoogleButton => 'Cadastrar-se com Google';

  @override
  String get authSignupOrEmailDivider => 'ou cadastrar-se com e-mail';

  @override
  String get authSignupLoginSectionTitle => 'Crie Seu Login';

  @override
  String get authSignupPrivacyAssurance =>
      '🔒 Seu e-mail nunca será compartilhado com ninguém';

  @override
  String get authSignupRequiredForAccount =>
      '🔒 Necessário para criação de conta';

  @override
  String get settingsAuthRequired => 'Autenticação necessária.';

  @override
  String get settingsUserNotFound => 'Perfil de usuário não encontrado.';

  @override
  String get settingsAccessDenied =>
      'Acesso Negado: Função de administrador necessária.';

  @override
  String settingsLoadFailed(Object error) {
    return 'Falha ao carregar configurações: $error';
  }

  @override
  String get settingsBusinessNameInvalid =>
      'O nome do negócio só pode conter letras, números e pontuação comum.';

  @override
  String get settingsReferralLinkInvalid =>
      'Por favor, digite um link de indicação válido (ex., https://example.com).';

  @override
  String get settingsOrgNameMismatch =>
      'Os campos de Nome da Organização devem corresponder para confirmação.';

  @override
  String get settingsReferralLinkMismatch =>
      'Os campos de Link de Indicação devem corresponder para confirmação.';

  @override
  String get settingsUserNotAuthenticated => 'Usuário não autenticado.';

  @override
  String get settingsUpgradeRequiredTitle => 'Atualização Necessária';

  @override
  String get settingsUpgradeRequiredMessage =>
      'Atualize sua assinatura de Administrador para salvar essas alterações.';

  @override
  String get settingsCancelButton => 'Cancelar';

  @override
  String get settingsUpgradeButton => 'Atualizar Agora';

  @override
  String get settingsSavedSuccess => 'Configurações salvas com sucesso.';

  @override
  String settingsSaveFailed(Object error) {
    return 'Falha ao salvar configurações: $error';
  }

  @override
  String get settingsRequired => 'Obrigatório';

  @override
  String get settingsNotSet => 'Não Definido';

  @override
  String get settingsSuperAdminOnly =>
      '🚫 Somente o Super Administrador pode realizar a limpeza do banco de dados';

  @override
  String settingsCleanupError(Object error) {
    return 'Erro: $error';
  }

  @override
  String get settingsCleanupDryRunTitle => '🔍 Resultados de Simulação';

  @override
  String get settingsCleanupCompleteTitle => '✅ Limpeza Concluída';

  @override
  String get settingsCleanupTotalUsers => 'Total de Usuários:';

  @override
  String get settingsCleanupNonAdminUsers => 'Usuários Não Administradores:';

  @override
  String get settingsCleanupProtectedAdmins => 'Administradores Protegidos:';

  @override
  String get settingsCleanupDeleted => 'Excluídos:';

  @override
  String get settingsCleanupDeletedUsers => 'Usuários:';

  @override
  String get settingsCleanupDeletedChats => 'Chats:';

  @override
  String get settingsCleanupDeletedChatLogs => 'Registros de Chat:';

  @override
  String get settingsCleanupDeletedChatUsage => 'Uso de Chat:';

  @override
  String get settingsCleanupDeletedReferralCodes => 'Códigos de Referência:';

  @override
  String get settingsOkButton => 'OK';

  @override
  String get profileUpdateBiometricFailed =>
      'A autenticação biométrica falhou. Por favor, tente novamente.';

  @override
  String get profileUpdatePasswordRequired =>
      'Senha necessária para habilitar login biométrico';

  @override
  String get profileUpdateEmailNotFound => 'E-mail do usuário não encontrado';

  @override
  String get profileUpdateBiometricEnabled =>
      '✅ Login biométrico habilitado com sucesso';

  @override
  String get profileUpdatePasswordIncorrect =>
      'Senha incorreta. Por favor, tente novamente.';

  @override
  String profileUpdateBiometricError(Object error) {
    return 'Erro ao habilitar biométrica: $error';
  }

  @override
  String get profileUpdateBiometricDisabled => 'Login biométrico desabilitado';

  @override
  String get profileUpdateConfirmPasswordTitle => 'Confirmar Senha';

  @override
  String get profileUpdateConfirmPasswordMessage =>
      'Para armazenar com segurança suas credenciais para o login biométrico, por favor digite sua senha.';

  @override
  String get profileUpdatePasswordLabel => 'Senha';

  @override
  String get profileUpdateCancelButton => 'Cancelar';

  @override
  String get profileUpdateConfirmButton => 'Confirmar';

  @override
  String get profileUpdateDisableBiometricTitle =>
      'Desabilitar Login Biométrico';

  @override
  String get profileUpdateDisableBiometricMessage =>
      'Tem certeza de que deseja desabilitar o login biométrico? Você precisará usar seu e-mail e senha para entrar.';

  @override
  String get profileUpdateDisableButton => 'Desabilitar';

  @override
  String get profileUpdatePictureRequired =>
      'Por favor, envie sua foto de perfil.';

  @override
  String get profileUpdateImageNotProvided => 'A imagem não foi fornecida.';

  @override
  String get profileUpdateSuccess => 'Perfil atualizado com sucesso!';

  @override
  String profileUpdateError(Object error) {
    return 'Erro ao atualizar perfil: $error';
  }

  @override
  String get profileUpdateDemoModeTitle => 'Modo Demo';

  @override
  String get profileUpdateDemoModeMessage =>
      'Edição de perfil desabilitada no modo demo.';

  @override
  String get profileUpdateDemoUnderstandButton => 'Entendi';

  @override
  String get profileUpdateScreenTitle => 'Atualizar Perfil';

  @override
  String get profileUpdateNoEmail => 'Sem e-mail';

  @override
  String get profileUpdateSelectCountry => 'Selecionar País';

  @override
  String get profileUpdateCountryLabel => 'País';

  @override
  String get profileUpdateCountryRequired => 'Por favor, selecione um país';

  @override
  String get profileUpdateSelectState => 'Selecionar Estado/Província';

  @override
  String get profileUpdateSelectCountryFirst => 'Selecione um país primeiro';

  @override
  String get profileUpdateStateLabel => 'Estado/Província';

  @override
  String get profileUpdateStateRequired =>
      'Por favor, selecione um estado/província';

  @override
  String get profileUpdateCityLabel => 'Cidade';

  @override
  String get profileUpdateCityRequired => 'Por favor, digite uma cidade';

  @override
  String get profileUpdateSecurityHeader => 'Configurações de Segurança';

  @override
  String get profileUpdateBiometricToggle => 'Habilitar Login Biométrico';

  @override
  String get profileUpdateBiometricChecking =>
      'Verificando compatibilidade do dispositivo...';

  @override
  String get profileUpdateBiometricDescription =>
      'Use impressão digital ou reconhecimento facial para entrar';

  @override
  String get profileUpdateBiometricNotAvailable =>
      'Não disponível neste dispositivo';

  @override
  String get profileUpdateSaveButton => 'Salvar Alterações';

  @override
  String get profileEditDeletionSuccess =>
      'Exclusão de conta concluída. Obrigado por usar o Team Build Pro.';

  @override
  String profileEditDeletionError(Object error) {
    return 'Erro ao concluir exclusão de conta: $error';
  }

  @override
  String get profileEditUrlInvalid =>
      'Por favor, digite uma URL válida (ex., https://example.com)';

  @override
  String get profileEditHttpsRequired =>
      'O link de indicação deve usar HTTPS (não HTTP) por segurança';

  @override
  String get profileEditUrlFormatInvalid =>
      'Formato de URL inválido. Por favor, verifique seu link de indicação.';

  @override
  String get profileEditUnableToVerify =>
      'Não foi possível verificar o link de indicação';

  @override
  String get profileEditDomainRequired =>
      'Por favor, digite um link válido com um domínio apropriado';

  @override
  String get profileEditNoLocalhost =>
      'Por favor, digite um link de indicação de negócio válido\n(não localhost ou endereço IP)';

  @override
  String get profileEditDomainWithTld =>
      'Por favor, digite um link válido com um domínio apropriado\n(ex., company.com)';

  @override
  String profileEditBaseUrlRequired(Object baseUrl) {
    return 'O link de indicação deve começar com:\n$baseUrl';
  }

  @override
  String get profileEditNotHomepage =>
      'Por favor, digite seu link de indicação único,\nnão apenas a página inicial';

  @override
  String get profileEditInvalidFormat => 'Formato de link inválido';

  @override
  String get profileEditReferralRequired =>
      'Por favor, digite seu link de indicação';

  @override
  String get profileEditConfirmReferral =>
      'Por favor, confirme seu link de indicação';

  @override
  String get profileEditCompleteLink =>
      'Por favor, digite um link completo começando com\nhttp:// ou https://';

  @override
  String get profileEditValidReferralRequired =>
      'Por favor, digite um link de indicação válido (ex., https://example.com).';

  @override
  String get profileEditReferralMismatch =>
      'Os campos de Link de Indicação devem corresponder para confirmação.';

  @override
  String get profileEditInvalidLinkTitle => 'Link de Indicação Inválido';

  @override
  String profileEditInvalidLinkMessage(Object businessName) {
    return 'O link de indicação de $businessName não pôde ser verificado. O link pode estar incorreto, inativo ou temporariamente indisponível.';
  }

  @override
  String get profileEditContactSponsor =>
      'Por favor, verifique o link e tente novamente, ou entre em contato com seu patrocinador para obter o link de indicação correto.';

  @override
  String get profileEditTryAgainButton => 'Tentar Novamente';

  @override
  String profileEditReferralHint(Object baseUrl) {
    return 'ex., ${baseUrl}seu_nome_de_usuario_aqui';
  }

  @override
  String get profileEditRequiredForRep =>
      'Obrigatório quando você é representante';

  @override
  String get adminProfilePictureRequired =>
      'Por favor, selecione uma foto de perfil';

  @override
  String get adminProfileCountryRequired => 'Por favor, selecione um país';

  @override
  String get adminProfileStateRequired =>
      'Por favor, selecione um estado/província';

  @override
  String get adminProfileCityRequired => 'Por favor, digite sua cidade';

  @override
  String get adminProfileSetupTitle =>
      '🛠️ Configurando seu perfil de negócios...';

  @override
  String get adminProfileSetupDescription =>
      'Preparando as informações do seu negócio';

  @override
  String get adminProfileUserNotAuthenticated => 'Usuário não autenticado';

  @override
  String get adminProfileUploadFailed => 'Falha ao enviar imagem';

  @override
  String get adminProfileSaveSuccess =>
      'Informações de perfil salvas com sucesso!';

  @override
  String adminProfileSaveError(Object error) {
    return 'Erro: $error';
  }

  @override
  String get adminProfileScreenTitle => 'Perfil de Administrador';

  @override
  String get adminProfileSetupHeader => 'Configuração de Perfil';

  @override
  String get adminProfileNoEmail => 'Sem e-mail';

  @override
  String get adminProfileCountryLabel => 'País';

  @override
  String get adminProfileStateLabel => 'Estado/Província';

  @override
  String get adminProfileCityLabel => 'Cidade';

  @override
  String get adminProfileNextButton => 'Próximo - Informações do Negócio';

  @override
  String get subscriptionAppBarTitle => 'Team Build Pro';

  @override
  String get subscriptionPremiumHeader => 'Recursos Premium:';

  @override
  String get subscriptionStatusActive => 'Assinatura Ativa';

  @override
  String get subscriptionStatusActiveSubtitle =>
      'Você tem acesso completo a todos os recursos premium';

  @override
  String get subscriptionStatusPaused => 'Assinatura Pausada';

  @override
  String get subscriptionStatusPausedSubtitle =>
      'Sua assinatura está pausada. Retome para restaurar o acesso.';

  @override
  String get subscriptionStatusPaymentIssue => 'Problema de Pagamento';

  @override
  String get subscriptionStatusPaymentIssueSubtitle =>
      'Atualize o método de pagamento para restaurar o acesso';

  @override
  String get subscriptionStatusTrialActive => 'Teste Grátis Ativo';

  @override
  String subscriptionStatusTrialDaysRemaining(Object days) {
    return '$days dias restantes no seu teste';
  }

  @override
  String get subscriptionStatusCancelled => 'Assinatura Cancelada';

  @override
  String get subscriptionStatusCancelledSubtitle =>
      'O acesso continua até a data de vencimento';

  @override
  String get subscriptionStatusExpired => 'Assinatura Expirada';

  @override
  String get subscriptionStatusExpiredSubtitle =>
      'Atualize para restaurar recursos premium';

  @override
  String subscriptionFeature1(Object businessName) {
    return 'Envie seu link de indicação único de $businessName';
  }

  @override
  String get subscriptionFeature2 =>
      'Coaching de IA personalizado para recrutamento e construção de equipes';

  @override
  String get subscriptionFeature3 =>
      'Desbloqueie mensagens para usuários na sua equipe';

  @override
  String subscriptionFeature4(Object businessName) {
    return 'Garanta que os membros da equipe se juntem sob VOCÊ em $businessName';
  }

  @override
  String get subscriptionFeature5 => 'Análises e insights avançados';

  @override
  String get subscriptionActivatedSuccess =>
      '✅ Assinatura ativada com sucesso!';

  @override
  String get subscriptionNotActiveTitle => 'Assinatura Não Ativa';

  @override
  String get subscriptionNotActiveMessage =>
      'Compra iniciada, mas ainda não ativa. Tente novamente.';

  @override
  String get subscriptionNotAvailableTitle => 'Assinatura Não Disponível';

  @override
  String get subscriptionNotAvailableMessageIOS =>
      'As compras no aplicativo não estão disponíveis atualmente no seu dispositivo. Isso pode ser devido a restrições definidas pela sua organização ou administrador do dispositivo.\n\nPor favor, verifique suas configurações de Tempo de Uso ou entre em contato com seu departamento de TI se estiver usando um dispositivo gerenciado.\n\nAlternativamente, você pode assinar através do nosso site.';

  @override
  String get subscriptionNotAvailableMessageAndroid =>
      'As compras no aplicativo não estão disponíveis atualmente no seu dispositivo. Isso pode ser devido a restrições ou problemas de rede.\n\nPor favor, tente novamente mais tarde ou entre em contato com o suporte se o problema persistir.';

  @override
  String get subscriptionNotAvailableMessageDefault =>
      'As compras no aplicativo não estão disponíveis atualmente. Por favor, tente novamente mais tarde.';

  @override
  String get subscriptionOkButton => 'OK';

  @override
  String get subscriptionRestoredSuccess =>
      '✅ Assinatura restaurada com sucesso!';

  @override
  String get subscriptionNoPreviousFound =>
      'Nenhuma assinatura anterior encontrada para restaurar.';

  @override
  String get subscriptionSubscribeButton => 'Assinar Agora - \$6.99/mês';

  @override
  String get subscriptionRestoreButton => 'Restaurar Assinatura Anterior';

  @override
  String get subscriptionLegalNotice =>
      'Ao assinar, você concorda com nossos Termos de Serviço e Política de Privacidade.';

  @override
  String get subscriptionTermsLink => 'Termos de Serviço';

  @override
  String get subscriptionSeparator => ' | ';

  @override
  String get subscriptionPrivacyLink => 'Política de Privacidade';

  @override
  String subscriptionAutoRenewNotice(String managementText) {
    return 'A assinatura renova automaticamente, a menos que seja cancelada pelo menos 24 horas antes do final do período atual. $managementText';
  }

  @override
  String get subscriptionManageIOS =>
      'Você pode gerenciar sua assinatura nas configurações da sua conta Apple ID.';

  @override
  String get subscriptionManageAndroid =>
      'Você pode gerenciar sua assinatura na Google Play Store.';

  @override
  String get subscriptionManageDefault =>
      'Você pode gerenciar sua assinatura na loja de aplicativos do seu dispositivo.';

  @override
  String get subscriptionPlatformAppStore => 'App Store';

  @override
  String get subscriptionPlatformPlayStore => 'Google Play Store';

  @override
  String get subscriptionPlatformGeneric => 'loja de aplicativos';

  @override
  String get subscriptionDefaultBizOpp => 'sua oportunidade';

  @override
  String get termsScreenTitle => 'Termos de Serviço';

  @override
  String get termsHeaderTitle => 'Termos de Serviço';

  @override
  String get termsSubtitle => 'Acordo de Plataforma de Redes Profissionais';

  @override
  String termsLastUpdated(Object date) {
    return 'Última Atualização: $date';
  }

  @override
  String get termsFooterBadgeTitle => 'Conforme App Store da Apple';

  @override
  String get termsFooterBadgeDescription =>
      'Estes Termos de Serviço atendem a todas as diretrizes e requisitos da App Store da Apple para aplicativos de plataforma.';

  @override
  String get termsDisclaimerTitle => 'PLATAFORMA DE NETWORKING PROFISSIONAL';

  @override
  String get termsDisclaimerSubtitle => 'Visão Geral do Serviço';

  @override
  String get privacyScreenTitle => 'Política de Privacidade';

  @override
  String get privacyHeaderTitle => 'Política de Privacidade';

  @override
  String privacyLastUpdated(Object date) {
    return 'Última Atualização: $date';
  }

  @override
  String get privacyEmailSubject =>
      'subject=Consulta sobre Política de Privacidade';

  @override
  String privacyEmailError(Object email) {
    return 'Não foi possível abrir o cliente de e-mail. Por favor, entre em contato com $email';
  }

  @override
  String get privacyMattersTitle => 'Sua Privacidade Importa';

  @override
  String get privacyMattersDescription =>
      'Estamos comprometidos em proteger suas informações pessoais e seu direito à privacidade. Esta política explica como coletamos, usamos e protegemos seus dados.';

  @override
  String get privacyAppleComplianceTitle =>
      'Conformidade de Privacidade da Apple';

  @override
  String get privacyAppleComplianceDescription =>
      'Este aplicativo segue as diretrizes de privacidade da Apple e os requisitos da App Store. Somos transparentes sobre a coleta de dados e damos a você controle sobre suas informações.';

  @override
  String get privacyContactHeading => 'Entre em Contato';

  @override
  String get privacyContactSubheading =>
      'Dúvidas sobre esta Política de Privacidade?';

  @override
  String get privacyContactDetails =>
      'Team Build Pro\nOficial de Privacidade\nResposta em 48 horas';

  @override
  String privacyCopyright(Object year) {
    return '© $year Team Build Pro. Todos os direitos reservados.';
  }

  @override
  String get privacyFooterDisclaimer =>
      'Esta Política de Privacidade é efetiva a partir da data listada acima e se aplica a todos os usuários do aplicativo móvel Team Build Pro.';

  @override
  String get howItWorksScreenTitle => 'Como Funciona';

  @override
  String get howItWorksHeaderTitle => 'Como Funciona';

  @override
  String get howItWorksHeroSubtitle =>
      'Transforme seu recrutamento com um pipeline de equipe pré-qualificado.';

  @override
  String get howItWorksFeaturedOpportunity => 'Oportunidade em Destaque';

  @override
  String get howItWorksPipelineSystem => 'SISTEMA DE PIPELINE';

  @override
  String get howItWorksStep1Title => 'Estabeleça Sua Fundação';

  @override
  String howItWorksStep1Description(Object business) {
    return 'Personalize sua conta Team Build Pro com os detalhes da sua oportunidade e conecte seu link de indicação - transformando o app em seu pipeline de recrutamento pessoal.';
  }

  @override
  String get howItWorksStep2Title =>
      'Construa de Forma Inteligente, Não Difícil';

  @override
  String get howItWorksStep2Description =>
      'Use coaching impulsionado por IA para redigir mensagens, agendar follow-ups e rastrear interesse. Construa relacionamentos com prospects antes mesmo deles entrarem na sua oportunidade de negócio.';

  @override
  String get howItWorksStep3Title => 'Qualificação Automática';

  @override
  String howItWorksStep3Description(Object business) {
    return 'À medida que os prospects constroem suas próprias equipes dentro do app, eles automaticamente atingem marcos de qualificação (3 patrocinadores diretos + 12 equipe total) - provando seu comprometimento antes de entrar.';
  }

  @override
  String get howItWorksStep4Title => 'Crescimento Rápido';

  @override
  String get howItWorksStep4Description =>
      'Seus prospects pré-qualificados lançam com momentum, equipes já estabelecidas e capacidade comprovada de recrutar. Isso cria um motor de crescimento autossustentável.';

  @override
  String get howItWorksKeyTargetsTitle => ' METAS CHAVE DE CRESCIMENTO';

  @override
  String get howItWorksDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get howItWorksTotalTeam => 'Membros Totais da Equipe';

  @override
  String get howItWorksCtaHeading => 'Expanda Sua Rede';

  @override
  String get howItWorksCtaDescription =>
      'Expanda sua Rede para impulsionar o crescimento da organização!';

  @override
  String get howItWorksCtaButton => 'Estratégias de Crescimento Provadas';

  @override
  String get howItWorksDefaultBizOpp => 'sua oportunidade';

  @override
  String get termsDisclaimerContent =>
      '• Team Build Pro é uma plataforma de networking baseada em assinatura\n• Os usuários pagam uma taxa de assinatura mensal para acesso a ferramentas de networking\n• A plataforma fornece gerenciamento de relacionamentos e recursos de conexão de negócios\n• Todas as oportunidades de negócios são fornecidas por terceiros independentes\n\nTeam Build Pro opera como uma plataforma de networking e não garante resultados comerciais.';

  @override
  String get termsSection1Title => '1. ACEITAÇÃO DOS TERMOS';

  @override
  String get termsSection1Content =>
      'Ao baixar, instalar, acessar ou usar o aplicativo móvel Team Build Pro (\"Aplicativo\"), você concorda em estar vinculado a estes Termos de Serviço (\"Termos\"). Se você não concordar com estes Termos, não use o Aplicativo.\n\nEstes Termos constituem um acordo legalmente vinculativo entre você e Team Build Pro em relação ao seu uso do nosso serviço de plataforma de networking profissional.';

  @override
  String get termsSection2Title => '2. DESCRIÇÃO DO SERVIÇO';

  @override
  String get termsSection2Content =>
      'Team Build Pro é uma plataforma de networking profissional baseada em assinatura que fornece:\n\n• Ferramentas de gerenciamento de relacionamentos de contatos\n• Recursos de construção de equipe e networking\n• Ferramentas de comunicação e colaboração\n• Informações sobre oportunidades de negócios de provedores terceiros\n• Coaching e orientação impulsionada por IA\n\nISENÇÕES IMPORTANTES:\n• Team Build Pro é um serviço de plataforma de networking, não uma oportunidade de negócio\n• Os usuários pagam uma taxa de assinatura mensal pelo acesso à plataforma\n• Não garantimos nenhum resultado comercial ou renda\n• Todas as oportunidades de negócios são fornecidas por terceiros independentes\n• O sucesso depende inteiramente do esforço individual e das condições do mercado';

  @override
  String get termsSection3Title => '3. ASSINATURA E PAGAMENTO';

  @override
  String get termsSection3Content =>
      'ACESSO E TAXAS:\n• O Aplicativo opera em uma base de assinatura\n• As taxas de assinatura mensal são cobradas através da sua conta Apple ID\n• A assinatura renova automaticamente a menos que seja cancelada\n• Os preços são mostrados no Aplicativo e podem variar por região\n\nCICLO DE COBRANÇA:\n• Você será cobrado na confirmação da compra\n• Sua assinatura renova automaticamente a cada mês\n• As cobranças ocorrem 24 horas antes do final do período atual\n• Você pode gerenciar assinaturas nas Configurações da Conta Apple ID\n\nCANCELAMENTO:\n• Cancele a qualquer momento através das Configurações da Conta Apple ID\n• O cancelamento entra em vigor no final do período de cobrança atual\n• Sem reembolsos por meses parciais\n• O acesso continua até o final do período pago';

  @override
  String get termsSection4Title => '4. TESTE GRATUITO (SE APLICÁVEL)';

  @override
  String get termsSection4Content =>
      'TERMOS DO TESTE:\n• Alguns planos de assinatura podem incluir um período de teste gratuito\n• A duração do teste será claramente exibida antes da inscrição\n• Você pode cancelar durante o teste para evitar cobranças\n• Se você não cancelar, será cobrado a taxa de assinatura\n\nCONVERSÃO PARA PAGO:\n• Os testes convertem para assinaturas pagas automaticamente\n• As cobranças começam imediatamente após o término do teste\n• O preço de assinatura mostrado na inscrição se aplica\n• Cancele antes do término do teste para evitar cobranças';

  @override
  String get termsSection5Title => '5. TERMOS DE COMPRA IN-APP DA APPLE';

  @override
  String get termsSection5Content =>
      'Todas as assinaturas são processadas através do sistema de Compra In-App da Apple e estão sujeitas aos Termos de Serviço e políticas da Apple.\n\nPAPEL DA APPLE:\n• O pagamento é cobrado na sua conta Apple ID\n• Assinaturas gerenciadas através das Configurações da Conta Apple ID\n• Solicitações de reembolso tratadas pela Apple de acordo com suas políticas\n• Os termos do EULA padrão da Apple se aplicam, a menos que especificado de outra forma\n\nSUAS RESPONSABILIDADES:\n• Manter informações de pagamento precisas no Apple ID\n• Monitorar o status da assinatura na sua conta Apple\n• Contatar o Suporte da Apple para problemas de cobrança\n• Revisar os termos da Apple em: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

  @override
  String get termsSection6Title => '6. CONTAS DE USUÁRIO E REGISTRO';

  @override
  String get termsSection6Content =>
      'CRIAÇÃO DE CONTA:\n• Você deve criar uma conta para usar o Aplicativo\n• Fornecer informações precisas, atuais e completas\n• Você é responsável por manter a confidencialidade da conta\n• Você deve ter pelo menos 18 anos para criar uma conta\n\nSEGURANÇA DA CONTA:\n• Mantenha sua senha segura e confidencial\n• Notifique-nos imediatamente de acesso não autorizado\n• Você é responsável por toda atividade sob sua conta\n• Não compartilhe sua conta com outros\n\nTERMINAÇÃO DA CONTA:\n• Podemos suspender ou terminar contas que violem estes Termos\n• Você pode excluir sua conta a qualquer momento através do Aplicativo\n• A terminação não afeta a cobrança de assinatura a menos que seja cancelada\n• Reservamo-nos o direito de recusar serviço a qualquer pessoa';

  @override
  String get termsSection7Title => '7. CONDUTA PROIBIDA';

  @override
  String get termsSection7Content =>
      'Você concorda em NÃO:\n\n• Usar o Aplicativo para qualquer propósito ilegal\n• Violar qualquer lei ou regulamento aplicável\n• Infringir direitos de propriedade intelectual\n• Transmitir código prejudicial, vírus ou malware\n• Assediar, abusar ou prejudicar outros usuários\n• Fazer-se passar por outros ou fornecer informações falsas\n• Tentar obter acesso não autorizado ao Aplicativo\n• Interferir com a funcionalidade ou segurança do Aplicativo\n• Usar sistemas automatizados para acessar o Aplicativo sem permissão\n• Coletar informações de usuários sem consentimento\n• Participar de qualquer atividade que interrompa o Aplicativo\n• Usar o Aplicativo para promover esquemas ilegais ou fraudes';

  @override
  String get termsSection8Title => '8. PROPRIEDADE INTELECTUAL';

  @override
  String get termsSection8Content =>
      'PROPRIEDADE:\n• Team Build Pro possui todos os direitos do Aplicativo e seu conteúdo\n• Isso inclui software, design, texto, gráficos e logotipos\n• Nossas marcas comerciais e branding são protegidos\n• Você recebe apenas uma licença limitada para usar o Aplicativo\n\nSUA LICENÇA:\n• Nós concedemos a você uma licença limitada, não exclusiva e intransferível\n• Você pode usar o Aplicativo para fins pessoais e não comerciais\n• Esta licença não inclui revenda ou uso comercial\n• A licença termina quando sua assinatura termina\n\nCONTEÚDO DO USUÁRIO:\n• Você mantém a propriedade do conteúdo que cria no Aplicativo\n• Você nos concede uma licença para usar seu conteúdo para fornecer serviços\n• Você declara que tem direitos sobre qualquer conteúdo que enviar\n• Podemos remover conteúdo que viole estes Termos';

  @override
  String get termsSection9Title => '9. PRIVACIDADE E DADOS';

  @override
  String get termsSection9Content =>
      'COLETA E USO DE DADOS:\n• Coletamos e usamos dados conforme descrito em nossa Política de Privacidade\n• Revise nossa Política de Privacidade em: https://info.teambuildpro.com/privacy-policy.html\n• Ao usar o Aplicativo, você consente com nossas práticas de dados\n• Implementamos medidas de segurança para proteger seus dados\n\nSEUS DIREITOS DE PRIVACIDADE:\n• Você tem direitos em relação aos seus dados pessoais\n• Você pode solicitar acesso aos seus dados\n• Você pode solicitar a exclusão de sua conta e dados\n• Entre em contato conosco em support@teambuildpro.com para solicitações de privacidade\n\nSEGURANÇA DE DADOS:\n• Usamos medidas de segurança padrão da indústria\n• No entanto, nenhum sistema é completamente seguro\n• Você usa o Aplicativo por sua própria conta e risco\n• Relate problemas de segurança para support@teambuildpro.com';

  @override
  String get termsSection10Title => '10. SERVIÇOS E CONTEÚDO DE TERCEIROS';

  @override
  String get termsSection10Content =>
      'OPORTUNIDADES DE NEGÓCIOS:\n• O Aplicativo pode exibir informações sobre oportunidades de negócios de terceiros\n• Essas oportunidades são fornecidas por empresas independentes\n• Team Build Pro não é afiliado a essas oportunidades\n• Não endossamos nem garantimos nenhuma oportunidade de terceiros\n• Pesquise oportunidades independentemente antes de participar\n\nLINKS DE TERCEIROS:\n• O Aplicativo pode conter links para sites de terceiros\n• Não somos responsáveis por conteúdo ou práticas de terceiros\n• Sites de terceiros têm seus próprios termos e políticas de privacidade\n• Acesse conteúdo de terceiros por sua própria conta e risco\n\nINTEGRAÇÕES:\n• O Aplicativo pode se integrar com serviços de terceiros\n• Seu uso de serviços integrados está sujeito aos termos deles\n• Não somos responsáveis pelo desempenho de serviços de terceiros\n• As integrações podem ser modificadas ou descontinuadas a qualquer momento';

  @override
  String get termsSection11Title => '11. ISENÇÕES';

  @override
  String get termsSection11Content =>
      'SEM OPORTUNIDADE DE NEGÓCIO:\n• Team Build Pro é apenas um serviço de plataforma de networking\n• Não oferecemos nem garantimos nenhuma oportunidade de negócio\n• Não garantimos renda, ganhos ou sucesso\n• Qualquer informação de oportunidade de negócio vem de terceiros\n\nSERVIÇO FORNECIDO \"COMO ESTÁ\":\n• O Aplicativo é fornecido \"como está\" e \"conforme disponível\"\n• Não fazemos garantias sobre a confiabilidade ou disponibilidade do Aplicativo\n• Não garantimos serviço sem erros ou ininterrupto\n• Podemos modificar ou descontinuar recursos a qualquer momento\n\nSEM ACONSELHAMENTO PROFISSIONAL:\n• O Aplicativo não fornece aconselhamento legal, financeiro ou tributário\n• O coaching de IA é apenas para fins informativos\n• Consulte profissionais qualificados para decisões importantes\n• Não somos responsáveis por decisões baseadas no conteúdo do Aplicativo\n\nISENÇÃO DE RESULTADOS:\n• Os resultados individuais variam e não são garantidos\n• O sucesso depende do esforço individual e das circunstâncias\n• O desempenho passado não indica resultados futuros\n• Não fazemos representações sobre resultados potenciais';

  @override
  String get termsSection12Title => '12. LIMITAÇÃO DE RESPONSABILIDADE';

  @override
  String get termsSection12Content =>
      'NA MÁXIMA EXTENSÃO PERMITIDA POR LEI:\n\nNÃO SOMOS RESPONSÁVEIS POR:\n• Quaisquer danos indiretos, incidentais ou consequenciais\n• Perda de lucros, receita, dados ou oportunidades de negócios\n• Interrupções de serviço ou erros\n• Acesso não autorizado à sua conta ou dados\n• Ações ou conteúdo de terceiros\n• Quaisquer danos que excedam o valor que você nos pagou nos últimos 12 meses\n\nLIMITE DE RESPONSABILIDADE:\n• Nossa responsabilidade total é limitada às taxas de assinatura pagas nos últimos 12 meses\n• Isso se aplica independentemente da teoria legal de responsabilidade\n• Algumas jurisdições não permitem essas limitações\n• Nesses casos, a responsabilidade é limitada ao mínimo exigido por lei\n\nRESPONSABILIDADE DO USUÁRIO:\n• Você é responsável pelo seu uso do Aplicativo\n• Você é responsável por decisões baseadas no conteúdo do Aplicativo\n• Você assume todos os riscos associados ao uso do Aplicativo\n• Você concorda em avaliar oportunidades de negócios independentemente';

  @override
  String get termsSection13Title => '13. INDENIZAÇÃO';

  @override
  String get termsSection13Content =>
      'Você concorda em indenizar, defender e isentar Team Build Pro, seus oficiais, diretores, funcionários e agentes de quaisquer reclamações, danos, perdas, responsabilidades e despesas (incluindo honorários legais) decorrentes de:\n\n• Seu uso do Aplicativo\n• Sua violação destes Termos\n• Sua violação de quaisquer direitos de terceiros\n• Seu conteúdo ou informações publicadas no Aplicativo\n• Sua participação em qualquer oportunidade de negócio\n• Sua violação de leis ou regulamentos aplicáveis\n\nEsta obrigação de indenização sobrevive à terminação destes Termos e do seu uso do Aplicativo.';

  @override
  String get termsSection14Title => '14. RESOLUÇÃO DE DISPUTAS';

  @override
  String get termsSection14Content =>
      'LEI APLICÁVEL:\n• Estes Termos são regidos pelas leis do Estado de Utah, USA\n• A lei federal se aplica quando aplicável\n• Você consente com a jurisdição nos tribunais de Utah\n\nRESOLUÇÃO INFORMAL:\n• Entre em contato conosco primeiro para resolver disputas informalmente\n• Email: support@teambuildpro.com\n• Tentaremos resolver problemas de boa fé\n• A maioria das preocupações pode ser abordada através de comunicação\n\nARBITRAGEM (SE NECESSÁRIO):\n• Disputas podem estar sujeitas a arbitragem vinculante\n• Arbitragem conduzida sob as regras da American Arbitration Association\n• Arbitragem individual apenas - sem ações coletivas\n• Localização da arbitragem: Utah, USA\n\nEXCEÇÕES:\n• Qualquer parte pode buscar medidas cautelares em tribunal\n• Disputas de propriedade intelectual podem ser litigadas\n• O tribunal de pequenas causas permanece disponível para reclamações qualificadas';

  @override
  String get termsSection15Title => '15. MUDANÇAS NOS TERMOS';

  @override
  String get termsSection15Content =>
      'MODIFICAÇÕES:\n• Podemos atualizar estes Termos a qualquer momento\n• As mudanças entram em vigor mediante publicação no Aplicativo\n• O uso continuado constitui aceitação das mudanças\n• Mudanças materiais serão comunicadas por e-mail ou notificação do Aplicativo\n\nSUAS OPÇÕES:\n• Revise os Termos periodicamente para mudanças\n• Se você discordar das mudanças, pare de usar o Aplicativo\n• Cancele sua assinatura se não aceitar os novos Termos\n• Entre em contato com support@teambuildpro.com com perguntas\n\nDATA EFETIVA:\n• Versão atual efetiva a partir da data de publicação\n• Versões anteriores são substituídas\n• Mantemos registros das versões dos Termos';

  @override
  String get termsSection16Title => '16. DISPOSIÇÕES GERAIS';

  @override
  String get termsSection16Content =>
      'ACORDO COMPLETO:\n• Estes Termos constituem o acordo completo entre você e Team Build Pro\n• Eles substituem todos os acordos ou entendimentos anteriores\n• Os termos do EULA da Apple também se aplicam a compras da App Store\n\nSEPARABILIDADE:\n• Se alguma disposição for considerada inválida, o restante permanece em vigor\n• Disposições inválidas serão modificadas para serem executáveis\n• Os Termos permanecem vinculativos mesmo com disposições inválidas\n\nSEM RENÚNCIA:\n• Nossa falha em fazer cumprir qualquer direito não renuncia a esse direito\n• Renúncia de uma violação não renuncia a violações futuras\n• Todos os direitos e recursos são cumulativos\n\nATRIBUIÇÃO:\n• Você não pode atribuir estes Termos sem nosso consentimento\n• Podemos atribuir nossos direitos e obrigações\n• Os Termos vinculam sucessores e cessionários permitidos\n\nINFORMAÇÕES DE CONTATO:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nPolítica de Privacidade: https://info.teambuildpro.com/privacy-policy.html\n\nÚltima Atualização: Janeiro 2025';

  @override
  String get privacySection1Title => '1. INFORMAÇÕES QUE COLETAMOS';

  @override
  String get privacySection1Content =>
      'INFORMAÇÕES DA CONTA:\n• Nome e endereço de e-mail\n• Número de telefone (opcional)\n• Informações de perfil que você fornece\n• Credenciais de autenticação\n\nDADOS DE USO:\n• Interações com o aplicativo e recursos usados\n• Informações do dispositivo (modelo, versão do SO)\n• Dados de desempenho e falhas\n• Dados de análise (anonimizados quando possível)\n\nCONTEÚDO QUE VOCÊ CRIA:\n• Mensagens e comunicações\n• Informações de contato que você adiciona\n• Notas e dados de relacionamento\n• Arquivos e mídia que você envia\n\nDADOS DE LOCALIZAÇÃO:\n• Não coletamos dados de localização precisa\n• A localização geral pode ser derivada do endereço IP\n• Você pode gerenciar permissões de localização nas configurações do dispositivo';

  @override
  String get privacySection2Title => '2. COMO USAMOS SUAS INFORMAÇÕES';

  @override
  String get privacySection2Content =>
      'Usamos as informações coletadas para:\n\nFORNECER SERVIÇOS:\n• Criar e gerenciar sua conta\n• Habilitar recursos e funcionalidade do Aplicativo\n• Processar seus pagamentos de assinatura\n• Fornecer suporte ao cliente\n• Enviar notificações relacionadas ao serviço\n\nMELHORAR NOSSO APLICATIVO:\n• Analisar padrões de uso e tendências\n• Corrigir bugs e melhorar o desempenho\n• Desenvolver novos recursos\n• Realizar pesquisas e análises\n\nCOMUNICAÇÕES:\n• Enviar atualizações importantes do serviço\n• Responder às suas consultas\n• Fornecer suporte técnico\n• Enviar marketing opcional (você pode cancelar)\n\nCONFORMIDADE LEGAL:\n• Cumprir obrigações legais\n• Fazer cumprir nossos Termos de Serviço\n• Proteger direitos e segurança\n• Prevenir fraude e abuso';

  @override
  String get privacySection3Title => '3. COMO COMPARTILHAMOS SUAS INFORMAÇÕES';

  @override
  String get privacySection3Content =>
      'Compartilhamos informações apenas nestas circunstâncias limitadas:\n\nFORNECEDORES DE SERVIÇOS:\n• Hospedagem em nuvem (Firebase/Google Cloud)\n• Processamento de pagamentos (Apple)\n• Serviços de análise\n• Ferramentas de suporte ao cliente\n• Esses provedores são contratualmente obrigados a proteger seus dados\n\nREQUISITOS LEGAIS:\n• Quando exigido por lei ou processo legal\n• Para proteger direitos, propriedade ou segurança\n• Em conexão com processos legais\n• Para prevenir fraude ou atividade ilegal\n\nTRANSFERÊNCIAS COMERCIAIS:\n• Em conexão com fusão, aquisição ou venda de ativos\n• Seus dados podem ser transferidos para entidade sucessora\n• Você será notificado de qualquer transferência\n\nCOM SEU CONSENTIMENTO:\n• Quando você autoriza explicitamente o compartilhamento\n• Para propósitos que você aprova\n\nNÓS NÃO:\n• Vendemos suas informações pessoais\n• Compartilhamos dados para marketing de terceiros\n• Fornecemos dados para corretores de dados';

  @override
  String get privacySection4Title => '4. SEGURANÇA DE DADOS';

  @override
  String get privacySection4Content =>
      'MEDIDAS DE SEGURANÇA:\n• Criptografia padrão da indústria em trânsito e em repouso\n• Sistemas de autenticação seguros\n• Avaliações de segurança regulares\n• Controles de acesso e monitoramento\n• Centros de dados seguros (Google Cloud/Firebase)\n\nSUAS RESPONSABILIDADES:\n• Mantenha sua senha confidencial\n• Use recursos de segurança do dispositivo (senha, biometria)\n• Relate atividade suspeita imediatamente\n• Mantenha seu dispositivo e aplicativo atualizados\n\nLIMITAÇÕES:\n• Nenhum sistema é 100% seguro\n• Você usa o Aplicativo por sua própria conta e risco\n• Não podemos garantir segurança absoluta\n• Relate problemas de segurança para: support@teambuildpro.com';

  @override
  String get privacySection5Title => '5. SEUS DIREITOS DE PRIVACIDADE';

  @override
  String get privacySection5Content =>
      'Você tem os seguintes direitos em relação aos seus dados:\n\nACESSO E PORTABILIDADE:\n• Solicitar uma cópia de seus dados pessoais\n• Exportar seus dados em formato portátil\n• Revisar quais informações temos sobre você\n\nCORREÇÃO:\n• Atualizar informações imprecisas\n• Modificar os detalhes do seu perfil\n• Corrigir erros na sua conta\n\nEXCLUSÃO:\n• Solicitar exclusão de sua conta e dados\n• Usar o recurso \"Excluir Conta\" no Aplicativo\n• Alguns dados podem ser retidos para conformidade legal\n• A exclusão é permanente e não pode ser desfeita\n\nOPTAR POR NÃO PARTICIPAR:\n• Cancelar assinatura de e-mails de marketing\n• Desabilitar notificações push nas configurações do dispositivo\n• Limitar a coleta de dados de análise\n\nPARA EXERCER DIREITOS:\n• Use as configurações do aplicativo quando disponível\n• Email: support@teambuildpro.com\n• Responderemos dentro de 30 dias\n• Pode ser necessária verificação de identidade';

  @override
  String get privacySection6Title => '6. RETENÇÃO DE DADOS';

  @override
  String get privacySection6Content =>
      'QUANTO TEMPO MANTEMOS OS DADOS:\n\nCONTAS ATIVAS:\n• Dados retidos enquanto sua conta estiver ativa\n• Necessário para fornecer serviço contínuo\n• Você pode excluir dados ou conta a qualquer momento\n\nCONTAS EXCLUÍDAS:\n• A maioria dos dados excluída dentro de 30 dias\n• Alguns dados retidos para conformidade legal\n• Sistemas de backup purgados dentro de 90 dias\n• Registros financeiros mantidos conforme requisitos legais\n\nRETENÇÃO LEGAL:\n• Registros de transações: 7 anos (lei tributária)\n• Disputas legais: até resolução + estatuto de limitações\n• Prevenção de fraude: conforme exigido legalmente\n• Análises agregadas: indefinidamente (anonimizadas)\n\nSEU CONTROLE:\n• Solicitar exclusão a qualquer momento\n• Exportar dados antes da exclusão da conta\n• A exclusão é permanente e irreversível';

  @override
  String get privacySection7Title => '7. PRIVACIDADE DE CRIANÇAS';

  @override
  String get privacySection7Content =>
      'RESTRIÇÃO DE IDADE:\n• O Aplicativo não é destinado a usuários menores de 18 anos\n• Não coletamos dados de menores conscientemente\n• Você deve ter 18+ para criar uma conta\n\nSE FICARMOS SABENDO DE USUÁRIOS MENORES DE IDADE:\n• Excluiremos suas contas imediatamente\n• Excluiremos todos os dados associados\n• Tomaremos medidas para prevenir acesso futuro de menores\n\nDIREITOS PARENTAIS:\n• Os pais podem solicitar exclusão de dados de menores\n• Contato: support@teambuildpro.com\n• Forneça prova de relacionamento parental\n• Agiremos prontamente em solicitações verificadas';

  @override
  String get privacySection8Title => '8. MUDANÇAS NA POLÍTICA DE PRIVACIDADE';

  @override
  String get privacySection8Content =>
      'ATUALIZAÇÕES:\n• Podemos atualizar esta Política de Privacidade periodicamente\n• Mudanças publicadas no Aplicativo e em nosso site\n• Mudanças materiais comunicadas por e-mail ou notificação\n• O uso continuado significa aceitação das mudanças\n\nSUAS OPÇÕES:\n• Revise esta política regularmente\n• Entre em contato conosco com perguntas: support@teambuildpro.com\n• Pare de usar o Aplicativo se discordar das mudanças\n• Exclua sua conta se não aceitar as atualizações\n\nDATA EFETIVA:\n• Versão atual: Janeiro 2025\n• Última Atualização: Janeiro 2025\n• Versões anteriores são substituídas\n\nINFORMAÇÕES DE CONTATO:\nTeam Build Pro\nEmail: support@teambuildpro.com\nWebsite: https://www.teambuildpro.com\nTermos de Serviço: https://info.teambuildpro.com/terms-of-service.html';

  @override
  String get subscriptionScreenTitle => 'Team Build Pro';

  @override
  String get subscriptionSuccessMessage => '✅ Assinatura ativada com sucesso!';

  @override
  String get subscriptionRestoreSuccess =>
      '✅ Assinatura restaurada com sucesso!';

  @override
  String get subscriptionRestoreNone =>
      'Nenhuma assinatura anterior encontrada para restaurar.';

  @override
  String get subscriptionStatusTrial => 'Teste Gratuito Ativo';

  @override
  String subscriptionStatusTrialSubtitle(int days) {
    return '$days dias restantes no seu teste';
  }

  @override
  String get subscriptionPremiumFeaturesHeader => 'Recursos Premium:';

  @override
  String subscriptionFeatureReferralLink(String bizOpp) {
    return 'Envie seu link de indicação exclusivo de $bizOpp';
  }

  @override
  String get subscriptionFeatureAiCoaching =>
      'Treinamento de IA personalizado para recrutamento e construção de equipes';

  @override
  String get subscriptionFeatureMessaging =>
      'Desbloqueie mensagens para usuários da sua equipe';

  @override
  String subscriptionFeatureEnsureTeam(String bizOpp) {
    return 'Garanta que os membros da equipe entrem sob VOCÊ em $bizOpp';
  }

  @override
  String get subscriptionFeatureAnalytics => 'Análises avançadas e insights';

  @override
  String get subscriptionManagementApple =>
      'Você pode gerenciar sua assinatura nas configurações da sua conta Apple ID.';

  @override
  String get subscriptionManagementGoogle =>
      'Você pode gerenciar sua assinatura na Google Play Store.';

  @override
  String get faqTitle => 'Perguntas Frequentes';

  @override
  String get faqSearchHint => 'Buscar perguntas...';

  @override
  String get faqCategoryGettingStarted => 'Primeiros Passos';

  @override
  String get faqCategoryBusinessModel => 'Modelo de Negócio e Legitimidade';

  @override
  String get faqCategoryHowItWorks => 'Como Funciona';

  @override
  String get faqCategoryTeamBuilding => 'Construção e Gestão de Equipes';

  @override
  String get faqCategoryGlobalFeatures => 'Recursos Globais e Técnicos';

  @override
  String get faqCategoryPrivacySecurity => 'Privacidade e Segurança';

  @override
  String get faqCategoryPricing => 'Preços e Valor do Negócio';

  @override
  String get faqCategoryConcerns => 'Preocupações e Objeções Comuns';

  @override
  String get faqCategorySuccess => 'Sucesso e Resultados';

  @override
  String get faqCategorySupport => 'Suporte e Treinamento';

  @override
  String get faqQ1 => 'O que é exatamente o Team Build Pro?';

  @override
  String get faqA1 =>
      'Team Build Pro é uma ferramenta de software profissional projetada para ajudar profissionais de vendas diretas e construção de equipes a gerenciar e expandir suas redes de forma mais eficaz. É uma solução SaaS baseada em assinatura, não uma oportunidade de negócio ou empresa de MLM.';

  @override
  String get faqQ2 =>
      'O Team Build Pro é uma empresa de MLM ou marketing de rede?';

  @override
  String get faqA2 =>
      'Não. Team Build Pro é uma empresa de tecnologia que fornece software empresarial para profissionais de construção de equipes. Somos uma ferramenta SaaS legítima semelhante ao Salesforce ou HubSpot, mas focada nas necessidades únicas de profissionais de vendas diretas e construção de equipes.';

  @override
  String get faqQ3 =>
      'Por que o Team Build Pro é focado em profissionais de vendas diretas se você não é uma empresa de MLM?';

  @override
  String get faqA3 =>
      'Assim como o Salesforce atende representantes de vendas, atendemos profissionais de vendas diretas. Vendas diretas e marketing de rede são indústrias legítimas que precisam de software profissional. Somos a ferramenta, não a oportunidade de negócio.';

  @override
  String get faqQ4 => 'Como faço para me cadastrar?';

  @override
  String get faqA4 =>
      'Baixe o aplicativo Team Build Pro da App Store ou Google Play. Você pode se cadastrar usando um código de indicação de um membro existente ou diretamente através do nosso site. Novos usuários recebem uma avaliação gratuita de 30 dias, sem necessidade de cartão de crédito.';

  @override
  String get faqQ5 => 'Como o sistema de indicação funciona?';

  @override
  String get faqA5 =>
      'Os membros existentes podem compartilhar códigos de indicação com novos usuários. Quando alguém se cadastra com seu código, eles se tornam parte da sua rede no aplicativo. Este é simplesmente um recurso de rastreamento de rede - não há comissões, pagamentos ou estrutura de compensação envolvida.';

  @override
  String get faqQ6 => 'Como o Team Build Pro rastreia minha rede?';

  @override
  String get faqA6 =>
      'O aplicativo acompanha automaticamente os membros da sua equipe quando eles se cadastram usando seu código de indicação. Você pode visualizar toda a sua rede, crescimento da equipe e marcos de construção alcançados. A estrutura da rede é baseada em quem indicou quem, criando uma hierarquia visual da sua organização.';

  @override
  String get faqQ7 =>
      'Posso me comunicar com os membros da minha equipe através do aplicativo?';

  @override
  String get faqA7 =>
      'Sim! O Team Build Pro inclui mensagens diretas seguras, bate-papos em grupo e um sistema abrangente de notificações para manter você conectado com sua equipe. Você pode compartilhar atualizações, fornecer suporte e coordenar atividades de construção de equipes - tudo dentro do aplicativo.';

  @override
  String get faqQ8 =>
      'Posso convidar membros da equipe que não estão no aplicativo?';

  @override
  String get faqA8 =>
      'Absolutamente. O Team Build Pro permite que você envie códigos de indicação personalizados via SMS, e-mail ou mídias sociais. Novos membros podem se cadastrar usando esses códigos para se juntarem automaticamente à sua rede no sistema.';

  @override
  String get faqQ9 => 'O que são marcos de construção?';

  @override
  String get faqA9 =>
      'Marcos de construção são conquistas de crescimento de equipe que você desbloqueia à medida que sua rede se expande. Você recebe notificações quando membros da sua equipe atingem certos níveis, ajudando você a acompanhar o progresso e celebrar o sucesso juntos.';

  @override
  String get faqQ10 => 'Como funciona o rastreamento de elegibilidade?';

  @override
  String get faqA10 =>
      'O Team Build Pro permite que você configure e rastreie qualificações de elegibilidade personalizadas com base nos requisitos da sua oportunidade de negócio. Essas qualificações são visíveis para você e membros relevantes da equipe, ajudando todos a permanecerem no caminho certo com suas metas.';

  @override
  String get faqQ11 => 'Posso usar o Team Build Pro em vários países?';

  @override
  String get faqA11 =>
      'Sim! O Team Build Pro suporta mais de 120 países com suporte nativo para fuso horário, moedas locais e vários idiomas. Quer sua equipe esteja em Nova York, Londres, Tóquio ou São Paulo, todos veem informações relevantes localizadas.';

  @override
  String get faqQ12 => 'Quais idiomas o aplicativo suporta?';

  @override
  String get faqA12 =>
      'Atualmente suportamos inglês, espanhol, português e alemão, com planos de adicionar mais idiomas com base na demanda do usuário. O aplicativo detecta automaticamente a preferência de idioma do seu dispositivo.';

  @override
  String get faqQ13 =>
      'Como o Team Build Pro lida com diferentes fusos horários?';

  @override
  String get faqA13 =>
      'Todas as notificações, horários de eventos e registros de atividades são automaticamente ajustados para o fuso horário local de cada usuário. Isso garante que os membros da equipe global vejam informações precisas e relevantes, independentemente de onde estejam localizados.';

  @override
  String get faqQ14 => 'Minhas informações pessoais estão seguras?';

  @override
  String get faqA14 =>
      'Sim. Usamos criptografia de nível empresarial, comunicação segura de servidor para servidor e aderimos aos mais altos padrões de proteção de dados. Suas informações pessoais nunca são compartilhadas com terceiros sem seu consentimento explícito.';

  @override
  String get faqQ15 => 'Quem pode ver as informações da minha rede?';

  @override
  String get faqA15 =>
      'Somente você e seus patrocinadores diretos podem ver os detalhes completos da sua rede. Os membros da equipe podem ver sua própria linha ascendente e descendente, mas não podem acessar informações sobre ramos paralelos ou informações pessoais de outros membros sem as devidas permissões.';

  @override
  String get faqQ16 =>
      'O aplicativo armazena informações do meu cartão de crédito?';

  @override
  String get faqA16 =>
      'Não. Todo o processamento de pagamentos é feito através do sistema seguro de Compras no Aplicativo da Apple. Nunca vemos ou armazenamos suas informações de cartão de crédito. As assinaturas são gerenciadas através da sua conta Apple ID.';

  @override
  String get faqQ17 => 'Posso excluir minha conta e dados?';

  @override
  String get faqA17 =>
      'Sim. Você pode solicitar a exclusão completa da conta a qualquer momento através das configurações do aplicativo. Isso removerá permanentemente seus dados pessoais de nossos sistemas de acordo com as regulamentações do GDPR e LGPD.';

  @override
  String get faqQ18 => 'Quanto custa o Team Build Pro?';

  @override
  String get faqA18 =>
      'Oferecemos uma avaliação gratuita de 30 dias, após a qual o Team Build Pro custa \$6.99 USD por mês ou \$69.99 USD por ano (economize 17%). Os preços podem variar por região devido a taxas de câmbio e impostos locais.';

  @override
  String get faqQ19 => 'Existe um período de avaliação gratuito?';

  @override
  String get faqA19 =>
      'Sim! Todos os novos usuários recebem 30 dias completos de acesso premium sem necessidade de cartão de crédito. Experimente todos os recursos antes de se comprometer com uma assinatura.';

  @override
  String get faqQ20 => 'Como cancelo minha assinatura?';

  @override
  String get faqA20 =>
      'Cancele a qualquer momento através das configurações de assinatura da sua Apple App Store. Não há taxas de cancelamento ou períodos de compromisso. Seu acesso continua até o final do período de cobrança atual.';

  @override
  String get faqQ21 => 'Existe um plano familiar ou de equipe?';

  @override
  String get faqA21 =>
      'Cada membro da equipe mantém sua própria assinatura individual. Isso garante que todos tenham acesso total aos recursos e possam gerenciar sua própria conta de forma independente. Estamos explorando opções de licenciamento de equipe para futuras versões.';

  @override
  String get faqQ22 => 'Que valor eu recebo pela assinatura?';

  @override
  String get faqA22 =>
      'Por menos do que o custo de um café por mês, você obtém rastreamento profissional de rede, comunicação ilimitada de equipe, análises de crescimento, marcos automatizados, recursos de conformidade e suporte contínuo. Compare isso com software empresarial semelhante que custa \$50-500+ por mês.';

  @override
  String get faqQ23 => 'O Team Build Pro é um esquema de pirâmide?';

  @override
  String get faqA23 =>
      'Não. O Team Build Pro é uma ferramenta de software, não uma oportunidade de negócio. Não há recrutamento, pagamentos ou estruturas de compensação. Você está simplesmente pagando pela assinatura de software, assim como pagaria pelo Microsoft Office ou Adobe Creative Cloud.';

  @override
  String get faqQ24 =>
      'Por que preciso de um código de indicação para me cadastrar?';

  @override
  String get faqA24 =>
      'Códigos de indicação ajudam a estabelecer sua conexão de rede inicial no sistema. Isso garante um rastreamento adequado da rede e permite que você e seu patrocinador se comuniquem efetivamente através do aplicativo. Se você não tiver um código, pode se cadastrar diretamente através do nosso site.';

  @override
  String get faqQ25 => 'Serei forçado a recrutar ou vender algo?';

  @override
  String get faqA25 =>
      'Absolutamente não. O Team Build Pro é apenas uma ferramenta de software. Não vendemos produtos, não exigimos recrutamento e não temos metas de vendas. Como você usa o aplicativo para gerenciar sua própria atividade de construção de equipes depende inteiramente de você.';

  @override
  String get faqQ26 =>
      'Isso parece bom demais para ser verdade. Qual é o problema?';

  @override
  String get faqA26 =>
      'Não há problema. Somos uma ferramenta SaaS legítima que cobra uma taxa de assinatura mensal transparente por software profissional. Nenhuma taxa oculta, nenhum requisito de recrutamento, nenhuma promessa de riqueza. Apenas um bom software a um preço justo.';

  @override
  String get faqQ27 => 'Você faz promessas de renda?';

  @override
  String get faqA27 =>
      'Não. O Team Build Pro é uma ferramenta de software, não uma oportunidade de negócio. Não fazemos promessas de renda porque você não ganha dinheiro através do nosso aplicativo. Você paga por uma ferramenta para ajudá-lo a gerenciar suas próprias atividades de construção de equipes.';

  @override
  String get faqQ28 => 'Como posso saber que o Team Build Pro é legítimo?';

  @override
  String get faqA28 =>
      'Somos uma empresa de software registrada com um aplicativo ao vivo na Apple App Store (que tem rigorosos processos de revisão). Não pedimos compras iniciais, não fazemos promessas não realistas e somos transparentes sobre o que nosso software faz. Temos termos de serviço claros, política de privacidade e informações de contato de suporte.';

  @override
  String get faqQ29 => 'Com que rapidez minha rede vai crescer?';

  @override
  String get faqA29 =>
      'Não podemos prever o crescimento da rede porque isso depende inteiramente de suas próprias atividades de construção de equipes. O Team Build Pro simplesmente ajuda você a rastrear e gerenciar qualquer crescimento que você crie através de seus próprios esforços.';

  @override
  String get faqQ30 => 'Quais resultados posso esperar?';

  @override
  String get faqA30 =>
      'Você pode esperar melhor organização, comunicação mais clara e rastreamento mais fácil de suas atividades de construção de equipes. O Team Build Pro é uma ferramenta para eficiência - seus resultados reais dependem de como você a usa e de suas próprias atividades comerciais.';

  @override
  String get faqQ31 => 'Outras pessoas tiveram sucesso com o Team Build Pro?';

  @override
  String get faqA31 =>
      'Muitos usuários relatam melhor organização de equipe, comunicação mais fácil e melhor rastreamento de crescimento. No entanto, lembre-se de que o Team Build Pro é apenas uma ferramenta - o sucesso vem de seus próprios esforços de construção de equipes, não do software em si.';

  @override
  String get faqQ32 => 'Posso ver depoimentos ou avaliações?';

  @override
  String get faqA32 =>
      'Você pode ver avaliações de usuários verificados na Apple App Store. Concentramos depoimentos nos recursos de software e experiência do usuário, não em resultados de negócios, já que o Team Build Pro é uma ferramenta, não uma oportunidade de negócio.';

  @override
  String get faqQ33 =>
      'O que torna o Team Build Pro diferente de outras ferramentas?';

  @override
  String get faqA33 =>
      'Fomos projetados especificamente para construção de equipes e redes de vendas diretas. Enquanto outras ferramentas oferecem recursos genéricos de CRM, fornecemos rastreamento de rede especializado, marcos de construção, comunicação em equipe e recursos de conformidade adaptados às suas necessidades únicas.';

  @override
  String get faqQ34 => 'Qual treinamento ou suporte é fornecido?';

  @override
  String get faqA34 =>
      'Fornecemos documentação abrangente no aplicativo, perguntas frequentes, uma seção de Primeiros Passos e e-mail de suporte. Novos usuários também recebem notificações de integração para ajudá-los a aprender os principais recursos. Atualizamos regularmente nossos recursos de ajuda com base no feedback do usuário.';

  @override
  String get faqQ35 => 'Posso obter treinamento individual?';

  @override
  String get faqA35 =>
      'Para problemas de software, nosso suporte por e-mail fornece assistência personalizada. Para orientação de construção de equipes, recomendamos trabalhar com seu patrocinador ou organização. Focamos em suporte de software, não em treinamento de negócios.';

  @override
  String get faqQ36 => 'Com que frequência o aplicativo é atualizado?';

  @override
  String get faqA36 =>
      'Lançamos atualizações regulares com novos recursos, melhorias de desempenho e correções de bugs. Todas as atualizações são gratuitas para assinantes. Você pode ver nossas notas de versão na App Store para ver melhorias recentes.';

  @override
  String get faqQ37 => 'O Team Build Pro funciona offline?';

  @override
  String get faqA37 =>
      'Você pode visualizar dados previamente carregados offline, mas a maioria dos recursos requer conexão com a internet para sincronização em tempo real. Isso garante que você e sua equipe sempre vejam as informações mais atualizadas.';

  @override
  String get faqQ38 => 'O que é o Coach de IA e como ele funciona?';

  @override
  String get faqA38 =>
      'O Coach de IA ajuda você a navegar pelo aplicativo Team Build Pro, responde perguntas sobre recursos e requisitos de qualificação, fornece orientação sobre construção de equipes e pode sugerir quais seções do aplicativo visitar para tarefas específicas.';

  @override
  String get faqQ39 =>
      'Vocês fornecem treinamento sobre como recrutar ou vender?';

  @override
  String get faqA39 =>
      'Focamos em mostrar como usar o Team Build Pro efetivamente. Para treinamento em vendas e recrutamento, recomendamos trabalhar com seu patrocinador ou os programas de treinamento da sua empresa.';

  @override
  String get faqQ40 => 'E se eu tiver problemas técnicos?';

  @override
  String get faqA40 =>
      'Entre em contato com nossa equipe de suporte através do aplicativo ou site. A maioria dos problemas é resolvida rapidamente, e estamos comprometidos em manter suas atividades de construção de equipes funcionando perfeitamente.';

  @override
  String get faqFooterTitle =>
      'Pronto para Transformar sua Construção de Equipes?';

  @override
  String get faqFooterSubtitle =>
      'Comece seu teste gratuito de 30 dias hoje e experimente a diferença que as ferramentas profissionais fazem.';

  @override
  String get faqFooterContact =>
      'Perguntas não respondidas aqui? Entre em contato com nossa equipe de suporte - estamos aqui para ajudá-lo a ter sucesso!';

  @override
  String get bizOppEducationTitle => 'Garanta Sua Posição de Patrocínio!';

  @override
  String get bizOppEducationWorksTitle => 'Como Funciona o Patrocínio';

  @override
  String bizOppEducationWorksBody(String business) {
    return 'Quando os membros da sua equipe entrarem em $business, o patrocinador deles será a PRIMEIRA pessoa na linha ascendente que já entrou.';
  }

  @override
  String get bizOppEducationBenefitsTitle => 'Entre agora para garantir:';

  @override
  String get bizOppEducationBenefit1 =>
      'Seus recrutas são patrocinados sob VOCÊ';

  @override
  String get bizOppEducationBenefit2 =>
      'Você recebe crédito pela atividade deles';

  @override
  String get bizOppEducationBenefit3 => 'Você não perde esta oportunidade';

  @override
  String get bizOppEducationRemindLater => 'Lembrar Mais Tarde';

  @override
  String get bizOppEducationJoinNow => 'Entrar Agora';

  @override
  String get sharePartnerImportantLabel => 'Importante:';

  @override
  String sharePartnerImportantText(String business) {
    return 'Recomendamos fortemente que você compartilhe o aplicativo Team Build Pro com os membros da sua equipe de primeira linha de $business (indivíduos que você patrocinou pessoalmente) antes de compartilhar com membros da equipe de $business que você não patrocinou pessoalmente. Isso proporcionará uma oportunidade de respeitar os relacionamentos de patrocínio estabelecidos na sua linha descendente de $business.';
  }

  @override
  String get bizProgressTitle => 'Progresso do Registro';

  @override
  String get bizProgressStep1 => 'Copiar Link de Registro';

  @override
  String get bizProgressStep2 => 'Concluir Registro';

  @override
  String get bizProgressStep3 => 'Adicionar Seu Link de Indicação';

  @override
  String get hiwTitle => 'Como Funciona';

  @override
  String get hiwSubtitle =>
      'Transforme seu recrutamento com uma equipe pré-qualificada.';

  @override
  String get hiwFeaturedOpp => 'Oportunidade em Destaque';

  @override
  String get hiwPipelineSystem => 'SISTEMA DE PIPELINE';

  @override
  String get hiwStep1Title => 'Defina Sua Base';

  @override
  String get hiwStep1Desc =>
      'Personalize sua conta do Team Build Pro com os detalhes da sua oportunidade e conecte seu link de indicação - transformando o aplicativo em seu pipeline pessoal de recrutamento.';

  @override
  String get hiwStep2Title => 'Construa de Forma Inteligente, Não Difícil';

  @override
  String get hiwStep2Desc =>
      'Compartilhe o Team Build Pro com prospects e membros da equipe existentes. Os membros atuais da equipe criam impulso instantâneo, e os prospects de recrutamento experimentam um verdadeiro sucesso na construção da equipe antes de ingressar em sua oportunidade, eliminando o problema do \"início frio\".';

  @override
  String get hiwStep3Title => 'Qualificação Automática';

  @override
  String get hiwStep3Desc =>
      'Quando os prospects de recrutamento atingem nossos marcos de sucesso (3 patrocinadores diretos + 12 membros totais da equipe), eles recebem automaticamente um convite para ingressar em sua oportunidade.';

  @override
  String get hiwStep4Title => 'Crescimento Rápido';

  @override
  String get hiwStep4Desc =>
      'À medida que sua organização do Team Build Pro se expande, cada líder qualificado alimenta novos prospects pré-treinados em sua oportunidade - criando um motor de crescimento autossustentável.';

  @override
  String get hiwKeyTargets => 'METAS CHAVE DE CRESCIMENTO';

  @override
  String get hiwDirectSponsors => 'Patrocinadores Diretos';

  @override
  String get hiwTotalTeam => 'Total de Membros da Equipe';

  @override
  String get hiwGrowNetwork => 'Expanda Sua Rede';

  @override
  String get hiwExpandNetwork =>
      'Expanda sua Rede para impulsionar o crescimento da organização!';

  @override
  String get hiwProvenStrategies => 'Estratégias Comprovadas de Crescimento';

  @override
  String get pmTitle => 'Criar Conta';

  @override
  String get pmDialogTitle => 'Termos Importantes';

  @override
  String get pmDialogIntro =>
      'Você está criando uma nova conta de administrador separada. Ao continuar, você entende e concorda com o seguinte:';

  @override
  String get pmTerm1 =>
      'Esta nova conta é completamente separada e não pode ser mesclada com sua conta atual.';

  @override
  String pmTerm2(String bizOpp) {
    return 'Sua equipe existente de \"$bizOpp\" não é transferível.';
  }

  @override
  String get pmTerm3 =>
      'Esta conta deve ser usada para uma oportunidade de negócio nova e diferente.';

  @override
  String get pmTerm4 =>
      'A promoção cruzada ou recrutamento de membros entre suas contas separadas é estritamente proibido.';

  @override
  String get pmTerm5 =>
      'A violação destes termos pode resultar na suspensão ou cancelamento de TODAS as suas contas associadas.';

  @override
  String get pmAgreeTerms => 'Eu entendo e concordo com estes termos';

  @override
  String get pmCancel => 'Cancelar';

  @override
  String get pmContinue => 'Continuar';

  @override
  String get pmCardTitle => 'Gerenciar Outra Oportunidade';

  @override
  String get pmCardDesc =>
      'Crie uma conta separada para gerenciar e expandir uma oportunidade diferente.';

  @override
  String get pmCreateButton => 'Criar Nova Conta';

  @override
  String get authSignupTitle => 'Registro de Conta';

  @override
  String get authSignupCreateLoginHeader => 'Crie Seu Login';

  @override
  String get authSignupEmailPrivacy =>
      'Seu e-mail nunca será compartilhado com ninguém';

  @override
  String get adminEditProfileTitle => 'Configuração do Negócio';

  @override
  String get adminEditProfileHeaderTitle => 'Sua Oportunidade de Negócio';

  @override
  String get adminEditProfileWarningCannotChange =>
      '⚠️ Importante: Esta informação não pode ser alterada após salvar.';

  @override
  String get adminEditProfileWarningExplanation =>
      'O nome da sua oportunidade de negócio e o link de referência garantem que os membros do Team Build Pro sejam colocados com precisão na sua linha descendente de oportunidade de negócio quando se qualificarem. Alterar isso quebraria a conexão entre suas redes.';

  @override
  String get adminEditProfileLabelBizOppName =>
      'Nome da Sua Oportunidade de Negócio';

  @override
  String get adminEditProfileHelperCannotChange =>
      'Isto não pode ser alterado após definido';

  @override
  String get adminEditProfileLabelBizOppNameConfirm =>
      'Confirmar Nome da Oportunidade de Negócio';

  @override
  String get adminEditProfileLabelReferralLink => 'Seu Link de Referência';

  @override
  String get adminEditProfileLabelReferralLinkConfirm =>
      'Confirmar URL do Link de Referência';

  @override
  String get adminEditProfileValidationRequired => 'Obrigatório';

  @override
  String get adminEditProfileDialogErrorTitle => 'Erro no Link de Referência';

  @override
  String get adminEditProfileDialogErrorHelper =>
      'Por favor, verifique seu link de referência e tente novamente.';

  @override
  String get adminEditProfileDialogImportantTitle => 'Muito Importante!';

  @override
  String get adminEditProfileDialogImportantMessage =>
      'Você deve inserir o link de referência exato que recebeu da sua empresa. Isso garantirá que os membros da sua equipe que se juntarem à sua oportunidade de negócio sejam automaticamente colocados na sua equipe de oportunidade de negócio.';

  @override
  String get adminEditProfileButtonUnderstand => 'Eu Entendo';

  @override
  String get adminEditProfilePreviewTitle =>
      'Visualização do Link de Referência:';

  @override
  String get adminEditProfileButtonComplete => 'Completar Perfil e Começar!';

  @override
  String get adminEditProfileSuccessSaved => 'Perfil completado com sucesso!';

  @override
  String adminEditProfileErrorSaving(String error) {
    return 'Erro: $error';
  }

  @override
  String get adminEditProfileValidationBizNameRequired =>
      'Por favor, insira o nome da sua oportunidade de negócio';

  @override
  String get adminEditProfileValidationBizNameConfirmRequired =>
      'Por favor, confirme o nome da sua oportunidade de negócio';

  @override
  String get adminEditProfileValidationReferralLinkRequired =>
      'Por favor, insira seu link de referência';

  @override
  String get adminEditProfileValidationReferralLinkConfirmRequired =>
      'Por favor, confirme seu link de referência';

  @override
  String get adminEditProfileValidationBizNameInvalidChars =>
      'O nome do negócio só pode conter letras, números e pontuação comum.';

  @override
  String get adminEditProfileValidationUrlBasic =>
      'Por favor, insira um link de referência válido (ex., https://exemplo.com).';

  @override
  String get adminEditProfileValidationBizNameMismatch =>
      'Os campos de Nome do Negócio devem coincidir para confirmação.';

  @override
  String get adminEditProfileValidationReferralLinkMismatch =>
      'Os campos de Link de Referência devem coincidir para confirmação.';

  @override
  String get adminEditProfileValidationUrlInvalid =>
      'Por favor, insira uma URL válida (ex., https://exemplo.com)';

  @override
  String get adminEditProfileValidationUrlNotHttps =>
      'O link de referência deve usar HTTPS (não HTTP) por segurança';

  @override
  String get adminEditProfileValidationUrlLocalhost =>
      'Por favor, insira um link de referência de negócio válido\n(não localhost ou endereço IP)';

  @override
  String get adminEditProfileValidationUrlNoTld =>
      'Por favor, insira uma URL válida com um domínio apropriado\n(ex., empresa.com)';

  @override
  String get adminEditProfileValidationUrlHomepageOnly =>
      'Por favor, insira seu link de referência completo, não apenas a página inicial.\nSeu link de referência deve incluir seu identificador único\n(ex., https://empresa.com/juntar?ref=seunome)';

  @override
  String get adminEditProfileValidationUrlFormat =>
      'Formato de URL inválido. Por favor, verifique seu link de referência.';

  @override
  String get adminEditProfileValidationUrlVerificationFailed =>
      'O link de referência que você inseriu não pôde ser verificado. Por favor, verifique sua conexão com a internet e tente novamente.';

  @override
  String get adminEditProfileValidationUrlVerificationError =>
      'O link de referência que você inseriu não pôde ser verificado. Por favor, verifique a URL e tente novamente.';
}
