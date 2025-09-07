const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Load Mailgun configuration from secrets
const mailgunConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'secrets', 'mailgun_config.json'), 'utf8')
);

const MAILGUN_API_KEY = mailgunConfig.api_key;
const MAILGUN_DOMAIN = mailgunConfig.domain;
const MAILGUN_BASE_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;

// Function to send a test email using your Mailgun template
async function sendTestEmail() {
  try {
    const form = new FormData();
    
    // Email configuration
    form.append('from', 'Stephen Scott <sscott@stephenscott.us>');
    form.append('to', 'Stephen Scott <scscot@gmail.com>');
    form.append('subject', 'A New Approach to Recruiting and Team Building');
    form.append('template', 'team build pro'); // Replace with your actual template name
    
    // Template variables based on your CSV format (firstname lastname,email)
    form.append('h:X-Mailgun-Variables', JSON.stringify({
      first_name: 'Stephen',
      last_name: 'Scott',
      email: 'scscot@gmail.com'
    }));

    // Send the email
    const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', response.data.id);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending email:', error.response?.data || error.message);
    throw error;
  }
}

// Function to send to multiple recipients (for your full campaign later)
async function sendBulkCampaign(recipientList) {
  try {
    const form = new FormData();
    
    form.append('from', 'Stephen Scott <sscott@stephenscott.us>');
    form.append('subject', 'A New Approach to Recruiting and Team Building');
    form.append('template', 'team build pro'); // Your template name

    // Add multiple recipients
    recipientList.forEach(recipient => {
      form.append('to', `${recipient.name} <${recipient.email}>`);
    });
    
    // Template variables for bulk sending
    form.append('h:X-Mailgun-Variables', JSON.stringify({
      // Add your template variables here
    }));

    const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    console.log('✅ Bulk campaign sent successfully!');
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending bulk campaign:', error.response?.data || error.message);
    throw error;
  }
}

// Run the test email
if (require.main === module) {
  sendTestEmail()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}

module.exports = {
  sendTestEmail,
  sendBulkCampaign
};