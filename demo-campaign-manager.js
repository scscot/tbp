#!/usr/bin/env node

const admin = require("firebase-admin");
const { stringify } = require('csv-stringify/sync');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const { sendBatchCampaign } = require('./mailgun_email_campaign');

// Initialize Firebase Admin SDK
const serviceAccount = require('./secrets/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Configuration
const DEMO_CSV_PATH = path.join(__dirname, 'emails', 'demo_requesters.csv');
const DEMO_TEMPLATE = 'team-build-pro-demo'; // Mailgun template for demo instructions

/**
 * Export demo requesters from Firebase to CSV
 */
async function exportDemoRequestersFromFirebase() {
    try {
        console.log('📥 Exporting demo requesters from Firebase...');
        
        // Get all users who requested demo access but haven't been sent demo emails
        const demoQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .get();
            
        console.log(`📊 Found ${demoQuery.size} total demo requests`);
        
        if (demoQuery.empty) {
            console.log('⚠️  No demo requests found');
            return [];
        }

        const demoRequesters = [];
        const currentTime = new Date().toISOString();
        
        demoQuery.forEach(doc => {
            const data = doc.data();
            
            // Skip if already sent demo (check for demo_sent field)
            if (data.demo_sent || data.demoSent) {
                console.log(`⏭️  Skipping ${data.email} - demo already sent`);
                return;
            }
            
            demoRequesters.push({
                id: doc.id,
                first_name: data.firstName || '',
                last_name: data.lastName || '',
                email: data.email || '',
                device_type: data.deviceType || 'android',
                signup_date: data.timestamp ? data.timestamp.toDate().toISOString() : '',
                sent: '', // Empty for batch email system
                sent_timestamp: '',
                batch_id: '',
                status: '',
                error_message: ''
            });
        });
        
        console.log(`✅ ${demoRequesters.length} demo requesters ready for processing`);
        return demoRequesters;
        
    } catch (error) {
        console.error('❌ Error exporting demo requesters:', error);
        throw error;
    }
}

/**
 * Create CSV file for demo requesters
 */
function createDemoCSV(demoRequesters) {
    try {
        console.log('📄 Creating demo requesters CSV...');
        
        if (demoRequesters.length === 0) {
            console.log('⚠️  No demo requesters to export');
            return false;
        }
        
        // Ensure emails directory exists
        const emailsDir = path.dirname(DEMO_CSV_PATH);
        if (!fs.existsSync(emailsDir)) {
            fs.mkdirSync(emailsDir, { recursive: true });
        }
        
        // Create CSV content
        const csvContent = stringify(demoRequesters, {
            header: true,
            columns: [
                'first_name', 'last_name', 'email', 'device_type', 'signup_date',
                'sent', 'sent_timestamp', 'batch_id', 'status', 'error_message'
            ]
        });
        
        fs.writeFileSync(DEMO_CSV_PATH, csvContent);
        console.log(`✅ Demo CSV created: ${DEMO_CSV_PATH}`);
        console.log(`   Contains ${demoRequesters.length} demo requesters`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error creating demo CSV:', error);
        throw error;
    }
}

/**
 * Send demo campaign using batch email system
 */
async function sendDemoCampaign(options = {}) {
    try {
        const {
            limit = 25,
            testMode = false,
            delayBetweenEmails = 2000 // 2 seconds between demo emails
        } = options;
        
        console.log('📧 Sending demo campaign...');
        console.log(`   Limit: ${limit} emails`);
        console.log(`   Test mode: ${testMode}`);
        console.log(`   Template: ${DEMO_TEMPLATE}`);
        
        // Temporarily modify the batch campaign to use demo template
        const originalTemplate = 'team build pro';
        
        // Custom demo batch function
        const result = await sendDemoBatch({
            csvPath: DEMO_CSV_PATH,
            limit,
            testMode,
            delayBetweenEmails,
            template: DEMO_TEMPLATE
        });
        
        return result;
        
    } catch (error) {
        console.error('❌ Error sending demo campaign:', error);
        throw error;
    }
}

/**
 * Custom demo batch sender (adapted from batch campaign)
 */
async function sendDemoBatch(options) {
    const { csvPath, limit, testMode, delayBetweenEmails, template } = options;
    const axios = require('axios');
    const FormData = require('form-data');
    const csv = require('csv-parse/sync');
    
    // Load Mailgun config
    const mailgunConfig = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'secrets', 'mailgun_config.json'), 'utf8')
    );
    const MAILGUN_API_KEY = mailgunConfig.api_key;
    const MAILGUN_DOMAIN = mailgunConfig.domain;
    const MAILGUN_BASE_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}`;
    
    try {
        // Read demo CSV
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const records = csv.parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        
        // Filter for unsent emails
        const unsent = records.filter(record => {
            return !record.sent || record.sent === '' || record.sent === '0';
        });
        
        console.log(`📊 Found ${unsent.length} unsent demo emails out of ${records.length} total`);
        
        if (unsent.length === 0) {
            console.log('✅ No unsent demo emails found. Campaign complete!');
            return { sent: 0, failed: 0, total: 0 };
        }
        
        // Apply limit
        const contactsToSend = limit ? unsent.slice(0, limit) : unsent;
        const batchId = `demo_batch_${Date.now()}`;
        
        console.log(`📧 Sending ${contactsToSend.length} demo emails in batch: ${batchId}`);
        
        const results = [];
        let sent = 0;
        let failed = 0;
        
        for (let i = 0; i < contactsToSend.length; i++) {
            const contact = contactsToSend[i];
            console.log(`📤 Sending demo ${i + 1}/${contactsToSend.length}: ${contact.email} (${contact.device_type})`);
            
            try {
                if (!testMode) {
                    // Send demo email
                    const form = new FormData();
                    form.append('from', 'Team Build Pro <sscott@stephenscott.us>');
                    form.append('to', `${contact.first_name} ${contact.last_name} <${contact.email}>`);
                    form.append('subject', '🎉 Your Team Build Pro Demo Access is Ready!');
                    form.append('template', template);
                    form.append('h:X-Mailgun-Variables', JSON.stringify({
                        first_name: contact.first_name,
                        last_name: contact.last_name,
                        email: contact.email,
                        device_type: contact.device_type,
                        signup_date: contact.signup_date
                    }));
                    
                    const response = await axios.post(`${MAILGUN_BASE_URL}/messages`, form, {
                        headers: {
                            ...form.getHeaders(),
                            'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
                        }
                    });
                    
                    console.log(`✅ Demo sent to ${contact.email}: ${response.data.id}`);
                } else {
                    console.log(`🧪 TEST MODE: Would send demo to ${contact.email} (${contact.device_type})`);
                }
                
                results.push({
                    email: contact.email,
                    sent: !testMode,
                    batch_id: batchId,
                    status: testMode ? 'test' : 'demo_sent',
                    error_message: ''
                });
                sent++;
                
            } catch (error) {
                console.error(`❌ Failed to send demo to ${contact.email}: ${error.message}`);
                
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
            if (i < contactsToSend.length - 1 && delayBetweenEmails > 0) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenEmails));
            }
        }
        
        // Update CSV with results
        updateDemoCSV(results, records);
        
        console.log(`\n📊 Demo Batch ${batchId} Complete:`);
        console.log(`   Total processed: ${contactsToSend.length}`);
        console.log(`   Successfully sent: ${sent}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Success rate: ${((sent / contactsToSend.length) * 100).toFixed(1)}%`);
        
        return { sent, failed, total: contactsToSend.length, batchId };
        
    } catch (error) {
        console.error('💥 Demo batch failed:', error.message);
        throw error;
    }
}

/**
 * Update demo CSV with sent status
 */
function updateDemoCSV(emailUpdates, allRecords) {
    try {
        // Update records with sent status
        const updatedRecords = allRecords.map(record => {
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
        
        // Write back to CSV
        const csvOutput = stringify(updatedRecords, {
            header: true,
            columns: [
                'first_name', 'last_name', 'email', 'device_type', 'signup_date',
                'sent', 'sent_timestamp', 'batch_id', 'status', 'error_message'
            ]
        });
        
        fs.writeFileSync(DEMO_CSV_PATH, csvOutput);
        console.log(`✅ Updated ${emailUpdates.length} demo records in CSV`);
        
    } catch (error) {
        console.error('❌ Error updating demo CSV:', error);
        throw error;
    }
}

/**
 * Mark demo as sent in Firebase (to avoid re-sending)
 */
async function markDemoSentInFirebase(emailList) {
    try {
        console.log('📝 Marking demo as sent in Firebase...');
        
        const batch = db.batch();
        let updateCount = 0;
        
        for (const email of emailList) {
            const query = await db.collection('launch_notifications')
                .where('email', '==', email)
                .limit(1)
                .get();
                
            if (!query.empty) {
                const doc = query.docs[0];
                batch.update(doc.ref, {
                    demo_sent: true,
                    demo_sent_timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
                updateCount++;
            }
        }
        
        if (updateCount > 0) {
            await batch.commit();
            console.log(`✅ Marked ${updateCount} demo records as sent in Firebase`);
        } else {
            console.log('⚠️  No Firebase records to update');
        }
        
    } catch (error) {
        console.error('❌ Error updating Firebase records:', error);
        // Don't throw - this is not critical
    }
}

/**
 * Get demo campaign status
 */
function getDemoStatus() {
    try {
        if (!fs.existsSync(DEMO_CSV_PATH)) {
            console.log('❌ Demo CSV not found. Run export first.');
            return;
        }
        
        const csvContent = fs.readFileSync(DEMO_CSV_PATH, 'utf8');
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        
        const stats = {
            total: records.length,
            sent: records.filter(r => r.sent === '1').length,
            pending: records.filter(r => !r.sent || r.sent === '' || r.sent === '0').length,
            failed: records.filter(r => r.status === 'failed').length,
            test: records.filter(r => r.status === 'test').length
        };
        
        stats.sentPercentage = ((stats.sent / stats.total) * 100).toFixed(1);
        
        console.log('📊 Demo Campaign Status:');
        console.log(`   Total demo requests: ${stats.total}`);
        console.log(`   Sent: ${stats.sent} (${stats.sentPercentage}%)`);
        console.log(`   Pending: ${stats.pending}`);
        console.log(`   Failed: ${stats.failed}`);
        if (stats.test > 0) {
            console.log(`   Test processed: ${stats.test}`);
        }
        
        // Show batch breakdown
        const batches = {};
        records.forEach(record => {
            if (record.batch_id) {
                if (!batches[record.batch_id]) {
                    batches[record.batch_id] = { sent: 0, failed: 0, test: 0, total: 0 };
                }
                batches[record.batch_id].total++;
                if (record.sent === '1') batches[record.batch_id].sent++;
                if (record.status === 'failed') batches[record.batch_id].failed++;
                if (record.status === 'test') batches[record.batch_id].test++;
            }
        });
        
        if (Object.keys(batches).length > 0) {
            console.log('\n📦 Demo Batch Breakdown:');
            Object.entries(batches).forEach(([batchId, batchStats]) => {
                const parts = [];
                if (batchStats.sent > 0) parts.push(`${batchStats.sent} sent`);
                if (batchStats.test > 0) parts.push(`${batchStats.test} test`);
                if (batchStats.failed > 0) parts.push(`${batchStats.failed} failed`);
                console.log(`   ${batchId}: ${parts.join(', ')} (${batchStats.total} total)`);
            });
        }
        
        return stats;
        
    } catch (error) {
        console.error('❌ Error getting demo status:', error);
    }
}

/**
 * Complete workflow: Export from Firebase and send demo campaign
 */
async function runFullDemoWorkflow(options = {}) {
    try {
        console.log('🚀 Starting full demo campaign workflow...\n');
        
        // Step 1: Export demo requesters from Firebase
        console.log('STEP 1: Exporting demo requesters from Firebase...');
        const demoRequesters = await exportDemoRequestersFromFirebase();
        
        if (demoRequesters.length === 0) {
            console.log('✅ No new demo requests to process');
            return { exported: 0, sent: 0, failed: 0 };
        }
        
        // Step 2: Create CSV
        console.log('\nSTEP 2: Creating demo CSV...');
        const csvCreated = createDemoCSV(demoRequesters);
        
        if (!csvCreated) {
            console.log('❌ Failed to create CSV');
            return { exported: demoRequesters.length, sent: 0, failed: 0 };
        }
        
        // Step 3: Send demo campaign
        console.log('\nSTEP 3: Sending demo campaign...');
        const result = await sendDemoCampaign({
            limit: options.limit || 10, // Start with smaller batches for demos
            testMode: options.testMode || false
        });
        
        // Step 4: Mark as sent in Firebase (only for successfully sent emails)
        if (result.sent > 0 && !options.testMode) {
            console.log('\nSTEP 4: Updating Firebase records...');
            const sentEmails = demoRequesters
                .slice(0, result.sent)
                .map(contact => contact.email);
            await markDemoSentInFirebase(sentEmails);
        }
        
        console.log('\n🎉 Full demo workflow completed successfully!');
        console.log(`   Exported: ${demoRequesters.length} demo requests`);
        console.log(`   Sent: ${result.sent} demo emails`);
        console.log(`   Failed: ${result.failed} emails`);
        
        return {
            exported: demoRequesters.length,
            sent: result.sent,
            failed: result.failed,
            total: result.total
        };
        
    } catch (error) {
        console.error('💥 Demo workflow failed:', error.message);
        throw error;
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    
    try {
        console.log('🎯 Team Build Pro Demo Campaign Manager\n');
        
        switch (command) {
            case 'export':
                console.log('📥 Exporting demo requesters from Firebase...');
                const requesters = await exportDemoRequestersFromFirebase();
                createDemoCSV(requesters);
                break;
                
            case 'send':
                const limit = parseInt(process.argv[3]) || 10;
                const testMode = process.argv.includes('--test');
                console.log(`📧 Sending demo campaign (limit: ${limit})...`);
                await sendDemoCampaign({ limit, testMode });
                break;
                
            case 'status':
                console.log('📊 Getting demo campaign status...');
                getDemoStatus();
                break;
                
            case 'full':
                const fullLimit = parseInt(process.argv[3]) || 10;
                const fullTestMode = process.argv.includes('--test');
                console.log('🎯 Running complete demo workflow...');
                await runFullDemoWorkflow({ limit: fullLimit, testMode: fullTestMode });
                break;
                
            case 'test':
                console.log('🧪 Running demo test workflow...');
                await runFullDemoWorkflow({ limit: 3, testMode: true });
                break;
                
            case 'help':
            default:
                console.log('Available commands:');
                console.log('');
                console.log('📧 DEMO CAMPAIGN COMMANDS:');
                console.log('  export           - Export demo requesters from Firebase to CSV');
                console.log('  send [N]         - Send demo emails (default: 10)');
                console.log('  send [N] --test  - Test demo sending without actually sending');
                console.log('  status           - Show demo campaign progress');
                console.log('  full [N]         - Complete workflow: export + send (default: 10)');
                console.log('  test             - Test full workflow with 3 emails');
                console.log('  help             - Show this help message');
                console.log('');
                console.log('📋 EXAMPLES:');
                console.log('  node demo-campaign-manager.js export');
                console.log('  node demo-campaign-manager.js send 5');
                console.log('  node demo-campaign-manager.js status');
                console.log('  node demo-campaign-manager.js full 15');
                console.log('  node demo-campaign-manager.js test');
                break;
        }
        
    } catch (error) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    exportDemoRequestersFromFirebase,
    createDemoCSV,
    sendDemoCampaign,
    getDemoStatus,
    runFullDemoWorkflow
};