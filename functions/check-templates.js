const axios = require('axios');
const fs = require('fs');

async function main() {
  // Get API key from secrets file
  const config = JSON.parse(fs.readFileSync('../secrets/mailgun_config.json', 'utf8'));
  const apiKey = config.api_key;

  const domain = 'mailer.teambuildpro.com';

  try {
    const response = await axios.get(
      `https://api.mailgun.net/v3/${domain}/templates/mailer/versions`,
      { auth: { username: 'api', password: apiKey } }
    );
    
    console.log('Template versions found:', response.data.template.versions.length);
    
    for (const version of response.data.template.versions) {
      if (version.tag === 'scripts' || version.tag === 'cold_reconnect') {
        console.log('\n========================================');
        console.log('VERSION:', version.tag);
        console.log('========================================');
        
        const versionResponse = await axios.get(
          `https://api.mailgun.net/v3/${domain}/templates/mailer/versions/${version.tag}`,
          { auth: { username: 'api', password: apiKey } }
        );
        
        const html = versionResponse.data.template.version.template;
        
        // Extract all href links with UTM params
        const linkMatches = html.match(/href="[^"]*utm[^"]*"/g);
        console.log('\nLinks with UTM params:');
        if (linkMatches) {
          linkMatches.forEach(link => console.log('  ', link));
        } else {
          console.log('  None found');
        }
        
        // Check for template variables
        const varMatches = html.match(/\{\{[^}]+\}\}/g);
        console.log('\nTemplate variables used:');
        if (varMatches) {
          [...new Set(varMatches)].forEach(v => console.log('  ', v));
        } else {
          console.log('  None found');
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
