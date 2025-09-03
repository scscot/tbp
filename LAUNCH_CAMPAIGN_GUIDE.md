# Team Build Pro Launch Campaign Guide

## 🚀 Overview

This guide explains how to use the custom Firebase function to send your Team Build Pro launch campaign emails through your existing SendGrid integration.

## ✨ Features

### ✅ **Full SendGrid Integration**
- Uses your existing SendGrid API key and configuration
- All emails appear in your SendGrid dashboard with complete analytics
- Built-in unsubscribe handling through SendGrid
- Professional email reputation management

### ✅ **Smart Personalization**
- Personalized greetings using subscriber's first name
- Device-specific download buttons (iOS/Android/Both)
- Professional template matching your website design
- Consistent branding and messaging

### ✅ **Advanced Campaign Management**
- Batch processing to respect SendGrid rate limits
- Device filtering (iOS only, Android only, Both, or All)
- Dry run mode for testing and analytics
- Test email functionality
- Comprehensive error handling and logging

## 📊 SendGrid Dashboard Analytics

After sending your campaign, you'll have access to:

- **Email Statistics**: Delivered, opened, clicked, bounced, unsubscribed
- **Engagement Metrics**: Open rates, click-through rates, geographic data
- **Individual Tracking**: See which emails were opened/clicked by specific users
- **Timeline View**: Real-time delivery and engagement tracking
- **Unsubscribe Management**: Automatic suppression list management

## 🛠️ How to Use

### Step 1: Deploy the Function

```bash
# Deploy the new function to Firebase
cd /Users/sscott/tbp/functions
firebase deploy --only functions:sendLaunchCampaign
```

### Step 2: Test with a Single Email

```bash
# Test the campaign with your email address
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "testEmail": "your-email@example.com"
}'
```

### Step 3: Dry Run (Preview Mode)

```bash
# See how many subscribers would receive emails without actually sending
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "dryRun": true,
  "deviceFilter": null
}'
```

### Step 4: Send Campaign

```bash
# Send to all subscribers
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "dryRun": false,
  "batchSize": 50
}'
```

## 🎯 Campaign Options

### Device Filtering

Send targeted campaigns based on device preference:

```bash
# iOS users only
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "deviceFilter": "ios",
  "dryRun": false
}'

# Android users only
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "deviceFilter": "android", 
  "dryRun": false
}'

# Users who selected "Both" platforms
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "deviceFilter": "both",
  "dryRun": false
}'
```

### Batch Size Configuration

Control sending speed and respect rate limits:

```bash
# Smaller batches for careful sending
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "batchSize": 25,
  "dryRun": false
}'

# Larger batches for faster sending
curl -X POST https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/sendLaunchCampaign \
-H "Content-Type: application/json" \
-d '{
  "batchSize": 100,
  "dryRun": false
}'
```

## 📧 Email Template Features

### Professional Design
- **Consistent Branding**: Matches your website's Inter font and color scheme
- **Mobile Responsive**: Looks great on all devices and email clients
- **Professional Layout**: Clean, modern design without hype or "stop words"
- **Team Build Pro Logo**: Your official app icon in the header

### Smart Content
- **Device-Specific Buttons**: Shows appropriate download buttons based on user preference
- **Personalized Greeting**: Uses subscriber's actual first name
- **Professional Messaging**: Focuses on "software tool" positioning, not opportunity language
- **Call-to-Action**: Drives traffic back to your website

### Compliance Features
- **Unsubscribe Links**: Fully managed by SendGrid
- **Professional Sender**: From "Team Build Pro <support@teambuildpro.com>"
- **Legal Footer**: Includes all required unsubscribe and preference links

## 📈 Expected Results

Based on your `launch_notifications` collection, you can expect:

- **High Deliverability**: Professional sender reputation through SendGrid
- **Good Engagement**: Personalized, relevant content for interested subscribers
- **Detailed Analytics**: Complete tracking through SendGrid dashboard
- **Professional Presentation**: Consistent with your brand standards

## 🔧 Campaign Monitoring

### Real-Time Logs
Monitor campaign progress in Firebase Functions logs:

```bash
# View function logs
firebase functions:log --only sendLaunchCampaign
```

### Campaign Analytics
View campaign completion in your Firestore `campaign_logs` collection:

- Total emails sent/failed
- Device filter applied
- Completion timestamp
- Campaign identifier

### SendGrid Dashboard
- Login to your SendGrid account
- View detailed email statistics
- Track individual subscriber engagement
- Monitor unsubscribes and bounces

## 🚨 Important Notes

### Before Sending
1. **Test First**: Always send a test email to yourself
2. **Dry Run**: Use dry run mode to verify subscriber counts
3. **Check Template**: Ensure your email template looks correct
4. **Verify URLs**: Confirm App Store and Google Play URLs are current

### During Campaign
1. **Monitor Logs**: Watch Firebase Functions logs for any errors
2. **SendGrid Dashboard**: Check real-time delivery statistics
3. **Error Handling**: The function handles failures gracefully and continues

### After Campaign
1. **Review Analytics**: Check SendGrid dashboard for engagement metrics
2. **Handle Unsubscribes**: SendGrid automatically manages suppression lists
3. **Campaign Logs**: Review Firestore logs for completion data

## 🛡️ Security & Compliance

- **API Key Security**: Your SendGrid API key remains secure in Firebase Secrets
- **Data Privacy**: Only uses data from your `launch_notifications` collection
- **Unsubscribe Compliance**: Fully managed by SendGrid infrastructure
- **Professional Reputation**: Maintains your sender reputation through proper practices

## 📞 Support

If you encounter issues:

1. **Check Firebase Logs**: `firebase functions:log --only sendLaunchCampaign`
2. **SendGrid Dashboard**: Review delivery statistics and errors
3. **Test Mode**: Use `testEmail` parameter to troubleshoot individual emails
4. **Dry Run**: Use `dryRun: true` to verify configuration without sending

Your launch campaign is ready to go! This professional, compliant system will deliver your Team Build Pro launch announcement to your subscribers with full tracking and analytics through your SendGrid dashboard.