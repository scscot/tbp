/**
 * Update v9-es and v9-de templates with translations of the new v9 template
 */

const axios = require('axios');
const FormData = require('form-data');

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

const V9_ES_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
    <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

        <p style="margin:0 0 16px 0;">
            Hola {{first_name}},
        </p>

        <p style="margin:0 0 16px 0;">
            No te estoy reclutando, y esto no es una oportunidad.
        </p>

        <p style="margin:0 0 16px 0;">
            Aproximadamente el 75% de los nuevos representantes de ventas directas renuncian en su primer ano.
        </p>

        <p style="margin:0 0 16px 0;">
            Eso no es un problema de motivacion. Es un problema de sistemas.
        </p>

        <p style="margin:0 0 16px 0;">
            La mayoria de las personas se estancan porque no saben que decir o como crear impulso.
        </p>

        <p style="margin:0 0 16px 0;">
            Construi una app impulsada por IA para solucionar esto.
        </p>

        <p style="margin:0 0 16px 0;">
            <strong>Team Build Pro</strong> ofrece:
        </p>

        <ul style="margin:0 0 16px 20px; padding:0;">
            <li style="margin-bottom:6px;">17 mensajes de reclutamiento pre-escritos</li>
            <li style="margin-bottom:6px;">Coaching de IA 24/7</li>
            <li style="margin-bottom:0;">Una forma de construir un equipo antes de unirse</li>
        </ul>

        <p style="margin:0 0 16px 0;">
            Funciona con cualquier empresa.
        </p>

        <p style="margin:0 0 16px 0;">
            Mira como funciona:
            <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
        </p>

        <p style="margin:0 0 16px 0;">
            Exitos en tu camino,
        </p>

        <p style="margin:0 0 16px 0;">
            Stephen Scott<br>
            Creador, Team Build Pro<br>
            Autor, <em>Como hacer crecer tu negocio de Network Marketing usando IA</em>
        </p>

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
            <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
        </div>

    </div>
</body>
</html>`;

const V9_DE_HTML = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
    <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

        <p style="margin:0 0 16px 0;">
            Hallo {{first_name}},
        </p>

        <p style="margin:0 0 16px 0;">
            Ich rekrutiere Sie nicht, und dies ist keine Gelegenheit.
        </p>

        <p style="margin:0 0 16px 0;">
            Etwa 75% der neuen Direktvertriebler geben in ihrem ersten Jahr auf.
        </p>

        <p style="margin:0 0 16px 0;">
            Das ist kein Motivationsproblem. Es ist ein Systemproblem.
        </p>

        <p style="margin:0 0 16px 0;">
            Die meisten Menschen stagnieren, weil sie nicht wissen, was sie sagen sollen oder wie sie Schwung erzeugen konnen.
        </p>

        <p style="margin:0 0 16px 0;">
            Ich habe eine KI-gesteuerte App entwickelt, um dies zu losen.
        </p>

        <p style="margin:0 0 16px 0;">
            <strong>Team Build Pro</strong> bietet:
        </p>

        <ul style="margin:0 0 16px 20px; padding:0;">
            <li style="margin-bottom:6px;">17 vorgefertigte Recruiting-Nachrichten</li>
            <li style="margin-bottom:6px;">24/7 KI-Coaching</li>
            <li style="margin-bottom:0;">Eine Moglichkeit, ein Team aufzubauen, bevor man beitritt</li>
        </ul>

        <p style="margin:0 0 16px 0;">
            Es funktioniert mit jedem Unternehmen.
        </p>

        <p style="margin:0 0 16px 0;">
            Sehen Sie, wie es funktioniert:
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
</body>
</html>`;

async function updateTemplate(version, html) {
  console.log(`Updating ${version}...`);

  const form = new FormData();
  form.append('template', html);
  form.append('active', 'yes');

  try {
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
    console.error(`  ❌ Error updating ${version}:`, error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('Updating v9-es and v9-de templates...\n');

  await updateTemplate('v9-es', V9_ES_HTML);
  await updateTemplate('v9-de', V9_DE_HTML);

  console.log('\nDone!');
}

main();
