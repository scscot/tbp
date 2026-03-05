#!/usr/bin/env node
/**
 * Team Build Pro - App Update Email Script
 *
 * Sends a one-time update email to existing Team Build Pro users
 * announcing the v1.0.83 release with improved share messages.
 *
 * Usage:
 *   node scripts/send-app-update-email.js --dry-run     # Preview without sending
 *   node scripts/send-app-update-email.js --test        # Send test email to yourself
 *   node scripts/send-app-update-email.js --send        # Send to all users
 *   node scripts/send-app-update-email.js --stats       # Show user counts
 *
 * Environment:
 *   Requires Firebase Admin SDK and Mailgun credentials from functions/.env
 */

const admin = require('firebase-admin');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const FROM_ADDRESS = 'Stephen Scott <stephen@news.teambuildpro.com>';
const SUBJECT = 'Team Build Pro Update: New Features to Help You Grow Faster';
const LANDING_PAGE_URL = 'https://teambuildpro.com';
const IOS_APP_URL = 'https://apps.apple.com/us/app/id6751211622';
const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.scott.ultimatefix';

// Campaign tracking
const UTM_SOURCE = 'mailgun';
const UTM_MEDIUM = 'email';
const UTM_CAMPAIGN = 'app_update_v1083';
const UTM_CONTENT = 'update_email';

// Language-specific landing pages
const LANDING_PAGES = {
  en: 'https://teambuildpro.com',
  es: 'https://es.teambuildpro.com',
  pt: 'https://pt.teambuildpro.com',
  de: 'https://de.teambuildpro.com'
};

// Country to language mapping
const COUNTRY_LANGUAGE_MAP = {
  // Spanish-speaking
  'Spain': 'es', 'Mexico': 'es', 'Argentina': 'es', 'Colombia': 'es', 'Chile': 'es',
  'Peru': 'es', 'Venezuela': 'es', 'Ecuador': 'es', 'Guatemala': 'es', 'Cuba': 'es',
  'Bolivia': 'es', 'Dominican Republic': 'es', 'Honduras': 'es', 'Paraguay': 'es',
  'El Salvador': 'es', 'Nicaragua': 'es', 'Costa Rica': 'es', 'Panama': 'es', 'Uruguay': 'es',
  // Portuguese-speaking
  'Brazil': 'pt', 'Portugal': 'pt', 'Angola': 'pt', 'Mozambique': 'pt',
  // German-speaking
  'Germany': 'de', 'Austria': 'de', 'Switzerland': 'de', 'Liechtenstein': 'de', 'Luxembourg': 'de'
};

// Localized content
const TRANSLATIONS = {
  en: {
    subject: 'Team Build Pro Update: New Features to Help You Grow Faster',
    greeting: (name) => `Hi ${name},`,
    intro: 'Quick update — we just released a new version of Team Build Pro with improvements designed to help you and your team grow faster.',
    whatsNewTitle: "What's New:",
    feature1Title: 'Enhanced Share Messages',
    feature1: 'All 16 recruiting messages now work seamlessly in English, Spanish, Portuguese, and German. Share with confidence knowing your message looks professional in any language.',
    feature2Title: 'Improved User Experience',
    feature2: 'Cleaner interface, faster navigation, and smoother interactions throughout the app.',
    feature3Title: 'Better Localization',
    feature3: "If you have international team members, they'll now have a more polished experience in their native language.",
    whyMattersTitle: 'Why This Matters for Your Team:',
    whyMatters: 'The easier it is for your recruits to use the app, the faster they build momentum. These updates remove friction so your entire organization can focus on what matters — growing their teams.',
    downloadTitle: 'Get the Latest Version:',
    iosLink: 'Download on the App Store',
    iosDevice: '(iPhone/iPad)',
    androidLink: 'Download on Google Play',
    androidDevice: '(Android)',
    autoUpdate: 'If you have automatic updates enabled, you may already have the new version. If not, tap the link above to get the latest.',
    questions: 'Questions? Just reply to this email.',
    closing: 'To your success,',
    unsubscribe: 'Unsubscribe',
    footerNote: "You're receiving this because you're a Team Build Pro user."
  },
  es: {
    subject: 'Actualización de Team Build Pro: Nuevas funciones para ayudarte a crecer más rápido',
    greeting: (name) => `Hola ${name},`,
    intro: 'Una actualización rápida — acabamos de lanzar una nueva versión de Team Build Pro con mejoras diseñadas para ayudarte a ti y a tu equipo a crecer más rápido.',
    whatsNewTitle: 'Novedades:',
    feature1Title: 'Mensajes mejorados para compartir',
    feature1: 'Los 16 mensajes de reclutamiento ahora funcionan perfectamente en inglés, español, portugués y alemán. Comparte con confianza sabiendo que tu mensaje se ve profesional en cualquier idioma.',
    feature2Title: 'Experiencia de usuario mejorada',
    feature2: 'Interfaz más limpia, navegación más rápida e interacciones más fluidas en toda la aplicación.',
    feature3Title: 'Mejor localización',
    feature3: 'Si tienes miembros del equipo internacionales, ahora tendrán una experiencia más pulida en su idioma nativo.',
    whyMattersTitle: 'Por qué esto es importante para tu equipo:',
    whyMatters: 'Cuanto más fácil sea para tus reclutas usar la aplicación, más rápido ganarán impulso. Estas actualizaciones eliminan la fricción para que toda tu organización pueda enfocarse en lo que importa: hacer crecer sus equipos.',
    downloadTitle: 'Obtén la última versión:',
    iosLink: 'Descargar en App Store',
    iosDevice: '(iPhone/iPad)',
    androidLink: 'Descargar en Google Play',
    androidDevice: '(Android)',
    autoUpdate: 'Si tienes las actualizaciones automáticas activadas, es posible que ya tengas la nueva versión. Si no, toca el enlace de arriba para obtener la última.',
    questions: '¿Preguntas? Solo responde a este correo.',
    closing: 'Para tu éxito,',
    unsubscribe: 'Cancelar suscripción',
    footerNote: 'Recibes esto porque eres usuario de Team Build Pro.'
  },
  pt: {
    subject: 'Atualização do Team Build Pro: Novos recursos para ajudá-lo a crescer mais rápido',
    greeting: (name) => `Olá ${name},`,
    intro: 'Atualização rápida — acabamos de lançar uma nova versão do Team Build Pro com melhorias projetadas para ajudar você e sua equipe a crescer mais rápido.',
    whatsNewTitle: 'Novidades:',
    feature1Title: 'Mensagens de compartilhamento aprimoradas',
    feature1: 'Todas as 16 mensagens de recrutamento agora funcionam perfeitamente em inglês, espanhol, português e alemão. Compartilhe com confiança sabendo que sua mensagem parece profissional em qualquer idioma.',
    feature2Title: 'Experiência do usuário melhorada',
    feature2: 'Interface mais limpa, navegação mais rápida e interações mais suaves em todo o aplicativo.',
    feature3Title: 'Melhor localização',
    feature3: 'Se você tem membros da equipe internacionais, eles agora terão uma experiência mais polida em seu idioma nativo.',
    whyMattersTitle: 'Por que isso é importante para sua equipe:',
    whyMatters: 'Quanto mais fácil for para seus recrutados usarem o aplicativo, mais rápido eles ganharão impulso. Essas atualizações removem o atrito para que toda a sua organização possa se concentrar no que importa — crescer suas equipes.',
    downloadTitle: 'Obtenha a versão mais recente:',
    iosLink: 'Baixar na App Store',
    iosDevice: '(iPhone/iPad)',
    androidLink: 'Baixar no Google Play',
    androidDevice: '(Android)',
    autoUpdate: 'Se você tem atualizações automáticas ativadas, pode ser que já tenha a nova versão. Se não, toque no link acima para obter a mais recente.',
    questions: 'Perguntas? Basta responder a este e-mail.',
    closing: 'Para o seu sucesso,',
    unsubscribe: 'Cancelar inscrição',
    footerNote: 'Você está recebendo isso porque é um usuário do Team Build Pro.'
  },
  de: {
    subject: 'Team Build Pro Update: Neue Funktionen für schnelleres Wachstum',
    greeting: (name) => `Hallo ${name},`,
    intro: 'Kurzes Update — wir haben gerade eine neue Version von Team Build Pro veröffentlicht, mit Verbesserungen, die dir und deinem Team helfen, schneller zu wachsen.',
    whatsNewTitle: 'Was ist neu:',
    feature1Title: 'Verbesserte Teilen-Nachrichten',
    feature1: 'Alle 16 Recruiting-Nachrichten funktionieren jetzt nahtlos auf Englisch, Spanisch, Portugiesisch und Deutsch. Teile mit Zuversicht, denn deine Nachricht sieht in jeder Sprache professionell aus.',
    feature2Title: 'Verbesserte Benutzererfahrung',
    feature2: 'Klarere Oberfläche, schnellere Navigation und flüssigere Interaktionen in der gesamten App.',
    feature3Title: 'Bessere Lokalisierung',
    feature3: 'Wenn du internationale Teammitglieder hast, werden sie jetzt eine bessere Erfahrung in ihrer Muttersprache haben.',
    whyMattersTitle: 'Warum das für dein Team wichtig ist:',
    whyMatters: 'Je einfacher es für deine Rekruten ist, die App zu nutzen, desto schneller gewinnen sie an Schwung. Diese Updates beseitigen Reibungspunkte, damit sich deine gesamte Organisation auf das konzentrieren kann, was zählt — ihre Teams aufzubauen.',
    downloadTitle: 'Hol dir die neueste Version:',
    iosLink: 'Im App Store herunterladen',
    iosDevice: '(iPhone/iPad)',
    androidLink: 'Bei Google Play herunterladen',
    androidDevice: '(Android)',
    autoUpdate: 'Wenn du automatische Updates aktiviert hast, hast du möglicherweise bereits die neue Version. Wenn nicht, tippe auf den Link oben, um die neueste zu erhalten.',
    questions: 'Fragen? Antworte einfach auf diese E-Mail.',
    closing: 'Zu deinem Erfolg,',
    unsubscribe: 'Abmelden',
    footerNote: 'Du erhältst diese E-Mail, weil du Team Build Pro Nutzer bist.'
  }
};

// Rate limiting
const SEND_DELAY_MS = 1000; // 1 second between emails
const BATCH_SIZE = 50; // Emails per batch before pause
const BATCH_PAUSE_MS = 5000; // 5 second pause between batches

// =============================================================================
// FIREBASE INITIALIZATION
// =============================================================================

const serviceAccountPath = path.join(__dirname, '../secrets/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
}

const db = admin.firestore();

// =============================================================================
// LANGUAGE DETECTION
// =============================================================================

function detectLanguage(user) {
  // Priority 1: User's explicit preferred language
  if (user.preferredLanguage && ['en', 'es', 'pt', 'de'].includes(user.preferredLanguage)) {
    return user.preferredLanguage;
  }

  // Priority 2: Infer from country
  if (user.country && COUNTRY_LANGUAGE_MAP[user.country]) {
    return COUNTRY_LANGUAGE_MAP[user.country];
  }

  // Default to English
  return 'en';
}

// Header taglines per language
const HEADER_TAGLINES = {
  en: 'AI-Powered Mobile App for Direct Sales Growth',
  es: 'App Móvil con IA para el Crecimiento en Ventas Directas',
  pt: 'App Móvel com IA para Crescimento em Vendas Diretas',
  de: 'KI-gestützte Mobile App für Direktvertriebswachstum'
};

// =============================================================================
// EMAIL HTML TEMPLATE (v14/v16 Professional Style - Localized)
// =============================================================================

function generateEmailHTML(firstName, lang = 'en') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const headerTagline = HEADER_TAGLINES[lang] || HEADER_TAGLINES.en;
  const unsubscribeUrl = `${landingPage}/unsubscribe.html`;

  // Build tracked URLs
  const landingUrl = buildTrackedUrl(landingPage, 'cta_main');
  const iosUrl = buildTrackedUrl(IOS_APP_URL, 'cta_ios');
  const androidUrl = buildTrackedUrl(ANDROID_APP_URL, 'cta_android');

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <!-- Gradient Header -->
    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          ${headerTagline}
        </span>
      </h1>
    </div>

    <!-- White Card Body -->
    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">
        ${t.greeting(firstName)}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.intro}
      </p>

      <p style="margin:0 0 8px 0; font-weight:600; color:#0c1f3f;">
        ${t.whatsNewTitle}
      </p>

      <ul style="margin:0 0 16px 20px; padding:0;">
        <li style="margin-bottom:8px;"><strong>${t.feature1Title}</strong> — ${t.feature1}</li>
        <li style="margin-bottom:8px;"><strong>${t.feature2Title}</strong> — ${t.feature2}</li>
        <li style="margin-bottom:0;"><strong>${t.feature3Title}</strong> — ${t.feature3}</li>
      </ul>

      <p style="margin:0 0 8px 0; font-weight:600; color:#0c1f3f;">
        ${t.whyMattersTitle}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.whyMatters}
      </p>

      <p style="margin:0 0 8px 0; font-weight:600; color:#0c1f3f;">
        ${t.downloadTitle}
      </p>

      <p style="margin:0 0 8px 0;">
        <a href="${iosUrl}" style="color:#1a73e8; text-decoration:underline;">${t.iosLink}</a> ${t.iosDevice}
      </p>

      <p style="margin:0 0 16px 0;">
        <a href="${androidUrl}" style="color:#1a73e8; text-decoration:underline;">${t.androidLink}</a> ${t.androidDevice}
      </p>

      <p style="margin:0 0 16px 0; font-size:14px; color:#555555;">
        ${t.autoUpdate}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.questions}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.closing}<br>
        Stephen Scott<br>
        <span style="color:#555555;">Creator, Team Build Pro</span>
      </p>

      <!-- Footer -->
      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="${landingUrl}" style="color:#1a73e8; text-decoration:underline;">${landingPage.replace('https://', '')}</a>
        &nbsp;·&nbsp;
        <a href="${unsubscribeUrl}" style="color:#777777; text-decoration:underline;">${t.unsubscribe}</a>
        <br><br>
        <span style="font-size:11px; color:#999999;">
          ${t.footerNote}
        </span>
      </div>
    </div>

  </div>
</body>
</html>`;
}

function generateEmailPlainText(firstName, lang = 'en') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const iosUrl = buildTrackedUrl(IOS_APP_URL, 'cta_ios');
  const androidUrl = buildTrackedUrl(ANDROID_APP_URL, 'cta_android');
  const unsubscribeUrl = `${landingPage}/unsubscribe.html`;

  return `${t.greeting(firstName)}

${t.intro}

${t.whatsNewTitle.toUpperCase()}

* ${t.feature1Title} — ${t.feature1}

* ${t.feature2Title} — ${t.feature2}

* ${t.feature3Title} — ${t.feature3}

${t.whyMattersTitle.toUpperCase()}

${t.whyMatters}

${t.downloadTitle.toUpperCase()}

iPhone/iPad: ${iosUrl}

Android: ${androidUrl}

${t.autoUpdate}

${t.questions}

${t.closing}
Stephen Scott
Team Build Pro

---
${landingPage.replace('https://', '')}
${t.unsubscribe}: ${unsubscribeUrl}

${t.footerNote}`;
}

function buildTrackedUrl(baseUrl, content) {
  const params = new URLSearchParams({
    utm_source: UTM_SOURCE,
    utm_medium: UTM_MEDIUM,
    utm_campaign: UTM_CAMPAIGN,
    utm_content: content
  });

  // Handle URLs that already have query params
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${params.toString()}`;
}

// =============================================================================
// MAILGUN SENDER
// =============================================================================

async function sendEmailViaMailgun(user) {
  if (!MAILGUN_API_KEY) {
    throw new Error('TBP_MAILGUN_API_KEY not configured in environment');
  }

  const firstName = user.firstName || user.displayName?.split(' ')[0] || 'there';
  const email = user.email;
  const displayName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;

  // Detect user's language
  const lang = detectLanguage(user);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;

  const htmlContent = generateEmailHTML(firstName, lang);
  const textContent = generateEmailPlainText(firstName, lang);
  const unsubscribeUrl = `${landingPage}/unsubscribe.html?email=${encodeURIComponent(email)}`;
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', `${displayName} <${email}>`);
  form.append('subject', t.subject);
  form.append('html', htmlContent);
  form.append('text', textContent);

  // Mailgun tracking disabled — clicks tracked via GA4 UTM parameters
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');

  // Tags for analytics
  form.append('o:tag', 'app_update');
  form.append('o:tag', UTM_CAMPAIGN);
  form.append('o:tag', 'existing_users');

  // List-Unsubscribe headers
  form.append('h:List-Unsubscribe', `<mailto:${unsubscribeEmail}?subject=Unsubscribe>, <${unsubscribeUrl}>`);
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  const response = await axios.post(
    `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    }
  );

  return {
    success: true,
    messageId: response.data.id,
    email: email
  };
}

// =============================================================================
// USER FETCHING
// =============================================================================

async function getExistingUsers() {
  // Get all users who have completed registration (have email and are not deleted)
  const usersSnapshot = await db.collection('users')
    .where('email', '!=', null)
    .get();

  const users = [];
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    // Filter out users without valid emails or who have unsubscribed
    if (data.email &&
        !data.deleted &&
        !data.unsubscribed &&
        data.email.includes('@')) {
      users.push({
        uid: doc.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        role: data.role,
        preferredLanguage: data.preferredLanguage,
        country: data.country
      });
    }
  });

  return users;
}

async function checkAlreadySent(uid) {
  // Check if we already sent this update email to this user
  const doc = await db.collection('app_update_emails').doc(uid).get();
  return doc.exists;
}

async function markAsSent(uid, email, messageId, lang) {
  await db.collection('app_update_emails').doc(uid).set({
    email: email,
    messageId: messageId,
    campaign: UTM_CAMPAIGN,
    language: lang,
    sentAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

async function showStats() {
  console.log('\n📊 User Statistics\n');

  const users = await getExistingUsers();
  console.log(`Total eligible users: ${users.length}`);

  // Count already sent
  const sentSnapshot = await db.collection('app_update_emails').get();
  console.log(`Already sent: ${sentSnapshot.size}`);
  console.log(`Remaining: ${users.length - sentSnapshot.size}`);

  // Role breakdown
  const roles = {};
  users.forEach(u => {
    const role = u.role || 'unknown';
    roles[role] = (roles[role] || 0) + 1;
  });
  console.log('\nBy role:');
  Object.entries(roles).sort((a, b) => b[1] - a[1]).forEach(([role, count]) => {
    console.log(`  ${role}: ${count}`);
  });

  // Language breakdown
  const languages = { en: 0, es: 0, pt: 0, de: 0 };
  users.forEach(u => {
    const lang = detectLanguage(u);
    languages[lang] = (languages[lang] || 0) + 1;
  });
  console.log('\nBy language:');
  Object.entries(languages).sort((a, b) => b[1] - a[1]).forEach(([lang, count]) => {
    const langNames = { en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German' };
    console.log(`  ${langNames[lang] || lang}: ${count}`);
  });

  // Country breakdown
  const countries = {};
  users.forEach(u => {
    const country = u.country || 'Unknown';
    countries[country] = (countries[country] || 0) + 1;
  });
  console.log('\nBy country:');
  Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([country, count]) => {
    console.log(`  ${country}: ${count}`);
  });
}

async function sendTestEmail(forceLang = null) {
  const langNames = { en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German' };
  const langDisplay = forceLang ? ` in ${langNames[forceLang] || forceLang}` : '';
  console.log(`\n📧 Sending Test Email${langDisplay}\n`);

  const testUser = {
    uid: 'test',
    email: 'scscot@gmail.com', // Your email for testing
    firstName: 'Stephen',
    lastName: 'Scott',
    displayName: 'Stephen Scott',
    preferredLanguage: forceLang // Force specific language if provided
  };

  try {
    const result = await sendEmailViaMailgun(testUser);
    const lang = detectLanguage(testUser);
    console.log(`✅ Test email sent to ${testUser.email} [${lang}]`);
    console.log(`   Message ID: ${result.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send test email: ${error.message}`);
  }
}

async function dryRun() {
  console.log('\n🔍 Dry Run - Preview Only\n');

  const users = await getExistingUsers();
  console.log(`Found ${users.length} eligible users\n`);

  // Check how many already received the email
  let alreadySent = 0;
  let toSend = 0;

  for (const user of users.slice(0, 20)) { // Check first 20
    const sent = await checkAlreadySent(user.uid);
    if (sent) {
      alreadySent++;
    } else {
      toSend++;
      const lang = detectLanguage(user);
      console.log(`Would send to: ${user.email} (${user.firstName || 'No name'}) [${lang}]`);
    }
  }

  if (users.length > 20) {
    console.log(`... and ${users.length - 20} more users`);
  }

  console.log(`\nSummary:`);
  console.log(`  Would send: ${users.length - alreadySent} emails`);
  console.log(`  Already sent: ${alreadySent} (in sample of 20)`);

  // Show email preview
  console.log('\n--- EMAIL PREVIEW ---\n');
  console.log(`Subject: ${SUBJECT}`);
  console.log('\n' + generateEmailPlainText('John'));
}

async function sendToAllUsers() {
  console.log('\n🚀 Sending App Update Emails\n');

  const users = await getExistingUsers();
  console.log(`Found ${users.length} eligible users\n`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    // Check if already sent
    const alreadySent = await checkAlreadySent(user.uid);
    if (alreadySent) {
      skipped++;
      continue;
    }

    try {
      const lang = detectLanguage(user);
      const result = await sendEmailViaMailgun(user);
      await markAsSent(user.uid, user.email, result.messageId, lang);
      sent++;
      console.log(`✅ [${sent}/${users.length}] Sent to ${user.email} (${lang})`);

      // Rate limiting
      if (sent % BATCH_SIZE === 0) {
        console.log(`\n⏸️  Pausing for ${BATCH_PAUSE_MS / 1000}s after ${BATCH_SIZE} emails...\n`);
        await sleep(BATCH_PAUSE_MS);
      } else {
        await sleep(SEND_DELAY_MS);
      }
    } catch (error) {
      failed++;
      console.error(`❌ Failed for ${user.email}: ${error.message}`);
    }
  }

  console.log('\n📊 Final Results:');
  console.log(`   Sent: ${sent}`);
  console.log(`   Skipped (already sent): ${skipped}`);
  console.log(`   Failed: ${failed}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// CLI
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(`
Team Build Pro - App Update Email Script

Usage:
  node scripts/send-app-update-email.js --dry-run   Preview without sending
  node scripts/send-app-update-email.js --test      Send test email to yourself
  node scripts/send-app-update-email.js --send      Send to all users
  node scripts/send-app-update-email.js --stats     Show user counts
`);
    process.exit(0);
  }

  try {
    if (args.includes('--stats')) {
      await showStats();
    } else if (args.includes('--test')) {
      // Check for --lang=XX parameter
      const langArg = args.find(a => a.startsWith('--lang='));
      const forceLang = langArg ? langArg.split('=')[1] : null;
      await sendTestEmail(forceLang);
    } else if (args.includes('--dry-run')) {
      await dryRun();
    } else if (args.includes('--send')) {
      // Confirmation prompt
      console.log('\n⚠️  WARNING: This will send emails to ALL existing users!\n');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await sleep(5000);
      await sendToAllUsers();
    } else {
      console.log('Unknown option. Use --help for usage.');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
