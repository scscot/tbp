#!/usr/bin/env node
/**
 * Update V14 Mailgun Templates
 *
 * - Removes preheader from all v14 templates (spam trigger)
 * - Creates/updates v14-pt (Portuguese/Brazil translation)
 * - Updates v14, v14-es, v14-de with preheader removed
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
// V14 ENGLISH - No preheader
// =============================================================================
const V14_HTML = `<!DOCTYPE html>
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
        I'm not recruiting you, and this isn't an opportunity.
      </p>

      <p style="margin:0 0 16px 0;">
        About 75% of new direct sales reps quit in their first year.
      </p>

      <p style="margin:0 0 16px 0;">
        That's not a motivation problem. It's a systems problem.
      </p>

      <p style="margin:0 0 16px 0;">
        I built an AI driven app to fix this.
      </p>

      <p style="margin:0 0 16px 0;">
        <strong>Team Build Pro</strong> provides:
      </p>

      <ul style="margin:0 0 16px 20px; padding:0;">
        <li style="margin-bottom:6px;">Individualized 24/7 AI coaching</li>
        <li style="margin-bottom:6px;">Customized pre-written outreach messages</li>
        <li style="margin-bottom:0;">A way to pre-build a team before joining</li>
      </ul>

      <p style="margin:0 0 16px 0;">
        It works with any company.
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

I'm not recruiting you, and this isn't an opportunity.

About 75% of new direct sales reps quit in their first year.

That's not a motivation problem. It's a systems problem.

I built an AI driven app to fix this.

Team Build Pro provides:
- Individualized 24/7 AI coaching
- Customized pre-written outreach messages
- A way to pre-build a team before joining

It works with any company.

See how it works: {{tracked_cta_url}}

Here's to your continued success,

Stephen Scott
Creator, Team Build Pro
Author, How to Grow Your Network Marketing Business Using AI

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V14-ES SPANISH - No preheader
// =============================================================================
const V14_ES_HTML = `<!DOCTYPE html>
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
        No te estoy reclutando, y esto no es una oportunidad.
      </p>

      <p style="margin:0 0 16px 0;">
        Aproximadamente el 75% de los nuevos representantes de ventas directas abandonan en su primer ano.
      </p>

      <p style="margin:0 0 16px 0;">
        Eso no es un problema de motivacion. Es un problema de sistemas.
      </p>

      <p style="margin:0 0 16px 0;">
        Cree una aplicacion impulsada por IA para solucionar esto.
      </p>

      <p style="margin:0 0 16px 0;">
        <strong>Team Build Pro</strong> ofrece:
      </p>

      <ul style="margin:0 0 16px 20px; padding:0;">
        <li style="margin-bottom:6px;">Coaching de IA individualizado 24/7</li>
        <li style="margin-bottom:6px;">Mensajes de alcance personalizados y preescritos</li>
        <li style="margin-bottom:0;">Una forma de pre-construir un equipo antes de unirse</li>
      </ul>

      <p style="margin:0 0 16px 0;">
        Funciona con cualquier empresa.
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

No te estoy reclutando, y esto no es una oportunidad.

Aproximadamente el 75% de los nuevos representantes de ventas directas abandonan en su primer ano.

Eso no es un problema de motivacion. Es un problema de sistemas.

Cree una aplicacion impulsada por IA para solucionar esto.

Team Build Pro ofrece:
- Coaching de IA individualizado 24/7
- Mensajes de alcance personalizados y preescritos
- Una forma de pre-construir un equipo antes de unirse

Funciona con cualquier empresa.

Descubre como funciona: {{tracked_cta_url}}

Exitos en tu camino,

Stephen Scott
Creador, Team Build Pro
Autor, Como Hacer Crecer tu Negocio de Network Marketing Usando IA

---
Cancelar suscripcion: {{unsubscribe_url}}`;

// =============================================================================
// V14-DE GERMAN - No preheader
// =============================================================================
const V14_DE_HTML = `<!DOCTYPE html>
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
        Ich rekrutiere Sie nicht, und dies ist keine Geschaftsmoglichkeit.
      </p>

      <p style="margin:0 0 16px 0;">
        Etwa 75% der neuen Direktvertriebs-Mitarbeiter geben in ihrem ersten Jahr auf.
      </p>

      <p style="margin:0 0 16px 0;">
        Das ist kein Motivationsproblem. Es ist ein Systemproblem.
      </p>

      <p style="margin:0 0 16px 0;">
        Ich habe eine KI-gestutzte App entwickelt, um das zu losen.
      </p>

      <p style="margin:0 0 16px 0;">
        <strong>Team Build Pro</strong> bietet:
      </p>

      <ul style="margin:0 0 16px 20px; padding:0;">
        <li style="margin-bottom:6px;">Individuelles 24/7 KI-Coaching</li>
        <li style="margin-bottom:6px;">Massgeschneiderte, vorgeschriebene Kontaktnachrichten</li>
        <li style="margin-bottom:0;">Eine Moglichkeit, ein Team vor dem Beitritt aufzubauen</li>
      </ul>

      <p style="margin:0 0 16px 0;">
        Es funktioniert mit jedem Unternehmen.
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

Ich rekrutiere Sie nicht, und dies ist keine Geschaftsmoglichkeit.

Etwa 75% der neuen Direktvertriebs-Mitarbeiter geben in ihrem ersten Jahr auf.

Das ist kein Motivationsproblem. Es ist ein Systemproblem.

Ich habe eine KI-gestutzte App entwickelt, um das zu losen.

Team Build Pro bietet:
- Individuelles 24/7 KI-Coaching
- Massgeschneiderte, vorgeschriebene Kontaktnachrichten
- Eine Moglichkeit, ein Team vor dem Beitritt aufzubauen

Es funktioniert mit jedem Unternehmen.

Erfahren Sie, wie es funktioniert: {{tracked_cta_url}}

Auf Ihren weiteren Erfolg,

Stephen Scott
Grunder, Team Build Pro
Autor, Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen

---
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// V14-PT PORTUGUESE (BRAZIL) - New template
// =============================================================================
const V14_PT_HTML = `<!DOCTYPE html>
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
        Nao estou recrutando voce, e isso nao e uma oportunidade.
      </p>

      <p style="margin:0 0 16px 0;">
        Cerca de 75% dos novos representantes de vendas diretas desistem no primeiro ano.
      </p>

      <p style="margin:0 0 16px 0;">
        Isso nao e um problema de motivacao. E um problema de sistemas.
      </p>

      <p style="margin:0 0 16px 0;">
        Criei um aplicativo com IA para resolver isso.
      </p>

      <p style="margin:0 0 16px 0;">
        <strong>Team Build Pro</strong> oferece:
      </p>

      <ul style="margin:0 0 16px 20px; padding:0;">
        <li style="margin-bottom:6px;">Coaching de IA individualizado 24/7</li>
        <li style="margin-bottom:6px;">Mensagens de contato personalizadas e pre-escritas</li>
        <li style="margin-bottom:0;">Uma forma de construir uma equipe antes de entrar</li>
      </ul>

      <p style="margin:0 0 16px 0;">
        Funciona com qualquer empresa.
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

Nao estou recrutando voce, e isso nao e uma oportunidade.

Cerca de 75% dos novos representantes de vendas diretas desistem no primeiro ano.

Isso nao e um problema de motivacao. E um problema de sistemas.

Criei um aplicativo com IA para resolver isso.

Team Build Pro oferece:
- Coaching de IA individualizado 24/7
- Mensagens de contato personalizadas e pre-escritas
- Uma forma de construir uma equipe antes de entrar

Funciona com qualquer empresa.

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
  { version: 'v14', html: V14_HTML, text: V14_TEXT, description: 'English (no preheader)' },
  { version: 'v14-es', html: V14_ES_HTML, text: V14_ES_TEXT, description: 'Spanish (no preheader)' },
  { version: 'v14-de', html: V14_DE_HTML, text: V14_DE_TEXT, description: 'German (no preheader)' },
  { version: 'v14-pt', html: V14_PT_HTML, text: V14_PT_TEXT, description: 'Portuguese/Brazil (new)' }
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
    'v14': 'AI is changing how teams grow',
    'v14-es': 'La IA esta cambiando como crecen los equipos',
    'v14-de': 'KI verandert, wie Teams wachsen',
    'v14-pt': 'A IA esta mudando como as equipes crescem'
  };

  console.log(`\nSending test email for ${version}...`);

  const domain = domains[version] || 'teambuildpro.com';
  const subject = subjects[version] || 'AI is changing how teams grow';
  const landingPageUrl = `https://${domain}?utm_source=mailgun&utm_medium=email&utm_campaign=v14_test&utm_content=${version}`;
  const unsubscribeUrl = `https://${domain}/unsubscribe.html?email=scscot@gmail.com`;

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', 'Test <scscot@gmail.com>');
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
  console.log('Changes:');
  console.log('  - Removing preheader from v14, v14-es, v14-de');
  console.log('  - Creating new v14-pt (Portuguese/Brazil)');
  console.log('  - Adding plain text alternatives');
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
