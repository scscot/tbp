#!/usr/bin/env node
/**
 * Create v17-de Mailgun template (German)
 * v17 uses generic "Herzliche Grusse!" greeting (no personalization)
 * Used for THREE International campaign where names are unavailable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.TBP_MAILGUN_API_KEY;
if (!API_KEY) {
  console.error('Error: TBP_MAILGUN_API_KEY environment variable not set');
  process.exit(1);
}
const DOMAIN = 'news.teambuildpro.com';

const templateHtml = fs.readFileSync(path.join(__dirname, 'v17-template-de.html'), 'utf8');

const formData = new URLSearchParams();
formData.append('tag', 'v17-de');
formData.append('comment', 'German - Generic greeting (Mar 2026)');
formData.append('engine', 'handlebars');
formData.append('template', templateHtml);
formData.append('headers', JSON.stringify({
  "From": "stephen@news.teambuildpro.com",
  "Reply-To": "stephen@news.teambuildpro.com",
  "Subject": "Ihre Interessenten glauben nicht dass sie rekrutieren konnen"
}));

const options = {
  hostname: 'api.mailgun.net',
  port: 443,
  path: `/v3/${DOMAIN}/templates/mailer/versions`,
  method: 'POST',
  auth: `api:${API_KEY}`,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData.toString())
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(formData.toString());
req.end();
