#!/usr/bin/env node
/**
 * One-time script to resend corrected qualification emails to professionals
 * who received emails with "your your team" due to missing biz_opp.
 *
 * Usage:
 *   node scripts/resend-corrected-professionals.js --dry-run   # Preview
 *   node scripts/resend-corrected-professionals.js --send      # Send corrections
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

// Campaign tracking
const UTM_SOURCE = 'mailgun';
const UTM_MEDIUM = 'email';
const UTM_CAMPAIGN = 'qualification_update_professionals_corrected';
const UTM_CONTENT = 'qualification_email_corrected';

// Language-specific landing pages
const LANDING_PAGES = {
  en: 'https://teambuildpro.com',
  es: 'https://es.teambuildpro.com',
  pt: 'https://pt.teambuildpro.com',
  de: 'https://de.teambuildpro.com'
};

// Country to language mapping
const COUNTRY_LANGUAGE_MAP = {
  'Spain': 'es', 'Mexico': 'es', 'Argentina': 'es', 'Colombia': 'es', 'Chile': 'es',
  'Peru': 'es', 'Venezuela': 'es', 'Ecuador': 'es', 'Guatemala': 'es', 'Cuba': 'es',
  'Bolivia': 'es', 'Dominican Republic': 'es', 'Honduras': 'es', 'Paraguay': 'es',
  'El Salvador': 'es', 'Nicaragua': 'es', 'Costa Rica': 'es', 'Panama': 'es', 'Uruguay': 'es',
  'Brazil': 'pt', 'Portugal': 'pt', 'Angola': 'pt', 'Mozambique': 'pt',
  'Germany': 'de', 'Austria': 'de', 'Switzerland': 'de', 'Liechtenstein': 'de', 'Luxembourg': 'de'
};

// Localized content with "Corrected" subject and 'business' fallback
const TRANSLATIONS = {
  en: {
    subject: 'Corrected: We just made it easier to qualify',
    greeting: (name) => `Hi ${name},`,
    intro: (company) => `Quick follow-up to yesterday's update — we've reduced the qualification milestones:`,
    oldMilestone: '4 direct sponsors + 20 total team members',
    newMilestone: '3 direct sponsors + 12 total team members',
    whatThisMeans: (company) => `This means your recruiting prospects will receive their invitation to join your <strong>${company}</strong> team even sooner. And best of all, their Team Build Pro team members will follow them into your ${company} team as they become qualified.`,
    benefit: 'Fewer hurdles. Faster momentum. More qualified recruits joining your business ready to hit the ground running.',
    closing: 'To your success,',
    unsubscribe: 'Unsubscribe',
    footerNote: "You're receiving this because you're a Team Build Pro member."
  },
  es: {
    subject: 'Corregido: Acabamos de facilitar la calificación',
    greeting: (name) => `Hola ${name},`,
    intro: (company) => `Seguimiento rápido a la actualización de ayer — hemos reducido los hitos de calificación:`,
    oldMilestone: '4 patrocinadores directos + 20 miembros totales del equipo',
    newMilestone: '3 patrocinadores directos + 12 miembros totales del equipo',
    whatThisMeans: (company) => `Esto significa que tus prospectos de reclutamiento recibirán su invitación para unirse a tu equipo de <strong>${company}</strong> aún más pronto. Y lo mejor de todo, sus miembros del equipo de Team Build Pro los seguirán a tu equipo de ${company} a medida que califiquen.`,
    benefit: 'Menos obstáculos. Más impulso. Más reclutas calificados uniéndose a tu negocio listos para empezar con todo.',
    closing: 'Para tu éxito,',
    unsubscribe: 'Cancelar suscripción',
    footerNote: 'Recibes esto porque eres miembro de Team Build Pro.'
  },
  pt: {
    subject: 'Corrigido: Acabamos de facilitar a qualificação',
    greeting: (name) => `Olá ${name},`,
    intro: (company) => `Seguimento rápido à atualização de ontem — reduzimos os marcos de qualificação:`,
    oldMilestone: '4 patrocinadores diretos + 20 membros totais da equipe',
    newMilestone: '3 patrocinadores diretos + 12 membros totais da equipe',
    whatThisMeans: (company) => `Isso significa que seus prospectos de recrutamento receberão o convite para se juntar à sua equipe <strong>${company}</strong> ainda mais cedo. E o melhor de tudo, seus membros da equipe Team Build Pro os seguirão para sua equipe ${company} à medida que se qualificarem.`,
    benefit: 'Menos obstáculos. Mais impulso. Mais recrutados qualificados entrando no seu negócio prontos para começar com tudo.',
    closing: 'Para o seu sucesso,',
    unsubscribe: 'Cancelar inscrição',
    footerNote: 'Você está recebendo isso porque é membro do Team Build Pro.'
  },
  de: {
    subject: 'Korrigiert: Wir haben die Qualifikation vereinfacht',
    greeting: (name) => `Hallo ${name},`,
    intro: (company) => `Kurze Nachfolge zum gestrigen Update — wir haben die Qualifikationsmeilensteine reduziert:`,
    oldMilestone: '4 direkte Sponsoren + 20 Teammitglieder insgesamt',
    newMilestone: '3 direkte Sponsoren + 12 Teammitglieder insgesamt',
    whatThisMeans: (company) => `Das bedeutet, dass deine Recruiting-Interessenten ihre Einladung, deinem <strong>${company}</strong>-Team beizutreten, noch früher erhalten. Und das Beste: Ihre Team Build Pro Teammitglieder werden ihnen in dein ${company}-Team folgen, sobald sie sich qualifizieren.`,
    benefit: 'Weniger Hürden. Schnellerer Schwung. Mehr qualifizierte Rekruten, die bereit sind, in deinem Geschäft durchzustarten.',
    closing: 'Zu deinem Erfolg,',
    unsubscribe: 'Abmelden',
    footerNote: 'Du erhältst diese E-Mail, weil du Mitglied bei Team Build Pro bist.'
  }
};

// The 21 affected UIDs (no admin_settings document)
const AFFECTED_UIDS = [
  '0vhO6125TYYTXBjACEeLZNCCqrw1',
  '10PuRGXaMrOl7vqPIL9AU6XbcjB2',
  '15YUAFIIn8OeWXck1XeLGBSzltD3',
  '2TCN9ayncfZ3JBYoYJgIAgQxnKy1',
  '6vTke3NEu5X22iwAR9I6GIGQRLE2',
  'AgF82Qy6edRgFmMXvqEbKam5Xru1',
  'H6i8f49itwh9K3r5GgvKSFutIA32',
  'OPqYlRz5jrg78WgNBupu9LgmRJy2',
  'XdWDNadsDthtYcGERzZBHZPPsKp2',
  'Xuhq9VzrA4S3aRp8eiqd5xv89VR2',
  'ajGvotPt7VMPVquL5tmHT4E3HwH2',
  'cK1d4ZnQUIdM0HucYJE0YYd2gii1',
  'gKJcJETOephsGdvceUT65bsix003',
  'ggDm4HzPo7ZRmytydTdenbkgzMt2',
  'kblM2yOmDIUoq5mMncyWUUieScE2',
  'kkLggtpLa9fAW6z5CEnoAtVT1e72',
  'kvdJJwL5gDV9b6A7tJpEeYHH6VB2',
  'p4B7qlKiNFhiVnaJuoFbS0pTEmD2',
  'tdbGBOBTFnRf5bSXQcD5ptVIu9f2',
  'xVnA2dDx3zajUZDrYvk1HWH1pZA2',
  'yekWK53DNRPC1XtIROGOqkF0H6L2'
];

// Rate limiting
const SEND_DELAY_MS = 1000;

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
// HELPER FUNCTIONS
// =============================================================================

function detectLanguage(user) {
  if (user.preferredLanguage && ['en', 'es', 'pt', 'de'].includes(user.preferredLanguage)) {
    return user.preferredLanguage;
  }
  if (user.country && COUNTRY_LANGUAGE_MAP[user.country]) {
    return COUNTRY_LANGUAGE_MAP[user.country];
  }
  return 'en';
}

const HEADER_TAGLINES = {
  en: 'AI-Powered Mobile App for Direct Sales Growth',
  es: 'App Móvil con IA para el Crecimiento en Ventas Directas',
  pt: 'App Móvel com IA para Crescimento em Vendas Diretas',
  de: 'KI-gestützte Mobile App für Direktvertriebswachstum'
};

function generateEmailHTML(firstName, lang = 'en', company = 'business') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const headerTagline = HEADER_TAGLINES[lang] || HEADER_TAGLINES.en;
  const unsubscribeUrl = landingPage + '/unsubscribe.html';
  const landingUrl = buildTrackedUrl(landingPage, 'cta_main');

  return '<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>\n<body style="margin:0; padding:0; background-color:#f8fafc;">\n  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">\n\n    <!-- Gradient Header -->\n    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">\n      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">\n        <span style="display:block; font-size:24px; color:#c9a962;">\n          <span style="color:#ffd700;">Team Build Pro</span>\n        </span>\n        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">\n          ' + headerTagline + '\n        </span>\n      </h1>\n    </div>\n\n    <!-- White Card Body -->\n    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">\n      <p style="margin:0 0 16px 0;">\n        ' + t.greeting(firstName) + '\n      </p>\n\n      <p style="margin:0 0 16px 0;">\n        ' + t.intro(company) + '\n      </p>\n\n      <!-- Milestone Comparison -->\n      <div style="margin:0 0 16px 0; padding:16px; background:#f8fafc; border-radius:8px; border-left:4px solid #c9a962;">\n        <p style="margin:0 0 8px 0; color:#777777; text-decoration:line-through;">\n          <strong>Old:</strong> ' + t.oldMilestone + '\n        </p>\n        <p style="margin:0; color:#0c1f3f; font-weight:600;">\n          <strong style="color:#22c55e;">New:</strong> ' + t.newMilestone + '\n        </p>\n      </div>\n\n      <p style="margin:0 0 16px 0;">\n        ' + t.whatThisMeans(company) + '\n      </p>\n\n      <p style="margin:0 0 16px 0;">\n        ' + t.benefit + '\n      </p>\n\n      <p style="margin:0 0 16px 0;">\n        ' + t.closing + '<br>\n        Stephen Scott\n      </p>\n\n      <!-- Footer -->\n      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">\n        <a href="' + landingUrl + '" style="color:#1a73e8; text-decoration:underline;">' + landingPage.replace('https://', '') + '</a>\n        &nbsp;·&nbsp;\n        <a href="' + unsubscribeUrl + '" style="color:#777777; text-decoration:underline;">' + t.unsubscribe + '</a>\n        <br><br>\n        <span style="font-size:11px; color:#999999;">\n          ' + t.footerNote + '\n        </span>\n      </div>\n    </div>\n\n  </div>\n</body>\n</html>';
}

function generateEmailPlainText(firstName, lang = 'en', company = 'business') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const unsubscribeUrl = landingPage + '/unsubscribe.html';

  return t.greeting(firstName) + '\n\n' + t.intro(company) + '\n\nOld: ' + t.oldMilestone + '\nNew: ' + t.newMilestone + '\n\n' + t.whatThisMeans(company).replace(/<\/?strong>/g, '') + '\n\n' + t.benefit + '\n\n' + t.closing + '\nStephen Scott\n\n---\n' + landingPage.replace('https://', '') + '\n' + t.unsubscribe + ': ' + unsubscribeUrl + '\n\n' + t.footerNote;
}

function buildTrackedUrl(baseUrl, content) {
  const params = new URLSearchParams({
    utm_source: UTM_SOURCE,
    utm_medium: UTM_MEDIUM,
    utm_campaign: UTM_CAMPAIGN,
    utm_content: content
  });
  return baseUrl + '?' + params.toString();
}

async function sendEmailViaMailgun(user, company = 'business') {
  if (!MAILGUN_API_KEY) {
    throw new Error('TBP_MAILGUN_API_KEY not configured');
  }

  const firstName = user.firstName || user.displayName?.split(' ')[0] || 'there';
  const email = user.email;
  const displayName = user.displayName || (user.firstName || '') + ' ' + (user.lastName || '').trim() || email;
  const lang = detectLanguage(user);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;

  const htmlContent = generateEmailHTML(firstName, lang, company);
  const textContent = generateEmailPlainText(firstName, lang, company);
  const unsubscribeUrl = landingPage + '/unsubscribe.html?email=' + encodeURIComponent(email);
  const unsubscribeEmail = 'unsubscribe@news.teambuildpro.com';

  const form = new FormData();
  form.append('from', FROM_ADDRESS);
  form.append('to', displayName + ' <' + email + '>');
  form.append('subject', t.subject);
  form.append('html', htmlContent);
  form.append('text', textContent);
  form.append('o:tracking', 'no');
  form.append('o:tracking-opens', 'no');
  form.append('o:tracking-clicks', 'no');
  form.append('o:tag', 'app_update_corrected');
  form.append('o:tag', UTM_CAMPAIGN);
  form.append('h:List-Unsubscribe', '<mailto:' + unsubscribeEmail + '?subject=Unsubscribe>, <' + unsubscribeUrl + '>');
  form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');

  const response = await axios.post(
    'https://api.mailgun.net/v3/' + MAILGUN_DOMAIN + '/messages',
    form,
    {
      headers: {
        ...form.getHeaders(),
        'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
      }
    }
  );

  return { success: true, messageId: response.data.id, email: email };
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

async function getAffectedUsers() {
  const users = [];

  for (const uid of AFFECTED_UIDS) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.email) {
        users.push({
          uid: uid,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName,
          preferredLanguage: data.preferredLanguage,
          country: data.country
        });
      }
    }
  }

  return users;
}

async function dryRun() {
  console.log('\n🔍 Dry Run - Corrected Email Preview\n');

  const users = await getAffectedUsers();
  console.log('Found ' + users.length + ' affected users to resend corrections to:\n');

  users.forEach(u => {
    const lang = detectLanguage(u);
    console.log('  ' + u.email + ' (' + (u.firstName || 'No name') + ') [' + lang + '] -> will use "business" fallback');
  });

  console.log('\n--- EMAIL PREVIEW (English) ---\n');
  console.log('Subject: ' + TRANSLATIONS.en.subject);
  console.log('\n' + generateEmailPlainText('John', 'en', 'business'));
}

async function sendCorrections() {
  console.log('\n🚀 Sending Corrected Emails\n');

  const users = await getAffectedUsers();
  console.log('Found ' + users.length + ' affected users\n');

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const lang = detectLanguage(user);
      const result = await sendEmailViaMailgun(user, 'business');
      sent++;
      console.log('✅ [' + sent + '/' + users.length + '] Sent correction to ' + user.email + ' (' + lang + ')');

      // Record the correction send
      await db.collection('app_update_emails_qualification_corrected').doc(user.uid).set({
        email: user.email,
        messageId: result.messageId,
        campaign: UTM_CAMPAIGN,
        language: lang,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await sleep(SEND_DELAY_MS);
    } catch (error) {
      failed++;
      console.error('❌ Failed for ' + user.email + ': ' + error.message);
    }
  }

  console.log('\n📊 Final Results:');
  console.log('   Sent: ' + sent);
  console.log('   Failed: ' + failed);
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
    console.log('\nResend Corrected Qualification Emails\n');
    console.log('Usage:');
    console.log('  node scripts/resend-corrected-professionals.js --dry-run   Preview');
    console.log('  node scripts/resend-corrected-professionals.js --send      Send corrections\n');
    process.exit(0);
  }

  try {
    if (args.includes('--dry-run')) {
      await dryRun();
    } else if (args.includes('--send')) {
      console.log('\n⚠️  This will send CORRECTED emails to 21 affected professionals.\n');
      console.log('Press Ctrl+C within 5 seconds to cancel...\n');
      await sleep(5000);
      await sendCorrections();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
