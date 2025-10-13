#!/usr/bin/env node

const admin = require("firebase-admin");
const { stringify } = require('csv-stringify/sync');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin SDK
const serviceAccount = require('./secrets/serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// Load SMTP configuration
const smtpConfig = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'secrets', 'smtp_config.json'), 'utf8')
);

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
    }
});

// Configuration
const DEMO_CSV_PATH = path.join(__dirname, 'emails', 'demo_requesters.csv');
const DEMO_URL = 'https://play.google.com/apps/testing/com.scott.ultimatefix';

/**
 * Email template for demo invitations (from sendDemoInvitation.js)
 */
function getEmailTemplate(firstName, demoUrl) {
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b, #334155); padding: 2rem; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://teambuildpro.com/assets/icons/team-build-pro.png" alt="Team Build Pro" style="width: 64px; height: 64px; border-radius: 50%; margin-bottom: 1rem;">
        <h1 style="color: #ffffff; margin: 0; font-size: 1.75rem; font-weight: 700;">Welcome to Team Build Pro!</h1>
        <p style="color: #e2e8f0; margin: 0.5rem 0 0 0; font-size: 1.1rem;">Your preview access is ready!</p>
      </div>

      <!-- Main Content -->
      <div style="padding: 2rem; background-color: #ffffff;">
        <p style="font-size: 1.1rem; color: #1e293b; margin-bottom: 1.5rem;">
          Hi ${firstName},
        </p>

        <p style="color: #334155; line-height: 1.6; margin-bottom: 1.5rem;">
          Thank you for your interest in Team Build Pro! We're excited to give you an early preview of our app.
        </p>

       


        <!-- Lifetime Free Access -->
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 1.5rem; margin: 1.5rem 0;">
          <h4 style="color: #92400e; margin-top: 0; margin-bottom: 0.5rem; font-size: 1.1rem;">Special Preview Benefit:</h4>
          <p style="color: #92400e; margin: 0; line-height: 1.6; font-size: 1rem;">
            <strong>Get Team Build Pro FREE for LIFE!</strong><br /><br />
            As a preview tester, you'll receive lifetime free access (normally $4.99/month) simply by keeping the preview version installed on your device until it's officially available on Google Play. When we launch on Google Play, we'll send you instructions to upgrade—and your free access continues forever!
          </p>
        </div>

        <!-- Call to Action -->
        <div style="text-align: center; margin: 2rem 0;">
          <a href="${demoUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #10b981, #34d399); color: #ffffff; padding: 1rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1.1rem;">
            Get Your Preview Access
          </a>
        </div>

        <p style="color: #64748b; line-height: 1.6;">
          Questions or need help? Just reply to this email - we're here to help make your team building journey successful.
        </p>

        <p style="color: #64748b; margin-bottom: 0;">
          Best regards,<br><br>
          <strong>Support Team</strong><br>
          Team Build Pro<br>
          <a href="mailto:demo@teambuildpro.com" style="color: #10b981;">demo@teambuildpro.com</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; padding: 1.5rem; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; margin: 0; font-size: 0.9rem;">
          © 2025 Team Build Pro. Professional team building software.
        </p>
        <p style="color: #94a3b8; margin: 0.5rem 0 0 0; font-size: 0.8rem;">
          You're part of our exclusive preview program. Get early access before the official launch!
        </p>
      </div>
    </div>
  `;
}

/**
 * Export demo requesters from Firebase to CSV
 */
async function exportDemoRequestersFromFirebase() {
    try {
        console.log('📥 Exporting demo requesters from Firebase...');

        // Get all users who requested demo access but haven't been sent demo emails
        const demoQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .where('emailSent', '==', false)
            .get();

        console.log(`📊 Found ${demoQuery.size} demo requests (wantDemo=true AND emailSent=false)`);

        if (demoQuery.empty) {
            console.log('⚠️  No demo requests found');
            return [];
        }

        const demoRequesters = [];
        const currentTime = new Date().toISOString();

        demoQuery.forEach(doc => {
            const data = doc.data();

            demoRequesters.push({
                id: doc.id,
                first_name: data.firstName || '',
                last_name: data.lastName || '',
                email: data.email || '',
                device_type: data.deviceType || 'android',
                signup_date: data.timestamp ? data.timestamp.toDate().toISOString() : '',
                sent: '',
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
 * Send demo campaign using SendGrid (queries Firestore directly)
 */
async function sendDemoCampaign(options = {}) {
    try {
        const {
            limit = 25,
            testMode = false,
            delayBetweenEmails = 2000
        } = options;

        console.log('📧 Sending demo campaign...');
        console.log(`   Limit: ${limit} emails`);
        console.log(`   Test mode: ${testMode}`);
        console.log(`   Email service: SendGrid`);

        const result = await sendDemoBatch({
            limit,
            testMode,
            delayBetweenEmails
        });

        return result;

    } catch (error) {
        console.error('❌ Error sending demo campaign:', error);
        throw error;
    }
}

/**
 * Custom demo batch sender using SendGrid (queries Firestore directly)
 */
async function sendDemoBatch(options) {
    const { limit, testMode, delayBetweenEmails } = options;

    try {
        // Query Firestore directly for unsent demo requests
        console.log('📊 Querying Firestore for unsent demo requests...');
        const demoQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .where('emailSent', '==', false)
            .get();

        console.log(`📊 Found ${demoQuery.size} unsent demo requests in Firestore`);

        if (demoQuery.empty) {
            console.log('✅ No unsent demo emails found. Campaign complete!');
            return { sent: 0, failed: 0, total: 0 };
        }

        // Convert Firestore docs to contact array
        const allContacts = [];
        demoQuery.forEach(doc => {
            const data = doc.data();
            allContacts.push({
                docId: doc.id,
                first_name: data.firstName || '',
                last_name: data.lastName || '',
                email: data.email || '',
                device_type: data.deviceType || 'android',
                signup_date: data.timestamp ? data.timestamp.toDate().toISOString() : ''
            });
        });

        // Apply limit
        const contactsToSend = limit ? allContacts.slice(0, limit) : allContacts;
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
                    // Send demo email via Dreamhost SMTP
                    const mailOptions = {
                        from: 'Team Build Pro <demo@teambuildpro.com>',
                        to: contact.email,
                        subject: '🎉 Your Team Build Pro Preview is Ready!',
                        html: getEmailTemplate(contact.first_name, DEMO_URL)
                    };

                    const info = await transporter.sendMail(mailOptions);
                    console.log(`✅ Demo sent to ${contact.email} (Message ID: ${info.messageId})`);

                    // Update Firestore: mark as sent
                    await db.collection('launch_notifications').doc(contact.docId).update({
                        emailSent: true,
                        demo_sent_timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        demo_batch_id: batchId
                    });
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

                // Update Firestore: mark as failed
                try {
                    await db.collection('launch_notifications').doc(contact.docId).update({
                        demo_failed: true,
                        demo_error: error.message,
                        demo_last_attempt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (updateError) {
                    console.error(`  ⚠️  Could not update Firestore for failed email: ${updateError.message}`);
                }

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

        // Optional: Log to CSV for audit trail
        try {
            appendToCsvAuditLog(results, batchId);
        } catch (csvError) {
            console.log('  ⚠️  CSV audit log failed (non-critical):', csvError.message);
        }

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
 * Append to CSV audit log (optional tracking)
 */
function appendToCsvAuditLog(results, batchId) {
    try {
        const auditLogPath = path.join(__dirname, 'emails', 'demo_audit_log.csv');
        const timestamp = new Date().toISOString();

        // Create audit log entries
        const logEntries = results.map(result => ({
            timestamp,
            batch_id: batchId,
            email: result.email,
            status: result.status,
            error_message: result.error_message || ''
        }));

        // Check if file exists
        const fileExists = fs.existsSync(auditLogPath);

        // Append to CSV
        const csvOutput = stringify(logEntries, {
            header: !fileExists,
            columns: ['timestamp', 'batch_id', 'email', 'status', 'error_message']
        });

        fs.appendFileSync(auditLogPath, csvOutput);

    } catch (error) {
        throw error;
    }
}

/**
 * Mark demo as sent in Firebase (using emailSent field)
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
                    emailSent: true,
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
    }
}

/**
 * Get demo campaign status from Firestore
 */
async function getDemoStatus() {
    try {
        console.log('📊 Querying Firestore for demo campaign status...');

        // Get all demo requests
        const allDemosQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .get();

        // Get sent demos
        const sentDemosQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .where('emailSent', '==', true)
            .get();

        // Get failed demos
        const failedDemosQuery = await db.collection('launch_notifications')
            .where('wantDemo', '==', true)
            .where('demo_failed', '==', true)
            .get();

        const stats = {
            total: allDemosQuery.size,
            sent: sentDemosQuery.size,
            pending: allDemosQuery.size - sentDemosQuery.size,
            failed: failedDemosQuery.size
        };

        stats.sentPercentage = stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : '0.0';

        console.log('\n📊 Demo Campaign Status (from Firestore):');
        console.log(`   Total demo requests: ${stats.total}`);
        console.log(`   Sent: ${stats.sent} (${stats.sentPercentage}%)`);
        console.log(`   Pending: ${stats.pending}`);
        console.log(`   Failed: ${stats.failed}`);

        // Show batch breakdown from audit log if it exists
        const auditLogPath = path.join(__dirname, 'emails', 'demo_audit_log.csv');
        if (fs.existsSync(auditLogPath)) {
            const csvContent = fs.readFileSync(auditLogPath, 'utf8');
            const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            const batches = {};
            records.forEach(record => {
                if (record.batch_id) {
                    if (!batches[record.batch_id]) {
                        batches[record.batch_id] = { sent: 0, failed: 0, test: 0, total: 0 };
                    }
                    batches[record.batch_id].total++;
                    if (record.status === 'demo_sent') batches[record.batch_id].sent++;
                    if (record.status === 'failed') batches[record.batch_id].failed++;
                    if (record.status === 'test') batches[record.batch_id].test++;
                }
            });

            if (Object.keys(batches).length > 0) {
                console.log('\n📦 Demo Batch Breakdown (from audit log):');
                Object.entries(batches).forEach(([batchId, batchStats]) => {
                    const parts = [];
                    if (batchStats.sent > 0) parts.push(`${batchStats.sent} sent`);
                    if (batchStats.test > 0) parts.push(`${batchStats.test} test`);
                    if (batchStats.failed > 0) parts.push(`${batchStats.failed} failed`);
                    console.log(`   ${batchId}: ${parts.join(', ')} (${batchStats.total} total)`);
                });
            }
        }

        return stats;

    } catch (error) {
        console.error('❌ Error getting demo status:', error);
        throw error;
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
            limit: options.limit || 10,
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
        console.log('🎯 Team Build Pro Demo Campaign Manager (SendGrid)\n');

        // Parse numeric argument if provided
        const numArg = parseInt(process.argv[3]) || parseInt(process.argv[2]);
        const hasTestFlag = process.argv.includes('--test');

        switch (command) {
            case 'send':
                const limit = parseInt(process.argv[3]) || 25;
                console.log(`📧 Sending demo campaign (limit: ${limit})...`);
                await sendDemoCampaign({ limit, testMode: hasTestFlag });
                break;

            case 'test':
                console.log('🧪 Running test mode (3 emails, not actually sent)...');
                await sendDemoCampaign({ limit: 3, testMode: true });
                break;

            case 'status':
                await getDemoStatus();
                break;

            case 'help':
            case '--help':
            case '-h':
                console.log('Available commands:');
                console.log('');
                console.log('📧 DEMO CAMPAIGN COMMANDS:');
                console.log('  (no args)        - Send demo emails with default limit (25)');
                console.log('  [N]              - Send N demo emails');
                console.log('  send [N]         - Send N demo emails (default: 25)');
                console.log('  test             - Test mode: show what would be sent (3 emails)');
                console.log('  status           - Show campaign status from Firestore');
                console.log('  help             - Show this help message');
                console.log('');
                console.log('📋 EXAMPLES:');
                console.log('  node demo-campaign-manager-send.js              # Send 25 emails');
                console.log('  node demo-campaign-manager-send.js 10           # Send 10 emails');
                console.log('  node demo-campaign-manager-send.js send 5       # Send 5 emails');
                console.log('  node demo-campaign-manager-send.js test         # Test mode (no emails)');
                console.log('  node demo-campaign-manager-send.js status       # Check status');
                break;

            default:
                // Default behavior: if numeric argument, send that many emails
                // If no argument or non-numeric, send default 25 emails
                if (!isNaN(numArg) && numArg > 0) {
                    console.log(`📧 Sending demo campaign (limit: ${numArg})...`);
                    await sendDemoCampaign({ limit: numArg, testMode: hasTestFlag });
                } else {
                    console.log(`📧 Sending demo campaign (default limit: 25)...`);
                    await sendDemoCampaign({ limit: 25, testMode: hasTestFlag });
                }
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
