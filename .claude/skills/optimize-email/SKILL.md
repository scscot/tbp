---
name: optimize-email
description: Analyze email campaign performance and recommend optimizations. Use when reviewing campaign metrics, troubleshooting deliverability, or planning A/B tests.
argument-hint: "[campaign-name] or --all or --deliverability"
allowed-tools: Bash(node *), Bash(cd *), Bash(curl *), Read, Glob, Grep
disable-model-invocation: true
---

# Email Campaign Optimization Skill

Analyze and optimize Team Build Pro email campaigns across all 9 active campaign sources.

## Active Campaigns

| Campaign | Collection | Batch Size Field | Status |
|----------|------------|-----------------|--------|
| Main | emailCampaigns/master/contacts | batchSize | Disabled |
| Purchased | purchased_leads | batchSizePurchased | Active |
| BFH | bfh_contacts | batchSizeBfh | Active |
| Zinzino | zinzino_contacts | batchSizeZinzino | Active |
| FSR | fsr_contacts | batchSizeFsr | Active |
| Paparazzi | paparazzi_contacts | batchSizePaparazzi | Active |
| Pruvit | pruvit_contacts | batchSizePruvit | Active |
| Scentsy | scentsy_contacts | scentsyBatchSize | Active |
| Farmasius | farmasius_contacts | batchSizeFarmasius | Active |

## Analysis Modes

### 1. Campaign Status Check
Get current status of all campaigns including sent/remaining counts.

```bash
cd /Users/sscott/tbp/functions && node count-todays-emails.js
```

### 2. GA4 Email Traffic Analysis
Analyze click-through traffic from email campaigns (tracked via UTM parameters).

```bash
cd /Users/sscott/tbp/analytics && GOOGLE_APPLICATION_CREDENTIALS="../secrets/ga4-service-account.json" node fetch-email-campaign-analytics.js
```

### 3. Deliverability Check
Review spam monitor status and recent bounce rates.

Read the spam monitor script output:
- Check `.github/workflows/spam-monitor.yml` run history
- Review `scripts/spam-monitor.js` for current configuration
- Check Mailgun bounce sync: `scripts/sync-tbp-mailgun-failures.js`

## Key Metrics to Track

1. **Send Metrics** (Firestore)
   - Emails sent per campaign per day
   - Failed sends and error messages
   - Queue depth (remaining contacts)

2. **Engagement Metrics** (GA4)
   - Click-through rate (UTM: sessionMedium='email')
   - Landing page sessions from email
   - Device breakdown (mobile vs desktop)

3. **Deliverability Metrics** (Mailgun)
   - Bounce rate by domain
   - Spam complaints
   - Unsubscribe rate

## Optimization Checklist

### Subject Line Analysis
- Current: "Build your downline with AI" (V16 template)
- Localized: ES, PT, DE variants
- Single subject (no A/B testing since Feb 25, 2026)

### Batch Size Optimization
Dynamic batch sizing formula:
```
batchSize = ceil(unsentCount / (30 days × 4 runs/day)) × warmingMultiplier
```

Warming schedule:
- Week 1: 40%
- Week 2: 60%
- Week 3: 80%
- Week 4+: 100%

### Deliverability Best Practices
- [ ] 10/10 mail-tester.com score (SPF/DKIM/DMARC)
- [ ] Click tracking via GA4 UTM (not Mailgun pixels)
- [ ] Open tracking disabled (improves deliverability)
- [ ] List-Unsubscribe headers present
- [ ] No spam trigger words in subject

## Common Issues & Solutions

### High Bounce Rate
1. Run corporate email cleanup: `node scripts/audit-corporate-emails.js --remove`
2. Sync Mailgun failures: `node scripts/sync-tbp-mailgun-failures.js`
3. Check blacklisted domains in `scripts/base_urls.txt`

### Landing in Spam
1. Check spam monitor results in GitHub Actions
2. Review subject line for trigger words
3. Verify SPF/DKIM/DMARC at mail-tester.com
4. Reduce batch sizes temporarily

### Low Click Rate
1. Analyze GA4 traffic by campaign (utm_content tag)
2. Compare performance across languages
3. Review landing page conversion rate
4. Test alternative CTAs in template

## Example Usage

```
/optimize-email --all
/optimize-email bfh
/optimize-email --deliverability
```

## Related Files

- Campaign functions: `functions/email-campaign-*.js`
- Analytics dashboard: `web/TBP-analytics.html`
- Email stats dashboard: `web/email-stats.html`
- Warming config: `.github/warming-config.json`
- Spam monitor: `scripts/spam-monitor.js`
- Bounce sync: `scripts/sync-tbp-mailgun-failures.js`
