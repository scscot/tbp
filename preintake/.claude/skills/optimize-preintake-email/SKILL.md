---
name: optimize-preintake-email
description: Analyze PreIntake.ai email campaign performance and recommend optimizations. Use when reviewing campaign metrics, troubleshooting deliverability, or checking campaign status.
argument-hint: "[--stats | --deliverability | --funnel]"
---

# PreIntake Email Campaign Optimization Skill

Analyze and optimize the PreIntake.ai attorney email campaign.

## Campaign Overview

| Attribute | Value |
|-----------|-------|
| Collection | `preintake_emails` |
| Sending Domain | `legal.preintake.ai` |
| From | `Stephen Scott <stephen@legal.preintake.ai>` |
| Schedule | 4x daily Mon-Fri (6am, 12pm, 4pm, 8pm PT) |
| Batch Size | Dynamic via `config/emailCampaign.preintakeBatchSize` |
| Warming Config | `.github/warming-config.json` → `preintake` section |

## Analysis Modes

### 1. Campaign Stats Check
Get current campaign status including sent/remaining counts.

```bash
cd /Users/sscott/tbp/functions && node -e "
const { db } = require('./shared/utilities');
async function stats() {
  const snap = await db.collection('preintake_emails').get();
  const sent = snap.docs.filter(d => d.data().sent === true).length;
  const failed = snap.docs.filter(d => d.data().status === 'failed').length;
  const pending = snap.docs.filter(d => d.data().sent === false && d.data().status !== 'failed').length;
  console.log('PreIntake Email Campaign Stats:');
  console.log('  Total contacts:', snap.size);
  console.log('  Sent:', sent);
  console.log('  Failed:', failed);
  console.log('  Pending:', pending);
}
stats();
"
```

### 2. Deliverability Check
Review spam monitor and bounce sync status.

Check workflows:
- **Spam Monitor**: `.github/workflows/preintake-spam-monitor.yml` (Daily 7am PT)
- **Bounce Sync**: `.github/workflows/sync-mailgun-failures.yml` (Daily 5am PT)

```bash
# Check recent workflow runs
gh run list --workflow=preintake-spam-monitor.yml --limit=5
gh run list --workflow=sync-mailgun-failures.yml --limit=5
```

### 3. Engagement Funnel Analysis
Track the conversion funnel from email to payment.

```bash
cd /Users/sscott/tbp/analytics && GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" node -e "
// Fetch PreIntake GA4 traffic with email source
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const client = new BetaAnalyticsDataClient();
// Query for email campaign traffic (sessionMedium = 'email')
"
```

## Key Metrics to Track

1. **Send Metrics** (Firestore `preintake_emails`)
   - Emails sent per day
   - Failed sends and error messages
   - Queue depth (pending contacts)

2. **Engagement Metrics** (GA4)
   - Landing page visits (from email CTA)
   - Create Account click rate
   - Stripe checkout completion

3. **Deliverability Metrics** (Mailgun)
   - Bounce rate by domain
   - Spam complaints
   - Inbox vs spam placement

## Troubleshooting

### High Bounce Rate
1. Check bounce sync: `node scripts/sync-mailgun-failures.js --dry-run`
2. Review failed contacts in Firestore
3. Check for corporate domain patterns

### Landing in Spam
1. Check spam monitor results in GitHub Actions
2. Verify SPF/DKIM/DMARC at mail-tester.com
3. Reduce batch size temporarily via Firestore config

### Low Click Rate
1. Analyze GA4 traffic (filter sessionMedium='email')
2. Check landing page performance
3. Review email template and CTA

## Related Files

- Campaign script: `scripts/send-preintake-campaign.js`
- Spam monitor: `scripts/preintake-spam-monitor.js`
- Bounce sync: `scripts/sync-mailgun-failures.js`
- Analytics dashboard: `preintake/preintake-analytics.html`
- Warming config: `.github/warming-config.json`
- Campaign workflow: `.github/workflows/preintake-email-campaign.yml`
