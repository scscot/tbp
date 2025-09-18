#!/usr/bin/env node

/**
 * Team Build Pro - Email Campaign Scheduler
 * Runs email campaigns every 30 minutes using node-cron
 * 
 * Install: npm install node-cron
 * Run: node email-scheduler.js
 */

const cron = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CAMPAIGN_COMMAND = 'node run-email-campaign.js batch 50';
const CRON_SCHEDULE = '*/30 * * * *'; // Every 30 minutes
const LOG_FILE = path.join(__dirname, 'logs', 'email-scheduler.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(message);
    fs.appendFileSync(LOG_FILE, logMessage);
}

// Campaign execution function
async function runEmailCampaign() {
    try {
        log('🚀 Starting scheduled email campaign...');
        
        // Execute the campaign command
        const output = execSync(CAMPAIGN_COMMAND, {
            cwd: __dirname,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        log('📧 Campaign output:');
        log(output);
        log('✅ Campaign completed successfully');
        
    } catch (error) {
        log(`❌ Campaign failed: ${error.message}`);
        if (error.stdout) log(`STDOUT: ${error.stdout}`);
        if (error.stderr) log(`STDERR: ${error.stderr}`);
    }
}

// Schedule the campaign
log('🕐 Email Campaign Scheduler Starting...');
log(`📅 Schedule: Every 30 minutes (${CRON_SCHEDULE})`);
log(`📧 Command: ${CAMPAIGN_COMMAND}`);
log(`📝 Log file: ${LOG_FILE}`);

cron.schedule(CRON_SCHEDULE, () => {
    runEmailCampaign();
});

// Run once immediately for testing (optional)
if (process.argv.includes('--run-now')) {
    log('🧪 Running campaign immediately for testing...');
    runEmailCampaign();
}

log('⏰ Scheduler is running. Press Ctrl+C to stop.');

// Graceful shutdown
process.on('SIGINT', () => {
    log('🛑 Scheduler stopping...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('🛑 Scheduler terminated');
    process.exit(0);
});