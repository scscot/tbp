#!/usr/bin/env node
/**
 * Update V18 Mailgun Templates (A/B/C Testing)
 *
 * Creates/updates all V18 template versions for A/B/C testing:
 * - v18-a, v18-a-es, v18-a-pt, v18-a-de (Curiosity Hook)
 * - v18-b, v18-b-es, v18-b-pt, v18-b-de (Pain Point Hook)
 * - v18-c, v18-c-es, v18-c-pt, v18-c-de (Direct Value Hook)
 *
 * Subject Lines:
 * - V18-A: "What if your next recruit joined with 12 people?"
 * - V18-B: "75% of your recruits will quit this year (here's why)"
 * - V18-C: "Give your prospects an AI recruiting coach"
 *
 * Usage:
 *   node scripts/update-v18-templates.js           # Update all V18 templates
 *   node scripts/update-v18-templates.js --test    # Send test emails after update
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
// V18-A CURIOSITY HOOK - ENGLISH
// Subject: "What if your next recruit joined with 12 people?"
// =============================================================================
const V18_A_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hello {{first_name}},</p>

      <p style="margin:0 0 16px 0;">What if your next recruit showed up on Day 1 with 12 people already in their downline?</p>

      <p style="margin:0 0 16px 0;">That's exactly what Team Build Pro does.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app that lets prospects pre-build their team BEFORE they even sign up with your company. No more cold starts. No more "I'll try it for 30 days" dropouts.</p>

      <p style="margin:0 0 16px 0;">Here's how it works:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Prospects use AI-powered tools to recruit while they're still deciding</li>
        <li>They build real momentum before making any commitment</li>
        <li>When they join YOUR business, they already have a team</li>
      </ul>

      <p style="margin:0 0 16px 0;">75% of new recruits quit in their first year. This changes that.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_A_TEXT = `Hello {{first_name}},

What if your next recruit showed up on Day 1 with 12 people already in their downline?

That's exactly what Team Build Pro does.

It's a mobile app that lets prospects pre-build their team BEFORE they even sign up with your company. No more cold starts. No more "I'll try it for 30 days" dropouts.

Here's how it works:

- Prospects use AI-powered tools to recruit while they're still deciding
- They build real momentum before making any commitment
- When they join YOUR business, they already have a team

75% of new recruits quit in their first year. This changes that.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V18-A CURIOSITY HOOK - SPANISH
// Subject: "Y si tu proximo recluta llegara con 12 personas?"
// =============================================================================
const V18_A_ES_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Y si tu proximo recluta llegara el Dia 1 con 12 personas ya en su linea descendente?</p>

      <p style="margin:0 0 16px 0;">Eso es exactamente lo que hace Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">Es una aplicacion movil que permite a los prospectos pre-construir su equipo ANTES de inscribirse con tu empresa. Sin mas arranques en frio. Sin mas abandonos de "lo intentare por 30 dias".</p>

      <p style="margin:0 0 16px 0;">Asi es como funciona:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Los prospectos usan herramientas impulsadas por IA para reclutar mientras aun estan decidiendo</li>
        <li>Construyen impulso real antes de hacer cualquier compromiso</li>
        <li>Cuando se unen a TU negocio, ya tienen un equipo</li>
      </ul>

      <p style="margin:0 0 16px 0;">El 75% de los nuevos reclutas abandonan en su primer ano. Esto lo cambia.</p>

      <p style="margin:0 0 16px 0;">Mira como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creador, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_A_ES_TEXT = `Hola {{first_name}},

Y si tu proximo recluta llegara el Dia 1 con 12 personas ya en su linea descendente?

Eso es exactamente lo que hace Team Build Pro.

Es una aplicacion movil que permite a los prospectos pre-construir su equipo ANTES de inscribirse con tu empresa. Sin mas arranques en frio. Sin mas abandonos de "lo intentare por 30 dias".

Asi es como funciona:

- Los prospectos usan herramientas impulsadas por IA para reclutar mientras aun estan decidiendo
- Construyen impulso real antes de hacer cualquier compromiso
- Cuando se unen a TU negocio, ya tienen un equipo

El 75% de los nuevos reclutas abandonan en su primer ano. Esto lo cambia.

Mira como funciona: {{tracked_cta_url}}

Stephen Scott
Creador, Team Build Pro

---
Cancelar suscripcion: {{unsubscribe_url}}`;

// =============================================================================
// V18-A CURIOSITY HOOK - PORTUGUESE
// Subject: "E se seu proximo recrutado chegasse com 12 pessoas?"
// =============================================================================
const V18_A_PT_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Ola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">E se seu proximo recrutado chegasse no Dia 1 com 12 pessoas ja em sua linha descendente?</p>

      <p style="margin:0 0 16px 0;">E exatamente isso que o Team Build Pro faz.</p>

      <p style="margin:0 0 16px 0;">E um aplicativo movel que permite que prospectos pre-construam sua equipe ANTES de se inscreverem na sua empresa. Sem mais partidas frias. Sem mais desistencias de "vou tentar por 30 dias".</p>

      <p style="margin:0 0 16px 0;">Veja como funciona:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Prospectos usam ferramentas de IA para recrutar enquanto ainda estao decidindo</li>
        <li>Eles constroem impulso real antes de assumir qualquer compromisso</li>
        <li>Quando se juntam ao SEU negocio, ja tem uma equipe</li>
      </ul>

      <p style="margin:0 0 16px 0;">75% dos novos recrutados desistem no primeiro ano. Isso muda essa realidade.</p>

      <p style="margin:0 0 16px 0;">Veja como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">pt.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Criador, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar inscricao</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_A_PT_TEXT = `Ola {{first_name}},

E se seu proximo recrutado chegasse no Dia 1 com 12 pessoas ja em sua linha descendente?

E exatamente isso que o Team Build Pro faz.

E um aplicativo movel que permite que prospectos pre-construam sua equipe ANTES de se inscreverem na sua empresa. Sem mais partidas frias. Sem mais desistencias de "vou tentar por 30 dias".

Veja como funciona:

- Prospectos usam ferramentas de IA para recrutar enquanto ainda estao decidindo
- Eles constroem impulso real antes de assumir qualquer compromisso
- Quando se juntam ao SEU negocio, ja tem uma equipe

75% dos novos recrutados desistem no primeiro ano. Isso muda essa realidade.

Veja como funciona: {{tracked_cta_url}}

Stephen Scott
Criador, Team Build Pro

---
Cancelar inscricao: {{unsubscribe_url}}`;

// =============================================================================
// V18-A CURIOSITY HOOK - GERMAN
// Subject: "Was wenn Ihr nachster Rekrut mit 12 Leuten kommt?"
// =============================================================================
const V18_A_DE_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hallo {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Was wenn Ihr nachster Rekrut am Tag 1 mit 12 Personen bereits in seiner Downline erscheint?</p>

      <p style="margin:0 0 16px 0;">Genau das macht Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">Es ist eine mobile App, die es Interessenten ermoglicht, ihr Team VORAB aufzubauen, bevor sie sich bei Ihrem Unternehmen anmelden. Keine Kaltstarts mehr. Keine "Ich probiere es 30 Tage"-Abbrecher mehr.</p>

      <p style="margin:0 0 16px 0;">So funktioniert es:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Interessenten nutzen KI-Tools zum Rekrutieren, wahrend sie noch entscheiden</li>
        <li>Sie bauen echte Dynamik auf, bevor sie sich verpflichten</li>
        <li>Wenn sie IHREM Geschaft beitreten, haben sie bereits ein Team</li>
      </ul>

      <p style="margin:0 0 16px 0;">75% der neuen Rekruten geben im ersten Jahr auf. Das andert sich hiermit.</p>

      <p style="margin:0 0 16px 0;">Erfahren Sie, wie es funktioniert: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Grunder, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_A_DE_TEXT = `Hallo {{first_name}},

Was wenn Ihr nachster Rekrut am Tag 1 mit 12 Personen bereits in seiner Downline erscheint?

Genau das macht Team Build Pro.

Es ist eine mobile App, die es Interessenten ermoglicht, ihr Team VORAB aufzubauen, bevor sie sich bei Ihrem Unternehmen anmelden. Keine Kaltstarts mehr. Keine "Ich probiere es 30 Tage"-Abbrecher mehr.

So funktioniert es:

- Interessenten nutzen KI-Tools zum Rekrutieren, wahrend sie noch entscheiden
- Sie bauen echte Dynamik auf, bevor sie sich verpflichten
- Wenn sie IHREM Geschaft beitreten, haben sie bereits ein Team

75% der neuen Rekruten geben im ersten Jahr auf. Das andert sich hiermit.

Erfahren Sie, wie es funktioniert: {{tracked_cta_url}}

Stephen Scott
Grunder, Team Build Pro

---
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// V18-B PAIN POINT HOOK - ENGLISH
// Subject: "75% of your recruits will quit this year (here's why)"
// =============================================================================
const V18_B_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hello {{first_name}},</p>

      <p style="margin:0 0 16px 0;">75% of new direct sales recruits quit within their first year.</p>

      <p style="margin:0 0 16px 0;">Not because they're lazy. Not because the business doesn't work.</p>

      <p style="margin:0 0 16px 0;">Because they start from zero. No team. No momentum. No structure.</p>

      <p style="margin:0 0 16px 0;">By day 30, doubt sets in. By day 60, they're gone.</p>

      <p style="margin:0 0 16px 0;">I built Team Build Pro to fix this.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app that lets your prospects pre-build their downline BEFORE they officially join. They show up on Day 1 with momentum instead of starting from scratch.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro<br>Author, <em>How to Grow Your Network Marketing Business Using AI</em></p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_B_TEXT = `Hello {{first_name}},

75% of new direct sales recruits quit within their first year.

Not because they're lazy. Not because the business doesn't work.

Because they start from zero. No team. No momentum. No structure.

By day 30, doubt sets in. By day 60, they're gone.

I built Team Build Pro to fix this.

It's a mobile app that lets your prospects pre-build their downline BEFORE they officially join. They show up on Day 1 with momentum instead of starting from scratch.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro
Author, How to Grow Your Network Marketing Business Using AI

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V18-B PAIN POINT HOOK - SPANISH
// Subject: "El 75% de tus reclutas abandonaran este ano (aqui esta el porque)"
// =============================================================================
const V18_B_ES_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">El 75% de los nuevos reclutas en ventas directas abandonan dentro de su primer ano.</p>

      <p style="margin:0 0 16px 0;">No porque sean flojos. No porque el negocio no funcione.</p>

      <p style="margin:0 0 16px 0;">Porque empiezan desde cero. Sin equipo. Sin impulso. Sin estructura.</p>

      <p style="margin:0 0 16px 0;">Al dia 30, las dudas aparecen. Al dia 60, se han ido.</p>

      <p style="margin:0 0 16px 0;">Cree Team Build Pro para solucionar esto.</p>

      <p style="margin:0 0 16px 0;">Es una aplicacion movil que permite a tus prospectos pre-construir su linea descendente ANTES de unirse oficialmente. Llegan al Dia 1 con impulso en lugar de empezar desde cero.</p>

      <p style="margin:0 0 16px 0;">Mira como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creador, Team Build Pro<br>Autor, <em>Como Hacer Crecer tu Negocio de Network Marketing Usando IA</em></p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_B_ES_TEXT = `Hola {{first_name}},

El 75% de los nuevos reclutas en ventas directas abandonan dentro de su primer ano.

No porque sean flojos. No porque el negocio no funcione.

Porque empiezan desde cero. Sin equipo. Sin impulso. Sin estructura.

Al dia 30, las dudas aparecen. Al dia 60, se han ido.

Cree Team Build Pro para solucionar esto.

Es una aplicacion movil que permite a tus prospectos pre-construir su linea descendente ANTES de unirse oficialmente. Llegan al Dia 1 con impulso en lugar de empezar desde cero.

Mira como funciona: {{tracked_cta_url}}

Stephen Scott
Creador, Team Build Pro
Autor, Como Hacer Crecer tu Negocio de Network Marketing Usando IA

---
Cancelar suscripcion: {{unsubscribe_url}}`;

// =============================================================================
// V18-B PAIN POINT HOOK - PORTUGUESE
// Subject: "75% dos seus recrutados vao desistir este ano (eis o porque)"
// =============================================================================
const V18_B_PT_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Ola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">75% dos novos recrutados em vendas diretas desistem no primeiro ano.</p>

      <p style="margin:0 0 16px 0;">Nao porque sao preguicosos. Nao porque o negocio nao funciona.</p>

      <p style="margin:0 0 16px 0;">Porque comecam do zero. Sem equipe. Sem impulso. Sem estrutura.</p>

      <p style="margin:0 0 16px 0;">No dia 30, as duvidas aparecem. No dia 60, ja foram embora.</p>

      <p style="margin:0 0 16px 0;">Criei o Team Build Pro para resolver isso.</p>

      <p style="margin:0 0 16px 0;">E um aplicativo movel que permite que seus prospectos pre-construam sua linha descendente ANTES de se juntar oficialmente. Eles chegam no Dia 1 com impulso em vez de comecar do zero.</p>

      <p style="margin:0 0 16px 0;">Veja como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">pt.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Criador, Team Build Pro<br>Autor, <em>Como Expandir seu Negocio de Marketing de Rede Usando IA</em></p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar inscricao</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_B_PT_TEXT = `Ola {{first_name}},

75% dos novos recrutados em vendas diretas desistem no primeiro ano.

Nao porque sao preguicosos. Nao porque o negocio nao funciona.

Porque comecam do zero. Sem equipe. Sem impulso. Sem estrutura.

No dia 30, as duvidas aparecem. No dia 60, ja foram embora.

Criei o Team Build Pro para resolver isso.

E um aplicativo movel que permite que seus prospectos pre-construam sua linha descendente ANTES de se juntar oficialmente. Eles chegam no Dia 1 com impulso em vez de comecar do zero.

Veja como funciona: {{tracked_cta_url}}

Stephen Scott
Criador, Team Build Pro
Autor, Como Expandir seu Negocio de Marketing de Rede Usando IA

---
Cancelar inscricao: {{unsubscribe_url}}`;

// =============================================================================
// V18-B PAIN POINT HOOK - GERMAN
// Subject: "75% Ihrer Rekruten werden dieses Jahr aufgeben (hier ist warum)"
// =============================================================================
const V18_B_DE_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hallo {{first_name}},</p>

      <p style="margin:0 0 16px 0;">75% der neuen Direktvertrieb-Rekruten geben innerhalb ihres ersten Jahres auf.</p>

      <p style="margin:0 0 16px 0;">Nicht weil sie faul sind. Nicht weil das Geschaft nicht funktioniert.</p>

      <p style="margin:0 0 16px 0;">Weil sie bei Null anfangen. Kein Team. Keine Dynamik. Keine Struktur.</p>

      <p style="margin:0 0 16px 0;">Am Tag 30 kommen Zweifel auf. Am Tag 60 sind sie weg.</p>

      <p style="margin:0 0 16px 0;">Ich habe Team Build Pro entwickelt, um das zu andern.</p>

      <p style="margin:0 0 16px 0;">Es ist eine mobile App, die Ihren Interessenten ermoglicht, ihre Downline VORAB aufzubauen, bevor sie offiziell beitreten. Sie erscheinen am Tag 1 mit Schwung, anstatt bei Null anzufangen.</p>

      <p style="margin:0 0 16px 0;">Erfahren Sie, wie es funktioniert: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Grunder, Team Build Pro<br>Autor, <em>Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen</em></p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_B_DE_TEXT = `Hallo {{first_name}},

75% der neuen Direktvertrieb-Rekruten geben innerhalb ihres ersten Jahres auf.

Nicht weil sie faul sind. Nicht weil das Geschaft nicht funktioniert.

Weil sie bei Null anfangen. Kein Team. Keine Dynamik. Keine Struktur.

Am Tag 30 kommen Zweifel auf. Am Tag 60 sind sie weg.

Ich habe Team Build Pro entwickelt, um das zu andern.

Es ist eine mobile App, die Ihren Interessenten ermoglicht, ihre Downline VORAB aufzubauen, bevor sie offiziell beitreten. Sie erscheinen am Tag 1 mit Schwung, anstatt bei Null anzufangen.

Erfahren Sie, wie es funktioniert: {{tracked_cta_url}}

Stephen Scott
Grunder, Team Build Pro
Autor, Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen

---
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// V18-C DIRECT VALUE HOOK - ENGLISH
// Subject: "Give your prospects an AI recruiting coach"
// =============================================================================
const V18_C_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hello {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Imagine if every prospect you talked to had access to:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>A 24/7 AI coach that answers their recruiting questions</li>
        <li>16 pre-written messages they can send immediately</li>
        <li>The ability to start building their team TODAY</li>
      </ul>

      <p style="margin:0 0 16px 0;">That's Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">It's a mobile app I built specifically for direct sales professionals who want to give their prospects real tools, not just hope.</p>

      <p style="margin:0 0 16px 0;">The best part? They can pre-build their downline BEFORE they even sign up with your company. Day 1 momentum instead of Day 1 doubt.</p>

      <p style="margin:0 0 16px 0;">See how it works: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creator, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_C_TEXT = `Hello {{first_name}},

Imagine if every prospect you talked to had access to:

- A 24/7 AI coach that answers their recruiting questions
- 16 pre-written messages they can send immediately
- The ability to start building their team TODAY

That's Team Build Pro.

It's a mobile app I built specifically for direct sales professionals who want to give their prospects real tools, not just hope.

The best part? They can pre-build their downline BEFORE they even sign up with your company. Day 1 momentum instead of Day 1 doubt.

See how it works: {{tracked_cta_url}}

Stephen Scott
Creator, Team Build Pro

---
Unsubscribe: {{unsubscribe_url}}`;

// =============================================================================
// V18-C DIRECT VALUE HOOK - SPANISH
// Subject: "Dale a tus prospectos un coach de reclutamiento con IA"
// =============================================================================
const V18_C_ES_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Imagina si cada prospecto con el que hablas tuviera acceso a:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Un coach de IA 24/7 que responde sus preguntas de reclutamiento</li>
        <li>16 mensajes pre-escritos que pueden enviar inmediatamente</li>
        <li>La capacidad de comenzar a construir su equipo HOY</li>
      </ul>

      <p style="margin:0 0 16px 0;">Eso es Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">Es una aplicacion movil que construi especificamente para profesionales de ventas directas que quieren dar a sus prospectos herramientas reales, no solo esperanza.</p>

      <p style="margin:0 0 16px 0;">La mejor parte? Pueden pre-construir su linea descendente ANTES de inscribirse con tu empresa. Impulso del Dia 1 en lugar de dudas del Dia 1.</p>

      <p style="margin:0 0 16px 0;">Mira como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Creador, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_C_ES_TEXT = `Hola {{first_name}},

Imagina si cada prospecto con el que hablas tuviera acceso a:

- Un coach de IA 24/7 que responde sus preguntas de reclutamiento
- 16 mensajes pre-escritos que pueden enviar inmediatamente
- La capacidad de comenzar a construir su equipo HOY

Eso es Team Build Pro.

Es una aplicacion movil que construi especificamente para profesionales de ventas directas que quieren dar a sus prospectos herramientas reales, no solo esperanza.

La mejor parte? Pueden pre-construir su linea descendente ANTES de inscribirse con tu empresa. Impulso del Dia 1 en lugar de dudas del Dia 1.

Mira como funciona: {{tracked_cta_url}}

Stephen Scott
Creador, Team Build Pro

---
Cancelar suscripcion: {{unsubscribe_url}}`;

// =============================================================================
// V18-C DIRECT VALUE HOOK - PORTUGUESE
// Subject: "De aos seus prospectos um coach de recrutamento com IA"
// =============================================================================
const V18_C_PT_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Ola {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Imagine se cada prospecto com quem voce fala tivesse acesso a:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Um coach de IA 24/7 que responde suas perguntas de recrutamento</li>
        <li>16 mensagens pre-escritas que podem enviar imediatamente</li>
        <li>A capacidade de comecar a construir sua equipe HOJE</li>
      </ul>

      <p style="margin:0 0 16px 0;">Isso e o Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">E um aplicativo movel que criei especificamente para profissionais de vendas diretas que querem dar aos seus prospectos ferramentas reais, nao apenas esperanca.</p>

      <p style="margin:0 0 16px 0;">A melhor parte? Eles podem pre-construir sua linha descendente ANTES de se inscrever na sua empresa. Impulso do Dia 1 em vez de duvidas do Dia 1.</p>

      <p style="margin:0 0 16px 0;">Veja como funciona: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">pt.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Criador, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar inscricao</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_C_PT_TEXT = `Ola {{first_name}},

Imagine se cada prospecto com quem voce fala tivesse acesso a:

- Um coach de IA 24/7 que responde suas perguntas de recrutamento
- 16 mensagens pre-escritas que podem enviar imediatamente
- A capacidade de comecar a construir sua equipe HOJE

Isso e o Team Build Pro.

E um aplicativo movel que criei especificamente para profissionais de vendas diretas que querem dar aos seus prospectos ferramentas reais, nao apenas esperanca.

A melhor parte? Eles podem pre-construir sua linha descendente ANTES de se inscrever na sua empresa. Impulso do Dia 1 em vez de duvidas do Dia 1.

Veja como funciona: {{tracked_cta_url}}

Stephen Scott
Criador, Team Build Pro

---
Cancelar inscricao: {{unsubscribe_url}}`;

// =============================================================================
// V18-C DIRECT VALUE HOOK - GERMAN
// Subject: "Geben Sie Ihren Interessenten einen KI-Recruiting-Coach"
// =============================================================================
const V18_C_DE_HTML = `<html>
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
      <p style="margin:0 0 16px 0;">Hallo {{first_name}},</p>

      <p style="margin:0 0 16px 0;">Stellen Sie sich vor, jeder Interessent, mit dem Sie sprechen, hatte Zugang zu:</p>

      <ul style="margin:0 0 16px 0; padding-left:20px;">
        <li>Einem 24/7 KI-Coach, der ihre Recruiting-Fragen beantwortet</li>
        <li>16 vorgefertigten Nachrichten, die sie sofort senden konnen</li>
        <li>Der Moglichkeit, HEUTE mit dem Aufbau ihres Teams zu beginnen</li>
      </ul>

      <p style="margin:0 0 16px 0;">Das ist Team Build Pro.</p>

      <p style="margin:0 0 16px 0;">Es ist eine mobile App, die ich speziell fur Direktvertriebsprofis entwickelt habe, die ihren Interessenten echte Werkzeuge geben wollen, nicht nur Hoffnung.</p>

      <p style="margin:0 0 16px 0;">Das Beste daran? Sie konnen ihre Downline VORAB aufbauen, bevor sie sich bei Ihrem Unternehmen anmelden. Tag-1-Schwung statt Tag-1-Zweifel.</p>

      <p style="margin:0 0 16px 0;">Erfahren Sie, wie es funktioniert: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a></p>

      <p style="margin:0 0 16px 0;">Stephen Scott<br>Grunder, Team Build Pro</p>

      <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
        <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
      </div>
    </div>
  </div>
</body>
</html>`;

const V18_C_DE_TEXT = `Hallo {{first_name}},

Stellen Sie sich vor, jeder Interessent, mit dem Sie sprechen, hatte Zugang zu:

- Einem 24/7 KI-Coach, der ihre Recruiting-Fragen beantwortet
- 16 vorgefertigten Nachrichten, die sie sofort senden konnen
- Der Moglichkeit, HEUTE mit dem Aufbau ihres Teams zu beginnen

Das ist Team Build Pro.

Es ist eine mobile App, die ich speziell fur Direktvertriebsprofis entwickelt habe, die ihren Interessenten echte Werkzeuge geben wollen, nicht nur Hoffnung.

Das Beste daran? Sie konnen ihre Downline VORAB aufbauen, bevor sie sich bei Ihrem Unternehmen anmelden. Tag-1-Schwung statt Tag-1-Zweifel.

Erfahren Sie, wie es funktioniert: {{tracked_cta_url}}

Stephen Scott
Grunder, Team Build Pro

---
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// TEMPLATE DEFINITIONS (12 total: 3 variants x 4 languages)
// =============================================================================

const templates = [
  // V18-A Curiosity Hook
  { version: 'v18-a', html: V18_A_HTML, text: V18_A_TEXT, description: 'Curiosity Hook (EN)', subject: 'What if your next recruit joined with 12 people?', domain: 'teambuildpro.com' },
  { version: 'v18-a-es', html: V18_A_ES_HTML, text: V18_A_ES_TEXT, description: 'Curiosity Hook (ES)', subject: 'Y si tu proximo recluta llegara con 12 personas?', domain: 'es.teambuildpro.com' },
  { version: 'v18-a-pt', html: V18_A_PT_HTML, text: V18_A_PT_TEXT, description: 'Curiosity Hook (PT)', subject: 'E se seu proximo recrutado chegasse com 12 pessoas?', domain: 'pt.teambuildpro.com' },
  { version: 'v18-a-de', html: V18_A_DE_HTML, text: V18_A_DE_TEXT, description: 'Curiosity Hook (DE)', subject: 'Was wenn Ihr nachster Rekrut mit 12 Leuten kommt?', domain: 'de.teambuildpro.com' },

  // V18-B Pain Point Hook
  { version: 'v18-b', html: V18_B_HTML, text: V18_B_TEXT, description: 'Pain Point Hook (EN)', subject: "75% of your recruits will quit this year (here's why)", domain: 'teambuildpro.com' },
  { version: 'v18-b-es', html: V18_B_ES_HTML, text: V18_B_ES_TEXT, description: 'Pain Point Hook (ES)', subject: 'El 75% de tus reclutas abandonaran este ano (aqui esta el porque)', domain: 'es.teambuildpro.com' },
  { version: 'v18-b-pt', html: V18_B_PT_HTML, text: V18_B_PT_TEXT, description: 'Pain Point Hook (PT)', subject: '75% dos seus recrutados vao desistir este ano (eis o porque)', domain: 'pt.teambuildpro.com' },
  { version: 'v18-b-de', html: V18_B_DE_HTML, text: V18_B_DE_TEXT, description: 'Pain Point Hook (DE)', subject: '75% Ihrer Rekruten werden dieses Jahr aufgeben (hier ist warum)', domain: 'de.teambuildpro.com' },

  // V18-C Direct Value Hook
  { version: 'v18-c', html: V18_C_HTML, text: V18_C_TEXT, description: 'Direct Value Hook (EN)', subject: 'Give your prospects an AI recruiting coach', domain: 'teambuildpro.com' },
  { version: 'v18-c-es', html: V18_C_ES_HTML, text: V18_C_ES_TEXT, description: 'Direct Value Hook (ES)', subject: 'Dale a tus prospectos un coach de reclutamiento con IA', domain: 'es.teambuildpro.com' },
  { version: 'v18-c-pt', html: V18_C_PT_HTML, text: V18_C_PT_TEXT, description: 'Direct Value Hook (PT)', subject: 'De aos seus prospectos um coach de recrutamento com IA', domain: 'pt.teambuildpro.com' },
  { version: 'v18-c-de', html: V18_C_DE_HTML, text: V18_C_DE_TEXT, description: 'Direct Value Hook (DE)', subject: 'Geben Sie Ihren Interessenten einen KI-Recruiting-Coach', domain: 'de.teambuildpro.com' }
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
    console.log(`  Updated ${version}`);
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      // Template version doesn't exist, create it
      console.log(`  Creating new version ${version}...`);
      return await createTemplate(version, html, text, description);
    }
    console.error(`  Error updating ${version}:`, error.response?.data || error.message);
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
    console.log(`  Created ${version}`);
    return true;
  } catch (error) {
    console.error(`  Error creating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function sendTestEmail(version, subject, domain) {
  console.log(`Sending test email for ${version}...`);

  const landingPageUrl = `https://${domain}?utm_source=mailgun&utm_medium=email&utm_campaign=v18_test&utm_content=${version}`;
  const unsubscribeUrl = `https://${domain}/unsubscribe.html?email=scscot@gmail.com`;

  const form = new FormData();
  form.append('from', 'Stephen Scott <stephen@news.teambuildpro.com>');
  form.append('to', 'Stephen Scott <scscot@gmail.com>');
  form.append('subject', `${subject} [TEST ${version.toUpperCase()}]`);
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
    console.log(`  Sent test for ${version}: ${response.data.id}`);
    return true;
  } catch (error) {
    console.error(`  Error sending test email:`, error.response?.data || error.message);
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
    console.error('TBP_MAILGUN_API_KEY environment variable not set');
    console.error('Make sure functions/.env.teambuilder-plus-fe74d exists');
    process.exit(1);
  }

  console.log('Updating V18 Mailgun Templates (A/B/C Testing)');
  console.log('===============================================');
  console.log('');
  console.log('V18-A: Curiosity Hook - "What if your next recruit joined with 12 people?"');
  console.log('V18-B: Pain Point Hook - "75% of your recruits will quit this year..."');
  console.log('V18-C: Direct Value Hook - "Give your prospects an AI recruiting coach"');
  console.log('');
  console.log('Languages: EN, ES, PT, DE (12 templates total)');
  console.log('');

  let successCount = 0;

  for (const { version, html, text, description } of templates) {
    const success = await updateTemplate(version, html, text, description);
    if (success) successCount++;
  }

  if (sendTest && successCount === templates.length) {
    console.log('\n--- Sending Test Emails ---');
    for (const { version, subject, domain } of templates) {
      await sendTestEmail(version, subject, domain);
    }
  }

  console.log('\n===============================================');
  console.log(`${successCount}/${templates.length} templates updated successfully`);

  if (!sendTest) {
    console.log('\nRun with --test flag to send test emails:');
    console.log('  node scripts/update-v18-templates.js --test');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
