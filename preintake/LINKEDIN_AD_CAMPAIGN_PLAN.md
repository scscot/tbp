# PreIntake.ai LinkedIn Ad Campaign Plan

**Created**: 2026-01-06
**Status**: Ready for Launch
**Monthly Budget**: $900-1,500 (phased)

---

## Executive Summary

LinkedIn advertising to acquire law firm customers for PreIntake.ai. Target: small-to-mid-size firms (2-50 employees) struggling with unqualified intake volume. Goal: demo requests that convert to $248 initial + $99/mo subscriptions.

---

## Campaign Economics

### Unit Economics Target

| Metric | Target | Acceptable | Kill |
|--------|--------|------------|------|
| Cost Per Lead (CPL) | <$25 | $25-40 | >$50 |
| Cost Per Demo | <$150 | $150-250 | >$300 |
| Demo-to-Paid Rate | >15% | 10-15% | <5% |
| Customer Acquisition Cost (CAC) | <$1,000 | $1,000-1,500 | >$2,000 |

### Payback Calculation

- **First Month Revenue**: $248 ($149 setup + $99 subscription)
- **Monthly Recurring**: $99
- **12-Month LTV**: $1,237 ($248 + 11 × $99)
- **Target CAC**: <$1,000 (12-month payback)

---

## Phase 1: Foundation (Weeks 1-2)

### Budget
- **Daily**: $30
- **Total**: $420

### Objective
Validate funnel with PI attorneys. A/B test Lead Gen Forms vs Landing Page.

### Targeting

**Campaign 1A: Lead Gen Form**
- **Audience**: Personal Injury attorneys
- **Job Titles**: Partner, Owner, Managing Partner, Founding Partner, Senior Partner
- **Company Size**: 2-50 employees
- **Industry**: Law Practice, Legal Services
- **Geography**: United States
- **Exclusions**: Large firms (AmLaw 200), legal tech companies

**Campaign 1B: Landing Page Traffic**
- Same targeting as 1A
- Destination: preintake.ai with UTM tracking

### Ad Creative

**Primary Ad (Single Image)**
```
Headline: Stop Reviewing Unqualified PI Leads

Body: Your intake staff shouldn't waste hours on cases that were never
a fit. PreIntake.ai screens leads before they reach your team—routing
GREEN cases to consults and RED cases to polite declines.

See it work for your firm in 60 seconds.

CTA: Generate Your Demo
```

**Image**: Screenshot of GREEN/YELLOW/RED qualification dashboard (dark background)

**Secondary Ad (Problem/Solution)**
```
Headline: 60% of Your Intake Submissions Won't Sign

Body: Generic forms flood your inbox with unqualified leads. PreIntake.ai
asks practice-specific questions and screens like your best paralegal—24/7.

Your staff only sees cases worth reviewing.

CTA: See Your Firm's Demo
```

### Success Metrics (Week 2 Review)
- [ ] CPL under $40
- [ ] Demo request rate >5%
- [ ] At least 10 demos generated
- [ ] Identify Lead Gen Form vs Landing Page winner

---

## Phase 2: Expansion (Weeks 3-4)

### Budget
- **Daily**: $30
- **Total**: $420

### Objective
Scale winning format. Test Office Manager segment. Add second practice area.

### New Test Segments

**Segment A: Office Managers**
- **Job Titles**: Office Manager, Practice Manager, Operations Manager, Legal Administrator
- **Company Size**: 2-50 employees
- **Rationale**: At small firms, often the decision-maker for operational tools

**Segment B: Immigration Attorneys**
- **Job Titles**: Same as Phase 1 (Partners/Owners)
- **Rationale**: 47% AI adoption rate (highest in legal), complex intake needs

### Ad Creative (Immigration-Specific)

```
Headline: Immigration Intake That Speaks Their Language

Body: Visa status, timeline bars, prior violations—your intake needs to
ask the right questions before staff reviews. PreIntake.ai screens
immigration leads with practice-specific logic.

See a demo built for your firm.

CTA: Generate Your Demo
```

### Success Metrics (Week 4 Review)
- [ ] Identify best-performing segment
- [ ] CPL under $35
- [ ] At least 20 total demos
- [ ] First paid conversion from LinkedIn

---

## Phase 3: Scale (Week 5+)

### Budget
- **Daily**: $50-75 (based on Phase 1-2 results)
- **Monthly**: $1,500-2,250

### Scale Criteria
Only increase budget if:
- CAC < $1,500 after $1,000 spend
- Demo-to-paid rate > 10%
- At least 2 paid conversions

### Expansion Roadmap

| Priority | Practice Area | Ad Spend Trigger |
|----------|---------------|------------------|
| 1 | Personal Injury | Launch (Week 1) |
| 2 | Immigration | Week 3 |
| 3 | Family Law | After first 5 conversions |
| 4 | Bankruptcy | After first 10 conversions |
| 5 | Criminal Defense | After first 15 conversions |

---

## Retargeting Campaign

### Launch Trigger
- Minimum 500 website visitors
- OR 1,000 ad impressions

### Audience Segments

**Segment 1: Website Visitors (Non-Converters)**
- Visited preintake.ai
- Did NOT request demo
- Frequency cap: 5 impressions/week

**Segment 2: Demo Viewers (Non-Activators)**
- Requested demo
- Did NOT activate account
- Message: "Your demo is waiting"

**Segment 3: Email Engagers**
- Opened PreIntake email campaign
- Did NOT click
- Upload as matched audience

### Retargeting Creative

```
Headline: Your PreIntake.ai Demo is Ready

Body: We built a custom intake demo for your firm. See how it screens
leads before they reach your staff.

Takes 60 seconds to review.

CTA: View Your Demo
```

---

## Creative Assets Needed

| Asset | Specs | Purpose |
|-------|-------|---------|
| Dashboard Screenshot | 1200x627px, dark background | Primary ad image |
| Before/After Visual | 1200x627px | Inbox chaos → qualified list |
| GREEN/YELLOW/RED Icons | 1200x627px | Show routing logic |
| Logo Badge | 300x300px | Brand recognition |

### Creative Rotation Schedule
- Rotate primary creative every 2 weeks
- Test new creative against control monthly
- Pause any creative with CTR <0.3%

---

## Tracking & Attribution

### UTM Parameters

```
Landing Page Traffic:
?utm_source=linkedin&utm_medium=paid&utm_campaign=pi_attorneys&utm_content=dashboard_v1

Lead Gen Form:
?utm_source=linkedin&utm_medium=lead_gen&utm_campaign=pi_attorneys&utm_content=dashboard_v1
```

### Conversion Events
1. **Demo Request** (primary) - Form submission on preintake.ai
2. **Demo View** - Visited /demo/{firmId}
3. **Account Activation** - Completed Stripe checkout
4. **First Intake** - Received first lead via PreIntake

### Reporting Cadence
- **Daily**: Spend, impressions, clicks, CPL
- **Weekly**: Demo requests, demo completion rate, funnel analysis
- **Monthly**: CAC, conversion rate, ROI analysis

---

## Budget Summary

| Phase | Duration | Daily | Total |
|-------|----------|-------|-------|
| Phase 1 | Weeks 1-2 | $30 | $420 |
| Phase 2 | Weeks 3-4 | $30 | $420 |
| Phase 3 | Week 5+ | $50-75 | $1,500-2,250/mo |
| Retargeting | Ongoing | $10-15 | $300-450/mo |

**Month 1 Total**: $840-1,000
**Month 2+ Total**: $1,800-2,700 (if scaling)

---

## Kill Criteria

**Pause Campaign If:**
- CAC > $2,000 after $1,000 spend
- Demo-to-paid rate < 5% after 20 demos
- CPL > $50 sustained for 7 days
- Zero conversions after 30 demos

**Pivot Actions:**
1. Narrow targeting (remove underperforming segments)
2. Test new creative angles
3. Adjust landing page messaging
4. Consider alternative channels (Google Ads, email partnerships)

---

## Pre-Launch Checklist

- [ ] LinkedIn Campaign Manager account set up
- [ ] LinkedIn Insight Tag installed on preintake.ai
- [ ] Conversion tracking configured (demo request event)
- [ ] Lead Gen Form created with required fields
- [ ] Dashboard screenshot creative approved
- [ ] UTM parameters tested
- [ ] Landing page optimized for LinkedIn traffic
- [ ] Retargeting audiences created (website visitors, email list)
- [ ] Budget approved and billing configured

---

## Appendix: Ad Copy Variations

### Headline Options (Test Rotation)
1. "Stop Reviewing Unqualified PI Leads"
2. "60% of Your Intake Submissions Won't Sign"
3. "AI Intake That Screens Like Your Best Paralegal"
4. "Your Intake Staff Deserves Better Leads"

### CTA Options (Test Rotation)
1. "Generate Your Demo" (primary)
2. "See Your Firm's Demo"
3. "Watch 60-Second Demo"
4. "Get Your Custom Demo"

### Practice-Area-Specific Headlines

| Practice Area | Headline |
|---------------|----------|
| Personal Injury | "Stop Reviewing Unqualified PI Leads" |
| Immigration | "Immigration Intake That Asks the Right Questions" |
| Family Law | "Screen Sensitive Family Law Intakes Automatically" |
| Bankruptcy | "Qualify Bankruptcy Leads Before Staff Review" |
| Criminal Defense | "Criminal Defense Intake—Fast, Accurate Screening" |

---

**Document Owner**: Stephen Scott
**Last Updated**: 2026-01-06
**Next Review**: After Phase 2 completion
