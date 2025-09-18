#!/usr/bin/env node

/**
 * Team Build Pro - Simple Email Campaign Scheduler
 * Runs email campaigns every 30 minutes using setTimeout
 * No external dependencies required
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CAMPAIGN_COMMAND = 'node run-email-campaign.js batch 50';
const INTERVAL_MINUTES = 30;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000; // 30 minutes in milliseconds
const LOG_FILE = path.join(__dirname, 'logs', 'simple-scheduler.log');

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
        
        log('📧 Campaign completed successfully');
        
        // Log key stats from output
        const lines = output.split('\n');
        const statsLines = lines.filter(line => 
            line.includes('Total processed:') || 
            line.includes('Successfully sent:') || 
            line.includes('Failed:') ||
            line.includes('Success rate:')
        );
        
        if (statsLines.length > 0) {
            log('📊 Campaign Stats:');
            statsLines.forEach(stat => log(`   ${stat.trim()}`));
        }
        
    } catch (error) {
        log(`❌ Campaign failed: ${error.message}`);
    }
}

// Schedule function
function scheduleNext() {
    const nextRun = new Date(Date.now() + INTERVAL_MS);
    log(`⏰ Next campaign scheduled for: ${nextRun.toLocaleString()}`);
    
    setTimeout(() => {
        runEmailCampaign().then(() => {
            scheduleNext(); // Schedule the next run
        });
    }, INTERVAL_MS);
}

// Start the scheduler
log('🕐 Simple Email Campaign Scheduler Starting...');
log(`📅 Interval: Every ${INTERVAL_MINUTES} minutes`);
log(`📧 Command: ${CAMPAIGN_COMMAND}`);
log(`📝 Log file: ${LOG_FILE}`);

// Run immediately for testing (optional)
if (process.argv.includes('--run-now')) {
    log('🧪 Running campaign immediately...');
    runEmailCampaign().then(() => {
        scheduleNext();
    });
} else {
    scheduleNext();
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