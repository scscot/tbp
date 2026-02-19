/**
 * Setup Mailgun Templates for Zinzino Email Campaign
 *
 * Creates/updates the 'mailer' template with localized versions:
 * - v9-es: Spanish minimal version (no bullets)
 * - v10-es: Spanish version with bullets
 * - v9-de: German minimal version (no bullets)
 * - v10-de: German version with bullets
 *
 * Usage:
 *   node setup-zinzino-templates.js
 *
 * Requires:
 *   - MAILGUN_API_KEY environment variable (or TBP_MAILGUN_API_KEY)
 */

const axios = require('axios');
const FormData = require('form-data');

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || process.env.TBP_MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || process.env.TBP_MAILGUN_DOMAIN || 'news.teambuildpro.com';
const TEMPLATE_NAME = 'mailer';

// =============================================================================
// SPANISH TEMPLATES (Mexico style)
// =============================================================================

/**
 * V9-ES Template: Minimal version in Spanish
 * Uses informal "tu" form (Mexico/Latin America style)
 */
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
      Cree algo para personas que ya estan en ventas directas y quieren una mejor manera de apoyar a su equipo existente.
    </p>

    <p style="margin:0 0 16px 0;">
      Esta disenado para ayudar con cosas como:
    </p>

    <ul style="margin:0 0 16px 10px;">
      <li style="margin-bottom:6px;">saber que decir sin pensarlo demasiado</li>
      <li style="margin-bottom:6px;">dar estructura a personas nuevas en lugar de empezar de cero</li>
      <li style="margin-bottom:0;">permitir que los prospectos ganen confianza antes de unirse</li>
    </ul>

    <p style="margin:0 0 16px 0;">
      Funciona junto con cualquier empresa en la que ya estes.
    </p>

    <p style="margin:0 0 16px 0;">
      Si te interesa, puedes verlo aqui: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Saludos,<br>
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
    </div>

  </div>
</body>
</html>`;

/**
 * V10-ES Template: Version with bullet points in Spanish
 */
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
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">es.teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Cancelar suscripcion</a>
    </div>

  </div>
</body>
</html>`;

// =============================================================================
// GERMAN TEMPLATES
// =============================================================================

/**
 * V9-DE Template: Minimal version in German
 * Uses formal "Sie" form (business appropriate)
 */
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
      Ich habe etwas fur Menschen entwickelt, die bereits im Direktvertrieb tatig sind und einen besseren Weg suchen, ihr bestehendes Team zu unterstutzen.
    </p>

    <p style="margin:0 0 16px 0;">
      Es hilft bei Dingen wie:
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
      Wenn Sie neugierig sind, schauen Sie hier: <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a>
    </p>

    <p style="margin:0 0 16px 0;">
      Mit freundlichen Grussen,<br>
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:16px; border-top:1px solid #eeeeee; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
    </div>

  </div>
</body>
</html>`;

/**
 * V10-DE Template: Version with bullet points in German
 */
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
      Stephen Scott
    </p>

    <!-- Footer -->
    <div style="margin-top:32px; padding-top:16px; border-top:1px solid #eeeeee; font-size:12px; line-height:1.5; color:#777777;">
      <a href="{{tracked_cta_url}}" style="color:#1a73e8; text-decoration:underline;">de.teambuildpro.com</a>
      &nbsp;&middot;&nbsp;
      <a href="{{unsubscribe_url}}" style="color:#777777; text-decoration:underline;">Abmelden</a>
    </div>

  </div>
</body>
</html>`;

// =============================================================================
// PLAIN TEXT VERSIONS
// =============================================================================

const V9_ES_TEXT = `Hola {{first_name}},

No te estoy reclutando, y esto no es una oportunidad de negocio.

Cree algo para personas que ya estan en ventas directas y quieren una mejor manera de apoyar a su equipo existente.

Esta disenado para ayudar con cosas como:

* saber que decir sin pensarlo demasiado
* dar estructura a personas nuevas en lugar de empezar de cero
* permitir que los prospectos ganen confianza antes de unirse

Funciona junto con cualquier empresa en la que ya estes.

Si te interesa, puedes verlo aqui:
{{tracked_cta_url}}

Saludos,
Stephen Scott

---
es.teambuildpro.com
Cancelar suscripcion: {{unsubscribe_url}}`;

const V10_ES_TEXT = `Hola {{first_name}},

Que pasaria si tu proximo recluta llegara con 20 personas ya alineadas?

Eso es lo que hace Team Build Pro - permite a los prospectos pre-construir su linea descendente ANTES de inscribirse. Impulso desde el Dia 1 en lugar de dudas.

Para ti, esto significa:

* Reclutas que permanecen (no renuncian en 90 dias)
* Una herramienta que les entregas y hace el trabajo pesado
* Crecimiento que se multiplica mientras te enfocas en otras cosas

Funciona con cualquier empresa. Impulsa la que ya tienes.

-> Mira como funciona: {{tracked_cta_url}}

Saludos,
Stephen Scott

---
es.teambuildpro.com
Cancelar suscripcion: {{unsubscribe_url}}`;

const V9_DE_TEXT = `Hallo {{first_name}},

Ich rekrutiere Sie nicht, und dies ist keine Geschaftsmoglichkeit.

Ich habe etwas fur Menschen entwickelt, die bereits im Direktvertrieb tatig sind und einen besseren Weg suchen, ihr bestehendes Team zu unterstutzen.

Es hilft bei Dingen wie:

* zu wissen, was man sagen soll, ohne zu viel nachzudenken
* neuen Leuten Struktur zu geben, anstatt bei Null anzufangen
* Interessenten Vertrauen aufbauen zu lassen, bevor sie beitreten

Es funktioniert mit jedem Unternehmen, bei dem Sie bereits sind.

Wenn Sie neugierig sind, schauen Sie hier:
{{tracked_cta_url}}

Mit freundlichen Grussen,
Stephen Scott

---
de.teambuildpro.com
Abmelden: {{unsubscribe_url}}`;

const V10_DE_TEXT = `Hallo {{first_name}},

Was ware, wenn Ihr nachster Rekrut mit 20 Personen bereits aufgestellt beitreten wurde?

Das macht Team Build Pro - es lasst Interessenten ihre Downline aufbauen, BEVOR sie sich anmelden. Schwung vom ersten Tag an statt Zweifel.

Fur Sie bedeutet das:

* Rekruten, die bleiben (nicht nach 90 Tagen aufgeben)
* Ein Tool, das Sie ubergeben und das die schwere Arbeit ubernimmt
* Wachstum, das sich multipliziert, wahrend Sie sich auf anderes konzentrieren

Funktioniert mit jedem Unternehmen. Starkt das, was Sie bereits haben.

-> Sehen Sie, wie es funktioniert: {{tracked_cta_url}}

Mit freundlichen Grussen,
Stephen Scott

---
de.teambuildpro.com
Abmelden: {{unsubscribe_url}}`;

// =============================================================================
// MAILGUN API HELPERS
// =============================================================================

function getAuthHeader() {
  return `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`;
}

async function createOrUpdateTemplate() {
  const baseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates`;

  // Check if template exists
  try {
    await axios.get(`${baseUrl}/${TEMPLATE_NAME}`, {
      headers: { 'Authorization': getAuthHeader() }
    });
    console.log(`Template '${TEMPLATE_NAME}' already exists`);
  } catch (error) {
    if (error.response?.status === 404) {
      // Create template
      console.log(`Creating template '${TEMPLATE_NAME}'...`);
      const form = new FormData();
      form.append('name', TEMPLATE_NAME);
      form.append('description', 'TBP Email Campaign Template');

      await axios.post(baseUrl, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': getAuthHeader()
        }
      });
      console.log(`Template '${TEMPLATE_NAME}' created`);
    } else {
      throw error;
    }
  }
}

async function createOrUpdateVersion(tag, html, text, description) {
  const baseUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/templates/${TEMPLATE_NAME}/versions`;

  // Try to update existing version first
  try {
    const form = new FormData();
    form.append('template', html);
    form.append('comment', description);
    form.append('active', 'yes');

    await axios.put(`${baseUrl}/${tag}`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': getAuthHeader()
      }
    });
    console.log(`Updated version '${tag}'`);
    return;
  } catch (error) {
    if (error.response?.status !== 404) {
      if (error.response?.status !== 400) {
        throw error;
      }
    }
  }

  // Create new version
  console.log(`Creating version '${tag}'...`);
  const form = new FormData();
  form.append('tag', tag);
  form.append('template', html);
  form.append('comment', description);
  form.append('active', 'yes');

  try {
    await axios.post(baseUrl, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': getAuthHeader()
      }
    });
    console.log(`Created version '${tag}'`);
  } catch (error) {
    console.error(`Failed to create version '${tag}':`, error.response?.data || error.message);
    throw error;
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(60));
  console.log('Zinzino Email Campaign - Mailgun Template Setup');
  console.log('='.repeat(60));
  console.log(`Domain: ${MAILGUN_DOMAIN}`);
  console.log(`Template: ${TEMPLATE_NAME}`);
  console.log('');

  if (!MAILGUN_API_KEY) {
    console.error('MAILGUN_API_KEY environment variable not set');
    console.log('Usage: MAILGUN_API_KEY=your-key node setup-zinzino-templates.js');
    process.exit(1);
  }

  try {
    // Ensure template exists
    await createOrUpdateTemplate();

    // Create Spanish versions
    console.log('\n--- V9-ES: Spanish Minimal ---');
    await createOrUpdateVersion('v9-es', V9_ES_HTML, V9_ES_TEXT, 'V9-ES: Spanish minimal version for Zinzino campaign');

    console.log('\n--- V10-ES: Spanish with Bullets ---');
    await createOrUpdateVersion('v10-es', V10_ES_HTML, V10_ES_TEXT, 'V10-ES: Spanish version with bullets for Zinzino campaign');

    // Create German versions
    console.log('\n--- V9-DE: German Minimal ---');
    await createOrUpdateVersion('v9-de', V9_DE_HTML, V9_DE_TEXT, 'V9-DE: German minimal version for Zinzino campaign');

    console.log('\n--- V10-DE: German with Bullets ---');
    await createOrUpdateVersion('v10-de', V10_DE_HTML, V10_DE_TEXT, 'V10-DE: German version with bullets for Zinzino campaign');

    console.log('\n' + '='.repeat(60));
    console.log('Template setup complete!');
    console.log('='.repeat(60));
    console.log('\nVersions created:');
    console.log('  - v9-es: Spanish minimal (Mexico/Latin America style)');
    console.log('  - v10-es: Spanish with bullets');
    console.log('  - v9-de: German minimal (formal Sie form)');
    console.log('  - v10-de: German with bullets');
    console.log('\nTemplate variables:');
    console.log('  - first_name: Recipient first name');
    console.log('  - tracked_cta_url: Click-tracked landing page URL');
    console.log('  - unsubscribe_url: Unsubscribe page URL');

  } catch (error) {
    console.error('\nSetup failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
