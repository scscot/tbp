#!/usr/bin/env node
/**
 * Update V14 Mailgun Templates
 *
 * Updates all v14 template versions (EN, ES, PT, DE) in Mailgun.
 * New body content focuses on momentum/structure problem.
 * Subject: "Using AI to grow your team faster" (localized)
 *
 * Usage:
 *   node scripts/update-v14-templates.js           # Update all v14 templates
 *   node scripts/update-v14-templates.js --test    # Send test email after update
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

// Load environment variables from functions/.env file
require('dotenv').config({ path: path.join(__dirname, '../functions/.env.teambuilder-plus-fe74d') });

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

// =============================================================================
// V14 ENGLISH
// =============================================================================
const V14_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          AI-Powered Mobile App for Direct Sales Growth
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">
        Hello {{first_name}},
      </p>

      <p style="margin:0 0 16px 0;">
        If you're in direct sales, you already know how hard it is to keep new team members moving.
      </p>

      <p style="margin:0 0 16px 0;">
        A lot of people start strong, then lose momentum within the first year.
      </p>

      <p style="margin:0 0 16px 0;">
        In many cases, it isn't effort. It's that they don't have much structure in the beginning.
      </p>

      <p style="margin:0 0 16px 0;">
        I built a mobile app that provides individualized 24/7 AI guidance, ready-to-use outreach messages, and even the ability to start building a team before officially joining your company.
      </p>

      <p style="margin:0 0 16px 0;">
        See how it works:
        <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
      </p>

      <p style="margin:0 0 16px 0;">
        Here's to your continued success,
      </p>

      <p style="margin:0 0 16px 0;">
        Stephen Scott<br>
        Creator, Team Build Pro<br>
        Author, <em>How to Grow Your Network Marketing Business Using AI</em>
      </p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V14_TEXT = `Hello {{first_name}},

If you're in direct sales, you already know how hard it is to keep new team members moving.

A lot of people start strong, then lose momentum within the first year.

In many cases, it isn't effort. It's that they don't have much structure in the beginning.

I built a mobile app that provides individualized 24/7 AI guidance, ready-to-use outreach messages, and even the ability to start building a team before officially joining your company.

See how it works: {{tracked_cta_url}}

Here's to your continued success,

Stephen Scott
Creator, Team Build Pro
Author, How to Grow Your Network Marketing Business Using AI

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V14-ES SPANISH
// =============================================================================
const V14_ES_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          App Movil con IA para el Crecimiento en Ventas Directas
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">
        Hola {{first_name}},
      </p>

      <p style="margin:0 0 16px 0;">
        Si estas en ventas directas, ya sabes lo dificil que es mantener a los nuevos miembros del equipo en movimiento.
      </p>

      <p style="margin:0 0 16px 0;">
        Muchas personas comienzan con fuerza, pero pierden impulso dentro del primer ano.
      </p>

      <p style="margin:0 0 16px 0;">
        En muchos casos, no es falta de esfuerzo. Es que no tienen mucha estructura al principio.
      </p>

      <p style="margin:0 0 16px 0;">
        Cree una aplicacion movil que proporciona orientacion de IA personalizada 24/7, mensajes de contacto listos para usar, e incluso la capacidad de comenzar a construir un equipo antes de unirse oficialmente a tu empresa.
      </p>

      <p style="margin:0 0 16px 0;">
        Descubre como funciona:
        <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
      </p>

      <p style="margin:0 0 16px 0;">
        Exitos en tu camino,
      </p>

      <p style="margin:0 0 16px 0;">
        Stephen Scott<br>
        Creador, Team Build Pro<br>
        Autor, <em>Como Hacer Crecer tu Negocio de Network Marketing Usando IA</em>
      </p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V14_ES_TEXT = `Hola {{first_name}},

Si estas en ventas directas, ya sabes lo dificil que es mantener a los nuevos miembros del equipo en movimiento.

Muchas personas comienzan con fuerza, pero pierden impulso dentro del primer ano.

En muchos casos, no es falta de esfuerzo. Es que no tienen mucha estructura al principio.

Cree una aplicacion movil que proporciona orientacion de IA personalizada 24/7, mensajes de contacto listos para usar, e incluso la capacidad de comenzar a construir un equipo antes de unirse oficialmente a tu empresa.

Descubre como funciona: {{tracked_cta_url}}

Exitos en tu camino,

Stephen Scott
Creador, Team Build Pro
Autor, Como Hacer Crecer tu Negocio de Network Marketing Usando IA

---
Cancelar suscripcion: {{unsubscribe_url}}`;

// =============================================================================
// V14-DE GERMAN
// =============================================================================
const V14_DE_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          KI-gestutzte Mobile App fur Direktvertrieb-Wachstum
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">
        Hallo {{first_name}},
      </p>

      <p style="margin:0 0 16px 0;">
        Wenn Sie im Direktvertrieb tatig sind, wissen Sie bereits, wie schwer es ist, neue Teammitglieder in Bewegung zu halten.
      </p>

      <p style="margin:0 0 16px 0;">
        Viele Menschen starten stark, verlieren aber innerhalb des ersten Jahres an Schwung.
      </p>

      <p style="margin:0 0 16px 0;">
        In vielen Fallen liegt es nicht am Einsatz. Es fehlt ihnen einfach an Struktur am Anfang.
      </p>

      <p style="margin:0 0 16px 0;">
        Ich habe eine mobile App entwickelt, die personalisierte KI-Unterstutzung rund um die Uhr, gebrauchsfertige Kontaktnachrichten und sogar die Moglichkeit bietet, ein Team aufzubauen, bevor Sie offiziell Ihrem Unternehmen beitreten.
      </p>

      <p style="margin:0 0 16px 0;">
        Erfahren Sie, wie es funktioniert:
        <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a>
      </p>

      <p style="margin:0 0 16px 0;">
        Auf Ihren weiteren Erfolg,
      </p>

      <p style="margin:0 0 16px 0;">
        Stephen Scott<br>
        Grunder, Team Build Pro<br>
        Autor, <em>Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen</em>
      </p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V14_DE_TEXT = `Hallo {{first_name}},

Wenn Sie im Direktvertrieb tatig sind, wissen Sie bereits, wie schwer es ist, neue Teammitglieder in Bewegung zu halten.

Viele Menschen starten stark, verlieren aber innerhalb des ersten Jahres an Schwung.

In vielen Fallen liegt es nicht am Einsatz. Es fehlt ihnen einfach an Struktur am Anfang.

Ich habe eine mobile App entwickelt, die personalisierte KI-Unterstutzung rund um die Uhr, gebrauchsfertige Kontaktnachrichten und sogar die Moglichkeit bietet, ein Team aufzubauen, bevor Sie offiziell Ihrem Unternehmen beitreten.

Erfahren Sie, wie es funktioniert: {{tracked_cta_url}}

Auf Ihren weiteren Erfolg,

Stephen Scott
Grunder, Team Build Pro
Autor, Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen

---
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// V14-PT PORTUGUESE (BRAZIL)
// =============================================================================
const V14_PT_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;">
  <div style="max-width:600px; margin:0 auto; padding:20px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#1a1a2e;">

    <div style="background-color:#0c1f3f; background:linear-gradient(135deg,#0c1f3f 0%,#1a3a5c 100%); padding:20px; border-radius:12px 12px 0 0; text-align:center;">
      <h1 style="margin:0; padding:0; font-weight:600; line-height:1.2;">
        <span style="display:block; font-size:24px; color:#c9a962;">
          <span style="color:#ffd700;">Team Build Pro</span>
        </span>
        <span style="display:block; margin-top:4px; font-size:14px; font-weight:400; color:#ffffff; line-height:1.4;">
          App Movel com IA para Crescimento em Vendas Diretas
        </span>
      </h1>
    </div>

    <div style="background:#ffffff; padding:30px; border-radius:0 0 12px 12px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="margin:0 0 16px 0;">
        Ola {{first_name}},
      </p>

      <p style="margin:0 0 16px 0;">
        Se voce esta em vendas diretas, ja sabe como e dificil manter os novos membros da equipe em movimento.
      </p>

      <p style="margin:0 0 16px 0;">
        Muitas pessoas comecam com forca, mas perdem o impulso no primeiro ano.
      </p>

      <p style="margin:0 0 16px 0;">
        Em muitos casos, nao e falta de esforco. E que eles nao tem muita estrutura no inicio.
      </p>

      <p style="margin:0 0 16px 0;">
        Criei um aplicativo movel que oferece orientacao de IA personalizada 24/7, mensagens de contato prontas para usar, e ate a capacidade de comecar a construir uma equipe antes de entrar oficialmente na sua empresa.
      </p>

      <p style="margin:0 0 16px 0;">
        Veja como funciona:
        <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">pt.teambuildpro.com</a>
      </p>

      <p style="margin:0 0 16px 0;">
        Sucesso em sua jornada,
      </p>

      <p style="margin:0 0 16px 0;">
        Stephen Scott<br>
        Criador, Team Build Pro<br>
        Autor, <em>Como Expandir seu Negocio de Marketing de Rede Usando IA</em>
      </p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar inscricao</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V14_PT_TEXT = `Ola {{first_name}},

Se voce esta em vendas diretas, ja sabe como e dificil manter os novos membros da equipe em movimento.

Muitas pessoas comecam com forca, mas perdem o impulso no primeiro ano.

Em muitos casos, nao e falta de esforco. E que eles nao tem muita estrutura no inicio.

Criei um aplicativo movel que oferece orientacao de IA personalizada 24/7, mensagens de contato prontas para usar, e ate a capacidade de comecar a construir uma equipe antes de entrar oficialmente na sua empresa.

Veja como funciona: {{tracked_cta_url}}

Sucesso em sua jornada,

Stephen Scott
Criador, Team Build Pro
Autor, Como Expandir seu Negocio de Marketing de Rede Usando IA

---
Cancelar inscricao: {{unsubscribe_url}}`;

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

const templates = [
  { version: 'v14', html: V14_HTML, text: V14_TEXT, description: 'English' },
  { version: 'v14-es', html: V14_ES_HTML, text: V14_ES_TEXT, description: 'Spanish' },
  { version: 'v14-de', html: V14_DE_HTML, text: V14_DE_TEXT, description: 'German' },
  { version: 'v14-pt', html: V14_PT_HTML, text: V14_PT_TEXT, description: 'Portuguese/Brazil' }
];

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function updateTemplate(version, html, text, description) {
  console.log(`Updating ${version} (${description})...`);

  const form = new FormData();
  form.append('template', html);
  form.append('text', text);
  form.append('active', 'yes');

  try {
    // Try PUT first (update existing)
    const response = await axios.put(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions/${version}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  ✅ ${version} updated successfully`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      // Template version doesn't exist, create it
      console.log(`  Creating new version ${version}...`);
      return await createTemplate(version, html, text, description);
    }
    console.error(`  ❌ Error updating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function createTemplate(version, html, text, description) {
  const form = new FormData();
  form.append('tag', version);
  form.append('template', html);
  form.append('text', text);
  form.append('active', 'yes');

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  ✅ ${version} created successfully`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error creating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function sendTestEmail(version, language) {
  const domains = {
    'v14': 'teambuildpro.com',
    'v14-es': 'es.teambuildpro.com',
    'v14-de': 'de.teambuildpro.com',
    'v14-pt': 'pt.teambuildpro.com'
  };

  const subjects = {
    'v14': 'Using AI to grow your team faster',
    'v14-es': 'Usando IA para hacer crecer tu equipo mas rapido',
    'v14-de': 'Mit KI Ihr Team schneller aufbauen',
    'v14-pt': 'Usando IA para crescer sua equipe mais rapido'
  };

  console.log(`\nSending test email for ${version}...`);

  const domain = domains[version] || 'teambuildpro.com';
  const subject = subjects[version] || 'Using AI to grow your team faster';
  const landingPageUrl = `https://${domain}?utm_source=mailgun&utm_medium=email&utm_campaign=v14_test&utm_content=${version}`;
  const unsubscribeUrl = `https://${domain}/unsubscribe.html?email=scscot@gmail.com`;

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', 'Stephen Scott <scscot@gmail.com>');
  form.append('subject', `${subject} [TEST ${version}]`);
  form.append('template', TEMPLATE_NAME);
  form.append('t:version', version);
  form.append('t:text', 'yes');
  form.append('o:tag', `test_${version}`);
  form.append('o:tracking', 'false');
  form.append('o:tracking-opens', 'false');
  form.append('o:tracking-clicks', 'false');
  form.append('h:X-Mailgun-Variables', JSON.stringify({
    first_name: 'Test',
    tracked_cta_url: landingPageUrl,
    unsubscribe_url: unsubscribeUrl
  }));

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_API_KEY).toString('base64')
        }
      }
    );
    console.log(`  ✅ Test email sent for ${version}`);
    console.log(`     Message ID: ${response.data.id}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error sending test email:`, error.response?.data || error.message);
    return false;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const sendTest = args.includes('--test');

  if (!MAILGUN_API_KEY) {
    console.error('❌ TBP_MAILGUN_API_KEY environment variable not set');
    console.error('   Make sure functions/.env.teambuilder-plus-fe74d exists');
    process.exit(1);
  }

  console.log('Updating V14 Mailgun Templates');
  console.log('==============================');
  console.log('Subject: "Using AI to grow your team faster"');
  console.log('Body: Momentum/structure focused messaging');
  console.log('');

  let allSuccess = true;

  for (const { version, html, text, description } of templates) {
    const success = await updateTemplate(version, html, text, description);
    if (!success) allSuccess = false;
  }

  if (sendTest && allSuccess) {
    console.log('\n--- Sending Test Emails ---');
    for (const { version } of templates) {
      await sendTestEmail(version);
    }
  }

  console.log('\n==============================');
  if (allSuccess) {
    console.log('✅ All templates updated successfully!');
    if (!sendTest) {
      console.log('\nRun with --test flag to send test emails:');
      console.log('  node scripts/update-v14-templates.js --test');
    }
  } else {
    console.log('⚠️  Some templates failed to update. Check errors above.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
