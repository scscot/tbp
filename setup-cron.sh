#!/bin/bash

# Team Build Pro - Email Campaign Cron Setup
echo "🕐 Setting up cron job for email campaigns..."

# Get the full path to the project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create cron job entry
CRON_ENTRY="*/30 * * * * cd $PROJECT_DIR && node run-email-campaign.js batch 1 >> $PROJECT_DIR/logs/email-campaign.log 2>&1"

echo "📋 Cron entry to add:"
echo "$CRON_ENTRY"
echo ""

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Add to crontab
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job added successfully!"
echo "📊 To monitor the campaigns, check: $PROJECT_DIR/logs/email-campaign.log"
echo ""
echo "📋 Useful cron commands:"
echo "  crontab -l        # List current cron jobs"
echo "  crontab -e        # Edit cron jobs"
echo "  crontab -r        # Remove all cron jobs"
echo ""
echo "⏰ Campaign will run every 30 minutes automatically"