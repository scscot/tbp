const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Load Mailgun configuration from secrets
const mailgunConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'secrets', 'mailgun_config.json'), 'utf8')
);

const MAILGUN_API_KEY = mailgunConfig.api_key;
const MAILGUN_DOMAIN = mailgunConfig.domain;
const MAILGUN_BASE_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;
const MAILING_LIST_ADDRESS = `teambuildpro@${MAILGUN_DOMAIN}`;
const CSV_FILE_PATH = path.join(__dirname, 'emails', 'master_email_list.csv');

// Template versions for A/B testing
const TEMPLATE_VERSIONS = ['initial', 'initial1'];

// Counter for alternating template selection
let templateCounter = 0;

// Function to alternate between template versions for 50/50 split
function getAlternatingTemplateVersion(verbose = false) {
  const selectedVersion = TEMPLATE_VERSIONS[templateCounter % TEMPLATE_VERSIONS.length];
  templateCounter++;

  if (verbose) {
    console.log(`🔄 Alternating template selection: ${selectedVersion} (count: ${templateCounter}, alternating between initial/initial1)`);
  }
  return selectedVersion;
}

// Function to send a test email using your Mailgun template
async function sendTestEmail() {
  try {
    const form = new FormData();
    
    // Email configuration
    form.append('from', 'Stephen Scott <sscott@teambuildpro.com>');
    form.append('to', 'Stephen Scott <scscot@gmail.com>');
    // form.append('to', 'Jeanne Paquet <jpaquet2@ca.rr.com>');
    form.append('subject', 'Recruit faster with an app for direct sales');
    const templateVersion = getAlternatingTemplateVersion(false);
    form.append('template', 'team build pro'); // Template name
    form.append('t:version', templateVersion); // Alternating template version
    form.append('o:tag', templateVersion); // Tag for A/B test tracking

    // Template variables based on your CSV format (firstname lastname,email)
    form.append('h:X-Mailgun-Variables', JSON.stringify({
       first_name: 'Stephen',
       last_name: 'Scott',
       email: 'scscot@gmail.com'
      // first_name: 'Jeanne',
      // last_name: 'Paquet',
      // email: 'jpaquet2@ca.rr.com'
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
    
    form.append('from', 'Stephen Scott <sscott@teambuildpro.com>');
    form.append('subject', 'Recruit faster with an app for direct sales');
    const templateVersion = getAlternatingTemplateVersion(false);
    form.append('template', 'team build pro'); // Template name
    form.append('t:version', templateVersion); // Alternating template version
    form.append('o:tag', templateVersion); // Tag for A/B test tracking

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

// ============================================================================
// MAILING LIST MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Read and parse the CSV file
 */
function readCSV() {
  try {
    const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    console.log(`📊 Loaded ${records.length} contacts from CSV`);
    return records;
  } catch (error) {
    console.error('❌ Error reading CSV file:', error.message);
    throw error;
  }
}

/**
 * Create or update a mailing list
 */
async function createMailingList() {
  try {
    const form = new FormData();
    form.append('address', MAILING_LIST_ADDRESS);
    form.append('name', 'Team Build Pro Email List');
    form.append('description', 'Master email list for Team Build Pro campaigns');
    form.append('access_level', 'readonly'); // Only you can add members

    const response = await axios.post(`https://api.mailgun.net/v3/lists`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    console.log('✅ Mailing list created successfully!');
    console.log('List address:', response.data.list.address);
    return response.data;
    
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('📝 Mailing list already exists, continuing...');
      return { list: { address: MAILING_LIST_ADDRESS } };
    }
    console.error('❌ Error creating mailing list:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Upload CSV contacts to mailing list
 */
async function uploadContactsToList() {
  try {
    console.log('📤 Starting contact upload process...');
    
    // Read CSV data
    const contacts = readCSV();
    
    // Validate email addresses
    const validContacts = contacts.filter(contact => {
      const isValid = contact.email && contact.email.includes('@') && contact.email.includes('.');
      if (!isValid) {
        console.log(`⚠️  Skipping invalid email: ${contact.email}`);
      }
      return isValid;
    });

    console.log(`✅ ${validContacts.length} valid contacts out of ${contacts.length} total`);

    // Create mailing list if it doesn't exist
    await createMailingList();

    // Prepare members data in the format Mailgun expects
    const members = validContacts.map(contact => ({
      address: contact.email,
      name: `${contact.first_name} ${contact.last_name}`.trim(),
      vars: {
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email
      }
    }));

    // Upload in batches (Mailgun recommends max 1000 per request)
    const batchSize = 1000;
    const batches = [];
    
    for (let i = 0; i < members.length; i += batchSize) {
      batches.push(members.slice(i, i + batchSize));
    }

    console.log(`📦 Uploading ${batches.length} batch(es) of contacts...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`⬆️  Uploading batch ${i + 1}/${batches.length} (${batch.length} contacts)...`);

      const form = new FormData();
      form.append('members', JSON.stringify(batch));

      const response = await axios.post(
        `https://api.mailgun.net/v3/lists/${MAILING_LIST_ADDRESS}/members.json`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
          }
        }
      );

      console.log(`✅ Batch ${i + 1} uploaded: ${response.data.message}`);
      
      // Small delay between batches to be nice to the API
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('🎉 All contacts uploaded successfully!');
    return { totalUploaded: validContacts.length, batches: batches.length };
    
  } catch (error) {
    console.error('❌ Error uploading contacts:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Send campaign to the mailing list
 */
async function sendCampaignToList() {
  try {
    console.log('📧 Sending campaign to mailing list...');

    const form = new FormData();
    form.append('from', 'Stephen Scott | Team Build Pro <sscott@teambuildpro.com>');
    form.append('to', MAILING_LIST_ADDRESS);
    form.append('subject', 'Recruit faster with an app for direct sales');
    const templateVersion = getAlternatingTemplateVersion(false);
    form.append('template', 'team build pro'); // Template name
    form.append('t:version', templateVersion); // Alternating template version
    form.append('o:tag', templateVersion); // Tag for A/B test tracking

    // Recipient variables will be automatically substituted by Mailgun
    // based on the vars we uploaded with each contact

    const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
      }
    });

    console.log('✅ Campaign sent successfully!');
    console.log('Message ID:', response.data.id);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending campaign:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get mailing list statistics
 */
async function getListStats() {
  try {
    const response = await axios.get(
      `https://api.mailgun.net/v3/lists/${MAILING_LIST_ADDRESS}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
        }
      }
    );

    const stats = response.data.list;
    console.log('📊 Mailing List Stats:');
    console.log(`   Address: ${stats.address}`);
    console.log(`   Name: ${stats.name}`);
    console.log(`   Members: ${stats.members_count}`);
    console.log(`   Created: ${new Date(stats.created_at).toLocaleString()}`);
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting list stats:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Complete workflow: Upload CSV and send campaign
 */
async function runFullCampaign() {
  try {
    console.log('🚀 Starting full email campaign workflow...\n');
    
    // Step 1: Upload contacts
    console.log('STEP 1: Uploading contacts to mailing list...');
    await uploadContactsToList();
    console.log('✅ Contact upload completed!\n');
    
    // Step 2: Wait a moment for processing
    console.log('⏳ Waiting 5 seconds for Mailgun to process the list...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Get stats
    console.log('STEP 2: Getting mailing list statistics...');
    await getListStats();
    console.log('✅ Statistics retrieved!\n');
    
    // Step 4: Send campaign
    console.log('STEP 3: Sending campaign to all contacts...');
    await sendCampaignToList();
    console.log('✅ Campaign sent to all contacts!\n');
    
    console.log('🎉 Full campaign workflow completed successfully!');
    
  } catch (error) {
    console.error('💥 Campaign workflow failed:', error.message);
    throw error;
  }
}

// ============================================================================
// BATCH CAMPAIGN FUNCTIONS WITH CSV TRACKING
// ============================================================================

/**
 * Read CSV and filter for unsent emails
 */
function readUnsentContacts(limit = null) {
  const contacts = readCSV();
  
  // Filter for unsent emails (sent column empty/null/0)
  const unsent = contacts.filter(contact => {
    return !contact.sent || contact.sent === '' || contact.sent === '0';
  });
  
  console.log(`📊 Found ${unsent.length} unsent contacts out of ${contacts.length} total`);
  
  // Apply limit if specified
  return limit ? unsent.slice(0, limit) : unsent;
}

/**
 * Update CSV with sent status
 */
function updateCsvWithSentStatus(emailUpdates) {
  const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const records = csv.parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  // Update records with sent status
  const updatedRecords = records.map(record => {
    const update = emailUpdates.find(u => u.email === record.email);
    if (update) {
      return {
        ...record,
        sent: update.sent ? '1' : '0',
        sent_timestamp: update.sent ? new Date().toISOString() : (record.sent_timestamp || ''),
        batch_id: update.batch_id || (record.batch_id || ''),
        status: update.status || (record.status || ''),
        error_message: update.error_message || (record.error_message || '')
      };
    }
    return record;
  });
  
  // Ensure all records have the new columns
  const normalizedRecords = updatedRecords.map(record => ({
    first_name: record.first_name || '',
    last_name: record.last_name || '',
    email: record.email || '',
    sent: record.sent || '',
    sent_timestamp: record.sent_timestamp || '',
    batch_id: record.batch_id || '',
    status: record.status || '',
    error_message: record.error_message || ''
  }));
  
  // Write back to CSV
  const csvOutput = stringify(normalizedRecords, { 
    header: true,
    columns: ['first_name', 'last_name', 'email', 'sent', 'sent_timestamp', 'batch_id', 'status', 'error_message']
  });
  
  fs.writeFileSync(CSV_FILE_PATH, csvOutput);
  console.log(`✅ Updated ${emailUpdates.length} records in CSV`);
}

/**
 * Send campaign in batches with CSV tracking
 */
async function sendBatchCampaign(options = {}) {
  const {
    limit = 100,
    batchId = `batch_${Date.now()}`,
    delayBetweenEmails = 1000, // 1 second between emails
    testMode = false,
    verbose = false, // Disable detailed logging for large campaigns
    progressInterval = 100 // Show progress every N emails
  } = options;
  
  try {
    console.log(`🚀 Starting batch campaign: ${batchId}`);
    console.log(`   Limit: ${limit} emails`);
    console.log(`   Test mode: ${testMode}`);
    
    // Get unsent contacts
    const contacts = readUnsentContacts(limit);
    
    if (contacts.length === 0) {
      console.log('✅ No unsent emails found. Campaign complete!');
      return { sent: 0, failed: 0, total: 0 };
    }
    
    console.log(`📧 Sending ${contacts.length} emails in batch: ${batchId}`);
    
    const results = [];
    let sent = 0;
    let failed = 0;
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Show progress every N emails or if verbose mode
      if (verbose || (i + 1) % progressInterval === 0 || i === 0 || i === contacts.length - 1) {
        console.log(`📤 Sending ${i + 1}/${contacts.length}: ${contact.email}`);
      }
      
      try {
        if (!testMode) {
          // Send individual email
          const form = new FormData();
          form.append('from', 'Stephen Scott | Team Build Pro <sscott@teambuildpro.com>');
          form.append('to', `${contact.first_name} ${contact.last_name} <${contact.email}>`);
          form.append('subject', 'Recruit faster with an app for direct sales');
          const templateVersion = getAlternatingTemplateVersion(verbose);
          form.append('template', 'team build pro'); // Template name
          form.append('t:version', templateVersion); // Alternating template version
          form.append('o:tag', templateVersion); // Tag for A/B test tracking
          form.append('h:X-Mailgun-Variables', JSON.stringify({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email
          }));
          
          const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
            headers: {
              ...form.getHeaders(),
              'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
            }
          });
          
          if (verbose) {
            console.log(`✅ Sent to ${contact.email}: ${response.data.id}`);
          }
        } else {
          if (verbose) {
            console.log(`🧪 TEST MODE: Would send to ${contact.email}`);
          }
        }
        
        results.push({
          email: contact.email,
          sent: !testMode, // Only mark as sent if not in test mode
          batch_id: batchId,
          status: testMode ? 'test' : 'sent',
          error_message: ''
        });
        sent++;
        
      } catch (error) {
        // Always log errors, even in non-verbose mode
        console.error(`❌ Failed to send to ${contact.email}: ${error.message}`);
        
        results.push({
          email: contact.email,
          sent: false,
          batch_id: batchId,
          status: 'failed',
          error_message: error.message
        });
        failed++;
      }
      
      // Delay between emails
      if (i < contacts.length - 1 && delayBetweenEmails > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
      }
    }
    
    // Update CSV with results (even in test mode for tracking)
    updateCsvWithSentStatus(results);
    
    console.log(`\n📊 Batch ${batchId} Complete:`);
    console.log(`   Total processed: ${contacts.length}`);
    console.log(`   Successfully sent: ${sent}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success rate: ${((sent / contacts.length) * 100).toFixed(1)}%`);
    
    return { sent, failed, total: contacts.length, batchId };
    
  } catch (error) {
    console.error('💥 Batch campaign failed:', error.message);
    throw error;
  }
}

/**
 * Get campaign status and statistics
 */
function getCampaignStatus() {
  const contacts = readCSV();
  
  const stats = {
    total: contacts.length,
    sent: contacts.filter(c => c.sent === '1').length,
    pending: contacts.filter(c => !c.sent || c.sent === '' || c.sent === '0').length,
    failed: contacts.filter(c => c.status === 'failed').length,
    test: contacts.filter(c => c.status === 'test').length
  };
  
  stats.sentPercentage = ((stats.sent / stats.total) * 100).toFixed(1);
  
  console.log('📊 Campaign Status:');
  console.log(`   Total contacts: ${stats.total}`);
  console.log(`   Sent: ${stats.sent} (${stats.sentPercentage}%)`);
  console.log(`   Pending: ${stats.pending}`);
  console.log(`   Failed: ${stats.failed}`);
  if (stats.test > 0) {
    console.log(`   Test processed: ${stats.test}`);
  }
  
  // Show batch breakdown
  const batches = {};
  contacts.forEach(contact => {
    if (contact.batch_id) {
      if (!batches[contact.batch_id]) {
        batches[contact.batch_id] = { sent: 0, failed: 0, test: 0, total: 0 };
      }
      batches[contact.batch_id].total++;
      if (contact.sent === '1') batches[contact.batch_id].sent++;
      if (contact.status === 'failed') batches[contact.batch_id].failed++;
      if (contact.status === 'test') batches[contact.batch_id].test++;
    }
  });
  
  if (Object.keys(batches).length > 0) {
    console.log('\n📦 Batch Breakdown:');
    Object.entries(batches).forEach(([batchId, batchStats]) => {
      const parts = [];
      if (batchStats.sent > 0) parts.push(`${batchStats.sent} sent`);
      if (batchStats.test > 0) parts.push(`${batchStats.test} test`);
      if (batchStats.failed > 0) parts.push(`${batchStats.failed} failed`);
      console.log(`   ${batchId}: ${parts.join(', ')} (${batchStats.total} total)`);
    });
  }
  
  return stats;
}

module.exports = {
  sendTestEmail,
  sendBulkCampaign,
  readCSV,
  readUnsentContacts,
  sendBatchCampaign,
  getCampaignStatus,
  createMailingList,
  uploadContactsToList,
  sendCampaignToList,
  getListStats,
  runFullCampaign
};