---
description: Run email campaign and GA4 analytics report for the last 24 hours
---

# Email Campaign & GA4 Analytics Report

Run a comprehensive email campaign analytics report for the Main (Gmail) campaign covering the past 24 hours.

## Execute the following:

1. **GA4 Email Campaign Analytics**: Run the GA4 analytics script to get email traffic data
   ```bash
   cd /Users/sscott/tbp/analytics && GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" node fetch-email-campaign-analytics.js
   ```

2. **Today's Email Send Count**: Check how many emails were sent today
   ```bash
   cd /Users/sscott/tbp/functions && node count-todays-emails.js
   ```

3. **Mailgun Delivery Stats**: Get delivery, open, and click statistics from Mailgun
   ```bash
   cd /Users/sscott/tbp/functions && node get-mailgun-stats.js
   ```

4. **Recent Sends Check**: Query Firestore for recent email sends and 24-hour totals using a temporary script that queries the `emailCampaigns/master/contacts` collection, ordering by `sentTimestamp` descending.

## Output Format

Present the results in a summary table format showing:
- Email sends (last 24 hours)
- Mailgun delivery stats (delivered, opened, clicked, failed)
- GA4 traffic from email (sessions, users, engagement)
- Campaign progress (total contacts, sent, remaining)
- Any issues identified
