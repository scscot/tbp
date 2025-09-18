🚀 Team Build Pro - Programs Master Documentation

Complete reference guide for all automation scripts and development tools

🔥 Most Used Programs

📧 Email Campaigns
- `./campaign-control.sh start` - Start automated email scheduler
- `node run-email-campaign.js batch 50` - Send batch of 50 emails
- `./send_demo_invites.sh` - Send demo invitations to beta testers

🛠️ Development  
- `./scripts/rebuild_ios_clean.sh` - Clean iOS rebuild
- `node scripts/generateUsers.js 100` - Generate 100 test users
- `flutter build apk --release` - Build Android release

📊 Monitoring
- `node run-email-campaign.js status` - Check email campaign progress
- `./campaign-control.sh logs` - View scheduler logs

---

📁 ROOT DIRECTORY (`/tbp/`)

📧 EMAIL CAMPAIGN SYSTEM

run-email-campaign.js
Purpose: Command-line interface for batch email campaigns  
Usage: `node run-email-campaign.js [command]`  
Commands:
- `batch 50` - Send 50 emails
- `test-batch` - Test without sending  
- `status` - Show campaign progress
- `resume 25` - Continue failed campaigns

demo-campaign-manager.js
Purpose: Automated demo invitation system from Firebase  
Usage: `node demo-campaign-manager.js [command]`  
Commands:
- `full 10` - Complete workflow (export + send 10)
- `export` - Export from Firebase to CSV
- `send 5` - Send 5 demo emails
- `status` - Show demo progress

mailgun_email_campaign.js
Purpose: Core Mailgun API integration library  
Usage: Imported by other email scripts  
Note: Contains batch processing and CSV management functions

email-scheduler.js 
Purpose: Node.js cron scheduler for email campaigns  
Usage: `node email-scheduler.js [--run-now]`  
Requires: `npm install node-cron`

simple-scheduler.js
Purpose: Dependency-free email campaign scheduler  
Usage: `node simple-scheduler.js [--run-now]`  
Note: No external dependencies required

🔥 FIREBASE DATA MANAGEMENT

init_cloud_csvs.js
Purpose: Initialize beta tester CSV files in Firebase Cloud Storage  
Usage: `node init_cloud_csvs.js`

migrate_emailSent.js
Purpose: One-time migration to add emailSent field to launch_notifications  
Usage: `node migrate_emailSent.js`

download_beta_csvs.js
Purpose: Download and process beta tester data from Firebase Storage  
Usage: `node download_beta_csvs.js`

🐍 PYTHON PROGRAMS

extract_gmail_yahoo.py
Purpose: Extract and validate Gmail/Yahoo email addresses from datasets  
Usage: `python3 extract_gmail_yahoo.py`

check_duplicates.py
Purpose: Check for duplicate entries in CSV files  
Usage: `python3 check_duplicates.py`

🔧 SHELL SCRIPTS

send_demo_invites.sh
Purpose: Send Android preview invitations using Firebase Cloud Functions  
Usage: `./send_demo_invites.sh`

campaign-control.sh
Purpose: Control script for managing email campaign schedulers  
Usage: `./campaign-control.sh [command]`  
Commands:
- `start` - Start scheduler
- `stop` - Stop scheduler  
- `status` - Check status
- `logs` - View logs
- `test` - Run test campaign

setup-cron.sh
Purpose: Setup cron job for automated email campaigns  
Usage: `./setup-cron.sh`

run_migration.sh
Purpose: Execute database migrations  
Usage: `./run_migration.sh`

send_recaptcha_assessment.sh
Purpose: Test reCAPTCHA assessment functionality  
Usage: `./send_recaptcha_assessment.sh`

---

📁 SCRIPTS DIRECTORY (`/scripts/`)

👥 FIREBASE USER MANAGEMENT

generateUsers.js
Purpose: Generate large numbers of test users for development/testing  
Usage: `node scripts/generateUsers.js [count]`  
Example: `node scripts/generateUsers.js 100`

generateUserSingle.js
Purpose: Generate a single test user with specific parameters  
Usage: `node scripts/generateUserSingle.js`

updateUser.js
Purpose: Update specific user fields in Firebase  
Usage: `node scripts/updateUser.js [userId] [field] [value]`  
Example: `node scripts/updateUser.js ABC123 email newemail@test.com`

updateTrialStartDates.js
Purpose: Bulk update trial start dates for users  
Usage: `node scripts/updateTrialStartDates.js`

populate_upline_refs.js
Purpose: Populate upline reference relationships in user data  
Usage: `node scripts/populate_upline_refs.js`

set_current_partner_false.js
Purpose: Set currentPartner field to false for all users  
Usage: `node scripts/set_current_partner_false.js`

update_type.js
Purpose: Update user type classifications  
Usage: `node scripts/update_type.js [newType]`

clear_biz_visit_date.js
Purpose: Clear business opportunity visit dates  
Usage: `node scripts/clear_biz_visit_date.js`

📅 DATE & TIME MANAGEMENT

set_qualified_date.js
Purpose: Set qualification dates for users  
Usage: `node scripts/set_qualified_date.js [date]`  
Example: `node scripts/set_qualified_date.js 2024-12-31`

set_qualified_date_only.js
Purpose: Set only the qualification date without other fields  
Usage: `node scripts/set_qualified_date_only.js [date]`  
Example: `node scripts/set_qualified_date_only.js 2024-12-31`

🧪 TESTING & DEBUGGING

test_daily_notifications.js
Purpose: Test daily notification system functionality  
Usage: `node scripts/test_daily_notifications.js`

test_timezone_recalculation.js
Purpose: Test timezone calculation logic  
Usage: `node scripts/test_timezone_recalculation.js`

test_badge_sync.js
Purpose: Test badge synchronization across devices  
Usage: `node scripts/test_badge_sync.js`

test_badge_logic.js
Purpose: Test notification badge counting logic  
Usage: `node scripts/test_badge_logic.js`

test_firebase_functions.js
Purpose: Test Firebase Cloud Functions  
Usage: `node scripts/test_firebase_functions.js`

test_end_to_end.js
Purpose: Comprehensive end-to-end system testing  
Usage: `node scripts/test_end_to_end.js`

test_migration.js
Purpose: Test database migration processes  
Usage: `node scripts/test_migration.js`

test_apple_notifications.js
Purpose: Test Apple Push Notification service  
Usage: `node scripts/test_apple_notifications.js`

test_badge_debug.js
Purpose: Debug badge-related issues  
Usage: `node scripts/test_badge_debug.js`

test_notification_flow.js
Purpose: Test notification delivery flow  
Usage: `node scripts/test_notification_flow.js`

test_network_filtering.js
Purpose: Test network filtering functionality  
Usage: `node scripts/test_network_filtering.js`

test_intelligent_pagination.js
Purpose: Test intelligent pagination system  
Usage: `node scripts/test_intelligent_pagination.js`

test_fcm_token.js
Purpose: Test Firebase Cloud Messaging tokens  
Usage: `node scripts/test_fcm_token.js`

⚙️ SYSTEM MAINTENANCE

fix_badge_issues.js
Purpose: Fix badge-related synchronization issues  
Usage: `node scripts/fix_badge_issues.js`

debug_biz_opp_notification.js
Purpose: Debug business opportunity notifications  
Usage: `node scripts/debug_biz_opp_notification.js`

check_recent_notifications.js
Purpose: Check recent notification activity  
Usage: `node scripts/check_recent_notifications.js`

fix_badge_sync.js
Purpose: Fix badge synchronization problems  
Usage: `node scripts/fix_badge_sync.js`

force_clear_badge.js
Purpose: Force clear all notification badges  
Usage: `node scripts/force_clear_badge.js`

🐍 PYTHON PROGRAMS

firestore_user_updates.py
Purpose: Bulk update Firestore user documents  
Usage: `python3 scripts/firestore_user_updates.py`

lead_processing_script.py
Purpose: AI-powered lead discovery and contact verification  
Usage: `python3 scripts/lead_processing_script.py`

lead_processing_script_old.py
Purpose: Legacy version of lead processing system  
Usage: `python3 scripts/lead_processing_script_old.py`

📱 iOS DEVELOPMENT TOOLS

rebuild_ios_clean.sh
Purpose: Standard iOS clean rebuild process  
Usage: `./scripts/rebuild_ios_clean.sh`

rebuild_ios_clean_Claude.sh
Purpose: Claude AI optimized iOS rebuild  
Usage: `./scripts/rebuild_ios_clean_Claude.sh`

rebuild_ios_clean_ChatGPT.sh
Purpose: ChatGPT optimized iOS rebuild  
Usage: `./scripts/rebuild_ios_clean_ChatGPT.sh`

rebuild_ios_clean_DeepSeek.sh
Purpose: DeepSeek optimized iOS rebuild  
Usage: `./scripts/rebuild_ios_clean_DeepSeek.sh`

rebuild_ios_clean_hybrid.sh
Purpose: Hybrid approach iOS rebuild  
Usage: `./scripts/rebuild_ios_clean_hybrid.sh`

rebuild_ios_deep_clean.sh
Purpose: Deep clean iOS rebuild with cache clearing  
Usage: `./scripts/rebuild_ios_deep_clean.sh`

rebuild_ios_deep_clean_enhanced.sh
Purpose: Enhanced deep clean with additional optimizations  
Usage: `./scripts/rebuild_ios_deep_clean_enhanced.sh`

rebuild_ios_unified.sh
Purpose: Unified iOS rebuild approach  
Usage: `./scripts/rebuild_ios_unified.sh`

🛠️ SYSTEM UTILITIES

check_entitlements.sh
Purpose: Check iOS app entitlements configuration  
Usage: `./scripts/check_entitlements.sh`

xcode_ios_simulator_cleanup.sh
Purpose: Clean up iOS Simulator cache and data  
Usage: `./scripts/xcode_ios_simulator_cleanup.sh`

cleanup_caches.sh
Purpose: System-wide cache cleanup for development  
Usage: `./scripts/cleanup_caches.sh`

audit.sh
Purpose: Comprehensive project audit and health check  
Usage: `./scripts/audit.sh`

✅ TESTING & QUALITY ASSURANCE

test_fixes.sh
Purpose: Test applied fixes and improvements  
Usage: `./scripts/test_fixes.sh`

test_optimizations.sh
Purpose: Test performance optimizations  
Usage: `./scripts/test_optimizations.sh`

take-screenshot.sh
Purpose: Automated screenshot capture for testing  
Usage: `./scripts/take-screenshot.sh [device]`  
Example: `./scripts/take-screenshot.sh iPhone15`

🎯 SPECIALIZED TOOLS

send_recaptcha_assessment.sh
Purpose: Send reCAPTCHA assessment requests  
Usage: `./scripts/send_recaptcha_assessment.sh`

run_lead_ranges.sh
Purpose: Execute lead processing in ranges  
Usage: `./scripts/run_lead_ranges.sh [start] [end]`  
Example: `./scripts/run_lead_ranges.sh 1 100`

---

🚀 Quick Start Guide

🔥 Most Common Commands

Email Campaigns
```bash
./campaign-control.sh start           # Start automated email scheduler
node run-email-campaign.js batch 50   # Send 50 emails  
node run-email-campaign.js status     # Check progress
./send_demo_invites.sh                # Send demo invitations
```

Development
```bash
./scripts/rebuild_ios_clean.sh        # Clean iOS rebuild
node scripts/generateUsers.js 100     # Generate 100 test users
flutter build apk --release           # Build Android
flutter build ios --release           # Build iOS
```

Testing & Debugging
```bash
node scripts/test_daily_notifications.js  # Test notifications
node scripts/test_badge_sync.js           # Test badge sync
node scripts/fix_badge_issues.js          # Fix badge problems
```

Data Processing
```bash
python3 scripts/lead_processing_script.py  # Process leads with AI
python3 extract_gmail_yahoo.py             # Extract email addresses
node scripts/updateUser.js [id] [field]    # Update user data
```

---

🛠️ Setup & Installation

Prerequisites
- 🐘 Node.js (v16+)
- 🐍 Python 3 (v3.8+) 
- 🔥 Firebase Admin SDK (configured)
- 📧 Mailgun API (for email campaigns)
- 📱 Xcode (for iOS builds)

Required Configuration Files
```
secrets/
├── serviceAccountKey.json     # Firebase credentials
└── mailgun_config.json        # Email API config

assets/
└── env.prod                   # Environment variables
```

Installation Commands
```bash
# Install dependencies
npm install
pip3 install -r requirements.txt

# Make scripts executable
chmod +x scripts/*.sh
chmod +x *.sh

# Test installation
node run-email-campaign.js help
```

---

📊 Project Statistics

- 📋 Total Programs: 45+ scripts
- 🟡 JavaScript: 25+ files
- 🔵 Python: 4 files  
- 🟢 Shell Scripts: 16+ files
- 📁 Categories: Email Campaigns, Firebase Management, iOS Development, Testing, Data Processing

Last Updated: September 2025

🚀 This documentation serves as the master reference for all Team Build Pro automation and development tools.