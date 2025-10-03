# 7-Day Launch Monitoring Dashboard

## Overview
This dashboard provides comprehensive monitoring for Team Build Pro's referral tracking system during the critical first week post-launch. Monitor attribution accuracy, detect issues early, and ensure optimal performance.

## Key Metrics & Alerts

### 1. Attribution Accuracy Metrics

#### Universal Link Success Rate
**Target**: >95% success rate for direct deep links
```sql
-- BigQuery Analytics Query
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_universal_links,
  SUM(CASE WHEN attribution_success = true THEN 1 ELSE 0 END) as successful_attributions,
  ROUND(100.0 * SUM(CASE WHEN attribution_success = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate_percent
FROM `teambuilder-plus-fe74d.analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'universal_link_opened'
GROUP BY date
ORDER BY date DESC
```

#### Referral Source Distribution
**Expected**: Constructor (40%), Branch (35%), Cache (25%)
```javascript
// Firestore Query (Firebase Console)
db.collection('users')
  .where('createdAt', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .get()
  .then(snapshot => {
    const sources = {};
    snapshot.docs.forEach(doc => {
      const source = doc.data().referralSource || 'unknown';
      sources[source] = (sources[source] || 0) + 1;
    });
    console.log('Referral Source Distribution:', sources);
  });
```

### 2. Branch SDK Performance

#### Branch Attribution Metrics
**Monitor via Branch Dashboard:**
- **Click → Install Rate**: Target >60%
- **Install → Open Rate**: Target >90%
- **Deferred Deep Link Success**: Target >85%

#### Branch API Queries
```bash
# Branch Analytics API calls
curl -X GET "https://api2.branch.io/v1/analytics?branch_key=YOUR_BRANCH_KEY&start_date=2024-01-01&end_date=2024-01-07" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Key metrics to monitor:
# - total_clicks
# - total_installs
# - total_opens
# - install_to_open_rate
```

### 3. Sponsor Overwrite Monitoring

#### Overwrite Decision Analytics
```javascript
// Firestore Query for Overwrite Audits
db.collection('referralAudits')
  .where('timestamp', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .where('action', '==', 'referral_overwrite')
  .get()
  .then(snapshot => {
    const decisions = { accepted: 0, rejected: 0 };
    snapshot.docs.forEach(doc => {
      const decision = doc.data().userDecision;
      decisions[decision] = (decisions[decision] || 0) + 1;
    });

    const total = decisions.accepted + decisions.rejected;
    const acceptanceRate = total > 0 ? (decisions.accepted / total * 100).toFixed(2) : 0;

    console.log('Overwrite Decisions:', decisions);
    console.log('Acceptance Rate:', acceptanceRate + '%');
  });
```

**Alert Thresholds:**
- **High Rejection Rate**: >50% overwrites rejected (possible UX issue)
- **High Acceptance Rate**: >80% accepted (possible fraud pattern)

### 4. Fraud Detection Metrics

#### Self-Referral Detection
```javascript
// Query for Self-Referral Flags
db.collection('fraudFlags')
  .where('createdAt', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .where('flagType', '==', 'self_referral')
  .get()
  .then(snapshot => {
    console.log('Self-referral attempts in last 7 days:', snapshot.size);

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log('Flag:', {
        userId: data.userId,
        severity: data.severity,
        evidence: data.evidence
      });
    });
  });
```

#### Rapid Registration Monitoring
```javascript
// Query for Multiple Registrations from Same Source
db.collection('users')
  .where('createdAt', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h
  .get()
  .then(snapshot => {
    const ipCounts = {};
    const deviceCounts = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const ip = data.registrationIpAddress;
      const device = data.deviceFingerprint;

      if (ip) ipCounts[ip] = (ipCounts[ip] || 0) + 1;
      if (device) deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });

    // Alert on >3 registrations from same IP/device
    Object.entries(ipCounts).forEach(([ip, count]) => {
      if (count > 3) console.log(`🚨 High IP activity: ${ip} (${count} registrations)`);
    });
  });
```

## Daily Monitoring Checklist

### Day 1-2 (Critical Launch Period)
- [ ] **Every 2 hours**: Check Universal Link success rate
- [ ] **Every 4 hours**: Verify Branch attribution data
- [ ] **Daily**: Review fraud flags and unusual patterns
- [ ] **Daily**: Monitor Smart App Banner click-through rates

### Day 3-7 (Stabilization Period)
- [ ] **Daily**: Review key metrics summary
- [ ] **Every 2 days**: Deep dive into attribution sources
- [ ] **Weekly**: Comprehensive fraud detection review
- [ ] **Weekly**: Performance optimization recommendations

## Automated Alerts & Thresholds

### Critical Alerts (Immediate Response)
```javascript
// Alert Configuration Examples
const ALERT_THRESHOLDS = {
  universal_link_failure_rate: 10,    // >10% failure rate
  branch_attribution_failure: 20,     // >20% attribution failure
  fraud_flags_per_hour: 5,           // >5 fraud flags per hour
  overwrite_dialog_frequency: 30     // >30% of users see overwrite dialog
};

// Sample alert function (integrate with your monitoring system)
function checkMetricsAndAlert() {
  // Universal Link monitoring
  if (universalLinkFailureRate > ALERT_THRESHOLDS.universal_link_failure_rate) {
    sendAlert('🚨 CRITICAL: Universal Link failure rate exceeded threshold');
  }

  // Branch attribution monitoring
  if (branchAttributionFailure > ALERT_THRESHOLDS.branch_attribution_failure) {
    sendAlert('⚠️ WARNING: Branch attribution failure rate high');
  }
}
```

### Warning Alerts (Next Business Day)
- Sponsor name resolution failures >5%
- Cache hit rate below expected baseline
- Referral code format validation errors
- AASA file accessibility issues

## Performance Benchmarks

### Expected Baseline Metrics
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Universal Link Success Rate | >95% | <90% |
| Branch Install Attribution | >85% | <75% |
| Sponsor Name Resolution | >98% | <95% |
| Smart App Banner CTR | >15% | <10% |
| Referral Code Validation | >99% | <97% |
| Overwrite Dialog Acceptance | 50-70% | <30% or >90% |

### Regional Performance Monitoring
```javascript
// Monitor performance by geographic region
db.collection('users')
  .where('createdAt', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .get()
  .then(snapshot => {
    const regions = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const country = data.registrationCountry || 'unknown';
      const source = data.referralSource || 'unknown';

      if (!regions[country]) regions[country] = {};
      regions[country][source] = (regions[country][source] || 0) + 1;
    });

    console.log('Regional Attribution Distribution:', regions);
  });
```

## Issue Resolution Playbook

### Universal Link Failures
**Symptoms**: Low constructor attribution, users reporting "link doesn't work"
**Investigation**:
1. Check AASA file accessibility at both locations
2. Verify DNS and SSL certificate status
3. Test on multiple iOS devices and versions
4. Validate AASA JSON syntax

**Resolution**:
1. Redeploy AASA files if corrupted
2. Clear CDN cache if stale
3. Update DNS if routing issues
4. Coordinate with hosting provider

### Branch Attribution Issues
**Symptoms**: Low branch attribution, missing deferred data
**Investigation**:
1. Check Branch dashboard for API errors
2. Verify Branch SDK configuration
3. Test deferred deep links on clean installs
4. Monitor Branch real-time events

**Resolution**:
1. Restart Branch SDK if initialization fails
2. Update Branch configuration if keys changed
3. Contact Branch support for platform issues

### High Fraud Flag Volume
**Symptoms**: Excessive fraud alerts, legitimate users flagged
**Investigation**:
1. Review fraud detection algorithms
2. Check for false positive patterns
3. Analyze flagged user behavior
4. Validate detection thresholds

**Resolution**:
1. Adjust fraud detection sensitivity
2. Whitelist legitimate patterns
3. Update detection algorithms
4. Manual review of edge cases

## Weekly Summary Report Template

```markdown
# Week 1 Launch Summary - Team Build Pro Referral System

## Attribution Performance
- Total Registrations: [X]
- Successful Attributions: [X] ([X]%)
- Universal Link Success: [X]%
- Branch Attribution Success: [X]%

## Source Distribution
- Constructor (Direct Links): [X]%
- Branch (Deferred): [X]%
- Cache (Stored): [X]%
- No Attribution: [X]%

## User Experience
- Overwrite Dialogs Shown: [X]
- Acceptance Rate: [X]%
- Average Resolution Time: [X]s
- Support Tickets Related: [X]

## Fraud Detection
- Self-Referral Attempts: [X]
- Rapid Registration Flags: [X]
- False Positive Rate: [X]%
- Manual Reviews Required: [X]

## Technical Issues
- AASA File Uptime: [X]%
- Branch API Uptime: [X]%
- Smart App Banner CTR: [X]%
- Critical Alerts: [X]

## Action Items
- [ ] [High Priority Issue 1]
- [ ] [Medium Priority Issue 2]
- [ ] [Optimization Opportunity 1]

## Recommendations for Week 2
1. [Specific recommendation based on data]
2. [Performance optimization suggestion]
3. [User experience improvement]
```

## Monitoring Tools Integration

### Firebase Analytics Setup
```javascript
// Custom events to track
analytics.logEvent('referral_attribution', {
  source: 'constructor|branch|cache',
  referral_code: 'ABC123',
  success: true,
  resolution_time_ms: 1250
});

analytics.logEvent('overwrite_dialog_shown', {
  current_source: 'constructor',
  new_source: 'branch',
  user_decision: 'accepted|rejected'
});
```

### External Monitoring Integration
```bash
# Datadog Integration Example
curl -X POST "https://api.datadoghq.com/api/v1/series" \
-H "Content-Type: application/json" \
-H "DD-API-KEY: ${DATADOG_API_KEY}" \
-d '{
  "series": [{
    "metric": "teambuildpro.referral.attribution_rate",
    "points": [['$(date +%s)', 95.5]],
    "tags": ["env:production", "feature:referral_tracking"]
  }]
}'

# PagerDuty Alert Integration
curl -X POST "https://events.pagerduty.com/v2/enqueue" \
-H "Content-Type: application/json" \
-d '{
  "routing_key": "YOUR_INTEGRATION_KEY",
  "event_action": "trigger",
  "payload": {
    "summary": "Universal Link failure rate exceeded threshold",
    "source": "Team Build Pro Monitoring",
    "severity": "critical"
  }
}'
```

---

**Critical Success Factors:**
1. **First 48 hours**: Monitor every 2-4 hours for critical issues
2. **Real device testing**: Validate on physical iOS devices, not just simulators
3. **Cross-timezone coverage**: Ensure 24/7 monitoring during launch week
4. **Escalation paths**: Clear contact info for Branch support and Apple developer support
5. **Rollback readiness**: Keep previous AASA files and configuration ready

**Remember**: The first week determines user perception and adoption success. Proactive monitoring and rapid issue resolution are essential.