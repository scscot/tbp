#!/usr/bin/env node
/**
 * Team Build Pro - App Update Email Script (PROFESSIONALS ONLY)
 *
 * Sends a follow-up email to Team Build Pro PROFESSIONALS (role=admin)
 * announcing the reduced qualification milestones (3 direct + 12 total).
 *
 * Usage:
 *   node scripts/send-app-update-email-professionals.js --dry-run   # Preview without sending
 *   node scripts/send-app-update-email-professionals.js --test      # Send test email to yourself
 *   node scripts/send-app-update-email-professionals.js --send      # Send to all professionals
 *   node scripts/send-app-update-email-professionals.js --stats     # Show user counts
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
const SUBJECT = 'We just made it easier to qualify';
const LANDING_PAGE_URL = 'https://teambuildpro.com';
const IOS_APP_URL = 'https://apps.apple.com/us/app/id6751211622';
const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.scott.ultimatefix';

// Campaign tracking
const UTM_SOURCE = 'mailgun';
const UTM_MEDIUM = 'email';
const UTM_CAMPAIGN = 'qualification_update_professionals';
const UTM_CONTENT = 'qualification_email';

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

// Localized content - Qualification milestone update for PROFESSIONALS
const TRANSLATIONS = {
  en: {
    subject: 'We just made it easier to qualify',
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
    subject: 'Acabamos de facilitar la calificación',
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
    subject: 'Acabamos de facilitar a qualificação',
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
    subject: 'Wir haben die Qualifikation vereinfacht',
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
// EMAIL HTML TEMPLATE (Qualification Update - Professionals)
// =============================================================================

function generateEmailHTML(firstName, lang = 'en', company = 'business') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const headerTagline = HEADER_TAGLINES[lang] || HEADER_TAGLINES.en;
  const unsubscribeUrl = `${landingPage}/unsubscribe.html`;

  // Build tracked URLs
  const landingUrl = buildTrackedUrl(landingPage, 'cta_main');

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
        ${t.intro(company)}
      </p>

      <!-- Milestone Comparison -->
      <div style="margin:0 0 16px 0; padding:16px; background:#f8fafc; border-radius:8px; border-left:4px solid #c9a962;">
        <p style="margin:0 0 8px 0; color:#777777; text-decoration:line-through;">
          <strong>Old:</strong> ${t.oldMilestone}
        </p>
        <p style="margin:0; color:#0c1f3f; font-weight:600;">
          <strong style="color:#22c55e;">New:</strong> ${t.newMilestone}
        </p>
      </div>

      <p style="margin:0 0 16px 0;">
        ${t.whatThisMeans(company)}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.benefit}
      </p>

      <p style="margin:0 0 16px 0;">
        ${t.closing}<br>
        Stephen Scott
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

function generateEmailPlainText(firstName, lang = 'en', company = 'business') {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;
  const unsubscribeUrl = `${landingPage}/unsubscribe.html`;

  return `${t.greeting(firstName)}

${t.intro(company)}

Old: ${t.oldMilestone}
New: ${t.newMilestone}

${t.whatThisMeans(company)}

${t.benefit}

${t.closing}
Stephen Scott

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
  const company = user.bizOpp || 'business';

  // Detect user's language
  const lang = detectLanguage(user);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const landingPage = LANDING_PAGES[lang] || LANDING_PAGES.en;

  const htmlContent = generateEmailHTML(firstName, lang, company);
  const textContent = generateEmailPlainText(firstName, lang, company);
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
// USER FETCHING (PROFESSIONALS ONLY - role='admin')
// =============================================================================

// Cache for admin_settings to avoid repeated lookups
const adminSettingsCache = new Map();

async function getAdminBizOpp(adminUid) {
  // Check cache first
  if (adminSettingsCache.has(adminUid)) {
    return adminSettingsCache.get(adminUid);
  }

  try {
    const settingsDoc = await db.collection('admin_settings').doc(adminUid).get();
    if (settingsDoc.exists) {
      const bizOpp = settingsDoc.data().biz_opp || null;
      adminSettingsCache.set(adminUid, bizOpp);
      return bizOpp;
    }
  } catch (error) {
    console.warn(`Could not fetch admin_settings for ${adminUid}: ${error.message}`);
  }

  adminSettingsCache.set(adminUid, null);
  return null;
}

async function getExistingUsers() {
  // Get only PROFESSIONALS (role='admin') who have completed registration
  // Note: Using single-field query to avoid composite index requirement
  const usersSnapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .get();

  const users = [];
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    // Filter out users without valid emails, incomplete profiles, or who have unsubscribed
    if (data.email &&
        data.isProfileComplete === true &&
        !data.deleted &&
        !data.unsubscribed &&
        data.email.includes('@')) {

      // Get biz_opp from admin_settings
      // For professionals (admins), they are their own upline_admin
      const bizOpp = await getAdminBizOpp(doc.id);

      users.push({
        uid: doc.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        role: data.role,
        preferredLanguage: data.preferredLanguage,
        country: data.country,
        bizOpp: bizOpp
      });
    }
  }

  return users;
}

async function checkAlreadySent(uid) {
  // Check if we already sent this qualification update email to this user
  const doc = await db.collection('app_update_emails_qualification').doc(uid).get();
  return doc.exists;
}

async function markAsSent(uid, email, messageId, lang, bizOpp) {
  await db.collection('app_update_emails_qualification').doc(uid).set({
    email: email,
    messageId: messageId,
    campaign: UTM_CAMPAIGN,
    language: lang,
    bizOpp: bizOpp || null,
    sentAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

async function showStats() {
  console.log('\n📊 Professional User Statistics\n');

  const users = await getExistingUsers();
  console.log(`Total eligible professionals (role=admin): ${users.length}`);

  // Count already sent for this campaign
  const sentSnapshot = await db.collection('app_update_emails_qualification').get();
  console.log(`Already sent (qualification update): ${sentSnapshot.size}`);
  console.log(`Remaining: ${users.length - sentSnapshot.size}`);

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

  // Biz Opp breakdown
  const bizOpps = {};
  users.forEach(u => {
    const bizOpp = u.bizOpp || 'Not Set';
    bizOpps[bizOpp] = (bizOpps[bizOpp] || 0) + 1;
  });
  console.log('\nBy Business Opportunity:');
  Object.entries(bizOpps).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([bizOpp, count]) => {
    console.log(`  ${bizOpp}: ${count}`);
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

async function sendTestEmail(forceLang = null, testCompany = null) {
  const langNames = { en: 'English', es: 'Spanish', pt: 'Portuguese', de: 'German' };
  const langDisplay = forceLang ? ` in ${langNames[forceLang] || forceLang}` : '';
  const companyDisplay = testCompany ? ` for ${testCompany}` : '';
  console.log(`\n📧 Sending Test Email${langDisplay}${companyDisplay}\n`);

  const testUser = {
    uid: 'test',
    email: 'scscot@gmail.com', // Your email for testing
    firstName: 'Stephen',
    lastName: 'Scott',
    displayName: 'Stephen Scott',
    preferredLanguage: forceLang, // Force specific language if provided
    bizOpp: testCompany || 'Amway' // Test company name
  };

  try {
    const result = await sendEmailViaMailgun(testUser);
    const lang = detectLanguage(testUser);
    console.log(`✅ Test email sent to ${testUser.email} [${lang}] [${testUser.bizOpp}]`);
    console.log(`   Message ID: ${result.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send test email: ${error.message}`);
  }
}

async function dryRun() {
  console.log('\n🔍 Dry Run - Preview Only (PROFESSIONALS)\n');

  const users = await getExistingUsers();
  console.log(`Found ${users.length} eligible professionals (role=admin)\n`);

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
      console.log(`Would send to: ${user.email} (${user.firstName || 'No name'}) [${lang}] [${user.bizOpp || 'No biz_opp'}]`);
    }
  }

  if (users.length > 20) {
    console.log(`... and ${users.length - 20} more professionals`);
  }

  console.log(`\nSummary:`);
  console.log(`  Would send: ${users.length - alreadySent} emails`);
  console.log(`  Already sent: ${alreadySent} (in sample of 20)`);

  // Show email preview
  console.log('\n--- EMAIL PREVIEW ---\n');
  console.log(`Subject: ${SUBJECT}`);
  console.log('\n' + generateEmailPlainText('John', 'en', 'Amway'));
}

async function sendToAllUsers() {
  console.log('\n🚀 Sending Qualification Update Emails to PROFESSIONALS\n');

  const users = await getExistingUsers();
  console.log(`Found ${users.length} eligible professionals (role=admin)\n`);

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
      await markAsSent(user.uid, user.email, result.messageId, lang, user.bizOpp);
      sent++;
      console.log(`✅ [${sent}/${users.length}] Sent to ${user.email} (${lang}) [${user.bizOpp || 'No biz_opp'}]`);

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
Team Build Pro - Qualification Update Email Script (PROFESSIONALS ONLY)

Sends follow-up email about reduced qualification milestones to professionals (role=admin).

Usage:
  node scripts/send-app-update-email-professionals.js --dry-run                 Preview without sending
  node scripts/send-app-update-email-professionals.js --test                    Send test email to yourself
  node scripts/send-app-update-email-professionals.js --test --company="Amway"  Test with specific company
  node scripts/send-app-update-email-professionals.js --test --lang=es          Test in Spanish
  node scripts/send-app-update-email-professionals.js --send                    Send to all professionals
  node scripts/send-app-update-email-professionals.js --stats                   Show professional user counts
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
      // Check for --company=XX parameter
      const companyArg = args.find(a => a.startsWith('--company='));
      const testCompany = companyArg ? companyArg.split('=')[1] : null;
      await sendTestEmail(forceLang, testCompany);
    } else if (args.includes('--dry-run')) {
      await dryRun();
    } else if (args.includes('--send')) {
      // Confirmation prompt
      console.log('\n⚠️  WARNING: This will send qualification update emails to ALL professionals (role=admin)!\n');
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
