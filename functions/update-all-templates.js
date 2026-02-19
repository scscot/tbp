/**
 * Update all Mailgun templates with consistent signature and footer
 * Based on authoritative v9 template
 */

const axios = require('axios');
const FormData = require('form-data');

const MAILGUN_API_KEY = process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

// Updated templates with proper signature and footer

const V10_HTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#ffffff;">
    <div style="max-width:600px; padding:20px; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1a1a1a;">

        <p style="margin:0 0 16px 0;">
            Hello {{first_name}},
        </p>

        <p style="margin:0 0 16px 0;">
            I'm not recruiting you, and this isn't an opportunity.
        </p>

        <p style="margin:0 0 16px 0;">
            I built the <strong>Team Build Pro</strong> app for people in direct sales who want a smarter way to grow their team.
        </p>

        <p style="margin:0 0 16px 0;">
            It helps with things like:
        </p>

        <ul style="margin:0 0 16px 20px; padding:0;">
            <li style="margin-bottom:6px;">knowing what to say without overthinking it</li>
            <li style="margin-bottom:6px;">giving new people structure instead of starting from zero</li>
            <li style="margin-bottom:0;">letting prospects build confidence before joining</li>
        </ul>

        <p style="margin:0 0 16px 0;">
            It works with whatever company you're already with.
        </p>

        <p style="margin:0 0 16px 0;">
            If you're curious: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">teambuildpro.com</a>
        </p>

        <p style="margin:0 0 16px 0;">
            Best,<br>
            Stephen Scott<br>
            Creator, Team Build Pro<br>
            Author, <em>How to Grow Your Network Marketing Business Using AI</em>
        </p>

        <!-- Footer -->
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
            <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Unsubscribe</a>
        </div>

    </div>
</body>
</html>`;

const V9_ES_HTML = `<!DOCTYPE html>
<html>
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
      No te estoy reclutando, y esto no es una oportunidad de negocio.
    </p>

    <p style="margin:0 0 16px 0;">
      Despues de mas de 20 anos creando herramientas para ventas directas y entrenando a miles de constructores de equipos, seguia viendo el mismo problema: la gente se une emocionada... y luego se estanca y renuncia antes de ganar impulso. Asi que construi algo para solucionar eso.
    </p>

    <p style="margin:0 0 16px 0;">
      La app <strong>Team Build Pro</strong> es una herramienta de IA para personas en ventas directas que quieren una mejor manera de apoyar a su equipo. Ayuda con cosas como:
    </p>

    <ul style="margin:0 0 16px 10px;">
      <li style="margin-bottom:6px;">saber que decir sin pensarlo demasiado</li>
      <li style="margin-bottom:6px;">dar estructura a personas nuevas en lugar de empezar de cero</li>
      <li style="margin-bottom:0;">permitir que los prospectos ganen confianza antes de unirse</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Funciona con cualquier empresa en la que ya estes.
    </p>

    <p style="margin:0 0 16px 0;">
      Si te interesa: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Saludos,<br>
      Stephen Scott<br>
      Creador, Team Build Pro<br>
      Autor, <em>Como hacer crecer tu negocio de Network Marketing usando IA</em>
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
    </div>

  </div>
</body>
</html>`;

const V10_ES_HTML = `<!DOCTYPE html>
<html>
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
      Que pasaria si tu proximo recluta llegara con <strong>20 personas ya alineadas?</strong>
    </p>

    <p style="margin:0 0 16px 0;">
      Eso es lo que hace Team Build Pro - permite a los prospectos pre-construir su linea descendente ANTES de inscribirse. Impulso desde el Dia 1 en lugar de dudas.
    </p>

    <p style="margin:0 0 16px 0;">
      Para ti, esto significa:
    </p>

    <ul style="margin:0 0 16px 20px; padding:0; color:#1a1a1a;">
      <li style="margin-bottom:8px;">Reclutas que permanecen (no renuncian en 90 dias)</li>
      <li style="margin-bottom:8px;">Una herramienta que les entregas y hace el trabajo pesado</li>
      <li style="margin-bottom:0;">Crecimiento que se multiplica mientras te enfocas en otras cosas</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Funciona con cualquier empresa. Impulsa la que ya tienes.
    </p>

    <p style="margin:0 0 24px 0;">
      <a href="{{tracked_cta_url}}" style="color:#7c3aed; font-weight:600; text-decoration:none; font-size:17px;">&#8594; Mira como funciona</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Saludos,<br>
      Stephen Scott<br>
      Creador, Team Build Pro<br>
      Autor, <em>Como hacer crecer tu negocio de Network Marketing usando IA</em>
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
    </div>

  </div>
</body>
</html>`;

const V9_DE_HTML = `<!DOCTYPE html>
<html>
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
      Ich rekrutiere Sie nicht, und dies ist keine Geschaftsmoglichkeit.
    </p>

    <p style="margin:0 0 16px 0;">
      Nach uber 20 Jahren im Aufbau von Tools fur den Direktvertrieb und der Schulung von Tausenden von Teambuildern sah ich immer wieder dasselbe Problem: Menschen treten begeistert bei... und stagnieren dann und geben auf, bevor sie je Schwung bekommen. Also habe ich etwas gebaut, um das zu losen.
    </p>

    <p style="margin:0 0 16px 0;">
      Die <strong>Team Build Pro</strong> App ist ein KI-Tool fur Menschen im Direktvertrieb, die einen besseren Weg suchen, ihr Team zu unterstutzen. Es hilft bei Dingen wie:
    </p>

    <ul style="margin:0 0 16px 10px;">
      <li style="margin-bottom:6px;">zu wissen, was man sagen soll, ohne zu viel nachzudenken</li>
      <li style="margin-bottom:6px;">neuen Leuten Struktur zu geben, anstatt bei Null anzufangen</li>
      <li style="margin-bottom:0;">Interessenten Vertrauen aufbauen zu lassen, bevor sie beitreten</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Es funktioniert mit jedem Unternehmen, bei dem Sie bereits sind.
    </p>

    <p style="margin:0 0 16px 0;">
      Wenn Sie neugierig sind: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Mit freundlichen Grussen,<br>
      Stephen Scott<br>
      Grunder, Team Build Pro<br>
      Autor, <em>Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen</em>
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
    </div>

  </div>
</body>
</html>`;

const V10_DE_HTML = `<!DOCTYPE html>
<html>
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
      Was ware, wenn Ihr nachster Rekrut mit <strong>20 Personen bereits aufgestellt</strong> beitreten wurde?
    </p>

    <p style="margin:0 0 16px 0;">
      Das macht Team Build Pro - es lasst Interessenten ihre Downline aufbauen, BEVOR sie sich anmelden. Schwung vom ersten Tag an statt Zweifel.
    </p>

    <p style="margin:0 0 16px 0;">
      Fur Sie bedeutet das:
    </p>

    <ul style="margin:0 0 16px 20px; padding:0; color:#1a1a1a;">
      <li style="margin-bottom:8px;">Rekruten, die bleiben (nicht nach 90 Tagen aufgeben)</li>
      <li style="margin-bottom:8px;">Ein Tool, das Sie ubergeben und das die schwere Arbeit ubernimmt</li>
      <li style="margin-bottom:0;">Wachstum, das sich multipliziert, wahrend Sie sich auf anderes konzentrieren</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Funktioniert mit jedem Unternehmen. Starkt das, was Sie bereits haben.
    </p>

    <p style="margin:0 0 24px 0;">
      <a href="{{tracked_cta_url}}" style="color:#7c3aed; font-weight:600; text-decoration:none; font-size:17px;">&#8594; Sehen Sie, wie es funktioniert</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Mit freundlichen Grussen,<br>
      Stephen Scott<br>
      Grunder, Team Build Pro<br>
      Autor, <em>Wie Sie Ihr Network-Marketing-Geschaft mit KI ausbauen</em>
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
    </div>

  </div>
</body>
</html>`;

const templates = [
  { version: 'v10', html: V10_HTML },
  { version: 'v9-es', html: V9_ES_HTML },
  { version: 'v10-es', html: V10_ES_HTML },
  { version: 'v9-de', html: V9_DE_HTML },
  { version: 'v10-de', html: V10_DE_HTML }
];

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
  console.log('Updating all Mailgun templates with consistent signature and footer...\n');

  for (const { version, html } of templates) {
    await updateTemplate(version, html);
  }

  console.log('\nDone!');
}

main();
