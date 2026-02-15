/**
 * Gmail OAuth Setup Script
 *
 * One-time interactive script to authorize Gmail API access and generate
 * a refresh token for the spam monitoring system.
 *
 * Prerequisites:
 * 1. Create OAuth 2.0 Client ID in Google Cloud Console (Desktop app type)
 * 2. Enable Gmail API in APIs & Services > Library
 * 3. Download credentials JSON and save as gmail-credentials.json
 *
 * Usage:
 *   node scripts/gmail-oauth-setup.js
 *
 * The script will:
 * 1. Open browser for Google authorization
 * 2. Exchange auth code for tokens
 * 3. Output refresh token JSON to store as GMAIL_OAUTH_TOKEN secret
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

// =============================================================================
// OAUTH FLOW
// =============================================================================

async function getCredentials() {
  // Try to load from file first
  const credentialsPath = path.join(__dirname, 'gmail-credentials.json');

  if (fs.existsSync(credentialsPath)) {
    console.log('Loading credentials from gmail-credentials.json...');
    const content = fs.readFileSync(credentialsPath, 'utf8');
    return JSON.parse(content);
  }

  // Try environment variable
  if (process.env.GMAIL_OAUTH_CREDENTIALS) {
    console.log('Loading credentials from environment variable...');
    return JSON.parse(process.env.GMAIL_OAUTH_CREDENTIALS);
  }

  console.error('\nError: No credentials found!\n');
  console.error('Please either:');
  console.error('1. Download OAuth credentials from Google Cloud Console');
  console.error('2. Save as scripts/gmail-credentials.json');
  console.error('\nOr set GMAIL_OAUTH_CREDENTIALS environment variable.\n');
  console.error('Steps to create credentials:');
  console.error('1. Go to https://console.cloud.google.com/apis/credentials');
  console.error('2. Click "Create Credentials" > "OAuth client ID"');
  console.error('3. Select "Desktop app" as application type');
  console.error('4. Download the JSON file');
  process.exit(1);
}

async function authorize() {
  const credentials = await getCredentials();

  // Handle both "installed" and "web" credential types
  const { client_secret, client_id } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to get refresh token
  });

  console.log('\n=== Gmail OAuth Setup ===\n');
  console.log('Opening browser for authorization...\n');
  console.log('If browser does not open, visit this URL manually:');
  console.log('\n' + authUrl + '\n');

  // Open browser (macOS)
  const { exec } = require('child_process');
  exec(`open "${authUrl}"`);

  // Start local server to receive callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const queryObject = url.parse(req.url, true).query;

      if (queryObject.code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        server.close();

        try {
          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(queryObject.code);
          resolve(tokens);
        } catch (error) {
          reject(error);
        }
      } else if (queryObject.error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error: ${queryObject.error}</h1>`);
        server.close();
        reject(new Error(queryObject.error));
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Waiting for authorization callback on port ${REDIRECT_PORT}...`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 300000);
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  try {
    const tokens = await authorize();

    console.log('\n=== Authorization Complete! ===\n');

    if (!tokens.refresh_token) {
      console.error('Warning: No refresh token received!');
      console.error('This can happen if the app was already authorized.');
      console.error('Go to https://myaccount.google.com/permissions and remove');
      console.error('the app, then run this script again.\n');
    }

    // Output token JSON for GitHub secret
    const tokenJson = JSON.stringify(tokens, null, 2);

    console.log('Add the following JSON to your GMAIL_OAUTH_TOKEN GitHub secret:\n');
    console.log('----------------------------------------');
    console.log(tokenJson);
    console.log('----------------------------------------\n');

    // Also save to file for backup
    const tokenPath = path.join(__dirname, 'gmail-token.json');
    fs.writeFileSync(tokenPath, tokenJson);
    console.log(`Token also saved to: ${tokenPath}`);
    console.log('(Add this file to .gitignore - do not commit!)\n');

    // Verify the token works
    console.log('Verifying token...');
    const credentials = await getCredentials();
    const { client_secret, client_id } = credentials.installed || credentials.web;

    const oauth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    console.log(`Verified! Connected to: ${profile.data.emailAddress}`);
    console.log(`Total messages: ${profile.data.messagesTotal}\n`);

    console.log('=== Setup Complete! ===\n');
    console.log('Next steps:');
    console.log('1. Add gmail-credentials.json content to GMAIL_OAUTH_CREDENTIALS secret');
    console.log('2. Add the token JSON above to GMAIL_OAUTH_TOKEN secret');
    console.log('3. Add gmail-token.json and gmail-credentials.json to .gitignore\n');

  } catch (error) {
    console.error('\nAuthorization failed:', error.message);
    process.exit(1);
  }
}

main();
